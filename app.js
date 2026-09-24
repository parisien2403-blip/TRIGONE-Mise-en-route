// ===================== TRIGONE MISE EN ROUTE — logique =====================
var MER_VERSION = 1;
var STORAGE_PANIER = 'mer_panier';
var STORAGE_BROUILLON = 'mer_brouillon';
var STORAGE_REGLAGES = 'mer_reglages';

var MOYENS = { SERVICE: 'Véhicule de service', FERREE: 'Voie ferrée', AERIENNE: 'Voie aérienne', MARITIME: 'Voie maritime' };

function VIDE_TRAJET() { return { moyen: '', lieuDep: '', cpDep: '', dateDep: '', lieuArr: '', cpArr: '', dateArr: '' }; }
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
            intermediaireRetourActif: false, intermediaireRetour: VIDE_TRAJET()
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
var MER_TABS_ORDRE = ['IDENTITE', 'TRAJETS', 'CONDITIONS', 'IMPUTATION'];
var MER_TABS_LABELS = { IDENTITE: '1. Identité', TRAJETS: '2. Trajets', CONDITIONS: '3. Alimentation & hébergement', IMPUTATION: '4. Imputation' };
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
            if (sauvegarde.onglet) MER_ACTIVE_TAB = sauvegarde.onglet;
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
    window.scrollTo(0, 0);
}

function TPL_ACCUEIL() {
    var panier = GET_PANIER();
    var n = panier.length;
    return '' +
    '<div id="MER-P0">' +
      '<div class="MER-P0-SHELL">' +
        '<div class="MER-P0-INNER">' +
          '<div class="MER-LOGO-WRAP"><img class="MER-LOGO-IMG" src="logo_mer.webp" alt="TRIGONE — Mise en route"></div>' +
        '</div>' +
        '<div class="MER-P0-HERO">' +
          '<button type="button" class="BTN BTN-PRIMARY" onclick="NOUVELLE_DEMANDE()">+ Nouvelle demande</button>' +
          (n ? '<button type="button" class="BTN BTN-ACCENT" onclick="SHOW_PAGE(\'PANIER\')">📋 Mon panier <span class="MER-BADGE" style="background:rgba(255,255,255,0.25); color:#fff;">' + n + '</span></button>'
             : '<button type="button" class="BTN BTN-SECONDARY" disabled>Panier vide</button>') +
          '<p class="app-credit">Conçu par Germain-Pierre BOUQUET <span class="APP-VERSION-TAG">- V' + MER_VERSION + '</span></p>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function NOUVELLE_DEMANDE() {
    CLEAR_BROUILLON();
    MER_ACTIVE_TAB = 'IDENTITE';
    var reg = GET_REGLAGES();
    if (reg.derniereUnite) D.personnes[0].unite = reg.derniereUnite;
    if (reg.derniereCie) D.personnes[0].cie = reg.derniereCie;
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
function ON_CHAMP_INPUT(path, val) { var n = NAV_CHAMP(path); n.obj[n.key] = val; SAVE_BROUILLON(); }
function ON_CHAMP_BOOL(path, val) { var n = NAV_CHAMP(path); n.obj[n.key] = val; SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }
function GET_CHAMP(path) { var n = NAV_CHAMP(path); return n.obj[n.key]; }

function RENDER_FORMULAIRE_INPLACE() {
    var scroll = window.scrollY;
    document.getElementById('PAGE-STAGE').innerHTML = TPL_FORMULAIRE();
    window.scrollTo(0, scroll);
}

function CHAMP_TXT(label, path, placeholder, type) {
    type = type || 'text';
    var v = (GET_CHAMP(path) || '');
    return '<div class="MER-FIELD"><label>' + label + '</label>' +
        '<input type="' + type + '" value="' + (v + '').replace(/"/g, '&quot;') + '" placeholder="' + (placeholder || '') + '" ' +
        'oninput="ON_CHAMP_INPUT(\'' + path + '\', this.value)"></div>';
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
    return '<div class="MER-FIELD"><label>Moyen de transport</label><select onchange="ON_CHAMP_INPUT(\'' + path + '\', this.value)">' + opts + '</select></div>';
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
            CHAMP_TXT('Matricule', 'personnes.' + i + '.matricule', 'EX : 06 750 101 91') +
        '</div>' +
        '<div class="MER-ROW2">' +
            CHAMP_TXT('Nom', 'personnes.' + i + '.nom', 'EX : BOUQUET') +
            CHAMP_TXT('Prénom', 'personnes.' + i + '.prenom', 'EX : G-P') +
        '</div>' +
    '</div>';
}
function AJOUTER_PERSONNE() { D.personnes.push(VIDE_PERSONNE()); SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }
function RETIRER_PERSONNE(i) { D.personnes.splice(i, 1); SAVE_BROUILLON(); RENDER_FORMULAIRE_INPLACE(); }

function TPL_TRAJET(titre, path, optionnel) {
    return '<p class="MER-HINT" style="font-weight:800; text-transform:uppercase; letter-spacing:0.04em; margin:14px 0 8px;">' + titre + (optionnel ? ' <span style="font-weight:600; text-transform:none;">(si besoin)</span>' : '') + '</p>' +
        SELECT_MOYEN(path + '.moyen') +
        '<div class="MER-ROW2">' +
            CHAMP_TXT('Lieu de départ', path + '.lieuDep', 'EX : Bordeaux') +
            CHAMP_TXT('Code postal', path + '.cpDep', 'EX : 33000') +
        '</div>' +
        CHAMP_TXT('Date et heure de départ', path + '.dateDep', '', 'datetime-local') +
        '<div class="MER-ROW2">' +
            CHAMP_TXT('Lieu d\'arrivée', path + '.lieuArr', 'EX : Paris') +
            CHAMP_TXT('Code postal', path + '.cpArr', 'EX : 75015') +
        '</div>' +
        CHAMP_TXT('Date et heure d\'arrivée', path + '.dateArr', '', 'datetime-local');
}

// ===================== ONGLETS DU FORMULAIRE =====================
function SWITCH_MER_TAB(tab) {
    MER_ACTIVE_TAB = tab;
    RENDER_FORMULAIRE_INPLACE();
}
function MER_TAB_SUIVANT() {
    var idx = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB);
    if (idx < MER_TABS_ORDRE.length - 1) SWITCH_MER_TAB(MER_TABS_ORDRE[idx + 1]);
    else AJOUTER_AU_PANIER();
}
function MER_TAB_PRECEDENT() {
    var idx = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB);
    if (idx > 0) SWITCH_MER_TAB(MER_TABS_ORDRE[idx - 1]);
}

