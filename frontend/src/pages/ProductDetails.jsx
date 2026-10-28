import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import '../styles/ProductDetails.css';
import { formatPrice, formatReviewCount } from '../utils/helpers.js';
import { productApi } from '../services/api.js';
import { useStore } from '../context/StoreContext.jsx';

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    products: allProducts,
    isInCart,
    isWishlisted,
    addToCart,
    addToWishlist,
    removeFromWishlist,
  } = useStore();

  const [product, setProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  // ── Load product from the API (MongoDB id from the URL) ───
  useEffect(() => {
    let cancelled = false;

    setProduct(null);

    productApi
      .getById(id)
      .then((res) => {
        if (cancelled) return;
        setProduct(res.data.product);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(() => {
        // Not found / invalid id → back to the storefront
        if (!cancelled) navigate('/home', { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const inCart = product ? isInCart(product.id) : false;
  const wishlisted = product ? isWishlisted(product.id) : false;
  const outOfStock = product ? product.stock !== undefined && product.stock <= 0 : false;

  // ── Add to Cart ───────────────────────────────────────────
  const handleAddToCart = async () => {
    if (busy || outOfStock) return;

    setBusy(true);
    try {
      const wasInCart = isInCart(product.id);
      await addToCart(product.id, 1);

      showToast(
        wasInCart
          ? `🛒 Quantity updated in cart!`
          : `🛒 "${product.name}" added to cart!`
      );
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Toggle Wishlist ───────────────────────────────────────
  const handleWishlist = async () => {
    if (busy) return;

    setBusy(true);
    try {
      if (isWishlisted(product.id)) {
        await removeFromWishlist(product.id);
        showToast(`💔 Removed from wishlist.`);
      } else {
        await addToWishlist(product.id);
        showToast(`❤️ "${product.name}" added to wishlist!`);
      }
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Related products ──────────────────────────────────────
  const relatedProducts = product
    ? allProducts
        .filter((p) => p.category === product.category && p.id !== product.id)
        .slice(0, 4)
    : [];

  // ── Specs generator ───────────────────────────────────────
  const getSpecs = (p) => {
    const base = [
      { key: 'Brand',    val: p.name.split(' ')[0] },
      { key: 'Category', val: p.category },
      { key: 'Rating',   val: `${p.rating} ★ (${formatReviewCount(p.reviews)} reviews)` },
      { key: 'Discount', val: `${p.discount}% off` },
      {
        key: 'In Stock',
        val:
          p.stock !== undefined && p.stock <= 0
            ? 'Currently out of stock'
            : 'Yes — Usually ships in 1-2 days',
      },
      { key: 'Warranty', val: '1 Year Manufacturer Warranty' },
      { key: 'Sold By',  val: 'ShopSmart Direct' },
      { key: 'Country',  val: 'India' },
    ];
    return base;
  };

  if (!product) return null;

  return (
    <div className="product-details-page">

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Breadcrumb ── */}
      <div className="pd-breadcrumb">
        <div className="pd-breadcrumb-inner">
          <span className="pd-breadcrumb-item" onClick={() => navigate('/home')}>
            Home
          </span>
          <span className="pd-breadcrumb-sep">›</span>
          <span
            className="pd-breadcrumb-item"
            onClick={() =>
              navigate('/home', { state: { selectedCategory: product.category } })
            }
          >
            {product.category}
          </span>
          <span className="pd-breadcrumb-sep">›</span>
          <span className="pd-breadcrumb-current">{product.name}</span>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="pd-layout">

        {/* ── Image Panel ── */}
        <div className="pd-image-panel">
          <div className="pd-main-image-wrap">
            {product.discount > 0 && (
              <span className="pd-discount-badge">{product.discount}% off</span>
            )}
            <img
              src={product.image}
              alt={product.name}
              className="pd-main-image"
              onError={(e) => {
                e.target.src =
                  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80';
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="pd-image-actions">
            <button
              className={`pd-action-btn cart ${inCart ? 'added' : ''}`}
              onClick={handleAddToCart}
              disabled={busy || outOfStock}
            >
              {outOfStock
                ? 'Out of Stock'
                : inCart
                  ? '✓ Added to Cart'
                  : '🛒 Add to Cart'}
            </button>
            <button
              className={`pd-action-btn wishlist ${wishlisted ? 'wishlisted' : ''}`}
              onClick={handleWishlist}
              disabled={busy}
            >
              {wishlisted ? '❤️ Wishlisted' : '🤍 Wishlist'}
            </button>
          </div>
        </div>

        {/* ── Info Panel ── */}
        <div className="pd-info-panel">

          {/* ── Main Info Card ── */}
          <div className="pd-info-card">
            <div className="pd-category-tag">{product.category}</div>
            <h1 className="pd-product-name">{product.name}</h1>

            {/* Rating */}
            <div className="pd-rating-block">
              <span className="pd-rating-badge">
                {product.rating} ★
              </span>
              <span className="pd-rating-sep">|</span>
              <span className="pd-rating-count">
                {formatReviewCount(product.reviews)} Ratings
              </span>
              <span className="pd-rating-sep">|</span>
              <span className="pd-rating-label">ShopSmart Verified</span>
            </div>

            {/* Price */}
            <div className="pd-price-block">
              <span className="pd-price">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="pd-original-price">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
              {product.discount > 0 && (
                <span className="pd-discount-text">{product.discount}% off</span>
              )}
            </div>
            <div className="pd-tax-note">Inclusive of all taxes. Free delivery available.</div>

            {/* Offers */}
            <div className="pd-offers-block">
              <div className="pd-offers-title">🏷️ Available Offers</div>
              <div className="pd-offer-item">
                <span className="pd-offer-tag">Bank</span>
                10% off on SBI Credit Cards, up to ₹1,500. T&C apply.
              </div>
              <div className="pd-offer-item">
                <span className="pd-offer-tag">EMI</span>
                No Cost EMI starting from ₹{Math.round(product.price / 6).toLocaleString('en-IN')}/month.
              </div>
              <div className="pd-offer-item">
                <span className="pd-offer-tag">Special</span>
                Buy 2 get 5% extra off. Use code: <strong>SMART5</strong>
              </div>
            </div>
          </div>

          {/* ── Delivery Card ── */}
          <div className="pd-delivery-card">
            <div className="pd-card-title">🚚 Delivery & Services</div>
            <div className="pd-delivery-row">
              <span className="pd-delivery-icon">📦</span>
              <div className="pd-delivery-info">
                <strong>Free Delivery</strong>
                <span>On orders above ₹499. Estimated delivery in 2-4 business days.</span>
              </div>
            </div>
            <div className="pd-delivery-row">
              <span className="pd-delivery-icon">🔄</span>
              <div className="pd-delivery-info">
                <strong>30-Day Easy Returns</strong>
                <span>Hassle-free returns and exchanges within 30 days of delivery.</span>
              </div>
            </div>
            <div className="pd-delivery-row">
              <span className="pd-delivery-icon">🔒</span>
              <div className="pd-delivery-info">
                <strong>Secure Payments</strong>
                <span>All transactions are 100% safe and encrypted.</span>
              </div>
            </div>
            <div className="pd-delivery-row">
              <span className="pd-delivery-icon">🏭</span>
              <div className="pd-delivery-info">
                <strong>Warranty</strong>
                <span>1 Year manufacturer warranty included on this product.</span>
              </div>
            </div>
          </div>

          {/* ── Specs Card ── */}
          <div className="pd-specs-card">
            <div className="pd-card-title">📋 Specifications</div>
            <table className="pd-spec-table">
              <tbody>
                {getSpecs(product).map((spec, i) => (
                  <tr key={i}>
                    <td className="pd-spec-key">{spec.key}</td>
                    <td className="pd-spec-val">{spec.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Description Card ── */}
          <div className="pd-desc-card">
            <div className="pd-card-title">📝 Product Description</div>
            <p className="pd-description">{product.description}</p>
          </div>

          {/* ── Related Products ── */}
          {relatedProducts.length > 0 && (
            <div className="pd-specs-card">
              <div className="pd-card-title">🛍️ More from {product.category}</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  marginTop: '4px',
                }}
              >
                {relatedProducts.map((rp) => (
                  <div
                    key={rp.id}
                    onClick={() => navigate(`/product/${rp.id}`)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #f0f0f0',
                      transition: 'box-shadow 0.2s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.boxShadow = 'none')
                    }
                  >
                    <img
                      src={rp.image}
                      alt={rp.name}
                      style={{
                        width: '100%',
                        aspectRatio: '1/1',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        e.target.src =
                          'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80';
                      }}
                    />
                    <div style={{ padding: '8px' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#212121',
                          marginBottom: '4px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {rp.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#212121',
                        }}
                      >
                        {formatPrice(rp.price)}
                      </div>
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: '#388e3c',
                          fontWeight: 600,
                        }}
                      >
                        {rp.discount}% off
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ── */}
      <Footer />

      {/* ── Toast ── */}
      <div className={`pd-toast ${toast.show ? 'show' : ''}`}>
        {toast.message}
      </div>

    </div>
  );
}

export default ProductDetails;