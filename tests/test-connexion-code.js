// Reconnexion avec l'adresse TRIGONE et le code à 4 chiffres (celui qui ouvre l'appli) : code déclaré au compte,
// connexion d'un appareil neuf, erreurs comptées (5 → attente, 10 → coupé), appareil ajouté, même code sur le nouvel appareil.
// Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36), MAIL = 'cnx.' + s + '@interieur.gouv.fr';
    async function appareil(nom) {
        const p = await (await b.newContext({ viewport: { width: 480, height: 1000 } })).newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message));
        await p.goto(URL); await p.evaluate(preparer, APP_CODE); await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await p.reload(); await attendre(2500);
        return p;
    }
    const a = await appareil('A');
    await a.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
    await a.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await a.fill('#JUM-C-MAIL', MAIL); await a.click('#JUM-C-ENVOI'); await attendre(1500);
    await a.click('#JUM-C-VALIDER'); await attendre(2000);
    await a.evaluate(() => JUMELAGE_FERMER_COMPTE());
    await a.evaluate(() => JUMELAGE_POSER_CODE('4821')); await attendre(2500);
    verifier(await a.evaluate(() => !!localStorage.getItem('trigone_code_cnx') && localStorage.getItem('trigone_code_cnx') === localStorage.getItem('trigone_code_commun')), 'code à 4 chiffres choisi : déclaré au compte (reconnexion possible)');
    // Appareil neuf : l'onglet « Se connecter » propose adresse + code.
    const n = await appareil('N');
    await n.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
    await n.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await attendre(300);
    verifier(await n.isVisible('#JUM-C-PADR') && await n.isVisible('#JUM-C-PCODE') && await n.isVisible('#JUM-C-PGO'), '« Se connecter » : adresse TRIGONE + code à 4 chiffres');
    await n.fill('#JUM-C-PADR', MAIL); await n.fill('#JUM-C-PCODE', '1111'); await n.click('#JUM-C-PGO'); await attendre(2500);
    const e1 = await n.evaluate(() => document.getElementById('JUM-C-ERR').textContent);
    verifier(/incorrect/.test(e1) && /9 essai/.test(e1) && await n.evaluate(() => !localStorage.getItem('trigone_compte')), 'code faux refusé, essais restants affichés (« ' + e1 + ' »)');
    for (let i = 0; i < 4; i++) await n.evaluate(m => JUMELAGE_CONNEXION_CODE(m, '1112').catch(() => {}), MAIL);
    const e2 = await n.evaluate(m => JUMELAGE_CONNEXION_CODE(m, '4821').then(() => 'ok', e => e.message), MAIL);
    verifier(/réessayez dans/.test(e2), '5 codes faux : attente de 15 minutes, même avec le bon code (« ' + e2 + ' »)');
    verifier(await n.evaluate(() => fetch('api/connexion/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mail: 'personne.inconnue@trigone-app.com', code: '1234', cle: { kty: 'EC', crv: 'P-256', x: 'a', y: 'b' } }) }).then(r => r.json()).then(j => j.erreur || j.message || '')) .then(t => /incorrect/.test(t)), 'adresse inconnue : même message qu\'un code faux (rien ne dit si le compte existe)');
    // Le titulaire rechoisit son code (remet les erreurs à zéro), puis connexion réussie.
    await a.evaluate(() => { localStorage.removeItem('trigone_code_cnx'); return JUMELAGE_POSER_CODE('4821'); }); await attendre(2500);
    // Paramètres › Compte › « Reconnexion adresse + code » : activation à la main (code jamais déclaré, ex. ouverture par empreinte).
    await a.evaluate(() => { localStorage.removeItem('trigone_code_cnx'); window.JUMELAGE_RECONNEXION_CODE(); }); await attendre(400);
    verifier(/Pas encore activée/.test(await a.textContent('#JUM-RC-ETAT')), 'Paramètres : reconnexion « pas encore activée », adresse à utiliser affichée');
    await a.fill('#JUM-RC-CODE', '9999'); await a.click('#JUM-RC-GO'); await attendre(800);
    verifier(/pas votre code/.test(await a.textContent('#JUM-RC-ETAT')), 'activation : mauvais code refusé');
    await a.fill('#JUM-RC-CODE', '4821'); await a.click('#JUM-RC-GO'); await attendre(2500);
    verifier(/Activée/.test(await a.textContent('#JUM-RC-ETAT')) && await a.evaluate(() => localStorage.getItem('trigone_code_cnx') === localStorage.getItem('trigone_code_commun')), 'activation avec le bon code : reconnexion activée');
    await a.evaluate(() => document.querySelectorAll('.JUM-GC-FOND').forEach(e => e.remove()));
    const r = await n.evaluate(m => JUMELAGE_CONNEXION_CODE(m, '4821').then(x => x, e => 'ERR ' + e.message), MAIL);
    verifier(r === MAIL, 'adresse + bon code : compte reconnecté (' + r + ')');
    verifier(await n.evaluate(m => { const c = JSON.parse(localStorage.getItem('trigone_compte') || '{}'); return c.mail === m && !!c.jeton && !!localStorage.getItem('trigone_code_commun') && localStorage.getItem('trigone_reactivation') === '1'; }, MAIL), 'nouvel appareil : compte enregistré, même code pour ouvrir l\'appli, récupération des données proposée');
    verifier(await n.evaluate(() => JUMELAGE_VERIFIER_CODE('4821')), 'nouvel appareil : le code 4821 ouvre TRIGONE');
    const apps = await a.evaluate(() => { const c = JSON.parse(localStorage.getItem('trigone_compte')); return fetch('api/compte/appareils', { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton } }).then(r => r.json()); });
    verifier((apps.appareils || []).length === 2, 'Mes appareils : le nouvel appareil apparaît (' + (apps.appareils || []).length + ')');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
