'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  CalendarCheck, Flame, BookOpen, GraduationCap,
  RefreshCw, ArrowRight, ChevronUp, ChevronDown,
  CheckCircle2, Clock, AlertCircle, Brain, Library,
  FileText, Link as LinkIcon, Megaphone, Sparkles,
  Zap, Trophy, Target, PlayCircle, TrendingUp,
  TrendingDown, Minus, Star, ChevronRight, Loader2,
  Circle,
} from 'lucide-react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';
import HealthAura, { computeStudentRiskScore, AuraFactor } from '@/components/dashboard/HealthAura';
import { useLang } from '@/lib/i18n';

/* Lazy-load chart */
const AttendanceChart = dynamic(() => import('@/components/dashboard/AttendanceChart'), {
  ssr: false,
  loading: () => <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(28,222,200,0.03)' }} />,
});

/* ── Types ── */
interface AttendanceRow {
  _id?: string;
  date: string;
  subject: string;
  status: 'Present' | 'Absent' | 'Late';
  time: string;
  faculty: string;
}

function normaliseRecord(r: any): AttendanceRow {
  const d = new Date(r.date);
  const dateStr = isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
  const timeStr = isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rawStatus = (r.status || 'present') as string;
  const status = (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)) as AttendanceRow['status'];
  const facultyName = typeof r.facultyId === 'object' ? (r.facultyId?.name || 'Faculty') : 'Faculty';
  const subject = typeof r.facultyId === 'object' ? (r.facultyId?.classOrSubject || 'Class') : 'Class';
  return { _id: r._id, date: dateStr, subject, status, time: timeStr, faculty: facultyName };
}

/* ── Greeting helper ── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/* ── Animated counter ── */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(eased * value));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className="animate-count-up">{displayed}{suffix}</span>;
}

/* ── Status chip ── */
const StatusChip = memo(function StatusChip({ status }: { status: AttendanceRow['status'] }) {
  const styles = {
    Present: { bg: 'rgba(16,185,129,0.08)', color: 'var(--ev-emerald)', border: 'rgba(16,185,129,0.3)', dot: '#10B981' },
    Absent:  { bg: 'rgba(225,29,72,0.06)',  color: 'var(--ev-rose)', border: 'rgba(255,77,94,0.3)',  dot: '#FF4D5E' },
    Late:    { bg: 'rgba(217,119,6,0.06)',  color: 'var(--ev-amber)', border: 'rgba(255,170,0,0.3)',  dot: '#FFAA00' },
  };
  const s = styles[status];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
});

/* ── Mission Task Item ── */
interface MissionTask {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  completed: boolean;
}

