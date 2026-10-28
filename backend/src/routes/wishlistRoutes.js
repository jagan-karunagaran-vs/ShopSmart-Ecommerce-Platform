import { Router } from 'express';
import { z } from 'zod';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product id.');

const productParams = z.object({ productId: objectId });

const addItemSchema = z.object({ productId: objectId });

// Every wishlist belongs to the logged-in user (+ CSRF on writes).
router.use(protect);

router.get('/', getWishlist);
router.post('/items', validateRequest({ body: addItemSchema }), addToWishlist);
router.delete(
  '/items/:productId',
  validateRequest({ params: productParams }),
  removeFromWishlist
);
router.delete('/', clearWishlist);

export default router;