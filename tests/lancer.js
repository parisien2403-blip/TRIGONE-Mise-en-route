// Lance tous les tests de TRIGONE : node tests/lancer.js   (ou un seul : node tests/lancer.js sauvegarde)
const { serveur, nombreEchecs } = require('./outils');
const TESTS = {
    'parcours': ['Parcours complet (demande → valideurs → Chorus DT)', require('./test-parcours')],
    'code-acces': ['Code d\'accès unique à l\'ouverture', require('./test-code-acces')],
    'retour': ['Bouton retour du téléphone (Paramètres et fenêtres)', require('./test-retour')],
    'carte': ['Carte TRIGONE (photo, QR code, plein écran, vérification, scan par un autre compte)', require('./test-carte')],
    'notice': ['Notice TRIGONE (livret à pages qui tournent, sommaire, captures, téléphone et PC)', require('./test-notice')],
    'empreinte': ['Empreinte digitale au déverrouillage (code à 4 chiffres en secours)', require('./test-empreinte')],
    'sauvegarde': ['Sauvegarde et restauration', require('./test-sauvegarde')],
    'hors-ligne': ['Sans réseau', require('./test-hors-ligne')],
    'reservation': ['Option Demande de réservation (hébergement / transport)', require('./test-reservation')],
    'collective': ['Mise en route collective → compte-rendu (participants repris)', require('./test-collective')],
    'envoi-collective': ['Mission collective envoyée aux participants dans TRIGONE', require('./test-envoi-collective')],
    'multi-appareils': ['Un compte sur deux appareils (traité sur le PC → traité sur le téléphone)', require('./test-multi-appareils')],
    'participants': ['Onglet Participants : cartes TRIGONE et photos chiffrées de bout en bout', require('./test-participants')],
    'justificatifs': ['Justificatifs reçus par mail (adresse prénom.nom, pièces jointes chiffrées, compte-rendu)', require('./test-justificatifs')],
    'registre': ['Registre OMR de l\'assistant Chorus DT (n° OMR, CR rapprochés, relances)', require('./test-registre')],
    'montre': ['Horodatage depuis la montre (notification avec bouton)', require('./test-montre')],
    'etranger': ['Mission à l\'étranger (barème, trajet en France, taux BCE)', require('./test-etranger')],
    'dossiers': ['Bibliothèque et Remboursement en dossiers', require('./test-dossiers')],
    'bibliotheque': ['Bibliothèques sans limite (mémoire utilisée, mémoire pleine)', require('./test-bibliotheque-illimitee')],
    'affichage-pc': ['Affichage PC sur tablette et pliable', require('./test-affichage-pc')],
    'demenagement': ['Déménagement vers l\'adresse Cloudflare', require('./test-demenagement')],
    'scan': ['Justificatifs photo scannés (recadrés, allégés, en PDF)', require('./test-scan')],
    'rappel': ['Rappel « départ en mission » (notification le jour du départ)', require('./test-rappel')],
    'sauvegarde-auto': ['Sauvegarde automatique chiffrée dans le compte', require('./test-sauvegarde-auto')],
    'question': ['Question au missionnaire au lieu d\'un refus', require('./test-question')],
    'controle': ['Contrôle du compte-rendu avant envoi', require('./test-controle')],
    'distance': ['Distance automatique des indemnités kilométriques', require('./test-distance')],
    'pdf-complet': ['Compte-rendu et justificatifs en un seul PDF (assistant Chorus DT)', require('./test-pdf-complet')],
    'choix': ['Écran de choix et logo des PDF', require('./test-choix')],
    'inscription': ['Inscription sans adresse mail, validation, blocage, code de réactivation', require('./test-inscription')],
    'groupe': ['Envoi au groupe (tous les assistants Chorus DT de l\'unité), traité par le premier', require('./test-groupe')],
    'premiere': ['Première connexion guidée (7 étapes, destinataires selon les rôles, bienvenue)', require('./test-premiere')],
    'comptes': ['Comptes : administrateur, réinitialisation et suppression sur demande', require('./test-comptes')],
    'medailles': ['Médailles : recompter depuis la Bibliothèque, repartir à zéro', require('./test-medailles')],
    'scenarios': ['Matrice de scénarios de bout en bout (demandes, refus, erreurs, comptes-rendus)', require('./test-scenarios')],
    'raccourcis': ['Raccourcis de l\'icône et validation groupée', require('./test-raccourcis')],
    'attente': ['Envois sans réseau (boîte d\'envoi) et agenda', require('./test-attente')],
    'erreurs': ['Remontée des erreurs (page administrateur)', require('./test-erreurs')],
    'boite': ['Boîte aux lettres TRIGONE (envois directs chiffrés)', require('./test-boite')]
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
