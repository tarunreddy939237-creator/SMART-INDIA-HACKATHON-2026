/**
 * Security Audit Log
 *
 * Records important security events for monitoring and incident response.
 * In production, this should write to a persistent store (DB, file, or external service).
 * In development, logs to console for debugging.
 *
 * NEVER logs passwords, OTPs, tokens, or other secrets.
 */

const GLOBAL_KEY = '__EDUVISION_AUDIT_LOG__';

function getLogStore() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = [];
  }
  return globalThis[GLOBAL_KEY];
}

/**
 * Log a security event.
 * @param {object} event
 * @param {string} event.action - The action performed (e.g., 'LOGIN_SUCCESS', 'OTP_VERIFY_FAIL')
 * @param {string} event.actor - Who performed the action (email, userId, or IP)
 * @param {string} event.target - Target of the action (email, userId) if different from actor
 * @param {object} event.meta - Additional safe metadata (never include secrets)
 * @param {string} event.status - 'success', 'failure', 'warning'
 */
export function logSecurityEvent({ action, actor = 'system', target, meta = {}, status = 'success' }) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    actor,
    target: target || actor,
    status,
    meta: sanitizeMeta(meta),
  };

  // Always store in memory (for API access by admin)
  const store = getLogStore();
  store.push(entry);

  // Keep only last 500 entries in memory
  if (store.length > 500) {
    store.splice(0, store.length - 500);
  }

  // Console log in development
  if (process.env.NODE_ENV !== 'production') {
    const prefix = status === 'failure' ? '🔒⚠️' : status === 'warning' ? '🔒⚡' : '🔒✅';
    console.log(`${prefix} [AUDIT] ${action} | actor=${actor} | target=${target || '-'} | ${status}`);
  }

  return entry;
}

/**
 * Remove any sensitive fields from metadata before logging.
 */
function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const sanitized = { ...meta };
  const sensitiveKeys = ['password', 'passwordHash', 'otp', 'token', 'secret', 'apiKey', 'resetToken'];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Get recent audit log entries.
 * @param {object} opts
 * @param {number} opts.limit - Max entries to return
 * @param {string} opts.action - Filter by action type
 * @param {string} opts.status - Filter by status
 */
export function getAuditLog({ limit = 50, action, status } = {}) {
  const store = getLogStore();
  let filtered = [...store];

  if (action) filtered = filtered.filter(e => e.action === action);
  if (status) filtered = filtered.filter(e => e.status === status);

  return filtered.slice(-limit).reverse(); // Most recent first
}

// ── Convenience functions for common security events ─────────────────────

export const AuditActions = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGIN_BLOCKED: 'LOGIN_BLOCKED', // Account status prevents login
  OTP_SEND: 'OTP_SEND',
  OTP_VERIFY_SUCCESS: 'OTP_VERIFY_SUCCESS',
  OTP_VERIFY_FAILURE: 'OTP_VERIFY_FAILURE',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  REGISTRATION: 'REGISTRATION',
  ACCOUNT_APPROVED: 'ACCOUNT_APPROVED',
  ACCOUNT_REJECTED: 'ACCOUNT_REJECTED',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  ROLE_ESCALATION_ATTEMPT: 'ROLE_ESCALATION_ATTEMPT',
  IDOR_ATTEMPT: 'IDOR_ATTEMPT',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
  ADMIN_ACTION: 'ADMIN_ACTION',
};
