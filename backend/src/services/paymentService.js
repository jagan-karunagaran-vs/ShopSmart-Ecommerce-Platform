
import crypto from 'crypto';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import AppError from '../utils/AppError.js';
import { toPaise } from '../utils/calculateOrderTotals.js';
import {
  markOrderPaid,
  markOrderPaymentFailed,
  markOrderRefunded,
} from './orderService.js';

const isPlaceholder = (value) =>
  !value ||
  value.startsWith('replace_') ||
  value.includes('replace_me');

const getKeys = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (isPlaceholder(keyId) || isPlaceholder(keySecret)) {
    throw new AppError('Online payments are not configured.', 503);
  }

  return { keyId, keySecret };
};

let razorpayClient = null;

const getClient = () => {
  const { keyId, keySecret } = getKeys();

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayClient;
};

const getCurrency = () =>
  (process.env.CURRENCY || 'INR').toUpperCase();

const hmacHex = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

const safeEqualHex = (a, b) => {
  if (
    typeof a !== 'string' ||
    typeof b !== 'string' ||
    !/^[a-f\d]{64}$/i.test(a) ||
    !/^[a-f\d]{64}$/i.test(b)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a, 'hex'),
    Buffer.from(b, 'hex')
  );
};

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const gatewayError = (err, fallback = 'Payment gateway error. Please try again.') => {
  if (err instanceof AppError) return err;

  console.error('Razorpay request failed:', {
    statusCode: err?.statusCode,
    code: err?.error?.code,
  });

  if (err?.statusCode === 401) {
    return new AppError(
      'Payment gateway authentication failed. Check Razorpay keys.',
      503
    );
  }

  return new AppError(fallback, 502);
};

const buildCheckoutPayload = (payment, order) => ({
  keyId: getKeys().keyId,
  razorpayOrderId: payment.razorpayOrderId,
  amount: payment.amount,
  currency: payment.currency,
  orderId: order._id.toString(),
  orderNumber: order.orderNumber,
  name: 'ShopSmart',
  description: `Order ${order.orderNumber}`,
});

const matchesPayment = (entity, payment) =>
  entity &&
  typeof entity.id === 'string' &&
  entity.id.length > 0 &&
  entity.order_id === payment.razorpayOrderId &&
  Number.isSafeInteger(entity.amount) &&
  entity.amount === payment.amount &&
  String(entity.currency).toUpperCase() === payment.currency;

const getLinkedOrder = async (payment, session) => {
  const order = await Order.findById(payment.order).session(session);

  if (!order) throw AppError.notFound('Order not found.');

  return order;
};

export const createPaymentForOrder = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) throw AppError.notFound('Order not found.');

  if (order.paymentStatus === 'paid') {
    throw AppError.conflict('This order is already paid.');
  }

  if (order.paymentStatus === 'refunded') {
    throw AppError.conflict(
      'This order has been refunded. Please place a new order.'
    );
  }

  if (order.orderStatus !== 'pending' || !order.stockDeducted) {
    throw AppError.conflict(
      'This order is no longer awaiting payment. Please place a new order.'
    );
  }

  const amount = toPaise(order.totals.total);
  const currency = (order.currency || getCurrency()).toUpperCase();

  if (!Number.isSafeInteger(amount) || amount < 100) {
    throw AppError.badRequest('Order amount is invalid or too low.');
  }

  const existing = await Payment.findOne({
    order: order._id,
    status: { $in: ['created', 'failed'] },
    amount,
    currency,
  }).sort({ createdAt: -1 });

  if (existing) return buildCheckoutPayload(existing, order);

  const razorpay = getClient();
  let razorpayOrder;

  try {
    razorpayOrder = await razorpay.orders.create({
      amount,
      currency,
      receipt: order.orderNumber.slice(0, 40),
      notes: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: userId.toString(),
      },
    });
  } catch (err) {
    throw gatewayError(err, 'Could not start the payment. Please try again.');
  }

  const payment = await Payment.create({
    order: order._id,
    user: userId,
    razorpayOrderId: razorpayOrder.id,
    receipt: razorpayOrder.receipt || order.orderNumber,
    amount,
    currency,
    status: 'created',
  });

  await Order.updateOne(
    { _id: order._id },
    { $set: { razorpayOrderId: razorpayOrder.id } }
  );

  return buildCheckoutPayload(payment, order);
};

const applyCapturedPayment = async (paymentId, entity, signature, session) => {
  const payment = await Payment.findById(paymentId).session(session);

  if (!payment) throw AppError.notFound('Payment not found.');

  if (!matchesPayment(entity, payment) || entity.status !== 'captured') {
    throw AppError.badRequest('Payment details do not match the order.');
  }

  const order = await getLinkedOrder(payment, session);

  if (['captured', 'refunded'].includes(payment.status)) {
    if (payment.razorpayPaymentId !== entity.id) {
      throw AppError.conflict(
        'This order was already processed with a different payment.'
      );
    }
    return order;
  }

  if (order.paymentStatus === 'refunded') {
    throw AppError.conflict(
      'This order is already refunded. Payment reconciliation is required.'
    );
  }

  if (toPaise(order.totals.total) !== payment.amount) {
    throw AppError.conflict(
      'Order amount does not match the payment amount.'
    );
  }

  payment.status = 'captured';
  payment.razorpayPaymentId = entity.id;
  payment.method = entity.method || payment.method;
  payment.errorCode = '';
  payment.errorDescription = '';
  payment.verifiedAt = new Date();

  if (signature) payment.razorpaySignature = signature;

  await payment.save({ session });

  return markOrderPaid(payment.order, session);
};

