// Première connexion guidée (téléphone neuf) : ouverture « 3 OUTILS · UNE SEULE DIRECTION · LA MISSION », compte sans
// adresse mail, puis profil, code d'accès, carte, rôles, destinataires (selon les rôles, choisis dans l'annuaire de
// l'unité), notifications et écran de bienvenue. Reprise à la même étape si l'appli est fermée. Demande le serveur
// de test (TRIGONE_URL_BOITE).
const { navigateur, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36).slice(-5).toUpperCase().replace(/[^A-Z]/g, 'X');
    // Un VALIDEUR 1 et un assistant Chorus DT de l'unité, déjà inscrits : ils apparaissent dans la liste des destinataires.
    const ctxV = await b.newContext(), v = await ctxV.newPage();
    await v.goto(URL); await attendre(1500);
    const api = (p, chemin, corps, k) => p.evaluate(([chemin, corps, k]) => fetch('api/' + chemin, { method: corps ? 'POST' : 'GET',
        headers: Object.assign({ 'Content-Type': 'application/json', 'X-Trigone-Unite': '4RIISC' }, k ? { Authorization: 'TRIGONE ' + encodeURIComponent(k.mail) + ' ' + k.appareil + ' ' + k.jeton } : {}),
        body: corps ? JSON.stringify(corps) : undefined }).then(r => r.json()), [chemin, corps, k]);
    // Comptes avec adresse mail (déjà actifs), identité publiée, rôle déclaré.
    const inscrireApi = async (nom, prenom, role) => {
        const mail = role + '.' + s.toLowerCase() + '@interieur.gouv.fr';
        const c = await api(v, 'inscription/code', { mail });
        const r = await v.evaluate(([mail, code]) => crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']).then(p => crypto.subtle.exportKey('jwk', p.publicKey))
            .then(pub => fetch('api/inscription/valider', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mail, code, nom: 'test', cle: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } }) }).then(x => x.json())), [mail, c.codeTest]);
        const k = { mail: r.mail, appareil: r.appareil, jeton: r.jeton };
        await api(v, 'unite', { grade: 'CNE', nom, prenom }, k);
        await api(v, 'roles', { ajouter: [role] }, k);
        return r.mail;
    };
    const mailV1 = await inscrireApi('CHEF' + s, 'Paul', 'valideur1'), mailC = await inscrireApi('ASSIST' + s, 'Sophie', 'chorus');
    await ctxV.close();

    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(URL); await attendre(3500);
    const ouv = await p.textContent('.JUM-ACC-MARQUE');
    verifier(/3 OUTILS/.test(ouv) && /UNE SEULE DIRECTION/.test(ouv) && /LA MISSION/.test(ouv) && /3 minutes/.test(ouv), 'ouverture : « 3 OUTILS · UNE SEULE DIRECTION · LA MISSION », 3 minutes');
    await p.click('.JUM-ACC [data-aller="creer"]'); await attendre(400);
    verifier((await p.textContent('.JUM-ACC-PROG')).includes('Étape 1 sur 7'), 'compte : étape 1 sur 7');
    await p.fill('#JUM-C-GRADE', 'CAPORAL'); await p.fill('#JUM-C-UNITE', '4°RIISC'); await p.fill('#JUM-C-NOM', 'MARTIN' + s); await p.fill('#JUM-C-PRENOM', 'Léa');
    await p.fill('#JUM-C-MDP1', 'Lea-2026x'); await p.fill('#JUM-C-MDP2', 'autre-code'); await p.click('#JUM-C-CREER'); await attendre(400);
    verifier(/pas identiques/.test(await p.textContent('#JUM-C-ERR')), 'compte : les deux codes de connexion doivent être identiques');
    await p.fill('#JUM-C-MDP2', 'Lea-2026x');
    await p.click('#JUM-C-CREER'); await attendre(2500);
    const titre = () => p.textContent('#JUM-PF-TITRE'), num = () => p.textContent('#JUM-PF-NUM'), err = () => p.textContent('#JUM-R-ERREUR');
    verifier(await titre() === 'Mon profil' && (await num()).includes('Étape 2 sur 7') && (await p.textContent('.JUM-PF-OK')).includes('@trigone-app.com')
        && await p.inputValue('#JUM-R-NOM') === 'MARTIN' + s, 'compte créé → profil tout de suite (étape 2), identité reprise du compte');
    await p.click('#JUM-PF-SUIVANT'); await attendre(200);
    verifier((await err()).includes('remplir'), 'profil : champs manquants refusés');
    await p.fill('#JUM-R-CIE', '2CIE'); await p.fill('#JUM-R-MATRICULE', '1234567890');
    await p.click('#JUM-PF-SUIVANT'); await attendre(300);
    verifier(await titre() === 'Mon code d\'accès', 'étape 3 : code d\'accès');
    await p.fill('#JUM-R-CODE1', '1234'); await p.fill('#JUM-R-CODE2', '1235'); await p.click('#JUM-PF-SUIVANT'); await attendre(200);
    verifier((await err()).includes('correspondent'), 'code : les deux saisies doivent correspondre');
    await p.fill('#JUM-R-CODE2', '1234'); await p.click('#JUM-PF-SUIVANT'); await attendre(500);
    verifier(await titre() === 'Ma carte TRIGONE' && (await p.textContent('#JUM-PF-CARTE')).includes('MARTIN' + s), 'étape 4 : aperçu de ma carte (identité du profil)');
    await p.click('#JUM-PF-SUIVANT'); await attendre(1800);
    verifier(await titre() === 'Mes rôles dans TRIGONE' && !!(await p.evaluate(() => JSON.parse(localStorage.getItem('trigone_carte') || '{}').id)), 'carte créée (QR code), étape 5 : mes rôles');
    // Reprise : l'appli fermée et rouverte reprend aux rôles (le code d'accès est déjà posé ? non : redemandé).
    await p.check('#JUM-R-VAL1'); await attendre(200);
    verifier(await p.isVisible('#JUM-R-CODEVAL1') && await p.isVisible('#JUM-R-FONCTION1'), 'rôle VALIDEUR 1 coché : son code et sa fonction sont demandés');
    await p.click('#JUM-PF-SUIVANT'); await attendre(200);
    verifier((await err()).includes('code VALIDEUR 1'), 'rôle coché sans code : refusé');
    await p.fill('#JUM-R-CODEVAL1', 'X'); await p.fill('#JUM-R-FONCTION1', 'CHEF DE SECTION'); await p.click('#JUM-PF-SUIVANT'); await attendre(1500);
    verifier(await p.isVisible('#JUM-R-MAILVAL2') && (await p.textContent('#JUM-PF-TEXTE')).includes('VALIDEUR 1'), 'VALIDEUR 1 : l\'écran des destinataires demande aussi son VALIDEUR 2');
    await p.click('#JUM-PF-RETOUR'); await attendre(300);
    await p.uncheck('#JUM-R-VAL1');
    await p.click('#JUM-PF-SUIVANT'); await attendre(2000);
    verifier(await titre() === 'À qui j\'envoie ?' && !(await p.isVisible('#JUM-R-MAILVAL2')), 'étape 6 : destinataires du missionnaire (pas de VALIDEUR 2 sans le rôle VALIDEUR 1)');
    const liste = await p.textContent('.JUM-PF-LISTE[data-pour="MAILVAL1"]');
    verifier(liste.includes('CHEF' + s) && (await p.textContent('.JUM-PF-LISTE[data-pour="MAILCHORUS"]')).includes('ASSIST' + s), 'destinataires : VALIDEUR 1 et assist DT de l\'unité proposés dans une liste');
    await p.click('#JUM-PF-SUIVANT'); await attendre(200);
    verifier((await err()).includes('VALIDEUR 1'), 'destinataires : à choisir avant de continuer');
    await p.click('.JUM-PF-LISTE[data-pour="MAILVAL1"] .JUM-PF-PERS[data-mail="' + mailV1 + '"]'); await p.click('.JUM-PF-LISTE[data-pour="MAILCHORUS"] .JUM-PF-PERS[data-mail="' + mailC + '"]');
    verifier(await p.inputValue('#JUM-R-MAILVAL1') === mailV1 && await p.inputValue('#JUM-R-MAILCHORUS') === mailC, 'un toucher sur une personne remplit son adresse');
    // Fermée en cours de route : reprise à la même étape.
    await p.reload(); await attendre(3500);
    verifier(await p.isVisible('#JUM-PF-TITRE') && await titre() === 'Mon code d\'accès' && await p.inputValue('#JUM-R-CIE') === '2CIE',
        'appli rouverte : le parcours reprend (code d\'accès redemandé, jamais gardé), le reste est conservé');
    await p.fill('#JUM-R-CODE1', '1234'); await p.fill('#JUM-R-CODE2', '1234'); await p.click('#JUM-PF-SUIVANT'); await attendre(500);
    await p.click('#JUM-PF-PLUSTARD'); await attendre(400); await p.click('#JUM-PF-SUIVANT'); await attendre(2000);
    verifier(await titre() === 'À qui j\'envoie ?' && await p.inputValue('#JUM-R-MAILVAL1') === mailV1, 'reprise : destinataires conservés');
    await p.click('#JUM-PF-SUIVANT'); await attendre(400);
    verifier(await titre() === 'Être prévenu' && (await num()).includes('Étape 7 sur 7'), 'étape 7 : notifications');
    await p.click('#JUM-PF-SUIVANT'); await attendre(2500);
    const bv = await p.textContent('.JUM-BIENV').catch(() => '');
    verifier(/Bienvenue dans TRIGONE/.test(bv) && bv.includes('CAPORAL MARTIN' + s) && bv.includes('L\'équipe TRIGONE') && /Validation par votre unité/.test(bv), 'fin : bienvenue (grade, nom), signé « L\'équipe TRIGONE », validation à venir rappelée');
    const rg = await p.evaluate(() => JSON.parse(localStorage.getItem('trigone_reglages_communs') || '{}'));
    verifier(rg.mailVal1 === mailV1 && rg.mailChorus === mailC && /@trigone-app\.com$/.test(rg.monMail) && rg.matricule === '123 45 67 890' && await p.evaluate(() => !localStorage.getItem('trigone_parcours_etape')),
        'profil enregistré (destinataires, adresse TRIGONE, matricule), parcours terminé');
    await p.click('.JUM-BIENV-BTN'); await attendre(500);
    await p.reload(); await attendre(3500);
    verifier(!(await p.$('.JUM-PF-CARTE')) && !(await p.$('.JUM-BIENV')), 'réouverture : plus de parcours');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
