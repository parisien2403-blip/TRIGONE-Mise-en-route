// Registre OMR de l'assistant Chorus DT : n° OMR tiré à l'envoi (série commune), sur le PDF de la demande et du
// compte-rendu ; registre « Mises en route » / « Comptes-rendus rendus » (échéance fin + 30 jours, relance, montants,
// suppression, nouvelle série). Demande le serveur de test (TRIGONE_URL_BOITE) et le code ASSIST CHORUS DT.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE, codeChorus = process.env.TRIGONE_CODE_CHORUS;
    if (!URL || !codeChorus) { console.log('  (sauté : définissez TRIGONE_URL_BOITE et TRIGONE_CODE_CHORUS)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const MAILS = { M: 'missionnaire.' + suffixe + '@interieur.gouv.fr', C: 'chorus.' + suffixe + '@interieur.gouv.fr', C2: 'chorus2.' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom, largeur) {
        const ctx = await b.newContext({ viewport: { width: largeur || 480, height: 1000 }, acceptDownloads: true }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        return p;
    }
    const m = await appareil('M'), c = await appareil('C', 1440);
    await c.evaluate(() => JUMELAGE_REGLAGES()); await attendre(400);
    await c.check('#JUM-R-CHORUS'); await c.fill('#JUM-R-CODECHORUS', codeChorus); await c.click('.JUM-R-PRINCIPAL'); await attendre(1500);
    // Nouvelle série (assistant Chorus DT) : préfixe propre au test, pour des numéros prévisibles.
    const pref = 'T' + suffixe.slice(-4) + '-';
    const serie = await c.evaluate(p => JUMELAGE_OMR_SERIE({ prefixe: p, prochain: 7 }), pref);
    verifier(serie.prefixe === pref && serie.prochain === 7, 'assistant Chorus DT : nouvelle série (préfixe, premier numéro)');
    verifier(await m.evaluate(() => JUMELAGE_OMR_SERIE().then(() => 'ok', e => e.statut)) === 403, 'nouvelle série refusée à un compte sans rôle Chorus DT');
    // Missionnaire : la demande reçoit son n° OMR à l'envoi (avec la date), signé avec elle, et sur le PDF.
    const d = await m.evaluate(() => { const d = DEMO_DEMANDE(); d.id = 'reg' + Date.now(); return MER_NUMEROTER_OMR([d]).then(() => d); });
    verifier(d.omr === pref + '0007' && !!d.omrLe, 'missionnaire : n° OMR tiré à l\'envoi (' + d.omr + ') avec sa date');
    const d2 = await m.evaluate(() => { const d = DEMO_DEMANDE(); d.id = 'reg2' + Date.now(); return MER_NUMEROTER_OMR([d]).then(() => d); });
    verifier(d2.omr === pref + '0008', 'série commune : la demande suivante prend le numéro suivant');
    verifier(await m.evaluate(x => { const t = GENERER_PDF([x]).output(); return t.indexOf('OMR N') >= 0 && t.indexOf(x.omr) >= 0; }, d), 'PDF de la mise en route : « OMR N°… » en haut à droite');
    // Demande validée arrivée chez l'assistant Chorus DT → ligne du registre (onglet Mises en route).
    const fin = new Date(Date.now() - 40 * 86400000), debut = new Date(Date.now() - 42 * 86400000);
    const envoyer = (dem) => m.evaluate(([x, dest, deb, fi]) => {
        x.trajets.aller.dateDep = deb; x.trajets.retour.dateArr = fi; x.mailDemandeur = JUMELAGE_COMPTE_MAIL(); x.validations = [{ niveau: 1 }, { niveau: 2 }];
        return JUMELAGE_ENVOYER_DIRECT(dest, 'CHORUS', 'demande.json', JSON.stringify({ demandes: [x] }));
    }, [dem, MAILS.C, debut.toISOString().slice(0, 16), fin.toISOString().slice(0, 16)]);
    await envoyer(d); await envoyer(d2);
    await c.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    await c.evaluate(() => OUVRIR_REGISTRE('tout')); await attendre(600);
    // Registre commun : il peut contenir les lignes d'autres essais ; on ne regarde que celles de cette série.
    const reg = await c.evaluate(p => JUMELAGE_REGISTRE().filter(x => String(x.omr).indexOf(p) === 0), pref);
    verifier(reg.length === 2 && reg.every(x => x.omr && x.codeFD && x.personnes.length), 'registre : une ligne par demande validée reçue (n° OMR, code FD, personnel)');
    const texte = await c.evaluate(() => document.querySelector('.CARD').textContent);
    verifier(texte.indexOf('N°' + pref + '0007') < texte.indexOf('N°' + pref + '0008') && /En retard/.test(texte) && await c.evaluate(() => document.querySelectorAll('.MER-REG-FRISE').length > 0 && document.querySelectorAll('.MER-REG-FILTRE').length === 6), 'registre unique : ordre des n° OMR, frise par ligne, filtres, « En retard » (fin de mission + 30 jours dépassée)');
    // Relance du missionnaire : message dans sa boîte TRIGONE (Questions).
    await c.evaluate(r => REGISTRE_MESSAGE(r, true), d.id); await attendre(1500);
    verifier(/Rappel : votre compte-rendu/.test(await c.inputValue('#MER-REG-TXT')), 'relance : texte de rappel prérempli (modifiable)');
    await c.click('#MER-REG-GO'); await attendre(2500);
    verifier(await c.evaluate(r => (JUMELAGE_REGISTRE().filter(x => x.ref === r)[0].relances || []).length === 1, d.id), 'relance enregistrée sur la ligne (date)');
    await c.evaluate(() => { FERMER_MSG && FERMER_MSG(); });
    await m.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    verifier(await m.evaluate(() => JUMELAGE_BOITE_LISTE().some(x => x.nature === 'question' && /Rappel : votre compte-rendu/.test(x.question))), 'missionnaire : la relance arrive dans sa boîte (Questions)');
    // Compte-rendu rendu (même n° OMR, montants) → la ligne passe dans « Comptes-rendus rendus », marquée validée.
    await m.evaluate(([dest, omr, ref]) => JUMELAGE_ENVOYER_DIRECT(dest, 'CR', 'cr.pdf', JSON.stringify({ app: 'TRIGONE-CR', version: 1, missionnaire: 'SGT DUPONT Jean', libelle: 'Formation', dates: '', corps: '', fichiers: [],
        omr: omr, mref: ref, montants: { repas: 45.5, hebergement: 120, transports: 0, ik: 82.3, tc: 0, total: 247.8 } })), [MAILS.C, d.omr, d.id]);
    await c.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    await c.evaluate(() => OUVRIR_REGISTRE('tout')); await attendre(600);
    const t2 = await c.evaluate(() => document.querySelector('.CARD').textContent);
    verifier(/Validé/.test(t2) && t2.indexOf(pref + '0007') >= 0 && /247,80/.test(t2) && /82,30/.test(t2), 'registre : la ligne passe à « Validé — CR rendu », avec ses montants (repas, hébergement, IK…) et le total');
    const sommes = await c.evaluate(() => { const g = document.querySelector('.MER-REG-TOTAL .MER-REG-SOMMES'); return g ? g.textContent : ''; });
    verifier(/Repas/.test(sommes) && /IK/.test(sommes) && /Hébergement/.test(sommes) && /82,30/.test(sommes) && /247,80/.test(sommes), 'registre : en bas, le total de chaque rubrique (repas, hébergement, transports, IK, transp. commun, total)');
    verifier(await c.evaluate(() => getComputedStyle(document.querySelector('.MER-REG-LIGNE .MER-REG-GRILLE small')).color === 'rgb(26, 26, 26)'), 'registre : libellés (Code FD, Début…) en noir');
    // Plein écran : le registre couvre tout l'écran, au-dessus du menu ; on en sort par le même bouton.
    await c.click('.MER-REG-PLEIN-BTN'); await attendre(600);
    const plein = await c.evaluate(() => { const z = document.querySelector('.MER-REG-ZONE.plein'); if (!z) return null; const r = z.getBoundingClientRect(); return { x: r.left, y: r.top, l: r.width, h: r.height, fixe: getComputedStyle(z).position }; });
    verifier(!!plein && plein.fixe === 'fixed' && plein.x === 0 && plein.y === 0 && plein.l >= 1400 && plein.h >= 990, 'registre en plein écran (tout l\'écran)');
    if (process.env.TRIGONE_CAPTURES) await c.screenshot({ path: process.env.TRIGONE_CAPTURES + '/registre-plein.png' });
    // Correction d'un montant (repas 45,50 → 50) : total de la ligne et total du bas recalculés.
    await c.evaluate(r => REGISTRE_CORRIGER(r), d.id); await attendre(400);
    await c.fill('#MER-CORR-repas', '50'); await attendre(200);
    verifier(/252,30/.test(await c.textContent('#MER-CORR-TOTAL')), 'correction : total recalculé pendant la saisie');
    if (process.env.TRIGONE_CAPTURES) await c.screenshot({ path: process.env.TRIGONE_CAPTURES + '/registre-corriger.png' });
    await c.click('#MER-CORR-GO'); await attendre(600);
    const apres = await c.evaluate(r => { const x = JUMELAGE_REGISTRE().find(y => y.ref === r), m = MER_REG_MONTANTS(x); return { repas: m.repas, total: m.total, bas: (document.querySelector('.MER-REG-TOTAL') || {}).textContent || '', plein: !!document.querySelector('.MER-REG-ZONE.plein'), note: !!document.querySelector('.MER-REG-CORR') }; }, d.id);
    verifier(apres.repas === 50 && apres.total === 252.3 && /252,30/.test(apres.bas) && /50,00/.test(apres.bas) && apres.note, 'correction : montant et totaux (ligne, bas du registre) mis à jour, mention « Montants corrigés »');
    verifier(apres.plein, 'correction : le registre reste en plein écran');
    if (process.env.TRIGONE_CAPTURES) await c.screenshot({ path: process.env.TRIGONE_CAPTURES + '/registre-corrige.png' });
    await c.click('.MER-REG-PLEIN-BTN'); await attendre(400);
    verifier(await c.evaluate(() => !!document.querySelector('.MER-REG-ZONE') && !document.querySelector('.MER-REG-ZONE.plein')), 'sortie du plein écran');
    // Codes FD de l'unité (profil 4°RIISC → UIISC n°4 du codier) : vert ; autre unité : jaune ; et inversement pour un autre régiment.
    const codes = await c.evaluate(async () => {
        await CHARGER_CODIER(); const lire = window.JUMELAGE_REGLAGES_LIRE;
        const a = [MER_CODE_UNITE('FDYDDR4FCT'), MER_CODE_UNITE('FDYDDR4INT'), MER_CODE_UNITE('FD1ADNK11F'), MER_CODE_UNITE('FDYDDR1FCT')];
        window.JUMELAGE_REGLAGES_LIRE = () => Object.assign({}, lire(), { unite: '1ER RIISC' });
        const b = [MER_CODE_UNITE('FDYDDR1FCT'), MER_CODE_UNITE('FDYDDR4FCT')];
        window.JUMELAGE_REGLAGES_LIRE = () => Object.assign({}, lire(), { unite: '92 RI' });
        b.push(MER_CODE_UNITE('FD1ADGN21C'), MER_CODE_UNITE('FDYDDR4FCT'));
        window.JUMELAGE_REGLAGES_LIRE = () => Object.assign({}, lire(), { unite: 'BA 118' });
        b.push(MER_CODE_UNITE('FD3AD11801'), MER_CODE_UNITE('FD1ADGN21C'));
        window.JUMELAGE_REGLAGES_LIRE = lire;
        return a.concat(b).join(',');
    });
    verifier(codes === 'unite,unite,hors,hors,unite,hors,unite,hors,unite,hors', 'codes FD : 4°RIISC en vert, autres unités en jaune ; profils 1ER RIISC, 92°RI, BA 118 : leurs codes en vert (' + codes + ')');
    const carte = await c.evaluate(() => { const av = D.codeFD; D.codeFD = 'FDYDDR4FCT'; const a = TPL_INFO_FD(); D.codeFD = 'FD1ADNK11F'; const b = TPL_INFO_FD(); D.codeFD = av; return /MER-FD-UNITE unite/.test(a) && /Code du 4°RIISC/.test(a) && /MER-FD-CARTE hors/.test(b) && /Hors 4°RIISC/.test(b); });
    verifier(carte, 'demande : code FD du 4°RIISC en vert, code d\'une autre unité en jaune');
    // Champ « Unité » du profil : liste filtrée dès les premières lettres ; une unité hors liste est refusée.
    await c.evaluate(() => JUMELAGE_REGLAGES({ vue: 'profil' })); await attendre(500);
    await c.click('#JUM-R-UNITE'); await c.fill('#JUM-R-UNITE', '5'); await attendre(200);
    const choix = await c.evaluate(() => [...document.querySelectorAll('.JUM-UNITES button')].map(b => b.getAttribute('data-u')).join(','));
    await c.click('.JUM-UNITES button'); await attendre(200);
    const pris = await c.inputValue('#JUM-R-UNITE');
    await c.fill('#JUM-R-UNITE', 'REGIMENT INCONNU'); await c.evaluate(() => JUMELAGE_ENREGISTRER_REGLAGES(false)); await attendre(300);
    const refus = await c.evaluate(() => (document.getElementById('JUM-R-ERREUR') || {}).textContent || '');
    await c.evaluate(() => JUMELAGE_FERMER_REGLAGES()); await attendre(300);
    const plus = await c.evaluate(() => JUMELAGE_UNITES().length);
    verifier(plus > 100 && choix.split(',')[0] === '5°RIISC' && pris === '5°RIISC' && /dans la liste/.test(refus) && JSON.stringify(await c.evaluate(() => JUMELAGE_REGLAGES_LIRE().unite)) === '"4°RIISC"', 'profil : unité choisie dans une liste filtrée (« 5 » → 5°RIISC), unité hors liste refusée (' + plus + ' unités ; ' + choix.slice(0, 60) + ')');
    // Nature de l'OMR : individuel / collectif / international ; personnel d'une mission collective un nom par ligne.
    const nat = await c.evaluate(() => {
        const x = { personnes: [{ grade: 'ADJ', nom: 'A', prenom: 'Un' }, { grade: 'SGT', nom: 'B', prenom: 'Deux' }], pays: 'ALLEMAGNE' };
        const h = MER_REG_NATURE_HTML(x), p = MER_REG_PERSONNEL_HTML(x), i = MER_REG_NATURE_HTML({ personnes: [{ nom: 'A' }], pays: '' });
        return /COLLECTIF · 2/.test(h) && /INTERNATIONAL · ALLEMAGNE/.test(h) && (p.match(/<li>/g) || []).length === 2 && /INDIVIDUEL/.test(i) && !/INTERNATIONAL/.test(i);
    });
    verifier(nat, 'registre : OMR INDIVIDUEL / COLLECTIF / INTERNATIONAL, personnel collectif un nom par ligne');
    await c.evaluate(() => OUVRIR_REGISTRE('tout')); await attendre(600);
    verifier(await c.evaluate(p => !!document.querySelector('.MER-REG-LIGNE .MER-REG-NAT.indiv') && JUMELAGE_REGISTRE().filter(x => String(x.omr).indexOf(p) === 0).every(x => 'pays' in x), pref), 'registre : badge INDIVIDUEL affiché, pays de destination gardé dans la ligne');
    verifier(await c.evaluate(() => !!document.querySelector('.MER-REG-LIGNE .MER-REG-CODE.hors')), 'registre : code FD hors unité marqué en jaune');
    // Filtres libres : recherche, codes de l'unité / hors unité, période.
    const nb = () => c.evaluate(() => document.querySelectorAll('.MER-REG-LIGNE').length);
    const tous = await nb();
    await c.fill('#MER-REG-CHERCHE', pref + '0007'); await attendre(700);
    const n1 = await nb(), focus = await c.evaluate(() => document.activeElement && document.activeElement.id);
    await c.fill('#MER-REG-CHERCHE', 'zzzz introuvable'); await attendre(700);
    const n0 = await nb(), msg0 = await c.evaluate(() => /ne correspond/.test(document.querySelector('.CARD').textContent));
    verifier(tous >= 2 && n1 === 1 && n0 === 0 && msg0 && focus === 'MER-REG-CHERCHE', 'registre : recherche libre (n° OMR), le curseur reste dans la case (' + tous + '/' + n1 + '/' + n0 + ')');
    await c.fill('#MER-REG-CHERCHE', pref); await attendre(700);
    const ns = await nb();
    await c.selectOption('#MER-REG-CODE-F', 'unite'); await attendre(400);
    const nu = await nb();
    await c.selectOption('#MER-REG-CODE-F', 'hors'); await attendre(400);
    const nh = await nb();
    verifier(ns === 2 && nu === 0 && nh === 2, 'registre : filtre « codes du 4°RIISC » / « hors 4°RIISC » (' + nu + '/' + nh + ')');
    await c.evaluate(() => MER_REG_CRIT()); await attendre(300);
    await c.fill('#MER-REG-DU', '2099-01-01'); await c.dispatchEvent('#MER-REG-DU', 'change'); await attendre(400);
    verifier(await nb() === 0, 'registre : filtre par période (début de mission)');
    await c.evaluate(() => MER_REG_CRIT()); await attendre(300);
    verifier(await nb() === tous && !(await c.$('.MER-REG-BARRE .BTN-DANGER-TEXT')), 'registre : « Effacer les filtres »');
    await c.evaluate(() => OUVRIR_REGISTRE('retard')); await attendre(400);
    verifier((await c.evaluate(() => document.querySelector('.CARD').textContent)).indexOf(pref + '0007') < 0, 'filtre « En retard » : la ligne rendue n\'y est plus');
    await c.evaluate(() => OUVRIR_REGISTRE('ok')); await attendre(400);
    verifier((await c.evaluate(() => document.querySelector('.CARD').textContent)).indexOf(pref + '0007') >= 0, 'filtre « CR rendus » : la ligne rendue y est');
    await c.evaluate(() => OUVRIR_REGISTRE('tout')); await attendre(400);
    // PDF de l'onglet, et suppression d'une ligne (mission annulée).
    const dl = c.waitForEvent('download', { timeout: 15000 }); await c.evaluate(() => REGISTRE_PDF());
    verifier(/Registre OMR - toutes/.test((await dl).suggestedFilename()), 'PDF du registre (liste affichée)');
    await c.evaluate(r => REGISTRE_SUPPRIMER(r), d2.id); await attendre(400);
    await c.click('#MSG-OVERLAY .BTN-PRIMARY, #MSG-OVERLAY .MSG-BTN-CONFIRM').catch(() => c.evaluate(() => { const b = [...document.querySelectorAll('#MSG-OVERLAY button')].find(x => /Supprimer/.test(x.textContent)); b && b.click(); }));
    await attendre(400);
    verifier(await c.evaluate(r => !JUMELAGE_REGISTRE().some(x => x.ref === r), d2.id), 'suppression d\'une ligne (mission annulée)');
    // Deuxième assistant Chorus DT de l'unité : il voit le même registre (lignes reçues par le premier, suppression comprise).
    const c2 = await appareil('C2');
    await c2.evaluate(() => JUMELAGE_REGLAGES()); await attendre(400);
    await c2.check('#JUM-R-CHORUS'); await c2.fill('#JUM-R-CODECHORUS', codeChorus); await c2.click('.JUM-R-PRINCIPAL'); await attendre(1500);
    await c.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(800);
    await c2.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(1500);
    const reg2 = await c2.evaluate(p => JUMELAGE_REGISTRE().filter(x => String(x.omr).indexOf(p) === 0), pref);
    verifier(reg2.length === 1 && reg2[0].ref === d.id && (reg2[0].crs || []).length === 1 && !!reg2[0].recuPar, '2e assistant : même registre (ligne et CR reçus par le 1er ; ligne supprimée absente)');
    // Heures réelles de la mission, envoyées par le missionnaire depuis Compte-rendu → registre des assistants, en direct.
    const jal = { depart: '10/09/2026 07:42:00', surSite: '10/09/2026 11:05:00', departSite: '', retour: '' };
    await m.evaluate(([o, r, j]) => JUMELAGE_JALONS(o, r, j), [d.omr, d.id, jal]); await attendre(800);
    verifier(await m.evaluate(() => !JSON.parse(localStorage.getItem('trigone_jalons_file') || '{}') || !Object.keys(JSON.parse(localStorage.getItem('trigone_jalons_file') || '{}')).length), 'missionnaire : heures de départ et d\'arrivée sur site envoyées au registre');
    await c2.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(1200);
    const live = await c2.evaluate(r => { const x = JUMELAGE_REGISTRE().find(y => y.ref === r); const f = MER_REG_FRISE(x, MER_REG_ETAT(x)); return { j: (x.jalons || {}).surSite, f: f }; }, d.id);
    verifier(live.j === jal.surSite && /Sur site/.test(live.f) && /10\/09<br>07h42/.test(live.f) && /10\/09<br>11h05/.test(live.f), 'assistant : la frise montre l\'heure réelle du départ et de l\'arrivée sur site');
    verifier(await c2.evaluate(() => { const e = MER_REG_ETAT({ personnes: [{}], jalons: { depart: '10/10/2026 07:42:00', surSite: '10/10/2026 11:05:00' } }); return e.cls === 'encours' && /Sur site depuis le 10\/10 à 11h05/.test(e.txt); }), 'assistant : « Sur site depuis le … » tant que le missionnaire n\'est pas reparti');
    const refusJ = await c2.evaluate(([o, r]) => { localStorage.removeItem('trigone_jalons_file'); return JUMELAGE_JALONS(o, r, { depart: '01/01/2026 00:00:00' }).then(() => JSON.parse(localStorage.getItem('trigone_jalons_file') || '{}')); }, [d.omr, d.id]);
    await c2.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(1000);
    verifier(!Object.keys(refusJ).length && await c2.evaluate(r => (JUMELAGE_REGISTRE().find(y => y.ref === r).jalons || {}).depart, d.id) === jal.depart, 'heures refusées à un compte qui n\'est pas sur la demande');
    verifier(await c2.evaluate(r => { const x = JUMELAGE_REGISTRE().find(y => y.ref === r); return MER_REG_MONTANTS(x).total === 252.3 && MER_REG_MONTANTS(x, true).total === 247.8; }, d.id), '2e assistant : voit la correction des montants du 1er (total corrigé)');
    await c2.evaluate(r => REGISTRE_CORRIGER_OK(r, true), d.id); await attendre(300);
    await c2.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(800);
    await c.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(800);
    verifier(await c.evaluate(r => { const x = JUMELAGE_REGISTRE().find(y => y.ref === r); return MER_REG_MONTANTS(x).total === 247.8 && !MER_REG_CORRIGES(x).length; }, d.id), '« Revenir aux montants du CR » (2e assistant) : retour aux montants d\'origine chez le 1er aussi');
    await c2.evaluate(() => OUVRIR_REGISTRE('cr')); await attendre(600);
    verifier(/Demande reçue par/.test(await c2.evaluate(() => document.querySelector('.CARD').textContent)), '2e assistant : « Demande reçue par… » affiché');
    // Demande reçue par le 1er, compte-rendu reçu par le 2e : une seule ligne, validée chez les deux.
    const d3 = await m.evaluate(() => { const d = DEMO_DEMANDE(); d.id = 'reg3' + Date.now(); return MER_NUMEROTER_OMR([d]).then(() => d); });
    await envoyer(d3);
    await c.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    await m.evaluate(([dest, omr, ref]) => JUMELAGE_ENVOYER_DIRECT(dest, 'CR', 'cr.pdf', JSON.stringify({ app: 'TRIGONE-CR', version: 1, missionnaire: 'SGT DUPONT Jean', libelle: 'Formation', dates: '', corps: '', fichiers: [],
        omr: omr, mref: ref, montants: { repas: 10, hebergement: 0, transports: 0, ik: 0, tc: 0, total: 10 } })), [MAILS.C2, d3.omr, d3.id]);
    await c2.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    await c2.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(1000);
    await c.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(1000);
    const l1 = await c.evaluate(o => JUMELAGE_REGISTRE().filter(x => x.omr === o), d3.omr), l2 = await c2.evaluate(o => JUMELAGE_REGISTRE().filter(x => x.omr === o), d3.omr);
    verifier(l1.length === 1 && l2.length === 1 && l1[0].ref === d3.id && l2[0].ref === d3.id && (l1[0].crs || []).length === 1 && (l2[0].crs || []).length === 1,
        'demande chez le 1er, CR chez le 2e : réunis sur une seule ligne, chez les deux');
    // Relance par le 2e, suppression par le 2e : visibles chez le 1er. Registre ouvert chez le 1er : mis à jour tout seul (30 s).
    await c.evaluate(() => OUVRIR_REGISTRE('tout')); await attendre(1500);
    await c2.evaluate(r => JUMELAGE_REGISTRE_MAJ(r, { relances: [Date.now()], relancesQui: { 1: 'ADJ TEST' } }), d3.id); await attendre(1200);
    await c.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(1000);
    verifier(await c.evaluate(r => (JUMELAGE_REGISTRE().filter(x => x.ref === r)[0].relances || []).length === 1, d3.id), 'relance faite par le 2e : visible chez le 1er');
    verifier(await c.evaluate(o => [...document.querySelectorAll('.MER-REG-LIGNE')].some(e => e.textContent.indexOf('N°' + o) >= 0), d3.omr), 'registre ouvert chez le 1er : la ligne y est');
    await c2.evaluate(r => JUMELAGE_REGISTRE_MAJ(r, null), d3.id); await attendre(1200);
    await attendre(32000);   // sans rien toucher chez le 1er
    verifier(await c.evaluate(o => ![...document.querySelectorAll('.MER-REG-LIGNE')].some(e => e.textContent.indexOf('N°' + o) >= 0), d3.omr), 'registre ouvert chez le 1er : la suppression du 2e s\'affiche toute seule (relevé toutes les 30 s)');
    verifier(await c.evaluate(r => !JUMELAGE_REGISTRE().some(x => x.ref === r), d3.id), 'suppression faite par le 2e : la ligne disparaît chez le 1er');
    // Tout effacer et repartir à 0001 : registre vidé chez les deux assistants, numérotation remise à 0001.
    await c.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(800);
    verifier(await c.evaluate(() => JUMELAGE_REGISTRE().length > 0), 'avant remise à zéro : le registre a des lignes');
    await c.evaluate(() => OUVRIR_REGISTRE('mer')); await attendre(500);
    await c.evaluate(() => [...document.querySelectorAll('button')].find(b => /Tout effacer et repartir/.test(b.textContent)).click()); await attendre(400);
    await c.fill('#MER-VIDER-MOT', 'effacer'); await c.click('#MER-VIDER-GO'); await attendre(1500);
    verifier(await c.evaluate(() => JUMELAGE_REGISTRE().length === 0 && /remis à zéro/.test(document.body.textContent)), 'Tout effacer (mot EFFACER) : registre vide chez le 1er assistant');
    await c2.evaluate(() => JUMELAGE_REGISTRE_SYNCHRO()); await attendre(1200);
    verifier(await c2.evaluate(() => JUMELAGE_REGISTRE().length === 0), 'remise à zéro : registre vide aussi chez le 2e assistant');
    const serie0 = await c.evaluate(() => JUMELAGE_OMR_SERIE());
    verifier(serie0.prochain === 1 && serie0.prefixe === '', 'remise à zéro : prochain numéro OMR N°0001 (' + serie0.prefixe + serie0.prochain + ')');
    verifier(await m.evaluate(() => { const c = JSON.parse(localStorage.getItem('trigone_compte')); return fetch('api/registre/vider', { method: 'POST', headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton, 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status); }) === 403, 'remise à zéro refusée à un compte sans rôle Chorus DT');
    verifier(await m.evaluate(() => { const c = JSON.parse(localStorage.getItem('trigone_compte')); return fetch('api/registre', { method: 'POST', headers: { Authorization: 'TRIGONE ' + encodeURIComponent(c.mail) + ' ' + c.appareil + ' ' + c.jeton, 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status); }) === 403, 'registre commun refusé à un compte sans rôle Chorus DT');
    // Compte-rendu : le n° OMR repris de la mise en route figure sur son PDF.
    await m.goto(URL + 'cr/'); await attendre(2500);
    await m.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
    verifier(await m.evaluate(x => { APPLIQUER_MISE_EN_ROUTE(x); return M.OMR === x.omr && M.MER_REF === x.id; }, d), 'Compte-rendu « À partir d\'une mise en route » : n° OMR et demande repris');
    verifier(await m.evaluate(() => { const o = MONTANTS_CR(M); return typeof o.total === 'number' && 'ik' in o && 'repas' in o; }), 'Compte-rendu : montants envoyés avec le CR (repas, hébergement, transports, IK, total)');
    // Appui « Départ » dans Compte-rendu : l'heure part vers le registre (file d'envoi, renvoyée au prochain relevé).
    const fileJ = await m.evaluate(() => { localStorage.removeItem('trigone_jalons_sig'); const av = window.JUMELAGE_JALONS; let vu = null; window.JUMELAGE_JALONS = (o, r, j) => { vu = { o, r, j }; return Promise.resolve(); };
        const m0 = { OMR: M.OMR, MER_REF: M.MER_REF, DEBUT: M.DEBUT }; M.OMR = 'T-0001'; M.MER_REF = 'ref-test'; M.DEBUT = '10/10/2026 07:42:00'; JALONS_REGISTRE(); const deux = vu; vu = null; JALONS_REGISTRE();
        Object.assign(M, m0); window.JUMELAGE_JALONS = av; return { deux, encore: vu }; });
    verifier(fileJ.deux && fileJ.deux.o === 'T-0001' && fileJ.deux.j.depart === '10/10/2026 07:42:00' && fileJ.encore === null, 'Compte-rendu : l\'heure de départ est envoyée au registre, une seule fois tant qu\'elle ne change pas');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
