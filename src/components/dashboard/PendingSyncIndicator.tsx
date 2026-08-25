'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Wifi, WifiOff, CloudOff } from 'lucide-react';
import { getPendingSyncCount, retryPendingSync, getSyncTimestamp } from '@/lib/offlineCache';

interface PendingSyncIndicatorProps {
  syncKey?: string; // cache key to show "last synced" for
}

export default function PendingSyncIndicator({ syncKey }: PendingSyncIndicatorProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
    setIsOnline(navigator.onLine);
    if (syncKey) {
      const ts = await getSyncTimestamp(syncKey);
      setLastSynced(ts);
    }
  }, [syncKey]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    const handleOnline = () => { setIsOnline(true); refresh(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refresh]);

  const handleRetry = async () => {
    setRetrying(true);
    await retryPendingSync();
    await refresh();
    setRetrying(false);
  };

  if (!isOnline || pendingCount > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
        style={{
          background: !isOnline ? 'rgba(255,170,0,0.08)' : 'rgba(255,77,94,0.08)',
          border: `1px solid ${!isOnline ? 'rgba(255,170,0,0.25)' : 'rgba(255,77,94,0.25)'}`,
          color: !isOnline ? '#D97706' : '#FF4D5E',
        }}
      >
        {!isOnline ? (
          <WifiOff className="w-3.5 h-3.5" />
        ) : (
          <CloudOff className="w-3.5 h-3.5" />
        )}
        {!isOnline ? (
          <span>Offline mode</span>
        ) : (
          <span>{pendingCount} record{pendingCount !== 1 ? 's' : ''} pending sync</span>
        )}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="p-0.5 rounded hover:bg-white/50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
          </button>
        )}
      </motion.div>
    );
  }

  // Online with no pending — show subtle "synced" indicator
  if (lastSynced) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
        <Wifi className="w-3 h-3 text-emerald-400" />
        Synced {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }

  return null;
}
