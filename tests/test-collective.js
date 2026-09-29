// Mise en route collective → compte-rendu de mission : « Mission collective » cochée d'office, le demandeur est
// chef de mission et toutes les autres personnes de la demande sont reprises comme participants.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => {
        const r = JSON.parse(localStorage.getItem('mer_reglages') || '{}');
        r.identite = Object.assign(r.identite || {}, { unite: '4°RIISC', cie: '2CIE', grade: 'SGT', nom: 'MICHEL', prenom: 'Julien', matricule: '067 12 34 567' });
        localStorage.setItem('mer_reglages', JSON.stringify(r)); sessionStorage.setItem('trigone_choix_fait', '1');
    });
    const trajets = {
        aller: { moyen: 'FERREE', residenceDep: 'GARNISON', lieuDep: 'LIBOURNE', cpDep: '33500', lieuArr: 'PARIS', cpArr: '75014', dateDep: '2026-10-05T06:52', dateArr: '2026-10-05T09:28' },
        retour: { moyen: 'FERREE', residenceArr: 'GARNISON', lieuDep: 'PARIS', cpDep: '75014', lieuArr: 'LIBOURNE', cpArr: '33500', dateDep: '2026-10-07T17:04', dateArr: '2026-10-07T19:41' }
    };
    const collective = { objet: 'FORMATION SSIAP', trajets, personnes: [
        { unite: '4°RIISC', cie: '2CIE', grade: 'SGT', nom: 'MICHEL', prenom: 'Julien', matricule: '067 12 34 567' },
        { unite: '4°RIISC', cie: '2CIE', grade: 'CPL', nom: 'LEROY', prenom: 'Emma', matricule: '067 98 76 543' },
        { unite: '4°RIISC', cie: '1CIE', grade: 'SAP', nom: 'BERNARD', prenom: 'Hugo', matricule: '067 55 44 333' }
    ] };
    await p.goto(srv.url + 'cr/'); await attendre(2500);
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
    await p.evaluate(dd => APPLIQUER_MISE_EN_ROUTE(dd), collective); await attendre(1200);
    verifier(await p.evaluate(() => M.COLLECTIVE === true && document.getElementById('IS-COLLECTIVE').checked && M.USER === 'MICHEL Julien'),
        'demande collective : « Mission collective » cochée d\'office, le demandeur est chef de mission');
    verifier(await p.evaluate(() => M.PARTICIPANTS.length === 2 && M.PARTICIPANTS[0].nom === 'LEROY' && M.PARTICIPANTS[0].nid === '06 798 765 43' && M.PARTICIPANTS[1].nom === 'BERNARD'),
        'les 2 autres missionnaires sont repris (grade, nom, prénom, NID, compagnie)');
    const zone = await p.evaluate(() => { const z = document.getElementById('MER-EQUIPE'); return z.classList.contains('HIDDEN') ? '' : z.textContent; });
    verifier(/Participants repris de la mise en route \(2\)/.test(zone) && zone.includes('CPL LEROY Emma') && zone.includes('SAP BERNARD Hugo'), 'identification : la liste des participants est affichée');
    verifier(await p.evaluate(() => !document.getElementById('CHEF-MAIL-ZONE').classList.contains('HIDDEN')), 'mail du chef de mission demandé (QR code participants)');
    const recap = await p.evaluate(() => BUILD_RECAP_CORE(false).R);
    verifier(/MISSION COLLECTIVE - CHEF DE MISSION/.test(recap) && /PARTICIPANTS \(2\)/.test(recap) && recap.includes('CPL LEROY Emma'), 'récapitulatif du compte-rendu : les participants y figurent');
    const pdf = await p.evaluate(async () => { const r = GENERER_PDF(0, true, 'blob'); if (!r || !r.blob) return ''; const t = new TextDecoder('latin1').decode(new Uint8Array(await r.blob.arrayBuffer())); return t; });
    verifier(pdf.includes('(Participants \\(2\\))') && pdf.includes('LEROY Emma') && pdf.includes('BERNARD Hugo'), 'PDF du compte-rendu : les participants figurent dans le bloc Identité');
    // Rechargement : tout est conservé.
    await p.reload(); await attendre(2500);
    verifier(await p.evaluate(() => M.COLLECTIVE === true && (M.PARTICIPANTS || []).length === 2), 'après rechargement : mission collective et participants conservés');
    // Une demande individuelle ne coche pas « collective ».
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix'); });
    await p.evaluate(dd => APPLIQUER_MISE_EN_ROUTE(dd), Object.assign({}, collective, { personnes: collective.personnes.slice(0, 1) })); await attendre(1200);
    verifier(await p.evaluate(() => M.COLLECTIVE === false && !document.getElementById('IS-COLLECTIVE').checked && !M.PARTICIPANTS.length && document.getElementById('MER-EQUIPE').classList.contains('HIDDEN')),
        'demande individuelle : mission non collective, pas de participants');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
