// ─────────────────────────────────────────────────────────────
// Server-side admin authorization.
// Must run AFTER `protect` (which loads req.user from the database).
// The role is read from the DB record, never from the client.
// ─────────────────────────────────────────────────────────────

import AppError from '../utils/AppError.js';

export const adminOnly = (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Please log in to continue.', 401));
  }

  if (req.user.role !== 'admin') {
    return next(new AppError('Admin access required.', 403));
  }

  return next();
};

export default adminOnly;