/**
 * EduVision Offline Cache — IndexedDB
 * ───────────────────────────────────
 * Provides:
 * 1. Dashboard data caching (attendance, streaks, quizzes)
 * 2. Pending attendance submission queue (auto-retry on reconnect)
 * 3. "Last synced" timestamps for stale-data protection
 */

const DB_NAME = 'eduvision-offline';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(null); return; }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('pendingSync')) {
          const store = db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ── Cache operations ──────────────────────────────────────────────────────────

interface CacheEntry {
  key: string;
  data: any;
  syncedAt: number; // Date.now()
}

export async function cacheData(key: string, data: any): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put({ key, data, syncedAt: Date.now() });
  } catch { /* non-fatal */ }
}

export async function getCachedData(key: string): Promise<{ data: any; syncedAt: number } | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('cache', 'readonly');
      const req = tx.objectStore('cache').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getSyncTimestamp(key: string): Promise<Date | null> {
  const entry = await getCachedData(key);
  return entry?.syncedAt ? new Date(entry.syncedAt) : null;
}

// ── Pending sync queue ────────────────────────────────────────────────────────

export interface PendingRecord {
  id?: number;
  type: 'attendance';
  payload: any;
  createdAt: number;
  retries: number;
}

export async function addToPendingSync(record: Omit<PendingRecord, 'id' | 'createdAt' | 'retries'>): Promise<number> {
  const db = await openDB();
  if (!db) return -1;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('pendingSync', 'readwrite');
      const entry: PendingRecord = {
        ...record,
        createdAt: Date.now(),
        retries: 0,
      };
      const req = tx.objectStore('pendingSync').add(entry);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => resolve(-1);
    } catch {
      resolve(-1);
    }
  });
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await openDB();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('pendingSync', 'readonly');
      const req = tx.objectStore('pendingSync').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export async function getPendingSyncRecords(): Promise<PendingRecord[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('pendingSync', 'readonly');
      const req = tx.objectStore('pendingSync').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function removePendingSync(id: number): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction('pendingSync', 'readwrite');
    tx.objectStore('pendingSync').delete(id);
  } catch { /* non-fatal */ }
}

export async function incrementRetry(id: number): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction('pendingSync', 'readwrite');
    const store = tx.objectStore('pendingSync');
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result;
      if (record) {
        record.retries = (record.retries || 0) + 1;
        store.put(record);
      }
    };
  } catch { /* non-fatal */ }
}

// ── Auto-retry pending syncs ──────────────────────────────────────────────────

export async function retryPendingSync(): Promise<number> {
  const records = await getPendingSyncRecords();
  let synced = 0;

  for (const record of records) {
    if (record.retries >= 5) {
      await removePendingSync(record.id!);
      continue;
    }
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record.payload),
      });
      if (res.ok) {
        await removePendingSync(record.id!);
        synced++;
      } else {
        await incrementRetry(record.id!);
      }
    } catch {
      await incrementRetry(record.id!);
    }
  }
  return synced;
}

// ── Service Worker registration ───────────────────────────────────────────────

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('[offlineCache] SW registration failed:', err);
  });
}

// ── Online/offline event listeners ────────────────────────────────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(): void {
  if (typeof window === 'undefined') return;

  // Retry on reconnect
  window.addEventListener('online', () => {
    console.log('[offlineCache] Back online — retrying pending syncs');
    retryPendingSync();
  });

  // Periodic retry every 30 seconds when online
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      getPendingSyncCount().then((count) => {
        if (count > 0) retryPendingSync();
      });
    }
  }, 30000);
}

export function stopAutoSync(): void {
  if (syncInterval) clearInterval(syncInterval);
}
