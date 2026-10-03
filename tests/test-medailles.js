// Médailles du Compte-rendu : Paramètres › Compte-rendu › Mes médailles, recomptage depuis la Bibliothèque, remise à zéro.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), erreurs = [];
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => {
        sessionStorage.setItem('trigone_choix_fait', '1');
        const bib = []; for (let i = 0; i < 12; i++) bib.push({ debut: '0' + (i % 9 + 1) + '/0' + (i < 9 ? 1 : 2) + '/2026 08:00', user: 'ADJ FICTIF Jean', role: 'chef', recap: 'x' });
        localStorage.setItem('mission_bibliotheque', JSON.stringify(bib));
        localStorage.setItem('trigone_cr_envoyes_total', '3'); localStorage.setItem('trigone_medailles_obtenues', '["BRONZE"]');
    });
    await p.goto(srv.url + 'cr/'); await attendre(3000);
    const ligne = await p.evaluate(() => (window.JUMELAGE_MENU_APPLI() || []).some(x => x.titre === 'Mes médailles'));
    verifier(ligne, 'Paramètres › Compte-rendu : ligne « Mes médailles »');
    await p.evaluate(() => GERER_MEDAILLES()); await attendre(600);
    const t1 = await p.evaluate(() => document.getElementById('MSG-TEXTE').textContent);
    verifier(/Bronze/.test(t1) && /3 comptes-rendus/.test(t1) && /contient 12/.test(t1), 'Mes médailles : Bronze, 3 envois, 12 dans la Bibliothèque');
    await p.click('#MSG-BOUTONS button:nth-child(1)'); await attendre(900);
    await p.click('#MSG-BOUTONS button.BTN-START'); await attendre(900);
    const apres = await p.evaluate(() => [localStorage.getItem('trigone_cr_envoyes_total'), localStorage.getItem('trigone_medailles_obtenues'), document.getElementById('MSG-TEXTE').textContent]);
    verifier(apres[0] === '12' && /ARGENT/.test(apres[1]) && !/OR"/.test(apres[1]) && /Argent/.test(apres[2]), 'Recompter : compteur 12, TRIGONE d\'Argent');
    await p.evaluate(() => { FERMER_MSG(); }); await attendre(400);
    await p.evaluate(() => GERER_MEDAILLES()); await attendre(600);
    await p.click('#MSG-BOUTONS button:nth-child(2)'); await attendre(900);
    await p.click('#MSG-BOUTONS button.BTN-START'); await attendre(900);
    verifier(await p.evaluate(() => !localStorage.getItem('trigone_cr_envoyes_total') && !localStorage.getItem('trigone_medailles_obtenues')), 'Repartir à zéro : compteur et médailles effacés');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
