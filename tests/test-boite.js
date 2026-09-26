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
        await attendre(800);
        if (nom === 'M') verifier(await p.isVisible('#JUM-C-NOTIF'), 'après activation : « Activer les notifications » proposé');
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        return p;
    }
    async function connecter(p, code, nom) {
        await p.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(800);
        await p.fill('#MER-VAL-grade', 'CNE'); await p.fill('#MER-VAL-fonction', 'Chef'); await p.fill('#MER-VAL-nom', nom || 'Dupont'); await p.fill('#MER-VAL-prenom', 'Jean');
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

    // Rôles : le 1er valideur coche son rôle dans Réglages › Mes rôles (avec son code) ; le 2e se connecte à l'Espace valideur.
    await v1.evaluate(() => JUMELAGE_REGLAGES()); await attendre(400);
    await v1.check('#JUM-R-VAL1'); await attendre(200);
    verifier(await v1.isVisible('#JUM-R-CODEVAL1') && await v1.isVisible('#JUM-R-FONCTION'), 'Réglages › Mes rôles : 1er valideur coché → code et fonction demandés');
    await v1.fill('#JUM-R-FONCTION', 'Chef de service'); await v1.fill('#JUM-R-CODEVAL1', 'MAUVAIS'); await v1.click('.JUM-R-PRINCIPAL'); await attendre(3000);
    verifier((await v1.textContent('#JUM-R-ERREUR')).includes('incorrect'), 'Mes rôles : un mauvais code valideur ne donne pas le rôle');
    await v1.fill('#JUM-R-CODEVAL1', code2); await v1.click('.JUM-R-PRINCIPAL'); await attendre(3000);
    verifier((await v1.textContent('#JUM-R-ERREUR')).includes('incorrect'), 'Mes rôles : le code du 2e valideur ne donne pas le rôle de 1er valideur');
    // Une même personne peut cumuler VALIDEUR 1 et VALIDEUR 2 (et ASSIST CHORUS DT).
    await v1.check('#JUM-R-VAL2'); await v1.fill('#JUM-R-CODEVAL2', code2);
    await v1.fill('#JUM-R-CODEVAL1', code1); await v1.click('.JUM-R-PRINCIPAL'); await attendre(6000);
    verifier(await v1.evaluate(() => { const r = JSON.parse(localStorage.getItem('trigone_roles_locaux')); return !document.querySelector('.JUM-REGLAGES') && r.valideur1 === true && r.valideur2 === true; }),
        'Mes rôles : VALIDEUR 1 et VALIDEUR 2 activés ensemble, chacun avec son code');
    await v1.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(2500);
    verifier(await v1.evaluate(() => { const h = HABILITATION_COURANTE(); return !!h && h.role === 1 && h.fonction === 'CHEF DE SERVICE'; }), 'Mes rôles : l\'Espace valideur est connecté d\'office (VALIDEUR 1)');
    verifier(await v1.locator('.MER-BASCULE-ROLE button').count() === 2, 'deux rôles valideur : bascule VALIDEUR 1 / VALIDEUR 2 affichée');
    await v1.click('.MER-BASCULE-ROLE button:has-text("VALIDEUR 2")'); await attendre(1500);
    verifier(await v1.evaluate(() => HABILITATION_COURANTE().role === 2), 'bascule : passage en VALIDEUR 2 sans ressaisir de code');
    await v1.click('.MER-BASCULE-ROLE button:has-text("VALIDEUR 1")'); await attendre(1500);
    await connecter(v2, code2, 'Martin'); await attendre(1500);
    const codeChorus = process.env.TRIGONE_CODE_CHORUS;
    if (codeChorus) {
        await c.evaluate(() => JUMELAGE_REGLAGES()); await attendre(400);
        await c.check('#JUM-R-CHORUS'); await c.fill('#JUM-R-CODECHORUS', 'MAUVAIS'); await c.click('.JUM-R-PRINCIPAL'); await attendre(600);
        verifier((await c.textContent('#JUM-R-ERREUR')).includes('incorrect'), 'Chorus DT : un mauvais code ne donne pas le rôle');
        await c.fill('#JUM-R-CODECHORUS', codeChorus); await c.click('.JUM-R-PRINCIPAL'); await attendre(1500);
    } else { await c.evaluate(() => { localStorage.setItem('trigone_role_chorus', '1'); JUMELAGE_DECLARER_ROLE('chorus', true); }); await attendre(1500); }
    verifier(await c.evaluate(() => JUMELAGE_ROLE_CHORUS()), 'Chorus DT : rôle actif');

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
    // Règle des boîtes : une demande ne peut pas partir vers le 2e valideur ni vers l'assistant Chorus DT
    for (const [qui, adr] of [['2e valideur', MAILS.V2], ['assistant Chorus DT', MAILS.C]]) {
        await m.evaluate(a => { const r = GET_REGLAGES(); r.mailSignataire = a; SAVE_REGLAGES(r); SHOW_PAGE('PANIER'); }, adr); await attendre(300);
        await m.click('text=Envoyer mes documents'); await attendre(500); await m.click('#MER-BTN-DIRECT'); await attendre(2500);
        verifier((await m.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Mauvais destinataire', 'règle des boîtes : une demande de missionnaire est refusée par la boîte du ' + qui);
        await m.evaluate(() => { FERMER_MSG(); FERMER_MODALE(); }); await attendre(400);
    }
    await m.evaluate(() => SHOW_PAGE('PANIER')); await attendre(300);
    // Destinataire sans compte TRIGONE : envoi bloqué, la demande reste dans Documents.
    await m.fill('#MER-MAIL-DEST', 'personne.' + suffixe + '@interieur.gouv.fr');
    await m.click('text=Envoyer mes documents'); await attendre(500); await m.click('#MER-BTN-DIRECT'); await attendre(2500);
    verifier((await m.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Pas encore de compte TRIGONE' && await m.evaluate(() => GET_PANIER().length === 2),
        'destinataire sans compte : envoi bloqué, les demandes restent dans Documents');
    await m.evaluate(() => { FERMER_MSG(); FERMER_MODALE(); SHOW_PAGE('PANIER'); }); await attendre(400);
    await m.fill('#MER-MAIL-DEST', MAILS.V1);
    await m.click('text=Envoyer mes documents'); await attendre(500);
    verifier(await m.isVisible('#MER-BTN-DIRECT'), 'demandeur : bouton « Envoyer » (boîte TRIGONE)');
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
    await v1.evaluate(() => { MER_CLE_SESSION = null; MER_ACCES_SESSION = null; return Promise.all(['valideur', 'valideur1', 'valideur2'].map(k => ACCES_MEMO('effacer', null, k))); });
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
    const boutons = await v1.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').count();
    verifier(boutons === 2, '1er valideur : 2 envois proposés (2e valideur + refus au demandeur)');
    for (let i = 0; i < boutons; i++) { await v1.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').first().click(); await attendre(3000); }
    verifier(await v1.locator('#MER-MODALE-FOND >> text=Arrivé dans le TRIGONE').count() === 2, '1er valideur : les 2 envois sont arrivés');
    await v1.click('#MER-MODALE-FOND button:has-text("Terminé")'); await attendre(800);
    verifier(await v1.evaluate(() => JUMELAGE_BOITE_NB() === 0 && JUMELAGE_BOITE_LISTE()[0].statut === 'traite'), '1er valideur : l\'envoi passe en « Traitées » dans la boîte');

    // Demandeur : le refus revient dans Documents
    await relever(m);
    await ouvrirBoite(m);
    verifier(await m.evaluate(() => GET_PANIER().some(d => d.refus && d.refus.motif === 'Merci de joindre la DAF')), 'demandeur : la demande refusée revient dans Documents, avec le motif');

    // Notifications : l'abonnement de l'appareil est enregistré ; un service de notification injoignable ne bloque pas les envois.
    const abonne = await v1.evaluate(async () => {
        const c = JSON.parse(localStorage.getItem('trigone_compte')), h = { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton, 'Content-Type': 'application/json' };
        const cle = await (await fetch('api/push/cle')).json();
        const r = await (await fetch('api/push', { method: 'POST', headers: h, body: JSON.stringify({ abonnement: { endpoint: 'https://push.invalid/trigone-test', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } } }) })).json();
        return cle.ok && cle.cle.length > 80 && r.ok;
    });
    verifier(abonne, 'notifications : clé VAPID du serveur et abonnement de l\'appareil enregistré');

    // 2e valideur : renvoie la demande au VALIDEUR 1, avec un motif
    await relever(v2);
    await ouvrirBoite(v2);
    verifier(await v2.evaluate(() => GET_A_VALIDER().length) === 1, '2e valideur : la demande validée par le 1er valideur arrive');
    await v2.evaluate(() => DEMANDER_REFUS(GET_A_VALIDER()[0].id)); await attendre(600);
    verifier(await v2.locator('input[name="MER-RENVOI"]').count() === 2, '2e valideur : choix « renvoyer au VALIDEUR 1 » ou « au demandeur »');
    await v2.fill('#MER-MOTIF-REFUS', 'Préciser le lieu du stage'); await v2.click('#MER-MODALE-FOND button:has-text("Renvoyer")'); await attendre(800);
    verifier(await v2.evaluate(() => GET_A_VALIDER()[0].decision === 'RENVOYEE'), '2e valideur : demande renvoyée au VALIDEUR 1');
    await v2.evaluate(() => PREPARER_TRANSMISSION()); await attendre(600);
    await v2.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').first().click(); await attendre(3500);
    verifier(await v2.locator('#MER-MODALE-FOND >> text=Arrivé dans le TRIGONE').count() === 1, '2e valideur : renvoi arrivé chez le VALIDEUR 1 (malgré un service de notification injoignable)');
    await v2.click('#MER-MODALE-FOND button:has-text("Terminé")'); await attendre(800);

    // 1er valideur : reçoit le renvoi, corrige à son niveau, revalide
    await relever(v1);
    verifier(await v1.evaluate(() => JUMELAGE_BOITE_LISTE().some(x => x.nature === 'renvoi' && x.statut === 'nouveau')), '1er valideur : « Renvoyée par le VALIDEUR 2 » dans sa boîte');
    await ouvrirBoite(v1);
    const carteRenvoi = await v1.evaluate(() => document.getElementById('PAGE-STAGE').innerText);
    verifier(carteRenvoi.includes('Renvoyée par le VALIDEUR 2') && carteRenvoi.includes('Préciser le lieu du stage'), '1er valideur : motif du VALIDEUR 2 affiché');
    await v1.evaluate(() => { const e = GET_A_VALIDER().find(x => x.d.renvoi); CORRIGER_PAR_VALIDEUR(e.id); }); await attendre(800);
    verifier((await v1.textContent('h2')).includes('Correction'), '1er valideur : « ✎ Corriger » ouvre la demande en correction');
    await v1.evaluate(() => { D.objet = 'Stage Bouquet — Paris 1er'; MER_ACTIVE_TAB = 'IMPUTATION'; AJOUTER_AU_PANIER(); }); await attendre(1200);
    await v1.evaluate(() => FERMER_MSG()); await attendre(300);
    verifier(await v1.evaluate(() => { const e = GET_A_VALIDER().find(x => x.d.renvoi); return e && e.corrigee && e.d.objet === 'Stage Bouquet — Paris 1er' && GET_PANIER().length === 0; }),
        '1er valideur : correction enregistrée dans l\'Espace valideur (pas dans ses Documents)');
    await v1.evaluate(() => VALIDER_DEMANDES([GET_A_VALIDER().find(x => x.d.renvoi).id])); await attendre(1500);
    await v1.evaluate(() => PREPARER_TRANSMISSION()); await attendre(600);
    await v1.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').first().click(); await attendre(3500);
    await v1.click('#MER-MODALE-FOND button:has-text("Terminé")'); await attendre(800);

    // 2e valideur : reçoit la demande corrigée et la valide
    await relever(v2);
    await ouvrirBoite(v2);
    verifier(await v2.evaluate(() => GET_A_VALIDER().length === 1 && GET_A_VALIDER()[0].d.objet === 'Stage Bouquet — Paris 1er'), '2e valideur : la demande corrigée revient');
    await v2.evaluate(() => VALIDER_DEMANDES([GET_A_VALIDER()[0].id])); await attendre(1500);
    await v2.evaluate(v => SET_MAIL_VALIDEUR('mailChorus', v), MAILS.C);
    await v2.evaluate(() => PREPARER_TRANSMISSION()); await attendre(600);
    await v2.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').first().click(); await attendre(3500);
    verifier(await v2.locator('#MER-MODALE-FOND >> text=Arrivé dans le TRIGONE').count() === 1, '2e valideur : envoi direct à l\'assistant Chorus DT');

    // Assistant Chorus DT

    await relever(c);
    await c.evaluate(() => { document.querySelectorAll('.JUM-CHOIX').forEach(e => e.remove()); JUMELAGE_CHOIX(); }); await attendre(600);
    verifier(await c.evaluate(() => !!document.querySelector('.JUM-CHORUS') && document.querySelector('.JUM-CHORUS-NB').textContent === '1'), 'Chorus DT : logo au centre de l\'écran de choix, pastille « 1 »');
    await c.evaluate(() => { const n = document.querySelector('.JUM-NOUV button'); if (n) n.click(); }); await attendre(300);
    await c.click('.JUM-CHORUS'); await attendre(1500);
    verifier(await c.evaluate(() => PAGE_ACTUELLE) === 'CHORUS', 'Chorus DT : le logo ouvre l\'espace Assistant Chorus DT');
    await c.locator('.MER-RECU .BTN-PRIMARY').first().click(); await attendre(2500);
    const cartes = await c.locator('.MER-PANIER-ITEM').allInnerTexts();
    verifier(await c.evaluate(() => PAGE_ACTUELLE) === 'CHORUS' && cartes.some(t => t.includes('Conforme : validée par les deux valideurs')),
        'assistant Chorus DT : la demande arrive, conforme (signatures et NDS vérifiées)');
    // L'assistant Chorus DT renvoie directement au demandeur, avec un commentaire
    await c.locator('button:has-text("Renvoyer au demandeur")').first().click(); await attendre(500);
    await c.fill('#MER-MOTIF-CHORUS', 'Code FD à revoir'); await c.click('#MER-MODALE-FOND button:has-text("Renvoyer")'); await attendre(3500);
    verifier((await c.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Demande renvoyée', 'Chorus DT : demande renvoyée au demandeur');
    await c.evaluate(() => FERMER_MSG());
    await m.evaluate(() => FERMER_MSG()); await attendre(400);
    await relever(m); await ouvrirBoite(m);
    verifier(await m.evaluate(() => GET_PANIER().some(d => d.refus && d.refus.niveau === 3 && d.refus.motif === 'Code FD à revoir')), 'demandeur : la demande renvoyée par l\'ASSIST CHORUS DT revient dans Documents, avec le commentaire');
    verifier((await m.textContent('#PAGE-STAGE')).includes('ASSIST CHORUS DT'), 'demandeur : Documents indique « Refusée par l\'ASSIST CHORUS DT »');

    // Compte-rendu de fin de mission : le missionnaire l'envoie (PDF + justificatif) à l'assistant Chorus DT.
    await m.goto(URL + 'cr/'); await attendre(3000);
    const envoyerCr = async dest => {
        await m.evaluate(d => JUMELAGE_ENVOYER_CR({ destinataire: d, missionnaire: 'ADJ BOUQUET GP', libelle: 'Stage Bouquet', dates: '01/10/2026 → 03/10/2026',
            corps: 'Bonjour', pieces: ['FACTURE HÔTEL'], pdf: () => ({ nom: 'CR_MISSION_BOUQUET.pdf', blob: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }) }),
            succes: () => { window.__crEnvoye = true; } }), dest); await attendre(400);
        await m.setInputFiles('#JUM-CR-FICHIERS', path.join(FICHIERS, 'nds_test.pdf')); await attendre(500);
        await m.click('#JUM-CR-ENVOYER'); await attendre(3000);
    };
    await envoyerCr(MAILS.V1);
    verifier((await m.textContent('#JUM-CR-ERR')).includes('assistant Chorus DT'), 'compte-rendu : refusé par la boîte d\'un valideur (réservé à l\'assistant Chorus DT)');
    await m.evaluate(() => JUMELAGE_FERMER_ENVOI_CR());
    await envoyerCr(MAILS.C);
    verifier(await m.evaluate(() => window.__crEnvoye === true && !document.querySelector('.JUM-REGLAGES')), 'compte-rendu : envoyé à l\'assistant Chorus DT');
    await relever(c); await c.evaluate(() => SHOW_PAGE('CHORUS')); await attendre(600);
    verifier((await c.textContent('#PAGE-STAGE')).includes('ADJ BOUQUET GP'), 'Chorus DT : le compte-rendu arrive dans la section « Comptes-rendus de mission »');
    await c.locator('.MER-RECU:has(.MER-RECU-cr) .BTN-PRIMARY').click(); await attendre(1200);
    const dl = c.waitForEvent('download');
    await c.locator('#MER-MODALE-FOND button:has-text("Télécharger")').nth(1).click();
    verifier((await dl).suggestedFilename() === 'nds_test.pdf', 'Chorus DT : le justificatif se télécharge');
    await c.click('#MER-MODALE-FOND button:has-text("Traité")'); await attendre(500);
    verifier(await c.evaluate(() => JUMELAGE_BOITE_LISTE().filter(x => x.nature === 'cr').every(x => x.statut === 'traite')), 'Chorus DT : compte-rendu marqué « traité »');

    // Boîtes vides après relève
    const reste = await v1.evaluate(async () => { const c = JSON.parse(localStorage.getItem('trigone_compte'));
        return (await (await fetch('api/boite', { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton } })).json()).envois.length; });
    verifier(reste === 0, 'serveur : envois supprimés dès leur réception');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' — ' + erreurs.join(' | ') : ''));
    await b.close();
};
