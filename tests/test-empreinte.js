// Empreinte digitale (ou visage) : activée dans Paramètres, proposée à l'ouverture, le code à 4 chiffres restant en secours.
// Capteur simulé par le navigateur (WebAuthn, authentificateur virtuel intégré à l'appareil).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), erreurs = [];
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const p = await ctx.newPage(); p.on('pageerror', e => erreurs.push(e.message));
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.reload(); await attendre(2500);
    // Code à 4 chiffres d'abord, puis Paramètres › Code d'accès : « Activer l'empreinte ».
    await p.evaluate(() => JUMELAGE_POSER_CODE('1234')); await attendre(300);
    await p.evaluate(() => JUMELAGE_REGLAGES()); await attendre(800);
    verifier(/Activer l'empreinte/.test(await p.evaluate(() => (document.getElementById('JUM-R-BIO') || {}).textContent || '')), 'Paramètres : « Activer l\'empreinte » proposé (capteur présent, code actif)');
    await p.evaluate(() => JUMELAGE_BIO_BASCULER()); await attendre(1500);
    verifier(await p.evaluate(() => !!localStorage.getItem('trigone_bio_id') && /Empreinte activée/.test(document.getElementById('JUM-R-BIO').textContent)), 'empreinte activée (enregistrée sur l\'appareil)');
    await p.evaluate(() => JUMELAGE_FERMER_REGLAGES());
    // Nouvelle ouverture : empreinte proposée d'office → TRIGONE s'ouvre.
    const p2 = await ctx.newPage(); p2.on('pageerror', e => erreurs.push(e.message));
    const cdp2 = await ctx.newCDPSession(p2); await cdp2.send('WebAuthn.enable');
    const auth2 = await cdp2.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    const cred = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials[0];
    await cdp2.send('WebAuthn.addCredential', { authenticatorId: auth2.authenticatorId, credential: cred });
    await p2.goto(srv.url); await attendre(500);
    verifier(await p2.evaluate(() => !!document.querySelector('.JUM-PIN .JUM-PIN-BIO')) || await p2.evaluate(() => !document.querySelector('.JUM-PIN')), 'ouverture : touche empreinte sur le pavé du code');
    await attendre(2500);
    verifier(await p2.evaluate(() => !document.querySelector('.JUM-PIN')), 'empreinte reconnue : TRIGONE s\'ouvre sans le code');
    // Empreinte refusée (personne non vérifiée) : message, le code à 4 chiffres ouvre toujours.
    await cdp2.send('WebAuthn.setUserVerified', { authenticatorId: auth2.authenticatorId, isUserVerified: false });
    const p3 = await ctx.newPage(); p3.on('pageerror', e => erreurs.push(e.message));
    const cdp3 = await ctx.newCDPSession(p3); await cdp3.send('WebAuthn.enable');
    const auth3 = await cdp3.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: false, automaticPresenceSimulation: true } });
    await cdp3.send('WebAuthn.addCredential', { authenticatorId: auth3.authenticatorId, credential: cred });
    await p3.goto(srv.url); await attendre(3000);
    verifier(await p3.evaluate(() => !!document.querySelector('.JUM-PIN')), 'empreinte non vérifiée : le code reste demandé');
    await p3.keyboard.type('1234'); await attendre(800);
    verifier(await p3.evaluate(() => !document.querySelector('.JUM-PIN')), 'secours : le code à 4 chiffres ouvre TRIGONE');
    // Désactivation, et suppression du code : l'empreinte part avec lui.
    await p3.evaluate(() => JUMELAGE_REGLAGES()); await attendre(800);
    await p3.evaluate(() => JUMELAGE_BIO_BASCULER()); await attendre(400);
    verifier(await p3.evaluate(() => !localStorage.getItem('trigone_bio_id')), 'Paramètres : « Désactiver l\'empreinte »');
    await p3.evaluate(() => { localStorage.setItem('trigone_bio_id', 'x'); JUMELAGE_EFFACER_CODE(); });
    verifier(await p3.evaluate(() => !localStorage.getItem('trigone_bio_id')), 'code supprimé : l\'empreinte est retirée aussi');
    // PC : pas d'empreinte (code au clavier uniquement).
    const pc = await b.newContext({ viewport: { width: 1600, height: 900 } }), pp = await pc.newPage();
    const cdpPc = await pc.newCDPSession(pp); await cdpPc.send('WebAuthn.enable');
    await cdpPc.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await pp.goto(srv.url); await pp.evaluate(preparer, APP_CODE); await pp.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await pp.reload(); await attendre(2000);
    await pp.evaluate(() => JUMELAGE_POSER_CODE('1234')); await pp.evaluate(() => JUMELAGE_REGLAGES()); await attendre(800);
    verifier(await pp.evaluate(() => !((document.getElementById('JUM-R-BIO') || {}).textContent || '').trim()), 'PC : pas d\'option empreinte (téléphone seulement)');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
