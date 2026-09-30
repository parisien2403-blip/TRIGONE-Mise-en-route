// Boîte d'envoi : un envoi fait sans réseau est rangé sur l'appareil puis part tout seul au retour du réseau
// (la suite prévue est faite : liste mise à jour) ; le destinataire le reçoit. Agenda : fichier .ics de la mission.
// Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const MAILS = { A: 'expediteur.' + suffixe + '@interieur.gouv.fr', B: 'destinataire.' + suffixe + '@interieur.gouv.fr' };
    async function appareil(nom) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 }, acceptDownloads: true }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.fill('#JUM-C-MAIL', MAILS[nom]); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(2000);
        await p.evaluate(() => { JUMELAGE_FERMER_COMPTE(); document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); });
        return { p, ctx };
    }
    const dest = await appareil('B'), exp = await appareil('A');
    // Réseau coupé : l'envoi est mis en attente (et la liste locale le marque « attente »).
    await exp.ctx.setOffline(true); await attendre(300);
    const r = await exp.p.evaluate(m => {
        localStorage.setItem('liste_test', JSON.stringify([{ id: 'x1', attente: true }]));
        return JUMELAGE_ENVOYER_DIRECT(m, 'COLLECTIVE', 'Mission collective.json', JSON.stringify({ app: 'TRIGONE-COLLECTIVE', chef: 'ADJ TEST Essai', libelle: 'MISSION HORS LIGNE' }), { differable: true, libelle: 'Envoi de test',
            meta: { maj: [{ cle: 'liste_test', cherche: { id: 'x1' }, pose: { envoiId: '$id' }, retire: ['attente'] }] } });
    }, MAILS.B);
    verifier(r && r.differe === true, 'sans réseau : l\'envoi est mis en attente au lieu d\'échouer');
    verifier((await exp.p.evaluate(() => JUMELAGE_ENVOIS_ATTENTE())).length === 1, 'l\'envoi est rangé sur l\'appareil (1 en attente)');
    await exp.p.evaluate(() => JUMELAGE_PARAMETRES('donnees')); await attendre(500);
    verifier(!!(await exp.p.$('.JUM-PARAM [data-action="attente"]')), 'Paramètres › Données : « Envois en attente (1) »');
    await exp.p.evaluate(() => JUMELAGE_FERMER_PARAMETRES());
    // Pas d'envoi tant que le réseau manque, même en forçant.
    await exp.p.evaluate(() => JUMELAGE_VIDER_ATTENTE()); await attendre(800);
    verifier((await exp.p.evaluate(() => JUMELAGE_ENVOIS_ATTENTE())).length === 1, 'toujours sans réseau : l\'envoi attend');
    // Retour du réseau : il part tout seul.
    await exp.ctx.setOffline(false); await attendre(6000);
    verifier((await exp.p.evaluate(() => JUMELAGE_ENVOIS_ATTENTE())).length === 0, 'retour du réseau : l\'envoi part tout seul');
    const liste = await exp.p.evaluate(() => JSON.parse(localStorage.getItem('liste_test'))[0]);
    verifier(!liste.attente && /\S{6,}/.test(liste.envoiId || ''), 'une fois parti : la suite prévue est faite (« en attente » retiré, identifiant d\'envoi noté)');
    await dest.p.evaluate(() => JUMELAGE_RELEVER()); await attendre(3000);
    verifier(await dest.p.evaluate(() => JUMELAGE_BOITE_LISTE().some(x => x.type === 'COLLECTIVE' && x.objet === 'MISSION HORS LIGNE')), 'le destinataire le reçoit dans sa boîte TRIGONE');
    // Bibliothèque : une demande en attente est signalée.
    await exp.p.evaluate(() => { localStorage.setItem('mer_bibliotheque', JSON.stringify([{ id: 'e9', attente: true, envoyeLe: new Date().toISOString(), destinataire: 'chef@test.fr',
        demandes: [{ id: 'd9', type: 'MISSION', objet: 'STAGE FDF', personnes: [{ grade: 'ADJ', nom: 'Test', prenom: 'Essai' }],
            trajets: { aller: { moyen: 'FERREE', lieuDep: 'LIBOURNE', lieuArr: 'NAINVILLE-LES-ROCHES', dateDep: '2026-10-05T06:52', dateArr: '2026-10-05T11:28' },
                retour: { moyen: 'FERREE', lieuDep: 'NAINVILLE-LES-ROCHES', lieuArr: 'LIBOURNE', dateDep: '2026-10-09T15:04', dateArr: '2026-10-09T19:41' } } }] }])); MER_DOSSIER.BIBLIOTHEQUE = 'validation'; SHOW_PAGE('BIBLIOTHEQUE'); });
    await attendre(500);
    verifier(/En attente de réseau/.test(await exp.p.evaluate(() => document.body.innerText)), 'Bibliothèque : « En attente de réseau — partira toute seule »');
    // Agenda : fichier .ics.
    await exp.p.evaluate(() => MER_AGENDA('e9')); await attendre(300);
    const [dl] = await Promise.all([exp.p.waitForEvent('download'), exp.p.evaluate(() => MER_AGENDA_ICS())]);
    const ics = require('fs').readFileSync(await dl.path(), 'utf8');
    verifier(/BEGIN:VEVENT/.test(ics) && /DTSTART:20261005T065200/.test(ics) && /DTEND:20261009T194100/.test(ics) && /SUMMARY:Mission — STAGE FDF/.test(ics) && /TRIGGER:-P1D/.test(ics) && /NAINVILLE/.test(ics),
        'Agenda : fichier .ics (départ aller → arrivée retour, trajets, rappel la veille) — ' + dl.suggestedFilename());
    const lien = await exp.p.evaluate(() => { let u = ''; const o = window.open; window.open = x => { u = x; }; MER_AGENDA('e9'); MER_AGENDA_GOOGLE(); window.open = o; return u; });
    verifier(await exp.p.evaluate(() => MER_ICS_TEXTE('Stage; Paris, 2 jours') === 'Stage\\; Paris\\, 2 jours'), 'Agenda : « ; » et « , » échappés dans le fichier .ics');
    verifier(/calendar\.google\.com/.test(lien) && /dates=20261005T065200\/20261009T194100/.test(lien), 'Agenda : lien Google Agenda prérempli');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
