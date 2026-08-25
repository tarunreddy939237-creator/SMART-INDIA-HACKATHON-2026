'use client';

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession, signOut } from 'next-auth/react';
import { Bell, Search, Settings, LogOut, User, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useLang, Lang } from '@/lib/i18n';

const LiveClock = memo(function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono tabular-nums text-[11px]" style={{ color: '#64748B' }}>
      {time}
    </span>
  );
});

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  icon: string;
  priority: string;
  isRead: boolean;
  actionUrl: string;
  createdAt: string;
}

interface TopbarProps { title?: string; subtitle?: string; roleBadge?: string; }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Topbar({ title, subtitle, roleBadge }: TopbarProps) {
  const { data: session } = useSession();
  const handleSignOut = useCallback(() => signOut({ callbackUrl: '/login' }), []);
  const userName  = session?.user?.name  || 'Authorized User';
  const userRole  = (session?.user as any)?.role || 'student';
  const userEmail = session?.user?.email || '';
  const initials  = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profilePos, setProfilePos] = useState({ top: 0, right: 0 });

  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const notifTriggerRef = useRef<HTMLButtonElement>(null);
  const profilePanelRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const toggleProfile = useCallback(() => {
    setIsProfileOpen(prev => {
      const opening = !prev;
      if (opening && profileTriggerRef.current) {
        const rect = profileTriggerRef.current.getBoundingClientRect();
        setProfilePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      }
      return opening;
    });
    setIsNotifOpen(false);
  }, []);

  const toggleNotif = useCallback(() => {
    setIsNotifOpen(prev => !prev);
    setIsProfileOpen(false);
  }, []);

  const closeAll = useCallback(() => {
    setIsProfileOpen(false);
    setIsNotifOpen(false);
  }, []);

  const profileLinks: Record<string, { label: string; href: string }[]> = {
    student: [
      { label: 'My Dashboard', href: '/student/dashboard' },
      { label: 'My Profile',   href: '/student/profile'   },
      { label: 'Study Plan',   href: '/student/learning'  },
    ],
    faculty: [
      { label: 'Attendance',      href: '/faculty/attendance' },
      { label: 'Class Analytics', href: '/faculty/classes'    },
    ],
    admin: [
      { label: 'Control Tower', href: '/admin/control-tower' },
      { label: 'Approvals', href: '/admin/approvals' },
    ],
  };

  useEffect(() => {
    if (!isProfileOpen && !isNotifOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (isProfileOpen && !profileTriggerRef.current?.contains(target) && !profilePanelRef.current?.contains(target)) {
        setIsProfileOpen(false);
      }
      if (isNotifOpen && !notifTriggerRef.current?.contains(target) && !notifPanelRef.current?.contains(target)) {
        setIsNotifOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setIsProfileOpen(false); setIsNotifOpen(false); }
    }
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen, isNotifOpen]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20', { cache: 'no-store' });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(() => {
      fetch('/api/notifications?countOnly=true', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (d.unreadCount !== undefined) setUnreadCount(d.unreadCount); })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notifId: string) => {
    setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', notificationId: notifId }),
      });
    } catch { /* optimistic */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
    } catch { /* optimistic */ }
  }, []);

  const handleNotifClick = useCallback((notif: Notification) => {
    if (!notif.isRead) markAsRead(notif._id);
    if (notif.actionUrl) window.location.href = notif.actionUrl;
    setIsNotifOpen(false);
  }, [markAsRead]);

  return (
    <header className="h-[56px] bg-white/95 backdrop-blur-sm px-6 flex items-center justify-between shrink-0 sticky top-0 z-30"
      style={{ borderBottom: '1px solid var(--ev-border)' }}>
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {title && (
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-[var(--ev-text)] truncate leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
            {subtitle && <p className="font-mono text-[10px] text-[var(--ev-text-tertiary)] truncate leading-tight">{subtitle}</p>}
          </div>
        )}
        {roleBadge && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[9px] font-bold tracking-wider"
            style={{ background: 'var(--ev-indigo-soft)', color: 'var(--ev-indigo)' }}>
            {roleBadge}
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ev-surface-subtle)] border border-[var(--ev-border-subtle)] w-44 focus-within:border-[var(--ev-indigo)] focus-within:bg-white focus-within:shadow-[var(--ev-shadow-glow)] transition-all duration-200">
          <Search className="w-3.5 h-3.5 text-[var(--ev-text-muted)] shrink-0" />
          <input type="text" placeholder="Search..." className="bg-transparent text-[12px] text-[var(--ev-text-secondary)] placeholder-[var(--ev-text-muted)] outline-none w-full" />
        </div>

        {/* Clock */}
        <div className="hidden md:flex items-center px-3 py-1.5 rounded-lg bg-[var(--ev-surface-subtle)] border border-[var(--ev-border-subtle)]">
          <LiveClock />
        </div>

        {/* Notification bell */}
        <button ref={notifTriggerRef} onClick={toggleNotif}
          aria-expanded={isNotifOpen} aria-haspopup="true"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ev-text-tertiary)] hover:text-[var(--ev-text)] hover:bg-[var(--ev-surface-subtle)] transition-all duration-150">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full text-white text-[9px] font-mono font-bold flex items-center justify-center px-1"
              style={{ background: '#E11D48' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile avatar */}
        <button ref={profileTriggerRef} onClick={toggleProfile}
          aria-expanded={isProfileOpen} aria-haspopup="true"
          aria-label="Profile menu"
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--ev-surface-subtle)] transition-colors duration-150">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--ev-indigo), var(--ev-teal))' }}>
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-[12px] font-semibold text-[var(--ev-text)] leading-tight">{userName}</p>
            <p className="text-[10px] text-[var(--ev-text-tertiary)] leading-tight capitalize">{userRole}</p>
          </div>
          <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[var(--ev-text-muted)] transition-transform duration-150 ${isProfileOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* PORTAL: Notifications */}
      {isNotifOpen && createPortal(
        <div ref={notifPanelRef}
          style={{
            position: 'fixed', top: 56, right: 16, zIndex: 10000,
            width: 'min(340px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 70px)',
            background: 'white', border: '1px solid var(--ev-border)',
            borderRadius: 12, boxShadow: 'var(--ev-shadow-xl)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.12s ease-out',
          }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ev-border-subtle)] shrink-0">
            <span className="text-[13px] font-bold text-[var(--ev-text)]">
              Notifications {unreadCount > 0 && <span className="ml-1 text-[10px] font-mono text-[var(--ev-indigo)]">({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-[var(--ev-indigo)] hover:underline font-semibold">Mark all read</button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 360 }} className="divide-y divide-[var(--ev-border-subtle)]">
            {notifications.length === 0 ? (
              <p className="text-[12px] text-[var(--ev-text-muted)] text-center py-8">No notifications</p>
            ) : notifications.map(n => (
              <div key={n._id} onClick={() => handleNotifClick(n)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${n.isRead ? 'hover:bg-[var(--ev-surface-hover)]' : 'hover:bg-[var(--ev-surface-hover)]'}`}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: n.isRead ? 'transparent' : n.priority === 'urgent' ? '#E11D48' : '#0D9488' }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] truncate ${n.isRead ? 'text-[var(--ev-text-tertiary)]' : 'font-semibold text-[var(--ev-text)]'}`}>{n.title}</p>
                  <p className={`text-[11px] truncate mt-0.5 ${n.isRead ? 'text-[var(--ev-text-muted)]' : 'text-[var(--ev-text-secondary)]'}`}>{n.message}</p>
                  <p className="text-[10px] text-[var(--ev-text-muted)] mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* PORTAL: Profile */}
      {isProfileOpen && createPortal(
        <div ref={profilePanelRef}
          style={{
            position: 'fixed', top: profilePos.top, right: profilePos.right, zIndex: 10000,
            width: 224, background: 'white', border: '1px solid var(--ev-border)',
            borderRadius: 12, boxShadow: 'var(--ev-shadow-xl)', overflow: 'hidden',
            animation: 'fadeIn 0.12s ease-out',
          }}>
          <div className="px-4 py-3 border-b border-[var(--ev-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--ev-indigo), var(--ev-teal))' }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--ev-text)] truncate">{userName}</p>
                <p className="text-[11px] text-[var(--ev-text-muted)] truncate">{userEmail}</p>
              </div>
            </div>
          </div>
          <div className="py-1">
            {(profileLinks[userRole] || profileLinks.student).map(link => (
              <Link key={link.href} href={link.href} onClick={closeAll}
                className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--ev-text-secondary)] hover:bg-[var(--ev-surface-hover)] hover:text-[var(--ev-text)] transition-colors">
                <User className="w-3.5 h-3.5 text-[var(--ev-text-muted)]" />
                {link.label}
              </Link>
            ))}
            <Link href="/settings" onClick={closeAll}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[var(--ev-text-secondary)] hover:bg-[var(--ev-surface-hover)] transition-colors">
              <Settings className="w-3.5 h-3.5 text-[var(--ev-text-muted)]" />
              Settings
            </Link>
          </div>
          <div className="border-t border-[var(--ev-border-subtle)] py-1">
            <button onClick={() => {
              closeAll();
              try {
                localStorage.removeItem('next-auth.session-token');
                localStorage.removeItem('__Secure-next-auth.session-token');
                sessionStorage.clear();
              } catch { /* ignore */ }
              handleSignOut();
            }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[var(--ev-rose)] hover:bg-[var(--ev-rose-soft)] transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
