// Compte-rendu : Bibliothèque et Remboursement rangés en dossiers (comme une messagerie).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    // Rien encore : les dossiers sont là quand même (Mise en route : Bibliothèque, Documents ; Compte-rendu : Bibliothèque, Remboursement).
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await p.reload(); await attendre(2500);
    const vides = await p.evaluate(() => { SHOW_PAGE('BIBLIOTHEQUE'); const a = document.querySelectorAll('.MER-DOSSIER').length; SHOW_PAGE('PANIER'); return [a, document.querySelectorAll('.MER-DOSSIER').length]; });
    verifier(vides[0] === 4 && vides[1] === 2, 'Mise en route vide : 4 dossiers en Bibliothèque, 2 en Documents ' + JSON.stringify(vides));
    await p.goto(srv.url + 'cr/'); await attendre(3000);
    const videsCr = await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); OUVRIR_BIBLIOTHEQUE(); const a = document.querySelectorAll('#BIB-LIST .MER-DOSSIER').length; OUVRIR_STAT_FORFAIT(); return [a, document.querySelectorAll('#FORFAIT-MONTH-LIST .MER-DOSSIER').length]; });
    verifier(videsCr[0] === 3 && videsCr[1] === 1, 'Compte-rendu vide : 3 dossiers en Bibliothèque, le mois en cours en Remboursement ' + JSON.stringify(videsCr));
    await p.goto(srv.url);
    await p.evaluate(() => {
        sessionStorage.setItem('trigone_choix_fait', '1');
        const e = (debut, f, role) => ({ debut, user: 'MICHEL Julien', forfaitOfficiel: f, role: role || 'INDIVIDUEL', recap: 'MISSIONNAIRE : MICHEL Julien', snapshot: {} });
        const l = [e('22/09/2026 06:30:00', 212.5), e('03/09/2026 07:00:00', 95, 'CHEF'), e('12/08/2026 05:45:00', 340)];
        localStorage.setItem('mission_bibliotheque', JSON.stringify(l));
        localStorage.setItem('mission_forfait_periode', JSON.stringify(l.concat([e('15/10/2025 08:00:00', 60)])));
    });
    await p.goto(srv.url + 'cr/'); await attendre(3000);
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); OUVRIR_BIBLIOTHEQUE(); }); await attendre(600);
    verifier(await p.evaluate(() => ['aenvoyer', 'envoyes', 'traites'].every(id => !!document.querySelector('#BIB-LIST .MER-DOSSIER[data-dossier="' + id + '"]'))
        && document.querySelector('.MER-DOSSIER[data-dossier="envoyes"] .MER-DOSSIER-NB').textContent === '3' && !document.querySelector('#BIB-LIST .BIB-CARD')),
        'Bibliothèque : dossiers « À envoyer », « Envoyés » (3), « Traités », sans liste à plat');
    await p.click('.MER-DOSSIER[data-dossier="envoyes"]'); await attendre(400);
    verifier(await p.evaluate(() => document.querySelectorAll('#BIB-LIST .BIB-CARD').length === 3 && !!document.querySelector('#BIB-LIST .MER-DOSSIER-TETE')), 'Bibliothèque : le dossier « Envoyés » liste ses 3 comptes-rendus');
    await p.locator('#BIB-LIST .BIB-CARD').first().click(); await attendre(400);
    verifier(await p.evaluate(() => !document.getElementById('BIB-DETAIL-VIEW').classList.contains('HIDDEN') && /22\/09\/2026/.test(document.getElementById('BIB-DETAIL-DATE').textContent)), 'Bibliothèque : un compte-rendu s\'ouvre depuis son dossier');
    await p.evaluate(() => OUVRIR_STAT_FORFAIT()); await attendre(600);
    const r = await p.evaluate(() => ({ mois: Array.from(document.querySelectorAll('#FORFAIT-MONTH-LIST .MER-DOSSIER b')).map(x => x.textContent), ans: Array.from(document.querySelectorAll('.CR-DOSSIERS-AN')).map(x => x.textContent) }));
    verifier(r.mois.filter(m => m !== 'Septembre 2026').concat(['Septembre 2026']).sort().join('|') === ['Août 2026', 'Octobre 2025', 'Septembre 2026'].sort().join('|') && r.mois[0] !== 'Octobre 2025' && r.ans[0] === '2026647,50 €' && r.ans[1] === '202560,00 €', 'Remboursement : un dossier par mois, regroupés par année avec leur total ' + JSON.stringify(r));
    await p.click('.MER-DOSSIER[data-dossier="2026-9"]'); await attendre(400);
    verifier(await p.evaluate(() => document.querySelectorAll('.FORFAIT-MISSION-ROW').length === 2 && /307,50/.test(document.getElementById('FORFAIT-YEAR-TOTAL').textContent)), 'Remboursement : « Septembre 2026 » ouvert : 2 missions, 307,50 €');
    await p.click('#FORFAIT-MONTH-LIST .MER-DOSSIER-RETOUR'); await attendre(400);
    verifier(await p.evaluate(() => document.querySelectorAll('#FORFAIT-MONTH-LIST .MER-DOSSIER').length === 3), '« ‹ Dossiers » ramène à la liste des mois');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
