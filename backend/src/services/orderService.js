// Order service
// - Creates orders using server-side cart prices.
// - Reserves/restores stock inside MongoDB transactions.
// - Handles payment transitions without reversing refunds.
// - Checks all stock before attempting to revive cancelled orders.

import crypto from 'crypto';
import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import { calculateOrderTotals } from '../utils/calculateOrderTotals.js';

const PENDING_ORDER_TTL_MINUTES = 30;

const STATUS_TRANSITIONS = {
  pending: ['cancelled'],
  confirmed: ['processing', 'shipped', 'delivered', 'cancelled'],
  processing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// ── Helpers ─────────────────────────────────────────────────

const generateOrderNumber = () =>
  `SS-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await work(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
};

const pushHistory = (order, status, note = '') => {
  order.statusHistory.push({
    status,
    note,
    changedAt: new Date(),
  });
};

// Combine quantities if the same product appears more than once.
const getStockRequirements = (items) => {
  const requirements = new Map();

  for (const item of items) {
    if (
      !item.product ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw AppError.conflict('Order contains an invalid item quantity.');
    }

    const key = String(item.product);
    const existing = requirements.get(key);

    if (existing) {
      existing.quantity += item.quantity;

      if (!Number.isSafeInteger(existing.quantity)) {
        throw AppError.conflict('Order item quantity is too large.');
      }
    } else {
      requirements.set(key, {
        product: item.product,
        quantity: item.quantity,
        name: item.name,
      });
    }
  }

  return [...requirements.values()];
};

// Read-only check: no stock changes happen here.
const hasAvailableStock = async (items, session) => {
  const requirements = getStockRequirements(items);

  for (const item of requirements) {
    const product = await Product.findOne({
      _id: item.product,
      isActive: true,
      stock: { $gte: item.quantity },
    })
      .select('_id')
      .session(session)
      .lean();

    if (!product) return false;
  }

  return true;
};

// Any failure must propagate to the enclosing transaction.
// Do not catch and suppress errors after some items were deducted.
const deductStock = async (items, session) => {
  const requirements = getStockRequirements(items);

  for (const item of requirements) {
    const result = await Product.updateOne(
      {
        _id: item.product,
        isActive: true,
        stock: { $gte: item.quantity },
      },
      { $inc: { stock: -item.quantity } },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw AppError.conflict(
        `Sorry, "${item.name}" does not have enough stock for the requested quantity.`
      );
    }
  }
};

const restoreStock = async (items, session) => {
  const requirements = getStockRequirements(items);

  for (const item of requirements) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: item.quantity } },
      { session }
    );
  }
};

const paginate = (page, limit) => {
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  return {
    page: p,
    limit: l,
    skip: (p - 1) * l,
  };
};

// ── Cancellation ────────────────────────────────────────────

const cancelOrderInSession = async (order, reason, session) => {
  if (order.orderStatus === 'cancelled') return order;

  if (['shipped', 'delivered'].includes(order.orderStatus)) {
    throw AppError.conflict(
      `A ${order.orderStatus} order cannot be cancelled.`
    );
  }

  if (order.stockDeducted) {
    await restoreStock(order.items, session);
    order.stockDeducted = false;
  }

  order.orderStatus = 'cancelled';
  order.cancelledAt = new Date();
  order.cancellationReason = String(reason || '').slice(0, 300);

  if (order.paymentStatus === 'paid') {
    pushHistory(
      order,
      'cancelled',
      'Cancelled after payment — refund required.'
    );
  } else {
    pushHistory(
      order,
      'cancelled',
      order.cancellationReason || 'Order cancelled.'
    );
  }

  await order.save({ session });

  return order;
};

export const cancelOrderById = async (orderId, reason = '') =>
  runInTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      throw AppError.notFound('Order not found.');
    }

    return cancelOrderInSession(order, reason, session);
  });

export const releaseExpiredPendingOrders = async () => {
  const cutoff = new Date(
    Date.now() - PENDING_ORDER_TTL_MINUTES * 60 * 1000
  );

  const expiredFilter = {
    orderStatus: 'pending',
    paymentStatus: { $in: ['pending', 'failed'] },
    stockDeducted: true,
    createdAt: { $lt: cutoff },
  };

  const stale = await Order.find(expiredFilter)
    .select('_id')
    .limit(50)
    .lean();

  for (const { _id } of stale) {
    try {
      await runInTransaction(async (session) => {
        // Recheck inside the transaction: the order may have
        // become paid since the initial query.
        const order = await Order.findOne({
          _id,
          ...expiredFilter,
        }).session(session);

        if (!order) return;

        await cancelOrderInSession(
          order,
          'Payment not completed in time.',
          session
        );
      });
    } catch (err) {
      console.error(
        `Failed to release expired order ${_id}:`,
        err.message
      );
    }
  }
};

// ── Create an order from the user's cart ─────────────────────

export const createOrderFromCart = async (userId, shippingAddress) => {
  await releaseExpiredPendingOrders();

  const cart = await Cart.findOne({ user: userId }).populate(
    'items.product'
  );

  if (!cart || cart.items.length === 0) {
    throw AppError.badRequest('Your cart is empty.');
  }

  const items = [];

  for (const cartItem of cart.items) {
    const product = cartItem.product;

    if (!product || !product.isActive) {
      throw AppError.conflict(
        'An item in your cart is no longer available. Please review your cart.'
      );
    }

    if (
      !Number.isSafeInteger(cartItem.quantity) ||
      cartItem.quantity <= 0
    ) {
      throw AppError.badRequest('Invalid cart item quantity.');
    }

    if (product.stock < cartItem.quantity) {
      throw AppError.conflict(
        product.stock === 0
          ? `"${product.name}" is out of stock.`
          : `Only ${product.stock} unit(s) of "${product.name}" are available.`
      );
    }

    items.push({
      product: product._id,
      name: product.name,
      category: product.category,
      image: product.image,
      price: product.price,
      originalPrice: product.originalPrice ?? product.price,
      quantity: cartItem.quantity,
    });
  }

  const totals = calculateOrderTotals(items);

  return runInTransaction(async (session) => {
    await deductStock(items, session);

    const [order] = await Order.create(
      [
        {
          orderNumber: generateOrderNumber(),
          user: userId,
          items,
          shippingAddress,
          totals,
          currency: (process.env.CURRENCY || 'INR').toUpperCase(),
          orderStatus: 'pending',
          paymentStatus: 'pending',
          stockDeducted: true,
          statusHistory: [
            {
              status: 'pending',
              note: 'Order created. Awaiting payment.',
            },
          ],
        },
      ],
      { session }
    );

    return order;
  });
};

// ── Payment state transitions ────────────────────────────────
// These functions use the payment service's transaction.

export const markOrderPaid = async (orderId, session) => {
  const order = await Order.findById(orderId).session(session);

  if (!order) {
    throw AppError.notFound('Order not found.');
  }

  if (order.paymentStatus === 'paid') return order;

  if (order.paymentStatus === 'refunded') {
    throw AppError.conflict(
      'A refunded order cannot be marked paid again.'
    );
  }

  order.paymentStatus = 'paid';
  order.paidAt = new Date();

  if (order.orderStatus === 'cancelled') {
    let canConfirm = Boolean(order.stockDeducted);

    if (!order.stockDeducted) {
      const available = await hasAvailableStock(
        order.items,
        session
      );

      if (available) {
        // If stock changes concurrently, let the transaction
        // retry or roll back. Never suppress deduction errors.
        await deductStock(order.items, session);
        order.stockDeducted = true;
        canConfirm = true;
      }
    }

    if (canConfirm) {
      order.orderStatus = 'confirmed';
      order.cancelledAt = undefined;
      order.cancellationReason = '';

      pushHistory(
        order,
        'confirmed',
        'Payment received. Order re-confirmed.'
      );
    } else {
      // Record the received payment, but keep the order cancelled.
      // A refund is required; this function does not issue it.
      pushHistory(
        order,
        'cancelled',
        'Payment received after cancellation and stock is unavailable — refund required.'
      );
    }
  } else {
    if (order.orderStatus === 'pending') {
      if (!order.stockDeducted) {
        await deductStock(order.items, session);
        order.stockDeducted = true;
      }

      order.orderStatus = 'confirmed';
    }

    pushHistory(
      order,
      order.orderStatus,
      'Payment verified.'
    );
  }

  await order.save({ session });

  if (order.orderStatus === 'confirmed') {
    await Cart.updateOne(
      { user: order.user },
      { $set: { items: [] } },
      { session }
    );
  }

  return order;
};

export const markOrderPaymentFailed = async (orderId, session) => {
  const order = await Order.findById(orderId).session(session);

  if (!order) {
    throw AppError.notFound('Order not found.');
  }

  if (['paid', 'refunded'].includes(order.paymentStatus)) {
    return order;
  }

  if (order.paymentStatus !== 'failed') {
    order.paymentStatus = 'failed';

    pushHistory(
      order,
      order.orderStatus,
      'Payment attempt failed.'
    );

    await order.save({ session });
  }

  return order;
};

export const markOrderRefunded = async (orderId, session) => {
  const order = await Order.findById(orderId).session(session);

  if (!order) {
    throw AppError.notFound('Order not found.');
  }

  if (order.paymentStatus === 'refunded') return order;

  if (order.paymentStatus !== 'paid') {
    throw AppError.conflict(
      'Only a paid order can be marked refunded.'
    );
  }

  order.paymentStatus = 'refunded';

  pushHistory(
    order,
    order.orderStatus,
    'Payment refunded.'
  );

  await order.save({ session });

  return order;
};

// ── User queries ────────────────────────────────────────────

export const listUserOrders = async (
  userId,
  { page, limit } = {}
) => {
  const { page: p, limit: l, skip } = paginate(page, limit);

  const [orders, total] = await Promise.all([
    Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l),
    Order.countDocuments({ user: userId }),
  ]);

  return {
    orders,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l) || 1,
    },
  };
};

export const getUserOrder = async (userId, orderId) => {
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
  });

  if (!order) {
    throw AppError.notFound('Order not found.');
  }

  return order;
};

// ── Admin queries and status management ──────────────────────

export const listAllOrders = async ({
  page,
  limit,
  status,
  paymentStatus,
  search,
} = {}) => {
  const { page: p, limit: l, skip } = paginate(page, limit);
  const filter = {};

  if (status) filter.orderStatus = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  if (search && search.trim()) {
    filter.orderNumber = {
      $regex: escapeRegex(search.trim()),
      $options: 'i',
    };
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l) || 1,
    },
  };
};

export const getOrderByIdAdmin = async (orderId) => {
  const order = await Order.findById(orderId).populate(
    'user',
    'name email'
  );

  if (!order) {
    throw AppError.notFound('Order not found.');
  }

  return order;
};

export const updateOrderStatus = async (
  orderId,
  newStatus,
  note = ''
) => {
  if (newStatus === 'cancelled') {
    return cancelOrderById(
      orderId,
      note || 'Cancelled by admin.'
    );
  }

  return runInTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      throw AppError.notFound('Order not found.');
    }

    const allowed = STATUS_TRANSITIONS[order.orderStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw AppError.conflict(
        `Cannot change order status from "${order.orderStatus}" to "${newStatus}".`
      );
    }

    if (order.paymentStatus !== 'paid') {
      throw AppError.conflict(
        'Only paid orders can be processed or shipped.'
      );
    }

    order.orderStatus = newStatus;

    pushHistory(
      order,
      newStatus,
      note || `Status updated to ${newStatus}.`
    );

    await order.save({ session });

    return order;
  });
};

export default {
  createOrderFromCart,
  cancelOrderById,
  releaseExpiredPendingOrders,
  markOrderPaid,
  markOrderPaymentFailed,
  markOrderRefunded,
  listUserOrders,
  getUserOrder,
  listAllOrders,
  getOrderByIdAdmin,
  updateOrderStatus,
};