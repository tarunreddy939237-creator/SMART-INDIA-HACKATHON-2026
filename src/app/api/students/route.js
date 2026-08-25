import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AttendanceRecord from '@/lib/models/AttendanceRecord.js';
import QuizAttempt from '@/lib/models/QuizAttempt.js';
import StudentScore from '@/lib/models/StudentScore.js';
import { DEMO_USERS } from '@/lib/seed-data.js';

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'faculty' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Faculty/Admin role required' }, { status: 403 });
    }

    const { studentId, subjects, labs } = await request.json();
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    const db = await connectToDatabase();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    const dedupedSubjects = [...new Set((subjects ?? []).map(s => s.trim()).filter(Boolean))];
    const dedupedLabs = [...new Set((labs ?? []).map(s => s.trim()).filter(Boolean))];
    const updated = await User.findByIdAndUpdate(
      studentId,
      { $set: { subjects: dedupedSubjects, labs: dedupedLabs } },
      { new: false, select: 'name email classOrSubject subjects labs' }
    ).lean();
    if (!updated) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const fresh = await User.findById(studentId).select('name email classOrSubject subjects labs').lean();
    return NextResponse.json({ success: true, student: fresh });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const section   = searchParams.get('section')   || '';
    const studentId = searchParams.get('studentId') || '';

  const db = await connectToDatabase();

  // ── Single student fetch (for dashboard subjects/labs) ────────────────────
  if (studentId) {
    if (!db) return NextResponse.json({ student: null });
    const u = await User.findById(studentId).lean().catch(() => null);
    if (!u) return NextResponse.json({ student: null });
    return NextResponse.json({
      student: {
        id: String(u._id), name: u.name, email: u.email,
        classOrSubject: u.classOrSubject,
        subjects: [...new Set(u.subjects || [])],
        labs:     [...new Set(u.labs     || [])],
        guardianPhone: u.guardianPhone || '',
        languagePreference: u.languagePreference || 'en',
        faceRegistered: Array.isArray(u.faceEmbedding) && u.faceEmbedding.length > 0,
      },
    });
  }

  if (!db) {
    const demo = DEMO_USERS
      .filter(u => u.role === 'student' && (!section || u.classOrSubject === section))
      .map(u => ({
        id: String(u._id), name: u.name, email: u.email,
        classOrSubject: u.classOrSubject,
        attendancePct: 90, avgQuizScore: 0,
        riskTier: 'Low', successScore: null,
      }));
    return NextResponse.json({ students: demo });
  }

  // ── DB available: fetch all students in section ───────────────────────────
  const filter = { role: 'student' };
  if (section) filter.classOrSubject = section;

  const users = await User.find(filter).lean();
  if (!users.length) return NextResponse.json({ students: [] });

  const ids = users.map(u => u._id);

  // Fetch stored scores and attendance in parallel
  const [storedScores, allAtt, allQuiz] = await Promise.all([
    StudentScore.find({ studentId: { $in: ids } }).lean(),
    AttendanceRecord.find({ studentId: { $in: ids } }).lean(),
    QuizAttempt.find({ studentId: { $in: ids } }).lean(),
  ]);

  const scoreMap = new Map(storedScores.map(s => [String(s.studentId), s]));

  // Group attendance and quiz by studentId
  const attByStudent = {};
  allAtt.forEach(a => {
    const sid = String(a.studentId);
    if (!attByStudent[sid]) attByStudent[sid] = [];
    attByStudent[sid].push(a);
  });

  const quizByStudent = {};
  allQuiz.forEach(q => {
    const sid = String(q.studentId);
    if (!quizByStudent[sid]) quizByStudent[sid] = [];
    quizByStudent[sid].push(q);
  });

  const students = users.map(u => {
    const sid = String(u._id);
    const stored = scoreMap.get(sid);

    if (stored) {
      return {
        id: sid, name: u.name, email: u.email,
        classOrSubject: u.classOrSubject,
        rollNumber:  u.rollNumber  || '',
        yearOfStudy: u.yearOfStudy || 0,
        subjects: u.subjects || [],
        labs:     u.labs     || [],
        attendancePct: stored.breakdown?.attendance ?? 0,
        avgQuizScore:  stored.breakdown?.academic   ?? 0,
        riskTier:      stored.riskTier      ?? 'Low',
        riskScore:     stored.riskScore     ?? 0,
        successScore:  stored.successScore  ?? null,
      };
    }

    // Compute on-the-fly from raw records
    const atts   = attByStudent[sid] || [];
    const quizzes = quizByStudent[sid] || [];

    const pct = atts.length
      ? Math.round(atts.filter(a => a.status === 'present').length / atts.length * 100)
      : 0;

    const scores = quizzes.map(q => q.score ?? 0);
    const avgQuiz = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    const riskTier = pct === 0 ? 'Low' : pct < 75 ? 'High' : pct < 85 ? 'Medium' : 'Low';
    // Approximate riskScore from tier (0-100)
    const riskScore = riskTier === 'High' ? 75 : riskTier === 'Medium' ? 45 : 15;

    return {
      id: sid, name: u.name, email: u.email,
      classOrSubject: u.classOrSubject,
      rollNumber:  u.rollNumber  || '',
      yearOfStudy: u.yearOfStudy || 0,
      subjects: u.subjects || [],
      labs:     u.labs     || [],
      attendancePct: pct,
      avgQuizScore:  avgQuiz,
      riskTier,
      riskScore,
      successScore: null,
    };
  });

  return NextResponse.json({ students });
  } catch (error) {
    console.error('[students] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
