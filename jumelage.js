// ===================== JUMELAGE TRIGONE : Mise en route ⇄ Compte-rendu de mission =====================
// Chargé par les deux applis (index.html à la racine, cr/index.html). À l'ouverture de TRIGONE, un écran de
// choix coupé en diagonale : Mise en route en haut à gauche, Compte-rendu de mission en bas à droite. Toucher
// un côté ouvre cette appli, avec son propre accueil. Toucher le logo d'un accueil ramène à l'écran de choix.
// Au changement d'appli : pas de nouvel écran d'ouverture, et le code à 4 chiffres n'est pas redemandé.
(function() {
    var CLE_BASCULE = 'trigone_bascule', CLE_DEVERROUILLE = 'trigone_deverrouille', CLE_THEME = 'trigone_theme', CLE_CHOIX_FAIT = 'trigone_choix_fait';
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
        '.JUM-MAJ { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;' +
            ' background: rgba(15,15,15,0.72); color: #fff; font: 700 0.9rem/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: 0.02em; }' +
        '.JUM-MAJ-ROND { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.25); border-top-color: #d6a756; animation: jum-tourne 0.8s linear infinite; }' +
        '@keyframes jum-tourne { to { transform: rotate(360deg); } }' +
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
        /* Roue crantée (réglages) sur l'écran de choix, en bas à droite */
        '.JUM-ROUE { position: absolute; right: max(18px, env(safe-area-inset-right, 0px)); bottom: max(18px, env(safe-area-inset-bottom, 0px)); z-index: 3; width: 52px; height: 52px;' +
            ' border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.35); background: rgba(255,255,255,0.08); color: #f5f5f5; display: flex; align-items: center; justify-content: center; cursor: pointer; }' +
        '.JUM-ROUE svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.4s ease; }' +
        '.JUM-ROUE:hover svg, .JUM-ROUE:active svg { transform: rotate(60deg); }' +
        '.JUM-CHOIX.choisi .JUM-ROUE { opacity: 0; pointer-events: none; }' +
        '.JUM-MAJ-BTN { right: auto; left: max(18px, env(safe-area-inset-left, 0px)); border-color: rgba(255,255,255,0.18); background: #1a1a1a; color: #f5f5f5; box-shadow: 0 4px 14px rgba(0,0,0,0.25); }' +
        '.JUM-MAJ-BTN.tourne svg { animation: jum-tourne 0.9s linear infinite; } @keyframes jum-tourne { to { transform: rotate(360deg); } }' +
        '.JUM-CHOIX.choisi .JUM-MAJ-BTN { opacity: 0; pointer-events: none; }' +
        '.JUM-NOUV { position: absolute; inset: 0; z-index: 6; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,15,15,0.35); animation: jum-menu 0.2s ease both; }' +
        '.JUM-NOUV.sortie { opacity: 0; transition: opacity 0.25s ease; }' +
        '.JUM-NOUV-CARTE { width: 100%; max-width: 420px; background: #fff; color: #1a1a1a; border-radius: 22px; padding: 24px 22px 18px; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.35); font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-NOUV-IC { display: inline-flex; width: 58px; height: 58px; padding: 14px; box-sizing: border-box; border-radius: 18px; background: rgba(90,122,148,0.1); color: #5a7a94; }' +
        '.JUM-NOUV-IC svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-NOUV-IC[data-ton="ok"] { background: rgba(21,128,61,0.1); color: #15803d; }' +
        /* Mascotte cachée derrière la carte blanche : elle en dépasse, comme si elle se penchait derrière */
        '.JUM-NOUV-CARTE { position: relative; }' +
        '.JUM-NOUV-BTNS { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }' +
        /* Déménagement vers l'adresse Cloudflare */
        '.JUM-DEM { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 16px; background: linear-gradient(135deg, #F8FBFD 0%, #E8F0F6 100%); font-family: Montserrat, system-ui, sans-serif; overflow-y: auto; }' +
        '.JUM-DEM-CARTE { width: 100%; max-width: 460px; background: #fff; color: #1a1a1a; border-radius: 24px; padding: 28px 24px 20px; text-align: center; box-shadow: 0 24px 60px rgba(26,45,62,0.16); }' +
        '.JUM-DEM-CARTE img { width: 84px; height: 84px; border-radius: 20px; box-shadow: 0 6px 18px rgba(0,0,0,0.15); }' +
        '.JUM-DEM-CARTE h2 { margin: 16px 0 8px; font-size: 1.2rem; font-weight: 800; } .JUM-DEM-CARTE p { margin: 0 0 16px; font-size: 0.88rem; line-height: 1.55; color: #404040; }' +
        '.JUM-DEM-GO { width: 100%; border: 0; border-radius: 14px; padding: 15px; background: #1a1a1a; color: #fff; font: 800 0.8rem Montserrat, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-DEM-GO:disabled { opacity: 0.5; } .JUM-DEM-ETAT { min-height: 1.2em; margin: 12px 0 0 !important; font-weight: 700; color: #15803d !important; }' +
        '.JUM-DEM-AIDE { text-align: left; font-size: 0.78rem; line-height: 1.5; color: #5a7a94; background: #F2F7FB; border-radius: 12px; padding: 12px 14px; margin: 8px 0 12px; }' +
        '.JUM-DEM-FICHIER { border: 0; background: none; color: #5a7a94; font: 700 0.76rem Montserrat, system-ui, sans-serif; text-decoration: underline; cursor: pointer; }' +
        '.JUM-NOUV .JUM-NOUV-SECOND { background: #fff; color: #5a7a94; border: 1.5px solid #c9d6e0; }' +
        '.JUM-NOUV-MASCOTTE { position: absolute; z-index: -1; right: -92px; bottom: 26px; width: 150px; height: auto; filter: drop-shadow(0 10px 16px rgba(0,0,0,0.25)); pointer-events: none; }' +
        '@media (max-width: 560px) { .JUM-NOUV-MASCOTTE { right: 12px; bottom: auto; top: -84px; width: 110px; } }' +
        '.JUM-NOUV h2 { margin: 12px 0 8px; font-size: 1.15rem; } .JUM-NOUV p { margin: 0 0 18px; font-size: 0.9rem; line-height: 1.55; color: #404040; }' +
        '.JUM-NOUV button { border: 0; border-radius: 14px; padding: 13px 34px; background: #1a1a1a; color: #fff; font: 800 0.8rem Montserrat, system-ui, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-VERSION { position: absolute; top: max(16px, env(safe-area-inset-top, 0px)); right: max(18px, env(safe-area-inset-right, 0px)); z-index: 3; padding: 5px 12px; border-radius: 999px;' +
            ' border: 1px solid rgba(255,255,255,0.18); background: #1a1a1a; color: #f5f5f5; box-shadow: 0 4px 14px rgba(0,0,0,0.25); font: 700 12px Montserrat, system-ui, sans-serif; letter-spacing: 0.08em; pointer-events: none; }' +
        '.JUM-CHOIX.choisi .JUM-VERSION { opacity: 0; }' +
        /* Menu de la roue crantée */
        '.JUM-ROUE-MENU { position: absolute; right: max(18px, env(safe-area-inset-right, 0px)); bottom: calc(max(18px, env(safe-area-inset-bottom, 0px)) + 62px); z-index: 4;' +
            ' background: #fff; border-radius: 16px; padding: 6px; min-width: 250px; box-shadow: 0 18px 44px rgba(0,0,0,0.45); font-family: Montserrat, system-ui, sans-serif; animation: jum-menu 0.18s ease both; }' +
        '@keyframes jum-menu { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }' +
        '.JUM-ROUE-MENU button { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; background: none; padding: 11px 12px; border-radius: 12px; text-align: left; cursor: pointer; color: #1a1a1a; font-family: inherit; }' +
        '.JUM-ROUE-MENU button:hover { background: #f1f5f9; }' +
        '.JUM-ROUE-MENU svg, .JUM-ROUE-MENU img { width: 26px; height: 26px; flex-shrink: 0; fill: none; stroke: #5a7a94; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; object-fit: contain; }' +
        '.JUM-ROUE-SEP { height: 1px; background: #e2e8f0; margin: 4px 10px; }' +
        '.JUM-ROUE-MENU .JUM-ROUE-DANGER svg { stroke: #b91c1c; } .JUM-ROUE-MENU .JUM-ROUE-DANGER b { color: #b91c1c; } .JUM-ROUE-MENU .JUM-ROUE-DANGER:hover { background: #fef2f2; }' +
        '.JUM-ROUE-MENU b { display: block; font-size: 0.84rem; } .JUM-ROUE-MENU small { display: block; font-size: 0.7rem; color: #64748b; margin-top: 2px; }' +
        '.THEME-TOGGLE svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; display: block; }' +
        '.THEME-TOGGLE { color: #5a7a94; } body.dark-mode .THEME-TOGGLE { color: #e5e5e5; }' +
        '@media (max-width: 480px) { .THEME-TOGGLE svg { width: 17px; height: 17px; } }' +
        /* Icônes au trait qui remplacent les emoji */
        '.JUM-IC { display: inline-block; width: 1.15em; height: 1.15em; vertical-align: -0.2em; flex-shrink: 0; }' +
        '.JUM-IC svg { width: 100%; height: 100%; display: block; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }' +
        '.P0-REF-BTN { display: inline-flex; align-items: center; gap: 5px; } .P0-REF-BTN .JUM-IC { width: 13px; height: 13px; vertical-align: 0; }' +
        '.JUM-IC[data-ton="ok"] { color: #15803d; } .JUM-IC[data-ton="danger"] { color: #b91c1c; } .JUM-IC[data-ton="alerte"] { color: #b45309; }' +
        'html body.dark-mode .JUM-IC[data-ton="ok"] { color: #86efac; } html body.dark-mode .JUM-IC[data-ton="danger"] { color: #f87171; } html body.dark-mode .JUM-IC[data-ton="alerte"] { color: #fbbf24; }' +
        /* Icône en tête des messages : pastille, comme les icônes des onglets */
        '.msg-icone .JUM-IC { width: 58px; height: 58px; padding: 14px; box-sizing: border-box; border-radius: 18px; background: rgba(90,122,148,0.1); color: #5a7a94; vertical-align: 0; }' +
        '.msg-icone .JUM-IC svg { stroke-width: 1.7; }' +
        '.msg-icone .JUM-IC[data-ton="ok"] { background: rgba(21,128,61,0.1); } .msg-icone .JUM-IC[data-ton="danger"] { background: rgba(185,28,28,0.09); } .msg-icone .JUM-IC[data-ton="alerte"] { background: rgba(180,83,9,0.1); }' +
        'html body.dark-mode .msg-icone .JUM-IC { background: rgba(169,195,214,0.12); color: #a9c3d6; }' +
        'html body.dark-mode .msg-icone .JUM-IC[data-ton="ok"] { background: rgba(134,239,172,0.1); color: #86efac; } html body.dark-mode .msg-icone .JUM-IC[data-ton="danger"] { background: rgba(248,113,113,0.1); color: #f87171; } html body.dark-mode .msg-icone .JUM-IC[data-ton="alerte"] { background: rgba(251,191,36,0.1); color: #fbbf24; }' +
        /* ===== Démonstrations : plus de bandes jaunes et noires ===== */
        'body.jdemo .DEMO-RUBAN, body.jdemo .DEMO-BANDEAU, body.jdemo .DEMO-CONTROLES, body.jdemo .THEME-TOGGLE { display: none !important; }' +
        'body.jdemo::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 99989; box-shadow: inset 0 0 0 3px rgba(90,122,148,0.55); }' +
        'body.jdemo .demo-zone, body.jdemo .demo-spotlight { outline: 2.5px solid #5a7a94 !important; outline-offset: 4px !important; border-radius: 12px; box-shadow: 0 0 0 9px rgba(90,122,148,0.16) !important; animation: jdemo-halo 2.4s ease-in-out infinite !important; position: relative; z-index: 3; }' +
        '@keyframes jdemo-halo { 0%, 100% { box-shadow: 0 0 0 7px rgba(90,122,148,0.16); } 50% { box-shadow: 0 0 0 12px rgba(90,122,148,0.07); } }' +
        'html body.dark-mode.jdemo .demo-zone, html body.dark-mode.jdemo .demo-spotlight { outline-color: #a9c3d6 !important; }' +
        '@media (min-width: 1100px) { html body.jdemo-reserve { padding-right: 400px !important; } }' +
        '.JDEMO-PASTILLE { position: fixed; top: calc(12px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); z-index: 99995; display: flex; align-items: center; gap: 9px; white-space: nowrap;' +
            ' background: #1a1a1a; color: #fff; border-radius: 999px; padding: 6px 6px 6px 14px; font: 800 11px Montserrat, system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }' +
        '.JDEMO-PASTILLE i { width: 8px; height: 8px; border-radius: 50%; background: #7a9db5; box-shadow: 0 0 0 4px rgba(122,157,181,0.25); }' +
        '.JDEMO-PASTILLE b { font-weight: 600; letter-spacing: 0.04em; color: #cbd5e1; }' +
        '.JDEMO-QUITTER { border: 0; border-radius: 999px; background: rgba(255,255,255,0.14); color: #fff; font: 700 11px Montserrat, system-ui, sans-serif; padding: 6px 12px; letter-spacing: 0.04em; cursor: pointer; text-transform: none; }' +
        '.JDEMO-GUIDE { position: fixed; z-index: 99994; display: flex; align-items: flex-end; font-family: Montserrat, system-ui, sans-serif; pointer-events: none; }' +
        '.JDEMO-BULLE { pointer-events: auto; position: relative; background: #fff; color: #1a1a1a; border: 1px solid #e8e8e8; box-shadow: 0 18px 50px rgba(15,23,42,0.22); }' +
        '.JDEMO-ETAPE { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #5a7a94; margin-bottom: 5px; }' +
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
        'html body.dark-mode .JDEMO-TEXTE { color: #c8c8c8; } html body.dark-mode .JDEMO-ETAPE { color: #a9c3d6; }' +
        'html body.dark-mode .JDEMO-NAV button { background: #262626; color: #ececec; border-color: rgba(255,255,255,0.1); } html body.dark-mode .JDEMO-NAV .JDEMO-SUIV { background: #ececec; color: #141414; border-color: #ececec; }' +
        'html body.dark-mode .JDEMO-POINTS span { background: #3a3a3a; } html body.dark-mode .JDEMO-POINTS span.a { background: #ececec; }' +
        'html body.dark-mode.jdemo::after { box-shadow: inset 0 0 0 3px rgba(169,195,214,0.45); }' +
        '@media (prefers-reduced-motion: reduce) { body.jdemo .demo-zone, body.jdemo .demo-spotlight, .JDEMO-ENTREE .JDEMO-BULLE { animation: none !important; } }' +
        /* ===== Thème sombre commun : une seule palette pour les deux applis (gris neutres + bleu ardoise TRIGONE) =====
           Fond #141414, surfaces #1f1f1f / #262626, texte #ececec, secondaire #a3a3a3, accent #a9c3d6 (bleu ardoise clair). */
        'html body.dark-mode { --tg-muted: #a3a3a3; --tg-soft: #8f8f8f; --tg-border: rgba(255,255,255,0.09); }' +
        /* Notice : dépliants identiques dans les deux applis (« + » à droite, couleur d'accent, pas de triangle) */
        '.notice-fold > summary { list-style: none; } .notice-fold > summary::-webkit-details-marker { display: none; }' +
        '.notice-fold > summary::after { content: " +"; float: right; color: #5a7a94; font-weight: 900; font-size: 1.15em; line-height: 1; }' +
        '.notice-fold[open] > summary::after { content: " −"; }' +
        'html body.dark-mode .notice-fold > summary::after { color: #a9c3d6; }' +
        'html body.dark-mode .notice-fold > summary { color: #ececec; }' +
        'html body.dark-mode .notice-fold li, html body.dark-mode .notice-fold p, html body.dark-mode .notice-mini li { color: #c8c8c8; }' +
        'html body.dark-mode .notice-fold b, html body.dark-mode .notice-mini b { color: #ececec; }' +
        /* Textes secondaires : lisibles partout */
        'html body.dark-mode .NOTICE-CARD-SUB, html body.dark-mode .NOTICE-CARD-CHEV, html body.dark-mode .BIB-HEADER-TXT p, html body.dark-mode .NOTICE-LEAD-HINT,' +
        ' html body.dark-mode .BIB-EMPTY span, html body.dark-mode .MER-HINT, html body.dark-mode .PC-SOUS { color: #a3a3a3; }' +
        'html body.dark-mode .NOTICE-CARD-TITLE, html body.dark-mode .BIB-EMPTY p, html body.dark-mode .P1-SECTION-LBL { color: #ececec; }' +
        'html body.dark-mode .P0-TAB.is-active .P0-TAB-LBL, html body.dark-mode .MER-DOCK-BTN.actif span, html body.dark-mode .P0-TAB.is-active .P0-LBL-COURT { color: #ececec; }' +
        /* Liens, boutons texte, danger */
        'html body.dark-mode a:not([class]) { color: #a9c3d6; }' +
        'html body.dark-mode .BTN-DANGER-TEXT { color: #f87171; border-color: rgba(248,113,113,0.35); background: transparent; }' +
        /* Libellés de sections et sélections actives : une seule règle (pastille claire, texte foncé) */
        'html body.dark-mode .P1-SECTION-LBL, html body.dark-mode #P1 .P1-SECTION-LBL, html body.dark-mode #P1-IDENTITY-ZONE .P1-SECTION-LBL { color: #ececec; }' +
        'html body.dark-mode .MZ-TAB.active { background: #ececec; border-color: #ececec; color: #141414; }' +
        'html body.dark-mode .collective-zone, html body.dark-mode #P1 .collective-zone { background: rgba(169,195,214,0.08) !important; border-color: rgba(169,195,214,0.25) !important; }' +
        'html body.dark-mode .collective-zone label { color: #a9c3d6 !important; }' +
        'html body.dark-mode .LIB-CLEAR-ALL-BTN { color: #a9c3d6; border-color: rgba(169,195,214,0.3); background: transparent; }' +
        'html body.dark-mode .BTN-ALERT, html body.dark-mode .ADMIN-SECTION .BTN-ALERT { background: #262626; color: #ececec; border-color: rgba(255,255,255,0.1); }' +
        'html body.dark-mode .NOTICE-HELP { background: #262626; color: #ececec; border-color: rgba(255,255,255,0.1); }' +
        /* Voile derrière les fenêtres : noir neutre (plus de voile bleu marine) */
        'html body.dark-mode .VALIDATION-MODAL, html body.dark-mode .NOTICE-MODAL, html body.dark-mode .QR-OVERLAY, html body.dark-mode #REFERENCES-MODAL, html body.dark-mode #PARAMS-MODAL { background: rgba(0,0,0,0.72); }' +
        'html body.dark-mode .FOLD-ICON svg { stroke: #a9c3d6; }' +
        'html body.dark-mode #FORFAIT-EXPORT-BTN, html body.dark-mode #FORFAIT-EXPORT-BTN.LIB-CLEAR-ALL-BTN { color: #a9c3d6 !important; border-color: rgba(169,195,214,0.3) !important; background: transparent !important; }' +
        'html body.dark-mode .PC-BADGE { background: rgba(169,195,214,0.14); color: #a9c3d6; } html body.dark-mode .PC-BADGE.PC-BADGE-GRIS { background: rgba(255,255,255,0.07); color: #a3a3a3; }' +
        /* Fenêtres de Compte-rendu : sans liseré violet, comme celles de Mise en route */
        '.ADMIN-BOX { border-left: 0 !important; }' +
        /* Présentation TRIGONE en mode sombre */
        'html body.dark-mode .JUM-PRES { background: linear-gradient(165deg, #1a1a1a 0%, #111 100%); color: #ececec; }' +
        'html body.dark-mode .JUM-PRES-LOGO { filter: brightness(0) invert(0.93); }' +
        'html body.dark-mode .JUM-PRES-LIGNE, html body.dark-mode .JUM-PRES h1 em { color: #a9c3d6; }' +
        'html body.dark-mode .JUM-PRES-CHAPO { color: #a3a3a3; }' +
        'html body.dark-mode .JUM-PRES-TRAIT { background: linear-gradient(to bottom right, transparent calc(50% - 1px), rgba(169,195,214,0.18) 50%, transparent calc(50% + 1px)); }' +
        'html body.dark-mode .JUM-PRES-CLAIR { background: #1f1f1f; border-color: rgba(255,255,255,0.09); color: #ececec; box-shadow: none; }' +
        'html body.dark-mode .JUM-PRES-SOMBRE { background: #ececec; color: #1a1a1a; }' +
        'html body.dark-mode .JUM-PRES-CLAIR .JUM-PRES-NUM { color: #a9c3d6; } html body.dark-mode .JUM-PRES-SOMBRE .JUM-PRES-NUM { color: #5a7a94; }' +
        'html body.dark-mode .JUM-PRES-CLAIR li::before { background: #a9c3d6; } html body.dark-mode .JUM-PRES-SOMBRE li::before { background: #5a7a94; }' +
        'html body.dark-mode .JUM-PRES-CLAIR li { border-top-color: rgba(255,255,255,0.08); } html body.dark-mode .JUM-PRES-SOMBRE li { border-top-color: rgba(0,0,0,0.08); }' +
        'html body.dark-mode .JUM-PRES-GARANTIES div { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.09); color: #d4d4d4; }' +
        'html body.dark-mode .JUM-PRES-GARANTIES svg { stroke: #a9c3d6; }' +
        'html body.dark-mode .JUM-PRES-BTN { background: #ececec; color: #141414; } html body.dark-mode .JUM-PRES-BTN:hover { background: #fff; }' +
        /* Fenêtre du QR code en mode sombre (le QR garde son cadre blanc, indispensable à la lecture) */
        'html body.dark-mode .JUM-QR-CARTE { background: #1f1f1f; color: #ececec; }' +
        'html body.dark-mode .JUM-QR-TETE p, html body.dark-mode .JUM-QR-ETAPES { color: #a3a3a3; } html body.dark-mode .JUM-QR-ETAPES b { color: #ececec; }' +
        'html body.dark-mode .JUM-QR-TEL { background: rgba(169,195,214,0.12); } html body.dark-mode .JUM-QR-TEL svg, html body.dark-mode .JUM-QR-NOTE svg { stroke: #a9c3d6; }' +
        'html body.dark-mode .JUM-QR-ACTIONS button, html body.dark-mode .JUM-QR-CHOIX button { background: #262626; border-color: rgba(255,255,255,0.1); color: #ececec; }' +
        'html body.dark-mode .JUM-QR-ACTIONS button:hover { background: #2e2e2e; } html body.dark-mode .JUM-QR-CHOIX button.actif { background: #ececec; color: #141414; border-color: #ececec; }' +
        'html body.dark-mode .JUM-QR-NOTE { background: #262626; color: #a3a3a3; } html body.dark-mode .JUM-QR-CADRE { border-color: transparent; }' +
        'html body.dark-mode .JUM-R-X { background: #262626; color: #d4d4d4; border-color: rgba(255,255,255,0.1); }' +
        /* QR code Mise en route → Compte-rendu, et scanner */
        '.JUM-QR { position: fixed; inset: 0; z-index: 99990; background: rgba(15,15,15,0.72); display: flex; align-items: center; justify-content: center; padding: 16px; font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-QR-CARTE { position: relative; background: #fff; color: #1a1a1a; border-radius: 20px; width: 100%; max-width: 440px; max-height: 100%; overflow-y: auto; padding: 22px 22px 18px; box-shadow: 0 24px 60px rgba(0,0,0,0.4); }' +
        '.JUM-QR-CARTE .JUM-R-X { position: absolute; top: 14px; right: 14px; }' +
        '.JUM-QR-TETE { display: flex; gap: 12px; align-items: center; padding-right: 36px; }' +
        '.JUM-QR-TETE h2 { margin: 0; font-size: 1.05rem; } .JUM-QR-TETE p { margin: 3px 0 0; font-size: 0.78rem; color: #64748b; line-height: 1.4; }' +
        '.JUM-QR-TEL { width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; background: #E8F0F6; display: flex; align-items: center; justify-content: center; }' +
        '.JUM-QR-TEL svg, .JUM-QR-NOTE svg { width: 22px; height: 22px; fill: none; stroke: #5a7a94; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-QR-CHOIX { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 0; }' +
        '.JUM-QR-CHOIX button { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 6px 12px; font: 700 0.72rem Montserrat, system-ui, sans-serif; color: #475569; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
        '.JUM-QR-CHOIX button.actif { background: #1a1a1a; border-color: #1a1a1a; color: #fff; }' +
        '.JUM-QR-CADRE { margin: 16px auto 12px; width: min(300px, 100%); aspect-ratio: 1; padding: 14px; border-radius: 16px; border: 1px solid #e8e8e8; background: #fff; }' +
        '.JUM-QR-CODE, .JUM-QR-CODE canvas, .JUM-QR-CODE img { width: 100% !important; height: 100% !important; display: block; image-rendering: pixelated; }' +
        '.JUM-QR-ACTIONS { display: flex; gap: 8px; justify-content: center; margin: 0 0 14px; flex-wrap: wrap; }' +
        '.JUM-QR-ACTIONS button { border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; padding: 10px 14px; font: 700 0.76rem Montserrat, system-ui, sans-serif; color: #1a1a1a; cursor: pointer; }' +
        '.JUM-QR-ACTIONS button:hover { background: #f1f5f9; } .JUM-QR-ACTIONS .HIDDEN-JUM { display: none; }' +
        '.JUM-SCAN-PHOTO { position: absolute; left: 50%; bottom: calc(max(30px, env(safe-area-inset-bottom, 0px)) + 62px); transform: translateX(-50%); border: 1.5px solid rgba(255,255,255,0.7); border-radius: 14px; padding: 12px 22px; background: rgba(0,0,0,0.35); color: #fff; font: 700 0.8rem Montserrat, system-ui, sans-serif; cursor: pointer; white-space: nowrap; }' +
        '.JUM-QR-ETAPES { margin: 0; padding: 0 0 0 20px; font-size: 0.8rem; line-height: 1.5; color: #404040; } .JUM-QR-ETAPES li { margin: 3px 0; }' +
        '.JUM-QR-NOTE { display: flex; gap: 8px; align-items: center; margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: #F8FBFD; font-size: 0.72rem; color: #525252; }' +
        '.JUM-QR-NOTE svg { width: 18px; height: 18px; flex-shrink: 0; }' +
        '.JUM-SCAN { position: fixed; inset: 0; z-index: 99997; background: #000; font-family: Montserrat, system-ui, sans-serif; }' +
        '.JUM-SCAN video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }' +
        '.JUM-SCAN-VISEUR { position: absolute; left: 50%; top: 45%; width: min(70vw, 300px); aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 22px; box-shadow: 0 0 0 100vmax rgba(0,0,0,0.55); }' +
        '.JUM-SCAN-VISEUR span { position: absolute; inset: 0; border-radius: 22px; border: 3px solid #fff; }' +
        '.JUM-SCAN-VISEUR span::after { content: ""; position: absolute; left: 10%; right: 10%; height: 2px; top: 50%; background: #7a9db5; box-shadow: 0 0 12px #7a9db5; animation: jum-scan 2s ease-in-out infinite; }' +
        '@keyframes jum-scan { 0%, 100% { transform: translateY(-110px); } 50% { transform: translateY(110px); } }' +
        '.JUM-SCAN-TEXTE { position: absolute; left: 16px; right: 16px; top: max(28px, env(safe-area-inset-top, 0px)); text-align: center; color: #fff; font-size: 0.9rem; line-height: 1.45; }' +
        '.JUM-SCAN-ANNULER { position: absolute; left: 50%; bottom: max(30px, env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); border: 0; border-radius: 14px; padding: 14px 40px; background: #fff; color: #1a1a1a; font: 800 0.8rem Montserrat, system-ui, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }' +
        /* Présentation TRIGONE */
        '.JUM-PRES { position: fixed; inset: 0; z-index: 99992; background: linear-gradient(165deg, #F8FBFD 0%, #E8F0F6 100%); color: #1a1a1a;' +
            ' font-family: Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; opacity: 0; transition: opacity 0.38s ease; }' +
        '.JUM-PRES.visible { opacity: 1; }' +
        '.JUM-PRES-TRAIT { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom right, transparent calc(50% - 1px), rgba(90,122,148,0.22) 50%, transparent calc(50% + 1px)); }' +
        '.JUM-PRES-DEFIL { position: absolute; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }' +
        '.JUM-PRES-CONTENU { position: relative; max-width: 960px; margin: 0 auto; padding: max(34px, env(safe-area-inset-top, 0px)) 20px max(34px, env(safe-area-inset-bottom, 0px)); text-align: center; }' +
        '.JUM-PRES-CONTENU > * { opacity: 0; transform: translateY(12px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2,0.8,0.2,1); }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > * { opacity: 1; transform: none; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(2) { transition-delay: 0.08s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(3) { transition-delay: 0.14s; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(4) { transition-delay: 0.22s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(5) { transition-delay: 0.3s; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(6) { transition-delay: 0.4s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(n+7) { transition-delay: 0.5s; }' +
        '.JUM-PRES-LOGO { width: 92px; height: auto; }' +
        '.JUM-PRES-MARQUE { font-size: 2rem; font-weight: 800; letter-spacing: 0.34em; margin: 10px 0 4px; padding-left: 0.34em; }' +
        '.JUM-PRES-LIGNE { font-size: 0.66rem; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: #5a7a94; }' +
        '.JUM-PRES-LIGNE span { margin: 0 6px; }' +
        '@media (max-width: 440px) { .JUM-PRES-LIGNE { font-size: 0.58rem; letter-spacing: 0.1em; } .JUM-PRES-MARQUE { font-size: 1.7rem; } }' +
        '.JUM-PRES h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: clamp(1.5rem, 4.2vw, 2.3rem); line-height: 1.25; margin: 26px 0 10px; }' +
        '.JUM-PRES h1 em { font-style: normal; color: #5a7a94; }' +
        '.JUM-PRES-CHAPO { max-width: 620px; margin: 0 auto 26px; font-size: 0.9rem; line-height: 1.6; color: #525252; }' +
        '.JUM-PRES-DUO { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; text-align: left; }' +
        '@media (max-width: 640px) { .JUM-PRES-DUO { grid-template-columns: 1fr; } }' +
        '.JUM-PRES-VOLET { border-radius: 18px; padding: 20px 20px 16px; }' +
        '.JUM-PRES-CLAIR { background: #fff; border: 1px solid #e8e8e8; box-shadow: 0 10px 40px rgba(0,0,0,0.06); color: #1a1a1a; }' +
        '.JUM-PRES-SOMBRE { background: #1a1a1a; box-shadow: 0 10px 40px rgba(0,0,0,0.14); color: #f5f5f5; }' +
        '.JUM-PRES-NUM { font-size: 0.64rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #5a7a94; }' +
        '.JUM-PRES-SOMBRE .JUM-PRES-NUM { color: #7a9db5; }' +
        '.JUM-PRES-TITRE { font-size: 1.1rem; font-weight: 800; margin: 6px 0 10px; }' +
        '.JUM-PRES-VOLET ul { margin: 0; padding: 0; list-style: none; }' +
        '.JUM-PRES-VOLET li { position: relative; padding: 7px 0 7px 22px; font-size: 0.82rem; line-height: 1.45; border-top: 1px solid rgba(90,122,148,0.18); }' +
        '.JUM-PRES-SOMBRE li { border-top-color: rgba(255,255,255,0.08); }' +
        '.JUM-PRES-VOLET li:first-child { border-top: 0; }' +
        '.JUM-PRES-VOLET li::before { content: ""; position: absolute; left: 2px; top: 13px; width: 8px; height: 8px; border-radius: 2px; transform: rotate(45deg); background: #5a7a94; }' +
        '.JUM-PRES-SOMBRE li::before { background: #7a9db5; }' +
        '.JUM-PRES-GARANTIES { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0 26px; }' +
        '@media (max-width: 640px) { .JUM-PRES-GARANTIES { grid-template-columns: 1fr; } }' +
        '.JUM-PRES-GARANTIES div { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.7); border: 1px solid #e8e8e8; font-size: 0.78rem; font-weight: 600; color: #404040; }' +
        '.JUM-PRES-GARANTIES svg { width: 20px; height: 20px; flex-shrink: 0; fill: none; stroke: #5a7a94; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
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
        '.JUM-R-ICONE { flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px; background: rgba(90,122,148,0.1); color: #5a7a94; display: flex; align-items: center; justify-content: center; }' +
        '.JUM-R-ICONE svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-R-X { margin-left: auto; border: 0; background: none; font-size: 1.1rem; color: #64748b; cursor: pointer; padding: 4px 6px; }' +
        '.JUM-R-CORPS { padding: 6px 20px 10px; overflow-y: auto; -webkit-overflow-scrolling: touch; }' +
        '.JUM-R-TITRE { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin: 16px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #1a1a1a; }' +
        '.JUM-R-GRILLE { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }' +
        '@media (max-width: 520px) { .JUM-R-GRILLE { grid-template-columns: 1fr; } }' +
        '.JUM-R-CHAMP label { display: block; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 5px; color: #334155; }' +
        '.JUM-R-CHAMP input { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font: 500 0.9rem Montserrat, system-ui, sans-serif; color: #1a1a1a; background: #fff; }' +
        '.JUM-R-CHAMP input:focus { outline: none; border-color: #5a7a94; }' +
        '.JUM-R-AIDE { font-size: 0.76rem; color: #64748b; margin: 0 0 10px; line-height: 1.45; }' +
        '.JUM-R-ERREUR { color: #b91c1c; font-size: 0.8rem; font-weight: 700; margin: 12px 0 0; min-height: 1em; }' +
        '.JUM-R-PIED { display: flex; align-items: center; gap: 10px; padding: 12px 20px 16px; border-top: 1px solid #eef2f6; }' +
        '.JUM-R-PIED > .JUM-R-PRINCIPAL:only-child { flex: 1; padding: 15px 22px; }' +
        '.JUM-R-PRINCIPAL { margin-left: auto; border: 0; border-radius: 12px; padding: 13px 22px; background: #1a1a1a; color: #fff; font: 800 0.78rem Montserrat, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-R-SECOND { border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 18px; background: #fff; color: #1a1a1a; font: 800 0.74rem Montserrat, system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-R-LIEN { border: 0; background: none; padding: 8px 0; color: #5a7a94; font: 700 0.74rem Montserrat, system-ui, sans-serif; text-decoration: underline; cursor: pointer; text-align: left; }' +
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
        /* Code d'accès — présentation PC */
        '.JUM-PIN-PC { background: linear-gradient(135deg, #F8FBFD 0%, #E8F0F6 100%); }' +
        '.JUM-PINPC { display: grid; grid-template-columns: 1fr 1.1fr; width: 100%; max-width: 820px; min-height: 460px; background: #fff; border-radius: 26px; overflow: hidden; box-shadow: 0 30px 80px rgba(26,45,62,0.18), 0 2px 6px rgba(26,45,62,0.06); color: #1a1a1a; }' +
        '.JUM-PINPC-MARQUE { background: #1a1a1a; color: #fff; padding: 40px 36px; display: flex; flex-direction: column; align-items: flex-start; position: relative; }' +
        '.JUM-PINPC-MARQUE::after { content: ""; position: absolute; inset: 0; background: linear-gradient(160deg, rgba(122,157,181,0.22), transparent 55%); pointer-events: none; }' +
        '.JUM-PINPC-MARQUE img { width: 74px; height: 74px; object-fit: contain; filter: invert(1) brightness(1.4); opacity: 0.95; }' +
        '.JUM-PINPC-NOM { margin-top: 18px; font-size: 1.7rem; font-weight: 800; letter-spacing: 0.22em; }' +
        '.JUM-PINPC-SOUS { margin-top: 6px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #a9c3d6; }' +
        '.JUM-PINPC-DATE { margin-top: auto; display: flex; flex-direction: column; gap: 2px; }' +
        '.JUM-PINPC-DATE b { font-size: 2.6rem; font-weight: 800; letter-spacing: 0.02em; }' +
        '.JUM-PINPC-DATE span { font-size: 0.82rem; color: #c7d4de; text-transform: capitalize; }' +
        '.JUM-PINPC-NOTE { margin-top: 22px; display: flex; align-items: center; gap: 8px; font-size: 0.72rem; color: #a9c3d6; }' +
        '.JUM-PINPC-NOTE svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PINPC-SAISIE { padding: 44px 44px 30px; display: flex; flex-direction: column; align-items: center; text-align: center; }' +
        '.JUM-PINPC-IC { width: 56px; height: 56px; padding: 14px; box-sizing: border-box; border-radius: 18px; background: rgba(90,122,148,0.1); color: #5a7a94; }' +
        '.JUM-PINPC-IC svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PINPC-SAISIE h2 { margin: 16px 0 6px; font-size: 1.3rem; font-weight: 800; }' +
        '.JUM-PINPC-SAISIE p { margin: 0 0 24px; font-size: 0.85rem; color: #5a7a94; }' +
        '.JUM-PIN-PC .JUM-PIN-POINTS { gap: 14px; margin-bottom: 8px; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT { width: 54px; height: 62px; border-radius: 14px; border: 1.5px solid #c9d6e0; background: #F8FBFD; position: relative; transition: border-color 0.15s ease, box-shadow 0.15s ease; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT.plein { background: #F8FBFD; border-color: #1a1a1a; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT.plein::after { content: ""; position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #1a1a1a; }' +
        '.JUM-PIN-PC .JUM-PIN-POINT.actif { border-color: #5a7a94; box-shadow: 0 0 0 4px rgba(90,122,148,0.15); }' +
        '.JUM-PIN-PC .JUM-PIN-ERREUR { color: #b91c1c; margin: 6px 0 4px; }' +
        '.JUM-PINPC-AIDE { font-size: 0.72rem; color: #7b8e9d; margin-bottom: 16px; }' +
        '.JUM-PINPC-AIDE span { display: inline-block; padding: 1px 7px; border: 1px solid #c9d6e0; border-bottom-width: 2px; border-radius: 6px; font-weight: 700; color: #5a7a94; background: #fff; }' +
        '.JUM-PIN-PC .JUM-PIN-PAVE { width: 100%; max-width: 250px; gap: 8px; margin-bottom: 12px; }' +
        '.JUM-PIN-PC .JUM-PIN-PAVE button { height: 42px; border-radius: 11px; border: 1px solid #dde6ee; background: #fff; color: #1a1a1a; font-size: 1rem; }' +
        '.JUM-PIN-PC .JUM-PIN-PAVE button:hover { background: #F2F7FB; border-color: #c9d6e0; }' +
        '.JUM-PIN-PC .JUM-R-LIEN { color: #5a7a94; }' +
        '.JUM-PIN-PC.sombre { background: linear-gradient(135deg, #0f1418 0%, #172029 100%); }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC { background: #1b242c; color: #e8eef3; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC-MARQUE { background: #0c1115; }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC-SAISIE p, .JUM-PIN-PC.sombre .JUM-R-LIEN { color: #a9c3d6; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-POINT { background: #141b21; border-color: #33424f; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-POINT.plein { background: #141b21; border-color: #e8eef3; } .JUM-PIN-PC.sombre .JUM-PIN-POINT.plein::after { background: #e8eef3; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-PAVE button { background: #141b21; border-color: #2a3640; color: #e8eef3; }' +
        '.JUM-PIN-PC.sombre .JUM-PINPC-AIDE span { background: #141b21; border-color: #33424f; color: #a9c3d6; }' +
        '.JUM-PIN-PC.sombre .JUM-PIN-ERREUR { color: #f87171; }' +
        '.JUM-TRAIT { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; transition: opacity 0.2s ease; }' +
        '.JUM-CHOIX.choisi .JUM-TRAIT { opacity: 0; }' +
        '@media (prefers-reduced-motion: reduce) { .JUM-PAN, .JUM-BLOC { transition-duration: 0.01s; } }' +
        '';
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    // ---------- Mise à jour forcée ----------
    // À chaque publication, augmenter BUILD ici ET dans build.json (même numéro), avec la version de chaque appli.
    // Dès l'ouverture (démarrage ou retour dans l'appli), TRIGONE vérifie s'il existe une publication plus récente
    // et se met à jour tout seul. Jamais au mauvais moment : uniquement sur l'accueil, sans fenêtre ouverte
    // (chaque appli le dit via JUMELAGE_PEUT_RECHARGER) ; sinon au prochain retour sur l'accueil.
    var BUILD = 43, MAJ_DISPO = false, CLE_RECHARGE = 'trigone_recharge_build';
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
    var ecran = null;
    var TEL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>';
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
            mailVal1: mer.mailSignataire || '', monMail: mer.mailDemandeur || '', mailChorus: cr.mailAssist || ''
        };
        Object.keys(s).forEach(function(k) { if (!d[k] && s[k]) d[k] = s[k]; });
        return d;
    }
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
        try { localStorage.setItem('trigone_app_settings', JSON.stringify(cr)); } catch (e) {}
        ecrireTxt('trigone_premier_lancement_fait', '1');
        // Page Compte-rendu ouverte : ses valeurs en mémoire suivent tout de suite.
        if (DANS_CR) {
            if (r.unite && 'UNIT_NAME' in window) window.UNIT_NAME = r.unite;
            if (r.mailChorus && 'MAIL_ASSIST' in window) window.MAIL_ASSIST = r.mailChorus;
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
    window.JUMELAGE_EFFACER_CODE = function() { try { ['trigone_code_commun', 'trigone_pin_hash', 'mer_pin_hash'].forEach(function(k) { localStorage.removeItem(k); }); } catch (e) {} };
    window.JUMELAGE_REGLAGES_FAITS = function() { return !!lireJSON(CLE_REGLAGES) || lireTxt('mer_config_faite') === '1'; };

    var reglages = null;
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function(ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
    window.JUMELAGE_REGLAGES = function(opts) {
        opts = opts || {};
        if (reglages || !document.body) return;
        if (opts.premiere && !window.JUMELAGE_PRESENTATION_VUE()) {
            window.JUMELAGE_PRESENTATION({ premiere: true, apres: function() { window.JUMELAGE_REGLAGES(opts); } });
            return;
        }
        var r = lireReglages(), premiere = !!opts.premiere;
        var ancienCode = !codeDefini() && (lireTxt('mer_pin_hash') || lireTxt('trigone_pin_hash'));
        function champ(id, label, val, attrs) {
            return '<div class="JUM-R-CHAMP"><label for="JUM-R-' + id + '">' + label + '</label><input id="JUM-R-' + id + '" value="' + esc(val) + '" ' + (attrs || 'type="text" autocomplete="off"') + '></div>';
        }
        reglages = document.createElement('div');
        reglages.className = 'JUM-REGLAGES';
        reglages.setAttribute('role', 'dialog');
        reglages.innerHTML = '<div class="JUM-R-CARTE">' +
            '<div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + ROUE_SVG + '</span><div><h2>' + (premiere ? 'Avant de commencer' : 'Réglages TRIGONE') + '</h2>' +
                '<p>Communs à Mise en route et Compte-rendu de mission. Enregistrés sur cet appareil uniquement.</p></div>' +
                (premiere ? '' : '<button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_REGLAGES()">✕</button>') + '</div>' +
            '<div class="JUM-R-CORPS">' +
                '<div class="JUM-R-TITRE">Mon identité</div>' +
                '<div class="JUM-R-GRILLE">' + champ('UNITE', 'Unité / entité', r.unite, 'type="text" autocomplete="off" placeholder="EX : 4°RIISC"') +
                    champ('CIE', 'CIE', r.cie, 'type="text" autocomplete="off" placeholder="EX : 4CIE"') +
                    champ('GRADE', 'Grade', r.grade, 'type="text" autocomplete="off" placeholder="EX : ADJUDANT"') +
                    champ('MATRICULE', 'Matricule / NID', formatMatricule(r.matricule), 'type="text" inputmode="numeric" autocomplete="off" placeholder="EX : 067 50 10 191"') +
                    champ('NOM', 'Nom', r.nom, 'type="text" autocomplete="off" placeholder="EX : BOUQUET"') +
                    champ('PRENOM', 'Prénom', r.prenom, 'type="text" autocomplete="off" data-no-uppercase="1" placeholder="EX : Germain-Pierre"') + '</div>' +
                '<div class="JUM-R-TITRE">Envois</div>' +
                '<div class="JUM-R-GRILLE">' + champ('MAILVAL1', 'Mail du 1er valideur (chef de service)', r.mailVal1, 'type="email" autocomplete="off" placeholder="EX : prenom.nom@interieur.gouv.fr"') +
                    champ('MONMAIL', 'Mon mail', r.monMail, 'type="email" autocomplete="off" placeholder="EX : prenom.nom@interieur.gouv.fr"') +
                    champ('MAILCHORUS', 'Mail de l\'assistant Chorus DT (compte-rendu)', r.mailChorus, 'type="email" autocomplete="off" placeholder="EX : prenom.nom@interieur.gouv.fr"') + '</div>' +
                '<div class="JUM-R-TITRE">Code d\'accès à 4 chiffres</div>' +
                '<p class="JUM-R-AIDE">' + (codeDefini() ? '🔒 Code actif : demandé à chaque ouverture de TRIGONE. Pour le changer, saisissez-en un nouveau.'
                    : ancienCode ? 'Un ancien code est encore actif dans l\'une des applis : définissez le code TRIGONE pour le remplacer.'
                    : 'Demandé à chaque ouverture de TRIGONE, pour protéger vos données.' + (premiere ? '' : ' Facultatif.')) + '</p>' +
                '<div class="JUM-R-GRILLE">' + champ('CODE1', codeDefini() ? 'Nouveau code' : 'Code', '', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"') +
                    champ('CODE2', 'Confirmer le code', '', 'type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"') + '</div>' +
                (codeDefini() ? '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_SUPPRIMER_CODE()">Supprimer le code d\'accès</button>' : '') +
                '<p class="JUM-R-ERREUR" id="JUM-R-ERREUR"></p>' +
            '</div>' +
            '<div class="JUM-R-PIED">' +
                // Inscription obligatoire pour tous à la première ouverture (valideurs et assistant Chorus DT compris).
                (premiere ? '' : '<button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_REGLAGES()">Annuler</button>') +
                '<button type="button" class="JUM-R-PRINCIPAL" onclick="JUMELAGE_ENREGISTRER_REGLAGES(' + (premiere ? 'true' : 'false') + ')">' + (premiere ? 'Continuer →' : 'Enregistrer') + '</button>' +
            '</div></div>';
        document.body.appendChild(reglages);
        var m = document.getElementById('JUM-R-MATRICULE');
        m.addEventListener('input', function() { m.value = formatMatricule(m.value); });
    };
    window.JUMELAGE_FERMER_REGLAGES = function() { if (reglages) { reglages.remove(); reglages = null; } };
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
        function refuser(t) { err.textContent = '⛔ ' + t; err.scrollIntoView({ block: 'nearest' }); }
        var r = { unite: v('UNITE').toUpperCase(), cie: v('CIE').toUpperCase(), grade: v('GRADE').toUpperCase(), nom: v('NOM').toUpperCase(), prenom: v('PRENOM'),
            matricule: formatMatricule(v('MATRICULE')), mailVal1: v('MAILVAL1'), monMail: v('MONMAIL'), mailChorus: v('MAILCHORUS') };
        var c1 = v('CODE1'), c2 = v('CODE2');
        if (premiere && (!r.unite || !r.cie || !r.grade || !r.nom || !r.prenom || !r.matricule || !r.mailVal1 || !r.monMail || !r.mailChorus))
            return refuser('Merci de remplir tous les champs avant de continuer.');
        if (r.matricule && chiffres(r.matricule).length !== 10) return refuser('Le matricule doit comporter 10 chiffres (ex : 067 50 10 191).');
        var mails = [r.mailVal1, r.monMail, r.mailChorus].filter(Boolean);
        if (mails.some(function(m) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m); })) return refuser('Une adresse mail n\'est pas valide.');
        if (premiere && !codeDefini() && !c1) return refuser('Choisissez un code d\'accès à 4 chiffres.');
        if (c1 || c2) {
            if (!/^\d{4}$/.test(c1)) return refuser('Le code doit contenir exactement 4 chiffres.');
            if (c1 !== c2) return refuser('Les deux codes ne correspondent pas.');
        }
        ecrireReglages(r);
        (c1 ? poserCode(c1) : Promise.resolve()).then(function() {
            window.JUMELAGE_FERMER_REGLAGES();
            bandeau(premiere ? 'C\'est prêt : vos informations pré-rempliront Mise en route et Compte-rendu.' : 'Réglages enregistrés.');
            if (window.JUMELAGE_APRES_REGLAGES) try { window.JUMELAGE_APRES_REGLAGES(); } catch (e) {}
        });
    };
    function bandeau(texte) {
        var b = document.createElement('div');
        b.className = 'JUM-BANDEAU'; b.textContent = '✓ ' + texte;
        document.body.appendChild(b);
        setTimeout(function() { b.classList.add('sortie'); }, 2600);
        setTimeout(function() { b.remove(); }, 3100);
    }

    // ---------- Présentation TRIGONE (première ouverture, puis roue crantée > Découvrir TRIGONE) ----------
    var CLE_PRESENTATION = 'trigone_presentation_jumelage_vue', presentation = null;
    var ICONES_PRES = {
        id: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.4"/><path d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3"/></svg>',
        cadenas: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
        maj: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/></svg>'
    };
    window.JUMELAGE_PRESENTATION = function(opts) {
        opts = opts || {};
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
    var NON_SAUVEGARDE = /^(trigone_build_vu|trigone_recharge_build|trigone_dernier_rappel_sauvegarde)$/;
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
    function appliquerSauvegarde(s, remplacer) {
        try {
            if (remplacer) localStorage.clear();
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
            annoncer('Sauvegarde téléchargée', 'Le fichier « ' + lien.download + ' » contient tout TRIGONE : demandes, documents, bibliothèque, comptes-rendus, remboursements, médailles, réglages et pièces jointes. Rangez-le en lieu sûr (mail à vous-même, clé USB, Drive…) : « Restaurer une sauvegarde » le remet en place, sur cet appareil ou un autre.', 'ok', 'ok');
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
                etat.textContent = 'Fichier de sauvegarde téléchargé. Ouvrez TRIGONE à la nouvelle adresse, puis roue crantée › « Restaurer une sauvegarde ».';
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
        var m = document.querySelector('.JUM-ROUE-MENU');
        if (m) { m.remove(); return; }
        if (!ecran) return;
        m = document.createElement('div');
        m.className = 'JUM-ROUE-MENU';
        m.innerHTML = '<button type="button" data-action="reglages">' + ROUE_SVG + '<span><b>Réglages TRIGONE</b><small>Identité, mails, code d\'accès</small></span></button>' +
            '<button type="button" data-action="presentation"><img src="' + (DANS_CR ? '../' : '') + 'phoenix-icon.png" alt=""><span><b>Découvrir TRIGONE</b><small>Revoir la présentation</small></span></button>' +
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
            else if (a === 'sauvegarder') window.JUMELAGE_SAUVEGARDER();
            else if (a === 'restaurer') window.JUMELAGE_RESTAURER();
            else window.JUMELAGE_PRESENTATION();
        });
        ecran.appendChild(m);
    };

    // ---------- Icônes au trait à la place des emoji couleur (les deux applis) ----------
    // Les textes des applis gardent leurs emoji ; à l'affichage, chacun est remplacé par l'icône au trait
    // correspondante (même style que les onglets). Rien ne change dans les mails, PDF ou notifications.
    var P = {
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

    // ---------- Signaler un problème (écran de choix et les deux applis) ----------
    var MAIL_SUPPORT = 'trigone.app@outlook.fr';
    window.JUMELAGE_SIGNALER = function(ecran) {
        var appli = ecran === 'choix' ? 'Écran de choix des applis' : (DANS_CR ? 'Compte-rendu de mission' : 'Mise en route');
        var v = window.APP_VERSION_AFFICHEE || (typeof APP_VERSION_AFFICHEE !== 'undefined' ? APP_VERSION_AFFICHEE : '');
        var sujet = 'TRIGONE - Signalement (' + (DANS_CR ? 'Compte-rendu' : 'Mise en route') + (v ? ' V' + v : '') + ')';
        var corps = 'Décrivez ici ce qui s\'est passé :\n\n\n\n---\n' +
            'Appli : ' + appli + '\n' + (v ? 'Version TRIGONE : V' + v + '\n' : '') +
            (ecran && ecran !== 'choix' ? 'Écran concerné : ' + ecran + '\n' : '') +
            'Appareil : ' + (window.matchMedia && matchMedia('(min-width: 1100px)').matches ? 'ordinateur' : 'téléphone / tablette') + '\n' +
            'Connecté à internet : ' + (navigator.onLine ? 'oui' : 'non');
        window.location.href = 'mailto:' + MAIL_SUPPORT + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
    };

    // ---------- Pont ordinateur → téléphone : une mise en route passe dans Compte-rendu par QR code ----------
    // Mise en route (souvent sur l'ordinateur) affiche un QR code ; Compte-rendu (souvent sur le téléphone) le scanne.
    // Le QR ne contient que ce dont le compte-rendu a besoin (ni pièces jointes, ni imputation) : c'est une adresse
    // « cr/?mer=… », lisible aussi par l'appareil photo du téléphone. Aucune donnée ne transite par un serveur.
    var CHAMPS_TRAJET = ['moyen', 'lieuDep', 'cpDep', 'paysDep', 'lieuArr', 'cpArr', 'paysArr', 'dateDep', 'dateArr', 'residenceDep', 'residenceArr'];
    var CHAMPS_PERSONNE = ['nom', 'prenom', 'grade', 'matricule', 'cie'];
    function versTableau(o, champs) {
        var t = champs.map(function(k) { return (o && o[k]) || ''; });
        while (t.length && t[t.length - 1] === '') t.pop();
        return t;
    }
    function depuisTableau(t, champs) { var o = {}; champs.forEach(function(k, i) { o[k] = (t && t[i]) || ''; }); return o; }
    function base64url(octets) {
        var s = ''; for (var i = 0; i < octets.length; i++) s += String.fromCharCode(octets[i]);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function depuisBase64url(t) {
        t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
        var s = atob(t), o = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
        return o;
    }
    function fluxVersOctets(octets, transformation) {
        var flux = new Blob([octets]).stream().pipeThrough(transformation);
        return new Response(flux).arrayBuffer().then(function(b) { return new Uint8Array(b); });
    }
    // Demande de Mise en route → adresse du QR code (promesse).
    // Toutes les personnes de la demande (le téléphone retrouve la sienne par son nom) ; pour une grande
    // collective, seulement la personne des réglages, afin que le QR code reste facile à lire.
    window.JUMELAGE_MER_VERS_QR = function(d) {
        var nom = (lireReglages().nom || '').trim().toUpperCase();
        var moi = (d.personnes || []).filter(function(p) { return nom && (p.nom || '').trim().toUpperCase() === nom; });
        return construireQr(d, d.personnes || []).then(function(url) {
            return url.length > 1400 && moi.length && moi.length < (d.personnes || []).length ? construireQr(d, moi) : url;
        });
    };
    function construireQr(d, pers) {
        var t = d.trajets || {};
        var c = { v: 1, id: d.id || '', o: d.objet || '', p: pers.map(function(p) { return versTableau(p, CHAMPS_PERSONNE); }),
            a: versTableau(t.aller, CHAMPS_TRAJET), r: versTableau(t.retour, CHAMPS_TRAJET) };
        if (d.reservationABT) c.b = 1;
        if (t.intermediaireAllerActif) c.ai = versTableau(t.intermediaireAller, CHAMPS_TRAJET);
        if (t.intermediaireRetourActif) c.ri = versTableau(t.intermediaireRetour, CHAMPS_TRAJET);
        var octets = new TextEncoder().encode(JSON.stringify(c));
        var base = new URL(DANS_CR ? './' : 'cr/', location.href.split('?')[0].split('#')[0]).href;
        var adresse = function(prefixe, o) { return base + '?mer=' + prefixe + base64url(o); };
        if (typeof CompressionStream === 'undefined') return Promise.resolve(adresse('j', octets));
        return fluxVersOctets(octets, new CompressionStream('deflate-raw'))
            .then(function(z) { return adresse('z', z); }, function() { return adresse('j', octets); });
    }
    // Texte scanné (adresse « …?mer=… » ou contenu seul) → demande au format Mise en route (promesse).
    window.JUMELAGE_QR_VERS_MER = function(texte) {
        return new Promise(function(ok, ko) {
            var brut = String(texte || '').trim(), m = brut.match(/[?&]mer=([^&#\s]+)/);
            var val = m ? decodeURIComponent(m[1]) : brut;
            if (!/^[zj][A-Za-z0-9_-]+$/.test(val)) { ko(new Error('pas-mer')); return; }
            var octets = depuisBase64url(val.slice(1));
            var suite = val[0] === 'z'
                ? (typeof DecompressionStream === 'undefined' ? Promise.reject(new Error('ancien')) : fluxVersOctets(octets, new DecompressionStream('deflate-raw')))
                : Promise.resolve(octets);
            suite.then(function(o) {
                var c = JSON.parse(new TextDecoder().decode(o));
                if (!c || c.v !== 1) throw new Error('pas-mer');
                ok({ id: c.id || '', objet: c.o || '', reservationABT: !!c.b,
                    personnes: (c.p || []).map(function(p) { return depuisTableau(p, CHAMPS_PERSONNE); }),
                    trajets: { aller: depuisTableau(c.a, CHAMPS_TRAJET), retour: depuisTableau(c.r, CHAMPS_TRAJET),
                        intermediaireAllerActif: !!c.ai, intermediaireAller: depuisTableau(c.ai, CHAMPS_TRAJET),
                        intermediaireRetourActif: !!c.ri, intermediaireRetour: depuisTableau(c.ri, CHAMPS_TRAJET) } });
            }).catch(function(e) { ko(e && e.message === 'ancien' ? e : new Error('pas-mer')); });
        });
    };

    // Mise en route : fenêtre du QR code (une ou plusieurs demandes envoyées ensemble).
    var fenetreQr = null;
    window.JUMELAGE_AFFICHER_QR_MER = function(demandes) {
        if (fenetreQr || !document.body || !demandes || !demandes.length) return;
        fenetreQr = document.createElement('div');
        fenetreQr.className = 'JUM-QR';
        fenetreQr.setAttribute('role', 'dialog');
        fenetreQr.innerHTML = '<div class="JUM-QR-CARTE"><button type="button" class="JUM-R-X" aria-label="Fermer">✕</button>' +
            '<div class="JUM-QR-TETE"><span class="JUM-QR-TEL">' + TEL_SVG + '</span><div><h2>Sur un téléphone</h2><p>Pour faire le compte-rendu sur votre téléphone, ou l\'envoyer en image au missionnaire concerné.</p></div></div>' +
            (demandes.length > 1 ? '<div class="JUM-QR-CHOIX">' + demandes.map(function(d, i) {
                return '<button type="button" data-i="' + i + '"' + (i ? '' : ' class="actif"') + '>' + esc(d.objet || ('Demande ' + (i + 1))) + '</button>'; }).join('') + '</div>' : '') +
            '<div class="JUM-QR-CADRE"><div class="JUM-QR-CODE"></div></div>' +
            '<div class="JUM-QR-ACTIONS"><button type="button" data-action="partager" class="JUM-QR-PARTAGER HIDDEN-JUM">📤 Envoyer l\'image</button>' +
                '<button type="button" data-action="enregistrer">💾 Enregistrer l\'image</button></div>' +
            '<ol class="JUM-QR-ETAPES"><li>Sur le téléphone, ouvrez <b>TRIGONE Compte-rendu de mission</b>.</li>' +
                '<li>Touchez <b>« À partir d\'une mise en route »</b>, puis <b>« Scanner le QR code »</b> pour viser cet écran, ou <b>« Depuis une photo »</b> pour l\'image reçue.</li>' +
                '<li>La mission est pré-remplie.</li></ol>' +
            '<p class="JUM-QR-NOTE">' + ICONES_PRES.cadenas + '<span>Aucun serveur TRIGONE : les informations sont dans le QR code lui-même.</span></p></div>';
        document.body.appendChild(fenetreQr);
        var f = fenetreQr, zone = f.querySelector('.JUM-QR-CODE'), courante = 0;
        function dessiner(i) {
            zone.innerHTML = ''; courante = i;
            window.JUMELAGE_MER_VERS_QR(demandes[i]).then(function(url) {
                if (typeof QRCode === 'undefined') { zone.textContent = 'QR code indisponible : rechargez la page.'; return; }
                new QRCode(zone, { text: url, width: 720, height: 720, colorDark: '#1a1a1a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
                zone.setAttribute('data-url', url);
            });
        }
        // L'image envoyée : QR code net + de quoi reconnaître la mission, prête pour un SMS, WhatsApp ou un mail.
        function fichierImage() {
            var qr = zone.querySelector('canvas'), d = demandes[courante] || {}, a = (d.trajets && d.trajets.aller) || {}, r = (d.trajets && d.trajets.retour) || {};
            if (!qr) return Promise.reject(new Error('qr'));
            var W = 1080, H = 1400, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            var x = cv.getContext('2d');
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
            x.fillStyle = '#E8F0F6'; x.fillRect(0, 0, W, 190);
            x.textAlign = 'center'; x.fillStyle = '#1a1a1a';
            x.font = '800 64px Montserrat, system-ui, sans-serif'; x.fillText('T R I G O N E', W / 2, 96);
            x.fillStyle = '#5a7a94'; x.font = '800 26px Montserrat, system-ui, sans-serif'; x.fillText('MISE EN ROUTE  →  COMPTE-RENDU DE MISSION', W / 2, 150);
            function ligne(t, y, police, couleur) { x.font = police; x.fillStyle = couleur; var s = String(t || ''); while (s.length > 4 && x.measureText(s).width > W - 120) s = s.slice(0, -2); if (s !== String(t || '')) s += '…'; x.fillText(s, W / 2, y); }
            var jour = function(v) { try { return v ? new Date(v).toLocaleDateString('fr-FR') : ''; } catch (e) { return ''; } };
            ligne(d.objet || 'Mise en route', 262, '800 40px Montserrat, system-ui, sans-serif', '#1a1a1a');
            ligne((d.personnes || []).map(function(p) { return [p.grade, p.nom, p.prenom].filter(Boolean).join(' '); }).join(', '), 314, '600 30px Montserrat, system-ui, sans-serif', '#404040');
            ligne([[a.lieuDep, a.paysArr || a.lieuArr].filter(Boolean).join(' → '), [jour(a.dateDep), jour(r.dateArr)].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  '), 360, '500 28px Montserrat, system-ui, sans-serif', '#525252');
            x.imageSmoothingEnabled = false; x.drawImage(qr, 170, 410, 740, 740);
            ligne('Dans TRIGONE Compte-rendu de mission :', 1232, '700 30px Montserrat, system-ui, sans-serif', '#1a1a1a');
            ligne('« À partir d\'une mise en route » › « Depuis une photo »', 1280, '600 28px Montserrat, system-ui, sans-serif', '#5a7a94');
            return new Promise(function(ok, ko) { cv.toBlob(function(b) { b ? ok(new File([b], 'TRIGONE - ' + String(d.objet || 'mise en route').replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '.png', { type: 'image/png' })) : ko(new Error('image')); }, 'image/png'); });
        }
        var boutonPartager = f.querySelector('.JUM-QR-PARTAGER');
        try { if (navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] })) boutonPartager.classList.remove('HIDDEN-JUM'); } catch (e) {}
        f.addEventListener('click', function(ev) {
            var act = ev.target.closest('.JUM-QR-ACTIONS button');
            if (act) {
                fichierImage().then(function(fichier) {
                    if (act.getAttribute('data-action') === 'partager') return navigator.share({ files: [fichier], title: 'TRIGONE — mise en route' }).catch(function() {});
                    var lien = document.createElement('a'); lien.href = URL.createObjectURL(fichier); lien.download = fichier.name;
                    document.body.appendChild(lien); lien.click(); setTimeout(function() { URL.revokeObjectURL(lien.href); lien.remove(); }, 1500);
                    bandeau('Image enregistrée : envoyez-la au missionnaire (SMS, WhatsApp, mail…).');
                });
                return;
            }
            var b = ev.target.closest('.JUM-QR-CHOIX button');
            if (b) { Array.prototype.forEach.call(f.querySelectorAll('.JUM-QR-CHOIX button'), function(x) { x.classList.toggle('actif', x === b); }); dessiner(+b.getAttribute('data-i')); return; }
            if (ev.target === f || ev.target.closest('.JUM-R-X')) { f.remove(); fenetreQr = null; }
        });
        dessiner(0);
    };

    // Compte-rendu : scanner (caméra arrière). BarcodeDetector si le téléphone le propose, sinon jsQR (iPhone).
    var scanner = null;
    function chargerJsQR() {
        if (window.jsQR) return Promise.resolve();
        return new Promise(function(ok, ko) {
            var s = document.createElement('script');
            s.src = (DANS_CR ? '../' : '') + 'vendor/jsQR.js';
            s.onload = ok; s.onerror = ko;
            document.head.appendChild(s);
        });
    }
    window.JUMELAGE_FERMER_SCANNER = function() {
        if (!scanner) return;
        scanner.fini = true;
        if (scanner.flux) scanner.flux.getTracks().forEach(function(t) { t.stop(); });
        scanner.el.remove(); scanner = null;
    };
    // QR code sur une photo (image reçue par message, capture d'écran…) : choisie dans la galerie du téléphone.
    function lireImage(fichier) {
        var bitmap = window.createImageBitmap ? createImageBitmap(fichier) : new Promise(function(ok, ko) {
            var img = new Image(); img.onload = function() { ok(img); }; img.onerror = ko; img.src = URL.createObjectURL(fichier);
        });
        return bitmap.then(function(img) {
            var avecDetecteur = window.BarcodeDetector && BarcodeDetector.getSupportedFormats
                ? BarcodeDetector.getSupportedFormats().then(function(f) {
                    return f.indexOf('qr_code') < 0 ? null : new BarcodeDetector({ formats: ['qr_code'] }).detect(img).then(function(r) { return r && r[0] ? r[0].rawValue : null; }, function() { return null; });
                }, function() { return null; })
                : Promise.resolve(null);
            return avecDetecteur.then(function(texte) {
                if (texte) return texte;
                return chargerJsQR().then(function() {
                    var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
                    var tailles = [1400, 2000, 900, 600], cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
                    for (var i = 0; i < tailles.length; i++) {
                        var k = Math.min(1, tailles[i] / Math.max(w, h));
                        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
                        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
                        ctx.drawImage(img, 0, 0, cv.width, cv.height);
                        var px = ctx.getImageData(0, 0, cv.width, cv.height);
                        var r = window.jsQR(px.data, px.width, px.height, { inversionAttempts: 'attemptBoth' });
                        if (r && r.data) return r.data;
                        if (k === 1) break;
                    }
                    return null;
                });
            });
        });
    }
    window.JUMELAGE_LIRE_QR_PHOTO = function(surTexte, surErreur) {
        var entree = document.createElement('input');
        entree.type = 'file'; entree.accept = 'image/*'; entree.style.display = 'none';
        entree.addEventListener('change', function() {
            var f = entree.files && entree.files[0];
            entree.remove();
            if (!f) return;
            lireImage(f).then(function(texte) {
                if (texte) surTexte(texte);
                else surErreur('Aucun QR code lisible sur cette image. Choisissez l\'image reçue telle quelle (sans la recadrer), ou une photo nette et bien droite de l\'écran.');
            }, function() { surErreur('Cette image n\'a pas pu être ouverte. Essayez avec une autre image.'); });
        });
        document.body.appendChild(entree);
        entree.click();
    };
    window.JUMELAGE_LIRE_QR_IMAGE = lireImage;   // pour les tests

    // surTexte(texte) reçoit le contenu du QR code ; surErreur(message) si la caméra est inaccessible.
    window.JUMELAGE_SCANNER_QR = function(surTexte, surErreur) {
        if (scanner || !document.body) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { surErreur('Ce navigateur ne donne pas accès à la caméra.'); return; }
        var el = document.createElement('div');
        el.className = 'JUM-SCAN';
        el.innerHTML = '<video playsinline muted></video><div class="JUM-SCAN-VISEUR"><span></span></div>' +
            '<div class="JUM-SCAN-TEXTE">Visez le QR code affiché par<br><b>TRIGONE Mise en route</b> sur l\'ordinateur</div>' +
            '<button type="button" class="JUM-SCAN-PHOTO">🖼️ Depuis une photo</button>' +
            '<button type="button" class="JUM-SCAN-ANNULER">Annuler</button>';
        document.body.appendChild(el);
        scanner = { el: el, fini: false, flux: null };
        var s = scanner, video = el.querySelector('video');
        el.querySelector('.JUM-SCAN-ANNULER').addEventListener('click', window.JUMELAGE_FERMER_SCANNER);
        el.querySelector('.JUM-SCAN-PHOTO').addEventListener('click', function() { window.JUMELAGE_FERMER_SCANNER(); window.JUMELAGE_LIRE_QR_PHOTO(surTexte, surErreur); });
        var detecteur = null;
        var pret = (window.BarcodeDetector && BarcodeDetector.getSupportedFormats
            ? BarcodeDetector.getSupportedFormats().then(function(f) { if (f.indexOf('qr_code') >= 0) detecteur = new BarcodeDetector({ formats: ['qr_code'] }); }, function() {})
            : Promise.resolve()).then(function() { return detecteur ? null : chargerJsQR(); });
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(function(flux) {
            if (s.fini) { flux.getTracks().forEach(function(t) { t.stop(); }); return; }
            s.flux = flux; video.srcObject = flux;
            return video.play().then(function() { return pret; }).then(function() {
                var toile = document.createElement('canvas'), ctx = toile.getContext('2d', { willReadFrequently: true });
                function trouve(texte) { if (s.fini) return; window.JUMELAGE_FERMER_SCANNER(); surTexte(texte); }
                function boucle() {
                    if (s.fini) return;
                    if (video.readyState < 2) { requestAnimationFrame(boucle); return; }
                    if (detecteur) {
                        detecteur.detect(video).then(function(r) { if (r && r[0]) trouve(r[0].rawValue); else setTimeout(boucle, 120); }, function() { setTimeout(boucle, 200); });
                        return;
                    }
                    var w = video.videoWidth, h = video.videoHeight, k = Math.min(1, 900 / Math.max(w, h));
                    toile.width = Math.round(w * k); toile.height = Math.round(h * k);
                    ctx.drawImage(video, 0, 0, toile.width, toile.height);
                    var img = ctx.getImageData(0, 0, toile.width, toile.height);
                    var r = window.jsQR && window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
                    if (r && r.data) trouve(r.data); else setTimeout(boucle, 90);
                }
                boucle();
            });
        }).catch(function(e) {
            if (s.fini) return;
            window.JUMELAGE_FERMER_SCANNER();
            surErreur(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
                ? 'TRIGONE n\'a pas l\'autorisation d\'utiliser la caméra. Autorisez-la dans les réglages du navigateur, puis réessayez.'
                : 'La caméra n\'a pas pu démarrer. Réessayez, ou visez le QR code avec l\'appareil photo du téléphone.');
        });
    };

    // ---------- Code d'accès commun : demandé une fois à l'ouverture de TRIGONE ----------
    var pave = null, saisie = '';
    function dessinerPoints() {
        if (!pave) return;
        Array.prototype.forEach.call(pave.querySelectorAll('.JUM-PIN-POINT'), function(p, i) { p.classList.toggle('plein', i < saisie.length); p.classList.toggle('actif', i === saisie.length); });
    }
    window.JUMELAGE_PIN_TOUCHE = function(ch) {
        if (!pave) return;
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
    // Efface toutes les données de TRIGONE sur l'appareil puis rouvre l'écran de choix, comme au premier jour.
    function toutEffacer() {
        try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
        var fin = function() { location.replace(DANS_CR ? '../' : './'); };
        var bases = ['trigone-mise-en-route'];
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
    window.JUMELAGE_REINITIALISER = function() {
        confirmerEffacement('Réinitialiser TRIGONE ?',
            'Toutes les données de TRIGONE seront définitivement effacées de cet appareil, pour les deux applis : demandes de mise en route, bibliothèque, comptes-rendus, remboursements, médailles, réglages (identité, mails) et code d\'accès.\n\nTRIGONE redémarrera comme au premier jour. Cette action est irréversible.',
            'Oui, tout effacer');
    };
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
        var touches = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'x'].map(function(t) {
            return t === '' ? '<span></span>' : '<button type="button" onclick="JUMELAGE_PIN_TOUCHE(\'' + t + '\')">' + (t === 'x' ? '⌫' : t) + '</button>';
        }).join('');
        var pc = window.matchMedia && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
        if (!pc) pave.innerHTML = '<div class="JUM-PIN-CARTE"><div class="JUM-PIN-TITRE">Code d\'accès</div><p>Entrez votre code à 4 chiffres pour ouvrir TRIGONE.</p>' +
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
        document.addEventListener('keydown', function clavier(e) {
            if (!pave) { document.removeEventListener('keydown', clavier); return; }
            if (/^\d$/.test(e.key)) window.JUMELAGE_PIN_TOUCHE(e.key); else if (e.key === 'Backspace') window.JUMELAGE_PIN_TOUCHE('x');
        });
    }
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
            // replace : pas d'entrée dans l'historique, la flèche retour du téléphone ne ramène pas à l'autre appli.
            setTimeout(function() { location.replace(APPLIS[cle].url); }, 480);
        }
    }

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
        ecran.className = 'JUM-CHOIX';
        ecran.setAttribute('role', 'dialog');
        ecran.setAttribute('aria-label', 'Choisir une application TRIGONE');
        ecran.innerHTML = panneau('mer') + panneau('cr') +
            '<svg class="JUM-TRAIT" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
            '<line x1="100" y1="0" x2="0" y2="100" stroke="#d6a756" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity="0.8"/></svg>' +
            '<button type="button" class="JUM-ROUE" aria-label="Réglages et présentation de TRIGONE" title="Réglages TRIGONE · Découvrir TRIGONE">' + ROUE_SVG + '</button>' +
            // Numéro de version, en haut à droite (le même dans les deux applis).
            (window.APP_VERSION_AFFICHEE ? '<div class="JUM-VERSION" title="Version de TRIGONE">V' + window.APP_VERSION_AFFICHEE + '</div>' : '') +
            // Mise à jour, en bas à gauche (pendant de la roue crantée).
            '<button type="button" class="JUM-ROUE JUM-MAJ-BTN" aria-label="Mise à jour de TRIGONE" title="Mise à jour">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('maj') : '') + '</button>';
        var roue = ecran.querySelector('.JUM-ROUE');
        ['pointerdown', 'pointerup'].forEach(function(t) { roue.addEventListener(t, function(e) { e.stopPropagation(); }); });
        roue.addEventListener('click', window.JUMELAGE_MENU_ROUE);
        var majBtn = ecran.querySelector('.JUM-MAJ-BTN');
        ['pointerdown', 'pointerup'].forEach(function(t) { majBtn.addEventListener(t, function(e) { e.stopPropagation(); }); });
        majBtn.addEventListener('click', function(e) { e.stopPropagation(); verifierMajManuelle(); });
        ecran.addEventListener('click', function(e) {
            var menu = document.querySelector('.JUM-ROUE-MENU');
            if (menu) { menu.remove(); return; }
            choisir(coteDuPoint(e.clientX, e.clientY));
        });
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
        var btn = ecran && ecran.querySelector('.JUM-MAJ-BTN'); if (btn) btn.classList.add('tourne');
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
    // QR code d'une mise en route lu avec l'appareil photo : on va droit au compte-rendu.
    if (DANS_CR && /[?&]mer=/.test(location.search)) { dejaChoisi = true; try { sessionStorage.setItem(CLE_CHOIX, '1'); } catch (e) {} }
    // Fichier .json ouvert depuis la messagerie (« Partager » / « Ouvrir avec » TRIGONE) : droit à Mise en route.
    if (!DANS_CR && (/[?&](partage|fichier)=/.test(location.search) || /\/partage-trigone\/?$/.test(location.pathname))) { dejaChoisi = true; try { sessionStorage.setItem(CLE_CHOIX, '1'); } catch (e) {} }
    // Juste après une mise à jour (nouvelle publication chargée, quelle qu'en soit la cause) : retour à l'écran de choix.
    var buildVu = +lireTxt('trigone_build_vu') || 0;
    var fichierOuQr = /[?&](partage|fichier|mer)=/.test(location.search) || /\/partage-trigone\/?$/.test(location.pathname);
    var apresMaj = false;
    try { apresMaj = sessionStorage.getItem('trigone_apres_maj') === '1'; sessionStorage.removeItem('trigone_apres_maj'); } catch (e) {}
    if ((apresMaj || (buildVu && buildVu < BUILD)) && !fichierOuQr) { dejaChoisi = false; arrivee = false; }
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
