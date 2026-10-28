import { Router } from 'express';
import { z } from 'zod';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────
const idParams = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.'),
});

const categoryBodyShape = {
  name: z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters.')
    .max(60, 'Category name must be at most 60 characters.'),
  icon: z.string().trim().max(16).optional(),
  image: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(300).optional(),
};

const createCategorySchema = z.object(categoryBodyShape);

const updateCategorySchema = z
  .object(categoryBodyShape)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

// ── Public ───────────────────────────────────────────────────
router.get('/', getCategories);
router.get('/:id', validateRequest({ params: idParams }), getCategoryById);

// ── Admin only ───────────────────────────────────────────────
router.post(
  '/',
  protect,
  adminOnly,
  validateRequest({ body: createCategorySchema }),
  createCategory
);

router.put(
  '/:id',
  protect,
  adminOnly,
  validateRequest({ params: idParams, body: updateCategorySchema }),
  updateCategory
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  validateRequest({ params: idParams }),
  deleteCategory
);

export default router;