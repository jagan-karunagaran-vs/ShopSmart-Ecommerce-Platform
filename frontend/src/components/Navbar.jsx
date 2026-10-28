import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';

function Navbar({ searchQuery, onSearchChange }) {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Server-backed state (no localStorage) ─────────────────
  const { user, logout } = useAuth();
  const { categories, cartCount, wishlistCount } = useStore();

  const userName = user?.name || '';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  const dropdownRef = useRef(null);

  // ── Close dropdown on outside click ──────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Search handlers ───────────────────────────────────────
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearchChange) onSearchChange(localSearch);
    if (location.pathname !== '/home') navigate('/home');
  };

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') handleSearchSubmit(e);
    if (onSearchChange) onSearchChange(e.target.value);
  };

  // ── Category click ────────────────────────────────────────
  const handleCategoryClick = (categoryName) => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/home', { state: { selectedCategory: categoryName } });
  };

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <nav className="shopsmart-navbar">

        {/* ── Logo ── */}
        <div className="navbar-logo" onClick={() => navigate('/home')}>
          <span className="navbar-logo-name">ShopSmart</span>
          <span className="navbar-logo-tagline">India ka Smart Bazaar</span>
        </div>

        {/* ── Categories Dropdown ── */}
        <div className="navbar-categories" ref={dropdownRef}>
          <button
            className="navbar-categories-btn"
            onClick={() => setDropdownOpen((p) => !p)}
          >
            Categories
            <span className={`navbar-categories-arrow ${dropdownOpen ? 'open' : ''}`}>▼</span>
          </button>

          {dropdownOpen && (
            <div className="navbar-dropdown">
              <div
                className="navbar-dropdown-item"
                onClick={() => handleCategoryClick('All')}
              >
                <span className="navbar-dropdown-icon">🛍️</span>
                All Categories
              </div>
              <div className="navbar-dropdown-divider" />
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="navbar-dropdown-item"
                  onClick={() => handleCategoryClick(cat.name)}
                >
                  <span className="navbar-dropdown-icon">{cat.icon}</span>
                  {cat.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Search Bar ── */}
        <form className="navbar-search" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className="navbar-search-input"
            placeholder="Search for products, brands and more"
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              if (onSearchChange) onSearchChange(e.target.value);
            }}
            onKeyUp={handleSearchKey}
          />
          <button type="submit" className="navbar-search-btn" aria-label="Search">
            🔍
          </button>
        </form>

        {/* ── Nav Actions ── */}
        <div className="navbar-actions">

          {/* Home */}
          <button
            className="navbar-action-btn"
            onClick={() => navigate('/home')}
          >
            <span className="navbar-action-icon">🏠</span>
            <span className="navbar-action-label">Home</span>
          </button>

          {/* Orders */}
          <button
            className="navbar-action-btn"
            onClick={() => navigate('/orders')}
          >
            <span className="navbar-action-icon">📦</span>
            <span className="navbar-action-label">Orders</span>
          </button>

          {/* Wishlist */}
          <button
            className="navbar-action-btn"
            onClick={() => navigate('/wishlist')}
          >
            <span className="navbar-badge-wrap">
              <span className="navbar-action-icon">❤️</span>
              {wishlistCount > 0 && (
                <span className="navbar-badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>
              )}
            </span>
            <span className="navbar-action-label">Wishlist</span>
          </button>

          {/* Cart */}
          <button
            className="navbar-action-btn"
            onClick={() => navigate('/cart')}
          >
            <span className="navbar-badge-wrap">
              <span className="navbar-action-icon">🛒</span>
              {cartCount > 0 && (
                <span className="navbar-badge">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </span>
            <span className="navbar-action-label">Cart</span>
          </button>

          {/* Welcome */}
          {userName && (
            <div className="navbar-welcome">
              <span className="navbar-welcome-label">Hello,</span>
              <span className="navbar-welcome-name">{userName}</span>
            </div>
          )}

          {/* Logout */}
          <button className="navbar-logout-btn" onClick={handleLogout}>
            Logout
          </button>

        </div>

        {/* ── Hamburger ── */}
        <button
          className="navbar-hamburger"
          onClick={() => setMobileMenuOpen((p) => !p)}
          aria-label="Menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

      </nav>

      {/* ── Mobile Menu ── */}
      <div className={`navbar-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="navbar-mobile-item" onClick={() => { navigate('/home'); setMobileMenuOpen(false); }}>
          🏠 Home
        </div>
        <div className="navbar-mobile-item" onClick={() => { navigate('/orders'); setMobileMenuOpen(false); }}>
          📦 My Orders
        </div>
        <div className="navbar-mobile-item" onClick={() => { navigate('/wishlist'); setMobileMenuOpen(false); }}>
          ❤️ Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
        </div>
        <div className="navbar-mobile-item" onClick={() => { navigate('/cart'); setMobileMenuOpen(false); }}>
          🛒 Cart {cartCount > 0 && `(${cartCount})`}
        </div>
        <div className="navbar-mobile-item" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '4px', paddingTop: '12px' }}>
          📂 Categories
        </div>
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="navbar-mobile-item"
            style={{ paddingLeft: '28px', fontSize: '0.85rem' }}
            onClick={() => handleCategoryClick(cat.name)}
          >
            {cat.icon} {cat.name}
          </div>
        ))}
        <div
          className="navbar-mobile-item"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '4px', color: '#ffcdd2' }}
          onClick={handleLogout}
        >
          🚪 Logout
        </div>
      </div>
    </>
  );
}

export default Navbar;