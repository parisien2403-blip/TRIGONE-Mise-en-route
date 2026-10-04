// Comptes : rôle ADMINISTRATEUR (code vérifié par le serveur), réinitialisation et suppression sur demande à l'assistant
// Chorus DT ou à l'administrateur de l'unité, suppression directe par l'administrateur, effacement des appareils.
// Demande le serveur de test (TRIGONE_URL_BOITE), les codes ASSIST CHORUS DT et ADMINISTRATEUR (TRIGONE_CODE_ADMIN).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE, codeChorus = process.env.TRIGONE_CODE_CHORUS, codeAdmin = process.env.TRIGONE_CODE_ADMIN;
    if (!URL || !codeChorus || !codeAdmin) { console.log('  (sauté : définissez TRIGONE_URL_BOITE, TRIGONE_CODE_CHORUS et TRIGONE_CODE_ADMIN)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36);
    const MAILS = { M: 'miss.' + s + '@interieur.gouv.fr', M2: 'miss2.' + s + '@interieur.gouv.fr', X: 'depart.' + s + '@interieur.gouv.fr', C: 'chorus.' + s + '@interieur.gouv.fr', A: 'admin.' + s + '@interieur.gouv.fr' };
    async function appareil(nom) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(ch => { sessionStorage.setItem('trigone_choix_fait', '1'); const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.mailChorus = ch; r.matricule = ''; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); }, MAILS.C);
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        return p;
    }
    const api = (p, chemin, corps) => p.evaluate(([chemin, corps]) => { const k = JSON.parse(localStorage.getItem('trigone_compte')); return fetch('api/' + chemin, { method: corps ? 'POST' : 'GET',
        headers: { Authorization: 'TRIGONE ' + encodeURIComponent(k.mail) + ' ' + k.appareil + ' ' + k.jeton, 'Content-Type': 'application/json', 'X-Trigone-Unite': '4RIISC' }, body: corps ? JSON.stringify(corps) : undefined }).then(r => r.json().then(j => Object.assign(j, { statut: r.status }))); }, [chemin, corps]);
    const role = async (p, id, code) => { await p.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(400); await p.check('#JUM-R-' + id); await p.fill('#JUM-R-CODE' + id, code); await p.click('.JUM-R-PRINCIPAL'); await attendre(2000); };
    const m = await appareil('M'), c = await appareil('C'), a = await appareil('A');
    await role(c, 'CHORUS', codeChorus);
    // Administrateur : mauvais code refusé (par le serveur), bon code accepté.
    await role(a, 'ADMIN', 'MAUVAIS-CODE');
    verifier(await a.evaluate(() => !localStorage.getItem('trigone_role_admin') && /ADMINISTRATEUR incorrect/.test(document.body.innerText)), 'ADMINISTRATEUR : mauvais code refusé par le serveur');
    await a.evaluate(() => { const f = document.querySelector('.JUM-R-FOND, .JUM-REGLAGES'); if (window.JUMELAGE_FERMER_REGLAGES) JUMELAGE_FERMER_REGLAGES(); });
    await role(a, 'ADMIN', codeAdmin);
    verifier(await a.evaluate(() => localStorage.getItem('trigone_role_admin') === '4RIISC'), 'ADMINISTRATEUR : bon code, administrateur du 4°RIISC');
    // Missionnaire : plus d'effacement direct, des demandes.
    const lignes = await m.evaluate(() => { JUMELAGE_PARAMETRES(); const b = document.querySelector('.JUM-PARAM [data-rub="donnees"]'); b && b.click(); return [...document.querySelectorAll('.JUM-PARAM [data-action]')].map(x => x.getAttribute('data-action')); });
    verifier(lignes.includes('demreinit') && lignes.includes('demsuppr') && !lignes.includes('reinitialiser') && !lignes.includes('effacer'), 'missionnaire : « Demander la réinitialisation / la suppression », plus d\'effacement direct');
    await m.evaluate(() => JUMELAGE_FERMER_PARAMETRES());
    // Demande de réinitialisation → assistant Chorus DT → accordée → l'appareil s'efface à l'ouverture.
    await m.evaluate(() => JUMELAGE_DEMANDE_COMPTE('reinit')); await attendre(300);
    await m.fill('#JUM-GC-MOTIF', 'Téléphone changé'); await m.click('.JUM-GC-FEN [data-go]'); await attendre(1500);
    verifier(await m.evaluate(() => JSON.parse(localStorage.getItem('trigone_demande_compte') || '{}').statut === 'attente'), 'missionnaire : demande envoyée (en attente)');
    await c.evaluate(() => JUMELAGE_GESTION_COMPTES()); await attendre(1500);
    const vue = await c.evaluate(() => document.querySelector('.JUM-GC-FEN').innerText);
    verifier(/Réinitialisation de ses appareils/.test(vue) && /Téléphone changé/.test(vue) && !/Supprimer un compte/.test(vue), 'assistant Chorus DT : la demande arrive (motif), pas de suppression directe pour lui');
    await c.click('.JUM-GC-FEN [data-ok]'); await attendre(700); await c.click('#MSG-BOUTONS button:last-child'); await attendre(2000);
    await m.reload(); await attendre(6000);
    verifier(await m.evaluate(() => !localStorage.getItem('trigone_compte') && /TRIGONE réinitialisé/.test(document.body.innerText)), 'réinitialisation accordée : l\'appareil du missionnaire s\'efface tout seul, avec un message');
    // Suppression demandée → accordée par l'administrateur de l'unité → compte effacé côté serveur, appareil effacé.
    const m2 = await appareil('M2');
    await m2.evaluate(() => JUMELAGE_DEMANDE_COMPTE('suppression')); await attendre(300); await m2.click('.JUM-GC-FEN [data-go]'); await attendre(1500);
    await a.evaluate(() => JUMELAGE_GESTION_COMPTES()); await attendre(1500);
    await a.evaluate(() => [...document.querySelectorAll('.JUM-GC-DEM')].find(d => /Suppression/.test(d.innerText)).querySelector('[data-ok]').click()); await attendre(700);
    await a.click('#MSG-BOUTONS button:last-child'); await attendre(2500);
    verifier((await api(a, 'compte/supprimer', { mail: MAILS.M2, motif: 'test' })).statut === 404, 'suppression accordée : plus aucun compte à cette adresse sur le serveur');
    await m2.reload(); await attendre(6000);
    verifier(await m2.evaluate(() => !localStorage.getItem('trigone_compte') && /Compte TRIGONE supprimé/.test(document.body.innerText)), 'compte supprimé : son appareil s\'efface à l\'ouverture');
    // Suppression directe (départ de l'institution) : administrateur seulement, adresse retapée, journal.
    const x = await appareil('X');
    verifier((await api(c, 'compte/supprimer', { mail: MAILS.X, motif: 'Départ' })).statut === 403, 'suppression directe refusée à l\'assistant Chorus DT (réservée à l\'administrateur)');
    await a.evaluate(() => JUMELAGE_GESTION_COMPTES()); await attendre(1500);
    await a.fill('#JUM-GC-MAIL', MAILS.X); await a.fill('#JUM-GC-MAIL2', MAILS.X); await a.fill('#JUM-GC-PREC', 'fin de contrat');
    await a.click('[data-suppr]'); await attendre(700); await a.click('#MSG-BOUTONS button:last-child'); await attendre(2500);
    const journal = await a.evaluate(() => (document.querySelector('.JUM-GC-JOURNAL') || {}).innerText || '');
    verifier(/Départ de l'institution : fin de contrat/i.test(journal) && journal.indexOf(MAILS.X) < 0, 'administrateur : compte supprimé, journal (qui, quand, motif) sans l\'adresse');
    verifier((await api(x, 'compte/demandes')).statut === 410, 'appareil d\'un compte supprimé : le serveur répond « compte supprimé »');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
