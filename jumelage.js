// ===================== JUMELAGE TRIGONE : Mise en route ⇄ Compte-rendu de mission =====================
// Chargé par les deux applis (index.html à la racine, cr/index.html). Sur l'accueil, le logo de l'autre appli
// est affiché en petit, en retrait, « au loin » : le toucher, ou glisser le doigt sur l'accueil, fait passer
// d'une appli à l'autre avec une animation de profondeur. Au changement d'appli : pas de nouvel écran
// d'ouverture, et le code à 4 chiffres n'est pas redemandé (même onglet, même session).
(function() {
    var CLE_BASCULE = 'trigone_bascule', CLE_DEVERROUILLE = 'trigone_deverrouille', CLE_THEME = 'trigone_theme';
    var arrivee = false;
    try { arrivee = sessionStorage.getItem(CLE_BASCULE) === '1'; sessionStorage.removeItem(CLE_BASCULE); } catch (e) {}

    window.JUMELAGE_ARRIVEE = function() { return arrivee; };
    window.JUMELAGE_DEVERROUILLE = function() { try { return sessionStorage.getItem(CLE_DEVERROUILLE) === '1'; } catch (e) { return false; } };
    window.JUMELAGE_MARQUER_DEVERROUILLE = function() { try { sessionStorage.setItem(CLE_DEVERROUILLE, '1'); } catch (e) {} };
    // Thème clair / sombre commun aux deux applis : null tant qu'aucun choix n'a été fait.
    window.JUMELAGE_THEME = function(sombre) {
        if (sombre === undefined) {
            try { var t = localStorage.getItem(CLE_THEME); return t === null ? null : t === '1'; } catch (e) { return null; }
        }
        try { localStorage.setItem(CLE_THEME, sombre ? '1' : '0'); } catch (e) {}
    };

    var css = '' +
        '.JUM-SCENE { position: relative; }' +
        '.JUM-PRINCIPAL { position: relative; z-index: 1; pointer-events: none; }' +
        '.JUM-LOIN { position: absolute; z-index: 0; right: 4%; top: 4%; width: 30%; max-width: 132px; height: auto; opacity: 0.34;' +
            ' filter: grayscale(1) blur(0.6px); cursor: pointer; transition: opacity 0.2s ease; -webkit-tap-highlight-color: transparent; }' +
        '.JUM-LOIN:active { opacity: 0.5; }' +
        'body.dark-mode .JUM-LOIN { filter: grayscale(1) invert(1) blur(0.6px); opacity: 0.32; }' +
        '.JUM-INDIC { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 6px auto 2px; flex-shrink: 0; }' +
        '.JUM-INDIC button { border: 1.5px solid rgba(90,122,148,0.35); background: transparent; color: #64748b; border-radius: 999px;' +
            ' padding: 4px 10px; font-family: inherit; font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }' +
        '.JUM-INDIC button.actif { background: #1a1a1a; border-color: #1a1a1a; color: #fff; cursor: default; }' +
        'body.dark-mode .JUM-INDIC button { color: #a3a3a3; border-color: #404040; }' +
        'body.dark-mode .JUM-INDIC button.actif { background: #f5f5f5; border-color: #f5f5f5; color: #141414; }' +
        '.JUM-FLECHE { color: #94a3b8; font-size: 0.75rem; font-weight: 800; }' +
        '.JUM-ANIM { transition: transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease, filter 0.5s ease !important; }' +
        '.JUM-VOILE { position: fixed; inset: 0; z-index: 100000; background: var(--sm2-surface, #fff); opacity: 0; pointer-events: none; transition: opacity 0.22s ease 0.3s; }' +
        'body.dark-mode .JUM-VOILE { background: #141414; }' +
        '@media (prefers-reduced-motion: reduce) { .JUM-ANIM { transition-duration: 0.01s !important; } }';
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    function visible(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    // Le petit logo se cale sur le logo principal (qui rétrécit sur les petits écrans) : environ un tiers de sa
    // taille, en retrait en haut à droite. data-contenu : part utile de l'image principale si elle a des marges.
    function placer() {
        Array.prototype.forEach.call(document.querySelectorAll('.JUM-SCENE'), function(scene) {
            var main = scene.querySelector('.JUM-PRINCIPAL'), loin = scene.querySelector('.JUM-LOIN');
            if (!main || !loin || !visible(main) || loin.classList.contains('JUM-ANIM')) return;
            var boite = main.getBoundingClientRect(), sc = scene.getBoundingClientRect();
            // Taille réellement dessinée (l'image est réduite « dans » sa boîte, object-fit: contain).
            var ratio = (main.naturalWidth && main.naturalHeight) ? main.naturalWidth / main.naturalHeight : boite.width / boite.height;
            var dw = Math.min(boite.width, boite.height * ratio), dh = dw / ratio;
            var m = { left: boite.left + (boite.width - dw) / 2, top: boite.top + (boite.height - dh) / 2, width: dw, height: dh };
            var part = parseFloat(main.getAttribute('data-contenu') || '1');
            var utile = m.width * part, w = Math.max(26, Math.min(120, utile * 0.38));
            var aGauche = loin.getAttribute('data-cote') === 'gauche';
            var x = aGauche ? (m.left - sc.left) + m.width * (0.5 - part / 2) - w * 0.68
                            : (m.left - sc.left) + m.width * (0.5 + part / 2) - w * 0.32;
            loin.style.width = w + 'px'; loin.style.maxWidth = 'none'; loin.style.right = 'auto';
            loin.style.left = Math.max(2, Math.min(sc.width - w - 2, x)) + 'px';
            loin.style.top = Math.max(2, (m.top - sc.top) + m.height * (0.5 - 0.5 * part) * 0.9) + 'px';
        });
    }
    window.JUMELAGE_PLACER = placer;
    var prevu = false;
    function placerBientot() { if (prevu) return; prevu = true; requestAnimationFrame(function() { prevu = false; placer(); }); }
    window.addEventListener('resize', placerBientot);
    window.addEventListener('load', placerBientot);
    document.addEventListener('load', function(e) { if (e.target && e.target.classList && e.target.classList.contains('JUM-PRINCIPAL')) placerBientot(); }, true);
    document.addEventListener('DOMContentLoaded', function() {
        placerBientot();
        new MutationObserver(placerBientot).observe(document.body, { childList: true, subtree: true });
    });
    function paire() {
        placer();
        var loin = Array.prototype.filter.call(document.querySelectorAll('.JUM-LOIN'), visible)[0];
        var principal = Array.prototype.filter.call(document.querySelectorAll('.JUM-PRINCIPAL'), visible)[0];
        return loin && principal ? { loin: loin, principal: principal } : null;
    }
    // Transformation qui amène l'élément « de » sur la place et la taille de l'élément « vers ».
    function versPlace(de, vers) {
        var a = de.getBoundingClientRect(), b = vers.getBoundingClientRect();
        var dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        return 'translate(' + dx + 'px,' + dy + 'px) scale(' + (b.width / a.width) + ')';
    }

    var enCours = false;
    window.JUMELAGE_BASCULER = function() {
        var p = paire();
        if (enCours || !p) return;
        if (document.body.classList.contains('demo-active')) return;
        enCours = true;
        var destination = p.loin.getAttribute('data-vers');
        var tLoin = versPlace(p.loin, p.principal), tPrincipal = versPlace(p.principal, p.loin);
        [p.loin, p.principal].forEach(function(el) { el.classList.add('JUM-ANIM'); });
        var voile = document.createElement('div');
        voile.className = 'JUM-VOILE';
        document.body.appendChild(voile);
        void p.loin.offsetWidth;
        p.loin.style.transform = tLoin; p.loin.style.opacity = '1'; p.loin.style.filter = 'none'; p.loin.style.zIndex = '2';
        p.principal.style.transform = tPrincipal; p.principal.style.opacity = '0.2'; p.principal.style.filter = 'blur(1px)';
        voile.style.opacity = '1';
        try { sessionStorage.setItem(CLE_BASCULE, '1'); } catch (e) {}
        setTimeout(function() { location.href = destination; }, 560);
        setTimeout(function() { enCours = false; }, 3000);
    };

    // À l'arrivée : le logo principal part de la place du petit logo de l'autre côté et vient au premier plan.
    window.JUMELAGE_ANIMER_ARRIVEE = function() {
        if (!arrivee) return;
        arrivee = false;
        var p = paire();
        if (!p) return;
        var tPrincipal = versPlace(p.principal, p.loin), tLoin = versPlace(p.loin, p.principal);
        p.principal.style.transform = tPrincipal; p.principal.style.opacity = '0.3';
        p.loin.style.transform = tLoin; p.loin.style.opacity = '0';
        void p.principal.offsetWidth;
        [p.loin, p.principal].forEach(function(el) { el.classList.add('JUM-ANIM'); });
        requestAnimationFrame(function() {
            p.principal.style.transform = ''; p.principal.style.opacity = '';
            p.loin.style.transform = ''; p.loin.style.opacity = '';
            setTimeout(function() { [p.loin, p.principal].forEach(function(el) { el.classList.remove('JUM-ANIM'); }); }, 600);
        });
    };

    // Glissement horizontal sur l'accueil (zone .JUM-ZONE), en évitant le bord gauche réservé au geste
    // « retour » d'iOS. Souris : cliquer-glisser, pour l'ordinateur.
    var depart = null;
    function debut(x, y, cible) {
        depart = (cible && cible.closest && cible.closest('.JUM-ZONE') && x > 24) ? { x: x, y: y } : null;
    }
    function fin(x, y) {
        if (!depart) return;
        var dx = x - depart.x, dy = y - depart.y;
        depart = null;
        if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) window.JUMELAGE_BASCULER();
    }
    document.addEventListener('touchstart', function(e) { var t = e.touches[0]; debut(t.clientX, t.clientY, e.target); }, { passive: true });
    document.addEventListener('touchend', function(e) { var t = e.changedTouches[0]; fin(t.clientX, t.clientY); }, { passive: true });
    document.addEventListener('mousedown', function(e) { debut(e.clientX, e.clientY, e.target); });
    document.addEventListener('mouseup', function(e) { fin(e.clientX, e.clientY); });

    // Revenir sur une page restée en mémoire (bouton retour) : on retire les traces de l'animation.
    window.addEventListener('pageshow', function(e) {
        if (!e.persisted) return;
        enCours = false;
        document.querySelectorAll('.JUM-VOILE').forEach(function(v) { v.remove(); });
        document.querySelectorAll('.JUM-LOIN, .JUM-PRINCIPAL').forEach(function(el) {
            el.classList.remove('JUM-ANIM'); el.style.transform = ''; el.style.opacity = ''; el.style.filter = ''; el.style.zIndex = '';
        });
    });
})();
