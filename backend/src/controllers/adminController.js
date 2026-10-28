// ─────────────────────────────────────────────────────────────
// Admin controller — all routes are protected by `protect` +
// `adminOnly` (server-side role check) in adminRoutes.
//   - Dashboard stats
//   - Order management (list / view / update status)
//   - User management (list / activate / deactivate)
// Product & category management lives in their own controllers.
// ─────────────────────────────────────────────────────────────

import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import {
  listAllOrders,
  getOrderByIdAdmin,
  updateOrderStatus,
} from '../services/orderService.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LOW_STOCK_THRESHOLD = 5;

// GET /api/admin/stats
export const getDashboardStats = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    pendingPaymentOrders,
    toFulfilOrders,
    lowStockProducts,
    revenueAgg,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Product.countDocuments(),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: 'pending' }),
    Order.countDocuments({ orderStatus: { $in: ['confirmed', 'processing'] } }),
    Product.countDocuments({ isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: '$totals.total' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      totalProducts,
      totalOrders,
      pendingPaymentOrders,
      toFulfilOrders,
      lowStockProducts,
      paidOrders: revenueAgg[0]?.count || 0,
      revenue: revenueAgg[0]?.revenue || 0,
    },
  });
});

// GET /api/admin/orders
export const getAllOrders = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const { orders, pagination } = await listAllOrders(query);

  res.json({
    success: true,
    data: { orders, pagination },
  });
});

// GET /api/admin/orders/:id
export const getOrder = asyncHandler(async (req, res) => {
  const order = await getOrderByIdAdmin(req.params.id);

  res.json({
    success: true,
    data: { order },
  });
});

// PUT /api/admin/orders/:id/status   body: { status, note? }
export const updateOrderStatusController = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const order = await updateOrderStatus(req.params.id, status, note);

  res.json({
    success: true,
    message: `Order status updated to "${order.orderStatus}".`,
    data: { order },
  });
});

// GET /api/admin/users
export const getUsers = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);

  const filter = {};

  if (query.role) filter.role = query.role;

  if (query.search && query.search.trim()) {
    const regex = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    },
  });
});

// PUT /api/admin/users/:id/status   body: { isActive }
export const setUserActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) throw AppError.notFound('User not found.');

  if (user._id.equals(req.user._id)) {
    throw AppError.badRequest('You cannot change the status of your own account.');
  }

  if (user.role === 'admin') {
    throw AppError.forbidden('Admin accounts cannot be deactivated from the dashboard.');
  }

  user.isActive = isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'}.`,
    data: { user },
  });
});