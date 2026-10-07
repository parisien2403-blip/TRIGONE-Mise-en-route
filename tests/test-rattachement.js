// « Me rattacher à une mission » : le chef de mission ouvre sa demande collective (code à 6 chiffres + QR), chaque
// participant de son unité s'y rattache lui-même (code tapé, ou lien du QR) ; le chef voit le nombre de pax et la carte
// de chacun, peut retirer quelqu'un ; à l'envoi le code est fermé ; mission rouverte puis annulée (tous prévenus).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const nid = () => String(Math.floor(1e9 + Math.random() * 8.9e9)).slice(0, 10);
    async function appareil(nom, prenom, grade, unite) {
        const ctx = await b.newContext({ viewport: { width: 420, height: 900 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(([n, pr, g, m, u]) => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.nom = n; r.prenom = pr; r.grade = g; r.matricule = m; if (u) r.unite = u;
            localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); sessionStorage.setItem('trigone_choix_fait', '1'); }, [nom.toUpperCase(), prenom, grade, nid(), unite || '']);
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', nom.toLowerCase() + '.' + suffixe + '@interieur.gouv.fr'); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        await p.reload(); await attendre(4000);   // à l'ouverture : unité et matricule déclarés au serveur
        await p.evaluate(() => JUMELAGE_CARTE_ID()); await attendre(400);
        return p;
    }
    const chef = await appareil('Roux', 'Emma', 'ADJ'), a = await appareil('Leroy', 'Sami', 'CPL'), c = await appareil('Durand', 'Lea', 'CCH'), x = await appareil('Ailleurs', 'Tom', 'SAP', '1°RIISC');
    // Accueil Mise en route : le bouton « Me rattacher à une mission ».
    await a.evaluate(() => SHOW_PAGE('ACCUEIL')); await attendre(400);
    verifier(await a.isVisible('.BTN-ACCUEIL-RATT'), 'accueil Mise en route : bouton « Me rattacher à une mission » sous « Nouvelle demande »');
    // Chef : demande collective, puis « Ouvrir aux participants ».
    const depart = new Date(Date.now() + 5 * 86400000); depart.setHours(6, 0, 0, 0);
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    await chef.evaluate(([dep, ret]) => { D = VIDE_DEMANDE(); D.objet = 'Renfort colonne Nantes'; D.personnes[0] = Object.assign(VIDE_PERSONNE(), { grade: 'ADJ', nom: 'ROUX', prenom: 'Emma', unite: '4°RIISC' });
        D.trajets.aller.dateDep = dep; D.trajets.aller.lieuArr = 'NANTES'; D.trajets.retour.dateArr = ret; SAVE_BROUILLON(); MER_ACTIVE_TAB = 'IDENTITE'; SHOW_PAGE('FORMULAIRE'); },
        [iso(depart), iso(new Date(depart.getTime() + 2 * 86400000 + 12 * 3600000))]);
    await attendre(600);
    verifier(/Ouvrir aux participants/i.test(await chef.innerText('.MER-RATT-BTN')), 'chef de mission (onglet Identité) : « Ouvrir aux participants (code de mission) »');
    await chef.click('.MER-RATT-BTN'); await attendre(2500);
    const code = (await chef.innerText('.JUM-RT-GROS')).replace(/\D/g, '');
    verifier(/^\d{6}$/.test(code) && await chef.evaluate(() => [...document.querySelectorAll('.JUM-RT-QR img, .JUM-RT-QR canvas')].some(e => e.getBoundingClientRect().width > 50)), 'code de mission à 6 chiffres (' + code + ') et QR code');
    verifier(await chef.evaluate(c => D.ratt && D.ratt.code === c, code), 'le code est gardé dans la demande (brouillon)');
    verifier(/1 pax/.test(await chef.innerText('.JUM-RT-PAX')) && await chef.isVisible('.JUM-RT-VIDE'), 'personne encore rattaché : « 1 pax (vous + 0) »');
    // Missionnaire A : tape le code, voit la mission, se rattache.
    await a.evaluate(() => JUMELAGE_RATTACHER()); await attendre(500);
    await a.fill('#JUM-RT-CODE', '000000'); await a.dispatchEvent('#JUM-RT-CODE', 'input'); await attendre(1200);
    verifier(/Code inconnu ou expiré/.test(await a.innerText('.JUM-RT-ZONE')), 'mauvais code : « Code inconnu ou expiré »');
    await a.fill('#JUM-RT-CODE', code); await a.dispatchEvent('#JUM-RT-CODE', 'input'); await attendre(1500);
    const vue = await a.innerText('.JUM-RT-ZONE');
    verifier(/MISSION TROUVÉE/.test(vue) && /Renfort colonne Nantes/.test(vue) && /ROUX Emma/.test(vue) && /NANTES/.test(vue), 'la mission s\'affiche avant de se rattacher (objet, chef, destination)');
    await a.click('.JUM-RT-GO'); await attendre(1500);
    verifier(await a.isVisible('.JUM-RT-OK') && /Vous êtes rattaché/.test(await a.innerText('.JUM-RT-ZONE')), 'A : « Vous êtes rattaché »');
    verifier(/Ouverte/.test(await a.innerText('.JUM-RT-MES')), 'A : la mission dans « Mes missions rattachées » (ouverte)');
    // Missionnaire C : par le lien du QR code (?mission=…).
    await c.goto(URL + '?mission=' + code); await attendre(5000);
    verifier(await c.isVisible('.JUM-RT-FOND') && /Renfort colonne Nantes/.test(await c.innerText('.JUM-RT-ZONE')), 'C : le lien du QR code ouvre « Me rattacher » sur la mission');
    await c.click('.JUM-RT-GO'); await attendre(1500);
    // Autre unité : refusé.
    const ailleurs = await x.evaluate(c => JUMELAGE_MISSION_API('voir', { get: true, code: c }).then(() => 'ok', e => e.message), code);
    verifier(/autre unité/.test(ailleurs), 'compte d\'une autre unité : « Cette mission est celle d\'une autre unité »');
    // Chef : la liste se remplit (actualisée toute seule), cartes TRIGONE, personnes ajoutées à la demande.
    await attendre(10500);
    verifier(/3 pax/.test(await chef.innerText('.JUM-RT-PAX')) && (await chef.$$('.JUM-RT-UN .JUM-CARTE')).length === 2, 'chef : « 3 pax », une carte TRIGONE par rattaché (actualisé tout seul)');
    const pers = await chef.evaluate(() => D.personnes.map(p => [p.nom, p.matricule.replace(/\D/g, '').length, !!p.ratt]));
    verifier(pers.length === 3 && pers[1][0] === 'LEROY' && pers[1][1] === 10 && pers[1][2] && pers[2][0] === 'DURAND', 'les rattachés sont ajoutés à la demande collective (nom, NID), sans rien saisir');
    // Chef : retire C (MSG_CONFIRM de l'appli).
    await chef.click('.JUM-RT-UN:nth-child(2) .x'); await attendre(500);
    await chef.click('text=Retirer >> nth=-1'); await attendre(1500);
    verifier(/2 pax/.test(await chef.innerText('.JUM-RT-PAX')) && await chef.evaluate(() => D.personnes.length === 2), 'chef : C retiré (liste et demande à jour)');
    const cRevient = await c.evaluate(c => JUMELAGE_MISSION_API('rejoindre', { code: c }).then(() => 'ok', e => e.message), code);
    verifier(/vous a retiré/.test(cRevient), 'C retiré : ne peut pas revenir avec le code');
    await chef.click('.JUM-RT-OKB'); await attendre(300);
    // Envoi : liste relue puis figée, le code ne marche plus.
    await chef.evaluate(() => { var p = [JSON.parse(JSON.stringify(D))]; return MER_RATT_AVANT_ENVOI(p).then(() => { MER_RATT_FERMER(p); }); }); await attendre(1500);
    const apres = await c.evaluate(c => JUMELAGE_MISSION_API('voir', { get: true, code: c }).then(r => r.etat, e => e.message), code);
    verifier(apres === 'envoyee', 'demande envoyée : mission « envoyée », liste figée');
    const d2 = await appareil('Tardif', 'Max', 'SGT');
    const msgTard = await d2.evaluate(c => JUMELAGE_MISSION_API('rejoindre', { code: c }).then(() => 'ok', e => e.message), code);
    verifier(/déjà partie aux valideurs/.test(msgTard), 'après l\'envoi : « La demande est déjà partie aux valideurs : demandez à votre chef de la rouvrir »');
    // Rouvrir, puis annuler : les rattachés sont prévenus, la mission apparaît « annulée » chez A.
    const rouv = await chef.evaluate(c => JUMELAGE_MISSION_API('ouvrir', { code: c, rouvrir: true, resume: { objet: 'Renfort colonne Nantes' } }), code);
    verifier(rouv.rouverte && rouv.code === code, 'chef : « Rouvrir la mission » (même code)');
    const ann = await chef.evaluate(c => JUMELAGE_MISSION_API('annuler', { code: c, motif: 'contrordre', objet: 'Renfort colonne Nantes' }), code);
    verifier(ann.ok && ann.prevenus >= 1, 'mission annulée : rattachés prévenus (' + ann.prevenus + ')');
    await a.evaluate(() => JUMELAGE_RATTACHER()); await attendre(1500);
    verifier(/annulée : contrordre/.test(await a.innerText('.JUM-RT-MES')), 'A : « Mission annulée : contrordre » dans ses missions rattachées');
    // Bibliothèque : une demande envoyée peut être annulée (bouton), rangée dans « Annulées ».
    await chef.evaluate(() => { var d = JSON.parse(JSON.stringify(D)); d.id = 'dtest' + Date.now(); SAVE_BIBLIOTHEQUE([{ id: 'e1', envoyeLe: new Date().toISOString(), destinataire: 'val1@x', demandes: [d] }]); MER_DOSSIER.BIBLIOTHEQUE = 'validation'; SHOW_PAGE('BIBLIOTHEQUE'); });
    await attendre(600);
    verifier(await chef.evaluate(() => BIB_ANNULABLE(BIB_TROUVER('e1'))), 'Bibliothèque : « Annuler la mission » proposé (départ à venir)');
    await chef.evaluate(() => BIB_ANNULER('e1')); await attendre(300); await chef.fill('#MER-ANN-MOTIF', 'stage reporté'); await chef.click('#MER-ANN-OK'); await attendre(2000);
    verifier(await chef.evaluate(() => !!(BIB_TROUVER('e1').annulee && MER_BIB_ETATS(BIB_TROUVER('e1')).annulees)), 'Bibliothèque : demande annulée, rangée dans « Annulées »');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
