// Affichage PC sur grand écran tactile (tablette, pliable ouvert) : bouton « écran », mise en page PC, retour
// automatique quand l'écran devient petit (pliable refermé), bouton absent sur un téléphone.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur();
    const tactile = (l, h) => b.newContext({ viewport: { width: l, height: h }, screen: { width: l, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const ctx = await tactile(700, 840), p = await ctx.newPage();
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE); await p.reload(); await attendre(2500);
    const largeur = () => p.evaluate(() => document.documentElement.clientWidth);
    verifier(await p.evaluate(() => { const b = document.querySelector('.JUM-CHOIX .JUM-MODE'); return !!b && getComputedStyle(b).display !== 'none'; }) && await largeur() === 700,
        'pliable ouvert : bouton « affichage PC » sur l\'écran de choix, affichage téléphone par défaut');
    await p.tap('.JUM-CHOIX .JUM-MODE'); await attendre(1200);
    verifier(await largeur() === 1280 && await p.evaluate(() => EST_PC()), 'affichage PC : mise en page PC de Mise en route (1 280 px)');
    await p.goto(srv.url + 'cr/'); await attendre(2500);
    verifier(await largeur() === 1280 && await p.evaluate(() => !!(CR_PC_MQ && CR_PC_MQ.matches)), 'affichage PC : gardé en passant à Compte-rendu');
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); SHOW_PAGE('P0'); }); await attendre(500);
    await p.evaluate(() => document.querySelector('.JUM-CPT-ZONE .JUM-MODE').click()); await attendre(1200);
    verifier(await largeur() === 700 && !(await p.evaluate(() => localStorage.getItem('trigone_affichage_pc'))), 'le même bouton ramène l\'affichage téléphone');
    await p.evaluate(() => JUMELAGE_MODE_PC(true)); await attendre(800);
    // Pliable refermé : petit écran → affichage téléphone automatiquement, le choix reste mémorisé.
    const ctx2 = await tactile(360, 780), q = await ctx2.newPage();
    await q.goto(srv.url); await q.evaluate(preparer, APP_CODE); await q.evaluate(() => localStorage.setItem('trigone_affichage_pc', '1')); await q.reload(); await attendre(2500);
    verifier(await q.evaluate(() => document.documentElement.clientWidth) === 360 && await q.evaluate(() => { const b = document.querySelector('.JUM-MODE'); return !b || getComputedStyle(b).display === 'none'; }),
        'petit écran (téléphone, pliable refermé) : affichage téléphone, pas de bouton');
    await ctx.close(); await ctx2.close(); await b.close();
};
