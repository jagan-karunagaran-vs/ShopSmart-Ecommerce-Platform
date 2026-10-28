import { Router } from 'express';
import { z } from 'zod';
import {
  createOrder,
  getMyOrders,
  getMyOrder,
  cancelMyOrder,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────
const idParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid order id.'),
});

const addressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name is required.')
    .max(100, 'Full name is too long.'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{8,14}$/, 'Please enter a valid phone number.'),
  line1: z
    .string()
    .trim()
    .min(3, 'Address line 1 is required.')
    .max(200, 'Address line 1 is too long.'),
  line2: z.string().trim().max(200, 'Address line 2 is too long.').optional().default(''),
  city: z.string().trim().min(2, 'City is required.').max(80),
  state: z.string().trim().min(2, 'State is required.').max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code.'),
  country: z
    .string()
    .trim()
    .refine((v) => v.toLowerCase() === 'india', {
      message: 'Delivery is currently available only within India.',
    })
    .transform(() => 'India')
    .optional()
    .default('India'),
});

// Only the delivery address comes from the client — items and prices
// are always taken from the server-side cart.
const createOrderSchema = z.object({
  shippingAddress: addressSchema,
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

// All order routes require login (+ CSRF on writes).
router.use(protect);

router.post('/', validateRequest({ body: createOrderSchema }), createOrder);
router.get('/', validateRequest({ query: listQuerySchema }), getMyOrders);
router.get('/:id', validateRequest({ params: idParams }), getMyOrder);
router.put(
  '/:id/cancel',
  validateRequest({ params: idParams, body: cancelSchema }),
  cancelMyOrder
);

export default router;