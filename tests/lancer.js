// Lance tous les tests de TRIGONE : node tests/lancer.js   (ou un seul : node tests/lancer.js sauvegarde)
const { serveur, nombreEchecs } = require('./outils');
const TESTS = {
    'parcours': ['Parcours complet (demande → valideurs → Chorus DT)', require('./test-parcours')],
    'code-acces': ['Code d\'accès unique à l\'ouverture', require('./test-code-acces')],
    'sauvegarde': ['Sauvegarde et restauration', require('./test-sauvegarde')],
    'hors-ligne': ['Sans réseau', require('./test-hors-ligne')]
};
(async () => {
    const choix = process.argv.slice(2);
    const srv = await serveur();
    for (const cle of Object.keys(TESTS)) {
        if (choix.length && choix.indexOf(cle) < 0) continue;
        console.log('\n▶ ' + TESTS[cle][0]);
        try { await TESTS[cle][1](srv); } catch (e) { console.log('  ✘ arrêt du test : ' + e.message.split('\n')[0]); require('./outils').verifier(false, cle + ' interrompu'); }
    }
    await srv.fermer();
    const n = nombreEchecs();
    console.log('\n' + (n ? '✘ ' + n + ' vérification(s) en échec' : '✔ Tout est bon'));
    process.exit(n ? 1 : 0);
})();
