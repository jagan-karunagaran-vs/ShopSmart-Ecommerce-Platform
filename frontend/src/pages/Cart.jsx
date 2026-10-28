import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import '../styles/Cart.css';
import { formatPrice } from '../utils/helpers.js';
import { useStore } from '../context/StoreContext.jsx';

function Cart() {
  const navigate = useNavigate();

  // ── Cart + wishlist live on the server (per user) ─────────
  const {
    cartItems: cart,
    cartTotals,
    shopLoading,
    setCartQuantity,
    removeFromCart,
    clearCart,
    addToWishlist,
    isWishlisted,
  } = useStore();

  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  // ── Run a cart action, showing server errors in the toast ─
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

  // ── Increase quantity ─────────────────────────────────────
  const handleIncrease = (item) => {
    runAction(() => setCartQuantity(item.id, item.quantity + 1));
  };

  // ── Decrease quantity — minimum 1 ────────────────────────
  const handleDecrease = (item) => {
    if (item.quantity <= 1) return;
    runAction(() => setCartQuantity(item.id, item.quantity - 1));
  };

  // ── Remove item from cart ─────────────────────────────────
  const handleRemove = (id, name) => {
    runAction(() => removeFromCart(id), `🗑️ "${name}" removed from cart.`);
  };

  // ── Save item to wishlist ─────────────────────────────────
  const handleSaveForLater = (item) => {
    if (isWishlisted(item.id)) {
      showToast(`"${item.name}" is already in your wishlist.`);
      return;
    }

    runAction(() => addToWishlist(item.id), `❤️ "${item.name}" saved to wishlist!`);
  };

  // ── Clear entire cart ─────────────────────────────────────
  const handleClearCart = () => {
    runAction(() => clearCart(), '🗑️ Cart cleared.');
  };

  // ── Totals are calculated by the server ───────────────────
  const {
    subtotal,
    discount,
    deliveryCharge,
    total,
    totalItems,
  } = cartTotals;

  return (
    <div className="cart-page">

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Page Header ── */}
      <div className="cart-header">
        <div className="cart-header-inner">
          <div>
            <span className="cart-header-title">My Cart</span>
            <span className="cart-header-count">
              ({totalItems} {totalItems === 1 ? 'item' : 'items'})
            </span>
          </div>
          {cart.length > 0 && (
            <button
              style={{
                background: 'none',
                border: 'none',
                color: '#e53935',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
              onClick={handleClearCart}
              disabled={busy}
            >
              Clear Cart
            </button>
          )}
        </div>
      </div>

      {shopLoading && cart.length === 0 ? (

        /* ── Loading State ── */
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 40px' }}>
          <div className="cart-empty">
            <div className="cart-empty-icon">⏳</div>
            <h3>Loading your cart...</h3>
          </div>
        </div>

      ) : cart.length === 0 ? (

        /* ── Empty Cart State ── */
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 40px' }}>
          <div className="cart-empty">
            <div className="cart-empty-icon">🛒</div>
            <h3>Your cart is empty!</h3>
            <p>
              Looks like you haven't added anything yet.
              Start shopping to fill it up.
            </p>
            <button
              className="cart-empty-btn"
              onClick={() => navigate('/home')}
            >
              Continue Shopping
            </button>
          </div>
        </div>

      ) : (

        /* ── Cart Layout ── */
        <div className="cart-layout">

          {/* ── Items Panel ── */}
          <div className="cart-items-panel">
            {cart.map((item) => (
              <div key={item.id} className="cart-item-row">

                {/* Product Image */}
                <div
                  className="cart-item-image-wrap"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/product/${item.id}`)}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="cart-item-image"
                    onError={(e) => {
                      e.target.src =
                        'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80';
                    }}
                  />
                </div>

                {/* Product Details */}
                <div className="cart-item-details">
                  <div className="cart-item-category">{item.category}</div>
                  <div
                    className="cart-item-name"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/product/${item.id}`)}
                  >
                    {item.name}
                  </div>
                  <div className="cart-item-rating">
                    {item.rating} ★
                  </div>

                  {/* Quantity Controls + Actions */}
                  <div className="cart-qty-row">
                    <div className="cart-qty-controls">
                      <button
                        className="cart-qty-btn"
                        onClick={() => handleDecrease(item)}
                        disabled={busy || item.quantity <= 1}
                      >
                        −
                      </button>
                      <span className="cart-qty-value">
                        {item.quantity}
                      </span>
                      <button
                        className="cart-qty-btn"
                        onClick={() => handleIncrease(item)}
                        disabled={
                          busy ||
                          (item.stock !== undefined && item.quantity >= item.stock)
                        }
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="cart-remove-btn"
                      onClick={() => handleRemove(item.id, item.name)}
                      disabled={busy}
                    >
                      🗑️ Remove
                    </button>

                    <button
                      className="cart-save-btn"
                      onClick={() => handleSaveForLater(item)}
                      disabled={busy}
                    >
                      ❤️ Wishlist
                    </button>
                  </div>
                </div>

                {/* Item Price */}
                <div className="cart-item-price-col">
                  <div className="cart-item-price">
                    {formatPrice(item.price * item.quantity)}
                  </div>
                  {item.originalPrice && (
                    <div className="cart-item-original">
                      {formatPrice(item.originalPrice * item.quantity)}
                    </div>
                  )}
                  {item.discount > 0 && (
                    <div className="cart-item-saving">
                      {item.discount}% off
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

          {/* ── Summary Panel ── */}
          <div className="cart-summary-panel">
            <div className="cart-summary-header">Price Details</div>
            <div className="cart-summary-body">

              <div className="cart-summary-row">
                <span className="cart-summary-row-label">
                  Price ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                </span>
                <span className="cart-summary-row-value">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <div className="cart-summary-row">
                <span className="cart-summary-row-label">Discount</span>
                <span className="cart-summary-row-value discount">
                  − {formatPrice(discount)}
                </span>
              </div>

              <div className="cart-summary-row">
                <span className="cart-summary-row-label">
                  Delivery Charges
                </span>
                <span className="cart-summary-row-value">
                  {deliveryCharge === 0 ? (
                    <span style={{ color: '#388e3c', fontWeight: 700 }}>
                      FREE
                    </span>
                  ) : (
                    formatPrice(deliveryCharge)
                  )}
                </span>
              </div>

              <div className="cart-summary-divider" />

              <div className="cart-summary-total-row">
                <span className="cart-summary-total-label">
                  Total Amount
                </span>
                <span className="cart-summary-total-value">
                  {formatPrice(total)}
                </span>
              </div>

              {discount > 0 && (
                <div className="cart-summary-savings-note">
                  🎉 You save {formatPrice(discount)} on this order!
                </div>
              )}

              {/* ── Place Order → navigates to the checkout page ── */}
              <button
                className="cart-checkout-btn"
                onClick={() => navigate('/payment')}
                disabled={busy}
              >
                Proceed to Payment
              </button>

              <button
                className="cart-continue-btn"
                onClick={() => navigate('/home')}
              >
                Continue Shopping
              </button>

              <div className="cart-secure-badge">
                🔒 Safe and Secure Payments
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ── Footer ── */}
      <Footer />

      {/* ── Toast ── */}
      <div className={`toast-notification ${toast.show ? 'show' : ''}`}>
        {toast.message}
      </div>

    </div>
  );
}

export default Cart;