import bcrypt from 'bcryptjs';
import User from './models/User.js';

/**
 * Auto-seed default users on first MongoDB connection.
 *
 * WHY: In production, the /api/seed endpoint is disabled (returns 403) and the
 * demo-user fallback in auth.js is gated behind NODE_ENV !== 'production'.
 * This means if the default users were never inserted into MongoDB, login
 * returns 401 because getUserByEmail cannot find them.
 *
 * This function:
 * - Runs ONCE per server lifetime (tracked by global.__autoSeeded).
 * - Creates default admin, faculty, and student users IF they do not already exist.
 * - NEVER overwrites existing users or their account status.
 * - Uses environment variables for passwords when available.
 * - Hashes passwords with bcrypt (same as the register route).
 */

const BCRYPT_ROUNDS = 12; // Match register/route.js

const DEFAULT_USERS = [
  {
    name: 'Director S. K. Roy',
    email: 'admin@eduvision.ai',
    role: 'admin',
    classOrSubject: 'Dean Academic Operations',
    envPasswordKey: 'DEFAULT_ADMIN_PASSWORD',
    fallbackPassword: 'password123',
  },
  {
    name: 'Dr. Priya Nair',
    email: 'faculty@eduvision.ai',
    role: 'faculty',
    classOrSubject: 'Digital Electronics & VLSI',
    envPasswordKey: 'DEFAULT_FACULTY_PASSWORD',
    fallbackPassword: 'Faculty@123',
  },
  {
    name: 'Aarav Sharma',
    email: 'student@eduvision.ai',
    role: 'student',
    classOrSubject: 'CSE-A',
    rollNumber: 'CSE001',
    yearOfStudy: 2,
    envPasswordKey: 'DEFAULT_STUDENT_PASSWORD',
    fallbackPassword: 'Student@123',
  },
];

/**
 * Seed default users into MongoDB if they don't already exist.
 * Safe to call multiple times — only creates missing users.
 * Called automatically on first successful DB connection.
 */
export async function ensureDefaultUsers() {
  // Guard: run only once per server lifetime
  // Note: guard is set AFTER successful completion, not before,
  // so a partially-failed seed can retry on reconnection.
  if (global.__autoSeeded) return;

  try {
    let created = 0;

    for (const def of DEFAULT_USERS) {
      const rawPassword = process.env[def.envPasswordKey] || def.fallbackPassword;
      const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

      // Check if user already exists
      const existing = await User.findOne({ email: def.email }).lean();

      if (existing) {
        // ALWAYS overwrite passwordHash for the three hardcoded demo emails.
        // Reason: a user may have registered via OTP with a different password,
        // getting accountStatus=active but with the WRONG hash. The demo password
        // (Admin@123 / Faculty@123 / Student@123) must always work for these
        // intentional demo accounts.
        const hashMismatch = existing.passwordHash &&
          !(await bcrypt.compare(rawPassword, existing.passwordHash));

        if (hashMismatch || existing.accountStatus !== 'active' || !existing.passwordHash) {
          const reason = !existing.passwordHash ? 'no_hash'
            : hashMismatch ? 'hash_mismatch'
            : `status_${existing.accountStatus}`;
          await User.updateOne(
            { email: def.email },
            {
              $set: {
                passwordHash,
                accountStatus: 'active',
                emailVerified: true,
                role: def.role,
              },
            }
          );
          created++;
          console.log(`[AUTO-SEED] Fixed ${def.role}: ${def.email} (reason=${reason})`);
        } else if (process.env.NODE_ENV !== 'production') {
          console.log(`[AUTO-SEED] ${def.email} OK — hash matches, active`);
        }
        continue;
      }

      // User does not exist — create it
      try {
        await User.create({
          name: def.name,
          email: def.email,
          role: def.role,
          classOrSubject: def.classOrSubject,
          rollNumber: def.rollNumber || '',
          yearOfStudy: def.yearOfStudy || 0,
          passwordHash,
          accountStatus: 'active',
          emailVerified: true,
          faceEmbedding: [],
        });
        created++;
        console.log(`[AUTO-SEED] Created ${def.role}: ${def.email}`);
      } catch (err) {
        // Unique constraint violation = race condition — user was just created
        if (err.code === 11000) {
          console.log(`[AUTO-SEED] ${def.email} created by concurrent request — updating`);
          await User.updateOne(
            { email: def.email },
            { $set: { passwordHash, accountStatus: 'active', role: def.role } }
          ).catch(() => {});
        } else {
          console.error(`[AUTO-SEED] Failed to create ${def.email}:`, err.message);
        }
      }
    }

    if (created > 0) {
      console.log(`[AUTO-SEED] ${created} default user(s) created successfully`);
    }

    // Mark as seeded ONLY after successful completion
    global.__autoSeeded = true;
  } catch (err) {
    console.error('[AUTO-SEED] Unexpected error:', err.message);
    // Do NOT set guard — allow retry on next connection attempt
  }
}
