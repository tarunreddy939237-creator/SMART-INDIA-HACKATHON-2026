import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AuditLog from '@/lib/models/AuditLog.js';
import { getAuthUser } from '@/lib/multiTenant.js';
import { sendAccountRejectedEmail } from '@/lib/mailer.js';
import { logSecurityEvent, AuditActions } from '@/lib/auditLog.js';

/**
 * POST /api/colleges/reject
 * Reject a pending user account.
 * Body: { userId, reason? }
 */
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = auth.user;

    // Only admin/college_admin/super_admin can reject
    const adminRoles = ['admin', 'college_admin', 'super_admin'];
    if (!adminRoles.includes(admin.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId, reason } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    await connectToDatabase();

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Verify college scope (college_admin only — admin and super_admin see all)
    if (admin.role === 'college_admin') {
      if (!admin.collegeId || !targetUser.collegeId) {
        return NextResponse.json({ error: 'College scope mismatch.' }, { status: 403 });
      }
      if (admin.collegeId.toString() !== targetUser.collegeId.toString()) {
        return NextResponse.json({ error: 'You can only reject users from your college.' }, { status: 403 });
      }
    }

    if (targetUser.accountStatus !== 'pending') {
      return NextResponse.json(
        { error: `User account is already ${targetUser.accountStatus}.` },
        { status: 400 }
      );
    }

    // Reject the account
    targetUser.accountStatus = 'rejected';
    targetUser.rejectionReason = reason?.trim() || '';
    await targetUser.save();

    // Log the action (DB audit)
    await AuditLog.create({
      actorId: admin._id,
      collegeId: targetUser.collegeId,
      action: 'account_rejected',
      targetUserId: targetUser._id,
      metadata: {
        userName: targetUser.name,
        userEmail: targetUser.email,
        userRole: targetUser.role,
        reason: reason?.trim() || '',
      },
    });
    logSecurityEvent({ action: AuditActions.ACCOUNT_REJECTED, actor: admin.email, target: targetUser.email, meta: { role: targetUser.role } });

    // Send rejection email (fire and forget)
    sendAccountRejectedEmail(targetUser.email, targetUser.name, reason?.trim() || '').catch(err =>
      console.error('[Reject] Failed to send rejection email:', err.message)
    );

    return NextResponse.json({
      success: true,
      message: `${targetUser.name}'s account has been rejected.`,
    });
  } catch (error) {
    console.error('[POST /api/colleges/reject]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
