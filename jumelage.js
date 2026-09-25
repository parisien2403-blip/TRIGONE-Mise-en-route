// ===================== JUMELAGE TRIGONE : Mise en route ⇄ Compte-rendu de mission =====================
// Chargé par les deux applis (index.html à la racine, cr/index.html). À l'ouverture de TRIGONE, un écran de
// choix coupé en diagonale : Mise en route en haut à gauche, Compte-rendu de mission en bas à droite. Toucher
// un côté ouvre cette appli, avec son propre accueil. Toucher le logo d'un accueil ramène à l'écran de choix.
// Au changement d'appli : pas de nouvel écran d'ouverture, et le code à 4 chiffres n'est pas redemandé.
(function() {
    var CLE_BASCULE = 'trigone_bascule', CLE_DEVERROUILLE = 'trigone_deverrouille', CLE_THEME = 'trigone_theme';
    var arrivee = false;
    try { arrivee = sessionStorage.getItem(CLE_BASCULE) === '1'; sessionStorage.removeItem(CLE_BASCULE); } catch (e) {}

    window.JUMELAGE_ARRIVEE = function() { return arrivee; };

    // Passage d'une appli à l'autre sans écran blanc : transition native entre les deux pages (Chrome / Samsung
    // Internet récents, Safari 18.2+). Effet « pliable qui s'ouvre » : la nouvelle interface se déplie depuis la
    // ligne centrale vers les bords, l'ancienne recule et s'estompe. Ailleurs : fondu doux (repli).
    var TRANSITION_NATIVE = 'onpagereveal' in window;
    window.addEventListener('pageswap', function(e) {
        var nous = false;
        try { nous = sessionStorage.getItem(CLE_BASCULE) === '1'; } catch (err) {}
        if (e.viewTransition && !nous) e.viewTransition.skipTransition();
    });
    window.addEventListener('pagereveal', function(e) {
        if (e.viewTransition && !arrivee) e.viewTransition.skipTransition();
    });
    if (arrivee && !TRANSITION_NATIVE) {
        document.documentElement.classList.add('jum-entree');
        // filet de sécurité : la page ne reste jamais invisible
        setTimeout(function() { document.documentElement.classList.remove('jum-entree'); }, 1500);
    }
    window.JUMELAGE_DEVERROUILLE = function() { try { return sessionStorage.getItem(CLE_DEVERROUILLE) === '1'; } catch (e) { return false; } };
    window.JUMELAGE_MARQUER_DEVERROUILLE = function() { try { sessionStorage.setItem(CLE_DEVERROUILLE, '1'); } catch (e) {} };
    // Thème clair / sombre commun aux deux applis : null tant qu'aucun choix n'a été fait.
    window.JUMELAGE_THEME = function(sombre) {
        if (sombre === undefined) {
            try { var t = localStorage.getItem(CLE_THEME); return t === null ? null : t === '1'; } catch (e) { return null; }
        }
        try { localStorage.setItem(CLE_THEME, sombre ? '1' : '0'); } catch (e) {}
    };

    // Hauteur réelle de l'écran (--vh-reel), utilisée par l'accueil des deux applis à la place de 100dvh : sur un
    // écran pliable (Galaxy Z Fold…) ou après la fermeture du clavier, 100dvh peut rester périmé et l'accueil
    // déborde en bas jusqu'à une rotation. Remesurée à chaque changement ; pas pendant la saisie (clavier ouvert).
    function mesurerHauteur() {
        var actif = document.activeElement;
        if (actif && /^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName) && actif.type !== 'file' && actif.type !== 'checkbox') return;
        var h = window.innerHeight || document.documentElement.clientHeight;
        if (h > 0) document.documentElement.style.setProperty('--vh-reel', h + 'px');
    }
    function mesurerPlusTard() { mesurerHauteur(); setTimeout(mesurerHauteur, 120); setTimeout(mesurerHauteur, 450); }
    window.JUMELAGE_MESURER = mesurerPlusTard;
    mesurerHauteur();
    window.addEventListener('resize', mesurerPlusTard);
    window.addEventListener('orientationchange', mesurerPlusTard);
    window.addEventListener('pageshow', mesurerPlusTard);
    document.addEventListener('focusout', function() { setTimeout(mesurerPlusTard, 250); });
    document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') mesurerPlusTard(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', mesurerPlusTard);
    if (window.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', mesurerPlusTard);

    var css = '' +
        '@view-transition { navigation: auto; }' +
        '::view-transition-group(root) { animation-duration: 0.62s; }' +
        '::view-transition-old(root) { animation: jum-reculer 0.5s cubic-bezier(0.4,0,0.2,1) both; }' +
        '::view-transition-new(root) { animation: jum-deplier 0.62s cubic-bezier(0.22,0.8,0.24,1) both; }' +
        '@keyframes jum-deplier { 0% { clip-path: inset(0 50% 0 50% round 28px); transform: scale(0.96); filter: brightness(0.85); }' +
            ' 60% { clip-path: inset(0 4% 0 4% round 22px); filter: brightness(1); } 100% { clip-path: inset(0 0 0 0 round 0); transform: none; filter: none; } }' +
        '@keyframes jum-reculer { to { transform: scale(0.9); opacity: 0; filter: blur(3px) brightness(0.9); } }' +
        '@media (prefers-reduced-motion: reduce) { ::view-transition-old(root), ::view-transition-new(root) { animation-duration: 0.01s; } }' +
        /* repli sans transition native : la nouvelle page apparaît en fondu, sans flash blanc */
        'html.jum-entree body { opacity: 0; transform: scale(0.97); }' +
        'html.jum-entree-go body { opacity: 1; transform: none; transition: opacity 0.38s ease, transform 0.45s cubic-bezier(0.22,0.8,0.24,1); }' +
        '.JUM-LOGO-CHOIX { cursor: pointer; -webkit-tap-highlight-color: transparent; }' +
        '.JUM-LOGO-CHOIX:active { transform: scale(0.97); }' +
        /* Écran de choix : deux triangles, coupe de la diagonale haut-droite → bas-gauche */
        '.JUM-CHOIX { position: fixed; inset: 0; z-index: 99985; overflow: hidden; background: #0f0f0f; -webkit-tap-highlight-color: transparent;' +
            ' user-select: none; -webkit-user-select: none; transition: opacity 0.32s ease; }' +
        '.JUM-CHOIX.sortie { opacity: 0; pointer-events: none; }' +
        '.JUM-PAN { position: absolute; inset: 0; cursor: pointer; transition: clip-path 0.5s cubic-bezier(0.65,0,0.25,1), filter 0.2s ease; }' +
        '.JUM-PAN-MER { background: linear-gradient(150deg, #ffffff 0%, #eef2f6 55%, #dde5ee 100%); clip-path: polygon(0 0, 100% 0, 100% 0, 0 100%); }' +
        '.JUM-PAN-CR { background: linear-gradient(150deg, #2a2a2a 0%, #161616 60%, #0b0b0b 100%); clip-path: polygon(100% 0, 100% 100%, 0 100%, 0 100%); }' +
        '.JUM-PAN.plein { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); z-index: 2; }' +
        '.JUM-PAN-CR.plein { clip-path: polygon(100% 0, 100% 100%, 0 100%, 0 0); }' +
        '.JUM-PAN.appuye { filter: brightness(0.94); }' +
        '.JUM-PAN-CR.appuye { filter: brightness(1.25); }' +
        '.JUM-BLOC { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 1.6vh; transform: translate(-50%, -50%);' +
            ' transition: transform 0.5s cubic-bezier(0.65,0,0.25,1), opacity 0.3s ease; }' +
        '.JUM-PAN-MER .JUM-BLOC { left: 36%; top: 29%; }' +
        '.JUM-PAN-CR .JUM-BLOC { left: 64%; top: 71%; }' +
        '.JUM-PAN.plein .JUM-BLOC { left: 50%; top: 50%; }' +
        '.JUM-BLOC img { display: block; height: auto; pointer-events: none; }' +
        '.JUM-PAN-MER img { width: min(40vw, 26vh, 230px); }' +
        /* même largeur de « TRIGONE » dans les deux logos */
        '.JUM-PAN-CR img { width: calc(min(40vw, 26vh, 230px) * 1.246); filter: brightness(0) invert(1); }' +
        '@media (orientation: landscape) { .JUM-PAN-MER img { width: min(22vw, 38vh, 230px); } .JUM-PAN-CR img { width: calc(min(22vw, 38vh, 230px) * 1.246); }' +
            ' .JUM-PAN-MER .JUM-BLOC { left: 30%; top: 34%; } .JUM-PAN-CR .JUM-BLOC { left: 70%; top: 66%; } }' +
        '.JUM-SOUS { font: 800 0.62rem/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; white-space: nowrap; }' +
        '.JUM-PAN-MER .JUM-SOUS { color: #5a7a94; }' +
        '.JUM-PAN-CR .JUM-SOUS { color: #d6a756; }' +
        '.JUM-TRAIT { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; transition: opacity 0.2s ease; }' +
        '.JUM-CHOIX.choisi .JUM-TRAIT { opacity: 0; }' +
        '@media (prefers-reduced-motion: reduce) { .JUM-PAN, .JUM-BLOC { transition-duration: 0.01s; } }' +
        '';
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    // ---------- Écran de choix ----------
    var DANS_CR = /\/cr\/(index\.html)?$/.test(location.pathname);
    var APPLIS = {
        mer: { url: DANS_CR ? '../' : './', logo: (DANS_CR ? '../' : '') + 'logo_mer.webp', nom: 'TRIGONE Mise en route', sous: 'Avant le départ' },
        cr: { url: DANS_CR ? './' : 'cr/', logo: (DANS_CR ? '' : 'cr/') + 'logo_cr_accueil.png', nom: 'TRIGONE Compte-rendu de mission', sous: 'Au retour de mission' }
    };
    var ICI = DANS_CR ? 'cr' : 'mer', CLE_CHOIX = 'trigone_choix_fait';
    var ecran = null;

    function panneau(cle) {
        var a = APPLIS[cle];
        return '<div class="JUM-PAN JUM-PAN-' + cle.toUpperCase() + '" data-app="' + cle + '" role="button" tabindex="0" aria-label="Ouvrir ' + a.nom + '">' +
            '<div class="JUM-BLOC"><img src="' + a.logo + '" alt="' + a.nom + '"><span class="JUM-SOUS">' + a.sous + '</span></div></div>';
    }
    // Côté touché : au-dessus ou au-dessous de la diagonale haut-droite → bas-gauche.
    function coteDuPoint(x, y) { return (x / window.innerWidth + y / window.innerHeight) < 1 ? 'mer' : 'cr'; }

    function choisir(cle) {
        if (!ecran || ecran.classList.contains('choisi')) return;
        ecran.classList.add('choisi');
        try { sessionStorage.setItem(CLE_CHOIX, '1'); } catch (e) {}
        var pan = ecran.querySelector('.JUM-PAN-' + cle.toUpperCase());
        pan.classList.remove('appuye'); pan.classList.add('plein');
        if (cle === ICI) {
            setTimeout(function() { ecran.classList.add('sortie'); }, 420);
            setTimeout(function() { if (ecran) { ecran.remove(); ecran = null; } document.documentElement.classList.remove('jum-choix'); }, 800);
        } else {
            try { sessionStorage.setItem(CLE_BASCULE, '1'); } catch (e) {}
            setTimeout(function() { location.href = APPLIS[cle].url; }, 480);
        }
    }

    window.JUMELAGE_CHOIX = function() {
        if (ecran || !document.body) return;
        if (document.body.classList.contains('demo-active')) return;
        ecran = document.createElement('div');
        ecran.className = 'JUM-CHOIX';
        ecran.setAttribute('role', 'dialog');
        ecran.setAttribute('aria-label', 'Choisir une application TRIGONE');
        ecran.innerHTML = panneau('mer') + panneau('cr') +
            '<svg class="JUM-TRAIT" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
            '<line x1="100" y1="0" x2="0" y2="100" stroke="#d6a756" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity="0.8"/></svg>';
        ecran.addEventListener('click', function(e) { choisir(coteDuPoint(e.clientX, e.clientY)); });
        ecran.addEventListener('pointerdown', function(e) {
            var p = ecran.querySelector('.JUM-PAN-' + coteDuPoint(e.clientX, e.clientY).toUpperCase());
            if (p) p.classList.add('appuye');
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(t) {
            ecran.addEventListener(t, function() { Array.prototype.forEach.call(ecran ? ecran.querySelectorAll('.appuye') : [], function(p) { p.classList.remove('appuye'); }); });
        });
        ecran.addEventListener('keydown', function(e) {
            var p = e.target.closest && e.target.closest('.JUM-PAN');
            if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choisir(p.getAttribute('data-app')); }
        });
        document.body.appendChild(ecran);
        document.documentElement.classList.add('jum-choix');
    };

    // À l'ouverture de TRIGONE (pas en passant d'une appli à l'autre) : l'écran de choix, sous l'animation
    // d'ouverture, la présentation, le code d'accès et « Avant de commencer », qui gardent la priorité.
    var dejaChoisi = false;
    try { dejaChoisi = sessionStorage.getItem(CLE_CHOIX) === '1'; } catch (e) {}
    if (!arrivee && !dejaChoisi) {
        if (document.body) window.JUMELAGE_CHOIX();
        else document.addEventListener('DOMContentLoaded', window.JUMELAGE_CHOIX);
    }

    // À l'arrivée dans l'autre appli (repli sans transition native) : la page apparaît en fondu.
    window.JUMELAGE_ANIMER_ARRIVEE = function() {
        if (!arrivee) return;
        arrivee = false;
        if (TRANSITION_NATIVE) return;
        var racine = document.documentElement;
        if (racine.classList.contains('jum-entree')) {
            requestAnimationFrame(function() { racine.classList.add('jum-entree-go'); racine.classList.remove('jum-entree');
                setTimeout(function() { racine.classList.remove('jum-entree-go'); }, 600); });
        }
    };

    // Revenir sur une page restée en mémoire (bouton retour) : l'écran de choix n'y reste pas figé.
    window.addEventListener('pageshow', function(e) {
        if (!e.persisted || !ecran) return;
        ecran.remove(); ecran = null;
        document.documentElement.classList.remove('jum-choix');
    });
})();
