import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import Quiz from '@/lib/models/Quiz.js';
import Streak from '@/lib/models/Streak.js';
import Feedback from '@/lib/models/Feedback.js';
import AttendanceRecord from '@/lib/models/AttendanceRecord.js';
import { DEMO_USERS, DEMO_QUIZZES, DEMO_STREAKS } from '@/lib/seed-data.js';

/**
 * POST /api/seed
 * Seeds the database with demo data.
 * RESTRICTED: Admin-only in all environments. Disabled entirely in production.
 */
export async function POST(request) {
  // Block in production — seed data should never be injected in prod
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production.' }, { status: 403 });
  }

  try {
    // Require admin authentication
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user?.id || (role !== 'admin' && role !== 'super_admin' && role !== 'college_admin')) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const db = await connectToDatabase();
    if (!db) {
      return NextResponse.json({
        message: 'MongoDB URI not connected. Operating in high-performance local demo mode with in-memory store.',
        seeded: false,
      });
    }

    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    for (const u of DEMO_USERS) {
      await User.findOneAndUpdate(
        { email: u.email },
        {
          name: u.name,
          email: u.email,
          role: u.role,
          classOrSubject: u.classOrSubject,
          faceEmbedding: u.faceEmbedding || [],
          passwordHash: defaultPasswordHash,
          accountStatus: 'active',
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    const faculty = await User.findOne({ role: 'faculty' });
    const student = await User.findOne({ role: 'student' });

    if (faculty) {
      for (const q of DEMO_QUIZZES) {
        await Quiz.findOneAndUpdate(
          { subject: q.subject },
          {
            subject: q.subject,
            questions: q.questions,
            createdBy: faculty._id,
          },
          { upsert: true }
        );
      }
    }

    if (student) {
      await Streak.findOneAndUpdate(
        { studentId: student._id },
        {
          currentStreak: 14,
          longestStreak: 21,
          badges: ['14-Day Consistency Master', 'VLSI Quiz Champion', 'Perfect Morning Attendance'],
        },
        { upsert: true }
      );

      if (faculty) {
        await AttendanceRecord.create({
          studentId: student._id,
          facultyId: faculty._id,
          date: new Date(),
          status: 'present',
          confidenceScore: 97,
        });

        await Feedback.create({
          studentId: null,
          subjectOrFacultyId: 'Digital Electronics & VLSI',
          rating: 5,
          comment: 'Very engaging practical sessions!',
          anonymized: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully with demo data.',
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[seed] Error:', error.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
