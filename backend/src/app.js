// Express app (no listening here — see server.js).
// Keep dotenv/config first so environment variables are available
// to imported modules.

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { apiLimiter } from './middleware/rateLimiter.js';
import {
  notFound,
  errorHandler,
} from './middleware/errorMiddleware.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiSearchRoutes from './routes/aiSearchRoutes.js';

const app = express();

app.disable('x-powered-by');

// Needed for correct client IPs behind the production proxy.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers.
app.use(helmet());

// Cookie authentication requires credentials and explicit origins.
const allowedOrigins = (
  process.env.CLIENT_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow clients without an Origin header, including webhooks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 600,
  })
);

// Razorpay signature verification requires the raw request body.
// Register this before express.json().
app.use(
  '/api/payments/webhook',
  express.raw({
    type: 'application/json',
    limit: '1mb',
  })
);

// Body and cookie parsing.
app.use(express.json({ limit: '100kb' }));
app.use(
  express.urlencoded({
    extended: false,
    limit: '100kb',
  })
);
app.use(cookieParser());

// General API rate limiting; Razorpay webhook is excluded.
app.use('/api', (req, res, next) => {
  if (req.path === '/payments/webhook') {
    return next();
  }

  return apiLimiter(req, res, next);
});

// Health check.
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
    },
  });
});

// API routes.
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiSearchRoutes);

// Error handlers must remain after all routes.
app.use(notFound);
app.use(errorHandler);

export default app;