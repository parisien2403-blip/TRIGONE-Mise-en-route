// Sans réseau : les deux applis s'ouvrent (même Compte-rendu jamais ouvert), gardent leur police, et tout le
// parcours de Mise en route (demande, valideurs, Chorus DT) fonctionne.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');
const parcours = require('./test-parcours');

module.exports = async function(srv) {
    const b = await navigateur();
    const ctx = await b.newContext({ viewport: { width: 400, height: 820 } });
    const p = await ctx.newPage();
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.reload(); await p.evaluate(() => navigator.serviceWorker.ready); await attendre(3000);
    await ctx.setOffline(true);
    for (const u of ['', 'cr/']) {
        await p.goto(srv.url + u).catch(() => {}); await attendre(3000);
        const r = await p.evaluate(async () => { await document.fonts.ready; return { texte: document.body.innerText.length > 50,
            police: [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Montserrat' && f.status === 'loaded') }; }).catch(() => ({}));
        verifier(!!r.texte, (u ? 'Compte-rendu' : 'Mise en route') + ' s\'ouvre sans réseau' + (u ? ' (jamais ouvert avant)' : ''));
        verifier(!!r.police, (u ? 'Compte-rendu' : 'Mise en route') + ' garde la police Montserrat sans réseau');
        verifier(await p.evaluate(() => /Hors réseau/i.test((document.querySelector('.JUM-HORS-RESEAU') || {}).textContent || '') && !document.querySelector('.NETWORK-BANNER:not(.HIDDEN)')),
            (u ? 'Compte-rendu' : 'Mise en route') + ' : pastille « Hors réseau » (une seule, pas de bandeau rouge)');
    }
    await ctx.setOffline(false); await attendre(800);
    verifier(await p.evaluate(() => !document.querySelector('.JUM-HORS-RESEAU') && /Réseau revenu/.test((document.querySelector('.JUM-BANDEAU') || {}).textContent || '')), 'retour du réseau : la pastille disparaît, « Réseau revenu »');
    await b.close();
    await parcours(srv, { horsLigne: true });
};
