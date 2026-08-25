'use client';
import { useEffect } from 'react';
import { registerServiceWorker, startAutoSync } from '@/lib/offlineCache';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
    startAutoSync();
  }, []);
  return null;
}
