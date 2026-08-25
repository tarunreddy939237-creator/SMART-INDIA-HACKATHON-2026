import React from 'react';
import { LucideIcon, BookOpen } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export default function EmptyState({
  title = 'No records available',
  description = 'No data found for this selection.',
  icon: Icon = BookOpen,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-[var(--ev-border)] bg-[var(--ev-surface-subtle)]/50">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[var(--ev-border)] shadow-[var(--ev-shadow-sm)] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[var(--ev-text-muted)]" strokeWidth={1.5} />
      </div>
      <h3 className="text-[14px] font-semibold text-[var(--ev-text)] mb-1">{title}</h3>
      <p className="text-[12px] text-[var(--ev-text-tertiary)] max-w-xs mb-4 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}
