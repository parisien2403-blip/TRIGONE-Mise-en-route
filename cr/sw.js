// Copie jumelée dans TRIGONE Mise en route (dossier cr/) : caches préfixés « trigone-cr- » ; ceux de
// Mise en route (« trigone-mise-en-route- ») ne sont jamais effacés d'ici.
const CACHE_NAME = 'trigone-cr-v415';
const ASSETS = [
  './',
  './manifest.json',
  './mascotte.webp',
  './mascotte-pouce.webp',
  './mascotte-poubelle.webp',
  './mascotte-ok.webp',
  './mascotte-maj.webp',
  './demo-mascotte.webp',
  './mascotte-simulateur.webp',
  './mascotte-erreur.webp',
  './mascotte-sauvegarde.webp',
  './mascotte-code.webp',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './logo_cr.png',
  './logo_cr_accueil.png',
  '../logo_mer.webp',
  './phoenix-icon.png',
  './medaille-bronze.webp',
  './medaille-argent.webp',
  './medaille-or.webp',
  './medaille-bronze-icone.webp',
  './medaille-argent-icone.webp',
  './medaille-or-icone.webp',
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './vendor/qrcode.min.js',
  './sw.js',
  '../jumelage.js',
  '../vendor/jsQR.js',
  '../logo_mer.webp'
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
      var anciens = keys.filter(function(k) { return k.indexOf('trigone-cr-') === 0 && k !== CACHE_NAME; });
      return Promise.all(anciens.map(function(k) { return caches.delete(k); })).then(function() { return anciens.length > 0; });
    }).then(function(miseAJour) {
      return self.clients.claim().then(function() {
        // Nouvelle version installée par-dessus une ancienne : les écrans ouverts sont rechargés tout de suite,
        // quelle que soit la version du code qu'ils font tourner (mise à jour forcée, même depuis une très vieille version).
        if (!miseAJour) return;
        return self.clients.matchAll({ type: 'window' }).then(function(fenetres) {
          fenetres.forEach(function(f) { if (f.navigate) f.navigate(f.url).catch(function() {}); });
        });
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Page principale : réseau d'abord. Avec du réseau, le missionnaire reçoit toujours la dernière version
// dès l'ouverture ; sans réseau, ou si le réseau met plus de 3 s à répondre, ou en cas d'erreur serveur,
// on retombe sur la version en cache. La page est toujours rangée sous la même clé ('./'), quels que
// soient les paramètres de l'adresse d'ouverture (lien de QR, montre...).
var DELAI_RESEAU_MS = 3000;
var RACINE_TRIGONE = new URL('../', self.registration.scope).href;
// Numéro de publication (build.json à la racine, lu en direct) ajouté à l'adresse du code de l'appli : GitHub Pages
// garde ses fichiers jusqu'à 10 minutes en mémoire après une publication ; une adresse nouvelle l'oblige à servir
// la version qui vient d'être publiée. La mise à jour est ainsi immédiate, comme sur Cloudflare.
var PUBLICATION = { n: null, lu: 0 };
function numeroPublication() {
  if (PUBLICATION.n && Date.now() - PUBLICATION.lu < 5000) return Promise.resolve(PUBLICATION.n);
  var u = new URL('build.json', RACINE_TRIGONE);
  u.searchParams.set('t', Date.now());
  var lecture = fetch(u.href, { cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
    if (d && d.build) { PUBLICATION.n = d.build; PUBLICATION.lu = Date.now(); }
    return PUBLICATION.n;
  }).catch(function() { return PUBLICATION.n; });
  var delai = new Promise(function(resolve) { setTimeout(function() { resolve(PUBLICATION.n); }, 1500); });
  return Promise.race([lecture, delai]);
}
function chargerPublication(request) {
  return numeroPublication().then(function(n) {
    if (!n) return fetch(request, { cache: 'no-cache' });
    var u = new URL(request.url);
    u.searchParams.set('pub', n);
    return fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }).then(function(r) {
      // une réponse redirigée ne peut pas servir une navigation : on refait la requête d'origine
      return r.redirected ? fetch(request, { cache: 'no-cache' }) : r;
    });
  });
}


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
      // no-cache : on revalide toujours auprès du serveur (304 très léger si rien n'a changé)
      chargerPublication(request).then(function(response) {
        if (response && response.ok) {
          // gardée pour la prochaine ouverture, même si le cache a déjà répondu entre-temps
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
  // Vérifications de mise à jour (updates-manifest.json?t=..., taux, IK) : jamais mises en cache
  if (url.searchParams.has('t') || url.pathname.endsWith('updates-manifest.json')) return;
  if (event.request.mode === 'navigate') {
    // le service worker reste actif jusqu'à la fin de la requête réseau, pour mettre le cache à jour
    var fin;
    event.waitUntil(new Promise(function(resolve) { fin = resolve; }));
    event.respondWith(reseauDAbord(event.request, fin));
    return;
  }

  // Code et données de l'appli (../jumelage.js, *.json…) : réseau d'abord, à la dernière publication ; le cache
  // ne sert que hors ligne. (Auparavant servis depuis le cache : il fallait deux ouvertures pour les avoir à jour.)
  if (/\.(js|json)$/.test(url.pathname) && !/\/vendor\//.test(url.pathname)) {
    // ../jumelage.js?v=N : la page appelle le script commun avec le numéro de publication.
    var cle = url.origin + url.pathname;
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return (url.searchParams.has('v') ? fetch(event.request, { cache: 'no-cache' }) : chargerPublication(event.request)).then(function(response) {
          if (response && response.ok) cache.put(cle, response.clone());
          return response;
        }).catch(function() {
          return cache.match(cle, { ignoreSearch: true }).then(function(c) { return c || Response.error(); });
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

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
