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
function DESSINER_CASE(doc, x, y, coche) {
    doc.rect(x, y - 3, 3.2, 3.2);
    if (coche) { doc.setFontSize(8); doc.text('X', x + 0.5, y - 0.3); }
}
function LIGNE_OUI_NON(doc, x, y, label, valeur) {
    doc.setFont(undefined, 'normal'); doc.setFontSize(9);
    doc.text(label, x, y);
    var xCase = x + doc.getTextWidth(label) + 4;
    DESSINER_CASE(doc, xCase, y, !!valeur); doc.text('OUI', xCase + 5, y);
    DESSINER_CASE(doc, xCase + 16, y, !valeur); doc.text('NON', xCase + 21, y);
}

function GENERER_PDF(panier) {
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
    var MARGE = 15, LARGEUR = 210 - 2 * MARGE;

    panier.forEach(function(d, idx) {
        if (idx > 0) doc.addPage();
        var y = MARGE;

        doc.setFont(undefined, 'bold'); doc.setFontSize(14);
        doc.text('DEMANDE ET ORDRE DE MISE EN ROUTE', 105, y, { align: 'center' });
        y += 6;
        doc.setFont(undefined, 'normal'); doc.setFontSize(9);
        doc.text('Établie via TRIGONE — Mise en route, le ' + new Date().toLocaleDateString('fr-FR'), 105, y, { align: 'center' });
        y += 9;
        doc.setLineWidth(0.3); doc.line(MARGE, y, MARGE + LARGEUR, y); y += 8;

        // ---- personnel ----
        doc.setFont(undefined, 'bold'); doc.setFontSize(10); doc.text('PERSONNEL CONCERNÉ', MARGE, y); y += 5;
        doc.setFont(undefined, 'normal'); doc.setFontSize(8.5);
        var colX = [MARGE, MARGE + 28, MARGE + 48, MARGE + 68, MARGE + 100, MARGE + 132];
        var entetes = ['Unité', 'CIE', 'Grade', 'Nom', 'Prénom', 'Matricule'];
        doc.setFont(undefined, 'bold');
        entetes.forEach(function(h, i) { doc.text(h, colX[i], y); });
        y += 4; doc.setFont(undefined, 'normal');
        d.personnes.forEach(function(p) {
            var vals = [p.unite, p.cie, p.grade, p.nom, p.prenom, p.matricule];
            vals.forEach(function(v, i) { doc.text((v || '—').toString().slice(0, 16), colX[i], y); });
            y += 4.5;
        });
        y += 4;

        // ---- type / objet ----
        doc.setFont(undefined, 'bold'); doc.setFontSize(9);
        doc.text('Type :', MARGE, y);
        DESSINER_CASE(doc, MARGE + 12, y, d.type === 'MISSION'); doc.setFont(undefined, 'normal'); doc.text('Mission', MARGE + 17, y);
        DESSINER_CASE(doc, MARGE + 40, y, d.type === 'FORMATION'); doc.text('Formation / stage', MARGE + 45, y);
        y += 6;
        doc.setFont(undefined, 'bold'); doc.text('Objet :', MARGE, y); doc.setFont(undefined, 'normal');
        var objetLignes = doc.splitTextToSize(d.objet || '—', LARGEUR - 18);
        doc.text(objetLignes, MARGE + 18, y);
        y += 4.5 * objetLignes.length + 4;

        // ---- trajets (aller, intermédiaire éventuel sur l'aller, retour, intermédiaire éventuel sur le retour) ----
        var blocsTrajet = [['TRAJET ALLER', d.trajets.aller]];
        if (d.trajets.intermediaireAllerActif) blocsTrajet.push(['TRAJET INTERMÉDIAIRE (ALLER)', d.trajets.intermediaireAller]);
        blocsTrajet.push(['TRAJET RETOUR', d.trajets.retour]);
        if (d.trajets.intermediaireRetourActif) blocsTrajet.push(['TRAJET INTERMÉDIAIRE (RETOUR)', d.trajets.intermediaireRetour]);
        blocsTrajet.forEach(function(pair) {
            var titre = pair[0], t = pair[1];
            var vide = !t.lieuDep && !t.lieuArr;
            doc.setFont(undefined, 'bold'); doc.setFontSize(9); doc.text(titre, MARGE, y); y += 4.5;
            doc.setFont(undefined, 'normal'); doc.setFontSize(8.5);
            if (vide) { doc.text('—', MARGE + 4, y); y += 6; return; }
            doc.text('Moyen : ' + (t.moyen ? MOYENS[t.moyen] : '—'), MARGE + 4, y); y += 4;
            doc.text('Départ : ' + (t.lieuDep || '—') + ' (' + (t.cpDep || '—') + ') — ' + FORMAT_DATE_LONG(t.dateDep), MARGE + 4, y); y += 4;
            doc.text('Arrivée : ' + (t.lieuArr || '—') + ' (' + (t.cpArr || '—') + ') — ' + FORMAT_DATE_LONG(t.dateArr), MARGE + 4, y); y += 6;
        });
        y += 2;

        doc.setFont(undefined, 'bold'); doc.setFontSize(9); doc.text('DURANT LE DÉPLACEMENT', MARGE, y); y += 5;
        LIGNE_OUI_NON(doc, MARGE, y, 'Nourri à titre onéreux', d.nourriDeplacement); y += 6;
        LIGNE_OUI_NON(doc, MARGE, y, 'Transport en commun', d.transportCommun); y += 6;
        LIGNE_OUI_NON(doc, MARGE, y, 'Autres frais' + (d.autresDeplacement && d.autresDeplacementTexte ? ' (' + d.autresDeplacementTexte + ')' : ''), d.autresDeplacement); y += 8;

        doc.setFont(undefined, 'bold'); doc.setFontSize(9); doc.text('DURANT LA MISSION', MARGE, y); y += 5;
        LIGNE_OUI_NON(doc, MARGE, y, 'Nourri à titre onéreux', d.nourriMission); y += 6;
        LIGNE_OUI_NON(doc, MARGE, y, 'Logé à titre onéreux', d.logeMission); y += 6;
        LIGNE_OUI_NON(doc, MARGE, y, 'Demande d\'avance', d.demandeAvance); y += 8;

        LIGNE_OUI_NON(doc, MARGE, y, 'Mission imputée à l\'unité', d.missionImputee); y += 6;
        doc.setFont(undefined, 'bold'); doc.setFontSize(9); doc.text('Code FD@LIGNE : ', MARGE, y); doc.setFont(undefined, 'normal');
        doc.text(d.codeFD || '—', MARGE + 30, y); y += 7;

        if (d.piecesJointes) {
            doc.setFont(undefined, 'bold'); doc.text('NDS ou DAF :', MARGE, y); y += 4.5;
            doc.setFont(undefined, 'normal');
            var pjLignes = doc.splitTextToSize(d.piecesJointes, LARGEUR - 4);
            doc.text(pjLignes, MARGE + 4, y);
        }

        doc.setFontSize(7.5); doc.setTextColor(140);
        doc.text('Page ' + (idx + 1) + ' / ' + panier.length, 105, 290, { align: 'center' });
        doc.setTextColor(0);
    });

    return doc;
}
function FORMAT_DATE_LONG(v) {
    if (!v) return '—';
    try { var dt = new Date(v); return dt.toLocaleDateString('fr-FR') + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '—'; }
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
        '<div style="display:flex; gap:10px; margin-top:18px;">' + boutons + '</div>';
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
