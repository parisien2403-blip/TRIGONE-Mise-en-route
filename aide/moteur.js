// ===================== AIDE TRIGONE : MOTEUR DE RECHERCHE =====================
// Trouve la fiche de aide/base.json qui répond à une question tapée comme on parle : accents, fautes de frappe,
// langage SMS (« jpeux », « pk »), jargon militaire (« le juteux », « VL perso », « OM »). Sans réseau ni IA.
// Utilisé par aide.js (navigateur) et par les tests (Node).
(function() {
    function sansAccents(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function normal(s) { return ' ' + sansAccents(s).toLowerCase().replace(/[’'`´]/g, ' ').replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
    function racine(t) { return t.length > 4 && /[sx]$/.test(t) ? t.slice(0, -1) : t; }
    // Distance d'édition bornée (fautes de frappe).
    function distance(a, b, max) {
        if (Math.abs(a.length - b.length) > max) return max + 1;
        var prec = [], i, j;
        for (j = 0; j <= b.length; j++) prec[j] = j;
        for (i = 1; i <= a.length; i++) {
            var cour = [i], minLigne = i;
            for (j = 1; j <= b.length; j++) {
                cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (cour[j] < minLigne) minLigne = cour[j];
            }
            if (minLigne > max) return max + 1;
            prec = cour;
        }
        return prec[b.length];
    }
    function proche(a, b) {
        if (a === b) return 1;
        var n = Math.min(a.length, b.length);
        if (n >= 5 && a.slice(0, 5) === b.slice(0, 5)) return 0.8;   // conjugaisons : envoyer / envoyé / envoie
        if (n >= 4 && distance(a, b, 1) <= 1) return 0.8;
        if (n >= 7 && distance(a, b, 2) <= 2) return 0.7;
        return 0;
    }

    function creer(base) {
        var sms = base.sms || {}, vides = {};
        (base.vides || []).forEach(function(v) { vides[v] = 1; });
        // Jargon : chaque variante (normalisée) devient le mot retenu ; les plus longues d'abord.
        var variantes = [];
        (base.jargon || []).forEach(function(g) { g[1].concat([g[0]]).forEach(function(v) { variantes.push([normal(v).trim(), g[0]]); }); });
        variantes.sort(function(a, b) { return b[0].length - a[0].length; });
        var CANON = {}; (base.jargon || []).forEach(function(g) { CANON[g[0]] = 1; });
        function jetons(texte) {
            var s = normal(texte);
            s = ' ' + s.trim().split(' ').map(function(m) { return Object.prototype.hasOwnProperty.call(sms, m) ? sms[m] : m; }).join(' ') + ' ';
            s = normal(s);
            // Remplacement des expressions par leur mot retenu, sans retoucher un mot déjà remplacé.
            var faits = [];
            variantes.forEach(function(v) {
                if (!v[0]) return;
                var cle = ' ' + v[0] + ' ', i;
                while ((i = s.indexOf(cle)) >= 0) { s = s.slice(0, i) + ' \u0001' + faits.length + ' ' + s.slice(i + cle.length); faits.push(v[1]); }
            });
            var liste = [];
            s.trim().split(' ').forEach(function(m) {
                if (!m) return;
                if (m.charAt(0) === '\u0001') { liste.push(faits[+m.slice(1)]); return; }
                if (vides[m] || (m.length < 2 && !/\d/.test(m))) return;
                liste.push(racine(m));
            });
            return liste.filter(function(m, i) { return liste.indexOf(m) === i; });
        }
        // Index : jetons de chaque formulation (et du titre), poids selon la rareté (IDF par fiche).
        var fiches = base.fiches || [], df = {};
        var index = fiches.map(function(f) {
            var forms = [f.t].concat(f.q || []).map(jetons).filter(function(j) { return j.length; });
            var vus = {}; forms.forEach(function(j) { j.forEach(function(t) { vus[t] = 1; }); });
            Object.keys(vus).forEach(function(t) { df[t] = (df[t] || 0) + 1; });
            return { fiche: f, forms: forms };
        });
        var N = fiches.length || 1;
        function poids(t) { return df[t] ? Math.log(1 + N / df[t]) * (CANON[t] ? 1.15 : 1) : 0.6; }
        function meilleur(t, liste) {
            var m = 0;
            for (var i = 0; i < liste.length && m < 1; i++) { var p = CANON[t] || CANON[liste[i]] ? (t === liste[i] ? 1 : 0) : proche(t, liste[i]); if (p > m) m = p; }
            return m;
        }
        function noter(Q, F) {
            var pq = 0, tq = 0, pf = 0, tf = 0;
            Q.forEach(function(q) { var w = poids(q); tq += w; pq += w * meilleur(q, F); });
            F.forEach(function(t) { var w = poids(t); tf += w; pf += w * meilleur(t, Q); });
            var P = tq ? pq / tq : 0, R = tf ? pf / tf : 0;
            return P && R ? 2 * P * R / (P + R) : 0;
        }
        // contexte : { app: 'mer' | 'cr', ecran: id } — léger avantage aux fiches de l'écran ouvert.
        function chercher(question, contexte) {
            contexte = contexte || {};
            var Q = jetons(question);
            if (!Q.length) return { jetons: Q, resultats: [] };
            var res = index.map(function(x) {
                var s = 0;
                x.forms.forEach(function(F) { var n = noter(Q, F); if (n > s) s = n; });
                if (s > 0) {
                    if (contexte.ecran && (x.fiche.e || []).indexOf(contexte.ecran) >= 0) s += 0.04;
                    if (contexte.app && x.fiche.app === contexte.app) s += 0.02;
                }
                // Un seul mot ordinaire (« heure ») : trop peu pour répondre d'office, seulement proposer.
                if (Q.length === 1 && !CANON[Q[0]]) s = Math.min(s, MOTEUR.SUR - 0.01);
                return { fiche: x.fiche, score: Math.round(s * 1000) / 1000 };
            }).filter(function(r) { return r.score > 0; }).sort(function(a, b) { return b.score - a.score; });
            return { jetons: Q, resultats: res.slice(0, 5) };
        }
        return { chercher: chercher, jetons: jetons, fiche: function(id) { return fiches.filter(function(f) { return f.id === id; })[0] || null; } };
    }
    // Seuils : au-dessus de SUR, la mascotte répond ; entre PROPOSER et SUR, elle propose 2 ou 3 sujets.
    var MOTEUR = { creer: creer, SUR: 0.5, PROPOSER: 0.28, normal: normal };
    if (typeof module !== 'undefined' && module.exports) module.exports = MOTEUR;
    else window.AIDE_MOTEUR = MOTEUR;
})();
