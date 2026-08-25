'use client';

import React from 'react';
import ParentSidebar from '@/components/dashboard/ParentSidebar';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ev-bg, #F7F8FC)' }}>
      <ParentSidebar />
      <main className="ml-[256px] min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
