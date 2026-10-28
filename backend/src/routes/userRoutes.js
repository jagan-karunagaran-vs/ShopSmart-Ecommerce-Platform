import { Router } from 'express';
import { z } from 'zod';
import {
  getProfile,
  updateProfile,
  changePassword,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter a valid full name.')
    .max(80, 'Name must be at most 80 characters.'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.').max(128),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters.')
    .max(128, 'New password must be at most 128 characters.'),
});

// All user routes require login (+ CSRF on state-changing methods).
router.use(protect);

// GET /api/users/profile
router.get('/profile', getProfile);

// PUT /api/users/profile
router.put('/profile', validateRequest({ body: updateProfileSchema }), updateProfile);

// PUT /api/users/password
router.put('/password', validateRequest({ body: changePasswordSchema }), changePassword);

export default router;