export const verifyPayment = async (
  userId,
  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
) => {
  const { keySecret } = getKeys();

  const payment = await Payment.findOne({
    razorpayOrderId: razorpay_order_id,
    user: userId,
  });

  if (!payment) throw AppError.notFound('Payment not found.');

  const expected = hmacHex(
    `${payment.razorpayOrderId}|${razorpay_payment_id}`,
    keySecret
  );

  if (!safeEqualHex(expected, razorpay_signature)) {
    throw AppError.badRequest('Payment signature verification failed.');
  }

  if (payment.status === 'refunded') {
    throw AppError.conflict('This payment has already been refunded.');
  }

  if (payment.status === 'captured') {
    if (payment.razorpayPaymentId !== razorpay_payment_id) {
      throw AppError.conflict(
        'This order was already paid with a different payment.'
      );
    }

    const order = await Order.findById(payment.order);

    if (!order) throw AppError.notFound('Order not found.');

    if (order.paymentStatus === 'refunded') {
      throw AppError.conflict('This order has already been refunded.');
    }

    return order;
  }

  const razorpay = getClient();
  let entity;

  try {
    entity = await razorpay.payments.fetch(razorpay_payment_id);
  } catch (err) {
    throw gatewayError(err, 'Could not confirm the payment. Please try again.');
  }

  if (!matchesPayment(entity, payment) || entity.id !== razorpay_payment_id) {
    throw AppError.badRequest('Payment details do not match the order.');
  }

  if (entity.status === 'authorized') {
    try {
      entity = await razorpay.payments.capture(
        razorpay_payment_id,
        payment.amount,
        payment.currency
      );
    } catch (err) {
      throw gatewayError(err, 'Could not capture the payment. Please try again.');
    }
  }

  if (!matchesPayment(entity, payment) || entity.id !== razorpay_payment_id) {
    throw AppError.badRequest('Payment details do not match the order.');
  }

  if (entity.status === 'failed') {
    await runInTransaction(async (session) => {
      const current = await Payment.findById(payment._id).session(session);

      if (
        !current ||
        !['created', 'authorized', 'failed'].includes(current.status)
      ) {
        return;
      }

      const order = await getLinkedOrder(current, session);

      if (['paid', 'refunded'].includes(order.paymentStatus)) return;

      if (
        current.status === 'authorized' &&
        current.razorpayPaymentId &&
        current.razorpayPaymentId !== entity.id
      ) {
        return;
      }

      current.status = 'failed';
      current.errorCode = entity.error_code || '';
      current.errorDescription = entity.error_description || '';

      await current.save({ session });
      await markOrderPaymentFailed(current.order, session);
    });

    throw AppError.conflict('Payment failed. Please try again.');
  }

  if (entity.status !== 'captured') {
    throw AppError.conflict(
      'Payment is not completed yet. Please check your order status before trying again.'
    );
  }

  const order = await runInTransaction((session) =>
    applyCapturedPayment(payment._id, entity, razorpay_signature, session)
  );

  if (order.paymentStatus === 'refunded') {
    throw AppError.conflict('This payment has already been refunded.');
  }

  return order;
};

