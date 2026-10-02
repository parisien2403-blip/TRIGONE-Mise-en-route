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
    // Valideur : rôle coché dans Paramètres › Mes rôles, avec sa fonction et son code (plus de connexion dans l'Espace valideur).
    async function connecter(p, code, nom) {
        const niveau = code === code2 ? 2 : 1, id = 'VAL' + niveau;
        await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); JUMELAGE_REGLAGES({ vue: 'roles' }); }); await attendre(600);
        if (!(await p.isChecked('#JUM-R-' + id))) await p.check('#JUM-R-' + id);
        await attendre(200);
        await p.fill('#JUM-R-FONCTION' + niveau, 'Chef de service');
        if (await p.isVisible('#JUM-R-CODE' + id)) await p.fill('#JUM-R-CODE' + id, code);
        await p.click('.JUM-R-PRINCIPAL'); await attendre(3500);
        await p.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(1500);
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
    await m.fill('#MER-MAIL-DEST', 'chef@test.fr');
    await m.click('text=/Envoyer (cette demande|ces \d+ demandes)/'); await attendre(500);
    // Plus d'envoi par mail : sans compte TRIGONE, rien ne part et la demande reste dans Documents.
    verifier((await m.textContent('#MER-MODALE-FOND')).includes('Compte TRIGONE à activer') && !(await m.isVisible('#MER-BTN-DIRECT')),
        'sans compte TRIGONE : envoi bloqué, activation du compte proposée');
    await m.evaluate(() => FERMER_MODALE()); await attendre(300);
    verifier(await m.evaluate(() => GET_PANIER().length === 1), 'la demande reste dans Documents');
    verifier(await m.evaluate(() => !document.body.innerHTML.includes('Importer une demande refusée') && typeof ENREGISTRER_PANIER === 'undefined' && typeof BIB_QR === 'undefined'),
        'plus aucun échange par fichier (.json par mail, import, QR)');
    // Le contenu envoyé (celui que la boîte TRIGONE chiffre) : demandes + pièces jointes.
    const ecrire = async (p, nom, etape) => {
        const t = await p.evaluate(e => GENERER_JSON_COMPLET(e === 'DEMANDE_INITIALE' ? PANIER_A_ENVOYER() : MER_ENVOIS[0].demandes, e === 'DEMANDE_INITIALE' ? e : ETAPE_ENVOI(MER_ENVOIS[0])), etape);
        const f = path.join(SORTIE, nom); fs.writeFileSync(f, t); return f;
    };
    const j0 = await ecrire(m, '1-demande.json', 'DEMANDE_INITIALE');
    verifier(Object.keys(JSON.parse(fs.readFileSync(j0)).pieces).length === 2, 'les 2 pièces jointes voyagent avec la demande');
    // Réception telle que la boîte TRIGONE la fait (ouverture d'un envoi reçu).
    const recevoir = (p, fonction, fichiers) => p.evaluate(([fn, contenus]) => window[fn]({ files: contenus.map((c, i) => new File([c], 'recu' + i + '.json', { type: 'application/json' })), value: '' }),
        [fonction, fichiers.map(f => fs.readFileSync(f, 'utf8'))]);

    // ---- Assistant Chorus DT : une demande non signée est refusée ----
    const c = await page('C');
    await c.evaluate(() => SHOW_PAGE('VERIFIER')); await attendre(400);
    await recevoir(c, 'VERIFIER_FICHIERS', [j0]); await attendre(1500);
    verifier((await c.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Fichier non validé', 'Chorus DT refuse la demande du missionnaire (aucune signature)');

    const code1 = process.env.TRIGONE_CODE_VAL1, code2 = process.env.TRIGONE_CODE_VAL2;
    if (!code1 || !code2) {
        console.log('  (valideurs non testés : définissez TRIGONE_CODE_VAL1 et TRIGONE_CODE_VAL2)');
    } else {
        // ---- 1er valideur : effacer une demande reçue, la réimporter, la valider ----
        const v1 = await page('V1');
        verifier(await connecter(v1, code1), '1er valideur connecté');
        await v1.evaluate(() => SHOW_PAGE('VALIDATION')); await recevoir(v1, 'IMPORTER_A_VALIDER', [j0]); await attendre(1200);
        await v1.locator('button.BTN-DANGER-TEXT:has-text("Effacer")').first().click(); await attendre(500);
        await v1.locator('button:has-text("Effacer") >> visible=true').last().click(); await attendre(1200);
        verifier(await v1.evaluate(() => GET_A_VALIDER().length) === 0, '« Effacer » retire la demande reçue');
        await v1.evaluate(() => FERMER_MSG()); await attendre(400);
        await recevoir(v1, 'IMPORTER_A_VALIDER', [j0]); await attendre(1200);
        await v1.locator('button.BTN-PRIMARY:has-text("Valider")').first().click(); await attendre(800);
        await v1.fill('input[type=email]', 'v2@test.fr');
        await v1.click('text=Transmettre les décisions'); await attendre(600);
        verifier((await v1.textContent('#MER-MODALE-FOND')).includes('Compte TRIGONE à activer'), '1er valideur sans compte TRIGONE : transmission en attente, rien n\'est perdu');
        await v1.evaluate(() => FERMER_MODALE());
        const j1 = await ecrire(v1, '2-valideur1.json', 'x');
        verifier(JSON.parse(fs.readFileSync(j1)).demandes[0].validations.length === 1, 'demande signée par le 1er valideur');

        // ---- Même personne aux deux niveaux : autorisé (une personne peut avoir les deux rôles) ----
        const vx = await page('VX');
        await connecter(vx, code2);
        await vx.evaluate(() => SHOW_PAGE('VALIDATION')); await recevoir(vx, 'IMPORTER_A_VALIDER', [j1]); await attendre(1500);
        await vx.locator('button.BTN-PRIMARY:has-text("Valider")').first().click(); await attendre(1500);
        verifier(await vx.evaluate(() => GET_A_VALIDER()[0].decision === 'VALIDEE'), 'une même personne peut valider les deux niveaux d\'une demande');

        // ---- 2e valideur ----
        const v2 = await page('V2');
        verifier(await connecter(v2, code2, 'Martin'), '2e valideur connecté');
        await v2.evaluate(() => SHOW_PAGE('VALIDATION')); await recevoir(v2, 'IMPORTER_A_VALIDER', [j1]); await attendre(1500);
        await v2.locator('button.BTN-PRIMARY:has-text("Valider")').first().click(); await attendre(800);
        await v2.fill('input[type=email]', 'chorus@test.fr');
        await v2.click('text=Transmettre les décisions'); await attendre(600); await v2.evaluate(() => FERMER_MODALE());
        const j2 = await ecrire(v2, '3-valideur2.json', 'x');
        verifier(JSON.parse(fs.readFileSync(j2)).demandes[0].validations.length === 2, 'demande signée par les deux valideurs');

        // ---- Chorus DT : fichier conforme, et le même avec une NDS remplacée (fraude) ----
        const faux = JSON.parse(fs.readFileSync(j2)); const k = Object.keys(faux.pieces).find(x => faux.pieces[x].type === 'application/pdf');
        faux.pieces[k].b64 = fs.readFileSync(path.join(FICHIERS, 'daf_test.jpg')).toString('base64'); faux.demandes[0].id = 'falsifiee';
        const ff = path.join(SORTIE, 'falsifie.json'); fs.writeFileSync(ff, JSON.stringify(faux));
        const c2 = await page('C2');
        await c2.evaluate(() => SHOW_PAGE('VERIFIER')); await attendre(400);
        await recevoir(c2, 'VERIFIER_FICHIERS', [j2, ff]); await attendre(2500);
        const cartes = await c2.locator('.MER-PANIER-ITEM').allInnerTexts();
        verifier(cartes.filter(t => t.includes('Conforme : validée par les deux valideurs')).length === 1, 'Chorus DT : la demande signée par les deux valideurs est conforme');
        verifier(cartes.filter(t => t.includes('Non conforme')).length === 1, 'Chorus DT : la demande à la NDS remplacée est non conforme');
        await c2.locator('button:has-text("PDF avec NDS")').first().click(); await attendre(3000);
        verifier(!!dernier('4-OMR VALIDE'), 'PDF final « 4-OMR VALIDE … .pdf » produit');
    }
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' — ' + erreurs.join(' | ') : ''));
    await b.close();
};
