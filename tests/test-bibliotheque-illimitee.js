// Bibliothèques sans limite de nombre (Mise en route : plus de 50 envois ; Compte-rendu : plus de 3 comptes-rendus),
// indication de la mémoire utilisée, et message clair quand la mémoire de TRIGONE est pleine.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), erreurs = [];
    const p = await b.newPage({ viewport: { width: 480, height: 1000 } }); p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await p.reload(); await attendre(2500);
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); for (let i = 0; i < 60; i++) { const d = DEMO_DEMANDE(); d.id = 'b' + i; ARCHIVER_ENVOI([d], 'chef@test.fr', 'e' + i); } SHOW_PAGE('BIBLIOTHEQUE'); });
    await attendre(500);
    verifier(await p.evaluate(() => GET_BIBLIOTHEQUE().length) === 60, 'Mise en route : les 60 demandes envoyées sont gardées (plus de limite à 50)');
    verifier(/60 demandes gardées sur cet appareil · mémoire de TRIGONE utilisée : \d+ %/.test(await p.evaluate(() => document.querySelector('.MER-BIB-MEMOIRE').textContent)), 'Mise en route : nombre gardé et mémoire utilisée affichés');
    // Mémoire pleine : message, rien de cassé.
    await p.evaluate(() => { const s = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'mer_bibliotheque') { const e = new Error('plein'); e.name = 'QuotaExceededError'; throw e; } return s.call(this, k, v); }; ARCHIVER_ENVOI([DEMO_DEMANDE()], 'x@y.fr', 'trop'); Storage.prototype.setItem = s; });
    await attendre(300);
    verifier(await p.evaluate(() => /Mémoire pleine/.test(document.getElementById('MSG-TITRE').textContent) && GET_BIBLIOTHEQUE().length === 60), 'mémoire pleine : message « Mémoire pleine », rien de perdu');
    await p.evaluate(() => FERMER_MSG());
    // Compte-rendu : plus de 3 comptes-rendus gardés.
    await p.goto(srv.url + 'cr/'); await attendre(2500);
    await p.evaluate(() => { document.querySelectorAll('.JUM-CHOIX,.JUM-NOUV').forEach(e => e.remove()); document.documentElement.classList.remove('jum-choix');
        for (let i = 1; i <= 6; i++) { M.DEBUT = '0' + i + '/09/2026 08:00:00'; M.USER = 'DURAND'; SAVE_TO_BIBLIOTHEQUE('Compte-rendu ' + i); }
        OUVRIR_BIBLIOTHEQUE(); });
    await attendre(600);
    verifier(await p.evaluate(() => GET_BIBLIOTHEQUE().length) === 6, 'Compte-rendu : les 6 comptes-rendus sont gardés (plus de limite à 3)');
    verifier(/6 comptes-rendus gardés/.test(await p.evaluate(() => document.getElementById('BIB-SOUS-TITRE').textContent)), 'Compte-rendu : nombre gardé et mémoire utilisée affichés');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
