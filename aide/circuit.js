// ===================== AIDE TRIGONE : LE CIRCUIT DE LA PERSONNE =====================
// La mascotte répond sur le parcours réel de celui qui l'interroge : où en est ma demande, mon compte-rendu, combien je
// vais toucher, ma demande est-elle prête, ce que j'ai à valider (valideurs), à traiter (assistant Chorus DT), devises,
// nouveautés, et le « Pourquoi ? » des messages d'erreur. Sans IA ni réseau en plus : elle ne lit que ce que TRIGONE a
// déjà sur cet appareil pour ce compte (le serveur ne donne à chacun que ses propres dossiers) ; un rôle qu'on n'a pas
// ne donne rien (« Je n'ai pas accès à cette information depuis votre compte »).
// Aussi : les propos insultants coupent la conversation.
(function() {
    function N(s) { return window.AIDE_MOTEUR.normal(s); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function euros(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; }
    function eurosRond(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; }
    function lireL(k, def) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } }
    function date(v) { if (!v) return null; if (typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(v)) { var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v); return new Date(+m[3], m[2] - 1, +m[1]); } var d = new Date(v); return isNaN(d) ? null : d; }
    function jour(v) { var d = date(v); return d ? ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) : ''; }
    function quand(ms) {
        var d = date(ms); if (!d) return '';
        var h = ('0' + d.getHours()).slice(-2) + ' h ' + ('0' + d.getMinutes()).slice(-2), auj = new Date(), hier = new Date(Date.now() - 864e5);
        if (d.toDateString() === auj.toDateString()) return 'aujourd\'hui à ' + h;
        if (d.toDateString() === hier.toDateString()) return 'hier à ' + h;
        return 'le ' + jour(d) + ' à ' + h;
    }
    function depuis(ms) {
        var m = Math.max(0, Math.round((Date.now() - ms) / 60000));
        if (m < 60) return m <= 1 ? '1 minute' : m + ' minutes';
        var h = Math.round(m / 60); if (h < 24) return h + ' h';
        var j = Math.round(h / 24); return j + ' jour' + (j > 1 ? 's' : '');
    }
    function bouton(texte, aller) { return '<button type="button" class="AIDE-BTN" data-aller="' + esc(aller) + '">👉 ' + esc(texte) + '</button>'; }
    function actions(h) { return h ? '<div class="AIDE-ACTIONS">' + h + '</div>' : ''; }
    var PAS_ACCES = 'Je n\'ai pas accès à cette information depuis votre compte : je ne vois que vos propres dossiers et ceux que votre rôle vous confie.';

    // ---------- Propos insultants : la conversation est coupée ----------
    // Toujours insultants, même seuls ; les mots plus faibles (« nul », « débile »…) seulement adressés à la mascotte.
    var GROS = / (connard|connards|connasse|conard|connar|conasse|salope|salopes|salopard|salaud|salauds|pute|putes|petasse|pouffiasse|encule|enculer|enculee|enculés|enfoire|enfoiree|batard|batards|batarde|ntm|nique|niquer|niker|nik|fdp|pd|pede|tapette|tafiole|ta gueule|ta geule|ta gueul|tg|ferme la|ferme ta gueule|va te faire|vtff|fils de pute|fils de chien|nique ta mere|de merde|sous merde|merdeux|trou du cul|tete de con|gros con|grosse conne|petit con|sale con|espece de con) /;
    var ADRESSE = / (t es|tu es|t etais|tes|t est|vous etes|espece d|espece de|sale|gros|grosse|pauvre|quel|quelle|mascotte de) (con|conne|cons|nul|nulle|naze|debile|abruti|abrutie|idiot|idiote|cretin|cretine|imbecile|bete|stupide|inutile|bouffon|tocard|clown|teube|boloss|bolosse|mongol|gogol|attarde|demeure|cinglé|cingle|baltringue) /;
    var SEUL = /^ (con|conne|abruti|idiot|cretin|imbecile|debile|bouffon|tocard|nul|naze) $/;
    var FRUSTRE = / (merde|putain|ptn|purée|fait chier|fais chier|ca saoule|ca me saoule|ras le bol|chiant|chiante|galere|relou|ca m enerve|j en ai marre|marre) /;
    var CLE_COUPE = 'trigone_aide_coupee', DUREE_COUPE = 15 * 60 * 1000;
    function insulte(q) { var s = N(q); return GROS.test(s) || ADRESSE.test(s) || SEUL.test(s); }
    function coupeeJusqua() { var t = +(lireL(CLE_COUPE, 0) || 0); return t > Date.now() ? t : 0; }
    function couper() { var t = Date.now() + DUREE_COUPE; try { localStorage.setItem(CLE_COUPE, String(t)); } catch (e) {} return t; }
    function heure(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ' h ' + ('0' + d.getMinutes()).slice(-2); }

    // ---------- Les intentions (chacun l'écrit à sa façon) ----------
    var COMMENT = / (comment|c est quoi|ca veut dire|que veut dire|qu est ce que c est|explique|expliquer|kesako|ca sert a quoi|a quoi sert|ou trouver|ou je trouve|ou se trouve le bouton|tuto) /;
    var PERSO = / (ma|mes|mon|j|je|me|m|moi|ai je|est ce que j) /;
    var STATUT = / (je trouve pas|je trouve plus|trouve pas|trouve plus|ou est passee|ou est passe|disparu|disparue|ou en est|ou en sont|ou est|ou sont|en est ou|en sont ou|elle en est|il en est|ca en est ou|ou ca en est|ou elle en est|ou il en est|avance|avancee|avancement|statut|etat|suivi|nouvelles|news|bloque|bloquee|coince|coincee|toujours pas|validee|validees|valide|signee|signe|passee|passe|acceptee|accepte|refusee|refuse|traitee|traite|recue|recu|partie|parti|arrivee|arrive|a ete|ca avance|ca bouge|ca donne quoi|reponse|retour|en attente|attend|qui l a|chez qui) /;
    var DEMANDE = / (demande|demandes|mer|mise en route|mises en route|om|oms|ordre de mission|ordres de mission|dossier|dossiers|omr|deplacement) /;
    var CR = / (cr|crs|compte rendu|comptes rendus|cr de mission|frais de mission|note de frais|mon remboursement|mes remboursements|mes frais|ma note) /;
    var ARGENT = / (combien|montant|estimation|estimer|estime|toucher|touche|toucherai|toucherais|percevoir|percevrai|rembourse|remboursee|remboursement|rembourser|gagner|gagne|rapporter|rapporte|rapportera|recuperer|recupere|indemnite|indemnites|indemnise|indemnisation|pognon|thune|thunes|fric|oseille|sous|pepettes|ble|argent|euros|tune) /;
    var MA_MISSION = / (je vais|vais je|je toucherai|je touche|j aurai|toucher|percevoir|rapporter|me rapporte|ma mission|cette mission|mon deplacement|ma demande|mon om|ma mer|je serai rembourse|je vais etre rembourse|vais etre rembourse|combien je|combien j|combien on va me|combien vais|combien ca me|ca me fait combien|mon stage|ma formation|ma prochaine mission) /;
    var RELIRE = / (verifie|verifier|verif|verifies|relis|relire|relit|relecture|controle|controler|check|checker|regarde ma|jette un oeil|jeter un oeil) /;
    var PRETE = / (il manque quoi|il me manque quoi|manque t il|qu est ce qui manque|ce qui manque|quoi qui manque|c est bon pour envoyer|je peux envoyer|je peux l envoyer|prete a envoyer|prete a partir|prete pour l envoi|pret pour l envoi|est elle complete|est elle prete|elle est prete|elle est complete|c est complet|tout est bon|j ai tout rempli|j ai rien oublie|j ai oublie quelque chose|j ai oublie quoi|elle est bonne|c est bon ma demande|ma demande est bonne) /;
    var VALIDER = / (a valider|a signer|a viser|valider|signer|viser|validation|validations|signature|signatures) /;
    var QUI_QUOI = / (des|y a t il|est ce qu il y a|j ai|j|ai je|me|moi|mes|attend|attendent|en attente|combien|quoi|qu est ce|reste|il y a|y a|y en a|arrive|arrivees|recues|nouvelles) /;
    var CHORUS = / (a traiter|traiter|registre|numero omr|numeros omr|dernier omr|derniere omr|om a creer|ordres de mission a creer|cr recus|comptes rendus recus|demandes validees|espace chorus|chorus) /;
    // Simulation d'une mission décrite en une phrase (« si je pars sur Paris en VRC 5 jours, logement et repas à ma charge »).
    var DUREE = / (\d{1,3}) ?(jours?|j|journees?|nuits?|nuitees?|semaines?|repas) | (une|un|deux|trois|quatre|cinq|six) (semaines?|jours?|nuits?) | (deux|trois|quatre|cinq|six) repas | du \d{1,2} (au|a) \d{1,2} | une semaine | la semaine /;
    var HYPO = / (si je|si j|si on|je pars|je vais partir|j vais partir|je partirai|on part|on va partir|je dois partir|je pars en mission|pour une mission|mission de|simulation|simuler|simule|hypothese|imaginons|admettons|supposons|par exemple) /;
    var VP = / (vrc|vp|vl perso|vl personnelle|vehicule perso|vehicule personnel|voiture perso|voiture personnelle|ma voiture|ma caisse|ma bagnole|mon vehicule|ma vl|en voiture|avec ma voiture|ik|indemnites? kilometriques?|frais kilometriques?) /;
    var TRAIN = / (train|tgv|sncf|ter|voie ferree|vf) /, AVION = / (avion|vol|aerien|aerienne) /, SERVICE = / (vrm|vehicule de service|vl de service|voiture de service|vehicule militaire|vl service) /;

    var A_JOUR = / (a jour|actualise|actualisee|actualises|actualisees|mis a jour|mise a jour|mises a jour|maj|date de|date du|date des|quelle date|de quand|depuis quand|derniere version|recent|recente|recents|valable|valables|en vigueur|perime|perimee|perimes|obsolete|obsoletes|vieux|vieille|ancien|ancienne|bon|bons|juste|justes|fiable|fiables|officiel|officiels) /;
    var SUJETS_A_JOUR = [['codier', / (codier|code fd|codes fd|codification|imputation|imputations) /], ['ik', / (ik|indemnites? kilometriques?|bareme kilometrique|baremes kilometriques|taux kilometriques?|taux ik|taux km|frais kilometriques?) /],
        ['change', / (taux de change|change|devises?|conversion|bce|dollar|livre) /], ['baremes', / (bareme|baremes|forfaits?|taux de repas|taux repas|indemnites? de mission|indemnites? journalieres?|hebergement|nuitees?|taux par pays|taux des pays|taux etranger) /],
        ['appli', / (appli|application|trigone|version|logiciel|mascotte) /]];
    // Mes chiffres : missions faites, comptes-rendus, nuits, kilomètres, montants, médailles.
    var CHIFFRES = / (combien|nombre|nb|total|totaux|statistique|statistiques|stats|bilan|compteur|chiffres|resume|recap) /;
    var PASSE = / (j ai|ai je|j avais|deja|depuis|cette annee|l annee|l an dernier|annee derniere|en tout|au total|total|jusqu a present|jusqu ici|en (19|20)\d\d|fait|faites|effectue|effectuees|envoye|envoyes|eu|touche|percu|parcouru|dormi|mes) /;
    var SUJET_CHIFFRES = / (touche|percu|gagne|missions?|deplacements?|cr|crs|comptes? rendus?|demandes?|mer|om|nuits?|nuitees?|jours?|km|kilometres?|rembourse|remboursements?|frais|ik|forfaits?|medailles?|trigone d|euros|argent|sous|destinations?|villes?|pays) /;
    // « Ai-je droit au repas du soir ? » (selon SA mission) et « pourquoi 140 € ? » (le détail du calcul).
    var DROIT = / (ai je droit|j ai droit|j aurai droit|aurai je droit|droit au|droit a|droit aux|eligible|eligibles|ca compte|est ce que ca compte|il compte|je peux compter|je peux declarer|je peux mettre|je mets|compte pour|pris en compte|pris en charge|rembourse|remboursee) /;
    var CRENEAU = / (repas|midi|soir|dejeuner|diner|manger|nuit|nuitee|hotel|dormir|petit dejeuner|repas du soir|repas de midi) /;
    var EXPLIQUE = / (pourquoi|comment|explique|expliquer|detail|detaille|detailler|calcul|calcule|d ou vient|d ou sort|ca sort d ou|ca vient d ou|comment c est calcule|comment ca se calcule|c est quoi ce montant) /;
    var MONTANT = / (montant|total|forfait|somme|euros|rembourse|remboursement|calcul|\d+ ?€|\d+ euros|\d+e|seulement|que ca|si peu) /;
    var NOUVEAU = / (quoi de neuf|nouveaute|nouveautes|nouveau dans|du nouveau|nouvelle version|derniere version|derniere mise a jour|ce qui a change|qu est ce qui a change|quoi de nouveau|changements|changelog) /;

    // Devises : noms courants vers les clés des taux de Compte-rendu (euros pour 1 unité).
    var DEVISES = [[/ (dollars? canadiens?|cad) /, 'DOLLAR CANADIEN'], [/ (dollars? australiens?|aud) /, 'DOLLAR AUSTRALIEN'], [/ (dollars? (neo|nouvelle) zelandais|nzd) /, 'DOLLAR NEO-ZELANDAIS'],
        [/ (dollars? de hong kong|hkd) /, 'DOLLAR DE HONG KONG'], [/ (dollars? singapouriens?|sgd) /, 'DOLLAR SINGAPOURIEN'], [/ (dollars?|usd|dollars? us|dollars? americains?|\$) /, 'DOLLAR US'],
        [/ (livres?|livres? sterling|gbp|pounds?) /, 'LIVRE STERLING'], [/ (francs? suisses?|chf) /, 'FRANC SUISSE'], [/ (yens?|jpy) /, 'YEN'], [/ (yuans?|rmb|renminbi|cny) /, 'YUAN CHINOIS'],
        [/ (francs? cfa|fcfa|xof|xaf|cfa) /, 'FRANC CFA'], [/ (dirhams?|mad) /, 'DIRHAM MAROCAIN'], [/ (dinars? tunisiens?|tnd) /, 'DINAR TUNISIEN'], [/ (dinars? algeriens?|dzd) /, 'DINAR ALGERIEN'],
        [/ (couronnes? suedoises?|sek) /, 'COURONNE SUEDOISE'], [/ (couronnes? norvegiennes?|nok) /, 'COURONNE NORVEGIENNE'], [/ (couronnes? danoises?|dkk) /, 'COURONNE DANOISE'],
        [/ (zlotys?|pln) /, 'ZLOTY'], [/ (roubles?|rub) /, 'ROUBLE'], [/ (roupies? indiennes?|roupies?|inr) /, 'ROUPIE INDIENNE'], [/ (reals?|reais|brl) /, 'REAL BRESILIEN'], [/ (pesos? mexicains?|mxn) /, 'PESO MEXICAIN']];
    function devise(s, taux) {
        for (var i = 0; i < DEVISES.length; i++) if (DEVISES[i][0].test(s)) {
            var k = DEVISES[i][1]; if (taux[k] != null) return k;
            var proche = Object.keys(taux).filter(function(x) { return x.indexOf(k.split(' ')[0]) === 0 && (k.split(' ')[1] ? x.indexOf(k.split(' ')[1]) >= 0 : true); })[0];
            return proche || null;
        }
        return null;
    }

    function suite(q) { var s = N(q); if (s.trim().split(' ').length <= 8 && / (depuis|cv|chevaux|en train|en avion|en voiture|en vrc|jours|nuits|loge|nourri|a ma charge) /.test(s)) return true; return s.trim().split(' ').length <= 9 && /^ (et|puis|sinon|aussi|pareil|idem) /.test(s) || / (celle|celui|celles|ceux|l autre|les autres) /.test(s); }
    // Le langage SMS de la base (« jtrouv », « kom », « mtn »…) est déplié avant de chercher l'intention.
    function deplier(q, ctx) { var sms = (ctx && ctx.sms) || {}, s = N(q); return ' ' + s.trim().split(' ').map(function(m) { return !/^\d+$/.test(m) && Object.prototype.hasOwnProperty.call(sms, m) && sms[m] ? sms[m] : m; }).join(' ') + ' '; }
    function intention(q, ctx) {
        q = deplier(q, ctx);
        var s = N(q);
        if (/ qui (valide|signe|vise) /.test(s) || / (mon adresse|mes roles|mon role) /.test(s)) return null;        // réponses personnelles déjà connues
        if (/ (combien de temps|delai|delais|date limite|jusqu a quand|avant quand|trop tard) /.test(s) && / (rendre|cr|compte rendu|faire mon|envoyer) /.test(s) && !/ (ou en est|ou est|deja|traite|recu) /.test(s)) return null;   // délai du CR : fiche du mémento
        if (A_JOUR.test(s) && SUJETS_A_JOUR.some(function(x) { return x[1].test(s); }) && !/ (comment|installer|faire la|ma demande|mon cr) /.test(s)) return 'ajour';
        if (NOUVEAU.test(s) && !/ (comment|installer|faire la) /.test(s)) return 'nouveautes';
        var taux = (ctx.change && ctx.change.taux) || {};
        if (devise(s, taux) && (/\d/.test(s) || / (taux|cours|combien|vaut|fait|conversion|convertir|change|en euros|en euro) /.test(s))) return 'devise';
        if (EXPLIQUE.test(s) && MONTANT.test(q.toLowerCase() + ' ') && !/ (combien la|combien coute|tarif|prix|barem) /.test(s)) return 'calcul';
        if (DROIT.test(s) && CRENEAU.test(s) && !/ (combien|prix|tarif|bareme) /.test(s)) return 'droit';
        if (COMMENT.test(s) && !/ (ou en est|ou est|ou sont|ou en sont|ca avance|ca bouge|ca se passe|ca donne quoi|ca en est) /.test(s)) return null;
        if ((RELIRE.test(s) && (DEMANDE.test(s) || / (formulaire|saisie|tout) /.test(s))) || PRETE.test(s)) return 'relecture';
        if (/ (statistiques|mes stats|mon bilan|mes chiffres) /.test(s)) return 'chiffres';
        // « le CR de Roux », « la demande validée de Petit » : le dossier d'un autre (assistant Chorus DT seulement).
        var autre = / (cr|crs|compte rendu|comptes rendus) (de|du) ([a-z]{3,}) /.exec(s);
        if (autre && !/^(la|le|les|mon|mes|cette|mission|missions|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|retour|stage|formation)$/.test(autre[3])) return 'chorus';
        if (CHORUS.test(s) && (PERSO.test(s) || QUI_QUOI.test(s) || / (dernier|derniere) /.test(s)) && !CR.test(s.replace(/ (cr recus|comptes rendus recus) /, ' '))) return 'chorus';
        if (VALIDER.test(s) && QUI_QUOI.test(s) && !/ (ma demande|mes demandes) (a ete|est|sont|ont) /.test(s) && !STATUT.test(s.replace(/ (valider|signer|valide|signe|en attente|attend|attendent) /g, ' '))) return 'avalider';
        if (CR.test(s) && (STATUT.test(s) || / (mes cr|mes comptes rendus|mon cr|mon compte rendu) $/.test(s)) && !/ (combien|montant|toucher) /.test(s)) return 'moncr';
        if (ARGENT.test(s) && (DUREE.test(s) || HYPO.test(s)) && (VP.test(s) || TRAIN.test(s) || AVION.test(s) || SERVICE.test(s) || DUREE.test(s)) &&
            ctx.tarifs && window.AIDE_DONNEES && (window.AIDE_DONNEES.trouverVille(q, ctx.tarifs) || window.AIDE_DONNEES.trouverPays(q, ctx.tarifs).length || (window.AIDE_DONNEES.villesIk(q) || {}).a)) return 'simulation';
        if ((CHIFFRES.test(s) || / (mes statistiques|mon bilan|mes stats|ma medaille|mes medailles) /.test(s)) && PASSE.test(s) && SUJET_CHIFFRES.test(s) && !/ (je vais|vais je|toucherai|prochaine|cette mission) /.test(s)) return 'chiffres';
        if (ARGENT.test(s) && MA_MISSION.test(s)) return 'estimation';
        if (DEMANDE.test(s) && STATUT.test(s) && (PERSO.test(s) || / de [a-z]{3,} /.test(s))) return 'demande';
        if (CR.test(s) && PERSO.test(s) && STATUT.test(s)) return 'moncr';
        return null;
    }

    // ---------- Les données de la personne ----------
    function suivi() { return window.JUMELAGE_SUIVI ? window.JUMELAGE_SUIVI() : {}; }
    function actualiser() {
        var a = window.JUMELAGE_COMPTE_ACTIF && window.JUMELAGE_COMPTE_ACTIF() && navigator.onLine && window.JUMELAGE_SUIVI_ACTUALISER;
        return a ? Promise.race([window.JUMELAGE_SUIVI_ACTUALISER(), new Promise(function(r) { setTimeout(r, 4000); })]).catch(function() {}) : Promise.resolve();
    }
    function boite() { return window.JUMELAGE_BOITE_LISTE ? window.JUMELAGE_BOITE_LISTE() : []; }
    function roles() { var r = lireL('trigone_roles_locaux', {}) || {}; return { v1: !!r.valideur1, v2: !!r.valideur2, chorus: !!(window.JUMELAGE_ROLE_CHORUS && window.JUMELAGE_ROLE_CHORUS()) || localStorage.getItem('trigone_role_chorus') === '1' }; }
    function nomsDe(d) { return (d.personnes || []).map(function(p) { return [p.grade, p.nom].filter(Boolean).join(' '); }).filter(Boolean).join(', '); }
    function lieuDe(d) { var a = (d.trajets || {}).aller || {}; return a.paysArr && !/^france$/i.test(a.paysArr) ? a.paysArr : (a.lieuArr || ''); }
    function datesDe(d) { var a = (d.trajets || {}).aller || {}, r = (d.trajets || {}).retour || {}; return [jour(a.dateDep), jour(r.dateArr)].filter(Boolean).join(' → '); }
    function titreDe(d) { return d.objet || (lieuDe(d) ? 'Mission à ' + lieuDe(d) : 'Demande de mise en route'); }
    function mesDemandes() {
        var s = suivi(), vues = {}, l = [];
        (lireL('mer_bibliotheque', []) || []).slice().sort(function(a, b) { return new Date(b.envoyeLe || 0) - new Date(a.envoyeLe || 0); }).forEach(function(e) {
            (e.demandes || []).forEach(function(d) { if (!d || vues[d.id]) return; vues[d.id] = 1; l.push({ d: d, envoyeLe: e.envoyeLe, s: s[d.id] || null }); });
        });
        return l;
    }
    function finie(x) { return x.s && (x.s.etape === 'traite' || x.s.etape === 'abandon'); }
    // Choix d'une demande d'après les mots de la question (objet, lieu, noms) ; sinon la plus récente pas encore finie.
    var VIDES = ' ma mes mon ma demande demande demandes mise route mer est elle en ou sont de la le les du des pour avec quoi qui quand est ce que ca a ete valide validee signe passee mission om ordre deja bien ';
    function choisir(l, q, texte) {
        var mots = N(q).trim().split(' ').filter(function(m) { return m.length >= 3 && VIDES.indexOf(' ' + m + ' ') < 0; });
        var meilleur = null, sc = 0;
        l.forEach(function(x) { var t = N(texte(x)), n = mots.filter(function(m) { return t.indexOf(' ' + m) >= 0; }).length; if (n > sc) { sc = n; meilleur = x; } });
        return meilleur ? { x: meilleur, parMots: true } : { x: l.filter(function(x) { return !finie(x); })[0] || l[0], parMots: false };
    }
    var ETAPES = [['envoyee', 'Envoyée'], ['val1', 'VAL 1'], ['val2', 'VAL 2'], ['chorus', 'Chorus DT']];
    function frise(rang, refus) {
        return '<div class="AIDE-FRISE">' + ETAPES.map(function(e, i) {
            var c = refus ? (i === 0 ? 'ok' : '') : i < rang ? 'ok' : i === rang ? 'en' : '';
            return '<span class="AIDE-PT ' + c + '"><i>' + (c === 'ok' ? '✓' : c === 'en' ? '…' : '') + '</i>' + e[1] + '</span>';
        }).join('<span class="AIDE-TR"></span>') + '</div>';
    }
    function etatDemande(s, envoyeLe) {
        if (!s) return { rang: 1, html: 'Envoyée ' + quand(envoyeLe) + '.' + (window.JUMELAGE_COMPTE_ACTIF && window.JUMELAGE_COMPTE_ACTIF() ? '' : ' <small>Connectez votre compte TRIGONE pour suivre ses étapes.</small>') };
        var der = (s.etapes || [])[(s.etapes || []).length - 1] || {}, par = der.qui ? ' (<b>' + esc(der.qui) + '</b>)' : '';
        if (s.etape === 'refus') return { rang: 0, refus: true, html: '<b style="color:#b91c1c">Refusée</b>' + par + ' ' + quand(der.le) + '. Le motif est dans votre Boîte de réception : corrigez-la dans Documents, puis renvoyez-la.' };
        if (s.etape === 'abandon') return { rang: 0, refus: true, html: 'Abandonnée après un refus.' };
        if (s.etape === 'traite') return { rang: 4, html: '<b style="color:#15803d">Traitée par l\'assistant Chorus DT</b>' + par + ' ' + quand(der.le) + ' : l\'ordre de mission est créé dans Chorus DT.' };
        var rang = { val1: 1, val2: 2, chorus: 3 }[s.etape] || 1;
        var fait = { envoyee: 'Envoyée', val1: 'Validée par le VALIDEUR 1', val2: 'Validée par le VALIDEUR 2', renvoi: 'Renvoyée au VALIDEUR 1 par le VALIDEUR 2' }[der.e] || 'Mise à jour';
        return { rang: rang, html: fait + par + ' ' + quand(der.le) + '. <b>Chez ' + (rang === 3 ? 'l\'assistant Chorus DT' : 'le VALIDEUR ' + rang) + ' depuis ' + depuis(s.le || der.le) + '.</b>' };
    }
    function htmlDemande(x, vous) {
        var e = etatDemande(x.s, x.envoyeLe), dt = datesDe(x.d);
        return (vous ? 'Votre demande' : 'La demande') + ' <b>« ' + esc(titreDe(x.d)) + ' »</b>' + (dt ? ' (' + esc(dt) + ')' : '') + (vous ? '' : ' de <b>' + esc(nomsDe(x.d)) + '</b>') + ' :' + frise(e.rang, e.refus) + e.html;
    }
    function repDemande(q) {
        return actualiser().then(function() {
            var l = mesDemandes(), r = roles();
            // Valideur, assistant : les demandes des autres qu'il a validées ou reçues (Boîte), avec leur suite connue.
            var autres = [];
            if (r.v1 || r.v2 || r.chorus) {
                var s = suivi();
                boite().forEach(function(b) { if (['niveau1', 'niveau2', 'renvoi', 'chorus'].indexOf(b.nature) < 0) return;
                    (b.ids || []).forEach(function(id, i) { if (!i) autres.push({ b: b, s: s[id] || null }); }); });
            }
            var texteMoi = function(x) { var a = (x.d.trajets || {}).aller || {}; return [titreDe(x.d), lieuDe(x.d), a.lieuArr, a.paysArr, nomsDe(x.d)].join(' '); }, texteAutre = function(x) { return [x.b.noms, x.b.objet, x.b.lieu].join(' '); };
            var a = autres.length ? choisir(autres, q, texteAutre) : null, m = l.length ? choisir(l, q, texteMoi) : null;
            if (a && a.parMots && !(m && m.parMots)) {
                var x = a.x, e = x.s ? etatDemande(x.s, x.b.le) : null;
                return { html: 'La demande de <b>' + esc(x.b.noms) + '</b> « ' + esc(x.b.objet || 'mise en route') + ' »' + (x.b.dates ? ' (' + esc(x.b.dates) + ')' : '') + ' : ' +
                    (e ? frise(e.rang, e.refus) + e.html : x.b.statut === 'traite' ? 'vous l\'avez traitée ; je n\'en connais pas encore la suite.' : '<b>elle vous attend</b> dans votre Boîte.') +
                    actions(bouton('Ouvrir ma Boîte', 'mer:RECEPTION')), etq: 'D\'après votre Boîte et le suivi TRIGONE' };
            }
            if (!l.length) {
                var panier = lireL('mer_panier', []) || [];
                if (/ de [a-z]{3,} /.test(N(q)) && !(r.v1 || r.v2 || r.chorus)) return { html: PAS_ACCES };
                if (!panier.length) return { vide: true };
                return { html: panier.length ? 'Je ne vois aucune demande envoyée sur cet appareil, mais <b>' + panier.length + ' demande' + (panier.length > 1 ? 's sont prêtes' : ' est prête') + ' à envoyer</b> dans vos Documents.' + actions(bouton('Ouvrir mes Documents', 'mer:PANIER'))
                    : 'Je ne vois aucune demande envoyée depuis cet appareil. Si vous l\'avez envoyée d\'un autre appareil, connectez-vous avec votre compte TRIGONE : tout revient.' + actions(bouton('Faire une demande', 'mer:NOUVELLE')) };
            }
            var c = m.x, enCours = l.filter(function(x) { return x !== c && !finie(x) && (!x.s || x.s.etape !== 'refus'); }).slice(0, 3);
            return { html: htmlDemande(c, true) + (enCours.length ? '<div class="AIDE-AUTRES">Vous avez aussi : ' + enCours.map(function(x) {
                    return '<br>• « ' + esc(titreDe(x.d)) + ' » : ' + esc({ val1: 'chez le VALIDEUR 1', val2: 'chez le VALIDEUR 2', chorus: 'chez l\'assistant Chorus DT' }[(x.s || {}).etape] || 'envoyée'); }).join('') + '</div>' : '') +
                actions(bouton('Voir dans la Bibliothèque', 'mer:BIBLIOTHEQUE')), etq: 'D\'après votre suivi TRIGONE', dem: c.d.id };
        });
    }

    // ---------- Compte-rendu ----------
    function suiviCr(e, s) {
        if (e.envoiId) return s[e.envoiId] || null;
        var t = e.snapshot && e.snapshot.MAIL_SENT_AT ? Date.parse(e.snapshot.MAIL_SENT_AT) : 0, trouve = null;
        if (t) Object.keys(s).forEach(function(k) { var x = s[k], u = x.etapes && x.etapes[0] ? x.etapes[0].le : 0; if (x.genre === 'cr' && !x.intervenant && Math.abs(u - t) < 600000) trouve = x; });
        return trouve;
    }
    function titreCr(e) { var sn = e.snapshot || {}; return sn.LIBELLE_MISSION || 'Mission du ' + jour(e.debut); }
    function repCr(q) {
        return actualiser().then(function() {
            var s = suivi(), lib = (lireL('mission_bibliotheque', []) || []).map(function(e) { return { e: e, s: suiviCr(e, s) }; });
            var m = lireL('mission_data', null), html = '';
            var enCours = m && !m.MAIL_SENT && (m.DEBUT || m.ARR_SITE || (m.JOURS && m.JOURS.length));
            if (!lib.length && !enCours) return { html: 'Je ne vois aucun compte-rendu sur cet appareil. Il se fait dans <b>TRIGONE Compte-rendu</b>, au retour de mission.' + actions(bouton('Ouvrir Compte-rendu', 'cr:P0')) };
            var c = lib.length ? choisir(lib.map(function(x) { x.d = {}; return x; }), q, function(x) { return titreCr(x.e) + ' ' + jour(x.e.debut); }) : null;
            if (c && !c.parMots) c = { x: lib[0], parMots: false };            // sans précision : le plus récent
            if (enCours && (!c || !c.parMots)) {
                html = 'Votre compte-rendu <b>« ' + esc(m.LIBELLE_MISSION || 'mission en cours') + ' »</b>' + (m.DEBUT ? ' (partie le ' + jour(m.DEBUT) + ')' : '') + ' n\'est <b>pas encore envoyé</b>' + (m.DEADLINE ? ' : à rendre avant le <b>' + jour(m.DEADLINE) + '</b>' : '') + '.' +
                    actions('<button type="button" class="AIDE-BTN" data-rappel-cr="1">👉 Ouvrir mon compte-rendu</button>');
                if (!lib.length) return { html: html };
                html += '<br><br>Et le dernier envoyé : ';
            }
            var x = c ? c.x : null; if (!x) return { html: html };
            var e = x.e, st = x.s, der = st && st.etapes ? st.etapes[st.etapes.length - 1] || {} : {}, par = der.qui ? ' par <b>' + esc(der.qui) + '</b>' : '';
            var etat = e.attente ? '⏳ <b>en attente de réseau</b> : il partira tout seul dès le retour du réseau.'
                : !st ? (e.snapshot && e.snapshot.MAIL_SENT_AT ? 'envoyé ' + quand(e.snapshot.MAIL_SENT_AT) + '.' : 'archivé dans votre Bibliothèque.')
                : st.etape === 'traite' ? '<b style="color:#15803d">traité par l\'assistant Chorus DT</b>' + par + ' ' + quand(der.le) + '. Le remboursement suit dans Chorus DT.'
                : st.etape === 'recu' ? '<b>récupéré par l\'assistant Chorus DT</b>' + par + ' ' + quand(der.le) + ' : il est en cours de traitement.'
                : '<b>envoyé à l\'assistant Chorus DT</b> ' + quand((st.etapes[0] || {}).le || st.le) + ', <b>pas encore récupéré</b> (depuis ' + depuis(st.le) + ').';
            html += (html ? '' : 'Votre compte-rendu ') + '<b>« ' + esc(titreCr(e)) + ' »</b> : ' + etat + (e.forfaitOfficiel ? '<br>Forfait calculé (repas et hébergement) : <b>' + euros(e.forfaitOfficiel) + '</b>.' : '');
            return { html: html + actions(bouton('Ma Bibliothèque de Compte-rendu', 'cr:P-BIB')), etq: 'D\'après votre suivi TRIGONE' };
        });
    }

    // ---------- Estimation : repas et nuits d'après les dates, la destination et les barèmes de Compte-rendu ----------
    // Repas : la mission couvre 11 h – 14 h (midi) ou 18 h – 21 h (soir) ; nuit : 0 h – 5 h. Estimation seulement.
    function estimer(d, ctx) {
        var T = ctx.tarifs, D = window.AIDE_DONNEES; if (!T || !D) return null;
        var a = (d.trajets || {}).aller || {}, r = (d.trajets || {}).retour || {};
        var deb = date(a.dateDep), fin = date(r.dateArr || r.dateDep);
        if (!deb || !fin || fin <= deb) return null;
        var midi = 0, soir = 0, nuits = 0, j = new Date(deb.getFullYear(), deb.getMonth(), deb.getDate());
        for (var k = 0; j <= fin && k < 400; k++, j = new Date(j.getFullYear(), j.getMonth(), j.getDate() + 1)) {
            var h = function(x) { return new Date(j.getFullYear(), j.getMonth(), j.getDate(), x); };
            if (deb <= h(11) && fin >= h(14)) midi++;
            if (deb <= h(18) && fin >= h(21)) soir++;
            if (deb <= h(24) && fin >= h(29)) nuits++;
        }
        var pays = a.paysArr && !/^france$/i.test(a.paysArr) ? a.paysArr : '', prixRepas = T.repasFrance, prixNuit, lieu;
        if (pays) {
            var p = (T.pays.filter(function(x) { return N(x.p) === N(pays); })[0]) || ((D.trouverPays(' ' + pays + ' ', T)[0] || [])[0]);
            var t = p && ctx.change.taux[p.d]; if (!p || t == null) return null;
            prixRepas = p.m * t * T.coefRepas; prixNuit = p.m * t * T.coefHebergement; lieu = p.p.charAt(0) + p.p.slice(1).toLowerCase();
        } else {
            var v = D.trouverVille(' a ' + (a.lieuArr || '') + ' ' + (a.cpArr || '') + ' ', T) || { zone: 'PETITE', nom: a.lieuArr || 'la destination' };
            prixNuit = T.hebergementFrance[v.zone]; lieu = v.nom;
        }
        var repas = midi + soir, total = repas * prixRepas + nuits * prixNuit;
        return { repas: repas, prixRepas: prixRepas, nuits: nuits, prixNuit: prixNuit, total: total, lieu: lieu, pays: !!pays, moyen: a.moyen || '', n: (d.personnes || []).length || 1 };
    }
    var TRANSPORT = { SERVICE: 'Véhicule de service : pas d\'indemnité kilométrique.', FERREE: 'Train : billets réservés par l\'unité ou remboursés sur justificatif.', AERIENNE: 'Avion : billets réservés par l\'unité ou remboursés sur justificatif.',
        MARITIME: 'Bateau : billets réservés par l\'unité ou remboursés sur justificatif.', CIVILE: 'Véhicule personnel : si les indemnités kilométriques sont accordées, demandez-moi par exemple « IK Lyon Grenoble 6 CV ».' };
    function htmlEstimation(est, titre) {
        return 'Pour ' + (titre ? '<b>« ' + esc(titre) + ' »</b>' : 'cette mission') + ', comptez <b>environ ' + eurosRond(est.total) + '</b>' + (est.n > 1 ? ' par personne' : '') + ' :' +
            '<table class="AIDE-TAB"><tr><td>' + est.repas + ' repas × ' + euros(est.prixRepas) + '</td><td>' + euros(est.repas * est.prixRepas) + '</td></tr>' +
            '<tr><td>' + est.nuits + ' nuit' + (est.nuits > 1 ? 's' : '') + ' (' + esc(est.lieu) + ') × ' + euros(est.prixNuit) + '</td><td>' + euros(est.nuits * est.prixNuit) + '</td></tr>' +
            '<tr class="tot"><td>Estimation</td><td>' + euros(est.total) + '</td></tr></table>' +
            (TRANSPORT[est.moyen] ? '<small>' + TRANSPORT[est.moyen] + '</small>' : '') +
            '<small>Estimation d\'après vos dates : le montant exact sort de votre compte-rendu (horaires réels, repas ou logement fournis' + (est.pays ? ', repas du trajet au taux France' : '') + ').</small>';
    }
    function brouillon() {
        if (window.D && window.MANQUES_ONGLET && (window.D.objet || ((window.D.trajets || {}).aller || {}).dateDep)) return window.D;
        var b = lireL('mer_brouillon', null); return b && b.demande && (b.demande.objet || ((b.demande.trajets || {}).aller || {}).dateDep) ? b.demande : null;
    }
    function repEstimation(q, ctx) {
        // Compte-rendu ouvert : son propre calcul (horaires réels).
        if (window.CALC_FORFAIT_MISSION_COURANTE && window.M && window.M.DEBUT && !/ (prochaine|demande|om|mer) /.test(N(q))) {
            var f = window.CALC_FORFAIT_MISSION_COURANTE();
            return Promise.resolve({ html: 'D\'après votre compte-rendu en cours' + (window.M.LIBELLE_MISSION ? ' (<b>« ' + esc(window.M.LIBELLE_MISSION) + ' »</b>)' : '') + ', le forfait repas et hébergement est de <b>' + euros(f) + '</b> pour l\'instant.' +
                '<small>Il se met à jour avec vos saisies (repas, nuits, horaires). Les indemnités kilométriques et les frais réels s\'y ajoutent.</small>', etq: 'Calcul de votre compte-rendu' });
        }
        var cands = [], b = brouillon();
        if (b) cands.push({ d: b, quoi: 'en cours de saisie' });
        (lireL('mer_panier', []) || []).forEach(function(d) { cands.push({ d: d, quoi: 'prête à envoyer' }); });
        mesDemandes().forEach(function(x) { cands.push({ d: x.d, quoi: 'envoyée', s: x.s }); });
        var futures = cands.filter(function(x) { var r = ((x.d.trajets || {}).retour || {}).dateArr; return !r || date(r) >= new Date(Date.now() - 864e5 * 60); });
        if (!futures.length) return Promise.resolve({ html: 'Je n\'ai pas de mission à estimer : remplissez d\'abord les dates et la destination de votre demande, ou demandez-moi un barème (« combien la nuit à Lyon ? »).' });
        var c = choisir(futures, q, function(x) { var a = (x.d.trajets || {}).aller || {}; return [titreDe(x.d), lieuDe(x.d), a.lieuArr, a.paysArr].join(' '); }).x;
        var est = estimer(c.d, ctx);
        if (!est) return Promise.resolve({ html: 'Il me manque les <b>dates</b> ou la <b>destination</b> de « ' + esc(titreDe(c.d)) + ' » pour faire le calcul.' });
        return Promise.resolve({ html: htmlEstimation(est, titreDe(c.d)), etq: 'Estimation d\'après les barèmes de TRIGONE Compte-rendu' });
    }

    // ---------- Relecture de la demande avant envoi ----------
    var ONGLETS = { IDENTITE: 'Identité', ALLER: 'Aller', RETOUR: 'Retour', CONDITIONS: 'Conditions', IMPUTATION: 'Imputation' };
    function repRelecture(q, ctx) {
        if (!window.MANQUES_ONGLET) return Promise.resolve({ html: 'La relecture se fait dans <b>Mise en route</b>, sur votre demande en cours.' + actions(bouton('Ouvrir Mise en route', 'mer:ACCUEIL')) });
        var d = brouillon();
        if (!d) {
            var p = lireL('mer_panier', []) || [];
            return Promise.resolve({ html: p.length ? 'Pas de demande en cours de saisie. Vos <b>' + p.length + ' demande' + (p.length > 1 ? 's' : '') + ' prête' + (p.length > 1 ? 's' : '') + ' à envoyer</b> ont déjà été vérifiées par TRIGONE.' + actions(bouton('Ouvrir mes Documents', 'mer:PANIER'))
                : 'Je ne vois pas de demande en cours. Commencez-en une, puis redemandez-moi : je la relis avant l\'envoi.' + actions(bouton('Nouvelle demande', 'mer:NOUVELLE')) });
        }
        var manques = [];
        (window.MER_TABS_ORDRE || Object.keys(ONGLETS)).forEach(function(t) { window.MANQUES_ONGLET(t).forEach(function(m) { manques.push({ t: t, path: m.path, l: m.libelle }); }); });
        var a = (d.trajets || {}).aller || {}, r = (d.trajets || {}).retour || {}, alertes = [];
        if (a.dateDep && date(a.dateDep) < new Date()) alertes.push({ t: 'ALLER', path: 'trajets.aller.dateDep', l: 'Le départ (' + jour(a.dateDep) + ') est déjà passé : vérifiez la date.' });
        if (a.dateDep && r.dateArr && date(r.dateArr) < date(a.dateDep)) alertes.push({ t: 'RETOUR', path: 'trajets.retour.dateArr', l: 'Le retour est avant le départ.' });
        if (a.dateDep && r.dateArr && (date(r.dateArr) - date(a.dateDep)) > 864e5 * 45) alertes.push({ t: 'RETOUR', path: 'trajets.retour.dateArr', l: 'Mission de plus de 45 jours : vérifiez la date de retour.' });
        var reg = lireL('trigone_reglages_communs', {}) || {};
        if (!reg.mailVal1) alertes.push({ aller: 'profil', l: 'Aucun <b>VALIDEUR 1</b> choisi : à remplir dans Mon profil.' });
        var code = String(d.codeFD || '').toUpperCase().trim();
        var finir = function(cd) {
            if (code && cd) {
                var v = cd[code];
                if (!v) alertes.push({ t: 'IMPUTATION', path: 'codeFD', l: 'Le code FD <b>' + esc(code) + '</b> n\'est pas dans le codier : vérifiez-le.' });
                else if (v.fin && !v.lib) alertes.push({ t: 'IMPUTATION', path: 'codeFD', l: 'Le code FD <b>' + esc(code) + '</b> est <b>fermé</b>' + (v.dev ? ' : il est remplacé par <b>' + esc(v.dev) + '</b>' : '') + '.' });
            }
            if (!manques.length && !alertes.length) {
                var est = estimer(d, ctx);
                return { html: 'Tout est bon ✅ Votre demande <b>« ' + esc(titreDe(d)) + ' »</b> est complète et cohérente : vous pouvez l\'envoyer.' + (est ? '<br><br>' + htmlEstimation(est) : ''), etq: 'Relecture de votre demande', pose: 'content' };
            }
            var lien = function(but) { return ' <button type="button" class="AIDE-LIEN" data-aller="' + esc(but) + '">Me montrer</button>'; };
            // D'abord ce qui est faux (dates, code FD, destinataire), puis ce qui manque, onglet par onglet.
            var lignes = alertes.map(function(m) { return '<li>⚠️ ' + m.l + lien(m.aller || 'mer:CHAMP:' + m.t + ':' + m.path) + '</li>'; });
            Object.keys(ONGLETS).forEach(function(t) {
                var l = manques.filter(function(m) { return m.t === t; }); if (!l.length) return;
                var noms = l.map(function(m) { return m.l.replace(/^(Aller|Retour|Intermédiaire aller|Intermédiaire retour) : /, '').toLowerCase(); });
                noms = noms.filter(function(x, i) { return noms.indexOf(x) === i; });
                lignes.push('<li><b>' + ONGLETS[t] + '</b> : ' + esc(noms.slice(0, 4).join(', ') + (noms.length > 4 ? '… (' + noms.length + ' champs)' : '')) + ' à remplir' + lien('mer:CHAMP:' + t + ':' + l[0].path) + '</li>');
            });
            var n = lignes.length;
            return { html: 'J\'ai relu votre demande <b>« ' + esc(titreDe(d)) + ' »</b>. ' + (n > 1 ? 'Il reste <b>' + n + ' points</b>' : 'Il reste <b>un point</b>') + ' à voir :<ul class="AIDE-LISTE">' + lignes.join('') + '</ul>', etq: 'Relecture de votre demande' };
        };
        return (code && ctx.codier ? ctx.codier().catch(function() { return null; }) : Promise.resolve(null)).then(finir);
    }

    // ---------- Valideurs : ce qui attend leur signature ----------
    function repAValider() {
        var r = roles();
        if (!r.v1 && !r.v2) return Promise.resolve({ html: 'Vous n\'avez pas le rôle de <b>valideur</b> sur cet appareil : rien ne vous attend à signer. Si ce rôle vous a été confié, cochez-le dans <b>Paramètres › Compte › Mes rôles</b> avec son code.' + actions(bouton('Mes rôles', 'roles')) });
        var l = boite().filter(function(x) { return ['niveau1', 'niveau2', 'renvoi'].indexOf(x.nature) >= 0 && x.statut !== 'traite'; }).sort(function(a, b) { return (a.le || 0) - (b.le || 0); });
        if (!l.length) return Promise.resolve({ html: 'Rien à valider pour l\'instant 👍 Vous serez prévenu dès qu\'une demande arrive.', etq: 'D\'après votre Boîte TRIGONE' });
        var n = l.reduce(function(t, x) { return t + (x.n > 1 ? x.n : 1); }, 0);
        return Promise.resolve({ html: '<b>' + n + ' demande' + (n > 1 ? 's' : '') + '</b> ' + (n > 1 ? 'vous attendent' : 'vous attend') + ', la plus ancienne d\'abord :' + l.slice(0, 6).map(function(x) {
            return '<div class="AIDE-LIGNE-DEM"><b>' + esc(x.noms || '') + (x.objet ? ' — ' + esc(x.objet) : '') + '</b><small>' + [x.dates, x.le ? 'depuis ' + depuis(x.le) : '', x.nature === 'renvoi' ? 'renvoyée pour correction' : x.nature === 'niveau2' ? 'en 2e validation' : ''].filter(Boolean).map(esc).join(' · ') + '</small></div>';
        }).join('') + (l.length > 6 ? '<small>… et ' + (l.length - 6) + ' autre(s).</small>' : '') + actions(bouton('Ouvrir mes demandes à signer', 'mer:RECEPTION')), etq: 'D\'après votre Boîte TRIGONE' });
    }
    // ---------- Assistant Chorus DT : ce qui attend d'être traité ----------
    function repChorus(q) {
        if (!roles().chorus) return Promise.resolve({ html: PAS_ACCES });
        var l = boite().filter(function(x) { return (x.nature === 'chorus' || x.nature === 'cr') && x.statut !== 'traite'; }).sort(function(a, b) { return (a.le || 0) - (b.le || 0); });
        var s = N(q), mots = s.trim().split(' ').filter(function(m) { return m.length >= 4 && ' complet complete traiter traite recu recus compte rendu rendus demande demandes chorus est elle '.indexOf(' ' + m + ' ') < 0; });
        var cible = mots.length ? l.filter(function(x) { var t = N([x.noms, x.objet].join(' ')); return mots.some(function(m) { return t.indexOf(' ' + m) >= 0; }); })[0] : null;
        if (cible) return Promise.resolve({ html: (cible.nature === 'cr' ? 'Compte-rendu' : 'Demande validée') + ' de <b>' + esc(cible.noms) + '</b> « ' + esc(cible.objet || '') + ' »' + (cible.dates ? ' (' + esc(cible.dates) + ')' : '') +
            (cible.pieces ? ' : ' + cible.pieces + ' fichier' + (cible.pieces > 1 ? 's' : '') : '') + ', reçu' + (cible.nature === 'cr' ? '' : 'e') + ' il y a ' + depuis(cible.le || Date.now()) + '. Ouvrez-le pour le contrôle des signatures et des pièces jointes.' +
            actions(bouton('Ouvrir l\'espace Chorus DT', 'mer:CHORUS')), etq: 'D\'après votre espace Chorus DT' });
        var dem = l.filter(function(x) { return x.nature === 'chorus'; }), crs = l.filter(function(x) { return x.nature === 'cr'; });
        var nd = dem.reduce(function(t, x) { return t + (x.n > 1 ? x.n : 1); }, 0);
        if (!l.length) return Promise.resolve({ html: 'Rien à traiter pour l\'instant 👍', etq: 'D\'après votre espace Chorus DT' });
        return Promise.resolve({ html: 'À traiter :<ul class="AIDE-LISTE">' + (nd ? '<li><b>' + nd + ' demande' + (nd > 1 ? 's' : '') + ' validée' + (nd > 1 ? 's' : '') + '</b> (ordres de mission à créer), la plus ancienne depuis ' + depuis(dem[0].le || Date.now()) + ' ;</li>' : '') +
            (crs.length ? '<li><b>' + crs.length + ' compte' + (crs.length > 1 ? 's' : '') + '-rendu' + (crs.length > 1 ? 's' : '') + '</b> reçu' + (crs.length > 1 ? 's' : '') + '.</li>' : '') + '</ul>' +
            actions(bouton('Ouvrir l\'espace Chorus DT', 'mer:CHORUS')), etq: 'D\'après votre espace Chorus DT' });
    }

    // ---------- Devises ----------
    function repDevise(q, ctx) {
        var s = N(q), taux = ctx.change.taux, k = devise(s, taux); if (!k) return Promise.resolve(null);
        var m = /(\d+(?:[.,]\d+)?)/.exec(q.replace(/(\d)\s+(\d{3})/g, '$1$2')), n = m ? parseFloat(m[1].replace(',', '.')) : 1;
        var nomD = k.toLowerCase(), t = taux[k];
        var versDevise = / euros? (en|vers|to) /.test(s) || / en (dollars?|livres?|francs?|yens?|yuans?|dirhams?|dinars?|couronnes?|zlotys?|roubles?|roupies?|reals?|pesos?) /.test(s) && / euros? /.test(s.split(' en ')[0] + ' ');
        var html = versDevise ? '<b>' + (n + '').replace('.', ',') + ' €</b> = <b>' + (Math.round(n / t * 100) / 100 + '').replace('.', ',') + ' ' + esc(nomD) + '</b>'
            : '<b>' + (n + '').replace('.', ',') + ' ' + esc(nomD) + '</b> = <b>' + euros(n * t) + '</b>';
        return Promise.resolve({ html: html + '<small>1 ' + esc(nomD) + ' = ' + euros(t).replace(' €', '') + ' € — ' + esc(ctx.change.date) + '.</small>', etq: 'Taux de change de TRIGONE Compte-rendu' });
    }

    // ---------- Simulation d'une mission décrite en une phrase ----------
    // Mêmes barèmes que le simulateur de Compte-rendu ; horaires supposés : départ le 1er jour vers 8 h, retour le dernier vers 18 h.
    var NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
    function lireMission(q, ctx) {
        var s = N(q), D = window.AIDE_DONNEES, T = ctx.tarifs, p = {};
        var m;
        if ((m = / (\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix) ?(jours?|j|journees?) /.exec(s))) p.jours = +m[1] || NOMBRES[m[1]];
        if ((m = / (\d{1,3}|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix) ?(nuits?|nuitees?) /.exec(s))) p.nuits = +m[1] || NOMBRES[m[1]];
        if ((m = / (\d{1,2}|une|un|deux|trois|quatre) ?semaines? /.exec(s)) || / la semaine /.test(s)) { p.jours = p.jours || 5 * ((m && (+m[1] || NOMBRES[m[1]])) || 1); p.semaine = true; }
        if ((m = / du (\d{1,2}) (?:au|a) (\d{1,2}) /.exec(s)) && +m[2] >= +m[1]) p.jours = +m[2] - +m[1] + 1;
        if (p.nuits != null && p.jours == null) p.jours = p.nuits + 1;
        // Où : pays (hors France), sinon ville ; « de X à Y », « depuis X » donnent le départ (pour les IK).
        var STOP = ' mission missions hebergement logement repas charge frais jours jour nuits nuit semaine semaines vrc train avion voiture vehicule perso personnel personnelle service ma mon mes la le les un une des du de en a au aux pour sur vers avec et combien je vais etre rembourse remboursement indemnite indemnites kilometrique kilometriques ik cv chevaux me on nous si pars partir part depuis chez ';
        // Nom de ville : jusqu'à 4 mots ; « le », « sur », « en »… seulement au milieu (« Nogent-le-Rotrou », « Bourg-en-Bresse »).
        var ville = function(t) {
            var w = t.trim().split(' '), g = [];
            for (var i = 0; i < w.length && g.length < 4 && !/\d/.test(w[i]); i++) {
                var liaison = / (le|la|les|sur|en|de|du|des|sous|lez|les) /.test(' ' + w[i] + ' ');
                if (liaison && g.length && w[i + 1] && STOP.indexOf(' ' + w[i + 1] + ' ') < 0 && !/\d/.test(w[i + 1])) { g.push(w[i]); continue; }
                if (STOP.indexOf(' ' + w[i] + ' ') >= 0) break;
                g.push(w[i]);
            }
            return g.join(' ');
        };
        var titre = function(t) { return t.replace(/\b[a-z]/g, function(c) { return c.toUpperCase(); }); };
        var dm = / (?:de|du|depuis|en partant de|au depart de) ([a-z][a-z ]*?) (?:a|au|aux|vers|pour|jusqu a|sur) ([a-z][a-z ]*)/.exec(s);
        if (dm && ville(dm[1]) && ville(dm[2]) && (T.grandesVilles.some(function(g) { return N(g).trim() === ville(dm[2]); }) || / paris /.test(' ' + ville(dm[2]) + ' ') || ville(dm[1]).length >= 3)) { p.de = titre(ville(dm[1])); p.a = titre(ville(dm[2])); }
        var dep = / (?:depuis|en partant de|au depart de|je pars de|on part de|je partirai de) ([a-z][a-z ]*)/.exec(s);
        if (dep && ville(dep[1])) p.de = titre(ville(dep[1]));
        var pays = D.trouverPays(q, T).filter(function(l) { return !/^FRANCE/.test(l[0].p); });
        if (pays.length) { p.pays = pays[0][0]; p.lieuPays = (/ (?:a|au|sur|vers) ([a-z]+) /.exec(s) || [])[1] || ''; }
        else {
            var vi = p.a ? (D.trouverVille(' a ' + N(p.a) + ' ', T) || { nom: p.a, zone: 'PETITE' }) : D.trouverVille(q.replace(/ (?:depuis|en partant de|au depart de|je pars de|de) [A-Za-zÀ-ÿ'-]+/gi, ' '), T);
            if (vi && vi.zone === 'PETITE' && !p.a) { var mv = / (?:a|au|aux|sur|vers) ([a-z][a-z ]*)/.exec(s), nv = mv && ville(mv[1]); if (nv && nv.length > N(vi.nom).trim().length) vi = { nom: titre(nv), zone: 'PETITE' }; }
            if (vi && STOP.indexOf(' ' + N(vi.nom).trim() + ' ') < 0) { p.ville = vi; p.a = p.a || vi.nom; }
        }
        // Transport (le dernier cité l'emporte) et puissance.
        var mode = null, pos = -1;
        [['vp', VP], ['train', TRAIN], ['avion', AVION], ['service', SERVICE]].forEach(function(x) { var r = new RegExp(x[1].source, 'g'), k; while ((k = r.exec(s))) { if (k.index > pos) { pos = k.index; mode = x[0]; } r.lastIndex = k.index + 1; } });
        if (mode) p.mode = mode;
        var cv = D.puissance(q); if (cv) p.cv = cv;
        // Logement et repas : à sa charge (par défaut) ou fournis.
        if (/ (loge gratuitement|heberge gratuitement|hebergement gratuit|hebergement fourni|logement fourni|hebergement pris en charge|logement pris en charge|chambre fournie|loge par l unite|loge sur place|loge au quartier|loge en caserne|loge a la caserne|loge sur la base|dors au quartier|dors a la caserne|pas de frais d hebergement|sans hebergement) /.test(s)) p.logeGratuit = true;
        else if (/ (hebergement|logement|hotel|nuit|nuits) (et (les )?repas )?(a ma charge|a mes frais|payes? par moi|je paye|je paie|que je paye) | a ma charge | a mes frais /.test(s)) p.logeGratuit = false;
        if (/ (nourri|nourris|repas fournis|repas pris en charge|repas offerts|ordinaire|mess|cantine|cercle|repas gratuits?|pas de frais de repas|je mange au quartier|je mange sur place gratuitement) /.test(s)) p.nourri = true;
        else if (/ (repas|nourriture|manger)( et (l )?hebergement)? (a ma charge|a mes frais) | a ma charge | a mes frais /.test(s)) p.nourri = false;
        return p;
    }
    function repSimulation(q, ctx) {
        var T = ctx.tarifs, p = Object.assign({}, ctx.precedent || {}, lireMission(q, ctx));
        var lu = lireMission(q, ctx); if (ctx.precedent && lu.jours != null && lu.nuits == null) delete p.nuits;   // « et pour 5 jours ? » : les nuits d'avant ne comptent plus
        if (ctx.precedent && lireMission(q, ctx).pays) delete p.ville; if (ctx.precedent && lireMission(q, ctx).ville) delete p.pays;
        if (!p.jours && / (\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix) ?repas /.test(N(q))) p.jours = 1;   // « 4 repas à Lyon » : les repas seulement (calculés plus bas)
        if (!p.jours) return Promise.resolve({ html: 'Pour combien de temps ? Dites-moi la durée (« 5 jours », « 3 nuits », « du 12 au 16 ») et je fais le calcul.', params: p });
        if (!p.pays && !p.ville) return Promise.resolve({ html: 'Où se passe la mission ? Dites-moi la ville ou le pays (« à Lyon », « en Allemagne »).', params: p });
        var jours = Math.max(1, Math.min(p.jours, 180)), nuits = p.nuits != null ? p.nuits : jours - 1;
        var nRepas = p.nourri ? 0 : jours * 2 - 1, nNuits = p.logeGratuit ? 0 : nuits;
        var prixRepas = T.repasFrance, prixNuit, lieu;
        if (p.pays) { var t = ctx.change.taux[p.pays.d]; if (t == null) return Promise.resolve({ html: 'Je n\'ai pas le taux de change pour ce pays : utilisez le simulateur de Compte-rendu.' + actions(bouton('Ouvrir le simulateur', 'cr:P-SIMU')), params: p });
            prixRepas = p.pays.m * t * T.coefRepas; prixNuit = p.pays.m * t * T.coefHebergement; lieu = p.pays.p.charAt(0) + p.pays.p.slice(1).toLowerCase(); }
        else { prixNuit = T.hebergementFrance[p.ville.zone]; lieu = p.ville.nom + (p.ville.zone === 'PARIS' ? '' : p.ville.zone === 'GRANDE' ? ' (grande ville)' : ''); }
        var ou = p.pays ? 'en <b>' + esc(lieu) + '</b>' : 'à <b>' + esc(lieu.replace(/ \(grande ville\)$/, '')) + '</b>';
        // Réponse à ce qui est demandé, du tac au tac : « 3 nuits à Nantes » → les nuits seulement ; « 4 repas à Lyon » → les repas seulement.
        var sq = N(q), mr = / (\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix) ?repas /.exec(sq);
        var parleNuits = / (nuit|nuits|nuitee|nuitees|hotel|hotels|dormir|hebergement) /.test(sq), parleRepas = / (repas|manger|midi|soir|dejeuner|diner|restaurant|resto) /.test(sq);
        var parleReste = / (jour|jours|semaine|semaines|mission|tout|total|vp|vl|voiture|km|kilometre|kilometres|ik|train|avion|service|du \d+ au) /.test(sq);
        if (!parleReste && !p.mode && parleNuits && !parleRepas && p.nuits != null) p.seul = 'nuits';
        else if (!parleReste && !p.mode && parleRepas && !parleNuits && mr) { p.seul = 'repas'; p.nRepas = +mr[1] || NOMBRES[mr[1]] || 1; }
        else if (parleReste || (parleNuits && parleRepas) || / avec les (repas|nuits) /.test(sq)) delete p.seul;
        if (p.seul) {
            var nb = p.seul === 'nuits' ? (p.logeGratuit ? 0 : nuits) : p.nRepas, pu = p.seul === 'nuits' ? prixNuit : prixRepas, mot = p.seul === 'nuits' ? 'nuit' : 'repas';
            var lieuCourt = p.pays ? 'en ' + esc(lieu) : 'à ' + esc(lieu.replace(/ \(grande ville\)$/, ''));
            return Promise.resolve({ html: 'Pour <b>' + nb + ' ' + mot + (nb > 1 && mot === 'nuit' ? 's' : '') + '</b> ' + lieuCourt + ', vous seriez remboursé de <b>' + eurosRond(nb * pu) + '</b> (' + nb + ' × ' + euros(pu) + (p.ville && p.ville.zone === 'GRANDE' && mot === 'nuit' ? ', grande ville' : '') + ').' +
                '<small>' + (mot === 'nuit' ? 'Forfait nuitée, petit-déjeuner compris, si l\'hébergement est à votre charge' : 'Forfait par repas, s\'il n\'est ni pris au restaurant administratif ni fourni') + (p.pays ? ' ; taux du pays converti en euros' : '') + '. ' + (mot === 'nuit' ? 'Avec les repas : « et avec les repas ? ».' : 'Pour une mission complète : « et pour 3 jours ? ».') + '</small>',
                etq: 'Barème de TRIGONE Compte-rendu', params: p });
        }
        var taux = Object.assign({}, T.ik || {}, lireL('trigone_ik_rates', {}) || {});
        var finir = function(km, err) {
            // Noms officiels trouvés par le service de cartographie (« NOGENT-LE-ROTROU (28400) ») : la ville tapée vite est confirmée.
            if (km && typeof km === 'object') { if (km.de) p.de = officiel(km.de); if (km.a) { p.aOfficiel = officiel(km.a); } km = km.km; }
            var lignes = [], total = nRepas * prixRepas + nNuits * prixNuit;
            lignes.push('<tr><td>' + nRepas + ' repas × ' + euros(prixRepas) + (p.nourri ? ' (repas fournis)' : '') + '</td><td>' + euros(nRepas * prixRepas) + '</td></tr>');
            lignes.push('<tr><td>' + nNuits + ' nuit' + (nNuits > 1 ? 's' : '') + ' à ' + esc(lieu) + ' × ' + euros(prixNuit) + (p.logeGratuit ? ' (logé gratuitement)' : '') + '</td><td>' + euros(nNuits * prixNuit) + '</td></tr>');
            var ikTxt = '';
            if (p.mode === 'vp') {
                if (km != null) {
                    var ar = km * 2, arTxt = String(Math.round(ar)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                    if (p.cv) { var ik = ar * taux[p.cv]; total += ik; lignes.push('<tr><td>IK ' + esc(p.de) + ' ⇄ ' + esc(p.aOfficiel || p.a || lieu) + ' : ' + arTxt + ' km × ' + euros(taux[p.cv]).replace(' €', '') + ' € (' + { '5cv': '5 CV et moins', '6-7cv': '6 et 7 CV', '8cv': '8 CV et plus' }[p.cv] + ')</td><td>' + euros(ik) + '</td></tr>'); }
                    else ikTxt = 'IK aller-retour ' + esc(p.de) + ' ⇄ ' + esc(p.aOfficiel || p.a || lieu) + ' (' + arTxt + ' km) : <b>' + euros(ar * taux['5cv']) + '</b> en 5 CV, <b>' + euros(ar * taux['6-7cv']) + '</b> en 6-7 CV, <b>' + euros(ar * taux['8cv']) + '</b> en 8 CV et plus. Dites-moi la puissance de votre véhicule.';
                } else ikTxt = p.de ? 'Je n\'ai pas pu calculer la distance ' + esc(p.de) + ' → ' + esc(p.a || lieu) + (err ? ' (' + esc(err) + ')' : '') + '.' : 'Pour les <b>indemnités kilométriques</b>, dites-moi d\'où vous partez et la puissance (« depuis Libourne, 6 CV »).';
            }
            if (p.aOfficiel && !p.pays) ou = 'à <b>' + esc(p.aOfficiel) + '</b>';
            var html = 'Pour <b>' + (p.nuits != null ? nuits + ' nuit' + (nuits > 1 ? 's' : '') + '</b> (' + jours + ' jour' + (jours > 1 ? 's' : '') + ' de mission)' : jours + ' jour' + (jours > 1 ? 's' : '') + '</b>') + ' ' + ou + (p.mode === 'vp' ? ' en véhicule personnel' : p.mode === 'train' ? ' en train' : p.mode === 'avion' ? ' en avion' : p.mode === 'service' ? ' en véhicule de service' : '') + ', comptez <b>environ ' + eurosRond(total) + '</b> :' +
                '<table class="AIDE-TAB">' + lignes.join('') + '<tr class="tot"><td>Estimation</td><td>' + euros(total) + '</td></tr></table>' +
                (ikTxt ? '<small>' + ikTxt + '</small>' : '') + (TRANSPORT_SIMU[p.mode] ? '<small>' + TRANSPORT_SIMU[p.mode] + '</small>' : '') +
                '<small>Hypothèses : départ le 1er jour vers 8 h, retour le dernier vers 18 h' + (p.semaine ? ', une semaine = 5 jours' : '') + (p.logeGratuit || p.nourri ? '' : ', logement et repas à votre charge') + '. Le montant exact sort de votre compte-rendu (horaires réels).</small>' +
                actions(bouton('Affiner dans le simulateur', 'cr:P-SIMU'));
            return { html: html, etq: 'Simulation d\'après les barèmes de TRIGONE Compte-rendu', params: p };
        };
        if (p.mode === 'vp' && p.de && navigator.onLine && ctx.distance) return ctx.distance(p.de, p.a || (p.ville ? p.ville.nom : '')).then(function(km) { return finir(km); }, function(e) { return finir(null, e && e.message); });
        return Promise.resolve(finir(null, p.de && !navigator.onLine ? 'pas de réseau' : ''));
    }
    function officiel(n) { return String(n).toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, function(t, x, c) { return x + c.toUpperCase(); }).replace(/-(Le|La|Les|Sur|En|De|Du|Des|Sous)-/g, function(t, x) { return '-' + x.toLowerCase() + '-'; }); }
    var TRANSPORT_SIMU = { train: 'Train : billets réservés par l\'unité, ou remboursés sur justificatif.', avion: 'Avion : billets réservés par l\'unité, ou remboursés sur justificatif.', service: 'Véhicule de service : pas d\'indemnité kilométrique.' };

    // ---------- « Ai-je droit au repas du soir ? » : les règles de Compte-rendu appliquées à SA mission ----------
    function heureFr(v) {          // « 06/10/2026 07:40:12 » (Compte-rendu) ou date ISO → Date avec l'heure
        var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/.exec(String(v || ''));
        if (m) return new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
        var d = new Date(v); return isNaN(d) ? null : d;
    }
    function hh(d) { return ('0' + d.getHours()).slice(-2) + ' h ' + ('0' + d.getMinutes()).slice(-2); }
    function mission() { var m = window.M && window.M.DEBUT ? window.M : lireL('mission_data', null); return m && m.DEBUT ? m : null; }
    // Repas possibles d'après les horaires (règles de Compte-rendu) : { midi, soir }.
    function repasPossibles(dep, ret) {
        if (!dep || !ret) return null;
        var j0 = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate()), j1 = new Date(ret.getFullYear(), ret.getMonth(), ret.getDate()), n = Math.round((j1 - j0) / 864e5);
        var d = dep.getHours() * 60 + dep.getMinutes(), r = ret.getHours() * 60 + ret.getMinutes();
        if (n === 0) return { midi: d <= 660 && r >= 840 ? 1 : 0, soir: d <= 1080 && r >= 1260 ? 1 : 0 };
        return { midi: (d <= 660 ? 1 : 0) + (n - 1) + (r >= 840 ? 1 : 0), soir: (d <= 1080 ? 1 : 0) + (n - 1) + (r >= 1260 ? 1 : 0) };
    }
    function repDroit(q) {
        var s = N(q), m = mission(), dep = m && heureFr(m.DEBUT), ret = m && heureFr(m.FIN_RETOUR_HORODATE);
        var nuit = / (nuit|nuitee|hotel|dormir) /.test(s), soir = / (soir|diner) /.test(s), midi = / (midi|dejeuner) /.test(s);
        var regle = '<small>Règle : un repas compte si vous êtes hors de vos résidences sur toute la tranche (midi : 11 h – 14 h, soir : 18 h – 21 h) et qu\'il n\'est pas pris au restaurant administratif ni fourni. Les jours entre le départ et le retour sont toujours éligibles. Une nuit compte si l\'hébergement est à votre charge (hôtel), pas si vous êtes logé gratuitement.</small>';
        if (nuit) return Promise.resolve({ html: 'Une <b>nuit</b> est indemnisée si vous dormez hors de vos résidences <b>et</b> que l\'hébergement est à votre charge (hôtel, location) : forfait de 90 €, 120 € (grandes villes, Grand Paris) ou 140 € (Paris), petit-déjeuner compris. <b>Logé gratuitement</b> (quartier, base, hébergement fourni) : rien.' +
            (m ? '<br>Dans votre compte-rendu, indiquez pour chaque nuit « payante » ou non dans <b>Frais › Repas & hébergement</b>.' : ''), etq: 'Règles de TRIGONE Compte-rendu (décret n° 2009-545, arrêté du 3 juillet 2006)' });
        if (!dep) return Promise.resolve({ html: 'Ça dépend de vos horaires :<ul class="AIDE-LISTE"><li><b>Jour du départ</b> : midi si vous partez au plus tard à 11 h ; soir si vous partez au plus tard à 18 h.</li><li><b>Jours entre les deux</b> : midi et soir, toujours.</li><li><b>Jour du retour</b> : midi si vous rentrez à 14 h ou après ; soir si vous rentrez à 21 h ou après.</li></ul>' + regle, etq: 'Règles de TRIGONE Compte-rendu (décret n° 2009-545, arrêté du 3 juillet 2006)' });
        var oui = function(b) { return b ? '<b style="color:#15803d">oui ✓</b>' : '<b style="color:#b91c1c">non</b>'; };
        var dd = dep.getHours() * 60 + dep.getMinutes(), memeJour = ret && ret.toDateString() === dep.toDateString();
        var l = [];
        if (memeJour) {
            var rr = ret.getHours() * 60 + ret.getMinutes();
            l.push('Mission sur une journée : parti à <b>' + hh(dep) + '</b>, rentré à <b>' + hh(ret) + '</b> — midi ' + oui(dd <= 660 && rr >= 840) + ', soir ' + oui(dd <= 1080 && rr >= 1260) + '.');
        } else {
            l.push('<b>Jour du départ</b> (' + jour(dep) + ', parti à ' + hh(dep) + ') : midi ' + oui(dd <= 660) + (dd > 660 ? ' (parti après 11 h)' : '') + ', soir ' + oui(dd <= 1080) + (dd > 1080 ? ' (parti après 18 h)' : '') + '.');
            l.push('<b>Jours entre les deux</b> : midi et soir ' + oui(true) + '.');
            if (ret) { var r2 = ret.getHours() * 60 + ret.getMinutes(); l.push('<b>Jour du retour</b> (' + jour(ret) + ', rentré à ' + hh(ret) + ') : midi ' + oui(r2 >= 840) + ', soir ' + oui(r2 >= 1260) + (r2 < 1260 ? ' (rentré avant 21 h)' : '') + '.'); }
            else l.push('<b>Jour du retour</b> : midi si vous rentrez à <b>14 h</b> ou après, soir si vous rentrez à <b>21 h</b> ou après.');
        }
        var auj = new Date(), focus = '';
        if (soir || midi) {
            var estDep = auj.toDateString() === dep.toDateString(), estRet = ret && auj.toDateString() === ret.toDateString();
            var lim = midi ? 660 : 1080, limR = midi ? 840 : 1260, nomR = midi ? 'le repas de midi' : 'le repas du soir';
            focus = estDep ? 'Aujourd\'hui, jour du départ : ' + nomR + ' ' + (dd <= lim ? 'compte ✓ (vous êtes parti à ' + hh(dep) + ').' : 'ne compte pas (parti à ' + hh(dep) + ', après ' + (midi ? '11' : '18') + ' h).') :
                estRet ? 'Aujourd\'hui, jour du retour : ' + nomR + ' ' + ((ret.getHours() * 60 + ret.getMinutes()) >= limR ? 'compte ✓.' : 'ne compte pas (rentré avant ' + (midi ? '14' : '21') + ' h).') :
                !ret ? 'Aujourd\'hui, vous êtes en mission : ' + nomR + ' compte ✓ (sauf repas fourni ou au restaurant administratif). Le jour du retour, il faudra rentrer après ' + (midi ? '14' : '21') + ' h.' : '';
        }
        return Promise.resolve({ html: (focus ? focus + '<br><br>' : '') + 'Pour votre mission' + (m.LIBELLE_MISSION ? ' <b>« ' + esc(m.LIBELLE_MISSION) + ' »</b>' : '') + ' :<ul class="AIDE-LISTE">' + l.map(function(x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' + regle,
            etq: 'D\'après vos horaires pointés et les règles de Compte-rendu' });
    }

    // ---------- « Pourquoi 140 € ? » : le détail du calcul de Compte-rendu ----------
    function repCalcul(q) {
        if (!window.REPAS_DETAIL || !window.CALC_FORFAIT_FROM_STATE || !window.GET_MISSION_LEGS_FROM_STATE)
            return Promise.resolve({ html: 'Le détail du calcul se trouve dans <b>Compte-rendu</b> : demandez-le-moi là-bas, je vous l\'explique jour par jour.' + actions(bouton('Ouvrir Compte-rendu', 'cr:P0')) });
        var n = +((/(\d+(?:[.,]\d+)?) ?(?:€|euros?|e)\b/i.exec(q) || [])[1] || '0').replace(',', '.');
        var lib = lireL('mission_bibliotheque', []) || [], S = null, titre = '';
        if (n) { var e = lib.filter(function(x) { return Math.abs((+x.forfaitOfficiel || 0) - n) < 1; })[0]; if (e) { S = e.snapshot; titre = (e.snapshot && e.snapshot.LIBELLE_MISSION) || 'mission du ' + jour(heureFr(e.debut)); } }
        if (!S && window.M && window.M.DEBUT) { S = window.M; titre = window.M.LIBELLE_MISSION || 'mission en cours'; }
        if (!S && lib[0]) { S = lib[0].snapshot; titre = (S && S.LIBELLE_MISSION) || 'dernière mission'; }
        if (!S) return Promise.resolve({ html: 'Je n\'ai pas de compte-rendu à expliquer sur cet appareil.' });
        var d, total, nuits = [], ik = 0, km = 0;
        try {
            d = window.REPAS_DETAIL(S); total = window.CALC_FORFAIT_FROM_STATE(S);
            window.GET_MISSION_LEGS_FROM_STATE(S).forEach(function(leg) { (leg.JOURS || []).forEach(function(J) { if (window.LEG_HAS_HEBERG_PAYANT && window.LEG_HAS_HEBERG_PAYANT(J)) nuits.push({ date: J.DATE, t: window.GET_HEBERG_RATE_FOR_JOUR(J, S) }); }); });
            ['A', 'A_ANX', 'R', 'R_ANX'].forEach(function(k) { if (S['IK_' + k]) { ik += +S['IK_MONTANT_' + k] || 0; km += +S['IK_KM_' + k] || 0; } });
        } catch (e) { return Promise.resolve({ html: 'Je n\'arrive pas à relire ce compte-rendu pour l\'expliquer.' }); }
        var lm = window.REPAS_LIGNE ? window.REPAS_LIGNE(d, 'midi') : { texte: d.midi.n + ' × ' + euros(d.taux), montant: d.midi.n * d.taux }, ls = window.REPAS_LIGNE ? window.REPAS_LIGNE(d, 'soir') : { texte: d.soir.n + ' × ' + euros(d.taux), montant: d.soir.n * d.taux };
        var heb = total - d.total, pos = repasPossibles(heureFr(S.DEBUT), heureFr(S.FIN_RETOUR_HORODATE)), manque = '';
        if (pos && (d.midi.n < pos.midi || d.soir.n < pos.soir))
            manque = '<br><br>💡 D\'après vos horaires, vous pouviez déclarer jusqu\'à <b>' + pos.midi + ' repas de midi</b> et <b>' + pos.soir + ' du soir</b> ; vous en avez déclaré ' + d.midi.n + ' et ' + d.soir.n + '. Si des repas étaient à votre charge, ajoutez-les dans <b>Frais › Repas & hébergement</b> (boutons +).';
        var html = 'Le forfait de <b>« ' + esc(titre) + ' »</b> : <b>' + euros(total) + '</b> (repas et hébergement)' + (ik ? ', plus <b>' + euros(ik) + '</b> d\'indemnités kilométriques' : '') + ' :' +
            '<table class="AIDE-TAB"><tr><td>Repas de midi : ' + esc(lm.texte) + '</td><td>' + euros(lm.montant) + '</td></tr><tr><td>Repas du soir : ' + esc(ls.texte) + '</td><td>' + euros(ls.montant) + '</td></tr>' +
            '<tr><td>Nuits payantes : ' + nuits.length + (nuits.length ? ' (' + nuits.map(function(x) { return (x.date ? jour(heureFr(x.date) || x.date) : '') + ' : ' + euros(x.t); }).join(', ') + ')' : '') + '</td><td>' + euros(heb) + '</td></tr>' +
            (ik ? '<tr><td>IK : ' + Math.round(km) + ' km</td><td>' + euros(ik) + '</td></tr>' : '') + '<tr class="tot"><td>Total</td><td>' + euros(total + ik) + '</td></tr></table>' + manque +
            '<small>Ne comptent pas : les repas où vous n\'étiez pas parti avant 11 h / 18 h ou rentré après 14 h / 21 h, les repas fournis ou pris au restaurant administratif, les nuits non payantes (logé gratuitement). Pour changer un repas ou une nuit : <b>Frais › Repas & hébergement</b>.</small>';
        return Promise.resolve({ html: html, etq: 'Détail du calcul de TRIGONE Compte-rendu' });
    }

    // ---------- Les références sont-elles à jour ? ----------
    function repAJour(q, ctx) {
        var s = N(q), sujets = SUJETS_A_JOUR.filter(function(x) { return x[1].test(s); }).map(function(x) { return x[0]; });
        if (sujets.length > 1 && sujets.indexOf('appli') >= 0) sujets.splice(sujets.indexOf('appli'), 1);
        var T = ctx.tarifs || {}, lignes = [];
        var avoirCodier = sujets.indexOf('codier') >= 0 && ctx.codier ? ctx.codier().catch(function() { return null; }) : Promise.resolve(null);
        return avoirCodier.then(function(cd) {
            sujets.forEach(function(x) {
                if (x === 'codier') {
                    var dt = cd && cd._source && cd._source.date ? cd._source.date.split('-').reverse().join('/') : '';
                    lignes.push('<b>Codier FD</b> : ' + (dt ? 'version du <b>' + dt + '</b>' : 'version intégrée à TRIGONE') + '. Il est mis à jour par le concepteur de TRIGONE à chaque nouvelle diffusion du codier, et arrive tout seul avec la mise à jour de l\'appli. Un code fermé vous est signalé avec le code qui le remplace.');
                }
                if (x === 'ik') {
                    var d = ''; try { d = localStorage.getItem('trigone_ik_rates_date') || ''; } catch (e) {}
                    var ik = T.ik || {};
                    lignes.push('<b>Indemnités kilométriques</b> : ' + esc(d || T.ikDate || 'barème de la fonction publique') + ' — 5 CV et moins : ' + euros(ik['5cv'] || 0).replace(' €', '') + ' €/km, 6 et 7 CV : ' + euros(ik['6-7cv'] || 0).replace(' €', '') + ' €/km, 8 CV et plus : ' + euros(ik['8cv'] || 0).replace(' €', '') + ' €/km.');
                }
                if (x === 'change') lignes.push('<b>Taux de change</b> : ' + esc(ctx.change.date) + '. Compte-rendu les reprend de la Banque centrale européenne (BCE) dès qu\'il a du réseau.');
                if (x === 'baremes') lignes.push('<b>Indemnités de mission</b> : barèmes officiels (arrêté du 3 juillet 2006 modifié ; pour les militaires, décret n° 2009-545) — en France, repas ' + euros(T.repasFrance || 20) + ', nuit ' + euros((T.hebergementFrance || {}).PETITE || 90) + ' / ' + euros((T.hebergementFrance || {}).GRANDE || 120) + ' (grandes villes, Grand Paris) / ' + euros((T.hebergementFrance || {}).PARIS || 140) + ' (Paris) ; à l\'étranger, ' + ((T.pays || []).length) + ' pays. Ce sont ceux de TRIGONE Compte-rendu, mis à jour par le concepteur à chaque nouveau texte.');
                if (x === 'appli') lignes.push('<b>TRIGONE</b> : vous avez la publication n° <b>' + esc(ctx.version || '?') + '</b>. L\'appli se met à jour toute seule à l\'ouverture quand une nouvelle version sort (Paramètres › Mise à jour pour vérifier).');
            });
            return { html: lignes.join('<br><br>') + '<small>En cas de doute sur un montant, l\'assistant Chorus DT fait foi.</small>', etq: 'D\'après les références intégrées à TRIGONE' };
        });
    }

    // ---------- Mes chiffres (Bibliothèques de Compte-rendu et de Mise en route, sur cet appareil) ----------
    var PALIERS = [[5, 'Bronze'], [10, 'Argent'], [20, 'Or']];
    function repChiffres(q) {
        var s = N(q), an = (/ en ((?:19|20)\d\d) /.exec(s) || [])[1] || (/ (cette annee|l annee|depuis janvier) /.test(s) ? String(new Date().getFullYear()) : / (l an dernier|annee derniere) /.test(s) ? String(new Date().getFullYear() - 1) : '');
        var crs = (lireL('mission_bibliotheque', []) || []).filter(function(e) { var d = date(e.debut); return !an || (d && String(d.getFullYear()) === an); });
        var dem = mesDemandes().filter(function(x) { var d = date(((x.d.trajets || {}).aller || {}).dateDep || x.envoyeLe); return !an || (d && String(d.getFullYear()) === an); });
        var forfait = 0, ik = 0, km = 0, nuits = 0, jours = 0, lieux = {};
        crs.forEach(function(e) {
            var sn = e.snapshot || {}; forfait += +e.forfaitOfficiel || 0;
            ['A', 'A_ANX', 'R', 'R_ANX'].forEach(function(k) { if (sn['IK_' + k]) { ik += +sn['IK_MONTANT_' + k] || 0; km += +sn['IK_KM_' + k] || 0; } });
            (sn.JOURS || []).forEach(function(j) { jours++; if (j && j.L === 'PAYANT') nuits++; });
            var l = sn.LIBELLE_MISSION || ''; if (l) lieux[l] = (lieux[l] || 0) + 1;
        });
        var envoyes = parseInt(localStorage.getItem('trigone_cr_envoyes_total') || '0', 10) || 0, med = null, suiv = null;
        PALIERS.forEach(function(p) { if (envoyes >= p[0]) med = p; else if (!suiv) suiv = p; });
        var refus = dem.filter(function(x) { return x.s && x.s.etape === 'refus'; }).length, traitees = dem.filter(function(x) { return x.s && x.s.etape === 'traite'; }).length;
        if (!crs.length && !dem.length) return Promise.resolve({ html: 'Je ne trouve encore aucune mission' + (an ? ' en ' + an : '') + ' sur cet appareil. Si vous utilisiez un autre appareil, connectez votre compte TRIGONE : vos données reviennent.' });
        var l = [];
        if (dem.length) l.push('<b>' + dem.length + '</b> demande' + (dem.length > 1 ? 's' : '') + ' de mise en route envoyée' + (dem.length > 1 ? 's' : '') + (traitees ? ', dont <b>' + traitees + '</b> traitée' + (traitees > 1 ? 's' : '') + ' par l\'assistant Chorus DT' : '') + (refus ? ' et ' + refus + ' refusée' + (refus > 1 ? 's' : '') + ' (à corriger)' : ''));
        if (crs.length) l.push('<b>' + crs.length + '</b> mission' + (crs.length > 1 ? 's' : '') + ' avec compte-rendu' + (jours ? ', <b>' + jours + '</b> jour' + (jours > 1 ? 's' : '') + ' en mission' : '') + (nuits ? ', <b>' + nuits + '</b> nuit' + (nuits > 1 ? 's' : '') + ' payée' + (nuits > 1 ? 's' : '') : ''));
        if (forfait) l.push('Forfaits repas et hébergement : <b>' + euros(forfait) + '</b>');
        if (ik) l.push('Indemnités kilométriques : <b>' + euros(ik) + '</b>' + (km ? ' pour ' + String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km' : ''));
        if (forfait && ik) l.push('Total estimé : <b>' + euros(forfait + ik) + '</b>');
        if (!an) l.push(envoyes ? '<b>' + envoyes + '</b> compte' + (envoyes > 1 ? 's' : '') + '-rendu' + (envoyes > 1 ? 's' : '') + ' envoyé' + (envoyes > 1 ? 's' : '') + (med ? ' : <b>TRIGONE ' + med[1] + '</b> 🏅' : '') + (suiv ? ' (encore ' + (suiv[0] - envoyes) + ' pour ' + (suiv[1] === 'Or' ? 'l\'Or' : suiv[1] === 'Argent' ? 'l\'Argent' : 'le Bronze') + ')' : '') : 'Pas encore de compte-rendu envoyé : la médaille de Bronze arrive au 5e.');
        var top = Object.keys(lieux).sort(function(a, b) { return lieux[b] - lieux[a]; })[0];
        if (top && lieux[top] > 1) l.push('Mission la plus fréquente : <b>« ' + esc(top) + ' »</b> (' + lieux[top] + ' fois)');
        return Promise.resolve({ html: 'Vos chiffres' + (an ? ' pour <b>' + an + '</b>' : '') + ' :<ul class="AIDE-LISTE">' + l.map(function(x) { return '<li>' + x + '</li>'; }).join('') + '</ul><small>Montants d\'après vos comptes-rendus (forfaits calculés par TRIGONE) ; le remboursement réel est celui de Chorus DT.</small>' +
            actions(bouton('Voir Remboursement', 'cr:P-STAT')), etq: 'D\'après vos Bibliothèques TRIGONE' });
    }

    // ---------- Nouveautés (à compléter à chaque publication, numéro de build des ?v=) ----------
    var NOUVEAUTES = [
        { build: 230, version: 'V227', l: ['Quand vous tapez une question, je vous propose les questions dont je connais la réponse exacte : touchez la bonne', 'Des petits « ? » à côté des champs difficiles (code FD, avance, transport, repas, nuit) expliquent quoi mettre'] },
        { build: 229, version: 'V226', l: ['Références : les textes officiels des frais de déplacement des militaires (décret n° 2009-545) sont cités à côté des barèmes', 'Demandez-moi « c\'est quoi le texte sur les frais de mission ? »'] },
        { build: 228, version: 'V225', l: ['L\'accueil de Mise en route s\'adapte à tous les écrans : la barre d\'onglets du bas reste toujours visible (téléphones pliables, petits écrans, grand texte)'] },
        { build: 227, version: 'V224', l: ['La mascotte vous dit ce qu\'elle fait pendant qu\'elle cherche (« Je calcule la mission à Lyon… »)', 'Sa réponse s\'écrit sous vos yeux, mot à mot (touchez la bulle pour tout afficher)'] },
        { build: 226, version: 'V223', l: ['L\'IA de la mascotte fait les calculs avec les vrais barèmes de TRIGONE (nuits, repas, IK, codes FD) au lieu de répondre de mémoire', 'Elle cherche la réponse dans toute la notice, même si la question est tournée autrement', 'Une question déjà posée reçoit sa réponse tout de suite'] },
        { build: 225, version: 'V222', l: ['« Me rattacher à une mission » : le chef de mission donne un code à 6 chiffres, chacun s\'ajoute tout seul à la demande', 'Le chef voit le nombre de pax et la carte TRIGONE de chacun', 'Annuler une mission : tout le monde est prévenu, le registre est tamponné « ANNULÉ »'] },
        { build: 224, version: 'V221', l: ['La mascotte vous attend dès l\'écran de choix des applis : « Une question ? Je suis là. »'] },
        { build: 223, version: 'V220', l: ['« Je n\'arrive plus à me connecter » : la mascotte et la notice expliquent chaque cas (code oublié, trop d\'essais, téléphone perdu)', 'Code à 4 chiffres oublié : avec un compte, vos données reviennent à la reconnexion'] },
        { build: 222, version: 'V219', l: ['Après un calcul, « et les codes d\'imputation ? » est compris comme un nouveau sujet (codes FD), plus comme la suite du calcul'] },
        { build: 221, version: 'V218', l: ['Plusieurs questions dans le même message : la mascotte répond à chacune, dans l\'ordre', '« Codes d\'imputation pour une mission » : les codes FD de votre unité (ceux de déplacement en premier)'] },
        { build: 220, version: 'V217', l: ['La mascotte répond juste à ce qu\'on lui demande : « 3 nuits à Nantes » → « vous seriez remboursé de 360 € », « 4 repas à Lyon » → 80 €', 'Pour la mission complète, il suffit d\'ajouter « et avec les repas ? »'] },
        { build: 219, version: 'V216', l: ['« Salut, combien pour 2 nuits à Paris ? » : la mascotte rend le bonjour et fait le calcul (le « 2 » était pris pour une abréviation SMS)'] },
        { build: 218, version: 'V215', l: ['La mascotte peut discuter beaucoup plus chaque jour (40 questions libres par personne), toujours gratuitement'] },
        { build: 217, version: 'V214', l: ['La mascotte discute librement : n\'importe quelle question, avec des phrases naturelles et de l\'humour si vous plaisantez', 'Plus de bouton « Demander à l\'IA » : elle répond directement quand elle n\'a pas de réponse toute prête', 'Les montants et les règles restent ceux validés par l\'unité'] },
        { build: 216, version: 'V213', l: ['Nouveaux inscrits : à la fin du questionnaire, la mascotte au casque se présente (« Je suis votre assistant TRIGONE ») et montre ce qu\'elle sait faire'] },
        { build: 215, version: 'V212', l: ['La mascotte connaît les règles validées par le 4e RIISC : péage et parking, taxi, véhicule personnel (autorisé par le chef de corps), véhicule de service, avance de 75 %, nuit imprévue, petit-déjeuner', 'Consignes de l\'unité : compte-rendu à rendre dans les 30 jours après la fin de mission, billets par Amplitude (ABT)'] },
        { build: 214, version: 'V211', l: ['Déjà un compte TRIGONE (sur votre téléphone) ? Sur un nouvel appareil, « J\'ai déjà un compte » est mis en avant', 'Si vous refaites « Créer mon compte » à votre nom, TRIGONE vous propose de vous connecter au lieu de créer un doublon'] },
        { build: 213, version: 'V210', l: ['« Ai-je droit au repas du soir ? » : la mascotte répond selon VOS horaires de mission', '« Pourquoi seulement 180 € ? » : le détail du calcul, jour par jour, et les repas que vous auriez pu déclarer', 'L\'IA connaît les règles de calcul de TRIGONE et le résumé de votre mission (sans nom ni matricule)'] },
        { build: 212, version: 'V209', l: ['Les suites de questions sont comprises : « prix à Lyon », puis « et Paris ? », « et Marseille », « et en Italie », « pareil pour une nuit » — sans tout reposer', 'L\'IA suit aussi la conversation (elle voit ce que la mascotte vient de répondre)'] },
        { build: 211, version: 'V208', l: ['La mascotte comprend encore plus de façons d\'écrire : SMS (« kom », « jtrouv pa », « cmb »), fautes courantes, argot et sigles militaires (« le fourrier », « mon CDU », « ma tire »…)', 'Elle varie ses réponses pour ne pas toujours répéter la même phrase, toujours avec respect'] },
        { build: 210, version: 'V207', l: ['La mascotte connaît toutes les formules de politesse (bonjour, ça va, merci, au revoir, désolé, bravo, mes respects, bonnes fêtes…) et sait quoi répondre, même combinées (« merci, bonne soirée »)'] },
        { build: 209, version: 'V206', l: ['Simulation en une phrase : « si je pars 5 jours à Paris en VRC depuis Libourne, 6 CV, logement et repas à ma charge, combien ? » → repas, nuits, IK et total', 'Suites : « et en train ? », « depuis Bordeaux », « en 8 CV »'] },
        { build: 208, version: 'V205', l: ['Codes FD : la mascotte reconnaît toutes les unités du codier, écrites à votre façon (« 3rpima », « 3°RPiMa », « 6e régiment du génie », « 4eriisc »)'] },
        { build: 207, version: 'V204', l: ['La mascotte suit votre circuit : « où en est ma demande ? », « et mon compte-rendu ? », « combien je vais toucher ? »', 'Elle relit votre demande avant l\'envoi et vous montre ce qui manque', 'Valideurs : « j\'ai quoi à valider ? » ; assistant Chorus DT : « j\'ai quoi à traiter ? »', 'Conversion de devises, et un bouton « Pourquoi ? » sur les messages d\'erreur'] },
        { build: 206, version: 'V203', l: ['Affichage revu pour tous les téléphones, grands caractères compris', 'La page « Ce que je sais faire » de la mascotte', 'Questions de suite (« et en Italie ? »), indemnités kilométriques, qui valide ma demande'] }
    ];
    function htmlNouveautes(n) { return 'Nouveau dans <b>TRIGONE ' + esc(n.version) + '</b> :<ul class="AIDE-LISTE">' + n.l.map(function(x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
    function repNouveautes() { return Promise.resolve({ html: htmlNouveautes(NOUVEAUTES[0]) + (NOUVEAUTES[1] ? '<small>Et juste avant (' + esc(NOUVEAUTES[1].version) + ') : ' + NOUVEAUTES[1].l.map(esc).join(' · ') + '.</small>' : ''), etq: 'Nouveautés de TRIGONE' }); }
    // Une fois par publication, à l'ouverture de la discussion.
    function nouveautesAAnnoncer(build, taire) {
        var n = NOUVEAUTES.filter(function(x) { return x.build === +build; })[0]; if (!n) return null;
        if (lireL('trigone_aide_nouveautes_vues', 0) >= n.build) return null;
        try { localStorage.setItem('trigone_aide_nouveautes_vues', String(n.build)); } catch (e) {}
        return taire ? null : htmlNouveautes(n);
    }

    // ---------- « Pourquoi ? » d'un message d'erreur ----------
    var ERREURS = [
        [/a completer|identite incomplete|objet manquant/, 'Il manque des informations obligatoires dans votre demande. Les champs en rouge sont ceux à remplir ; je peux aussi relire toute la demande pour vous (« vérifie ma demande »).'],
        [/pas de connexion|hors ligne|reseau/, 'Le téléphone n\'a pas de réseau en ce moment. Rien n\'est perdu : réessayez quand vous avez du réseau (4G ou wifi). Les envois en attente partent tout seuls dès le retour du réseau.'],
        [/mail manquant|adresse.*inconnue|demandeur inconnu/, 'TRIGONE ne sait pas à qui envoyer : l\'adresse du destinataire manque. Choisissez-le dans <b>Paramètres › À qui j\'envoie</b> (ou dans la liste de votre unité).'],
        [/pas encore de compte trigone/, 'Le destinataire n\'a pas encore activé son compte TRIGONE. Demandez-lui de se connecter (bouton « Se connecter » en haut à droite), puis renvoyez : rien n\'est perdu.'],
        [/mauvais destinataire/, 'Ce destinataire n\'a pas le bon rôle pour recevoir cet envoi (par exemple un VALIDEUR 2 à la place d\'un VALIDEUR 1). Vérifiez le destinataire choisi.'],
        [/fichier trop lourd/, 'Le fichier dépasse la taille permise. Pour une photo, prenez-la de plus loin ou réduisez-la ; pour un PDF, scannez-le en qualité « normale ».'],
        [/format non (accepte|pris en charge)|fichier non reconnu|import impossible/, 'Ce type de fichier n\'est pas accepté. TRIGONE prend les PDF et les photos (JPG, PNG) ; pour les listes de personnes, un fichier Excel, Calc ou CSV.'],
        [/matricule incorrect/, 'Le matricule doit compter exactement 10 chiffres (identifiant défense).'],
        [/motif manquant|commentaire manquant/, 'Un refus ou un renvoi doit toujours dire pourquoi : écrivez un motif, il sera envoyé au demandeur pour qu\'il corrige.'],
        [/aucune demande cochee/, 'Cochez d\'abord au moins une demande dans la liste, puis relancez l\'action.'],
        [/piece jointe (absente|impossible|modifiee)/, 'Une pièce jointe manque ou a été modifiée depuis la signature : par sécurité, TRIGONE la refuse. Demandez au demandeur de la renvoyer.'],
        [/signature impossible|verification impossible|controle impossible/, 'TRIGONE n\'a pas pu vérifier ou poser la signature électronique. Vérifiez votre code de valideur (Paramètres › Compte › Mes rôles), puis réessayez.'],
        [/pdf (complet )?impossible|ouverture impossible/, 'Le document n\'a pas pu être fabriqué ou ouvert. Réessayez ; si ça recommence, fermez puis rouvrez TRIGONE. Le bouton « Signaler un problème » prévient le concepteur.'],
        [/envoi (impossible|illisible)|question (impossible|non envoyee)|reponse non envoyee|relance impossible/, 'L\'envoi n\'est pas parti (réseau ou serveur indisponible). Rien n\'est perdu : réessayez dans un moment.'],
        [/numerotation|premier numero|registre/, 'Le registre des OMR n\'a pas pu être mis à jour (réseau). Réessayez dans un moment : la numérotation reste cohérente.'],
        [/montant a verifier/, 'Le montant saisi paraît anormal (trop élevé ou négatif). Vérifiez-le avant de continuer.']
    ];
    function expliquerErreur(titre, texte) {
        var s = N(titre + ' ' + texte);
        for (var i = 0; i < ERREURS.length; i++) if (ERREURS[i][0].test(s)) return ERREURS[i][1];
        return null;
    }

    // Résumé de la mission en cours pour l'IA : horaires, lieu, nuits et repas déclarés — jamais de nom ni de matricule.
    function resumeMission() {
        var m = mission(); if (!m) return '';
        var dep = heureFr(m.DEBUT), ret = heureFr(m.FIN_RETOUR_HORODATE), nuits = 0;
        (m.JOURS || []).forEach(function(J) { if (J && J.L === 'PAYANT') nuits++; });
        var pos = repasPossibles(dep, ret);
        return ['Mission « ' + String(m.LIBELLE_MISSION || 'en cours').slice(0, 60) + ' »', dep ? 'départ le ' + jour(dep) + ' à ' + hh(dep) : '', ret ? 'retour le ' + jour(ret) + ' à ' + hh(ret) : 'retour pas encore pointé',
            m.MISSION_ETRANGER ? 'à l\'étranger (' + String(m.PAYS_MISSION || '').slice(0, 40) + ')' : 'en France', 'repas payants déclarés : ' + (m.PAYANT_MIDI || 0) + ' midi, ' + (m.PAYANT_SOIR || 0) + ' soir' + (pos ? ' (possibles d\'après les horaires : ' + pos.midi + ' midi, ' + pos.soir + ' soir)' : ''),
            'nuits payantes : ' + nuits, m.MAIL_SENT ? 'compte-rendu envoyé' : 'compte-rendu pas encore envoyé'].filter(Boolean).join(' ; ');
    }
    var REPONSES = { droit: repDroit, calcul: repCalcul, simulation: repSimulation, chiffres: repChiffres, ajour: repAJour, demande: repDemande, moncr: repCr, estimation: repEstimation, relecture: repRelecture, avalider: repAValider, chorus: repChorus, devise: repDevise, nouveautes: repNouveautes };
    window.AIDE_CIRCUIT = {
        intention: intention, suite: suite, repondre: function(id, q, ctx) { return (REPONSES[id] || function() { return Promise.resolve(null); })(q, ctx); },
        insulte: insulte, frustre: function(q) { return FRUSTRE.test(N(q)); }, couper: couper, coupeeJusqua: coupeeJusqua, heure: heure,
        nouveautesAAnnoncer: nouveautesAAnnoncer, resumeMission: resumeMission, expliquerErreur: expliquerErreur, estimer: estimer
    };
})();
