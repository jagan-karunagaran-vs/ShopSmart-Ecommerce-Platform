// ─────────────────────────────────────────────────────────────
// Error handling + async wrapper
//
// API contract (used everywhere):
//   success → { success: true,  message?: string, data: any }
//   error   → { success: false, message: string, details?: any }
// ─────────────────────────────────────────────────────────────

import { ZodError } from 'zod';
import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';

/** Wraps an async route handler so rejected promises reach the error handler. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 404 for unmatched routes. */
export const notFound = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

/** Converts known error types into AppError-like shapes. */
const normalizeError = (err) => {
  if (err instanceof AppError) return err;

  // Zod validation
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return new AppError(details[0]?.message || 'Validation failed.', 400, details);
  }

  // Mongoose schema validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new AppError(details[0]?.message || 'Validation failed.', 400, details);
  }

  // Invalid ObjectId, etc.
  if (err instanceof mongoose.Error.CastError) {
    return new AppError(`Invalid ${err.path}.`, 400);
  }

  // Duplicate key
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    return new AppError(`A record with this ${field} already exists.`, 409);
  }

  // JWT
  if (err?.name === 'TokenExpiredError') {
    return new AppError('Session expired. Please log in again.', 401);
  }
  if (err?.name === 'JsonWebTokenError') {
    return new AppError('Invalid session. Please log in again.', 401);
  }

  // Malformed JSON body / payload too large
  if (err?.type === 'entity.parse.failed') {
    return new AppError('Malformed JSON in request body.', 400);
  }
  if (err?.type === 'entity.too.large') {
    return new AppError('Request body is too large.', 413);
  }

  return null;
};

/** Central error handler — must be registered last. */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const normalized = normalizeError(err);
  const isDev = process.env.NODE_ENV !== 'production';

  if (!normalized) {
    // Unexpected error: log fully, return a generic message.
    console.error('Unexpected error:', err);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      ...(isDev && { debug: err?.message }),
    });
  }

  if (normalized.statusCode >= 500) {
    console.error('Server error:', err);
  }

  return res.status(normalized.statusCode).json({
    success: false,
    message: normalized.message,
    ...(normalized.details && { details: normalized.details }),
    ...(isDev && normalized.statusCode >= 500 && { debug: err?.stack }),
  });
};

export default errorHandler;