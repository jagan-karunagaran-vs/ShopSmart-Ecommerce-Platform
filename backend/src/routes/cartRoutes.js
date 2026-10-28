import { Router } from 'express';
import { z } from 'zod';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product id.');

const productParams = z.object({ productId: objectId });

const quantitySchema = z.coerce
  .number()
  .int('Quantity must be a whole number.')
  .min(1, 'Quantity must be at least 1.')
  .max(99, 'Quantity cannot exceed 99.');

const addItemSchema = z.object({
  productId: objectId,
  quantity: quantitySchema.optional(),
});

const updateItemSchema = z.object({
  quantity: quantitySchema,
});

// Every cart belongs to the logged-in user (+ CSRF on writes).
router.use(protect);

router.get('/', getCart);
router.post('/items', validateRequest({ body: addItemSchema }), addToCart);
router.put(
  '/items/:productId',
  validateRequest({ params: productParams, body: updateItemSchema }),
  updateCartItem
);
router.delete(
  '/items/:productId',
  validateRequest({ params: productParams }),
  removeCartItem
);
router.delete('/', clearCart);

export default router;