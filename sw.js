// Pass-through Service Worker - No Cache, Online Only
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          console.log('SW: Deleting cache:', cache);
          return caches.delete(cache);
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Directly fetch from network without intercepting/caching
  event.respondWith(fetch(event.request));
});
