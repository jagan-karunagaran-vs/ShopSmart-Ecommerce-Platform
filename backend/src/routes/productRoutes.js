import { Router } from 'express';
import { z } from 'zod';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');

const idParams = z.object({ id: objectId });

const listQuerySchema = z.object({
  category: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z
    .enum(['catalog', 'newest', 'price_asc', 'price_desc', 'rating', 'discount'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

const productBodyShape = {
  name: z.string().trim().min(2, 'Product name must be at least 2 characters.').max(200),
  category: z.string().trim().min(1, 'Category is required.').max(60),
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
  originalPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  reviews: z.coerce.number().int().min(0).optional(),
  image: z.string().trim().max(2000).optional(),
  description: z.string().trim().max(2000).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
};

const createProductSchema = z.object(productBodyShape);

const updateProductSchema = z
  .object(productBodyShape)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

// ── Public (optionalAuth lets admins request inactive products) ──
router.get('/', optionalAuth, validateRequest({ query: listQuerySchema }), getProducts);
router.get('/:id', optionalAuth, validateRequest({ params: idParams }), getProductById);

// ── Admin only ───────────────────────────────────────────────
router.post(
  '/',
  protect,
  adminOnly,
  validateRequest({ body: createProductSchema }),
  createProduct
);

router.put(
  '/:id',
  protect,
  adminOnly,
  validateRequest({ params: idParams, body: updateProductSchema }),
  updateProduct
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  validateRequest({ params: idParams }),
  deleteProduct
);

export default router;