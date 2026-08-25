/**
 * EduVision Service Worker — Offline-First Strategy
 *
 * Caches:
 * - App shell (HTML, CSS, JS bundles)
 * - Static assets (fonts, icons)
 * - API responses for dashboard/attendance (stale-while-revalidate)
 *
 * Does NOT cache:
 * - Face recognition model files (loaded on-demand)
 * - Chat/AI responses (real-time by nature)
 */

const CACHE_NAME = 'eduvision-v1';
const STATIC_CACHE = 'eduvision-static-v1';
const DATA_CACHE = 'eduvision-data-v1';

// App shell URLs to pre-cache
const SHELL_URLS = [
  '/',
  '/student/dashboard',
  '/student/profile',
  '/student/learning',
  '/student/quizzes',
  '/login',
];

// API routes to cache with stale-while-revalidate
const DATA_URLS = [
  '/api/attendance',
  '/api/streaks',
  '/api/students',
  '/api/study-plan',
  '/api/quizzes',
  '/api/notes',
  '/api/notices',
  '/api/lms-sync',
  '/api/at-risk',
  '/api/guardian-settings',
  '/api/attendance-heatmap',
  '/api/institution-analytics',
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(SHELL_URLS).catch((err) => {
        console.warn('[SW] Shell pre-cache failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // API routes: stale-while-revalidate
  if (url.pathname.startsWith('/api/')) {
    const isDataUrl = DATA_URLS.some((d) => url.pathname.startsWith(d));
    if (isDataUrl) {
      event.respondWith(
        caches.open(DATA_CACHE).then((cache) => {
          return cache.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request)
              .then((response) => {
                if (response.ok) {
                  cache.put(event.request, response.clone());
                }
                return response;
              })
              .catch(() => cached);

            return cached || fetchPromise;
          });
        })
      );
      return;
    }
    // Other API calls: network only (chat, face-embedding, etc.)
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
