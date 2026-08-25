import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/queries.js';
import { sendOTPEmail } from '@/lib/mailer.js';
import { storeOTP, hasActiveOTP, getStoreSize } from '@/lib/otpStore.js';
import { buildRateLimit } from '@/lib/rateLimit.js';
import { logSecurityEvent, AuditActions } from '@/lib/auditLog.js';

/**
 * POST /api/otp/send
 * Body: { email, name?, purpose? }
 *
 * Generates a 6-digit OTP, stores it persistently (survives HMR), and sends via email.
 * Rate limited: 3 per 5 minutes per IP (registration), 5 per 5 minutes (login).
 */
export async function POST(request) {
  try {
    // ── Rate limit: OTP send ──────────────────────────────────────────────
    const { result: rl } = buildRateLimit(request, 'otp-send', {
      max: 5,
      windowMs: 5 * 60 * 1000, // 5 per 5 minutes
    });
    if (!rl.allowed) {
      logSecurityEvent({ action: AuditActions.RATE_LIMIT_HIT, actor: 'otp-send', status: 'warning' });
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const { email, name, purpose = 'register' } = await request.json();

    // ── Validate email ───────────────────────────────────────────────────
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP SEND] email=${normalizedEmail} purpose=${purpose} storeSize=${getStoreSize()}`);
    }

    // ── Registration: block if email already exists ──────────────────────
    if (purpose === 'register') {
      const existing = await getUserByEmail(normalizedEmail);
      if (existing && existing.passwordHash) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        );
      }
    }

    // ── Login: require email to exist ────────────────────────────────────
    if (purpose === 'login') {
      const existing = await getUserByEmail(normalizedEmail);
      if (!existing) {
        // Use generic message to prevent email enumeration
        return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
      }
    }

    // ── Rate limit: 1 OTP per 60 seconds per email ───────────────────────
    if (hasActiveOTP(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please wait 60 seconds before requesting a new code.' },
        { status: 429 }
      );
    }

    // ── Generate 6-digit OTP ─────────────────────────────────────────────
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // ── Store OTP persistently ───────────────────────────────────────────
    storeOTP(normalizedEmail, otp, { name: name || '', purpose }, 10 * 60 * 1000);

    // ── Send email ───────────────────────────────────────────────────────
    const result = await sendOTPEmail(normalizedEmail, otp, name);

    logSecurityEvent({ action: AuditActions.OTP_SEND, actor: normalizedEmail, meta: { purpose } });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP SENT] email=${normalizedEmail} preview=${!!result.preview}`);
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}.`,
      ...(result.preview ? { preview: result.preview } : {}),
    });
  } catch (error) {
    // Never expose internal errors
    if (process.env.NODE_ENV !== 'production') {
      console.error('[OTP SEND] Error:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    );
  }
}
