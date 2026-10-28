// ─────────────────────────────────────────────────────────────
// Product controller
// Public  : list (filter / search / sort), get one
// Admin   : create, update, delete  (routes enforce admin + CSRF)
//
// The storefront loads the full catalog and filters client-side, so
// the list endpoint returns ALL matching products unless `limit`
// is supplied. Category/price/search/sort filters are also supported
// server-side.
// ─────────────────────────────────────────────────────────────

import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Cart from '../models/Cart.js';
import Wishlist from '../models/Wishlist.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  catalog: { _id: 1 },
  newest: { _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  rating: { rating: -1, reviews: -1, _id: 1 },
  discount: { discount: -1, _id: 1 },
};

/** Returns the canonical category name (case-insensitive) or throws. */
const resolveCategoryName = async (name) => {
  const category = await Category.findOne({ name: String(name).trim() }).collation({
    locale: 'en',
    strength: 2,
  });

  if (!category) {
    throw AppError.badRequest(`Category "${name}" does not exist.`);
  }

  return category.name;
};

// GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const { category, q, minPrice, maxPrice, sort, page, limit, includeInactive } = query;

  const filter = {};

  // Only admins may see inactive products.
  const isAdmin = req.user?.role === 'admin';
  if (!(isAdmin && includeInactive)) {
    filter.isActive = true;
  }

  if (category) {
    filter.category = category;
  }

  if (q && q.trim()) {
    const regex = { $regex: escapeRegex(q.trim()), $options: 'i' };
    filter.$or = [{ name: regex }, { category: regex }, { description: regex }];
  }

  if (minPrice != null || maxPrice != null) {
    filter.price = {};
    if (minPrice != null) filter.price.$gte = minPrice;
    if (maxPrice != null) filter.price.$lte = maxPrice;
  }

  const sortSpec = SORTS[sort] || SORTS.catalog;

  const total = await Product.countDocuments(filter);

  let cursor = Product.find(filter).sort(sortSpec);
  let currentPage = 1;
  let pageSize = total;
  let pages = 1;

  if (limit) {
    currentPage = page || 1;
    pageSize = limit;
    pages = Math.ceil(total / limit) || 1;
    cursor = cursor.skip((currentPage - 1) * limit).limit(limit);
  }

  const products = await cursor;

  res.json({
    success: true,
    data: {
      products,
      pagination: { page: currentPage, limit: pageSize, total, pages },
    },
  });
});

// GET /api/products/:id
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  const isAdmin = req.user?.role === 'admin';

  if (!product || (!product.isActive && !isAdmin)) {
    throw AppError.notFound('Product not found.');
  }

  res.json({
    success: true,
    data: { product },
  });
});

// POST /api/products  (admin)
export const createProduct = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  body.category = await resolveCategoryName(body.category);

  const product = await Product.create(body);

  res.status(201).json({
    success: true,
    message: `"${product.name}" added successfully.`,
    data: { product },
  });
});

// PUT /api/products/:id  (admin)
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) throw AppError.notFound('Product not found.');

  const updates = { ...req.body };

  if (updates.category) {
    updates.category = await resolveCategoryName(updates.category);
  }

  product.set(updates);
  await product.save(); // re-runs pricing normalisation (discount)

  res.json({
    success: true,
    message: `"${product.name}" updated successfully.`,
    data: { product },
  });
});

// DELETE /api/products/:id  (admin)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) throw AppError.notFound('Product not found.');

  // Remove dangling references (past orders keep their own snapshots).
  await Promise.all([
    Cart.updateMany({}, { $pull: { items: { product: product._id } } }),
    Wishlist.updateMany({}, { $pull: { products: product._id } }),
  ]);

  res.json({
    success: true,
    message: `"${product.name}" deleted successfully.`,
    data: { id: product._id.toString() },
  });
});