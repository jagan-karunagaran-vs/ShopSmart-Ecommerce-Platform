import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ProductCard.css';
import { formatPrice } from '../utils/helpers.js';
import { useStore } from '../context/StoreContext.jsx';

function ProductCard({ product, onCartUpdate, onWishlistUpdate, onError }) {
  const navigate = useNavigate();
  const {
    isInCart,
    isWishlisted,
    addToCart,
    addToWishlist,
    removeFromWishlist,
  } = useStore();

  const [busy, setBusy] = useState(false);

  const inCart = isInCart(product.id);
  const wishlisted = isWishlisted(product.id);
  const outOfStock = product.stock !== undefined && product.stock <= 0;

  // ── Add to Cart ───────────────────────────────────────────
  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (busy || outOfStock) return;

    setBusy(true);
    try {
      await addToCart(product.id, 1);
      if (onCartUpdate) onCartUpdate(product.name, 'cart');
    } catch (err) {
      if (onError) onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Toggle Wishlist ───────────────────────────────────────
  const handleWishlist = async (e) => {
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    try {
      if (wishlisted) {
        await removeFromWishlist(product.id);
        if (onWishlistUpdate) onWishlistUpdate(product.name, 'removed');
      } else {
        await addToWishlist(product.id);
        if (onWishlistUpdate) onWishlistUpdate(product.name, 'wishlist');
      }
    } catch (err) {
      if (onError) onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Rating color ──────────────────────────────────────────
  const getRatingClass = (rating) => {
    if (rating >= 4) return '';
    if (rating >= 3) return 'low';
    return 'verylow';
  };

  return (
    <div
      className="product-card"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      {/* ── Discount Badge ── */}
      {product.discount > 0 && (
        <span className="product-discount-badge">{product.discount}% off</span>
      )}

      {/* ── Wishlist Button ── */}
      <button
        className={`product-wishlist-btn ${wishlisted ? 'wishlisted' : ''}`}
        onClick={handleWishlist}
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {wishlisted ? '❤️' : '🤍'}
      </button>

      {/* ── Product Image ── */}

      <div className="product-image-wrap">
   <img
  className="product-image"
  src={product.image?.trim() || ''}
  alt={product.name}
  onError={(e) => {
    e.target.style.display = 'none';
  }}
/>
</div>
      {/* ── Card Body ── */}
      <div className="product-body">
        <div className="product-category-tag">{product.category}</div>

        <div className="product-name">{product.name}</div>

        {/* ── Rating ── */}
        <div className="product-rating-row">
          <span className={`product-rating-badge ${getRatingClass(product.rating)}`}>
            {product.rating} <span className="product-rating-star">★</span>
          </span>
          <span className="product-reviews">
            ({product.reviews?.toLocaleString('en-IN')})
          </span>
        </div>

        {/* ── Price ── */}
        <div className="product-price-row">
          <span className="product-price">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="product-original-price">
              {formatPrice(product.originalPrice)}
            </span>
          )}
          {product.discount > 0 && (
            <span className="product-discount-text">{product.discount}% off</span>
          )}
        </div>

        {/* ── Add to Cart ── */}
        <button
          className={`product-cart-btn ${inCart ? 'added' : ''}`}
          onClick={handleAddToCart}
          disabled={busy || outOfStock}
        >
          {outOfStock
            ? 'Out of Stock'
            : inCart
              ? '✓ Added to Cart'
              : '🛒 Add to Cart'}
        </button>
      </div>
    </div>
  );
}

export default ProductCard;