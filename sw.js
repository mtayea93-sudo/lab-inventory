/* Service Worker — تطبيق ويب قابل للتحميل (PWA) */
const CACHE = 'lab-inv-v1';
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).catch(function () {}));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(clients.claim());
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  /* الصفحات وملفات الإصدارات: شبكة أولاً علشان التحديث الإجباري يفضل شغال */
  if (e.request.mode === 'navigate' || /version\.json|index\.html$/.test(url.pathname)) {
    e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
    return;
  }
  /* باقي الملفات: كاش أولاً مع تحديث في الخلفية */
  e.respondWith(caches.match(e.request).then(function (hit) {
    var net = fetch(e.request).then(function (resp) {
      if (resp && resp.ok && url.origin === location.origin) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return resp;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
