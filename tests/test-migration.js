// Passage d'un ancien compte (adresse mail personnelle) à son adresse prenom.nom@trigone-app.com : compte, rôles,
// carte et boîte suivent ; l'ancienne adresse n'est plus enregistrée mais ce qui y est envoyé arrive quand même ; les
// autres appareils du compte suivent ; l'administrateur de TRIGONE le reste. Plus de connexion par mail en service.
// Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36), L = s.toUpperCase().replace(/[^A-Z]/g, 'X');
    const MAILS = { A: 'admin.mig' + s + '@interieur.gouv.fr', B: 'expediteur.mig' + s + '@interieur.gouv.fr' };
    const api = (q, chemin, corps) => q.evaluate(([chemin, corps]) => { const k = JSON.parse(localStorage.getItem('trigone_compte') || '{}'); return fetch('api/' + chemin, { method: corps ? 'POST' : 'GET',
        headers: { Authorization: 'TRIGONE ' + encodeURIComponent(k.mail) + ' ' + k.appareil + ' ' + k.jeton, 'Content-Type': 'application/json', 'X-Trigone-Unite': '4RIISC' }, body: corps ? JSON.stringify(corps) : undefined }).then(r => r.json().then(j => Object.assign(j, { statut: r.status }))); }, [chemin, corps]);
    async function appareil(nom, ctxExistant) {
        const ctx = ctxExistant || await b.newContext({ viewport: { width: 480, height: 1000 } }), q = await ctx.newPage();
        q.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); q.on('dialog', d => d.accept());
        await q.goto(URL); await q.evaluate(preparer, APP_CODE); await q.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await q.evaluate(([n, p, m]) => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.nom = n; r.prenom = p; r.monMail = m; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); }, nom === 'A' ? ['MIGRE' + L, 'Paul', MAILS.A] : ['EXPE' + L, 'Luc', MAILS.B]);
        await q.reload(); await attendre(2500);
        await q.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await q.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await q.fill('#JUM-C-MAIL', MAILS[nom]); await q.click('#JUM-C-ENVOI'); await attendre(1500);
        await q.click('#JUM-C-VALIDER'); await attendre(2000);
        await q.evaluate(() => { JUMELAGE_FERMER_COMPTE(); document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); });
        return q;
    }
    const a = await appareil('A'), bb = await appareil('B');
    await api(a, 'unite', { grade: 'ADJ', nom: 'MIGRE' + L, prenom: 'Paul' }); await api(a, 'roles', { ajouter: ['chorus'] });
    const carte = await api(a, 'carte', { grade: 'ADJ', nom: 'MIGRE' + L, prenom: 'Paul', unite: '4°RIISC', cie: '', nid: '' });
    // 2e appareil du même compte (code de liaison), qui ne sera pas prévenu tout de suite.
    const code = await a.evaluate(() => JUMELAGE_LIAISON_CREER());
    const ctx2 = await b.newContext({ viewport: { width: 480, height: 1000 } }), a2 = await ctx2.newPage();
    a2.on('pageerror', e => erreurs.push('A2 : ' + e.message)); a2.on('dialog', d => d.accept());
    await a2.goto(URL); await a2.evaluate(preparer, APP_CODE); await a2.reload(); await attendre(2000);
    const lie = await a2.evaluate(c => JUMELAGE_LIAISON_UTILISER(c).then(m => m, e => 'ERR ' + (e.message || e)), code.code || code);
    verifier(lie === MAILS.A, 'compte avec adresse mail, sur deux appareils (' + lie + ')');
    // Passage à l'adresse TRIGONE.
    const m = await a.evaluate(() => JUMELAGE_MIGRER()); await attendre(800);
    const attendu = 'paul.migre' + L.toLowerCase() + '@trigone-app.com';
    verifier(m && m.ok && m.mail === attendu && await a.evaluate(() => JSON.parse(localStorage.getItem('trigone_compte')).mail) === attendu
        && (await a.evaluate(() => JSON.parse(localStorage.getItem('trigone_reglages_communs')).monMail)) === attendu, 'passage à l\'adresse TRIGONE : ' + (m && m.mail) + ' (compte et profil de l\'appareil à jour)');
    const et2 = await api(a2, 'compte/etat');
    verifier(et2.ok && et2.compte === attendu, 'l\'autre appareil (encore à l\'ancienne adresse) reste connecté et apprend la nouvelle');
    const ann = await api(bb, 'annuaire?role=chorus');
    verifier((ann.personnes || []).some(x => x.mail === attendu) && !(ann.personnes || []).some(x => x.mail === MAILS.A), 'rôles et unité suivent (annuaire : nouvelle adresse, plus l\'ancienne)');
    const lu = await api(bb, 'carte?id=' + encodeURIComponent(carte.id || ''));
    verifier(lu.carte && lu.carte.mail === attendu, 'la carte TRIGONE suit (même QR code)');
    // Envoi encore adressé à l'ancienne adresse : il arrive.
    const cl = await api(bb, 'cles?mail=' + encodeURIComponent(MAILS.A));
    verifier(cl.compte && cl.mail === attendu, 'l\'ancienne adresse retrouve le compte (sans être gardée en clair)');
    const env = await bb.evaluate(dest => JUMELAGE_ENVOYER_DIRECT(dest, 'QUESTION', 'Q.json', JSON.stringify({ app: 'TRIGONE-QUESTION', ref: 'x', genre: 'registre', objet: 'T', question: 'Reçu ?', qui: 'X' })), MAILS.A);
    await a.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    verifier(env.id && await a.evaluate(id => JSON.parse(localStorage.getItem('trigone_boite') || '[]').some(x => x.id === id), env.id), 'envoi fait à l\'ancienne adresse : reçu dans la boîte du compte');
    // Administrateur de TRIGONE (son ancienne adresse dans ADMIN_MAILS) : il le reste.
    const dem = await api(a, 'compte/demandes');
    verifier(dem.superAdmin === true, 'administrateur de TRIGONE : il le reste sous sa nouvelle adresse');
    verifier((await api(a, 'compte/migrer', {})).deja === true, 'compte déjà passé : rien à refaire');
    const etat = await a.evaluate(() => fetch('api/etat').then(r => r.json()));
    verifier(etat.connexionMail === true, 'serveur de test : connexion par mail gardée pour les tests (désactivée en service)');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
