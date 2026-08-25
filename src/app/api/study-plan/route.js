import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { getStudent360 } from '@/lib/student360.js';
import LearningPlan from '@/lib/models/LearningPlan.js';
import connectToDatabase from '@/lib/mongodb.js';
import { geminiGenerate, geminiAvailable } from '@/lib/gemini.js';

export async function GET(request) {
  try {
    const session     = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const studentId   = session?.user?.id;
    const studentName = session?.user?.name || 'Aarav Sharma';

    const { searchParams } = new URL(request.url);
    const selectedSubject = searchParams.get('subject') || '';

    const s360 = await getStudent360(studentId);

    const targetWeakTopics = s360?.quizSummary?.weakTopics?.length
      ? s360.quizSummary.weakTopics.slice(0, 3) // max 3 topics to keep prompt small
      : [
          { topic: 'MOSFET Biasing & Small-Signal Models', missedCount: 2 },
          { topic: 'Propagation Delay in CMOS Logic',      missedCount: 1 },
          { topic: 'Balanced Search Tree Rotations',       missedCount: 1 },
        ];

    const riskContext = s360?.score
      ? { riskTier: s360.score.riskTier, riskFactors: (s360.score.riskFactors || []).slice(0, 3), successScore: s360.score.successScore }
      : null;

    // Compact weak topics for the prompt (topic names only, no full objects)
    const weakTopicNames = targetWeakTopics.map(w => w.topic).join(', ');
    const riskLine = riskContext
      ? `Risk: ${riskContext.riskTier} (score ${riskContext.successScore}/100). Factors: ${riskContext.riskFactors.join('; ')}.`
      : '';

    const planPrompt = `You are an academic AI tutor. Generate a 3-day study plan as STRICT JSON only (no markdown, no LaTeX).
${selectedSubject ? `Focus subject: ${selectedSubject}.` : ''}Weak topics: ${weakTopicNames}. ${riskLine}
JSON schema:
{"summary":"2-sentence assessment","focusAreas":["topic1","topic2"],"days":[{"day":1,"title":"Title","duration":"45 mins","concepts":["A","B"],"actionItems":["Action1"],"recommendedResource":"Resource"}],"estimatedScoreBoost":"+14%"}`;


    // ── 1. Try Gemini ──────────────────────────────────────────────────────────
    if (geminiAvailable()) {
      try {
        const text = await geminiGenerate(planPrompt);
        const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const safe = jsonMatch[0].replace(/\\(?!["\\\//bfnrtu])/g, '\\\\');
          const parsed = JSON.parse(safe);
          persistPlan(studentId, targetWeakTopics, riskContext, parsed, 'groq-llama-3.3-70b').catch(() => {});
          return NextResponse.json({ success: true, source: 'groq-llama-3.3-70b', plan: parsed, weakTopics: targetWeakTopics, riskContext });
        }
      } catch (groqErr) {
        console.warn('[study-plan] Groq error:', groqErr.message);
      }
    }

    // ── 2. Try Anthropic fallback ──────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey.trim() !== '' && !apiKey.startsWith('<')) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey });
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 1500,
          messages: [{ role: 'user', content: planPrompt }],
        });
        const textContent = message.content[0]?.text || '';
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          persistPlan(studentId, targetWeakTopics, riskContext, parsed, 'claude-sonnet-4-5').catch(() => {});
          return NextResponse.json({ success: true, source: 'claude-sonnet-4-5', plan: parsed, weakTopics: targetWeakTopics, riskContext });
        }
      } catch (anthropicErr) {
        console.warn('[study-plan] Anthropic error:', anthropicErr.message);
      }
    }

    // ── 3. Deterministic fallback ──────────────────────────────────────────────
    const plan = generateDeterministicPlan(studentName, targetWeakTopics, riskContext);
    persistPlan(studentId, targetWeakTopics, riskContext, plan, 'deterministic-intelligence').catch(() => {});
    return NextResponse.json({ success: true, source: 'deterministic-intelligence', plan, weakTopics: targetWeakTopics, riskContext });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

async function persistPlan(studentId, weakTopics, riskContext, plan, source) {
  try {
    const db = await connectToDatabase();
    if (!db) return;
    await LearningPlan.updateMany({ studentId, status: 'active' }, { $set: { status: 'superseded' } });
    await LearningPlan.create({
      studentId,
      weakTopics: weakTopics.map(w => w.topic),
      riskFactors: riskContext?.riskFactors || [],
      riskScoreAtGeneration: riskContext ? (100 - (riskContext.successScore || 0)) : 0,
      summary:    plan.summary,
      focusAreas: plan.focusAreas,
      days:       plan.days,
      estimatedScoreBoost: plan.estimatedScoreBoost,
      source,
      status: 'active',
    });
  } catch (e) {
    console.warn('[study-plan] persistPlan error:', e.message);
  }
}

function generateDeterministicPlan(studentName, weakTopics, riskContext = null) {
  const primaryTopic   = weakTopics[0]?.topic || 'MOSFET Biasing & Small-Signal Models';
  const secondaryTopic = weakTopics[1]?.topic || 'CMOS Propagation Delay';
  return {
    summary: `Diagnostic telemetry shows targeted remediation required in ${primaryTopic} and ${secondaryTopic}.`,
    focusAreas: [primaryTopic, secondaryTopic, 'High-Yield MCQ Drills'],
    days: [
      {
        day: 1, title: `Deep-Dive: ${primaryTopic}`, duration: '45 mins',
        concepts: ['Triode vs Saturation region equations', 'Body effect & threshold voltage', 'Transconductance (gm)'],
        actionItems: ['Review Lecture Notes Section 4.2', 'Solve 5 numeric problems on small-signal transconductance'],
        recommendedResource: 'Digital VLSI Circuit Analysis — Chapter 3',
      },
      {
        day: 2, title: `Timing Analysis: ${secondaryTopic}`, duration: '40 mins',
        concepts: ['RC delay models (Elmore delay)', 'Fall/Rise time trade-offs in CMOS'],
        actionItems: ['Calculate capacitive load scaling for 4-inverter chains', 'Complete 5-question MCQ quiz in Portal'],
        recommendedResource: 'CMOS VLSI Design (Weste & Harris) — Chapter 4',
      },
      {
        day: 3, title: 'Synthesis & Rapid Drills', duration: '35 mins',
        concepts: ['Cross-topic integration', 'Timing budget and clock skew margins'],
        actionItems: ['Attempt 15-minute simulated countdown test', 'Submit edge-case questions to AI Doubt Assistant'],
        recommendedResource: 'Interactive Simulator & Portal Practice Bank',
      },
    ],
    estimatedScoreBoost: '+18%',
  };
}
