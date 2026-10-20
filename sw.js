/* Conectividad Plus. La misma cadena VERSION está en js/app.js. */
var VERSION = '4';
var CACHE = 'conectividad-plus-' + VERSION;
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/logic.js',
  './js/demo-data.js',
  './js/app.js',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './img/logo.webp',
  './img/logo.jpg'
];

self.addEventListener('install', function (event) {
  // Guarda el cascarón en la caché de esta versión.
  // La página abierta sigue igual hasta que toquen Actualizar.
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
          if (!res.ok) throw new Error('No se pudo guardar ' + url);
          return cache.put(url, res);
        });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
});

function pideRedPrimero(req) {
  if (req.mode === 'navigate') return true;
  var path = new URL(req.url).pathname;
  if (/(^|\/)index\.html$/.test(path) || /\/$/.test(path)) return true;
  return /\.(js|css)$/.test(path);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(req));
    return;
  }
  if (!pideRedPrimero(req) && !/\.(png|ico|json|webmanifest)$/.test(url.pathname)) return;
  event.respondWith(redLuegoCache(req));
});

function redLuegoCache(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copia = res.clone();
      var html = req.mode === 'navigate' ? res.clone() : null;
      caches.open(CACHE).then(function (cache) {
        cache.put(req, copia);
        if (html) cache.put('./index.html', html);
      });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (cached) {
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 504, statusText: 'Offline' });
    });
  });
}
