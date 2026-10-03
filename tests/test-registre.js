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
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