function TPL_TABS_BAR() {
    return '<div class="MER-TABS">' + MER_TABS_ORDRE.map(function(t) {
        return '<button type="button" class="MER-TAB' + (t === MER_ACTIVE_TAB ? ' active' : '') + '" onclick="SWITCH_MER_TAB(\'' + t + '\')">' + MER_TABS_LABELS[t] + '</button>';
    }).join('') + '</div>';
}

function TPL_ONGLET_IDENTITE() {
    return '<div class="MER-TOGGLE-PAIR" style="margin-bottom:16px;">' +
        '<button type="button" class="MER-TOGGLE-BTN' + (D.type === 'MISSION' ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'type\', \'MISSION\')">Mission</button>' +
        '<button type="button" class="MER-TOGGLE-BTN' + (D.type === 'FORMATION' ? ' actif' : '') + '" onclick="ON_CHAMP_BOOL(\'type\', \'FORMATION\')">Formation / stage</button>' +
      '</div>' +
      '<div class="MER-FIELD"><label>Objet</label><textarea rows="2" oninput="ON_CHAMP_INPUT(\'objet\', this.value)" placeholder="EX : Formation conseiller facteur humain">' + (D.objet || '') + '</textarea></div>' +
      '<div class="MER-SECTION-TITLE">Personnel concerné</div>' +
      D.personnes.map(function(_, i) { return TPL_PERSONNE(i); }).join('') +
      '<button type="button" class="BTN BTN-GHOST BTN-SMALL" onclick="AJOUTER_PERSONNE()">+ Ajouter une personne (demande collective)</button>';
}

function TPL_ONGLET_TRAJETS() {
    var interA = !!D.trajets.intermediaireAllerActif;
    var interR = !!D.trajets.intermediaireRetourActif;
    return '<div class="MER-SECTION-TITLE" style="margin-top:0;">Trajet aller</div>' + TPL_TRAJET('Trajet aller', 'trajets.aller') +
      '<label class="MER-CHECKBOX-ROW"><input type="checkbox" ' + (interA ? 'checked' : '') + ' onchange="ON_CHAMP_BOOL(\'trajets.intermediaireAllerActif\', this.checked)"><span>Trajet intermédiaire sur l\'aller</span></label>' +
      (interA ? TPL_TRAJET('Trajet intermédiaire (aller)', 'trajets.intermediaireAller') : '') +
      '<div class="MER-SECTION-TITLE">Trajet retour</div>' + TPL_TRAJET('Trajet retour', 'trajets.retour') +
      '<label class="MER-CHECKBOX-ROW"><input type="checkbox" ' + (interR ? 'checked' : '') + ' onchange="ON_CHAMP_BOOL(\'trajets.intermediaireRetourActif\', this.checked)"><span>Trajet intermédiaire sur le retour</span></label>' +
      (interR ? TPL_TRAJET('Trajet intermédiaire (retour)', 'trajets.intermediaireRetour') : '');
}

function TPL_ONGLET_CONDITIONS() {
    return '<div class="MER-SECTION-TITLE" style="margin-top:0;">Durant le déplacement</div>' +
      TOGGLE_OUI_NON('Nourri à titre onéreux', 'nourriDeplacement') +
      TOGGLE_OUI_NON('Transport en commun', 'transportCommun') +
      TOGGLE_OUI_NON('Autres frais', 'autresDeplacement') +
      (D.autresDeplacement ? CHAMP_TXT('Préciser', 'autresDeplacementTexte', '') : '') +
      '<div class="MER-SECTION-TITLE">Durant la mission</div>' +
      TOGGLE_OUI_NON('Nourri à titre onéreux', 'nourriMission', 'Repas midi gratuit, repas du soir secteur privé, sauf indication contraire.') +
      TOGGLE_OUI_NON('Logé à titre onéreux', 'logeMission');
}

function TPL_ONGLET_IMPUTATION() {
    return '<div class="MER-SECTION-TITLE" style="margin-top:0;">Imputation</div>' +
      TOGGLE_OUI_NON('Mission imputée à l\'unité', 'missionImputee', '', 'Fournir le justificatif de l\'autorité ayant prescrit le déplacement.') +
      CHAMP_TXT('Code d\'engagement FD@LIGNE', 'codeFD', 'EX : FD1ADSJ11F') +
      TOGGLE_OUI_NON('Demande d\'avance', 'demandeAvance') +
      '<div class="MER-SECTION-TITLE">NDS ou DAF</div>' +
      '<div class="MER-FIELD"><label>Note de service ou DAF à joindre</label><textarea rows="2" oninput="ON_CHAMP_INPUT(\'piecesJointes\', this.value)" placeholder="EX : note de service n°... jointe au mail">' + (D.piecesJointes || '') + '</textarea>' +
      '<p class="MER-HINT">Décrivez ici la pièce à joindre — le fichier lui-même s\'ajoute au moment de l\'envoi du mail, comme le PDF.</p></div>';
}

function TPL_FORMULAIRE() {
    var idx = MER_TABS_ORDRE.indexOf(MER_ACTIVE_TAB);
    var dernier = idx === MER_TABS_ORDRE.length - 1;
    var contenu = MER_ACTIVE_TAB === 'IDENTITE' ? TPL_ONGLET_IDENTITE()
        : MER_ACTIVE_TAB === 'TRAJETS' ? TPL_ONGLET_TRAJETS()
        : MER_ACTIVE_TAB === 'CONDITIONS' ? TPL_ONGLET_CONDITIONS()
        : TPL_ONGLET_IMPUTATION();
    return '' +
    '<div class="CARD">' +
      '<h2>Nouvelle demande</h2>' +
      '<p class="MER-HINT" style="margin:4px 0 16px;">Demande et Ordre de Mise en Route (DOMR)</p>' +
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
    if (!p0.nom || !p0.prenom) { alert('Merci de renseigner au moins le nom et le prénom de la première personne.'); return; }
    if (!D.objet) { alert('Merci de renseigner l\'objet de la demande.'); return; }
    var reg = GET_REGLAGES();
    reg.derniereUnite = p0.unite; reg.derniereCie = p0.cie;
    SAVE_REGLAGES(reg);
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
            '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button>' +
        '</div>';
    }
    var items = panier.map(function(d) {
        var r = RESUME_DEMANDE(d);
        return '<div class="MER-PANIER-ITEM"><div class="MER-PANIER-ITEM-TXT">' +
            '<div class="MER-PANIER-ITEM-TITRE">' + r.noms + '</div>' +
            '<div class="MER-PANIER-ITEM-SUB">' + r.sous + '</div>' +
            '</div><button type="button" class="BTN-DANGER-TEXT" onclick="RETIRER_DU_PANIER(\'' + d.id + '\')">Retirer</button></div>';
    }).join('');
    return '<div class="CARD">' +
        '<h2>Mon panier</h2>' +
        '<p class="MER-HINT" style="margin:4px 0 18px;">' + panier.length + ' demande(s) prête(s) à être envoyée(s) ensemble, en un seul mail.</p>' +
        items +
        '<button type="button" class="BTN BTN-GHOST BTN-SMALL" style="margin-bottom:18px;" onclick="NOUVELLE_DEMANDE()">+ Ajouter une autre demande</button>' +
        '<div class="MER-SECTION-TITLE">Envoi</div>' +
        '<div class="MER-FIELD"><label>Mail du 1er signataire (chef de service)</label>' +
        '<input type="email" id="MER-MAIL-DEST" value="' + (reg.mailSignataire || '') + '" placeholder="EX : prenom.nom@interieur.gouv.fr" ' +
        'oninput="var r=GET_REGLAGES(); r.mailSignataire=this.value; SAVE_REGLAGES(r);"></div>' +
        '<button type="button" class="BTN BTN-PRIMARY" onclick="PREPARER_ENVOI()">📧 Envoyer le panier (' + panier.length + ')</button>' +
        '<button type="button" class="BTN BTN-SECONDARY" onclick="SHOW_PAGE(\'ACCUEIL\')">← Accueil</button>' +
    '</div>';
}

