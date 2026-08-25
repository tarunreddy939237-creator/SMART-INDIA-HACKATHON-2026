import mongoose from 'mongoose';
import { ensureDefaultUsers } from './autoSeed.js';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB  = process.env.MONGODB_DB || 'eduvision';

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null, failedAt: null };

// Back-off: don't retry within 30 s of a failed attempt
const RETRY_AFTER_MS = 30_000;

export async function connectToDatabase() {
  if (!MONGODB_URI) return null;

  // Already connected
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  // Back-off: skip retry if last attempt failed recently
  if (cached.failedAt && Date.now() - cached.failedAt < RETRY_AFTER_MS) return null;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands:          true,
        dbName:                  MONGODB_DB,
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS:         10000,
        socketTimeoutMS:          45000,
        // Fallback to direct TCP if SRV DNS is blocked
        directConnection:        false,
        family:                  4,   // force IPv4 — avoids IPv6 DNS issues
      })
      .then((m) => {
        console.log('[MongoDB] connected');
        cached.failedAt = null;
        // Ensure default admin/faculty/student exist (idempotent, runs once)
        ensureDefaultUsers().catch(err =>
          console.error('[AUTO-SEED] background error:', err.message)
        );
        return m;
      })
      .catch((err) => {
        cached.promise  = null;
        cached.conn     = null;
        cached.failedAt = Date.now();
        console.warn('[MongoDB] connection failed:', err.message);
        console.warn('[MongoDB] running in demo/in-memory mode — check Atlas IP whitelist and network.');
        return null;
      });
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
