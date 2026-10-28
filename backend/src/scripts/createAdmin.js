// ─────────────────────────────────────────────────────────────
// Create an admin account — the ONLY way to get an admin, since
// public signup always creates role "user".
//
// Reads ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env
//
// Usage (from backend/):
//   npm run create-admin
//
// SECURITY: this script NEVER promotes an existing account.
// If someone had registered the admin email through public signup
// before you ran this script, promoting that account would hand
// admin rights to whoever knows its password. So when the email is
// already taken by a normal user, the script stops with an error.
// Choose a different ADMIN_EMAIL (use an address that is not public),
// or remove the unwanted user in MongoDB Atlas, then run it again.
//
// Run this BEFORE the site is publicly reachable, then delete
// ADMIN_PASSWORD from backend/.env.
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import connectDB, { disconnectDB } from '../config/db.js';
import User from '../models/User.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isPlaceholderPassword = (value) =>
  !value || value.startsWith('replace_with') || value.length < 8;

/**
 * Creates a NEW admin user. Never changes an existing account.
 * Returns { status: 'created' | 'already-admin' }; throws otherwise.
 * (UserModel is injectable so the logic can be tested without a DB.)
 */
export const ensureAdmin = async ({ UserModel = User, name, email, password }) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || 'Store Admin').trim();

  if (!cleanEmail || !EMAIL_PATTERN.test(cleanEmail) || cleanEmail === 'admin@example.com') {
    throw new Error('Set a real ADMIN_EMAIL in backend/.env.');
  }

  const existing = await UserModel.findOne({ email: cleanEmail });

  if (existing) {
    if (existing.role === 'admin') {
      return { status: 'already-admin', email: cleanEmail };
    }

    throw new Error(
      `A normal user with email "${cleanEmail}" already exists. ` +
        'For safety this script never promotes an existing account (it may have been ' +
        'registered by someone else). Use a different ADMIN_EMAIL, or delete that user ' +
        'in MongoDB Atlas first.'
    );
  }

  if (isPlaceholderPassword(password)) {
    throw new Error(
      'Set a strong ADMIN_PASSWORD (at least 8 characters, not the placeholder) in backend/.env.'
    );
  }

  await UserModel.create({
    name: cleanName,
    email: cleanEmail,
    password,
    role: 'admin',
  });

  return { status: 'created', email: cleanEmail };
};

const run = async () => {
  try {
    await connectDB();

    const result = await ensureAdmin({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });

    if (result.status === 'already-admin') {
      console.log(`"${result.email}" is already an admin. Nothing to do.`);
    } else {
      console.log(`Admin account created for "${result.email}".`);
      console.log('Now remove ADMIN_PASSWORD from backend/.env.');
    }

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('createAdmin failed:', err.message);
    try {
      await disconnectDB();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}