// ===================== GÉNÉRATION DU PDF =====================
// Mise en page calquée sur la DOMR papier (tableaux encadrés, cases à cocher), une page par demande.
var PDF_ROUGE = [200, 30, 30], PDF_BLEU = [30, 60, 190], PDF_GRIS = [222, 227, 236];

function PDF_POLICE(doc, style, taille, couleur) {
    doc.setFont('helvetica', style || 'normal');
    if (taille) doc.setFontSize(taille);
    doc.setTextColor.apply(doc, couleur || [0, 0, 0]);
}
// Case à cocher dont y est la ligne de base du texte voisin ; renvoie la position x après le libellé.
function PDF_CASE(doc, x, y, coche, libelle) {
    doc.setLineWidth(0.25);
    doc.rect(x, y - 2.8, 3, 3);
    if (coche) { doc.line(x + 0.5, y - 2.3, x + 2.5, y - 0.3); doc.line(x + 2.5, y - 2.3, x + 0.5, y - 0.3); }
    if (!libelle) return x + 3;
    doc.text(libelle, x + 4.2, y);
    return x + 4.2 + doc.getTextWidth(libelle);
}
function PDF_OUI_NON(doc, x, y, valeur, ecart) {
    // valeur null/undefined : aucune case cochée (information non saisie dans l'application)
    PDF_CASE(doc, x, y, valeur === true, 'OUI');
    PDF_CASE(doc, x + (ecart || 15), y, valeur === false, 'NON');
}
function PDF_SOULIGNE(doc, texte, x, y, opts) {
    var w = doc.getTextWidth(texte);
    var x0 = opts && opts.align === 'center' ? x - w / 2 : x;
    doc.text(texte, x0, y);
    doc.setLineWidth(0.2); doc.line(x0, y + 0.6, x0 + w, y + 0.6);
    return x0 + w;
}
// Texte centré dans une cellule, police réduite si nécessaire pour tenir dans la largeur.
function PDF_TEXTE_CELLULE(doc, texte, x, y, largeur, taille) {
    texte = (texte || '').toString();
    var t = taille;
    doc.setFontSize(t);
    while (t > 5 && doc.getTextWidth(texte) > largeur - 2) { t -= 0.5; doc.setFontSize(t); }
    doc.text(texte, x + largeur / 2, y, { align: 'center' });
    doc.setFontSize(taille);
}
function PDF_DATE(v) {
    if (!v) return '';
    var dt = new Date(v);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString('fr-FR') + ' ' + ('0' + dt.getHours()).slice(-2) + 'h' + ('0' + dt.getMinutes()).slice(-2);
}

