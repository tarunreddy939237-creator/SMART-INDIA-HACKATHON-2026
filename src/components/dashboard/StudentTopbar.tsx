'use client';

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession, signOut } from 'next-auth/react';
import { Bell, Search, User, Settings, LogOut, ChevronDown, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';

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
  isDismissed: boolean;
  actionUrl: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'academic', label: 'Academic' },
  { key: 'ai', label: 'AI' },
  { key: 'exams', label: 'Exams' },
  { key: 'tasks', label: 'Tasks' },
];

interface StudentTopbarProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export default function StudentTopbar({ title, subtitle }: StudentTopbarProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name || 'Student';

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all');
  const [hasMore, setHasMore] = useState(false);
  const [profilePos, setProfilePos] = useState({ top: 0, right: 0 });

  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const notifTriggerRef = useRef<HTMLButtonElement>(null);
  const profilePanelRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const initials = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const toggleProfile = useCallback(() => {
    setIsProfileOpen(prev => {
      const opening = !prev;
      if (opening) {
        requestAnimationFrame(() => {
          if (profileTriggerRef.current) {
            const rect = profileTriggerRef.current.getBoundingClientRect();
            setProfilePos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          }
        });
      }
      return opening;
    });
    setIsNotifOpen(false);
  }, []);

  const toggleNotif = useCallback(() => {
    setIsNotifOpen(prev => {
      const opening = !prev;
      if (opening) {
        setNotifFilter('all');
        fetchNotifications('all');
      }
      return opening;
    });
    setIsProfileOpen(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeAll = useCallback(() => {
    setIsProfileOpen(false);
    setIsNotifOpen(false);
  }, []);

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

  const fetchNotifications = useCallback(async (filter = notifFilter, loadMore = false) => {
    try {
      setNotifLoading(true);
      const params = new URLSearchParams();
      if (filter === 'unread') params.set('unread', 'true');
      else if (filter !== 'all') params.set('filter', filter);
      params.set('limit', '30');
      if (loadMore) params.set('offset', String(notifications.length));
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(prev => loadMore ? [...prev, ...data.notifications] : data.notifications);
        setUnreadCount(data.unreadCount || 0);
        setHasMore(data.hasMore || false);
      }
    } catch { /* non-fatal */ }
    finally { setNotifLoading(false); }
  }, [notifFilter, notifications.length]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(() => {
      fetch('/api/notifications?countOnly=true', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (d.unreadCount !== undefined) setUnreadCount(d.unreadCount); })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isNotifOpen) fetchNotifications(notifFilter);
  }, [notifFilter, isNotifOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const dismissNotification = useCallback(async (notifId: string) => {
    setNotifications(prev => prev.filter(n => n._id !== notifId));
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', notificationId: notifId }),
      });
    } catch { /* optimistic */ }
  }, []);

  const handleNotifClick = useCallback((notif: Notification) => {
    if (!notif.isRead) markAsRead(notif._id);
    if (notif.actionUrl) window.location.href = notif.actionUrl;
    setIsNotifOpen(false);
  }, [markAsRead]);

  return (
    <header className="h-[56px] px-6 lg:px-7 flex items-center justify-between shrink-0"
      style={{
        background: 'rgba(247,248,252,0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--ev-border)',
        position: 'relative',
        zIndex: 40,
      }}>
      {/* Left */}
      <div className="flex items-center gap-4 min-w-0">
        {title && (
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-[var(--ev-text)] truncate leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}>
              {title}
            </h1>
            {subtitle && (
              <p className="font-mono text-[10px] text-[var(--ev-text-tertiary)] truncate leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Clock */}
        <div className="hidden md:flex items-center px-3 py-1.5 rounded-lg bg-[var(--ev-surface-subtle)] border border-[var(--ev-border-subtle)]">
          <LiveClock />
        </div>

        {/* AI badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--ev-indigo-soft)', border: '1px solid rgba(79,70,229,0.1)' }}>
          <Sparkles className="w-3 h-3" style={{ color: 'var(--ev-indigo)' }} />
          <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--ev-indigo)' }}>AI Active</span>
        </div>

        {/* Notification bell */}
        <button ref={notifTriggerRef} onClick={toggleNotif}
          aria-expanded={isNotifOpen} aria-haspopup="true"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ev-text-tertiary)] hover:text-[var(--ev-text)] hover:bg-[var(--ev-surface-subtle)] transition-all duration-150">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm px-1"
              style={{ background: '#E11D48' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile avatar */}
        <button ref={profileTriggerRef} onClick={toggleProfile}
          aria-expanded={isProfileOpen} aria-haspopup="true"
          aria-label="Profile menu"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--ev-surface-subtle)] transition-colors duration-150">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #0D9488)' }}>
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-[12px] font-semibold text-[var(--ev-text)] leading-tight">{userName}</p>
            <p className="text-[10px] text-[var(--ev-text-tertiary)] leading-tight">Student</p>
          </div>
          <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-[var(--ev-text-muted)] transition-transform duration-150 ${isProfileOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* PORTAL: Notifications */}
      {isNotifOpen && createPortal(
        <div ref={notifPanelRef}
          style={{
            position: 'fixed', top: 60, right: 16, zIndex: 10000,
            width: 'min(360px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 80px)',
            background: 'white', border: '1px solid var(--ev-border)',
            borderRadius: 12, boxShadow: 'var(--ev-shadow-xl)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.12s ease-out',
          }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ev-border-subtle)] shrink-0">
            <span className="text-[13px] font-bold text-[var(--ev-text)]">
              Notifications
              {unreadCount > 0 && <span className="ml-1.5 text-[10px] font-mono" style={{ color: 'var(--ev-indigo)' }}>({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-semibold hover:underline" style={{ color: 'var(--ev-indigo)' }}>
                Mark all read
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--ev-border-subtle)] shrink-0 overflow-x-auto">
            {FILTER_OPTIONS.map(f => (
              <button key={f.key} onClick={() => setNotifFilter(f.key)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap"
                style={notifFilter === f.key ? {
                  background: 'var(--ev-indigo-soft)', color: 'var(--ev-indigo)',
                } : {
                  background: 'transparent', color: 'var(--ev-text-muted)',
                }}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }} className="divide-y divide-[var(--ev-border-subtle)]">
            {notifLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[var(--ev-border)] border-t-[var(--ev-indigo)] rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-[12px] text-[var(--ev-text-muted)] text-center py-8">No notifications</p>
            ) : notifications.map(n => (
              <div key={n._id} onClick={() => handleNotifClick(n)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${n.isRead ? 'hover:bg-[var(--ev-surface-hover)]' : 'bg-[var(--ev-indigo-soft)]/30 hover:bg-[var(--ev-surface-hover)]'}`}>
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
                style={{ background: 'linear-gradient(135deg, #4F46E5, #0D9488)' }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--ev-text)] truncate">{userName}</p>
                <p className="text-[11px] text-[var(--ev-text-muted)] truncate">Student</p>
              </div>
            </div>
          </div>
          <div className="py-1">
            {[
              { label: 'My Dashboard', href: '/student/dashboard' },
              { label: 'My Profile', href: '/student/profile' },
              { label: 'Study Plan', href: '/student/learning' },
            ].map(link => (
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
              signOut({ callbackUrl: '/login' });
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
