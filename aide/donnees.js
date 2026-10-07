// ===================== AIDE TRIGONE : CODIER FD ET BARÈMES =====================
// Réponses de la mascotte tirées des données de TRIGONE, sans IA ni réseau :
// - codier.json : un code FD (« FD1ADNK11F ») ou les codes d'une unité / d'un objet (« code FD du 4e RIISC formation ») ;
// - aide/tarifs.json (barèmes de Compte-rendu) : forfaits repas et hébergement en France selon la ville, et à
//   l'étranger selon le pays (indemnité journalière, part repas et nuitée, conversion en euros).
// Utilisé par aide.js (navigateur) et par les tests (Node).
(function() {
    function normal(s) { return ' ' + String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`"]/g, ' ').replace(/[^a-z0-9@]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function euros(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; }
    function nombre(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function titre(s) { return s.trim().split(' ').map(function(m) { return m.charAt(0).toUpperCase() + m.slice(1); }).join(' '); }

    // ---------- Intention ----------
    var CODE_FD = /\b(fd[0-9a-z]{6,10})\b/i;
    var MOTS_FD = / (code fd|codes fd|code d engagement|codes d engagement|code engagement|fd ligne|fd@ligne|fdligne|codier|fd|code imputation|codes imputation|code d imputation|codes d imputation|code de l imputation|imputation|imputations|code budgetaire|ligne budgetaire|centre financier) /;
    var FORT = / (tarif|tarifs|taux|bareme|baremes|forfait|forfaits|prix|montant|montants|coute|coutent|cout|couts|euro|euros|indemnite|indemnites|indemnise|indemnisation|indemnisations|indemnisee|frais|allocation|allocations|prime|primes|touche|toucher|percoit|percevoir|rembourse|remboursee|remboursement|plafond|droit|droits) /;
    var SUJET = / (repas|manger|dejeuner|diner|hebergement|hotel|hotels|nuit|nuits|nuitee|nuitees|dormir|logement|chambre|journalier|journaliere|etranger|pays) /;
    var OUTRE_MER = / (reunion|guadeloupe|martinique|guyane|mayotte|nouvelle caledonie|polynesie|tahiti|saint pierre et miquelon|wallis|saint martin|saint barthelemy|dom tom|outre mer|dom) /;

    // ---------- Codier FD ----------
    var vides = {}; ('le la les l un une des de du d j je tu il on nous vous mon ma mes ton ta tes son sa ses notre votre leur ce cet cette ces ca c est a au aux en et ou que qu qui quoi quel quelle quels quelles ' +
        'est sont suis ai as avez pour par sur dans avec sans chez donne donner trouver trouve cherche connaitre connais savoir sais veux voudrais besoin stp svp merci bonjour salut moi me m faut il y pas ne n ' +
        'code codes fd fds codier engagement ligne numero unite regiment imputation imputations imputer mettre mets met utiliser utilise mission missions ma mon quels quelles c budgetaire centre financier').split(' ').forEach(function(m) { vides[m] = 1; });
    var indexCodier = null;
    function preparerCodier(codier) {
        if (indexCodier && indexCodier.src === codier) return indexCodier;
        var liste = [];
        Object.keys(codier).forEach(function(k) { var v = codier[k]; if (k.charAt(0) !== '_' && v && v.lib) liste.push({ code: k, v: v, mots: normal(v.lib).trim().split(' ') }); });
        var vus = {};
        liste.forEach(function(e) { var m, re = / \d{1,3} ([a-z]{2,8}) /g, t = ' ' + e.mots.join(' ') + ' '; while ((m = re.exec(t))) { vus[m[1]] = 1; re.lastIndex--; } });
        Object.keys(vus).forEach(function(x) { if (SIGLES_CONNUS.indexOf(' ' + x + ' ') < 0) SIGLES_CONNUS += x + ' '; });
        indexCodier = { src: codier, liste: liste };
        return indexCodier;
    }
    // Unités en toutes lettres → sigles du codier (« 6e régiment du génie » → « 6 rg ») ; les plus longues d'abord.
    var SIGLES = [['regiment etranger du genie', 'reg'], ['regiment etranger d infanterie', 'rei'], ['regiment etranger de cavalerie', 'rec'], ['regiment etranger de parachutistes', 'rep'],
        ['regiment du genie parachutiste', 'rgp'], ['regiment de parachutistes d infanterie de marine', 'rpima'], ['regiment d infanterie de marine', 'rima'], ['regiment d artillerie de marine', 'rama'],
        ['regiment d helicopteres de combat', 'rhc'], ['regiment de hussards parachutistes', 'rhp'], ['regiment de chasseurs parachutistes', 'rcp'], ['regiment du service militaire volontaire', 'rsmv'],
        ['bataillon de chasseurs alpins', 'bca'], ['bataillon de chasseurs a pied', 'bcp'], ['brigade legere blindee', 'blb'], ['regiment de tirailleurs', 'rtir'],
        ['regiment du genie', 'rg'], ['regiment de genie', 'rg'], ['regiment genie', 'rg'], ['regiment d infanterie', 'ri'], ['regiment d artillerie', 'ra'], ['regiment du materiel', 'rmat'], ['regiment de materiel', 'rmat'],
        ['regiment de transmissions', 'rt'], ['regiment des transmissions', 'rt'], ['regiment de chasseurs', 'rch'], ['regiment de dragons', 'rd'], ['regiment de hussards', 'rh'], ['regiment de cuirassiers', 'rc'],
        ['genie', 'rg'], ['materiel', 'rmat'], ['transmissions', 'rt']];
    var ORDINAUX = { premier: 1, premiere: 1, deuxieme: 2, second: 2, seconde: 2, troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7, huitieme: 8, neuvieme: 9, dixieme: 10, onzieme: 11, douzieme: 12,
        treizieme: 13, quatorzieme: 14, quinzieme: 15, seizieme: 16, 'dix septieme': 17, 'dix huitieme': 18, 'dix neuvieme': 19, vingtieme: 20, 'vingt et unieme': 21, trentieme: 30, 'trente et unieme': 31 };
    var SIGLES_CONNUS = ' riisc uiisc rsc rg rmat ri ra rt rima rpima rama rhc rhp rcp rsmv bca bcp blb rtir rch rd rh rc reg rei rec rep rgp rtrs cie gim bsmat rcs ';
    function unites(s) {
        Object.keys(ORDINAUX).sort(function(a, b) { return b.length - a.length; }).forEach(function(o) { s = s.split(' ' + o + ' ').join(' ' + ORDINAUX[o] + ' '); });
        // « 6eme », « 6e », « 1er », « 6rg », « 4eriisc » : le numéro, puis le sigle à part.
        var coupe = function(t, n, x) {
            var ord = ['ieme', 'eme', 'ere', 'er', 'em', 'e'], c = [x].concat(ord.filter(function(o) { return x.indexOf(o) === 0; }).map(function(o) { return x.slice(o.length); }));
            var connu = c.filter(function(y) { return y && SIGLES_CONNUS.indexOf(' ' + y + ' ') >= 0; })[0];
            var reste = connu || (ord.indexOf(x) >= 0 ? '' : x);
            return ' ' + n + ' ' + (reste ? reste + ' ' : '');
        };
        s = s.replace(/ (\d{1,3})([a-z]{1,9}) /g, coupe).replace(/ (\d{1,3})([a-z]{1,9}) /g, coupe);
        s = s.replace(/ (\d{1,3}) (?:er|ere|eme|ieme|em|e) /g, ' $1 ');
        SIGLES.forEach(function(x) { s = s.split(' ' + x[0] + ' ').join(' ' + x[1] + ' '); });
        return s;
    }
    function motsRecherche(q) {
        var s = unites(normal(q))
            .replace(/ (\d+) ?(?:e|eme|er|ere|ieme)? ?(?:riisc|uiisc|rsc) /g, ' uiisc $1 ').replace(/ (?:riisc|uiisc|rsc) ?(?:n|no|numero)? ?(\d+) /g, ' uiisc $1 ')
            .replace(/ uiisc(\d+) /g, ' uiisc $1 ').replace(/ stages? /g, ' formation ').replace(/ entrainements? /g, ' entrainement ').replace(/ interventions? /g, ' intervention ');
        return s.trim().split(' ').filter(function(m) { return m && !vides[m] && !CODE_FD.test(m); });
    }
    function ligneCode(code, v) {
        return '<div class="AIDE-CODE"><b>' + esc(code) + '</b> <button type="button" class="AIDE-LIEN" data-copier="' + esc(code) + '">Copier</button><br>' + esc(v.lib) +
            (v.cf ? '<small>Centre financier ' + esc(v.cf) + ' · centre de coût ' + esc(v.cc || '') + ' · activité ' + esc(v.act || '') + '</small>' : '') + '</div>';
    }
    // uniteDefaut : unité du profil (« 4°RIISC »), utilisée quand la question n'en cite pas (« les codes d'imputation pour une mission »).
    function repondreCodier(q, codier, uniteDefaut) {
        var etq = 'Réponse tirée du codier FD' + (codier._source && codier._source.date ? ' (' + codier._source.date.split('-').reverse().join('/') + ')' : '');
        var m = CODE_FD.exec(q);
        if (m) {
            var code = m[1].toUpperCase(), v = codier[code], vus = 0;
            if (!v) return { html: 'Le code <b>' + esc(code) + '</b> n\'est pas dans le codier FD de TRIGONE. Vérifiez-le (10 caractères, commence par FD) auprès de votre assistant Chorus DT.', etq: etq };
            if (v.lib) return { html: ligneCode(code, v), etq: etq };
            // Code fermé : on suit les remplacements jusqu'au code en vigueur.
            var suivant = v.dev, html = 'Le code <b>' + esc(code) + '</b> n\'est plus valable' + (v.fin ? ' depuis le ' + esc(v.fin.split('-').reverse().join('/')) : '') + '.';
            while (suivant && codier[suivant] && !codier[suivant].lib && vus++ < 6) suivant = codier[suivant].dev;
            if (suivant && codier[suivant] && codier[suivant].lib) html += ' Il est remplacé par :' + ligneCode(suivant, codier[suivant]);
            return { html: html, etq: etq };
        }
        var idx = preparerCodier(codier), meilleurs = [], best = 0;
        var mots = motsRecherche(q), uDef = false;
        if (uniteDefaut && !mots.some(function(w) { return w === 'uiisc' || SIGLES_CONNUS.indexOf(' ' + w + ' ') >= 0; })) { var mu = motsRecherche(uniteDefaut); if (mu.length) { mots = mu.concat(mots); uDef = true; } }
        if (!mots.length) return null;
        idx.liste.forEach(function(e) {
            var ok = 0, chiffres = true;
            mots.forEach(function(w) {
                var trouve = e.mots.some(function(t) { return t === w || (!/^\d+$/.test(w) && w.length >= 5 && t.length >= 5 && t.slice(0, 5) === w.slice(0, 5)); });
                if (trouve) ok++; else if (/^\d+$/.test(w)) chiffres = false;
            });
            var s = chiffres ? ok / mots.length : 0;
            if (s > best) { best = s; meilleurs = [e]; } else if (s === best && s > 0) meilleurs.push(e);
        });
        if (best < 0.5 || !meilleurs.length) return { html: 'Je n\'ai pas trouvé de code FD pour « ' + esc(mots.join(' ')) + ' » dans le codier. Précisez l\'unité (ex. « UIISC n°4 ») et l\'objet (formation, intervention, entraînement, fonctionnement courant), ou demandez à votre assistant Chorus DT.', etq: etq };
        // Les codes de déplacement d'abord (les plus demandés pour une mission).
        meilleurs.sort(function(a, b) { return (/d[ée]placement/i.test(b.v.lib || '') ? 1 : 0) - (/d[ée]placement/i.test(a.v.lib || '') ? 1 : 0); });
        var n = meilleurs.length;
        return { html: (uDef ? 'Pour votre unité (' + esc(uniteDefaut) + ') — ' : '') + (n === 1 ? 'Dans le codier FD :' : n + ' codes FD correspondent' + (n > 8 ? ' (les 8 premiers ; précisez l\'objet : formation, intervention, entraînement…)' : '') + ' :') +
            meilleurs.slice(0, 8).map(function(e) { return ligneCode(e.code, e.v); }).join('') +
            '<small>Le bon code dépend de l\'objet de la mission : en cas de doute, l\'assistant Chorus DT fait foi.</small>', etq: etq };
    }

    // ---------- Barèmes : France (selon la ville) et étranger (selon le pays) ----------
    var ALIAS_PAYS = { 'usa': 'etats unis', 'us': 'etats unis', 'amerique': 'etats unis', 'americains': 'etats unis', 'new york': 'etats unis', 'washington': 'etats unis',
        'angleterre': 'grande bretagne', 'royaume uni': 'grande bretagne', 'uk': 'grande bretagne', 'ecosse': 'grande bretagne', 'londres': 'grande bretagne',
        'hollande': 'pays bas', 'amsterdam': 'pays bas', 'tchequie': 'tcheque', 'republique tcheque': 'tcheque', 'prague': 'tcheque', 'dubai': 'emirats arabes unis', 'abu dhabi': 'emirats arabes unis', 'emirats': 'emirats arabes unis',
        'tokyo': 'japon', 'toronto': 'canada', 'vancouver': 'canada', 'montreal': 'canada', 'quebec': 'canada', 'rdc': 'congo', 'kinshasa': 'congo', 'brazzaville': 'congo brazzaville', 'ivoire': 'cote d ivoire', 'abidjan': 'cote d ivoire',
        'berlin': 'allemagne', 'munich': 'allemagne', 'madrid': 'espagne', 'barcelone': 'espagne', 'rome': 'italie', 'milan': 'italie', 'bruxelles': 'belgique', 'geneve': 'suisse', 'berne': 'suisse', 'zurich': 'suisse',
        'lisbonne': 'portugal', 'dakar': 'senegal', 'niamey': 'niger', 'bamako': 'mali', 'ndjamena': 'tchad', 'n djamena': 'tchad', 'lome': 'togo', 'libreville': 'gabon', 'abuja': 'nigeria', 'lagos': 'nigeria', 'beyrouth': 'liban',
        'vilnius': 'lituanie', 'tallinn': 'estonie', 'riga': 'lettonie', 'varsovie': 'pologne', 'bucarest': 'roumanie', 'athenes': 'grece', 'vienne': 'autriche', 'oslo': 'norvege', 'stockholm': 'suede', 'helsinki': 'finlande', 'copenhague': 'danemark' };
    function nomPays(p) { return normal(p.replace(/\(.*?\)/g, ' ').replace(/ - .*$/, '')).trim().replace(/^la /, ''); }
    function trouverPays(q, tarifs) {
        var s = normal(q), noms = {};
        tarifs.pays.forEach(function(p) { var n = nomPays(p.p); (noms[n] = noms[n] || []).push(p); });
        Object.keys(ALIAS_PAYS).forEach(function(a) { if (s.indexOf(' ' + a + ' ') >= 0 && noms[ALIAS_PAYS[a]]) s += ALIAS_PAYS[a] + ' '; });
        var trouves = Object.keys(noms).sort(function(a, b) { return b.length - a.length; }).filter(function(n) { return s.indexOf(' ' + n + ' ') >= 0; });
        // « congo brazzaville » contient « congo » : on garde le plus précis.
        trouves = trouves.filter(function(n, i) { return !trouves.some(function(m, j) { return j !== i && m.length > n.length && m.indexOf(n) >= 0; }); });
        return trouves.map(function(n) { return noms[n]; });
    }
    var MOTS_NON_VILLE = ' payer paye rembourser avancer prevoir mettre faire remplir donner envoyer declarer saisir compter calculer toucher percevoir recevoir partir rester manger dormir loger combien tarif taux bareme forfait prix montant coute cout repas hotel hebergement nuit nuitee dormir logement chambre manger mission la le les l un une de du d pour par en a au aux sur pres vers est c ca quel quelle quels quelles je on il mon ma mes ce cette et ou paye payee rembourse remboursement euros euro france ville grande petite combien droit droits jour jours semaine stage formation ';
    function trouverVille(q, tarifs) {
        var s = normal(q), cp = (/ (\d{5}) /.exec(s) || [])[1] || '';
        if (/ paris /.test(s) || /^75\d{3}$/.test(cp)) return { nom: 'Paris', zone: 'PARIS' };
        for (var i = 0; i < tarifs.grandesVilles.length; i++) { var g = normal(tarifs.grandesVilles[i]).trim(); if (s.indexOf(' ' + g + ' ') >= 0) return { nom: titre(g), zone: 'GRANDE' }; }
        if (/^(92|93|94)\d{3}$/.test(cp)) return { nom: 'Commune ' + cp, zone: 'GRANDE' };
        var m = / (?:a|au|aux|sur|vers|pres de|sur place a) ((?:[a-z]+ ){1,3})/.exec(s.replace(/ (?:hotel|logement|repas|nuit|nuitee|chambre)s? /g, ' | '));
        if (m) {
            var mots = m[1].trim().split(' '), garde = [];
            for (var k = 0; k < mots.length && MOTS_NON_VILLE.indexOf(' ' + mots[k] + ' ') < 0; k++) garde.push(mots[k]);
            if (garde.length && garde.join('').length >= 3) return { nom: titre(garde.join(' ')) + (cp ? ' (' + cp + ')' : ''), zone: 'PETITE' };
        }
        if (cp) return { nom: 'Commune ' + cp, zone: 'PETITE' };
        return null;
    }
    function repondreTarif(q, tarifs, change, dateChange) {
        var s = normal(q), etq = 'Barème utilisé par TRIGONE Compte-rendu — l\'assistant Chorus DT fait foi';
        var H = tarifs.hebergementFrance, R = tarifs.repasFrance, veutRepas = /repas|manger|dejeuner|diner/.test(s), veutNuit = /hebergement|hotel|nuit|dormir|logement|chambre/.test(s);
        var deux = !veutRepas && !veutNuit;
        if (OUTRE_MER.test(s)) return { html: 'L\'<b>outre-mer</b> a ses propres barèmes, qui ne sont pas dans TRIGONE : demandez à votre <b>assistant Chorus DT</b>.', etq: etq };
        var pays = trouverPays(q, tarifs);
        if (pays.length) {
            var html = pays.map(function(variantes) {
                return variantes.map(function(p) {
                    var t = change[p.d], jour = t != null ? p.m * t : null, devise = p.d === 'EURO';
                    var lignes = '<b>' + esc(p.p) + '</b> : indemnité journalière ' + nombre(p.m) + ' ' + esc(devise ? '€' : p.d.toLowerCase()) + (devise || jour == null ? '' : ' ≈ ' + euros(jour));
                    if (jour == null) return lignes + '<br><small>Taux de change inconnu pour cette devise.</small>';
                    return lignes + '<br>' + (deux || veutRepas ? '• Repas : <b>' + euros(jour * tarifs.coefRepas) + '</b> (' + String(Math.round(tarifs.coefRepas * 1000) / 10).replace('.', ',') + ' % de l\'indemnité)<br>' : '') +
                        (deux || veutNuit ? '• Nuit : <b>' + euros(jour * tarifs.coefHebergement) + '</b> (' + String(Math.round(tarifs.coefHebergement * 1000) / 10).replace('.', ',') + ' %)' : '');
                }).join('<br>');
            }).join('<br><br>');
            var conv = pays.some(function(v) { return v.some(function(p) { return p.d !== 'EURO'; }); });
            return { html: html + '<br><small>Les repas pris pendant le trajet (avant l\'arrivée ou après le départ du site) restent au taux France : ' + euros(R) + '.' +
                (conv ? ' Conversion en euros : ' + esc(dateChange || 'taux de référence de TRIGONE') + '.' : '') + '</small>', etq: etq };
        }
        if (/ (etranger|international|internationale|pays|hors de france) /.test(s)) {
            var exemples = ['ALLEMAGNE', 'ESPAGNE', 'ITALIE', 'BELGIQUE'].map(function(n) { var p = tarifs.pays.filter(function(x) { return x.p === n; })[0]; return p ? '• ' + titre(n.toLowerCase()) + ' : ' + nombre(p.m) + ' €/jour → repas ' + euros(p.m * tarifs.coefRepas) + ', nuit ' + euros(p.m * tarifs.coefHebergement) : ''; }).filter(Boolean).join('<br>');
            return { html: 'À l\'étranger, tout dépend du <b>pays</b> : une <b>indemnité journalière</b> par pays, dont <b>' + String(Math.round(tarifs.coefRepas * 1000) / 10).replace('.', ',') + ' %</b> par repas et <b>' +
                String(Math.round(tarifs.coefHebergement * 1000) / 10).replace('.', ',') + ' %</b> par nuit. Par exemple :<br>' + exemples + '<br><small>Dites-moi le pays (« indemnités en Espagne », « hôtel au Sénégal ») : ' + tarifs.pays.length + ' pays sont dans TRIGONE.</small>', etq: etq };
        }
        var v = trouverVille(q, tarifs);
        var bareme = '• Paris : <b>' + euros(H.PARIS) + '</b> la nuit<br>• Grandes villes (Marseille, Lyon, Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille, Rennes) et communes du Grand Paris : <b>' + euros(H.GRANDE) + '</b><br>• Autres villes : <b>' + euros(H.PETITE) + '</b>';
        if (v) {
            var z = { PARIS: 'Paris', GRANDE: 'grande ville', PETITE: 'autre ville' }[v.zone];
            return { html: '<b>' + esc(v.nom) + '</b>' + (v.zone === 'PARIS' ? '' : ' (' + z + ')') + ' :<br>' + (deux || veutNuit ? '• Hébergement : <b>' + euros(H[v.zone]) + '</b> la nuit<br>' : '') + (deux || veutRepas ? '• Repas : <b>' + euros(R) + '</b> le repas<br>' : '') +
                (v.zone === 'PETITE' ? '<small>Sauf si c\'est une commune de la métropole du Grand Paris (' + euros(H.GRANDE) + ').</small>' : ''), etq: etq };
        }
        return { html: 'En France :<br>' + (deux || veutRepas ? '• Repas : <b>' + euros(R) + '</b> le repas (midi ou soir, payé)<br>' : '') + (deux || veutNuit ? 'Hébergement :<br>' + bareme + '<br>' : '') +
            '<small>Donnez-moi une ville (« hôtel à Lyon ») ou un pays (« repas en Allemagne ») pour le montant exact.</small>', etq: etq };
    }

    // ---------- Indemnités kilométriques : barème selon la puissance fiscale, distance entre deux villes ----------
    var MOTS_IK = / (ik|i k|indemnites? kilometriques?|frais kilometriques?|frais km|kilometriques?|kilometrage|kilometres?|km|bornes|vehicule perso(nnel)?|voiture perso(nnelle)?|vl perso|vlp|ma voiture|ma caisse|ma bagnole|mon vehicule|en voiture|par la route|essence|gasoil|gazole|carburant|chevaux|cv) /;
    var VIDES_VILLE = / (en|avec|pour|par|ma|mon|une|un|voiture|vehicule|caisse|bagnole|perso|personnel|personnelle|aller|retour|simple|ik|km|cv|chevaux|combien|rembourse|remboursement|frais|kilometriques?|indemnites?|ca|fait|faire|coute|je|vais|toucher|touche|on|est|il|y|a|de|du|des|et|distance|entre|trajet|la route|svp|stp)$/;
    function puissance(q) {
        var m = / (\d{1,2}) ?(?:cv|ch|chevaux|c v)\b/.exec(normal(q));
        if (!m) return '';
        var n = +m[1]; return n <= 5 ? '5cv' : n <= 7 ? '6-7cv' : '8cv';
    }
    // « entre Libourne et Bordeaux », « de Libourne à Bordeaux », « Libourne - Bordeaux » → { de, a }.
    function villesIk(q) {
        var s = normal(q).replace(/ (\d{1,2}) ?(?:cv|ch|chevaux|c v) /g, ' ').replace(/ (aller retour|aller simple|a r|ar) /g, ' ').replace(/ (combien de temps|de temps|de jours|du temps) /g, ' ');
        var m = / entre (.+?) et (.+) $/.exec(s + ' ') || /^.* (?:de|depuis|du) ([a-z][a-z0-9 ]*?) (?:a|au|aux|jusqu a|vers|pour) ([a-z][a-z0-9 ]*) $/.exec(s + ' ');
        if (!m) { var t = String(q).split(/\s+(?:-|–|→|>)\s+/); if (t.length === 2) m = [null, normal(t[0]).trim().split(' ').slice(-3).join(' '), normal(t[1]).trim().split(' ').slice(0, 3).join(' ')]; }
        if (!m) return null;
        var nettoyer = function(v) {
            var mots = (' ' + v + ' ').trim().split(' '), garde = [];
            // on retire les mots qui ne sont pas un nom de ville, au début et à la fin
            while (mots.length && VIDES_VILLE.test(' ' + mots[0])) mots.shift();
            while (mots.length && VIDES_VILLE.test(' ' + mots[mots.length - 1])) mots.pop();
            mots.forEach(function(x) { garde.push(x); });
            return garde.join(' ').trim();
        };
        var de = nettoyer(m[1]), a = nettoyer(m[2]);
        return de.length >= 2 && a.length >= 2 ? { de: de, a: a } : null;
    }
    function tauxIk(tarifs, perso) { return Object.assign({}, tarifs.ik || {}, perso || {}); }
    var NOMS_CV = { '5cv': '5 CV et moins', '6-7cv': '6 à 7 CV', '8cv': '8 CV et plus' };
    // km : distance par la route (null si inconnue) ; erreurDistance : pourquoi elle manque.
    function repondreIk(q, tarifs, persoTaux, km, erreurDistance) {
        var taux = tauxIk(tarifs, persoTaux), cv = puissance(q), v = villesIk(q), etq = 'Barème kilométrique de TRIGONE Compte-rendu — l\'assistant Chorus DT fait foi';
        var lignes = function(dist) {
            return (cv ? [cv] : ['5cv', '6-7cv', '8cv']).map(function(k) {
                return '• ' + NOMS_CV[k] + ' : ' + (dist != null ? nombre(dist) + ' km × ' + String(taux[k].toFixed(2)).replace('.', ',') + ' € = <b>' + euros(dist * taux[k]) + '</b>' : '<b>' + String(taux[k].toFixed(2)).replace('.', ',') + ' €</b> le km');
            }).join('<br>');
        };
        if (v && km != null) {
            return { html: '<b>' + esc(titre(v.de)) + ' → ' + esc(titre(v.a)) + '</b> : <b>' + nombre(km) + ' km</b> par la route.<br>Aller simple :<br>' + lignes(km) + '<br>Aller-retour (' + nombre(km * 2) + ' km) :<br>' + lignes(km * 2) +
                (cv ? '' : '<small>Dites-moi la puissance de votre véhicule (« 5 CV », « 7 chevaux ») pour le montant exact ; elle est sur la carte grise (case P.6).</small>') +
                '<small>Distance de l\'itinéraire le plus rapide (Géoplateforme de l\'IGN). Les péages et parkings se déclarent à part, avec leurs justificatifs.</small>', etq: etq, ik: { de: v.de, a: v.a, cv: cv } };
        }
        return { html: (v ? 'Je n\'ai pas pu calculer la distance <b>' + esc(titre(v.de)) + ' → ' + esc(titre(v.a)) + '</b>' + (erreurDistance ? ' (' + esc(erreurDistance) + ')' : '') + '. ' : '') +
            'Indemnités kilométriques (véhicule personnel) :<br>' + lignes(null) + '<br><small>' + (v ? 'Vérifiez l\'orthographe des villes (ou ajoutez le code postal), ou réessayez avec du réseau.' :
            'Donnez-moi le trajet, par exemple « IK entre Libourne et Bordeaux en 5 CV » : je calcule la distance et le montant.') + ' Barème : ' + esc(tarifs.ikDate || '') + '.</small>', etq: etq, ik: v ? { de: v.de, a: v.a, cv: cv } : null };
    }

    function intention(q, tarifs) {
        var s = normal(q);
        if (CODE_FD.test(q)) return 'fd';
        // IK : mots du kilométrique (« IK », « bornes », « ma caisse », « 5 CV »…) avec une question de montant ou un trajet.
        var trajet = villesIk(q);
        if (MOTS_IK.test(s) && (FORT.test(s) || / combien | distance | entre /.test(s) || trajet)) return 'ik';
        if (trajet && (FORT.test(s) || / combien /.test(s)) && !trouverPays(q, tarifs || { pays: [] }).length) return 'ik';
        if (MOTS_FD.test(s) && motsRecherche(q).length) return 'fd';
        // « donne-moi les codes d'imputation pour une mission » (sans unité ni objet) : les codes de l'unité du profil ; « où mettre le code FD ? » reste une question sur l'écran.
        if (MOTS_FD.test(s) && / (codes|donne|donnez|quel|quels|quelle|liste|lister|pour une mission|pour ma mission|pour un deplacement) /.test(s) && !/ (ou|comment|onglet|trouve|trouver|mettre|saisir|remplir|rentrer|taper|sert|signifie|veut dire) /.test(s)) return 'fd';
        // « le code du 3rpima », « imputation du 6e régiment du génie » : un mot de code et une unité numérotée.
        if (/ (code|codes|imputation|imputer|engagement) /.test(s)) { var u = unites(s), m = / \d{1,3} ([a-z]{2,8}) /.exec(u); if (m && SIGLES_CONNUS.indexOf(' ' + m[1] + ' ') >= 0) return 'fd'; }
        var combien = / combien /.test(s) && !/ combien de (repas|nuit|nuits|nuitee|nuitees|jours?) /.test(s);
        if ((FORT.test(s) || combien) && (SUJET.test(s) || OUTRE_MER.test(s))) return 'tarif';
        // « prix à Lyon », « combien à Paris », « tarif Lyon » : le barème de la ville (grande ville connue, ou question courte).
        if ((FORT.test(s) || / combien | c est combien | ca coute | quel prix /.test(s)) && !MOTS_FD.test(s) && tarifs) { var vq = trouverVille(q, tarifs); if (vq && (vq.zone !== 'PETITE' || s.trim().split(' ').length <= 5)) return 'tarif'; }
        // Un pays cité (« Espagne », « mission en Espagne », « indemnisation Italie ») : son barème.
        if (tarifs && trouverPays(q, tarifs).length) return 'tarif';
        return null;
    }
    // ---------- Questions de suite : « et en Italie ? » après « combien coûte un repas en Espagne » ----------
    // La question courte qui commence par « et », « pareil », « aussi »… reprend le sujet de la précédente.
    function estSuite(q) {
        var s = normal(q).trim();
        if (/^(et|pareil|idem|meme chose|aussi|puis|sinon|ok et|d accord et|bon et|alors et|mais|ou)( |$)/.test(s) || / (aussi|pareil|idem)$/.test(s)) return true;
        // Message court sans sujet à lui (« en Italie ? », « formation ») : c'est une suite. « indemnités aux USA » n'en est pas une.
        var n = ' ' + s + ' ';
        return s.split(' ').length <= 3 && !FORT.test(n) && !SUJET.test(n) && !MOTS_FD.test(n) && !CODE_FD.test(q) && !/ combien /.test(n);
    }
    var OBJETS = ['formation', 'intervention', 'entrainement', 'fonctionnement', 'courant', 'changement', 'residence', 'mission', 'missions', 'deplacement', 'deplacements', 'bagage', 'mobilier', 'permanents', 'instruction'];
    function completer(precedent, q, tarifs) {
        var nouveau = normal(q).trim().replace(/^(et|pareil|idem|meme chose|aussi|puis|sinon|ok et|d accord et|bon et|alors et|mais|ou)( (pour|pour le|pour la|pour les|a|au|aux|en|de|du|dans|sur))? /, '').replace(/ (aussi|pareil|idem)$/, '');
        if (precedent.type === 'tarif') {
            var p = normal(precedent.q), n = ' ' + nouveau + ' ';
            // Plausible seulement avec un pays, un lieu introduit (« à Bourges », « en Italie », « 33000 ») ou un autre sujet.
            var lieuIntroduit = /^(a|au|aux|en|pour|sur|dans|vers|de|du) /.test(normal(q).trim().replace(/^(et|pareil|idem|aussi|puis|sinon|ok et|bon et|alors et|mais|ou) /, '') + ' ');
            // Une ville seule : « et Marseille », « et Nogent le Rotrou » (avec « et »), ou une grande ville connue (« Marseille ? ») ; pas « blanquette ».
            var grande = tarifs && (/^paris$/.test(nouveau) || tarifs.grandesVilles.some(function(g) { return normal(g).trim() === nouveau; }));
            var villeSeule = (grande || /^(et|pareil|idem|aussi|puis|sinon|ok et|bon et|alors et|mais|ou) /.test(normal(q).trim() + ' ')) && /^[a-z][a-z ]*$/.test(nouveau) && nouveau.split(' ').length <= 3 && !/ (combien|prix|tarif|code|fd|ik|km|cv) /.test(n);
            if (!(tarifs && trouverPays(q, tarifs).length) && !lieuIntroduit && !villeSeule && !/ \d{5} /.test(n) && !/ paris /.test(n) &&
                !/repas|manger|dejeuner|diner|hebergement|hotel|nuit|dormir|logement|chambre/.test(n)) return null;
            var sujetN = /repas|manger|dejeuner|diner|hebergement|hotel|nuit|dormir|logement|chambre/.test(n);
            // Même lieu, autre sujet (« pareil pour une nuit ») : on reprend le pays ou la ville d'avant.
            if (sujetN && tarifs && !trouverPays(q, tarifs).length && !trouverVille(q, tarifs)) {
                var pays = trouverPays(precedent.q, tarifs), ville = trouverVille(precedent.q, tarifs);
                var lieu = pays.length ? nomPays(pays[0][0].p) : ville ? normal(ville.nom).trim() : '';
                if (lieu) return ('combien ' + nouveau + ' a ' + lieu).trim();
            }
            var sujet = sujetN ? '' : /repas|manger|dejeuner|diner/.test(p) && !/hebergement|hotel|nuit|dormir|logement|chambre/.test(p) ? 'combien coute un repas' :
                /hebergement|hotel|nuit|dormir|logement|chambre/.test(p) && !/repas|manger|dejeuner|diner/.test(p) ? 'combien coute une nuit d hotel' : 'combien coute le repas et la nuit';
            return (sujet + ' a ' + nouveau).trim();
        }
        if (precedent.type === 'ik' && precedent.ik) {
            var ik = precedent.ik, cvN = puissance(q), nv = nouveau.replace(/\b(\d{1,2}) ?(cv|ch|chevaux)\b/, '').replace(/^(a|au|aux|pour|vers|jusqu a) /, '').trim();
            var cvTxt = cvN ? (cvN === '5cv' ? '5' : cvN === '6-7cv' ? '7' : '8') : ik.cv ? (ik.cv === '5cv' ? '5' : ik.cv === '6-7cv' ? '7' : '8') : '';
            if (!cvN && !nv) return null;
            var arrivee = nv && !/^(retour|aller|aller retour)$/.test(nv) ? nv : ik.a;
            return 'ik entre ' + ik.de + ' et ' + arrivee + (cvTxt ? ' ' + cvTxt + ' cv' : '');
        }
        if (precedent.type === 'fd') {
            var avant = motsRecherche(precedent.q), apres = motsRecherche(q).filter(function(m) { return ['et', 'aussi', 'pareil', 'idem', 'pour', 'sinon'].indexOf(m) < 0; });
            var objet = function(m) { return OBJETS.indexOf(m) >= 0; };
            // Plausible seulement avec un objet de mission, un numéro d'unité ou un nom d'unité (« et intervention », « et pour le 7 »).
            if (!apres.length || !apres.every(function(m) { return objet(m) || /^\d+$/.test(m) || /^(uiisc|riisc|rsc|ensoa|emat|drhat)$/.test(m) || SIGLES_CONNUS.indexOf(' ' + m + ' ') >= 0; })) return null;
            if (apres.some(objet)) avant = avant.filter(function(m) { return !objet(m); });
            if (apres.some(function(m) { return !objet(m); })) avant = avant.filter(objet);
            return 'code fd ' + avant.concat(apres).join(' ');
        }
        return (precedent.q + ' ' + nouveau).trim();
    }
    var DONNEES = { villesIk: villesIk, puissance: puissance, ik: repondreIk, estSuite: estSuite, completer: completer, intention: intention, codier: repondreCodier, tarif: repondreTarif, trouverPays: trouverPays, trouverVille: trouverVille, normal: normal };
    if (typeof module !== 'undefined' && module.exports) module.exports = DONNEES;
    else window.AIDE_DONNEES = DONNEES;
})();
