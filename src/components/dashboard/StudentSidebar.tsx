'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useLang, type Lang } from '@/lib/i18n';
import {
  Home, Sparkles, BookOpen, HelpCircle, Video, FileText,
  TrendingUp, Trophy, GraduationCap, Flame, Star,
  MessageSquare, ScanFace, LifeBuoy, Globe, ChevronDown,
  LogOut, Zap, Target, Calendar,
} from 'lucide-react';

const studentNav: { key: string; href: string; icon: any; section: string; tag?: string }[] = [
  { key: 'home',          href: '/student/dashboard',     icon: Home,       section: 'main' },
  { key: 'courses',       href: '/student/courses',       icon: BookOpen,   section: 'main', tag: 'New' },
  { key: 'aiStudyCopilot', href: '/student/learning',    icon: Sparkles,   section: 'main', tag: 'AI' },
  { key: 'dailyTasks',    href: '/student/dashboard#daily-tasks', icon: Target, section: 'main' },
  { key: 'academicCalendar', href: '/student/calendar',  icon: Calendar,   section: 'main' },
  { key: 'quizzes',       href: '/student/quizzes',       icon: HelpCircle, section: 'main' },
  { key: 'videoLectures', href: '/student/videos',        icon: Video,      section: 'main' },
  { key: 'notesResources', href: '/student/dashboard',    icon: FileText,   section: 'main' },
  { key: 'myProfile',     href: '/student/profile',       icon: TrendingUp, section: 'main' },
  { key: 'registerFace',  href: '/student/register-face', icon: ScanFace,   section: 'tools', tag: 'Biometric' },
  { key: 'feedback',      href: '/student/feedback',      icon: MessageSquare, section: 'tools' },
  { key: 'help',          href: '/student/help',          icon: LifeBuoy,   section: 'tools' },
];

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
  { code: 'te', label: 'తె' },
];

interface StudentSidebarProps {
  streak?: number;
  xp?: number;
}

export default function StudentSidebar({ streak = 0, xp = 0 }: StudentSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { lang, setLang, t } = useLang();

  const userName = session?.user?.name || 'Student';
  const initials = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const mainNav = studentNav.filter(n => n.section === 'main');
  const toolNav = studentNav.filter(n => n.section === 'tools');

  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const xpProgress = Math.min(100, (xpInLevel / 500) * 100);

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
        <Link href="/student/dashboard" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 relative transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(13,148,136,0.08))',
              border: '1px solid rgba(79,70,229,0.2)',
            }}>
            <GraduationCap strokeWidth={1.5} style={{ width: 16, height: 16, color: '#818CF8' }} />
          </div>
          <div>
            <span className="text-[14px] font-bold text-white tracking-tight block leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}>
              EduVision
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'rgba(129,140,248,0.5)' }}>
              Student Portal
            </span>
          </div>
        </Link>
      </div>

      {/* ── Main Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2"
          style={{ color: 'rgba(255,255,255,0.2)' }}>
          Navigate
        </p>
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="student-nav-item group"
              style={isActive ? {
                background: 'rgba(255,255,255,0.06)',
                color: '#ffffff',
              } : {
                color: 'rgba(255,255,255,0.45)',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; }}}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 rounded-r-full"
                  style={{ width: '2px', background: '#4F46E5' }} />
              )}
              <Icon strokeWidth={1.5} className="shrink-0 transition-colors"
                style={{ width: 16, height: 16, color: isActive ? '#818CF8' : 'rgba(255,255,255,0.28)' }} />
              <span className="flex-1">{t(item.key as any) || item.key}</span>
              {item.tag === 'AI' && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(79,70,229,0.10)', color: '#818CF8' }}>
                  AI
                </span>
              )}
              {item.tag === 'New' && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(79,70,229,0.10)', color: '#818CF8' }}>
                  NEW
                </span>
              )}
            </Link>
          );
        })}

        {/* ── Separator ── */}
        <div className="my-3 mx-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

        <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2"
          style={{ color: 'rgba(255,255,255,0.15)' }}>
          Tools
        </p>
        {toolNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="student-nav-item group"
              style={isActive ? {
                background: 'rgba(255,255,255,0.06)',
                color: '#ffffff',
              } : {
                color: 'rgba(255,255,255,0.35)',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 rounded-r-full"
                  style={{ width: '2px', background: '#4F46E5' }} />
              )}
              <Icon strokeWidth={1.5} className="shrink-0"
                style={{ width: 15, height: 15, color: isActive ? '#818CF8' : 'rgba(255,255,255,0.22)' }} />
              <span className="flex-1 text-[12px]">{t(item.key as any) || item.key}</span>
              {item.tag === 'Biometric' && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(13,148,136,0.10)', color: '#5EEAD4' }}>
                  BIO
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Gamification Stats ── */}
      <div className="px-3 pb-3">
        <div className="rounded-xl p-3"
          style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(13,148,136,0.04))',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 animate-fire-glow" style={{ color: '#F59E0B' }} />
              <span className="font-mono text-[11px] font-bold" style={{ color: '#F59E0B' }}>{streak}d</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" style={{ color: '#818CF8' }} />
              <span className="font-mono text-[11px] font-bold" style={{ color: '#818CF8' }}>{xp} XP</span>
            </div>
          </div>
          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full animate-progress-fill" style={{
              width: `${xpProgress}%`,
              background: 'linear-gradient(90deg, #4F46E5, #0D9488)',
            }} />
          </div>
          <p className="text-[9px] mt-1.5 font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Level {level} · {xpInLevel}/500 XP
          </p>
        </div>
      </div>

      {/* ── Language ── */}
      <div className="px-3 pb-3">
        <div className="px-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Globe strokeWidth={1.5} style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.2)' }} />
            <span className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.2)' }}>
              Language
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
                  color: 'rgba(255,255,255,0.25)',
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
            style={{ background: 'linear-gradient(135deg, #4F46E5, #0D9488)' }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] font-mono truncate" style={{ color: 'rgba(129,140,248,0.4)' }}>Student</p>
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
