// Raccourcis de l'icône de l'appli (appui long) : Nouvelle demande, Ma mission, Boîte de réception, Bibliothèque —
// ouverts directement, sans passer par l'écran de choix. Validation groupée : « Tout ouvrir et signer » dans la boîte
// de réception ouvre toutes les demandes à signer d'un niveau, cochées ; « Valider la sélection » les signe toutes.
const fs = require('fs'), path = require('path');
const { RACINE, APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'manifest.json'), 'utf8')), sc = man.shortcuts || [];
    verifier(sc.length === 5 && sc.every(x => x.url && x.icons && fs.existsSync(path.join(RACINE, x.icons[0].src))), 'manifeste : 5 raccourcis (' + sc.map(x => x.short_name).join(', ') + '), icônes présentes');
    const b = await navigateur(), erreurs = [];
    const ouvrir = async url => {
        const ctx = await b.newContext({ viewport: { width: 412, height: 860 } }); await ctx.addInitScript(preparer, APP_CODE);
        const p = await ctx.newPage(); p.on('pageerror', e => erreurs.push(e.message)); await p.goto(srv.url + url); await attendre(3500); return p;
    };
    let p = await ouvrir('?espace=nouvelle');
    verifier(await p.evaluate(() => !document.querySelector('.JUM-CHOIX') && PAGE_ACTUELLE === 'FORMULAIRE' && !location.search), '« Nouvelle demande » : le formulaire s\'ouvre directement');
    p = await ouvrir('?espace=suivi');
    verifier(await p.evaluate(() => !document.querySelector('.JUM-CHOIX') && PAGE_ACTUELLE === 'BIBLIOTHEQUE'), '« Bibliothèque » : ouverte directement');
    p = await ouvrir('cr/?espace=mission');
    verifier(await p.evaluate(() => !document.querySelector('.JUM-CHOIX') && M.PAGE === 'P1' && !location.search), '« Ma mission » : le compte-rendu démarre directement (Départ mission)');
    p = await ouvrir('cr/?depart=inconnu');
    verifier(await p.evaluate(() => !document.querySelector('.JUM-CHOIX')), 'notification « Départ en mission » : pas d\'écran de choix par-dessus');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();

    // Validation groupée (serveur de test et code du VALIDEUR 1 nécessaires).
    const URL = process.env.TRIGONE_URL_BOITE, code1 = process.env.TRIGONE_CODE_VAL1;
    if (!URL || !code1) { console.log('  (validation groupée sautée : TRIGONE_URL_BOITE et TRIGONE_CODE_VAL1)'); return; }
    const b2 = await navigateur(), suffixe = Date.now().toString(36);
    const MAILS = { M: 'missionnaire.g' + suffixe + '@interieur.gouv.fr', V: 'valideur.g' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom) {
        const ctx = await b2.newContext({ viewport: { width: 480, height: 1000 } }), q = await ctx.newPage();
        q.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); q.on('dialog', d => d.accept());
        await q.goto(URL); await q.evaluate(preparer, APP_CODE); await q.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await q.reload(); await attendre(2500);
        await q.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await q.fill('#JUM-C-MAIL', MAILS[nom]); await q.click('#JUM-C-ENVOI'); await attendre(1500);
        await q.click('#JUM-C-VALIDER'); await attendre(2000);
        await q.evaluate(() => { JUMELAGE_FERMER_COMPTE(); document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); });
        return q;
    }
    const v = await appareil('V'), m = await appareil('M');
    await v.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(500);
    await v.check('#JUM-R-VAL1'); await attendre(200); await v.fill('#JUM-R-FONCTION1', 'Chef de service'); await v.fill('#JUM-R-CODEVAL1', code1);
    await v.click('.JUM-R-PRINCIPAL'); await attendre(4000);
    // Deux missionnaires différents (deux envois séparés) pour la même formation.
    for (const [nom, prenom] of [['DURAND', 'Léa'], ['PETIT', 'Hugo']]) {
        await m.evaluate(([dest, nom, prenom]) => {
            const d = VIDE_DEMANDE(); d.objet = 'FORMATION SSIAP 1';
            d.personnes[0] = { unite: '4°RIISC', cie: '4CIE', grade: 'SGT', nom, prenom, matricule: '067 12 34 567' };
            d.trajets.aller = Object.assign(d.trajets.aller, { moyen: 'SERVICE', lieuDep: 'LIBOURNE', cpDep: '33500', lieuArr: 'BORDEAUX', cpArr: '33000', dateDep: '2026-10-12T07:30', dateArr: '2026-10-12T08:30' });
            d.trajets.retour = Object.assign(d.trajets.retour, { moyen: 'SERVICE', lieuDep: 'BORDEAUX', cpDep: '33000', lieuArr: 'LIBOURNE', cpArr: '33500', dateDep: '2026-10-12T17:00', dateArr: '2026-10-12T18:00' });
            d.mailDemandeur = JUMELAGE_COMPTE_MAIL();
            return GENERER_JSON_COMPLET([d], 'DEMANDE_INITIALE').then(j => JUMELAGE_ENVOYER_DIRECT(dest, 'DEMANDE', 'DEMANDE ' + nom + '.json', j));
        }, [MAILS.V, nom, prenom]);
        await attendre(800);
    }
    await v.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
    await v.evaluate(() => { MER_DOSSIER.RECEPTION = 'signer'; SHOW_PAGE('RECEPTION'); }); await attendre(500);
    const btn = v.locator('button:has-text("Tout ouvrir et signer")');
    verifier(await btn.count() === 1 && /2 demandes/.test(await btn.textContent()), 'boîte de réception › À signer : « Tout ouvrir et signer — 2 demandes »');
    await btn.click(); await attendre(4500);
    const etat = await v.evaluate(() => ({ page: PAGE_ACTUELLE, cases: [...document.querySelectorAll('.MER-VAL-SEL')].map(c => c.checked), msg: document.body.innerText.includes('demandes prêtes à signer') }));
    verifier(etat.page === 'VALIDATION' && etat.cases.length === 2 && etat.cases.every(Boolean) && etat.msg, 'les 2 demandes sont ouvertes dans l\'Espace valideur, déjà cochées');
    await v.evaluate(() => { const o = document.getElementById('MSG-OVERLAY'); if (o) o.classList.add('HIDDEN'); VALIDER_SELECTION(); }); await attendre(3000);
    verifier(await v.evaluate(() => GET_A_VALIDER().filter(e => e.decision === 'VALIDEE' && e.signature).length === 2), '« Valider la sélection » : les 2 demandes signées d\'un coup');
    verifier(await v.evaluate(() => JUMELAGE_BOITE_LISTE().filter(x => x.nature === 'niveau1').every(x => x.statut !== 'nouveau')), 'les envois de la boîte sont marqués ouverts');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b2.close();
};
