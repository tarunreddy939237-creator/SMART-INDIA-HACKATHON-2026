import mongoose from 'mongoose';
import { ensureDefaultUsers } from './autoSeed.js';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB  = process.env.MONGODB_DB || 'eduvision';

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null, failedAt: null };

// Back-off: don't retry within 30 s of a failed attempt
const RETRY_AFTER_MS = 30_000;

/**
 * Connect to MongoDB and ensure default demo users exist.
 *
 * CRITICAL: ensureDefaultUsers() is awaited INSIDE the connection promise
 * so that auto-seeding completes before any request handler can query the DB.
 * Previously, auto-seed ran as fire-and-forget in a .then() callback, which
 * caused a race condition on Vercel: the first login request could arrive
 * before default users were seeded, causing a 401 "Invalid credentials".
 */
export async function connectToDatabase() {
  if (!MONGODB_URI) return null;

  // Already connected — safe to return immediately because auto-seed
  // was already awaited when this promise was first created.
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  // Back-off: skip retry if last attempt failed recently
  if (cached.failedAt && Date.now() - cached.failedAt < RETRY_AFTER_MS) return null;

  if (!cached.promise) {
    cached.promise = (async () => {
      try {
        const m = await mongoose.connect(MONGODB_URI, {
          bufferCommands:          true,
          dbName:                  MONGODB_DB,
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS:         10000,
          socketTimeoutMS:          45000,
          directConnection:        false,
          family:                  4,   // force IPv4 — avoids IPv6 DNS issues
        });
        console.log('[MongoDB] connected');
        cached.failedAt = null;

        // ── CRITICAL: Await auto-seed BEFORE returning the connection ──
        // This ensures default admin/faculty/student users exist before
        // any request handler can query the database. Without this await,
        // the first login request on Vercel could arrive before seeding
        // completes, causing a 401 race condition.
        try {
          await ensureDefaultUsers();
        } catch (seedErr) {
          // Auto-seed failure is non-fatal — log and continue.
          // The app can still function if users were previously created.
          console.error('[AUTO-SEED] error during startup seed:', seedErr.message);
        }

        return m;
      } catch (err) {
        cached.promise  = null;
        cached.conn     = null;
        cached.failedAt = Date.now();
        console.warn('[MongoDB] connection failed:', err.message);
        console.warn('[MongoDB] running in demo/in-memory mode — check Atlas IP whitelist and network.');
        return null;
      }
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise  = null;
    cached.conn     = null;
    cached.failedAt = Date.now();
    console.warn('[MongoDB] await error:', e.message);
    return null;
  }

  return cached.conn;
}

export default connectToDatabase;
