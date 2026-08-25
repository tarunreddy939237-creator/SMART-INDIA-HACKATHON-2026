import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import { getAuthUser } from '@/lib/multiTenant.js';

/**
 * GET /api/colleges/pending
 * Returns pending accounts for the admin.
 * Query params: role=student|faculty, page=1, limit=50, search=term, status=pending|all
 */
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PENDING API] auth.error=${auth.error} auth.status=${auth.status} auth.user=${auth.user ? `${auth.user._id} role=${auth.user.role}` : 'null'}`);
    }

    if (auth.error) {
      return NextResponse.json({ error: auth.error, users: [], total: 0 }, { status: auth.status });
    }

    const user = auth.user;

    // Only admin/college_admin/super_admin can view pending accounts
    const adminRoles = ['admin', 'college_admin', 'super_admin'];
    if (!adminRoles.includes(user.role)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[PENDING API] REJECTED role=${user.role} (not in adminRoles)`);
      }
      return NextResponse.json({ error: 'Admin access required', users: [], total: 0 }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role') || '';
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (statusFilter === 'all') {
      // Show all non-demo users
      query.accountStatus = { $in: ['pending', 'active', 'rejected'] };
    } else {
      query.accountStatus = statusFilter;
    }

    // Scope to college (only college_admin — admin and super_admin see ALL)
    if (user.role === 'college_admin' && user.collegeId) {
      query.collegeId = user.collegeId;
    }

    // Filter by role
    if (roleFilter && ['student', 'faculty'].includes(roleFilter)) {
      query.role = roleFilter;
    }

    // Search by name, email, roll number
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { rollNumber: searchRegex },
        { facultyId: searchRegex },
      ];
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PENDING API] QUERY status=${statusFilter} role=${roleFilter || 'all'} search=${search || 'none'} query=${JSON.stringify(query)}`);
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email role collegeName rollNumber facultyId department branch section yearOfStudy createdAt accountStatus classOrSubject emailVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PENDING API] RESULT total=${total} returned=${users.length} users=${users.map(u => `${u.name}(${u.accountStatus})`).join(', ') || 'NONE'}`);
    }

    return NextResponse.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[GET /api/colleges/pending] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error', users: [], total: 0 }, { status: 500 });
  }
}
