// Remontée des erreurs : un bug sur un appareil est envoyé au serveur, anonyme (mail et chiffres masqués), regroupé ;
// seul l'administrateur (ADMIN_MAILS ; en test : comptes « admin.… ») voit la page « Erreurs de l'appli ».
// Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), suffixe = Date.now().toString(36);
    async function appareil(mail) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
        p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', mail); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        return p;
    }
    const agent = await appareil('agent.' + suffixe + '@interieur.gouv.fr');
    const marque = 'Bug de test ' + suffixe;
    // Le même bug, deux fois au même endroit du code : une seule ligne dans la liste.
    await agent.evaluate(m => { const bug = () => { throw new Error(m + ' (jean.dupont@interieur.gouv.fr, NID 067 50 10 191)'); }; setTimeout(bug, 0); setTimeout(bug, 50); }, marque);
    await attendre(1500);
    const api = (p, chemin) => p.evaluate(async c => { const x = JSON.parse(localStorage.getItem('trigone_compte'));
        const r = await fetch('api/' + c, { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(x.mail) + ' ' + x.appareil + ' ' + x.jeton } }); return { statut: r.status, j: await r.json() }; }, chemin);
    verifier((await api(agent, 'erreurs')).statut === 403, 'compte ordinaire : la liste des erreurs lui est refusée');
    await agent.evaluate(() => JUMELAGE_PARAMETRES('aide')); await attendre(1200);
    verifier(!(await agent.$('.JUM-PARAM [data-action="erreurs"]')), 'compte ordinaire : pas de ligne « Erreurs de l\'appli » dans Paramètres › Aide');
    const admin = await appareil('admin.' + suffixe + '@interieur.gouv.fr');
    await admin.evaluate(() => JUMELAGE_PARAMETRES('aide')); await attendre(1500);
    verifier(!!(await admin.$('.JUM-PARAM [data-action="erreurs"]')), 'administrateur : ligne « Erreurs de l\'appli » dans Paramètres › Aide');
    await admin.click('.JUM-PARAM [data-action="erreurs"]'); await attendre(1500);
    const carte = await admin.evaluate(m => { const c = [...document.querySelectorAll('.JUM-ERR')].find(e => e.textContent.includes(m)); return c ? c.innerText : ''; }, marque);
    verifier(!!carte && /Mise en route/.test(carte) && /1 fois/.test(carte) && /V\d+/.test(carte), 'administrateur : l\'erreur apparaît une fois (écran, nombre de fois, version) — le même bug n\'est envoyé qu\'une fois par ouverture');
    verifier(!!carte && !/jean\.dupont|067 50 10 191/.test(carte) && /<mail>/.test(carte), 'erreur anonyme : adresse mail et numéros masqués');
    await admin.evaluate(m => { const c = [...document.querySelectorAll('.JUM-ERR')].find(e => e.textContent.includes(m)); c.querySelector('[data-corrige]').click(); }, marque);
    await attendre(1500);
    verifier(await admin.evaluate(m => ![...document.querySelectorAll('.JUM-ERR')].some(e => e.textContent.includes(m)), marque), '« Corrigée » : l\'erreur quitte la liste');
    await b.close();
};
