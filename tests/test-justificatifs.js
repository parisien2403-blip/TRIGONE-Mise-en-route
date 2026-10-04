// Justificatifs reçus par mail : adresse prénom.nom@trigone-app.com, pièces jointes PDF / photos gardées, chiffrées pour
// les appareils du missionnaire, rangées dans Boîte de réception › Justificatifs, jointes au compte-rendu en un geste.
// Le serveur de test (wrangler dev) simule l'arrivée d'un mail : POST /cdn-cgi/handler/email.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], suffixe = Date.now().toString(36).slice(-5);
    const NOM = 'JUSTIF' + suffixe.toUpperCase();
    async function appareil(mail, nom) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 900 } }), p = await ctx.newPage();
        p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
        await p.goto(URL); await p.evaluate(preparer, APP_CODE);
        await p.evaluate(n => { const r = JSON.parse(localStorage.getItem('trigone_reglages_communs')); r.nom = n; r.prenom = 'Essai'; r.matricule = ''; localStorage.setItem('trigone_reglages_communs', JSON.stringify(r)); sessionStorage.setItem('trigone_choix_fait', '1'); }, nom);
        await p.reload(); await attendre(2500);
        await p.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await p.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await p.fill('#JUM-C-MAIL', mail); await p.click('#JUM-C-ENVOI'); await attendre(1500);
        await p.click('#JUM-C-VALIDER'); await attendre(1500);
        await p.evaluate(() => JUMELAGE_FERMER_COMPTE());
        return p;
    }
    const mailM = 'justif.' + suffixe + '@interieur.gouv.fr';
    const m = await appareil(mailM, NOM), h = await appareil('homonyme.' + suffixe + '@interieur.gouv.fr', NOM);
    const adr = await m.evaluate(() => JUMELAGE_ADRESSE(true)), adr2 = await h.evaluate(() => JUMELAGE_ADRESSE(true));
    const attendue = 'essai.' + NOM.toLowerCase();
    verifier(adr === attendue + '@trigone-app.com', 'adresse simple prénom.nom : ' + adr);
    verifier(adr2 === attendue + '2@trigone-app.com', 'homonyme : ' + adr2);
    // Mails simulés (MIME) : texte + PDF + photo.
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n').toString('base64');
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const mime = (de, a, sujet, parties) => { const bd = 'bord' + Math.random().toString(36).slice(2);
        return ['Received: from test', 'From: ' + de, 'To: ' + a, 'Subject: ' + sujet, 'Message-ID: <' + Math.random() + '@test>', 'Date: ' + new Date().toUTCString(), 'MIME-Version: 1.0',
            'Content-Type: multipart/mixed; boundary="' + bd + '"', '', ...parties.map(x => '--' + bd + '\r\n' + x), '--' + bd + '--', ''].join('\r\n'); };
    const texte = 'Content-Type: text/plain; charset=utf-8\r\n\r\nVotre billet est en pièce jointe.';
    const pdf = n => 'Content-Type: application/pdf; name="' + n + '"\r\nContent-Disposition: attachment; filename="' + n + '"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + PDF;
    const png = 'Content-Type: image/png; name="facture.png"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + PNG;
    const envoyerMail = (deEnv, a, corps) => fetch(URL + 'cdn-cgi/handler/email?from=' + encodeURIComponent(deEnv) + '&to=' + encodeURIComponent(a), { method: 'POST', body: corps }).then(async r => ({ statut: r.status, texte: await r.text() }));
    const r1 = await envoyerMail('noreply@sncf-connect.com', adr, mime('SNCF Connect <noreply@sncf-connect.com>', adr, '=?utf-8?B?' + Buffer.from('Votre billet électronique').toString('base64') + '?=', [texte, pdf('Mon_Billet_Paris.pdf')]));
    const r2 = await envoyerMail('reservation@hotel-du-port.fr', adr, mime('Hôtel du Port <reservation@hotel-du-port.fr>', adr, 'Facture', [texte, png]));
    const fwd = mime(mailM, adr, 'TR: Facture', [texte, 'Content-Type: message/rfc822\r\n\r\n' + mime('Hotel <compta@autre-hotel.fr>', mailM, 'Facture', [pdf('facture_hotel.pdf')])]);
    const r3 = await envoyerMail(mailM, adr, fwd);
    const r4 = await envoyerMail('x@exemple.fr', adr, mime('x@exemple.fr', adr, 'Sans pièce', [texte]));
    const r5 = await envoyerMail('x@exemple.fr', 'personne.inconnue@trigone-app.com', mime('x@exemple.fr', 'personne.inconnue@trigone-app.com', 'Test', [pdf('a.pdf')]));
    verifier(!/rejected/i.test(r1.texte) && !/rejected/i.test(r2.texte) && !/rejected/i.test(r3.texte), 'mails avec pièces jointes acceptés (' + [r1, r2, r3].map(x => x.statut).join('/') + ')');
    verifier(/Aucune pièce jointe/.test(r4.texte), 'mail sans pièce jointe : refusé avec un motif');
    verifier(/inconnue/.test(r5.texte), 'adresse inconnue : refusée');
    // Relève : trois envois « justificatif », chiffrés pour cet appareil.
    await m.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
    const l = await m.evaluate(() => JUMELAGE_BOITE_LISTE().filter(x => x.nature === 'justif').map(x => ({ id: x.id, de: x.noms, sujet: x.objet, verifie: x.verifie, transfere: x.transfere, f: (x.fichiers || []).map(f => f.nom) })));
    const sncf = l.find(x => /SNCF/.test(x.de)), hotel = l.find(x => /Port/.test(x.de)), tr = l.find(x => x.transfere);
    verifier(l.length === 3, 'boîte : trois justificatifs reçus (' + l.length + ')');
    verifier(sncf && sncf.verifie && sncf.f[0] === 'Mon_Billet_Paris.pdf' && sncf.sujet === 'Votre billet électronique', 'SNCF Connect : rangé directement, pièce jointe et objet décodés');
    verifier(hotel && !hotel.verifie && hotel.f[0] === 'facture.png', 'hôtel (expéditeur inconnu) : « à vérifier »');
    verifier(tr && tr.verifie && tr.f[0] === 'facture_hotel.pdf', 'mail transféré par le missionnaire (pièce jointe dans le message transféré) : rangé directement');
    const octets = await m.evaluate(id => JUMELAGE_JUSTIF_FICHIER(id, 0).then(f => f.text()), sncf.id);
    verifier(/^%PDF-1\.4/.test(octets), 'pièce jointe déchiffrée intacte sur l\'appareil');
    // Boîte de réception › Justificatifs.
    await m.evaluate(() => { SHOW_PAGE('RECEPTION'); OUVRIR_DOSSIER('RECEPTION', 'justif'); }); await attendre(600);
    const liste = await m.evaluate(() => document.querySelector('.CARD').textContent);
    await m.evaluate(id => MER_BX_OUVRIR('RECEPTION', id), hotel.id); await attendre(600);
    const lHotel = await m.evaluate(() => document.querySelector('.CARD').textContent);
    await m.evaluate(id => { MER_BX_SEL.RECEPTION = null; MER_BX_OUVRIR('RECEPTION', id); }, sncf.id); await attendre(600);
    const lSncf = await m.evaluate(() => document.querySelector('.CARD').textContent);
    verifier(/Justificatifs/.test(liste) && liste.indexOf(adr) >= 0 && /À vérifier/.test(lHotel) && /Mon_Billet_Paris\.pdf/.test(lSncf), 'dossier Justificatifs : adresse, pièces, « à vérifier »');
    await m.evaluate(id => { JUMELAGE_JUSTIF_VERIFIE(id); }, hotel.id);
    verifier(await m.evaluate(id => JUMELAGE_BOITE_LISTE().find(x => x.id === id).verifie, hotel.id), '« C\'est bien à moi » : justificatif gardé');
    // Envoi du compte-rendu : « Depuis ma boîte TRIGONE ».
    await m.evaluate(() => JUMELAGE_ENVOYER_CR({ destinataire: 'chorus@test.fr', pdf: () => ({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), nom: 'CR.pdf' }) })); await attendre(500);
    const vu = await m.evaluate(() => !!document.getElementById('JUM-CR-BOITE'));
    await m.click('#JUM-CR-BOITE'); await attendre(300);
    await m.click('.JUM-CR-BOITE label'); await m.click('#JUM-CR-BOITE-OK'); await attendre(600);
    const joint = await m.evaluate(() => document.querySelector('#JUM-CR-LISTE').textContent);
    verifier(vu && /\.(pdf|png)/.test(joint), 'compte-rendu : « 📥 Depuis ma boîte TRIGONE » joint le justificatif choisi');
    if (process.env.TRIGONE_CAPTURES) await m.screenshot({ path: process.env.TRIGONE_CAPTURES + '/justif-cr.png' });
    await m.evaluate(() => JUMELAGE_FERMER_ENVOI_CR());
    // Ma carte : l'adresse et le bouton « Copier ».
    await m.evaluate(() => JUMELAGE_CARTE()); await attendre(800);
    verifier(await m.evaluate(a => (document.querySelector('.JUM-ADRESSE') || {}).textContent.indexOf(a) >= 0, adr), 'Ma carte : adresse des justificatifs et bouton Copier');
    if (process.env.TRIGONE_CAPTURES) { await m.evaluate(() => document.querySelector('.JUM-ADRESSE').scrollIntoView()); await m.screenshot({ path: process.env.TRIGONE_CAPTURES + '/justif-carte.png' }); }
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
    await b.close();
};
