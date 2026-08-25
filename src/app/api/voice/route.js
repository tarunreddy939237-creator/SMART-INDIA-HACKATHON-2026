import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import AcademicEvent from '@/lib/models/AcademicEvent.js';
import { ClassTask } from '@/lib/models/ClassTask.js';
import { buildTargetAudience, validateFacultyTarget, parseClassOrSubject, describeTargetAudience } from '@/lib/targeting.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * POST /api/voice
 *
 * Accepts: { text: string, mode: 'faculty' | 'student', context?: object }
 *
 * For faculty: Parses intent → validates → creates events/tasks
 * For students: Queries academic data → returns natural language response
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, mode = 'student' } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id).lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── Faculty Mode: Parse voice command into structured intent ──
    if (mode === 'faculty' && (user.role === 'faculty' || user.role === 'admin')) {
      return await handleFacultyCommand(user, text.trim());
    }

    // ── Student Mode: Answer academic queries ──
    if (mode === 'student' && user.role === 'student') {
      return await handleStudentQuery(user, text.trim());
    }

    return NextResponse.json({ error: 'Invalid mode for your role' }, { status: 403 });
  } catch (error) {
    console.error('[voice] POST error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

// ── Faculty Voice Command Handler ─────────────────────────────────────────
async function handleFacultyCommand(faculty, text) {
  const { branch: facultyBranch, section: facultySection } = parseClassOrSubject(faculty.classOrSubject);

  // Use Groq to parse the voice command into structured intent
  const systemPrompt = `You are an academic command parser. Convert the faculty's spoken command into a structured JSON intent.

The faculty's department is: ${facultyBranch}
The faculty's section is: ${facultySection || 'Not specified'}

Extract:
- action: "create_event" | "create_task" | "query" | "update_event" | "help"
- title: event/task title
- eventType: "exam" | "assignment" | "project" | "internal_assessment" | "lab_exam" | "class_test" | "workshop" | "seminar" | "holiday" | "other"
- branch: target branch (default: faculty's department)
- year: target year (1-4, 0 if not specified)
- semester: target semester (1-2, 0 if not specified)
- section: target section
- subject: subject name
- date: ISO date string (YYYY-MM-DD) if mentioned
- deadline: ISO date string if mentioned
- description: any additional details
- priority: "normal" | "important" | "critical"
- venue: location if mentioned

Return ONLY valid JSON. No explanation text.
Example: {"action":"create_event","title":"DSP Mid-1 Exam","eventType":"exam","branch":"ECE","year":2,"section":"A","subject":"Digital Signal Processing","date":"2026-09-12","priority":"important"}

If the command is unclear, return: {"action":"help","message":"Could you be more specific?"}`;

  const intent = await callGroq(systemPrompt, text);

  // Validate and process the intent
  try {
    const parsed = JSON.parse(intent);

    if (parsed.action === 'help') {
      return NextResponse.json({
        success: true,
        type: 'help',
        message: parsed.message || 'I can help you create events, tasks, and assignments. Try saying: "Create a DSP assignment for ECE second year due September 10."',
      });
    }

    if (parsed.action === 'create_event' || parsed.action === 'create_task') {
      // Build target audience
      const audience = buildTargetAudience({
        branch: parsed.branch || facultyBranch,
        year: parsed.year || 0,
        semester: parsed.semester || 0,
        section: parsed.section || facultySection || '',
        subject: parsed.subject || '',
      });

      // Validate faculty authorization
      const auth = validateFacultyTarget(faculty, audience);
      if (!auth.valid) {
        return NextResponse.json({
          success: false,
          type: 'error',
          message: auth.error,
        });
      }

      // Count matching students
      const studentQuery = { role: 'student' };
      if (audience.branch) {
        const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        studentQuery.classOrSubject = new RegExp(`^${escapeRegex(audience.branch)}`, 'i');
        if (audience.section) {
          studentQuery.classOrSubject = new RegExp(`^${escapeRegex(audience.branch)}[-_\\s]?${escapeRegex(audience.section)}$`, 'i');
        }
      }
      const matchingCount = await User.countDocuments(studentQuery);

      // Return preview for confirmation (DO NOT auto-publish)
      return NextResponse.json({
        success: true,
        type: 'preview',
        intent: {
          ...parsed,
          targetAudience: audience,
          targetDescription: describeTargetAudience(audience),
          matchingStudents: matchingCount,
        },
        message: `Create ${parsed.eventType || 'event'}: "${parsed.title}" for ${describeTargetAudience(audience)}? (${matchingCount} students will receive this)`,
        requiresConfirmation: true,
      });
    }

    if (parsed.action === 'query') {
      return NextResponse.json({
        success: true,
        type: 'query',
        intent: parsed,
        message: `Query received: ${JSON.stringify(parsed)}`,
      });
    }

    return NextResponse.json({
      success: false,
      type: 'unknown',
      message: 'I didn\'t understand that command. Try: "Create an assignment for ECE second year section A due September 10."',
    });
  } catch (parseErr) {
    // If Groq returned non-JSON, treat as natural language
    return NextResponse.json({
      success: true,
      type: 'response',
      message: intent,
    });
  }
}

// ── Student Voice Query Handler ───────────────────────────────────────────
async function handleStudentQuery(student, text) {
  const { branch, section } = parseClassOrSubject(student.classOrSubject);

  // Fetch student's relevant academic data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 7);

  const [events, tasks] = await Promise.all([
    AcademicEvent.find({
      isActive: true,
      date: { $gte: today, $lte: tomorrow },
      $or: [
        { 'targetAudience.branch': branch },
        { 'targetAudience.section': section },
        { targetSections: section },
        { section: section },
      ],
    }).sort({ date: 1 }).lean(),
    ClassTask.find({
      isActive: true,
      dueDate: { $gte: today, $lte: tomorrow },
      $or: [
        { section: `${branch}-${section}` },
        { section: section },
        { 'targetAudience.branch': branch },
        { 'targetAudience.section': section },
      ],
    }).sort({ dueDate: 1 }).lean(),
  ]);

  const academicContext = {
    student: student.name,
    branch,
    section,
    subjects: student.subjects || [],
    todayEvents: events.filter(e => {
      const d = new Date(e.date);
      return d.toDateString() === today.toDateString();
    }),
    upcomingEvents: events,
    todayTasks: tasks.filter(t => {
      const d = new Date(t.dueDate);
      return d.toDateString() === today.toDateString();
    }),
    upcomingTasks: tasks,
  };

  const systemPrompt = `You are EduVision AI, an academic assistant for ${student.name}.
Student info: ${branch} branch, Section ${section}
Subjects: ${(student.subjects || []).join(', ')}

Today's data:
- Events today: ${academicContext.todayEvents.length}
- Events this week: ${academicContext.upcomingEvents.length}
- Tasks today: ${academicContext.todayTasks.length}
- Tasks this week: ${academicContext.upcomingTasks.length}

Upcoming events: ${academicContext.upcomingEvents.map(e => `${e.title} on ${new Date(e.date).toLocaleDateString()}`).join('; ') || 'None'}
Upcoming tasks: ${academicContext.upcomingTasks.map(t => `${t.title} due ${new Date(t.dueDate).toLocaleDateString()}`).join('; ') || 'None'}

Rules:
- Answer using ONLY the data above.
- Be concise and helpful.
- Use the student's actual academic data.
- If you don't have data for something, say so.
- Respond in 2-3 sentences max.`;

  const reply = await callGroq(systemPrompt, text);

  return NextResponse.json({
    success: true,
    type: 'response',
    message: reply,
    context: {
      eventsCount: academicContext.upcomingEvents.length,
      tasksCount: academicContext.upcomingTasks.length,
    },
  });
}

// ── Groq API Call ─────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userMessage) {
  if (!GROQ_API_KEY || GROQ_API_KEY.startsWith('<')) {
    // Fallback: simple keyword-based response
    return getFallbackResponse(userMessage);
  }

  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      console.warn('[voice] Groq API error:', res.status);
      return getFallbackResponse(userMessage);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || getFallbackResponse(userMessage);
  } catch (err) {
    console.warn('[voice] Groq call failed:', err.message);
    return getFallbackResponse(userMessage);
  }
}

// ── Offline Fallback ──────────────────────────────────────────────────────
function getFallbackResponse(text) {
  const lower = text.toLowerCase();

  if (lower.includes('today') || lower.includes('what do i have')) {
    return JSON.stringify({
      action: 'query',
      response: 'Let me check your schedule. You can view your tasks and events on the dashboard.',
    });
  }

  if (lower.includes('exam') || lower.includes('test')) {
    return 'Check your Academic Calendar for upcoming exams. You can view them on your student dashboard.';
  }

  if (lower.includes('assignment') || lower.includes('deadline')) {
    return 'Your pending assignments and deadlines are shown in the "Upcoming Deadlines" section of your dashboard.';
  }

  if (lower.includes('study') || lower.includes('what should i')) {
    return 'Based on your performance, I recommend reviewing your weak topics. Open the AI Study Copilot for personalized recommendations.';
  }

  return 'I can help you with your academic schedule, deadlines, and study recommendations. Try asking about your tasks, exams, or what to study today.';
}
