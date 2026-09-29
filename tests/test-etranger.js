// Mission à l'étranger : barème du pays (repas 17,5 %, nuitée 65 %), repas pris pendant le trajet au barème France
// (20 €), taux de change de la Banque centrale européenne relevés par le serveur (/api/taux).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
    let appels = 0;
    await p.route('**/api/taux', r => { appels++; r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, date: '2026-09-28', source: 'BCE', taux: { 'EURO': 1, 'DOLLAR US': 0.9, 'DOLLAR AMERICAIN': 0.9, 'LIVRE STERLING': 1.2, 'FRANC CFA': 0.00152449 } }) }); });
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.goto(srv.url + 'cr/'); await attendre(3500);
    verifier(appels === 1 && await p.evaluate(() => EXCHANGE_RATES['DOLLAR US'] === 0.9 && /Banque centrale européenne, taux du 28\/09\/2026/.test(EXCHANGE_RATES_DATE)),
        'taux de change BCE relevés à l\'ouverture (serveur TRIGONE)');
    verifier(await p.evaluate(() => Math.abs(GET_PAYS_MONTANT_EUR('RWANDA') - 170 * 0.9) < 0.001), 'Rwanda (« DOLLAR AMERICAIN ») : montant calculé (plus de « taux manquant »)');
    await p.reload(); await attendre(3000);
    verifier(appels === 1, 'pas de nouveau relevé avant 12 h');
    // Espagne (212 € / jour) : repas 37,10 €, nuitée 137,80 €. Arrivée sur site 15 h 30 (midi du 1er jour en trajet),
    // départ du site 10 h le 3e jour (midi et soir du 3e jour en trajet).
    const d = await p.evaluate(() => {
        Object.assign(M, { MISSION_ETRANGER: true, PAYS_MISSION: 'ESPAGNE', DEBUT: '05/10/2026 06:00:00', ARR_SITE: '05/10/2026 15:30:00', DEP_SITE: '07/10/2026 10:00:00', LEGS: [],
            JOURS: [{ DATE: '2026-10-05', MIDI: 'PAYANT', SOIR: 'PAYANT', L: 'PAYANT' }, { DATE: '2026-10-06', MIDI: 'PAYANT', SOIR: 'PAYANT', L: 'PAYANT' }, { DATE: '2026-10-07', MIDI: 'PAYANT', SOIR: 'PAYANT', L: 'NEANT' }],
            PAYANT_MIDI: 3, PAYANT_SOIR: 3 });
        const r = REPAS_DETAIL(M);
        return { taux: r.taux, fm: r.midi.fr, fs: r.soir.fr, total: r.total, ligne: REPAS_LIGNE(r, 'midi').texte, heb: GET_HEBERG_RATE_EUR(M), recap: BUILD_RECAP_CORE(false).R };
    });
    verifier(d.taux === 37.1 && d.heb === 137.8, 'barème du pays : repas 37,10 € (17,5 %), nuitée 137,80 € (65 %)');
    verifier(d.fm === 2 && d.fs === 1 && d.total === 171.3, 'repas pendant le trajet au barème France : 2 midis + 1 soir à 20 € (total repas 171,30 €) ' + JSON.stringify([d.fm, d.fs, d.total]));
    verifier(/1 × 37,10 € \+ 2 × 20,00 € \(trajet France\) = 77,10 €/.test(d.ligne) && /trajet France/.test(d.recap), 'détail affiché : « 1 × 37,10 € + 2 × 20,00 € (trajet France) » (récapitulatif aussi)');
    // En France : 20 € partout, rien de changé.
    verifier(await p.evaluate(() => { M.MISSION_ETRANGER = false; const r = REPAS_DETAIL(M); return r.total === 120 && r.midi.fr === 0 && !/trajet/.test(REPAS_LIGNE(r, 'midi').texte); }), 'mission en France : 6 × 20 € = 120 €, pas de découpage');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
