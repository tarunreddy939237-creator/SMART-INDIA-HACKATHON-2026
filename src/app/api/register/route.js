import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb.js';
import { getUserByEmail } from '@/lib/queries.js';
import User from '@/lib/models/User.js';
import College from '@/lib/models/College.js';
import { normalizeCollegeName } from '@/lib/multiTenant.js';
import { buildRateLimit } from '@/lib/rateLimit.js';

/**
 * Validate password strength.
 * Returns null if valid, or an error message string.
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 128) return 'Password is too long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  // Check for common weak passwords
  const weak = ['password1', 'password12', 'password123', '12345678', 'qwerty123', 'admin123'];
  if (weak.includes(password.toLowerCase())) return 'Please choose a stronger password.';
  return null;
}

/**
 * Sanitize a string input — trim, limit length, remove control characters.
 */
function sanitizeString(val, maxLen = 200) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * POST /api/register
 *
 * Rate limited: 5 registrations per 15 minutes per IP.
 * Always creates accounts as PENDING — requires admin approval.
 * Prevents role escalation (user cannot set role to admin/super_admin).
 */
export async function POST(request) {
  // ── Rate limit: registration ──────────────────────────────────────────
  const { result: rl } = buildRateLimit(request, 'register', {
    max: 5,
    windowMs: 15 * 60 * 1000, // 5 per 15 minutes
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Please try again in ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const {
      name, email, password, role, classOrSubject,
      rollNumber, yearOfStudy, facultyId,
      collegeName, collegeId: providedCollegeId,
      department, branch, section,
      studentMobile, parentMobile,
    } = body;

    // ── Validate required fields ─────────────────────────────────────────
    if (!name || !sanitizeString(name)) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // ── Password strength validation ─────────────────────────────────────
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // ── Role escalation prevention ───────────────────────────────────────
    // Only allow student or faculty self-registration. NEVER admin.
    const SAFE_ROLES = ['student', 'faculty'];
    const userRole = SAFE_ROLES.includes(role) ? role : 'student';

    // Student-specific validation
    if (userRole === 'student') {
      const rollNum = sanitizeString(rollNumber, 30);
      if (!rollNum) {
        return NextResponse.json({ error: 'Roll number is required for students.' }, { status: 400 });
      }
      const year = parseInt(yearOfStudy) || 0;
      if (year < 1 || year > 4) {
        return NextResponse.json({ error: 'Please select your year of study (1st–4th Year).' }, { status: 400 });
      }

      // ── Mobile number validation ──────────────────────────────────────
      const normalizedStudentMobile = (studentMobile || '').trim().replace(/\s+/g, '');
      const normalizedParentMobile = (parentMobile || '').trim().replace(/\s+/g, '');
      const indianMobileRegex = /^[6-9]\d{9}$/;

      if (!normalizedStudentMobile || !indianMobileRegex.test(normalizedStudentMobile)) {
        return NextResponse.json({ error: 'Please enter a valid 10-digit Indian student mobile number.' }, { status: 400 });
      }
      if (!normalizedParentMobile || !indianMobileRegex.test(normalizedParentMobile)) {
        return NextResponse.json({ error: 'Please enter a valid 10-digit Indian parent mobile number.' }, { status: 400 });
      }
      if (normalizedStudentMobile === normalizedParentMobile) {
        return NextResponse.json({ error: 'Student and Parent mobile numbers must be different.' }, { status: 400 });
      }
    }

    // Faculty-specific validation
    if (userRole === 'faculty') {
      const facId = sanitizeString(facultyId, 30);
      if (!facId) {
        return NextResponse.json({ error: 'Faculty ID / Employee ID is required.' }, { status: 400 });
      }
    }

    const db = await connectToDatabase();

    // ── Resolve college ──────────────────────────────────────────────────
    let resolvedCollegeId = null;
    let resolvedCollegeName = '';

    if (providedCollegeId) {
      const college = await College.findById(providedCollegeId).lean();
      if (!college) {
        return NextResponse.json({ error: 'College not found. Please register your college first.' }, { status: 404 });
      }
      if (college.status === 'suspended') {
        return NextResponse.json({ error: 'This college has been suspended.' }, { status: 403 });
      }
      resolvedCollegeId = college._id;
      resolvedCollegeName = college.name;
    } else if (collegeName && sanitizeString(collegeName)) {
      const normalizedName = normalizeCollegeName(collegeName.trim());
      let college = await College.findOne({ normalizedName });
      if (!college) {
        college = await College.create({ name: collegeName.trim(), normalizedName, status: 'active' });
      }
      if (college.status === 'suspended') {
        return NextResponse.json({ error: 'This college has been suspended.' }, { status: 403 });
      }
      resolvedCollegeId = college._id;
      resolvedCollegeName = college.name;
    }

    if (db) {
      const normalizedEmail = email.trim().toLowerCase();

      // Check if email already exists in MongoDB (only real accounts with passwordHash)
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser && existingUser.passwordHash) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        );
      }

      // Duplicate roll number check (scoped to same college + section)
      if (userRole === 'student' && rollNumber) {
        const rollNum = sanitizeString(rollNumber, 30);
        const section = classOrSubject || 'CSE-A';
        const dupQuery = { rollNumber: rollNum, classOrSubject: section, role: 'student' };
        if (resolvedCollegeId) dupQuery.collegeId = resolvedCollegeId;
        const dup = await User.findOne(dupQuery);
        if (dup) {
          return NextResponse.json(
            { error: 'A student with this roll number already exists in this section.' },
            { status: 409 }
          );
        }
      }

      // Duplicate faculty ID check (scoped to same college)
      if (userRole === 'faculty' && facultyId) {
        const facId = sanitizeString(facultyId, 30);
        const dupQuery = { facultyId: facId, role: 'faculty' };
        if (resolvedCollegeId) dupQuery.collegeId = resolvedCollegeId;
        const dup = await User.findOne(dupQuery);
        if (dup) {
          return NextResponse.json(
            { error: 'A faculty member with this ID already exists in this college.' },
            { status: 409 }
          );
        }
      }

      // ── Mobile number uniqueness checks (students only) ────────────
      let normStudentMobile = '';
      let normParentMobile = '';
      if (userRole === 'student' && studentMobile) {
        normStudentMobile = studentMobile.trim().replace(/\s+/g, '');
        normParentMobile = (parentMobile || '').trim().replace(/\s+/g, '');

        const dupStudentMobile = await User.findOne({ studentMobile: normStudentMobile });
        if (dupStudentMobile) {
          return NextResponse.json(
            { error: 'Student mobile number is already registered.' },
            { status: 409 }
          );
        }
        const dupParentMobile = await User.findOne({ parentMobile: normParentMobile });
        if (dupParentMobile) {
          return NextResponse.json(
            { error: 'Parent mobile number is already registered.' },
            { status: 409 }
          );
        }
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const rollNum = userRole === 'student' ? sanitizeString(rollNumber, 30) : '';
      const year = userRole === 'student' ? (parseInt(yearOfStudy) || 0) : 0;
      const facId = userRole === 'faculty' ? sanitizeString(facultyId, 30) : '';

      const newUser = await User.create({
        name: sanitizeString(name, 100),
        email: normalizedEmail,
        role: userRole,
        classOrSubject:
          classOrSubject ||
          (userRole === 'student' ? 'CSE-A' : userRole === 'faculty' ? 'Digital Electronics' : 'Administration'),
        rollNumber: rollNum,
        yearOfStudy: year,
        facultyId: facId,
        department: sanitizeString(department, 100),
        branch: sanitizeString(branch, 50),
        section: sanitizeString(section, 50),
        collegeId: resolvedCollegeId,
        collegeName: resolvedCollegeName,
        accountStatus: 'pending',
        emailVerified: false,
        passwordHash,
        faceEmbedding: [],
        studentMobile: normStudentMobile,
        studentMobileVerified: false,
        parentMobile: normParentMobile,
        parentMobileVerified: false,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Registration successful! Your account is pending College Admin approval.',
          user: {
            id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            accountStatus: newUser.accountStatus,
            collegeName: newUser.collegeName,
          },
        },
        { status: 201 }
      );
    } else {
      // MongoDB not available — demo mode
      const existing = await getUserByEmail(email.trim());
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Demo mode: Account registered in memory. Connect MongoDB to persist.',
          user: { id: 'demo-' + Date.now(), name: name.trim(), email: email.toLowerCase().trim(), role: userRole, accountStatus: 'active' },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    // Never expose internal errors
    if (process.env.NODE_ENV !== 'production') {
      console.error('[REGISTER] Error:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
