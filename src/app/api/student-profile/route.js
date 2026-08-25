import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { getStudent360 } from '@/lib/student360.js';

export async function GET(request) {
  try {
    const session  = await getServerSession(authOptions);
    const userRole = session?.user?.role || 'admin';

    const { searchParams } = new URL(request.url);
    const targetStudentId = searchParams.get('studentId') || '';

    // Allow admin, faculty, or the student themselves
    if (userRole !== 'admin' && userRole !== 'faculty' && session?.user?.id !== targetStudentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const s360 = await getStudent360(targetStudentId);
    if (!s360) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    // Shape the response to stay backward-compatible with StudentDrilldownModal
    // while adding the richer 360 fields
    const profile = {
      user: s360.user,
      streak: s360.streak,
      attendance: s360.attendance,
      quizAttempts: s360.quizAttempts,
      weakTopics: s360.quizSummary.weakTopics.map(w => w.topic),
      // New enriched fields
      score:              s360.score,
      quizSummary:        s360.quizSummary,
      activePlan:         s360.activePlan,
      activeIntervention: s360.activeIntervention,
    };

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
