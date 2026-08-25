import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'emerald' | 'amber' | 'red' | 'indigo' | 'slate';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export default function Badge({
  children,
  variant = 'indigo',
  size = 'sm',
  dot = false,
}: BadgeProps) {
  const variantStyles = {
    cyan: 'bg-[var(--ev-sky-soft)] text-[var(--ev-sky)] border-[var(--ev-sky)]/20',
    emerald: 'bg-[var(--ev-emerald-soft)] text-[var(--ev-emerald)] border-[var(--ev-emerald)]/20',
    amber: 'bg-[var(--ev-amber-soft)] text-[var(--ev-amber)] border-[var(--ev-amber)]/20',
    red: 'bg-[var(--ev-rose-soft)] text-[var(--ev-rose)] border-[var(--ev-rose)]/20',
    indigo: 'bg-[var(--ev-indigo-soft)] text-[var(--ev-indigo)] border-[var(--ev-indigo)]/20',
    slate: 'bg-[var(--ev-surface-subtle)] text-[var(--ev-text-secondary)] border-[var(--ev-border)]',
  };

  const dotColors = {
    cyan: 'bg-[var(--ev-sky)]',
    emerald: 'bg-[var(--ev-emerald)]',
    amber: 'bg-[var(--ev-amber)]',
    red: 'bg-[var(--ev-rose)]',
    indigo: 'bg-[var(--ev-indigo)]',
    slate: 'bg-[var(--ev-text-muted)]',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-[12px] px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-md ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
