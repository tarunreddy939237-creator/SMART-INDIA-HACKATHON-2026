import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import { sendResetEmail } from '@/lib/mailer.js';
import { buildRateLimit } from '@/lib/rateLimit.js';
import { logSecurityEvent, AuditActions } from '@/lib/auditLog.js';

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always returns generic response to prevent email enumeration.
 * Rate limited: 3 per 15 minutes per IP.
 */
export async function POST(request) {
  // Rate limit: password reset requests
  const { result: rl } = buildRateLimit(request, 'forgot-password', {
    max: 3,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'If an account exists for this email, a password reset link has been sent.' },
      { status: 429 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({
        message: 'If an account exists for this email, a password reset link has been sent.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    await connectToDatabase();

    const user = await User.findOne({ email: normalizedEmail }).lean();

    // Always return the same response to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists for this email, a password reset link has been sent.',
      });
    }

    // Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store hashed token with expiry (15 minutes) and mark as unused
    await User.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
          passwordResetUsed: false,
        },
      }
    );

    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    logSecurityEvent({ action: AuditActions.PASSWORD_RESET_REQUEST, actor: normalizedEmail });

    // Send email (non-blocking, don't fail the response if email fails)
    try {
      await sendResetEmail(normalizedEmail, user.name, resetUrl);
    } catch (emailErr) {
      console.warn('[forgot-password] Email send failed:', emailErr.message);
    }

    return NextResponse.json({
      message: 'If an account exists for this email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('[forgot-password] Error:', error);
    return NextResponse.json({
      message: 'If an account exists for this email, a password reset link has been sent.',
    });
  }
}
