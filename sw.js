const CACHE_NAME = 'trigone-mise-en-route-v82';
const ASSETS = [
  './',
  './manifest.json',
  './app.js',
  './logo_mer.webp',
  './jumelage.js',
  './cr/logo_cr_accueil.png',
  './codier.json',
  './mascotte.webp',
  './demo-mascotte.webp',
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
  './vendor/jsQR.js',
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
      var anciens = keys.filter(function(k) { return k.indexOf('trigone-mise-en-route') === 0 && k !== CACHE_NAME; });
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

// Page principale : réseau d'abord, comme TRIGONE compte-rendu — la dernière version dès qu'il y a du
// réseau, secours sur le cache sinon (hors ligne, ou réseau trop lent après 3 s).
var DELAI_RESEAU_MS = 3000;
var RACINE_TRIGONE = self.registration.scope;
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
      chargerPublication(request).then(function(response) {
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

// « Partager » / « Ouvrir avec » TRIGONE (Android) : le fichier arrive ici en POST. Il est rangé dans un cache
// dédié, puis l'appli s'ouvre et le traite (Espace valideur, assistant Chorus DT ou retour d'un refus).
function recevoirPartage(request) {
  var n = 0, erreur = '', recu = [];
  return request.formData().then(function(form) {
    // Détail de ce que la messagerie a transmis (noms des champs, types, tailles) : affiché si rien n'est exploitable.
    form.forEach(function(v, k) { recu.push(k + ':' + (v && typeof v !== 'string' ? (v.type || 'fichier') + '/' + v.size + 'o' : 'texte/' + String(v || '').length + 'c')); });
    // Tout fichier reçu, quel que soit le nom du champ ; et le contenu d'une demande partagée comme du texte
    // (certaines messageries, dont Outlook, peuvent transmettre le contenu plutôt que le fichier).
    var fichiers = [];
    form.forEach(function(v) {
      if (v && typeof v !== 'string') { if (v.size) fichiers.push(v); return; }
      var t = String(v || '').trim();
      if (t.charAt(0) === '{' && t.indexOf('TRIGONE-MISE-EN-ROUTE') !== -1) fichiers.push(new File([t], 'demande-partagee.json', { type: 'application/json' }));
    });
    n = fichiers.length;
    return caches.open('trigone-partage').then(function(cache) {
      return Promise.all(fichiers.map(function(f, i) {
        return cache.put(new Request(self.registration.scope + '__recu__/' + Date.now() + '-' + i),
          new Response(f, { headers: { 'Content-Type': f.type || 'application/json', 'X-Nom': encodeURIComponent(f.name || 'demande.json') } }));
      }));
    });
  }).catch(function(e) { erreur = (e && e.message) || 'lecture'; }).then(function() {
    return Response.redirect(self.registration.scope + '?partage=' + n + (erreur ? '&err=' + encodeURIComponent(erreur) : '') +
      (n ? '' : '&recu=' + encodeURIComponent(recu.join(', ').slice(0, 300) || 'rien')), 303);
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method === 'POST' && /\/partage-trigone$/.test(new URL(event.request.url).pathname)) { event.respondWith(recevoirPartage(event.request)); return; }
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Pages de TRIGONE Compte-rendu (dossier cr/) : elles ont leur propre service worker, on ne s'en mêle pas
  // (sinon la page CR serait rangée à la place de celle de Mise en route).
  if (event.request.mode === 'navigate' && url.href.indexOf(self.registration.scope + 'cr/') === 0) return;
  if (event.request.mode === 'navigate') {
    var fin;
    event.waitUntil(new Promise(function(resolve) { fin = resolve; }));
    event.respondWith(reseauDAbord(event.request, fin));
    return;
  }

  // Code et données de l'appli (app.js, codier.json…) : réseau d'abord, pour qu'une mise à jour soit
  // visible dès la première ouverture ; le cache ne sert que hors ligne.
  if (/\.(js|json)$/.test(url.pathname) && !/\/vendor\//.test(url.pathname)) {
    if (url.searchParams.has('t')) return;   // vérifications de mise à jour (build.json?t=…) : jamais en cache
    // app.js?v=N : la page appelle ses scripts avec le numéro de publication, l'adresse change à chaque version.
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
