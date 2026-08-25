'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare, Star, ShieldCheck, Send, CheckCircle2, Lock,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';

interface SubjectOption {
  label: string;
  value: string;
  facultyId?: string;
}

export default function StudentFeedbackPage() {
  const { data: session } = useSession();
  const studentId = (session?.user as any)?.id || '';

  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [anonymized, setAnonymized] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load student's subjects from their profile
  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/students?studentId=${studentId}`)
      .then(r => r.json())
      .then(d => {
        const all: SubjectOption[] = [
          ...(d.student?.subjects || []).map((s: string) => ({ label: s, value: s })),
          ...(d.student?.labs || []).map((s: string) => ({ label: s + ' (Lab)', value: s })),
        ];
        if (all.length > 0) setSubjectOptions(all);
      })
      .catch(() => {});
  }, [studentId]);

  const selected = subjectOptions[selectedIdx];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectOrFacultyId: selected.value,
          facultyId: selected.facultyId || null,
          rating,
          comment,
          anonymized,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setComment('');
      }
    } catch (err) {
      console.error('Feedback submission failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6FA] text-slate-900">
      <StudentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title="Feedback" subtitle="Course & faculty feedback" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6 overflow-y-auto">

          <div className="pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 live-indicator" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Encrypted & Anonymized Feedback
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Course & Faculty Sentiment Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Provide anonymous pedagogical insights to help faculty adjust lecture pace, clarity, and problem-solving depth.
            </p>
          </div>

          <div className="study-card p-4 border-emerald-200 bg-emerald-50/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-900">Privacy-First Architecture</h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                When anonymized mode is enabled, your student ID is permanently decoupled from your rating and feedback.
              </p>
            </div>
          </div>

          <div className="study-card p-6 sm:p-8">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Feedback Recorded Successfully</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Thank you for contributing to institutional learning quality.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                >
                  Submit Another Feedback
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Select Subject
                  </label>
                  {subjectOptions.length === 0 ? (
                    <p className="text-xs text-slate-400">Loading your subjects…</p>
                  ) : (
                    <select
                      value={selectedIdx}
                      onChange={(e) => setSelectedIdx(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none"
                    >
                      {subjectOptions.map((opt, i) => (
                        <option key={i} value={i}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                    Effectiveness Rating (1 to 5 Stars)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating !== null ? hoverRating : rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => setRating(star)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
                        >
                          <Star className={`w-6 h-6 transition-colors ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        </button>
                      );
                    })}
                    <span className="text-xs font-bold text-amber-700 ml-3">{rating} of 5 Stars</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Constructive Feedback & Suggestions
                  </label>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share specific suggestions on concept explanations, practical lab demonstrations, or pacing..."
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl p-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Anonymize My Submission</p>
                      <p className="text-[10px] text-slate-500">Do not attach my name or student roll number</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={anonymized}
                    onChange={(e) => setAnonymized(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || subjectOptions.length === 0}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {loading ? <span>Submitting...</span> : <><Send className="w-4 h-4" /><span>Submit Encrypted Feedback</span></>}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
