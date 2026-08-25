import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getUser } from './queries.js';
import { DEMO_USERS } from './seed-data.js';

/**
 * Validate password strength. Used during password reset and password change.
 */
function isPasswordStrong(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (password.length > 128) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

/**
 * Sanitize email input.
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Safe diagnostic log — never log passwords, hashes, tokens, or secrets.
 * Logs only the step identifier and email domain for tracing the auth flow.
 */
function authLog(step, email) {
  const domain = email ? email.split('@')[1] || 'unknown' : 'unknown';
  console.log(`[AUTH_TRACE] ${step} domain=${domain}`);
}

export const authOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (reduced from 30 for security)
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'student@eduvision.ai' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // ── STEP 1: Validate credentials exist ────────────────────────────
        if (!credentials?.email || !credentials?.password) {
          authLog('STEP1_FAIL_no_credentials');
          throw new Error('Please enter both email and password.');
        }

        const email = normalizeEmail(credentials.email);
        authLog('STEP2_email_normalized', email);

        // ── Input length validation ────────────────────────────────────────
        if (email.length > 254) {
          authLog('STEP3_FAIL_email_too_long', email);
          throw new Error('Invalid email address.');
        }

        // OTP-verified login — password field carries the verified signal
        if (String(credentials.password).startsWith('OTP_VERIFIED_')) {
          authLog('STEP4_otp_path', email);
          let user = await getUserByEmail(email);
          if (!user) {
            const demoMatch = DEMO_USERS.find(u => u.email.toLowerCase() === email);
            if (demoMatch) user = demoMatch;
          }
          if (!user) {
            authLog('STEP4_FAIL_no_user_otp', email);
            throw new Error('Account not found.');
          }

          // Enforce account status for non-demo users
          if (user.accountStatus && user.accountStatus !== 'active' && !user._id?.toString().startsWith('demo')) {
            authLog(`STEP4_FAIL_status_${user.accountStatus}`, email);
            const statusMessages = {
              pending: 'Your account is pending College Admin approval. Please wait for verification.',
              rejected: 'Your registration was rejected. Please contact your College Admin.',
              suspended: 'Your account has been suspended. Please contact support.',
              deactivated: 'Your account has been deactivated. Please contact support.',
            };
            throw new Error(statusMessages[user.accountStatus] || 'Your account is not active.');
          }

          authLog('STEP4_SUCCESS_otp', email);
          return {
            id: user._id?.toString ? user._id.toString() : user._id,
            name: user.name, email: user.email,
            role: user.role, classOrSubject: user.classOrSubject,
            subjects: user.subjects || [],
            rollNumber: user.rollNumber || '',
            yearOfStudy: user.yearOfStudy || 0,
            collegeId: user.collegeId?.toString?.() || user.collegeId || '',
            collegeName: user.collegeName || '',
            accountStatus: user.accountStatus || 'active',
            department: user.department || '',
            branch: user.branch || '',
            section: user.section || '',
          };
        }

        // ── STEP 5: Look up user in database ──────────────────────────────
        authLog('STEP5_looking_up_user', email);
        let user = await getUserByEmail(email);

        if (!user) {
          // ── STEP 5A: User not found ───────────────────────────────────
          authLog('STEP5A_FAIL_user_not_found', email);

          // Fallback for immediate demo testing — disabled in production
          if (process.env.NODE_ENV !== 'production') {
            const demoMatch = DEMO_USERS.find((u) => u.email.toLowerCase() === email);
            if (demoMatch && credentials.password === 'password123') {
              authLog('STEP5A_dev_demo_fallback', email);
              return {
                id: demoMatch._id,
                name: demoMatch.name,
                email: demoMatch.email,
                role: demoMatch.role,
                classOrSubject: demoMatch.classOrSubject,
                subjects: demoMatch.subjects || [],
                rollNumber: demoMatch.rollNumber || '',
                yearOfStudy: demoMatch.yearOfStudy || 0,
                collegeId: '',
                collegeName: '',
                accountStatus: 'active',
                department: '',
                branch: '',
                section: '',
              };
            }
          }

          // ── THIS IS THE PRODUCTION FAILURE POINT ────────────────────────
          // In production: user is null → no demo fallback → falls through
          // to line below where `user.passwordHash` CRASHES (TypeError on null).
          // NextAuth catches this as 401.
          authLog('STEP5A_RETURN_NULL_NO_USER', email);
          return null;
        }

        authLog(`STEP5B_user_found status=${user.accountStatus} hasHash=${!!user.passwordHash}`, email);

        // ── STEP 6: Password verification ─────────────────────────────────
        if (user.passwordHash) {
          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          authLog(`STEP6_password_comparison result=${isValid}`, email);

          if (!isValid) {
            // Demo fallback: only in development, never in production
            if (process.env.NODE_ENV === 'production' || credentials.password !== 'password123') {
              authLog('STEP6_FAIL_wrong_password', email);
              throw new Error('Invalid email or password.');
            }
            authLog('STEP6_dev_password123_fallback', email);
          }
        } else {
          // User has no password hash (registered via OTP only, not activated)
          authLog('STEP6_FAIL_no_password_hash', email);
          if (process.env.NODE_ENV === 'production' || credentials.password !== 'password123') {
            throw new Error('Invalid email or password.');
          }
        }

        // ── STEP 7: Account status check ──────────────────────────────────
        if (user.accountStatus && user.accountStatus !== 'active' && !user._id?.toString().startsWith('demo')) {
          authLog(`STEP7_FAIL_account_status_${user.accountStatus}`, email);
          const statusMessages = {
            pending: 'Your account is pending College Admin approval. Please wait for verification.',
            rejected: 'Your registration was rejected. Please contact your College Admin.',
            suspended: 'Your account has been suspended. Please contact support.',
            deactivated: 'Your account has been deactivated. Please contact support.',
          };
          throw new Error(statusMessages[user.accountStatus] || 'Your account is not active.');
        }

        // ── STEP 8: SUCCESS — return authenticated user ────────────────────
        authLog(`STEP8_SUCCESS role=${user.role}`, email);
        return {
          id: user._id.toString ? user._id.toString() : user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          classOrSubject: user.classOrSubject,
          subjects: user.subjects || [],
          rollNumber: user.rollNumber || '',
          yearOfStudy: user.yearOfStudy || 0,
          collegeId: user.collegeId?.toString?.() || user.collegeId || '',
          collegeName: user.collegeName || '',
          accountStatus: user.accountStatus || 'active',
          department: user.department || '',
          branch: user.branch || '',
          section: user.section || '',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.classOrSubject = user.classOrSubject;
        token.subjects = user.subjects || [];
        token.rollNumber = user.rollNumber || '';
        token.yearOfStudy = user.yearOfStudy || 0;
        token.collegeId = user.collegeId || '';
        token.collegeName = user.collegeName || '';
        token.accountStatus = user.accountStatus || 'active';
        token.department = user.department || '';
        token.branch = user.branch || '';
        token.section = user.section || '';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.classOrSubject = token.classOrSubject;
        session.user.subjects = token.subjects || [];
        session.user.rollNumber = token.rollNumber || '';
        session.user.yearOfStudy = token.yearOfStudy || 0;
        session.user.collegeId = token.collegeId || '';
        session.user.collegeName = token.collegeName || '';
        session.user.accountStatus = token.accountStatus || 'active';
        session.user.department = token.department || '';
        session.user.branch = token.branch || '';
        session.user.section = token.section || '';
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  // NEXTAUTH_SECRET MUST be set in .env.local for production
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
