import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { searchProducts } from '../controllers/aiSearchController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

const searchBodySchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(2, 'Enter at least 2 characters.')
      .max(400, 'Search must not exceed 400 characters.'),
  })
  .strict();

// Authentication runs first, so this key comes from the verified
// database user, never from a client-supplied ID or role.
const userSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        'Too many AI searches. Please wait a minute before trying again.',
    });
  },
});

// Application safeguard: at most 100 accepted search requests
// across all users in a 24-hour window.
//
// This is an in-memory limit for ONE backend process.
// It resets on restart and is not shared between server instances.
// It does not represent Google's quota or guarantee free billing.
// Keep the Google API project on the free tier.
const sharedSearchLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  keyGenerator: () => 'shopsmart-ai-search',
  standardHeaders: false,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        'The store AI search limit has been reached. Please try later or use the regular search.',
    });
  },
});

// Prevent browsers and intermediary caches from storing responses.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Existing protect middleware verifies both the authentication
// cookie and the X-CSRF-Token header for POST requests.
router.post(
  '/search',
  protect,
  validateRequest({ body: searchBodySchema }),
  userSearchLimiter,
  sharedSearchLimiter,
  searchProducts
);

export default router;