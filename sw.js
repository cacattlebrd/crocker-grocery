// Crocker Grocery — service worker
// Caches the app shell for offline view; webhook calls go straight to network.

const CACHE_NAME = 'crocker-grocery-v1';
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for the Apps Script webhook
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    return; // default fetch
  }

  // App shell: cache-first, network-fallback
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          // Update cache for future loads
          if (res && res.ok && e.request.method === 'GET') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
          }
          return res;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});