function PDF_ENTETE(doc, M, L) {
    PDF_POLICE(doc, 'bold', 13);
    doc.text('MINISTÈRE', M, 20);
    doc.text('DE L\'INTÉRIEUR', M, 25.5);
    PDF_POLICE(doc, 'italic', 7.5);
    doc.text(['Liberté', 'Égalité', 'Fraternité'], M, 30.5, { lineHeightFactor: 1.15 });

    // Cadre d'enregistrement (rempli par le secrétariat EM)
    var bx = M + L - 60;
    doc.setLineWidth(0.3); doc.rect(bx, 8, 60, 24);
    PDF_POLICE(doc, 'bolditalic', 7.5);
    doc.text('(Enregistrement secrétariat EM)', bx + 30, 12.5, { align: 'center' });
    PDF_POLICE(doc, 'bold', 9);
    doc.text('n°', bx + 12, 20);
    doc.setLineDashPattern([0.6, 0.6], 0); doc.line(bx + 16, 20.3, bx + 52, 20.3); doc.setLineDashPattern([], 0);
    PDF_POLICE(doc, 'normal', 9);
    doc.text('DATE :', bx + 22, 28);

    // Titre encadré
    doc.setLineWidth(0.4); doc.rect(105 - 35, 36, 70, 11);
    PDF_POLICE(doc, 'bold', 11);
    doc.text('DEMANDE ET ORDRE', 105, 40.6, { align: 'center' });
    doc.text('DE MISE EN ROUTE', 105, 45.2, { align: 'center' });

    // Consigne d'envoi
    var a = '(à faire parvenir à ', mail = 'dsc-courrier-comformisc@interieur.gouv.fr', b = '  minimum 7 jours avant la mission )';
    PDF_POLICE(doc, 'normal', 8);
    var x = 105 - (doc.getTextWidth(a) + doc.getTextWidth(mail) + doc.getTextWidth(b)) / 2;
    doc.text(a, x, 51); x += doc.getTextWidth(a);
    doc.setTextColor.apply(doc, PDF_BLEU); doc.setDrawColor.apply(doc, PDF_BLEU);
    x = PDF_SOULIGNE(doc, mail, x, 51);
    doc.setDrawColor(0); doc.setTextColor(0);
    x = PDF_SOULIGNE(doc, 'minimum 7 jours avant la mission', x + 1.2, 51);
    doc.text(' )', x, 51);
    return 54;
}

