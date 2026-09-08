/* Offline for DEFUSAL. The game asks the network for nothing once it is
   running — no fonts, no assets, no calls — so caching what it loaded on the
   first visit is enough to make it work with no connection at all.

   Every script and stylesheet is requested with a ?v= stamp that changes on
   each deploy, so a new version is simply a new URL and cache-first can never
   serve a stale one. The page itself carries no stamp, so it goes to the
   network first and falls back to the cache when there isn't one. */

var CACHE = 'defusal-v1';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function keep(request, response) {
  if (response && response.ok && response.type === 'basic') {
    var copy = response.clone();
    caches.open(CACHE).then(function (c) { c.put(request, copy); });
  }
  return response;
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(function (r) { return keep(e.request, r); })
        .catch(function () {
          return caches.match(e.request)
            .then(function (hit) { return hit || caches.match('index.html'); });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (r) {
        return keep(e.request, r);
      });
    })
  );
});
