'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap, BookOpen, HelpCircle, MessageSquare,
  Users, Camera, PlusCircle, ShieldCheck, Video, FileText,
  ClipboardList, BarChart2, ScanFace, LifeBuoy, Globe, Target, Calendar as CalIcon,
  UserCheck, Settings, LogOut, Send,
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useLang, type Lang } from '@/lib/i18n';

interface SidebarProps { role?: 'student' | 'faculty' | 'admin'; }

const studentNav = [
  { key: 'dashboard',     href: '/student/dashboard',     icon: GraduationCap },
  { key: 'studyPlan',     href: '/student/learning',      icon: BookOpen,     tag: 'AI' },
  { key: 'quizzes',       href: '/student/quizzes',       icon: HelpCircle },
  { key: 'videoLectures', href: '/student/videos',        icon: Video },
  { key: 'registerFace',  href: '/student/register-face', icon: ScanFace,     tag: 'Live' },
  { key: 'feedback',      href: '/student/feedback',      icon: MessageSquare },
  { key: 'myProfile',     href: '/student/profile',       icon: Users },
  { key: 'help',          href: '/student/help',          icon: LifeBuoy },
] as const;

const facultyNav = [
  { key: 'courses',           href: '/faculty/courses',           icon: BookOpen,      group: 'Teaching' },
  { key: 'attendance',        href: '/faculty/attendance',        icon: Camera,        tag: 'Live', group: 'Teaching' },
  { key: 'manualAttendance',  href: '/faculty/manual-attendance', icon: ClipboardList, group: 'Teaching' },
  { key: 'dailyTasks',        href: '/faculty/daily-tasks',       icon: Target,        group: 'Teaching' },
  { key: 'academicCalendar',  href: '/faculty/calendar',          icon: CalIcon,       group: 'Teaching' },
  { key: 'students',          href: '/faculty/students',          icon: Users,         group: 'Manage' },
  { key: 'classAnalytics',    href: '/faculty/classes',           icon: BarChart2,     group: 'Manage' },
  { key: 'myQuizzes',         href: '/faculty/quizzes',           icon: ClipboardList, group: 'Assess' },
  { key: 'createQuiz',        href: '/faculty/quizzes/create',    icon: PlusCircle,    group: 'Assess' },
  { key: 'videoLectures',     href: '/faculty/videos/upload',     icon: Video,         group: 'Content' },
  { key: 'notesResources',    href: '/faculty/notes',             icon: FileText,      group: 'Content' },
  { key: 'meetings',           href: '/meet',                      icon: Video,         group: 'Engage', tag: 'Live' },
  { key: 'feedback',          href: '/faculty/feedback-review',   icon: MessageSquare, group: 'Engage' },
  { key: 'reportHistory',     href: '/faculty/report-history',     icon: Send,          group: 'Engage' },
  { key: 'help',              href: '/faculty/help',              icon: LifeBuoy,      group: 'Engage' },
];

const adminNav = [
  { key: 'controlTower',    href: '/admin/control-tower', icon: ShieldCheck, tag: 'Live' },
  { key: 'accountApprovals', href: '/admin/approvals',    icon: UserCheck },
  { key: 'meetings',        href: '/admin/meetings',     icon: Video },
] as const;

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'te', label: 'తె' },
  { code: 'hi', label: 'हि' },
];

const roleConfig = {
  student: { accentColor: '#4F46E5', label: 'Student Portal' },
  faculty: { accentColor: '#0D9488', label: 'Faculty Console' },
  admin:   { accentColor: '#D97706', label: 'Control Tower' },
};

