// ─────────────────────────────────────────────────────────────
// Wishlist controller — one wishlist per authenticated user.
//
// Responses return the wishlist in the shape the storefront already
// uses (an array of product objects):
//   data: { items: [{ id, name, price, … }], count }
// ─────────────────────────────────────────────────────────────

import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

const getOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, products: [] });
  return wishlist;
};

/** Builds the response; drops products that were deleted / deactivated. */
const buildWishlistResponse = async (wishlist) => {
  await wishlist.populate('products');

  const validProducts = wishlist.products.filter((p) => p && p.isActive);

  if (validProducts.length !== wishlist.products.length) {
    wishlist.products = validProducts.map((p) => p._id);
    await wishlist.save();
    await wishlist.populate('products');
  }

  const items = wishlist.products.map((p) => p.toJSON());

  return { items, count: items.length };
};

// GET /api/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user._id);

  res.json({
    success: true,
    data: await buildWishlistResponse(wishlist),
  });
});

// POST /api/wishlist/items   body: { productId }
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    throw AppError.notFound('Product not found.');
  }

  const wishlist = await getOrCreateWishlist(req.user._id);

  const alreadyAdded = wishlist.products.some(
    (id) => id.toString() === product._id.toString()
  );

  if (!alreadyAdded) {
    wishlist.products.push(product._id);
    await wishlist.save();
  }

  res.status(alreadyAdded ? 200 : 201).json({
    success: true,
    message: alreadyAdded
      ? `"${product.name}" is already in your wishlist.`
      : `"${product.name}" added to wishlist.`,
    data: await buildWishlistResponse(wishlist),
  });
});

// DELETE /api/wishlist/items/:productId
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user._id);
  const productId = req.params.productId;

  const before = wishlist.products.length;
  wishlist.products = wishlist.products.filter((id) => id.toString() !== productId);

  if (wishlist.products.length === before) {
    throw AppError.notFound('Item not found in wishlist.');
  }

  await wishlist.save();

  res.json({
    success: true,
    message: 'Item removed from wishlist.',
    data: await buildWishlistResponse(wishlist),
  });
});

// DELETE /api/wishlist
export const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user._id);

  wishlist.products = [];
  await wishlist.save();

  res.json({
    success: true,
    message: 'Wishlist cleared.',
    data: await buildWishlistResponse(wishlist),
  });
});