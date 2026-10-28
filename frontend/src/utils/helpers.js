// ─────────────────────────────────────────────────────────────
// ShopSmart helpers — pure formatting / calculation utilities only.
// Cart, wishlist, users and sessions now live on the server
// (see services/api.js, context/AuthContext.jsx and
// context/StoreContext.jsx); nothing here touches localStorage.
// ─────────────────────────────────────────────────────────────

// ─── Currency Formatter ─────────────────────────────────────
export const formatPrice = (price) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
};

// ─── Discount Calculator ────────────────────────────────────
export const calculateDiscount = (original, current) => {
  return Math.round(((original - current) / original) * 100);
};

// ─── Rating Stars Generator ─────────────────────────────────
export const getStarRating = (rating) => {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return { full, half, empty };
};

// ─── Truncate Text ──────────────────────────────────────────
export const truncateText = (text, maxLength = 60) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// ─── Cart Helpers (pure — operate on cart arrays from the API) ──
export const getCartTotal = (cart) => {
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
};

export const getCartCount = (cart) => {
  return cart.reduce((count, item) => count + item.quantity, 0);
};

// ─── Wishlist Helper (pure) ─────────────────────────────────
export const isInWishlist = (wishlist, productId) => {
  return wishlist.some((item) => item.id === productId);
};

// ─── Review Count Formatter ─────────────────────────────────
export const formatReviewCount = (count) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return count.toString();
};