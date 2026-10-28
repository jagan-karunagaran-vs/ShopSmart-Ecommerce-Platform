// ─────────────────────────────────────────────────────────────
// Server entry point
// Start: node src/server.js   |   Dev: node --watch src/server.js
// ─────────────────────────────────────────────────────────────

import app from './app.js'; // loads dotenv first
import connectDB, { disconnectDB } from './config/db.js';

const PORT = parseInt(process.env.PORT, 10) || 5000;

let server;

const start = async () => {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(
        `ShopSmart API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`
      );
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

// ── Graceful shutdown ────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

start();