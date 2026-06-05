const CACHE_NAME = 'overdue-crm-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './Dashboard.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/api.js',
  './js/ui.js',
  './js/auth.js',
  './js/views/group.js',
  './js/views/insights.js',
  './js/views/detail.js',
  './js/views/gps.js',
  './js/views/reminders.js',
  './js/main.js',
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('SW: Install event. Pre-caching static assets...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Use cache.addAll with a catch block in case some files fail (e.g. root in GAS environment)
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: Pre-cache failed for some assets, caching individually...', err);
        // Fallback: cache whatever we can individually
        STATIC_ASSETS.forEach(asset => {
          cache.add(asset).catch(e => console.error('SW: Failed to cache asset individually:', asset, e));
        });
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('SW: Activate event. Purging obsolete cache layers...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Deleting obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - Stale-While-Revalidate for APIs and static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle Google Script API calls & Google APIs (Stale-While-Revalidate)
  if (
    url.href.includes('script.google.com') || 
    url.href.includes('exec') || 
    url.href.includes('googleapis.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(err => {
              console.warn('SW: Network fetch failed for API, utilizing cached copy if available', err);
              return cachedResponse; // fallback
            });
            
          // Serve cached version immediately if present, otherwise fetch from server
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
  
  // Handle static assets (Stale-While-Revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(err => {
            // Offline fallbacks
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return cache.match('./index.html') || cache.match('./') || cache.match('/');
            }
            return new Response('Content offline and unavailable.', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
          
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-customer-data') {
    event.waitUntil(syncCustomerData());
  }
});

async function syncCustomerData() {
  const cache = await caches.open(CACHE_NAME);
  const pendingRequests = await cache.keys();
  
  for (const request of pendingRequests) {
    if (request.url.includes('/sync')) {
      const response = await cache.match(request);
      const data = await response.json();
      
      await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      await cache.delete(request);
    }
  }
}
