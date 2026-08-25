import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import College from '@/lib/models/College.js';
import { getUserByEmail } from '@/lib/queries.js';
import { verifyOTP } from '@/lib/otpStore.js';
import { normalizeCollegeName } from '@/lib/multiTenant.js';
import { buildRateLimit } from '@/lib/rateLimit.js';
import { logSecurityEvent, AuditActions } from '@/lib/auditLog.js';

/**
 * POST /api/otp/verify
 * Body: { email, otp, purpose, name?, password?, role?, ... }
 *
 * Verifies the OTP, then either:
 * - purpose='register': Creates the user account with status PENDING
 * - purpose='login': Validates account status and returns user data
 */
export async function POST(request) {
  // ── Rate limit: OTP verify (5 per 5 minutes per IP) ─────────────────
  const { result: rl } = buildRateLimit(request, 'otp-verify', {
    max: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many verification attempts. Please try again in ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[OTP VERIFY] Failed to parse request body:', parseError.message);
    }
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const {
    email, otp, purpose = 'register',
    name, password, role, classOrSubject,
    rollNumber, yearOfStudy, facultyId,
    collegeName, collegeId: providedCollegeId,
    department, branch, section,
  } = body;

  // ── Validate required fields ────────────────────────────────────────────
  if (!email || !otp) {
    return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const submittedOtp = String(otp).trim();

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP VERIFY] email=${normalizedEmail} otp_length=${submittedOtp.length} purpose=${purpose}`);
  }

  // ── Validate OTP format ─────────────────────────────────────────────────
  if (submittedOtp.length !== 6 || !/^\d{6}$/.test(submittedOtp)) {
    return NextResponse.json(
      { error: 'OTP must be exactly 6 digits.' },
      { status: 400 }
    );
  }

  // ── Verify OTP against persistent store ─────────────────────────────────
  const result = verifyOTP(normalizedEmail, submittedOtp);

  if (!result.valid) {
    let errorMessage;
    let statusCode = 400;

    switch (result.reason) {
      case 'NO_RECORD':
        errorMessage = 'No verification code found for this email. Please request a new code.';
        break;
      case 'EXPIRED':
        errorMessage = 'Verification code has expired. Please request a new code.';
        break;
      case 'MISMATCH':
        errorMessage = 'Incorrect verification code. Please check and try again.';
        break;
      case 'MAX_ATTEMPTS':
        errorMessage = 'Too many incorrect attempts. Please request a new code.';
        break;
      default:
        errorMessage = 'Verification failed. Please try again.';
    }

    logSecurityEvent({ action: AuditActions.OTP_VERIFY_FAILURE, actor: normalizedEmail, meta: { reason: result.reason }, status: 'failure' });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP VERIFY] FAILED email=${normalizedEmail} reason=${result.reason}`);
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }

  // ── OTP is valid — proceed with purpose ─────────────────────────────────

  // ── Registration flow ───────────────────────────────────────────────────
  if (purpose === 'register') {
    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password are required.' }, { status: 400 });
    }

    const allowedRoles = ['student', 'faculty', 'admin'];
    const userRole = allowedRoles.includes(role) ? role : 'student';
    const passwordHash = await bcrypt.hash(password, 12);

    // Student-specific validation
    const rollNum = userRole === 'student' ? String(rollNumber || '').trim() : '';
    const year = userRole === 'student' ? (parseInt(yearOfStudy) || 0) : 0;

    if (userRole === 'student') {
      if (!rollNum) {
        return NextResponse.json({ error: 'Roll number is required for students.' }, { status: 400 });
      }
      if (rollNum.length > 30) {
        return NextResponse.json({ error: 'Roll number is too long.' }, { status: 400 });
      }
      if (year < 1 || year > 4) {
        return NextResponse.json({ error: 'Please select your year of study (1st–4th Year).' }, { status: 400 });
      }
    }

    // Faculty-specific validation
    const facId = userRole === 'faculty' ? String(facultyId || '').trim() : '';
    if (userRole === 'faculty' && !facId) {
      return NextResponse.json({ error: 'Faculty ID / Employee ID is required.' }, { status: 400 });
    }

    const db = await connectToDatabase();
    if (db) {
      // Check for existing ACTIVE account with this email
      // A PENDING user with this email means a previous registration attempt — allow retry by updating
      const existingActive = await User.findOne({ email: normalizedEmail, accountStatus: { $in: ['active', 'suspended'] } });
      if (existingActive && existingActive.passwordHash) {
        return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });
      }

      // Check for existing PENDING user with this email (previous incomplete registration)
      const existingPending = await User.findOne({ email: normalizedEmail, accountStatus: 'pending' });

      // Resolve college
      let resolvedCollegeId = null;
      let resolvedCollegeName = '';

      if (providedCollegeId) {
        const college = await College.findById(providedCollegeId).lean();
        if (!college) {
          return NextResponse.json({ error: 'College not found.' }, { status: 404 });
        }
        resolvedCollegeId = college._id;
        resolvedCollegeName = college.name;
      } else if (collegeName && collegeName.trim()) {
        const normalizedName = normalizeCollegeName(collegeName.trim());
        let college = await College.findOne({ normalizedName });
        if (!college) {
          college = await College.create({
            name: collegeName.trim(),
            normalizedName,
            status: 'active',
          });
        }
        resolvedCollegeId = college._id;
        resolvedCollegeName = college.name;
      }

      // Duplicate roll number check — only block if an ACTIVE/SUSPENDED student already holds this roll number
      // PENDING or REJECTED registrations are NOT considered duplicates (they haven't been approved yet)
      if (rollNum) {
        const section = classOrSubject || 'CSE-A';
        const dupQuery = {
          rollNumber: rollNum,
          classOrSubject: section,
          role: 'student',
          accountStatus: { $in: ['active', 'suspended'] },
        };
        if (resolvedCollegeId) {
          dupQuery.collegeId = resolvedCollegeId;
        }
        const dup = await User.findOne(dupQuery);
        if (dup) {
          return NextResponse.json(
            { error: 'A student with this roll number already exists in this section.' },
            { status: 409 }
          );
        }

        // If there's a PENDING registration with the same roll+section, give a specific message
        const pendingDup = await User.findOne({
          rollNumber: rollNum,
          classOrSubject: section,
          role: 'student',
          accountStatus: 'pending',
          ...(resolvedCollegeId ? { collegeId: resolvedCollegeId } : {}),
        });
        if (pendingDup && pendingDup.email !== normalizedEmail) {
          return NextResponse.json(
            { error: 'A registration request for this roll number is already pending admin approval.' },
            { status: 409 }
          );
        }
      }

      // Duplicate faculty ID check — only block if an ACTIVE/SUSPENDED faculty already holds this ID
      if (facId) {
        const dupQuery = {
          facultyId: facId,
          role: 'faculty',
          accountStatus: { $in: ['active', 'suspended'] },
        };
        if (resolvedCollegeId) {
          dupQuery.collegeId = resolvedCollegeId;
        }
        const dup = await User.findOne(dupQuery);
        if (dup) {
          return NextResponse.json(
            { error: 'A faculty member with this ID already exists in this college.' },
            { status: 409 }
          );
        }
      }

      // Create or UPDATE user with PENDING status (NOT active — requires admin approval)
      let user;
      if (existingPending) {
        // Update the existing pending registration (retry scenario)
        existingPending.name = name.trim();
        existingPending.passwordHash = passwordHash;
        existingPending.classOrSubject = classOrSubject || existingPending.classOrSubject || 'CSE-A';
        existingPending.rollNumber = rollNum;
        existingPending.yearOfStudy = year;
        existingPending.facultyId = facId;
        existingPending.department = department?.trim() || '';
        existingPending.branch = branch?.trim() || '';
        existingPending.section = section?.trim() || '';
        existingPending.collegeId = resolvedCollegeId;
        existingPending.collegeName = resolvedCollegeName;
        existingPending.accountStatus = 'pending';
        existingPending.emailVerified = true;
        await existingPending.save();
        user = existingPending;
      } else {
        // Create new user
        user = await User.create({
          name: name.trim(),
          email: normalizedEmail,
          role: userRole,
          classOrSubject: classOrSubject || (userRole === 'student' ? 'CSE-A' : userRole === 'faculty' ? 'Digital Electronics' : 'Administration'),
          rollNumber: rollNum,
          yearOfStudy: year,
          facultyId: facId,
          department: department?.trim() || '',
          branch: branch?.trim() || '',
          section: section?.trim() || '',
          collegeId: resolvedCollegeId,
          collegeName: resolvedCollegeName,
          accountStatus: 'pending',
          emailVerified: true,
          passwordHash,
          faceEmbedding: [],
        });
      }

      logSecurityEvent({ action: AuditActions.OTP_VERIFY_SUCCESS, actor: normalizedEmail, meta: { purpose: 'register', role: userRole } });
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP VERIFY] USER ${existingPending ? 'UPDATED' : 'CREATED'} email=${normalizedEmail} id=${user._id} role=${userRole} status=pending`);
      }

      return NextResponse.json({
        success: true,
        message: 'Registration successful! Your account is pending College Admin approval. You will be notified once verified.',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          collegeName: user.collegeName,
        },
      }, { status: 201 });
    }

    // Demo/in-memory fallback
    return NextResponse.json({
      success: true,
      message: 'Demo mode: Account verified. Connect MongoDB to persist.',
      user: {
        id: 'demo-' + Date.now(),
        name: name.trim(),
        email: normalizedEmail,
        role: userRole,
        accountStatus: 'active',
      },
    }, { status: 201 });
  }

  // ── Login OTP flow ──────────────────────────────────────────────────────
  if (purpose === 'login') {
    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // Check account status
    if (user.accountStatus && user.accountStatus !== 'active') {
      const statusMessages = {
        pending: 'Your account is pending College Admin approval. Please wait for verification.',
        rejected: 'Your registration was rejected. Please contact your College Admin.',
        suspended: 'Your account has been suspended. Please contact support.',
        deactivated: 'Your account has been deactivated. Please contact support.',
      };
      const msg = statusMessages[user.accountStatus] || 'Your account is not active.';
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    logSecurityEvent({ action: AuditActions.LOGIN_SUCCESS, actor: normalizedEmail, meta: { method: 'otp', role: user.role } });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP VERIFY] LOGIN SUCCESS email=${normalizedEmail} role=${user.role}`);
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified.',
      user: {
        id: user._id?.toString() || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        classOrSubject: user.classOrSubject,
      },
    });
  }

  return NextResponse.json({ error: 'Unknown purpose.' }, { status: 400 });
}
