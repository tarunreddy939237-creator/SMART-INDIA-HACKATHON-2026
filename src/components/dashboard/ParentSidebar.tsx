'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, BarChart3, MessageSquare, LogOut, ChevronLeft, ChevronRight,
  FileText, Bell,
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

const parentNav = [
  { key: 'report',    href: '/parent/report',    icon: BarChart3,      label: 'Total Report' },
  { key: 'feedback',  href: '/parent/feedback',  icon: MessageSquare,  label: 'Feedback' },
];

export default function ParentSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300"
      style={{
        width: collapsed ? 72 : 256,
        background: 'linear-gradient(180deg, #0C1222 0%, #0F172A 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
          E
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-semibold text-sm tracking-tight">EduDev</span>
            <span className="block text-[10px] text-slate-400 -mt-0.5">Parent Portal</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {parentNav.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-white/5 p-3 space-y-2">
        {!collapsed && session?.user && (
          <div className="px-3 py-2">
            <p className="text-white text-xs font-medium truncate">{session.user.name || 'Parent'}</p>
            <p className="text-slate-500 text-[10px] truncate">{session.user.email}</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
