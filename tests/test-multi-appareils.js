// Un même compte sur deux appareils (PC et téléphone) : une demande signée sur le PC passe en « traité » sur le téléphone
// (boîte de réception et Espace valideur), un envoi rouvert ou supprimé aussi. Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const MAILS = { M: 'missionnaire.' + suffixe + '@interieur.gouv.fr', V: 'valideur.' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom, mail, largeur) {
        const ctx = await b.newContext({ viewport: { width: largeur, height: 900 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', mail); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        return p;
    }
    const m = await appareil('missionnaire', MAILS.M, 480), pc = await appareil('PC du valideur', MAILS.V, 1440), tel = await appareil('téléphone du valideur', MAILS.V, 400);
    // Le valideur coche son rôle VALIDEUR 1 (avec son code) sur son PC.
    await pc.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(400);
    await pc.check('#JUM-R-VAL1'); await attendre(200); await pc.fill('#JUM-R-FONCTION1', 'Chef de service');
    for (const code of [process.env.TRIGONE_CODE_VAL1, process.env.TRIGONE_CODE_VAL2].filter(Boolean)) {
        if (!(await pc.$('#JUM-R-CODEVAL1')) || !(await pc.isVisible('#JUM-R-CODEVAL1'))) break;
        await pc.fill('#JUM-R-CODEVAL1', code); await pc.click('.JUM-R-PRINCIPAL'); await attendre(3000);
    }
    await pc.evaluate(() => window.JUMELAGE_FERMER_REGLAGES && JUMELAGE_FERMER_REGLAGES());
    // Deux demandes envoyées au valideur : chacun de ses appareils les reçoit.
    const envoyer = () => m.evaluate(dest => { const d = DEMO_DEMANDE(); d.id = 'multi' + Math.random().toString(36).slice(2); d.validations = []; d.mailDemandeur = JUMELAGE_COMPTE_MAIL();
        return JUMELAGE_ENVOYER_DIRECT(dest, 'DEMANDE', 'demande.json', JSON.stringify({ demandes: [d] })).then(() => d.id); }, MAILS.V);
    const d1 = await envoyer(), d2 = await envoyer();
    for (const p of [pc, tel]) { await p.evaluate(() => JUMELAGE_RELEVER()); await attendre(2500); }
    const boite = (p, d) => p.evaluate(d => (JUMELAGE_BOITE_LISTE().find(x => (x.ids || []).includes(d)) || {}), d);
    verifier((await boite(pc, d1)).nature === 'niveau1' && (await boite(tel, d1)).nature === 'niveau1', 'les deux appareils du valideur reçoivent la demande');
    // Téléphone : la demande est déjà ouverte dans l'Espace valideur, sans décision.
    await tel.evaluate(d => SAVE_A_VALIDER([{ id: d + '#0', d: { id: d, validations: [] }, decision: null }]), d1);
    // PC : demande signée et transmise → traitée.
    await pc.evaluate(d => JUMELAGE_BOITE_TRAITER_DEMANDES([d], ['niveau1', 'renvoi']), d1); await attendre(1500);
    await tel.evaluate(() => JUMELAGE_BOITE_ETATS()); await attendre(800);
    verifier((await boite(tel, d1)).statut === 'traite', 'signée sur le PC : la demande passe en « traité » sur le téléphone');
    verifier((await tel.evaluate(() => GET_A_VALIDER().length)) === 0, 'signée sur le PC : elle sort aussi de l\'Espace valideur du téléphone');
    verifier((await boite(tel, d2)).statut !== 'traite', 'l\'autre demande reste à signer sur le téléphone');
    // Rouverte sur le PC → de nouveau à traiter sur le téléphone.
    const id1 = (await boite(pc, d1)).id;
    await pc.evaluate(id => JUMELAGE_BOITE_ROUVRIR(id), id1); await attendre(1500);
    await tel.evaluate(() => JUMELAGE_BOITE_ETATS()); await attendre(800);
    verifier((await boite(tel, d1)).statut === 'ouvert', 'rouverte sur le PC : de nouveau à traiter sur le téléphone');
    // Supprimée sur le téléphone → disparaît du PC.
    const id2 = (await boite(tel, d2)).id;
    await tel.evaluate(id => JUMELAGE_BOITE_SUPPRIMER(id), id2); await attendre(1500);
    await pc.evaluate(() => JUMELAGE_BOITE_ETATS()); await attendre(800);
    verifier(!(await boite(pc, d2)).id, 'supprimée sur le téléphone : disparaît aussi du PC');
    // Envoi pas encore relevé par le téléphone quand le PC le traite : il arrive directement « traité ».
    const d3 = await envoyer();
    await pc.evaluate(() => JUMELAGE_RELEVER()); await attendre(2500);
    await pc.evaluate(d => JUMELAGE_BOITE_TRAITER_DEMANDES([d], ['niveau1']), d3); await attendre(1500);
    await tel.evaluate(() => { window.__annonces = []; const av = window.JUMELAGE_APRES_RELEVE; window.JUMELAGE_APRES_RELEVE = n => { window.__annonces.push(n.length); if (av) av(n); }; });
    await tel.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
    verifier(await tel.evaluate(() => !window.__annonces.length), 'traitée sur le PC : pas de message de réception sur le téléphone');
    verifier((await boite(tel, d3)).statut === 'traite', 'traitée sur le PC avant que le téléphone ne la relève : elle y arrive déjà « traitée »');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
    await b.close();
};
