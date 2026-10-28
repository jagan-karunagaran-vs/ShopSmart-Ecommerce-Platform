import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import '../styles/Payment.css';
import { formatPrice } from '../utils/helpers.js';
import { orderApi, paymentApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';

// ─────────────────────────────────────────────────────────────
// Checkout page
//   1. Customer enters a delivery address
//   2. Server creates the order from the SERVER-SIDE cart
//      (prices, totals and stock are all checked there)
//   3. Razorpay hosted checkout collects the payment — card / UPI
//      details never touch our app or server
//   4. The server verifies the payment before the order is marked paid
// ─────────────────────────────────────────────────────────────

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PHONE_REGEX = /^\+?[0-9][0-9\s-]{8,14}$/;
const PIN_REGEX = /^[1-9][0-9]{5}$/;

const validateAddress = (a) => {
  const errors = {};

  if (a.fullName.trim().length < 2) errors.fullName = 'Full name is required.';
  if (!PHONE_REGEX.test(a.phone.trim())) errors.phone = 'Enter a valid phone number.';
  if (a.line1.trim().length < 3) errors.line1 = 'Address line 1 is required.';
  if (a.city.trim().length < 2) errors.city = 'City is required.';
  if (a.state.trim().length < 2) errors.state = 'State is required.';
  if (!PIN_REGEX.test(a.postalCode.trim())) errors.postalCode = 'Enter a valid 6-digit PIN code.';

  return errors;
};

function Payment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartItems, cartTotals, refreshShop } = useStore();

  // ── Page state ────────────────────────────────────────────
  // stage: 'form' | 'processing' | 'success' | 'unconfirmed'
  const [stage, setStage]           = useState('form');
  const [stageMessage, setStageMessage] = useState('');
  const [ready, setReady]           = useState(false);
  const [error, setError]           = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);

  const [address, setAddress] = useState({
    fullName   : user?.name || '',
    phone      : '',
    line1      : '',
    line2      : '',
    city       : '',
    state      : '',
    postalCode : '',
  });
  const [errors, setErrors] = useState({});

  // Set once the Razorpay success handler fires, so closing the modal
  // afterwards is never treated as a cancellation.
  const paymentStartedRef = useRef(false);
  const lastFailureRef    = useRef('');

  // ── Load the latest cart when the page opens ──────────────
  useEffect(() => {
    let cancelled = false;

    refreshShop().finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshShop]);

  // ── Empty cart → back to the cart page ────────────────────
  useEffect(() => {
    if (ready && stage === 'form' && !placedOrder && cartItems.length === 0) {
      navigate('/cart');
    }
  }, [ready, stage, placedOrder, cartItems.length, navigate]);

  // ── What the summary panel shows ──────────────────────────
  const paidOrder = stage === 'success' && placedOrder ? placedOrder : null;

  const summaryItems = paidOrder
    ? paidOrder.items.map((i) => ({
        key: i.product,
        image: i.image,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      }))
    : cartItems.map((i) => ({
        key: i.id,
        image: i.image,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      }));

  const totals = paidOrder ? paidOrder.totals : cartTotals;
  const { subtotal, discount, deliveryCharge, total, totalItems } = totals;

  // ── Address input handling ────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;

    if (name === 'postalCode') formatted = value.replace(/\D/g, '').slice(0, 6);
    if (name === 'phone') formatted = value.replace(/[^\d+\s-]/g, '').slice(0, 15);

    setAddress((prev) => ({ ...prev, [name]: formatted }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // ── Release the reserved stock when payment is abandoned ──
  const cancelPendingOrder = async (order, reason) => {
    try {
      await orderApi.cancel(order.id, reason);
    } catch {
      // The order may already be paid / expired — nothing more to do.
    }
  };

  // ── Shared status check for delayed payment confirmation ──
  const checkPaymentStatus = async (order, attempts = 10) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0 || attempts > 1) {
        setStageMessage(`Waiting for payment confirmation... (${attempt + 1}/${attempts})`);
        await sleep(3000);
      }

      try {
        const res = await paymentApi.status(order.id);
        if (res.data.paymentStatus === 'paid') {
          const confirmedOrder = res.data.order || order;
          setPlacedOrder(confirmedOrder);
          setStage('success');
          await refreshShop();
          return true;
        }
      } catch (err) {
        console.error('Payment status check failed:', err?.message || err);
      }
    }
    return false;
  };

  // ── Payment confirmed by Razorpay → verify on the server ──
  const verifyOnServer = async (order, response) => {
    setStage('processing');
    setStageMessage('Verifying your payment...');

    try {
      const res = await paymentApi.verify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });

      setPlacedOrder(res.data.order);
      setStage('success');
      await refreshShop();
      return;
    } catch (err) {
      // Verification may be delayed by a webhook or a temporary network issue.
      console.error('Payment verification pending:', err?.message || err);
    }

    const confirmed = await checkPaymentStatus(order, 10);
    if (!confirmed) {
      setPlacedOrder(order);
      setStage('unconfirmed');
      setStageMessage('Payment confirmation is still pending. Do not pay again.');
    }
  };

  // ── Let the customer retry checking the same order ──
  const retryPaymentStatus = async () => {
    if (!placedOrder?.id) return;

    setStage('processing');
    setStageMessage('Checking the latest payment status...');
    const confirmed = await checkPaymentStatus(placedOrder, 10);

    if (!confirmed) {
      setStage('unconfirmed');
      setStageMessage('Payment confirmation is still pending. Please check again later.');
    }
  };

  // ── Open Razorpay hosted checkout ─────────────────────────
  const openCheckout = (order, checkout) => {
    paymentStartedRef.current = false;
    lastFailureRef.current = '';

    const rzp = new window.Razorpay({
      key: checkout.keyId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      order_id: checkout.razorpayOrderId,
      prefill: {
        name: address.fullName.trim(),
        email: checkout.prefill?.email || user?.email || '',
        contact: address.phone.trim(),
      },
      theme: { color: '#2874f0' },

      handler: (response) => {
        paymentStartedRef.current = true;
        verifyOnServer(order, response);
      },

      modal: {
        confirm_close: true,
        ondismiss: async () => {
          if (paymentStartedRef.current) return;

          await cancelPendingOrder(order, 'Payment cancelled by customer.');
          setStage('form');
          setError(
            lastFailureRef.current ||
              'Payment was cancelled. You have not been charged. You can try again.'
          );
        },
      },
    });

    rzp.on('payment.failed', (resp) => {
      lastFailureRef.current =
        resp?.error?.description || 'Payment failed. Please try again.';
    });

    setStageMessage('Complete the payment in the Razorpay window...');
    rzp.open();
  };

  // ── Pay button ────────────────────────────────────────────
  const handlePay = async (e) => {
    e.preventDefault();
    setError('');

    const validationErrors = validateAddress(address);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setStage('processing');
    setStageMessage('Preparing your secure checkout...');

    let order = null;

    try {
      const sdkLoaded = await loadRazorpayScript();

      if (!sdkLoaded) {
        throw new Error(
          'Could not load the payment gateway. Please check your connection and try again.'
        );
      }

      const orderRes = await orderApi.create({
        fullName   : address.fullName.trim(),
        phone      : address.phone.trim(),
        line1      : address.line1.trim(),
        line2      : address.line2.trim(),
        city       : address.city.trim(),
        state      : address.state.trim(),
        postalCode : address.postalCode.trim(),
        country    : 'India',
      });

      order = orderRes.data.order;

      const paymentRes = await paymentApi.createOrder(order.id);
      openCheckout(order, paymentRes.data.checkout);
    } catch (err) {
      if (order) {
        await cancelPendingOrder(order, 'Could not start payment.');
      }

      setStage('form');
      setError(err.message || 'Something went wrong. Please try again.');
    }
  };

  // ── Field helper (keeps the JSX below compact) ────────────
  const renderField = (name, label, props = {}, required = true) => (
    <div className="payment-form-group">
      <label className="payment-form-label">
        {label} {required && <span>*</span>}
      </label>
      <input
        type="text"
        name={name}
        className={`payment-form-input ${errors[name] ? 'error' : ''}`}
        value={address[name]}
        onChange={handleChange}
        {...props}
      />
      {errors[name] && (
        <div className="payment-field-error">
          ⚠️ {errors[name]}
        </div>
      )}
    </div>
  );

  return (
    <div className="payment-page">

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Page Header ── */}
      <div className="payment-header">
        <div className="payment-header-inner">
          <button
            className="payment-header-back"
            onClick={() => navigate('/cart')}
            disabled={stage === 'processing'}
          >
            ← Back
          </button>
          <span className="payment-header-title">
            💳 Secure Checkout
          </span>
          <span className="payment-header-secure">
            🔒 100% Secure Payment
          </span>
        </div>
      </div>

      {/* ── Payment Layout ── */}
      <div className="payment-layout">

        {/* ── Left — Checkout Card ── */}
        <div className="payment-form-card">

          {/* Success State */}
          {stage === 'success' && placedOrder && (
            <div className="payment-success">
              <div className="payment-success-icon">✅</div>
              <h3>Payment Successful!</h3>
              <p>
                Thank you for shopping with ShopSmart.<br />
                Your order has been placed successfully.
              </p>
              <p>
                We'll deliver it to {placedOrder.shippingAddress.city},{' '}
                {placedOrder.shippingAddress.state} - {placedOrder.shippingAddress.postalCode}.
              </p>
              <div className="payment-success-id">
                Order ID: {placedOrder.orderNumber}
              </div>
              <button
                className="payment-home-btn"
                onClick={() => navigate('/home')}
              >
                🛍️ Continue Shopping
              </button>
              <button
                className="payment-home-btn"
                style={{
                  background: 'transparent',
                  color: '#2874f0',
                  border: '1.5px solid #2874f0',
                  marginTop: '10px',
                }}
                onClick={() => navigate('/orders')}
              >
                📦 View My Orders
              </button>
            </div>
          )}

          {/* Payment could not be confirmed yet */}
          {stage === 'unconfirmed' && placedOrder && (
            <div className="payment-processing">
              <div className="payment-success-icon">⏳</div>
              <h3>We're confirming your payment</h3>
              <p>
                If money was deducted, your order will be confirmed
                automatically within a few minutes. Please do not pay again.
              </p>
              <div className="payment-success-id" style={{ marginTop: '14px' }}>
                Order ID: {placedOrder.orderNumber}
              </div>
              <button
                className="payment-home-btn"
                onClick={retryPaymentStatus}
              >
                Check Payment Status Again
              </button>
              <button
                className="payment-home-btn"
                style={{
                  background: 'transparent',
                  color: '#2874f0',
                  border: '1.5px solid #2874f0',
                  marginTop: '10px',
                }}
                onClick={() => navigate('/orders')}
              >
                📦 View My Orders
              </button>
            </div>
          )}

          {/* Processing State */}
          {stage === 'processing' && (
            <div className="payment-processing">
              <div className="payment-spinner"></div>
              <h3>Processing Payment...</h3>
              <p>Please do not close or refresh this page.</p>
              <p style={{ marginTop: '6px', fontSize: '0.78rem', color: '#bdbdbd' }}>
                {stageMessage}
              </p>
            </div>
          )}

          {/* Address Form */}
          {stage === 'form' && (
            <>
              <h2>📦 Delivery Address</h2>
              <p className="payment-form-subtitle">
                Enter where we should deliver your order. You'll pay securely
                through Razorpay — your card, UPI or net banking details are
                never stored by ShopSmart.
              </p>

              <div className="payment-card-types">
                <span className="payment-card-type-badge">UPI</span>
                <span className="payment-card-type-badge">Cards</span>
                <span className="payment-card-type-badge">Net Banking</span>
                <span className="payment-card-type-badge">Wallets</span>
              </div>

              {error && (
                <div
                  className="alert alert-danger py-2 mb-3"
                  style={{ fontSize: '0.85rem', borderRadius: '8px' }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handlePay} noValidate>

                <div className="payment-form-row">
                  {renderField('fullName', 'Full Name', {
                    placeholder: 'Name of the receiver',
                    autoComplete: 'name',
                  })}
                  {renderField('phone', 'Phone Number', {
                    placeholder: '10-digit mobile number',
                    autoComplete: 'tel',
                    inputMode: 'tel',
                  })}
                </div>

                {renderField('line1', 'Address Line 1', {
                  placeholder: 'House no., building, street',
                  autoComplete: 'address-line1',
                })}

                {renderField(
                  'line2',
                  'Address Line 2',
                  {
                    placeholder: 'Area, landmark (optional)',
                    autoComplete: 'address-line2',
                  },
                  false
                )}

                <div className="payment-form-row">
                  {renderField('city', 'City', {
                    placeholder: 'City',
                    autoComplete: 'address-level2',
                  })}
                  {renderField('state', 'State', {
                    placeholder: 'State',
                    autoComplete: 'address-level1',
                  })}
                </div>

                {renderField('postalCode', 'PIN Code', {
                  placeholder: '6-digit PIN code',
                  autoComplete: 'postal-code',
                  inputMode: 'numeric',
                  maxLength: 6,
                })}

                <button
                  type="submit"
                  className="payment-submit-btn"
                  disabled={!ready || cartItems.length === 0}
                >
                  🔒 Pay {formatPrice(total)}
                </button>

              </form>
            </>
          )}
        </div>

        {/* ── Right — Order Summary Panel ── */}
        <div className="payment-summary-panel">
          <div className="payment-summary-header">
            Order Summary
          </div>

          <div className="payment-summary-body">

            {/* Items List */}
            <div className="payment-summary-items">
              {summaryItems.map((item) => (
                <div key={item.key} className="payment-summary-item">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="payment-summary-item-img"
                    onError={(e) => {
                      e.target.src =
                        'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80';
                    }}
                  />
                  <div className="payment-summary-item-info">
                    <div className="payment-summary-item-name">
                      {item.name}
                    </div>
                    <div className="payment-summary-item-qty">
                      Qty: {item.quantity}
                    </div>
                  </div>
                  <div className="payment-summary-item-price">
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="payment-summary-row">
              <span className="payment-summary-row-label">
                Price ({totalItems} {totalItems === 1 ? 'item' : 'items'})
              </span>
              <span className="payment-summary-row-value">
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="payment-summary-row">
              <span className="payment-summary-row-label">Discount</span>
              <span className="payment-summary-row-value discount">
                − {formatPrice(discount)}
              </span>
            </div>

            <div className="payment-summary-row">
              <span className="payment-summary-row-label">
                Delivery Charges
              </span>
              <span className="payment-summary-row-value">
                {deliveryCharge === 0 ? (
                  <span style={{ color: '#388e3c', fontWeight: 700 }}>
                    FREE
                  </span>
                ) : (
                  formatPrice(deliveryCharge)
                )}
              </span>
            </div>

            <div className="payment-summary-divider" />

            {/* Total */}
            <div className="payment-summary-total-row">
              <span className="payment-summary-total-label">
                Total Amount
              </span>
              <span className="payment-summary-total-value">
                {formatPrice(total)}
              </span>
            </div>

            {/* Savings Note */}
            {discount > 0 && (
              <div className="payment-summary-saving">
                🎉 You save {formatPrice(discount)} on this order!
              </div>
            )}

            {/* Secure Note */}
            <div className="payment-secure-note">
              🔒 Safe and Secure Payments
            </div>

          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <Footer />

    </div>
  );
}

export default Payment;