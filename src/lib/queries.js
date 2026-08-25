import mongoose from 'mongoose';
import connectToDatabase from './mongodb.js';
import User from './models/User.js';
import AttendanceRecord from './models/AttendanceRecord.js';
import Quiz from './models/Quiz.js';
import QuizAttempt from './models/QuizAttempt.js';
import Feedback from './models/Feedback.js';
import Streak from './models/Streak.js';
import StudentScore from './models/StudentScore.js';
import VideoLecture from './models/VideoLecture.js';
import SubjectAssignment from './models/SubjectAssignment.js';
import { DEMO_USERS, DEMO_QUIZZES, DEMO_STREAKS } from './seed-data.js';
import { recalculate as recalculateScore } from './successScoreEngine.js';
import { mongoAudienceFilter, matchesStudentAudience } from './contentTargeting.js';

export function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

let inMemoryStore = {
  users: [...DEMO_USERS],
  quizzes: [...DEMO_QUIZZES],
  streaks: [...DEMO_STREAKS],
  attendance: [
    {
      _id: '64f1a2b3c4d5e6f7a8b9c201',
      studentId: '64f1a2b3c4d5e6f7a8b9c001',
      facultyId: '64f1a2b3c4d5e6f7a8b9c004',
      date: new Date(Date.now() - 86400000 * 2),
      status: 'present',
      confidenceScore: 98,
    },
    {
      _id: '64f1a2b3c4d5e6f7a8b9c202',
      studentId: '64f1a2b3c4d5e6f7a8b9c001',
      facultyId: '64f1a2b3c4d5e6f7a8b9c005',
      date: new Date(Date.now() - 86400000 * 1),
      status: 'present',
      confidenceScore: 95,
    },
    {
      _id: '64f1a2b3c4d5e6f7a8b9c203',
      studentId: '64f1a2b3c4d5e6f7a8b9c001',
      facultyId: '64f1a2b3c4d5e6f7a8b9c004',
      date: new Date(),
      status: 'present',
      confidenceScore: 96,
    },
  ],
  quizAttempts: [
    {
      _id: '64f1a2b3c4d5e6f7a8b9c301',
      quizId: '64f1a2b3c4d5e6f7a8b9c101',
      studentId: '64f1a2b3c4d5e6f7a8b9c001',
      score: 75,
      weakTopics: ['MOSFET'],
      createdAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      _id: '64f1a2b3c4d5e6f7a8b9c302',
      quizId: '64f1a2b3c4d5e6f7a8b9c102',
      studentId: '64f1a2b3c4d5e6f7a8b9c001',
      score: 100,
      weakTopics: [],
      createdAt: new Date(Date.now() - 86400000 * 1),
    },
  ],
  feedback: [
    {
      _id: '64f1a2b3c4d5e6f7a8b9c401',
      studentId: null,
      subjectOrFacultyId: 'Digital Electronics & VLSI',
      rating: 5,
      comment: 'Exceptional circuit simulations and interactive lecture clarity.',
      anonymized: true,
      createdAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      _id: '64f1a2b3c4d5e6f7a8b9c402',
      studentId: null,
      subjectOrFacultyId: 'Data Structures & Algorithms',
      rating: 4,
      comment: 'Very practical problem sets, would love more graph theory practice.',
      anonymized: true,
      createdAt: new Date(Date.now() - 86400000 * 2),
    },
  ],
  videoLectures: [
    {
      _id: '64f1a2b3c4d5e6f7a8b9d001',
      title: 'MOSFET Biasing — Deep Dive',
      description: 'Complete walkthrough of MOSFET small-signal models and biasing circuits.',
      subject: 'Digital Electronics',
      branch: 'CSE',
      section: 'CSE-A',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      duration: '42 min',
      uploadedBy: { _id: '64f1a2b3c4d5e6f7a8b9c004', name: 'Dr. Priya Nair' },
      createdAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      _id: '64f1a2b3c4d5e6f7a8b9d002',
      title: 'CMOS Inverter Propagation Delay',
      description: 'Timing analysis and delay calculation for CMOS logic gates.',
      subject: 'Digital Electronics',
      branch: 'CSE',
      section: 'CSE-A',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      duration: '38 min',
      uploadedBy: { _id: '64f1a2b3c4d5e6f7a8b9c004', name: 'Dr. Priya Nair' },
      createdAt: new Date(Date.now() - 86400000 * 1),
    },
  ],
};

