// ===================== TRIGONE MISE EN ROUTE — logique =====================
var MER_VERSION = 1;          // version du format des fichiers .json échangés
// Version du code de l'appli : à augmenter à chaque publication, avec « appCodeVersion » dans updates-manifest.json.
var APP_CODE_VERSION = 19;
var STORAGE_PANIER = 'mer_panier';
var STORAGE_BROUILLON = 'mer_brouillon';
var STORAGE_REGLAGES = 'mer_reglages';

var MOYENS = { SERVICE: 'Véhicule de service', FERREE: 'Voie ferrée', AERIENNE: 'Voie aérienne', MARITIME: 'Voie maritime' };

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
        nourriDeplacement: false, transportCommun: false, autresDeplacement: false, autresDeplacementTexte: '',
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
    try { return JSON.parse(localStorage.getItem(STORAGE_REGLAGES) || '{}'); } catch (e) { return {}; }
}
function SAVE_REGLAGES(r) { try { localStorage.setItem(STORAGE_REGLAGES, JSON.stringify(r)); } catch (e) {} }

function GET_PANIER() {
    try { return JSON.parse(localStorage.getItem(STORAGE_PANIER) || '[]'); } catch (e) { return []; }
}
function SAVE_PANIER(liste) { try { localStorage.setItem(STORAGE_PANIER, JSON.stringify(liste)); } catch (e) {} }