function PDF_PERSONNEL(doc, d, M, L, y) {
    var larg = [35.5, 13.3, 26.4, 36.2, 39.9, 0];
    larg[5] = L - larg.slice(0, 5).reduce(function(s, v) { return s + v; }, 0);
    var entetes = ['UNITÉ/ENTITÉ', 'CIE', 'GRADE', 'NOM', 'PRÉNOM', 'MATRICULE'];
    var hEntete = 7.5, hLigne = 5.5;
    var lignes = Math.max(4, d.personnes.length);
    doc.setLineWidth(0.25);
    var x = M;
    entetes.forEach(function(h, i) {
        doc.rect(x, y, larg[i], hEntete);
        PDF_POLICE(doc, 'bold', 9, i === 1 ? PDF_ROUGE : null);
        doc.text(h, x + larg[i] / 2, y + 5, { align: 'center' });
        x += larg[i];
    });
    y += hEntete;
    for (var r = 0; r < lignes; r++) {
        var p = d.personnes[r] || {};
        var vals = [p.unite, p.cie, p.grade, p.nom, p.prenom, p.matricule];
        x = M;
        vals.forEach(function(v, i) {
            doc.rect(x, y, larg[i], hLigne);
            PDF_POLICE(doc, i < 2 ? 'bold' : 'normal', 9);
            PDF_TEXTE_CELLULE(doc, i === 3 ? (v || '').toUpperCase() : v, x, y + 3.9, larg[i], 9);
            x += larg[i];
        });
        y += hLigne;
    }

    // Type
    doc.rect(M, y, L, 7);
    PDF_POLICE(doc, 'normal', 9);
    PDF_CASE(doc, M + 3, y + 4.8, d.type === 'MISSION', 'MISSION');
    var xf = PDF_CASE(doc, M + 42, y + 4.8, d.type === 'FORMATION', 'FORMATION/STAGE');
    PDF_POLICE(doc, 'normal', 7.5);
    doc.text('(sur présentation d\'une DAF, donc stage inscrit au CAF)', xf + 1.2, y + 4.8);
    y += 7;

    // Objet
    PDF_POLICE(doc, 'bold', 9);
    var lbl = 'Objet : ';
    var objLignes = doc.splitTextToSize((d.objet || '').toUpperCase(), L - 4 - doc.getTextWidth(lbl));
    var hObj = Math.max(7, 3 + 4.2 * objLignes.length);
    doc.rect(M, y, L, hObj);
    doc.text(lbl, M + 2, y + 4.8);
    doc.text(objLignes, M + 2 + doc.getTextWidth(lbl), y + 4.8, { lineHeightFactor: 1.3 });
    y += hObj;

    // Création d'un OM (non saisi dans l'application : laissé vierge)
    var hOM = 21, gOM = 64;
    doc.setFillColor.apply(doc, PDF_GRIS); doc.rect(M, y, gOM, hOM, 'FD');
    doc.rect(M + gOM, y, L - gOM, hOM);
    PDF_POLICE(doc, 'normal', 11);
    doc.text('OM', M + gOM / 2 + 1.5, y + hOM / 2 + 3, { angle: 90 });
    var xt = M + gOM + 2;
    PDF_POLICE(doc, 'bold', 8.5);
    var xo = PDF_SOULIGNE(doc, 'Création d\'un Ordre de Mission (OM) :', xt, y + 4.2);
    PDF_POLICE(doc, 'normal', 8.5);
    PDF_OUI_NON(doc, xo + 2, y + 4.2, null, 14);
    doc.text(['Veuillez cocher OUI si il y aura des frais de déplacement (tous types).',
              'Une D\'OMR = Un OM individuel / Plusieurs noms sur une D\'OMR = Un Ordre de',
              'Mission Collectif (OMC)'], xt, y + 8.2, { lineHeightFactor: 1.2 });
    PDF_POLICE(doc, 'normal', 8.5, PDF_ROUGE);
    doc.text('Si vous souhaitez des OM individuels, veuillez initier plusieurs DOMR.', xt, y + 19);
    doc.setTextColor(0);
    return y + hOM;
}

