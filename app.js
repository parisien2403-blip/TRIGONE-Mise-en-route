// ===================== TRIGONE MISE EN ROUTE — logique =====================
var MER_VERSION = 1;          // version du format des fichiers .json échangés
// Version du code de l'appli : à augmenter à chaque publication, avec « appCodeVersion » dans updates-manifest.json.
var APP_CODE_VERSION = 229;
// Numéro de version affiché (« V1 », « V2 »…) : repart de 1 au lancement de TRIGONE jumelé et suit ensuite chaque
// publication. APP_CODE_VERSION reste le compteur interne des mises à jour (ne jamais le faire redescendre).
var APP_VERSION_AFFICHEE = APP_CODE_VERSION - 48;
var STORAGE_PANIER = 'mer_panier';
var STORAGE_BROUILLON = 'mer_brouillon';
var STORAGE_REGLAGES = 'mer_reglages';

var MOYENS = { SERVICE: 'Véhicule de service', CIVILE: 'Voie routière civile (VRC)', FERREE: 'Voie ferrée', AERIENNE: 'Voie aérienne', MARITIME: 'Voie maritime' };
// Libellés des lieux selon le moyen de transport : gare, aéroport, port ; lieu pour la route.
var MER_LIEUX_MOYEN = {
    FERREE: ['Gare de départ', 'Gare d\'arrivée'],
    AERIENNE: ['Aéroport de départ', 'Aéroport d\'arrivée'],
    MARITIME: ['Port de départ', 'Port d\'arrivée']
};
function LIBELLES_LIEUX(moyen) { return MER_LIEUX_MOYEN[moyen] || ['Lieu de départ', 'Lieu d\'arrivée']; }
// Voie routière civile : demande d'autorisation VRC, carte grise et assurance à joindre.
function UTILISE_VRC(d) {
    var t = d.trajets || {};
    return ['aller', 'retour'].concat(t.intermediaireAllerActif ? ['intermediaireAller'] : [], t.intermediaireRetourActif ? ['intermediaireRetour'] : [])
        .some(function(k) { return t[k] && t[k].moyen === 'CIVILE'; });
}
var MER_PIECES_VRC = 'la demande d\'autorisation VRC, la carte grise et l\'attestation d\'assurance du véhicule';

// Échappe le texte inséré dans le HTML (les demandes importées viennent d'autres personnes).
function ESC(v) {
    return (v == null ? '' : v + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function VIDE_TRAJET() { return { moyen: '', lieuDep: '', cpDep: '', paysDep: '', dateDep: '', lieuArr: '', cpArr: '', paysArr: '', dateArr: '' }; }
function VIDE_PERSONNE() { return { unite: '', cie: '', grade: '', nom: '', prenom: '', matricule: '' }; }
function VIDE_DEMANDE() {
    return {
        id: 'd' + Date.now() + Math.random().toString(36).slice(2, 6),
        type: 'MISSION',
        objet: '',
        personnes: [VIDE_PERSONNE()],
        trajets: {
            aller: VIDE_TRAJET(), retour: VIDE_TRAJET(),
            intermediaireAllerActif: false, intermediaireAller: VIDE_TRAJET(),
            intermediaireRetourActif: false, intermediaireRetour: VIDE_TRAJET(),
            retourAuto: true      // le retour reprend l'aller inversé tant que le missionnaire ne le modifie pas
        },
        resaHeberg: false, resaTransport: false, nourriDeplacement: false, transportCommun: false, autresDeplacement: false, autresDeplacementTexte: '',
        nourriMission: false, logeMission: false,
        demandeAvance: false,
        missionImputee: true,
        codeFD: '',
        piecesJointes: ''
    };
}

var D = VIDE_DEMANDE();          // demande en cours de saisie
var PAGE_ACTUELLE = 'ACCUEIL';
var MER_TABS_ORDRE = ['IDENTITE', 'ALLER', 'RETOUR', 'CONDITIONS', 'IMPUTATION'];
var MER_TABS_LABELS = { IDENTITE: 'Identité', ALLER: 'Aller', RETOUR: 'Retour', CONDITIONS: 'Alim./Héb.', IMPUTATION: 'Imputation' };
// Lieu de départ / de retour de mission, comme dans TRIGONE compte-rendu.
var MER_RESIDENCES = { ADMINISTRATIVE: 'Résidence administrative', FAMILIALE: 'Résidence familiale' };
var MER_ACTIVE_TAB = 'IDENTITE';

function GET_REGLAGES() {
    if (DEMO_ACTIF) return DEMO_REGLAGES;
    try { return JSON.parse(localStorage.getItem(STORAGE_REGLAGES) || '{}'); } catch (e) { return {}; }
}
function SAVE_REGLAGES(r) {
    if (DEMO_ACTIF) return;
    try { localStorage.setItem(STORAGE_REGLAGES, JSON.stringify(r)); } catch (e) {}
    if (r && r.identite) IDENTITE_VERS_COMPTE_RENDU(r.identite);
}
// Jumelage : l'identité est saisie une seule fois. Chaque modification ici est reportée dans TRIGONE
// Compte-rendu de mission (dossier cr/), qui fait de même dans l'autre sens. Matricule 067 50 10 191 → NID 06 750 101 91.
function IDENTITE_VERS_COMPTE_RENDU(id) {
    function ecrire(cle, val) { try { if (val) localStorage.setItem(cle, val); } catch (e) {} }
    var ch = String(id.matricule || '').replace(/\D/g, '');
    ecrire('mission_saved_user', [(id.nom || '').trim().toUpperCase(), (id.prenom || '').trim()].filter(Boolean).join(' '));
    ecrire('mission_saved_grade', (id.grade || '').trim());
    if (ch.length === 10) ecrire('mission_saved_nid', [ch.slice(0, 2), ch.slice(2, 5), ch.slice(5, 8), ch.slice(8)].join(' '));
    ecrire('mission_saved_cie', (id.cie || '').trim());
}
// Identité déjà saisie dans Compte-rendu mais pas encore ici : reprise au démarrage.
function IDENTITE_DEPUIS_COMPTE_RENDU() {
    var r = GET_REGLAGES(), id = r.identite || {};
    if (id.nom || id.grade || id.matricule) return;
    function lire(cle) { try { return (localStorage.getItem(cle) || '').trim(); } catch (e) { return ''; } }
    var nomComplet = lire('mission_saved_user'), grade = lire('mission_saved_grade'), nid = lire('mission_saved_nid').replace(/\D/g, ''), cie = lire('mission_saved_cie');
    if (!nomComplet && !grade && !nid) return;
    var morceaux = nomComplet.split(/\s+/);
    id = { nom: (morceaux[0] || '').toUpperCase(), prenom: morceaux.slice(1).join(' '), grade: grade, cie: cie,
        matricule: nid.length === 10 ? FORMAT_MATRICULE(nid) : '' };
    r.identite = id;
    try { localStorage.setItem(STORAGE_REGLAGES, JSON.stringify(r)); } catch (e) {}
}

function GET_PANIER() {
    if (DEMO_ACTIF) return DEMO_PANIER;
    try { return JSON.parse(localStorage.getItem(STORAGE_PANIER) || '[]'); } catch (e) { return []; }
}
function SAVE_PANIER(liste) { if (DEMO_ACTIF) return; try { localStorage.setItem(STORAGE_PANIER, JSON.stringify(liste)); } catch (e) {} }

// Le brouillon en cours est sauvegardé à chaque frappe, exactement comme TRIGONE compte-rendu : fermer
// l'application en pleine saisie ne doit rien faire perdre.
function SAVE_BROUILLON() {
    if (DEMO_ACTIF || window.JUMELAGE_RESTAURATION_EN_COURS) return;
    try { localStorage.setItem(STORAGE_BROUILLON, JSON.stringify({ demande: D, onglet: MER_ACTIVE_TAB })); } catch (e) {}
}
function LOAD_BROUILLON() {
    try {
        var raw = localStorage.getItem(STORAGE_BROUILLON);
        if (raw) {
            var sauvegarde = JSON.parse(raw);
            D = sauvegarde.demande || sauvegarde;   // compatibilité avec un ancien format de brouillon
            if (sauvegarde.onglet) MER_ACTIVE_TAB = sauvegarde.onglet === 'TRAJETS' ? 'ALLER' : sauvegarde.onglet;
            if (MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB) === -1) MER_ACTIVE_TAB = 'IDENTITE';
        }
    } catch (e) {}
}
// Demande commencée et pas encore rangée dans Documents : l'appli propose de la reprendre (comme TRIGONE compte-rendu).
function BROUILLON_EN_COURS() {
    if (DEMO_ACTIF) return false;
    try { if (!localStorage.getItem(STORAGE_BROUILLON)) return false; } catch (e) { return false; }
    var t = D.trajets || {}, a = t.aller || {};
    return !!(D.objet || a.lieuDep || a.moyen || a.residenceDep || D.codeFD || (D.pieces || []).length ||
        D.personnes.length > 1 || MER_ACTIVE_TAB !== 'IDENTITE');
}
function TPL_REPRISE() {
    var r = RESUME_DEMANDE(D), etape = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB) + 1;
    return '<div class="CARD"><h2>Demande en cours</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Reprise de votre demande de mise en route</p>' +
        '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<span class="MER-BADGE">Étape ' + etape + ' / 5 — ' + ESC(MER_TABS_LABELS[MER_ACTIVE_TAB]) + '</span>' +
            '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(r.noms) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(r.sous) + '</div></div></div>' +
        '<p class="MER-HINT" style="margin:0 0 14px;">Votre saisie a été conservée : reprenez là où vous vous étiez arrêté, ou revenez à l\'accueil (la demande reste enregistrée).</p>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="SHOW_PAGE(\'FORMULAIRE\')">Continuer la demande</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" style="margin-top:8px;" onclick="SHOW_PAGE(\'ACCUEIL\')">Retour à l\'accueil</button></div>';
}
function CLEAR_BROUILLON() { try { localStorage.removeItem(STORAGE_BROUILLON); } catch (e) {} D = VIDE_DEMANDE(); MER_ACTIVE_TAB = 'IDENTITE'; }

function TOGGLE_THEME() {
    document.body.classList.toggle('dark-mode');
    var dark = document.body.classList.contains('dark-mode');
    try { localStorage.setItem('mer_dark', dark ? '1' : '0'); } catch (e) {}
    if (window.JUMELAGE_THEME) JUMELAGE_THEME(dark);
}
function APPLIQUER_THEME_INITIAL() {
    var dark = false;
    try { dark = localStorage.getItem('mer_dark') === '1'; } catch (e) {}
    var commun = window.JUMELAGE_THEME ? JUMELAGE_THEME() : null;   // choix fait dans l'une ou l'autre appli
    if (commun !== null) dark = commun;
    if (dark) document.body.classList.add('dark-mode');
}

// ===================== PAGE ACCUEIL =====================
function SHOW_PAGE(page) {
    if (page !== 'CHORUS' && page !== 'VERIFIER') MER_ESPACE_CHORUS = false;
    if (page !== 'BIBLIOTHEQUE') MER_BIB_SELECTION = null;
    if (page !== PAGE_ACTUELLE) MER_RECU_SELECTION = null;
    PAGE_ACTUELLE = page;
    // Bouton de compte (jumelage.js) : sur l'accueil seulement.
    if (window.JUMELAGE_BOUTON_APPLI) JUMELAGE_BOUTON_APPLI(page === 'ACCUEIL');
    var zone = document.getElementById('PAGE-STAGE');
    zone.classList.toggle('avec-marge', page !== 'ACCUEIL');
    if (page === 'ACCUEIL') zone.innerHTML = TPL_ACCUEIL();
    else if (page === 'FORMULAIRE') zone.innerHTML = TPL_PAGE_FORMULAIRE();
    else if (page === 'PANIER') zone.innerHTML = TPL_PANIER();
    else if (page === 'VALIDATION') { OUVRIR_VALIDATION(); return; }
    else if (page === 'VERIFIER' && MER_ESPACE_CHORUS) { SHOW_PAGE('CHORUS'); return; }
    else if (page === 'CHORUS') { MER_ESPACE_CHORUS = true; zone.innerHTML = TPL_CHORUS(); }
    else if (page === 'VERIFIER') zone.innerHTML = TPL_VERIFIER();
    else if (page === 'RECEPTION') zone.innerHTML = TPL_RECEPTION();
    else if (page === 'BIBLIOTHEQUE') zone.innerHTML = TPL_BIBLIOTHEQUE();
    else if (page === 'ESPACE') zone.innerHTML = TPL_MON_ESPACE();
    else if (page === 'NOTICE') zone.innerHTML = TPL_NOTICE();
    else if (page === 'REPRISE') zone.innerHTML = TPL_REPRISE();
    else if (page === 'REFERENCES') { zone.innerHTML = TPL_REFERENCES(); CHARGER_CODIER().then(function(c) { if (c && PAGE_ACTUELLE === 'REFERENCES') zone.innerHTML = TPL_REFERENCES(); }); }
    RENDRE_MENU_PC();
    window.scrollTo(0, 0);
}

var MER_ICONES = {
    BIBLIOTHEQUE: '<svg viewBox="0 0 24 24"><path d="M12 6.3c-1.7-1.3-3.9-2-6.3-2A2 2 0 0 0 3.7 6.3v10.9a2 2 0 0 0 2 2c2.2 0 4.3.6 6 1.8M12 6.3c1.7-1.3 3.9-2 6.3-2a2 2 0 0 1 2 2v10.9a2 2 0 0 1-2 2c-2.2 0-4.3.6-6 1.8M12 6.3v14.7"/></svg>',
    PANIER: '<svg viewBox="0 0 24 24"><path d="M3 7.5a2 2 0 0 1 2-2h4.2l2 2.2H19a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13.5h8M8 16.5h5"/></svg>',
    ESPACE: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.4"/><path d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3"/></svg>',
    NOTICE: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 15.7v-5M12 8h.01"/></svg>',
    CHORUS: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14.5l2 2 4-4"/></svg>'
};
// ===================== FORMAT PC (écran large) =====================
// À partir de 1100 px de large : menu à gauche à la place de la barre du bas, accueil en tableau de bord,
// formulaire accompagné d'un récapitulatif, Espace valideur en tableau avec le détail à côté. En dessous (téléphones, tablettes), rien ne change. La démonstration suit l'écran.
var MER_PC_MQ = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : null;
function EST_PC() { return !!(MER_PC_MQ && MER_PC_MQ.matches); }
MER_ICONES.ACCUEIL = '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>';
MER_ICONES.REFERENCES = '<svg viewBox="0 0 24 24"><path d="M6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H19"/><path d="M8.5 7.5h6M8.5 11h4"/></svg>';
MER_ICONES.MAJ = '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/></svg>';
MER_ICONES.RECEPTION = '<svg viewBox="0 0 24 24"><path d="M3 13.5l2.6-7.6A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.4l2.6 7.6"/><path d="M3 13.5v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4h-5.2l-1.3 2.3h-5l-1.3-2.3z"/></svg>';
MER_ICONES.REGISTRE = '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 9.5h7M8.5 13h7M8.5 16.5h4.5"/></svg>';
MER_ICONES.PDF = '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14.5l2 2 4-4.5"/></svg>';
MER_ICONES.VALIDEUR = '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

function TPL_MENU_PC() {
    var actif = { REFERENCES: 'REFERENCES', ACCUEIL: 'ACCUEIL', REPRISE: 'ACCUEIL', BIBLIOTHEQUE: 'BIBLIOTHEQUE', PANIER: 'PANIER', NOTICE: 'NOTICE', ESPACE: 'ESPACE', VALIDATION: 'VALIDATION', VERIFIER: 'VALIDATION', RECEPTION: 'RECEPTION', CHORUS: 'CHORUS' }[PAGE_ACTUELLE] || '';
    var n = GET_PANIER().length;
    function item(page, icone, libelle, pastille) {
        return '<button type="button" class="PC-NAV' + (actif === page ? ' actif' : '') + '" onclick="SHOW_PAGE(\'' + page + '\')">' + icone +
            '<span>' + libelle + '</span>' + (pastille ? '<span class="PC-PASTILLE">' + pastille + '</span>' : '') + '</button>';
    }
    // Menu de travail seulement : profil, notice, références, mise à jour, signalement et sauvegarde sont dans le
    // menu du compte (en haut du menu, jumelage.js).
    // Espace Assist Chorus DT (choisi sur l'écran de choix) : son logo et ses entrées, pas celles de Mise en route.
    if (MER_ESPACE_CHORUS) {
        var dos = MER_DOSSIER.CHORUS;
        var itemC = function(actifC, onclick, icone, libelle, pastille) {
            return '<button type="button" class="PC-NAV' + (actifC ? ' actif' : '') + '" onclick="' + onclick + '">' + icone +
                '<span>' + libelle + '</span>' + (pastille ? '<span class="PC-PASTILLE">' + pastille + '</span>' : '') + '</button>';
        };
        return '<button type="button" class="PC-MARQUE PC-MARQUE-CHORUS" onclick="MER_RESULTATS_VERIF = null; JUMELAGE_CHOIX()" title="Revenir à l\'écran de choix"><img src="logo_chorus.webp" alt="TRIGONE Assist Chorus-DT">' + (MER_ADMIN() ? '<span class="PC-MARQUE-ADMIN">ADMINISTRATEUR</span>' : '') + '</button>' +
            '<div class="PC-COMPTE-SLOT"></div>' +
            itemC(!dos, 'MER_RESULTATS_VERIF = null; MER_DOSSIER.CHORUS = null; SHOW_PAGE(\'CHORUS\')', MER_ICONES.ACCUEIL, 'Accueil Chorus DT', MER_NB_CHORUS() || '') +
            (MER_COMPTE_ACTIF() ? itemC(dos === 'registre', 'MER_RESULTATS_VERIF = null; OUVRIR_REGISTRE(\'tout\')', MER_ICONES.REGISTRE, 'Registre des OMR') : '') +
            itemC(false, 'MER_RESULTATS_VERIF = null; MER_DOSSIER.CHORUS = null; SHOW_PAGE(\'CHORUS\'); setTimeout(function() { var b = document.querySelector(\'#PAGE-STAGE input[type=file]\'); if (b) b.click(); }, 50)', MER_ICONES.PDF, 'Contrôler un PDF') +
            '<div class="PC-BAS">' + (window.JUMELAGE_NOTICE_BOUTON ? JUMELAGE_NOTICE_BOUTON() : '') +
                '<button type="button" class="PC-BASCULE" onclick="SHOW_PAGE(\'ACCUEIL\')"><img src="logo_mer.webp" alt=""><span>Passer à Mise en route</span></button>' +
                '<button type="button" class="PC-BASCULE" onclick="JUMELAGE_ALLER(\'cr\')"><img src="cr/logo_cr_accueil.png" alt=""><span>Passer au Compte-rendu</span></button>' +
                '<div class="PC-PIED"><span>G.-P. BOUQUET</span><span>V' + APP_VERSION_AFFICHEE + '</span></div>' +
            '</div>';
    }
    return '<button type="button" class="PC-MARQUE" onclick="JUMELAGE_CHOIX()" title="Revenir au choix Mise en route / Compte-rendu"><img src="logo_mer.webp" alt="TRIGONE Mise en route"></button>' +
        '<div class="PC-COMPTE-SLOT"></div>' +
        item('ACCUEIL', MER_ICONES.ACCUEIL, 'Accueil') +
        (MER_COMPTE_ACTIF() ? item('RECEPTION', MER_ICONES.RECEPTION, 'Boîte de réception', MER_NB_BOITE() || '') : '') +
        item('BIBLIOTHEQUE', MER_ICONES.BIBLIOTHEQUE, 'Bibliothèque') +
        item('PANIER', MER_ICONES.PANIER, 'Documents', n || '') +
        (MER_EST_VALIDEUR() ? '<div class="PC-SEP"></div>' + item('VALIDATION', MER_ICONES.VALIDEUR, 'Espace valideur', MER_NB_A_SIGNER() || '') : '') +
        '<div class="PC-BAS">' + (window.JUMELAGE_NOTICE_BOUTON ? JUMELAGE_NOTICE_BOUTON() : '') +
            '<button type="button" class="PC-BASCULE" onclick="JUMELAGE_ALLER(\'cr\')"><img src="cr/logo_cr_accueil.png" alt=""><span>Passer au Compte-rendu</span></button>' +
            '<div class="PC-PIED"><span>G.-P. BOUQUET</span><span>V' + APP_VERSION_AFFICHEE + '</span></div>' +
        '</div>';
}
function RENDRE_MENU_PC() {
    var m = document.getElementById('PC-MENU');
    if (m) m.innerHTML = EST_PC() ? TPL_MENU_PC() : '';
    if (m && EST_PC() && window.JUMELAGE_PLACER_COMPTE) JUMELAGE_PLACER_COMPTE(m);
}
// Passage téléphone ⇄ PC (fenêtre redimensionnée, écran pliable) : l'affichage suit.
if (MER_PC_MQ) {
    var MER_PC_CHANGE = function() {
        RENDRE_MENU_PC();
        if (PAGE_ACTUELLE === 'ACCUEIL') SHOW_PAGE('ACCUEIL');
        else if (PAGE_ACTUELLE === 'FORMULAIRE') RENDER_FORMULAIRE_INPLACE();
        else if (PAGE_ACTUELLE === 'VALIDATION') RENDER_VALIDATION_INPLACE();
    };
    if (MER_PC_MQ.addEventListener) MER_PC_MQ.addEventListener('change', MER_PC_CHANGE); else if (MER_PC_MQ.addListener) MER_PC_MQ.addListener(MER_PC_CHANGE);
}

// « GRADE NOM Prénom » pour le « Bonjour » de l'accueil (identité de Mon espace, sinon celle des Réglages TRIGONE).
function MER_QUI() {
    var id = GET_REGLAGES().identite || {}, qui = [id.grade, id.nom, id.prenom].filter(Boolean).join(' ');
    return qui || (window.JUMELAGE_QUI ? JUMELAGE_QUI() : '');
}
// ---------- Accueil PC ----------
function TPL_ACCUEIL_PC() {
    var id = GET_REGLAGES().identite || {}, panier = GET_PANIER(), bib = DEMO_ACTIF ? [] : GET_BIBLIOTHEQUE().slice(0, 5);
    var qui = MER_QUI();
    function ligne(badge, classe, titre, droite, action) {
        return '<button type="button" class="PC-LIGNE" onclick="' + action + '"><span class="PC-BADGE ' + classe + '">' + badge + '</span>' +
            '<b>' + ESC(titre) + '</b><span class="PC-LIGNE-DROITE">' + ESC(droite) + '</span></button>';
    }
    var envois = bib.length ? bib.map(function(e) {
        var d = e.demandes[0] || {}, a = (d.trajets && d.trajets.aller) || {};
        var objet = e.demandes.map(function(x) { return x.objet || 'Mise en route'; }).join(' · ');
        return ligne('Envoyée le ' + new Date(e.envoyeLe).toLocaleDateString('fr-FR'), '', objet,
            [a.lieuArr || a.paysArr || '', a.dateDep ? FORMAT_DATE_COURT(a.dateDep) : ''].filter(Boolean).join(' · '), 'SHOW_PAGE(\'BIBLIOTHEQUE\')');
    }).join('')
        : '<div class="PC-VIDE">Aucune demande envoyée pour l\'instant.</div>';
    var attente = panier.length ? panier.map(function(d) {
        var n = (d.personnes || []).length, a = (d.trajets && d.trajets.aller) || {};
        return ligne(n > 1 ? 'Collective · ' + n + ' pers.' : 'Individuelle', 'PC-BADGE-GRIS', d.objet || 'Mise en route',
            a.dateDep ? FORMAT_DATE_COURT(a.dateDep) : '', 'SHOW_PAGE(\'PANIER\')');
    }).join('') + '<button type="button" class="BTN BTN-PRIMARY" style="margin-top:14px;" onclick="SHOW_PAGE(\'PANIER\')">📨 Ouvrir mes documents et transmettre</button>'
        : '<div class="PC-VIDE">Aucune demande en attente d\'envoi.</div>';
    return '<div class="PC-PAGE">' +
        '<h1 class="PC-TITRE">' + (qui ? 'Bonjour, ' + ESC(qui) : 'Bienvenue') + '</h1>' +
        '<p class="PC-SOUS">Mise en route — préparez votre ordre de mission avant le départ.</p>' +
        '<div class="PC-CARTE PC-HERO">' +
            '<img src="logo_mer.webp" class="PC-HERO-LOGO JUM-LOGO-CHOIX" alt="TRIGONE Mise en route" title="Revenir au choix Mise en route / Compte-rendu" onclick="JUMELAGE_CHOIX()">' +
            '<div class="PC-HERO-TXT"><div class="PC-HERO-TITRE">Demande d\'ordre de mise en route</div>' +
                '<p>Individuelle ou collective (import Excel, Calc ou CSV). Le circuit 1er valideur → 2e valideur → assistant Chorus DT est préparé automatiquement.</p></div>' +
            '<div class="PC-HERO-ACTIONS">' +
                (BROUILLON_EN_COURS() ? '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'FORMULAIRE\')">↩ Reprendre ma demande en cours</button>' : '') +
                '<button type="button" class="BTN BTN-PRIMARY" onclick="DEMARRER_NOUVELLE_DEMANDE()">Nouvelle demande</button>' +
                '<button type="button" class="BTN BTN-GHOST" onclick="LANCER_DEMO()">🎬 Voir une démonstration</button>' +
            '</div></div>' +
        '<div class="PC-GRILLE2">' +
            '<div class="PC-CARTE"><div class="PC-CARTE-TITRE">Dernières demandes envoyées</div>' + envois + '</div>' +
            '<div class="PC-CARTE"><div class="PC-CARTE-TITRE">Documents' + (panier.length ? ' — ' + panier.length + ' demande(s) à envoyer' : '') + '</div>' + attente + '</div>' +
        '</div>' +
        '<p class="app-credit" style="margin-top:22px;">Conçu par Germain-Pierre BOUQUET <span class="APP-VERSION-TAG">- V' + APP_VERSION_AFFICHEE + '</span></p>' +
    '</div>';
}

// ---------- Formulaire PC : récapitulatif à droite ----------
function TPL_PAGE_FORMULAIRE() {
    if (!EST_PC()) return TPL_FORMULAIRE();
    return '<div class="PC-FORM"><div class="PC-FORM-MAIN">' + TPL_FORMULAIRE() + '</div>' +
        '<aside class="PC-CARTE PC-RECAP" id="PC-RECAP">' + TPL_RECAP_PC() + '</aside></div>';
}
function TPL_RECAP_PC() {
    var t = D.trajets || {}, a = t.aller || {}, r = t.retour || {};
    var pers = (D.personnes || []).filter(function(p) { return p.nom || p.prenom; });
    // Départ et arrivée du trajet, chacun sur sa ligne (date · heure), puis le moyen de transport.
    function moment(v) {
        var d = v ? new Date(v) : null;
        return d && !isNaN(d) ? d.toLocaleDateString('fr-FR') + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    }
    function trajet(x) {
        var lieux = [x.lieuDep, x.paysArr || x.lieuArr].filter(Boolean).join(' → ');
        var lignes = [moment(x.dateDep) ? 'Départ : ' + moment(x.dateDep) : '', moment(x.dateArr) ? 'Arrivée : ' + moment(x.dateArr) : '', x.moyen ? MOYENS[x.moyen] : ''].filter(Boolean);
        return lieux || lignes.length ? ESC(lieux) + lignes.map(function(l) { return '<br><span class="PC-GRIS">' + ESC(l) + '</span>'; }).join('') : '<span class="PC-GRIS">à compléter</span>';
    }
    function kv(k, v) { return '<div class="PC-KV"><span>' + k + '</span><div>' + v + '</div></div>'; }
    return '<div class="PC-CARTE-TITRE">Récapitulatif</div>' +
        kv('Type', D.type === 'MISSION' ? 'Mission' : 'Formation / stage') +
        kv('Objet', D.objet ? '<b>' + ESC(D.objet) + '</b>' : '<span class="PC-GRIS">à compléter</span>') +
        kv('Personnel', pers.length ? '<b>' + pers.length + ' personne' + (pers.length > 1 ? 's' : '') + '</b>' : '<span class="PC-GRIS">à compléter</span>') +
        kv('Aller', trajet(a)) + kv('Retour', trajet(r)) +
        (pers.length ? '<table class="PC-TABLE PC-TABLE-PETITE"><thead><tr><th>Grade</th><th>Nom</th><th>NID</th></tr></thead><tbody>' +
            pers.slice(0, 8).map(function(p) { return '<tr><td>' + ESC(p.grade || '') + '</td><td>' + ESC((p.nom || '') + ' ' + (p.prenom || '')) + '</td><td>' + ESC(p.matricule || '') + '</td></tr>'; }).join('') +
            (pers.length > 8 ? '<tr><td colspan="3" class="PC-GRIS">+ ' + (pers.length - 8) + ' autre(s)…</td></tr>' : '') + '</tbody></table>' : '');
}
function MAJ_RECAP_PC() { var el = document.getElementById('PC-RECAP'); if (el) el.innerHTML = TPL_RECAP_PC(); }

// ---------- Espace valideur PC : tableau + détail ----------
var MER_VAL_SEL = null;
function TPL_ESPACE_VALIDATION_PC(v, h) {
    var liste = GET_A_VALIDER();
    var entete = '<div class="PC-VAL-ENTETE"><span class="MER-BADGE">🔒 Connecté — VALIDEUR ' + h.role + '</span>' + TPL_BASCULE_ROLE(h) +
        '<b>' + ESC(h.grade + ' ' + h.nom + ' ' + h.prenom) + '</b><span class="PC-GRIS">' + ESC(h.fonction) + '</span>' +
        '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto; margin-left:auto;" onclick="SE_DECONNECTER()">Déconnexion</button></div>';
    if (!liste.length) return entete + TPL_AIDE_RECEPTION();
    // Détail affiché d'office : la première demande que la personne connectée peut valider, sinon la première.
    if (!MER_VAL_SEL || !liste.some(function(e) { return e.id === MER_VAL_SEL; })) {
        var aTraiter = liste.filter(function(e) {
            return !e.decision && NIVEAU_VALIDATION(e.d) === h.role && !(MER_VERIF[e.id] || []).some(function(x) { return !x.ok; }) && !(e.pjAlterees || []).length;
        })[0];
        MER_VAL_SEL = (aTraiter || liste[0]).id;
    }
    var cochables = 0;
    var lignes = liste.map(function(e) {
        var d = e.d, niveau = NIVEAU_VALIDATION(d), verif = MER_VERIF[e.id] || [];
        var ko = verif.some(function(x) { return !x.ok; }) || (e.pjAlterees || []).length;
        var pourMoi = niveau === h.role && !ko, cochable = !e.decision && pourMoi;
        if (cochable) cochables++;
        var etat = e.decision === 'VALIDEE' ? ['Validée', 'PC-BADGE-OK'] : e.decision === 'REFUSEE' ? ['Refusée', 'PC-BADGE-KO'] : e.decision === 'RENVOYEE' ? ['Renvoyée au V1', 'PC-BADGE-KO']
            : d.renvoi && niveau === 1 && pourMoi ? ['Renvoyée par V2', '']
            : niveau > 2 ? ['Déjà validée', 'PC-BADGE-OK'] : ko ? ['Non conforme', 'PC-BADGE-KO'] : pourMoi ? ['À valider', ''] : ['Autre niveau', 'PC-BADGE-GRIS'];
        var p0 = (d.personnes || [])[0] || {}, n = (d.personnes || []).length;
        var a = (d.trajets && d.trajets.aller) || {}, r = (d.trajets && d.trajets.retour) || {};
        var dates = (a.dateDep ? FORMAT_DATE_COURT(a.dateDep) : '') + (r.dateArr ? ' → ' + FORMAT_DATE_COURT(r.dateArr) : '');
        return '<tr class="PC-VAL-LIGNE' + (e.id === MER_VAL_SEL ? ' sel' : '') + '" data-id="' + e.id + '" onclick="PC_VAL_CHOISIR(\'' + e.id + '\')">' +
            '<td>' + (cochable ? '<input type="checkbox" class="MER-VAL-SEL" value="' + e.id + '" onclick="event.stopPropagation()">' : '') + '</td>' +
            '<td><b>' + ESC(((p0.grade || '') + ' ' + (p0.nom || '')).trim()) + '</b>' + (n > 1 ? ' +' + (n - 1) : '') + '</td>' +
            '<td>' + ESC(d.objet || '') + '</td><td>' + ESC(dates) + '</td>' +
            '<td>' + ((d.pieces || []).length ? '📎 ' + d.pieces.length : '—') + '</td>' +
            '<td><span class="PC-BADGE ' + etat[1] + '">' + etat[0] + '</span></td></tr>';
    }).join('');
    var sel = liste.filter(function(e) { return e.id === MER_VAL_SEL; })[0];
    return entete +
        '<div class="PC-VAL"><div class="PC-VAL-LISTE">' +
            '<div class="PC-CARTE PC-CARTE-TABLE"><table class="PC-TABLE"><thead><tr><th></th><th>Demandeur</th><th>Objet</th><th>Dates</th><th>Pièces</th><th>État</th></tr></thead><tbody>' + lignes + '</tbody></table></div>' +
            (cochables > 1 ? '<div class="MER-ACTIONS" style="margin:12px 0 4px;"><button type="button" class="BTN BTN-SECONDARY BTN-SMALL" onclick="COCHER_TOUT_VALIDATION()">Tout cocher</button>' +
                '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="VALIDER_SELECTION()">✔ Valider la sélection</button></div>' : '') +
            TPL_TRANSMISSION_VALIDATION(v, h, liste) +
        '</div><aside class="PC-VAL-DETAIL" id="PC-VAL-DETAIL">' + TPL_DETAIL_VALIDATION_PC(sel, h) + '</aside></div>';
}
function TPL_DETAIL_VALIDATION_PC(e, h) {
    if (!e) return '';
    var d = e.d, a = (d.trajets && d.trajets.aller) || {}, r = (d.trajets && d.trajets.retour) || {};
    function kv(k, v) { return v ? '<div class="PC-KV"><span>' + k + '</span><div>' + ESC(v) + '</div></div>' : ''; }
    return '<div class="PC-CARTE"><div class="PC-CARTE-TITRE">Détail de la demande</div>' +
        kv('Type', ((d.personnes || []).length > 1 ? 'OMR collectif' : 'OMR individuel') + ' — ' + (d.type === 'MISSION' ? 'mission' : 'formation / stage')) +
        kv('Aller', [a.lieuDep, a.paysArr || a.lieuArr].filter(Boolean).join(' → ') + (a.moyen ? ' · ' + MOYENS[a.moyen] : '')) +
        kv('Retour', [r.lieuDep, r.lieuArr].filter(Boolean).join(' → ') + (r.moyen ? ' · ' + MOYENS[r.moyen] : '')) +
        TPL_ENTREE_VALIDATION(e, h, true) + '</div>';
}
function PC_VAL_CHOISIR(id) {
    MER_VAL_SEL = id;
    Array.prototype.forEach.call(document.querySelectorAll('.PC-VAL-LIGNE'), function(tr) { tr.classList.toggle('sel', tr.getAttribute('data-id') === id); });
    var e = GET_A_VALIDER().filter(function(x) { return x.id === id; })[0], el = document.getElementById('PC-VAL-DETAIL');
    if (el && e) el.innerHTML = TPL_DETAIL_VALIDATION_PC(e, HABILITATION_COURANTE());
}

// court : libellé abrégé pour les écrans étroits (5 onglets sur 320 px).
function TPL_ONGLET_DOCK(page, icone, libelle, pastille, court) {
    return '<button type="button" class="P0-TAB' + (pastille ? ' has-badge' : '') + '" onclick="SHOW_PAGE(\'' + page + '\')" aria-label="' + libelle + '">' +
        '<span class="P0-TAB-ICON" aria-hidden="true">' + icone + '</span><span class="P0-TAB-LBL">' +
        (court ? '<span class="P0-LBL-LONG">' + libelle + '</span><span class="P0-LBL-COURT">' + court + '</span>' : libelle) + '</span></button>';
}
function TPL_ACCUEIL() {
    if (EST_PC()) return TPL_ACCUEIL_PC();
    var n = GET_PANIER().length;
    return '' +
    '<div id="MER-P0">' +
      '<div class="MER-P0-SHELL">' +
        '<div class="MER-P0-INNER">' +
          '<div class="MER-LOGO-WRAP"><img class="MER-LOGO-IMG JUM-LOGO-CHOIX" src="logo_mer.webp" alt="TRIGONE — Mise en route" title="Revenir au choix Mise en route / Compte-rendu" onclick="JUMELAGE_CHOIX()"></div>' +
        '</div>' +
        '<div class="MER-P0-HERO">' +
          (MER_QUI() ? '<p class="JUM-BONJOUR">Bonjour, <b>' + ESC(MER_QUI()) + '</b></p>' : '') +
          (BROUILLON_EN_COURS() ? '<button type="button" class="BTN-ACCUEIL BTN-ACCUEIL-PETIT BTN-ACCUEIL-REPRISE" onclick="SHOW_PAGE(\'FORMULAIRE\')">↩ Reprendre ma demande en cours</button>' : '') +
          '<button type="button" class="BTN-ACCUEIL" onclick="DEMARRER_NOUVELLE_DEMANDE()">Nouvelle demande</button>' +
          (MER_COMPTE_ACTIF() ? '<button type="button" class="BTN-ACCUEIL BTN-ACCUEIL-PETIT BTN-ACCUEIL-BOITE" onclick="SHOW_PAGE(\'RECEPTION\')">📥 Boîte de réception' +
            (MER_NB_BOITE() ? '<span class="MER-PASTILLE-SIGNER MER-PASTILLE-BOITE">' + MER_NB_BOITE() + '</span>' : '') + '</button>' : '') +
          (MER_EST_VALIDEUR() ? '<button type="button" class="BTN-ACCUEIL BTN-ACCUEIL-PETIT" onclick="SHOW_PAGE(\'VALIDATION\')">Espace valideur' +
            (MER_NB_A_SIGNER() ? '<span class="MER-PASTILLE-SIGNER">' + MER_NB_A_SIGNER() + ' à signer</span>' : '') + '</button>' : '') +
          '<button type="button" class="P0-LIEN" onclick="LANCER_DEMO()">🎬 Voir une démonstration</button>' +
        '</div>' +
        '<div class="MER-P0-ESPACE"></div>' +
        '<p class="app-credit">Conçu par Germain-Pierre BOUQUET <span class="APP-VERSION-TAG">- V' + APP_VERSION_AFFICHEE + '</span></p>' +
        '<nav class="P0-TAB-BAR" aria-label="Navigation accueil"><div class="P0-DOCK-INNER">' +
          TPL_ONGLET_DOCK('BIBLIOTHEQUE', MER_ICONES.BIBLIOTHEQUE, 'Bibliothèque', false, 'Biblio') +
          TPL_ONGLET_DOCK('PANIER', MER_ICONES.PANIER, 'Documents' + (n ? ' (' + n + ')' : ''), n > 0, 'Docs') +
        '</div></nav>' +
      '</div>' +
    '</div>';
}

// ===================== BIBLIOTHÈQUE (demandes envoyées) =====================
var STORAGE_BIBLIOTHEQUE = 'mer_bibliotheque';
function GET_BIBLIOTHEQUE() {
    // Démonstration : la demande d'exemple, comme si elle venait d'être envoyée (la vraie bibliothèque n'est pas montrée).
    if (DEMO_ACTIF) return [{ id: 'demo', envoyeLe: new Date().toISOString(), destinataire: DEMO_REGLAGES.mailSignataire, demandes: DEMO_PANIER.length ? DEMO_PANIER : [D] }];
    try { return JSON.parse(localStorage.getItem(STORAGE_BIBLIOTHEQUE) || '[]'); } catch (e) { return []; }
}
// Toutes les demandes envoyées sont gardées (plus de limite de nombre), tant que la mémoire de TRIGONE le permet.
function SAVE_BIBLIOTHEQUE(l) {
    if (DEMO_ACTIF) return;
    try { localStorage.setItem(STORAGE_BIBLIOTHEQUE, JSON.stringify(l)); }
    catch (e) { if (window.JUMELAGE_MEMOIRE_PLEINE) JUMELAGE_MEMOIRE_PLEINE(); }
}
// Un envoi fait sans réseau vient de partir (boîte d'envoi, jumelage.js) : la Bibliothèque ouverte se met à jour.
window.JUMELAGE_APRES_ENVOI_DIFFERE = function() { if (PAGE_ACTUELLE === 'BIBLIOTHEQUE') { var y = window.scrollY; SHOW_PAGE('BIBLIOTHEQUE'); window.scrollTo(0, y); } };
// attente : envoi fait sans réseau, parti plus tard tout seul (la boîte d'envoi efface alors « attente »).
function ARCHIVER_ENVOI(demandes, destinataire, id, attente) {
    var l = GET_BIBLIOTHEQUE(), e = { id: id || 'e' + Date.now(), envoyeLe: new Date().toISOString(), destinataire: destinataire, demandes: demandes };
    if (attente) e.attente = true;
    l.unshift(e);
    SAVE_BIBLIOTHEQUE(l);
}
// Suivi d'une demande envoyée (tenu par le serveur : étape, date, auteur) : frise Envoyée → VALIDEUR 1 → VALIDEUR 2 → Chorus DT.
var MER_SUIVI_ETAPES = [['envoyee', 'Envoyée'], ['val1', 'VALIDEUR 1'], ['val2', 'VALIDEUR 2'], ['chorus', 'Chorus DT']];
function MER_DATE_HEURE(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function MER_DEPUIS(ms) {
    var h = Math.floor((Date.now() - ms) / 3600000);
    return h < 1 ? 'moins d\'une heure' : h < 24 ? h + ' h' : Math.floor(h / 24) + ' j';
}
// id : identifiant de la demande ; nom : affiché au-dessus de la frise (demandes groupées), ou vide.
function TPL_SUIVI_DEMANDE(id, nom) {
    var s = window.JUMELAGE_SUIVI && JUMELAGE_SUIVI()[id];
    if (!s) return '';
    // Rang de l'étape en cours : 1 chez le VALIDEUR 1, 2 chez le VALIDEUR 2, 3 chez Chorus DT, 4 traitée.
    var rang = { val1: 1, val2: 2, chorus: 3, traite: 4 }[s.etape], refus = s.etape === 'refus' || s.etape === 'abandon';
    var der = (s.etapes || [])[s.etapes.length - 1] || {};
    var puces = MER_SUIVI_ETAPES.map(function(x, i) {
        var etat = refus ? (i === 0 ? 'fait' : 'avenir') : i < rang ? 'fait' : i === rang ? 'encours' : 'avenir';
        return '<span class="MER-SUIVI-PT ' + etat + '"><i>' + (etat === 'fait' ? '✓' : etat === 'encours' ? '…' : '') + '</i>' + x[1] + '</span>';
    }).join('<span class="MER-SUIVI-TRAIT"></span>');
    var par = der.qui ? ' (' + ESC(der.qui) + ')' : '';
    var texte = refus ? '<b style="color:#b91c1c;">Refusée</b>' + par + ' le ' + MER_DATE_HEURE(der.le) + (s.intervenant ? ' : renvoyée au demandeur.' : ' : voir votre Boîte de réception.')
        : rang === 4 ? '<b style="color:#15803d;">Traitée par l\'assistant Chorus DT</b>' + par + ' le ' + MER_DATE_HEURE(der.le) + ' : ordre de mission créé dans Chorus DT.'
        : ({ envoyee: 'Envoyée', val1: 'Validée par le VALIDEUR 1', val2: 'Validée par le VALIDEUR 2', renvoi: 'Renvoyée au VALIDEUR 1 par le VALIDEUR 2' }[der.e] || 'Mise à jour') + par + ' le ' + MER_DATE_HEURE(der.le) +
          '. <b>En attente ' + (rang === 3 ? 'de l\'assistant Chorus DT' : 'du VALIDEUR ' + rang) + ' depuis ' + MER_DEPUIS(s.le) + '.</b>';
    return '<div class="MER-SUIVI' + (refus ? ' refus' : '') + '">' + (nom ? '<div class="MER-SUIVI-NOM">' + ESC(nom) + '</div>' : '') +
        '<div class="MER-SUIVI-FRISE">' + puces + '</div><div class="MER-SUIVI-TXT">' + texte + '</div></div>';
}
window.addEventListener('trigone-suivi', function() {
    if (typeof PAGE_ACTUELLE === 'undefined' || (typeof DEMO_ACTIF !== 'undefined' && DEMO_ACTIF)) return;
    if (PAGE_ACTUELLE === 'BIBLIOTHEQUE' || PAGE_ACTUELLE === 'RECEPTION' || (PAGE_ACTUELLE === 'CHORUS' && !MER_RESULTATS_VERIF)) { var y = window.scrollY; SHOW_PAGE(PAGE_ACTUELLE); window.scrollTo(0, y); }
});
// Sélection pour supprimer plusieurs demandes d'un coup : null = mode normal, sinon { id: true } des cochées.
var MER_BIB_SELECTION = null;
function BIB_SELECTION(active) { MER_BIB_SELECTION = active ? {} : null; SHOW_PAGE('BIBLIOTHEQUE'); }
function BIB_COCHER(id, oui) { if (!MER_BIB_SELECTION) return; if (oui) MER_BIB_SELECTION[id] = true; else delete MER_BIB_SELECTION[id]; BIB_MAJ_BARRE(); }
function BIB_TOUT_COCHER() {
    var l = GET_BIBLIOTHEQUE().filter(function(e) { return !MER_BIB_VISIBLES || MER_BIB_VISIBLES.indexOf(e.id) >= 0; }), tout = l.every(function(e) { return MER_BIB_SELECTION[e.id]; });
    MER_BIB_SELECTION = {}; if (!tout) l.forEach(function(e) { MER_BIB_SELECTION[e.id] = true; });
    var y = window.scrollY; SHOW_PAGE('BIBLIOTHEQUE'); window.scrollTo(0, y);
}
function BIB_MAJ_BARRE() {
    var n = Object.keys(MER_BIB_SELECTION || {}).length, b = document.getElementById('MER-BIB-SUPPR');
    if (b) { b.disabled = !n; b.textContent = '🗑 Supprimer' + (n ? ' (' + n + ')' : ''); }
}
function BIB_SUPPRIMER_SELECTION() {
    var ids = Object.keys(MER_BIB_SELECTION || {}); if (!ids.length) return;
    MSG_CONFIRM('Supprimer ' + ids.length + ' demande' + (ids.length > 1 ? 's' : '') + ' ?', (ids.length > 1 ? 'Ces demandes seront retirées' : 'Cette demande sera retirée') + ' de la bibliothèque de cet appareil.', 'Supprimer', function() {
        SAVE_BIBLIOTHEQUE(GET_BIBLIOTHEQUE().filter(function(e) { return ids.indexOf(e.id) < 0; }));
        MER_BIB_SELECTION = null;
        SHOW_PAGE('BIBLIOTHEQUE');
    }, '🗑️', 'mascotte-poubelle.webp', true);
}
// Bibliothèque rangée en dossiers selon l'avancement (suivi) de chaque demande : un envoi de plusieurs demandes
// apparaît dans le dossier de chacune. Sans suivi connu (ancienne demande, hors ligne) : « En cours de validation ».
function MER_BIB_ETATS(e) {
    var s = window.JUMELAGE_SUIVI ? JUMELAGE_SUIVI() : {}, etats = {};
    (e.demandes || []).forEach(function(d) {
        var x = s[d.id], et = x && x.etape;
        etats[et === 'refus' || et === 'abandon' ? 'refus' : et === 'traite' ? 'traitees' : et === 'chorus' ? 'chorus' : 'validation'] = true;
    });
    return etats;
}
var MER_BIB_VISIBLES = null;   // envois du dossier ouvert (« Tout cocher » s'y limite)
function TPL_BIBLIOTHEQUE() {
    var tout = GET_BIBLIOTHEQUE(), sel = MER_BIB_SELECTION;
    var ds = [
        { id: 'validation', titre: 'En cours de validation', sous: 'Chez le VALIDEUR 1 ou le VALIDEUR 2' },
        { id: 'chorus', titre: 'Chez l\'assistant Chorus DT', sous: 'Validées, en attente de prise en charge' },
        { id: 'traitees', titre: 'Prises en charge', sous: 'Ordre de mission créé ou en cours de création' },
        { id: 'refus', titre: 'Refusées', sous: 'Renvoyées avec un motif : à corriger' }
    ];
    ds.forEach(function(d) {
        d.liste = tout.filter(function(e) { return MER_BIB_ETATS(e)[d.id]; });
        d.nb = d.liste.length; d.gris = d.id !== 'refus'; d.nouveau = d.id === 'refus' && d.nb > 0;
        d.det = d.nb ? (d.id === 'refus' ? '<span class="MER-DOSSIER-ATT">' : '<span>') + d.nb + ' demande' + (d.nb > 1 ? 's' : '') + '</span>' : 'Aucune demande';
    });
    var ouvert = ds.filter(function(d) { return d.id === MER_DOSSIER.BIBLIOTHEQUE; })[0];
    if (!ouvert) {
        MER_DOSSIER.BIBLIOTHEQUE = null; MER_BIB_VISIBLES = null;
        if (!DEMO_ACTIF && window.JUMELAGE_SUIVI_ACTUALISER) setTimeout(JUMELAGE_SUIVI_ACTUALISER, 0);
        return '<div class="CARD"><h2>Bibliothèque</h2>' +
            '<p class="MER-HINT" style="margin:4px 0 6px;">Vos demandes de mise en route envoyées, rangées selon leur <b>suivi</b> (VALIDEUR 1, VALIDEUR 2, assistant Chorus DT) ; une notification vous prévient à chaque étape. Au retour, TRIGONE Compte-rendu de mission les propose (« À partir d\'une mise en route »).</p>' +
            (window.JUMELAGE_MEMOIRE_TEXTE ? '<p class="MER-HINT MER-BIB-MEMOIRE" style="margin:0 0 16px;">💾 ' + ESC(JUMELAGE_MEMOIRE_TEXTE(tout.length, 'demande gardée', 'demandes gardées')) + '. Toutes sont gardées ; supprimez celles dont vous n\'avez plus besoin.</p>' : '') +
            TPL_GRILLE_DOSSIERS('BIBLIOTHEQUE', ds) +
            '<button type="button" class="BTN BTN-SECONDARY" onclick="MER_BIB_SELECTION = null; SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
    }
    var l = ouvert.liste;
    MER_BIB_VISIBLES = l.map(function(e) { return e.id; });
    if (sel) Object.keys(sel).forEach(function(id) { if (!BIB_TROUVER(id)) delete sel[id]; });
    if (!DEMO_ACTIF && window.JUMELAGE_SUIVI_ACTUALISER) setTimeout(JUMELAGE_SUIVI_ACTUALISER, 0);
    var items = l.map(function(e) {
        var noms = e.demandes.map(function(d) { return RESUME_DEMANDE(d).noms; }).join(' · ');
        var objets = e.demandes.map(function(d) { return d.objet || ''; }).join(' · ');
        return '<div class="MER-PANIER-ITEM' + (sel && sel[e.id] ? ' MER-BIB-COCHEE' : '') + '" style="align-items:flex-start;">' +
            (sel ? '<label class="MER-BIB-CASE"><input type="checkbox"' + (sel[e.id] ? ' checked' : '') + ' onchange="BIB_COCHER(\'' + e.id + '\', this.checked); this.closest(\'.MER-PANIER-ITEM\').classList.toggle(\'MER-BIB-COCHEE\', this.checked)" aria-label="Sélectionner"></label>' : '') +
            '<div class="MER-PANIER-ITEM-TXT">' +
            (e.attente ? '<span class="MER-BADGE" style="background:rgba(180,83,9,0.12);color:#b45309;">⏳ En attente de réseau — partira toute seule</span>'
                : '<span class="MER-BADGE">Envoyée le ' + ESC(new Date(e.envoyeLe).toLocaleDateString('fr-FR')) + '</span>') +
            '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(noms) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + e.demandes.length + ' demande(s) — ' + ESC(objets) + (e.destinataire ? '<br>À ' + ESC(e.destinataire) : '') + '</div>' +
            (DEMO_ACTIF ? '' : e.demandes.map(function(d) { return TPL_SUIVI_DEMANDE(d.id, e.demandes.length > 1 ? RESUME_DEMANDE(d).noms : ''); }).join('')) +
            (sel ? '' : '<div class="MER-VAL-ACTIONS">' +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="BIB_PDF(\'' + e.id + '\')">PDF</button>' +
                e.demandes.map(function(d, k) { return '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MER_PARTICIPANTS_BIB(\'' + e.id + '\', ' + k + ')">👥 ' + (e.demandes.length > 1 ? ESC(RESUME_DEMANDE(d).noms) : 'Participants' + ((d.personnes || []).length > 1 ? ' (' + d.personnes.length + ')' : '')) + '</button>'; }).join('') +
                (e.demandes.some(function(d) { return d.trajets && d.trajets.aller && d.trajets.aller.dateDep; }) ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MER_AGENDA(\'' + e.id + '\')">📅 Agenda</button>' : '') +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="BIB_REUTILISER(\'' + e.id + '\')">Refaire une demande</button>' +
                '<button type="button" class="BTN-DANGER-TEXT" onclick="BIB_SUPPRIMER(\'' + e.id + '\')">Supprimer</button>' +
            '</div>') + '</div></div>';
    }).join('');
    var n = sel ? Object.keys(sel).length : 0;
    // Barre de sélection (plusieurs demandes à supprimer d'un coup), dès qu'il y en a au moins deux.
    var barre = DEMO_ACTIF || l.length < 2 ? '' : sel
        ? '<div class="MER-BIB-BARRE"><button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="BIB_TOUT_COCHER()">' + (l.every(function(e) { return sel[e.id]; }) ? 'Tout décocher' : 'Tout cocher') + '</button>' +
            '<button type="button" class="BTN BTN-SMALL MER-BIB-SUPPR" id="MER-BIB-SUPPR" onclick="BIB_SUPPRIMER_SELECTION()"' + (n ? '' : ' disabled') + '>🗑 Supprimer' + (n ? ' (' + n + ')' : '') + '</button>' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="BIB_SELECTION(false)">Annuler</button></div>'
        : '<div class="MER-BIB-BARRE"><button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="BIB_SELECTION(true)">☑ Sélectionner</button></div>';
    return '<div class="CARD"><h2>Bibliothèque</h2>' + TPL_TETE_DOSSIER('BIBLIOTHEQUE', ouvert) +
        barre + (items || '<div class="MER-EMPTY">Aucune demande dans ce dossier.</div>') +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="OUVRIR_DOSSIER(\'BIBLIOTHEQUE\', null)">‹ Dossiers</button></div>';
}
// ===================== AGENDA =====================
// « 📅 Agenda » (Bibliothèque) : la mission dans l'agenda du téléphone (fichier .ics : Samsung, Apple, Outlook…,
// par le menu de partage quand il existe) ou dans Google Agenda. Du départ aller à l'arrivée retour, trajets
// détaillés, rappel la veille. Rien ne part sur internet sauf si l'on choisit Google Agenda.
function MER_ICS_TEXTE(t) { return String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function MER_ICS_DATE(v) { var d = new Date(v), z = function(n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + 'T' + z(d.getHours()) + z(d.getMinutes()) + '00'; }
function MER_ICS_PLIER(l) { var out = [], i = 0; while (l.length - i > 74) { out.push((i ? ' ' : '') + l.slice(i, i + 74)); i += 74; } out.push((i ? ' ' : '') + l.slice(i)); return out.join('\r\n'); }
function MER_EVENEMENT(d) {
    var a = (d.trajets && d.trajets.aller) || {}, r = (d.trajets && d.trajets.retour) || {};
    var debut = a.dateDep, fin = r.dateArr || r.dateDep || a.dateArr;
    if (!fin || new Date(fin) <= new Date(debut)) fin = new Date(new Date(debut).getTime() + 2 * 3600000).toISOString();
    var heure = function(v) { return v ? new Date(v).toLocaleDateString('fr-FR') + ' ' + new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };
    var trajet = function(nom, x) {
        if (!x.lieuDep && !x.lieuArr && !x.paysArr) return '';
        return nom + ' : ' + [x.moyen ? MOYENS[x.moyen] : '', [x.lieuDep || x.paysDep, x.lieuArr || x.paysArr].filter(Boolean).join(' → ')].filter(Boolean).join(', ') +
            (x.dateDep ? ' — départ ' + heure(x.dateDep) : '') + (x.dateArr ? ', arrivée ' + heure(x.dateArr) : '');
    };
    var qui = (d.personnes || []).map(function(p) { return [p.grade, (p.nom || '').toUpperCase(), p.prenom].filter(Boolean).join(' '); }).join(', ');
    return { titre: (d.type === 'FORMATION' ? 'Formation' : 'Mission') + (d.objet ? ' — ' + d.objet : ''), debut: debut, fin: fin,
        lieu: [a.lieuArr || '', a.paysArr || ''].filter(Boolean).join(', '),
        texte: [trajet('Aller', a), trajet('Retour', r), qui ? 'Personnes : ' + qui : '', 'Demande de mise en route TRIGONE'].filter(Boolean).join('\n'), uid: (d.id || 'mer' + Date.now()) + '@trigone' };
}
function MER_ICS(liste) {
    var maintenant = new Date(), z = function(n) { return ('0' + n).slice(-2); };
    var stamp = maintenant.getUTCFullYear() + z(maintenant.getUTCMonth() + 1) + z(maintenant.getUTCDate()) + 'T' + z(maintenant.getUTCHours()) + z(maintenant.getUTCMinutes()) + '00Z';
    var l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TRIGONE//Mise en route//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    liste.forEach(function(ev) {
        l.push('BEGIN:VEVENT', 'UID:' + ev.uid, 'DTSTAMP:' + stamp, 'DTSTART:' + MER_ICS_DATE(ev.debut), 'DTEND:' + MER_ICS_DATE(ev.fin),
            'SUMMARY:' + MER_ICS_TEXTE(ev.titre), 'LOCATION:' + MER_ICS_TEXTE(ev.lieu), 'DESCRIPTION:' + MER_ICS_TEXTE(ev.texte),
            'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + MER_ICS_TEXTE('Départ demain : ' + ev.titre), 'END:VALARM', 'END:VEVENT');
    });
    l.push('END:VCALENDAR');
    return l.map(MER_ICS_PLIER).join('\r\n') + '\r\n';
}
function MER_AGENDA(id) {
    var e = BIB_TROUVER(id); if (!e) return;
    var evs = e.demandes.filter(function(d) { return d.trajets && d.trajets.aller && d.trajets.aller.dateDep; }).map(MER_EVENEMENT);
    // Une demande collective (ou plusieurs demandes pour la même mission) : un seul événement.
    var vus = {}; evs = evs.filter(function(ev) { var k = ev.debut + '|' + ev.titre; if (vus[k]) return false; vus[k] = true; return true; });
    if (!evs.length) return;
    MER_AGENDA_EVS = evs;
    var ev = evs[0];
    AFFICHER_MODALE('Ajouter à mon agenda',
        '<p style="font-size:0.86em; line-height:1.5;"><b>' + ESC(ev.titre) + '</b><br>' + ESC(new Date(ev.debut).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })) +
            ' → ' + ESC(new Date(ev.fin).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })) + (evs.length > 1 ? '<br>+ ' + (evs.length - 1) + ' autre(s) mission(s)' : '') + '</p>' +
        '<p class="MER-HINT">Trajets aller et retour dans la description, rappel la veille du départ.</p>' +
        '<button type="button" class="BTN BTN-PRIMARY" style="margin-top:6px;" onclick="MER_AGENDA_ICS()">📅 Agenda du téléphone</button>' +
        '<p class="MER-HINT" style="margin:4px 0 10px;">Samsung, Apple, Outlook… : choisissez votre agenda dans la liste qui s\'ouvre (ou ouvrez le fichier téléchargé).</p>' +
        '<button type="button" class="BTN BTN-GHOST" onclick="MER_AGENDA_GOOGLE()">Google Agenda</button>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Fermer</button>');
}
var MER_AGENDA_EVS = [];
function MER_AGENDA_ICS() {
    var nom = 'Mission - ' + (MER_AGENDA_EVS[0].titre.replace(/^(Mission|Formation) — /, '') || 'TRIGONE').replace(/[\\/:*?"<>|]/g, '').slice(0, 60) + '.ics';
    var f = new File([MER_ICS(MER_AGENDA_EVS)], nom, { type: 'text/calendar' });
    FERMER_MODALE();
    // Téléphone : menu de partage (l'appli Agenda l'importe) ; sinon, le fichier est téléchargé.
    if (navigator.canShare && navigator.share && /Android|iPhone|iPad/.test(navigator.userAgent) && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: MER_AGENDA_EVS[0].titre }).catch(function() {});
        return;
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = nom; document.body.appendChild(a); a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function MER_AGENDA_GOOGLE() {
    var ev = MER_AGENDA_EVS[0];
    window.open('https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.titre) + '&dates=' + MER_ICS_DATE(ev.debut) + '/' + MER_ICS_DATE(ev.fin) +
        '&ctz=Europe%2FParis&details=' + encodeURIComponent(ev.texte) + '&location=' + encodeURIComponent(ev.lieu), '_blank');
    FERMER_MODALE();
}
function BIB_TROUVER(id) { return GET_BIBLIOTHEQUE().filter(function(e) { return e.id === id; })[0]; }
function BIB_PDF(id) {
    var e = BIB_TROUVER(id); if (!e) return;
    try { GENERER_PDF(e.demandes).save(NOM_FICHIER_BASE(e.demandes) + '.pdf'); }
    catch (err) { MSG_ERREUR('PDF impossible', 'Erreur lors de la génération du PDF : ' + err.message); }
}
// Repart d'une demande envoyée (même objet, mêmes personnes) pour en créer une nouvelle.
function BIB_REUTILISER(id) { PROTEGER_BROUILLON(function() { BIB_REUTILISER_OK(id); }, 'Refaire la demande'); }
function BIB_REUTILISER_OK(id) {
    var e = BIB_TROUVER(id); if (!e) return;
    var d = JSON.parse(JSON.stringify(e.demandes[0]));
    d.id = VIDE_DEMANDE().id; d.validations = []; delete d.refus; delete d.omr; delete d.omrLe;
    D = d; MER_ACTIVE_TAB = 'IDENTITE'; SAVE_BROUILLON();
    SHOW_PAGE('FORMULAIRE');
}
function BIB_SUPPRIMER(id) {
    MSG_CONFIRM('Supprimer ?', 'Cette demande sera retirée de la bibliothèque.', 'Supprimer', function() {
        SAVE_BIBLIOTHEQUE(GET_BIBLIOTHEQUE().filter(function(e) { return e.id !== id; }));
        SHOW_PAGE('BIBLIOTHEQUE');
    }, '🗑️', 'mascotte-poubelle.webp', true);
}

// ===================== MON ESPACE =====================
function SET_REGLAGE(cle, valeur) { var r = GET_REGLAGES(); r[cle] = valeur; SAVE_REGLAGES(r); }
function TPL_MON_ESPACE() {
    var r = GET_REGLAGES(), id = r.identite || {};
    function champId(k, label, ph) {
        return '<div class="MER-FIELD"><label>' + label + '</label><input type="text" value="' + ESC(id[k] || (k === 'unite' ? r.derniereUnite : k === 'cie' ? r.derniereCie : '') || '') +
            '" placeholder="' + ph + '" oninput="' + (k === 'matricule' ? 'this.value=FORMAT_MATRICULE(this.value); ' : '') + 'var r=GET_REGLAGES(); r.identite=r.identite||{}; r.identite[\'' + k + '\']=this.value; SAVE_REGLAGES(r);"></div>';
    }
    function champMail(k, label, hint) {
        return '<div class="MER-FIELD"><label>' + label + '</label><input type="email" data-scan-carte value="' + ESC(r[k] || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" ' +
            'oninput="SET_REGLAGE(\'' + k + '\', this.value)">' + (hint ? '<p class="MER-HINT">' + hint + '</p>' : '') + '</div>';
    }
    return '<div class="CARD"><h2>Mon espace</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Votre identité, vos mails et le code d\'accès se règlent une seule fois pour Mise en route et Compte-rendu, dans <b>Mon profil</b> (bouton de compte en haut à droite).</p>' +
        '<button type="button" class="NOTICE-CARD" onclick="JUMELAGE_REGLAGES()"><span class="NOTICE-CARD-ICON"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg></span>' +
            '<span class="NOTICE-CARD-BODY"><span class="NOTICE-CARD-TITLE">Mon profil</span><span class="NOTICE-CARD-SUB">Identité, mails (1er valideur, assistant Chorus DT) et code d\'accès — communs aux deux applis</span></span>' +
            '<span class="NOTICE-CARD-CHEV">›</span></button>' +
        '<button type="button" class="NOTICE-CARD" onclick="JUMELAGE_COMPTE()"><span class="NOTICE-CARD-ICON"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg></span>' +
            '<span class="NOTICE-CARD-BODY"><span class="NOTICE-CARD-TITLE">Compte TRIGONE</span><span class="NOTICE-CARD-SUB">' + (window.JUMELAGE_COMPTE_ACTIF && JUMELAGE_COMPTE_ACTIF() ? 'Actif : ' + ESC(JUMELAGE_COMPTE_MAIL()) + ' — les demandes arrivent directement dans TRIGONE' : 'Envoyer et recevoir les demandes directement dans TRIGONE, chiffrées, sans pièce jointe') + '</span></span>' +
            '<span class="NOTICE-CARD-CHEV">›</span></button>' +
        '<button type="button" class="NOTICE-CARD" onclick="JUMELAGE_SAUVEGARDER()"><span class="NOTICE-CARD-ICON"><svg viewBox="0 0 24 24"><path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2Z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg></span>' +
            '<span class="NOTICE-CARD-BODY"><span class="NOTICE-CARD-TITLE">Sauvegarder mes données</span><span class="NOTICE-CARD-SUB">Un seul fichier pour tout TRIGONE (Mise en route et Compte-rendu, pièces jointes comprises)' + (MER_DATE_SAUVEGARDE() ? ' — dernière : ' + MER_DATE_SAUVEGARDE() : ' — jamais faite') + '</span></span>' +
            '<span class="NOTICE-CARD-CHEV">›</span></button>' +
        '<button type="button" class="NOTICE-CARD" onclick="JUMELAGE_RESTAURER()"><span class="NOTICE-CARD-ICON"><svg viewBox="0 0 24 24"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/></svg></span>' +
            '<span class="NOTICE-CARD-BODY"><span class="NOTICE-CARD-TITLE">Restaurer une sauvegarde</span><span class="NOTICE-CARD-SUB">Remettre en place un fichier « TRIGONE - sauvegarde », sur cet appareil ou un nouveau</span></span>' +
            '<span class="NOTICE-CARD-CHEV">›</span></button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}
function MER_DATE_SAUVEGARDE() {
    var t = 0; try { t = +localStorage.getItem('trigone_derniere_sauvegarde') || 0; } catch (e) {}
    return t ? new Date(t).toLocaleDateString('fr-FR') : '';
}
// Rappel de sauvegarde (commun aux deux applis) : dès qu'il y a des demandes envoyées dans la Bibliothèque.
function MER_RAPPEL_SAUVEGARDE() {
    if (DEMO_ACTIF || PAGE_ACTUELLE !== 'ACCUEIL' || !ECRAN_LIBRE() || !GET_BIBLIOTHEQUE().length || !window.JUMELAGE_SAUVEGARDE_A_RAPPELER) return;
    var texte = JUMELAGE_SAUVEGARDE_A_RAPPELER();
    if (!texte) return;
    AFFICHER_MSG_CENTRE({ titre: 'Pensez à sauvegarder', texte: texte, icone: '💾', mascotte: 'mascotte-maj.webp',
        boutons: [{ label: 'Plus tard', style: 'BTN-MSG-ANNULER' }, { label: 'Sauvegarder maintenant', action: function() { JUMELAGE_SAUVEGARDER(); } }] });
}

// Une demande en cours n'est jamais effacée sans confirmation.
function PROTEGER_BROUILLON(action, libelle) {
    if (!BROUILLON_EN_COURS()) { action(); return; }
    MSG_CONFIRM('Demande en cours', 'Une demande est déjà en cours de saisie.\n\nContinuer effacera celle-ci.', libelle || 'Continuer', action, '⚠️');
}
function DEMARRER_NOUVELLE_DEMANDE() { PROTEGER_BROUILLON(NOUVELLE_DEMANDE, 'Nouvelle demande'); }
function NOUVELLE_DEMANDE() {
    CLEAR_BROUILLON();
    MER_ACTIVE_TAB = 'IDENTITE';
    var reg = GET_REGLAGES(), id = reg.identite || {};
    D.personnes[0] = Object.assign(VIDE_PERSONNE(), { unite: reg.derniereUnite || '', cie: reg.derniereCie || '' },
        Object.keys(id).reduce(function(o, k) { if (id[k]) o[k] = id[k]; return o; }, {}));
    SAVE_BROUILLON();
    SHOW_PAGE('FORMULAIRE');
}

// ===================== Utilitaires de champ =====================
function SET_CHAMP(path, valeur) {
    var parts = path.split('.');
    var obj = D;
    for (var i = 0; i < parts.length - 1; i++) {
        var k = parts[i];
        obj = /^\d+$/.test(parts[i + 1]) && Array.isArray(obj[k]) ? obj[k] : obj[k];
    }
    var last = parts[parts.length - 1];
    obj[last] = valeur;
    SAVE_BROUILLON();
}
function NAV_CHAMP(path) {
    var parts = path.split('.');
    var obj = D;
    for (var i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    return { obj: obj, key: parts[parts.length - 1] };
}
function ON_CHAMP_INPUT(path, val) {
    var n = NAV_CHAMP(path); n.obj[n.key] = val;
    var el = document.querySelector('.MER-ERREUR[data-path="' + path + '"]');
    if (el) el.classList.remove('MER-ERREUR');
    if (/^trajets\.retour\.(lieu|cp|pays|residence)/.test(path)) D.trajets.retourAuto = false;
    if (/^trajets\.aller\./.test(path)) SYNCHRO_RETOUR();
    SAVE_BROUILLON();
    MAJ_RECAP_PC();
    if (/\.moyen$/.test(path)) RENDER_FORMULAIRE_INPLACE();   // libellés gare / aéroport / port
}
// Retour = aller inversé (lieux, codes postaux, pays, moyen), tant que le missionnaire n'a pas touché au retour.
var MER_PAIRES_RETOUR = [['residenceArr', 'residenceDep'], ['lieuDep', 'lieuArr'], ['cpDep', 'cpArr'], ['paysDep', 'paysArr'], ['lieuArr', 'lieuDep'], ['cpArr', 'cpDep'], ['paysArr', 'paysDep'], ['moyen', 'moyen']];
function SYNCHRO_RETOUR() {
    var t = D.trajets;
    // Anciens brouillons (sans l'indicateur) : on ne touche pas à un retour déjà rempli.
    if (t.retourAuto === false || (t.retourAuto === undefined && (t.retour.lieuDep || t.retour.lieuArr))) return;
    MER_PAIRES_RETOUR.forEach(function(p) {
        t.retour[p[0]] = t.aller[p[1]] || '';
        MAJ_CHAMP_DOM('trajets.retour.' + p[0]);
    });
}
function ON_CHAMP_BOOL(path, val) {
    var n = NAV_CHAMP(path); n.obj[n.key] = val;
    if (/^trajets\.retour\./.test(path) && path !== 'trajets.retour.moyen') D.trajets.retourAuto = false;
    if (/^trajets\.aller\./.test(path)) SYNCHRO_RETOUR();
    SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE();
}
function GET_CHAMP(path) { var n = NAV_CHAMP(path); return n.obj[n.key]; }

function RENDER_FORMULAIRE_INPLACE() {
    var scroll = window.scrollY;
    document.getElementById('PAGE-STAGE').innerHTML = TPL_PAGE_FORMULAIRE();
    window.scrollTo(0, scroll);
}

// format : nom d'une fonction qui remet en forme la saisie (ex. FORMAT_MATRICULE).
function CHAMP_TXT(label, path, placeholder, type, format) {
    type = type || 'text';
    var v = (GET_CHAMP(path) || '');
    return '<div class="MER-FIELD"><label>' + label + '</label>' +
        '<input type="' + type + '" data-path="' + path + '" value="' + ESC(v) + '" placeholder="' + (placeholder || '') + '" ' +
        (format === 'FORMAT_MATRICULE' ? 'inputmode="numeric" ' : '') +
        'oninput="' + (format ? 'this.value=' + format + '(this.value); ' : '') + 'ON_CHAMP_INPUT(\'' + path + '\', this.value)"></div>';
}
// Matricule : 10 chiffres groupés 3 + 2 + 2 + 3 (ex. 067 50 10 191).
function FORMAT_MATRICULE(v) {
    var c = (v || '').replace(/\D/g, '').slice(0, 10);
    return [c.slice(0, 3), c.slice(3, 5), c.slice(5, 7), c.slice(7, 10)].filter(Boolean).join(' ');
}
function MAJ_CHAMP_DOM(path) {
    var el = document.querySelector('[data-path="' + path + '"]');
    if (el && el !== document.activeElement) el.value = GET_CHAMP(path) || '';
}

function TOGGLE_OUI_NON(label, path, hintOui, hintNon) {
    var v = !!GET_CHAMP(path);
    var hint = v ? (hintOui || '') : (hintNon || '');
    return '<div class="MER-FIELD" data-champ="' + path + '"><label>' + label + '</label>' +
        '<div class="MER-TOGGLE-PAIR">' +
        '<button type="button" class="MER-TOGGLE-BTN' + (v ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'' + path + '\', true)">OUI</button>' +
        '<button type="button" class="MER-TOGGLE-BTN' + (!v ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'' + path + '\', false)">NON</button>' +
        '</div>' + (hint ? '<p class="MER-HINT">' + hint + '</p>' : '') + '</div>';
}

function SELECT_MOYEN(path) {
    var v = GET_CHAMP(path) || '';
    var opts = ['', 'SERVICE', 'CIVILE', 'FERREE', 'AERIENNE', 'MARITIME'].map(function(k) {
        var label = k ? MOYENS[k] : '— Choisir —';
        return '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + label + '</option>';
    }).join('');
    return '<div class="MER-FIELD"><label>Moyen de transport</label><select data-path="' + path + '" onchange="ON_CHAMP_INPUT(\'' + path + '\', this.value)">' + opts + '</select></div>';
}

function TPL_PERSONNE(i) {
    var p = D.personnes[i];
    var retirer = D.personnes.length > 1 ? '<button type="button" class="MER-RETIRER" onclick="RETIRER_PERSONNE(' + i + ')" aria-label="Retirer">✕</button>' : '';
    return '<div class="MER-PERSONNE-CARD">' + retirer +
        (D.personnes.length > 1 ? '<p class="MER-HINT" style="margin-top:0; font-weight:800;">Personne ' + (i + 1) + '</p>' : '') +
        '<div class="MER-ROW2">' +
            CHAMP_TXT('Unité / entité', 'personnes.' + i + '.unite', 'EX : 4°RIISC') +
            CHAMP_TXT('CIE', 'personnes.' + i + '.cie', 'EX : 4CIE') +
        '</div>' +
        '<div class="MER-ROW2">' +
            CHAMP_TXT('Grade', 'personnes.' + i + '.grade', 'EX : ADJUDANT') +
            CHAMP_TXT('Matricule', 'personnes.' + i + '.matricule', 'EX : 067 50 10 191', 'text', 'FORMAT_MATRICULE') +
        '</div>' +
        '<div class="MER-ROW2">' +
            CHAMP_TXT('Nom', 'personnes.' + i + '.nom', 'EX : BOUQUET') +
            CHAMP_TXT('Prénom', 'personnes.' + i + '.prenom', 'EX : G-P') +
        '</div>' +
    '</div>';
}
// ===================== IMPORT D'UNE LISTE DE PERSONNES (demande collective) =====================
// Un tableau Excel (.xlsx), LibreOffice Calc (.ods) ou CSV : UNITÉ / CIE / GRADE / NOM / PRÉNOM / NID. Lu sur
// l'appareil, sans bibliothèque externe : les .xlsx et .ods sont des archives ZIP de XML, décompressées par le
// navigateur (DecompressionStream). La ligne d'en-tête est reconnue si elle existe, sinon cet ordre de colonnes.
function ZIP_LIRE(buf) {
    var v = new DataView(buf), n = buf.byteLength, fin = -1;
    for (var i = n - 22; i >= Math.max(0, n - 66000); i--) { if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; } }
    if (fin < 0) return Promise.reject(new Error('Fichier illisible (archive attendue).'));
    var total = v.getUint16(fin + 10, true), pos = v.getUint32(fin + 16, true), fichiers = {};
    var dec = new TextDecoder();
    for (var k = 0; k < total; k++) {
        if (v.getUint32(pos, true) !== 0x02014b50) break;
        var methode = v.getUint16(pos + 10, true), taille = v.getUint32(pos + 20, true);
        var ln = v.getUint16(pos + 28, true), le = v.getUint16(pos + 30, true), lc = v.getUint16(pos + 32, true);
        var local = v.getUint32(pos + 42, true), nom = dec.decode(new Uint8Array(buf, pos + 46, ln));
        fichiers[nom] = { methode: methode, taille: taille, local: local };
        pos += 46 + ln + le + lc;
    }
    return Promise.resolve(function lire(nom) {
        var f = fichiers[nom];
        if (!f) return Promise.resolve(null);
        var debut = f.local + 30 + v.getUint16(f.local + 26, true) + v.getUint16(f.local + 28, true);
        var octets = new Uint8Array(buf, debut, f.taille);
        if (f.methode === 0) return Promise.resolve(dec.decode(octets));
        if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Navigateur trop ancien : enregistrez le tableau en CSV.'));
        var flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(flux).text();
    });
}
function XML(t) { return new DOMParser().parseFromString(t, 'application/xml'); }
function ENFANTS(el, nom) { return Array.prototype.filter.call(el.childNodes, function(c) { return c.nodeType === 1 && (c.localName === nom); }); }
function COLONNE_INDEX(ref) { var m = /^([A-Z]+)/.exec(ref || ''), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
// Renvoie toutes les feuilles du classeur (dans l'ordre), chacune sous forme de lignes de cellules.
function LIRE_XLSX(buf) {
    return ZIP_LIRE(buf).then(function(lire) {
        return Promise.all([lire('xl/workbook.xml'), lire('xl/_rels/workbook.xml.rels'), lire('xl/sharedStrings.xml')]).then(function(r) {
            var chemins = [];
            if (r[0] && r[1]) {
                var cibles = {};
                Array.prototype.forEach.call(XML(r[1]).getElementsByTagNameNS('*', 'Relationship'), function(rel) {
                    var c = rel.getAttribute('Target') || '';
                    cibles[rel.getAttribute('Id')] = c.charAt(0) === '/' ? c.slice(1) : 'xl/' + c;
                });
                Array.prototype.forEach.call(XML(r[0]).getElementsByTagNameNS('*', 'sheet'), function(feuille) {
                    var rid = feuille.getAttribute('r:id') || feuille.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
                    if (cibles[rid]) chemins.push(cibles[rid]);
                });
            }
            if (!chemins.length) chemins = ['xl/worksheets/sheet1.xml'];
            var partages = r[2] ? Array.prototype.map.call(XML(r[2]).getElementsByTagNameNS('*', 'si'), function(si) {
                return Array.prototype.map.call(si.getElementsByTagNameNS('*', 't'), function(t) { return t.textContent; }).join('');
            }) : [];
            return Promise.all(chemins.map(lire)).then(function(xmls) {
                xmls = xmls.filter(Boolean);
                if (!xmls.length) throw new Error('Feuille introuvable dans le fichier.');
                return xmls.map(function(xml) {
                    return Array.prototype.map.call(XML(xml).getElementsByTagNameNS('*', 'row'), function(row) {
                        var ligne = [];
                        Array.prototype.forEach.call(row.getElementsByTagNameNS('*', 'c'), function(c, i) {
                            var idx = c.getAttribute('r') ? COLONNE_INDEX(c.getAttribute('r')) : i, type = c.getAttribute('t');
                            var vEl = c.getElementsByTagNameNS('*', 'v')[0], val;
                            if (type === 's') val = partages[+(vEl && vEl.textContent)] || '';
                            else if (type === 'inlineStr') val = Array.prototype.map.call(c.getElementsByTagNameNS('*', 't'), function(t) { return t.textContent; }).join('');
                            else val = vEl ? vEl.textContent : '';
                            if (idx >= 0 && idx < 50) ligne[idx] = val;
                        });
                        return ligne;
                    });
                });
            });
        });
    });
}
function LIRE_ODS(buf) {
    return ZIP_LIRE(buf).then(function(lire) { return lire('content.xml'); }).then(function(xml) {
        if (!xml) throw new Error('Fichier Calc illisible.');
        return Array.prototype.filter.call(XML(xml).getElementsByTagNameNS('*', 'table'), function(t) { return t.localName === 'table'; }).map(function(table) {
        var lignes = [];
        Array.prototype.forEach.call(table.getElementsByTagNameNS('*', 'table-row'), function(row) {
            var ligne = [];
            Array.prototype.filter.call(row.childNodes, function(c) { return c.nodeType === 1 && /table-cell$/.test(c.localName); }).forEach(function(c) {
                var rep = Math.min(+(c.getAttribute('table:number-columns-repeated') || 1), 50);
                var val = c.getAttribute('office:value') || Array.prototype.map.call(c.getElementsByTagNameNS('*', 'p'), function(p) { return p.textContent; }).join(' ');
                for (var i = 0; i < rep && ligne.length < 50; i++) ligne.push(val);
            });
            var repL = Math.min(+(row.getAttribute('table:number-rows-repeated') || 1), 500);
            if (ligne.some(function(x) { return String(x || '').trim(); })) for (var j = 0; j < repL; j++) lignes.push(ligne);
        });
        return lignes;
        });
    });
}
// CSV : UTF-8, ou Windows-1252 (« Enregistrer sous… CSV » d'Excel sur un PC français) si le texte n'est pas de l'UTF-8.
function DECODER_TEXTE(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}
function LIRE_CSV(texte) {
    texte = texte.replace(/^\uFEFF/, '');
    var premiere = texte.split(/\r?\n/)[0] || '';
    var sep = (premiere.match(/;/g) || []).length >= (premiere.match(/,/g) || []).length ? ';' : ',';
    if ((premiere.match(/\t/g) || []).length > (premiere.match(new RegExp(sep, 'g')) || []).length) sep = '\t';
    var lignes = [], ligne = [], champ = '', guill = false;
    for (var i = 0; i < texte.length; i++) {
        var ch = texte[i];
        if (guill) { if (ch === '"') { if (texte[i + 1] === '"') { champ += '"'; i++; } else guill = false; } else champ += ch; continue; }
        if (ch === '"') guill = true;
        else if (ch === sep) { ligne.push(champ); champ = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && texte[i + 1] === '\n') i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
        else champ += ch;
    }
    if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes;
}
var MER_COLONNES_LISTE = ['unite', 'cie', 'grade', 'nom', 'prenom', 'matricule'];
function COLONNE_DEPUIS_ENTETE(t) {
    t = String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    if (/^(unite|entite|uniteentite|formation|regiment)/.test(t)) return 'unite';
    if (/^(cie|compagnie|cieappartenance)/.test(t)) return 'cie';
    if (/^grade/.test(t)) return 'grade';
    if (/^(prenom|prenoms)/.test(t)) return 'prenom';
    if (/^(nom|noms|nomdefamille|nomusage|nomusuel|nomdenaissance)$/.test(t)) return 'nom';
    if (/^(n|no|num|numero)?d?(nid|matricule|id$|identifiant|nia)/.test(t)) return 'matricule';   // « N° NID », « Numéro d'identifiant »…
    return null;
}
function PERSONNES_DEPUIS_LIGNES(lignes) {
    lignes = lignes.filter(function(l) { return l && l.some(function(x) { return String(x == null ? '' : x).trim(); }); });
    if (!lignes.length) return [];
    // La ligne d'en-tête peut être précédée d'un titre (« LISTE DU PERSONNEL… ») : on la cherche dans les 15 premières lignes.
    var iEntete = -1, entete = null;
    for (var n = 0; n < Math.min(lignes.length, 15) && iEntete < 0; n++) {
        var e = lignes[n].map(COLONNE_DEPUIS_ENTETE);
        if (e.filter(Boolean).length >= 3) { iEntete = n; entete = e; }
    }
    var colonnes = entete || MER_COLONNES_LISTE;
    return lignes.slice(iEntete + 1).map(function(l) {
        var p = VIDE_PERSONNE();
        colonnes.forEach(function(k, i) { if (k) p[k] = String(l[i] == null ? '' : l[i]).trim(); });
        var chiffres = p.matricule.replace(/\D/g, '');
        if (chiffres.length === 9 && /^\d+(\.0+)?$/.test(p.matricule)) chiffres = '0' + chiffres;   // zéro de tête perdu par le tableur (cellule nombre)
        p.matricule = chiffres ? FORMAT_MATRICULE(chiffres) : '';
        p.nom = p.nom.toUpperCase(); p.grade = p.grade.toUpperCase();
        return p;
    }).filter(function(p) { return p.nom || p.prenom; });
}
function IMPORTER_LISTE_PERSONNES(input) {
    var f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    var nom = f.name.toLowerCase();
    if (/\.xls$/.test(nom)) { MSG_ERREUR('Format non pris en charge', 'Ancien format Excel (.xls) : enregistrez le tableau en .xlsx (ou .csv) puis importez-le.'); return; }
    var lecture = /\.csv$|\.txt$/.test(nom) ? f.arrayBuffer().then(function(b) { return [LIRE_CSV(DECODER_TEXTE(b))]; })
        : f.arrayBuffer().then(function(b) { return /\.ods$/.test(nom) ? LIRE_ODS(b) : LIRE_XLSX(b); });
    // Classeur à plusieurs feuilles : d'abord une feuille avec une ligne d'en-têtes, sinon la première qui donne des personnes.
    lecture.then(function(feuilles) {
        var avecEntete = feuilles.filter(function(f) {
            return f.slice(0, 15).some(function(l) { return (l || []).map(COLONNE_DEPUIS_ENTETE).filter(Boolean).length >= 3; });
        });
        var ordre = avecEntete.concat(feuilles.filter(function(f) { return avecEntete.indexOf(f) < 0; }));
        for (var i = 0; i < ordre.length; i++) { var l = PERSONNES_DEPUIS_LIGNES(ordre[i]); if (l.length) return l; }
        return [];
    }).then(function(liste) {
        if (!liste.length) { MSG_ERREUR('Aucune personne trouvée', 'Le tableau doit contenir les colonnes UNITÉ, CIE, GRADE, NOM, PRÉNOM, NID (une personne par ligne).'); return; }
        var cle = function(p) { var m = (p.matricule || '').replace(/\D/g, ''); return m.length === 10 ? m : (p.nom + '|' + p.prenom).toUpperCase(); };
        var actuelles = D.personnes.filter(function(p) { return p.nom || p.prenom || p.matricule; });
        var vues = {}; actuelles.forEach(function(p) { vues[cle(p)] = true; });
        var ajout = liste.filter(function(p) { var k = cle(p); if (vues[k]) return false; vues[k] = true; return true; });
        D.personnes = actuelles.concat(ajout);
        if (!D.personnes.length) D.personnes = [VIDE_PERSONNE()];
        SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE();
        var douteux = ajout.filter(function(p) { return p.matricule.replace(/\D/g, '').length !== 10 || !p.grade || !p.nom || !p.prenom; }).length;
        MSG_INFO('Liste importée', ajout.length + ' personne(s) ajoutée(s)' + (liste.length - ajout.length ? ', ' + (liste.length - ajout.length) + ' déjà présente(s)' : '') +
            '. La demande compte maintenant ' + D.personnes.length + ' personne(s).' +
            (douteux ? '\n\n⚠ ' + douteux + ' ligne(s) incomplète(s) ou matricule sans 10 chiffres : vérifiez-les (en rouge à l\'étape suivante).' : ''), '✅', 'mascotte-ok.webp');
    }).catch(function(e) { MSG_ERREUR('Import impossible', e.message || String(e)); });
}
function TELECHARGER_MODELE_LISTE() {
    var csv = '\uFEFFUNITÉ;CIE;GRADE;NOM;PRÉNOM;NID\r\n4°RIISC;4CIE;ADJUDANT;DUPONT;Jean;067 50 10 191\r\n';
    TELECHARGER_TEXTE('modele_liste_personnel.csv', csv, 'text/csv;charset=utf-8');
}
function AJOUTER_PERSONNE() { D.personnes.push(VIDE_PERSONNE()); SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }
// Carte TRIGONE scannée : la personne rejoint la demande (unité, CIE, grade, nom, prénom, matricule), sans rien taper.
function SCANNER_PERSONNES() {
    JUMELAGE_SCANNER_CARTE({ titre: 'Ajouter des personnes', sous: 'Scannez la carte TRIGONE de chaque personne de la mission.', continu: function(c) {
        var nid = String(c.nid || '').replace(/\D/g, '');
        var deja = D.personnes.some(function(p) { return nid && String(p.matricule || '').replace(/\D/g, '') === nid; });
        if (deja) return { deja: true, texte: 'Déjà dans la demande' };
        var p = { unite: c.unite || '', cie: c.cie || '', grade: c.grade || '', nom: (c.nom || '').toUpperCase(), prenom: c.prenom || '', matricule: c.nid || '' };
        var vide = D.personnes.filter(function(x) { return !x.nom && !x.prenom && !x.matricule; })[0];
        if (vide) Object.assign(vide, p); else D.personnes.push(Object.assign(VIDE_PERSONNE(), p));
        SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE();
        return { texte: '✔ Ajouté (' + D.personnes.length + ')' };
    } });
}
function RETIRER_PERSONNE(i) { D.personnes.splice(i, 1); SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }

// Pays étrangers : liste reprise de TRIGONE compte-rendu. Vide = France.
var MER_PAYS = ["AFGHANISTAN", "AFRIQUE DU SUD", "ALBANIE", "ALGERIE", "ALLEMAGNE", "ANDORRE", "ANGOLA", "ANGUILLA", "ANTIGUA ET BARBUDA", "ARABIE SAOUDITE", "ARGENTINE", "ARMENIE", "ARUBA", "AUSTRALIE", "AUTRICHE", "AZERBAIDJAN", "BAHAMAS", "BAHREIN", "BANGLADESH", "BELGIQUE", "BELIZE", "BENIN", "BERMUDES", "BIELORUSSIE", "BIRMANIE", "BOLIVIE", "BOSNIE-HERZEGOVINE", "BOTSWANA", "BRESIL", "BRUNEI", "BULGARIE", "BURKINA FASO", "BURUNDI", "CAIMANS (iles)", "CAMBODGE", "CAMEROUN", "CANADA", "CAP-VERT", "CENTRAFRICAINE (Republique)", "CHILI", "CHINE", "CHYPRE", "COLOMBIE", "COMORES", "CONGO (Republique democratique du)", "CONGO BRAZZAVILLE", "COOK (iles)", "COREE DU NORD", "COREE DU SUD", "COSTA RICA", "COTE D'IVOIRE", "CROATIE", "CUBA", "CURACAO", "DANEMARK", "DJIBOUTI", "DOMINICAINE (Republique)", "EGYPTE", "EMIRATS ARABES UNIS", "EQUATEUR", "ERYTHREE", "ESPAGNE", "ESTONIE", "ETATS-UNIS", "ETATS-UNIS (hors New York)", "ETHIOPIE", "FIDJI", "FINLANDE", "GABON", "GAMBIE", "GEORGIE", "GHANA", "GRANDE-BRETAGNE", "GRECE", "GRENADE", "GUATEMALA", "GUINEE", "GUINEE EQUATORIALE", "GUINEE-BISSAU", "GUYANA", "HAITI", "HONDURAS", "HONG KONG", "HONGRIE", "INDE", "INDONESIE", "IRAK", "IRAN", "IRLANDE", "ISLANDE", "ISRAEL", "ITALIE", "JAMAIQUE", "JAPON", "JORDANIE", "KAZAKHSTAN", "KENYA", "KIRGHIZISTAN", "KIRIBATI", "KOSOVO", "KOWEIT", "LA BARBADE", "LA DOMINIQUE", "LAOS", "LESOTHO", "LETTONIE", "LIBAN", "LIBERIA", "LIBYE", "LIECHTENSTEIN", "LITUANIE", "LUXEMBOURG", "MACAO", "MACEDOINE", "MADAGASCAR", "MALAISIE", "MALAWI", "MALDIVES (iles)", "MALI", "MALTE", "MAROC", "MARSHALL (iles)", "MAURICE", "MAURITANIE", "MEXIQUE", "MICRONESIE", "MOLDAVIE", "MONGOLIE EXTERIEURE", "MONTENEGRO", "MOZAMBIQUE", "NAMIBIE", "NAURU", "NEPAL", "NICARAGUA", "NIGER", "NIGERIA", "NIUE", "NORVEGE", "NOUVELLE-ZELANDE", "OMAN", "OUGANDA", "OUZBEKISTAN", "PAKISTAN", "PALAOS (iles)", "PANAMA", "PAPOUASIE-NOUVELLE-GUINEE", "PARAGUAY", "PAYS-BAS", "PEROU", "PHILIPPINES", "POLOGNE", "PORTUGAL", "QATAR", "ROUMANIE", "RUSSIE", "RWANDA", "SAINT-CHRISTOPHE-ET-NIEVES", "SAINT-VINCENT ET LES GRENADINES", "SAINTE-LUCIE", "SALOMON", "SALVADOR", "SAMOA", "SAO TOME ET PRINCIPE", "SENEGAL", "SERBIE", "SEYCHELLES", "SIERRA LEONE", "SINGAPOUR", "SLOVAQUIE", "SLOVENIE", "SOMALIE", "SOUDAN", "SOUDAN DU SUD", "SRI LANKA", "SUEDE", "SUISSE", "SURINAME", "SWAZILAND", "SYRIE", "TADJIKISTAN", "TAIWAN", "TANZANIE", "TCHAD", "TCHEQUE (Republique)", "THAILANDE", "TIMOR ORIENTAL", "TOGO", "TONGA", "TRINITE ET TOBAGO", "TUNISIE", "TURKMENISTAN", "TURQUIE", "TUVALU", "UKRAINE", "URUGUAY", "VANUATU", "VENEZUELA", "VIETNAM", "YEMEN", "ZAMBIE", "ZIMBABWE"];

function TPL_LIEU(label, path, cote) {
    var t = GET_CHAMP(path), pays = t['pays' + cote] || '', id = 'MER-VILLES-' + path.replace(/\./g, '-') + cote;
    var options = '<option value="">France</option>' + MER_PAYS.map(function(p) {
        return '<option value="' + ESC(p) + '"' + (p === pays ? ' selected' : '') + '>' + ESC(p) + '</option>';
    }).join('');
    // Ville et code postal dans un seul champ : on tape la ville, le code postal se met à côté (modifiable).
    var ville = '<div class="MER-FIELD"><label>' + label + (pays ? '' : ' <span class="MER-LABEL-FIN">· code postal automatique</span>') + '</label>' +
        (pays ? '' : '<div class="MER-VILLE-CP">') +
        '<input type="text" data-path="' + path + '.lieu' + cote + '" value="' + ESC(t['lieu' + cote] || '') + '" ' +
        'placeholder="' + (pays ? 'EX : Berlin' : 'EX : Bordeaux') + '" autocomplete="off"' + (pays ? '' : ' list="' + id + '"') + ' ' +
        'oninput="ON_CHAMP_INPUT(\'' + path + '.lieu' + cote + '\', this.value)' + (pays ? '' : '; SUGGERER_VILLES(this, \'' + id + '\')') + '" ' +
        (pays ? '' : 'onchange="CHOISIR_VILLE(\'' + path + '\', \'' + cote + '\', this)"') + '>' +
        (pays ? '' : '<input type="text" class="MER-CP-IN" data-path="' + path + '.cp' + cote + '" value="' + ESC(t['cp' + cote] || '') + '" placeholder="CP" inputmode="numeric" maxlength="5" ' +
            'aria-label="Code postal" oninput="this.value=this.value.replace(/\\D/g, \'\'); ON_CHAMP_INPUT(\'' + path + '.cp' + cote + '\', this.value)"></div>') +
        (pays ? '' : '<datalist id="' + id + '"></datalist>') + '</div>';
    return ville +
        '<div class="MER-FIELD" style="margin-top:-8px;"><label>Pays</label><select data-path="' + path + '.pays' + cote + '" ' +
        'onchange="ON_CHAMP_BOOL(\'' + path + '.pays' + cote + '\', this.value)">' + options + '</select></div>';
}
function TPL_TRAJET(titre, path, optionnel) {
    var moyen = GET_CHAMP(path + '.moyen'), lib = LIBELLES_LIEUX(moyen);
    return (titre ? '<p class="MER-HINT" style="font-weight:800; text-transform:uppercase; letter-spacing:0.04em; margin:14px 0 8px;">' + titre + (optionnel ? ' <span style="font-weight:600; text-transform:none;">(si besoin)</span>' : '') + '</p>' : '') +
        SELECT_MOYEN(path + '.moyen') +
        (moyen === 'CIVILE' ? '<p class="MER-HINT" style="margin:-8px 0 12px; color:#b45309; font-weight:700;">🚗 VRC : pensez à joindre ' + MER_PIECES_VRC + ' (onglet Imputation).</p>' : '') +
        TPL_LIEU(lib[0], path, 'Dep') +
        CHAMP_TXT('Date et heure de départ', path + '.dateDep', '', 'datetime-local') +
        TPL_LIEU(lib[1], path, 'Arr') +
        CHAMP_TXT('Date et heure d\'arrivée', path + '.dateArr', '', 'datetime-local');
}

// Communes françaises : même service que TRIGONE compte-rendu (Base adresse nationale, api-adresse.data.gouv.fr).
var MER_API_COMMUNES = 'https://api-adresse.data.gouv.fr/search/?type=municipality&autocomplete=1&limit=6&q=';
var MER_MINUTEUR_VILLES = null;
// Hors ligne : les villes déjà trouvées sur cet appareil restent proposées, avec leur code postal.
var STORAGE_VILLES_CONNUES = 'mer_villes_connues';
function VILLES_CONNUES() { try { return JSON.parse(localStorage.getItem(STORAGE_VILLES_CONNUES) || '{}'); } catch (e) { return {}; } }
function RETENIR_VILLES(communes) {
    var v = VILLES_CONNUES();
    communes.forEach(function(c) { v[c.ville] = c.cp; });
    var cles = Object.keys(v);
    if (cles.length > 400) cles.slice(0, cles.length - 400).forEach(function(k) { delete v[k]; });
    try { localStorage.setItem(STORAGE_VILLES_CONNUES, JSON.stringify(v)); } catch (e) {}
}
function CHERCHER_COMMUNES(q) {
    return fetch(MER_API_COMMUNES + encodeURIComponent(q)).then(function(r) { return r.json(); }).then(function(d) {
        var communes = (d.features || []).map(function(f) {
            return { ville: (f.properties.city || f.properties.name || '').toUpperCase(), cp: f.properties.postcode || '' };
        }).filter(function(c) { return c.ville && c.cp; });
        RETENIR_VILLES(communes);
        return communes;
    }).catch(function() {
        var v = VILLES_CONNUES(), debut = q.toUpperCase();
        return Object.keys(v).filter(function(k) { return k.indexOf(debut) === 0; }).slice(0, 6).map(function(k) { return { ville: k, cp: v[k] }; });
    });
}
// Code postal introuvable (hors ligne, ville jamais saisie sur cet appareil) : on invite à le taper, une fois par session.
var MER_AVIS_CP_HORS_LIGNE = false;
function SIGNALER_CP_A_SAISIR(path, cote) {
    var cp = document.querySelector('[data-path="' + path + '.cp' + cote + '"]');
    if (!cp || cp.value) return;
    cp.classList.add('MER-ERREUR');
    if (navigator.onLine || MER_AVIS_CP_HORS_LIGNE) return;
    MER_AVIS_CP_HORS_LIGNE = true;
    MSG_INFO('Hors connexion', 'Sans réseau, TRIGONE ne peut pas trouver le code postal tout seul (sauf pour les villes déjà saisies sur cet appareil). Tapez-le dans la case « CP » à droite de la ville : la demande se remplit normalement hors ligne.', '📴');
}
function SUGGERER_VILLES(input, listeId) {
    clearTimeout(MER_MINUTEUR_VILLES);
    var q = input.value.replace(/\s*\(\d{4,6}\)\s*$/, '').trim();
    if (q.length < 2) return;
    MER_MINUTEUR_VILLES = setTimeout(function() {
        CHERCHER_COMMUNES(q).then(function(communes) {
            var dl = document.getElementById(listeId);
            if (dl) dl.innerHTML = communes.map(function(c) { return '<option value="' + ESC(c.ville + ' (' + c.cp + ')') + '"></option>'; }).join('');
        }).catch(function() {});
    }, 250);
}
// Ville choisie (ou saisie) : on sépare « VILLE (CP) », sinon on demande le code postal au service.
function CHOISIR_VILLE(path, cote, input) {
    var brut = input.value.trim(), m = /^(.*?)\s*\((\d{4,6})\)$/.exec(brut);
    function poser(ville, cp) {
        ON_CHAMP_INPUT(path + '.lieu' + cote, ville); input.value = ville;
        ON_CHAMP_INPUT(path + '.cp' + cote, cp); MAJ_CHAMP_DOM(path + '.cp' + cote);
    }
    if (m) { poser(m[1].toUpperCase(), m[2]); return; }
    if (brut.length < 2) return;
    CHERCHER_COMMUNES(brut).then(function(c) {
        if (c[0] && c[0].ville.toUpperCase() === brut.toUpperCase()) poser(c[0].ville, c[0].cp);
        else if (c[0] && !GET_CHAMP(path + '.cp' + cote)) poser(c[0].ville, c[0].cp);
        else SIGNALER_CP_A_SAISIR(path, cote);
    }).catch(function() { SIGNALER_CP_A_SAISIR(path, cote); });
}

// ===================== ONGLETS DU FORMULAIRE =====================
// Champs obligatoires de chaque onglet : on ne passe à l'onglet suivant que si le précédent est complet.
function MANQUES_ONGLET(tab) {
    var m = [];
    function exiger(path, libelle) { if (!String(GET_CHAMP(path) || '').trim()) m.push({ path: path, libelle: libelle }); }
    if (tab === 'IDENTITE') {
        exiger('objet', 'Objet');
        D.personnes.forEach(function(p, i) {
            var qui = D.personnes.length > 1 ? ' (personne ' + (i + 1) + ')' : '';
            [['unite', 'Unité / entité'], ['cie', 'CIE'], ['grade', 'Grade'], ['nom', 'Nom'], ['prenom', 'Prénom']].forEach(function(c) {
                exiger('personnes.' + i + '.' + c[0], c[1] + qui);
            });
            if ((p.matricule || '').replace(/\D/g, '').length !== 10) m.push({ path: 'personnes.' + i + '.matricule', libelle: 'Matricule à 10 chiffres' + qui });
        });
    } else if (tab === 'ALLER' || tab === 'RETOUR') {
        var t = D.trajets, blocs;
        if (tab === 'ALLER') {
            exiger('trajets.aller.residenceDep', 'Lieu de départ de mission');
            blocs = [['aller', 'Aller']];
            if (t.intermediaireAllerActif) blocs.push(['intermediaireAller', 'Intermédiaire aller']);
        } else {
            exiger('trajets.retour.residenceArr', 'Lieu de retour de mission');
            blocs = [['retour', 'Retour']];
            if (t.intermediaireRetourActif) blocs.push(['intermediaireRetour', 'Intermédiaire retour']);
        }
        blocs.forEach(function(b) {
            var tr = t[b[0]], base = 'trajets.' + b[0] + '.';
            exiger(base + 'moyen', b[1] + ' : moyen de transport');
            var lib = LIBELLES_LIEUX(tr.moyen);
            exiger(base + 'lieuDep', b[1] + ' : ' + lib[0].toLowerCase());
            if (!tr.paysDep) exiger(base + 'cpDep', b[1] + ' : code postal de départ');
            exiger(base + 'dateDep', b[1] + ' : date et heure de départ');
            exiger(base + 'lieuArr', b[1] + ' : ' + lib[1].toLowerCase());
            if (!tr.paysArr) exiger(base + 'cpArr', b[1] + ' : code postal d\'arrivée');
            exiger(base + 'dateArr', b[1] + ' : date et heure d\'arrivée');
            if (tr.dateDep && tr.dateArr && tr.dateArr < tr.dateDep) m.push({ path: base + 'dateArr', libelle: b[1] + ' : l\'arrivée est avant le départ' });
        });
    } else if (tab === 'IMPUTATION') {
        exiger('codeFD', 'Code d\'engagement FD@LIGNE');
    }
    return m;
}
function ONGLET_COMPLET(tab) { return MANQUES_ONGLET(tab).length === 0; }
function SIGNALER_MANQUES(manques) {
    manques.forEach(function(x) {
        var el = document.querySelector('[data-path="' + x.path + '"]');
        if (el) el.classList.add('MER-ERREUR');
    });
    var premier = document.querySelector('.MER-ERREUR');
    if (premier) premier.scrollIntoView({ behavior: 'smooth', block: 'center' });
    MSG_ERREUR('À compléter', '• ' + manques.slice(0, 10).map(function(x) { return x.libelle; }).join('\n• ') +
        (manques.length > 10 ? '\n… et ' + (manques.length - 10) + ' autre(s)' : ''), true);
}
// Aller vers un onglet : libre en arrière ; en avant, tous les onglets précédents doivent être complets.
function SWITCH_MER_TAB(tab) {
    var cible = MER_TABS_ORDRE.indexOf(tab);
    for (var i = 0; i < cible; i++) {
        var manques = MANQUES_ONGLET(MER_TABS_ORDRE[i]);
        if (!manques.length) continue;
        if (MER_TABS_ORDRE[i] !== MER_ACTIVE_TAB) { MER_ACTIVE_TAB = MER_TABS_ORDRE[i]; RENDER_FORMULAIRE_INPLACE(); }
        SIGNALER_MANQUES(manques);
        return;
    }
    MER_ACTIVE_TAB = tab;
    RENDER_FORMULAIRE_INPLACE();
    window.scrollTo(0, 0);
}
function MER_TAB_SUIVANT() {
    var idx = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB);
    if (idx < MER_TABS_ORDRE.length - 1) { SWITCH_MER_TAB(MER_TABS_ORDRE[idx + 1]); return; }
    var manques = MANQUES_ONGLET(MER_ACTIVE_TAB);
    if (manques.length) { SIGNALER_MANQUES(manques); return; }
    AJOUTER_AU_PANIER();
}
function MER_TAB_PRECEDENT() {
    var idx = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB);
    if (idx > 0) SWITCH_MER_TAB(MER_TABS_ORDRE[idx - 1]);
}

function TPL_TABS_BAR() {
    // Onglet déjà passé et complet : coche ; onglet derrière un onglet incomplet : verrouillé.
    var ouvert = true, courant = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB);
    return '<div class="MER-TABS">' + MER_TABS_ORDRE.map(function(t, i) {
        var complet = ONGLET_COMPLET(t);
        var etat = i === courant ? ' active' : (!ouvert ? ' verrou' : (complet && i < courant ? ' fait' : ''));
        var html = '<button type="button" class="MER-TAB' + etat + '" onclick="SWITCH_MER_TAB(\'' + t + '\')">' +
            '<span class="MER-TAB-NUM">' + (etat === ' fait' ? '✓' : (etat === ' verrou' ? '🔒' : i + 1)) + '</span>' +
            '<span class="MER-TAB-LBL">' + MER_TABS_LABELS[t] + '</span></button>';
        if (!complet) ouvert = false;
        return html;
    }).join('') + '</div>';
}

function TPL_ONGLET_IDENTITE() {
    return '<div class="MER-TOGGLE-PAIR" style="margin-bottom:16px;">' +
        '<button type="button" class="MER-TOGGLE-BTN' + (D.type === 'MISSION' ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'type\', \'MISSION\')">Mission</button>' +
        '<button type="button" class="MER-TOGGLE-BTN' + (D.type === 'FORMATION' ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'type\', \'FORMATION\')">Formation / stage</button>' +
      '</div>' +
      '<div class="MER-FIELD"><label>Objet</label><textarea rows="2" data-path="objet" oninput="ON_CHAMP_INPUT(\'objet\', this.value)" placeholder="EX : Formation conseiller facteur humain">' + ESC(D.objet || '') + '</textarea></div>' +
      '<div class="MER-SECTION-TITLE">Personnel concerné</div>' +
      D.personnes.map(function(_, i) { return TPL_PERSONNE(i); }).join('') +
      '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="AJOUTER_PERSONNE()">+ Ajouter une personne (demande collective)</button>' +
      (window.JUMELAGE_SCANNER_CARTE ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-top:8px;" onclick="SCANNER_PERSONNES()">📷 Scanner des cartes TRIGONE</button>' : '') +
      '<label class="BTN BTN-GHOST BTN-SMALL" style="margin-top:8px;">📥 Importer une liste (Excel, Calc ou CSV)' +
        '<input type="file" accept=".xlsx,.ods,.csv,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel" style="display:none;" onchange="IMPORTER_LISTE_PERSONNES(this)"></label>' +
      '<p class="MER-HINT" style="text-align:center;">Colonnes : UNITÉ · CIE · GRADE · NOM · PRÉNOM · NID. <a href="#" onclick="TELECHARGER_MODELE_LISTE(); return false;">Télécharger le modèle</a></p>';
}

function SELECT_RESIDENCE(label, path) {
    var v = GET_CHAMP(path) || '';
    var opts = '<option value="">— Choisir —</option>' + Object.keys(MER_RESIDENCES).map(function(k) {
        return '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + MER_RESIDENCES[k].toUpperCase() + '</option>';
    }).join('');
    return '<div class="MER-FIELD"><label>' + label + '</label><select data-path="' + path + '" onchange="ON_CHAMP_INPUT(\'' + path + '\', this.value)">' + opts + '</select></div>';
}
function TPL_ONGLET_ALLER() {
    var inter = !!D.trajets.intermediaireAllerActif;
    return '<div class="MER-SECTION-TITLE" style="margin-top:0;">Trajet aller</div>' +
      SELECT_RESIDENCE('Lieu de départ de mission', 'trajets.aller.residenceDep') +
      TPL_TRAJET('', 'trajets.aller') +
      '<label class="MER-CHECKBOX-ROW"><input type="checkbox" ' + (inter ? 'checked' : '') + ' onchange="ON_CHAMP_BOOL(\'trajets.intermediaireAllerActif\', this.checked)"><span>Trajet intermédiaire sur l\'aller</span></label>' +
      (inter ? TPL_TRAJET('Trajet intermédiaire (aller)', 'trajets.intermediaireAller') : '');
}
function TPL_ONGLET_RETOUR() {
    var inter = !!D.trajets.intermediaireRetourActif;
    return '<div class="MER-SECTION-TITLE" style="margin-top:0;">Trajet retour</div>' +
      '<p class="MER-HINT" style="margin:-6px 0 12px;">Pré-rempli avec l\'aller inversé : modifiez si besoin.</p>' +
      SELECT_RESIDENCE('Lieu de retour de mission', 'trajets.retour.residenceArr') +
      TPL_TRAJET('', 'trajets.retour') +
      '<label class="MER-CHECKBOX-ROW"><input type="checkbox" ' + (inter ? 'checked' : '') + ' onchange="ON_CHAMP_BOOL(\'trajets.intermediaireRetourActif\', this.checked)"><span>Trajet intermédiaire sur le retour</span></label>' +
      (inter ? TPL_TRAJET('Trajet intermédiaire (retour)', 'trajets.intermediaireRetour') : '');
}

// Option « Demande de réservation » (profil TRIGONE) : libellé de l'unité (ex : « Amplitude (ABT) »), deux choix.
function MER_RESA() { return window.JUMELAGE_RESA ? JUMELAGE_RESA() : { active: true, libelle: 'Demande de réservation', defaut: true }; }
function MER_RESA_TITRE() { var o = MER_RESA(); return o.defaut ? 'Demande de réservation' : 'Demande de réservation — ' + o.libelle; }
// Anciennes demandes : « Réservation ABT » OUI valait pour le transport.
function MER_RESA_TRANSPORT(d) { return !!(d.resaTransport || d.reservationABT); }
function TPL_RESERVATION() {
    if (!MER_RESA().active) return '';
    var bouton = function(libelle, path, v) {
        return '<button type="button" class="MER-TOGGLE-BTN' + (v ? ' actif' : '') + '" aria-pressed="' + v + '" onclick="' + (path === 'resaTransport' ? 'D.reservationABT = false; ' : '') + 'ON_CHAMP_BOOL(\'' + path + '\', ' + !v + ')">' + (v ? '✓ ' : '') + libelle + '</button>';
    };
    return '<div class="MER-FIELD" data-champ="reservation"><label>' + ESC(MER_RESA_TITRE()) + '</label>' +
        '<div class="MER-TOGGLE-PAIR">' + bouton('Hébergement', 'resaHeberg', !!D.resaHeberg) + bouton('Transport', 'resaTransport', MER_RESA_TRANSPORT(D)) + '</div>' +
        '<p class="MER-HINT">Cochez ce qui doit être réservé (l\'un, l\'autre ou les deux). Au retour, Compte-rendu le reprend : transport sur les trajets en train, avion ou bateau ; hébergement à choisir nuit par nuit.</p></div>';
}

// Réservation demandée (onglet Alim./Héb.) : rappel de joindre la demande de réservation avec la NDS ou la DAF.
function TPL_RAPPEL_RESA() {
    if (!(D.resaHeberg || MER_RESA_TRANSPORT(D))) return '';
    var quoi = [D.resaHeberg ? 'hébergement' : '', MER_RESA_TRANSPORT(D) ? 'transport' : ''].filter(Boolean).join(' et ');
    return '<p class="MER-HINT MER-RAPPEL-RESA" style="color:#b45309; font-weight:700; margin:-4px 0 12px;">📎 Vous avez demandé une réservation (' + quoi + ') : joignez aussi la <b>' +
        ESC(MER_RESA().defaut ? 'demande de réservation' : 'demande de réservation — ' + MER_RESA().libelle) + '</b>, avec la NDS ou la DAF.</p>';
}
function TPL_ONGLET_CONDITIONS() {
    // Demande de réservation en tête de l'onglet, au-dessus de « Durant le déplacement ».
    var resa = TPL_RESERVATION();
    return resa + '<div class="MER-SECTION-TITLE"' + (resa ? '' : ' style="margin-top:0;"') + '>Durant le déplacement</div>' +
      TOGGLE_OUI_NON('Nourri à titre onéreux', 'nourriDeplacement') +
      TOGGLE_OUI_NON('Transport en commun', 'transportCommun') +
      '<div class="MER-SECTION-TITLE">Durant la mission</div>' +
      TOGGLE_OUI_NON('Nourri à titre onéreux', 'nourriMission') +
      TOGGLE_OUI_NON('Logé à titre onéreux', 'logeMission');
}

// ---- Codier FD (codier.json ; sa date d'extraction est dans la clé « _source ») ----
var MER_CODIER = null, MER_CODIER_CHARGEMENT = null;
function CHARGER_CODIER() {
    if (!MER_CODIER_CHARGEMENT) {
        MER_CODIER_CHARGEMENT = fetch('codier.json').then(function(r) { return r.json(); })
            .then(function(c) { MER_CODIER = c; return c; })
            .catch(function() { MER_CODIER_CHARGEMENT = null; return null; });
    }
    return MER_CODIER_CHARGEMENT;
}
function TPL_INFO_FD() {
    var code = (D.codeFD || '').toUpperCase();
    if (!code) return '';
    if (!MER_CODIER) {
        CHARGER_CODIER().then(function(c) { if (c) AFFICHER_CODE_FD(); });
        return '<p class="MER-HINT">Recherche dans le codier FD…</p>';
    }
    var e = MER_CODIER[code];
    if (!e) return code.length < 10 ? '' : '<p class="MER-HINT" style="color:#b91c1c; font-weight:800;">✖ Code inconnu du codier FD : vérifiez-le.</p>';
    if (!e.cf) {
        return '<p class="MER-HINT" style="color:#b45309; font-weight:800;">⚠ Code clôturé le ' + ESC(new Date(e.fin).toLocaleDateString('fr-FR')) + '.' +
            (e.dev ? ' Code de remplacement : <button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto; display:inline-block; margin-left:4px;" onclick="UTILISER_CODE_FD(\'' + ESC(e.dev) + '\')">' + ESC(e.dev) + '</button>' : '') + '</p>';
    }
    function ligne(l, v) { return '<div class="MER-FD-LIGNE"><span>' + l + '</span><b>' + ESC(v || '—') + '</b></div>'; }
    var u = MER_CODE_UNITE(code), nomU = u ? ESC(MER_UNITE().nom) : '';
    return '<div class="MER-FD-CARTE' + (u === 'hors' ? ' hors' : '') + '">' +
        (u ? '<div class="MER-FD-UNITE ' + u + '">' + (u === 'unite' ? '● Code du ' + nomU : '● Hors ' + nomU + ' : code d\'une autre unité') + '</div>' : '') +
        '<div class="MER-FD-TITRE">' + (u === 'hors' ? '⚠ ' : '✔ ') + ESC(e.lib) + '</div>' +
        ligne('Code engagement', code) + ligne('Centre financier', e.cf) + ligne('Centre de coût', e.cc) + ligne('Code activité', e.act) +
        (e.fin ? '<p class="MER-HINT">Valable jusqu\'au ' + ESC(new Date(e.fin).toLocaleDateString('fr-FR')) + '.</p>' : '') +
    '</div>';
}
// Unité de l'utilisateur (profil « Unité / entité ») et ses codes FD : ceux qui partagent son centre de coût dans le codier.
// 4°RIISC → « UIISC n°4 » du codier ; une autre unité est reconnue par le début du libellé de ses codes (« RIMAP NOUCAL… »).
// Code de l'unité : vert ; code d'une autre unité : jaune (dans la demande et dans le registre de l'assistant Chorus DT).
var MER_UNITE_CACHE = null;
function MER_UNITE() {
    var r = window.JUMELAGE_REGLAGES_LIRE ? JUMELAGE_REGLAGES_LIRE() || {} : {}, nom = (r.unite || '').trim();
    if (!nom || !MER_CODIER) return null;
    if (MER_UNITE_CACHE && MER_UNITE_CACHE.nom === nom && MER_UNITE_CACHE.codier === MER_CODIER) return MER_UNITE_CACHE.u;
    var connue = window.JUMELAGE_UNITE_INFO && JUMELAGE_UNITE_INFO(nom);
    if (connue) { var cc0 = {}; [].concat(connue.cc).forEach(function(c) { cc0[c] = 1; }); MER_UNITE_CACHE = { nom: nom, codier: MER_CODIER, u: { nom: connue.nom, cc: cc0 } }; return MER_UNITE_CACHE.u; }
    var norme = function(t) { return String(t || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, ''); };
    var m = /(\d+)\s*(?:°|E|EME|ER|ERE)?\s*[RU]IISC/i.exec(nom), cle = m ? 'UIISCN' + m[1] : norme(nom), cc = {};
    Object.keys(MER_CODIER).forEach(function(k) {
        var e = MER_CODIER[k]; if (!e || !e.cc || !e.lib) return;
        var debut = norme(e.lib.split(' - ')[0]);
        if (debut === cle || (!m && cle.length >= 4 && debut.indexOf(cle) === 0)) cc[e.cc] = 1;
    });
    var u = Object.keys(cc).length ? { nom: nom, cc: cc } : null;
    MER_UNITE_CACHE = { nom: nom, codier: MER_CODIER, u: u };
    return u;
}
// 'unite' (code de mon unité), 'hors' (code actif d'une autre unité) ou '' (inconnu, clôturé, unité non reconnue).
function MER_CODE_UNITE(code) {
    var e = MER_CODIER && MER_CODIER[String(code || '').toUpperCase()], u = MER_UNITE();
    if (!e || !e.cc || !u) return '';
    return u.cc[e.cc] ? 'unite' : 'hors';
}
// Recopie dans la demande les imputations du codier, pour le PDF et les valideurs.
function AFFICHER_CODE_FD() {
    var e = MER_CODIER && MER_CODIER[(D.codeFD || '').toUpperCase()];
    if (e && e.cf) D.imputationFD = { cf: e.cf, cc: e.cc, act: e.act, lib: e.lib };
    else delete D.imputationFD;
    SAVE_BROUILLON();
    var zone = document.getElementById('MER-FD-INFO');
    if (zone) zone.innerHTML = TPL_INFO_FD();
}
function UTILISER_CODE_FD(code) { D.codeFD = code; MAJ_CHAMP_DOM('codeFD'); AFFICHER_CODE_FD(); }

function TPL_ONGLET_IMPUTATION() {
    return '<div class="MER-SECTION-TITLE" style="margin-top:0;">Imputation</div>' +
      TOGGLE_OUI_NON('Mission imputée à l\'unité', 'missionImputee', '', 'Fournir le justificatif de l\'autorité ayant prescrit le déplacement.') +
      '<div class="MER-FIELD"><label>Code d\'engagement FD@LIGNE</label>' +
        '<input type="text" data-path="codeFD" value="' + ESC(D.codeFD || '') + '" placeholder="EX : FD1ADSJ11F" autocapitalize="characters" autocomplete="off" ' +
        'oninput="this.value=this.value.toUpperCase().replace(/\\s/g, \'\'); ON_CHAMP_INPUT(\'codeFD\', this.value); AFFICHER_CODE_FD()"></div>' +
      '<div id="MER-FD-INFO">' + TPL_INFO_FD() + '</div>' +
      TOGGLE_OUI_NON('Demande d\'avance', 'demandeAvance') +
      '<div class="MER-SECTION-TITLE">NDS ou DAF</div>' +
      TPL_RAPPEL_RESA() +
      TPL_PJ_FORMULAIRE() +
      '<div class="MER-FIELD"><label>Référence (facultatif)</label><textarea rows="2" oninput="ON_CHAMP_INPUT(\'piecesJointes\', this.value)" placeholder="EX : NDS n°42/2026">' + ESC(D.piecesJointes || '') + '</textarea></div>';
}

function TPL_FORMULAIRE() {
    var idx = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB);
    var dernier = idx === MER_TABS_ORDRE.length - 1;
    var contenu = MER_ACTIVE_TAB === 'IDENTITE' ? TPL_ONGLET_IDENTITE()
        : MER_ACTIVE_TAB === 'ALLER' ? TPL_ONGLET_ALLER()
        : MER_ACTIVE_TAB === 'RETOUR' ? TPL_ONGLET_RETOUR()
        : MER_ACTIVE_TAB === 'CONDITIONS' ? TPL_ONGLET_CONDITIONS()
        : TPL_ONGLET_IMPUTATION();
    return '' +
    '<div class="CARD">' +
      '<h2>' + (MER_CORRECTION() ? 'Correction — VALIDEUR 1' : 'Nouvelle demande') + '</h2>' +
      '<p class="MER-HINT" style="margin:4px 0 16px;">' + (MER_CORRECTION() ? 'Corrigez la demande, puis « Terminer la correction » : elle revient dans votre Espace valideur, à revalider.' : 'Demande d\'Ordre de Mise en Route (DOMR)') + '</p>' +
      (D.refus && !MER_CORRECTION() ? '<p class="MER-HINT" style="color:#b91c1c; font-weight:800; margin:-6px 0 16px;">✖ Refusée par ' + PAR_QUI(D.refus) + ' (' +
          ESC(D.refus.grade + ' ' + D.refus.nom) + ') : ' + ESC(D.refus.motif) + '</p>' : '') +
      (MER_CORRECTION() && D.renvoi ? '<p class="MER-HINT" style="color:#b45309; font-weight:800; margin:-6px 0 16px;">↩ Renvoyée par le VALIDEUR 2 (' +
          ESC(D.renvoi.grade + ' ' + D.renvoi.nom) + ') : ' + ESC(D.renvoi.motif) + '</p>' : '') +
      TPL_TABS_BAR() +
      contenu +
      '<div class="MER-BOTTOM-BAR">' +
        (idx === 0
            ? '<button type="button" class="BTN BTN-SECONDARY" style="flex:0 0 auto;" onclick="' + (MER_CORRECTION() ? 'ANNULER_CORRECTION()' : 'SHOW_PAGE(\'ACCUEIL\')') + '">Annuler</button>'
            : '<button type="button" class="BTN BTN-SECONDARY" style="flex:0 0 auto;" onclick="MER_TAB_PRECEDENT()">← Précédent</button>') +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="MER_TAB_SUIVANT()">' + (dernier ? (MER_CORRECTION() ? 'Terminer la correction ✔' : 'Ajouter aux documents →') : 'Étape suivante →') + '</button>' +
      '</div>' +
    '</div>';
}

// ===================== PANIER =====================
function AJOUTER_AU_PANIER() {
    var p0 = D.personnes[0];
    if (!p0.nom || !p0.prenom) { MSG_ERREUR('Identité incomplète', 'Merci de renseigner au moins le nom et le prénom de la première personne.'); return; }
    if (!D.objet) { MSG_ERREUR('Objet manquant', 'Merci de renseigner l\'objet de la demande.'); return; }
    var malFormes = D.personnes.filter(function(p) { return p.matricule && p.matricule.replace(/\D/g, '').length !== 10; });
    if (malFormes.length) { MSG_ERREUR('Matricule incorrect', 'Le matricule doit comporter 10 chiffres (ex : 067 50 10 191) : ' + malFormes.map(function(p) { return p.nom || '?'; }).join(', ') + '.'); return; }
    if (MER_CORRECTION()) { TERMINER_CORRECTION(); return; }
    var reg = GET_REGLAGES();
    reg.derniereUnite = p0.unite; reg.derniereCie = p0.cie;
    SAVE_REGLAGES(reg);
    delete D.refus;
    D.validations = [];
    var panier = GET_PANIER(), noms = RESUME_DEMANDE(D).noms;
    panier.push(D);
    SAVE_PANIER(panier);
    CLEAR_BROUILLON();
    MER_DOSSIER.PANIER = 'prets'; SHOW_PAGE('PANIER');
    MSG_INFO('Ajoutée à vos Documents', 'La demande de ' + noms + ' est rangée dans Documents › Prêtes à envoyer, où elle attend son envoi au 1er valideur. Vous pouvez y ajouter d\'autres demandes pour les envoyer ensemble, en un seul envoi.', '✅', 'mascotte-ok.webp');
}

// ---- Correction par le VALIDEUR 1 d'une demande renvoyée par le VALIDEUR 2 ----
// Le formulaire sert à corriger ; le brouillon personnel éventuel est mis de côté puis rendu à la fin.
var STORAGE_CORRECTION = 'mer_correction_valideur';
function MER_CORRECTION() { try { return JSON.parse(localStorage.getItem(STORAGE_CORRECTION) || 'null'); } catch (e) { return null; } }
function CORRIGER_PAR_VALIDEUR(id) {
    var e = GET_A_VALIDER().filter(function(x) { return x.id === id; })[0];
    if (!e) return;
    var brouillon = null;
    try { brouillon = localStorage.getItem(STORAGE_BROUILLON); localStorage.setItem(STORAGE_CORRECTION, JSON.stringify({ id: id, brouillon: brouillon })); } catch (x) {}
    D = JSON.parse(JSON.stringify(e.d)); D.validations = [];
    MER_ACTIVE_TAB = 'IDENTITE';
    SAVE_BROUILLON();
    SHOW_PAGE('FORMULAIRE');
}
function FIN_CORRECTION() {
    var c = MER_CORRECTION();
    try { localStorage.removeItem(STORAGE_CORRECTION); } catch (x) {}
    if (c && c.brouillon) { try { localStorage.setItem(STORAGE_BROUILLON, c.brouillon); } catch (x) {} LOAD_BROUILLON(); }
    else CLEAR_BROUILLON();
}
function TERMINER_CORRECTION() {
    var c = MER_CORRECTION(), liste = GET_A_VALIDER(), d = JSON.parse(JSON.stringify(D));
    liste.forEach(function(e) {
        if (!c || e.id !== c.id) return;
        d.validations = []; e.d = d; e.decision = null; e.signature = null; e.pjAlterees = []; e.corrigee = true;
    });
    SAVE_A_VALIDER(liste);
    FIN_CORRECTION();
    SHOW_PAGE('VALIDATION');
    MSG_INFO('Correction terminée', 'La demande corrigée est dans votre Espace valideur : validez-la pour la renvoyer au VALIDEUR 2, ou refusez-la au demandeur.', '✅', 'mascotte-ok.webp');
}
function ANNULER_CORRECTION() {
    MSG_CONFIRM('Abandonner la correction ?', 'Vos modifications ne seront pas gardées ; la demande reste telle quelle dans votre Espace valideur.', 'Abandonner', function() {
        FIN_CORRECTION(); SHOW_PAGE('VALIDATION');
    }, '⚠️');
}

function RETIRER_DU_PANIER(id) {
    var d = GET_PANIER().filter(function(x) { return x.id === id; })[0];
    if (!d) return;
    MSG_CONFIRM('Retirer cette demande ?', 'La demande de ' + RESUME_DEMANDE(d).noms + ' sera retirée de vos Documents et supprimée : elle ne sera pas envoyée. Cette action est irréversible.',
        'Retirer', function() { RETIRER_DU_PANIER_OK(id); }, '⚠️', 'mascotte-poubelle.webp', true);
}
function RETIRER_DU_PANIER_OK(id) {
    // Demande refusée abandonnée : le suivi s'arrête (plus de rappel « à corriger »).
    if (GET_PANIER().some(function(d) { return d.id === id && d.refus; }) && window.JUMELAGE_SUIVI_ABANDON) JUMELAGE_SUIVI_ABANDON([id]);
    var panier = GET_PANIER().filter(function(d) { return d.id !== id; });
    SAVE_PANIER(panier);
    RENDER_PANIER_INPLACE();
}
function RENDER_PANIER_INPLACE() { document.getElementById('PAGE-STAGE').innerHTML = TPL_PANIER(); }

function RESUME_DEMANDE(d) {
    var noms = d.personnes.map(function(p) { return (p.nom || '—') + ' ' + (p.prenom || ''); }).join(', ');
    var dates = (d.trajets.aller.dateDep ? FORMAT_DATE_COURT(d.trajets.aller.dateDep) : '') +
        (d.trajets.retour.dateArr ? ' → ' + FORMAT_DATE_COURT(d.trajets.retour.dateArr) : '');
    return { noms: noms, sous: (d.type === 'MISSION' ? 'Mission' : 'Formation/stage') + (d.objet ? ' — ' + d.objet : '') + (dates ? ' · ' + dates : '') };
}
function FORMAT_DATE_COURT(v) {
    try { var dt = new Date(v); return dt.toLocaleDateString('fr-FR'); } catch (e) { return ''; }
}

// Destinataire absent (valideur, assistant Chorus DT) : prévenir avant l'envoi, dans l'élément « id ».
function MER_AFFICHER_ABSENCE(id, mail) {
    if (!window.JUMELAGE_ABSENCE) return;
    var cible = document.getElementById(id); if (cible) cible.setAttribute('data-mail', String(mail || ''));
    JUMELAGE_ABSENCE(mail).then(function(rp) {
        var el = document.getElementById(id); if (!el) return;
        // Une réponse pour une adresse qui n'est plus celle affichée (saisie changée entre-temps) est ignorée.
        if (el.getAttribute('data-mail') !== String(mail || '')) return;
        el.innerHTML = rp ? '<div class="MER-ABSENCE">🟠 <b>' + ESC(mail) + '</b> est absent jusqu\'au <b>' + new Date(rp.jusqu).toLocaleDateString('fr-FR') + '</b> : votre envoi partira chez son remplaçant, <b>' + ESC(rp.mail) + '</b>.</div>' : '';
    });
}
// Documents en dossiers : « Prêtes à envoyer » et « Refusées — à corriger » (toujours affichés, même vides).
// L'envoi (1er valideur) se fait dans le dossier « Prêtes à envoyer », sous les demandes qui partent : on voit ce qui
// part. Une demande refusée ne part qu'une fois corrigée (elle passe alors dans « Prêtes à envoyer »).
function PANIER_PRETES() { return GET_PANIER().filter(function(d) { return !d.refus; }); }
function TPL_ENVOI_PANIER(n) {
    var reg = GET_REGLAGES();
    setTimeout(function() { MER_AFFICHER_ABSENCE('MER-ABS-DEST', reg.mailSignataire); }, 0);
    return '<div class="MER-SECTION-TITLE">Envoi</div>' +
        '<div class="MER-FIELD"><label>Mail du 1er valideur (chef de service)</label>' +
        '<input type="email" data-scan-carte id="MER-MAIL-DEST" value="' + ESC(reg.mailSignataire || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" ' +
        'oninput="var r=GET_REGLAGES(); r.mailSignataire=this.value; SAVE_REGLAGES(r);" onchange="MER_AFFICHER_ABSENCE(\'MER-ABS-DEST\', this.value)"></div>' +
        '<div id="MER-ABS-DEST"></div>' +
        '<p class="MER-HINT" style="margin:-4px 0 14px;">' + (MER_COMPTE_ACTIF() ? 'Envoi chiffré, directement dans le TRIGONE du 1er valideur' + (n > 1 ? ' : les ' + n + ' demandes ci-dessus partent ensemble' : '') + '. Un refus éventuel vous revient dans votre Boîte de réception (' + ESC(JUMELAGE_COMPTE_MAIL()) + ').'
            : 'L\'envoi se fait directement dans TRIGONE : connectez-vous d\'abord (bouton « Se connecter » en haut à droite).') + '</p>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="PREPARER_ENVOI()">📨 Envoyer ' + (n > 1 ? 'ces ' + n + ' demandes' : 'cette demande') + '</button>';
}
function TPL_PANIER() {
    var panier = GET_PANIER();
    var ds = [
        { id: 'prets', titre: 'Prêtes à envoyer', sous: 'Demandes complètes : ouvrez le dossier pour les vérifier et les envoyer', filtre: function(d) { return !d.refus; } },
        { id: 'refus', titre: 'Refusées — à corriger', sous: 'Revenues avec le motif du refus', filtre: function(d) { return !!d.refus; } }
    ];
    ds.forEach(function(x) {
        x.liste = panier.filter(x.filtre); x.nb = x.liste.length; x.gris = x.id !== 'refus'; x.nouveau = x.id === 'refus' && x.nb > 0;
        x.det = x.nb ? (x.id === 'refus' ? '<span class="MER-DOSSIER-ATT">' : '<span>') + x.nb + ' demande' + (x.nb > 1 ? 's' : '') + '</span>' : 'Aucune demande';
    });
    var ouvert = ds.filter(function(x) { return x.id === MER_DOSSIER.PANIER; })[0];
    if (!ouvert) MER_DOSSIER.PANIER = null;
    if (!panier.length) {
        return '<div class="CARD">' +
            '<h2>Mes documents</h2>' +
            (ouvert ? TPL_TETE_DOSSIER('PANIER', ouvert) + '<div class="MER-EMPTY">Aucune demande dans ce dossier.</div>' : TPL_GRILLE_DOSSIERS('PANIER', ds)) +
            '<button type="button" class="BTN BTN-PRIMARY" onclick="DEMARRER_NOUVELLE_DEMANDE()">+ Nouvelle demande</button>' +
            '<p class="MER-HINT" style="margin:10px 0 14px;">Une demande refusée par un valideur revient dans votre Boîte de réception TRIGONE : « Corriger dans Documents » la range ici, avec le motif du refus.</p>' +
            '<button type="button" class="BTN BTN-SECONDARY" onclick="' + (ouvert ? 'OUVRIR_DOSSIER(\'PANIER\', null)">‹ Dossiers' : 'SHOW_PAGE(\'ACCUEIL\')">← Accueil') + '</button>' +
        '</div>';
    }
    var items = (ouvert ? ouvert.liste : []).map(function(d) {
        var r = RESUME_DEMANDE(d);
        var refus = d.refus ? '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">✖ Refusée par ' + PAR_QUI(d.refus) + ' (' +
            ESC(d.refus.grade + ' ' + d.refus.nom) + ') : ' + ESC(d.refus.motif) + '<br>Modifiez-la : une fois corrigée, elle passe dans « Prêtes à envoyer ».</div>' : '';
        return '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<div class="MER-PANIER-ITEM-TITRE">' + ESC(r.noms) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(r.sous) + '</div>' + refus +
            '</div><div class="MER-VAL-ACTIONS" style="flex-direction:column; margin:0;">' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MODIFIER_DEMANDE(\'' + d.id + '\')">Modifier</button>' +
            '<button type="button" class="BTN-DANGER-TEXT" onclick="RETIRER_DU_PANIER(\'' + d.id + '\')">Retirer</button></div></div>';
    }).join('');
    if (ouvert) return '<div class="CARD"><h2>Mes documents</h2>' + TPL_TETE_DOSSIER('PANIER', ouvert) +
        (items || '<div class="MER-EMPTY">Aucune demande dans ce dossier.</div>') +
        (ouvert.id === 'prets' ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-bottom:14px;" onclick="DEMARRER_NOUVELLE_DEMANDE()">+ Ajouter une autre demande</button>' +
            (ouvert.nb ? TPL_ENVOI_PANIER(ouvert.nb) : '') : '') +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="OUVRIR_DOSSIER(\'PANIER\', null)">‹ Dossiers</button></div>';
    var pretes = ds[0].nb;
    return '<div class="CARD">' +
        '<h2>Mes documents</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 14px;">' + (pretes ? 'Ouvrez « Prêtes à envoyer » pour vérifier ' + (pretes > 1 ? 'vos ' + pretes + ' demandes et les envoyer' : 'votre demande et l\'envoyer') + ' au 1er valideur.' : 'Aucune demande prête à envoyer.') + '</p>' +
        TPL_GRILLE_DOSSIERS('PANIER', ds) +
        '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-bottom:14px;" onclick="DEMARRER_NOUVELLE_DEMANDE()">+ Ajouter une autre demande</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button>' +
    '</div>';
}

// ===================== GÉNÉRATION DU PDF =====================
// Même style que le PDF de TRIGONE compte-rendu (bandeau, titres de section, tableaux autoTable),
// uniquement avec ce que le missionnaire a saisi. Une page par demande, quelle que soit sa longueur.
// Noir et or, économe en encre : fond blanc, filets et titres or, en-têtes de tableaux soulignés.
var PDF_ACCENT = [26, 26, 26], PDF_OR = [214, 167, 86], PDF_OR_TEXTE = [176, 128, 42], PDF_ZEBRE = [250, 248, 243], PDF_TEXTE = [30, 30, 30];

function PDF_DATE(v) {
    if (!v) return '';
    var dt = new Date(v);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString('fr-FR') + ' ' + ('0' + dt.getHours()).slice(-2) + 'h' + ('0' + dt.getMinutes()).slice(-2);
}
function PDF_OUI_NON(v) { return v ? 'OUI' : 'NON'; }
// Réponse à signaler (demande d'avance, réservation ABT) : un OUI ressort en rouge gras.
// Demande de réservation : « HÉBERGEMENT + TRANSPORT » (en rouge), ou NON.
function PDF_RESA(d) {
    var l = [d.resaHeberg ? 'HÉBERGEMENT' : '', MER_RESA_TRANSPORT(d) ? 'TRANSPORT' : ''].filter(Boolean);
    return l.length ? { content: l.join(' + '), styles: { textColor: [200, 16, 16], fontStyle: 'bold' } } : 'NON';
}
function PDF_OUI_NON_ALERTE(v) { return v ? { content: 'OUI', styles: { textColor: [200, 16, 16], fontStyle: 'bold' } } : 'NON'; }

function PDF_BANDEAU(doc, d, M, L, edition) {
    if (window.JUMELAGE_PDF_STYLE) JUMELAGE_PDF_STYLE(doc);
    // En-tête blanc (logo tricolore au-dessus du nom, s'il est chargé), souligné d'un filet or.
    var logo = !!(window.JUMELAGE_LOGO_PDF && window.JUMELAGE_LOGO_PRET()), h = logo ? 56 : 30, dy = logo ? 26 : 0;
    doc.setFillColor.apply(doc, PDF_OR); doc.rect(0, h - 1, 210, 1, 'F');
    doc.setTextColor.apply(doc, PDF_ACCENT);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    if (logo) window.JUMELAGE_LOGO_PDF(doc, M + 4 + doc.getTextWidth('TRIGONE') / 2, 4, 25);
    doc.text('TRIGONE', M + 4, 14 + dy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 98, 110);
    var unite = d.personnes[0] && d.personnes[0].unite ? d.personnes[0].unite + ' — ' : '';
    doc.text(unite + 'Demande d\'ordre de mise en route', M + 4, 21 + dy);
    // N° OMR en haut à droite (rapprochement avec le compte-rendu de mission, qui porte le même numéro).
    if (d.omr) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor.apply(doc, PDF_ACCENT);
        doc.text(MER_OMR_LIBELLE(d), M + L - 4, logo ? 13 : 8, { align: 'right' });
        if (d.omrLe) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.text('du ' + new Date(d.omrLe).toLocaleDateString('fr-FR'), M + L - 4, logo ? 18 : 12, { align: 'right' }); }
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, PDF_OR_TEXTE);
    doc.text(d.type === 'FORMATION' ? 'FORMATION / STAGE' : 'MISSION', M + L - 4, 15 + dy, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
    doc.text('Édité le ' + edition, M + L - 4, 21 + dy, { align: 'right' });
    doc.setTextColor.apply(doc, PDF_TEXTE);
    return h + 6;
}

function PDF_SECTION(doc, titre, x, y, P) {
    doc.setFillColor.apply(doc, PDF_OR);
    doc.rect(x, y, 1.2, P.hSection - 1, 'F');
    doc.setTextColor.apply(doc, PDF_ACCENT);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(P.fSection);
    doc.text(titre, x + 4, y + P.hSection - 2.3);
    doc.setTextColor.apply(doc, PDF_TEXTE);
    return y + P.hSection + 1;
}

function PDF_TABLEAU(doc, y, M, L, P, options) {
    var o = Object.assign({
        startY: y, margin: { left: M + 4, right: M + 4 }, theme: 'plain', pageBreak: 'avoid',
        styles: { font: 'helvetica', fontSize: P.fTable, cellPadding: P.pad, textColor: PDF_TEXTE, lineColor: [220, 225, 232] },
        headStyles: { fillColor: false, textColor: PDF_ACCENT, fontStyle: 'bold', fontSize: P.fTable - 0.5 },
        alternateRowStyles: { fillColor: PDF_ZEBRE }
    }, options);
    doc.autoTable(o);
    return doc.lastAutoTable.finalY + P.ecart;
}

function PDF_DEMANDE(doc, d, M, L, P, edition) {
    var y = PDF_BANDEAU(doc, d, M, L, edition);
    var X = M + 4;

    y = PDF_SECTION(doc, 'PERSONNEL CONCERNÉ', X, y, P);
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Unité / entité', 'CIE', 'Grade', 'Nom', 'Prénom', 'Matricule']],
        body: d.personnes.map(function(p) { return [p.unite, p.cie, p.grade, (p.nom || '').toUpperCase(), p.prenom, FORMAT_MATRICULE(p.matricule)]; })
    });

    y = PDF_SECTION(doc, 'MISSION', X, y, P);
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Champ', 'Valeur']],
        body: [['Type', d.type === 'FORMATION' ? 'Formation / stage' : 'Mission'], ['Objet', (d.objet || '').toUpperCase()]],
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
    });

    var t = d.trajets;
    // Ordre chronologique : le trajet intermédiaire aller mène au départ de l'aller (ex. LIBOURNE → TOULON avant
    // TOULON → BASTIA) ; le trajet intermédiaire retour prolonge le retour (BASTIA → TOULON, puis TOULON → LIBOURNE).
    var trajets = [];
    if (t.intermediaireAllerActif) trajets.push(['Intermédiaire (aller)', t.intermediaireAller]);
    trajets.push(['Aller', t.aller], ['Retour', t.retour]);
    if (t.intermediaireRetourActif) trajets.push(['Intermédiaire (retour)', t.intermediaireRetour]);
    function lieu(nom, cp, pays) { return (nom || '').toUpperCase() + (pays ? ' — ' + pays : (cp ? ' (' + cp + ')' : '')); }
    y = PDF_SECTION(doc, 'TRAJETS', X, y, P);
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Trajet', 'Moyen de transport', 'Départ', 'Arrivée']],
        body: trajets.map(function(r) {
            var tr = r[1] || VIDE_TRAJET();
            return [r[0], tr.moyen ? MOYENS[tr.moyen] : '',
                    lieu(tr.lieuDep, tr.cpDep, tr.paysDep) + (tr.residenceDep ? '\n' + MER_RESIDENCES[tr.residenceDep] : '') + '\n' + PDF_DATE(tr.dateDep),
                    lieu(tr.lieuArr, tr.cpArr, tr.paysArr) + (tr.residenceArr ? '\n' + MER_RESIDENCES[tr.residenceArr] : '') + '\n' + PDF_DATE(tr.dateArr)];
        }),
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 36 }, 1: { cellWidth: 38 } }
    });

    y = PDF_SECTION(doc, 'ALIMENTATION & HÉBERGEMENT', X, y, P);
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Durant le déplacement', ''], ],
        body: (MER_RESA().active || d.resaHeberg || MER_RESA_TRANSPORT(d) ? [[MER_RESA_TITRE(), PDF_RESA(d)]] : []).concat([
               ['Nourri à titre onéreux', PDF_OUI_NON(d.nourriDeplacement)],
               ['Transport en commun', PDF_OUI_NON(d.transportCommun)]]),
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 44 } }
    }) - P.ecart + 1;
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Durant la mission', '']],
        body: [['Nourri à titre onéreux', PDF_OUI_NON(d.nourriMission)],
               ['Logé à titre onéreux', PDF_OUI_NON(d.logeMission)],
               ['Demande d\'avance', PDF_OUI_NON_ALERTE(d.demandeAvance)]],
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 30 } }
    });

    y = PDF_SECTION(doc, 'IMPUTATION', X, y, P);
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Champ', 'Valeur']],
        body: [['Mission imputée à l\'unité', PDF_OUI_NON(d.missionImputee)], ['Code engagement FD@LIGNE', d.codeFD || '']].concat(d.imputationFD ? [
            ['Centre financier', d.imputationFD.cf], ['Centre de coût', d.imputationFD.cc],
            ['Code activité', d.imputationFD.act], ['Libellé', d.imputationFD.lib]] : []),
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
    });

    var lignesPJ = (d.piecesJointes ? [[d.piecesJointes]] : []).concat((d.pieces || []).map(function(p) { return ['Fichier joint : ' + p.nom]; }));
    if (lignesPJ.length) {
        y = PDF_TABLEAU(doc, y, M, L, P, {
            theme: 'grid',
            head: [['Pièces jointes (NDS / DAF)']],
            body: lignesPJ,
            alternateRowStyles: {}
        });
    }
    return y;
}

// Deux cases en bas de page : 1er valideur à gauche, 2e à droite, remplies à chaque validation.
var PDF_Y_VALIDATIONS = 255;
function PDF_CASES_VALIDATION(doc, d, M, L) {
    var x0 = M + 4, larg = (L - 8 - 6) / 2, h = 30, y = PDF_Y_VALIDATIONS;
    [0, 1].forEach(function(i) {
        var x = x0 + i * (larg + 6), s = (d.validations || [])[i];
        doc.setDrawColor(210, 216, 225); doc.setLineWidth(0.3);
        doc.rect(x, y, larg, h);
        doc.setFillColor.apply(doc, PDF_OR); doc.rect(x, y + 6.5, larg, 0.6, 'F');
        doc.setTextColor.apply(doc, PDF_ACCENT); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text(i === 0 ? '1er VALIDEUR' : '2e VALIDEUR', x + 3, y + 4.4);
        doc.setTextColor.apply(doc, PDF_TEXTE);
        if (!s) {
            doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
            doc.text('En attente de validation', x + larg / 2, y + 19, { align: 'center' });
            doc.setTextColor.apply(doc, PDF_TEXTE);
            return;
        }
        var le = new Date(s.le);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text('Validé par :', x + 3, y + 11.5);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(doc.splitTextToSize((s.grade + ' ' + s.nom + ' ' + s.prenom).trim(), larg - 6)[0], x + 3, y + 16);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(doc.splitTextToSize(s.fonction || '', larg - 6)[0], x + 3, y + 20.5);
        doc.setTextColor.apply(doc, PDF_OR_TEXTE); doc.setFont('helvetica', 'bold');
        doc.text('Le ' + le.toLocaleDateString('fr-FR') + ' à ' + le.toLocaleTimeString('fr-FR'), x + 3, y + 26.5);
        if (s.sig) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(120, 120, 120);
            doc.text('Signé électroniquement', x + larg - 3, y + 26.5, { align: 'right' });
        }
        doc.setTextColor.apply(doc, PDF_TEXTE);
    });
    doc.setDrawColor(0);
}

// Réglages du plus aéré au plus resserré : chaque demande doit tenir sur une seule page.
var PDF_NIVEAUX = [
    { fTable: 8.5, pad: 2.2, ecart: 5,   hSection: 7,   fSection: 11 },
    { fTable: 8.5, pad: 1.8, ecart: 4,   hSection: 7,   fSection: 11 },
    { fTable: 8,   pad: 1.5, ecart: 3.5, hSection: 6.5, fSection: 10.5 },
    { fTable: 7.5, pad: 1.2, ecart: 3,   hSection: 6.5, fSection: 10.5 },
    { fTable: 7,   pad: 1,   ecart: 2.5, hSection: 6,   fSection: 10 },
    { fTable: 6.5, pad: 0.8, ecart: 2,   hSection: 6,   fSection: 9.5 },
    { fTable: 6,   pad: 0.6, ecart: 1.5, hSection: 5.5, fSection: 9 }
];
var PDF_BAS = PDF_Y_VALIDATIONS - 3;

function GENERER_PDF(panier) {
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') throw new Error('module de tableaux (autotable) non chargé');
    var M = 12, L = 210 - 2 * M;
    var now = new Date();
    var edition = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');

    panier.forEach(function(d, idx) {
        // On dessine avec le réglage le plus aéré ; si ça déborde, on efface et on resserre.
        for (var n = 0; n < PDF_NIVEAUX.length; n++) {
            doc.addPage();
            var page = doc.getNumberOfPages();
            var y = PDF_DEMANDE(doc, d, M, L, PDF_NIVEAUX[n], edition);
            var tient = doc.getNumberOfPages() === page && y <= PDF_BAS;
            if (tient || n === PDF_NIVEAUX.length - 1) break;
            while (doc.getNumberOfPages() >= page) doc.deletePage(doc.getNumberOfPages());
        }
        doc.setPage(page);
        PDF_CASES_VALIDATION(doc, d, M, L);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
        doc.text('TRIGONE — Mise en route — demande ' + (idx + 1) + ' / ' + panier.length, 105, 292, { align: 'center' });
        doc.setTextColor.apply(doc, PDF_TEXTE);
    });
    doc.deletePage(1); // page vierge créée par jsPDF à l'ouverture du document
    // Demandes et signatures intégrées au PDF : la page « Vérifier une mise en route » les relit.
    doc.setProperties({ title: 'TRIGONE — Demande d\'ordre de mise en route', keywords: PDF_DONNEES(panier) });

    return doc;
}

// ===================== CODE D'ACCÈS À 4 CHIFFRES (comme TRIGONE compte-rendu) =====================
// Facultatif, activé depuis Mon espace : demandé à chaque ouverture de l'application. Seule une empreinte
// (SHA-256) du code est gardée sur l'appareil ; code oublié = effacer toutes les données de l'appli.
var STORAGE_PIN = 'mer_pin_hash';
var PIN_UI = { saisie: '', mode: null, premier: null, verrouillage: false, apres: null };
// Code d'accès unique de TRIGONE (jumelage.js) : le même pour Mise en route et Compte-rendu, demandé à l'ouverture.
function PIN_EST_DEFINI() { if (window.JUMELAGE_CODE_ACTIF) return JUMELAGE_CODE_ACTIF(); try { return !!localStorage.getItem(STORAGE_PIN); } catch (e) { return false; } }
function PIN_ENREGISTRER(code) {
    if (window.JUMELAGE_POSER_CODE) return JUMELAGE_POSER_CODE(code);
    return PIN_EMPREINTE(code).then(function(h) { try { localStorage.setItem(STORAGE_PIN, h); } catch (e) {} });
}
function PIN_CODE_JUSTE(code) {
    if (window.JUMELAGE_VERIFIER_CODE) return JUMELAGE_VERIFIER_CODE(code);
    var attendu = ''; try { attendu = localStorage.getItem(STORAGE_PIN) || ''; } catch (e) {}
    return PIN_EMPREINTE(code).then(function(h) { return h === attendu; });
}
function PIN_EMPREINTE(code) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('TRIGONE-MER:' + code)).then(function(b) {
        return Array.prototype.map.call(new Uint8Array(b), function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
}
// mode : 'verif' (ouverture de l'appli), 'creation', 'suppression'
function OUVRIR_ECRAN_PIN(mode, apres) {
    PIN_UI = { saisie: '', mode: mode, premier: null, verrouillage: mode === 'verif', apres: apres || null };
    var titres = { verif: ['Code d\'accès', 'Entrez votre code à 4 chiffres pour continuer.'],
                   creation: ['Nouveau code d\'accès', 'Choisissez un code à 4 chiffres.'],
                   suppression: ['Désactiver le code', 'Entrez votre code actuel.'] };
    document.getElementById('PIN-OVERLAY-TITRE').textContent = titres[mode][0];
    document.getElementById('PIN-OVERLAY-SOUS-TITRE').textContent = titres[mode][1];
    document.getElementById('PIN-OVERLAY-ERREUR').classList.add('HIDDEN');
    document.getElementById('PIN-OVERLAY-CLOSE').classList.toggle('HIDDEN', mode === 'verif');
    document.getElementById('PIN-OUBLIE').style.display = mode === 'creation' ? 'none' : '';
    RENDER_PIN_DOTS();
    document.getElementById('PIN-OVERLAY').classList.remove('HIDDEN');
}
function FERMER_ECRAN_PIN() {
    if (PIN_UI.verrouillage) return;   // le verrouillage d'ouverture ne se ferme qu'avec le bon code
    document.getElementById('PIN-OVERLAY').classList.add('HIDDEN');
}
function RENDER_PIN_DOTS() {
    document.querySelectorAll('#PIN-OVERLAY .pin-dot').forEach(function(d, i) { d.classList.toggle('filled', i < PIN_UI.saisie.length); });
}
function PIN_ERREUR(texte) {
    var e = document.getElementById('PIN-OVERLAY-ERREUR');
    e.textContent = texte; e.classList.remove('HIDDEN');
    PIN_UI.saisie = ''; RENDER_PIN_DOTS();
}
function PIN_TOUCHE(chiffre) {
    if (PIN_UI.saisie.length >= 4) return;
    PIN_UI.saisie += String(chiffre);
    RENDER_PIN_DOTS();
    if (PIN_UI.saisie.length === 4) setTimeout(PIN_VALIDER, 150);
}
function PIN_EFFACER() { PIN_UI.saisie = PIN_UI.saisie.slice(0, -1); RENDER_PIN_DOTS(); }
function PIN_VALIDER() {
    var code = PIN_UI.saisie;
    if (PIN_UI.mode === 'creation') {
        if (!PIN_UI.premier) {
            PIN_UI.premier = code; PIN_UI.saisie = '';
            document.getElementById('PIN-OVERLAY-SOUS-TITRE').textContent = 'Confirmez votre nouveau code.';
            RENDER_PIN_DOTS();
            return;
        }
        if (code !== PIN_UI.premier) {
            PIN_UI.premier = null;
            document.getElementById('PIN-OVERLAY-SOUS-TITRE').textContent = 'Choisissez un code à 4 chiffres.';
            PIN_ERREUR('⛔ Les deux codes ne correspondent pas. Recommencez.');
            return;
        }
        PIN_ENREGISTRER(code).then(function() {
            FERMER_ECRAN_PIN();
            if (PAGE_ACTUELLE === 'ESPACE') SHOW_PAGE('ESPACE');
            MSG_INFO('Code d\'accès activé', 'Il vous sera demandé à chaque ouverture de TRIGONE.', '🔒', 'mascotte-pouce.webp');
        });
        return;
    }
    PIN_CODE_JUSTE(code).then(function(ok) {
        if (!ok) { PIN_ERREUR('⛔ Code incorrect.'); return; }
        if (PIN_UI.mode === 'suppression') {
            if (window.JUMELAGE_EFFACER_CODE) JUMELAGE_EFFACER_CODE();
            try { localStorage.removeItem(STORAGE_PIN); } catch (e) {}
            FERMER_ECRAN_PIN();
            if (PAGE_ACTUELLE === 'ESPACE') SHOW_PAGE('ESPACE');
            MSG_INFO('Code d\'accès désactivé', 'TRIGONE s\'ouvrira sans code.', '🔓', 'mascotte-code.webp');
            return;
        }
        PIN_UI.verrouillage = false;
        if (window.JUMELAGE_MARQUER_DEVERROUILLE) JUMELAGE_MARQUER_DEVERROUILLE();
        FERMER_ECRAN_PIN();
        if (PIN_UI.apres) PIN_UI.apres();
    });
}
function PIN_CODE_OUBLIE() {
    MSG_CONFIRM('Code oublié ?',
        'Il n\'existe aucun moyen de récupérer votre code. La seule solution est d\'effacer toutes les données de TRIGONE Mise en route sur cet appareil (demande en cours, documents, bibliothèque, réglages). Cette action est irréversible.',
        'Oui, tout effacer et recommencer', function() {
            try { localStorage.clear(); } catch (e) {}
            location.reload();
        }, '⚠️', 'mascotte-code.webp', true);
}

// ===================== PAGE DE PRÉSENTATION (première ouverture) =====================
var STORAGE_POURQUOI = 'trigone_presentation_jumelage_vue';   // présentation commune Mise en route + Compte-rendu
var POURQUOI_APRES = null;
function AFFICHER_POURQUOI(apres) {
    // Présentation unique de TRIGONE (jumelage.js), commune aux deux applis.
    if (window.JUMELAGE_PRESENTATION) { window.JUMELAGE_PRESENTATION({ premiere: true, apres: apres }); return; }
    POURQUOI_APRES = apres || null;
    var o = document.getElementById('POURQUOI-OVERLAY'), mot = document.getElementById('POURQUOI-WORDMARK');
    mot.innerHTML = '';
    'TRIGONE'.split('').forEach(function(ch, i) {
        var sp = document.createElement('span');
        sp.textContent = ch; sp.style.animationDelay = (0.35 + i * 0.055) + 's';
        mot.appendChild(sp);
    });
    o.classList.remove('jouer'); o.classList.remove('HIDDEN');
    void o.offsetWidth;
    o.classList.add('jouer');
}
function FERMER_POURQUOI() {
    var o = document.getElementById('POURQUOI-OVERLAY');
    try { localStorage.setItem(STORAGE_POURQUOI, '1'); } catch (e) {}
    o.style.transition = 'opacity 0.35s ease'; o.style.opacity = '0';
    setTimeout(function() {
        o.classList.add('HIDDEN'); o.style.opacity = ''; o.style.transition = '';
        if (POURQUOI_APRES) { var f = POURQUOI_APRES; POURQUOI_APRES = null; f(); }
    }, 350);
}

// ===================== CONFIGURATION INITIALE (« Avant de commencer ») =====================
// Première ouverture, après la présentation : identité, mails et code à 4 chiffres, comme TRIGONE compte-rendu.
// Les mêmes réglages que Mon espace ; obligatoires pour tous à la première ouverture.
var STORAGE_CONFIG_FAITE = 'mer_config_faite';
function CONFIG_FAITE() { try { return localStorage.getItem(STORAGE_CONFIG_FAITE) === '1'; } catch (e) { return true; } }
var MER_CONFIG_CHAMPS = { UNITE: 'unite', CIE: 'cie', GRADE: 'grade', MATRICULE: 'matricule', NOM: 'nom', PRENOM: 'prenom' };
function AFFICHER_CONFIG_INITIALE() {
    // Réglages communs à Mise en route et Compte-rendu (écran de choix, roue crantée).
    if (window.JUMELAGE_REGLAGES) { window.JUMELAGE_REGLAGES({ premiere: true }); return; }
    var r = GET_REGLAGES(), id = r.identite || {};
    Object.keys(MER_CONFIG_CHAMPS).forEach(function(k) {
        var c = MER_CONFIG_CHAMPS[k];
        document.getElementById('CONFIG-' + k).value = id[c] || (c === 'unite' ? r.derniereUnite : c === 'cie' ? r.derniereCie : '') || '';
    });
    document.getElementById('CONFIG-MAIL-VALIDEUR').value = r.mailSignataire || '';
    document.getElementById('CONFIG-MAIL-MOI').value = r.mailDemandeur || '';
    document.getElementById('CONFIG-PIN-BLOC').style.display = PIN_EST_DEFINI() ? 'none' : '';
    document.getElementById('CONFIG-ERREUR').classList.add('HIDDEN');
    document.getElementById('CONFIG-INITIALE-OVERLAY').classList.remove('HIDDEN');
}
function FERMER_CONFIG_INITIALE() {
    try { localStorage.setItem(STORAGE_CONFIG_FAITE, '1'); } catch (e) {}
    document.getElementById('CONFIG-INITIALE-OVERLAY').classList.add('HIDDEN');
    SHOW_PAGE('ACCUEIL');
}
function VALIDER_CONFIG_INITIALE() {
    var erreur = document.getElementById('CONFIG-ERREUR');
    function refuser(t) { erreur.textContent = '⛔ ' + t; erreur.classList.remove('HIDDEN'); }
    var v = {};
    Object.keys(MER_CONFIG_CHAMPS).forEach(function(k) { v[MER_CONFIG_CHAMPS[k]] = document.getElementById('CONFIG-' + k).value.trim(); });
    var mailV = document.getElementById('CONFIG-MAIL-VALIDEUR').value.trim(), mailM = document.getElementById('CONFIG-MAIL-MOI').value.trim();
    var avecPin = !PIN_EST_DEFINI();
    var pin1 = document.getElementById('CONFIG-PIN-1').value.trim(), pin2 = document.getElementById('CONFIG-PIN-2').value.trim();
    if (!v.unite || !v.cie || !v.grade || !v.nom || !v.prenom || !v.matricule || !mailV || !mailM || (avecPin && (!pin1 || !pin2))) return refuser('Merci de remplir tous les champs avant de continuer.');
    if (v.matricule.replace(/\D/g, '').length !== 10) return refuser('Le matricule doit comporter 10 chiffres (ex : 067 50 10 191).');
    if (mailV.indexOf('@') === -1 || mailM.indexOf('@') === -1) return refuser('Adresse mail invalide.');
    if (avecPin && !/^\d{4}$/.test(pin1)) return refuser('Le code doit contenir exactement 4 chiffres.');
    if (avecPin && pin1 !== pin2) return refuser('Les deux codes ne correspondent pas.');
    var r = GET_REGLAGES();
    r.identite = v; r.derniereUnite = v.unite; r.derniereCie = v.cie;
    r.mailSignataire = mailV; r.mailDemandeur = mailM;
    SAVE_REGLAGES(r);
    (avecPin ? PIN_ENREGISTRER(pin1) : Promise.resolve()).then(function() {
        FERMER_CONFIG_INITIALE();
        MSG_INFO('C\'est prêt', 'Vos informations pré-rempliront chaque nouvelle demande.' + (avecPin ? ' Votre code vous sera demandé à chaque ouverture.' : ''), '✅', 'mascotte-pouce.webp');
    });
}
function PASSER_CONFIG_INITIALE() { FERMER_CONFIG_INITIALE(); }

// ===================== INSTALLATION DE L'APPLICATION (comme TRIGONE compte-rendu) =====================
// Proposée une fois à la première connexion, puis à tout moment depuis Mon espace.
var STORAGE_INSTALL_PROPOSEE = 'mer_installation_proposee';
var PWA_INVITE = null;
window.addEventListener('beforeinstallprompt', function(e) { e.preventDefault(); PWA_INVITE = e; });
window.addEventListener('appinstalled', function() { PWA_INVITE = null; });
function EST_APP_INSTALLEE() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function PLATEFORME() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'ordinateur';
}
function PROPOSER_INSTALLATION(manuel) {
    if (EST_APP_INSTALLEE()) {
        if (manuel) MSG_INFO('Déjà installée', 'TRIGONE Mise en route est déjà installée sur cet appareil.', '✅', 'mascotte-ok.webp');
        return;
    }
    try { localStorage.setItem(STORAGE_INSTALL_PROPOSEE, '1'); } catch (e) {}
    var plateforme = PLATEFORME(), texte, boutons;
    if (PWA_INVITE) {
        texte = 'Ajoutez TRIGONE Mise en route à votre ' + (plateforme === 'ordinateur' ? 'ordinateur' : 'écran d\'accueil') +
            ' : elle s\'ouvrira comme une vraie application, avec son icône, même sans réseau.';
        boutons = [{ label: 'Plus tard', style: 'BTN-MSG-ANNULER' }, { label: '📲 Installer l\'application', action: function() {
            var invite = PWA_INVITE; PWA_INVITE = null;
            invite.prompt();
            invite.userChoice.then(function(c) {
                if (c && c.outcome === 'accepted') MSG_INFO('Application installée', 'Retrouvez TRIGONE Mise en route sur votre ' + (plateforme === 'ordinateur' ? 'bureau' : 'écran d\'accueil') + '.', '✅', 'mascotte-pouce.webp');
            });
        } }];
    } else if (plateforme === 'ios') {
        texte = 'Dans Safari, appuyez sur Partager (le carré avec une flèche), puis « Sur l\'écran d\'accueil ». TRIGONE Mise en route s\'ouvrira ensuite comme une vraie application, avec son icône.';
    } else if (plateforme === 'android') {
        texte = 'Menu du navigateur ⋮ puis « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ». TRIGONE Mise en route s\'ouvrira ensuite comme une vraie application, avec son icône.';
    } else {
        texte = 'Dans Chrome ou Edge, cliquez sur l\'icône d\'installation à droite de la barre d\'adresse (ou menu ⋮ puis « Installer TRIGONE Mise en route »). L\'application aura alors son icône sur votre ordinateur.';
    }
    AFFICHER_MSG_CENTRE({ titre: 'Installer l\'application', texte: texte, iconeImage: 'icon-192.png', mascotte: 'mascotte-pouce.webp',
        boutons: boutons || [{ label: 'J\'ai compris' }] });
}
function PROPOSER_INSTALLATION_PREMIERE_FOIS() {
    var deja = false;
    try { deja = localStorage.getItem(STORAGE_INSTALL_PROPOSEE) === '1'; } catch (e) {}
    if (deja || EST_APP_INSTALLEE()) return;
    // laisse le temps au navigateur d'annoncer qu'il sait installer l'appli (Android, Chrome, Edge)
    setTimeout(function() { ATTENDRE_ECRAN_LIBRE(function() { PROPOSER_INSTALLATION(false); }); }, 1500);
}

// ===================== NOTICE =====================
var MER_NOTICE_CLE = null;
var MER_NOTICES = {
    DEMANDEUR: { titre: 'Faire une demande', sous: 'Saisie · documents · envoi au 1er valideur', icone: MER_ICONES_NOTICE_PERSO(),
        etapes: ['<b>Se connecter</b> (bouton <b>en haut à droite</b> de l\'écran d\'accueil) : une fois, avec votre adresse mail professionnelle, vérifiée par un code ; TRIGONE demande ensuite votre profil (identité, destinataires). Un toucher sur votre pastille ouvre le menu du compte : <b>Paramètres</b> et « Se déconnecter ». Tous les envois passent par la <b>boîte TRIGONE</b>, chiffrés : plus de fichier à joindre à un mail.',
            '<b>Plusieurs appareils</b> (téléphone et PC) : inutile de tout refaire. Sur l\'appareil déjà configuré, <b>Paramètres › Compte › « Ajouter un appareil »</b> affiche un code (valable 15 minutes, une seule fois) ; sur le nouvel appareil, « Se connecter » › <b>« J\'ai déjà TRIGONE sur un autre appareil »</b> : identité, mails, rôles, code d\'accès, compte, demandes et bibliothèque sont recopiés, chiffrés. <b>« Me déconnecter et effacer cet appareil »</b> retire le compte et toutes les données d\'un appareil (PC partagé, appareil rendu) ; un code de liaison depuis l\'autre appareil les remet en place.',
            '<b>Notifications</b> : <b>Paramètres › Notifications</b> › « 🔔 Activer les notifications » vous prévient de chaque envoi reçu (demande à signer, refus, compte-rendu), même TRIGONE fermée — PC, Android, et iPhone / iPad avec TRIGONE installée sur l\'écran d\'accueil. Réglages utiles par appareil : rubrique <b>Notifications</b> de la Notice.',
            '<b>Où trouver quoi ?</b> Les onglets ne gardent que le travail (Accueil, Boîte de réception, Bibliothèque, Documents, Espace valideur). Tout le reste est dans <b>Paramètres</b> (votre pastille, en haut) : <b>Compte</b> (Mon profil — identité et mails, qui pré-remplissent chaque demande —, Mes rôles, Absence, Ajouter un appareil), <b>Notifications</b>, <b>Mise en route</b> (Mise à jour), <b>Données</b> (sauvegardes, envois en attente) et <b>Aide</b> (Notice, Références, Signaler un problème).',
            '<b>Raccourcis</b> : sur Android et PC, un appui long sur l\'icône TRIGONE propose <b>Nouvelle demande</b>, <b>Ma mission</b>, <b>Boîte de réception</b> et <b>Bibliothèque</b>.',
            '<b>Nouvelle demande</b> : 5 étapes (Identité, Aller, Retour, Alim./Héb., Imputation). Une étape doit être complète pour passer à la suivante.',
            '<b>Demande collective</b> : « + Ajouter une personne », ou <b>« 📥 Importer une liste »</b> depuis un tableau Excel (.xlsx), Calc (.ods) ou CSV aux colonnes UNITÉ · CIE · GRADE · NOM · PRÉNOM · NID (« Télécharger le modèle »). Les personnes déjà présentes ne sont pas dupliquées.',
            '<b>Aller</b> : lieu de départ de mission (résidence administrative ou familiale), moyen de transport, ville (code postal automatique) ou pays étranger, dates et heures. Selon le moyen, TRIGONE demande la <b>gare</b> (voie ferrée), l\'<b>aéroport</b> (voie aérienne) ou le <b>port</b> (voie maritime) de départ et d\'arrivée. Le <b>retour</b> est pré-rempli avec l\'aller inversé.',
            '<b>Voie routière civile (VRC)</b> : joignez la <b>demande d\'autorisation VRC</b>, la <b>carte grise</b> et l\'<b>attestation d\'assurance</b> du véhicule ; un rappel s\'affiche jusqu\'à l\'envoi.',
            '<b>Alim./Héb.</b> : nourri ou logé à titre onéreux, demande d\'avance, et <b>demande de réservation</b> (hébergement et / ou transport) si l\'option est active dans votre profil.',
            '<b>Imputation</b> : saisissez le code FD, TRIGONE affiche le centre financier, le centre de coût et le code activité. <b>Joignez la NDS ou la DAF</b> (et les pièces VRC le cas échéant), en PDF ou photo : elles voyagent avec la demande.',
            '<b>Documents</b> : « Ajouter aux documents » y range la demande terminée (message de confirmation) ; plusieurs demandes peuvent partir ensemble. « Modifier » la ressort des Documents le temps de la correction, « Retirer » la supprime (après confirmation). Vérifiez le <b>mail du 1er valideur</b> et l\'<b>aperçu du PDF</b>, puis <b>« 📨 Envoyer »</b> : la demande (pièces jointes comprises) arrive, chiffrée, dans le TRIGONE du 1er valideur. S\'il n\'a pas encore de compte TRIGONE, l\'envoi est bloqué : demandez-lui de s\'inscrire ; votre demande reste dans Documents. <b>Sans réseau</b>, l\'envoi attend sur l\'appareil et part tout seul au retour du réseau (Paramètres › Données › Envois en attente).',
            'Appli fermée avant la fin ? À la réouverture, l\'écran <b>Demande en cours</b> propose de <b>continuer</b> la saisie ou de revenir à l\'accueil (la demande reste enregistrée, bouton « ↩ Reprendre ma demande en cours »).',
            '<b>Suivi</b> : dans la <b>Bibliothèque</b>, chaque demande envoyée affiche sa frise Envoyée → VALIDEUR 1 → VALIDEUR 2 → Chorus DT, avec qui a validé, quand, et depuis combien de temps elle attend. Une notification vous prévient à chaque étape, jusqu\'à la prise en charge par l\'assistant Chorus DT. Pour faire du tri, <b>« ☑ Sélectionner »</b> permet de cocher plusieurs demandes (ou « Tout cocher ») et de les supprimer d\'un coup.',
            'À l\'envoi, la demande quitte Documents pour la <b>Bibliothèque</b>. En cas de refus, elle revient dans votre <b>Boîte de réception</b> avec le motif : « Corriger dans Documents » l\'y range ; corrigez-la avec « Modifier » et renvoyez-la. Tant qu\'elle n\'est pas corrigée, un <b>rappel</b> vous est envoyé après 48 h, puis toutes les 48 h (14 jours au plus) ; « Retirer » la demande de Documents arrête les rappels.',
            '<b>Une question du valideur ou de l\'assistant Chorus DT ?</b> Elle arrive dans votre Boîte de réception (dossier « Questions ») avec une notification : « Répondre » lui renvoie votre réponse, la demande poursuit son circuit sans être refusée.',
            '<b>Le jour du départ</b> : une notification à 7 h ouvre le compte-rendu déjà pré-rempli (« Ma mission »). Dans la Bibliothèque, <b>« 📅 Agenda »</b> ajoute la mission au calendrier du téléphone (Google ou fichier .ics).',
            'Au retour de mission, <b>TRIGONE Compte-rendu</b> reprend la mission envoyée depuis cet appareil (« À partir d\'une mise en route ») ; sinon, le missionnaire la saisit directement dans Compte-rendu.'] },
    VALIDEUR: { titre: 'Valider une demande', sous: 'Rôle valideur · boîte de réception · signature', icone: MER_ICONES_NOTICE_CADENAS(),
        etapes: ['<b>Paramètres › Compte › Mes rôles</b> : cochez <b>VALIDEUR 1</b> et/ou <b>VALIDEUR 2</b>, saisissez votre fonction et le <b>code</b> de chaque rôle, remis par l\'administrateur. Les rôles sont déclarés à votre compte TRIGONE : votre boîte ne reçoit que les demandes de vos niveaux. Il peut y avoir plusieurs VALIDEUR 1 et plusieurs VALIDEUR 2 ; une même personne peut avoir tous les rôles (VALIDEUR 1, VALIDEUR 2, ASSIST CHORUS DT) et rester missionnaire.',
            '<b>Les deux rôles valideur ?</b> Dans l\'Espace valideur, la bascule <b>VALIDEUR 1 / VALIDEUR 2</b> choisit le niveau ; une demande ouverte depuis la Boîte de réception passe d\'elle-même au bon niveau. Une personne qui a les deux rôles peut valider les deux niveaux d\'une même demande.',
            'Les demandes à signer arrivent dans votre <b>Boîte de réception</b> (pastille rouge) : « Ouvrir et signer » les affiche dans l\'Espace valideur, avec leur <b>aperçu</b> et leurs pièces jointes (📎 NDS / DAF) à ouvrir d\'un clic. Une pièce modifiée en cours de route est signalée en rouge. Plusieurs demandes à signer ? <b>« ✍️ Tout ouvrir et signer »</b> les ouvre d\'un coup, toutes cochées : relisez, décochez celles à traiter à part, puis « Valider la sélection ».',
            '<b>« ❓ Question »</b> plutôt qu\'un refus : sur une demande pas encore décidée, posez votre question au missionnaire ; sa réponse s\'affiche sous la demande, qui attend votre décision sans repartir en arrière.',
            '<b>Valider</b> (une par une ou « Tout cocher » puis « Valider la sélection ») : la validation est signée électroniquement. <b>Refuser</b> demande un motif : le VALIDEUR 1 refuse au demandeur ; le VALIDEUR 2 choisit de <b>renvoyer au VALIDEUR 1</b> ou directement au demandeur. Une demande renvoyée par le VALIDEUR 2 arrive chez le VALIDEUR 1 (« Renvoyée par le VALIDEUR 2 », avec le motif) : il la <b>✎ Corrige</b> à son niveau puis la revalide, la revalide telle quelle, ou la <b>refuse au demandeur</b>. <b>Effacer</b> (après confirmation) retire une demande ouverte par erreur, sans la valider ni la refuser : rien n\'est signé ni envoyé ; elle reste dans votre Boîte de réception.',
            '<b>Transmettre</b> : pour chaque envoi, <b>« 📨 Envoyer »</b>. Le 1er valideur envoie au 2e valideur, le 2e valideur à l\'assistant Chorus DT ; un refus repart vers le demandeur, avec son motif. Chaque envoi arrive, chiffré, dans le TRIGONE du destinataire ; un destinataire qui n\'a pas encore de compte (ou pas le bon rôle) est signalé et l\'envoi attend.',
            'Terminez par « Terminé » une fois tout envoyé : les demandes traitées quittent votre liste.',
            '<b>Absence</b> (permission, mission) : <b>Paramètres › Compte › Absence</b> : indiquez le mail de votre remplaçant (compte TRIGONE et même rôle) et la date de retour. Jusqu\'à cette date, tout ce qui vous est envoyé part chez lui, et l\'expéditeur en est informé. « Fin de l\'absence » rétablit les envois dès votre retour. Ce qui était déjà dans votre boîte y reste.',
            '<b>Suite de vos demandes</b> : dans la Boîte de réception, section « Traitées », chaque demande que vous avez validée montre sa frise (VALIDEUR 2, assistant Chorus DT) : qui l\'a traitée, quand, et depuis combien de temps elle attend. Si elle est refusée ou renvoyée plus loin dans le circuit, une notification vous prévient.',
            '<b>Rappels</b> : une demande qui vous attend depuis plus de 24 h vous vaut une notification de rappel, puis une par 24 h tant qu\'elle n\'a pas avancé (du lundi au vendredi, de 8 h à 19 h). Le demandeur voit dans son suivi depuis quand elle attend.'] },
    CHORUS: { titre: 'Assistant Chorus DT', sous: 'Demandes validées · comptes-rendus · PDF', icone: MER_ICONES_NOTICE_CHECK(),
        etapes: ['<b>Paramètres › Compte › Mes rôles</b> : cochez <b>ASSIST CHORUS DT</b> et saisissez le code remis par l\'administrateur (il peut y avoir plusieurs assistants Chorus DT ; ce rôle se cumule avec VALIDEUR 1 / VALIDEUR 2). Votre espace apparaît au <b>centre de l\'écran de choix</b> (logo Assist Chorus-DT).',
            '<b>Demandes de mise en route validées</b> : elles arrivent des 2e valideurs. Sur chaque ligne : <b>👁 Aperçu</b> ou <b>📄 Télécharger le PDF</b> (demande signée + NDS / DAF) ; TRIGONE contrôle d\'abord les signatures électroniques et les pièces jointes. Une fois l\'ordre de mission créé dans Chorus DT, touchez <b>✔ Traité</b> (il apparaît après le téléchargement) : la demande passe dans vos « Traités » et le missionnaire est prévenu ; la dernière étape de son suivi, Chorus DT, passe au vert. <b>Contrôle détaillé</b> montre le résultat demande par demande. Un envoi qui n\'a pas les deux signatures est écarté.',
            '<b>✔ Conforme</b> : validée par les deux valideurs habilités, sans modification depuis. <b>✖ Non conforme</b> : la raison est indiquée (validation manquante, faux valideur, demande ou pièce jointe modifiée).',
            'Pour une demande conforme, <b>📄 PDF avec NDS / DAF</b> génère le PDF à traiter : la demande signée suivie des pages de ses pièces jointes (ou un seul PDF pour toutes les demandes conformes).',
            '<b>↩ Renvoyer au demandeur</b> : sur une demande reçue, renvoyez-la directement au demandeur avec un commentaire, sans repasser par les valideurs ; il la corrige et la renvoie (nouveau circuit de validation).',
            '<b>Comptes-rendus de mission</b> : envoyés par les missionnaires depuis TRIGONE Compte-rendu. « Ouvrir » propose le <b>📄 PDF complet</b> (le compte-rendu suivi de tous ses justificatifs, en un seul fichier : aperçu ou téléchargement), puis les fichiers séparés ; terminez par « ✔ Traité ». L\'aperçu depuis la liste montre aussi le PDF complet. Le missionnaire est prévenu quand vous récupérez son compte-rendu, puis quand vous le marquez traité.',
            '<b>Mission collective</b> : sous le compte-rendu du chef ou d\'un participant, la chronologie de l\'équipe indique qui a déjà envoyé son compte-rendu et qui est encore attendu (« 3 sur 4 reçus »), pour traiter la mission d\'un coup.',
            '<b>« ❓ Question »</b> : sur une demande validée ou un compte-rendu reçu, interrogez le missionnaire sans le lui renvoyer ; sa réponse s\'affiche sous l\'élément concerné.',
            '<b>Le demandeur est prévenu</b> quand vous produisez le PDF d\'une demande (« prise en charge par l\'assistant Chorus DT »). Demande ou compte-rendu en attente depuis plus de 24 h : notification de rappel, puis une par 24 h (jours ouvrés, 8 h – 19 h).',
            '<b>Faire du tri</b> : dans chaque section « Traités », « ☑ Sélectionner » permet de cocher plusieurs éléments (ou « Tout cocher ») et de les supprimer d\'un coup. Même principe dans la Boîte de réception des valideurs.'] }
};
// Rubrique « Notifications » de la notice (même texte dans TRIGONE Compte-rendu).
var MER_NOTICE_NOTIF = [
    '<b>Activer</b> : <b>Paramètres › Notifications</b> › « 🔔 Activer les notifications », <b>sur chaque appareil</b> (PC, téléphone, tablette). Vous êtes prévenu de chaque envoi reçu : demande à signer, demande validée, refus ou renvoi, compte-rendu, avec le nombre de demandes.',
    '<b>Tester</b> : Paramètres › Notifications, « 🔔 Tester les notifications » envoie une notification à tous vos appareils et affiche le résultat appareil par appareil.',
    '<b>PC et téléphone à la fois ?</b> Pour ne pas tout recevoir en double, coupez les notifications sur l\'un d\'eux : <b>Paramètres › Notifications › « Couper les notifications ici »</b>. Coupées, le point de votre pastille de compte passe à l\'<b>orange</b> (vert : actives) ; la même ligne les rétablit. Vos autres appareils les reçoivent toujours, et la boîte TRIGONE se relève quand vous ouvrez l\'appli.',
    '<b>Android</b> : si la notification arrive en retard ou pas du tout quand TRIGONE est fermée, retirez l\'économie de batterie : <b>Paramètres › Applications › Chrome › Batterie › « Non restreinte »</b>. Vérifiez aussi que les notifications de Chrome sont autorisées (Paramètres › Applications › Chrome › Notifications).',
    '<b>iPhone / iPad</b> (iOS 16.4 ou plus récent) : pas de réglage batterie. Les notifications demandent TRIGONE <b>installée sur l\'écran d\'accueil</b> (Safari › Partager › Sur l\'écran d\'accueil), puis ouverte depuis cette icône pour les activer. Dans <b>Réglages › Notifications</b> : TRIGONE autorisée (bannières, sons), <b>hors du Résumé programmé</b> (sinon elles n\'arrivent qu\'aux heures du résumé), et ajoutée aux applis autorisées de vos <b>modes de concentration</b> (Ne pas déranger, Travail, Sommeil). Supprimer l\'icône TRIGONE efface l\'abonnement : il faut alors la réinstaller et réactiver les notifications.',
    '<b>PC</b> : les notifications arrivent tant que le navigateur (Chrome, Edge) tourne, même TRIGONE fermée. Sous Windows, vérifiez qu\'elles sont autorisées pour le navigateur (Paramètres › Système › Notifications) et que le mode « Ne pas déranger » est coupé.',
    'Même sans notification, votre boîte TRIGONE se relève d\'elle-même à l\'ouverture de l\'appli, puis toutes les 20 secondes tant qu\'elle est ouverte.'
];
function MER_ICONES_NOTICE_PERSO() { return '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; }
function MER_ICONES_NOTICE_CADENAS() { return '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'; }
function MER_ICONES_NOTICE_CHECK() { return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>'; }
function OUVRIR_NOTICE(cle) { MER_NOTICE_CLE = cle || null; SHOW_PAGE('NOTICE'); }
function TPL_NOTICE() {
    var n = MER_NOTICE_CLE && MER_NOTICES[MER_NOTICE_CLE];
    if (n) {
        return '<div class="CARD"><h2>' + n.titre + '</h2><p class="MER-HINT" style="margin:4px 0 16px;">' + n.sous + '</p>' +
            '<ol class="notice-steps">' + n.etapes.map(function(e) { return '<li>' + e + '</li>'; }).join('') + '</ol>' +
            '<button type="button" class="BTN BTN-SECONDARY" onclick="OUVRIR_NOTICE()">← Aide rapide</button></div>';
    }
    return '<div class="CARD"><h2>Aide rapide</h2>' + (window.JUMELAGE_NOTICE_BOUTON ? window.JUMELAGE_NOTICE_BOUTON() : '') + '<p class="MER-HINT" style="margin:4px 0 16px;">Ou le guide rapide selon votre rôle.</p>' +
        Object.keys(MER_NOTICES).map(function(k) {
            var c = MER_NOTICES[k];
            return '<button type="button" class="NOTICE-CARD" onclick="OUVRIR_NOTICE(\'' + k + '\')"><span class="NOTICE-CARD-ICON">' + c.icone + '</span>' +
                '<span class="NOTICE-CARD-BODY"><span class="NOTICE-CARD-TITLE">' + c.titre + '</span><span class="NOTICE-CARD-SUB">' + c.sous + '</span></span>' +
                '<span class="NOTICE-CARD-CHEV">›</span></button>';
        }).join('') +
        '<details class="notice-fold"><summary><span class="FOLD-ICON"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>Code d\'accès de l\'appli (4 chiffres)</summary><ul>' +
            '<li>Dans <b>Paramètres › Compte › Mon profil</b>, activez un code à 4 chiffres demandé à <b>chaque ouverture</b> de TRIGONE, pour les deux applis.</li>' +
            '<li>Le code ne quitte jamais votre appareil.</li>' +
            '<li><b>Code oublié</b> : le lien « Code oublié ? » efface toutes les données de l\'appli sur cet appareil. Il n\'existe aucun autre moyen.</li></ul></details>' +
        '<details class="notice-fold"><summary><span class="FOLD-ICON"><svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg></span>Mise en route &amp; Compte-rendu</summary><ul>' +
            '<li>TRIGONE réunit les deux applis : la <b>mise en route</b> avant de partir, le <b>compte-rendu de mission</b> au retour.</li>' +
            '<li>À l\'ouverture, l\'écran est coupé en deux en diagonale : touchez <b>Mise en route</b> (en haut à gauche) ou <b>Compte-rendu</b> (en bas à droite). Pour changer ensuite, <b>touchez le logo</b> de l\'accueil : l\'écran de choix revient.</li>' +
            '<li>Votre <b>identité</b> (grade, nom, prénom, matricule, CIE) n\'est saisie qu\'<b>une fois</b> : toute modification dans l\'une est reprise dans l\'autre.</li>' +
            '<li>Dans Compte-rendu, <b>« 📋 À partir d\'une mise en route »</b> liste vos demandes envoyées : en choisir une remplit la mission (identité, libellé, lieux de départ et de retour, transports, gares, demande de réservation, villes du trajet en véhicule personnel, et les horaires des billets dans Frais › Trajets).</li>' +
            '<li>Le code à 4 chiffres n\'est pas redemandé en passant d\'une appli à l\'autre ; chaque partie garde ses propres données.</li></ul></details>' +
        '<details class="notice-fold"><summary><span class="FOLD-ICON"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>Notifications</summary><ul>' + MER_NOTICE_NOTIF.map(function(l) { return '<li>' + l + '</li>'; }).join('') + '</ul></details>' +
        '<details class="notice-fold"><summary><span class="FOLD-ICON"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg></span>Mises à jour</summary><ul>' +
            '<li>L\'appli recherche une nouvelle version à l\'ouverture et à la fermeture ; trouvée à la fermeture, elle s\'installe d\'elle-même au retour dans l\'appli.</li>' +
            '<li>L\'appli se met à jour toute seule dès qu\'il y a du réseau ; un message « Mise à jour » s\'affiche quand une nouvelle version est prête.</li>' +
            '<li>Une <b>notification</b> annonce chaque nouvelle version ; le message « Nouveautés » la résume à l\'ouverture.</li>' +
            '<li>Votre saisie en cours, vos documents et votre bibliothèque sont conservés.</li></ul></details>' +
        '<details class="notice-fold"><summary><span class="FOLD-ICON"><svg viewBox="0 0 24 24"><path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2Z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg></span>Vos données</summary><ul>' +
            '<li>Tout TRIGONE est rangé sur l\'appareil. <b>Paramètres › Données › Sauvegarde automatique</b> le garde aussi dans votre compte, chiffré avec un <b>code de récupération</b> que vous seul connaissez : sur un nouveau téléphone, « Restaurer depuis mon compte » remet tout en place.</li>' +
            '<li>« Sauvegarder dans un fichier » produit en plus un fichier à ranger où vous voulez (mail à vous-même, clé USB, Drive…).</li>' +
            '<li>Un souci technique rencontré par l\'appli est signalé automatiquement à l\'administrateur, sans aucune donnée personnelle.</li></ul></details>' +
        '<button type="button" class="BTN BTN-GHOST" style="margin-top:6px;" onclick="LANCER_DEMO()">🎬 Voir une démonstration</button>' +
        '<button type="button" class="BTN BTN-GHOST" style="margin-top:6px;" onclick="JUMELAGE_PRESENTATION()">Découvrir TRIGONE (présentation)</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}

// ===================== RÉFÉRENCES (comme TRIGONE compte-rendu) =====================
// Les référentiels sur lesquels s'appuie l'appli, et la façon dont ils sont tenus à jour.
function MER_FOLD(icone, titre, lignes) {
    return '<details class="notice-fold"><summary><span class="FOLD-ICON">' + icone + '</span>' + titre + '</summary><ul>' +
        lignes.map(function(l) { return '<li>' + l + '</li>'; }).join('') + '</ul></details>';
}
function TPL_REFERENCES() {
    var c = MER_CODIER, actifs = 0, clotures = 0, source = (c && c._source) || {};
    if (c) Object.keys(c).forEach(function(k) { if (k.charAt(0) === '_') return; if (c[k].cf) actifs++; else clotures++; });
    var nb = function(n) { return n.toLocaleString('fr-FR'); };
    var date = source.date ? new Date(source.date).toLocaleDateString('fr-FR') : '';
    return '<div class="CARD"><h2>Références</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Les référentiels utilisés par TRIGONE Mise en route et leur mise à jour.</p>' +
        MER_FOLD('<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h3M8 17h6"/></svg>', 'Imputations — codier FD', [
            'Source : <b>' + ESC(source.libelle || 'Codier FD') + '</b>' + (date ? ', extraction du <b>' + date + '</b>' : '') + '.',
            c ? '<b>' + nb(actifs) + '</b> codes d\'engagement actifs et <b>' + nb(clotures) + '</b> codes clôturés.' : 'Chargement du codier…',
            'Pour chaque code actif, TRIGONE affiche et recopie dans la demande : le <b>libellé</b>, le <b>centre financier</b>, le <b>centre de coût</b> et le <b>code activité</b>. Ils figurent sur le PDF et sont couverts par la signature des valideurs.',
            'Code <b>clôturé</b> : TRIGONE l\'indique avec sa date de clôture et propose, quand il existe, le <b>code de remplacement</b> en un clic.',
            'Code <b>inconnu</b> : signalé en rouge, la demande ne peut pas être imputée sur un code erroné.',
            '<b>Mise à jour automatique</b> : le codier est relu sur le serveur à chaque ouverture de l\'appli dès qu\'il y a du réseau. Une nouvelle version publiée est donc prise en compte sans rien faire ; hors ligne, la dernière version reçue reste utilisée.']) +
        MER_FOLD('<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>', 'Communes et codes postaux', [
            'Recherche des villes françaises et de leur code postal dans la <b>Base adresse nationale</b> (api-adresse.data.gouv.fr).',
            'Interrogée en direct pendant la saisie : toujours à jour, sans mise à jour à faire. Hors ligne, la ville et le code postal se saisissent à la main.',
            'Pays étrangers : liste reprise de TRIGONE compte-rendu ; le code postal n\'est alors pas demandé.']) +
        MER_FOLD('<svg viewBox="0 0 24 24"><path d="M5 17h14M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M3 17V9l2-5h10l4 5v8M3 9h16"/></svg>', 'Moyens de transport', [
            'Véhicule de service, <b>voie routière civile (VRC)</b>, voie ferrée, voie aérienne, voie maritime.',
            'Selon le moyen, le départ et l\'arrivée sont une <b>gare</b>, un <b>aéroport</b> ou un <b>port</b>.',
            'VRC : joindre la <b>demande d\'autorisation VRC</b>, la <b>carte grise</b> et l\'<b>attestation d\'assurance</b> du véhicule.']) +
        MER_FOLD('<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>', 'Valideurs habilités', [
            'La liste des valideurs habilités (1er et 2e valideur) est publiée avec l\'appli et relue à chaque ouverture de l\'Espace valideur : un changement de code s\'applique automatiquement.',
            'Chaque validation est une <b>signature électronique</b> du contenu exact de la demande et de ses pièces jointes : toute modification ultérieure est détectée.']) +
        MER_FOLD('<svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>', 'Compte-rendu de mission', [
            'TRIGONE Compte-rendu de mission est intégré : on le choisit sur l\'écran d\'ouverture coupé en diagonale, ou en touchant le logo de l\'accueil.',
            'Il garde ses propres références (repas, hébergement, étranger, indemnité kilométrique), consultables depuis son propre bouton « Références ».']) +
        MER_FOLD('<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>', 'Mises à jour de l\'application', [
            'L\'appli vérifie à chaque ouverture si une nouvelle version existe ; le bouton « Mise à jour » de l\'accueil permet de le faire à la main.',
            'Votre saisie en cours, vos documents et votre bibliothèque sont conservés.',
            'Version actuelle : <b>V' + APP_VERSION_AFFICHEE + '</b>.']) +
        '<button type="button" class="BTN BTN-SECONDARY" style="margin-top:6px;" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}

// ===================== DÉMONSTRATION (comme TRIGONE compte-rendu) =====================
// Une demande d'exemple est remplie étape par étape, la mascotte explique chaque écran et la zone concernée
// est mise en évidence. Pendant la démo, rien n'est enregistré (brouillon, documents, réglages, bibliothèque) :
// « Quitter » recharge l'appli, qui retrouve exactement les vraies données.
var DEMO_ACTIF = false, DEMO_IDX = 0, DEMO_PANIER = [];
var DEMO_REGLAGES = { mailSignataire: 'chef.service@interieur.gouv.fr', mailDemandeur: 'jean.dupont@interieur.gouv.fr' };
function DEMO_DEMANDE() {
    var d = VIDE_DEMANDE();
    d.type = 'FORMATION'; d.objet = 'Formation conseiller facteur humain';
    d.personnes = [{ unite: '4°RIISC', cie: '4CIE', grade: 'ADJUDANT', nom: 'DUPONT', prenom: 'Jean', matricule: '067 50 10 191' }];
    d.trajets.aller = { residenceDep: 'ADMINISTRATIVE', moyen: 'FERREE', lieuDep: 'BORDEAUX', cpDep: '33000', paysDep: '', dateDep: '2026-10-12T07:30',
        lieuArr: 'PARIS', cpArr: '75001', paysArr: '', dateArr: '2026-10-12T11:40' };
    d.trajets.retour = { residenceArr: 'ADMINISTRATIVE', moyen: 'FERREE', lieuDep: 'PARIS', cpDep: '75001', paysDep: '', dateDep: '2026-10-16T16:00',
        lieuArr: 'BORDEAUX', cpArr: '33000', paysArr: '', dateArr: '2026-10-16T20:10' };
    d.resaTransport = true; d.nourriMission = true; d.logeMission = true;
    d.codeFD = 'FD1ADNK11F';
    d.pieces = [{ id: 'demo-nds', nom: 'NDS_formation_facteur_humain.pdf', type: 'application/pdf', taille: 184320, sha256: '' }];
    return d;
}
var DEMO_ETAPES = [
    { page: 'ACCUEIL', titre: 'Accueil', texte: 'Pour préparer une mission, appuyez sur « Nouvelle demande ». Votre identité et vos mails viennent de votre profil (bouton de compte en haut à droite) : rien à retaper.',
      zones: ['.BTN-ACCUEIL:not(.BTN-ACCUEIL-PETIT)', '.PC-HERO-ACTIONS .BTN-PRIMARY'] },
    { page: 'FORMULAIRE', onglet: 'IDENTITE', titre: 'Étape 1 — Identité', texte: 'Mission ou formation, l\'objet, puis le personnel concerné, déjà rempli avec votre identité. « Ajouter une personne » ou l\'import Excel en font une demande collective.',
      zones: ['.MER-TOGGLE-PAIR', '[data-path="objet"]', '.MER-PERSONNE-CARD'] },
    { page: 'FORMULAIRE', onglet: 'IDENTITE', titre: 'Les 5 étapes', texte: 'Elles sont en haut : une étape complète passe en vert, et « Étape suivante » mène à la suivante.',
      zones: ['.MER-TABS', '.MER-BOTTOM-BAR .BTN-PRIMARY'] },
    { page: 'FORMULAIRE', onglet: 'ALLER', titre: 'Étape 2 — Trajet aller', texte: 'Lieu de départ de mission, moyen de transport (ici le train), puis gare de départ et d\'arrivée : tapez la ville, le code postal se met tout seul à côté. Dates et heures en dessous.',
      zones: ['[data-path="trajets.aller.residenceDep"]', '[data-path="trajets.aller.moyen"]', '[data-path="trajets.aller.lieuDep"]', '[data-path="trajets.aller.lieuArr"]'] },
    { page: 'FORMULAIRE', onglet: 'RETOUR', titre: 'Étape 3 — Trajet retour', texte: 'Il est prérempli avec l\'aller inversé : il ne reste que les dates et heures du retour.',
      zones: ['[data-path="trajets.retour.dateDep"]', '[data-path="trajets.retour.dateArr"]'] },
    { page: 'FORMULAIRE', onglet: 'CONDITIONS', titre: 'Étape 4 — Alimentation et hébergement', texte: 'Demande de réservation (hébergement, transport), repas et hébergement, pendant le déplacement et sur place. Une réservation demandée ressort en rouge sur le PDF.',
      zones: ['[data-champ="reservation"]', '[data-champ="nourriMission"]', '[data-champ="logeMission"]'] },
    { page: 'FORMULAIRE', onglet: 'IMPUTATION', titre: 'Étape 5 — Imputation', texte: 'Le code FD suffit : TRIGONE affiche le centre financier, le centre de coût et le code activité. Joignez ensuite la NDS ou la DAF (PDF ou photo).',
      zones: ['[data-path="codeFD"]', '#MER-FD-INFO', '.MER-PANIER-ITEM'] },
    { page: 'PANIER', titre: 'Documents', texte: 'La demande attend son envoi dans le dossier « Prêtes à envoyer » (plusieurs demandes peuvent partir ensemble). Vérifiez ce qui part et le mail du 1er valideur, puis « Envoyer cette demande ».',
      zones: ['.MER-PANIER-ITEM', '#MER-MAIL-DEST', '.CARD > .BTN-PRIMARY'] },
    { page: 'PANIER', envoi: true, titre: 'Avant d\'envoyer', texte: 'Aperçu du PDF, puis « Envoyer » : la demande et ses pièces jointes arrivent, chiffrées, directement dans le TRIGONE du 1er valideur.',
      zones: ['#MER-BTN-DIRECT'] },
    { page: 'BIBLIOTHEQUE', titre: 'Bibliothèque', texte: 'Chaque demande envoyée y reste, rangée par dossier selon son avancement (en validation, chez l\'assistant Chorus DT, prise en charge, refusée) : PDF, ou « Refaire une demande » à partir d\'elle. Au retour, TRIGONE Compte-rendu la propose pour préparer le compte-rendu de la mission.',
      zones: ['.MER-VAL-ACTIONS button[onclick^="BIB_PDF"]'] },
    { page: 'ACCUEIL', titre: 'Et ensuite ?', texte: 'Le 1er valideur reçoit la demande dans sa boîte TRIGONE et la signe, puis le 2e valideur, et l\'assistant Chorus DT génère le PDF final.',
      zones: ['.BTN-ACCUEIL-PETIT', '.PC-NAV[onclick*="VALIDATION"]'] },
    { page: 'ACCUEIL', derniere: true, titre: 'À vous de jouer !', texte: 'C\'était une démonstration : aucune donnée n\'a été enregistrée ni envoyée. Lancez votre première demande avec « Nouvelle demande ».',
      zones: ['.BTN-ACCUEIL:not(.BTN-ACCUEIL-PETIT)', '.PC-HERO-ACTIONS .BTN-PRIMARY'] }
];
function LANCER_DEMO() {
    DEMO_ACTIF = true;
    D = DEMO_DEMANDE(); DEMO_PANIER = [D];
    MER_ACTIVE_TAB = 'IDENTITE';
    document.body.classList.add('demo-active');
    document.getElementById('DEMO-OVERLAY').classList.remove('HIDDEN');
    document.getElementById('DEMO-PROGRESSION').innerHTML = DEMO_ETAPES.map(function() { return '<span class="DEMO-POINT"></span>'; }).join('');
    DEMO_ETAPE(0);
}
function DEMO_ETAPE(i) {
    var e = DEMO_ETAPES[i]; if (!e) return;
    DEMO_IDX = i;
    FERMER_MODALE();
    if (e.onglet) MER_ACTIVE_TAB = e.onglet;
    if (e.page === 'PANIER') MER_DOSSIER.PANIER = 'prets';
    SHOW_PAGE(e.page);
    if (e.envoi) PREPARER_ENVOI();
    if (e.onglet === 'IMPUTATION') CHARGER_CODIER().then(function() { if (DEMO_ACTIF && DEMO_IDX === i) { AFFICHER_CODE_FD(); DEMO_ZONES(e); } });
    document.getElementById('DEMO-TEXTE').textContent = (i + 1) + '/' + DEMO_ETAPES.length + ' — ' + e.texte;
    // Affichage : pastille « Démonstration », mascotte et bulle (jumelage.js), en haut sur téléphone, dans l'espace libre sur PC.
    if (window.JUMELAGE_DEMO_MAJ) JUMELAGE_DEMO_MAJ({ etape: i + 1, total: DEMO_ETAPES.length, titre: e.titre, texte: e.texte, derniere: !!e.derniere,
        prec: DEMO_PRECEDENT, suiv: DEMO_SUIVANT, quitter: DEMO_QUITTER });
    document.querySelectorAll('#DEMO-PROGRESSION .DEMO-POINT').forEach(function(p, k) { p.classList.toggle('actif', k === i); });
    document.getElementById('DEMO-PREC').disabled = i === 0;
    document.getElementById('DEMO-SUIV').textContent = e.derniere ? 'Recommencer ↻' : 'Suivant →';
    DEMO_ZONES(e);
    requestAnimationFrame(function() {
        if (!window.JUMELAGE_DEMO_MAJ) {
            var h = Math.ceil(document.querySelector('.DEMO-BANDEAU').getBoundingClientRect().height) + 8;
            document.documentElement.style.setProperty('--demo-bandeau-h', h + 'px');
        }
        var z = document.querySelector('.demo-zone');
        var libre = window.innerHeight - (window.JUMELAGE_DEMO_ESPACE ? JUMELAGE_DEMO_ESPACE() : 0);
        if (z && !e.envoi) z.scrollIntoView({ block: z.getBoundingClientRect().height > libre - 40 ? 'start' : 'center', behavior: 'smooth' }); else window.scrollTo(0, 0);
    });
}
function DEMO_ZONES(e) {
    document.querySelectorAll('.demo-zone').forEach(function(el) { el.classList.remove('demo-zone'); });
    (e.zones || []).forEach(function(sel) { document.querySelectorAll(sel).forEach(function(el) { el.classList.add('demo-zone'); }); });
}
function DEMO_PRECEDENT() { if (DEMO_IDX > 0) DEMO_ETAPE(DEMO_IDX - 1); }
function DEMO_SUIVANT() { DEMO_ETAPE(DEMO_IDX < DEMO_ETAPES.length - 1 ? DEMO_IDX + 1 : 0); }
// Rechargement : l'appli repart de ses vraies données, jamais modifiées pendant la démo.
function DEMO_QUITTER() { location.reload(); }
window.addEventListener('resize', function() {
    if (!DEMO_ACTIF || window.JUMELAGE_DEMO_MAJ) return;
    var b = document.querySelector('.DEMO-BANDEAU');
    if (b) document.documentElement.style.setProperty('--demo-bandeau-h', Math.ceil(b.getBoundingClientRect().height) + 8 + 'px');
});

// ===================== MESSAGE CENTRÉ (comme TRIGONE compte-rendu) =====================
// Remplace alert / confirm : carte centrée, icône, titre, texte et mascotte à droite.
function TYPO_FR(t) { return String(t).replace(/ ([?!:;»])/g, '\u00A0$1').replace(/(«) /g, '$1\u00A0'); }
var MSG_MINUTERIE_FERMETURE = null;
function FERMER_MSG() {
    var o = document.getElementById('MSG-OVERLAY');
    if (!o) return;
    o.classList.remove('msg-in');
    // Minuterie gardée : un message ouvert juste après (bouton qui enchaîne sur un autre message) l'annule.
    clearTimeout(MSG_MINUTERIE_FERMETURE);
    MSG_MINUTERIE_FERMETURE = setTimeout(function() { o.classList.add('HIDDEN'); }, 300);
}
// opts : titre, texte, icone, mascotte (nom d'image, false = sans), mascotteDroit, gauche (texte aligné à gauche), boutons [{label, style, action}]
function AFFICHER_MSG_CENTRE(opts) {
    var o = document.getElementById('MSG-OVERLAY');
    if (!o) { alert((opts.titre ? opts.titre + '\n\n' : '') + (opts.texte || '')); return; }
    clearTimeout(MSG_MINUTERIE_FERMETURE);
    var mascotte = document.getElementById('MSG-MASCOTTE');
    var erreur = opts.icone === '⛔';
    var src = opts.mascotte === false ? null : (opts.mascotte || (erreur ? 'mascotte-erreur.webp' : 'mascotte.webp'));
    mascotte.classList.toggle('HIDDEN', !src);
    if (src) mascotte.setAttribute('src', src);
    mascotte.classList.toggle('msg-mascotte-droit', !!opts.mascotteDroit || (erreur && !opts.mascotte));
    mascotte.parentElement.classList.toggle('has-mascotte', !!src);
    var icone = document.getElementById('MSG-ICONE');
    if (opts.iconeImage) icone.innerHTML = '<img src="' + opts.iconeImage + '" alt="" style="width:72px; height:72px; border-radius:16px; box-shadow:0 6px 16px rgba(0,0,0,0.18);">';
    else icone.textContent = opts.icone || 'ℹ️';
    document.getElementById('MSG-TITRE').textContent = TYPO_FR(opts.titre || '');
    var texte = document.getElementById('MSG-TEXTE');
    texte.textContent = TYPO_FR(opts.texte || '');
    texte.classList.toggle('msg-gauche', !!opts.gauche);
    var zone = document.getElementById('MSG-BOUTONS');
    zone.innerHTML = '';
    (opts.boutons || [{ label: 'OK' }]).forEach(function(b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = b.style || 'BTN BTN-PRIMARY';
        btn.textContent = b.label;
        btn.onclick = function() { FERMER_MSG(); if (b.action) setTimeout(b.action, 300); };
        zone.appendChild(btn);
    });
    o.classList.remove('HIDDEN');
    requestAnimationFrame(function() { requestAnimationFrame(function() { o.classList.add('msg-in'); }); });
    var premier = zone.querySelector('.BTN-PRIMARY') || zone.lastChild;
    if (premier) premier.focus();
}
function MSG_ERREUR(titre, texte, gauche) { AFFICHER_MSG_CENTRE({ titre: titre, texte: texte, icone: '⛔', gauche: gauche }); }
function MSG_INFO(titre, texte, icone, mascotte) { AFFICHER_MSG_CENTRE({ titre: titre, texte: texte, icone: icone, mascotte: mascotte }); }
function MSG_CONFIRM(titre, texte, libelle, action, icone, mascotte, mascotteDroit) {
    AFFICHER_MSG_CENTRE({ titre: titre, texte: texte, icone: icone || '⚠️', mascotte: mascotte, mascotteDroit: mascotteDroit,
        boutons: [{ label: 'Annuler', style: 'BTN-MSG-ANNULER' }, { label: libelle || 'Confirmer', action: action }] });
}

// ===================== MODALE (relecture avant envoi) =====================
function AFFICHER_MODALE(titre, html, boutons) {
    var fond = document.createElement('div');
    fond.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:900; display:flex; align-items:center; justify-content:center; padding:20px;';
    fond.id = 'MER-MODALE-FOND';
    var carte = document.createElement('div');
    carte.className = 'CARD';
    carte.style.cssText = 'margin:0; max-height:85vh; overflow-y:auto; width:100%;';
    carte.innerHTML = '<h2 style="margin-bottom:12px;">' + titre + '</h2>' + html +
        '<div class="MER-ACTIONS" style="margin-top:18px;">' + boutons + '</div>';
    fond.appendChild(carte);
    document.body.appendChild(fond);
}
function FERMER_MODALE() { var f = document.getElementById('MER-MODALE-FOND'); if (f) f.remove(); }

// ===================== ENVOI =====================
// etape : DEMANDE_INITIALE (vers le 1er valideur), VALIDATION_1 (vers le 2e), REFUS (retour au demandeur)
function GENERER_JSON(demandes, etape) {
    return JSON.stringify({
        app: 'TRIGONE-MISE-EN-ROUTE', version: MER_VERSION, etape: etape,
        creeLe: new Date().toISOString(), demandes: demandes
    }, null, 2);
}
// Nom des fichiers : on voit tout de suite QUI a produit le fichier et à quelle étape. Le numéro en tête range les
// fichiers dans l'ordre du circuit :
//   1-DEMANDE MISSIONNAIRE - ADJ BOUQUET - OMR INDIVIDUEL.json   (missionnaire → 1er valideur)
//   2-SIGNE VALIDEUR 1 - ADJ BOUQUET - OMR INDIVIDUEL.json       (1er valideur → 2e valideur)
//   3-SIGNE VALIDEUR 2 - ADJ BOUQUET - OMR INDIVIDUEL.json       (2e valideur → assistant Chorus DT)
//   4-OMR VALIDE - ADJ BOUQUET - OMR INDIVIDUEL.pdf              (PDF généré par l'assistant Chorus DT)
//   REFUS VALIDEUR 1 (ou 2) - ADJ BOUQUET - OMR INDIVIDUEL.json   (refus → missionnaire)
var MER_ETAPES_FICHIER = { DEMANDE: '1-DEMANDE MISSIONNAIRE', VALIDATION_1: '2-SIGNE VALIDEUR 1', VALIDATION_2: '3-SIGNE VALIDEUR 2', PDF_FINAL: '4-OMR VALIDE', RENVOI: 'RENVOI VALIDEUR 2' };
function NOM_FICHIER_BASE(panier, etape) {
    var d = panier[0], n = panier.length - 1;
    var qui = (SUJET_DEMANDEUR(d) || 'DEMANDE') + (n > 0 ? ' (+' + n + ')' : '');
    var tete = etape === 'REFUS' ? 'REFUS ' + QUI_REFUSE(d.refus) : MER_ETAPES_FICHIER[etape || 'DEMANDE'];
    return (tete + ' - ' + qui + ' - OMR ' + SUJET_NATURE(d)).replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

// Auteur d'un refus : VALIDEUR 1, VALIDEUR 2 ou ASSIST CHORUS DT (niveau 3).
function QUI_REFUSE(r) { return r && r.niveau === 3 ? 'ASSIST CHORUS DT' : 'VALIDEUR ' + ((r && r.niveau) || 1); }
function PAR_QUI(r) { return (r && r.niveau === 3 ? 'l\'' : 'le ') + QUI_REFUSE(r); }
function TELECHARGER_TEXTE(nomFichier, contenu, type) {
    var blob = new Blob([contenu], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 4000);
}

function PREPARER_ENVOI() {
    var reg = GET_REGLAGES();
    var mail = ((document.getElementById('MER-MAIL-DEST') || {}).value || reg.mailSignataire || '').trim();
    if (!mail || mail.indexOf('@') === -1) { MSG_ERREUR('Mail manquant', 'Merci de renseigner l\'adresse mail du 1er valideur avant l\'envoi.'); return; }
    reg.mailSignataire = mail; SAVE_REGLAGES(reg);

    var panier = DEMO_ACTIF ? GET_PANIER() : PANIER_PRETES();
    if (!panier.length) { MSG_INFO('Rien à envoyer', 'Aucune demande prête à envoyer : une demande refusée part une fois corrigée.', '📄'); return; }
    // Envoi uniquement par la boîte TRIGONE : sans compte actif, rien ne part (la demande reste dans Documents).
    if (!MER_COMPTE_ACTIF() && !DEMO_ACTIF) {
        AFFICHER_MODALE('Compte TRIGONE à activer',
            '<p style="font-size:0.86em; line-height:1.5;">Les demandes partent directement dans le TRIGONE du 1er valideur, chiffrées. Activez d\'abord votre <b>compte TRIGONE</b> (votre adresse mail, vérifiée par un code) : une seule fois, sur cet appareil.</p>' +
            '<p class="MER-HINT">Votre demande reste dans Documents en attendant.</p>',
            '<button type="button" class="BTN BTN-SECONDARY" style="flex:0 0 auto;" onclick="FERMER_MODALE()">Plus tard</button>' +
            '<button type="button" class="BTN BTN-PRIMARY" onclick="FERMER_MODALE(); JUMELAGE_COMPTE()">Se connecter</button>');
        return;
    }
    var pj = [].concat.apply([], panier.map(function(d) { return d.pieces || []; }));
    var sansPJ = panier.filter(function(d) { return !(d.pieces || []).length; }).length;
    AFFICHER_MODALE('Avant d\'envoyer',
        '<p style="font-size:0.86em; line-height:1.5;">Vérifiez votre demande dans l\'aperçu, puis envoyez-la. Elle arrive, chiffrée, dans le TRIGONE du 1er valideur (<b>' + ESC(mail) + '</b>) :</p>' +
        '<p style="font-size:0.86em; line-height:1.7; background:rgba(214,167,86,0.07); padding:10px 12px; border-radius:10px;">📨 ' + panier.length + ' demande(s)' +
            (pj.length ? '<br><span style="color:var(--sm2-muted);">avec : ' + pj.map(function(p) { return ESC(p.nom); }).join(', ') + '</span>' : '') + '</p>' +
        (sansPJ ? '<p class="MER-HINT" style="color:#b45309; font-weight:700;">⚠ ' + sansPJ + ' demande(s) sans NDS ni DAF jointe.</p>' : '') +
        (panier.some(UTILISE_VRC) ? '<div style="font-size:0.86em; line-height:1.5; background:rgba(180,83,9,0.09); border:1.5px solid rgba(180,83,9,0.35); color:#92400e; padding:10px 12px; border-radius:10px; margin:10px 0;">' +
            '🚗 <b>Rappel — voie routière civile (VRC)</b><br>Joignez ' + MER_PIECES_VRC + ' : ajoutez-les en pièces jointes de la demande (onglet Imputation) avant d\'envoyer.</div>' : '') +
        '<button type="button" class="BTN BTN-GHOST" style="margin-top:8px;" onclick="VOIR_APERCU_PANIER()">👁 Aperçu du PDF</button>',
        '<button type="button" class="BTN BTN-SECONDARY" style="flex:0 0 auto;" onclick="FERMER_MODALE()">Annuler</button>' +
        '<button type="button" class="BTN BTN-PRIMARY" id="MER-BTN-DIRECT" onclick="ENVOYER_PANIER_DIRECT()">📨 Envoyer</button>'
    );
}
function VOIR_APERCU_PANIER() {
    try { window.open(GENERER_PDF(DEMO_ACTIF ? GET_PANIER() : PANIER_PRETES()).output('bloburl'), '_blank'); }
    catch (e) { MSG_ERREUR('PDF impossible', 'Erreur lors de la génération du PDF : ' + e.message); }
}

// ---- Objets des mails ----
// Le demandeur est la première personne de la demande ; COLLECTIF dès qu'elle concerne plusieurs personnes.
// Plusieurs demandes dans un même mail : l'objet reprend la première et indique le nombre des autres.
function SUJET_DEMANDEUR(d) {
    var p = (d.personnes || [])[0] || {};
    return [(p.grade || '').toUpperCase(), (p.nom || '').toUpperCase()].filter(Boolean).join(' ');
}
function SUJET_NATURE(d) { return (d.personnes || []).length > 1 ? 'COLLECTIF' : 'INDIVIDUEL'; }
function SUJET_AUTRES(demandes) {
    var n = demandes.length - 1;
    return n > 0 ? ' (+ ' + n + ' autre' + (n > 1 ? 's' : '') + ' demande' + (n > 1 ? 's' : '') + ')' : '';
}
function SUJET_MAIL(etape, demandes) {
    var d = demandes[0], qui = SUJET_DEMANDEUR(d), objet = (d.objet || '').trim(), autres = SUJET_AUTRES(demandes);
    if (etape === 'DEMANDE') return qui + (objet ? ' - ' + objet : '') + autres;
    if (etape === 'VALIDATION_1') return 'Demande de validation ' + SUJET_NATURE(d) + ' pour ' + qui + (objet ? ' - ' + objet : '') + autres;
    if (etape === 'CHORUS') return 'Demande de Mise en route ' + SUJET_NATURE(d) + ' - ' + qui + autres;
    return 'Demande refusée - ' + qui + (objet ? ' - ' + objet : '') + autres;
}

function MER_NUMEROTER_OMR(demandes) {
    if (!window.JUMELAGE_OMR_TIRER || DEMO_ACTIF) return Promise.resolve();
    return demandes.reduce(function(suite, d) {
        return suite.then(function() {
            if (d.omr) return;
            return JUMELAGE_OMR_TIRER().then(function(r) { d.omr = r.numero; d.omrLe = r.le; }, function() {});
        });
    }, Promise.resolve()).then(function() {
        // Gardé dans Documents : un nouvel essai (envoi échoué) reprend le même numéro.
        if (DEMO_ACTIF) return;
        var p = GET_PANIER();
        p.forEach(function(x) { var d = demandes.filter(function(y) { return y.id === x.id; })[0]; if (d && d.omr) { x.omr = d.omr; x.omrLe = d.omrLe; } });
        SAVE_PANIER(p);
    });
}
// « OMR N°0001 » (numéro de la série commune) ; '' sans numéro.
function MER_OMR_LIBELLE(d) { return d && d.omr ? 'OMR N°' + d.omr : ''; }
function PANIER_A_ENVOYER() {
    var reg = GET_REGLAGES(), panier = PANIER_PRETES();
    // Un refus revient au demandeur, dans sa boîte TRIGONE : l'adresse de son compte.
    var moi = (window.JUMELAGE_COMPTE_MAIL && JUMELAGE_COMPTE_MAIL()) || (reg.mailDemandeur || '').trim();
    panier.forEach(function(d) { d.mailDemandeur = moi; d.validations = []; delete d.refus; delete d.renvoi; delete d.mailValideur1; });
    return panier;
}
// Rappel « départ en mission » : notification le jour du départ, à 7 h (ou 1 h avant un départ plus matinal), qui
// ouvre le compte-rendu prérempli depuis la demande. Rien si le départ est déjà passé (ou dans moins de 15 min).
function MER_HEURE_RAPPEL(d) {
    var v = d && d.trajets && d.trajets.aller && d.trajets.aller.dateDep;
    var dep = v ? new Date(v) : null;
    if (!dep || isNaN(dep)) return 0;
    var sept = new Date(dep); sept.setHours(7, 0, 0, 0);
    var quand = Math.min(sept.getTime(), dep.getTime() - 3600 * 1000), maintenant = Date.now();
    if (dep.getTime() - maintenant < 15 * 60 * 1000) return 0;
    return Math.max(quand, maintenant);
}
function MER_LISTE_RAPPELS(demandes) {
    return (demandes || []).filter(function(d) { return d.id; }).map(function(d) { return { ref: d.id, quand: MER_HEURE_RAPPEL(d) }; }).filter(function(x) { return x.quand; });
}
function MER_PROGRAMMER_RAPPELS(demandes) {
    var l = MER_LISTE_RAPPELS(demandes);
    if (l.length && window.JUMELAGE_RAPPEL_DEPART) JUMELAGE_RAPPEL_DEPART(l);
}
// Envoi direct (compte TRIGONE) : le .json complet, chiffré, déposé dans la boîte du 1er valideur.
function ENVOYER_PANIER_DIRECT() {
    var reg = GET_REGLAGES(), panier = PANIER_A_ENVOYER(), b = document.getElementById('MER-BTN-DIRECT');
    if (b) { b.disabled = true; b.textContent = 'Envoi en cours…'; }
    var idBib = 'e' + Date.now(), plus = panier.length > 1;
    // Sans réseau : la demande part toute seule au retour du réseau (boîte d'envoi) ; une fois partie, la
    // Bibliothèque la marque envoyée et le rappel du départ est programmé.
    var opts = { differable: true, libelle: plus ? 'Vos ' + panier.length + ' demandes' : 'Votre demande' + (panier[0].objet ? ' « ' + panier[0].objet + ' »' : ''),
        meta: { maj: [{ cle: 'mer_bibliotheque', cherche: { id: idBib }, pose: { envoyeLe: '$iso' }, retire: ['attente'] }], rappels: MER_LISTE_RAPPELS(panier) } };
    // N° OMR (série commune, serveur) tiré à l'envoi, avec sa date ; il fait partie de la demande signée par les valideurs.
    // Sans réseau : la demande part sans numéro, l'assistant Chorus DT lui en donne un à son arrivée.
    MER_NUMEROTER_OMR(panier).then(function() { return GENERER_JSON_COMPLET(panier, 'DEMANDE_INITIALE'); }).then(function(json) {
        return JUMELAGE_ENVOYER_DIRECT(reg.mailSignataire, 'DEMANDE', NOM_FICHIER_BASE(panier) + '.json', json, opts);
    }).then(function(r) {
        var differe = !!(r && r.differe);
        ARCHIVER_ENVOI(panier, reg.mailSignataire, idBib, differe);
        if (!differe) MER_PROGRAMMER_RAPPELS(panier);
        FERMER_MODALE();
        SAVE_PANIER(GET_PANIER().filter(function(d) { return d.refus; }));   // les refusées non corrigées restent
        setTimeout(function() {
            SHOW_PAGE('ACCUEIL');
            if (differe) MSG_INFO('Pas de réseau : envoi en attente', (plus ? 'Vos ' + panier.length + ' demandes partiront' : 'Votre demande partira') + ' toute' + (plus ? 's' : '') + ' seule' + (plus ? 's' : '') +
                ' vers le 1er valideur (' + reg.mailSignataire + ') dès le retour du réseau, même si vous fermez TRIGONE entre-temps (elle part à la prochaine ouverture avec du réseau). Une notification « Envoyé » vous préviendra. En attendant, ' +
                (plus ? 'elles sont rangées' : 'elle est rangée') + ' dans votre Bibliothèque (« en attente de réseau »).', '📤', 'mascotte-ok.webp');
            else MSG_INFO(plus ? 'Demandes envoyées' : 'Demande envoyée', (plus ? 'Vos ' + panier.length + ' demandes sont arrivées' : 'Votre demande est arrivée') +
                ' directement dans le TRIGONE du 1er valideur (' + reg.mailSignataire + '), chiffrée. ' + (plus ? 'Elles quittent' : 'Elle quitte') + ' Documents et ' +
                (plus ? 'sont rangées' : 'est rangée') + ' dans votre Bibliothèque.', '✅', 'mascotte-ok.webp');
        }, 300);
    }).catch(function(e) {
        if (b) { b.disabled = false; b.textContent = '📨 Envoyer'; }
        MSG_ERREUR(e.pasDeCompte ? 'Pas encore de compte TRIGONE' : e.statut === 403 ? 'Mauvais destinataire' : 'Envoi impossible', e.pasDeCompte
            ? 'Le 1er valideur (' + reg.mailSignataire + ') n\'a pas encore de compte TRIGONE : demandez-lui de se connecter (bouton « Se connecter » en haut à droite), puis d\'ajouter son rôle (menu du compte › Mes rôles › VALIDEUR 1). Votre demande reste dans Documents : renvoyez-la ensuite.'
            : (e.message || String(e)) + '\n\nVotre demande reste dans Documents.');
    });
}
// ===================== PIÈCES JOINTES (NDS / DAF) =====================
// Le missionnaire joint sa NDS ou sa DAF (PDF ou photo) à la demande. Les fichiers sont rangés dans IndexedDB
// (trop lourds pour localStorage) ; la demande ne garde que nom, type, taille et empreinte SHA-256 — empreinte
// couverte par les signatures des valideurs. Les fichiers voyagent DANS le .json (champ « pieces ») : un seul
// fichier circule jusqu'au 2e valideur, qui produit le PDF final (demande signée + pages des pièces jointes).
var PJ_TAILLE_MAX = 10 * 1024 * 1024;
var MER_PJ_ALTEREES = {};   // pièces du formulaire en cours dont le contenu ne correspond plus à l'empreinte
var PJ_BASE = null;
function PJ_DB() {
    if (!PJ_BASE) PJ_BASE = new Promise(function(ok, ko) {
        var r = indexedDB.open('trigone-mise-en-route', 2);
        r.onupgradeneeded = function() {
            var noms = r.result.objectStoreNames;
            if (!noms.contains('pieces')) r.result.createObjectStore('pieces');
            if (!noms.contains('acces')) r.result.createObjectStore('acces');
        };
        r.onsuccess = function() { ok(r.result); };
        r.onerror = function() { ko(r.error); };
    });
    return PJ_BASE;
}
function PJ_ECRIRE(id, piece) {
    return PJ_DB().then(function(db) { return new Promise(function(ok, ko) {
        var tx = db.transaction('pieces', 'readwrite'); tx.objectStore('pieces').put(piece, id);
        tx.oncomplete = function() { ok(); }; tx.onerror = function() { ko(tx.error); };
    }); });
}
function PJ_LIRE(id) {
    return PJ_DB().then(function(db) { return new Promise(function(ok, ko) {
        var r = db.transaction('pieces').objectStore('pieces').get(id);
        r.onsuccess = function() { ok(r.result || null); }; r.onerror = function() { ko(r.error); };
    }); });
}
// Accès valideur mémorisé sur l'appareil : la clé de signature déverrouillée est conservée NON EXPORTABLE
// (le navigateur peut s'en servir pour signer mais jamais la révéler) ; le code d'accès, lui, n'est jamais stocké.
// Clés : « valideur » (rôle en cours), « valideur1 » et « valideur2 » (une même personne peut avoir les deux rôles).
function ACCES_MEMO(action, valeur, cle) {
    cle = cle || 'valideur';
    return PJ_DB().then(function(db) { return new Promise(function(ok, ko) {
        var tx = db.transaction('acces', action === 'lire' ? 'readonly' : 'readwrite'), st = tx.objectStore('acces');
        var r = action === 'lire' ? st.get(cle) : action === 'effacer' ? st.delete(cle) : st.put(valeur, cle);
        tx.oncomplete = function() { ok(action === 'lire' ? (r.result || null) : null); }; tx.onerror = function() { ko(tx.error); };
    }); });
}
function SHA256_HEX(buf) {
    return crypto.subtle.digest('SHA-256', buf).then(function(h) {
        return Array.prototype.map.call(new Uint8Array(h), function(x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
}
function TAILLE_LISIBLE(o) { return o < 1024 * 1024 ? Math.max(1, Math.round(o / 1024)) + ' Ko' : (o / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo'; }

function AJOUTER_PJ(input) {
    var fichiers = Array.prototype.slice.call(input.files || []);
    input.value = '';
    D.pieces = D.pieces || [];
    fichiers.reduce(function(prec, f) {
        return prec.then(function() {
            if (f.size > PJ_TAILLE_MAX) { MSG_ERREUR('Fichier trop lourd', '« ' + f.name + ' » dépasse 10 Mo. Réduisez-le (scan en qualité standard) puis réessayez.'); return; }
            if (!/^(application\/pdf|image\/(jpeg|png))$/.test(f.type)) { MSG_ERREUR('Format non accepté', '« ' + f.name + ' » : seuls les PDF et les photos JPEG ou PNG sont acceptés.'); return; }
            // Photo d'un document : « scannée » (recadrée, fond blanc, texte foncé, plus légère) avant d'être jointe.
            return (window.JUMELAGE_SCANNER_PHOTO && /^image\//.test(f.type) ? JUMELAGE_SCANNER_PHOTO(f) : Promise.resolve(f)).then(function(s) { f = s; return f.arrayBuffer(); }).then(function(buf) {
                return SHA256_HEX(buf).then(function(sha) {
                    var id = 'pj-' + sha.slice(0, 24);
                    return PJ_ECRIRE(id, { nom: f.name, type: f.type, b64: B64(buf) }).then(function() {
                        if (!D.pieces.some(function(p) { return p.id === id; }))
                            D.pieces.push({ id: id, nom: f.name, type: f.type, taille: f.size, sha256: sha });
                    });
                });
            });
        });
    }, Promise.resolve()).then(function() { SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); })
      .catch(function(e) { MSG_ERREUR('Pièce jointe impossible', e.message || String(e)); });
}
function RETIRER_PJ(i) { D.pieces.splice(i, 1); SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }
// Ouvre une pièce jointe (la fenêtre est ouverte tout de suite, sinon le navigateur la bloque).
function OUVRIR_PJ(id, alteree) {
    if (alteree || MER_PJ_ALTEREES[id]) { MSG_ERREUR('Pièce jointe modifiée', 'Le fichier reçu ne correspond pas à celui signé : il a été modifié en cours de route.'); return; }
    var w = window.open('', '_blank');
    PJ_LIRE(id).then(function(p) {
        if (!p) { if (w) w.close(); MSG_ERREUR('Pièce jointe absente', 'Ce fichier n\'est pas sur cet appareil : rouvrez la demande depuis la Boîte de réception.'); return; }
        var url = URL.createObjectURL(new Blob([DEB64(p.b64)], { type: p.type }));
        if (w) w.location = url; else window.open(url, '_blank');
    });
}
function TPL_PJ_PUCES(pieces, alterees) {
    return (pieces || []).map(function(p) {
        var ko = (alterees || []).indexOf(p.id) !== -1;
        return '<button type="button" class="MER-PJ-PUCE' + (ko ? ' ko' : '') + '" onclick="OUVRIR_PJ(\'' + p.id + '\'' + (ko ? ', true' : '') + ')">' + (ko ? '⚠ ' : '📎 ') + ESC(p.nom) + '</button>';
    }).join('');
}
function TPL_PJ_FORMULAIRE() {
    var pieces = D.pieces || [];
    return pieces.map(function(p, i) {
        return '<div class="MER-PANIER-ITEM" style="padding:10px 12px;"><div class="MER-PANIER-ITEM-TXT">' +
            '<div class="MER-PANIER-ITEM-TITRE">📎 ' + ESC(p.nom) + '</div><div class="MER-PANIER-ITEM-SUB">' + TAILLE_LISIBLE(p.taille) + '</div></div>' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto;" onclick="OUVRIR_PJ(\'' + p.id + '\')">Voir</button>' +
            '<button type="button" class="BTN-DANGER-TEXT" onclick="RETIRER_PJ(' + i + ')">Retirer</button></div>';
    }).join('') +
    (UTILISE_VRC(D) ? '<p class="MER-HINT" style="color:#b45309; font-weight:700; margin-bottom:8px;">🚗 VRC : joignez aussi ' + MER_PIECES_VRC + '.</p>' : '') +
    '<label class="BTN BTN-GHOST" style="margin-bottom:6px;">📎 Joindre la NDS ou la DAF (PDF ou photo)' +
        '<input type="file" accept="application/pdf,image/jpeg,image/png" multiple style="display:none;" onchange="AJOUTER_PJ(this)"></label>' +
    '<p class="MER-HINT" style="margin-bottom:14px;">Le fichier voyage avec la demande jusqu\'au 2e valideur, qui l\'ajoute au PDF final envoyé à l\'assistant Chorus DT.</p>';
}

// .json complet : les demandes + le contenu des pièces jointes.
function GENERER_JSON_COMPLET(demandes, etape) {
    var ids = {};
    demandes.forEach(function(d) { (d.pieces || []).forEach(function(p) { ids[p.id] = true; }); });
    var pieces = {};
    return Promise.all(Object.keys(ids).map(function(id) {
        return PJ_LIRE(id).then(function(p) { if (p) pieces[id] = p; });
    })).then(function() {
        var data = JSON.parse(GENERER_JSON(demandes, etape));
        data.pieces = pieces;
        return JSON.stringify(data);
    });
}
// À l'import : chaque fichier est vérifié contre l'empreinte signée avant d'être rangé sur l'appareil.
// Renvoie, par demande, la liste des pièces dont le contenu a été modifié (ou qui manquent au fichier).
function STOCKER_PJ_IMPORTEES(contenus) {
    var taches = [], alterees = {};
    contenus.forEach(function(data) {
        var fichiers = data.pieces || {};
        data.demandes.forEach(function(d) {
            (d.pieces || []).forEach(function(meta) {
                var f = fichiers[meta.id];
                if (!f) return;
                taches.push(SHA256_HEX(DEB64(f.b64)).then(function(sha) {
                    if (sha !== meta.sha256) { (alterees[d.id] = alterees[d.id] || []).push(meta.id); return; }
                    return PJ_ECRIRE(meta.id, f);
                }));
            });
        });
    });
    return Promise.all(taches).then(function() { return alterees; });
}

// PDF final (2e valideur → Chorus DT) : la page de chaque demande, suivie des pages de ses pièces jointes.
var PDFLIB_CHARGEMENT = null;
function CHARGER_PDFLIB() {
    if (window.PDFLib) return Promise.resolve();
    if (!PDFLIB_CHARGEMENT) PDFLIB_CHARGEMENT = new Promise(function(ok, ko) {
        var sc = document.createElement('script'); sc.src = 'vendor/pdf-lib.min.js';
        sc.onload = function() { ok(); }; sc.onerror = function() { PDFLIB_CHARGEMENT = null; ko(new Error('module PDF indisponible')); };
        document.head.appendChild(sc);
    });
    return PDFLIB_CHARGEMENT;
}
function GENERER_PDF_FINAL(demandes) {
    var base = GENERER_PDF(demandes).output('arraybuffer');
    return CHARGER_PDFLIB().then(function() { return PDFLib.PDFDocument.load(base); }).then(function(doc) {
        var decalage = 0;
        return demandes.reduce(function(prec, d, i) {
            return prec.then(function() {
                var position = i + 1 + decalage;   // juste après la page de cette demande
                return (d.pieces || []).reduce(function(p2, meta) {
                    return p2.then(function() { return PJ_LIRE(meta.id); }).then(function(pj) {
                        if (!pj) return;
                        var octets = new Uint8Array(DEB64(pj.b64));
                        if (pj.type === 'application/pdf') {
                            return PDFLib.PDFDocument.load(octets, { ignoreEncryption: true }).then(function(src) {
                                return doc.copyPages(src, src.getPageIndices());
                            }).then(function(pages) {
                                pages.forEach(function(pg) { doc.insertPage(position++, pg); decalage++; });
                            });
                        }
                        return (pj.type === 'image/png' ? doc.embedPng(octets) : doc.embedJpg(octets)).then(function(img) {
                            var A4 = [595.28, 841.89], marge = 28;
                            var e = Math.min((A4[0] - 2 * marge) / img.width, (A4[1] - 2 * marge) / img.height, 1);
                            var pg = doc.insertPage(position++, A4); decalage++;
                            pg.drawImage(img, { x: (A4[0] - img.width * e) / 2, y: (A4[1] - img.height * e) / 2, width: img.width * e, height: img.height * e });
                        });
                    });
                }, Promise.resolve());
            });
        }, Promise.resolve()).then(function() { return doc.save({ useObjectStreams: false }); });
    });
}
function TELECHARGER_OCTETS(nom, octets, type) {
    var url = URL.createObjectURL(new Blob([octets], { type: type }));
    var a = document.createElement('a'); a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 4000);
}

// ===================== SÉCURITÉ DES VALIDATIONS =====================
// Pas de serveur : valideurs.json (sur GitHub, que seul l'administrateur peut modifier) contient, pour le 1er
// et le 2e valideur, une clé publique et la clé privée correspondante chiffrée par un code d'accès que seul
// le valideur connaît. Le code déverrouille la clé ; une validation est une signature ECDSA du contenu
// exact de la demande : une signature faite avec une clé absente de la liste, ou une demande modifiée après
// signature, est détectée par le 2e valideur, par l'assistant Chorus DT et par la page de vérification.
var STORAGE_LISTE_VALIDEURS = 'mer_liste_valideurs';
var MER_CLE_SESSION = null;          // clé privée déverrouillée par le code d'accès (non exportable, mémorisée sur l'appareil)
var MER_ACCES_SESSION = null;        // entrée de valideurs.json correspondant au code saisi
var MER_LISTE_VALIDEURS = null;      // contenu de valideurs.json

function B64(buf) {
    var s = '', o = new Uint8Array(buf);
    for (var i = 0; i < o.length; i++) s += String.fromCharCode(o[i]);
    return btoa(s);
}
function DEB64(b64) {
    var s = atob(b64), o = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return o.buffer;
}
function B64_TEXTE(t) { return btoa(unescape(encodeURIComponent(t))); }
function TEXTE_B64(b) { return decodeURIComponent(escape(atob(b))); }
function OCTETS(t) { return new TextEncoder().encode(t); }

// JSON à clés triées : la même demande donne toujours exactement le même texte à signer.
function JSON_STABLE(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(JSON_STABLE).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function(k) { return v[k] !== undefined; })
        .map(function(k) { return JSON.stringify(k) + ':' + JSON_STABLE(v[k]); }).join(',') + '}';
}
function CONTENU_SIGNE(d) {
    var c = JSON.parse(JSON.stringify(d));
    delete c.validations; delete c.refus;
    // Acheminement seulement (pas le contenu de la demande) : renvoi du VALIDEUR 2, adresse du VALIDEUR 1.
    delete c.renvoi; delete c.mailValideur1;
    return c;
}
function TEXTE_A_SIGNER(d, niveau, signataire, le) {
    return JSON_STABLE({
        demande: CONTENU_SIGNE(d),
        precedentes: (d.validations || []).slice(0, niveau - 1).map(function(v) { return v.sig; }),
        niveau: niveau, signataire: signataire, le: le
    });
}

var ALGO_CLE = { name: 'ECDSA', namedCurve: 'P-256' };
var ALGO_SIG = { name: 'ECDSA', hash: 'SHA-256' };

function CLE_DU_CODE(code, sel) {
    return crypto.subtle.importKey('raw', OCTETS(code), 'PBKDF2', false, ['deriveKey']).then(function(base) {
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: 250000, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
}

// ---- Liste des valideurs habilités (valideurs.json) ----
function CHARGER_LISTE_VALIDEURS() {
    return fetch('valideurs.json?t=' + Date.now(), { cache: 'no-store' }).then(function(r) {
        if (!r.ok) throw new Error('liste');
        return r.json();
    }).then(function(liste) {
        MER_LISTE_VALIDEURS = liste;
        try { localStorage.setItem(STORAGE_LISTE_VALIDEURS, JSON.stringify(liste)); } catch (e) {}
        return liste;
    }).catch(function() {
        // Hors ligne : dernière liste connue, sinon celle rangée par l'appli à son installation (service worker) :
        // un valideur ou l'assistant Chorus DT qui ne s'est encore jamais connecté peut ainsi travailler sans réseau.
        try { MER_LISTE_VALIDEURS = JSON.parse(localStorage.getItem(STORAGE_LISTE_VALIDEURS) || 'null'); } catch (e) {}
        if (MER_LISTE_VALIDEURS) return MER_LISTE_VALIDEURS;
        return (window.caches ? caches.match('valideurs.json', { ignoreSearch: true }) : Promise.resolve(null)).then(function(r) {
            return r ? r.json() : null;
        }).catch(function() { return null; }).then(function(liste) {
            MER_LISTE_VALIDEURS = liste || { valideurs: [] };
            return MER_LISTE_VALIDEURS;
        });
    });
}
function HABILITATION(cle) {
    var l = (MER_LISTE_VALIDEURS && MER_LISTE_VALIDEURS.valideurs) || [];
    return l.filter(function(v) { return v.cle === cle; })[0] || null;
}
function LIBELLE_ROLE(role) { return role === 2 ? '2e valideur' : '1er valideur'; }

// Vérifie chaque validation d'une demande. Renvoie une liste { ok, message, validation }.
function VERIFIER_VALIDATIONS(d) {
    var vals = d.validations || [];
    return Promise.all(vals.map(function(v, i) {
        var niveau = i + 1;
        var h = v.signataire ? HABILITATION(v.signataire.cle) : null;
        var ko = function(m) { return { ok: false, message: m, validation: v, niveau: niveau }; };
        if (!v.sig || !v.signataire) return Promise.resolve(ko('Validation sans signature électronique'));
        if (!h) return Promise.resolve(ko('Valideur non habilité'));
        if (h.role !== niveau) return Promise.resolve(ko('Valideur habilité comme ' + LIBELLE_ROLE(h.role) + ' seulement'));
        if (h.retire && v.le > h.retire) return Promise.resolve(ko('Habilitation retirée le ' + new Date(h.retire).toLocaleDateString('fr-FR')));
        if (vals.slice(0, i).some(function(p) { return p.signataire && p.signataire.cle === v.signataire.cle; }))
            return Promise.resolve(ko('Même valideur pour les deux niveaux'));
        return crypto.subtle.importKey('spki', DEB64(v.signataire.cle), ALGO_CLE, false, ['verify']).then(function(pub) {
            return crypto.subtle.verify(ALGO_SIG, pub, DEB64(v.sig), OCTETS(TEXTE_A_SIGNER(d, niveau, v.signataire, v.le)));
        }).then(function(bon) {
            return bon ? { ok: true, message: 'Signature vérifiée', validation: v, niveau: niveau }
                       : ko('Demande modifiée après validation');
        }).catch(function() { return ko('Signature illisible'); });
    }));
}

// Reconnexion automatique : reprend la clé mémorisée tant que son accès figure toujours, actif, dans valideurs.json
// (un code remplacé ou retiré par l'administrateur déconnecte l'appareil).
// Rôles valideur dont la clé est mémorisée sur l'appareil : { 1: true, 2: true } si la personne a les deux.
var MER_ROLES_MEMO = {};
function MER_ACCES_VALIDE(m) {
    return m && m.cle ? ((MER_LISTE_VALIDEURS && MER_LISTE_VALIDEURS.valideurs) || []).filter(function(x) { return x.cle === m.pub && !x.retire; })[0] || null : null;
}
function RESTAURER_ACCES() {
    var listeConnue = !!(MER_LISTE_VALIDEURS && (MER_LISTE_VALIDEURS.valideurs || []).length);
    return Promise.all(['valideur', 'valideur1', 'valideur2'].map(function(k) { return ACCES_MEMO('lire', null, k).catch(function() { return null; }); })).then(function(m) {
        var suite = [];
        // Ancienne mémoire (un seul rôle) : rangée aussi sous la clé de son rôle.
        var a0 = MER_ACCES_VALIDE(m[0]);
        if (a0 && !m[a0.role]) { m[a0.role] = m[0]; suite.push(ACCES_MEMO('ecrire', m[0], 'valideur' + a0.role)); }
        MER_ROLES_MEMO = {};
        [1, 2].forEach(function(n) {
            var a = MER_ACCES_VALIDE(m[n]);
            if (a && a.role === n) MER_ROLES_MEMO[n] = true;
            else if (m[n] && listeConnue) suite.push(ACCES_MEMO('effacer', null, 'valideur' + n));
        });
        if (!MER_CLE_SESSION) {
            var n = a0 ? 0 : MER_ROLES_MEMO[1] ? 1 : MER_ROLES_MEMO[2] ? 2 : -1;
            if (n >= 0) { MER_CLE_SESSION = m[n].cle; MER_ACCES_SESSION = MER_ACCES_VALIDE(m[n]); if (n) suite.push(ACCES_MEMO('ecrire', m[n])); }
            else if (m[0] && listeConnue) suite.push(ACCES_MEMO('effacer'));
        }
        return Promise.all(suite);
    }).catch(function() {});
}
// Passe au rôle valideur n (clé déjà mémorisée) : VALIDEUR 1 ⇄ VALIDEUR 2, sans ressaisir de code.
function MER_PASSER_ROLE(n) {
    return ACCES_MEMO('lire', null, 'valideur' + n).then(function(m) {
        var a = MER_ACCES_VALIDE(m);
        if (!a) return false;
        MER_CLE_SESSION = m.cle; MER_ACCES_SESSION = a;
        return ACCES_MEMO('ecrire', m).then(function() { MER_DECLARER_ROLE_VALIDEUR(); return true; });
    }).catch(function() { return false; });
}
function MER_CHOISIR_ROLE(n) { MER_PASSER_ROLE(n).then(function() { MER_VAL_SEL = null; RENDER_VALIDATION_INPLACE(); }); }
// Bascule affichée quand la personne est à la fois VALIDEUR 1 et VALIDEUR 2.
function TPL_BASCULE_ROLE(h) {
    if (!(MER_ROLES_MEMO[1] && MER_ROLES_MEMO[2])) return '';
    return '<div class="MER-BASCULE-ROLE" role="group" aria-label="Valider en tant que">' + [1, 2].map(function(n) {
        return '<button type="button" class="' + (h.role === n ? 'actif' : '') + '" onclick="MER_CHOISIR_ROLE(' + n + ')">VALIDEUR ' + n + '</button>';
    }).join('') + '</div>';
}
function SIGNER_VALIDATION(d, h) {
    var niveau = (d.validations || []).length + 1;
    var signataire = { cle: h.cle, grade: h.grade, nom: h.nom, prenom: h.prenom, fonction: h.fonction };
    var le = new Date().toISOString();
    return crypto.subtle.sign(ALGO_SIG, MER_CLE_SESSION, OCTETS(TEXTE_A_SIGNER(d, niveau, signataire, le))).then(function(sig) {
        return { niveau: niveau, signataire: signataire, grade: h.grade, nom: h.nom, prenom: h.prenom, fonction: h.fonction, le: le, sig: B64(sig) };
    });
}
// ---- Données intégrées au PDF, pour la page « Vérifier une mise en route » ----
function PDF_DONNEES(demandes) { return 'TRIGONE-MER:' + B64_TEXTE(JSON.stringify(demandes)) + ':FIN'; }
function LIRE_DONNEES_PDF(texte) {
    var m = /TRIGONE-MER:([A-Za-z0-9+\/=]+):FIN/.exec(texte);
    return m ? JSON.parse(TEXTE_B64(m[1])) : null;
}

// ===================== VALIDATION (1er et 2e valideur) =====================
// Le valideur se connecte avec son identité et le code d'accès de son rôle (1er ou 2e valideur), remis par
// l'administrateur ; le code déverrouille la clé de signature de ce rôle, publiée chiffrée dans valideurs.json.
var STORAGE_VALIDEUR = 'mer_valideur';
var STORAGE_A_VALIDER = 'mer_a_valider';
var MER_VERIF = {};   // résultat de vérification des validations précédentes, par entrée

function GET_VALIDEUR() {
    try { return JSON.parse(localStorage.getItem(STORAGE_VALIDEUR) || '{}'); } catch (e) { return {}; }
}
function SAVE_VALIDEUR(v) { try { localStorage.setItem(STORAGE_VALIDEUR, JSON.stringify(v)); } catch (e) {} }
function GET_A_VALIDER() {
    try { return JSON.parse(localStorage.getItem(STORAGE_A_VALIDER) || '[]'); } catch (e) { return []; }
}
function SAVE_A_VALIDER(liste) { try { localStorage.setItem(STORAGE_A_VALIDER, JSON.stringify(liste)); } catch (e) {} }
function NIVEAU_VALIDATION(d) { return (d.validations || []).length + 1; }
// Valideur connecté : rôle et clé de l'accès déverrouillé, identité saisie à la connexion.
function HABILITATION_COURANTE() {
    if (!MER_CLE_SESSION || !MER_ACCES_SESSION) return null;
    var v = GET_VALIDEUR();
    return { role: MER_ACCES_SESSION.role, cle: MER_ACCES_SESSION.cle, retire: MER_ACCES_SESSION.retire,
        grade: v.grade, nom: v.nom, prenom: v.prenom, fonction: v['fonction' + MER_ACCES_SESSION.role] || v.fonction };
}

// Recharge la liste des habilités et revérifie les validations reçues avant d'afficher la page.
function OUVRIR_VALIDATION() {
    PAGE_ACTUELLE = 'VALIDATION';
    RENDRE_MENU_PC();
    var zone = document.getElementById('PAGE-STAGE');
    zone.classList.add('avec-marge');
    zone.innerHTML = '<div class="CARD"><div class="MER-EMPTY">Chargement…</div></div>';
    CHARGER_LISTE_VALIDEURS().then(RESTAURER_ACCES).then(function() { MER_DECLARER_ROLE_VALIDEUR(); RENDER_VALIDATION_INPLACE(); });
}
function RENDER_VALIDATION_INPLACE() {
    var liste = GET_A_VALIDER();
    Promise.all(liste.map(function(e) {
        return VERIFIER_VALIDATIONS(e.d).then(function(r) { MER_VERIF[e.id] = r; });
    })).then(function() {
        if (PAGE_ACTUELLE !== 'VALIDATION') return;
        var scroll = window.scrollY;
        document.getElementById('PAGE-STAGE').innerHTML = TPL_VALIDATION();
        window.scrollTo(0, scroll);
    });
}

// Œil du champ code : affiche ou masque ce qui est tapé.
// Rôles valideur cochés sur l'appareil (Paramètres › Mes rôles) : { valideur1: true, valideur2: true }.
function MER_ROLES_LOCAUX() { try { return JSON.parse(localStorage.getItem('trigone_roles_locaux') || '{}') || {}; } catch (e) { return {}; } }
// L'Espace valideur n'existe que pour les valideurs (rôle coché, clé mémorisée, ou demandes déjà reçues).
function MER_EST_VALIDEUR() { var r = MER_ROLES_LOCAUX(); return !!(r.valideur1 || r.valideur2 || MER_CLE_SESSION || GET_A_VALIDER().length); }
// Rôle valideur sans sa clé de signature sur cet appareil (déconnexion, appareil restauré) : le rôle est retiré puis
// « Mes rôles » s'ouvre pour le recocher avec son code, qui redonne la clé.
function MER_ACTIVER_ROLE_VALIDEUR() {
    var r = MER_ROLES_LOCAUX();
    [1, 2].forEach(function(n) { if (r['valideur' + n] && !MER_ROLES_MEMO[n] && window.JUMELAGE_DECLARER_ROLE) JUMELAGE_DECLARER_ROLE('valideur' + n, false); });
    if (window.JUMELAGE_REGLAGES) JUMELAGE_REGLAGES({ vue: 'roles' });
}
function SE_DECONNECTER() {
    MSG_CONFIRM('Retirer l\'accès valideur ?', 'Vos rôles de valideur sont retirés de cet appareil. Pour les retrouver : Paramètres › Mes rôles, avec le code de chaque rôle.', 'Retirer', function() {
        MER_CLE_SESSION = null; MER_ACCES_SESSION = null; MER_ROLES_MEMO = {};
        if (window.JUMELAGE_DECLARER_ROLE) { JUMELAGE_DECLARER_ROLE('valideur1', false); JUMELAGE_DECLARER_ROLE('valideur2', false); }
        Promise.all(['valideur', 'valideur1', 'valideur2'].map(function(k) { return ACCES_MEMO('effacer', null, k); })).catch(function() {}).then(RENDER_VALIDATION_INPLACE);
    });
}
function COPIER_TEXTE(t, btn) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function() {
        if (btn) { btn.textContent = '✔ Copié'; }
    }).catch(function() { MSG_INFO('Copiez ce texte', t, '📋', false); });
}

// ---- 4. Espace de validation ----
function TPL_ENTREE_VALIDATION(e, h, sansCoche) {
    var d = e.d, r = RESUME_DEMANDE(d), niveau = NIVEAU_VALIDATION(d);
    var verif = MER_VERIF[e.id] || [];
    var precedenteKo = verif.filter(function(x) { return !x.ok; })[0] || ((e.pjAlterees || []).length ? { message: 'pièce jointe modifiée' } : null);
    var pourMoi = niveau === h.role && !precedenteKo;
    var badge = niveau > 2 ? 'Déjà validée' : (niveau === 1 ? 'À valider — 1er niveau' : 'À valider — 2e niveau');
    var controle = verif.map(function(x) {
        return '<div class="MER-HINT" style="font-weight:700; color:' + (x.ok ? '#15803d' : '#b91c1c') + ';">' + (x.ok ? '✔ ' : '✖ ') +
            LIBELLE_ROLE(x.niveau) + ' : ' + ESC((x.validation.grade || '') + ' ' + (x.validation.nom || '')) + ' — ' + ESC(x.message) + '</div>';
    }).join('');
    var etat = '', actions = '';
    if (e.decision === 'VALIDEE') {
        etat = '<div class="MER-HINT" style="color:#15803d; font-weight:800;">✔ Validée et signée le ' + ESC(new Date(e.signature.le).toLocaleString('fr-FR')) + '</div>';
        actions = '<button type="button" class="BTN-DANGER-TEXT" onclick="ANNULER_DECISION(\'' + e.id + '\')">Annuler</button>';
    } else if (e.decision === 'REFUSEE') {
        etat = '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">✖ Refusée (au demandeur) : ' + ESC(e.signature.motif) + '</div>';
        actions = '<button type="button" class="BTN-DANGER-TEXT" onclick="ANNULER_DECISION(\'' + e.id + '\')">Annuler</button>';
    } else if (e.decision === 'RENVOYEE') {
        etat = '<div class="MER-HINT" style="color:#b45309; font-weight:800;">↩ Renvoyée au VALIDEUR 1 : ' + ESC(e.signature.motif) + '</div>';
        actions = '<button type="button" class="BTN-DANGER-TEXT" onclick="ANNULER_DECISION(\'' + e.id + '\')">Annuler</button>';
    } else if (niveau <= 2) {
        // Demande renvoyée par le VALIDEUR 2 : le VALIDEUR 1 la corrige, la revalide telle quelle, ou la refuse au demandeur.
        if (d.renvoi && niveau === 1) etat = '<div class="MER-HINT" style="color:#b45309; font-weight:800;">↩ Renvoyée par le VALIDEUR 2 (' + ESC((d.renvoi.grade || '') + ' ' + (d.renvoi.nom || '')) + ') : ' +
            ESC(d.renvoi.motif) + (e.corrigee ? '<br><span style="color:#15803d;">✔ Corrigée par vous : à revalider</span>' : '') + '</div>';
        if (pourMoi) actions += '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="VALIDER_DEMANDES([\'' + e.id + '\'])">Valider</button>';
        if (pourMoi && d.renvoi && niveau === 1) actions += '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="CORRIGER_PAR_VALIDEUR(\'' + e.id + '\')">✎ Corriger</button>';
        // Pas pour moi : autre niveau de validation, ou validation précédente / pièce jointe non conforme.
        if (pourMoi) {}
        else if (!precedenteKo) etat += '<div class="MER-HINT">Réservée au ' + LIBELLE_ROLE(niveau) + ' : vous ne pouvez pas la valider.</div>';
        else etat += '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">' + ((e.pjAlterees || []).length ? 'Demande non conforme' : 'Validation précédente non conforme') + ' : refusez cette demande.</div>';
        if (d.mailDemandeur) actions += '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="POSER_QUESTION(\'mer\', \'' + e.id + '\')">❓ Question</button>';
        actions += '<button type="button" class="BTN-DANGER-TEXT" onclick="DEMANDER_REFUS(\'' + e.id + '\')">' + (h.role === 2 ? 'Refuser / renvoyer' : d.renvoi ? 'Refuser au demandeur' : 'Refuser') + '</button>';
        etat += TPL_ETAT_QUESTION(d.id);
    }
    // Mauvaise manipulation (mauvais fichier, doublon) : la demande reçue s'efface sans être validée ni refusée.
    if (!e.decision) actions += '<button type="button" class="BTN-DANGER-TEXT" onclick="EFFACER_RECUE(\'' + e.id + '\')">Effacer</button>';
    var coche = !sansCoche && !e.decision && pourMoi ? '<input type="checkbox" class="MER-VAL-SEL" value="' + e.id + '" style="width:18px; height:18px; flex-shrink:0;">' : '';
    return '<div class="MER-PANIER-ITEM" style="align-items:flex-start;">' + coche +
        '<div class="MER-PANIER-ITEM-TXT">' +
            '<span class="MER-BADGE">' + badge + '</span>' +
            '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(r.noms) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(r.sous) + '</div>' +
            ((d.pieces || []).length ? '<div class="MER-PJ-LISTE">' + TPL_PJ_PUCES(d.pieces, e.pjAlterees) + '</div>' : '<div class="MER-HINT">Aucune NDS ni DAF jointe.</div>') +
            ((e.pjAlterees || []).length ? '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">✖ Pièce jointe modifiée après l\'envoi : elle ne correspond plus à celle de la demande.</div>' : '') +
            controle + etat +
            '<div class="MER-VAL-ACTIONS">' +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="VOIR_PDF_VALIDATION(\'' + e.id + '\')">Aperçu</button>' +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MER_PARTICIPANTS_VAL(\'' + e.id + '\')">👥 Participants' + ((d.personnes || []).length > 1 ? ' (' + d.personnes.length + ')' : '') + '</button>' + actions +
            '</div>' +
        '</div></div>';
}

function TPL_ESPACE_VALIDATION(v, h) {
    if (EST_PC()) return TPL_ESPACE_VALIDATION_PC(v, h);
    var liste = GET_A_VALIDER();
    var html = '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<span class="MER-BADGE">🔒 Connecté — VALIDEUR ' + h.role + '</span>' + TPL_BASCULE_ROLE(h) +
            '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(h.grade + ' ' + h.nom + ' ' + h.prenom) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(h.fonction) + '</div></div>' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto;" onclick="SE_DECONNECTER()">Déconnexion</button></div>' +
        '<div class="MER-SECTION-TITLE">Demandes reçues</div>';
    if (!liste.length) return html + TPL_AIDE_RECEPTION();

    var decidees = liste.filter(function(e) { return e.decision; }).length;
    var cochables = liste.filter(function(e) {
        return !e.decision && NIVEAU_VALIDATION(e.d) === h.role && !(MER_VERIF[e.id] || []).some(function(x) { return !x.ok; }) && !(e.pjAlterees || []).length;
    }).length;
    html += liste.map(function(e) { return TPL_ENTREE_VALIDATION(e, h); }).join('');
    if (cochables > 1) {
        html += '<div class="MER-ACTIONS" style="margin:4px 0 8px;">' +
            '<button type="button" class="BTN BTN-SECONDARY BTN-SMALL" onclick="COCHER_TOUT_VALIDATION()">Tout cocher</button>' +
            '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="VALIDER_SELECTION()">✔ Valider la sélection</button></div>';
    }
    html += TPL_TRANSMISSION_VALIDATION(v, h, liste);
    return html;
}

function TPL_TRANSMISSION_VALIDATION(v, h, liste) {
    // Champs de mail : celui du rôle connecté, plus celui qu'exigent les décisions déjà présentes dans la liste
    // (ex. : un même appareil utilisé en 1er puis en 2e valideur). Sans cela, « Transmettre » restait bloqué
    // sur un mail impossible à saisir.
    var dest = DESTINATIONS_DECISIONS(liste);
    var champ2 = h.role === 1 || dest.vers2, champChorus = h.role !== 1 || dest.versChorus;
    var decidees = liste.filter(function(e) { return e.decision; }).length;
    return '<div class="MER-SECTION-TITLE">Transmission</div>' +
        (dest.vers1 ? '<div class="MER-FIELD"><label>Mail du VALIDEUR 1 (renvoi)</label><input type="email" data-scan-carte value="' + ESC(v.mailValideur1 || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" oninput="SET_MAIL_VALIDEUR(\'mailValideur1\', this.value)"></div>' : '') +
        (champ2 ? '<div class="MER-FIELD"><label>Mail du 2e valideur</label><input type="email" data-scan-carte value="' + ESC(v.mailValideur2 || MER_GROUPE('valideur2')) + '" placeholder="EX : prenom.nom@interieur.gouv.fr" oninput="SET_MAIL_VALIDEUR(\'mailValideur2\', this.value)"></div>' : '') +
        (champChorus ? '<div class="MER-FIELD"><label>Mail de l\'assistant Chorus DT</label><input type="email" data-scan-carte value="' + ESC(v.mailChorus || MER_GROUPE('chorus')) + '" placeholder="EX : prenom.nom@interieur.gouv.fr" oninput="SET_MAIL_VALIDEUR(\'mailChorus\', this.value)">' +
              '<p class="MER-HINT">Il reçoit les demandes validées dans son espace Assistant Chorus DT, qui contrôle les signatures et produit le PDF.</p></div>' : '') +
        '<button type="button" class="BTN BTN-PRIMARY"' + (decidees ? '' : ' disabled') + ' onclick="PREPARER_TRANSMISSION()">📨 Transmettre les décisions (' + decidees + ')</button>';
}

function TPL_VALIDATION() {
    var v = GET_VALIDEUR();
    var h = HABILITATION_COURANTE();
    var corps, sous;
    // L'espace Assistant Chorus DT ne s'ouvre que par son logo, au centre de l'écran de choix.
    var connecte = h && !h.retire;
    if (!connecte) {
        var aRole = MER_ROLES_LOCAUX().valideur1 || MER_ROLES_LOCAUX().valideur2;
        sous = 'VALIDEUR 1 et VALIDEUR 2';
        corps = '<div class="MER-EMPTY" style="padding:18px 10px;">' + (aRole ? 'Votre rôle de valideur doit être réactivé sur cet appareil, avec son code.' : 'Vous n\'avez pas de rôle de valideur sur cet appareil.') +
            '<br>Les rôles se règlent dans <b>Paramètres › Mes rôles</b>, avec le code remis par l\'administrateur de TRIGONE.</div>' +
            '<button type="button" class="BTN BTN-PRIMARY" onclick="MER_ACTIVER_ROLE_VALIDEUR()">' + (aRole ? 'Réactiver mon rôle de valideur' : 'Ajouter mon rôle de valideur') + '</button>';
    }
    else { sous = 'Validation des demandes reçues'; corps = TPL_ESPACE_VALIDATION(v, h); }
    return '<div class="CARD' + (connecte && EST_PC() ? ' PC-LARGE' : '') + '">' +
        '<h2>Espace valideur</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">' + sous + '</p>' + corps +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}
// Où partent les décisions prises : au 2e valideur (1re validation) ou à l'assistant Chorus DT (2e validation).
function DESTINATIONS_DECISIONS(liste) {
    var r = { vers2: false, versChorus: false, vers1: false };
    liste.forEach(function(e) {
        if (e.decision === 'RENVOYEE' && !e.d.mailValideur1) r.vers1 = true;
        if (e.decision !== 'VALIDEE') return;
        if ((e.d.validations || []).length + 1 === 1) r.vers2 = true; else r.versChorus = true;
    });
    return r;
}
function MER_GROUPE(role) { return window.JUMELAGE_ADRESSE_GROUPE ? JUMELAGE_ADRESSE_GROUPE(role) : ''; }
function SET_MAIL_VALIDEUR(cle, valeur) { var v = GET_VALIDEUR(); v[cle] = valeur.trim(); SAVE_VALIDEUR(v); }

function LIRE_FICHIERS(input, lire, traiter) {
    var fichiers = Array.prototype.slice.call(input.files || []);
    input.value = '';
    var restants = fichiers.length, contenus = [];
    fichiers.forEach(function(f) {
        var lecteur = new FileReader();
        lecteur.onload = function() {
            try { contenus.push(lire(lecteur.result, f)); }
            catch (e) { MSG_ERREUR('Fichier non reconnu', 'Le fichier « ' + f.name + ' » n\'est pas un fichier TRIGONE Mise en route valide.'); }
            if (--restants === 0) traiter(contenus);
        };
        if (/\.pdf$/i.test(f.name)) lecteur.readAsBinaryString(f); else lecteur.readAsText(f);
    });
}
function LIRE_JSON_MER(texte) {
    var data = JSON.parse(texte);
    if (data.app !== 'TRIGONE-MISE-EN-ROUTE' || !Array.isArray(data.demandes)) throw new Error('format');
    return data;
}
function LIRE_FICHIERS_JSON(input, traiter) { LIRE_FICHIERS(input, LIRE_JSON_MER, traiter); }

function IMPORTER_A_VALIDER(input) {
    LIRE_FICHIERS_JSON(input, function(contenus) { STOCKER_PJ_IMPORTEES(contenus).then(function(alterees) {
        var liste = GET_A_VALIDER(), ajoutees = 0, refus = 0;
        contenus.forEach(function(data) {
            data.demandes.forEach(function(d) {
                if (d.refus) { refus++; return; }
                d.validations = d.validations || [];
                var cle = d.id + '#' + d.validations.length;
                if (liste.some(function(e) { return e.id === cle; })) return;
                liste.push({ id: cle, d: d, decision: null, signature: null, pjAlterees: alterees[d.id] || [] });
                ajoutees++;
            });
        });
        SAVE_A_VALIDER(liste);
        RENDER_VALIDATION_INPLACE();
        if (refus) MSG_INFO('Demandes refusées ignorées', refus + ' demande(s) refusée(s) ignorée(s) : un refus s\'importe côté demandeur.');
        else if (!ajoutees && contenus.length) MSG_INFO('Déjà importées', 'Ces demandes sont déjà dans votre liste.');
    }); });
}

function VALIDER_DEMANDES(ids) {
    var h = HABILITATION_COURANTE();
    if (!MER_CLE_SESSION || !h || h.retire) { RENDER_VALIDATION_INPLACE(); return; }
    // Une même personne peut être VALIDEUR 1 et VALIDEUR 2, et valider les deux niveaux d'une même demande.
    var liste = GET_A_VALIDER();
    Promise.all(liste.map(function(e) {
        var ko = (MER_VERIF[e.id] || []).some(function(x) { return !x.ok; }) || (e.pjAlterees || []).length;
        if (ids.indexOf(e.id) === -1 || e.decision || NIVEAU_VALIDATION(e.d) !== h.role || ko) return null;
        return SIGNER_VALIDATION(e.d, h).then(function(s) { e.decision = 'VALIDEE'; e.signature = s; });
    })).then(function() {
        SAVE_A_VALIDER(liste);
        RENDER_VALIDATION_INPLACE();
    }).catch(function(err) { MSG_ERREUR('Signature impossible', err.message); });
}
function COCHER_TOUT_VALIDATION() {
    var cases = document.querySelectorAll('.MER-VAL-SEL');
    var toutes = Array.prototype.every.call(cases, function(c) { return c.checked; });
    Array.prototype.forEach.call(cases, function(c) { c.checked = !toutes; });
}
function VALIDER_SELECTION() {
    var ids = Array.prototype.filter.call(document.querySelectorAll('.MER-VAL-SEL'), function(c) { return c.checked; })
        .map(function(c) { return c.value; });
    if (!ids.length) { MSG_ERREUR('Aucune demande cochée', 'Cochez au moins une demande à valider.'); return; }
    VALIDER_DEMANDES(ids);
}
function MAJ_ENTREES(ids, maj) {
    var liste = GET_A_VALIDER();
    liste.forEach(function(e) { if (ids.indexOf(e.id) !== -1) maj(e); });
    SAVE_A_VALIDER(liste);
    RENDER_VALIDATION_INPLACE();
}
// Efface une demande reçue sans décision : rien n'est signé ni envoyé, le demandeur n'est pas prévenu.
function EFFACER_RECUE(id) {
    var e = GET_A_VALIDER().filter(function(x) { return x.id === id; })[0];
    if (!e) return;
    MSG_CONFIRM('Effacer cette demande ?', 'La demande de ' + RESUME_DEMANDE(e.d).noms + ' sera retirée de votre Espace valideur, sans être validée ni refusée : rien n\'est signé, rien n\'est envoyé et le demandeur n\'est pas prévenu.\n\nPour la traiter plus tard, rouvrez-la depuis votre Boîte de réception.',
        'Effacer', function() {
            SAVE_A_VALIDER(GET_A_VALIDER().filter(function(x) { return x.id !== id; }));
            delete MER_VERIF[id];
            if (MER_VAL_SEL === id) MER_VAL_SEL = null;
            RENDER_VALIDATION_INPLACE();
            setTimeout(function() { MSG_INFO('Demande effacée', 'La demande de ' + RESUME_DEMANDE(e.d).noms + ' a été retirée de votre Espace valideur. Elle reste dans votre Boîte de réception : rouvrez-la pour la retrouver.', '🗑', 'mascotte-poubelle.webp'); }, 350);
        }, '⚠️', 'mascotte-poubelle.webp', true);
}
function ANNULER_DECISION(id) { MAJ_ENTREES([id], function(e) { e.decision = null; e.signature = null; }); }

function DEMANDER_REFUS(id) {
    var h = HABILITATION_COURANTE(), e = GET_A_VALIDER().filter(function(x) { return x.id === id; })[0];
    var v2 = h && h.role === 2, motifRenvoi = e && e.d.renvoi && h && h.role === 1 ? e.d.renvoi.motif : '';
    AFFICHER_MODALE(v2 ? 'Refuser / renvoyer' : 'Refuser la demande',
        (v2 ? '<div class="MER-FIELD"><label>Renvoyer à</label>' +
            '<label class="MER-CHOIX-RENVOI"><input type="radio" name="MER-RENVOI" value="V1" checked> <span><b>VALIDEUR 1</b> — il corrige à son niveau, ou renvoie au demandeur</span></label>' +
            '<label class="MER-CHOIX-RENVOI"><input type="radio" name="MER-RENVOI" value="DEMANDEUR"> <span><b>Demandeur</b> — directement, pour qu\'il corrige et renvoie</span></label></div>' : '') +
        '<div class="MER-FIELD"><label>Motif</label><textarea id="MER-MOTIF-REFUS" rows="4" placeholder="EX : merci de joindre la DAF">' + ESC(motifRenvoi) + '</textarea>' +
        '<p class="MER-HINT">' + (v2 ? 'Le destinataire reçoit ce motif dans sa boîte TRIGONE (avec une notification).' : 'Le demandeur reçoit ce motif dans sa boîte TRIGONE (avec une notification) : il corrige puis renvoie sa demande.') + '</p></div>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="CONFIRMER_REFUS(\'' + id + '\')">' + (v2 ? 'Renvoyer' : 'Refuser') + '</button>'
    );
    setTimeout(function() { var t = document.getElementById('MER-MOTIF-REFUS'); if (t) t.focus(); }, 50);
}
function CONFIRMER_REFUS(id) {
    var motif = (document.getElementById('MER-MOTIF-REFUS').value || '').trim();
    if (!motif) { MSG_ERREUR('Motif manquant', 'Merci d\'indiquer le motif.'); return; }
    var choix = document.querySelector('input[name="MER-RENVOI"]:checked');
    var h = HABILITATION_COURANTE();
    if (!MER_CLE_SESSION || !h) { FERMER_MODALE(); RENDER_VALIDATION_INPLACE(); return; }
    FERMER_MODALE();
    MAJ_ENTREES([id], function(e) {
        e.decision = choix && choix.value === 'V1' ? 'RENVOYEE' : 'REFUSEE';
        e.signature = { grade: h.grade, nom: h.nom, prenom: h.prenom, fonction: h.fonction, le: new Date().toISOString(), motif: motif };
    });
}

// Demande telle qu'elle sera transmise : la validation signée est ajoutée aux précédentes.
function DEMANDE_AVEC_DECISION(e) {
    var d = JSON.parse(JSON.stringify(e.d));
    d.validations = d.validations || [];
    if (e.decision === 'VALIDEE') {
        d.validations.push(e.signature);
        // Le VALIDEUR 2 saura à qui renvoyer la demande si besoin.
        if (d.validations.length === 1 && window.JUMELAGE_COMPTE_MAIL && JUMELAGE_COMPTE_MAIL()) d.mailValideur1 = JUMELAGE_COMPTE_MAIL();
    }
    if (e.decision === 'REFUSEE') { d.refus = e.signature; d.refus.niveau = NIVEAU_VALIDATION(e.d); delete d.renvoi; }
    // Renvoi du VALIDEUR 2 au VALIDEUR 1 : la validation du 1er niveau tombe, la demande repart au 1er niveau.
    if (e.decision === 'RENVOYEE') { d.renvoi = e.signature; d.renvoi.niveau = 2; d.validations = []; }
    return d;
}
function VOIR_PDF_VALIDATION(id) {
    var e = GET_A_VALIDER().filter(function(x) { return x.id === id; })[0];
    if (!e) return;
    try { window.open(GENERER_PDF([DEMANDE_AVEC_DECISION(e)]).output('bloburl'), '_blank'); }
    catch (err) { MSG_ERREUR('PDF impossible', 'Erreur lors de la génération du PDF : ' + err.message); }
}

var MER_ENVOIS = [];
function PREPARER_TRANSMISSION() {
    var v = GET_VALIDEUR();
    var decidees = GET_A_VALIDER().filter(function(e) { return e.decision; });
    var vers2 = [], versChorus = [], refusParMail = {}, renvoiParMail = {};
    decidees.forEach(function(e) {
        var d = DEMANDE_AVEC_DECISION(e);
        if (e.decision === 'RENVOYEE') {
            var m1 = d.mailValideur1 || v.mailValideur1 || '';
            (renvoiParMail[m1] = renvoiParMail[m1] || []).push(d);
        } else if (e.decision === 'REFUSEE') {
            var m = d.mailDemandeur || '';
            (refusParMail[m] = refusParMail[m] || []).push(d);
        } else if (d.validations.length === 1) vers2.push(d);
        else versChorus.push(d);
    });
    // Champ jamais rempli : le groupe de l'unité (tous les VALIDEUR 2 / tous les assistants Chorus DT), comme affiché.
    if (!v.mailValideur2) v.mailValideur2 = MER_GROUPE('valideur2');
    if (!v.mailChorus) v.mailChorus = MER_GROUPE('chorus');
    if (vers2.length && !/@/.test(v.mailValideur2 || '')) { MSG_ERREUR('Mail manquant', 'Merci de renseigner le mail du 2e valideur.'); return; }
    if (versChorus.length && !/@/.test(v.mailChorus || '')) { MSG_ERREUR('Mail manquant', 'Merci de renseigner le mail de l\'assistant Chorus DT.'); return; }
    if (renvoiParMail[''] && !/@/.test(v.mailValideur1 || '')) { MSG_ERREUR('Mail manquant', 'Merci de renseigner le mail du VALIDEUR 1 à qui renvoyer la demande.'); return; }

    MER_ENVOIS = [];
    if (vers2.length) MER_ENVOIS.push({ type: 'VALIDATION_1', demandes: vers2, mail: v.mailValideur2,
        titre: 'Au 2e valideur', pj: NOM_FICHIER_BASE(vers2, 'VALIDATION_1') + '.json' });
    if (versChorus.length) MER_ENVOIS.push({ type: 'CHORUS', demandes: versChorus, mail: v.mailChorus,
        titre: 'À l\'assistant Chorus DT', pj: NOM_FICHIER_BASE(versChorus, 'VALIDATION_2') + '.json' });
    Object.keys(renvoiParMail).forEach(function(m) {
        var ds = renvoiParMail[m];
        MER_ENVOIS.push({ type: 'RENVOI', demandes: ds, mail: m, titre: 'Renvoi au VALIDEUR 1', pj: NOM_FICHIER_BASE(ds, 'RENVOI') + '.json' });
    });
    Object.keys(refusParMail).forEach(function(m) {
        var ds = refusParMail[m];
        MER_ENVOIS.push({ type: 'REFUS', demandes: ds, mail: m,
            titre: 'Refus au demandeur' + (m ? '' : ' (adresse inconnue)'), pj: NOM_FICHIER_BASE(ds, 'REFUS') + '.json' });
    });
    AFFICHER_TRANSMISSION();
}
function AFFICHER_TRANSMISSION() {
    FERMER_MODALE();
    // Envoi uniquement par la boîte TRIGONE : sans compte actif, les décisions attendent (rien n'est perdu).
    if (!MER_COMPTE_ACTIF()) {
        AFFICHER_MODALE('Compte TRIGONE à activer',
            '<p style="font-size:0.86em; line-height:1.5;">Les décisions partent directement dans le TRIGONE de leurs destinataires, chiffrées. Activez d\'abord votre <b>compte TRIGONE</b> : une seule fois, sur cet appareil. Vos décisions sont conservées en attendant.</p>',
            '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Plus tard</button>' +
            '<button type="button" class="BTN BTN-PRIMARY" onclick="FERMER_MODALE(); JUMELAGE_COMPTE()">Se connecter</button>');
        return;
    }
    var lignes = MER_ENVOIS.map(function(env, i) {
        return '<div class="MER-PANIER-ITEM" style="flex-wrap:wrap;"><div class="MER-PANIER-ITEM-TXT" style="flex:1 1 100%;">' +
            '<div class="MER-PANIER-ITEM-TITRE">' + ESC(env.titre) + ' — ' + env.demandes.length + ' demande(s)</div>' +
            '<div class="MER-PANIER-ITEM-SUB" style="word-break:break-all;">' + ESC(env.mail || '') + '</div>' +
            (env.mail && env.type !== 'REFUS' && !env.fait ? '<div id="MER-ABS-ENV-' + i + '"></div>' : '') + '</div>' +
            (env.direct ? '<div class="MER-HINT" style="width:100%; margin-top:8px; color:#15803d; font-weight:800;">✔ Arrivé dans le TRIGONE du destinataire (chiffré)</div>'
            : env.fait ? '<div class="MER-HINT" style="width:100%; margin-top:8px; font-weight:800;">✔ Marqué comme fait</div>'
            : env.mail ? '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" style="width:100%; margin:8px 0 0;" onclick="ENVOYER_ENVOI_DIRECT(' + i + ')">📨 Envoyer</button>'
            : '<div class="MER-HINT" style="width:100%; margin-top:8px;">Adresse du demandeur inconnue : prévenez-le directement du refus et de son motif.</div>' +
              '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:100%; margin:6px 0 0;" onclick="MER_ENVOIS[' + i + '].fait = true; AFFICHER_TRANSMISSION()">C\'est fait</button>') + '</div>';
    }).join('');
    MER_ENVOIS.forEach(function(env, i) { if (env.mail && env.type !== 'REFUS' && !env.fait) setTimeout(function() { MER_AFFICHER_ABSENCE('MER-ABS-ENV-' + i, env.mail); }, 0); });
    var tousFaits = MER_ENVOIS.every(function(env) { return env.fait; });
    AFFICHER_MODALE('Transmettre',
        '<p style="font-size:0.86em; line-height:1.5;">Pour chaque envoi : <b>« Envoyer »</b>. Il arrive, chiffré, directement dans le TRIGONE du destinataire.</p>' + lignes,
        // « Plus tard » ferme sans rien perdre tant qu'un envoi reste à faire ; tout envoyé, seul « Terminé » reste.
        (tousFaits ? '' : '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Plus tard</button>') +
        '<button type="button" class="BTN BTN-PRIMARY"' + (tousFaits ? '' : ' disabled') + ' onclick="TERMINER_TRANSMISSION()">Terminé</button>'
    );
}
// Étape inscrite dans l'envoi (contrôlée à la réception : 1 signature pour le 2e valideur, 2 pour l'assistant Chorus DT).
function ETAPE_ENVOI(env) { return env.type === 'CHORUS' ? 'VALIDATION_2' : env.type; }
function ENVOYER_ENVOI_DIRECT(i) {
    var env = MER_ENVOIS[i];
    AFFICHER_MSG_CENTRE({ titre: 'Envoi en cours…', texte: 'Chiffrement et dépôt dans le TRIGONE du destinataire.', icone: '⏳', mascotte: false, boutons: [] });
    GENERER_JSON_COMPLET(env.demandes, ETAPE_ENVOI(env)).then(function(json) {
        return JUMELAGE_ENVOYER_DIRECT(env.mail, env.type, env.pj, json);
    }).then(function() {
        FERMER_MSG();
        env.fait = env.direct = true;
        setTimeout(AFFICHER_TRANSMISSION, 300);
    }).catch(function(e) {
        FERMER_MSG();
        setTimeout(function() {
            MSG_ERREUR(e.pasDeCompte ? 'Pas encore de compte TRIGONE' : e.statut === 403 ? 'Mauvais destinataire' : 'Envoi impossible', e.pasDeCompte
                ? env.mail + ' n\'a pas encore de compte TRIGONE : demandez-lui de se connecter (bouton « Se connecter » en haut à droite), puis renvoyez. Vos décisions restent en attente, rien n\'est perdu.'
                : (e.message || String(e)));
        }, 350);
    });
}
function TERMINER_TRANSMISSION() {
    FERMER_MODALE();
    // Message de fin : combien de demandes signées (et où elles sont parties), combien renvoyées au demandeur.
    var dec = GET_A_VALIDER().filter(function(e) { return e.decision; }), refus = dec.filter(function(e) { return e.decision === 'REFUSEE'; }).length;
    var n1 = dec.filter(function(e) { return e.decision !== 'REFUSEE' && NIVEAU_VALIDATION(e.d) === 1; }).length, n2 = dec.filter(function(e) { return e.decision !== 'REFUSEE' && NIVEAU_VALIDATION(e.d) === 2; }).length;
    var pl = function(n, m) { return n + ' demande' + (n > 1 ? 's ' + m + 's' : ' ' + m); };
    if (dec.length) MER_TOAST_PERSO = refus && !n1 && !n2 ? [refus > 1 ? refus + ' demandes refusées' : 'Demande refusée', 'Renvoyée' + (refus > 1 ? 's' : '') + ' au demandeur, rangée' + (refus > 1 ? 's' : '') + ' dans « Traités ».', 'Voir', null]
        : [(n1 + n2 + refus > 1 ? pl(n1 + n2, 'signée') : n2 ? 'Demande validée' : 'Demande signée') + (refus ? ' · ' + refus + ' refusée' + (refus > 1 ? 's' : '') : ''),
            'Partie' + (n1 + n2 > 1 ? 's' : '') + ' dans « Traités » — ' + (n1 && n2 ? 'chez le VALIDEUR 2 et l\'assistant Chorus DT.' : n2 ? 'transmise' + (n2 > 1 ? 's' : '') + ' à l\'assistant Chorus DT.' : 'maintenant chez le VALIDEUR 2.'), 'Voir', null];
    if (MER_TOAST_PERSO) { MER_TOAST_PERSO[3] = function() { MER_DOSSIER.RECEPTION = 'traites'; SHOW_PAGE('RECEPTION'); }; setTimeout(function() { if (MER_TOAST_PERSO) { var p = MER_TOAST_PERSO; MER_TOAST_PERSO = null; MER_TOAST.apply(null, p); } }, 600); }
    // Seuls les envois du niveau traité passent en « traité » (la demande peut déjà être revenue au niveau suivant).
    if (window.JUMELAGE_BOITE_TRAITER_DEMANDES) [1, 2].forEach(function(n) {
        var ids = GET_A_VALIDER().filter(function(e) { return e.decision && NIVEAU_VALIDATION(e.d) === n; }).map(function(e) { return e.d.id; });
        JUMELAGE_BOITE_TRAITER_DEMANDES(ids, n === 1 ? ['niveau1', 'renvoi'] : ['niveau2']);
    });
    SAVE_A_VALIDER(GET_A_VALIDER().filter(function(e) { return !e.decision; }));
    MER_ENVOIS = [];
    RENDER_VALIDATION_INPLACE();
}

// ===================== VÉRIFIER UNE MISE EN ROUTE (assistant Chorus DT) =====================
// L'assistant Chorus DT ouvre une demande reçue du 2e valideur (boîte TRIGONE) : TRIGONE contrôle les signatures et les
// pièces jointes, puis génère le PDF (demande signée + pages de la NDS / DAF). Un PDF déjà produit peut aussi être contrôlé.
var MER_RESULTATS_VERIF = null;
function EST_CONFORME(x) {
    return x.verif.length === 2 && x.verif.every(function(v) { return v.ok; }) && !(x.pjAlterees || []).length;
}
function TPL_VERIFIER() {
    var res = MER_RESULTATS_VERIF;
    var html = res && MER_ESPACE_CHORUS ? '<div class="CARD"><h2>Contrôle détaillé</h2><p class="MER-HINT" style="margin:4px 0 16px;">Signatures des deux valideurs et pièces jointes, demande par demande.</p>'
        : '<div class="CARD"><h2>Assistant Chorus DT</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Réservé à l\'assistant Chorus DT. Sur chaque demande reçue ci-dessus : « 👁 Aperçu » ou « 📄 Télécharger le PDF » (demande + NDS / DAF), après contrôle des signatures et des pièces jointes ; « Contrôle détaillé » montre le détail et permet de la renvoyer au demandeur. Un PDF TRIGONE déjà produit peut aussi être contrôlé.</p>' +
        '<label class="BTN BTN-GHOST BTN-SMALL" style="margin-bottom:16px;">📄 Contrôler un PDF TRIGONE' +
        '<input type="file" accept=".pdf,application/pdf" multiple style="display:none;" onchange="VERIFIER_FICHIERS(this)"></label>';
    if (res) {
        var conformes = res.filter(function(x) { return x.source === 'json' && EST_CONFORME(x); });
        html += !res.length ? '<div class="MER-EMPTY">Aucune donnée TRIGONE dans ce fichier.<br>Seuls les fichiers produits par TRIGONE Mise en route peuvent être vérifiés.</div>'
            : res.map(function(x, i) {
                var conforme = EST_CONFORME(x);
                var r = RESUME_DEMANDE(x.d);
                return '<div class="MER-PANIER-ITEM" style="align-items:flex-start; border-color:' + (conforme ? '#86efac' : '#fca5a5') + ';"><div class="MER-PANIER-ITEM-TXT">' +
                    '<div style="font-weight:800; font-size:0.9em; color:' + (conforme ? '#15803d' : '#b91c1c') + ';">' +
                        (conforme ? '✔ Conforme : validée par les deux valideurs habilités' : '✖ Non conforme') + '</div>' +
                    '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(r.noms) + '</div>' +
                    '<div class="MER-PANIER-ITEM-SUB">' + ESC(r.sous) + '</div>' +
                    ((x.d.pieces || []).length ? '<div class="MER-PJ-LISTE">' + TPL_PJ_PUCES(x.d.pieces, x.pjAlterees) + '</div>' : '') +
                    ((x.pjAlterees || []).length ? '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">✖ Pièce jointe modifiée : elle ne correspond plus à celle validée.</div>' : '') +
                    [1, 2].map(function(n) {
                        var v = x.verif[n - 1];
                        if (!v) return '<div class="MER-HINT" style="color:#b91c1c; font-weight:700;">✖ ' + LIBELLE_ROLE(n) + ' : aucune validation</div>';
                        return '<div class="MER-HINT" style="font-weight:700; color:' + (v.ok ? '#15803d' : '#b91c1c') + ';">' + (v.ok ? '✔ ' : '✖ ') +
                            LIBELLE_ROLE(n) + ' : ' + ESC((v.validation.grade || '') + ' ' + (v.validation.nom || '') + ' ' + (v.validation.prenom || '')) +
                            (v.validation.le ? ', le ' + ESC(new Date(v.validation.le).toLocaleString('fr-FR')) : '') + ' — ' + ESC(v.message) + '</div>';
                    }).join('') +
                    (x.renvoyee ? '<div class="MER-HINT" style="color:#b45309; font-weight:800;">↩ Renvoyée au demandeur : ' + ESC(x.renvoyee) + '</div>' : '') +
                    (x.source === 'json' ? '<div class="MER-VAL-ACTIONS">' +
                        '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MER_PARTICIPANTS_VERIF(' + i + ')">👥 Participants' + ((x.d.personnes || []).length > 1 ? ' (' + x.d.personnes.length + ')' : '') + '</button>' +
                        (conforme ? '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="TELECHARGER_PDF_VERIFIE([' + i + '])">📄 PDF avec NDS / DAF</button>' : '') +
                        (x.renvoyee ? '' : '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="CHORUS_RENVOYER(' + i + ')">↩ Renvoyer au demandeur</button>') + '</div>' : '') +
                '</div></div>';
            }).join('');
        if (conformes.length > 1) {
            html += '<button type="button" class="BTN BTN-PRIMARY" onclick="TELECHARGER_PDF_VERIFIE(null)">📄 Un seul PDF pour les ' + conformes.length + ' demandes conformes</button>';
        }
    }
    return html + (MER_ESPACE_CHORUS ? (res ? '<button type="button" class="BTN BTN-SECONDARY" onclick="MER_RESULTATS_VERIF = null; SHOW_PAGE(\'CHORUS\')">✕ Fermer le contrôle</button>' : '') + '</div>' : '<button type="button" class="BTN BTN-SECONDARY" onclick="MER_RESULTATS_VERIF = null; SHOW_PAGE(\'VALIDATION\')">← Retour</button></div>');
}
function VERIFIER_FICHIERS(input) {
    LIRE_FICHIERS(input, function(contenu, f) {
        if (/\.pdf$/i.test(f.name)) return { source: 'pdf', demandes: LIRE_DONNEES_PDF(contenu) || [] };
        var data = LIRE_JSON_MER(contenu);
        return { source: 'json', demandes: data.demandes, data: data };
    }, function(lus) {
        var jsons = lus.filter(function(l) { return l.source === 'json'; }).map(function(l) { return l.data; });
        Promise.all([CHARGER_LISTE_VALIDEURS(), STOCKER_PJ_IMPORTEES(jsons)]).then(function(r) {
            var alterees = r[1];
            var elements = [].concat.apply([], lus.map(function(l) { return l.demandes.map(function(d) { return { d: d, source: l.source }; }); }));
            return Promise.all(elements.map(function(x) {
                return VERIFIER_VALIDATIONS(x.d).then(function(verif) {
                    return { d: x.d, source: x.source, verif: verif, pjAlterees: x.source === 'json' ? (alterees[x.d.id] || []) : [] };
                });
            }));
        }).then(function(res) {
            // Fichier du missionnaire ou du 1er valideur : pas encore les deux signatures, rien à traiter ici.
            if (res.length && res.every(function(x) { return (x.d.validations || []).length < 2; })) {
                MER_RESULTATS_VERIF = null; SHOW_PAGE('VERIFIER');
                var une = res.some(function(x) { return (x.d.validations || []).length === 1; });
                AFFICHER_MSG_CENTRE({ titre: 'Fichier non validé', icone: '⛔', mascotte: 'mascotte-erreur.webp',
                    texte: (une ? 'Ce fichier ne porte que la signature du 1er valideur.' : 'Ce fichier n\'a encore aucune signature de valideur.') +
                        ' Cet espace est réservé à l\'assistant Chorus DT, qui traite les demandes signées par les deux valideurs.',
                    boutons: [{ label: 'J\'ai compris' }] });
                return;
            }
            MER_RESULTATS_VERIF = res;
            SHOW_PAGE('VERIFIER');
            window.scrollTo(0, 0);
        }).catch(function(e) { MSG_ERREUR('Contrôle impossible', e.message || String(e)); });
    });
}
// indices : demandes choisies ; null = toutes les demandes conformes, dans un seul PDF.
function TELECHARGER_PDF_VERIFIE(indices) {
    var res = MER_RESULTATS_VERIF || [];
    var choix = (indices ? indices.map(function(i) { return res[i]; }) : res).filter(function(x) { return x && x.source === 'json' && EST_CONFORME(x); });
    if (!choix.length) return;
    var demandes = choix.map(function(x) { return x.d; });
    AFFICHER_MSG_CENTRE({ titre: 'Génération du PDF…', texte: 'Assemblage de la demande et des pièces jointes.', icone: '⏳', mascotte: false, boutons: [] });
    GENERER_PDF_FINAL(demandes).then(function(octets) {
        FERMER_MSG();
        TELECHARGER_OCTETS(NOM_FICHIER_BASE(demandes, 'PDF_FINAL') + '.pdf', octets, 'application/pdf');
        // Les envois de ces demandes restent « à traiter » : « ✔ Traité » apparaît sur leur ligne de l'espace Chorus DT.
        CHORUS_PDF_FAIT_DEMANDES(demandes.map(function(d) { return d.id; }));
    }).catch(function(e) { FERMER_MSG(); setTimeout(function() { MSG_ERREUR('PDF impossible', e.message || String(e)); }, 350); });
}

// L'assistant Chorus DT renvoie la demande directement au demandeur, avec un commentaire (sans repasser par les valideurs).
function CHORUS_RENVOYER(i) {
    var x = (MER_RESULTATS_VERIF || [])[i]; if (!x) return;
    AFFICHER_MODALE('Renvoyer au demandeur',
        '<p style="font-size:0.86em; line-height:1.5;">La demande de <b>' + ESC(RESUME_DEMANDE(x.d).noms) + '</b> repart directement au demandeur' + (x.d.mailDemandeur ? ' (' + ESC(x.d.mailDemandeur) + ')' : '') +
            ', dans sa boîte TRIGONE, avec votre commentaire. Il la corrige puis la renvoie : elle refait tout le circuit de validation.</p>' +
        '<div class="MER-FIELD"><label>Commentaire</label><textarea id="MER-MOTIF-CHORUS" rows="4" placeholder="EX : le code FD ne correspond pas à la mission"></textarea></div>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="CHORUS_RENVOYER_OK(' + i + ')">↩ Renvoyer</button>');
    setTimeout(function() { var t = document.getElementById('MER-MOTIF-CHORUS'); if (t) t.focus(); }, 50);
}
function CHORUS_RENVOYER_OK(i) {
    var x = (MER_RESULTATS_VERIF || [])[i], motif = (document.getElementById('MER-MOTIF-CHORUS').value || '').trim();
    if (!x) return;
    if (!motif) { MSG_ERREUR('Commentaire manquant', 'Merci d\'indiquer pourquoi la demande est renvoyée.'); return; }
    if (!x.d.mailDemandeur) { MSG_ERREUR('Demandeur inconnu', 'Cette demande ne porte pas l\'adresse de son demandeur : prévenez-le directement.'); return; }
    if (!MER_COMPTE_ACTIF()) { FERMER_MODALE(); JUMELAGE_COMPTE(); return; }
    var id = (GET_REGLAGES().identite || {}), d = JSON.parse(JSON.stringify(x.d));
    d.refus = { niveau: 3, grade: id.grade || '', nom: id.nom || '', prenom: id.prenom || '', fonction: 'ASSIST CHORUS DT', le: new Date().toISOString(), motif: motif };
    d.validations = []; delete d.renvoi;
    FERMER_MODALE();
    AFFICHER_MSG_CENTRE({ titre: 'Envoi en cours…', texte: 'Chiffrement et dépôt dans le TRIGONE du demandeur.', icone: '⏳', mascotte: false, boutons: [] });
    GENERER_JSON_COMPLET([d], 'REFUS').then(function(json) {
        return JUMELAGE_ENVOYER_DIRECT(d.mailDemandeur, 'REFUS', NOM_FICHIER_BASE([d], 'REFUS') + '.json', json);
    }).then(function() {
        FERMER_MSG();
        x.renvoyee = motif;
        if (window.JUMELAGE_BOITE_TRAITER_DEMANDES) JUMELAGE_BOITE_TRAITER_DEMANDES([x.d.id], ['chorus']);
        SHOW_PAGE(PAGE_ACTUELLE);
        setTimeout(function() { MSG_INFO('Demande renvoyée', 'La demande est arrivée dans la boîte TRIGONE du demandeur (' + d.mailDemandeur + '), avec votre commentaire.', '✅', 'mascotte-ok.webp'); }, 300);
    }).catch(function(e) {
        FERMER_MSG();
        setTimeout(function() {
            MSG_ERREUR(e.pasDeCompte ? 'Pas encore de compte TRIGONE' : 'Envoi impossible', e.pasDeCompte ? d.mailDemandeur + ' n\'a pas de compte TRIGONE : prévenez-le directement.' : (e.message || String(e)));
        }, 350);
    });
}

// ===================== RETOUR D'UN REFUS (côté demandeur) =====================
function IMPORTER_REFUS(input) {
    LIRE_FICHIERS_JSON(input, function(contenus) { STOCKER_PJ_IMPORTEES(contenus).then(function() {
        var panier = GET_PANIER(), n = 0;
        contenus.forEach(function(data) {
            data.demandes.forEach(function(d) {
                if (!d.refus) return;
                panier = panier.filter(function(x) { return x.id !== d.id; });
                panier.push(d);
                n++;
            });
        });
        if (!n) { MSG_INFO('Aucun refus', 'Aucune demande refusée dans ce fichier.'); return; }
        SAVE_PANIER(panier);
        MER_DOSSIER.PANIER = 'refus'; SHOW_PAGE('PANIER');
        MSG_INFO(n > 1 ? n + ' demandes refusées rangées dans Documents' : 'Demande refusée rangée dans Documents',
            'Le motif du refus s\'affiche sous ' + (n > 1 ? 'chaque demande' : 'la demande') + '. Touchez « Modifier » pour la corriger : elle ressort des Documents le temps de la correction, puis « Ajouter aux documents » l\'y remet, prête à être renvoyée.', '📥');
    }); });
}
function MODIFIER_DEMANDE(id) { PROTEGER_BROUILLON(function() { MODIFIER_DEMANDE_OK(id); }, 'Modifier'); }
function MODIFIER_DEMANDE_OK(id) {
    var d = GET_PANIER().filter(function(x) { return x.id === id; })[0];
    if (!d) return;
    SAVE_PANIER(GET_PANIER().filter(function(x) { return x.id !== id; }));
    D = d;
    MER_ACTIVE_TAB = 'IDENTITE';
    SAVE_BROUILLON();
    SHOW_PAGE('FORMULAIRE');
    MSG_INFO('Demande sortie des Documents', 'La demande de ' + RESUME_DEMANDE(d).noms + ' est ouverte pour modification : elle quitte Documents le temps de la correction. À la dernière étape, « Ajouter aux documents » l\'y remettra, prête à être envoyée.', '📂');
}

// ===================== DÉMARRAGE =====================
// ===================== MISES À JOUR (comme TRIGONE compte-rendu) =====================
// updates-manifest.json est relu à chaque ouverture, au retour sur l'appli et au retour du réseau.
// appCodeVersion plus récente que ce code : « Mise à jour obligatoire ». Déjà à jour mais version jamais vue :
// « Nouveautés ». appMessageVersion : simple information. Bouton « 🔄 Mise à jour » : vérification manuelle.
var STORAGE_MAJ_VUES = 'mer_maj_vues';
var MAJ_DERNIERE_VERIF = 0, MAJ_DELAI_MIN_MS = 10 * 60 * 1000, MAJ_EN_ATTENTE = false;
function GET_MAJ_VUES() { try { return JSON.parse(localStorage.getItem(STORAGE_MAJ_VUES) || '{}'); } catch (e) { return {}; } }
function SET_MAJ_VUE(cle, v) { var m = GET_MAJ_VUES(); m[cle] = v; try { localStorage.setItem(STORAGE_MAJ_VUES, JSON.stringify(m)); } catch (e) {} }
function ECRAN_LIBRE() {
    if (DEMO_ACTIF || document.getElementById('INTRO-SPLASH')) return false;
    // Écrans communs (code d'accès, présentation, réglages, écran de choix) : on attend qu'ils soient fermés.
    if (document.querySelector('.JUM-PIN, .JUM-PRES, .JUM-REGLAGES, .JUM-CHOIX')) return false;
    return ['MSG-OVERLAY', 'PIN-OVERLAY', 'POURQUOI-OVERLAY', 'CONFIG-INITIALE-OVERLAY'].every(function(id) {
        var el = document.getElementById(id); return !el || el.classList.contains('HIDDEN');
    });
}
function ATTENDRE_ECRAN_LIBRE(fn) {
    var essais = 0;
    (function tenter() { if (ECRAN_LIBRE()) fn(); else if (++essais < 600) setTimeout(tenter, 500); })();
}
function VERIFIER_MISES_A_JOUR(manuel) {
    if (!manuel && (MAJ_EN_ATTENTE || Date.now() - MAJ_DERNIERE_VERIF < MAJ_DELAI_MIN_MS)) return;
    if (!navigator.onLine) {
        if (manuel) MSG_ERREUR('Pas de connexion', 'Aucune connexion internet : impossible de vérifier les mises à jour pour le moment.');
        return;
    }
    fetch('updates-manifest.json?t=' + Date.now(), { cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : null; }).then(function(data) {
        if (!data) throw new Error('manifeste');
        MAJ_DERNIERE_VERIF = Date.now();
        var vues = GET_MAJ_VUES(), premiere = !Object.keys(vues).length;
        var aFaire = [];
        // Code en retard : mise à jour automatique (jumelage.js), la fenêtre « Nouveautés » suivra.
        if (data.appCodeVersion > APP_CODE_VERSION && window.JUMELAGE_MAJ_DISPONIBLE) { window.JUMELAGE_MAJ_DISPONIBLE(); return; }
        if (data.appCodeVersion > APP_CODE_VERSION) aFaire.push({ type: 'code', version: data.appCodeVersion, texte: data.appCodeMessage });
        else if (data.appCodeVersion > 0 && vues.appCode !== data.appCodeVersion) {
            // Les nouveautés sont annoncées une seule fois, sur l'écran de choix (jumelage.js), pas dans chaque appli.
            SET_MAJ_VUE('appCode', data.appCodeVersion);
        }
        if (data.appMessageVersion > 0 && vues.appMessage !== data.appMessageVersion) {
            if (premiere) SET_MAJ_VUE('appMessage', data.appMessageVersion);
            else aFaire.push({ type: 'info', version: data.appMessageVersion, texte: data.appMessage });
        }
        if (!aFaire.length) { if (manuel) AFFICHER_A_JOUR(); return; }
        MAJ_EN_ATTENTE = true;
        ATTENDRE_ECRAN_LIBRE(function() { AFFICHER_MAJ(aFaire); });
    }).catch(function() {
        if (manuel) MSG_ERREUR('Vérification impossible', 'Impossible de vérifier les mises à jour pour le moment. Réessayez plus tard.');
    });
}
function AFFICHER_A_JOUR() {
    MSG_INFO('TRIGONE est à jour', 'Aucune mise à jour disponible pour le moment.', '✅', 'mascotte-ok.webp');
}
function AFFICHER_MAJ(liste) {
    var item = liste.shift();
    if (!item) { MAJ_EN_ATTENTE = false; return; }
    function suite() { AFFICHER_MAJ(liste); }
    if (item.type === 'code') {
        AFFICHER_MSG_CENTRE({ titre: 'Mise à jour obligatoire', icone: '📢', mascotte: 'mascotte-maj.webp',
            texte: (item.texte || 'Une nouvelle version de TRIGONE Mise en route est disponible.') + ' Vos données (demande en cours, documents, bibliothèque) ne sont pas affectées.',
            boutons: [{ label: 'Mettre à jour', action: APPLIQUER_MISE_A_JOUR }] });
        return;
    }
    SET_MAJ_VUE(item.type === 'info' ? 'appMessage' : 'appCode', item.version);
    AFFICHER_MSG_CENTRE({ titre: item.type === 'info' ? 'Information' : 'Nouveautés', icone: item.type === 'info' ? '📢' : '✨', mascotte: 'mascotte-maj.webp',
        texte: item.texte || 'TRIGONE Mise en route vient d\'être mis à jour.', boutons: [{ label: 'J\'ai compris', action: suite }] });
}
// Vide le cache de l'appli et recharge : les données (localStorage) ne sont jamais touchées.
function APPLIQUER_MISE_A_JOUR() {
    MARQUER_RETOUR_CHOIX();
    AFFICHER_MSG_CENTRE({ titre: 'Mise à jour en cours…', texte: 'Merci de patienter quelques instants.', icone: '⏳', mascotte: 'mascotte-maj.webp', boutons: [] });
    var etapes = [];
    if (window.caches) etapes.push(caches.keys().then(function(k) { return Promise.all(k.filter(function(c) { return c.indexOf('trigone-mise-en-route') === 0; }).map(function(c) { return caches.delete(c); })); }));
    if (navigator.serviceWorker) etapes.push(navigator.serviceWorker.getRegistration().then(function(r) { return r && r.update(); }));
    Promise.all(etapes).catch(function() {}).then(function() { setTimeout(function() { location.reload(); }, 400); });
}
// Signaler un problème : mail prérempli (appli, version, écran), commun aux deux applis.
var MER_LIBELLES_ECRANS = { ACCUEIL: 'Accueil', FORMULAIRE: 'Nouvelle demande', PANIER: 'Documents', BIBLIOTHEQUE: 'Bibliothèque', NOTICE: 'Aide rapide',
    ESPACE: 'Mon espace', REFERENCES: 'Références', VALIDATION: 'Espace valideur', VERIFIER: 'Assistant Chorus DT', REPRISE: 'Reprise' };
function MER_SIGNALER() {
    var e = MER_LIBELLES_ECRANS[PAGE_ACTUELLE] || PAGE_ACTUELLE;
    if (PAGE_ACTUELLE === 'FORMULAIRE' && MER_TABS_LABELS[MER_ACTIVE_TAB]) e += ' — ' + MER_TABS_LABELS[MER_ACTIVE_TAB];
    JUMELAGE_SIGNALER(e);
}
function VERIFIER_MISE_A_JOUR_MANUELLE() {
    var btn = document.getElementById('BTN-CHECK-UPDATE');
    if (btn) { btn.textContent = '🔄 Vérification…'; btn.disabled = true; }
    VERIFIER_MISES_A_JOUR(true);
    setTimeout(function() { if (btn) { btn.textContent = '🔄 Mise à jour'; btn.disabled = false; } }, 1200);
}
// À la fermeture (appli mise en arrière-plan ou quittée) : TRIGONE regarde s'il existe une nouvelle version et la
// télécharge ; au retour, l'appli redémarre d'elle-même sur cette version. La demande en cours est conservée et
// l'écran « Demande en cours » propose de la reprendre.
var MER_MAJ_AU_RETOUR = false, MER_CACHE_DEPUIS = 0, MER_DELAI_REPRISE_MS = 45000;
function PREPARER_MAJ_A_LA_FERMETURE() {
    if (!navigator.onLine || MER_MAJ_AU_RETOUR) return;
    fetch('updates-manifest.json?t=' + Date.now(), { cache: 'no-store' }).then(function(r) { return r.ok ? r.json() : null; }).then(function(data) {
        if (!data || !(data.appCodeVersion > APP_CODE_VERSION)) return;
        MER_MAJ_AU_RETOUR = true;
        if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function(r) { if (r) r.update(); }).catch(function() {});
    }).catch(function() {});
}
// Après les réglages communs : la page affichée suit (nom sur l'accueil, Mon espace…).
var MER_INSTALL_APRES_REGLAGES = false;
window.JUMELAGE_APRES_REGLAGES = function() {
    if (['ACCUEIL', 'ESPACE'].indexOf(PAGE_ACTUELLE) >= 0) SHOW_PAGE(PAGE_ACTUELLE);
    if (MER_INSTALL_APRES_REGLAGES) { MER_INSTALL_APRES_REGLAGES = false; setTimeout(PROPOSER_INSTALLATION_PREMIERE_FOIS, 900); }
};
window.JUMELAGE_AVANT_RECHARGE = function() { if (PAGE_ACTUELLE === 'FORMULAIRE') SAVE_BROUILLON(); };
// Mise à jour forcée (jumelage.js) : seulement sur l'accueil, sans fenêtre ouverte.
window.JUMELAGE_PEUT_RECHARGER = function() { return PAGE_ACTUELLE === 'ACCUEIL' && ECRAN_LIBRE() && !document.getElementById('MER-MODALE-FOND'); };
// Après une mise à jour, TRIGONE rouvre sur l'écran de choix des applis.
function MARQUER_RETOUR_CHOIX() { try { sessionStorage.setItem('trigone_apres_maj', '1'); sessionStorage.removeItem('trigone_choix_fait'); } catch (e) {} }
function REDEMARRER_SUR_NOUVELLE_VERSION() {
    SAVE_BROUILLON();
    MARQUER_RETOUR_CHOIX();
    var etapes = [];
    if (window.caches) etapes.push(caches.keys().then(function(k) { return Promise.all(k.filter(function(c) { return c.indexOf('trigone-mise-en-route') === 0; }).map(function(c) { return caches.delete(c); })); }));
    Promise.all(etapes).catch(function() {}).then(function() { location.reload(); });
}
function INIT_VERIF_MAJ_AUTO() {
    VERIFIER_MISES_A_JOUR(false);
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            MER_CACHE_DEPUIS = Date.now();
            if (PAGE_ACTUELLE === 'FORMULAIRE') SAVE_BROUILLON();
            PREPARER_MAJ_A_LA_FERMETURE();
            return;
        }
        if (MER_MAJ_AU_RETOUR) { REDEMARRER_SUR_NOUVELLE_VERSION(); return; }
        var longtemps = MER_CACHE_DEPUIS && Date.now() - MER_CACHE_DEPUIS > MER_DELAI_REPRISE_MS;
        MER_CACHE_DEPUIS = 0;
        if (longtemps && !DEMO_ACTIF && PAGE_ACTUELLE === 'FORMULAIRE' && BROUILLON_EN_COURS() && ECRAN_LIBRE()) SHOW_PAGE('REPRISE');
        VERIFIER_MISES_A_JOUR(false);
    });
    window.addEventListener('pagehide', PREPARER_MAJ_A_LA_FERMETURE);
    window.addEventListener('online', function() { MAJ_DERNIERE_VERIF = 0; VERIFIER_MISES_A_JOUR(false); });
}
function REGISTER_SERVICE_WORKER() {
    if (!('serviceWorker' in navigator)) return;
    // Compte-rendu de mission (dossier cr/) : enregistré dès ici pour être disponible hors ligne.
    window.addEventListener('load', function() { navigator.serviceWorker.register('./cr/sw.js', { scope: './cr/' }).catch(function() {}); });
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
        document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') reg.update().catch(function() {}); });
    }).catch(function(e) { console.warn('Service Worker:', e); });
}

window.addEventListener('DOMContentLoaded', function() {
    APPLIQUER_THEME_INITIAL();
    IDENTITE_DEPUIS_COMPTE_RENDU();
    LOAD_BROUILLON();
    // Espace Assistant Chorus DT demandé depuis l'écran de choix (autre page) : ouverture directe.
    var versChorus = /[?&]espace=chorus/.test(location.search) && window.JUMELAGE_ROLE_CHORUS && JUMELAGE_ROLE_CHORUS();
    // Notification touchée : boîte de réception (demande à signer, renvoi, refus).
    var versBoite = /[?&]espace=boite/.test(location.search) && MER_COMPTE_ACTIF();
    // Notification de suivi (demande validée, prise en charge…) : Bibliothèque.
    var versSuivi = /[?&]espace=suivi/.test(location.search);
    // Rappel « demande refusée à corriger » : Documents.
    var versDocuments = /[?&]espace=documents/.test(location.search);
    // Raccourci de l'icône de l'appli (appui long) : « Nouvelle demande ».
    var versNouvelle = /[?&]espace=nouvelle/.test(location.search);
    if (/[?&]espace=/.test(location.search) && history.replaceState) history.replaceState(null, document.title, location.pathname);
    SHOW_PAGE(versChorus ? 'CHORUS' : versBoite ? 'RECEPTION' : versSuivi ? 'BIBLIOTHEQUE' : versDocuments ? 'PANIER' : versNouvelle ? 'ACCUEIL' : BROUILLON_EN_COURS() ? 'REPRISE' : 'ACCUEIL');
    if (versNouvelle) setTimeout(DEMARRER_NOUVELLE_DEMANDE, 400);
    if (window.JUMELAGE_ANIMER_ARRIVEE) setTimeout(JUMELAGE_ANIMER_ARRIVEE, 30);
    // Première ouverture : présentation, puis « Avant de commencer ». Ensuite : code d'accès s'il est activé.
    var vue = false;
    try { vue = localStorage.getItem(STORAGE_POURQUOI) === '1'; } catch (e) {}
    // Première ouverture : la proposition d'installer l'appli attend la fin des réglages communs.
    var suite = function() { if (!CONFIG_FAITE()) { MER_INSTALL_APRES_REGLAGES = true; AFFICHER_CONFIG_INITIALE(); } else PROPOSER_INSTALLATION_PREMIERE_FOIS(); };
    if (!vue) AFFICHER_POURQUOI(suite);
    // Code d'accès : demandé une seule fois, à l'ouverture de TRIGONE, par l'écran commun (jumelage.js).
    else if (PIN_EST_DEFINI() && !window.JUMELAGE_DEVERROUILLE) OUVRIR_ECRAN_PIN('verif', suite);
    else suite();
    REGISTER_SERVICE_WORKER();
    setTimeout(MER_RAPPEL_SAUVEGARDE, 6000);
    INIT_VERIF_MAJ_AUTO();
});

// Menu du compte (jumelage.js) : ce qui n'est pas du travail quotidien.
window.JUMELAGE_MENU_APPLI = function() {
    var aller = function(page) { return function() { if (PAGE_ACTUELLE === 'FORMULAIRE') SAVE_BROUILLON(); SHOW_PAGE(page); }; };
    return [
        { icone: 'info', titre: 'Aide rapide', sous: 'Faire une demande, valider, notifications', action: aller('NOTICE') },
        { icone: 'document', titre: 'Références', sous: 'Textes et référentiels utilisés', action: aller('REFERENCES') },
        { icone: 'maj', titre: 'Mise à jour', sous: 'Vérifier la version de TRIGONE', action: VERIFIER_MISE_A_JOUR_MANUELLE },
        { icone: 'bouee', titre: 'Signaler un problème', sous: 'Écrire à l\'équipe TRIGONE', action: MER_SIGNALER }
    ];
};
function MER_NB_A_SIGNER() { try { return GET_A_VALIDER().filter(function(e) { return !e.decision; }).length; } catch (e) { return 0; } }
// ===================== BOÎTE DE RÉCEPTION (compte TRIGONE) =====================
// Les envois reçus directement dans TRIGONE (jumelage.js : relève, déchiffrement, rangement sur l'appareil) sont listés
// ici ; « Ouvrir » les mène où il faut : Espace valideur (à signer), assistant Chorus DT (à contrôler), Documents (refus).
var MER_BOITE_A_OUVRIR = null;
var MER_NATURES_BOITE = {
    niveau1: ['À signer — 1er niveau', 'Ouvrir et signer'], niveau2: ['À signer — 2e niveau', 'Ouvrir et signer'],
    chorus: ['Pour l\'assistant Chorus DT', 'Ouvrir et contrôler'], refus: ['Demande refusée — à corriger', 'Corriger dans Documents'],
    cr: ['Compte-rendu de mission', 'Ouvrir'], collective: ['Mission collective — votre compte-rendu', 'Ouvrir mon compte-rendu'],
    question: ['Question sur votre demande', 'Répondre'], reponse: ['Réponse à votre question', 'Vu'], renvoi: ['Renvoyée par le VALIDEUR 2', 'Ouvrir et corriger'], justif: ['Justificatif reçu par mail', 'Voir'], inconnu: ['Fichier reçu', 'Ouvrir']
};
function MER_EST_CHORUS(x) { return x.nature === 'chorus' || x.nature === 'cr'; }
// Rôles changés dans les Réglages : la session valideur est reprise de la clé mémorisée (nouveau rôle, ou aucun).
window.JUMELAGE_ROLES_CHANGES = function() {
    MER_CLE_SESSION = null; MER_ACCES_SESSION = null;
    CHARGER_LISTE_VALIDEURS().then(RESTAURER_ACCES).then(function() {
        MER_DECLARER_ROLE_VALIDEUR();
        if (PAGE_ACTUELLE === 'VALIDATION') RENDER_VALIDATION_INPLACE(); else RENDRE_MENU_PC();
        if (MER_BOITE_A_OUVRIR && HABILITATION_COURANTE()) { var idBoite = MER_BOITE_A_OUVRIR; MER_BOITE_A_OUVRIR = null; setTimeout(function() { OUVRIR_RECU(idBoite); }, 300); }
    });
};
// Valideur connecté : son rôle (1er ou 2e) est déclaré au compte TRIGONE, pour que sa boîte reçoive ce qui lui revient.
function MER_DECLARER_ROLE_VALIDEUR() {
    var h = HABILITATION_COURANTE();
    if (h && !h.retire && window.JUMELAGE_DECLARER_ROLE) JUMELAGE_DECLARER_ROLE('valideur' + h.role, true);
}
function MER_ROLE_CHORUS() { return !!(window.JUMELAGE_ROLE_CHORUS && JUMELAGE_ROLE_CHORUS()); }
// Avec le rôle Assistant Chorus DT, les envois pour Chorus vont dans son espace dédié, pas dans la boîte de Mise en route.
function MER_NB_BOITE() { return window.JUMELAGE_BOITE_NB ? JUMELAGE_BOITE_NB(MER_ROLE_CHORUS() ? 'autres' : '') : 0; }
function MER_NB_CHORUS() { return window.JUMELAGE_BOITE_NB ? JUMELAGE_BOITE_NB('chorus') : 0; }
function MER_COMPTE_ACTIF() { return !!(window.JUMELAGE_COMPTE_ACTIF && JUMELAGE_COMPTE_ACTIF()); }
function MER_LIBELLE_GROUPE(g) { var m = /^([a-z0-9-]+)\.([a-z0-9]+)@/.exec(g || ''); return m ? (m[1] === 'assist-dt' ? 'assistants Chorus DT' : 'VALIDEUR 2') + ' du ' + m[2].toUpperCase() : 'membres du groupe'; }
function TPL_ENVOI_RECU(x) {
    var nat = MER_NATURES_BOITE[x.nature] || MER_NATURES_BOITE.inconnu, traite = x.statut === 'traite';
    var le = x.le ? new Date(x.le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    var cocher = MER_RECU_SELECTION && traite, coche = cocher && MER_RECU_SELECTION[x.id];
    return '<div class="MER-PANIER-ITEM MER-RECU' + (x.statut === 'nouveau' ? ' nouveau' : '') + (coche ? ' MER-BIB-COCHEE' : '') + '" style="align-items:flex-start;">' +
        (cocher ? '<label class="MER-BIB-CASE"><input type="checkbox"' + (coche ? ' checked' : '') + ' onchange="RECU_COCHER(\'' + x.id + '\', this.checked); this.closest(\'.MER-PANIER-ITEM\').classList.toggle(\'MER-BIB-COCHEE\', this.checked)" aria-label="Sélectionner"></label>' : '') +
        '<div class="MER-PANIER-ITEM-TXT">' +
        '<span class="MER-BADGE MER-RECU-' + ESC(x.nature || 'inconnu') + '">' + nat[0] + '</span>' + (x.statut === 'nouveau' ? ' <span class="MER-RECU-NOUVEAU">Nouveau</span>' : '') +
        (x.n > 1 ? ' <span class="MER-RECU-NOUVEAU" style="background:#1a1a1a;">' + x.n + ' demandes</span>' : '') +
        '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(x.noms || x.nom || 'Demande') + '</div>' +
        '<div class="MER-PANIER-ITEM-SUB">' + ESC([x.objet, x.lieu, x.dates].filter(Boolean).join(' · ')) + '</div>' +
        (x.nature === 'question' || x.nature === 'reponse' ? '<div class="MER-QUESTION"><b>' + MER_BX_ICO('q') + '' + ESC(x.question) + '</b>' + (x.nature === 'reponse' ? '<span>' + MER_BX_ICO('rep') + '' + ESC(x.reponse) + '</span>' : '') + '</div>' : '') +
        (x.nature === 'collective' ? '<div class="MER-HINT" style="margin-top:4px;">Mission déjà renseignée par votre chef de mission : complétez votre identité, joignez vos justificatifs, puis envoyez à l\'assistant Chorus DT.</div>' : '') +
        (x.nature === 'justif' ? (x.verifie ? '' : '<div class="MER-HINT" style="margin-top:4px; color:#b45309; font-weight:800;">À vérifier : expéditeur inconnu de TRIGONE. Gardez-le seulement s\'il est bien à vous.</div>') +
            '<div class="MER-JUSTIF-PJ">' + (x.fichiers || []).map(function(f, i) { return '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="VOIR_JUSTIF(\'' + x.id + '\', ' + i + ')">' + (/pdf/.test(f.type) ? '' + MER_BX_ICO('pdf') + '' : '' + MER_BX_ICO('photo') + '') + ESC(f.nom) + '</button>'; }).join('') + '</div>' : '') +
        (x.nature === 'cr' && x.pieces ? '<div class="MER-HINT" style="margin-top:4px;">' + MER_BX_ICO('clip') + '' + x.pieces + ' fichier(s) : compte-rendu PDF' + (x.pieces > 1 ? ' et justificatifs' : '') + '</div>' : '') +
        (x.nature === 'cr' && x.equipe ? '<div class="MER-HINT" style="margin-top:4px;">' + MER_BX_ICO('coll') + 'Mission collective (' + (x.roleEquipe === 'participant' ? 'participant' : 'chef de mission') + ') : suivi de l\'équipe dans le détail</div>' : '') +
        '<div class="MER-HINT" style="margin-top:4px;">Reçue de <b>' + ESC(x.de || '?') + '</b>' + (le ? ', le ' + ESC(le) : '') + (traite ? ' — traitée' + (x.traitePar ? ' par <b>' + ESC(x.traitePar) + '</b>' : '') : '') + '</div>' +
        (x.groupe ? '<div class="MER-HINT MER-RECU-GROUPE">' + MER_BX_ICO('coll') + 'Envoyée à tous les ' + ESC(MER_LIBELLE_GROUPE(x.groupe)) + ' : le premier qui la traite la range chez les autres.</div>' : '') +
        // Demande traitée par ce valideur : la suite de son circuit (VALIDEUR 2, assistant Chorus DT).
        (traite && x.nature !== 'cr' && x.nature !== 'refus' && x.nature !== 'collective' ? (x.ids || []).map(function(id, i) { return TPL_SUIVI_DEMANDE(id, x.ids.length > 1 ? 'Demande ' + (i + 1) : ''); }).join('') : '') +
        (cocher ? '' : '<div class="MER-VAL-ACTIONS">' +
            // Demande validée pour l'ASSIST CHORUS DT : aperçu et PDF directement depuis la ligne (contrôle fait avant).
            (x.nature === 'chorus'
                ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="CHORUS_PDF_RECU(\'' + x.id + '\', true)">' + MER_BX_ICO('oeil') + 'Aperçu</button>' +
                  // PDF téléchargé : « Traité » apparaît, à toucher une fois l'ordre de mission créé dans Chorus DT.
                  (!traite && x.pdfFait
                    ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="CHORUS_PDF_RECU(\'' + x.id + '\', false)">' + MER_BX_ICO('pdf') + 'Retélécharger</button>' +
                      '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL MER-CHORUS-TRAITE" onclick="CHORUS_TRAITER(\'' + x.id + '\')">' + MER_BX_ICO('ok') + 'Traité</button>'
                    : '<button type="button" class="BTN BTN-' + (traite ? 'GHOST' : 'PRIMARY') + ' BTN-SMALL" onclick="CHORUS_PDF_RECU(\'' + x.id + '\', false)">' + MER_BX_ICO('pdf') + 'Télécharger le PDF</button>') +
                  '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="' + (traite ? 'ROUVRIR_RECU' : 'OUVRIR_RECU') + '(\'' + x.id + '\')">Contrôle détaillé</button>' +
                  (traite ? '' : '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="POSER_QUESTION(\'chorus\', \'' + x.id + '\')">' + MER_BX_ICO('q') + 'Question</button>') +
                  ((x.ids || []).map(TPL_ETAT_QUESTION).join(''))
            // Compte-rendu : aperçu du PDF directement depuis la ligne, et détail (justificatifs).
            : x.nature === 'cr'
                ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="APERCU_CR_RECU(\'' + x.id + '\')">' + MER_BX_ICO('oeil') + 'Aperçu</button>' +
                  '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="OUVRIR_CR_RECU(\'' + x.id + '\')">' + MER_BX_ICO('clip') + 'Compte-rendu et justificatifs</button>'
            // Question : réponse en quelques mots ; réponse reçue : « Vu ».
            : x.nature === 'question' && x.rappel && !traite ? '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="JUMELAGE_BOITE_MARQUER(\'' + x.id + '\', \'traite\'); RECU_REAFFICHER();">' + MER_BX_ICO('ok') + 'Vu</button>'
            : x.nature === 'question' && !traite ? '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="REPONDRE_QUESTION(\'' + x.id + '\')">' + MER_BX_ICO('rep') + 'Répondre</button>'
            : x.nature === 'reponse' && !traite ? '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="JUMELAGE_BOITE_MARQUER(\'' + x.id + '\', \'traite\'); RECU_REAFFICHER();">' + MER_BX_ICO('ok') + 'Vu</button>'
            : x.nature === 'question' || x.nature === 'reponse' ? ''
            // Justificatif reçu par mail : à garder (expéditeur inconnu), puis rangé une fois joint au compte-rendu.
            : x.nature === 'justif'
                ? (x.verifie ? '' : '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="JUMELAGE_JUSTIF_VERIFIE(\'' + x.id + '\'); RECU_REAFFICHER();">' + MER_BX_ICO('ok') + 'C\'est bien à moi</button>') +
                  (traite ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="JUMELAGE_BOITE_ROUVRIR(\'' + x.id + '\'); RECU_REAFFICHER();">' + MER_BX_ICO('maj') + 'Remettre à joindre</button>'
                      : '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="JUMELAGE_BOITE_MARQUER(\'' + x.id + '\', \'traite\'); RECU_REAFFICHER();">' + MER_BX_ICO('ok') + 'Rangé</button>')
            // Mission collective : le compte-rendu prérempli par le chef de mission s'ouvre dans Compte-rendu.
            : x.nature === 'collective'
                ? '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="OUVRIR_COLLECTIVE_RECU(\'' + x.id + '\')">' + MER_BX_ICO('cr') + '' + nat[1] + '</button>'
            : traite ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="ROUVRIR_RECU(\'' + x.id + '\')">' + MER_BX_ICO('maj') + 'Rouvrir</button>'
                : '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="OUVRIR_RECU(\'' + x.id + '\')">' + nat[1] + '</button>') +
            '<button type="button" class="BTN-DANGER-TEXT" onclick="SUPPRIMER_RECU(\'' + x.id + '\')">Supprimer</button>' +
        '</div>') + '</div></div>';
}
// Envois traités : « Sélectionner » pour en supprimer plusieurs d'un coup (Boîte de réception, espace Assistant Chorus DT).
// MER_RECU_SELECTION : null = mode normal, sinon { id: true } des cochés ; MER_RECU_LISTES : ids de chaque section.
var MER_RECU_SELECTION = null, MER_RECU_LISTES = {};
function TPL_RECU_TRAITES(cle, titre, traites) {
    if (!traites.length) return '';
    MER_RECU_LISTES[cle] = traites.map(function(x) { return x.id; });
    var sel = MER_RECU_SELECTION, ids = MER_RECU_LISTES[cle];
    var n = sel ? ids.filter(function(id) { return sel[id]; }).length : 0, tout = sel && n === ids.length;
    var barre = traites.length < 2 ? '' : sel
        ? '<div class="MER-BIB-BARRE"><button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="RECU_TOUT_COCHER(\'' + cle + '\')">' + (tout ? 'Tout décocher' : 'Tout cocher') + '</button>' +
            '<button type="button" class="BTN BTN-SMALL MER-BIB-SUPPR" data-cle="' + cle + '" onclick="RECU_SUPPRIMER_SELECTION(\'' + cle + '\')"' + (n ? '' : ' disabled') + '>🗑 Supprimer' + (n ? ' (' + n + ')' : '') + '</button>' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="RECU_SELECTION(false)">Annuler</button></div>'
        : '<div class="MER-BIB-BARRE"><button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="RECU_SELECTION(true)">☑ Sélectionner</button></div>';
    return '<details class="MER-RECU-TRAITES"' + (sel ? ' open' : '') + '><summary>' + titre + ' (' + traites.length + ')</summary>' + barre + traites.map(TPL_ENVOI_RECU).join('') + '</details>';
}
function RECU_REAFFICHER() { var y = window.scrollY; SHOW_PAGE(PAGE_ACTUELLE); window.scrollTo(0, y); }
function RECU_SELECTION(active) { MER_RECU_SELECTION = active ? {} : null; RECU_REAFFICHER(); }
function RECU_COCHER(id, oui) {
    if (!MER_RECU_SELECTION) return;
    if (oui) MER_RECU_SELECTION[id] = true; else delete MER_RECU_SELECTION[id];
    Array.prototype.forEach.call(document.querySelectorAll('.MER-BIB-SUPPR[data-cle]'), function(b) {
        var n = (MER_RECU_LISTES[b.getAttribute('data-cle')] || []).filter(function(i) { return MER_RECU_SELECTION[i]; }).length;
        b.disabled = !n; b.textContent = '🗑 Supprimer' + (n ? ' (' + n + ')' : '');
    });
}
function RECU_TOUT_COCHER(cle) {
    var ids = MER_RECU_LISTES[cle] || [], tout = ids.every(function(id) { return MER_RECU_SELECTION[id]; });
    ids.forEach(function(id) { if (tout) delete MER_RECU_SELECTION[id]; else MER_RECU_SELECTION[id] = true; });
    RECU_REAFFICHER();
}
function RECU_SUPPRIMER_SELECTION(cle) {
    var ids = (MER_RECU_LISTES[cle] || []).filter(function(id) { return MER_RECU_SELECTION && MER_RECU_SELECTION[id]; });
    if (!ids.length) return;
    MSG_CONFIRM('Supprimer ' + ids.length + ' élément' + (ids.length > 1 ? 's' : '') + ' ?', (ids.length > 1 ? 'Ces envois traités seront retirés' : 'Cet envoi traité sera retiré') + ' de votre boîte sur cet appareil.', 'Supprimer', function() {
        ids.reduce(function(suite, id) { return suite.then(function() { return JUMELAGE_BOITE_SUPPRIMER(id); }); }, Promise.resolve()).then(function() {
            MER_RECU_SELECTION = null; RECU_REAFFICHER();
        });
    }, '🗑️', 'mascotte-poubelle.webp', true);
}
// ===================== DOSSIERS (boîte de réception, espace Assistant Chorus DT) =====================
// Comme une messagerie : des dossiers jaunes, chacun avec son nom et le nombre d'envois à traiter ; un toucher ouvre
// le dossier (envois à traiter, puis ses envois traités). MER_DOSSIER : dossier ouvert de chaque page (null = liste).
var MER_DOSSIER = { RECEPTION: null, CHORUS: null, BIBLIOTHEQUE: null, PANIER: null };
var MER_ICONE_DOSSIER = '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M3 7a4 4 0 0 1 4-4h11l5 5h18a4 4 0 0 1 4 4v3H3Z" fill="#E0A800"/><path d="M3 13a3 3 0 0 1 3-3h36a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="#F6C343"/><path d="M3 15h42" stroke="#FBD970" stroke-width="1.5"/></svg>';
function MER_DOSSIERS(page, l) {
    var d = page === 'CHORUS' ? [
        { id: 'demandes', titre: 'Demandes de mise en route', sous: 'Validées par les deux valideurs', aide: 'Validées par les deux valideurs. « Aperçu » ou « Télécharger le PDF » : TRIGONE vérifie d\'abord les signatures et les pièces jointes.', natures: ['chorus'] },
        { id: 'cr', titre: 'Comptes-rendus de mission', sous: 'Envoyés au retour de mission', aide: 'Envoyés par les missionnaires au retour de mission : compte-rendu PDF et justificatifs.', natures: ['cr'] }
    ] : [
        { id: 'signer', titre: 'À signer', sous: 'Demandes de mise en route à valider', aide: 'Demandes reçues des missionnaires (1er valideur) ou du 1er valideur (2e valideur), et demandes renvoyées : « Ouvrir et signer ».', natures: ['niveau1', 'niveau2', 'renvoi'] },
        { id: 'refus', titre: 'Refusées — à corriger', sous: 'Vos demandes renvoyées avec un motif', aide: 'Vos demandes refusées par un valideur ou l\'assistant Chorus DT : corrigez-les dans Documents, puis renvoyez.', natures: ['refus'] },
        { id: 'collective', titre: 'Missions collectives', sous: 'Comptes-rendus préremplis par le chef de mission', aide: 'Envoyés par votre chef de mission : « Ouvrir mon compte-rendu », joignez vos justificatifs, puis envoyez.', natures: ['collective'] },
        { id: 'justif', titre: 'Justificatifs', sous: 'Factures et billets reçus par mail', aide: MER_AIDE_JUSTIF(), natures: ['justif'] },
        { id: 'questions', titre: 'Questions', sous: 'Questions sur vos demandes, et réponses', aide: 'Un valideur ou l\'assistant Chorus DT vous pose une question plutôt que de refuser : « Répondre » et votre dossier avance. Vous y trouvez aussi les réponses aux questions que vous avez posées.', natures: ['question', 'reponse'] }
    ];
    var connues = [].concat.apply([], d.map(function(x) { return x.natures; }));
    var autres = l.filter(function(x) { return connues.indexOf(x.nature) < 0; });
    if (autres.length) d.push({ id: 'autres', titre: 'Autres envois', sous: 'Envois reçus', aide: '', natures: null });
    // Assist Chorus DT et administrateur : inscriptions sans adresse mail à valider (comptes de l'unité, jumelage.js).
    if (page === 'CHORUS' && window.JUMELAGE_INSCRIPTIONS) {
        var ins = JUMELAGE_INSCRIPTIONS();
        d.push({ id: 'inscriptions', inscriptions: true, titre: 'Demandes de création de compte', sous: 'Inscriptions à valider', aTraiter: ins, traites: [], nb: ins.length, nouveau: ins.length > 0 });
    }
    d.forEach(function(x) {
        if (x.inscriptions) return;
        x.liste = x.natures ? l.filter(function(e) { return x.natures.indexOf(e.nature) >= 0; }) : autres;
        x.aTraiter = x.liste.filter(function(e) { return e.statut !== 'traite'; });
        x.traites = x.liste.filter(function(e) { return e.statut === 'traite'; });
        x.nb = x.aTraiter.reduce(function(t, e) { return t + (e.n > 1 ? e.n : 1); }, 0);
        x.nouveau = x.aTraiter.some(function(e) { return e.statut === 'nouveau'; });
    });
    return d;
}
// Justificatifs : l'adresse où les envoyer (créée avec Mon profil).
function MER_AIDE_JUSTIF() {
    var a = window.JUMELAGE_ADRESSE_CONNUE ? JUMELAGE_ADRESSE_CONNUE() : '';
    return 'Factures d\'hôtel, billets de train ou d\'avion : envoyez-les ou <b>transférez-les</b> à ' + (a ? '<b>' + ESC(a) + '</b> <button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto; display:inline-block; margin:0 0 0 4px; padding:4px 10px;" onclick="JUMELAGE_COPIER_ADRESSE(this)">Copier</button>' : 'votre adresse TRIGONE (Ma carte)') +
        '. Seules les pièces jointes PDF et photos sont gardées, chiffrées. Au compte-rendu : « 📥 Depuis ma boîte TRIGONE ». Un expéditeur inconnu (hôtel…) arrive « à vérifier ».';
}
function VOIR_JUSTIF(id, i) {
    JUMELAGE_JUSTIF_FICHIER(id, i).then(function(f) {
        var u = URL.createObjectURL(f), w = window.open(u, '_blank');
        if (!w) { var a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); }
        setTimeout(function() { URL.revokeObjectURL(u); }, 60000);
    }).catch(function(e) { MSG_ERREUR('Justificatif introuvable', e.message || String(e)); });
}
// Dossier où range un envoi (bandeau de réception : ouverture directe du bon dossier).
function MER_DOSSIER_DE(page, x) {
    var d = MER_DOSSIERS(page, [x]).filter(function(e) { return e.liste.length; })[0];
    return d ? d.id : null;
}
function OUVRIR_DOSSIER(page, id) { if (id === 'inscriptions' && window.JUMELAGE_INSCRIPTIONS_ACTUALISER) JUMELAGE_INSCRIPTIONS_ACTUALISER(true); if (MER_BX_SEL && MER_DOSSIER[page] !== id) { MER_BX_SEL[page] = null; MER_BX_Q[page] = ''; } MER_DOSSIER[page] = id; MER_RECU_SELECTION = null; MER_BIB_SELECTION = null; SHOW_PAGE(page); window.scrollTo(0, 0); }
// Grille de dossiers : d = { id, titre, sous, nb (compteur), gris (compteur gris au lieu de rouge), det (HTML), nouveau }.
function TPL_GRILLE_DOSSIERS(page, ds) {
    return '<div class="MER-DOSSIERS">' + ds.map(function(d) {
        return '<button type="button" class="MER-DOSSIER' + (d.nouveau ? ' nouveau' : '') + (d.nb ? '' : ' vide') + '" data-dossier="' + d.id + '" onclick="OUVRIR_DOSSIER(\'' + page + '\', \'' + d.id + '\')">' +
            '<span class="MER-DOSSIER-ICONE">' + MER_ICONE_DOSSIER + (d.nb ? '<span class="MER-DOSSIER-NB' + (d.gris ? ' gris' : '') + '">' + d.nb + '</span>' : '') + '</span>' +
            '<span class="MER-DOSSIER-TXT"><b>' + ESC(d.titre) + '</b><small>' + ESC(d.sous) + '</small><small class="MER-DOSSIER-DET">' + d.det + '</small></span>' +
            '<span class="MER-DOSSIER-CHEV" aria-hidden="true">›</span></button>';
    }).join('') + '</div>';
}
function TPL_TETE_DOSSIER(page, d) {
    return '<div class="MER-DOSSIER-TETE"><button type="button" class="MER-DOSSIER-RETOUR" onclick="OUVRIR_DOSSIER(\'' + page + '\', null)">‹ Dossiers</button>' +
        '<span class="MER-DOSSIER-ICONE petit">' + MER_ICONE_DOSSIER + '</span><b>' + ESC(d.titre) + '</b>' + (d.nb ? '<span class="MER-DOSSIER-NB en-ligne' + (d.gris ? ' gris' : '') + '">' + d.nb + '</span>' : '') + '</div>';
}
function TPL_DOSSIERS(page, l) {
    var ds = MER_DOSSIERS(page, l);
    var ouvert = ds.filter(function(d) { return d.id === MER_DOSSIER[page]; })[0];
    if (!ouvert) {
        MER_DOSSIER[page] = null;
        ds.forEach(function(d) {
            // Justificatifs : « à joindre » (pas encore joints à un compte-rendu) et « rangés ».
            var j = d.id === 'justif', p = function(n) { return n > 1 ? 's' : ''; };
            d.det = (d.aTraiter.length ? '<span class="MER-DOSSIER-ATT">' + d.aTraiter.length + (j ? ' à joindre' : d.inscriptions ? ' à valider' : ' à traiter') + '</span>' : j ? 'Rien à joindre' : d.inscriptions ? 'Rien à valider' : 'Rien à traiter') +
                (d.traites.length ? ' · ' + d.traites.length + (j ? ' rangé' : ' traité') + p(d.traites.length) : '');
        });
        return TPL_GRILLE_DOSSIERS(page, ds);
    }
    if (ouvert.inscriptions) return TPL_TETE_DOSSIER(page, ouvert) + TPL_INSCRIPTIONS(ouvert.aTraiter);
    // « À signer » : plusieurs demandes du même niveau → toutes ouvertes d'un coup dans l'Espace valideur, déjà cochées.
    var groupe = ouvert.id === 'signer' ? [1, 2].map(function(n) {
        var l = ouvert.aTraiter.filter(function(e) { return e.nature === 'niveau' + n; }), nb = l.reduce(function(t, e) { return t + (e.n > 1 ? e.n : 1); }, 0);
        return nb > 1 ? '<button type="button" class="BTN BTN-PRIMARY" style="margin:0 0 12px;" onclick="OUVRIR_TOUT_SIGNER(' + n + ')">✍️ Tout ouvrir et signer — ' + nb + ' demandes' + (ouvert.aTraiter.some(function(e) { return e.nature === 'niveau' + (3 - n); }) ? ' (' + n + (n === 1 ? 'er' : 'e') + ' niveau)' : '') + '</button>' : '';
    }).join('') : '';
    return TPL_TETE_DOSSIER(page, ouvert) +
        (ouvert.aide ? '<p class="MER-HINT" style="margin:0 0 10px;">' + ouvert.aide + '</p>' : '') + groupe +
        (ouvert.id === 'justif' ? '<div class="MER-SECTION-TITRE">À joindre</div>' : '') +
        (ouvert.aTraiter.length ? ouvert.aTraiter.map(TPL_ENVOI_RECU).join('') : '<div class="MER-EMPTY">' + (ouvert.id === 'justif' ? 'Rien à joindre : les factures et billets reçus par mail arrivent ici.' : 'Rien à traiter dans ce dossier.') + '</div>') +
        TPL_RECU_TRAITES(page + '-' + ouvert.id, ouvert.id === 'justif' ? 'Rangés' : 'Traités', ouvert.traites);
}

// Dossier « Demandes de création de compte » : une ligne par inscription (grade, nom, prénom, adresse TRIGONE, date),
// Valider / Refuser, validation en scannant la carte ; l'administrateur a en plus tous les comptes de l'unité.
function TPL_INSCRIPTIONS(l) {
    var admin = MER_ADMIN();
    return '<p class="MER-HINT" style="margin:0 0 10px;">Personnes de votre unité qui ont créé leur compte TRIGONE sans adresse mail. Vérifiez que vous les connaissez (au mieux : leur carte TRIGONE en main), puis « Valider ». Tant qu\'un compte n\'est pas validé, il ne peut ni envoyer ni recevoir.</p>' +
        (l.length ? l.map(function(x) {
            var qui = [x.grade, x.nom, x.prenom].filter(Boolean).join(' ') || x.adresse || x.mail;
            return '<div class="MER-INSCR" data-m="' + ESC(x.mail) + '"><div class="MER-INSCR-TXT"><b>' + ESC(qui) + '</b><small>' + ESC(x.adresse || x.mail) + (x.unite ? ' · ' + ESC(x.unite) : '') + (x.le ? ' · inscrit le ' + new Date(x.le).toLocaleDateString('fr-FR') : '') + '</small></div>' +
                '<div class="MER-INSCR-ACT"><button type="button" class="BTN BTN-SECONDARY BTN-SMALL" onclick="JUMELAGE_INSCRIPTION_DECIDER(this.closest(\'.MER-INSCR\').getAttribute(\'data-m\'), false)">Refuser</button>' +
                '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="JUMELAGE_INSCRIPTION_DECIDER(this.closest(\'.MER-INSCR\').getAttribute(\'data-m\'), true)">✔ Valider</button></div></div>';
        }).join('') : '<div class="MER-EMPTY">Aucune demande de création de compte en attente.</div>') +
        '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-top:12px;" onclick="JUMELAGE_INSCRIPTION_SCANNER()">📷 Valider en scannant sa carte TRIGONE</button>' +
        (admin ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-top:8px;" onclick="JUMELAGE_GESTION_COMPTES()">👤 Tous les comptes de l\'unité (bloquer, code, supprimer) ›</button>' : '');
}
window.addEventListener('trigone-inscriptions', function() { if (typeof PAGE_ACTUELLE !== 'undefined' && PAGE_ACTUELLE === 'CHORUS' && MER_DOSSIER.CHORUS !== 'registre' && !MER_RESULTATS_VERIF) SHOW_PAGE('CHORUS'); });

// ===================== BOÎTE FAÇON MESSAGERIE (Boîte de réception, espace Assist Chorus DT) =====================
// Dossiers à gauche avec leur pastille (nombre à traiter), la liste des envois au milieu, la lecture à droite (PC) ;
// téléphone : un niveau à la fois (dossiers → liste → lecture). La lecture reprend la carte de l'envoi et ses actions.
var MER_BX_SEL = { RECEPTION: null, CHORUS: null }, MER_BX_Q = { RECEPTION: '', CHORUS: '' };
var MER_BX_ICONES = {
    signer: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', refus: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    q: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
    coll: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14a5 5 0 0 1 5 5"/>',
    justif: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>', ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
    env: '<path d="M4 12l16-8-6 16-3-7z"/><path d="M11 13l9-9"/>',
    boite: '<path d="M3 13.5l2.6-7.6A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.4l2.6 7.6"/><path d="M3 13.5v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4h-5.2l-1.3 2.3h-5l-1.3-2.3z"/>',
    pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
    cr: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    compte: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
    reg: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 9.5h7M8.5 13h7M8.5 16.5h4.5"/>', loupe: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
    clip: '<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>', rep: '<path d="M4 5h16v11H8l-4 4z"/>',
    maj: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>'
};
function MER_BX_ICO(n) { return '<svg class="MER-BX-ICO" viewBox="0 0 24 24" aria-hidden="true">' + (MER_BX_ICONES[n] || MER_BX_ICONES.boite) + '</svg>'; }
var MER_BX_TAGS = { niveau1: 'À SIGNER', niveau2: 'À SIGNER · 2E NIVEAU', renvoi: 'RENVOYÉE', chorus: 'VALIDÉE', refus: 'REFUSÉE', cr: 'COMPTE-RENDU', collective: 'COLLECTIVE', question: 'QUESTION', reponse: 'RÉPONSE', justif: 'JUSTIFICATIF' };
function MER_BX_QUAND(ms) {
    if (!ms) return '';
    var d = new Date(ms), auj = new Date(), hier = new Date(); hier.setDate(hier.getDate() - 1);
    if (d.toDateString() === auj.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hier.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}
function MER_BX_BOITE(page) {
    var l = window.JUMELAGE_BOITE_LISTE ? JUMELAGE_BOITE_LISTE() : [];
    return page === 'CHORUS' ? l.filter(MER_EST_CHORUS) : l.filter(function(x) { return !MER_ROLE_CHORUS() || !MER_EST_CHORUS(x); });
}
// Mes demandes envoyées (bibliothèque) avec leur suivi : la plus récente d'abord.
function MER_BX_MES_DEMANDES() {
    return GET_BIBLIOTHEQUE().slice().sort(function(a, b) { return new Date(b.envoyeLe || 0) - new Date(a.envoyeLe || 0); }).slice(0, 60).map(function(e) {
        var d0 = (e.demandes || [])[0] || {}, p0 = (d0.personnes || [])[0] || {}, s = window.JUMELAGE_SUIVI ? JUMELAGE_SUIVI()[d0.id] : null;
        var etat = !s ? 'Envoyée' : { val1: 'Chez le VALIDEUR 1', val2: 'Chez le VALIDEUR 2', chorus: 'Chez l\'assistant Chorus DT', traite: 'Prise en charge par l\'assistant Chorus DT', refus: 'Refusée', abandon: 'Abandonnée' }[s.etape] || 'En cours';
        return { id: 'bib-' + e.id, bib: e, suivi: true, nature: 'suivi', statut: s && (s.etape === 'traite' || s.etape === 'abandon') ? 'traite' : 'ouvert', le: e.envoyeLe ? new Date(e.envoyeLe).getTime() : 0,
            noms: [p0.grade, p0.nom, p0.prenom].filter(Boolean).join(' ') + ((e.demandes || []).length > 1 ? ' (+ ' + (e.demandes.length - 1) + ')' : ''), objet: d0.objet || 'Demande de mise en route', etat: etat, refusee: !!s && s.etape === 'refus' };
    });
}
// Dossiers : [ dossiers à traiter, dossiers de rangement ].
function MER_BX_DOSSIERS(page) {
    var l = MER_BX_BOITE(page), ds = MER_DOSSIERS(page, l);
    var ic = { signer: 'signer', refus: 'refus', collective: 'coll', justif: 'justif', questions: 'q', autres: 'boite', demandes: 'pdf', cr: 'cr', inscriptions: 'compte' };
    var titres = { demandes: 'Demandes validées', cr: 'Comptes-rendus reçus', inscriptions: 'Créations de compte', collective: 'Missions collectives' };
    var haut = ds.filter(function(d) { return d.id !== 'signer' || d.nb || MER_EST_VALIDEUR(); }).map(function(d) {
        return { id: d.id, titre: titres[d.id] || d.titre.replace(' — à corriger', ' à corriger'), ic: ic[d.id] || 'boite', items: d.aTraiter, nb: d.nb, nouveau: d.nouveau, inscriptions: d.inscriptions, aide: d.aide };
    });
    var traites = l.filter(function(x) { return x.statut === 'traite'; }).sort(function(a, b) { return (b.traiteLe || b.le || 0) - (a.traiteLe || a.le || 0); });
    var bas = [{ id: 'traites', titre: 'Traités', ic: 'ok', items: traites, nb: traites.length, gris: true, aide: 'Les envois signés, refusés, téléchargés ou rangés. « ↺ Rouvrir » les remet à traiter.' }];
    if (page === 'RECEPTION') { var md = MER_BX_MES_DEMANDES(); bas.push({ id: 'suivi', titre: 'Mes demandes (suivi)', ic: 'env', items: md, nb: md.filter(function(x) { return x.statut !== 'traite'; }).length, gris: true, aide: 'Où en sont les demandes que vous avez envoyées.' }); }
    if (page === 'CHORUS') {
        bas.unshift({ id: 'registre', titre: 'Registre des OMR', ic: 'reg', lien: 'OUVRIR_REGISTRE(\'tout\')', nb: MER_REGISTRE_FILTRES().tout.length, gris: true });
        bas.push({ id: 'pdf', titre: 'Contrôler un PDF', ic: 'loupe', fichier: true });
    }
    return [haut, bas];
}
function TPL_BX_DOSSIERS(page, groupes, dId) {
    var titre = page === 'CHORUS' ? 'Assist Chorus DT' : 'Boîte de réception';
    return '<nav class="MER-BX-DOSSIERS" aria-label="Dossiers"><div class="MER-BX-DT">' + titre + '</div>' + groupes.map(function(g, i) {
        return (i ? '<div class="MER-BX-SEP"></div>' : '') + g.map(function(d) {
            var nb = d.nb ? '<span class="MER-DOSSIER-NB' + (d.gris ? ' gris' : '') + '">' + d.nb + '</span>' : '';
            var corps = '<span class="MER-BX-DIC">' + MER_BX_ICO(d.ic) + '</span><span class="MER-BX-DTXT">' + ESC(d.titre) + '</span>' + nb + '<span class="MER-BX-CHEV" aria-hidden="true">›</span>';
            var cls = 'MER-DOSSIER MER-BX-D' + (d.id === dId ? ' on' : '') + (d.nb ? '' : ' vide') + (d.nouveau ? ' nouveau' : '');
            if (d.fichier) return '<label class="' + cls + '" data-dossier="' + d.id + '">' + corps + '<input type="file" accept=".pdf,application/pdf" multiple style="display:none;" onchange="VERIFIER_FICHIERS(this)"></label>';
            return '<button type="button" class="' + cls + '" data-dossier="' + d.id + '" onclick="' + (d.lien || 'OUVRIR_DOSSIER(\'' + page + '\', \'' + d.id + '\')') + '">' + corps + '</button>';
        }).join('');
    }).join('') + '</nav>';
}
function MER_BX_FILTRE(page, items) {
    var q = (MER_BX_Q[page] || '').trim().toLowerCase();
    return !q ? items : items.filter(function(x) { return [x.noms, x.nom, x.objet, x.lieu, x.dates, x.de, x.omr, (x.registre || []).map(function(r) { return r.omr; }).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0; });
}
function TPL_BX_LIGNE(page, x, sel) {
    var traite = x.statut === 'traite';
    var l3 = x.suivi ? x.etat : traite ? 'Traité' + (x.traitePar ? ' par ' + x.traitePar : '') : [x.dates, x.lieu].filter(Boolean).join(' · ') || (x.nature === 'justif' ? ((x.fichiers || []).length || 1) + ' pièce(s) jointe(s)' : '');
    return '<button type="button" class="MER-BX-LIGNE' + (x.statut === 'nouveau' ? ' nl' : '') + (sel ? ' on' : '') + (x.refusee ? ' refus' : '') + '" data-id="' + ESC(x.id) + '" onclick="MER_BX_OUVRIR(\'' + page + '\', \'' + ESC(x.id) + '\')">' +
        '<span class="MER-BX-PT" aria-hidden="true"></span><span class="MER-BX-C"><span class="l1"><b>' + ESC(x.noms || x.expediteur || x.de || x.nom || 'Envoi') + '</b><small>' + MER_BX_QUAND(x.le) + '</small></span>' +
        '<span class="l2">' + (x.suivi ? '' : '<i class="MER-BX-TAG">' + (MER_BX_TAGS[x.nature] || 'ENVOI') + '</i>') + ESC(x.objet || x.nom || '') + (x.n > 1 ? ' · ' + x.n + ' demandes' : '') + '</span>' +
        (l3 ? '<span class="l3">' + ESC(l3) + '</span>' : '') + '</span></button>';
}
function TPL_BX_LISTE(page, d, pc) {
    var tete = '<div class="MER-BX-LT">' + (pc ? '' : '<button type="button" class="MER-BX-RETOUR" onclick="OUVRIR_DOSSIER(\'' + page + '\', null)">‹ ' + (page === 'CHORUS' ? 'Assist Chorus DT' : 'Boîte') + '</button>') +
        '<div class="MER-BX-LTITRE"><b>' + ESC(d.titre) + '</b>' + (d.nb && !d.gris ? '<span class="MER-DOSSIER-NB">' + d.nb + '</span>' : '') + '</div>' +
        (d.aide ? '<small>' + d.aide + '</small>' : '') + '</div>';
    if (d.inscriptions) return '<div class="MER-BX-LISTE">' + tete + '<div class="MER-BX-INSCR">' + TPL_INSCRIPTIONS(d.items) + '</div></div>';
    var items = MER_BX_FILTRE(page, d.items);
    return '<div class="MER-BX-LISTE">' + tete +
        (d.items.length > 3 || MER_BX_Q[page] ? '<label class="MER-BX-RECH">' + MER_BX_ICO('loupe') + '<input type="search" placeholder="Rechercher un nom, un objet, un n° OMR…" value="' + ESC(MER_BX_Q[page]) + '" oninput="MER_BX_CHERCHER(\'' + page + '\', this.value)"></label>' : '') +
        '<div class="MER-BX-LIGNES" id="MER-BX-LIGNES-' + page + '">' + TPL_BX_LIGNES(page, items) + '</div></div>';
}
function TPL_BX_LIGNES(page, items) {
    return items.length ? items.map(function(x) { return TPL_BX_LIGNE(page, x, x.id === MER_BX_SEL[page]); }).join('')
        : '<div class="MER-BX-VIDE">' + (MER_BX_Q[page] ? 'Aucun envoi pour cette recherche.' : 'Rien dans ce dossier.') + '</div>';
}
function MER_BX_CHERCHER(page, v) {
    MER_BX_Q[page] = v;
    var d = MER_BX_DOSSIER_COURANT(page), z = document.getElementById('MER-BX-LIGNES-' + page);
    if (d && z) z.innerHTML = TPL_BX_LIGNES(page, MER_BX_FILTRE(page, d.items));
}
function MER_BX_DOSSIER_COURANT(page) {
    var g = MER_BX_DOSSIERS(page);
    return g[0].concat(g[1]).filter(function(d) { return d.id === MER_DOSSIER[page]; })[0] || null;
}
function MER_BX_OUVRIR(page, id) {
    MER_BX_SEL[page] = id;
    var x = (window.JUMELAGE_BOITE_LISTE ? JUMELAGE_BOITE_LISTE() : []).filter(function(y) { return y.id === id; })[0];
    if (x && x.statut === 'nouveau' && window.JUMELAGE_BOITE_MARQUER) JUMELAGE_BOITE_MARQUER(id, 'ouvert');
    SHOW_PAGE(page);
}
function MER_BX_FERMER(page) { MER_BX_SEL[page] = null; SHOW_PAGE(page); }
function TPL_BX_LECTURE(page, d, pc) {
    var x = d.items.filter(function(y) { return y.id === MER_BX_SEL[page]; })[0];
    if (!x) return pc ? '<div class="MER-BX-VIDE grand">' + MER_BX_ICO(d.ic) + '<span>Choisissez un envoi dans la liste.</span></div>' : '';
    var retour = pc ? '' : '<button type="button" class="MER-BX-RETOUR" onclick="MER_BX_FERMER(\'' + page + '\')">‹ ' + ESC(d.titre) + '</button>';
    var le = x.le ? new Date(x.le).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    if (x.suivi) {
        return '<div class="MER-BX-LECTURE">' + retour + '<h2>' + ESC(x.objet) + '</h2><div class="MER-BX-DE">' + ESC(x.noms) + (le ? ' · envoyée le ' + ESC(le) : '') + '</div>' +
            (x.bib.demandes || []).map(function(dm, i) { return TPL_SUIVI_DEMANDE(dm.id, x.bib.demandes.length > 1 ? (dm.objet || 'Demande ' + (i + 1)) : ''); }).join('') +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-top:12px;" onclick="SHOW_PAGE(\'BIBLIOTHEQUE\')">Voir dans la Bibliothèque ›</button></div>';
    }
    return '<div class="MER-BX-LECTURE">' + retour + '<h2>' + ESC(x.objet || x.noms || x.nom || 'Envoi') + '</h2>' +
        '<div class="MER-BX-DE">De <b>' + ESC(x.noms || x.expediteur || x.de || '?') + '</b>' + (x.de && x.noms ? ' (' + ESC(x.de) + ')' : '') + (le ? ' · ' + ESC(le) : '') + '</div>' + TPL_ENVOI_RECU(x) + '</div>';
}
function TPL_BX(page) {
    var pc = EST_PC(), groupes = MER_BX_DOSSIERS(page), tous = groupes[0].concat(groupes[1]);
    var d = tous.filter(function(x) { return x.id === MER_DOSSIER[page] && !x.lien && !x.fichier; })[0] || null;
    // PC : un dossier toujours ouvert (le premier qui a quelque chose à traiter), et son premier envoi à la lecture.
    if (pc && !d) { d = groupes[0].filter(function(x) { return x.nb; })[0] || groupes[0][0] || null; if (d) MER_DOSSIER[page] = d.id; }
    if (MER_DOSSIER[page] && !d) MER_DOSSIER[page] = null;
    if (d && MER_BX_SEL[page] && !d.items.some(function(y) { return y.id === MER_BX_SEL[page]; })) MER_BX_SEL[page] = null;
    if (pc && d && !d.inscriptions && !MER_BX_SEL[page] && d.items.length) MER_BX_SEL[page] = MER_BX_FILTRE(page, d.items).concat(d.items)[0].id;
    var colD = TPL_BX_DOSSIERS(page, groupes, d && d.id);
    if (pc) return '<div class="MER-BX pc">' + colD + '<div class="MER-BX-COL2">' + (d ? TPL_BX_LISTE(page, d, true) : '') + '</div>' +
        '<div class="MER-BX-COL3">' + (d && !d.inscriptions ? TPL_BX_LECTURE(page, d, true) : d ? '<div class="MER-BX-VIDE grand">' + MER_BX_ICO('compte') + '<span>Validez ou refusez chaque inscription dans la liste.</span></div>' : '') + '</div></div>';
    if (!d) return '<div class="MER-BX tel">' + colD + '</div>';
    if (MER_BX_SEL[page]) return '<div class="MER-BX tel">' + TPL_BX_LECTURE(page, d, false) + '</div>';
    return '<div class="MER-BX tel">' + TPL_BX_LISTE(page, d, false) + '</div>';
}
// Message en bas de l'écran quand un envoi change de dossier : ce qui s'est passé, où il est parti, où il en est.
var MER_TOAST_MIN = null;
function MER_TOAST(titre, texte, bouton, action) {
    var t = document.getElementById('MER-TOAST'); if (t) t.remove();
    clearTimeout(MER_TOAST_MIN);
    t = document.createElement('div'); t.id = 'MER-TOAST'; t.className = 'MER-TOAST'; t.setAttribute('role', 'status');
    t.innerHTML = '<span class="MER-TOAST-IC"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span><div><b>' + ESC(titre) + '</b><span>' + ESC(texte) + '</span></div>' +
        (bouton ? '<button type="button">' + ESC(bouton) + '</button>' : '');
    if (bouton) t.querySelector('button').onclick = function() { t.remove(); if (action) action(); };
    document.body.appendChild(t);
    requestAnimationFrame(function() { t.classList.add('vu'); });
    MER_TOAST_MIN = setTimeout(function() { t.classList.remove('vu'); setTimeout(function() { t.remove(); }, 300); }, bouton ? 6500 : 4500);
}
// Message choisi d'après la nature de l'envoi rangé (les cas particuliers posent leur message eux-mêmes juste avant).
var MER_TOAST_PERSO = null;
function MER_TOAST_RANGE(items) {
    if (MER_TOAST_PERSO) { var p = MER_TOAST_PERSO; MER_TOAST_PERSO = null; MER_TOAST.apply(null, p); return; }
    var x = items[0]; if (!x) return;
    var voir = function() { MER_DOSSIER[PAGE_ACTUELLE === 'CHORUS' ? 'CHORUS' : 'RECEPTION'] = 'traites'; MER_BX_SEL[PAGE_ACTUELLE === 'CHORUS' ? 'CHORUS' : 'RECEPTION'] = x.id; SHOW_PAGE(PAGE_ACTUELLE === 'CHORUS' ? 'CHORUS' : 'RECEPTION'); };
    var m = {
        niveau1: ['Demande signée', 'Partie dans « Traités » — maintenant chez le VALIDEUR 2.'], renvoi: ['Demande signée', 'Partie dans « Traités » — maintenant chez le VALIDEUR 2.'],
        niveau2: ['Demande validée', 'Partie dans « Traités » — transmise à l\'assistant Chorus DT.'],
        chorus: ['Demande traitée', 'Rangée dans « Traités »' + (x.omr ? ' — OMR N°' + x.omr + ' au registre.' : ' — le demandeur est prévenu.')],
        cr: ['Compte-rendu traité', 'Rangé dans « Traités » — le missionnaire est prévenu.'],
        justif: ['Justificatif rangé', 'Rangé dans « Traités ».'], question: ['Question traitée', 'Rangée dans « Traités ».'], reponse: ['Réponse lue', 'Rangée dans « Traités ».'],
        collective: ['Compte-rendu prérempli ouvert', 'Retiré de « Missions collectives », rangé dans « Traités ».'],
        refus: ['Demande à corriger', 'Retirée de « Refusées » — à corriger dans Documents.']
    }[x.nature] || ['Rangé', 'Envoi rangé dans « Traités ».'];
    MER_TOAST(items.length > 1 ? m[0] + ' (' + items.length + ')' : m[0], m[1], 'Voir', voir);
}
window.addEventListener('trigone-range', function(e) { try { MER_TOAST_RANGE((e.detail && e.detail.items) || []); } catch (x) {} });

function TPL_RECEPTION() {
    var compte = MER_COMPTE_ACTIF(), pc = EST_PC();
    if (compte && window.JUMELAGE_SUIVI_ACTUALISER) setTimeout(JUMELAGE_SUIVI_ACTUALISER, 0);
    if (!compte) return '<div class="CARD"><h2>Boîte de réception</h2><p class="MER-HINT" style="margin:4px 0 12px;">Activez votre compte TRIGONE pour envoyer vos demandes et recevoir ici celles qui vous reviennent.</p>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="JUMELAGE_COMPTE()">Se connecter à TRIGONE</button><button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
    var niveau = !pc && MER_DOSSIER.RECEPTION ? 'dedans' : '';
    return '<div class="CARD MER-BX-CARTE' + (pc ? ' PC-LARGE' : '') + '">' +
        (niveau ? '' : '<div class="MER-BX-ENTETE"><div><h2>Boîte de réception</h2><small>' + ESC(JUMELAGE_COMPTE_MAIL()) + '</small></div>' +
            '<button type="button" class="MER-BX-RELEVER" onclick="ACTUALISER_RECEPTION(this)" title="Relever maintenant">' + MER_BX_ICO('maj') + '<span>Relever</span></button></div>') +
        TPL_BX('RECEPTION') + '</div>';
}
// ===================== ESPACE ASSISTANT CHORUS DT =====================
// Ouvert depuis le logo central de l'écran de choix (rôle activé dans les Réglages avec son code) : sa boîte de
// réception (demandes validées des 2e valideurs, comptes-rendus des missionnaires), sans passer par l'Espace valideur.
var MER_ESPACE_CHORUS = false;
function MER_ADMIN() { return !!(window.JUMELAGE_ROLE_ADMIN && JUMELAGE_ROLE_ADMIN()); }
window.MER_OUVRIR_CHORUS = function() { SHOW_PAGE('CHORUS'); };
function TPL_CHORUS() {
    var compte = MER_COMPTE_ACTIF(), pc = EST_PC();
    if (compte && window.JUMELAGE_INSCRIPTIONS_ACTUALISER) setTimeout(function() { JUMELAGE_INSCRIPTIONS_ACTUALISER(); }, 0);
    var logo = '<img class="MER-CHORUS-LOGO JUM-LOGO-CHOIX" src="logo_chorus.webp" alt="TRIGONE Assist Chorus-DT" title="Revenir à l\'écran de choix" onclick="MER_RESULTATS_VERIF = null; JUMELAGE_CHOIX()">' +
        (MER_ADMIN() ? '<div class="MER-CHORUS-ADMIN">ADMINISTRATEUR</div>' : '');
    // Registre des OMR : sa page pleine largeur, comme avant.
    if (MER_DOSSIER.CHORUS === 'registre') return (MER_RESULTATS_VERIF ? TPL_VERIFIER() : '') + '<div class="CARD MER-CHORUS-TETE PC-LARGE">' + logo + TPL_REGISTRE() + '</div>';
    var accueil = !MER_DOSSIER.CHORUS;
    return (MER_RESULTATS_VERIF ? TPL_VERIFIER() : '') +
        '<div class="CARD MER-BX-CARTE MER-CHORUS-TETE' + (pc ? ' PC-LARGE' : '') + '">' + (!pc && accueil ? logo : '') +
        (compte ? '<div class="MER-BX-ENTETE"' + (!pc && !accueil ? ' style="display:none;"' : '') + '><div>' + (pc ? '<h2>Assist Chorus DT</h2>' : '') + '<small>Envois reçus à ' + ESC(JUMELAGE_COMPTE_MAIL()) + ', chiffrés</small></div>' +
            '<button type="button" class="MER-BX-RELEVER" onclick="ACTUALISER_RECEPTION(this)" title="Relever maintenant">' + MER_BX_ICO('maj') + '<span>Relever</span></button></div>' + TPL_BX('CHORUS')
          : logo + '<p class="MER-HINT">Activez votre compte TRIGONE pour recevoir ici les demandes validées et les comptes-rendus de mission.</p><button type="button" class="BTN BTN-PRIMARY" onclick="JUMELAGE_COMPTE()">Se connecter à TRIGONE</button>') +
        '</div>' + (!pc && accueil ? '<button type="button" class="BTN BTN-SECONDARY" onclick="MER_RESULTATS_VERIF = null; JUMELAGE_CHOIX()">← Écran de choix</button>' : '');
}
// ===================== REGISTRE OMR (assistant Chorus DT) =====================
// Onglet « Mises en route » : une ligne par demande validée reçue, dans l'ordre des n° OMR (date d'envoi, objet, code FD,
// dates de mission, personnel, échéance du compte-rendu = fin de mission + 30 jours, marquant d'état) ; relance ou
// message au(x) missionnaire(s) ; suppression (mission annulée). Onglet « Comptes-rendus » : les lignes dont le
// compte-rendu est rendu, avec les montants déclarés et le total. PDF de chaque onglet. Nouvelle série de numéros.
var MER_REGISTRE_ONGLET = 'tout', MER_REGISTRE_DELAI = 30, MER_REGISTRE_MINUTEUR = null, MER_REGISTRE_PLEIN = false;
// Filtres libres du registre : texte (n° OMR, objet, personnel, code FD, libellé), code de l'unité ou non, période (début de mission).
var MER_REGISTRE_CRIT = { texte: '', code: '', du: '', au: '' }, MER_REGISTRE_CRIT_MINUTEUR = null;
function MER_OMR_COMPARER(a, b) {
    if (!a.omr !== !b.omr) return a.omr ? -1 : 1;
    return String(a.omr || '').localeCompare(String(b.omr || ''), 'fr', { numeric: true }) || (a.recuLe || 0) - (b.recuLe || 0);
}
function MER_REG_JOUR(v) { if (!v) return '—'; var d = new Date(v); return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR'); }
function MER_REG_ECHEANCE(x) { if (!x.fin) return null; var d = new Date(x.fin); if (isNaN(d)) return null; d.setDate(d.getDate() + MER_REGISTRE_DELAI); return d; }
// Nature de l'OMR : individuel (une personne) ou collectif (plusieurs), et international (pays étranger à l'arrivée).
function MER_REG_NATURE(x) {
    var n = (x.personnes || []).length;
    return { collectif: n > 1, n: n, pays: x.pays && !/^FRANCE$/i.test(x.pays) ? x.pays : '' };
}
function MER_REG_NATURE_HTML(x) {
    var t = MER_REG_NATURE(x);
    return '<span class="MER-REG-NAT ' + (t.collectif ? 'coll' : 'indiv') + '">' + (t.collectif ? 'COLLECTIF · ' + t.n : 'INDIVIDUEL') + '</span>' +
        (t.pays ? '<span class="MER-REG-NAT inter">🌍 INTERNATIONAL · ' + ESC(t.pays.toUpperCase()) + '</span>' : '');
}
function MER_REG_NATURE_TXT(x) { var t = MER_REG_NATURE(x); return (t.collectif ? 'COLLECTIF (' + t.n + ')' : 'INDIVIDUEL') + (t.pays ? ' · INTERNATIONAL (' + t.pays.toUpperCase() + ')' : ''); }
// Personnel d'une mission collective : un nom par ligne (plus lisible qu'une suite séparée par des virgules).
// Registre : chaque nom est un bouton qui ouvre le recto de sa carte TRIGONE (pas de verso, pas de QR code).
function MER_REG_PERSONNEL_HTML(x) {
    var l = (x.personnes || []).map(function(p) { return [p.grade, (p.nom || '').toUpperCase(), p.prenom].filter(Boolean).join(' '); });
    if (!l.length) return ESC(MER_REG_PERSONNEL(x));
    var ref = ESC(x.ref).replace(/'/g, ''), nom = function(n, i) { return x.sansDemande ? ESC(n) : '<button type="button" class="MER-REG-NOM" onclick="MER_REG_CARTE(\'' + ref + '\', ' + i + ')" title="Voir sa carte TRIGONE">🪪 ' + ESC(n) + '</button>'; };
    if (l.length < 2) return nom(l[0], 0);
    return '<ol class="MER-REG-PERS">' + l.map(function(n, i) { return '<li>' + nom(n, i) + '</li>'; }).join('') + '</ol>';
}
function MER_REG_CARTE(ref, i) {
    var x = REGISTRE_LIGNE(ref); if (!x || !window.JUMELAGE_CARTE_RECTO) return;
    JUMELAGE_CARTE_RECTO({ mailDemandeur: x.mailDemandeur || '', personnes: (x.personnes || []).map(function(p) { return { grade: p.grade, nom: p.nom, prenom: p.prenom, matricule: p.nid }; }) }, i);
}
function MER_REG_PERSONNEL(x) { return (x.personnes || []).map(function(p) { return [p.grade, (p.nom || '').toUpperCase(), p.prenom].filter(Boolean).join(' '); }).join(', ') || (x.crs && x.crs[0] ? x.crs[0].noms : '—'); }
// Comptes-rendus attendus : un par personne de la demande (mission collective : le chef et chaque participant).
function MER_REG_ATTENDUS(x) { return Math.max(1, (x.personnes || []).length); }
function MER_REG_RENDU(x) { return x.sansDemande || (x.crs || []).length >= MER_REG_ATTENDUS(x); }
// Étape de la mission, ligne par ligne : à venir → en cours → CR attendu (ou en retard) → validé, CR rendu.
function MER_REG_DATE(v, finJour) { if (!v) return null; var d = new Date(v); if (isNaN(d)) return null; if (finJour && !d.getHours() && !d.getMinutes()) d.setHours(23, 59, 59); return d; }
// Heures réelles envoyées par le missionnaire depuis Compte-rendu (« 10/10/2026 07:42:00 ») : x.jalons.depart, surSite,
// departSite, retour. Date, ou null.
function MER_REG_JALON(x, k) {
    var v = (x.jalons || {})[k], m = /^(\d{2})\/(\d{2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})/.exec(String(v || ''));
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null;
}
function MER_REG_QUAND(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' à ' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2); }
function MER_REG_ETAT(x) {
    var n = (x.crs || []).length, att = MER_REG_ATTENDUS(x);
    if (MER_REG_RENDU(x)) return { cls: 'ok', txt: '✔ Validé — CR rendu' + (n > 1 ? 's' : '') };
    var ech = MER_REG_ECHEANCE(x), maint = new Date(), deb = MER_REG_DATE(x.debut), fin = MER_REG_DATE(x.fin, true);
    var part = n ? ' · ' + n + '/' + att + ' CR' : '';
    // Heures réelles d'abord : parti mais pas rentré = en cours, quelles que soient les dates prévues.
    var dr = MER_REG_JALON(x, 'depart'), rr = MER_REG_JALON(x, 'retour'), sr = MER_REG_JALON(x, 'surSite'), qr = MER_REG_JALON(x, 'departSite');
    if (dr && !rr) return { cls: 'encours', txt: (qr ? 'Retour en route · parti du site le ' + MER_REG_QUAND(qr) : sr ? 'Sur site depuis le ' + MER_REG_QUAND(sr) : 'Mission en cours · parti le ' + MER_REG_QUAND(dr)) + part };
    if (rr) {
        if (ech && maint > ech) return { cls: 'retard', txt: '⚠ En retard (depuis le ' + ech.toLocaleDateString('fr-FR') + ')' + part };
        return { cls: 'attente', txt: 'Rentré le ' + MER_REG_QUAND(rr) + ' · CR attendu' + (ech ? ' avant le ' + ech.toLocaleDateString('fr-FR') : '') + part };
    }
    if (deb && maint < deb) return { cls: 'avenir', txt: 'Mission à venir · départ le ' + deb.toLocaleDateString('fr-FR') + part };
    if (fin && maint <= fin) return { cls: 'encours', txt: 'Mission en cours · retour le ' + fin.toLocaleDateString('fr-FR') + part };
    if (ech && maint > ech) return { cls: 'retard', txt: '⚠ En retard (depuis le ' + ech.toLocaleDateString('fr-FR') + ')' + part };
    return { cls: 'attente', txt: 'Mission terminée · CR attendu' + (ech ? ' avant le ' + ech.toLocaleDateString('fr-FR') : '') + part };
}
// Frise de la ligne : demande validée, départ, retour, compte-rendu rendu.
// Avec les heures réelles du missionnaire (Compte-rendu) : départ, sur site, retour suivent ses appuis, heure affichée.
// Sans elles : départ et retour suivent les dates prévues de la demande.
function MER_REG_FRISE(x, e) {
    var maint = new Date(), deb = MER_REG_DATE(x.debut), fin = MER_REG_DATE(x.fin, true), ok = e.cls === 'ok';
    var J = { depart: MER_REG_JALON(x, 'depart'), surSite: MER_REG_JALON(x, 'surSite'), departSite: MER_REG_JALON(x, 'departSite'), retour: MER_REG_JALON(x, 'retour') }, reel = !!J.depart;
    var etapes = reel ? [['Demande validée', true], ['Départ', true, J.depart], ['Sur site', !!(J.surSite || J.departSite || J.retour) || ok, J.surSite], ['Retour', !!J.retour || ok, J.retour], ['CR rendu', ok]]
        : [['Demande validée', true], ['Départ', ok || (deb && maint >= deb)], ['Sur site', ok || (deb && maint >= deb)], ['Retour', ok || (fin && maint > fin)], ['CR rendu', ok]];
    var courante = -1; etapes.forEach(function(t, i) { if (t[1]) courante = i; });
    return '<div class="MER-REG-FRISE ' + e.cls + (reel ? ' reel' : '') + '"' + (reel ? '' : ' title="Départ et retour d\'après les dates prévues de la demande"') + '>' + etapes.map(function(t, i) {
        return '<span class="' + (t[1] ? 'fait' : '') + (i === courante ? ' ici' : '') + '"><i></i>' + t[0] + (t[2] ? '<em>' + MER_REG_QUAND(t[2]).replace(' à ', '<br>') + '</em>' : '') + '</span>';
    }).join('') + '</div>' + (reel ? '' : (e.cls === 'encours' ? '<p class="MER-HINT MER-REG-PREVU">Étapes d\'après les dates prévues : le missionnaire n\'a pas encore horodaté sa mission dans Compte-rendu.</p>' : ''));
}
// Montants d'une ligne : somme de ses comptes-rendus, puis corrections de l'assistant Chorus DT (x.corriges, communes à
// tous les assistants ; le total est alors recalculé). brut : montants des comptes-rendus, sans les corrections.
var MER_REG_RUBRIQUES = [['repas', 'Repas'], ['hebergement', 'Hébergement'], ['transports', 'Transports'], ['ik', 'IK'], ['tc', 'Transp. commun']];
function MER_REG_MONTANTS(x, brut) {
    var t = { repas: 0, hebergement: 0, transports: 0, ik: 0, tc: 0, total: 0 };
    (x.crs || []).forEach(function(c) { var m = c.montants || {}; Object.keys(t).forEach(function(k) { t[k] += parseFloat(m[k]) || 0; }); });
    var corr = brut ? [] : MER_REG_CORRIGES(x);
    corr.forEach(function(k) { t[k] = parseFloat(x.corriges[k]) || 0; });
    if (corr.length) t.total = MER_REG_RUBRIQUES.reduce(function(a, r) { return a + t[r[0]]; }, 0);
    Object.keys(t).forEach(function(k) { t[k] = Math.round(t[k] * 100) / 100; });
    return t;
}
function MER_REG_CORRIGES(x) {
    var c = x.corriges || {};
    return MER_REG_RUBRIQUES.map(function(r) { return r[0]; }).filter(function(k) { return c[k] != null && c[k] !== '' && !isNaN(parseFloat(c[k])); });
}
// Registre commun aux assistants Chorus DT : qui a reçu la demande et le(s) compte(s)-rendu(s).
function MER_REG_RECU_PAR(x) {
    var t = [];
    if (x.recuPar) t.push('Demande reçue par ' + ESC(x.recuPar));
    var crPar = Array.from(new Set((x.crs || []).map(function(c) { return c.recuPar; }).filter(Boolean)));
    if (crPar.length) t.push('CR reçu par ' + crPar.map(ESC).join(', '));
    return t.length ? '<p class="MER-HINT MER-REG-PAR" style="margin:4px 0 0;">👤 ' + t.join(' · ') + '</p>' : '';
}
function MER_EUROS(v) { return (Math.round((v || 0) * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
// Un seul registre, toutes les missions ligne par ligne ; les filtres ne font que trier ce qu'on regarde.
var MER_REG_FILTRES = [['tout', 'Toutes'], ['avenir', 'À venir'], ['encours', 'En cours'], ['attente', 'CR attendu'], ['retard', 'En retard'], ['ok', 'CR rendus']];
function MER_REGISTRE_LIGNES() {
    var l = (window.JUMELAGE_REGISTRE ? JUMELAGE_REGISTRE() : []).slice().sort(MER_OMR_COMPARER);
    return { tout: l, mer: l.filter(function(x) { return !MER_REG_RENDU(x); }), cr: l.filter(MER_REG_RENDU) };
}
function MER_REG_CRIT_ACTIF() { var c = MER_REGISTRE_CRIT; return !!(c.texte.trim() || c.code || c.du || c.au); }
function MER_REG_CRIT_OK(x) {
    var c = MER_REGISTRE_CRIT, mots = c.texte.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
    if (mots.length) {
        var e = MER_CODIER && MER_CODIER[String(x.codeFD || '').toUpperCase()];
        var tas = [x.omr, x.objet, x.codeFD, e && e.lib, MER_REG_PERSONNEL(x), MER_REG_ETAT(x).txt, x.recuPar, x.sansDemande ? '' : MER_REG_NATURE_TXT(x)].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!mots.every(function(w) { return tas.indexOf(w) >= 0; })) return false;
    }
    if (c.code && MER_CODE_UNITE(x.codeFD) !== c.code) return false;
    var d = String(x.debut || '').slice(0, 10);
    if (c.du && (!d || d < c.du)) return false;
    if (c.au && (!d || d > c.au)) return false;
    return true;
}
// avecCrit : filtres libres appliqués (tableau affiché, PDF) ; sans : toutes les lignes (bouton d'entrée du registre).
function MER_REGISTRE_FILTRES(avecCrit) {
    var l = MER_REGISTRE_LIGNES().tout;
    if (avecCrit && MER_REG_CRIT_ACTIF()) l = l.filter(MER_REG_CRIT_OK);
    var r = { tout: l };
    MER_REG_FILTRES.slice(1).forEach(function(f) { r[f[0]] = l.filter(function(x) { return MER_REG_ETAT(x).cls === f[0]; }); });
    return r;
}
function OUVRIR_REGISTRE(filtre) {
    if (filtre === 'mer' || filtre === 'cr') filtre = filtre === 'cr' ? 'ok' : 'tout';   // anciens onglets
    MER_REGISTRE_ONGLET = filtre && MER_REG_FILTRES.some(function(f) { return f[0] === filtre; }) ? filtre : (MER_REGISTRE_ONGLET === 'mer' ? 'tout' : MER_REGISTRE_ONGLET);
    MER_DOSSIER.CHORUS = 'registre'; SHOW_PAGE('CHORUS'); window.scrollTo(0, 0);
    if (window.JUMELAGE_REGISTRE_SYNCHRO) JUMELAGE_REGISTRE_SYNCHRO();   // changements faits par les autres assistants
    // Tant que le registre est à l'écran : relevé toutes les 30 s (une ligne ou un CR reçu par un autre assistant apparaît tout seul).
    if (!MER_REGISTRE_MINUTEUR) MER_REGISTRE_MINUTEUR = setInterval(function() {
        if (PAGE_ACTUELLE !== 'CHORUS' || MER_DOSSIER.CHORUS !== 'registre') { clearInterval(MER_REGISTRE_MINUTEUR); MER_REGISTRE_MINUTEUR = null; return; }
        if (document.visibilityState === 'visible' && window.JUMELAGE_REGISTRE_SYNCHRO) JUMELAGE_REGISTRE_SYNCHRO();
    }, 30000);
}
function TPL_BOUTON_REGISTRE() {
    var f = MER_REGISTRE_FILTRES(), n = f.tout.length;
    var morceaux = [n + ' mission' + (n > 1 ? 's' : '')];
    if (f.encours.length) morceaux.push(f.encours.length + ' en cours');
    if (f.attente.length) morceaux.push(f.attente.length + ' CR attendu' + (f.attente.length > 1 ? 's' : ''));
    if (f.ok.length) morceaux.push(f.ok.length + ' CR rendu' + (f.ok.length > 1 ? 's' : ''));
    return '<button type="button" class="MER-REG-ENTREE" onclick="OUVRIR_REGISTRE(\'tout\')"><span class="MER-REG-ENTREE-IC">📋</span><span><b>Registre des OMR</b>' +
        '<small>' + morceaux.join(' · ') + (f.retard.length ? ' · <span class="MER-DOSSIER-ATT">' + f.retard.length + ' en retard</span>' : '') + '</small></span><span class="MER-DOSSIER-CHEV">›</span></button>';
}
function TPL_REGISTRE() {
    if (!MER_CODIER) CHARGER_CODIER().then(function(c) { if (c && PAGE_ACTUELLE === 'CHORUS' && MER_DOSSIER.CHORUS === 'registre') MER_REG_REAFFICHER(); });
    var f = MER_REGISTRE_FILTRES(true), filtre = MER_REGISTRE_ONGLET in f ? MER_REGISTRE_ONGLET : 'tout', l = f[filtre];
    var puce = function(c) { return '<button type="button" class="MER-REG-FILTRE ' + c[0] + (filtre === c[0] ? ' actif' : '') + '" onclick="OUVRIR_REGISTRE(\'' + c[0] + '\')">' + c[1] + ' <span>' + f[c[0]].length + '</span></button>'; };
    var lignes = l.map(function(x) {
        var e = MER_REG_ETAT(x), m = MER_REG_MONTANTS(x), brut = MER_REG_MONTANTS(x, true), corr = MER_REG_CORRIGES(x), ref = ESC(x.ref).replace(/'/g, ''), rendu = e.cls === 'ok', ech = MER_REG_ECHEANCE(x);
        var tete = '<div class="MER-REG-TETE"><span class="MER-REG-TETE-G"><b class="MER-REG-OMR">' + (x.omr ? 'N°' + ESC(x.omr) : 'Sans n°') + '</b>' + (x.sansDemande ? '' : MER_REG_NATURE_HTML(x)) + '</span><span class="MER-REG-MARQ ' + e.cls + '">' + e.txt + '</span></div>';
        var corps = '<div class="MER-REG-GRILLE mer"><span><small>Envoyée le</small>' + MER_REG_JOUR(x.omrLe || x.recuLe) + '</span><span class="large"><small>Objet</small>' + ESC(x.objet || '—') + '</span>' +
                '<span><small>Code FD</small>' + (function() { var u = MER_CODE_UNITE(x.codeFD); return u ? '<em class="MER-REG-CODE ' + u + '" title="' + (u === 'unite' ? 'Code du ' : 'Hors ') + ESC(MER_UNITE().nom) + '">' + ESC(x.codeFD) + '</em>' : ESC(x.codeFD || '—'); })() + '</span><span><small>Début</small>' + MER_REG_JOUR(x.debut) + '</span><span><small>Fin</small>' + MER_REG_JOUR(x.fin) + '</span>' +
                '<span class="large"><small>Personnel' + ((x.personnes || []).length > 1 ? ' (' + x.personnes.length + ')' : '') + '</small>' + MER_REG_PERSONNEL_HTML(x) + '</span>' +
                (rendu ? '<span><small>CR rendu le</small>' + MER_REG_JOUR((x.crs || []).map(function(c) { return c.recuLe; }).sort().slice(-1)[0]) + '</span>'
                    : '<span><small>CR attendu le</small>' + (ech ? ech.toLocaleDateString('fr-FR') : '—') + '</span>') + '</div>' +
            ((x.crs || []).length ? '<div class="MER-REG-GRILLE montants">' + MER_REG_RUBRIQUES.map(function(r) {
                    var c = corr.indexOf(r[0]) >= 0;
                    return '<span' + (c ? ' class="corrige" title="Corrigé — montant du compte-rendu : ' + MER_EUROS(brut[r[0]]) + '"' : '') + '><small>' + r[1] + (c ? ' ✏' : '') + '</small>' + MER_EUROS(m[r[0]]) + '</span>';
                }).join('') + '<span class="total' + (corr.length ? ' corrige' : '') + '"><small>Total' + (corr.length ? ' ✏' : '') + '</small>' + MER_EUROS(m.total) + '</span></div>' : '') +
            (corr.length ? '<p class="MER-HINT MER-REG-CORR" style="margin:4px 0 0;">✏ Montants corrigés' + (x.corrigesPar ? ' par ' + ESC(x.corrigesPar) : '') + (x.corrigesLe ? ' le ' + MER_REG_JOUR(x.corrigesLe) : '') +
                ' (compte-rendu : ' + corr.map(function(k) { return MER_REG_RUBRIQUES.filter(function(r) { return r[0] === k; })[0][1].toLowerCase() + ' ' + MER_EUROS(brut[k]); }).join(', ') + ')</p>' : '') +
            MER_REG_RECU_PAR(x) + MER_REG_OBS_HTML(x, ref) +
            ((x.relances || []).length && !rendu ? '<p class="MER-HINT" style="margin:4px 0 0;">🔔 Relancé le ' + x.relances.map(function(t) { var q = (x.relancesQui || {})[t]; return MER_REG_JOUR(t) + (q ? ' (par ' + ESC(q) + ')' : ''); }).join(', ') + '</p>' : '') +
            (rendu ? '<div class="MER-REG-ACTIONS">' + (x.sansDemande ? '' : '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MER_PARTICIPANTS_REG(\'' + ref + '\')">👥 Participants</button>') + ((x.crs || []).length ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="REGISTRE_CORRIGER(\'' + ref + '\')">✏ Corriger les montants</button>' : '') + '</div>' :
                '<div class="MER-REG-ACTIONS">' + (x.sansDemande ? '' : '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MER_PARTICIPANTS_REG(\'' + ref + '\')">👥 Participants</button>') + ((x.crs || []).length ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="REGISTRE_CORRIGER(\'' + ref + '\')">✏ Corriger les montants</button>' : '') + (e.cls === 'attente' || e.cls === 'retard' ? '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="REGISTRE_RELANCER(\'' + ref + '\')">🔔 Relancer pour le CR</button>' : '') +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="REGISTRE_MESSAGE(\'' + ref + '\', false)">✉ Message</button>' +
                '<button type="button" class="BTN-DANGER-TEXT" onclick="REGISTRE_SUPPRIMER(\'' + ref + '\')">Supprimer</button></div>');
        return '<div class="MER-REG-LIGNE ' + e.cls + '">' + tete + MER_REG_FRISE(x, e) + corps + '</div>';
    }).join('');
    var avecMontants = l.filter(function(x) { return (x.crs || []).length; }), vide0 = '';
    var tot = avecMontants.reduce(function(a, x) { var m = MER_REG_MONTANTS(x); Object.keys(a).forEach(function(k) { a[k] += m[k]; }); return a; }, { repas: 0, hebergement: 0, transports: 0, ik: 0, tc: 0, total: 0 });
    if (MER_REG_CRIT_ACTIF() && !l.length) vide0 = 'Aucune mission ne correspond aux filtres.';
    var vide = { tout: 'Aucune mission dans le registre pour l\'instant.', avenir: 'Aucune mission à venir.', encours: 'Aucune mission en cours.', attente: 'Aucun compte-rendu attendu.', retard: 'Aucun compte-rendu en retard.', ok: 'Aucun compte-rendu rendu pour l\'instant.' }[filtre];
    return '<div class="MER-REG-ZONE' + (MER_REGISTRE_PLEIN ? ' plein' : '') + '"><div class="MER-DOSSIER-TETE"><button type="button" class="MER-DOSSIER-RETOUR" onclick="' + (MER_REGISTRE_PLEIN ? 'REGISTRE_PLEIN(false); ' : '') + 'OUVRIR_DOSSIER(\'CHORUS\', null)">‹ Dossiers</button><span class="MER-REG-ENTREE-IC petit">📋</span><b>Registre des OMR</b>' +
        '<button type="button" class="MER-REG-PLEIN-BTN" onclick="REGISTRE_PLEIN(' + !MER_REGISTRE_PLEIN + ')">' + (MER_REGISTRE_PLEIN ? '✕ Quitter le plein écran' : '⛶ Plein écran') + '</button></div>' +
        '<div class="MER-REG-FILTRES">' + MER_REG_FILTRES.map(puce).join('') + '</div>' + MER_REG_BARRE() +
        (f.retard.length ? (function(n) { return '<div class="MER-REG-RELANCE"><span>⚠ ' + f.retard.length + ' compte' + (f.retard.length > 1 ? 's' : '') + '-rendu' + (f.retard.length > 1 ? 's' : '') + ' en retard' + (n < f.retard.length ? ' (' + (f.retard.length - n) + ' déjà relancé' + (f.retard.length - n > 1 ? 's' : '') + ' aujourd\'hui)' : '') + '</span>' +
            '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="REGISTRE_RELANCER_RETARDS()"' + (n ? '' : ' disabled') + '>🔔 ' + (n ? 'Relancer les ' + n + ' en retard' : 'Tous relancés') + '</button></div>'; })(REGISTRE_A_RELANCER(f.retard).length) : '') +
        '<p class="MER-HINT" style="margin:0 0 10px;">Registre commun à tous les assistants Chorus DT de l\'unité : chaque mission, dans l\'ordre des n° OMR, avec son étape (à venir, en cours, compte-rendu attendu au plus tard ' + MER_REGISTRE_DELAI + ' jours après la fin, en retard, validé). Il se met à jour tout seul toutes les 30 secondes ; « ✏ Corriger les montants » si un montant est faux.</p>' +
        (lignes || '<div class="MER-EMPTY">' + (vide0 || vide) + '</div>') +
        (avecMontants.length ? '<div class="MER-REG-TOTAL"><span>Total des ' + avecMontants.length + ' compte' + (avecMontants.length > 1 ? 's' : '') + '-rendu' + (avecMontants.length > 1 ? 's' : '') + ' de cette liste</span><b>' + MER_EUROS(tot.total) + '</b>' +
            '<div class="MER-REG-GRILLE montants MER-REG-SOMMES">' + [['Repas', 'repas'], ['Hébergement', 'hebergement'], ['Transports', 'transports'], ['IK', 'ik'], ['Transp. commun', 'tc'], ['Total', 'total']].map(function(c) {
                return '<span' + (c[1] === 'total' ? ' class="total"' : '') + '><small>' + c[0] + '</small>' + MER_EUROS(Math.round(tot[c[1]] * 100) / 100) + '</span>'; }).join('') + '</div></div>' : '') +
        '<div class="MER-REG-PIED"><button type="button" class="BTN BTN-PRIMARY" onclick="REGISTRE_PDF()"' + (l.length ? '' : ' disabled') + '>📄 PDF de cette liste</button>' +
        '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="REGISTRE_SERIE()">🔢 Numérotation OMR (nouvelle série)</button>' +
        '<button type="button" class="BTN-DANGER-TEXT" onclick="REGISTRE_VIDER()">🗑 Tout effacer et repartir à 0001</button></div></div>';
}
function MER_REG_BARRE() {
    var c = MER_REGISTRE_CRIT, u = MER_UNITE(), nomU = u ? ESC(u.nom) : 'mon unité';
    return '<div class="MER-REG-BARRE">' +
        '<input type="search" id="MER-REG-CHERCHE" placeholder="🔍 Rechercher : n° OMR, objet, nom, code FD…" value="' + ESC(c.texte) + '" oninput="MER_REG_CRIT(\'texte\', this.value, true)" autocomplete="off">' +
        '<select id="MER-REG-CODE-F" onchange="MER_REG_CRIT(\'code\', this.value)"' + (u ? '' : ' disabled title="Indiquez votre unité dans Paramètres › Profil"') + '>' +
            '<option value="">Tous les codes FD</option><option value="unite"' + (c.code === 'unite' ? ' selected' : '') + '>● Codes du ' + nomU + '</option><option value="hors"' + (c.code === 'hors' ? ' selected' : '') + '>● Hors ' + nomU + '</option></select>' +
        '<label>Du <input type="date" id="MER-REG-DU" value="' + ESC(c.du) + '" onchange="MER_REG_CRIT(\'du\', this.value)"></label>' +
        '<label>au <input type="date" id="MER-REG-AU" value="' + ESC(c.au) + '" onchange="MER_REG_CRIT(\'au\', this.value)"></label>' +
        (MER_REG_CRIT_ACTIF() ? '<button type="button" class="BTN-DANGER-TEXT" onclick="MER_REG_CRIT()">✕ Effacer les filtres</button>' : '') + '</div>';
}
// Filtre changé : tableau réaffiché (après une courte pause pendant la frappe), la recherche garde le curseur.
function MER_REG_CRIT(k, v, frappe) {
    if (!k) MER_REGISTRE_CRIT = { texte: '', code: '', du: '', au: '' }; else MER_REGISTRE_CRIT[k] = v || '';
    clearTimeout(MER_REGISTRE_CRIT_MINUTEUR);
    MER_REGISTRE_CRIT_MINUTEUR = setTimeout(function() {
        var a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
        MER_REG_REAFFICHER();
        var b = id && document.getElementById(id);
        if (b && id === 'MER-REG-CHERCHE') { b.focus(); try { b.setSelectionRange(pos, pos); } catch (e) {} }
    }, frappe ? 300 : 0);
}
// Page Chorus DT réaffichée sans perdre l'endroit où l'on était (page, ou registre en plein écran).
function MER_REG_REAFFICHER() {
    var y = window.scrollY, z = document.querySelector('.MER-REG-ZONE.plein'), zy = z ? z.scrollTop : 0;
    SHOW_PAGE('CHORUS'); window.scrollTo(0, y);
    var z2 = document.querySelector('.MER-REG-ZONE.plein'); if (z2) z2.scrollTop = zy;
}
// Registre en plein écran (tableau seul, sur tout l'écran ; vrai plein écran quand l'appareil le permet).
function REGISTRE_PLEIN(oui) {
    MER_REGISTRE_PLEIN = !!oui;
    var d = document, el = d.documentElement;
    try {
        if (oui && !d.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function() {});
        if (!oui && d.fullscreenElement && d.exitFullscreen) d.exitFullscreen().catch(function() {});
    } catch (e) {}
    if (PAGE_ACTUELLE === 'CHORUS' && MER_DOSSIER.CHORUS === 'registre') SHOW_PAGE('CHORUS');
}
document.addEventListener('fullscreenchange', function() {
    // Sortie du plein écran par la touche Échap ou le geste du téléphone : le registre reprend sa place.
    if (!document.fullscreenElement && MER_REGISTRE_PLEIN) REGISTRE_PLEIN(false);
});
// Correction des montants d'une ligne par l'assistant Chorus DT (erreur de saisie, justificatif manquant…) :
// enregistrée dans le registre commun, visible par tous les assistants ; le total et le PDF en tiennent compte.
function REGISTRE_CORRIGER(ref) {
    var x = REGISTRE_LIGNE(ref); if (!x) return;
    var m = MER_REG_MONTANTS(x), brut = MER_REG_MONTANTS(x, true), corr = MER_REG_CORRIGES(x);
    AFFICHER_MODALE('Corriger les montants',
        '<p style="font-size:0.86em; line-height:1.5;">' + (x.omr ? '<b>OMR N°' + ESC(x.omr) + '</b> — ' : '') + ESC(x.objet || '') + '</p>' +
        '<div class="MER-REG-CORR-GRILLE">' + MER_REG_RUBRIQUES.map(function(r) {
            return '<div class="MER-FIELD"><label for="MER-CORR-' + r[0] + '">' + r[1] + '</label><input type="text" inputmode="decimal" id="MER-CORR-' + r[0] + '" data-k="' + r[0] + '" value="' + String(m[r[0]].toFixed(2)).replace('.', ',') + '" oninput="REGISTRE_CORRIGER_TOTAL()">' +
                '<small class="MER-HINT">Compte-rendu : ' + MER_EUROS(brut[r[0]]) + '</small></div>';
        }).join('') + '</div>' +
        '<div class="MER-REG-TOTAL" style="margin-top:10px;"><span>Total corrigé</span><b id="MER-CORR-TOTAL">' + MER_EUROS(m.total) + '</b></div>' +
        '<p class="MER-HINT">La correction est faite pour tous les assistants Chorus DT de l\'unité. Le total de la ligne, celui du bas du registre et le PDF en tiennent compte. Le compte-rendu reçu n\'est pas modifié.</p>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button>' +
        (corr.length ? '<button type="button" class="BTN BTN-GHOST" onclick="REGISTRE_CORRIGER_OK(\'' + ESC(ref).replace(/'/g, '') + '\', true)">Revenir aux montants du CR</button>' : '') +
        '<button type="button" class="BTN BTN-PRIMARY" id="MER-CORR-GO" onclick="REGISTRE_CORRIGER_OK(\'' + ESC(ref).replace(/'/g, '') + '\')">Enregistrer</button>');
}
function REGISTRE_CORRIGER_VAL(k) {
    var el = document.getElementById('MER-CORR-' + k); if (!el) return NaN;
    var v = el.value.replace(/\s|€/g, '').replace(',', '.');
    return v === '' ? 0 : parseFloat(v);
}
function REGISTRE_CORRIGER_TOTAL() {
    var t = 0, ok = true;
    MER_REG_RUBRIQUES.forEach(function(r) { var v = REGISTRE_CORRIGER_VAL(r[0]); if (isNaN(v) || v < 0) ok = false; else t += v; });
    var z = document.getElementById('MER-CORR-TOTAL'); if (z) z.textContent = ok ? MER_EUROS(Math.round(t * 100) / 100) : 'montant à vérifier';
    var b = document.getElementById('MER-CORR-GO'); if (b) b.disabled = !ok;
}
function REGISTRE_CORRIGER_OK(ref, annuler) {
    var x = REGISTRE_LIGNE(ref); if (!x) return;
    var brut = MER_REG_MONTANTS(x, true), c = {};
    if (!annuler) {
        var mauvais = MER_REG_RUBRIQUES.filter(function(r) { var v = REGISTRE_CORRIGER_VAL(r[0]); return isNaN(v) || v < 0; });
        if (mauvais.length) { MSG_ERREUR('Montant à vérifier', mauvais.map(function(r) { return r[1]; }).join(', ') + ' : indiquez un montant en euros (ex. 45,50).'); return; }
        MER_REG_RUBRIQUES.forEach(function(r) { var v = Math.round(REGISTRE_CORRIGER_VAL(r[0]) * 100) / 100; if (Math.abs(v - brut[r[0]]) > 0.004) c[r[0]] = v; });
    }
    // Objet vide (et non retiré) : le serveur garde sinon l'ancienne correction en fusionnant les versions.
    JUMELAGE_REGISTRE_MAJ(ref, { corriges: c, corrigesPar: Object.keys(c).length ? (window.JUMELAGE_QUI ? JUMELAGE_QUI() : '') || 'ASSIST CHORUS DT' : '', corrigesLe: Object.keys(c).length ? Date.now() : 0 });
    FERMER_MODALE(); MER_REG_REAFFICHER();
}
// ---- Fenêtre « Participants » : la carte TRIGONE de chaque personne de la demande (photo chiffrée si partagée) ----
function MER_PARTICIPANTS_DEMANDE(d, mailDemandeur) {
    if (!d || !window.JUMELAGE_PARTICIPANTS_OUVRIR) return;
    var a = (d.trajets || {}).aller || {}, r = (d.trajets || {}).retour || {}, jour = function(v) { return v ? new Date(v).toLocaleDateString('fr-FR') : ''; };
    var x = { personnes: d.personnes || [], pays: a.paysArr || '' };
    JUMELAGE_PARTICIPANTS_OUVRIR({
        titre: (d.omr ? 'OMR N°' + d.omr + ' — ' : '') + (d.objet || 'Demande de mise en route'),
        sous: [jour(a.dateDep) && jour(r.dateArr) ? 'Du ' + jour(a.dateDep) + ' au ' + jour(r.dateArr) : ''].filter(Boolean).join(''),
        badges: MER_REG_NATURE_HTML(x), collectif: (d.personnes || []).length > 1, mailDemandeur: mailDemandeur || d.mailDemandeur || '',
        personnes: d.personnes || [],
        lignes: [['Objet', d.objet], ['Type', d.type === 'FORMATION' ? 'Formation / stage' : 'Mission'], ['N° OMR', d.omr], ['Départ', [a.lieuDep, jour(a.dateDep)].filter(Boolean).join(' · ')],
            ['Destination', [a.lieuArr, a.paysArr].filter(Boolean).join(', ')], ['Retour', jour(r.dateArr)], ['Code FD', d.codeFD], ['Nature', MER_REG_NATURE_TXT(x)]]
    });
}
function MER_PARTICIPANTS_VAL(id) { var e = GET_A_VALIDER().filter(function(x) { return x.id === id; })[0]; if (e) MER_PARTICIPANTS_DEMANDE(e.d); }
function MER_PARTICIPANTS_VERIF(i) { var x = (MER_RESULTATS_VERIF || [])[i]; if (x) MER_PARTICIPANTS_DEMANDE(x.d); }
function MER_PARTICIPANTS_BIB(id, k) { var e = GET_BIBLIOTHEQUE().filter(function(x) { return x.id === id; })[0]; if (e) MER_PARTICIPANTS_DEMANDE(e.demandes[k || 0], window.JUMELAGE_COMPTE_MAIL ? JUMELAGE_COMPTE_MAIL() : ''); }
function MER_PARTICIPANTS_REG(ref) {
    var x = REGISTRE_LIGNE(ref); if (!x || !window.JUMELAGE_PARTICIPANTS_OUVRIR) return;
    var t = MER_REG_NATURE(x);
    JUMELAGE_PARTICIPANTS_OUVRIR({
        titre: (x.omr ? 'OMR N°' + x.omr + ' — ' : '') + (x.objet || ''), sous: 'Du ' + MER_REG_JOUR(x.debut) + ' au ' + MER_REG_JOUR(x.fin),
        badges: MER_REG_NATURE_HTML(x), collectif: t.collectif, mailDemandeur: x.mailDemandeur || '',
        personnes: (x.personnes || []).map(function(p) { return { grade: p.grade, nom: p.nom, prenom: p.prenom, matricule: p.nid }; }),
        lignes: [['Objet', x.objet], ['N° OMR', x.omr], ['Début', MER_REG_JOUR(x.debut)], ['Fin', MER_REG_JOUR(x.fin)], ['Code FD', x.codeFD], ['Nature', MER_REG_NATURE_TXT(x)], ['Étape', MER_REG_ETAT(x).txt]]
    });
}
// Observations d'une ligne d'OMR : notes des assistants Chorus DT, partagées (qui a écrit, quand, qui a modifié).
// { id, texte, par, le, modifPar, modifLe, supprime }
function MER_REG_OBS(x) { return (x.observations || []).filter(function(o) { return o && !o.supprime && o.texte; }).sort(function(a, b) { return (a.le || 0) - (b.le || 0); }); }
function MER_REG_OBS_HTML(x, ref) {
    var l = MER_REG_OBS(x), d = l[l.length - 1];
    return '<button type="button" class="MER-REG-OBS' + (l.length ? ' plein' : '') + '" onclick="REGISTRE_OBS(\'' + ref + '\')"><b>📝 Observations' + (l.length ? ' (' + l.length + ')' : '') + '</b>' +
        (d ? '<span>' + ESC(d.modifPar || d.par || '') + ' · ' + MER_REG_JOUR(d.modifLe || d.le) + ' : « ' + ESC(d.texte.length > 90 ? d.texte.slice(0, 90) + '…' : d.texte) + ' »</span>' : '<span>Ajouter une observation</span>') + '<i>⤢</i></button>';
}
function REGISTRE_OBS(ref, edite) {
    var x = REGISTRE_LIGNE(ref); if (!x) return;
    FERMER_MODALE();
    var l = MER_REG_OBS(x), quand = function(t) { return t ? new Date(t).toLocaleDateString('fr-FR') + ' à ' + new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; };
    var liste = l.map(function(o) {
        if (o.id === edite) return '<div class="MER-OBS-UNE edite"><textarea id="MER-OBS-EDIT" rows="4">' + ESC(o.texte) + '</textarea><div class="MER-OBS-BTNS">' +
            '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="REGISTRE_OBS_ENREGISTRER(\'' + ref + '\', \'' + o.id + '\')">Enregistrer</button><button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="REGISTRE_OBS(\'' + ref + '\')">Annuler</button></div></div>';
        return '<div class="MER-OBS-UNE"><p>' + ESC(o.texte).replace(/\n/g, '<br>') + '</p><small>✍ ' + ESC(o.par || '—') + ' · ' + quand(o.le) +
            (o.modifLe ? '<br>✏ modifiée par ' + ESC(o.modifPar || '—') + ' · ' + quand(o.modifLe) : '') + '</small><div class="MER-OBS-BTNS">' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="REGISTRE_OBS(\'' + ref + '\', \'' + o.id + '\')">✏ Modifier</button><button type="button" class="BTN-DANGER-TEXT" onclick="REGISTRE_OBS_SUPPRIMER(\'' + ref + '\', \'' + o.id + '\')">Supprimer</button></div></div>';
    }).join('');
    AFFICHER_MODALE('📝 Observations',
        '<p class="MER-HINT" style="margin:0 0 10px;">' + (x.omr ? '<b>OMR N°' + ESC(x.omr) + '</b> — ' : '') + ESC(x.objet || '') + '<br>Visibles par tous les assistants Chorus DT de l\'unité (pas par le missionnaire).</p>' +
        '<div class="MER-OBS-LISTE">' + (liste || '<div class="MER-EMPTY">Aucune observation pour cet OMR.</div>') + '</div>' +
        (edite ? '' : '<textarea id="MER-OBS-NOUV" rows="3" placeholder="Nouvelle observation (ex. : billet SNCF annulé, remboursement partiel…)"></textarea>'),
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Fermer</button>' + (edite ? '' : '<button type="button" class="BTN BTN-PRIMARY" onclick="REGISTRE_OBS_AJOUTER(\'' + ref + '\')">Ajouter</button>'));
    var fond = document.getElementById('MER-MODALE-FOND'); if (fond) { fond.firstChild.classList.add('MER-OBS-FEN'); fond.addEventListener('click', function(e) { if (e.target === fond) FERMER_MODALE(); }); }
}
function REGISTRE_OBS_MAJ(ref, modif) {
    var x = REGISTRE_LIGNE(ref); if (!x) return;
    var l = (x.observations || []).map(function(o) { return Object.assign({}, o); }); modif(l);
    JUMELAGE_REGISTRE_MAJ(ref, { observations: l });
    REGISTRE_OBS(ref); if (PAGE_ACTUELLE === 'CHORUS') MER_REG_REAFFICHER();
}
function MER_QUI_CHORUS() { return window.JUMELAGE_QUI ? JUMELAGE_QUI() : 'ASSIST CHORUS DT'; }
function REGISTRE_OBS_AJOUTER(ref) {
    var t = ((document.getElementById('MER-OBS-NOUV') || {}).value || '').trim(); if (!t) return;
    REGISTRE_OBS_MAJ(ref, function(l) { l.push({ id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), texte: t.slice(0, 2000), par: MER_QUI_CHORUS(), le: Date.now() }); });
}
function REGISTRE_OBS_ENREGISTRER(ref, id) {
    var t = ((document.getElementById('MER-OBS-EDIT') || {}).value || '').trim(); if (!t) return;
    REGISTRE_OBS_MAJ(ref, function(l) { l.forEach(function(o) { if (o.id === id && o.texte !== t) { o.texte = t.slice(0, 2000); o.modifPar = MER_QUI_CHORUS(); o.modifLe = Date.now(); } }); });
}
function REGISTRE_OBS_SUPPRIMER(ref, id) {
    MSG_CONFIRM('Supprimer cette observation ?', 'Elle disparaît chez tous les assistants Chorus DT de l\'unité.', 'Supprimer', function() {
        REGISTRE_OBS_MAJ(ref, function(l) { l.forEach(function(o) { if (o.id === id) { o.supprime = true; o.modifPar = MER_QUI_CHORUS(); o.modifLe = Date.now(); } }); });
    }, '🗑');
}
function REGISTRE_LIGNE(ref) { return (window.JUMELAGE_REGISTRE ? JUMELAGE_REGISTRE() : []).filter(function(x) { return x.ref === ref; })[0]; }
function REGISTRE_SUPPRIMER(ref) {
    var x = REGISTRE_LIGNE(ref); if (!x) return;
    MSG_CONFIRM('Supprimer cette ligne ?', (x.omr ? 'OMR N°' + x.omr + ' — ' : '') + (x.objet || '') + '\n\nÀ faire par exemple pour une mission annulée. La ligne disparaît du registre, chez tous les assistants Chorus DT de l\'unité ; le n° OMR n\'est pas réattribué.', 'Supprimer',
        function() { JUMELAGE_REGISTRE_MAJ(ref, null); SHOW_PAGE('CHORUS'); }, '🗑', 'mascotte-poubelle.webp', true);
}
function REGISTRE_TEXTE_RELANCE(x) {
    var ech = MER_REG_ECHEANCE(x);
    return 'Rappel : votre compte-rendu de mission « ' + (x.objet || '') + ' »' + (x.omr ? ' (OMR N°' + x.omr + ')' : '') + ' est attendu' +
        (ech ? ' au plus tard le ' + ech.toLocaleDateString('fr-FR') : '') + '. Envoyez-le depuis TRIGONE Compte-rendu (« À partir d\'une mise en route »).';
}
// Destinataires : le demandeur, et les autres personnes de la demande qui ont un compte TRIGONE (par leur matricule).
function REGISTRE_DESTINATAIRES(x) {
    var autres = (x.personnes || []).slice(1).map(function(p) { return p.nid; }).filter(Boolean);
    return (autres.length && window.JUMELAGE_COMPTES_PAR_NID ? JUMELAGE_COMPTES_PAR_NID(autres) : Promise.resolve({})).catch(function() { return {}; }).then(function(c) {
        return [x.mailDemandeur].concat(Object.keys(c || {}).map(function(k) { return c[k]; })).filter(Boolean)
            .filter(function(m, i, t) { return t.indexOf(m) === i; });
    });
}
function REGISTRE_ENVOYER_MESSAGE(x, dests, q, relance) {
    var qui = [window.JUMELAGE_QUI ? JUMELAGE_QUI() : '', 'ASSIST CHORUS DT'].filter(Boolean).join(' — ');
    return Promise.all(dests.map(function(d) {
        return JUMELAGE_ENVOYER_DIRECT(d, 'QUESTION', 'Question.json', JSON.stringify({ app: 'TRIGONE-QUESTION', ref: x.ref, genre: 'registre', objet: (x.omr ? 'OMR N°' + x.omr + ' — ' : '') + (x.objet || ''), question: q, qui: qui, rappel: !!relance }), { differable: true, libelle: 'Votre message' });
    })).then(function() {
        if (relance) { var t = Date.now(), rq = {}; rq[t] = window.JUMELAGE_QUI ? JUMELAGE_QUI() : ''; JUMELAGE_REGISTRE_MAJ(x.ref, { relances: (x.relances || []).concat([t]), relancesQui: Object.assign({}, x.relancesQui || {}, rq) }); }
    });
}
// Relance d'une ligne en un toucher : un simple rappel (pas de réponse attendue) dans la boîte TRIGONE du missionnaire.
function REGISTRE_RELANCER(ref) {
    var x = REGISTRE_LIGNE(ref); if (!x) return;
    MSG_CONFIRM('Relancer pour le compte-rendu ?', MER_REG_PERSONNEL(x) + '\n' + (x.omr ? 'OMR N°' + x.omr + ' — ' : '') + (x.objet || '') + '\n\nUn rappel arrive dans sa boîte TRIGONE, avec une notification :\n« ' + REGISTRE_TEXTE_RELANCE(x) + ' »', 'Relancer', function() {
        REGISTRE_DESTINATAIRES(x).then(function(d) {
            if (!d.length) { MSG_ERREUR('Relance impossible', 'Adresse du missionnaire inconnue pour cette demande.'); return; }
            return REGISTRE_ENVOYER_MESSAGE(x, d, REGISTRE_TEXTE_RELANCE(x), true).then(function() {
                if (PAGE_ACTUELLE === 'CHORUS') MER_REG_REAFFICHER();
                MSG_INFO('Relance envoyée', 'Le rappel est dans sa boîte TRIGONE, avec une notification.', '🔔');
            });
        }).catch(function(e) { MSG_ERREUR('Envoi impossible', e.message || String(e)); });
    }, '🔔');
}
// Relance groupée : tous les comptes-rendus en retard de la liste affichée, sauf ceux déjà relancés depuis moins de 24 h.
function REGISTRE_A_RELANCER(l) {
    var hier = Date.now() - 24 * 3600 * 1000;
    return l.filter(function(x) { return MER_REG_ETAT(x).cls === 'retard' && x.mailDemandeur && !(x.relances || []).some(function(t) { return t > hier; }); });
}
function REGISTRE_RELANCER_RETARDS() {
    var f = MER_REGISTRE_FILTRES(true), l = REGISTRE_A_RELANCER(f.retard);
    if (!l.length) { MSG_INFO('Rien à relancer', 'Les comptes-rendus en retard ont tous été relancés depuis moins de 24 h.', '🔔'); return; }
    MSG_CONFIRM('Relancer ' + l.length + ' missionnaire' + (l.length > 1 ? 's' : '') + ' ?',
        'Chacun reçoit dans sa boîte TRIGONE, avec une notification, le rappel de son compte-rendu en retard :\n\n' +
        l.slice(0, 8).map(function(x) { return '• ' + (x.omr ? 'N°' + x.omr + ' — ' : '') + MER_REG_PERSONNEL(x); }).join('\n') + (l.length > 8 ? '\n• … et ' + (l.length - 8) + ' autre(s)' : ''),
        'Relancer', function() {
            var ok = 0, ko = 0;
            l.reduce(function(p, x) {
                return p.then(function() { return REGISTRE_DESTINATAIRES(x); }).then(function(d) {
                    if (!d.length) { ko++; return; }
                    return REGISTRE_ENVOYER_MESSAGE(x, d, REGISTRE_TEXTE_RELANCE(x), true).then(function() { ok++; }, function() { ko++; });
                });
            }, Promise.resolve()).then(function() {
                if (PAGE_ACTUELLE === 'CHORUS') MER_REG_REAFFICHER();
                MSG_INFO('Relances envoyées', ok + ' relance' + (ok > 1 ? 's envoyées' : ' envoyée') + (ko ? ', ' + ko + ' impossible' + (ko > 1 ? 's' : '') + ' (adresse inconnue ou envoi refusé)' : '') + '. Les réponses arriveront dans votre Boîte de réception (Questions).', '🔔');
            });
        }, '🔔');
}
// Relance (texte prérempli, modifiable) ou message libre au(x) missionnaire(s) : arrive dans sa boîte TRIGONE avec une
// notification (dossier Questions), il peut répondre. Destinataires : le demandeur, et les autres personnes de la demande
// qui ont un compte TRIGONE (retrouvées par leur matricule).
function REGISTRE_MESSAGE(ref, relance) {
    var x = REGISTRE_LIGNE(ref); if (!x) return;
    var txt = relance ? REGISTRE_TEXTE_RELANCE(x) : '';
    AFFICHER_MODALE(relance ? 'Relancer pour le compte-rendu' : 'Message au missionnaire',
        '<p style="font-size:0.86em; line-height:1.5;">' + (x.omr ? '<b>OMR N°' + ESC(x.omr) + '</b> — ' : '') + ESC(x.objet || '') + '<br>À : ' + ESC(MER_REG_PERSONNEL(x)) + '</p>' +
        '<textarea id="MER-REG-TXT" rows="5" style="width:100%; box-sizing:border-box; padding:10px; border-radius:10px; border:1.5px solid var(--tg-border); font:inherit;" placeholder="Votre message">' + ESC(txt) + '</textarea>' +
        '<p class="MER-HINT" id="MER-REG-DEST">Recherche des comptes TRIGONE…</p>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button><button type="button" class="BTN BTN-PRIMARY" id="MER-REG-GO" disabled>Envoyer</button>');
    REGISTRE_DESTINATAIRES(x).then(function(dests) {
        var z = document.getElementById('MER-REG-DEST'), b = document.getElementById('MER-REG-GO'); if (!z || !b) return;
        z.textContent = dests.length ? 'Envoyé dans la boîte TRIGONE de : ' + dests.join(', ') + ' (avec une notification ; réponse possible).' : 'Adresse du missionnaire inconnue pour cette demande.';
        b.disabled = !dests.length;
        b.onclick = function() {
            var q = (document.getElementById('MER-REG-TXT').value || '').trim();
            if (q.length < 3) return;
            b.disabled = true; b.textContent = 'Envoi…';
            REGISTRE_ENVOYER_MESSAGE(x, dests, q, relance).then(function() {
                FERMER_MODALE(); SHOW_PAGE('CHORUS');
                MSG_INFO(relance ? 'Relance envoyée' : 'Message envoyé', 'Il arrive dans la boîte TRIGONE du missionnaire, avec une notification. Sa réponse arrivera dans votre Boîte de réception (Questions).', relance ? '🔔' : '✉');
            }).catch(function(e) { b.disabled = false; b.textContent = 'Envoyer'; MSG_ERREUR('Envoi impossible', e.message || String(e)); });
        };
    });
}
// Nouvelle série : préfixe libre (ex. « 2027- ») et premier numéro, pour tous (série commune).
function REGISTRE_SERIE() {
    AFFICHER_MODALE('Numérotation OMR', '<p class="MER-HINT" id="MER-SERIE-ETAT">Lecture de la série en cours…</p>', '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Fermer</button>');
    JUMELAGE_OMR_SERIE().then(function(s) {
        AFFICHER_MODALE('Numérotation OMR',
            '<p style="font-size:0.86em; line-height:1.5;">Prochain numéro : <b>OMR N°' + ESC(s.prefixe + String(s.prochain).padStart(4, '0')) + '</b>. La série est commune à tout TRIGONE : chaque demande envoyée par un missionnaire prend le numéro suivant.</p>' +
            '<div class="MER-SECTION-TITLE">Repartir sur une nouvelle série</div>' +
            '<div class="MER-FIELD"><label>Préfixe (facultatif)</label><input type="text" id="MER-SERIE-PREF" maxlength="12" data-no-uppercase="1" placeholder="EX : 2027-" value="' + ESC(s.prefixe) + '"></div>' +
            '<div class="MER-FIELD"><label>Premier numéro</label><input type="number" id="MER-SERIE-NUM" min="1" value="1"></div>' +
            '<p class="MER-HINT">Les demandes déjà numérotées gardent leur numéro.</p>',
            '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button><button type="button" class="BTN BTN-PRIMARY" onclick="REGISTRE_SERIE_OK()">Nouvelle série</button>');
    }).catch(function(e) { MSG_ERREUR('Numérotation indisponible', e.message || String(e)); });
}
function REGISTRE_SERIE_OK() {
    var p = document.getElementById('MER-SERIE-PREF').value.trim(), n = parseInt(document.getElementById('MER-SERIE-NUM').value, 10);
    if (!(n >= 1)) { MSG_ERREUR('Premier numéro', 'Indiquez un nombre (1 ou plus).'); return; }
    JUMELAGE_OMR_SERIE({ prefixe: p, prochain: n }).then(function(s) {
        FERMER_MODALE(); MSG_INFO('Nouvelle série', 'Prochain numéro : OMR N°' + s.prefixe + String(s.prochain).padStart(4, '0') + '.', '🔢');
    }).catch(function(e) { MSG_ERREUR('Numérotation non modifiée', e.message || String(e)); });
}
// Remise à zéro : tout le registre effacé (chez tous les assistants Chorus DT de l'unité) et numérotation à 0001.
// Confirmation en tapant EFFACER, après un rappel de garder le PDF.
function REGISTRE_VIDER() {
    var r = MER_REGISTRE_LIGNES(), n = r.mer.length + r.cr.length;
    AFFICHER_MODALE('Tout effacer et repartir à 0001',
        '<p style="font-size:0.88em; line-height:1.5;">Les <b>' + n + ' ligne' + (n > 1 ? 's' : '') + '</b> du registre (mises en route et comptes-rendus rendus) seront effacées <b>chez tous les assistants Chorus DT de l\'unité</b>, et la numérotation repartira à <b>OMR N°0001</b>.</p>' +
        '<p class="MER-HINT">Pensez à garder le PDF des deux onglets avant. Les demandes et comptes-rendus reçus restent dans votre boîte ; les demandes déjà numérotées chez les missionnaires gardent leur numéro. Impossible à annuler.</p>' +
        '<div class="MER-FIELD"><label>Pour confirmer, tapez EFFACER</label><input type="text" id="MER-VIDER-MOT" autocomplete="off" placeholder="EFFACER"></div>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button><button type="button" class="BTN BTN-PRIMARY" id="MER-VIDER-GO" style="background:#c0392b; border-color:#c0392b; color:#fff;" onclick="REGISTRE_VIDER_OK()">Tout effacer</button>');
}
function REGISTRE_VIDER_OK() {
    if ((document.getElementById('MER-VIDER-MOT').value || '').trim().toUpperCase() !== 'EFFACER') { MSG_ERREUR('Confirmation', 'Tapez EFFACER pour confirmer.'); return; }
    var b = document.getElementById('MER-VIDER-GO'); if (b) { b.disabled = true; b.textContent = 'Effacement…'; }
    JUMELAGE_REGISTRE_VIDER().then(function() {
        FERMER_MODALE(); SHOW_PAGE('CHORUS');
        MSG_INFO('Registre remis à zéro', 'Le registre est vide, chez tous les assistants Chorus DT de l\'unité. La prochaine demande envoyée prendra le n° OMR N°0001.', '🔢');
    }).catch(function(e) { if (b) { b.disabled = false; b.textContent = 'Tout effacer'; } MSG_ERREUR('Registre non effacé', e.message || String(e)); });
}
// PDF de l'onglet affiché (A4 paysage, noir et or, économe en encre).
function REGISTRE_PDF() {
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDFCtor) { MSG_ERREUR('PDF impossible', 'Le module PDF n\'est pas chargé : rouvrez TRIGONE.'); return; }
    var f = MER_REGISTRE_FILTRES(true), filtre = MER_REGISTRE_ONGLET in f ? MER_REGISTRE_ONGLET : 'tout', l = f[filtre];
    var nomFiltre = (MER_REG_FILTRES.filter(function(c) { return c[0] === filtre; })[0] || ['', 'Toutes'])[1];
    var doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = 297, M = 12;
    if (window.JUMELAGE_PDF_STYLE) JUMELAGE_PDF_STYLE(doc);
    var logo = !!(window.JUMELAGE_LOGO_PDF && window.JUMELAGE_LOGO_PRET()), dy = logo ? 22 : 0;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(26, 26, 26);
    if (logo) window.JUMELAGE_LOGO_PDF(doc, M + doc.getTextWidth('TRIGONE') / 2, 4, 21);
    doc.text('TRIGONE', M, 12 + dy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(82, 82, 82);
    var c = MER_REGISTRE_CRIT, u = MER_UNITE(), crit = [c.texte.trim() ? '« ' + c.texte.trim() + ' »' : '', c.code && u ? (c.code === 'unite' ? 'codes du ' : 'hors ') + u.nom : '',
        c.du ? 'du ' + new Date(c.du).toLocaleDateString('fr-FR') : '', c.au ? 'au ' + new Date(c.au).toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · ');
    doc.text('Registre des OMR — ' + (filtre === 'tout' ? 'toutes les missions' : nomFiltre.toLowerCase()) + (crit ? ' — filtres : ' + crit : ''), M, 18 + dy);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(176, 128, 42);
    doc.text(l.length + ' ligne' + (l.length > 1 ? 's' : ''), W - M, 12 + dy, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
    doc.text('Édité le ' + new Date().toLocaleString('fr-FR'), W - M, 18 + dy, { align: 'right' });
    doc.setFillColor(214, 167, 86); doc.rect(0, 22 + dy, W, 0.8, 'F');
    var head = [['N° OMR', 'Envoyée le', 'Objet', 'Code FD', 'Début', 'Fin', 'Personnel', 'Étape', 'Repas', 'Hébergement', 'Transports', 'IK', 'Transp. commun', 'Total']];
    // Police du PDF sans espace fine insécable (séparateur des milliers en français) : simple espace.
    var eur = function(v) { return MER_EUROS(v).replace(/[\u202F\u00A0]/g, ' '); };
    var vide = function(x, v) { return (x.crs || []).length ? eur(v) : '—'; };
    var body = l.map(function(x) {
        var e = MER_REG_ETAT(x), m = MER_REG_MONTANTS(x);
        var nat = x.sansDemande ? '' : MER_REG_NATURE(x);
        return [(x.omr || '—') + (nat ? '\n' + (nat.collectif ? 'COLLECTIF' : 'INDIVIDUEL') + (nat.pays ? '\nINTERNATIONAL' : '') : ''), MER_REG_JOUR(x.omrLe || x.recuLe), (x.objet || '') + (nat && nat.pays ? '\n(' + nat.pays.toUpperCase() + ')' : ''), x.codeFD || '—', MER_REG_JOUR(x.debut), MER_REG_JOUR(x.fin),
            (x.personnes || []).length > 1 ? x.personnes.map(function(p) { return '- ' + [p.grade, (p.nom || '').toUpperCase(), p.prenom].filter(Boolean).join(' '); }).join('\n') : MER_REG_PERSONNEL(x), e.txt.replace(/[✔⚠]\s?/g, ''),
            vide(x, m.repas), vide(x, m.hebergement), vide(x, m.transports), vide(x, m.ik), vide(x, m.tc), vide(x, m.total)];
    });
    var t = l.reduce(function(a, x) { var m = MER_REG_MONTANTS(x); Object.keys(a).forEach(function(k) { a[k] += m[k]; }); return a; }, { repas: 0, hebergement: 0, transports: 0, ik: 0, tc: 0, total: 0 });
    var foot = [['', '', '', '', '', '', '', 'TOTAL', eur(t.repas), eur(t.hebergement), eur(t.transports), eur(t.ik), eur(t.tc), eur(t.total)]];
    doc.autoTable({ startY: 27 + dy, margin: { left: M, right: M }, head: head, body: body, foot: foot, showFoot: 'lastPage',
        theme: 'plain', styles: { fontSize: 7, cellPadding: 1.4, textColor: [26, 26, 26], lineColor: [230, 230, 230], lineWidth: 0.1 },
        headStyles: { fillColor: false, textColor: [26, 26, 26], fontStyle: 'bold' }, footStyles: { fillColor: false, textColor: [26, 26, 26], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 248, 243] },
        columnStyles: { 0: { fontStyle: 'bold', minCellWidth: 20 }, 8: { halign: 'right', minCellWidth: 16 }, 9: { halign: 'right', minCellWidth: 19 }, 10: { halign: 'right', minCellWidth: 17 }, 11: { halign: 'right', minCellWidth: 16 }, 12: { halign: 'right', minCellWidth: 17 }, 13: { fontStyle: 'bold', halign: 'right', minCellWidth: 19 } },
        // Montants jamais coupés sur deux lignes.
        didParseCell: function(d) {
            // Code FD : vert si code de l'unité, jaune sinon (comme à l'écran).
            if (d.section === 'body' && d.column.index === 3 && l[d.row.index]) {
                var cu = MER_CODE_UNITE(l[d.row.index].codeFD);
                if (cu === 'unite') { d.cell.styles.textColor = [21, 128, 61]; d.cell.styles.fillColor = [226, 242, 231]; d.cell.styles.fontStyle = 'bold'; }
                if (cu === 'hors') { d.cell.styles.textColor = [133, 77, 14]; d.cell.styles.fillColor = [253, 243, 199]; d.cell.styles.fontStyle = 'bold'; }
            }
            if (d.column.index < 8) return; d.cell.styles.halign = 'right'; if (d.section !== 'head') d.cell.styles.overflow = 'visible'; } });
    try { doc.save('Registre OMR - ' + nomFiltre.toLowerCase() + ' - ' + new Date().toISOString().slice(0, 10) + '.pdf'); }
    catch (e) { MSG_ERREUR('PDF impossible', e.message || String(e)); }
}
window.addEventListener('trigone-registre', function() { if (typeof PAGE_ACTUELLE !== 'undefined' && PAGE_ACTUELLE === 'CHORUS' && !MER_RESULTATS_VERIF) MER_REG_REAFFICHER(); });
// Compte-rendu de mission reçu : ses fichiers (PDF du compte-rendu, justificatifs) à télécharger.
var MER_CR_OUVERT = null;
function OUVRIR_CR_RECU(id) {
    JUMELAGE_BOITE_FICHIER(id).then(function(f) { return f.text(); }).then(function(t) {
        var cr = JSON.parse(t);
        if (cr.app !== 'TRIGONE-CR') throw new Error('Envoi non reconnu.');
        MER_CR_OUVERT = { id: id, cr: cr };
        JUMELAGE_BOITE_MARQUER(id, 'ouvert');
        var x = (JUMELAGE_BOITE_LISTE() || []).filter(function(e) { return e.id === id; })[0] || {};
        AFFICHER_MODALE('Compte-rendu de mission',
            '<p style="font-size:0.9em; line-height:1.5; margin:0 0 6px;"><b>' + ESC(cr.missionnaire || '') + '</b><br>' + ESC([cr.libelle, cr.dates].filter(Boolean).join(' · ')) + '</p>' +
            '<p class="MER-HINT">Reçu de ' + ESC(x.de || cr.de || '?') + (cr.envoyeLe ? ', le ' + ESC(new Date(cr.envoyeLe).toLocaleString('fr-FR')) : '') + '</p>' +
            ((cr.fichiers || []).length > 1 ? '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT"><div class="MER-PANIER-ITEM-TITRE">📄 PDF complet</div>' +
                '<div class="MER-PANIER-ITEM-SUB">Compte-rendu suivi des ' + (cr.fichiers.length - 1) + ' justificatif' + (cr.fichiers.length > 2 ? 's' : '') + ', en un seul fichier</div></div>' +
                '<div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;"><button type="button" class="BTN BTN-PRIMARY BTN-SMALL" style="width:auto; margin:0;" onclick="PDF_COMPLET_CR(false)">👁 Aperçu</button>' +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto; margin:0;" onclick="PDF_COMPLET_CR(true)">⬇ Télécharger</button></div></div>' : '') +
            '<div class="MER-SECTION-TITLE">Fichiers' + ((cr.fichiers || []).length > 1 ? ' séparés' : '') + '</div>' +
            (cr.fichiers || []).map(function(fi, i) {
                return '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT"><div class="MER-PANIER-ITEM-TITRE" style="word-break:break-all;">' + (i ? '📎 ' : '📄 ') + ESC(fi.nom) + '</div>' +
                    '<div class="MER-PANIER-ITEM-SUB">' + (i ? 'Justificatif' : 'Compte-rendu') + ' · ' + TAILLE_LISIBLE(Math.floor((fi.b64 || '').length * 3 / 4)) + '</div></div>' +
                    '<div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;"><button type="button" class="BTN BTN-PRIMARY BTN-SMALL" style="width:auto; margin:0;" onclick="APERCU_FICHIER_CR(' + i + ')">👁 Aperçu</button>' +
                    '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto; margin:0;" onclick="TELECHARGER_FICHIER_CR(' + i + ')">⬇ Télécharger</button></div></div>';
            }).join('') +
            (cr.corps ? '<details class="MER-RECU-TRAITES" style="margin-top:10px;"><summary>Message du missionnaire</summary><pre style="white-space:pre-wrap; font:inherit; font-size:0.8em;">' + ESC(cr.corps) + '</pre></details>' : '') +
            TPL_ETAT_QUESTION(id) +
            (cr.equipe ? '<div class="MER-SECTION-TITLE">Mission collective — ' + (cr.roleEquipe === 'participant' ? 'compte-rendu d\'un participant' : 'compte-rendu du chef de mission') + '</div><div id="MER-CR-EQUIPE" class="MER-HINT">Chargement du suivi des participants…</div>' : ''),
            '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Fermer</button>' +
            '<button type="button" class="BTN BTN-GHOST" onclick="PDF_COMPLET_CR(true)">⬇ PDF complet</button>' +
            '<button type="button" class="BTN BTN-GHOST" onclick="POSER_QUESTION(\'cr\')">❓ Question</button>' +
            '<button type="button" class="BTN BTN-PRIMARY" onclick="TRAITER_CR_RECU()">✔ Traité</button>');
        if (cr.equipe) MER_CR_EQUIPE(cr);
    }).catch(function(e) { MSG_ERREUR('Ouverture impossible', e.message || String(e)); });
}
// Compte-rendu d'une mission collective (assistant Chorus DT) : chronologie de l'équipe — pour chaque participant,
// compte-rendu reçu (date, déjà dans la boîte) ou encore attendu (transmis par le chef le…, relancé le…).
function MER_CR_EQUIPE(cr) {
    var zone = function() { return document.getElementById('MER-CR-EQUIPE'); };
    var jour = function(ms) { var d = new Date(ms); return d.toLocaleDateString('fr-FR') + ' ' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2); };
    JUMELAGE_EQUIPE(cr.equipe).then(function(rows) {
        var z = zone(); if (!z) return;
        var noms = {}; (cr.participants || []).forEach(function(p) { if (p.mail) noms[p.mail] = p.nom; });
        // Noms connus par les comptes-rendus déjà reçus de la même équipe.
        var boite = (JUMELAGE_BOITE_LISTE() || []).filter(function(x) { return x.nature === 'cr' && x.equipe === cr.equipe; });
        boite.forEach(function(x) { if (x.de && !noms[x.de]) noms[x.de] = x.noms; });
        if (!rows.length) { z.textContent = 'Suivi des participants indisponible pour cette mission.'; return; }
        var recus = rows.filter(function(r) { return r.envoye; }).length;
        z.innerHTML = '<p style="margin:0 0 8px;"><b>' + recus + ' sur ' + rows.length + '</b> compte' + (recus > 1 ? 's' : '') + '-rendu' + (recus > 1 ? 's' : '') + ' de participant reçu' + (recus > 1 ? 's' : '') +
            (recus === rows.length ? ' : toute l\'équipe est là, la mission peut être traitée d\'un coup ✅' : ' : ' + (rows.length - recus) + ' encore attendu' + (rows.length - recus > 1 ? 's' : '') + '.') + '</p>' +
            rows.sort(function(a, b) { return (b.envoye ? 1 : 0) - (a.envoye ? 1 : 0); }).map(function(r) {
                var dansBoite = boite.some(function(x) { return x.de === r.mail; });
                return '<div class="MER-EQUIPE-LIGNE ' + (r.envoye ? 'ok' : 'attente') + '"><b>' + ESC(noms[r.mail] || r.mail) + '</b>' +
                    '<small>' + ESC(noms[r.mail] ? r.mail : '') + '</small>' +
                    '<span>' + (r.envoye ? '✅ Compte-rendu reçu le ' + jour(r.envoye) + (dansBoite ? ' · dans votre boîte' : '')
                        : '⏳ En attente — transmis par le chef le ' + jour(r.recu) + (r.relance ? ' · relancé le ' + jour(r.relance) : '')) + '</span></div>';
            }).join('');
    }).catch(function() { var z = zone(); if (z) z.textContent = 'Suivi des participants indisponible (pas de réseau ?).'; });
}
// Nom de fichier avec son extension (sinon le téléphone ne sait pas avec quoi l'ouvrir).
function MER_NOM_AVEC_EXT(nom, type) {
    nom = String(nom || 'fichier');
    var ext = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' }[type];
    return ext && !/\.[a-z0-9]{2,5}$/i.test(nom) ? nom + ext : nom;
}
// Aperçu d'un fichier du compte-rendu : photo affichée dans TRIGONE ; PDF ouvert dans un nouvel onglet (ou la
// visionneuse du téléphone), à défaut téléchargé.
function APERCU_FICHIER_CR(i) {
    if (!MER_CR_OUVERT) return;
    var fi = (MER_CR_OUVERT.cr.fichiers || [])[i]; if (!fi) return;
    var type = fi.type || (/\.pdf$/i.test(fi.nom) ? 'application/pdf' : 'application/octet-stream');
    var url = URL.createObjectURL(new Blob([new Uint8Array(DEB64(fi.b64))], { type: type }));
    if (/^image\//.test(type)) {
        var v = document.createElement('div');
        v.className = 'MER-VISIONNEUSE';
        v.innerHTML = '<img alt=""><button type="button" aria-label="Fermer">✕</button>';
        v.querySelector('img').src = url;
        v.addEventListener('click', function() { v.remove(); URL.revokeObjectURL(url); });
        document.body.appendChild(v);
        return;
    }
    var w = window.open(url, '_blank');
    if (!w) TELECHARGER_OCTETS(MER_NOM_AVEC_EXT(fi.nom, type), new Uint8Array(DEB64(fi.b64)), type);
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
}
// Depuis la ligne du compte-rendu : aperçu du PDF sans passer par la fenêtre de détail.
function APERCU_CR_RECU(id) {
    var w = window.open('', '_blank');   // ouverte tout de suite, sinon le navigateur la bloque
    JUMELAGE_BOITE_FICHIER(id).then(function(f) { return f.text(); }).then(function(t) {
        var cr = JSON.parse(t), fi = (cr.fichiers || [])[0];
        if (cr.app !== 'TRIGONE-CR' || !fi) throw new Error('Compte-rendu illisible.');
        // Compte-rendu et justificatifs en un seul PDF (à défaut : le compte-rendu seul).
        var seul = function() { return new Uint8Array(DEB64(fi.b64)); };
        return (cr.fichiers.length > 1 ? MER_CR_PDF_UNIQUE(cr).catch(seul) : Promise.resolve(seul())).then(function(octets) {
            var url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }));
            if (w) w.location = url; else window.open(url, '_blank');
            JUMELAGE_BOITE_MARQUER(id, 'ouvert');
            setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
        });
    }).catch(function(e) { if (w) w.close(); MSG_ERREUR('Ouverture impossible', (e.message || String(e)) + ' Si le problème continue, demandez au missionnaire de renvoyer son compte-rendu.'); });
}
// Un seul PDF pour l'assistant Chorus DT : le compte-rendu, suivi de chaque justificatif (pages des PDF, photos sur
// une page A4 chacune, en couleur). Un justificatif illisible est laissé de côté (il reste téléchargeable seul).
function MER_CR_PDF_UNIQUE(cr) {
    var fichiers = cr.fichiers || [];
    if (!fichiers.length) return Promise.reject(new Error('Compte-rendu vide.'));
    return CHARGER_PDFLIB().then(function() { return PDFLib.PDFDocument.create(); }).then(function(doc) {
        var A4 = [595.28, 841.89], marge = 28;
        function photo(fi, octets) {
            var type = fi.type || '';
            if (type === 'image/png') return doc.embedPng(octets);
            if (type === 'image/jpeg' || /\.jpe?g$/i.test(fi.nom)) return doc.embedJpg(octets);
            // Autres formats (webp, heic…) : repassés en JPEG par le navigateur quand il sait les lire.
            return createImageBitmap(new Blob([octets], { type: type })).then(function(img) {
                var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
                c.getContext('2d').drawImage(img, 0, 0);
                return new Promise(function(ok) { c.toBlob(ok, 'image/jpeg', 0.85); });
            }).then(function(b) { return b.arrayBuffer(); }).then(function(buf) { return doc.embedJpg(new Uint8Array(buf)); });
        }
        return fichiers.reduce(function(prec, fi) {
            return prec.then(function() {
                var octets = new Uint8Array(DEB64(fi.b64));
                if (fi.type === 'application/pdf' || /\.pdf$/i.test(fi.nom)) {
                    return PDFLib.PDFDocument.load(octets, { ignoreEncryption: true }).then(function(src) {
                        return doc.copyPages(src, src.getPageIndices());
                    }).then(function(pages) { pages.forEach(function(pg) { doc.addPage(pg); }); });
                }
                return photo(fi, octets).then(function(img) {
                    var paysage = img.width > img.height, T = paysage ? [A4[1], A4[0]] : A4;
                    var e = Math.min((T[0] - 2 * marge) / img.width, (T[1] - 2 * marge) / img.height, 1);
                    var pg = doc.addPage(T);
                    pg.drawImage(img, { x: (T[0] - img.width * e) / 2, y: (T[1] - img.height * e) / 2, width: img.width * e, height: img.height * e });
                });
            }).catch(function() {});
        }, Promise.resolve()).then(function() {
            if (!doc.getPageCount()) throw new Error('Aucune page lisible.');
            return doc.save({ useObjectStreams: false });
        });
    });
}
function MER_NOM_PDF_UNIQUE(cr) {
    var n = ((cr.fichiers || [])[0] || {}).nom || 'Compte-rendu';
    return n.replace(/\.pdf$/i, '') + (cr.fichiers.length > 1 ? ' + justificatifs' : '') + '.pdf';
}
// « 📄 PDF complet » : aperçu (ou téléchargement) du compte-rendu et de ses justificatifs en un seul fichier.
function PDF_COMPLET_CR(telecharger) {
    if (!MER_CR_OUVERT) return;
    var cr = MER_CR_OUVERT.cr, w = telecharger ? null : window.open('', '_blank');
    MER_CR_PDF_UNIQUE(cr).then(function(octets) {
        if (telecharger || !w) { TELECHARGER_OCTETS(MER_NOM_PDF_UNIQUE(cr), octets, 'application/pdf'); if (w) w.close(); return; }
        var url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }));
        w.location = url;
        setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
    }).catch(function(e) { if (w) w.close(); MSG_ERREUR('PDF complet impossible', (e.message || String(e)) + ' Les fichiers restent téléchargeables un par un.'); });
}
function TELECHARGER_FICHIER_CR(i) {
    if (!MER_CR_OUVERT) return;
    var fichiers = MER_CR_OUVERT.cr.fichiers || [];
    (i < 0 ? fichiers : [fichiers[i]]).forEach(function(fi, k) {
        if (!fi) return;
        setTimeout(function() { TELECHARGER_OCTETS(MER_NOM_AVEC_EXT(fi.nom, fi.type), new Uint8Array(DEB64(fi.b64)), fi.type || 'application/octet-stream'); }, k * 400);
    });
}
function TRAITER_CR_RECU() {
    if (MER_CR_OUVERT) JUMELAGE_BOITE_MARQUER(MER_CR_OUVERT.id, 'traite');
    MER_CR_OUVERT = null;
    FERMER_MODALE();
    if (PAGE_ACTUELLE === 'CHORUS') SHOW_PAGE('CHORUS');
}
function ACTUALISER_RECEPTION(btn) {
    if (!window.JUMELAGE_RELEVER) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Relève en cours…'; }
    if (PAGE_ACTUELLE === 'CHORUS' && window.JUMELAGE_INSCRIPTIONS_ACTUALISER) JUMELAGE_INSCRIPTIONS_ACTUALISER(true);
    JUMELAGE_RELEVER().then(function(n) {
        if (PAGE_ACTUELLE === 'RECEPTION' || PAGE_ACTUELLE === 'CHORUS') SHOW_PAGE(PAGE_ACTUELLE);
        if (!n) MER_BANDEAU_RECU('Boîte à jour', 'Aucune nouvelle demande pour l\'instant.');
    });
}
function OUVRIR_RECU(id) {
    var x = (JUMELAGE_BOITE_LISTE() || []).filter(function(e) { return e.id === id; })[0];
    if (!x) return;
    JUMELAGE_BOITE_FICHIER(id).then(function(f) {
        var faux = { files: [f], value: '' };
        if (x.nature === 'cr') { OUVRIR_CR_RECU(id); return; }
        if (x.nature === 'refus') { IMPORTER_REFUS(faux); JUMELAGE_BOITE_MARQUER(id, 'traite'); return; }
        if (x.nature === 'chorus') { JUMELAGE_BOITE_MARQUER(id, 'ouvert'); VERIFIER_FICHIERS(faux); return; }
        var niveau = x.nature === 'niveau2' ? 2 : 1;
        CHARGER_LISTE_VALIDEURS().then(RESTAURER_ACCES).then(function() {
            var h = HABILITATION_COURANTE();
            // Personne à la fois VALIDEUR 1 et VALIDEUR 2 : on passe au rôle qu'attend la demande.
            return (!h || h.role !== niveau) && MER_ROLES_MEMO[niveau] ? MER_PASSER_ROLE(niveau) : null;
        }).then(function() {
            var h = HABILITATION_COURANTE();
            if (!h || h.retire) {
                MER_BOITE_A_OUVRIR = id;
                SHOW_PAGE('VALIDATION');
                AFFICHER_MSG_CENTRE({ titre: 'Rôle valideur à activer', icone: '🔒', mascotte: 'mascotte-code.webp',
                    texte: 'Activez votre rôle de valideur avec son code (Paramètres › Mes rôles) : la demande s\'ouvrira aussitôt, prête à signer.',
                    boutons: [{ label: 'Plus tard', style: 'BTN BTN-SECONDARY' }, { label: 'Activer mon rôle', action: MER_ACTIVER_ROLE_VALIDEUR }] });
                return;
            }
            JUMELAGE_BOITE_MARQUER(id, 'ouvert');
            // Déjà dans l'Espace valideur à ce niveau-là (une même demande peut y être aussi au niveau précédent).
            var deja = (x.ids || []).length && x.ids.every(function(i) { return GET_A_VALIDER().some(function(e) { return e.id === i + '#' + (niveau - 1); }); });
            SHOW_PAGE('VALIDATION');
            if (!deja) IMPORTER_A_VALIDER(faux);
        });
    }).catch(function(e) { MSG_ERREUR('Ouverture impossible', e.message || String(e)); });
}
// Validation groupée : toutes les demandes « à signer » d'un niveau sont ouvertes d'un coup dans l'Espace valideur et
// cochées ; le valideur relit (aperçu, pièces jointes), décoche au besoin, puis « Valider la sélection » : une signature
// par demande, comme une par une. Rôle valideur pas encore actif : comme « Ouvrir et signer ».
function OUVRIR_TOUT_SIGNER(niveau) {
    var items = (JUMELAGE_BOITE_LISTE() || []).filter(function(x) { return x.nature === 'niveau' + niveau && x.statut !== 'traite'; });
    if (!items.length) return;
    CHARGER_LISTE_VALIDEURS().then(RESTAURER_ACCES).then(function() {
        var h = HABILITATION_COURANTE();
        return (!h || h.role !== niveau) && MER_ROLES_MEMO[niveau] ? MER_PASSER_ROLE(niveau) : null;
    }).then(function() {
        var h = HABILITATION_COURANTE();
        if (!h || h.retire) { OUVRIR_RECU(items[0].id); return; }
        return Promise.all(items.map(function(x) { return JUMELAGE_BOITE_FICHIER(x.id); })).then(function(fichiers) {
            items.forEach(function(x) { JUMELAGE_BOITE_MARQUER(x.id, 'ouvert'); });
            SHOW_PAGE('VALIDATION');
            IMPORTER_A_VALIDER({ files: fichiers, value: '' });
            // Une fois la liste affichée (contrôle des signatures fait) : tout est coché, prêt à valider.
            setTimeout(function() {
                Array.prototype.forEach.call(document.querySelectorAll('.MER-VAL-SEL'), function(c) { c.checked = true; });
                var n = document.querySelectorAll('.MER-VAL-SEL').length;
                if (n > 1) MSG_INFO(n + ' demandes prêtes à signer', 'Elles sont toutes cochées. Relisez-les (aperçu, pièces jointes), décochez celles à traiter à part, puis touchez « ✔ Valider la sélection » : chacune reçoit votre signature. Il restera à « Transmettre les décisions ».', '✍️');
            }, 1500);
        });
    }).catch(function(e) { MSG_ERREUR('Ouverture impossible', e.message || String(e)); });
}
// ===================== QUESTIONS (au lieu d'un refus) =====================
// Un valideur (Espace valideur) ou l'assistant Chorus DT (compte-rendu, demande validée) pose une question au
// missionnaire : elle part chiffrée dans sa boîte (envoi QUESTION) ; il répond en quelques mots (REPONSE) ; le dossier
// reste où il est. Questions posées gardées sur l'appareil (trigone_questions : { ref: [{ le, q }] }) ; la réponse,
// reçue dans la boîte, s'affiche sous la demande concernée.
var CLE_QUESTIONS = 'trigone_questions';
function MER_QUESTIONS() { try { return JSON.parse(localStorage.getItem(CLE_QUESTIONS) || '{}') || {}; } catch (e) { return {}; } }
function TPL_ETAT_QUESTION(ref) {
    var q = MER_QUESTIONS()[ref] || [];
    var reps = (window.JUMELAGE_BOITE_LISTE ? JUMELAGE_BOITE_LISTE() : []).filter(function(x) { return x.nature === 'reponse' && x.ref === ref; });
    if (!q.length && !reps.length) return '';
    var h = function(ms) { return new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    return '<div class="MER-QUESTION">' + q.map(function(x) {
        var r = reps.filter(function(y) { return y.question === x.q; })[0];
        return '<b>❓ ' + ESC(x.q) + '</b><small>Posée le ' + h(x.le) + '</small>' + (r ? '<span>💬 ' + ESC(r.reponse) + '</span><small>Réponse du ' + h(r.le) + '</small>' : '<small>⏳ En attente de réponse</small>');
    }).join('') + '</div>';
}
// genre : 'mer' (id d'entrée de l'Espace valideur), 'chorus' (id d'envoi reçu : demande validée), 'cr' (compte-rendu ouvert).
function POSER_QUESTION(genre, id) {
    var cible = null;
    var suite = function(c) {
        if (!c || !c.dest) { MSG_ERREUR('Question impossible', 'L\'adresse du missionnaire est inconnue pour ce dossier.'); return; }
        cible = c;
        AFFICHER_MODALE('Poser une question',
            '<p style="font-size:0.86em; line-height:1.5;">À <b>' + ESC(c.noms || c.dest) + '</b>, sur « ' + ESC(c.objet || 'sa demande') + ' ». Elle arrive dans sa boîte TRIGONE avec une notification ; le dossier ne bouge pas en attendant sa réponse.</p>' +
            '<textarea id="MER-QUESTION-TXT" rows="4" style="width:100%; box-sizing:border-box; padding:10px; border-radius:10px; border:1.5px solid var(--tg-border); font:inherit;" placeholder="Ex : Pourquoi un taxi le 2e jour ?"></textarea>',
            '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button><button type="button" class="BTN BTN-PRIMARY" id="MER-QUESTION-GO">Envoyer la question</button>');
        setTimeout(function() {
            var t = document.getElementById('MER-QUESTION-TXT'); if (t) t.focus();
            document.getElementById('MER-QUESTION-GO').onclick = function() {
                var q = (t.value || '').trim();
                if (q.length < 3) { t.focus(); return; }
                var b = this; b.disabled = true; b.textContent = 'Envoi…';
                var qui = [window.JUMELAGE_QUI ? JUMELAGE_QUI() : '', c.role].filter(Boolean).join(' — ');
                JUMELAGE_ENVOYER_DIRECT(c.dest, 'QUESTION', 'Question.json', JSON.stringify({ app: 'TRIGONE-QUESTION', ref: c.ref, genre: genre, objet: c.objet || '', question: q, qui: qui }), { differable: true, libelle: 'Votre question' })
                    .then(function() {
                        var l = MER_QUESTIONS(); (l[c.ref] = l[c.ref] || []).push({ le: Date.now(), q: q });
                        try { localStorage.setItem(CLE_QUESTIONS, JSON.stringify(l)); } catch (e) {}
                        FERMER_MODALE();
                        if (PAGE_ACTUELLE === 'VALIDATION') RENDER_VALIDATION_INPLACE();
                        MSG_INFO('Question envoyée', (c.noms || c.dest) + ' la reçoit avec une notification. Sa réponse arrivera dans votre Boîte de réception (dossier Questions) et s\'affichera sous ce dossier.', '❓');
                    }).catch(function(e) { b.disabled = false; b.textContent = 'Envoyer la question'; MSG_ERREUR('Question non envoyée', e.message || String(e)); });
            };
        }, 50);
    };
    if (genre === 'mer') {
        var e = GET_A_VALIDER().filter(function(x) { return x.id === id; })[0]; if (!e) return;
        var h = HABILITATION_COURANTE();
        suite({ dest: e.d.mailDemandeur, ref: e.d.id, objet: e.d.objet, noms: RESUME_DEMANDE(e.d).noms, role: h ? 'VALIDEUR ' + h.role : '' });
    } else if (genre === 'cr') {
        if (!MER_CR_OUVERT) return;
        var x = (JUMELAGE_BOITE_LISTE() || []).filter(function(y) { return y.id === MER_CR_OUVERT.id; })[0] || {};
        suite({ dest: x.de || MER_CR_OUVERT.cr.de, ref: MER_CR_OUVERT.id, objet: MER_CR_OUVERT.cr.libelle, noms: MER_CR_OUVERT.cr.missionnaire, role: 'assistant Chorus DT' });
    } else {
        JUMELAGE_BOITE_FICHIER(id).then(function(f) { return f.text(); }).then(function(t) {
            var d = (LIRE_JSON_MER(t).demandes || [])[0] || {};
            suite({ dest: d.mailDemandeur, ref: d.id, objet: d.objet, noms: d.personnes ? RESUME_DEMANDE(d).noms : '', role: 'assistant Chorus DT' });
        }).catch(function(e) { MSG_ERREUR('Question impossible', e.message || String(e)); });
    }
}
// Le missionnaire répond (quelques mots) : la réponse repart chiffrée vers celui qui a posé la question.
function REPONDRE_QUESTION(id) {
    var x = (JUMELAGE_BOITE_LISTE() || []).filter(function(y) { return y.id === id; })[0]; if (!x) return;
    JUMELAGE_BOITE_MARQUER(id, 'ouvert');
    AFFICHER_MODALE('Répondre',
        '<p style="font-size:0.86em; line-height:1.5;"><b>' + ESC(x.noms || x.de) + '</b> vous demande, sur « ' + ESC(x.objet || 'votre demande') + ' » :</p>' +
        '<div class="MER-QUESTION"><b>❓ ' + ESC(x.question) + '</b></div>' +
        '<textarea id="MER-REPONSE-TXT" rows="4" style="width:100%; box-sizing:border-box; padding:10px; border-radius:10px; border:1.5px solid var(--tg-border); font:inherit;" placeholder="Votre réponse"></textarea>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Plus tard</button><button type="button" class="BTN BTN-PRIMARY" id="MER-REPONSE-GO">Envoyer la réponse</button>');
    setTimeout(function() {
        var t = document.getElementById('MER-REPONSE-TXT'); if (t) t.focus();
        document.getElementById('MER-REPONSE-GO').onclick = function() {
            var r = (t.value || '').trim(); if (r.length < 2) { t.focus(); return; }
            var b = this; b.disabled = true; b.textContent = 'Envoi…';
            JUMELAGE_ENVOYER_DIRECT(x.de, 'REPONSE', 'Reponse.json', JSON.stringify({ app: 'TRIGONE-REPONSE', ref: x.ref, genre: x.genre, objet: x.objet, question: x.question, reponse: r,
                qui: window.JUMELAGE_QUI ? JUMELAGE_QUI() : '' }), { differable: true, libelle: 'Votre réponse' }).then(function() {
                JUMELAGE_BOITE_MARQUER(id, 'traite');
                FERMER_MODALE(); RECU_REAFFICHER();
                MSG_INFO('Réponse envoyée', 'Elle arrive chez ' + (x.noms || x.de) + ', avec une notification : votre dossier peut avancer.', '✅');
            }).catch(function(e) { b.disabled = false; b.textContent = 'Envoyer la réponse'; MSG_ERREUR('Réponse non envoyée', e.message || String(e)); });
        };
    }, 50);
}
// ASSIST CHORUS DT : PDF final (demande signée + NDS / DAF) d'un envoi reçu, en aperçu ou téléchargé.
// Les signatures et les pièces jointes sont contrôlées d'abord : une demande non conforme ne donne pas de PDF.
function CHORUS_PDF_RECU(id, apercu) {
    var w = apercu ? window.open('', '_blank') : null;   // ouverte tout de suite, sinon le navigateur la bloque
    AFFICHER_MSG_CENTRE({ titre: apercu ? 'Préparation de l\'aperçu…' : 'Génération du PDF…', texte: 'Contrôle des signatures et des pièces jointes, puis assemblage du PDF.', icone: '⏳', mascotte: false, boutons: [] });
    var demandes;
    JUMELAGE_BOITE_FICHIER(id).then(function(f) { return f.text(); }).then(function(t) {
        var data = LIRE_JSON_MER(t);
        return Promise.all([CHARGER_LISTE_VALIDEURS(), STOCKER_PJ_IMPORTEES([data])]).then(function(r) {
            var alterees = r[1];
            return Promise.all(data.demandes.map(function(d) {
                return VERIFIER_VALIDATIONS(d).then(function(verif) { return { d: d, source: 'json', verif: verif, pjAlterees: alterees[d.id] || [] }; });
            }));
        });
    }).then(function(res) {
        var ko = res.filter(function(x) { return !EST_CONFORME(x); });
        if (ko.length) {
            var e = new Error((ko.length > 1 ? ko.length + ' demandes ne sont pas conformes' : 'La demande de ' + RESUME_DEMANDE(ko[0].d).noms + ' n\'est pas conforme') +
                ' (signature manquante ou invalide, ou pièce jointe modifiée). Touchez « Contrôle détaillé » pour voir le détail, et renvoyez-la si besoin.');
            e.nonConforme = true; throw e;
        }
        demandes = res.map(function(x) { return x.d; });
        return GENERER_PDF_FINAL(demandes);
    }).then(function(octets) {
        FERMER_MSG();
        if (apercu) {
            var url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }));
            if (w) w.location = url; else window.open(url, '_blank');
            JUMELAGE_BOITE_MARQUER(id, 'ouvert');
            return;
        }
        TELECHARGER_OCTETS(NOM_FICHIER_BASE(demandes, 'PDF_FINAL') + '.pdf', octets, 'application/pdf');
        // La demande reste « à traiter » : « ✔ Traité » apparaît sur sa ligne, à toucher une fois l'ordre de mission créé.
        if (window.JUMELAGE_BOITE_PDF_FAIT) JUMELAGE_BOITE_PDF_FAIT(id);
        if (PAGE_ACTUELLE === 'CHORUS') RECU_REAFFICHER();
    }).catch(function(e) {
        if (w) w.close();
        FERMER_MSG();
        setTimeout(function() { MSG_ERREUR(e.nonConforme ? 'Demande non conforme' : 'PDF impossible', e.message || String(e)); }, 350);
    });
}
// « ✔ Traité » (après le PDF) : l'ordre de mission est créé dans Chorus DT. La demande passe en « Traités » et le
// missionnaire (et ses valideurs) sont prévenus : la dernière étape de leur frise, Chorus DT, passe au vert.
function CHORUS_TRAITER(id) {
    var x = (JUMELAGE_BOITE_LISTE() || []).filter(function(e) { return e.id === id; })[0]; if (!x) return;
    MSG_CONFIRM('Demande traitée ?', 'L\'ordre de mission ' + (x.noms ? 'de ' + x.noms + ' ' : '') + 'est créé dans Chorus DT ? Le missionnaire en est prévenu, et la demande passe dans vos « Traités ».',
        '✔ Oui, traitée', function() { CHORUS_MARQUER_TRAITE(id); }, '✅', 'mascotte-ok.webp');
}
function CHORUS_MARQUER_TRAITE(id) {
    var x = (JUMELAGE_BOITE_LISTE() || []).filter(function(e) { return e.id === id; })[0]; if (!x) return;
    if (window.JUMELAGE_BOITE_TRAITER_DEMANDES && (x.ids || []).length) JUMELAGE_BOITE_TRAITER_DEMANDES(x.ids, ['chorus']);
    else JUMELAGE_BOITE_MARQUER(id, 'traite');
    if (PAGE_ACTUELLE === 'CHORUS') RECU_REAFFICHER();
}
// PDF produit depuis le « Contrôle détaillé » : les envois qui ne contiennent que ces demandes attendent leur « ✔ Traité ».
function CHORUS_PDF_FAIT_DEMANDES(ids) {
    if (!window.JUMELAGE_BOITE_PDF_FAIT) return;
    (JUMELAGE_BOITE_LISTE() || []).forEach(function(x) {
        if (x.nature === 'chorus' && x.statut !== 'traite' && (x.ids || []).length && x.ids.every(function(i) { return ids.indexOf(i) >= 0; })) JUMELAGE_BOITE_PDF_FAIT(x.id);
    });
}
// Envoi classé « traité » : il repasse « à traiter » (ex. classé trop tôt), puis s'ouvre.
function ROUVRIR_RECU(id) {
    JUMELAGE_BOITE_ROUVRIR(id);
    OUVRIR_RECU(id);
}
// Mission collective reçue : ouverture du compte-rendu participant (Compte-rendu, ?data= : données de la mission du chef).
function OUVRIR_COLLECTIVE_RECU(id) {
    var x = (JUMELAGE_BOITE_LISTE() || []).filter(function(e) { return e.id === id; })[0];
    if (!x || !/^[A-Za-z0-9+/=]+$/.test(x.donnees || '')) { MSG_ERREUR('Envoi illisible', 'Demandez à votre chef de mission de vous le renvoyer.'); return; }
    JUMELAGE_BOITE_MARQUER(id, 'traite');
    location.href = 'cr/?data=' + encodeURIComponent(x.donnees);
}
function SUPPRIMER_RECU(id) {
    MSG_CONFIRM('Supprimer de la boîte ?', 'Cet envoi sera retiré de votre boîte de réception sur cet appareil. S\'il n\'a pas été traité, demandez à l\'expéditeur de le renvoyer.',
        'Supprimer', function() { JUMELAGE_BOITE_SUPPRIMER(id).then(function() {
            MER_BX_SEL.RECEPTION = MER_BX_SEL.CHORUS = null;
            if (PAGE_ACTUELLE === 'RECEPTION' || PAGE_ACTUELLE === 'CHORUS') SHOW_PAGE(PAGE_ACTUELLE);
            MER_TOAST('Supprimé', 'Retiré de votre boîte de réception sur cet appareil.');
        }); }, '⚠️', 'mascotte-poubelle.webp', true);
}
// Nouveaux envois relevés : bandeau (touchable) et pages à jour.
window.JUMELAGE_APRES_RELEVE = function(nouveaux) {
    // n : nombre de demandes (un envoi peut en contenir plusieurs).
    var x = nouveaux[0], n = nouveaux.reduce(function(t, e) { return t + (e.n > 1 ? e.n : 1); }, 0);
    var chorus = MER_ROLE_CHORUS() && nouveaux.every(MER_EST_CHORUS);
    if (nouveaux.length === 1 && x.nature === 'collective') {
        MER_BANDEAU_RECU('Mission collective', [x.objet, x.dates].filter(Boolean).join(' · ') + ' — de ' + (x.noms || x.de || '?') + '. Touchez pour ouvrir votre compte-rendu prérempli.', function() { OUVRIR_COLLECTIVE_RECU(x.id); });
        return;
    }
    // Question (à vous) ou réponse (à votre question) : texte affiché directement.
    if (nouveaux.length === 1 && (x.nature === 'question' || x.nature === 'reponse')) {
        MER_BANDEAU_RECU(x.nature === 'question' ? 'Question sur votre demande' : 'Réponse à votre question', (x.noms || x.de || '?') + ' : « ' + (x.nature === 'question' ? x.question : x.reponse).slice(0, 140) + ' » Touchez pour ' + (x.nature === 'question' ? 'répondre.' : 'la voir.'),
            function() { OUVRIR_DOSSIER('RECEPTION', 'questions'); if (x.nature === 'question') setTimeout(function() { REPONDRE_QUESTION(x.id); }, 300); });
        return;
    }
    var tousJustif = nouveaux.every(function(e) { return e.nature === 'justif'; });
    MER_BANDEAU_RECU(tousJustif ? (nouveaux.length > 1 ? nouveaux.length + ' justificatifs reçus par mail' : 'Justificatif reçu par mail') : x.nature === 'cr' && n === 1 ? 'Compte-rendu reçu' : n > 1 ? n + ' demandes reçues' : 'Demande reçue', (nouveaux.length > 1 ? 'Dernière : ' : '') + [x.noms, x.objet].filter(Boolean).join(' · ') + ' — de ' + (x.de || '?') + '. Touchez pour ouvrir ' +
        (chorus ? 'l\'espace Assistant Chorus DT.' : 'la boîte de réception.'), function() { var pg = chorus ? 'CHORUS' : 'RECEPTION'; OUVRIR_DOSSIER(pg, MER_DOSSIER_DE(pg, x)); });
};
// Mise en route choisie sur l'écran de choix alors que l'espace Assistant Chorus DT était affiché dessous : accueil.
window.JUMELAGE_APRES_CHOIX = function() {
    if (typeof PAGE_ACTUELLE !== 'undefined' && (PAGE_ACTUELLE === 'CHORUS' || PAGE_ACTUELLE === 'VERIFIER')) { MER_RESULTATS_VERIF = null; SHOW_PAGE('ACCUEIL'); window.scrollTo(0, 0); }
};
window.addEventListener('trigone-boite', function() {
    if (typeof PAGE_ACTUELLE === 'undefined' || (typeof DEMO_ACTIF !== 'undefined' && DEMO_ACTIF)) return;
    if (PAGE_ACTUELLE === 'RECEPTION' || PAGE_ACTUELLE === 'ACCUEIL' || (PAGE_ACTUELLE === 'CHORUS' && !MER_RESULTATS_VERIF)) { var y = window.scrollY; SHOW_PAGE(PAGE_ACTUELLE); window.scrollTo(0, y); }
    else RENDRE_MENU_PC();
});
// Demandes signées sur un autre de mes appareils (PC ↔ téléphone) : retirées de l'Espace valideur d'ici, sauf si une
// décision y a déjà été prise (elle reste à transmettre).
window.addEventListener('trigone-traite-ailleurs', function(ev) {
    var suffixe = { niveau1: '#0', renvoi: '#0', niveau2: '#1' }, retirer = {};
    (ev.detail || []).forEach(function(t) { if (suffixe[t.nature]) (t.ids || []).forEach(function(i) { retirer[i + suffixe[t.nature]] = 1; }); });
    if (!Object.keys(retirer).length) return;
    var avant = GET_A_VALIDER(), apres = avant.filter(function(e) { return e.decision || !retirer[e.id]; });
    if (apres.length === avant.length) return;
    SAVE_A_VALIDER(apres);
    if (typeof PAGE_ACTUELLE !== 'undefined' && PAGE_ACTUELLE === 'VALIDATION' && typeof RENDER_VALIDATION_INPLACE === 'function') RENDER_VALIDATION_INPLACE();
});
function MER_RELEVER_BOITE() { if (window.JUMELAGE_RELEVER) JUMELAGE_RELEVER(); }
function MER_BANDEAU_RECU(titre, texte, surClic) {
    var b = document.createElement('div');
    b.className = 'MER-BANDEAU-RECU' + (surClic ? ' cliquable' : '');
    b.innerHTML = '<span class="MER-BANDEAU-RECU-IC">📥</span><span><b>' + ESC(titre) + '</b><br>' + ESC(texte) + '</span>';
    if (surClic) b.addEventListener('click', function() { b.remove(); surClic(); });
    document.body.appendChild(b);
    requestAnimationFrame(function() { b.classList.add('visible'); if (window.JUMELAGE_GLISSER_FERMER) JUMELAGE_GLISSER_FERMER(b, -1); });
    setTimeout(function() { b.classList.remove('visible'); setTimeout(function() { b.remove(); }, 400); }, surClic ? 10000 : 6000);
}
// Espace valideur vide : les demandes à signer arrivent dans la Boîte de réception TRIGONE.
function TPL_AIDE_RECEPTION() {
    return '<div class="MER-AIDE-RECEPTION"><div class="MER-AIDE-RECEPTION-TETE"><span>📥</span><div><b>Une demande à signer ?</b><small>Elle arrive dans votre Boîte de réception TRIGONE</small></div></div>' +
        (MER_COMPTE_ACTIF()
            ? '<ol><li>Les demandes qui vous sont envoyées arrivent toutes seules, chiffrées, dans votre <b>Boîte de réception</b>.</li><li>Touchez <b>« Ouvrir et signer »</b> : la demande s\'affiche ici, prête à valider.</li></ol>' +
              '<button type="button" class="BTN BTN-PRIMARY" style="margin:12px 0 0;" onclick="SHOW_PAGE(\'RECEPTION\')">Ouvrir ma boîte de réception' + (MER_NB_BOITE() ? ' (' + MER_NB_BOITE() + ')' : '') + '</button>'
            : '<ol><li>Activez votre <b>compte TRIGONE</b> (votre adresse mail, vérifiée par un code).</li><li>Cochez votre rôle dans <b>Réglages › Mes rôles</b> : les demandes à signer vous arrivent alors directement.</li></ol>' +
              '<button type="button" class="BTN BTN-PRIMARY" style="margin:12px 0 0;" onclick="JUMELAGE_COMPTE()">Se connecter à TRIGONE</button>') + '</div>';
}
