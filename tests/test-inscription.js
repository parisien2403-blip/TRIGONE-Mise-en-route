// Inscription sans adresse mail (identité seule → prenom.nom@trigone-app.com), compte en attente, validation par
// l'administrateur (à distance) ou par la carte TRIGONE, blocage (téléphone perdu), déblocage et code de réactivation,
// mes appareils. Demande le serveur de test (TRIGONE_URL_BOITE) et le code ADMINISTRATEUR (TRIGONE_CODE_ADMIN).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE, codeAdmin = process.env.TRIGONE_CODE_ADMIN;
    if (!URL || !codeAdmin) { console.log('  (sauté : définissez TRIGONE_URL_BOITE et TRIGONE_CODE_ADMIN)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36).slice(-5);
    const nom = 'TEST' + s.toUpperCase().replace(/[^A-Z]/g, 'X'), adresseAttendue = 'emma.' + nom.toLowerCase() + '@trigone-app.com';
    const page = async (sansCompte) => {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => { sessionStorage.setItem('trigone_choix_fait', '1'); localStorage.removeItem('trigone_reglages_communs'); });
        await p.reload(); await attendre(2500);
        return p;
    };
    const api = (p, chemin, corps, methode) => p.evaluate(([chemin, corps, methode]) => { const k = JSON.parse(localStorage.getItem('trigone_compte') || '{}'); return fetch('api/' + chemin, { method: methode || (corps ? 'POST' : 'GET'),
        headers: { Authorization: 'TRIGONE ' + encodeURIComponent(k.mail) + ' ' + k.appareil + ' ' + k.jeton, 'Content-Type': 'application/json', 'X-Trigone-Unite': '4RIISC' }, body: corps ? JSON.stringify(corps) : undefined }).then(r => r.json().then(j => Object.assign(j, { statut: r.status }))); }, [chemin, corps, methode]);
    const inscrire = async (p, prenom) => {
        await p.evaluate(() => JUMELAGE_CONNEXION()); await attendre(500);
        await p.fill('#JUM-C-GRADE', 'CAPORAL'); await p.fill('#JUM-C-UNITE', '4°RIISC'); await p.fill('#JUM-C-NOM', nom); await p.fill('#JUM-C-PRENOM', prenom); await p.fill('#JUM-C-MDP1', 'Essai-2026!'); await p.fill('#JUM-C-MDP2', 'Essai-2026!');
        await p.click('#JUM-C-CREER'); await attendre(2000);
        await p.evaluate(() => { const m = document.getElementById('MSG-OVERLAY'); if (m) m.classList.add('HIDDEN'); if (window.JUMELAGE_FERMER_REGLAGES) JUMELAGE_FERMER_REGLAGES(); });
        return p.evaluate(() => JSON.parse(localStorage.getItem('trigone_compte') || '{}').mail);
    };
    // Administrateur (compte avec adresse mail, rôle ADMINISTRATEUR).
    const a = await page();
    await a.evaluate(() => { localStorage.setItem('trigone_reglages_communs', JSON.stringify({ unite: '4°RIISC', grade: 'ADC', nom: 'GIRARD', prenom: 'Luc', matricule: '' })); JUMELAGE_COMPTE(); }); await attendre(500);
    await a.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await a.fill('#JUM-C-MAIL', 'admin.' + s + '@interieur.gouv.fr'); await a.click('#JUM-C-ENVOI'); await attendre(1500); await a.click('#JUM-C-VALIDER'); await attendre(1500);
    await a.evaluate(() => { JUMELAGE_FERMER_COMPTE(); if (window.JUMELAGE_FERMER_REGLAGES) JUMELAGE_FERMER_REGLAGES(); });
    verifier((await api(a, 'role/admin', { code: codeAdmin, actif: true })).admin === '4RIISC', 'administrateur du 4°RIISC (code vérifié par le serveur)');
    // L'administrateur est aussi VALIDEUR 1 de l'unité (pour l'annuaire des destinataires).
    await api(a, 'unite', { grade: 'ADC', nom: 'GIRARD' + s.toUpperCase().replace(/[^A-Z]/g, 'X'), prenom: 'Luc' }); await api(a, 'roles', { ajouter: ['valideur1'] });
    // Inscription sans adresse mail.
    const n = await page();
    const mailN = await inscrire(n, 'Emma');
    const ann = await api(n, 'annuaire?role=valideur1');
    verifier((ann.personnes || []).some(x => x.mail === 'admin.' + s + '@interieur.gouv.fr' && /^GIRARD/.test(x.nom)), 'annuaire de l\'unité : le VALIDEUR 1 de l\'unité apparaît (grade, nom), même pour un compte en attente');
    verifier((await api(n, 'annuaire?role=chorus')).ok && (await api(n, 'annuaire?role=autre')).statut === 400, 'annuaire : par rôle (VALIDEUR 1 / 2, assist DT) seulement');
    verifier(mailN === adresseAttendue && await n.evaluate(() => localStorage.getItem('trigone_compte_attente') === '1'), 'inscription sans mail : compte ' + mailN + ', en attente de validation');
    verifier((await api(n, 'compte/etat')).attente === true && (await api(n, 'nids', { personnes: [] })).statut === 403, 'compte en attente : rien d\'autre que l\'essentiel (envois, matricules… refusés)');
    verifier((await api(a, 'cles?mail=' + encodeURIComponent(mailN))).compte === false, 'compte en attente : personne ne peut encore lui envoyer');
    // Validation à distance par l'administrateur.
    await a.evaluate(() => JUMELAGE_GESTION_COMPTES()); await attendre(1800);
    const vue = await a.evaluate(() => document.querySelector('.JUM-GC-FEN').innerText);
    verifier(/inscriptions à valider/i.test(vue) && vue.includes('CAPORAL ' + nom + ' Emma') && vue.includes(adresseAttendue), 'administrateur : l\'inscription apparaît (grade, nom, adresse TRIGONE)');
    await a.evaluate(m => document.querySelector('.JUM-GC-CPT[data-m="' + m + '"] [data-c="valider"]').click(), mailN); await attendre(1500);
    verifier((await api(n, 'compte/etat')).attente === false && (await api(a, 'cles?mail=' + encodeURIComponent(mailN))).compte === true, 'validée : le compte peut recevoir (adresse @trigone-app.com comme destinataire)');
    // Déjà inscrit (ex. sur son téléphone), il ouvre TRIGONE sur un PC et refait « Créer mon compte » : pas de doublon,
    // TRIGONE lui propose de se connecter (adresse pré-remplie) ; un homonyme peut quand même créer son compte.
    {
        const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }), pc = await ctx.newPage();
        pc.on('pageerror', e => erreurs.push(e.message)); pc.on('dialog', d => d.accept());
        await pc.goto(URL); await pc.evaluate(preparer, APP_CODE);
        await pc.evaluate(() => { sessionStorage.setItem('trigone_choix_fait', '1'); localStorage.removeItem('trigone_reglages_communs'); }); await pc.reload(); await attendre(2500);
        await pc.evaluate(() => JUMELAGE_CONNEXION()); await attendre(500);
        verifier(await pc.evaluate(() => { const o = document.querySelector('.JUM-ACC-ONGLETS [data-mode="connecter"]'); return !!o.offsetParent && /déjà un compte/i.test(o.textContent) && !!document.querySelector('.JUM-C-DEJA').offsetParent; }), 'PC : onglet « J\'ai déjà un compte » et lien « Se connecter » sous « Créer mon compte »');
        await pc.fill('#JUM-C-GRADE', 'CAPORAL'); await pc.fill('#JUM-C-UNITE', '4°RIISC'); await pc.fill('#JUM-C-NOM', nom); await pc.fill('#JUM-C-PRENOM', 'emma'); await pc.fill('#JUM-C-MDP1', 'Autre-2026!'); await pc.fill('#JUM-C-MDP2', 'Autre-2026!');
        await pc.click('#JUM-C-CREER'); await attendre(2000);
        const bloc = await pc.evaluate(() => { const x = document.getElementById('JUM-C-EXISTE'); return x && x.offsetParent ? x.innerText : ''; });
        verifier(/déjà un compte/i.test(bloc) && bloc.includes(adresseAttendue) && !(await pc.evaluate(() => localStorage.getItem('trigone_compte'))), 'même nom : pas de 2e compte, « Vous avez déjà un compte TRIGONE » avec l\'adresse');
        if (process.env.TRIGONE_CAPTURE_EXISTE) await pc.screenshot({ path: process.env.TRIGONE_CAPTURE_EXISTE });
        await pc.click('#JUM-C-EX-CO'); await attendre(300);
        verifier(await pc.evaluate(a => document.getElementById('JUM-C-PINBLOC').offsetParent && document.getElementById('JUM-C-PADR').value === a, adresseAttendue), '« Me connecter » : adresse pré-remplie, il ne reste que le code de connexion');
        await pc.fill('#JUM-C-PCODE', 'Essai-2026!'); await pc.click('#JUM-C-PGO'); await attendre(2500);
        verifier(await pc.evaluate(() => JSON.parse(localStorage.getItem('trigone_compte') || '{}').mail) === adresseAttendue, 'connecté au compte existant sur le PC');
        await ctx.close();
    }
    // Validation en personne : un 2e inscrit, sa carte scannée par l'administrateur.
    const n2 = await page();
    const mail2 = await inscrire(n2, 'Hugo');
    // Espace Assist Chorus DT : dossier jaune « Demandes de création de compte ».
    await a.evaluate(() => { document.querySelectorAll('.JUM-GC-FOND').forEach(x => x.remove()); localStorage.setItem('trigone_role_admin', '4RIISC'); JUMELAGE_INSCRIPTIONS_ACTUALISER(true); MER_OUVRIR_CHORUS(); }); await attendre(2500);
    const dos = await a.evaluate(() => { const d = document.querySelector('.MER-DOSSIER[data-dossier="inscriptions"]'); return d ? d.innerText : ''; });
    verifier(/créations de compte/i.test(dos) && /[1-9]/.test(dos), 'Assist Chorus DT : dossier « Créations de compte » avec sa pastille (inscriptions à valider)');
    await a.click('.MER-DOSSIER[data-dossier="inscriptions"]'); await attendre(2000);
    if (process.env.TRIGONE_CAPTURE) await a.screenshot({ path: process.env.TRIGONE_CAPTURE });
    verifier(await a.evaluate(m => !!document.querySelector('.MER-INSCR[data-m="' + m + '"]'), mail2) && (await a.evaluate(() => document.getElementById('PAGE-STAGE').innerText)).includes('CAPORAL ' + nom + ' Hugo'),
        'dossier ouvert : l\'inscription (grade, nom, prénom) avec Valider / Refuser');
    const carte = await api(n2, 'carte', { grade: 'CAPORAL', nom, prenom: 'Hugo', unite: '4°RIISC', cie: '', nid: '' });
    const lu = await api(a, 'carte?id=' + encodeURIComponent(carte.id || ''));
    verifier(lu.carte && lu.carte.attente === true, 'carte d\'un compte en attente : signalée au responsable qui la scanne');
    verifier((await api(a, 'compte/valider-carte', { carte: carte.id })).ok && (await api(n2, 'compte/etat')).attente === false, 'validation en scannant la carte : compte de ' + mail2 + ' validé');
    // Téléphone perdu : blocage, effacement, déblocage, code de réactivation sur le nouveau téléphone.
    await a.evaluate(() => { document.querySelectorAll('.JUM-GC-FOND').forEach(x => x.remove()); JUMELAGE_GESTION_COMPTES(); }); await attendre(1800);
    await a.evaluate(m => document.querySelector('.JUM-GC-CPT[data-m="' + m + '"] [data-c="bloquer"]').click(), mailN); await attendre(700);
    await a.click('#MSG-BOUTONS button:last-child'); await attendre(1500);
    const bloque = await api(n, 'compte/etat');
    verifier(bloque.statut === 410, 'compte bloqué : l\'ancien téléphone est refusé tout de suite');
    await n.reload(); await attendre(6000);
    verifier(await n.evaluate(() => !localStorage.getItem('trigone_compte')), 'ancien téléphone : TRIGONE s\'efface à l\'ouverture');
    const deb = await api(a, 'compte/debloquer', { mail: mailN });
    verifier(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(deb.code || ''), 'débloquer : code de réactivation à remettre (' + deb.code + ')');
    const n3 = await page();
    const r3 = await n3.evaluate(c => JUMELAGE_LIAISON_UTILISER(c).then(m => m, e => 'ERR ' + e.message), deb.code);
    verifier(r3 === mailN && (await api(n3, 'compte/etat')).ok, 'nouveau téléphone : code de réactivation → même compte (' + r3 + ')');
    const app = await api(n3, 'compte/appareils');
    verifier((app.appareils || []).length === 1 && app.appareils[0].moi, 'Mes appareils : seul le nouveau téléphone');
    verifier((await n3.evaluate(c => JUMELAGE_LIAISON_UTILISER(c).then(() => 'ok', e => e.message), deb.code)) !== 'ok', 'code de réactivation : une seule fois');
    // Liste de l'unité : statuts.
    const liste = await api(a, 'compte/unite');
    const x = (liste.comptes || []).find(y => y.mail === mailN);
    verifier(/^(admin|super)$/.test(liste.role) && x && x.statut === 'actif' && x.adresse === mailN, 'comptes de l\'unité : adresse TRIGONE et statut (actif après déblocage)');
    // Adresse inscrite dans ADMIN_MAILS (ici, en test : adresse commençant par « admin. ») : compte validé d'office.
    const sa = await page();
    const mailSa = await inscrire(sa, 'Admin');
    const etSa = await api(sa, 'compte/etat');
    verifier(/^admin\./.test(mailSa) && etSa.attente === false && (await api(sa, 'compte/demandes')).statut !== 403, 'compte dont l\'adresse est dans ADMIN_MAILS : validé d\'office (' + mailSa + ')');
    const z = await page(); await inscrire(z, 'Zoe');
    verifier((await api(z, 'compte/etat')).attente === true, 'les autres inscriptions restent en attente de validation');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