export async function getUser(id) {
  if (!id) return null;
  const db = await connectToDatabase();
  if (db && isValidObjectId(id)) {
    try { return await User.findById(id).lean(); }
    catch (e) { console.error('DB error in getUser:', e.message); }
  }
  return inMemoryStore.users.find((u) => u._id === id || String(u._id) === String(id)) || null;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const db = await connectToDatabase();
  if (db) {
    try { return await User.findOne({ email: normalized }).lean(); }
    catch (e) { console.error('DB error in getUserByEmail:', e.message); }
  }
  return inMemoryStore.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export async function createUser(data) {
  const db = await connectToDatabase();
  if (db) {
    try { const user = new User(data); return await user.save(); }
    catch (e) { console.error('DB error in createUser:', e.message); throw e; }
  }
  const newUser = {
    _id: '64f1a2b3c4d5e6f7a8b9c' + Math.floor(Math.random() * 8999 + 1000),
    createdAt: new Date(),
    ...data,
  };
  inMemoryStore.users.push(newUser);
  return newUser;
}

export async function createAttendanceRecord({ studentId, facultyId, date, status, confidenceScore, livenessVerified, livenessChallenge }) {
  if (!studentId || !facultyId) throw new Error('Missing studentId or facultyId');
  const db = await connectToDatabase();
  if (db && isValidObjectId(studentId) && isValidObjectId(facultyId)) {
    try {
      const record = new AttendanceRecord({
        studentId, facultyId,
        date: date ? new Date(date) : new Date(),
        status: status || 'present',
        confidenceScore: confidenceScore || 95,
        livenessVerified: livenessVerified ?? false,
        livenessChallenge: livenessChallenge ?? '',
      });
      return await record.save();
    } catch (e) { console.error('DB error in createAttendanceRecord:', e.message); throw e; }
  }
  const record = {
    _id: '64f1a2b3c4d5e6f7a8b9c' + Math.floor(Math.random() * 8999 + 1000),
    studentId, facultyId,
    date: date ? new Date(date) : new Date(),
    status: status || 'present',
    confidenceScore: confidenceScore || 95,
    livenessVerified: livenessVerified ?? false,
    livenessChallenge: livenessChallenge ?? '',
    createdAt: new Date(),
  };
  inMemoryStore.attendance.push(record);
  return record;
}

export async function getAttendanceByStudent(studentId) {
  if (!studentId) return [];
  const db = await connectToDatabase();
  if (db && isValidObjectId(studentId)) {
    try { return await AttendanceRecord.find({ studentId }).sort({ date: -1 }).lean(); }
    catch (e) { console.error('DB error in getAttendanceByStudent:', e.message); }
  }
  return inMemoryStore.attendance.filter(
    (a) => String(a.studentId) === String(studentId) || (a.studentId && a.studentId._id === studentId)
  );
}

export async function getAttendanceForFaculty(facultyId) {
  if (!facultyId) return [];
  const db = await connectToDatabase();
  if (db && isValidObjectId(facultyId)) {
    try {
      return await AttendanceRecord.find({ facultyId })
        .populate('studentId', 'name email classOrSubject')
        .sort({ date: -1 }).lean();
    } catch (e) { console.error('DB error in getAttendanceForFaculty:', e.message); }
  }
  return inMemoryStore.attendance.map((a) => {
    const student = inMemoryStore.users.find((u) => String(u._id) === String(a.studentId));
    return { ...a, studentId: student || { name: 'Student', email: 'student@eduvision.ai' } };
  });
}

export async function getClassRoster(classOrSubject) {
  const db = await connectToDatabase();
  if (db) {
    try { return await User.find({ role: 'student', classOrSubject: classOrSubject || 'CSE-A' }).lean(); }
    catch (e) { console.error('DB error in getClassRoster:', e.message); }
  }
  return inMemoryStore.users.filter((u) => u.role === 'student' && (!classOrSubject || u.classOrSubject === classOrSubject));
}

export async function createQuiz({ subject, branch, section, questions, createdBy }) {
  if (!subject || !questions || !questions.length) throw new Error('Invalid quiz payload');
  const db = await connectToDatabase();
  if (db && isValidObjectId(createdBy)) {
    try { const quiz = new Quiz({ subject, branch: branch || 'CSE', section: section || '', questions, createdBy }); return await quiz.save(); }
    catch (e) { console.error('DB error in createQuiz:', e.message); throw e; }
  }
  const quiz = {
    _id: '64f1a2b3c4d5e6f7a8b9c' + Math.floor(Math.random() * 8999 + 1000),
    subject, branch: branch || 'CSE', section: section || '', questions, createdBy, createdAt: new Date(),
  };
  inMemoryStore.quizzes.push(quiz);
  return quiz;
}

export async function deleteQuiz(quizId) {
  if (!quizId) throw new Error('quizId required');
  const db = await connectToDatabase();
  if (db && isValidObjectId(quizId)) {
    try {
      const deleted = await Quiz.findByIdAndDelete(quizId);
      try { await QuizAttempt.deleteMany({ quizId }); } catch (_) { /* non-fatal */ }
      return deleted;
    }
    catch (e) { console.error('DB error in deleteQuiz:', e.message); throw e; }
  }
  const idx = inMemoryStore.quizzes.findIndex(q => String(q._id) === String(quizId));
  if (idx !== -1) inMemoryStore.quizzes.splice(idx, 1);
  inMemoryStore.quizAttempts = inMemoryStore.quizAttempts.filter(a => String(a.quizId) !== String(quizId));
  return true;
}

export async function getQuizzes({ subject, audienceSection, createdBy } = {}) {
  const db = await connectToDatabase();
  const sanitize = (quizzes) => quizzes.map((q) => ({
    ...q,
    questions: (q.questions || []).map((ques) => ({
      _id: ques._id, question: ques.question, options: ques.options, topic: ques.topic,
    })),
  }));

  if (db) {
    try {
      const filter = {};
      if (subject) filter.subject = subject;
      if (createdBy && isValidObjectId(createdBy)) filter.createdBy = createdBy;
      if (audienceSection) Object.assign(filter, mongoAudienceFilter(audienceSection));
      const quizzes = await Quiz.find(filter).sort({ createdAt: -1 }).lean();
      return sanitize(quizzes);
    } catch (e) { console.error('DB error in getQuizzes:', e.message); }
  }
  return sanitize(
    inMemoryStore.quizzes.filter((q) =>
      (!subject || q.subject === subject) &&
      (!createdBy || String(q.createdBy) === String(createdBy)) &&
      (!audienceSection || matchesStudentAudience(q, audienceSection))
    )
  );
}

export async function getQuizById(quizId, sanitizeAnswers = true) {
  if (!quizId) return null;
  const db = await connectToDatabase();
  let quiz = null;
  if (db && isValidObjectId(quizId)) {
    try { quiz = await Quiz.findById(quizId).lean(); }
    catch (e) { console.error('DB error in getQuizById:', e.message); }
  }
  if (!quiz) quiz = inMemoryStore.quizzes.find((q) => String(q._id) === String(quizId)) || null;
  if (!quiz) return null;
  if (sanitizeAnswers) {
    return {
      ...quiz,
      questions: quiz.questions.map((q) => ({
        _id: q._id, question: q.question, options: q.options, topic: q.topic,
      })),
    };
  }
  return quiz;
}

export async function submitQuizAttempt({ quizId, studentId, selectedAnswers }) {
  if (!quizId || !studentId) throw new Error('Missing quizId or studentId');
  const fullQuiz = await getQuizById(quizId, false);
  if (!fullQuiz) throw new Error('Quiz not found');

  let correctCount = 0;
  const weakTopics = [];
  const breakdown = [];

  fullQuiz.questions.forEach((q, idx) => {
    const studentAnswer = selectedAnswers[idx];
    const isCorrect = studentAnswer === q.correctAnswer;
    if (isCorrect) { correctCount++; }
    else { if (q.topic && !weakTopics.includes(q.topic)) weakTopics.push(q.topic); }
    breakdown.push({ question: q.question, topic: q.topic, selectedAnswer: studentAnswer, correctAnswer: q.correctAnswer, isCorrect });
  });

  const score = Math.round((correctCount / fullQuiz.questions.length) * 100);
  const db = await connectToDatabase();
  let attemptResult;
  if (db && isValidObjectId(quizId) && isValidObjectId(studentId)) {
    try {
      const attempt = new QuizAttempt({ quizId, studentId, score, weakTopics });
      attemptResult = await attempt.save();
    } catch (e) { console.error('DB error in submitQuizAttempt:', e.message); }
  }
  if (!attemptResult) {
    attemptResult = {
      _id: '64f1a2b3c4d5e6f7a8b9c' + Math.floor(Math.random() * 8999 + 1000),
      quizId, studentId, score, weakTopics, createdAt: new Date(),
    };
    inMemoryStore.quizAttempts.push(attemptResult);
  }
  await updateStreak(studentId, true);
  recalculateScore(studentId).catch(err => console.warn('[submitQuizAttempt] score recalc error:', err.message));
  return { attemptId: attemptResult._id, score, correctCount, totalQuestions: fullQuiz.questions.length, weakTopics, breakdown };
}

export async function getQuizAttemptsByStudent(studentId) {
  if (!studentId) return [];
  const db = await connectToDatabase();
  if (db && isValidObjectId(studentId)) {
    try {
      return await QuizAttempt.find({ studentId }).populate('quizId', 'subject').sort({ createdAt: -1 }).lean();
    } catch (e) { console.error('DB error in getQuizAttemptsByStudent:', e.message); }
  }
  return inMemoryStore.quizAttempts
    .filter((a) => String(a.studentId) === String(studentId))
    .map((a) => {
      const quiz = inMemoryStore.quizzes.find((q) => String(q._id) === String(a.quizId));
      return { ...a, quizId: quiz || { subject: 'General' } };
    });
}

export async function resolveFacultyForSubject(subject, section) {
  if (!subject) return null;
  const db = await connectToDatabase();
  const subjectRe = new RegExp(`^${String(subject).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  if (db) {
    try {
      if (section) {
        const assigned = await SubjectAssignment.findOne({
          section,
          subject: subjectRe,
        }).lean();
        if (assigned?.facultyId) return String(assigned.facultyId);
      }
      const faculty = await User.findOne({
        role: 'faculty',
        $or: [
          { classOrSubject: subjectRe },
          { subjects: subjectRe },
        ],
      }).select('_id').lean();
      if (faculty?._id) return String(faculty._id);
    } catch (e) {
      console.error('DB error in resolveFacultyForSubject:', e.message);
    }
  }

  const demo = inMemoryStore.users.find(
    (u) => u.role === 'faculty' && String(u.classOrSubject || '').toLowerCase() === String(subject).toLowerCase()
  );
  return demo?._id || null;
}

export async function submitFeedback({ studentId, subjectOrFacultyId, facultyId, rating, comment, anonymized, section }) {
  if (!subjectOrFacultyId || !rating) throw new Error('Missing feedback parameters');
  let resolvedFacultyId = facultyId && isValidObjectId(facultyId) ? facultyId : null;
  if (!resolvedFacultyId) {
    resolvedFacultyId = await resolveFacultyForSubject(subjectOrFacultyId, section);
    if (resolvedFacultyId && !isValidObjectId(resolvedFacultyId)) resolvedFacultyId = null;
  }

  const db = await connectToDatabase();
  if (db) {
    try {
      const fb = new Feedback({
        studentId: anonymized ? null : (isValidObjectId(studentId) ? studentId : null),
        subjectOrFacultyId,
        facultyId: resolvedFacultyId && isValidObjectId(resolvedFacultyId) ? resolvedFacultyId : null,
        rating: Number(rating), comment: comment || '', anonymized: anonymized !== false,
      });
      return await fb.save();
    } catch (e) { console.error('DB error in submitFeedback:', e.message); throw e; }
  }
  const fb = {
    _id: '64f1a2b3c4d5e6f7a8b9c' + Math.floor(Math.random() * 8999 + 1000),
    studentId: anonymized ? null : studentId,
    subjectOrFacultyId, facultyId: resolvedFacultyId || null,
    rating: Number(rating), comment: comment || '',
    anonymized: anonymized !== false, createdAt: new Date(),
  };
  inMemoryStore.feedback.push(fb);
  return fb;
}

export async function getAggregatedFeedback(subjectOrFacultyId, facultyId) {
  const db = await connectToDatabase();
  let feedbackList = [];
  let facultySubjects = [];

  if (facultyId) {
    const facultyUser = await getUser(facultyId);
    if (facultyUser) {
      facultySubjects = [
        ...(facultyUser.subjects || []),
        facultyUser.classOrSubject,
      ].filter(Boolean);
    }
  }

  if (db) {
    try {
      const query = {};
      if (facultyId && isValidObjectId(facultyId)) {
        const or = [{ facultyId }];
        if (subjectOrFacultyId) {
          or.push({ subjectOrFacultyId });
        } else if (facultySubjects.length) {
          or.push({ subjectOrFacultyId: { $in: facultySubjects } });
        }
        query.$or = or;
      } else if (subjectOrFacultyId) {
        query.subjectOrFacultyId = subjectOrFacultyId;
      }
      feedbackList = await Feedback.find(query).sort({ createdAt: -1 }).lean();
    } catch (e) { console.error('DB error in getAggregatedFeedback:', e.message); }
  } else {
    feedbackList = inMemoryStore.feedback.filter((f) => {
      if (facultyId) {
        const matchesFaculty = String(f.facultyId || '') === String(facultyId);
        const matchesSubject = subjectOrFacultyId
          ? f.subjectOrFacultyId === subjectOrFacultyId
          : facultySubjects.includes(f.subjectOrFacultyId);
        return matchesFaculty || matchesSubject;
      }
      if (subjectOrFacultyId) return f.subjectOrFacultyId === subjectOrFacultyId;
      return true;
    });
  }

  const total = feedbackList.length;
  if (total === 0) return { averageRating: 0, totalFeedback: 0, breakdown: [1,2,3,4,5].map(r => ({ rating: r, count: 0 })), recentComments: [] };
  const sum = feedbackList.reduce((acc, f) => acc + (f.rating || 0), 0);
  const averageRating = Number((sum / total).toFixed(1));
  const breakdown = [1, 2, 3, 4, 5].map((star) => ({
    rating: star, count: feedbackList.filter((f) => f.rating === star).length,
  }));
  const recentComments = feedbackList
    .filter((f) => f.comment && f.comment.trim() !== '')
    .slice(0, 10)
    .map((f) => ({ rating: f.rating, comment: f.comment, subjectOrFacultyId: f.subjectOrFacultyId, createdAt: f.createdAt }));
  return { averageRating, totalFeedback: total, breakdown, recentComments };
}

export async function getStreak(studentId) {
  if (!studentId) return { currentStreak: 0, longestStreak: 0, badges: [] };
  const db = await connectToDatabase();
  if (db && isValidObjectId(studentId)) {
    try {
      const streak = await Streak.findOne({ studentId }).lean();
      if (streak) return streak;
    } catch (e) { console.error('DB error in getStreak:', e.message); }
  }
  const found = inMemoryStore.streaks.find((s) => String(s.studentId) === String(studentId));
  return found || { studentId, currentStreak: 12, longestStreak: 18, badges: ['Consistent Learner', 'Problem Solver'] };
}

export async function updateStreak(studentId, increment = true) {
  if (!studentId) return null;
  const db = await connectToDatabase();
  if (db && isValidObjectId(studentId)) {
    try {
      let streak = await Streak.findOne({ studentId });
      if (!streak) {
        streak = new Streak({ studentId, currentStreak: 1, longestStreak: 1, badges: ['First Step Achiever'] });
      } else if (increment) {
        streak.currentStreak += 1;
        if (streak.currentStreak > streak.longestStreak) streak.longestStreak = streak.currentStreak;
        if (streak.currentStreak >= 7 && !streak.badges.includes('7-Day Spark')) streak.badges.push('7-Day Spark');
        if (streak.currentStreak >= 14 && !streak.badges.includes('14-Day Consistency Master')) streak.badges.push('14-Day Consistency Master');
      }
      streak.updatedAt = new Date();
      return await streak.save();
    } catch (e) { console.error('DB error in updateStreak:', e.message); }
  }
  let found = inMemoryStore.streaks.find((s) => String(s.studentId) === String(studentId));
  if (found) {
    found.currentStreak += 1;
    if (found.currentStreak > found.longestStreak) found.longestStreak = found.currentStreak;
  } else {
    found = { studentId, currentStreak: 1, longestStreak: 1, badges: ['First Step Achiever'], updatedAt: new Date() };
    inMemoryStore.streaks.push(found);
  }
  return found;
}

export async function getStudentProfile(studentId) {
  const user = await getUser(studentId);
  if (!user) return null;
  const attendance = await getAttendanceByStudent(studentId);
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const totalClasses = attendance.length;
  const overallPercentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
  const quizAttempts = await getQuizAttemptsByStudent(studentId);
  const weakTopics = Array.from(new Set(quizAttempts.flatMap((q) => q.weakTopics || [])));
  const streak = await getStreak(studentId);
  return {
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, classOrSubject: user.classOrSubject },
    streak,
    attendance: { overallPercentage, totalClasses, presentCount, absentCount: totalClasses - presentCount, recent: attendance.slice(0, 7) },
    quizAttempts,
    weakTopics: weakTopics.length ? weakTopics : ['MOSFET Biasing', 'Propagation Delay in Logic Gates'],
  };
}

export async function getInstitutionAnalytics() {
  const DEMO_FALLBACK = {
    totalStudents: 480, totalFaculty: 32, averageAttendance: 91.4, averageQuizScore: 84.2,
    activeClassesCount: 6,
    activeClasses: [
      { id: '1', class: 'CSE-A', subject: 'Digital Electronics & VLSI',    faculty: 'Dr. Priya Nair',    present: 56, absent: 4,  total: 60, attendancePercent: 93, status: 'Active' },
      { id: '2', class: 'CSE-B', subject: 'Data Structures & Algorithms',  faculty: 'Prof. Rajesh Gupta',present: 48, absent: 12, total: 60, attendancePercent: 80, status: 'Active' },
      { id: '3', class: 'ECE-A', subject: 'Signals & Systems',             faculty: 'Dr. Ananya Sen',    present: 52, absent: 6,  total: 58, attendancePercent: 89, status: 'Active' },
      { id: '4', class: 'IT-A',  subject: 'Database Management Systems',   faculty: 'Prof. Vikram Rao',  present: 58, absent: 2,  total: 60, attendancePercent: 96, status: 'Active' },
      { id: '5', class: 'AI-A',  subject: 'Deep Learning & Neural Nets',   faculty: 'Dr. Meera Iyer',    present: 44, absent: 6,  total: 50, attendancePercent: 88, status: 'Upcoming' },
      { id: '6', class: 'CSE-C', subject: 'Computer Networks',             faculty: 'Prof. S. Verma',    present: 55, absent: 5,  total: 60, attendancePercent: 91, status: 'Completed' },
    ],
    attendanceTrends: [
      { date: 'Mon', attendance: 92 }, { date: 'Tue', attendance: 94 },
      { date: 'Wed', attendance: 88 }, { date: 'Thu', attendance: 91 },
      { date: 'Fri', attendance: 95 }, { date: 'Sat', attendance: 89 },
      { date: 'Today', attendance: 91.4 },
    ],
    quizPerformance: [
      { subject: 'Digital Electronics', averageScore: 86, attemptsCount: 142 },
      { subject: 'Data Structures',     averageScore: 78, attemptsCount: 198 },
      { subject: 'Signals & Systems',   averageScore: 82, attemptsCount: 110 },
      { subject: 'DBMS',                averageScore: 89, attemptsCount: 165 },
      { subject: 'Computer Networks',   averageScore: 81, attemptsCount: 130 },
    ],
    streakLeaderboard: [
      { id: '64f1a2b3c4d5e6f7a8b9c001', name: 'Aarav Sharma', streak: 14, badges: ['14-Day Consistency Master', 'VLSI Quiz Champion'], classOrSubject: 'CSE-A' },
      { id: '64f1a2b3c4d5e6f7a8b9c002', name: 'Diya Patel',   streak: 9,  badges: ['7-Day Spark', 'DSA Prodigy'],                    classOrSubject: 'CSE-A' },
      { id: '64f1a2b3c4d5e6f7a8b9c003', name: 'Aditya Mehta', streak: 8,  badges: ['7-Day Spark'],                                   classOrSubject: 'IT-A'  },
      { id: '64f1a2b3c4d5e6f7a8b9c007', name: 'Sanya Kapoor', streak: 7,  badges: ['7-Day Spark'],                                   classOrSubject: 'ECE-A' },
      { id: '64f1a2b3c4d5e6f7a8b9c008', name: 'Rohan Verma',  streak: 5,  badges: ['Weekly Warrior'],                                classOrSubject: 'CSE-B' },
    ],
    feedbackStats: { averageRating: 4.8, totalFeedback: 342, breakdown: [{ rating: 5, count: 240 }, { rating: 4, count: 80 }, { rating: 3, count: 18 }, { rating: 2, count: 3 }, { rating: 1, count: 1 }] },
  };

  const db = await connectToDatabase();
  if (!db) return DEMO_FALLBACK;

  try {
    const [totalStudents, totalFaculty] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
    ]);

    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const attTrend = await AttendanceRecord.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]);
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const attendanceTrends = attTrend.length
      ? attTrend.map((d) => ({ date: DAY_LABELS[new Date(d._id).getDay()], attendance: d.total ? Math.round((d.present / d.total) * 1000) / 10 : 0 }))
      : DEMO_FALLBACK.attendanceTrends;
    const totalAtt  = attTrend.reduce((s, d) => s + d.total, 0);
    const totalPres = attTrend.reduce((s, d) => s + d.present, 0);
    const averageAttendance = totalAtt ? Math.round((totalPres / totalAtt) * 1000) / 10 : DEMO_FALLBACK.averageAttendance;

    const quizAgg = await QuizAttempt.aggregate([
      { $lookup: { from: 'quizzes', localField: 'quizId', foreignField: '_id', as: 'quiz' } },
      { $unwind: '$quiz' },
      { $group: { _id: '$quiz.subject', averageScore: { $avg: '$score' }, attemptsCount: { $sum: 1 } } },
      { $sort: { attemptsCount: -1 } }, { $limit: 5 },
    ]);
    const quizPerformance = quizAgg.length
      ? quizAgg.map((q) => ({ subject: q._id, averageScore: Math.round(q.averageScore * 10) / 10, attemptsCount: q.attemptsCount }))
      : DEMO_FALLBACK.quizPerformance;
    const averageQuizScore = quizPerformance.length
      ? Math.round(quizPerformance.reduce((s, q) => s + q.averageScore, 0) / quizPerformance.length * 10) / 10
      : DEMO_FALLBACK.averageQuizScore;

    // Active classes: group by student section (classOrSubject on student), not facultyId
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const classAgg = await AttendanceRecord.aggregate([
      { $match: { date: { $gte: todayStart } } },
      // Join student to get their section
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmpty: true } },
      // Join faculty to get faculty name
      { $lookup: { from: 'users', localField: 'facultyId', foreignField: '_id', as: 'faculty' } },
      { $unwind: { path: '$faculty', preserveNullAndEmpty: true } },
      { $group: {
        _id: '$student.classOrSubject',
        total:   { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        facultyName: { $first: '$faculty.name' },
      }},
      { $sort: { _id: 1 } },
      { $limit: 9 },
    ]);

    // Fetch subject assignments to show correct subject per section
    let sectionSubjectMap = {};
    try {
      const SubjectAssignment = (await import('./models/SubjectAssignment.js')).default;
      const assignments = await SubjectAssignment.find().lean();
      assignments.forEach(a => { sectionSubjectMap[a.section] = a.subject; });
    } catch (_) {}

    const activeClasses = classAgg.length
      ? classAgg.map((c, i) => ({
          id: String(i + 1),
          class: c._id || 'N/A',
          subject: sectionSubjectMap[c._id] || c._id || 'N/A',
          faculty: c.facultyName || 'Faculty',
          present: c.present,
          absent: c.total - c.present,
          total: c.total,
          attendancePercent: c.total ? Math.round((c.present / c.total) * 100) : 0,
          status: 'Active',
        }))
      : DEMO_FALLBACK.activeClasses;

    const topStreaks = await Streak.find().sort({ currentStreak: -1 }).limit(5).populate('studentId', 'name classOrSubject').lean();
    const streakLeaderboard = topStreaks.length
      ? topStreaks.map((s) => ({ id: String(s.studentId?._id || ''), name: s.studentId?.name || 'Student', streak: s.currentStreak, badges: s.badges || [], classOrSubject: s.studentId?.classOrSubject || '' }))
      : DEMO_FALLBACK.streakLeaderboard;

    const feedbackAgg = await Feedback.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, sum: { $sum: '$rating' }, r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }, r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } }, r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } }, r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } }, r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } } } },
    ]);
    const fb = feedbackAgg[0];
    const feedbackStats = fb
      ? { averageRating: Math.round((fb.sum / fb.total) * 10) / 10, totalFeedback: fb.total, breakdown: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: fb[`r${r}`] })) }
      : DEMO_FALLBACK.feedbackStats;

    return {
      totalStudents: totalStudents || DEMO_FALLBACK.totalStudents,
      totalFaculty:  totalFaculty  || DEMO_FALLBACK.totalFaculty,
      averageAttendance, averageQuizScore, activeClassesCount: activeClasses.length,
      activeClasses, attendanceTrends, quizPerformance, streakLeaderboard, feedbackStats,
    };
  } catch (e) {
    console.error('[getInstitutionAnalytics] DB error:', e.message);
    return DEMO_FALLBACK;
  }
}

// ── Video Lectures ─────────────────────────────────────────────────────────────

export async function createVideoLecture({ title, description, subject, branch, section, videoUrl, duration, uploadedBy }) {
  if (!title || !subject || !videoUrl || !uploadedBy) throw new Error('Missing required video lecture fields');
  const db = await connectToDatabase();
  if (db && isValidObjectId(uploadedBy)) {
    try {
      const doc = new VideoLecture({ title, description, subject, branch, section, videoUrl, duration, uploadedBy });
      return await doc.save();
    } catch (e) { console.error('DB error in createVideoLecture:', e.message); throw e; }
  }
  const doc = {
    _id: '64f1a2b3c4d5e6f7a8b9d' + Math.floor(Math.random() * 8999 + 1000),
    title, description, subject, branch: branch || 'CSE', section: section || '',
    videoUrl, duration: duration || '',
    uploadedBy: { _id: uploadedBy, name: 'Faculty' },
    createdAt: new Date(),
  };
  inMemoryStore.videoLectures.push(doc);
  return doc;
}

export async function getVideoLectures({ subject, branch, section, audienceSection, uploadedBy } = {}) {
  const db = await connectToDatabase();
  if (db) {
    try {
      const filter = {};
      if (subject) filter.subject = subject;
      if (uploadedBy && isValidObjectId(uploadedBy)) filter.uploadedBy = uploadedBy;
      if (audienceSection) {
        Object.assign(filter, mongoAudienceFilter(audienceSection));
      } else {
        if (branch)  filter.branch  = branch;
        if (section) filter.section = section;
      }
      return await VideoLecture.find(filter).populate('uploadedBy', 'name').sort({ createdAt: -1 }).lean();
    } catch (e) { console.error('DB error in getVideoLectures:', e.message); }
  }
  return inMemoryStore.videoLectures.filter((v) =>
    (!subject || v.subject === subject) &&
    (!uploadedBy || String(v.uploadedBy?._id || v.uploadedBy) === String(uploadedBy)) &&
    (audienceSection
      ? matchesStudentAudience(v, audienceSection)
      : ((!branch  || v.branch  === branch) && (!section || v.section === section)))
  );
}

export async function deleteVideoLecture(videoId) {
  if (!videoId) throw new Error('videoId required');
  const db = await connectToDatabase();
  if (db && isValidObjectId(videoId)) {
    try { return await VideoLecture.findByIdAndDelete(videoId); }
    catch (e) { console.error('DB error in deleteVideoLecture:', e.message); throw e; }
  }
  const idx = inMemoryStore.videoLectures.findIndex(v => String(v._id) === String(videoId));
  if (idx !== -1) inMemoryStore.videoLectures.splice(idx, 1);
  return true;
}

// ── Notes & Resources ──────────────────────────────────────────────────────────

import Note from './models/Note.js';

if (!inMemoryStore.notes) {
  inMemoryStore.notes = [
    {
      _id: '64f1a2b3c4d5e6f7a8b9e001',
      title: 'MOSFET Small-Signal Model — Summary Sheet',
      content: 'Key equations: gm = 2ID/VGS-Vt, ro = VA/ID. Remember to include body effect for short-channel devices.',
      subject: 'Digital Electronics', branch: 'CSE', section: 'CSE-A',
      type: 'note', resourceUrl: '',
      uploadedBy: { _id: '64f1a2b3c4d5e6f7a8b9c004', name: 'Dr. Priya Nair' },
      createdAt: new Date(Date.now() - 86400000 * 2),
    },
    {
      _id: '64f1a2b3c4d5e6f7a8b9e002',
      title: 'Reference: CMOS VLSI Design Textbook (Weste & Harris)',
      content: 'Chapter 5 covers CMOS logic families in detail. Focus on sections 5.2–5.4 for the upcoming quiz.',
      subject: 'Digital Electronics', branch: 'CSE', section: 'CSE-A',
      type: 'resource', resourceUrl: 'https://www.cmosvlsi.com',
      uploadedBy: { _id: '64f1a2b3c4d5e6f7a8b9c004', name: 'Dr. Priya Nair' },
      createdAt: new Date(Date.now() - 86400000 * 1),
    },
    {
      _id: '64f1a2b3c4d5e6f7a8b9e003',
      title: 'Mid-Semester Exam Schedule — Announcement',
      content: 'Mid-semester exams are scheduled for next week. Syllabus: Units 1–3. Bring your ID cards.',
      subject: 'Digital Electronics', branch: 'CSE', section: 'CSE-A',
      type: 'announcement', resourceUrl: '',
      uploadedBy: { _id: '64f1a2b3c4d5e6f7a8b9c004', name: 'Dr. Priya Nair' },
      createdAt: new Date(Date.now() - 86400000 * 0.5),
    },
  ];
}

export async function createNote({ title, content, subject, branch, section, type, resourceUrl, uploadedBy }) {
  if (!title || !content || !subject || !uploadedBy) throw new Error('Missing required note fields');
  const db = await connectToDatabase();
  if (db && isValidObjectId(uploadedBy)) {
    try {
      const doc = new Note({ title, content, subject, branch, section, type, resourceUrl, uploadedBy });
      return await doc.save();
    } catch (e) { console.error('DB error in createNote:', e.message); throw e; }
  }
  const doc = {
    _id: '64f1a2b3c4d5e6f7a8b9e' + Math.floor(Math.random() * 8999 + 1000),
    title, content, subject, branch: branch || 'CSE', section: section || '',
    type: type || 'note', resourceUrl: resourceUrl || '',
    uploadedBy: { _id: uploadedBy, name: 'Faculty' },
    createdAt: new Date(),
  };
  inMemoryStore.notes.push(doc);
  return doc;
}

export async function getNotes({ subject, branch, section, audienceSection, uploadedBy } = {}) {
  const db = await connectToDatabase();
  if (db) {
    try {
      const filter = {};
      if (subject) filter.subject = subject;
      if (uploadedBy && isValidObjectId(uploadedBy)) filter.uploadedBy = uploadedBy;
      if (audienceSection) {
        Object.assign(filter, mongoAudienceFilter(audienceSection));
      } else {
        if (branch)  filter.branch  = branch;
        if (section) filter.section = section;
      }
      return await Note.find(filter).populate('uploadedBy', 'name').sort({ createdAt: -1 }).lean();
    } catch (e) { console.error('DB error in getNotes:', e.message); }
  }
  return inMemoryStore.notes.filter(n =>
    (!subject || n.subject === subject) &&
    (!uploadedBy || String(n.uploadedBy?._id || n.uploadedBy) === String(uploadedBy)) &&
    (audienceSection
      ? matchesStudentAudience(n, audienceSection)
      : ((!branch  || n.branch  === branch) && (!section || n.section === section)))
  );
}

export async function deleteNote(noteId) {
  if (!noteId) throw new Error('noteId required');
  const db = await connectToDatabase();
  if (db && isValidObjectId(noteId)) {
    try { return await Note.findByIdAndDelete(noteId); }
    catch (e) { console.error('DB error in deleteNote:', e.message); throw e; }
  }
  const idx = inMemoryStore.notes.findIndex(n => String(n._id) === String(noteId));
  if (idx !== -1) inMemoryStore.notes.splice(idx, 1);
  return true;
}

// ── Notices ────────────────────────────────────────────────────────────────────

import Notice from './models/Notice.js';
import ManualAttendance from './models/ManualAttendance.js';

if (!inMemoryStore.notices) inMemoryStore.notices = [];
if (!inMemoryStore.manualAttendance) inMemoryStore.manualAttendance = [];

export async function createNotice({ studentId, facultyId, type, subject, message }) {
  if (!studentId || !facultyId || !subject || !message) throw new Error('Missing notice fields');
  const db = await connectToDatabase();
  if (db && isValidObjectId(studentId) && isValidObjectId(facultyId)) {
    try {
      const doc = new Notice({ studentId, facultyId, type, subject, message });
      return await doc.save();
    } catch (e) { console.error('DB error in createNotice:', e.message); throw e; }
  }
  const doc = {
    _id: 'notice_' + Date.now(),
    studentId, facultyId, type: type || 'notice', subject, message,
    isRead: false, createdAt: new Date(),
  };
  inMemoryStore.notices.push(doc);
  return doc;
}

export async function getNoticesForStudent(studentId) {
  if (!studentId) return [];
  const db = await connectToDatabase();
  if (db && isValidObjectId(studentId)) {
    try {
      return await Notice.find({ studentId })
        .populate('facultyId', 'name')
        .sort({ createdAt: -1 }).lean();
    } catch (e) { console.error('DB error in getNoticesForStudent:', e.message); }
  }
  return inMemoryStore.notices.filter(n => String(n.studentId) === String(studentId));
}

export async function getNoticesByFaculty(facultyId) {
  if (!facultyId) return [];
  const db = await connectToDatabase();
  if (db && isValidObjectId(facultyId)) {
    try {
      return await Notice.find({ facultyId })
        .populate('studentId', 'name classOrSubject')
        .sort({ createdAt: -1 }).lean();
    } catch (e) { console.error('DB error in getNoticesByFaculty:', e.message); }
  }
  return inMemoryStore.notices.filter(n => String(n.facultyId) === String(facultyId));
}

// ── Manual Attendance ──────────────────────────────────────────────────────────

export async function saveManualAttendance({ facultyId, section, subject, date, records }) {
  if (!facultyId || !section || !records?.length) throw new Error('Missing manual attendance fields');
  const db = await connectToDatabase();
  if (db && isValidObjectId(facultyId)) {
    try {
      // Upsert: one record per faculty+section+date
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const doc = await ManualAttendance.findOneAndUpdate(
        { facultyId, section, date: dateObj },
        { $set: { subject, records, createdAt: new Date() } },
        { upsert: true, returnDocument: 'after' }
      );
      // Also write individual AttendanceRecord rows so dashboard reflects it
      for (const r of records) {
        if (!isValidObjectId(r.studentId)) continue;
        await AttendanceRecord.findOneAndUpdate(
          { studentId: r.studentId, facultyId, date: dateObj },
          { $set: { status: r.status, confidenceScore: 100, livenessVerified: false } },
          { upsert: true }
        );
      }
      return doc;
    } catch (e) { console.error('DB error in saveManualAttendance:', e.message); throw e; }
  }
  const doc = {
    _id: 'manual_' + Date.now(),
    facultyId, section, subject, date: new Date(date), records, createdAt: new Date(),
  };
  inMemoryStore.manualAttendance.push(doc);
  // Also push to in-memory attendance
  for (const r of records) {
    inMemoryStore.attendance.push({
      _id: 'att_' + Date.now() + Math.random(),
      studentId: r.studentId, facultyId,
      date: new Date(date), status: r.status,
      confidenceScore: 100, livenessVerified: false, createdAt: new Date(),
    });
  }
  return doc;
}

export async function getManualAttendanceByFaculty(facultyId) {
  if (!facultyId) return [];
  const db = await connectToDatabase();
  if (db && isValidObjectId(facultyId)) {
    try {
      return await ManualAttendance.find({ facultyId }).sort({ date: -1 }).lean();
    } catch (e) { console.error('DB error in getManualAttendanceByFaculty:', e.message); }
  }
  return inMemoryStore.manualAttendance.filter(m => String(m.facultyId) === String(facultyId));
}

export async function getManualAttendanceSummary() {
  const db = await connectToDatabase();
  if (db) {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const docs = await ManualAttendance.find({ date: { $gte: sevenDaysAgo } })
        .populate('facultyId', 'name').sort({ date: -1 }).lean();
      return docs;
    } catch (e) { console.error('DB error in getManualAttendanceSummary:', e.message); }
  }
  return inMemoryStore.manualAttendance.slice(-10);
}
