import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import '../styles/Wishlist.css';
import { formatPrice } from '../utils/helpers.js';
import { useStore } from '../context/StoreContext.jsx';

function Wishlist() {
  const navigate = useNavigate();

  // ── Wishlist + cart live on the server (per user) ─────────
  const {
    wishlistItems: wishlist,
    removeFromWishlist,
    clearWishlist,
    addToCart,
    isInCart,
  } = useStore();

  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  // ── Run an action, showing server errors in the toast ─────
  const runAction = async (action, successMessage) => {
    if (busy) return;

    setBusy(true);
    try {
      await action();
      if (successMessage) showToast(successMessage);
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Remove from wishlist ──────────────────────────────────
  const handleRemove = (id, name) => {
    runAction(() => removeFromWishlist(id), `💔 "${name}" removed from wishlist.`);
  };

  // ── Clear all wishlist ────────────────────────────────────
  const handleClearAll = () => {
    runAction(() => clearWishlist(), '🗑️ Wishlist cleared.');
  };

  // ── Add to cart ───────────────────────────────────────────
  const handleAddToCart = (item) => {
    runAction(() => addToCart(item.id, 1), `🛒 "${item.name}" added to cart!`);
  };

  // ── Rating color ──────────────────────────────────────────
  const getRatingClass = (rating) => {
    if (rating >= 4) return '';
    if (rating >= 3) return 'low';
    return 'verylow';
  };

  return (
    <div className="wishlist-page">

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Page Header ── */}
      <div className="wishlist-header">
        <div className="wishlist-header-inner">
          <div className="wishlist-header-left">
            <span className="wishlist-header-title">My Wishlist</span>
            {wishlist.length > 0 && (
              <span className="wishlist-header-count">{wishlist.length}</span>
            )}
          </div>
          {wishlist.length > 0 && (
            <button
              className="wishlist-clear-btn"
              onClick={handleClearAll}
              disabled={busy}
            >
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="wishlist-content">
        {wishlist.length === 0 ? (

          /* ── Empty State ── */
          <div className="wishlist-empty">
            <div className="wishlist-empty-icon">💔</div>
            <h3>Your wishlist is empty!</h3>
            <p>
              Save items you love to your wishlist. Review them anytime
              and easily move them to your cart.
            </p>
            <button
              className="wishlist-empty-btn"
              onClick={() => navigate('/home')}
            >
              Start Shopping
            </button>
          </div>

        ) : (

          /* ── Wishlist Grid ── */
          <div className="wishlist-grid">
            {wishlist.map((item) => {
              const inCart = isInCart(item.id);
              const outOfStock = item.stock !== undefined && item.stock <= 0;

              return (
                <div key={item.id} className="wishlist-card">

                  {/* Discount Badge */}
                  {item.discount > 0 && (
                    <span className="wishlist-discount-badge">
                      {item.discount}% off
                    </span>
                  )}

                  {/* Remove Button */}
                  <button
                    className="wishlist-remove-btn"
                    onClick={() => handleRemove(item.id, item.name)}
                    aria-label="Remove from wishlist"
                    disabled={busy}
                  >
                    ❤️
                  </button>

                  {/* Image */}
                  <div
                    className="wishlist-image-wrap"
                    onClick={() => navigate(`/product/${item.id}`)}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="wishlist-image"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src =
                          'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80';
                      }}
                    />
                  </div>

                  {/* Card Body */}
                  <div className="wishlist-card-body">
                    <div className="wishlist-card-category">{item.category}</div>

                    <div
                      className="wishlist-card-name"
                      onClick={() => navigate(`/product/${item.id}`)}
                    >
                      {item.name}
                    </div>

                    {/* Rating */}
                    <div className="wishlist-rating-row">
                      <span className={`wishlist-rating-badge ${getRatingClass(item.rating)}`}>
                        {item.rating} ★
                      </span>
                      <span className="wishlist-reviews">
                        ({item.reviews?.toLocaleString('en-IN')})
                      </span>
                    </div>

                    {/* Price */}
                    <div className="wishlist-price-row">
                      <span className="wishlist-price">{formatPrice(item.price)}</span>
                      {item.originalPrice && (
                        <span className="wishlist-original-price">
                          {formatPrice(item.originalPrice)}
                        </span>
                      )}
                      {item.discount > 0 && (
                        <span className="wishlist-discount-text">
                          {item.discount}% off
                        </span>
                      )}
                    </div>

                    {/* Add to Cart */}
                    <button
                      className={`wishlist-cart-btn ${inCart ? 'added' : ''}`}
                      onClick={() => handleAddToCart(item)}
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
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <Footer />

      {/* ── Toast ── */}
      <div className={`wishlist-toast ${toast.show ? 'show' : ''}`}>
        {toast.message}
      </div>

    </div>
  );
}

export default Wishlist;