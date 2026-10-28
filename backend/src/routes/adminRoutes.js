import { Router } from 'express';
import { z } from 'zod';
import {
  getDashboardStats,
  getAllOrders,
  getOrder,
  updateOrderStatusController,
  getUsers,
  setUserActive,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../models/Order.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────
const idParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.'),
});

const orderListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  search: z.string().trim().max(60).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
  note: z.string().trim().max(300).optional(),
});

const userListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  search: z.string().trim().max(80).optional(),
});

const userStatusSchema = z.object({
  isActive: z.boolean(),
});

// Server-side admin authorization for EVERY route in this file.
router.use(protect, adminOnly);

router.get('/stats', getDashboardStats);

router.get('/orders', validateRequest({ query: orderListQuery }), getAllOrders);
router.get('/orders/:id', validateRequest({ params: idParams }), getOrder);
router.put(
  '/orders/:id/status',
  validateRequest({ params: idParams, body: updateStatusSchema }),
  updateOrderStatusController
);

router.get('/users', validateRequest({ query: userListQuery }), getUsers);
router.put(
  '/users/:id/status',
  validateRequest({ params: idParams, body: userStatusSchema }),
  setUserActive
);

export default router;