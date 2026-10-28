import express, { Router } from 'express';
import { z } from 'zod';
import {
  createPaymentOrder,
  verifyPaymentController,
  getPaymentStatus,
  razorpayWebhook,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid order id.');

const createOrderSchema = z.object({
  orderId: objectId,
});

const verifySchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature: z.string().trim().min(1).max(256),
});

const statusParams = z.object({ orderId: objectId });

// ── Webhook (public; authenticated by Razorpay's HMAC signature) ──
// Needs the RAW body to verify the signature, so it must NOT go
// through express.json(). No cookie auth / CSRF applies here.
router.post(
  '/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  razorpayWebhook
);

// ── Authenticated customer routes (+ CSRF on POST) ───────────
router.use(protect);

router.post(
  '/create-order',
  paymentLimiter,
  validateRequest({ body: createOrderSchema }),
  createPaymentOrder
);

router.post(
  '/verify',
  paymentLimiter,
  validateRequest({ body: verifySchema }),
  verifyPaymentController
);

router.get(
  '/status/:orderId',
  validateRequest({ params: statusParams }),
  getPaymentStatus
);

export default router;