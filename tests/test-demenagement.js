// Déménagement vers l'adresse officielle : l'ancienne adresse transfère toutes les données à la nouvelle,
// puis y renvoie. Simulé ici avec deux adresses locales (127.0.0.1 = ancienne, localhost = nouvelle).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const port = new URL(srv.url).port;
    const DEM = { ancienne: 'http://127.0.0.1:' + port, cible: 'http://localhost:' + port + '/' };
    const b = await navigateur();
    const ctx = await b.newContext({ viewport: { width: 420, height: 860 } });
    await ctx.addInitScript(d => { try { sessionStorage.setItem('trigone_test_demenagement', d); } catch (e) {} }, JSON.stringify(DEM));
    const p = await ctx.newPage();
    // Ancienne adresse avec des données (bibliothèque, compte-rendu, pièce jointe, code)
    await p.goto(DEM.ancienne + '/?rester=1'); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => { localStorage.setItem('mer_bibliotheque', JSON.stringify([{ id: 'e1', envoyeLe: '2026-01-01', demandes: [] }])); localStorage.setItem('mission_bibliotheque', '[{"cr":"A"}]'); });
    await attendre(1500);
    await p.evaluate(() => PJ_ECRIRE('pj1', { nom: 'nds.pdf', type: 'application/pdf', b64: 'JVBERi0xLjQ=' }));
    await p.evaluate(() => JUMELAGE_POSER_CODE('4321'));
    await p.goto(DEM.ancienne + '/'); await attendre(2000);
    verifier(await p.evaluate(() => !!document.querySelector('.JUM-DEM') && !document.querySelector('.JUM-PIN')), 'ancienne adresse : écran « TRIGONE change d\'adresse » (sans code ni écran de choix)');
    const [fen] = await Promise.all([ctx.waitForEvent('page'), p.click('.JUM-DEM-GO')]);
    await attendre(5000);
    verifier(p.url().startsWith(DEM.cible), 'ancienne adresse : continue à la nouvelle après le transfert');
    const q = p.url().startsWith(DEM.cible) ? p : fen;
    const r = await q.evaluate(() => ({ bib: JSON.parse(localStorage.getItem('mer_bibliotheque') || '[]').length, cr: localStorage.getItem('mission_bibliotheque'), code: !!localStorage.getItem('trigone_code_commun') }));
    verifier(r.bib === 1 && r.cr === '[{"cr":"A"}]' && r.code, 'nouvelle adresse : données des deux applis et code reçus');
    verifier((await q.evaluate(() => PJ_LIRE('pj1').then(x => x && x.nom))) === 'nds.pdf', 'nouvelle adresse : pièce jointe reçue');
    // Retour sur l'ancienne adresse : renvoi direct
    const p3 = await ctx.newPage(); await p3.goto(DEM.ancienne + '/cr/'); await attendre(2500);
    verifier(p3.url() === DEM.cible + 'cr/', 'ancienne adresse ensuite : renvoi direct vers la nouvelle (même page)');
    // Ancienne adresse sans données : renvoi direct
    const ctx2 = await b.newContext(); await ctx2.addInitScript(d => { try { sessionStorage.setItem('trigone_test_demenagement', d); } catch (e) {} }, JSON.stringify(DEM));
    const p4 = await ctx2.newPage(); await p4.goto(DEM.ancienne + '/'); await attendre(2500);
    verifier(p4.url().startsWith(DEM.cible), 'ancienne adresse sans données : renvoi direct');
    await b.close();
};
