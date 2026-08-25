import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import { getAuthUser } from '@/lib/multiTenant.js';

/**
 * GET /api/admin/pending-count
 * Returns the count of pending account approvals.
 * Used by the admin sidebar badge.
 */
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ count: 0 });
    }

    const adminRoles = ['admin', 'college_admin', 'super_admin'];
    if (!adminRoles.includes(auth.user.role)) {
      return NextResponse.json({ count: 0 });
    }

    await connectToDatabase();

    const query = { accountStatus: 'pending' };

    // Scope to college for college_admin
    if (auth.user.role === 'college_admin' && auth.user.collegeId) {
      query.collegeId = auth.user.collegeId;
    }

    const count = await User.countDocuments(query);

    return NextResponse.json({ count });
  } catch (error) {
    console.error('[GET /api/admin/pending-count]', error.message);
    return NextResponse.json({ count: 0 });
  }
}
