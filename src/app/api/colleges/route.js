import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb.js';
import College from '@/lib/models/College.js';
import { normalizeCollegeName } from '@/lib/multiTenant.js';
import { getAuthUser } from '@/lib/multiTenant.js';

/**
 * GET /api/colleges
 * - Super Admin: list all colleges
 * - College Admin: get own college
 * - Student/Faculty: get own college info
 */
export async function GET(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectToDatabase();
    const user = auth.user;

    // Super Admin sees all colleges
    if (user.role === 'super_admin') {
      const colleges = await College.find({}).sort({ createdAt: -1 }).lean();
      return NextResponse.json({ colleges });
    }

    // Everyone else sees their own college
    if (!user.collegeId) {
      return NextResponse.json({ college: null });
    }

    const college = await College.findById(user.collegeId).lean();
    return NextResponse.json({ college });
  } catch (error) {
    console.error('[GET /api/colleges]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/colleges
 * Register a new college. Anyone can register; the creator becomes the college admin.
 * Body: { name, shortName?, domain? }
 */
export async function POST(request) {
  try {
    const auth = await getAuthUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { name, shortName, domain } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'College name is required.' }, { status: 400 });
    }

    if (name.trim().length < 3) {
      return NextResponse.json({ error: 'College name must be at least 3 characters.' }, { status: 400 });
    }

    if (name.trim().length > 200) {
      return NextResponse.json({ error: 'College name is too long.' }, { status: 400 });
    }

    await connectToDatabase();

    // Check for duplicate normalized name
    const normalizedName = normalizeCollegeName(name.trim());
    const existing = await College.findOne({ normalizedName });
    if (existing) {
      return NextResponse.json(
        { error: 'A college with this name already exists.', collegeId: existing._id.toString() },
        { status: 409 }
      );
    }

    // Create college
    const college = await College.create({
      name: name.trim(),
      normalizedName,
      shortName: shortName?.trim() || '',
      domain: domain?.trim() || '',
      adminId: null, // Will be set when college admin is assigned
    });

    return NextResponse.json(
      {
        success: true,
        message: 'College registered successfully.',
        college: {
          id: college._id.toString(),
          name: college.name,
          normalizedName: college.normalizedName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/colleges]', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