/* ── Workload Detection Widget ── */
function WorkloadWidget({ events, tasks }: { events: any[]; tasks: any[] }) {
  const now = new Date();
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const deadlineEvents = events.filter(e => {
    const d = new Date(e.date);
    return d >= now && d <= threeDaysLater && ['exam', 'assignment', 'project', 'internal_assessment', 'lab_exam', 'class_test'].includes(e.eventType);
  });

  const pendingTasks = tasks.filter((t: any) => !t.completion?.completed);
  const totalDeadlines = deadlineEvents.length + pendingTasks.length;
  const isHeavy = totalDeadlines >= 3;

  if (totalDeadlines === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background: isHeavy ? 'rgba(217,119,6,0.06)' : 'rgba(79,70,229,0.06)',
            border: `1px solid ${isHeavy ? 'rgba(255,170,0,0.2)' : 'rgba(79,70,229,0.15)'}`,
          }}>
          <AlertCircle className="w-4 h-4" style={{ color: isHeavy ? '#FFAA00' : '#1CDEC8' }} />
        </div>
        <h3 className="font-display text-[14px] font-bold text-slate-900">
          {isHeavy ? 'Heavy Workload Detected' : 'Workload Summary'}
        </h3>
      </div>

      {isHeavy && (
        <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.15)' }}>
          <p className="text-[12px] font-medium" style={{ color: '#92400E', lineHeight: '1.5' }}>
            ⚠️ You have <span className="font-bold">{totalDeadlines} deadlines</span> in the next 3 days. Plan your study time carefully.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {deadlineEvents.slice(0, 3).map((e: any) => {
          const daysUntil = Math.ceil((new Date(e.date).getTime() - now.getTime()) / 86400000);
          return (
            <div key={e._id} className="flex items-center gap-2 py-1.5">
              <span className="text-[10px] font-mono font-bold w-10 text-right shrink-0"
                style={{ color: daysUntil <= 1 ? '#FF4D5E' : '#FFAA00' }}>
                {daysUntil === 0 ? 'TODAY' : `${daysUntil}d`}
              </span>
              <span className="text-[11px] text-slate-700 truncate flex-1">{e.title}</span>
              <span className="text-[9px] text-slate-400 shrink-0">{e.subject || 'General'}</span>
            </div>
          );
        })}
        {pendingTasks.length > 0 && (
          <div className="flex items-center gap-2 py-1.5 border-t border-slate-100 mt-1 pt-2">
            <span className="text-[10px] font-mono font-bold text-rose-500 w-10 text-right shrink-0">{pendingTasks.length}x</span>
            <span className="text-[11px] text-slate-700 flex-1">pending class tasks</span>
            <span className="text-[9px] text-slate-400 shrink-0">from faculty</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════════════════ */
export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
  const { t } = useLang();
  const studentName = session?.user?.name || 'Student';
  const studentId = (session?.user as any)?.id || '';
  const studentSection = (session?.user as any)?.classOrSubject || '';

  // ── Data states ──
  const [streakData, setStreakData] = useState({ currentStreak: 0, longestStreak: 0 });
  const [stats, setStats] = useState({ percentage: 0, presentCount: 0, absentCount: 0, totalClasses: 0 });
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [weakTopic, setWeakTopic] = useState('');
  const [avgQuizScore, setAvgQuizScore] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [labs, setLabs] = useState<string[]>([]);
  const [trend, setTrend] = useState<{ day: string; v: number }[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizHistory, setQuizHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [classTasks, setClassTasks] = useState<any[]>([]);
  const [academicEvents, setAcademicEvents] = useState<any[]>([]);
  const [realtimeNotifications, setRealtimeNotifications] = useState<any[]>([]);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Mission state ──
  const [missionTasks, setMissionTasks] = useState<MissionTask[]>([]);

  // ── Sort state for attendance table ──
  const [sortKey, setSortKey] = useState<'date' | 'subject' | 'status' | 'time'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [showFullTable, setShowFullTable] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [attRes, streakRes, profileRes] = await Promise.all([
        fetch('/api/attendance', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/streaks', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        studentId ? fetch(`/api/students?studentId=${studentId}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null) : Promise.resolve(null),
      ]);

      const pct = attRes.percentage ?? 0;
      const pres = attRes.presentCount ?? 0;
      const abs = attRes.absentCount ?? 0;
      setStats({ percentage: pct, presentCount: pres, absentCount: abs, totalClasses: pres + abs });
      if (Array.isArray(attRes.records)) setRecords(attRes.records.map(normaliseRecord));
      if (streakRes.streak) setStreakData(streakRes.streak);

      if (Array.isArray(attRes.records) && attRes.records.length > 0) {
        const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const byDay: Record<string, { present: number; total: number }> = {};
        attRes.records.forEach((r: any) => {
          const d = new Date(r.date);
          if (isNaN(d.getTime())) return;
          const key = DAY_LABELS[d.getDay()];
          if (!byDay[key]) byDay[key] = { present: 0, total: 0 };
          byDay[key].total++;
          if ((r.status || '').toLowerCase() === 'present') byDay[key].present++;
        });
        setTrend(Object.entries(byDay).map(([day, v]) => ({ day, v: Math.round((v.present / v.total) * 100) })));
      }

      if (profileRes?.student) {
        setSubjects(profileRes.student.subjects || []);
        setLabs(profileRes.student.labs || []);
      }

      setLastUpdated(new Date());
    } catch { /* keep defaults */ }
    finally { setRefreshing(false); }

    // Phase 2: deferred
    try {
      const [planRes, quizRes, histRes] = await Promise.all([
        fetch('/api/study-plan', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch(`/api/quizzes${studentSection ? `?section=${encodeURIComponent(studentSection)}` : ''}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ quizzes: [] })),
        fetch('/api/quizzes?history=1', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ history: [] })),
      ]);

      const topWeak = planRes?.weakTopics?.[0]?.topic;
      if (topWeak) setWeakTopic(topWeak);
      if (Array.isArray(quizRes.quizzes)) setQuizzes(quizRes.quizzes);

      if (Array.isArray(histRes.history) && histRes.history.length > 0) {
        setQuizHistory(histRes.history);
        const scores = histRes.history.map((h: any) => h.score ?? 0);
        setAvgQuizScore(Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length));
        if (!topWeak) {
          const allWeak = histRes.history.flatMap((h: any) => h.weakTopics || []);
          if (allWeak.length > 0) setWeakTopic(allWeak[0]);
        }
      }

      const [secNotes, noticesRes] = await Promise.all([
        fetch(`/api/notes?section=${encodeURIComponent(studentSection)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ notes: [] })),
        fetch('/api/notices', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ notices: [] })),
      ]);
      const notesList = secNotes.notes ?? [];
      notesList.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(notesList);
      if (Array.isArray(noticesRes.notices)) setNotices(noticesRes.notices);

      // Fetch daily class tasks
      try {
        const tasksRes = await fetch('/api/class-tasks?date=today', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ tasks: [] }));
        if (Array.isArray(tasksRes.tasks)) setClassTasks(tasksRes.tasks);
      } catch { /* non-fatal */ }

      // Fetch academic events (upcoming)
      try {
        const eventsRes = await fetch('/api/academic-events?upcoming=true', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ events: [] }));
        if (Array.isArray(eventsRes.events)) setAcademicEvents(eventsRes.events);
      } catch { /* non-fatal */ }
    } catch { /* keep defaults */ }
  }, [studentSection, studentId]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Real-time polling for targeted updates ──
  useEffect(() => {
    const pollRealtime = async () => {
      try {
        const params = lastSeenTimestamp ? `?since=${lastSeenTimestamp}` : '';
        const res = await fetch(`/api/realtime${params}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.count > 0 && data.events) {
          setRealtimeNotifications((prev: any[]) => {
            const existingIds = new Set(prev.map((n: any) => n.eventId));
            const newEvents = data.events.filter((e: any) => !existingIds.has(e.eventId));
            return [...newEvents, ...prev].slice(0, 20);
          });
          setLastSeenTimestamp(data.lastTimestamp);
          // Auto-refresh academic events when new ones arrive
          if (data.events.some((e: any) => e.type?.includes('academic_event'))) {
            fetch('/api/academic-events?upcoming=true', { cache: 'no-store' })
              .then(r => r.json())
              .then(d => { if (Array.isArray(d.events)) setAcademicEvents(d.events); })
              .catch(() => {});
          }
        }
      } catch { /* non-fatal */ }
    };

    pollRealtime();
    const pollId = setInterval(pollRealtime, 20000); // Poll every 20 seconds
    return () => clearInterval(pollId);
  }, [lastSeenTimestamp]);

  // ── Compute derived data ──
  const hasStudentData = stats.totalClasses > 0 || quizHistory.length > 0;
  const riskScore = computeStudentRiskScore({
    attendancePct: stats.percentage,
    avgQuizScore,
    currentStreak: streakData.currentStreak,
    hasData: hasStudentData,
  });
  const riskTier = riskScore === null ? 'No Data' : riskScore >= 60 ? 'High' : riskScore >= 30 ? 'Medium' : 'Low';

  // Compute XP from streak + quiz score + attendance
  const xp = useMemo(() => {
    let base = 0;
    base += streakData.currentStreak * 25; // 25 XP per streak day
    base += (avgQuizScore ?? 0) * 3; // 3 XP per quiz % point
    base += Math.floor(stats.percentage * 2); // 2 XP per attendance %
    return Math.min(9999, base);
  }, [streakData.currentStreak, avgQuizScore, stats.percentage]);

  // ── Mission tasks ──
  useEffect(() => {
    const tasks: MissionTask[] = [];
    if (weakTopic) {
      tasks.push({
        id: 'weak',
        title: `Revise: ${weakTopic.slice(0, 30)}`,
        subtitle: 'AI identified weak topic',
        href: '/student/learning',
        icon: Brain,
        color: 'var(--ev-rose)',
        bgColor: 'rgba(255,77,94,0.06)',
        borderColor: 'rgba(255,77,94,0.2)',
        completed: false,
      });
    }
    if (quizzes.length > 0) {
      tasks.push({
        id: 'quiz',
        title: `Take ${quizzes[0].subject} Quiz`,
        subtitle: `${quizzes[0].questions?.length || 0} questions · ~10 min`,
        href: '/student/quizzes',
        icon: Target,
        color: 'var(--ev-indigo)',
        bgColor: 'rgba(91,82,255,0.06)',
        borderColor: 'rgba(79,70,229,0.15)',
        completed: false,
      });
    }
    if (stats.percentage >= 75) {
      tasks.push({
        id: 'attend',
        title: 'Attend today\'s classes',
        subtitle: 'Attendance on track',
        href: '/student/dashboard',
        icon: CalendarCheck,
        color: 'var(--ev-emerald)',
        bgColor: 'rgba(16,185,129,0.06)',
        borderColor: 'rgba(16,185,129,0.2)',
        completed: true,
      });
    }
    if (notes.length > 0) {
      tasks.push({
        id: 'notes',
        title: 'Review new faculty notes',
        subtitle: `${notes.length} new resource${notes.length > 1 ? 's' : ''}`,
        href: '/student/dashboard',
        icon: FileText,
        color: 'var(--ev-amber)',
        bgColor: 'rgba(255,170,0,0.06)',
        borderColor: 'rgba(255,170,0,0.2)',
        completed: false,
      });
    }
    // Fill to 4 tasks minimum
    while (tasks.length < 4) {
      const defaults: MissionTask[] = [
        {
          id: 'learn',
          title: 'Continue Learning',
          subtitle: 'AI Study Copilot',
          href: '/student/learning',
          icon: Sparkles,
          color: 'var(--ev-indigo)',
          bgColor: 'rgba(28,222,200,0.06)',
          borderColor: 'rgba(79,70,229,0.15)',
          completed: false,
        },
        {
          id: 'video',
          title: 'Watch a Video Lecture',
          subtitle: 'Browse available lectures',
          href: '/student/videos',
          icon: PlayCircle,
          color: '#8B5CF6',
          bgColor: 'rgba(139,92,246,0.06)',
          borderColor: 'rgba(139,92,246,0.2)',
          completed: false,
        },
      ];
      const remaining = defaults.filter(d => !tasks.find(t => t.id === d.id));
      if (remaining.length > 0) tasks.push(remaining[0]);
      else break;
    }
    setMissionTasks(tasks);
  }, [weakTopic, quizzes, stats.percentage, notes]);

  const missionComplete = missionTasks.filter(t => t.completed).length;
  const missionPct = missionTasks.length > 0 ? Math.round((missionComplete / missionTasks.length) * 100) : 0;

  const sorted = [...records].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const displayRecords = showFullTable ? sorted : sorted.slice(0, 8);

  const handleSort = (key: 'date' | 'subject' | 'status' | 'time') => {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: string }) =>
    sortKey === k
      ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ChevronDown className="w-3 h-3 opacity-30" />;

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--ev-bg)' }}>
      <StudentSidebar streak={streakData.currentStreak} xp={xp} />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar
          title="Dashboard"
          subtitle={`${studentSection} · B.Tech`}
        />

        <main className="flex-1 p-4 lg:p-6 xl:p-8 space-y-5 overflow-y-auto dash-bg">

          {/* ═══════════════════════════════════════
             SECTION 1: HERO + GREETING
             ═══════════════════════════════════════ */}
          <section className="animate-card-enter" style={{ animationDelay: '0ms' }}>
            <div className="relative rounded-3xl overflow-hidden p-6 lg:p-8"
              style={{
                background: 'linear-gradient(135deg, #0C1222 0%, #0F172A 50%, #1A1F3A 100%)',
                border: '1px solid rgba(79,70,229,0.15)',
              }}>
              {/* Ambient background glow */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full animate-ambient-float"
                  style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)' }} />
                <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full animate-ambient-float"
                  style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.08) 0%, transparent 70%)', animationDelay: '2s' }} />
                {/* Grid lines */}
                <div className="absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(79,70,229,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.03) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }} />
              </div>

              <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-6">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(129,140,248,0.6)' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <h1 className="font-display text-[28px] lg:text-[34px] font-bold text-white leading-tight mb-2" style={{ letterSpacing: '-0.02em' }}>
                    {getGreeting()}, {studentName.split(' ')[0]} 👋
                  </h1>
                  <p className="text-[14px] lg:text-[15px] mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Ready to level up your learning today?
                  </p>

                  {/* Quick stats row */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 mb-5">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 animate-fire-glow" style={{ color: '#F59E0B' }} />
                      <span className="font-mono text-[13px] font-bold" style={{ color: '#F59E0B' }}>
                        {streakData.currentStreak}d streak
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" style={{ color: '#818CF8' }} />
                      <span className="font-mono text-[13px] font-bold" style={{ color: '#818CF8' }}>
                        <AnimatedNumber value={xp} /> XP
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" style={{ color: '#0D9488' }} />
                      <span className="font-mono text-[13px] font-bold" style={{ color: '#0D9488' }}>
                        <AnimatedNumber value={stats.percentage} suffix="%" /> attendance
                      </span>
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href="/student/learning"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                        color: '#fff',
                        boxShadow: '0 4px 16px rgba(79,70,229,0.3)',
                      }}>
                      Continue Learning <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link href="/student/learning"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: 'rgba(13,148,136,0.1)',
                        color: '#0D9488',
                        border: '1px solid rgba(13,148,136,0.2)',
                      }}>
                      <Sparkles className="w-4 h-4" /> Ask AI
                    </Link>
                  </div>
                </div>

                {/* Right side — mini progress ring */}
                <div className="hidden lg:flex flex-col items-center gap-2">
                  <div className="relative w-24 h-24">
                    <svg width={96} height={96} className="-rotate-90">
                      <circle cx={48} cy={48} r={40} fill="none" strokeWidth={4} stroke="rgba(255,255,255,0.06)" />
                      <circle cx={48} cy={48} r={40} fill="none" strokeWidth={4}
                        stroke="url(#heroGradient)"
                        strokeDasharray={2 * Math.PI * 40}
                        strokeDashoffset={2 * Math.PI * 40 * (1 - (stats.percentage / 100))}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="heroGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" />
                        <stop offset="100%" stopColor="#0D9488" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-[18px] font-bold text-white">{stats.percentage}%</span>
                      <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>ATTEND</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════
             SECTION 2: TODAY'S MISSION + AI COPILOT
             ═══════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* TODAY'S MISSION — 3 cols */}
            <section className="lg:col-span-3 animate-card-enter" style={{ animationDelay: '80ms' }}>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-sm h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                      <Target className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                    </div>
                    <div>
                      <h3 className="font-display text-[15px] font-bold text-slate-900" style={{ letterSpacing: '-0.01em' }}>
                        Today&apos;s Mission
                      </h3>
                      <p className="font-mono text-[10px] text-slate-400">Personalized daily goals</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[20px] font-bold" style={{
                      background: 'linear-gradient(135deg, #4F46E5, #0D9488)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      {missionPct}%
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">COMPLETE</span>
                  </div>
                </div>

                {/* Mission progress bar */}
                <div className="h-2 rounded-full mb-4" style={{ background: 'var(--ev-border-subtle)' }}>
                  <div className="h-full rounded-full animate-progress-fill" style={{
                    width: `${missionPct}%`,
                    background: 'linear-gradient(90deg, #4F46E5, #0D9488)',
                  }} />
                </div>

                {/* Task list */}
                <div className="space-y-2">
                  {missionTasks.map((task) => {
                    const Icon = task.icon;
                    return (
                      <Link key={task.id} href={task.href}
                        className="flex items-center gap-3 p-3 rounded-xl border transition-all group card-hover-lift"
                        style={{
                          borderColor: task.completed ? 'rgba(16,185,129,0.3)' : task.borderColor,
                          background: task.completed ? 'rgba(16,185,129,0.03)' : task.bgColor,
                        }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: task.completed ? 'rgba(16,185,129,0.1)' : `${task.color}10`,
                            border: `1px solid ${task.completed ? 'rgba(16,185,129,0.2)' : task.borderColor}`,
                          }}>
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--ev-emerald)' }} />
                          ) : (
                            <Icon className="w-4 h-4" style={{ color: task.color }} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] font-semibold truncate ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {task.title}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400">{task.subtitle}</p>
                        </div>
                        {!task.completed && (
                          <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: '#94A3B8' }} />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {missionTasks.length > 0 && (
                  <Link href="/student/learning"
                    className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all hover:scale-[1.01]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(79,70,229,0.06))',
                      border: '1px solid rgba(79,70,229,0.15)',
                      color: 'var(--ev-indigo)',
                    }}>
                    Continue Mission <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </section>

            {/* AI STUDY COPILOT — 2 cols */}
            <section className="lg:col-span-2 animate-card-enter" style={{ animationDelay: '160ms' }}>
              <div className="rounded-2xl p-5 lg:p-6 shadow-sm h-full relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #0C1222 0%, #0F172A 100%)',
                  border: '1px solid rgba(79,70,229,0.15)',
                }}>
                {/* Ambient effects */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full animate-ambient-float"
                    style={{ background: 'radial-gradient(circle, rgba(28,222,200,0.1) 0%, transparent 70%)' }} />
                  <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full animate-ambient-float"
                    style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)', animationDelay: '3s' }} />
                  <div className="absolute inset-0"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(28,222,200,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(28,222,200,0.02) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }} />
                </div>

                <div className="relative">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-ring"
                      style={{
                        background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(13,148,136,0.15))',
                        border: '1px solid rgba(79,70,229,0.25)',
                      }}>
                      <Sparkles className="w-4.5 h-4.5" style={{ color: '#818CF8' }} />
                    </div>
                    <div>
                      <h3 className="font-display text-[15px] font-bold text-white" style={{ letterSpacing: '-0.01em' }}>
                        AI Study Copilot
                      </h3>
                      <p className="text-[10px] font-mono" style={{ color: 'rgba(28,222,200,0.5)' }}>Powered by Gemini AI</p>
                    </div>
                  </div>

                  <p className="text-[12px] mb-4" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
                    Learn faster with personalized explanations, quizzes, notes and study plans.
                  </p>

                  {/* Quick actions */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: 'Ask AI', icon: Sparkles, color: '#4F46E5', href: '/student/learning' },
                      { label: 'Generate Quiz', icon: Target, color: '#0D9488', href: '/student/quizzes' },
                      { label: 'Study Plan', icon: Brain, color: '#D97706', href: '/student/learning' },
                      { label: 'Weak Topics', icon: TrendingUp, color: '#E11D48', href: '/student/learning' },
                    ].map((action, i) => {
                      const Icon = action.icon;
                      return (
                        <Link key={i} href={action.href}
                          className="flex items-center gap-2 p-2.5 rounded-xl transition-all hover:scale-[1.02]"
                          style={{
                            background: `${action.color}0A`,
                            border: `1px solid ${action.color}20`,
                          }}>
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: action.color }} />
                          <span className="text-[11px] font-semibold" style={{ color: action.color }}>{action.label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* AI Recommendation */}
                  {weakTopic && (
                    <div className="rounded-xl p-3 mb-2"
                      style={{
                        background: 'rgba(28,222,200,0.05)',
                        border: '1px solid rgba(28,222,200,0.15)',
                      }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Brain className="w-3 h-3" style={{ color: 'var(--ev-amber)' }} />
                        <span className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--ev-amber)' }}>
                          AI Recommendation
                        </span>
                      </div>
                      <p className="text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
                        Spend 15 min on <span className="font-semibold text-white">{weakTopic}</span> — your weakest topic identified from quiz performance.
                      </p>
                      <Link href="/student/learning"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold transition-all hover:scale-[1.02]"
                        style={{ color: 'var(--ev-indigo)' }}>
                        Start Revision <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}

                  <Link href="/student/learning"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                      color: '#fff',
                      boxShadow: '0 4px 16px rgba(79,70,229,0.25)',
                    }}>
                    Open AI Copilot <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* ═══════════════════════════════════════
             SECTION 2B: DAILY CLASS TASKS + EXAM READINESS
             ═══════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-card-enter" style={{ animationDelay: '200ms' }}>
            {/* Daily Class Tasks */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                    <Target className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                  </div>
                  <div>
                    <h3 className="font-display text-[15px] font-bold text-slate-900">Today&apos;s Class Tasks</h3>
                    <p className="font-mono text-[10px] text-slate-400">Assigned by your faculty</p>
                  </div>
                </div>
                {classTasks.length > 0 && (
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{
                    background: 'rgba(79,70,229,0.06)', color: 'var(--ev-indigo)', border: '1px solid rgba(79,70,229,0.15)',
                  }}>
                    {classTasks.filter((t: any) => t.completion?.completed).length}/{classTasks.length} DONE
                  </span>
                )}
              </div>

              {classTasks.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[12px] text-slate-400">No class tasks for today</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Your faculty hasn&apos;t assigned any tasks yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {classTasks.map((task: any) => {
                    const isCompleted = task.completion?.completed;
                    const typeColors: Record<string, string> = {
                      study: '#3B82F6', assignment: '#6366F1', lab_work: '#10B981',
                      practice: '#8B5CF6', revision: '#FFAA00', lecture: '#F43F5E', quiz: '#06B6D4',
                    };
                    const color = typeColors[task.taskType] || '#5B52FF';
                    return (
                      <div key={task._id} className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                        style={{
                          borderColor: isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.06)',
                          background: isCompleted ? 'rgba(16,185,129,0.03)' : 'white',
                        }}>
                        <button onClick={async () => {
                          const newCompleted = !isCompleted;
                          try {
                            await fetch('/api/class-tasks', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'toggle_completion', taskId: task._id, completed: newCompleted }),
                            });
                            setClassTasks((prev: any[]) => prev.map((t: any) =>
                              t._id === task._id ? { ...t, completion: { completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : null } } : t
                            ));
                          } catch { /* ignore */ }
                        }} className="shrink-0">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                            style={{
                              background: isCompleted ? 'rgba(16,185,129,0.1)' : `${color}10`,
                              border: `1.5px solid ${isCompleted ? '#10B981' : color + '40'}`,
                            }}>
                            {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ev-emerald)' }} />}
                          </div>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[12px] font-semibold ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold" style={{ color }}>{task.subject}</span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-[10px] text-slate-400">{task.dueTime || 'By end of day'}</span>
                          </div>
                        </div>
                        {task.priority === 'urgent' || task.priority === 'high' ? (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{
                            background: task.priority === 'urgent' ? 'rgba(225,29,72,0.06)' : 'rgba(217,119,6,0.06)',
                            color: task.priority === 'urgent' ? '#FF4D5E' : '#FFAA00',
                          }}>{task.priority.toUpperCase()}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Exam Readiness Score */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                    <TrendingUp className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                  </div>
                  <div>
                    <h3 className="font-display text-[14px] font-bold text-slate-900">Exam Readiness</h3>
                    <p className="font-mono text-[10px] text-slate-400">AI-computed score</p>
                  </div>
              </div>

              {(() => {
                const readinessScore = Math.min(99, Math.max(10, Math.round(
                  (stats.percentage * 0.3) + ((avgQuizScore ?? 50) * 0.4) + (Math.min(streakData.currentStreak, 14) / 14 * 100 * 0.3)
                )));
                const breakdownItems = [
                  { label: 'Concept Mastery', value: Math.min(99, Math.round((avgQuizScore ?? 50) * 1.1)), color: 'var(--ev-indigo)' },
                  { label: 'Practice', value: Math.min(99, Math.round(quizHistory.length * 8 + 30)), color: 'var(--ev-indigo)' },
                  { label: 'Revision', value: Math.min(99, Math.round(streakData.currentStreak * 7 + 20)), color: 'var(--ev-amber)' },
                  { label: 'Consistency', value: Math.min(99, Math.round(stats.percentage * 1.1)), color: 'var(--ev-emerald)' },
                ];
                return (
                  <>
                    <div className="text-center mb-4">
                      <div className="relative w-20 h-20 mx-auto">
                        <svg width={80} height={80} className="-rotate-90">
                          <circle cx={40} cy={40} r={34} fill="none" strokeWidth={5} stroke="rgba(0,0,0,0.04)" />
                          <circle cx={40} cy={40} r={34} fill="none" strokeWidth={5}
                            stroke="url(#readinessGrad)"
                            strokeDasharray={2 * Math.PI * 34}
                            strokeDashoffset={2 * Math.PI * 34 * (1 - readinessScore / 100)}
                            strokeLinecap="round" className="transition-all duration-1000" />
                          <defs>
                            <linearGradient id="readinessGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#1CDEC8" />
                              <stop offset="100%" stopColor="#5B52FF" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-mono text-[18px] font-bold text-slate-900">{readinessScore}</span>
                          <span className="text-[8px] font-mono text-slate-400">/100</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {breakdownItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-20 shrink-0">{item.label}</span>
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
                            <div className="h-full rounded-full animate-progress-fill" style={{
                              width: `${item.value}%`,
                              background: item.color,
                              animationDelay: `${i * 80}ms`,
                            }} />
                          </div>
                          <span className="font-mono text-[10px] font-bold" style={{ color: item.color }}>{item.value}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500">
                        {weakTopic
                          ? <>Focus on <span className="font-semibold text-rose-600">{weakTopic}</span> before your next assessment.</>
                          : readinessScore >= 70
                          ? <span className="text-emerald-600 font-semibold">You&apos;re on track. Keep the momentum!</span>
                          : <span className="text-amber-600 font-semibold">Keep practicing to improve your readiness.</span>
                        }
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* ═══════════════════════════════════════
             SECTION 3: GAMIFICATION + PROGRESS
             ═══════════════════════════════════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-card-enter" style={{ animationDelay: '240ms' }}>
            {/* Streak */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm card-hover-lift">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.15)' }}>
                  <Flame className="w-4 h-4 animate-fire-glow" style={{ color: '#D97706' }} />
                </div>
              </div>
              <p className="font-mono text-[24px] font-bold leading-none" style={{ color: 'var(--ev-amber)' }}>
                <AnimatedNumber value={streakData.currentStreak} />
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Day Streak</p>
              <p className="font-mono text-[10px] text-slate-400 mt-0.5">Best: {streakData.longestStreak}d</p>
            </div>

            {/* XP */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm card-hover-lift">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                  <Zap className="w-4 h-4" style={{ color: '#4F46E5' }} />
                </div>
              </div>
              <p className="font-mono text-[24px] font-bold leading-none" style={{ color: '#818CF8' }}>
                <AnimatedNumber value={xp} />
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Total XP</p>
              <div className="h-1 rounded-full mt-2" style={{ background: 'rgba(28,222,200,0.1)' }}>
                <div className="h-full rounded-full animate-progress-fill" style={{
                  width: `${(xp % 500) / 5}%`,
                  background: 'linear-gradient(90deg, #4F46E5, #6366F1)',
                }} />
              </div>
            </div>

            {/* Quiz Score */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm card-hover-lift">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                  <Brain className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                </div>
              </div>
              <p className="font-mono text-[24px] font-bold leading-none" style={{ color: 'var(--ev-indigo)' }}>
                {avgQuizScore !== null ? <><AnimatedNumber value={avgQuizScore} /><span className="text-[14px]">%</span></> : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Avg Quiz Score</p>
              <p className="font-mono text-[10px] text-slate-400 mt-0.5">{quizHistory.length} attempts</p>
            </div>

            {/* Achievements */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm card-hover-lift">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(255,170,0,0.2)' }}>
                  <Trophy className="w-4 h-4" style={{ color: 'var(--ev-amber)' }} />
                </div>
              </div>
              <p className="font-mono text-[24px] font-bold leading-none" style={{ color: 'var(--ev-amber)' }}>
                {Math.min(quizHistory.length, 12)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Achievements</p>
              <p className="font-mono text-[10px] text-slate-400 mt-0.5">This semester</p>
            </div>
          </div>

          {/* ═══════════════════════════════════════
             SECTION 3B: UPCOMING ACADEMIC EVENTS + WORKLOAD
             ═══════════════════════════════════════ */}
          {academicEvents.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-card-enter" style={{ animationDelay: '360ms' }}>
              {/* Upcoming Events */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                      <CalendarCheck className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                    </div>
                    <div>
                      <h3 className="font-display text-[15px] font-bold text-slate-900">Upcoming Academic Events</h3>
                      <p className="font-mono text-[10px] text-slate-400">Exams, deadlines, and important dates</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {academicEvents.slice(0, 5).map((ev: any) => {
                    const daysUntil = Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000);
                    const isUrgent = daysUntil <= 3 && daysUntil >= 0;
                    const isPast = daysUntil < 0;
                    const typeColors: Record<string, string> = {
                      exam: '#FF4D5E', assignment: '#5B52FF', project: '#8B5CF6',
                      internal_assessment: '#FFAA00', lab_exam: '#10B981', class_test: '#06B6D4',
                      workshop: '#F97316', seminar: '#EC4899', holiday: '#14B8A6',
                      college_event: '#6366F1', other: '#64748B',
                    };
                    const typeIcons: Record<string, string> = {
                      exam: '📝', assignment: '📋', project: '🚀',
                      internal_assessment: '📊', lab_exam: '🔬', class_test: '✏️',
                      workshop: '🔧', seminar: '🎤', holiday: '🏖️',
                      college_event: '🏛️', other: '📌',
                    };
                    const color = typeColors[ev.eventType] || '#64748B';
                    return (
                      <div key={ev._id} className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                        style={{ borderColor: isPast ? 'rgba(255,77,94,0.3)' : isUrgent ? 'rgba(255,170,0,0.3)' : 'rgba(0,0,0,0.06)',
                          background: isPast ? 'rgba(255,77,94,0.02)' : isUrgent ? 'rgba(255,170,0,0.02)' : 'white',
                          borderLeftWidth: '3px', borderLeftColor: color }}>
                        <span className="text-sm shrink-0">{typeIcons[ev.eventType] || '📌'}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[12px] font-semibold ${isPast ? 'text-slate-500' : 'text-slate-800'}`}>{ev.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold" style={{ color }}>{ev.subject || 'General'}</span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-[10px] text-slate-400">{new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            {ev.startTime && <><span className="text-[10px] text-slate-400">·</span><span className="text-[10px] text-slate-400">{ev.startTime}</span></>}
                          </div>
                        </div>
                        {!isPast && daysUntil >= 0 && (
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0"
                            style={{ background: isUrgent ? 'rgba(255,170,0,0.1)' : 'rgba(100,116,139,0.08)',
                              color: isUrgent ? '#FFAA00' : '#64748B' }}>
                            {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil}d`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workload Detection */}
              <WorkloadWidget events={academicEvents} tasks={classTasks} />
            </div>
          )}

          {/* ═══════════════════════════════════════
             SECTION 4: LEARNING PROGRESS + ATTENDANCE INSIGHT
             ═══════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-card-enter" style={{ animationDelay: '320ms' }}>

            {/* Learning Progress */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                    <TrendingUp className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                  </div>
                  <div>
                    <h3 className="font-display text-[14px] font-bold text-slate-900">My Learning Journey</h3>
                    <p className="font-mono text-[10px] text-slate-400">Subject-wise progress</p>
                  </div>
                </div>
                <Link href="/student/profile" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--ev-indigo)' }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {subjects.length > 0 ? (
                <div className="space-y-3">
                  {subjects.slice(0, 5).map((subject, i) => {
                    // Use real quiz performance for this subject if available
                    const subjectQuizzes = quizHistory.filter((h: any) => h.quizId?.subject === subject);
                    const progress = subjectQuizzes.length > 0
                      ? Math.round(subjectQuizzes.reduce((s: number, h: any) => s + (h.score || 0), 0) / subjectQuizzes.length)
                      : 0;
                    const colors = ['#1CDEC8', '#5B52FF', '#FFAA00', '#10B981', '#8B5CF6'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={i} className="flex items-center gap-3 group">
                        <div className="w-28 sm:w-36 shrink-0">
                          <p className="text-[12px] font-semibold text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                            {subject}
                          </p>
                        </div>
                        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                          <div className="h-full rounded-full animate-progress-fill" style={{
                            width: `${progress}%`,
                            background: `linear-gradient(90deg, ${color}CC, ${color})`,
                            animationDelay: `${i * 100}ms`,
                          }} />
                        </div>
                        <span className="font-mono text-[12px] font-bold shrink-0 w-10 text-right" style={{ color }}>
                          {progress > 0 ? `${progress}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[12px] text-slate-400">Complete quizzes to see subject progress</p>
                </div>
              )}

              {/* Overall */}
              {subjects.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-slate-700">Overall Progress</span>
                  <span className="font-mono text-[18px] font-bold" style={{
                    background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    {(() => {
                      const scored = subjects.map(subject => {
                        const sq = quizHistory.filter((h: any) => h.quizId?.subject === subject);
                        return sq.length > 0 ? Math.round(sq.reduce((s: number, h: any) => s + (h.score || 0), 0) / sq.length) : 0;
                      }).filter(s => s > 0);
                      return scored.length > 0 ? `${Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)}%` : '—';
                    })()}
                  </span>
                </div>
              )}
            </div>

            {/* Attendance Insight */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: stats.percentage >= 75 ? 'rgba(16,185,129,0.08)' : 'rgba(225,29,72,0.06)',
                    border: `1px solid ${stats.percentage >= 75 ? 'rgba(16,185,129,0.2)' : 'rgba(255,77,94,0.2)'}`,
                  }}>
                  <CalendarCheck className="w-4 h-4" style={{ color: stats.percentage >= 75 ? '#10B981' : '#FF4D5E' }} />
                </div>
                <div>
                  <h3 className="font-display text-[14px] font-bold text-slate-900">Attendance</h3>
                  <p className="font-mono text-[10px] text-slate-400">Current semester</p>
                </div>
              </div>

              {/* Big number */}
              <div className="text-center mb-4">
                <p className="font-mono text-[40px] font-bold leading-none" style={{
                  color: stats.percentage >= 75 ? '#10B981' : stats.percentage >= 60 ? '#FFAA00' : '#FF4D5E',
                }}>
                  <AnimatedNumber value={stats.percentage} suffix="%" />
                </p>
              </div>

              {/* Insight message */}
              <div className="rounded-xl p-3 mb-4" style={{
                background: stats.percentage >= 75 ? 'rgba(16,185,129,0.06)' : 'rgba(255,77,94,0.06)',
                border: `1px solid ${stats.percentage >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(255,77,94,0.15)'}`,
              }}>
                <p className="text-[12px] font-medium" style={{
                  color: stats.percentage >= 75 ? '#065F46' : '#991B1B',
                  lineHeight: '1.5',
                }}>
                  {stats.percentage >= 85
                    ? `Great job! You're well above the 75% minimum. Keep it up!`
                    : stats.percentage >= 75
                    ? `You're currently safe. Keep attending to maintain eligibility.`
                    : stats.percentage >= 60
                    ? `You need ${Math.ceil((75 * (stats.presentCount + stats.absentCount) - stats.presentCount * 100) / 25)} more attended classes to reach 75%.`
                    : `Warning: You're significantly below the 75% minimum. Take action now!`
                  }
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.05)' }}>
                  <p className="font-mono text-[16px] font-bold text-emerald-600">{stats.presentCount}</p>
                  <p className="text-[9px] font-mono text-slate-400 uppercase">Present</p>
                </div>
                <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,77,94,0.05)' }}>
                  <p className="font-mono text-[16px] font-bold text-rose-600">{stats.absentCount}</p>
                  <p className="text-[9px] font-mono text-slate-400 uppercase">Absent</p>
                </div>
                <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(91,82,255,0.05)' }}>
                  <p className="font-mono text-[16px] font-bold text-indigo-600">{stats.totalClasses}</p>
                  <p className="text-[9px] font-mono text-slate-400 uppercase">Total</p>
                </div>
              </div>

              {/* Weekly trend */}
              {trend.length >= 2 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">Weekly Pattern</p>
                  <div className="h-24">
                    <AttendanceChart data={trend} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════
             SECTION 5: UPCOMING + QUIZZES + NOTES
             ═══════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-card-enter" style={{ animationDelay: '400ms' }}>

            {/* Available Quizzes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                  <h3 className="font-display text-[14px] font-bold text-slate-900">Up Next</h3>
                </div>
                <Link href="/student/quizzes" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--ev-indigo)' }}>
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                {quizzes.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-[12px] text-slate-400">No pending quizzes</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">All caught up!</p>
                  </div>
                ) : quizzes.slice(0, 3).map((q: any) => (
                  <Link key={q._id} href="/student/quizzes"
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 transition-all group card-hover-lift"
                    style={{ borderLeft: '2.5px solid #5B52FF' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(91,82,255,0.06)', border: '1px solid rgba(91,82,255,0.15)' }}>
                      <Target className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{q.subject} Quiz</p>
                      <p className="font-mono text-[10px] text-slate-400">{q.questions?.length || 0} questions · ~10 min</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: '#94A3B8' }} />
                  </Link>
                ))}
              </div>

              {/* Recent attempts */}
              {quizHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">Recent Scores</p>
                  <div className="space-y-1.5">
                    {quizHistory.slice(0, 3).map((h: any, i: number) => {
                      const score = h.score ?? 0;
                      const color = score >= 75 ? '#10B981' : score >= 50 ? '#FFAA00' : '#FF4D5E';
                      return (
                        <div key={i} className="flex items-center justify-between py-1.5">
                          <span className="text-[11px] text-slate-600 truncate">{h.quizId?.subject || 'Quiz'}</span>
                          <span className="font-mono text-[11px] font-bold" style={{ color }}>{score}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notes & Resources */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: 'var(--ev-amber)' }} />
                  <h3 className="font-display text-[14px] font-bold text-slate-900">Notes & Resources</h3>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{notes.length} from faculty</span>
              </div>

              <div className="space-y-2">
                {notes.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-[12px] text-slate-400">No notes posted yet</p>
                  </div>
                ) : notes.slice(0, 4).map((n: any) => (
                  <div key={n._id} className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: n.type === 'announcement' ? 'rgba(217,119,6,0.06)' : 'rgba(79,70,229,0.06)',
                          border: `1px solid ${n.type === 'announcement' ? 'rgba(255,170,0,0.2)' : 'rgba(91,82,255,0.15)'}`,
                        }}>
                        {n.type === 'announcement' ? <Megaphone className="w-3 h-3" style={{ color: 'var(--ev-amber)' }} /> : <FileText className="w-3 h-3" style={{ color: 'var(--ev-indigo)' }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-slate-800 truncate">{n.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.subject} · {new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attendance Records */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: 'var(--ev-emerald)' }} />
                  <h3 className="font-display text-[14px] font-bold text-slate-900">Recent Attendance</h3>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{records.length} records</span>
              </div>

              <div className="space-y-1.5">
                {records.length === 0 ? (
                  <div className="text-center py-6">
                    <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-[12px] text-slate-400">No attendance records</p>
                  </div>
                ) : sorted.slice(0, 6).map((row, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-2 border-b border-slate-50 last:border-0">
                    <StatusChip status={row.status} />
                    <span className="text-[11px] text-slate-600 truncate flex-1">{row.subject}</span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">{row.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════
             SECTION 6: NOTICES
             ═══════════════════════════════════════ */}
          {notices.length > 0 && (
            <section className="animate-card-enter" style={{ animationDelay: '480ms' }}>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <h3 className="font-display text-[14px] font-bold text-slate-900">Faculty Notices</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {notices.filter((n: any) => !n.isRead).length} unread
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {notices.slice(0, 4).map((n: any, i: number) => {
                    const typeColor = n.type === 'urgent' ? 'border-l-rose-400'
                      : n.type === 'warning' ? 'border-l-amber-400'
                      : n.type === 'appreciation' ? 'border-l-emerald-400'
                      : 'border-l-indigo-400';
                    return (
                      <div key={i} className={`p-3 rounded-xl border border-slate-100 ${typeColor}`} style={{ borderLeftWidth: '3px' }}>
                        <p className="text-[12px] font-bold text-slate-800 truncate">{n.subject}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{n.facultyId?.name || 'Faculty'} · {new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

        </main>
      </div>
    </div>
  );
}
