// Affichage PC sur grand écran tactile (tablette, pliable ouvert) : bouton « écran », mise en page PC, retour
// automatique quand l'écran devient petit (pliable refermé), bouton absent sur un téléphone.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur();
    const tactile = (l, h) => b.newContext({ viewport: { width: l, height: h }, screen: { width: l, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const ctx = await tactile(700, 840), p = await ctx.newPage();
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE); await p.reload(); await attendre(2500);
    const largeur = () => p.evaluate(() => document.documentElement.clientWidth);
    verifier(await p.evaluate(() => { const b = document.querySelector('.JUM-CHOIX .JUM-DOCK-PC'); return !!b && getComputedStyle(b).display !== 'none'; }) && await largeur() === 700,
        'pliable ouvert : bouton « affichage PC » sur l\'écran de choix, affichage téléphone par défaut');
    await p.tap('.JUM-CHOIX .JUM-DOCK-PC'); await attendre(1200);
    verifier(await largeur() === 1280 && await p.evaluate(() => EST_PC()), 'affichage PC : mise en page PC de Mise en route (1 280 px)');
    await p.goto(srv.url + 'cr/'); await attendre(2500);
    verifier(await largeur() === 1280 && await p.evaluate(() => !!(CR_PC_MQ && CR_PC_MQ.matches)), 'affichage PC : gardé en passant à Compte-rendu');
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); SHOW_PAGE('P0'); }); await attendre(500);
    await p.evaluate(() => document.querySelector('.JUM-CPT-ZONE .JUM-MODE').click()); await attendre(1200);
    verifier(await largeur() === 700 && !(await p.evaluate(() => localStorage.getItem('trigone_affichage_pc'))), 'le même bouton ramène l\'affichage téléphone');
    verifier(await p.evaluate(() => { const b = document.querySelector('.JUM-DOCK-APPLI .JUM-ONG-PC'); return !!b && !!b.offsetWidth; }), 'Compte-rendu : onglet « Affichage PC » dans la barre du bas');
    await p.tap('.JUM-DOCK-APPLI .JUM-ONG-PC'); await attendre(1200);
    verifier(await largeur() === 1280, 'l\'onglet de la barre du bas passe en affichage PC');
    await p.evaluate(() => JUMELAGE_MODE_PC(true)); await attendre(800);
    // Pliable refermé : petit écran → affichage téléphone automatiquement, le choix reste mémorisé.
    const ctx2 = await tactile(360, 780), q = await ctx2.newPage();
    await q.goto(srv.url); await q.evaluate(preparer, APP_CODE); await q.evaluate(() => localStorage.setItem('trigone_affichage_pc', '1')); await q.reload(); await attendre(2500);
    verifier(await q.evaluate(() => document.documentElement.clientWidth) === 360 && await q.evaluate(() => { return [...document.querySelectorAll('.JUM-MODE, .JUM-DOCK-PC, .JUM-ONG-PC')].every(b => getComputedStyle(b).display === 'none' || !b.offsetWidth); }),
        'petit écran (téléphone, pliable refermé) : affichage téléphone, pas de bouton');
    // Navigateur qui annonce un petit écran (screen) alors que la fenêtre est grande : la taille de la fenêtre décide ;
    // affichage PC stable (pas d'aller-retour).
    const ctx3 = await b.newContext({ viewport: { width: 700, height: 840 }, screen: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const r = await ctx3.newPage();
    await r.goto(srv.url); await r.evaluate(preparer, APP_CODE); await r.reload(); await attendre(2500);
    verifier(await r.evaluate(() => { const b = document.querySelector('.JUM-CHOIX .JUM-DOCK-PC'); return !!b && getComputedStyle(b).display !== 'none'; }), 'écran annoncé petit mais fenêtre grande : bouton présent');
    await r.tap('.JUM-CHOIX .JUM-DOCK-PC'); await attendre(2000);
    verifier(await r.evaluate(() => document.documentElement.clientWidth) === 1280, 'écran annoncé petit : affichage PC appliqué et stable');
    await r.click('.JUM-VERSION'); await attendre(500);
    verifier((await r.evaluate(() => (document.querySelector('.JUM-NOUV') || {}).textContent || '')).includes('Écran : 360 × 780'), 'numéro de version touché : diagnostic de l\'écran affiché');
    // Écran peu haut (pliable ouvert, 600 × 620) avec Boîte de réception et Espace valideur : le logo garde une vraie
    // taille, la même dans les deux applis, et les onglets du bas restent entiers.
    const ctx4 = await tactile(600, 620), l = await ctx4.newPage(), mesures = [];
    for (const app of ['', 'cr/']) {
        await l.goto(srv.url + app); await l.evaluate(preparer, APP_CODE); await l.reload(); await attendre(2500);
        mesures.push(await l.evaluate(() => { document.querySelectorAll('.JUM-CHOIX').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix');
            if (window.TPL_ACCUEIL) { MER_COMPTE_ACTIF = () => true; MER_EST_VALIDEUR = () => true; SHOW_PAGE('ACCUEIL'); } else SHOW_PAGE('P0');
            return new Promise(ok => setTimeout(() => { const i = document.querySelector('.MER-LOGO-IMG, #P0 .welcome-logo').getBoundingClientRect();
                const d = [...document.querySelectorAll('.P0-TAB')].filter(t => t.offsetParent).pop().getBoundingClientRect();
                ok({ h: i.height, bas: d.bottom <= innerHeight }); }, 600)); }));
    }
    verifier(mesures[0].h >= 150 && mesures[1].h >= 144 && Math.abs(mesures[1].h / mesures[0].h - 0.96) < 0.03 && mesures.every(m => m.bas),
        'écran peu haut : logos grands (' + mesures.map(m => Math.round(m.h)).join(' / ') + ' px), même taille dans les deux applis, onglets entiers');
    await ctx4.close();
    await ctx.close(); await ctx2.close(); await ctx3.close(); await b.close();
};
