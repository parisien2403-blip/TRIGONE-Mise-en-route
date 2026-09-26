// Parcours complet de Mise en route : demande avec pièces jointes → 1er valideur → 2e valideur → assistant Chorus DT.
// Les codes d'accès valideurs ne sont jamais écrits dans le projet : TRIGONE_CODE_VAL1 et TRIGONE_CODE_VAL2 (variables
// d'environnement). Sans eux, seule la partie « demandeur » et le refus d'un fichier non signé par Chorus DT sont testés.
const path = require('path'), fs = require('fs');
const { FICHIERS, SORTIE, APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv, options) {
    options = options || {};
    const horsLigne = !!options.horsLigne;
    const b = await navigateur();
    const recus = [];
    const dernier = m => recus.filter(f => f.includes(m)).pop();
    const erreurs = [];

    async function page(nom) {
        const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 480, height: 1000 } });
        await ctx.addInitScript(() => { delete window.showSaveFilePicker; });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message));
        p.on('dialog', d => d.dismiss());
        p.on('download', async dl => { const f = path.join(SORTIE, nom + '__' + dl.suggestedFilename()); await dl.saveAs(f); recus.push(f); });
        await p.route('mailto:*', r => r.abort());
        await p.goto(srv.url);
        await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(3000);
        if (horsLigne) {
            // Appli « installée » (service workers prêts, Compte-rendu compris), puis plus de réseau.
            await p.evaluate(() => navigator.serviceWorker.ready);
            await p.goto(srv.url + 'cr/'); await attendre(2500); await p.goto(srv.url); await attendre(2000);
            await ctx.setOffline(true); await p.reload(); await attendre(3000);
            verifier(await p.evaluate(() => !navigator.onLine && !!navigator.serviceWorker.controller), nom + ' : appli ouverte sans réseau');
        }
        return p;
    }
    async function connecter(p, code) {
        await p.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(800);
        await p.fill('#MER-VAL-grade', 'CNE'); await p.fill('#MER-VAL-fonction', 'Chef de service');
        await p.fill('#MER-VAL-nom', 'Dupont'); await p.fill('#MER-VAL-prenom', 'Jean');
        await p.fill('#MER-CODE-ACCES', code); await p.click('button:has-text("Se connecter")'); await attendre(2500);
        return p.evaluate(() => !!HABILITATION_COURANTE());
    }

    // ---- Demandeur ----
    const m = await page('M');
    await m.evaluate(() => {
        NOUVELLE_DEMANDE(); D.objet = 'Formation TRIGONE';
        Object.assign(D.personnes[0], { unite: '4°RIISC', cie: '4CIE', grade: 'ADJ', nom: 'Bouquet', prenom: 'GP', matricule: '067 50 10 191' });
        Object.assign(D.trajets.aller, { residenceDep: 'ADMINISTRATIVE', moyen: 'SERVICE', lieuDep: 'BORDEAUX', cpDep: '33000', dateDep: '2026-10-01T08:00', lieuArr: 'PARIS', cpArr: '75001', dateArr: '2026-10-01T11:00' });
        SYNCHRO_RETOUR(); Object.assign(D.trajets.retour, { dateDep: '2026-10-03T08:00', dateArr: '2026-10-03T11:00' });
        D.codeFD = 'FDYDDR4FCT'; D.reservationABT = true; MER_ACTIVE_TAB = 'IMPUTATION'; RENDER_FORMULAIRE_INPLACE();
    });
    await m.setInputFiles('input[type=file][onchange="AJOUTER_PJ(this)"]', [path.join(FICHIERS, 'nds_test.pdf'), path.join(FICHIERS, 'daf_test.jpg')]);
    await attendre(1500);
    verifier(await m.evaluate(() => D.pieces.length) === 2, 'NDS et DAF jointes à la demande');
    await m.click('text=Ajouter aux documents'); await attendre(600);
    verifier(await m.evaluate(() => document.getElementById('MSG-TITRE').textContent) === 'Ajoutée à vos Documents', 'message « Ajoutée à vos Documents »');
    await m.evaluate(() => FERMER_MSG()); await attendre(400);
    await m.fill('#MER-MAIL-DEST', 'chef@test.fr'); await m.fill('#MER-MAIL-DEMANDEUR', 'moi@test.fr');
    await m.click('text=Envoyer mes documents'); await attendre(500);
    verifier(await m.isDisabled('#MER-BTN-ENVOYER'), '« Envoyer » grisé tant que le .json n\'est pas enregistré');
    await m.click('#MER-BTN-ENREGISTRER'); await attendre(1500);
    verifier(!(await m.isDisabled('#MER-BTN-ENVOYER')), '« Envoyer » actif après enregistrement');
    await m.click('#MER-BTN-ENVOYER'); await attendre(1400);
    verifier((await m.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Demande envoyée', 'message « Demande envoyée »');
    await m.evaluate(() => FERMER_MSG());
    const j0 = dernier('M__1-DEMANDE MISSIONNAIRE');
    verifier(!!j0, 'fichier « 1-DEMANDE MISSIONNAIRE … .json » produit');
    if (j0) verifier(Object.keys(JSON.parse(fs.readFileSync(j0)).pieces).length === 2, 'les 2 pièces jointes voyagent dans le .json');
    verifier(await m.evaluate(() => GET_BIBLIOTHEQUE().length === 1 && GET_PANIER().length === 0), 'la demande passe de Documents à la Bibliothèque');

    // ---- Assistant Chorus DT : un fichier non signé est refusé ----
    const c = await page('C');
    await c.evaluate(() => SHOW_PAGE('VERIFIER')); await attendre(400);
    await c.setInputFiles('input[type=file][onchange="VERIFIER_FICHIERS(this)"]', j0); await attendre(1500);
    verifier((await c.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Fichier non validé', 'Chorus DT refuse le fichier du demandeur (aucune signature)');

    const code1 = process.env.TRIGONE_CODE_VAL1, code2 = process.env.TRIGONE_CODE_VAL2;
    if (!code1 || !code2) {
        console.log('  (valideurs non testés : définissez TRIGONE_CODE_VAL1 et TRIGONE_CODE_VAL2)');
    } else {
        // ---- 1er valideur : effacer une demande reçue, la réimporter, la valider ----
        const v1 = await page('V1');
        verifier(await connecter(v1, code1), '1er valideur connecté');
        await v1.setInputFiles('input[type=file]', j0); await attendre(1200);
        await v1.locator('button.BTN-DANGER-TEXT:has-text("Effacer")').first().click(); await attendre(500);
        await v1.locator('button:has-text("Effacer") >> visible=true').last().click(); await attendre(1200);
        verifier(await v1.evaluate(() => GET_A_VALIDER().length) === 0, '« Effacer » retire la demande reçue');
        await v1.evaluate(() => FERMER_MSG()); await attendre(400);
        await v1.setInputFiles('input[type=file]', j0); await attendre(1200);
        await v1.locator('button.BTN-PRIMARY:has-text("Valider")').first().click(); await attendre(800);
        await v1.fill('input[type=email]', 'v2@test.fr');
        await v1.click('text=Transmettre les décisions');
        await v1.locator('#MER-MODALE-FOND button:has-text("Enregistrer")').first().click(); await attendre(1500);
        await v1.locator('#MER-MODALE-FOND button:has-text("Envoyer")').first().click(); await attendre(500);
        const j1 = dernier('2-SIGNE VALIDEUR 1');
        verifier(!!j1, 'fichier « 2-SIGNE VALIDEUR 1 … .json » produit');

        // ---- 2e valideur ----
        const v2 = await page('V2');
        verifier(await connecter(v2, code2), '2e valideur connecté');
        await v2.setInputFiles('input[type=file]', j1); await attendre(1500);
        await v2.locator('button.BTN-PRIMARY:has-text("Valider")').first().click(); await attendre(800);
        await v2.fill('input[type=email]', 'chorus@test.fr');
        await v2.click('text=Transmettre les décisions');
        await v2.locator('#MER-MODALE-FOND button:has-text("Enregistrer")').first().click(); await attendre(3000);
        await v2.locator('#MER-MODALE-FOND button:has-text("Envoyer")').first().click(); await attendre(500);
        const j2 = dernier('3-SIGNE VALIDEUR 2');
        verifier(!!j2, 'fichier « 3-SIGNE VALIDEUR 2 … .json » produit');

        // ---- Chorus DT : fichier conforme, et le même avec une NDS remplacée (fraude) ----
        const faux = JSON.parse(fs.readFileSync(j2)); const k = Object.keys(faux.pieces).find(x => faux.pieces[x].type === 'application/pdf');
        faux.pieces[k].b64 = fs.readFileSync(path.join(FICHIERS, 'daf_test.jpg')).toString('base64'); faux.demandes[0].id = 'falsifiee';
        const ff = path.join(SORTIE, 'falsifie.json'); fs.writeFileSync(ff, JSON.stringify(faux));
        const c2 = await page('C2');
        await c2.evaluate(() => SHOW_PAGE('VERIFIER')); await attendre(400);
        await c2.setInputFiles('input[type=file][onchange="VERIFIER_FICHIERS(this)"]', [j2, ff]); await attendre(2500);
        const cartes = await c2.locator('.MER-PANIER-ITEM').allInnerTexts();
        verifier(cartes.filter(t => t.includes('Conforme : validée par les deux valideurs')).length === 1, 'Chorus DT : la demande signée par les deux valideurs est conforme');
        verifier(cartes.filter(t => t.includes('Non conforme')).length === 1, 'Chorus DT : la demande à la NDS remplacée est non conforme');
        await c2.locator('button:has-text("PDF avec NDS")').first().click(); await attendre(3000);
        verifier(!!dernier('4-OMR VALIDE'), 'PDF final « 4-OMR VALIDE … .pdf » produit');
    }
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' — ' + erreurs.join(' | ') : ''));
    await b.close();
};
