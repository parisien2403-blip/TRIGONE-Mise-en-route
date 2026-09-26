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
        /* Médaillon Assistant Chorus DT : au centre, sur la diagonale */
        /* Logo Assist Chorus-DT : comme les deux autres (le logo seul), en plus petit. Posé sur la diagonale, il se met en
           négatif (mix-blend-mode : difference) : noir sur la partie claire, blanc sur la partie sombre, sans couleur ajoutée. */
        '.JUM-CHOIX { --jum-chorus: min(24vw, 17vh, 150px); }' +
        '.JUM-CHORUS { position: absolute; left: 50%; top: 50%; z-index: 3; transform: translate(-50%, -50%); width: var(--jum-chorus); aspect-ratio: 1; border: 0; border-radius: 0; background: none; box-shadow: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; mix-blend-mode: difference; transition: transform 0.2s ease; -webkit-tap-highlight-color: transparent; }' +
        '.JUM-CHORUS img { width: 100%; height: auto; display: block; filter: invert(1); }' +
        '.JUM-CHORUS:hover { transform: translate(-50%, -50%) scale(1.05); } .JUM-CHORUS:focus-visible { outline: 2px solid #d6a756; outline-offset: 6px; }' +
        '.JUM-CHOIX.choix-chorus .JUM-CHORUS { transform: translate(-50%, -50%) scale(1.12); }' +
        '.JUM-CHORUS-NB { position: absolute; z-index: 4; left: calc(50% + var(--jum-chorus) * 0.36); top: calc(50% - var(--jum-chorus) * 0.5); min-width: 24px; height: 24px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: #b91c1c; color: #fff; font: 800 0.75rem/24px Montserrat, system-ui, sans-serif; text-align: center; box-shadow: 0 4px 10px rgba(185,28,28,0.4); pointer-events: none; }' +
        '.JUM-R-CASE { display: flex; align-items: center; gap: 10px; font-size: 0.86rem; cursor: pointer; margin: 4px 0 8px; } .JUM-R-CASE input { width: 18px; height: 18px; flex-shrink: 0; }' +
        '.JUM-CR-FICHIER { display: flex; align-items: center; gap: 10px; padding: 9px 12px; margin: 6px 0; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.82rem; }' +
        '.JUM-CR-FICHIER b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .JUM-CR-FICHIER small { color: #64748b; white-space: nowrap; }' +
        '.JUM-CR-RETIRER { border: 0; background: none; color: #b91c1c; font-size: 0.9rem; cursor: pointer; padding: 2px 4px; }' +
        '.JUM-CR-AJOUT { display: block; text-align: center; margin: 10px 0 0; cursor: pointer; }' +
        'html body.dark-mode .JUM-CR-FICHIER { border-color: rgba(255,255,255,0.1); } html body.dark-mode .JUM-CR-FICHIER small { color: #a3a3a3; }' +
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
        'html body.dark-mode .JUM-R-X { background: #262626; color: #d4d4d4; border-color: rgba(255,255,255,0.1); }' +
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
    var BUILD = 51, MAJ_DISPO = false, CLE_RECHARGE = 'trigone_recharge_build';
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
    // Rôle « Assistant Chorus DT » : activé dans les Réglages avec le code remis par l'administrateur (seule son
    // empreinte figure ici). Son espace s'ouvre depuis le logo placé au centre de l'écran de choix.
    var CLE_ROLE_CHORUS = 'trigone_role_chorus', EMPREINTE_CODE_CHORUS = '1873312e8bec44f88043df4b267191cf334946fa92ae71e40c3d3d4867c9e49a';
    var LOGO_CHORUS = (DANS_CR ? '../' : '') + 'logo_chorus.webp';
    function roleChorus() { try { return localStorage.getItem(CLE_ROLE_CHORUS) === '1'; } catch (e) { return false; } }
    window.JUMELAGE_ROLE_CHORUS = roleChorus;
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
                // Mes rôles : chacun est missionnaire ; valideurs et assistant Chorus DT cochent en plus leur rôle, avec son code.
                '<div class="JUM-R-TITRE">Mes rôles</div>' +
                '<p class="JUM-R-AIDE">Vous êtes missionnaire. Si un ou plusieurs de ces rôles vous ont été confiés, cochez-les (vous pouvez les avoir tous) : chaque code, remis par l\'administrateur, est demandé une seule fois.</p>' +
                caseRole('VAL1', 'valideur1', '<b>VALIDEUR 1</b> (chef de service)', 'Code VALIDEUR 1') +
                caseRole('VAL2', 'valideur2', '<b>VALIDEUR 2</b>', 'Code VALIDEUR 2') +
                '<div id="JUM-R-FONCTION-BLOC" style="display:none;">' + champ('FONCTION', 'Ma fonction de valideur', (lireJSON('mer_valideur') || {}).fonction || '', 'type="text" autocomplete="off" placeholder="EX : CHEF DE SERVICE"') + '</div>' +
                caseRole('CHORUS', 'chorus', '<b>ASSIST CHORUS DT</b>', 'Code ASSIST CHORUS DT') +
                '<p class="JUM-R-AIDE" style="margin-top:6px;">Un rôle coché est déclaré à votre compte TRIGONE : votre boîte ne reçoit que ce qui lui revient (demandes à signer, ou demandes validées et comptes-rendus pour l\'assistant Chorus DT).</p>' +
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
        ['VAL1', 'VAL2', 'CHORUS'].forEach(function(id) {
            var c = document.getElementById('JUM-R-' + id);
            c.addEventListener('change', function() { majCasesRoles(c.checked && !roleActif(c.getAttribute('data-role')) ? id : null); });
        });
        majCasesRoles(null);
    };
    // Rôles : case cochée pas encore active → champ du code ; valideur → fonction (reprise dans ses signatures).
    function roleActif(role) { return role === 'chorus' ? roleChorus() : !!(lireJSON(CLE_ROLES_LOCAUX) || {})[role]; }
    function caseRole(id, role, libelle, libelleCode) {
        var actif = roleActif(role);
        return '<label class="JUM-R-CASE"><input type="checkbox" id="JUM-R-' + id + '" data-role="' + role + '"' + (actif ? ' checked' : '') + '><span>' + libelle +
            (actif ? ' <em class="JUM-R-ACTIF">✓ actif</em>' : '') + '</span></label>' +
            '<div id="JUM-R-' + id + '-CODE" style="display:none;"><div class="JUM-R-CHAMP"><label for="JUM-R-CODE' + id + '">' + libelleCode + '</label>' +
            '<input id="JUM-R-CODE' + id + '" type="password" autocomplete="off" placeholder="Code remis par l\'administrateur"></div></div>';
    }
    function majCasesRoles(focus) {
        var val = false;
        ['VAL1', 'VAL2', 'CHORUS'].forEach(function(id) {
            var c = document.getElementById('JUM-R-' + id); if (!c) return;
            document.getElementById('JUM-R-' + id + '-CODE').style.display = c.checked && !roleActif(c.getAttribute('data-role')) ? '' : 'none';
            if (id !== 'CHORUS' && c.checked) val = true;
        });
        var f = document.getElementById('JUM-R-FONCTION-BLOC'); if (f) f.style.display = val ? '' : 'none';
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
        // Rôles : chaque rôle nouvellement coché est vérifié avec son code avant tout enregistrement.
        var roles = ['VAL1', 'VAL2', 'CHORUS'].map(function(id) {
            var c = document.getElementById('JUM-R-' + id), role = c.getAttribute('data-role');
            return { id: id, role: role, niveau: id === 'VAL1' ? 1 : id === 'VAL2' ? 2 : 0, veut: c.checked, actif: roleActif(role), code: v('CODE' + id) };
        });
        var fonction = v('FONCTION').toUpperCase();
        var nouveaux = roles.filter(function(x) { return x.veut && !x.actif; });
        var sansCode = nouveaux.filter(function(x) { return !x.code; })[0];
        if (sansCode) return refuser('Saisissez le code ' + { VAL1: 'VALIDEUR 1', VAL2: 'VALIDEUR 2', CHORUS: 'ASSIST CHORUS DT' }[sansCode.id] + ', ou décochez la case.');
        if (roles.some(function(x) { return x.niveau && x.veut; }) && !fonction) return refuser('Indiquez votre fonction de valideur (ex : CHEF DE SERVICE).');
        if (roles.some(function(x) { return x.niveau && x.veut; }) && (!r.grade || !r.nom || !r.prenom)) return refuser('Un valideur signe avec son grade, son nom et son prénom : renseignez-les.');
        var acces = {};
        var etapeRole = nouveaux.reduce(function(prec, x) {
            return prec.then(function() {
                if (x.niveau) return verifierCodeValideur(x.code, x.niveau).then(function(a) { acces[x.niveau] = a; });
                return empreinteCodeChorus(x.code).then(function(h) { if (h !== EMPREINTE_CODE_CHORUS) throw 'Code ASSIST CHORUS DT incorrect.'; });
            });
        }, Promise.resolve());
        etapeRole.then(function() {
        var roleAvant = roleChorus(), veutChorus = roles[2].veut;
        try { if (veutChorus) localStorage.setItem(CLE_ROLE_CHORUS, '1'); else localStorage.removeItem(CLE_ROLE_CHORUS); } catch (e) {}
        var changes = roles.filter(function(x) { return x.veut !== x.actif; });
        changes.forEach(function(x) { window.JUMELAGE_DECLARER_ROLE(x.role, x.veut); });
        // Valideur : identité de signature (Espace valideur de Mise en route) et clé déverrouillée.
        if (roles.some(function(x) { return x.niveau && x.veut; })) {
            var val = lireJSON('mer_valideur') || {};
            val.grade = r.grade; val.nom = r.nom; val.prenom = r.prenom; val.fonction = fonction;
            ecrireTxt('mer_valideur', JSON.stringify(val));
        }
        // Une clé par rôle ; le rôle en cours de l'Espace valideur devient le premier rôle nouvellement activé.
        var etapeAcces = Promise.all(Object.keys(acces).map(function(n) { return accesValideur('ecrire', acces[n], 'valideur' + n); }))
            .then(function() { var n = acces[1] ? 1 : acces[2] ? 2 : 0; return n ? accesValideur('ecrire', acces[n]) : null; }).catch(function() {});
        roles.forEach(function(x) { if (x.niveau && x.actif && !x.veut) etapeAcces = etapeAcces.then(function() { return oublierAccesValideur(x.niveau); }); });
        ecrireReglages(r);
        Promise.all([c1 ? poserCode(c1) : Promise.resolve(), etapeAcces]).then(function() {
            window.JUMELAGE_FERMER_REGLAGES();
            if (roleAvant !== veutChorus && ecran) { ecran.remove(); ecran = null; window.JUMELAGE_CHOIX(); }
            var actives = changes.filter(function(x) { return x.veut; }).map(function(x) { return { VAL1: 'VALIDEUR 1', VAL2: 'VALIDEUR 2', CHORUS: 'ASSIST CHORUS DT' }[x.id]; });
            bandeau(actives.length ? (actives.length > 1 ? 'Rôles ' : 'Rôle ') + actives.join(' et ') + (actives.length > 1 ? ' activés' : ' activé') + (roles[2].veut && !roles[2].actif ? ' : votre espace Assistant Chorus DT est au centre de l\'écran de choix.' : ' : votre boîte TRIGONE reçoit les demandes à signer.') :
                premiere ? 'C\'est prêt : vos informations pré-rempliront Mise en route et Compte-rendu.' : 'Réglages enregistrés.');
            if (changes.length && window.JUMELAGE_ROLES_CHANGES) try { window.JUMELAGE_ROLES_CHANGES(); } catch (e) {}
            if (window.JUMELAGE_APRES_REGLAGES) try { window.JUMELAGE_APRES_REGLAGES(); } catch (e) {}
        });
        }, function(message) { refuser(message); });
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
    var NON_SAUVEGARDE = /^(trigone_build_vu|trigone_recharge_build|trigone_dernier_rappel_sauvegarde|trigone_compte|trigone_boite|trigone_roles_declares)$/;
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
        return fetch(API + chemin, { method: opts.methode || 'GET', headers: entetes, body: opts.corps ? JSON.stringify(opts.corps) : undefined, cache: 'no-store' })
            .then(function(r) {
                return r.json().catch(function() { return { ok: false, erreur: 'Service indisponible.' }; }).then(function(j) {
                    if (!r.ok || !j.ok) { var e = new Error(j.erreur || 'Service indisponible.'); e.statut = r.status; throw e; }
                    return j;
                });
            });
    }
    // Service disponible ? (boîte aux lettres en place sur le serveur)
    function serviceDisponible() {
        if (ETAT_API) return ETAT_API;
        ETAT_API = navigator.onLine ? appelApi('etat').then(function() { return true; }, function() { ETAT_API = null; return false; }) : Promise.resolve(false);
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

    window.JUMELAGE_COMPTE_ACTIF = function() { return !!monCompte(); };
    // Rôles de cet appareil (1er / 2e valideur après le code valideur, assistant Chorus DT après son code) : déclarés au
    // compte TRIGONE, ils décident de ce que la boîte peut recevoir (règle appliquée par le serveur).
    var CLE_ROLES_LOCAUX = 'trigone_roles_locaux', CLE_ROLES_DECLARES = 'trigone_roles_declares';
    function rolesLocaux() { var r = lireJSON(CLE_ROLES_LOCAUX) || {}; if (roleChorus()) r.chorus = true; return r; }
    function declarerRoles() {
        var c = monCompte(); if (!c || !navigator.onLine) return;
        var r = rolesLocaux(), cle = c.mail + '|' + Object.keys(r).sort().join(',');
        if (lireTxt(CLE_ROLES_DECLARES) === cle) return;
        Promise.all(Object.keys(r).map(function(role) { return appelApi('role', { methode: 'POST', corps: { role: role, actif: true } }); }))
            .then(function() { ecrireTxt(CLE_ROLES_DECLARES, cle); }).catch(function() {});
    }
    window.JUMELAGE_DECLARER_ROLE = function(role, actif) {
        var r = lireJSON(CLE_ROLES_LOCAUX) || {};
        if (actif) r[role] = true; else delete r[role];
        ecrireTxt(CLE_ROLES_LOCAUX, JSON.stringify(r));
        if (!actif && monCompte()) { try { localStorage.removeItem(CLE_ROLES_DECLARES); } catch (e) {} appelApi('role', { methode: 'POST', corps: { role: role, actif: false } }).catch(function() {}); }
        declarerRoles();
    };
    window.JUMELAGE_COMPTE_MAIL = function() { var c = monCompte(); return c ? c.mail : ''; };
    // Envoi direct : chiffré pour tous les appareils du destinataire. Rejette avec e.pasDeCompte si le destinataire
    // n'a pas encore de compte TRIGONE (l'envoi est alors bloqué : il doit d'abord activer son compte).
    window.JUMELAGE_ENVOYER_DIRECT = function(destinataire, type, nom, texte) {
        if (!monCompte()) return Promise.reject(Object.assign(new Error('Activez d\'abord votre compte TRIGONE.'), { sansCompte: true }));
        if (!navigator.onLine) return Promise.reject(new Error('Pas de connexion : l\'envoi direct demande du réseau.'));
        var dest = String(destinataire || '').trim().toLowerCase();
        return appelApi('cles?mail=' + encodeURIComponent(dest)).then(function(r) {
            if (!r.compte) throw Object.assign(new Error(dest + ' n\'a pas encore de compte TRIGONE.'), { pasDeCompte: true });
            // Le nom du fichier (qui contient le nom du demandeur) est chiffré avec le contenu : le serveur n'en voit rien.
            return chiffrerPour(r.appareils, JSON.stringify({ nom: nom, contenu: texte }));
        }).then(function(ch) {
            return appelApi('envoyer', { methode: 'POST', corps: { destinataire: dest, type: type, enveloppes: ch.enveloppes, donnees: ch.donnees } });
        });
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
    window.JUMELAGE_FERMER_ENVOI_CR = function() { if (fenCr) { fenCr.remove(); fenCr = null; } };
    // o : { destinataire, missionnaire, libelle, dates, corps, pieces (justificatifs déclarés), pdf() → Promise<{ nom, blob }>, succes() }
    window.JUMELAGE_ENVOYER_CR = function(o) {
        if (fenCr || !document.body) return;
        var compte = monCompte(), choisis = [];
        fenCr = document.createElement('div');
        fenCr.className = 'JUM-REGLAGES';
        fenCr.setAttribute('role', 'dialog');
        var tete = '<div class="JUM-R-TETE"><span class="JUM-R-ICONE">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('mail') : '') + '</span><div><h2>Envoyer le compte-rendu</h2>' +
            '<p>Chiffré, il arrive dans le TRIGONE de l\'assistant Chorus DT' + (o.destinataire ? ' (' + esc(o.destinataire) + ')' : '') + '. Seul lui peut le lire.</p></div>' +
            '<button type="button" class="JUM-R-X" aria-label="Fermer" onclick="JUMELAGE_FERMER_ENVOI_CR()">✕</button></div>';
        if (!compte || !o.destinataire) {
            fenCr.innerHTML = '<div class="JUM-R-CARTE">' + tete + '<div class="JUM-R-CORPS"><p class="JUM-R-AIDE" style="margin-top:14px;">' +
                (!compte ? 'Pour envoyer votre compte-rendu, activez d\'abord votre <b>compte TRIGONE</b> (votre adresse mail, vérifiée par un code) : une seule fois, sur cet appareil.'
                    : 'Renseignez d\'abord le <b>mail de l\'assistant Chorus DT</b> dans les Réglages TRIGONE (roue crantée de l\'écran de choix).') + '</p></div>' +
                '<div class="JUM-R-PIED"><button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_ENVOI_CR()">Fermer</button>' +
                '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-CR-ALLER">' + (!compte ? 'Activer mon compte TRIGONE' : 'Ouvrir les réglages') + '</button></div></div>';
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
            '<p class="JUM-R-AIDE" id="JUM-CR-TAILLE" style="margin-top:6px;"></p>' +
            '<p class="JUM-R-ERREUR" id="JUM-CR-ERR"></p></div>' +
            '<div class="JUM-R-PIED"><button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_ENVOI_CR()">Annuler</button>' +
            '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-CR-ENVOYER">Envoyer</button></div></div>';
        document.body.appendChild(fenCr);
        var f = fenCr, err = f.querySelector('#JUM-CR-ERR'), btn = f.querySelector('#JUM-CR-ENVOYER');
        function total() { return choisis.reduce(function(t, x) { return t + x.size; }, 0); }
        function dessiner() {
            f.querySelector('#JUM-CR-LISTE').innerHTML = choisis.map(function(x, i) {
                return '<div class="JUM-CR-FICHIER"><span>' + (/^image\//.test(x.type) ? '🖼️' : '📎') + '</span><b>' + esc(x.name) + '</b><small>' + tailleLisible(x.size) + '</small>' +
                    '<button type="button" class="JUM-CR-RETIRER" data-i="' + i + '" aria-label="Retirer">✕</button></div>';
            }).join('');
            f.querySelector('#JUM-CR-TAILLE').textContent = choisis.length ? choisis.length + ' justificatif(s) — ' + tailleLisible(total()) + ' (' + tailleLisible(TAILLE_MAX_CR) + ' au plus)' : '';
        }
        f.querySelector('#JUM-CR-LISTE').addEventListener('click', function(ev) {
            var b = ev.target.closest('.JUM-CR-RETIRER'); if (!b) return;
            choisis.splice(+b.getAttribute('data-i'), 1); dessiner();
        });
        f.querySelector('#JUM-CR-FICHIERS').addEventListener('change', function(ev) {
            var liste = Array.prototype.slice.call(ev.target.files || []); ev.target.value = '';
            err.textContent = '';
            Promise.all(liste.map(reduirePhoto)).then(function(r) {
                r.forEach(function(x) { if (!choisis.some(function(y) { return y.name === x.name && y.size === x.size; })) choisis.push(x); });
                dessiner();
                if (total() > TAILLE_MAX_CR) err.textContent = '⛔ Trop volumineux : retirez un fichier (' + tailleLisible(TAILLE_MAX_CR) + ' au plus).';
            });
        });
        btn.addEventListener('click', function() {
            if (total() > TAILLE_MAX_CR) { err.textContent = '⛔ Trop volumineux : retirez un fichier (' + tailleLisible(TAILLE_MAX_CR) + ' au plus).'; return; }
            if (!navigator.onLine) { err.textContent = '⛔ Pas de connexion : l\'envoi se fait dès que vous avez du réseau.'; return; }
            btn.disabled = true; btn.textContent = 'Envoi en cours…'; err.textContent = '';
            Promise.resolve().then(o.pdf).then(function(pdf) {
                if (!pdf || !pdf.blob) throw new Error('Le PDF du compte-rendu n\'a pas pu être produit : réessayez.');
                return Promise.all([blobB64(pdf.blob)].concat(choisis.map(blobB64))).then(function(b64) {
                    var fichiers = [{ nom: pdf.nom, type: 'application/pdf', b64: b64[0] }].concat(choisis.map(function(x, i) { return { nom: x.name, type: x.type || 'application/octet-stream', b64: b64[i + 1] }; }));
                    var contenu = JSON.stringify({ app: 'TRIGONE-CR', version: 1, missionnaire: o.missionnaire || '', libelle: o.libelle || '', dates: o.dates || '',
                        corps: o.corps || '', de: compte.mail, envoyeLe: new Date().toISOString(), fichiers: fichiers });
                    return window.JUMELAGE_ENVOYER_DIRECT(o.destinataire, 'CR', pdf.nom, contenu);
                });
            }).then(function() {
                window.JUMELAGE_FERMER_ENVOI_CR();
                if (o.succes) o.succes();
            }).catch(function(e) {
                btn.disabled = false; btn.textContent = 'Envoyer';
                err.textContent = '⛔ ' + (e.pasDeCompte ? o.destinataire + ' n\'a pas encore de compte TRIGONE : demandez-lui de l\'activer (roue crantée › Compte TRIGONE), puis renvoyez votre compte-rendu.' : (e.message || String(e)));
            });
        });
    };
    // ---------- Boîte de réception (sur l'appareil) ----------
    // Chaque envoi reçu est déchiffré, rangé sur l'appareil (Cache « trigone-boite-reception » + index localStorage
    // « trigone_boite »), puis supprimé du serveur. Il reste dans la boîte jusqu'à ce qu'on le traite ou le supprime.
    var CLE_BOITE = 'trigone_boite', CACHE_BOITE = 'trigone-boite-reception';
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
            if (d.app === 'TRIGONE-CR') return { nature: 'cr', n: 1, ids: [], noms: d.missionnaire || '', objet: d.libelle || 'Compte-rendu de mission',
                dates: d.dates || '', lieu: '', pieces: (d.fichiers || []).length };
            var ds = d.demandes || [], p0 = ((ds[0] || {}).personnes || [])[0] || {};
            var nature = ds.some(function(x) { return x.refus; }) ? 'refus'
                : ds.length && ds.every(function(x) { return (x.validations || []).length >= 2; }) ? 'chorus'
                : ds.some(function(x) { return (x.validations || []).length === 1; }) ? 'niveau2' : 'niveau1';
            var a = ((ds[0] || {}).trajets || {}).aller || {}, r = ((ds[0] || {}).trajets || {}).retour || {};
            var jour = function(v) { try { return v ? new Date(v).toLocaleDateString('fr-FR') : ''; } catch (e) { return ''; } };
            return { nature: nature, n: ds.length, ids: ds.map(function(x) { return x.id; }),
                noms: [p0.grade, p0.nom, p0.prenom].filter(Boolean).join(' ') + (ds.length > 1 ? ' (+ ' + (ds.length - 1) + ')' : ((ds[0] || {}).personnes || []).length > 1 ? ' et ' + ((ds[0].personnes.length) - 1) + ' autre(s)' : ''),
                objet: (ds[0] || {}).objet || '', dates: [jour(a.dateDep), jour(r.dateArr)].filter(Boolean).join(' → '),
                lieu: a.paysArr || a.lieuArr || '' };
        } catch (e) { return { nature: 'inconnu', n: 0, ids: [] }; }
    }
    window.JUMELAGE_BOITE_LISTE = function() { return boiteLire(); };
    // filtre : 'chorus' (envois pour l'assistant Chorus DT), 'autres' (tout le reste), sinon tout.
    window.JUMELAGE_BOITE_NB = function(filtre) {
        return boiteLire().filter(function(x) { var c = x.nature === 'chorus' || x.nature === 'cr'; return x.statut !== 'traite' && (filtre === 'chorus' ? c : filtre === 'autres' ? !c : true); }).length;
    };
    window.JUMELAGE_BOITE_FICHIER = function(id) {
        var x = boiteLire().filter(function(e) { return e.id === id; })[0];
        return caches.open(CACHE_BOITE).then(function(c) { return c.match('__boite__/' + id); }).then(function(r) {
            if (!r) throw new Error('Fichier introuvable sur cet appareil.');
            return r.blob();
        }).then(function(b) { return new File([b], (x && x.nom) || 'demande.json', { type: 'application/json' }); });
    };
    window.JUMELAGE_BOITE_MARQUER = function(id, statut) {
        var l = boiteLire(); l.forEach(function(x) { if (x.id === id && x.statut !== 'traite') x.statut = statut; }); boiteEcrire(l);
    };
    // Demandes traitées (validées / refusées puis transmises, PDF Chorus produit) : les envois qui les contiennent passent en « traité ».
    window.JUMELAGE_BOITE_TRAITER_DEMANDES = function(ids) {
        if (!ids || !ids.length) return;
        var l = boiteLire(), change = false;
        l.forEach(function(x) {
            if (x.statut !== 'traite' && (x.ids || []).length && x.ids.every(function(i) { return ids.indexOf(i) >= 0; })) { x.statut = 'traite'; x.traiteLe = Date.now(); change = true; }
        });
        if (change) boiteEcrire(l);
    };
    window.JUMELAGE_BOITE_SUPPRIMER = function(id) {
        boiteEcrire(boiteLire().filter(function(x) { return x.id !== id; }));
        return caches.open(CACHE_BOITE).then(function(c) { return c.delete('__boite__/' + id); }).catch(function() {});
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
        var med = ecran.querySelector('.JUM-CHORUS'); if (!med) return;
        var nc = window.JUMELAGE_BOITE_NB('chorus'), pc = ecran.querySelector('.JUM-CHORUS-NB');
        if (!nc) { if (pc) pc.remove(); return; }
        if (!pc) { pc = document.createElement('span'); pc.className = 'JUM-CHORUS-NB'; med.parentNode.appendChild(pc); }
        pc.textContent = nc;
    }

    // Relève : nouveaux envois du serveur → boîte de réception de l'appareil.
    var releveEnCours = false;
    window.JUMELAGE_RELEVER = function() {
        if (releveEnCours || !monCompte() || !navigator.onLine || !SUBTLE || !window.caches) return Promise.resolve(0);
        releveEnCours = true;
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
                            var attendu = { DEMANDE: 'niveau1', VALIDATION_1: 'niveau2', CHORUS: 'chorus', REFUS: 'refus', CR: 'cr' }[x.type];
                            if (attendu && info.nature !== attendu) { ecartes++; return appelApi('boite/' + e.id, { methode: 'DELETE' }); }
                            return caches.open(CACHE_BOITE).then(function(c) {
                                return c.put('__boite__/' + e.id, new Response(o.contenu, { headers: { 'Content-Type': 'application/json' } }));
                            }).then(function() {
                                var el = Object.assign({ id: e.id, nom: o.nom || 'demande.json', de: x.de, le: x.le, type: x.type, statut: 'nouveau' }, info);
                                var l = boiteLire(); l.unshift(el); boiteEcrire(l); nouveaux.push(el);
                                return appelApi('boite/' + e.id, { methode: 'DELETE' });
                            });
                        });
                    }).catch(function() {});
                });
            }, Promise.resolve());
        }).catch(function(e) {
            if (e.statut === 401) { try { localStorage.removeItem(CLE_COMPTE); } catch (x) {} }
        }).then(function() {
            releveEnCours = false;
            if (ecartes) bandeau(ecartes + ' envoi(s) non conforme(s) écarté(s) de votre boîte de réception.');
            if (nouveaux.length) {
                if (typeof window.JUMELAGE_APRES_RELEVE === 'function') { try { window.JUMELAGE_APRES_RELEVE(nouveaux); } catch (e) {} }
                else if (roleChorus() && nouveaux.every(function(x) { return x.nature === 'chorus' || x.nature === 'cr'; })) bandeau((nouveaux.length > 1 ? nouveaux.length + ' envois reçus' : 'Envoi reçu') + ' : ouvrez l\'espace Assistant Chorus DT (écran de choix).');
                else bandeau(nouveaux.length > 1 ? nouveaux.length + ' demandes reçues : ouvrez Mise en route › Boîte de réception.' : 'Demande reçue : ouvrez Mise en route › Boîte de réception.');
            }
            return nouveaux.length;
        });
    };
    // Relève automatique : à l'ouverture, au retour dans l'appli, puis toutes les 45 secondes tant qu'elle est affichée.
    function releveAuto() { if (document.visibilityState === 'visible' && !document.body.classList.contains('demo-active')) window.JUMELAGE_RELEVER(); }
    if (monCompte()) {
        var lancerReleve = function() { setTimeout(releveAuto, 1500); majPastilleHub(); setTimeout(declarerRoles, 2500); };
        if (document.body) lancerReleve(); else document.addEventListener('DOMContentLoaded', lancerReleve);
    }
    document.addEventListener('visibilitychange', function() { if (monCompte()) releveAuto(); });
    setInterval(function() { if (monCompte()) releveAuto(); }, 45000);

    // Fenêtre « Compte TRIGONE » : activer (mail pro → code reçu), état, déconnexion de l'appareil.
    var fenCompte = null;
    window.JUMELAGE_FERMER_COMPTE = function() { if (fenCompte) { fenCompte.remove(); fenCompte = null; } };
    window.JUMELAGE_COMPTE = function() {
        if (fenCompte || !document.body) return;
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
                '<button type="button" class="JUM-R-LIEN" id="JUM-C-DECO">Déconnecter cet appareil</button><p class="JUM-R-ERREUR" id="JUM-C-ERR"></p></div>' +
                '<div class="JUM-R-PIED"><button type="button" class="JUM-R-PRINCIPAL" onclick="JUMELAGE_FERMER_COMPTE()">Fermer</button></div></div>';
            document.body.appendChild(fenCompte);
            fenCompte.querySelector('#JUM-C-DECO').addEventListener('click', function() {
                if (!window.confirm('Déconnecter cet appareil ? Il ne pourra plus envoyer ni recevoir d\'envois TRIGONE.')) return;
                appelApi('appareil', { methode: 'DELETE' }).catch(function() {}).then(function() {
                    try { localStorage.removeItem(CLE_COMPTE); } catch (e) {}
                    cleIdb('effacer').catch(function() {});
                    window.JUMELAGE_FERMER_COMPTE(); bandeau('Appareil déconnecté du compte TRIGONE.');
                });
            });
            return;
        }
        fenCompte.innerHTML = '<div class="JUM-R-CARTE">' + tete + '<div class="JUM-R-CORPS">' +
            '<div class="JUM-R-TITRE">1. Votre adresse mail</div>' +
            '<div class="JUM-R-CHAMP"><label for="JUM-C-MAIL">Adresse mail</label><input id="JUM-C-MAIL" type="email" autocomplete="email" value="' + esc(r.monMail || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr"></div>' +
            '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-C-ENVOI" style="margin:12px 0 0;">Recevoir le code par mail</button>' +
            '<div id="JUM-C-ETAPE2" style="display:none;"><div class="JUM-R-TITRE">2. Code reçu par mail</div>' +
                '<div class="JUM-R-CHAMP"><label for="JUM-C-CODE">Code à 6 chiffres</label><input id="JUM-C-CODE" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••"></div>' +
                '<p class="JUM-R-AIDE" style="margin-top:8px;">Pas reçu ? Regardez dans les courriers indésirables, ou redemandez un code.</p></div>' +
            '<p class="JUM-R-ERREUR" id="JUM-C-ERR"></p></div>' +
            '<div class="JUM-R-PIED"><button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_COMPTE()">Annuler</button>' +
            '<button type="button" class="JUM-R-PRINCIPAL" id="JUM-C-VALIDER" disabled>Activer</button></div></div>';
        document.body.appendChild(fenCompte);
        var err = fenCompte.querySelector('#JUM-C-ERR'), champMail = fenCompte.querySelector('#JUM-C-MAIL'), mailDemande = '';
        var btnEnvoi = fenCompte.querySelector('#JUM-C-ENVOI'), btnValider = fenCompte.querySelector('#JUM-C-VALIDER');
        serviceDisponible().then(function(ok) {
            if (!ok && fenCompte) { err.textContent = navigator.onLine ? 'Le service de boîte aux lettres TRIGONE n\'est pas encore en service.' : 'Pas de connexion : réessayez une fois connecté.'; btnEnvoi.disabled = true; }
        });
        btnEnvoi.addEventListener('click', function() {
            var mail = champMail.value.trim().toLowerCase();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { err.textContent = '⛔ Adresse mail invalide.'; return; }
            err.textContent = ''; btnEnvoi.disabled = true; btnEnvoi.textContent = 'Envoi du code…';
            appelApi('inscription/code', { methode: 'POST', corps: { mail: mail } }).then(function(rep) {
                mailDemande = mail;
                fenCompte.querySelector('#JUM-C-ETAPE2').style.display = '';
                btnEnvoi.textContent = 'Renvoyer un code'; btnEnvoi.disabled = false; btnValider.disabled = false;
                var champCode = fenCompte.querySelector('#JUM-C-CODE');
                if (rep.codeTest) champCode.value = rep.codeTest;   // tests locaux uniquement
                champCode.focus();
                err.style.color = '#15803d'; err.textContent = 'Code envoyé à ' + mail + '.';
            }, function(e) { err.style.color = ''; err.textContent = '⛔ ' + e.message; btnEnvoi.disabled = false; btnEnvoi.textContent = 'Recevoir le code par mail'; });
        });
        btnValider.addEventListener('click', function() {
            var code = fenCompte.querySelector('#JUM-C-CODE').value.trim();
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
                    try { localStorage.removeItem(CLE_ROLES_DECLARES); } catch (e) {}
                    declarerRoles();
                    window.JUMELAGE_RELEVER();
                });
            }).catch(function(e) { err.textContent = '⛔ ' + e.message; btnValider.disabled = false; });
        });
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
            '<button type="button" data-action="compte">' + window.JUMELAGE_ICONE('mail') + '<span><b>Compte TRIGONE</b><small>' + (monCompte() ? 'Actif : ' + esc(monCompte().mail) : 'Envois directs et chiffrés') + '</small></span></button>' +
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
        if (cle === 'chorus') {
            ecran.classList.add('choisi', 'choix-chorus');
            var surPlace = !DANS_CR && typeof window.MER_OUVRIR_CHORUS === 'function';
            setTimeout(function() {
                if (window.JUMELAGE_OUVRIR_CHORUS() || surPlace) { ecran.classList.add('sortie'); setTimeout(function() { if (ecran) { ecran.remove(); ecran = null; } document.documentElement.classList.remove('jum-choix'); }, 380); }
            }, 380);
            return;
        }
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
            // Assistant Chorus DT : son logo au centre, sur la diagonale, entre Mise en route et Compte-rendu.
            (roleChorus() ? '<button type="button" class="JUM-CHORUS" aria-label="Ouvrir l\'espace Assistant Chorus DT" title="Assistant Chorus DT"><img src="' + LOGO_CHORUS + '" alt="TRIGONE Assist Chorus-DT"></button>' : '') +
            '<button type="button" class="JUM-ROUE" aria-label="Réglages et présentation de TRIGONE" title="Réglages TRIGONE · Découvrir TRIGONE">' + ROUE_SVG + '</button>' +
            // Numéro de version, en haut à droite (le même dans les deux applis).
            (window.APP_VERSION_AFFICHEE ? '<div class="JUM-VERSION" title="Version de TRIGONE">V' + window.APP_VERSION_AFFICHEE + '</div>' : '') +
            // Mise à jour, en bas à gauche (pendant de la roue crantée).
            '<button type="button" class="JUM-ROUE JUM-MAJ-BTN" aria-label="Mise à jour de TRIGONE" title="Mise à jour">' + (window.JUMELAGE_ICONE ? window.JUMELAGE_ICONE('maj') : '') + '</button>';
        majPastilleHub();
        var btnChorus = ecran.querySelector('.JUM-CHORUS');
        if (btnChorus) {
            ['pointerdown', 'pointerup'].forEach(function(t) { btnChorus.addEventListener(t, function(e) { e.stopPropagation(); }); });
            btnChorus.addEventListener('click', function(e) { e.stopPropagation(); choisir('chorus'); });
        }
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
