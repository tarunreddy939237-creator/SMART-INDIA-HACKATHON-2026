import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AuditLog from '@/lib/models/AuditLog.js';
import { getAuthUser } from '@/lib/multiTenant.js';
import { sendAccountApprovedEmail } from '@/lib/mailer.js';

/**
 * POST /api/colleges/bulk-approve
 * Approve multiple pending accounts at once.
 * Body: { userIds: string[] }
 */
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = auth.user;

    if (admin.role !== 'college_admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userIds } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'User IDs array is required.' }, { status: 400 });
    }

    if (userIds.length > 100) {
      return NextResponse.json({ error: 'Cannot approve more than 100 accounts at once.' }, { status: 400 });
    }

    await connectToDatabase();

    const results = { approved: 0, skipped: 0, errors: 0 };

    for (const userId of userIds) {
      try {
        const targetUser = await User.findById(userId);
        if (!targetUser || targetUser.accountStatus !== 'pending') {
          results.skipped++;
          continue;
        }

        // Verify college scope
        if (admin.role === 'college_admin') {
          if (!admin.collegeId?.equals(targetUser.collegeId)) {
            results.errors++;
            continue;
          }
        }

        targetUser.accountStatus = 'active';
        targetUser.approvedBy = admin._id;
        targetUser.approvedAt = new Date();
        targetUser.emailVerified = true;
        await targetUser.save();

        await AuditLog.create({
          actorId: admin._id,
          collegeId: targetUser.collegeId,
          action: 'account_approved',
          targetUserId: targetUser._id,
          metadata: { userName: targetUser.name, userEmail: targetUser.email },
        });

        // Send approval email (fire and forget)
        sendAccountApprovedEmail(targetUser.email, targetUser.name).catch(() => {});

        results.approved++;
      } catch {
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.approved} accounts approved, ${results.skipped} skipped, ${results.errors} errors.`,
      results,
    });
  } catch (error) {
    console.error('[POST /api/colleges/bulk-approve]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
