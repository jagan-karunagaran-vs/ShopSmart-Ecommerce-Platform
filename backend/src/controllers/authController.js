// ─────────────────────────────────────────────────────────────
// Auth controller
// - Public signup ALWAYS creates role "user" (admins are created
//   only via the createAdmin script).
// - Session = JWT in an httpOnly cookie. The CSRF token is returned
//   in the response body (and set as a readable cookie) so the SPA
//   can send it back in the `X-CSRF-Token` header.
//
// Response contract: { success, message?, data }
// ─────────────────────────────────────────────────────────────

import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { setAuthCookies, clearAuthCookies } from '../utils/generateToken.js';

// POST /api/auth/signup
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    throw AppError.conflict('An account with this email already exists.');
  }

  // `role` is intentionally NOT read from the request.
  const user = await User.create({ name, email, password, role: 'user' });

  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    data: { user },
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Same message for unknown email / wrong password (no account enumeration).
  const valid = user ? await user.comparePassword(password) : false;

  if (!user || !valid) {
    throw AppError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    throw AppError.forbidden('This account has been deactivated.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const csrfToken = setAuthCookies(res, user);

  res.json({
    success: true,
    message: 'Login successful.',
    data: { user, csrfToken },
  });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logged out successfully.',
    data: null,
  });
});

// GET /api/auth/me  (requires auth)
// Also refreshes the session cookies and returns a fresh CSRF token,
// which the frontend calls on app start.
export const getMe = asyncHandler(async (req, res) => {
  const csrfToken = setAuthCookies(res, req.user);

  res.json({
    success: true,
    data: { user: req.user, csrfToken },
  });
});