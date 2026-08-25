import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb.js';
import College from '@/lib/models/College.js';
import CollegeAdmin from '@/lib/models/CollegeAdmin.js';
import User from '@/lib/models/User.js';
import AuditLog from '@/lib/models/AuditLog.js';
import { getAuthUser, normalizeCollegeName } from '@/lib/multiTenant.js';

/**
 * GET /api/colleges/super-admin
 * Super Admin: list all colleges with stats
 */
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const query = {};
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      query.$or = [{ name: regex }, { normalizedName: regex }];
    }

    const colleges = await College.find(query).sort({ createdAt: -1 }).lean();

    // Get stats for each college
    const collegesWithStats = await Promise.all(
      colleges.map(async (college) => {
        const [studentCount, facultyCount, pendingCount] = await Promise.all([
          User.countDocuments({ collegeId: college._id, role: 'student' }),
          User.countDocuments({ collegeId: college._id, role: 'faculty' }),
          User.countDocuments({ collegeId: college._id, accountStatus: 'pending' }),
        ]);

        // Get admin info
        let adminInfo = null;
        if (college.adminId) {
          adminInfo = await User.findById(college.adminId)
            .select('name email')
            .lean();
        }

        return {
          ...college,
          stats: { studentCount, facultyCount, pendingCount },
          admin: adminInfo,
        };
      })
    );

    return NextResponse.json({ colleges: collegesWithStats });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[GET /api/colleges/super-admin]', error.message);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

/**
 * POST /api/colleges/super-admin
 * Super Admin: Assign a college admin
 * Body: { userId, collegeId }
 */
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { userId, collegeId } = await request.json();

    if (!userId || !collegeId) {
      return NextResponse.json({ error: 'User ID and College ID are required.' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const college = await College.findById(collegeId);
    if (!college) {
      return NextResponse.json({ error: 'College not found.' }, { status: 404 });
    }

    // Update user role and college association
    user.role = 'college_admin';
    user.collegeId = collegeId;
    user.accountStatus = 'active';
    user.approvedBy = auth.user._id;
    user.approvedAt = new Date();
    await user.save();

    // Update college admin reference
    college.adminId = userId;
    await college.save();

    // Create/Update CollegeAdmin record
    await CollegeAdmin.findOneAndUpdate(
      { collegeId },
      { userId, collegeId, role: 'college_admin' },
      { upsert: true }
    );

    // Log the action
    await AuditLog.create({
      actorId: auth.user._id,
      collegeId,
      action: 'admin_assigned',
      targetUserId: userId,
      metadata: { userName: user.name, userEmail: user.email, collegeName: college.name },
    });

    return NextResponse.json({
      success: true,
      message: `${user.name} has been assigned as admin for ${college.name}.`,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[POST /api/colleges/super-admin]', error.message);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
