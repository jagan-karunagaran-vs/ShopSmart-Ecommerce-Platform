import { Router } from 'express';
import { z } from 'zod';
import { signup, login, logout, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const emailSchema = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address.')
  .max(254);

// NOTE: unknown keys (e.g. a client-sent `role`) are stripped by Zod,
// so public signup can never create an admin.
const signupSchema = z.object({
  name: z
    .string({ error: 'Name is required.' })
    .trim()
    .min(2, 'Please enter a valid full name.')
    .max(80, 'Name must be at most 80 characters.'),
  email: emailSchema,
  password: z
    .string({ error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password must be at most 128 characters.'),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(128),
});

// POST /api/auth/signup
router.post('/signup', authLimiter, validateRequest({ body: signupSchema }), signup);

// POST /api/auth/login
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), login);

// POST /api/auth/logout  (public so a stale session can always be cleared)
router.post('/logout', logout);

// GET /api/auth/me
router.get('/me', protect, getMe);

export default router;