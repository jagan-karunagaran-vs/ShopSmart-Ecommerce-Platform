// ─────────────────────────────────────────────────────────────
// Rate limiters (express-rate-limit)
// - apiLimiter  : general limiter for all /api routes
// - authLimiter : stricter limiter for login / signup
// - paymentLimiter : limits payment creation / verification attempts
// Responses follow the standard API error contract.
// ─────────────────────────────────────────────────────────────

import rateLimit from 'express-rate-limit';

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message });
    },
  });

export const apiLimiter = buildLimiter({
  windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: toInt(process.env.RATE_LIMIT_MAX, 300),
  message: 'Too many requests. Please try again later.',
});

export const authLimiter = buildLimiter({
  windowMs: toInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: toInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
  message: 'Too many login attempts. Please try again later.',
});

export const paymentLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many payment requests. Please try again later.',
});

export default apiLimiter;