// ─────────────────────────────────────────────────────────────
// Payment controller (Razorpay)
//   POST /api/payments/create-order   (auth + CSRF)
//   POST /api/payments/verify         (auth + CSRF)
//   GET  /api/payments/status/:orderId (auth)
//   POST /api/payments/webhook        (public, signature-verified,
//                                      receives the RAW body)
// ─────────────────────────────────────────────────────────────

import { asyncHandler } from '../middleware/errorMiddleware.js';
import {
  createPaymentForOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatusForOrder,
} from '../services/paymentService.js';

// POST /api/payments/create-order   body: { orderId }
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const checkout = await createPaymentForOrder(req.user._id, req.body.orderId);

  res.status(201).json({
    success: true,
    message: 'Payment initiated.',
    data: {
      checkout: {
        ...checkout,
        prefill: {
          name: req.user.name,
          email: req.user.email,
        },
      },
    },
  });
});

// POST /api/payments/verify
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyPaymentController = asyncHandler(async (req, res) => {
  const order = await verifyPayment(req.user._id, req.body);

  res.json({
    success: true,
    message: 'Payment verified successfully.',
    data: { order },
  });
});

// GET /api/payments/status/:orderId
export const getPaymentStatus = asyncHandler(async (req, res) => {
  const { order, payment } = await getPaymentStatusForOrder(
    req.user._id,
    req.params.orderId
  );

  res.json({
    success: true,
    data: {
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      order,
      payment,
    },
  });
});

// POST /api/payments/webhook   (raw body — see paymentRoutes / app.js)
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  const eventId = req.get('x-razorpay-event-id');

  const result = await handleWebhook(req.body, signature, eventId);

  // Always 200 for verified events (including duplicates / ignored ones)
  // so Razorpay does not keep retrying them.
  res.status(200).json({ success: true, data: result });
});