function PDF_ABT(doc, M, L, y) {
    // Réservations ABT : non saisies dans l'application, laissées vierges.
    var h = 26, g = 9;
    doc.setLineWidth(0.25);
    doc.setFillColor.apply(doc, PDF_GRIS); doc.rect(M, y, g, h, 'FD');
    doc.rect(M + g, y, L - g, h);
    PDF_POLICE(doc, 'normal', 11);
    doc.text('ABT', M + g / 2 + 1.5, y + h / 2 + 3.5, { angle: 90 });
    var xt = M + g + 2, xc = M + 88;
    [['Réservation transport par ABT :', y + 5], ['Réservation Hôtel par ABT :', y + 17]].forEach(function(l) {
        PDF_POLICE(doc, 'bold', 8.5, PDF_ROUGE); doc.setDrawColor.apply(doc, PDF_ROUGE);
        PDF_SOULIGNE(doc, l[0], xt, l[1]);
        doc.text(['SI OUI veuillez remplir l\'annexe en bas de', 'page (une par missionnaire).'], xt, l[1] + 4.2, { lineHeightFactor: 1.2 });
        doc.setDrawColor(0);
        PDF_POLICE(doc, 'normal', 8.5);
        PDF_OUI_NON(doc, xc, l[1], null, 14);
    });
    return y + h;
}

