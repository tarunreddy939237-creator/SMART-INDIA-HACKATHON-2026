'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  ArrowRight,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';
import Badge from '@/components/shared/Badge';
import Modal from '@/components/shared/Modal';
import LoadingState from '@/components/shared/LoadingState';

interface QuizQuestion {
  _id?: string;
  question: string;
  options: string[];
  topic: string;
}

interface QuizItem {
  _id: string;
  subject: string;
  questions: QuizQuestion[];
}

interface QuizResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  weakTopics: string[];
  breakdown: {
    question: string;
    topic: string;
    selectedAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
  }[];
}

export default function StudentQuizzesPage() {
  const { data: session } = useSession();
  const studentSection = (session?.user as any)?.classOrSubject || '';
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizItem | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(600);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [explainingIdx, setExplainingIdx] = useState<number | null>(null);

  useEffect(() => {
    async function loadQuizzes() {
      try {
        const params = studentSection ? `?section=${encodeURIComponent(studentSection)}` : '';
        const res = await fetch(`/api/quizzes${params}`);
        const data = await res.json();
        if (data.quizzes) {
          setQuizzes(data.quizzes);
        }
      } catch (err) {
        console.error('Error fetching quizzes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadQuizzes();
  }, [studentSection]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isQuizActive && timeLeft > 0 && !quizResult) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isQuizActive, timeLeft, quizResult]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && isQuizActive && !quizResult) {
      handleSubmitQuiz();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const handleStartQuiz = (quiz: QuizItem) => {
    setSelectedQuiz(quiz);
    setActiveQuestionIdx(0);
    setSelectedAnswers({});
    setTimeLeft(quiz.questions.length * 90);
    setIsQuizActive(true);
    setQuizResult(null);
  };

  const handleSelectOption = (optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [activeQuestionIdx]: optionIdx,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!selectedQuiz || isSubmitting) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const answersArray = selectedQuiz.questions.map((_, i) =>
        selectedAnswers[i] !== undefined ? selectedAnswers[i] : -1
      );

      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          quizId: selectedQuiz._id,
          selectedAnswers: answersArray,
        }),
      });

      const data = await res.json();
      if (data.result) {
        setQuizResult(data.result);
        setIsQuizActive(false);
        if (data.result.score >= 75) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      }
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExplainWrong = async (idx: number) => {
    if (!quizResult || !selectedQuiz || explainingIdx !== null) return;
    setExplainingIdx(idx);
    const item = quizResult.breakdown[idx];
    const question = selectedQuiz.questions[idx];
    const correctOption = question.options[item.correctAnswer];
    const selectedOption = item.selectedAnswer >= 0 ? question.options[item.selectedAnswer] : 'No answer';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `In a quiz on ${item.topic}, I was asked: "${item.question}"\n\nI chose: "${selectedOption}"\nThe correct answer was: "${correctOption}"\n\nExplain why my answer was wrong in 2-3 sentences. Be specific about the misconception. Then give me the key rule to remember.`,
          }],
          currentTopic: item.topic,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setExplanations(prev => ({ ...prev, [idx]: data.reply }));
      }
    } catch {
      setExplanations(prev => ({ ...prev, [idx]: 'Unable to generate explanation. Please try again.' }));
    } finally {
      setExplainingIdx(null);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6FA] text-slate-900">
      <StudentSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title="Quizzes" subtitle="Practice & diagnostic assessments" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Course Practice Assessments
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Zero client-side leakage • Server-side verification & automatic streak tracking
              </p>
            </div>

            {isQuizActive && (
              <div className={`px-4 py-2 rounded-xl font-mono text-sm font-bold flex items-center gap-2 border ${
                timeLeft < 60 ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' : 'bg-white text-indigo-700 border-indigo-200 shadow-xs'
              }`}>
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Time Left: {formatTime(timeLeft)}</span>
              </div>
            )}
          </div>

          {loading ? (
            <LoadingState message="Fetching active question banks..." />
          ) : !isQuizActive && !quizResult ? (
            /* QUIZ SELECTION LIST */
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                Available Assessments for Section {studentSection || 'Your Class'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz._id}
                    className="study-card p-6 study-card-hover flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="indigo" size="md">
                          {quiz.subject}
                        </Badge>
                        <span className="text-xs text-slate-500 font-medium">
                          {quiz.questions.length} MCQs
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{quiz.subject} Diagnostic</h3>
                      <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                        Timed evaluation on core theoretical derivations, timing delays, and numerical concepts.
                      </p>
                    </div>

                    <button
                      onClick={() => handleStartQuiz(quiz)}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>Begin Assessment</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : isQuizActive && selectedQuiz ? (
            /* ACTIVE QUIZ PLAYER */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Question card */}
              <div className="lg:col-span-8 space-y-4">
                <div className="study-card p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold text-indigo-700">
                      QUESTION {activeQuestionIdx + 1} OF {selectedQuiz.questions.length}
                    </span>
                    <Badge variant="slate" size="sm">
                      Topic: {selectedQuiz.questions[activeQuestionIdx].topic}
                    </Badge>
                  </div>

                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-6 leading-relaxed">
                    {selectedQuiz.questions[activeQuestionIdx].question}
                  </h3>

                  {/* Options */}
                  <div className="space-y-3">
                    {selectedQuiz.questions[activeQuestionIdx].options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[activeQuestionIdx] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-600'
                            }`}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Navigation Footer */}
                  <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={activeQuestionIdx === 0}
                      onClick={() => setActiveQuestionIdx((prev) => prev - 1)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-semibold text-slate-700"
                    >
                      ← Previous
                    </button>

                    {activeQuestionIdx < selectedQuiz.questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setActiveQuestionIdx((prev) => prev + 1)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Next Question</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowConfirmModal(true)}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                      >
                        Submit Test
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Question Palette */}
              <div className="lg:col-span-4 space-y-4">
                <div className="study-card p-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Question Palette
                  </h4>
                  <div className="grid grid-cols-4 gap-2 mb-6">
                    {selectedQuiz.questions.map((_, idx) => {
                      const isAnswered = selectedAnswers[idx] !== undefined;
                      const isCurrent = activeQuestionIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveQuestionIdx(idx)}
                          className={`h-10 rounded-xl font-mono text-xs font-bold border transition-all ${
                            isCurrent
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : isAnswered
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span>Answered:</span>
                      <span className="font-mono text-emerald-600 font-bold">
                        {Object.keys(selectedAnswers).length} of {selectedQuiz.questions.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Unanswered:</span>
                      <span className="font-mono text-amber-600 font-bold">
                        {selectedQuiz.questions.length - Object.keys(selectedAnswers).length}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="w-full mt-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-xs"
                  >
                    Finish & Submit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* QUIZ RESULT SCREEN */
            quizResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 max-w-3xl mx-auto"
              >
                <div className="study-card p-8 text-center space-y-3 bg-white border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto">
                    <Award className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Assessment Result</h2>
                  <div className="text-5xl font-black text-indigo-600 font-mono">
                    {quizResult.score}%
                  </div>
                  <p className="text-xs text-slate-600">
                    You answered <span className="text-emerald-600 font-bold">{quizResult.correctCount}</span> of{' '}
                    <span className="font-bold">{quizResult.totalQuestions}</span> questions correctly.
                  </p>

                  {quizResult.weakTopics.length > 0 && (
                    <div className="pt-3 max-w-md mx-auto">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Concepts Flagged for Review:
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {quizResult.weakTopics.map((t, i) => (
                          <span
                            key={i}
                            className="text-xs px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => {
                        setQuizResult(null);
                        setIsQuizActive(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Return to Catalog
                    </button>
                    <a
                      href="/student/learning"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Generate AI Study Plan for Weak Concepts</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Question Breakdown with AI Explanations */}
                <div className="study-card p-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900">Question Verification Breakdown</h3>
                  <div className="space-y-4">
                    {quizResult.breakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border text-xs ${
                          item.isCorrect
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50/60 border-rose-200 text-rose-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-slate-900">
                            {idx + 1}. {item.question}
                          </p>
                          {item.isCorrect ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-bold shrink-0">
                              <CheckCircle2 className="w-4 h-4" /> Correct
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-rose-700 font-bold shrink-0">
                              <XCircle className="w-4 h-4" /> Missed
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Topic: <span className="text-slate-700 font-medium">{item.topic}</span>
                        </p>

                        {/* Show correct answer for wrong answers */}
                        {!item.isCorrect && selectedQuiz && (
                          <div className="mb-2 p-2.5 rounded-lg bg-white/80 border border-rose-200/50">
                            <p className="text-[11px] text-rose-700">
                              <span className="font-bold">Correct answer:</span> {selectedQuiz.questions[idx].options[item.correctAnswer]}
                            </p>
                            <p className="text-[11px] text-rose-600/70 mt-0.5">
                              <span className="font-bold">Your answer:</span> {item.selectedAnswer >= 0 ? selectedQuiz.questions[idx].options[item.selectedAnswer] : 'No answer'}
                            </p>
                          </div>
                        )}

                        {/* Why Did I Get This Wrong? button */}
                        {!item.isCorrect && (
                          <div>
                            {explanations[idx] ? (
                              <div className="p-3 rounded-lg bg-white/80 border border-indigo-200/50">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Sparkles className="w-3 h-3 text-indigo-600" />
                                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">AI Explanation</span>
                                </div>
                                <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  {explanations[idx].split(/(\*\*[^*]+\*\*)/).map((part, pi) =>
                                    part.startsWith('**') && part.endsWith('**')
                                      ? <strong key={pi}>{part.slice(2, -2)}</strong>
                                      : <React.Fragment key={pi}>{part}</React.Fragment>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleExplainWrong(idx)}
                                disabled={explainingIdx !== null}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                                  bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300
                                  disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {explainingIdx === idx ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Explaining...</>
                                ) : (
                                  <><Sparkles className="w-3 h-3" /> Why did I get this wrong?</>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )
          )}
        </main>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Submit Assessment?"
        subtitle="Your answers will be calculated server-side and recorded to your academic profile."
      >
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          Are you sure you want to finish? You have answered{' '}
          <strong className="text-indigo-600">{Object.keys(selectedAnswers).length}</strong> of{' '}
          <strong>{selectedQuiz?.questions.length}</strong> questions.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setShowConfirmModal(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            Continue Test
          </button>
          <button
            onClick={handleSubmitQuiz}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
          >
            {isSubmitting ? 'Verifying...' : 'Yes, Submit Now'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