export const handleWebhook = async (rawBody, signature, eventIdHeader) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (isPlaceholder(secret)) {
    throw new AppError('Webhook secret is not configured.', 503);
  }

  if (!Buffer.isBuffer(rawBody) || !signature) {
    throw AppError.badRequest('Invalid webhook request.');
  }

  if (!safeEqualHex(hmacHex(rawBody, secret), signature)) {
    throw AppError.badRequest('Invalid webhook signature.');
  }

  let event;

  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw AppError.badRequest('Malformed webhook payload.');
  }

  const eventId =
    eventIdHeader ||
    crypto.createHash('sha256').update(rawBody).digest('hex');

  const type = event?.event;
  const supportedEvents = [
    'payment.captured',
    'order.paid',
    'payment.authorized',
    'payment.failed',
    'refund.processed',
  ];

  if (!supportedEvents.includes(type)) {
    return { handled: false, reason: 'unsupported_event' };
  }

  const paymentEntity = event?.payload?.payment?.entity;
  const refundEntity = event?.payload?.refund?.entity;
  const orderEntity = event?.payload?.order?.entity;

  let payment = null;

  if (type === 'refund.processed') {
    if (refundEntity?.payment_id) {
      payment = await Payment.findOne({
        razorpayPaymentId: refundEntity.payment_id,
      });
    }
  } else {
    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;

    if (razorpayOrderId) {
      payment = await Payment.findOne({ razorpayOrderId });
    }
  }

  if (!payment) return { handled: false, reason: 'unknown_payment' };

  return runInTransaction(async (session) => {
    const claimed = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        processedEventIds: { $ne: eventId },
      },
      {
        $push: {
          processedEventIds: { $each: [eventId], $slice: -100 },
        },
      },
      { session }
    );

    if (!claimed) return { handled: true, duplicate: true };

    switch (type) {
      case 'payment.captured':
      case 'order.paid': {
        if (
          !matchesPayment(paymentEntity, claimed) ||
          paymentEntity.status !== 'captured'
        ) {
          throw AppError.badRequest(
            'Captured webhook details do not match the payment.'
          );
        }

        await applyCapturedPayment(claimed._id, paymentEntity, null, session);
        break;
      }

      case 'payment.authorized': {
        const current = await Payment.findById(claimed._id).session(session);

        if (!current || ['captured', 'refunded'].includes(current.status)) {
          break;
        }

        if (
          !matchesPayment(paymentEntity, current) ||
          paymentEntity.status !== 'authorized'
        ) {
          throw AppError.badRequest(
            'Authorized webhook details do not match the payment.'
          );
        }

        const order = await getLinkedOrder(current, session);

        if (['paid', 'refunded'].includes(order.paymentStatus)) break;

        if (
          current.status === 'failed' &&
          current.razorpayPaymentId === paymentEntity.id
        ) {
          break;
        }

        if (['created', 'failed'].includes(current.status)) {
          current.status = 'authorized';
          current.razorpayPaymentId = paymentEntity.id;
          current.method = paymentEntity.method || current.method;
          await current.save({ session });
        }

        break;
      }

      case 'payment.failed': {
        const current = await Payment.findById(claimed._id).session(session);

        if (
          !current ||
          !['created', 'authorized', 'failed'].includes(current.status)
        ) {
          break;
        }

        if (
          !matchesPayment(paymentEntity, current) ||
          paymentEntity.status !== 'failed'
        ) {
          throw AppError.badRequest(
            'Failed webhook details do not match the payment.'
          );
        }

        const order = await getLinkedOrder(current, session);

        if (['paid', 'refunded'].includes(order.paymentStatus)) break;

        if (
          current.status === 'authorized' &&
          current.razorpayPaymentId &&
          current.razorpayPaymentId !== paymentEntity.id
        ) {
          break;
        }

        current.status = 'failed';
        current.razorpayPaymentId = paymentEntity.id;
        current.method = paymentEntity.method || current.method;
        current.errorCode = paymentEntity.error_code || '';
        current.errorDescription = paymentEntity.error_description || '';

        await current.save({ session });
        await markOrderPaymentFailed(current.order, session);
        break;
      }

      case 'refund.processed': {
        const current = await Payment.findById(claimed._id).session(session);

        if (!current || current.status === 'refunded') break;

        if (
          refundEntity?.payment_id !== current.razorpayPaymentId ||
          refundEntity?.status !== 'processed' ||
          !Number.isSafeInteger(refundEntity?.amount) ||
          refundEntity.amount <= 0 ||
          refundEntity.amount > current.amount ||
          String(refundEntity.currency).toUpperCase() !== current.currency
        ) {
          throw AppError.badRequest(
            'Refund webhook details do not match the payment.'
          );
        }

        if (
          current.status === 'captured' &&
          refundEntity.amount === current.amount
        ) {
          current.status = 'refunded';
          await current.save({ session });
          await markOrderRefunded(current.order, session);
        }

        break;
      }

      default:
        break;
    }

    return { handled: true };
  });
};

export const getPaymentStatusForOrder = async (userId, orderId) => {
  let order = await Order.findOne({ _id: orderId, user: userId });

  if (!order) throw AppError.notFound('Order not found.');

  let payment = await Payment.findOne({ order: order._id }).sort({
    createdAt: -1,
  });

  // Recover a captured payment when callback/webhook delivery is delayed.
  if (
    payment &&
    !['paid', 'refunded'].includes(order.paymentStatus) &&
    !['captured', 'refunded'].includes(payment.status)
  ) {
    let gatewayPayments;

    try {
      gatewayPayments = await getClient().orders.fetchPayments(
        payment.razorpayOrderId
      );
    } catch (err) {
      console.error('Razorpay status reconciliation failed:', {
        statusCode: err?.statusCode,
        code: err?.error?.code,
      });

      return { order, payment };
    }

    const entities = Array.isArray(gatewayPayments?.items)
      ? gatewayPayments.items
      : [];

    const captured = entities.find(
      (entity) =>
        matchesPayment(entity, payment) && entity.status === 'captured'
    );

    if (captured) {
      order = await runInTransaction((session) =>
        applyCapturedPayment(payment._id, captured, null, session)
      );

      payment = await Payment.findById(payment._id);
    }
  }

  return { order, payment };
};

export default {
  createPaymentForOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatusForOrder,
};
