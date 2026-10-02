// Notice TRIGONE : livret à pages qui tournent (couverture, sommaire, chapitres, captures, sécurité), téléphone et PC.
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function(srv) {
    const b = await navigateur(), erreurs = [];
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', e => erreurs.push(e.message));
    const images = []; p.on('response', r => { if (/\/notice\/img\//.test(r.url()) && !r.ok()) images.push(r.url()); });
    await p.goto(srv.url); await p.evaluate(preparer, APP_CODE);
    await p.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
    await p.reload(); await attendre(2500);
    await p.evaluate(() => { const m = document.getElementById('MSG-OVERLAY'); if (m) m.style.display = 'none'; });
    // Paramètres › Aide › Notice TRIGONE
    await p.evaluate(() => JUMELAGE_PARAMETRES('aide')); await attendre(300);
    verifier(await p.evaluate(() => !!document.querySelector('.JUM-PARAM [data-action="notice"]')), 'Paramètres › Aide : ligne « Notice TRIGONE »');
    await p.click('.JUM-PARAM [data-action="notice"]'); await attendre(2500);
    const info = await p.evaluate(() => {
        const N = window.NOTICE_TRIGONE, f = document.querySelector('.JUM-NOTICE');
        return { ouvert: !!f, pages: N && N.pages.length, chap: N && N.chapitres.length, couv: !!document.querySelector('.n-couv h1'), titre: (document.querySelector('.n-couv h2') || {}).textContent,
            num: (document.querySelector('.N-NUM') || {}).textContent, flip: !!document.querySelector('.stf__parent'), secu: N && N.chapitres.some(c => c.id === 'secu') };
    });
    verifier(info.ouvert && info.flip, 'la notice s\'ouvre en livre (pages qui tournent)');
    verifier(info.couv && info.titre === 'Notice' && info.num === 'Couverture', 'couverture cuir « TRIGONE · Notice »');
    verifier(info.pages > 80 && info.pages % 2 === 0 && info.chap === 16 && info.secu, 'contenu : ' + info.pages + ' pages, 16 chapitres dont « Protection des données et hébergement »');
    // Aucune page ne déborde (format PC 566 et format téléphone allongé).
    const trop = await p.evaluate(() => {
        const N = window.NOTICE_TRIGONE, z = document.createElement('div'), r = []; z.style.cssText = 'position:fixed;left:-5000px;top:0'; document.body.appendChild(z);
        [[566, ''], [660, ' haut']].forEach(([h, c]) => N.pages.forEach((pg, i) => {
            z.innerHTML = '<div class="N-PAGE" style="position:relative;width:400px;height:' + h + 'px"><div class="N-ECH' + c + '" style="height:' + h + 'px">' + pg.html.replace(/\{B\}/g, '') + '</div></div>';
            const n = z.querySelector('.n-p'); if (n && n.scrollHeight > n.clientHeight + 1) r.push(h + ':' + (i + 1));
        }));
        z.remove(); return r;
    });
    verifier(!trop.length, 'aucune page ne déborde' + (trop.length ? ' : ' + trop.join(', ') : ''));
    // Tourner une page, puis le sommaire mène au chapitre
    await p.click('.N-SUIV'); await attendre(1600);
    verifier(await p.evaluate(() => document.querySelector('.N-NUM').textContent) === '2 / ' + info.pages, 'flèche › : page suivante');
    await p.click('.N-SOMMAIRE'); await attendre(1600);
    const cible = await p.evaluate(() => NOTICE_TRIGONE.chapitres.find(c => c.id === 'carte').page);
    await p.evaluate(() => document.querySelector('.n-som [data-aller="' + NOTICE_TRIGONE.chapitres.find(c => c.id === 'carte').page + '"]').click()); await attendre(1600);
    verifier(await p.evaluate(() => document.querySelector('.N-NUM').textContent) === (cible + 1) + ' / ' + info.pages, 'sommaire › « Ma carte TRIGONE » : page ' + (cible + 1));
    // Capture agrandie au toucher, retour du téléphone : ferme d'abord la capture, puis la notice
    await p.evaluate(() => document.querySelector('.JUM-NOTICE')._aller(28)); await attendre(800);
    await p.evaluate(() => [...document.querySelectorAll('.stf__item')].find(e => e.style.display !== 'none' && e.querySelector('[data-zoom]')).querySelector('[data-zoom]').click()); await attendre(300);
    verifier(await p.evaluate(() => !!document.querySelector('.N-ZOOM img')), 'capture touchée : affichée en grand');
    p.goBack().catch(() => {}); await attendre(600);
    verifier(await p.evaluate(() => !document.querySelector('.N-ZOOM') && !!document.querySelector('.JUM-NOTICE')), 'retour : la capture se ferme, la notice reste ouverte');
    await p.click('.N-FERMER'); await attendre(300);
    verifier(await p.evaluate(() => !document.querySelector('.JUM-NOTICE')), '✕ : la notice se ferme');
    // Ouverture directe sur un chapitre
    await p.evaluate(() => JUMELAGE_NOTICE('secu')); await attendre(1500);
    const secu = await p.evaluate(() => NOTICE_TRIGONE.chapitres.find(c => c.id === 'secu').page + 1);
    verifier(await p.evaluate(() => document.querySelector('.N-NUM').textContent) === secu + ' / ' + info.pages, 'JUMELAGE_NOTICE(\'secu\') : ouverte sur « Protection des données »');
    await p.evaluate(() => document.querySelector('.JUM-NOTICE')._fermer()); await attendre(300);
    // Compte-rendu : bouton « Notice TRIGONE » dans la page Notice, chemins des images corrects
    await p.goto(srv.url + 'cr/'); await attendre(2500);
    await p.evaluate(() => { const m = document.getElementById('MSG-OVERLAY'); if (m) m.style.display = 'none'; document.querySelectorAll('.JUM-CHOIX').forEach(e => e.remove()); OUVRIR_NOTICE_MENU(); }); await attendre(500);
    verifier(await p.evaluate(() => !!document.querySelector('#NOTICE-LIVRET .JUM-NOTICE-LIVRET')), 'Compte-rendu › Notice : bouton « Notice TRIGONE »');
    await p.click('#NOTICE-LIVRET .JUM-NOTICE-LIVRET'); await attendre(2500);
    verifier(await p.evaluate(() => /\.\.\/notice\/img\//.test(document.querySelector('.JUM-NOTICE [data-zoom]').getAttribute('data-zoom'))), 'Compte-rendu : captures chargées depuis ../notice/img');
    // PC : livre ouvert, deux pages
    const q = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); q.on('pageerror', e => erreurs.push(e.message));
    await q.goto(srv.url); await attendre(2000);
    await q.evaluate(() => JUMELAGE_NOTICE('cr')); await attendre(1800);
    const pc = await q.evaluate(() => [...document.querySelectorAll('.stf__item')].filter(e => e.style.display !== 'none').length);
    verifier(pc === 2, 'PC : le livre s\'ouvre en double page');
    verifier(!images.length, 'toutes les captures se chargent' + (images.length ? ' : ' + images.join(' ') : ''));
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
