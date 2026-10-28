import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import ProductCard from '../components/ProductCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import AISearch from '../components/AISearch.jsx';
import '../styles/Home.css';
import { applyAllFilters, getPriceRange } from '../utils/filterUtils.js';
import { useStore } from '../context/StoreContext.jsx';

function Home() {
  const location = useLocation();

  // ── Products & categories now come from the API (MongoDB) ─
  const {
    products: allProducts,
    categories,
    catalogLoading,
    catalogError,
    refreshCatalog,
  } = useStore();

  // ── Price range computed from current product list ────────
  const { min: globalMin, max: globalMax } = getPriceRange(allProducts);

  // ── Filter state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortType, setSortType]                 = useState('default');
  const [minPrice, setMinPrice]                 = useState(globalMin);
  const [maxPrice, setMaxPrice]                 = useState(globalMax);
  const [filteredProducts, setFilteredProducts] = useState(allProducts);

  // ── AI Search state ───────────────────────────────────────
  const [aiMode, setAiMode]         = useState(false);
  const [aiProducts, setAiProducts] = useState(null);
  const [aiLabel, setAiLabel]       = useState('');

  // ── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  // ── Handle category from navbar dropdown / location state ─
  useEffect(() => {
    if (location.state?.selectedCategory) {
      setSelectedCategory(location.state.selectedCategory);
      setAiMode(false);
      setAiProducts(null);
      setAiLabel('');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // ── Re-run filters when allProducts changes ───────────────
  useEffect(() => {
    setMinPrice(getPriceRange(allProducts).min);
    setMaxPrice(getPriceRange(allProducts).max);
  }, [allProducts]);

  // ── Apply all filters whenever filter state changes ───────
  useEffect(() => {
    if (aiMode) return;
    const result = applyAllFilters(allProducts, {
      search  : searchQuery,
      category: selectedCategory,
      minPrice,
      maxPrice,
      sort    : sortType,
    });
    setFilteredProducts(result);
  }, [searchQuery, selectedCategory, minPrice, maxPrice, sortType, aiMode, allProducts]);

  // ── AI Search result handler ──────────────────────────────
  const handleAiResults = useCallback((resultProducts, label) => {
    if (resultProducts === null) {
      setAiMode(false);
      setAiProducts(null);
      setAiLabel('');
    } else {
      setAiMode(true);
      setAiProducts(resultProducts);
      setAiLabel(label);
    }
  }, []);

  // ── Reset all filters ─────────────────────────────────────
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSortType('default');
    setMinPrice(globalMin);
    setMaxPrice(globalMax);
    setAiMode(false);
    setAiProducts(null);
    setAiLabel('');
  };

  // ── Decide which products to show ─────────────────────────
  const displayProducts = aiMode && aiProducts !== null
    ? aiProducts
    : filteredProducts;

  // ── Cart / Wishlist toast callbacks ───────────────────────
  const handleCardUpdate = useCallback((productName, type) => {
    if (type === 'cart') {
      showToast(`🛒 "${productName}" added to cart!`);
    } else if (type === 'wishlist') {
      showToast(`❤️ "${productName}" added to wishlist!`);
    } else if (type === 'removed') {
      showToast(`💔 "${productName}" removed from wishlist.`);
    }
  }, [showToast]);

  // ── Server errors from cart / wishlist actions ────────────
  const handleCardError = useCallback((message) => {
    showToast(`⚠️ ${message}`);
  }, [showToast]);

  return (
    <div className="home-page">

      {/* ── Navbar ── */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (aiMode) {
            setAiMode(false);
            setAiProducts(null);
            setAiLabel('');
          }
        }}
      />

      {/* ── Hero Banner ── */}
      <div className="hero-banner">
        <div className="hero-content">
          <span className="hero-badge">Biggest Sale of the Year</span>
          <h1 className="hero-title">
            Shop Smart,<br />
            Save <span>More!</span>
          </h1>
          <p className="hero-subtitle">
            Discover unbeatable deals across {categories.length} categories.
            Over {allProducts.length} products with up to 57% off only on ShopSmart.
          </p>
          <div className="hero-cta-group">
            <button
              className="hero-btn-primary"
              onClick={() => {
                setSelectedCategory('All');
                setAiMode(false);
                setAiProducts(null);
                setAiLabel('');
              }}
            >
              Shop Now
            </button>
            <button
              className="hero-btn-secondary"
              onClick={() => {
                setSelectedCategory('Electronics');
                setAiMode(false);
                setAiProducts(null);
                setAiLabel('');
              }}
            >
              Explore Electronics
            </button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-number">{allProducts.length}+</div>
              <div className="hero-stat-label">Products</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-number">{categories.length}</div>
              <div className="hero-stat-label">Categories</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-number">57%</div>
              <div className="hero-stat-label">Max Off</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-number">Free</div>
              <div className="hero-stat-label">Delivery</div>
            </div>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img
            src="https://plus.unsplash.com/premium_photo-1683887064106-531532ecdf20?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDd8fHxlbnwwfHx8fHw%3D"
            alt="Shopping"
            className="hero-image"
          />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="home-section">

        {/* ── Categories Section ── */}
        <div className="section-header">
          <h2 className="section-title">Shop by Category</h2>
          <span
            className="section-view-all"
            onClick={() => {
              setSelectedCategory('All');
              setAiMode(false);
              setAiProducts(null);
              setAiLabel('');
            }}
          >
            View All →
          </span>
        </div>

        <div className="categories-grid">
          {/* All category card */}
          <div
            className={`category-card ${selectedCategory === 'All' && !aiMode ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('All');
              setAiMode(false);
              setAiProducts(null);
              setAiLabel('');
            }}
          >
            <span className="category-icon">🛍️</span>
            <span className="category-name">All</span>
          </div>

          {/* Dynamic categories from the API */}
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`category-card ${selectedCategory === cat.name && !aiMode ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(cat.name);
                setAiMode(false);
                setAiProducts(null);
                setAiLabel('');
              }}
            >
              <span className="category-icon">{cat.icon}</span>
              <span className="category-name">{cat.name}</span>
            </div>
          ))}
        </div>

        {/* ── AI Search Section ── */}
        <div className="section-header" style={{ marginTop: '8px' }}>
          <h2 className="section-title">✨ AI Smart Search</h2>
        </div>

        <AISearch
          products={allProducts}
          onResults={handleAiResults}
        />

        {/* ── Filter Bar ── */}
        <div className="section-header">
          <h2 className="section-title">
            {aiMode
              ? `AI: ${aiLabel}`
              : selectedCategory === 'All'
                ? 'All Products'
                : selectedCategory}
          </h2>
          <span className="filter-results-count">
            {displayProducts.length} product{displayProducts.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Normal filters — hidden in AI mode */}
        {!aiMode && (
          <div className="filter-bar">
            <span className="filter-bar-label">Filters:</span>

            <SearchBar
              value={searchQuery}
              onChange={(q) => setSearchQuery(q)}
              placeholder="Search products, brands, categories..."
            />

            <select
              className="filter-select"
              value={sortType}
              onChange={(e) => setSortType(e.target.value)}
            >
              <option value="default">Sort: Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Top Rated</option>
              <option value="discount_desc">Best Discount</option>
              <option value="name_asc">Name: A to Z</option>
            </select>

            <div className="filter-price-group">
              <span className="filter-price-label">Price:</span>
              <input
                type="number"
                className="filter-price-input"
                placeholder="Min ₹"
                value={minPrice}
                min={globalMin}
                max={globalMax}
                onChange={(e) => setMinPrice(Number(e.target.value) || globalMin)}
              />
              <span className="filter-price-label">—</span>
              <input
                type="number"
                className="filter-price-input"
                placeholder="Max ₹"
                value={maxPrice}
                min={globalMin}
                max={globalMax}
                onChange={(e) => setMaxPrice(Number(e.target.value) || globalMax)}
              />
            </div>

            <button className="filter-clear-btn" onClick={handleClearFilters}>
              ✕ Clear Filters
            </button>
          </div>
        )}

        {/* Clear button in AI mode */}
        {aiMode && (
          <div style={{ marginBottom: '8px' }}>
            <button className="filter-clear-btn" onClick={handleClearFilters}>
              ✕ Clear AI Search
            </button>
          </div>
        )}

        {/* ── Products Grid ── */}
        <div className="products-grid">
          {catalogLoading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <h3>Loading products...</h3>
              <p>Please wait a moment.</p>
            </div>
          ) : catalogError ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <h3>Could not load products</h3>
              <p>{catalogError}</p>
              <button className="empty-state-btn" onClick={refreshCatalog}>
                Try Again
              </button>
            </div>
          ) : displayProducts.length > 0 ? (
            displayProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onCartUpdate={handleCardUpdate}
                onWishlistUpdate={handleCardUpdate}
                onError={handleCardError}
              />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No products found</h3>
              <p>Try adjusting your search or filters.</p>
              <button className="empty-state-btn" onClick={handleClearFilters}>
                Clear Filters
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Footer ── */}
      <Footer />

      {/* ── Toast ── */}
      <div className={`toast-notification ${toast.show ? 'show' : ''}`}>
        {toast.message}
      </div>

    </div>
  );
}

export default Home;