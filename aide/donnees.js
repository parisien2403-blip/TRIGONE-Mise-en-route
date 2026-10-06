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
    var MOTS_FD = / (code fd|codes fd|code d engagement|codes d engagement|code engagement|fd ligne|fd@ligne|fdligne|codier|fd) /;
    var FORT = / (tarif|tarifs|taux|bareme|baremes|forfait|forfaits|prix|montant|montants|coute|coutent|cout|couts|euro|euros|indemnite|indemnites|indemnise|rembourse|remboursee|remboursement|plafond|droit|droits) /;
    var SUJET = / (repas|manger|dejeuner|diner|hebergement|hotel|hotels|nuit|nuits|nuitee|nuitees|dormir|logement|chambre|journalier|journaliere|etranger|pays) /;
    var OUTRE_MER = / (reunion|guadeloupe|martinique|guyane|mayotte|nouvelle caledonie|polynesie|tahiti|saint pierre et miquelon|wallis|saint martin|saint barthelemy|dom tom|outre mer|dom) /;

    // ---------- Codier FD ----------
    var vides = {}; ('le la les l un une des de du d j je tu il on nous vous mon ma mes ton ta tes son sa ses notre votre leur ce cet cette ces ca c est a au aux en et ou que qu qui quoi quel quelle quels quelles ' +
        'est sont suis ai as avez pour par sur dans avec sans chez donne donner trouver trouve cherche connaitre connais savoir sais veux voudrais besoin stp svp merci bonjour salut moi me m faut il y pas ne n ' +
        'code codes fd fds codier engagement ligne numero unite regiment imputation imputer mettre mets met utiliser utilise').split(' ').forEach(function(m) { vides[m] = 1; });
    var indexCodier = null;
    function preparerCodier(codier) {
        if (indexCodier && indexCodier.src === codier) return indexCodier;
        var liste = [];
        Object.keys(codier).forEach(function(k) { var v = codier[k]; if (k.charAt(0) !== '_' && v && v.lib) liste.push({ code: k, v: v, mots: normal(v.lib).trim().split(' ') }); });
        indexCodier = { src: codier, liste: liste };
        return indexCodier;
    }
    function motsRecherche(q) {
        var s = normal(q)
            .replace(/ (\d+) ?(?:e|eme|er|ere|ieme)? ?(?:riisc|uiisc|rsc) /g, ' uiisc $1 ').replace(/ (?:riisc|uiisc|rsc) ?(?:n|no|numero)? ?(\d+) /g, ' uiisc $1 ')
            .replace(/ uiisc(\d+) /g, ' uiisc $1 ').replace(/ stages? /g, ' formation ').replace(/ entrainements? /g, ' entrainement ').replace(/ interventions? /g, ' intervention ');
        return s.trim().split(' ').filter(function(m) { return m && !vides[m] && !CODE_FD.test(m); });
    }
    function ligneCode(code, v) {
        return '<div class="AIDE-CODE"><b>' + esc(code) + '</b> <button type="button" class="AIDE-LIEN" data-copier="' + esc(code) + '">Copier</button><br>' + esc(v.lib) +
            (v.cf ? '<small>Centre financier ' + esc(v.cf) + ' · centre de coût ' + esc(v.cc || '') + ' · activité ' + esc(v.act || '') + '</small>' : '') + '</div>';
    }
    function repondreCodier(q, codier) {
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
        var mots = motsRecherche(q);
        if (!mots.length) return null;
        var idx = preparerCodier(codier), meilleurs = [], best = 0;
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
        var n = meilleurs.length;
        return { html: (n === 1 ? 'Dans le codier FD :' : n + ' codes FD correspondent' + (n > 8 ? ' (les 8 premiers ; précisez l\'objet : formation, intervention, entraînement…)' : '') + ' :') +
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
    var MOTS_NON_VILLE = ' combien tarif taux bareme forfait prix montant coute cout repas hotel hebergement nuit nuitee dormir logement chambre manger mission la le les l un une de du d pour par en a au aux sur pres vers est c ca quel quelle quels quelles je on il mon ma mes ce cette et ou paye payee rembourse remboursement euros euro france ville grande petite combien droit droits jour jours semaine stage formation ';
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

    function intention(q, tarifs) {
        var s = normal(q);
        if (CODE_FD.test(q)) return 'fd';
        if (MOTS_FD.test(s) && motsRecherche(q).length) return 'fd';
        var combien = / combien /.test(s) && !/ combien de (repas|nuit|nuits|nuitee|nuitees|jours?) /.test(s);
        if ((FORT.test(s) || combien) && (SUJET.test(s) || OUTRE_MER.test(s))) return 'tarif';
        if (tarifs && (FORT.test(s) || combien || SUJET.test(s)) && trouverPays(q, tarifs).length) return 'tarif';
        return null;
    }
    var DONNEES = { intention: intention, codier: repondreCodier, tarif: repondreTarif, trouverPays: trouverPays, trouverVille: trouverVille, normal: normal };
    if (typeof module !== 'undefined' && module.exports) module.exports = DONNEES;
    else window.AIDE_DONNEES = DONNEES;
})();
