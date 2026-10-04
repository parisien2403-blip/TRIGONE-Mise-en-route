// Onglet « Participants » : carte TRIGONE de chaque personne d'une demande, vérifiée par le serveur, avec la photo
// chiffrée de bout en bout (lisible seulement par les appareils des valideurs, assistants Chorus DT, chef de mission).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE, codeChorus = process.env.TRIGONE_CODE_CHORUS;
    if (!URL || !codeChorus) { console.log('  (sauté : définissez TRIGONE_URL_BOITE et TRIGONE_CODE_CHORUS)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const nid = () => String(Math.floor(1e9 + Math.random() * 8.9e9)).slice(0, 10);
    const NID = { M: nid(), X: nid() };
    const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    async function appareil(nom, matricule, largeur) {
        const ctx = await b.newContext({ viewport: { width: largeur || 480, height: 900 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(([n, m]) => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.nom = n; if (m) r.matricule = m; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); sessionStorage.setItem('trigone_choix_fait', '1'); }, [nom.toUpperCase(), matricule]);
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', nom.toLowerCase() + '.' + suffixe + '@interieur.gouv.fr'); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        await p.reload(); await attendre(4500);   // à l'ouverture : matricule déclaré au serveur
        return p;
    }
    const chorus = async p => { await p.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(400); await p.check('#JUM-R-CHORUS'); await p.fill('#JUM-R-CODECHORUS', codeChorus); await p.click('.JUM-R-PRINCIPAL'); await attendre(2000); };
    const m = await appareil('Martin', NID.M), c = await appareil('Chorus', '', 1440), x = await appareil('Autre', NID.X);
    await chorus(c);
    const mailM = await m.evaluate(() => JUMELAGE_COMPTE_MAIL());
    // Missionnaire : carte (serveur), photo, partage coché → photo chiffrée pour les appareils autorisés.
    await m.evaluate(p => { localStorage.setItem('trigone_carte_photo', p); localStorage.setItem('trigone_photo_partage', '1'); return JUMELAGE_CARTE_ID(); }, PHOTO); await attendre(500);
    verifier(await m.evaluate(() => JUMELAGE_PHOTO_SYNCHRO(true)) === 'ok', 'missionnaire : photo partagée, chiffrée pour les valideurs et assistants Chorus DT');
    const pers = [{ grade: 'ADJ', nom: 'MARTIN', prenom: 'Essai', matricule: NID.M }, { grade: 'ADJ', nom: 'AUTRE', prenom: 'Essai', matricule: NID.X }];
    const vu = await c.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS(p, mail), [pers, mailM]);
    verifier(vu && vu[0].carte && vu[0].carte.nom === 'MARTIN' && vu[0].photoUrl === PHOTO, 'assistant Chorus DT : carte vérifiée et photo déchiffrée sur son appareil');
    verifier(vu && vu[1].compte && vu[1].carte === null && !vu[1].photoUrl, 'participant sans carte ni photo partagée : « pas de carte vérifiée »');
    // Le serveur ne garde qu'un bloc illisible.
    verifier(await c.evaluate(() => fetch('/api/participants', { method: 'POST', body: '{}' }).then(r => r.status)) === 401, 'cartes des participants : refusé sans compte');
    // Un compte sans rôle, hors de la mission : ni carte ni photo.
    const xv = await x.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS(p, mail), [pers, mailM]);
    verifier(xv && xv[0].compte && xv[0].carte && !xv[0].carte.nom && !xv[0].photo, 'compte sans rôle (chef d\'une demande pas encore partie) : « carte vérifiée » seulement, ni ses données ni sa photo');
    // Fenêtre Participants (assistant) : carte avec photo, badge vérifié.
    await c.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS_OUVRIR({ titre: 'OMR N°0001 — TEST', sous: 'Du 01/10 au 03/10', personnes: p, mailDemandeur: mail, collectif: true, lignes: [['Objet', 'TEST']] }), [pers, mailM]); await attendre(1500);
    const ui = await c.evaluate(() => ({ n: document.querySelectorAll('.JUM-PART-CARTE').length, photo: !!document.querySelector('.JUM-PART-CARTE img[src^="data:image/png"]'), ok: document.querySelectorAll('.JUM-PART-ETAT.ok').length, ko: document.querySelectorAll('.JUM-PART-ETAT.ko').length, chef: /CHEF DE MISSION/.test(document.querySelector('.JUM-PART-FEN').textContent) }));
    verifier(ui.n === 2 && ui.photo && ui.ok === 1 && ui.ko === 1 && ui.chef, 'fenêtre Participants : une carte par personne, photo, « vérifiée » / « pas de carte »');
    if (process.env.TRIGONE_CAPTURES) await c.screenshot({ path: process.env.TRIGONE_CAPTURES + '/participants.png' });
    await c.click('.JUM-PART-ONG button[data-o="dem"]'); await attendre(200);
    verifier(/Objet/.test(await c.textContent('.JUM-PART-DEM')), 'fenêtre Participants : onglet Demande');
    await c.click('.JUM-PART-X'); await attendre(200);
    // Nouvel assistant après le partage : la photo lui arrive au prochain rechiffrement du missionnaire.
    const c2 = await appareil('Chorus2', '', 480); await chorus(c2);
    const avant = await c2.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS(p, mail), [pers, mailM]);
    verifier(avant && avant[0].carte && !avant[0].photoUrl && avant[0].photo && avant[0].photo.partagee, 'nouvel assistant : carte vérifiée, photo pas encore disponible sur son appareil');
    await m.evaluate(() => { localStorage.removeItem('trigone_photo_sig'); return JUMELAGE_PHOTO_SYNCHRO(); });
    const apres = await c2.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS(p, mail), [pers, mailM]);
    verifier(apres && apres[0].photoUrl === PHOTO, 'après réouverture de TRIGONE par le missionnaire : la photo arrive au nouvel assistant');
    // Mon autre appareil (même compte) : la photo prise sur le téléphone y est lisible.
    const m2 = await (async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(); p.on('pageerror', e => erreurs.push('m2 : ' + e.message));
        await p.goto(URL); await p.evaluate(preparer, APP_CODE); await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500); await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', 'martin.' + suffixe + '@interieur.gouv.fr'); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500); await p.evaluate(() => JUMELAGE_FERMER_COMPTE()); return p; })();
    await m.evaluate(() => { localStorage.removeItem('trigone_photo_sig'); return JUMELAGE_PHOTO_SYNCHRO(); });
    const moiAilleurs = await m2.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS(p, mail), [pers, mailM]);
    verifier(moiAilleurs && moiAilleurs[0].moi && moiAilleurs[0].photoUrl === PHOTO, 'ma propre carte sur mon autre appareil (PC) : ma photo s\'affiche');
    verifier(await m.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS(p, mail).then(r => r[0].photoUrl), [pers, mailM]) === PHOTO, 'ma propre carte sur l\'appareil de la photo : affichée directement');
    // Partage décoché : photo retirée du serveur.
    await m.evaluate(() => { localStorage.setItem('trigone_photo_partage', ''); return JUMELAGE_PHOTO_SYNCHRO(true); });
    const retire = await c.evaluate(([p, mail]) => JUMELAGE_PARTICIPANTS(p, mail), [pers, mailM]);
    verifier(retire && retire[0].carte && !retire[0].photo, 'partage décoché : la photo n\'est plus disponible, la carte reste vérifiée');
    // Boutons « 👥 Participants » : Espace valideur, contrôle Chorus DT, registre, bibliothèque.
    verifier(await c.evaluate(() => typeof MER_PARTICIPANTS_REG === 'function' && typeof MER_PARTICIPANTS_VAL === 'function' && typeof MER_PARTICIPANTS_VERIF === 'function' && typeof MER_PARTICIPANTS_BIB === 'function'), 'boutons Participants : Espace valideur, contrôle Chorus DT, registre, bibliothèque');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
    await b.close();
};
