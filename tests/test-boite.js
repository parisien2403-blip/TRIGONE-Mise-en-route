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

    const MAILS_M = MAILS.M;
    // Première ouverture d'un appareil neuf : présentation, puis « Se connecter » proposé (refermable) ; plus de réglages imposés.
    {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }); const f = await ctx.newPage();
        f.on('pageerror', e => erreurs.push('neuf : ' + e.message));
        await f.goto(URL); await attendre(3500);
        await f.click('.JUM-PRES-BTN'); await attendre(1200);
        verifier(await f.isVisible('.JUM-CONNEXION #JUM-C-MAIL') && (await f.textContent('.JUM-CX-ONGLETS')).includes('autre appareil') && !(await f.$('.JUM-REGLAGES:not(.JUM-CONNEXION)')),
            'première ouverture : « Se connecter » proposé (mail ou code de liaison), sans réglages imposés');
        await f.click('#JUM-C-PLUSTARD'); await attendre(600);
        verifier(!(await f.$('.JUM-REGLAGES')) && (await f.textContent('.JUM-CHOIX .JUM-CPT')).includes('Se connecter'),
            'première ouverture : « Plus tard » → écran d\'accueil libre, « Se connecter » en haut à droite');
        await f.reload(); await attendre(3500);
        verifier(!(await f.$('.JUM-REGLAGES')), 'réouverture : la connexion n\'est plus imposée');
        await ctx.close();
    }
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
        if (nom === 'M') {
            // Bouton de compte (accueil de l'appli) : pastille « grade nom », menu du compte.
            await p.evaluate(() => SHOW_PAGE('ACCUEIL')); await attendre(300);
            verifier(await p.evaluate(() => { const b = document.querySelector('.JUM-CPT-APPLI'); return !!b && !b.classList.contains('deconnecte') && b.textContent.includes('ADJ TEST'); }),
                'bouton de compte : connecté, « ADJ TEST » affiché');
            await p.click('.JUM-CPT-APPLI'); await attendre(400);
            const menu = await p.evaluate(() => (document.querySelector('.JUM-CPT-MENU') || {}).textContent || '');
            verifier(['Paramètres', 'Se déconnecter'].every(t => menu.includes(t)) && !menu.includes('Sauvegarder') && menu.includes(MAILS_M) && (await p.$$('.JUM-CPT-MENU button')).length === 2,
                'menu du compte : Paramètres et Se déconnecter seulement (pas de doublon avec la page Paramètres)');
            // Paramètres : toutes les rubriques, une page rangée.
            await p.click('.JUM-CPT-MENU [data-action="parametres"]'); await attendre(400);
            let tout = '';
            for (const r of await p.$$eval('.JUM-PARAM-NAV [data-rub]', l => l.map(x => x.getAttribute('data-rub')))) { await p.click('.JUM-PARAM-NAV [data-rub="' + r + '"]'); await attendre(100); tout += await p.textContent('.JUM-PARAM-CONTENU'); }
            verifier(['Mes rôles', 'Notifications', 'Ajouter un appareil', 'Notice', 'Références', 'Signaler un problème', 'Sauvegarder mes données', 'Réinitialiser TRIGONE', 'Partager TRIGONE'].every(t => tout.includes(t)),
                'Paramètres : compte, notifications, appareils, notice, références, signalement, sauvegarde, réinitialisation, partage');
            await p.evaluate(() => JUMELAGE_FERMER_PARAMETRES());
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
    async function relever(p) { await p.evaluate(() => JUMELAGE_RELEVER()); await attendre(2500); }
    // Suivi (tenu par le serveur) des demandes et comptes-rendus du compte de cette page : { ref: { genre, etape, etapes } }.
    async function suivi(p) { await attendre(1200); return p.evaluate(() => JUMELAGE_SUIVI_ACTUALISER()); }
    // Boîte de réception : bouton « Ouvrir… » du premier envoi à traiter.
    // Boîte de réception en dossiers : le dossier qui a quelque chose à traiter, puis le premier envoi.
    async function ouvrirBoite(p) {
        await p.evaluate(() => { MER_DOSSIER.RECEPTION = null; SHOW_PAGE('RECEPTION'); }); await attendre(400);
        await p.locator('.MER-DOSSIER:not(.vide)').first().click(); await attendre(400);
        await p.locator('.MER-RECU .BTN-PRIMARY').first().click(); await attendre(2500);
    }

    // Adresse non professionnelle refusée
    const x = await b.newPage(); await x.goto(URL); await x.evaluate(preparer, APP_CODE); await x.reload(); await attendre(2000);
    await x.evaluate(() => JUMELAGE_COMPTE()); await attendre(400);
    await x.fill('#JUM-C-MAIL', 'quelquun@gmail.com'); await x.click('#JUM-C-ENVOI'); await attendre(1200);
    verifier((await x.textContent('#JUM-C-ERR')).includes('professionnelles'), 'adresse non professionnelle refusée');

    const m = await appareil('M'), v1 = await appareil('V1'), v2 = await appareil('V2'), c = await appareil('C');

    // Rôles : le 1er valideur coche son rôle dans Réglages › Mes rôles (avec son code) ; le 2e se connecte à l'Espace valideur.
    await v1.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(400);
    verifier(await v1.evaluate(() => !document.getElementById('JUM-R-NOM').offsetParent && !!document.getElementById('JUM-R-VAL1').offsetParent), '« Mes rôles » : les rôles seuls, sans l\'identité');
    await v1.check('#JUM-R-VAL1'); await attendre(200);
    verifier(await v1.isVisible('#JUM-R-CODEVAL1') && await v1.isVisible('#JUM-R-FONCTION1'), 'Réglages › Mes rôles : 1er valideur coché → code et fonction demandés');
    await v1.fill('#JUM-R-FONCTION1', 'Chef de service'); await v1.fill('#JUM-R-CODEVAL1', 'MAUVAIS'); await v1.click('.JUM-R-PRINCIPAL'); await attendre(3000);
    verifier((await v1.textContent('#JUM-R-ERREUR')).includes('incorrect'), 'Mes rôles : un mauvais code valideur ne donne pas le rôle');
    await v1.fill('#JUM-R-CODEVAL1', code2); await v1.click('.JUM-R-PRINCIPAL'); await attendre(3000);
    verifier((await v1.textContent('#JUM-R-ERREUR')).includes('incorrect'), 'Mes rôles : le code du 2e valideur ne donne pas le rôle de 1er valideur');
    // Une même personne peut cumuler VALIDEUR 1 et VALIDEUR 2 (et ASSIST CHORUS DT).
    await v1.check('#JUM-R-VAL2'); await v1.fill('#JUM-R-CODEVAL2', code2); await v1.fill('#JUM-R-FONCTION2', 'Chef de corps');
    await v1.fill('#JUM-R-CODEVAL1', code1); await v1.click('.JUM-R-PRINCIPAL'); await attendre(6000);
    verifier(await v1.evaluate(() => { const r = JSON.parse(localStorage.getItem('trigone_roles_locaux')); return !document.querySelector('.JUM-REGLAGES') && r.valideur1 === true && r.valideur2 === true; }),
        'Mes rôles : VALIDEUR 1 et VALIDEUR 2 activés ensemble, chacun avec son code');
    await v1.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(2500);
    verifier(await v1.evaluate(() => { const h = HABILITATION_COURANTE(); return !!h && h.role === 1 && h.fonction === 'CHEF DE SERVICE'; }), 'Mes rôles : l\'Espace valideur est connecté d\'office (VALIDEUR 1)');
    verifier(await v1.locator('.MER-BASCULE-ROLE button').count() === 2, 'deux rôles valideur : bascule VALIDEUR 1 / VALIDEUR 2 affichée');
    await v1.click('.MER-BASCULE-ROLE button:has-text("VALIDEUR 2")'); await attendre(1500);
    verifier(await v1.evaluate(() => HABILITATION_COURANTE().role === 2 && HABILITATION_COURANTE().fonction === 'CHEF DE CORPS'), 'bascule : passage en VALIDEUR 2 sans ressaisir de code, avec sa fonction (CHEF DE CORPS)');
    await v1.click('.MER-BASCULE-ROLE button:has-text("VALIDEUR 1")'); await attendre(1500);
    // Rôle coché sur l'appareil mais perdu côté serveur (ex. compte réactivé) : TRIGONE le redéclare à l'ouverture.
    const rolesServeur = p => p.evaluate(async () => {
        const c = JSON.parse(localStorage.getItem('trigone_compte')), h = { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton, 'Content-Type': 'application/json' };
        return (await (await fetch('api/cles?mail=' + encodeURIComponent(c.mail), { headers: h })).json()).roles;
    });
    await v1.evaluate(async () => {
        const c = JSON.parse(localStorage.getItem('trigone_compte')), h = { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton, 'Content-Type': 'application/json' };
        await fetch('api/role', { method: 'POST', headers: h, body: JSON.stringify({ role: 'valideur1', actif: false }) });
    });
    verifier(!(await rolesServeur(v1)).valideur1, 'rôle VALIDEUR 1 retiré côté serveur seulement (simulation)');
    await v1.reload(); await attendre(4500);
    verifier(!!(await rolesServeur(v1)).valideur1, 'rôle VALIDEUR 1 redéclaré automatiquement à l\'ouverture de TRIGONE');
    await v1.evaluate(() => { const n = document.querySelector('.JUM-CHOIX'); if (n) n.remove(); document.documentElement.classList.remove('jum-choix'); });
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
    verifier(await v1.evaluate(() => JUMELAGE_BOITE_NB()) === 2, '1er valideur : l\'envoi arrive dans la boîte de réception (compté 2 : il contient 2 demandes)');
    await v1.evaluate(() => SHOW_PAGE('ACCUEIL')); await attendre(300);
    verifier((await v1.textContent('.BTN-ACCUEIL-BOITE')).includes('2'), '1er valideur : pastille « 2 » (deux demandes) sur le bouton Boîte de réception de l\'accueil');
    await v1.evaluate(() => { MER_CLE_SESSION = null; MER_ACCES_SESSION = null; return Promise.all(['valideur', 'valideur1', 'valideur2'].map(k => ACCES_MEMO('effacer', null, k))); });
    await ouvrirBoite(v1);
    verifier((await v1.evaluate(() => document.getElementById('MSG-TITRE').textContent)) === 'Rôle valideur à activer', '1er valideur sans sa clé : « Ouvrir » propose d\'activer le rôle (Mes rôles)');
    await v1.click('#MSG-OVERLAY button:has-text("Activer mon rôle")'); await attendre(900);
    verifier(await v1.evaluate(() => !!document.querySelector('.JUM-REGLAGES') && !document.getElementById('JUM-R-VAL1').checked), 'Mes rôles s\'ouvre, rôle VALIDEUR 1 à recocher avec son code');
    await v1.check('#JUM-R-VAL1'); await v1.fill('#JUM-R-FONCTION1', 'Chef'); await v1.fill('#JUM-R-CODEVAL1', code1);
    // Il avait aussi le rôle VALIDEUR 2 : il le recoche avec son code.
    if (!(await v1.isChecked('#JUM-R-VAL2'))) { await v1.check('#JUM-R-VAL2'); await v1.fill('#JUM-R-FONCTION2', 'Chef de corps'); await v1.fill('#JUM-R-CODEVAL2', code2); }
    await v1.click('.JUM-R-PRINCIPAL'); await attendre(1500);
    await v1.waitForFunction(() => GET_A_VALIDER().length === 2, null, { timeout: 15000 }).catch(() => {});
    verifier(await v1.evaluate(() => GET_A_VALIDER().length) === 2, '1er valideur : rôle réactivé, les 2 demandes s\'ouvrent aussitôt dans l\'Espace valideur');
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
    // Même personne VALIDEUR 1 et VALIDEUR 2 : la demande revenue au 2e niveau n'est pas classée avec celle du 1er niveau.
    verifier(await v1.evaluate(() => {
        const l = JSON.parse(localStorage.getItem('trigone_boite'));
        l.push({ id: 't1', nature: 'niveau1', statut: 'ouvert', ids: ['zz'] }, { id: 't2', nature: 'niveau2', statut: 'nouveau', ids: ['zz'] });
        localStorage.setItem('trigone_boite', JSON.stringify(l));
        JUMELAGE_BOITE_TRAITER_DEMANDES(['zz'], ['niveau1', 'renvoi']);
        const r = JUMELAGE_BOITE_LISTE(), ok = r.find(x => x.id === 't1').statut === 'traite' && r.find(x => x.id === 't2').statut === 'nouveau';
        JUMELAGE_BOITE_TRAITER_DEMANDES(['zz'], ['niveau2']); JUMELAGE_BOITE_ROUVRIR('t2');
        const ok2 = JUMELAGE_BOITE_LISTE().find(x => x.id === 't2').statut === 'ouvert';
        localStorage.setItem('trigone_boite', JSON.stringify(JUMELAGE_BOITE_LISTE().filter(x => x.id !== 't1' && x.id !== 't2')));
        return ok && ok2;
    }), 'même personne aux deux niveaux : l\'envoi du 2e niveau reste « à traiter » ; « Rouvrir » remet un envoi traité');

    // Suivi : le demandeur voit une demande validée par le VALIDEUR 1 (avec son nom), l'autre refusée.
    const s1 = Object.values(await suivi(m)).filter(x => x.genre === 'mer');
    verifier(s1.length === 2 && s1.some(x => x.etape === 'val2' && x.etapes.some(t => t.e === 'val1' && t.qui)) && s1.some(x => x.etape === 'refus'),
        'suivi : demande « validée par le VALIDEUR 1 » (nom du valideur), l\'autre « refusée »');

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
    const testNotif = await v1.evaluate(async () => {
        const c = JSON.parse(localStorage.getItem('trigone_compte')), h = { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton, 'Content-Type': 'application/json' };
        return (await (await fetch('api/push/test', { method: 'POST', headers: h })).json());
    });
    verifier(testNotif.ok && testNotif.resultats.some(x => x.ceci && x.statut !== 0), '« Tester les notifications » : l\'abonnement est retrouvé et le service de notification interrogé (réponse par appareil)');

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
    verifier(Object.values(await suivi(m)).some(x => x.etape === 'chorus' && x.etapes.map(t => t.e).join() === 'envoyee,val1,renvoi,val1,val2'),
        'suivi : VALIDEUR 1 → renvoi par le VALIDEUR 2 → revalidée → VALIDEUR 2 → chez l\'assistant Chorus DT');
    // Relances : rien avant 24 h ; après 24 h, le détenteur (assistant Chorus DT) est relancé, une seule fois par 24 h.
    const relance = d => c.evaluate(async d => { const x = JSON.parse(localStorage.getItem('trigone_compte'));
        return (await (await fetch('api/test/relance', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'TRIGONE ' + encodeURIComponent(x.mail) + ' ' + x.appareil + ' ' + x.jeton }, body: JSON.stringify({ decalage: d }) })).json()).n; }, d);
    const r0 = await relance(0), r1 = await relance(25 * 3600 * 1000), r2 = await relance(25 * 3600 * 1000), r3 = await relance(49 * 3600 * 1000 + 60000);
    verifier(r0 === 0 && r1 >= 1 && r2 === 0 && r3 >= 1, 'relances : aucune avant 24 h, puis une toutes les 24 h (' + [r0, r1, r2, r3].join(' / ') + ')');

    // Assistant Chorus DT

    await relever(c);
    await c.evaluate(() => { document.querySelectorAll('.JUM-CHOIX').forEach(e => e.remove()); JUMELAGE_CHOIX(); }); await attendre(600);
    verifier(await c.evaluate(() => !!document.querySelector('.JUM-CHORUS') && document.querySelector('.JUM-CHORUS-NB').textContent === '1'), 'Chorus DT : logo au centre de l\'écran de choix, pastille « 1 »');
    // Écran presque carré (téléphone pliant ouvert) : le logo Chorus ne recouvre jamais les deux autres.
    for (const [w, h] of [[882, 916], [700, 700], [360, 640]]) {
        await c.setViewportSize({ width: w, height: h }); await attendre(500);
        const touche = await c.evaluate(() => {
            const a = document.querySelector('.JUM-CHORUS').getBoundingClientRect();
            return Array.prototype.some.call(document.querySelectorAll('.JUM-BLOC'), bl => { const b = bl.getBoundingClientRect(); return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; });
        });
        verifier(!touche, 'écran de choix ' + w + ' × ' + h + ' : le logo Chorus ne recouvre pas les logos Mise en route et Compte-rendu');
    }
    await c.setViewportSize({ width: 480, height: 1000 }); await attendre(400);
    await c.evaluate(() => { const n = document.querySelector('.JUM-NOUV button'); if (n) n.click(); }); await attendre(300);
    await c.click('.JUM-CHORUS'); await attendre(1500);
    verifier(await c.evaluate(() => PAGE_ACTUELLE) === 'CHORUS', 'Chorus DT : le logo ouvre l\'espace Assistant Chorus DT');
    await c.click('.MER-CHORUS-LOGO'); await attendre(900);
    verifier(await c.evaluate(() => !!document.querySelector('.JUM-CHOIX .JUM-CHORUS')), 'Chorus DT : toucher le logo de l\'espace ramène à l\'écran de choix');
    // Puis « Mise en route » : l'accueil de Mise en route, et non l'espace Chorus resté dessous.
    await c.click('.JUM-PAN-MER .JUM-BLOC img', { force: true }); await attendre(1500);
    verifier(await c.evaluate(() => PAGE_ACTUELLE === 'ACCUEIL' && !document.querySelector('.JUM-CHOIX')), 'écran de choix après l\'espace Chorus : « Mise en route » ouvre bien l\'accueil de Mise en route');
    await c.evaluate(() => JUMELAGE_CHOIX()); await attendre(600);
    await c.click('.JUM-CHORUS'); await attendre(1500);
    // Espace Chorus DT en dossiers : « Demandes de mise en route » avec son compteur rouge.
    verifier(await c.evaluate(() => { const d = document.querySelector('.MER-DOSSIER[data-dossier="demandes"]'); return !!d && d.querySelector('.MER-DOSSIER-NB').textContent === '1' && !!document.querySelector('.MER-DOSSIER[data-dossier="cr"]'); }),
        'Chorus DT : dossiers jaunes « Demandes de mise en route » (1 à traiter) et « Comptes-rendus de mission »');
    await c.click('.MER-DOSSIER[data-dossier="demandes"]'); await attendre(500);
    // Sur la ligne de la demande reçue : aperçu et PDF directement (contrôle fait avant).
    verifier(await c.locator('.MER-RECU:has(.MER-RECU-chorus) button:has-text("Aperçu")').count() === 1, 'Chorus DT : bouton « Aperçu » sur la ligne de la demande reçue');
    const telechargement = c.waitForEvent('download', { timeout: 20000 });
    await c.locator('.MER-RECU:has(.MER-RECU-chorus) button:has-text("Télécharger le PDF")').click();
    const pdf = await telechargement;
    verifier(/^4-OMR VALIDE/.test(pdf.suggestedFilename()), 'Chorus DT : « Télécharger le PDF » depuis la ligne donne le PDF final (' + pdf.suggestedFilename() + ')');
    await attendre(800);
    verifier(await c.evaluate(() => JUMELAGE_BOITE_LISTE().find(x => x.nature === 'chorus').statut === 'traite'), 'Chorus DT : la demande passe en « Traités » après le PDF');
    verifier(Object.values(await suivi(m)).some(x => x.etape === 'traite'), 'suivi : demande « prise en charge par l\'assistant Chorus DT » après le PDF');
    // Les valideurs voient aussi la suite des demandes qu'ils ont validées.
    const sv1 = Object.values(await suivi(v1)), sv2 = Object.values(await suivi(v2));
    verifier(sv1.some(x => x.intervenant && x.etape === 'traite') && sv2.some(x => x.intervenant && x.etape === 'traite'),
        'suivi : le VALIDEUR 1 et le VALIDEUR 2 voient la prise en charge par l\'assistant Chorus DT');
    await v2.evaluate(() => OUVRIR_DOSSIER('RECEPTION', 'signer')); await attendre(1200);
    await v2.evaluate(() => document.querySelectorAll('details.MER-RECU-TRAITES').forEach(d => { d.open = true; }));
    verifier(await v2.locator('.MER-RECU .MER-SUIVI-TXT:has-text("Prise en charge par l\'assistant Chorus DT")').count() >= 1,
        'Boîte de réception du VALIDEUR 2 : frise de suivi sur la demande traitée');
    await m.evaluate(() => OUVRIR_DOSSIER('BIBLIOTHEQUE', 'traitees')); await attendre(1500);
    verifier(await m.locator('.MER-SUIVI-TXT:has-text("Prise en charge par l\'assistant Chorus DT")').count() >= 1 && await m.locator('.MER-SUIVI-PT.fait').count() >= 4,
        'Bibliothèque : frise de suivi Envoyée → VALIDEUR 1 → VALIDEUR 2 → Chorus DT');
    await c.evaluate(() => document.querySelectorAll('details.MER-RECU-TRAITES').forEach(d => { d.open = true; }));
    await c.locator('.MER-RECU:has(.MER-RECU-chorus) button:has-text("Contrôle détaillé")').first().click(); await attendre(2500);
    verifier(await c.evaluate(() => scrollY) === 0 && (await c.textContent('.CARD h2')) === 'Contrôle détaillé', 'Chorus DT : « Contrôle détaillé » s\'affiche en haut de la page');
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
    verifier(Object.values(await suivi(m)).some(x => x.etape === 'refus' && x.etapes.map(t => t.e).pop() === 'refus' && x.etapes.some(t => t.e === 'traite')), 'suivi : demande renvoyée par l\'assistant Chorus DT → « refusée »');
    verifier(Object.values(await suivi(v2)).some(x => x.intervenant && x.etape === 'refus'), 'suivi : le VALIDEUR 2 voit que l\'assistant Chorus DT a renvoyé la demande au demandeur');

    // Compte-rendu de fin de mission : le missionnaire l'envoie (PDF + justificatif) à l'assistant Chorus DT.
    await m.goto(URL + 'cr/'); await attendre(3000);
    const envoyerCr = async dest => {
        await m.evaluate(d => JUMELAGE_ENVOYER_CR({ destinataire: d, missionnaire: 'ADJ BOUQUET GP', libelle: 'Stage Bouquet', dates: '01/10/2026 → 03/10/2026',
            corps: 'Bonjour', pieces: ['FACTURE HÔTEL'], pdf: () => ({ nom: 'CR_MISSION_BOUQUET.pdf', blob: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }) }),
            succes: r => { window.__crEnvoye = true; window.__crId = r && r.id; } }), dest); await attendre(400);
        await m.setInputFiles('#JUM-CR-FICHIERS', path.join(FICHIERS, 'nds_test.pdf')); await attendre(500);
        await m.click('#JUM-CR-ENVOYER'); await attendre(3000);
    };
    await envoyerCr(MAILS.V1);
    verifier((await m.textContent('#JUM-CR-ERR')).includes('assistant Chorus DT'), 'compte-rendu : refusé par la boîte d\'un valideur (réservé à l\'assistant Chorus DT)');
    await m.evaluate(() => JUMELAGE_FERMER_ENVOI_CR());
    await envoyerCr(MAILS.C);
    verifier(await m.evaluate(() => window.__crEnvoye === true && !document.querySelector('.JUM-REGLAGES')), 'compte-rendu : envoyé à l\'assistant Chorus DT');
    // Relève faite depuis Compte-rendu (l'assistant avait cette appli ouverte), ouverture depuis l'espace Chorus DT.
    await c.goto(URL + 'cr/'); await attendre(2500); await relever(c);
    await c.goto(URL); await attendre(2500);
    await c.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-PRES,.JUM-NOUV').forEach(x => x.remove()); document.documentElement.classList.remove('jum-choix'); OUVRIR_DOSSIER('CHORUS', 'cr'); }); await attendre(600);
    verifier((await c.textContent('#PAGE-STAGE')).includes('ADJ BOUQUET GP'), 'Chorus DT : le compte-rendu arrive dans la section « Comptes-rendus de mission »');
    verifier(Object.values(await suivi(m)).some(x => x.genre === 'cr' && x.etape === 'recu'), 'suivi : compte-rendu « récupéré par l\'assistant Chorus DT » (le missionnaire est prévenu)');
    await c.locator('.MER-RECU:has(.MER-RECU-cr) .BTN-PRIMARY').click(); await attendre(1200);
    // Lignes : « PDF complet » (compte-rendu + justificatifs), puis les fichiers séparés.
    const dlTout = c.waitForEvent('download');
    await c.locator('#MER-MODALE-FOND button:has-text("Télécharger")').nth(0).click();
    verifier(/\+ justificatifs\.pdf$/.test((await dlTout).suggestedFilename()), 'Chorus DT : compte-rendu et justificatif téléchargés en un seul PDF');
    const dl = c.waitForEvent('download');
    await c.locator('#MER-MODALE-FOND button:has-text("Télécharger")').nth(2).click();
    verifier((await dl).suggestedFilename() === 'nds_test.pdf', 'Chorus DT : le justificatif se télécharge');
    const fen = c.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await c.locator('#MER-MODALE-FOND button:has-text("Aperçu")').nth(1).click();
    const pop = await fen;
    verifier(!!pop && /^blob:/.test(pop.url()), 'Chorus DT : « Aperçu » ouvre le PDF du compte-rendu');
    if (pop) await pop.close();
    await c.click('#MER-MODALE-FOND button:has-text("Traité")'); await attendre(500);
    verifier(await c.evaluate(() => JUMELAGE_BOITE_LISTE().filter(x => x.nature === 'cr').every(x => x.statut === 'traite')), 'Chorus DT : compte-rendu marqué « traité »');
    verifier(Object.values(await suivi(m)).some(x => x.genre === 'cr' && x.etape === 'traite'), 'suivi : compte-rendu « traité par l\'assistant Chorus DT »');
    const frise = await m.evaluate(() => TPL_BIB_SUIVI({ envoiId: window.__crId }));
    verifier(/Traité par/.test(frise) && (frise.match(/BIB-SUIVI-PT fait/g) || []).length === 3, 'Compte-rendu › Bibliothèque : frise Envoyé → Récupéré → Traité');

    // Absence : le VALIDEUR 2 déclare un remplaçant (le VALIDEUR 1, qui a aussi le rôle VALIDEUR 2).
    const api = (p, chemin, corps) => p.evaluate(async ([chemin, corps]) => { const x = JSON.parse(localStorage.getItem('trigone_compte'));
        const r = await fetch((location.pathname.includes('/cr/') ? '../' : '') + 'api/' + chemin, { method: corps ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'TRIGONE ' + encodeURIComponent(x.mail) + ' ' + x.appareil + ' ' + x.jeton }, body: corps ? JSON.stringify(corps) : undefined });
        return r.json(); }, [chemin, corps]);
    const abs = await api(v2, 'remplacant', { mail: MAILS.V1, jusqu: Date.now() + 2 * 864e5 });
    verifier(abs.ok && abs.remplacant.mail === MAILS.V1 && abs.rolesManquants.length === 0, 'absence : remplaçant enregistré (compte et rôle vérifiés)');
    verifier((await api(v2, 'remplacant', { mail: 'inconnu@interieur.gouv.fr', jusqu: Date.now() + 864e5 })).ok === false, 'absence : un remplaçant sans compte TRIGONE est refusé');
    await v2.evaluate(() => JUMELAGE_REGLAGES({ vue: 'absence' })); await attendre(1500);
    verifier((await v2.textContent('#JUM-R-ABS-ETAT')).includes('remplacé par'), 'Réglages › Absence : « Absent jusqu\'au …, remplacé par … » affiché');
    verifier(await v2.evaluate(() => !document.getElementById('JUM-R-VAL1').offsetParent && !document.getElementById('JUM-R-NOM').offsetParent && document.querySelector('.JUM-R-TETE h2').textContent === 'Absence'),
        'Paramètres › Absence : une page à part, sans les rôles ni le profil');
    await v2.evaluate(() => JUMELAGE_FERMER_REGLAGES());
    await m.goto(URL); await attendre(2500);
    await m.goto(URL); await attendre(2500);
    await m.evaluate(() => SHOW_PAGE('PANIER')); await m.evaluate(v => MER_AFFICHER_ABSENCE('MER-ABS-DEST', v), MAILS.V2); await attendre(1200);
    verifier((await m.textContent('#MER-ABS-DEST')).includes('partira chez son remplaçant'), 'absence : l\'expéditeur est prévenu avant l\'envoi (« absent jusqu\'au … : votre envoi partira chez son remplaçant »)');
    const envoiAbs = await m.evaluate(d => JUMELAGE_ENVOYER_DIRECT(d, 'VALIDATION_1', 'test.json', JSON.stringify({ demandes: [] })), MAILS.V2);
    verifier(envoiAbs.remplacant === MAILS.V1 && envoiAbs.absent === MAILS.V2, 'absence : l\'envoi destiné au VALIDEUR 2 part chez son remplaçant');
    const refusAbs = await m.evaluate(d => JUMELAGE_ENVOYER_DIRECT(d, 'REFUS', 'test.json', JSON.stringify({ demandes: [] })), MAILS.V2);
    verifier(!refusAbs.remplacant, 'absence : un refus (retour au demandeur) n\'est jamais redirigé');
    await api(v2, 'remplacant', { mail: '' });
    verifier(!(await api(m, 'cles?mail=' + encodeURIComponent(MAILS.V2))).remplacant, 'absence : « Fin de l\'absence » rétablit les envois directs');
    await relever(v1); await relever(v2);

    // Notifications coupées sur un appareil : le serveur ne lui envoie plus rien (le test le signale), puis rétablies.
    await api(v1, 'push/muet', { muet: true });
    const tm = await api(v1, 'push/test', {});
    verifier(tm.resultats.some(x => x.ceci && /coupées/.test(x.detail)), 'notifications coupées sur cet appareil : plus rien ne lui est envoyé');
    await api(v1, 'push/muet', { muet: false });
    verifier((await api(v1, 'push/test', {})).resultats.some(x => x.ceci && !/coupées/.test(x.detail) && x.statut !== 0), 'notifications rétablies sur cet appareil');

    // Demande refusée retirée de Documents par le demandeur : suivi « abandon », plus de rappel « à corriger ».
    await m.goto(URL); await attendre(2500);
    const refusee = await m.evaluate(() => (GET_PANIER().find(d => d.refus) || {}).id);
    await m.evaluate(id => RETIRER_DU_PANIER_OK(id), refusee); await attendre(1500);
    verifier(((await suivi(m))[refusee] || {}).etape === 'abandon', 'refus : demande retirée de Documents → plus de rappel au demandeur');

    // Liaison : le demandeur installe TRIGONE sur un autre appareil avec un code (sans mail ni ressaisie).
    const nbAppareils = async () => ((await api(m, 'cles?mail=' + encodeURIComponent(MAILS.M))).appareils || []).length;
    const avant = await nbAppareils();
    await m.evaluate(() => { SHOW_PAGE('ACCUEIL'); JUMELAGE_COMPTE(); }); await attendre(600);
    await m.click('#JUM-C-LIAISON'); await attendre(3500);
    const codeLiaison = (await m.textContent('.JUM-LIAISON-CODE')).trim();
    verifier(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codeLiaison) && (await m.textContent('#JUM-C-LIAISON-T')).includes('Valable encore'), 'liaison : code affiché (' + codeLiaison + '), valable 15 min');
    await m.evaluate(() => JUMELAGE_FERMER_COMPTE());
    const ctxN = await b.newContext({ viewport: { width: 480, height: 1000 } });
    const n = await ctxN.newPage(); n.on('pageerror', e => erreurs.push('N : ' + e.message)); n.on('dialog', d => d.accept());
    await n.goto(URL); await attendre(2500);
    verifier(!!(await n.evaluate(() => JUMELAGE_LIAISON_UTILISER('ZZZZ-ZZZZ').then(() => '', e => e.message))), 'liaison : un code erroné est refusé');
    const lie = await n.evaluate(c => JUMELAGE_LIAISON_UTILISER(c.toLowerCase().replace('-', ' ')).then(m => m, e => 'ERREUR ' + e.message), codeLiaison);
    verifier(lie === MAILS.M, 'liaison : le nouvel appareil rejoint le compte du demandeur (' + lie + ')');
    await n.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await n.goto(URL); await attendre(3000);
    const [qm, qn] = [await m.evaluate(() => JUMELAGE_QUI()), await n.evaluate(() => JUMELAGE_QUI())];
    const [bm, bn] = [await m.evaluate(() => GET_BIBLIOTHEQUE().length), await n.evaluate(() => GET_BIBLIOTHEQUE().length)];
    verifier(await n.evaluate(() => JUMELAGE_COMPTE_ACTIF()) && qn === qm && bn === bm && bn > 0, 'liaison : identité (' + qn + '), compte et bibliothèque (' + bn + ') recopiés');
    verifier(await nbAppareils() === avant + 1, 'liaison : l\'appareil est ajouté au compte TRIGONE');
    verifier(!!(await n.evaluate(c => JUMELAGE_LIAISON_UTILISER(c).then(() => '', e => e.message), codeLiaison)), 'liaison : le code ne sert qu\'une fois');
    // « Me déconnecter et effacer cet appareil »
    await n.evaluate(() => { document.querySelectorAll('.JUM-PRES,.JUM-NOUV,.JUM-VERROU,.JUM-PAVE').forEach(x => x.remove()); JUMELAGE_COMPTE(); }); await attendre(600);
    await n.click('#JUM-C-EFFACER'); await attendre(500);
    await n.click('button:has-text("Oui, déconnecter et effacer")'); await attendre(3500);
    verifier(await n.evaluate(() => !localStorage.getItem('trigone_compte') && !localStorage.getItem('mer_bibliotheque')) && await nbAppareils() === avant,
        'déconnexion et effacement : compte retiré de l\'appareil, données effacées');
    await ctxN.close();

    // Boîtes vides après relève
    const reste = await v1.evaluate(async () => { const c = JSON.parse(localStorage.getItem('trigone_compte'));
        return (await (await fetch('api/boite', { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton } })).json()).envois.length; });
    verifier(reste === 0, 'serveur : envois supprimés dès leur réception');
    verifier(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' — ' + erreurs.join(' | ') : ''));
    await b.close();
};
