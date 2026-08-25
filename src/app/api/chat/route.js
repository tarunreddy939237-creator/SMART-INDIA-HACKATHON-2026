import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { getStudent360 } from '@/lib/student360.js';
import { geminiChat, geminiAvailable } from '@/lib/gemini.js';

export async function POST(request) {
  try {
    const session     = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const studentId   = session?.user?.id;
    const studentName = session?.user?.name || 'Aarav Sharma';

    const body = await request.json();
    const { messages, currentTopic, simplify } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Fetch real student context
    let ctx = null;
    try { ctx = await getStudent360(studentId); } catch { /* use null */ }
    const ai = ctx?.aiContext;

    // Limit history to last 6 messages to avoid Groq 413 token limit
    const recentMessages = messages.slice(-6);

    const contextBlock = ai ? `
Student context (verified data — do NOT invent or modify these numbers):
- Attendance: ${ai.attendance.percentage}% (${ai.attendance.trend} trend)
- Average quiz score: ${ai.academic.avgQuizScore}%
- Weak topics: ${(ai.academic.weakTopics || []).slice(0, 3).map((w) => w.topic).join(', ') || 'none identified yet'}
- Study streak: ${ai.streak.current} days
- Risk level: ${ai.riskTier}${ai.riskFactors?.length ? ' — ' + ai.riskFactors[0] : ''}
- Active focus: ${ai.activePlan?.focusAreas?.slice(0,2).join(', ') || currentTopic || 'General coursework'}` : '';


    const simplifyInstruction = simplify
      ? `\n\nIMPORTANT: The student found the previous explanation too complex. Re-explain your previous answer in simpler terms, as if to a beginner. Use a concrete everyday analogy or real-world example to make the concept intuitive. Avoid jargon. Keep it under 150 words. Start with something like "Let me explain that more simply..." or "Think of it this way..."`
      : '';

    const systemPrompt = `You are EduVision AI, a personalised academic mentor for engineering students.
Student name: ${studentName}.${contextBlock}${simplifyInstruction}
Rules:
- Use ONLY the verified data above when referencing the student's performance.
- Never invent marks, attendance percentages, or statistics.
- If the student's language preference is Telugu or Hindi, respond in that language.
- Provide rigorous yet intuitive explanations. Use markdown, bullet points, and equations where helpful.
- When the student asks about a weak topic listed above, prioritise explaining that concept first.`;

    const lastMessage = recentMessages[recentMessages.length - 1]?.content || '';

    // ── 1. Try Gemini ──────────────────────────────────────────────────────────
    if (geminiAvailable()) {
      try {
        // Convert history to Gemini format — must start with 'user' and alternate roles
        const rawHistory = recentMessages.slice(0, -1).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
        const history = [];
        let lastRole = '';
        for (const turn of rawHistory) {
          if (turn.role === lastRole) continue;
          if (history.length === 0 && turn.role !== 'user') continue;
          history.push(turn);
          lastRole = turn.role;
        }

        const reply = await geminiChat(systemPrompt, history, lastMessage);
        return NextResponse.json({ reply, source: 'groq-llama-3.3-70b' });
      } catch (groqErr) {
        console.warn('[chat] Groq error, trying Anthropic fallback:', groqErr.message);
      }
    }

    // ── 2. Try Anthropic fallback ──────────────────────────────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && anthropicKey.trim() !== '' && !anthropicKey.startsWith('<')) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const formattedMessages = recentMessages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          system: systemPrompt,
          messages: formattedMessages,
        });
        const reply = response.content[0]?.text || 'No response generated.';
        return NextResponse.json({ reply, source: 'claude-sonnet-4-5' });
      } catch (anthropicErr) {
        console.warn('[chat] Anthropic error:', anthropicErr.message);
      }
    }

    // ── 3. Offline fallback ────────────────────────────────────────────────────
    return NextResponse.json({
      reply: getTutorFallbackResponse(lastMessage),
      source: 'eduvision-offline-engine',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

function getTutorFallbackResponse(query = '') {
  const q = query.toLowerCase();
  if (q.includes('mosfet') || q.includes('channel') || q.includes('transistor')) {
    return `### MOSFET Channel & Operation Principles\n\nIn an **Enhancement MOSFET**, channel formation occurs as follows:\n\n1. **Cutoff Region ($V_{GS} < V_{th}$):** No conducting channel exists. Current $I_D \\approx 0$.\n2. **Triode Region ($V_{GS} > V_{th}$, $V_{DS} < V_{GS} - V_{th}$):**\n   $$I_D = \\mu_n C_{ox} \\frac{W}{L} \\left[(V_{GS} - V_{th})V_{DS} - \\frac{V_{DS}^2}{2}\\right]$$\n3. **Saturation Region ($V_{DS} \\ge V_{GS} - V_{th}$):**\n   $$I_D = \\frac{1}{2} \\mu_n C_{ox} \\frac{W}{L} (V_{GS} - V_{th})^2$$\n\n💡 Bias in saturation for amplification; triode for digital switching.`;
  }
  if (q.includes('delay') || q.includes('cmos') || q.includes('timing')) {
    return `### CMOS Propagation Delay\n\n- **Elmore Delay:** $t_{pd} \\approx 0.69 \\cdot R_{eq} \\cdot C_L$\n- NAND gates are faster than NOR because NMOS (higher $\\mu_n$) are in series in NAND vs PMOS in NOR.\n\n⚡ Use Logical Effort theory to size transistors on critical paths.`;
  }
  if (q.includes('tree') || q.includes('graph') || q.includes('sort') || q.includes('dsa')) {
    return `### Data Structures Quick Reference\n\n- **Red-Black Tree:** $O(\\log n)$ search/insert/delete, height $\\le 2\\log_2(n+1)$\n- **BFS/DFS:** $O(V + E)$ with adjacency lists\n- **Dynamic Array amortized push:** $O(1)$\n\nWhich specific problem would you like to work through?`;
  }
  return `### Academic Explanation\n\nBreak the problem into boundary conditions, state variables, and governing equations. Always verify with dimensional analysis or small test cases.\n\nFeel free to ask a follow-up or paste code/equations!`;
}
