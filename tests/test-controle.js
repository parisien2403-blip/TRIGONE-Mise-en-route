// Contrôle avant envoi du compte-rendu : horodatages dans le désordre, billet incohérent avec les horodatages ou sans
// horaires, IK sans kilométrage, repas payant non éligible → « points à vérifier » (Corriger / Envoyer quand même).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', e => erreurs.push(e.message));
    await ctx.addInitScript(preparer, APP_CODE);
    await p.goto(srv.url); await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.goto(srv.url + 'cr/'); await attendre(3000);
    const base = { LEGS: [], MISSION_ETRANGER: false, DEBUT: '05/10/2026 06:20:00', ARR_SITE: '05/10/2026 09:40:00', DEP_SITE: '07/10/2026 16:30:00', FIN_RETOUR_HORODATE: '07/10/2026 19:55:00',
        T_A: 'VF', DT_A_DEP: '05/10/2026 06:52:00', DT_A_ARR: '05/10/2026 09:28:00', T_R: 'VF', DT_R_DEP: '07/10/2026 17:04:00', DT_R_ARR: '07/10/2026 19:41:00',
        IK_A: false, IK_R: false, IK_A_ANX: false, IK_R_ANX: false,
        JOURS: [{ DATE: '2026-10-05', MIDI: 'PAYANT', SOIR: 'PAYANT', L: 'NEANT' }, { DATE: '2026-10-06', MIDI: 'PAYANT', SOIR: 'PAYANT', L: 'NEANT' }, { DATE: '2026-10-07', MIDI: 'PAYANT', SOIR: 'NEANT', L: 'NEANT' }] };
    const propre = await p.evaluate(b => CONTROLES_AVANT_ENVOI(Object.assign({}, M, b)), base);
    verifier(propre.length === 0, 'mission cohérente : rien à vérifier' + (propre.length ? ' — ' + propre[0] : ''));
    const l = await p.evaluate(b => CONTROLES_AVANT_ENVOI(Object.assign({}, M, b, {
        DEBUT: '05/10/2026 11:40:00', ARR_SITE: '05/10/2026 09:00:00', T_R: 'AVION', DT_R_DEP: '', DT_R_ARR: '', IK_A_ANX: true, IK_KM_A_ANX: 0 })), base);
    const t = l.join('\n');
    verifier(/désordre/.test(t), 'horodatages dans le désordre signalés');
    verifier(/départ de mission horodaté à 11h40, après le départ du train \(06h52/.test(t), 'départ horodaté après le départ du train signalé');
    verifier(/Horaires du billet retour \(avion\) non renseignés/.test(t), 'billet d\'avion sans horaires signalé');
    verifier(/kilométrage non renseigné/.test(t), 'IK sans kilométrage signalées');
    verifier(/repas midi.*ne sera pas remboursé/i.test(t), 'repas payant non éligible (départ 11h40) signalé : « il ne sera pas remboursé »');
    // À l'envoi : la liste s'affiche ; « Envoyer quand même » poursuit l'envoi.
    const r = await p.evaluate(b => {
        Object.assign(M, b, { DEBUT: '05/10/2026 08:10:00', MAIL_SENT: false });
        window.ALL_PJ_RESOLVED = () => true; window.HAS_EXPERIENCE_SAISIE = () => false; window.__envoi = 0; window.JUMELAGE_ENVOYER_CR = () => { window.__envoi++; };
        ENVOYER_MAIL();
        return { titre: document.getElementById('MSG-TITRE').textContent, texte: document.getElementById('MSG-TEXTE').textContent, envoi: window.__envoi,
            boutons: [...document.querySelectorAll('#MSG-BOUTONS button')].map(x => x.textContent) };
    }, base);
    verifier(/point.* à vérifier avant l.envoi/.test(r.titre) && /après le départ du train/.test(r.texte) && r.envoi === 0 && r.boutons.join('|') === 'Envoyer quand même|Corriger',
        'à l\'envoi : « 1 point à vérifier » affiché, l\'envoi attend (Corriger / Envoyer quand même)');
    await p.click('#MSG-BOUTONS button:has-text("Envoyer quand même")'); await attendre(800);
    verifier(await p.evaluate(() => window.__envoi === 1), '« Envoyer quand même » : l\'envoi part');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
