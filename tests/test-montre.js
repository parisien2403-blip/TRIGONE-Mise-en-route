// Horodatage depuis la montre : pendant une mission, notification « Mission en cours » avec le bouton de l'étape
// suivante ; les appuis (enregistrés par cr/sw.js dans le cache « trigone-montre ») sont appliqués à la mission
// avec leur heure exacte.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ viewport: { width: 480, height: 1000 } });
    await ctx.grantPermissions(['notifications'], { origin: srv.url.replace(/\/$/, '') });
    const p = await ctx.newPage(), erreurs = [];
    p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.goto(srv.url + 'cr/'); await attendre(3000);
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
    const notif = () => p.evaluate(() => navigator.serviceWorker.ready.then(r => r.getNotifications({ tag: 'trigone-montre' }))
        .then(l => l.map(n => ({ titre: n.title, corps: n.body, actions: (n.actions || []).map(a => a.action + ':' + a.title), mission: (n.data || {}).mission }))));
    // Départ en mission (téléphone) : la notification propose « Arrivée sur site ».
    await p.evaluate(() => { M.USER = 'MICHEL Julien'; M.DEBUT = '05/10/2026 06:30:00'; M.PAGE = 'P2'; SAVE_STATE(); });
    await attendre(1500);
    let n = await notif();
    verifier(n.length === 1 && n[0].titre === 'Mission en cours' && n[0].actions[0] === 'arrivee:Arrivée sur site' && /Départ 06:30/.test(n[0].corps),
        'départ : notification « Mission en cours » avec le bouton « Arrivée sur site » ' + JSON.stringify(n[0] || {}));
    // Appuis sur la montre (tels que cr/sw.js les enregistre) : arrivée 09:42, départ du site 17:05.
    const t1 = new Date(2026, 9, 5, 9, 42).getTime(), t2 = new Date(2026, 9, 7, 17, 5).getTime();
    await p.evaluate(([t1, t2]) => caches.open('trigone-montre').then(c => Promise.all([
        c.put('./__montre__/' + t1 + '-arrivee', new Response(JSON.stringify({ etape: 'arrivee', t: t1, mission: M.DEBUT }))),
        c.put('./__montre__/' + t2 + '-depart_site', new Response(JSON.stringify({ etape: 'depart_site', t: t2, mission: M.DEBUT }))),
        c.put('./__montre__/1-arrivee', new Response(JSON.stringify({ etape: 'arrivee', t: 1, mission: 'autre mission' })))
    ])), [t1, t2]);
    const nb = await p.evaluate(() => APPLIQUER_HORODATAGES_MONTRE());
    verifier(nb === 2 && await p.evaluate(() => M.ARR_SITE === '05/10/2026 09:42:00' && M.DEP_SITE === '07/10/2026 17:05:00'),
        'appuis sur la montre appliqués avec leur heure exacte (arrivée 09:42, départ du site 17:05)');
    verifier(await p.evaluate(() => caches.open('trigone-montre').then(c => c.keys()).then(k => k.length === 0)), 'appuis consommés (et celui d\'une autre mission écarté)');
    // Le téléphone a avancé autrement (bouton de l'appli) : la notification suit.
    await p.evaluate(() => { localStorage.removeItem('trigone_montre_sig'); SAVE_STATE(); }); await attendre(1200);
    n = await notif();
    verifier(n.length === 1 && n[0].actions[0] === 'retour:Arrivée finale' && /Arrivée sur site 09:42/.test(n[0].corps), 'étape suivante : « Arrivée finale »');
    // Arrivée finale depuis la montre, puis fin : la notification disparaît.
    const t3 = new Date(2026, 9, 7, 19, 41).getTime();
    await p.evaluate(t3 => caches.open('trigone-montre').then(c => c.put('./__montre__/' + t3 + '-retour', new Response(JSON.stringify({ etape: 'retour', t: t3, mission: M.DEBUT })))), t3);
    await p.evaluate(() => APPLIQUER_HORODATAGES_MONTRE()); await attendre(800);
    verifier(await p.evaluate(() => M.FIN_RETOUR_HORODATE === '07/10/2026 19:41:00'), 'arrivée finale 19:41 depuis la montre → frais de mission');
    await p.evaluate(() => { localStorage.removeItem('trigone_montre_sig'); SAVE_STATE(); }); await attendre(1200);
    verifier((await notif()).length === 0, 'mission terminée : plus de notification « Mission en cours »');
    // Réglages › Montre connectée : explications, deux cadrans illustrés, essai.
    await p.evaluate(() => OUVRIR_PARAMETRES()); await attendre(400);
    verifier(await p.evaluate(() => { const f = document.getElementById('PARAM-FOLD-MONTRE'); return !!f && f.querySelectorAll('svg.MONTRE-SVG').length === 2 && /Galaxy Wearable/.test(f.textContent); }), 'réglages : rubrique « Montre connectée » (explications, 2 cadrans)');
    await p.evaluate(() => ESSAI_NOTIF_MONTRE()); await attendre(1200);
    verifier(await p.evaluate(() => navigator.serviceWorker.ready.then(r => r.getNotifications({ tag: 'trigone-montre-essai' })).then(l => l.length === 1 && l[0].actions[0].title === 'Arrivée sur site')), 'essai : notification avec bouton envoyée');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
