// ─────────────────────────────────────────────────────────────
// Order controller (customer side)
// - Orders are created from the user's SERVER-SIDE cart; the client
//   sends only the delivery address. Prices, totals and stock are
//   all validated on the server.
// - Admin order management lives in adminController.
// ─────────────────────────────────────────────────────────────

import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import {
  createOrderFromCart,
  listUserOrders,
  getUserOrder,
  cancelOrderById,
} from '../services/orderService.js';

// POST /api/orders   body: { shippingAddress }
export const createOrder = asyncHandler(async (req, res) => {
  const order = await createOrderFromCart(req.user._id, req.body.shippingAddress);

  res.status(201).json({
    success: true,
    message: 'Order created. Please complete the payment.',
    data: { order },
  });
});

// GET /api/orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const { orders, pagination } = await listUserOrders(req.user._id, query);

  res.json({
    success: true,
    data: { orders, pagination },
  });
});

// GET /api/orders/:id
export const getMyOrder = asyncHandler(async (req, res) => {
  const order = await getUserOrder(req.user._id, req.params.id);

  res.json({
    success: true,
    data: { order },
  });
});

// PUT /api/orders/:id/cancel
// Customers can only cancel orders that have not been paid yet.
// (Paid orders must be cancelled/refunded by an admin.)
export const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await getUserOrder(req.user._id, req.params.id);

  if (order.paymentStatus === 'paid') {
    throw AppError.conflict(
      'This order has already been paid. Please contact support to cancel and refund it.'
    );
  }

  const cancelled = await cancelOrderById(
    order._id,
    req.body?.reason || 'Cancelled by customer.'
  );

  res.json({
    success: true,
    message: 'Order cancelled.',
    data: { order: cancelled },
  });
});