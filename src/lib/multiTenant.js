import { getServerSession } from 'next-auth';
import { authOptions } from './auth.js';
import connectToDatabase from './mongodb.js';
import User from './models/User.js';
import { DEMO_USERS } from './seed-data.js';

/**
 * Get the authenticated user and their full DB record.
 * Returns { session, user, error, status }
 * If error is set, the caller should return the error response.
 *
 * Handles both real DB users AND demo/seed users that only exist in memory.
 */
export async function getAuthUser(request) {
  // Do NOT pass request — App Router's Request is a Web API object, not Node.js IncomingMessage.
  // getServerSession(authOptions) reads cookies from the async context automatically.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { session: null, user: null, error: 'Unauthorized', status: 401 };
  }

  await connectToDatabase();

  // Try DB lookup first
  let user = null;
  try {
    user = await User.findById(session.user.id).lean();
  } catch (e) {
    // Invalid ObjectId format — fall through to demo lookup
  }

  // If not in DB, check demo/seed users
  if (!user) {
    const demoUser = DEMO_USERS.find(u => String(u._id) === String(session.user.id));
    if (demoUser) {
      // Construct a user object matching the DB shape from the demo data
      user = {
        _id: demoUser._id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        classOrSubject: demoUser.classOrSubject || '',
        rollNumber: demoUser.rollNumber || '',
        yearOfStudy: demoUser.yearOfStudy || 0,
        subjects: demoUser.subjects || [],
        collegeId: null,
        collegeName: '',
        accountStatus: 'active',
        emailVerified: true,
        department: '',
        branch: '',
        section: '',
      };
    }
  }

  if (!user) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[getAuthUser] User not found: id=${session.user.id} email=${session.user.email}`);
    }
    return { session, user: null, error: 'User not found', status: 404 };
  }

  return { session, user, error: null, status: 200 };
}

/**
 * Verify the user has a collegeId and the college is active.
 */
export async function requireCollege(request) {
  const auth = await getAuthUser(request);
  if (auth.error) return auth;
  if (!auth.user.collegeId) {
    return { ...auth, error: 'No college associated with your account', status: 403 };
  }
  return auth;
}

/**
 * Verify the user's account is ACTIVE.
 */
export async function requireActiveAccount(request) {
  const auth = await getAuthUser(request);
  if (auth.error) return auth;
  if (auth.user.accountStatus !== 'active') {
    return {
      ...auth,
      error: `Account is ${auth.user.accountStatus}. Please contact your College Admin.`,
      status: 403,
    };
  }
  return auth;
}

/**
 * Verify the user is a College Admin or Super Admin for a given college.
 */
export async function requireCollegeAdmin(request, targetCollegeId) {
  const auth = await getAuthUser(request);
  if (auth.error) return auth;

  const user = auth.user;

  // Super admins can access any college
  if (user.role === 'super_admin') return auth;

  // College admins can only access their own college
  if (user.role === 'college_admin' && user.collegeId?.toString() === targetCollegeId) {
    return auth;
  }

  return { ...auth, error: 'Not authorized for this college', status: 403 };
}

/**
 * Verify the user is a Super Admin.
 */
export async function requireSuperAdmin(request) {
  const auth = await getAuthUser(request);
  if (auth.error) return auth;
  if (auth.user.role !== 'super_admin') {
    return { ...auth, error: 'Super Admin access required', status: 403 };
  }
  return auth;
}

/**
 * Filter a Mongoose query to only return records belonging to the user's college.
 */
export function collegeScope(query, user) {
  if (user.role === 'super_admin') return query;
  if (user.collegeId) {
    return query.where({ collegeId: user.collegeId });
  }
  return query.where({ _id: null }); // No college = no results
}

/**
 * Generate a normalizedName for fuzzy college matching.
 */
export function normalizeCollegeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.\-_,]/g, '')
    .replace(/\b(inst(itution)?|institute|of|technology|college|university|engineering|autonomous)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
