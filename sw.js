const CACHE_NAME = 'pos-upgrade-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/script.js',
  '/manifest.json',
  '/cdn/bootstrap.min.css',
  '/cdn/bootstrap.bundle.min.js',
  '/cdn/chart.umd.min.js',
  '/cdn/supabase.js'
];

// Install: cache assets and activate immediately without waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting(); // <-- Don't wait for old tabs to close
});

// Activate: delete ALL old caches, then take control of open tabs immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim(); // <-- Take over all open tabs right away
});

// Fetch: network-first for HTML/JS so updates are picked up immediately,
//        cache-first for CSS/fonts/icons (change less often)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always pass Supabase calls straight to the network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Network-first for HTML and JS files
  if (
    event.request.destination === 'document' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Update the cache with the fresh response
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request)) // Fall back to cache if offline
    );
    return;
  }

  // Cache-first for everything else (CSS, icons, fonts)
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
