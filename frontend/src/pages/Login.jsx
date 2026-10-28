import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import '../styles/Login.css';
import { useAuth } from '../context/AuthContext.jsx';
import {
  FaTruck,
  FaUndo,
  FaLock,
  FaCrown
} from 'react-icons/fa';

function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, authLoading, login } = useAuth();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // ── Already logged in (or just logged in) → go to the right place ──
  // Admins → dashboard, everyone else → the page they came from or /home.
  useEffect(() => {
    if (authLoading || !user) return;

    if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate(location.state?.from || '/home', { replace: true });
    }
  }, [user, authLoading, navigate, location.state]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // ── Empty field check ─────────────────────────────────
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      // Server verifies the password and sets the httpOnly session cookie.
      // Redirect happens in the effect above once the user is set.
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* ── Left Panel ── */}
      <div className="login-left">

        <div className="login-brand">
          <h1>ShopSmart</h1>
          <p>
            Shop electronics, fashion, lifestyle,
            and more with smart recommendations.
          </p>
        </div>

        <img
          src="https://plus.unsplash.com/premium_photo-1677995700941-100976883af7?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTg1fHxwdXJjaGFzZXxlbnwwfHwwfHx8MA%3D%3D"
          alt="Shopping"
          className="login-illustration"
        />

        <div className="login-features">
          <div className="login-feature-item">
            <span className="icon">🚚</span>
            <span>Fast Delivery Across India</span>
          </div>
          <div className="login-feature-item">
            <span className="icon">🔄</span>
            <span>Easy Returns & Quick Exchange</span>
          </div>
          <div className="login-feature-item">
            <span className="icon">🔒</span>
            <span>100% Safe & Secure Checkout</span>
          </div>
          <div className="login-feature-item">
            <span className="icon">⭐</span>
            <span>Premium Shopping Experience</span>
          </div>
        </div>

      </div>

      {/* ── Right Panel ── */}
      <div className="login-right">
        <div className="login-form-box">

          <h2>Welcome back!</h2>
          <p className="login-subtitle">
            Login to your ShopSmart account
          </p>

          {/* ── Error Alert ── */}
          {error && (
            <div
              className="alert alert-danger py-2 mb-3"
              style={{ fontSize: '0.85rem', borderRadius: '8px' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            {/* Email */}
            <div className="mb-3">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-login-submit"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login to ShopSmart'}
            </button>

          </form>

          <div className="login-divider">or</div>

          <p className="login-signup-text">
            New to ShopSmart?{' '}
            <Link to="/signup">Create an account</Link>
          </p>

        </div>
      </div>

    </div>
  );
}

export default Login;