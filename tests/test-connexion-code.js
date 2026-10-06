// Connexion avec l'adresse TRIGONE et le code de connexion (8 caractères au moins, choisi deux fois) : depuis n'importe
// quel appareil, compte ET données qui reviennent tout seuls (sauvegarde du compte, chiffrée avec la clé du compte).
// Code oublié : code de réactivation de l'administrateur → les données reviennent quand même, nouveau code imposé.
// Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36), MAIL = 'cnx.' + s + '@interieur.gouv.fr', CODE = 'Mission-' + s;
    async function appareil(nom, prep) {
        const p = await (await b.newContext({ viewport: { width: 480, height: 1000 } })).newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL);
        if (prep) { await p.evaluate(preparer, APP_CODE); await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await p.reload(); }
        await attendre(2500);
        return p;
    }
    async function connecterParMail(p, mail) {
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', mail); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(2000);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
    }
    // Appareil habituel : compte, données (témoin + un envoi dans la boîte), code de connexion choisi deux fois.
    const a = await appareil('A', true);
    await connecterParMail(a, MAIL);
    await a.evaluate(() => { localStorage.setItem('trigone_temoin_cnx', 'données de A');
        localStorage.setItem('trigone_boite', JSON.stringify([{ id: 'cnxb1', nature: 'question', statut: 'nouveau', le: Date.now(), de: 'x@test.fr', objet: 'Envoi de A', question: 'Reçu ?' }])); });
    await a.evaluate(() => JUMELAGE_CODE_CONNEXION({})); await attendre(300);
    verifier(await a.isVisible('#JUM-MDP-1') && !(await a.$('.JUM-MDP-FOND .JUM-GC-X')), 'compte sans code de connexion : fenêtre de création, sans bouton pour la fermer');
    await a.fill('#JUM-MDP-1', 'court'); await a.fill('#JUM-MDP-2', 'court'); await a.click('#JUM-MDP-GO'); await attendre(200);
    verifier(/8 caractères/.test(await a.textContent('#JUM-MDP-ERR')), 'code de connexion trop court refusé');
    await a.fill('#JUM-MDP-1', CODE); await a.fill('#JUM-MDP-2', CODE + 'x'); await a.click('#JUM-MDP-GO'); await attendre(200);
    verifier(/pas identiques/.test(await a.textContent('#JUM-MDP-ERR')), 'les deux saisies doivent être identiques');
    await a.fill('#JUM-MDP-1', CODE); await a.fill('#JUM-MDP-2', CODE); await a.click('#JUM-MDP-GO'); await attendre(1500);
    verifier(!(await a.$('.JUM-MDP-FOND')), 'code de connexion enregistré (deux saisies identiques)');
    const etat = await a.evaluate(() => { const c = JSON.parse(localStorage.getItem('trigone_compte')); return fetch('api/compte/etat', { headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton } }).then(r => r.json()); });
    verifier(etat.mdp === true, 'serveur : le compte a un code de connexion');
    // Sauvegarde du compte : activée d'office, avec la clé du compte, boîte comprise.
    await a.evaluate(() => JUMELAGE_SAUVEGARDE_COMPTE_ACTIVER()); await attendre(2500);
    verifier(await a.evaluate(() => { const e = JSON.parse(localStorage.getItem('trigone_sauvegarde_auto') || '{}'); return e.actif && e.v === 2 && !!e.derniere; }), 'sauvegarde du compte activée d\'office et envoyée (clé du compte)');
    // Appareil neuf : l'accueil est imposé ; « Se connecter » avec adresse + code de connexion.
    const n = await appareil('N', false);
    verifier(await n.isVisible('.JUM-ACC [data-aller="connecter"]'), 'appareil neuf : accueil imposé');
    await n.click('.JUM-ACC [data-aller="connecter"]'); await attendre(300);
    await n.fill('#JUM-C-PADR', MAIL); await n.fill('#JUM-C-PCODE', 'Mauvais-code'); await n.click('#JUM-C-PGO'); await attendre(2000);
    const e1 = await n.textContent('#JUM-C-ERR');
    verifier(/incorrect/.test(e1) && /9 essai/.test(e1), 'code de connexion faux refusé, essais restants (« ' + e1.trim() + ' »)');
    await n.click('#JUM-C-OUBLI'); await attendre(150);
    verifier(/code de réactivation/.test(await n.textContent('#JUM-C-OUBLI-TXT')), '« Code de connexion oublié ? » : demander un code de réactivation à l\'administrateur');
    await n.fill('#JUM-C-PCODE', CODE); await n.click('#JUM-C-PGO'); await attendre(9000);
    const rN = await n.evaluate(m => ({ compte: (JSON.parse(localStorage.getItem('trigone_compte') || '{}')).mail === m, temoin: localStorage.getItem('trigone_temoin_cnx'),
        boite: (JSON.parse(localStorage.getItem('trigone_boite') || '[]')).some(x => x.id === 'cnxb1'), profil: !!localStorage.getItem('trigone_reglages_communs') }), MAIL);
    verifier(rN.compte && rN.temoin === 'données de A' && rN.boite && rN.profil, 'adresse + code de connexion : compte, profil, données et boîte de réception revenus tout seuls ' + JSON.stringify(rN));
    verifier(await n.evaluate(() => { const e = JSON.parse(localStorage.getItem('trigone_sauvegarde_auto') || '{}'); return e.v === 2; }), 'nouvel appareil : continue la sauvegarde du compte');
    // Essais au hasard : 5 erreurs → 15 minutes d'attente, même avec le bon code.
    const autre = await appareil('X', false);
    for (let i = 0; i < 5; i++) await autre.evaluate(m => JUMELAGE_CONNEXION_MDP(m, 'mauvais-code-' + Math.random()).catch(() => {}), MAIL);
    verifier(/réessayez dans/.test(await autre.evaluate(([m, c]) => JUMELAGE_CONNEXION_MDP(m, c).then(() => 'ok', e => e.message), [MAIL, CODE])), '5 codes faux : attente de 15 minutes, même avec le bon code');
    verifier(await autre.evaluate(() => fetch('api/connexion/motdepasse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mail: 'personne.inconnue@trigone-app.com', mdp: 'nimportequoi', cle: { kty: 'EC', crv: 'P-256', x: 'a', y: 'b' } }) }).then(r => r.json()).then(j => /incorrect/.test(j.erreur || ''))),
        'adresse inconnue : même message qu\'un code faux');
    verifier(await autre.evaluate(() => fetch('api/connexion/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)) !== 200, 'ancienne connexion par code à 4 chiffres retirée');
    // Code oublié : l'administrateur remet un code de réactivation ; les données reviennent, nouveau code imposé.
    const adm = await appareil('ADM', true);
    await connecterParMail(adm, 'admin.' + s + '@interieur.gouv.fr');
    const reac = await adm.evaluate(m => { const c = JSON.parse(localStorage.getItem('trigone_compte')); return fetch('api/compte/reactivation', { method: 'POST', headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton, 'Content-Type': 'application/json', 'X-Trigone-Unite': '4RIISC' }, body: JSON.stringify({ mail: m }) }).then(r => r.json()); }, MAIL);
    verifier(!!reac.code, 'administrateur : code de réactivation créé');
    const r2 = await appareil('R', false);
    await r2.evaluate(c => JUMELAGE_LIAISON_UTILISER(c), reac.code); await r2.evaluate(() => { localStorage.removeItem('trigone_test_sans_mdp'); location.replace('./'); }); await attendre(9000);
    const rR = await r2.evaluate(() => ({ temoin: localStorage.getItem('trigone_temoin_cnx'), refaire: localStorage.getItem('trigone_mdp_refaire'), fen: !!document.querySelector('.JUM-MDP-FOND') }));
    verifier(rR.temoin === 'données de A', 'code oublié → code de réactivation : les données reviennent quand même');
    verifier(rR.refaire === '1' && rR.fen, 'après réactivation : un nouveau code de connexion est demandé, sans pouvoir passer');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
