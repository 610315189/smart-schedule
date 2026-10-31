/**
 * Service Worker：让网页版离线可用
 * ---------------------------------------------------------------
 * 课表是"没网也要能看"的东西，所以把静态资源和数据都缓存起来。
 * 注意：Service Worker 只在 HTTPS 或 localhost 下生效；
 * 用局域网 IP（http://192.168.x.x）访问时浏览器不会注册，代码里已做降级。
 */
const CACHE = 'smart-schedule-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/wx-shim.js',
  './js/bundle.js',
  './js/ics.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS).catch(function () { /* 个别资源缺失不阻塞安装 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 页面导航：网络优先，失败回落到缓存（保证更新能及时生效）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
