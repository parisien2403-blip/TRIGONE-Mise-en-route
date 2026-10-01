// Écran de choix (logos en grand, état de chaque appli, espace Assistant Chorus DT) et logo tricolore des PDF.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), erreurs = [];
    async function ouvrir(vp, avant) {
        const p = await (await b.newContext({ viewport: vp })).newPage();
        p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
        await p.goto(srv.url); await p.evaluate(preparer, APP_CODE); await p.evaluate(avant || (() => {}));
        await p.reload(); await attendre(3000);
        if (!(await p.$('.JUM-CHOIX'))) { await p.evaluate(() => JUMELAGE_CHOIX()); await attendre(500); }
        return p;
    }
    // Missionnaire sur téléphone : deux espaces, l'état sous chaque logo.
    const t = await ouvrir({ width: 390, height: 844 }, () => {
        localStorage.setItem('trigone_suivi', JSON.stringify({ a1: { genre: 'mer', etape: 'val2', le: Date.now() } }));
        localStorage.setItem('mission_data', JSON.stringify({ DEBUT: '29/09/2026 07:40' }));
    });
    const e = await t.evaluate(() => ({ v2: !!document.querySelector('.JUM-CHOIX.JUM-V2'), pans: document.querySelectorAll('.JUM-CHOIX .JUM-PAN').length,
        mer: document.querySelector('.JUM-PAN-MER .JUM-ETAT').textContent, cr: document.querySelector('.JUM-PAN-CR .JUM-ETAT').textContent,
        empile: document.querySelector('.JUM-PAN-CR').getBoundingClientRect().top >= document.querySelector('.JUM-PAN-MER').getBoundingClientRect().bottom - 1 }));
    verifier(e.v2 && e.pans === 2 && e.empile, 'écran de choix (téléphone) : Mise en route en haut, Compte-rendu en bas');
    verifier(e.mer === 'Demande chez le VALIDEUR 2' && /^Mission en cours depuis le 29\/09\/2026$/.test(e.cr), 'état sous chaque logo : « ' + e.mer + ' », « ' + e.cr + ' »');
    await t.click('.JUM-PAN-CR .JUM-SOUS'); await attendre(1500);
    verifier(/\/cr\/$/.test(t.url()), 'un toucher sur l\'espace Compte-rendu ouvre Compte-rendu');
    // Assistant Chorus DT sur PC : trois colonnes, ses compteurs.
    const c = await ouvrir({ width: 1440, height: 900 }, () => {
        localStorage.setItem('trigone_role_chorus', '1');
        localStorage.setItem('trigone_boite', JSON.stringify([{ id: 'x1', nature: 'chorus', statut: 'nouveau', n: 3 }, { id: 'x2', nature: 'cr', statut: 'nouveau' }, { id: 'x3', nature: 'cr', statut: 'traite' }]));
    });
    const k = await c.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        return { cols: r('.JUM-PAN-MER').right <= r('.JUM-PAN-CR').left + 4 && r('.JUM-PAN-CR').right <= r('.JUM-PAN-CHORUS').left + 4,
            dem: document.querySelector('.JUM-CPT-L[data-cpt="chorus"] b').textContent, cr: document.querySelector('.JUM-CPT-L[data-cpt="cr"] b').textContent };
    });
    verifier(k.cols && k.dem === '3' && k.cr === '1', 'assistant Chorus DT (PC) : trois colonnes, 3 demandes validées et 1 compte-rendu à traiter');
    // Logo tricolore dans le bandeau du PDF de demande.
    await c.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1')); await c.reload(); await attendre(2500);
    const pdf = await c.evaluate(() => { const d = GENERER_PDF([DEMO_DEMANDE()]); return { pages: d.getNumberOfPages(), image: /\/Subtype \/Image/.test(d.output()) }; });
    verifier(pdf.image && pdf.pages === 1, 'PDF de demande : logo tricolore dans le bandeau, toujours une seule page');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
