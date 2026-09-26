// Code d'accès unique : demandé à l'ouverture de TRIGONE (les deux applis), ancien code de Compte-rendu accepté.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');
function hashCR(t) { let h = 0; for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0; return String(h); }

module.exports = async function(srv) {
    const b = await navigateur();
    for (const [nom, vue] of [['PC', { width: 1600, height: 900 }], ['téléphone', { width: 390, height: 844 }]]) {
        const ctx = await b.newContext({ viewport: vue, hasTouch: nom !== 'PC' });
        const p = await ctx.newPage();
        await p.goto(srv.url);
        await p.evaluate(preparer, APP_CODE);
        await p.evaluate(h => { localStorage.setItem('trigone_pin_hash', h); sessionStorage.clear(); }, hashCR('1234'));
        await p.reload(); await attendre(2500);
        verifier(await p.evaluate(() => !!document.querySelector('.JUM-PIN')), nom + ' : code demandé à l\'ouverture (Mise en route)');
        verifier(await p.evaluate(() => !!document.querySelector('.JUM-PIN-PC')) === (nom === 'PC'), nom + ' : écran de code ' + (nom === 'PC' ? 'PC' : 'téléphone'));
        await p.keyboard.type('9999'); await attendre(600);
        verifier((await p.evaluate(() => document.querySelector('.JUM-PIN-ERREUR').textContent)).includes('incorrect'), nom + ' : mauvais code refusé');
        await p.keyboard.type('1234'); await attendre(800);
        verifier(await p.evaluate(() => !document.querySelector('.JUM-PIN') && !!localStorage.getItem('trigone_code_commun') && !localStorage.getItem('trigone_pin_hash')),
            nom + ' : ancien code de Compte-rendu accepté et devenu le code TRIGONE');
        await p.goto(srv.url + 'cr/'); await attendre(2000);
        verifier(await p.evaluate(() => !document.querySelector('.JUM-PIN')), nom + ' : pas redemandé en passant à Compte-rendu');
        const p2 = await ctx.newPage(); await p2.goto(srv.url + 'cr/'); await attendre(2000);
        verifier(await p2.evaluate(() => !!document.querySelector('.JUM-PIN')), nom + ' : redemandé à une nouvelle ouverture (Compte-rendu)');
        await ctx.close();
    }
    await b.close();
};
