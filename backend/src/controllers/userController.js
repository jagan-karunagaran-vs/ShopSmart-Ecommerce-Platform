// ─────────────────────────────────────────────────────────────
// User controller — the logged-in user's own profile.
// Role / email cannot be changed here.
// ─────────────────────────────────────────────────────────────

import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { setAuthCookies } from '../utils/generateToken.js';

// GET /api/users/profile
export const getProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

// PUT /api/users/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;

  req.user.name = name;
  await req.user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully.',
    data: { user: req.user },
  });
});

// PUT /api/users/password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (!user || !(await user.comparePassword(currentPassword))) {
    throw AppError.badRequest('Current password is incorrect.');
  }

  if (currentPassword === newPassword) {
    throw AppError.badRequest('New password must be different from the current password.');
  }

  user.password = newPassword; // hashed by the pre-save hook
  await user.save();

  // Re-issue the session cookies for this device.
  const csrfToken = setAuthCookies(res, user);

  res.json({
    success: true,
    message: 'Password changed successfully.',
    data: { csrfToken },
  });
});