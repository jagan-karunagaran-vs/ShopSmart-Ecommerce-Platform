import React, { useState } from 'react';
import '../styles/Footer.css';

function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer className="shopsmart-footer">

      {}
      <div className="footer-top-strip">
        <div className="footer-top-strip-inner">
          <div className="footer-trust-item">
            <span className="footer-trust-icon">🚚</span>
            <div className="footer-trust-text">
              <strong>Free Delivery</strong>
              <span>On orders above ₹499</span>
            </div>
          </div>
          <div className="footer-trust-item">
            <span className="footer-trust-icon">🔄</span>
            <div className="footer-trust-text">
              <strong>Easy Returns</strong>
              <span>30-day hassle-free returns</span>
            </div>
          </div>
          <div className="footer-trust-item">
            <span className="footer-trust-icon">🔒</span>
            <div className="footer-trust-text">
              <strong>Secure Payments</strong>
              <span>100% protected transactions</span>
            </div>
          </div>
          <div className="footer-trust-item">
            <span className="footer-trust-icon">🎧</span>
            <div className="footer-trust-text">
              <strong>24/7 Support</strong>
              <span>Always here to help you</span>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="footer-main">

        {}
        <div className="footer-brand-col">
          <div className="footer-logo">
            <div className="footer-logo-name">ShopSmart</div>
            <div className="footer-logo-tagline">India ka Smart Bazaar</div>
          </div>
          <p className="footer-brand-desc">
            ShopSmart brings you the best deals across electronics, fashion, groceries, and more.
            Shop smart, save more — every single day.
          </p>

          {}
          <div className="footer-social-row">
            <a href="#" className="footer-social-btn" aria-label="Facebook">📘</a>
            <a href="#" className="footer-social-btn" aria-label="Instagram">📷</a>
            <a href="#" className="footer-social-btn" aria-label="Twitter">🐦</a>
            <a href="#" className="footer-social-btn" aria-label="YouTube">▶️</a>
            <a href="#" className="footer-social-btn" aria-label="LinkedIn">💼</a>
          </div>

          {/* App Badges */}
          <div className="footer-app-label">Download Our App</div>
          <div className="footer-app-badges">
            <a href="#" className="footer-app-badge">
              <span className="footer-app-badge-icon">🍎</span>
              <div className="footer-app-badge-text">
                <span className="footer-app-badge-sub">Download on the</span>
                <span className="footer-app-badge-name">App Store</span>
              </div>
            </a>
            <a href="#" className="footer-app-badge">
              <span className="footer-app-badge-icon">🤖</span>
              <div className="footer-app-badge-text">
                <span className="footer-app-badge-sub">Get it on</span>
                <span className="footer-app-badge-name">Google Play</span>
              </div>
            </a>
          </div>
        </div>

        {/* ── About Column ── */}
        <div className="footer-link-col">
          <div className="footer-col-title">About</div>
          <ul className="footer-link-list">
            <li><span>About ShopSmart</span></li>
            <li><span>Careers</span></li>
            <li><span>Press & Media</span></li>
            <li><span>ShopSmart Stories</span></li>
            <li><span>Corporate Info</span></li>
            <li><span>Investors</span></li>
          </ul>
        </div>

        {/* ── Help Column ── */}
        <div className="footer-link-col">
          <div className="footer-col-title">Help</div>
          <ul className="footer-link-list">
            <li><span>Payments</span></li>
            <li><span>Shipping</span></li>
            <li><span>Cancellation & Returns</span></li>
            <li><span>FAQ</span></li>
            <li><span>Report Infringement</span></li>
            <li><span>Track Order</span></li>
          </ul>
        </div>

        {/* ── Policy Column ── */}
        <div className="footer-link-col">
          <div className="footer-col-title">Policy</div>
          <ul className="footer-link-list">
            <li><span>Return Policy</span></li>
            <li><span>Terms of Use</span></li>
            <li><span>Security</span></li>
            <li><span>Privacy Policy</span></li>
            <li><span>Sitemap</span></li>
            <li><span>EPR Compliance</span></li>
          </ul>
        </div>

        {/* ── Newsletter Column ── */}
        <div className="footer-link-col">
          <div className="footer-col-title">Stay Connected</div>
          <ul className="footer-link-list" style={{ marginBottom: '16px' }}>
            <li><span>Become a Seller</span></li>
            <li><span>Advertise</span></li>
            <li><span>Gift Cards</span></li>
            <li><span>ShopSmart Plus</span></li>
          </ul>

          <div className="footer-newsletter">
            <div className="footer-newsletter-title">
              📬 Newsletter
            </div>
            <div className="footer-newsletter-sub">
              Get exclusive deals & offers directly in your inbox.
            </div>
            {subscribed ? (
              <div style={{ color: '#4caf50', fontSize: '0.82rem', fontWeight: 600 }}>
                ✅ Subscribed successfully!
              </div>
            ) : (
              <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  className="footer-newsletter-input"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="footer-newsletter-btn">
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

      </div>

      {/* ── Divider ── */}
      <hr className="footer-divider" />

      {/* ── Bottom Bar ── */}
      <div className="footer-bottom">
        <div className="footer-bottom-left">
          © {new Date().getFullYear()} <strong>ShopSmart</strong>. All rights reserved.
          Built with ❤️ in India.
        </div>
        <div className="footer-bottom-right">
          <span className="footer-payment-label">We accept:</span>
          <span className="footer-payment-badge">VISA</span>
          <span className="footer-payment-badge">Mastercard</span>
          <span className="footer-payment-badge">UPI</span>
          <span className="footer-payment-badge">NetBanking</span>
          <span className="footer-payment-badge">COD</span>
        </div>
      </div>

    </footer>
  );
}

export default Footer;