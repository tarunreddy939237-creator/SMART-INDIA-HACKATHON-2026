/**
 * Persistent OTP Store — survives Next.js HMR / module reloads.
 *
 * Uses a global variable attached to `globalThis` so that even when
 * Turbopack/webpack hot-reloads individual route modules, the store
 * reference stays the same across all modules that import it.
 *
 * The Map itself is in-memory (no external dependency needed for dev).
 * In production you'd swap this for Redis or a DB collection.
 */

const GLOBAL_KEY = '__EDUVISION_OTP_STORE__';

function getOrCreateStore() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = new Map();
  }
  return globalThis[GLOBAL_KEY];
}

/**
 * Get the shared OTP store singleton.
 * Always returns the SAME Map instance regardless of which module imports it.
 */
export function getOTPStore() {
  return getOrCreateStore();
}

/**
 * Store an OTP for a given email.
 * @param {string} email - Normalized email (lowercase, trimmed)
 * @param {string} otp - 6-digit OTP string
 * @param {object} meta - Extra metadata (name, purpose, etc.)
 * @param {number} ttlMs - Time-to-live in milliseconds (default: 10 minutes)
 */
export function storeOTP(email, otp, meta = {}, ttlMs = 10 * 60 * 1000) {
  const store = getOrCreateStore();
  const record = {
    otp,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
    maxAttempts: 5,
    ...meta,
  };
  store.set(email, record);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP STORE] SET email=${email} otp=*** expires=${new Date(record.expiresAt).toISOString()} purpose=${meta.purpose || 'unknown'}`);
  }

  return record;
}

/**
 * Retrieve and validate an OTP.
 * Returns { valid: true, record } or { valid: false, reason }.
 */
export function verifyOTP(email, submittedOtp) {
  const store = getOrCreateStore();
  const record = store.get(email);

  if (!record) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP VERIFY] FAIL email=${email} reason=NO_RECORD (store has ${store.size} entries)`);
    }
    return { valid: false, reason: 'NO_RECORD' };
  }

  // Check expiration
  if (Date.now() > record.expiresAt) {
    store.delete(email);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP VERIFY] FAIL email=${email} reason=EXPIRED stored=${record.otp} now=${Date.now()} expires=${record.expiresAt}`);
    }
    return { valid: false, reason: 'EXPIRED' };
  }

  // Check max attempts
  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > record.maxAttempts) {
    store.delete(email);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP VERIFY] FAIL email=${email} reason=MAX_ATTEMPTS attempts=${record.attempts}`);
    }
    return { valid: false, reason: 'MAX_ATTEMPTS' };
  }

  // Compare OTPs as trimmed strings (preserves leading zeros)
  const storedOtp = String(record.otp).trim();
  const submittedNormalized = String(submittedOtp || '').trim();

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP VERIFY] CHECK email=${email} stored="${storedOtp}" submitted="${submittedNormalized}" match=${storedOtp === submittedNormalized} attempts=${record.attempts}/${record.maxAttempts}`);
  }

  if (storedOtp !== submittedNormalized) {
    return { valid: false, reason: 'MISMATCH' };
  }

  // OTP is valid — consume it
  store.delete(email);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP VERIFY] SUCCESS email=${email} purpose=${record.purpose} age=${Date.now() - record.createdAt}ms`);
  }

  return { valid: true, record };
}

/**
 * Invalidate (delete) any existing OTP for an email.
 */
export function invalidateOTP(email) {
  const store = getOrCreateStore();
  const existed = store.delete(email);
  if (process.env.NODE_ENV !== 'production' && existed) {
    console.log(`[OTP STORE] DELETE email=${email}`);
  }
}

/**
 * Check if an OTP exists and is still valid (for rate-limiting).
 */
export function hasActiveOTP(email) {
  const store = getOrCreateStore();
  const record = store.get(email);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    store.delete(email);
    return false;
  }
  return true;
}

/**
 * Get store size (for debugging).
 */
export function getStoreSize() {
  return getOrCreateStore().size;
}
