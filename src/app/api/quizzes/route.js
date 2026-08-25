import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { getQuizzes, getQuizById, createQuiz, deleteQuiz, submitQuizAttempt, getQuizAttemptsByStudent } from '@/lib/queries.js';
import { matchesStudentAudience } from '@/lib/contentTargeting.js';
import { onQuizResult } from '@/lib/notificationEngine.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get('id');
    const subject = searchParams.get('subject');
    const studentHistory = searchParams.get('history');
    const mine = searchParams.get('mine');

    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (studentHistory) {
      if (!session?.user?.id) {
        return NextResponse.json({ history: [] });
      }
      const history = await getQuizAttemptsByStudent(session.user.id);
      return NextResponse.json({ history });
    }

    if (quizId) {
      const quiz = await getQuizById(quizId, true);
      if (!quiz) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }
      if (role === 'student') {
        const section = session?.user?.classOrSubject;
        if (!matchesStudentAudience(quiz, section)) {
          return NextResponse.json({ error: 'Quiz not available for your section' }, { status: 403 });
        }
      }
      return NextResponse.json({ quiz });
    }

    if (role === 'student') {
      const audienceSection = session?.user?.classOrSubject;
      if (!audienceSection) {
        return NextResponse.json({ quizzes: [] });
      }
      const quizzes = await getQuizzes({ subject: subject || undefined, audienceSection });
      return NextResponse.json({ quizzes });
    }

    if (role === 'faculty' || role === 'admin') {
      const createdBy = mine && role === 'faculty' ? session.user.id : undefined;
      const quizzes = await getQuizzes({ subject: subject || undefined, createdBy });
      return NextResponse.json({ quizzes });
    }

    return NextResponse.json({ quizzes: [] }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { action } = body;

    if (action === 'submit') {
      const { quizId, selectedAnswers } = body;
      if (!quizId || !selectedAnswers || !Array.isArray(selectedAnswers)) {
        return NextResponse.json({ error: 'Invalid quiz submission parameters' }, { status: 400 });
      }
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const quiz = await getQuizById(quizId, false);
      if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      if (session.user.role === 'student' && !matchesStudentAudience(quiz, session.user.classOrSubject)) {
        return NextResponse.json({ error: 'Quiz not available for your section' }, { status: 403 });
      }
      const result = await submitQuizAttempt({ quizId, studentId: session.user.id, selectedAnswers });

      // Generate quiz result notification
      try {
        if (result && result.score !== undefined) {
          await onQuizResult(session.user.id, quiz, result.score, result.weakTopics || []);
        }
      } catch (notifErr) {
        console.warn('[quizzes] Notification generation failed:', notifErr.message);
      }

      return NextResponse.json({ success: true, result });
    }

    if (action === 'create') {
      const userRole = session?.user?.role;
      if (userRole !== 'faculty' && userRole !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Faculty or Admin role required' }, { status: 403 });
      }
      const { subject, branch, section, questions } = body;
      if (!subject || !questions || !Array.isArray(questions) || questions.length === 0) {
        return NextResponse.json({ error: 'Subject and questions array are required' }, { status: 400 });
      }
      if (!branch || !section) {
        return NextResponse.json({ error: 'Branch and target section are required' }, { status: 400 });
      }
      for (const q of questions) {
        if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || q.correctAnswer === undefined || !q.topic) {
          return NextResponse.json({ error: 'Each question must have question text, options, correctAnswer index, and topic' }, { status: 400 });
        }
      }
      const createdBy = session?.user?.id;
      if (!createdBy) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const created = await createQuiz({ subject, branch, section, questions, createdBy });
      return NextResponse.json({ success: true, quiz: created });
    }

    return NextResponse.json({ error: 'Unknown action specified' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get('id');
    if (!quizId) return NextResponse.json({ error: 'Quiz ID required' }, { status: 400 });

    const quiz = await getQuizById(quizId, false);
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    if (userRole === 'faculty' && String(quiz.createdBy) !== String(session.user.id)) {
      return NextResponse.json({ error: 'You can only delete quizzes you created' }, { status: 403 });
    }

    await deleteQuiz(quizId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
