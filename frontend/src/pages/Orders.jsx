import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import '../styles/Orders.css';
import { formatPrice } from '../utils/helpers.js';
import { orderApi } from '../services/api.js';

// ─────────────────────────────────────────────────────────────
// Order history (customer) — data comes from the server.
// ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const ORDER_STATUS_LABELS = {
  pending: 'Awaiting payment',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PAYMENT_STATUS_LABELS = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

const formatDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function Orders() {
  const navigate = useNavigate();

  const [orders, setOrders]         = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId]         = useState(null);
  const [toast, setToast]           = useState({ show: false, message: '' });

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  // ── Load a page of orders ─────────────────────────────────
  const loadOrders = useCallback(async (page, append) => {
    setError('');

    try {
      const res = await orderApi.list({ page, limit: PAGE_SIZE });

      setOrders((prev) =>
        append ? [...prev, ...res.data.orders] : res.data.orders
      );
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.message || 'Could not load your orders.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadOrders(1, false).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadOrders]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadOrders(pagination.page + 1, true);
    setLoadingMore(false);
  };

  // ── Cancel an unpaid order ────────────────────────────────
  const handleCancel = async (order) => {
    if (busyId) return;
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return;

    setBusyId(order.id);

    try {
      const res = await orderApi.cancel(order.id, 'Cancelled by customer.');

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? res.data.order : o))
      );
      showToast('Order cancelled.');
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const canCancel = (order) =>
    order.orderStatus === 'pending' && order.paymentStatus !== 'paid';

  return (
    <div className="orders-page">

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Page Header ── */}
      <div className="orders-header">
        <div className="orders-header-inner">
          <div>
            <span className="orders-header-title">My Orders</span>
            {pagination.total > 0 && (
              <span className="orders-header-count">({pagination.total})</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="orders-content">

        {loading ? (

          <div className="orders-empty">
            <div className="orders-empty-icon">⏳</div>
            <h3>Loading your orders...</h3>
          </div>

        ) : error && orders.length === 0 ? (

          <div className="orders-empty">
            <div className="orders-empty-icon">⚠️</div>
            <h3>Could not load your orders</h3>
            <p>{error}</p>
            <button
              className="orders-empty-btn"
              onClick={() => {
                setLoading(true);
                loadOrders(1, false).finally(() => setLoading(false));
              }}
            >
              Try Again
            </button>
          </div>

        ) : orders.length === 0 ? (

          <div className="orders-empty">
            <div className="orders-empty-icon">📦</div>
            <h3>No orders yet!</h3>
            <p>
              When you place an order, you'll be able to track it here.
            </p>
            <button
              className="orders-empty-btn"
              onClick={() => navigate('/home')}
            >
              Start Shopping
            </button>
          </div>

        ) : (

          <>
            <div className="orders-note">
              Unpaid orders are cancelled automatically after 30 minutes.
            </div>

            <div className="orders-list">
              {orders.map((order) => {
                const expanded = expandedId === order.id;
                const address = order.shippingAddress;

                return (
                  <div key={order.id} className="orders-card">

                    {/* ── Card Head ── */}
                    <div className="orders-card-head">
                      <div>
                        <div className="orders-card-label">Order ID</div>
                        <div className="orders-card-value">{order.orderNumber}</div>
                      </div>
                      <div>
                        <div className="orders-card-label">Placed on</div>
                        <div className="orders-card-value">{formatDate(order.createdAt)}</div>
                      </div>
                      <div>
                        <div className="orders-card-label">Total</div>
                        <div className="orders-card-value">{formatPrice(order.totals.total)}</div>
                      </div>
                      <div className="orders-badges">
                        <span className={`orders-badge orders-badge--${order.orderStatus}`}>
                          {ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}
                        </span>
                        <span className={`orders-badge orders-badge--pay-${order.paymentStatus}`}>
                          {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                        </span>
                      </div>
                    </div>

                    {/* ── Items ── */}
                    <div className="orders-items">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.product}`} className="orders-item">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="orders-item-img"
                            onClick={() => navigate(`/product/${item.product}`)}
                            onError={(e) => {
                              e.target.src =
                                'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80';
                            }}
                          />
                          <div className="orders-item-info">
                            <div className="orders-item-name">{item.name}</div>
                            <div className="orders-item-qty">Qty: {item.quantity}</div>
                          </div>
                          <div className="orders-item-price">
                            {formatPrice(item.price * item.quantity)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── Actions ── */}
                    <div className="orders-actions">
                      <button
                        className="orders-btn orders-btn--ghost"
                        onClick={() => setExpandedId(expanded ? null : order.id)}
                      >
                        {expanded ? 'Hide details ▲' : 'View details ▼'}
                      </button>

                      {canCancel(order) && (
                        <button
                          className="orders-btn orders-btn--danger"
                          onClick={() => handleCancel(order)}
                          disabled={busyId === order.id}
                        >
                          {busyId === order.id ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}
                    </div>

                    {/* ── Details ── */}
                    {expanded && (
                      <div className="orders-details">
                        <div className="orders-details-grid">

                          <div>
                            <div className="orders-details-title">Delivery Address</div>
                            <div>{address.fullName}</div>
                            <div>{address.line1}</div>
                            {address.line2 && <div>{address.line2}</div>}
                            <div>
                              {address.city}, {address.state} - {address.postalCode}
                            </div>
                            <div>{address.country}</div>
                            <div>Phone: {address.phone}</div>
                          </div>

                          <div>
                            <div className="orders-details-title">Price Details</div>
                            <div className="orders-price-row">
                              <span>Price ({order.totals.totalItems} items)</span>
                              <span>{formatPrice(order.totals.subtotal)}</span>
                            </div>
                            <div className="orders-price-row">
                              <span>Discount</span>
                              <span className="orders-price-discount">
                                − {formatPrice(order.totals.discount)}
                              </span>
                            </div>
                            <div className="orders-price-row">
                              <span>Delivery</span>
                              <span>
                                {order.totals.deliveryCharge === 0
                                  ? 'FREE'
                                  : formatPrice(order.totals.deliveryCharge)}
                              </span>
                            </div>
                            <div className="orders-price-row orders-price-total">
                              <span>Total</span>
                              <span>{formatPrice(order.totals.total)}</span>
                            </div>
                          </div>

                          <div>
                            <div className="orders-details-title">Order Timeline</div>
                            <div className="orders-timeline">
                              {[...order.statusHistory].reverse().map((entry, idx) => (
                                <div key={idx} className="orders-timeline-item">
                                  <div className="orders-timeline-status">
                                    {ORDER_STATUS_LABELS[entry.status] || entry.status}
                                  </div>
                                  {entry.note && (
                                    <div className="orders-timeline-note">{entry.note}</div>
                                  )}
                                  <div className="orders-timeline-date">
                                    {formatDate(entry.changedAt)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {error && <div className="orders-error">{error}</div>}

            {pagination.page < pagination.pages && (
              <div className="orders-load-more">
                <button
                  className="orders-btn orders-btn--ghost"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more orders'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <Footer />

      {/* ── Toast ── */}
      <div className={`orders-toast ${toast.show ? 'show' : ''}`}>
        {toast.message}
      </div>

    </div>
  );
}

export default Orders;