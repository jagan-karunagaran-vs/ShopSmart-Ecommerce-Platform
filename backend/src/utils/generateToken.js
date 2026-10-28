// ─────────────────────────────────────────────────────────────
// Token + cookie helpers
//
// Authentication  : JWT stored ONLY in an httpOnly cookie.
// CSRF protection : signed double-submit token.
//   - A CSRF token is bound to the user id with an HMAC, set in a
//     JS-readable cookie, and also returned in the JSON body.
//   - The frontend echoes it in the `X-CSRF-Token` header on every
//     state-changing request. The server checks that the header
//     matches the cookie AND that the HMAC is valid for the
//     authenticated user (see authMiddleware.verifyCsrf).
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.startsWith('replace_with')) {
    throw new Error('JWT_SECRET is missing or still a placeholder. Set it in backend/.env.');
  }
  return secret;
};

export const getAuthCookieName = () => process.env.AUTH_COOKIE_NAME || 'shopsmart_token';
export const getCsrfCookieName = () => process.env.CSRF_COOKIE_NAME || 'shopsmart_csrf';

// ── JWT ──────────────────────────────────────────────────────
export const signToken = (user) => {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const verifyToken = (token) => {
  return jwt.verify(token, getSecret());
};

// ── CSRF token (HMAC bound to user id) ──────────────────────
const hmac = (nonce, userId) =>
  crypto.createHmac('sha256', getSecret()).update(`${nonce}:${userId}`).digest('hex');

export const generateCsrfToken = (userId) => {
  const nonce = crypto.randomBytes(24).toString('hex');
  return `${nonce}.${hmac(nonce, userId.toString())}`;
};

export const isValidCsrfToken = (token, userId) => {
  if (typeof token !== 'string') return false;

  const [nonce, signature] = token.split('.');
  if (!nonce || !signature) return false;

  const expected = hmac(nonce, userId.toString());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// ── Cookie options ──────────────────────────────────────────
const baseCookieOptions = () => {
  const days = parseInt(process.env.COOKIE_EXPIRES_DAYS, 10) || 7;
  const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  const secure =
    process.env.COOKIE_SECURE === 'true' || sameSite === 'none';

  const options = {
    secure,
    sameSite,
    path: '/',
    maxAge: days * 24 * 60 * 60 * 1000,
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
};

/**
 * Sets the auth cookie (httpOnly) and the CSRF cookie (readable by JS).
 * Returns the CSRF token so controllers can include it in the response body.
 */
export const setAuthCookies = (res, user) => {
  const token = signToken(user);
  const csrfToken = generateCsrfToken(user._id);
  const options = baseCookieOptions();

  res.cookie(getAuthCookieName(), token, { ...options, httpOnly: true });
  res.cookie(getCsrfCookieName(), csrfToken, { ...options, httpOnly: false });

  return csrfToken;
};

export const clearAuthCookies = (res) => {
  const { maxAge, ...options } = baseCookieOptions();

  res.clearCookie(getAuthCookieName(), { ...options, httpOnly: true });
  res.clearCookie(getCsrfCookieName(), { ...options, httpOnly: false });
};

export default signToken;