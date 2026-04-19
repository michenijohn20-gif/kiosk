const CACHE_NAME = 'pos-upgrade-v1';
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

// Install Event: Cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event: Network-first approach for Supabase, Cache-first for local assets
self.addEventListener('fetch', (event) => {
  // Check if the request is for Supabase API
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If Supabase fetch fails (offline), return null so script.js handles it
        return null;
      })
    );
    return;
  }

  // For other assets (HTML, CSS, JS), try cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