function PDF_TRAJETS(doc, d, M, L, y) {
    var t = d.trajets;
    var blocs = [['TRAJET ALLÉ', t.aller]];
    if (t.intermediaireAllerActif) blocs.push(['TRAJET INTERMÉDIAIRE (ALLER)', t.intermediaireAller]);
    if (t.intermediaireRetourActif) blocs.push(['TRAJET INTERMÉDIAIRE (RETOUR)', t.intermediaireRetour]);
    if (!t.intermediaireAllerActif && !t.intermediaireRetourActif) blocs.push(['TRAJET RETOUR OU INTERMÉDIAIRE', VIDE_TRAJET()]);
    blocs.push(['TRAJET RETOUR', t.retour]);

    doc.setLineWidth(0.25);
    doc.rect(M, y, L, 5);
    PDF_POLICE(doc, 'bolditalic', 9);
    doc.text('À remplir obligatoirement par le demandeur', M + L / 2, y + 3.6, { align: 'center' });
    y += 5;
    var colonnes = [['SERVICE', 'VÉHICULE DE SERVICE'], ['FERREE', 'VOIE FERRÉE'], ['AERIENNE', 'VOIE AÉRIENNE'], ['MARITIME', 'VOIE MARITIME']];
    var xMilieu = M + L * 0.53;
    blocs.forEach(function(b) {
        var tr = b[1] || VIDE_TRAJET(), h = 23;
        doc.rect(M, y, L, h);
        PDF_POLICE(doc, 'bold', 8.5);
        PDF_SOULIGNE(doc, b[0], M + L / 2, y + 3.4, { align: 'center' });
        PDF_POLICE(doc, 'normal', 8.5);
        var x = M + 2;
        doc.text('Moyen de transport :', x, y + 7.6);
        x += doc.getTextWidth('Moyen de transport :') + 2;
        PDF_POLICE(doc, 'bold', 8.5);
        colonnes.forEach(function(c) { x = PDF_CASE(doc, x, y + 7.6, tr.moyen === c[0], c[1]) + 4.5; });
        doc.setLineWidth(0.4); doc.line(xMilieu, y + 9.3, xMilieu, y + h - 0.8); doc.setLineWidth(0.25);
        [[M + 2, 'Lieu de départ', tr.lieuDep, tr.cpDep, tr.dateDep], [xMilieu + 2, 'Lieu d\'arrivée', tr.lieuArr, tr.cpArr, tr.dateArr]].forEach(function(c) {
            PDF_POLICE(doc, 'bold', 8.5);
            doc.text(c[1] + ' :', c[0], y + 12.3);
            var xVal = c[0] + doc.getTextWidth(c[1] + ' :') + 1.5;
            PDF_POLICE(doc, 'normal', 8.5);
            doc.text(c[2] || '', xVal, y + 12.3, { maxWidth: xMilieu - M - 30 });
            doc.text('Code postal : ' + (c[3] || ''), c[0], y + 16.3);
            doc.text('Date et heure : ' + PDF_DATE(c[4]), c[0], y + 20.3);
        });
        y += h;
    });
    return y;
}

function PDF_CONDITIONS(doc, d, M, L, y) {
    var xLbl = M + 44, xCase = M + 88;
    PDF_POLICE(doc, 'normal', 9);
    PDF_SOULIGNE(doc, 'Durant le déplacement', M + 2, y);
    doc.text('NOURRI à titre onéreux :', xLbl, y); PDF_OUI_NON(doc, xCase, y, !!d.nourriDeplacement); y += 5;
    doc.text('Transport en commun :', xLbl, y); PDF_OUI_NON(doc, xCase, y, !!d.transportCommun); y += 5;
    var autres = 'Autres : ' + (d.autresDeplacement && d.autresDeplacementTexte ? d.autresDeplacementTexte : '');
    doc.text(autres, xLbl, y, { maxWidth: xCase - xLbl - 2 }); PDF_OUI_NON(doc, xCase, y, !!d.autresDeplacement); y += 7;
    var yMission = y;
    PDF_SOULIGNE(doc, 'Durant la mission', M + 2, y);
    doc.text('NOURRI à titre onéreux :', xLbl, y); PDF_OUI_NON(doc, xCase, y, !!d.nourriMission); y += 5;
    doc.text('LOGÉ à titre onéreux :', xLbl, y); PDF_OUI_NON(doc, xCase, y, !!d.logeMission); y += 5;

    var xAv = M + L - 38;
    PDF_POLICE(doc, 'bold', 9, PDF_ROUGE); doc.setDrawColor.apply(doc, PDF_ROUGE);
    PDF_SOULIGNE(doc, 'Demande d\'avance', xAv + 16, yMission - 2, { align: 'center' });
    doc.setDrawColor(0);
    PDF_POLICE(doc, 'normal', 9);
    PDF_OUI_NON(doc, xAv + 2, yMission + 2.5, !!d.demandeAvance, 15);
    return y + 4;
}

