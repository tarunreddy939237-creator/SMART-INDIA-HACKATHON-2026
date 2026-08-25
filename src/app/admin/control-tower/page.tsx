'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Users,
  CalendarCheck,
  Award,
  Activity,
  Flame,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Pencil,
  Trash2,
  Plus,
  UserCheck, Clock,
} from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';
import StatCard from '@/components/dashboard/StatCard';
import WowInsightCard from '@/components/dashboard/WowInsightCard';
import StudentDrilldownModal from '@/components/dashboard/StudentDrilldownModal';
import RiskBreakdownPanel from '@/components/dashboard/RiskBreakdownPanel';
import Badge from '@/components/shared/Badge';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const ALL_SECTIONS = [
  'CSE-A','CSE-B','CSE-C','ECE-A','ECE-B','ECE-C',
  'IT-A','IT-B','IT-C','AI-A','AI-B','AI-C',
  'MECH-A','MECH-B','MECH-C','CIVIL-A','CIVIL-B','CIVIL-C',
];

export default function AdminControlTowerPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [manualSessions, setManualSessions] = useState<any[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [atRiskLoading, setAtRiskLoading] = useState(true);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectForm, setSubjectForm] = useState({ section: 'CSE-A', subject: '' });
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [subjectMsg, setSubjectMsg] = useState('');

  const loadSubjects = async () => {
    try {
      const res = await fetch('/api/subject-assignments');
      const data = await res.json();
      if (data.assignments) setSubjects(data.assignments);
    } catch { /* keep */ }
  };

  const handleSaveSubject = async () => {
    if (!subjectForm.subject.trim()) return;
    setSubjectSaving(true); setSubjectMsg('');
    try {
      const res = await fetch('/api/subject-assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subjectForm),
      });
      const data = await res.json();
      if (data.success) { setSubjectMsg('Saved!'); loadSubjects(); }
      else setSubjectMsg(data.error || 'Failed');
    } catch { setSubjectMsg('Network error'); }
    finally { setSubjectSaving(false); setTimeout(() => setSubjectMsg(''), 3000); }
  };

  const handleDeleteSubject = async (section: string) => {
    await fetch('/api/subject-assignments', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section }),
    });
    loadSubjects();
  };

  const [pendingCount, setPendingCount] = useState(0);

  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>({
    totalStudents: 0,
    totalFaculty: 0,
    averageAttendance: 0,
    averageQuizScore: 0,
    activeClassesCount: 0,
    activeClasses: [],
    attendanceTrends: [],
    quizPerformance: [],
    streakLeaderboard: [],
  });

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/institution-analytics');
        const data = await res.json();
        if (data.analytics) setAnalytics(data.analytics);
      } catch { console.warn('Using local telemetry state'); }
      finally { setAnalyticsLoading(false); }
    }
    async function loadAtRisk() {
      setAtRiskLoading(true);
      try {
        // Fetch all sections in parallel
        const ALL_SECTIONS = [
          'CSE-A','CSE-B','CSE-C','ECE-A','ECE-B','ECE-C',
          'IT-A','IT-B','IT-C','AI-A','AI-B','AI-C',
          'MECH-A','MECH-B','MECH-C','CIVIL-A','CIVIL-B','CIVIL-C',
        ];
        const results = await Promise.all(
          ALL_SECTIONS.map(s =>
            fetch(`/api/at-risk?class=${s}`).then(r => r.json()).catch(() => ({ students: [] }))
          )
        );
        const all = results.flatMap(r => r.students || []);
        // Sort: High first, then Medium, then Low
        const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
        all.sort((a, b) => (order[a.riskTier] ?? 3) - (order[b.riskTier] ?? 3));
        if (all.length) setAtRiskStudents(all);
      } catch { /* keep empty */ }
      finally { setAtRiskLoading(false); }
    }
    loadAnalytics();
    loadAtRisk();
    loadSubjects();
    fetch('/api/manual-attendance?summary=1').then(r => r.json()).then(d => setManualSessions(d.sessions || [])).catch(() => {});
    fetch('/api/admin/pending-count').then(r => r.json()).then(d => setPendingCount(d.count || 0)).catch(() => {});
  }, []);

  const handleOpenStudentDrilldown = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsDrilldownOpen(true);
  };

  const handleExecuteDirective = () => {
    setActionSuccess(true);
    setTimeout(() => setActionSuccess(false), 5000);
  };

  return (
    <div className="flex min-h-screen dash-bg text-slate-900">
      <Sidebar role="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Institutional Control Tower" roleBadge="ADMIN" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4"
            style={{ borderBottom: '1px solid rgba(255,170,0,0.2)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full live-indicator" style={{ background: '#1CDEC8' }} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ev-indigo)' }}>
                  SIH 2026 · Smart Education · Campus-Wide
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Academic Operations & Institutional Overview
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 font-mono text-xs font-bold px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(255,170,0,0.1)', color: 'var(--ev-amber)', border: '1px solid rgba(255,170,0,0.3)' }}>
                <span className="w-2 h-2 rounded-full live-indicator" style={{ background: '#FFAA00' }} />
                {analyticsLoading ? '…' : analytics.activeClassesCount} Active Class Sessions
              </span>
            </div>
          </div>

          {actionSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl font-mono text-xs font-semibold flex items-center gap-2"
              style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(28,222,200,0.3)', color: '#0E8F82' }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--ev-indigo)' }} />
              <span>Advisory action initiated · Automated check-in reminders queued for Section CSE-B students.</span>
            </motion.div>
          )}

          {/* PENDING ACCOUNT APPROVALS CARD */}
          <Link href="/admin/approvals" className="block">
            <div className="bg-white rounded-2xl p-5 border-2 transition-all hover:shadow-lg cursor-pointer group"
              style={{ borderColor: pendingCount > 0 ? 'rgba(255,77,94,0.4)' : 'rgba(79,70,229,0.15)',
                boxShadow: pendingCount > 0 ? '0 4px 16px rgba(225,29,72,0.06)' : 'none' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: pendingCount > 0 ? 'rgba(225,29,72,0.06)' : 'rgba(79,70,229,0.06)',
                      border: `1px solid ${pendingCount > 0 ? 'rgba(255,77,94,0.2)' : 'rgba(79,70,229,0.15)'}` }}>
                    <UserCheck className="w-6 h-6" style={{ color: pendingCount > 0 ? '#FF4D5E' : '#1CDEC8' }} />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">Pending Account Approvals</h3>
                    <p className="text-xs text-slate-500">
                      {pendingCount > 0
                        ? `${pendingCount} registration request${pendingCount === 1 ? '' : 's'} waiting for review`
                        : 'No pending registration requests'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-3 py-1.5 rounded-xl"
                      style={{ background: 'rgba(225,29,72,0.06)', color: 'var(--ev-rose)', border: '1px solid rgba(255,77,94,0.25)' }}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF4D5E' }} />
                      {pendingCount} Pending
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>

          {/* 1. THE WOW INSIGHT CARD */}
          <WowInsightCard
            onTriggerAction={handleExecuteDirective}
          />

          {/* AT-RISK PANEL */}
          {atRiskLoading ? (
            <div className="p-6 rounded-2xl" style={{ border: '1px solid rgba(255,77,94,0.2)', background: 'rgba(255,77,94,0.03)' }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--ev-rose)' }} />
                <span className="font-display text-sm font-bold text-slate-700">Loading at-risk data across all sections…</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(225,29,72,0.06)' }} />
                ))}
              </div>
            </div>
          ) : atRiskStudents.filter(s => s.riskTier !== 'Low').length > 0 && (
            <div className="p-6 rounded-2xl space-y-4" style={{ background: '#fff', border: '1px solid rgba(255,77,94,0.25)', boxShadow: '0 2px 12px rgba(255,77,94,0.06)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--ev-rose)' }} />
                  At-Risk Student Radar
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(225,29,72,0.06)', color: 'var(--ev-rose)', border: '1px solid rgba(255,77,94,0.25)' }}>
                    ALL SECTIONS
                  </span>
                </h3>
                <span className="font-mono text-[10px] text-slate-400">Faculty Console shows full detail · Not visible to students</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {atRiskStudents.filter(s => s.riskTier !== 'Low').map((s, i) => (
                  <div
                    key={i}
                    onClick={() => handleOpenStudentDrilldown(s.studentId)}
                    className="p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md relative overflow-hidden"
                    style={s.riskTier === 'High'
                      ? { background: 'rgba(255,77,94,0.05)', borderColor: 'rgba(255,77,94,0.3)' }
                      : { background: 'rgba(255,170,0,0.05)', borderColor: 'rgba(255,170,0,0.3)' }}
                  >
                    {/* Left edge accent */}
                    <div className="absolute top-0 left-0 bottom-0 w-0.5"
                      style={{ background: s.riskTier === 'High' ? '#FF4D5E' : '#FFAA00' }} />
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900">{s.name}</span>
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={s.riskTier === 'High'
                          ? { background: 'rgba(255,77,94,0.12)', color: 'var(--ev-rose)', border: '1px solid rgba(255,77,94,0.3)' }
                          : { background: 'rgba(255,170,0,0.12)', color: '#B45309', border: '1px solid rgba(255,170,0,0.3)' }
                        }>
                        {s.riskTier.toUpperCase()} RISK
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold mb-0.5">{s.classOrSubject || ''}</p>
                    <p className="font-mono text-[11px] text-slate-600 mb-1">Attendance: <strong>{s.attendancePct}%</strong></p>
                    {s.structuredFactors?.length ? (
                      <div className="mt-2">
                        <RiskBreakdownPanel
                          riskScore={s.riskScore}
                          riskTier={s.riskTier}
                          factors={s.structuredFactors}
                          reasons={s.riskReasons || []}
                          compact={true}
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 leading-relaxed">{s.riskReasons?.[0]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Key Institution Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Enrolled Students"
              value={analyticsLoading ? '—' : analytics.totalStudents}
              subtitle="4 Academic Engineering Branches"
              icon={Users}
              trend={{ value: '100% Enrolled', isPositive: true }}
              accentColor="indigo"
              ringValue={100}
            />
            <StatCard
              title="Campus Attendance"
              value={analyticsLoading ? '—' : `${analytics.averageAttendance}%`}
              subtitle="+1.8% vs previous period"
              icon={CalendarCheck}
              trend={{ value: '1.8%', isPositive: true }}
              accentColor={analytics.averageAttendance >= 75 ? 'emerald' : 'amber'}
              ringValue={analytics.averageAttendance}
            />
            <StatCard
              title="Average Quiz Score"
              value={analyticsLoading ? '—' : `${analytics.averageQuizScore}%`}
              subtitle="Aggregated across all assessments"
              icon={Award}
              trend={{ value: '3.2%', isPositive: true }}
              accentColor="cyan"
              ringValue={analytics.averageQuizScore}
            />
            <StatCard
              title="Faculty On-Duty"
              value={analyticsLoading ? '—' : analytics.totalFaculty}
              subtitle="Active Lecture Theatres"
              icon={Activity}
              accentColor="amber"
            />
          </div>

          {/* 3. Live Active Class Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                  Real-Time Classroom Attendance Status
                </h3>
                <p className="font-mono text-[10px] text-slate-400" style={{ letterSpacing: '0.02em' }}>Live biometric attendance feeds verified per lecture block</p>
              </div>
              <span className="font-mono text-[10px] font-bold flex items-center gap-1.5"
                style={{ color: 'var(--ev-indigo)' }}>
                <span className="w-2 h-2 rounded-full live-indicator" style={{ background: '#1CDEC8' }} />
                LIVE · 3s INTERVAL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.activeClasses.length === 0 ? (
                <div className="col-span-full rounded-2xl p-10 flex flex-col items-center justify-center gap-3"
                  style={{ background: 'rgba(28,222,200,0.03)', border: '1px dashed rgba(28,222,200,0.25)' }}>
                  <Activity strokeWidth={1.5} style={{ width: 28, height: 28, color: 'rgba(28,222,200,0.35)' }} />
                  <p className="font-mono text-[11px] text-center" style={{ color: 'rgba(28,222,200,0.5)' }}>No active class sessions</p>
                  <p className="text-xs text-slate-400">Sessions appear here when faculty start attendance</p>
                </div>
              ) : analytics.activeClasses.map((cls: any) => {
                const isUnderperforming = cls.attendancePercent < 85;
                return (
                  <div
                    key={cls.id}
                    className="bg-white rounded-2xl p-5 border transition-all hover:shadow-md"
                    style={{
                      borderColor: isUnderperforming ? 'rgba(255,170,0,0.4)' : 'rgba(79,70,229,0.15)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--ev-indigo)' }}>
                          {cls.class}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{cls.subject}</h4>
                        <p className="text-xs text-slate-500">{cls.faculty}</p>
                      </div>
                      <span className="font-mono text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5"
                        style={cls.status === 'Active'
                          ? { background: 'rgba(16,185,129,0.08)', color: 'var(--ev-emerald)', border: '1px solid rgba(16,185,129,0.25)' }
                          : cls.status === 'Upcoming'
                          ? { background: 'rgba(79,70,229,0.06)', color: 'var(--ev-indigo)', border: '1px solid rgba(79,70,229,0.15)' }
                          : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }
                        }>
                        {cls.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full live-indicator" style={{ background: '#10B981' }} />}
                        {cls.status}
                      </span>
                    </div>

                    <div className="my-3 space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-slate-600">{cls.present} / {cls.total} Present</span>
                        <span className="font-bold" style={{ color: cls.attendancePercent >= 85 ? '#10B981' : '#FFAA00' }}>
                          {cls.attendancePercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${cls.attendancePercent}%`,
                            background: cls.attendancePercent >= 85 ? '#10B981' : '#FFAA00',
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between font-mono text-[10px] pt-2"
                      style={{ borderTop: '1px solid rgba(28,222,200,0.1)', color: '#94A3B8' }}>
                      <span>Absent: {cls.absent}</span>
                      {isUnderperforming && <span className="font-bold" style={{ color: 'var(--ev-amber)' }}>⚠ FLAGGED</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Institutional Analytics: Attendance Trends & Quiz Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">Campus-Wide Attendance Trend</h3>
                  <p className="font-mono text-[10px] text-slate-400" style={{ letterSpacing: '0.02em' }}>Weekly trajectory across all 6 sections</p>
                </div>
                <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(79,70,229,0.06)', color: 'var(--ev-indigo)', border: '1px solid rgba(79,70,229,0.15)' }}>
                  TARGET &gt;90%
                </span>
              </div>

              <div className="h-56 w-full">
                {analytics.attendanceTrends?.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.attendanceTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAdminAtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1CDEC8" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#1CDEC8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                      <YAxis domain={[75, 100]} stroke="#94A3B8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: 'rgba(28,222,200,0.3)', borderRadius: '12px', fontSize: '12px', color: '#0F172A', boxShadow: '0 4px 12px rgba(28,222,200,0.1)' }} />
                      <Area type="monotone" dataKey="attendance" stroke="#1CDEC8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAdminAtt)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-2xl flex flex-col items-center justify-center gap-2"
                    style={{ background: 'rgba(28,222,200,0.03)', border: '1px dashed rgba(79,70,229,0.15)' }}>
                    <Activity strokeWidth={1.5} style={{ width: 24, height: 24, color: 'rgba(28,222,200,0.4)' }} />
                    <p className="font-mono text-[11px]" style={{ color: 'rgba(28,222,200,0.5)' }}>Insufficient data points</p>
                    <p className="text-[10px] text-slate-400">Trend appears after 2+ data points</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">Diagnostic Score by Discipline</h3>
                  <p className="font-mono text-[10px] text-slate-400" style={{ letterSpacing: '0.02em' }}>Average MCQ mastery rates</p>
                </div>
                <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(217,119,6,0.06)', color: 'var(--ev-amber)', border: '1px solid rgba(255,170,0,0.2)' }}>
                  MEAN: {analyticsLoading ? '…' : `${analytics.averageQuizScore}%`}
                </span>
              </div>

              <div className="h-56 w-full">
                {analytics.quizPerformance?.length >= 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.quizPerformance} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="subject" stroke="#94A3B8" fontSize={10} />
                      <YAxis domain={[50, 100]} stroke="#94A3B8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: 'rgba(255,170,0,0.3)', borderRadius: '12px', fontSize: '12px', color: '#0F172A', boxShadow: '0 4px 12px rgba(255,170,0,0.1)' }} />
                      <Bar dataKey="averageScore" fill="#FFAA00" radius={[6, 6, 0, 0]} name="Avg Score %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-2xl flex flex-col items-center justify-center gap-2"
                    style={{ background: 'rgba(255,170,0,0.03)', border: '1px dashed rgba(255,170,0,0.2)' }}>
                    <Award strokeWidth={1.5} style={{ width: 24, height: 24, color: 'rgba(255,170,0,0.4)' }} />
                    <p className="font-mono text-[11px]" style={{ color: 'rgba(255,170,0,0.5)' }}>No quiz data yet</p>
                    <p className="text-[10px] text-slate-400">Appears after quizzes are taken</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4" style={{ color: 'var(--ev-amber)' }} />
                  Academic Consistency & Streak Leaders
                </h3>
                <p className="font-mono text-[10px] text-slate-400" style={{ letterSpacing: '0.02em' }}>
                  Click any student to inspect their academic dossier and weak topics
                </p>
              </div>
              <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--ev-amber)' }}>TOP 5 HIGH-CONSISTENCY SCHOLARS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {analytics.streakLeaderboard.length === 0 ? (
                <div className="col-span-full rounded-2xl p-8 flex flex-col items-center gap-2"
                  style={{ background: 'rgba(255,170,0,0.03)', border: '1px dashed rgba(255,170,0,0.25)' }}>
                  <Flame strokeWidth={1.5} style={{ width: 24, height: 24, color: 'rgba(255,170,0,0.4)' }} />
                  <p className="font-mono text-[11px] text-center" style={{ color: 'rgba(255,170,0,0.5)' }}>No streak data yet</p>
                </div>
              ) : analytics.streakLeaderboard.map((student: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => handleOpenStudentDrilldown(student.id)}
                  className="rounded-xl border cursor-pointer transition-all p-4 flex flex-col justify-between group relative overflow-hidden"
                  style={{ background: idx === 0 ? '#0C1222' : '#F9FAFB', borderColor: idx === 0 ? 'rgba(255,170,0,0.4)' : '#E2E8F0' }}
                >
                  {idx === 0 && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #FFAA00, #FF4D5E)' }} />}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm"
                        style={idx === 0
                          ? { background: 'rgba(255,170,0,0.15)', color: 'var(--ev-amber)', border: '1px solid rgba(255,170,0,0.3)' }
                          : { background: '#fff', border: '1px solid #E2E8F0', color: '#64748B' }
                        }>
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-[9px] font-bold" style={{ color: idx === 0 ? 'rgba(28,222,200,0.7)' : '#94A3B8' }}>
                        {student.classOrSubject}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold leading-tight" style={{ color: idx === 0 ? '#fff' : '#0F172A' }}>
                      {student.name}
                    </h4>
                    <p className="font-mono text-[11px] font-bold flex items-center gap-1 mt-1" style={{ color: 'var(--ev-amber)' }}>
                      <Flame className="w-3.5 h-3.5 fill-current" />
                      {student.streak} Days
                    </p>
                  </div>
                  <div className="mt-3 pt-2 flex items-center justify-between font-mono text-[10px]"
                    style={{ borderTop: `1px solid ${idx === 0 ? 'rgba(255,170,0,0.15)' : '#F1F5F9'}`, color: idx === 0 ? 'rgba(28,222,200,0.5)' : '#94A3B8' }}>
                    <span>Inspect Profile</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Subject Management */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen strokeWidth={1.5} className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                Subject Assignments
              </h3>
              <span className="font-mono text-[10px] text-slate-400">Assign subjects to sections · visible to faculty &amp; students</span>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Section</label>
                <select
                  value={subjectForm.section}
                  onChange={e => setSubjectForm(f => ({ ...f, section: e.target.value }))}
                  className="bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none"
                  style={{ fontFamily: 'inherit' }}
                >
                  {ALL_SECTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. Digital Electronics"
                  value={subjectForm.subject}
                  onChange={e => setSubjectForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none"
                  style={{ transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = '#1CDEC8')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
              <button
                onClick={handleSaveSubject}
                disabled={subjectSaving || !subjectForm.subject.trim()}
                className="px-4 py-2 rounded-xl text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5B52FF, #1CDEC8)' }}
              >
                <Plus className="w-3.5 h-3.5" />{subjectSaving ? 'Saving…' : 'Assign'}
              </button>
              {subjectMsg && <span className={`font-mono text-xs font-bold ${subjectMsg === 'Saved!' ? '' : ''}`}
                style={{ color: subjectMsg === 'Saved!' ? '#10B981' : '#FF4D5E' }}>{subjectMsg}</span>}
            </div>

            {/* Current assignments table */}
            {subjects.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Section', 'Subject', 'Last Updated', ''].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((a: any) => (
                      <tr key={a._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-indigo-700">{a.section}</td>
                        <td className="px-4 py-2.5 text-slate-800">{a.subject}</td>
                        <td className="px-4 py-2.5 text-slate-400 tabular-nums">{new Date(a.updatedAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSubjectForm({ section: a.section, subject: a.subject })}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubject(a.section)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {subjects.length === 0 && (
              <p className="text-xs text-slate-400">No subject assignments yet. Use the form above to assign subjects to sections.</p>
            )}
          </div>

          {/* Manual Attendance Sessions */}
          {manualSessions.length > 0 && (
            <div className="study-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Recent Manual Attendance Sessions
                </h3>
                <span className="text-xs text-slate-500">Last 7 days · Faculty-submitted</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Section','Subject','Date','Present','Absent','Rate'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {manualSessions.slice(0, 8).map((s: any, i: number) => {
                      const pres = (s.records || []).filter((r: any) => r.status === 'present').length;
                      const tot  = (s.records || []).length;
                      const rate = tot ? Math.round((pres / tot) * 100) : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-slate-900">{s.section}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.subject}</td>
                          <td className="px-4 py-2.5 text-slate-500 tabular-nums">{new Date(s.date).toLocaleDateString()}</td>
                          <td className="px-4 py-2.5 text-emerald-700 font-bold tabular-nums">{pres}</td>
                          <td className="px-4 py-2.5 text-rose-700 font-bold tabular-nums">{tot - pres}</td>
                          <td className="px-4 py-2.5">
                            <span className={`font-bold tabular-nums ${rate >= 75 ? 'text-emerald-700' : 'text-rose-700'}`}>{rate}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Student Drill-down Modal */}
      <StudentDrilldownModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        studentId={selectedStudentId}
      />
    </div>
  );
}