// Le brouillon en cours est sauvegardé à chaque frappe, exactement comme TRIGONE compte-rendu : fermer
// l'application en pleine saisie ne doit rien faire perdre.
function SAVE_BROUILLON() {
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
function CLEAR_BROUILLON() { try { localStorage.removeItem(STORAGE_BROUILLON); } catch (e) {} D = VIDE_DEMANDE(); MER_ACTIVE_TAB = 'IDENTITE'; }

function TOGGLE_THEME() {
    document.body.classList.toggle('dark-mode');
    var dark = document.body.classList.contains('dark-mode');
    try { localStorage.setItem('mer_dark', dark ? '1' : '0'); } catch (e) {}
    document.getElementById('THEME-TOGGLE-BTN').textContent = dark ? '☀️' : '🌙';
}
function APPLIQUER_THEME_INITIAL() {
    var dark = false;
    try { dark = localStorage.getItem('mer_dark') === '1'; } catch (e) {}
    if (dark) { document.body.classList.add('dark-mode'); document.getElementById('THEME-TOGGLE-BTN').textContent = '☀️'; }
}

// ===================== PAGE ACCUEIL =====================
function SHOW_PAGE(page) {
    PAGE_ACTUELLE = page;
    var zone = document.getElementById('PAGE-STAGE');
    zone.classList.toggle('avec-marge', page !== 'ACCUEIL');
    if (page === 'ACCUEIL') zone.innerHTML = TPL_ACCUEIL();
    else if (page === 'FORMULAIRE') zone.innerHTML = TPL_FORMULAIRE();
    else if (page === 'PANIER') zone.innerHTML = TPL_PANIER();
    else if (page === 'VALIDATION') { OUVRIR_VALIDATION(); return; }
    else if (page === 'VERIFIER') zone.innerHTML = TPL_VERIFIER();
    else if (page === 'ADMIN') zone.innerHTML = TPL_ADMIN();
    else if (page === 'BIBLIOTHEQUE') zone.innerHTML = TPL_BIBLIOTHEQUE();
    else if (page === 'ESPACE') zone.innerHTML = TPL_MON_ESPACE();
    else if (page === 'NOTICE') zone.innerHTML = TPL_NOTICE();
    window.scrollTo(0, 0);
}

var MER_ICONES = {
    BIBLIOTHEQUE: '<svg viewBox="0 0 24 24"><path d="M12 6.3c-1.7-1.3-3.9-2-6.3-2A2 2 0 0 0 3.7 6.3v10.9a2 2 0 0 0 2 2c2.2 0 4.3.6 6 1.8M12 6.3c1.7-1.3 3.9-2 6.3-2a2 2 0 0 1 2 2v10.9a2 2 0 0 1-2 2c-2.2 0-4.3.6-6 1.8M12 6.3v14.7"/></svg>',
    PANIER: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg>',
    ESPACE: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.4"/><path d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3"/></svg>',
    NOTICE: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 15.7v-5M12 8h.01"/></svg>'
};
function TPL_ONGLET_DOCK(page, icone, libelle, pastille) {
    return '<button type="button" class="P0-TAB' + (pastille ? ' has-badge' : '') + '" onclick="SHOW_PAGE(\'' + page + '\')">' +
        '<span class="P0-TAB-ICON" aria-hidden="true">' + icone + '</span><span class="P0-TAB-LBL">' + libelle + '</span></button>';
}
function TPL_ACCUEIL() {
    var n = GET_PANIER().length;
    return '' +
    '<div id="MER-P0">' +
      '<div class="MER-P0-SHELL">' +
        '<button type="button" id="BTN-CHECK-UPDATE" class="P0-REF-BTN" onclick="VERIFIER_MISE_A_JOUR_MANUELLE()" title="Vérifier si une mise à jour est disponible">🔄 Mise à jour</button>' +
        '<div class="MER-P0-INNER">' +
          '<div class="MER-LOGO-WRAP"><img class="MER-LOGO-IMG" src="logo_mer.webp" alt="TRIGONE — Mise en route"></div>' +
        '</div>' +
        '<div class="MER-P0-HERO">' +
          '<button type="button" class="BTN-ACCUEIL" onclick="NOUVELLE_DEMANDE()">Nouvelle demande</button>' +
          '<button type="button" class="BTN-ACCUEIL BTN-ACCUEIL-PETIT" onclick="SHOW_PAGE(\'VALIDATION\')">Espace valideur</button>' +
        '</div>' +
        '<p class="app-credit">Conçu par Germain-Pierre BOUQUET <span class="APP-VERSION-TAG">- V' + APP_CODE_VERSION + '</span></p>' +
        '<nav class="P0-TAB-BAR" aria-label="Navigation accueil"><div class="P0-DOCK-INNER">' +
          TPL_ONGLET_DOCK('BIBLIOTHEQUE', MER_ICONES.BIBLIOTHEQUE, 'Bibliothèque') +
          TPL_ONGLET_DOCK('PANIER', MER_ICONES.PANIER, 'Panier' + (n ? ' (' + n + ')' : ''), n > 0) +
          TPL_ONGLET_DOCK('NOTICE', MER_ICONES.NOTICE, 'Notice') +
          TPL_ONGLET_DOCK('ESPACE', MER_ICONES.ESPACE, 'Mon espace') +
        '</div></nav>' +
      '</div>' +
    '</div>';
}

// ===================== BIBLIOTHÈQUE (demandes envoyées) =====================
var STORAGE_BIBLIOTHEQUE = 'mer_bibliotheque';
function GET_BIBLIOTHEQUE() {
    try { return JSON.parse(localStorage.getItem(STORAGE_BIBLIOTHEQUE) || '[]'); } catch (e) { return []; }
}
function SAVE_BIBLIOTHEQUE(l) { try { localStorage.setItem(STORAGE_BIBLIOTHEQUE, JSON.stringify(l.slice(0, 50))); } catch (e) {} }
function ARCHIVER_ENVOI(demandes, destinataire) {
    var l = GET_BIBLIOTHEQUE();
    l.unshift({ id: 'e' + Date.now(), envoyeLe: new Date().toISOString(), destinataire: destinataire, demandes: demandes });
    SAVE_BIBLIOTHEQUE(l);
}
function TPL_BIBLIOTHEQUE() {
    var l = GET_BIBLIOTHEQUE();
    var items = l.map(function(e) {
        var noms = e.demandes.map(function(d) { return RESUME_DEMANDE(d).noms; }).join(' · ');
        var objets = e.demandes.map(function(d) { return d.objet || ''; }).join(' · ');
        return '<div class="MER-PANIER-ITEM" style="align-items:flex-start;"><div class="MER-PANIER-ITEM-TXT">' +
            '<span class="MER-BADGE">Envoyée le ' + ESC(new Date(e.envoyeLe).toLocaleDateString('fr-FR')) + '</span>' +
            '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(noms) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + e.demandes.length + ' demande(s) — ' + ESC(objets) + (e.destinataire ? '<br>À ' + ESC(e.destinataire) : '') + '</div>' +
            '<div class="MER-VAL-ACTIONS">' +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="BIB_PDF(\'' + e.id + '\')">PDF</button>' +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="BIB_REUTILISER(\'' + e.id + '\')">Refaire une demande</button>' +
                '<button type="button" class="BTN-DANGER-TEXT" onclick="BIB_SUPPRIMER(\'' + e.id + '\')">Supprimer</button>' +
            '</div></div></div>';
    }).join('');
    return '<div class="CARD"><h2>Bibliothèque</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Vos demandes de mise en route déjà envoyées.</p>' +
        (items || '<div class="MER-EMPTY">Aucune demande envoyée pour l\'instant.</div>') +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}
function BIB_TROUVER(id) { return GET_BIBLIOTHEQUE().filter(function(e) { return e.id === id; })[0]; }
function BIB_PDF(id) {
    var e = BIB_TROUVER(id); if (!e) return;
    try { GENERER_PDF(e.demandes).save(NOM_FICHIER_BASE(e.demandes) + '.pdf'); }
    catch (err) { MSG_ERREUR('PDF impossible', 'Erreur lors de la génération du PDF : ' + err.message); }
}
// Repart d'une demande envoyée (même objet, mêmes personnes) pour en créer une nouvelle.
function BIB_REUTILISER(id) {
    var e = BIB_TROUVER(id); if (!e) return;
    var d = JSON.parse(JSON.stringify(e.demandes[0]));
    d.id = VIDE_DEMANDE().id; d.validations = []; delete d.refus;
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
        return '<div class="MER-FIELD"><label>' + label + '</label><input type="email" value="' + ESC(r[k] || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" ' +
            'oninput="SET_REGLAGE(\'' + k + '\', this.value)">' + (hint ? '<p class="MER-HINT">' + hint + '</p>' : '') + '</div>';
    }
    return '<div class="CARD"><h2>Mon espace</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Enregistré sur cet appareil uniquement. Utilisé pour pré-remplir vos demandes.</p>' +
        '<div class="MER-SECTION-TITLE">Mon identité</div>' +
        '<div class="MER-ROW2">' + champId('unite', 'Unité / entité', 'EX : 4°RIISC') + champId('cie', 'CIE', 'EX : 4CIE') + '</div>' +
        '<div class="MER-ROW2">' + champId('grade', 'Grade', 'EX : ADJUDANT') + champId('matricule', 'Matricule', 'EX : 067 50 10 191') + '</div>' +
        '<div class="MER-ROW2">' + champId('nom', 'Nom', 'EX : BOUQUET') + champId('prenom', 'Prénom', 'EX : G-P') + '</div>' +
        '<div class="MER-SECTION-TITLE">Envoi de mes demandes</div>' +
        champMail('mailSignataire', 'Mail du 1er valideur (chef de service)') +
        champMail('mailDemandeur', 'Mon mail', 'Pour vous renvoyer une demande si un valideur la refuse.') +
        '<div class="MER-SECTION-TITLE">Sécurité — code d\'accès</div>' +
        (PIN_EST_DEFINI()
            ? '<p class="MER-HINT" style="margin:0 0 10px;">🔒 Code activé : il est demandé à chaque ouverture de l\'application.</p>' +
              '<button type="button" class="BTN BTN-GHOST" onclick="OUVRIR_ECRAN_PIN(\'suppression\')">Désactiver le code</button>'
            : '<p class="MER-HINT" style="margin:0 0 10px;">Protégez l\'application par un code à 4 chiffres, demandé à chaque ouverture. Utile si votre téléphone n\'est pas verrouillé ou est partagé.</p>' +
              '<button type="button" class="BTN BTN-GHOST" onclick="OUVRIR_ECRAN_PIN(\'creation\')">Activer un code à 4 chiffres</button>') +
        '<div class="MER-SECTION-TITLE">Application</div>' +
        '<button type="button" class="BTN BTN-GHOST" onclick="PROPOSER_INSTALLATION(true)">📲 Installer l\'application</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button>' +
        '<button type="button" class="P0-LIEN" style="opacity:0.6;" onclick="OUVRIR_ADMIN()">Administration des valideurs</button></div>';
}

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
    document.getElementById('PAGE-STAGE').innerHTML = TPL_FORMULAIRE();
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
    return '<div class="MER-FIELD"><label>' + label + '</label>' +
        '<div class="MER-TOGGLE-PAIR">' +
        '<button type="button" class="MER-TOGGLE-BTN' + (v ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'' + path + '\', true)">OUI</button>' +
        '<button type="button" class="MER-TOGGLE-BTN' + (!v ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'' + path + '\', false)">NON</button>' +
        '</div>' + (hint ? '<p class="MER-HINT">' + hint + '</p>' : '') + '</div>';
}

function SELECT_MOYEN(path) {
    var v = GET_CHAMP(path) || '';
    var opts = ['', 'SERVICE', 'FERREE', 'AERIENNE', 'MARITIME'].map(function(k) {
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
function AJOUTER_PERSONNE() { D.personnes.push(VIDE_PERSONNE()); SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }
function RETIRER_PERSONNE(i) { D.personnes.splice(i, 1); SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }

// Pays étrangers : liste reprise de TRIGONE compte-rendu. Vide = France.
var MER_PAYS = ["AFGHANISTAN", "AFRIQUE DU SUD", "ALBANIE", "ALGERIE", "ALLEMAGNE", "ANDORRE", "ANGOLA", "ANGUILLA", "ANTIGUA ET BARBUDA", "ARABIE SAOUDITE", "ARGENTINE", "ARMENIE", "ARUBA", "AUSTRALIE", "AUTRICHE", "AZERBAIDJAN", "BAHAMAS", "BAHREIN", "BANGLADESH", "BELGIQUE", "BELIZE", "BENIN", "BERMUDES", "BIELORUSSIE", "BIRMANIE", "BOLIVIE", "BOSNIE-HERZEGOVINE", "BOTSWANA", "BRESIL", "BRUNEI", "BULGARIE", "BURKINA FASO", "BURUNDI", "CAIMANS (iles)", "CAMBODGE", "CAMEROUN", "CANADA", "CAP-VERT", "CENTRAFRICAINE (Republique)", "CHILI", "CHINE", "CHYPRE", "COLOMBIE", "COMORES", "CONGO (Republique democratique du)", "CONGO BRAZZAVILLE", "COOK (iles)", "COREE DU NORD", "COREE DU SUD", "COSTA RICA", "COTE D'IVOIRE", "CROATIE", "CUBA", "CURACAO", "DANEMARK", "DJIBOUTI", "DOMINICAINE (Republique)", "EGYPTE", "EMIRATS ARABES UNIS", "EQUATEUR", "ERYTHREE", "ESPAGNE", "ESTONIE", "ETATS-UNIS", "ETATS-UNIS (hors New York)", "ETHIOPIE", "FIDJI", "FINLANDE", "GABON", "GAMBIE", "GEORGIE", "GHANA", "GRANDE-BRETAGNE", "GRECE", "GRENADE", "GUATEMALA", "GUINEE", "GUINEE EQUATORIALE", "GUINEE-BISSAU", "GUYANA", "HAITI", "HONDURAS", "HONG KONG", "HONGRIE", "INDE", "INDONESIE", "IRAK", "IRAN", "IRLANDE", "ISLANDE", "ISRAEL", "ITALIE", "JAMAIQUE", "JAPON", "JORDANIE", "KAZAKHSTAN", "KENYA", "KIRGHIZISTAN", "KIRIBATI", "KOSOVO", "KOWEIT", "LA BARBADE", "LA DOMINIQUE", "LAOS", "LESOTHO", "LETTONIE", "LIBAN", "LIBERIA", "LIBYE", "LIECHTENSTEIN", "LITUANIE", "LUXEMBOURG", "MACAO", "MACEDOINE", "MADAGASCAR", "MALAISIE", "MALAWI", "MALDIVES (iles)", "MALI", "MALTE", "MAROC", "MARSHALL (iles)", "MAURICE", "MAURITANIE", "MEXIQUE", "MICRONESIE", "MOLDAVIE", "MONGOLIE EXTERIEURE", "MONTENEGRO", "MOZAMBIQUE", "NAMIBIE", "NAURU", "NEPAL", "NICARAGUA", "NIGER", "NIGERIA", "NIUE", "NORVEGE", "NOUVELLE-ZELANDE", "OMAN", "OUGANDA", "OUZBEKISTAN", "PAKISTAN", "PALAOS (iles)", "PANAMA", "PAPOUASIE-NOUVELLE-GUINEE", "PARAGUAY", "PAYS-BAS", "PEROU", "PHILIPPINES", "POLOGNE", "PORTUGAL", "QATAR", "ROUMANIE", "RUSSIE", "RWANDA", "SAINT-CHRISTOPHE-ET-NIEVES", "SAINT-VINCENT ET LES GRENADINES", "SAINTE-LUCIE", "SALOMON", "SALVADOR", "SAMOA", "SAO TOME ET PRINCIPE", "SENEGAL", "SERBIE", "SEYCHELLES", "SIERRA LEONE", "SINGAPOUR", "SLOVAQUIE", "SLOVENIE", "SOMALIE", "SOUDAN", "SOUDAN DU SUD", "SRI LANKA", "SUEDE", "SUISSE", "SURINAME", "SWAZILAND", "SYRIE", "TADJIKISTAN", "TAIWAN", "TANZANIE", "TCHAD", "TCHEQUE (Republique)", "THAILANDE", "TIMOR ORIENTAL", "TOGO", "TONGA", "TRINITE ET TOBAGO", "TUNISIE", "TURKMENISTAN", "TURQUIE", "TUVALU", "UKRAINE", "URUGUAY", "VANUATU", "VENEZUELA", "VIETNAM", "YEMEN", "ZAMBIE", "ZIMBABWE"];

function TPL_LIEU(label, path, cote) {
    var t = GET_CHAMP(path), pays = t['pays' + cote] || '', id = 'MER-VILLES-' + path.replace(/\./g, '-') + cote;
    var options = '<option value="">France</option>' + MER_PAYS.map(function(p) {
        return '<option value="' + ESC(p) + '"' + (p === pays ? ' selected' : '') + '>' + ESC(p) + '</option>';
    }).join('');
    var ville = '<div class="MER-FIELD"><label>' + label + '</label>' +
        '<input type="text" data-path="' + path + '.lieu' + cote + '" value="' + ESC(t['lieu' + cote] || '') + '" ' +
        'placeholder="' + (pays ? 'EX : Berlin' : 'EX : Bordeaux') + '" autocomplete="off"' + (pays ? '' : ' list="' + id + '"') + ' ' +
        'oninput="ON_CHAMP_INPUT(\'' + path + '.lieu' + cote + '\', this.value)' + (pays ? '' : '; SUGGERER_VILLES(this, \'' + id + '\')') + '" ' +
        (pays ? '' : 'onchange="CHOISIR_VILLE(\'' + path + '\', \'' + cote + '\', this)"') + '>' +
        (pays ? '' : '<datalist id="' + id + '"></datalist>') + '</div>';
    return '<div class="MER-ROW2">' + ville +
        (pays ? '' : CHAMP_TXT('Code postal', path + '.cp' + cote, 'Automatique')) + '</div>' +
        '<div class="MER-FIELD" style="margin-top:-8px;"><label>Pays</label><select data-path="' + path + '.pays' + cote + '" ' +
        'onchange="ON_CHAMP_BOOL(\'' + path + '.pays' + cote + '\', this.value)">' + options + '</select></div>';
}
function TPL_TRAJET(titre, path, optionnel) {
    return (titre ? '<p class="MER-HINT" style="font-weight:800; text-transform:uppercase; letter-spacing:0.04em; margin:14px 0 8px;">' + titre + (optionnel ? ' <span style="font-weight:600; text-transform:none;">(si besoin)</span>' : '') + '</p>' : '') +
        SELECT_MOYEN(path + '.moyen') +
        TPL_LIEU('Lieu de départ', path, 'Dep') +
        CHAMP_TXT('Date et heure de départ', path + '.dateDep', '', 'datetime-local') +
        TPL_LIEU('Lieu d\'arrivée', path, 'Arr') +
        CHAMP_TXT('Date et heure d\'arrivée', path + '.dateArr', '', 'datetime-local');
}

// Communes françaises : même service que TRIGONE compte-rendu (Base adresse nationale, api-adresse.data.gouv.fr).
var MER_API_COMMUNES = 'https://api-adresse.data.gouv.fr/search/?type=municipality&autocomplete=1&limit=6&q=';
var MER_MINUTEUR_VILLES = null;
function CHERCHER_COMMUNES(q) {
    return fetch(MER_API_COMMUNES + encodeURIComponent(q)).then(function(r) { return r.json(); }).then(function(d) {
        return (d.features || []).map(function(f) {
            return { ville: (f.properties.city || f.properties.name || '').toUpperCase(), cp: f.properties.postcode || '' };
        }).filter(function(c) { return c.ville && c.cp; });
    });
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
    }).catch(function() {});
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
            exiger(base + 'lieuDep', b[1] + ' : lieu de départ');
            if (!tr.paysDep) exiger(base + 'cpDep', b[1] + ' : code postal de départ');
            exiger(base + 'dateDep', b[1] + ' : date et heure de départ');
            exiger(base + 'lieuArr', b[1] + ' : lieu d\'arrivée');
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
      '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="AJOUTER_PERSONNE()">+ Ajouter une personne (demande collective)</button>';
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

function TPL_ONGLET_CONDITIONS() {
    return '<div class="MER-SECTION-TITLE" style="margin-top:0;">Durant le déplacement</div>' +
      TOGGLE_OUI_NON('Nourri à titre onéreux', 'nourriDeplacement') +
      TOGGLE_OUI_NON('Transport en commun', 'transportCommun') +
      '<div class="MER-SECTION-TITLE">Durant la mission</div>' +
      TOGGLE_OUI_NON('Nourri à titre onéreux', 'nourriMission', 'Repas midi gratuit, repas du soir secteur privé, sauf indication contraire.') +
      TOGGLE_OUI_NON('Logé à titre onéreux', 'logeMission');
}

// ---- Codier FD (codier.json, extrait du codier FD du 22/07/2026) ----
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
    return '<div class="MER-FD-CARTE">' +
        '<div class="MER-FD-TITRE">✔ ' + ESC(e.lib) + '</div>' +
        ligne('Code engagement', code) + ligne('Centre financier', e.cf) + ligne('Centre de coût', e.cc) + ligne('Code activité', e.act) +
        (e.fin ? '<p class="MER-HINT">Valable jusqu\'au ' + ESC(new Date(e.fin).toLocaleDateString('fr-FR')) + '.</p>' : '') +
    '</div>';
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
      '<div class="MER-FIELD"><label>Note de service ou DAF à joindre</label><textarea rows="2" oninput="ON_CHAMP_INPUT(\'piecesJointes\', this.value)" placeholder="EX : note de service n°... jointe au mail">' + ESC(D.piecesJointes || '') + '</textarea>' +
      '<p class="MER-HINT">Décrivez ici la pièce à joindre — le fichier lui-même s\'ajoute au moment de l\'envoi du mail, comme le PDF.</p></div>';
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
      '<h2>Nouvelle demande</h2>' +
      '<p class="MER-HINT" style="margin:4px 0 16px;">Demande et Ordre de Mise en Route (DOMR)</p>' +
      (D.refus ? '<p class="MER-HINT" style="color:#b91c1c; font-weight:800; margin:-6px 0 16px;">✖ Refusée par ' +
          ESC(D.refus.grade + ' ' + D.refus.nom) + ' : ' + ESC(D.refus.motif) + '</p>' : '') +
      TPL_TABS_BAR() +
      contenu +
      '<div class="MER-BOTTOM-BAR">' +
        (idx === 0
            ? '<button type="button" class="BTN BTN-SECONDARY" style="flex:0 0 auto;" onclick="SHOW_PAGE(\'ACCUEIL\')">Annuler</button>'
            : '<button type="button" class="BTN BTN-SECONDARY" style="flex:0 0 auto;" onclick="MER_TAB_PRECEDENT()">← Précédent</button>') +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="MER_TAB_SUIVANT()">' + (dernier ? 'Ajouter au panier →' : 'Étape suivante →') + '</button>' +
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
    var reg = GET_REGLAGES();
    reg.derniereUnite = p0.unite; reg.derniereCie = p0.cie;
    SAVE_REGLAGES(reg);
    delete D.refus;
    D.validations = [];
    var panier = GET_PANIER();
    panier.push(D);
    SAVE_PANIER(panier);
    CLEAR_BROUILLON();
    SHOW_PAGE('PANIER');
}

function RETIRER_DU_PANIER(id) {
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

function TPL_PANIER() {
    var panier = GET_PANIER();
    var reg = GET_REGLAGES();
    if (!panier.length) {
        return '<div class="CARD">' +
            '<h2>Mon panier</h2>' +
            '<div class="MER-EMPTY">Aucune demande en attente.<br>Créez une nouvelle demande pour commencer.</div>' +
            '<button type="button" class="BTN BTN-PRIMARY" onclick="NOUVELLE_DEMANDE()">+ Nouvelle demande</button>' +
            '<label class="BTN BTN-GHOST BTN-SMALL" style="margin:6px 0 14px;">📥 Importer une demande refusée' +
            '<input type="file" accept=".json,application/json" multiple style="display:none;" onchange="IMPORTER_REFUS(this)"></label>' +
            '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button>' +
        '</div>';
    }
    var items = panier.map(function(d) {
        var r = RESUME_DEMANDE(d);
        var refus = d.refus ? '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">✖ Refusée par ' +
            ESC(d.refus.grade + ' ' + d.refus.nom) + ' : ' + ESC(d.refus.motif) + '<br>Modifiez-la puis renvoyez-la.</div>' : '';
        return '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<div class="MER-PANIER-ITEM-TITRE">' + ESC(r.noms) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(r.sous) + '</div>' + refus +
            '</div><div class="MER-VAL-ACTIONS" style="flex-direction:column; margin:0;">' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="MODIFIER_DEMANDE(\'' + d.id + '\')">Modifier</button>' +
            '<button type="button" class="BTN-DANGER-TEXT" onclick="RETIRER_DU_PANIER(\'' + d.id + '\')">Retirer</button></div></div>';
    }).join('');
    return '<div class="CARD">' +
        '<h2>Mon panier</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 18px;">' + panier.length + ' demande(s) prête(s) à être envoyée(s) ensemble, en un seul mail.</p>' +
        items +
        '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-bottom:8px;" onclick="NOUVELLE_DEMANDE()">+ Ajouter une autre demande</button>' +
        '<label class="BTN BTN-GHOST BTN-SMALL" style="margin:6px 0 14px;">📥 Importer une demande refusée' +
            '<input type="file" accept=".json,application/json" multiple style="display:none;" onchange="IMPORTER_REFUS(this)"></label>' +
        '<div class="MER-SECTION-TITLE">Envoi</div>' +
        '<div class="MER-FIELD"><label>Mail du 1er signataire (chef de service)</label>' +
        '<input type="email" id="MER-MAIL-DEST" value="' + ESC(reg.mailSignataire || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" ' +
        'oninput="var r=GET_REGLAGES(); r.mailSignataire=this.value; SAVE_REGLAGES(r);"></div>' +
        '<div class="MER-FIELD"><label>Votre mail</label>' +
        '<input type="email" id="MER-MAIL-DEMANDEUR" value="' + ESC(reg.mailDemandeur || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" ' +
        'oninput="var r=GET_REGLAGES(); r.mailDemandeur=this.value; SAVE_REGLAGES(r);">' +
        '<p class="MER-HINT">Pour vous renvoyer la demande si un valideur la refuse.</p></div>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="PREPARER_ENVOI()">📧 Envoyer le panier (' + panier.length + ')</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button>' +
    '</div>';
}

// ===================== GÉNÉRATION DU PDF =====================
// Même style que le PDF de TRIGONE compte-rendu (bandeau, titres de section, tableaux autoTable),
// uniquement avec ce que le missionnaire a saisi. Une page par demande, quelle que soit sa longueur.
var PDF_ACCENT = [90, 122, 148], PDF_ZEBRE = [244, 246, 249], PDF_TEXTE = [30, 30, 30];

function PDF_DATE(v) {
    if (!v) return '';
    var dt = new Date(v);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString('fr-FR') + ' ' + ('0' + dt.getHours()).slice(-2) + 'h' + ('0' + dt.getMinutes()).slice(-2);
}
function PDF_OUI_NON(v) { return v ? 'OUI' : 'NON'; }

function PDF_BANDEAU(doc, d, M, L, edition) {
    doc.setFillColor.apply(doc, PDF_ACCENT);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text('TRIGONE', M + 4, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    var unite = d.personnes[0] && d.personnes[0].unite ? d.personnes[0].unite + ' — ' : '';
    doc.text(unite + 'Demande et ordre de mise en route', M + 4, 21);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(d.type === 'FORMATION' ? 'FORMATION / STAGE' : 'MISSION', M + L - 4, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('Édité le ' + edition, M + L - 4, 21, { align: 'right' });
    doc.setTextColor.apply(doc, PDF_TEXTE);
    return 36;
}

function PDF_SECTION(doc, titre, x, y, P) {
    doc.setFillColor.apply(doc, PDF_ACCENT);
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
        headStyles: { fillColor: PDF_ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: P.fTable - 0.5 },
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
    var trajets = [['Aller', t.aller]];
    if (t.intermediaireAllerActif) trajets.push(['Intermédiaire (aller)', t.intermediaireAller]);
    if (t.intermediaireRetourActif) trajets.push(['Intermédiaire (retour)', t.intermediaireRetour]);
    trajets.push(['Retour', t.retour]);
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
        body: [['Nourri à titre onéreux', PDF_OUI_NON(d.nourriDeplacement)],
               ['Transport en commun', PDF_OUI_NON(d.transportCommun)]],
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 30 } }
    }) - P.ecart + 1;
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Durant la mission', '']],
        body: [['Nourri à titre onéreux', PDF_OUI_NON(d.nourriMission)],
               ['Logé à titre onéreux', PDF_OUI_NON(d.logeMission)],
               ['Demande d\'avance', PDF_OUI_NON(d.demandeAvance)]],
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

    if (d.piecesJointes) {
        y = PDF_TABLEAU(doc, y, M, L, P, {
            theme: 'grid',
            head: [['Pièces jointes (NDS / DAF)']],
            body: [[d.piecesJointes]],
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
        doc.setFillColor.apply(doc, PDF_ACCENT); doc.rect(x, y, larg, 6.5, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
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
        doc.setTextColor.apply(doc, PDF_ACCENT); doc.setFont('helvetica', 'bold');
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
    doc.setProperties({ title: 'TRIGONE — Demande et ordre de mise en route', keywords: PDF_DONNEES(panier) });

    return doc;
}

// ===================== CODE D'ACCÈS À 4 CHIFFRES (comme TRIGONE compte-rendu) =====================
// Facultatif, activé depuis Mon espace : demandé à chaque ouverture de l'application. Seule une empreinte
// (SHA-256) du code est gardée sur l'appareil ; code oublié = effacer toutes les données de l'appli.
var STORAGE_PIN = 'mer_pin_hash';
var PIN_UI = { saisie: '', mode: null, premier: null, verrouillage: false, apres: null };
function PIN_EST_DEFINI() { try { return !!localStorage.getItem(STORAGE_PIN); } catch (e) { return false; } }
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
        PIN_EMPREINTE(code).then(function(h) {
            try { localStorage.setItem(STORAGE_PIN, h); } catch (e) {}
            FERMER_ECRAN_PIN();
            if (PAGE_ACTUELLE === 'ESPACE') SHOW_PAGE('ESPACE');
            MSG_INFO('Code d\'accès activé', 'Il vous sera demandé à chaque ouverture de TRIGONE Mise en route.', '🔒', 'mascotte-pouce.webp');
        });
        return;
    }
    var attendu = '';
    try { attendu = localStorage.getItem(STORAGE_PIN) || ''; } catch (e) {}
    PIN_EMPREINTE(code).then(function(h) {
        if (h !== attendu) { PIN_ERREUR('⛔ Code incorrect.'); return; }
        if (PIN_UI.mode === 'suppression') {
            try { localStorage.removeItem(STORAGE_PIN); } catch (e) {}
            FERMER_ECRAN_PIN();
            if (PAGE_ACTUELLE === 'ESPACE') SHOW_PAGE('ESPACE');
            MSG_INFO('Code d\'accès désactivé', 'TRIGONE Mise en route s\'ouvrira sans code.', '🔓', 'mascotte-code.webp');
            return;
        }
        PIN_UI.verrouillage = false;
        FERMER_ECRAN_PIN();
        if (PIN_UI.apres) PIN_UI.apres();
    });
}
function PIN_CODE_OUBLIE() {
    MSG_CONFIRM('Code oublié ?',
        'Il n\'existe aucun moyen de récupérer votre code. La seule solution est d\'effacer toutes les données de TRIGONE Mise en route sur cet appareil (demande en cours, panier, bibliothèque, réglages). Cette action est irréversible.',
        'Oui, tout effacer et recommencer', function() {
            try { localStorage.clear(); } catch (e) {}
            location.reload();
        }, '⚠️', 'mascotte-code.webp', true);
}

// ===================== PAGE DE PRÉSENTATION (première ouverture) =====================
var STORAGE_POURQUOI = 'mer_presentation_vue';
var POURQUOI_APRES = null;
function AFFICHER_POURQUOI(apres) {
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
// Les mêmes réglages que Mon espace ; un valideur ou l'assistant Chorus DT peut passer cette étape.
var STORAGE_CONFIG_FAITE = 'mer_config_faite';
function CONFIG_FAITE() { try { return localStorage.getItem(STORAGE_CONFIG_FAITE) === '1'; } catch (e) { return true; } }
var MER_CONFIG_CHAMPS = { UNITE: 'unite', CIE: 'cie', GRADE: 'grade', MATRICULE: 'matricule', NOM: 'nom', PRENOM: 'prenom' };
function AFFICHER_CONFIG_INITIALE() {
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
    (avecPin ? PIN_EMPREINTE(pin1).then(function(hash) { try { localStorage.setItem(STORAGE_PIN, hash); } catch (e) {} }) : Promise.resolve()).then(function() {
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
    DEMANDEUR: { titre: 'Faire une demande', sous: 'Saisie · panier · envoi au 1er valideur', icone: MER_ICONES_NOTICE_PERSO(),
        etapes: ['<b>Mon espace</b> : renseignez une fois votre identité et vos mails, ils pré-remplissent chaque demande.',
            '<b>Nouvelle demande</b> : 5 étapes (Identité, Aller, Retour, Alim./Héb., Imputation). Une étape doit être complète pour passer à la suivante.',
            '<b>Aller</b> : lieu de départ de mission (résidence administrative ou familiale), ville (code postal automatique) ou pays étranger, dates et heures. Le <b>retour</b> est pré-rempli avec l\'aller inversé.',
            '<b>Imputation</b> : saisissez le code FD, TRIGONE affiche le centre financier, le centre de coût et le code activité.',
            '<b>Panier</b> : plusieurs demandes peuvent partir dans un seul mail. « Envoyer » télécharge le PDF et le .json et ouvre le mail pour le 1er valideur.',
            'La demande est rangée dans la <b>Bibliothèque</b>. En cas de refus, importez le .json reçu depuis le <b>Panier</b> (« Importer une demande refusée »), corrigez et renvoyez.'] },
    VALIDEUR: { titre: 'Valider une demande', sous: 'Code d\'accès valideur · import · signature', icone: MER_ICONES_NOTICE_CADENAS(),
        etapes: ['<b>Espace valideur</b> : saisissez votre grade, nom, prénom, fonction et le <b>code d\'accès valideur</b> remis par l\'administrateur (un code pour le 1er valideur, un pour le 2e).',
            'Importez le ou les fichiers .json reçus par mail, puis « Voir le PDF » pour consulter chaque demande.',
            '<b>Valider</b> (une par une ou « Tout cocher » puis « Valider la sélection ») : la validation est signée électroniquement. <b>Refuser</b> demande un motif.',
            '<b>Transmettre</b> : le 1er valideur envoie le .json au 2e valideur ; le 2e valideur envoie le PDF signé à l\'assistant Chorus DT ; un refus repart vers le demandeur.'] },
    CHORUS: { titre: 'Assistant Chorus DT', sous: 'Vérifier les signatures d\'un PDF', icone: MER_ICONES_NOTICE_CHECK(),
        etapes: ['Ouvrez <b>Espace valideur</b> puis <b>Vérifier une mise en route</b> (aucun code n\'est nécessaire).',
            'Choisissez le PDF reçu : TRIGONE contrôle les signatures électroniques enregistrées dans le fichier.',
            '<b>✔ Conforme</b> : validée par les deux valideurs habilités, sans modification depuis. <b>✖ Non conforme</b> : la raison est indiquée (validation manquante, faux valideur, demande modifiée).'] }
};
function MER_ICONES_NOTICE_PERSO() { return '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; }
function MER_ICONES_NOTICE_CADENAS() { return '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'; }
function MER_ICONES_NOTICE_CHECK() { return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>'; }
function OUVRIR_NOTICE(cle) { MER_NOTICE_CLE = cle || null; SHOW_PAGE('NOTICE'); }
function TPL_NOTICE() {
    var n = MER_NOTICE_CLE && MER_NOTICES[MER_NOTICE_CLE];
    if (n) {
        return '<div class="CARD"><h2>' + n.titre + '</h2><p class="MER-HINT" style="margin:4px 0 16px;">' + n.sous + '</p>' +
            '<ol class="notice-steps">' + n.etapes.map(function(e) { return '<li>' + e + '</li>'; }).join('') + '</ol>' +
            '<button type="button" class="BTN BTN-SECONDARY" onclick="OUVRIR_NOTICE()">← Notice</button></div>';
    }
    return '<div class="CARD"><h2>Notice</h2><p class="MER-HINT" style="margin:4px 0 16px;">Choisissez le guide selon votre rôle.</p>' +
        Object.keys(MER_NOTICES).map(function(k) {
            var c = MER_NOTICES[k];
            return '<button type="button" class="NOTICE-CARD" onclick="OUVRIR_NOTICE(\'' + k + '\')"><span class="NOTICE-CARD-ICON">' + c.icone + '</span>' +
                '<span class="NOTICE-CARD-BODY"><span class="NOTICE-CARD-TITLE">' + c.titre + '</span><span class="NOTICE-CARD-SUB">' + c.sous + '</span></span>' +
                '<span class="NOTICE-CARD-CHEV">›</span></button>';
        }).join('') +
        '<details class="notice-fold"><summary>🔒 Code d\'accès de l\'appli (4 chiffres)</summary><ul>' +
            '<li>Dans <b>Mon espace</b>, activez un code à 4 chiffres demandé à <b>chaque ouverture</b> de TRIGONE Mise en route.</li>' +
            '<li>Le code ne quitte jamais votre appareil.</li>' +
            '<li><b>Code oublié</b> : le lien « Code oublié ? » efface toutes les données de l\'appli sur cet appareil. Il n\'existe aucun autre moyen.</li></ul></details>' +
        '<details class="notice-fold"><summary>🔄 Mises à jour</summary><ul>' +
            '<li>L\'appli se met à jour toute seule dès qu\'il y a du réseau ; un message « Mise à jour » s\'affiche quand une nouvelle version est prête.</li>' +
            '<li>Votre saisie en cours, votre panier et votre bibliothèque sont conservés.</li></ul></details>' +
        '<button type="button" class="BTN BTN-GHOST" style="margin-top:6px;" onclick="AFFICHER_POURQUOI()">Revoir la présentation</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}

// ===================== MESSAGE CENTRÉ (comme TRIGONE compte-rendu) =====================
// Remplace alert / confirm : carte centrée, icône, titre, texte et mascotte à droite.
function TYPO_FR(t) { return String(t).replace(/ ([?!:;»])/g, '\u00A0$1').replace(/(«) /g, '$1\u00A0'); }
function FERMER_MSG() {
    var o = document.getElementById('MSG-OVERLAY');
    if (!o) return;
    o.classList.remove('msg-in');
    setTimeout(function() { o.classList.add('HIDDEN'); }, 300);
}
// opts : titre, texte, icone, mascotte (nom d'image, false = sans), mascotteDroit, gauche (texte aligné à gauche), boutons [{label, style, action}]
function AFFICHER_MSG_CENTRE(opts) {
    var o = document.getElementById('MSG-OVERLAY');
    if (!o) { alert((opts.titre ? opts.titre + '\n\n' : '') + (opts.texte || '')); return; }
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
function NOM_FICHIER_BASE(panier) {
    var p0 = panier[0].personnes[0];
    var nom = (p0.nom || 'DEMANDE').replace(/[^a-zA-Z0-9_-]/g, '_');
    return 'MISE_EN_ROUTE_' + nom + '_' + panier.length + (panier.length > 1 ? '-demandes' : '-demande');
}

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
    var mail = (document.getElementById('MER-MAIL-DEST') || {}).value || reg.mailSignataire || '';
    if (!mail || mail.indexOf('@') === -1) { MSG_ERREUR('Mail manquant', 'Merci de renseigner l\'adresse mail du 1er valideur avant l\'envoi.'); return; }
    reg.mailSignataire = mail; SAVE_REGLAGES(reg);

    var panier = GET_PANIER();
    if (!panier.length) return;

    var pjNotes = panier.filter(function(d) { return d.piecesJointes; }).map(function(d) {
        return '📎 ' + RESUME_DEMANDE(d).noms + ' : ' + d.piecesJointes;
    });
    var listeTexte = '📎 ' + NOM_FICHIER_BASE(panier) + '.pdf (à télécharger ci-dessous)' +
        '<br>📎 ' + NOM_FICHIER_BASE(panier) + '.json (à télécharger ci-dessous, pour le signataire suivant)' +
        (pjNotes.length ? '<br>' + pjNotes.join('<br>') : '');

    AFFICHER_MODALE('Avant d\'envoyer',
        '<p style="font-size:0.86em; line-height:1.5;">Vérifiez que vous joindrez ces éléments dans le mail qui va s\'ouvrir :</p>' +
        '<p style="font-size:0.86em; line-height:1.7; background:rgba(90,122,148,0.07); padding:10px 12px; border-radius:10px;">' + listeTexte + '</p>' +
        '<p style="font-size:0.8em; color:var(--sm2-muted);">TRIGONE ne peut pas les joindre automatiquement — c\'est à vous de les ajouter dans votre application mail, comme pour TRIGONE compte-rendu.</p>',
        '<button type="button" class="BTN BTN-SECONDARY" style="flex:0 0 auto;" onclick="FERMER_MODALE()">Annuler</button>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="FINALISER_ENVOI()">J\'ai tout prêt — Envoyer</button>'
    );
}

function FINALISER_ENVOI() {
    var reg = GET_REGLAGES();
    var panier = GET_PANIER();
    panier.forEach(function(d) { d.mailDemandeur = (reg.mailDemandeur || '').trim(); d.validations = []; delete d.refus; });
    var base = NOM_FICHIER_BASE(panier);
    try {
        var doc = GENERER_PDF(panier);
        doc.save(base + '.pdf');
    } catch (e) { MSG_ERREUR('PDF impossible', 'Erreur lors de la génération du PDF : ' + e.message); return; }
    TELECHARGER_TEXTE(base + '.json', GENERER_JSON(panier, 'DEMANDE_INITIALE'), 'application/json');

    var sujet = 'TRIGONE Mise en route — ' + panier.length + ' demande(s) — ' + (panier[0].personnes[0].nom || '');
    var corps = 'Bonjour,\n\nVeuillez trouver ci-joint ' + panier.length + ' demande(s) et ordre(s) de mise en route, ainsi que le fichier de suivi (.json).\n\nCordialement.';
    ARCHIVER_ENVOI(panier, reg.mailSignataire);
    FERMER_MODALE();
    window.location.href = 'mailto:' + encodeURIComponent(reg.mailSignataire) + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);

    SAVE_PANIER([]);
    setTimeout(function() {
        SHOW_PAGE('ACCUEIL');
        MSG_INFO('Mail préparé', 'Joignez le PDF et le fichier .json téléchargés, puis envoyez le mail. La demande est rangée dans votre Bibliothèque.', '✅', 'mascotte-ok.webp');
    }, 300);
}

// ===================== SÉCURITÉ DES VALIDATIONS =====================
// Pas de serveur : valideurs.json (sur GitHub, que seul l'administrateur peut modifier) contient, pour le 1er
// et le 2e valideur, une clé publique et la clé privée correspondante chiffrée par un code d'accès que seul
// le valideur connaît. Le code déverrouille la clé ; une validation est une signature ECDSA du contenu
// exact de la demande : une signature faite avec une clé absente de la liste, ou une demande modifiée après
// signature, est détectée par le 2e valideur, par l'assistant Chorus DT et par la page de vérification.
var MER_DEPOT_GITHUB = 'https://github.com/parisien2403-blip/TRIGONE-Mise-en-route';
var STORAGE_LISTE_VALIDEURS = 'mer_liste_valideurs';
var MER_CLE_SESSION = null;          // clé privée déverrouillée par le code d'accès, gardée en mémoire seulement
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
    return c;
}
function TEXTE_A_SIGNER(d, niveau, signataire, le) {
    return JSON_STABLE({
        demande: CONTENU_SIGNE(d),
        precedentes: (d.validations || []).slice(0, niveau - 1).map(function(v) { return v.sig; }),
        niveau: niveau, signataire: signataire, le: le
    });
}
function EMPREINTE_COURTE(sig) { return (sig || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase().replace(/(.{4})/g, '$1 ').trim(); }

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
        // Hors ligne : dernière liste connue.
        try { MER_LISTE_VALIDEURS = JSON.parse(localStorage.getItem(STORAGE_LISTE_VALIDEURS) || 'null'); } catch (e) {}
        MER_LISTE_VALIDEURS = MER_LISTE_VALIDEURS || { valideurs: [] };
        return MER_LISTE_VALIDEURS;
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

// ---- Codes d'accès des valideurs ----
var CODE_CARACTERES = { lettres: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', chiffres: '23456789', symboles: '#$%&*+=?@!' };
function GENERER_CODE_ACCES() {
    var tous = CODE_CARACTERES.lettres + CODE_CARACTERES.chiffres + CODE_CARACTERES.symboles;
    function tirer(jeu) { return jeu[crypto.getRandomValues(new Uint32Array(1))[0] % jeu.length]; }
    for (;;) {
        var c = '';
        for (var i = 0; i < 16; i++) c += tirer(tous);
        if (/[A-Za-z]/.test(c) && /\d/.test(c) && /[#$%&*+=?@!]/.test(c)) return c;
    }
}
// Crée l'accès d'un rôle : nouvelle paire de clés, clé privée chiffrée par un nouveau code (affiché une seule fois).
function CREER_ACCES(role) {
    var code = GENERER_CODE_ACCES();
    var sel = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.generateKey(ALGO_CLE, true, ['sign', 'verify']).then(function(p) {
        return Promise.all([crypto.subtle.exportKey('spki', p.publicKey), crypto.subtle.exportKey('pkcs8', p.privateKey), CLE_DU_CODE(code, sel)]);
    }).then(function(r) {
        return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, r[2], r[1]).then(function(chiffre) {
            return { code: code, acces: { role: role, cle: B64(r[0]), sel: B64(sel), iv: B64(iv), prive: B64(chiffre), creeLe: new Date().toISOString() } };
        });
    });
}
// Essaie le code sur chaque accès actif : celui qu'il déchiffre donne la clé de signature et le rôle.
function DEVERROUILLER_ACCES(code) {
    var acces = ((MER_LISTE_VALIDEURS && MER_LISTE_VALIDEURS.valideurs) || []).filter(function(a) { return a.prive && !a.retire; });
    return acces.reduce(function(prec, a) {
        return prec.catch(function() {
            return CLE_DU_CODE(code, new Uint8Array(DEB64(a.sel))).then(function(k) {
                return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(DEB64(a.iv)) }, k, DEB64(a.prive));
            }).then(function(pkcs8) {
                return crypto.subtle.importKey('pkcs8', pkcs8, ALGO_CLE, false, ['sign']);
            }).then(function(k) { MER_CLE_SESSION = k; MER_ACCES_SESSION = a; });
        });
    }, Promise.reject(new Error('code')));
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
        grade: v.grade, nom: v.nom, prenom: v.prenom, fonction: v.fonction };
}

// Recharge la liste des habilités et revérifie les validations reçues avant d'afficher la page.
function OUVRIR_VALIDATION() {
    PAGE_ACTUELLE = 'VALIDATION';
    var zone = document.getElementById('PAGE-STAGE');
    zone.classList.add('avec-marge');
    zone.innerHTML = '<div class="CARD"><div class="MER-EMPTY">Chargement…</div></div>';
    CHARGER_LISTE_VALIDEURS().then(RENDER_VALIDATION_INPLACE);
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

// ---- Connexion par code d'accès ----
function TPL_CONNEXION(v) {
    function champ(k, label, ph) {
        return '<div class="MER-FIELD"><label>' + label + '</label><input type="text" id="MER-VAL-' + k + '" value="' + ESC(v[k] || '') + '" placeholder="' + ph + '"></div>';
    }
    return '<p class="MER-HINT" style="margin:0 0 14px;">Réservé aux valideurs. Votre identité apparaîtra dans la case de validation du PDF ; ' +
        'le code d\'accès vous est remis par l\'administrateur de TRIGONE.</p>' +
        '<div class="MER-ROW2">' + champ('grade', 'Grade', 'EX : CAPITAINE') + champ('fonction', 'Fonction', 'EX : CHEF DE SERVICE') + '</div>' +
        '<div class="MER-ROW2">' + champ('nom', 'Nom', 'EX : DUPONT') + champ('prenom', 'Prénom', 'EX : Jean') + '</div>' +
        '<div class="MER-FIELD"><label>Code d\'accès valideur</label><input type="password" id="MER-CODE-ACCES" autocomplete="current-password" ' +
            'autocapitalize="off" autocorrect="off" spellcheck="false" onkeydown="if(event.key===\'Enter\') SE_CONNECTER(this)"></div>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="SE_CONNECTER(this)">Se connecter</button>';
}
function SE_CONNECTER(btn) {
    var v = GET_VALIDEUR();
    ['grade', 'nom', 'prenom', 'fonction'].forEach(function(k) { v[k] = (document.getElementById('MER-VAL-' + k).value || '').trim(); });
    if (!v.grade || !v.nom || !v.prenom || !v.fonction) { MSG_ERREUR('Identité incomplète', 'Merci de renseigner votre grade, nom, prénom et fonction.'); return; }
    v.grade = v.grade.toUpperCase(); v.nom = v.nom.toUpperCase();
    SAVE_VALIDEUR(v);
    var champ = document.getElementById('MER-CODE-ACCES');
    var code = champ.value.trim();
    if (!code) { MSG_ERREUR('Code manquant', 'Merci de saisir votre code d\'accès valideur.'); return; }
    var bouton = document.querySelector('#PAGE-STAGE .BTN-PRIMARY');
    if (bouton) { bouton.disabled = true; bouton.textContent = 'Vérification…'; }
    CHARGER_LISTE_VALIDEURS().then(function() { return DEVERROUILLER_ACCES(code); }).then(RENDER_VALIDATION_INPLACE).catch(function() {
        AFFICHER_MSG_CENTRE({ titre: 'Code incorrect', texte: 'Ce code d\'accès n\'est pas reconnu. Vérifiez-le, en respectant les majuscules et les symboles.', icone: '⛔', mascotte: 'mascotte-code.webp' });
        champ.value = '';
        if (bouton) { bouton.disabled = false; bouton.textContent = 'Se connecter'; }
    });
}
function SE_DECONNECTER() { MER_CLE_SESSION = null; MER_ACCES_SESSION = null; RENDER_VALIDATION_INPLACE(); }
function COPIER_TEXTE(t, btn) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function() {
        if (btn) { btn.textContent = '✔ Copié'; }
    }).catch(function() { MSG_INFO('Copiez ce texte', t, '📋', false); });
}

// ---- 4. Espace de validation ----
function TPL_ENTREE_VALIDATION(e, h) {
    var d = e.d, r = RESUME_DEMANDE(d), niveau = NIVEAU_VALIDATION(d);
    var verif = MER_VERIF[e.id] || [];
    var precedenteKo = verif.filter(function(x) { return !x.ok; })[0];
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
        etat = '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">✖ Refusée : ' + ESC(e.signature.motif) + '</div>';
        actions = '<button type="button" class="BTN-DANGER-TEXT" onclick="ANNULER_DECISION(\'' + e.id + '\')">Annuler</button>';
    } else if (niveau <= 2) {
        if (pourMoi) actions += '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="VALIDER_DEMANDES([\'' + e.id + '\'])">Valider</button>';
        else if (!precedenteKo) etat = '<div class="MER-HINT">Réservée au ' + LIBELLE_ROLE(niveau) + ' : vous ne pouvez pas la valider.</div>';
        else etat = '<div class="MER-HINT" style="color:#b91c1c; font-weight:800;">Validation précédente non conforme : refusez cette demande.</div>';
        actions += '<button type="button" class="BTN-DANGER-TEXT" onclick="DEMANDER_REFUS(\'' + e.id + '\')">Refuser</button>';
    }
    var coche = !e.decision && pourMoi ? '<input type="checkbox" class="MER-VAL-SEL" value="' + e.id + '" style="width:18px; height:18px; flex-shrink:0;">' : '';
    return '<div class="MER-PANIER-ITEM" style="align-items:flex-start;">' + coche +
        '<div class="MER-PANIER-ITEM-TXT">' +
            '<span class="MER-BADGE">' + badge + '</span>' +
            '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(r.noms) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(r.sous) + '</div>' + controle + etat +
            '<div class="MER-VAL-ACTIONS">' +
                '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="VOIR_PDF_VALIDATION(\'' + e.id + '\')">Voir le PDF</button>' + actions +
            '</div>' +
        '</div></div>';
}

function TPL_ESPACE_VALIDATION(v, h) {
    var liste = GET_A_VALIDER();
    var html = '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<span class="MER-BADGE">🔒 Connecté — ' + LIBELLE_ROLE(h.role) + '</span>' +
            '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(h.grade + ' ' + h.nom + ' ' + h.prenom) + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(h.fonction) + '</div></div>' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="width:auto;" onclick="SE_DECONNECTER()">Déconnexion</button></div>' +
        '<div class="MER-SECTION-TITLE">Demandes reçues</div>' +
        '<label class="BTN BTN-GHOST" style="margin-bottom:14px;">📥 Importer un ou plusieurs fichiers .json' +
        '<input type="file" accept=".json,application/json" multiple style="display:none;" onchange="IMPORTER_A_VALIDER(this)"></label>';
    if (!liste.length) return html + '<div class="MER-EMPTY">Aucune demande à valider.<br>Importez le fichier .json reçu par mail.</div>';

    var decidees = liste.filter(function(e) { return e.decision; }).length;
    var cochables = liste.filter(function(e) {
        return !e.decision && NIVEAU_VALIDATION(e.d) === h.role && !(MER_VERIF[e.id] || []).some(function(x) { return !x.ok; });
    }).length;
    html += liste.map(function(e) { return TPL_ENTREE_VALIDATION(e, h); }).join('');
    if (cochables > 1) {
        html += '<div class="MER-ACTIONS" style="margin:4px 0 8px;">' +
            '<button type="button" class="BTN BTN-SECONDARY BTN-SMALL" onclick="COCHER_TOUT_VALIDATION()">Tout cocher</button>' +
            '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" onclick="VALIDER_SELECTION()">✔ Valider la sélection</button></div>';
    }
    html += '<div class="MER-SECTION-TITLE">Transmission</div>' +
        (h.role === 1
            ? '<div class="MER-FIELD"><label>Mail du 2e valideur</label><input type="email" value="' + ESC(v.mailValideur2 || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" oninput="SET_MAIL_VALIDEUR(\'mailValideur2\', this.value)"></div>'
            : '<div class="MER-FIELD"><label>Mail de l\'assistant Chorus DT</label><input type="email" value="' + ESC(v.mailChorus || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" oninput="SET_MAIL_VALIDEUR(\'mailChorus\', this.value)">' +
              '<p class="MER-HINT">Il reçoit le PDF signé.</p></div>') +
        '<button type="button" class="BTN BTN-PRIMARY"' + (decidees ? '' : ' disabled') + ' onclick="PREPARER_TRANSMISSION()">📧 Transmettre les décisions (' + decidees + ')</button>';
    return html;
}

function TPL_VALIDATION() {
    var v = GET_VALIDEUR();
    var h = HABILITATION_COURANTE();
    var corps, sous;
    if (!h || h.retire) { sous = 'Connexion'; corps = TPL_CONNEXION(v); }
    else { sous = 'Validation des demandes reçues'; corps = TPL_ESPACE_VALIDATION(v, h); }
    return '<div class="CARD">' +
        '<h2>Espace valideur</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">' + sous + '</p>' + corps +
        '<div class="MER-SECTION-TITLE">Assistant Chorus DT</div>' +
        '<button type="button" class="BTN BTN-GHOST" onclick="SHOW_PAGE(\'VERIFIER\')">✔ Vérifier une mise en route</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}
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
    LIRE_FICHIERS_JSON(input, function(contenus) {
        var liste = GET_A_VALIDER(), ajoutees = 0, refus = 0;
        contenus.forEach(function(data) {
            data.demandes.forEach(function(d) {
                if (d.refus) { refus++; return; }
                d.validations = d.validations || [];
                var cle = d.id + '#' + d.validations.length;
                if (liste.some(function(e) { return e.id === cle; })) return;
                liste.push({ id: cle, d: d, decision: null, signature: null });
                ajoutees++;
            });
        });
        SAVE_A_VALIDER(liste);
        RENDER_VALIDATION_INPLACE();
        if (refus) MSG_INFO('Demandes refusées ignorées', refus + ' demande(s) refusée(s) ignorée(s) : un refus s\'importe côté demandeur.');
        else if (!ajoutees && contenus.length) MSG_INFO('Déjà importées', 'Ces demandes sont déjà dans votre liste.');
    });
}

function VALIDER_DEMANDES(ids) {
    var h = HABILITATION_COURANTE();
    if (!MER_CLE_SESSION || !h || h.retire) { RENDER_VALIDATION_INPLACE(); return; }
    var liste = GET_A_VALIDER();
    Promise.all(liste.map(function(e) {
        var ko = (MER_VERIF[e.id] || []).some(function(x) { return !x.ok; });
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
function ANNULER_DECISION(id) { MAJ_ENTREES([id], function(e) { e.decision = null; e.signature = null; }); }

function DEMANDER_REFUS(id) {
    AFFICHER_MODALE('Refuser la demande',
        '<div class="MER-FIELD"><label>Motif du refus</label><textarea id="MER-MOTIF-REFUS" rows="4" placeholder="EX : merci de joindre la DAF"></textarea>' +
        '<p class="MER-HINT">Le demandeur recevra ce motif et pourra corriger puis renvoyer sa demande.</p></div>',
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Annuler</button>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="CONFIRMER_REFUS(\'' + id + '\')">Refuser</button>'
    );
    setTimeout(function() { var t = document.getElementById('MER-MOTIF-REFUS'); if (t) t.focus(); }, 50);
}
function CONFIRMER_REFUS(id) {
    var motif = (document.getElementById('MER-MOTIF-REFUS').value || '').trim();
    if (!motif) { MSG_ERREUR('Motif manquant', 'Merci d\'indiquer le motif du refus.'); return; }
    var h = HABILITATION_COURANTE();
    if (!MER_CLE_SESSION || !h) { FERMER_MODALE(); RENDER_VALIDATION_INPLACE(); return; }
    FERMER_MODALE();
    MAJ_ENTREES([id], function(e) {
        e.decision = 'REFUSEE';
        e.signature = { grade: h.grade, nom: h.nom, prenom: h.prenom, fonction: h.fonction, le: new Date().toISOString(), motif: motif };
    });
}

// Demande telle qu'elle sera transmise : la validation signée est ajoutée aux précédentes.
function DEMANDE_AVEC_DECISION(e) {
    var d = JSON.parse(JSON.stringify(e.d));
    d.validations = d.validations || [];
    if (e.decision === 'VALIDEE') d.validations.push(e.signature);
    if (e.decision === 'REFUSEE') { d.refus = e.signature; d.refus.niveau = NIVEAU_VALIDATION(e.d); }
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
    var vers2 = [], versChorus = [], refusParMail = {};
    decidees.forEach(function(e) {
        var d = DEMANDE_AVEC_DECISION(e);
        if (e.decision === 'REFUSEE') {
            var m = d.mailDemandeur || '';
            (refusParMail[m] = refusParMail[m] || []).push(d);
        } else if (d.validations.length === 1) vers2.push(d);
        else versChorus.push(d);
    });
    if (vers2.length && !/@/.test(v.mailValideur2 || '')) { MSG_ERREUR('Mail manquant', 'Merci de renseigner le mail du 2e valideur.'); return; }
    if (versChorus.length && !/@/.test(v.mailChorus || '')) { MSG_ERREUR('Mail manquant', 'Merci de renseigner le mail de l\'assistant Chorus DT.'); return; }

    MER_ENVOIS = [];
    if (vers2.length) MER_ENVOIS.push({ type: 'VALIDATION_1', demandes: vers2, mail: v.mailValideur2,
        titre: 'Au 2e valideur', pj: NOM_FICHIER_BASE(vers2) + '_VALIDATION-1.json' });
    if (versChorus.length) MER_ENVOIS.push({ type: 'CHORUS', demandes: versChorus, mail: v.mailChorus,
        titre: 'À l\'assistant Chorus DT', pj: NOM_FICHIER_BASE(versChorus) + '_VALIDEE.pdf' });
    Object.keys(refusParMail).forEach(function(m) {
        var ds = refusParMail[m];
        MER_ENVOIS.push({ type: 'REFUS', demandes: ds, mail: m,
            titre: 'Refus au demandeur' + (m ? '' : ' (adresse inconnue : à saisir dans le mail)'), pj: NOM_FICHIER_BASE(ds) + '_REFUS.json' });
    });
    AFFICHER_TRANSMISSION();
}
function AFFICHER_TRANSMISSION() {
    FERMER_MODALE();
    var lignes = MER_ENVOIS.map(function(env, i) {
        return '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<div class="MER-PANIER-ITEM-TITRE">' + ESC(env.titre) + ' — ' + env.demandes.length + ' demande(s)</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + ESC(env.mail || '') + '<br>📎 ' + ESC(env.pj) + '</div></div>' +
            (env.fait ? '<span class="MER-BADGE">✔ Préparé</span>'
                : '<button type="button" class="BTN BTN-PRIMARY BTN-SMALL" style="width:auto;" onclick="EXECUTER_ENVOI(' + i + ')">Préparer</button>') +
            '</div>';
    }).join('');
    var tousFaits = MER_ENVOIS.every(function(env) { return env.fait; });
    AFFICHER_MODALE('Transmettre',
        '<p style="font-size:0.86em; line-height:1.5;">Pour chaque envoi, « Préparer » télécharge la pièce jointe et ouvre le mail : joignez-y le fichier téléchargé avant d\'envoyer.</p>' + lignes,
        '<button type="button" class="BTN BTN-SECONDARY" onclick="FERMER_MODALE()">Plus tard</button>' +
        '<button type="button" class="BTN BTN-PRIMARY"' + (tousFaits ? '' : ' disabled') + ' onclick="TERMINER_TRANSMISSION()">Terminé</button>'
    );
}
function EXECUTER_ENVOI(i) {
    var env = MER_ENVOIS[i], n = env.demandes.length, nom = env.demandes[0].personnes[0].nom || '';
    var sujet, corps;
    if (env.type === 'CHORUS') {
        try { GENERER_PDF(env.demandes).save(env.pj); }
        catch (e) { MSG_ERREUR('PDF impossible', 'Erreur lors de la génération du PDF : ' + e.message); return; }
        sujet = 'TRIGONE Mise en route — ' + n + ' demande(s) validée(s) — ' + nom;
        corps = 'Bonjour,\n\nVeuillez trouver ci-joint ' + n + ' demande(s) et ordre(s) de mise en route validé(s), pour traitement.\n' +
            'Les validations sont signées électroniquement : TRIGONE Mise en route > Espace valideur > Vérifier une mise en route permet de les contrôler.\n\nCordialement.';
    } else if (env.type === 'VALIDATION_1') {
        TELECHARGER_TEXTE(env.pj, GENERER_JSON(env.demandes, 'VALIDATION_1'), 'application/json');
        sujet = 'TRIGONE Mise en route — ' + n + ' demande(s) à valider — ' + nom;
        corps = 'Bonjour,\n\nVeuillez trouver ci-joint ' + n + ' demande(s) de mise en route validée(s) en 1er niveau, pour votre validation.\n' +
            'Ouvrez TRIGONE Mise en route > Espace valideur, puis importez le fichier .json joint.\n\nCordialement.';
    } else {
        TELECHARGER_TEXTE(env.pj, GENERER_JSON(env.demandes, 'REFUS'), 'application/json');
        sujet = 'TRIGONE Mise en route — demande(s) refusée(s) — ' + nom;
        corps = 'Bonjour,\n\n' + env.demandes.map(function(d) {
            return '- ' + RESUME_DEMANDE(d).noms + ' (' + (d.objet || '') + ') : ' + d.refus.motif;
        }).join('\n') + '\n\nPour corriger : ouvrez TRIGONE Mise en route > Panier > Importer une demande refusée, puis importez le fichier .json joint.\n\nCordialement.';
    }
    env.fait = true;
    window.location.href = 'mailto:' + encodeURIComponent(env.mail || '') + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
    AFFICHER_TRANSMISSION();
}
function TERMINER_TRANSMISSION() {
    FERMER_MODALE();
    SAVE_A_VALIDER(GET_A_VALIDER().filter(function(e) { return !e.decision; }));
    MER_ENVOIS = [];
    RENDER_VALIDATION_INPLACE();
}

// ===================== VÉRIFIER UNE MISE EN ROUTE (assistant Chorus DT) =====================
var MER_RESULTATS_VERIF = null;
function TPL_VERIFIER() {
    var res = MER_RESULTATS_VERIF;
    var html = '<div class="CARD"><h2>Vérifier une mise en route</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Contrôle des signatures électroniques des valideurs, à partir du PDF (ou du .json) reçu.</p>' +
        '<label class="BTN BTN-PRIMARY" style="margin-bottom:16px;">📄 Choisir le PDF à vérifier' +
        '<input type="file" accept=".pdf,application/pdf,.json,application/json" multiple style="display:none;" onchange="VERIFIER_FICHIERS(this)"></label>';
    if (res) {
        html += !res.length ? '<div class="MER-EMPTY">Aucune donnée TRIGONE dans ce fichier.<br>Seuls les PDF produits par TRIGONE Mise en route peuvent être vérifiés.</div>'
            : res.map(function(x) {
                var nbOk = x.verif.filter(function(v) { return v.ok; }).length;
                var conforme = nbOk === 2 && x.verif.length === 2;
                var r = RESUME_DEMANDE(x.d);
                return '<div class="MER-PANIER-ITEM" style="align-items:flex-start; border-color:' + (conforme ? '#86efac' : '#fca5a5') + ';"><div class="MER-PANIER-ITEM-TXT">' +
                    '<div style="font-weight:800; font-size:0.9em; color:' + (conforme ? '#15803d' : '#b91c1c') + ';">' +
                        (conforme ? '✔ Conforme : validée par les deux valideurs habilités' : '✖ Non conforme') + '</div>' +
                    '<div class="MER-PANIER-ITEM-TITRE" style="margin-top:6px;">' + ESC(r.noms) + '</div>' +
                    '<div class="MER-PANIER-ITEM-SUB">' + ESC(r.sous) + '</div>' +
                    [1, 2].map(function(n) {
                        var v = x.verif[n - 1];
                        if (!v) return '<div class="MER-HINT" style="color:#b91c1c; font-weight:700;">✖ ' + LIBELLE_ROLE(n) + ' : aucune validation</div>';
                        return '<div class="MER-HINT" style="font-weight:700; color:' + (v.ok ? '#15803d' : '#b91c1c') + ';">' + (v.ok ? '✔ ' : '✖ ') +
                            LIBELLE_ROLE(n) + ' : ' + ESC((v.validation.grade || '') + ' ' + (v.validation.nom || '') + ' ' + (v.validation.prenom || '')) +
                            (v.validation.le ? ', le ' + ESC(new Date(v.validation.le).toLocaleString('fr-FR')) : '') + ' — ' + ESC(v.message) + '</div>';
                    }).join('') +
                '</div></div>';
            }).join('');
    }
    return html + '<button type="button" class="BTN BTN-SECONDARY" onclick="MER_RESULTATS_VERIF = null; SHOW_PAGE(\'VALIDATION\')">← Espace valideur</button></div>';
}
function VERIFIER_FICHIERS(input) {
    LIRE_FICHIERS(input, function(contenu, f) {
        if (/\.pdf$/i.test(f.name)) return LIRE_DONNEES_PDF(contenu) || [];
        return LIRE_JSON_MER(contenu).demandes;
    }, function(listes) {
        var demandes = [].concat.apply([], listes);
        CHARGER_LISTE_VALIDEURS().then(function() {
            return Promise.all(demandes.map(function(d) {
                return VERIFIER_VALIDATIONS(d).then(function(verif) { return { d: d, verif: verif }; });
            }));
        }).then(function(res) {
            MER_RESULTATS_VERIF = res;
            SHOW_PAGE('VERIFIER');
        });
    });
}

// ===================== ADMINISTRATION DES VALIDEURS =====================
// L'administrateur colle les codes d'habilitation reçus ; l'écran produit le contenu de valideurs.json à
// publier sur GitHub. Seul un compte autorisé sur le dépôt peut le publier : c'est là qu'est la sécurité.
var MER_ADMIN_LISTE = null;
function OUVRIR_ADMIN() {
    CHARGER_LISTE_VALIDEURS().then(function(l) {
        MER_ADMIN_LISTE = JSON.parse(JSON.stringify(l.valideurs ? l : { valideurs: [] }));
        SHOW_PAGE('ADMIN');
    });
}
function TPL_ADMIN() {
    var l = MER_ADMIN_LISTE || { valideurs: [] };
    var lignes = l.valideurs.map(function(v, i) {
        return '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<span class="MER-BADGE">' + LIBELLE_ROLE(v.role) + '</span>' + (v.retire ? ' <span class="MER-BADGE" style="color:#b91c1c;">Retiré</span>' : '') +
            '<div class="MER-PANIER-ITEM-SUB" style="margin-top:6px;">Code créé le ' + ESC(new Date(v.creeLe || v.habiliteLe).toLocaleDateString('fr-FR')) +
            (v.retire ? ', retiré le ' + ESC(new Date(v.retire).toLocaleDateString('fr-FR')) : '') + ' · clé ' + ESC(EMPREINTE_COURTE(v.cle.slice(-24))) + '</div></div>' +
            (v.retire ? '' : '<button type="button" class="BTN-DANGER-TEXT" onclick="ADMIN_RETIRER(' + i + ')">Retirer</button>') + '</div>';
    }).join('') || '<div class="MER-EMPTY">Aucun code d\'accès valideur.</div>';
    return '<div class="CARD"><h2>Administration</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 16px;">Codes d\'accès des valideurs (fichier valideurs.json du dépôt GitHub)</p>' + lignes +
        '<div class="MER-SECTION-TITLE">Nouveau code d\'accès</div>' +
        '<p class="MER-HINT" style="margin-bottom:10px;">Remplace le code actuel du rôle choisi : les validations déjà faites restent valables, l\'ancien code ne fonctionne plus.</p>' +
        '<div class="MER-ACTIONS" style="margin-bottom:10px;">' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="ADMIN_NOUVEAU_CODE(1)">1er valideur</button>' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="ADMIN_NOUVEAU_CODE(2)">2e valideur</button>' +
        '</div>' +
        '<div class="MER-SECTION-TITLE">Publier</div>' +
        '<p class="MER-HINT" style="margin-bottom:10px;">1. Copiez le contenu ci-dessous. 2. Ouvrez valideurs.json sur GitHub, remplacez tout son contenu, puis « Commit changes ». Actif 1 à 2 minutes après.</p>' +
        '<textarea class="MER-CODE" id="MER-ADMIN-JSON" readonly rows="6">' + ESC(JSON.stringify(l, null, 2)) + '</textarea>' +
        '<div class="MER-ACTIONS" style="margin:10px 0;">' +
            '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="COPIER_TEXTE(document.getElementById(\'MER-ADMIN-JSON\').value, this)">Copier</button>' +
            '<a class="BTN BTN-PRIMARY BTN-SMALL" target="_blank" rel="noopener" href="' + MER_DEPOT_GITHUB + '/edit/main/valideurs.json">Ouvrir sur GitHub</a>' +
        '</div>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button></div>';
}
function ADMIN_NOUVEAU_CODE(role) {
    MSG_CONFIRM('Nouveau code ?', 'Créer un nouveau code d\'accès pour le ' + LIBELLE_ROLE(role) + ' ?\n\nL\'ancien code cessera de fonctionner une fois la liste publiée.',
        'Créer le code', function() { ADMIN_CREER_CODE(role); }, '🔑', 'mascotte-code.webp');
}
function ADMIN_CREER_CODE(role) {
    CREER_ACCES(role).then(function(r) {
        var maintenant = new Date().toISOString();
        MER_ADMIN_LISTE.valideurs.forEach(function(a) { if (a.role === role && !a.retire) a.retire = maintenant; });
        MER_ADMIN_LISTE.valideurs.push(r.acces);
        SHOW_PAGE('ADMIN');
        AFFICHER_MODALE('Code du ' + LIBELLE_ROLE(role),
            '<p style="font-size:0.86em; line-height:1.5;">Notez ce code et remettez-le au valideur : il ne sera plus jamais affiché. Pensez ensuite à publier la liste.</p>' +
            '<div class="MER-CODE" style="font-size:1.2em; min-height:0; text-align:center; letter-spacing:0.08em; user-select:all;">' + ESC(r.code) + '</div>',
            '<button type="button" class="BTN BTN-SECONDARY" onclick="COPIER_TEXTE(\'' + r.code + '\', this)">Copier</button>' +
            '<button type="button" class="BTN BTN-PRIMARY" onclick="FERMER_MODALE()">C\'est noté</button>');
    });
}
function ADMIN_RETIRER(i) {
    var v = MER_ADMIN_LISTE.valideurs[i];
    MSG_CONFIRM('Retirer ce code ?', 'Code d\'accès du ' + LIBELLE_ROLE(v.role) + '.\n\nLes validations passées restent valables ; ce code ne fonctionnera plus.', 'Retirer', function() {
        v.retire = new Date().toISOString();
        SHOW_PAGE('ADMIN');
    }, '🗑️', 'mascotte-poubelle.webp', true);
}

// ===================== RETOUR D'UN REFUS (côté demandeur) =====================
function IMPORTER_REFUS(input) {
    LIRE_FICHIERS_JSON(input, function(contenus) {
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
        SHOW_PAGE('PANIER');
    });
}
function MODIFIER_DEMANDE(id) {
    var d = GET_PANIER().filter(function(x) { return x.id === id; })[0];
    if (!d) return;
    SAVE_PANIER(GET_PANIER().filter(function(x) { return x.id !== id; }));
    D = d;
    MER_ACTIVE_TAB = 'IDENTITE';
    SAVE_BROUILLON();
    SHOW_PAGE('FORMULAIRE');
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
    if (document.getElementById('INTRO-SPLASH')) return false;
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
        if (data.appCodeVersion > APP_CODE_VERSION) aFaire.push({ type: 'code', version: data.appCodeVersion, texte: data.appCodeMessage });
        else if (data.appCodeVersion > 0 && vues.appCode !== data.appCodeVersion) {
            if (premiere) SET_MAJ_VUE('appCode', data.appCodeVersion);      // première installation : rien à annoncer
            else aFaire.push({ type: 'nouveautes', version: data.appCodeVersion, texte: data.appCodeMessage });
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
            texte: (item.texte || 'Une nouvelle version de TRIGONE Mise en route est disponible.') + ' Vos données (demande en cours, panier, bibliothèque) ne sont pas affectées.',
            boutons: [{ label: 'Mettre à jour', action: APPLIQUER_MISE_A_JOUR }] });
        return;
    }
    SET_MAJ_VUE(item.type === 'info' ? 'appMessage' : 'appCode', item.version);
    AFFICHER_MSG_CENTRE({ titre: item.type === 'info' ? 'Information' : 'Nouveautés', icone: item.type === 'info' ? '📢' : '✨', mascotte: 'mascotte-maj.webp',
        texte: item.texte || 'TRIGONE Mise en route vient d\'être mis à jour.', boutons: [{ label: 'J\'ai compris', action: suite }] });
}
// Vide le cache de l'appli et recharge : les données (localStorage) ne sont jamais touchées.
function APPLIQUER_MISE_A_JOUR() {
    AFFICHER_MSG_CENTRE({ titre: 'Mise à jour en cours…', texte: 'Merci de patienter quelques instants.', icone: '⏳', mascotte: 'mascotte-maj.webp', boutons: [] });
    var etapes = [];
    if (window.caches) etapes.push(caches.keys().then(function(k) { return Promise.all(k.map(function(c) { return caches.delete(c); })); }));
    if (navigator.serviceWorker) etapes.push(navigator.serviceWorker.getRegistration().then(function(r) { return r && r.update(); }));
    Promise.all(etapes).catch(function() {}).then(function() { setTimeout(function() { location.reload(); }, 400); });
}
function VERIFIER_MISE_A_JOUR_MANUELLE() {
    var btn = document.getElementById('BTN-CHECK-UPDATE');
    if (btn) { btn.textContent = '🔄 Vérification…'; btn.disabled = true; }
    VERIFIER_MISES_A_JOUR(true);
    setTimeout(function() { if (btn) { btn.textContent = '🔄 Mise à jour'; btn.disabled = false; } }, 1200);
}
function INIT_VERIF_MAJ_AUTO() {
    VERIFIER_MISES_A_JOUR(false);
    document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') VERIFIER_MISES_A_JOUR(false); });
    window.addEventListener('online', function() { MAJ_DERNIERE_VERIF = 0; VERIFIER_MISES_A_JOUR(false); });
}
function REGISTER_SERVICE_WORKER() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
        document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') reg.update().catch(function() {}); });
    }).catch(function(e) { console.warn('Service Worker:', e); });
}

window.addEventListener('DOMContentLoaded', function() {
    APPLIQUER_THEME_INITIAL();
    LOAD_BROUILLON();
    window.addEventListener('hashchange', function() { if (location.hash === '#admin') OUVRIR_ADMIN(); });
    if (location.hash === '#admin') OUVRIR_ADMIN();
    else SHOW_PAGE(D.personnes[0].nom || D.objet ? 'FORMULAIRE' : 'ACCUEIL');
    // Première ouverture : présentation, puis « Avant de commencer ». Ensuite : code d'accès s'il est activé.
    var vue = false;
    try { vue = localStorage.getItem(STORAGE_POURQUOI) === '1'; } catch (e) {}
    var suite = function() { if (!CONFIG_FAITE()) AFFICHER_CONFIG_INITIALE(); PROPOSER_INSTALLATION_PREMIERE_FOIS(); };
    if (!vue) AFFICHER_POURQUOI(suite);
    else if (PIN_EST_DEFINI()) OUVRIR_ECRAN_PIN('verif', suite);
    else suite();
    REGISTER_SERVICE_WORKER();
    INIT_VERIF_MAJ_AUTO();
});
