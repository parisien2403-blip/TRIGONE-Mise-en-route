const CACHE_NAME = 'trigone-mise-en-route-v39';
const ASSETS = [
  './',
  './manifest.json',
  './app.js',
  './logo_mer.webp',
  './codier.json',
  './mascotte.webp',
  './phoenix-icon.png',
  './mascotte-erreur.webp',
  './mascotte-ok.webp',
  './mascotte-pouce.webp',
  './mascotte-poubelle.webp',
  './mascotte-maj.webp',
  './mascotte-code.webp',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './vendor/qrcode.min.js',
  './vendor/pdf-lib.min.js',
  './sw.js'
];

function cacheOne(cache, url, attempt) {
  attempt = attempt || 1;
  return cache.add(url).catch(function(err) {
    if (attempt < 3) {
      return new Promise(function(resolve) { setTimeout(resolve, 400 * attempt); })
        .then(function() { return cacheOne(cache, url, attempt + 1); });
    }
    console.warn('Cache skip apres plusieurs tentatives:', url, err);
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(ASSETS.map(function(url) { return cacheOne(cache, url); }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Page principale : réseau d'abord, comme TRIGONE compte-rendu — la dernière version dès qu'il y a du
// réseau, secours sur le cache sinon (hors ligne, ou réseau trop lent après 3 s).
var DELAI_RESEAU_MS = 3000;

function reseauDAbord(request, fin) {
  return caches.open(CACHE_NAME).then(function(cache) {
    return new Promise(function(resolve) {
      var repondu = false;
      var minuteur;
      function repondre(resp) {
        if (repondu || !resp) return;
        repondu = true;
        clearTimeout(minuteur);
        resolve(resp);
      }
      function replier(defaut) {
        return cache.match('./', { ignoreSearch: true }).then(function(c) { repondre(c || defaut); });
      }
      minuteur = setTimeout(function() { replier(null); }, DELAI_RESEAU_MS);
      fetch(request, { cache: 'no-cache' }).then(function(response) {
        if (response && response.ok) {
          cache.put('./', response.clone()).catch(function() {});
          repondre(response);
        } else if (response && response.type === 'opaqueredirect') {
          repondre(response);
        } else {
          return replier(response);
        }
      }).catch(function() {
        return replier(Response.error());
      }).then(fin, fin);
    });
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    var fin;
    event.waitUntil(new Promise(function(resolve) { fin = resolve; }));
    event.respondWith(reseauDAbord(event.request, fin));
    return;
  }

  // Code et données de l'appli (app.js, codier.json…) : réseau d'abord, pour qu'une mise à jour soit
  // visible dès la première ouverture ; le cache ne sert que hors ligne.
  if (/\.(js|json)$/.test(url.pathname) && !/\/vendor\//.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(event.request, { cache: 'no-cache' }).then(function(response) {
          if (response && response.ok && !url.search) cache.put(event.request, response.clone());
          return response;
        }).catch(function() {
          return cache.match(event.request, { ignoreSearch: true }).then(function(c) { return c || Response.error(); });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function(cached) {
        var network = fetch(event.request).then(function(response) {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(function() {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return cache.match('./');
          }
          return Response.error();
        });
        return cached || network;
      });
    })
  );
});
