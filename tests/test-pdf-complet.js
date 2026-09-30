// Assistant Chorus DT : le compte-rendu reçu et ses justificatifs (PDF, photos) réunis en un seul PDF, à la suite.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), ctx = await b.newContext({ acceptDownloads: true }), erreurs = [];
    await ctx.addInitScript(preparer, APP_CODE);
    const p = await ctx.newPage(); p.on('pageerror', e => erreurs.push(e.message));
    await p.goto(srv.url); await attendre(2500);
    const r = await p.evaluate(async () => {
        const b64 = async blob => B64(await blob.arrayBuffer());
        const pdf = n => { const d = new window.jspdf.jsPDF(); for (let i = 1; i < n; i++) d.addPage(); return d.output('blob'); };
        const photo = await (await fetch('tests/fichiers/facture-photo.jpg')).blob();
        const cr = { app: 'TRIGONE-CR', missionnaire: 'SGT DURAND Léa', fichiers: [
            { nom: 'CR_DURAND.pdf', type: 'application/pdf', b64: await b64(pdf(2)) },
            { nom: 'billet.pdf', type: 'application/pdf', b64: await b64(pdf(1)) },
            { nom: 'facture.jpg', type: 'image/jpeg', b64: await b64(photo) },
            { nom: 'abime.pdf', type: 'application/pdf', b64: btoa('pas un pdf') }] };
        const octets = await MER_CR_PDF_UNIQUE(cr);
        await CHARGER_PDFLIB();
        const doc = await PDFLib.PDFDocument.load(octets);
        // Téléchargement « ⬇ PDF complet » depuis la fenêtre du compte-rendu.
        let nom = '', taille = 0;
        window.TELECHARGER_OCTETS = (n, o) => { nom = n; taille = o.length; };
        MER_CR_OUVERT = { id: 'x', cr };
        PDF_COMPLET_CR(true);
        for (let i = 0; i < 50 && !nom; i++) await new Promise(ok => setTimeout(ok, 100));
        return { pages: doc.getPageCount(), entete: String.fromCharCode.apply(null, octets.slice(0, 5)), nom, taille };
    });
    verifier(r.entete === '%PDF-' && r.pages === 4, 'un seul PDF : compte-rendu (2 p.) + billet (1 p.) + photo (1 p.), justificatif abîmé écarté (' + r.pages + ' pages)');
    verifier(r.nom === 'CR_DURAND + justificatifs.pdf' && r.taille > 1000, '« ⬇ PDF complet » : un seul fichier téléchargé (' + r.nom + ')');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs[0] : ''));
    await b.close();
};
