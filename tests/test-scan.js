// Justificatifs photographiés « scannés » : recadrés sur la feuille, fond blanc, texte foncé, bien plus légers, en PDF
// (Compte-rendu). Photo qui remplit déjà le cadre : pas de recadrage. La photo d'origine reste disponible.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext(), erreurs = [];
    await ctx.addInitScript(preparer, APP_CODE);
    const p = await ctx.newPage(); p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(srv.url + 'cr/'); await attendre(2500);
    const r = await p.evaluate(async () => {
        const lire = async n => new File([await (await fetch('../tests/fichiers/' + n)).blob()], n, { type: 'image/jpeg' });
        const facture = await lire('facture-photo.jpg'), daf = await lire('daf_test.jpg');
        const j = await JUMELAGE_SCANNER_PHOTO(facture), pdf = await JUMELAGE_SCANNER_PHOTO(facture, { pdf: true }), d = await JUMELAGE_SCANNER_PHOTO(daf);
        const bm = await createImageBitmap(j), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
        const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
        // coin haut droit de la feuille (dans l'ombre sur la photo) : blanc après le scan
        const coin = g.getImageData(Math.round(bm.width * 0.9), Math.round(bm.height * 0.5), 1, 1).data[0];
        const txt = await pdf.slice(0, 5).text();
        return { taille: facture.size, jpg: j.size, pdf: pdf.size, type: pdf.type, entete: txt, recadre: j.recadre, largeur: bm.width, hauteur: bm.height, coin,
            origine: pdf.origine === facture, dafRecadre: d.recadre, dafScanne: d.scanne };
    });
    verifier(r.recadre && Math.abs(r.largeur / r.hauteur - 1900 / 2700) < 0.03, 'photo d\'une facture sur une table : recadrée sur la feuille (' + r.largeur + ' × ' + r.hauteur + ' px)');
    verifier(r.coin > 235, 'ombre sur la feuille effacée : le fond devient blanc (' + r.coin + ')');
    verifier(r.type === 'application/pdf' && r.entete === '%PDF-' && r.pdf < r.taille * 0.15, 'Compte-rendu : justificatif en PDF, ' + Math.round(r.taille / 1024) + ' Ko → ' + Math.round(r.pdf / 1024) + ' Ko');
    verifier(r.origine, 'la photo d\'origine reste disponible (bouton « photo d\'origine »)');
    verifier(r.dafScanne && !r.dafRecadre, 'photo qui remplit déjà le cadre : scannée sans recadrage');
    // Justificatif en couleur : un tampon bleu sur une feuille blanche reste bleu après le scan.
    const coul = await p.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
        const g = c.getContext('2d'); g.fillStyle = '#6b5b4b'; g.fillRect(0, 0, 900, 1200);
        g.fillStyle = '#f2efe8'; g.fillRect(120, 120, 660, 960);
        g.fillStyle = '#1f3fbf'; g.fillRect(300, 500, 300, 160);
        g.fillStyle = '#222'; g.fillRect(200, 250, 500, 30);
        const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.95));
        const s = await JUMELAGE_SCANNER_PHOTO(new File([blob], 'tampon.jpg', { type: 'image/jpeg' }));
        const bm = await createImageBitmap(s), k = document.createElement('canvas'); k.width = bm.width; k.height = bm.height;
        const h = k.getContext('2d'); h.drawImage(bm, 0, 0);
        const px = h.getImageData(Math.round(bm.width * 0.5), Math.round(bm.height * (580 - 120) / 960), 1, 1).data;
        const fond = h.getImageData(Math.round(bm.width * 0.1), Math.round(bm.height * 0.9), 1, 1).data;
        return { r: px[0], g: px[1], b: px[2], fond: [fond[0], fond[1], fond[2]] };
    });
    verifier(coul.b > coul.r + 80 && coul.b > coul.g + 60 && coul.fond.every(v => v > 230), 'scan en couleur : tampon bleu gardé bleu (' + [coul.r, coul.g, coul.b].join(',') + '), fond blanc');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
