// Matrice de scénarios de bout en bout, avec de vrais comptes TRIGONE et de vrais envois chiffrés (serveur de test) :
// demandes de mise en route individuelles / collectives, métropole / étranger, tous moyens de transport ; refus, renvoi,
// question ; erreurs de saisie et d'envoi ; comptes-rendus avec et sans mise en route, en France et à l'étranger.
// Demande le serveur de test (TRIGONE_URL_BOITE) et les codes VALIDEUR 1 / 2 et ASSIST CHORUS DT.
const path = require('path');
const { FICHIERS, APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE, code1 = process.env.TRIGONE_CODE_VAL1, code2 = process.env.TRIGONE_CODE_VAL2, codeC = process.env.TRIGONE_CODE_CHORUS;
    if (!URL || !code1 || !code2 || !codeC) { console.log('  (sauté : définissez TRIGONE_URL_BOITE et les codes VALIDEUR 1 / 2 / CHORUS)'); return; }
    const DIALOGUES = [];
    const b = await navigateur(), erreurs = [], sfx = Date.now().toString(36);
    const MAILS = { M: 'missionnaire.s' + sfx + '@interieur.gouv.fr', V1: 'chef.s' + sfx + '@interieur.gouv.fr', V2: 'colonel.s' + sfx + '@interieur.gouv.fr', C: 'chorus.s' + sfx + '@interieur.gouv.fr' };

    async function appareil(nom) {
        const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => { DIALOGUES.push(nom + ' : ' + d.message().slice(0, 200)); d.accept(); });
        await p.route('**/api/taux', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, date: '2026-09-30', source: 'BCE', taux: { 'EURO': 1, 'DOLLAR US': 0.9 } }) }));
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(m => { sessionStorage.setItem('trigone_choix_fait', '1'); const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); Object.assign(r, { grade: 'SGT', nom: 'DURAND', prenom: 'Léa', mailChorus: m }); localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); }, MAILS.C);
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(2000);
        await p.evaluate(() => { JUMELAGE_FERMER_COMPTE(); document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM,.JUM-CHOIX').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
        return p;
    }
    async function roles(p, cases) {
        await p.evaluate(() => JUMELAGE_REGLAGES({ vue: 'roles' })); await attendre(500);
        for (const [id, champ, code, fonction] of cases) {
            await p.check('#JUM-R-' + id); await attendre(150);
            if (fonction) await p.fill('#JUM-R-' + fonction[0], fonction[1]);
            await p.fill('#JUM-R-' + champ, code);
        }
        await p.click('.JUM-R-PRINCIPAL'); await attendre(4500);
    }
    const relever = async p => { await p.evaluate(() => JUMELAGE_RELEVER()); await attendre(2500); };
    const titreMsg = p => p.evaluate(() => (document.getElementById('MSG-TITRE') || {}).textContent || '');
    const fermer = p => p.evaluate(() => { try { FERMER_MSG(); } catch (e) {} try { FERMER_MODALE(); } catch (e) {} });
    const suivi = async (p, ref) => { await attendre(1200); const s = await p.evaluate(() => JUMELAGE_SUIVI_ACTUALISER()); return s[ref] || null; };

    const m = await appareil('M'), v1 = await appareil('V1'), v2 = await appareil('V2'), c = await appareil('C');
    await roles(v1, [['VAL1', 'CODEVAL1', code1, ['FONCTION1', 'Chef de service']]]);
    await roles(v2, [['VAL2', 'CODEVAL2', code2, ['FONCTION2', 'Chef de corps']]]);
    await roles(c, [['CHORUS', 'CODECHORUS', codeC]]);
    await v1.evaluate(v => SET_MAIL_VALIDEUR('mailValideur2', v), MAILS.V2);
    await v2.evaluate(v => SET_MAIL_VALIDEUR('mailChorus', v), MAILS.C);
    verifier(await v1.evaluate(() => !!JSON.parse(localStorage.getItem('trigone_roles_locaux') || '{}').valideur1) && await c.evaluate(() => JUMELAGE_ROLE_CHORUS()),
        'mise en place : missionnaire, VALIDEUR 1, VALIDEUR 2 et ASSIST CHORUS DT, chacun avec son compte et son rôle');

    // ---------- Saisie d'une demande dans le vrai formulaire, puis envoi depuis Documents ----------
    let numero = 0;
    async function saisir(sc) {
        numero++;
        const manques = await m.evaluate(([sc, n]) => {
            NOUVELLE_DEMANDE(); D.objet = sc.objet;
            D.personnes = sc.personnes.map((p, i) => Object.assign(VIDE_PERSONNE(), { unite: '4°RIISC', cie: '4CIE', matricule: '067 50 10 ' + String(100 + n * 10 + i) }, p));
            Object.assign(D.trajets.aller, { residenceDep: 'ADMINISTRATIVE' }, sc.aller);
            SYNCHRO_RETOUR(); Object.assign(D.trajets.retour, sc.retour);
            if (sc.interAller) { D.trajets.intermediaireAllerActif = true; Object.assign(D.trajets.intermediaireAller, sc.interAller); }
            Object.assign(D, sc.autres || {});
            D.codeFD = 'FDYDDR4FCT';
            MER_ACTIVE_TAB = 'IMPUTATION'; RENDER_FORMULAIRE_INPLACE();
            return MER_TABS_ORDRE.reduce((l, t) => l.concat(MANQUES_ONGLET(t).map(x => x.libelle)), []);
        }, [sc, numero]);
        if (!manques.length) { await m.setInputFiles('input[type=file][onchange="AJOUTER_PJ(this)"]', [path.join(FICHIERS, 'nds_test.pdf')]); await attendre(1000); }
        return manques;
    }
    async function envoyerDocuments(dest) {
        await m.evaluate(() => { AJOUTER_AU_PANIER(); }); await attendre(500); await fermer(m);
        await m.evaluate(() => { MER_DOSSIER.PANIER = null; SHOW_PAGE('PANIER'); }); await attendre(300);
        await m.fill('#MER-MAIL-DEST', dest);
        await m.click('text=Envoyer mes documents'); await attendre(500); await m.click('#MER-BTN-DIRECT'); await attendre(3000);
        const t = await titreMsg(m); await fermer(m); return t;
    }
    // Valideur : relève, « Tout ouvrir et signer », décision, transmission.
    async function decider(p, niveau, decision) {
        await relever(p);
        await p.evaluate(n => { const x = JUMELAGE_BOITE_LISTE().filter(e => (e.nature === 'niveau' + n || e.nature === 'renvoi') && e.statut !== 'traite'); if (x.length) OUVRIR_RECU(x[0].id); }, niveau);
        await attendre(4000); await fermer(p);
        const ids = await p.evaluate(() => GET_A_VALIDER().filter(e => !e.decision).map(e => e.id));
        if (!ids.length) return { ok: false, ids };
        if (decision.valider) await p.evaluate(ids => VALIDER_DEMANDES(ids), ids);
        else {
            await p.evaluate(id => DEMANDER_REFUS(id), ids[0]); await attendre(500);
            if (decision.vers) await p.check('input[name="MER-RENVOI"][value="' + decision.vers + '"]');
            await p.fill('#MER-MOTIF-REFUS', decision.motif);
            await p.click('#MER-MODALE-FOND button:has-text("' + (niveau === 2 ? 'Renvoyer' : 'Refuser') + '")');
        }
        await attendre(1500);
        await p.evaluate(() => PREPARER_TRANSMISSION()); await attendre(600);
        const n = await p.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').count();
        for (let i = 0; i < n; i++) { await p.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').first().click(); await attendre(3000); }
        const arrives = await p.locator('#MER-MODALE-FOND >> text=Arrivé dans le TRIGONE').count();
        await p.click('#MER-MODALE-FOND button:has-text("Terminé")').catch(() => {}); await attendre(600);
        return { ok: n > 0 && arrives === n, ids };
    }
    // Assistant Chorus DT : contrôle des signatures et PDF final (demande signée + NDS).
    async function chorusPdf() {
        await relever(c);
        return c.evaluate(async () => {
            const x = JUMELAGE_BOITE_LISTE().filter(e => e.nature === 'chorus' && e.statut !== 'traite')[0];
            if (!x) return { ok: false, raison: 'rien reçu' };
            let octets = null; window.TELECHARGER_OCTETS = (n, o) => { octets = o; };
            CHORUS_PDF_RECU(x.id);
            for (let i = 0; i < 60 && !octets; i++) { await new Promise(r => setTimeout(r, 200)); if (/conforme/.test((document.getElementById('MSG-TEXTE') || {}).textContent || '')) break; }
            if (!octets) return { ok: false, raison: (document.getElementById('MSG-TEXTE') || {}).textContent };
            await CHARGER_PDFLIB(); const doc = await PDFLib.PDFDocument.load(octets);
            return { ok: true, pages: doc.getPageCount(), traite: JUMELAGE_BOITE_LISTE().find(e => e.id === x.id).statut === 'traite' };
        });
    }
    const refDerniere = () => m.evaluate(() => { const l = GET_BIBLIOTHEQUE(); const d = l[l.length - 1] || l[0]; return ((d && d.demandes) || [])[0].id; });
    async function circuitComplet(sc, cap) {
        const manques = await saisir(sc);
        verifier(!manques.length, cap + ' : formulaire complet, chaque onglet validé' + (manques.length ? ' — manque : ' + manques.join(', ') : ''));
        if (manques.length) return;
        verifier(/envoyée/i.test(await envoyerDocuments(MAILS.V1)), cap + ' : envoyée au VALIDEUR 1');
        const ref = await m.evaluate(() => { const l = GET_BIBLIOTHEQUE().slice().sort((a, b) => String(b.envoyeLe).localeCompare(String(a.envoyeLe))); return l[0].demandes[0].id; });
        const d1 = await decider(v1, 1, { valider: true });
        verifier(d1.ok, cap + ' : VALIDEUR 1 la reçoit, la signe et la transmet');
        const d2 = await decider(v2, 2, { valider: true });
        verifier(d2.ok, cap + ' : VALIDEUR 2 la reçoit, la signe et la transmet à l\'assistant Chorus DT');
        const pdf = await chorusPdf();
        verifier(pdf.ok && pdf.pages >= 1 + (sc.personnes.length > 0 ? 1 : 0) && pdf.traite, cap + ' : assistant Chorus DT — signatures conformes, PDF final (demande + NDS : ' + (pdf.pages || 0) + ' pages)' + (pdf.ok ? '' : ' — ' + pdf.raison));
        const s = await suivi(m, ref);
        verifier(s && s.etape === 'traite', cap + ' : suivi du missionnaire « prise en charge par l\'assistant Chorus DT »');
    }

    const A = (moyen, dep, cpDep, arr, cpArr, extra) => Object.assign({ moyen, lieuDep: dep, cpDep, lieuArr: arr, cpArr, dateDep: '2026-11-03T07:30', dateArr: '2026-11-03T10:15' }, extra || {});
    const R = { dateDep: '2026-11-06T16:00', dateArr: '2026-11-06T19:00' };
    const P = (nom, prenom, grade) => ({ nom, prenom, grade: grade || 'SGT' });

    console.log('  — Demandes de mise en route, circuit complet —');
    await circuitComplet({ objet: 'STAGE SSIAP', personnes: [P('DURAND', 'Léa')], aller: A('FERREE', 'BORDEAUX', '33000', 'PARIS', '75012'), retour: R }, 'Individuel · métropole · train');
    await circuitComplet({ objet: 'SALON SECURITE', personnes: [P('DURAND', 'Léa')], aller: A('AERIENNE', 'BORDEAUX', '33000', 'BERLIN', '', { paysArr: 'ALLEMAGNE' }), retour: R }, 'Individuel · étranger (Allemagne) · avion');
    await circuitComplet({ objet: 'FORMATION FDF', personnes: [P('DURAND', 'Léa'), P('MARTIN', 'Paul', 'CPL'), P('PETIT', 'Inès', 'CCH')], aller: A('CIVILE', 'LIBOURNE', '33500', 'NANTES', '44000'), retour: R }, 'Collectif (3 personnes) · métropole · véhicule personnel');
    await circuitComplet({ objet: 'EXERCICE EU', personnes: [P('DURAND', 'Léa'), P('MARTIN', 'Paul', 'CPL')], aller: A('AERIENNE', 'MERIGNAC', '33700', 'MADRID', '', { paysArr: 'ESPAGNE' }), retour: R }, 'Collectif (2 personnes) · étranger (Espagne) · avion');
    await circuitComplet({ objet: 'REUNION', personnes: [P('DURAND', 'Léa')], aller: A('SERVICE', 'BORDEAUX', '33000', 'POITIERS', '86000'), retour: R }, 'Individuel · métropole · véhicule de service');
    await circuitComplet({ objet: 'MISSION CORSE', personnes: [P('DURAND', 'Léa')], aller: A('MARITIME', 'MARSEILLE', '13002', 'AJACCIO', '20000'), retour: R }, 'Individuel · métropole · bateau');
    await circuitComplet({ objet: 'COLLOQUE', personnes: [P('DURAND', 'Léa')], aller: A('AERIENNE', 'MERIGNAC', '33700', 'LYON', '69000'),
        interAller: A('FERREE', 'LIBOURNE', '33500', 'MERIGNAC', '33700', { dateDep: '2026-11-03T05:30', dateArr: '2026-11-03T06:30' }), retour: R,
        autres: { demandeAvance: true, resaHeberg: true, resaTransport: true } }, 'Individuel · avion + train jusqu\'à l\'aéroport · avance et réservations');

    console.log('  — Refus, renvoi, question —');
    {   // Refus du VALIDEUR 1 → correction par le missionnaire → renvoi → validée jusqu'au bout.
        await saisir({ objet: 'STAGE A CORRIGER', personnes: [P('DURAND', 'Léa')], aller: A('FERREE', 'BORDEAUX', '33000', 'PARIS', '75012'), retour: R });
        await envoyerDocuments(MAILS.V1);
        verifier((await decider(v1, 1, { motif: 'Joindre la DAF signée' })).ok, 'Refus VALIDEUR 1 : refus motivé renvoyé au missionnaire');
        await relever(m);
        await m.evaluate(() => { const x = JUMELAGE_BOITE_LISTE().find(e => e.nature === 'refus' && e.statut !== 'traite'); OUVRIR_RECU(x.id); }); await attendre(2500); await fermer(m);
        const refusee = await m.evaluate(() => GET_PANIER().find(d => d.refus && d.refus.motif === 'Joindre la DAF signée'));
        verifier(!!refusee, 'Refus VALIDEUR 1 : la demande revient dans Documents avec le motif');
        await m.evaluate(id => MODIFIER_DEMANDE_OK(id), refusee.id); await attendre(500); await fermer(m);
        await m.evaluate(() => { D.objet = 'STAGE CORRIGE'; });
        verifier(/envoyée/i.test(await envoyerDocuments(MAILS.V1)), 'Refus VALIDEUR 1 : demande corrigée et renvoyée');
        verifier((await decider(v1, 1, { valider: true })).ok && (await decider(v2, 2, { valider: true })).ok, 'Refus VALIDEUR 1 : la version corrigée est validée aux deux niveaux');
        const pdf = await chorusPdf();
        verifier(pdf.ok, 'Refus VALIDEUR 1 : l\'assistant Chorus DT reçoit la version corrigée, conforme');
    }
    {   // Renvoi du VALIDEUR 2 directement au demandeur.
        await saisir({ objet: 'STAGE RENVOI V2', personnes: [P('DURAND', 'Léa')], aller: A('FERREE', 'BORDEAUX', '33000', 'TOURS', '37000'), retour: R });
        await envoyerDocuments(MAILS.V1);
        await decider(v1, 1, { valider: true });
        verifier((await decider(v2, 2, { motif: 'Dates à revoir', vers: 'DEMANDEUR' })).ok, 'Renvoi VALIDEUR 2 → demandeur : envoyé');
        await relever(m);
        verifier(await m.evaluate(() => JUMELAGE_BOITE_LISTE().some(e => e.nature === 'refus' && e.statut !== 'traite')), 'Renvoi VALIDEUR 2 → demandeur : le missionnaire le reçoit directement');
        await m.evaluate(() => { const x = JUMELAGE_BOITE_LISTE().find(e => e.nature === 'refus' && e.statut !== 'traite'); OUVRIR_RECU(x.id); }); await attendre(2500); await fermer(m);
        verifier(await m.evaluate(() => GET_PANIER().some(d => d.refus && d.refus.motif === 'Dates à revoir')), 'Renvoi VALIDEUR 2 → demandeur : de retour dans Documents avec le motif');
    }
    {   // Renvoi du VALIDEUR 2 au VALIDEUR 1, qui refuse à son tour au demandeur.
        await m.evaluate(() => SAVE_PANIER([]));
        await saisir({ objet: 'STAGE RENVOI V1', personnes: [P('DURAND', 'Léa')], aller: A('FERREE', 'BORDEAUX', '33000', 'LILLE', '59000'), retour: R });
        await envoyerDocuments(MAILS.V1);
        await decider(v1, 1, { valider: true });
        verifier((await decider(v2, 2, { motif: 'Préciser le lieu', vers: 'V1' })).ok, 'Renvoi VALIDEUR 2 → VALIDEUR 1 : envoyé');
        await relever(v1);
        verifier(await v1.evaluate(() => JUMELAGE_BOITE_LISTE().some(e => e.nature === 'renvoi' && e.statut !== 'traite')), 'Renvoi VALIDEUR 2 → VALIDEUR 1 : reçu « Renvoyée par le VALIDEUR 2 »');
        verifier((await decider(v1, 1, { motif: 'Préciser le lieu exact du stage' })).ok, 'Renvoi VALIDEUR 2 → VALIDEUR 1 : le VALIDEUR 1 refuse au demandeur');
        await relever(m);
        verifier(await m.evaluate(() => JUMELAGE_BOITE_LISTE().some(e => e.nature === 'refus' && e.statut !== 'traite')), 'Renvoi VALIDEUR 2 → VALIDEUR 1 → demandeur : le missionnaire reçoit le refus');
    }
    {   // Question du VALIDEUR 1, réponse du missionnaire, puis validation.
        await m.evaluate(() => SAVE_PANIER([]));
        await saisir({ objet: 'STAGE QUESTION', personnes: [P('DURAND', 'Léa')], aller: A('CIVILE', 'LIBOURNE', '33500', 'BORDEAUX', '33000'), retour: R });
        await envoyerDocuments(MAILS.V1);
        await relever(v1);
        await v1.evaluate(() => { const x = JUMELAGE_BOITE_LISTE().find(e => e.nature === 'niveau1' && e.statut !== 'traite'); OUVRIR_RECU(x.id); }); await attendre(4000); await fermer(v1);
        await v1.locator('button[onclick^="POSER_QUESTION"]').first().click(); await attendre(400);
        await v1.fill('#MER-QUESTION-TXT', 'Pourquoi pas le train ?'); await v1.click('#MER-QUESTION-GO'); await attendre(2500); await fermer(v1);
        await relever(m);
        const q = await m.evaluate(() => JUMELAGE_BOITE_LISTE().find(e => e.nature === 'question' && e.statut !== 'traite'));
        verifier(!!q && /Pourquoi pas le train/.test(q.question || ''), 'Question : le missionnaire reçoit la question du VALIDEUR 1');
        await m.evaluate(id => REPONDRE_QUESTION(id), q.id); await attendre(400);
        await m.fill('#MER-REPONSE-TXT', 'Aucun train avant 9 h.'); await m.click('#MER-REPONSE-GO'); await attendre(2500); await fermer(m);
        await relever(v1); await v1.evaluate(() => SHOW_PAGE('VALIDATION')); await attendre(1200);
        verifier(/Aucun train avant 9 h/.test(await v1.evaluate(() => document.body.innerText)), 'Question : la réponse s\'affiche sous la demande, chez le VALIDEUR 1');
        const ids = await v1.evaluate(() => GET_A_VALIDER().filter(e => !e.decision).map(e => e.id));
        await v1.evaluate(ids => VALIDER_DEMANDES(ids), ids); await attendre(1500);
        await v1.evaluate(() => PREPARER_TRANSMISSION()); await attendre(600);
        await v1.locator('#MER-MODALE-FOND .MER-PANIER-ITEM button:has-text("Envoyer")').first().click(); await attendre(3000);
        verifier(await v1.locator('#MER-MODALE-FOND >> text=Arrivé dans le TRIGONE').count() === 1, 'Question : après la réponse, la demande est validée et transmise');
        await v1.click('#MER-MODALE-FOND button:has-text("Terminé")').catch(() => {}); await attendre(500);
        await decider(v2, 2, { valider: true }); await chorusPdf();
    }

    console.log('  — Erreurs de saisie et d\'envoi —');
    {
        await m.evaluate(() => SAVE_PANIER([]));
        const manques = await saisir({ objet: '', personnes: [{ nom: '', prenom: '', grade: '' }], aller: { moyen: 'FERREE' }, retour: {} });
        verifier(manques.includes('Objet') && manques.some(x => /Nom/.test(x)) && manques.some(x => /date et heure de départ/.test(x)), 'Demande incomplète : les champs manquants sont listés (' + manques.length + '), passage à l\'étape suivante impossible');
        await m.evaluate(() => AJOUTER_AU_PANIER()); await attendre(400);
        verifier(/Identité incomplète/.test(await titreMsg(m)) && await m.evaluate(() => GET_PANIER().length === 0), 'Demande incomplète : « Ajouter aux documents » refusé (« Identité incomplète »)');
        await fermer(m);
        await saisir({ objet: 'TEST', personnes: [{ nom: 'DURAND', prenom: 'Léa', grade: 'SGT', matricule: '12345' }], aller: A('FERREE', 'BORDEAUX', '33000', 'PARIS', '75012'), retour: R });
        await m.evaluate(() => { D.personnes[0].matricule = '12345'; AJOUTER_AU_PANIER(); }); await attendre(400);
        verifier(/Matricule incorrect/.test(await titreMsg(m)), 'Matricule à moins de 10 chiffres : refusé (« Matricule incorrect »)');
        await fermer(m);
        const m2 = await saisir({ objet: 'TEST', personnes: [P('DURAND', 'Léa')], aller: A('FERREE', 'BORDEAUX', '33000', 'PARIS', '75012', { dateDep: '2026-11-03T12:00', dateArr: '2026-11-03T09:00' }), retour: R });
        verifier(m2.some(x => /arrivée est avant le départ/.test(x)), 'Arrivée avant le départ : signalée');
        await saisir({ objet: 'TEST ERREURS', personnes: [P('DURAND', 'Léa')], aller: A('FERREE', 'BORDEAUX', '33000', 'PARIS', '75012'), retour: R });
        verifier(/Pas encore de compte TRIGONE/.test(await envoyerDocuments('inconnu.' + sfx + '@interieur.gouv.fr')) && await m.evaluate(() => GET_PANIER().length === 1),
            'Destinataire sans compte TRIGONE : envoi bloqué, la demande reste dans Documents');
        verifier(/Mauvais destinataire/.test(await envoyerDocuments(MAILS.V2)), 'Envoi direct au VALIDEUR 2 : refusé (« Mauvais destinataire »)');
        verifier(/Mauvais destinataire/.test(await envoyerDocuments(MAILS.C)), 'Envoi direct à l\'assistant Chorus DT : refusé (« Mauvais destinataire »)');
        // Sans réseau : l'envoi attend, puis part tout seul au retour du réseau.
        await m.context().setOffline(true);
        const t = await envoyerDocuments(MAILS.V1);
        verifier(/attente|réseau/i.test(t) && await m.evaluate(() => GET_PANIER().length === 0), 'Sans réseau : la demande part dans la boîte d\'envoi (« ' + t + ' »)');
        await m.context().setOffline(false); await m.evaluate(() => window.dispatchEvent(new Event('online'))); await attendre(5000);
        await relever(v1);
        verifier(await v1.evaluate(() => JUMELAGE_BOITE_LISTE().some(e => e.nature === 'niveau1' && e.statut !== 'traite')), 'Retour du réseau : la demande en attente arrive chez le VALIDEUR 1');
        await decider(v1, 1, { motif: 'Test' });
    }

    console.log('  — Comptes-rendus de mission —');
    const f = d => d.toLocaleString('FR-FR').toUpperCase();
    async function compteRendu(cap, prep, attendus) {
        // Mission précédente close (comme « Fermer la mission ») : chaque compte-rendu repart d'une mission vierge.
        await m.goto(URL + 'cr/'); await attendre(3000);
        if (await m.evaluate(() => !!(M.MAIL_SENT || M.DEBUT))) { await m.evaluate(() => FERMER_LA_MISSION()); await attendre(3500); }
        await m.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
        await m.evaluate(prep.fn, prep.arg); await attendre(800); await fermer(m);
        const etat = await m.evaluate(() => ({ user: M.USER, libelle: M.LIBELLE_MISSION, ta: M.T_A, ga: M.G_A, etr: M.MISSION_ETRANGER, pays: M.PAYS_MISSION, lieuDep: M.LIEU_DEP, coll: !!M.COLLECTIVE, nbPax: (M.PARTICIPANTS || []).length }));
        if (attendus) verifier(Object.keys(attendus).every(k => etat[k] === attendus[k]), cap + ' : mission pré-remplie (' + Object.keys(attendus).map(k => etat[k]).join(' · ') + ')');
        const n = Date.now();
        const res = await m.evaluate(async ([t, mailC]) => {
            Object.assign(M, { DEBUT: t[0], ARR_SITE: t[1], DEP_SITE: t[2], FIN_RETOUR_HORODATE: t[3], FIN_HORODATAGE: t[3] });
            SYNC_AUTO_JOURS();
            // Frais déclarés comme à l'écran : 2 repas de midi et 2 du soir payants, nuits payantes (sauf la dernière).
            M.PAYANT_MIDI = 2; M.PAYANT_SOIR = 2; (M.JOURS || []).forEach((J, i, l) => { J.L = i < l.length - 1 ? 'PAYANT' : 'NEANT'; });
            SAVE_STATE(); SHOW_PAGE('P2-FIN'); RENDER();
            const forfait = CALC_FORFAIT_ELIGIBLE_TOTAL();
            window.MAIL_ASSIST = mailC; MAIL_ASSIST = mailC;
            window.ALL_PJ_RESOLVED = () => true; M.SIGNED = true; CONTROLE_ENVOI_VU = true;
            ENVOYER_MAIL();
            return { forfait, jours: (M.JOURS || []).length };
        }, [[f(new Date(n - 74 * 3600e3)), f(new Date(n - 71 * 3600e3)), f(new Date(n - 5 * 3600e3)), f(new Date(n - 2 * 3600e3))], MAILS.C]);
        await attendre(1500);
        if (!(await m.$('#JUM-CR-FICHIERS'))) console.log('    [diag] fenêtre d\'envoi absente — message : « ' + await titreMsg(m) + ' » ' + await m.evaluate(() => ((document.getElementById('MSG-TEXTE') || {}).textContent || '').slice(0, 300)) + ' | dialogues : ' + DIALOGUES.join(' / ') + ' | MAIL_SENT=' + await m.evaluate(() => M.MAIL_SENT));
        verifier(res.jours >= 3 && res.forfait > 0, cap + ' : jours créés (' + res.jours + '), forfait calculé (' + res.forfait + ' €)');
        await m.setInputFiles('#JUM-CR-FICHIERS', path.join(FICHIERS, 'facture-photo.jpg')); await attendre(2500);
        await m.click('#JUM-CR-ENVOYER'); await attendre(5000); await fermer(m);
        verifier(await m.evaluate(() => M.MAIL_SENT === true || !!localStorage.getItem('mission_data') === false || GET_BIBLIOTHEQUE().length > 0), cap + ' : compte-rendu envoyé et archivé dans la Bibliothèque');
        await relever(c);
        const recu = await c.evaluate(async () => {
            const x = JUMELAGE_BOITE_LISTE().filter(e => e.nature === 'cr' && e.statut !== 'traite').pop();
            if (!x) return null;
            const cr = JSON.parse(await (await JUMELAGE_BOITE_FICHIER(x.id)).text());
            const octets = await MER_CR_PDF_UNIQUE(cr); await CHARGER_PDFLIB();
            const pages = (await PDFLib.PDFDocument.load(octets)).getPageCount();
            JUMELAGE_BOITE_MARQUER(x.id, 'traite');
            return { fichiers: cr.fichiers.length, pages, libelle: cr.libelle };
        });
        verifier(!!recu && recu.fichiers === 2 && recu.pages >= 2, cap + ' : l\'assistant Chorus DT le reçoit (PDF + justificatif scanné), PDF complet de ' + (recu ? recu.pages : 0) + ' pages');
    }
    await compteRendu('CR sans mise en route · métropole · train', { fn: () => {
        Object.assign(M, { USER: 'DURAND Léa', GRADE: 'SGT', NID: '0675010191', CIE: '4CIE', LIBELLE_MISSION: 'STAGE PARIS', LIEU_DEP: 'GARNISON', LIEU_RET: 'GARNISON', T_A: 'VF', T_R: 'VF', G_A: 'PARIS (75012)', G_A_ARR: 'PARIS (75012)', G_A_DEP: 'BORDEAUX (33000)', MISSION_ETRANGER: false, PAYS_MISSION: '' });
        SAVE_STATE(); }, arg: null });
    await compteRendu('CR à partir de la mise en route · métropole · train', { fn: () => {
        const x = LIRE_MISES_EN_ROUTE().find(e => e.d.objet === 'STAGE SSIAP'); APPLIQUER_MISE_EN_ROUTE(x.d); }, arg: null },
        { libelle: 'STAGE SSIAP', ta: 'VF', lieuDep: 'GARNISON', etr: false });
    await compteRendu('CR à partir de la mise en route · étranger (Allemagne) · avion', { fn: () => {
        const x = LIRE_MISES_EN_ROUTE().find(e => e.d.objet === 'SALON SECURITE'); APPLIQUER_MISE_EN_ROUTE(x.d); }, arg: null },
        { libelle: 'SALON SECURITE', ta: 'AVION', etr: true, pays: 'ALLEMAGNE' });
    await compteRendu('CR à partir de la mise en route · collectif · véhicule personnel', { fn: () => {
        const x = LIRE_MISES_EN_ROUTE().find(e => e.d.objet === 'FORMATION FDF'); APPLIQUER_MISE_EN_ROUTE(x.d); }, arg: null },
        { libelle: 'FORMATION FDF', ta: 'VRC', coll: true, nbPax: 2 });
    {   // Compte-rendu envoyé à un valideur : refusé par sa boîte.
        await m.goto(URL + 'cr/'); await attendre(2500);
        await m.evaluate(d => JUMELAGE_ENVOYER_CR({ destinataire: d, missionnaire: 'SGT DURAND Léa', libelle: 'TEST', dates: '', corps: '', pieces: [],
            pdf: () => ({ nom: 'CR.pdf', blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) }), succes: () => {} }), MAILS.V1); await attendre(400);
        await m.click('#JUM-CR-ENVOYER'); await attendre(3000);
        verifier(/assistant Chorus DT/.test(await m.textContent('#JUM-CR-ERR')), 'CR envoyé à un VALIDEUR : refusé (réservé à l\'assistant Chorus DT)');
        await m.evaluate(() => JUMELAGE_FERMER_ENVOI_CR());
    }

    verifier(!erreurs.length, 'aucune erreur JavaScript sur les 4 appareils' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
    await b.close();
};
