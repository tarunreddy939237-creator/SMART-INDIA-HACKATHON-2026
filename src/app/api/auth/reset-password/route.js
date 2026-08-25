import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import { logSecurityEvent, AuditActions } from '@/lib/auditLog.js';

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 *
 * Validates the reset token and sets a new password.
 */
export async function POST(request) {
  try {
    const { token, password } = await request.json();

    // Validate input
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid reset link.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    // Password strength validation
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least one uppercase letter.' }, { status: 400 });
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least one lowercase letter.' }, { status: 400 });
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least one number.' }, { status: 400 });
    }

    await connectToDatabase();

    // Hash the token to match what's stored
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetUsed: false,
      passwordResetExpires: { $gt: new Date() },
    }).lean();

    if (!user) {
      return NextResponse.json({ error: 'This password reset link is invalid or has expired.' }, { status: 400 });
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and invalidate the reset token
    await User.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          passwordResetUsed: true,
        },
      }
    );

    logSecurityEvent({ action: AuditActions.PASSWORD_RESET_COMPLETE, actor: normalizedEmail });
    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('[reset-password] Error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

/**
 * GET /api/auth/reset-password?token=<token>
 * Validates whether a token is still valid (for UI display).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'No token provided.' });
    }

    await connectToDatabase();

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetUsed: false,
      passwordResetExpires: { $gt: new Date() },
    }).lean();

    return NextResponse.json({
      valid: !!user,
      error: user ? null : 'This password reset link is invalid or has expired.',
    });
  } catch (error) {
    return NextResponse.json({ valid: false, error: 'Unable to verify reset link.' });
  }
}
