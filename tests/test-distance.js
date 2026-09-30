// Indemnités kilométriques : la distance routière se calcule seule (ville de départ → ville d'arrivée, serveur
// /api/distance simulé), le kilométrage et le montant se remplissent, le Remboursement les reprend.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', e => erreurs.push(e.message));
    const appels = [];
    // Onglet du formulaire de départ affiché directement (l'identité n'est pas l'objet de ce test).
    const onglet = n => p.evaluate(n => { document.querySelectorAll('.p1-tab-panel').forEach(x => x.classList.add('HIDDEN')); document.getElementById('P1-PANEL-' + n).classList.remove('HIDDEN'); }, n);
    await p.route('**/api/distance**', r => {
        const u = new URL(r.request().url()), de = u.searchParams.get('de'), a = u.searchParams.get('a');
        appels.push(de + '>' + a);
        if (/INCONNUE/.test(de + a)) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, erreur: 'Ville introuvable : INCONNUE.' }) });
        const km = /LYON/.test(de + a) ? 460 : 152;
        r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, km }) });
    });
    await ctx.addInitScript(preparer, APP_CODE);
    await p.goto(srv.url); await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.goto(srv.url + 'cr/'); await attendre(3000);

    // Ville de la résidence administrative déjà connue (retenue lors d'une mission précédente).
    await p.evaluate(() => {
        localStorage.setItem('trigone_ik_residences', JSON.stringify({ GARNISON: 'RENNES (35000)' }));
        Object.assign(M, { LEGS: [], IS_PAX: false, RECAP_LOCKED: false, LIEU_DEP: 'GARNISON', LIEU_RET: 'GARNISON', T_A: 'VRC', G_A: 'PARIS (75001)', T_R: 'VRC' });
        SAVE_STATE(); RESTORE_FIELDS(); SHOW_PAGE('P1');
    });
    await onglet('ALLER'); await attendre(300);
    await p.selectOption('#TRANS-A', 'VRC'); await attendre(300); await onglet('ALLER');
    if (!(await p.inputValue('#DEST-A'))) { await p.fill('#DEST-A', 'PARIS (75001)'); await p.evaluate(() => document.getElementById('DEST-A').blur()); await attendre(300); }
    await onglet('ALLER'); await p.check('#IK-A'); await attendre(1200);
    const aller = await p.evaluate(() => ({ de: document.getElementById('IK-DE-A').value, vers: document.getElementById('IK-VERS-A').value,
        km: document.getElementById('IK-KM-A').value, mkm: M.IK_KM_A, montant: M.IK_MONTANT_A, attendu: Math.round(152 * IK_RATE_FOR_CV('5') * 100) / 100,
        info: document.getElementById('IK-AUTO-A').textContent, res: document.getElementById('IK-RESULT-A').textContent }));
    verifier(aller.de === 'RENNES (35000)' && aller.vers === 'PARIS (75001)', 'IK aller : villes proposées (résidence administrative → destination)');
    verifier(aller.km === '152' && aller.mkm === 152 && aller.montant === aller.attendu && /152 km par la route/.test(aller.info) && /€/.test(aller.res),
        'IK aller cochée : 152 km calculés seuls, montant rempli (' + aller.montant + ' €)');

    await onglet('RETOUR'); await attendre(300);
    await p.selectOption('#TRANS-R', 'VRC'); await attendre(300);
    await onglet('RETOUR'); await p.check('#IK-R'); await attendre(1200);
    const retour = await p.evaluate(() => ({ de: document.getElementById('IK-DE-R').value, vers: document.getElementById('IK-VERS-R').value, km: M.IK_KM_R }));
    verifier(retour.de === 'PARIS (75001)' && retour.vers === 'RENNES (35000)' && retour.km === 152, 'IK retour : destination → résidence, 152 km calculés seuls');

    // Kilométrage corrigé à la main : gardé ; ville d'arrivée changée : recalculé.
    await onglet('ALLER'); await attendre(300);
    await p.fill('#IK-KM-A', '160'); await attendre(300);
    await p.evaluate(() => WRITE_IK_TO_DOM()); await attendre(800);
    verifier(await p.evaluate(() => M.IK_KM_A === 160 && document.getElementById('IK-KM-A').value === '160'), 'kilométrage corrigé à la main : conservé');
    await onglet('ALLER'); await p.fill('#IK-VERS-A', 'LYON (69001)'); await p.evaluate(() => document.getElementById('IK-VERS-A').blur()); await attendre(1200);
    verifier(await p.evaluate(() => M.IK_KM_A === 460 && M.IK_VERS_A === 'LYON (69001)'), 'ville d\'arrivée changée : distance recalculée (460 km)');

    // Remboursement : kilométrage et montant repris sans rien saisir.
    const remb = await p.evaluate(() => { const e = BUILD_FORFAIT_ENTRY_FROM_STATE(M); return { slots: e.ikSlots, total: CALC_MANUAL_TOTAL(e) }; });
    const sA = remb.slots.find(s => /-A$/.test(s.id)), sR = remb.slots.find(s => /-R$/.test(s.id));
    verifier(sA && sA.km === 460 && sA.montant > 0 && sA.route === 'RENNES (35000) → LYON (69001)' && sR && sR.km === 152 && Math.abs(remb.total - (sA.montant + sR.montant)) < 0.01,
        'Remboursement : kilométrage et montant des IK remplis tout seuls (' + remb.total.toFixed(2) + ' €)');
    const ctrl = await p.evaluate(() => CONTROLES_AVANT_ENVOI(M).join('\n'));
    verifier(!/kilométrage non renseigné/.test(ctrl), 'contrôle avant envoi : plus d\'alerte « kilométrage non renseigné »');

    // Ville introuvable : message clair, saisie manuelle possible.
    await onglet('ALLER'); await p.fill('#IK-DE-A', 'INCONNUE (00000)'); await p.evaluate(() => document.getElementById('IK-DE-A').blur()); await attendre(1200);
    verifier(/introuvable.*Saisissez le kilométrage/.test(await p.textContent('#IK-AUTO-A')), 'ville introuvable : « Saisissez le kilométrage »');

    // Mise en route en véhicule personnel : villes reprises, ville de la résidence familiale retenue.
    await p.evaluate(() => {
        localStorage.removeItem('trigone_ik_residences');
        APPLIQUER_MISE_EN_ROUTE({ objet: 'Stage', personnes: [{ nom: 'DURAND', prenom: 'Léa', grade: 'SGT' }], trajets: {
            aller: { residenceDep: 'FAMILIALE', moyen: 'CIVILE', lieuDep: 'VANNES', cpDep: '56000', lieuArr: 'NANTES', cpArr: '44000', dateDep: '2026-10-12T07:30' },
            retour: { residenceArr: 'FAMILIALE', moyen: 'CIVILE', lieuDep: 'NANTES', cpDep: '44000', lieuArr: 'VANNES', cpArr: '56000', dateDep: '2026-10-16T16:00' } } }, false);
    });
    await attendre(600);
    const mer = await p.evaluate(() => ({ de: M.IK_DE_A, vers: M.IK_VERS_A, deR: M.IK_DE_R, versR: M.IK_VERS_R, res: JSON.parse(localStorage.getItem('trigone_ik_residences') || '{}') }));
    verifier(mer.de === 'VANNES (56000)' && mer.vers === 'NANTES (44000)' && mer.deR === 'NANTES (44000)' && mer.versR === 'VANNES (56000)' && mer.res.DOMICILE === 'VANNES (56000)',
        'mise en route en véhicule personnel : villes du trajet reprises, ville de la résidence familiale retenue');
    verifier(appels.length >= 4, 'distance demandée au serveur TRIGONE (' + appels.length + ' appels)');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
