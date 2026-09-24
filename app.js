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
        body: d.personnes.map(function(p) { return [p.unite, p.cie, p.grade, (p.nom || '').toUpperCase(), p.prenom, p.matricule]; })
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
    function lieu(nom, cp) { return (nom || '').toUpperCase() + (cp ? ' (' + cp + ')' : ''); }
    y = PDF_SECTION(doc, 'TRAJETS', X, y, P);
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Trajet', 'Moyen de transport', 'Départ', 'Arrivée']],
        body: trajets.map(function(r) {
            var tr = r[1] || VIDE_TRAJET();
            return [r[0], tr.moyen ? MOYENS[tr.moyen] : '',
                    lieu(tr.lieuDep, tr.cpDep) + '\n' + PDF_DATE(tr.dateDep),
                    lieu(tr.lieuArr, tr.cpArr) + '\n' + PDF_DATE(tr.dateArr)];
        }),
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 36 }, 1: { cellWidth: 38 } }
    });

    y = PDF_SECTION(doc, 'ALIMENTATION & HÉBERGEMENT', X, y, P);
    var autres = 'Autres frais' + (d.autresDeplacement && d.autresDeplacementTexte ? ' : ' + d.autresDeplacementTexte : '');
    y = PDF_TABLEAU(doc, y, M, L, P, {
        head: [['Durant le déplacement', ''], ],
        body: [['Nourri à titre onéreux', PDF_OUI_NON(d.nourriDeplacement)],
               ['Transport en commun', PDF_OUI_NON(d.transportCommun)],
               [autres, PDF_OUI_NON(d.autresDeplacement)]],
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
        body: [['Mission imputée à l\'unité', PDF_OUI_NON(d.missionImputee)], ['Code FD@LIGNE', d.codeFD || '']],
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
var PDF_BAS = 285;

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
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 140, 140);
        doc.text('TRIGONE — Mise en route — demande ' + (idx + 1) + ' / ' + panier.length, 105, 292, { align: 'center' });
        doc.setTextColor.apply(doc, PDF_TEXTE);
    });
    doc.deletePage(1); // page vierge créée par jsPDF à l'ouverture du document

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
