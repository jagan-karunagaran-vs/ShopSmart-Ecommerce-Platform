import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Signup.css';
import { useAuth } from '../context/AuthContext.jsx';

function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [loading, setLoading]         = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // ── Validations ───────────────────────────────────────
    if (!name || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (name.trim().length < 2) {
      setError('Please enter a valid full name.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      // Public signup always creates a normal user account on the server.
      await signup(name.trim(), email.trim(), password);

      setSuccess('Account created! 🛍️ Redirecting to login...');
      setLoading(false);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">

      {/* ── Left Panel ── */}
      <div className="signup-left">

        <div className="signup-brand">
          <h1>ShopSmart</h1>
          <p>Join crores of happy shoppers. Get the best deals every day.</p>
        </div>

        <img
          src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80"
          alt="Shopping"
          className="signup-illustration"
        />

        <div className="signup-perks">
          <div className="signup-perk-item">
            <span className="icon">🎁</span>
            <span>Exclusive deals for new members</span>
          </div>
          <div className="signup-perk-item">
            <span className="icon">💳</span>
            <span>Save cards & addresses securely</span>
          </div>
          <div className="signup-perk-item">
            <span className="icon">📦</span>
            <span>Track all your orders in one place</span>
          </div>
          <div className="signup-perk-item">
            <span className="icon">🔔</span>
            <span>Get price drop alerts instantly</span>
          </div>
        </div>

      </div>

      {/* ── Right Panel ── */}
      <div className="signup-right">
        <div className="signup-form-box">

          <h2>Create Account</h2>
          <p className="signup-subtitle">Start your ShopSmart journey today</p>

          {/* ── Error Alert ── */}
          {error && (
            <div
              className="alert alert-danger py-2 mb-3"
              style={{ fontSize: '0.85rem', borderRadius: '8px' }}
            >
              {error}
            </div>
          )}

          {/* ── Success Alert ── */}
          {success && (
            <div
              className="alert alert-success py-2 mb-3"
              style={{ fontSize: '0.85rem', borderRadius: '8px' }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSignup}>

            {/* Full Name */}
            <div className="mb-3">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || !!success}
              />
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !!success}
              />
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Create a password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || !!success}
              />
            </div>

            {/* Confirm Password */}
            <div className="mb-4">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || !!success}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-signup-submit"
              disabled={loading || !!success}
            >
              {loading ? 'Creating Account...' : '🛍️ Create My Account'}
            </button>

          </form>

          <p className="signup-terms">
            By creating an account, you agree to ShopSmart's{' '}
            <a href="#">Terms of Use</a> and{' '}
            <a href="#">Privacy Policy</a>
          </p>

          <p className="signup-login-text">
            Already have an account?{' '}
            <Link to="/">Login here</Link>
          </p>

        </div>
      </div>

    </div>
  );
}

export default Signup;