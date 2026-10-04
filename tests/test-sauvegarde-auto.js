// Sauvegarde automatique chiffrée dans le compte TRIGONE : activée avec un code de récupération (affiché une fois),
// chiffrée sur l'appareil (le serveur ne peut pas la lire), restaurée sur un nouvel appareil juste après la connexion,
// avec le code ; mauvais code refusé ; le compte du nouvel appareil est gardé. Demande le serveur de test.
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
    // Appareil A : des données, puis activation.
    const a = await appareil('A');
    await a.evaluate(() => { document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); localStorage.setItem('mer_bibliotheque', JSON.stringify([{ id: 'e1', envoyeLe: '2026-09-01', demandes: [{ id: 'd1', objet: 'MARQUEUR SECRET 4815' }] }])); });
    await a.evaluate(() => JUMELAGE_SAUVEGARDE_AUTO()); await attendre(400);
    await a.click('#JUM-S-ACT'); await attendre(400);
    const code = await a.textContent('#JUM-S-CODE');
    verifier(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/.test(code), 'activation : code de récupération de 20 caractères affiché (' + code.replace(/[A-Z2-9]/g, 'X') + ')');
    verifier(await a.evaluate(() => document.getElementById('JUM-S-GO').disabled), 'activation impossible tant que « J\'ai noté ce code » n\'est pas coché');
    await a.check('#JUM-S-NOTE'); await a.click('#JUM-S-GO'); await attendre(4000);
    const etat = await a.evaluate(() => JSON.parse(localStorage.getItem('trigone_sauvegarde_auto') || '{}'));
    verifier(etat.actif && etat.derniere > 0 && !JSON.stringify(etat).includes(code.slice(0, 4) + code.slice(5, 9)), 'première copie envoyée ; le code n\'est pas gardé sur l\'appareil');
    const brut = await a.evaluate(async () => { const x = JSON.parse(localStorage.getItem('trigone_compte'));
        return (await fetch('api/sauvegarde', { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(x.mail) + ' ' + x.appareil + ' ' + x.jeton } })).text(); });
    verifier(brut.length > 200 && !/MARQUEUR|4815|mer_bibliotheque/.test(brut) && !/MARQUEUR|mer_bibliotheque/.test(Buffer.from(JSON.parse(brut).ct, 'base64').toString('latin1')),
        'serveur : la sauvegarde est illisible (aucune donnée en clair)');
    // Appareil B : nouveau téléphone, sans profil ; connexion au même compte → la sauvegarde est proposée.
    const bb = await appareil('B', () => { localStorage.removeItem('trigone_reglages_communs'); localStorage.removeItem('mer_config_faite'); });
    verifier(await bb.evaluate(() => /Une sauvegarde vous attend/.test(document.body.innerText)), 'nouvel appareil : « Une sauvegarde vous attend » juste après la connexion');
    const compteB = await bb.evaluate(() => JSON.parse(localStorage.getItem('trigone_compte')).appareil);
    await bb.fill('#JUM-S-SAISIE', 'AAAA-BBBB-CCCC-DDDD-EEEE'); await bb.click('#JUM-S-REST'); await attendre(3000);
    verifier(/Code incorrect/.test(await bb.textContent('#JUM-S-ERR')), 'mauvais code : refusé (« Code incorrect »)');
    await bb.fill('#JUM-S-SAISIE', code.toLowerCase().replace(/-/g, ' ')); await bb.click('#JUM-S-REST'); await attendre(6000);
    const r = await bb.evaluate(() => ({ biblio: localStorage.getItem('mer_bibliotheque') || '', compte: JSON.parse(localStorage.getItem('trigone_compte') || '{}').appareil,
        auto: JSON.parse(localStorage.getItem('trigone_sauvegarde_auto') || '{}').actif }));
    verifier(/MARQUEUR SECRET 4815/.test(r.biblio), 'bon code (minuscules et espaces acceptés) : les données reviennent sur le nouvel appareil');
    verifier(r.compte === compteB, 'le compte du nouvel appareil est gardé (il reste connecté)');
    verifier(r.auto, 'le nouvel appareil continue les copies automatiques');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
