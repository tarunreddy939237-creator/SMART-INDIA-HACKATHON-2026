import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { submitFeedback, getAggregatedFeedback } from '@/lib/queries.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const subjectOrFacultyId = searchParams.get('target');
    // Faculty can fetch their own feedback by passing ?mine=1
    const mine = searchParams.get('mine');
    const facultyId = mine ? session?.user?.id : null;

    const feedbackData = await getAggregatedFeedback(subjectOrFacultyId || undefined, facultyId || undefined);
    return NextResponse.json({ feedback: feedbackData });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { subjectOrFacultyId, facultyId, rating, comment, anonymized } = body;

    if (!subjectOrFacultyId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Valid subject/faculty and rating (1-5) are required' }, { status: 400 });
    }

    if (!session?.user?.id || session.user.role !== 'student') {
      return NextResponse.json({ error: 'Only students can submit feedback' }, { status: 403 });
    }

    const feedback = await submitFeedback({
      studentId: session.user.id,
      subjectOrFacultyId,
      facultyId: facultyId || null,
      rating: Number(rating),
      comment: comment || '',
      anonymized: anonymized !== false,
      section: session.user.classOrSubject,
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
