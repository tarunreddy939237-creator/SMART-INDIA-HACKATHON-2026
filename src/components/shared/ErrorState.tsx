import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'Failed to load records. Please check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-[var(--ev-rose)]/20 bg-[var(--ev-rose-soft)]/50">
      <div className="w-12 h-12 rounded-2xl bg-white border border-[var(--ev-rose)]/20 shadow-[var(--ev-shadow-sm)] flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-[var(--ev-rose)]" strokeWidth={1.5} />
      </div>
      <h3 className="text-[13px] font-semibold text-[var(--ev-text)] mb-1">{title}</h3>
      <p className="text-[12px] text-[var(--ev-text-secondary)] max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-[var(--ev-surface-hover)] text-[var(--ev-rose)] text-[12px] font-semibold border border-[var(--ev-rose)]/20 shadow-[var(--ev-shadow-sm)] transition-all duration-150"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
