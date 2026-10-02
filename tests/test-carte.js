// Carte TRIGONE : recto (photo cadrée, identité), verso (QR code), plein écran, page de vérification, et lecture de la
// carte par un autre compte (mail du 1er valideur, personnes d'une demande, pointage des présents). Demande le serveur
// de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const MAILS = { A: 'titulaire.' + suffixe + '@interieur.gouv.fr', B: 'lecteur.' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom, identite) {
        const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, hasTouch: true, isMobile: true }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(x => { sessionStorage.setItem('trigone_choix_fait', '1'); const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); Object.assign(r, x); localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); }, identite);
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => { JUMELAGE_FERMER_COMPTE(); const m = document.getElementById('MSG-OVERLAY'); if (m) m.classList.add('HIDDEN'); });
        return { p, ctx };
    }
    const nidA = String(Date.now()).slice(-10);
    const { p: a } = await appareil('A', { grade: 'SGT', nom: 'CARTIER', prenom: 'Lou', matricule: nidA, unite: '1°RIISC', cie: '2CIE' });
    // Paramètres › Compte › Ma carte TRIGONE
    await a.evaluate(() => JUMELAGE_PARAMETRES('compte')); await attendre(400);
    verifier(await a.evaluate(() => !!document.querySelector('.JUM-PARAM [data-action="carte"]')), 'Paramètres › Compte : « Ma carte TRIGONE »');
    await a.click('.JUM-PARAM [data-action="carte"]'); await attendre(2500);
    const recto = await a.evaluate(() => document.querySelector('.JUM-CARTE.recto').innerText);
    verifier(/CARTIER Lou/.test(recto) && /SGT/.test(recto) && /1°RIISC · 2CIE/.test(recto) && /TRGN<1</.test(recto), 'recto : identité de Mon profil et ligne « passeport »');
    // Carte qui évolue : liseré argent à 12 comptes-rendus envoyés (or à 20).
    await a.evaluate(() => { localStorage.setItem('trigone_cr_envoyes_total', '12'); JUMELAGE_CARTE(); }); await attendre(1500);
    verifier(await a.evaluate(() => document.querySelector('.JUM-CARTE.recto').classList.contains('niv-argent') && /12 ARGENT/.test(document.querySelector('.JUM-CARTE.recto').innerText)), 'carte qui évolue : liseré argent et pastille « ARGENT » à 12 missions');
    const memo = await a.evaluate(() => JSON.parse(localStorage.getItem('trigone_carte') || '{}'));
    verifier(!!memo.id && await a.evaluate(() => !!document.querySelector('.JUM-CARTE.verso .JUM-CARTE-QR canvas, .JUM-CARTE.verso .JUM-CARTE-QR img')), 'verso : identifiant de carte (serveur) et QR code dessiné');
    verifier(/Vérifié/.test(await a.evaluate(() => document.querySelector('.JUM-CARTE.verso').innerText)), 'verso : compte « ✔ Vérifié »');
    await a.click('.JUM-CARTE-TOURNE'); await attendre(700);
    verifier(await a.evaluate(() => document.querySelector('.JUM-CARTE-TOURNE').classList.contains('verso')), 'toucher la carte : elle se retourne');
    // Photo : choisie puis cadrée, gardée sur l'appareil.
    const png = Buffer.from(await a.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d');
        x.fillStyle = '#4d5a3a'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#e8c4a6'; x.beginPath(); x.arc(200, 130, 70, 0, 7); x.fill(); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    const choix = a.waitForEvent('filechooser'); await a.click('.JUM-CARTE-PHOTO-BTN');
    await (await choix).setFiles({ name: 'moi.png', mimeType: 'image/png', buffer: png }); await attendre(1200);
    verifier(await a.evaluate(() => !!document.querySelector('.JUM-CARTE-CADRE canvas')), 'photo : fenêtre de cadrage (glisser, zoom)');
    await a.click('.JUM-CARTE-CADRE .JUM-R-PRINCIPAL'); await attendre(800);
    verifier(await a.evaluate(() => /^data:image\/jpeg/.test(localStorage.getItem('trigone_carte_photo') || '') && !!document.querySelector('.JUM-CARTE.recto .JUM-CARTE-PHOTO img')), 'photo cadrée : sur la carte, gardée sur l\'appareil');
    // Plein écran
    await a.click('.JUM-CARTE-GRAND'); await attendre(800);
    verifier(await a.evaluate(() => !!document.querySelector('.JUM-CARTE-PLEIN .JUM-CARTE')), '« Afficher en grand » : la carte occupe l\'écran');
    await a.click('.JUM-CARTE-QUITTER'); await attendre(500);
    verifier(await a.evaluate(() => !document.querySelector('.JUM-CARTE-PLEIN')), 'plein écran refermé (✕)');
    const lien = await a.evaluate(id => location.origin + '/?carte=' + id, memo.id);
    // Le QR code dessiné se lit vraiment (lecteur jsQR livré avec l'appli) et donne le lien de la carte.
    const decode = await a.evaluate(() => new Promise(ok => { const s = document.createElement('script'); s.src = 'vendor/jsqr.min.js'; s.onload = () => {
        const c = document.querySelector('.JUM-CARTE.verso .JUM-CARTE-QR canvas'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        const q = jsQR(x.data, c.width, c.height); ok(q ? q.data : ''); }; document.head.appendChild(s); }));
    verifier(decode === lien, 'QR code du verso lu par le lecteur : lien de la carte (' + decode.replace(/carte=.*/, 'carte=…') + ')');
    // Page de vérification (appareil photo d'un téléphone sans compte) : identité limitée, sans mail ni NID.
    const ctxV = await b.newContext({ viewport: { width: 390, height: 844 } }), v = await ctxV.newPage();
    v.on('pageerror', e => erreurs.push('V : ' + e.message));
    await v.goto(lien); await attendre(2500);
    const verif = await v.evaluate(() => (document.querySelector('.JUM-VERIF-RES') || {}).innerText || '');
    verifier(/authentique/.test(verif) && /SGT CARTIER Lou/.test(verif) && /Vérifié le/.test(verif), 'page de vérification : « Carte TRIGONE authentique », grade et nom, heure de vérification');
    const pub = await v.evaluate(id => fetch('api/carte?id=' + id).then(r => r.json()), memo.id);
    verifier(pub.valide && !pub.carte.mail && !pub.carte.nid, 'lecture sans compte : ni mail ni NID');
    await v.goto(URL + '?carte=CarteInventee12345'); await attendre(2000);
    verifier(/non reconnue/.test(await v.evaluate(() => (document.querySelector('.JUM-VERIF-RES') || {}).innerText || '')), 'carte inventée : « Carte non reconnue »');
    // Lecteur (autre compte) : mail du 1er valideur repris de la carte.
    const { p: l } = await appareil('B', { grade: 'ADJ', nom: 'LECTEUR', prenom: 'Max' });
    await l.evaluate(() => JUMELAGE_REGLAGES({ vue: 'profil' })); await attendre(600);
    verifier(await l.evaluate(() => !!document.querySelector('#JUM-R-MAILVAL1 + .JUM-SCAN-CHAMP')), 'Mon profil : bouton « scanner sa carte » à côté du mail du 1er valideur');
    await l.click('#JUM-R-MAILVAL1 + .JUM-SCAN-CHAMP'); await attendre(800);
    await l.evaluate(x => document.querySelector('.JUM-SCAN')._lire(x), lien); await attendre(1500);
    verifier(await l.evaluate(() => document.getElementById('JUM-R-MAILVAL1').value) === MAILS.A && await l.evaluate(() => !document.querySelector('.JUM-SCAN')), 'carte scannée : le mail du 1er valideur est rempli (sans faute de frappe)');
    await l.evaluate(() => JUMELAGE_FERMER_REGLAGES());
    // Mise en route : personnes d'une demande collective ajoutées par leur carte.
    await l.evaluate(() => { if (typeof NOUVELLE_DEMANDE === 'function') NOUVELLE_DEMANDE(); }); await attendre(800);
    if (await l.evaluate(() => typeof SCANNER_PERSONNES === 'function' && typeof D !== 'undefined' && !!D)) {
        await l.evaluate(() => SCANNER_PERSONNES()); await attendre(600);
        await l.evaluate(x => document.querySelector('.JUM-SCAN')._lire(x), lien); await attendre(1500);
        const pers = await l.evaluate(() => D.personnes.map(p => [p.grade, p.nom, p.prenom, p.matricule, p.cie].join('|')));
        verifier(pers.some(x => x === 'SGT|CARTIER|Lou|' + nidA + '|2CIE'), 'demande collective : la personne scannée est ajoutée (grade, nom, matricule, CIE)');
        verifier(/Ajouté .*extérieur \(1°RIISC\)/.test(await l.evaluate(() => document.querySelector('.JUM-SCAN-RES').innerText)), 'scan en continu : « ✔ Ajouté · extérieur (1°RIISC) » (autre unité), la caméra reste ouverte');
        await l.evaluate(x => document.querySelector('.JUM-SCAN')._lire(x), lien + '&'); await attendre(1200);
        verifier(/Déjà dans la demande/.test(await l.evaluate(() => document.querySelector('.JUM-SCAN-RES').innerText)), 'même carte une 2e fois : « Déjà dans la demande »');
        await l.click('.JUM-SCAN-FERMER'); await attendre(300);
    } else verifier(false, 'Mise en route : formulaire de demande introuvable');
    // Compte-rendu (chef de mission collective) : pointage des présents.
    await l.goto(URL + 'cr/'); await attendre(2500);
    await l.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); M.COLLECTIVE = true; M.IS_PAX = false; M.PARTICIPANTS = []; RENDRE_EQUIPE_MER(); });
    await l.evaluate(() => POINTER_PRESENTS()); await attendre(600);
    await l.evaluate(x => document.querySelector('.JUM-SCAN')._lire(x), lien); await attendre(1500);
    const pres = await l.evaluate(() => M.PARTICIPANTS.map(p => p.nom + '|' + p.mail + '|' + (p.present || '')));
    verifier(pres.length === 1 && pres[0].indexOf('CARTIER|' + MAILS.A + '|') === 0 && / à \d\dh\d\d$/.test(pres[0]), 'pointage au départ : participant ajouté, présent à l\'heure du scan');
    await l.click('.JUM-SCAN-FERMER'); await attendre(300);
    const eqTxt = await l.evaluate(() => document.getElementById('MER-EQUIPE').innerText);
    verifier(/présent au départ le/.test(eqTxt) && /1°RIISC \(extérieur\)/.test(eqTxt), 'liste des participants : « 1°RIISC (extérieur) », « présent au départ le … »');
    // PC : recto et verso côte à côte, sans retournement ni plein écran.
    const ctxPc = await b.newContext({ viewport: { width: 1440, height: 900 } }), pc = await ctxPc.newPage();
    pc.on('pageerror', e => erreurs.push('PC : ' + e.message));
    await pc.goto(URL); await pc.evaluate(preparer, APP_CODE); await pc.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await pc.reload(); await attendre(2500);
    await pc.evaluate(() => JUMELAGE_CARTE()); await attendre(800);
    verifier(await pc.evaluate(() => document.querySelectorAll('.JUM-CARTE-DUO .JUM-CARTE').length === 2 && !document.querySelector('.JUM-CARTE-GRAND')), 'PC : recto et verso côte à côte, pas de plein écran');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
