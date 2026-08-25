'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, Clock, TrendingUp, TrendingDown, Minus,
  BookOpen, Target, Award, AlertTriangle, CheckCircle2, Users, Calendar,
  FileText, Brain, ChevronDown, ChevronUp,
} from 'lucide-react';

interface StudentReport {
  student: {
    id: string;
    name: string;
    rollNumber: string;
    yearOfStudy: number;
    branch: string;
    section: string;
    classOrSubject: string;
    collegeName: string;
  };
  attendance: {
    totalClasses: number;
    presentCount: number;
    absentCount: number;
    percentage: number;
    recent: { date: string; status: string; confidenceScore: number }[];
  };
  academics: {
    averageQuizScore: number;
    totalQuizzes: number;
    weakTopics: { topic: string; count: number }[];
  };
  assignments: { total: number; submitted: number; graded: number; averageScore: number };
  classTasks: { total: number; completed: number; percentage: number };
  risk: {
    score: number;
    riskTier: string;
    trend: string;
    factors: { name: string; weight: number; contribution: number; status: string; detail: string }[];
  } | null;
  streak: { current: number; longest: number; badges: string[] };
  summary: string;
  generatedAt: string;
}

export default function ParentReportPage() {
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    attendance: true,
    academics: true,
    risk: true,
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      // For parent portal, we need to know which student to show
      // The parent's user record should have a linked studentId
      // For now, fetch from the session or use a default
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      const studentId = session?.user?.id;

      if (!studentId) {
        setError('No student linked to this account.');
        setLoading(false);
        return;
      }

      const reportRes = await fetch(`/api/student-report?studentId=${studentId}`);
      if (!reportRes.ok) throw new Error('Failed to fetch report');
      const data = await reportRes.json();
      setReport(data.report);
    } catch (err) {
      setError('Failed to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 rounded-2xl bg-white border border-slate-200 max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Unable to Load Report</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { student, attendance, academics, assignments, classTasks, risk, streak, summary } = report;
  const riskColor = risk?.riskTier === 'High' ? 'rose' : risk?.riskTier === 'Medium' ? 'amber' : 'emerald';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Report</h1>
          <p className="text-sm text-slate-500 mt-1">{student.name} — {student.rollNumber} • {student.branch}-{student.section}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          Updated {new Date(report.generatedAt).toLocaleString()}
        </div>
      </div>

      {/* AI Summary */}
      {summary && (
        <div className="rounded-2xl p-5 border border-indigo-100" style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">AI Performance Summary</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Attendance" value={`${attendance.percentage}%`}
          color={attendance.percentage >= 75 ? 'emerald' : 'rose'} />
        <StatCard icon={Target} label="Quiz Average" value={`${academics.averageQuizScore}%`}
          color={academics.averageQuizScore >= 70 ? 'emerald' : 'amber'} />
        <StatCard icon={FileText} label="Assignments" value={`${assignments.submitted}/${assignments.total}`}
          color="indigo" />
        <StatCard icon={Award} label="Streak" value={`${streak.current} days`}
          color="amber" />
      </div>

      {/* Risk Indicator */}
      {risk && (
        <div className={`rounded-2xl p-5 border bg-${riskColor}-50 border-${riskColor}-200`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Risk</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-lg font-bold text-${riskColor}-700`}>{risk.riskTier}</span>
                {risk.trend === 'improving' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                {risk.trend === 'declining' && <TrendingDown className="w-4 h-4 text-rose-500" />}
                {risk.trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
              </div>
            </div>
          </div>
          {risk.factors.length > 0 && (
            <div className="mt-3 space-y-2">
              {risk.factors.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-28 text-slate-600 truncate">{f.name}</span>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${f.status === 'good' ? 'bg-emerald-500' : f.status === 'warn' ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(f.contribution, 100)}%` }} />
                  </div>
                  <span className="w-8 text-right text-slate-500">{f.weight}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance Section */}
      <CollapsibleSection title="Attendance" icon={Calendar} expanded={expandedSections.attendance} onToggle={() => toggle('attendance')}>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <MiniStat label="Total Classes" value={attendance.totalClasses} />
          <MiniStat label="Present" value={attendance.presentCount} color="emerald" />
          <MiniStat label="Absent" value={attendance.absentCount} color="rose" />
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${attendance.percentage}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">{attendance.percentage}% attendance rate</p>
      </CollapsibleSection>

      {/* Academics Section */}
      <CollapsibleSection title="Academic Performance" icon={BookOpen} expanded={expandedSections.academics} onToggle={() => toggle('academics')}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <MiniStat label="Quiz Average" value={`${academics.averageQuizScore}%`} />
          <MiniStat label="Quizzes Taken" value={academics.totalQuizzes} />
          <MiniStat label="Task Completion" value={`${classTasks.percentage}%`} />
          <MiniStat label="Assignment Score" value={`${assignments.averageScore}%`} />
        </div>
        {academics.weakTopics.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Areas Needing Attention</p>
            <div className="flex flex-wrap gap-2">
              {academics.weakTopics.map((w, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                  {w.topic} ({w.count}×)
                </span>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Badges */}
      {streak.badges.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> Achievements
          </h3>
          <div className="flex flex-wrap gap-2">
            {streak.badges.map((b, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                🏆 {b}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 text-${color}-500`} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color = 'slate' }: { label: string; value: any; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, expanded, onToggle, children }: {
  title: string; icon: any; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
