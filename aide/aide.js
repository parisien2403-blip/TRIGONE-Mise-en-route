// ===================== AIDE TRIGONE : LA MASCOTTE QUI RÉPOND =====================
// Pastille de la mascotte à côté de la lune (téléphone) ou carte « Besoin d'aide ? » dans le menu de gauche (PC),
// dans Mise en route et dans Compte-rendu. La fenêtre de discussion cherche d'abord la réponse dans aide/base.json
// (aide/moteur.js : fautes, SMS, jargon), sans réseau ; sinon elle propose de demander à l'IA (serveur TRIGONE,
// route aide/ia, comptes connectés seulement). « Me montrer » ouvre le bon écran et fait clignoter le bon bouton.
(function() {
    var DANS_CR = /\/cr\//.test(location.pathname), B = DANS_CR ? '../' : '', APP = DANS_CR ? 'cr' : 'mer';
    var VERSION = ((document.currentScript && /[?&]v=(\d+)/.exec(document.currentScript.src)) || [])[1] || '';
    var IMG = B + 'aide/mascotte-aide.webp', CLE_FIL = 'trigone_aide_fil', CLE_VUE = 'trigone_aide_vue', CLE_ACTION = 'trigone_aide_action';
    var base = null, moteur = null, chargement = null, fen = null, fil = [], pastille = null, attenteIa = false, tarifs = null, codier = null;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function lire(cle) { try { return JSON.parse(sessionStorage.getItem(cle) || 'null'); } catch (e) { return null; } }
    function ecrire(cle, v) { try { sessionStorage.setItem(cle, JSON.stringify(v)); } catch (e) {} }
    function estPc() { return !!(window.matchMedia && matchMedia('(min-width: 1100px)').matches); }
    function compteActif() { return !!(window.JUMELAGE_COMPTE_ACTIF && window.JUMELAGE_COMPTE_ACTIF()); }
    function charger() {
        if (moteur) return Promise.resolve(moteur);
        if (!chargement) chargement = fetch(B + 'aide/base.json?v=' + VERSION, { cache: 'no-cache' })
            .then(function(r) { if (!r.ok) throw new Error('base'); return r.json(); })
            .then(function(j) { base = j; moteur = window.AIDE_MOTEUR.creer(j);
                // Barèmes (repas, hébergement, pays) : petits, chargés avec la base ; le codier, lui, à la première question sur un code FD.
                return fetch(B + 'aide/tarifs.json?v=' + VERSION).then(function(r) { return r.ok ? r.json() : null; }).then(function(x) { tarifs = x; }, function() {}).then(function() { return moteur; }); })
            .catch(function(e) { chargement = null; throw e; });
        return chargement;
    }

    // ---------- Écran ouvert (pour l'IA, et un léger avantage aux fiches de cet écran) ----------
    function visible(sel) { var e = document.querySelector(sel); return !!(e && e.getClientRects().length); }
    function ecranCourant() {
        if (visible('.JUM-PARAM')) return 'parametres';
        if (visible('.JUM-CARTE-FEN')) return 'carte';
        if (visible('.JUM-VERROU, .JUM-PAVE')) return 'verrou';
        if (visible('.JUM-ACC, .JUM-CONNEXION')) return 'connexion';
        if (visible('.JUM-CHOIX')) return 'choix';
        if (!DANS_CR) {
            var p = window.PAGE_ACTUELLE;
            if (p === 'CHORUS') return window.MER_DOSSIER && window.MER_DOSSIER.CHORUS === 'registre' ? 'registre' : 'mer-chorus';
            return { ACCUEIL: 'mer-accueil', FORMULAIRE: 'mer-formulaire', PANIER: 'mer-documents', BIBLIOTHEQUE: 'mer-bibliotheque', RECEPTION: 'mer-reception', VALIDATION: 'mer-valideur' }[p] || 'mer-accueil';
        }
        var pages = { 'P0': 'cr-accueil', 'P1': 'cr-depart', 'P-MENU': 'cr-mission', 'P2': 'cr-mission', 'P-CHAIN': 'cr-mission', 'P2-FIN': 'cr-frais', 'P3': 'cr-recap', 'P3-SIG': 'cr-recap',
            'P-PAX': 'cr-recap', 'P-BOITE': 'cr-boite', 'P-BIB': 'cr-bib', 'P-STAT': 'cr-rembours', 'P-SIMU': 'cr-simu' };
        for (var id in pages) { var el = document.getElementById(id); if (el && !el.classList.contains('HIDDEN') && el.getClientRects().length) return pages[id]; }
        return 'cr-accueil';
    }

    // ---------- « Me montrer » : ouvrir le bon écran, faire clignoter le bon bouton ----------
    function clignoter(sel) {
        if (!sel) return;
        var essais = 0, go = function() {
            var cible = [].slice.call(document.querySelectorAll(sel)).filter(function(e) { return e.getClientRects().length; })[0];
            if (!cible) { if (++essais < 12) setTimeout(go, 250); return; }
            try { cible.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
            cible.classList.add('AIDE-CIBLE'); setTimeout(function() { cible.classList.remove('AIDE-CIBLE'); }, 4200);
        };
        setTimeout(go, 350);
    }
    function executer(m) {
        var a = m.a || '', i = a.indexOf(':'), app = i > 0 ? a.slice(0, i) : '', quoi = i > 0 ? a.slice(i + 1) : a;
        // Écran de l'autre appli : on y va, l'action reprend à l'arrivée.
        if ((app === 'mer' || app === 'cr') && app !== APP) { ecrire(CLE_ACTION, m); if (window.JUMELAGE_ALLER) window.JUMELAGE_ALLER(app); return; }
        if (window.JUMELAGE_FERMER_PARAMETRES) try { window.JUMELAGE_FERMER_PARAMETRES(); } catch (e) {}
        var R = function(vue) { return function() { window.JUMELAGE_REGLAGES({ vue: vue }); }; };
        var actions = {
            'carte': function() { window.JUMELAGE_CARTE(); }, 'mdp': function() { window.JUMELAGE_CODE_CONNEXION({ changer: true }); },
            'notif': function() { window.JUMELAGE_PARAMETRES('notif'); }, 'profil': R('profil'), 'roles': R('roles'), 'absence': R('absence'),
            'mesappareils': function() { window.JUMELAGE_MES_APPAREILS(); }, 'gestion': function() { window.JUMELAGE_GESTION_COMPTES(); },
            'montre': function() { window.JUMELAGE_MONTRE(); }, 'attente': function() { window.JUMELAGE_ATTENTE(); }, 'sauvauto': function() { window.JUMELAGE_SAUVEGARDE_AUTO(); },
            'signaler': function() { window.JUMELAGE_SIGNALER(); }, 'partager': function() { window.JUMELAGE_PARTAGER_APPLI(); }, 'notice': function() { window.JUMELAGE_NOTICE(); },
            'theme': function() {}
        };
        if (app === 'param') { window.JUMELAGE_PARAMETRES(quoi); }
        else if (app === 'mer') {
            if (quoi === 'NOUVELLE') window.DEMARRER_NOUVELLE_DEMANDE();
            else if (quoi === 'CHORUS' && window.JUMELAGE_OUVRIR_CHORUS) window.JUMELAGE_OUVRIR_CHORUS();
            else window.SHOW_PAGE(quoi);
        } else if (app === 'cr') {
            if (quoi === 'P-BOITE' && window.OUVRIR_BOITE_CR) window.OUVRIR_BOITE_CR(); else window.SHOW_PAGE(quoi);
        } else if (actions[quoi]) actions[quoi]();
        clignoter(m.c);
    }
    function reprendreAction() {
        var m = lire(CLE_ACTION); if (!m) return;
        try { sessionStorage.removeItem(CLE_ACTION); } catch (e) {}
        setTimeout(function() { try { executer(m); } catch (e) {} }, 1500);
    }

    // ---------- La fenêtre de discussion ----------
    // Salutation selon le grade du profil (« mon adjudant », « sergent-chef »…) ; commissaires : Monsieur ou Madame,
    // demandé une fois (le profil ne le dit pas) et retenu sur l'appareil.
    var CLE_CIV = 'trigone_aide_civilite';
    // L'appellation seule (« mon adjudant », « Madame le commissaire »), ou '' si le grade est inconnu.
    function appel() { var s = salutation(); return s.texte ? s.texte.replace(/^Bonjour,? ?/, '').replace(/, en quoi puis-je vous aider\s\?$/, '').replace(/^en quoi puis-je vous aider\s\?$/, '') : ''; }
    function salutation() {
        var g = ''; try { g = (JSON.parse(localStorage.getItem('trigone_reglages_communs') || '{}').grade) || ''; } catch (e) {}
        var a = window.AIDE_MOTEUR.appellation(g);
        if (a.charAt(0) === '§') {
            var civ = ''; try { civ = localStorage.getItem(CLE_CIV) || ''; } catch (e) {}
            if (!civ) return { demander: a.slice(2) };
            a = civ + a.slice(1);
        }
        return { texte: 'Bonjour' + (a ? ', ' + a : '') + ', en quoi puis-je vous aider\u00a0?' };
    }
    function puces() {
        // Sujets de l'écran ouvert d'abord (sauf sur les accueils : les plus demandés), puis les plus demandés.
        var e = ecranCourant(), ids = [], accessoires = ['theme', 'medailles', 'pastilles-rouges', 'mise-a-jour', 'installer'];
        if (!/accueil|choix/.test(e)) (base.fiches || []).forEach(function(f) { if (ids.length < 4 && (f.e || []).indexOf(e) >= 0 && accessoires.indexOf(f.id) < 0) ids.push(f.id); });
        var defaut = DANS_CR ? ['cr-commencer', 'cr-frais', 'joindre-justif', 'cr-envoyer'] : ['nouvelle-demande', 'envoyer-demande', 'suivre-demande', 'code-connexion-oublie'];
        defaut.forEach(function(id) { if (ids.length < 4 && ids.indexOf(id) < 0) ids.push(id); });
        return ids.map(function(id) { var f = moteur.fiche(id); return f ? '<button type="button" class="AIDE-PUCE" data-fiche="' + id + '">' + esc(f.t) + '</button>' : ''; }).join('');
    }
    // Réponse d'une fiche : la phrase courte, dite comme on parle, puis le pas-à-pas replié (« Voir comment faire »).
    function htmlFiche(f, corps) {
        var texte = corps || (f.c ? esc(f.c) + '<details class="AIDE-DETAIL"><summary>Voir comment faire</summary>' + f.r + '</details>' : f.r);
        return texte + '<div class="AIDE-ACTIONS">' + (f.m ? '<button type="button" class="AIDE-BTN AIDE-MONTRER" data-montrer="' + f.id + '">👉 ' + esc(f.m.l || 'Me montrer') + '</button>' : '') +
            (f.n ? '<button type="button" class="AIDE-LIEN" data-notice="' + esc(f.n) + '">📖 Notice › ' + esc(f.n) + '</button>' : '') + '</div>';
    }
    // ---------- Réponses personnelles : calculées sur l'appareil (profil, rôles) et avec l'annuaire de l'unité ----------
    function reglages() { try { return JSON.parse(localStorage.getItem('trigone_reglages_communs') || '{}'); } catch (e) { return {}; } }
    function nomDepuisMail(m) {
        var l = String(m || '').split('@')[0].split('.'); if (l.length < 2) return m || '';
        var p = l[0].split('-').map(function(x) { return x.charAt(0).toUpperCase() + x.slice(1); }).join('-');
        return p + ' ' + l.slice(1).join(' ').toUpperCase();
    }
    function personne(x, avecMail) {
        var n = [x.grade, x.prenom ? x.prenom.charAt(0).toUpperCase() + x.prenom.slice(1).toLowerCase() : '', x.nom].filter(Boolean).join(' ') || nomDepuisMail(x.mail);
        return '<b>' + esc(n) + '</b>' + (x.fonction ? ', ' + esc(x.fonction.toLowerCase()) : '') + (avecMail && x.mail && n !== x.mail ? ' <small style="display:inline">(' + esc(x.mail) + ')</small>' : '');
    }
    function annuaire(role) { return compteActif() && navigator.onLine && window.JUMELAGE_API ? window.JUMELAGE_API('annuaire?role=' + role).catch(function() { return null; }) : Promise.resolve(null); }
    function liste(l) { return l.length === 1 ? personne(l[0]) : l.slice(0, -1).map(function(x) { return personne(x); }).join(', ') + ' ou ' + personne(l[l.length - 1]); }
    var PERSO = {
        // Qui valide : le VALIDEUR 1 choisi dans Mon profil, puis les VALIDEUR 2 et assistants Chorus DT de SON unité
        // (l'annuaire du serveur ne donne que l'unité du demandeur : jamais un valideur d'un autre régiment).
        'qui-valide': function() {
            var reg = reglages(), v1 = String(reg.mailVal1 || '').toLowerCase(), ch = String(reg.mailChorus || '').toLowerCase();
            return Promise.all([annuaire('valideur1'), annuaire('valideur2'), annuaire('chorus')]).then(function(a) {
                var connu = !!(a[0] || a[1] || a[2]), unite = (a[0] || a[1] || a[2] || {}).unite || reg.unite || '';
                var l1 = (a[0] && a[0].personnes) || [], l2 = (a[1] && a[1].personnes) || [], l3 = (a[2] && a[2].personnes) || [];
                var h = '';
                if (!v1) h += 'Vous n\'avez pas encore indiqué votre <b>VALIDEUR 1</b> : c\'est en général votre chef de section ou votre commandant d\'unité. Mettez son adresse dans <b>Mon profil › Envois</b> (ou scannez sa carte).';
                else {
                    var p1 = l1.filter(function(x) { return x.mail === v1; })[0];
                    h += 'Votre demande va d\'abord chez votre <b>VALIDEUR 1</b> : ' + personne(p1 || { mail: v1 }, true) + '.';
                    if (connu && !p1) h += '<small>⚠️ Je ne le trouve pas parmi les VALIDEUR 1 ' + (unite ? 'du ' + esc(unite) : 'de votre unité') + ' : vérifiez l\'adresse dans Mon profil (ou qu\'il a bien coché son rôle).</small>';
                }
                h += '<br>' + (v1 ? 'Il' : 'Le VALIDEUR 1') + ' la transmet ensuite au <b>VALIDEUR 2</b>' + (l2.length ? ' : ' + liste(l2.slice(0, 4)) : unite ? ' du ' + esc(unite) : ' de l\'unité') + '.';
                var p3 = l3.filter(function(x) { return x.mail === ch; })[0];
                h += '<br>Enfin, l\'<b>assistant Chorus DT</b> crée votre ordre de mission' + (p3 ? ' : ' + personne(p3) : l3.length ? ' : ' + liste(l3.slice(0, 3)) : ch ? ' : ' + personne({ mail: ch }) : '') + '.';
                h += '<br>Vous êtes prévenu à chaque étape, et vous suivez tout dans la <b>Bibliothèque</b>.';
                if (!connu) h += '<small>Connecté avec du réseau, je vous dirais aussi qui sont le VALIDEUR 2 et l\'assistant Chorus DT de votre unité.</small>';
                return h;
            });
        },
        'mon-adresse': function() {
            var a = (window.JUMELAGE_ADRESSE_CONNUE && window.JUMELAGE_ADRESSE_CONNUE()) || (window.JUMELAGE_COMPTE_MAIL && window.JUMELAGE_COMPTE_MAIL()) || '';
            return Promise.resolve(a ? 'Votre adresse TRIGONE, c\'est <b>' + esc(a) + '</b> <button type="button" class="AIDE-LIEN" data-copier="' + esc(a) + '">Copier</button><br>Elle sert à vous connecter (avec votre code de connexion) et à recevoir vos factures et billets.'
                : 'Vous n\'êtes pas encore connecté sur cet appareil : touchez <b>Se connecter</b> (pastille du compte) avec votre adresse TRIGONE et votre code de connexion.');
        },
        'mes-roles': function() {
            var l = {}; try { l = JSON.parse(localStorage.getItem('trigone_roles_locaux') || '{}') || {}; if (localStorage.getItem('trigone_role_chorus') === '1') l.chorus = true; if (localStorage.getItem('trigone_role_admin')) l.admin = true; } catch (e) {}
            var noms = { valideur1: 'VALIDEUR 1', valideur2: 'VALIDEUR 2', chorus: 'ASSIST CHORUS DT', admin: 'ADMINISTRATEUR' }, eus = Object.keys(noms).filter(function(k) { return l[k]; }).map(function(k) { return '<b>' + noms[k] + '</b>'; });
            return Promise.resolve(eus.length ? 'Sur cet appareil, vous êtes missionnaire et ' + eus.join(', ') + '. Pour en ajouter ou en retirer : <b>Paramètres › Compte › Mes rôles</b>.'
                : 'Vous êtes <b>missionnaire</b>, comme tout le monde. Si on vous a confié un rôle (VALIDEUR 1 ou 2, ASSIST CHORUS DT), cochez-le dans <b>Paramètres › Compte › Mes rôles</b> avec son code.');
        }
    };
    // Donne la réponse d'une fiche (personnelle si elle l'est), avec « Ce n'est pas ça ? » si elle vient d'une question.
    function donnerFiche(f, question) {
        var fin = function(corps) {
            ajouter({ de: 'lui', html: htmlFiche(f, corps) + (question ? '<div class="AIDE-AUTRE">Ce n\'est pas ça ? <button type="button" class="AIDE-LIEN" data-ia="' + esc(question) + '">✨ Demander à l\'IA</button></div>' : ''),
                etq: f.dyn ? 'Réponse d\'après votre profil' : 'Réponse trouvée dans la notice', fiche: f.id, q: question });
        };
        if (f.dyn && PERSO[f.dyn]) { attenteIa = true; dessinerFil(); PERSO[f.dyn]().then(function(h) { attenteIa = false; fin(h); }, function() { attenteIa = false; fin(); }); }
        else fin();
    }
    // Réponse de l'IA : texte simple, gras **…** et retours à la ligne seulement (jamais de HTML venu du serveur).
    function htmlIa(t) {
        return esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/^\s*[-•]\s+/gm, '• ').replace(/\n/g, '<br>');
    }
    var sourire = false;
    function ajouter(m) {
        if (sourire && m.de === 'lui' && !m.pose) { m.html = 'Bien sûr\u00a0! ' + m.html; m.pose = 'content'; sourire = false; }
        fil.push(m); if (fil.length > 40) fil = fil.slice(-40); ecrire(CLE_FIL, fil); dessinerFil(); }
    // La mascotte prend une posture selon sa réponse (images déjà dans TRIGONE).
    var POSES = { salut: 'mascotte.webp', montre: 'demo-mascotte.webp', aide: 'mascotte-assistance.webp', code: 'mascotte-code.webp', content: 'mascotte-ok.webp', desole: 'mascotte-erreur.webp' };
    function poseDe(m) {
        if (/AIDE-POUCE/.test(m.html)) return '';
        // Pas à chaque réponse (ce serait lourd) : seulement à certains moments de la conversation.
        var k = m.pose || (/^Je n'ai pas trouvé/.test(m.html) ? 'desole' : '');
        return POSES[k] || '';
    }
    function dessinerFil() {
        if (!fen) return;
        var z = fen.querySelector('.AIDE-FIL');
        z.innerHTML = fil.map(function(m) {
            if (m.de === 'moi') return '<div class="AIDE-M moi">' + esc(m.texte) + '</div>';
            var et = m.ia ? '<div class="AIDE-ETQ">✨ Réponse de l\'IA — elle peut se tromper, la notice fait foi</div>' : m.etq ? '<div class="AIDE-ETQ">' + esc(m.etq) + '</div>' : '';
            var bulle = '<div class="AIDE-M lui' + (m.ia ? ' ia' : '') + '">' + m.html + '</div>', pose = poseDe(m);
            return (pose ? '<div class="AIDE-LIGNE"><img class="AIDE-POSE" src="' + B + pose + '" alt="">' + bulle + '</div>' : bulle) + et;
        }).join('') + (attenteIa ? '<div class="AIDE-M lui AIDE-TAPE"><i></i><i></i><i></i></div>' : '');
        z.scrollTop = z.scrollHeight;
    }
    function boutonsIa(question) {
        return '<div class="AIDE-ACTIONS"><button type="button" class="AIDE-BTN AIDE-IA" data-ia="' + esc(question) + '">✨ Demander à l\'IA</button>' +
            '<button type="button" class="AIDE-LIEN" data-signaler="1">Signaler un problème</button></div>';
    }
    // Codier FD et barèmes : réponse tirée des données de TRIGONE (sans IA, sans réseau une fois chargés).
    function tauxChange() {
        var t = null, d = '';
        try { t = JSON.parse(localStorage.getItem('trigone_exchange_rates') || 'null'); d = localStorage.getItem('trigone_exchange_rates_date') || ''; } catch (e) {}
        return { taux: Object.assign({}, tarifs.change, t || {}), date: t ? d : 'taux de référence par défaut de TRIGONE (Compte-rendu les met à jour chaque jour)' };
    }
    function repondreDonnees(question, type) {
        var D = window.AIDE_DONNEES, fin = function(r) {
            if (!r) return false;
            ajouter({ de: 'lui', html: r.html + '<div class="AIDE-AUTRE">Ce n\'est pas ça ? <button type="button" class="AIDE-LIEN" data-ia="' + esc(question) + '">✨ Demander à l\'IA</button></div>', etq: r.etq, q: question });
            return true;
        };
        if (type === 'tarif') { var c = tauxChange(); return Promise.resolve(fin(D.tarif(question, tarifs, c.taux, c.date))); }
        var avoir = codier ? Promise.resolve(codier) : fetch(B + 'codier.json').then(function(r) { if (!r.ok) throw new Error('codier'); return r.json(); }).then(function(j) { codier = j; return j; });
        return avoir.then(function(cd) { return fin(D.codier(question, cd)); }, function() { return false; });
    }
    // La question précédente (sujet et type), pour comprendre « et en Italie ? » ; gardée le temps de la conversation.
    var CLE_DERNIER = 'trigone_aide_dernier';
    // Politesse : « merci » → la mascotte lève le pouce ; « bonjour », « au revoir » → une vraie réponse.
    var IMG_POUCE = B + 'mascotte-pouce.webp';
    function politesse(question) {
        var s = window.AIDE_MOTEUR.normal(question).trim(), a = appel(), vous = a ? ', ' + esc(a) : '';
        var court = s.split(' ').length <= 6;
        if (court && /^(merci|mrc|mci|thanks|thx|top|super|parfait|nickel|genial|cool|impec|impeccable|ok merci|d accord merci|c est bon|ca marche|bien recu|au top|trop bien|excellent|merci beaucoup|merci bien|merci a toi|merci a vous)( |$)/.test(s))
            return '<div class="AIDE-POUCE"><img src="' + IMG_POUCE + '" alt=""><span>Avec plaisir' + vous + '\u00a0! Si vous avez une autre question, je suis là.</span></div>';
        if (court && /^(au revoir|aurevoir|bye|a plus|a\+|bonne journee|bonne soiree|bonne nuit|a bientot|ciao|tchao|salut a plus|bonne mission)( |$)/.test(s))
            return '<div class="AIDE-POUCE"><img src="' + B + 'mascotte.webp" alt=""><span>Au revoir' + vous + ', et bonne mission\u00a0! 🫡</span></div>';
        if (s.split(' ').length <= 3 && /^(bonjour|salut|hello|coucou|bonsoir|hey|yo|bjr|slt|cc)( |$)/.test(s))
            return '\u0001salut' + 'Bonjour' + vous + '\u00a0! Que puis-je faire pour vous\u00a0?<div class="AIDE-PUCES">' + puces() + '</div>';
        if (court && /^(ca va|comment ca va|ca va et toi|tu vas bien|comment vas tu|cv)( |$)/.test(s))
            return 'Très bien, merci' + vous + '\u00a0! Toujours prêt à vous aider. Une question sur TRIGONE\u00a0?';
        return '';
    }
    // Indemnités kilométriques : distance par la route (serveur TRIGONE, carte de l'IGN), puis montant selon la puissance.
    function repondreIk(q) {
        var D = window.AIDE_DONNEES, v = D.villesIk(q), perso = null;
        try { perso = JSON.parse(localStorage.getItem('trigone_ik_rates') || 'null'); } catch (e) {}
        var fin = function(km, err) {
            var rep = D.ik(q, tarifs, perso, km, err);
            ajouter({ de: 'lui', html: rep.html + '<div class="AIDE-AUTRE">Ce n\'est pas ça ? <button type="button" class="AIDE-LIEN" data-ia="' + esc(q) + '">✨ Demander à l\'IA</button></div>', etq: rep.etq, q: q });
            ecrire(CLE_DERNIER, { type: 'ik', q: q, ik: rep.ik });
        };
        if (!v) return fin(null);
        if (!navigator.onLine) return fin(null, 'pas de réseau');
        attenteIa = true; dessinerFil();
        fetch(B + 'api/distance?de=' + encodeURIComponent(v.de.toUpperCase()) + '&a=' + encodeURIComponent(v.a.toUpperCase()), { cache: 'no-store' })
            .then(function(r) { return r.json(); }).then(function(j) { attenteIa = false; if (j && j.ok && j.km >= 0) fin(j.km); else fin(null, (j && j.erreur) || 'service indisponible'); },
                function() { attenteIa = false; fin(null, 'service indisponible'); });
    }
    function repondre(question) {
        ajouter({ de: 'moi', texte: question });
        var poli = politesse(question);
        if (poli) { var sal = poli.indexOf('\u0001salut') === 0; ajouter({ de: 'lui', html: sal ? poli.slice(6) : poli, pose: sal ? 'salut' : '' }); return; }
        // « stp », « s'il vous plaît » : la mascotte répond avec le sourire (« Bien sûr ! »).
        sourire = /(^| )(stp|svp|s il te plait|s il vous plait|sil te plait|sil vous plait|steuplait|stplait|please)( |$)/.test(window.AIDE_MOTEUR.normal(question));
        var D = window.AIDE_DONNEES, q = question, type = D && D.intention(question, tarifs), dernier = lire(CLE_DERNIER);
        if (D && dernier && D.estSuite(question) && (dernier.type === 'tarif' || dernier.type === 'fd' || dernier.type === 'ik')) {
            var q2 = D.completer(dernier, question, tarifs), t2 = q2 && D.intention(q2, tarifs);
            if (t2 === dernier.type) { q = q2; type = t2; }
        }
        if (type === 'ik' && tarifs) { repondreIk(q); return; }
        if (type === 'fd' || (type === 'tarif' && tarifs)) {
            repondreDonnees(q, type).then(function(ok) { if (ok) ecrire(CLE_DERNIER, { type: type, q: q }); else repondreFiches(question, dernier); });
            return;
        }
        repondreFiches(question, dernier);
    }
    function repondreFiches(question, dernier) {
        var r = moteur.chercher(question, { app: APP, ecran: ecranCourant() }), top = r.resultats[0], M = window.AIDE_MOTEUR;
        // Question de suite sur un sujet de la notice : on la complète avec la précédente si, seule, elle ne suffit pas.
        if ((!top || top.score < M.SUR) && dernier && dernier.type === 'fiche' && window.AIDE_DONNEES.estSuite(question)) {
            var r2 = moteur.chercher(window.AIDE_DONNEES.completer(dernier, question, tarifs) || question, { app: APP, ecran: ecranCourant() });
            if (r2.resultats[0] && r2.resultats[0].score >= M.SUR && r2.resultats[0].fiche.id !== dernier.fiche) { r = r2; top = r2.resultats[0]; }
        }
        if (top && top.score >= M.SUR) ecrire(CLE_DERNIER, { type: 'fiche', q: question, fiche: top.fiche.id });
        if (top && top.score >= M.SUR) {
            donnerFiche(top.fiche, question);
        } else if (top && top.score >= M.PROPOSER) {
            ajouter({ de: 'lui', html: 'Vous voulez parler de :<div class="AIDE-PUCES">' + r.resultats.slice(0, 3).map(function(x) {
                return '<button type="button" class="AIDE-PUCE" data-fiche="' + x.fiche.id + '">' + esc(x.fiche.t) + '</button>'; }).join('') + '</div>' +
                '<div class="AIDE-AUTRE">Aucun des trois ? <button type="button" class="AIDE-LIEN" data-ia="' + esc(question) + '">✨ Demander à l\'IA</button></div>', q: question });
        } else {
            ajouter({ de: 'lui', html: 'Je n\'ai pas trouvé de page de la notice qui réponde à ça. Voulez-vous que je demande à mon <b>cerveau IA</b> ?' + boutonsIa(question), q: question });
        }
    }
    function demanderIa(question) {
        if (attenteIa) return;
        if (!compteActif()) { ajouter({ de: 'lui', html: 'L\'IA est réservée aux <b>comptes TRIGONE connectés</b> : connectez-vous (pastille du compte › Se connecter), puis reposez votre question.' }); return; }
        if (!navigator.onLine) { ajouter({ de: 'lui', html: 'Pas de réseau pour l\'instant : l\'IA a besoin d\'internet. Réessayez quand le réseau revient, ou ouvrez la notice.' }); return; }
        var r = moteur.chercher(question, { app: APP, ecran: ecranCourant() });
        // Les derniers échanges, pour qu'elle suive la conversation (texte seulement).
        var hist = fil.slice(-6).filter(function(m) { return m.de === 'moi' || m.ia; }).map(function(m) { return { de: m.de === 'moi' ? 'moi' : 'ia', texte: m.de === 'moi' ? m.texte : (m.brut || '') }; }).slice(-4);
        attenteIa = true; dessinerFil();
        window.JUMELAGE_API('aide/ia', { question: question, fiches: r.resultats.slice(0, 4).map(function(x) { return x.fiche.id; }), ecran: ecranCourant(), app: APP, historique: hist })
            .then(function(j) {
                attenteIa = false;
                var f = j.fiche ? moteur.fiche(j.fiche) : null;
                ajouter({ de: 'lui', ia: true, brut: j.reponse, html: htmlIa(j.reponse) + (f ? '<div class="AIDE-ACTIONS">' + (f.m ? '<button type="button" class="AIDE-BTN AIDE-MONTRER" data-montrer="' + f.id + '">👉 ' + esc(f.m.l || 'Me montrer') + '</button>' : '') +
                    (f.n ? '<button type="button" class="AIDE-LIEN" data-notice="' + esc(f.n) + '">📖 Notice › ' + esc(f.n) + '</button>' : '') + '</div>' : '') });
            }, function(e) {
                attenteIa = false;
                var msg = e.statut === 429 ? 'Le nombre de questions à l\'IA pour aujourd\'hui est atteint. La notice reste là, et l\'IA revient demain.'
                    : e.statut === 503 ? 'L\'IA n\'est pas disponible pour le moment. Essayez la notice, ou signalez le problème.'
                    : 'L\'IA n\'a pas pu répondre (' + esc(e.message || 'erreur') + ').';
                ajouter({ de: 'lui', html: msg + '<div class="AIDE-ACTIONS"><button type="button" class="AIDE-LIEN" data-notice="">📖 Ouvrir la notice</button></div>' });
            });
    }
    window.AIDE_OUVRIR = function() {
        if (fen) return;
        try { localStorage.setItem(CLE_VUE, '1'); } catch (e) {}
        if (pastille) pastille.classList.remove('AIDE-INVITE');
        var b = document.querySelector('.AIDE-BULLE'); if (b) b.remove();
        fen = document.createElement('div');
        fen.className = 'AIDE-FOND' + (estPc() ? ' pc' : '');
        fen.setAttribute('role', 'dialog'); fen.setAttribute('aria-label', 'Aide de TRIGONE');
        fen.innerHTML = '<div class="AIDE-FEN"><div class="AIDE-TETE"><img src="' + IMG + '" alt=""><div><b>Besoin d\'aide ?</b><small>Je cherche dans la notice TRIGONE</small></div>' +
            '<button type="button" class="AIDE-VIDER" title="Nouvelle conversation" aria-label="Nouvelle conversation">↺</button><button type="button" class="AIDE-X" aria-label="Fermer">✕</button></div>' +
            '<div class="AIDE-FIL"><div class="AIDE-M lui">Chargement…</div></div>' +
            '<div class="AIDE-AVERT">⚠️ Ne saisissez pas d\'informations personnelles (nom, matricule, détails de mission).</div>' +
            '<form class="AIDE-SAISIE"><input type="text" data-no-uppercase="1" maxlength="400" placeholder="Posez votre question…" aria-label="Votre question" autocomplete="off"><button type="submit" aria-label="Envoyer">➤</button></form></div>';
        document.body.appendChild(fen);
        var champ = fen.querySelector('input');
        fen.addEventListener('click', function(ev) {
            if (ev.target === fen && !estPc()) { window.AIDE_FERMER(); return; }
            var t = ev.target.closest('button'); if (!t) return;
            if (t.classList.contains('AIDE-X')) { window.AIDE_FERMER(); return; }
            if (t.classList.contains('AIDE-VIDER')) { fil = []; ecrire(CLE_FIL, fil); ecrire(CLE_DERNIER, null); accueil(); return; }
            if (t.dataset.fiche) { var f = moteur.fiche(t.dataset.fiche); if (f) { ajouter({ de: 'moi', texte: f.t }); donnerFiche(f); } return; }
            if (t.dataset.montrer) { var g = moteur.fiche(t.dataset.montrer); if (g && g.m) { window.AIDE_FERMER(); executer(g.m); } return; }
            if (t.dataset.notice !== undefined) { var titre = t.dataset.notice; window.AIDE_FERMER(); window.JUMELAGE_NOTICE(null, titre ? { titre: titre } : {}); return; }
            if (t.dataset.ia !== undefined) { demanderIa(t.dataset.ia); return; }
            if (t.dataset.signaler) { window.AIDE_FERMER(); window.JUMELAGE_SIGNALER(); return; }
            if (t.dataset.copier) { try { navigator.clipboard.writeText(t.dataset.copier); } catch (e) {} t.textContent = 'Copié ✓'; return; }
            if (t.dataset.civ) { try { localStorage.setItem(CLE_CIV, t.dataset.civ); } catch (e) {} accueil(); return; }
        });
        fen.querySelector('form').addEventListener('submit', function(ev) {
            ev.preventDefault();
            var q = champ.value.trim(); if (!q || !moteur) return;
            champ.value = ''; repondre(q);
        });
        var accueil = function() {
            var s = salutation();
            fil = [{ de: 'lui', html: s.demander ? 'Bonjour ! Pour bien vous saluer, dois-je dire :<div class="AIDE-PUCES"><button type="button" class="AIDE-PUCE" data-civ="Monsieur">Monsieur ' + esc(s.demander) + '</button>' +
                '<button type="button" class="AIDE-PUCE" data-civ="Madame">Madame ' + esc(s.demander) + '</button></div>' : esc(s.texte) + '<div class="AIDE-PUCES">' + puces() + '</div>' }];
            ecrire(CLE_FIL, fil); dessinerFil();
        };
        charger().then(function() {
            fil = lire(CLE_FIL) || [];
            if (!fil.length) accueil(); else dessinerFil();
            if (!('ontouchstart' in window)) champ.focus();
        }, function() {
            fen.querySelector('.AIDE-FIL').innerHTML = '<div class="AIDE-M lui">Je n\'arrive pas à charger l\'aide. Vérifiez le réseau, ou ouvrez la notice.<div class="AIDE-ACTIONS"><button type="button" class="AIDE-LIEN" data-notice="">📖 Ouvrir la notice</button></div></div>';
        });
        document.addEventListener('keydown', echap);
    };
    function echap(e) { if (e.key === 'Escape') window.AIDE_FERMER(); }
    window.AIDE_FERMER = function() { if (fen) { fen.remove(); fen = null; } document.removeEventListener('keydown', echap); };

    // ---------- Les boutons : pastille (téléphone) et carte du menu (PC) ----------
    window.AIDE_BOUTON_PC = function() {
        return '<button type="button" class="AIDE-CARTE-PC" onclick="AIDE_OUVRIR()"><img src="' + IMG + '" alt=""><span><b>Besoin d\'aide ?</b><small>Posez votre question</small></span></button>';
    };
    // La pastille suit le bouton de thème (la lune) : juste à sa gauche, même hauteur, sur tous les écrans du téléphone.
    var FENETRES = '.JUM-REGLAGES, .JUM-PARAM, .JUM-SIG, .JUM-CHOIX, .JUM-VERROU, .JUM-PAVE, .JUM-PRES, .JUM-NOUV, .JUM-MDP-FOND, .JUM-GC-FEN, .JUM-ACC, .JUM-ROUE-MENU';
    function fenetreOuverte() { return [].some.call(document.querySelectorAll(FENETRES), function(e) { return e.getClientRects().length > 0; }); }
    function placer() {
        if (!pastille) return;
        var lune = document.querySelector('.THEME-TOGGLE'), r = lune && lune.getClientRects().length ? lune.getBoundingClientRect() : null;
        var cacher = !r || estPc() || document.body.classList.contains('demo-active') || fenetreOuverte();
        pastille.style.display = cacher ? 'none' : '';
        if (cacher) { var bu = document.querySelector('.AIDE-BULLE'); if (bu) bu.remove(); return; }
        var t = Math.round(r.height);
        pastille.style.width = pastille.style.height = t + 'px';
        pastille.style.top = Math.round(r.top) + 'px';
        pastille.style.left = Math.round(r.left - t - 8) + 'px';
        pastille.style.zIndex = getComputedStyle(lune).zIndex || 500;
    }
    function installer() {
        var st = document.createElement('style'); st.id = 'AIDE-CSS'; st.textContent = CSS; document.head.appendChild(st);
        pastille = document.createElement('button');
        pastille.type = 'button'; pastille.className = 'AIDE-PASTILLE'; pastille.title = 'Besoin d\'aide ?'; pastille.setAttribute('aria-label', 'Besoin d\'aide ? Posez votre question à la mascotte');
        pastille.innerHTML = '<img src="' + IMG + '" alt="">';
        pastille.addEventListener('click', function() { window.AIDE_OUVRIR(); });
        document.body.appendChild(pastille);
        placer(); window.addEventListener('resize', placer); setInterval(placer, 1000);
        if (window.MutationObserver) new MutationObserver(placer).observe(document.body, { childList: true });
        // Première fois : la mascotte se signale (pulsation et bulle), jusqu'au premier appui.
        var vue = false; try { vue = !!localStorage.getItem(CLE_VUE); } catch (e) {}
        var essais = 0;
        if (!vue) setTimeout(function inviter() {
            if (fen) return;
            if (!pastille || pastille.style.display === 'none') { if (++essais < 20) setTimeout(inviter, 3000); return; }
            pastille.classList.add('AIDE-INVITE');
            var bu = document.createElement('div'); bu.className = 'AIDE-BULLE'; bu.textContent = 'Besoin d\'aide ? Touchez-moi';
            var r = pastille.getBoundingClientRect(); bu.style.top = (r.bottom + 10) + 'px'; bu.style.right = Math.max(8, window.innerWidth - r.right - 10) + 'px';
            bu.addEventListener('click', function() { window.AIDE_OUVRIR(); });
            document.body.appendChild(bu); setTimeout(function() { bu.remove(); }, 9000);
        }, 4000);
        reprendreAction();
    }

    var CSS = [
        '.AIDE-PASTILLE{position:fixed;padding:0;border-radius:50%;border:2px solid #d4a64a;background:#fff;overflow:hidden;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.3)}',
        '.AIDE-PASTILLE img{width:100%;height:100%;object-fit:cover;display:block}',
        '.AIDE-PASTILLE.AIDE-INVITE{animation:aidePulse 1.6s ease-in-out infinite}',
        '@keyframes aidePulse{0%,100%{box-shadow:0 0 0 0 rgba(212,166,74,.65)}50%{box-shadow:0 0 0 9px rgba(212,166,74,0)}}',
        '.AIDE-BULLE{position:fixed;z-index:9500;background:#d4a64a;color:#111;font:700 13px system-ui,sans-serif;padding:7px 11px;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer}',
        '.AIDE-BULLE::before{content:"";position:absolute;top:-6px;right:22px;border:6px solid transparent;border-top:0;border-bottom-color:#d4a64a}',
        '.AIDE-CARTE-PC{display:flex;align-items:center;gap:10px;width:100%;margin:0 0 10px;padding:8px 10px;border-radius:12px;border:1px solid #d4a64a;background:linear-gradient(135deg,#1c1c1c,#2b2414);color:#fff;text-align:left;font:600 14px system-ui,sans-serif;cursor:pointer}',
        '.AIDE-CARTE-PC:hover{border-color:#e9c47a;background:linear-gradient(135deg,#232323,#3a301a)}',
        '.AIDE-CARTE-PC img{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #d4a64a;background:#fff;flex:none}',
        '.AIDE-CARTE-PC small{display:block;font-weight:400;font-size:11.5px;color:#d9c08a}',
        '.AIDE-FOND{position:fixed;inset:0;z-index:12000;background:rgba(5,8,15,.55);display:flex;align-items:flex-end;justify-content:center}',
        '.AIDE-FOND.pc{background:transparent;pointer-events:none;align-items:flex-end;justify-content:flex-end;padding:0 24px 24px 0}',
        '.AIDE-FEN{pointer-events:auto;width:100%;max-width:460px;height:86%;background:#f4f5f7;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 30px rgba(0,0,0,.4);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827}',
        '.AIDE-FOND.pc .AIDE-FEN{width:430px;height:min(640px,calc(100vh - 48px));border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.35)}',
        '.AIDE-TETE{background:linear-gradient(135deg,#111,#2a2a2a);color:#fff;padding:12px 12px 12px 14px;display:flex;align-items:center;gap:12px;border-bottom:3px solid #d4a64a}',
        '.AIDE-TETE img{width:54px;height:54px;border-radius:50%;object-fit:cover;border:2px solid #d4a64a;background:#fff;flex:none}',
        '.AIDE-TETE b{font-size:16px;display:block}.AIDE-TETE small{opacity:.8;font-size:12px}',
        '.AIDE-TETE button{background:none;border:0;color:#fff;font-size:20px;width:38px;height:38px;border-radius:50%;cursor:pointer;flex:none}',
        '.AIDE-VIDER{margin-left:auto}.AIDE-TETE button:hover{background:rgba(255,255,255,.12)}',
        '.AIDE-FIL{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}',
        '.AIDE-M{max-width:86%;padding:10px 12px;border-radius:16px;overflow-wrap:anywhere}',
        '.AIDE-M.lui{background:#fff;border:1px solid #dde1e7;border-bottom-left-radius:4px;align-self:flex-start}',
        '.AIDE-M.lui.ia{border-color:#e7cf98}',
        '.AIDE-M.moi{background:linear-gradient(#e2b866,#c99a45);color:#111;border-bottom-right-radius:4px;align-self:flex-end}',
        '.AIDE-ETQ{font-size:11.5px;color:#6b7280;align-self:flex-start;margin:-4px 0 0 4px}',
        '.AIDE-PUCES{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
        '.AIDE-PUCE{border:1px solid #c99a45;color:#6f4c0e;background:#fff;border-radius:16px;padding:6px 10px;font:inherit;font-size:13.5px;cursor:pointer;text-align:left}',
        '.AIDE-ACTIONS{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:9px;align-items:center}',
        '.AIDE-BTN{border:0;background:#c99a45;color:#111;border-radius:16px;padding:7px 12px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}',
        '.AIDE-LIEN{border:0;background:none;color:#8a5e10;font:inherit;font-size:13px;font-weight:700;padding:2px 0;cursor:pointer;text-align:left}',
        '.AIDE-AUTRE{margin-top:8px;font-size:12.5px;color:#6b7280}',
        '.AIDE-POUCE{display:flex;align-items:center;gap:10px}',
        '.AIDE-LIGNE{display:flex;align-items:flex-end;gap:6px;align-self:flex-start;max-width:94%;min-width:0}',
        '.AIDE-LIGNE .AIDE-M{max-width:100%;min-width:0}',
        '.AIDE-POSE{width:44px;height:52px;object-fit:contain;object-position:bottom;flex:none;margin-bottom:-2px}',
        '@media (max-width:340px){.AIDE-POSE{width:34px;height:40px}}',
        '.AIDE-POUCE img{width:72px;height:72px;object-fit:contain;flex:none;animation:aidePouce .6s ease-out}',
        '@keyframes aidePouce{0%{transform:scale(.4) rotate(-12deg);opacity:0}70%{transform:scale(1.1) rotate(4deg);opacity:1}100%{transform:scale(1) rotate(0)}}',
        '.AIDE-DETAIL{margin-top:8px;border-top:1px dashed #e2d3ae;padding-top:6px}',
        '.AIDE-DETAIL summary{cursor:pointer;color:#8a5e10;font-weight:700;font-size:13px;list-style:none}',
        '.AIDE-DETAIL summary::before{content:"▸ "}.AIDE-DETAIL[open] summary::before{content:"▾ "}',
        '.AIDE-DETAIL[open] summary{margin-bottom:6px}',
        'body.dark-mode .AIDE-DETAIL summary{color:#e9c47a}',
        '.AIDE-M small{display:block;font-size:12px;color:#6b7280;margin-top:4px;line-height:1.35}',
        '.AIDE-CODE{margin:8px 0 2px;padding:7px 9px;border:1px solid #e7cf98;border-radius:10px;background:#fffaf0}',
        '.AIDE-CODE b{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.5px}',
        'body.dark-mode .AIDE-CODE{background:#2a2518;border-color:#5a4a26}',
        'body.dark-mode .AIDE-M small{color:#9ca3af}',
        '.AIDE-AVERT{font-size:11.5px;color:#92400e;background:#fef3c7;padding:6px 12px;text-align:center}',
        '.AIDE-SAISIE{display:flex;gap:8px;padding:10px;background:#fff;border-top:1px solid #dde1e7;margin:0}',
        '.AIDE-SAISIE input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:22px;padding:10px 14px;font:inherit;font-size:16px;background:#fff;color:#111;text-transform:none}',
        '.AIDE-SAISIE button{width:44px;height:44px;border-radius:50%;border:0;background:#c99a45;color:#111;font-size:18px;cursor:pointer;flex:none}',
        '.AIDE-TAPE i{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#c99a45;animation:aideTape 1s infinite}',
        '.AIDE-TAPE i:nth-child(2){animation-delay:.15s}.AIDE-TAPE i:nth-child(3){animation-delay:.3s}',
        '@keyframes aideTape{0%,80%,100%{opacity:.25}40%{opacity:1}}',
        '.AIDE-CIBLE{outline:3px solid #d4a64a !important;outline-offset:3px;animation:aideCible 1s ease-in-out 4;border-radius:10px}',
        '@keyframes aideCible{0%,100%{box-shadow:0 0 0 0 rgba(212,166,74,.7)}50%{box-shadow:0 0 0 12px rgba(212,166,74,0)}}',
        'body.dark-mode .AIDE-FEN{background:#17181b;color:#e5e7eb}',
        'body.dark-mode .AIDE-M.lui{background:#24262b;border-color:#34373d}',
        'body.dark-mode .AIDE-PUCE{background:#24262b;color:#e9c47a}',
        'body.dark-mode .AIDE-LIEN{color:#e9c47a}',
        'body.dark-mode .AIDE-SAISIE{background:#1d1f23;border-color:#34373d}',
        'body.dark-mode .AIDE-SAISIE input{background:#24262b;border-color:#3a3d44;color:#f3f4f6}',
        'body.dark-mode .AIDE-AVERT{background:#3a2e12;color:#f3d48a}'
    ].join('\n');

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installer); else installer();
})();
