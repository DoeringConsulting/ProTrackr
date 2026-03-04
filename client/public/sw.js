// Service Worker for Offline Caching with Auto-Update
const APP_VERSION = '9494be69'; // Updated with each deployment
const CACHE_NAME = `doring-consulting-${APP_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache resources and skip waiting
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
  // SW wartet auf explizites SKIP_WAITING-Signal vom User
  // (kein automatisches skipWaiting – verhindert Timing-Probleme)
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', APP_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients about the new version
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION,
          });
        });
      });
    })
  );
});

// Fetch event - Network First strategy with cache fallback
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Never cache or intercept API/auth calls and non-GET requests.
  // This prevents stale auth/session behavior and login race issues.
  if (
    event.request.method !== 'GET' ||
    requestUrl.pathname.startsWith('/api/')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if valid response
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the fetched response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // Return offline page if available
          return caches.match('/offline.html');
        });
      })
  );
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION',
      version: APP_VERSION,
    });
  }
});
