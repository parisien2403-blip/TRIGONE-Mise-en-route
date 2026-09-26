// Boîte aux lettres TRIGONE : comptes (mail pro + code), envois directs chiffrés demandeur → 1er valideur →
// 2e valideur → assistant Chorus DT, et refus renvoyé au demandeur.
// Demande un serveur avec l'API : « npx wrangler dev --var MODE_TEST:1 --var DOMAINES_AUTORISES:interieur.gouv.fr » (le code est alors renvoyé au lieu d'être
// envoyé par mail), puis TRIGONE_URL_BOITE=http://localhost:8787/ . Sans cette variable, le test est sauté.
const path = require('path');
const { FICHIERS, APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    const code1 = process.env.TRIGONE_CODE_VAL1, code2 = process.env.TRIGONE_CODE_VAL2;
    if (!URL || !code1 || !code2) { console.log('  (sauté : définissez TRIGONE_URL_BOITE, TRIGONE_CODE_VAL1 et TRIGONE_CODE_VAL2)'); return; }
    const b = await navigateur(), erreurs = [];
    const suffixe = Date.now().toString(36);
    const MAILS = { M: 'demandeur.' + suffixe + '@interieur.gouv.fr', V1: 'chef.' + suffixe + '@interieur.gouv.fr',
        V2: 'colonel.' + suffixe + '@interieur.gouv.fr', C: 'chorus.' + suffixe + '@interieur.gouv.fr' };

    async function appareil(nom) {
        const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 480, height: 1000 } });
        const p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message));
        p.on('dialog', d => d.accept());
        await p.route('mailto:*', r => r.abort());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        // Activation du compte : mail pro → code (renvoyé par le serveur de test) → Activer
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        verifier(await p.evaluate(() => JUMELAGE_COMPTE_ACTIF()), nom + ' : compte TRIGONE actif (' + MAILS[nom].split('@')[0] + ')');
        return p;
    }
    async function connecter(p, code) {
        await p.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(800);
        await p.fill('#MER-VAL-grade', 'CNE'); await p.fill('#MER-VAL-fonction', 'Chef'); await p.fill('#MER-VAL-nom', 'Dupont'); await p.fill('#MER-VAL-prenom', 'Jean');
        await p.fill('#MER-CODE-ACCES', code); await p.click('button:has-text("Se connecter")'); await attendre(2500);
    }
    async function relever(p) { await p.evaluate(() => JUMELAGE_RELEVER()); await attendre(2500); }
    // Boîte de réception : bouton « Ouvrir… » du premier envoi à traiter.
    async function ouvrirBoite(p) { await p.evaluate(() => SHOW_PAGE('RECEPTION')); await attendre(400); await p.locator('.MER-RECU .BTN-PRIMARY').first().click(); await attendre(2500); }

    // Adresse non professionnelle refusée
    const x = await b.newPage(); await x.goto(URL); await x.evaluate(preparer, APP_CODE); await x.reload(); await attendre(2000);
    await x.evaluate(() => JUMELAGE_COMPTE()); await attendre(400);
    await x.fill('#JUM-C-MAIL', 'quelquun@gmail.com'); await x.click('#JUM-C-ENVOI'); await attendre(1200);
    verifier((await x.textContent('#JUM-C-ERR')).includes('professionnelles'), 'adresse non professionnelle refusée');

    const m = await appareil('M'), v1 = await appareil('V1'), v2 = await appareil('V2'), c = await appareil('C');

    // Demandeur : 2 demandes, envoyées directement au 1er valideur
    for (const nom of ['Bouquet', 'Martin']) {
        await m.evaluate(n => {
            NOUVELLE_DEMANDE(); D.objet = 'Stage ' + n;
            Object.assign(D.personnes[0], { unite: '4°RIISC', cie: '4CIE', grade: 'ADJ', nom: n, prenom: 'GP', matricule: '067 50 10 191' });
            Object.assign(D.trajets.aller, { residenceDep: 'ADMINISTRATIVE', moyen: 'SERVICE', lieuDep: 'BORDEAUX', cpDep: '33000', dateDep: '2026-10-01T08:00', lieuArr: 'PARIS', cpArr: '75001', dateArr: '2026-10-01T11:00' });
            SYNCHRO_RETOUR(); Object.assign(D.trajets.retour, { dateDep: '2026-10-03T08:00', dateArr: '2026-10-03T11:00' });
            D.codeFD = 'FDYDDR4FCT'; MER_ACTIVE_TAB = 'IMPUTATION'; RENDER_FORMULAIRE_INPLACE();
        }, nom);
        if (nom === 'Bouquet') { await m.setInputFiles('input[type=file][onchange="AJOUTER_PJ(this)"]', [path.join(FICHIERS, 'nds_test.pdf')]); await attendre(1200); }
        await m.click('text=Ajouter aux documents'); await attendre(500); await m.evaluate(() => FERMER_MSG()); await attendre(300);
    }
    await m.fill('#MER-MAIL-DEST', MAILS.V1); await m.fill('#MER-MAIL-DEMANDEUR', MAILS.M);
    await m.click('text=Envoyer mes documents'); await attendre(500);
    verifier(await m.isVisible('#MER-BTN-DIRECT'), 'demandeur : bouton « Envoyer directement dans TRIGONE »');
    await m.click('#MER-BTN-DIRECT'); await attendre(3000);
    verifier((await m.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Demandes envoyées', 'demandeur : envoi direct réussi, sans pièce jointe ni mail');
    await m.evaluate(() => FERMER_MSG());

    // Le serveur ne voit que des données chiffrées
    const brut = await v1.evaluate(async () => {
        const c = JSON.parse(localStorage.getItem('trigone_compte')), h = { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton };
        const l = await (await fetch('api/boite', { headers: h })).json();
        return l.envois.length ? await (await fetch('api/boite/' + l.envois[0].id, { headers: h })).text() : '';
    });
    verifier(brut.length > 100 && !/Bouquet|Martin|BORDEAUX|FDYDDR4FCT/i.test(brut), 'serveur : contenu illisible (chiffré de bout en bout)');

    // 1er valideur : relève, valide Bouquet, refuse Martin, transmet directement
    await relever(v1);
    verifier(await v1.evaluate(() => JUMELAGE_BOITE_NB()) === 1, '1er valideur : l\'envoi arrive dans la boîte de réception');
    await v1.evaluate(() => SHOW_PAGE('ACCUEIL')); await attendre(300);
    verifier((await v1.textContent('.BTN-ACCUEIL-BOITE')).includes('1'), '1er valideur : pastille « 1 » sur le bouton Boîte de réception de l\'accueil');
    await ouvrirBoite(v1);
    verifier((await v1.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Connexion valideur', '1er valideur non connecté : « Ouvrir » demande le code valideur');
    await v1.evaluate(() => FERMER_MSG()); await attendre(300);
    await v1.fill('#MER-VAL-grade', 'CNE'); await v1.fill('#MER-VAL-fonction', 'Chef'); await v1.fill('#MER-VAL-nom', 'Dupont'); await v1.fill('#MER-VAL-prenom', 'Jean');
    await v1.fill('#MER-CODE-ACCES', code1); await v1.click('button:has-text("Se connecter")'); await attendre(3500);
    verifier(await v1.evaluate(() => GET_A_VALIDER().length) === 2, '1er valideur : après connexion, les 2 demandes s\'ouvrent dans l\'Espace valideur');
    await v1.evaluate(() => {
        const l = GET_A_VALIDER(); const b = l.find(e => e.d.personnes[0].nom === 'Bouquet'), mt = l.find(e => e.d.personnes[0].nom === 'Martin');
        VALIDER_DEMANDES([b.id]); window.__refus = mt.id;
    }); await attendre(1500);
    await v1.evaluate(() => DEMANDER_REFUS(window.__refus)); await attendre(800);
    await v1.fill('#MER-MOTIF-REFUS', 'Merci de joindre la DAF'); await v1.click('#MER-MODALE-FOND button:has-text("Refuser")'); await attendre(800);
    await v1.evaluate(v => SET_MAIL_VALIDEUR('mailValideur2', v), MAILS.V2);
    await v1.evaluate(() => PREPARER_TRANSMISSION()); await attendre(600);
    const boutons = await v1.locator('#MER-MODALE-FOND button:has-text("Envoyer directement")').count();
    verifier(boutons === 2, '1er valideur : 2 envois directs proposés (2e valideur + refus au demandeur)');
    for (let i = 0; i < boutons; i++) { await v1.locator('#MER-MODALE-FOND button:has-text("Envoyer directement")').first().click(); await attendre(3000); }
    verifier(await v1.locator('#MER-MODALE-FOND >> text=Arrivé dans le TRIGONE').count() === 2, '1er valideur : les 2 envois sont arrivés');
    await v1.click('#MER-MODALE-FOND button:has-text("Terminé")'); await attendre(800);
    verifier(await v1.evaluate(() => JUMELAGE_BOITE_NB() === 0 && JUMELAGE_BOITE_LISTE()[0].statut === 'traite'), '1er valideur : l\'envoi passe en « Traitées » dans la boîte');

    // Demandeur : le refus revient dans Documents
    await relever(m);
    await ouvrirBoite(m);
    verifier(await m.evaluate(() => GET_PANIER().some(d => d.refus && d.refus.motif === 'Merci de joindre la DAF')), 'demandeur : la demande refusée revient dans Documents, avec le motif');

    // 2e valideur
    await connecter(v2, code2);
    await relever(v2);
    await ouvrirBoite(v2);
    verifier(await v2.evaluate(() => GET_A_VALIDER().length) === 1, '2e valideur : la demande validée par le 1er valideur arrive');
    await v2.evaluate(() => VALIDER_DEMANDES([GET_A_VALIDER()[0].id])); await attendre(1500);
    await v2.evaluate(v => SET_MAIL_VALIDEUR('mailChorus', v), MAILS.C);
    await v2.evaluate(() => PREPARER_TRANSMISSION()); await attendre(600);
    await v2.locator('#MER-MODALE-FOND button:has-text("Envoyer directement")').first().click(); await attendre(3500);
    verifier(await v2.locator('#MER-MODALE-FOND >> text=Arrivé dans le TRIGONE').count() === 1, '2e valideur : envoi direct à l\'assistant Chorus DT');

    // Assistant Chorus DT
    await relever(c);
    await ouvrirBoite(c);
    const cartes = await c.locator('.MER-PANIER-ITEM').allInnerTexts();
    verifier(await c.evaluate(() => PAGE_ACTUELLE) === 'VERIFIER' && cartes.some(t => t.includes('Conforme : validée par les deux valideurs')),
        'assistant Chorus DT : la demande arrive, conforme (signatures et NDS vérifiées)');

    // Boîtes vides après relève
    const reste = await v1.evaluate(async () => { const c = JSON.parse(localStorage.getItem('trigone_compte'));
        return (await (await fetch('api/boite', { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton } })).json()).envois.length; });
    verifier(reste === 0, 'serveur : envois supprimés dès leur réception');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' — ' + erreurs.join(' | ') : ''));
    await b.close();
};
