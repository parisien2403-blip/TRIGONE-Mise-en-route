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
        /* Présentation TRIGONE */
        '.JUM-PRES { position: fixed; inset: 0; z-index: 99992; background: radial-gradient(120% 90% at 50% 0%, #1d1d1d 0%, #0b0b0b 60%); color: #f5f5f5;' +
            ' font-family: Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; opacity: 0; transition: opacity 0.38s ease; }' +
        '.JUM-PRES.visible { opacity: 1; }' +
        '.JUM-PRES-TRAIT { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom right, transparent calc(50% - 1px), rgba(214,167,86,0.28) 50%, transparent calc(50% + 1px)); }' +
        '.JUM-PRES-DEFIL { position: absolute; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }' +
        '.JUM-PRES-CONTENU { position: relative; max-width: 960px; margin: 0 auto; padding: max(34px, env(safe-area-inset-top, 0px)) 20px max(34px, env(safe-area-inset-bottom, 0px)); text-align: center; }' +
        '.JUM-PRES-CONTENU > * { opacity: 0; transform: translateY(12px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.2,0.8,0.2,1); }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > * { opacity: 1; transform: none; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(2) { transition-delay: 0.08s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(3) { transition-delay: 0.14s; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(4) { transition-delay: 0.22s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(5) { transition-delay: 0.3s; }' +
        '.JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(6) { transition-delay: 0.4s; } .JUM-PRES.visible .JUM-PRES-CONTENU > :nth-child(n+7) { transition-delay: 0.5s; }' +
        '.JUM-PRES-LOGO { width: 92px; height: auto; filter: brightness(0) invert(1); }' +
        '.JUM-PRES-MARQUE { font-size: 2rem; font-weight: 800; letter-spacing: 0.34em; margin: 10px 0 4px; padding-left: 0.34em; }' +
        '.JUM-PRES-LIGNE { font-size: 0.66rem; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: #d6a756; }' +
        '.JUM-PRES-LIGNE span { margin: 0 6px; }' +
        '@media (max-width: 440px) { .JUM-PRES-LIGNE { font-size: 0.58rem; letter-spacing: 0.1em; } .JUM-PRES-MARQUE { font-size: 1.7rem; } }' +
        '.JUM-PRES h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: clamp(1.5rem, 4.2vw, 2.3rem); line-height: 1.25; margin: 26px 0 10px; }' +
        '.JUM-PRES h1 em { font-style: normal; color: #d6a756; }' +
        '.JUM-PRES-CHAPO { max-width: 620px; margin: 0 auto 26px; font-size: 0.9rem; line-height: 1.6; color: #a3a3a3; }' +
        '.JUM-PRES-DUO { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; text-align: left; }' +
        '@media (max-width: 640px) { .JUM-PRES-DUO { grid-template-columns: 1fr; } }' +
        '.JUM-PRES-VOLET { border-radius: 18px; padding: 20px 20px 16px; }' +
        '.JUM-PRES-CLAIR { background: linear-gradient(150deg, #ffffff 0%, #e6edf3 100%); color: #1a1a1a; }' +
        '.JUM-PRES-SOMBRE { background: #161616; border: 1px solid rgba(214,167,86,0.45); color: #f5f5f5; }' +
        '.JUM-PRES-NUM { font-size: 0.64rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #5a7a94; }' +
        '.JUM-PRES-SOMBRE .JUM-PRES-NUM { color: #d6a756; }' +
        '.JUM-PRES-TITRE { font-size: 1.1rem; font-weight: 800; margin: 6px 0 10px; }' +
        '.JUM-PRES-VOLET ul { margin: 0; padding: 0; list-style: none; }' +
        '.JUM-PRES-VOLET li { position: relative; padding: 7px 0 7px 22px; font-size: 0.82rem; line-height: 1.45; border-top: 1px solid rgba(90,122,148,0.18); }' +
        '.JUM-PRES-SOMBRE li { border-top-color: rgba(255,255,255,0.08); }' +
        '.JUM-PRES-VOLET li:first-child { border-top: 0; }' +
        '.JUM-PRES-VOLET li::before { content: ""; position: absolute; left: 2px; top: 13px; width: 8px; height: 8px; border-radius: 2px; transform: rotate(45deg); background: #5a7a94; }' +
        '.JUM-PRES-SOMBRE li::before { background: #d6a756; }' +
        '.JUM-PRES-GARANTIES { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0 26px; }' +
        '@media (max-width: 640px) { .JUM-PRES-GARANTIES { grid-template-columns: 1fr; } }' +
        '.JUM-PRES-GARANTIES div { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); font-size: 0.78rem; color: #d4d4d4; }' +
        '.JUM-PRES-GARANTIES svg { width: 20px; height: 20px; flex-shrink: 0; fill: none; stroke: #d6a756; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }' +
        '.JUM-PRES-BTN { border: 0; border-radius: 14px; padding: 15px 44px; background: #d6a756; color: #141414; font: 800 0.84rem Montserrat, system-ui, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-PRES-BTN:hover { background: #e2b86c; }' +
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
    var BUILD = 14, MAJ_DISPO = false, CLE_RECHARGE = 'trigone_recharge_build';
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
        if (!ecran) { try { sessionStorage.setItem(CLE_CHOIX_FAIT, '1'); } catch (e) {} }
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
                (premiere ? '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_PASSER_REGLAGES()">Je suis valideur ou assistant Chorus DT : passer</button>'
                          : '<button type="button" class="JUM-R-SECOND" onclick="JUMELAGE_FERMER_REGLAGES()">Annuler</button>') +
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
        try { localStorage.removeItem(CLE_CODE); } catch (e) {}
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
            else window.JUMELAGE_PRESENTATION();
        });
        ecran.appendChild(m);
    };

    // ---------- Code d'accès commun : demandé une fois à l'ouverture de TRIGONE ----------
    var pave = null, saisie = '';
    function dessinerPoints() {
        if (!pave) return;
        Array.prototype.forEach.call(pave.querySelectorAll('.JUM-PIN-POINT'), function(p, i) { p.classList.toggle('plein', i < saisie.length); });
    }
    window.JUMELAGE_PIN_TOUCHE = function(ch) {
        if (!pave) return;
        if (ch === 'x') saisie = saisie.slice(0, -1); else if (saisie.length < 4) saisie += ch;
        dessinerPoints();
        if (saisie.length === 4) empreinte(saisie).then(function(h) {
            if (h === lireTxt(CLE_CODE)) {
                if (window.JUMELAGE_MARQUER_DEVERROUILLE) window.JUMELAGE_MARQUER_DEVERROUILLE();
                pave.remove(); pave = null;
            } else {
                saisie = ''; dessinerPoints();
                var e = pave.querySelector('.JUM-PIN-ERREUR'); e.textContent = 'Code incorrect.';
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
        pave.innerHTML = '<div class="JUM-PIN-CARTE"><div class="JUM-PIN-TITRE">Code d\'accès</div><p>Entrez votre code à 4 chiffres pour ouvrir TRIGONE.</p>' +
            '<div class="JUM-PIN-POINTS"><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span><span class="JUM-PIN-POINT"></span></div>' +
            '<div class="JUM-PIN-ERREUR"></div><div class="JUM-PIN-PAVE">' + touches + '</div>' +
            '<button type="button" class="JUM-R-LIEN" onclick="JUMELAGE_CODE_OUBLIE()">Code oublié ?</button></div>';
        document.body.appendChild(pave);
        document.addEventListener('keydown', function clavier(e) {
            if (!pave) { document.removeEventListener('keydown', clavier); return; }
            if (/^\d$/.test(e.key)) window.JUMELAGE_PIN_TOUCHE(e.key); else if (e.key === 'Backspace') window.JUMELAGE_PIN_TOUCHE('x');
        });
    }
    window.JUMELAGE_CODE_ACTIF = codeDefini;
    if (codeDefini() && !(window.JUMELAGE_DEVERROUILLE && window.JUMELAGE_DEVERROUILLE())) {
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
            '<button type="button" class="JUM-ROUE" aria-label="Réglages et présentation de TRIGONE" title="Réglages TRIGONE · Découvrir TRIGONE">' + ROUE_SVG + '</button>';
        var roue = ecran.querySelector('.JUM-ROUE');
        ['pointerdown', 'pointerup'].forEach(function(t) { roue.addEventListener(t, function(e) { e.stopPropagation(); }); });
        roue.addEventListener('click', window.JUMELAGE_MENU_ROUE);
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
