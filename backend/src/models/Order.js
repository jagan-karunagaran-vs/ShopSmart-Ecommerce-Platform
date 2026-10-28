// ─────────────────────────────────────────────────────────────
// Order model
// - Items are SNAPSHOTS (name, image, price…) taken at order time,
//   so later catalog edits never change past orders.
// - All totals are calculated on the server (see calculateOrderTotals).
// - Money values are stored in INR (rupees); Razorpay amounts are
//   derived in paise by the payment service.
// - Payment attempts/verification details live in the Payment model.
// ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

export const ORDER_STATUSES = [
  'pending',     // created, awaiting successful payment
  'confirmed',   // payment verified
  'processing',  // being packed
  'shipped',
  'delivered',
  'cancelled',
];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true },
    category: { type: String, default: '' },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },          // unit price paid
    originalPrice: { type: Number, required: true, min: 0 },  // unit MRP
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number.' },
    },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, default: '', maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    postalCode: { type: String, required: true, trim: true, maxlength: 12 },
    country: { type: String, trim: true, default: 'India', maxlength: 60 },
  },
  { _id: false }
);

const totalsSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },        // sum of MRP × qty
    discount: { type: Number, required: true, min: 0 },        // MRP − price
    deliveryCharge: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },           // amount payable
    totalItems: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An order must contain at least one item.',
      },
    },
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    totals: {
      type: totalsSchema,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    // Razorpay order id (order_xxx) linked to this order — set when
    // the payment order is created.
    razorpayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    paidAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: '', maxlength: 300 },

    // True while stock for this order is deducted from products.
    // Makes stock deduction / restoration idempotent.
    stockDeducted: { type: Boolean, default: false },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

orderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

const Order = mongoose.model('Order', orderSchema);

export default Order;