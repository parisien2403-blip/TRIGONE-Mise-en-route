// Mission collective : le chef de mission envoie le compte-rendu prérempli dans la boîte TRIGONE de chaque participant
// (plus de QR code ni de WhatsApp) ; le participant le reçoit (boîte de réception) et l'ouvre dans Compte-rendu.
// Demande le serveur de test (TRIGONE_URL_BOITE), comme test-boite.js.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const MAILS = { CHEF: 'chefmission.' + suffixe + '@interieur.gouv.fr', PAX: 'participant.' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        verifier(await p.evaluate(() => JUMELAGE_COMPTE_ACTIF()), nom + ' : compte TRIGONE actif');
        return p;
    }
    const pax = await appareil('PAX'), chef = await appareil('CHEF');
    // Chef : compte-rendu de la mission collective (repris de la mise en route à 3 personnes).
    await chef.goto(URL + 'cr/'); await attendre(2500);
    await chef.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
    await chef.evaluate(() => APPLIQUER_MISE_EN_ROUTE({ objet: 'FORMATION SSIAP', trajets: {
        aller: { moyen: 'FERREE', residenceDep: 'GARNISON', lieuDep: 'LIBOURNE', cpDep: '33500', lieuArr: 'PARIS', cpArr: '75014', dateDep: '2026-10-05T06:52', dateArr: '2026-10-05T09:28' },
        retour: { moyen: 'FERREE', residenceArr: 'GARNISON', lieuDep: 'PARIS', cpDep: '75014', lieuArr: 'LIBOURNE', cpArr: '33500', dateDep: '2026-10-07T17:04', dateArr: '2026-10-07T19:41' } },
        personnes: [{ grade: 'ADJ', nom: 'TEST', prenom: 'Chef', matricule: '067 12 34 567' }, { grade: 'CPL', nom: 'LEROY', prenom: 'Emma', matricule: '067 98 76 543', cie: '2CIE' }, { grade: 'SAP', nom: 'BERNARD', prenom: 'Hugo', matricule: '067 55 44 333' }] }));
    await attendre(1200);
    await chef.evaluate(m => { M.CHEF_MAIL = m; M.DEBUT = '05/10/2026 06:30:00'; SAVE_STATE(); document.querySelectorAll('#MSG-OVERLAY').forEach(e => e.classList.add('HIDDEN')); }, MAILS.CHEF);
    await chef.evaluate(() => OUVRIR_ENVOI_PAX()); await attendre(400);
    verifier(await chef.evaluate(() => !document.getElementById('PAX-ENVOI-OVERLAY').classList.contains('HIDDEN') && document.querySelectorAll('#PAX-ENVOI-LISTE .PAX-LIGNE').length === 2
        && /CPL LEROY Emma/.test(document.getElementById('PAX-ENVOI-LISTE').textContent)), 'chef : « Envoyer aux participants » liste les 2 participants de la mise en route');
    const mails = await chef.$$('#PAX-ENVOI-LISTE .PAX-MAIL');
    await mails[0].fill(MAILS.PAX); await mails[1].fill('sanscompte.' + suffixe + '@interieur.gouv.fr');
    await chef.click('#BTN-PAX-ENVOYER'); await attendre(4000);
    const etats = await chef.$$eval('#PAX-ENVOI-LISTE .PAX-ETAT', l => l.map(e => e.className + ' | ' + e.textContent));
    verifier(/ok/.test(etats[0]) && /Envoyé/.test(etats[0]), 'chef : envoyé à LEROY (compte TRIGONE)');
    verifier(/ko/.test(etats[1]) && /Pas encore de compte TRIGONE/.test(etats[1]) && !/QR|WhatsApp/.test(etats[1]), 'chef : BERNARD sans compte TRIGONE → il doit se connecter à TRIGONE, puis renvoi');
    verifier(await chef.evaluate(m => MAILS_PAX()['LEROY EMMA'] === m, MAILS.PAX), 'chef : adresse du participant mémorisée pour la prochaine fois');
    // Participant : relève, boîte de réception, ouverture du compte-rendu prérempli.
    await pax.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    await pax.evaluate(() => SHOW_PAGE('RECEPTION')); await attendre(500);
    const carte = await pax.evaluate(() => (document.querySelector('.MER-RECU') || {}).textContent || '');
    verifier(/Mission collective/.test(carte) && /FORMATION SSIAP/.test(carte) && /ADJ TEST Chef/.test(carte), 'participant : « Mission collective — votre compte-rendu » dans la boîte de réception');
    await pax.click('.MER-RECU .BTN-PRIMARY'); await attendre(4000);
    verifier(/\/cr\//.test(pax.url()), 'participant : « Ouvrir mon compte-rendu » ouvre Compte-rendu');
    verifier(await pax.evaluate(m => M.IS_PAX === true && M.LIBELLE_MISSION === 'FORMATION SSIAP' && M.CHEF_MAIL === m && M.T_A === 'VF' && !!M.DEBUT, MAILS.CHEF),
        'participant : compte-rendu prérempli (mission, trajets, chef en copie)');
    verifier(await pax.evaluate(() => ['GRADE-USER-PAX', 'NOM-USER-PAX', 'PRENOM-USER-PAX', 'NID-USER-PAX', 'CIE-INPUT-PAX'].map(i => document.getElementById(i).value).join('|') === 'CPL|LEROY|Emma|06 798 765 43|' + M.CIE && M.CIE === '2CIE'),
        'participant : son identité (grade, nom, prénom, NID, compagnie) préremplie depuis la mise en route');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
