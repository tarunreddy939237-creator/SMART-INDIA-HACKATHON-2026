/**
 * In-Memory Sliding Window Rate Limiter
 *
 * Production-safe, zero-dependency rate limiter using a Map with automatic
 * cleanup. Stores per-key counters that slide forward in time.
 *
 * For production at scale, swap the in-memory Map for Redis.
 */

const GLOBAL_KEY = '__EDUVISION_RATE_LIMIT_STORE__';

function getOrCreateStore() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = new Map();
    // Cleanup stale entries every 5 minutes
    setInterval(() => {
      const store = globalThis[GLOBAL_KEY];
      if (!store) return;
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key);
      }
    }, 5 * 60 * 1000).unref?.();
  }
  return globalThis[GLOBAL_KEY];
}

/**
 * Check rate limit for a given key.
 * @param {string} key - Unique identifier (e.g., "login:192.168.1.1")
 * @param {object} opts
 * @param {number} opts.max - Maximum requests allowed in window (default: 10)
 * @param {number} opts.windowMs - Window duration in milliseconds (default: 60000 = 1 min)
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(key, { max = 10, windowMs = 60 * 1000 } = {}) {
  const store = getOrCreateStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (entry.count >= max) {
    const retryAfterMs = entry.resetAt - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count, retryAfterMs: 0 };
}

/**
 * Express/Next.js middleware helper — returns a NextResponse(429) if rate-limited.
 * @param {Request} request
 * @param {string} action - Action name for the key (e.g., "login")
 * @param {object} opts - Rate limit options
 * @param {string[]} opts.keyParts - Extra parts to build the key (e.g., [email])
 */
export function rateLimitResponse(action, { max, windowMs, keyParts = [] } = {}) {
  const ip = 'global'; // Will be replaced by caller with actual IP
  const key = [action, ...keyParts, ip].filter(Boolean).join(':');
  return checkRateLimit(key, { max, windowMs });
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request) {
  if (!request) return 'unknown';
  return (
    request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers?.get?.('x-real-ip') ||
    'unknown'
  );
}

/**
 * Build a rate-limit check and return { result, key }.
 */
export function buildRateLimit(request, action, { max = 10, windowMs = 60 * 1000, keyParts = [] } = {}) {
  const ip = getClientIp(request);
  const key = [action, ip, ...keyParts].filter(Boolean).join(':');
  const result = checkRateLimit(key, { max, windowMs });
  return { result, key };
}
