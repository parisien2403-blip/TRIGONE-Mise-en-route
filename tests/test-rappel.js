// Rappel « départ en mission » : à l'envoi d'une demande, le téléphone confie au serveur la seule heure du rappel
// (7 h le jour du départ, ou 1 h avant un départ plus matinal) ; le serveur envoie la notification à l'heure, une fois ;
// la toucher ouvre Compte-rendu, prérempli depuis la mise en route. Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36);
    const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
    p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(URL); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.reload(); await attendre(2500);
    await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
    await p.fill('#JUM-C-MAIL', 'depart.' + suffixe + '@interieur.gouv.fr'); await p.click('#JUM-C-ENVOI'); await attendre(1500);
    await p.click('#JUM-C-VALIDER'); await attendre(1500);
    await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
    // Heure du rappel.
    const h = await p.evaluate(() => {
        const iso = (j, hh, mm) => { const d = new Date(); d.setDate(d.getDate() + j); d.setHours(hh, mm, 0, 0); const z = n => String(n).padStart(2, '0');
            return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(hh) + ':' + z(mm); };
        const q = v => MER_HEURE_RAPPEL({ trajets: { aller: { dateDep: v } } });
        const demain9 = q(iso(1, 9, 0)), demain530 = q(iso(1, 5, 30));
        const dans10 = new Date(Date.now() + 10 * 60000), z = n => String(n).padStart(2, '0');
        const v10 = dans10.getFullYear() + '-' + z(dans10.getMonth() + 1) + '-' + z(dans10.getDate()) + 'T' + z(dans10.getHours()) + ':' + z(dans10.getMinutes());
        return { neuf: new Date(demain9).getHours() + ':' + new Date(demain9).getMinutes(), cinq: new Date(demain530).getHours() + ':' + new Date(demain530).getMinutes(),
            proche: q(v10), sans: q('') };
    });
    verifier(h.neuf === '7:0' && h.cinq === '4:30' && h.proche === 0 && h.sans === 0,
        'heure du rappel : 7 h le jour du départ, 1 h avant un départ plus matinal, aucun si le départ est imminent ou sans date');
    // Enregistrement au serveur, puis envoi à l'échéance (une seule fois).
    const ref = 'rappel-' + suffixe;
    const decalage = await p.evaluate(async r => {
        const d = new Date(); d.setDate(d.getDate() + 1); const z = n => String(n).padStart(2, '0');
        const dem = { id: r, trajets: { aller: { dateDep: d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T09:00' } } };
        MER_PROGRAMMER_RAPPELS([dem]); await new Promise(ok => setTimeout(ok, 1500));
        return MER_HEURE_RAPPEL(dem) - Date.now() + 60000;
    }, ref);
    const tester = d => p.evaluate(async d => { const x = JSON.parse(localStorage.getItem('trigone_compte'));
        return (await (await fetch('api/test/rappels', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'TRIGONE ' + encodeURIComponent(x.mail) + ' ' + x.appareil + ' ' + x.jeton },
            body: JSON.stringify({ decalage: d }) })).json()).n; }, d);
    verifier(await tester(0) === 0, 'serveur : pas de rappel avant l\'heure');
    verifier(await tester(decalage) >= 1, 'serveur : rappel envoyé le jour du départ');
    verifier(await tester(decalage) === 0, 'serveur : rappel envoyé une seule fois');
    // Notification touchée : Compte-rendu s'ouvre prérempli depuis la mise en route.
    await p.evaluate(r => localStorage.setItem('mer_bibliotheque', JSON.stringify([{ id: 'e1', envoyeLe: new Date().toISOString(), destinataire: 'chef@test.fr', demandes: [{
        id: r, objet: 'STAGE FDF', trajets: {
            aller: { moyen: 'FERREE', residenceDep: 'ADMINISTRATIVE', lieuDep: 'LIBOURNE', cpDep: '33500', lieuArr: 'NAINVILLE-LES-ROCHES', cpArr: '91750', dateDep: '2026-10-05T06:52', dateArr: '2026-10-05T11:28' },
            retour: { moyen: 'FERREE', residenceArr: 'ADMINISTRATIVE', lieuDep: 'NAINVILLE-LES-ROCHES', cpDep: '91750', lieuArr: 'LIBOURNE', cpArr: '33500', dateDep: '2026-10-09T15:04', dateArr: '2026-10-09T19:41' } },
        personnes: [{ grade: 'ADJ', nom: 'TEST', prenom: 'Essai', matricule: '067 50 10 191' }] }] }])), ref);
    await p.goto(URL + 'cr/?depart=' + ref); await attendre(4500);
    verifier(await p.evaluate(() => M.LIBELLE_MISSION === 'STAGE FDF' && M.PAGE === 'P1' && !location.search), 'notification touchée : compte-rendu prérempli depuis la mise en route');
    verifier(await p.evaluate(() => /Départ aujourd'hui/.test(document.body.innerText)), 'message « Départ aujourd\'hui : mission pré-remplie »');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
