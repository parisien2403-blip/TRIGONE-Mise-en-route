// Bouton « retour » du téléphone : ferme la fenêtre du dessus ; une fenêtre ouverte depuis Paramètres y ramène.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), erreurs = [];
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.reload(); await attendre(2500);
    await p.evaluate(() => { const m = document.getElementById('MSG-OVERLAY'); if (m) m.style.display = 'none'; });
    const url = p.url();
    const etat = () => p.evaluate(() => ({ param: !!document.querySelector('.JUM-PARAM'), rub: (document.querySelector('.JUM-PARAM') || { getAttribute() {} }).getAttribute('data-rubrique'), profil: !!document.querySelector('.JUM-REGLAGES') }));
    // Paramètres › Données, puis Compte › Mon profil
    await p.evaluate(() => JUMELAGE_PARAMETRES('donnees')); await attendre(300);
    await p.click('.JUM-PARAM [data-rub="compte"]'); await attendre(200);
    await p.click('.JUM-PARAM [data-action="profil"]'); await attendre(500);
    let e = await etat();
    verifier(e.profil && !e.param, 'Paramètres › Mon profil : la fenêtre du profil s\'ouvre');
    p.goBack().catch(() => {}); await attendre(600);
    e = await etat();
    verifier(!e.profil && e.param && e.rub === 'compte', 'retour : Paramètres rouvert sur la rubrique « Compte »');
    p.goBack().catch(() => {}); await attendre(600);
    e = await etat();
    verifier(!e.param && p.url() === url, 'retour : Paramètres fermé, on reste dans TRIGONE');
    // Fermée par son bouton ✕ : l'étape est rendue (un retour suivant ne reste pas « bloqué » sur une étape vide).
    await p.evaluate(() => JUMELAGE_PARAMETRES()); await attendre(300);
    await p.click('.JUM-PARAM-FERMER'); await attendre(800);
    verifier(await p.evaluate(() => !(history.state && history.state.trigone)), 'fermée par ✕ : pas d\'étape d\'historique en trop');
    // Popup par-dessus une fenêtre : retour ferme seulement la popup.
    await p.evaluate(() => JUMELAGE_PARAMETRES('aide')); await attendre(300);
    await p.click('.JUM-PARAM [data-action="signaler"]'); await attendre(500);
    verifier(await p.evaluate(() => !!document.querySelector('.JUM-SIG')), 'Aide › Signaler un problème : fenêtre ouverte');
    p.goBack().catch(() => {}); await attendre(600);
    e = await etat();
    verifier(await p.evaluate(() => !document.querySelector('.JUM-SIG')) && e.param && e.rub === 'aide', 'retour : retour à Paramètres › Aide');
    // Flèche « ‹ Paramètres » à l'écran : fenêtre ouverte depuis Paramètres → retour sur la même rubrique.
    await p.evaluate(() => { document.querySelectorAll('.JUM-SIG').forEach(e => e._fermer ? e._fermer() : e.remove()); JUMELAGE_FERMER_PARAMETRES(); JUMELAGE_PARAMETRES('compte'); }); await attendre(400);
    await p.click('.JUM-PARAM [data-action="profil"]'); await attendre(700);
    verifier(await p.evaluate(() => !!document.querySelector('.JUM-REGLAGES .JUM-RETOUR-PARAM')), 'Paramètres › Mon profil : flèche « ‹ Paramètres » affichée');
    await p.click('.JUM-REGLAGES .JUM-RETOUR-PARAM'); await attendre(800);
    e = await etat();
    verifier(!e.profil && e.param && e.rub === 'compte', 'flèche « ‹ Paramètres » : retour sur la rubrique « Compte »');
    // Ligne qui mène à une page de l'appli (Références) : flèche flottante, retour sur « Aide ».
    await p.evaluate(() => JUMELAGE_PARAMETRES('aide')); await attendre(300);
    await p.evaluate(() => [...document.querySelectorAll('.JUM-PARAM-LIGNE')].find(b => /Références/.test(b.textContent)).click()); await attendre(800);
    verifier(await p.evaluate(() => !!document.querySelector('.JUM-RETOUR-PARAM.flottant')), 'Aide › Références : flèche « ‹ Paramètres » flottante');
    await p.click('.JUM-RETOUR-PARAM.flottant'); await attendre(600);
    e = await etat();
    verifier(e.param && e.rub === 'aide' && await p.evaluate(() => !document.querySelector('.JUM-RETOUR-PARAM')), 'flèche flottante : retour sur « Aide », flèche retirée');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
