// ─────────────────────────────────────────────────────────────
// Category controller
// Public : list
// Admin  : create, update, delete
//
// Products reference categories by NAME, so renaming a category
// cascades to its products, and deleting a category that still has
// products is blocked.
// ─────────────────────────────────────────────────────────────

import Category from '../models/Category.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const CI_COLLATION = { locale: 'en', strength: 2 };

// GET /api/categories
export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ _id: 1 });

  res.json({
    success: true,
    data: { categories },
  });
});

// GET /api/categories/:id
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) throw AppError.notFound('Category not found.');

  res.json({
    success: true,
    data: { category },
  });
});

// POST /api/categories  (admin)
export const createCategory = asyncHandler(async (req, res) => {
  const existing = await Category.findOne({ name: req.body.name }).collation(CI_COLLATION);

  if (existing) {
    throw AppError.conflict(`Category "${existing.name}" already exists.`);
  }

  const category = await Category.create(req.body);

  res.status(201).json({
    success: true,
    message: `Category "${category.name}" added successfully.`,
    data: { category },
  });
});

// PUT /api/categories/:id  (admin)
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) throw AppError.notFound('Category not found.');

  const oldName = category.name;
  const newName = req.body.name;

  if (newName && newName.toLowerCase() !== oldName.toLowerCase()) {
    const clash = await Category.findOne({ name: newName }).collation(CI_COLLATION);

    if (clash) {
      throw AppError.conflict(`Category "${clash.name}" already exists.`);
    }
  }

  category.set(req.body);
  await category.save();

  // Keep products in sync when the name changes.
  if (category.name !== oldName) {
    await Product.updateMany({ category: oldName }, { $set: { category: category.name } });
  }

  res.json({
    success: true,
    message: `Category "${category.name}" updated successfully.`,
    data: { category },
  });
});

// DELETE /api/categories/:id  (admin)
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) throw AppError.notFound('Category not found.');

  const productCount = await Product.countDocuments({ category: category.name });

  if (productCount > 0) {
    throw AppError.conflict(
      `Cannot delete "${category.name}" — it still has ${productCount} product(s). Move or delete them first.`
    );
  }

  await category.deleteOne();

  res.json({
    success: true,
    message: `Category "${category.name}" deleted successfully.`,
    data: { id: category._id.toString() },
  });
});