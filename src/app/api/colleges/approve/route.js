import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import College from '@/lib/models/College.js';
import AuditLog from '@/lib/models/AuditLog.js';
import { getAuthUser } from '@/lib/multiTenant.js';
import { sendAccountApprovedEmail } from '@/lib/mailer.js';
import { logSecurityEvent, AuditActions } from '@/lib/auditLog.js';

/**
 * POST /api/colleges/approve
 * Approve a pending user account.
 * Body: { userId }
 */
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = auth.user;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[APPROVE] admin=${admin._id} role=${admin.role} email=${admin.email}`);
    }

    // Only admin/college_admin/super_admin can approve
    const adminRoles = ['admin', 'college_admin', 'super_admin'];
    if (!adminRoles.includes(admin.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    await connectToDatabase();

    // Find the target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Verify the target user belongs to the admin's college (unless super_admin or default admin)
    if (admin.role === 'college_admin') {
      if (!admin.collegeId || !targetUser.collegeId) {
        return NextResponse.json({ error: 'College scope mismatch.' }, { status: 403 });
      }
      if (admin.collegeId.toString() !== targetUser.collegeId.toString()) {
        return NextResponse.json({ error: 'You can only approve users from your college.' }, { status: 403 });
      }
    }

    // Check if user is actually pending
    if (targetUser.accountStatus !== 'pending') {
      return NextResponse.json(
        { error: `User account is already ${targetUser.accountStatus}.` },
        { status: 400 }
      );
    }

    // Approve the account
    targetUser.accountStatus = 'active';
    targetUser.approvedBy = admin._id;
    targetUser.approvedAt = new Date();
    targetUser.emailVerified = true;
    await targetUser.save();

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[APPROVE] APPROVED userId=${targetUser._id} email=${targetUser.email} name=${targetUser.name} status=active`);
    }

    // Log the action (DB audit)
    await AuditLog.create({
      actorId: admin._id,
      collegeId: targetUser.collegeId,
      action: 'account_approved',
      targetUserId: targetUser._id,
      metadata: {
        userName: targetUser.name,
        userEmail: targetUser.email,
        userRole: targetUser.role,
      },
    });
    logSecurityEvent({ action: AuditActions.ACCOUNT_APPROVED, actor: admin.email, target: targetUser.email, meta: { role: targetUser.role } });

    // Send approval email (fire and forget — don't block the response)
    sendAccountApprovedEmail(targetUser.email, targetUser.name).catch(err =>
      console.error('[Approve] Failed to send approval email:', err.message)
    );

    // If this is the first college admin being approved, set them as the college admin
    if (targetUser.role === 'college_admin' && !admin.collegeId) {
      const college = await College.findById(targetUser.collegeId);
      if (college && !college.adminId) {
        college.adminId = targetUser._id;
        await college.save();
      }
    }

    return NextResponse.json({
      success: true,
      message: `${targetUser.name}'s account has been approved.`,
      user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        accountStatus: 'active',
      },
    });
  } catch (error) {
    console.error('[POST /api/colleges/approve]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
