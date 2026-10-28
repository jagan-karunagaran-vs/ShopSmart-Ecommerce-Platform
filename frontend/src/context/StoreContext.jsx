// ─────────────────────────────────────────────────────────────
// StoreContext — server-backed shop state
//   • Catalog  : products + categories (public, loaded once)
//   • Cart     : per logged-in user, stored in MongoDB
//   • Wishlist : per logged-in user, stored in MongoDB
//
// Replaces the old localStorage helpers and the
// `shopsmart-update` window event. Cart/wishlist are cleared from
// memory on logout and reloaded on login. All mutations return the
// server message and throw ApiError on failure so pages can show it.
// ─────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  productApi,
  categoryApi,
  cartApi,
  wishlistApi,
} from '../services/api.js';

const StoreContext = createContext(null);

const EMPTY_TOTALS = {
  subtotal: 0,
  discount: 0,
  deliveryCharge: 0,
  total: 0,
  totalItems: 0,
};

export function StoreProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || null;

  // ── Catalog ───────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  // ── Cart / wishlist ───────────────────────────────────────
  const [cartItems, setCartItems] = useState([]);
  const [cartTotals, setCartTotals] = useState(EMPTY_TOTALS);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [shopLoading, setShopLoading] = useState(false);

  // ── Catalog loader ────────────────────────────────────────
  const refreshCatalog = useCallback(async () => {
    setCatalogError('');

    try {
      const [productRes, categoryRes] = await Promise.all([
        productApi.list(),
        categoryApi.list(),
      ]);

      setProducts(productRes.data.products);
      setCategories(categoryRes.data.categories);
    } catch (err) {
      setCatalogError(err.message || 'Could not load products.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // ── Cart + wishlist loader (per user) ─────────────────────
  const applyCart = useCallback((data) => {
    setCartItems(data.items);
    setCartTotals(data.totals);
  }, []);

  const applyWishlist = useCallback((data) => {
    setWishlistItems(data.items);
  }, []);

  const refreshShop = useCallback(async () => {
    if (!userId) return;

    setShopLoading(true);

    try {
      const [cartRes, wishlistRes] = await Promise.all([
        cartApi.get(),
        wishlistApi.get(),
      ]);

      applyCart(cartRes.data);
      applyWishlist(wishlistRes.data);
    } catch {
      // A 401 is handled globally (AuthContext signs the user out).
    } finally {
      setShopLoading(false);
    }
  }, [userId, applyCart, applyWishlist]);

  useEffect(() => {
    if (!userId) {
      setCartItems([]);
      setCartTotals(EMPTY_TOTALS);
      setWishlistItems([]);
      return;
    }

    refreshShop();
  }, [userId, refreshShop]);

  // ── Cart actions ──────────────────────────────────────────
  const addToCart = useCallback(
    async (productId, quantity = 1) => {
      const res = await cartApi.add(productId, quantity);
      applyCart(res.data);
      return res.message;
    },
    [applyCart]
  );

  const setCartQuantity = useCallback(
    async (productId, quantity) => {
      const res = await cartApi.setQuantity(productId, quantity);
      applyCart(res.data);
      return res.message;
    },
    [applyCart]
  );

  const removeFromCart = useCallback(
    async (productId) => {
      const res = await cartApi.remove(productId);
      applyCart(res.data);
      return res.message;
    },
    [applyCart]
  );

  const clearCart = useCallback(async () => {
    const res = await cartApi.clear();
    applyCart(res.data);
    return res.message;
  }, [applyCart]);

  // ── Wishlist actions ──────────────────────────────────────
  const addToWishlist = useCallback(
    async (productId) => {
      const res = await wishlistApi.add(productId);
      applyWishlist(res.data);
      return res.message;
    },
    [applyWishlist]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      const res = await wishlistApi.remove(productId);
      applyWishlist(res.data);
      return res.message;
    },
    [applyWishlist]
  );

  const clearWishlist = useCallback(async () => {
    const res = await wishlistApi.clear();
    applyWishlist(res.data);
    return res.message;
  }, [applyWishlist]);

  // ── Derived helpers ───────────────────────────────────────
  const isInCart = useCallback(
    (productId) => cartItems.some((item) => item.id === productId),
    [cartItems]
  );

  const isWishlisted = useCallback(
    (productId) => wishlistItems.some((item) => item.id === productId),
    [wishlistItems]
  );

  const value = useMemo(
    () => ({
      // catalog
      products,
      categories,
      catalogLoading,
      catalogError,
      refreshCatalog,

      // cart
      cartItems,
      cartTotals,
      cartCount: cartTotals.totalItems,
      shopLoading,
      refreshShop,
      addToCart,
      setCartQuantity,
      removeFromCart,
      clearCart,
      isInCart,

      // wishlist
      wishlistItems,
      wishlistCount: wishlistItems.length,
      addToWishlist,
      removeFromWishlist,
      clearWishlist,
      isWishlisted,
    }),
    [
      products,
      categories,
      catalogLoading,
      catalogError,
      refreshCatalog,
      cartItems,
      cartTotals,
      shopLoading,
      refreshShop,
      addToCart,
      setCartQuantity,
      removeFromCart,
      clearCart,
      isInCart,
      wishlistItems,
      addToWishlist,
      removeFromWishlist,
      clearWishlist,
      isWishlisted,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error('useStore must be used inside <StoreProvider>.');
  }

  return context;
}

export default StoreContext;