function NavTag({ tag }: { tag: string }) {
  if (tag === 'Live') return (
    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: 'rgba(13,148,136,0.10)', color: '#0D9488' }}>
      LIVE
    </span>
  );
  if (tag === 'AI') return (
    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: 'rgba(79,70,229,0.10)', color: '#4F46E5' }}>
      AI
    </span>
  );
  if (tag === 'New') return (
    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: 'rgba(79,70,229,0.10)', color: '#4F46E5' }}>
      NEW
    </span>
  );
  return (
    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
      {tag}
    </span>
  );
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { lang, setLang, t } = useLang();
  const [pendingCount, setPendingCount] = useState(0);

  const currentRole = (role || (session?.user as any)?.role || 'student') as 'student' | 'faculty' | 'admin';
  const navItems = currentRole === 'admin' ? adminNav : currentRole === 'faculty' ? facultyNav : studentNav;
  const rc = roleConfig[currentRole];

  useEffect(() => {
    if (currentRole !== 'admin') return;
    const fetchCount = () => {
      fetch('/api/admin/pending-count')
        .then(r => r.json())
        .then(d => setPendingCount(d.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [currentRole]);

  // Group faculty nav items
  const groupedFaculty = currentRole === 'faculty' ? (() => {
    const groups: Record<string, typeof facultyNav> = {};
    facultyNav.forEach(item => {
      const g = item.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });
    return groups;
  })() : null;

  return (
    <aside
      className="w-[260px] flex flex-col shrink-0 min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #0C1222 0%, #0F172A 100%)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* ── Brand ── */}
      <div className="h-[60px] px-5 flex items-center shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200"
            style={{
              background: `linear-gradient(135deg, ${rc.accentColor}15, ${rc.accentColor}08)`,
              border: `1px solid ${rc.accentColor}25`,
            }}>
            <GraduationCap strokeWidth={1.5} style={{ width: 16, height: 16, color: rc.accentColor }} />
          </div>
          <div>
            <span className="text-[14px] font-bold text-white tracking-tight block leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}>
              EduVision
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {rc.label}
            </span>
          </div>
        </Link>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {currentRole === 'faculty' && groupedFaculty ? (
          /* Grouped nav for faculty */
          Object.entries(groupedFaculty).map(([group, items]) => (
            <div key={group} className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1.5"
                style={{ color: 'rgba(255,255,255,0.2)' }}>
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map(item => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 relative group"
                      style={isActive ? {
                        background: 'rgba(255,255,255,0.06)',
                        color: '#ffffff',
                      } : {
                        color: 'rgba(255,255,255,0.45)',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 rounded-r-full"
                          style={{ width: '2px', background: rc.accentColor }} />
                      )}
                      <span className="flex items-center gap-2.5">
                        <Icon strokeWidth={1.5} className="shrink-0"
                          style={{ width: 16, height: 16, color: isActive ? rc.accentColor : 'rgba(255,255,255,0.3)' }} />
                        {t(item.key as any)}
                      </span>
                      {'tag' in item && item.tag && <NavTag tag={item.tag} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          /* Simple nav for admin/student */
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2"
              style={{ color: 'rgba(255,255,255,0.2)' }}>
              {t('menu')}
            </p>
            <div className="space-y-0.5">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative"
                    style={isActive ? {
                      background: 'rgba(255,255,255,0.06)',
                      color: '#ffffff',
                    } : {
                      color: 'rgba(255,255,255,0.45)',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 rounded-r-full"
                        style={{ width: '2px', background: rc.accentColor }} />
                    )}
                    <span className="flex items-center gap-2.5">
                      <Icon strokeWidth={1.5} className="shrink-0"
                        style={{ width: 16, height: 16, color: isActive ? rc.accentColor : 'rgba(255,255,255,0.3)' }} />
                      {t(item.key as any)}
                    </span>
                    {'tag' in item && item.tag && <NavTag tag={item.tag} />}
                    {item.key === 'accountApprovals' && pendingCount > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold px-1"
                        style={{ background: '#E11D48', color: '#fff' }}>
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* ── Language switcher ── */}
      <div className="px-3 pb-3">
        <div className="px-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Globe strokeWidth={1.5} style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.2)' }} />
            <span className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.2)' }}>
              {t('language')}
            </span>
          </div>
          <div className="flex gap-1">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className="flex-1 py-1 rounded-md font-mono text-[11px] font-bold transition-all duration-150"
                style={lang === code ? {
                  background: 'rgba(79,70,229,0.15)',
                  color: '#818CF8',
                  border: '1px solid rgba(79,70,229,0.2)',
                } : {
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.3)',
                  border: '1px solid transparent',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── User ── */}
      <div className="px-3 pb-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2.5 px-3 py-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ background: `linear-gradient(135deg, ${rc.accentColor}, ${rc.accentColor}88)` }}>
            {session?.user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate">{session?.user?.name || 'User'}</p>
            <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{currentRole}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E11D48')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
            title="Sign out"
          >
            <LogOut style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </aside>
  );
}
