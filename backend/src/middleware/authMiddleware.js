// ─────────────────────────────────────────────────────────────
// Authentication middleware
//
// protect:
//   1. Reads the JWT from the httpOnly auth cookie (cookie-parser).
//   2. Loads the user from the DB (so deactivated users / role
//      changes take effect immediately).
//   3. For state-changing methods (POST/PUT/PATCH/DELETE) enforces
//      CSRF: the `X-CSRF-Token` header must equal the CSRF cookie
//      and be a valid HMAC token for this user.
//
// There is NO bearer-token / localStorage fallback by design.
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import {
  verifyToken,
  isValidCsrfToken,
  getAuthCookieName,
  getCsrfCookieName,
} from '../utils/generateToken.js';
import { asyncHandler } from './errorMiddleware.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

/** Resolves the user from the auth cookie, or returns null if absent. */
const resolveUser = async (req) => {
  const token = req.cookies?.[getAuthCookieName()];
  if (!token) return null;

  const decoded = verifyToken(token); // throws on invalid / expired
  const user = await User.findById(decoded.sub);

  if (!user || !user.isActive) {
    throw new AppError('Account not found or deactivated.', 401);
  }

  return user;
};

/** CSRF check for an already-authenticated request. */
export const verifyCsrf = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const headerToken = req.get('x-csrf-token');
  const cookieToken = req.cookies?.[getCsrfCookieName()];

  if (
    !headerToken ||
    !cookieToken ||
    !safeEqual(headerToken, cookieToken) ||
    !req.user ||
    !isValidCsrfToken(headerToken, req.user._id)
  ) {
    return next(new AppError('Invalid or missing CSRF token.', 403));
  }

  return next();
};

/** Requires a logged-in user (and CSRF for unsafe methods). */
export const protect = asyncHandler(async (req, _res, next) => {
  const user = await resolveUser(req);

  if (!user) {
    throw new AppError('Please log in to continue.', 401);
  }

  req.user = user;
  return verifyCsrf(req, _res, next);
});

/** Attaches req.user when logged in, but never blocks the request. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    req.user = (await resolveUser(req)) || undefined;
  } catch {
    req.user = undefined;
  }
  next();
});

export default protect;