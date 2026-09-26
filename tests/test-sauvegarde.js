// Sauvegarde complète : enregistrée sur un appareil, restaurée sur un appareil vierge (pièces jointes et code compris).
const fs = require('fs'), path = require('path');
const { SORTIE, APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur();
    const a = await b.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 850 } });
    const pa = await a.newPage();
    await pa.goto(srv.url); await pa.evaluate(preparer, APP_CODE);
    await pa.evaluate(() => {
        localStorage.setItem('mer_bibliotheque', JSON.stringify([{ id: 'e1', envoyeLe: new Date().toISOString(), demandes: [{ id: 'd1', personnes: [{ nom: 'DUPONT' }], trajets: { aller: {}, retour: {} }, pieces: [{ id: 'pj1', nom: 'nds.pdf' }] }] }]));
        localStorage.setItem('mission_bibliotheque', '[{"cr":"mission A"}]');
    });
    await pa.reload(); await attendre(2500);
    await pa.evaluate(() => PJ_ECRIRE('pj1', { nom: 'nds.pdf', type: 'application/pdf', b64: 'JVBERi0xLjQ=' }));
    await pa.evaluate(() => JUMELAGE_POSER_CODE('4321'));
    await pa.evaluate(() => { if (!document.querySelector('.JUM-CHOIX')) JUMELAGE_CHOIX(); }); await attendre(800);
    await pa.click('.JUM-ROUE:not(.JUM-MAJ-BTN)'); await attendre(300);
    const [dl] = await Promise.all([pa.waitForEvent('download'), pa.click('.JUM-ROUE-MENU [data-action="sauvegarder"]')]);
    const f = path.join(SORTIE, 'sauvegarde.json'); await dl.saveAs(f);
    const s = JSON.parse(fs.readFileSync(f));
    verifier(/^TRIGONE - sauvegarde \d\d-\d\d-\d{4}\.json$/.test(dl.suggestedFilename()), 'fichier « TRIGONE - sauvegarde JJ-MM-AAAA.json »');
    verifier(!!(s.donnees.mer_bibliotheque && s.donnees.mission_bibliotheque && s.donnees.trigone_code_commun), 'contient Mise en route, Compte-rendu et le code');
    verifier(!!(s.pieces && s.pieces.pj1), 'contient les pièces jointes');

    const c = await b.newContext({ viewport: { width: 400, height: 820 } });
    const pb = await c.newPage();
    await pb.goto(srv.url + 'cr/'); await pb.evaluate(preparer, APP_CODE); await pb.reload(); await attendre(2500);
    await pb.evaluate(() => localStorage.setItem('donnee_a_remplacer', 'x'));
    await pb.evaluate(t => JUMELAGE_RESTAURER_FICHIER(new File([t], 's.json')), fs.readFileSync(f, 'utf8')); await attendre(800);
    await pb.click('.JUM-NOUV-OK'); await attendre(4500);
    const r = await pb.evaluate(() => ({ bib: JSON.parse(localStorage.getItem('mer_bibliotheque') || '[]').length, cr: localStorage.getItem('mission_bibliotheque'),
        ancienne: localStorage.getItem('donnee_a_remplacer'), hub: !!document.querySelector('.JUM-CHOIX') }));
    verifier(r.bib === 1 && r.cr === '[{"cr":"mission A"}]' && r.ancienne === null, 'restauration : données des deux applis remises, anciennes remplacées');
    verifier(r.hub, 'restauration : retour à l\'écran de choix');
    verifier((await pb.evaluate(() => PJ_LIRE('pj1').then(p => p && p.nom))) === 'nds.pdf', 'restauration : pièce jointe remise');
    verifier(await pb.evaluate(() => JUMELAGE_VERIFIER_CODE('4321')), 'restauration : code d\'accès remis');
    await b.close();
};
