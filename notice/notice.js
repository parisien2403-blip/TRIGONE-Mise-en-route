// ===================== NOTICE TRIGONE =====================
// Livret d'utilisation, ouvert par JUMELAGE_NOTICE (jumelage.js) : couverture, sommaire, chapitres, pages qui tournent.
// Chaque page est mise en forme à 400 × 566 (échelle 1) puis agrandie à la taille de l'écran. Captures de la vraie
// appli avec des personnages fictifs (notice/img), repères dorés ① ② ③ repris dans le texte.
// {B} : chemin de la racine de TRIGONE (« ../ » depuis Compte-rendu).
(function() {
    var VERSION = 142;
    // Capture : un bouton, pour que le toucher l'agrandisse au lieu de tourner la page.
    function img(n) { return '<button type="button" class="n-capt" data-zoom="{B}notice/img/' + n + '.webp" aria-label="Agrandir la capture"><img src="{B}notice/img/' + n + '.webp" alt=""><i>⤢</i></button>'; }
    function r(n) { return '<span class="n-r">' + n + '</span>'; }
    function et(l) { return '<ol class="n-et">' + l.map(function(x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'; }
    function savoir(t) { return '<div class="n-enc n-savoir"><b>À SAVOIR</b>' + t + '</div>'; }
    function attention(t) { return '<div class="n-enc n-att"><b>ATTENTION</b>' + t + '</div>'; }
    function astuce(t) { return '<div class="n-enc n-astuce"><img src="{B}mascotte-pouce.webp" alt=""><span><b>Astuce :</b> ' + t + '</span></div>'; }
    function duo(capture, corps, cls) { return '<div class="n-duo' + (cls ? ' ' + cls : '') + '">' + img(capture) + '<div class="n-txt">' + corps + '</div></div>'; }
    function page(titre, corps, ch) { return { ch: ch, html: '<div class="n-p">' + (titre ? '<h4>' + titre + '</h4>' : '') + corps + '</div>' }; }
    function chapitre(n, titre, resume, points, ch) {
        return { ch: ch, chapitre: { n: n, titre: titre }, html: '<div class="n-p n-chap"><div class="n-chap-n">CHAPITRE ' + n + '</div><h3>' + titre + '</h3><div class="n-chap-trait"></div>' +
            '<p class="n-chap-res">' + resume + '</p><div class="n-chap-dans">DANS CE CHAPITRE</div><ul>' + points.map(function(x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
            '<img class="n-chap-fili" src="{B}phoenix-icon.png" alt=""></div>' };
    }
    var P = [];
    function ajouter() { for (var i = 0; i < arguments.length; i++) P.push(arguments[i]); }

    // ---------- Couverture, page de garde, sommaire ----------
    ajouter({ couverture: true, html: '<div class="n-couv"><i class="n-couv-cadre"></i><i class="n-coin a"></i><i class="n-coin b"></i><i class="n-coin c"></i><i class="n-coin d"></i>' +
        '<div class="n-couv-in"><img src="{B}phoenix-icon.png" alt=""><h1>TRIGONE</h1><h2>Notice</h2></div><div class="n-couv-bas">4°RIISC · V' + VERSION + '</div></div>' });
    ajouter(page('', '<div class="n-garde"><img src="{B}phoenix-icon.png" alt=""><div class="n-garde-t">TRIGONE</div><div class="n-garde-s">NOTICE D\'UTILISATION</div>' +
        '<p>Mise en route · Compte-rendu de mission · Assistant Chorus DT · Carte TRIGONE</p>' +
        '<div class="n-garde-cadre"><b>COMMENT LIRE CETTE NOTICE</b>Chaque écran est montré tel qu\'il apparaît sur le téléphone. Les <b>repères dorés</b> ' + r(1) + ' ' + r(2) + ' ' + r(3) +
        ' sur les captures correspondent aux étapes numérotées du texte. Suivez-les dans l\'ordre.<br><br>' +
        '<span class="n-ex-savoir">À SAVOIR</span> une information utile.<br><span class="n-ex-att">ATTENTION</span> un point à ne pas manquer.</div>' +
        '<p class="n-garde-note">Les personnes visibles sur les captures (ADJ MARTIN Paul, CNE DURAND Marc, LCL LEROY Anne, SCH PETIT Julie…) sont fictives.</p>' +
        '<p class="n-garde-note">Pour tourner les pages : faites glisser le coin de la page, touchez son bord, ou utilisez les flèches ‹ ›.</p></div>'));
    ajouter({ sommaire: 1, html: '' }, { sommaire: 2, html: '' });

    // ---------- 1. Présentation ----------
    ajouter(chapitre(1, 'TRIGONE en bref', 'TRIGONE réunit sur votre téléphone et votre PC tout le parcours d\'une mission : la demande de mise en route avant le départ, sa validation, puis le compte-rendu et les frais au retour.',
        ['Les trois espaces de TRIGONE', 'Le circuit d\'une mission, du départ au remboursement', 'Qui fait quoi'], 'pres'));
    ajouter(page('Les trois espaces', '<div class="n-trois">' +
        '<div><b>MISE EN ROUTE</b><span>AVANT LE DÉPART</span>Le missionnaire fait sa demande d\'ordre de mise en route (individuelle ou collective). Les valideurs la signent.</div>' +
        '<div class="noir"><b>COMPTE-RENDU DE MISSION</b><span>AU RETOUR</span>Horodatage du départ, de l\'arrivée et du retour, frais calculés, justificatifs, envoi en un seul PDF.</div>' +
        '<div class="or"><b>ASSIST CHORUS DT</b><span>TRAITEMENT</span>L\'assistant Chorus DT reçoit les demandes validées et les comptes-rendus, et tient le registre des OMR.</div></div>' +
        savoir('Tout part et arrive <b>dans TRIGONE</b>, sans mail ni fichier à joindre : chaque envoi est <b>chiffré</b> et n\'est lisible que par son destinataire.'), 'pres'));
    ajouter(page('Le circuit d\'une mission', '<div class="n-circuit">' +
        ['<b>1. Missionnaire</b>Fait sa demande de mise en route et l\'envoie à son 1<sup>er</sup> valideur.', '<b>2. VALIDEUR 1</b> (chef de service) : valide et signe, refuse ou pose une question. Transmet au 2<sup>e</sup> valideur.',
         '<b>3. VALIDEUR 2</b> (chef de corps) : valide et signe, ou renvoie au valideur 1 ou au demandeur. Transmet à l\'assistant Chorus DT.', '<b>4. Assistant Chorus DT</b>Contrôle les signatures, télécharge le PDF et crée l\'ordre de mission dans Chorus DT.',
         '<b>5. Missionnaire</b>Part en mission avec TRIGONE Compte-rendu : horodatages, frais, justificatifs.', '<b>6. Assistant Chorus DT</b>Reçoit le compte-rendu (au plus tard 30 jours après la mission) et le traite.'].map(function(x) { return '<div>' + x + '</div>'; }).join('<i>▼</i>') + '</div>' +
        savoir('À chaque étape, le missionnaire est <b>prévenu</b> par une notification et suit sa demande dans la <b>Bibliothèque</b>.'), 'pres'));

    // ---------- 2. Installer et ouvrir ----------
    ajouter(chapitre(2, 'Installer et ouvrir TRIGONE', 'TRIGONE est une application web : elle s\'installe depuis le navigateur, sans magasin d\'applications, et se met à jour toute seule.',
        ['Installer TRIGONE sur le téléphone et le PC', 'L\'écran d\'accueil', 'Mises à jour, thème clair ou sombre'], 'inst'));
    ajouter(page('Installer TRIGONE', '<h5>Sur un téléphone Android (Chrome)</h5>' + et(['Ouvrez l\'adresse de TRIGONE dans <b>Chrome</b> (lien ou QR code donné par un collègue).', 'Touchez le menu <b>⋮</b> en haut à droite.', 'Touchez <b>« Installer l\'application »</b> (ou « Ajouter à l\'écran d\'accueil »).', 'L\'icône TRIGONE (le phénix) apparaît sur l\'écran d\'accueil du téléphone : ouvrez TRIGONE <b>toujours depuis cette icône</b>.']) +
        '<h5>Sur iPhone (Safari)</h5>' + et(['Ouvrez l\'adresse dans <b>Safari</b>.', 'Touchez <b>Partager</b> puis <b>« Sur l\'écran d\'accueil »</b>.']) +
        '<h5>Sur PC (Chrome ou Edge)</h5>' + et(['Ouvrez l\'adresse, puis cliquez sur l\'icône <b>Installer</b> à droite de la barre d\'adresse.']) +
        astuce('Paramètres › Aide › <b>Partager TRIGONE</b> affiche un QR code : un collègue le scanne pour installer TRIGONE à son tour.'), 'inst'));
    ajouter(page('L\'écran d\'accueil', duo('01-choix', et([r(1) + ' <b>Mise en route</b> : toucher pour faire une demande avant le départ.', r(2) + ' <b>Compte-rendu de mission</b> : toucher pour démarrer ou reprendre une mission.',
        r(3) + ' <b>Mon compte</b> : se connecter, Paramètres, se déconnecter.', r(4) + ' <b>Ma carte TRIGONE</b> : accès direct à votre carte.', r(5) + ' <b>Mise à jour</b> : vérifier qu\'une nouvelle version est disponible.', r(6) + ' <b>Numéro de version</b> de TRIGONE.'])) +
        savoir('Un assistant Chorus DT voit en plus un 3<sup>e</sup> espace, <b>ASSIST CHORUS-DT</b> (chapitre 10).'), 'inst'));
    ajouter(page('Mises à jour, thème et PC', '<h5>Mises à jour</h5><p>TRIGONE se met à jour <b>tout seul</b> à l\'ouverture. Une notification « Nouveautés » présente les changements. Le bouton ↻ de l\'écran d\'accueil force la vérification.</p>' +
        '<h5>Clair ou sombre</h5><p>Le bouton <b>☾ / ☀</b> en haut à droite des applis passe du thème clair au thème sombre.</p>' +
        '<h5>Sur PC</h5><p>Sur un ordinateur, TRIGONE s\'affiche en grand : menu à gauche, formulaires en colonnes. Sur une tablette ou un téléphone pliant ouvert, le bouton <b>écran</b> (à côté du compte) bascule l\'affichage PC.</p>' +
        '<h5>Démonstration</h5><p>Chaque appli propose <b>« Voir une démonstration »</b> : une visite guidée, sans rien envoyer.</p>' +
        attention('Ouvrez toujours TRIGONE depuis l\'<b>icône installée</b> : vos données sont rangées dans l\'appli de ce téléphone, pas dans un onglet du navigateur.'), 'inst'));

    // ---------- 3. Compte ----------
    ajouter(chapitre(3, 'Créer son compte TRIGONE', 'Le compte TRIGONE, à votre adresse mail professionnelle, permet d\'envoyer et de recevoir demandes et comptes-rendus directement dans TRIGONE. Pas de mot de passe : un code à 6 chiffres reçu par mail.',
        ['Créer son compte (mail puis code)', 'Activer les notifications', 'Ajouter un autre appareil (PC, 2e téléphone)'], 'compte'));
    ajouter(page('Créer son compte — 1/2', duo('03-connexion-mail', et(['Touchez <b>Se connecter</b> en haut de l\'écran d\'accueil, puis <b>Créer mon compte</b>.', r(1) + ' Saisissez votre <b>adresse mail professionnelle</b>.', r(2) + ' Touchez <b>Recevoir le code par mail</b>.', 'Ouvrez votre messagerie : un mail <b>« Votre code TRIGONE »</b> arrive de <b>noreply@trigone-app.com</b>.'])) +
        savoir('Pas de réseau pour l\'instant ? « Remplir mon profil sans compte » permet de commencer ; le compte s\'active plus tard.'), 'compte'));
    ajouter(page('Créer son compte — 2/2', duo('04-connexion-code', et([r(1) + ' Saisissez le <b>code à 6 chiffres</b> reçu par mail.', r(2) + ' Touchez <b>Valider</b>.', 'Le message vert <b>« Compte TRIGONE actif »</b> confirme l\'activation.'])) +
        attention('Le code est valable <b>15 minutes</b>. Si vous en demandez un nouveau, <b>seul le dernier</b> fonctionne. Pas reçu ? Regardez dans les <b>courriers indésirables</b>, attendez quelques minutes, puis touchez « Renvoyer le code ».'), 'compte'));
    ajouter(page('Notifications', duo('83-compte-notifications', et(['Ouvrez <b>Mon compte</b> (pastille en haut) › Paramètres › Notifications, ou la fenêtre Compte TRIGONE.', r(1) + ' Touchez <b>Activer les notifications</b>, puis <b>Autoriser</b> dans la fenêtre du téléphone.', 'Vous êtes prévenu de chaque demande reçue, refus, question, compte-rendu reçu et étape de votre suivi, <b>même appli fermée</b>.'])) +
        savoir('Sur Android, pour des notifications sans retard : Paramètres du téléphone › Applications › <b>Chrome</b> › Batterie › <b>« Non restreinte »</b>.'), 'compte'));
    ajouter(page('Ajouter un autre appareil', duo('81-ajouter-appareil', et(['Sur l\'appareil <b>déjà connecté</b> : Paramètres › Compte › <b>Ajouter un appareil</b>.', 'Un <b>code de liaison</b> s\'affiche (ex. QDCF-XNYM), valable 15 minutes, une seule fois.', 'Sur le <b>nouvel appareil</b> : écran d\'accueil de TRIGONE › <b>« J\'ai déjà TRIGONE sur un autre appareil »</b>, puis saisissez le code.', 'Le nouvel appareil est relié à votre compte, <b>avec vos données</b> (profil, demandes, missions).'])) +
        astuce('Le code de liaison ne passe pas par le mail : c\'est la solution si le mail du code tarde à arriver.'), 'compte'));

    // ---------- 4. Profil, rôles, sécurité ----------
    ajouter(chapitre(4, 'Mon profil, mes rôles, ma sécurité', 'Votre identité est saisie une seule fois : elle pré-remplit Mise en route, Compte-rendu et votre carte TRIGONE. Les valideurs et l\'assistant Chorus DT y déclarent leur rôle.',
        ['Mon profil : identité et destinataires', 'Mes rôles (VALIDEUR 1, VALIDEUR 2, ASSIST CHORUS DT)', 'Code d\'accès et empreinte', 'Absence et remplaçant'], 'profil'));
    ajouter(page('Mon profil', duo('12-profil', et(['Mon compte › Paramètres › Compte › <b>Mon profil</b>.', 'Remplissez <b>Mon identité</b> : unité, CIE, ' + r(1) + ' <b>grade</b>, ' + r(2) + ' <b>matricule (NID, 10 chiffres)</b>, nom, prénom.', 'Remplissez <b>Envois</b> : ' + r(3) + ' mail du <b>1<sup>er</sup> valideur</b>, votre mail, mail de l\'<b>assistant Chorus DT</b>.', 'Touchez <b>Enregistrer</b>.'])) +
        savoir('Le bouton <b>QR</b> au bout des champs de mail scanne la <b>carte TRIGONE</b> de la personne : son adresse se remplit sans faute de frappe.'), 'profil'));
    ajouter(page('Mon profil (suite)', duo('13-profil-bas', et(['<b>Option demande de réservation</b> : si votre unité passe par un organisme de réservation (hébergement, transport), cochez la case et indiquez son nom.', '<b>Code d\'accès à 4 chiffres</b> : demandé à chaque ouverture de TRIGONE pour protéger vos données (facultatif). Saisissez-le deux fois.', 'Touchez <b>Enregistrer</b>.'])) +
        attention('<b>Code d\'accès oublié = aucune récupération possible.</b> La seule solution est d\'effacer TRIGONE sur l\'appareil. Activez la sauvegarde automatique (chapitre 14) pour tout récupérer ensuite.'), 'profil'));
    ajouter(page('Mes rôles', duo('14-roles', et(['Paramètres › Compte › <b>Mes rôles</b>. Tout le monde est missionnaire.', r(1) + ' <b>VALIDEUR 1</b> (chef de service), ' + r(2) + ' <b>VALIDEUR 2</b>, ' + r(3) + ' <b>ASSIST CHORUS DT</b> : cochez le ou les rôles qui vous ont été confiés.', 'Saisissez le <b>code du rôle</b>, remis par l\'administrateur (une seule fois), et votre <b>fonction</b> (ex. Chef de service), qui figure sur la signature.', 'Touchez <b>Enregistrer</b>.'])) +
        savoir('Un rôle coché est déclaré à votre compte : votre boîte ne reçoit que ce qui vous revient. On peut cumuler plusieurs rôles.'), 'profil'));
    ajouter(page('Code d\'accès et empreinte', duo('85-empreinte-ouverture', et(['Avec un code d\'accès, TRIGONE le demande à chaque ouverture.', 'Sur téléphone, ajoutez l\'<b>empreinte</b> (ou le visage) : Mon profil › Code d\'accès › <b>Activer l\'empreinte</b>, puis posez votre doigt.', 'À l\'ouverture : posez votre doigt sur le capteur, <b>« Bienvenue ✓ »</b> s\'affiche et TRIGONE s\'ouvre.', '<b>« Utiliser mon code »</b> reste possible à tout moment.'])) +
        savoir('Votre empreinte <b>reste dans le téléphone</b> : TRIGONE ne la voit jamais, il reçoit seulement « c\'est bien la personne ».'), 'profil'));
    ajouter(page('Absence et remplaçant', duo('84-absence', et(['Réservé aux valideurs et à l\'assistant Chorus DT : Paramètres › Compte › <b>Absence</b>.', r(1) + ' Saisissez le mail du <b>remplaçant</b> (il doit avoir un compte TRIGONE et le même rôle).', r(2) + ' Choisissez la <b>date de retour</b>.', 'Touchez <b>Déclarer mon absence</b> : tout ce qui vous est envoyé part directement chez le remplaçant, et l\'expéditeur en est informé.', 'Au retour : <b>Fin de l\'absence</b>.'])), 'profil'));

    // ---------- 5. Paramètres ----------
    ajouter(chapitre(5, 'Les Paramètres', 'Toutes les options de TRIGONE sont rangées dans une seule page, par rubriques : Compte, Notifications, réglages de l\'appli, Données et Aide.',
        ['Ouvrir les Paramètres', 'Les rubriques', 'Montre connectée'], 'param'));
    ajouter(page('Ouvrir les Paramètres', duo('10-parametres-compte', et(['Touchez la <b>pastille de votre compte</b> (vos initiales) puis <b>Paramètres</b>.', r(1) + ' Choisissez une <b>rubrique</b> en haut.', '<b>Compte</b> : ' + r(2) + ' Ma carte TRIGONE, ' + r(3) + ' Mon profil, ' + r(4) + ' Mes rôles, Absence, Ajouter un appareil.', '<b>Notifications</b> : activer, couper sur cet appareil, tester, montre connectée.'])), 'param'));
    ajouter(page('Les autres rubriques', duo('11-parametres-donnees', et(['<b>Mise en route / Compte-rendu</b> : réglages propres à l\'appli ouverte (notice, références, montants…).', '<b>Données</b> : sauvegarde automatique, restaurer depuis le compte, sauvegarder ou restaurer un fichier, se déconnecter et effacer, réinitialiser TRIGONE.', '<b>Aide</b> : cette notice, Découvrir TRIGONE, Partager TRIGONE, <b>Signaler un problème</b>.'])) +
        attention('« Réinitialiser TRIGONE » et « Se déconnecter et effacer » suppriment <b>toutes</b> les données de l\'appareil. Faites d\'abord une sauvegarde.'), 'param'));
    ajouter(page('Montre connectée', duo('82-montre', et(['Paramètres › Notifications › <b>Montre connectée</b> (pastille verte = prête, rouge = pas prête).', 'Activez les notifications de TRIGONE sur le téléphone.', 'Dans l\'appli de la montre (ex. Galaxy Wearable › Notifications), autorisez <b>Chrome</b> et TRIGONE.', 'Pendant une mission, la notification « Mission en cours » arrive sur la montre avec le bouton de l\'étape suivante : <b>un appui horodate</b>, même sans réseau.'])), 'param'));

    // ---------- 6. Carte TRIGONE ----------
    ajouter(chapitre(6, 'Ma carte TRIGONE', 'Votre carte d\'identité TRIGONE, au format carte bancaire, remplie avec Mon profil. Son QR code permet aux autres comptes TRIGONE de vous ajouter en un geste.',
        ['Ouvrir, retourner, afficher en grand', 'La photo', 'Le QR code et ses usages', 'Carte perdue ou volée'], 'carte'));
    ajouter(page('La carte', duo('c1-carte-recto', et(['Ouvrez la carte : bouton doré <b>« Ma carte »</b> de l\'écran d\'accueil, <b>appui long</b> sur l\'icône TRIGONE › Ma carte, ou Paramètres › Compte.', '<b>Recto</b> : photo, nom, grade, NID, unité, nombre de missions, hologramme qui bouge avec le téléphone.', '<b>Touchez la carte</b> pour la retourner.', '<b>Changer la photo</b> : appareil photo ou galerie, puis cadrez au doigt. La photo reste sur le téléphone.'])) +
        savoir('Le liseré évolue avec vos comptes-rendus envoyés : <b>bronze</b> (1), <b>argent</b> (10), <b>or</b> (20).'), 'carte'));
    ajouter(page('Le verso et le QR code', duo('c2-carte-verso', et(['<b>Verso</b> : QR code, rôles, « Compte vérifié depuis le… », signature.', '<b>Afficher en grand</b> : le téléphone passe à l\'horizontale et devient la carte (écran maintenu allumé). Touchez pour retourner, ✕ pour fermer.', '<b>Partager</b> : la carte (recto + verso) en image.'])) +
        attention('Le QR code ne contient qu\'un <b>identifiant</b> : ni photo, ni NID, ni adresse. Il ne donne accès à rien.'), 'carte'));
    ajouter(page('À quoi sert le QR code', duo('c5-carte-scan', et(['<b>Demande collective</b> : « Scanner des cartes TRIGONE » ajoute chaque personne (unité, grade, nom, matricule).', '<b>Mails</b> : le bouton QR des champs de mail (valideur, Chorus DT, remplaçant) remplit l\'adresse.', '<b>Mission collective</b> : le chef pointe les présents au départ, ou ajoute des participants.', '<b>Personnel d\'une autre unité</b> : signalé « extérieur ».', 'La caméra se lance ; visez le QR code. Sans caméra (PC), collez le lien de la carte.'])), 'carte'));
    ajouter(page('Vérifier une carte, carte perdue', duo('c6-carte-verif', et(['Scanné avec l\'<b>appareil photo</b> de n\'importe quel téléphone, le QR code ouvre la page <b>« Carte TRIGONE authentique »</b> : grade, nom, unité, heure de vérification (sans mail ni NID).', 'Une carte inventée ou un compte supprimé affiche <b>« Carte non reconnue »</b>.', 'Carte perdue, volée ou photographiée : sous la carte, <b>« Révoquer le QR code »</b>. L\'ancien ne marche plus, un nouveau est créé.'])), 'carte'));

    // ---------- 7. Demande de mise en route ----------
    ajouter(chapitre(7, 'Faire une demande de mise en route', 'La demande d\'ordre de mise en route (DOMR) se remplit en 5 onglets. Chaque onglet est vérifié avant de passer au suivant : une demande complète est une demande validée plus vite.',
        ['Nouvelle demande : identité et personnes', 'Trajet aller et trajet retour', 'Alimentation, hébergement, réservation', 'Imputation, avance et pièces jointes'], 'mer'));
    ajouter(page('Nouvelle demande', duo('20-mer-accueil', et(['Ouvrez <b>Mise en route</b> depuis l\'écran d\'accueil.', r(1) + ' Touchez <b>Nouvelle demande</b>.', r(2) + ' <b>Boîte de réception</b> : refus, questions, missions collectives reçues (la pastille rouge compte ce qui est à traiter).', r(3) + ' <b>Biblio</b> : le suivi de vos demandes envoyées. ' + r(4) + ' <b>Docs</b> : vos demandes à envoyer.'])), 'mer'));
    ajouter(page('Onglet 1 — Identité', duo('21-demande-identite', et(['Les 5 onglets en haut : <b>Identité, Aller, Retour, Alim./Héb., Imputation</b>. Un ✓ vert = onglet complet.', r(1) + ' Choisissez <b>Mission</b> ou <b>Formation / stage</b>.', r(2) + ' Saisissez l\'<b>objet</b> de la mission.', r(3) + ' <b>Personnel concerné</b> : votre identité est déjà remplie depuis Mon profil.'])), 'mer'));
    ajouter(page('Demande collective', duo('21b-demande-personnes', et(['Pour plusieurs personnes (une seule demande, un OMR collectif) :', r(1) + ' <b>Ajouter une personne</b> et la remplir,', r(2) + ' ou <b>Scanner des cartes TRIGONE</b> : chaque carte scannée ajoute la personne,', r(3) + ' ou <b>Importer une liste</b> Excel, Calc ou CSV (colonnes UNITÉ · CIE · GRADE · NOM · PRÉNOM · NID). « Télécharger le modèle » donne le tableau à remplir.', 'Touchez <b>Étape suivante</b>.'])) +
        savoir('Dans une demande collective, le demandeur est <b>chef de mission</b> : au retour, il envoie le compte-rendu prérempli à chaque participant.'), 'mer'));
    ajouter(page('Onglet 2 — Trajet aller', duo('22-demande-aller', et(['<b>Lieu de départ</b> : résidence administrative ou familiale.', '<b>Moyen de transport</b> : véhicule de service, train, avion, véhicule personnel…', '<b>Lieu de départ</b> et <b>lieu d\'arrivée</b> : tapez la ville, le code postal se remplit seul. Choisissez le pays si besoin.', '<b>Date et heure</b> de départ et d\'arrivée.', 'Trajet en plusieurs parties (ex. train jusqu\'à l\'aéroport) : ajoutez un trajet intermédiaire.'])), 'mer'));
    ajouter(page('Onglet 3 — Trajet retour', duo('23-demande-retour', et(['Le retour est <b>pré-rempli</b> avec l\'aller inversé.', 'Vérifiez le <b>moyen de transport</b>, les lieux et les <b>dates et heures</b> du retour.', 'Corrigez ce qui change (ex. retour un autre jour).', 'Touchez <b>Étape suivante</b>.'])), 'mer'));
    ajouter(page('Onglet 4 — Alimentation, hébergement', duo('24-demande-conditions', et(['<b>Demande de réservation</b> (si votre unité l\'utilise) : cochez <b>Hébergement</b> et/ou <b>Transport</b> à réserver par l\'organisme. Le compte-rendu le reprendra.', '<b>Durant le déplacement</b> : nourri à titre onéreux ? transport en commun ?', '<b>Durant la mission</b> : nourri à titre onéreux ? logé à titre onéreux ?', 'Répondez <b>OUI</b> ou <b>NON</b> à chaque ligne.'])), 'mer'));
    ajouter(page('Onglet 5 — Imputation', duo('25-demande-imputation', et(['<b>Mission imputée à l\'unité</b> : OUI ou NON.', '<b>Code d\'engagement Fd@ligne</b> : saisissez-le ; TRIGONE affiche aussitôt le libellé, le centre financier, le centre de coût et le code activité pour vérifier.', '<b>Demande d\'avance</b> : OUI ou NON.', '<b>NDS ou DAF</b> : joignez le document (PDF ou photo).', '<b>Référence</b> (facultatif).'])), 'mer'));
    ajouter(page('Ranger la demande', duo('25b-demande-fin', et(['La pièce jointe apparaît avec <b>Voir</b> et <b>Retirer</b>. Elle voyagera avec la demande jusqu\'au PDF final de l\'assistant Chorus DT.', r(1) + ' Touchez <b>Ajouter aux documents</b>.', 'Le message <b>« Ajoutée à vos Documents »</b> confirme : la demande est rangée dans <b>Prêtes à envoyer</b>.'])) +
        astuce('Vous pouvez préparer plusieurs demandes et les envoyer ensemble, en un seul envoi.'), 'mer'));

    // ---------- 8. Envoyer et suivre ----------
    ajouter(chapitre(8, 'Envoyer et suivre sa demande', 'La demande part chiffrée, directement dans le TRIGONE du 1er valideur. Un numéro d\'OMR lui est donné à l\'envoi. Vous suivez ensuite chaque étape.',
        ['Mes documents : Prêtes à envoyer', 'Envoyer au 1er valideur', 'Suivre sa demande', 'Demande refusée : corriger et renvoyer'], 'envoi'));
    ajouter(page('Mes documents', duo('27-documents', et(['Touchez <b>Docs</b> en bas de l\'accueil de Mise en route.', r(1) + ' Ouvrez le dossier <b>Prêtes à envoyer</b> (le nombre de demandes est indiqué).', '<b>Refusées — à corriger</b> : les demandes revenues avec le motif du refus.'])), 'envoi'));
    ajouter(page('Envoyer au 1er valideur', duo('28-pretes', et(['Vérifiez la demande (<b>Modifier</b> pour la corriger, <b>Retirer</b> pour la supprimer).', r(1) + ' <b>Mail du 1<sup>er</sup> valideur</b> (repris de Mon profil).', r(2) + ' Touchez <b>Envoyer cette demande</b>.', 'Fenêtre <b>Avant d\'envoyer</b> : « Aperçu du PDF » pour relire, puis <b>Envoyer</b>.'])) +
        attention('Une demande ne peut partir que vers un <b>VALIDEUR 1</b> qui a un compte TRIGONE. Sinon : « Pas encore de compte TRIGONE » ou « Mauvais destinataire », et la demande reste dans vos Documents.'), 'envoi'));
    ajouter(page('Demande envoyée', duo('29b-envoyee', et(['<b>« Demande envoyée »</b> : elle est arrivée, chiffrée, dans le TRIGONE du 1<sup>er</sup> valideur.', 'Elle quitte Documents et rejoint votre <b>Bibliothèque</b>.', 'Un <b>numéro d\'OMR</b> (ex. N°0001) et sa date lui sont attribués : ils figurent sur le PDF et seront repris dans le compte-rendu.'])) +
        savoir('Sans réseau, l\'envoi est mis de côté et <b>part tout seul</b> au retour du réseau (Paramètres › Données › Envois en attente).'), 'envoi'));
    ajouter(page('Suivre sa demande', duo('50-suivi', et(['Touchez <b>Biblio</b>.', '<b>En cours de validation</b> : chez le VALIDEUR 1 ou le VALIDEUR 2 (avec leur nom).', '<b>Chez l\'assistant Chorus DT</b> : validée, en attente de prise en charge.', '<b>Prises en charge</b> : ordre de mission créé dans Chorus DT.', '<b>Refusées</b> : avec le motif ; corrigez dans Docs › Refusées et renvoyez.'])) +
        savoir('Une notification vous prévient à chaque étape. Une demande qui attend plus de 24 h relance automatiquement la personne qui la détient.'), 'envoi'));

    // ---------- 9. Valideurs ----------
    ajouter(chapitre(9, 'Valider les demandes (VALIDEUR 1 et 2)', 'Le valideur reçoit les demandes dans sa boîte de réception, les ouvre, les valide (signature) ou les refuse, puis transmet ses décisions en un geste.',
        ['Boîte de réception', 'Espace valideur : valider, refuser, question', 'Transmettre ses décisions', 'Le VALIDEUR 2'], 'val'));
    ajouter(page('Boîte de réception', duo('30-v1-accueil', et(['Une notification <b>« Demande reçue »</b> arrive.', 'Accueil de Mise en route : ' + r(1) + ' <b>Boîte de réception</b>, avec une pastille rouge.', '<b>Espace valideur</b> : toutes les demandes ouvertes, à décider.'])) +
        savoir('Le rôle VALIDEUR 1 ou 2 doit être coché dans Mes rôles, avec son code (chapitre 4).'), 'val'));
    ajouter(page('Ouvrir et signer', duo('31-v1-boite', et(['La boîte est rangée en dossiers : ' + r(1) + ' <b>À signer</b>, Refusées à corriger, Missions collectives, Questions.', 'Ouvrez <b>À signer</b>.', 'Sur l\'envoi reçu, touchez <b>Ouvrir et signer</b> : les demandes s\'ouvrent dans l\'Espace valideur.'])), 'val'));
    ajouter(page('Espace valideur', duo('33b-v1-espace-bas', et(['Chaque demande : nom, objet, dates, pièces jointes (touchez pour les voir).', '<b>Aperçu</b> : le PDF de la demande.', r(1) + ' <b>Valider</b> : la demande est validée et <b>signée</b> (signature électronique de votre rôle, avec votre fonction).', r(2) + ' <b>Refuser</b> : avec un motif, la demande revient au demandeur.', '<b>Question</b> : demander une précision sans refuser.'])) +
        astuce('Cochez plusieurs demandes pour les valider toutes d\'un coup.'), 'val'));
    ajouter(page('Refuser', duo('34-v1-refus', et(['Touchez <b>Refuser</b>.', 'Écrivez le <b>motif</b> (ex. « merci de joindre la DAF »).', 'Touchez <b>Refuser</b>.', 'Le demandeur reçoit la demande dans <b>Refusées — à corriger</b>, avec le motif et une notification.'])) +
        savoir('Le VALIDEUR 2 choisit en plus de <b>renvoyer</b> la demande au VALIDEUR 1 ou au demandeur.'), 'val'));
    ajouter(page('Transmettre ses décisions', duo('36-v1-transmettre', et(['Saisissez le <b>mail du 2<sup>e</sup> valideur</b> (VALIDEUR 1) ou de l\'<b>assistant Chorus DT</b> (VALIDEUR 2), ou scannez sa carte.', 'Touchez <b>Transmettre les décisions</b>.', 'Fenêtre <b>Transmettre</b> : un envoi par destinataire (validées, refus). ' + r(1) + ' Touchez <b>Envoyer</b> sur chacun.', '<b>« Arrivé dans le TRIGONE du destinataire »</b> s\'affiche. Touchez <b>Terminé</b>.'])), 'val'));
    ajouter(page('Le VALIDEUR 2', duo('38-v2-validee', et(['Même fonctionnement : boîte de réception › <b>À signer</b> › Ouvrir et signer.', 'La signature du VALIDEUR 1 est <b>vérifiée</b> (« Signature vérifiée »).', 'Validez, puis saisissez le <b>mail de l\'assistant Chorus DT</b>.', '<b>Transmettre les décisions</b> › Envoyer › Terminé.'])), 'val'));

    // ---------- 10. Assistant Chorus DT ----------
    ajouter(chapitre(10, 'Assistant Chorus DT', 'L\'assistant Chorus DT reçoit les demandes validées par les deux valideurs et les comptes-rendus de mission. Il tient le registre des OMR, commun à tous les assistants de l\'unité.',
        ['Mon espace', 'Demandes validées : contrôle et PDF', 'Comptes-rendus reçus', 'Registre des OMR'], 'chorus'));
    ajouter(page('Mon espace', duo('40-chorus-choix', et(['Avec le rôle ASSIST CHORUS DT, l\'écran d\'accueil montre un 3<sup>e</sup> espace : ' + r(1) + ' <b>ASSIST CHORUS-DT</b>.', '<b>Mon espace</b> indique le nombre de demandes validées à traiter et de comptes-rendus reçus.', 'Touchez le logo pour ouvrir l\'espace.'])), 'chorus'));
    ajouter(page('L\'espace Chorus DT', duo('41-chorus-espace', et(['<b>Registre des OMR</b> : toutes les mises en route et leurs comptes-rendus.', r(1) + ' <b>Demandes de mise en route</b> : validées par les deux valideurs.', '<b>Comptes-rendus de mission</b> : envoyés au retour de mission.', '<b>Relever maintenant</b> : chercher tout de suite les nouveaux envois.'])), 'chorus'));
    ajouter(page('Traiter une demande', duo('42-chorus-dossier', et(['<b>Aperçu</b> : relire la demande.', '<b>Télécharger le PDF</b> : TRIGONE vérifie d\'abord les signatures et les pièces jointes, puis produit le PDF final (demande signée + NDS / DAF).', '<b>Contrôle détaillé</b> : le détail de la vérification.', '<b>Question</b> : demander une précision au missionnaire.', 'Créez l\'ordre de mission dans Chorus DT, puis marquez la demande <b>Traitée</b> : le missionnaire est prévenu.'])), 'chorus'));
    ajouter(page('Registre des OMR', duo('43-registre', et([r(1) + ' Deux onglets : <b>Mises en route</b> (en attente de compte-rendu) et <b>Comptes-rendus rendus</b> (avec les montants).', 'Chaque ligne : n° OMR, date, objet, code FD, dates, personnel, <b>CR attendu le</b> (fin de mission + 30 jours), « En retard » sinon.', r(2) + ' <b>Relancer pour le CR</b> : un rappel dans la boîte du missionnaire. <b>Supprimer</b> : mission annulée.', r(3) + ' <b>PDF de cet onglet</b> et <b>Numérotation OMR</b> (nouvelle série).'])) +
        savoir('Le registre est <b>commun à tous les assistants Chorus DT de l\'unité</b> : chacun voit tout, avec « reçu par ».'), 'chorus'));
    ajouter(page('Comptes-rendus reçus', duo('77-registre-cr', et(['Le compte-rendu arrive dans <b>Comptes-rendus de mission</b>, avec ses justificatifs.', '<b>PDF complet</b> : le compte-rendu et tous ses justificatifs à la suite, en un seul PDF.', 'Dans le registre, la ligne passe dans <b>Comptes-rendus rendus</b> : « Validé — CR rendu », repas, hébergement, transports, IK, total.', 'Marquez-le <b>Traité</b> : le missionnaire est prévenu.'])), 'chorus'));

    // ---------- 11. Compte-rendu ----------
    ajouter(chapitre(11, 'Le compte-rendu de mission', 'TRIGONE Compte-rendu accompagne la mission : vous appuyez au départ, à l\'arrivée sur site, au départ du site et au retour. Les frais sont calculés, le compte-rendu part avec ses justificatifs en un seul envoi.',
        ['Partir d\'une mise en route', 'Départ mission', 'Horodatages pendant la mission', 'Frais, récapitulatif et envoi'], 'cr'));
    ajouter(page('Commencer', duo('60-cr-accueil', et([r(1) + ' <b>La mission commence ici</b> : mission sans mise en route.', r(2) + ' <b>À partir d\'une mise en route</b> : tout est repris de votre demande (conseillé).', r(3) + ' <b>Simuler une mission à venir</b> : estimer les frais.', r(4) + ' <b>Bibliothèque</b> : vos comptes-rendus. ' + r(5) + ' <b>Remboursement</b> : vos montants par mois.'])) +
        savoir('Le jour du départ, une notification « Départ en mission aujourd\'hui » ouvre directement le compte-rendu pré-rempli.'), 'cr'));
    ajouter(page('À partir d\'une mise en route', duo('61-cr-liste-mer', et(['Touchez <b>À partir d\'une mise en route</b>.', r(1) + ' Choisissez votre demande (envoyée le…, objet, dates).', '<b>« Mission pré-remplie »</b> : identité, libellé, lieux, transports, gares et horaires sont repris. Vérifiez, puis « Départ en mission » le jour J.', 'Le n° OMR suit dans le compte-rendu.'])), 'cr'));
    ajouter(page('Départ mission', duo('63-cr-depart-ident', et(['4 onglets : <b>1. Identification, 2. Trajet aller, 3. Trajet retour, 4. Top départ</b>.', '<b>Identification</b> : grade, nom, NID, compagnie, libellé, mission en France ou à l\'étranger, lieux de départ et de retour.', '<b>Mission collective (chef)</b> : à cocher si vous êtes chef de mission (chapitre 12).', '<b>Trajets</b> : mode de transport, destination, transport complémentaire.'])), 'cr'));
    ajouter(page('Top départ', duo('63-cr-depart-top', et(['Tout est renseigné : au moment de partir, ' + r(1) + ' touchez <b>Départ en mission</b>.', 'L\'heure exacte est enregistrée (horodatage).', 'Déjà parti ? <b>« Vous êtes déjà parti ? Corriger l\'heure de départ »</b>.'])) +
        attention('Appuyez <b>au moment réel</b> du départ : les droits (repas, nuits) sont calculés à partir des horodatages.'), 'cr'));
    ajouter(page('Pendant la mission', duo('64-cr-mission-en-cours', et(['Écran <b>Mission en cours</b> : votre identité et l\'heure de départ.', r(1) + ' À l\'arrivée, touchez <b>Arrivée sur site</b>.', r(2) + ' Puis, au départ du site, touchez <b>Je quitte le site</b>.', r(3) + ' Oublié d\'appuyer ? <b>« Cliquer ici »</b> pour saisir l\'heure réelle.'])) +
        savoir('Pas besoin de réseau. Avec la montre connectée, un appui sur la montre horodate l\'étape suivante.'), 'cr'));
    ajouter(page('Je quitte le site', duo('66-cr-choix-depart', et(['Touchez <b>Je quitte le site</b> : l\'heure de départ est enregistrée.', '<b>Vers une autre destination</b> : une nouvelle mission s\'enchaîne (mission en plusieurs étapes).', '<b>Retour définitif — fin de mission</b> : vous rentrez.', 'À l\'arrivée chez vous, touchez <b>Arrivée finale</b> : l\'horodatage est terminé.'])), 'cr'));
    ajouter(page('Frais — repas et hébergement', duo('67-cr-frais-repas', et(['Écran <b>Frais de mission</b>, onglet <b>Repas & hébergement</b>, à remplir chez vous, sans limite de temps.', '<b>Repas midi / soir</b> : avec <b>−</b> et <b>+</b>, le nombre de repas <b>payants</b> (le maximum autorisé est indiqué).', '<b>Hébergement</b>, nuit par nuit : <b>Gratuit</b>, <b>Demande de réservation</b> ou <b>Payant</b>.', 'Le <b>total forfait estimé</b> se met à jour.'])), 'cr'));
    ajouter(page('Frais — trajets et validation', duo('67-cr-frais-recap', et(['Onglet <b>Trajets</b> : billets (horaires des gares, aéroports), indemnités kilométriques (la distance se calcule toute seule), transports en commun.', 'Onglet <b>Récap & valider</b> : durée, période, transports, repas, hébergement.', 'Touchez <b>Valider et voir le récap</b>.'])), 'cr'));
    ajouter(page('Récapitulatif final', duo('68-cr-recap', et(['Le compte-rendu complet, tel qu\'il sera envoyé (identité, mission, horodatages, frais).', '<b>À envoyer avant le…</b> : 30 jours après la fin de mission.', '<b>Mission clôturée</b> : les horaires sont figés.', '<b>PJ</b> : rappel des justificatifs à joindre (facture d\'hôtel…).', 'Observations éventuelles, puis <b>Envoyer</b>.'])) +
        savoir('Avant l\'envoi, TRIGONE contrôle le compte-rendu (horaires dans le désordre, billet incohérent, IK sans kilométrage…) : <b>Corriger</b> ou <b>Envoyer quand même</b>.'), 'cr'));
    ajouter(page('Envoyer le compte-rendu', duo('71-cr-envoi-justif', et(['Fenêtre <b>Envoyer le compte-rendu</b> : le PDF du compte-rendu est joint automatiquement.', '<b>Ajouter des justificatifs</b> : PDF ou <b>photos</b> (une facture photographiée est recadrée et allégée toute seule).', r(1) + ' Touchez <b>Envoyer</b> : le compte-rendu arrive, chiffré, chez l\'assistant Chorus DT.', '<b>« Compte-rendu envoyé »</b> : la mission est archivée dans la Bibliothèque.'])), 'cr'));
    ajouter(page('Les distinctions', duo('78-medaille', et(['Chaque compte-rendu envoyé compte pour vos <b>distinctions TRIGONE</b> :', '<b>Bronze</b> au 1<sup>er</sup> compte-rendu, <b>Argent</b> au 10<sup>e</sup>, <b>Or</b> au 20<sup>e</sup>.', 'La médaille s\'affiche au-dessus du « Bonjour » sur l\'accueil, et le liseré de votre carte TRIGONE prend sa couleur.'])), 'cr'));

    // ---------- 12. Mission collective ----------
    ajouter(chapitre(12, 'Mission collective', 'Une seule demande pour toute l\'équipe. Au retour, le chef de mission envoie le compte-rendu prérempli à chaque participant, qui le complète et l\'envoie. Le chef suit qui l\'a fait.',
        ['Chef de mission : participants', 'Pointer les présents au départ', 'Envoyer aux participants', 'Suivi de l\'équipe', 'Participant : recevoir son compte-rendu'], 'coll'));
    ajouter(page('Chef de mission', duo('90-collective-chef', et(['À partir de la mise en route collective, ' + r(1) + ' <b>Mission collective (chef)</b> est coché d\'office.', r(2) + ' <b>Participants</b> : repris de la demande (grade, nom, NID, compagnie).', '<b>Mail chef de mission</b> : les participants vous mettent en copie.', 'Personnel d\'une autre unité : indiqué « (extérieur) ».'])), 'coll'));
    ajouter(page('Pointer les présents', duo('91-pointage', et(['Au rassemblement, touchez <b>Pointer les présents (cartes TRIGONE)</b>.', 'Scannez la carte de chaque participant : <b>« ✔ Présent 07h52 »</b>. La caméra reste ouverte pour le suivant.', 'Un participant absent de la liste est ajouté.', 'Touchez <b>Terminé</b>. L\'heure de présence apparaît dans la liste et sur le PDF.'])), 'coll'));
    ajouter(page('Envoyer aux participants', duo('92-envoi-participants', et(['Au récapitulatif, touchez <b>Envoyer aux participants dans TRIGONE</b>.', r(1) + ' Chaque participant est retrouvé par son <b>matricule</b> (« Compte TRIGONE retrouvé »).', r(2) + ' <b>Scanner des cartes TRIGONE</b> ou « Ajouter un participant ».', r(3) + ' Touchez <b>Envoyer</b> : chacun reçoit une notification et son compte-rendu déjà rempli.'])) +
        attention('Sans compte TRIGONE, un participant ne peut rien recevoir : qu\'il crée son compte, avec son matricule dans son profil, puis renvoyez.'), 'coll'));
    ajouter(page('Suivi de l\'équipe', duo('93-suivi-equipe', et(['Touchez <b>Suivi de l\'équipe : qui a envoyé son compte-rendu</b>.', 'Pour chacun : <b>« ✅ Envoyé le… »</b> ou <b>« ⏳ Pas encore envoyé »</b>. La liste se met à jour toute seule.', '<b>Relancer les retardataires</b> : une notification de rappel (une fois toutes les 12 h au plus).'])), 'coll'));
    ajouter(page('Participant', duo('94-participant-recu', et(['Le participant reçoit une notification <b>« Mission collective »</b>.', 'Boîte de réception › <b>Missions collectives</b> › ouvrir.', 'Son compte-rendu s\'ouvre <b>pré-rempli</b> avec la mission du chef : il complète son identité, ses frais et ses justificatifs.', 'Il l\'envoie à l\'assistant Chorus DT : le chef le voit dans son suivi.'])), 'coll'));

    // ---------- 13. Bibliothèque, remboursement ----------
    ajouter(chapitre(13, 'Bibliothèque, remboursement, simulateur', 'Tout ce que vous avez envoyé reste sur votre appareil, rangé et consultable. TRIGONE totalise vos remboursements et estime une mission à venir.',
        ['Bibliothèque de Mise en route et de Compte-rendu', 'Remboursement', 'Simulateur'], 'bib'));
    ajouter(page('Bibliothèque', duo('73-cr-bibliotheque', et(['Compte-rendu › <b>Bibliothèque</b> : <b>À envoyer</b>, <b>Envoyés</b> (en attente de traitement), <b>Traités</b>.', 'Ouvrez un compte-rendu pour le relire, télécharger le PDF, le renvoyer ou repartir de lui.', 'Mise en route › <b>Biblio</b> : vos demandes et leur suivi (chapitre 8).', 'La mémoire utilisée est indiquée ; supprimez ce dont vous n\'avez plus besoin.'])), 'bib'));
    ajouter(page('Remboursement et simulateur', duo('74-cr-remboursement', et(['<b>Remboursement</b> : vos frais par mois et par année (repas, hébergement, déplacements).', '<b>Exporter en PDF</b> : le tableau à conserver.', '<b>Simulateur</b> (accueil › Simuler une mission à venir) : dates, lieu, hébergement et repas, pour estimer les frais <b>avant</b> de partir. Rien n\'est enregistré.'])), 'bib'));

    // ---------- 14. Données ----------
    ajouter(chapitre(14, 'Sauvegarder et retrouver ses données', 'Vos demandes, missions et réglages sont rangés sur votre appareil. La sauvegarde automatique les garde aussi, chiffrés, dans votre compte : un téléphone perdu ne fait rien perdre.',
        ['Sauvegarde automatique et code de récupération', 'Sauvegarde dans un fichier', 'Nouveau téléphone'], 'donnees'));
    ajouter(page('Sauvegarde automatique', duo('80-sauvegarde-auto', et(['Paramètres › Données › <b>Sauvegarde automatique</b> › <b>Activer</b>.', 'TRIGONE donne un <b>code de récupération</b> (20 caractères) : <b>notez-le</b> et gardez-le en lieu sûr.', 'Une copie <b>chiffrée sur votre téléphone</b> part au plus une fois par jour, seulement quand quelque chose a changé.', 'Nouveau téléphone : connectez-vous à votre compte, puis <b>Restaurer depuis mon compte</b> avec le code.'])) +
        attention('Code de récupération perdu = sauvegarde impossible à ouvrir, <b>pour tout le monde</b> (personne ne peut le retrouver).'), 'donnees'));
    ajouter(page('Fichier et nouveau téléphone', '<h5>Sauvegarde dans un fichier</h5>' + et(['Paramètres › Données › <b>Sauvegarder dans un fichier</b> : un fichier pour tout TRIGONE, à ranger où vous voulez.', '<b>Restaurer depuis un fichier</b> : sur cet appareil ou un nouveau.']) +
        '<h5>Changer de téléphone</h5>' + et(['<b>Le plus simple</b> : sur l\'ancien, Ajouter un appareil (code de liaison), puis sur le nouveau « J\'ai déjà TRIGONE sur un autre appareil ».', '<b>Ancien téléphone perdu</b> : connexion au compte sur le nouveau, puis Restaurer depuis mon compte (code de récupération).']) +
        '<h5>Sans réseau</h5><p>TRIGONE s\'ouvre et fonctionne sans réseau. Les envois faits sans réseau partent tout seuls au retour du réseau (Paramètres › Données › <b>Envois en attente</b>).</p>', 'donnees'));

    // ---------- 15. Questions fréquentes ----------
    ajouter(chapitre(15, 'Questions fréquentes', 'Les situations les plus courantes et leur solution.', ['Connexion et code', 'Envois et destinataires', 'Notifications', 'Signaler un problème'], 'faq'));
    ajouter(page('Connexion et code', '<div class="n-faq">' +
        '<b>Le code de connexion n\'arrive pas.</b><p>Regardez les <b>courriers indésirables</b> (expéditeur noreply@trigone-app.com), attendez quelques minutes, puis « Renvoyer le code ». Seul le <b>dernier</b> code fonctionne (15 min). Sur un 2<sup>e</sup> appareil, utilisez plutôt le <b>code de liaison</b> (chapitre 3).</p>' +
        '<b>J\'ai oublié mon code d\'accès à 4 chiffres.</b><p>Aucune récupération possible : « Code oublié ? » efface TRIGONE sur l\'appareil. Restaurez ensuite depuis votre compte (sauvegarde automatique) ou un fichier.</p>' +
        '<b>L\'empreinte ne marche plus.</b><p>Touchez « Utiliser mon code ». Désactivez puis réactivez l\'empreinte dans Mon profil.</p>' +
        '<b>Rôle VALIDEUR non reconnu.</b><p>Le rôle doit être coché dans Mes rôles <b>avec son code</b>. Il suffit ensuite d\'ouvrir TRIGONE : le rôle est redéclaré tout seul.</p></div>', 'faq'));
    ajouter(page('Envois et notifications', '<div class="n-faq">' +
        '<b>« Pas encore de compte TRIGONE ».</b><p>Le destinataire doit créer son compte TRIGONE (et cocher son rôle). Votre demande reste dans vos Documents.</p>' +
        '<b>« Mauvais destinataire ».</b><p>Une demande part vers le <b>1<sup>er</sup> valideur</b>, la validation 1 vers le <b>2<sup>e</sup></b>, la validation 2 et les comptes-rendus vers l\'<b>assistant Chorus DT</b>. Vérifiez l\'adresse.</p>' +
        '<b>Je ne reçois pas les notifications.</b><p>Paramètres › Notifications › Activer, puis « tester ». Sur Android : Chrome › Batterie › « Non restreinte ». Sur iPhone : TRIGONE installé sur l\'écran d\'accueil.</p>' +
        '<b>Un souci, une idée ?</b><p>Paramètres › Aide › <b>Signaler un problème</b> : votre messagerie s\'ouvre avec la version et l\'appareil déjà indiqués.</p></div>', 'faq'));

    // ---------- 16. Protection des données ----------
    ajouter(chapitre(16, 'Protection des données et hébergement', 'Comment TRIGONE protège vos informations : ce qui reste sur votre appareil, ce qui passe par le serveur, comment c\'est chiffré, et où c\'est hébergé.',
        ['Vos données restent sur votre appareil', 'Des envois chiffrés de bout en bout', 'Signatures, codes et empreinte', 'Le serveur et l\'hébergement', 'Ce que le serveur conserve'], 'secu'));
    ajouter(page('Vos données restent chez vous', '<div class="n-secu">' +
        '<b>Sur votre appareil</b><p>Demandes, comptes-rendus, justificatifs, profil, carte et photo sont rangés <b>dans TRIGONE, sur votre téléphone ou votre PC</b>. Il n\'y a pas de base de données centrale de vos missions.</p>' +
        '<b>Un compte sans mot de passe</b><p>Le compte est votre adresse mail, vérifiée par un code à 6 chiffres (valable 15 min, 5 essais). Chaque appareil reçoit son <b>jeton d\'accès</b> ; le serveur n\'en garde qu\'une empreinte.</p>' +
        '<b>Code d\'accès et empreinte</b><p>Le code à 4 chiffres protège l\'ouverture de TRIGONE sur l\'appareil. L\'empreinte (ou le visage) est vérifiée <b>par le téléphone lui-même</b> : TRIGONE ne la reçoit jamais.</p>' +
        '<b>Mises à jour</b><p>L\'appli se met à jour depuis la source officielle à chaque ouverture : tout le monde a la même version.</p></div>', 'secu'));
    ajouter(page('Des envois chiffrés de bout en bout', '<div class="n-secu">' +
        '<b>Une clé par appareil</b><p>Chaque appareil possède sa <b>clé de chiffrement</b> (ECDH P-256). La clé privée <b>ne quitte jamais l\'appareil</b> ; le serveur ne connaît que la clé publique.</p>' +
        '<b>Chiffré avant de partir</b><p>Une demande ou un compte-rendu est chiffré <b>dans l\'appli de l\'expéditeur</b> (AES-GCM 256 bits), pour chacun des appareils du destinataire. Le serveur ne voit que des données <b>illisibles</b>, et les efface à la réception (au plus tard après 30 jours).</p>' +
        '<b>Signatures des valideurs</b><p>Chaque validation est <b>signée électroniquement</b> (ECDSA P-256) avec la clé du rôle, débloquée par le code du rôle. L\'assistant Chorus DT <b>vérifie</b> les signatures et les pièces jointes avant le PDF final : une demande modifiée en route est détectée.</p>' +
        '<b>Sauvegarde automatique</b><p>Chiffrée <b>sur votre téléphone</b> (AES-GCM 256) avec une clé tirée de votre code de récupération (PBKDF2, 310 000 tours). Le code n\'est jamais transmis : le serveur ne peut pas la lire.</p></div>', 'secu'));
    ajouter(page('Le serveur et l\'hébergement', '<div class="n-secu">' +
        '<b>Hébergement</b><p>L\'appli et son serveur sont hébergés chez <b>Cloudflare</b> (Workers) : la page de TRIGONE, la boîte aux lettres chiffrée (stockage KV et base D1). Les connexions sont toujours en <b>HTTPS</b>.</p>' +
        '<b>Envoi des codes</b><p>Le mail du code de connexion part par <b>Brevo</b>, depuis noreply@trigone-app.com, domaine authentifié (SPF, DKIM, DMARC).</p>' +
        '<b>Ce que le serveur conserve, en clair</b><p>Pour fonctionner, il garde : votre adresse et vos rôles ; l\'<b>étape</b> de suivi de vos demandes (sans leur contenu) ; votre <b>carte</b> (grade, nom, unité, NID, lisibles seulement par un compte connecté, sauf grade, nom et unité sur la page de vérification) ; le <b>registre OMR</b> de l\'unité (objet, dates, personnel, montants, réservé aux assistants Chorus DT) ; le compteur des n° OMR.</p>' +
        '<b>Erreurs de l\'appli</b><p>Une erreur technique est remontée de façon <b>anonyme</b> : jamais de nom, de mail ni de donnée de mission.</p></div>', 'secu'));
    ajouter(page('En résumé', '<div class="n-resume">' +
        ['🔒 Vos missions restent <b>sur votre appareil</b>.', '✉ Les envois sont <b>chiffrés de bout en bout</b> : seul le destinataire peut les lire.', '✍ Les validations sont <b>signées</b> et vérifiées.', '☁ La sauvegarde est <b>chiffrée sur le téléphone</b> : le serveur ne peut pas l\'ouvrir.', '👆 L\'empreinte <b>ne quitte jamais</b> le téléphone.', '🗑 Un compte supprimé efface son adresse, ses rôles et sa carte du serveur.'].map(function(x) { return '<div>' + x + '</div>'; }).join('') + '</div>' +
        attention('Protégez votre téléphone (code de verrouillage), activez le <b>code d\'accès</b> de TRIGONE et gardez votre <b>code de récupération</b> en lieu sûr.'), 'secu'));

    // ---------- Fin ----------
    ajouter(page('', '<div class="n-fin"><img src="{B}phoenix-icon.png" alt=""><div class="n-garde-t">TRIGONE</div><p>Conçu par Germain-Pierre BOUQUET<br>4°RIISC</p>' +
        '<p>Un souci, une question, une idée ?<br><b>Paramètres › Aide › Signaler un problème</b></p><p class="n-garde-note">Notice de la version ' + VERSION + '.</p></div>'));
    ajouter({ couverture: true, dos: true, html: '<div class="n-couv dos"><i class="n-couv-cadre"></i><div class="n-couv-in"><img src="{B}phoenix-icon.png" alt="" style="width:70px"></div><div class="n-couv-bas">TRIGONE · MISE EN ROUTE · COMPTE-RENDU · CHORUS DT</div></div>' });

    // Sommaire (2 pages) et numéros de page.
    var chapitres = [];
    P.forEach(function(p, i) { if (p.chapitre) chapitres.push({ n: p.chapitre.n, titre: p.chapitre.titre, page: i, id: p.ch }); });
    var ligne = function(c) { return '<li><button type="button" data-aller="' + c.page + '"><span class="n-som-n">' + c.n + '</span><span class="n-som-t">' + c.titre + '</span><i>p. ' + (c.page + 1) + '</i></button></li>'; };
    P.forEach(function(p) {
        if (p.sommaire === 1) p.html = '<div class="n-p"><div class="n-chap-n">SOMMAIRE</div><h3 style="margin-bottom:10px">Notice TRIGONE</h3><ol class="n-som">' + chapitres.slice(0, 9).map(ligne).join('') + '</ol><p class="n-garde-note">Touchez un chapitre pour y aller directement.</p></div>';
        if (p.sommaire === 2) p.html = '<div class="n-p"><div class="n-chap-n">SOMMAIRE (SUITE)</div><ol class="n-som" style="margin-top:14px">' + chapitres.slice(9).map(ligne).join('') + '</ol>' +
            '<div class="n-enc n-savoir" style="margin-top:auto"><b>À SAVOIR</b>Depuis l\'appli, le bouton <b>?</b> d\'un écran ouvre directement le bon chapitre.</div></div>';
    });
    // Titre courant en haut des pages d'un chapitre.
    var titres = {}; chapitres.forEach(function(c) { titres[c.id] = c.n + ' · ' + c.titre; });
    P.forEach(function(p) { if (p.ch && !p.chapitre && titres[p.ch]) p.html = p.html.replace('<div class="n-p">', '<div class="n-p"><div class="n-tete">' + titres[p.ch] + '</div>'); });

    // Mise en forme du livret (page de 400 × 566, agrandie à l'écran par la visionneuse).
    var OR = '#b8862f', ENCRE = '#1d1a14';
    var css =
        '.JUM-NOTICE { background: radial-gradient(120% 80% at 50% 0%, #2b2b2b, #141414 60%, #0b0b0b); padding: 0; display: block; z-index: 99996; overflow: hidden; touch-action: none; }' +
        '.N-HAUT { position: absolute; top: 0; left: 0; right: 0; height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 10px; color: #e2b866; z-index: 3; }' +
        '.N-HAUT button { background: rgba(255,255,255,0.08); color: #f1e3c0; border: 1px solid rgba(226,184,102,0.35); border-radius: 999px; height: 34px; padding: 0 14px; font: 700 13px Montserrat, system-ui, sans-serif; cursor: pointer; }' +
        '.N-HAUT .N-FERMER { width: 34px; padding: 0; font-size: 16px; }' +
        '.N-HAUT .N-TITRE { flex: 1; font: italic 400 16px Georgia, serif; letter-spacing: .04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
        '.N-HAUT .N-NUM { font: 700 12px Montserrat, system-ui, sans-serif; color: #b8955a; min-width: 44px; text-align: right; }' +
        '.N-SCENE { position: absolute; top: 48px; left: 0; right: 0; bottom: 0; display: flex; align-items: flex-start; justify-content: center; overflow: hidden; }' +
        '.N-FLECHE { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 64px; border: 0; border-radius: 10px; background: rgba(255,255,255,0.07); color: #e2b866; font-size: 34px; line-height: 1; cursor: pointer; z-index: 3; }' +
        '.N-FLECHE:disabled { opacity: .25; cursor: default; } .N-PREC { left: 10px; } .N-SUIV { right: 10px; }' +
        '.JUM-NOTICE.tel .N-SCENE { bottom: 52px; } .JUM-NOTICE.tel .N-FLECHE { top: auto; bottom: 6px; transform: none; width: 84px; height: 40px; font-size: 26px; border-radius: 999px; }' +
        '.JUM-NOTICE.tel .N-PREC { left: 12px; } .JUM-NOTICE.tel .N-SUIV { right: 12px; }' +
        '.N-CHARGE { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #e2b866; font: italic 16px Georgia, serif; text-align: center; padding: 30px; }' +
        '.N-PAGE { background: #fbf8f1; overflow: hidden; }' +
        '.N-PAGE.--left { box-shadow: inset -12px 0 20px -14px rgba(0,0,0,.35); } .N-PAGE.--right { box-shadow: inset 12px 0 20px -14px rgba(0,0,0,.35); }' +
        '.N-ECH { position: absolute; left: 0; top: 0; width: 400px; height: 566px; transform-origin: 0 0; font-family: Montserrat, system-ui, sans-serif; color: ' + ENCRE + '; }' +
        '.N-ECH * { box-sizing: border-box; } .N-ECH button * { pointer-events: none; }' +
        '.N-NUMP { position: absolute; bottom: 12px; left: 0; right: 0; text-align: center; font: 700 9.5px Montserrat, system-ui, sans-serif; letter-spacing: .14em; color: #a08b62; }' +
        // Couverture « cuir et dorure »
        '.n-couv { position: absolute; inset: 0; background: radial-gradient(120% 90% at 30% 10%, #3b2a1c, #20160e 60%, #120c08); overflow: hidden; }' +
        '.n-couv::before { content: ""; position: absolute; inset: 0; opacity: .35; background-image: radial-gradient(rgba(255,255,255,.05) 1px, transparent 1.5px); background-size: 4px 4px; }' +
        '.n-couv-cadre { position: absolute; inset: 18px; border: 1.5px solid #c9a24f; border-radius: 4px; } .n-couv-cadre::after { content: ""; position: absolute; inset: 6px; border: .6px solid rgba(201,162,79,.6); }' +
        '.n-coin { position: absolute; width: 26px; height: 26px; border: 2px solid #e2b866; }' +
        '.n-coin.a { top: 30px; left: 30px; border-right: 0; border-bottom: 0; } .n-coin.b { top: 30px; right: 30px; border-left: 0; border-bottom: 0; } .n-coin.c { bottom: 30px; left: 30px; border-right: 0; border-top: 0; } .n-coin.d { bottom: 30px; right: 30px; border-left: 0; border-top: 0; }' +
        '.n-couv-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #e2b866; text-align: center; }' +
        '.n-couv img { width: 150px; filter: brightness(0) saturate(100%) invert(76%) sepia(43%) saturate(560%) hue-rotate(352deg) brightness(95%); }' +
        '.n-couv h1 { font: 400 40px Georgia, serif; letter-spacing: .18em; margin: 18px 0 0 .18em; text-shadow: 0 1px 0 #6b4f1f, 0 -1px 0 #ffe7b0; }' +
        '.n-couv h2 { font: italic 400 22px Georgia, serif; margin: 8px 0 0; color: #d9c08a; }' +
        '.n-couv-bas { position: absolute; bottom: 52px; left: 0; right: 0; text-align: center; font: 700 10px Montserrat, sans-serif; letter-spacing: .3em; color: #b8955a; }' +
        '.n-couv.dos .n-couv-bas { letter-spacing: .16em; font-size: 8.5px; }' +
        // Pages
        '.n-p { position: absolute; inset: 0; padding: 26px 22px 34px; display: flex; flex-direction: column; font-size: 10.6px; line-height: 1.45; }' +
        '.n-p b { font-weight: 800; } .n-p p { margin: 0 0 7px; }' +
        '.n-tete { font: 700 7.5px Montserrat, sans-serif; letter-spacing: .16em; color: #a08b62; text-transform: uppercase; margin: -12px 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
        '.n-p h4 { font-size: 15px; font-weight: 800; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid ' + OR + '; }' +
        '.n-p h5 { font-size: 11px; font-weight: 800; margin: 8px 0 4px; color: #7a5a1c; text-transform: uppercase; letter-spacing: .05em; }' +
        '.n-r { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; background: #d6a756; color: #1a1a1a; font-size: 9px; font-weight: 800; vertical-align: 1px; box-shadow: 0 0 0 1.5px #fff, 0 1px 3px rgba(0,0,0,.35); }' +
        '.n-et { list-style: none; counter-reset: e; padding: 0; margin: 0 0 6px; }' +
        '.n-et li { counter-increment: e; position: relative; padding: 0 0 0 22px; margin: 0 0 6px; }' +
        '.n-et li::before { content: counter(e); position: absolute; left: 0; top: 0; width: 16px; height: 16px; border-radius: 4px; background: ' + ENCRE + '; color: #e2b866; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; }' +
        '.n-duo { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }' +
        '.n-capt { position: relative; width: 43%; flex-shrink: 0; padding: 0; border-radius: 10px; border: 1px solid #d9ccb0; box-shadow: 0 6px 16px rgba(0,0,0,.18); background: #fff; overflow: hidden; cursor: zoom-in; line-height: 0; }' +
        '.n-capt img { width: 100%; display: block; } .n-capt i { position: absolute; right: 4px; bottom: 4px; width: 18px; height: 18px; border-radius: 50%; background: rgba(29,26,20,.8); color: #e2b866; font: 700 11px/18px sans-serif; font-style: normal; text-align: center; }' +
        '.haut .n-capt { width: 50%; } .haut .n-p { font-size: 11.4px; line-height: 1.5; } .haut .n-et li { margin-bottom: 8px; }' +
        '.n-p h3 { font: 400 22px Georgia, serif; margin: 6px 0 0; }' +
        '.N-ZOOM { position: absolute; inset: 0; z-index: 5; background: rgba(0,0,0,.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 12px; cursor: zoom-out; }' +
        '.N-ZOOM img { max-width: 100%; max-height: calc(100% - 36px); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.6); } .N-ZOOM span { color: #cdb488; font: 600 12px Montserrat, sans-serif; }' +
        '.n-txt { flex: 1; min-width: 0; }' +
        '.n-enc { margin-top: auto; border-radius: 8px; padding: 8px 10px; font-size: 10px; line-height: 1.45; }' +
        '.n-enc > b:first-child { display: block; font-size: 8.5px; letter-spacing: .16em; margin-bottom: 2px; }' +
        '.n-savoir { background: #f1e8d3; border-left: 4px solid ' + OR + '; } .n-savoir > b:first-child { color: #8a6420; }' +
        '.n-att { background: #fbe4e1; border-left: 4px solid #c0392b; } .n-att > b:first-child { color: #b03024; }' +
        '.n-enc + .n-enc { margin-top: 6px; }' +
        '.n-astuce { display: flex; gap: 8px; align-items: flex-end; background: #f1e8d3; } .n-astuce img { width: 46px; margin: -22px 0 -8px -4px; } .n-astuce b { color: #8a6420; }' +
        // Pages de chapitre
        '.n-chap { padding: 54px 34px 40px; background: linear-gradient(180deg, #f6efe0, #fbf8f1 40%); }' +
        '.n-chap-n { font-size: 9.5px; font-weight: 800; letter-spacing: .3em; color: ' + OR + '; }' +
        '.n-chap h3 { font: 400 25px/1.2 Georgia, serif; margin: 10px 0 0; }' +
        '.n-chap-trait { width: 60px; height: 2px; background: ' + OR + '; margin: 18px 0; }' +
        '.n-chap-res { font-size: 11.5px; line-height: 1.6; color: #4a4232; }' +
        '.n-chap-dans { margin-top: 14px; font-size: 8.5px; font-weight: 800; letter-spacing: .2em; color: #a08b62; }' +
        '.n-chap ul { list-style: none; padding: 0; margin: 6px 0 0; } .n-chap li { padding: 5px 0 5px 16px; border-bottom: 1px dashed #e2d6bd; position: relative; font-weight: 700; font-size: 10.8px; }' +
        '.n-chap li::before { content: "›"; position: absolute; left: 2px; color: ' + OR + '; font-weight: 800; }' +
        '.n-chap-fili { position: absolute; right: 26px; bottom: 34px; width: 54px; opacity: .1; }' +
        // Garde, sommaire, fin
        '.n-garde, .n-fin { display: flex; flex-direction: column; align-items: center; text-align: center; height: 100%; }' +
        '.n-garde img, .n-fin img { width: 62px; margin-top: 8px; } .n-garde-t { font: 400 24px Georgia, serif; letter-spacing: .2em; margin: 8px 0 0 .2em; }' +
        '.n-garde-s { font-size: 9px; font-weight: 800; letter-spacing: .3em; color: ' + OR + '; margin: 4px 0 10px; }' +
        '.n-garde-cadre { text-align: left; border: 1px solid #d9ccb0; border-radius: 8px; padding: 10px 12px; margin: 6px 0 10px; background: #fff; }' +
        '.n-garde-cadre > b:first-child { display: block; font-size: 9px; letter-spacing: .16em; color: #8a6420; margin-bottom: 4px; }' +
        '.n-ex-savoir, .n-ex-att { display: inline-block; font-size: 8px; font-weight: 800; letter-spacing: .12em; padding: 1px 6px; border-radius: 3px; margin: 4px 4px 0 0; }' +
        '.n-ex-savoir { background: #f1e8d3; color: #8a6420; border-left: 3px solid ' + OR + '; } .n-ex-att { background: #fbe4e1; color: #b03024; border-left: 3px solid #c0392b; }' +
        '.n-garde-note { font-size: 9px; color: #7a6a4a; margin: 0 0 6px; }' +
        '.n-fin { justify-content: center; gap: 4px; } .n-fin p { font-size: 11px; margin: 10px 0 0; }' +
        '.n-som { list-style: none; padding: 0; margin: 6px 0 10px; }' +
        '.n-som button { width: 100%; display: flex; align-items: center; gap: 10px; background: none; border: 0; border-bottom: 1px dashed #e2d6bd; padding: 8px 0; font: 700 11.5px Montserrat, system-ui, sans-serif; color: ' + ENCRE + '; text-align: left; cursor: pointer; }' +
        '.n-som-n { width: 22px; height: 22px; border-radius: 50%; background: ' + ENCRE + '; color: #e2b866; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }' +
        '.n-som-t { flex: 1; } .n-som i { font-style: normal; color: ' + OR + '; font-size: 10.5px; }' +
        // Pages particulières
        '.n-trois > div { border-radius: 8px; padding: 9px 11px; margin-bottom: 8px; background: #fff; border: 1px solid #d9ccb0; }' +
        '.n-trois b { display: block; font-size: 11.5px; } .n-trois span { display: block; font-size: 8px; font-weight: 800; letter-spacing: .16em; color: #a08b62; margin: 1px 0 3px; }' +
        '.n-trois .noir { background: #1d1a14; color: #f1e8d3; border-color: #1d1a14; } .n-trois .or { background: linear-gradient(135deg, #f3dca6, #d9b064); border-color: #c99743; }' +
        '.n-circuit > div { background: #fff; border: 1px solid #d9ccb0; border-radius: 7px; padding: 5px 9px; font-size: 9.8px; line-height: 1.35; }' +
        '.n-circuit > div > b:first-child { margin-right: 4px; } .n-circuit > i { display: block; text-align: center; color: ' + OR + '; font-size: 8px; font-style: normal; line-height: 1.3; }' +
        '.n-faq > b { display: block; font-size: 11px; margin-top: 4px; color: #7a5a1c; } .n-faq p { margin: 2px 0 8px; }' +
        '.n-secu > b { display: block; font-size: 11px; margin-top: 2px; padding-left: 8px; border-left: 3px solid ' + OR + '; } .n-secu p { margin: 3px 0 9px; font-size: 10.2px; }' +
        '.n-resume > div { background: #fff; border: 1px solid #d9ccb0; border-radius: 7px; padding: 8px 10px; margin-bottom: 6px; font-size: 11px; }';
    window.NOTICE_TRIGONE = { version: VERSION, pages: P, chapitres: chapitres, css: css };
})();
