// Sauvegarde automatique du compte (V197) : activée d'office, chiffrée sur l'appareil avec la clé du compte (rien en
// clair sur le serveur), restaurée toute seule sur un nouvel appareil juste après la connexion ; le compte du nouvel
// appareil est gardé et continue les copies. Demande le serveur de test.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36), MAIL = 'sauvegarde.' + suffixe + '@interieur.gouv.fr';
    async function appareil(nom, avant) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        if (avant) await p.evaluate(avant);
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', MAIL); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(2500);
        return p;
    }
    // Appareil A : des données, pu    // Appareil A : des données ; la sauvegarde du compte se met en route d'elle-même (sans code de récupération).
    const a = await appareil('A');
    await a.evaluate(() => { document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); localStorage.setItem('mer_bibliotheque', JSON.stringify([{ id: 'e1', envoyeLe: '2026-09-01', demandes: [{ id: 'd1', objet: 'MARQUEUR SECRET 4815' }] }])); });
    await a.evaluate(() => JUMELAGE_SAUVEGARDE_AUTO()); await attendre(4000);
    verifier(!(await a.$('#JUM-S-CODE')) && /Toujours active/.test(await a.evaluate(() => document.body.innerText)), 'plus de code de récupération : sauvegarde du compte « toujours active »');
    const etat = await a.evaluate(() => JSON.parse(localStorage.getItem('trigone_sauvegarde_auto') || '{}'));
    verifier(etat.actif && etat.v === 2 && etat.derniere > 0, 'première copie envoyée (clé du compte)');
    const brut = await a.evaluate(async () => { const x = JSON.parse(localStorage.getItem('trigone_compte'));
        return (await fetch('api/sauvegarde', { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(x.mail) + ' ' + x.appareil + ' ' + x.jeton } })).text(); });
    verifier(brut.length > 200 && !/MARQUEUR|4815|mer_bibliotheque/.test(brut) && !/MARQUEUR|mer_bibliotheque/.test(Buffer.from(JSON.parse(brut).ct, 'base64').toString('latin1')),
        'serveur : la sauvegarde est chiffrée (aucune donnée en clair)');
    await a.evaluate(() => JUMELAGE_FERMER_SAUVEGARDE_AUTO());
    // Appareil B : nouveau téléphone, sans profil ; connexion au même compte → tout revient tout seul.
    // (Profil effacé après la connexion : sans profil ni compte, l'accueil est imposé dès l'ouverture depuis la V197.)
    const bb = await appareil('B');
    await bb.evaluate(() => { localStorage.removeItem('trigone_reglages_communs'); localStorage.removeItem('mer_config_faite'); localStorage.removeItem('mer_bibliotheque'); });
    const compteB = await bb.evaluate(() => JSON.parse(localStorage.getItem('trigone_compte') || '{}').appareil);
    await bb.evaluate(() => JUMELAGE_RESTAURER_COMPTE({ apresConnexion: true })); await attendre(7000);
    const r = await bb.evaluate(() => ({ biblio: localStorage.getItem('mer_bibliotheque') || '', compte: JSON.parse(localStorage.getItem('trigone_compte') || '{}').appareil,
        auto: JSON.parse(localStorage.getItem('trigone_sauvegarde_auto') || '{}') }));
    verifier(/MARQUEUR SECRET 4815/.test(r.biblio), 'nouvel appareil : les données reviennent toutes seules, sans code');
    verifier(r.compte === compteB, 'le compte du nouvel appareil est gardé (il reste connecté)');
    verifier(r.auto.actif && r.auto.v === 2, 'le nouvel appareil continue les copies automatiques');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
