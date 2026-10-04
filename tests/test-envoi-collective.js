// Mission collective : le chef de mission envoie le compte-rendu prérempli dans la boîte TRIGONE de chaque participant
// (plus de QR code ni de WhatsApp) ; le participant le reçoit (boîte de réception) et l'ouvre dans Compte-rendu.
// Demande le serveur de test (TRIGONE_URL_BOITE), comme test-boite.js.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const MAILS = { CHEF: 'chefmission.' + suffixe + '@interieur.gouv.fr', PAX: 'participant.' + suffixe + '@interieur.gouv.fr', PAX2: 'participant2.' + suffixe + '@interieur.gouv.fr', C: 'chorus.' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        verifier(await p.evaluate(() => JUMELAGE_COMPTE_ACTIF()), nom + ' : compte TRIGONE actif');
        return p;
    }
    const pax = await appareil('PAX'), chef = await appareil('CHEF');
    // Matricule du profil déclaré au serveur : le chef retrouvera le compte de LEROY sans saisir son adresse.
    async function profilNid(p, matricule) {
        await p.evaluate(m => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs') || '{}'); r.matricule = m; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); JUMELAGE_MAJ_COMPTE(); }, matricule);
        await attendre(3000);
    }
    const NID = '06' + String(Date.now()).slice(-8);   // matricule propre à cette exécution (un matricule n'a qu'un compte)
    await profilNid(pax, NID);
    verifier(await pax.evaluate(([m, n]) => localStorage.getItem('trigone_nid_publie') === m + '|' + n, [MAILS.PAX, NID]), 'participant : matricule du profil déclaré à son compte TRIGONE');
    verifier(await chef.evaluate(n => fetch('api/nid', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: (c => 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton)(JSON.parse(localStorage.getItem('trigone_compte'))) },
        body: JSON.stringify({ nid: n }) }).then(r => r.status), NID) === 409, 'serveur : un matricule déjà pris par un autre compte est refusé');
    // Chef : compte-rendu de la mission collective (repris de la mise en route à 3 personnes).
    await chef.goto(URL + 'cr/'); await attendre(2500);
    await chef.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
    await chef.evaluate(NID => APPLIQUER_MISE_EN_ROUTE({ objet: 'FORMATION SSIAP', trajets: {
        aller: { moyen: 'FERREE', residenceDep: 'GARNISON', lieuDep: 'LIBOURNE', cpDep: '33500', lieuArr: 'PARIS', cpArr: '75014', dateDep: '2026-10-05T06:52', dateArr: '2026-10-05T09:28' },
        retour: { moyen: 'FERREE', residenceArr: 'GARNISON', lieuDep: 'PARIS', cpDep: '75014', lieuArr: 'LIBOURNE', cpArr: '33500', dateDep: '2026-10-07T17:04', dateArr: '2026-10-07T19:41' } },
        personnes: [{ grade: 'ADJ', nom: 'TEST', prenom: 'Chef', matricule: '067 12 34 567' }, { grade: 'CPL', nom: 'LEROY', prenom: 'Emma', matricule: NID, cie: '2CIE' }, { grade: 'SAP', nom: 'BERNARD', prenom: 'Hugo', matricule: '067 55 44 333' }] }), NID);
    await attendre(1200);
    await chef.evaluate(m => { M.CHEF_MAIL = m; M.DEBUT = '05/10/2026 06:30:00'; SAVE_STATE(); document.querySelectorAll('#MSG-OVERLAY').forEach(e => e.classList.add('HIDDEN')); }, MAILS.CHEF);
    await chef.evaluate(() => OUVRIR_ENVOI_PAX()); await attendre(400);
    verifier(await chef.evaluate(() => !document.getElementById('PAX-ENVOI-OVERLAY').classList.contains('HIDDEN') && document.querySelectorAll('#PAX-ENVOI-LISTE .PAX-LIGNE').length === 2
        && /CPL LEROY Emma/.test(document.getElementById('PAX-ENVOI-LISTE').textContent)), 'chef : « Envoyer aux participants » liste les 2 participants de la mise en route');
    await attendre(1500);
    const lignes = () => chef.$$eval('#PAX-ENVOI-LISTE .PAX-LIGNE', l => l.map(e => ({ mail: e.getAttribute('data-mail'), etat: e.querySelector('.PAX-ETAT').className + ' | ' + e.querySelector('.PAX-ETAT').textContent })));
    let l0 = await lignes();
    verifier(l0[0].mail === MAILS.PAX && /trouve/.test(l0[0].etat) && /retrouvé par son matricule/.test(l0[0].etat) && !(await chef.$('#PAX-ENVOI-LISTE input')),
        'chef : LEROY retrouvé par son matricule (compte TRIGONE), sans adresse à saisir');
    verifier(l0[1].mail === '' && /sans/.test(l0[1].etat) && /Pas de compte TRIGONE/.test(l0[1].etat), 'chef : BERNARD sans compte TRIGONE → signalé, il ne peut rien recevoir');
    // Participant ajouté à la main : par son matricule.
    await chef.evaluate(() => AJOUTER_LIGNE_PAX()); await chef.fill('#PAX-ENVOI-LISTE .PAX-NID', '123'); await chef.press('#PAX-ENVOI-LISTE .PAX-NID', 'Tab'); await attendre(300);
    verifier(/10 chiffres/.test((await lignes())[2].etat), 'chef : « + Ajouter un participant » refuse un matricule incomplet');
    await chef.fill('#PAX-ENVOI-LISTE .PAX-NID', NID); await chef.press('#PAX-ENVOI-LISTE .PAX-NID', 'Tab'); await attendre(1500);
    verifier((await lignes())[2].mail === MAILS.PAX, 'chef : « + Ajouter un participant » retrouve son compte par son matricule');
    await chef.evaluate(() => { const l = document.querySelectorAll('#PAX-ENVOI-LISTE .PAX-LIGNE'); l[2].remove(); });
    await chef.click('#BTN-PAX-ENVOYER'); await attendre(4000);
    l0 = await lignes();
    verifier(/ok/.test(l0[0].etat) && /Envoyé/.test(l0[0].etat), 'chef : envoyé à LEROY (compte TRIGONE)');
    verifier(/sans/.test(l0[1].etat) && !/Envoi/.test(l0[1].etat), 'chef : rien n\'est envoyé à BERNARD (pas de compte)');
    // Participant : relève, boîte de réception, ouverture du compte-rendu prérempli.
    await pax.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    await pax.evaluate(() => SHOW_PAGE('RECEPTION')); await attendre(500);
    verifier(await pax.evaluate(() => { const d = document.querySelector('.MER-DOSSIER[data-dossier="collective"]'); return !!d && d.classList.contains('nouveau') && d.querySelector('.MER-DOSSIER-NB').textContent === '1'; }),
        'participant : dossier jaune « Missions collectives » avec « 1 » en rouge');
    await pax.click('.MER-DOSSIER[data-dossier="collective"]'); await attendre(400);
    await pax.locator('.MER-BX-LIGNE').first().click(); await attendre(400);
    const carte = await pax.evaluate(() => (document.querySelector('.MER-RECU') || {}).textContent || '');
    verifier(/Mission collective/.test(carte) && /FORMATION SSIAP/.test(carte) && /ADJ TEST Chef/.test(carte), 'participant : « Mission collective — votre compte-rendu » dans la boîte de réception');
    await pax.click('.MER-RECU .BTN-PRIMARY'); await attendre(4000);
    verifier(/\/cr\//.test(pax.url()), 'participant : « Ouvrir mon compte-rendu » ouvre Compte-rendu');
    verifier(await pax.evaluate(m => M.IS_PAX === true && M.LIBELLE_MISSION === 'FORMATION SSIAP' && M.CHEF_MAIL === m && M.T_A === 'VF' && !!M.DEBUT, MAILS.CHEF),
        'participant : compte-rendu prérempli (mission, trajets, chef en copie)');
    verifier(await pax.evaluate(n => ['GRADE-USER-PAX', 'NOM-USER-PAX', 'PRENOM-USER-PAX', 'NID-USER-PAX', 'CIE-INPUT-PAX'].map(i => document.getElementById(i).value).join('|') === 'CPL|LEROY|Emma|' + n + '|' + M.CIE && M.CIE === '2CIE',
        [NID.slice(0, 2), NID.slice(2, 5), NID.slice(5, 8), NID.slice(8)].join(' ')),
        'participant : son identité (grade, nom, prénom, NID, compagnie) préremplie depuis la mise en route');
    // Suivi de l'équipe : le participant envoie son compte-rendu (avec la référence de la mission) → le chef le voit ;
    // un 2e participant ne l'a pas fait → « Relancer » lui envoie un rappel (une fois par 12 h).
    const ref = await chef.evaluate(() => M.EQUIPE_REF);
    verifier(/^eq/.test(ref) && await pax.evaluate(r => M.EQUIPE_REF === r, ref), 'la référence de la mission collective arrive chez le participant');
    const codeChorus = process.env.TRIGONE_CODE_CHORUS;
    if (codeChorus) {
        const c = await appareil('C'), pax2 = await appareil('PAX2');
        await c.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(500);
        await c.check('#JUM-R-CHORUS'); await c.fill('#JUM-R-CODECHORUS', codeChorus); await c.click('.JUM-R-PRINCIPAL'); await attendre(3000);
        await chef.evaluate(([m, r]) => JUMELAGE_ENVOYER_DIRECT(m, 'COLLECTIVE', 'Mission collective.json', JSON.stringify({ app: 'TRIGONE-COLLECTIVE', chef: 'ADJ TEST Chef', libelle: 'FORMATION SSIAP' }), { equipe: r }), [MAILS.PAX2, ref]);
        await pax.evaluate(([m, r]) => JUMELAGE_ENVOYER_DIRECT(m, 'CR', 'CR.pdf', JSON.stringify({ app: 'TRIGONE-CR', missionnaire: 'CPL LEROY Emma', libelle: 'FORMATION SSIAP', fichiers: [], equipe: M.EQUIPE_REF, roleEquipe: 'participant' }), { equipe: M.EQUIPE_REF }), [MAILS.C, ref]);
        await attendre(1500);
        const eq = await chef.evaluate(r => JUMELAGE_EQUIPE(r), ref);
        const e1 = eq.find(x => x.mail === MAILS.PAX), e2 = eq.find(x => x.mail === MAILS.PAX2);
        verifier(eq.length === 2 && e1 && e1.envoye > 0 && e2 && !e2.envoye, 'chef : LEROY a envoyé son compte-rendu, le 2e participant pas encore');
        await chef.evaluate(() => { document.querySelectorAll('#MSG-OVERLAY').forEach(e => e.classList.add('HIDDEN')); OUVRIR_SUIVI_EQUIPE(); }); await attendre(1500);
        const vue = await chef.evaluate(() => document.getElementById('EQUIPE-LISTE').innerText + '|' + document.getElementById('BTN-EQUIPE-RELANCER').textContent);
        verifier(/CPL LEROY Emma/.test(vue) && /Envoyé le/.test(vue) && /Pas encore envoyé/.test(vue) && /Relancer les retardataires \(1\)/.test(vue), 'chef : « Suivi de l\'équipe » (✅ envoyé / ⏳ pas encore, Relancer (1))');
        const n1 = await chef.evaluate(r => JUMELAGE_EQUIPE_RELANCER(r, 'FORMATION SSIAP'), ref), n2 = await chef.evaluate(r => JUMELAGE_EQUIPE_RELANCER(r, 'FORMATION SSIAP'), ref);
        verifier(n1 === 1 && n2 === 0, 'relance : le retardataire est relancé, pas deux fois de suite (12 h)');
        const autre = await pax.evaluate(r => JUMELAGE_EQUIPE(r).then(l => l.length), ref);
        verifier(autre === 0, 'le suivi de l\'équipe n\'est visible que du chef de mission (et de l\'assistant Chorus DT qui reçoit un compte-rendu de la mission)');
        // Le chef envoie son compte-rendu à l'assistant Chorus DT : celui-ci voit la chronologie de l'équipe.
        await chef.evaluate(([m, r]) => JUMELAGE_ENVOYER_DIRECT(m, 'CR', 'CR.pdf', JSON.stringify({ app: 'TRIGONE-CR', missionnaire: 'ADJ TEST Chef', libelle: 'FORMATION SSIAP',
            fichiers: [{ nom: 'CR.pdf', type: 'application/pdf', b64: btoa('%PDF-1.4 test') }], equipe: r, roleEquipe: 'chef',
            participants: M.PARTICIPANTS.map(p => ({ nom: [p.grade, p.nom, p.prenom].join(' '), mail: (p.mail || '').toLowerCase() })) }), { equipe: r }), [MAILS.C, ref]);
        await attendre(1200);
        await c.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
        const idChef = await c.evaluate(() => (JUMELAGE_BOITE_LISTE().find(x => x.nature === 'cr' && x.roleEquipe === 'chef') || {}).id);
        verifier(!!idChef, 'assistant Chorus DT : compte-rendu du chef reçu, marqué « mission collective »');
        await c.evaluate(id => OUVRIR_CR_RECU(id), idChef); await attendre(3000);
        const chrono = await c.evaluate(() => (document.getElementById('MER-CR-EQUIPE') || {}).innerText || '');
        if (process.env.CAPTURES) await c.screenshot({ path: process.env.CAPTURES + '/chorus-equipe.png', fullPage: false });
        verifier(/1 sur 2/.test(chrono) && /CPL LEROY Emma/.test(chrono) && /reçu le/.test(chrono) && /dans votre boîte/.test(chrono) && /En attente — transmis par le chef/.test(chrono) && /relancé le/.test(chrono),
            'assistant Chorus DT : chronologie de l\'équipe (1 sur 2 reçus, LEROY reçu et dans sa boîte, l\'autre en attente, relancé)');
        // Fenêtre « Suivi de l'équipe » restée ouverte : le compte-rendu du 2e participant y apparaît tout seul.
        await chef.evaluate(() => { document.querySelectorAll('#MSG-OVERLAY').forEach(e => e.classList.add('HIDDEN')); OUVRIR_SUIVI_EQUIPE(); }); await attendre(1500);
        await pax2.evaluate(([m, r]) => JUMELAGE_ENVOYER_DIRECT(m, 'CR', 'CR.pdf', JSON.stringify({ app: 'TRIGONE-CR', missionnaire: 'SGT PAX Deux', libelle: 'FORMATION SSIAP', fichiers: [], equipe: r, roleEquipe: 'participant' }), { equipe: r }), [MAILS.C, ref]);
        await attendre(12000);
        verifier(/Toute l'équipe a envoyé le sien/.test(await chef.evaluate(() => document.getElementById('EQUIPE-LISTE').innerText)), 'suivi de l\'équipe ouvert : mis à jour tout seul (sans rafraîchir)');
    }
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
