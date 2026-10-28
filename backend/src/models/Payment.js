// ─────────────────────────────────────────────────────────────
// Payment model — one record per Razorpay order.
// - Amounts are stored in the smallest currency unit (paise).
// - NO raw card data is ever stored; Razorpay hosted checkout
//   collects it. We keep only gateway ids, status, and method.
// - `processedEventIds` makes webhook handling idempotent:
//   a duplicate Razorpay event id is detected and ignored.
// ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

export const GATEWAY_PAYMENT_STATUSES = [
  'created',    // Razorpay order created, awaiting payment
  'authorized', // authorized but not yet captured
  'captured',   // money received (verified)
  'failed',
  'refunded',
];

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gateway: {
      type: String,
      default: 'razorpay',
      enum: ['razorpay'],
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
      select: false,
    },
    receipt: {
      type: String,
      default: '',
    },
    amount: {
      type: Number, // paise
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Amount must be an integer (paise).' },
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: GATEWAY_PAYMENT_STATUSES,
      default: 'created',
      index: true,
    },
    method: { type: String, default: '' }, // upi, card, netbanking, wallet…
    errorCode: { type: String, default: '' },
    errorDescription: { type: String, default: '' },

    verifiedAt: { type: Date },

    // Razorpay webhook event ids already applied (idempotency).
    processedEventIds: {
      type: [String],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.razorpaySignature;
    delete ret.processedEventIds;
    return ret;
  },
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;