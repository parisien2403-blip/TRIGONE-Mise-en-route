// Outils communs aux tests de TRIGONE : petit serveur local, navigateur, pages préparées, vérifications.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..');
const FICHIERS = path.join(__dirname, 'fichiers');
const SORTIE = path.join(__dirname, 'sortie');
fs.mkdirSync(SORTIE, { recursive: true });

// Numéro de code actuel de Mise en route : sert à marquer « Nouveautés » comme vues (sinon le message bloque les clics).
const APP_CODE = +(/var APP_CODE_VERSION = (\d+)/.exec(fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8')) || [])[1];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css',
    '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };

// Sert le dossier de l'appli, comme GitHub Pages. dossier() permet de basculer vers une autre copie (test de mise à jour).
function serveur() {
    let dossier = RACINE;
    const s = http.createServer((req, res) => {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        let f = path.join(dossier, p);
        if (!f.startsWith(dossier)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
        if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        fs.createReadStream(f).pipe(res);
    });
    return new Promise(ok => s.listen(0, () => ok({
        url: 'http://localhost:' + s.address().port + '/',
        dossier: d => { dossier = d; },
        fermer: () => new Promise(r => s.close(r))
    })));
}

// Chromium de Playwright ; CHROMIUM_PATH permet d'en indiquer un autre.
function navigateur() {
    return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

// Premier lancement déjà fait : présentation, réglages communs et nouveautés marqués comme vus.
function preparer(appCode) {
    localStorage.setItem('trigone_presentation_jumelage_vue', '1');
    localStorage.setItem('mer_config_faite', '1');
    localStorage.setItem('mer_installation_proposee', '1');
    localStorage.setItem('trigone_premier_lancement_fait', '1');
    localStorage.setItem('trigone_nouveautes_vue', '9999');
    localStorage.setItem('mer_maj_vues', JSON.stringify({ appCode: appCode }));
    localStorage.setItem('trigone_derniere_sauvegarde', String(Date.now()));
    localStorage.setItem('trigone_reglages_communs', JSON.stringify({ unite: '4°RIISC', cie: '4CIE', grade: 'ADJ', nom: 'TEST', prenom: 'Essai',
        matricule: '067 50 10 191', mailVal1: 'chef@test.fr', monMail: 'moi@test.fr', mailChorus: 'chorus@test.fr' }));
}

const attendre = ms => new Promise(r => setTimeout(r, ms));

// Vérifications : chaque échec est compté ; le test continue pour tout montrer d'un coup.
let echecs = 0;
function verifier(condition, libelle) {
    console.log((condition ? '  ✔ ' : '  ✘ ') + libelle);
    if (!condition) echecs++;
}
function nombreEchecs() { return echecs; }

module.exports = { RACINE, FICHIERS, SORTIE, APP_CODE, serveur, navigateur, preparer, attendre, verifier, nombreEchecs };
