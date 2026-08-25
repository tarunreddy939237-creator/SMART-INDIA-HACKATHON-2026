import React from 'react';

export default function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="relative w-8 h-8 mb-3">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--ev-border)]" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--ev-indigo)] animate-spin" />
      </div>
      <p className="text-[12px] font-medium text-[var(--ev-text-tertiary)]">{message}</p>
    </div>
  );
}
