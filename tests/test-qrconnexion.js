// QR de connexion : Ma carte › « QR de connexion » (code de liaison en QR, 15 min, une fois) ; sur un appareil neuf,
// « J'ai déjà TRIGONE sur un autre appareil » › « Depuis une image » (capture d'écran du QR) : compte et données repris.
// Demande le serveur de test (TRIGONE_URL_BOITE).
const fs = require('fs'), os = require('os'), path = require('path');
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36), MAIL = 'qrco.' + s + '@interieur.gouv.fr';
    const ctxA = await b.newContext({ viewport: { width: 480, height: 1000 }, acceptDownloads: true }), a = await ctxA.newPage();
    a.on('pageerror', e => erreurs.push('A : ' + e.message));
    await a.goto(URL); await a.evaluate(preparer, APP_CODE); await a.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await a.reload(); await attendre(2500);
    await a.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
    await a.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await a.fill('#JUM-C-MAIL', MAIL); await a.click('#JUM-C-ENVOI'); await attendre(1500);
    await a.click('#JUM-C-VALIDER'); await attendre(2000);
    await a.evaluate(() => { JUMELAGE_FERMER_COMPTE(); document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); localStorage.setItem('trigone_qr_temoin', 'donnée de A');
        localStorage.setItem('trigone_boite', JSON.stringify([{ id: 'qrb1', nature: 'question', statut: 'nouveau', le: Date.now(), de: 'x@test.fr', objet: 'Envoi de A', question: 'Reçu ?' }])); });
    await a.evaluate(() => caches.open('trigone-boite-reception').then(c => c.put(new URL('__boite__/qrb1', location.href).href, new Response('{"contenu":"fichier de A"}'))));
    await a.evaluate(() => JUMELAGE_CARTE()); await attendre(1200);
    verifier(await a.isVisible('.JUM-CARTE-QRCO'), 'Ma carte : bouton « QR de connexion (autre appareil) »');
    await a.click('.JUM-CARTE-QRCO'); await attendre(4000);
    const png = await a.evaluate(() => { const c = document.querySelector('.JUM-QRCO-BOITE canvas'); return c ? c.toDataURL('image/png') : ''; });
    const code = await a.evaluate(() => (document.querySelector('.JUM-QRCO-CODE b') || {}).textContent || '');
    verifier(png.length > 1000 && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), 'QR de connexion affiché, avec son code et le temps restant (' + code + ')');
    const fichier = path.join(os.tmpdir(), 'qrco-' + s + '.png');
    // Capture d'écran : le QR dans une image plus grande, avec du blanc autour.
    const capture = await a.evaluate(src => new Promise(ok => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = 900; c.height = 1400; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 1400); x.fillStyle = '#222'; x.fillRect(0, 0, 900, 200); x.drawImage(i, 250, 500, 400, 400); ok(c.toDataURL('image/png')); }; i.src = src; }), png);
    fs.writeFileSync(fichier, Buffer.from(capture.split(',')[1], 'base64'));
    // Appareil neuf.
    const ctxB = await b.newContext({ viewport: { width: 480, height: 1000 } }), n = await ctxB.newPage();
    n.on('pageerror', e => erreurs.push('B : ' + e.message)); n.on('dialog', d => d.accept());
    await n.goto(URL); await n.evaluate(preparer, APP_CODE); await n.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await n.reload(); await attendre(2500);
    await n.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
    await n.evaluate(() => { const l = [...document.querySelectorAll('[data-aller="liaison"]')].find(e => e.offsetParent) || document.querySelector('.JUM-ACC-AUTRE'); if (l) l.click(); }); await attendre(400);
    verifier(await n.isVisible('#JUM-L-CAM') && await n.isVisible('#JUM-L-IMG'), 'appareil neuf : « Scanner le QR de connexion » et « Depuis une image »');
    await n.setInputFiles('#JUM-L-IMG input', fichier); await attendre(9000);
    const apres = await n.evaluate(() => ({ c: JSON.parse(localStorage.getItem('trigone_compte') || '{}').mail, t: localStorage.getItem('trigone_qr_temoin') }));
    const boiteB = await n.evaluate(() => caches.open('trigone-boite-reception').then(c => c.match(new URL('__boite__/qrb1', location.href).href)).then(r => r ? r.text() : '').then(t => ({ l: JSON.parse(localStorage.getItem('trigone_boite') || '[]').map(x => x.id), t })));
    verifier(boiteB.l.indexOf('qrb1') >= 0 && /fichier de A/.test(boiteB.t), 'la boîte de réception suit aussi (envois reçus et leur contenu)');
    verifier(apres.c === MAIL && apres.t === 'donnée de A', 'depuis une capture d\'écran du QR : appareil connecté au même compte, données reprises');
    // Lien du QR scanné avec l'appareil photo : …?liaison=CODE ouvre l'écran de liaison, code saisi.
    await a.click('.JUM-QRCO-FERMER'); await a.click('.JUM-CARTE-QRCO'); await attendre(4000);
    const code2 = (await a.evaluate(() => (document.querySelector('.JUM-QRCO-CODE b') || {}).textContent || '')).replace('-', '');
    const ctxC = await b.newContext({ viewport: { width: 480, height: 1000 } }), q = await ctxC.newPage();
    q.on('pageerror', e => erreurs.push('C : ' + e.message));
    await q.goto(URL); await q.evaluate(preparer, APP_CODE); await q.goto(URL + '?liaison=' + code2); await attendre(4500);
    verifier((await q.evaluate(() => (document.getElementById('JUM-L-CODE') || {}).value || '')).replace('-', '') === code2, 'QR scanné avec l\'appareil photo : TRIGONE s\'ouvre sur la liaison, code déjà saisi');
    try { fs.unlinkSync(fichier); } catch (e) {}
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
