// Aide de la mascotte : pastille à côté de la lune (téléphone), carte du menu (PC), fenêtre de discussion, réponses
// tirées de aide/base.json (fautes, SMS, jargon), « Me montrer », page de la notice, IA (simulée par le serveur de
// test) réservée aux comptes connectés, avec ses limites. Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36);
    async function page(vp, chemin, nom) {
        const p = await (await b.newContext({ viewport: vp })).newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL + (chemin || ''));
        await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        await p.evaluate(() => document.querySelectorAll('.JUM-ACC,.JUM-PRES,.JUM-NOUV,.JUM-VERROU,.JUM-PAVE,.JUM-MDP-FOND').forEach(x => x.remove()));
        return p;
    }
    const derniere = p => p.evaluate(() => { const l = document.querySelectorAll('.AIDE-M.lui'); return l.length ? l[l.length - 1].innerText : ''; });
    async function demander(p, q) { await p.fill('.AIDE-SAISIE input', q); await p.click('.AIDE-SAISIE button'); await attendre(300); return derniere(p); }

    // ----- Téléphone, Mise en route, sans compte -----
    const t = await page({ width: 412, height: 860 }, '', 'tél');
    const pos = await t.evaluate(() => { const a = document.querySelector('.AIDE-PASTILLE').getBoundingClientRect(), l = document.querySelector('.THEME-TOGGLE').getBoundingClientRect();
        return { vis: a.width > 0, haut: Math.abs(a.top - l.top), gauche: l.left - a.right }; });
    verifier(pos.vis && pos.haut <= 1 && pos.gauche > 0 && pos.gauche < 20, 'téléphone : pastille de la mascotte juste à gauche de la lune ' + JSON.stringify(pos));
    await attendre(2200);
    verifier(await t.isVisible('.AIDE-BULLE') && await t.evaluate(() => document.querySelector('.AIDE-PASTILLE').classList.contains('AIDE-INVITE')), 'première fois : la mascotte se signale (« Besoin d\'aide ? Touchez-moi »)');
    await t.click('.AIDE-PASTILLE'); await attendre(800);
    verifier(await t.isVisible('.AIDE-FEN') && /^Bonjour, mon adjudant, en quoi puis-je vous aider \?/.test(await derniere(t)) && (await t.$$('.AIDE-PUCE')).length === 4, 'fenêtre ouverte : « Bonjour, mon adjudant, en quoi puis-je vous aider ? » (grade ADJ), 4 sujets proposés');
    verifier(!(await t.isVisible('.AIDE-BULLE')) && !(await t.evaluate(() => document.querySelector('.AIDE-PASTILLE').classList.contains('AIDE-INVITE'))), 'ouverte une fois : la mascotte ne se signale plus');
    let r = await demander(t, 'jme rappel plu de mon mot2pass');
    verifier(/code de réactivation/.test(r) && /Réponse trouvée dans la notice/.test(await t.innerText('.AIDE-FIL')), 'langage SMS et fautes (« jme rappel plu de mon mot2pass ») : code de connexion oublié');
    r = await demander(t, 'le juteux a refusé mon OM pk');
    verifier(/Refusées — à corriger/.test(r), 'jargon (« le juteux a refusé mon OM pk ») : demande refusée, corriger et renvoyer');
    r = await demander(t, 'jai dormi a l\'hotel comment je le mets');
    verifier(/Repas & hébergement/.test(r), 'familier (« jai dormi a l\'hotel… ») : frais d\'hébergement');
    r = await demander(t, 'recette de la blanquette de veau');
    verifier(/cerveau IA/.test(r) && await t.isVisible('.AIDE-IA'), 'hors notice : propose de demander à l\'IA');
    await t.click('.AIDE-IA'); await attendre(300);
    verifier(/réservée aux comptes TRIGONE connectés/.test(await derniere(t)), 'sans compte connecté : l\'IA est refusée, explication');
    // Sujet proposé → réponse ; « Me montrer » → le bon écran et le bon bouton clignote.
    await t.click('.AIDE-VIDER'); await attendre(300);
    await t.click('.AIDE-PUCE[data-fiche="nouvelle-demande"]'); await attendre(300);
    verifier(/NOUVELLE DEMANDE/.test(await derniere(t)), 'sujet proposé touché : sa réponse s\'affiche');
    await t.click('.AIDE-MONTRER'); await attendre(900);
    verifier(!(await t.$('.AIDE-FOND')) && await t.evaluate(() => !!document.querySelector('.AIDE-CIBLE[onclick^="DEMARRER_NOUVELLE_DEMANDE"]')), '« Me montrer » : la fenêtre se range, le bouton Nouvelle demande clignote');
    await t.evaluate(() => DEMARRER_NOUVELLE_DEMANDE()); await attendre(600);
    await t.click('.AIDE-PASTILLE'); await attendre(500);
    verifier((await t.$$('.AIDE-M.moi')).length >= 1, 'conversation gardée en rouvrant la fenêtre');
    const ecran = await t.evaluate(() => { const l = document.querySelectorAll('.AIDE-PUCE'); return l.length; });
    await t.click('.AIDE-VIDER'); await attendre(300);
    verifier(await t.evaluate(() => !!document.querySelector('.AIDE-PUCE[data-fiche="onglet-bloque"]')), 'sur le formulaire : les sujets proposés sont ceux de cet écran (onglet bloqué…) ' + ecran);
    r = await demander(t, 'c grisé jpeux pas aller plus loin');
    verifier(/Étape suivante/.test(r), '« c grisé jpeux pas aller plus loin » : onglet bloqué');
    await t.click('.AIDE-LIEN[data-notice]'); await attendre(2500);
    verifier(await t.evaluate(() => { const n = document.querySelector('.JUM-NOTICE .N-NUM'); return !!n && !/Couverture/.test(n.textContent) && /Identité/.test(document.querySelector('.JUM-NOTICE').innerText); }), '« Notice › … » : la notice s\'ouvre à la bonne page');
    await t.evaluate(() => document.querySelector('.JUM-NOTICE .N-FERMER').click()); await attendre(400);
    await t.evaluate(() => { document.body.classList.add('dark-mode'); AIDE_OUVRIR(); }); await attendre(300);
    verifier(await t.evaluate(() => getComputedStyle(document.querySelector('.AIDE-FEN')).backgroundColor !== 'rgb(244, 245, 247)'), 'mode sombre : la fenêtre passe en sombre');
    await t.evaluate(() => AIDE_FERMER());

    // ----- Codier FD et barèmes : réponses tirées des données de TRIGONE, sans IA -----
    await t.evaluate(() => { document.body.classList.remove('dark-mode'); AIDE_OUVRIR(); }); await attendre(500);
    r = await demander(t, 'c quoi le code fd pour la formation au 4eme RIISC'); await attendre(1500); r = await derniere(t);
    verifier(/FDYDDR4FRM/.test(r) && /UIISC n°4 - Déplacement formation/.test(r) && /codier FD/.test(await t.innerText('.AIDE-FIL')), 'codier : « code fd pour la formation au 4eme RIISC » → FDYDDR4FRM (UIISC n°4, formation)');
    r = await demander(t, 'FD1ADNR11F il marche encore ?');
    verifier(/plus valable/.test(r) && /FD1ADTB11C/.test(r), 'codier : ancien code fermé → le code qui le remplace');
    r = await demander(t, 'combien pour une nuit d\'hotel a lyon');
    verifier(/Lyon/.test(r) && /120,00 €/.test(r) && !/Repas/.test(r), 'barème France : nuit d\'hôtel à Lyon (grande ville) → 120,00 €');
    r = await demander(t, 'combien la nuit a bourges');
    verifier(/Bourges/.test(r) && /90,00 €/.test(r), 'barème France : autre ville (Bourges) → 90,00 €');
    r = await demander(t, 'repas en allemagne combien');
    verifier(/ALLEMAGNE/.test(r) && /42,00 €/.test(r), 'barème étranger : repas en Allemagne → 42,00 € (17,5 % de 240 €)');
    r = await demander(t, 'indemnités aux usa');
    verifier(/ETATS-UNIS/.test(r) && /New York/.test(r) && /≈/.test(r), 'barème étranger : États-Unis (avec New York) converti en euros');
    r = await demander(t, 'tarif hotel a la reunion');
    verifier(/outre-mer/.test(r), 'outre-mer : renvoi à l\'assistant Chorus DT (barèmes absents de TRIGONE)');
    await t.click('.AIDE-VIDER'); await attendre(300);
    // Concordance : aide/tarifs.json = barèmes de Compte-rendu (sinon relancer node aide/extraire-tarifs.js).
    const cr0 = await (await b.newContext()).newPage(); await cr0.goto(URL + 'cr/'); await attendre(1500);
    const conc = await cr0.evaluate(() => fetch('../aide/tarifs.json').then(r => r.json()).then(x => JSON.stringify(x.pays) === JSON.stringify(COUNTRY_MISSION_RATES) &&
        JSON.stringify(x.change) === JSON.stringify(DEFAULT_EXCHANGE_RATES) && JSON.stringify(x.grandesVilles) === JSON.stringify(GRANDES_VILLES_FR) && x.repasFrance === GET_REPAS_RATE_EUR({}) &&
        x.hebergementFrance.PARIS === GET_HEBERG_RATE_FOR_JOUR({ V: 'PARIS' }, {}) && x.hebergementFrance.GRANDE === GET_HEBERG_RATE_FOR_JOUR({ V: 'GRANDE' }, {}) && x.hebergementFrance.PETITE === GET_HEBERG_RATE_FOR_JOUR({ V: 'PETITE' }, {})));
    verifier(conc, 'aide/tarifs.json identique aux barèmes de Compte-rendu (pays, devises, grandes villes, repas, hébergement)');
    await cr0.close();

    // ----- Salutation selon le grade (écritures libres) ; commissaire : Monsieur ou Madame, demandé une fois -----
    const sal = await t.evaluate(() => ['A/C', 'Sergent chef', 'CNE.', 'lcl', '1CL', 'MAJ', 'civil'].map(AIDE_MOTEUR.appellation));
    verifier(sal.join('|') === 'mon adjudant-chef|sergent-chef|mon capitaine|mon colonel|soldat|major|', 'appellations : A/C, Sergent chef, CNE., lcl, 1CL, MAJ, civil → ' + sal.join(' | '));
    await t.evaluate(() => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.grade = 'CRP'; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); AIDE_OUVRIR(); }); await attendre(400);
    await t.click('.AIDE-VIDER'); await attendre(300);
    verifier(/dois-je dire/.test(await derniere(t)) && await t.isVisible('[data-civ="Madame"]'), 'commissaire (CRP) : la mascotte demande Monsieur ou Madame le commissaire');
    await t.click('[data-civ="Madame"]'); await attendre(300);
    verifier(/^Bonjour, Madame le commissaire, en quoi puis-je vous aider \?/.test(await derniere(t)), 'choix retenu : « Bonjour, Madame le commissaire, en quoi puis-je vous aider ? »');
    await t.evaluate(() => { AIDE_FERMER(); const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.grade = 'CRC1'; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); sessionStorage.removeItem('trigone_aide_fil'); AIDE_OUVRIR(); }); await attendre(400);
    verifier(/^Bonjour, Madame le commissaire en chef,/.test(await derniere(t)), 'commissaire en chef (CRC1) : « Madame le commissaire en chef », sans redemander');
    await t.evaluate(() => AIDE_FERMER());
    // Une fenêtre de TRIGONE ouverte : la pastille se range (elle ne recouvre jamais ses boutons).
    await t.evaluate(() => JUMELAGE_PARAMETRES()); await attendre(400);
    verifier(await t.evaluate(() => getComputedStyle(document.querySelector('.AIDE-PASTILLE')).display === 'none'), 'fenêtre Paramètres ouverte : la pastille se range');
    await t.evaluate(() => JUMELAGE_FERMER_PARAMETRES()); await attendre(1200);
    verifier(await t.isVisible('.AIDE-PASTILLE'), 'fenêtre fermée : la pastille revient');

    // ----- PC : la carte « Besoin d'aide ? » dans le menu de gauche, au-dessus de la notice -----
    const pc = await page({ width: 1360, height: 820 }, '', 'PC');
    const carte = await pc.evaluate(() => { const c = document.querySelector('.PC-BAS .AIDE-CARTE-PC'), n = document.querySelector('.PC-BAS .JUM-NOTICE-LIVRET');
        return { c: !!c && c.getClientRects().length > 0, avant: !!(c && n && (c.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)), pastille: getComputedStyle(document.querySelector('.AIDE-PASTILLE')).display }; });
    verifier(carte.c && carte.avant && carte.pastille === 'none', 'PC : carte « Besoin d\'aide ? » dans le menu, au-dessus de la notice ; pas de pastille ' + JSON.stringify(carte));
    await pc.click('.AIDE-CARTE-PC'); await attendre(600);
    verifier(await pc.evaluate(() => document.querySelector('.AIDE-FOND').classList.contains('pc') && document.querySelector('.AIDE-FEN').getBoundingClientRect().right > innerWidth - 40), 'PC : la fenêtre s\'ouvre en bas à droite, l\'écran reste visible');
    await pc.evaluate(() => SHOW_PAGE('PANIER')); await attendre(300);
    verifier(!!(await pc.$('.AIDE-FOND')) && !!(await pc.$('.PC-BAS .AIDE-CARTE-PC')), 'PC : la carte reste dans le menu après un changement de page');

    // ----- Compte-rendu : même aide, sujets du Compte-rendu, « Me montrer » vers Mise en route -----
    const c = await page({ width: 412, height: 860 }, 'cr/', 'CR');
    verifier(await c.isVisible('.AIDE-PASTILLE'), 'Compte-rendu : pastille de la mascotte');
    await c.click('.AIDE-PASTILLE'); await attendre(800);
    verifier(await c.evaluate(() => !!document.querySelector('.AIDE-PUCE[data-fiche="cr-commencer"]')), 'Compte-rendu : sujets du compte-rendu proposés');
    r = await demander(c, 'combien de repas je met');
    verifier(/Repas midi/.test(r), 'Compte-rendu : « combien de repas je met » : frais de repas');
    r = await demander(c, 'comment j\'envoie ma demande a mon adjudant');
    verifier(/Prêtes à envoyer/.test(r), 'Compte-rendu : question sur Mise en route comprise');
    await c.click('.AIDE-MONTRER'); await attendre(5000);
    verifier(await c.evaluate(() => !/\/cr\//.test(location.pathname) && window.PAGE_ACTUELLE === 'PANIER'), '« Me montrer » depuis Compte-rendu : Mise en route s\'ouvre sur Documents');

    // ----- IA (simulée) : compte connecté, écran et fiches transmis, limites -----
    const MAIL = 'aide.' + s + '@interieur.gouv.fr';
    const a = await page({ width: 412, height: 860 }, '', 'IA');
    await a.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
    await a.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await a.fill('#JUM-C-MAIL', MAIL); await a.click('#JUM-C-ENVOI'); await attendre(1500);
    await a.click('#JUM-C-VALIDER'); await attendre(2000); await a.evaluate(() => JUMELAGE_FERMER_COMPTE());
    await a.evaluate(() => SHOW_PAGE('PANIER')); await attendre(300);
    await a.evaluate(() => AIDE_OUVRIR()); await attendre(800);
    await demander(a, 'mon chef dit que ma demande est fausse et je capte rien');
    await a.evaluate(() => { const l = document.querySelectorAll('.AIDE-FIL [data-ia]'); l[l.length - 1].click(); }); await attendre(1500);
    r = await derniere(a);
    verifier(/Réponse simulée/.test(r) && /Réponse de l'IA/.test(await a.innerText('.AIDE-FIL')) && !/\[FICHE/.test(r), 'compte connecté : l\'IA répond (étiquette « elle peut se tromper »), sans la balise [FICHE]');
    verifier(await a.evaluate(() => { const l = document.querySelectorAll('.AIDE-M.lui.ia'); return !!l[l.length - 1].querySelector('[data-notice]'); }), 'réponse de l\'IA : lien vers la page de la notice de la fiche utilisée');
    const ess = await a.evaluate(() => JUMELAGE_API('aide/ia', { question: 'où je clique', fiches: ['envoyer-demande', 'inconnue'], ecran: 'mer-documents', app: 'mer', historique: [{ de: 'moi', texte: 'bonjour' }] }));
    const sys = ess.essai.messages[0].content;
    verifier(ess.essai.fiches.join() === 'envoyer-demande' && /ÉCRAN OUVERT PAR L'UTILISATEUR : Documents/.test(sys) && /FICHES UTILES/.test(sys) && /juteux/.test(sys) && ess.essai.messages.length === 3,
        'serveur : consigne avec l\'écran ouvert, les écrans, le jargon, les seules fiches connues, la conversation');
    verifier(ess.fiche === 'envoyer-demande' && ess.restant === 10 - 2, 'serveur : fiche utilisée renvoyée, questions restantes comptées (' + ess.restant + ')');
    let code = 0;
    for (let i = 0; i < 12 && code !== 429; i++) code = await a.evaluate(() => JUMELAGE_API('aide/ia', { question: 'test' }).then(() => 200, e => e.statut));
    verifier(code === 429, 'limite : au-delà de 10 questions par jour et par compte, l\'IA refuse (429)');
    await a.evaluate(() => AIDE_OUVRIR()); await attendre(300);
    await demander(a, 'blanquette'); await a.click('.AIDE-IA'); await attendre(1200);
    verifier(/questions à l'IA aujourd'hui|revient demain/.test(await derniere(a)), 'limite atteinte : la mascotte l\'explique');
    verifier(await a.evaluate(() => fetch('api/aide/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"question":"x y"}' }).then(r => r.status)) === 401, 'sans compte : la route de l\'IA refuse (401)');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
