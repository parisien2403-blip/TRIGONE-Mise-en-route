// Fabrique aide/tarifs.json à partir des barèmes de Compte-rendu (cr/index.html), pour que la mascotte d'aide réponde
// sur les forfaits repas et hébergement (France et étranger) sans IA ni réseau. À relancer après toute modification
// des barèmes de Compte-rendu :  node aide/extraire-tarifs.js   (la suite de tests « aide » vérifie la concordance).
const fs = require('fs'), path = require('path');
const cr = fs.readFileSync(path.join(__dirname, '..', 'cr', 'index.html'), 'utf8');
function extraire(re, nom) { const m = cr.match(re); if (!m) throw new Error('Introuvable dans cr/index.html : ' + nom); return m[1]; }
// Littéraux JavaScript du dépôt lui-même (barèmes de Compte-rendu), relus tels quels.
const litteral = s => new Function('return ' + s)();
const pays = litteral(extraire(/var COUNTRY_MISSION_RATES = (\[.*?\]);/, 'COUNTRY_MISSION_RATES'));
const change = JSON.parse(extraire(/var DEFAULT_EXCHANGE_RATES = (\{.*?\});/, 'DEFAULT_EXCHANGE_RATES'));
const grandesVilles = litteral(extraire(/var GRANDES_VILLES_FR = (\[.*?\]);/, 'GRANDES_VILLES_FR'));
const m = cr.match(/return J && J\.V === 'GRANDE' \? (\d+) : \(J && J\.V === 'PARIS' \? (\d+) : (\d+)\);/);
if (!m) throw new Error('Introuvable dans cr/index.html : hébergement France');
const tarifs = {
    _lisezMoi: 'Fabriqué par aide/extraire-tarifs.js à partir de cr/index.html : ne pas modifier à la main.',
    repasFrance: +extraire(/if \(!S\.MISSION_ETRANGER \|\| !S\.PAYS_MISSION\) return (\d+);/, 'repas France'),
    hebergementFrance: { PARIS: +m[2], GRANDE: +m[1], PETITE: +m[3] },
    grandesVilles,
    coefRepas: +extraire(/function GET_REPAS_RATE_EUR[\s\S]*?montantJour \* ([\d.]+) \* 100/, 'coefficient repas'),
    coefHebergement: +extraire(/function GET_HEBERG_RATE_EUR[\s\S]*?montantJour \* ([\d.]+) \* 100/, 'coefficient hébergement'),
    pays, change
};
fs.writeFileSync(path.join(__dirname, 'tarifs.json'), JSON.stringify(tarifs, null, 1) + '\n');
console.log('aide/tarifs.json : ' + pays.length + ' pays, ' + Object.keys(change).length + ' devises, repas ' + tarifs.repasFrance + ' €, hébergement ' + JSON.stringify(tarifs.hebergementFrance) + ', coefficients ' + tarifs.coefRepas + ' / ' + tarifs.coefHebergement);