function PDF_IMPUTATION(doc, d, M, L, y) {
    PDF_POLICE(doc, 'bold', 9);
    var x = PDF_SOULIGNE(doc, 'Mission imputée au GMNT-COMFORMISC', M + 2, y);
    PDF_POLICE(doc, 'normal', 9);
    PDF_OUI_NON(doc, x + 3, y, !!d.missionImputee, 15);
    y += 5;
    PDF_POLICE(doc, 'normal', 9, PDF_BLEU); doc.setDrawColor.apply(doc, PDF_BLEU);
    x = PDF_SOULIGNE(doc, 'FD@LIGNE', M + 2, y);
    doc.setDrawColor(0);
    PDF_POLICE(doc, 'normal', 9);
    doc.text(' code d\'engagement : ', x, y); x += doc.getTextWidth(' code d\'engagement : ');
    PDF_POLICE(doc, 'bold', 9, PDF_ROUGE);
    doc.text(d.codeFD || '', x, y); x += doc.getTextWidth(d.codeFD || '');
    PDF_POLICE(doc, 'bold', 9);
    doc.text(' (changer si différent)', x, y);
    y += 5;
    PDF_POLICE(doc, 'normal', 9);
    doc.text('Si NON, ', M + 2, y);
    x = PDF_SOULIGNE(doc, 'Fournir justificatif', M + 2 + doc.getTextWidth('Si NON, '), y);
    doc.text(' de l\'autorité ayant prescrit le déplacement', x, y);
    y += 4.5;
    PDF_POLICE(doc, 'bold', 8, PDF_ROUGE);
    doc.text('Tout personnel en mission au sein d\'une UIISC sera placé au taux NOURRI et LOGE à titre gratuit (Facture payée par l\'état-major)', M + 2, y, { maxWidth: L - 4 });
    y += 6;
    if (d.piecesJointes) {
        PDF_POLICE(doc, 'bold', 9);
        doc.text('NDS / DAF jointe :', M + 2, y);
        var xPj = M + 2 + doc.getTextWidth('NDS / DAF jointe :') + 1.5;
        PDF_POLICE(doc, 'normal', 9);
        doc.text(d.piecesJointes, xPj, y, { maxWidth: L - 36 });
    }
    doc.setTextColor(0);
}

function GENERER_PDF(panier) {
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
    var M = 12, L = 210 - 2 * M, BAS = 285;
    var dateEdition = new Date().toLocaleDateString('fr-FR');

    panier.forEach(function(d, idx) {
        if (idx > 0) doc.addPage();
        var y = PDF_ENTETE(doc, M, L);
        y = PDF_PERSONNEL(doc, d, M, L, y);
        y = PDF_ABT(doc, M, L, y + 4);
        y = PDF_TRAJETS(doc, d, M, L, y + 4);
        // Demande collective ou trajets intermédiaires : la suite passe sur une nouvelle page si besoin.
        if (y + 58 > BAS) { doc.addPage(); y = 12; }
        y = PDF_CONDITIONS(doc, d, M, L, y + 7);
        PDF_IMPUTATION(doc, d, M, L, y + 4);

        PDF_POLICE(doc, 'normal', 7, [140, 140, 140]);
        doc.text('Établie via TRIGONE — Mise en route, le ' + dateEdition + ' — demande ' + (idx + 1) + ' / ' + panier.length, 105, 292, { align: 'center' });
        doc.setTextColor(0);
    });

    return doc;
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
function GENERER_JSON_PANIER(panier) {
    return JSON.stringify({
        app: 'TRIGONE-MISE-EN-ROUTE', version: MER_VERSION, etape: 'DEMANDE_INITIALE',
        creeLe: new Date().toISOString(), demandes: panier
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
    if (!mail || mail.indexOf('@') === -1) { alert('Merci de renseigner l\'adresse mail du 1er signataire avant l\'envoi.'); return; }
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
    var panier = GET_PANIER();
    var base = NOM_FICHIER_BASE(panier);
    try {
        var doc = GENERER_PDF(panier);
        doc.save(base + '.pdf');
    } catch (e) { alert('Erreur lors de la génération du PDF : ' + e.message); return; }
    TELECHARGER_TEXTE(base + '.json', GENERER_JSON_PANIER(panier), 'application/json');

    var reg = GET_REGLAGES();
    var sujet = 'TRIGONE Mise en route — ' + panier.length + ' demande(s) — ' + (panier[0].personnes[0].nom || '');
    var corps = 'Bonjour,\n\nVeuillez trouver ci-joint ' + panier.length + ' demande(s) et ordre(s) de mise en route, ainsi que le fichier de suivi (.json).\n\nCordialement.';
    FERMER_MODALE();
    window.location.href = 'mailto:' + encodeURIComponent(reg.mailSignataire) + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);

    SAVE_PANIER([]);
    setTimeout(function() { SHOW_PAGE('ACCUEIL'); }, 300);
}

// ===================== DÉMARRAGE =====================
function REGISTER_SERVICE_WORKER() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(function(e) { console.warn('Service Worker:', e); });
    }
}

window.addEventListener('DOMContentLoaded', function() {
    APPLIQUER_THEME_INITIAL();
    LOAD_BROUILLON();
    SHOW_PAGE(D.personnes[0].nom || D.objet ? 'FORMULAIRE' : 'ACCUEIL');
    REGISTER_SERVICE_WORKER();
});
