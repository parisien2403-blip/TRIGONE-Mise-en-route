// « Poser une question » au lieu de refuser : le valideur questionne le missionnaire sur sa demande ; celui-ci reçoit
// la question (Boîte de réception › Questions), répond ; la réponse s'affiche sous la demande, qui n'a pas bougé.
// Demande le serveur de test (TRIGONE_URL_BOITE) et le code du VALIDEUR 1 (TRIGONE_CODE_VAL1).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE, code1 = process.env.TRIGONE_CODE_VAL1;
    if (!URL || !code1) { console.log('  (sauté : définissez TRIGONE_URL_BOITE et TRIGONE_CODE_VAL1)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const MAILS = { M: 'missionnaire.q' + suffixe + '@interieur.gouv.fr', V: 'valideur.q' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), q = await ctx.newPage();
        q.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); q.on('dialog', d => d.accept());
        await q.goto(URL); await q.evaluate(preparer, APP_CODE); await q.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await q.reload(); await attendre(2500);
        await q.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await q.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await q.fill('#JUM-C-MAIL', MAILS[nom]); await q.click('#JUM-C-ENVOI'); await attendre(1500);
        await q.click('#JUM-C-VALIDER'); await attendre(2000);
        await q.evaluate(() => { JUMELAGE_FERMER_COMPTE(); document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); });
        return q;
    }
    const v = await appareil('V'), m = await appareil('M');
    await v.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(500);
    await v.check('#JUM-R-VAL1'); await attendre(200); await v.fill('#JUM-R-FONCTION1', 'Chef de service'); await v.fill('#JUM-R-CODEVAL1', code1);
    await v.click('.JUM-R-PRINCIPAL'); await attendre(4000);
    await m.evaluate(dest => {
        const d = VIDE_DEMANDE(); d.objet = 'STAGE FDF';
        d.personnes[0] = { unite: '4°RIISC', cie: '4CIE', grade: 'SGT', nom: 'DURAND', prenom: 'Léa', matricule: '067 12 34 567' };
        d.trajets.aller = Object.assign(d.trajets.aller, { moyen: 'CIVILE', lieuDep: 'LIBOURNE', cpDep: '33500', lieuArr: 'BORDEAUX', cpArr: '33000', dateDep: '2026-10-12T07:30', dateArr: '2026-10-12T08:30' });
        d.trajets.retour = Object.assign(d.trajets.retour, { moyen: 'CIVILE', lieuDep: 'BORDEAUX', cpDep: '33000', lieuArr: 'LIBOURNE', cpArr: '33500', dateDep: '2026-10-12T17:00', dateArr: '2026-10-12T18:00' });
        d.mailDemandeur = JUMELAGE_COMPTE_MAIL();
        return GENERER_JSON_COMPLET([d], 'DEMANDE_INITIALE').then(j => JUMELAGE_ENVOYER_DIRECT(dest, 'DEMANDE', 'DEMANDE DURAND.json', j));
    }, MAILS.V);
    await attendre(800);
    await v.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
    await v.evaluate(() => OUVRIR_RECU(JUMELAGE_BOITE_LISTE().find(x => x.nature === 'niveau1').id)); await attendre(4000);
    const bouton = v.locator('button[onclick^="POSER_QUESTION"]').first();
    verifier(await bouton.count() === 1, 'Espace valideur : bouton « ❓ Question » sur la demande');
    await bouton.click(); await attendre(400);
    await v.fill('#MER-QUESTION-TXT', 'Pourquoi un véhicule personnel plutôt que le train ?'); await v.click('#MER-QUESTION-GO'); await attendre(2500);
    verifier(/En attente de réponse/.test(await v.evaluate(() => document.body.innerText)), 'la question s\'affiche sous la demande (« en attente de réponse »)');
    // Missionnaire : la question arrive, il répond.
    await m.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
    await m.evaluate(() => { MER_DOSSIER.RECEPTION = 'questions'; SHOW_PAGE('RECEPTION'); }); await attendre(500);
    const recu = await m.evaluate(() => document.body.innerText);
    verifier(await m.evaluate(() => /Question sur votre demande/.test((document.querySelector('.MER-BANDEAU-RECU') || {}).textContent || '')), 'missionnaire : bandeau « Question sur votre demande » avec le texte de la question');
    verifier(/Question sur votre demande/.test(recu) && /Pourquoi un véhicule personnel/.test(recu) && /VALIDEUR 1/.test(recu), 'missionnaire : la question arrive dans Boîte de réception › Questions (avec le nom du valideur)');
    await m.locator('.MER-BX-LIGNE').first().click(); await attendre(400);
    await m.click('button[onclick^="REPONDRE_QUESTION"]'); await attendre(400);
    await m.fill('#MER-REPONSE-TXT', 'Pas de train avant 9 h : départ à 7 h 30 obligatoire.'); await m.click('#MER-REPONSE-GO'); await attendre(2500);
    verifier(await m.evaluate(() => JUMELAGE_BOITE_LISTE().some(x => x.nature === 'question' && x.statut === 'traite')), 'missionnaire : réponse envoyée, la question est traitée');
    // Valideur : la réponse s'affiche sous la demande, toujours à valider.
    await v.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
    await v.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(1500);
    if (process.env.CAPTURES) { await v.evaluate(() => { try { FERMER_MSG(); } catch (e) {} document.querySelectorAll('.MER-BANDEAU-RECU').forEach(b => b.remove()); }); await attendre(500); await v.evaluate(() => { const q = document.querySelector('.MER-QUESTION'); if (q) q.scrollIntoView({ block: 'center' }); }); await v.screenshot({ path: process.env.CAPTURES + '/valideur-question.png' }); }
    const vue = await v.evaluate(() => document.body.innerText);
    verifier(/Pas de train avant 9 h/.test(vue) && !/En attente de réponse/.test(vue), 'valideur : la réponse s\'affiche sous la demande');
    verifier(await v.evaluate(() => GET_A_VALIDER().some(e => !e.decision)), 'la demande n\'a pas été refusée : elle attend toujours la décision du valideur');
    verifier(!/vous ne pouvez pas la valider/.test(vue), 'Espace valideur : plus de « vous ne pouvez pas la valider » sur une demande qui est bien pour ce valideur');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
