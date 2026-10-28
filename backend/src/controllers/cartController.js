// ─────────────────────────────────────────────────────────────
// Cart controller — one cart per authenticated user.
//
// Responses always return the full cart in the shape the storefront
// already uses (product fields + `quantity`) plus server-calculated
// totals:
//   data: { items: [{ id, name, price, …, quantity }], totals }
//
// Prices always come from the Product collection (never the client).
// ─────────────────────────────────────────────────────────────

import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { calculateOrderTotals } from '../utils/calculateOrderTotals.js';

const MAX_QTY_PER_ITEM = 99;

/** Loads the user's cart (creating it if needed). */
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

/**
 * Builds the API response for a cart. Items whose product was deleted
 * or deactivated are dropped (and removed from the stored cart).
 */
const buildCartResponse = async (cart) => {
  await cart.populate('items.product');

  const validItems = cart.items.filter((i) => i.product && i.product.isActive);

  if (validItems.length !== cart.items.length) {
    cart.items = validItems.map((i) => ({
      product: i.product._id,
      quantity: i.quantity,
    }));
    await cart.save();
    await cart.populate('items.product');
  }

  const items = cart.items.map((i) => ({
    ...i.product.toJSON(),
    quantity: i.quantity,
  }));

  const totals = calculateOrderTotals(items);

  return { items, totals };
};

const assertQuantityAvailable = (product, quantity) => {
  if (quantity > MAX_QTY_PER_ITEM) {
    throw AppError.badRequest(`You can add at most ${MAX_QTY_PER_ITEM} units of an item.`);
  }

  if (product.stock <= 0) {
    throw AppError.conflict(`"${product.name}" is out of stock.`);
  }

  if (quantity > product.stock) {
    throw AppError.conflict(
      `Only ${product.stock} unit(s) of "${product.name}" are available.`
    );
  }
};

const findActiveProduct = async (productId) => {
  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    throw AppError.notFound('Product not found.');
  }

  return product;
};

// GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);

  res.json({
    success: true,
    data: await buildCartResponse(cart),
  });
});

// POST /api/cart/items   body: { productId, quantity? }
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  const product = await findActiveProduct(productId);
  const cart = await getOrCreateCart(req.user._id);

  const existing = cart.items.find((i) => i.product.toString() === product._id.toString());
  const newQuantity = (existing ? existing.quantity : 0) + quantity;

  assertQuantityAvailable(product, newQuantity);

  if (existing) {
    existing.quantity = newQuantity;
  } else {
    cart.items.push({ product: product._id, quantity: newQuantity });
  }

  await cart.save();

  res.status(201).json({
    success: true,
    message: `"${product.name}" added to cart.`,
    data: await buildCartResponse(cart),
  });
});

// PUT /api/cart/items/:productId   body: { quantity }
export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;

  const product = await findActiveProduct(req.params.productId);
  const cart = await getOrCreateCart(req.user._id);

  const item = cart.items.find((i) => i.product.toString() === product._id.toString());

  if (!item) throw AppError.notFound('Item not found in cart.');

  assertQuantityAvailable(product, quantity);

  item.quantity = quantity;
  await cart.save();

  res.json({
    success: true,
    message: 'Cart updated.',
    data: await buildCartResponse(cart),
  });
});

// DELETE /api/cart/items/:productId
export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const productId = req.params.productId;

  const before = cart.items.length;
  cart.items = cart.items.filter((i) => i.product.toString() !== productId);

  if (cart.items.length === before) {
    throw AppError.notFound('Item not found in cart.');
  }

  await cart.save();

  res.json({
    success: true,
    message: 'Item removed from cart.',
    data: await buildCartResponse(cart),
  });
});

// DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);

  cart.items = [];
  await cart.save();

  res.json({
    success: true,
    message: 'Cart cleared.',
    data: await buildCartResponse(cart),
  });
});