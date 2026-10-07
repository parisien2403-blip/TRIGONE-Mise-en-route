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
    const derniere = p => p.evaluate(() => { const l = document.querySelectorAll('.AIDE-M.lui'); return l.length ? l[l.length - 1].textContent : ''; });
    async function demander(p, q) { await p.fill('.AIDE-SAISIE input', q); await p.click('.AIDE-SAISIE button'); await attendre(300); return derniere(p); }

    // ----- Téléphone, Mise en route, sans compte -----
    const t = await page({ width: 412, height: 860 }, '', 'tél');
    const pos = await t.evaluate(() => { const a = document.querySelector('.AIDE-PASTILLE').getBoundingClientRect(), l = document.querySelector('.THEME-TOGGLE').getBoundingClientRect();
        return { vis: a.width > 0, haut: Math.abs(a.top - l.top), gauche: l.left - a.right }; });
    verifier(pos.vis && pos.haut <= 1 && pos.gauche > 0 && pos.gauche < 20, 'téléphone : pastille de la mascotte juste à gauche de la lune ' + JSON.stringify(pos));
    await attendre(2200);
    verifier(await t.isVisible('.AIDE-BULLE') && await t.evaluate(() => document.querySelector('.AIDE-PASTILLE').classList.contains('AIDE-INVITE')), 'première fois : la mascotte se signale (« Besoin d\'aide ? Touchez-moi »)');
    await t.click('.AIDE-PASTILLE'); await attendre(800);
    const pres = await t.evaluate(() => ({ vis: !!document.querySelector('.AIDE-PRES') && document.querySelector('.AIDE-PRES').getClientRects().length > 0, q: document.querySelectorAll('.AIDE-PRES-Q').length,
        img: /mascotte-pouce/.test((document.querySelector('.AIDE-PRES-SCENE img') || {}).src), fen: !!document.querySelector('.AIDE-FEN') }));
    verifier(pres.vis && pres.q >= 10 && pres.img && !pres.fen, 'tout premier appui : page « Ce que je sais faire » (mascotte au pouce, ' + pres.q + ' questions à toucher)');
    await t.click('.AIDE-PRES-GO'); await attendre(800);
    verifier(await t.isVisible('.AIDE-FEN') && /^Bonjour, mon adjudant, en quoi puis-je vous aider\s\?/.test(await derniere(t)) && (await t.$$('.AIDE-PUCE')).length === 4, 'fenêtre ouverte : « Bonjour, mon adjudant, en quoi puis-je vous aider ? » (grade ADJ), 4 sujets proposés');
    verifier(!(await t.isVisible('.AIDE-BULLE')) && !(await t.evaluate(() => document.querySelector('.AIDE-PASTILLE').classList.contains('AIDE-INVITE'))), 'ouverte une fois : la mascotte ne se signale plus');
    let r = await demander(t, 'jme rappel plu de mon mot2pass');
    verifier(/code de réactivation/.test(r) && /Réponse trouvée dans la notice/.test(await t.innerText('.AIDE-FIL')), 'langage SMS et fautes (« jme rappel plu de mon mot2pass ») : code de connexion oublié');
    r = await demander(t, 'le juteux a refusé mon OM pk');
    verifier(/Refusées — à corriger/.test(r), 'jargon (« le juteux a refusé mon OM pk ») : demande refusée, corriger et renvoyer');
    r = await demander(t, 'merci beaucoup !');
    verifier(/Avec plaisir, mon adjudant/.test(r) && await t.evaluate(() => { const l = document.querySelectorAll('.AIDE-POUCE img'); return l.length && /mascotte-pouce/.test(l[l.length - 1].src); }), '« merci » : la mascotte lève le pouce (« Avec plaisir, mon adjudant ! »)');
    await t.click('.AIDE-QUOI'); await attendre(500);
    verifier(await t.isVisible('.AIDE-PRES') && !(await t.isVisible('.AIDE-FEN')), 'bouton « ? » de la discussion : rouvre « Ce que je sais faire »');
    await t.click('.AIDE-PRES-Q:has-text("Combien la nuit à Paris")'); await attendre(800);
    r = await derniere(t);
    verifier(!(await t.isVisible('.AIDE-PRES')) && /Paris/.test(r) && /140,00/.test(r), 'question touchée (« Combien la nuit à Paris ? ») : posée dans la discussion, réponse 140,00 €');
    await t.evaluate(() => { AIDE_FERMER(); AIDE_PRESENTATION(); }); await attendre(400);
    await t.click('.AIDE-PRES-Q:has-text("Comment j\'envoie ma demande")'); await attendre(800);
    verifier(/Prêtes à envoyer/.test(await derniere(t)), 'question touchée (« Comment j\'envoie ma demande ? ») : fiche de la notice');
    r = await demander(t, 'bonne journée');
    verifier(/Bonne journée, mon adjudant, et bonne mission/.test(r) && await t.evaluate(() => { const l = document.querySelectorAll('.AIDE-POUCE img'); return /mascotte-salut/.test(l[l.length - 1].src); }), '« bonne journée » : « Bonne journée, mon adjudant, et bonne mission ! » (mascotte qui salue)');
    // Toutes les formules de politesse, seules ou combinées, ont leur réponse (sans IA).
    const POLI = [['bonjour ça va ?', /Bonjour, mon adjudant.*(très bien|Très bien|pleine forme|attaque)/], ['re', /Re-bonjour/], ['bonsoir', /Bonsoir, mon adjudant/], ['mes respects mon adjudant', /Mes respects/],
        ['ça va et toi', /très bien|Très bien|Parfait|Tant mieux|Content|Excellent|forme|attaque/], ['bof je suis crevé', /Courage/], ['merci beaucoup bonne soirée', /(Avec plaisir|Je vous en prie|De rien).*Bonne soirée, mon adjudant/], ['désolé', /Pas de souci|Aucun problème|Ne vous inquiétez/],
        ['t es le meilleur', /[Mm]erci|mieux/], ['mdr', /😄/], ['t es qui ?', /mascotte d'aide de TRIGONE/], ['tu es là ?', /là|Présent/], ['je suis perdu', /Pas de panique|ensemble|pour ça/],
        ['à vos ordres', /Repos/], ['joyeux noël', /Joyeux Noël à vous aussi/], ['bon week-end', /Bon week-end/], ['non merci c est tout', /si besoin/], ['ok', /utre chose/],
        ['bon appétit', /Bon appétit/], ['tu dors ?', /24 h sur 24|je veille/], ['stp', /Bien sûr/], ['bonne route', /soyez prudent/]];
    const ratees = [];
    for (const [q, att] of POLI) { const x = await demander(t, q); if (!att.test(x)) ratees.push(q + ' → ' + x.slice(0, 60)); }
    verifier(!ratees.length, 'politesse : ' + POLI.length + ' formules (bonjour, ça va, merci, au revoir, désolé, bravo, mdr, t\'es qui, à vos ordres, fêtes…) ont leur réponse' + (ratees.length ? ' — ratées : ' + ratees.join(' | ') : ''));
    r = await demander(t, 'bonjour je voudrais savoir comment envoyer ma demande');
    verifier(!/Que puis-je faire pour vous/.test(r) && /Prêtes à envoyer|Envoyer/.test(r), 'bonjour + vraie question : la question passe (pas seulement « Bonjour »)');
    r = await demander(t, 'salut');
    verifier(/^Bonjour, mon adjudant\s!/.test(r.trim()) && /(Que puis-je|En quoi puis-je)/.test(r), '« salut » : la mascotte salue et propose des sujets');
    r = await demander(t, 'jai dormi a l\'hotel comment je le mets');
    verifier(/Repas & hébergement/.test(r), 'familier (« jai dormi a l\'hotel… ») : frais d\'hébergement');
    r = await demander(t, 'recette de la blanquette de veau');
    verifier(/discuter librement/.test(r) && await t.isVisible('.AIDE-IA'), 'hors notice, sans compte : propose de se connecter pour discuter librement');
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
    r = await demander(t, 'indemnisation en espagne');
    verifier(/ESPAGNE/.test(r) && /37,10 €/.test(r) && /137,80 €/.test(r), 'barème étranger : « indemnisation en espagne » → repas 37,10 €, nuit 137,80 €');
    r = await demander(t, 'indemnisation à l\'étranger');
    verifier(/dépend du pays/.test(r) && /Espagne/.test(r), 'étranger sans pays : explication, exemples et demande du pays');
    // Questions de suite : le sujet de la question précédente est repris.
    r = await demander(t, 'combien coute un repas en espagne');
    r = await demander(t, 'et en italie ?');
    verifier(/ITALIE/.test(r) && /38,50 €/.test(r) && !/Nuit/.test(r), 'suite : « et en italie ? » après un repas en Espagne → repas en Italie (38,50 €)');
    r = await demander(t, 'pareil pour une nuit');
    verifier(/ITALIE/.test(r) && /143,00 €/.test(r) && !/Repas :/.test(r), 'suite : « pareil pour une nuit » → nuit en Italie (143,00 €)');
    r = await demander(t, 'et à lyon');
    verifier(/Lyon/.test(r) && /120,00 €/.test(r), 'suite : « et à lyon » → nuit à Lyon (120,00 €)');
    // Mémento validé par l'unité : réponses sans IA.
    r = await demander(t, 'le péage c\'est remboursé ?');
    verifier(/péage/i.test(r) && /justificatif/i.test(r), 'mémento : « le péage c\'est remboursé ? » → sur justificatif, véhicule personnel autorisé');
    r = await demander(t, 'j\'ai combien de temps pour rendre mon cr');
    verifier(/30 jours/.test(r), 'mémento : délai du compte-rendu au 4e RIISC → 30 jours après la fin de mission');
    r = await demander(t, 'qui autorise ma voiture perso');
    verifier(/chef de corps/i.test(r), 'mémento : véhicule personnel autorisé par le chef de corps');
    r = await demander(t, 'code fd du 4e riisc formation'); await attendre(800);
    r = await demander(t, 'et intervention ?');
    verifier(/FDYDDR4INT/.test(r), 'suite : « et intervention ? » après le code FD formation du 4e RIISC → FDYDDR4INT');
    r = await demander(t, 'blanquette');
    verifier(!/codes FD correspondent/.test(r) && /discuter librement|Vous voulez parler|Vous pensez|plusieurs possibilités|l'un de ceux-là/.test(r), 'un mot hors sujet après un code FD n\'est pas pris pour une suite (« blanquette »)');
    r = await demander(t, 'combien coute un repas en espagne'); r = await demander(t, 'blanquette');
    verifier(!/€/.test(r), 'un mot hors sujet après un barème n\'est pas pris pour une ville (« blanquette »)');
    // Indemnités kilométriques : distance par la route (simulée ici) et montant selon la puissance ; suites.
    await t.route('**/api/distance**', rt => { rt.fulfill({ contentType: 'application/json', body: JSON.stringify(/[?&]a=PARIS(&|$)/.test(rt.request().url()) ? { ok: true, km: 580 } : { ok: true, km: 33 }) }); });
    r = await demander(t, 'combien je vais toucher en ik entre libourne et bordeaux avec ma 5 cv'); await attendre(800); r = await derniere(t);
    verifier(/Libourne → Bordeaux/.test(r) && /33 km/.test(r) && /10,56 €/.test(r) && /21,12 €/.test(r) && !/6 à 7 CV/.test(r), 'IK : Libourne → Bordeaux, 33 km, 5 CV → 10,56 € (aller-retour 21,12 €)');
    r = await demander(t, 'et en 7 chevaux ?'); await attendre(800); r = await derniere(t);
    verifier(/6 à 7 CV/.test(r) && /13,53 €/.test(r), 'IK, suite : « et en 7 chevaux ? » → 33 km × 0,41 € = 13,53 €');
    r = await demander(t, 'et pour paris'); await attendre(800); r = await derniere(t);
    verifier(/Libourne → Paris/.test(r) && /580 km/.test(r) && /237,80 €/.test(r), 'IK, suite : « et pour paris » → Libourne → Paris, 580 km × 0,41 € = 237,80 €');
    r = await demander(t, 'tarif ik');
    verifier(/0,32 €/.test(r) && /0,41 €/.test(r) && /0,45 €/.test(r), 'IK sans trajet : le barème par puissance (0,32 / 0,41 / 0,45 € le km)');
    await t.unroute('**/api/distance**');
    r = await demander(t, 'indemnités aux usa');
    verifier(/ETATS-UNIS/.test(r) && /New York/.test(r) && /≈/.test(r), 'barème étranger : États-Unis (avec New York) converti en euros');
    r = await demander(t, 'tarif hotel a la reunion');
    verifier(/outre-mer/.test(r), 'outre-mer : renvoi à l\'assistant Chorus DT (barèmes absents de TRIGONE)');
    await t.click('.AIDE-VIDER'); await attendre(300);
    // Concordance : aide/tarifs.json = barèmes de Compte-rendu (sinon relancer node aide/extraire-tarifs.js).
    const cr0 = await (await b.newContext()).newPage(); await cr0.goto(URL + 'cr/'); await attendre(1500);
    const conc = await cr0.evaluate(() => fetch('../aide/tarifs.json').then(r => r.json()).then(x => JSON.stringify(x.pays) === JSON.stringify(COUNTRY_MISSION_RATES) &&
        JSON.stringify(x.change) === JSON.stringify(DEFAULT_EXCHANGE_RATES) && JSON.stringify(x.grandesVilles) === JSON.stringify(GRANDES_VILLES_FR) && x.repasFrance === GET_REPAS_RATE_EUR({}) &&
        x.hebergementFrance.PARIS === GET_HEBERG_RATE_FOR_JOUR({ V: 'PARIS' }, {}) && x.hebergementFrance.GRANDE === GET_HEBERG_RATE_FOR_JOUR({ V: 'GRANDE' }, {}) && x.hebergementFrance.PETITE === GET_HEBERG_RATE_FOR_JOUR({ V: 'PETITE' }, {}) && JSON.stringify(x.ik) === JSON.stringify(DEFAULT_IK_RATES)));
    verifier(conc, 'aide/tarifs.json identique aux barèmes de Compte-rendu (pays, devises, grandes villes, repas, hébergement)');
    await cr0.close();

    // ----- Rappels et félicitations (mascotte qui salue), une fois par jour au plus, après une vraie réponse -----
    await t.evaluate(() => { localStorage.setItem('mission_data', JSON.stringify({ DEBUT: '2026-10-12T07:30:00', DEADLINE: '2026-11-11T18:00:00', LIBELLE_MISSION: 'STAGE FORMATEUR', MAIL_SENT: false }));
        localStorage.setItem('trigone_cr_envoyes_total', '1'); localStorage.removeItem('trigone_aide_rappel_jour'); localStorage.removeItem('trigone_aide_medaille_fetee'); });
    await demander(t, 'comment je fais un ordre de mission'); await attendre(1500);
    const rap = await t.evaluate(() => [...document.querySelectorAll('.AIDE-LIGNE')].filter(l => /mascotte-salut/.test(l.querySelector('img').src)).map(l => l.textContent));
    verifier(rap.length === 2 && /compte-rendu de fin de mission/.test(rap[0]) && /avant le 11\/11/.test(rap[0]) && /TRIGONE de Bronze/.test(rap[1]) && /Encore 9 comptes-rendus/.test(rap[1]),
        'rappels : CR à rendre (avant le 11/11) et félicitations Bronze (encore 9 pour l\'Argent), mascotte qui salue');
    await demander(t, 'comment je fais un ordre de mission'); await attendre(1500);
    verifier(await t.evaluate(() => [...document.querySelectorAll('.AIDE-LIGNE img')].filter(i => /mascotte-salut/.test(i.src)).length) === 2, 'rappels : pas répétés dans la journée');
    await t.evaluate(() => { localStorage.removeItem('mission_data'); localStorage.removeItem('trigone_cr_envoyes_total'); });
    await t.click('.AIDE-VIDER'); await attendre(300);

    // ----- Salutation selon le grade (écritures libres) ; commissaire : Monsieur ou Madame, demandé une fois -----
    const sal = await t.evaluate(() => ['A/C', 'Sergent chef', 'CNE.', 'lcl', '1CL', 'MAJ', 'civil'].map(AIDE_MOTEUR.appellation));
    verifier(sal.join('|') === 'mon adjudant-chef|sergent-chef|mon capitaine|mon colonel|soldat|major|', 'appellations : A/C, Sergent chef, CNE., lcl, 1CL, MAJ, civil → ' + sal.join(' | '));
    await t.evaluate(() => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.grade = 'CRP'; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); AIDE_OUVRIR(); }); await attendre(400);
    await t.click('.AIDE-VIDER'); await attendre(300);
    verifier(/dois-je dire/.test(await derniere(t)) && await t.isVisible('[data-civ="Madame"]'), 'commissaire (CRP) : la mascotte demande Monsieur ou Madame le commissaire');
    await t.click('[data-civ="Madame"]'); await attendre(300);
    verifier(/^Bonjour, Madame le commissaire, en quoi puis-je vous aider\s\?/.test(await derniere(t)), 'choix retenu : « Bonjour, Madame le commissaire, en quoi puis-je vous aider ? »');
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
    await pc.evaluate(() => AIDE_FERMER()); await pc.click('.PC-BAS .AIDE-CARTE-PC-QUOI'); await attendre(500);
    verifier(await pc.isVisible('.AIDE-PRES'), 'PC : « Ce que la mascotte sait faire › » sous la carte ouvre la page des questions à toucher');
    await pc.evaluate(() => AIDE_PRESENTATION_FERMER());

    // ----- Compte-rendu : même aide, sujets du Compte-rendu, « Me montrer » vers Mise en route -----
    const c = await page({ width: 412, height: 860 }, 'cr/', 'CR');
    verifier(await c.isVisible('.AIDE-PASTILLE'), 'Compte-rendu : pastille de la mascotte');
    await c.evaluate(() => AFFICHER_ECRAN_MEDAILLE('ARGENT', 10)); await attendre(500);
    verifier(/^Bravo, mon adjudant\s! Vous obtenez le TRIGONE d'Argent pour vos 10 comptes-rendus envoyés\. Encore 10 et c'est l'Or/.test(await c.textContent('#MEDAILLE-TEXTE')) && /mascotte-pouce/.test(await c.getAttribute('#MEDAILLE-MASCOTTE', 'src')),
        'fenêtre de médaille : « Bravo, mon adjudant ! … Encore 10 et c\'est l\'Or ! », mascotte aux deux pouces');
    await c.evaluate(() => FERMER_ECRAN_MEDAILLE()); await attendre(500);
    await c.click('.AIDE-PASTILLE'); await attendre(800);
    await c.click('.AIDE-PRES-GO'); await attendre(800);
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
    r = await demander(a, 'tu connais une bonne blague sur les gendarmes ?'); await attendre(1500); r = await derniere(a);
    verifier(/Réponse simulée/.test(r) && !/cerveau IA|Demander à l'IA/.test(await a.innerText('.AIDE-FIL')), 'compte connecté, question libre : réponse directe, sans bouton « demander à l\'IA »');
    await demander(a, 'mon chef dit que ma demande est fausse et je capte rien'); await attendre(1500);
    if (!/Réponse simulée/.test(await derniere(a))) { await a.evaluate(() => { const l = document.querySelectorAll('.AIDE-FIL [data-ia]'); l[l.length - 1].click(); }); await attendre(1500); }
    r = await derniere(a);
    verifier(/Réponse simulée/.test(r) && /Réponse libre/.test(await a.innerText('.AIDE-FIL')) && !/\[FICHE/.test(r), 'compte connecté : réponse libre (étiquette « la notice fait foi »), sans la balise [FICHE]');
    verifier(await a.evaluate(() => { const l = document.querySelectorAll('.AIDE-M.lui.ia'); return !!l[l.length - 1].querySelector('[data-notice]'); }), 'réponse de l\'IA : lien vers la page de la notice de la fiche utilisée');
    const ess = await a.evaluate(() => JUMELAGE_API('aide/ia', { question: 'où je clique', fiches: ['envoyer-demande', 'inconnue'], ecran: 'mer-documents', app: 'mer', historique: [{ de: 'moi', texte: 'bonjour' }] }));
    const sys = ess.essai.messages[0].content;
    verifier(ess.essai.fiches.join() === 'envoyer-demande' && /ÉCRAN OUVERT PAR L'UTILISATEUR : Documents/.test(sys) && /FICHES UTILES/.test(sys) && /juteux/.test(sys) && ess.essai.messages.length === 3,
        'serveur : consigne avec l\'écran ouvert, les écrans, le jargon, les seules fiches connues, la conversation');
    const lib = await a.evaluate(() => JUMELAGE_API('aide/ia', { question: 'tu connais Brest ?', sujet: 'libre', fiches: ['envoyer-demande'], ecran: 'mer-documents', app: 'mer' }));
    const sysL = lib.essai.messages[0].content;
    verifier(lib.essai.libre && !/LES ÉCRANS DE TRIGONE|FICHES UTILES/.test(sysL) && /RÈGLES DE CALCUL/.test(sysL) && sysL.length < sys.length && sys.length < 9000, 'consignes allégées (seulement les écrans utiles) ; conversation libre encore plus courte (ni écrans ni fiches, règles des frais gardées), ' + sysL.length + ' caractères contre ' + sys.length);
    verifier(ess.fiche === 'envoyer-demande' && ess.restant === 40 - 3, 'serveur : fiche utilisée renvoyée, questions restantes comptées (' + ess.restant + ')');
    let code = 0;
    for (let i = 0; i < 42 && code !== 429; i++) code = await a.evaluate(() => JUMELAGE_API('aide/ia', { question: 'test' }).then(() => 200, e => e.statut));
    verifier(code === 429, 'limite : au-delà de 40 questions par jour et par compte, l\'IA refuse (429)');
    await a.evaluate(() => AIDE_OUVRIR()); await attendre(300);
    await demander(a, 'blanquette'); await attendre(1200);
    verifier(/revient demain|reviens demain/.test(await a.innerText('.AIDE-FIL')) && /notice|toute prête|sèche|librement|Vous voulez parler|plusieurs possibilités|l'un de ces|l'un de ceux/.test(await derniere(a)), 'quota du jour atteint : la mascotte le dit et continue avec sa mémoire');
    verifier(await a.evaluate(() => fetch('api/aide/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"question":"x y"}' }).then(r => r.status)) === 401, 'sans compte : la route de l\'IA refuse (401)');
    // ----- « Qui valide ma demande ? » : réponse personnelle (profil + annuaire de l'unité, avec la fonction) -----
    const MAILV = 'val.' + s + '@interieur.gouv.fr';
    const v = await page({ width: 412, height: 860 }, '', 'VAL1');
    await v.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
    await v.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await v.fill('#JUM-C-MAIL', MAILV); await v.click('#JUM-C-ENVOI'); await attendre(1500);
    await v.click('#JUM-C-VALIDER'); await attendre(2000); await v.evaluate(() => JUMELAGE_FERMER_COMPTE());
    await v.evaluate(() => JUMELAGE_API('unite', { grade: 'ADJ', nom: 'VALIDE', prenom: 'Paul' }));
    await a.evaluate(() => JUMELAGE_API('unite', { grade: 'ADJ', nom: 'TEST', prenom: 'Essai' }));
    await v.evaluate(() => JUMELAGE_API('roles', { ajouter: ['valideur1'], retirer: [], fonctions: { valideur1: 'Chef de section', valideur2: 'ignorée (pas le rôle)' } }));
    const an = await a.evaluate(m => JUMELAGE_API('annuaire?role=valideur1').then(r => r.personnes.filter(x => x.mail === m)[0] || null), MAILV);
    verifier(an && an.fonction === 'Chef de section', 'annuaire de l\'unité : la fonction du VALIDEUR 1 est connue (« Chef de section ») ' + JSON.stringify(an));
    await a.evaluate(m => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.mailVal1 = m; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); AIDE_OUVRIR(); }, MAILV); await attendre(500);
    await a.click('.AIDE-VIDER'); await attendre(300);
    await demander(a, 'qui valide ma demande de mise en route ?'); await attendre(2000);
    r = await derniere(a);
    verifier(/VALIDEUR 1/.test(r) && /chef de section/.test(r) && /VALIDEUR 2/.test(r) && /assistant Chorus DT/.test(r) && /d'après votre profil/.test(await a.innerText('.AIDE-FIL')),
        '« qui valide ma demande ? » : VALIDEUR 1 du profil avec sa fonction (chef de section), puis VALIDEUR 2 et assistant Chorus DT de l\'unité');
    await a.evaluate(() => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.mailVal1 = 'inconnu.ailleurs@trigone-app.com'; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); });
    await demander(a, 'c est qui mon val1'); await attendre(2000);
    verifier(/Je ne le trouve pas parmi les VALIDEUR 1/.test(await derniere(a)), 'VALIDEUR 1 du profil absent de l\'unité : la mascotte prévient (jamais un valideur d\'une autre unité)');
    await demander(a, 'quelle est mon adresse trigone'); await attendre(500);
    verifier(/Votre adresse TRIGONE, c'est/.test(await derniere(a)), '« quelle est mon adresse trigone » : l\'adresse du compte, avec Copier');
    r = await demander(a, 'comment je fais un ordre de mission');
    verifier(/^Touchez le bouton doré NOUVELLE DEMANDE et laissez-vous guider/.test(r.trim()) && /Voir comment faire/.test(r) && !(await a.evaluate(() => { const l = document.querySelectorAll('.AIDE-DETAIL'); return l[l.length - 1].open; })),
        'réponse « humaine » : une phrase courte, le pas-à-pas replié derrière « Voir comment faire » (' + r.trim().slice(0, 60) + ')');
    // ----- Codier : les unités écrites de toutes les façons -----
    {
        const D = require('../aide/donnees.js'), cod = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'codier.json'), 'utf8'));
        const txt = q => { const x = D.codier(q, cod); return x ? x.html : ''; };
        verifier(['code fd du 6rg', 'code fd 6eme rg', 'code FD du 6ème régiment du génie', 'code fd sixieme regiment du genie', 'code fd 6e genie'].every(q => /FD1ADFY21C/.test(txt(q)) && /6° RG/.test(txt(q))),
            'codier : « 6rg », « 6eme rg », « 6ème régiment du génie », « sixième régiment du génie », « 6e génie » → codes du 6° RG');
        verifier(['code fd 3rpima', 'code fd 3°RPiMa', 'le code du 3e rpima', 'code fd du 3ème régiment de parachutistes d\'infanterie de marine'].every(q => /FD1ADEG21C/.test(txt(q))) && D.intention('le code du 3rpima', null) === 'fd',
            'codier : « 3rpima », « 3°RPiMa », « le code du 3e rpima », en toutes lettres → 3° RPIMA');
        verifier(/FDYDDR4FRM/.test(txt('code fd 4eriisc formation')) && /2° REI/.test(txt('code fd du 2e régiment étranger d\'infanterie')), 'codier : « 4eriisc formation », « 2e régiment étranger d\'infanterie » (REI)');
    }

    // ----- Selon SA mission : droits aux repas, détail d'un montant (Compte-rendu) -----
    {
        const cr = await page({ width: 412, height: 860 }, 'cr/', 'CR mission');
        await cr.evaluate(() => { DEMO_DEMARRER(); DEMO_AFFICHER_ETAPE(9); }); await attendre(1500);
        const x = await cr.evaluate(async () => { const T = await fetch('../aide/tarifs.json').then(r => r.json()), ctx = { tarifs: T, change: { taux: T.change, date: '' } }, C = window.AIDE_CIRCUIT;
            return { i1: C.intention('ai je droit au repas du soir ?', ctx), i2: C.intention('pourquoi seulement 180 € ?', ctx), i3: C.intention('explique moi le calcul de mon forfait', ctx),
                d: (await C.repondre('droit', 'ai je droit au repas du soir ?', ctx)).html, c: (await C.repondre('calcul', 'pourquoi seulement 180 € ?', ctx)).html, r: C.resumeMission() }; });
        verifier(x.i1 === 'droit' && /parti à 06 h 35/.test(x.d) && /rentré à 16 h 30/.test(x.d) && /soir <b style="color:#b91c1c">non/.test(x.d), '« ai-je droit au repas du soir ? » : selon SES horaires (parti 6 h 35, rentré 16 h 30 : pas le soir du retour)');
        verifier(x.i2 === 'calcul' && x.i3 === 'calcul' && /180,00 €/.test(x.c) && /Nuits payantes : 2/.test(x.c) && /jusqu'à <b>3 repas de midi/.test(x.c), '« pourquoi seulement 180 € ? » : détail (2 nuits) et repas possibles non déclarés (3 midis, 2 soirs)');
        verifier(/départ le \d\d\/\d\d à 06 h 35/.test(x.r) && !/LEFEBVRE|matricule/i.test(x.r), 'résumé de la mission pour l\'IA : horaires, sans nom ni matricule');
        await cr.context().close();
    }

    // ----- Suites de questions : on ne reprend pas tout depuis le début -----
    {
        await t.evaluate(() => { AIDE_FERMER(); sessionStorage.removeItem('trigone_aide_fil'); sessionStorage.removeItem('trigone_aide_dernier'); AIDE_OUVRIR(); }); await attendre(600);
        const s1 = await demander(t, 'prix à Lyon'); await attendre(300);
        const s2 = await demander(t, 'et paris'); await attendre(300);
        const s3 = await demander(t, 'et marseille'); await attendre(300);
        const s4 = await demander(t, 'et en italie'); await attendre(300);
        const s5 = await demander(t, 'pareil pour une nuit');
        verifier(/Lyon/.test(s1) && /120,00 €/.test(s1) && /Paris/.test(s2) && /140,00 €/.test(s2) && /Marseille/.test(s3) && /ITALIE/.test(s4) && /Nuit/.test(s5),
            'suites : « prix à Lyon » → « et paris » → « et marseille » → « et en italie » → « pareil pour une nuit » : chaque réponse reprend le sujet [' + [s1, s2, s3, s4, s5].map(x => x.slice(0, 40)).join(' | ') + ']');
    }

    // ----- Simulation d'une mission décrite en une phrase -----
    {
        const sim = await t.evaluate(async () => {
            const T = await fetch('aide/tarifs.json').then(r => r.json()), C = window.AIDE_CIRCUIT, ctx = { tarifs: T, change: { taux: T.change, date: '' }, distance: () => Promise.resolve(580) };
            const q1 = 'si je pars sur paris en vrc remboursement indemnité kilometrique pour 5 jours de mission hebergement et repas a ma charge combien je vais etre rembourser ?';
            const r1 = await C.repondre(C.intention(q1, ctx), q1, ctx);
            const r2 = await C.repondre('simulation', 'depuis libourne en 6 cv', Object.assign({ precedent: r1.params }, ctx));
            const q3 = 'si je vais à Nogent-le-Rotrou 3 jours en vl perso 8cv nourri au mess';
            const r3 = await C.repondre('simulation', q3, ctx);
            const ctx2 = Object.assign({}, ctx, { distance: () => Promise.resolve({ km: 150, de: 'PARIS (75001)', a: 'NOGENT-LE-ROTROU (28400)' }) });
            const r4 = await C.repondre('simulation', 'si je vais a nogent le rotrou 3 jours en vrc 5cv depuis paris combien je touche', ctx2);
            return { i1: C.intention(q1, ctx), r1: r1.html, r2: r2.html, r3: r3.html, r4: r4.html };
        });
        verifier(sim.i1 === 'simulation' && /5 jours/.test(sim.r1) && /Paris/.test(sim.r1) && /9 repas/.test(sim.r1) && /4 nuits/.test(sim.r1) && /740,00 €/.test(sim.r1) && /d'où vous partez/.test(sim.r1),
            'simulation « Paris en VRC, 5 jours, hébergement et repas à ma charge » : 9 repas + 4 nuits à Paris = 740 €, demande d\'où l\'on part pour les IK');
        verifier(/Libourne/.test(sim.r2) && /1 160 km/.test(sim.r2) && /475,60 €/.test(sim.r2) && /1 215,60 €/.test(sim.r2), 'suite « depuis Libourne en 6 CV » : IK 1 160 km × 0,41 € = 475,60 €, total 1 215,60 €');
        verifier(/Nogent-le-Rotrou \(28400\)/.test(sim.r4) && /300 km/.test(sim.r4), 'ville tapée vite (« nogent le rotrou », sans tirets ni majuscules) : nom officiel confirmé « Nogent-le-Rotrou (28400) », IK sur 300 km');
        verifier(/Nogent Le Rotrou/i.test(sim.r3) && /repas fournis/.test(sim.r3) && /180,00 €/.test(sim.r3), 'simulation « Nogent-le-Rotrou 3 jours, nourri au mess » : nom complet, repas fournis, 2 nuits = 180 €');
    }

    // ----- Le circuit de la personne : ses demandes, ses comptes-rendus, ses chiffres, ses rôles -----
    const k = await page({ width: 412, height: 860 }, '', 'circuit');
    await k.evaluate(() => {
        const H = 3600e3, now = Date.now();
        localStorage.setItem('trigone_aide_vue', '1'); localStorage.setItem('trigone_aide_nouveautes_vues', '999'); localStorage.setItem('trigone_aide_rappel_jour', new Date().toISOString().slice(0, 10));
        const dem = (id, objet, lieu, cp, dep, arr, pays) => ({ id, objet, personnes: [{ grade: 'ADC', nom: 'FICTIF' }], trajets: { aller: { dateDep: dep, lieuArr: lieu, cpArr: cp, paysArr: pays || '', moyen: 'FERREE' }, retour: { dateArr: arr } } });
        localStorage.setItem('mer_bibliotheque', JSON.stringify([{ id: 'b1', envoyeLe: new Date(now - 30 * H).toISOString(), demandes: [dem('d1', 'STAGE FHU', 'NOGENT-LE-ROTROU', '28400', '2026-10-12T07:00', '2026-10-16T18:30')] },
            { id: 'b2', envoyeLe: new Date(now - 300 * H).toISOString(), demandes: [dem('d2', 'REUNION', 'MADRID', '', '2026-10-20T06:00', '2026-10-22T20:00', 'ESPAGNE')] }]));
        localStorage.setItem('trigone_suivi', JSON.stringify({ d1: { genre: 'mer', etape: 'val2', le: now - 18 * H, etapes: [{ e: 'envoyee', le: now - 30 * H }, { e: 'val1', le: now - 18 * H, qui: 'CNE TEST' }] },
            d2: { genre: 'mer', etape: 'traite', le: now - 100 * H, etapes: [{ e: 'traite', le: now - 100 * H, qui: 'SCH ASSIST' }] },
            env1: { genre: 'cr', etape: 'traite', le: now - 90 * H, etapes: [{ e: 'chorus', le: now - 200 * H }, { e: 'traite', le: now - 90 * H, qui: 'SCH ASSIST' }] } }));
        localStorage.setItem('mission_bibliotheque', JSON.stringify([{ debut: '15/09/2026 07:00:00', forfaitOfficiel: 300, envoiId: 'env1', snapshot: { LIBELLE_MISSION: 'EXERCICE NIMES', JOURS: [{ L: 'PAYANT' }, {}], IK_A: true, IK_KM_A: 240, IK_MONTANT_A: 98.4 } }]));
        localStorage.setItem('trigone_cr_envoyes_total', '7');
        localStorage.setItem('trigone_boite', JSON.stringify([{ id: 'x1', nature: 'niveau1', n: 1, ids: ['z1'], noms: 'SCH BERNARD', objet: 'MISSION LYON', dates: '14/10/2026', le: now - 50 * H, statut: 'nouveau' }]));
        localStorage.removeItem('trigone_roles_locaux');
    });
    await k.reload(); await attendre(2500);
    await k.evaluate(() => { document.querySelectorAll('.JUM-ACC,.JUM-PRES,.JUM-NOUV,.JUM-VERROU,.JUM-PAVE,.JUM-MDP-FOND,.AIDE-BULLE').forEach(x => x.remove()); AIDE_OUVRIR(); }); await attendre(800);
    const kd = async q => { await k.fill('.AIDE-SAISIE input', q); await k.click('.AIDE-SAISIE button'); await attendre(1300); return derniere(k); };
    r = await kd('elle en est où ma MER ?');
    verifier(/STAGE FHU/.test(r) && /Chez le VALIDEUR 2/.test(r) && /CNE TEST/.test(r) && await k.evaluate(() => !!document.querySelector('.AIDE-FRISE')), '« elle en est où ma MER ? » : la demande, la frise, chez le VALIDEUR 2 depuis… (validée par CNE TEST)');
    r = await kd('et celle de madrid ?');
    verifier(/REUNION/.test(r) && /Traitée par l'assistant Chorus DT/.test(r), 'suite « et celle de Madrid ? » : l\'autre demande, traitée par l\'assistant Chorus DT');
    r = await kd('combien je vais toucher pour nogent');
    verifier(/environ 540 €/.test(r) && /4 nuits/.test(r) && /90,00 €/.test(r), '« combien je vais toucher » : estimation repas + nuits (Nogent, 540 €)');
    r = await kd('mon cr il en est où');
    verifier(/EXERCICE NIMES/.test(r) && /traité par l'assistant Chorus DT/.test(r) && /300,00 €/.test(r), '« mon cr il en est où » : compte-rendu traité, forfait 300 €');
    r = await kd('combien de missions j ai faites');
    verifier(/1<\/b> mission|1 mission/.test(await k.evaluate(() => document.querySelectorAll('.AIDE-M.lui')[document.querySelectorAll('.AIDE-M.lui').length - 1].innerHTML)) && /98,40 €/.test(r) && /Bronze/.test(r), '« combien de missions j\'ai faites » : missions, IK, médaille');
    r = await kd('j ai quoi à valider ?');
    verifier(/pas le rôle de valideur/.test(r), 'sans le rôle de valideur : rien à valider (et rien de la Boîte d\'un autre rôle)');
    r = await kd('j ai combien de trucs à traiter');
    verifier(/Je n'ai pas accès à cette information depuis votre compte/.test(r), 'sans le rôle d\'assistant Chorus DT : « Je n\'ai pas accès à cette information depuis votre compte »' + (/Je n'ai pas accès/.test(r) ? '' : ' [' + r.slice(0, 200) + ']'));
    await k.evaluate(() => localStorage.setItem('trigone_roles_locaux', JSON.stringify({ valideur1: true })));
    r = await kd('des demandes à signer ?');
    verifier(/1 demande/.test(r) && /SCH BERNARD/.test(r), 'VALIDEUR 1 : « des demandes à signer ? » : la demande de SCH BERNARD, depuis 2 jours');
    r = await kd('100 dollars en euros');
    verifier(/= 92,00 €/.test(r), '« 100 dollars en euros » : 92,00 €');
    r = await kd('le codier est à jour ?');
    verifier(/Codier FD/.test(r) && /\d\d\/\d\d\/20\d\d/.test(r), '« le codier est à jour ? » : date de la version du codier');
    r = await kd('les taux ik sont actualisés ?');
    verifier(/Indemnités kilométriques/.test(r) && /0,32/.test(r), '« les taux ik sont actualisés ? » : barème et sa date');
    await k.evaluate(() => { D.objet = 'STAGE'; D.trajets.aller.dateDep = '2030-10-12T07:00'; D.trajets.retour.dateArr = '2030-10-10T18:00'; D.codeFD = 'FD1ADCW21C'; });
    r = await kd('vérifie ma demande');
    verifier(/retour est avant le départ/.test(r) && /fermé/.test(r) && /FD1ADAJ22Y/.test(r) && /Identité/.test(r), '« vérifie ma demande » : dates incohérentes, code FD fermé (remplaçant), champs manquants par onglet');
    await k.evaluate(() => { AIDE_FERMER(); MSG_ERREUR('Fichier trop lourd', 'Ce fichier dépasse 10 Mo.'); }); await attendre(600);
    await k.click('#MSG-POURQUOI'); await attendre(1200);
    verifier(/Fichier trop lourd/.test(await derniere(k)) && /taille permise/.test(await derniere(k)), 'message d\'erreur : « Pourquoi ce message ? » ouvre la mascotte qui l\'explique');
    r = await kd('t es nul');
    verifier(/conversation est coupée/.test(r) && await k.evaluate(() => document.querySelector('.AIDE-SAISIE input').disabled) && await k.evaluate(() => !/nul/.test(document.querySelector('.AIDE-FIL').innerText.split('Je ne poursuis')[0].slice(-40))), 'propos insultant : retiré, conversation coupée, saisie bloquée');
    const ins = await a.evaluate(() => JUMELAGE_API('aide/ia', { question: 'espèce de con' }).then(() => 200, e => e.statut + ' ' + e.message));
    verifier(/^400 .*insultants/.test(ins), 'serveur : question insultante refusée à l\'IA (' + ins + ')');
    await k.evaluate(() => localStorage.removeItem('trigone_aide_coupee'));

    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
