// Option « Demande de réservation » : réglée dans le profil (libellé de l'unité), deux choix dans la mise en route
// (hébergement, transport), reprise dans Compte-rendu (transport : trajets train / avion / bateau ; hébergement : rappel).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => { localStorage.setItem('trigone_app_settings', JSON.stringify({ abtEnabled: true, abtLabel: 'ABT' })); sessionStorage.setItem('trigone_choix_fait', '1'); });
    await p.reload(); await attendre(2000);
    verifier(await p.evaluate(() => JUMELAGE_RESA().libelle) === 'Demande de réservation', 'libellé vide (ou ancien « ABT ») : « Demande de réservation »');
    await p.evaluate(() => JUMELAGE_REGLAGES()); await attendre(400);
    await p.fill('#JUM-R-RESALIB', 'Amplitude (ABT)'); await p.click('.JUM-R-PRINCIPAL'); await attendre(1200);
    verifier(await p.evaluate(() => JUMELAGE_RESA().libelle === 'Amplitude (ABT)' && JSON.parse(localStorage.getItem('trigone_app_settings')).abtLabel === 'Amplitude (ABT)'),
        'profil : libellé « Amplitude (ABT) », commun à Compte-rendu');
    await p.evaluate(() => { NOUVELLE_DEMANDE(); MER_ACTIVE_TAB = 'CONDITIONS'; SHOW_PAGE('FORMULAIRE'); }); await attendre(600);
    verifier((await p.textContent('[data-champ="reservation"]')).includes('Amplitude (ABT)'), 'mise en route : « Demande de réservation — Amplitude (ABT) »');
    await p.click('[data-champ="reservation"] .MER-TOGGLE-BTN:nth-child(1)'); await p.click('[data-champ="reservation"] .MER-TOGGLE-BTN:nth-child(2)'); await attendre(300);
    const d = await p.evaluate(() => {
        Object.assign(D.trajets.aller, { moyen: 'FERREE', lieuDep: 'LIBOURNE', cpDep: '33500', lieuArr: 'PARIS', cpArr: '75014', dateDep: '2026-10-05T06:52', dateArr: '2026-10-05T09:28' });
        Object.assign(D.trajets.retour, { moyen: 'FERREE', lieuDep: 'PARIS', cpDep: '75014', lieuArr: 'LIBOURNE', cpArr: '33500', dateDep: '2026-10-07T17:04', dateArr: '2026-10-07T19:41' });
        return JSON.parse(JSON.stringify(D));
    });
    verifier(d.resaHeberg === true && d.resaTransport === true, 'mise en route : hébergement et transport cochés');
    await p.evaluate(() => { MER_ACTIVE_TAB = 'IMPUTATION'; RENDER_FORMULAIRE_INPLACE(); }); await attendre(300);
    verifier(/joignez aussi la demande de réservation — Amplitude \(ABT\)/.test(await p.textContent('.MER-RAPPEL-RESA')), 'imputation : rappel de joindre la demande de réservation avec la NDS / DAF');
    // Désactivée par le régiment : la ligne disparaît.
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('trigone_app_settings')); s.abtEnabled = false; localStorage.setItem('trigone_app_settings', JSON.stringify(s)); RENDER_FORMULAIRE_INPLACE(); }); await attendre(300);
    verifier(!(await p.$('[data-champ="reservation"]')), 'option non utilisée : pas de ligne de réservation');
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('trigone_app_settings')); s.abtEnabled = true; localStorage.setItem('trigone_app_settings', JSON.stringify(s)); });
    await p.goto(srv.url + 'cr/'); await attendre(2500);
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
    await p.evaluate(dd => APPLIQUER_MISE_EN_ROUTE(dd), d); await attendre(1200);
    verifier(await p.evaluate(() => M.ABT_A === true && M.ABT_R === true && document.getElementById('ABT-A').checked && /Amplitude/.test(document.getElementById('ABT-ROW-A').textContent)),
        'compte-rendu : réservation transport cochée sur les trajets en train (aller et retour)');
    verifier(await p.evaluate(() => M.MER_RESA_HEBERG === true && (M.JOURS || []).every(j => !j.L_ABT) && GET_MISSION_LEGS_FROM_STATE(M).every(l => (l.JOURS || []).every(j => !j.L_ABT))),
        'compte-rendu : réservation d\'hébergement rappelée, aucune nuit choisie d\'office (Gratuit / réservation / Payant au choix)');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
