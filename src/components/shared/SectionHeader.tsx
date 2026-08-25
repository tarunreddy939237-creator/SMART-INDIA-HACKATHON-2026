import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: React.ReactNode;
}

export default function SectionHeader({
  title,
  subtitle,
  badge,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <div className="flex items-center gap-2.5 mb-0.5">
          <h2 className="text-[18px] sm:text-[20px] font-bold text-[var(--ev-text)] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          {badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{ background: 'var(--ev-indigo-soft)', color: 'var(--ev-indigo)' }}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[12px] text-[var(--ev-text-tertiary)]">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
