// ===================== JUMELAGE TRIGONE : Mise en route ⇄ Compte-rendu de mission =====================
// Chargé par les deux applis (index.html à la racine, cr/index.html). À l'ouverture de TRIGONE, un écran de
// choix coupé en diagonale : Mise en route en haut à gauche, Compte-rendu de mission en bas à droite. Toucher
// un côté ouvre cette appli, avec son propre accueil. Toucher le logo d'un accueil ramène à l'écran de choix.
// Au changement d'appli : pas de nouvel écran d'ouverture, et le code à 4 chiffres n'est pas redemandé.
(function() {
    var CLE_BASCULE = 'trigone_bascule', CLE_DEVERROUILLE = 'trigone_deverrouille', CLE_THEME = 'trigone_theme', CLE_CHOIX_FAIT = 'trigone_choix_fait';
    var arrivee = false, fermeurs = [];
    var CARTE_AU_DEMARRAGE = /[?&]espace=carte/.test(location.search);   // raccourci « Ma carte » (appui long sur l'icône)   // fermeurs : [fenêtre ouverte, fonction qui la ferme] (bouton retour)
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

    // ---------- Affichage PC sur tablette et téléphone pliable ouvert ----------
    // Sur un grand écran tactile (tablette, pliable ouvert : au moins 600 px de côté), un bouton « écran » fait passer
    // TRIGONE en affichage PC : l'appli se met en page sur 1 280 px de large (balise viewport), ce qui déclenche la mise
    // en page PC des deux applis (menu à gauche, colonnes…). Mémorisé sur l'appareil ; pliable refermé (petit écran),
    // retour automatique à l'affichage téléphone. Paysage : TRIGONE demande le blocage en paysage (accepté par Chrome
    // pour l'appli installée) ; s'il est refusé (navigateur, iPhone / iPad), un conseil « tournez l'appareil ».
    // Pas de plein écran : en plein écran, Chrome ignore la largeur demandée et l'affichage PC ne s'appliquerait plus.
    var CLE_MODE_PC = 'trigone_affichage_pc', LARGEUR_PC = 1280;
    var metaVue = document.querySelector('meta[name="viewport"]'), vueOrigine = metaVue ? metaVue.getAttribute('content') : '';
    // Écran tactile d'au moins 560 px de côté. Taille lue à la fois sur l'écran (screen) et sur la fenêtre hors affichage PC :
    // selon le navigateur (Chrome, Samsung Internet, appli installée, « version ordinateur »), l'une ou l'autre est fiable.
    function tactile() {
        var mq = function(q) { return !!(window.matchMedia && matchMedia(q).matches); };
        return mq('(pointer: coarse)') || mq('(any-pointer: coarse)') || (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    }
    // Taille « naturelle » de la fenêtre (hors affichage PC), mesurée tant que la largeur n'a pas été forcée ; elle reste
    // valable tant que l'écran ne change pas (pliable ouvert / refermé).
    var naturel = { cote: 0, ecran: '' };
    function cleEcran() { var e = window.screen || {}; return (e.width || 0) + 'x' + (e.height || 0); }
    function mesurerNaturel() {
        if (metaVue && metaVue.getAttribute('content') !== vueOrigine) return;
        naturel = { cote: Math.min(window.innerWidth || 0, window.innerHeight || 0), largeur: window.innerWidth || 0, ecran: cleEcran() };
    }
    function petitCote() {
        var e = window.screen || {}, cote = Math.min(e.width || 0, e.height || 0);
        if (naturel.ecran === cleEcran()) cote = Math.max(cote, naturel.cote);
        return cote;
    }
    function grandTactile() { return tactile() && petitCote() >= 560; }
    // Diagnostic (toucher le numéro de version de l'écran de choix) : ce que le navigateur annonce de l'écran.
    window.JUMELAGE_INFOS_ECRAN = function() {
        var e = window.screen || {};
        return 'Écran : ' + (e.width || '?') + ' × ' + (e.height || '?') + ' · fenêtre : ' + window.innerWidth + ' × ' + window.innerHeight +
            ' · densité : ' + (window.devicePixelRatio || 1) + ' · tactile : ' + (tactile() ? 'oui' : 'non') + ' (' + (navigator.maxTouchPoints || 0) + ' points)' +
            ' · affichage PC possible : ' + (grandTactile() ? 'oui' : 'non') + (modePcVoulu() ? ' (activé)' : '') +
            ' · navigateur : ' + (navigator.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 120);
    };
    function modePcVoulu() { try { return localStorage.getItem(CLE_MODE_PC) === '1'; } catch (e) { return false; } }
    function modePcActif() { return modePcVoulu() && grandTactile(); }
    var SVG_ECRAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8 20.5h8M12 16.5v4"/></svg>';
    var SVG_TEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>';
    var ICONES_DOCK = {
        notice: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 11h6"/></svg>',
        carte: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4.5M14 13.5h3"/></svg>',
        maj: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>'
    };
    function majBoutonsModePc() {
        var actif = modePcActif(), visible = grandTactile();
        Array.prototype.forEach.call(document.querySelectorAll('.JUM-MODE'), function(b) {
            b.style.display = visible ? '' : 'none';
            b.classList.toggle('actif', actif);
            b.innerHTML = actif ? SVG_TEL : SVG_ECRAN;
            b.title = actif ? 'Revenir à l\'affichage téléphone' : 'Affichage PC (tablette, écran pliable ouvert)';
            b.setAttribute('aria-label', b.title);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.JUM-DOCK-PC'), function(b) {
            b.style.display = visible ? '' : 'none';
            b.innerHTML = (actif ? SVG_TEL : SVG_ECRAN) + (actif ? 'Affichage tél.' : 'Affichage PC');
            b.title = actif ? 'Revenir à l\'affichage téléphone' : 'Affichage PC (tablette, écran pliable ouvert)';
        });
        Array.prototype.forEach.call(document.querySelectorAll('.JUM-ONG-PC'), function(b) {
            b.style.display = visible ? '' : 'none';
            b.querySelector('.P0-TAB-ICON').innerHTML = actif ? SVG_TEL : SVG_ECRAN;
            b.querySelector('.P0-LBL-LONG').textContent = actif ? 'Affichage tél.' : 'Affichage PC';
            b.querySelector('.P0-LBL-COURT').textContent = actif ? 'Tél.' : 'PC';
            b.setAttribute('aria-label', actif ? 'Revenir à l\'affichage téléphone' : 'Affichage PC');
        });
    }
    // Applis Mise en route et Compte-rendu (téléphone) : la barre du bas de l'accueil reçoit Ma carte, Notice et
    // Affichage PC (grands écrans tactiles seulement), dans le style de la barre de la page de garde.
    function ongletDock(classe, icone, libelle, court) {
        return '<button type="button" class="P0-TAB ' + classe + '" aria-label="' + libelle + '"><span class="P0-TAB-ICON" aria-hidden="true">' + icone +
            '</span><span class="P0-TAB-LBL"><span class="P0-LBL-LONG">' + libelle + '</span><span class="P0-LBL-COURT">' + court + '</span></span></button>';
    }
    function completerDocksApplis() {
        var docks = document.querySelectorAll('.P0-TAB-BAR .P0-DOCK-INNER'), ajout = false;
        Array.prototype.forEach.call(docks, function(d) {
            if (d.querySelector('.JUM-ONG-CARTE')) return;
            d.classList.add('JUM-DOCK-APPLI'); ajout = true;
            d.insertAdjacentHTML('beforeend', ongletDock('JUM-ONG-CARTE', ICONES_DOCK.carte, 'Ma carte', 'Ma carte') +
                ongletDock('JUM-ONG-NOTICE', ICONES_DOCK.notice, 'Notice', 'Notice') + ongletDock('JUM-ONG-PC', SVG_ECRAN, 'Affichage PC', 'PC'));
            ['pointerdown', 'pointerup'].forEach(function(t) { d.addEventListener(t, function(e) { if (e.target.closest('.JUM-ONG-CARTE, .JUM-ONG-NOTICE, .JUM-ONG-PC')) e.stopPropagation(); }); });
            d.addEventListener('click', function(e) {
                var b = e.target.closest('.JUM-ONG-CARTE, .JUM-ONG-NOTICE, .JUM-ONG-PC'); if (!b) return;
                e.stopPropagation(); fermerMenuCompte();
                if (b.classList.contains('JUM-ONG-CARTE')) window.JUMELAGE_CARTE();
                else if (b.classList.contains('JUM-ONG-NOTICE')) window.JUMELAGE_NOTICE();
                else window.JUMELAGE_MODE_PC();
            });
        });
        document.documentElement.classList.toggle('jum-dock-appli', docks.length > 0);
        if (ajout) { majBoutonsModePc(); if (typeof window.AJUSTER_DOCKS === 'function') requestAnimationFrame(window.AJUSTER_DOCKS); }
    }
    window.JUMELAGE_COMPLETER_DOCKS = completerDocksApplis;
    if (window.MutationObserver) {
        var attenteDock = 0;
        new MutationObserver(function() { if (!attenteDock) attenteDock = requestAnimationFrame(function() { attenteDock = 0; completerDocksApplis(); }); })
            .observe(document.documentElement, { childList: true, subtree: true });
    }
    document.addEventListener('DOMContentLoaded', completerDocksApplis);
    function appliquerVue() {
        var actif = modePcActif();
        if (metaVue) {
            // Zoom imposé (initial et minimum) : toute la largeur tient dans l'écran, même si le navigateur avait gardé
            // un zoom précédent (rechargement, champ de saisie agrandi). Zoom avant toujours possible.
            var zoom = Math.min(1, Math.round(((naturel.ecran === cleEcran() && naturel.largeur) || (window.screen && screen.width) || LARGEUR_PC) / LARGEUR_PC * 1000) / 1000);
            var voulu = actif ? 'width=' + LARGEUR_PC + ', initial-scale=' + zoom + ', minimum-scale=' + zoom + ', viewport-fit=cover' : vueOrigine;
            if (metaVue.getAttribute('content') !== voulu) {
                if (actif && !(window.visualViewport && Math.abs(visualViewport.scale - zoom) < 0.02)) {
                    // Zoom bloqué un instant à la bonne valeur (le navigateur l'applique), puis zoom avant de nouveau permis.
                    metaVue.setAttribute('content', voulu + ', maximum-scale=' + zoom);
                    setTimeout(function() { if (modePcActif()) metaVue.setAttribute('content', voulu); }, 350);
                } else metaVue.setAttribute('content', voulu);
            }
        }
        document.documentElement.classList.toggle('jum-mode-pc', actif);
        majBoutonsModePc();
    }
    mesurerNaturel();
    appliquerVue();
    // Pliable ouvert / refermé, rotation : l'affichage suit. Écran changé en affichage PC : on revient un instant à la
    // largeur d'origine pour mesurer la nouvelle taille réelle, puis on décide.
    var minuteurVue = null;
    window.addEventListener('resize', function() {
        clearTimeout(minuteurVue);
        minuteurVue = setTimeout(function() {
            if (metaVue && naturel.ecran !== cleEcran() && metaVue.getAttribute('content') !== vueOrigine) {
                metaVue.setAttribute('content', vueOrigine);
                setTimeout(function() { mesurerNaturel(); appliquerVue(); }, 200);
                return;
            }
            mesurerNaturel(); appliquerVue();
        }, 150);
    });
    function verrouillerPaysage() {
        return window.screen && screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : Promise.reject(new Error('orientation'));
    }
    function libererOrientation() { try { if (window.screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {} }
    function conseilPaysage() { if (modePcActif() && window.innerHeight > window.innerWidth) bandeau('Affichage PC : tournez l\'appareil en paysage pour plus de confort.'); }
    window.JUMELAGE_MODE_PC_ACTIF = modePcActif;
    window.JUMELAGE_MODE_PC = function(actif) {
        if (typeof actif !== 'boolean') actif = !modePcVoulu();
        try { if (actif) localStorage.setItem(CLE_MODE_PC, '1'); else localStorage.removeItem(CLE_MODE_PC); } catch (e) {}
        if (!actif) libererOrientation();
        appliquerVue();
        if (!actif) { bandeau('Affichage téléphone.'); return; }
        bandeau('Affichage PC : le même bouton ramène l\'affichage téléphone.');
        verrouillerPaysage().catch(function() { setTimeout(conseilPaysage, 3200); });
    };
    // Nouvelle page (changement d'appli) : le blocage en paysage est redemandé.
    if (modePcActif()) verrouillerPaysage().catch(function() {});
    function creerBoutonModePc(classe) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'JUM-MODE ' + (classe || '');
        ['pointerdown', 'pointerup'].forEach(function(t) { b.addEventListener(t, function(e) { e.stopPropagation(); }); });
        b.addEventListener('click', function(e) { e.stopPropagation(); window.JUMELAGE_MODE_PC(); });
        setTimeout(majBoutonsModePc, 0);
        return b;
    }

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
        '.JUM-MAJ { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;' +
            ' background: rgba(15,15,15,0.72); color: #fff; font: 700 0.9rem/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: 0.02em; }' +
        '.JUM-MAJ-ROND { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.25); border-top-color: #d6a756; animation: jum-tourne 0.8s linear infinite; }' +
        '@keyframes jum-tourne { to { transform: rotate(360deg); } }' +
        '.JUM-LOGO-CHOIX { cursor: pointer; -webkit-tap-highlight-color: transparent; }' +
        '.JUM-LOGO-CHOIX:active { transform: scale(0.97); }' +
        /* Écran de choix : deux triangles, coupe de la diagonale haut-droite → bas-gauche */
        '.JUM-CHOIX { position: fixed; inset: 0; z-index: 99985; overflow: hidden; background: #0f0f0f; -webkit-tap-highlight-color: transparent;' +
            ' user-select: none; -webkit-user-select: none; transition: opacity 0.32s ease; }' +
        '.JUM-CHOIX.sortie { opacity: 0; pointer-events: none; transition-delay: 0.1s; }' +
        /* L'écran de choix s'efface : son logo part d'abord, pour ne pas se superposer à celui de l'accueil. */
        '.JUM-CHOIX.sortie .JUM-BLOC, .JUM-CHOIX.sortie .JUM-CHORUS { opacity: 0; transition: opacity 0.1s ease; }' +
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
        /* Écran presque carré (téléphone pliant ouvert, petite tablette) avec le logo Assist Chorus-DT au centre : les deux
           logos s'écartent vers les coins et rapetissent un peu, pour ne jamais passer sous celui du centre. */
        '@media (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) { .JUM-CHOIX.avec-chorus .JUM-PAN-MER .JUM-BLOC { left: 30%; top: 26%; } .JUM-CHOIX.avec-chorus .JUM-PAN-CR .JUM-BLOC { left: 70%; top: 74%; }' +
            ' .JUM-CHOIX.avec-chorus .JUM-PAN-MER img { width: min(30vw, 22vh, 210px); } .JUM-CHOIX.avec-chorus .JUM-PAN-CR img { width: calc(min(30vw, 22vh, 210px) * 1.246); } }' +
        '.JUM-SOUS { font: 800 0.62rem/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: 0.18em; text-transform: uppercase; white-space: nowrap; }' +
        /* PC (grand écran en paysage) : logos 40 % plus grands (Assist Chorus-DT compris), sous-titres à proportion. */
        '@media (orientation: landscape) and (min-width: 1000px) and (min-height: 600px) { .JUM-PAN-MER img { width: min(30.8vw, 53.2vh, 322px); } .JUM-PAN-CR img { width: calc(min(30.8vw, 53.2vh, 322px) * 1.246); }' +
            ' .JUM-SOUS { font-size: 0.82rem; } }' +
        '.JUM-PAN-MER .JUM-SOUS { color: #d6a756; }' +
        /* Médaillon Assistant Chorus DT : au centre, sur la diagonale */
        /* Logo Assist Chorus-DT : comme les deux autres (le logo seul), en plus petit. Posé sur la diagonale, il se met en
           négatif (mix-blend-mode : difference) : noir sur la partie claire, blanc sur la partie sombre, sans couleur ajoutée. */
        '.JUM-CHOIX { --jum-chorus: min(24vw, 17vh, 150px); }' +
        '@media (orientation: landscape) and (min-width: 1000px) and (min-height: 600px) { .JUM-CHOIX { --jum-chorus: min(33.6vw, 23.8vh, 210px); } }' +
        '.JUM-CHORUS { position: absolute; left: 50%; top: 50%; z-index: 3; transform: translate(-50%, -50%); width: var(--jum-chorus); aspect-ratio: 1; border: 0; border-radius: 0; background: none; box-shadow: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; mix-blend-mode: difference; transition: transform 0.2s ease; -webkit-tap-highlight-color: transparent; }' +
        '.JUM-CHORUS img { width: 100%; height: auto; display: block; filter: invert(1); }' +
        '.JUM-CHORUS:hover { transform: translate(-50%, -50%) scale(1.05); } .JUM-CHORUS:focus-visible { outline: 2px solid #d6a756; outline-offset: 6px; }' +
        '.JUM-CHOIX.choix-chorus .JUM-CHORUS { transform: translate(-50%, -50%) scale(1.12); }' +
        /* Au choix, seul le logo choisi reste : les autres s'effacent aussitôt, avant que le panneau ne s'étende
           (sinon le logo choisi glisse par-dessus eux en allant au centre). */
        '.JUM-CHOIX.choix-mer .JUM-PAN-CR .JUM-BLOC, .JUM-CHOIX.choix-cr .JUM-PAN-MER .JUM-BLOC, .JUM-CHOIX.choix-chorus .JUM-BLOC,' +
            ' .JUM-CHOIX.choix-mer .JUM-CHORUS, .JUM-CHOIX.choix-cr .JUM-CHORUS, .JUM-CHOIX.choisi .JUM-CHORUS-NB { opacity: 0; transition: opacity 0.12s ease; pointer-events: none; }' +
        '.JUM-CHORUS-NB { position: absolute; z-index: 4; left: calc(50% + var(--jum-chorus) * 0.36); top: calc(50% - var(--jum-chorus) * 0.5); min-width: 24px; height: 24px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: #b91c1c; color: #fff; font: 800 0.75rem/24px Montserrat, system-ui, sans-serif; text-align: center; box-shadow: 0 4px 10px rgba(185,28,28,0.4); pointer-events: none; }' +
        '.JUM-REGLAGES[data-vue="profil"] [data-vue="roles"], .JUM-REGLAGES[data-vue="profil"] [data-vue="absence"], .JUM-REGLAGES[data-vue="roles"] [data-vue="profil"], .JUM-REGLAGES[data-vue="roles"] [data-vue="absence"],' +
        ' .JUM-REGLAGES[data-vue="absence"] [data-vue="profil"], .JUM-REGLAGES[data-vue="absence"] [data-vue="roles"], .JUM-REGLAGES[data-vue="absence"] .JUM-R-PRINCIPAL { display: none; }' +
        '.JUM-R-CASE { display: flex; align-items: center; gap: 10px; font-size: 0.86rem; cursor: pointer; margin: 4px 0 8px; } .JUM-R-CASE input { width: 18px; height: 18px; flex-shrink: 0; }' +
        '.JUM-CR-FICHIER { display: flex; align-items: center; gap: 10px; padding: 9px 12px; margin: 6px 0; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.82rem; }' +
        '.JUM-CR-FICHIER b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .JUM-CR-FICHIER small { color: #64748b; white-space: nowrap; }' +
        '.JUM-CR-RETIRER { border: 0; background: none; color: #b91c1c; font-size: 0.9rem; cursor: pointer; padding: 2px 4px; }' +
        '.JUM-CR-AJOUT { display: block; text-align: center; margin: 10px 0 0; cursor: pointer; }' +
        '.JUM-S-CODE { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.06em; text-align: center; padding: 16px 8px; margin: 14px 0 4px; border: 2px dashed #9a6f22; border-radius: 14px; background: rgba(214,167,86,0.07); user-select: all; overflow-wrap: anywhere; }' +
        '.JUM-S-OK { display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 0.86rem; margin: 12px 0 4px; cursor: pointer; } .JUM-S-OK input { width: 20px; height: 20px; }' +
        '.JUM-S-LISTE { list-style: none; padding: 0; margin: 14px 0 8px; display: flex; flex-direction: column; gap: 10px; font-size: 0.86rem; line-height: 1.45; }' +
        '.JUM-S-ETAT { margin: 14px 0 10px; padding: 12px; border-radius: 12px; background: rgba(21,128,61,0.08); color: #15803d; font-weight: 700; font-size: 0.84rem; }' +
        '.JUM-S-SAISIE { width: 100%; box-sizing: border-box; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 1.05rem; letter-spacing: 0.05em; text-transform: uppercase; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 12px; margin-top: 6px; }' +
        'html body.dark-mode .JUM-S-CODE { border-color: #e0b86a; background: rgba(169,195,214,0.08); } html body.dark-mode .JUM-S-ETAT { color: #4ade80; background: rgba(74,222,128,0.1); } html body.dark-mode .JUM-S-SAISIE { background: #1f1f1f; color: #ececec; border-color: #4a4a4a; }' +
        '.JUM-ERR { border: 1px solid #e2e8f0; border-left: 4px solid #b45309; border-radius: 12px; padding: 10px 12px; margin: 10px 0; font-size: 0.82rem; display: flex; flex-direction: column; gap: 4px; }' +
        '.JUM-ERR-MSG { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.76rem; overflow-wrap: anywhere; } .JUM-ERR small { color: #64748b; }' +
        '.JUM-ERR pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.7rem; background: rgba(214,167,86,0.08); padding: 8px; border-radius: 8px; margin: 6px 0 0; }' +
        '.JUM-ERR summary { cursor: pointer; font-size: 0.74rem; color: #9a6f22; } .JUM-ERR-BTN { display: flex; gap: 8px; margin-top: 4px; } .JUM-ERR-BTN button { flex: 1; padding: 8px; }' +
        'html body.dark-mode .JUM-ERR { border-color: rgba(255,255,255,0.1); border-left-color: #f59e0b; } html body.dark-mode .JUM-ERR small { color: #a3a3a3; }' +
        '.JUM-CR-SCAN { display: block; font-style: normal; font-weight: 500; font-size: 0.72rem; color: #15803d; } .JUM-CR-ORIGINE { background: none; border: 0; padding: 0; font: inherit; color: #9a6f22; text-decoration: underline; cursor: pointer; }' +
        'html body.dark-mode .JUM-CR-SCAN { color: #4ade80; } html body.dark-mode .JUM-CR-ORIGINE { color: #e0b86a; }' +
        'html body.dark-mode .JUM-CR-FICHIER { border-color: rgba(255,255,255,0.1); } html body.dark-mode .JUM-CR-FICHIER small { color: #a3a3a3; }' +
        '.JUM-BONJOUR { margin: 0 0 4px; text-align: center; font: 600 clamp(0.74rem, 3.5vw, 0.9rem)/1.3 Montserrat, system-ui, sans-serif; color: #9a6f22; letter-spacing: 0.01em; }' +
        '@media (max-height: 600px) and (orientation: portrait) { .JUM-BONJOUR { display: none; } }' +
        '.JUM-BONJOUR b { color: #1a1a1a; font-weight: 800; white-space: nowrap; } body.dark-mode .JUM-BONJOUR { color: #e0b86a; } body.dark-mode .JUM-BONJOUR b { color: #f5f5f5; }' +
        '.JUM-R-ACTIF { font-style: normal; font-size: 0.72rem; font-weight: 800; color: #15803d; background: rgba(21,128,61,0.1); border-radius: 999px; padding: 2px 8px; margin-left: 4px; white-space: nowrap; }' +
        '.JUM-BOITE-PASTILLE { display: inline-block; margin-top: 12px; padding: 6px 13px; border-radius: 999px; background: #b91c1c; color: #fff; font: 800 0.72rem Montserrat, system-ui, sans-serif; letter-spacing: 0.02em; box-shadow: 0 4px 12px rgba(185,28,28,0.3); animation: jum-pulse 2s ease-in-out infinite; }' +
        '@keyframes jum-pulse { 50% { transform: scale(1.06); } }' +
        '.JUM-PAN-CR .JUM-SOUS { color: #d6a756; }' +
        /* Roue crantée (réglages) sur l'écran de choix, en bas à droite */
        '.JUM-ROUE { position: absolute; right: max(18px, env(safe-area-inset-right, 0px)); bottom: max(18px, env(safe-area-inset-bottom, 0px)); z-index: 3; width: 52px; height: 52px;' +
            ' border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.35); background: rgba(255,255,255,0.08); color: #f5f5f5; display: flex; align-items: center; justify-content: center; cursor: pointer; }' +
        '.JUM-ROUE svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.4s ease; }' +
        '.JUM-ROUE:hover svg, .JUM-ROUE:active svg { transform: rotate(60deg); }' +
        '.JUM-CHOIX.choisi .JUM-ROUE { opacity: 0; pointer-events: none; }' +
        '.JUM-MAJ-BTN { right: auto; left: max(18px, env(safe-area-inset-left, 0px)); border-color: rgba(255,255,255,0.18); background: #1a1a1a; color: #f5f5f5; box-shadow: 0 4px 14px rgba(0,0,0,0.25); }' +
        '.JUM-MAJ-BTN.tourne svg { animation: jum-tourne 0.9s linear infinite; } @keyframes jum-tourne { to { transform: rotate(360deg); } }' +
        '.JUM-CHOIX.choisi .JUM-MAJ-BTN { opacity: 0; pointer-events: none; }' +
        /* Notifications de cet appareil (en haut à gauche) : actives, ou coupées (bien visible, en orange). */
        '.JUM-CLOCHE { position: absolute; top: max(14px, env(safe-area-inset-top, 0px)); left: max(16px, env(safe-area-inset-left, 0px)); z-index: 3; display: flex; align-items: center; gap: 7px; padding: 7px 13px 7px 10px; border-radius: 999px;' +
            ' border: 1.5px solid rgba(26,26,26,0.15); background: #1a1a1a; color: #f5f5f5; font: 800 0.7rem/1 Montserrat, system-ui, sans-serif; letter-spacing: 0.02em; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.18); }' +
        '.JUM-CLOCHE svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-CLOCHE.muet { background: #d97706; border-color: #b45309; color: #fff; animation: jum-pulse 2.4s ease-in-out infinite; }' +
        '.JUM-CHOIX.choisi .JUM-CLOCHE { opacity: 0; pointer-events: none; }' +
        /* Mon compte : bouton en haut à droite (« Se connecter », ou pastille du compte), menu déroulant, fenêtre de connexion. */
        '.JUM-CPT { display: inline-flex; align-items: center; gap: 8px; max-width: min(62vw, 300px); padding: 5px 13px 5px 5px; border-radius: 999px; border: 1.5px solid rgba(255,255,255,0.16);' +
            ' background: #1a1a1a; color: #f5f5f5; font: 800 0.72rem/1 Montserrat, system-ui, sans-serif; letter-spacing: 0.02em; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.22); -webkit-tap-highlight-color: transparent; }' +
        '.JUM-CPT:hover { background: #262626; } .JUM-CPT:focus-visible { outline: 3px solid #d6a756; outline-offset: 2px; }' +
        '.JUM-CPT.deconnecte { padding: 8px 15px 8px 11px; background: #fff; color: #1a1a1a; border-color: rgba(26,26,26,0.14); box-shadow: 0 4px 14px rgba(0,0,0,0.14); }' +
        '.JUM-CPT.deconnecte:hover { background: #f1f5f9; }' +
        '.JUM-CPT > svg { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-AV { width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #9a6f22; color: #fff; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; }' +
        '.JUM-CPT-NOM { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
        '.JUM-CPT-PT { width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; background: #94a3b8; box-shadow: 0 0 0 2px #1a1a1a; }' +
        '.JUM-CPT-PT.ok { background: #22c55e; } .JUM-CPT-PT.muet { background: #f59e0b; } .JUM-CPT-PT.off { background: #ef4444; }' +
        /* Montre connectée : voyant vert (notifications actives sur ce téléphone) ou rouge */
        '.JUM-MONTRE-PT { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-left: -7px; vertical-align: top; box-shadow: 0 0 0 2px #fff; background: #ef4444; } .JUM-MONTRE-PT.ok { background: #22c55e; }' +
        '.JUM-MONTRE .JUM-SIG-CARTE { padding-top: 22px; text-align: left; } .JUM-MONTRE-TETE { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }' +
        '.JUM-MONTRE-TETE svg { width: 40px; height: 40px; flex-shrink: 0; stroke: #b0802a; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-MONTRE-ETAT { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 0.82rem; font-weight: 700; margin: 0 0 12px; background: rgba(239,68,68,0.1); color: #b91c1c; }' +
        '.JUM-MONTRE-ETAT.ok { background: rgba(34,197,94,0.12); color: #15803d; } .JUM-MONTRE-ETAT i { width: 10px; height: 10px; border-radius: 50%; background: currentColor; flex-shrink: 0; }' +
        '.JUM-MONTRE ol { margin: 0 0 12px; padding-left: 18px; font-size: 0.8rem; line-height: 1.5; color: #444; } .JUM-MONTRE-MSG { font-size: 0.78rem; color: #8a5f12; min-height: 1em; margin: 0 0 10px; }' +
        'html body.dark-mode .JUM-MONTRE ol { color: #c4c4c4; } html body.dark-mode .JUM-MONTRE-PT { box-shadow: 0 0 0 2px #1f1f1f; }' +
        '.JUM-CARTE-ACCES { position: absolute; z-index: 3; top: max(14px, env(safe-area-inset-top, 0px)); right: 190px; height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 14px 0 10px; border-radius: 999px; cursor: pointer;' +
            ' border: 1.5px solid #d6a756; background: linear-gradient(135deg, #2b2620, #121212); color: #f5f5f5; font: 800 0.72rem Montserrat, system-ui, sans-serif; letter-spacing: 0.06em; box-shadow: 0 4px 14px rgba(0,0,0,0.25); }' +
        '.JUM-CARTE-ACCES i { width: 24px; height: 16px; border-radius: 3px; background: linear-gradient(135deg, #f1d08a, #b8862e); position: relative; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.25); }' +
        '.JUM-CARTE-ACCES i::after { content: ""; position: absolute; left: 3px; top: 4px; width: 7px; height: 6px; border-radius: 1.5px; background: #1a1a1a; opacity: 0.55; }' +
        '.JUM-CHOIX.choisi .JUM-CARTE-ACCES { opacity: 0; pointer-events: none; }' +
        '.JUM-RETOUR-PARAM { position: fixed; z-index: 2; top: max(12px, env(safe-area-inset-top, 0px)); left: max(12px, env(safe-area-inset-left, 0px)); height: 38px; display: inline-flex; align-items: center; gap: 4px; padding: 0 14px 0 8px; border-radius: 999px; border: 1.5px solid rgba(26,26,26,0.12); background: #fff; color: #1a1a1a; font: 800 0.78rem Montserrat, system-ui, sans-serif; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.22); }' +
        '.JUM-RETOUR-PARAM svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }' +
        // Fenêtre ouverte depuis Paramètres : descendue sous la flèche « ‹ Paramètres ».
        '.avec-retour { padding-top: calc(max(12px, env(safe-area-inset-top, 0px)) + 50px) !important; }' +
                '.JUM-RETOUR-PARAM.dans-carte { position: relative; top: auto; left: auto; z-index: 3; flex-shrink: 0; align-self: flex-start; height: 32px; margin: 10px 0 4px 12px; padding: 0 12px 0 6px; font-size: 0.74rem; box-shadow: none; background: #f4f1ea; border-color: rgba(26,26,26,0.10); }' +
        'html body.dark-mode .JUM-RETOUR-PARAM.dans-carte { background: #2e2e2e; }' +
                '.JUM-RETOUR-PARAM.flottant { z-index: 99990; top: auto; left: 50%; transform: translateX(-50%); bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + 8px); background: #1a1a1a; color: #f5f5f5; border-color: #d6a756; }' +
                'html body.dark-mode .JUM-RETOUR-PARAM { background: #262626; color: #f5f5f5; border-color: rgba(255,255,255,0.16); }' +
        // Notice TRIGONE (livre en cuir) et Paramètres (roue) : à côté de « Ma carte », sur l'écran d'accueil et dans les applis.
        '.JUM-NOTICE-ACCES, .JUM-PARAM-ACCES { position: absolute; z-index: 3; height: 38px; display: flex; align-items: center; gap: 7px; padding: 0 13px 0 10px; border-radius: 999px; cursor: pointer; font: 800 0.72rem Montserrat, system-ui, sans-serif; letter-spacing: 0.06em; box-shadow: 0 4px 14px rgba(0,0,0,0.25); }' +
        '.JUM-NOTICE-ACCES { border: 1.5px solid #d6a756; background: radial-gradient(120% 140% at 25% 0%, #74482a, #4a2c17 60%, #321c0e); color: #f1dcae; }' +
        '.JUM-NOTICE-ACCES svg, .JUM-PARAM-ACCES svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }' +
        '.JUM-NOTICE-ACCES svg { color: #e2b866; }' +
        '.JUM-PARAM-ACCES { width: 38px; padding: 0; justify-content: center; border: 1.5px solid rgba(26,26,26,0.14); background: #fff; color: #1a1a1a; }' +
        'html body.dark-mode .JUM-PARAM-ACCES, .JUM-V2 .JUM-PARAM-ACCES { background: #1a1a1a; color: #f5f5f5; border-color: rgba(255,255,255,0.18); }' +
        '.JUM-CHOIX.choisi .JUM-NOTICE-ACCES, .JUM-CHOIX.choisi .JUM-PARAM-ACCES { opacity: 0; pointer-events: none; }' +
        '.JUM-CPT-ZONE .JUM-NOTICE-ACCES { position: static; padding: 0 10px; } .JUM-CPT-ZONE .JUM-NOTICE-ACCES span { display: none; }' +
        '@media (max-width: 520px) { .JUM-NOTICE-ACCES span { display: none; } .JUM-NOTICE-ACCES { padding: 0 10px; } }' +
        '.JUM-CPT-ZONE .JUM-CARTE-ACCES { position: static; height: 38px; padding: 0 9px; } .JUM-CPT-ZONE .JUM-CARTE-ACCES span { display: none; }' +
        '@media (max-width: 520px) { .JUM-CARTE-ACCES span { display: none; } .JUM-CARTE-ACCES { padding: 0 10px; } }' +
        '.JUM-CHOIX > .JUM-CPT { position: absolute; top: max(14px, env(safe-area-inset-top, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); z-index: 3; }' +
        '.JUM-CHOIX.choisi > .JUM-CPT { opacity: 0; pointer-events: none; }' +
        /* Dans les applis (page d'accueil) : sur téléphone, pastille compacte en haut à gauche (le haut à droite porte le mode sombre
           et les raccourcis) ; sur PC, pastille complète en haut à droite. Masquée sous l'écran de choix et pendant la démonstration. */
        '.JUM-CPT-ZONE { position: fixed; top: calc(8px + env(safe-area-inset-top, 0px)); left: calc(8px + env(safe-area-inset-left, 0px)); z-index: 900; display: flex; align-items: center; gap: 8px; }' +
        '.JUM-CPT-APPLI { padding: 3px; gap: 0; position: relative; }' +
        '.JUM-CPT-APPLI .JUM-CPT-NOM { display: none; } .JUM-CPT-APPLI.deconnecte { padding: 7px 12px 7px 9px; gap: 6px; } .JUM-CPT-APPLI.deconnecte .JUM-CPT-NOM { display: inline; }' +
        '.JUM-CPT-APPLI .JUM-CPT-PT { position: absolute; right: 1px; bottom: 1px; }' +
        '@media (min-width: 1100px) { .JUM-CPT-ZONE { display: none !important; } }' +
        '.PC-COMPTE-SLOT { display: flex; align-items: center; gap: 8px; margin: 2px 0 10px; } .PC-COMPTE-SLOT .JUM-CPT { flex: 1; max-width: none; min-width: 0; }' +
        '.JUM-CPT-RUB { padding: 6px 12px 2px; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; }' +
        'html.jum-choix .JUM-CPT-ZONE, body.demo-active .JUM-CPT-ZONE { display: none !important; }' +
        /* Bouton « affichage PC » (tablettes, pliables ouverts) */
        '.JUM-MODE { width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid rgba(26,26,26,0.14); background: #fff; color: #1a1a1a; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.14); padding: 0; }' +
        '.JUM-MODE svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-MODE.actif { border-color: #d6a756; color: #a87a2a; }' +
        'html body.dark-mode .JUM-MODE { background: #262626; color: #f5f5f5; border-color: rgba(255,255,255,0.14); } html body.dark-mode .JUM-MODE.actif { color: #e0b86a; border-color: #d6a756; }' +
        '.JUM-CHOIX > .JUM-MODE { position: absolute; z-index: 3; bottom: calc(max(18px, env(safe-area-inset-bottom, 0px)) + 5px); left: calc(max(18px, env(safe-area-inset-left, 0px)) + 66px); width: 42px; height: 42px; background: #1a1a1a; color: #f5f5f5; border-color: rgba(255,255,255,0.18); }' +
        '.JUM-CHOIX.choisi > .JUM-MODE { opacity: 0; pointer-events: none; }' +
        /* Compte-rendu, téléphone : la médaille de l'accueil se décale pour laisser la place au bouton de compte. */
        '.JUM-CPT-MENU { position: fixed; z-index: 99988; width: min(320px, calc(100vw - 24px)); background: #fff; color: #1a1a1a; border-radius: 18px; padding: 6px; box-shadow: 0 18px 44px rgba(0,0,0,0.4);' +
            ' font-family: Montserrat, system-ui, sans-serif; animation: jum-menu 0.18s ease both; max-height: calc(100vh - 90px); overflow-y: auto; }' +
        '.JUM-CPT-TETE { display: flex; gap: 12px; align-items: center; padding: 12px 12px 10px; }' +
        '.JUM-CPT-TETE .JUM-AV { width: 44px; height: 44px; font-size: 0.95rem; }' +
        '.JUM-AV.photo { overflow: hidden; background: #1a1a1a; box-shadow: 0 0 0 2px #d6a756; } .JUM-AV.photo img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 28%; display: block; }' +
        '.JUM-CPT-TETE b { display: block; font-size: 0.9rem; } .JUM-CPT-TETE small { display: block; font-size: 0.72rem; color: #64748b; margin-top: 2px; word-break: break-all; }' +
        '.JUM-CPT-ROLES { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 12px 10px; }' +
        '.JUM-CPT-ROLES span { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.05em; padding: 4px 8px; border-radius: 999px; background: #eef2f6; color: #9a6f22; }' +
        '.JUM-CPT-ROLES span.or { background: #fbf4e6; color: #a87a2a; }' +
        '.JUM-CPT-MENU button { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; background: none; padding: 10px 12px; border-radius: 12px; text-align: left; cursor: pointer; color: #1a1a1a; font-family: inherit; }' +
        '.JUM-CPT-MENU button:hover { background: #f1f5f9; }' +
        '.JUM-CPT-MENU button svg { width: 22px; height: 22px; flex-shrink: 0; fill: none; stroke: #9a6f22; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-CPT-MENU button b { display: block; font-size: 0.82rem; } .JUM-CPT-MENU button small { display: block; font-size: 0.68rem; color: #64748b; margin-top: 2px; }' +
        '.JUM-CPT-MENU .JUM-CPT-DANGER svg { stroke: #b91c1c; } .JUM-CPT-MENU .JUM-CPT-DANGER b { color: #b91c1c; } .JUM-CPT-MENU .JUM-CPT-DANGER:hover { background: #fef2f2; }' +
        '.JUM-CPT-SEP { height: 1px; background: #e2e8f0; margin: 4px 10px; }' +
        /* Page Paramètres : rubriques à gauche (PC) ou en onglets (téléphone), lignes d'action à droite. */
        '.JUM-PARAM { position: fixed; inset: 0; z-index: 99989; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15,23,42,0.55); font-family: Montserrat, system-ui, sans-serif; animation: jum-menu 0.18s ease both; }' +
        '.JUM-PARAM-CARTE { width: min(860px, 100%); height: min(640px, calc(100vh - 40px)); display: flex; flex-direction: column; background: #fff; color: #1a1a1a; border-radius: 20px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); overflow: hidden; }' +
        '.JUM-PARAM-TETE { display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-bottom: 1px solid #e2e8f0; }' +
        '.JUM-PARAM-TETE h2 { margin: 0; flex: 1; font-size: 1.15rem; letter-spacing: 0.02em; }' +
        '.JUM-PARAM-TETE .JUM-AV { width: 36px; height: 36px; font-size: 0.8rem; }' +
        '.JUM-PARAM-FERMER { width: 34px; height: 34px; border: 0; border-radius: 10px; background: #f1f5f9; color: #475569; font: 700 1rem inherit; cursor: pointer; }' +
        '.JUM-PARAM-CORPS { flex: 1; display: flex; min-height: 0; }' +
        '.JUM-PARAM-NAV { width: 210px; flex-shrink: 0; padding: 12px; border-right: 1px solid #e2e8f0; background: #f8fafc; overflow-y: auto; }' +
        '.JUM-PARAM-NAV button { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: none; padding: 11px 12px; border-radius: 12px; cursor: pointer; color: #334155; font: 700 0.8rem Montserrat, system-ui, sans-serif; text-align: left; }' +
        '.JUM-PARAM-NAV button svg, .JUM-PARAM-LIGNE svg { width: 20px; height: 20px; flex-shrink: 0; fill: none; stroke: #9a6f22; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PARAM-NAV button:hover { background: #eef2f6; } .JUM-PARAM-NAV button.actif { background: #1a1a1a; color: #fff; } .JUM-PARAM-NAV button.actif svg { stroke: #fff; }' +
        '.JUM-PARAM-CONTENU { flex: 1; padding: 20px 24px; overflow-y: auto; }' +
        '.JUM-PARAM-CONTENU h3 { margin: 0 0 4px; font-size: 1rem; } .JUM-PARAM-CONTENU > p { margin: 0 0 14px; font-size: 0.76rem; color: #64748b; line-height: 1.45; }' +
        '.JUM-PARAM-LIGNE { display: flex; align-items: center; gap: 14px; width: 100%; border: 1px solid #e2e8f0; background: #fff; padding: 13px 14px; margin-bottom: 8px; border-radius: 14px; cursor: pointer; text-align: left; color: #1a1a1a; font-family: inherit; }' +
        '.JUM-PARAM-LIGNE:hover { background: #f8fafc; border-color: #cbd5e1; }' +
        '.JUM-PARAM-LIGNE span { flex: 1; } .JUM-PARAM-LIGNE b { display: block; font-size: 0.84rem; } .JUM-PARAM-LIGNE small { display: block; font-size: 0.7rem; color: #64748b; margin-top: 2px; }' +
        '.JUM-PARAM-LIGNE i { font-style: normal; font-size: 1.3rem; color: #94a3b8; }' +
        '.JUM-PARAM-LIGNE.danger b { color: #b91c1c; } .JUM-PARAM-LIGNE.danger svg { stroke: #b91c1c; } .JUM-PARAM-LIGNE.danger:hover { background: #fef2f2; border-color: #fecaca; }' +
        '.JUM-PARAM-VIDE { font-size: 0.8rem; color: #64748b; padding: 12px 0; }' +
        '@media (max-width: 700px) { .JUM-PARAM { padding: 0; } .JUM-PARAM-CARTE { height: 100%; width: 100%; border-radius: 0; } .JUM-PARAM-CORPS { flex-direction: column; }' +
            ' .JUM-PARAM-NAV { width: auto; display: flex; gap: 6px; padding: 10px 12px; border-right: 0; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; overflow: visible; }' +
            ' .JUM-PARAM-NAV button { width: auto; flex-shrink: 0; padding: 9px 12px; border-radius: 999px; background: #eef2f6; } .JUM-PARAM-NAV button svg { display: none; } .JUM-PARAM-CONTENU { padding: 16px; } }' +
        'html body.dark-mode .JUM-PARAM-CARTE { background: #1f1f1f; color: #ececec; } html body.dark-mode .JUM-PARAM-TETE, html body.dark-mode .JUM-PARAM-NAV { border-color: #333; }' +
        'html body.dark-mode .JUM-PARAM-NAV { background: #181818; } html body.dark-mode .JUM-PARAM-NAV button { color: #d4d4d4; } html body.dark-mode .JUM-PARAM-NAV button:hover { background: #2a2a2a; }' +
        'html body.dark-mode .JUM-PARAM-NAV button.actif { background: #f5f5f5; color: #1a1a1a; } html body.dark-mode .JUM-PARAM-NAV button.actif svg { stroke: #1a1a1a; }' +
        'html body.dark-mode .JUM-PARAM-LIGNE { background: #242424; border-color: #333; color: #ececec; } html body.dark-mode .JUM-PARAM-LIGNE:hover { background: #2c2c2c; }' +
        'html body.dark-mode .JUM-PARAM-FERMER { background: #2a2a2a; color: #d4d4d4; } html body.dark-mode .JUM-PARAM-LIGNE small, html body.dark-mode .JUM-PARAM-CONTENU > p { color: #a3a3a3; }' +
        '@media (max-width: 700px) { html body.dark-mode .JUM-PARAM-NAV button { background: #2a2a2a; } html body.dark-mode .JUM-PARAM-NAV button.actif { background: #f5f5f5; } }' +
        'html body.dark-mode .JUM-CPT-MENU, .JUM-CHOIX ~ .JUM-CPT-MENU.sombre { background: #1f1f1f; color: #ececec; }' +
        'html body.dark-mode .JUM-CPT-MENU button { color: #ececec; } html body.dark-mode .JUM-CPT-MENU button:hover { background: #2a2a2a; }' +
        'html body.dark-mode .JUM-CPT-MENU button small, html body.dark-mode .JUM-CPT-TETE small { color: #a3a3a3; } html body.dark-mode .JUM-CPT-SEP { background: #333; }' +
        'html body.dark-mode .JUM-CPT-ROLES span { background: #2a2f35; color: #e0b86a; } html body.dark-mode .JUM-CPT-ROLES span.or { background: #3a2f1c; color: #e0b86a; }' +
        'html body.dark-mode .JUM-CPT.deconnecte { background: #262626; color: #f5f5f5; border-color: rgba(255,255,255,0.14); }' +
        /* Fenêtre « Se connecter » : deux onglets */
        '.JUM-CX-ONGLETS { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; margin: 14px 0 6px; border-radius: 14px; background: #eef2f6; }' +
        '.JUM-CX-ONGLETS button { border: 0; border-radius: 11px; padding: 10px 8px; background: none; color: #9a6f22; font: 800 0.72rem/1.25 Montserrat, system-ui, sans-serif; cursor: pointer; }' +
        '.JUM-CX-ONGLETS button.actif { background: #fff; color: #1a1a1a; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }' +
        'html body.dark-mode .JUM-CX-ONGLETS { background: #262626; } html body.dark-mode .JUM-CX-ONGLETS button.actif { background: #3a3a3a; color: #f5f5f5; }' +
        '.JUM-CX-SANS { display: block; margin: 14px auto 0; border: 0; background: none; color: #9a6f22; font: 700 0.74rem Montserrat, system-ui, sans-serif; text-decoration: underline; cursor: pointer; }' +
        /* Accueil de première ouverture et « Se connecter » : téléphone (accueil puis formulaire), PC (écran partagé) */
        '.JUM-REGLAGES.JUM-ACC { display: block; padding: 0; background: #0c0c0c; overflow-y: auto; -webkit-overflow-scrolling: touch; color: #1a1a1a; animation: jum-menu 0.25s ease both; }' +
        '.JUM-ACC-PAGE { position: relative; min-height: 100%; display: flex; flex-direction: column; }' +
        '.JUM-ACC-MARQUE { position: relative; overflow: hidden; box-sizing: border-box; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; text-align: center; color: #f5f5f5;' +
            ' padding: calc(env(safe-area-inset-top, 0px) + 64px) 24px calc(env(safe-area-inset-bottom, 0px) + 24px); background: radial-gradient(90% 60% at 50% 22%, #2b2b2b 0%, #151515 55%, #0c0c0c 100%); }' +
        '.JUM-ACC-MARQUE::before, .JUM-ACC-TETE::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.5; background: linear-gradient(118deg, transparent 84%, rgba(214,167,86,0.85) 84% 84.3%, transparent 84.3%); }' +
        '.JUM-ACC-HALO { position: absolute; width: 420px; height: 420px; left: 50%; top: -60px; transform: translateX(-50%); border-radius: 50%; pointer-events: none; background: radial-gradient(circle, rgba(214,167,86,0.16), transparent 65%); }' +
        '.JUM-ACC-LOGO { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; }' +
        '.JUM-ACC-LOGO img { width: 92px; height: auto; filter: invert(1) brightness(1.15); }' +
        '.JUM-ACC-MOT { font-size: 2.4rem; font-weight: 800; letter-spacing: 0.2em; padding-left: 0.2em; }' +
        '.JUM-ACC-SOUS { position: relative; margin-top: 12px; color: #d6a756; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; }' +
        '.JUM-ACC-MARQUE h1 { display: none; }' +
        '.JUM-ACC-TXT { position: relative; margin: 16px auto 0; max-width: 340px; font-size: 0.95rem; line-height: 1.55; color: #c9c9c9; }' +
        '.JUM-ACC-PTS { position: relative; display: grid; gap: 10px; margin: 30px auto 0; width: 100%; max-width: 400px; text-align: left; }' +
        '.JUM-ACC-PT { display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-radius: 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); }' +
        '.JUM-ACC-PT svg { flex-shrink: 0; width: 22px; height: 22px; fill: none; stroke: #d6a756; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-ACC-PT b { display: block; font-size: 0.88rem; } .JUM-ACC-PT span { display: none; font-size: 0.78rem; color: #a8a8a8; margin-top: 2px; }' +
        '.JUM-ACC-BOUTONS { position: relative; margin: auto auto 0; padding-top: 30px; width: 100%; max-width: 400px; }' +
        '.JUM-ACC-BTN { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 54px; box-sizing: border-box; border-radius: 16px; border: 0; cursor: pointer;' +
            ' font: 800 0.88rem Montserrat, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }' +
        '.JUM-ACC-BTN.or { background: linear-gradient(180deg, #e2b866, #c99743); color: #1a1a1a; box-shadow: 0 12px 30px rgba(214,167,86,0.25); }' +
        '.JUM-ACC-BTN.ligne { margin-top: 12px; background: transparent; color: #f5f5f5; border: 1.5px solid rgba(255,255,255,0.28); }' +
        '.JUM-ACC-BTN.noir { background: #1a1a1a; color: #fff; } .JUM-ACC-BTN:disabled { opacity: 0.55; cursor: default; }' +
        '.JUM-ACC-LIEN { display: block; margin: 18px auto 0; border: 0; background: none; color: #e0b86a; font: 700 0.86rem Montserrat, system-ui, sans-serif; cursor: pointer; }' +
        '.JUM-ACC-NOTE { margin-top: 12px; font-size: 0.72rem; color: #8a8a8a; }' +
        '.JUM-ACC-BAS { display: none; }' +
        '.JUM-ACC-FERMER { position: absolute; z-index: 3; top: calc(env(safe-area-inset-top, 0px) + 14px); right: 14px; border: 1px solid rgba(255,255,255,0.22); border-radius: 20px; padding: 8px 14px;' +
            ' background: rgba(255,255,255,0.08); color: #e5e5e5; font: 700 0.76rem Montserrat, system-ui, sans-serif; cursor: pointer; }' +
        '.JUM-ACC-FORM { display: none; position: relative; min-height: 100vh; min-height: 100dvh; background: #f6f8fa; padding-bottom: 24px; box-sizing: border-box; }' +
        '.JUM-ACC[data-etape="form"] .JUM-ACC-MARQUE { display: none; } .JUM-ACC[data-etape="form"] .JUM-ACC-FORM { display: block; }' +
        '.JUM-ACC-TETE { position: relative; overflow: hidden; height: 230px; padding-top: calc(env(safe-area-inset-top, 0px) + 30px); box-sizing: border-box; text-align: center; color: #f5f5f5;' +
            ' background: radial-gradient(90% 90% at 50% 10%, #2b2b2b 0%, #151515 60%, #0c0c0c 100%); border-radius: 0 0 34px 34px; }' +
        '.JUM-ACC-TETE img { width: 54px; filter: invert(1) brightness(1.15); } .JUM-ACC-TETE div { margin-top: 8px; font-size: 1.35rem; font-weight: 800; letter-spacing: 0.2em; padding-left: 0.2em; }' +
        '.JUM-ACC-RETOUR { position: absolute; z-index: 3; top: calc(env(safe-area-inset-top, 0px) + 14px); left: 14px; width: 40px; height: 40px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.1); color: #f5f5f5; cursor: pointer; display: flex; align-items: center; justify-content: center; }' +
        '.JUM-ACC-RETOUR svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-ACC-CARTE { position: relative; box-sizing: border-box; width: calc(100% - 32px); max-width: 470px; margin: -80px auto 0; padding: 24px 22px 22px; background: #fff; border-radius: 26px; box-shadow: 0 22px 54px rgba(26,40,52,0.12); }' +
        '.JUM-ACC-ONGLETS { display: flex; padding: 4px; margin-bottom: 22px; border-radius: 14px; background: #eef2f6; }' +
        '.JUM-ACC-ONGLETS button { flex: 1; border: 0; border-radius: 11px; padding: 11px 4px; background: none; color: #64748b; font: 700 0.84rem Montserrat, system-ui, sans-serif; cursor: pointer; }' +
        '.JUM-ACC-ONGLETS button.actif { background: #1a1a1a; color: #fff; }' +
        '.JUM-ACC-CARTE h2 { margin: 0; font-size: 1.55rem; font-weight: 800; color: #1a1a1a; }' +
        '.JUM-ACC-AIDE { margin: 6px 0 20px; font-size: 0.84rem; line-height: 1.5; color: #64748b; }' +
        '.JUM-ACC-LBL { display: block; margin-bottom: 8px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #3b4651; }' +
        '.JUM-ACC-CHAMP { position: relative; } .JUM-ACC-CHAMP svg { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; fill: none; stroke: #9a6f22; stroke-width: 2; pointer-events: none; }' +
        '.JUM-ACC-CHAMP input { width: 100%; height: 54px; box-sizing: border-box; padding: 0 14px 0 46px; border: 2px solid #d7dee6; border-radius: 14px; background: #fff; color: #1a1a1a; font: 500 16px Montserrat, system-ui, sans-serif; }' +
        '.JUM-ACC-CHAMP input:focus { outline: none; border-color: #1a1a1a; }' +
        '.JUM-ACC-CARTE #JUM-C-ENVOI { margin-top: 14px; }' +
        '.JUM-ACC-CODE { position: relative; display: flex; gap: 8px; margin-top: 4px; }' +
        '.JUM-ACC-CODE span { flex: 1; height: 58px; display: flex; align-items: center; justify-content: center; border-radius: 14px; border: 2px solid #d7dee6; font-size: 1.5rem; font-weight: 800; color: #1a1a1a; background: #fff; }' +
        '.JUM-ACC-CODE span.plein { border-color: #1a1a1a; } .JUM-ACC-CODE span.curseur { border-color: #d6a756; box-shadow: 0 0 0 4px rgba(214,167,86,0.2); }' +
        '.JUM-ACC-CODE input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; border: 0; font-size: 16px; color: transparent; background: transparent; caret-color: transparent; cursor: text; }' +
        '.JUM-ACC-ETAPE2 { margin-top: 18px; } .JUM-ACC-ETAPE2 .JUM-ACC-BTN { margin-top: 18px; }' +
        '.JUM-ACC-RENVOI-SLOT { text-align: right; } .JUM-ACC-CARTE #JUM-C-ENVOI.renvoi { display: inline; width: auto; min-height: 0; margin: 10px 0 0; padding: 0; background: none; box-shadow: none; color: #9a6f22; font-size: 0.8rem; letter-spacing: 0; text-transform: none; }' +
        '.JUM-ACC-CARTE .JUM-R-ERREUR { margin-top: 10px; }' +
        '.JUM-ACC-OU { display: flex; align-items: center; gap: 12px; margin: 20px 0 14px; font-size: 0.74rem; color: #94a3b8; } .JUM-ACC-OU::before, .JUM-ACC-OU::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; }' +
        '.JUM-ACC-AUTRE { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 50px; border: 1.5px solid #d6dde4; border-radius: 14px; background: #fff; color: #1a1a1a; font: 700 0.84rem Montserrat, system-ui, sans-serif; cursor: pointer; }' +
        '.JUM-ACC-AUTRE svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; }' +
        '.JUM-ACC-SECU { display: flex; gap: 10px; margin-top: 18px; font-size: 0.74rem; line-height: 1.5; color: #64748b; }' +
        '.JUM-ACC-SECU svg { flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; fill: none; stroke: #9a6f22; stroke-width: 2; }' +
        '.JUM-ACC-CARTE .JUM-CX-SANS { margin-top: 12px; }' +
        '@media (min-width: 900px) {' +
            ' .JUM-ACC-PAGE { flex-direction: row; min-height: 100vh; }' +
            ' .JUM-REGLAGES.JUM-ACC .JUM-ACC-MARQUE { display: flex; flex: 1.05; min-height: 100vh; text-align: left; padding: 56px clamp(40px, 5vw, 72px) 34px; background: radial-gradient(90% 70% at 40% 30%, #2b2b2b 0%, #151515 55%, #0c0c0c 100%); }' +
            ' .JUM-ACC-HALO { left: -60px; top: -40px; transform: none; width: 520px; height: 520px; }' +
            ' .JUM-ACC-LOGO { flex-direction: row; gap: 16px; } .JUM-ACC-LOGO img { width: 60px; } .JUM-ACC-MOT { font-size: 1.7rem; padding-left: 0; }' +
            ' .JUM-ACC-SOUS { display: none; }' +
            ' .JUM-ACC-MARQUE h1 { display: block; position: relative; margin: auto 0 0; max-width: 620px; font-size: clamp(2rem, 3.2vw, 2.9rem); line-height: 1.12; font-weight: 800; letter-spacing: -0.01em; }' +
            ' .JUM-ACC-MARQUE h1 em { font-style: normal; color: #d6a756; }' +
            ' .JUM-ACC-TXT { margin: 18px 0 0; max-width: 560px; font-size: 1.02rem; }' +
            ' .JUM-ACC-PTS { margin: 36px 0 auto; max-width: 560px; gap: 12px; } .JUM-ACC-PT { padding: 14px 18px; } .JUM-ACC-PT span { display: block; }' +
            ' .JUM-ACC-BOUTONS { display: none; }' +
            ' .JUM-ACC-BAS { display: flex; gap: 28px; position: relative; margin-top: 30px; font-size: 0.78rem; color: #8a8a8a; }' +
            ' .JUM-REGLAGES.JUM-ACC .JUM-ACC-FORM { display: flex; flex: 1; align-items: center; justify-content: center; padding: 80px 40px 40px; min-height: 100vh; }' +
            ' .JUM-ACC-TETE, .JUM-ACC-RETOUR { display: none; }' +
            ' .JUM-ACC-CARTE { margin: 0; width: 470px; padding: 32px 34px 28px; }' +
            ' .JUM-ACC-FERMER { top: 24px; right: 28px; background: #fff; color: #475569; border-color: #d6dde4; }' +
        ' }' +
        'html body.dark-mode .JUM-ACC-FORM { background: #111; } html body.dark-mode .JUM-ACC-CARTE { background: #1c1c1c; box-shadow: 0 22px 54px rgba(0,0,0,0.5); }' +
        'html body.dark-mode .JUM-ACC-CARTE h2 { color: #f5f5f5; } html body.dark-mode .JUM-ACC-AIDE, html body.dark-mode .JUM-ACC-SECU { color: #a3a3a3; } html body.dark-mode .JUM-ACC-LBL { color: #cbd5e1; }' +
        'html body.dark-mode .JUM-ACC-ONGLETS { background: #262626; } html body.dark-mode .JUM-ACC-ONGLETS button { color: #a3a3a3; } html body.dark-mode .JUM-ACC-ONGLETS button.actif { background: #f5f5f5; color: #141414; }' +
        'html body.dark-mode .JUM-ACC-CHAMP input { background: #141414; color: #f5f5f5; border-color: #404040; } html body.dark-mode .JUM-ACC-CHAMP input:focus { border-color: #e5e5e5; }' +
        'html body.dark-mode .JUM-ACC-CODE span { background: #141414; color: #f5f5f5; border-color: #404040; } html body.dark-mode .JUM-ACC-CODE span.plein { border-color: #e5e5e5; } html body.dark-mode .JUM-ACC-CODE span.curseur { border-color: #d6a756; }' +
        'html body.dark-mode .JUM-ACC-CARTE .JUM-CX-SANS { color: #e0b86a; } html body.dark-mode .JUM-ACC-CARTE .JUM-R-AIDE { color: #a3a3a3; } html body.dark-mode .JUM-ACC-CARTE .JUM-R-LIEN { color: #e0b86a; }' +
        'html body.dark-mode .JUM-ACC-BTN.noir { background: #f5f5f5; color: #141414; } html body.dark-mode .JUM-ACC-AUTRE { background: #1c1c1c; color: #ececec; border-color: #404040; }' +
        'html body.dark-mode .JUM-ACC-OU::before, html body.dark-mode .JUM-ACC-OU::after { background: #333; } html body.dark-mode .JUM-ACC-CARTE #JUM-C-ENVOI.renvoi { color: #e0b86a; }' +
        '@media (min-width: 900px) { html body.dark-mode .JUM-ACC-FERMER { background: #1c1c1c; color: #d4d4d4; border-color: #404040; } }' +
        /* Signaler un problème : Phénix au casque */
        '.JUM-SIG { position: fixed; inset: 0; z-index: 99995; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,0.55); font-family: Montserrat, system-ui, sans-serif; animation: jum-menu 0.18s ease both; }' +
        '.JUM-SIG-CARTE { position: relative; width: 100%; max-width: 380px; box-sizing: border-box; background: #fff; color: #1a1a1a; border-radius: 22px; padding: 132px 22px 18px; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.35); }' +
        '.JUM-SIG-MASCOTTE { position: absolute; left: 50%; top: -46px; transform: translateX(-50%); width: 170px; height: auto; pointer-events: none; }' +
        '.JUM-SIG-CARTE h2 { margin: 0 0 6px; font-size: 1.15rem; } .JUM-SIG-CARTE p { margin: 0 0 16px; font-size: 0.84rem; line-height: 1.5; color: #64748b; }' +
        '.JUM-SIG-BTNS { display: flex; gap: 10px; } .JUM-SIG-BTNS button { flex: 1; margin: 0; }' +
        'html body.dark-mode .JUM-SIG-CARTE { background: #1f1f1f; color: #ececec; } html body.dark-mode .JUM-SIG-CARTE p { color: #a3a3a3; }' +
        /* Profil de première connexion, en 3 étapes (même style que l'écran d'accueil) */
        '.JUM-REGLAGES.JUM-PROFIL { background: radial-gradient(90% 70% at 50% 0%, #2b2b2b 0%, #151515 55%, #0c0c0c 100%); }' +
        '.JUM-PROFIL .JUM-PF-CARTE { max-width: 500px; border-top: 0; border-radius: 26px; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }' +
        '.JUM-PF-TETE { padding: 22px 24px 6px; }' +
        '.JUM-PF-BARRES { display: flex; gap: 8px; margin-bottom: 16px; } .JUM-PF-BARRES i { flex: 1; height: 6px; border-radius: 3px; background: #e2e8f0; transition: background 0.3s ease; } .JUM-PF-BARRES i.fait { background: #d6a756; }' +
        '.JUM-PF-NUM { font: 800 0.66rem Montserrat, system-ui, sans-serif; letter-spacing: 0.2em; text-transform: uppercase; color: #b8862f; }' +
        '.JUM-PF-TETE h2 { margin: 6px 0 4px; font: 800 1.5rem/1.2 Montserrat, system-ui, sans-serif; color: #1a1a1a; } .JUM-PF-TETE p { margin: 0; font-size: 0.84rem; line-height: 1.5; color: #64748b; }' +
        '.JUM-PROFIL .JUM-R-CORPS { padding: 10px 24px 6px; }' +
        '.JUM-PF-AVATAR { display: flex; justify-content: center; margin: 6px 0 16px; } .JUM-PF-AVATAR span { width: 76px; height: 76px; border-radius: 50%; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; font: 800 1.6rem Montserrat, system-ui, sans-serif; box-shadow: 0 0 0 3px #fff, 0 0 0 6px #d6a756; }' +
        '.JUM-PF-CADENAS { display: flex; justify-content: center; margin: 6px 0 16px; } .JUM-PF-CADENAS svg { width: 64px; height: 64px; padding: 16px; box-sizing: border-box; border-radius: 50%; background: #1a1a1a; fill: none; stroke: #d6a756; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; box-shadow: 0 0 0 3px #fff, 0 0 0 6px #d6a756; }' +
        '.JUM-PROFIL .JUM-R-GRILLE { grid-template-columns: 1fr 1fr; gap: 10px 10px; } .JUM-PROFIL .JUM-R-CHAMP { min-width: 0; }' +
        '.JUM-PROFIL .JUM-R-CHAMP input { height: 50px; border-radius: 14px; border-width: 2px; font-size: 16px; }' +
        '.JUM-PROFIL .JUM-R-CHAMP input:focus { border-color: #1a1a1a; }' +
        '.JUM-PF-OPTION { margin-top: 14px; padding: 10px 12px; border-radius: 14px; background: #f6f8fa; font-size: 0.82rem; } .JUM-PF-OPTION summary { cursor: pointer; font-weight: 700; color: #3b4651; } .JUM-PF-OPTION .JUM-R-AIDE { margin-top: 8px; }' +
        '.JUM-PF-PIED { border-top: 0; padding: 10px 24px 6px; } .JUM-PF-PIED .JUM-R-PRINCIPAL { flex: 1; padding: 16px 22px; border-radius: 16px; font-size: 0.86rem; }' +
        '.JUM-PF-NOTE { margin: 4px 0 16px; text-align: center; font-size: 0.72rem; color: #94a3b8; }' +
        '.JUM-ACC-DEVISE { text-align: center; margin: 6px 0 18px; } .JUM-ACC-DTRAIT { display: block; width: 52px; height: 2px; background: #d6a756; margin: 4px auto 20px; }' +
        '.JUM-ACC-DEVISE .d1 { font: 600 0.92rem Montserrat, system-ui, sans-serif; letter-spacing: 0.42em; padding-left: 0.42em; color: #ece6da; }' +
        '.JUM-ACC-DEVISE .d2 { font: 600 0.78rem Montserrat, system-ui, sans-serif; letter-spacing: 0.3em; padding-left: 0.3em; color: #b9b0a0; }' +
        '.JUM-ACC-DEVISE .d3 { font: 800 1.9rem Montserrat, system-ui, sans-serif; letter-spacing: 0.16em; padding-left: 0.16em; color: #d6a756; text-shadow: 0 0 22px rgba(214,167,86,0.35); }' +
        '.JUM-ACC-DPT { display: block; width: 5px; height: 5px; border-radius: 50%; background: #d6a756; margin: 10px auto; }' +
        '.JUM-ACC-PREP { text-align: center; } .JUM-ACC-PREP b { color: #d6a756; }' +
        '.JUM-ACC-PROG { margin: 0 0 14px; } .JUM-ACC-PROG .JUM-PF-BARRES { margin-bottom: 8px; }' +
        // Parcours de première connexion (7 étapes) et écran de bienvenue.
        '.JUM-PF-BARRES { gap: 5px; }' +
        '.JUM-REGLAGES.JUM-PROFIL[data-vue="profil"] [data-etape="4"] [data-vue="roles"] { display: block; }' +
        '.JUM-PF-CARTE [data-vue="roles"] > .JUM-R-TITRE, .JUM-PF-CARTE [data-vue="roles"] > .JUM-R-TITRE + .JUM-R-AIDE { display: none; }' +
        '.JUM-PF-MISSIONNAIRE { opacity: 1; } .JUM-PF-MISSIONNAIRE input { accent-color: #d6a756; }' +
        '.JUM-PF-OK { margin: 0 0 12px; padding: 10px 12px; border-radius: 12px; background: #fbf4e4; border: 1px solid #efd9a8; font-size: 0.78rem; line-height: 1.45; color: #5b4a26; word-break: break-word; }' +
        '.JUM-PF-ENCART { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: #f8f6f1; border: 1px solid #ece6da; }' +
        '.JUM-PF-SOUS { font: 800 0.64rem Montserrat, system-ui, sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #8a7a5c; margin: 14px 0 6px; } .JUM-PF-SOUS:first-child { margin-top: 0; }' +
        '.JUM-PF-DEST { margin-bottom: 6px; } .JUM-PF-LISTE { display: flex; flex-direction: column; gap: 6px; margin: -2px 0 8px; }' +
        '.JUM-PF-PERS { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; text-align: left; padding: 9px 12px; border-radius: 12px; border: 1.5px solid #e6e0d4; background: #fff; cursor: pointer; font-family: inherit; }' +
        '.JUM-PF-PERS b { font-size: 0.82rem; color: #1a1a1a; } .JUM-PF-PERS small { font-size: 0.7rem; color: #7c7363; word-break: break-all; }' +
        '.JUM-PF-PERS.choisi { border-color: #d6a756; background: #fbf4e4; box-shadow: 0 0 0 2px rgba(214,167,86,0.25); } .JUM-PF-PERS.choisi b:before { content: "✓ "; color: #b8862f; }' +
        '.JUM-PF-VIDE { margin: 0 0 6px; font-size: 0.74rem; color: #8a8173; }' +
        '.JUM-PF-CARTE-APERCU { margin: 4px auto 14px; max-width: 380px; } .JUM-PF-CARTE-APERCU > .JUM-CARTE { width: 100% !important; }' +
        '.JUM-PF-PHOTO { width: 100%; margin: 0; border-color: #d6a756 !important; }' +
        '.JUM-PF-NOTIF { display: flex; gap: 10px; align-items: center; padding: 12px; border-radius: 16px; background: #fff; box-shadow: 0 6px 18px rgba(0,0,0,0.12); margin: 6px 0 16px; }' +
        '.JUM-PF-NOTIF img { width: 36px; height: 36px; border-radius: 9px; } .JUM-PF-NOTIF b { display: block; font-size: 0.8rem; } .JUM-PF-NOTIF span { font-size: 0.76rem; color: #555; }' +
        '.JUM-PF-NOTIF-BTN { width: 100%; margin: 0 0 6px; }' +
        '.JUM-PF-PLUSTARD { display: block; margin: 0 auto; border: 0; background: none; font: 700 0.78rem Montserrat, system-ui, sans-serif; color: #8a7a5c; text-decoration: underline; cursor: pointer; padding: 4px 10px; }' +
        'html body.dark-mode .JUM-PF-OK { background: #2a2418; border-color: #4a3c22; color: #e8d6ad; } html body.dark-mode .JUM-PF-ENCART { background: #1d1d1d; border-color: #333; }' +
        'html body.dark-mode .JUM-PF-PERS { background: #1d1d1d; border-color: #333; } html body.dark-mode .JUM-PF-PERS b { color: #f5f5f5; } html body.dark-mode .JUM-PF-PERS.choisi { background: #2a2418; border-color: #d6a756; }' +
        'html body.dark-mode .JUM-PF-NOTIF { background: #1d1d1d; } html body.dark-mode .JUM-PF-NOTIF span { color: #bbb; }' +
        '.JUM-BIENV { position: fixed; inset: 0; z-index: 99990; background: radial-gradient(circle at 50% 22%, #2a2a2a, #0e0e0e 70%); color: #fff; overflow-y: auto; display: flex; justify-content: center; animation: jumBienv .5s ease; }' +
        '@keyframes jumBienv { from { opacity: 0; } to { opacity: 1; } }' +
        '.JUM-BIENV-PAGE { width: 100%; max-width: 440px; box-sizing: border-box; padding: calc(env(safe-area-inset-top, 0px) + 46px) 26px calc(env(safe-area-inset-bottom, 0px) + 28px); text-align: center; display: flex; flex-direction: column; min-height: 100%; }' +
        '.JUM-BIENV-ECU { width: 92px; height: 92px; margin: 0 auto; border-radius: 50%; border: 2px solid #d6a756; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 8px rgba(214,167,86,0.12), 0 0 40px rgba(214,167,86,0.18); }' +
        '.JUM-BIENV-ECU img { width: 58px; filter: invert(1) brightness(1.2); }' +
        '.JUM-BIENV-SUR { margin-top: 20px; font: 800 0.68rem Montserrat, system-ui, sans-serif; letter-spacing: 0.24em; text-transform: uppercase; color: #d6a756; }' +
        '.JUM-BIENV h2 { margin: 8px 0 0; font: 800 1.45rem/1.3 Montserrat, system-ui, sans-serif; color: #fff; } .JUM-BIENV h2 em { font-style: normal; color: #d6a756; }' +
        '.JUM-BIENV-TRAIT { display: block; width: 52px; height: 2px; background: #d6a756; margin: 16px auto; }' +
        '.JUM-BIENV p { margin: 0; font-size: 0.86rem; line-height: 1.6; color: #c9c1b2; }' +
        '.JUM-BIENV ul { list-style: none; margin: 18px 0 0; padding: 0; text-align: left; }' +
        '.JUM-BIENV li { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid #2f2f2f; font-size: 0.82rem; color: #e7e1d6; word-break: break-word; }' +
        '.JUM-BIENV li:before { flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.66rem; font-weight: 800; }' +
        '.JUM-BIENV li.ok:before { content: "✓"; background: #d6a756; color: #1a1a1a; } .JUM-BIENV li.att:before { content: "⏳"; }' +
        '.JUM-BIENV-SIGN { margin: 18px 0 22px; font: italic 0.9rem Georgia, serif; color: #d6a756; }' +
        '.JUM-BIENV-BTN { margin-top: auto; width: 100%; padding: 17px; border: 0; border-radius: 16px; background: #d6a756; color: #1a1a1a; font: 800 0.86rem Montserrat, system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }' +
        'html body.dark-mode .JUM-PF-TETE h2 { color: #f5f5f5; } html body.dark-mode .JUM-PF-TETE p { color: #a3a3a3; } html body.dark-mode .JUM-PF-BARRES i { background: #333; } html body.dark-mode .JUM-PF-BARRES i.fait { background: #d6a756; }' +
        'html body.dark-mode .JUM-PF-AVATAR span { background: #f5f5f5; color: #141414; box-shadow: 0 0 0 3px #1f1f1f, 0 0 0 6px #d6a756; } html body.dark-mode .JUM-PF-CADENAS svg { box-shadow: 0 0 0 3px #1f1f1f, 0 0 0 6px #d6a756; }' +
        'html body.dark-mode .JUM-PF-OPTION { background: #262626; } html body.dark-mode .JUM-PF-OPTION summary { color: #cbd5e1; } html body.dark-mode .JUM-PROFIL .JUM-R-CHAMP input:focus { border-color: #e5e5e5; }' +
        '.JUM-NOUV { position: absolute; inset: 0; z-index: 6; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,15,15,0.35); animation: jum-menu 0.2s ease both; }' +
        '.JUM-NOUV.sortie { opacity: 0; transition: opacity 0.25s ease; }' +
        '.JUM-NOUV-CARTE { width: 100%; max-width: 420px; background: #fff; color: #1a1a1a; border-radius: 22px; padding: 24px 22px 18px; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.35); font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-NOUV-IC { display: inline-flex; width: 58px; height: 58px; padding: 14px; box-sizing: border-box; border-radius: 18px; background: rgba(214,167,86,0.1); color: #9a6f22; }' +
        '.JUM-NOUV-IC svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-NOUV-IC[data-ton="ok"] { background: rgba(21,128,61,0.1); color: #15803d; }' +
        /* Mascotte cachée derrière la carte blanche : elle en dépasse, comme si elle se penchait derrière */
        '.JUM-NOUV-CARTE { position: relative; }' +
        '.JUM-NOUV-BTNS { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }' +
        /* Déménagement vers l'adresse Cloudflare */
        '.JUM-DEM { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 16px; background: linear-gradient(135deg, #f7f7f5 0%, #ecebe7 100%); font-family: Montserrat, system-ui, sans-serif; overflow-y: auto; }' +
        '.JUM-DEM-CARTE { width: 100%; max-width: 460px; background: #fff; color: #1a1a1a; border-radius: 24px; padding: 28px 24px 20px; text-align: center; box-shadow: 0 24px 60px rgba(26,45,62,0.16); }' +
        '.JUM-DEM-CARTE img { width: 84px; height: 84px; border-radius: 20px; box-shadow: 0 6px 18px rgba(0,0,0,0.15); }' +
        '.JUM-DEM-CARTE h2 { margin: 16px 0 8px; font-size: 1.2rem; font-weight: 800; } .JUM-DEM-CARTE p { margin: 0 0 16px; font-size: 0.88rem; line-height: 1.55; color: #404040; }' +
        '.JUM-DEM-GO { width: 100%; border: 0; border-radius: 14px; padding: 15px; background: #1a1a1a; color: #fff; font: 800 0.8rem Montserrat, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-DEM-GO:disabled { opacity: 0.5; } .JUM-DEM-ETAT { min-height: 1.2em; margin: 12px 0 0 !important; font-weight: 700; color: #15803d !important; }' +
        '.JUM-DEM-AIDE { text-align: left; font-size: 0.78rem; line-height: 1.5; color: #9a6f22; background: #F2F7FB; border-radius: 12px; padding: 12px 14px; margin: 8px 0 12px; }' +
        '.JUM-DEM-FICHIER { border: 0; background: none; color: #9a6f22; font: 700 0.76rem Montserrat, system-ui, sans-serif; text-decoration: underline; cursor: pointer; }' +
        '.JUM-NOUV .JUM-NOUV-SECOND { background: #fff; color: #9a6f22; border: 1.5px solid #c9d6e0; }' +
        '.JUM-NOUV-MASCOTTE { position: absolute; z-index: -1; right: -92px; bottom: 26px; width: 150px; height: auto; filter: drop-shadow(0 10px 16px rgba(0,0,0,0.25)); pointer-events: none; }' +
        '@media (max-width: 560px) { .JUM-NOUV-MASCOTTE { right: 12px; bottom: auto; top: -84px; width: 110px; } }' +
        '.JUM-NOUV h2 { margin: 12px 0 8px; font-size: 1.15rem; } .JUM-NOUV p { margin: 0 0 18px; font-size: 0.9rem; line-height: 1.55; color: #404040; }' +
        '.JUM-NOUV button { border: 0; border-radius: 14px; padding: 13px 34px; background: #1a1a1a; color: #fff; font: 800 0.8rem Montserrat, system-ui, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-VERSION { position: absolute; bottom: calc(max(18px, env(safe-area-inset-bottom, 0px)) + 12px); left: 50%; transform: translateX(-50%); z-index: 3; padding: 5px 12px; border-radius: 999px;' +
            ' border: 1px solid rgba(255,255,255,0.18); background: #1a1a1a; color: #f5f5f5; box-shadow: 0 4px 14px rgba(0,0,0,0.25); font: 700 12px Montserrat, system-ui, sans-serif; letter-spacing: 0.08em; cursor: pointer; }' +
        '.JUM-CHOIX.choisi .JUM-VERSION { opacity: 0; }' +
        /* Écran de choix V2 : les logos en grand, l'état de chaque appli dessous ; l'assistant Chorus DT a son propre espace.
           Téléphone : Mise en route en haut, Compte-rendu en bas (avec Chorus : les deux côte à côte, son espace en bas).
           PC : deux ou trois colonnes. */
        '.JUM-CHOIX.JUM-V2 { display: grid; grid-template: "mer" 1fr "cr" 1fr / 1fr; }' +
        '.JUM-CHOIX.JUM-V2.avec-chorus { grid-template: "mer cr" 1.15fr "chorus chorus" 1fr / 1fr 1fr; }' +
        '.JUM-V2 .JUM-TRAIT { display: none; }' +
        // Téléphone (Android, iPhone) : barre d'outils en bas de la page de garde (Notice, Paramètres, Ma carte, Mise à jour,
        // Affichage PC), dernière rangée de la grille ; les boutons ronds dispersés disparaissent. PC : inchangé.
        '.JUM-CR-ABSENCE { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; font-size: 0.8rem; line-height: 1.45; }' +
        '.JUM-QRCO .JUM-SIG-CARTE { padding-top: 22px; max-width: 400px; } html body.dark-mode .JUM-QRCO-ETAPES { color: #d4d4d4; }' +
        '.JUM-L-SCAN { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 2px; } .JUM-L-SCAN > * { flex: 1 1 180px; margin: 0 !important; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; text-align: center; } .JUM-L-SCAN svg { width: 18px; height: 18px; }' +
        '.JUM-CARTE-QRCO { width: 100%; margin: 10px 0 0 !important; display: flex; align-items: center; justify-content: center; gap: 8px; background: #1c1c1c !important; color: #e9d9b4 !important; border-color: #6b5426 !important; } .JUM-CARTE-QRCO svg { width: 18px; height: 18px; stroke: #d6a756; }' +
        '.JUM-QRCO-BOITE { width: 280px; height: 280px; max-width: 100%; margin: 12px auto 8px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 12px; padding: 10px; box-sizing: content-box; } .JUM-QRCO-BOITE img, .JUM-QRCO-BOITE canvas { width: 100% !important; height: auto !important; } .JUM-QRCO-BOITE.expire { opacity: 0.15; }' +
        '.JUM-QRCO-CODE { text-align: center; font-size: 0.82rem; margin-bottom: 8px; } .JUM-QRCO-CODE b { letter-spacing: 0.12em; }' +
        '.JUM-QRCO-ETAPES { font-size: 0.8rem; line-height: 1.5; padding-left: 20px; margin: 6px 0; text-align: left; } .JUM-QRCO-ALERTE { font-size: 0.78rem; color: #b45309; }' +
        /* Tampon « TRAITÉ » */
        '.JUM-TAMPON { position: absolute; right: 14px; top: 10px; z-index: 5; padding: 8px 16px; border: 4px double #b8862b; border-radius: 10px; color: #b8862b; text-align: center; letter-spacing: 0.08em; background: transparent; mix-blend-mode: multiply; opacity: 0.88; transform: rotate(-11deg); pointer-events: none; font-family: Montserrat, system-ui, sans-serif; box-shadow: inset 0 0 0 1px rgba(184,134,43,0.25); }' +
        '.JUM-TAMPON .t1 { font: 900 26px Montserrat, system-ui, sans-serif; letter-spacing: 0.18em; } .JUM-TAMPON .t2 { font: 800 8.5px Montserrat, system-ui, sans-serif; margin-top: 2px; } .JUM-TAMPON .t3 { font: 700 8.5px Montserrat, system-ui, sans-serif; opacity: 0.85; }' +
        '.JUM-TAMPON::after { content: ""; position: absolute; inset: 0; border-radius: 6px; background: repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.0) 0 2px, rgba(255,255,255,0.35) 2px 3px); mix-blend-mode: screen; }' +
        '.JUM-TAMPON.coup { animation: jumTampon 0.55s cubic-bezier(.2,.9,.3,1.3) both; }' +
        '@keyframes jumTampon { 0% { transform: rotate(-16deg) scale(2.2); opacity: 0; filter: blur(2px); } 60% { transform: rotate(-11deg) scale(0.94); opacity: 1; filter: blur(0); } 100% { transform: rotate(-11deg) scale(1); opacity: 1; } }' +
        '.JUM-TAMPON.orange { color: #e07a1f; border-color: #e07a1f; box-shadow: inset 0 0 0 1px rgba(224,122,31,0.25); } .JUM-TAMPON.rouge { color: #c62828; border-color: #c62828; box-shadow: inset 0 0 0 1px rgba(198,40,40,0.25); }' +
        'html body.dark-mode .JUM-TAMPON.orange { color: #f0a35e; border-color: #f0a35e; } html body.dark-mode .JUM-TAMPON.rouge { color: #ef6b6b; border-color: #ef6b6b; }' +
        'html body.dark-mode .JUM-TAMPON { mix-blend-mode: screen; } html body.dark-mode .JUM-TAMPON:not(.orange):not(.rouge) { color: #e0b86a; border-color: #e0b86a; } .JUM-TAMPON-SCENE .JUM-TAMPON { mix-blend-mode: normal !important; opacity: 1; }' +
        '.JUM-TAMPON-SCENE { position: fixed; inset: 0; z-index: 99980; display: flex; align-items: center; justify-content: center; pointer-events: none; background: rgba(0,0,0,0.15); transition: opacity 0.4s; }' +
        '.JUM-TAMPON-SCENE .JUM-TAMPON { position: relative; right: auto; top: auto; transform-origin: center; padding: 16px 30px; background: rgba(255,250,235,0.92); } .JUM-TAMPON-SCENE .JUM-TAMPON .t1 { font-size: 46px; } .JUM-TAMPON-SCENE .JUM-TAMPON .t2, .JUM-TAMPON-SCENE .JUM-TAMPON .t3 { font-size: 12px; }' +
        '.JUM-TAMPON-SCENE.fin { opacity: 0; }' +
        '.MER-BX-LECTURE, #BIB-DETAIL-VIEW { position: relative; }' +
        /* Pastille rouge de mouvement : dossier, entrée de menu ou onglet où un envoi vient d'arriver. */
        'html body [data-mvt].mvt { position: relative; }' +
        'html body [data-mvt].mvt::after { content: "" !important; display: block !important; position: absolute !important; top: 7px !important; left: 27px !important; right: auto !important; width: 10px !important; height: 10px !important; border-radius: 50% !important; background: #dc2626 !important; border: 2px solid #fff !important; box-shadow: 0 0 0 0 rgba(220,38,38,0.55) !important; pointer-events: none !important; z-index: 2 !important; animation: jumMvt 1.4s ease-out 4 !important; }' +
        'html body .P0-TAB[data-mvt].mvt::after { top: 2px !important; left: calc(50% + 5px) !important; border-color: #121212 !important; }' +
        'html body .MER-BX-D[data-mvt].mvt::after { top: 6px !important; left: 22px !important; }' +
        'html body .BTN-ACCUEIL[data-mvt].mvt::after { top: 6px !important; left: auto !important; right: 10px !important; }' +
        '@keyframes jumMvt { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); } 100% { box-shadow: 0 0 0 9px rgba(220,38,38,0); } }' +
        /* Barre du bas des applis (téléphone) : même allure que celle de la page de garde. */
        '@media (max-width: 1099px) {' +
            'html.jum-dock-appli .JUM-CPT-ZONE .JUM-CARTE-ACCES, html.jum-dock-appli .JUM-CPT-ZONE .JUM-NOTICE-ACCES, html.jum-dock-appli .JUM-CPT-ZONE .JUM-MODE { display: none !important; }' +
            'html body .P0-TAB-BAR .P0-DOCK-INNER.JUM-DOCK-APPLI { gap: 0 !important; padding: 7px 4px 6px !important; border-radius: 20px !important; background: linear-gradient(180deg, #1c1c1c, #121212) !important; border: 1px solid rgba(214,167,86,0.35) !important; border-top: 1px solid rgba(214,167,86,0.35) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 18px rgba(0,0,0,0.25) !important; }' +
            'html body .P0-TAB-BAR .JUM-DOCK-APPLI .P0-TAB { flex: 1 1 0 !important; min-width: 0 !important; min-height: 0 !important; flex-direction: column !important; gap: 4px !important; padding: 5px 2px !important; border: 0 !important; border-radius: 14px !important; background: none !important; box-shadow: none !important; color: #e9d9b4 !important; font: 700 0.6rem Montserrat, system-ui, sans-serif !important; letter-spacing: 0.04em !important; text-transform: uppercase !important; }' +
            'html body .P0-TAB-BAR .JUM-DOCK-APPLI .P0-TAB:active { transform: none !important; background: rgba(214,167,86,0.14) !important; box-shadow: none !important; }' +
            'html body .P0-TAB-BAR .JUM-DOCK-APPLI .P0-TAB-ICON { width: auto !important; height: auto !important; background: none !important; border: 0 !important; border-radius: 0 !important; }' +
            'html body .P0-TAB-BAR .JUM-DOCK-APPLI .P0-TAB-ICON svg { width: 23px !important; height: 23px !important; fill: none !important; stroke: #d6a756 !important; stroke-width: 1.7 !important; stroke-linecap: round !important; stroke-linejoin: round !important; }' +
            'html body .P0-TAB-BAR .JUM-DOCK-APPLI .P0-TAB-LBL { color: #e9d9b4 !important; white-space: nowrap !important; overflow: visible !important; line-height: 1.15 !important; }' +
            'html body .P0-TAB-BAR .JUM-DOCK-APPLI .P0-TAB.has-badge::after { top: 2px !important; right: calc(50% - 20px) !important; border-color: #121212 !important; }' +
        '}' +
        '@media (min-width: 1100px) { .JUM-ONG-CARTE, .JUM-ONG-NOTICE, .JUM-ONG-PC { display: none !important; } }' +
        '.JUM-HORS-RESEAU { position: fixed; z-index: 2147482000; top: calc(62px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); max-width: calc(100vw - 32px); display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 16px; border: 1px solid rgba(251,191,36,0.6); background: rgba(24,18,6,0.94); color: #fde68a; font: 800 0.66rem Montserrat, system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.3); -webkit-tap-highlight-color: transparent; }' +
        '.JUM-HORS-RESEAU b { display: flex; align-items: center; white-space: nowrap; font-weight: 800; }' +
        '.JUM-HR-PT { position: absolute; left: 9px; top: 11px; width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.25); }' +
        '.JUM-HORS-RESEAU b { padding-left: 9px; }' +
        '.JUM-HORS-RESEAU small { display: none; font: 600 0.72rem/1.35 Montserrat, system-ui, sans-serif; letter-spacing: 0; text-transform: none; color: #fef3c7; text-align: center; }' +
        '.JUM-HORS-RESEAU.ouvert { width: 320px; } .JUM-HORS-RESEAU.ouvert small { display: block; }' +
        '#JUM-C-IDENT .JUM-ACC-CHAMP input { padding-left: 14px !important; }' +
        '@media (max-width: 560px) { .JUM-GC-CPT { flex-wrap: wrap; } .JUM-GC-CPT > div:first-child { flex: 1 1 100%; } .JUM-GC-ACT { flex: 1 1 100%; justify-content: flex-end; } }' +
        '.JUM-C-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; } .JUM-C-APERCU { margin: 4px 0 12px; font-size: 0.8rem; color: #6b5a33; } .JUM-C-APERCU b { color: #9a6f22; word-break: break-all; }' +
        '.JUM-VERIF-ATT { display: block; margin-top: 8px; color: #b45309; font-weight: 800; } .JUM-VERIF-VALIDER { margin-top: 10px !important; width: 100%; } .JUM-VERIF-OK { display: block; margin-top: 10px; color: #15803d; font-weight: 800; }' +
        '.JUM-GC-CPT { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 2px; border-bottom: 1px solid #eee5d3; } .JUM-GC-CPT > div:first-child { min-width: 0; }' +
        '.JUM-GC-CPT b { font-size: 0.84rem; } .JUM-GC-CPT small { display: block; color: #6b7280; font-size: 0.72rem; word-break: break-all; }' +
        '.JUM-GC-ST { font-style: normal; font-size: 0.66rem; font-weight: 800; margin-left: 6px; padding: 1px 7px; border-radius: 999px; } .JUM-GC-ST.ok { background: #dcfce7; color: #166534; } .JUM-GC-ST.att { background: #fef3c7; color: #92400e; } .JUM-GC-ST.bl { background: #fee2e2; color: #991b1b; }' +
        '.JUM-GC-ACT { display: flex; gap: 6px; flex-shrink: 0; align-items: center; } .JUM-GC-ACT button { width: auto; margin: 0; padding: 6px 10px; font-size: 0.74rem; }' +
        '.JUM-GC-SUPPR-MINI { border: 0; background: none; cursor: pointer; font-size: 1rem; padding: 4px; } .JUM-GC-MOI { font-size: 0.72rem; color: #9a6f22; font-weight: 800; }' +
        '.JUM-GC-SCAN { width: 100%; margin: 8px 0 4px; } .JUM-GC-LISTE { max-height: 46vh; overflow-y: auto; }' +
        'body.dark-mode .JUM-GC-CPT { border-color: #333; } body.dark-mode .JUM-C-APERCU { color: #c9b98f; }' +
        '.JUM-CPT-ATT { color: #b45309 !important; font-weight: 800; }' +
        '.JUM-GC-FOND { position: fixed; inset: 0; z-index: 99990; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }' +
        '.JUM-GC-FEN { position: relative; width: 100%; max-width: 440px; max-height: 88vh; overflow-y: auto; background: #fff; color: #1a1a1a; border-radius: 18px; padding: 20px 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.35); font: 500 0.86rem/1.45 Montserrat, system-ui, sans-serif; }' +
        '.JUM-GC-FEN.large { max-width: 560px; } .JUM-GC-FEN h3 { margin: 0 30px 10px 0; font-size: 1.05rem; } .JUM-GC-FEN h4 { margin: 18px 0 6px; font-size: 0.8rem; letter-spacing: 0.05em; text-transform: uppercase; color: #9a6f22; }' +
        '.JUM-GC-FEN p { margin: 0 0 8px; } .JUM-GC-FEN textarea, .JUM-GC-FEN input, .JUM-GC-FEN select { width: 100%; box-sizing: border-box; margin: 0 0 8px; padding: 10px; border: 1.5px solid #d9ccb0; border-radius: 10px; font: inherit; }' +
        '.JUM-GC-X { position: absolute; top: 12px; right: 12px; border: 0; background: #f1ece2; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; }' +
        '.JUM-GC-BTNS { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; } .JUM-GC-BTNS button { width: auto; margin: 0; }' +
        '.JUM-GC-ERR { color: #b91c1c; font-weight: 700; min-height: 0; } .JUM-GC-VIDE { color: #6b7280; font-style: italic; }' +
        '.JUM-GC-DEM { display: flex; flex-direction: column; gap: 3px; padding: 11px 12px; margin: 0 0 8px; border-radius: 12px; border: 1px solid #e3d6b8; background: #fbf7ef; }' +
        '.JUM-GC-DEM small { color: #6b7280; } .JUM-GC-DEM em { color: #374151; } .JUM-GC-TYPE { font-weight: 800; font-size: 0.78rem; } .JUM-GC-TYPE.suppression { color: #b91c1c; } .JUM-GC-TYPE.reinit { color: #9a6f22; }' +
        '.JUM-GC-SUPPR { width: 100%; padding: 11px; border-radius: 12px; border: 1.5px solid #b91c1c; background: #fff5f5; color: #b91c1c; font: 800 0.82rem Montserrat, sans-serif; cursor: pointer; }' +
        '.JUM-GC-JOURNAL div { padding: 7px 0; border-bottom: 1px solid #eee; font-size: 0.78rem; } .JUM-GC-JOURNAL small { display: block; color: #6b7280; }' +
        'body.dark-mode .JUM-GC-FEN { background: #1f1f1f; color: #e5e5e5; } body.dark-mode .JUM-GC-DEM { background: #262626; border-color: #404040; } body.dark-mode .JUM-GC-FEN textarea, body.dark-mode .JUM-GC-FEN input, body.dark-mode .JUM-GC-FEN select { background: #141414; color: #e5e5e5; border-color: #404040; }' +
        '.JUM-DOCK { display: none; }' +
        '@media (max-width: 1099px) {' +
            '.JUM-CHOIX.JUM-V2 { grid-template: "mer" 1fr "cr" 1fr "dock" auto / 1fr; }' +
            '.JUM-CHOIX.JUM-V2.avec-chorus { grid-template: "mer cr" 1.15fr "chorus chorus" 1fr "dock dock" auto / 1fr 1fr; }' +
            '.JUM-V2 .JUM-DOCK { display: block; grid-area: dock; position: relative; z-index: 3; padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px)); background: #0f0f0f; border-top: 3px solid #d6a756; transition: opacity 0.3s ease; }' +
            '.JUM-V2.choisi .JUM-DOCK { opacity: 0; pointer-events: none; }' +
            '.JUM-V2 > .JUM-MAJ-BTN, .JUM-V2 > .JUM-CARTE-ACCES, .JUM-V2 > .JUM-PARAM-ACCES, .JUM-V2 > .JUM-NOTICE-ACCES, .JUM-V2 > .JUM-MODE { display: none !important; }' +
        '}' +
        '.JUM-DOCK-BARRE { display: flex; justify-content: space-around; align-items: stretch; padding: 7px 4px 6px; border-radius: 20px; background: linear-gradient(180deg, #1c1c1c, #121212); border: 1px solid rgba(214,167,86,0.35); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }' +
        '.JUM-DOCK button { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: none; color: #e9d9b4; font: 700 0.6rem Montserrat, system-ui, sans-serif; letter-spacing: 0.05em; text-transform: uppercase; padding: 5px 2px; border-radius: 14px; cursor: pointer; text-align: center; line-height: 1.15; -webkit-tap-highlight-color: transparent; }' +
        '.JUM-DOCK button:active { background: rgba(214,167,86,0.14); }' +
        '.JUM-DOCK button svg { width: 23px; height: 23px; fill: none; stroke: #d6a756; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }' +
        '.JUM-DOCK button.tourne svg { animation: jum-tourne 0.9s linear infinite; }' +
        '.JUM-V2 .JUM-PAN { position: relative; inset: auto; clip-path: none; display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 0; overflow: hidden; transition: filter 0.2s ease, opacity 0.3s ease; }' +
        '.JUM-V2 .JUM-PAN-MER { grid-area: mer; } .JUM-V2 .JUM-PAN-CR { grid-area: cr; border-top: 3px solid #d6a756; } .JUM-V2 .JUM-PAN-CHORUS { grid-area: chorus; }' +
        '.JUM-V2.avec-chorus .JUM-PAN-CR { border-top: 0; border-left: 3px solid #d6a756; }' +
        '.JUM-V2 .JUM-PAN-CR { background: radial-gradient(90% 80% at 50% 40%, #262626 0%, #121212 70%); }' +
        '.JUM-V2 .JUM-PAN-CHORUS { background: linear-gradient(165deg, #f7efe0 0%, #ead7b2 100%); color: #1a1a1a; border-top: 3px solid #d6a756; cursor: pointer; }' +
        '.JUM-V2 .JUM-PAN.plein { position: absolute; inset: 0; z-index: 2; border: 0; }' +
        '.JUM-V2.choisi .JUM-PAN:not(.plein) { opacity: 0; }' +
        /* Au choix, le panneau touché grandit depuis sa place jusqu'à tout l'écran ; son logo glisse au centre et grossit. */
        '.JUM-CHOIX.JUM-V2 .JUM-PAN.deploie { position: absolute; grid-area: auto; z-index: 3; border: 0; transition: left 0.62s cubic-bezier(0.22,0.8,0.24,1), top 0.62s cubic-bezier(0.22,0.8,0.24,1), width 0.62s cubic-bezier(0.22,0.8,0.24,1), height 0.62s cubic-bezier(0.22,0.8,0.24,1); }' +
        '.JUM-CHOIX.JUM-V2 .JUM-PAN.deploie .JUM-BLOC, .JUM-CHOIX.JUM-V2 .JUM-PAN.deploie .JUM-BLOC-CHORUS { transition: transform 0.62s cubic-bezier(0.22,0.8,0.24,1); }' +
        '.JUM-CHOIX.JUM-V2 .JUM-PAN.deploie.grand .JUM-BLOC { transform: scale(1.4); } .JUM-CHOIX.JUM-V2 .JUM-PAN.deploie.grand .JUM-BLOC-CHORUS { transform: scale(1.06); }' +
        '.JUM-V2 .JUM-BLOC, .JUM-V2 .JUM-PAN.plein .JUM-BLOC { position: static; transform: none; left: auto; top: auto; gap: 10px; text-align: center; padding: 0 16px; }' +
        '.JUM-V2 .JUM-PAN-MER img { width: min(46vw, 21vh, 230px); } .JUM-V2 .JUM-PAN-CR img { width: calc(min(46vw, 21vh, 230px) * 1.17); }' +
        '.JUM-V2.avec-chorus .JUM-PAN-MER img { width: min(34vw, 17vh, 190px); } .JUM-V2.avec-chorus .JUM-PAN-CR img { width: calc(min(34vw, 17vh, 190px) * 1.17); }' +
        '.JUM-V2 .JUM-SOUS { font-family: Montserrat, system-ui, sans-serif; letter-spacing: 0.26em; }' +
        '.JUM-V2.avec-chorus .JUM-PAN-MER .JUM-SOUS, .JUM-V2.avec-chorus .JUM-PAN-CR .JUM-SOUS { font-size: 0.56rem; letter-spacing: 0.18em; }' +
        '.JUM-DESC { display: none; }' +
        '.JUM-ETAT { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; padding: 6px 12px; border-radius: 999px; font: 700 0.7rem/1.3 Montserrat, system-ui, sans-serif; white-space: normal; }' +
        '.JUM-ETAT::before { content: ""; flex-shrink: 0; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }' +
        '.JUM-ETAT:empty { display: none; }' +
        '.JUM-PAN-MER .JUM-ETAT { background: rgba(214,167,86,0.16); color: #8a5f12; } .JUM-PAN-CR .JUM-ETAT { background: rgba(34,197,94,0.13); color: #86efac; }' +
        '.JUM-ETAT.alerte { background: rgba(185,28,28,0.1); color: #b91c1c; } .JUM-PAN-CR .JUM-ETAT.alerte { background: rgba(248,113,113,0.14); color: #fca5a5; }' +
        '.JUM-V2 .JUM-BOITE-PASTILLE { margin-top: 0; }' +
        '.JUM-GO { position: absolute; right: 16px; bottom: 16px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; pointer-events: none; }' +
        '.JUM-GO svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PAN-MER .JUM-GO { background: #1a1a1a; color: #fff; } .JUM-PAN-CR .JUM-GO { background: #d6a756; color: #1a1a1a; } .JUM-PAN-CHORUS .JUM-GO { background: #1a1a1a; color: #d6a756; }' +
        '.JUM-V2.avec-chorus .JUM-PAN-MER .JUM-GO, .JUM-V2.avec-chorus .JUM-PAN-CR .JUM-GO { right: 10px; bottom: 10px; width: 28px; height: 28px; }' +
        '.JUM-V2.choisi .JUM-GO { opacity: 0; }' +
        /* Espace Assistant Chorus DT */
        '.JUM-BLOC-CHORUS { display: flex; align-items: center; gap: 18px; padding: 0 20px calc(max(18px, env(safe-area-inset-bottom, 0px)) + 36px); max-width: 520px; width: 100%; box-sizing: border-box; }' +
        '.JUM-CHORUS-LOGO { position: relative; flex-shrink: 0; }' +
        '.JUM-CHORUS-ADMIN { display: block; text-align: center; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.22em; margin-top: 2px; color: #a87a1f; }' +
        '.JUM-V2 .JUM-CHORUS, .JUM-V2 .JUM-CHORUS:hover, .JUM-V2.choix-chorus .JUM-CHORUS { position: static; transform: none; width: min(32vw, 15vh, 150px); mix-blend-mode: normal; }' +
        '.JUM-V2 .JUM-CHORUS img { filter: none; }' +
        '.JUM-V2 .JUM-CHORUS-NB { display: none; }' +
        '.JUM-V2.choisi .JUM-CHORUS-NB { opacity: 0; }' +
        '.JUM-CPTS { flex: 1; min-width: 0; display: grid; gap: 8px; }' +
        '.JUM-CPTS .JUM-SOUS { color: #8a5f12; margin-bottom: 2px; text-align: left; }' +
        '.JUM-CPT-L { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.65); border-radius: 14px; padding: 8px 12px; font: 700 0.74rem/1.3 Montserrat, system-ui, sans-serif; color: #1a1a1a; text-align: left; }' +
        '.JUM-CPT-L b { flex-shrink: 0; min-width: 26px; height: 26px; border-radius: 8px; background: #1a1a1a; color: #d6a756; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }' +
        '.JUM-CPT-L.zero b { background: rgba(26,26,26,0.12); color: #6b5a3a; } .JUM-CPT-L.zero { color: #6b5a3a; }' +
        '.JUM-V2.avec-chorus .JUM-MAJ-BTN, .JUM-V2.avec-chorus > .JUM-MODE { background: #1a1a1a; }' +
        '.JUM-V2 .JUM-VERSION { top: calc(max(14px, env(safe-area-inset-top, 0px)) + 6px); bottom: auto; left: max(16px, env(safe-area-inset-left, 0px)); transform: none; }' +
        '.JUM-V2:not(.avec-chorus) .JUM-PAN-CR .JUM-GO, .JUM-V2 .JUM-PAN-CHORUS .JUM-GO { bottom: calc(max(18px, env(safe-area-inset-bottom, 0px)) + 6px); }' +
        '@media (orientation: landscape) {' +
            ' .JUM-CHOIX.JUM-V2 { grid-template: "mer cr" 1fr / 1fr 1fr; } .JUM-CHOIX.JUM-V2.avec-chorus { grid-template: "mer cr chorus" 1fr / 1fr 1fr 1fr; }' +
            ' .JUM-V2 .JUM-PAN-CR { border-top: 0; border-left: 3px solid #d6a756; } .JUM-V2 .JUM-PAN-CHORUS { border-top: 0; border-left: 3px solid #d6a756; }' +
            ' .JUM-V2 .JUM-PAN-MER img, .JUM-V2.avec-chorus .JUM-PAN-MER img { width: min(26vw, 34vh, 280px); } .JUM-V2 .JUM-PAN-CR img, .JUM-V2.avec-chorus .JUM-PAN-CR img { width: calc(min(26vw, 34vh, 280px) * 1.17); }' +
            ' .JUM-V2.avec-chorus .JUM-PAN-MER img { width: min(22vw, 32vh, 250px); } .JUM-V2.avec-chorus .JUM-PAN-CR img { width: calc(min(22vw, 32vh, 250px) * 1.17); }' +
            ' .JUM-V2.avec-chorus .JUM-PAN-MER .JUM-SOUS, .JUM-V2.avec-chorus .JUM-PAN-CR .JUM-SOUS { font-size: 0.66rem; letter-spacing: 0.24em; }' +
            ' .JUM-BLOC-CHORUS { flex-direction: column; text-align: center; padding: 0 28px; max-width: 380px; }' +
            ' .JUM-V2 .JUM-CHORUS, .JUM-V2 .JUM-CHORUS:hover, .JUM-V2.choix-chorus .JUM-CHORUS { width: min(20vw, 30vh, 230px); }' +
            ' .JUM-CPTS { width: 100%; } .JUM-CPTS .JUM-SOUS { text-align: center; margin-bottom: 6px; }' +
            ' .JUM-V2 .JUM-GO, .JUM-V2.avec-chorus .JUM-PAN-MER .JUM-GO, .JUM-V2.avec-chorus .JUM-PAN-CR .JUM-GO { right: 22px; bottom: calc(max(18px, env(safe-area-inset-bottom, 0px)) + 6px); width: 42px; height: 42px; }' +
        ' }' +
        '@media (orientation: landscape) and (min-width: 1000px) and (min-height: 600px) {' +
            ' .JUM-DESC { display: block; max-width: 330px; margin: 2px 0 4px; font: 500 0.86rem/1.5 Montserrat, system-ui, sans-serif; }' +
            ' .JUM-PAN-MER .JUM-DESC { color: #5b6570; } .JUM-PAN-CR .JUM-DESC { color: #b5b5b5; }' +
            ' .JUM-ETAT { font-size: 0.8rem; padding: 8px 14px; } .JUM-CPT-L { font-size: 0.84rem; padding: 10px 14px; }' +
        ' }' +
        /* Menu de la roue crantée */
        '.JUM-ROUE-MENU { position: absolute; right: max(18px, env(safe-area-inset-right, 0px)); bottom: calc(max(18px, env(safe-area-inset-bottom, 0px)) + 62px); z-index: 4;' +
            ' background: #fff; border-radius: 16px; padding: 6px; min-width: 250px; box-shadow: 0 18px 44px rgba(0,0,0,0.45); font-family: Montserrat, system-ui, sans-serif; animation: jum-menu 0.18s ease both; }' +
        '@keyframes jum-menu { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }' +
        '.JUM-ROUE-MENU button { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; background: none; padding: 11px 12px; border-radius: 12px; text-align: left; cursor: pointer; color: #1a1a1a; font-family: inherit; }' +
        '.JUM-ROUE-MENU button:hover { background: #f1f5f9; }' +
        '.JUM-ROUE-MENU svg, .JUM-ROUE-MENU img { width: 26px; height: 26px; flex-shrink: 0; fill: none; stroke: #9a6f22; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; object-fit: contain; }' +
        '.JUM-ROUE-SEP { height: 1px; background: #e2e8f0; margin: 4px 10px; }' +
        '.JUM-ROUE-MENU .JUM-ROUE-DANGER svg { stroke: #b91c1c; } .JUM-ROUE-MENU .JUM-ROUE-DANGER b { color: #b91c1c; } .JUM-ROUE-MENU .JUM-ROUE-DANGER:hover { background: #fef2f2; }' +
        '.JUM-ROUE-MENU b { display: block; font-size: 0.84rem; } .JUM-ROUE-MENU small { display: block; font-size: 0.7rem; color: #64748b; margin-top: 2px; }' +
        '.THEME-TOGGLE svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; display: block; }' +
        '.THEME-TOGGLE { color: #9a6f22; } body.dark-mode .THEME-TOGGLE { color: #e5e5e5; }' +
        '@media (max-width: 480px) { .THEME-TOGGLE svg { width: 17px; height: 17px; } }' +
        /* Icônes au trait qui remplacent les emoji */
        '.JUM-IC { display: inline-block; width: 1.15em; height: 1.15em; vertical-align: -0.2em; flex-shrink: 0; }' +
        '.JUM-IC svg { width: 100%; height: 100%; display: block; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }' +
        '.P0-REF-BTN { display: inline-flex; align-items: center; gap: 5px; } .P0-REF-BTN .JUM-IC { width: 13px; height: 13px; vertical-align: 0; }' +
        '.JUM-IC[data-ton="ok"] { color: #15803d; } .JUM-IC[data-ton="danger"] { color: #b91c1c; } .JUM-IC[data-ton="alerte"] { color: #b45309; }' +
        'html body.dark-mode .JUM-IC[data-ton="ok"] { color: #86efac; } html body.dark-mode .JUM-IC[data-ton="danger"] { color: #f87171; } html body.dark-mode .JUM-IC[data-ton="alerte"] { color: #fbbf24; }' +
        /* Icône en tête des messages : pastille, comme les icônes des onglets */
        '.msg-icone .JUM-IC { width: 58px; height: 58px; padding: 14px; box-sizing: border-box; border-radius: 18px; background: rgba(214,167,86,0.1); color: #9a6f22; vertical-align: 0; }' +
        '.msg-icone .JUM-IC svg { stroke-width: 1.7; }' +
        '.msg-icone .JUM-IC[data-ton="ok"] { background: rgba(21,128,61,0.1); } .msg-icone .JUM-IC[data-ton="danger"] { background: rgba(185,28,28,0.09); } .msg-icone .JUM-IC[data-ton="alerte"] { background: rgba(180,83,9,0.1); }' +
        'html body.dark-mode .msg-icone .JUM-IC { background: rgba(169,195,214,0.12); color: #e0b86a; }' +
        'html body.dark-mode .msg-icone .JUM-IC[data-ton="ok"] { background: rgba(134,239,172,0.1); color: #86efac; } html body.dark-mode .msg-icone .JUM-IC[data-ton="danger"] { background: rgba(248,113,113,0.1); color: #f87171; } html body.dark-mode .msg-icone .JUM-IC[data-ton="alerte"] { background: rgba(251,191,36,0.1); color: #fbbf24; }' +
        /* ===== Démonstrations : plus de bandes jaunes et noires ===== */
        'body.jdemo .DEMO-RUBAN, body.jdemo .DEMO-BANDEAU, body.jdemo .DEMO-CONTROLES, body.jdemo .THEME-TOGGLE { display: none !important; }' +
        'body.jdemo::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 99989; box-shadow: inset 0 0 0 3px rgba(214,167,86,0.55); }' +
        'body.jdemo .demo-zone, body.jdemo .demo-spotlight { outline: 2.5px solid #9a6f22 !important; outline-offset: 4px !important; border-radius: 12px; box-shadow: 0 0 0 9px rgba(214,167,86,0.16) !important; animation: jdemo-halo 2.4s ease-in-out infinite !important; position: relative; z-index: 3; }' +
        '@keyframes jdemo-halo { 0%, 100% { box-shadow: 0 0 0 7px rgba(214,167,86,0.16); } 50% { box-shadow: 0 0 0 12px rgba(214,167,86,0.07); } }' +
        'html body.dark-mode.jdemo .demo-zone, html body.dark-mode.jdemo .demo-spotlight { outline-color: #e0b86a !important; }' +
        '@media (min-width: 1100px) { html body.jdemo-reserve { padding-right: 400px !important; } }' +
        '.JDEMO-PASTILLE { position: fixed; top: calc(12px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); z-index: 99995; display: flex; align-items: center; gap: 9px; white-space: nowrap;' +
            ' background: #1a1a1a; color: #fff; border-radius: 999px; padding: 6px 6px 6px 14px; font: 800 11px Montserrat, system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }' +
        '.JDEMO-PASTILLE i { width: 8px; height: 8px; border-radius: 50%; background: #d6a756; box-shadow: 0 0 0 4px rgba(214,167,86,0.25); }' +
        '.JDEMO-PASTILLE b { font-weight: 600; letter-spacing: 0.04em; color: #cbd5e1; }' +
        '.JDEMO-QUITTER { border: 0; border-radius: 999px; background: rgba(255,255,255,0.14); color: #fff; font: 700 11px Montserrat, system-ui, sans-serif; padding: 6px 12px; letter-spacing: 0.04em; cursor: pointer; text-transform: none; }' +
        '.JDEMO-GUIDE { position: fixed; z-index: 99994; display: flex; align-items: flex-end; font-family: Montserrat, system-ui, sans-serif; pointer-events: none; }' +
        '.JDEMO-BULLE { pointer-events: auto; position: relative; background: #fff; color: #1a1a1a; border: 1px solid #e8e8e8; box-shadow: 0 18px 50px rgba(15,23,42,0.22); }' +
        '.JDEMO-ETAPE { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #9a6f22; margin-bottom: 5px; }' +
        '.JDEMO-TITRE { font-size: 17px; font-weight: 800; margin-bottom: 6px; }' +
        '.JDEMO-TEXTE { font-size: 13.5px; line-height: 1.55; color: #404040; }' +
        '.JDEMO-NAV { display: flex; align-items: center; gap: 10px; margin-top: 14px; }' +
        '.JDEMO-POINTS { flex: 1; display: flex; gap: 4px; justify-content: center; min-width: 0; } .JDEMO-POINTS span { width: 5px; height: 5px; border-radius: 3px; background: #d4dde5; flex-shrink: 0; } .JDEMO-POINTS span.a { width: 14px; background: #1a1a1a; }' +
        '.JDEMO-NAV button { border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; padding: 9px 14px; font: 700 12px Montserrat, system-ui, sans-serif; color: #1a1a1a; cursor: pointer; white-space: nowrap; }' +
        '.JDEMO-NAV button:disabled { opacity: 0.35; cursor: default; } .JDEMO-NAV .JDEMO-SUIV { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }' +
        '.JDEMO-ENTREE .JDEMO-BULLE { animation: jdemo-entree 0.35s cubic-bezier(0.2,0.8,0.2,1) both; }' +
        '@keyframes jdemo-entree { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }' +
        /* PC : mascotte en grand, bulle à côté (ligne) ou au-dessus (colonne) */
        '.JDEMO-GUIDE.pc .JDEMO-MASCOTTE { width: 205px; height: auto; flex-shrink: 0; filter: drop-shadow(0 14px 22px rgba(0,0,0,0.22)); }' +
        '.JDEMO-GUIDE.pc .JDEMO-BULLE { width: 360px; border-radius: 20px; padding: 18px 20px 14px; margin-bottom: 36px; margin-left: -18px; }' +
        '.JDEMO-GUIDE.pc.droite { flex-direction: row-reverse; } .JDEMO-GUIDE.pc.droite .JDEMO-BULLE { margin-left: 0; margin-right: -18px; }' +
        '.JDEMO-GUIDE.pc .JDEMO-BULLE::after { content: ""; position: absolute; bottom: 26px; left: -11px; width: 22px; height: 22px; background: inherit; transform: rotate(45deg); border: 1px solid #e8e8e8; border-top: 0; border-right: 0; }' +
        '.JDEMO-GUIDE.pc.droite .JDEMO-BULLE::after { left: auto; right: -11px; border: 1px solid #e8e8e8; border-bottom: 0; border-left: 0; }' +
        '.JDEMO-GUIDE.pc.colonne { flex-direction: column-reverse; align-items: flex-start; } .JDEMO-GUIDE.pc.colonne.droite { align-items: flex-end; }' +
        '.JDEMO-GUIDE.pc.colonne .JDEMO-MASCOTTE { width: 150px; margin: -6px 10px 0; } .JDEMO-GUIDE.pc.colonne .JDEMO-BULLE { width: 330px; margin: 0; }' +
        '.JDEMO-GUIDE.pc.colonne .JDEMO-BULLE::after { bottom: -11px; left: 62px; right: auto; border: 1px solid #e8e8e8; border-top: 0; border-left: 0; }' +
        '.JDEMO-GUIDE.pc.colonne.droite .JDEMO-BULLE::after { left: auto; right: 62px; }' +
        /* Téléphone : en haut de l'écran, sous la pastille */
        '.JDEMO-GUIDE.tel { left: 10px; right: 10px; top: calc(48px + env(safe-area-inset-top, 0px)); }' +
        '.JDEMO-GUIDE.tel .JDEMO-BULLE { flex: 1; border-radius: 20px; padding: 12px 12px 10px 92px; min-height: 112px; }' +
        '.JDEMO-GUIDE.tel .JDEMO-MASCOTTE { position: absolute; left: -6px; bottom: -4px; width: 96px; z-index: 1; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.2)); }' +
        '.JDEMO-GUIDE.tel .JDEMO-ETAPE { font-size: 10px; margin-bottom: 2px; } .JDEMO-GUIDE.tel .JDEMO-TITRE { font-size: 14px; margin-bottom: 3px; } .JDEMO-GUIDE.tel .JDEMO-TEXTE { font-size: 12.5px; line-height: 1.45; }' +
        '.JDEMO-GUIDE.tel .JDEMO-NAV { margin-top: 9px; } .JDEMO-GUIDE.tel .JDEMO-POINTS { display: none; } .JDEMO-GUIDE.tel .JDEMO-NAV button { padding: 8px 12px; font-size: 11px; } .JDEMO-GUIDE.tel .JDEMO-SUIV { margin-left: auto; }' +
        '@media (max-width: 360px) { .JDEMO-GUIDE.tel .JDEMO-BULLE { padding-left: 80px; } .JDEMO-GUIDE.tel .JDEMO-MASCOTTE { width: 84px; } .JDEMO-PASTILLE span { display: none; } }' +
        /* Mode sombre */
        'html body.dark-mode .JDEMO-BULLE { background: #1f1f1f; color: #ececec; border-color: rgba(255,255,255,0.09); box-shadow: 0 18px 50px rgba(0,0,0,0.5); }' +
        'html body.dark-mode .JDEMO-GUIDE.pc .JDEMO-BULLE::after { border-color: rgba(255,255,255,0.09); }' +
        'html body.dark-mode .JDEMO-TEXTE { color: #c8c8c8; } html body.dark-mode .JDEMO-ETAPE { color: #e0b86a; }' +
        'html body.dark-mode .JDEMO-NAV button { background: #262626; color: #ececec; border-color: rgba(255,255,255,0.1); } html body.dark-mode .JDEMO-NAV .JDEMO-SUIV { background: #ececec; color: #141414; border-color: #ececec; }' +
        'html body.dark-mode .JDEMO-POINTS span { background: #3a3a3a; } html body.dark-mode .JDEMO-POINTS span.a { background: #ececec; }' +
        'html body.dark-mode.jdemo::after { box-shadow: inset 0 0 0 3px rgba(169,195,214,0.45); }' +
        '@media (prefers-reduced-motion: reduce) { body.jdemo .demo-zone, body.jdemo .demo-spotlight, .JDEMO-ENTREE .JDEMO-BULLE { animation: none !important; } }' +
        /* ===== Thème sombre commun : une seule palette pour les deux applis (gris neutres + bleu ardoise TRIGONE) =====
           Fond #141414, surfaces #1f1f1f / #262626, texte #ececec, secondaire #a3a3a3, accent #e0b86a (bleu ardoise clair). */
        'html body.dark-mode { --tg-muted: #a3a3a3; --tg-soft: #8f8f8f; --tg-border: rgba(255,255,255,0.09); }' +
        /* Notice : dépliants identiques dans les deux applis (« + » à droite, couleur d'accent, pas de triangle) */
        '.notice-fold > summary { list-style: none; } .notice-fold > summary::-webkit-details-marker { display: none; }' +
        '.notice-fold > summary::after { content: " +"; float: right; color: #9a6f22; font-weight: 900; font-size: 1.15em; line-height: 1; }' +
        '.notice-fold[open] > summary::after { content: " −"; }' +
        'html body.dark-mode .notice-fold > summary::after { color: #e0b86a; }' +
        'html body.dark-mode .notice-fold > summary { color: #ececec; }' +
        'html body.dark-mode .notice-fold li, html body.dark-mode .notice-fold p, html body.dark-mode .notice-mini li { color: #c8c8c8; }' +
        'html body.dark-mode .notice-fold b, html body.dark-mode .notice-mini b { color: #ececec; }' +
        /* Textes secondaires : lisibles partout */
        'html body.dark-mode .NOTICE-CARD-SUB, html body.dark-mode .NOTICE-CARD-CHEV, html body.dark-mode .BIB-HEADER-TXT p, html body.dark-mode .NOTICE-LEAD-HINT,' +
        ' html body.dark-mode .BIB-EMPTY span, html body.dark-mode .MER-HINT, html body.dark-mode .PC-SOUS { color: #a3a3a3; }' +
        'html body.dark-mode .NOTICE-CARD-TITLE, html body.dark-mode .BIB-EMPTY p, html body.dark-mode .P1-SECTION-LBL { color: #ececec; }' +
        'html body.dark-mode .P0-TAB.is-active .P0-TAB-LBL, html body.dark-mode .MER-DOCK-BTN.actif span, html body.dark-mode .P0-TAB.is-active .P0-LBL-COURT { color: #ececec; }' +
        /* Liens, boutons texte, danger */
        'html body.dark-mode a:not([class]) { color: #e0b86a; }' +
        'html body.dark-mode .BTN-DANGER-TEXT { color: #f87171; border-color: rgba(248,113,113,0.35); background: transparent; }' +
        /* Libellés de sections et sélections actives : une seule règle (pastille claire, texte foncé) */
        'html body.dark-mode .P1-SECTION-LBL, html body.dark-mode #P1 .P1-SECTION-LBL, html body.dark-mode #P1-IDENTITY-ZONE .P1-SECTION-LBL { color: #ececec; }' +
        'html body.dark-mode .MZ-TAB.active { background: #ececec; border-color: #ececec; color: #141414; }' +
        'html body.dark-mode .collective-zone, html body.dark-mode #P1 .collective-zone { background: rgba(169,195,214,0.08) !important; border-color: rgba(169,195,214,0.25) !important; }' +
        'html body.dark-mode .collective-zone label { color: #e0b86a !important; }' +
        'html body.dark-mode .LIB-CLEAR-ALL-BTN { color: #e0b86a; border-color: rgba(169,195,214,0.3); background: transparent; }' +
        'html body.dark-mode .BTN-ALERT, html body.dark-mode .ADMIN-SECTION .BTN-ALERT { background: #262626; color: #ececec; border-color: rgba(255,255,255,0.1); }' +
        'html body.dark-mode .NOTICE-HELP { background: #262626; color: #ececec; border-color: rgba(255,255,255,0.1); }' +
        /* Voile derrière les fenêtres : noir neutre (plus de voile bleu marine) */
        'html body.dark-mode .VALIDATION-MODAL, html body.dark-mode .NOTICE-MODAL, html body.dark-mode .QR-OVERLAY, html body.dark-mode #REFERENCES-MODAL, html body.dark-mode #PARAMS-MODAL { background: rgba(0,0,0,0.72); }' +
        'html body.dark-mode .FOLD-ICON svg { stroke: #e0b86a; }' +
        'html body.dark-mode #FORFAIT-EXPORT-BTN, html body.dark-mode #FORFAIT-EXPORT-BTN.LIB-CLEAR-ALL-BTN { color: #e0b86a !important; border-color: rgba(169,195,214,0.3) !important; background: transparent !important; }' +
        'html body.dark-mode .PC-BADGE { background: rgba(169,195,214,0.14); color: #e0b86a; } html body.dark-mode .PC-BADGE.PC-BADGE-GRIS { background: rgba(255,255,255,0.07); color: #a3a3a3; }' +
        /* Fenêtres de Compte-rendu : sans liseré violet, comme celles de Mise en route */
        '.ADMIN-BOX { border-left: 0 !important; }' +
        /* Présentation TRIGONE en mode sombre */
        'html body.dark-mode .JUM-PRES { background: linear-gradient(165deg, #1a1a1a 0%, #111 100%); color: #ececec; }' +
        'html body.dark-mode .JUM-PRES-LOGO { filter: brightness(0) invert(0.93); }' +
        'html body.dark-mode .JUM-PRES-LIGNE, html body.dark-mode .JUM-PRES h1 em { color: #e0b86a; }' +
        'html body.dark-mode .JUM-PRES-CHAPO { color: #a3a3a3; }' +
        'html body.dark-mode .JUM-PRES-TRAIT { background: linear-gradient(to bottom right, transparent calc(50% - 1px), rgba(169,195,214,0.18) 50%, transparent calc(50% + 1px)); }' +
        'html body.dark-mode .JUM-PRES-CLAIR { background: #1f1f1f; border-color: rgba(255,255,255,0.09); color: #ececec; box-shadow: none; }' +
        'html body.dark-mode .JUM-PRES-SOMBRE { background: #ececec; color: #1a1a1a; }' +
        'html body.dark-mode .JUM-PRES-CLAIR .JUM-PRES-NUM { color: #e0b86a; } html body.dark-mode .JUM-PRES-SOMBRE .JUM-PRES-NUM { color: #9a6f22; }' +
        'html body.dark-mode .JUM-PRES-CLAIR li::before { background: #e0b86a; } html body.dark-mode .JUM-PRES-SOMBRE li::before { background: #9a6f22; }' +
        'html body.dark-mode .JUM-PRES-CLAIR li { border-top-color: rgba(255,255,255,0.08); } html body.dark-mode .JUM-PRES-SOMBRE li { border-top-color: rgba(0,0,0,0.08); }' +
        'html body.dark-mode .JUM-PRES-GARANTIES div { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.09); color: #d4d4d4; }' +
        'html body.dark-mode .JUM-PRES-GARANTIES svg { stroke: #e0b86a; }' +
        'html body.dark-mode .JUM-PRES-BTN { background: #ececec; color: #141414; } html body.dark-mode .JUM-PRES-BTN:hover { background: #fff; }' +
        'html body.dark-mode .JUM-R-X { background: #262626; color: #d4d4d4; border-color: rgba(255,255,255,0.1); }' +
        /* Présentation TRIGONE */
        '.JUM-PRES { position: fixed; inset: 0; z-index: 99992; background: linear-gradient(165deg, #f7f7f5 0%, #ecebe7 100%); color: #1a1a1a;' +
            ' font-family: Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; opacity: 0; transition: opacity 0.38s ease; }' +
        '.JUM-PRES.visible { opacity: 1; }' +
        '.JUM-PRES-TRAIT { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom right, transparent calc(50% - 1px), rgba(214,167,86,0.22) 50%, transparent calc(50% + 1px)); }' +
        '.JUM-PRES-DEFIL { position: absolute; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }' +
        '.JUM-PRES-CONTENU { position: relative; max-width: 960px; margin: 0 auto; padding: max(34px, env(safe-area-inset-top, 0px)) 20px max(34px, env(safe-area-inset-bottom, 0px)); text-align: center; }' +
        '.JUM-PRES-CONTENU > * { opacity: 0; transform: translateY(12px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2,0.8,0.2,1); }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > * { opacity: 1; transform: none; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(2) { transition-delay: 0.08s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(3) { transition-delay: 0.14s; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(4) { transition-delay: 0.22s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(5) { transition-delay: 0.3s; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(6) { transition-delay: 0.4s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(n+7) { transition-delay: 0.5s; }' +
        '.JUM-PRES-LOGO { width: 92px; height: auto; }' +
        '.JUM-PRES-MARQUE { font-size: 2rem; font-weight: 800; letter-spacing: 0.34em; margin: 10px 0 4px; padding-left: 0.34em; }' +
        '.JUM-PRES-LIGNE { font-size: 0.66rem; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: #9a6f22; }' +
        '.JUM-PRES-LIGNE span { margin: 0 6px; }' +
        '@media (max-width: 440px) { .JUM-PRES-LIGNE { font-size: 0.58rem; letter-spacing: 0.1em; } .JUM-PRES-MARQUE { font-size: 1.7rem; } }' +
        '.JUM-PRES h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: clamp(1.5rem, 4.2vw, 2.3rem); line-height: 1.25; margin: 26px 0 10px; }' +
        '.JUM-PRES h1 em { font-style: normal; color: #9a6f22; }' +
        '.JUM-PRES-CHAPO { max-width: 620px; margin: 0 auto 26px; font-size: 0.9rem; line-height: 1.6; color: #525252; }' +
        '.JUM-PRES-DUO { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; text-align: left; }' +
        '@media (max-width: 640px) { .JUM-PRES-DUO { grid-template-columns: 1fr; } }' +
        '.JUM-PRES-VOLET { border-radius: 18px; padding: 20px 20px 16px; }' +
        '.JUM-PRES-CLAIR { background: #fff; border: 1px solid #e8e8e8; box-shadow: 0 10px 40px rgba(0,0,0,0.06); color: #1a1a1a; }' +
        '.JUM-PRES-SOMBRE { background: #1a1a1a; box-shadow: 0 10px 40px rgba(0,0,0,0.14); color: #f5f5f5; }' +
        '.JUM-PRES-NUM { font-size: 0.64rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #9a6f22; }' +
        '.JUM-PRES-SOMBRE .JUM-PRES-NUM { color: #d6a756; }' +
        '.JUM-PRES-TITRE { font-size: 1.1rem; font-weight: 800; margin: 6px 0 10px; }' +
        '.JUM-PRES-VOLET ul { margin: 0; padding: 0; list-style: none; }' +
        '.JUM-PRES-VOLET li { position: relative; padding: 7px 0 7px 22px; font-size: 0.82rem; line-height: 1.45; border-top: 1px solid rgba(214,167,86,0.18); }' +
        '.JUM-PRES-SOMBRE li { border-top-color: rgba(255,255,255,0.08); }' +
        '.JUM-PRES-VOLET li:first-child { border-top: 0; }' +
        '.JUM-PRES-VOLET li::before { content: ""; position: absolute; left: 2px; top: 13px; width: 8px; height: 8px; border-radius: 2px; transform: rotate(45deg); background: #9a6f22; }' +
        '.JUM-PRES-SOMBRE li::before { background: #d6a756; }' +
        '.JUM-PRES-GARANTIES { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0 26px; }' +
        '@media (max-width: 640px) { .JUM-PRES-GARANTIES { grid-template-columns: 1fr; } }' +
        '.JUM-PRES-GARANTIES div { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.7); border: 1px solid #e8e8e8; font-size: 0.78rem; font-weight: 600; color: #404040; }' +
        '.JUM-PRES-GARANTIES svg { width: 20px; height: 20px; flex-shrink: 0; fill: none; stroke: #9a6f22; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PRES-BTN { border: 0; border-radius: 14px; padding: 15px 44px; background: #1a1a1a; color: #fff; box-shadow: 0 10px 26px rgba(0,0,0,0.18); font: 800 0.84rem Montserrat, system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-PRES-BTN:hover { background: #333; }' +
        '@media (prefers-reduced-motion: reduce) { .JUM-PRES, .JUM-PRES-CONTENU > * { transition: none; } }' +
        /* Réglages TRIGONE */
        '.JUM-REGLAGES { position: fixed; inset: 0; z-index: 99990; background: rgba(15,15,15,0.72); display: flex; align-items: center; justify-content: center; padding: 16px;' +
            ' font-family: Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }' +
        '.JUM-R-CARTE { width: 100%; max-width: 640px; max-height: calc(100% - 8px); display: flex; flex-direction: column; background: #fff; color: #1a1a1a; border-radius: 20px;' +
            ' border-top: 3px solid #d6a756; box-shadow: 0 24px 60px rgba(0,0,0,0.35); overflow: hidden; }' +
        '.JUM-R-TETE { display: flex; align-items: flex-start; gap: 14px; padding: 20px 20px 12px; border-bottom: 1px solid #eef2f6; }' +
        '.JUM-R-TETE h2 { margin: 0 0 4px; font-size: 1.15rem; }' +
        '.JUM-R-TETE p { margin: 0; font-size: 0.76rem; color: #64748b; line-height: 1.4; }' +
        '.JUM-R-ICONE { flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px; background: rgba(214,167,86,0.1); color: #9a6f22; display: flex; align-items: center; justify-content: center; }' +
        '.JUM-R-ICONE svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-R-X { margin-left: auto; border: 0; background: none; font-size: 1.1rem; color: #64748b; cursor: pointer; padding: 4px 6px; }' +
        '.JUM-R-CORPS { padding: 6px 20px 10px; overflow-y: auto; -webkit-overflow-scrolling: touch; }' +
        '.JUM-R-TITRE { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 16px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #1a1a1a; }' +
        '.JUM-R-GRILLE { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }' +
        '@media (max-width: 520px) { .JUM-R-GRILLE { grid-template-columns: 1fr; } }' +
        '.JUM-R-CHAMP label { display: block; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 5px; color: #334155; }' +
        '.JUM-R-CHAMP input { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font: 500 0.9rem Montserrat, system-ui, sans-serif; color: #1a1a1a; background: #fff; }' +
        '.JUM-R-CHAMP input:focus { outline: none; border-color: #9a6f22; }' +
        '.JUM-UNITES { position: absolute; left: 0; right: 0; top: 100%; z-index: 30; margin-top: 4px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 28px rgba(0,0,0,0.18); padding: 4px; max-height: 230px; overflow-y: auto; }' +
        '.JUM-UNITES button { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 9px 10px; border-radius: 9px; cursor: pointer; font-family: inherit; color: #1a1a1a; }' +
        '.JUM-UNITES button:hover, .JUM-UNITES button:focus { background: #fbf4e6; } .JUM-UNITES b { display: block; font-size: 0.86rem; } .JUM-UNITES small { display: block; font-size: 0.66rem; color: #64748b; }' +
        '.JUM-UNITES p { margin: 0; padding: 9px 10px; font-size: 0.74rem; color: #64748b; }' +
        '.JUM-ADRESSE { margin: 12px 0 4px; padding: 12px; border-radius: 12px; border: 1.5px dashed rgba(214,167,86,0.6); text-align: left; font-size: 0.78rem; } .JUM-ADRESSE span { display: block; color: #64748b; } .JUM-ADRESSE b { display: block; font-size: 0.92rem; margin: 4px 0 8px; word-break: break-all; } .JUM-ADRESSE small { display: block; margin-top: 8px; color: #64748b; font-size: 0.7rem; } .JUM-ADRESSE .JUM-R-SECOND { width: auto; padding: 7px 14px; }' +
        '.JUM-CR-BOITE { border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 8px; margin: 6px 0 10px; } .JUM-CR-BOITE label { display: flex; gap: 10px; align-items: flex-start; padding: 8px; border-radius: 10px; cursor: pointer; } .JUM-CR-BOITE label:hover { background: #fbf4e6; } .JUM-CR-BOITE input { width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px; } .JUM-CR-BOITE b { display: block; font-size: 0.82rem; word-break: break-all; } .JUM-CR-BOITE small { display: block; font-size: 0.7rem; color: #64748b; } .JUM-CR-BOITE em { color: #b45309; font-style: normal; font-weight: 700; }' +
        'html body.dark-mode .JUM-CR-BOITE { border-color: #3a3a3a; } html body.dark-mode .JUM-CR-BOITE label:hover { background: #2a2a2a; }' +
        '.JUM-PART-FOND { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 99985; display: flex; align-items: center; justify-content: center; padding: 14px; }' +
        '.JUM-PART-FEN { background: #fff; color: #1a1a1a; border-radius: 22px; width: min(1180px, 100%); max-height: 94vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-PART-TETE { padding: 16px 18px 0; display: flex; align-items: flex-start; gap: 10px; } .JUM-PART-TETE .ic { font-size: 1.4rem; } .JUM-PART-TETE > div { flex: 1; min-width: 0; }' +
        '.JUM-PART-TETE b { font-size: 1rem; display: block; } .JUM-PART-TETE small { display: block; color: #64748b; font-size: 0.72rem; margin-top: 3px; line-height: 1.6; }' +
        '.JUM-PART-X { border: 0; background: #f1f5f9; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 0.9rem; color: #334155; flex-shrink: 0; }' +
        '.JUM-PART-ONG { display: flex; gap: 4px; padding: 10px 18px 0; border-bottom: 1px solid #eee; } .JUM-PART-ONG button { border: 0; background: none; padding: 9px 14px; font: 700 0.8rem Montserrat, system-ui, sans-serif; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; } .JUM-PART-ONG button.on { color: #1a1a1a; border-color: #d6a756; }' +
        '.JUM-PART-GRILLE { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; padding: 18px; }' +
        '.JUM-PART-CARTE { display: block; width: 100%; border: 0; padding: 0; background: none; cursor: zoom-in; text-align: left; }' +
        '.JUM-PART-CARTE .JUM-CARTE, .JUM-PART-GRAND .JUM-CARTE { width: 100% !important; max-width: none !important; transform: none !important; position: relative !important; }' +
        '.JUM-CARTE-PHOTO .JUM-CARTE-INIT { font: 800 2.4em Montserrat, system-ui, sans-serif !important; color: #d6a756 !important; letter-spacing: 0.02em; }' +
        '.JUM-PART-ROLE { font: 800 0.66rem Montserrat, system-ui, sans-serif; letter-spacing: 0.06em; color: #8a5f12; margin: 0 0 6px; }' +
        '.JUM-PART-ETAT { margin-top: 8px; font: 700 0.7rem Montserrat, system-ui, sans-serif; padding: 6px 10px; border-radius: 10px; line-height: 1.4; } .JUM-PART-ETAT.ok { background: rgba(21,128,61,0.1); color: #15803d; } .JUM-PART-ETAT.att { background: #f1f5f9; color: #475569; } .JUM-PART-ETAT.ko { background: rgba(185,28,28,0.08); color: #b91c1c; }' +
        '.JUM-PART-PIED { padding: 0 18px 16px; margin: 0; font-size: 0.72rem; color: #64748b; line-height: 1.45; }' +
        '.JUM-PART-DEM { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 18px; padding: 18px; font-size: 0.86rem; } .JUM-PART-DEM small { display: block; font-size: 0.64rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #1a1a1a; margin-bottom: 2px; }' +
        '.JUM-PART-GRAND { position: fixed; inset: 0; z-index: 99986; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; cursor: zoom-out; } .JUM-PART-GRAND > .JUM-CARTE { width: min(640px, 94vw) !important; } .JUM-PART-GRAND p { color: #cbd5e1; font-size: 0.74rem; margin-top: 14px; }' +
        '.JUM-CARTE-PARTPHOTO { display: flex; gap: 10px; align-items: flex-start; margin: 12px 0 4px; padding: 12px; border-radius: 12px; background: rgba(214,167,86,0.1); cursor: pointer; text-align: left; } .JUM-CARTE-PARTPHOTO input { width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; accent-color: #b0802a; } .JUM-CARTE-PARTPHOTO b { display: block; font-size: 0.8rem; } .JUM-CARTE-PARTPHOTO small { display: block; font-size: 0.7rem; color: #64748b; margin-top: 3px; line-height: 1.4; }' +
        'html body.dark-mode .JUM-PART-FEN { background: #1f1f1f; color: #ececec; } html body.dark-mode .JUM-PART-ONG { border-color: #333; } html body.dark-mode .JUM-PART-ONG button.on, html body.dark-mode .JUM-PART-DEM small { color: #f5f5f5; } html body.dark-mode .JUM-PART-X { background: #2a2a2a; color: #e5e5e5; } html body.dark-mode .JUM-PART-ETAT.att { background: #2a2a2a; color: #cbd5e1; }' +
        'html body.dark-mode .JUM-UNITES { background: #1f1f1f; border-color: #3a3a3a; } html body.dark-mode .JUM-UNITES button { color: #ececec; } html body.dark-mode .JUM-UNITES button:hover { background: #2a2a2a; }' +
        '.JUM-R-AIDE { font-size: 0.76rem; color: #64748b; margin: 0 0 10px; line-height: 1.45; }' +
        '.JUM-R-ETAPES { padding-left: 20px; } .JUM-R-ETAPES li { margin: 2px 0; }' +
        '.JUM-LIAISON-BLOC { margin: 0 0 14px; padding: 10px 12px; border-radius: 12px; background: #EEF2F6; border: 1px solid #cfdbe6; font-size: 0.8rem; }' +
        '.JUM-LIAISON-BLOC summary { cursor: pointer; line-height: 1.4; } .JUM-LIAISON-BLOC b { color: #1a1a1a; }' +
        '.JUM-LIAISON-CODE { text-align: center; font: 800 2rem/1.1 Montserrat, system-ui, sans-serif; letter-spacing: 0.14em; padding: 14px 8px 10px; margin: 10px 0 4px; border-radius: 14px; background: #1a1a1a; color: #fff; user-select: all; }' +
        '.JUM-LIAISON-TEMPS { text-align: center; font-size: 0.78rem; font-weight: 700; color: #a16207; margin-bottom: 8px; }' +
        'html body.dark-mode .JUM-LIAISON-BLOC { background: rgba(214,167,86,0.1); border-color: rgba(214,167,86,0.25); } html body.dark-mode .JUM-LIAISON-BLOC b { color: #f5f5f5; }' +
        '.JUM-R-ERREUR { color: #b91c1c; font-size: 0.8rem; font-weight: 700; margin: 12px 0 0; min-height: 1em; }' +
        '.JUM-R-PIED { display: flex; align-items: center; gap: 10px; padding: 12px 20px 16px; border-top: 1px solid #eef2f6; }' +
        '.JUM-R-PIED > .JUM-R-PRINCIPAL:only-child { flex: 1; padding: 15px 22px; }' +
        '.JUM-R-PRINCIPAL { margin-left: auto; border: 0; border-radius: 12px; padding: 13px 22px; background: #1a1a1a; color: #fff; font: 800 0.78rem Montserrat, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-R-SECOND { border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 18px; background: #fff; color: #1a1a1a; font: 800 0.74rem Montserrat, system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-R-LIEN { border: 0; background: none; padding: 8px 0; color: #9a6f22; font: 700 0.74rem Montserrat, system-ui, sans-serif; text-decoration: underline; cursor: pointer; text-align: left; }' +
        'body.dark-mode .JUM-R-CARTE { background: #1f1f1f; color: #e5e5e5; } body.dark-mode .JUM-R-CHAMP label { color: #cbd5e1; }' +
        'body.dark-mode .JUM-R-CHAMP input { background: #141414; color: #f5f5f5; border-color: #404040; } body.dark-mode .JUM-R-TITRE { border-bottom-color: #e5e5e5; }' +
        'body.dark-mode .JUM-R-PRINCIPAL { background: #f5f5f5; color: #141414; } body.dark-mode .JUM-R-SECOND { background: #1f1f1f; color: #f5f5f5; border-color: #404040; }' +
        '.JUM-BANDEAU { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 99999; background: #15803d; color: #fff; padding: 12px 18px; border-radius: 12px;' +
            ' font: 700 0.84rem Montserrat, system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.25); max-width: calc(100% - 32px); transition: opacity 0.4s ease; }' +
        '.JUM-BANDEAU.sortie { opacity: 0; }' +
        /* Code d'accès commun */
        '.JUM-PIN { position: fixed; inset: 0; z-index: 99996; background: #0f0f0f; display: flex; align-items: center; justify-content: center; padding: 16px; font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-PIN-CARTE { width: 100%; max-width: 320px; text-align: center; color: #f5f5f5; }' +
        '.JUM-PIN-TITRE { font-size: 1.25rem; font-weight: 800; margin-bottom: 6px; }' +
        '.JUM-PIN-CARTE p { font-size: 0.82rem; color: #a3a3a3; margin: 0 0 22px; }' +
        '.JUM-PIN-POINTS { display: flex; justify-content: center; gap: 16px; margin-bottom: 10px; }' +
        '.JUM-PIN-POINT { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #d6a756; }' +
        '.JUM-PIN-POINT.plein { background: #d6a756; }' +
        '.JUM-PIN-POINTS.secoue { animation: jum-secoue 0.4s ease; }' +
        '@keyframes jum-secoue { 25% { transform: translateX(-8px); } 50% { transform: translateX(8px); } 75% { transform: translateX(-4px); } }' +
        '.JUM-PIN-ERREUR { color: #f87171; font-size: 0.8rem; font-weight: 700; min-height: 1.2em; margin-bottom: 12px; }' +
        '.JUM-PIN-PAVE { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }' +
        '.JUM-PIN-PAVE button { height: 60px; border-radius: 16px; border: 1px solid #333; background: #1c1c1c; color: #f5f5f5; font: 700 1.3rem Montserrat, system-ui, sans-serif; cursor: pointer; }' +
        '.JUM-PIN-PAVE button:active { background: #2a2a2a; }' +
        '.JUM-PIN .JUM-R-LIEN { color: #a3a3a3; }' +
        /* Empreinte (ou visage) : touche du pavé et bouton sur PC */
        '.JUM-PIN-PAVE button.JUM-PIN-BIO { display: flex; align-items: center; justify-content: center; color: #d6a756; border-color: rgba(214,167,86,0.45); }' +
        '.JUM-PIN-BIO svg { width: 30px; height: 30px; }' +
        '.JUM-R-BIO { display: flex; align-items: center; gap: 10px; margin: 10px 0 4px; }' +
        '.JUM-R-BIO svg { width: 26px; height: 26px; flex-shrink: 0; color: #b0802a; }' +
        /* Carte TRIGONE : carte au format CB (350 × 221 à l'échelle 1), noir et or, hologramme, recto / verso */
        '.JUM-CARTE-FEN { background: radial-gradient(120% 70% at 50% 0%, #2b2b2b, #151515 55%, #0c0c0c); padding: 0; align-items: stretch; }' +
        '.JUM-CARTE-PAGE { width: 100%; max-width: 520px; margin: 0 auto; padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 28px; color: #f5f5f5; overflow-y: auto; box-sizing: border-box; font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-CARTE-TETE { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; } .JUM-CARTE-TETE b { font-size: 1.1rem; display: block; } .JUM-CARTE-TETE small { color: #a3a3a3; font-weight: 600; font-size: 0.72rem; }' +
        '.JUM-CARTE-RET { width: 38px; height: 38px; border-radius: 50%; border: 0; background: #222; color: #d6a756; font-size: 1.4rem; line-height: 1; cursor: pointer; flex-shrink: 0; }' +
        '.JUM-CARTE-ZONE { position: relative; width: 100%; perspective: 1400px; }' +
        '.JUM-CARTE-FEN.pc .JUM-CARTE-PAGE { max-width: 860px; } .JUM-CARTE-DUO { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; margin-bottom: 22px; }' +
        '.JUM-CARTE-DUO .face { width: 350px; height: 221px; } .JUM-CARTE-FEN.pc .JUM-CARTE-BTNS { max-width: 480px; margin: 0 auto; } .JUM-CARTE-FEN.pc .JUM-CARTE-NOTE { max-width: 720px; margin-left: auto; margin-right: auto; }' +
        '.JUM-CARTE-TOURNE { position: absolute; left: 50%; top: 0; width: 350px; height: 221px; margin-left: -175px; transform-origin: top center; cursor: pointer; -webkit-tap-highlight-color: transparent; }' +
        '.JUM-CARTE-TOURNE .face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; transition: transform 0.6s cubic-bezier(.2,.8,.2,1); }' +
        '.JUM-CARTE-TOURNE .face.arriere { transform: rotateY(180deg); } .JUM-CARTE-TOURNE.verso .face.avant { transform: rotateY(-180deg); } .JUM-CARTE-TOURNE.verso .face.arriere { transform: rotateY(0); }' +
        '.JUM-CARTE { position: relative; width: 350px; height: 221px; border-radius: 16px; overflow: hidden; color: #f5f5f5; font-family: Montserrat, system-ui, sans-serif; text-align: left; box-sizing: border-box;' +
            ' background: radial-gradient(130% 120% at 0% 0%, #353026 0%, #1b1a17 45%, #0e0e0d 100%); box-shadow: 0 0 0 1px rgba(214,167,86,0.55), 0 18px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08); }' +
        '.JUM-CARTE.niv-bronze { box-shadow: 0 0 0 2px #b87333, 0 0 14px rgba(184,115,51,0.35), 0 18px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08); }' +
        '.JUM-CARTE.niv-argent { box-shadow: 0 0 0 2px #c9ced6, 0 0 16px rgba(201,206,214,0.4), 0 18px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); }' +
        '.JUM-CARTE.niv-or { box-shadow: 0 0 0 2.5px #e2b866, 0 0 22px rgba(226,184,102,0.55), 0 18px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12); animation: jum-carte-or 3.2s ease-in-out infinite alternate; }' +
        '@keyframes jum-carte-or { to { box-shadow: 0 0 0 2.5px #f1d08a, 0 0 34px rgba(241,208,138,0.75), 0 18px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12); } }' +
        '.JUM-CARTE-CHAMPS em.niv { font-style: normal; font-size: 6.5px; letter-spacing: 0.12em; padding: 1px 5px; border-radius: 99px; margin-left: 4px; vertical-align: 2px; background: rgba(214,167,86,0.18); color: #e8c27a; }' +
        '.niv-bronze .JUM-CARTE-CHAMPS em.niv { background: rgba(184,115,51,0.25); color: #e0a070; } .niv-argent .JUM-CARTE-CHAMPS em.niv { background: rgba(201,206,214,0.22); color: #e4e8ee; }' +
        '.JUM-CARTE-GUIL { position: absolute; inset: 0; opacity: 0.16; background-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2728%27 height=%2714%27%3E%3Cpath d=%27M0 7 Q7 0 14 7 T28 7%27 fill=%27none%27 stroke=%27%23d6a756%27 stroke-width=%27.6%27/%3E%3Cpath d=%27M0 11 Q7 4 14 11 T28 11%27 fill=%27none%27 stroke=%27%23d6a756%27 stroke-width=%27.35%27/%3E%3C/svg%3E"); }' +
        '.JUM-CARTE-HOLO { position: absolute; inset: 0; mix-blend-mode: screen; pointer-events: none; background: linear-gradient(115deg, transparent 30%, rgba(255,236,190,0.28) 46%, rgba(173,216,230,0.18) 52%, rgba(255,200,230,0.14) 56%, transparent 64%) no-repeat;' +
            ' background-size: 260% 100%; background-position: var(--jum-holo, 50%) 0; animation: jum-holo 7s ease-in-out infinite alternate; }' +
        'html.jum-holo-capteur .JUM-CARTE-HOLO { animation: none; transition: background-position 0.12s linear; }' +
        '@keyframes jum-holo { from { background-position: 0% 0; } to { background-position: 100% 0; } }' +
        '.JUM-CARTE-FILI { position: absolute; right: -30px; bottom: -26px; width: 210px; opacity: 0.07; filter: invert(1); }' +
        '.JUM-CARTE-HAUT { position: absolute; left: 16px; top: 12px; right: 14px; display: flex; align-items: center; gap: 8px; }' +
        '.JUM-CARTE-HAUT img { width: 30px; filter: invert(1) brightness(1.4); } .JUM-CARTE-HAUT .t { font-weight: 800; letter-spacing: 0.28em; font-size: 12px; line-height: 1; }' +
        '.JUM-CARTE-HAUT .t small { display: block; letter-spacing: 0.14em; font-size: 7.5px; color: #d6a756; margin-top: 3px; }' +
        '.JUM-CARTE-HAUT .drap { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 8px; font-weight: 800; letter-spacing: 0.12em; color: #d6a756; }' +
        '.JUM-CARTE-HAUT .drap i { display: inline-block; width: 18px; height: 12px; border-radius: 2px; background: linear-gradient(90deg, #1f3a93 33%, #fff 33% 66%, #d62828 66%); }' +
        '.JUM-CARTE-PHOTO { position: absolute; left: 16px; top: 52px; width: 82px; height: 104px; border-radius: 9px; overflow: hidden; box-shadow: 0 0 0 1.5px #d6a756, 0 6px 14px rgba(0,0,0,0.5); background: #2a2a2a; }' +
        '.JUM-CARTE-PHOTO img { width: 100%; height: 100%; object-fit: cover; display: block; }' +
        '.JUM-CARTE-PHOTO span { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 4px; color: #8a8a8a; font-size: 7.5px; text-align: center; }' +
        '.JUM-CARTE-PHOTO span svg { width: 30px; height: 30px; fill: none; stroke: #6b6b6b; stroke-width: 1.5; }' +
        '.JUM-CARTE-PUCE { position: absolute; left: 112px; top: 56px; width: 34px; height: 26px; border-radius: 5px; background: linear-gradient(135deg, #f1d08a, #b8862e); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.25); }' +
        '.JUM-CARTE-PUCE::before { content: ""; position: absolute; inset: 6px 4px; border: 1px solid rgba(0,0,0,0.28); border-radius: 3px; } .JUM-CARTE-PUCE::after { content: ""; position: absolute; left: 50%; top: 3px; bottom: 3px; border-left: 1px solid rgba(0,0,0,0.28); }' +
        '.JUM-CARTE-CHAMPS { position: absolute; left: 112px; top: 88px; right: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 10px; }' +
        '.JUM-CARTE-CHAMPS div { font-size: 10.5px; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
        '.JUM-CARTE-CHAMPS small { display: block; font-size: 6.5px; letter-spacing: 0.14em; color: #d6a756; font-weight: 700; margin-bottom: 1px; } .JUM-CARTE-CHAMPS .l { grid-column: 1 / -1; font-size: 13.5px; }' +
        '.JUM-CARTE-MRZ { position: absolute; left: 14px; right: 14px; bottom: 9px; font: 600 8.6px/1.35 "Courier New", monospace; letter-spacing: 0.09em; color: rgba(214,167,86,0.62); white-space: nowrap; overflow: hidden; }' +
        '.JUM-CARTE-BANDE { position: absolute; left: 0; right: 0; top: 20px; height: 34px; background: linear-gradient(90deg, #0b0b0b, #1c1c1c, #0b0b0b); }' +
        '.JUM-CARTE-QR { position: absolute; left: 16px; top: 66px; width: 118px; height: 118px; background: #fff; border-radius: 10px; padding: 7px; box-sizing: border-box; box-shadow: 0 0 0 1.5px #d6a756; overflow: hidden; }' +
        '.JUM-CARTE-QR img, .JUM-CARTE-QR canvas { width: 100% !important; height: 100% !important; display: block; }' +
        '.JUM-CARTE-QR span { display: flex; align-items: center; justify-content: center; height: 100%; color: #555; font-size: 8px; font-weight: 700; text-align: center; line-height: 1.4; }' +
        '.JUM-CARTE-INFO { position: absolute; left: 148px; top: 62px; right: 14px; font-size: 9.5px; line-height: 1.45; color: #d4d4d4; } .JUM-CARTE-INFO b { color: #f5f5f5; }' +
        '.JUM-CARTE-INFO .t { font-size: 7px; letter-spacing: 0.14em; color: #d6a756; font-weight: 800; margin-top: 5px; }' +
        '.JUM-CARTE-INFO .roles { display: flex; gap: 4px; flex-wrap: nowrap; margin-top: 3px; overflow: hidden; } .JUM-CARTE-INFO .roles span { font-size: 6.6px; font-weight: 800; letter-spacing: 0.04em; padding: 2px 5px; white-space: nowrap; border-radius: 99px; background: rgba(214,167,86,0.16); color: #e8c27a; box-shadow: inset 0 0 0 1px rgba(214,167,86,0.45); }' +
        '.JUM-CARTE-SIGN { position: absolute; left: 148px; right: 14px; bottom: 12px; border-top: 1px solid rgba(214,167,86,0.4); padding-top: 3px; font-size: 6.5px; letter-spacing: 0.14em; color: #8a8a8a; }' +
        '.JUM-CARTE-SIGN i { position: absolute; right: 4px; bottom: 2px; font: italic 600 14px/1 "Brush Script MT", "Segoe Script", cursive; color: #e8c27a; letter-spacing: 0; }' +
        '.JUM-CARTE-ASTUCE { text-align: center; color: #a3a3a3; font-size: 0.75rem; font-weight: 600; margin: 18px 0 18px; }' +
        '.JUM-CARTE-PAGE .JUM-R-PRINCIPAL { width: 100%; margin: 0; background: linear-gradient(180deg, #e2b866, #c99743); color: #1a1a1a; border: 0; }' +
        '.JUM-CARTE-BTNS { display: flex; gap: 10px; margin-top: 10px; } .JUM-CARTE-BTNS button { flex: 1; margin: 0; background: #1c1c1c; color: #f5f5f5; border-color: #333; }' +
        '.JUM-CARTE-NOTE { margin: 16px 0 6px; padding: 12px 14px; border-radius: 14px; background: rgba(214,167,86,0.08); box-shadow: inset 0 0 0 1px rgba(214,167,86,0.25); font-size: 0.74rem; line-height: 1.5; color: #cfcfcf; } .JUM-CARTE-NOTE b { color: #e8c27a; }' +
        '.JUM-CARTE-PAGE .JUM-R-LIEN { color: #d6a756; display: block; margin: 8px auto 0; } .JUM-CARTE-PAGE .JUM-CARTE-REVOQUER { color: #a3a3a3; font-size: 0.72rem; margin-top: 14px; }' +
        /* Plein écran : le téléphone devient la carte */
        '.JUM-NOTICE-LIVRET { display: flex; align-items: center; gap: 14px; width: 100%; margin: 0 0 14px; padding: 14px 16px; border: 1.5px solid #c9a24f; border-radius: 12px; cursor: pointer; text-align: left; background: radial-gradient(120% 140% at 20% 0%, #3b2a1c, #20160e 60%, #120c08); color: #e2b866; box-shadow: 0 6px 18px rgba(0,0,0,0.25), inset 0 0 0 4px rgba(201,162,79,0.18); font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-NOTICE-LIVRET img { width: 42px; height: 42px; flex-shrink: 0; filter: brightness(0) saturate(100%) invert(76%) sepia(43%) saturate(560%) hue-rotate(352deg) brightness(95%); }' +
        '.JUM-NOTICE-LIVRET b { display: block; font: 400 19px Georgia, serif; letter-spacing: .08em; } .JUM-NOTICE-LIVRET small { display: block; font-size: 11.5px; color: #cdb488; margin-top: 2px; line-height: 1.35; }' +
        '.JUM-NOTICE-LIVRET i { margin-left: auto; font-style: normal; font-size: 24px; color: #e2b866; }' +
        '.PC-BAS .JUM-NOTICE-LIVRET { margin: 0 0 10px; padding: 10px 12px; gap: 10px; border-radius: 10px; } .PC-BAS .JUM-NOTICE-LIVRET img { width: 30px; height: 30px; }' +
        '.PC-BAS .JUM-NOTICE-LIVRET b { font-size: 15px; } .PC-BAS .JUM-NOTICE-LIVRET small { display: none; } .PC-BAS .JUM-NOTICE-LIVRET i { font-size: 18px; }' +
        '.JUM-CARTE-PLEIN { background: #000; padding: 0; animation: none; z-index: 99997; }' +
        '.JUM-CARTE-PLEIN .JUM-CARTE-ZONE { position: absolute; left: 50%; top: 50%; width: 350px; height: 221px; perspective: 1400px; }' +
        '.JUM-CARTE-PLEIN .JUM-CARTE-TOURNE { left: 0; margin-left: 0; }' +
        '.JUM-CARTE-QUITTER { position: absolute; right: calc(14px + env(safe-area-inset-right, 0px)); top: calc(12px + env(safe-area-inset-top, 0px)); width: 36px; height: 36px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.14); color: #ddd; font-size: 1rem; cursor: pointer; z-index: 2; }' +
        /* Cadrage de la photo */
        '.JUM-CARTE-CADRE .JUM-SIG-CARTE { padding-top: 22px; } .JUM-CADRE-ZONE { margin: 4px auto 12px; width: 190px; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 2px #d6a756; touch-action: none; }' +
        '.JUM-CADRE-ZONE canvas { width: 100%; display: block; cursor: grab; } .JUM-CARTE-CADRE input[type=range] { width: 100%; accent-color: #c99743; margin-bottom: 14px; }' +
        /* Scanner */
        '.JUM-SCAN .JUM-SIG-CARTE { padding-top: 22px; } .JUM-SCAN-VUE { position: relative; width: 100%; aspect-ratio: 1; border-radius: 18px; overflow: hidden; background: radial-gradient(#3a3a3a, #141414); margin-bottom: 10px; }' +
        '.JUM-SCAN-VUE video { width: 100%; height: 100%; object-fit: cover; display: block; }' +
        '.JUM-SCAN-VUE .coins { position: absolute; left: 22%; top: 22%; right: 22%; bottom: 22%; } .JUM-SCAN-VUE .coins b { position: absolute; width: 28px; height: 28px; border: 3px solid #d6a756; }' +
        '.JUM-SCAN-VUE .coins b:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; } .JUM-SCAN-VUE .coins b:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; border-radius: 0 8px 0 0; }' +
        '.JUM-SCAN-VUE .coins b:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; border-radius: 0 0 0 8px; } .JUM-SCAN-VUE .coins b:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }' +
        '.JUM-SCAN-VUE .laser { position: absolute; left: 24%; right: 24%; top: 50%; height: 2px; background: #d6a756; box-shadow: 0 0 12px #d6a756; animation: jum-laser 1.8s ease-in-out infinite alternate; }' +
        '@keyframes jum-laser { from { top: 26%; } to { top: 74%; } }' +
        '.JUM-SCAN-ETAT { position: absolute; left: 0; right: 0; bottom: 10px; text-align: center; color: #fff; font-size: 0.75rem; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.8); padding: 0 10px; }' +
        '.JUM-SCAN-RES div { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 10px; margin-bottom: 6px; font-size: 0.78rem; text-align: left; background: rgba(34,197,94,0.1); }' +
        '.JUM-SCAN-RES div.deja { background: rgba(214,167,86,0.12); } .JUM-SCAN-RES span { color: #15803d; font-weight: 700; white-space: nowrap; } .JUM-SCAN-RES div.deja span { color: #9a6f22; }' +
        '.JUM-SCAN-MAIN { text-align: left; font-size: 0.75rem; margin-bottom: 12px; color: #64748b; } .JUM-SCAN-MAIN summary { cursor: pointer; font-weight: 700; }' +
        '.JUM-SCAN-MAIN div { display: flex; gap: 8px; margin-top: 8px; } .JUM-SCAN-MAIN input { flex: 1; min-width: 0; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; padding: 0 10px; font: inherit; }' +
        '.JUM-SCAN-MAIN button { margin: 0; flex: 0 0 auto; }' +
        '.JUM-SCAN-ENV { position: relative; display: block; } .JUM-SCAN-ENV input { padding-right: 48px !important; width: 100%; box-sizing: border-box; }' +
        '.JUM-SCAN-CHAMP { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 10px; border: 0; background: rgba(214,167,86,0.14); color: #9a6f22; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }' +
        '.JUM-SCAN-CHAMP svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        'html body.dark-mode .JUM-SCAN-CHAMP { color: #e0b86a; }' +
        /* Page de vérification d'une carte (QR code lu avec l'appareil photo) */
        '.JUM-VERIF { position: fixed; inset: 0; z-index: 99998; display: flex; align-items: center; justify-content: center; padding: 16px; background: radial-gradient(120% 70% at 50% 0%, #2b2b2b, #151515 55%, #0c0c0c); font-family: Montserrat, system-ui, sans-serif; color: #f5f5f5; }' +
        '.JUM-VERIF-CARTE { width: 100%; max-width: 380px; text-align: center; } .JUM-VERIF-CARTE img { width: 64px; filter: invert(1) brightness(1.4); }' +
        '.JUM-VERIF-NOM { font-weight: 800; letter-spacing: 0.32em; margin: 6px 0 0 0.32em; } .JUM-VERIF-SOUS { color: #d6a756; font-size: 0.78rem; font-weight: 700; margin: 4px 0 24px; }' +
        '.JUM-VERIF-RES { border-radius: 18px; padding: 20px 16px; margin-bottom: 20px; background: #1c1c1c; display: flex; flex-direction: column; gap: 6px; }' +
        '.JUM-VERIF-RES b { font-size: 1.05rem; } .JUM-VERIF-RES .qui { font-size: 1.2rem; font-weight: 800; color: #f5f5f5; } .JUM-VERIF-RES span { color: #cfcfcf; font-size: 0.85rem; } .JUM-VERIF-RES small { color: #8a8a8a; margin-top: 6px; }' +
        '.JUM-VERIF-RES.ok { box-shadow: inset 0 0 0 1.5px rgba(34,197,94,0.6); } .JUM-VERIF-RES.ok b { color: #22c55e; } .JUM-VERIF-RES.ko { box-shadow: inset 0 0 0 1.5px rgba(239,68,68,0.6); } .JUM-VERIF-RES.ko b { color: #ef4444; }' +
        '.JUM-VERIF .JUM-R-PRINCIPAL { width: 100%; background: linear-gradient(180deg, #e2b866, #c99743); color: #1a1a1a; border: 0; }' +
        /* Empreinte façon TRIGONE (téléphone) : phénix, grande empreinte dorée qui respire ; verte reconnue, rouge refusée. */
        '.JUM-PIN.bio { background: radial-gradient(90% 55% at 50% 24%, #2b2b2b, #151515 60%, #0c0c0c); }' +
        '.JUM-BIOV-LOGO { width: 54px; height: 54px; object-fit: contain; filter: invert(1) brightness(1.4); opacity: 0.92; display: block; margin: 0 auto; }' +
        '.JUM-BIOV-NOM { font-weight: 800; letter-spacing: 0.32em; font-size: 0.86rem; margin: 6px 0 0 0.32em; color: #f5f5f5; }' +
        '.JUM-BIOV-ROND { position: relative; width: 150px; height: 150px; margin: 38px auto 0; padding: 0; border: 0; background: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: width 0.25s, height 0.25s, margin 0.25s; }' +
        '.JUM-BIOV-ROND::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(214,167,86,0.3), rgba(214,167,86,0) 70%); animation: jum-respire 2.4s ease-in-out infinite; }' +
        '.JUM-BIOV-ROND::after { content: ""; position: absolute; inset: 8px; border-radius: 50%; border: 2px solid rgba(214,167,86,0.5); }' +
        '.JUM-BIOV-ROND svg { position: relative; width: 84px; height: 84px; color: #d6a756; transition: color 0.25s; }' +
        '@keyframes jum-respire { 0%, 100% { transform: scale(0.92); opacity: 0.75; } 50% { transform: scale(1.06); opacity: 1; } }' +
        '.JUM-BIOV-T1 { font-size: 1.22rem; font-weight: 800; margin-top: 26px; color: #f5f5f5; } .JUM-BIOV-T1 span { color: #d6a756; }' +
        '.JUM-PIN-CARTE .JUM-BIOV-T2 { font-size: 0.84rem; color: #b5b5b5; margin: 8px 0 12px; }' +
        '.JUM-PIN.bio .JUM-BIOV-CODE { display: none; } .JUM-PIN.bio.code .JUM-BIOV-CODE { display: block; margin-top: 4px; }' +
        '.JUM-PIN.bio.code .JUM-BIOV-ROND { width: 96px; height: 96px; margin-top: 16px; } .JUM-PIN.bio.code .JUM-BIOV-ROND svg { width: 54px; height: 54px; }' +
        '.JUM-PIN.bio.code .JUM-BIOV-T1, .JUM-PIN.bio.code .JUM-BIOV-T2, .JUM-PIN.bio.code .JUM-BIOV-VERS { display: none; }' +
        '.JUM-PIN.bio.ok .JUM-BIOV-ROND::before { background: radial-gradient(circle, rgba(34,197,94,0.34), rgba(34,197,94,0) 70%); animation: none; } .JUM-PIN.bio.ok .JUM-BIOV-ROND::after { border-color: rgba(34,197,94,0.65); } .JUM-PIN.bio.ok .JUM-BIOV-ROND svg, .JUM-PIN.bio.ok .JUM-BIOV-T1 span { color: #22c55e; }' +
        '.JUM-PIN.bio.ko .JUM-BIOV-ROND::before { background: radial-gradient(circle, rgba(239,68,68,0.3), rgba(239,68,68,0) 70%); animation: none; } .JUM-PIN.bio.ko .JUM-BIOV-ROND::after { border-color: rgba(239,68,68,0.65); } .JUM-PIN.bio.ko .JUM-BIOV-ROND svg { color: #ef4444; }' +
        '.JUM-PIN.bio .JUM-PIN-ERREUR { margin-top: 10px; } .JUM-PIN.bio .JUM-R-LIEN.JUM-BIOV-VERS { color: #d6a756; font-weight: 700; }' +
        '.JUM-PIN.bio.ok .JUM-BIOV-VERS { visibility: hidden; }' +
        '.JUM-PIN.bio.sortie { opacity: 0; transition: opacity 0.3s ease 0.35s; }' +
        /* Cartes d'activation (avant puis après la fenêtre du téléphone) */
        '.JUM-BIOC .JUM-SIG-CARTE { padding-top: 26px; } .JUM-BIOC.fait .JUM-SIG-CARTE { padding-top: 132px; }' +
        '.JUM-BIOC-ROND { position: relative; width: 112px; height: 112px; margin: 0 auto 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, rgba(214,167,86,0.24), rgba(214,167,86,0) 70%); box-shadow: inset 0 0 0 2px rgba(214,167,86,0.5); color: #b0802a; }' +
        '.JUM-BIOC-ROND svg { width: 62px; height: 62px; } .JUM-BIOC.fait .JUM-BIOC-ROND { width: 64px; height: 64px; margin-bottom: 10px; background: rgba(34,197,94,0.12); box-shadow: inset 0 0 0 2px rgba(34,197,94,0.5); color: #16a34a; } .JUM-BIOC.fait .JUM-BIOC-ROND svg { width: 36px; height: 36px; }' +
        '.JUM-BIOC-ERR { color: #dc2626; font-size: 0.8rem; font-weight: 700; min-height: 1.1em; margin: -6px 0 10px; }' +
        'html body.dark-mode .JUM-BIOC-ROND { color: #d6a756; } html body.dark-mode .JUM-BIOC.fait .JUM-BIOC-ROND { color: #22c55e; }' +
        /* Code d'accès — présentation PC */
        '.JUM-PIN-PC { background: linear-gradient(135deg, #f7f7f5 0%, #ecebe7 100%); }' +
        '.JUM-PINPC { display: grid; grid-template-columns: 1fr 1.1fr; width: 100%; max-width: 820px; min-height: 460px; background: #fff; border-radius: 26px; overflow: hidden; box-shadow: 0 30px 80px rgba(26,45,62,0.18), 0 2px 6px rgba(26,45,62,0.06); color: #1a1a1a; }' +
        '.JUM-PINPC-MARQUE { background: #1a1a1a; color: #fff; padding: 40px 36px; display: flex; flex-direction: column; align-items: flex-start; position: relative; }' +
        '.JUM-PINPC-MARQUE::after { content: ""; position: absolute; inset: 0; background: linear-gradient(160deg, rgba(214,167,86,0.22), transparent 55%); pointer-events: none; }' +
        '.JUM-PINPC-MARQUE img { width: 74px; height: 74px; object-fit: contain; filter: invert(1) brightness(1.4); opacity: 0.95; }' +
        '.JUM-PINPC-NOM { margin-top: 18px; font-size: 1.7rem; font-weight: 800; letter-spacing: 0.22em; }' +
        '.JUM-PINPC-SOUS { margin-top: 6px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #e0b86a; }' +
        '.JUM-PINPC-DATE { margin-top: auto; display: flex; flex-direction: column; gap: 2px; }' +
        '.JUM-PINPC-DATE b { font-size: 2.6rem; font-weight: 800; letter-spacing: 0.02em; }' +
        '.JUM-PINPC-DATE span { font-size: 0.82rem; color: #c7d4de; text-transform: capitalize; }' +
        '.JUM-PINPC-NOTE { margin-top: 22px; display: flex; align-items: center; gap: 8px; font-size: 0.72rem; color: #e0b86a; }' +
        '.JUM-PINPC-NOTE svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PINPC-SAISIE { padding: 44px 44px 30px; display: flex; flex-direction: column; align-items: center; text-align: center; }' +
        '.JUM-PINPC-IC { width: 56px; height: 56px; padding: 14px; box-sizing: border-box; border-radius: 18px; background: rgba(214,167,86,0.1); color: #9a6f22; }' +
        '.JUM-PINPC-IC svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PINPC-SAISIE h2 { margin: 16px 0 6px; font-size: 1.3rem; font-weight: 800; }' +
        '.JUM-PINPC-SAISIE p { margin: 0 0 24px; font-size: 0.85rem; color: #9a6f22; }' +
        '.JUM-PIN-PC .JUM-PIN-POINTS { gap: 14px; margin-bottom: 8px; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT { width: 54px; height: 62px; border-radius: 14px; border: 1.5px solid #c9d6e0; background: #f7f7f5; position: relative; transition: border-color 0.15s ease, box-shadow 0.15s ease; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT.plein { background: #f7f7f5; border-color: #1a1a1a; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT.plein::after { content: ""; position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #1a1a1a; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT.actif { border-color: #9a6f22; box-shadow: 0 0 0 4px rgba(214,167,86,0.15); }' +
        '.JUM-PIN-PC .JUM-PIN-ERREUR { color: #b91c1c; margin: 6px 0 4px; }' +
        '.JUM-PINPC-AIDE { font-size: 0.72rem; color: #7b8e9d; margin-bottom: 16px; }' +
        '.JUM-PINPC-AIDE span { display: inline-block; padding: 1px 7px; border: 1px solid #c9d6e0; border-bottom-width: 2px; border-radius: 6px; font-weight: 700; color: #9a6f22; background: #fff; }' +
        '.JUM-PIN-PC .JUM-PIN-PAVE { width: 100%; max-width: 250px; gap: 8px; margin-bottom: 12px; }' +
        '.JUM-PIN-PC .JUM-PIN-PAVE button { height: 42px; border-radius: 11px; border: 1px solid #dde6ee; background: #fff; color: #1a1a1a; font-size: 1rem; }' +
        '.JUM-PIN-PC .JUM-PIN-PAVE button:hover { background: #F2F7FB; border-color: #c9d6e0; }' +
        '.JUM-PIN-PC .JUM-R-LIEN { color: #9a6f22; }' +
        '.JUM-PIN-PC.sombre { background: linear-gradient(135deg, #0f1418 0%, #172029 100%); }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC { background: #1b242c; color: #e8eef3; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC-MARQUE { background: #0c1115; }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC-SAISIE p, .JUM-PIN-PC.sombre .JUM-R-LIEN { color: #e0b86a; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-POINT { background: #141b21; border-color: #33424f; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-POINT.plein { background: #141b21; border-color: #e8eef3; } .JUM-PIN-PC.sombre .JUM-PIN-POINT.plein::after { background: #e8eef3; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-PAVE button { background: #141b21; border-color: #2a3640; color: #e8eef3; }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC-AIDE span { background: #141b21; border-color: #33424f; color: #e0b86a; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-ERREUR { color: #f87171; }' +
        '.JUM-TRAIT { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; transition: opacity 0.2s ease; }' +
        '.JUM-CHOIX.choisi .JUM-TRAIT { opacity: 0; }' +
        '@media (prefers-reduced-motion: reduce) { .JUM-PAN, .JUM-BLOC { transition-duration: 0.01s; } }' +
        /* ===== Thème noir et or (Mise en route, Compte-rendu, espaces valideur et Chorus DT) =====
           Accueil et menu PC sur fond noir, accents or ; les cartes de saisie restent claires pour la lecture. */
        'html body .MER-P0-SHELL, html body .P0-SHELL { background: radial-gradient(90% 60% at 50% 16%, #2b2b2b 0%, #161616 58%, #0c0c0c 100%) !important; color: #f5f5f5; border: 0; border-top: 2px solid #d6a756; box-shadow: 0 18px 50px rgba(0,0,0,0.35); }' +
        'html body .MER-LOGO-IMG, html body #P0 .welcome-logo { filter: brightness(0) invert(0.95); }' +
        'html body .MER-P0-SHELL .BTN-ACCUEIL:not(.BTN-ACCUEIL-PETIT), html body .P0-SHELL .P0-HERO .BTN-ACCUEIL { background: linear-gradient(180deg, #e2b866, #c99743) !important; color: #1a1a1a !important; box-shadow: 0 12px 30px rgba(214,167,86,0.25) !important; }' +
        'html body .MER-P0-SHELL .BTN-ACCUEIL-PETIT { background: transparent !important; color: #f5f5f5 !important; border: 1.5px solid rgba(255,255,255,0.25) !important; box-shadow: none !important; }' +
        'html body .MER-P0-SHELL .P0-TAB, html body .P0-SHELL .P0-TAB { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.12) !important; color: #e5e5e5 !important; box-shadow: none !important; }' +
        'html body .MER-P0-SHELL .P0-TAB-ICON, html body .P0-SHELL .P0-TAB-ICON { background: rgba(214,167,86,0.12) !important; border-color: rgba(214,167,86,0.3) !important; color: #e0b86a !important; }' +
        'html body .MER-P0-SHELL .JUM-BONJOUR, html body .P0-SHELL .JUM-BONJOUR { color: #a9a9a9; } html body .MER-P0-SHELL .JUM-BONJOUR b, html body .P0-SHELL .JUM-BONJOUR b { color: #e0b86a; }' +
        'html body .MER-P0-SHELL .app-credit, html body .P0-SHELL .app-credit, html body .MER-P0-SHELL [class*="CREDIT"], html body .P0-SHELL [class*="CREDIT"] { color: #8a8a8a !important; }' +
        'html body .MER-P0-SHELL .P0-LIEN, html body .MER-P0-SHELL a, html body .MER-P0-SHELL .LIEN-ACCUEIL, html body .P0-SHELL a, html body .P0-SHELL button:not(.BTN-ACCUEIL):not(.P0-TAB) { color: #e5e5e5; }' +
        /* Bordure haute des cartes : or */
        'html body .CARD:not(#MER-P0):not(#P0) { border-top-color: #d6a756; }' +
        /* Menu PC : noir, onglet actif or */
        '@media (min-width: 1100px) { html body .PC-MENU { background: radial-gradient(120% 50% at 30% 0, #2b2b2b, #141414 60%, #0c0c0c) !important; border-right: 0 !important; color: #e5e5e5; }' +
            ' html body .PC-MARQUE { border-bottom-color: rgba(255,255,255,0.1); } html body .PC-MARQUE img { filter: brightness(0) invert(0.95); }' +
            ' html body .PC-NAV, html body .PC-LIEN { color: #d4d4d4; } html body .PC-NAV:hover, html body .PC-LIEN:hover { background: rgba(255,255,255,0.06); }' +
            ' html body .PC-NAV.actif { background: linear-gradient(180deg, #e2b866, #c99743) !important; color: #1a1a1a !important; }' +
            ' html body .PC-SEP { background: rgba(255,255,255,0.1); } html body .PC-PIED { color: #777; }' +
            ' html body .PC-BASCULE { color: #e5e5e5; border-color: rgba(255,255,255,0.14); } html body .PC-BASCULE img { filter: brightness(0) invert(0.92); opacity: 1; }' +
            ' html body .PC-MENU .JUM-CPT { background: rgba(255,255,255,0.06); color: #f5f5f5; border-color: rgba(255,255,255,0.14); }' +
            ' html body .PC-HERO { background: radial-gradient(80% 140% at 15% 0, #2b2b2b, #151515 60%, #0c0c0c) !important; color: #f5f5f5 !important; border: 0 !important; }' +
            ' html body .PC-HERO .PC-HERO-LOGO { filter: brightness(0) invert(0.95); } html body .PC-HERO p, html body .PC-HERO span, html body .PC-HERO div { color: inherit; }' +
            ' html body .PC-HERO .PC-BTN-CLAIR { background: transparent !important; color: #e5e5e5 !important; border-color: rgba(255,255,255,0.18) !important; } html body .PC-HERO .BTN-ACCUEIL:first-of-type, html body .PC-HERO .BTN-PRIMARY, html body .PC-HERO .BTN-START { background: linear-gradient(180deg, #e2b866, #c99743) !important; color: #1a1a1a !important; }' +
        ' }' +
        '';
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    // ---------- Mise à jour forcée ----------
    // À chaque publication, augmenter BUILD ici ET dans build.json (même numéro), avec la version de chaque appli.
    // Dès l'ouverture (démarrage ou retour dans l'appli), TRIGONE vérifie s'il existe une publication plus récente
    // et se met à jour tout seul. Jamais au mauvais moment : uniquement sur l'accueil, sans fenêtre ouverte
    // (chaque appli le dit via JUMELAGE_PEUT_RECHARGER) ; sinon au prochain retour sur l'accueil.
    var BUILD = 195, MAJ_DISPO = false, CLE_RECHARGE = 'trigone_recharge_build';
    function peutRecharger() {
        if (document.visibilityState === 'hidden') return false;
        if (document.body && document.body.classList.contains('demo-active')) return false;
        if (ecran && !ecran.classList.contains('choisi')) return true;     // écran de choix affiché
        try { return !!(window.JUMELAGE_PEUT_RECHARGER && window.JUMELAGE_PEUT_RECHARGER()); } catch (e) { return false; }
    }
    function tenterMaj() {
        if (!MAJ_DISPO || !peutRecharger()) return;
        // Garde-fou : le serveur peut encore servir l'ancienne version quelques minutes après une publication ;
        // on ne relance pas en boucle, au plus une tentative toutes les 45 secondes.
        try {
            var t = +sessionStorage.getItem(CLE_RECHARGE) || 0;
            if (Date.now() - t < 45000) return;
            sessionStorage.setItem(CLE_RECHARGE, String(Date.now()));
        } catch (e) {}
        try { if (window.JUMELAGE_AVANT_RECHARGE) window.JUMELAGE_AVANT_RECHARGE(); } catch (e) {}
        // Après la mise à jour, TRIGONE rouvre sur l'écran de choix (et non dans l'appli en cours).
        try { sessionStorage.setItem('trigone_apres_maj', '1'); sessionStorage.removeItem(CLE_CHOIX_FAIT); } catch (e) {}
        var voile = document.createElement('div');
        voile.className = 'JUM-MAJ';
        voile.innerHTML = '<div class="JUM-MAJ-ROND"></div><div>Mise à jour de TRIGONE…</div>';
        document.body.appendChild(voile);
        var fin = function() { location.reload(); };
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
            navigator.serviceWorker.getRegistration().then(function(r) { return r && r.update(); }).catch(function() {}).then(function() { setTimeout(fin, 150); });
            setTimeout(fin, 2500);
        } else setTimeout(fin, 300);
    }
    window.JUMELAGE_MAJ_DISPONIBLE = function() { MAJ_DISPO = true; tenterMaj(); };
    function verifierPublication() {
        if (!navigator.onLine) return;
        if (MAJ_DISPO) { tenterMaj(); return; }
        var url = (/\/cr\/(index\.html)?$/.test(location.pathname) ? '../' : '') + 'build.json?t=' + Date.now();
        fetch(url, { cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
            if (d && d.build > BUILD) window.JUMELAGE_MAJ_DISPONIBLE();
        }).catch(function() {});
    }
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') verifierPublication();
    });
    window.addEventListener('online', verifierPublication);
    window.addEventListener('load', function() { setTimeout(verifierPublication, 800); });
    // Une mise à jour en attente s'applique dès que l'on revient sur l'accueil.
    setInterval(function() { if (MAJ_DISPO) tenterMaj(); }, 2000);

    // ---------- Écran de choix ----------
    var DANS_CR = /\/cr\/(index\.html)?$/.test(location.pathname);
    var APPLIS = {
        mer: { url: DANS_CR ? '../' : './', logo: (DANS_CR ? '../' : '') + 'logo_mer.webp', nom: 'TRIGONE Mise en route', sous: 'Avant le départ' },
        cr: { url: DANS_CR ? './' : 'cr/', logo: (DANS_CR ? '' : 'cr/') + 'logo_cr_accueil.png', nom: 'TRIGONE Compte-rendu de mission', sous: 'Au retour de mission' }
    };
    var ICI = DANS_CR ? 'cr' : 'mer', CLE_CHOIX = 'trigone_choix_fait';
    // ---------- Logo tricolore des PDF (Mise en route, Compte-rendu, récapitulatifs) ----------
    // Le phénix et la vague tricolore, sans le mot TRIGONE (logo-pdf.webp, en cache pour le hors ligne), réduit en JPEG
    // léger ; posé dans une vignette blanche, centré au-dessus du mot « TRIGONE » du bandeau. Pas encore chargé : pas de logo.
    var logoPdf = null, logoRatio = 1;
    (function chargerLogoPdf() {
        var img = new Image();
        img.onload = function() {
            try {
                var w = 300, h = Math.round(300 * img.naturalHeight / img.naturalWidth);
                var c = document.createElement('canvas'); c.width = w; c.height = h;
                var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
                logoPdf = c.toDataURL('image/jpeg', 0.9); logoRatio = w / h;
            } catch (e) {}
        };
        img.src = (DANS_CR ? '../' : '') + 'logo-pdf.webp';
    })();
    window.JUMELAGE_LOGO_PRET = function() { return !!logoPdf; };
    // Style noir et or des PDF, économe en encre : les en-têtes de tableaux sont soulignés d'un trait noir (pas d'aplat).
    window.JUMELAGE_PDF_STYLE = function(doc) {
        if (!doc || typeof doc.autoTableSetDefaults !== 'function') return;
        doc.autoTableSetDefaults({ didDrawCell: function(d) {
            if (d.section !== 'head' || d.cell.styles.fillColor) return;
            var k = doc.internal.scaleFactor || 1;
            doc.setDrawColor(26, 26, 26); doc.setLineWidth(1.1 / k);
            doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
        } });
    };
    // cx : centre horizontal (celui du mot TRIGONE) ; y : haut de la vignette ; h : sa hauteur.
    window.JUMELAGE_LOGO_PDF = function(doc, cx, y, h) {
        if (!logoPdf) return false;
        try {
            var bord = h * 0.08, hi = h - 2 * bord, wi = hi * logoRatio, w = wi + 2 * bord;
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(cx - w / 2, y, w, h, h * 0.14, h * 0.14, 'F');
            doc.addImage(logoPdf, 'JPEG', cx - wi / 2, y + bord, wi, hi, 'trigone-logo', 'FAST');
            return true;
        } catch (e) { return false; }
    };
    // ---------- Remontée des erreurs ----------
    // Une erreur technique (bug) est envoyée au serveur, anonyme : version, appli, écran, message et emplacement dans
    // le code, type d'appareil. Jamais de nom, de mail ni de donnée de mission : adresses mail, suites de chiffres
    // et textes entre guillemets sont masqués. 5 envois au plus par ouverture, une fois par erreur.
    var erreursVues = {}, erreursEnvoyees = 0;
    function masquer(t) {
        return String(t || '').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<mail>').replace(/(["'«])[^"'»]{12,}(["'»])/g, '$1…$2').replace(/\d[\d \-.,/]{3,}\d/g, '#');
    }
    function localiser(src) { return String(src || '').replace(location.origin, '').replace(/\?[^:\s)]*/g, ''); }
    function appareilAnonyme() {
        var id = lireTxt('trigone_appareil_anonyme');
        if (!id) { id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); ecrireTxt('trigone_appareil_anonyme', id); }
        return id;
    }
    function typeAppareil() {
        var u = navigator.userAgent || '';
        var sys = /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS/.test(u) ? 'Mac' : 'Autre';
        var nav = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung' : /Firefox\//.test(u) ? 'Firefox' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
        return sys + (nav ? ' · ' + nav : '') + (window.matchMedia && matchMedia('(display-mode: standalone)').matches ? ' · appli' : '');
    }
    function ecranActuel() {
        if (document.querySelector('.JUM-CHOIX')) return 'Écran de choix';
        try { if (DANS_CR && window.GET_LABEL_ECRAN_ACTUEL) return 'Compte-rendu › ' + window.GET_LABEL_ECRAN_ACTUEL(); } catch (e) {}
        var NOMS = { ACCUEIL: 'Accueil', FORMULAIRE: 'Formulaire de demande', PANIER: 'Documents', BIBLIOTHEQUE: 'Bibliothèque', RECEPTION: 'Boîte de réception',
            VALIDATION: 'Espace valideur', CHORUS: 'Espace Assistant Chorus DT', ESPACE: 'Mon espace', NOTICE: 'Notice', REFERENCES: 'Références', REPRISE: 'Reprise', VERIFIER: 'Vérifier un PDF' };
        try { if (!DANS_CR && typeof window.PAGE_ACTUELLE === 'string') return 'Mise en route › ' + (NOMS[window.PAGE_ACTUELLE] || window.PAGE_ACTUELLE); } catch (e) {}
        return DANS_CR ? 'Compte-rendu' : 'Mise en route';
    }
    function remonterErreur(msg, src, pile) {
        msg = masquer(msg).slice(0, 300);
        if (!msg || /^Script error\.?$/i.test(msg) || /ResizeObserver loop/i.test(msg)) return;   // extensions, bruit du navigateur
        src = localiser(src);
        if (src && /^(chrome|moz|safari)-extension:/.test(src)) return;
        var cle = msg + '|' + src;
        if (erreursVues[cle] || erreursEnvoyees >= 5 || /[?&]demo=/.test(location.search)) return;
        erreursVues[cle] = true; erreursEnvoyees++;
        try {
            fetch((DANS_CR ? '../' : '') + 'api/erreur', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app: document.querySelector('.JUM-CHOIX') ? 'choix' : ICI, ecran: ecranActuel(), msg: msg, src: src,
                    pile: masquer(localiser(pile)).split('\n').slice(0, 6).join('\n'), v: BUILD, ua: typeAppareil(), appareil: appareilAnonyme() }) }).catch(function() {});
        } catch (e) {}
    }
    window.addEventListener('error', function(e) {
        if (!e || e.target !== window && e.target && e.target.tagName) return;   // image ou script qui ne charge pas : pas un bug
        remonterErreur(e.message, (e.filename || '') + (e.lineno ? ':' + e.lineno + ':' + (e.colno || 0) : ''), e.error && e.error.stack);
    });
    window.addEventListener('unhandledrejection', function(e) {
        var r = e && e.reason;
        // Réseau coupé, serveur injoignable : pas un bug de l'appli.
        if (!r || /Failed to fetch|NetworkError|Load failed|network|abort/i.test(String(r.message || r))) return;
        if (r.statut) return;   // refus du serveur déjà expliqué à l'utilisateur
        remonterErreur('Promesse rejetée : ' + (r.message || String(r)), '', r.stack);
    });
    window.JUMELAGE_REMONTER_ERREUR = remonterErreur;
    // Rôle « Assistant Chorus DT » : activé dans les Réglages avec le code remis par l'administrateur (seule son
    // empreinte figure ici). Son espace s'ouvre depuis le logo placé au centre de l'écran de choix.
    var CLE_ROLE_ADMIN = 'trigone_role_admin', CLE_ROLE_CHORUS = 'trigone_role_chorus', EMPREINTE_CODE_CHORUS = '1873312e8bec44f88043df4b267191cf334946fa92ae71e40c3d3d4867c9e49a';
    var LOGO_CHORUS = (DANS_CR ? '../' : '') + 'logo_chorus.webp';
    function roleChorus() { try { return localStorage.getItem(CLE_ROLE_CHORUS) === '1'; } catch (e) { return false; } }
    window.JUMELAGE_ROLE_CHORUS = roleChorus;
    // Administrateur de l'unité (toujours assistant Chorus DT) : « ADMINISTRATEUR » sous le logo Assist Chorus-DT.
    window.JUMELAGE_ROLE_ADMIN = function() { return !!lireTxt(CLE_ROLE_ADMIN); };
    function empreinteCodeChorus(code) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode('TRIGONE-CHORUS:' + String(code || '').trim().toUpperCase())).then(function(b) {
            return Array.prototype.map.call(new Uint8Array(b), function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        });
    }
    // Ouvre l'espace Assistant Chorus DT (Mise en route, page dédiée).
    window.JUMELAGE_OUVRIR_CHORUS = function() {
        try { sessionStorage.setItem(CLE_CHOIX, '1'); } catch (e) {}
        if (!DANS_CR && typeof window.MER_OUVRIR_CHORUS === 'function') { window.MER_OUVRIR_CHORUS(); return true; }
        try { sessionStorage.setItem(CLE_BASCULE, '1'); } catch (e) {}
        location.replace(APPLIS.mer.url + '?espace=chorus');
        return false;
    };
    var ecran = null;
    // Bouton clair / sombre : symboles au trait, comme les autres icônes de TRIGONE (lune en clair, soleil en sombre).
    var LUNE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>';
    var SOLEIL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
    window.JUMELAGE_ICONE_THEME = function(sombre) { return sombre ? SOLEIL_SVG : LUNE_SVG; };
    function iconesTheme() {
        var sombre = document.body && document.body.classList.contains('dark-mode');
        Array.prototype.forEach.call(document.querySelectorAll('.THEME-TOGGLE'), function(b) {
            if (b.getAttribute('data-icone') === (sombre ? 's' : 'l')) return;
            b.innerHTML = sombre ? SOLEIL_SVG : LUNE_SVG; b.setAttribute('data-icone', sombre ? 's' : 'l');
            b.setAttribute('aria-label', sombre ? 'Passer en mode clair' : 'Passer en mode sombre'); b.title = sombre ? 'Mode clair' : 'Mode sombre';
        });
    }
    // Les applis changent le thème de leur côté : l'icône suit toute bascule de la classe dark-mode.
    function suivreTheme() {
        iconesTheme();
        if (window.MutationObserver) new MutationObserver(iconesTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    if (document.body) suivreTheme(); else document.addEventListener('DOMContentLoaded', suivreTheme);
    var CORBEILLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
    var ROUE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>';
    // ---------- Réglages TRIGONE communs (roue crantée de l'écran de choix) ----------
    // Identité, mail du 1er valideur, mon mail, mail de l'assistant Chorus DT et code d'accès : saisis une seule
    // fois ici, pour Mise en route ET Compte-rendu. Recopiés dans le stockage propre à chaque appli, qui les lit
    // comme avant. (Le mail du 2e valideur reste réglé par le 1er valideur, dans son espace.)
    var CLE_REGLAGES = 'trigone_reglages_communs', CLE_CODE = 'trigone_code_commun';
    function lireJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function lireTxt(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function ecrireTxt(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    // Toujours relus dans le stockage des applis : une identité modifiée dans l'une d'elles (écran Départ du
    // compte-rendu, par exemple) apparaît ici à jour. Les réglages communs enregistrés complètent les manques.
    function lireReglages() {
        var s = lireJSON(CLE_REGLAGES) || {};
        var mer = lireJSON('mer_reglages') || {}, id = mer.identite || {}, cr = lireJSON('trigone_app_settings') || {};
        var nomCr = lireTxt('mission_saved_user').split(/\s+/);
        var d = {
            unite: id.unite || mer.derniereUnite || cr.unitName || '', cie: id.cie || mer.derniereCie || lireTxt('mission_saved_cie'),
            grade: id.grade || lireTxt('mission_saved_grade'), nom: id.nom || nomCr[0] || '', prenom: id.prenom || nomCr.slice(1).join(' '),
            matricule: id.matricule || lireTxt('mission_saved_nid'),
            mailVal1: mer.mailSignataire || '', monMail: mer.mailDemandeur || '', mailChorus: cr.mailAssist || '',
            // Option « Demande de réservation » (hébergement / transport) : réglage de Compte-rendu, commun aux deux applis.
            resaActive: cr.abtEnabled !== false, resaLibelle: cr.abtLabel && cr.abtLabel !== 'ABT' && cr.abtLabel !== RESA_DEFAUT ? cr.abtLabel : ''
        };
        Object.keys(s).forEach(function(k) { if (!d[k] && s[k] && k !== 'resaActive' && k !== 'resaLibelle') d[k] = s[k]; });
        return d;
    }
    // « GRADE NOM Prénom » des Réglages TRIGONE : le « Bonjour » des accueils (PC et téléphone, les deux applis).
    var RESA_DEFAUT = 'Demande de réservation';
    // Option « Demande de réservation » : { active, libelle } (libellé choisi par l'unité, sinon « Demande de réservation »).
    window.JUMELAGE_RESA = function() { var r = lireReglages(); return { active: r.resaActive !== false, libelle: r.resaLibelle || RESA_DEFAUT, defaut: !r.resaLibelle }; };
    window.JUMELAGE_REGLAGES_LIRE = function() { return lireReglages(); };
    // Unités reconnues par TRIGONE, avec leur(s) centre(s) de coût dans le codier FD (codes de l'unité en vert, les autres en jaune).
    // Tirée du codier (juillet 2026) : sécurité civile, régiments et états-majors de l'armée de terre (« … PR UO PRÉPA OPS »),
    // bases aériennes, bases navales. Le champ « Unité » du profil se choisit dans cette liste.
    var UNITES = [
        {"nom": "COMFORMISC", "arme": "Sécurité civile", "cc": ["SC0FMSC092"]},
        {"nom": "1°RIISC", "arme": "Sécurité civile", "cc": ["SC5FMU1028"], "codier": "UIISC n°1"},
        {"nom": "4°RIISC", "arme": "Sécurité civile", "cc": ["SC5FMU4033"], "codier": "UIISC n°4"},
        {"nom": "5°RIISC", "arme": "Sécurité civile", "cc": ["SC5FMU502B"], "codier": "UIISC n°5"},
        {"nom": "7°RIISC", "arme": "Sécurité civile", "cc": ["SC5FMU7013"], "codier": "UIISC n°7"},
        {"nom": "7°BCA", "arme": "Armée de terre", "cc": ["D1710CU038"]},
        {"nom": "13°BCA", "arme": "Armée de terre", "cc": ["D1710CW073"]},
        {"nom": "27°BCA", "arme": "Armée de terre", "cc": ["D1710CY074"]},
        {"nom": "BCS BFA", "arme": "Armée de terre", "cc": ["D1710IM991"]},
        {"nom": "13°DBLE", "arme": "Armée de terre", "cc": ["D1719X6012"]},
        {"nom": "EM 11°BP", "arme": "Armée de terre", "cc": ["D01146L031"]},
        {"nom": "EM 27°BIM", "arme": "Armée de terre", "cc": ["D01146H038"]},
        {"nom": "EM 2°BB", "arme": "Armée de terre", "cc": ["D01146B067"]},
        {"nom": "EM 6°BLB", "arme": "Armée de terre", "cc": ["D01146J030"]},
        {"nom": "EM 7°BB", "arme": "Armée de terre", "cc": ["D01145V025"]},
        {"nom": "EM 9°BIMA", "arme": "Armée de terre", "cc": ["D011467086"]},
        {"nom": "EM BFA", "arme": "Armée de terre", "cc": ["D0110IN991"]},
        {"nom": "EM CRR-FR", "arme": "Armée de terre", "cc": ["D0114W9059"]},
        {"nom": "28°GGEO", "arme": "Armée de terre", "cc": ["D17118S067"]},
        {"nom": "GMHM", "arme": "Armée de terre", "cc": ["D1716SP991"]},
        {"nom": "1°RA", "arme": "Armée de terre", "cc": ["D1710HR090"]},
        {"nom": "40°RA", "arme": "Armée de terre", "cc": ["D1710BO051"]},
        {"nom": "54°RA", "arme": "Armée de terre", "cc": ["D1710HP083"]},
        {"nom": "61°RA", "arme": "Armée de terre", "cc": ["D17140D052"]},
        {"nom": "68°RAA", "arme": "Armée de terre", "cc": ["D1710FQ001"]},
        {"nom": "93°RAM", "arme": "Armée de terre", "cc": ["D1710D4038"]},
        {"nom": "3°RAMA", "arme": "Armée de terre", "cc": ["D1711DK083"]},
        {"nom": "11°RAMA", "arme": "Armée de terre", "cc": ["D1710G3035"]},
        {"nom": "35°RAP", "arme": "Armée de terre", "cc": ["D1710GS065"]},
        {"nom": "5°RC", "arme": "Armée de terre", "cc": ["D1719X7099"]},
        {"nom": "12°RC", "arme": "Armée de terre", "cc": ["D1710BJ045"]},
        {"nom": "1°RCA", "arme": "Armée de terre", "cc": ["D1711E6083"]},
        {"nom": "501°RCC", "arme": "Armée de terre", "cc": ["D1710CO051"]},
        {"nom": "1°RCH", "arme": "Armée de terre", "cc": ["D1710C9055"]},
        {"nom": "4°RCH", "arme": "Armée de terre", "cc": ["D1710VF005"]},
        {"nom": "1°RCP", "arme": "Armée de terre", "cc": ["D17147K009"]},
        {"nom": "2°RD", "arme": "Armée de terre", "cc": ["D1711DL049"]},
        {"nom": "5°RD", "arme": "Armée de terre", "cc": ["D1719X8010"]},
        {"nom": "1°REC", "arme": "Armée de terre", "cc": ["D1710FD084"]},
        {"nom": "1°REG", "arme": "Armée de terre", "cc": ["D1710FM030"]},
        {"nom": "2°REG", "arme": "Armée de terre", "cc": ["D1713ZO084"]},
        {"nom": "2°REI", "arme": "Armée de terre", "cc": ["D1710FH030"]},
        {"nom": "3°REI", "arme": "Armée de terre", "cc": ["D17115O097"]},
        {"nom": "2°REP", "arme": "Armée de terre", "cc": ["D1710GD020"]},
        {"nom": "3°RG", "arme": "Armée de terre", "cc": ["D1710CB008"]},
        {"nom": "6°RG", "arme": "Armée de terre", "cc": ["D1710FY049"]},
        {"nom": "13°RG", "arme": "Armée de terre", "cc": ["D17147V025"]},
        {"nom": "19°RG", "arme": "Armée de terre", "cc": ["D1710C3025"]},
        {"nom": "31°RG", "arme": "Armée de terre", "cc": ["D1711AU082"]},
        {"nom": "17°RGP", "arme": "Armée de terre", "cc": ["D1710GQ082"]},
        {"nom": "2°RH", "arme": "Armée de terre", "cc": ["D1711AE067"]},
        {"nom": "3°RH", "arme": "Armée de terre", "cc": ["D1710II991"]},
        {"nom": "1°RHP", "arme": "Armée de terre", "cc": ["D1710G9099"]},
        {"nom": "1°RI", "arme": "Armée de terre", "cc": ["D1710F0057"]},
        {"nom": "35°RI", "arme": "Armée de terre", "cc": ["D1710C7090"]},
        {"nom": "92°RI", "arme": "Armée de terre", "cc": ["D1710D2063"]},
        {"nom": "126°RI", "arme": "Armée de terre", "cc": ["D1710ZV019"]},
        {"nom": "152°RI", "arme": "Armée de terre", "cc": ["D1710AZ068"]},
        {"nom": "5°RIAOM", "arme": "Armée de terre", "cc": ["D17112S993"]},
        {"nom": "RICM", "arme": "Armée de terre", "cc": ["D1710G5086"]},
        {"nom": "1°RIMA", "arme": "Armée de terre", "cc": ["D1710FS016"]},
        {"nom": "2°RIMA", "arme": "Armée de terre", "cc": ["D1710FU072"]},
        {"nom": "3°RIMA", "arme": "Armée de terre", "cc": ["D1710FW056"]},
        {"nom": "9°RIMA", "arme": "Armée de terre", "cc": ["D17115Q973"]},
        {"nom": "21°RIMA", "arme": "Armée de terre", "cc": ["D1710FO083"]},
        {"nom": "33°RIMA", "arme": "Armée de terre", "cc": ["D171158097"]},
        {"nom": "RIMAP-NC", "arme": "Armée de terre", "cc": ["D171176098"]},
        {"nom": "2°RMAT", "arme": "Armée de terre", "cc": ["D17142J035"]},
        {"nom": "3°RMAT", "arme": "Armée de terre", "cc": ["D17142K031"]},
        {"nom": "4°RMAT", "arme": "Armée de terre", "cc": ["D17142L030"]},
        {"nom": "6°RMAT", "arme": "Armée de terre", "cc": ["D17142U025"]},
        {"nom": "7°RMAT", "arme": "Armée de terre", "cc": ["D17142N069"]},
        {"nom": "8°RMAT", "arme": "Armée de terre", "cc": ["D17142O051"]},
        {"nom": "RMED", "arme": "Armée de terre", "cc": ["D17146U001"]},
        {"nom": "RMT", "arme": "Armée de terre", "cc": ["D1710BQ060"]},
        {"nom": "2°RPIMA", "arme": "Armée de terre", "cc": ["D171169097"]},
        {"nom": "3°RPIMA", "arme": "Armée de terre", "cc": ["D1710GF011"]},
        {"nom": "8°RPIMA", "arme": "Armée de terre", "cc": ["D1710GJ006"]},
        {"nom": "1°RS", "arme": "Armée de terre", "cc": ["D1710FF026"]},
        {"nom": "121°RT", "arme": "Armée de terre", "cc": ["D1711BY091"]},
        {"nom": "503°RT", "arme": "Armée de terre", "cc": ["D171407030"]},
        {"nom": "511°RT", "arme": "Armée de terre", "cc": ["D1710H7021"]},
        {"nom": "515°RT", "arme": "Armée de terre", "cc": ["D1711C2016"]},
        {"nom": "516°RT", "arme": "Armée de terre", "cc": ["D1710B7054"]},
        {"nom": "519°RT", "arme": "Armée de terre", "cc": ["D17180U083"]},
        {"nom": "1°RTIR", "arme": "Armée de terre", "cc": ["D1710BW088"]},
        {"nom": "1°RTP", "arme": "Armée de terre", "cc": ["D1710GU031"]},
        {"nom": "28°RTRS", "arme": "Armée de terre", "cc": ["D1710ES063"]},
        {"nom": "40°RTRS", "arme": "Armée de terre", "cc": ["D1710E8057"]},
        {"nom": "41°RTRS", "arme": "Armée de terre", "cc": ["D1716Z9059"]},
        {"nom": "44°RTRS", "arme": "Armée de terre", "cc": ["D171194067"]},
        {"nom": "48°RTRS", "arme": "Armée de terre", "cc": ["D17114C047"]},
        {"nom": "53°RTRS", "arme": "Armée de terre", "cc": ["D171116054"]},
        {"nom": "54°RTRS", "arme": "Armée de terre", "cc": ["D171197067"]},
        {"nom": "BA 101", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FB031"]},
        {"nom": "BA 104", "arme": "Armée de l'air et de l'espace", "cc": ["D193000247"]},
        {"nom": "BA 105", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FC027"]},
        {"nom": "BA 106", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FD033"]},
        {"nom": "BA 107", "arme": "Armée de l'air et de l'espace", "cc": ["D1932ER078"]},
        {"nom": "BA 110", "arme": "Armée de l'air et de l'espace", "cc": ["D1932ES060"]},
        {"nom": "BA 113", "arme": "Armée de l'air et de l'espace", "cc": ["D1932EV052"]},
        {"nom": "BA 115", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FW084"]},
        {"nom": "BA 116", "arme": "Armée de l'air et de l'espace", "cc": ["D1932EW070"]},
        {"nom": "BA 118", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FE040"]},
        {"nom": "BA 120", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FF009"]},
        {"nom": "BA 123", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FG045"]},
        {"nom": "BA 125", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FY013"]},
        {"nom": "BA 126", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FZ02A"]},
        {"nom": "BA 133", "arme": "Armée de l'air et de l'espace", "cc": ["D1932F0054"]},
        {"nom": "BA 168", "arme": "Armée de l'air et de l'espace", "cc": ["D193A6N000"]},
        {"nom": "BA 186", "arme": "Armée de l'air et de l'espace", "cc": ["D193000988"]},
        {"nom": "BA 188", "arme": "Armée de l'air et de l'espace", "cc": ["D193505999"]},
        {"nom": "BA 190", "arme": "Armée de l'air et de l'espace", "cc": ["D193506987"]},
        {"nom": "BA 204", "arme": "Armée de l'air et de l'espace", "cc": ["D1535N1033"]},
        {"nom": "BA 273", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FI041"]},
        {"nom": "BA 278", "arme": "Armée de l'air et de l'espace", "cc": ["D1932G2001"]},
        {"nom": "BA 367", "arme": "Armée de l'air et de l'espace", "cc": ["D193000973"]},
        {"nom": "BA 470", "arme": "Armée de l'air et de l'espace", "cc": ["D193000328"]},
        {"nom": "BA 701", "arme": "Armée de l'air et de l'espace", "cc": ["D1932G3024"]},
        {"nom": "BA 702", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FM018"]},
        {"nom": "BA 705", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FO037"]},
        {"nom": "BA 709", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FP016"]},
        {"nom": "BA 721", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FQ017"]},
        {"nom": "BA 722", "arme": "Armée de l'air et de l'espace", "cc": ["D1932FR017"]},
        {"nom": "BA 749", "arme": "Armée de l'air et de l'espace", "cc": ["D1932G4038"]},
        {"nom": "BA 901", "arme": "Armée de l'air et de l'espace", "cc": ["D1932F3067"]},
        {"nom": "BA 921", "arme": "Armée de l'air et de l'espace", "cc": ["D1932F5095"]},
        {"nom": "BA 928", "arme": "Armée de l'air et de l'espace", "cc": ["D20302F029"]},
        {"nom": "BA 942", "arme": "Armée de l'air et de l'espace", "cc": ["D1932G5069"]},
        {"nom": "BASE NAVALE ABU DHABI", "arme": "Marine nationale", "cc": ["D03260E075"]},
        {"nom": "BASE NAVALE BREST", "arme": "Marine nationale", "cc": ["D04209M029"]},
        {"nom": "BASE NAVALE CHERBOURG", "arme": "Marine nationale", "cc": ["D04209N050"]},
        {"nom": "BASE NAVALE DEGRAD DES CANNES", "arme": "Marine nationale", "cc": ["D21251T999"]},
        {"nom": "BASE NAVALE DJIBOUTI", "arme": "Marine nationale", "cc": ["D0320AQ999"]},
        {"nom": "BASE NAVALE FORT DE FRANCE", "arme": "Marine nationale", "cc": ["D2122EK097"]},
        {"nom": "BASE NAVALE NOUMEA", "arme": "Marine nationale", "cc": ["D2122EL098"]},
        {"nom": "BASE NAVALE PAPEETE", "arme": "Marine nationale", "cc": ["D2122EM999"]},
        {"nom": "BASE NAVALE PORTS DES GALETS", "arme": "Marine nationale", "cc": ["D21251V097"]},
        {"nom": "BASE NAVALE TOULON", "arme": "Marine nationale", "cc": ["D04209L083"]}
    ];
    // « 4°RIISC », « 4E RIISC », « 4ème riisc », « UIISC n°4 » → même unité.
    function normeUnite(t) {
        var n = String(t || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
        return n.replace(/^UIISCN?(\d+)$/, '$1RIISC').replace(/^(\d+)(?:ERE|ER|EME|E)?[RU]IISC$/, '$1RIISC');
    }
    function uniteConnue(t) { var n = normeUnite(t); return n ? UNITES.filter(function(u) { return normeUnite(u.nom) === n; })[0] || null : null; }
    window.JUMELAGE_UNITES = function() { return UNITES.slice(); };
    window.JUMELAGE_UNITE_INFO = function(t) { return uniteConnue(t); };
    // Champ « Unité » : liste qui se filtre dès les premières lettres (on choisit, on ne se trompe pas).
    function brancherListeUnites(inp) {
        if (inp._unites) return; inp._unites = true;
        var boite = inp.parentNode, liste = document.createElement('div');
        boite.style.position = 'relative'; liste.className = 'JUM-UNITES'; liste.setAttribute('role', 'listbox'); liste.hidden = true;
        boite.appendChild(liste);
        function montrer() {
            var q = normeUnite(inp.value), l = UNITES.filter(function(u) { return !q || normeUnite(u.nom).indexOf(q) >= 0 || normeUnite(u.codier || '').indexOf(q) >= 0 || normeUnite(u.arme).indexOf(q) >= 0; });
            // Celles qui commencent par la saisie d'abord (« 5 » : 5°RIISC, 5°RC, 5°RD… avant 35°RI).
            if (q) l = l.filter(function(u) { return normeUnite(u.nom).indexOf(q) === 0; }).concat(l.filter(function(u) { return normeUnite(u.nom).indexOf(q) !== 0; }));
            liste.innerHTML = l.length ? l.map(function(u) { return '<button type="button" role="option" data-u="' + esc(u.nom) + '"><b>' + esc(u.nom) + '</b><small>' + esc(u.codier ? u.codier + ' au codier FD' : u.arme) + '</small></button>'; }).join('')
                : '<p>Aucune unité ne commence ainsi. Unité absente de la liste ? Signalez-la (Paramètres › Aide).</p>';
            liste.hidden = false;
        }
        inp.addEventListener('input', montrer); inp.addEventListener('focus', montrer);
        inp.addEventListener('blur', function() { setTimeout(function() { liste.hidden = true; var u = uniteConnue(inp.value); if (u) inp.value = u.nom; }, 150); });
        liste.addEventListener('pointerdown', function(e) { e.preventDefault(); });
        liste.addEventListener('click', function(e) { var b = e.target.closest('button'); if (!b) return; inp.value = b.getAttribute('data-u'); liste.hidden = true; inp.dispatchEvent(new Event('change', { bubbles: true })); });
        inp.setAttribute('autocomplete', 'off');
    }
    document.addEventListener('focusin', function(e) { if (e.target && e.target.id === 'JUM-R-UNITE') brancherListeUnites(e.target); });
    window.JUMELAGE_QUI = function() { var r = lireReglages(); return [r.grade, r.nom, r.prenom].filter(Boolean).join(' '); };
    function chiffres(v) { return String(v || '').replace(/\D/g, ''); }
    function formatMatricule(v) { var c = chiffres(v).slice(0, 10); return [c.slice(0, 3), c.slice(3, 5), c.slice(5, 7), c.slice(7)].filter(Boolean).join(' '); }
    function ecrireReglages(r) {
        try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(r)); } catch (e) {}
        // Mise en route
        var mer = lireJSON('mer_reglages') || {};
        mer.identite = { unite: r.unite, cie: r.cie, grade: r.grade, nom: r.nom, prenom: r.prenom, matricule: r.matricule };
        mer.derniereUnite = r.unite; mer.derniereCie = r.cie;
        mer.mailSignataire = r.mailVal1; mer.mailDemandeur = r.monMail;
        try { localStorage.setItem('mer_reglages', JSON.stringify(mer)); } catch (e) {}
        ecrireTxt('mer_config_faite', '1');
        // Compte-rendu
        var c = chiffres(r.matricule);
        ecrireTxt('mission_saved_user', [r.nom, r.prenom].filter(Boolean).join(' '));
        ecrireTxt('mission_saved_grade', r.grade);
        ecrireTxt('mission_saved_cie', r.cie);
        if (c.length === 10) ecrireTxt('mission_saved_nid', [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8)].join(' '));
        var cr = lireJSON('trigone_app_settings') || {};
        if (r.unite) cr.unitName = r.unite;
        if (r.mailChorus) cr.mailAssist = r.mailChorus;
        if (typeof r.resaActive === 'boolean') { cr.abtEnabled = r.resaActive; cr.abtLabel = r.resaLibelle || RESA_DEFAUT; }
        try { localStorage.setItem('trigone_app_settings', JSON.stringify(cr)); } catch (e) {}
        ecrireTxt('trigone_premier_lancement_fait', '1');
        // Page Compte-rendu ouverte : ses valeurs en mémoire suivent tout de suite.
        if (DANS_CR) {
            if (r.unite && 'UNIT_NAME' in window) window.UNIT_NAME = r.unite;
            if (r.mailChorus && 'MAIL_ASSIST' in window) window.MAIL_ASSIST = r.mailChorus;
            if (typeof r.resaActive === 'boolean' && 'ABT_LABEL' in window) {
                window.ABT_ENABLED = r.resaActive; window.ABT_LABEL = r.resaLibelle || RESA_DEFAUT;
                try { if (typeof window.APPLY_ABT_SETTINGS === 'function') window.APPLY_ABT_SETTINGS(); } catch (e) {}
            }
        }
    }
    function codeDefini() { return !!lireTxt(CLE_CODE); }
    function empreinte(code) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode('TRIGONE:' + code)).then(function(b) {
            return Array.prototype.map.call(new Uint8Array(b), function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        });
    }
    function poserCode(code) {
        return empreinte(code).then(function(h) {
            ecrireTxt(CLE_CODE, h);
            // Le code commun remplace les anciens codes propres à chaque appli.
            try { localStorage.removeItem('mer_pin_hash'); localStorage.removeItem('trigone_pin_hash'); } catch (e) {}
            if (window.JUMELAGE_MARQUER_DEVERROUILLE) window.JUMELAGE_MARQUER_DEVERROUILLE();
        });
    }
    // Anciens codes propres à chaque appli (Compte-rendu : « Mon espace » ; Mise en route : premier réglage) :
    // ils restent acceptés à l'ouverture, puis sont remplacés par le code TRIGONE dès la première saisie juste.
    function ancienCode() { return lireTxt('trigone_pin_hash') || lireTxt('mer_pin_hash'); }
    function codeActif() { return codeDefini() || !!ancienCode(); }
    function hashSimpleCR(t) { var h = 0; for (var i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0; return String(h); }
    function empreinteMer(code) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode('TRIGONE-MER:' + code)).then(function(b) {
            return Array.prototype.map.call(new Uint8Array(b), function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        });
    }
    // Vérifie un code saisi (code TRIGONE, ou ancien code d'une appli) ; un ancien code juste devient le code TRIGONE.
    window.JUMELAGE_VERIFIER_CODE = function(code) {
        return empreinte(code).then(function(h) {
            if (h === lireTxt(CLE_CODE)) return 'commun';
            if (lireTxt('trigone_pin_hash') && hashSimpleCR(code) === lireTxt('trigone_pin_hash')) return 'ancien';
            var m = lireTxt('mer_pin_hash');
            return m ? empreinteMer(code).then(function(x) { return x === m ? 'ancien' : ''; }) : '';
        }).then(function(r) {
            if (r === 'ancien') return poserCode(code).then(function() { return true; });
            return r === 'commun';
        });
    };
    window.JUMELAGE_POSER_CODE = poserCode;
    window.JUMELAGE_EFFACER_CODE = function() { try { ['trigone_code_commun', 'trigone_pin_hash', 'mer_pin_hash', CLE_BIO].forEach(function(k) { localStorage.removeItem(k); }); } catch (e) {} };
    // ---------- Empreinte digitale (ou visage) : déverrouillage par le système de l'appareil ----------
    // Passkey de l'appareil (WebAuthn, authentificateur intégré, vérification de l'utilisateur exigée) : TRIGONE ne voit
    // jamais l'empreinte, le téléphone dit seulement « c'est bien la personne ». Elle complète le code à 4 chiffres, qui
    // reste toujours possible (empreinte refusée, capteur indisponible). Rien n'est envoyé au serveur.
    var CLE_BIO = 'trigone_bio_id', SVG_EMPREINTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11c0 3.5-.6 6.3-2 8.5"/><path d="M8.5 10.5a3.5 3.5 0 0 1 7 0c0 1.6-.1 3.1-.4 4.5"/><path d="M5.6 8.3A7 7 0 0 1 19 10.5c0 1.1 0 2.2-.2 3.2"/><path d="M5 12.5c0 1.6-.3 3-.9 4.2"/><path d="M14.6 17.8c-.3 1.1-.7 2.1-1.2 3"/><path d="M7.4 4.6A9 9 0 0 1 20.8 9"/></svg>';
    function b64u(octets) { return btoa(String.fromCharCode.apply(null, new Uint8Array(octets))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function deB64u(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return Uint8Array.from(atob(t), function(c) { return c.charCodeAt(0); }); }
    // Téléphone seulement (sur PC, le code à 4 chiffres au clavier reste la seule façon d'ouvrir TRIGONE).
    function surTelephone() { return !(window.matchMedia && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches); }
    function bioActive() { return !!lireTxt(CLE_BIO) && codeDefini() && surTelephone(); }
    function bioPossible() {
        if (!surTelephone() || !window.PublicKeyCredential || !navigator.credentials || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
        return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function() { return false; });
    }
    function bioActiver() {
        return navigator.credentials.create({ publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'TRIGONE' },
            user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'TRIGONE', displayName: 'TRIGONE (cet appareil)' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
            timeout: 60000, attestation: 'none' } }).then(function(c) { ecrireTxt(CLE_BIO, b64u(c.rawId)); return true; });
    }
    // Déverrouillage : vrai seulement si le système a vérifié la personne (indicateur « UV » des données de l'authentificateur).
    function bioVerifier() {
        var id = lireTxt(CLE_BIO); if (!id) return Promise.resolve(false);
        return navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{ type: 'public-key', id: deB64u(id) }], userVerification: 'required', timeout: 60000 } })
            .then(function(c) { var a = new Uint8Array(c.response.authenticatorData); return !!(a.length > 32 && (a[32] & 0x04)); });
    }
    window.JUMELAGE_BIO_BASCULER = function() {
        var zone = document.getElementById('JUM-R-BIO'), err = document.getElementById('JUM-R-ERREUR');
        if (lireTxt(CLE_BIO)) { try { localStorage.removeItem(CLE_BIO); } catch (e) {} if (zone) dessinerBioReglages(zone); bandeau('Empreinte désactivée : le code à 4 chiffres reste demandé.'); return; }
        if (!codeDefini()) { if (err) err.textContent = '⛔ Choisissez d\'abord votre code à 4 chiffres (il reste le code de secours).'; return; }
        if (document.querySelector('.JUM-BIOC')) return;
        var f = document.createElement('div');
        f.className = 'JUM-SIG JUM-BIOC'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Empreinte digitale');
        f.innerHTML = '<div class="JUM-SIG-CARTE"><div class="JUM-BIOC-ROND">' + SVG_EMPREINTE + '</div>' +
            '<h2>Ouvrir TRIGONE avec votre empreinte</h2><p>Votre téléphone va vous demander de poser votre doigt (ou votre visage). Votre empreinte reste dans le téléphone : TRIGONE ne la voit jamais. Le code à 4 chiffres reste possible en secours.</p>' +
            '<div class="JUM-BIOC-ERR"></div>' +
            '<div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-SECOND">Plus tard</button><button type="button" class="JUM-R-PRINCIPAL">Continuer</button></div></div>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { f.addEventListener(t, function(e) { e.stopPropagation(); }); });
        var fermer = function() { f.remove(); };
        f.addEventListener('click', function(e) { if (e.target === f) fermer(); });
        f.querySelector('.JUM-R-SECOND').addEventListener('click', fermer);
        f.querySelector('.JUM-R-PRINCIPAL').addEventListener('click', function() {
            var bouton = this; bouton.disabled = true;
            bioActiver().then(function() {
                if (zone) dessinerBioReglages(zone);
                f.classList.add('fait');
                f.querySelector('.JUM-SIG-CARTE').innerHTML = '<img class="JUM-SIG-MASCOTTE" src="' + (DANS_CR ? '../' : '') + 'mascotte-pouce.webp" alt="">' +
                    '<div class="JUM-BIOC-ROND">' + SVG_EMPREINTE + '</div><h2>Empreinte activée ✓</h2>' +
                    '<p>À la prochaine ouverture, posez simplement votre doigt : TRIGONE s\'ouvre.</p>' +
                    '<div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-PRINCIPAL">Parfait</button></div>';
                f.querySelector('.JUM-R-PRINCIPAL').addEventListener('click', fermer);
            }, function() {
                bouton.disabled = false;
                f.querySelector('.JUM-BIOC-ERR').textContent = 'Empreinte non enregistrée (annulée ou capteur indisponible). Réessayez.';
            });
        });
        document.body.appendChild(f);
    };
    function dessinerBioReglages(zone) {
        bioPossible().then(function(ok) {
            if (!ok) { zone.innerHTML = ''; return; }
            var actif = bioActive();
            zone.innerHTML = '<div class="JUM-R-BIO">' + SVG_EMPREINTE + '<p class="JUM-R-AIDE" style="margin:0;">' + (actif ? '<b>Empreinte activée</b> : posez votre doigt (ou votre visage) pour ouvrir TRIGONE. Le code à 4 chiffres reste possible en secours.'
                : 'Ouvrez TRIGONE avec votre <b>empreinte</b> (ou votre visage), le code à 4 chiffres restant en secours.') + '</p></div>' +
                '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_BIO_BASCULER()">' + (actif ? 'Désactiver l\'empreinte' : 'Activer l\'empreinte') + '</button>';
        });
    }
    // Adresses de groupe de l'unité (tous les assistants Chorus DT / tous les VALIDEUR 2) : assist-dt.4riisc@trigone-app.com…
    function adresseGroupe(role, unite) {
        var u = normeUnite(unite == null ? lireReglages().unite : unite).toLowerCase();
        return u ? (role === 'chorus' ? 'assist-dt.' : 'valideur2.') + u + '@trigone-app.com' : '';
    }
    window.JUMELAGE_ADRESSE_GROUPE = function(role) { return adresseGroupe(role); };
    // Profil complet (matricule et destinataires) : sinon, après la création du compte, le parcours guidé continue.
    function profilComplet() { var r = lireReglages(); return !!(r.matricule && r.mailVal1 && r.mailChorus); }
    // Parcours de première connexion commencé et pas fini (appli fermée en route) : il reprend à l'ouverture.
    window.JUMELAGE_PARCOURS_EN_COURS = function() { var b = lireJSON('trigone_parcours_etape'); return !!(b && b.n && !profilComplet() && b.mail === ((monCompte() || {}).mail || '')); };
    window.JUMELAGE_REGLAGES_FAITS = function() { return !!lireJSON(CLE_REGLAGES) || lireTxt('mer_config_faite') === '1'; };

    var reglages = null;
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function(ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
    window.JUMELAGE_REGLAGES = function(opts) {
        opts = opts || {};
        if (reglages || !document.body) return;
        if (opts.premiere && !opts.profil && accueilAProposer()) { proposerAccueil(); return; }
        if (opts.premiere && !window.JUMELAGE_PRESENTATION_VUE()) {
            window.JUMELAGE_PRESENTATION({ premiere: true, apres: function() { window.JUMELAGE_REGLAGES(opts); } });
            return;
        }
        // Première ouverture : plus de réglages imposés. TRIGONE s'ouvre librement (démonstration, écran d'accueil) ;
        // la fenêtre « Se connecter » est proposée une fois (refermable), et reste au bouton de compte en haut à droite.
        // Compte déjà relié (code de liaison) sans identité : « Compléter mon profil ».
        if (opts.premiere && !opts.profil) {
            var suite = function() { if (window.JUMELAGE_APRES_REGLAGES) try { window.JUMELAGE_APRES_REGLAGES(); } catch (e) {} };
            if (window.JUMELAGE_PARCOURS_EN_COURS()) { window.JUMELAGE_REGLAGES({ premiere: true, profil: true }); return; }
            if (window.JUMELAGE_REGLAGES_FAITS()) { suite(); return; }
            if (monCompte()) { window.JUMELAGE_REGLAGES({ premiere: true, profil: true }); return; }
            if (lireTxt(CLE_CONNEXION_PROPOSEE) === '1') { suite(); return; }
            ecrireTxt(CLE_CONNEXION_PROPOSEE, '1');
            window.JUMELAGE_CONNEXION({ premiere: true });
            return;
        }
        var r = lireReglages(), premiere = !!opts.premiere;
        if (!r.monMail && monCompte()) r.monMail = monCompte().mail;
        // Vue : « profil » (identité, destinataires, réservation, code) ou « roles » (rôles, fonctions, absence) ; sans vue, tout.
        var vue = opts.vue || (premiere ? 'profil' : opts.section === 'absence' ? 'absence' : opts.section === 'roles' ? 'roles' : '');
        var val = lireJSON('mer_valideur') || {};
        var ancienCode = !codeDefini() && (lireTxt('mer_pin_hash') || lireTxt('trigone_pin_hash'));
        function champ(id, label, val, attrs) {
            return '<div class="JUM-R-CHAMP"><label for="JUM-R-' + id + '">' + label + '</label><input id="JUM-R-' + id + '" value="' + esc(val) + '" ' + (attrs || 'type="text" autocomplete="off"') + '></div>';
        }
        // Mes rôles : chacun est missionnaire ; valideurs et assistant Chorus DT cochent en plus leur rôle, avec son code.
        var htmlRoles = '<div data-vue="roles"><div class="JUM-R-TITRE" id="JUM-R-SECTION-ROLES">Mes rôles</div>' +
                '<p class="JUM-R-AIDE">Vous êtes missionnaire. Si un ou plusieurs de ces rôles vous ont été confiés, cochez-les (vous pouvez les avoir tous) : chaque code, remis par l\'administrateur, est demandé une seule fois.</p>' +
                caseRole('VAL1', 'valideur1', '<b>VALIDEUR 1</b> (chef de service)', 'Code VALIDEUR 1') +
                '<div id="JUM-R-FONCTION1-BLOC" style="display:none;">' + champ('FONCTION1', 'Ma fonction de VALIDEUR 1 (sur la signature)', val.fonction1 || (roleActif('valideur1') ? val.fonction : '') || '', 'type="text" autocomplete="off" placeholder="EX : COMMANDANT D\'UNITÉ"') + '</div>' +
                caseRole('VAL2', 'valideur2', '<b>VALIDEUR 2</b>', 'Code VALIDEUR 2') +
                '<div id="JUM-R-FONCTION2-BLOC" style="display:none;">' + champ('FONCTION2', 'Ma fonction de VALIDEUR 2 (sur la signature)', val.fonction2 || (roleActif('valideur2') && !roleActif('valideur1') ? val.fonction : '') || '', 'type="text" autocomplete="off" placeholder="EX : CHEF DE CORPS"') + '</div>' +
                caseRole('CHORUS', 'chorus', '<b>ASSIST CHORUS DT</b>', 'Code ASSIST CHORUS DT') +
                caseRole('ADMIN', 'admin', '<b>ADMINISTRATEUR</b> de mon unité (comptes : réinitialisation, suppression)', 'Code ADMINISTRATEUR') +
                '<p class="JUM-R-AIDE" style="margin-top:6px;">Un rôle coché est déclaré à votre compte TRIGONE : votre boîte ne reçoit que ce qui lui revient (demandes à signer, ou demandes validées et comptes-rendus pour l\'assistant Chorus DT).</p>';
        // Première fois : le profil en 3 étapes (identité, destinataires, sécurité), au style de l'écran d'accueil.
        // Première connexion : parcours guidé, une étape par écran (le compte est l'étape 1, déjà faite) : profil, code
        // d'accès, carte, rôles, destinataires (selon les rôles), notifications ; puis l'écran de bienvenue.
        function htmlProfilEtapes() {
            var c = monCompte(), photo = lireTxt(CLE_CARTE_PHOTO);
            var notifs = (/Android/i.test(navigator.userAgent || '') ? '<p class="JUM-R-AIDE JUM-PF-ENCART"><b>Android</b> : pour les recevoir sans retard, même appli fermée : Paramètres du téléphone › Applications › Chrome › Batterie › « Non restreinte ».</p>' : '') +
                (estIOS() ? '<p class="JUM-R-AIDE JUM-PF-ENCART"><b>iPhone / iPad</b> : installez TRIGONE sur l\'écran d\'accueil (Safari › Partager › « Sur l\'écran d\'accueil ») et ouvrez-la depuis cette icône pour activer les notifications.</p>' : '');
            var dest = function(id, label, valeur, role) {
                return '<div class="JUM-PF-DEST" data-dest="' + id + '"><div class="JUM-R-CHAMP"><label for="JUM-R-' + id + '">' + label + '</label><input id="JUM-R-' + id + '" type="email" autocomplete="off" data-scan-carte value="' + esc(valeur || '') + '" placeholder="Tapez un nom, ou choisissez ci-dessous"></div>' +
                    '<div class="JUM-PF-LISTE" data-pour="' + id + '" data-role="' + role + '"></div></div>';
            };
            return '<div class="JUM-R-CARTE JUM-PF-CARTE">' +
                '<div class="JUM-PF-TETE"><div class="JUM-PF-BARRES">' + [1, 2, 3, 4, 5, 6, 7].map(function(i) { return '<i data-b="' + i + '"></i>'; }).join('') + '</div>' +
                    '<div class="JUM-PF-NUM" id="JUM-PF-NUM"></div><h2 id="JUM-PF-TITRE"></h2><p id="JUM-PF-TEXTE"></p></div>' +
                '<div class="JUM-R-CORPS">' +
                '<div data-etape="1">' +
                    (c ? '<p class="JUM-PF-OK">✓ Compte TRIGONE : <b>' + esc(c.mail) + '</b>' + (lireTxt(CLE_ATTENTE) ? ' · en attente de validation par votre unité' : '') + '</p>' :
                        '<details class="JUM-LIAISON-BLOC"><summary>📲 Déjà TRIGONE sur votre téléphone ou votre PC ? <b>Utiliser un code de liaison</b></summary>' +
                        '<p class="JUM-R-AIDE" style="margin-top:8px;">Sur l\'autre appareil : bouton de compte <b>en haut à droite</b> › <b>« Ajouter un appareil »</b> (ou <b>Ma carte › QR de connexion</b>). Saisissez ici le code affiché, ou scannez le QR : tout est recopié.</p>' +
                        htmlSaisieLiaison() + '</details>') +
                    '<div class="JUM-PF-AVATAR"><span id="JUM-PF-INIT">?</span></div>' +
                    '<div class="JUM-R-GRILLE">' + champ('GRADE', 'Grade', r.grade, 'type="text" autocomplete="off" placeholder="EX : ADJUDANT"') +
                        champ('CIE', 'Compagnie', r.cie, 'type="text" autocomplete="off" placeholder="EX : 4CIE"') +
                        champ('NOM', 'Nom', r.nom, 'type="text" autocomplete="off" placeholder="EX : BOUQUET"') +
                        champ('PRENOM', 'Prénom', r.prenom, 'type="text" autocomplete="off" data-no-uppercase="1" placeholder="EX : Germain-Pierre"') +
                        champ('UNITE', 'Unité (choisir dans la liste)', r.unite, 'type="text" autocomplete="off" placeholder="Tapez : 4°R…"') +
                        champ('MATRICULE', 'Matricule / NID', formatMatricule(r.matricule), 'type="text" inputmode="numeric" autocomplete="off" placeholder="067 50 10 191"') + '</div></div>' +
                '<div data-etape="2" style="display:none;">' +
                    '<div class="JUM-PF-CADENAS">' + SVG_CADENAS_PF + '</div>' +
                    '<div class="JUM-R-GRILLE">' + champ('CODE1', codeDefini() ? 'Nouveau code' : 'Code à 4 chiffres', '', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"') +
                        champ('CODE2', 'Confirmer le code', '', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"') + '</div>' +
                    (codeDefini() ? '<p class="JUM-R-AIDE">🔒 Un code est déjà actif : laissez vide pour le garder.</p>' : '') +
                    '<p class="JUM-R-AIDE JUM-PF-ENCART">👆 Empreinte ou visage : activable ensuite dans Paramètres, si votre appareil le permet. Le code ne quitte jamais votre appareil.</p></div>' +
                '<div data-etape="3" style="display:none;">' +
                    '<div class="JUM-PF-CARTE-APERCU" id="JUM-PF-CARTE"></div>' +
                    '<button type="button" class="JUM-R-SECOND JUM-PF-PHOTO" id="JUM-PF-PHOTO">📷 ' + (photo ? 'Changer ma photo' : 'Prendre ma photo') + '</button>' +
                    '<p class="JUM-R-AIDE JUM-PF-ENCART">Photo d\'identité : fond clair, visage dégagé. Elle reste sur votre appareil ; modifiable plus tard dans « Ma carte ».' +
                        (c ? ' Le verso porte votre QR code : votre responsable le scanne pour valider votre compte.' : ' Le QR code du verso s\'active avec votre compte TRIGONE.') + '</p></div>' +
                '<div data-etape="4" style="display:none;">' +
                    '<label class="JUM-R-CASE JUM-PF-MISSIONNAIRE"><input type="checkbox" checked disabled><span><b>Missionnaire</b> — toujours : je pars en mission</span></label>' +
                    htmlRoles + '</div></div>' +
                '<div data-etape="5" style="display:none;">' +
                    '<div class="JUM-PF-SOUS">Comme missionnaire</div>' +
                    dest('MAILVAL1', 'Mon VALIDEUR 1 (chef de service)', r.mailVal1, 'valideur1') +
                    dest('MAILCHORUS', 'Assistant Chorus DT de mon unité', r.mailChorus, 'chorus') +
                    '<div id="JUM-PF-DEST-V1" style="display:none;"><div class="JUM-PF-SOUS">Comme VALIDEUR 1</div>' +
                        dest('MAILVAL2', 'Le VALIDEUR 2 à qui je transmets', val.mailValideur2, 'valideur2') + '</div>' +
                    '<div id="JUM-PF-DEST-V2" style="display:none;"><div class="JUM-PF-SOUS">Comme VALIDEUR 2</div>' +
                        '<p class="JUM-R-AIDE JUM-PF-ENCART">Vos demandes validées partent à l\'assistant Chorus DT choisi ci-dessus.</p></div>' +
                    '<div' + (c ? ' style="display:none;"' : '') + '>' + champ('MONMAIL', 'Mon adresse', r.monMail || (c && c.mail) || '', 'type="email" autocomplete="off" placeholder="prenom.nom@trigone-app.com"') + '</div>' +
                    '<p class="JUM-R-AIDE JUM-PF-ENCART">📷 Le bouton à droite de chaque adresse scanne la carte TRIGONE de la personne : rien à taper.</p>' +
                    '<details class="JUM-PF-OPTION"><summary>Option « Demande de réservation » (hébergement, transport)</summary>' +
                        '<p class="JUM-R-AIDE">Si votre unité passe par un organisme de réservation (ex. Amplitude), laissez la case cochée et indiquez son nom.</p>' +
                        '<label class="JUM-R-CASE"><input type="checkbox" id="JUM-R-RESA"' + (r.resaActive !== false ? ' checked' : '') + '><span>Utiliser cette option</span></label>' +
                        champ('RESALIB', 'Libellé affiché (vide : « Demande de réservation »)', r.resaLibelle || '', 'type="text" autocomplete="off" data-no-uppercase="1" placeholder="EX : Amplitude (ABT)"') + '</details></div>' +
                '<div data-etape="6" style="display:none;">' +
                    '<div class="JUM-PF-NOTIF"><img src="' + (DANS_CR ? '../' : '') + 'icon-192.png" alt=""><div><b>TRIGONE</b><span>Votre demande OMR N°0412 est validée ✔</span></div></div>' +
                    '<button type="button" class="JUM-R-PRINCIPAL JUM-PF-NOTIF-BTN" id="JUM-PF-NOTIF">🔔 Activer les notifications</button>' +
                    '<p class="JUM-R-AIDE" id="JUM-PF-NOTIF-ETAT" style="text-align:center;"></p>' + notifs + '</div>' +
                '<p class="JUM-R-ERREUR" id="JUM-R-ERREUR"></p>' +
                '</div>' +
                '<div class="JUM-R-PIED JUM-PF-PIED"><button type="button" class="JUM-R-SECOND" id="JUM-PF-RETOUR" style="display:none;">←</button>' +
                    '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-PF-SUIVANT">Continuer</button></div>' +
                '<button type="button" class="JUM-PF-PLUSTARD" id="JUM-PF-PLUSTARD" style="display:none;">Plus tard</button>' +
                '<p class="JUM-PF-NOTE">Enregistré sur cet appareil · modifiable plus tard dans Paramètres</p></div>';
        }
        reglages = document.createElement('div');
        reglages.className = 'JUM-REGLAGES' + (premiere ? ' JUM-PROFIL' : '');
        if (vue) reglages.setAttribute('data-vue', vue);
        reglages.setAttribute('role', 'dialog');
        reglages.innerHTML = premiere ? htmlProfilEtapes() : '<div class="JUM-R-CARTE">' +
            '<div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('personne') : ROUE_SVG) + '</span><div><h2>' + (premiere ? 'Compléter mon profil' : vue === 'roles' ? 'Mes rôles' : vue === 'absence' ? 'Absence' : 'Mon profil') + '</h2>' +
                '<p>' + (premiere ? 'Une seule fois : ces informations pré-rempliront Mise en route et Compte-rendu de mission.' : vue === 'roles' ? 'VALIDEUR 1, VALIDEUR 2, ASSIST CHORUS DT : chacun avec son code.' : vue === 'absence' ? 'Un remplaçant par rôle reçoit vos envois jusqu\'à la date choisie.' : 'Commun à Mise en route et Compte-rendu de mission.') + (vue === 'absence' ? '' : ' Enregistré sur cet appareil uniquement.') + '</p></div>' +
                (premiere ? '' : '<button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_REGLAGES()">✕</button>') + '</div>' +
            '<div class="JUM-R-CORPS">' +
                // Déjà configuré sur un autre appareil : un code de liaison suffit (rien à ressaisir).
                (premiere && !monCompte() ? '<details class="JUM-LIAISON-BLOC"><summary>📲 Déjà TRIGONE sur votre téléphone ou votre PC ? <b>Utiliser un code de liaison</b></summary>' +
                    '<p class="JUM-R-AIDE" style="margin-top:8px;">Sur l\'autre appareil : bouton de compte <b>en haut à droite</b> › <b>« Ajouter un appareil »</b> (ou <b>Ma carte › QR de connexion</b>). Saisissez ici le code affiché, ou scannez le QR : identité, mails, rôles, code d\'accès, compte TRIGONE, demandes et bibliothèque sont recopiés.</p>' +
                    htmlSaisieLiaison() + '</details>' : '') +
                '<div data-vue="profil"><div class="JUM-R-TITRE">Mon identité</div>' +
                '<div class="JUM-R-GRILLE">' + champ('UNITE', 'Unité (choisir dans la liste)', r.unite, 'type="text" autocomplete="off" placeholder="Tapez : 4°R…"') +
                    champ('CIE', 'CIE', r.cie, 'type="text" autocomplete="off" placeholder="EX : 4CIE"') +
                    champ('GRADE', 'Grade', r.grade, 'type="text" autocomplete="off" placeholder="EX : ADJUDANT"') +
                    champ('MATRICULE', 'Matricule / NID', formatMatricule(r.matricule), 'type="text" inputmode="numeric" autocomplete="off" placeholder="EX : 067 50 10 191"') +
                    champ('NOM', 'Nom', r.nom, 'type="text" autocomplete="off" placeholder="EX : BOUQUET"') +
                    champ('PRENOM', 'Prénom', r.prenom, 'type="text" autocomplete="off" data-no-uppercase="1" placeholder="EX : Germain-Pierre"') + '</div>' +
                '<div class="JUM-R-TITRE">Envois</div>' +
                '<div class="JUM-R-GRILLE">' + champ('MAILVAL1', 'Mail du 1er valideur (chef de service)', r.mailVal1, 'type="email" autocomplete="off" placeholder="EX : prenom.nom@interieur.gouv.fr"') +
                    champ('MONMAIL', 'Mon mail', r.monMail, 'type="email" autocomplete="off" placeholder="EX : prenom.nom@interieur.gouv.fr"') +
                    champ('MAILCHORUS', 'Mail de l\'assistant Chorus DT (compte-rendu)', r.mailChorus || adresseGroupe('chorus'), 'type="email" autocomplete="off" placeholder="EX : prenom.nom@interieur.gouv.fr"') + '</div>' +
                (adresseGroupe('chorus') ? '<button type="button" class="JUM-R-LIEN" onclick="var c = document.getElementById(\'JUM-R-MAILCHORUS\'); c.value = JUMELAGE_ADRESSE_GROUPE(\'chorus\');">👥 Envoyer à tous les assistants Chorus DT de mon unité (' + esc(adresseGroupe('chorus')) + ')</button>' : '') +
                '<div class="JUM-R-TITRE">Option Demande de réservation</div>' +
                '<p class="JUM-R-AIDE">Si votre unité passe par un organisme de réservation pour l\'hébergement et le transport (ex. Amplitude), laissez la case cochée et indiquez son nom : il apparaîtra dans Mise en route et Compte-rendu.</p>' +
                '<label class="JUM-R-CASE"><input type="checkbox" id="JUM-R-RESA"' + (r.resaActive !== false ? ' checked' : '') + '><span>Utiliser cette option (certains régiments ne l\'utilisent pas)</span></label>' +
                '<div class="JUM-R-GRILLE" style="grid-template-columns:1fr;">' + champ('RESALIB', 'Libellé affiché (vide : « Demande de réservation »)', r.resaLibelle || '', 'type="text" autocomplete="off" data-no-uppercase="1" placeholder="EX : Amplitude (ABT)"') + '</div>' +
                '<div class="JUM-R-TITRE">Code d\'accès à 4 chiffres</div>' +
                '<p class="JUM-R-AIDE">' + (codeDefini() ? '🔒 Code actif : demandé à chaque ouverture de TRIGONE. Pour le changer, saisissez-en un nouveau.'
                    : ancienCode ? 'Un ancien code est encore actif dans l\'une des applis : définissez le code TRIGONE pour le remplacer.'
                    : 'Demandé à chaque ouverture de TRIGONE, pour protéger vos données.' + (premiere ? '' : ' Facultatif.')) + '</p>' +
                '<div class="JUM-R-GRILLE">' + champ('CODE1', codeDefini() ? 'Nouveau code' : 'Code', '', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"') +
                    champ('CODE2', 'Confirmer le code', '', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"') + '</div>' +
                (codeDefini() ? '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_SUPPRIMER_CODE()">Supprimer le code d\'accès</button>' : '') +
                (codeDefini() ? '<div id="JUM-R-BIO"></div>' : '') +
                '</div>' +
                htmlRoles +
                // Absence (valideur, assistant Chorus DT déjà actifs, compte TRIGONE actif) : remplaçant jusqu'à une date.
                '</div><div data-vue="absence">' +
                (!premiere && monCompte() && ['valideur1', 'valideur2', 'chorus'].some(roleActif) ? '<div class="JUM-R-TITRE" id="JUM-R-SECTION-ABSENCE">Absence</div>' +
                    '<p class="JUM-R-AIDE">En permission ou en mission ? Indiquez un <b>remplaçant pour chacun de vos rôles</b> (compte TRIGONE avec ce rôle) : jusqu\'à la date choisie, ce qui vous est envoyé pour ce rôle part directement chez lui, et l\'expéditeur en est informé.</p>' +
                    '<div id="JUM-R-ABS-ETAT" class="JUM-R-AIDE"></div>' +
                    '<div class="JUM-R-GRILLE" id="JUM-R-ABS-CHAMPS">' + [['valideur1', 'VALIDEUR 1'], ['valideur2', 'VALIDEUR 2'], ['chorus', 'ASSIST CHORUS DT']].filter(function(x) { return roleActif(x[0]); }).map(function(x) {
                            return champ('ABS-' + x[0], 'Remplaçant ' + x[1], '', 'type="email" data-scan-carte data-role-abs="' + x[0] + '" autocomplete="off" placeholder="Vide : reste chez vous"');
                        }).join('') + champ('ABSFIN', 'Absent jusqu\'au (inclus)', '', 'type="date"') + '</div>' +
                    '<p class="JUM-R-AIDE" style="margin-top:0;">Un remplaçant par rôle, qui a ce rôle. Un rôle laissé vide continue d\'arriver chez vous (VALIDEUR 2 et ASSIST CHORUS DT : aussi chez les autres de l\'unité).</p>' +
                    '<button type="button" class="JUM-R-SECOND" id="JUM-R-ABS-OK" style="width:100%; margin:4px 0 0;">Déclarer mon absence</button>' +
                    '<p class="JUM-R-ERREUR" id="JUM-R-ABS-ERR" style="min-height:0;"></p>' : '<p class="JUM-R-AIDE" data-vue="absence">L\'absence concerne les valideurs et l\'assistant Chorus DT : cochez d\'abord votre rôle dans « Mes rôles ».</p>') + '</div>' +
                // Android, première ouverture : réglage batterie, sans lequel les notifications arrivent en retard appli fermée.
                // (Une appli web ne peut pas ouvrir elle-même les paramètres d'Android : on guide pas à pas.)
                (premiere && /Android/i.test(navigator.userAgent || '') ? '<div class="JUM-R-TITRE">Notifications sur Android</div>' +
                    '<p class="JUM-R-AIDE">Pour recevoir les notifications TRIGONE sans retard, même appli fermée, retirez l\'économie de batterie de Chrome :</p>' +
                    '<ol class="JUM-R-AIDE JUM-R-ETAPES"><li>Ouvrez les <b>Paramètres</b> du téléphone</li><li><b>Applications</b> › <b>Chrome</b></li><li><b>Batterie</b></li><li>Choisissez <b>« Non restreinte »</b></li></ol>' +
                    '<p class="JUM-R-AIDE">À faire une seule fois. Rappel : Notice › Notifications.</p>' : '') +
                (premiere && estIOS() ? '<div class="JUM-R-TITRE">Notifications sur iPhone / iPad</div>' +
                    '<p class="JUM-R-AIDE">Pour être prévenu de chaque envoi, même TRIGONE fermée (iOS 16.4 ou plus récent) :</p>' +
                    '<ol class="JUM-R-AIDE JUM-R-ETAPES"><li>Dans <b>Safari</b> : bouton <b>Partager</b> › <b>« Sur l\'écran d\'accueil »</b></li><li>Ouvrez TRIGONE <b>depuis cette icône</b></li><li>Bouton du compte › <b>Paramètres</b> › <b>Notifications</b> › <b>Autoriser</b></li><li><b>Réglages › Notifications</b> : laissez TRIGONE <b>hors du Résumé programmé</b>, et autorisez-la dans vos <b>modes de concentration</b></li></ol>' +
                    '<p class="JUM-R-AIDE">Ne supprimez pas l\'icône TRIGONE : l\'abonnement aux notifications serait perdu. Rappel : Notice › Notifications.</p>' : '') +
                '<p class="JUM-R-ERREUR" id="JUM-R-ERREUR"></p>' +
            '</div>' +
            '<div class="JUM-R-PIED">' +
                // Inscription obligatoire pour tous à la première ouverture (valideurs et assistant Chorus DT compris).
                (premiere ? '' : '<button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_REGLAGES()">' + (vue === 'absence' ? 'Fermer' : 'Annuler') + '</button>') +
                '<button type="button" class="JUM-R-PRINCIPAL" onclick="JUMELAGE_ENREGISTRER_REGLAGES(' + (premiere ? 'true' : 'false') + ')">' + (premiere ? 'Continuer →' : 'Enregistrer') + '</button>' +
            '</div></div>';
        document.body.appendChild(reglages);
        var zoneBio = document.getElementById('JUM-R-BIO'); if (zoneBio) dessinerBioReglages(zoneBio);
        if (premiere) { brancherSaisieLiaison(reglages, false); brancherEtapesProfil(reglages); }
        var m = document.getElementById('JUM-R-MATRICULE');
        m.addEventListener('input', function() { m.value = formatMatricule(m.value); });
        ['VAL1', 'VAL2', 'CHORUS', 'ADMIN'].forEach(function(id) {
            var c = document.getElementById('JUM-R-' + id);
            c.addEventListener('change', function() { majCasesRoles(c.checked && !roleActif(c.getAttribute('data-role')) ? id : null); });
        });
        majCasesRoles(null);
        if (document.getElementById('JUM-R-ABS-OK')) initAbsence();
        // Ouvert depuis le menu du compte (« Mes rôles », « Absence ») : la fenêtre s'ouvre sur la bonne rubrique.
        var ancre = opts.section && document.getElementById('JUM-R-SECTION-' + opts.section.toUpperCase());
        if (ancre) setTimeout(function() { ancre.scrollIntoView({ block: 'start' }); }, 60);
    };
    // Profil en 3 étapes : chaque étape est vérifiée avant de passer à la suivante ; la dernière enregistre comme avant.
    var SVG_CADENAS_PF = '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    var ETAPES_PF = [
        ['Mon profil', 'Saisi une seule fois : il remplit chacune de vos demandes et de vos comptes-rendus.', ['GRADE', 'CIE', 'NOM', 'PRENOM', 'UNITE', 'MATRICULE']],
        ['Mon code d\'accès', '4 chiffres, demandés à chaque ouverture de TRIGONE : vos données restent protégées si l\'appareil est perdu.', []],
        ['Ma carte TRIGONE', 'Votre carte d\'identification TRIGONE, sur votre téléphone.', []],
        ['Mes rôles dans TRIGONE', 'Vous êtes missionnaire. Si d\'autres rôles vous sont confiés, cochez-les : chacun demande le code remis par votre unité.', []],
        ['À qui j\'envoie ?', '', ['MAILVAL1', 'MAILCHORUS']],
        ['Être prévenu', 'Demande signée ou refusée, compte-rendu attendu, rappel le jour du départ : sur le téléphone, et sur la montre qui lui est reliée.', []]
    ];
    var NB_PF = ETAPES_PF.length, pfAller = null;
    function brancherEtapesProfil(racine) {
        var n = 1, err = racine.querySelector('#JUM-R-ERREUR'), corps = racine.querySelector('.JUM-R-CORPS'), carteFaite = false;
        var CLE_PF = 'trigone_parcours_etape';
        function v(id) { var el = document.getElementById('JUM-R-' + id); return el ? el.value.trim() : ''; }
        function coche(id) { var el = document.getElementById('JUM-R-' + id); return !!(el && el.checked); }
        function majInit() {
            var t = ((v('PRENOM').charAt(0) || '') + (v('NOM').charAt(0) || '')).toUpperCase();
            racine.querySelector('#JUM-PF-INIT').textContent = t || '?';
        }
        ['NOM', 'PRENOM'].forEach(function(id) { document.getElementById('JUM-R-' + id).addEventListener('input', majInit); });
        majInit();
        // Identité de la carte, prise dans le formulaire (même forme que Mon profil une fois enregistré).
        function identiteForm() {
            var u = uniteConnue(v('UNITE')), roles = [].concat(coche('VAL1') ? ['VALIDEUR 1'] : [], coche('VAL2') ? ['VALIDEUR 2'] : [], coche('CHORUS') ? ['CHORUS DT'] : []);
            return { grade: v('GRADE').toUpperCase(), nom: v('NOM').toUpperCase(), prenom: v('PRENOM'), unite: u ? u.nom : v('UNITE').toUpperCase(), cie: v('CIE').toUpperCase(),
                nid: formatMatricule(v('MATRICULE')), missions: 0, roles: roles.length ? roles : ['MISSIONNAIRE'] };
        }
        function dessinerCarte() {
            var z = racine.querySelector('#JUM-PF-CARTE'); if (!z) return;
            z.innerHTML = carteRecto(identiteForm());
            racine.querySelector('#JUM-PF-PHOTO').textContent = '📷 ' + (lireTxt(CLE_CARTE_PHOTO) ? 'Changer ma photo' : 'Prendre ma photo');
        }
        racine.querySelector('#JUM-PF-PHOTO').addEventListener('click', function() { choisirPhoto(dessinerCarte); });
        // Destinataires : la liste des personnes de l'unité qui ont le rôle (serveur), un toucher remplit l'adresse.
        var annuaires = {};
        function chargerListes() {
            if (!monCompte() || !navigator.onLine) return;
            Array.prototype.forEach.call(racine.querySelectorAll('.JUM-PF-LISTE'), function(z) {
                var role = z.getAttribute('data-role'), champ = document.getElementById('JUM-R-' + z.getAttribute('data-pour'));
                var dessiner = function(tous) {
                    // Le champ sert aussi de recherche : un nom tapé filtre la liste (une adresse choisie la garde entière).
                    var q = champ.value.trim().toLowerCase(), l = tous;
                    if (q && !tous.some(function(x) { return x.mail === q; })) l = tous.filter(function(x) { return ([x.grade, x.nom, x.prenom].join(' ') + ' ' + x.mail).toLowerCase().indexOf(q) >= 0; });
                    z.innerHTML = l.length ? l.slice(0, 8).map(function(x) {
                        var qui = [x.grade, x.nom, x.prenom].filter(Boolean).join(' ') || x.mail;
                        return '<button type="button" class="JUM-PF-PERS' + (champ.value.trim().toLowerCase() === x.mail ? ' choisi' : '') + '" data-mail="' + esc(x.mail) + '"><b>' + esc(qui) + '</b><small>' + esc(x.mail) + '</small></button>';
                    }).join('') + (l.length > 8 ? '<p class="JUM-PF-VIDE">… tapez un nom pour affiner.</p>' : '') : tous.length ? '' : '<p class="JUM-PF-VIDE">Personne de votre unité n\'a encore ce rôle dans TRIGONE : saisissez son adresse, ou scannez sa carte.</p>';
                    Array.prototype.forEach.call(z.querySelectorAll('.JUM-PF-PERS'), function(b) {
                        b.addEventListener('click', function() { champ.value = b.getAttribute('data-mail'); dessiner(tous); err.textContent = ''; garderBrouillon(); });
                    });
                };
                champ.addEventListener('input', function() { if (annuaires[role]) dessiner(annuaires[role]); });
                if (annuaires[role]) { dessiner(annuaires[role]); return; }
                z.innerHTML = '<p class="JUM-PF-VIDE">Recherche dans votre unité…</p>';
                appelApi('annuaire?role=' + role).then(function(rep) {
                    var l = rep.personnes || [];
                    // VALIDEUR 2 et assistant Chorus DT : tout le groupe de l'unité, en tête (recommandé) ; le premier qui traite prend la main.
                    if (rep.groupe && l.length) l = [{ mail: rep.groupe, grade: '👥', nom: 'Tous les ' + (role === 'chorus' ? 'assistants Chorus DT' : 'VALIDEUR 2') + ' du ' + rep.unite, prenom: '(recommandé)', groupe: true }].concat(l);
                    annuaires[role] = l; dessiner(l);
                }, function() { z.innerHTML = ''; });
            });
        }
        function majDestinataires() {
            // Assistant Chorus DT et VALIDEUR 2 : le groupe de l'unité, pré-rempli (le premier disponible traite).
            [['MAILCHORUS', 'chorus'], ['MAILVAL2', 'valideur2']].forEach(function(x) { var c = document.getElementById('JUM-R-' + x[0]); if (c && !c.value.trim()) c.value = adresseGroupe(x[1], v('UNITE')); });
            racine.querySelector('#JUM-PF-DEST-V1').style.display = coche('VAL1') ? '' : 'none';
            racine.querySelector('#JUM-PF-DEST-V2').style.display = coche('VAL2') ? '' : 'none';
            var r = ['missionnaire'].concat(coche('VAL1') ? ['VALIDEUR 1'] : [], coche('VAL2') ? ['VALIDEUR 2'] : []);
            return 'Selon vos rôles (' + r.join(' + ') + ') : choisissez dans la liste de votre unité, ou scannez leur carte TRIGONE.';
        }
        function majNotif() {
            var e = notifEtat(), t = racine.querySelector('#JUM-PF-NOTIF-ETAT'), b = racine.querySelector('#JUM-PF-NOTIF');
            var ok = e === 'active' || e === 'autorisee';
            b.style.display = ok ? 'none' : '';
            t.textContent = ok ? '✔ Notifications activées sur cet appareil.' : e === 'refusee' ? 'Notifications bloquées : réglages du navigateur › Notifications › TRIGONE.' : e === 'ios' ? '' : e === 'impossible' ? 'Ce navigateur ne permet pas les notifications.' : !monCompte() ? 'Disponibles avec votre compte TRIGONE.' : '';
        }
        racine.querySelector('#JUM-PF-NOTIF').addEventListener('click', function() {
            var b = this; b.disabled = true;
            window.JUMELAGE_ACTIVER_NOTIF().then(function() { majNotif(); }, function(e) { racine.querySelector('#JUM-PF-NOTIF-ETAT').textContent = e.message; }).then(function() { b.disabled = false; });
        });
        function afficher() {
            Array.prototype.forEach.call(racine.querySelectorAll('[data-etape]'), function(e) { e.style.display = +e.getAttribute('data-etape') === n ? '' : 'none'; });
            Array.prototype.forEach.call(racine.querySelectorAll('.JUM-PF-BARRES i'), function(b) { b.classList.toggle('fait', +b.getAttribute('data-b') <= n + 1); });
            racine.querySelector('#JUM-PF-NUM').textContent = 'Étape ' + (n + 1) + ' sur ' + (NB_PF + 1);
            racine.querySelector('#JUM-PF-TITRE').textContent = ETAPES_PF[n - 1][0];
            racine.querySelector('#JUM-PF-TEXTE').textContent = n === 5 ? majDestinataires() : n === 3 ? (monCompte() ? 'Votre carte d\'identification TRIGONE. Votre responsable la scanne pour valider votre compte.' : ETAPES_PF[2][1]) : ETAPES_PF[n - 1][1];
            racine.querySelector('#JUM-PF-RETOUR').style.display = n > 1 ? '' : 'none';
            racine.querySelector('#JUM-PF-SUIVANT').textContent = n === 3 ? 'Créer ma carte' : n < NB_PF ? 'Continuer' : 'Terminer';
            racine.querySelector('#JUM-PF-PLUSTARD').style.display = n === 3 || n === 6 ? '' : 'none';
            if (n === 3) dessinerCarte();
            if (n === 5) chargerListes();
            if (n === 6) majNotif();
            err.textContent = ''; corps.scrollTop = 0; racine.scrollTop = 0;
            garderBrouillon();
        }
        pfAller = function(k) { n = k; afficher(); };
        racine.addEventListener('input', function() { garderBrouillon(); });
        // Brouillon : l'appli fermée en cours de route reprend à la même étape (codes jamais gardés : redemandés).
        var CHAMPS_BR = ['GRADE', 'CIE', 'NOM', 'PRENOM', 'UNITE', 'MATRICULE', 'MAILVAL1', 'MAILCHORUS', 'MAILVAL2', 'FONCTION1', 'FONCTION2', 'RESALIB'];
        function garderBrouillon() {
            var ch = {}, ro = {};
            CHAMPS_BR.forEach(function(id) { ch[id] = v(id); });
            ['VAL1', 'VAL2', 'CHORUS', 'ADMIN'].forEach(function(id) { ro[id] = coche(id); });
            ecrireTxt(CLE_PF, JSON.stringify({ n: n, ch: ch, ro: ro, mail: (monCompte() || {}).mail || '' }));
        }
        function refuser(t) { err.textContent = '⛔ ' + t; return false; }
        function etapeOk() {
            if (ETAPES_PF[n - 1][2].some(function(id) { return !v(id); })) return refuser(n === 5 ? 'Choisissez votre VALIDEUR 1 et l\'assistant Chorus DT.' : 'Merci de remplir tous les champs avant de continuer.');
            if (n === 1 && !uniteConnue(v('UNITE'))) return refuser('Choisissez votre unité dans la liste : tapez les premières lettres (ex : 4°RIISC).');
            if (n === 1 && chiffres(v('MATRICULE')).length !== 10) return refuser('Le matricule doit comporter 10 chiffres (ex : 067 50 10 191).');
            if (n === 2 && !codeDefini() && !v('CODE1')) return refuser('Choisissez un code d\'accès à 4 chiffres.');
            if (n === 2 && (v('CODE1') || v('CODE2'))) {
                if (!/^\d{4}$/.test(v('CODE1'))) return refuser('Le code doit contenir exactement 4 chiffres.');
                if (v('CODE1') !== v('CODE2')) return refuser('Les deux codes ne correspondent pas.');
            }
            if (n === 4) {
                var nouv = ['VAL1', 'VAL2', 'CHORUS', 'ADMIN'].filter(function(id) { var c = document.getElementById('JUM-R-' + id); return c.checked && !roleActif(c.getAttribute('data-role')) && !v('CODE' + id); })[0];
                if (nouv) return refuser('Saisissez le code ' + { VAL1: 'VALIDEUR 1', VAL2: 'VALIDEUR 2', CHORUS: 'ASSIST CHORUS DT', ADMIN: 'ADMINISTRATEUR' }[nouv] + ', ou décochez la case.');
                if (coche('VAL1') && !v('FONCTION1')) return refuser('Indiquez votre fonction de VALIDEUR 1 (ex : COMMANDANT D\'UNITÉ).');
                if (coche('VAL2') && !v('FONCTION2')) return refuser('Indiquez votre fonction de VALIDEUR 2 (ex : CHEF DE CORPS).');
            }
            if (n === 5) {
                var ms = ['MAILVAL1', 'MAILCHORUS'].concat(coche('VAL1') ? ['MAILVAL2'] : []);
                if (coche('VAL1') && !v('MAILVAL2')) return refuser('Comme VALIDEUR 1 : choisissez le VALIDEUR 2 à qui vous transmettez.');
                if (ms.some(function(id) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(id)); })) return refuser('Une adresse n\'est pas valide.');
                if (!v('MONMAIL') && monCompte()) document.getElementById('JUM-R-MONMAIL').value = monCompte().mail;
            }
            return true;
        }
        function suivant() {
            if (n < NB_PF) { n++; afficher(); var f = racine.querySelector('[data-etape="' + n + '"] input:not([disabled])'); if (f && n !== 4 && n !== 5) f.focus(); return; }
            window.JUMELAGE_ENREGISTRER_REGLAGES(true);
        }
        racine.querySelector('#JUM-PF-SUIVANT').addEventListener('click', function() {
            if (!etapeOk()) return;
            // Carte : identifiant demandé au serveur (QR code du verso), sans bloquer si le réseau manque.
            if (n === 3 && monCompte() && !carteFaite) {
                var b = this; b.disabled = true; b.textContent = 'Création de la carte…';
                window.JUMELAGE_CARTE_ID(identiteForm()).then(function() { carteFaite = true; }, function() {}).then(function() { b.disabled = false; suivant(); });
                return;
            }
            suivant();
        });
        racine.querySelector('#JUM-PF-PLUSTARD').addEventListener('click', function() { suivant(); });
        racine.querySelector('#JUM-PF-RETOUR').addEventListener('click', function() { if (n > 1) { n--; afficher(); } });
        racine.addEventListener('keydown', function(e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); racine.querySelector('#JUM-PF-SUIVANT').click(); } });
        var br = lireJSON(CLE_PF);
        if (br && br.ch && br.mail === ((monCompte() || {}).mail || '')) {
            CHAMPS_BR.forEach(function(id) { var el = document.getElementById('JUM-R-' + id); if (el && br.ch[id] && !el.value) el.value = br.ch[id]; });
            ['VAL1', 'VAL2', 'CHORUS', 'ADMIN'].forEach(function(id) { var el = document.getElementById('JUM-R-' + id); if (el && br.ro && br.ro[id]) el.checked = true; });
            majCasesRoles(null); majInit();
            n = Math.max(1, Math.min(NB_PF, +br.n || 1));
            if (n > 2 && !codeDefini()) n = 2;
            if (n > 4 && ['VAL1', 'VAL2', 'CHORUS', 'ADMIN'].some(function(id) { var el = document.getElementById('JUM-R-' + id); return el.checked && !roleActif(el.getAttribute('data-role')); })) n = 4;
        }
        afficher();
    }
    // Fin du parcours : bienvenue, au style de l'écran d'ouverture.
    function bienvenueParcours() {
        try { localStorage.removeItem('trigone_parcours_etape'); } catch (e) {}
        var rg = lireReglages(), c = monCompte(), attente = !!lireTxt(CLE_ATTENTE), photo = !!lireTxt(CLE_CARTE_PHOTO), dossier = DANS_CR ? '../' : '';
        var f = document.createElement('div'); f.className = 'JUM-BIENV'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Bienvenue dans TRIGONE');
        var li = function(ok, t) { return '<li class="' + (ok ? 'ok' : 'att') + '">' + t + '</li>'; };
        f.innerHTML = '<div class="JUM-BIENV-PAGE"><div class="JUM-BIENV-ECU"><img src="' + dossier + 'phoenix-icon.png" alt=""></div>' +
            '<div class="JUM-BIENV-SUR">Inscription terminée</div>' +
            '<h2>Bienvenue dans TRIGONE,<br><em>' + esc([rg.grade, rg.nom].filter(Boolean).join(' ')) + '</em></h2><i class="JUM-BIENV-TRAIT"></i>' +
            '<p>Votre espace est prêt. Préparez vos missions, suivez vos validations et rendez vos comptes-rendus, au même endroit.</p>' +
            '<ul>' + (c ? li(true, 'Compte ' + esc(c.mail)) : '') + li(true, 'Profil et destinataires') + li(true, 'Code d\'accès') + li(true, 'Carte TRIGONE' + (photo ? '' : ' (photo à ajouter)')) +
                (notifEtat() === 'active' || notifEtat() === 'autorisee' ? li(true, 'Notifications') : '') +
                (attente ? li(false, 'Validation par votre unité : montrez votre carte TRIGONE à un responsable') : '') + '</ul>' +
            '<div class="JUM-BIENV-SIGN">— L\'équipe TRIGONE</div>' +
            '<button type="button" class="JUM-BIENV-BTN">Entrer dans TRIGONE</button></div>';
        document.body.appendChild(f);
        f.querySelector('.JUM-BIENV-BTN').addEventListener('click', function() { f.remove(); });
    }
    // Absence : état actuel (lu sur le serveur), déclaration et fin.
    var NOMS_ROLES_ABS = { valideur1: 'VALIDEUR 1', valideur2: 'VALIDEUR 2', chorus: 'ASSIST CHORUS DT' };
    function initAbsence() {
        var etat = document.getElementById('JUM-R-ABS-ETAT'), err = document.getElementById('JUM-R-ABS-ERR'), btn = document.getElementById('JUM-R-ABS-OK');
        var champs = Array.prototype.slice.call(document.querySelectorAll('[data-role-abs]')), champFin = document.getElementById('JUM-R-ABSFIN'), bloc = document.getElementById('JUM-R-ABS-CHAMPS');
        var jour = function(ms) { return new Date(ms).toLocaleDateString('fr-FR'); }, actuel = null;
        function afficher(rp) {
            actuel = rp;
            var parRole = rp ? rp.roles || Object.fromEntries(Object.keys(NOMS_ROLES_ABS).filter(roleActif).map(function(r) { return [r, rp.mail]; })) : {};
            etat.innerHTML = rp ? '<b>Absent jusqu\'au ' + jour(rp.jusqu) + '</b> :<br>' + Object.keys(NOMS_ROLES_ABS).filter(function(r) { return parRole[r] || roleActif(r); }).map(function(r) {
                return NOMS_ROLES_ABS[r] + ' → ' + (parRole[r] ? '<b>' + esc(parRole[r]) + '</b>' : 'reste chez vous');
            }).join('<br>') : '';
            btn.textContent = rp ? 'Fin de l\'absence (je suis de retour)' : 'Déclarer mon absence';
            bloc.style.display = rp ? 'none' : '';
        }
        var d = new Date(); d.setDate(d.getDate() + 1); champFin.min = d.toISOString().slice(0, 10);
        appelApi('cles?mail=' + encodeURIComponent(monCompte().mail)).then(function(r) { afficher(r.remplacant || null); }).catch(function() {});
        btn.addEventListener('click', function() {
            err.textContent = '';
            var corps = { roles: {} };
            if (!actuel) {
                champs.forEach(function(c) { var v = c.value.trim().toLowerCase(); if (v) corps.roles[c.getAttribute('data-role-abs')] = v; });
                if (!Object.keys(corps.roles).length || !champFin.value) { err.textContent = 'Indiquez au moins un remplaçant et la date de fin.'; return; }
                corps.jusqu = new Date(champFin.value + 'T23:59:59').getTime();
            }
            btn.disabled = true;
            appelApi('remplacant', { methode: 'POST', corps: corps }).then(function(r) {
                afficher(r.remplacant);
                bandeau(r.remplacant ? 'Absence enregistrée jusqu\'au ' + jour(r.remplacant.jusqu) + '.' : 'Fin de l\'absence : vos envois vous reviennent.');
            }).catch(function(e) { err.textContent = e.message; }).then(function() { btn.disabled = false; });
        });
    }
    // Rôles : case cochée pas encore active → champ du code ; valideur → fonction (reprise dans ses signatures).
    function roleActif(role) { return role === 'chorus' ? roleChorus() : role === 'admin' ? !!lireTxt(CLE_ROLE_ADMIN) : !!(lireJSON(CLE_ROLES_LOCAUX) || {})[role]; }
    function caseRole(id, role, libelle, libelleCode) {
        var actif = roleActif(role);
        return '<label class="JUM-R-CASE"><input type="checkbox" id="JUM-R-' + id + '" data-role="' + role + '"' + (actif ? ' checked' : '') + '><span>' + libelle +
            (actif ? ' <em class="JUM-R-ACTIF">✓ actif</em>' : '') + '</span></label>' +
            '<div id="JUM-R-' + id + '-CODE" style="display:none;"><div class="JUM-R-CHAMP"><label for="JUM-R-CODE' + id + '">' + libelleCode + '</label>' +
            '<input id="JUM-R-CODE' + id + '" type="password" autocomplete="off" placeholder="Code remis par l\'administrateur"></div></div>';
    }
    function majCasesRoles(focus) {
        ['VAL1', 'VAL2', 'CHORUS', 'ADMIN'].forEach(function(id) {
            var c = document.getElementById('JUM-R-' + id); if (!c) return;
            document.getElementById('JUM-R-' + id + '-CODE').style.display = c.checked && !roleActif(c.getAttribute('data-role')) ? '' : 'none';
            var f = document.getElementById('JUM-R-FONCTION' + id.slice(3) + '-BLOC'); if (f) f.style.display = c.checked ? '' : 'none';
        });
        if (focus) document.getElementById('JUM-R-CODE' + focus).focus();
    }
    // Codes valideurs : le code déchiffre la clé de signature de son rôle, publiée chiffrée dans valideurs.json (comme
    // à la connexion de l'Espace valideur). La clé déverrouillée est mémorisée pour Mise en route (même base IndexedDB).
    function listeValideurs() {
        return fetch(APPLIS.mer.url + 'valideurs.json?t=' + Date.now(), { cache: 'no-store' }).then(function(r) {
            if (!r.ok) throw new Error('liste'); return r.json();
        }).then(function(l) { ecrireTxt('mer_liste_valideurs', JSON.stringify(l)); return l; }).catch(function() {
            var l = lireJSON('mer_liste_valideurs'); if (l) return l;
            return (window.caches ? caches.match(APPLIS.mer.url + 'valideurs.json', { ignoreSearch: true }) : Promise.resolve(null))
                .then(function(r) { return r ? r.json() : { valideurs: [] }; }).catch(function() { return { valideurs: [] }; });
        });
    }
    function baseMer() {
        return new Promise(function(ok, ko) {
            var r = indexedDB.open('trigone-mise-en-route', 2);
            r.onupgradeneeded = function() {
                var noms = r.result.objectStoreNames;
                if (!noms.contains('pieces')) r.result.createObjectStore('pieces');
                if (!noms.contains('acces')) r.result.createObjectStore('acces');
            };
            r.onsuccess = function() { ok(r.result); }; r.onerror = function() { ko(r.error); };
        });
    }
    // Clés : « valideur » (rôle en cours dans l'Espace valideur), « valideur1 » et « valideur2 » (un rôle chacune).
    function accesValideur(action, valeur, cle) {
        cle = cle || 'valideur';
        return baseMer().then(function(db) { return new Promise(function(ok, ko) {
            var tx = db.transaction('acces', action === 'lire' ? 'readonly' : 'readwrite'), st = tx.objectStore('acces');
            var r = action === 'lire' ? st.get(cle) : action === 'effacer' ? st.delete(cle) : st.put(valeur, cle);
            tx.oncomplete = function() { db.close(); ok(action === 'lire' ? (r.result || null) : null); };
            tx.onerror = function() { db.close(); ko(tx.error); };
        }); });
    }
    function verifierCodeValideur(code, niveau) {
        var octets = function(t) { return new TextEncoder().encode(t); };
        return listeValideurs().then(function(liste) {
            var acces = (liste.valideurs || []).filter(function(a) { return a.role === niveau && a.prive && !a.retire; });
            return acces.reduce(function(prec, a) {
                return prec.catch(function() {
                    return crypto.subtle.importKey('raw', octets(code), 'PBKDF2', false, ['deriveKey']).then(function(base) {
                        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: depuisB64(a.sel), iterations: 250000, hash: 'SHA-256' },
                            base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
                    }).then(function(k) {
                        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: depuisB64(a.iv) }, k, depuisB64(a.prive));
                    }).then(function(pkcs8) {
                        return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
                    }).then(function(k) { return { cle: k, pub: a.cle }; });
                });
            }, Promise.reject(new Error('code')));
        }).catch(function() { throw 'Code VALIDEUR ' + niveau + ' incorrect.'; });
    }
    // Rôle valideur retiré : sa clé est oubliée ; si c'était le rôle en cours, l'autre rôle (s'il existe) prend la suite.
    function oublierAccesValideur(niveau) {
        var autre = niveau === 1 ? 2 : 1;
        return Promise.all([accesValideur('lire'), listeValideurs(), accesValideur('lire', null, 'valideur' + autre), accesValideur('effacer', null, 'valideur' + niveau)]).then(function(r) {
            var m = r[0]; if (!m) return;
            var a = (r[1].valideurs || []).filter(function(x) { return x.cle === m.pub; })[0];
            if (!a || a.role === niveau) return r[2] ? accesValideur('ecrire', r[2]) : accesValideur('effacer');
        }).catch(function() {});
    }
    window.JUMELAGE_FERMER_REGLAGES = function() { if (reglages) { reglages.remove(); reglages = null; } }; fermeurs.push([function() { return reglages; }, window.JUMELAGE_FERMER_REGLAGES]);
    window.JUMELAGE_PASSER_REGLAGES = function() {
        ecrireTxt('mer_config_faite', '1'); ecrireTxt('trigone_premier_lancement_fait', '1');
        window.JUMELAGE_FERMER_REGLAGES();
        if (window.JUMELAGE_APRES_REGLAGES) try { window.JUMELAGE_APRES_REGLAGES(); } catch (e) {}
    };
    window.JUMELAGE_SUPPRIMER_CODE = function() {
        if (!window.confirm('Supprimer le code d\'accès ? TRIGONE s\'ouvrira sans code.')) return;
        window.JUMELAGE_EFFACER_CODE();
        window.JUMELAGE_FERMER_REGLAGES(); window.JUMELAGE_REGLAGES();
    };
    window.JUMELAGE_ENREGISTRER_REGLAGES = function(premiere) {
        function v(id) { var el = document.getElementById('JUM-R-' + id); return el ? el.value.trim() : ''; }
        var err = document.getElementById('JUM-R-ERREUR');
        function refuser(t) {
            // Parcours de première connexion : retour à l'étape concernée (rôles, code, profil).
            if (premiere && pfAller && document.querySelector('.JUM-PF-CARTE')) pfAller(/code d'accès|4 chiffres|deux codes/i.test(t) ? 2 : /VALIDEUR|CHORUS|ADMINISTRATEUR|fonction|Code /i.test(t) ? 4 : /mail|adresse/i.test(t) ? 5 : 1);
            err.textContent = '⛔ ' + t; err.scrollIntoView({ block: 'nearest' });
        }
        var r = { unite: v('UNITE').toUpperCase(), cie: v('CIE').toUpperCase(), grade: v('GRADE').toUpperCase(), nom: v('NOM').toUpperCase(), prenom: v('PRENOM'),
            matricule: formatMatricule(v('MATRICULE')), mailVal1: v('MAILVAL1'), monMail: v('MONMAIL'), mailChorus: v('MAILCHORUS'),
            resaActive: !!(document.getElementById('JUM-R-RESA') || {}).checked, resaLibelle: v('RESALIB') };
        var c1 = v('CODE1'), c2 = v('CODE2');
        if (premiere && (!r.unite || !r.cie || !r.grade || !r.nom || !r.prenom || !r.matricule || !r.mailVal1 || !r.monMail || !r.mailChorus))
            return refuser('Merci de remplir tous les champs avant de continuer.');
        if (r.unite) { var uc = uniteConnue(r.unite); if (!uc) return refuser('Choisissez votre unité dans la liste : tapez les premières lettres (ex : 4°RIISC).'); r.unite = uc.nom; }
        if (r.matricule && chiffres(r.matricule).length !== 10) return refuser('Le matricule doit comporter 10 chiffres (ex : 067 50 10 191).');
        var mails = [r.mailVal1, r.monMail, r.mailChorus].filter(Boolean);
        if (mails.some(function(m) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m); })) return refuser('Une adresse mail n\'est pas valide.');
        if (premiere && !codeDefini() && !c1) return refuser('Choisissez un code d\'accès à 4 chiffres.');
        if (c1 || c2) {
            if (!/^\d{4}$/.test(c1)) return refuser('Le code doit contenir exactement 4 chiffres.');
            if (c1 !== c2) return refuser('Les deux codes ne correspondent pas.');
        }
        // Rôles : chaque rôle nouvellement coché est vérifié avec son code avant tout enregistrement.
        var roles = ['VAL1', 'VAL2', 'CHORUS', 'ADMIN'].map(function(id) {
            var c = document.getElementById('JUM-R-' + id), role = c.getAttribute('data-role');
            return { id: id, role: role, niveau: id === 'VAL1' ? 1 : id === 'VAL2' ? 2 : 0, veut: c.checked, actif: roleActif(role), code: v('CODE' + id) };
        });
        var fonctions = { 1: v('FONCTION1').toUpperCase(), 2: v('FONCTION2').toUpperCase() };
        var nouveaux = roles.filter(function(x) { return x.veut && !x.actif; });
        var sansCode = nouveaux.filter(function(x) { return !x.code; })[0];
        if (sansCode) return refuser('Saisissez le code ' + { VAL1: 'VALIDEUR 1', VAL2: 'VALIDEUR 2', CHORUS: 'ASSIST CHORUS DT', ADMIN: 'ADMINISTRATEUR' }[sansCode.id] + ', ou décochez la case.');
        var sansFonction = roles.filter(function(x) { return x.niveau && x.veut && !fonctions[x.niveau]; })[0];
        if (sansFonction) return refuser('Indiquez votre fonction de VALIDEUR ' + sansFonction.niveau + ' (ex : ' + (sansFonction.niveau === 1 ? 'COMMANDANT D\'UNITÉ' : 'CHEF DE CORPS') + ').');
        if (roles.some(function(x) { return x.niveau && x.veut; }) && (!r.grade || !r.nom || !r.prenom)) return refuser('Un valideur signe avec son grade, son nom et son prénom : renseignez-les.');
        var acces = {};
        var etapeRole = nouveaux.reduce(function(prec, x) {
            return prec.then(function() {
                if (x.niveau) return verifierCodeValideur(x.code, x.niveau).then(function(a) { acces[x.niveau] = a; });
                // ADMINISTRATEUR : code vérifié par le serveur seul (il n'est nulle part dans l'appli).
                if (x.id === 'ADMIN') {
                    if (!monCompte()) throw 'Connectez-vous d\'abord à votre compte TRIGONE.';
                    if (!normeUnite(r.unite)) throw 'Indiquez votre unité dans Mon profil : vous serez administrateur de cette unité.';
                    return appelApi('role/admin', { methode: 'POST', corps: { code: x.code, actif: true } }).then(function(a) { ecrireTxt(CLE_ROLE_ADMIN, a.admin || '1'); }, function(e) { throw e.message || 'Code ADMINISTRATEUR incorrect.'; });
                }
                return empreinteCodeChorus(x.code).then(function(h) { if (h !== EMPREINTE_CODE_CHORUS) throw 'Code ASSIST CHORUS DT incorrect.'; });
            });
        }, Promise.resolve());
        etapeRole.then(function() {
        var roleAvant = roleChorus(), veutChorus = roles[2].veut;
        try { if (veutChorus) localStorage.setItem(CLE_ROLE_CHORUS, '1'); else localStorage.removeItem(CLE_ROLE_CHORUS); } catch (e) {}
        var changes = roles.filter(function(x) { return x.veut !== x.actif; });
        changes.forEach(function(x) {
            if (x.role !== 'admin') window.JUMELAGE_DECLARER_ROLE(x.role, x.veut);
            else if (!x.veut) { try { localStorage.removeItem(CLE_ROLE_ADMIN); } catch (e) {} appelApi('role/admin', { methode: 'POST', corps: { actif: false } }).catch(function() {}); }
        });
        // Valideur : identité de signature (Espace valideur de Mise en route) et clé déverrouillée.
        if (roles.some(function(x) { return x.niveau && x.veut; })) {
            var val = lireJSON('mer_valideur') || {};
            val.grade = r.grade; val.nom = r.nom; val.prenom = r.prenom;
            // Une fonction par niveau (signature du PDF) ; « fonction » : celle du premier rôle (ancien format).
            if (roles[0].veut) val.fonction1 = fonctions[1]; if (roles[1].veut) val.fonction2 = fonctions[2];
            val.fonction = roles[0].veut ? fonctions[1] : fonctions[2];
            // Destinataires du valideur (parcours de première connexion) : VALIDEUR 2 pour le VALIDEUR 1, assistant
            // Chorus DT pour le VALIDEUR 2.
            if (roles[0].veut && v('MAILVAL2')) val.mailValideur2 = v('MAILVAL2').toLowerCase();
            if (roles[1].veut && r.mailChorus && !val.mailChorus) val.mailChorus = r.mailChorus;
            ecrireTxt('mer_valideur', JSON.stringify(val));
        }
        var parcours = premiere && !!document.querySelector('.JUM-PF-CARTE');
        // Une clé par rôle ; le rôle en cours de l'Espace valideur devient le premier rôle nouvellement activé.
        var etapeAcces = Promise.all(Object.keys(acces).map(function(n) { return accesValideur('ecrire', acces[n], 'valideur' + n); }))
            .then(function() { var n = acces[1] ? 1 : acces[2] ? 2 : 0; return n ? accesValideur('ecrire', acces[n]) : null; }).catch(function() {});
        roles.forEach(function(x) { if (x.niveau && x.actif && !x.veut) etapeAcces = etapeAcces.then(function() { return oublierAccesValideur(x.niveau); }); });
        ecrireReglages(r);
        Promise.all([c1 ? poserCode(c1) : Promise.resolve(), etapeAcces]).then(function() {
            window.JUMELAGE_FERMER_REGLAGES();
            if (roleAvant !== veutChorus && ecran) { ecran.remove(); ecran = null; window.JUMELAGE_CHOIX(); }
            var actives = changes.filter(function(x) { return x.veut; }).map(function(x) { return { VAL1: 'VALIDEUR 1', VAL2: 'VALIDEUR 2', CHORUS: 'ASSIST CHORUS DT' }[x.id]; });
            if (parcours) { profilApresConnexion = false; bienvenueParcours(); }
            else bandeau(actives.length ? (actives.length > 1 ? 'Rôles ' : 'Rôle ') + actives.join(' et ') + (actives.length > 1 ? ' activés' : ' activé') + (roles[2].veut && !roles[2].actif ? ' : votre espace Assistant Chorus DT est au centre de l\'écran de choix.' : ' : votre boîte TRIGONE reçoit les demandes à signer.') :
                premiere ? 'C\'est prêt : vos informations pré-rempliront Mise en route et Compte-rendu.' : 'Réglages enregistrés.');
            if (changes.length && window.JUMELAGE_ROLES_CHANGES) try { window.JUMELAGE_ROLES_CHANGES(); } catch (e) {}
            if (window.JUMELAGE_APRES_REGLAGES) try { window.JUMELAGE_APRES_REGLAGES(); } catch (e) {}
            majBoutonsCompte();
            if (profilApresConnexion) {
                profilApresConnexion = false;
                if (monCompte() && (notifEtat() === 'a-demander' || notifEtat() === 'autorisee')) setTimeout(window.JUMELAGE_COMPTE, 2900); else suivreNotif();
            }
        });
        }, function(message) { refuser(message); });
    };
    // Notification à l'écran : la glisser (vers le haut si elle est en haut, vers le bas si elle est en bas) la ferme.
    // Un simple toucher garde son action ; un glissement ne la déclenche pas.
    window.JUMELAGE_GLISSER_FERMER = function(el, sens, fermer) {
        var y0 = null, dy = 0, glisse = false, base = '';
        el.style.touchAction = 'none';
        el.addEventListener('pointerdown', function(e) { el.style.transform = ''; base = getComputedStyle(el).transform; y0 = e.clientY; dy = 0; glisse = false; el.style.transition = 'none'; try { el.setPointerCapture(e.pointerId); } catch (x) {} });
        el.addEventListener('pointermove', function(e) {
            if (y0 === null) return;
            dy = e.clientY - y0; if (sens * dy < 0) dy = dy / 4;
            if (Math.abs(dy) > 8) glisse = true;
            el.style.transform = (base && base !== 'none' ? base + ' ' : '') + 'translateY(' + dy + 'px)';
            el.style.opacity = String(Math.max(0.2, 1 - Math.abs(dy) / 120));
        });
        function fin() {
            if (y0 === null) return; y0 = null;
            el.style.transition = 'transform .25s ease, opacity .25s ease';
            if (sens * dy > 36) {
                el.style.transform = (base && base !== 'none' ? base + ' ' : '') + 'translateY(' + (sens * 160) + 'px)'; el.style.opacity = '0';
                setTimeout(function() { el.remove(); if (fermer) fermer(); }, 250);
            } else { el.style.transform = ''; el.style.opacity = ''; }
        }
        el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
        el.addEventListener('click', function(e) { if (glisse) { e.stopImmediatePropagation(); e.preventDefault(); glisse = false; } }, true);
    };
    function bandeau(texte) {
        var b = document.createElement('div');
        b.className = 'JUM-BANDEAU'; b.textContent = '✓ ' + texte;
        document.body.appendChild(b);
        window.JUMELAGE_GLISSER_FERMER(b, 1);
        setTimeout(function() { b.classList.add('sortie'); }, 2600);
        setTimeout(function() { b.remove(); }, 3100);
    }

    // ---------- Notice TRIGONE (livret à pages qui tournent) ----------
    // Contenu et mise en forme : notice/notice.js ; pages qui tournent : vendor/page-flip.min.js (chargés à la première ouverture).
    // Téléphone : une page à la fois ; PC ou écran large : le livre ouvert, deux pages. chapitre : id d'un chapitre (ex. 'carte').
    var fenNotice = null;
    var PLEIN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    var QUITTER_PLEIN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
    window.JUMELAGE_NOTICE_BOUTON = function() {
        return '<button type="button" class="JUM-NOTICE-LIVRET" onclick="JUMELAGE_NOTICE()"><img src="' + (DANS_CR ? '../' : '') + 'phoenix-icon.png" alt="">' +
            '<span><b>Notice TRIGONE</b><small>Le livret complet : chaque écran expliqué pas à pas</small></span><i>›</i></button>';
    };
    // Notice selon les rôles : missionnaire (0), VALIDEUR 1 / 2 (1), assistant Chorus DT ou administrateur (2 : complète).
    function niveauNotice() { var r = rolesLocaux(); return r.chorus || lireTxt(CLE_ROLE_ADMIN) ? 2 : r.valideur1 || r.valideur2 ? 1 : 0; }
    window.JUMELAGE_NOTICE_NIVEAU = niveauNotice;
    window.JUMELAGE_NOTICE_COMPLETE = function(chapitre) { window.JUMELAGE_NOTICE(chapitre, { complete: true }); };
    window.JUMELAGE_NOTICE = function(chapitre, opts) {
        if (fenNotice) return;
        opts = opts || {};
        var B = DANS_CR ? '../' : '', f = document.createElement('div'), livre = null, page = 0, N = null;
        f.className = 'JUM-SIG JUM-NOTICE'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Notice TRIGONE');
        f.innerHTML = '<div class="N-HAUT"><button type="button" class="N-FERMER" aria-label="Fermer la notice">✕</button><span class="N-TITRE">Notice TRIGONE</span>' +
            '<button type="button" class="N-SOMMAIRE">Sommaire</button>' +
            (document.fullscreenEnabled && f.requestFullscreen ? '<button type="button" class="N-PLEIN" aria-label="Plein écran" title="Plein écran">' + PLEIN_SVG + '</button>' : '') + '<span class="N-NUM"></span></div><div class="N-SCENE"><div class="N-CHARGE">Ouverture de la notice…</div></div>' +
            '<button type="button" class="N-FLECHE N-PREC" aria-label="Page précédente">‹</button><button type="button" class="N-FLECHE N-SUIV" aria-label="Page suivante">›</button>';
        var scene = f.querySelector('.N-SCENE'), num = f.querySelector('.N-NUM');
        var majNum = function() {
            if (!N) return; var n = N.pages.length;
            num.textContent = page === 0 ? 'Couverture' : page >= n - 1 ? 'Dos' : (page + 1) + ' / ' + n;
            f.querySelector('.N-PREC').disabled = page <= 0; f.querySelector('.N-SUIV').disabled = page >= n - 1;
        };
        var aller = function(n) { if (livre) { if (Math.abs(n - page) > 1) livre.turnToPage(n); else livre.flip(n); page = n; majNum(); } };
        var construire = function() {
            if (livre) { try { page = livre.getCurrentPageIndex(); livre.destroy(); } catch (e) {} livre = null; }
            scene.innerHTML = '';
            var deux = f.clientWidth > f.clientHeight && f.clientWidth >= 700, r = 566 / 400;
            f.classList.toggle('tel', !deux);
            var W = scene.clientWidth, H = scene.clientHeight;
            // Téléphone : la page prend toute la hauteur de l'écran (page plus haute que 566, le texte respire, les captures grandissent).
            var pw = deux ? Math.min((W - 130) / 2, (H - 24) / r) : Math.min(W - (f.classList.contains('plein') ? 0 : 12), 480, (H - 8) / r);
            pw = Math.floor(pw); var e = pw / 400, hl = deux ? 566 : Math.max(566, Math.min(860, Math.floor((H - 8) / e))), ph = Math.floor(hl * e);
            // Livre posé à hauteur fixe (pas centré par flex) : il ne saute pas pendant que la page tourne.
            var el = document.createElement('div'); el.className = 'N-LIVRE'; el.style.marginTop = Math.max(0, Math.floor((H - ph) / 2)) + 'px'; el.style.height = ph + 'px';
            el.innerHTML = N.pages.map(function(p, i) {
                return '<div class="N-PAGE"' + (p.couverture && deux ? ' data-density="hard"' : '') + '><div class="N-ECH' + (hl > 640 ? ' haut' : '') + '" style="height:' + hl + 'px;transform:scale(' + e + ')">' + p.html.replace(/\{B\}/g, B) +
                    (p.couverture || i < 2 ? '' : '<div class="N-NUMP">' + (i + 1) + '</div>') + '</div></div>';
            }).join('');
            scene.appendChild(el);
            livre = new window.St.PageFlip(el, { width: pw, height: ph, size: 'fixed', showCover: true, usePortrait: !deux, flippingTime: 1100, maxShadowOpacity: 0.55, mobileScrollSupport: false, startPage: page, swipeDistance: 100000 });
            livre.loadFromHTML(el.querySelectorAll('.N-PAGE'));
            livre.on('flip', function(ev) { page = ev.data; majNum(); });
            el.addEventListener('click', function(ev) {
                var b = ev.target.closest && ev.target.closest('[data-aller]'), z = ev.target.closest && ev.target.closest('[data-zoom]');
                if (b) { ev.stopPropagation(); aller(+b.getAttribute('data-aller')); }
                if (z) { ev.stopPropagation(); agrandir(z.getAttribute('data-zoom')); }
            });
            majNum();
        };
        // Capture touchée : affichée en grand, par-dessus le livre.
        var agrandir = function(src) {
            var z = document.createElement('div'); z.className = 'N-ZOOM'; z.innerHTML = '<img src="' + src + '" alt=""><span>Toucher pour revenir à la notice</span>';
            z.addEventListener('click', function() { z.remove(); }); f.appendChild(z);
        };
        // Glisser du doigt : la page tourne au premier geste, lent ou rapide, même un peu en biais
        // (le glissement de la bibliothèque ne compte que les gestes de moins d'un quart de seconde).
        var doigt = null;
        f.addEventListener('touchstart', function(ev) { var t = ev.touches[0]; doigt = ev.touches.length === 1 && livre && !f.querySelector('.N-ZOOM') ? { x: t.clientX, y: t.clientY, p: livre.getCurrentPageIndex() } : null; }, { passive: true });
        f.addEventListener('touchend', function(ev) {
            if (!doigt || !livre) return; var t = ev.changedTouches[0], dx = t.clientX - doigt.x, dy = t.clientY - doigt.y, avant = doigt.p; doigt = null;
            if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
            // Après la bibliothèque : si elle tourne déjà la page (coin tiré), on ne fait rien de plus. Un glissement lent
            // parti du milieu de la page la laisse « pliée » sans rien tourner : c'est ce qui obligeait à recommencer.
            setTimeout(function() {
                if (!livre || livre.getState() === 'flipping' || livre.getCurrentPageIndex() !== avant) return;
                if (dx < 0) livre.flipNext('bottom'); else livre.flipPrev('bottom');
            }, 60);
        });
        var touche = function(ev) {
            var z = f.querySelector('.N-ZOOM'); if (z) { if (ev.key === 'Escape') z.remove(); return; }
            if (!livre) return;
            if (ev.key === 'ArrowRight' || ev.key === 'PageDown') livre.flipNext(); else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') livre.flipPrev(); else if (ev.key === 'Escape') fermer();
        };
        var minuteur = null, auRedim = function() { clearTimeout(minuteur); minuteur = setTimeout(function() { if (N) construire(); }, 250); };
        // Plein écran (au choix) : les barres du téléphone disparaissent, les pages gagnent toute la hauteur.
        var surPlein = function() { f.classList.toggle('plein', document.fullscreenElement === f); var b = f.querySelector('.N-PLEIN'); if (b) b.innerHTML = document.fullscreenElement === f ? QUITTER_PLEIN_SVG : PLEIN_SVG; auRedim(); };
        document.addEventListener('fullscreenchange', surPlein);
        var fermer = function() {
            window.removeEventListener('resize', auRedim); document.removeEventListener('keydown', touche); document.removeEventListener('fullscreenchange', surPlein);
            if (document.fullscreenElement === f && document.exitFullscreen) document.exitFullscreen().catch(function() {});
            if (livre) try { livre.destroy(); } catch (e) {}
            f.remove(); if (fenNotice === f) fenNotice = null;
        };
        f.querySelector('.N-FERMER').addEventListener('click', fermer);
        f.querySelector('.N-SOMMAIRE').addEventListener('click', function() { aller(2); });
        if (f.querySelector('.N-PLEIN')) f.querySelector('.N-PLEIN').addEventListener('click', function() {
            if (document.fullscreenElement) document.exitFullscreen().catch(function() {}); else f.requestFullscreen({ navigationUI: 'hide' }).catch(function() {});
        });
        f.querySelector('.N-PREC').addEventListener('click', function() { if (livre) livre.flipPrev(); });
        f.querySelector('.N-SUIV').addEventListener('click', function() { if (livre) livre.flipNext(); });
        f._fermer = function() { var z = f.querySelector('.N-ZOOM'); if (z) z.remove(); else fermer(); }; f._aller = function(n) { if (livre) { livre.turnToPage(n); page = n; majNum(); } }; fenNotice = f;
        document.body.appendChild(f);
        var contenu = window.NOTICE_TRIGONE ? Promise.resolve() : new Promise(function(ok, ko) {
            var sc = document.createElement('script'); sc.src = B + 'notice/notice.js?v=' + BUILD;
            sc.onload = function() { ok(); }; sc.onerror = function() { ko(new Error('hors connexion')); }; document.head.appendChild(sc);
        });
        Promise.all([contenu, chargerScript('page-flip.min.js', function() { return !!window.St; })]).then(function() {
            if (!f.isConnected) return;
            var NT = window.NOTICE_TRIGONE, niv = opts.complete ? 2 : niveauNotice();
            N = NT.pour ? NT.pour(niv) : NT;
            // Chapitre demandé absent de cette notice (ex. écran d'un autre rôle) : la notice complète.
            if (chapitre && NT.pour && !N.chapitres.some(function(c) { return c.id === chapitre; })) N = NT.pour(2);
            var tt = f.querySelector('.N-TITRE'); if (tt && N.nom) tt.textContent = N.nom;
            if (!document.getElementById('N-CSS')) { var st = document.createElement('style'); st.id = 'N-CSS'; st.textContent = NT.css; document.head.appendChild(st); }
            if (chapitre) N.chapitres.forEach(function(c) { if (c.id === chapitre) page = c.page; });
            construire();
            window.addEventListener('resize', auRedim); document.addEventListener('keydown', touche);
        }, function() {
            f.querySelector('.N-CHARGE').innerHTML = 'La notice n\'est pas encore sur cet appareil.<br>Ouvrez-la une première fois avec du réseau : elle restera ensuite disponible hors connexion.';
        });
    };
    fermeurs.push([function() { return fenNotice; }, function() { if (fenNotice) fenNotice._fermer(); }]);

    // ---------- Présentation TRIGONE (première ouverture, puis roue crantée > Découvrir TRIGONE) ----------
    var CLE_PRESENTATION = 'trigone_presentation_jumelage_vue', presentation = null;
    var ICONES_PRES = {
        id: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.4"/><path d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3"/></svg>',
        cadenas: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
        maj: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/></svg>'
    };
    // Appareil neuf, sans compte ni profil : l'écran d'accueil (Créer mon compte / Se connecter) remplace la présentation.
    function accueilAProposer() { return !monCompte() && !window.JUMELAGE_REGLAGES_FAITS() && lireTxt(CLE_CONNEXION_PROPOSEE) !== '1'; }
    function proposerAccueil(apres) {
        ecrireTxt(CLE_PRESENTATION, '1'); ecrireTxt(CLE_CONNEXION_PROPOSEE, '1');
        window.JUMELAGE_CONNEXION({ premiere: true, apres: apres });
    }
    window.JUMELAGE_PRESENTATION = function(opts) {
        opts = opts || {};
        if (opts.premiere && accueilAProposer()) { proposerAccueil(opts.apres); return; }
        if (presentation || !document.body) { if (opts.apres) opts.apres(); return; }
        var dossier = DANS_CR ? '../' : '';
        function liste(items) { return '<ul>' + items.map(function(t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'; }
        presentation = document.createElement('div');
        presentation.className = 'JUM-PRES';
        presentation.setAttribute('role', 'dialog');
        presentation.setAttribute('aria-label', 'Présentation de TRIGONE');
        presentation.innerHTML = '<div class="JUM-PRES-TRAIT"></div><div class="JUM-PRES-DEFIL"><div class="JUM-PRES-CONTENU">' +
            '<img class="JUM-PRES-LOGO" src="' + dossier + 'phoenix-icon.png" alt="">' +
            '<div class="JUM-PRES-MARQUE">TRIGONE</div>' +
            '<div class="JUM-PRES-LIGNE">Mise en route <span>·</span> Compte-rendu de mission</div>' +
            '<h1>Vous partez en mission.<br><em>TRIGONE s\'occupe de tout.</em></h1>' +
            '<p class="JUM-PRES-CHAPO">Une seule application, du départ au retour : la demande d\'ordre de mise en route avant de partir, le compte-rendu de mission une fois rentré.</p>' +
            '<div class="JUM-PRES-DUO">' +
                '<div class="JUM-PRES-VOLET JUM-PRES-CLAIR"><div class="JUM-PRES-NUM">01 — Avant le départ</div><div class="JUM-PRES-TITRE">Mise en route</div>' +
                    liste(['Demande d\'ordre de mise en route, individuelle ou collective', 'Circuit de validation signé : 1er valideur, puis 2e valideur', 'PDF final prêt pour l\'assistant Chorus DT']) + '</div>' +
                '<div class="JUM-PRES-VOLET JUM-PRES-SOMBRE"><div class="JUM-PRES-NUM">02 — Au retour</div><div class="JUM-PRES-TITRE">Compte-rendu de mission</div>' +
                    liste(['Horodatage du départ, de l\'arrivée sur site et de la fin de mission', 'Repas, nuitées et trajets : forfait calculé selon les barèmes', 'Compte-rendu signé, prêt à l\'envoi']) + '</div>' +
            '</div>' +
            '<div class="JUM-PRES-GARANTIES">' +
                '<div>' + ICONES_PRES.id + '<span>Identité saisie une seule fois</span></div>' +
                '<div>' + ICONES_PRES.cadenas + '<span>Vos données restent sur votre appareil</span></div>' +
                '<div>' + ICONES_PRES.maj + '<span>Toujours à jour, automatiquement</span></div>' +
            '</div>' +
            '<button type="button" class="JUM-PRES-BTN">' + (opts.premiere ? 'Commencer' : 'Fermer') + '</button>' +
        '</div></div>';
        document.body.appendChild(presentation);
        requestAnimationFrame(function() { requestAnimationFrame(function() { if (presentation) presentation.classList.add('visible'); }); });
        presentation.querySelector('.JUM-PRES-BTN').addEventListener('click', function() {
            ecrireTxt(CLE_PRESENTATION, '1');
            var p = presentation; presentation = null;
            p.classList.remove('visible');
            setTimeout(function() { p.remove(); if (opts.apres) opts.apres(); }, 380);
        });
    };
    window.JUMELAGE_PRESENTATION_VUE = function() { return lireTxt(CLE_PRESENTATION) === '1'; };

    // ---------- Sauvegarde complète de TRIGONE (Mise en route + Compte-rendu, pièces jointes comprises) ----------
    // Tout vit sur l'appareil : ce fichier unique permet de tout retrouver après un « Code oublié », une
    // réinitialisation ou un changement de téléphone / PC. Les accès valideurs (clé non exportable) n'y sont pas.
    var CLE_DERNIERE_SAUVEGARDE = 'trigone_derniere_sauvegarde', CLE_RAPPEL_SAUVEGARDE = 'trigone_dernier_rappel_sauvegarde';
    var NON_SAUVEGARDE = /^(trigone_build_vu|trigone_recharge_build|trigone_dernier_rappel_sauvegarde|trigone_compte|trigone_boite|trigone_roles_declares|trigone_suivi|trigone_notif_muet|trigone_admin|trigone_appareil_anonyme|trigone_sauvegarde_auto|trigone_mouvements|trigone_mvt_etat_mer|trigone_mvt_etat_cr|trigone_tampons_vus)$/;
    function basePieces(creer) {
        return new Promise(function(ok) {
            if (!window.indexedDB) { ok(null); return; }
            var r;
            try { r = creer ? indexedDB.open('trigone-mise-en-route', 2) : indexedDB.open('trigone-mise-en-route'); } catch (e) { ok(null); return; }
            r.onupgradeneeded = function() {
                var noms = r.result.objectStoreNames;
                if (!noms.contains('pieces')) r.result.createObjectStore('pieces');
                if (!noms.contains('acces')) r.result.createObjectStore('acces');
            };
            r.onsuccess = function() { ok(r.result.objectStoreNames.contains('pieces') ? r.result : (r.result.close(), null)); };
            r.onerror = function() { ok(null); };
        });
    }
    function lirePieces() {
        return basePieces(false).then(function(db) {
            if (!db) return {};
            return new Promise(function(ok) {
                var out = {}, cur = db.transaction('pieces').objectStore('pieces').openCursor();
                cur.onsuccess = function() { var c = cur.result; if (c) { out[c.key] = c.value; c.continue(); } else { db.close(); ok(out); } };
                cur.onerror = function() { db.close(); ok(out); };
            });
        });
    }
    function ecrirePieces(pieces) {
        var ids = Object.keys(pieces || {});
        if (!ids.length) return Promise.resolve();
        return basePieces(true).then(function(db) {
            if (!db) return;
            return new Promise(function(ok) {
                var tx = db.transaction('pieces', 'readwrite'), st = tx.objectStore('pieces');
                ids.forEach(function(id) { st.put(pieces[id], id); });
                tx.oncomplete = tx.onerror = function() { db.close(); ok(); };
            });
        });
    }
    function annoncer(titre, texte, icone, ton) {
        if (ecran && !ecran.classList.contains('choisi')) carteChoix(titre, texte, icone, ton);
        else if (typeof window.MSG_INFO === 'function') window.MSG_INFO(titre, texte, icone === 'ok' ? '✅' : icone === 'alerte' ? '⛔' : '💾');
        else window.alert(titre + '\n\n' + texte);
    }
    function collecterSauvegarde() {
        var donnees = {};
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (!NON_SAUVEGARDE.test(k)) donnees[k] = localStorage.getItem(k); } } catch (e) {}
        return lirePieces().then(function(pieces) {
            return { app: 'TRIGONE', type: 'sauvegarde-complete', version: 2, date: new Date().toISOString(), donnees: donnees, pieces: pieces };
        });
    }
    // Remet une sauvegarde en place. remplacer : efface d'abord les données actuelles (sinon ajoute / met à jour).
    function appliquerSauvegarde(s, remplacer, garderAppareil) {
        try {
            var garde = {};
            if (garderAppareil) for (var i = 0; i < localStorage.length; i++) { var k0 = localStorage.key(i); if (NON_SAUVEGARDE.test(k0)) garde[k0] = localStorage.getItem(k0); }
            if (remplacer) localStorage.clear();
            Object.keys(garde).forEach(function(k) { localStorage.setItem(k, garde[k]); });
            Object.keys(s.donnees).forEach(function(k) { localStorage.setItem(k, s.donnees[k]); });
            localStorage.setItem(CLE_DERNIERE_SAUVEGARDE, String(Date.now()));
        } catch (e) { return Promise.reject(e); }
        return ecrirePieces(s.type === 'sauvegarde-complete' ? s.pieces : null);
    }
    window.JUMELAGE_SAUVEGARDER = function() {
        return collecterSauvegarde().then(function(s) {
            var d = new Date(), jour = ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + d.getFullYear();
            var lien = document.createElement('a');
            lien.href = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' }));
            lien.download = 'TRIGONE - sauvegarde ' + jour + '.json';
            document.body.appendChild(lien); lien.click();
            setTimeout(function() { URL.revokeObjectURL(lien.href); lien.remove(); }, 1500);
            ecrireTxt(CLE_DERNIERE_SAUVEGARDE, String(Date.now()));
            annoncer('Sauvegarde téléchargée', 'Le fichier « ' + lien.download + ' » contient tout TRIGONE : demandes, documents, bibliothèque, comptes-rendus, remboursements, médailles, réglages et pièces jointes. Rangez-le en lieu sûr (mail à vous-même, clé USB, Drive…) : Paramètres › Données › « Restaurer depuis un fichier » le remet en place, sur cet appareil ou un autre.', 'ok', 'ok');
        });
    };
    function restaurer(fichier) {
        var lecteur = new FileReader();
        lecteur.onload = function() {
            var s = null;
            try { s = JSON.parse(lecteur.result); } catch (e) {}
            if (!s || s.app !== 'TRIGONE' || !s.donnees) { annoncer('Fichier non reconnu', 'Ce fichier n\'est pas une sauvegarde TRIGONE.', 'alerte', 'alerte'); return; }
            var complete = s.type === 'sauvegarde-complete';
            var date = s.date ? new Date(s.date).toLocaleDateString('fr-FR') : 'date inconnue';
            var texte = 'Sauvegarde du ' + date + '. ' + (complete
                ? 'Toutes les données actuelles de TRIGONE sur cet appareil (les deux applis) seront remplacées par celles de ce fichier, code d\'accès compris.'
                : 'Ancienne sauvegarde de Compte-rendu : ses données (bibliothèque, remboursements, médailles, réglages) remplaceront celles de Compte-rendu.') + ' Cette action est définitive.';
            var go = function() {
                window.JUMELAGE_RESTAURATION_EN_COURS = true;   // bloque les enregistrements automatiques avant le redémarrage
                try { if (window.JUMELAGE_AVANT_RESTAURATION) window.JUMELAGE_AVANT_RESTAURATION(); } catch (e) {}
                appliquerSauvegarde(s, complete).then(function() {
                    try { sessionStorage.removeItem(CLE_CHOIX_FAIT); sessionStorage.setItem(CLE_DEVERROUILLE, '1'); } catch (e) {}
                    location.replace(DANS_CR ? '../' : './');
                }, function() { annoncer('Restauration impossible', 'L\'appareil n\'a pas assez de place pour cette sauvegarde.', 'alerte', 'alerte'); });
            };
            if (ecran && !ecran.classList.contains('choisi')) carteChoix('Restaurer cette sauvegarde ?', texte, 'alerte', 'alerte', null, { libelle: 'Restaurer', faire: go });
            else if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM('Restaurer cette sauvegarde ?', texte, 'Restaurer', go, '⚠️', 'mascotte-maj.webp', true);
            else if (window.confirm('Restaurer cette sauvegarde ?\n\n' + texte)) go();
        };
        lecteur.readAsText(fichier);
    }
    window.JUMELAGE_RESTAURER_FICHIER = restaurer;
    // ---------- Sauvegarde automatique, chiffrée, dans le compte TRIGONE ----------
    // Tout TRIGONE (le même contenu que « Sauvegarder mes données ») est compressé puis chiffré SUR L'APPAREIL
    // (AES-GCM 256) avec une clé tirée d'un code de récupération de 20 caractères (≈ 100 bits, PBKDF2-SHA256,
    // 310 000 tours) ; seul ce bloc illisible part au serveur. Le code n'est jamais transmis ni conservé : l'appareil
    // garde seulement la clé, non exportable (IndexedDB). Sur un nouvel appareil : connexion au compte + code.
    // Copie une fois par jour au plus, quand quelque chose a changé.
    var CLE_SAUV_AUTO = 'trigone_sauvegarde_auto', ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function etatSauvAuto() { return lireJSON(CLE_SAUV_AUTO) || {}; }
    function ecrireSauvAuto(e) { ecrireTxt(CLE_SAUV_AUTO, JSON.stringify(e)); }
    function genererCode() {
        var o = new Uint8Array(20), t = '';
        crypto.getRandomValues(o);
        for (var i = 0; i < 20; i++) t += ALPHABET_CODE[o[i] % 32] + (i % 4 === 3 && i < 19 ? '-' : '');
        return t;
    }
    function normaliserCode(t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1'); }
    function deriverCleSauv(code, sel) {
        return SUBTLE.importKey('raw', new TextEncoder().encode(normaliserCode(code)), 'PBKDF2', false, ['deriveKey']).then(function(k) {
            return SUBTLE.deriveKey({ name: 'PBKDF2', salt: sel, iterations: 310000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        });
    }
    function cleSauvIdb(action, valeur) {
        return baseCles().then(function(db) { return new Promise(function(ok, ko) {
            var tx = db.transaction('cles', action === 'lire' ? 'readonly' : 'readwrite'), st = tx.objectStore('cles');
            var r = action === 'lire' ? st.get('sauvegarde') : action === 'effacer' ? st.delete('sauvegarde') : st.put(valeur, 'sauvegarde');
            tx.oncomplete = function() { db.close(); ok(action === 'lire' ? (r.result || null) : null); };
            tx.onerror = function() { db.close(); ko(tx.error); };
        }); });
    }
    function flux(octets, transfo) {
        if (!window[transfo]) return Promise.resolve(octets);
        return new Response(new Blob([octets]).stream().pipeThrough(new window[transfo]('gzip'))).arrayBuffer().then(function(b) { return new Uint8Array(b); });
    }
    function empreinteHex(octets) { return SUBTLE.digest('SHA-256', octets).then(function(h) { return Array.prototype.map.call(new Uint8Array(h), function(x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
    // Envoie la sauvegarde chiffrée. forcer : même sans changement, même si la dernière a moins de 20 h.
    var sauvEnCours = null;
    function envoyerSauvAuto(forcer) {
        var e = etatSauvAuto();
        if (!e.actif || !monCompte() || !navigator.onLine || window.JUMELAGE_RESTAURATION_EN_COURS) return Promise.resolve(null);
        if (!forcer && e.derniere && Date.now() - e.derniere < 20 * 3600000) return Promise.resolve(null);
        if (sauvEnCours) return sauvEnCours;
        var texte, gz;
        sauvEnCours = cleSauvIdb('lire').then(function(cle) {
            if (!cle) throw new Error('Clé de sauvegarde absente sur cet appareil : réactivez la sauvegarde automatique.');
            return collecterSauvegarde().then(function(sv) {
                texte = new TextEncoder().encode(JSON.stringify({ donnees: sv.donnees, pieces: sv.pieces }));
                return empreinteHex(texte).then(function(h) {
                    if (!forcer && h === e.empreinte) return null;
                    sv.compression = 'gzip';
                    return flux(new TextEncoder().encode(JSON.stringify(sv)), 'CompressionStream').then(function(z) {
                        gz = z; var iv = crypto.getRandomValues(new Uint8Array(12));
                        return SUBTLE.encrypt({ name: 'AES-GCM', iv: iv }, cle, window.CompressionStream ? gz : new TextEncoder().encode(JSON.stringify(sv))).then(function(ct) {
                            return appelApi('sauvegarde', { methode: 'POST', corps: { sel: e.sel, iv: versB64(iv), ct: versB64(ct), appareil: nomAppareil() } });
                        });
                    }).then(function(r) {
                        var e2 = etatSauvAuto(); e2.derniere = r.le; e2.taille = r.taille; e2.empreinte = h; delete e2.erreur; ecrireSauvAuto(e2);
                        ecrireTxt(CLE_DERNIERE_SAUVEGARDE, String(r.le));
                        return r;
                    });
                });
            });
        }).catch(function(err) { var e2 = etatSauvAuto(); e2.erreur = err.message || String(err); ecrireSauvAuto(e2); throw err; })
          .then(function(r) { sauvEnCours = null; return r; }, function(err) { sauvEnCours = null; throw err; });
        return sauvEnCours;
    }
    window.JUMELAGE_SAUVEGARDE_AUTO_ENVOYER = envoyerSauvAuto;
    // Copie automatique : 20 s après l'ouverture, puis toutes les 3 h tant que l'appli reste ouverte.
    setTimeout(function() { envoyerSauvAuto(false).catch(function() {}); }, 20000);
    setInterval(function() { envoyerSauvAuto(false).catch(function() {}); }, 3 * 3600000);
    function tailleMo(o) { return o < 1048576 ? Math.max(1, Math.round(o / 1024)) + ' Ko' : (o / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
    function dateHeure(ms) { var d = new Date(ms); return d.toLocaleDateString('fr-FR') + ' à ' + ('0' + d.getHours()).slice(-2) + ' h ' + ('0' + d.getMinutes()).slice(-2); }
    window.JUMELAGE_SAUVEGARDE_AUTO_RESUME = function() {
        var e = etatSauvAuto();
        if (!e.actif) return 'Chiffrée dans votre compte TRIGONE, restaurable sur un nouvel appareil';
        return e.erreur ? '⚠️ ' + e.erreur : e.derniere ? 'Activée · dernière copie le ' + dateHeure(e.derniere) : 'Activée · première copie en cours';
    };
    var fenSauv = null;
    window.JUMELAGE_FERMER_SAUVEGARDE_AUTO = function() { if (fenSauv) { fenSauv.remove(); fenSauv = null; } }; fermeurs.push([function() { return fenSauv; }, window.JUMELAGE_FERMER_SAUVEGARDE_AUTO]);
    function fenetreSauv(titre, sous, corps, pied) {
        window.JUMELAGE_FERMER_SAUVEGARDE_AUTO();
        fenSauv = document.createElement('div'); fenSauv.className = 'JUM-REGLAGES'; fenSauv.setAttribute('role', 'dialog');
        fenSauv.innerHTML = '<div class="JUM-R-CARTE"><div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('disquette') : '') + '</span><div><h2>' + titre + '</h2><p>' + sous + '</p></div>' +
            '<button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_SAUVEGARDE_AUTO()">✕</button></div><div class="JUM-R-CORPS">' + corps + '<p class="JUM-R-ERREUR" id="JUM-S-ERR"></p></div>' +
            '<div class="JUM-R-PIED">' + pied + '</div></div>';
        document.body.appendChild(fenSauv);
        return fenSauv;
    }
    // Active (ou change) le code : nouveau code affiché une fois, nouvelle clé, première copie.
    function activerSauv() {
        var code = genererCode(), f = fenetreSauv('Votre code de récupération', 'Notez-le maintenant : il ne sera plus jamais affiché.',
            '<div class="JUM-S-CODE" id="JUM-S-CODE">' + code + '</div>' +
            '<button type="button" class="JUM-R-SECOND" id="JUM-S-COPIER" style="width:100%;margin:6px 0 12px;">Copier le code</button>' +
            '<p class="JUM-R-AIDE">Ce code est la <b>seule</b> façon d\'ouvrir votre sauvegarde sur un nouvel appareil. Il n\'est envoyé nulle part : ni le serveur, ni l\'équipe TRIGONE ne le connaissent et ne peuvent le retrouver. Gardez-le <b>à part de votre téléphone</b> : sur papier, dans un gestionnaire de mots de passe, ou en photo sur un autre appareil.</p>' +
            '<label class="JUM-S-OK"><input type="checkbox" id="JUM-S-NOTE"> J\'ai noté ce code en lieu sûr</label>',
            '<button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_SAUVEGARDE_AUTO()">Annuler</button><button type="button" class="JUM-R-PRINCIPAL" id="JUM-S-GO" disabled>Activer</button>');
        var go = f.querySelector('#JUM-S-GO');
        f.querySelector('#JUM-S-NOTE').addEventListener('change', function(ev) { go.disabled = !ev.target.checked; });
        f.querySelector('#JUM-S-COPIER').addEventListener('click', function(ev) {
            var b = ev.target; (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function() { b.textContent = 'Copié ✓'; }, function() {});
        });
        go.addEventListener('click', function() {
            go.disabled = true; go.textContent = 'Chiffrement…';
            var sel = crypto.getRandomValues(new Uint8Array(16));
            deriverCleSauv(code, sel).then(function(cle) { return cleSauvIdb('ecrire', cle); }).then(function() {
                ecrireSauvAuto({ actif: true, sel: versB64(sel) });
                return envoyerSauvAuto(true);
            }).then(function() {
                code = null; window.JUMELAGE_FERMER_SAUVEGARDE_AUTO();
                bandeau('Sauvegarde automatique activée : une copie chiffrée est dans votre compte TRIGONE.');
            }).catch(function(e) { go.disabled = false; go.textContent = 'Activer'; f.querySelector('#JUM-S-ERR').textContent = '⛔ ' + (e.message || e); });
        });
    }
    window.JUMELAGE_SAUVEGARDE_AUTO = function() {
        if (!monCompte()) { annoncer('Connectez-vous d\'abord', 'La sauvegarde automatique se range dans votre compte TRIGONE : connectez-vous (Paramètres › Compte › Se connecter).', 'alerte', 'alerte'); return; }
        var e = etatSauvAuto();
        if (!e.actif) {
            var f0 = fenetreSauv('Sauvegarde automatique', 'Ne perdez rien si votre téléphone est perdu, cassé ou changé.',
                '<ul class="JUM-S-LISTE"><li>🔒 <b>Chiffrée sur votre téléphone</b> avant l\'envoi : le serveur ne reçoit qu\'un bloc illisible. Personne ne peut la lire, même en cas de piratage du serveur.</li>' +
                '<li>🔑 Elle s\'ouvre avec un <b>code de récupération</b> que vous seul connaissez, donné une seule fois.</li>' +
                '<li>🔄 Une copie par jour au plus, seulement quand quelque chose a changé ; rien à faire.</li>' +
                '<li>📱 Nouveau téléphone : connectez-vous à votre compte, puis saisissez le code : tout revient.</li></ul>' +
                '<p class="JUM-R-AIDE">⚠️ Code perdu = sauvegarde impossible à ouvrir, pour tout le monde. Il faudra donc le noter.</p>',
                '<button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_SAUVEGARDE_AUTO()">Plus tard</button><button type="button" class="JUM-R-PRINCIPAL" id="JUM-S-ACT">Activer</button>');
            f0.querySelector('#JUM-S-ACT').addEventListener('click', activerSauv);
            return;
        }
        var f = fenetreSauv('Sauvegarde automatique', 'Activée sur cet appareil. Chiffrée : seul votre code de récupération l\'ouvre.',
            '<div class="JUM-S-ETAT" id="JUM-S-ETAT">' + esc(window.JUMELAGE_SAUVEGARDE_AUTO_RESUME()) + (e.taille ? ' · ' + tailleMo(e.taille) : '') + '</div>' +
            '<button type="button" class="JUM-PARAM-LIGNE" id="JUM-S-MAINT"><span><b>Sauvegarder maintenant</b><small>Envoyer une copie à jour tout de suite</small></span><i>›</i></button>' +
            '<button type="button" class="JUM-PARAM-LIGNE" id="JUM-S-CODE2"><span><b>Changer de code de récupération</b><small>Code perdu ou divulgué : un nouveau code, l\'ancien ne sert plus</small></span><i>›</i></button>' +
            '<button type="button" class="JUM-PARAM-LIGNE danger" id="JUM-S-OFF"><span><b>Désactiver</b><small>Arrêter et supprimer la copie du serveur</small></span><i>›</i></button>',
            '<button type="button" class="JUM-R-PRINCIPAL" onclick="JUMELAGE_FERMER_SAUVEGARDE_AUTO()">Fermer</button>');
        var err = f.querySelector('#JUM-S-ERR');
        f.querySelector('#JUM-S-MAINT').addEventListener('click', function(ev) {
            var b = ev.currentTarget; b.disabled = true; err.textContent = '';
            envoyerSauvAuto(true).then(function(r) {
                b.disabled = false; f.querySelector('#JUM-S-ETAT').textContent = window.JUMELAGE_SAUVEGARDE_AUTO_RESUME() + (r && r.taille ? ' · ' + tailleMo(r.taille) : '');
            }, function(e2) { b.disabled = false; err.textContent = '⛔ ' + (e2.message || e2); });
        });
        f.querySelector('#JUM-S-CODE2').addEventListener('click', activerSauv);
        f.querySelector('#JUM-S-OFF').addEventListener('click', function() {
            if (!confirm('Désactiver la sauvegarde automatique ? La copie chiffrée sera supprimée du serveur.')) return;
            appelApi('sauvegarde', { methode: 'DELETE' }).then(function() {
                try { localStorage.removeItem(CLE_SAUV_AUTO); } catch (e3) {}
                cleSauvIdb('effacer').catch(function() {});
                window.JUMELAGE_FERMER_SAUVEGARDE_AUTO(); bandeau('Sauvegarde automatique désactivée ; la copie du serveur est supprimée.');
            }, function(e3) { err.textContent = '⛔ ' + e3.message; });
        });
    };
    // Restaurer depuis le compte (nouvel appareil) : code de récupération → déchiffrement → tout TRIGONE remis en place.
    // o.apresConnexion : proposé juste après la connexion ; o.sinon : suite normale si l'utilisateur passe.
    window.JUMELAGE_RESTAURER_COMPTE = function(o) {
        o = o || {};
        if (!monCompte()) { annoncer('Connectez-vous d\'abord', 'Connectez-vous à votre compte TRIGONE, puis revenez ici.', 'alerte', 'alerte'); return; }
        appelApi('sauvegarde/info').then(function(info) {
            if (!info.existe) { if (o.sinon) o.sinon(); else annoncer('Aucune sauvegarde', 'Votre compte TRIGONE ne contient pas de sauvegarde automatique. Activez-la depuis l\'appareil qui a vos données (Paramètres › Données).', 'alerte', 'alerte'); return; }
            var f = fenetreSauv(o.apresConnexion ? 'Une sauvegarde vous attend' : 'Restaurer depuis mon compte',
                'Sauvegarde du ' + dateHeure(info.le) + (info.appareil ? ' (' + esc(info.appareil) + ')' : '') + ' · ' + tailleMo(info.taille) + '.',
                '<p class="JUM-R-AIDE">Saisissez votre code de récupération (20 caractères, reçu à l\'activation). Toutes les données TRIGONE de cet appareil seront remplacées par la sauvegarde.</p>' +
                '<input type="text" id="JUM-S-SAISIE" class="JUM-S-SAISIE" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX">',
                '<button type="button" class="JUM-R-SECOND" id="JUM-S-PASSER">' + (o.apresConnexion ? 'Plus tard' : 'Annuler') + '</button><button type="button" class="JUM-R-PRINCIPAL" id="JUM-S-REST">Restaurer</button>');
            var err = f.querySelector('#JUM-S-ERR'), btn = f.querySelector('#JUM-S-REST');
            f.querySelector('#JUM-S-PASSER').addEventListener('click', function() { window.JUMELAGE_FERMER_SAUVEGARDE_AUTO(); if (o.sinon) o.sinon(); });
            btn.addEventListener('click', function() {
                var code = f.querySelector('#JUM-S-SAISIE').value;
                if (normaliserCode(code).length !== 20) { err.textContent = '⛔ Le code contient 20 caractères (lettres et chiffres).'; return; }
                btn.disabled = true; btn.textContent = 'Déchiffrement…'; err.textContent = '';
                var sel, cle;
                appelApi('sauvegarde').then(function(r) {
                    sel = depuisB64(r.sel);
                    return deriverCleSauv(code, sel).then(function(k) { cle = k;
                        return SUBTLE.decrypt({ name: 'AES-GCM', iv: depuisB64(r.iv) }, k, depuisB64(r.ct)).catch(function() { var e4 = new Error('Code incorrect : vérifiez-le (les tirets et espaces ne comptent pas).'); e4.code = true; throw e4; });
                    });
                }).then(function(clair) {
                    var brut = new Uint8Array(clair);
                    return (brut[0] === 0x1f && brut[1] === 0x8b ? flux(brut, 'DecompressionStream') : Promise.resolve(brut)).then(function(t) { return JSON.parse(new TextDecoder().decode(t)); });
                }).then(function(sv) {
                    window.JUMELAGE_RESTAURATION_EN_COURS = true;
                    try { if (window.JUMELAGE_AVANT_RESTAURATION) window.JUMELAGE_AVANT_RESTAURATION(); } catch (e5) {}
                    return appliquerSauvegarde(sv, true, true).then(function() {
                        // Cet appareil continue les copies automatiques avec le même code.
                        ecrireSauvAuto({ actif: true, sel: versB64(sel), derniere: Date.now() });
                        return cleSauvIdb('ecrire', cle);
                    }).then(function() {
                        try { sessionStorage.removeItem(CLE_CHOIX_FAIT); sessionStorage.setItem(CLE_DEVERROUILLE, '1'); } catch (e6) {}
                        location.replace(DANS_CR ? '../' : './');
                    });
                }).catch(function(e7) { btn.disabled = false; btn.textContent = 'Restaurer'; err.textContent = '⛔ ' + (e7.message || e7); });
            });
        }).catch(function(e) { if (o.sinon) o.sinon(); else annoncer('Service indisponible', e.message, 'alerte', 'alerte'); });
    };

    window.JUMELAGE_RESTAURER = function() {
        var champ = document.createElement('input');
        champ.type = 'file'; champ.accept = '.json,application/json'; champ.style.display = 'none';
        champ.addEventListener('change', function() { if (champ.files && champ.files[0]) restaurer(champ.files[0]); champ.remove(); });
        document.body.appendChild(champ); champ.click();
    };
    // Rappel : jamais sauvegardé, ou pas depuis 60 jours ; au plus une fois tous les 14 jours. Renvoie le texte à afficher, ou null.
    window.JUMELAGE_SAUVEGARDE_A_RAPPELER = function() {
        var jour = 86400000, derniere = +lireTxt(CLE_DERNIERE_SAUVEGARDE) || 0, rappel = +lireTxt(CLE_RAPPEL_SAUVEGARDE) || 0;
        if (Date.now() - derniere < 60 * jour || Date.now() - rappel < 14 * jour) return null;
        ecrireTxt(CLE_RAPPEL_SAUVEGARDE, String(Date.now()));
        return derniere ? 'Votre dernière sauvegarde TRIGONE commence à dater. Refaites-la pour ne rien perdre en cas de souci avec cet appareil.'
            : 'Vous n\'avez encore jamais sauvegardé TRIGONE. Tout est enregistré sur cet appareil uniquement : en cas de perte, de réinitialisation ou de changement d\'appareil, tout serait perdu.';
    };
    // ---------- Compte TRIGONE et boîte aux lettres : envois directs d'appli à appli, chiffrés de bout en bout ----------
    // Compte = adresse professionnelle vérifiée par un code reçu par mail. Chaque appareil a sa clé ECDH (P-256) :
    // la clé privée, non exportable, reste dans l'appareil (IndexedDB) ; le serveur (worker.js) ne connaît que la
    // clé publique. Un envoi est chiffré en AES-GCM avec une clé tirée au hasard, elle-même chiffrée pour chaque
    // appareil du destinataire (ECDH éphémère + HKDF). Le serveur ne voit que des données illisibles.
    var CLE_COMPTE = 'trigone_compte', API = (DANS_CR ? '../' : '') + 'api/', ETAT_API = null;
    function monCompte() { var c = lireJSON(CLE_COMPTE); return c && c.mail && c.appareil && c.jeton ? c : null; }
    function appelApi(chemin, opts) {
        opts = opts || {};
        var c = monCompte(), entetes = { 'Content-Type': 'application/json' };
        if (c) entetes.Authorization = 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton;
        // Unité du profil : un registre et une numérotation OMR par régiment sur le serveur.
        var u = normeUnite(lireReglages().unite); if (u) entetes['X-Trigone-Unite'] = u;
        return fetch(API + chemin, { method: opts.methode || 'GET', headers: entetes, body: opts.corps ? JSON.stringify(opts.corps) : undefined, cache: 'no-store' })
            .then(function(r) {
                return r.json().catch(function() { return { ok: false, erreur: 'Service indisponible.' }; }).then(function(j) {
                    if (r.status === 410 && j.supprime && window.JUMELAGE_COMPTE_SUPPRIME) window.JUMELAGE_COMPTE_SUPPRIME();
                    if (!r.ok || !j.ok) { var e = new Error(j.erreur || 'Service indisponible.'); e.statut = r.status; throw e; }
                    return j;
                });
            });
    }
    // Service disponible ? (boîte aux lettres en place sur le serveur)
    var ETAT_INFO = null;   // { connexionMail } : la connexion par adresse mail n'existe plus (tests locaux seulement)
    function serviceDisponible() {
        if (ETAT_API) return ETAT_API;
        ETAT_API = navigator.onLine ? appelApi('etat').then(function(r) { ETAT_INFO = r || {}; return true; }, function() { ETAT_API = null; return false; }) : Promise.resolve(false);
        return ETAT_API;
    }
    function baseCles() {
        return new Promise(function(ok, ko) {
            var r = indexedDB.open('trigone-compte', 1);
            r.onupgradeneeded = function() { r.result.createObjectStore('cles'); };
            r.onsuccess = function() { ok(r.result); }; r.onerror = function() { ko(r.error); };
        });
    }
    function cleIdb(action, valeur) {
        return baseCles().then(function(db) { return new Promise(function(ok, ko) {
            var tx = db.transaction('cles', action === 'lire' ? 'readonly' : 'readwrite'), st = tx.objectStore('cles');
            var r = action === 'lire' ? st.get('appareil') : action === 'effacer' ? st.delete('appareil') : st.put(valeur, 'appareil');
            tx.oncomplete = function() { db.close(); ok(action === 'lire' ? (r.result || null) : null); };
            tx.onerror = function() { db.close(); ko(tx.error); };
        }); });
    }
    function versB64(buf) {
        var o = new Uint8Array(buf), s = '';
        for (var i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
        return btoa(s);
    }
    function depuisB64(t) { var s = atob(t), o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
    var SUBTLE = window.crypto && window.crypto.subtle;
    function cleEnveloppe(bits, usage) {
        return SUBTLE.importKey('raw', bits, 'HKDF', false, ['deriveKey']).then(function(hk) {
            return SUBTLE.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('TRIGONE boite v1') },
                hk, { name: 'AES-GCM', length: 256 }, false, [usage]);
        });
    }
    function chiffrerPour(appareils, texte) {
        var iv = crypto.getRandomValues(new Uint8Array(12)), cleContenu;
        return SUBTLE.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']).then(function(k) {
            cleContenu = k;
            return Promise.all([SUBTLE.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(texte)), SUBTLE.exportKey('raw', k)]);
        }).then(function(r) {
            var brute = r[1];
            return Promise.all(appareils.map(function(a) {
                var eph, iv2 = crypto.getRandomValues(new Uint8Array(12));
                return Promise.all([SUBTLE.importKey('jwk', a.cle, { name: 'ECDH', namedCurve: 'P-256' }, false, []),
                    SUBTLE.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])]).then(function(x) {
                    eph = x[1];
                    return SUBTLE.deriveBits({ name: 'ECDH', public: x[0] }, eph.privateKey, 256);
                }).then(function(bits) { return cleEnveloppe(bits, 'encrypt'); }).then(function(ke) {
                    return Promise.all([SUBTLE.encrypt({ name: 'AES-GCM', iv: iv2 }, ke, brute), SUBTLE.exportKey('jwk', eph.publicKey)]);
                }).then(function(y) {
                    return { appareil: a.id, epk: { kty: 'EC', crv: 'P-256', x: y[1].x, y: y[1].y }, iv: versB64(iv2), ct: versB64(y[0]) };
                });
            })).then(function(enveloppes) { return { enveloppes: enveloppes, donnees: { iv: versB64(iv), ct: versB64(r[0]) } }; });
        });
    }
    function dechiffrer(enveloppe, donnees) {
        return cleIdb('lire').then(function(rec) {
            if (!rec || !rec.prive) throw new Error('Clé de cet appareil introuvable.');
            return SUBTLE.importKey('jwk', enveloppe.epk, { name: 'ECDH', namedCurve: 'P-256' }, false, []).then(function(epk) {
                return SUBTLE.deriveBits({ name: 'ECDH', public: epk }, rec.prive, 256);
            });
        }).then(function(bits) { return cleEnveloppe(bits, 'decrypt'); }).then(function(ke) {
            return SUBTLE.decrypt({ name: 'AES-GCM', iv: depuisB64(enveloppe.iv) }, ke, depuisB64(enveloppe.ct));
        }).then(function(brute) {
            return SUBTLE.importKey('raw', brute, { name: 'AES-GCM' }, false, ['decrypt']);
        }).then(function(k) {
            return SUBTLE.decrypt({ name: 'AES-GCM', iv: depuisB64(donnees.iv) }, k, depuisB64(donnees.ct));
        }).then(function(clair) { return new TextDecoder().decode(clair); });
    }
    function nomAppareil() {
        var ua = navigator.userAgent || '';
        return (/iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'PC Windows' : /Mac/.test(ua) ? 'Mac' : 'Appareil') +
            ' — ' + new Date().toLocaleDateString('fr-FR');
    }

    // ---------- Liaison : installer TRIGONE sur un autre appareil sans tout refaire ----------
    // L'appareil déjà configuré tire un code de 8 caractères (valable 15 minutes, une seule fois), chiffre avec lui une
    // copie de toutes ses données (réglages, rôles, code d'accès, demandes, bibliothèque, comptes-rendus, pièces
    // jointes) et la dépose sur le serveur sous l'empreinte du code. Le nouvel appareil saisit le code : il est ajouté au
    // compte TRIGONE (sans code par mail) et déchiffre la copie. Le serveur ne voit jamais ni le code ni les données.
    // Les clés de signature des valideurs ne se copient pas (bloquées sur leur appareil) : le code VALIDEUR 1 / 2 sera
    // redemandé une fois, à la première signature.
    var ALPHA_LIAISON = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', TAILLE_MAX_LIAISON = 15 * 1024 * 1024;
    function codeLiaisonNouveau() {
        var o = crypto.getRandomValues(new Uint8Array(8)), c = '';
        for (var i = 0; i < 8; i++) c += ALPHA_LIAISON.charAt(o[i] % 32);
        return c;
    }
    function codeLiaisonNormal(t) { return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
    function b64u(buf) { return versB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function idLiaison(code) { return SUBTLE.digest('SHA-256', new TextEncoder().encode('trigone-liaison:' + code)).then(b64u); }
    function cleLiaison(code, sel) {
        return SUBTLE.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']).then(function(base) {
            return SUBTLE.deriveKey({ name: 'PBKDF2', salt: sel, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        });
    }
    // Appareil configuré : { code, expire, sansPieces }.
    window.JUMELAGE_LIAISON_CREER = function() {
        if (!monCompte()) return Promise.reject(new Error('Activez d\'abord votre compte TRIGONE.'));
        if (!navigator.onLine) return Promise.reject(new Error('Pas de connexion.'));
        var code = codeLiaisonNouveau(), sansPieces = false, sel = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
        return collecterSauvegarde().then(function(sv) {
            // Boîte de réception aussi : la liste des envois reçus et leur contenu (gardé déchiffré sur cet appareil).
            var liste = boiteLire(), fichiers = {};
            return caches.open(CACHE_BOITE).then(function(c) {
                return Promise.all(liste.map(function(x) {
                    return c.match(cleFichierBoite(x.id)).then(function(r) { return r || c.match(cleFichierBoite(x.id, true)); })
                        .then(function(r) { return r ? r.text() : null; }).then(function(t) { if (t != null) fichiers[x.id] = t; });
                }));
            }).catch(function() {}).then(function() { sv.boite = { liste: liste, fichiers: fichiers }; return sv; });
        }).then(function(sv) {
            var txt = JSON.stringify(sv);
            // Trop lourd : d'abord sans les pièces jointes des demandes, puis sans la boîte (elles restent sur cet appareil).
            if (txt.length > TAILLE_MAX_LIAISON) { sv.pieces = {}; sansPieces = true; txt = JSON.stringify(sv); }
            if (txt.length > TAILLE_MAX_LIAISON) { delete sv.boite; txt = JSON.stringify(sv); }
            return cleLiaison(code, sel).then(function(k) { return SUBTLE.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(txt)); });
        }).then(function(ct) {
            return idLiaison(code).then(function(id) {
                return appelApi('liaison', { methode: 'POST', corps: { id: id, paquet: { sel: versB64(sel), iv: versB64(iv), ct: versB64(ct) } } });
            });
        }).then(function(r) { return { code: code.slice(0, 4) + '-' + code.slice(4), expire: r.expire, sansPieces: sansPieces }; });
    };
    // Nouvel appareil : ajouté au compte, données de l'autre appareil mises en place (celles d'ici sont remplacées).
    window.JUMELAGE_LIAISON_UTILISER = function(saisie) {
        var code = codeLiaisonNormal(saisie), paire, rep;
        if (code.length !== 8) return Promise.reject(new Error('Le code de liaison contient 8 caractères (ex. K7P2-9XQM).'));
        if (!navigator.onLine) return Promise.reject(new Error('Pas de connexion.'));
        return SUBTLE.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']).then(function(p) {
            paire = p; return Promise.all([SUBTLE.exportKey('jwk', p.publicKey), idLiaison(code)]);
        }).then(function(x) {
            var pub = x[0];
            return appelApi('liaison/utiliser', { methode: 'POST', corps: { id: x[1], nom: nomAppareil(), cle: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } } });
        }).then(function(r) {
            rep = r;
            // Code de réactivation (remis par l'administrateur) : pas de données à recopier, seulement le compte.
            if (!r.paquet) return null;
            return cleLiaison(code, depuisB64(r.paquet.sel)).then(function(k) { return SUBTLE.decrypt({ name: 'AES-GCM', iv: depuisB64(r.paquet.iv) }, k, depuisB64(r.paquet.ct)); })
                .catch(function() { throw new Error('Code de liaison incorrect.'); });
        }).then(function(clair) {
            if (!clair) { ecrireTxt('trigone_reactivation', '1'); return; }
            var sv = JSON.parse(new TextDecoder().decode(clair));
            // Propre à chaque appareil : abonnement aux notifications, sourdine, suivi (relu sur le serveur).
            ['trigone_notif', 'trigone_notif_muet', 'trigone_suivi', 'trigone_boite'].forEach(function(k) { delete sv.donnees[k]; });
            var boite = sv.boite;
            return appliquerSauvegarde(sv, true).then(function() {
                if (!boite || !Array.isArray(boite.liste)) return;
                // Boîte de réception de l'autre appareil : envois reçus et leur contenu.
                return caches.open(CACHE_BOITE).then(function(c) {
                    return Promise.all(Object.keys(boite.fichiers || {}).map(function(id) {
                        return c.put(cleFichierBoite(id), new Response(boite.fichiers[id], { headers: { 'Content-Type': 'application/json' } }));
                    }));
                }).catch(function() {}).then(function() { ecrireTxt(CLE_BOITE, JSON.stringify(boite.liste.filter(function(x) { return boite.fichiers && boite.fichiers[x.id] != null || x.nature === 'question' || x.nature === 'reponse'; }))); });
            });
        }).then(function() {
            return cleIdb('ecrire', { prive: paire.privateKey });
        }).then(function() {
            ecrireTxt(CLE_COMPTE, JSON.stringify({ mail: rep.mail, appareil: rep.appareil, jeton: rep.jeton }));
            ecrireTxt('trigone_liaison_faite', String(Date.now()));
            return rep.mail;
        });
    };
    // Zone de saisie du code (nouvel appareil) : champ + bouton + message ; après réussite, TRIGONE redémarre.
    // QR de connexion : lien …?liaison=K7P29XQM (ouvre TRIGONE avec le code si on le scanne avec l'appareil photo).
    function lienLiaison(code) { return location.origin + racineAppli + '?liaison=' + codeLiaisonNormal(code); }
    function codeDuQr(t) { var m = /[?&]liaison=([A-Za-z0-9-]{8,9})/.exec(String(t || '')); var c = codeLiaisonNormal(m ? m[1] : /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(String(t || '').trim()) ? t : ''); return c.length === 8 ? c : ''; }
    // QR code d'une image (capture d'écran, photo) : lecteur du navigateur ou jsQR.
    function lireQrImage(fichier) {
        return createImageBitmap(fichier).then(function(bm) {
            var essai = ('BarcodeDetector' in window) ? new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bm).then(function(l) { return l[0] && l[0].rawValue; }).catch(function() { return null; }) : Promise.resolve(null);
            return essai.then(function(t) {
                if (t) return t;
                return chargerScript('jsqr.min.js', function() { return !!window.jsQR; }).then(function() {
                    var e = Math.min(1, 1600 / Math.max(bm.width, bm.height)), cv = document.createElement('canvas'); cv.width = Math.round(bm.width * e); cv.height = Math.round(bm.height * e);
                    var ctx = cv.getContext('2d'); ctx.drawImage(bm, 0, 0, cv.width, cv.height);
                    var q = window.jsQR(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
                    return q && q.data;
                });
            });
        }).then(function(t) { if (!t) throw new Error('Aucun QR code trouvé dans cette image.'); return t; });
    }
    function htmlSaisieLiaison() {
        return '<div class="JUM-R-GRILLE" style="grid-template-columns:1fr;"><div class="JUM-R-CHAMP"><label for="JUM-L-CODE">Code de liaison ou de réactivation</label>' +
            '<input id="JUM-L-CODE" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="EX : K7P2-9XQM" style="letter-spacing:0.12em; font-weight:800; text-transform:uppercase;"></div></div>' +
            '<div class="JUM-L-SCAN"><button type="button" class="JUM-R-SECOND" id="JUM-L-CAM">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('qr') : '') + 'Scanner le QR de connexion</button>' +
                '<label class="JUM-R-SECOND" id="JUM-L-IMG">Depuis une image (capture)<input type="file" accept="image/*" style="display:none;"></label></div>' +
            '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-L-OK" style="width:100%; margin:6px 0 0;">Récupérer mon compte et mes données</button>' +
            '<p class="JUM-R-ERREUR" id="JUM-L-ERR" style="min-height:0;"></p>';
    }
    function brancherSaisieLiaison(racine, avertir) {
        var btn = racine.querySelector('#JUM-L-OK'), champ = racine.querySelector('#JUM-L-CODE'), err = racine.querySelector('#JUM-L-ERR');
        if (!btn) return;
        champ.addEventListener('input', function() { var c = codeLiaisonNormal(champ.value).slice(0, 8); champ.value = c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c; });
        // QR de connexion (affiché sur l'autre appareil, Ma carte › QR de connexion) : caméra ou image (capture d'écran).
        var poser = function(texte) {
            var c = codeDuQr(texte);
            if (!c) { err.style.color = ''; err.textContent = '⛔ Ce QR code n\'est pas un QR de connexion TRIGONE (Ma carte › « QR de connexion » sur votre autre appareil).'; return; }
            champ.value = c.slice(0, 4) + '-' + c.slice(4); err.style.color = '#15803d'; err.textContent = '✓ QR de connexion lu.'; btn.click();
        };
        var cam = racine.querySelector('#JUM-L-CAM'), img = racine.querySelector('#JUM-L-IMG input');
        if (cam) cam.addEventListener('click', function() {
            window.JUMELAGE_SCANNER_CARTE({ titre: 'QR de connexion', sous: 'Visez le QR affiché par votre autre appareil (Ma carte › QR de connexion).', sansCompte: true, lire: function(t) { return codeDuQr(t) ? Promise.resolve(t) : Promise.reject(new Error('Ce n\'est pas un QR de connexion TRIGONE.')); } })
                .then(function(t) { if (t) poser(t); });
        });
        if (img) img.addEventListener('change', function() { var f = img.files && img.files[0]; img.value = ''; if (!f) return; lireQrImage(f).then(poser, function(e) { err.style.color = ''; err.textContent = '⛔ ' + e.message; }); });
        var pre = ''; try { pre = sessionStorage.getItem('trigone_liaison_qr') || ''; sessionStorage.removeItem('trigone_liaison_qr'); } catch (e) {}
        if (pre) { champ.value = pre.slice(0, 4) + '-' + pre.slice(4); err.style.color = '#15803d'; err.textContent = '✓ QR de connexion lu : touchez « Récupérer mon compte et mes données ».'; }
        btn.addEventListener('click', function() {
            err.style.color = ''; err.textContent = '';
            if (avertir && !window.confirm('Les données TRIGONE de cet appareil vont être remplacées par celles de votre autre appareil. Continuer ?')) return;
            btn.disabled = true; btn.textContent = 'Récupération…';
            window.JUMELAGE_LIAISON_UTILISER(champ.value).then(function(mail) {
                err.style.color = '#15803d'; err.textContent = '✓ Compte ' + mail + ' relié : TRIGONE redémarre…';
                try { sessionStorage.setItem('trigone_apres_liaison', '1'); } catch (e) {}
                setTimeout(function() { location.replace(DANS_CR ? '../' : './'); }, 1200);
            }).catch(function(e) { err.textContent = '⛔ ' + e.message; btn.disabled = false; btn.textContent = 'Récupérer mon compte et mes données'; });
        });
    }

    window.JUMELAGE_COMPTE_ACTIF = function() { return !!monCompte(); };
    // Rôles de cet appareil (1er / 2e valideur après le code valideur, assistant Chorus DT après son code) : déclarés au
    // compte TRIGONE, ils décident de ce que la boîte peut recevoir (règle appliquée par le serveur).
    var CLE_ROLES_LOCAUX = 'trigone_roles_locaux', CLE_ROLES_DECLARES = 'trigone_roles_declares';
    function rolesLocaux() { var r = lireJSON(CLE_ROLES_LOCAUX) || {}; if (roleChorus()) r.chorus = true; return r; }
    // Les rôles cochés sur l'appareil sont comparés à ceux que le serveur connaît pour le compte, et ceux qui manquent
    // sont redéclarés (compte réactivé, remise à zéro, déclaration perdue…) : à l'ouverture, au retour dans l'appli.
    var dernierControleRoles = 0;
    // Rôles de l'appareil → compte TRIGONE, en une seule requête (ajouts et retraits ensemble), puis vérification :
    // un rôle qui n'apparaît pas encore sur le compte est redéclaré (jusqu'à 3 fois), sans rien demander à la personne.
    var rolesARetirer = {}, minuteurRoles = null;
    function declarerRoles(essai) {
        var c = monCompte(); if (!c || !navigator.onLine) return Promise.resolve();
        var voulus = Object.keys(rolesLocaux()), retirer = Object.keys(rolesARetirer);
        if (!voulus.length && !retirer.length) return Promise.resolve();
        dernierControleRoles = Date.now();
        return appelApi('cles?mail=' + encodeURIComponent(c.mail)).then(function(x) {
            var serveur = x.roles || {};
            var ajouter = voulus.filter(function(role) { return !serveur[role]; }), aRetirer = retirer.filter(function(role) { return serveur[role]; });
            if (!ajouter.length && !aRetirer.length) { rolesARetirer = {}; return; }
            return appelApi('roles', { methode: 'POST', corps: { ajouter: ajouter, retirer: aRetirer } }).then(function() {
                rolesARetirer = {};
                // Vérification quelques secondes plus tard ; redéclaration si le compte ne les montre pas encore.
                if ((essai || 0) < 3) setTimeout(function() { declarerRoles((essai || 0) + 1); }, [3000, 8000, 20000][essai || 0]);
            });
        }).catch(function() {
            if ((essai || 0) < 3) setTimeout(function() { declarerRoles((essai || 0) + 1); }, 8000);
        });
    }
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && Date.now() - dernierControleRoles > 5 * 60 * 1000) declarerRoles();
    });
    window.JUMELAGE_DECLARER_ROLE = function(role, actif) {
        var r = lireJSON(CLE_ROLES_LOCAUX) || {};
        if (actif) { r[role] = true; delete rolesARetirer[role]; } else { delete r[role]; rolesARetirer[role] = true; }
        ecrireTxt(CLE_ROLES_LOCAUX, JSON.stringify(r));
        // Plusieurs rôles changés d'un coup : une seule déclaration, juste après.
        clearTimeout(minuteurRoles);
        minuteurRoles = setTimeout(function() { declarerRoles(0); }, 200);
    };
    window.JUMELAGE_COMPTE_MAIL = function() { var c = monCompte(); return c ? c.mail : ''; };
    // Absence d'un destinataire (avant l'envoi) : { mail du remplaçant, jusqu } ou null. Mémorisée 30 secondes.
    var absences = {};
    window.JUMELAGE_ABSENCE = function(mail, type) {
        return absenceBrute(mail).then(function(rp) { var c = remplacantPour(rp, type || 'DEMANDE'); return c ? { mail: c, jusqu: rp.jusqu, qui: (rp.noms || {})[c] || '', titulaire: rp.qui || '' } : null; });
    };
    function absenceBrute(mail) {
        mail = String(mail || '').trim().toLowerCase();
        if (!monCompte() || !navigator.onLine || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return Promise.resolve(null);
        var a = absences[mail];
        if (a && Date.now() - a.le < 30 * 1000) return Promise.resolve(a.r);
        return appelApi('cles?mail=' + encodeURIComponent(mail)).then(function(r) {
            var rp = r.compte && r.remplacant ? r.remplacant : null;
            absences[mail] = { le: Date.now(), r: rp }; return rp;
        }).catch(function() { return null; });
    }
    // Remplaçant à qui va un envoi selon son type (un remplaçant par rôle) ; null : l'envoi reste au destinataire.
    function remplacantPour(rp, type) {
        if (!rp || !rp.mail) return null;
        if (!rp.roles) return rp.mail;
        var role = { DEMANDE: 'valideur1', RENVOI: 'valideur1', VALIDATION_1: 'valideur2', CHORUS: 'chorus', CR: 'chorus' }[type];
        return role ? rp.roles[role] || null : rp.mail;
    }
    // Envoi direct : chiffré pour tous les appareils du destinataire. Rejette avec e.pasDeCompte si le destinataire
    // n'a pas encore de compte TRIGONE (l'envoi est alors bloqué : il doit d'abord activer son compte).
    // opts.differable : sans réseau, l'envoi est mis en attente sur l'appareil et part tout seul au retour du réseau
    // (réponse { differe: true }) ; opts.libelle (notification « Envoyé »), opts.meta (suite à faire une fois parti).
    window.JUMELAGE_ENVOYER_DIRECT = function(destinataire, type, nom, texte, opts) {
        opts = opts || {};
        if (!monCompte()) return Promise.reject(Object.assign(new Error('Activez d\'abord votre compte TRIGONE.'), { sansCompte: true }));
        var attente = function() { return mettreEnAttente({ dest: destinataire, type: type, nom: nom, texte: texte, libelle: opts.libelle || '', meta: opts.meta || null, equipe: opts.equipe || null }); };
        if (!navigator.onLine) return opts.differable ? attente() : Promise.reject(new Error('Pas de connexion : l\'envoi direct demande du réseau.'));
        return envoyerMaintenant(destinataire, type, nom, texte, opts.equipe).catch(function(e) {
            if (opts.differable && erreurReseau(e)) return attente();
            throw e;
        });
    };
    function erreurReseau(e) { return !!e && !e.statut && !e.pasDeCompte && !e.sansCompte && (e instanceof TypeError || /fetch|network|réseau|Load failed/i.test(e.message || '')); }
    // equipe : référence d'une mission collective (le chef suit qui a envoyé son compte-rendu).
    function envoyerMaintenant(destinataire, type, nom, texte, equipe) {
        var dest = String(destinataire || '').trim().toLowerCase(), absent = null;
        return appelApi('cles?mail=' + encodeURIComponent(dest)).then(function(r) {
            // Destinataire absent (valideur, assistant Chorus DT) : l'envoi part chez son remplaçant (un refus, lui, va
            // toujours au demandeur).
            var cible = remplacantPour(r.remplacant, type);
            if (r.compte && cible && type !== 'REFUS') {
                absent = { mail: dest, jusqu: r.remplacant.jusqu };
                dest = cible;
                return appelApi('cles?mail=' + encodeURIComponent(dest));
            }
            return r;
        }).then(function(r) {
            if (!r.compte) throw Object.assign(new Error(dest + ' n\'a pas encore de compte TRIGONE.'), { pasDeCompte: true });
            // Le nom du fichier (qui contient le nom du demandeur) est chiffré avec le contenu : le serveur n'en voit rien.
            return chiffrerPour(r.appareils, JSON.stringify({ nom: nom, contenu: texte }));
        }).then(function(ch) {
            // Nombre de demandes de l'envoi (pour la notification « 3 demandes à signer ») : seul ce chiffre est visible du serveur.
            // Identifiants des demandes (refs) et nom de l'expéditeur (qui) : le serveur fait avancer le suivi de chaque
            // demande et prévient le demandeur (« validée par le VALIDEUR 1 (CNE DUPONT) »). Rien d'autre n'est visible.
            var nombre = 1, refs = [];
            try { var o = JSON.parse(texte); if (o && Array.isArray(o.demandes)) { nombre = o.demandes.length || 1; refs = o.demandes.map(function(d) { return d && d.id; }).filter(Boolean); } } catch (e) {}
            return appelApi('envoyer', { methode: 'POST', corps: { destinataire: dest, type: type, nombre: nombre, refs: refs, qui: window.JUMELAGE_QUI(), equipe: equipe || undefined, enveloppes: ch.enveloppes, donnees: ch.donnees } });
        }).then(function(r) {
            // Toute étape (demande, validation, transmission, refus, compte-rendu) : la frise de cet appareil se relit aussitôt.
            setTimeout(window.JUMELAGE_SUIVI_ACTUALISER, 800);
            if (absent) {
                r.remplacant = dest; r.absent = absent.mail;
                setTimeout(function() { bandeau(absent.mail + ' est absent jusqu\'au ' + new Date(absent.jusqu).toLocaleDateString('fr-FR') + ' : envoyé à son remplaçant, ' + dest + '.'); }, 400);
            }
            return r;
        });
    }
    // ---------- Boîte d'envoi : envois faits sans réseau ----------
    // Rangés dans l'appareil (IndexedDB « trigone-envois »), ils partent tout seuls au retour du réseau (événement
    // « online », à l'ouverture, puis toutes les minutes tant qu'il en reste), dans l'ordre. Une fois parti : la suite
    // prévue (meta.maj : mise à jour d'une liste enregistrée ; meta.rappels : rappel du départ), puis une notification
    // « Envoyé ». Refus du serveur (ex. destinataire sans compte) : l'envoi reste, signalé, à réessayer ou supprimer.
    var NB_ATTENTE = 0, videEnCours = null;
    function baseEnvois() {
        return new Promise(function(ok, ko) {
            var r = indexedDB.open('trigone-envois', 1);
            r.onupgradeneeded = function() { r.result.createObjectStore('attente', { keyPath: 'id' }); };
            r.onsuccess = function() { ok(r.result); }; r.onerror = function() { ko(r.error); };
        });
    }
    function envoisIdb(action, valeur) {
        return baseEnvois().then(function(db) { return new Promise(function(ok, ko) {
            var tx = db.transaction('attente', action === 'lire' ? 'readonly' : 'readwrite'), st = tx.objectStore('attente');
            var r = action === 'lire' ? st.getAll() : action === 'effacer' ? st.delete(valeur) : st.put(valeur);
            tx.oncomplete = function() { db.close(); var l = action === 'lire' ? (r.result || []) : null; if (l) { NB_ATTENTE = l.length; if (pastilleReseau) majPastilleReseau(); } ok(l); };
            tx.onerror = function() { db.close(); ko(tx.error); };
        }); });
    }
    function mettreEnAttente(x) {
        x.id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); x.cree = Date.now();
        return envoisIdb('ecrire', x).then(function() {
            NB_ATTENTE++;
            setTimeout(function() { bandeau('Pas de réseau : envoi mis en attente, il partira tout seul dès le retour du réseau.'); }, 300);
            return { differe: true, attente: x.id };
        });
    }
    function appliquerSuite(meta, r) {
        if (!meta) return;
        (meta.maj || []).forEach(function(m) {
            var l = lireJSON(m.cle); if (!Array.isArray(l)) return;
            l.forEach(function(e) {
                if (!Object.keys(m.cherche).every(function(k) { return e[k] === m.cherche[k]; })) return;
                Object.keys(m.pose || {}).forEach(function(k) { var v = m.pose[k]; e[k] = v === '$id' ? r.id : v === '$maintenant' ? Date.now() : v === '$iso' ? new Date().toISOString() : v; });
                (m.retire || []).forEach(function(k) { delete e[k]; });
            });
            ecrireTxt(m.cle, JSON.stringify(l));
        });
        if (meta.rappels && meta.rappels.length) window.JUMELAGE_RAPPEL_DEPART(meta.rappels);
    }
    function prevenirEnvoye(x) {
        var t = (x.libelle || 'Votre envoi') + ' est parti' + (x.libelle && /s$/.test(x.libelle.split(' ')[0]) ? 's' : '') + ', chiffré, dans TRIGONE.';
        if (window.Notification && Notification.permission === 'granted' && navigator.serviceWorker) {
            navigator.serviceWorker.getRegistration().then(function(reg) {
                if (reg) reg.showNotification('Envoyé', { body: t, tag: 'trigone-envoi-' + x.id, icon: (DANS_CR ? '../' : '') + 'icon-192.png' }); else bandeau(t);
            }).catch(function() { bandeau(t); });
        } else bandeau(t);
    }
    function viderAttente() {
        if (videEnCours || !monCompte() || !navigator.onLine || !window.indexedDB) return videEnCours || Promise.resolve(0);
        var partis = 0;
        videEnCours = envoisIdb('lire').then(function(l) {
            l = l.filter(function(x) { return !x.erreur; }).sort(function(a, b) { return a.cree - b.cree; });
            return l.reduce(function(prec, x) {
                return prec.then(function() {
                    if (!navigator.onLine) return;
                    return envoyerMaintenant(x.dest, x.type, x.nom, x.texte, x.equipe).then(function(r) {
                        return envoisIdb('effacer', x.id).then(function() { partis++; NB_ATTENTE = Math.max(0, NB_ATTENTE - 1); appliquerSuite(x.meta, r || {}); prevenirEnvoye(x);
                            try { if (window.JUMELAGE_APRES_ENVOI_DIFFERE) window.JUMELAGE_APRES_ENVOI_DIFFERE(x); } catch (e) {} });
                    }, function(e) {
                        if (erreurReseau(e)) return;   // toujours pas de réseau : on réessaiera
                        x.erreur = e.message || String(e);
                        return envoisIdb('ecrire', x).then(function() { bandeau('Envoi en attente impossible : ' + x.erreur + ' (Paramètres › Données › Envois en attente).'); });
                    });
                });
            }, Promise.resolve());
        }).catch(function() {}).then(function() { videEnCours = null; return partis; });
        return videEnCours;
    }
    window.JUMELAGE_VIDER_ATTENTE = viderAttente;
    window.JUMELAGE_ENVOIS_ATTENTE = function() { return window.indexedDB ? envoisIdb('lire').catch(function() { return []; }) : Promise.resolve([]); };
    window.addEventListener('online', function() { setTimeout(viderAttente, 1500); });
    // Hors réseau : pastille discrète en haut au centre (deux applis et page de garde). Un toucher explique que tout est
    // gardé sur l'appareil (horodatages, envois) et partira tout seul ; au retour du réseau, un bandeau le confirme.
    var pastilleReseau = null;
    function majPastilleReseau() {
        if (!document.body) return;
        var hors = navigator.onLine === false;
        if (!hors) { if (pastilleReseau) { pastilleReseau.remove(); pastilleReseau = null; } return; }
        if (!pastilleReseau) {
            pastilleReseau = document.createElement('button'); pastilleReseau.type = 'button'; pastilleReseau.className = 'JUM-HORS-RESEAU';
            ['pointerdown', 'pointerup'].forEach(function(t) { pastilleReseau.addEventListener(t, function(e) { e.stopPropagation(); }); });
            pastilleReseau.addEventListener('click', function(e) {
                e.stopPropagation();
                var o = pastilleReseau.classList.toggle('ouvert');
                clearTimeout(pastilleReseau.minuterie);
                if (o) pastilleReseau.minuterie = setTimeout(function() { if (pastilleReseau) pastilleReseau.classList.remove('ouvert'); }, 7000);
            });
            document.body.appendChild(pastilleReseau);
        }
        var n = NB_ATTENTE;
        pastilleReseau.innerHTML = '<span class="JUM-HR-PT"></span><b>Hors réseau' + (n ? ' · ' + n + ' en attente' : '') + '</b>' +
            '<small>Tout est gardé sur cet appareil : horodatages, comptes-rendus et demandes' + (n ? ' (' + n + ' envoi' + (n > 1 ? 's' : '') + ' en attente)' : '') + '. Ils partiront tout seuls au retour du réseau.</small>';
    }
    window.JUMELAGE_MAJ_RESEAU = majPastilleReseau;
    window.addEventListener('offline', majPastilleReseau);
    window.addEventListener('online', function() {
        var etait = !!pastilleReseau; majPastilleReseau();
        if (etait) bandeau('Réseau revenu' + (NB_ATTENTE ? ' : ' + NB_ATTENTE + ' envoi' + (NB_ATTENTE > 1 ? 's partent' : ' part') + ' maintenant.' : '.'));
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', majPastilleReseau); else setTimeout(majPastilleReseau, 0);
    setTimeout(function() {
        window.JUMELAGE_ENVOIS_ATTENTE().then(function(l) {
            if (!l.length) return;
            if (!navigator.onLine) bandeau(l.length + ' envoi' + (l.length > 1 ? 's' : '') + ' en attente : départ automatique dès le retour du réseau.');
            viderAttente();
        });
    }, 3000);
    setInterval(function() { if (NB_ATTENTE) viderAttente(); }, 60000);
    var fenAttente = null;
    window.JUMELAGE_FERMER_ATTENTE = function() { if (fenAttente) { fenAttente.remove(); fenAttente = null; } }; fermeurs.push([function() { return fenAttente; }, window.JUMELAGE_FERMER_ATTENTE]);
    window.JUMELAGE_ATTENTE = function() {
        window.JUMELAGE_FERMER_ATTENTE();
        var f = fenAttente = document.createElement('div'); f.className = 'JUM-REGLAGES'; f.setAttribute('role', 'dialog');
        function dessiner(l) {
            f.innerHTML = '<div class="JUM-R-CARTE"><div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('mail') : '') + '</span><div><h2>Envois en attente</h2>' +
                '<p>Faits sans réseau : ils partent tout seuls dès que le réseau revient.</p></div><button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_ATTENTE()">✕</button></div><div class="JUM-R-CORPS">' +
                (l.length ? l.map(function(x) {
                    return '<div class="JUM-ERR" style="border-left-color:' + (x.erreur ? '#b91c1c' : '#9a6f22') + '"><b>' + esc(x.libelle || x.nom) + '</b><small>À ' + esc(x.dest) + ' · préparé le ' + new Date(x.cree).toLocaleString('fr-FR') + '</small>' +
                        (x.erreur ? '<span class="JUM-ERR-MSG" style="color:#b91c1c">⛔ ' + esc(x.erreur) + '</span>' : '<small>⏳ Partira au retour du réseau</small>') +
                        '<div class="JUM-ERR-BTN"><button type="button" class="JUM-R-SECOND" data-reessayer="' + x.id + '">Réessayer</button><button type="button" class="JUM-R-SECOND" data-supprimer="' + x.id + '">Supprimer</button></div></div>';
                }).join('') : '<p class="JUM-R-AIDE" style="margin-top:14px;">✅ Aucun envoi en attente.</p>') +
                '</div><div class="JUM-R-PIED"><button type="button" class="JUM-R-PRINCIPAL" onclick="JUMELAGE_FERMER_ATTENTE()">Fermer</button></div></div>';
        }
        function charger() { window.JUMELAGE_ENVOIS_ATTENTE().then(function(l) { if (fenAttente === f) dessiner(l); }); }
        f.addEventListener('click', function(ev) {
            var r = ev.target.closest('[data-reessayer]'), d = ev.target.closest('[data-supprimer]');
            if (r) { window.JUMELAGE_ENVOIS_ATTENTE().then(function(l) { var x = l.filter(function(y) { return y.id === r.getAttribute('data-reessayer'); })[0]; if (!x) return;
                delete x.erreur; return envoisIdb('ecrire', x); }).then(function() { if (!navigator.onLine) bandeau('Toujours pas de réseau : l\'envoi partira à son retour.'); return viderAttente(); }).then(charger); }
            if (d && confirm('Supprimer cet envoi ? Il ne partira pas.')) envoisIdb('effacer', d.getAttribute('data-supprimer')).then(charger);
        });
        dessiner([]); document.body.appendChild(f); charger();
    };
    // Compte-rendu de fin de mission → boîte TRIGONE de l'assistant Chorus DT : le PDF du compte-rendu (produit par
    // Compte-rendu) et les justificatifs choisis ici (billets, factures : PDF ou photos, réduites avant l'envoi).
    var TAILLE_MAX_CR = 12 * 1024 * 1024, fenCr = null;
    function tailleLisible(o) { return o < 1024 * 1024 ? Math.max(1, Math.round(o / 1024)) + ' Ko' : (o / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo'; }
    function blobB64(b) { return b.arrayBuffer().then(versB64); }
    // Photo : au plus 2000 px de côté, en JPEG ; un justificatif reste lisible et l'envoi reste léger.
    function reduirePhoto(f) {
        if (!/^image\//.test(f.type) || !window.createImageBitmap || f.size < 400 * 1024) return Promise.resolve(f);
        return createImageBitmap(f).then(function(img) {
            var k = Math.min(1, 2000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
            c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            return new Promise(function(ok) { c.toBlob(function(b) { ok(b && b.size < f.size ? new File([b], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : f); }, 'image/jpeg', 0.82); });
        }).catch(function() { return f; });
    }
    // Justificatif photographié (facture, billet, NDS…) → « scan » : recadré sur la feuille (feuille claire sur un fond
    // plus sombre), fond blanchi et texte foncé (en couleur), 1 800 px au plus, puis en PDF d'une page A4 si
    // jsPDF est là (Compte-rendu). Si la feuille n'est pas trouvée avec certitude : pas de recadrage. En cas d'échec :
    // la photo d'origine. Le fichier rendu garde la photo d'origine (.origine) pour revenir en arrière.
    function otsu(hist, n) {
        var somme = 0, i; for (i = 0; i < 256; i++) somme += i * hist[i];
        var sB = 0, wB = 0, best = 0, seuil = 128;
        for (i = 0; i < 256; i++) {
            wB += hist[i]; if (!wB) continue; var wF = n - wB; if (!wF) break;
            sB += i * hist[i]; var mB = sB / wB, mF = (somme - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
            if (v > best) { best = v; seuil = i; }
        }
        return seuil;
    }
    function centile(hist, n, p) { var c = 0; for (var i = 0; i < 256; i++) { c += hist[i]; if (c >= n * p) return i; } return 255; }
    // Bords de la feuille : premières / dernières lignes (colonnes) majoritairement claires, sur 3 de suite.
    function bords(frac, lim) {
        var a = -1, b = -1, i;
        for (i = 0; i + 2 < frac.length; i++) if (frac[i] > lim && frac[i + 1] > lim && frac[i + 2] > lim) { a = i; break; }
        for (i = frac.length - 1; i - 2 >= 0; i--) if (frac[i] > lim && frac[i - 1] > lim && frac[i - 2] > lim) { b = i; break; }
        return a < 0 || b <= a ? null : [a, b];
    }
    function scannerPhoto(f, opts) {
        if (!/^image\//.test(f.type) || !window.createImageBitmap) return Promise.resolve(f);
        return createImageBitmap(f).then(function(img) {
            var k = Math.min(1, 1800 / Math.max(img.width, img.height)), W = Math.max(1, Math.round(img.width * k)), H = Math.max(1, Math.round(img.height * k));
            var c = document.createElement('canvas'); c.width = W; c.height = H;
            var g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
            var px = g.getImageData(0, 0, W, H).data, L = new Uint8ClampedArray(W * H), hist = new Array(256).fill(0), i, x, y;
            for (i = 0; i < W * H; i++) { var l = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000 | 0; L[i] = l; hist[l]++; }
            var T = otsu(hist, W * H), lignes = new Array(H).fill(0), cols = new Array(W).fill(0);
            for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (L[y * W + x] > T) { lignes[y]++; cols[x]++; }
            var ly = bords(lignes.map(function(v) { return v / W; }), 0.45), lx = bords(cols.map(function(v) { return v / H; }), 0.45);
            var x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
            if (ly && lx) {
                var aire = (lx[1] - lx[0]) * (ly[1] - ly[0]) / (W * H), clairs = 0;
                for (y = ly[0]; y <= ly[1]; y++) for (x = lx[0]; x <= lx[1]; x++) if (L[y * W + x] > T) clairs++;
                // Feuille nette : entre 20 % et 92 % de la photo, et claire aux trois quarts au moins.
                if (aire > 0.2 && aire < 0.92 && clairs / ((lx[1] - lx[0] + 1) * (ly[1] - ly[0] + 1)) > 0.75) {
                    var m = Math.round(Math.min(W, H) * 0.01); x0 = Math.max(0, lx[0] + m); x1 = Math.min(W - 1, lx[1] - m); y0 = Math.max(0, ly[0] + m); y1 = Math.min(H - 1, ly[1] - m);
                }
            }
            var w = x1 - x0 + 1, h = y1 - y0 + 1;
            // Fond de la feuille estimé par pavés (valeur claire de chaque pavé, lissée) : les ombres et l'éclairage
            // inégal disparaissent, chaque zone est comparée au papier qui l'entoure. Puis le fond devient blanc,
            // l'encre noire.
            var B = Math.max(16, Math.round(Math.min(w, h) / 24)), nx = Math.ceil(w / B), ny = Math.ceil(h / B), fond = new Float32Array(nx * ny), bx, by;
            for (by = 0; by < ny; by++) for (bx = 0; bx < nx; bx++) {
                var hb = new Array(256).fill(0), nb = 0;
                for (y = y0 + by * B; y < Math.min(y0 + (by + 1) * B, y1 + 1); y++) for (x = x0 + bx * B; x < Math.min(x0 + (bx + 1) * B, x1 + 1); x++) { hb[L[y * W + x]]++; nb++; }
                fond[by * nx + bx] = Math.max(centile(hb, nb, 0.9), 40);
            }
            // Pavé tout encre (gros titre) : on prend le papier le plus clair des pavés voisins, puis on lisse.
            var clair = new Float32Array(nx * ny), lisse = new Float32Array(nx * ny);
            [[fond, clair, 2, true], [clair, lisse, 1, false]].forEach(function(p) {
                for (var yy = 0; yy < ny; yy++) for (var xx = 0; xx < nx; xx++) {
                    var t = 0, n = 0, mx = 0;
                    for (var dy = -p[2]; dy <= p[2]; dy++) for (var dx = -p[2]; dx <= p[2]; dx++) { var X = xx + dx, Y = yy + dy;
                        if (X >= 0 && Y >= 0 && X < nx && Y < ny) { var v0 = p[0][Y * nx + X]; t += v0; n++; if (v0 > mx) mx = v0; } }
                    p[1][yy * nx + xx] = p[3] ? mx : t / n;
                }
            });
            var sortie = document.createElement('canvas'); sortie.width = w; sortie.height = h;
            var gs = sortie.getContext('2d'), im = gs.createImageData(w, h), d = im.data, j = 0;
            for (y = 0; y < h; y++) {
                var fy = Math.min(Math.max(y / B - 0.5, 0), ny - 1), iy = Math.floor(fy), ty = fy - iy, iy2 = Math.min(iy + 1, ny - 1);
                for (x = 0; x < w; x++) {
                    var fx = Math.min(Math.max(x / B - 0.5, 0), nx - 1), ix = Math.floor(fx), tx = fx - ix, ix2 = Math.min(ix + 1, nx - 1);
                    var bg = (lisse[iy * nx + ix] * (1 - tx) + lisse[iy * nx + ix2] * tx) * (1 - ty) + (lisse[iy2 * nx + ix] * (1 - tx) + lisse[iy2 * nx + ix2] * tx) * ty;
                    // En couleur : chaque composante comparée au papier — 90 % du fond ou plus : blanc ; 35 % ou moins :
                    // saturée (encre noire, tampon bleu, surligné…).
                    var o = ((y + y0) * W + x + x0) * 4;
                    for (var cc = 0; cc < 3; cc++) {
                        var v = (px[o + cc] / bg - 0.35) / 0.55;
                        v = v < 0 ? 0 : v > 1 ? 1 : v;
                        d[j + cc] = 255 * Math.pow(v, 1.4);
                    }
                    d[j + 3] = 255; j += 4;
                }
            }
            gs.putImageData(im, 0, 0);
            var base = f.name.replace(/\.[^.]+$/, '');
            return new Promise(function(ok) { sortie.toBlob(ok, 'image/jpeg', 0.72); }).then(function(jpeg) {
                if (!jpeg) return f;
                var res;
                if (opts && opts.pdf && window.jspdf && window.jspdf.jsPDF) {
                    return jpeg.arrayBuffer().then(function(buf) {
                        var paysage = w > h, doc = new window.jspdf.jsPDF({ orientation: paysage ? 'l' : 'p', unit: 'mm', format: 'a4', compress: true });
                        var PW = paysage ? 297 : 210, PH = paysage ? 210 : 297, marge = 8, r = Math.min((PW - 2 * marge) / w, (PH - 2 * marge) / h);
                        doc.addImage(new Uint8Array(buf), 'JPEG', (PW - w * r) / 2, (PH - h * r) / 2, w * r, h * r);
                        res = new File([doc.output('blob')], base + '.pdf', { type: 'application/pdf' });
                        res.origine = f; res.scanne = true; res.recadre = x0 > 0 || y0 > 0 || x1 < W - 1 || y1 < H - 1;
                        return res;
                    });
                }
                res = new File([jpeg], base + '.jpg', { type: 'image/jpeg' });
                res.origine = f; res.scanne = true; res.recadre = x0 > 0 || y0 > 0 || x1 < W - 1 || y1 < H - 1;
                return res;
            });
        }).catch(function() { return f; });
    }
    window.JUMELAGE_SCANNER_PHOTO = scannerPhoto;
    window.JUMELAGE_FERMER_ENVOI_CR = function() { if (fenCr) { fenCr.remove(); fenCr = null; } }; fermeurs.push([function() { return fenCr; }, window.JUMELAGE_FERMER_ENVOI_CR]);
    // o : { destinataire, missionnaire, libelle, dates, corps, pieces (justificatifs déclarés), pdf() → Promise<{ nom, blob }>, succes() }
    window.JUMELAGE_ENVOYER_CR = function(o) {
        if (fenCr || !document.body) return;
        var compte = monCompte(), choisis = [];
        o.roleEquipe = o.roleEquipe || ''; o.participants = o.participants || null;
        fenCr = document.createElement('div');
        fenCr.className = 'JUM-REGLAGES';
        fenCr.setAttribute('role', 'dialog');
        var tete = '<div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('mail') : '') + '</span><div><h2>Envoyer le compte-rendu</h2>' +
            '<p>Chiffré, il arrive dans le TRIGONE de l\'assistant Chorus DT' + (o.destinataire ? ' (' + esc(o.destinataire) + ')' : '') + '. Seul lui peut le lire.</p><p id="JUM-CR-ABSENCE" class="JUM-CR-ABSENCE" style="display:none;"></p></div>' +
            '<button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_ENVOI_CR()">✕</button></div>';
        if (!compte || !o.destinataire) {
            fenCr.innerHTML = '<div class="JUM-R-CARTE">' + tete + '<div class="JUM-R-CORPS"><p class="JUM-R-AIDE" style="margin-top:14px;">' +
                (!compte ? 'Pour envoyer votre compte-rendu, <b>connectez-vous</b> d\'abord à TRIGONE (votre adresse mail professionnelle, vérifiée par un code) : une seule fois, sur cet appareil.'
                    : 'Renseignez d\'abord le <b>mail de l\'assistant Chorus DT</b> dans <b>Mon profil</b> (bouton de compte en haut à droite).') + '</p></div>' +
                '<div class="JUM-R-PIED"><button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_ENVOI_CR()">Fermer</button>' +
                '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-CR-ALLER">' + (!compte ? 'Se connecter' : 'Ouvrir mon profil') + '</button></div></div>';
            document.body.appendChild(fenCr);
            fenCr.querySelector('#JUM-CR-ALLER').addEventListener('click', function() { window.JUMELAGE_FERMER_ENVOI_CR(); if (!compte) window.JUMELAGE_COMPTE(); else window.JUMELAGE_REGLAGES(); });
            return;
        }
        var pieces = (o.pieces || []).filter(Boolean);
        fenCr.innerHTML = '<div class="JUM-R-CARTE">' + tete + '<div class="JUM-R-CORPS">' +
            '<div class="JUM-R-TITRE">Compte-rendu</div>' +
            '<div class="JUM-CR-FICHIER"><span>📄</span><b>Compte-rendu PDF</b><small>joint automatiquement</small></div>' +
            '<div class="JUM-R-TITRE">Justificatifs</div>' +
            (pieces.length ? '<p class="JUM-R-AIDE">Joignez les pièces déclarées : ' + pieces.map(esc).join(', ') + '.</p>' : '<p class="JUM-R-AIDE">Aucun justificatif déclaré pour ce compte-rendu.</p>') +
            '<div id="JUM-CR-LISTE"></div>' +
            '<label class="JUM-R-SECOND JUM-CR-AJOUT">📎 Ajouter des justificatifs (PDF ou photos)<input type="file" id="JUM-CR-FICHIERS" multiple accept="application/pdf,.pdf,image/*" style="display:none;"></label>' +
            (window.JUMELAGE_JUSTIFICATIFS().length ? '<button type="button" class="JUM-R-SECOND JUM-CR-AJOUT" id="JUM-CR-BOITE">📥 Depuis ma boîte TRIGONE (' + window.JUMELAGE_JUSTIFICATIFS().length + ')</button><div id="JUM-CR-BOITE-LISTE"></div>' : '') +
            '<p class="JUM-R-AIDE" id="JUM-CR-TAILLE" style="margin-top:6px;"></p>' +
            '<p class="JUM-R-ERREUR" id="JUM-CR-ERR"></p></div>' +
            '<div class="JUM-R-PIED"><button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_ENVOI_CR()">Annuler</button>' +
            '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-CR-ENVOYER">Envoyer</button></div></div>';
        document.body.appendChild(fenCr);
        var f = fenCr, err = f.querySelector('#JUM-CR-ERR'), btn = f.querySelector('#JUM-CR-ENVOYER');
        // Assistant Chorus DT absent : son remplaçant (nom et adresse) à la place ; au retour, tout lui revient seul.
        window.JUMELAGE_ABSENCE(o.destinataire, 'CR').then(function(rp) {
            var z = document.getElementById('JUM-CR-ABSENCE'); if (!z || !rp) return;
            z.innerHTML = '<b>Destinataire pendant l\'absence : ' + esc(rp.qui || rp.mail) + '</b>' + (rp.qui ? ' (' + esc(rp.mail) + ')' : '') + ', remplaçant de ' + esc(rp.titulaire || o.destinataire) + ' jusqu\'au ' + new Date(rp.jusqu).toLocaleDateString('fr-FR') + ' inclus.';
            z.style.display = '';
        });
        function total() { return choisis.reduce(function(t, x) { return t + x.size; }, 0); }
        function dessiner() {
            f.querySelector('#JUM-CR-LISTE').innerHTML = choisis.map(function(x, i) {
                return '<div class="JUM-CR-FICHIER"><span>' + (x.scanne ? '🧾' : /^image\//.test(x.type) ? '🖼️' : '📎') + '</span><b>' + esc(x.name) +
                    (x.scanne ? '<em class="JUM-CR-SCAN">' + (x.recadre ? 'scanné et recadré' : 'scanné') + ' · <button type="button" class="JUM-CR-ORIGINE" data-i="' + i + '">photo d\'origine</button></em>' : '') +
                    '</b><small>' + tailleLisible(x.size) + '</small>' +
                    '<button type="button" class="JUM-CR-RETIRER" data-i="' + i + '" aria-label="Retirer">✕</button></div>';
            }).join('');
            f.querySelector('#JUM-CR-TAILLE').textContent = choisis.length ? choisis.length + ' justificatif(s) — ' + tailleLisible(total()) + ' (' + tailleLisible(TAILLE_MAX_CR) + ' au plus)' : '';
        }
        f.querySelector('#JUM-CR-LISTE').addEventListener('click', function(ev) {
            var o2 = ev.target.closest('.JUM-CR-ORIGINE');
            // Recadrage raté : on revient à la photo d'origine (seulement réduite).
            if (o2) { var k = +o2.getAttribute('data-i'); reduirePhoto(choisis[k].origine).then(function(x) { choisis[k] = x; dessiner(); }); return; }
            var b = ev.target.closest('.JUM-CR-RETIRER'); if (!b) return;
            choisis.splice(+b.getAttribute('data-i'), 1); dessiner();
        });
        f.querySelector('#JUM-CR-FICHIERS').addEventListener('change', function(ev) {
            var liste = Array.prototype.slice.call(ev.target.files || []); ev.target.value = '';
            err.textContent = '';
            Promise.all(liste.map(function(x) { return scannerPhoto(x, { pdf: true }); })).then(function(r) {
                r.forEach(function(x) { if (!choisis.some(function(y) { return y.name === x.name && y.size === x.size; })) choisis.push(x); });
                dessiner();
                if (total() > TAILLE_MAX_CR) err.textContent = '⛔ Trop volumineux : retirez un fichier (' + tailleLisible(TAILLE_MAX_CR) + ' au plus).';
            });
        });
        // Justificatifs reçus par mail (factures, billets) : cochés, ils rejoignent la liste comme un fichier choisi.
        var boiteBtn = f.querySelector('#JUM-CR-BOITE'), depuisBoite = {};
        if (boiteBtn) boiteBtn.addEventListener('click', function() {
            var z = f.querySelector('#JUM-CR-BOITE-LISTE');
            if (z.innerHTML) { z.innerHTML = ''; return; }
            z.innerHTML = '<div class="JUM-CR-BOITE">' + window.JUMELAGE_JUSTIFICATIFS().map(function(j, k) {
                return '<label><input type="checkbox" data-k="' + k + '"><span><b>' + esc(j.nom) + '</b><small>' + esc([j.de, j.sujet, j.le ? new Date(j.le).toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · ')) +
                    (j.verifie ? '' : ' · <em>à vérifier</em>') + '</small></span></label>';
            }).join('') + '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-CR-BOITE-OK">Joindre la sélection</button></div>';
            z.querySelector('#JUM-CR-BOITE-OK').addEventListener('click', function() {
                var l = window.JUMELAGE_JUSTIFICATIFS(), coches = Array.prototype.filter.call(z.querySelectorAll('input:checked'), function() { return true; }).map(function(c) { return l[+c.getAttribute('data-k')]; });
                Promise.all(coches.map(function(j) { return window.JUMELAGE_JUSTIF_FICHIER(j.id, j.i).then(function(fi) { depuisBoite[j.id] = 1; return fi; }); })).then(function(fs) {
                    fs.forEach(function(x) { if (!choisis.some(function(y) { return y.name === x.name && y.size === x.size; })) choisis.push(x); });
                    z.innerHTML = ''; dessiner();
                    if (total() > TAILLE_MAX_CR) err.textContent = '⛔ Trop volumineux : retirez un fichier (' + tailleLisible(TAILLE_MAX_CR) + ' au plus).';
                }, function(e) { err.textContent = '⛔ ' + (e.message || e); });
            });
        });
        btn.addEventListener('click', function() {
            if (total() > TAILLE_MAX_CR) { err.textContent = '⛔ Trop volumineux : retirez un fichier (' + tailleLisible(TAILLE_MAX_CR) + ' au plus).'; return; }
            btn.disabled = true; btn.textContent = 'Envoi en cours…'; err.textContent = '';
            Promise.resolve().then(o.pdf).then(function(pdf) {
                if (!pdf || !pdf.blob) throw new Error('Le PDF du compte-rendu n\'a pas pu être produit : réessayez.');
                return Promise.all([blobB64(pdf.blob)].concat(choisis.map(blobB64))).then(function(b64) {
                    var fichiers = [{ nom: pdf.nom, type: 'application/pdf', b64: b64[0] }].concat(choisis.map(function(x, i) { return { nom: x.name, type: x.type || 'application/octet-stream', b64: b64[i + 1] }; }));
                    var contenu = JSON.stringify({ app: 'TRIGONE-CR', version: 1, missionnaire: o.missionnaire || '', libelle: o.libelle || '', dates: o.dates || '',
                        corps: o.corps || '', de: compte.mail, envoyeLe: new Date().toISOString(), fichiers: fichiers,
                        omr: o.omr || undefined, mref: o.mref || undefined, montants: o.montants || undefined,
                        // Mission collective : référence de l'équipe, rôle (chef / participant) et participants (nom, adresse).
                        equipe: o.equipe || undefined, roleEquipe: o.roleEquipe || undefined, participants: o.participants || undefined });
                    return window.JUMELAGE_ENVOYER_DIRECT(o.destinataire, 'CR', pdf.nom, contenu, { differable: true, meta: o.meta || null, equipe: o.equipe || null,
                        libelle: 'Votre compte-rendu' + (o.libelle && o.libelle !== 'Compte-rendu de mission' ? ' « ' + o.libelle + ' »' : '') });
                });
            }).then(function(r) {
                window.JUMELAGE_FERMER_ENVOI_CR();
                // Justificatifs repris de la boîte : rangés (« traités »), sur tous mes appareils.
                Object.keys(depuisBoite).forEach(function(id) { window.JUMELAGE_BOITE_MARQUER(id, 'traite'); });
                // r.id : identifiant de l'envoi, qui sert aussi au suivi (récupéré, traité par l'assistant Chorus DT).
                if (o.succes) o.succes(r || {});
            }).catch(function(e) {
                btn.disabled = false; btn.textContent = 'Envoyer';
                err.textContent = '⛔ ' + (e.pasDeCompte ? o.destinataire + ' n\'a pas encore de compte TRIGONE : demandez-lui de se connecter (bouton « Se connecter » en haut à droite), puis renvoyez votre compte-rendu.' : (e.message || String(e)));
            });
        });
    };
    // ---------- Notifications (Web Push) : l'appareil est prévenu de chaque envoi, même TRIGONE fermée ----------
    // Abonnement par le service worker de Mise en route (portée : tout TRIGONE). iPhone / iPad : seulement pour
    // TRIGONE installée sur l'écran d'accueil (iOS 16.4 ou plus). La permission se demande sur un geste (bouton).
    var CLE_NOTIF = 'trigone_notif';
    function notifPossible() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
    function estIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
    function notifEtat() {
        if (!notifPossible()) return estIOS() ? 'ios' : 'impossible';
        return Notification.permission === 'granted' ? (lireTxt(CLE_NOTIF) ? 'active' : 'autorisee') : Notification.permission === 'denied' ? 'refusee' : 'a-demander';
    }
    function enregistrementRacine() {
        return navigator.serviceWorker.getRegistration(APPLIS.mer.url).then(function(r) {
            return r || navigator.serviceWorker.register(APPLIS.mer.url + 'sw.js', { scope: APPLIS.mer.url });
        }).then(function() { return navigator.serviceWorker.getRegistration(APPLIS.mer.url); }).then(function(r) {
            if (!r) throw new Error('Service indisponible : rechargez TRIGONE.');
            return r.active ? r : new Promise(function(ok) { var w = r.installing || r.waiting; if (!w) return ok(r); w.addEventListener('statechange', function() { if (w.state === 'activated') ok(r); }); });
        });
    }
    // Abonne l'appareil et donne l'abonnement au serveur (une fois par appareil et par abonnement).
    function abonnerNotif() {
        var c = monCompte(); if (!c) return Promise.reject(new Error('Activez d\'abord votre compte TRIGONE.'));
        return enregistrementRacine().then(function(reg) {
            return reg.pushManager.getSubscription().then(function(ab) {
                if (ab) return ab;
                return appelApi('push/cle').then(function(r) {
                    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: depuisB64(r.cle.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((r.cle.length + 3) % 4)) });
                });
            });
        }).then(function(ab) {
            // Redonné au serveur si l'abonnement a changé, ou au plus tard toutes les 6 heures (le serveur ne le perd jamais longtemps).
            var j = ab.toJSON(), marque = c.appareil + '|' + j.endpoint, memo = lireJSON(CLE_NOTIF) || {};
            if (memo.m === marque && Date.now() - (memo.t || 0) < 6 * 3600 * 1000) return true;
            return appelApi('push', { methode: 'POST', corps: { abonnement: { endpoint: j.endpoint, keys: j.keys } } }).then(function() {
                ecrireTxt(CLE_NOTIF, JSON.stringify({ m: marque, t: Date.now() })); return true;
            });
        });
    }
    window.JUMELAGE_ACTIVER_NOTIF = function() {
        if (!notifPossible()) return Promise.reject(new Error(notifEtat() === 'ios'
            ? 'Sur iPhone / iPad, installez d\'abord TRIGONE sur l\'écran d\'accueil (Partager › Sur l\'écran d\'accueil), ouvrez-la depuis cette icône, puis activez les notifications.'
            : 'Ce navigateur ne permet pas les notifications.'));
        return Notification.requestPermission().then(function(p) {
            if (p !== 'granted') throw new Error('Notifications refusées. Pour les autoriser : réglages du navigateur (ou du téléphone) › Notifications › TRIGONE.');
            return abonnerNotif();
        });
    };
    window.JUMELAGE_NOTIF_ETAT = notifEtat;
    // Déjà autorisées : l'abonnement est tenu à jour à chaque ouverture (nouvel appareil, compte réactivé…).
    function suivreNotif() { if (monCompte() && notifPossible() && Notification.permission === 'granted' && navigator.onLine) abonnerNotif().catch(function() {}); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function(ev) {
        if (ev.data && ev.data.type === 'trigone-push' && window.JUMELAGE_RELEVER) { window.JUMELAGE_RELEVER(); window.JUMELAGE_SUIVI_ACTUALISER(); }
    });
    // ---------- Suivi de mes demandes et comptes-rendus (étapes tenues par le serveur, sans contenu) ----------
    // Copie locale « trigone_suivi » : { ref: { genre, etape, envoi, le, etapes: [{ e, le, qui }] } } ; événement
    // « trigone-suivi » à chaque mise à jour.
    var CLE_SUIVI = 'trigone_suivi', suiviEnCours = null;
    window.JUMELAGE_SUIVI = function() { return lireJSON(CLE_SUIVI) || {}; };
    // Rappel « départ en mission » : [{ ref, quand (ms) }] ; le serveur ne reçoit que l'heure, rien du contenu.
    // Suivi de l'équipe d'une mission collective (chef de mission) : [{ mail, recu, envoye, relance }] ; relance des retardataires.
    window.JUMELAGE_EQUIPE = function(ref) { return appelApi('equipe?ref=' + encodeURIComponent(ref)).then(function(r) { return r.equipe || []; }); };
    window.JUMELAGE_EQUIPE_RELANCER = function(ref, libelle) { return appelApi('equipe/relance', { methode: 'POST', corps: { ref: ref, libelle: libelle || '' } }).then(function(r) { return r.n; }); };
    window.JUMELAGE_RAPPEL_DEPART = function(liste) {
        if (!monCompte() || !liste || !liste.length) return Promise.resolve();
        return appelApi('rappel', { methode: 'POST', corps: { rappels: liste } }).catch(function() {});
    };
    // Demandes refusées que le demandeur abandonne (retirées de Documents) : plus de rappel.
    window.JUMELAGE_SUIVI_ABANDON = function(ids) {
        if (monCompte() && ids && ids.length) appelApi('suivi/abandon', { methode: 'POST', corps: { refs: ids } }).then(window.JUMELAGE_SUIVI_ACTUALISER).catch(function() {});
    };
    window.JUMELAGE_SUIVI_ACTUALISER = function() {
        if (!monCompte() || !navigator.onLine) return Promise.resolve(window.JUMELAGE_SUIVI());
        if (suiviEnCours) return suiviEnCours;
        suiviEnCours = appelApi('suivi').then(function(r) {
            var avant = lireTxt(CLE_SUIVI), o = {};
            // intervenant : demande d'un autre, que j'ai validée ou traitée (j'en vois la suite).
            (r.suivi || []).forEach(function(x) { if (o[x.ref] && !o[x.ref].intervenant) return;
                o[x.ref] = { genre: x.genre, etape: x.etape, envoi: x.envoi, le: x.le, etapes: x.etapes || [], intervenant: !!x.intervenant }; });
            var txt = JSON.stringify(o);
            if (txt !== avant) { ecrireTxt(CLE_SUIVI, txt); try { window.dispatchEvent(new Event('trigone-suivi')); } catch (e) {} }
            return o;
        }).catch(function() { return window.JUMELAGE_SUIVI(); }).then(function(o) { suiviEnCours = null; return o; });
        return suiviEnCours;
    };
    // Notifications coupées sur cet appareil seulement (ex. téléphone, quand le PC du bureau suffit) : le serveur
    // n'envoie plus rien à cet appareil ; les autres appareils du compte continuent de les recevoir.
    var CLE_MUET = 'trigone_notif_muet';
    function notifMuet() { return lireTxt(CLE_MUET) === '1'; }
    var SVG_CLOCHE = '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
    var SVG_CLOCHE_OFF = '<svg viewBox="0 0 24 24"><path d="M8.7 3.4A6 6 0 0 1 18 8c0 2.8.5 4.7 1.1 6M17 17H3s3-2 3-9c0-.8.1-1.5.4-2.2M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20"/></svg>';
    function htmlCloche() { return notifMuet() ? SVG_CLOCHE_OFF + '<span>Notifications coupées ici</span>' : SVG_CLOCHE + '<span>Notifications</span>'; }
    function majCloches() {
        Array.prototype.forEach.call(document.querySelectorAll('.JUM-CLOCHE'), function(b) {
            b.classList.toggle('muet', notifMuet()); b.innerHTML = htmlCloche();
            b.title = notifMuet() ? 'Notifications coupées sur cet appareil : touchez pour les rétablir' : 'Notifications actives sur cet appareil : touchez pour les couper ici';
        });
        majBoutonsCompte();
        var c = document.getElementById('JUM-C-MUET');
        if (c) c.textContent = notifMuet() ? '🔔 Rétablir les notifications sur cet appareil' : '🔕 Couper les notifications sur cet appareil';
    }
    window.JUMELAGE_NOTIF_MUET = function(muet) {
        if (typeof muet !== 'boolean') muet = !notifMuet();
        return appelApi('push/muet', { methode: 'POST', corps: { muet: muet } }).then(function() {
            if (muet) ecrireTxt(CLE_MUET, '1'); else { try { localStorage.removeItem(CLE_MUET); } catch (e) {} }
            majCloches();
            bandeau(muet ? 'Notifications coupées sur cet appareil. Vos autres appareils les reçoivent toujours ; la boîte TRIGONE se relève quand vous ouvrez l\'appli.' : 'Notifications rétablies sur cet appareil.');
        }).catch(function(e) { bandeau('Impossible pour l\'instant : ' + e.message); });
    };
    function blocNotif() {
        var e = notifEtat();
        var android = /Android/i.test(navigator.userAgent || '');
        if (e === 'active') return '<p class="JUM-R-AIDE">🔔 <b>Notifications activées</b> sur cet appareil : vous êtes prévenu de chaque envoi, même TRIGONE fermée.</p>' +
            (android ? '<p class="JUM-R-AIDE">Notification en retard ou absente quand TRIGONE est fermée ? <b>Paramètres › Applications › Chrome › Batterie › « Non restreinte »</b>.</p>' : '') +
            (estIOS() ? '<p class="JUM-R-AIDE">Notification en retard ou silencieuse ? Dans <b>Réglages › Notifications</b>, laissez TRIGONE <b>hors du Résumé programmé</b>, et ajoutez-la aux applis autorisées de vos <b>modes de concentration</b>. Ne supprimez pas l\'icône TRIGONE de l\'écran d\'accueil : l\'abonnement serait perdu.</p>' : '') +
            '<button type="button" class="JUM-R-SECOND" id="JUM-C-MUET" style="margin:8px 0 0; width:100%;"></button>' +
            '<button type="button" class="JUM-R-SECOND" id="JUM-C-TEST" style="margin:8px 0 0; width:100%;">🔔 Tester les notifications</button><div id="JUM-C-TEST-RES"></div>';
        if (e === 'impossible') return '<p class="JUM-R-AIDE">🔕 Ce navigateur ne permet pas les notifications : ouvrez TRIGONE pour relever vos envois.</p>';
        return '<div class="JUM-R-TITRE">Notifications</div><p class="JUM-R-AIDE">' + (e === 'ios'
            ? 'Sur iPhone / iPad, les notifications demandent TRIGONE <b>installée sur l\'écran d\'accueil</b> (Partager › Sur l\'écran d\'accueil) : ouvrez-la depuis cette icône, puis revenez ici.'
            : e === 'refusee' ? 'Les notifications sont bloquées pour TRIGONE : autorisez-les dans les réglages du navigateur (ou du téléphone), puis revenez ici.'
            : 'Soyez prévenu de chaque demande, refus ou compte-rendu reçu, même quand TRIGONE est fermée.') + '</p>' +
            (e === 'ios' || e === 'refusee' ? '' : '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-C-NOTIF" style="margin:8px 0 0; width:100%;">🔔 Activer les notifications</button>');
    }

    // ---------- Boîte de réception (sur l'appareil) ----------
    // Chaque envoi reçu est déchiffré, rangé sur l'appareil (Cache « trigone-boite-reception » + index localStorage
    // « trigone_boite »), puis supprimé du serveur. Il reste dans la boîte jusqu'à ce qu'on le traite ou le supprime.
    var CLE_BOITE = 'trigone_boite', CACHE_BOITE = 'trigone-boite-reception';
    // Adresse du fichier d'un envoi dans le cache : la même depuis Mise en route et depuis Compte-rendu (une adresse
    // relative dépendait de l'appli ouverte pendant la relève : « Fichier introuvable » dans l'autre).
    // ancienne : l'adresse qu'avait une relève faite depuis Compte-rendu (versions ≤ 77).
    function cleFichierBoite(id, ancienne) {
        return new URL((ancienne ? 'cr/' : '') + '__boite__/' + id, new URL(APPLIS.mer.url, location.href)).href;
    }
    function boiteLire() { var l = lireJSON(CLE_BOITE); return Array.isArray(l) ? l : []; }
    function boiteEcrire(l) {
        ecrireTxt(CLE_BOITE, JSON.stringify(l));
        majPastilleHub();
        try { window.dispatchEvent(new Event('trigone-boite')); } catch (e) {}
    }
    // Nature d'un envoi, d'après son contenu : à signer (1er ou 2e niveau), pour l'assistant Chorus DT, ou refus.
    function resumeEnvoi(texte) {
        try {
            var d = JSON.parse(texte);
            // Compte-rendu de fin de mission (Compte-rendu → assistant Chorus DT).
            // Mission collective : lien du compte-rendu prérempli, envoyé par le chef de mission à un participant.
            if (d.app === 'TRIGONE-COLLECTIVE') return { nature: 'collective', n: 1, ids: [], noms: d.chef || '', objet: d.libelle || 'Mission collective',
                dates: d.dates || '', lieu: '', donnees: String(d.donnees || '') };
            // Question d'un valideur / de l'assistant Chorus DT, et réponse du missionnaire.
            // Justificatifs reçus par mail à l'adresse TRIGONE du missionnaire (factures, billets).
            if (d.app === 'TRIGONE-JUSTIF') return { nature: 'justif', n: 1, ids: [], noms: d.nomDe || d.de || 'Expéditeur inconnu', objet: d.sujet || 'Justificatif reçu par mail',
                dates: '', lieu: '', verifie: !!d.verifie, transfere: !!d.transfere, pieces: (d.fichiers || []).length,
                fichiers: (d.fichiers || []).map(function(f) { return { nom: String(f.nom || 'justificatif').slice(0, 120), type: f.type || '' }; }) };
            if (d.app === 'TRIGONE-QUESTION' && d.tampon) tamponOmrNoter(d.ref, d.tampon);
            if (d.app === 'TRIGONE-QUESTION' || d.app === 'TRIGONE-REPONSE') return { nature: d.app === 'TRIGONE-QUESTION' ? 'question' : 'reponse', n: 1, ids: [],
                noms: d.qui || '', objet: d.objet || '', dates: '', lieu: '', ref: d.ref || '', genre: d.genre || '', question: String(d.question || '').slice(0, 2000), reponse: String(d.reponse || '').slice(0, 2000), rappel: !!d.rappel };
            if (d.app === 'TRIGONE-CR') return { nature: 'cr', n: 1, ids: [], noms: d.missionnaire || '', objet: d.libelle || 'Compte-rendu de mission',
                dates: d.dates || '', lieu: '', pieces: (d.fichiers || []).length, equipe: d.equipe || '', roleEquipe: d.roleEquipe || '',
                omr: String(d.omr || '').slice(0, 30), mref: String(d.mref || '').slice(0, 60), montants: d.montants && typeof d.montants === 'object' ? d.montants : null };
            var ds = d.demandes || [], p0 = ((ds[0] || {}).personnes || [])[0] || {};
            var nature = ds.some(function(x) { return x.refus; }) ? 'refus'
                : ds.length && ds.every(function(x) { return x.renvoi && !(x.validations || []).length; }) ? 'renvoi'
                : ds.length && ds.every(function(x) { return (x.validations || []).length >= 2; }) ? 'chorus'
                : ds.some(function(x) { return (x.validations || []).length === 1; }) ? 'niveau2' : 'niveau1';
            var a = ((ds[0] || {}).trajets || {}).aller || {}, r = ((ds[0] || {}).trajets || {}).retour || {};
            var jour = function(v) { try { return v ? new Date(v).toLocaleDateString('fr-FR') : ''; } catch (e) { return ''; } };
            // Demandes validées (assistant Chorus DT) : de quoi remplir le registre OMR.
            var registre = nature !== 'chorus' ? undefined : ds.map(function(x) {
                var ax = (x.trajets || {}).aller || {}, rx = (x.trajets || {}).retour || {};
                return { ref: x.id || '', omr: x.omr || '', omrLe: x.omrLe || '', objet: x.objet || '', type: x.type || '', codeFD: x.codeFD || '',
                    debut: ax.dateDep || '', fin: rx.dateArr || '', mailDemandeur: x.mailDemandeur || '', pays: ax.paysArr || rx.paysDep || '',
                    personnes: (x.personnes || []).map(function(p) { return { grade: p.grade || '', nom: p.nom || '', prenom: p.prenom || '', nid: p.matricule || '' }; }) };
            });
            return { nature: nature, n: ds.length, ids: ds.map(function(x) { return x.id; }), registre: registre,
                noms: [p0.grade, p0.nom, p0.prenom].filter(Boolean).join(' ') + (ds.length > 1 ? ' (+ ' + (ds.length - 1) + ')' : ((ds[0] || {}).personnes || []).length > 1 ? ' et ' + ((ds[0].personnes.length) - 1) + ' autre(s)' : ''),
                objet: (ds[0] || {}).objet || '', dates: [jour(a.dateDep), jour(r.dateArr)].filter(Boolean).join(' → '),
                lieu: a.paysArr || a.lieuArr || '' };
        } catch (e) { return { nature: 'inconnu', n: 0, ids: [] }; }
    }
    window.JUMELAGE_BOITE_LISTE = function() { return boiteLire(); };
    // ---------- Tampon « TRAITÉ » ----------
    // Encre or, en biais, sur une demande ou un compte-rendu traité par l'assistant Chorus DT. Le coup de tampon (animation
    // et petit « clac ») se joue au moment de « Traité » chez l'assistant, et la première fois que le missionnaire l'ouvre.
    var CLE_TAMPONS = 'trigone_tampons_vus';
    function htmlTampon(o, anime) {
        return '<div class="JUM-TAMPON' + (o.couleur ? ' ' + o.couleur : '') + (anime ? ' coup' : '') + '" aria-label="' + esc(o.titre || 'Traité') + '"><div class="t1">' + esc(o.titre || 'TRAITÉ') + '</div>' +
            '<div class="t2">' + esc([o.unite, 'ASSIST CHORUS DT'].filter(Boolean).join(' · ')) + '</div>' +
            '<div class="t3">' + esc([o.le ? new Date(o.le).toLocaleDateString('fr-FR') : '', o.omr ? 'OMR N°' + o.omr : ''].filter(Boolean).join(' · ')) + '</div></div>';
    }
    function clac() {
        try {
            var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
            var ctx = new C(), n = ctx.sampleRate * 0.09, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
            for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
            var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
            f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = 0.55;
            src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
            setTimeout(function() { try { ctx.close(); } catch (e) {} }, 400);
        } catch (e) {}
        if (navigator.vibrate) try { navigator.vibrate(35); } catch (e) {}
    }
    // Tampon posé (html) ; cle : envoi ou demande : animé la première fois seulement (sauf vu === true).
    window.JUMELAGE_TAMPON = function(o, cle) {
        var vus = lireJSON(CLE_TAMPONS) || {}, anime = !!cle && !vus[cle];
        if (anime) { vus[cle] = Date.now(); var k = Object.keys(vus); if (k.length > 400) k.sort(function(a, b) { return vus[a] - vus[b]; }).slice(0, k.length - 400).forEach(function(x) { delete vus[x]; }); ecrireTxt(CLE_TAMPONS, JSON.stringify(vus)); setTimeout(clac, 380); }
        return htmlTampon(o, anime);
    };
    // Coup de tampon au centre de l'écran (assistant Chorus DT : « Traité »).
    window.JUMELAGE_TAMPON_COUP = function(o) {
        var f = document.createElement('div'); f.className = 'JUM-TAMPON-SCENE'; f.innerHTML = htmlTampon(o, true);
        document.body.appendChild(f); setTimeout(clac, 380);
        setTimeout(function() { f.classList.add('fin'); }, 1300); setTimeout(function() { f.remove(); }, 1700);
        if (o.cle) { var vus = lireJSON(CLE_TAMPONS) || {}; vus[o.cle] = Date.now(); ecrireTxt(CLE_TAMPONS, JSON.stringify(vus)); }
    };
    // Tampons « SANS FRAIS » (orange) et « ANNULÉ » (rouge) posés par l'assistant Chorus DT sur un OMR du registre : reçus
    // par le missionnaire avec le message qui le prévient, gardés par demande (ref) ; s: 'aucun' quand le tampon est retiré.
    var CLE_TAMPONS_OMR = 'trigone_tampons_omr';
    function tamponOmrNoter(ref, t) {
        if (!ref || !t || ['sansfrais', 'annule', 'aucun'].indexOf(t.s) < 0) return;
        var m = lireJSON(CLE_TAMPONS_OMR) || {};
        if (m[ref] && (m[ref].le || 0) >= (t.le || 0)) return;
        m[ref] = { s: t.s, le: t.le || Date.now(), par: String(t.par || '').slice(0, 120), motif: String(t.motif || '').slice(0, 300), unite: String(t.unite || '').slice(0, 30), omr: String(t.omr || '').slice(0, 30) };
        ecrireTxt(CLE_TAMPONS_OMR, JSON.stringify(m));
    }
    window.JUMELAGE_TAMPON_OMR = function(ref) { var t = (lireJSON(CLE_TAMPONS_OMR) || {})[ref]; return t && t.s !== 'aucun' ? t : null; };
    window.JUMELAGE_TAMPON_OMR_HTML = function(t, cle) {
        return window.JUMELAGE_TAMPON({ titre: t.s === 'annule' ? 'ANNULÉ' : 'SANS FRAIS', couleur: t.s === 'annule' ? 'rouge' : 'orange', unite: t.unite, le: t.le, omr: t.omr }, cle);
    };
    // ---------- Pastilles de mouvement ----------
    // Chaque fois qu'un envoi ou une demande change de dossier, son dossier, l'entrée du menu et l'onglet qui y mènent
    // portent un point rouge jusqu'à ce qu'on ouvre ce dossier. Clés « APPLI:PAGE:DOSSIER » (ex. MER:BIBLIOTHEQUE:chorus) ;
    // les éléments marqués data-mvt="MER:BIBLIOTHEQUE" (préfixe) s'allument si une clé en dessous est posée.
    var CLE_MVT = 'trigone_mouvements';
    function mvtLire() { return lireJSON(CLE_MVT) || {}; }
    window.JUMELAGE_MVT = function(cle) { var m = mvtLire(); m[cle] = Date.now(); ecrireTxt(CLE_MVT, JSON.stringify(m)); window.JUMELAGE_MVT_MAJ(); };
    window.JUMELAGE_MVT_VU = function(cle) { var m = mvtLire(); if (!m[cle]) return; delete m[cle]; ecrireTxt(CLE_MVT, JSON.stringify(m)); setTimeout(window.JUMELAGE_MVT_MAJ, 0); };
    window.JUMELAGE_MVT_A = function(prefixe) { var m = mvtLire(); return Object.keys(m).some(function(k) { return k === prefixe || k.indexOf(prefixe + ':') === 0; }); };
    window.JUMELAGE_MVT_MAJ = function() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-mvt]'), function(el) { el.classList.toggle('mvt', window.JUMELAGE_MVT_A(el.getAttribute('data-mvt'))); });
    };
    if (typeof MutationObserver === 'function') {
        var mvtMinuteur = null, mvtObs = new MutationObserver(function() { clearTimeout(mvtMinuteur); mvtMinuteur = setTimeout(window.JUMELAGE_MVT_MAJ, 30); });
        var mvtGo = function() { mvtObs.observe(document.body, { childList: true, subtree: true }); window.JUMELAGE_MVT_MAJ(); };
        if (document.body) mvtGo(); else document.addEventListener('DOMContentLoaded', mvtGo);
    }
    // ---------- Mémoire de TRIGONE sur l'appareil ----------
    // Bibliothèques sans limite de nombre : elles gardent tout, tant que la mémoire de TRIGONE le permet (environ 5 Mo
    // de texte par appareil, partagés par les deux applis ; justificatifs et pièces jointes sont rangés à part).
    // Stockage « persistant » demandé : le navigateur ne vide pas TRIGONE de lui-même quand l'appareil manque de place.
    var MEMOIRE_MAX = 5 * 1024 * 1024;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function(p) { if (!p) navigator.storage.persist(); }).catch(function() {}); } catch (e) {}
    window.JUMELAGE_MEMOIRE = function() {
        var o = 0;
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch (e) {}
        return { octets: o, pct: Math.min(100, Math.round(o / MEMOIRE_MAX * 100)) };
    };
    // « 12 comptes-rendus gardés sur cet appareil · mémoire de TRIGONE utilisée : 8 % ».
    window.JUMELAGE_MEMOIRE_TEXTE = function(n, singulier, pluriel) {
        var m = window.JUMELAGE_MEMOIRE();
        return n + ' ' + (n > 1 ? pluriel : singulier) + ' sur cet appareil · mémoire de TRIGONE utilisée : ' + Math.max(1, m.pct) + ' %' + (m.pct >= 85 ? ' — pensez à supprimer d\'anciennes missions' : '');
    };
    // Enregistrement impossible (mémoire pleine) : la personne est prévenue, rien n'est perdu de ce qui est déjà gardé.
    window.JUMELAGE_MEMOIRE_PLEINE = function() {
        var t = 'La mémoire de TRIGONE sur cet appareil est pleine : supprimez d\'anciennes missions dans la Bibliothèque (Mise en route ou Compte-rendu), puis réessayez.';
        if (typeof window.MSG_INFO === 'function') window.MSG_INFO('Mémoire pleine', t, '💾'); else window.alert(t);
    };
    // ---------- Registre OMR (assistant Chorus DT) ----------
    // Une ligne par demande de mise en route validée reçue (n° OMR, date, objet, code FD, dates, personnes, échéance du
    // compte-rendu = fin de mission + 30 jours) ; le compte-rendu reçu s'y rattache (même n° OMR ou même demande) avec ses
    // montants. Gardé sur l'appareil (et dans la sauvegarde chiffrée du compte), dans l'ordre des n° OMR.
    var CLE_REGISTRE = 'trigone_registre_omr';
    function registreLire() { var l = lireJSON(CLE_REGISTRE); return Array.isArray(l) ? l : []; }
    function registreEcrire(l) { ecrireTxt(CLE_REGISTRE, JSON.stringify(l)); try { window.dispatchEvent(new Event('trigone-registre')); } catch (e) {} }
    // Partage entre les assistants Chorus DT de l'unité : chaque ligne nouvelle ou modifiée (et chaque suppression) part
    // au serveur, qui renvoie ce que les autres assistants ont changé. Sans réseau, la file attend la prochaine relève.
    var CLE_REG_FILE = 'trigone_registre_a_envoyer', CLE_REG_DEPUIS = 'trigone_registre_depuis', CLE_REG_UNITE = 'trigone_registre_unite', registreSynchroEnCours = null;
    function registreFile() { var f = lireJSON(CLE_REG_FILE); return f && typeof f === 'object' && f.lignes ? f : { lignes: {}, supprimer: {} }; }
    function registreAEnvoyer(refs, supprimer) {
        var f = registreFile(), t = Date.now();
        refs.forEach(function(r) { f.lignes[r] = t; });
        if (supprimer) refs.forEach(function(r) { delete f.lignes[r]; f.supprimer[r] = t; });
        ecrireTxt(CLE_REG_FILE, JSON.stringify(f));
        setTimeout(function() { window.JUMELAGE_REGISTRE_SYNCHRO(); }, 300);
    }
    function registrePartage() { return !!monCompte() && !!rolesLocaux().chorus; }
    window.JUMELAGE_REGISTRE_SYNCHRO = function() {
        if (!registrePartage() || !navigator.onLine) return Promise.resolve(false);
        if (registreSynchroEnCours) return registreSynchroEnCours;
        // Unité du profil changée : le registre de l'appareil était celui de l'ancien régiment, on repart du registre
        // du nouveau (rien n'est envoyé de l'ancien).
        var uReg = normeUnite(lireReglages().unite) || '-', uAvant = lireTxt(CLE_REG_UNITE);
        if (uAvant && uAvant !== uReg) { registreEcrire([]); ecrireTxt(CLE_REG_FILE, ''); ecrireTxt(CLE_REG_DEPUIS, ''); }
        if (uAvant !== uReg) ecrireTxt(CLE_REG_UNITE, uReg);
        var f = registreFile(), l = registreLire(), premiere = !lireTxt(CLE_REG_DEPUIS);
        // Première fois : tout le registre de l'appareil rejoint le registre commun.
        if (premiere) l.forEach(function(y) { if (!f.lignes[y.ref]) f.lignes[y.ref] = 1; });
        var refs = Object.keys(f.lignes).slice(0, 200), suppr = Object.keys(f.supprimer).slice(0, 200);
        var lignes = refs.map(function(r) { return l.filter(function(y) { return y.ref === r; })[0]; }).filter(Boolean);
        registreSynchroEnCours = appelApi('registre', { methode: 'POST', corps: { lignes: lignes, supprimer: suppr, depuis: +lireTxt(CLE_REG_DEPUIS) || 0 } }).then(function(r) {
            // Retirés de la file seulement s'ils n'ont pas changé pendant l'envoi.
            var f2 = registreFile();
            refs.forEach(function(x) { if (f2.lignes[x] === f.lignes[x]) delete f2.lignes[x]; });
            suppr.forEach(function(x) { if (f2.supprimer[x] === f.supprimer[x]) delete f2.supprimer[x]; });
            ecrireTxt(CLE_REG_FILE, JSON.stringify(f2));
            var l2 = registreLire(), change = false;
            (r.lignes || []).forEach(function(x) {
                if (f2.lignes[x.ref] || f2.supprimer[x.ref]) return;   // modifiée ici entre-temps : la version de l'appareil partira ensuite
                var i = -1; l2.forEach(function(y, j) { if (y.ref === x.ref) i = j; });
                if (x.supprime) { if (i >= 0) { l2.splice(i, 1); change = true; } return; }
                if (!x.ligne) return;
                if (i >= 0) { if (JSON.stringify(l2[i]) !== JSON.stringify(x.ligne)) { l2[i] = x.ligne; change = true; } }
                else { l2.push(x.ligne); change = true; }
            });
            if (change) registreEcrire(l2);
            ecrireTxt(CLE_REG_DEPUIS, String(r.dernier || 1));
            registreSynchroEnCours = null;
            if (Object.keys(f2.lignes).length || Object.keys(f2.supprimer).length) { if (refs.length + suppr.length >= 200) return window.JUMELAGE_REGISTRE_SYNCHRO(); }
            return true;
        }, function() { registreSynchroEnCours = null; return false; });
        return registreSynchroEnCours;
    };
    function registreNouvel(el) {
        var l = registreLire(), modifs = [], qui = window.JUMELAGE_QUI() || (monCompte() || {}).mail || '';
        if (el.nature === 'chorus' && el.registre) {
            el.registre.forEach(function(x) {
                if (!x.ref || l.some(function(y) { return y.ref === x.ref; })) return;
                l.push(Object.assign({ recuLe: el.le || Date.now(), envoiId: el.id, recuPar: qui }, x)); modifs.push(x.ref);
            });
        }
        if (el.nature === 'cr') {
            var cr = { recuLe: el.le || Date.now(), envoiId: el.id, de: el.de || '', noms: el.noms || '', objet: el.objet || '', dates: el.dates || '', montants: el.montants || null, recuPar: qui };
            var ligne = l.filter(function(y) { return (el.omr && y.omr === el.omr) || (el.mref && y.ref === el.mref); })[0];
            if (ligne) { ligne.crs = (ligne.crs || []).filter(function(c) { return c.envoiId !== el.id; }).concat([cr]); modifs.push(ligne.ref); }
            else { l.push({ ref: 'cr-' + el.id, omr: el.omr || '', mref: el.mref || '', sansDemande: true, objet: el.objet || '', crs: [cr], recuLe: el.le || Date.now() }); modifs.push('cr-' + el.id); }
        }
        if (!modifs.length) return;
        registreEcrire(l); registreAEnvoyer(modifs);
        // Demande arrivée sans n° OMR (envoyée sans réseau, ou d'avant le registre) : l'assistant lui en donne un.
        l.filter(function(y) { return !y.omr && !y.sansDemande; }).reduce(function(suite, y) {
            return suite.then(function() {
                return window.JUMELAGE_OMR_TIRER().then(function(r) {
                    var l2 = registreLire(); l2.forEach(function(z) { if (z.ref === y.ref && !z.omr) { z.omr = r.numero; z.omrLe = r.le; z.omrChorus = true; } }); registreEcrire(l2);
                    registreAEnvoyer([y.ref]);
                }, function() {});
            });
        }, Promise.resolve());
    }
    window.JUMELAGE_REGISTRE = function() { return registreLire(); };
    // Heures réelles d'une mission (Compte-rendu : départ, arrivée sur site, départ du site, retour) envoyées au registre
    // des assistants Chorus DT. Sans réseau ou demande pas encore au registre : gardées et renvoyées au prochain relevé.
    var CLE_JALONS = 'trigone_jalons_file', jalonsEnCours = null;
    window.JUMELAGE_JALONS = function(omr, mref, jalons) {
        if (omr || mref) { var f = lireJSON(CLE_JALONS) || {}; f[omr || mref] = { omr: omr || '', mref: mref || '', jalons: jalons || {}, le: Date.now() }; ecrireTxt(CLE_JALONS, JSON.stringify(f)); }
        if (!monCompte() || !navigator.onLine) return Promise.resolve(false);
        if (jalonsEnCours) return jalonsEnCours.then(function() { return window.JUMELAGE_JALONS(); });
        var f0 = lireJSON(CLE_JALONS) || {}, cles = Object.keys(f0);
        jalonsEnCours = cles.reduce(function(suite, k) {
            return suite.then(function() {
                var x = f0[k];
                return appelApi('registre/jalons', { methode: 'POST', corps: { omr: x.omr, mref: x.mref, jalons: x.jalons } }).then(function(r) {
                    // Envoyé (ou mission plus au registre depuis 60 jours) : retiré de la file, s'il n'a pas changé entre-temps.
                    if (r.ok || Date.now() - x.le > 60 * 86400000) { var f = lireJSON(CLE_JALONS) || {}; if (f[k] && f[k].le === x.le) { delete f[k]; ecrireTxt(CLE_JALONS, JSON.stringify(f)); } }
                }, function(e) {
                    if (e && e.statut === 403) { var f = lireJSON(CLE_JALONS) || {}; delete f[k]; ecrireTxt(CLE_JALONS, JSON.stringify(f)); }
                });
            });
        }, Promise.resolve()).then(function() { jalonsEnCours = null; return true; });
        return jalonsEnCours;
    };
    window.JUMELAGE_REGISTRE_MAJ = function(ref, maj) {
        var l = registreLire();
        if (maj === null) l = l.filter(function(y) { return y.ref !== ref; });
        else l.forEach(function(y) { if (y.ref === ref) Object.assign(y, maj); });
        registreEcrire(l); registreAEnvoyer([ref], maj === null);
    };
    // filtre : 'chorus' (envois pour l'assistant Chorus DT), 'autres' (tout le reste), sinon tout.
    window.JUMELAGE_BOITE_NB = function(filtre) {
        // Nombre de demandes (un envoi peut en contenir plusieurs), pas d'envois.
        return boiteLire().filter(function(x) { var c = x.nature === 'chorus' || x.nature === 'cr'; return x.statut !== 'traite' && (filtre === 'chorus' ? c : filtre === 'autres' ? !c : true); })
            .reduce(function(t, x) { return t + (x.n > 1 ? x.n : 1); }, 0);
    };
    // ---------- Justificatifs reçus par mail ----------
    // Mon adresse prénom.nom@trigone-app.com (créée avec Mon profil ; suit un changement de nom).
    var CLE_ADRESSE = 'trigone_adresse';
    window.JUMELAGE_ADRESSE = function(forcer) {
        var c = monCompte(), r = lireReglages(), memo = lireJSON(CLE_ADRESSE) || {}, sig = c ? c.mail + '|' + (r.prenom || '') + '|' + (r.nom || '') : '';
        if (!c) return Promise.resolve('');
        if (memo.sig === sig && memo.adresse && !forcer) return Promise.resolve(memo.adresse);
        if (!navigator.onLine || !(r.nom || r.prenom)) return Promise.resolve(memo.mail === c.mail ? memo.adresse || '' : '');
        return appelApi('adresse', { methode: 'POST', corps: { prenom: r.prenom || '', nom: r.nom || '' } }).then(function(x) {
            ecrireTxt(CLE_ADRESSE, JSON.stringify({ sig: sig, mail: c.mail, adresse: x.adresse || '' })); return x.adresse || '';
        }, function() { return memo.mail === c.mail ? memo.adresse || '' : ''; });
    };
    window.JUMELAGE_ADRESSE_CONNUE = function() { var c = monCompte(), m = lireJSON(CLE_ADRESSE) || {}; return c && m.mail === c.mail ? m.adresse || '' : ''; };
    window.JUMELAGE_COPIER_ADRESSE = function(btn) {
        var a = window.JUMELAGE_ADRESSE_CONNUE(); if (!a) return;
        var fini = function() { bandeau('Adresse copiée : ' + a); if (btn) { var t = btn.textContent; btn.textContent = '✔ Copiée'; setTimeout(function() { btn.textContent = t; }, 1600); } };
        try { navigator.clipboard.writeText(a).then(fini, function() { prompt('Votre adresse TRIGONE :', a); }); } catch (e) { prompt('Votre adresse TRIGONE :', a); }
    };
    // Fichiers des justificatifs reçus (tous, ou ceux d'un envoi) : [{ id, i, nom, type, de, sujet, le, verifie }].
    function lireJustif(id) {
        return caches.open(CACHE_BOITE).then(function(c) { return c.match(cleFichierBoite(id)); }).then(function(r) { return r ? r.text() : null; })
            .then(function(t) { try { return JSON.parse(t); } catch (e) { return null; } });
    }
    window.JUMELAGE_JUSTIFICATIFS = function() {
        return boiteLire().filter(function(x) { return x.nature === 'justif'; }).map(function(x) {
            return (x.fichiers || []).map(function(f, i) { return { id: x.id, i: i, nom: f.nom, type: f.type, de: x.noms, sujet: x.objet, le: x.le, verifie: x.verifie, statut: x.statut }; });
        }).reduce(function(a, b) { return a.concat(b); }, []);
    };
    window.JUMELAGE_JUSTIF_FICHIER = function(id, i) {
        return lireJustif(id).then(function(d) {
            var f = d && (d.fichiers || [])[i]; if (!f) throw new Error('Justificatif introuvable sur cet appareil.');
            var o = depuisB64(f.b64);
            return new File([o], f.nom || 'justificatif', { type: f.type || 'application/octet-stream' });
        });
    };
    window.JUMELAGE_JUSTIF_VERIFIE = function(id) { var l = boiteLire(); l.forEach(function(x) { if (x.id === id) x.verifie = true; }); boiteEcrire(l); };
    window.JUMELAGE_BOITE_FICHIER = function(id) {
        var x = boiteLire().filter(function(e) { return e.id === id; })[0];
        return caches.open(CACHE_BOITE).then(function(c) {
            // Adresse commune aux deux applis ; à défaut, celle d'une relève faite depuis Compte-rendu (avant la V78).
            return c.match(cleFichierBoite(id)).then(function(r) { return r || c.match(cleFichierBoite(id, true)); });
        }).then(function(r) {
            if (!r) throw new Error('Fichier introuvable sur cet appareil.');
            return r.blob();
        }).then(function(b) { return new File([b], (x && x.nom) || 'demande.json', { type: 'application/json' }); });
    };
    // ---- État des envois commun à mes appareils (traité sur le PC → traité aussi sur le téléphone) ----
    // File des changements à envoyer, et états connus du serveur (appliqués aussi aux envois relevés plus tard).
    var CLE_ETATS_FILE = 'trigone_boite_etats_file', CLE_ETATS_CONNUS = 'trigone_boite_etats', CLE_ETATS_DEPUIS = 'trigone_boite_etats_depuis', etatsEnCours = null;
    function etatPartager(id, statut) {
        var f = lireJSON(CLE_ETATS_FILE) || {}; f[id] = { statut: statut, le: Date.now() };
        ecrireTxt(CLE_ETATS_FILE, JSON.stringify(f));
        var k = lireJSON(CLE_ETATS_CONNUS) || {}; k[id] = f[id]; ecrireTxt(CLE_ETATS_CONNUS, JSON.stringify(k));
        setTimeout(function() { window.JUMELAGE_BOITE_ETATS(); }, 0);
    }
    // Applique les états connus aux envois de cet appareil. Renvoie vrai si la boîte a changé.
    function etatsAppliquer() {
        var k = lireJSON(CLE_ETATS_CONNUS) || {}, l = boiteLire(), change = false, traites = [], suppr = [];
        l = l.filter(function(x) {
            var e = k[x.id]; if (!e) return true;
            if (e.statut === 'supprime') { suppr.push(x.id); change = true; return false; }
            if (e.statut === 'traite' && x.statut !== 'traite') { x.statut = 'traite'; x.traiteLe = e.le; traites.push(x); change = true; }
            else if (e.statut === 'ouvert' && x.statut === 'traite' && (x.traiteLe || 0) < e.le) { x.statut = 'ouvert'; delete x.traiteLe; change = true; }
            return true;
        });
        if (!change) return false;
        boiteEcrire(l);
        if (suppr.length) caches.open(CACHE_BOITE).then(function(c) { suppr.forEach(function(id) { c.delete(cleFichierBoite(id)); c.delete(cleFichierBoite(id, true)); }); }).catch(function() {});
        // L'appli retire de l'Espace valideur les demandes déjà signées sur un autre appareil.
        if (traites.length) try { window.dispatchEvent(new CustomEvent('trigone-traite-ailleurs', { detail: traites.map(function(x) { return { ids: x.ids || [], nature: x.nature }; }) })); } catch (e) {}
        return true;
    }
    window.JUMELAGE_BOITE_ETATS = function() {
        if (!monCompte() || !navigator.onLine) { etatsAppliquer(); return Promise.resolve(false); }
        if (etatsEnCours) return etatsEnCours;
        var f = lireJSON(CLE_ETATS_FILE) || {}, ids = Object.keys(f).slice(0, 200);
        etatsEnCours = appelApi('boite/etats', { methode: 'POST', corps: { etats: ids.map(function(id) { return { id: id, statut: f[id].statut, le: f[id].le }; }), depuis: +lireTxt(CLE_ETATS_DEPUIS) || 0 } }).then(function(r) {
            var f2 = lireJSON(CLE_ETATS_FILE) || {};
            ids.forEach(function(id) { if (f2[id] && f2[id].le === f[id].le) delete f2[id]; });
            ecrireTxt(CLE_ETATS_FILE, JSON.stringify(f2));
            var k = lireJSON(CLE_ETATS_CONNUS) || {}, vieux = Date.now() - 120 * 86400000;
            (r.etats || []).forEach(function(e) { if (!k[e.id] || k[e.id].le <= e.le) k[e.id] = { statut: e.statut, le: e.le }; });
            Object.keys(k).forEach(function(id) { if (k[id].le < vieux) delete k[id]; });
            ecrireTxt(CLE_ETATS_CONNUS, JSON.stringify(k));
            // Envois au groupe : qui l'a traité (« Traitée par ADJ DUPONT »).
            if ((r.groupes || []).length) {
                var lg = boiteLire(), chg = false;
                r.groupes.forEach(function(g) { lg.forEach(function(x) { if (x.id === g.id && x.traitePar !== (g.moi ? 'vous' : g.qui)) { x.traitePar = g.moi ? 'vous' : g.qui; chg = true; } }); });
                if (chg) boiteEcrire(lg);
            }
            ecrireTxt(CLE_ETATS_DEPUIS, String(Math.max(0, (r.maintenant || 0) - 2000)));   // léger recouvrement : rien n'est manqué
            etatsEnCours = null;
            return etatsAppliquer();
        }, function() { etatsEnCours = null; return etatsAppliquer(); });
        return etatsEnCours;
    };
    // Envoi rangé dans « Traités » sur cet appareil : l'appli affiche où il est parti (message en bas de l'écran).
    function signalerRange(items) { if (items.length) try { window.dispatchEvent(new CustomEvent('trigone-range', { detail: { items: items } })); } catch (e) {} }
    window.JUMELAGE_BOITE_MARQUER = function(id, statut) {
        var l = boiteLire(), cr = false, traite = false, ranges = [];
        l.forEach(function(x) { if (x.id === id && x.statut !== 'traite') { x.statut = statut; if (statut === 'traite') { traite = true; x.traiteLe = Date.now(); ranges.push(x); if (x.nature === 'cr') cr = true; } } });
        boiteEcrire(l);
        signalerRange(ranges);
        if (traite) etatPartager(id, 'traite');
        // Compte-rendu traité par l'assistant Chorus DT : le missionnaire est prévenu.
        if (cr) suiviTraite({ envois: [id] });
    };
    function suiviTraite(corps) {
        if (!monCompte()) return;
        corps.qui = window.JUMELAGE_QUI();
        // Puis la frise de cet appareil se relit tout de suite (sinon elle restait « chez l'assistant Chorus DT » ici).
        appelApi('suivi/traite', { methode: 'POST', corps: corps }).then(function() { return window.JUMELAGE_SUIVI_ACTUALISER(); }).catch(function() {});
    }
    // Demandes traitées (validées / refusées puis transmises, PDF Chorus produit) : les envois qui les contiennent passent en « traité ».
    // natures : seulement les envois de ces natures (ex. ['niveau1', 'renvoi'] après une transmission du VALIDEUR 1) ;
    // une même demande peut déjà être revenue à un autre niveau (même personne VALIDEUR 1 et VALIDEUR 2).
    window.JUMELAGE_BOITE_TRAITER_DEMANDES = function(ids, natures) {
        if (!ids || !ids.length) return;
        // Demandes traitées par l'assistant Chorus DT (PDF produit) : le demandeur est prévenu.
        if (natures && natures.indexOf('chorus') >= 0) {
            // Frise de cet appareil à jour tout de suite (étape « traitée »), sans attendre le serveur ni le réseau.
            var su = lireJSON(CLE_SUIVI) || {}, qui = window.JUMELAGE_QUI(), maj = false;
            ids.forEach(function(r) { if (su[r] && su[r].etape !== 'traite') { su[r].etape = 'traite'; su[r].le = Date.now(); (su[r].etapes = su[r].etapes || []).push({ e: 'traite', le: Date.now(), qui: qui }); maj = true; } });
            if (maj) { ecrireTxt(CLE_SUIVI, JSON.stringify(su)); try { window.dispatchEvent(new Event('trigone-suivi')); } catch (e) {} }
            suiviTraite({ refs: ids });
        }
        var l = boiteLire(), change = false, partages = [], ranges = [];
        l.forEach(function(x) {
            if (natures && natures.indexOf(x.nature) < 0) return;
            if (x.statut !== 'traite' && (x.ids || []).length && x.ids.every(function(i) { return ids.indexOf(i) >= 0; })) { x.statut = 'traite'; x.traiteLe = Date.now(); change = true; ranges.push(x); partages.push(x.id); }
        });
        if (change) boiteEcrire(l);
        partages.forEach(function(id) { etatPartager(id, 'traite'); });
        signalerRange(ranges);
    };
    // Assistant Chorus DT : PDF final téléchargé, l'envoi attend son « ✔ Traité » (l'ordre de mission créé dans Chorus DT).
    window.JUMELAGE_BOITE_PDF_FAIT = function(id) {
        var l = boiteLire(); l.forEach(function(x) { if (x.id === id && x.statut !== 'traite') { x.statut = 'ouvert'; x.pdfFait = Date.now(); } }); boiteEcrire(l);
    };
    // Envoi classé « traité » trop tôt : il repasse « à traiter ».
    window.JUMELAGE_BOITE_ROUVRIR = function(id) {
        var l = boiteLire(); l.forEach(function(x) { if (x.id === id) { x.statut = 'ouvert'; delete x.traiteLe; } }); boiteEcrire(l);
        etatPartager(id, 'ouvert');
    };
    window.JUMELAGE_BOITE_SUPPRIMER = function(id) {
        boiteEcrire(boiteLire().filter(function(x) { return x.id !== id; }));
        etatPartager(id, 'supprime');
        return caches.open(CACHE_BOITE).then(function(c) { return Promise.all([c.delete(cleFichierBoite(id)), c.delete(cleFichierBoite(id, true))]); }).catch(function() {});
    };
    // Pastille sur l'écran de choix (côté Mise en route) : envois reçus pas encore traités.
    function majPastilleHub() {
        if (!ecran) return;
        var bloc = ecran.querySelector('.JUM-PAN-MER .JUM-BLOC'); if (!bloc) return;
        var n = window.JUMELAGE_BOITE_NB(roleChorus() ? 'autres' : ''), p = bloc.querySelector('.JUM-BOITE-PASTILLE');
        if (!n) { if (p) p.remove(); } else {
            if (!p) { p = document.createElement('span'); p.className = 'JUM-BOITE-PASTILLE'; bloc.appendChild(p); }
            p.textContent = '📥 ' + n + (n > 1 ? ' demandes reçues' : ' demande reçue');
        }
        majEtatsHub();
        var med = ecran.querySelector('.JUM-CHORUS'); if (!med) return;
        var nc = window.JUMELAGE_BOITE_NB('chorus'), pc = ecran.querySelector('.JUM-CHORUS-NB');
        if (!nc) { if (pc) pc.remove(); return; }
        if (!pc) { pc = document.createElement('span'); pc.className = 'JUM-CHORUS-NB'; med.parentNode.appendChild(pc); }
        pc.textContent = nc;
    }

    // Relève : nouveaux envois du serveur → boîte de réception de l'appareil.
    // Une relève demandée pendant une autre (notification arrivée en cours de relève) est refaite juste après, pas oubliée.
    var releveEnCours = null, releveARefaire = false;
    window.JUMELAGE_RELEVER = function() {
        if (!monCompte() || !navigator.onLine || !SUBTLE || !window.caches) return Promise.resolve(0);
        if (releveEnCours) { releveARefaire = true; return releveEnCours; }
        releveEnCours = releverUneFois().then(function(n) {
            releveEnCours = null;
            window.JUMELAGE_REGISTRE_SYNCHRO();   // registre OMR commun aux assistants Chorus DT
            window.JUMELAGE_BOITE_ETATS();        // envois déjà traités sur un autre de mes appareils
            if (lireTxt(CLE_JALONS).length > 2) window.JUMELAGE_JALONS();   // heures de mission en attente d'envoi
            window.JUMELAGE_PHOTO_SYNCHRO();       // photo de carte partagée : rechiffrée si de nouveaux appareils y ont droit
            window.JUMELAGE_ADRESSE();             // adresse des justificatifs (créée une fois, suit Mon profil)
            window.JUMELAGE_SUIVI_ACTUALISER();    // suivi des demandes et comptes-rendus : la frise bouge en direct
            if (releveARefaire) { releveARefaire = false; return window.JUMELAGE_RELEVER().then(function(m) { return n + m; }); }
            return n;
        });
        return releveEnCours;
    };
    function releverUneFois() {
        var nouveaux = [], ecartes = 0;
        return appelApi('boite').then(function(r) {
            return r.envois.reduce(function(suite, e) {
                return suite.then(function() {
                    if (boiteLire().some(function(x) { return x.id === e.id; })) return appelApi('boite/' + e.id, { methode: 'DELETE' });
                    return appelApi('boite/' + e.id).then(function(x) {
                        return dechiffrer(x.enveloppe, x.donnees).then(function(clair) {
                            var o = JSON.parse(clair), info = resumeEnvoi(o.contenu);
                            // Contenu conforme au type annoncé (demande → non signée, 1er valideur → 1 signature,
                            // Chorus → 2 signatures, refus → refus, CR → compte-rendu) ; sinon l'envoi est écarté.
                            var attendu = { DEMANDE: 'niveau1', VALIDATION_1: 'niveau2', CHORUS: 'chorus', REFUS: 'refus', CR: 'cr', RENVOI: 'renvoi', COLLECTIVE: 'collective', QUESTION: 'question', REPONSE: 'reponse', JUSTIF: 'justif' }[x.type];
                            if (attendu && info.nature !== attendu) { ecartes++; return appelApi('boite/' + e.id, { methode: 'DELETE' }); }
                            return caches.open(CACHE_BOITE).then(function(c) {
                                return c.put(cleFichierBoite(e.id), new Response(o.contenu, { headers: { 'Content-Type': 'application/json' } }));
                            }).then(function() {
                                var el = Object.assign({ id: e.id, nom: o.nom || 'demande.json', de: x.de, le: x.le, type: x.type, statut: 'nouveau' }, info);
                                if (e.groupe) el.groupe = e.groupe;   // envoi au groupe (tous les assistants Chorus DT / VALIDEUR 2 de l'unité)
                                var l = boiteLire(); l.unshift(el); boiteEcrire(l); nouveaux.push(el);
                                registreNouvel(el);
                                return appelApi('boite/' + e.id, { methode: 'DELETE' });
                            });
                        });
                    }).catch(function() {});
                });
            }, Promise.resolve());
        }).catch(function(e) {
            if (e.statut === 401) { try { localStorage.removeItem(CLE_COMPTE); localStorage.removeItem(CLE_NID_PUBLIE); } catch (x) {} }
        }).then(function() {
            // Déjà traité sur un autre de mes appareils (PC ↔ téléphone) : rangé tout de suite, sans message de réception.
            return nouveaux.length ? window.JUMELAGE_BOITE_ETATS().catch(function() {}) : null;
        }).then(function() {
            var dejaTraites = boiteLire().filter(function(y) { return y.statut === 'traite'; }).map(function(y) { return y.id; });
            nouveaux = nouveaux.filter(function(x) { return dejaTraites.indexOf(x.id) < 0; });
            var nb = nouveaux.reduce(function(t, x) { return t + (x.n > 1 ? x.n : 1); }, 0);   // nombre de demandes reçues
            if (ecartes) bandeau(ecartes + ' envoi(s) non conforme(s) écarté(s) de votre boîte de réception.');
            if (nouveaux.length) {
                if (typeof window.JUMELAGE_APRES_RELEVE === 'function') { try { window.JUMELAGE_APRES_RELEVE(nouveaux); } catch (e) {} }
                else if (roleChorus() && nouveaux.every(function(x) { return x.nature === 'chorus' || x.nature === 'cr'; })) bandeau((nb > 1 ? nb + ' envois reçus' : 'Envoi reçu') + ' : ouvrez l\'espace Assistant Chorus DT (écran de choix).');
                else if (nouveaux.every(function(x) { return x.nature === 'collective'; })) bandeau('Mission collective : votre compte-rendu prérempli est arrivé. Ouvrez Mise en route › Boîte de réception.');
                else bandeau(nb > 1 ? nb + ' demandes reçues : ouvrez Mise en route › Boîte de réception.' : 'Demande reçue : ouvrez Mise en route › Boîte de réception.');
            }
            return nouveaux.length;
        });
    };
    // Relève automatique : à l'ouverture, au retour dans l'appli, puis toutes les 20 secondes tant qu'elle est affichée
    // (et aussitôt qu'une notification arrive, appli ouverte).
    function releveAuto() { if (document.visibilityState === 'visible' && !document.body.classList.contains('demo-active')) window.JUMELAGE_RELEVER(); }
    if (monCompte()) {
        var lancerReleve = function() { setTimeout(releveAuto, 1500); majPastilleHub(); setTimeout(declarerRoles, 2500); setTimeout(suivreNotif, 3500); setTimeout(window.JUMELAGE_SUIVI_ACTUALISER, 3000); };
        if (document.body) lancerReleve(); else document.addEventListener('DOMContentLoaded', lancerReleve);
    }
    // Juste après une liaison : bienvenue sur ce nouvel appareil.
    try {
        if (sessionStorage.getItem('trigone_apres_liaison') === '1') {
            sessionStorage.removeItem('trigone_apres_liaison');
            var rl = lireJSON(CLE_ROLES_LOCAUX) || {};
            setTimeout(function() { annoncer('Appareil relié', 'Cet appareil est relié à votre compte TRIGONE : identité, mails, rôles, code d\'accès, demandes et bibliothèque ont été recopiés.' +
                (rl.valideur1 || rl.valideur2 ? ' Votre code VALIDEUR vous sera redemandé une fois, à la première signature sur cet appareil.' : '') +
                ' Pensez à activer les notifications ici aussi (bouton de compte en haut à droite › Notifications).', 'ok', 'ok'); }, 2500);
        }
    } catch (e) {}
    document.addEventListener('visibilitychange', function() { if (monCompte()) { releveAuto(); if (document.visibilityState === 'visible') window.JUMELAGE_SUIVI_ACTUALISER(); } });
    setInterval(function() { if (monCompte()) releveAuto(); }, 20000);

    // Fenêtre « Compte TRIGONE » : activer (mail pro → code reçu), état, déconnexion de l'appareil.
    var fenCompte = null;
    window.JUMELAGE_FERMER_COMPTE = function() { if (fenCompte) { fenCompte.remove(); fenCompte = null; } }; fermeurs.push([function() { return fenCompte; }, window.JUMELAGE_FERMER_COMPTE]);
    window.JUMELAGE_COMPTE = function(opts) {
        opts = opts || {};
        if (fenCompte || !document.body) return;
        // Pas encore connecté : la fenêtre « Se connecter » (première connexion, ou code de liaison).
        if (!monCompte()) { window.JUMELAGE_CONNEXION(opts); return; }
        var c = monCompte(), r = lireReglages();
        fenCompte = document.createElement('div');
        fenCompte.className = 'JUM-REGLAGES';
        fenCompte.setAttribute('role', 'dialog');
        var tete = '<div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('mail') : '') + '</span><div><h2>Compte TRIGONE</h2>' +
            '<p>Pour envoyer et recevoir demandes et comptes-rendus directement dans TRIGONE. Tout est chiffré : seul le destinataire peut les lire.</p></div>' +
            '<button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_COMPTE()">✕</button></div>';
        if (c) {
            fenCompte.innerHTML = '<div class="JUM-R-CARTE">' + tete + '<div class="JUM-R-CORPS">' +
                '<p class="JUM-R-AIDE" style="margin-top:14px;">✓ <b>Compte actif : ' + esc(c.mail) + '</b><br>Cet appareil reçoit les demandes qui vous sont envoyées ; elles arrivent à l\'ouverture de Mise en route.</p>' +
                '<p class="JUM-R-AIDE">Sur un autre appareil (PC, téléphone), activez aussi votre compte avec la même adresse : chacun recevra les envois.</p>' +
                blocNotif() +
                '<div class="JUM-R-TITRE">Autres appareils</div>' +
                '<p class="JUM-R-AIDE">Installer TRIGONE sur votre PC ou votre téléphone sans tout refaire : touchez le bouton, puis saisissez le code sur l\'autre appareil (à sa première ouverture, ou dans son Compte TRIGONE).</p>' +
                '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-C-LIAISON" style="margin:4px 0 0; width:100%;">📲 Ajouter un autre appareil</button><div id="JUM-C-LIAISON-ZONE"></div>' +
                '<button type="button" class="JUM-R-LIEN" id="JUM-C-DECO">Se déconnecter (garder les données)</button>' +
                '<button type="button" class="JUM-R-LIEN" id="JUM-C-EFFACER" style="color:#b91c1c;">Me déconnecter et effacer cet appareil</button><p class="JUM-R-ERREUR" id="JUM-C-ERR"></p></div>' +
                '<div class="JUM-R-PIED"><button type="button" class="JUM-R-PRINCIPAL" onclick="JUMELAGE_FERMER_COMPTE()">Fermer</button></div></div>';
            document.body.appendChild(fenCompte);
            // Test : une vraie notification vers chacun de mes appareils ; la réponse du service est affichée pour chacun.
            var btnMuet = fenCompte.querySelector('#JUM-C-MUET');
            if (btnMuet) { majCloches(); btnMuet.addEventListener('click', function() { window.JUMELAGE_NOTIF_MUET(); }); }
            var btnTest = fenCompte.querySelector('#JUM-C-TEST');
            if (btnTest) btnTest.addEventListener('click', function() {
                var zone = fenCompte.querySelector('#JUM-C-TEST-RES');
                btnTest.disabled = true; btnTest.textContent = 'Envoi du test…';
                abonnerNotif().catch(function() {}).then(function() { return appelApi('push/test', { methode: 'POST' }); }).then(function(r) {
                    zone.innerHTML = '<p class="JUM-R-AIDE" style="margin-top:10px;">' + r.resultats.map(function(x) {
                        var ok = x.statut >= 200 && x.statut < 300;
                        return (ok ? '✔ ' : '✖ ') + '<b>' + esc(x.nom || 'Appareil') + '</b>' + (x.ceci ? ' (cet appareil)' : '') + ' : ' +
                            (ok ? 'notification envoyée — elle doit apparaître dans quelques secondes.' : x.statut === 0 ? 'pas abonné : ouvrez TRIGONE sur cet appareil et activez les notifications.'
                                : 'refusée par le service (' + x.statut + (x.service ? ', ' + esc(x.service) : '') + ') ' + esc(x.detail || ''));
                    }).join('<br>') + '</p>';
                }).catch(function(e) { zone.innerHTML = '<p class="JUM-R-ERREUR">⛔ ' + esc(e.message || e) + '</p>'; })
                  .then(function() { btnTest.disabled = false; btnTest.textContent = '🔔 Tester les notifications'; });
            });
            var btnNotif = fenCompte.querySelector('#JUM-C-NOTIF');
            if (btnNotif) btnNotif.addEventListener('click', function() {
                var err = fenCompte.querySelector('#JUM-C-ERR');
                btnNotif.disabled = true; btnNotif.textContent = 'Activation…'; err.textContent = '';
                window.JUMELAGE_ACTIVER_NOTIF().then(function() {
                    window.JUMELAGE_FERMER_COMPTE(); bandeau('🔔 Notifications activées : vous serez prévenu de chaque envoi.');
                }, function(e) { btnNotif.disabled = false; btnNotif.textContent = '🔔 Activer les notifications'; err.textContent = '⛔ ' + (e.message || e); });
            });
            // Code de liaison : affiché en grand, avec le temps restant ; un nouveau appui en tire un autre.
            var minuteur = null;
            fenCompte.querySelector('#JUM-C-LIAISON').addEventListener('click', function() {
                var b = this, zone = fenCompte.querySelector('#JUM-C-LIAISON-ZONE');
                b.disabled = true; zone.innerHTML = '<p class="JUM-R-AIDE" style="margin-top:8px;">Préparation du code (copie chiffrée de vos données)…</p>';
                if (minuteur) clearInterval(minuteur);
                window.JUMELAGE_LIAISON_CREER().then(function(l) {
                    zone.innerHTML = '<div class="JUM-LIAISON-CODE">' + l.code + '</div><div class="JUM-LIAISON-TEMPS" id="JUM-C-LIAISON-T"></div>' +
                        '<p class="JUM-R-AIDE">Sur l\'autre appareil, ouvrez TRIGONE : bouton « Se connecter » en haut à droite › « J\'ai déjà TRIGONE sur un autre appareil ». Code à usage unique : ne le communiquez à personne.' +
                        (l.sansPieces ? ' <b>Pièces jointes trop lourdes : elles restent sur cet appareil</b> (le reste est copié).' : '') + '</p>';
                    var t = fenCompte.querySelector('#JUM-C-LIAISON-T');
                    var maj = function() {
                        var s = Math.max(0, Math.round((l.expire - Date.now()) / 1000));
                        if (!document.body.contains(t)) { clearInterval(minuteur); return; }
                        t.textContent = s ? 'Valable encore ' + Math.floor(s / 60) + ' min ' + ('0' + s % 60).slice(-2) + ' s · une seule fois' : 'Code expiré : touchez à nouveau « Ajouter un autre appareil ».';
                        if (!s) { clearInterval(minuteur); fenCompte.querySelector('.JUM-LIAISON-CODE').style.opacity = '0.3'; }
                    };
                    maj(); minuteur = setInterval(maj, 1000);
                }).catch(function(e) { zone.innerHTML = '<p class="JUM-R-ERREUR">⛔ ' + esc(e.message) + '</p>'; }).then(function() { b.disabled = false; });
            });
            // Déconnexion complète : le compte quitte l'appareil et toutes les données TRIGONE en sont effacées.
            fenCompte.querySelector('#JUM-C-EFFACER').addEventListener('click', deconnecterEtEffacer);
            fenCompte.querySelector('#JUM-C-DECO').addEventListener('click', deconnecter);
            if (opts.liaison) fenCompte.querySelector('#JUM-C-LIAISON').click();
            return;
        }
    };
    // Fenêtre « Se connecter » (bouton de compte en haut à droite) : première connexion (mail professionnel → code
    // reçu par mail), ou « J'ai déjà TRIGONE sur un autre appareil » (code de liaison, rien à ressaisir).
    // opts.premiere : proposée à la première ouverture, refermable (« Plus tard »).
    var CLE_CONNEXION_PROPOSEE = 'trigone_connexion_proposee', profilApresConnexion = false;
    window.JUMELAGE_CONNEXION = function(opts) {
        opts = opts || {};
        if (fenCompte || !document.body) return;
        if (monCompte()) { window.JUMELAGE_COMPTE(opts); return; }
        var r = lireReglages();
        fenCompte = document.createElement('div');
        fenCompte.className = 'JUM-REGLAGES JUM-CONNEXION';
        fenCompte.setAttribute('role', 'dialog');
        var fermer = function() {
            window.JUMELAGE_FERMER_COMPTE();
            if (opts.apres) opts.apres();
            else if (opts.premiere && window.JUMELAGE_APRES_REGLAGES) try { window.JUMELAGE_APRES_REGLAGES(); } catch (e) {}
        };
        // Accueil façon appli : téléphone, un écran d'accueil (Créer mon compte / Se connecter / autre appareil) puis le
        // formulaire ; PC, écran partagé (TRIGONE à gauche, formulaire à droite). Créer un compte ou se connecter, c'est le
        // même parcours (mail professionnel → code à 6 chiffres) ; seuls les textes changent.
        var dossier = DANS_CR ? '../' : '';
        var SVG = function(d) { return '<svg viewBox="0 0 24 24">' + d + '</svg>'; };
        var pt = function(icone, titre, detail) { return '<div class="JUM-ACC-PT">' + SVG(icone) + '<div><b>' + titre + '</b><span>' + detail + '</span></div></div>'; };
        fenCompte.className = 'JUM-REGLAGES JUM-CONNEXION JUM-ACC';
        fenCompte.setAttribute('aria-label', 'Bienvenue dans TRIGONE');
        fenCompte.setAttribute('data-etape', opts.premiere ? 'accueil' : 'form');
        fenCompte.innerHTML = '<div class="JUM-ACC-PAGE">' +
            '<button type="button" class="JUM-ACC-FERMER" id="JUM-C-PLUSTARD">' + (opts.premiere ? 'Plus tard' : 'Fermer ✕') + '</button>' +
            '<div class="JUM-ACC-MARQUE"><div class="JUM-ACC-HALO"></div>' +
                '<div class="JUM-ACC-LOGO"><img src="' + dossier + 'phoenix-icon.png" alt=""><div class="JUM-ACC-MOT">TRIGONE</div></div>' +
                // Devise : trois outils (Mise en route, Compte-rendu, Assist Chorus DT), une seule direction.
                '<div class="JUM-ACC-DEVISE"><i class="JUM-ACC-DTRAIT"></i><div class="d1">3 OUTILS</div><i class="JUM-ACC-DPT"></i><div class="d2">UNE SEULE DIRECTION</div><i class="JUM-ACC-DPT"></i><div class="d3">LA MISSION</div></div>' +
                '<p class="JUM-ACC-TXT JUM-ACC-PREP">Nous allons préparer votre TRIGONE ensemble, étape par étape.<br>Comptez <b>3 minutes</b>.</p>' +
                '<div class="JUM-ACC-BOUTONS">' +
                    '<button type="button" class="JUM-ACC-BTN or" data-aller="creer">Créer mon compte</button>' +
                    '<button type="button" class="JUM-ACC-BTN ligne" data-aller="connecter">Se connecter</button>' +
                    '<button type="button" class="JUM-ACC-LIEN" data-aller="liaison">J\'ai déjà TRIGONE sur un autre appareil</button>' +
                    '<div class="JUM-ACC-NOTE">Sans adresse mail personnelle · aucun mot de passe</div>' +
                '</div>' +
                '<div class="JUM-ACC-BAS"><span>4<sup>e</sup> RIISC</span><span>Conçu par Germain-Pierre BOUQUET</span></div>' +
            '</div>' +
            '<div class="JUM-ACC-FORM">' +
                '<button type="button" class="JUM-ACC-RETOUR" aria-label="Retour">' + SVG('<path d="M15 18l-6-6 6-6"/>') + '</button>' +
                '<div class="JUM-ACC-TETE"><img src="' + dossier + 'phoenix-icon.png" alt=""><div>TRIGONE</div></div>' +
                '<div class="JUM-ACC-CARTE">' +
                '<div data-volet="mail">' +
                    (opts.premiere ? '<div class="JUM-ACC-PROG"><div class="JUM-PF-BARRES"><i class="fait"></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="JUM-PF-NUM">Étape 1 sur 7 · Mon compte</div></div>' : '') +
                    '<div class="JUM-ACC-ONGLETS" role="tablist"><button type="button" role="tab" class="actif" data-mode="creer">Créer mon compte</button><button type="button" role="tab" data-mode="connecter">Se connecter</button></div>' +
                    '<h2 id="JUM-C-TITRE">Bienvenue 👋</h2>' +
                    '<p class="JUM-ACC-AIDE" id="JUM-C-AIDE"></p>' +
                    // Créer mon compte : identité seule (pas d'adresse mail) ; un responsable de l'unité valide ensuite.
                    '<div id="JUM-C-IDENT">' +
                        '<div class="JUM-C-2"><div><label class="JUM-ACC-LBL" for="JUM-C-GRADE">Grade</label><div class="JUM-ACC-CHAMP"><input id="JUM-C-GRADE" type="text" autocomplete="off" value="' + esc(r.grade || '') + '" placeholder="EX : CAPORAL"></div></div>' +
                        '<div><label class="JUM-ACC-LBL" for="JUM-C-UNITE">Unité</label><div class="JUM-ACC-CHAMP"><input id="JUM-C-UNITE" type="text" autocomplete="off" value="' + esc(r.unite || '') + '" placeholder="EX : 4°RIISC"></div></div></div>' +
                        '<label class="JUM-ACC-LBL" for="JUM-C-NOM">Nom</label><div class="JUM-ACC-CHAMP"><input id="JUM-C-NOM" type="text" autocomplete="family-name" value="' + esc(r.nom || '') + '" placeholder="EX : ROUX"></div>' +
                        '<label class="JUM-ACC-LBL" for="JUM-C-PRENOM">Prénom</label><div class="JUM-ACC-CHAMP"><input id="JUM-C-PRENOM" type="text" autocomplete="given-name" data-no-uppercase="1" value="' + esc(r.prenom || '') + '" placeholder="EX : Emma"></div>' +
                        '<p class="JUM-C-APERCU" id="JUM-C-APERCU"></p>' +
                        '<button type="button" class="JUM-ACC-BTN noir" id="JUM-C-CREER">Créer mon compte</button>' +
                    '</div>' +
                    '<div id="JUM-C-SANSMAILBLOC" style="display:none;"><button type="button" class="JUM-ACC-BTN noir" data-aller="liaison">J\'ai un code de liaison ou de réactivation</button></div>' +
                    '<div id="JUM-C-MAILBLOC">' +
                    '<label class="JUM-ACC-LBL" for="JUM-C-MAIL">Adresse mail du compte</label>' +
                    '<div class="JUM-ACC-CHAMP">' + SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>') +
                        '<input id="JUM-C-MAIL" type="email" autocomplete="email" value="' + esc(r.monMail || '') + '" placeholder="prenom.nom@interieur.gouv.fr"></div>' +
                    '<button type="button" class="JUM-ACC-BTN noir" id="JUM-C-ENVOI">Recevoir le code par mail</button>' +
                    '<div class="JUM-ACC-ETAPE2" id="JUM-C-ETAPE2" style="display:none;">' +
                        '<label class="JUM-ACC-LBL" for="JUM-C-CODE">Code reçu par mail</label>' +
                        '<div class="JUM-ACC-CODE"><span></span><span></span><span></span><span></span><span></span><span></span>' +
                            '<input id="JUM-C-CODE" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="Code à 6 chiffres"></div>' +
                        '<div class="JUM-ACC-RENVOI-SLOT"></div>' +
                        '<button type="button" class="JUM-ACC-BTN noir" id="JUM-C-VALIDER" disabled>Valider</button>' +
                        '<p class="JUM-R-AIDE" style="margin:10px 0 0;">Pas reçu ? Regardez dans les courriers indésirables, ou renvoyez le code.</p></div>' +
                    '</div>' +
                    '<p class="JUM-R-ERREUR" id="JUM-C-ERR"></p>' +
                    '<div class="JUM-ACC-OU">ou</div>' +
                    '<button type="button" class="JUM-ACC-AUTRE" data-aller="liaison">' + SVG('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>') + 'J\'ai déjà TRIGONE sur un autre appareil</button>' +
                '</div>' +
                '<div data-volet="liaison" style="display:none;">' +
                    '<h2>Relier cet appareil</h2>' +
                    '<p class="JUM-ACC-AIDE">Sur l\'appareil où TRIGONE est déjà installé : bouton de compte <b>en haut à droite</b> › <b>« Ajouter un appareil »</b> (ou <b>Ma carte › QR de connexion</b>). Saisissez ici le code affiché, ou scannez le QR : identité, mails, rôles, code d\'accès, compte, demandes et bibliothèque sont recopiés. Pas de mail à attendre.</p>' +
                    htmlSaisieLiaison() +
                    '<button type="button" class="JUM-R-LIEN" data-aller="connecter" style="margin-top:10px;">← Avec mon adresse mail</button>' +
                '</div>' +
                '<div class="JUM-ACC-SECU">' + SVG('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>') + '<span>Vos demandes et comptes-rendus sont chiffrés sur votre appareil avant tout envoi.' +
                    (window.JUMELAGE_REGLAGES_FAITS() ? '' : ' Ensuite, TRIGONE vous demande une seule fois votre profil.') + '</span></div>' +
                '<button type="button" class="JUM-CX-SANS" id="JUM-C-SANS">Pas de réseau pour l\'instant ? Remplir mon profil sans compte</button>' +
                '</div>' +
            '</div></div>';
        document.body.appendChild(fenCompte);
        brancherSaisieLiaison(fenCompte, lireTxt('mer_config_faite') === '1' || lireTxt('trigone_premier_lancement_fait') === '1');
        fenCompte.querySelector('#JUM-C-PLUSTARD').addEventListener('click', fermer);
        fenCompte.querySelector('#JUM-C-SANS').addEventListener('click', function() { window.JUMELAGE_FERMER_COMPTE(); window.JUMELAGE_REGLAGES(); });
        var TEXTES = {
            creer: ['Bienvenue 👋', 'Votre grade, votre nom, votre unité : TRIGONE vous crée votre adresse prénom.nom@trigone-app.com. Aucune adresse mail personnelle, aucun mot de passe. Un responsable de votre unité valide ensuite votre compte.'],
            connecter: ['Bon retour 👋', 'Votre compte existe déjà : reliez cet appareil avec un code de liaison (sur votre ancien appareil : Paramètres › Compte › « Ajouter un appareil »). Ancien appareil perdu ou bloqué : demandez un code de réactivation à l\'administrateur de votre unité.']
        };
        var modeCourant = 'creer';
        function mode(m) {
            modeCourant = m;
            fenCompte.querySelector('#JUM-C-IDENT').style.display = m === 'creer' ? '' : 'none';
            var avecMail = !ETAT_INFO || ETAT_INFO.connexionMail;   // plus de connexion par mail (sauf tests locaux)
            fenCompte.querySelector('#JUM-C-MAILBLOC').style.display = m === 'creer' || !avecMail ? 'none' : '';
            fenCompte.querySelector('#JUM-C-SANSMAILBLOC').style.display = m === 'connecter' && !avecMail ? '' : 'none';
            ['.JUM-ACC-OU', '.JUM-ACC-AUTRE'].forEach(function(q) { var e = fenCompte.querySelector('[data-volet="mail"] ' + q); if (e) e.style.display = m === 'connecter' && !avecMail ? 'none' : ''; });
            Array.prototype.forEach.call(fenCompte.querySelectorAll('.JUM-ACC-ONGLETS button'), function(x) { x.classList.toggle('actif', x.getAttribute('data-mode') === m); });
            fenCompte.querySelector('#JUM-C-TITRE').textContent = TEXTES[m][0];
            fenCompte.querySelector('#JUM-C-AIDE').textContent = TEXTES[m][1];
        }
        function volet(v) { Array.prototype.forEach.call(fenCompte.querySelectorAll('[data-volet]'), function(x) { x.style.display = x.getAttribute('data-volet') === v ? '' : 'none'; }); }
        function aller(but) {
            fenCompte.setAttribute('data-etape', 'form'); fenCompte.scrollTop = 0;
            if (but === 'liaison') { volet('liaison'); return; }
            volet('mail'); mode(but);
        }
        mode('creer');
        Array.prototype.forEach.call(fenCompte.querySelectorAll('[data-aller]'), function(b) { b.addEventListener('click', function() { aller(b.getAttribute('data-aller')); }); });
        Array.prototype.forEach.call(fenCompte.querySelectorAll('.JUM-ACC-ONGLETS button'), function(b) { b.addEventListener('click', function() { mode(b.getAttribute('data-mode')); }); });
        fenCompte.querySelector('.JUM-ACC-RETOUR').addEventListener('click', function() { if (opts.premiere) { fenCompte.setAttribute('data-etape', 'accueil'); fenCompte.scrollTop = 0; } else fermer(); });
        // Code à 6 chiffres : un seul champ (collage, remplissage automatique du code reçu par SMS/mail), affiché en 6 cases.
        var champCode = fenCompte.querySelector('#JUM-C-CODE'), cases = fenCompte.querySelectorAll('.JUM-ACC-CODE span');
        function majCases() {
            var v = champCode.value.replace(/\D/g, '').slice(0, 6), actif = document.activeElement === champCode;
            if (champCode.value !== v) champCode.value = v;
            Array.prototype.forEach.call(cases, function(c, i) { c.textContent = v.charAt(i); c.classList.toggle('plein', i < v.length); c.classList.toggle('curseur', actif && i === Math.min(v.length, 5) && v.length < 6); });
        }
        ['input', 'focus', 'blur'].forEach(function(t) { champCode.addEventListener(t, majCases); });
        champCode.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !btnValider.disabled) btnValider.click(); });
        var err = fenCompte.querySelector('#JUM-C-ERR'), champMail = fenCompte.querySelector('#JUM-C-MAIL'), mailDemande = '';
        var btnEnvoi = fenCompte.querySelector('#JUM-C-ENVOI'), btnValider = fenCompte.querySelector('#JUM-C-VALIDER');
        // Créer mon compte (sans adresse mail) : aperçu de l'adresse TRIGONE, puis création ; le compte attend sa validation.
        var champsId = ['GRADE', 'UNITE', 'NOM', 'PRENOM'].map(function(k) { return fenCompte.querySelector('#JUM-C-' + k); });
        brancherListeUnites(champsId[1]);
        var slug = function(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
        var apercu = function() {
            var a = [slug(champsId[3].value), slug(champsId[2].value)].filter(Boolean).join('.');
            fenCompte.querySelector('#JUM-C-APERCU').innerHTML = a ? 'Votre adresse TRIGONE : <b>' + esc(a) + '@trigone-app.com</b>' : '';
        };
        champsId.forEach(function(x) { x.addEventListener('input', apercu); }); apercu();
        fenCompte.querySelector('#JUM-C-CREER').addEventListener('click', function() {
            var b = this, v = function(i) { return champsId[i].value.trim(); }, u = uniteConnue(v(1));
            err.style.color = '';
            if (!v(0) || !v(2) || !v(3)) { err.textContent = '⛔ Grade, nom et prénom sont nécessaires.'; return; }
            if (!u) { err.textContent = '⛔ Choisissez votre unité dans la liste.'; champsId[1].focus(); return; }
            b.disabled = true; b.textContent = 'Création du compte…'; err.textContent = '';
            ecrireReglages(Object.assign(lireReglages(), { grade: v(0).toUpperCase(), unite: u.nom, nom: v(2).toUpperCase(), prenom: v(3) }));
            var paire;
            SUBTLE.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']).then(function(p) {
                paire = p; return SUBTLE.exportKey('jwk', p.publicKey);
            }).then(function(pub) {
                return appelApi('inscription/directe', { methode: 'POST', corps: { grade: v(0), nom: v(2), prenom: v(3), appareil: nomAppareil(), cle: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } } });
            }).then(function(rep) {
                return cleIdb('ecrire', { prive: paire.privateKey }).then(function() {
                    ecrireTxt(CLE_COMPTE, JSON.stringify({ mail: rep.mail, appareil: rep.appareil, jeton: rep.jeton }));
                    ecrireTxt(CLE_ATTENTE, '1');
                    ecrireTxt(CLE_ADRESSE, JSON.stringify({ sig: rep.mail + '|' + v(3) + '|' + v(2).toUpperCase(), mail: rep.mail, adresse: rep.adresse }));
                    window.JUMELAGE_FERMER_COMPTE(); majBoutonsCompte();
                    var suite = function() { if (!window.JUMELAGE_REGLAGES_FAITS()) setTimeout(function() { window.JUMELAGE_REGLAGES({ premiere: true, profil: true }); }, 400); };
                    if (!profilComplet()) setTimeout(function() { window.JUMELAGE_REGLAGES({ premiere: true, profil: true }); }, 300);   // parcours guidé : la suite à l'écran
                    else infoCompte('Compte créé — à valider', 'Votre adresse TRIGONE : ' + rep.adresse + '.\n\nUn responsable de votre unité (administrateur ou assistant Chorus DT) doit valider votre compte : il a reçu une notification. Plus rapide : montrez votre carte TRIGONE à votre chef, valideur ou assistant Chorus DT, qui la scanne.\n\nEn attendant, vous pouvez préparer vos demandes ; elles partiront une fois le compte validé.', suite);
                });
            }).catch(function(e) { err.textContent = '⛔ ' + (e.message || e); b.disabled = false; b.textContent = 'Créer mon compte'; });
        });
        serviceDisponible().then(function(ok) {
            if (ok && fenCompte) mode(modeCourant);
            if (!ok && fenCompte) { err.textContent = navigator.onLine ? 'Le service de boîte aux lettres TRIGONE n\'est pas encore en service.' : 'Pas de connexion : réessayez une fois connecté.'; btnEnvoi.disabled = true; }
        });
        champMail.addEventListener('keydown', function(e) { if (e.key === 'Enter') btnEnvoi.click(); });
        btnEnvoi.addEventListener('click', function() {
            var mail = champMail.value.trim().toLowerCase();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { err.textContent = '⛔ Adresse mail invalide.'; return; }
            err.textContent = ''; btnEnvoi.disabled = true; btnEnvoi.textContent = 'Envoi du code…';
            appelApi('inscription/code', { methode: 'POST', corps: { mail: mail } }).then(function(rep) {
                mailDemande = mail;
                fenCompte.querySelector('#JUM-C-ETAPE2').style.display = '';
                fenCompte.querySelector('.JUM-ACC-RENVOI-SLOT').appendChild(btnEnvoi); btnEnvoi.classList.add('renvoi');
                btnEnvoi.textContent = 'Renvoyer le code'; btnEnvoi.disabled = false; btnValider.disabled = false;
                if (rep.codeTest) champCode.value = rep.codeTest;   // tests locaux uniquement
                champCode.focus(); majCases();
                err.style.color = '#15803d'; err.textContent = '✓ Code envoyé à ' + mail + '.';
            }, function(e) { err.style.color = ''; err.textContent = '⛔ ' + e.message; btnEnvoi.disabled = false; btnEnvoi.textContent = mailDemande ? 'Renvoyer le code' : 'Recevoir le code par mail'; });
        });
        btnValider.addEventListener('click', function() {
            var code = champCode.value.trim();
            if (!/^\d{6}$/.test(code)) { err.style.color = ''; err.textContent = '⛔ Le code contient 6 chiffres.'; return; }
            btnValider.disabled = true; err.style.color = ''; err.textContent = '';
            var paire;
            SUBTLE.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']).then(function(p) {
                paire = p; return SUBTLE.exportKey('jwk', p.publicKey);
            }).then(function(pub) {
                return appelApi('inscription/valider', { methode: 'POST', corps: { mail: mailDemande, code: code, nom: nomAppareil(), cle: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } } });
            }).then(function(rep) {
                return cleIdb('ecrire', { prive: paire.privateKey }).then(function() {
                    ecrireTxt(CLE_COMPTE, JSON.stringify({ mail: rep.mail, appareil: rep.appareil, jeton: rep.jeton }));
                    window.JUMELAGE_FERMER_COMPTE();
                    bandeau('Compte TRIGONE actif : les demandes vous arrivent directement dans TRIGONE.');
                    if (window.JUMELAGE_APRES_COMPTE) try { window.JUMELAGE_APRES_COMPTE(); } catch (e) {}
                    declarerRoles();
                    window.JUMELAGE_RELEVER();
                    majBoutonsCompte();
                    var suite = function() {
                        // Première connexion : l'identité est demandée une fois (« Compléter mon profil »), puis les notifications.
                        if (!window.JUMELAGE_REGLAGES_FAITS()) { profilApresConnexion = true; setTimeout(function() { window.JUMELAGE_REGLAGES({ premiere: true, profil: true }); }, 500); return; }
                        // Compte actif : la fenêtre se rouvre pour proposer les notifications (sur un geste de l'utilisateur).
                        if (notifEtat() === 'a-demander' || notifEtat() === 'autorisee') setTimeout(window.JUMELAGE_COMPTE, 600); else suivreNotif();
                    };
                    // Nouvel appareil (aucun profil ici) et sauvegarde automatique dans le compte : on propose de tout récupérer.
                    if (!window.JUMELAGE_REGLAGES_FAITS() && !etatSauvAuto().actif) window.JUMELAGE_RESTAURER_COMPTE({ apresConnexion: true, sinon: suite });
                    else suite();
                });
            }).catch(function(e) { err.textContent = '⛔ ' + e.message; btnValider.disabled = false; });
        });
    };
    // ---------- Déconnexion ----------
    // Se déconnecter : l'appareil quitte le compte (plus d'envois ni de réception), ses données restent.
    function deconnecter() {
        var go = function() {
            appelApi('appareil', { methode: 'DELETE' }).catch(function() {}).then(function() {
                try { localStorage.removeItem(CLE_COMPTE); localStorage.removeItem(CLE_MUET); localStorage.removeItem(CLE_NID_PUBLIE); } catch (e) {}
                cleIdb('effacer').catch(function() {});
                window.JUMELAGE_FERMER_COMPTE(); majBoutonsCompte();
                bandeau('Déconnecté : vos données restent sur cet appareil. « Se connecter », en haut à droite, pour reprendre.');
            });
        };
        var texte = 'Cet appareil ne pourra plus envoyer ni recevoir d\'envois TRIGONE. Vos demandes, comptes-rendus et réglages restent sur l\'appareil.' +
            (/@trigone-app\.com$/.test((monCompte() || {}).mail || '') ? '\n\nCompte sans adresse mail : pour vous reconnecter, il faudra un code de liaison depuis un autre de vos appareils, ou un code de réactivation remis par votre administrateur.' : '');
        if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM('Se déconnecter ?', texte, 'Oui, me déconnecter', go, '⚠️', null, true);
        else if (window.confirm(texte)) go();
    }
    // Se déconnecter et effacer : le compte quitte l'appareil et toutes les données TRIGONE en sont effacées.
    function deconnecterEtEffacer() {
        if (effacementSurDemande()) return;
        var texte = 'Cet appareil sera déconnecté de votre compte TRIGONE et TOUTES ses données TRIGONE seront effacées (demandes, bibliothèque, comptes-rendus, réglages, code d\'accès).\n\n' +
            'Pour tout retrouver ensuite : un code de liaison depuis votre autre appareil (bouton de compte en haut à droite › « Ajouter un appareil »), ou une sauvegarde. Sans autre appareil ni sauvegarde, les données seront perdues.';
        var go = function() { appelApi('appareil', { methode: 'DELETE' }).catch(function() {}).then(function() { cleIdb('effacer').catch(function() {}).then(toutEffacer); }); };
        if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM('Se déconnecter et effacer ?', texte, 'Oui, déconnecter et effacer', go, '⚠️', 'mascotte-poubelle.webp', true);
        else if (window.confirm(texte)) go();
    }

    // ---------- Mon compte : bouton en haut à droite ----------
    // Pas connecté : « Se connecter ». Connecté : initiales, grade et nom, point d'état des notifications
    // (vert : actives ; orange : coupées sur cet appareil ; gris : pas activées). Un toucher ouvre le menu du compte.
    var LIBELLES_ROLES = { valideur1: 'VALIDEUR 1', valideur2: 'VALIDEUR 2', chorus: 'ASSIST CHORUS DT' };
    function initiales() {
        var r = lireReglages(), c = monCompte();
        var i = ((r.prenom || '').charAt(0) + (r.nom || '').charAt(0)).toUpperCase();
        return i || (c ? c.mail.charAt(0).toUpperCase() : '?');
    }
    function nomCompte() {
        var r = lireReglages(), c = monCompte();
        return [r.grade, r.nom].filter(Boolean).join(' ') || (c ? c.mail.split('@')[0] : '');
    }
    function etatPoint() { return notifEtat() !== 'active' ? 'off' : notifMuet() ? 'muet' : 'ok'; }
    // Pastille ronde du compte : la photo de Ma carte (gardée sur l'appareil) si elle existe, sinon les initiales.
    function avatarHtml() {
        var ph = lireTxt('trigone_carte_photo');
        return ph && /^data:image\//.test(ph) ? '<span class="JUM-AV photo"><img src="' + ph + '" alt=""></span>' : '<span class="JUM-AV">' + esc(initiales()) + '</span>';
    }
    function htmlBoutonCompte() {
        if (!monCompte()) return (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('personne') : '') + '<span class="JUM-CPT-NOM">Se connecter</span>';
        return avatarHtml() + '<span class="JUM-CPT-NOM">' + esc(nomCompte()) + '</span><i class="JUM-CPT-PT ' + etatPoint() + '"></i>';
    }
    function titreBoutonCompte() {
        if (!monCompte()) return 'Se connecter à TRIGONE';
        var e = etatPoint();
        return 'Mon compte (' + monCompte().mail + ') — notifications ' + (e === 'ok' ? 'actives' : e === 'muet' ? 'coupées sur cet appareil' : 'non activées');
    }
    // Matricule du profil déclaré au serveur (empreinte salée, pas en clair) : le chef de mission collective retrouve
    // ainsi le compte TRIGONE de ses participants sans chercher leur adresse. Une fois par compte et par matricule.
    var CLE_NID_PUBLIE = 'trigone_nid_publie', minuteurNid = null;
    function publierNid() {
        clearTimeout(minuteurNid);
        minuteurNid = setTimeout(function() {
            var c = monCompte(); if (!c || !navigator.onLine) return;
            var nid = chiffres(lireReglages().matricule); if (nid.length !== 10) nid = '';
            var marque = c.mail + '|' + nid;
            if (lireTxt(CLE_NID_PUBLIE) === marque) return;
            appelApi('nid', { methode: 'POST', corps: { nid: nid } }).then(function() { ecrireTxt(CLE_NID_PUBLIE, marque); })
                .catch(function(e) { if (e && e.statut === 409) ecrireTxt(CLE_NID_PUBLIE, marque); });
        }, 1500);
    }
    // N° OMR : numéro suivant de la série commune ({ numero, le }) ; série (assistant Chorus DT) : { prefixe, prochain }.
    window.JUMELAGE_OMR_TIRER = function() {
        if (!monCompte() || !navigator.onLine) return Promise.reject(new Error('hors ligne'));
        return appelApi('omr', { methode: 'POST' });
    };
    // Registre remis à zéro (assistant Chorus DT) : toutes les lignes effacées chez tous les assistants de l'unité, et la
    // numérotation repart à 0001 (sans préfixe). Les demandes déjà numérotées chez les missionnaires gardent leur numéro.
    window.JUMELAGE_REGISTRE_VIDER = function() {
        if (!monCompte() || !navigator.onLine) return Promise.reject(new Error('Il faut du réseau et votre compte TRIGONE.'));
        return appelApi('registre/vider', { methode: 'POST' }).then(function(r) {
            ecrireTxt(CLE_REG_FILE, JSON.stringify({ lignes: {}, supprimer: {} }));
            registreEcrire([]);
            if (r.dernier) ecrireTxt(CLE_REG_DEPUIS, String(r.dernier));
            return r;
        });
    };
    window.JUMELAGE_OMR_SERIE = function(nouvelle) {
        return appelApi('omr/serie', nouvelle ? { methode: 'POST', corps: nouvelle } : {});
    };
    // Participants d'une mission collective : { matricule (10 chiffres) : adresse du compte TRIGONE } pour ceux qui en ont un ;
    // null : recherche impossible (hors ligne, pas connecté, serveur).
    window.JUMELAGE_COMPTES_PAR_NID = function(nids) {
        nids = (nids || []).map(chiffres).filter(function(n) { return n.length === 10; });
        if (!nids.length) return Promise.resolve({});
        if (!monCompte() || !navigator.onLine) return Promise.resolve(null);
        return appelApi('nids', { methode: 'POST', corps: { nids: nids } }).then(function(r) { return r.comptes || {}; }).catch(function() { return null; });
    };
    function majBoutonsCompte() {
        publierNid();
        Array.prototype.forEach.call(document.querySelectorAll('.JUM-CPT'), function(b) {
            b.classList.toggle('deconnecte', !monCompte());
            b.innerHTML = htmlBoutonCompte(); b.title = titreBoutonCompte(); b.setAttribute('aria-label', titreBoutonCompte());
        });
    }
    window.JUMELAGE_MAJ_COMPTE = majBoutonsCompte;
    window.addEventListener('storage', function(ev) { if (ev.key === 'trigone_carte_photo') majBoutonsCompte(); });
    function creerBoutonCompte(classe) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'JUM-CPT' + (classe ? ' ' + classe : '') + (monCompte() ? '' : ' deconnecte');
        b.innerHTML = htmlBoutonCompte(); b.title = titreBoutonCompte(); b.setAttribute('aria-label', titreBoutonCompte());
        ['pointerdown', 'pointerup'].forEach(function(t) { b.addEventListener(t, function(e) { e.stopPropagation(); }); });
        // Toujours le menu (« Se connecter » en tête sans compte) : Paramètres reste accessible, par exemple pour restaurer une sauvegarde.
        b.addEventListener('click', function(e) { e.stopPropagation(); ouvrirMenuCompte(b); });
        return b;
    }
    // PC : le bouton de compte (et l'affichage PC d'un pliable) prend place en haut du menu de gauche des applis.
    window.JUMELAGE_PLACER_COMPTE = function(menu) {
        var slot = menu && menu.querySelector('.PC-COMPTE-SLOT'); if (!slot) return;
        slot.appendChild(creerBoutonCompte('JUM-CPT-PC')); slot.appendChild(creerBoutonModePc());
        majBoutonsCompte();
    };
    var LIVRE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M9 7.5h7M9 11h5"/></svg>';
    function creerBoutonNotice() {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'JUM-NOTICE-ACCES'; b.title = 'Notice TRIGONE'; b.setAttribute('aria-label', 'Notice TRIGONE');
        b.innerHTML = LIVRE_SVG + '<span>Notice</span>';
        ['pointerdown', 'pointerup'].forEach(function(t) { b.addEventListener(t, function(e) { e.stopPropagation(); }); });
        b.addEventListener('click', function(e) { e.stopPropagation(); fermerMenuCompte(); window.JUMELAGE_NOTICE(); });
        return b;
    }
    function creerBoutonParam() {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'JUM-PARAM-ACCES'; b.title = 'Paramètres'; b.setAttribute('aria-label', 'Paramètres');
        b.innerHTML = ROUE_SVG;
        ['pointerdown', 'pointerup'].forEach(function(t) { b.addEventListener(t, function(e) { e.stopPropagation(); }); });
        b.addEventListener('click', function(e) { e.stopPropagation(); fermerMenuCompte(); window.JUMELAGE_PARAMETRES(); });
        return b;
    }
    // Dans Mise en route et Compte-rendu : le même bouton, sur la page d'accueil de l'appli (appelé à chaque changement de page).
    var boutonAppli = null;
    window.JUMELAGE_BOUTON_APPLI = function(visible) {
        if (!document.body) return;
        if (!boutonAppli) {
            boutonAppli = document.createElement('div'); boutonAppli.className = 'JUM-CPT-ZONE';
            boutonAppli.appendChild(creerBoutonCompte('JUM-CPT-APPLI')); boutonAppli.appendChild(creerBoutonModePc());
            // Ma carte TRIGONE : accès direct depuis l'accueil de l'appli.
            var bc = document.createElement('button'); bc.type = 'button'; bc.className = 'JUM-CARTE-ACCES'; bc.title = 'Ma carte TRIGONE'; bc.setAttribute('aria-label', 'Ma carte TRIGONE');
            bc.innerHTML = '<i></i><span>Ma carte</span>';
            ['pointerdown', 'pointerup'].forEach(function(t) { bc.addEventListener(t, function(e) { e.stopPropagation(); }); });
            bc.addEventListener('click', function(e) { e.stopPropagation(); window.JUMELAGE_CARTE(); });
            boutonAppli.appendChild(bc);
            boutonAppli.appendChild(creerBoutonNotice());
            document.body.appendChild(boutonAppli);
        }
        boutonAppli.style.display = visible ? '' : 'none';
        if (visible) retirerRetourFlottant();
        if (!visible) fermerMenuCompte(); else majBoutonsCompte();
    };
    function fermerMenuCompte() { var m = document.querySelector('.JUM-CPT-MENU'); if (m) { m.remove(); return true; } return false; }
    window.JUMELAGE_FERMER_MENU_COMPTE = fermerMenuCompte;
    // Menu toujours entier à l'écran (téléphone étroit, ex. Galaxy Z Flip, zoom d'affichage) : décalé ou rétréci au besoin.
    function placerDansEcran(m) {
        var W = document.documentElement.clientWidth || window.innerWidth, H = window.innerHeight, marge = 12;
        m.style.maxWidth = (W - 2 * marge) + 'px';
        var r = m.getBoundingClientRect();
        if (r.right > W - marge || r.left < marge) { m.style.right = 'auto'; m.style.left = Math.max(marge, Math.min(r.left, W - marge - r.width)) + 'px'; }
        m.style.maxHeight = Math.max(160, H - Math.max(marge, r.top) - marge) + 'px';
    }
    function ouvrirMenuCompte(bouton) {
        if (fermerMenuCompte()) return;
        var c = monCompte();
        var ic = function(n) { return window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE(n) : ''; };
        var roles = rolesLocaux(), aRole = Object.keys(roles).length > 0, e = notifEtat();
        // Entrées propres à l'appli ouverte (notice, réglages, références…) : pas sur l'écran de choix.
        var appli = !ecran && window.JUMELAGE_MENU_APPLI ? (window.JUMELAGE_MENU_APPLI() || []) : [];
        var m = document.createElement('div');
        m.className = 'JUM-CPT-MENU'; m.setAttribute('role', 'menu');
        // Menu court : le reste (rôles, notifications, appareils, réglages de l'appli, données, aide) est dans Paramètres.
        var lignesCourtes = '<button type="button" data-action="carte">' + ic('carte') + '<span><b>Ma carte TRIGONE</b><small>Photo, QR code, afficher en grand</small></span></button>' +
            '<button type="button" data-action="parametres">' + ROUE_SVG + '<span><b>Paramètres</b><small>Profil, rôles, notifications, ' + (appli.some(function(x) { return !/^(Aide rapide|Notice|Références|Mise à jour|Signaler)/.test(x.titre); }) ? (DANS_CR ? 'compte-rendu' : 'mise en route') + ', ' : '') + 'données, aide</small></span></button>';
        if (!c) m.innerHTML = '<div class="JUM-CPT-TETE"><span class="JUM-AV">?</span><div><b>Pas connecté</b><small>Connectez-vous pour envoyer et recevoir vos demandes et comptes-rendus.</small></div></div>' +
            '<button type="button" data-action="connexion">' + ic('personne') + '<span><b>Se connecter</b><small>Première connexion, ou autre appareil</small></span></button>' +
            '<div class="JUM-CPT-SEP"></div>' + lignesCourtes;
        else m.innerHTML = '<div class="JUM-CPT-TETE">' + avatarHtml() + '<div><b>' + esc([lireReglages().grade, lireReglages().nom, lireReglages().prenom].filter(Boolean).join(' ') || nomCompte()) + '</b><small>' + esc(c.mail) + '</small>' + (lireTxt(CLE_ATTENTE) ? '<small class="JUM-CPT-ATT">⏳ En attente de validation par votre unité</small>' : '') + '</div></div>' +
            '<div class="JUM-CPT-ROLES"><span>MISSIONNAIRE</span>' + Object.keys(LIBELLES_ROLES).filter(function(k) { return roles[k]; }).map(function(k) { return '<span class="' + (k === 'chorus' ? 'or' : '') + '">' + LIBELLES_ROLES[k] + '</span>'; }).join('') + '</div>' +
            '<div class="JUM-CPT-SEP"></div>' + lignesCourtes +
            '<div class="JUM-CPT-SEP"></div>' +
            '<button type="button" data-action="deco">' + ic('exporter') + '<span><b>Se déconnecter</b><small>Vos données restent sur l\'appareil</small></span></button>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { m.addEventListener(t, function(ev) { ev.stopPropagation(); }); });
        m.addEventListener('click', function(ev) {
            var b = ev.target.closest('button'); if (!b) return;
            m.remove();
            var a = b.getAttribute('data-action');
            if (a === 'connexion') window.JUMELAGE_CONNEXION();
            else if (a === 'parametres') window.JUMELAGE_PARAMETRES();
            else if (a === 'carte') window.JUMELAGE_CARTE();
            else if (a === 'aide') window.JUMELAGE_PARAMETRES('aide');
            else if (a === 'sauver') window.JUMELAGE_SAUVEGARDER();
            else if (a === 'restaurer') window.JUMELAGE_RESTAURER();
            else if (a === 'profil') window.JUMELAGE_REGLAGES({ vue: 'profil' });
            else if (a === 'roles') window.JUMELAGE_REGLAGES({ vue: 'roles' });
            else if (a === 'absence') window.JUMELAGE_REGLAGES({ vue: 'absence' });
            else if (a === 'notif') window.JUMELAGE_COMPTE();
            else if (a === 'muet') window.JUMELAGE_NOTIF_MUET();
            else if (a === 'appareil') window.JUMELAGE_COMPTE({ liaison: true });
            else if (a === 'deco') deconnecter();
            else if (a === 'effacer') deconnecterEtEffacer();
        });
        var rect = bouton.getBoundingClientRect();
        m.style.top = Math.round(rect.bottom + 8) + 'px';
        m.style.right = Math.max(12, Math.round(window.innerWidth - rect.right)) + 'px';
        document.body.appendChild(m);
        // Menu sous un bouton placé à gauche (menu PC) : il s'aligne à gauche du bouton.
        if (rect.left < window.innerWidth / 2) { m.style.right = 'auto'; m.style.left = Math.max(12, Math.round(rect.left)) + 'px'; }
        placerDansEcran(m);
        setTimeout(function() {
            document.addEventListener('click', function fermer(ev) {
                if (!document.body.contains(m)) { document.removeEventListener('click', fermer, true); return; }
                if (m.contains(ev.target) || bouton.contains(ev.target)) return;
                m.remove(); document.removeEventListener('click', fermer, true);
            }, true);
        }, 0);
    }

    // ---------- Paramètres : une page rangée en rubriques (menu du compte, roue crantée de l'écran de choix) ----------
    // Chaque ligne lance l'action existante (fenêtres de profil, de rôles, de notifications, sauvegarde…).
    // Entrées des applis : Références et Mise à jour vont dans Aide ; l'ancienne aide rapide (remplacée par la Notice TRIGONE)
    // et Signaler (déjà dans Aide) ne sont pas reprises dans les Paramètres.
    var AIDE_APPLI = /^(Références|Mise à jour)/, HORS_PARAM = /^(Aide rapide|Notice|Signaler)/;
    function rubriquesParametres() {
        var c = monCompte(), ic = function(n) { return window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE(n) : ''; };
        var roles = rolesLocaux(), aRole = Object.keys(roles).length > 0, e = notifEtat();
        var appli = !ecran && window.JUMELAGE_MENU_APPLI ? (window.JUMELAGE_MENU_APPLI() || []) : [];
        var L = function(id, icone, titre, sous, action, danger) { return { id: id, icone: icone, titre: titre, sous: sous, action: action, danger: danger }; };
        var r = [
            { id: 'compte', titre: 'Compte', icone: ic('personne'), aide: c ? 'Connecté avec ' + c.mail + '.' : 'Vous n\'êtes pas connecté : connectez-vous pour envoyer et recevoir vos demandes et comptes-rendus.', lignes: [
                !c && L('connexion', ic('personne'), 'Se connecter', 'Première connexion, ou autre appareil', function() { window.JUMELAGE_CONNEXION(); }),
                L('carte', ic('carte'), 'Ma carte TRIGONE', 'Photo, QR code, afficher en grand', function() { window.JUMELAGE_CARTE(); }),
                L('profil', ic('personne'), 'Mon profil', 'Identité, destinataires, demande de réservation, code d\'accès', function() { window.JUMELAGE_REGLAGES({ vue: 'profil' }); }),
                L('roles', ic('groupe'), 'Mes rôles', aRole ? 'Valideur, assistant Chorus DT : gérer' : 'Valideur, assistant Chorus DT : ajouter un rôle avec son code', function() { window.JUMELAGE_REGLAGES({ vue: 'roles' }); }),
                aRole && L('absence', ic('sablier'), 'Absence', 'Désigner un remplaçant pendant votre absence', function() { window.JUMELAGE_REGLAGES({ vue: 'absence' }); }),
                c && L('appareil', ic('telephone'), 'Ajouter un appareil', 'PC ou téléphone, sans rien ressaisir', function() { window.JUMELAGE_COMPTE({ liaison: true }); }),
                c && L('mesappareils', ic('telephone'), 'Mes appareils', 'Voir vos appareils, retirer un téléphone perdu', function() { window.JUMELAGE_MES_APPAREILS(); }),
                c && (roles.chorus || lireTxt(CLE_ROLE_ADMIN)) && L('gestion', ic('groupe'), 'Comptes et demandes' + (NB_DEMANDES_COMPTE ? ' (' + NB_DEMANDES_COMPTE + ')' : ''), lireTxt(CLE_ROLE_ADMIN) ? 'Inscriptions, comptes de l\'unité (bloquer, supprimer), demandes, journal' : 'Inscriptions à valider, demandes de vos missionnaires', function() { window.JUMELAGE_GESTION_COMPTES(); })
            ] },
            { id: 'notif', titre: 'Notifications', icone: ic('cloche'), aide: 'Réception d\'une demande, suivi de vos envois, nouvelles versions, et boutons d\'horodatage sur la montre.', lignes: c ? [
                L('notif', ic('cloche'), 'Notifications', e === 'active' ? (notifMuet() ? 'Coupées sur cet appareil' : 'Actives sur cet appareil') + ' · tester' : 'Les activer sur cet appareil', function() { window.JUMELAGE_COMPTE(); }),
                e === 'active' && L('muet', ic('cloche'), notifMuet() ? 'Rétablir les notifications ici' : 'Couper les notifications ici', 'Vos autres appareils ne changent pas', function() { window.JUMELAGE_NOTIF_MUET(); }),
                surTelephone() && L('montre', ic('montre') + '<i class="JUM-MONTRE-PT' + (montrePrete() ? ' ok' : '') + '"></i>', 'Montre connectée', montrePrete() ? 'Prête : horodatage depuis le poignet · essai' : 'Notifications à activer pour la montre', function() { window.JUMELAGE_MONTRE(); })
            ] : [], vide: 'Connectez-vous d\'abord (rubrique Compte) pour recevoir les notifications.' }
        ];
        var propres = appli.filter(function(x) { return !AIDE_APPLI.test(x.titre) && !HORS_PARAM.test(x.titre); });
        if (propres.length) r.push({ id: 'appli', titre: DANS_CR ? 'Compte-rendu' : 'Mise en route', icone: ic('document'), aide: 'Réglages propres à ' + (DANS_CR ? 'l\'appli Compte-rendu de mission' : 'l\'appli Mise en route') + '.',
            lignes: propres.map(function(x, i) { return L('appli' + i, ic(x.icone), x.titre, x.sous, x.action); }) });
        r.push({ id: 'donnees', titre: 'Données', icone: ic('disquette'), aide: c ? 'Tout TRIGONE est rangé sur cet appareil : la sauvegarde automatique le garde aussi, chiffré, dans votre compte.' : 'Tout TRIGONE est rangé sur cet appareil : sauvegardez-le dans un fichier, ou connectez-vous pour la sauvegarde automatique.', lignes: [
            NB_ATTENTE && L('attente', ic('mail'), 'Envois en attente (' + NB_ATTENTE + ')', 'Faits sans réseau : ils partent tout seuls au retour du réseau', function() { window.JUMELAGE_ATTENTE(); }),
            c && L('sauvauto', ic('disquette'), 'Sauvegarde automatique', window.JUMELAGE_SAUVEGARDE_AUTO_RESUME(), function() { window.JUMELAGE_SAUVEGARDE_AUTO(); }),
            c && !etatSauvAuto().actif && L('restaurercompte', ic('importer'), 'Restaurer depuis mon compte', 'Nouvel appareil : avec votre code de récupération', function() { window.JUMELAGE_RESTAURER_COMPTE(); }),
            L('sauvegarder', ic('disquette'), 'Sauvegarder dans un fichier', 'Un fichier pour tout TRIGONE, à ranger où vous voulez', function() { window.JUMELAGE_SAUVEGARDER(); }),
            L('restaurer', ic('importer'), 'Restaurer depuis un fichier', 'Sur cet appareil ou un nouveau', function() { window.JUMELAGE_RESTAURER(); }),
            // Réinitialiser ou supprimer son compte : sur demande à l'assistant Chorus DT (ou à l'administrateur de l'unité) ;
            // l'administrateur garde la réinitialisation de son propre appareil. Sans compte : effacement de l'appareil.
            c && L('demreinit', CORBEILLE_SVG, 'Demander la réinitialisation', etatDemandeCompte('reinit') || 'Accordée par votre assistant Chorus DT ou l\'administrateur', function() { window.JUMELAGE_DEMANDE_COMPTE('reinit'); }, true),
            c && L('demsuppr', CORBEILLE_SVG, 'Demander la suppression de mon compte', etatDemandeCompte('suppression') || 'Adresse, carte, photo, sauvegarde : tout est effacé', function() { window.JUMELAGE_DEMANDE_COMPTE('suppression'); }, true),
            (!c || lireTxt(CLE_ROLE_ADMIN)) && L('reinitialiser', CORBEILLE_SVG, 'Réinitialiser TRIGONE', 'Tout effacer sur cet appareil', function() { window.JUMELAGE_REINITIALISER(); }, true)
        ] });
        r.push({ id: 'aide', titre: 'Aide', icone: ic('bouee'), aide: 'Pour prendre en main TRIGONE, ou nous signaler un souci.', lignes: [L('notice', ic('livre'), 'Notice TRIGONE', niveauNotice() === 2 ? 'Le livret complet, avec les écrans expliqués pas à pas' : 'Votre livret : ce qui vous concerne, écrans expliqués pas à pas', function() { window.JUMELAGE_NOTICE(); })]
            .concat(niveauNotice() < 2 ? [L('noticecomplete', ic('livre'), 'Notice complète', 'Tous les rôles : valideurs, assistant Chorus DT, administrateur', function() { window.JUMELAGE_NOTICE_COMPLETE(); })] : [])
            .concat(appli.filter(function(x) { return AIDE_APPLI.test(x.titre); })
            .map(function(x, i) { return L('aide' + i, ic(x.icone), x.titre, x.sous, x.action); })).concat([
            L('presentation', '<img src="' + (DANS_CR ? '../' : '') + 'phoenix-icon.png" alt="" style="width:20px;height:20px;">', 'Découvrir TRIGONE', 'Revoir la présentation', function() { window.JUMELAGE_PRESENTATION(); }),
            L('partager', ic('partage'), 'Partager TRIGONE', 'QR code et lien de l\'application', function() { window.JUMELAGE_PARTAGER_APPLI(); }),
            L('signaler', ic('bouee'), 'Signaler un problème', 'Écrire à l\'équipe TRIGONE', function() { window.JUMELAGE_SIGNALER(ecran ? 'choix' : undefined); }),
            c && lireTxt(CLE_ADMIN) === '1' && L('erreurs', ic('bouee'), 'Erreurs de l\'appli', 'Administrateur : bugs remontés automatiquement', function() { window.JUMELAGE_ERREURS(); })
        ]) });
        r.forEach(function(x) { x.lignes = x.lignes.filter(Boolean); });
        return r;
    }
    var fenParam = null;
    window.JUMELAGE_FERMER_PARAMETRES = function() { if (fenParam) { fenParam.remove(); fenParam = null; } }; fermeurs.push([function() { return fenParam; }, window.JUMELAGE_FERMER_PARAMETRES]);
    window.JUMELAGE_PARAMETRES = function(section) {
        window.JUMELAGE_FERMER_PARAMETRES(); retirerRetourFlottant();
        fermerMenuCompte(); var mr = document.querySelector('.JUM-ROUE-MENU'); if (mr) mr.remove();
        var rubs = rubriquesParametres(), c = monCompte();
        var actuelle = rubs.filter(function(x) { return x.id === section; })[0] || rubs[0];
        fenParam = document.createElement('div');
        fenParam.className = 'JUM-PARAM';
        var dessiner = function() {
            fenParam.setAttribute('data-rubrique', actuelle.id);
            fenParam.innerHTML = '<div class="JUM-PARAM-CARTE" role="dialog" aria-label="Paramètres">' +
                '<div class="JUM-PARAM-TETE">' + (c ? avatarHtml() : '') + '<h2>Paramètres</h2><button type="button" class="JUM-PARAM-FERMER" aria-label="Fermer">✕</button></div>' +
                '<div class="JUM-PARAM-CORPS"><nav class="JUM-PARAM-NAV">' + rubs.map(function(x) {
                    return '<button type="button" data-rub="' + x.id + '" class="' + (x === actuelle ? 'actif' : '') + '">' + x.icone + x.titre + '</button>'; }).join('') + '</nav>' +
                '<div class="JUM-PARAM-CONTENU">' + (actuelle === rubs[0] ? window.JUMELAGE_NOTICE_BOUTON().replace(' onclick="JUMELAGE_NOTICE()"', ' data-notice="1"') : '') +
                '<h3>' + esc(actuelle.titre) + '</h3><p>' + esc(actuelle.aide || '') + '</p>' +
                (actuelle.lignes.length ? actuelle.lignes.map(function(l) {
                    return '<button type="button" class="JUM-PARAM-LIGNE' + (l.danger ? ' danger' : '') + '" data-action="' + l.id + '">' + l.icone + '<span><b>' + esc(l.titre) + '</b><small>' + esc(l.sous || '') + '</small></span><i aria-hidden="true">›</i></button>'; }).join('')
                    : '<div class="JUM-PARAM-VIDE">' + esc(actuelle.vide || '') + '</div>') + '</div></div></div>';
        };
        dessiner();
        fenParam.addEventListener('click', function(ev) {
            if (ev.target === fenParam || ev.target.closest('.JUM-PARAM-FERMER')) { window.JUMELAGE_FERMER_PARAMETRES(); return; }
            var r = ev.target.closest('[data-rub]');
            if (r) { actuelle = rubs.filter(function(x) { return x.id === r.getAttribute('data-rub'); })[0] || actuelle; dessiner(); return; }
            if (ev.target.closest('[data-notice]')) { window.JUMELAGE_FERMER_PARAMETRES(); window.JUMELAGE_NOTICE(); return; }
            var b = ev.target.closest('[data-action]'); if (!b) return;
            var l = actuelle.lignes.filter(function(x) { return x.id === b.getAttribute('data-action'); })[0];
            if (!l) return;
            var rubDepart = actuelle.id, nbAvant = pileRetour.length;
            window.JUMELAGE_FERMER_PARAMETRES();
            l.action();
            // Pas de fenêtre ouverte (la ligne mène à une page de l'appli : Références, Réglages du compte-rendu…) :
            // flèche « ‹ Paramètres » flottante, jusqu'au retour à l'accueil de l'appli.
            setTimeout(function() {
                if (pileRetour.length > nbAvant || fenParam || document.querySelector('.JUM-SIG, .JUM-REGLAGES, .JUM-PARTAGE, .JUM-PRES')) return;
                if (!document.getElementById('MSG-OVERLAY') || document.getElementById('MSG-OVERLAY').classList.contains('HIDDEN') || document.getElementById('MSG-OVERLAY').style.display === 'none') retourFlottant(rubDepart);
            }, 400);
        });
        ['pointerdown', 'pointerup'].forEach(function(t) { fenParam.addEventListener(t, function(ev) { ev.stopPropagation(); }); });
        document.body.appendChild(fenParam);
        // Administrateur ? (réponse du serveur, d'après ADMIN_MAILS) : la ligne « Erreurs de l'appli » apparaît ou disparaît.
        if (c && navigator.onLine) {
            var fen = fenParam;
            appelApi('admin').then(function(r) {
                var avant = lireTxt(CLE_ADMIN), apres = r.admin ? '1' : '';
                if (avant === apres) return;
                ecrireTxt(CLE_ADMIN, apres);
                if (fenParam === fen) { var id = actuelle.id; rubs = rubriquesParametres(); actuelle = rubs.filter(function(x) { return x.id === id; })[0] || rubs[0]; dessiner(); }
            }).catch(function() {});
        }
    };
    // ---------- Erreurs de l'appli (administrateur) ----------
    var CLE_ADMIN = 'trigone_admin', fenErreurs = null;
    window.JUMELAGE_FERMER_ERREURS = function() { if (fenErreurs) { fenErreurs.remove(); fenErreurs = null; } }; fermeurs.push([function() { return fenErreurs; }, window.JUMELAGE_FERMER_ERREURS]);
    window.JUMELAGE_ERREURS = function() {
        if (fenErreurs || !document.body) return;
        fenErreurs = document.createElement('div');
        fenErreurs.className = 'JUM-REGLAGES';
        fenErreurs.setAttribute('role', 'dialog');
        var f = fenErreurs, liste = [];
        var date = function(ms) { var d = new Date(ms); return d.toLocaleDateString('fr-FR') + ' ' + ('0' + d.getHours()).slice(-2) + ' h ' + ('0' + d.getMinutes()).slice(-2); };
        var texte = function(x) { return 'TRIGONE — erreur remontée\nÉcran : ' + x.ecran + '\nMessage : ' + x.msg + '\nEmplacement : ' + (x.src || '—') + '\nVersion : V' + (x.v - 1) +
            '\nFréquence : ' + x.n + ' fois, ' + x.appareils + ' appareil(s), du ' + date(x.premier) + ' au ' + date(x.dernier) + '\nAppareil : ' + x.ua + (x.pile ? '\nPile :\n' + x.pile : ''); };
        function dessiner(etat) {
            f.innerHTML = '<div class="JUM-R-CARTE"><div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('bouee') : '') + '</span><div><h2>Erreurs de l\'appli</h2>' +
                '<p>Bugs remontés automatiquement par les appareils, sans aucune donnée personnelle. Regroupés, effacés après 30 jours.</p></div>' +
                '<button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_ERREURS()">✕</button></div><div class="JUM-R-CORPS">' +
                (etat ? '<p class="JUM-R-AIDE" style="margin-top:14px;">' + etat + '</p>' : !liste.length ? '<p class="JUM-R-AIDE" style="margin-top:14px;">✅ Aucune erreur depuis 30 jours.</p>' :
                liste.map(function(x, i) {
                    return '<div class="JUM-ERR"><b>' + esc(x.ecran || x.app) + '</b><span class="JUM-ERR-MSG">« ' + esc(x.msg) + ' »</span>' +
                        '<small>' + x.n + ' fois · ' + x.appareils + ' appareil' + (x.appareils > 1 ? 's' : '') + ' · V' + (x.v - 1) + ' · dernière fois le ' + date(x.dernier) + '</small>' +
                        '<details><summary>Détails techniques</summary><pre>' + esc(texte(x)) + '</pre></details>' +
                        '<div class="JUM-ERR-BTN"><button type="button" class="JUM-R-SECOND" data-copier="' + i + '">Copier</button><button type="button" class="JUM-R-SECOND" data-corrige="' + i + '">Corrigée</button></div></div>';
                }).join('')) + '</div><div class="JUM-R-PIED">' + (liste.length ? '<button type="button" class="JUM-R-SECOND" data-corrige="*">Tout effacer</button>' : '') +
                '<button type="button" class="JUM-R-PRINCIPAL" onclick="JUMELAGE_FERMER_ERREURS()">Fermer</button></div></div>';
        }
        function charger() {
            appelApi('erreurs').then(function(r) { liste = r.erreurs || []; if (fenErreurs === f) dessiner(); })
                .catch(function(e) { if (fenErreurs === f) dessiner(e.statut === 403 ? 'Page réservée à l\'administrateur de TRIGONE.' : 'Liste indisponible : ' + esc(e.message) + '.'); });
        }
        f.addEventListener('click', function(ev) {
            var b = ev.target.closest('[data-copier]');
            if (b) { var t = texte(liste[+b.getAttribute('data-copier')]);
                (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function() { b.textContent = 'Copié ✓'; }, function() { window.prompt('Copiez ce texte :', t); }); return; }
            var c2 = ev.target.closest('[data-corrige]');
            if (c2) { var k = c2.getAttribute('data-corrige'); if (k === '*' && !confirm('Effacer toutes les erreurs de la liste ?')) return;
                appelApi('erreurs/corrige', { methode: 'POST', corps: { sig: k === '*' ? '*' : liste[+k].sig } }).then(charger).catch(function() {}); }
        });
        dessiner('Chargement…');
        document.body.appendChild(f);
        charger();
    };

    // ---------- Déménagement : l'adresse officielle de TRIGONE est celle de Cloudflare ----------
    // L'ancienne adresse (GitHub Pages) ne sert plus qu'à publier. Le navigateur range les données par adresse :
    // à l'ancienne, TRIGONE propose de les transférer (fenêtre ouverte sur la nouvelle adresse, échange direct
    // entre les deux pages), puis y renvoie toujours vers la nouvelle.
    var DEM = { ancienne: 'https://parisien2403-blip.github.io', cible: 'https://trigone-mise-en-route.parisien2403.workers.dev/' };
    try { var demTest = JSON.parse(sessionStorage.getItem('trigone_test_demenagement') || 'null'); if (demTest) DEM = demTest; } catch (e) {}
    var ICI_ANCIENNE = location.origin === DEM.ancienne;
    var racineAppli = new URL(DANS_CR ? '../' : './', location.href).pathname;
    function adresseCible() { return DEM.cible + location.pathname.slice(racineAppli.length) + location.search + location.hash; }
    function donneesPresentes() {
        try { for (var i = 0; i < localStorage.length; i++) if (!/^(trigone_theme|trigone_build_vu|trigone_demenage_fait)$/.test(localStorage.key(i))) return true; } catch (e) {}
        return false;
    }
    var DEMENAGEMENT = ICI_ANCIENNE && !/[?&]rester=1/.test(location.search);
    if (DEMENAGEMENT && (lireTxt('trigone_demenage_fait') === '1' || !donneesPresentes())) {
        // Rien à transférer (ou déjà fait) : direction la nouvelle adresse.
        ecrireTxt('trigone_demenage_fait', '1');
        location.replace(adresseCible());
    } else if (DEMENAGEMENT) {
        var afficherDemenagement = function() {
            var d = document.createElement('div');
            d.className = 'JUM-DEM';
            d.innerHTML = '<div class="JUM-DEM-CARTE"><img src="' + (DANS_CR ? '../' : '') + 'icon-192.png" alt="">' +
                '<h2>TRIGONE change d\'adresse</h2>' +
                '<p>TRIGONE s\'utilise désormais à l\'adresse <b>' + DEM.cible.replace(/^https:\/\//, '').replace(/\/$/, '') + '</b>. Vos données (demandes, bibliothèque, comptes-rendus, réglages, pièces jointes) sont transférées en un clic.</p>' +
                '<button type="button" class="JUM-DEM-GO">Transférer mes données et continuer</button>' +
                '<p class="JUM-DEM-ETAT"></p>' +
                '<div class="JUM-DEM-AIDE"><b>Ensuite, sur cet appareil :</b> installez TRIGONE depuis la nouvelle adresse (PC : icône d\'installation dans la barre d\'adresse ; Android : menu ⋮ › Installer l\'application ; iPhone : Partager › Sur l\'écran d\'accueil), puis supprimez l\'ancienne icône TRIGONE.</div>' +
                '<button type="button" class="JUM-DEM-FICHIER">Transférer plutôt avec un fichier de sauvegarde</button></div>';
            document.body.appendChild(d);
            var etat = d.querySelector('.JUM-DEM-ETAT');
            d.querySelector('.JUM-DEM-FICHIER').addEventListener('click', function() {
                window.JUMELAGE_SAUVEGARDER();
                etat.textContent = 'Fichier de sauvegarde téléchargé. Ouvrez TRIGONE à la nouvelle adresse, puis bouton du compte › Paramètres › Données › « Restaurer depuis un fichier ».';
            });
            d.querySelector('.JUM-DEM-GO').addEventListener('click', function() {
                var bouton = this, fenetre = window.open(adresseCible().replace(/[?#].*$/, '') + '?demenagement=1', '_blank');
                if (!fenetre) { etat.textContent = 'La nouvelle fenêtre a été bloquée : autorisez les fenêtres pour cette page, ou transférez avec un fichier de sauvegarde.'; return; }
                bouton.disabled = true; etat.textContent = 'Transfert en cours…';
                var origineCible = new URL(DEM.cible).origin;
                window.addEventListener('message', function recevoir(ev) {
                    if (ev.origin !== origineCible || !ev.data) return;
                    if (ev.data.type === 'trigone-demenagement-pret') {
                        collecterSauvegarde().then(function(sv) { fenetre.postMessage({ type: 'trigone-demenagement-donnees', sauvegarde: sv }, origineCible); });
                    } else if (ev.data.type === 'trigone-demenagement-ok') {
                        window.removeEventListener('message', recevoir);
                        ecrireTxt('trigone_demenage_fait', '1');
                        etat.textContent = '✓ Données transférées. TRIGONE continue à la nouvelle adresse.';
                        setTimeout(function() { location.replace(adresseCible()); }, 1800);
                    }
                });
            });
        };
        if (document.body) afficherDemenagement(); else document.addEventListener('DOMContentLoaded', afficherDemenagement);
    }
    // Nouvelle adresse, ouverte par l'ancienne pour le transfert : reçoit les données et les range.
    var RECEPTION_DEMENAGEMENT = /[?&]demenagement=1/.test(location.search) && !!window.opener && !ICI_ANCIENNE;
    if (RECEPTION_DEMENAGEMENT) {
        var attente = function() {
            var d = document.createElement('div');
            d.className = 'JUM-DEM';
            d.innerHTML = '<div class="JUM-DEM-CARTE"><img src="' + (DANS_CR ? '../' : '') + 'icon-192.png" alt=""><h2>Transfert de vos données…</h2><p class="JUM-DEM-ETAT">Réception depuis l\'ancienne adresse de TRIGONE.</p></div>';
            document.body.appendChild(d);
            window.addEventListener('message', function(ev) {
                if (ev.origin !== DEM.ancienne || !ev.data || ev.data.type !== 'trigone-demenagement-donnees') return;
                var sv = ev.data.sauvegarde;
                appliquerSauvegarde(sv, !donneesPresentes()).then(function() {
                    try { ev.source.postMessage({ type: 'trigone-demenagement-ok' }, DEM.ancienne); } catch (e) {}
                    try { sessionStorage.setItem(CLE_DEVERROUILLE, '1'); sessionStorage.removeItem(CLE_CHOIX_FAIT); } catch (e) {}
                    d.querySelector('h2').textContent = '✓ Données transférées';
                    d.querySelector('.JUM-DEM-ETAT').textContent = 'TRIGONE est prêt à sa nouvelle adresse.';
                    setTimeout(function() { location.replace(location.pathname); }, 1500);
                });
            });
            window.opener.postMessage({ type: 'trigone-demenagement-pret' }, DEM.ancienne);
        };
        if (document.body) attente(); else document.addEventListener('DOMContentLoaded', attente);
    }
    // Menu de la roue crantée : réglages ou présentation.
    window.JUMELAGE_MENU_ROUE = function(e) {
        if (e) e.stopPropagation();
        // La roue crantée ouvre la page Paramètres (mêmes rubriques que le menu du compte).
        window.JUMELAGE_PARAMETRES();
        return;
        var m = document.querySelector('.JUM-ROUE-MENU');
        if (m) { m.remove(); return; }
        if (!ecran) return;
        m = document.createElement('div');
        m.className = 'JUM-ROUE-MENU';
        m.innerHTML = '<button type="button" data-action="presentation"><img src="' + (DANS_CR ? '../' : '') + 'phoenix-icon.png" alt=""><span><b>Découvrir TRIGONE</b><small>Revoir la présentation</small></span></button>' +
            '<button type="button" data-action="partager">' + window.JUMELAGE_ICONE('partage') + '<span><b>Partager TRIGONE</b><small>QR code et lien de l\'application</small></span></button>' +
            '<button type="button" data-action="signaler">' + window.JUMELAGE_ICONE('bouee') + '<span><b>Signaler un problème</b><small>Écrire à l\'équipe TRIGONE</small></span></button>' +
            '<div class="JUM-ROUE-SEP"></div>' +
            '<button type="button" data-action="sauvegarder">' + window.JUMELAGE_ICONE('disquette') + '<span><b>Sauvegarder mes données</b><small>Un fichier pour tout TRIGONE</small></span></button>' +
            '<button type="button" data-action="restaurer">' + window.JUMELAGE_ICONE('importer') + '<span><b>Restaurer une sauvegarde</b><small>Remettre en place un fichier de sauvegarde</small></span></button>' +
            '<div class="JUM-ROUE-SEP"></div>' +
            '<button type="button" data-action="reinitialiser" class="JUM-ROUE-DANGER">' + CORBEILLE_SVG + '<span><b>Réinitialiser TRIGONE</b><small>Tout effacer sur cet appareil</small></span></button>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { m.addEventListener(t, function(ev) { ev.stopPropagation(); }); });
        m.addEventListener('click', function(ev) {
            var b = ev.target.closest('button');
            if (!b) return;
            m.remove();
            var a = b.getAttribute('data-action');
            if (a === 'reglages') window.JUMELAGE_REGLAGES();
            else if (a === 'reinitialiser') window.JUMELAGE_REINITIALISER();
            else if (a === 'signaler') window.JUMELAGE_SIGNALER('choix');
            else if (a === 'partager') window.JUMELAGE_PARTAGER_APPLI();
            else if (a === 'sauvegarder') window.JUMELAGE_SAUVEGARDER();
            else if (a === 'compte') window.JUMELAGE_COMPTE();
            else if (a === 'restaurer') window.JUMELAGE_RESTAURER();
            else window.JUMELAGE_PRESENTATION();
        });
        ecran.appendChild(m);
    };

    // ---------- Icônes au trait à la place des emoji couleur (les deux applis) ----------
    // Les textes des applis gardent leurs emoji ; à l'affichage, chacun est remplacé par l'icône au trait
    // correspondante (même style que les onglets). Rien ne change dans les mails, PDF ou notifications.
    var P = {
        qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2.5v2.5H14zM19 14h1M14 19.5v.5M17 17.5h3V20h-3z"/>',
        carte: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 13h4"/>',
        cadenas: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
        cadenasOuvert: '<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.8-1.2"/>',
        maj: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>',
        importer: '<path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
        exporter: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
        trombone: '<path d="M20.5 11.5 12 20a5.5 5.5 0 0 1-7.8-7.8l8.9-8.9a3.7 3.7 0 0 1 5.2 5.2l-8.9 8.9a1.8 1.8 0 0 1-2.6-2.6l8.2-8.2"/>',
        ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16.2 9.5"/>',
        interdit: '<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>',
        disquette: '<path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2Z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
        alerte: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.5M12 17.2h.01"/>',
        telephone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
        montre: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6 9.7 2.5h4.6L15 6M9 18l.7 3.5h4.6L15 18M12 9.5V12l1.6 1.2"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
        lecture: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5-6-3.5Z"/>',
        voiture: '<path d="M5 16.5V12l2-5h10l2 5v4.5"/><path d="M4 12h16v4.5H4z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>',
        document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
        oeil: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
        presse: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
        sablier: '<path d="M6 3h12M6 21h12M7 3v3a5 5 0 0 0 10 0V3M7 21v-3a5 5 0 0 1 10 0v3"/>',
        chrono: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2.5h4"/>',
        annonce: '<path d="M3.5 10v4a1 1 0 0 0 1 1H7l7 4.5v-15L7 9H4.5a1 1 0 0 0-1 1Z"/><path d="M17.5 9a4 4 0 0 1 0 6M20 6.5a7.5 7.5 0 0 1 0 11"/>',
        corbeille: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5v-5M12 8h.01"/>',
        nouveau: '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 10.9 10.1 9 12 3.5Z"/><path d="M19 3v3M17.5 4.5h3"/>',
        groupe: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3"/><path d="M16 4.8a3.4 3.4 0 0 1 0 6.4M18 13.9c2.1.8 3.5 2.8 3.5 5.6"/>',
        personne: '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20.5c0-3.8 3.1-6.6 7-6.6s7 2.8 7 6.6"/>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
        photo: '<path d="M4 7.5h3l1.8-2.5h6.4L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.6"/>',
        cloche: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
        horsLigne: '<path d="M2 8.5a15 15 0 0 1 5-2.6M22 8.5a15 15 0 0 0-10.3-3.6M5 12a10 10 0 0 1 3.5-2M19 12a10 10 0 0 0-3-1.8M8.5 15.5a5 5 0 0 1 5.5-.9M12 19.5h.01M3 3l18 18"/>',
        partage: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 13.3 7.4 4.4M15.7 6.3l-7.4 4.4"/>',
        bouee: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
        dossier: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
        medaille: '<circle cx="12" cy="9" r="5.5"/><path d="M8.7 13.4 7 21.5l5-2.8 5 2.8-1.7-8.1"/>',
        euro: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4 4 0 1 0 0 7M7 11h6M7 13.5h6"/>',
        bulle: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>',
        graphique: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
        stylo: '<path d="M4 20l1.2-4.4L16.4 4.4a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8 4 20Z"/><path d="M14.5 6.3l3.2 3.2"/>',
        maison: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
        salut: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
        colis: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
        repere: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
        couverts: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 0-3.5 2.5-3.5 6v4H17"/>',
        hotel: '<path d="M3 20V7M21 20v-6a3 3 0 0 0-3-3h-8v6M3 17h18"/><circle cx="6.8" cy="12.2" r="1.8"/>',
        billet: '<path d="M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4Z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
        train: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8.5 19.5 7 21M15.5 19.5 17 21M8.5 13h.01M15.5 13h.01"/>',
        avion: '<path d="M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4.5l2.5 2V21L12 20l-4 1v-1.5l2.5-2V13l-7 2v-2l7-4Z"/>',
        bateau: '<path d="M3 17.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/><path d="M4.5 14 6 9h12l1.5 5M9 9V5h6v4"/>',
        partager: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>',
        lien: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
        facture: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
        livre: '<path d="M6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H19"/><path d="M8.5 7.5h6M8.5 11h4"/>',
        crayon: '<path d="M4 20l1.2-4.4L16.4 4.4a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8 4 20Z"/>'
    };
    // emoji → [icône, ton] ; ton : ok (vert), danger (rouge), alerte (ambre), sinon couleur du texte.
    var EMOJI = {
        '🔒': ['cadenas'], '🔐': ['cadenas'], '🔓': ['cadenasOuvert'], '🔄': ['maj'], '🔁': ['lien'], '📥': ['importer'], '⬇': ['importer'],
        '📤': ['exporter'], '📎': ['trombone'], '✅': ['ok', 'ok'], '⛔': ['interdit', 'danger'], '🚫': ['interdit', 'danger'], '💾': ['disquette'],
        '⚠': ['alerte', 'alerte'], '📱': ['telephone'], '📲': ['telephone'], '📧': ['mail'], '✉': ['mail'], '📨': ['mail'], '📩': ['mail'],
        '🎬': ['lecture'], '🚗': ['voiture'], '📄': ['document'], '📃': ['document'], '👁': ['oeil'], '📋': ['presse'], '⏳': ['sablier'], '⌛': ['sablier'],
        '⏱': ['chrono'], '📢': ['annonce'], '🗑': ['corbeille'], 'ℹ': ['info'], '✨': ['nouveau'], '👥': ['groupe'], '👤': ['personne'],
        '🖼': ['image'], '📷': ['photo'], '📸': ['photo'], '🔔': ['cloche'], '📴': ['horsLigne'], '🛟': ['bouee'], '📂': ['dossier'], '📁': ['dossier'],
        '🏅': ['medaille'], '🥇': ['medaille'], '🥈': ['medaille'], '🥉': ['medaille'], '💶': ['euro'], '💰': ['euro'], '💬': ['bulle'],
        '📊': ['graphique'], '📈': ['graphique'], '🖋': ['stylo'], '✍': ['stylo'], '✏': ['crayon'], '🏠': ['maison'], '👋': ['salut'], '📦': ['colis'],
        '🧾': ['facture'], '📍': ['repere'], '🍽': ['couverts'], '🏨': ['hotel'], '🎫': ['billet'], '🚆': ['train'], '🚄': ['train'], '✈': ['avion'],
        '⛴': ['bateau'], '🚢': ['bateau'], '🗂': ['dossier'], '📌': ['repere'], '🔗': ['lien'], '📅': ['document'], '🗓': ['document'], '📖': ['livre'], '📚': ['livre']
    };
    var RE_EMOJI = new RegExp('(' + Object.keys(EMOJI).join('|') + ')\\uFE0F?', 'g');
    var RE_TEST = new RegExp(Object.keys(EMOJI).join('|'));
    window.JUMELAGE_ICONE = function(nom) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[nom] || '') + '</svg>'; };
    function remplacer(noeud) {
        var t = noeud.data, frag = document.createDocumentFragment(), dernier = 0, m;
        RE_EMOJI.lastIndex = 0;
        while ((m = RE_EMOJI.exec(t))) {
            if (m.index > dernier) frag.appendChild(document.createTextNode(t.slice(dernier, m.index)));
            var def = EMOJI[m[1]], s = document.createElement('span');
            s.className = 'JUM-IC'; if (def[1]) s.setAttribute('data-ton', def[1]);
            s.innerHTML = window.JUMELAGE_ICONE(def[0]);
            frag.appendChild(s);
            dernier = m.index + m[0].length;
        }
        if (dernier < t.length) frag.appendChild(document.createTextNode(t.slice(dernier).replace(/^️/, '')));
        noeud.parentNode.replaceChild(frag, noeud);
    }
    var EXCLUS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, OPTGROUP: 1, TITLE: 1, svg: 1, SVG: 1 };
    function iconiser(racine) {
        if (!racine) return;
        if (racine.nodeType === 3) { var p = racine.parentNode; if (p && !EXCLUS[p.nodeName] && !(p.closest && p.closest('.JUM-IC,[data-emoji]')) && RE_TEST.test(racine.data)) remplacer(racine); return; }
        if (racine.nodeType !== 1 || EXCLUS[racine.nodeName] || (racine.closest && racine.closest('.JUM-IC,[data-emoji],svg'))) return;
        if (!RE_TEST.test(racine.textContent || '')) return;
        var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, { acceptNode: function(n) {
            var p = n.parentNode;
            if (!p || EXCLUS[p.nodeName] || (p.closest && p.closest('.JUM-IC,[data-emoji],svg,select,textarea'))) return NodeFilter.FILTER_REJECT;
            return RE_TEST.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        } });
        var liste = [], n;
        while ((n = w.nextNode())) liste.push(n);
        liste.forEach(remplacer);
    }
    window.JUMELAGE_ICONISER = iconiser;
    function demarrerIcones() {
        iconiser(document.body);
        if (!window.MutationObserver) return;
        new MutationObserver(function(muts) {
            muts.forEach(function(m) {
                if (m.type === 'characterData') iconiser(m.target);
                else Array.prototype.forEach.call(m.addedNodes, iconiser);
            });
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (document.body) demarrerIcones(); else document.addEventListener('DOMContentLoaded', demarrerIcones);

    // ---------- Démonstrations (les deux applis) : pastille, mascotte et bulle ----------
    // Téléphone : la mascotte et sa bulle restent en haut de l'écran, sous la pastille « Démonstration ».
    // PC : mascotte en grand, placée dans l'espace le plus libre de l'écran, sans jamais couvrir une zone mise en avant.
    var demo = null;
    function demoPc() { return window.matchMedia && matchMedia('(min-width: 1100px)').matches; }
    function demoConstruire(o) {
        if (demo) return demo;
        demo = { pastille: document.createElement('div'), guide: document.createElement('div'), o: o };
        demo.pastille.className = 'JDEMO-PASTILLE';
        demo.pastille.innerHTML = '<i></i><span>Démonstration</span><b class="JDEMO-NUM"></b><button type="button" class="JDEMO-QUITTER">Quitter</button>';
        demo.guide.className = 'JDEMO-GUIDE';
        demo.guide.innerHTML = '<img class="JDEMO-MASCOTTE" src="demo-mascotte.webp" alt="">' +
            '<div class="JDEMO-BULLE"><div class="JDEMO-ETAPE"></div><div class="JDEMO-TITRE"></div><div class="JDEMO-TEXTE"></div>' +
            '<div class="JDEMO-NAV"><button type="button" class="JDEMO-PREC">← Revoir</button><div class="JDEMO-POINTS"></div><button type="button" class="JDEMO-SUIV">Suivant →</button></div></div>';
        document.body.appendChild(demo.pastille); document.body.appendChild(demo.guide);
        demo.pastille.querySelector('.JDEMO-QUITTER').addEventListener('click', function() { if (demo.o.quitter) demo.o.quitter(); });
        demo.guide.querySelector('.JDEMO-PREC').addEventListener('click', function() { if (demo.o.prec) demo.o.prec(); });
        demo.guide.querySelector('.JDEMO-SUIV').addEventListener('click', function() { if (demo.o.suiv) demo.o.suiv(); });
        var replacer = function() { if (demo) demoPlacer(); };
        window.addEventListener('resize', replacer);
        window.addEventListener('scroll', function() { clearTimeout(demo && demo.t); if (demo) demo.t = setTimeout(replacer, 120); }, { passive: true });
        return demo;
    }
    // Réserve la place de la pastille (et, sur téléphone, de la bulle) en haut de la page.
    function demoEspace() {
        var h = demoPc() ? Math.ceil(demo.pastille.getBoundingClientRect().bottom) + 14 : Math.ceil(demo.guide.getBoundingClientRect().bottom) + 10;
        document.documentElement.style.setProperty('--demo-bandeau-h', h + 'px');
        document.documentElement.style.scrollPaddingTop = h + 'px';
    }
    function demoPlacer() {
        var g = demo.guide;
        g.style.left = g.style.right = g.style.top = g.style.bottom = '';
        if (!demoPc()) { g.className = 'JDEMO-GUIDE tel'; demoEspace(); return; }
        var marge = 16, zones = [];
        Array.prototype.forEach.call(document.querySelectorAll('.demo-zone, .demo-spotlight, .PC-RECAP'), function(e) {
            var r = e.getBoundingClientRect();
            if (r.width && r.height && r.bottom > 0 && r.top < innerHeight) zones.push({ l: r.left - marge, t: r.top - marge, r: r.right + marge, b: r.bottom + marge, fort: !e.classList.contains('PC-RECAP') });
        });
        var menu = document.querySelector('.PC-MENU'), g0 = menu && menu.getBoundingClientRect().width ? menu.getBoundingClientRect().right : 0;
        var essais = [['droite', 'ligne'], ['gauche', 'ligne'], ['droite', 'colonne'], ['gauche', 'colonne']], meilleur = null;
        for (var i = 0; i < essais.length; i++) {
            g.className = 'JDEMO-GUIDE pc ' + essais[i][1] + (essais[i][0] === 'droite' ? ' droite' : '');
            g.style.left = g.style.right = ''; g.style.bottom = '0px';
            if (essais[i][0] === 'droite') g.style.right = '18px'; else g.style.left = (g0 + 18) + 'px';
            var r = g.getBoundingClientRect(), gene = 0;
            zones.forEach(function(z) {
                var w = Math.min(r.right, z.r) - Math.max(r.left, z.l), h = Math.min(r.bottom, z.b) - Math.max(r.top, z.t);
                if (w > 0 && h > 0) gene += w * h * (z.fort ? 10 : 1);
            });
            if (r.left < g0 || r.top < 60) gene += 1e9;
            if (!meilleur || gene < meilleur.gene) meilleur = { i: i, gene: gene };
            if (!gene) break;
        }
        var e = essais[meilleur.i];
        g.className = 'JDEMO-GUIDE pc ' + e[1] + (e[0] === 'droite' ? ' droite' : '');
        g.style.left = g.style.right = ''; g.style.bottom = '0px';
        if (e[0] === 'droite') g.style.right = '18px'; else g.style.left = (g0 + 18) + 'px';
        demoEspace();
    }
    // o : { etape, total, titre, texte, derniere, prec, suiv, quitter }
    window.JUMELAGE_DEMO_MAJ = function(o) {
        demoConstruire(o); demo.o = o;
        document.body.classList.add('jdemo');
        // Page pleine largeur (Compte-rendu) : sur PC, une colonne est libérée à droite pour la mascotte.
        document.body.classList.toggle('jdemo-reserve', !!o.reserveDroite);
        demo.pastille.querySelector('.JDEMO-NUM').textContent = o.etape + ' / ' + o.total;
        demo.guide.querySelector('.JDEMO-ETAPE').textContent = 'Étape ' + o.etape + ' sur ' + o.total;
        demo.guide.querySelector('.JDEMO-TITRE').textContent = o.titre || '';
        demo.guide.querySelector('.JDEMO-TEXTE').textContent = o.texte || '';
        var pts = ''; for (var i = 1; i <= o.total; i++) pts += '<span' + (i === o.etape ? ' class="a"' : '') + '></span>';
        demo.guide.querySelector('.JDEMO-POINTS').innerHTML = pts;
        var prec = demo.guide.querySelector('.JDEMO-PREC'); prec.disabled = o.etape === 1;
        demo.guide.querySelector('.JDEMO-SUIV').textContent = o.derniere ? 'Recommencer ↻' : 'Suivant →';
        demo.guide.classList.remove('JDEMO-ENTREE'); void demo.guide.offsetWidth; demo.guide.classList.add('JDEMO-ENTREE');
        demoPlacer();
        // La page défile vers la zone expliquée : on replace la mascotte une fois le défilement fini.
        setTimeout(function() { if (demo) demoPlacer(); }, 500);
        setTimeout(function() { if (demo) demoPlacer(); }, 1100);
    };
    window.JUMELAGE_DEMO_ESPACE = function() { return demo ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--demo-bandeau-h'), 10) || 0 : 0; };

    // ---------- Partager TRIGONE (roue crantée de l'écran de choix) : QR code et lien de l'application ----------
    // Pour installer TRIGONE sur un autre téléphone : il scanne le QR code (appareil photo), ou reçoit le lien.
    var fenPartage = null;
    window.JUMELAGE_FERMER_PARTAGE = function() { if (fenPartage) { fenPartage.remove(); fenPartage = null; } }; fermeurs.push([function() { return fenPartage; }, window.JUMELAGE_FERMER_PARTAGE]);
    window.JUMELAGE_PARTAGER_APPLI = function() {
        if (fenPartage || !document.body) return;
        var lien = new URL(APPLIS.mer.url, location.href).href.split(/[?#]/)[0];
        if (!document.getElementById('JUM-PARTAGE-CSS')) {
            var st = document.createElement('style'); st.id = 'JUM-PARTAGE-CSS';
            st.textContent = '.JUM-PARTAGE{position:fixed;inset:0;z-index:100050;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.62);overflow-y:auto}' +
                '.JUM-PART-CARTE{position:relative;width:100%;max-width:380px;margin:auto;background:#fff;color:#1a1a1a;border-radius:18px;padding:22px 20px 18px;box-shadow:0 20px 50px rgba(0,0,0,.3);text-align:center;font-family:inherit}' +
                '.JUM-PART-CARTE h3{margin:0 0 6px;font-size:1.05em;letter-spacing:.04em;text-transform:uppercase}' +
                '.JUM-PART-CARTE p{margin:0 0 12px;font-size:.84em;line-height:1.45;color:#475569}' +
                '.JUM-PART-QR{display:inline-flex;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;min-width:200px;min-height:200px;align-items:center;justify-content:center}' +
                '.JUM-PART-QR img,.JUM-PART-QR canvas{display:block;width:200px;height:200px}' +
                '.JUM-PART-LIEN{display:block;margin:12px 0 4px;padding:10px 12px;border-radius:10px;background:#f1f5f9;color:#1d4ed8;font-size:.8em;word-break:break-all;text-decoration:underline;user-select:all}' +
                '.JUM-PART-BTNS{display:flex;flex-direction:column;gap:8px;margin-top:12px}' +
                '.JUM-PART-BTNS button{padding:12px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:#1a1a1a;font:inherit;font-weight:800;font-size:.8em;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}' +
                '.JUM-PART-BTNS button.principal{background:#1a1a1a;color:#fff;border-color:#1a1a1a}' +
                '.JUM-PART-ETAT{min-height:1.2em;font-size:.78em;color:#15803d;font-weight:700;margin-top:6px}' +
                '.JUM-PART-FERMER{position:absolute;top:10px;right:10px;width:30px;height:30px;border:none;border-radius:8px;background:rgba(0,0,0,.07);font:inherit;font-weight:700;cursor:pointer;color:#475569}' +
                'body.dark-mode .JUM-PART-CARTE{background:#1f1f1f;color:#f5f5f5}body.dark-mode .JUM-PART-CARTE p{color:#a3a3a3}' +
                'body.dark-mode .JUM-PART-LIEN{background:#2a2a2a;color:#93c5fd}body.dark-mode .JUM-PART-BTNS button{background:#2a2a2a;color:#f5f5f5;border-color:#404040}' +
                'body.dark-mode .JUM-PART-BTNS button.principal{background:#f5f5f5;color:#1a1a1a}body.dark-mode .JUM-PART-FERMER{background:rgba(255,255,255,.1);color:#a3a3a3}';
            document.head.appendChild(st);
        }
        fenPartage = document.createElement('div');
        fenPartage.className = 'JUM-PARTAGE';
        fenPartage.innerHTML = '<div class="JUM-PART-CARTE" role="dialog" aria-label="Partager TRIGONE">' +
            '<button type="button" class="JUM-PART-FERMER" aria-label="Fermer">✕</button>' +
            '<h3>Partager TRIGONE</h3>' +
            '<p>Faites scanner ce QR code avec l\'appareil photo du téléphone : TRIGONE s\'ouvre, puis « Installer » (ou « Ajouter à l\'écran d\'accueil »).</p>' +
            '<div class="JUM-PART-QR" aria-label="QR code de l\'application TRIGONE"></div>' +
            '<p style="margin:12px 0 0;">Pas de lecteur de QR code ? Envoyez-lui ce lien :</p>' +
            '<a class="JUM-PART-LIEN" target="_blank" rel="noopener"></a>' +
            '<div class="JUM-PART-ETAT"></div>' +
            '<div class="JUM-PART-BTNS">' + (navigator.share ? '<button type="button" class="principal" data-a="partager">Partager le lien…</button>' : '') +
            '<button type="button"' + (navigator.share ? '' : ' class="principal"') + ' data-a="copier">Copier le lien</button>' +
            '<button type="button" data-a="mail">Envoyer par mail</button></div></div>';
        var a = fenPartage.querySelector('.JUM-PART-LIEN'); a.href = lien; a.textContent = lien;
        var etat = fenPartage.querySelector('.JUM-PART-ETAT');
        fenPartage.addEventListener('click', function(ev) {
            if (ev.target === fenPartage || ev.target.closest('.JUM-PART-FERMER')) { window.JUMELAGE_FERMER_PARTAGE(); return; }
            var b = ev.target.closest('button[data-a]'); if (!b) return;
            var quoi = b.getAttribute('data-a'), texte = 'TRIGONE — ordre de mission et compte-rendu de mission. Ouvrez ce lien, puis « Installer » : ';
            if (quoi === 'partager') navigator.share({ title: 'TRIGONE', text: texte, url: lien }).catch(function() {});
            else if (quoi === 'mail') window.location.href = 'mailto:?subject=' + encodeURIComponent('Application TRIGONE') + '&body=' + encodeURIComponent(texte + '\n' + lien);
            else {
                var ok = function() { etat.textContent = 'Lien copié.'; };
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lien).then(ok, function() { etat.textContent = 'Copie impossible : sélectionnez le lien ci-dessus.'; });
                else etat.textContent = 'Sélectionnez le lien ci-dessus pour le copier.';
            }
        });
        document.body.appendChild(fenPartage);
        // QR code : bibliothèque locale (mise en cache pour le hors ligne) ; sans elle, le lien suffit.
        var dessiner = function() {
            var box = fenPartage && fenPartage.querySelector('.JUM-PART-QR'); if (!box) return;
            try { new window.QRCode(box, { text: lien, width: 400, height: 400, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); box.removeAttribute('title'); }
            catch (e) { box.textContent = 'QR code indisponible : utilisez le lien.'; }
        };
        if (window.QRCode) dessiner();
        else {
            var sc = document.createElement('script');
            sc.src = (DANS_CR ? '../' : '') + 'vendor/qrcode.min.js';
            sc.onload = dessiner;
            sc.onerror = function() { var box = fenPartage && fenPartage.querySelector('.JUM-PART-QR'); if (box) box.textContent = 'QR code indisponible hors ligne : utilisez le lien.'; };
            document.head.appendChild(sc);
        }
    };

    // ---------- Signaler un problème (écran de choix et les deux applis) ----------
    var MAIL_SUPPORT = 'trigone.app@outlook.fr';
    // Phénix (casque d'assistance) présente le signalement, puis la messagerie s'ouvre avec les informations utiles.
    window.JUMELAGE_SIGNALER = function(ecran) {
        if (document.querySelector('.JUM-SIG')) return;
        var f = document.createElement('div');
        f.className = 'JUM-SIG'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Signaler un problème');
        f.innerHTML = '<div class="JUM-SIG-CARTE"><img class="JUM-SIG-MASCOTTE" src="' + (DANS_CR ? '../' : '') + 'mascotte-assistance.webp" alt="">' +
            '<h2>Un souci avec TRIGONE ?</h2><p>Décrivez-le à l\'équipe : votre messagerie s\'ouvre avec la version et le type d\'appareil déjà indiqués.</p>' +
            '<div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-SECOND">Annuler</button><button type="button" class="JUM-R-PRINCIPAL">Écrire à l\'équipe</button></div></div>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { f.addEventListener(t, function(e) { e.stopPropagation(); }); });
        var fermer = function() { f.remove(); };
        f.addEventListener('click', function(e) { if (e.target === f) fermer(); });
        f.querySelector('.JUM-R-SECOND').addEventListener('click', fermer);
        f.querySelector('.JUM-R-PRINCIPAL').addEventListener('click', function() { fermer(); ecrireSignalement(ecran); });
        document.body.appendChild(f);
    };
    function ecrireSignalement(ecran) {
        var appli = ecran === 'choix' ? 'Écran de choix des applis' : (DANS_CR ? 'Compte-rendu de mission' : 'Mise en route');
        var v = window.APP_VERSION_AFFICHEE || (typeof APP_VERSION_AFFICHEE !== 'undefined' ? APP_VERSION_AFFICHEE : '');
        var sujet = 'TRIGONE - Signalement (' + (DANS_CR ? 'Compte-rendu' : 'Mise en route') + (v ? ' V' + v : '') + ')';
        var corps = 'Décrivez ici ce qui s\'est passé :\n\n\n\n---\n' +
            'Appli : ' + appli + '\n' + (v ? 'Version TRIGONE : V' + v + '\n' : '') +
            (ecran && ecran !== 'choix' ? 'Écran concerné : ' + ecran + '\n' : '') +
            'Appareil : ' + (window.matchMedia && matchMedia('(min-width: 1100px)').matches ? 'ordinateur' : 'téléphone / tablette') + '\n' +
            'Connecté à internet : ' + (navigator.onLine ? 'oui' : 'non') + '\n' + window.JUMELAGE_INFOS_ECRAN();
        window.location.href = 'mailto:' + MAIL_SUPPORT + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
    }

    // ---------- Carte TRIGONE (Paramètres › Compte › Ma carte TRIGONE) ----------
    // Recto : photo (gardée sur l'appareil), identité de Mon profil, hologramme qui suit le téléphone. Verso : QR code
    // (adresse de l'appli + identifiant de carte tiré au hasard par le serveur) : un autre compte TRIGONE le scanne pour
    // ajouter la personne à une mission collective, la désigner comme valideur, remplaçant…, ou la pointer au départ ;
    // l'appareil photo d'un téléphone ouvre la page de vérification. « Afficher en grand » : le téléphone devient la carte.
    var CLE_CARTE = 'trigone_carte', CLE_CARTE_PHOTO = 'trigone_carte_photo', fenCarte = null;
    function carteIdentite() {
        var r = lireReglages(), roles = rolesLocaux();
        var n = 0; try { n = parseInt(localStorage.getItem('trigone_cr_envoyes_total') || '0', 10) || 0; } catch (e) {}
        return { grade: r.grade || '', nom: (r.nom || '').toUpperCase(), prenom: r.prenom || '', unite: r.unite || '', cie: r.cie || '', nid: r.matricule || '', missions: n,
            roles: (function(l) { return l.length ? l : ['MISSIONNAIRE']; })([].concat(roles.valideur1 ? ['VALIDEUR 1'] : [], roles.valideur2 ? ['VALIDEUR 2'] : [], roles.chorus ? ['CHORUS DT'] : [])) };
    }
    // Identifiant de la carte (serveur) : demandé une fois, renvoyé quand Mon profil change (même identifiant).
    window.JUMELAGE_CARTE_ID = function(dForm) {
        var memo = lireJSON(CLE_CARTE) || {}, d = dForm || carteIdentite();
        var sig = [d.grade, d.nom, d.prenom, d.unite, d.cie, d.nid].join('|');
        if (!monCompte()) return Promise.resolve(null);
        if (memo.id && memo.sig === sig && memo.mail === monCompte().mail) return Promise.resolve(memo);
        if (!navigator.onLine) return Promise.resolve(memo.id && memo.mail === monCompte().mail ? memo : null);
        return appelApi('carte', { methode: 'POST', corps: d }).then(function(r) {
            var m = { id: r.id, depuis: r.depuis, sig: sig, mail: monCompte().mail }; ecrireTxt(CLE_CARTE, JSON.stringify(m)); return m;
        }, function() { return memo.id ? memo : null; });
    };
    function lienCarte(id) { return location.origin + racineAppli + '?carte=' + encodeURIComponent(id); }
    function chargerScript(nom, test) {
        if (test()) return Promise.resolve();
        return new Promise(function(ok, ko) {
            var sc = document.createElement('script'); sc.src = (DANS_CR ? '../' : '') + 'vendor/' + nom;
            sc.onload = function() { ok(); }; sc.onerror = function() { ko(new Error('Module indisponible hors connexion.')); };
            document.head.appendChild(sc);
        });
    }
    function mrz(d) {
        var t = function(v, n) { return (String(v || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '<') + '<'.repeat(n)).slice(0, n); };
        var l1 = t('TRGN<' + d.unite + '<<' + d.nom + '<<' + d.prenom, 34);
        var c = String(d.nid || '').replace(/\D/g, '').slice(0, 10), s = 0; for (var i = 0; i < c.length; i++) s += (+c[i]) * [7, 3, 1][i % 3];
        return [l1, t(c + '<' + d.grade.slice(0, 3) + '<' + d.cie, 33) + (s % 10)];
    }
    // Carte qui évolue : liseré bronze (1 compte-rendu envoyé), argent (10), or (20), comme les médailles.
    function niveauCarte(n) { return n >= 20 ? ['or', 'OR'] : n >= 10 ? ['argent', 'ARGENT'] : n >= 1 ? ['bronze', 'BRONZE'] : ['', '']; }
    // photo : la sienne si absente ; '' = pas de photo (initiales de la personne à la place, carte d'un participant).
    function carteRecto(d, photo) {
        var autre = arguments.length > 1; if (!autre) photo = lireTxt(CLE_CARTE_PHOTO);
        var m = mrz(d), base = DANS_CR ? '../' : '', niv = niveauCarte(d.missions || 0);
        return '<div class="JUM-CARTE recto' + (niv[0] ? ' niv-' + niv[0] : '') + '"><i class="JUM-CARTE-GUIL"></i><img class="JUM-CARTE-FILI" src="' + base + 'phoenix-icon.png" alt=""><i class="JUM-CARTE-HOLO"></i>' +
            '<div class="JUM-CARTE-HAUT"><img src="' + base + 'phoenix-icon.png" alt=""><div class="t">TRIGONE<small>CARTE D\'IDENTITÉ · MISSIONS</small></div>' +
                '<div class="drap"><i></i>' + esc(d.unite || 'TRIGONE') + '</div></div>' +
            '<div class="JUM-CARTE-PHOTO">' + (photo ? '<img src="' + photo + '" alt="Photo">' : autre ? '<span class="JUM-CARTE-INIT">' + esc(((d.nom || '?').charAt(0) + (d.prenom || '').charAt(0)).toUpperCase()) + '</span>'
                : '<span>' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('personne') : '') + '<b>Ajouter<br>ma photo</b></span>') + '</div>' +
            '<i class="JUM-CARTE-PUCE"></i>' +
            '<div class="JUM-CARTE-CHAMPS"><div class="l"><small>NOM · PRÉNOM</small>' + esc((d.nom + ' ' + d.prenom).trim() || '—') + '</div>' +
                '<div><small>GRADE</small>' + esc(d.grade || '—') + '</div><div><small>NID</small>' + esc(d.nid || '—') + '</div>' +
                '<div><small>UNITÉ</small>' + esc([d.unite, d.cie].filter(Boolean).join(' · ') || '—') + '</div><div><small>MISSIONS</small>' + (d.missions == null ? '—' : d.missions) + (niv[1] ? ' <em class="niv">' + niv[1] + '</em>' : '') + '</div></div>' +
            '<div class="JUM-CARTE-MRZ">' + esc(m[0]) + '<br>' + esc(m[1]) + '</div></div>';
    }
    // ---------- Photo de carte partagée, chiffrée de bout en bout ----------
    // Chiffrée ici pour les appareils des VALIDEUR 1 / 2, ASSIST CHORUS DT et chefs de mission collective où je suis
    // participant (clés publiques données par le serveur) ; le serveur ne garde qu'un bloc illisible. Rechiffrée quand
    // la photo ou la liste des appareils change (nouveau valideur, rôle retiré), vérifié toutes les 5 minutes.
    var CLE_PHOTO_PARTAGE = 'trigone_photo_partage', CLE_PHOTO_SIG = 'trigone_photo_sig', photoEnCours = null;
    function photoPartagee() { return lireTxt(CLE_PHOTO_PARTAGE) === '1'; }
    window.JUMELAGE_PHOTO_SYNCHRO = function(force) {
        if (!monCompte() || !navigator.onLine || !SUBTLE) return Promise.resolve('');
        if (photoEnCours) return photoEnCours;
        var memo = lireJSON(CLE_PHOTO_SIG) || {}, photo = lireTxt(CLE_CARTE_PHOTO);
        // v2 : photo aussi chiffrée pour mes autres appareils ; rechiffrée tout de suite après la mise à jour.
        if (memo.v !== 2) { force = true; memo = {}; }
        if (!force && memo.le && Date.now() - memo.le < 5 * 60000) return Promise.resolve('');   // nouveau valideur, appareil ajouté : la photo le rejoint en 5 minutes au plus
        if (!photoPartagee() || !photo) {
            if (!memo.sig && !force) return Promise.resolve('');
            photoEnCours = appelApi('photo', { methode: 'DELETE' }).then(function() { ecrireTxt(CLE_PHOTO_SIG, JSON.stringify({ v: 2, le: Date.now() })); photoEnCours = null; return 'retiree'; }, function() { photoEnCours = null; return ''; });
            return photoEnCours;
        }
        photoEnCours = appelApi('photo/destinataires').then(function(r) {
            var ap = r.appareils || [];
            return SUBTLE.digest('SHA-256', new TextEncoder().encode(photo + '|' + ap.map(function(a) { return a.id; }).sort().join(','))).then(function(h) {
                var sig = versB64(h);
                if (sig === memo.sig && !force) { ecrireTxt(CLE_PHOTO_SIG, JSON.stringify({ v: 2, sig: sig, le: Date.now() })); return ''; }
                return chiffrerPour(ap, photo).then(function(c) {
                    return appelApi('photo', { methode: 'POST', corps: { donnees: c.donnees, enveloppes: c.enveloppes } });
                }).then(function() { ecrireTxt(CLE_PHOTO_SIG, JSON.stringify({ v: 2, sig: sig, le: Date.now() })); return 'ok'; });
            });
        }).then(function(x) { photoEnCours = null; return x; }, function() { photoEnCours = null; return ''; });
        return photoEnCours;
    };
    // Cartes des personnes d'une demande : carte vérifiée par le serveur (ou non) et photo déchiffrée si cet appareil en a la clé.
    window.JUMELAGE_PARTICIPANTS = function(personnes, mailDemandeur) {
        var liste = (personnes || []).map(function(p, i) { return { nid: p.matricule || p.nid || '', mail: i === 0 ? (mailDemandeur || '') : '' }; });
        if (!monCompte() || !navigator.onLine) return Promise.resolve(null);
        return appelApi('participants', { methode: 'POST', corps: { personnes: liste } }).then(function(r) {
            return Promise.all((r.personnes || []).map(function(x) {
                // Ma propre carte : la photo de cet appareil, si elle y est (et que je la partage, ou que je me regarde).
                var locale = x.moi ? lireTxt(CLE_CARTE_PHOTO) : '';
                if (locale) { x.photoUrl = locale; return Promise.resolve(x); }
                if (!x.photo || !x.photo.donnees) return Promise.resolve(x);
                return dechiffrer(x.photo.enveloppe, x.photo.donnees).then(function(url) { x.photoUrl = /^data:image\//.test(url) ? url : ''; return x; }, function() { return x; });
            }));
        });
    };
    // Fenêtre « Participants » : onglets Demande / Participants, une carte TRIGONE par personne.
    // info : { titre, sous, badges (HTML), lignes: [[libellé, valeur]], personnes, mailDemandeur, collectif }
    window.JUMELAGE_PARTICIPANTS_OUVRIR = function(info) {
        var vieux = document.querySelector('.JUM-PART-FOND'); if (vieux) vieux.remove();
        var f = document.createElement('div'); f.className = 'JUM-PART-FOND'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Participants');
        var pers = info.personnes || [];
        var carteDe = function(p, x, i) {
            var c = x && x.carte, d = { grade: (c && c.grade) || p.grade || '', nom: ((c && c.nom) || p.nom || '').toUpperCase(), prenom: (c && c.prenom) || p.prenom || '',
                unite: (c && c.unite) || p.unite || '', cie: (c && c.cie) || p.cie || '', nid: (c && c.nid) || p.matricule || p.nid || '', missions: null };
            var etat = !x ? ['att', navigator.onLine ? 'Vérification…' : 'Hors ligne : carte non vérifiée']
                : x.erreur ? ['att', 'Vérification impossible pour l\'instant']
                : !x.compte ? ['ko', '✖ Pas de compte TRIGONE à ce matricule']
                : !c ? ['ko', '✖ Pas de carte TRIGONE vérifiée']
                : ['ok', '✔ Carte TRIGONE vérifiée' + (c.depuis ? ' · depuis le ' + new Date(c.depuis).toLocaleDateString('fr-FR') : '') +
                    (x.photoUrl ? ' · 🔒 photo chiffrée' : x.photo && x.photo.partagee ? ' · photo pas encore disponible sur cet appareil' : ' · photo non partagée')];
            return '<div class="JUM-PART-UN"><p class="JUM-PART-ROLE">' + (i === 0 ? (info.collectif ? 'CHEF DE MISSION' : 'MISSIONNAIRE') : 'PARTICIPANT') + '</p>' +
                '<button type="button" class="JUM-PART-CARTE" data-i="' + i + '" aria-label="Afficher la carte en grand">' + carteRecto(d, (x && x.photoUrl) || '') + '</button>' +
                '<div class="JUM-PART-ETAT ' + etat[0] + '">' + etat[1] + '</div></div>';
        };
        var resultats = null, onglet = 'part';
        var dessiner = function() {
            f.innerHTML = '<div class="JUM-PART-FEN"><div class="JUM-PART-TETE"><span class="ic">📋</span><div><b>' + esc(info.titre || 'Demande de mise en route') + '</b><small>' + (info.sous ? esc(info.sous) : '') + (info.badges ? ' ' + info.badges : '') + '</small></div>' +
                    '<button type="button" class="JUM-PART-X" aria-label="Fermer">✕</button></div>' +
                '<div class="JUM-PART-ONG"><button type="button" data-o="dem"' + (onglet === 'dem' ? ' class="on"' : '') + '>Demande</button><button type="button" data-o="part"' + (onglet === 'part' ? ' class="on"' : '') + '>👥 Participants (' + pers.length + ')</button></div>' +
                (onglet === 'dem' ? '<div class="JUM-PART-DEM">' + (info.lignes || []).map(function(l) { return '<div><small>' + esc(l[0]) + '</small>' + esc(l[1] || '—') + '</div>'; }).join('') + '</div>'
                    : '<div class="JUM-PART-GRILLE">' + pers.map(function(p, i) { return carteDe(p, resultats && resultats[i], i); }).join('') + '</div>' +
                      '<p class="JUM-PART-PIED">Photos chiffrées de bout en bout : visibles seulement sur les appareils des valideurs, des assistants Chorus DT et du chef de mission, si la personne a choisi de la partager (Ma carte). Touchez une carte pour l\'afficher en grand.</p>') + '</div>';
            f.querySelector('.JUM-PART-X').addEventListener('click', function() { f.remove(); });
            Array.prototype.forEach.call(f.querySelectorAll('.JUM-PART-ONG button'), function(b) { b.addEventListener('click', function() { onglet = b.getAttribute('data-o'); dessiner(); }); });
            Array.prototype.forEach.call(f.querySelectorAll('.JUM-PART-CARTE'), function(b) {
                b.addEventListener('click', function() {
                    var g = document.createElement('div'); g.className = 'JUM-PART-GRAND'; g.innerHTML = b.innerHTML + '<p>Touchez pour fermer</p>';
                    g.addEventListener('click', function() { g.remove(); }); document.body.appendChild(g);
                });
            });
        };
        f.addEventListener('click', function(e) { if (e.target === f) f.remove(); });
        dessiner(); document.body.appendChild(f);
        window.JUMELAGE_PARTICIPANTS(pers, info.mailDemandeur).then(function(r) { resultats = r || pers.map(function() { return null; }); if (document.body.contains(f)) dessiner(); },
            function() { resultats = pers.map(function() { return { erreur: true }; }); if (document.body.contains(f)) dessiner(); });
    };
    // Registre : toucher un nom ouvre le recto seul de sa carte (identité, photo si partagée) ; ni verso ni QR code.
    window.JUMELAGE_CARTE_RECTO = function(info, i) {
        var pers = info.personnes || [], p = pers[i]; if (!p) return;
        var vieux = document.querySelector('.JUM-PART-GRAND'); if (vieux) vieux.remove();
        var g = document.createElement('div'); g.className = 'JUM-PART-GRAND';
        var dessiner = function(x) {
            var c = x && x.carte, d = { grade: (c && c.grade) || p.grade || '', nom: ((c && c.nom) || p.nom || '').toUpperCase(), prenom: (c && c.prenom) || p.prenom || '',
                unite: (c && c.unite) || '', cie: (c && c.cie) || '', nid: (c && c.nid) || p.matricule || '', missions: null };
            var etat = !x ? (navigator.onLine ? 'Vérification…' : 'Hors ligne : carte non vérifiée') : x.erreur ? 'Vérification impossible pour l\'instant'
                : !x.compte ? '✖ Pas de compte TRIGONE à ce matricule' : !c ? '✖ Pas de carte TRIGONE vérifiée' : '✔ Carte TRIGONE vérifiée' + (x.photoUrl ? '' : ' · photo non partagée');
            g.innerHTML = carteRecto(d, (x && x.photoUrl) || '') + '<p>' + esc(etat) + ' — touchez pour fermer</p>';
        };
        dessiner(null);
        g.addEventListener('click', function() { g.remove(); }); document.body.appendChild(g);
        window.JUMELAGE_PARTICIPANTS(pers, info.mailDemandeur).then(function(r) { if (document.body.contains(g)) dessiner((r || [])[i] || { erreur: true }); },
            function() { if (document.body.contains(g)) dessiner({ erreur: true }); });
    };
    function carteVerso(d, memo) {
        var depuis = memo && memo.depuis ? new Date(memo.depuis).toLocaleDateString('fr-FR') : '', niv = niveauCarte(d.missions);
        return '<div class="JUM-CARTE verso' + (niv[0] ? ' niv-' + niv[0] : '') + '"><i class="JUM-CARTE-GUIL"></i><i class="JUM-CARTE-HOLO"></i><i class="JUM-CARTE-BANDE"></i>' +
            '<div class="JUM-CARTE-QR">' + (memo && memo.id ? '' : '<span>' + (monCompte() ? 'QR code à la prochaine connexion à internet' : 'Connectez-vous à votre compte TRIGONE pour activer le QR code') + '</span>') + '</div>' +
            '<div class="JUM-CARTE-INFO"><div class="t">SCANNEZ POUR M\'AJOUTER</div>à une mission collective, comme valideur ou remplaçant : <b>compte TRIGONE</b> repris d\'un coup.' +
                '<div class="t">RÔLES</div><div class="roles">' + d.roles.map(function(x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
                '<div class="t">COMPTE</div>' + (memo && memo.id ? '<b>✔ Vérifié</b>' + (depuis ? ' · depuis le ' + depuis : '') : 'Non connecté') + '</div>' +
            '<div class="JUM-CARTE-SIGN">SIGNATURE DU TITULAIRE<i>' + esc((d.prenom ? d.prenom.charAt(0) + '. ' : '') + (d.nom ? d.nom.charAt(0) + d.nom.slice(1).toLowerCase() : '')) + '</i></div></div>';
    }
    // QR code dessiné dans le verso (bibliothèque déjà livrée avec l'appli).
    function dessinerQR(boite, id) {
        if (!boite || !id) return;
        chargerScript('qrcode.min.js', function() { return !!window.QRCode; }).then(function() {
            boite.innerHTML = '';
            try { new window.QRCode(boite, { text: lienCarte(id), width: 300, height: 300, colorDark: '#111111', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); boite.removeAttribute('title'); } catch (e) {}
        }, function() {});
    }
    // Hologramme : le reflet suit l'inclinaison du téléphone (ou la souris), sinon il passe lentement.
    var holoActif = false;
    function suivreHolo() {
        if (holoActif) return; holoActif = true;
        var poser = function(x) { document.documentElement.style.setProperty('--jum-holo', (Math.max(-1, Math.min(1, x)) * 60 + 50) + '%'); };
        window.addEventListener('deviceorientation', function(e) { if (e.gamma != null) { document.documentElement.classList.add('jum-holo-capteur'); poser(e.gamma / 35); } });
        window.addEventListener('pointermove', function(e) { if (e.pointerType === 'mouse') { document.documentElement.classList.add('jum-holo-capteur'); poser(e.clientX / window.innerWidth * 2 - 1); } });
    }
    // Ajuste la carte (350 × 221 à l'échelle 1) à la largeur disponible.
    function ajusterCarte(zone, max) {
        var c = zone.querySelector('.JUM-CARTE-TOURNE'); if (!c) return;
        var e = Math.min(max || 1.2, (zone.clientWidth || 350) / 350);
        c.style.transform = 'scale(' + e + ')'; zone.style.height = Math.round(221 * e) + 'px';
    }
    window.JUMELAGE_FERMER_CARTE = function() { if (fenCarte) { fenCarte.remove(); fenCarte = null; } };
    fermeurs.push([function() { return fenCarte; }, window.JUMELAGE_FERMER_CARTE]);
    window.JUMELAGE_CARTE = function() {
        if (!document.body) return;
        window.JUMELAGE_FERMER_CARTE();
        suivreHolo();
        var d = carteIdentite(), memo = lireJSON(CLE_CARTE), tel = surTelephone();
        if (memo && monCompte() && memo.mail !== monCompte().mail) memo = null;
        fenCarte = document.createElement('div');
        fenCarte.className = 'JUM-REGLAGES JUM-CARTE-FEN' + (tel ? '' : ' pc'); fenCarte.setAttribute('role', 'dialog'); fenCarte.setAttribute('aria-label', 'Ma carte TRIGONE');
        var dessiner = function() {
            var verso = fenCarte.querySelector('.JUM-CARTE-TOURNE.verso');
            fenCarte.innerHTML = '<div class="JUM-CARTE-PAGE"><div class="JUM-CARTE-TETE"><button type="button" class="JUM-CARTE-RET" aria-label="Fermer">‹</button>' +
                    '<div><b>Ma carte TRIGONE</b><small>Paramètres › Compte</small></div></div>' +
                (tel ? '<div class="JUM-CARTE-ZONE"><div class="JUM-CARTE-TOURNE' + (verso ? ' verso' : '') + '" role="button" tabindex="0" aria-label="Retourner la carte">' +
                    '<div class="face avant">' + carteRecto(d) + '</div><div class="face arriere">' + carteVerso(d, memo) + '</div></div></div>' +
                '<p class="JUM-CARTE-ASTUCE">↻ Touchez la carte pour la retourner</p>' +
                '<button type="button" class="JUM-R-PRINCIPAL JUM-CARTE-GRAND">⛶ Afficher en grand</button>'
                // PC : recto et verso côte à côte, sans retournement ni plein écran.
                : '<div class="JUM-CARTE-DUO"><div class="face avant">' + carteRecto(d) + '</div><div class="face arriere">' + carteVerso(d, memo) + '</div></div>') +
                '<div class="JUM-CARTE-BTNS"><button type="button" class="JUM-R-SECOND JUM-CARTE-PHOTO-BTN">' + (lireTxt(CLE_CARTE_PHOTO) ? 'Changer la photo' : 'Ajouter ma photo') + '</button>' +
                    '<button type="button" class="JUM-R-SECOND JUM-CARTE-PARTAGER">Partager</button></div>' +
                '<button type="button" class="JUM-R-SECOND JUM-CARTE-QRCO">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('qr') : '') + 'QR de connexion (autre appareil)</button>' +
                '<label class="JUM-CARTE-PARTPHOTO"><input type="checkbox" id="JUM-PHOTO-PARTAGE"' + (photoPartagee() ? ' checked' : '') + '><span><b>Partager ma photo avec les valideurs et l\'assistant Chorus DT</b>' +
                    '<small>Chiffrée de bout en bout : seuls leurs appareils (et le chef d\'une mission collective où vous êtes) peuvent la voir, sur votre carte, dans l\'onglet Participants de vos demandes.</small></span></label>' +
                '<p class="JUM-CARTE-NOTE">Remplie toute seule avec <b>Mon profil</b> (grade, nom, NID, unité). La photo reste <b>sur cet appareil</b>' + (photoPartagee() ? ' et ne part que chiffrée' : '') + '. ' +
                    'Le QR code ne contient qu\'un identifiant : il ne donne accès à rien, il permet seulement à un compte TRIGONE de vous retrouver.</p>' +
                (window.JUMELAGE_ADRESSE_CONNUE() ? '<div class="JUM-ADRESSE"><span>📥 Vos factures et billets : envoyez-les ou transférez-les à</span><b>' + esc(window.JUMELAGE_ADRESSE_CONNUE()) + '</b>' +
                    '<button type="button" class="JUM-R-SECOND JUM-ADRESSE-COPIER" onclick="JUMELAGE_COPIER_ADRESSE(this)">Copier</button><small>Ils arrivent chiffrés dans Boîte de réception › Justificatifs, prêts à joindre au compte-rendu.</small></div>' : '') +
                '<button type="button" class="JUM-R-LIEN JUM-CARTE-PROFIL">Modifier Mon profil</button>' +
                (memo && memo.id ? '<button type="button" class="JUM-R-LIEN JUM-CARTE-REVOQUER">Carte perdue ou volée ? Révoquer le QR code</button>' : '') + '</div>';
            if (memo && memo.id) dessinerQR(fenCarte.querySelector('.JUM-CARTE-QR'), memo.id);
            if (tel) {
                var zone = fenCarte.querySelector('.JUM-CARTE-ZONE'), tourne = fenCarte.querySelector('.JUM-CARTE-TOURNE');
                ajusterCarte(zone, 1.25);
                tourne.addEventListener('click', function() { tourne.classList.toggle('verso'); });
                fenCarte.querySelector('.JUM-CARTE-GRAND').addEventListener('click', function() { window.JUMELAGE_CARTE_GRAND(tourne.classList.contains('verso')); });
            }
            // Sa flèche ‹ : ramène aux Paramètres quand la carte en a été ouverte (sinon, ferme la carte).
            fenCarte.querySelector('.JUM-CARTE-RET').addEventListener('click', function() { if (fenCarte && fenCarte._depuisParam) revenirParametres(fenCarte); else window.JUMELAGE_FERMER_CARTE(); });
            fenCarte.querySelector('.JUM-CARTE-PHOTO-BTN').addEventListener('click', function() { choisirPhoto(function() { dessiner(); window.JUMELAGE_PHOTO_SYNCHRO(true); }); });
            fenCarte.querySelector('#JUM-PHOTO-PARTAGE').addEventListener('change', function() {
                ecrireTxt(CLE_PHOTO_PARTAGE, this.checked ? '1' : '');
                window.JUMELAGE_PHOTO_SYNCHRO(true).then(function(r) { if (r === 'ok') bandeau('Photo partagée, chiffrée : visible seulement par les valideurs et l\'assistant Chorus DT.'); else if (r === 'retiree') bandeau('Photo retirée : elle n\'est plus partagée.'); });
                dessiner();
            });
            fenCarte.querySelector('.JUM-CARTE-PARTAGER').addEventListener('click', function() { partagerCarte(d, memo); });
            fenCarte.querySelector('.JUM-CARTE-QRCO').addEventListener('click', qrConnexion);
            fenCarte.querySelector('.JUM-CARTE-PROFIL').addEventListener('click', function() { window.JUMELAGE_FERMER_CARTE(); window.JUMELAGE_REGLAGES({ vue: 'profil' }); });
            var rev = fenCarte.querySelector('.JUM-CARTE-REVOQUER');
            if (rev) rev.addEventListener('click', function() { revoquerCarte(function(m) { memo = m; dessiner(); }); });
        };
        dessiner();
        ['pointerdown', 'pointerup'].forEach(function(t) { fenCarte.addEventListener(t, function(ev) { ev.stopPropagation(); }); });
        document.body.appendChild(fenCarte);
        if (tel) ajusterCarte(fenCarte.querySelector('.JUM-CARTE-ZONE'), 1.25);
        window.JUMELAGE_CARTE_ID().then(function(m) {
            if (!fenCarte || !m || (memo && memo.id === m.id && memo.depuis === m.depuis)) return;
            memo = m; var v = fenCarte.querySelector('.face.arriere'); if (v) { v.innerHTML = carteVerso(d, memo); dessinerQR(v.querySelector('.JUM-CARTE-QR'), m.id); }
        });
    };
    // QR de connexion : connecter un autre appareil (PC, nouveau téléphone) à ce compte, avec toutes les données.
    // C'est un code de liaison en QR : 15 minutes, une seule fois. Le QR imprimé sur la carte, lui, ne connecte jamais
    // (il est fait pour être montré et scanné par les autres).
    function qrConnexion() {
        var f = document.createElement('div'); f.className = 'JUM-SIG JUM-QRCO'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'QR de connexion');
        f.innerHTML = '<div class="JUM-SIG-CARTE"><h2>QR de connexion</h2><p>Pour vous connecter sur un autre appareil (PC, nouveau téléphone), avec toutes vos données.</p>' +
            '<div class="JUM-QRCO-BOITE"><span class="JUM-QRCO-ETAT">Préparation…</span></div><div class="JUM-QRCO-CODE"></div>' +
            '<ol class="JUM-QRCO-ETAPES"><li>Sur l\'autre appareil : TRIGONE › <b>J\'ai déjà TRIGONE sur un autre appareil</b>.</li><li><b>Scanner le QR de connexion</b> (caméra), ou <b>Depuis une image</b> : faites une capture d\'écran de ce QR et choisissez-la.</li></ol>' +
            '<p class="JUM-QRCO-ALERTE">Valable <b>15 minutes</b>, une seule fois. Ne l\'envoyez à personne : il ouvre votre compte.</p>' +
            '<div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-SECOND JUM-QRCO-IMG" disabled>Enregistrer l\'image</button><button type="button" class="JUM-R-PRINCIPAL JUM-QRCO-FERMER">Fermer</button></div></div>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { f.addEventListener(t, function(e) { e.stopPropagation(); }); });
        var minuteur = null, fermer = function() { clearInterval(minuteur); f.remove(); };
        f.querySelector('.JUM-QRCO-FERMER').addEventListener('click', fermer);
        document.body.appendChild(f);
        var boite = f.querySelector('.JUM-QRCO-BOITE'), etat = f.querySelector('.JUM-QRCO-ETAT');
        window.JUMELAGE_LIAISON_CREER().then(function(r) {
            return chargerScript('qrcode.min.js', function() { return !!window.QRCode; }).then(function() {
                boite.innerHTML = ''; new window.QRCode(boite, { text: lienLiaison(r.code), width: 280, height: 280, colorDark: '#111111', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); boite.removeAttribute('title');
                var fin = r.expire || Date.now() + 15 * 60000, code = f.querySelector('.JUM-QRCO-CODE');
                var maj = function() { var s2 = Math.max(0, Math.round((fin - Date.now()) / 1000)); code.innerHTML = 'Ou le code <b>' + esc(r.code) + '</b> · encore ' + Math.floor(s2 / 60) + ' min ' + ('0' + s2 % 60).slice(-2); if (!s2) { clearInterval(minuteur); boite.classList.add('expire'); code.textContent = 'Expiré : fermez et recréez un QR.'; } };
                maj(); minuteur = setInterval(maj, 1000);
                if (r.sansPieces) f.querySelector('.JUM-QRCO-ALERTE').insertAdjacentHTML('beforeend', '<br>Pièces jointes trop lourdes : elles restent sur cet appareil.');
                var bimg = f.querySelector('.JUM-QRCO-IMG'); bimg.disabled = false;
                bimg.addEventListener('click', function() {
                    var c = boite.querySelector('canvas'), src = c ? c.toDataURL('image/png') : (boite.querySelector('img') || {}).src; if (!src) return;
                    var a = document.createElement('a'); a.href = src; a.download = 'TRIGONE - QR de connexion.png'; document.body.appendChild(a); a.click(); a.remove();
                });
            });
        }).catch(function(e) { etat.textContent = (e && e.message) || 'QR impossible : vérifiez la connexion.'; });
    }
    // Carte perdue, volée ou photographiée : l'ancien QR code devient « Carte non reconnue », un nouveau est créé.
    function revoquerCarte(apres) {
        var f = document.createElement('div'); f.className = 'JUM-SIG JUM-BIOC'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Révoquer le QR code');
        f.innerHTML = '<div class="JUM-SIG-CARTE"><div class="JUM-BIOC-ROND">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('qr') : '') + '</div>' +
            '<h2>Révoquer le QR code ?</h2><p>L\'ancien QR code ne marchera plus : scanné, il affichera « Carte non reconnue ». Votre carte reçoit aussitôt un nouveau QR code. Vos missions et votre compte ne changent pas.</p>' +
            '<div class="JUM-BIOC-ERR"></div><div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-SECOND">Annuler</button><button type="button" class="JUM-R-PRINCIPAL">Révoquer</button></div></div>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { f.addEventListener(t, function(e) { e.stopPropagation(); }); });
        f.querySelector('.JUM-R-SECOND').addEventListener('click', function() { f.remove(); });
        f.querySelector('.JUM-R-PRINCIPAL').addEventListener('click', function() {
            var b = this; b.disabled = true;
            appelApi('carte/revoquer', { methode: 'POST', corps: carteIdentite() }).then(function(r) {
                var d = carteIdentite(), m = { id: r.id, depuis: r.depuis, sig: [d.grade, d.nom, d.prenom, d.unite, d.cie, d.nid].join('|'), mail: monCompte().mail };
                ecrireTxt(CLE_CARTE, JSON.stringify(m)); f.remove(); bandeau('Nouveau QR code : l\'ancien ne marche plus.'); apres(m);
            }, function(e) { b.disabled = false; f.querySelector('.JUM-BIOC-ERR').textContent = (e && e.message) || 'Révocation impossible : vérifiez la connexion.'; });
        });
        document.body.appendChild(f);
    }
    // Plein écran : téléphone à l'horizontale, fond noir, écran maintenu allumé ; toucher retourne la carte.
    window.JUMELAGE_CARTE_GRAND = function(verso) {
        var d = carteIdentite(), memo = lireJSON(CLE_CARTE), veille = null;
        var f = document.createElement('div'); f.className = 'JUM-SIG JUM-CARTE-PLEIN'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Carte TRIGONE en grand');
        f.innerHTML = '<div class="JUM-CARTE-ZONE"><div class="JUM-CARTE-TOURNE' + (verso ? ' verso' : '') + '"><div class="face avant">' + carteRecto(d) + '</div><div class="face arriere">' + carteVerso(d, memo) + '</div></div></div>' +
            '<button type="button" class="JUM-CARTE-QUITTER" aria-label="Fermer">✕</button>';
        var ajuster = function() {
            var z = f.querySelector('.JUM-CARTE-ZONE'), w = window.innerWidth, h = window.innerHeight, debout = h > w;
            // Téléphone tenu debout (rotation impossible) : la carte est tournée d'un quart de tour pour remplir l'écran.
            var e = debout ? Math.min((h - 40) / 350, (w - 24) / 221) : Math.min((w - 40) / 350, (h - 24) / 221);
            z.style.transform = 'translate(-50%, -50%)' + (debout ? ' rotate(90deg)' : '') + ' scale(' + e + ')';
        };
        var fermer = function() {
            window.removeEventListener('resize', ajuster);
            try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function() {});
            if (veille) veille.release().catch(function() {});
            f.remove();
        };
        f.querySelector('.JUM-CARTE-QUITTER').addEventListener('click', function(e) { e.stopPropagation(); fermer(); });
        f.querySelector('.JUM-CARTE-TOURNE').addEventListener('click', function() { this.classList.toggle('verso'); });
        f._fermer = fermer;
        document.body.appendChild(f);
        if (memo && memo.id) dessinerQR(f.querySelector('.JUM-CARTE-QR'), memo.id);
        ajuster(); window.addEventListener('resize', ajuster);
        if (f.requestFullscreen) f.requestFullscreen({ navigationUI: 'hide' }).then(function() {
            return screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null;
        }).catch(function() {}).then(function() { setTimeout(ajuster, 300); });
        if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function(v) { veille = v; }, function() {});
        document.addEventListener('fullscreenchange', function q() { if (!document.fullscreenElement) { document.removeEventListener('fullscreenchange', q); if (f.isConnected) fermer(); } });
    };
    // Photo : appareil photo ou galerie, puis cadrage au doigt (glisser, zoom) ; gardée sur l'appareil (JPEG 300 × 380).
    function choisirPhoto(apres) {
        var entree = document.createElement('input'); entree.type = 'file'; entree.accept = 'image/*';
        entree.addEventListener('change', function() {
            var fich = entree.files && entree.files[0]; if (!fich) return;
            var url = URL.createObjectURL(fich), img = new Image();
            img.onload = function() { cadrerPhoto(img, function(donnee) { URL.revokeObjectURL(url); if (donnee) { ecrireTxt(CLE_CARTE_PHOTO, donnee); bandeau('Photo de la carte enregistrée sur cet appareil.'); } majBoutonsCompte(); apres(); }); };
            img.onerror = function() { URL.revokeObjectURL(url); bandeau('Image illisible : choisissez une autre photo.'); };
            img.src = url;
        });
        entree.click();
    }
    function cadrerPhoto(img, fin) {
        var f = document.createElement('div'); f.className = 'JUM-SIG JUM-CARTE-CADRE'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Cadrer ma photo');
        f.innerHTML = '<div class="JUM-SIG-CARTE"><h2>Cadrez votre visage</h2><p>Glissez la photo avec le doigt, zoomez avec le curseur.</p>' +
            '<div class="JUM-CADRE-ZONE"><canvas width="380" height="480"></canvas></div>' +
            '<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">' +
            '<div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-SECOND">Annuler</button><button type="button" class="JUM-R-PRINCIPAL">Valider la photo</button></div>' +
            (lireTxt(CLE_CARTE_PHOTO) ? '<button type="button" class="JUM-R-LIEN JUM-CADRE-SUPPR">Retirer la photo de la carte</button>' : '') + '</div>';
        var cv = f.querySelector('canvas'), ctx = cv.getContext('2d'), zoom = f.querySelector('input');
        var base = Math.max(cv.width / img.width, cv.height / img.height), z = 1, x = 0, y = 0;
        var borner = function() {
            var w = img.width * base * z, h = img.height * base * z;
            x = Math.min(0, Math.max(cv.width - w, x)); y = Math.min(0, Math.max(cv.height - h, y));
        };
        var peindre = function() { borner(); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, x, y, img.width * base * z, img.height * base * z); };
        x = (cv.width - img.width * base) / 2; y = (cv.height - img.height * base) / 2; peindre();
        zoom.addEventListener('input', function() {
            var cx = cv.width / 2, cy = cv.height / 2, nz = parseFloat(zoom.value);
            x = cx - (cx - x) * nz / z; y = cy - (cy - y) * nz / z; z = nz; peindre();
        });
        var prise = null;
        cv.addEventListener('pointerdown', function(e) { prise = { px: e.clientX, py: e.clientY, x: x, y: y }; cv.setPointerCapture(e.pointerId); });
        cv.addEventListener('pointermove', function(e) {
            if (!prise) return; var k = cv.width / cv.getBoundingClientRect().width;
            x = prise.x + (e.clientX - prise.px) * k; y = prise.y + (e.clientY - prise.py) * k; peindre();
        });
        cv.addEventListener('pointerup', function() { prise = null; });
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { f.addEventListener(t, function(e) { e.stopPropagation(); }); });
        f.querySelector('.JUM-R-SECOND').addEventListener('click', function() { f.remove(); fin(null); });
        f.querySelector('.JUM-R-PRINCIPAL').addEventListener('click', function() {
            var out = document.createElement('canvas'); out.width = 300; out.height = 380;
            out.getContext('2d').drawImage(cv, 0, 0, out.width, out.height);
            f.remove(); fin(out.toDataURL('image/jpeg', 0.85));
        });
        var suppr = f.querySelector('.JUM-CADRE-SUPPR');
        if (suppr) suppr.addEventListener('click', function() { try { localStorage.removeItem(CLE_CARTE_PHOTO); } catch (e) {} f.remove(); majBoutonsCompte(); fin(null); });
        document.body.appendChild(f);
    }
    // Image de la carte (recto et verso l'un sous l'autre) dessinée en PNG, puis partagée ou enregistrée.
    function partagerCarte(d, memo) {
        var E = 3, W = 350 * E, H = 221 * E, G = 24 * E, cv = document.createElement('canvas'); cv.width = W; cv.height = H * 2 + G;
        var c = cv.getContext('2d'), photoSrc = lireTxt(CLE_CARTE_PHOTO), base = DANS_CR ? '../' : '';
        var charger = function(src) { return new Promise(function(ok) { if (!src) return ok(null); var i = new Image(); i.onload = function() { ok(i); }; i.onerror = function() { ok(null); }; i.src = src; }); };
        var qrUrl = memo && memo.id ? chargerScript('qrcode.min.js', function() { return !!window.QRCode; }).then(function() {
            var b = document.createElement('div'); new window.QRCode(b, { text: lienCarte(memo.id), width: 300, height: 300, colorDark: '#111111', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
            var cnv = b.querySelector('canvas'); return cnv ? cnv.toDataURL() : (b.querySelector('img') || {}).src;
        }).catch(function() { return null; }) : Promise.resolve(null);
        var arrondi = function(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
        var fond = function(oy) {
            var g = c.createRadialGradient(0, oy, 10, 0, oy, W * 1.1); g.addColorStop(0, '#353026'); g.addColorStop(0.45, '#1b1a17'); g.addColorStop(1, '#0e0e0d');
            var nv = niveauCarte(d.missions)[0];
            arrondi(0, oy, W, H, 16 * E); c.fillStyle = g; c.fill(); c.strokeStyle = nv === 'bronze' ? '#b87333' : nv === 'argent' ? '#c9ced6' : nv === 'or' ? '#e2b866' : 'rgba(214,167,86,0.6)'; c.lineWidth = (nv ? 3 : 2) * E; c.stroke();
        };
        var texte = function(t, x, y, taille, couleur, gras, esp) { c.font = (gras ? '800 ' : '600 ') + taille * E + 'px Montserrat, Arial, sans-serif'; c.fillStyle = couleur; if ('letterSpacing' in c) c.letterSpacing = (esp || 0) * E + 'px'; c.fillText(t, x * E, y); };
        Promise.all([charger(photoSrc), charger(base + 'phoenix-icon.png'), qrUrl.then(charger)]).then(function(r) {
            var photo = r[0], phenix = r[1], qr = r[2], or = '#d6a756';
            c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, cv.width, cv.height);
            fond(0);
            if (phenix) { c.save(); c.filter = 'invert(1)'; c.drawImage(phenix, 16 * E, 12 * E, 30 * E, 30 * E * phenix.height / phenix.width); c.restore(); }
            texte('TRIGONE', 54, 26 * E, 12, '#f5f5f5', true, 3.4); texte('CARTE D\'IDENTITÉ · MISSIONS', 54, 37 * E, 7.5, or, true, 1);
            c.textAlign = 'right'; texte(d.unite || '', 336, 26 * E, 8, or, true, 1); c.textAlign = 'left';
            arrondi(16 * E, 52 * E, 82 * E, 104 * E, 9 * E); c.save(); c.clip();
            if (photo) c.drawImage(photo, 16 * E, 52 * E, 82 * E, 104 * E); else { c.fillStyle = '#2a2a2a'; c.fillRect(16 * E, 52 * E, 82 * E, 104 * E); }
            c.restore(); arrondi(16 * E, 52 * E, 82 * E, 104 * E, 9 * E); c.strokeStyle = or; c.lineWidth = 1.5 * E; c.stroke();
            var gp = c.createLinearGradient(112 * E, 56 * E, 146 * E, 82 * E); gp.addColorStop(0, '#f1d08a'); gp.addColorStop(1, '#b8862e'); arrondi(112 * E, 56 * E, 34 * E, 26 * E, 5 * E); c.fillStyle = gp; c.fill();
            var ch = [['NOM · PRÉNOM', (d.nom + ' ' + d.prenom).trim(), 112, 98, 13.5], ['GRADE', d.grade, 112, 128, 10.5], ['NID', d.nid, 228, 128, 10.5], ['UNITÉ', [d.unite, d.cie].filter(Boolean).join(' · '), 112, 152, 10.5], ['MISSIONS', String(d.missions), 228, 152, 10.5]];
            ch.forEach(function(x) { texte(x[0], x[2], x[3] * E, 6.5, or, true, 1); texte(x[1] || '—', x[2], (x[3] + x[4] + 2) * E, x[4], '#f5f5f5', true, 0.2); });
            var m = mrz(d); c.font = '600 ' + 8.6 * E + 'px "Courier New", monospace'; c.fillStyle = 'rgba(214,167,86,0.65)'; if ('letterSpacing' in c) c.letterSpacing = 0.8 * E + 'px';
            c.fillText(m[0], 14 * E, 200 * E); c.fillText(m[1], 14 * E, 212 * E);
            var oy = H + G; fond(oy); c.fillStyle = '#111'; c.fillRect(0, oy + 20 * E, W, 34 * E);
            arrondi(16 * E, oy + 66 * E, 118 * E, 118 * E, 10 * E); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = or; c.lineWidth = 1.5 * E; c.stroke();
            if (qr) c.drawImage(qr, 23 * E, oy + 73 * E, 104 * E, 104 * E);
            texte('SCANNEZ POUR M\'AJOUTER', 148, oy + 74 * E, 7, or, true, 1);
            texte('mission collective, valideur, remplaçant…', 148, oy + 88 * E, 8.5, '#d4d4d4', false, 0);
            texte('RÔLES', 148, oy + 108 * E, 7, or, true, 1); texte(d.roles.join(' · '), 148, oy + 121 * E, 8.5, '#e8c27a', true, 0.3);
            texte('COMPTE', 148, oy + 141 * E, 7, or, true, 1); texte(memo && memo.id ? '✔ Vérifié' + (memo.depuis ? ' depuis le ' + new Date(memo.depuis).toLocaleDateString('fr-FR') : '') : 'Non connecté', 148, oy + 154 * E, 8.5, '#f5f5f5', true, 0);
            cv.toBlob(function(blob) {
                var nom = 'Carte TRIGONE - ' + (d.nom || 'moi') + '.png', fichier = new File([blob], nom, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [fichier] })) navigator.share({ files: [fichier], title: 'Ma carte TRIGONE' }).catch(function() {});
                else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function() { URL.revokeObjectURL(a.href); }, 4000); }
            }, 'image/png');
        });
    }
    // ---------- Scanner de cartes TRIGONE ----------
    // Caméra arrière : lecteur intégré au navigateur (BarcodeDetector) ou, à défaut, jsQR (livré avec l'appli, chargé à la
    // demande). Le QR code lu donne l'identifiant de la carte ; le serveur renvoie l'identité et le mail du compte.
    // opts : { titre, sous, continu (fonction appelée à chaque carte, la fenêtre reste ouverte), bouton }.
    // Sans caméra (PC) : coller le lien de la carte. Promesse : la carte lue (ou null si annulé) ; en continu : rien.
    function lireCarteTexte(texte) {
        var m = /[?&]carte=([A-Za-z0-9_-]{8,40})/.exec(String(texte || '')) || /^([A-Za-z0-9_-]{16})$/.exec(String(texte || '').trim());
        if (!m) return Promise.reject(new Error('Ce QR code n\'est pas une carte TRIGONE.'));
        return appelApi('carte?id=' + encodeURIComponent(m[1])).then(function(r) {
            if (!r.valide) throw new Error('Carte inconnue ou compte TRIGONE supprimé.');
            r.carte.id = m[1]; return r.carte;
        });
    }
    window.JUMELAGE_CARTE_NOM = function(c) { return [c.grade, (c.nom || '').toUpperCase(), c.prenom].filter(Boolean).join(' '); };
    var scanEnCours = null;
    window.JUMELAGE_SCANNER_CARTE = function(opts) {
        opts = opts || {};
        if (scanEnCours) scanEnCours.fermer();
        if (!monCompte() && !opts.sansCompte) { bandeau('Connectez-vous à votre compte TRIGONE pour lire une carte.'); return Promise.resolve(null); }
        return new Promise(function(resoudre) {
            var f = document.createElement('div'), flux = null, fini = false, dernier = '', dernierLe = 0, minuteur = null, lues = 0;
            f.className = 'JUM-SIG JUM-SCAN'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', opts.titre || 'Scanner une carte TRIGONE');
            f.innerHTML = '<div class="JUM-SIG-CARTE"><h2>' + esc(opts.titre || 'Scanner une carte TRIGONE') + '</h2><p>' + esc(opts.sous || 'Visez le QR code au verso de la carte.') + '</p>' +
                '<div class="JUM-SCAN-VUE"><video playsinline muted></video><i class="coins"><b></b><b></b><b></b><b></b></i><i class="laser"></i><span class="JUM-SCAN-ETAT">Ouverture de la caméra…</span></div>' +
                '<div class="JUM-SCAN-RES"></div>' +
                '<details class="JUM-SCAN-MAIN"><summary>Pas de caméra ? Coller le lien de la carte</summary><div><input type="text" placeholder="https://…?carte=…" autocomplete="off" data-no-uppercase="1"><button type="button" class="JUM-R-SECOND">Lire</button></div></details>' +
                '<div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-SECOND JUM-SCAN-FERMER">' + (opts.continu ? 'Terminé' : 'Annuler') + '</button></div></div>';
            var video = f.querySelector('video'), etat = f.querySelector('.JUM-SCAN-ETAT'), res = f.querySelector('.JUM-SCAN-RES');
            var fermer = function(valeur) {
                if (fini) return; fini = true; scanEnCours = null;
                clearTimeout(minuteur);
                if (flux) flux.getTracks().forEach(function(t) { t.stop(); });
                f.remove(); resoudre(valeur || null);
            };
            f._fermer = function() { fermer(null); };
            scanEnCours = { fermer: f._fermer };
            var traiter = function(texte) {
                var maintenant = Date.now();
                if (texte === dernier && maintenant - dernierLe < 4000) return Promise.resolve();
                dernier = texte; dernierLe = maintenant;
                etat.textContent = opts.lire ? 'Lecture…' : 'Lecture de la carte…';
                return (opts.lire || lireCarteTexte)(texte).then(function(c) {
                    if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
                    if (!opts.continu) { fermer(c); return; }
                    lues++;
                    var retour = opts.continu(c) || {}, mon = (lireReglages().unite || '').toUpperCase();
                    if (c.unite && mon && c.unite.toUpperCase() !== mon && retour.texte && !retour.deja) retour.texte += ' · extérieur (' + c.unite + ')';
                    res.insertAdjacentHTML('afterbegin', '<div class="' + (retour.deja ? 'deja' : 'ok') + '"><b>' + esc(window.JUMELAGE_CARTE_NOM(c)) + '</b><span>' + esc(retour.texte || '✔ Ajouté') + '</span></div>');
                    etat.textContent = lues + ' carte' + (lues > 1 ? 's' : '') + ' lue' + (lues > 1 ? 's' : '') + ' · carte suivante…';
                }).catch(function(e) { etat.textContent = '✘ ' + (e.message || 'Lecture impossible.'); });
            };
            f._lire = traiter;   // essais : lecture d'un lien sans caméra
            f.querySelector('.JUM-SCAN-FERMER').addEventListener('click', function() { fermer(null); });
            f.querySelector('.JUM-SCAN-MAIN button').addEventListener('click', function() { dernier = ''; traiter(f.querySelector('.JUM-SCAN-MAIN input').value); });
            ['pointerdown', 'pointerup', 'click'].forEach(function(t) { f.addEventListener(t, function(e) { e.stopPropagation(); }); });
            document.body.appendChild(f);
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { etat.textContent = 'Caméra indisponible : collez le lien de la carte ci-dessous.'; f.querySelector('.JUM-SCAN-MAIN').open = true; return; }
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }).then(function(s) {
                if (fini) { s.getTracks().forEach(function(t) { t.stop(); }); return; }
                flux = s; video.srcObject = s; return video.play();
            }).then(function() {
                if (fini || !flux) return;
                etat.textContent = 'Visez le QR code de la carte';
                var detecteur = null, cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
                var pret = ('BarcodeDetector' in window) ? window.BarcodeDetector.getSupportedFormats().then(function(f) { if (f.indexOf('qr_code') >= 0) detecteur = new window.BarcodeDetector({ formats: ['qr_code'] }); }).catch(function() {}) : Promise.resolve();
                pret.then(function() { return detecteur ? null : chargerScript('jsqr.min.js', function() { return !!window.jsQR; }); }).then(function() {
                    var tour = function() {
                        if (fini) return;
                        var lu = detecteur ? detecteur.detect(video).then(function(l) { return l[0] && l[0].rawValue; }) : Promise.resolve().then(function() {
                            var w = video.videoWidth, h = video.videoHeight; if (!w) return null;
                            var e = Math.min(1, 720 / Math.max(w, h)); cv.width = Math.round(w * e); cv.height = Math.round(h * e);
                            ctx.drawImage(video, 0, 0, cv.width, cv.height);
                            var q = window.jsQR(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
                            return q && q.data;
                        });
                        lu.then(function(t) { return t ? traiter(t) : null; }).catch(function() {}).then(function() { minuteur = setTimeout(tour, 200); });
                    };
                    tour();
                }, function(e) { etat.textContent = e.message; });
            }).catch(function() { if (!fini) { etat.textContent = 'Caméra refusée ou indisponible : collez le lien de la carte ci-dessous.'; f.querySelector('.JUM-SCAN-MAIN').open = true; } });
        });
    };
    // Bouton « scanner » à côté des champs de mail (1er valideur, assistant Chorus DT, remplaçant, mails de Mise en route
    // marqués data-scan-carte) : la carte lue remplit l'adresse de son compte TRIGONE.
    var CHAMPS_SCAN = ['JUM-R-MAILVAL1', 'JUM-R-MAILCHORUS', 'JUM-R-ABSMAIL'];
    function equiperChampsScan(racine) {
        Array.prototype.forEach.call((racine || document).querySelectorAll('input[type="email"]'), function(ch) {
            if (ch.dataset.scanCarteFait || !(CHAMPS_SCAN.indexOf(ch.id) >= 0 || ch.hasAttribute('data-scan-carte'))) return;
            ch.dataset.scanCarteFait = '1';
            var b = document.createElement('button'); b.type = 'button'; b.className = 'JUM-SCAN-CHAMP'; b.title = 'Scanner sa carte TRIGONE'; b.setAttribute('aria-label', 'Scanner sa carte TRIGONE');
            b.innerHTML = window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('qr') : '▣';
            var enveloppe = document.createElement('span'); enveloppe.className = 'JUM-SCAN-ENV';
            ch.parentNode.insertBefore(enveloppe, ch); enveloppe.appendChild(ch); enveloppe.appendChild(b);
            b.addEventListener('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                var lb = (ch.labels && ch.labels[0]) || (ch.closest('div') && ch.closest('div').querySelector('label')), label = lb ? lb.textContent : 'Cette adresse';
                window.JUMELAGE_SCANNER_CARTE({ titre: 'Scanner sa carte TRIGONE', sous: label + ' : son adresse TRIGONE est reprise de sa carte.' }).then(function(c) {
                    if (!c) return;
                    ch.value = c.mail; ch.dispatchEvent(new Event('input', { bubbles: true })); ch.dispatchEvent(new Event('change', { bubbles: true }));
                    bandeau(window.JUMELAGE_CARTE_NOM(c) + ' : ' + c.mail);
                });
            });
        });
    }
    window.JUMELAGE_EQUIPER_SCAN = equiperChampsScan;
    function suivreChampsScan() {
        equiperChampsScan(document);
        new MutationObserver(function(ms) { if (ms.some(function(m) { return m.addedNodes.length; })) equiperChampsScan(document); }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) suivreChampsScan(); else document.addEventListener('DOMContentLoaded', suivreChampsScan);
    // Page de vérification : QR code d'une carte lu avec l'appareil photo d'un téléphone (lien « ?carte=… »).
    (function() {
        var id = null; try { id = new URLSearchParams(location.search).get('carte'); } catch (e) {}
        if (!id) return;
        var montrer = function() {
            var f = document.createElement('div'); f.className = 'JUM-VERIF'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Vérification d\'une carte TRIGONE');
            f.innerHTML = '<div class="JUM-VERIF-CARTE"><img src="' + (DANS_CR ? '../' : '') + 'phoenix-icon.png" alt=""><div class="JUM-VERIF-NOM">TRIGONE</div>' +
                '<p class="JUM-VERIF-SOUS">Vérification d\'une carte</p><div class="JUM-VERIF-RES">Vérification…</div>' +
                '<button type="button" class="JUM-R-PRINCIPAL">Ouvrir TRIGONE</button></div>';
            document.body.appendChild(f);
            f.querySelector('button').addEventListener('click', function() { try { history.replaceState(null, '', location.pathname); } catch (e) {} f.remove(); });
            var r = f.querySelector('.JUM-VERIF-RES'), quand = new Date();
            fetch(API + 'carte?id=' + encodeURIComponent(id), { cache: 'no-store', headers: monCompte() ? { Authorization: 'TRIGONE ' + encodeURIComponent(monCompte().mail) + ' ' + monCompte().appareil + ' ' + monCompte().jeton } : {} })
                .then(function(x) { return x.json(); }).then(function(j) {
                    if (!j.valide) { r.className = 'JUM-VERIF-RES ko'; r.innerHTML = '<b>✘ Carte non reconnue</b><span>Cette carte n\'existe pas, ou le compte TRIGONE a été supprimé.</span>'; return; }
                    var c = j.carte;
                    r.className = 'JUM-VERIF-RES ok';
                    r.innerHTML = '<b>✔ Carte TRIGONE authentique</b><span class="qui">' + esc(window.JUMELAGE_CARTE_NOM(c)) + '</span>' +
                        '<span>' + esc([c.unite, c.cie].filter(Boolean).join(' · ')) + '</span>' +
                        (c.depuis ? '<span>Compte TRIGONE depuis le ' + new Date(c.depuis).toLocaleDateString('fr-FR') + '</span>' : '') +
                        '<small>Vérifié le ' + quand.toLocaleDateString('fr-FR') + ' à ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</small>' +
                        (c.attente ? '<span class="JUM-VERIF-ATT">⏳ Compte en attente de validation</span><button type="button" class="JUM-R-PRINCIPAL JUM-VERIF-VALIDER">✔ Valider son inscription</button>' : '');
                    var bv = r.querySelector('.JUM-VERIF-VALIDER');
                    if (bv) bv.addEventListener('click', function() {
                        bv.disabled = true;
                        appelApi('compte/valider-carte', { methode: 'POST', corps: { carte: id } }).then(function(x) { bv.outerHTML = '<span class="JUM-VERIF-OK">✔ ' + esc(x.qui) + ' : compte validé</span>'; },
                            function(e) { bv.disabled = false; bandeau(e.message); });
                    });
                }).catch(function() { r.className = 'JUM-VERIF-RES ko'; r.innerHTML = '<b>Vérification impossible</b><span>Pas de connexion internet : réessayez.</span>'; });
        };
        if (document.body) montrer(); else document.addEventListener('DOMContentLoaded', montrer);
    })();
    // ---------- Code d'accès commun : demandé une fois à l'ouverture de TRIGONE ----------
    var pave = null, saisie = '';
    function dessinerPoints() {
        if (!pave) return;
        Array.prototype.forEach.call(pave.querySelectorAll('.JUM-PIN-POINT'), function(p, i) { p.classList.toggle('plein', i < saisie.length); p.classList.toggle('actif', i === saisie.length); });
    }
    window.JUMELAGE_PIN_TOUCHE = function(ch) {
        if (!pave) return;
        pave.classList.add('code');   // écran empreinte : taper un chiffre affiche le code
        if (ch === 'x') saisie = saisie.slice(0, -1); else if (saisie.length < 4) saisie += ch;
        dessinerPoints();
        if (saisie.length === 4) window.JUMELAGE_VERIFIER_CODE(saisie).then(function(ok) {
            if (!pave) return;
            if (ok) {
                if (window.JUMELAGE_MARQUER_DEVERROUILLE) window.JUMELAGE_MARQUER_DEVERROUILLE();
                pave.remove(); pave = null;
            } else {
                saisie = ''; dessinerPoints();
                var e = pave.querySelector('.JUM-PIN-ERREUR'); e.textContent = 'Code incorrect. Réessayez.';
                pave.querySelector('.JUM-PIN-POINTS').classList.add('secoue');
                setTimeout(function() { if (pave) pave.querySelector('.JUM-PIN-POINTS').classList.remove('secoue'); }, 450);
            }
        });
    };
    // ---------- Montre connectée (Paramètres › Notifications) ----------
    // Le téléphone relaie à la montre les notifications de TRIGONE : la montre est « prête » quand elles sont actives sur
    // ce téléphone (TRIGONE ne peut pas voir la montre elle-même). Essai : une notification avec un bouton, sans effet.
    function montrePrete() { return notifEtat() === 'active' && !notifMuet(); }
    window.JUMELAGE_MONTRE = function() {
        if (document.querySelector('.JUM-MONTRE')) return;
        var f = document.createElement('div');
        f.className = 'JUM-SIG JUM-MONTRE'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Montre connectée');
        var ok = montrePrete();
        f.innerHTML = '<div class="JUM-SIG-CARTE"><div class="JUM-MONTRE-TETE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('montre') : '') + '<div><h2 style="margin:0;">Montre connectée</h2>' +
            '<small style="color:#8a8a8a;">Galaxy Watch, Pixel Watch, autre montre Wear OS…</small></div></div>' +
            '<div class="JUM-MONTRE-ETAT' + (ok ? ' ok' : '') + '"><i></i>' + (ok ? 'Prête : les notifications de TRIGONE sont actives sur ce téléphone.' : 'Pas prête : activez les notifications de TRIGONE sur ce téléphone.') + '</div>' +
            '<ol><li>Pendant une mission, la notification « Mission en cours » arrive sur la montre avec le bouton de l\'étape suivante (Arrivée sur site, Départ du site, Arrivée finale).</li>' +
            '<li>Un appui sur la montre enregistre l\'heure exacte, même sans réseau.</li>' +
            '<li>Dans l\'appli de la montre (ex. Galaxy Wearable › Notifications), autorisez <b>Chrome</b> et TRIGONE.</li></ol>' +
            '<p class="JUM-MONTRE-MSG"></p>' +
            '<div class="JUM-SIG-BTNS"><button type="button" class="JUM-R-SECOND">Fermer</button><button type="button" class="JUM-R-PRINCIPAL">' + (ok ? 'Envoyer un essai' : 'Activer les notifications') + '</button></div></div>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { f.addEventListener(t, function(e) { e.stopPropagation(); }); });
        var fermer = function() { f.remove(); };
        f.addEventListener('click', function(e) { if (e.target === f) fermer(); });
        f.querySelector('.JUM-R-SECOND').addEventListener('click', fermer);
        f.querySelector('.JUM-R-PRINCIPAL').addEventListener('click', function() {
            var msg = f.querySelector('.JUM-MONTRE-MSG');
            if (!montrePrete()) { fermer(); window.JUMELAGE_COMPTE(); return; }
            navigator.serviceWorker.ready.then(function(reg) {
                return reg.showNotification('Essai TRIGONE — montre', { body: 'Pendant une mission, ce bouton horodatera l\'étape suivante.', tag: 'trigone-montre-essai', renotify: true,
                    icon: (DANS_CR ? '../' : '') + 'icon-192.png', badge: (DANS_CR ? '../' : '') + 'favicon-32.png', actions: [{ action: 'essai', title: 'Arrivée sur site' }] });
            }).then(function() { msg.textContent = '✔ Essai envoyé : regardez votre montre (téléphone verrouillé, de préférence).'; },
                function() { msg.textContent = 'Essai impossible : rouvrez TRIGONE puis réessayez.'; });
        });
        document.body.appendChild(f);
    };
    var bioEnCours = false;
    // auto : proposée d'office à l'ouverture ; un refus du navigateur (pas de geste) reste silencieux, le doigt sur la touche relance.
    window.JUMELAGE_PIN_BIO = function(auto) {
        if (!pave || bioEnCours) return;
        bioEnCours = true; pave.classList.remove('ko');
        var refus = function(texte) { pave.classList.add('ko', 'code'); pave.querySelector('.JUM-PIN-ERREUR').textContent = texte; };
        bioVerifier().then(function(ok) {
            bioEnCours = false;
            if (!pave) return;
            if (!ok) { refus('Empreinte non reconnue : entrez votre code.'); return; }
            if (window.JUMELAGE_MARQUER_DEVERROUILLE) window.JUMELAGE_MARQUER_DEVERROUILLE();
            var p = pave; pave = null;
            if (!p.classList.contains('bio')) { p.remove(); return; }
            // « Bienvenue ✓ » en vert un instant, puis TRIGONE apparaît.
            p.classList.remove('code'); p.classList.add('ok', 'sortie');
            p.querySelector('.JUM-BIOV-T1').innerHTML = '<span>Bienvenue ✓</span>';
            p.querySelector('.JUM-BIOV-T2').textContent = 'TRIGONE s\'ouvre…';
            p.querySelector('.JUM-PIN-ERREUR').textContent = '';
            setTimeout(function() { p.remove(); }, 650);
        }, function() {
            bioEnCours = false;
            if (pave && auto !== true) refus('Empreinte annulée ou indisponible : entrez votre code.');
        });
    };
    // Efface toutes les données de TRIGONE sur l'appareil puis rouvre l'écran de choix, comme au premier jour.
    function toutEffacer(motif) {
        try { localStorage.clear(); sessionStorage.clear(); if (typeof motif === 'string') sessionStorage.setItem('trigone_efface_motif', motif); } catch (e) {}
        var fin = function() { location.replace(DANS_CR ? '../' : './'); };
        var bases = ['trigone-mise-en-route', 'trigone-compte'];
        var supprimer = function(noms) { return Promise.all(noms.map(function(n) { return new Promise(function(ok) {
            try { var r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = function() { ok(); }; } catch (e) { ok(); }
        }); })); };
        if (!window.indexedDB) { fin(); return; }
        (indexedDB.databases ? indexedDB.databases().then(function(l) { return l.map(function(d) { return d.name; }).filter(Boolean).concat(bases); }, function() { return bases; }) : Promise.resolve(bases))
            .then(supprimer).then(fin, fin);
    }
    // Avertissement avec la mascotte (message centré de l'appli), sinon confirmation du navigateur.
    function confirmerEffacement(titre, texte, libelle) {
        if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM(titre, texte, libelle, toutEffacer, '⚠️', 'mascotte-poubelle.webp', true);
        else if (window.confirm(titre + '\n\n' + texte)) toutEffacer();
    }
    // Compte connecté : réinitialiser ou effacer passe par une demande à l'assistant Chorus DT ou à l'administrateur
    // (l'administrateur garde la main sur son propre appareil). « Code oublié » reste libre.
    function effacementSurDemande() { if (monCompte() && !lireTxt(CLE_ROLE_ADMIN)) { window.JUMELAGE_DEMANDE_COMPTE('reinit'); return true; } return false; }
    window.JUMELAGE_REINITIALISER = function() {
        if (effacementSurDemande()) return;
        confirmerEffacement('Réinitialiser TRIGONE ?',
            'Toutes les données de TRIGONE seront définitivement effacées de cet appareil, pour les deux applis : demandes de mise en route, bibliothèque, comptes-rendus, remboursements, médailles, réglages (identité, mails) et code d\'accès.\n\nTRIGONE redémarrera comme au premier jour. Cette action est irréversible.',
            'Oui, tout effacer');
    };
    // ---------- Comptes : demandes de réinitialisation / suppression, gestion par l'assistant Chorus DT et l'administrateur ----------
    var NB_DEMANDES_COMPTE = 0, CLE_DEM_COMPTE = 'trigone_demande_compte', CLE_ATTENTE = 'trigone_compte_attente';
    function etatDemandeCompte(type) {
        var d = lireJSON(CLE_DEM_COMPTE); if (!d || d.type !== type) return '';
        return d.statut === 'attente' ? '⏳ Demandée le ' + new Date(d.le).toLocaleDateString('fr-FR') + ' : en attente' : d.statut === 'refusee' ? '✖ Refusée le ' + new Date(d.decideLe || d.le).toLocaleDateString('fr-FR') : '';
    }
    window.JUMELAGE_DEMANDE_COMPTE = function(type) {
        if (!monCompte()) return;
        var reinit = type === 'reinit', admin = !!lireTxt(CLE_ROLE_ADMIN), chorus = !!rolesLocaux().chorus;
        var a = admin ? 'l\'administrateur de TRIGONE' : chorus ? 'l\'administrateur de votre unité' : 'votre assistant Chorus DT (' + (lireReglages().mailChorus || 'mail à indiquer dans Mon profil') + ') ou l\'administrateur de votre unité';
        var f = document.createElement('div'); f.className = 'JUM-GC-FOND';
        f.innerHTML = '<div class="JUM-GC-FEN"><h3>' + (reinit ? 'Demander la réinitialisation' : 'Demander la suppression de mon compte') + '</h3>' +
            '<p>' + (reinit ? 'Une fois accordée, TRIGONE repart comme au premier jour sur <b>chacun de vos appareils</b> (demandes, comptes-rendus, réglages effacés). Votre compte et votre sauvegarde restent.'
                : 'Une fois accordée, <b>tout votre compte est effacé</b> : adresse TRIGONE, carte, photo, sauvegarde, appareils, notifications ; vos appareils s\'effacent à leur prochaine ouverture. Les missions déjà au registre des OMR restent (historique de l\'unité).') + '</p>' +
            '<p>La demande part à ' + esc(a) + ', avec une notification.</p>' +
            '<textarea id="JUM-GC-MOTIF" rows="3" placeholder="Motif (facultatif) : téléphone changé, départ de l\'unité…"></textarea>' +
            '<p class="JUM-GC-ERR" id="JUM-GC-ERR"></p><div class="JUM-GC-BTNS"><button type="button" class="JUM-R-SECOND" data-x>Annuler</button><button type="button" class="JUM-R-PRINCIPAL" data-go>Envoyer la demande</button></div></div>';
        document.body.appendChild(f);
        f.querySelector('[data-x]').onclick = function() { f.remove(); };
        f.querySelector('[data-go]').onclick = function() {
            var b = this; b.disabled = true;
            appelApi('compte/demande', { methode: 'POST', corps: { type: type, motif: f.querySelector('#JUM-GC-MOTIF').value.trim(), qui: window.JUMELAGE_QUI() || monCompte().mail, chorus: lireReglages().mailChorus || '' } }).then(function() {
                ecrireTxt(CLE_DEM_COMPTE, JSON.stringify({ type: type, statut: 'attente', le: Date.now() }));
                f.remove(); if (window.JUMELAGE_FERMER_PARAMETRES) window.JUMELAGE_FERMER_PARAMETRES();
                bandeau('Demande envoyée : vous serez prévenu de la réponse.');
            }, function(e) { b.disabled = false; f.querySelector('#JUM-GC-ERR').textContent = e.message; });
        };
    };
    function quandCompte(t) { return t ? new Date(t).toLocaleDateString('fr-FR') + ' ' + new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; }
    window.JUMELAGE_GESTION_COMPTES = function() {
        if (window.JUMELAGE_FERMER_PARAMETRES) window.JUMELAGE_FERMER_PARAMETRES();
        var vieux = document.querySelector('.JUM-GC-FOND'); if (vieux) vieux.remove();
        var f = document.createElement('div'); f.className = 'JUM-GC-FOND'; document.body.appendChild(f);
        f.addEventListener('click', function(e) { if (e.target === f) f.remove(); });
        var donnees = null, erreurTxt = '';
        var dessiner = function() {
            var d = donnees || {}, l = d.demandes || [], admin = d.admin || d.superAdmin;
            var cs = (unite && unite.comptes) || [], att = cs.filter(function(x) { return x.statut === 'attente'; }), adminU = unite && (unite.role === 'admin' || unite.role === 'super');
            var nomC = function(x) { return [x.grade, x.nom, x.prenom].filter(Boolean).join(' ') || x.adresse || x.mail; };
            var badge = { attente: '<i class="JUM-GC-ST att">⏳ à valider</i>', actif: '<i class="JUM-GC-ST ok">✔ actif</i>', bloque: '<i class="JUM-GC-ST bl">⛔ bloqué</i>' };
            var ligneC = function(x) {
                return '<div class="JUM-GC-CPT" data-m="' + esc(x.mail) + '"><div><b>' + esc(nomC(x)) + '</b>' + (badge[x.statut] || '') + '<small>' + esc(x.adresse || x.mail) + (unite.role === 'super' ? ' · ' + esc(x.unite) : '') + '</small></div>' +
                    (x.moi ? '<span class="JUM-GC-MOI">vous</span>' : x.statut === 'attente' ? '<div class="JUM-GC-ACT"><button type="button" class="JUM-R-SECOND" data-c="refuser">Refuser</button><button type="button" class="JUM-R-PRINCIPAL" data-c="valider">Valider</button></div>'
                    : adminU ? '<div class="JUM-GC-ACT">' + (x.statut === 'bloque' ? '<button type="button" class="JUM-R-PRINCIPAL" data-c="debloquer">Débloquer</button>'
                        : '<button type="button" class="JUM-R-SECOND" data-c="bloquer">⛔ Bloquer</button><button type="button" class="JUM-R-SECOND" data-c="code">Code</button>') +
                        '<button type="button" class="JUM-GC-SUPPR-MINI" data-c="supprimer" aria-label="Supprimer">🗑</button></div>' : '') + '</div>';
            };
            var visibles = cs.filter(function(x) { return x.statut !== 'attente' && (!filtre || (nomC(x) + ' ' + x.adresse + ' ' + x.mail).toLowerCase().indexOf(filtre) >= 0); });
            var htmlUnite = !unite ? '' :
                '<h4>Inscriptions à valider' + (att.length ? ' (' + att.length + ')' : '') + '</h4>' + (att.length ? att.map(ligneC).join('') : '<p class="JUM-GC-VIDE">Aucune inscription en attente.</p>') +
                '<button type="button" class="JUM-R-SECOND JUM-GC-SCAN" data-scan>📷 Valider en scannant sa carte TRIGONE</button>' +
                (adminU ? '<h4>Comptes de l\'unité ' + esc(unite.role === 'super' ? '(toutes les unités)' : '· ' + ((uniteConnue(unite.unite) || {}).nom || unite.unite)) + '</h4>' +
                    '<input type="search" id="JUM-GC-FILTRE" placeholder="🔍 Rechercher un nom, une adresse…" value="' + esc(filtre) + '">' +
                    (visibles.length ? '<div class="JUM-GC-LISTE">' + visibles.slice(0, 300).map(ligneC).join('') + '</div>' : '<p class="JUM-GC-VIDE">Aucun compte' + (filtre ? ' pour cette recherche' : '') + '. Les comptes d\'avant apparaissent à leur prochaine ouverture de TRIGONE.</p>') : '');
            f.innerHTML = '<div class="JUM-GC-FEN large"><button type="button" class="JUM-GC-X" aria-label="Fermer">✕</button><h3>👤 Comptes et demandes</h3>' + htmlUnite +
                '<h4>Demandes de réinitialisation ou de suppression</h4>' +
                (!donnees ? '<p>' + (erreurTxt ? esc(erreurTxt) : 'Chargement…') + '</p>' :
                (l.length ? l.map(function(x) {
                    return '<div class="JUM-GC-DEM"><b>' + esc(x.qui || x.mail) + '</b><small>' + esc(x.mail) + ' · ' + quandCompte(x.le) + '</small>' +
                        '<span class="JUM-GC-TYPE ' + x.type + '">' + (x.type === 'reinit' ? '↺ Réinitialisation de ses appareils' : '🗑 Suppression de son compte') + '</span>' +
                        (x.motif ? '<em>« ' + esc(x.motif) + ' »</em>' : '') +
                        '<div class="JUM-GC-BTNS"><button type="button" class="JUM-R-SECOND" data-refus="' + x.id + '">Refuser</button><button type="button" class="JUM-R-PRINCIPAL" data-ok="' + x.id + '">Accepter</button></div></div>';
                }).join('') : '<p class="JUM-GC-VIDE">Aucune demande en attente.</p>') +
                (admin ? '<h4>Supprimer un compte par son adresse (départ de l\'institution…)</h4><p>Administrateur ' + esc(d.superAdmin ? 'de TRIGONE' : 'du ' + ((uniteConnue(d.admin) || {}).nom || d.admin)) + ' : supprime tout ce que TRIGONE garde au nom de la personne. Irréversible.</p>' +
                    '<input id="JUM-GC-MAIL" type="email" placeholder="Adresse du compte" autocomplete="off"><input id="JUM-GC-MAIL2" type="email" placeholder="Retapez l\'adresse" autocomplete="off">' +
                    '<select id="JUM-GC-RAISON"><option>Départ de l\'institution</option><option>Mutation hors de l\'unité</option><option>À sa demande</option><option>Compte en double ou erroné</option><option>Autre</option></select>' +
                    '<input id="JUM-GC-PREC" type="text" placeholder="Précision (facultatif)" autocomplete="off"><p class="JUM-GC-ERR" id="JUM-GC-ERR2"></p>' +
                    '<button type="button" class="JUM-GC-SUPPR" data-suppr>🗑 Supprimer ce compte</button>' +
                    '<h4>Journal des suppressions</h4>' + ((d.journal || []).length ? '<div class="JUM-GC-JOURNAL">' + d.journal.map(function(j) {
                        return '<div><b>' + quandCompte(j.le) + '</b> · ' + esc(j.qui || 'compte supprimé') + '<small>par ' + esc(j.par) + ' — ' + esc(j.motif || '') + '</small></div>'; }).join('') + '</div>' : '<p class="JUM-GC-VIDE">Aucune suppression.</p>') : ''));
            f.querySelector('.JUM-GC-X').onclick = function() { f.remove(); };
            var champF = f.querySelector('#JUM-GC-FILTRE');
            if (champF) champF.addEventListener('input', function() { filtre = champF.value.trim().toLowerCase(); var pos = champF.selectionStart; dessiner(); var n = f.querySelector('#JUM-GC-FILTRE'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} });
            var bscan = f.querySelector('[data-scan]');
            if (bscan) bscan.onclick = function() {
                window.JUMELAGE_SCANNER_CARTE({ titre: 'Valider une inscription', sous: 'Scannez le QR code de sa carte TRIGONE (verso).' }).then(function(c) {
                    if (!c) return;
                    if (!c.attente) { bandeau(window.JUMELAGE_CARTE_NOM(c) + ' : compte déjà validé.'); return; }
                    appelApi('compte/valider-carte', { methode: 'POST', corps: { carte: c.id } }).then(function(x) { bandeau('✔ ' + x.qui + ' : compte validé.'); charger(); }, function(e) { bandeau(e.message); });
                });
            };
            Array.prototype.forEach.call(f.querySelectorAll('.JUM-GC-CPT [data-c]'), function(b) {
                b.onclick = function() {
                    var ligne = b.closest('.JUM-GC-CPT'), m = ligne.getAttribute('data-m'), x = cs.filter(function(y) { return y.mail === m; })[0] || {}, qui = nomC(x), a = b.getAttribute('data-c');
                    var conf = function(t, txt, lib, go) { if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM(t, txt, lib, go, '⚠️', null, true); else if (window.confirm(t + '\n\n' + txt)) go(); };
                    var code = function(r, t) { infoCompte(t, 'Code de réactivation de ' + qui + ' : ' + r.code + '\n\nÀ lui remettre (de vive voix, SMS…). Sur son nouveau téléphone : TRIGONE › « J\'ai déjà TRIGONE sur un autre appareil » › ce code. Valable 48 h, une seule fois. Ses données reviennent avec « Restaurer depuis mon compte » (code de récupération).'); charger(); };
                    var err = function(e) { bandeau(e.message); };
                    if (a === 'valider') appelApi('compte/valider', { methode: 'POST', corps: { mail: m, accepte: true } }).then(function() { bandeau('✔ ' + qui + ' : compte validé.'); charger(); }, err);
                    else if (a === 'refuser') conf('Refuser l\'inscription de ' + qui + ' ?', 'Le compte et son adresse TRIGONE sont effacés.', 'Refuser', function() { appelApi('compte/valider', { methode: 'POST', corps: { mail: m, accepte: false } }).then(function() { bandeau('Inscription refusée.'); charger(); }, err); });
                    else if (a === 'bloquer') conf('Bloquer le compte de ' + qui + ' ?', 'Téléphone perdu ou volé : tous ses appareils sont refusés tout de suite, et s\'effacent s\'ils se reconnectent. Son compte, son adresse, sa carte et sa sauvegarde sont gardés. « Débloquer » lui donnera un code pour son nouveau téléphone.', 'Bloquer', function() { appelApi('compte/bloquer', { methode: 'POST', corps: { mail: m, motif: 'Téléphone perdu ou volé' } }).then(function() { bandeau(qui + ' : compte bloqué.'); charger(); }, err); });
                    else if (a === 'debloquer') appelApi('compte/debloquer', { methode: 'POST', corps: { mail: m } }).then(function(r) { code(r, 'Compte débloqué'); }, err);
                    else if (a === 'code') conf('Nouveau code de réactivation pour ' + qui + ' ?', 'Pour un nouveau téléphone, sans bloquer l\'ancien (utilisez « Bloquer » s\'il est perdu).', 'Créer le code', function() { appelApi('compte/reactivation', { methode: 'POST', corps: { mail: m } }).then(function(r) { code(r, 'Code de réactivation'); }, err); });
                    else if (a === 'supprimer') conf('Supprimer le compte de ' + qui + ' ?', 'Tout ce que TRIGONE garde à son nom est effacé (adresse TRIGONE, carte, photo, sauvegarde, appareils). Irréversible.', 'Supprimer le compte', function() { appelApi('compte/supprimer', { methode: 'POST', corps: { mail: m, motif: 'Départ de l\'institution' } }).then(function() { bandeau('Compte supprimé.'); charger(); }, err); });
                };
            });
            Array.prototype.forEach.call(f.querySelectorAll('[data-ok], [data-refus]'), function(b) {
                b.onclick = function() {
                    var id = b.getAttribute('data-ok') || b.getAttribute('data-refus'), ok = b.hasAttribute('data-ok'), x = (donnees.demandes || []).filter(function(y) { return y.id === id; })[0];
                    var go = function() {
                        appelApi('compte/decision', { methode: 'POST', corps: { id: id, accepte: ok, qui: window.JUMELAGE_QUI() } }).then(function(r) {
                            bandeau(!ok ? 'Demande refusée : la personne est prévenue.' : r.statut === 'supprime' ? 'Compte supprimé.' : 'Réinitialisation accordée : ses appareils s\'effaceront à leur ouverture.'); charger();
                        }, function(e) { bandeau(e.message); });
                    };
                    if (!ok) { go(); return; }
                    var t = x.type === 'reinit' ? 'Accorder la réinitialisation ?' : 'Supprimer le compte de ' + (x.qui || x.mail) + ' ?';
                    var txt = x.type === 'reinit' ? 'Chacun de ses appareils effacera TRIGONE à sa prochaine ouverture. Son compte et sa sauvegarde restent.' : 'Tout ce que TRIGONE garde à son nom est effacé (adresse TRIGONE, carte, photo, sauvegarde, appareils). Irréversible.';
                    if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM(t, txt, x.type === 'reinit' ? 'Accorder' : 'Supprimer le compte', go, '⚠️', 'mascotte-poubelle.webp', true); else if (window.confirm(t)) go();
                };
            });
            var bs = f.querySelector('[data-suppr]');
            if (bs) bs.onclick = function() {
                var m1 = f.querySelector('#JUM-GC-MAIL').value.trim().toLowerCase(), m2 = f.querySelector('#JUM-GC-MAIL2').value.trim().toLowerCase(), err = f.querySelector('#JUM-GC-ERR2');
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m1)) { err.textContent = 'Adresse invalide.'; return; }
                if (m1 !== m2) { err.textContent = 'Les deux adresses ne correspondent pas.'; return; }
                var motif = f.querySelector('#JUM-GC-RAISON').value + (f.querySelector('#JUM-GC-PREC').value.trim() ? ' : ' + f.querySelector('#JUM-GC-PREC').value.trim() : '');
                var go = function() {
                    appelApi('compte/supprimer', { methode: 'POST', corps: { mail: m1, motif: motif, qui: window.JUMELAGE_QUI() } }).then(function() { bandeau('Compte ' + m1 + ' supprimé.'); charger(); }, function(e) { err.textContent = e.message; });
                };
                if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM('Supprimer ' + m1 + ' ?', 'Motif : ' + motif + '\n\nTout ce que TRIGONE garde au nom de cette personne est effacé, ses appareils s\'effacent à leur ouverture. Irréversible.', 'Supprimer le compte', go, '⚠️', 'mascotte-poubelle.webp', true);
                else if (window.confirm('Supprimer ' + m1 + ' ?')) go();
            };
        };
        var unite = null, filtre = '';
        var charger = function() {
            appelApi('compte/demandes').then(function(r) { donnees = r; NB_DEMANDES_COMPTE = (r.demandes || []).length; dessiner(); }, function(e) { erreurTxt = e.message; dessiner(); });
            appelApi('compte/unite').then(function(r) { unite = r; majInscriptions(r); dessiner(); }, function() { unite = { comptes: [], role: '' }; dessiner(); });
        };
        dessiner(); charger();
    };
    // Inscriptions en attente (dossier « Demandes de création de compte » de l'espace Assist Chorus DT) : relevées au
    // plus toutes les 30 s, et après chaque décision.
    var INSCRIPTIONS = null, INSCR_LE = 0, INSCR_EN_COURS = null;
    function majInscriptions(r) {
        var l = ((r && r.comptes) || []).filter(function(x) { return x.statut === 'attente' && !x.moi; }), avant = JSON.stringify(INSCRIPTIONS);
        INSCRIPTIONS = l; INSCR_LE = Date.now();
        if (avant !== JSON.stringify(l)) try { window.dispatchEvent(new Event('trigone-inscriptions')); } catch (e) {}
    }
    window.JUMELAGE_INSCRIPTIONS = function() { return (INSCRIPTIONS || []).slice(); };
    window.JUMELAGE_INSCRIPTIONS_ACTUALISER = function(forcer) {
        if (!monCompte() || !navigator.onLine || !(rolesLocaux().chorus || lireTxt(CLE_ROLE_ADMIN))) return Promise.resolve([]);
        if (INSCR_EN_COURS) return INSCR_EN_COURS;
        if (!forcer && Date.now() - INSCR_LE < 30000) return Promise.resolve(window.JUMELAGE_INSCRIPTIONS());
        INSCR_LE = Date.now();
        INSCR_EN_COURS = appelApi('compte/unite').then(function(r) { INSCR_EN_COURS = null; majInscriptions(r); return window.JUMELAGE_INSCRIPTIONS(); },
            function() { INSCR_EN_COURS = null; return window.JUMELAGE_INSCRIPTIONS(); });
        return INSCR_EN_COURS;
    };
    window.JUMELAGE_INSCRIPTION_DECIDER = function(mail, accepte) {
        var x = (INSCRIPTIONS || []).filter(function(y) { return y.mail === mail; })[0] || {}, qui = [x.grade, x.nom, x.prenom].filter(Boolean).join(' ') || x.adresse || mail;
        var go = function() {
            appelApi('compte/valider', { methode: 'POST', corps: { mail: mail, accepte: accepte } }).then(function() {
                bandeau(accepte ? '✔ ' + qui + ' : compte validé.' : 'Inscription de ' + qui + ' refusée.'); window.JUMELAGE_INSCRIPTIONS_ACTUALISER(true);
            }, function(e) { bandeau(e.message); window.JUMELAGE_INSCRIPTIONS_ACTUALISER(true); });
        };
        if (accepte) { go(); return; }
        if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM('Refuser l\'inscription de ' + qui + ' ?', 'Le compte et son adresse TRIGONE sont effacés.', 'Refuser', go, '⚠️', null, true);
        else if (window.confirm('Refuser l\'inscription de ' + qui + ' ?')) go();
    };
    window.JUMELAGE_INSCRIPTION_SCANNER = function() {
        window.JUMELAGE_SCANNER_CARTE({ titre: 'Valider une inscription', sous: 'Scannez le QR code de sa carte TRIGONE (verso).' }).then(function(c) {
            if (!c) return;
            if (!c.attente) { bandeau(window.JUMELAGE_CARTE_NOM(c) + ' : compte déjà validé.'); return; }
            appelApi('compte/valider-carte', { methode: 'POST', corps: { carte: c.id } }).then(function(x) { bandeau('✔ ' + x.qui + ' : compte validé.'); window.JUMELAGE_INSCRIPTIONS_ACTUALISER(true); }, function(e) { bandeau(e.message); });
        });
    };
    window.JUMELAGE_MES_APPAREILS = function() {
        if (window.JUMELAGE_FERMER_PARAMETRES) window.JUMELAGE_FERMER_PARAMETRES();
        var f = document.createElement('div'); f.className = 'JUM-GC-FOND'; document.body.appendChild(f);
        f.addEventListener('click', function(e) { if (e.target === f) f.remove(); });
        var dessiner = function(l, txt) {
            f.innerHTML = '<div class="JUM-GC-FEN"><button type="button" class="JUM-GC-X" aria-label="Fermer">✕</button><h3>📱 Mes appareils</h3>' + (txt ? '<p>' + esc(txt) + '</p>' :
                l.map(function(a) { return '<div class="JUM-GC-CPT"><div><b>' + esc(a.nom) + '</b>' + (a.moi ? '<i class="JUM-GC-ST ok">cet appareil</i>' : '') + '<small>Ajouté le ' + (a.cree ? new Date(a.cree).toLocaleDateString('fr-FR') : '—') + '</small></div>' +
                    (a.moi ? '' : '<div class="JUM-GC-ACT"><button type="button" class="JUM-R-SECOND" data-id="' + esc(a.id) + '">Retirer</button></div>') + '</div>'; }).join('') +
                '<p class="JUM-GC-VIDE">Un appareil retiré (perdu, volé, vendu) ne reçoit plus rien et s\'efface s\'il se reconnecte.</p>') + '</div>';
            f.querySelector('.JUM-GC-X').onclick = function() { f.remove(); };
            Array.prototype.forEach.call(f.querySelectorAll('[data-id]'), function(b) {
                b.onclick = function() {
                    var go = function() { appelApi('compte/appareils?id=' + encodeURIComponent(b.getAttribute('data-id')), { methode: 'DELETE' }).then(function(r) { bandeau('Appareil retiré.'); dessiner(r.appareils); }, function(e) { bandeau(e.message); }); };
                    if (typeof window.MSG_CONFIRM === 'function') window.MSG_CONFIRM('Retirer cet appareil ?', 'Il ne recevra plus rien et s\'effacera s\'il se reconnecte.', 'Retirer', go, '⚠️', null, true); else if (window.confirm('Retirer cet appareil ?')) go();
                };
            });
        };
        dessiner([], 'Chargement…');
        appelApi('compte/appareils').then(function(r) { dessiner(r.appareils); }, function(e) { dessiner([], e.message); });
    };
    // À l'ouverture (compte connecté) : unité transmise au serveur, demande en cours, réinitialisation accordée ou compte supprimé.
    function verifierCompteDistant() {
        var c = monCompte(); if (!c || !navigator.onLine) return;
        // Unité et identité (liste des comptes de l'unité, pour l'administrateur).
        var rg = lireReglages(), u = normeUnite(rg.unite), sigU = [u, rg.grade, rg.nom, rg.prenom].join('|');
        if (u && lireTxt('trigone_unite_publiee') !== sigU) appelApi('unite', { methode: 'POST', corps: { grade: rg.grade, nom: rg.nom, prenom: rg.prenom } }).then(function() { ecrireTxt('trigone_unite_publiee', sigU); }).catch(function() {});
        // Ancien compte (adresse mail personnelle) : il passe une fois pour toutes à son adresse TRIGONE.
        if (!/@trigone-app\.com$/.test(c.mail)) migrerVersTrigone(false);
        appelApi('compte/etat').then(function(r) {
            // Autre appareil du compte passé à son adresse TRIGONE : celui-ci suit.
            if (r.compte && r.compte !== (monCompte() || {}).mail) changerMailCompte((monCompte() || {}).mail, r.compte);
            // Compte en attente de validation : rappel une fois par ouverture ; validé : on le dit une fois.
            if (r.attente) {
                ecrireTxt(CLE_ATTENTE, '1');
                if (!sessionStorage.getItem('trigone_attente_vu')) { try { sessionStorage.setItem('trigone_attente_vu', '1'); } catch (e) {} bandeau('Compte en attente de validation par votre unité : montrez votre carte TRIGONE à un responsable.'); }
            } else if (lireTxt(CLE_ATTENTE)) { try { localStorage.removeItem(CLE_ATTENTE); } catch (e) {} bandeau('Compte TRIGONE validé : vous pouvez envoyer et recevoir.'); majBoutonsCompte(); }
            if (!r.reinit) return;
            appelApi('appareil', { methode: 'DELETE' }).catch(function() {}).then(function() { cleIdb('effacer').catch(function() {}).then(function() { toutEffacer('reinit'); }); });
        }, function() {});
        appelApi('compte/demandes').then(function(r) {
            NB_DEMANDES_COMPTE = (r.demandes || []).length;
            if (r.admin) ecrireTxt(CLE_ROLE_ADMIN, r.admin); else if (!r.superAdmin) { try { localStorage.removeItem(CLE_ROLE_ADMIN); } catch (e) {} }
            if (r.mienne) ecrireTxt(CLE_DEM_COMPTE, JSON.stringify(r.mienne)); else { try { localStorage.removeItem(CLE_DEM_COMPTE); } catch (e) {} }
            if (NB_DEMANDES_COMPTE && (rolesLocaux().chorus || r.admin || r.superAdmin) && !sessionStorage.getItem('trigone_dem_compte_vu')) {
                try { sessionStorage.setItem('trigone_dem_compte_vu', '1'); } catch (e) {}
                bandeau(NB_DEMANDES_COMPTE + ' demande' + (NB_DEMANDES_COMPTE > 1 ? 's' : '') + ' sur les comptes : Paramètres › Compte.');
            }
        }, function() {});
    }
    function migrerVersTrigone(forcer) {
        var c = monCompte(), rg = lireReglages(); if (!c) return Promise.resolve(null);
        return appelApi('compte/migrer', { methode: 'POST', corps: { prenom: rg.prenom, nom: rg.nom, forcer: !!forcer } }).then(function(m) {
            if (!m || !m.ok || !m.mail || m.mail === c.mail) return m;
            changerMailCompte(c.mail, m.mail);
            infoCompte('Votre compte TRIGONE change d\'adresse', 'Votre compte est désormais ' + m.mail + '.\n\nVos demandes, comptes-rendus, rôles, carte et sauvegarde suivent. Votre ancienne adresse mail n\'est plus enregistrée dans TRIGONE ; ce qui y est encore envoyé vous parvient quand même.\n\nNouvel appareil : Paramètres › Compte › « Ajouter un appareil » (code de liaison).');
            return m;
        }).catch(function() { return null; });
    }
    window.JUMELAGE_MIGRER = function() { return migrerVersTrigone(true); };   // tests locaux (le serveur de test ne migre que sur demande)
    function changerMailCompte(ancien, neuf) {
        var c = monCompte(); if (!c || !neuf) return;
        c.mail = neuf; ecrireTxt(CLE_COMPTE, JSON.stringify(c));
        var rg = lireReglages(); if (!rg.monMail || rg.monMail === ancien) { rg.monMail = neuf; ecrireReglages(rg); }
        var carte = lireJSON(CLE_CARTE); if (carte && carte.mail === ancien) { carte.mail = neuf; ecrireTxt(CLE_CARTE, JSON.stringify(carte)); }
        try { localStorage.removeItem(CLE_ADRESSE); } catch (e) {}
        majBoutonsCompte();
    }
    // Message simple, dans l'appli ouverte (message centré) ou sur l'écran d'accueil ; apres : à la fermeture.
    function infoCompte(titre, texte, apres) {
        if (typeof window.AFFICHER_MSG_CENTRE === 'function') window.AFFICHER_MSG_CENTRE({ titre: titre, texte: texte, icone: 'ℹ️', boutons: [{ label: 'Compris', action: apres }] });
        else if (ecran) { carteChoix(titre, texte, 'info'); if (apres) setTimeout(apres, 300); }
        else { window.alert(titre + '\n\n' + texte); if (apres) apres(); }
    }
    if (lireTxt('trigone_reactivation')) setTimeout(function() {
        try { localStorage.removeItem('trigone_reactivation'); } catch (e) {}
        if (monCompte() && window.JUMELAGE_RESTAURER_COMPTE) window.JUMELAGE_RESTAURER_COMPTE({ apresConnexion: true, sinon: function() { if (!window.JUMELAGE_REGLAGES_FAITS()) window.JUMELAGE_REGLAGES({ premiere: true, profil: true }); } });
    }, 2500);
    window.JUMELAGE_COMPTE_SUPPRIME = function() { cleIdb('effacer').catch(function() {}).then(function() { toutEffacer('supprime'); }); };
    setTimeout(verifierCompteDistant, 2500);
    // Parcours de première connexion interrompu (appli fermée en route) : il reprend, une fois le code d'accès saisi.
    (function reprendreParcours(essais) {
        setTimeout(function() {
            if (!window.JUMELAGE_PARCOURS_EN_COURS() || reglages) return;
            if (codeDefini() && !window.JUMELAGE_DEVERROUILLE()) { if (essais < 120) reprendreParcours(essais + 1); return; }
            window.JUMELAGE_REGLAGES({ premiere: true, profil: true });
        }, essais ? 1000 : 1800);
    })(0);
    window.addEventListener('online', function() { setTimeout(verifierCompteDistant, 2000); });
    (function() {
        var m = ''; try { m = sessionStorage.getItem('trigone_efface_motif') || ''; sessionStorage.removeItem('trigone_efface_motif'); } catch (e) {}
        if (!m || (m !== 'reinit' && m !== 'supprime')) return;
        setTimeout(function() { carteChoix(m === 'reinit' ? 'TRIGONE réinitialisé' : 'Compte TRIGONE supprimé', m === 'reinit' ? 'Votre demande a été accordée : TRIGONE repart comme au premier jour sur cet appareil. Reconnectez-vous avec votre adresse ; « Restaurer depuis mon compte » remet votre sauvegarde.'
            : 'Votre compte TRIGONE a été supprimé par votre assistant Chorus DT ou l\'administrateur de votre unité : toutes les données de TRIGONE ont été effacées de cet appareil.', 'info'); }, 1500);
    })();
    if (/[?&]espace=comptes/.test(location.search)) setTimeout(function() { if (monCompte()) window.JUMELAGE_GESTION_COMPTES(); }, 1800);
    window.JUMELAGE_CODE_OUBLIE = function() {
        confirmerEffacement('Code oublié ?',
            'Il n\'existe aucun moyen de récupérer votre code. La seule solution est d\'effacer toutes les données de TRIGONE sur cet appareil (demandes, comptes-rendus, réglages). Cette action est irréversible.',
            'Oui, tout effacer et recommencer');
    };
    function demanderCode() {
        if (pave || !document.body) return;
        saisie = '';
        pave = document.createElement('div');
        pave.className = 'JUM-PIN';
        var bio = bioActive() && !!window.PublicKeyCredential;
        var touches = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'x'].map(function(t) {
            if (t === '' && bio) return '<button type="button" class="JUM-PIN-BIO" aria-label="Déverrouiller avec l\'empreinte" onclick="JUMELAGE_PIN_BIO()">' + SVG_EMPREINTE + '</button>';
            return t === '' ? '<span></span>' : '<button type="button" onclick="JUMELAGE_PIN_TOUCHE(\'' + t + '\')">' + (t === 'x' ? '⌫' : t) + '</button>';
        }).join('');
        var pc = window.matchMedia && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
        var points = '<div class="JUM-PIN-POINTS"><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span></div>';
        if (!pc && bio) {
            // Téléphone avec empreinte : écran TRIGONE (le code à 4 chiffres s'affiche sur demande ou si l'empreinte échoue).
            pave.className = 'JUM-PIN bio';
            var qui = window.JUMELAGE_QUI ? window.JUMELAGE_QUI() : '';
            pave.innerHTML = '<div class="JUM-PIN-CARTE"><img class="JUM-BIOV-LOGO" src="' + (DANS_CR ? '../' : '') + 'phoenix-icon.png" alt=""><div class="JUM-BIOV-NOM">TRIGONE</div>' +
                '<button type="button" class="JUM-BIOV-ROND" aria-label="Déverrouiller avec l\'empreinte" onclick="JUMELAGE_PIN_BIO()">' + SVG_EMPREINTE + '</button>' +
                '<div class="JUM-BIOV-T1">Bonjour' + (qui ? ', <span>' + esc(qui) + '</span>' : '') + '</div><div class="JUM-BIOV-T2">Posez votre doigt pour ouvrir TRIGONE</div>' +
                '<button type="button" class="JUM-R-LIEN JUM-BIOV-VERS" onclick="JUMELAGE_PIN_MODE_CODE()">Utiliser mon code</button>' +
                '<div class="JUM-PIN-ERREUR"></div>' +
                '<div class="JUM-BIOV-CODE">' + points + '<div class="JUM-PIN-PAVE">' + touches + '</div>' +
                '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_CODE_OUBLIE()">Code oublié ?</button></div></div>';
        } else if (!pc) pave.innerHTML = '<div class="JUM-PIN-CARTE"><div class="JUM-PIN-TITRE">Code d\'accès</div><p>' + (bio ? 'Posez votre doigt, ou entrez votre code à 4 chiffres.' : 'Entrez votre code à 4 chiffres pour ouvrir TRIGONE.') + '</p>' +
            '<div class="JUM-PIN-POINTS"><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span></div>' +
            '<div class="JUM-PIN-ERREUR"></div><div class="JUM-PIN-PAVE">' + touches + '</div>' +
            '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_CODE_OUBLIE()">Code oublié ?</button></div>';
        else {
            // PC : écran d'accès sobre, aux couleurs de TRIGONE ; saisie au clavier (les cases restent cliquables).
            pave.className = 'JUM-PIN JUM-PIN-PC' + (window.JUMELAGE_THEME && window.JUMELAGE_THEME() ? ' sombre' : '');
            var maintenant = new Date();
            var date = maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            pave.innerHTML = '<div class="JUM-PINPC">' +
                '<div class="JUM-PINPC-MARQUE"><img src="' + (DANS_CR ? '../' : '') + 'phoenix-icon.png" alt="">' +
                    '<div class="JUM-PINPC-NOM">TRIGONE</div><div class="JUM-PINPC-SOUS">Mise en route · Compte-rendu de mission</div>' +
                    '<div class="JUM-PINPC-DATE"><b class="JUM-PINPC-HEURE"></b><span>' + date + '</span></div>' +
                    '<div class="JUM-PINPC-NOTE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('cadenas') : '') + 'Vos données restent sur cet appareil.</div></div>' +
                '<div class="JUM-PINPC-SAISIE"><div class="JUM-PINPC-IC">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('cadenas') : '') + '</div>' +
                    '<h2>Accès sécurisé</h2><p>Saisissez votre code d\'accès à 4 chiffres.</p>' +
                    '<div class="JUM-PIN-POINTS"><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span></div>' +
                    '<div class="JUM-PIN-ERREUR"></div>' +
                    '<div class="JUM-PINPC-AIDE"><span>Clavier</span> tapez les chiffres · <span>⌫</span> pour corriger</div>' +
                    '<div class="JUM-PIN-PAVE">' + touches + '</div>' +
                    '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_CODE_OUBLIE()">Code oublié ?</button></div></div>';
            var heure = pave.querySelector('.JUM-PINPC-HEURE');
            var tic = function() { if (!pave) return; heure.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); setTimeout(tic, 15000); };
            tic();
        }
        document.body.appendChild(pave); dessinerPoints();
        if (bio) setTimeout(function() { window.JUMELAGE_PIN_BIO(true); }, 350);   // l'empreinte est proposée d'office ; le code reste là
        document.addEventListener('keydown', function clavier(e) {
            if (!pave) { document.removeEventListener('keydown', clavier); return; }
            if (/^\d$/.test(e.key)) window.JUMELAGE_PIN_TOUCHE(e.key); else if (e.key === 'Backspace') window.JUMELAGE_PIN_TOUCHE('x');
        });
    }
    // ---------- Bouton « retour » du téléphone ----------
    // Chaque fenêtre de TRIGONE ajoute une étape à l'historique : « retour » ferme la fenêtre du dessus au lieu de quitter
    // l'appli. Une fenêtre ouverte depuis Paramètres y ramène, sur la même rubrique. Une fenêtre fermée par ses boutons
    // rend son étape (sauf si une autre s'ouvre aussitôt à sa place : Paramètres › ligne choisie).
    var FENETRES_RETOUR = ['JUM-PARAM', 'JUM-REGLAGES', 'JUM-SIG', 'JUM-PARTAGE', 'JUM-CPT-MENU', 'JUM-PRES'];
    var pileRetour = [], retoursIgnores = 0, fenetreQuittee = null;
    function estFenetreRetour(el) { return el.nodeType === 1 && FENETRES_RETOUR.some(function(c) { return el.classList.contains(c); }); }
    function fermerFenetre(el) {
        if (el._fermer) { el._fermer(); return; }
        if (el.classList.contains('JUM-PRES')) { var b = el.querySelector('.JUM-PRES-BTN'); if (b) { b.click(); return; } }
        for (var i = 0; i < fermeurs.length && el.isConnected; i++) if (fermeurs[i][0]() === el) fermeurs[i][1]();
        if (el.isConnected) el.remove();
    }
    function fenetreAjoutee(el) {
        var etape = { el: el, rubrique: null };
        if (fenetreQuittee) {
            // Remplace la fenêtre qui vient de se fermer : même étape d'historique ; ouverte depuis Paramètres → y revenir.
            clearTimeout(fenetreQuittee.minuteur);
            etape.rubrique = fenetreQuittee.el.classList.contains('JUM-PARAM') ? fenetreQuittee.el.getAttribute('data-rubrique') : fenetreQuittee.rubrique;
            fenetreQuittee = null;
        } else {
            try { history.pushState({ trigone: 1 }, ''); } catch (e) { return; }
        }
        pileRetour.push(etape);
        // Ouverte depuis Paramètres : flèche « ‹ Paramètres » en haut à gauche, pour y revenir (même rubrique) sans repartir du début.
        if (etape.rubrique && el.classList.contains('JUM-CARTE-FEN')) el._depuisParam = true;
        if (etape.rubrique && !el.classList.contains('JUM-CARTE-FEN') && !el.classList.contains('JUM-NOTICE') && !el.classList.contains('JUM-CARTE-PLEIN') && !el.classList.contains('JUM-CPT-MENU') && !el.querySelector(':scope > .JUM-RETOUR-PARAM')) {
            var r = document.createElement('button'); r.type = 'button'; r.className = 'JUM-RETOUR-PARAM'; r.setAttribute('aria-label', 'Revenir aux Paramètres');
            r.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Paramètres</span>';
            ['pointerdown', 'pointerup', 'click'].forEach(function(t) { r.addEventListener(t, function(e) { e.stopPropagation(); }); });
            r.addEventListener('click', function() { revenirParametres(el); });
            // Dans la fenêtre elle-même, tout en haut, juste au-dessus de son titre.
            var carte = el.firstElementChild && el.firstElementChild !== r ? el.firstElementChild : null;
            if (carte) { r.classList.add('dans-carte'); carte.insertBefore(r, carte.firstChild); } else { el.appendChild(r); el.classList.add('avec-retour'); }
        }
    }
    var flecheFlottante = null;
    function retirerRetourFlottant() { if (flecheFlottante) { flecheFlottante.remove(); flecheFlottante = null; } }
    function retourFlottant(rub) {
        retirerRetourFlottant();
        var r = document.createElement('button'); r.type = 'button'; r.className = 'JUM-RETOUR-PARAM flottant'; r.setAttribute('aria-label', 'Revenir aux Paramètres');
        r.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Paramètres</span>';
        r.addEventListener('click', function(e) {
            e.stopPropagation(); retirerRetourFlottant();
            // Fenêtre de l'appli ouverte depuis Paramètres (ex. Réglages du compte-rendu) : refermée en revenant.
            var mp = document.getElementById('PARAMS-MODAL');
            if (mp && typeof window.FERMER_PARAMETRES === 'function' && getComputedStyle(mp).display !== 'none' && !mp.classList.contains('HIDDEN')) window.FERMER_PARAMETRES();
            window.JUMELAGE_PARAMETRES(rub);
        });
        document.body.appendChild(r); flecheFlottante = r;
    }
    window.JUMELAGE_RETIRER_RETOUR_PARAM = retirerRetourFlottant;
    // Flèche « ‹ Paramètres » : comme le bouton retour du téléphone (ferme la fenêtre, rouvre Paramètres sur sa rubrique).
    function revenirParametres(el) {
        if (pileRetour.length && pileRetour[pileRetour.length - 1].el === el) { history.back(); return; }
        var rub = null; pileRetour.forEach(function(x) { if (x.el === el) rub = x.rubrique; });
        fermerFenetre(el); if (window.JUMELAGE_PARAMETRES) window.JUMELAGE_PARAMETRES(rub || undefined);
    }
    function fenetreRetiree(el) {
        for (var i = pileRetour.length - 1; i >= 0; i--) if (pileRetour[i].el === el) break;
        if (i < 0) return;
        var etape = pileRetour.splice(i, 1)[0];
        if (fenetreQuittee) { clearTimeout(fenetreQuittee.minuteur); retoursIgnores++; history.back(); }
        fenetreQuittee = { el: el, rubrique: etape.rubrique, minuteur: setTimeout(function() { fenetreQuittee = null; retoursIgnores++; history.back(); }, 350) };
    }
    window.addEventListener('popstate', function() {
        if (retoursIgnores) { retoursIgnores--; return; }
        var etape = pileRetour.pop();
        if (!etape) { if (history.state && history.state.trigone) history.back(); return; }   // étape restée d'avant un rechargement
        fermerFenetre(etape.el);
        if (etape.rubrique && window.JUMELAGE_PARAMETRES) window.JUMELAGE_PARAMETRES(etape.rubrique);
    });
    function suivreFenetres() {
        if (history.state && history.state.trigone) history.back();
        new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                Array.prototype.forEach.call(m.removedNodes, function(n) { if (estFenetreRetour(n)) fenetreRetiree(n); });
                Array.prototype.forEach.call(m.addedNodes, function(n) { if (estFenetreRetour(n) && n.isConnected) fenetreAjoutee(n); });
            });
        }).observe(document.body, { childList: true });
    }
    if (document.body) suivreFenetres(); else document.addEventListener('DOMContentLoaded', suivreFenetres);
    window.JUMELAGE_PIN_MODE_CODE = function() { if (pave) pave.classList.add('code'); };
    window.JUMELAGE_CODE_ACTIF = codeActif;
    if (!DEMENAGEMENT && !RECEPTION_DEMENAGEMENT && codeActif() && !(window.JUMELAGE_DEVERROUILLE && window.JUMELAGE_DEVERROUILLE())) {
        if (document.body) demanderCode(); else document.addEventListener('DOMContentLoaded', demanderCode);
    }

    // ---------- Saisie en majuscules (tout sauf le prénom, les mails et les codes) ----------
    function enMajuscules(el) {
        if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
        if (el.dataset && el.dataset.noUppercase) return false;
        if (el instanceof HTMLTextAreaElement && el.getAttribute('data-path') !== 'objet') return false;
        var type = (el.type || 'text').toLowerCase();
        if (type !== 'text' && type !== 'search' && el instanceof HTMLInputElement) return false;
        var nom = [el.id, el.name, el.getAttribute('data-path'), el.getAttribute('autocomplete')].join(' ');
        if (/pr[ée]nom|mail|code-acces|CODE-ACCES|pin/i.test(nom)) return false;
        return true;
    }
    document.addEventListener('input', function(e) {
        var el = e.target;
        if (!enMajuscules(el)) return;
        var up = el.value.toUpperCase();
        if (up === el.value) return;
        var a = el.selectionStart, b = el.selectionEnd;
        el.value = up;
        try { el.setSelectionRange(a, b); } catch (err) {}
    }, true);


    var FLECHE_GO = '<span class="JUM-GO" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
    var DESC_APPLIS = {
        mer: 'Demande d\'ordre de mise en route individuelle ou collective, signée par les deux valideurs.',
        cr: 'Horodatage, frais calculés, envoi du compte-rendu et des justificatifs en un seul PDF.'
    };
    function panneau(cle) {
        var a = APPLIS[cle];
        return '<div class="JUM-PAN JUM-PAN-' + cle.toUpperCase() + '" data-app="' + cle + '" role="button" tabindex="0" aria-label="Ouvrir ' + a.nom + '">' +
            '<div class="JUM-BLOC"><img src="' + a.logo + '" alt="' + a.nom + '"><span class="JUM-SOUS">' + a.sous + '</span>' +
            '<p class="JUM-DESC">' + DESC_APPLIS[cle] + '</p><span class="JUM-ETAT"></span></div>' + FLECHE_GO + '</div>';
    }
    // Espace Assistant Chorus DT : son logo et ce qui l'attend (demandes validées, comptes-rendus reçus).
    function panneauChorus() {
        return '<div class="JUM-PAN JUM-PAN-CHORUS" data-app="chorus" role="button" tabindex="0" aria-label="Ouvrir l\'espace Assistant Chorus DT">' +
            '<div class="JUM-BLOC-CHORUS"><div class="JUM-CHORUS-LOGO"><button type="button" class="JUM-CHORUS" aria-label="Ouvrir l\'espace Assistant Chorus DT" title="Assistant Chorus DT"><img src="' + LOGO_CHORUS + '" alt="TRIGONE Assist Chorus-DT"></button>' + (lireTxt(CLE_ROLE_ADMIN) ? '<span class="JUM-CHORUS-ADMIN">ADMINISTRATEUR</span>' : '') + '</div>' +
            '<div class="JUM-CPTS"><span class="JUM-SOUS">Mon espace</span>' +
                '<div class="JUM-CPT-L" data-cpt="chorus"><b>0</b><span>Demandes validées à traiter</span></div>' +
                '<div class="JUM-CPT-L" data-cpt="cr"><b>0</b><span>Comptes-rendus reçus</span></div></div></div>' + FLECHE_GO + '</div>';
    }
    // État du moment sous chaque logo : demande en cours de validation (ou refusée), mission commencée non envoyée.
    var LIB_ETAPES_HUB = { val1: 'Demande chez le VALIDEUR 1', val2: 'Demande chez le VALIDEUR 2', chorus: 'Demande chez l\'assistant Chorus DT', renvoi: 'Demande renvoyée : à corriger', refus: 'Demande refusée : à corriger' };
    function majEtatsHub() {
        if (!ecran || !ecran.classList.contains('JUM-V2')) return;
        var em = ecran.querySelector('.JUM-PAN-MER .JUM-ETAT'), ec = ecran.querySelector('.JUM-PAN-CR .JUM-ETAT');
        if (em) {
            var txt = '', alerte = false;
            if (!ecran.querySelector('.JUM-PAN-MER .JUM-BOITE-PASTILLE')) {
                var sv = window.JUMELAGE_SUIVI(), der = null;
                Object.keys(sv).forEach(function(k) { var x = sv[k]; if (x && x.genre !== 'cr' && !x.intervenant && LIB_ETAPES_HUB[x.etape] && (!der || (x.le || 0) > (der.le || 0))) der = x; });
                if (der) { txt = LIB_ETAPES_HUB[der.etape]; alerte = der.etape === 'refus' || der.etape === 'renvoi'; }
            }
            em.textContent = txt; em.classList.toggle('alerte', alerte);
        }
        if (ec) {
            var m = lireJSON('mission_data'), t2 = '';
            if (m && !m.MAIL_SENT && !m.IS_PAX && (m.DEBUT || m.ARR_SITE)) t2 = 'Mission en cours' + (m.DEBUT ? ' depuis le ' + String(m.DEBUT).split(' ')[0] : '');
            ec.textContent = t2;
        }
        var l = boiteLire().filter(function(x) { return x.statut !== 'traite'; });
        [['chorus', 'chorus'], ['cr', 'cr']].forEach(function(c) {
            var el = ecran.querySelector('.JUM-CPT-L[data-cpt="' + c[0] + '"]'); if (!el) return;
            var n = l.filter(function(x) { return x.nature === c[1]; }).reduce(function(t, x) { return t + (x.n > 1 ? x.n : 1); }, 0);
            el.querySelector('b').textContent = n; el.classList.toggle('zero', !n);
        });
    }
    window.addEventListener('trigone-suivi', majEtatsHub);
    // Côté touché : au-dessus ou au-dessous de la diagonale haut-droite → bas-gauche.
    function coteDuPoint(x, y) { return (x / window.innerWidth + y / window.innerHeight) < 1 ? 'mer' : 'cr'; }

    // Le panneau touché grandit depuis sa place jusqu'à remplir l'écran (son logo glisse au centre et grossit),
    // pendant que les autres s'effacent. Rend la durée de l'animation (0 : mouvement réduit, ou ancien écran).
    function deployer(pan) {
        var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!pan || reduit || !ecran.classList.contains('JUM-V2')) { if (pan) pan.classList.add('plein'); return 0; }
        var r = pan.getBoundingClientRect(), e = ecran.getBoundingClientRect();
        pan.style.left = (r.left - e.left) + 'px'; pan.style.top = (r.top - e.top) + 'px';
        pan.style.width = r.width + 'px'; pan.style.height = r.height + 'px';
        pan.classList.add('deploie', 'plein');
        void pan.offsetWidth;   // position de départ prise en compte avant l'agrandissement
        pan.style.left = '0px'; pan.style.top = '0px'; pan.style.width = e.width + 'px'; pan.style.height = e.height + 'px';
        pan.classList.add('grand');
        return 620;
    }
    function choisir(cle) {
        if (!ecran || ecran.classList.contains('choisi')) return;
        if (cle === 'chorus') {
            ecran.classList.add('choisi', 'choix-chorus');
            var dureeC = deployer(ecran.querySelector('.JUM-PAN-CHORUS'));
            var surPlace = !DANS_CR && typeof window.MER_OUVRIR_CHORUS === 'function';
            setTimeout(function() {
                if (window.JUMELAGE_OUVRIR_CHORUS() || surPlace) { ecran.classList.add('sortie'); setTimeout(function() { if (ecran) { ecran.remove(); ecran = null; } document.documentElement.classList.remove('jum-choix'); }, 460); }
            }, Math.max(380, dureeC + 80));
            return;
        }
        ecran.classList.add('choisi', 'choix-' + cle);
        try { sessionStorage.setItem(CLE_CHOIX, '1'); } catch (e) {}
        var pan = ecran.querySelector('.JUM-PAN-' + cle.toUpperCase());
        pan.classList.remove('appuye');
        var duree = deployer(pan), fin = Math.max(540, duree + 120);
        if (cle === ICI) {
            // L'appli était peut-être restée sur une autre page (espace Assistant Chorus DT) : elle revient à son accueil.
            if (typeof window.JUMELAGE_APRES_CHOIX === 'function') { try { window.JUMELAGE_APRES_CHOIX(cle); } catch (e) {} }
            setTimeout(function() { ecran.classList.add('sortie'); }, fin);
            setTimeout(function() { if (ecran) { ecran.remove(); ecran = null; } document.documentElement.classList.remove('jum-choix'); }, fin + 460);
        } else {
            try { sessionStorage.setItem(CLE_BASCULE, '1'); } catch (e) {}
            // replace : pas d'entrée dans l'historique, la flèche retour du téléphone ne ramène pas à l'autre appli.
            setTimeout(function() { location.replace(APPLIS[cle].url); }, Math.max(600, duree + 80));
        }
    }

    // Le logo Assist Chorus-DT ne doit jamais recouvrir les deux autres (sinon un appui sur eux ouvrirait Chorus) :
    // s'il les touche encore (écran de forme inhabituelle), il rétrécit jusqu'à laisser un petit écart.
    function placerChorus() {
        if (!ecran) return;
        var c = ecran.querySelector('.JUM-CHORUS'); if (!c || ecran.classList.contains('JUM-V2')) return;
        ecran.style.removeProperty('--jum-chorus');
        var blocs = Array.prototype.slice.call(ecran.querySelectorAll('.JUM-BLOC'));
        function touche() {
            var a = c.getBoundingClientRect();
            return blocs.some(function(bl) {
                var b = bl.getBoundingClientRect(), m = 8;
                return a.left < b.right + m && b.left < a.right + m && a.top < b.bottom + m && b.top < a.bottom + m;
            });
        }
        var w = c.getBoundingClientRect().width;
        while (w > 56 && touche()) { w -= 6; ecran.style.setProperty('--jum-chorus', w + 'px'); }
    }
    window.addEventListener('resize', function() { if (ecran) requestAnimationFrame(placerChorus); });

    // Passage direct à l'autre appli (menu PC) : sans écran de choix ni entrée d'historique.
    window.JUMELAGE_ALLER = function(cle) {
        if (!APPLIS[cle]) return;
        if (cle === ICI) return;
        try { sessionStorage.setItem(CLE_BASCULE, '1'); sessionStorage.setItem(CLE_CHOIX_FAIT, '1'); } catch (e) {}
        location.replace(APPLIS[cle].url);
    };

    window.JUMELAGE_CHOIX = function() {
        if (ecran || !document.body) return;
        if (document.body.classList.contains('demo-active')) return;
        ecran = document.createElement('div');
        ecran.className = 'JUM-CHOIX JUM-V2';
        ecran.setAttribute('role', 'dialog');
        ecran.setAttribute('aria-label', 'Choisir une application TRIGONE');
        ecran.innerHTML = panneau('mer') + panneau('cr') +
            '<svg class="JUM-TRAIT" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
            '<line x1="100" y1="0" x2="0" y2="100" stroke="#d6a756" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity="0.8"/></svg>' +
            // Assistant Chorus DT : son logo au centre, sur la diagonale, entre Mise en route et Compte-rendu.
            (roleChorus() ? panneauChorus() : '') +
            // Numéro de version, en haut à droite (le même dans les deux applis).
            (window.APP_VERSION_AFFICHEE ? '<div class="JUM-VERSION" title="Version de TRIGONE">V' + window.APP_VERSION_AFFICHEE + '</div>' : '') +
            // Mise à jour, en bas à gauche (pendant de la roue crantée).
            '<button type="button" class="JUM-ROUE JUM-MAJ-BTN" aria-label="Mise à jour de TRIGONE" title="Mise à jour">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('maj') : '') + '</button>';
        // Mon compte, en haut à droite : « Se connecter », ou la pastille du compte et son menu.
        ecran.appendChild(creerBoutonCompte());
        // Ma carte TRIGONE, juste à gauche du compte : accès direct.
        var btnCarte = document.createElement('button');
        btnCarte.type = 'button'; btnCarte.className = 'JUM-CARTE-ACCES'; btnCarte.title = 'Ma carte TRIGONE'; btnCarte.setAttribute('aria-label', 'Ma carte TRIGONE');
        btnCarte.innerHTML = '<i></i><span>Ma carte</span>';
        ['pointerdown', 'pointerup'].forEach(function(t) { btnCarte.addEventListener(t, function(e) { e.stopPropagation(); }); });
        btnCarte.addEventListener('click', function(e) { e.stopPropagation(); window.JUMELAGE_CARTE(); });
        ecran.appendChild(btnCarte);
        // Paramètres et Notice TRIGONE : à gauche de « Ma carte », sans passer par le menu du compte.
        var btnParam = creerBoutonParam(), btnNotice = creerBoutonNotice();
        ecran.appendChild(btnParam); ecran.appendChild(btnNotice);
        var placerCarte = function() {
            var cpt = ecran && ecran.querySelector(':scope > .JUM-CPT'); if (!cpt || !btnCarte.isConnected) return;
            var r = cpt.getBoundingClientRect(); if (!r.width) return;
            var rangee = [btnCarte, btnParam, btnNotice];
            var poser = function(droite, haut) {
                rangee.forEach(function(b) { b.style.right = Math.round(droite) + 'px'; b.style.top = Math.round(haut + (r.height - b.offsetHeight) / 2) + 'px'; droite += b.offsetWidth + 8; });
            };
            poser(window.innerWidth - r.left + 10, r.top);
            // Petit écran (nom long, texte agrandi) : pas la place à gauche du compte sans toucher le n° de version → juste dessous.
            var v = ecran.querySelector('.JUM-VERSION'), rv = v && v.getBoundingClientRect(), rc = btnNotice.getBoundingClientRect();
            if (rv && rv.width && rc.left < rv.right + 8) poser(window.innerWidth - r.right, r.bottom + 8 - (r.height - btnCarte.offsetHeight) / 2);
        };
        requestAnimationFrame(placerCarte); setTimeout(placerCarte, 400); setTimeout(placerCarte, 1500);
        window.addEventListener('resize', placerCarte);
        // Affichage PC (tablette, pliable ouvert), en bas à gauche à côté de la mise à jour.
        ecran.appendChild(creerBoutonModePc());
        // Téléphone : la même chose dans une barre d'outils en bas (CSS : visible seulement sous 1 100 px de large).
        var dock = document.createElement('nav'); dock.className = 'JUM-DOCK'; dock.setAttribute('aria-label', 'Outils TRIGONE');
        var icDock = ICONES_DOCK;
        dock.innerHTML = '<div class="JUM-DOCK-BARRE">' +
            '<button type="button" data-d="notice">' + icDock.notice + 'Notice</button>' +
            '<button type="button" data-d="param">' + ROUE_SVG + 'Paramètres</button>' +
            '<button type="button" data-d="carte">' + icDock.carte + 'Ma carte</button>' +
            '<button type="button" data-d="maj" class="JUM-DOCK-MAJ">' + icDock.maj + 'Mise à jour</button>' +
            '<button type="button" data-d="pc" class="JUM-DOCK-PC"></button></div>';
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { dock.addEventListener(t, function(e) { e.stopPropagation(); }); });
        dock.addEventListener('click', function(e) {
            var b = e.target.closest('button'); if (!b) return;
            var d = b.getAttribute('data-d');
            if (d === 'notice') btnNotice.click();
            else if (d === 'param') btnParam.click();
            else if (d === 'carte') window.JUMELAGE_CARTE();
            else if (d === 'maj') verifierMajManuelle();
            else if (d === 'pc') window.JUMELAGE_MODE_PC();
        });
        ecran.appendChild(dock); majBoutonsModePc();
        var badge = ecran.querySelector('.JUM-VERSION');
        if (badge) {
            ['pointerdown', 'pointerup'].forEach(function(t) { badge.addEventListener(t, function(e) { e.stopPropagation(); }); });
            badge.addEventListener('click', function(e) { e.stopPropagation(); carteChoix('TRIGONE V' + (window.APP_VERSION_AFFICHEE || ''), window.JUMELAGE_INFOS_ECRAN(), 'info'); });
        }
        majBoutonsCompte();
        majPastilleHub();
        var btnChorus = ecran.querySelector('.JUM-CHORUS');
        if (btnChorus) {
            ['pointerdown', 'pointerup'].forEach(function(t) { btnChorus.addEventListener(t, function(e) { e.stopPropagation(); }); });
            btnChorus.addEventListener('click', function(e) { e.stopPropagation(); choisir('chorus'); });
        }
        var majBtn = ecran.querySelector('.JUM-MAJ-BTN');
        ['pointerdown', 'pointerup'].forEach(function(t) { majBtn.addEventListener(t, function(e) { e.stopPropagation(); }); });
        majBtn.addEventListener('click', function(e) { e.stopPropagation(); verifierMajManuelle(); });
        ecran.addEventListener('click', function(e) {
            var menu = document.querySelector('.JUM-ROUE-MENU');
            if (menu) { menu.remove(); return; }
            if (fermerMenuCompte()) return;
            var pan = e.target.closest && e.target.closest('.JUM-PAN');
            if (pan) choisir(pan.getAttribute('data-app'));
        });
        ecran.addEventListener('pointerdown', function(e) {
            var p = e.target.closest && e.target.closest('.JUM-PAN');
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
        if (btnChorus) {
            ecran.classList.add('avec-chorus');
            placerChorus();
            Array.prototype.forEach.call(ecran.querySelectorAll('img'), function(im) { if (!im.complete) im.addEventListener('load', placerChorus); });
        }
        setTimeout(annoncerNouveautes, 1200);
    };

    // ---------- Nouveautés et mise à jour, sur l'écran de choix ----------
    // Le message « Nouveautés » d'une version n'apparaît qu'une fois, ici, et plus dans chaque appli.
    var CLE_NOUVEAUTES = 'trigone_nouveautes_vue';
    function manifesteMaj() {
        return fetch((DANS_CR ? '../' : '') + 'updates-manifest.json?t=' + Date.now(), { cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : null; });
    }
    // action (facultatif) : { libelle, faire } — la carte devient une confirmation « Annuler / libelle ».
    function carteChoix(titre, texte, icone, ton, mascotte, action) {
        if (!ecran) return;
        var ancienne = ecran.querySelector('.JUM-NOUV'); if (ancienne) ancienne.remove();
        var c = document.createElement('div');
        c.className = 'JUM-NOUV';
        c.innerHTML = '<div class="JUM-NOUV-CARTE' + (mascotte ? ' avec-mascotte' : '') + '"><span class="JUM-NOUV-IC"' + (ton ? ' data-ton="' + ton + '"' : '') + '>' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE(icone) : '') + '</span>' +
            '<h2></h2><p></p>' + (action ? '<div class="JUM-NOUV-BTNS"><button type="button" class="JUM-NOUV-SECOND">Annuler</button><button type="button" class="JUM-NOUV-OK"></button></div>' : '<button type="button">J\'ai compris</button>') +
            (mascotte ? '<img class="JUM-NOUV-MASCOTTE" src="' + mascotte + '" alt="">' : '') + '</div>';
        c.querySelector('h2').textContent = titre; c.querySelector('p').textContent = texte;
        ['pointerdown', 'pointerup', 'click'].forEach(function(t) { c.addEventListener(t, function(e) { e.stopPropagation(); }); });
        var fermer = function() { c.classList.add('sortie'); setTimeout(function() { c.remove(); }, 250); };
        if (action) {
            c.querySelector('.JUM-NOUV-OK').textContent = action.libelle;
            c.querySelector('.JUM-NOUV-OK').addEventListener('click', function() { fermer(); action.faire(); });
        }
        c.querySelector('button').addEventListener('click', fermer);
        c.addEventListener('click', function(e) { if (e.target === c) c.querySelector('button').click(); });
        ecran.appendChild(c);
    }
    function annoncerNouveautes() {
        if (!ecran || !navigator.onLine || document.querySelector('.JUM-PRES, .JUM-REGLAGES')) return;
        manifesteMaj().then(function(m) {
            if (!m || !(m.appCodeVersion > 0) || !ecran) return;
            var vue = +lireTxt(CLE_NOUVEAUTES) || 0;
            // Toute première utilisation : rien à annoncer. Ancienne installation (versions vues dans une appli) : on annonce.
            var ancien = lireTxt('mer_maj_vues') || lireTxt('trigone_update_versions_vues');
            if (!vue && !ancien) { ecrireTxt(CLE_NOUVEAUTES, String(m.appCodeVersion)); return; }
            if (m.appCodeVersion <= vue) return;
            ecrireTxt(CLE_NOUVEAUTES, String(m.appCodeVersion));
            carteChoix('Nouveautés' + (window.APP_VERSION_AFFICHEE ? ' — V' + window.APP_VERSION_AFFICHEE : ''), (m.appCodeMessage || 'TRIGONE vient d\'être mis à jour.').replace(/^Version \d+ :\s*/, ''), 'nouveau');
        }).catch(function() {});
    }
    function verifierMajManuelle() {
        if (!navigator.onLine) { carteChoix('Pas de connexion', 'Impossible de vérifier les mises à jour sans internet. Réessayez une fois connecté.', 'horsLigne'); return; }
        var btns = ecran ? Array.prototype.slice.call(ecran.querySelectorAll('.JUM-MAJ-BTN, .JUM-DOCK-MAJ')) : [];
        var btn = { classList: { remove: function(c) { btns.forEach(function(x) { x.classList.remove(c); }); } } };
        btns.forEach(function(x) { x.classList.add('tourne'); });
        fetch((DANS_CR ? '../' : '') + 'build.json?t=' + Date.now(), { cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
            if (d && d.build > BUILD) { try { sessionStorage.removeItem(CLE_RECHARGE); } catch (e) {} window.JUMELAGE_MAJ_DISPONIBLE(); return; }
            return manifesteMaj().then(function(m) {
                carteChoix('TRIGONE est à jour' + (window.APP_VERSION_AFFICHEE ? ' — V' + window.APP_VERSION_AFFICHEE : ''),
                    (m && m.appCodeMessage) ? 'Dernières nouveautés : ' + m.appCodeMessage.replace(/^Version \d+ :\s*/, '') : 'Aucune mise à jour disponible pour le moment.', 'ok', 'ok', 'mascotte-pouce.webp');
            });
        }).catch(function() { carteChoix('Vérification impossible', 'Impossible de vérifier les mises à jour pour le moment. Réessayez plus tard.', 'alerte'); })
          .then(function() { setTimeout(function() { if (btn) btn.classList.remove('tourne'); }, 600); });
    }

    // À l'ouverture de TRIGONE (pas en passant d'une appli à l'autre) : l'écran de choix, sous l'animation
    // d'ouverture, la présentation, le code d'accès et « Avant de commencer », qui gardent la priorité.
    var dejaChoisi = false;
    try { dejaChoisi = sessionStorage.getItem(CLE_CHOIX) === '1'; } catch (e) {}
    // Ouverture depuis une notification (boîte de réception ou espace Assistant Chorus DT) : droit à l'espace visé.
    // Aussi : raccourcis de l'icône de l'appli (appui long) et notification « Départ en mission aujourd'hui » (Compte-rendu).
    // Lien du QR de connexion (…?liaison=CODE), scanné avec l'appareil photo : l'écran de liaison s'ouvre, code déjà saisi.
    (function() {
        var m = /[?&]liaison=([A-Za-z0-9-]{8,9})/.exec(location.search); if (!m) return;
        var c = codeLiaisonNormal(m[1]); if (c.length !== 8) return;
        try { sessionStorage.setItem('trigone_liaison_qr', c); history.replaceState(null, '', location.pathname); } catch (e) {}
        dejaChoisi = true; try { sessionStorage.setItem(CLE_CHOIX, '1'); } catch (e) {}
        setTimeout(function() {
            if (monCompte()) { bandeau('Cet appareil est déjà connecté à un compte TRIGONE : le QR de connexion sert sur un appareil pas encore connecté.'); return; }
            window.JUMELAGE_COMPTE();
            setTimeout(function() { var b = document.querySelector('.JUM-ACC [data-aller="liaison"], [data-aller="liaison"]'); if (b) b.click(); }, 300);
        }, 1500);
    })();
    if (DANS_CR ? /[?&](espace|depart)=/.test(location.search) : /[?&]espace=(boite|chorus|suivi|documents|nouvelle|carte)/.test(location.search)) { dejaChoisi = true; try { sessionStorage.setItem(CLE_CHOIX, '1'); } catch (e) {} }
    if (CARTE_AU_DEMARRAGE) {
        var ouvrirCarte = function() { setTimeout(function() { window.JUMELAGE_CARTE(); try { history.replaceState(null, document.title, location.pathname); } catch (e) {} }, 400); };
        if (document.readyState === 'complete') ouvrirCarte(); else window.addEventListener('load', ouvrirCarte);
    }
    // Juste après une mise à jour (nouvelle publication chargée, quelle qu'en soit la cause) : retour à l'écran de choix.
    var buildVu = +lireTxt('trigone_build_vu') || 0;
    var apresMaj = false;
    try { apresMaj = sessionStorage.getItem('trigone_apres_maj') === '1'; sessionStorage.removeItem('trigone_apres_maj'); } catch (e) {}
    if (apresMaj || (buildVu && buildVu < BUILD)) { dejaChoisi = false; arrivee = false; }
    ecrireTxt('trigone_build_vu', String(BUILD));
    if (!arrivee && !dejaChoisi && !DEMENAGEMENT && !RECEPTION_DEMENAGEMENT) {
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
