// Envoi au groupe : « Tous les assistants Chorus DT du 4RIISC » (assist-dt.4riisc@trigone-app.com). Chaque assistant de
// l'unité le reçoit, chiffré pour ses appareils ; le premier qui le traite le range « traité par … » chez les autres ; le
// suivi du demandeur avance quel que soit celui qui traite. Demande le serveur de test (TRIGONE_URL_BOITE).
const { APP_CODE, navigateur, preparer, attendre, verifier } = require('./outils');

module.exports = async function() {
    const URL = process.env.TRIGONE_URL_BOITE;
    if (!URL) { console.log('  (sauté : définissez TRIGONE_URL_BOITE)'); return; }
    const b = await navigateur(), erreurs = [], s = Date.now().toString(36);
    const L = s.toUpperCase().replace(/[^A-Z]/g, 'X'), GROUPE = 'assist-dt.4riisc@trigone-app.com';
    const MAILS = { M: 'mission.g' + s + '@interieur.gouv.fr', C1: 'assist1.g' + s + '@interieur.gouv.fr', C2: 'assist2.g' + s + '@interieur.gouv.fr', X: 'autre.g' + s + '@interieur.gouv.fr' };
    const api = (q, chemin, corps) => q.evaluate(([chemin, corps]) => { const k = JSON.parse(localStorage.getItem('trigone_compte') || '{}'); return fetch('api/' + chemin, { method: corps ? 'POST' : 'GET',
        headers: { Authorization: 'TRIGONE ' + encodeURIComponent(k.mail) + ' ' + k.appareil + ' ' + k.jeton, 'Content-Type': 'application/json', 'X-Trigone-Unite': '4RIISC' }, body: corps ? JSON.stringify(corps) : undefined }).then(r => r.json()); }, [chemin, corps]);
    async function appareil(nom, ident, role) {
        const ctx = await b.newContext({ viewport: { width: 480, height: 1000 } }), q = await ctx.newPage();
        q.on('pageerror', e => erreurs.push(nom + ' : ' + e.message)); q.on('dialog', d => d.accept());
        await q.goto(URL); await q.evaluate(preparer, APP_CODE); await q.evaluate(() => sessionStorage.setItem('trigone_choix_fait', '1'));
        await q.reload(); await attendre(2500);
        await q.evaluate(() => JUMELAGE_COMPTE()); await attendre(500);
        await q.click('.JUM-ACC-ONGLETS [data-mode="connecter"]'); await q.fill('#JUM-C-MAIL', MAILS[nom]); await q.click('#JUM-C-ENVOI'); await attendre(1500);
        await q.click('#JUM-C-VALIDER'); await attendre(2000);
        await q.evaluate(() => { JUMELAGE_FERMER_COMPTE(); document.querySelectorAll('.JUM-REGLAGES,.JUM-PARAM').forEach(e => e.remove()); });
        await api(q, 'unite', ident);
        if (role) { await api(q, 'roles', { ajouter: [role] }); await q.evaluate(() => localStorage.setItem('trigone_role_chorus', '1')); }
        return q;
    }
    const c1 = await appareil('C1', { grade: 'ADJ', nom: 'PREMIER' + L, prenom: 'Anne' }, 'chorus');
    const c2 = await appareil('C2', { grade: 'SGC', nom: 'SECOND' + L, prenom: 'Marc' }, 'chorus');
    const m = await appareil('M', { grade: 'CAL', nom: 'MISSION' + L, prenom: 'Léo' }, null);
    const ann = await api(m, 'annuaire?role=chorus');
    verifier(ann.groupe === GROUPE, 'annuaire : adresse du groupe des assistants Chorus DT de l\'unité (' + ann.groupe + ')');
    const cl = await api(m, 'cles?mail=' + encodeURIComponent(GROUPE));
    verifier(cl.compte && cl.membres >= 2 && /assistants Chorus DT du 4RIISC/.test(cl.groupe), 'groupe : ses membres (' + cl.membres + ') et leurs appareils pour le chiffrement');
    // Une question au groupe (contenu chiffré une fois, une enveloppe par appareil de chaque membre).
    const q = JSON.stringify({ app: 'TRIGONE-QUESTION', ref: 'r' + s, genre: 'registre', objet: 'OMR TEST', question: 'Où en est mon remboursement ?', qui: 'CAL MISSION' });
    const env = await m.evaluate(([g, t]) => JUMELAGE_ENVOYER_DIRECT(g, 'QUESTION', 'Question.json', t), [GROUPE, q]);
    verifier(env && env.id && env.membres >= 2, 'envoi au groupe : déposé pour ' + (env && env.membres) + ' assistants');
    await c1.evaluate(() => JUMELAGE_RELEVER()); await c2.evaluate(() => JUMELAGE_RELEVER()); await attendre(3500);
    const el = q2 => q2.evaluate(id => JSON.parse(localStorage.getItem('trigone_boite') || '[]').find(x => x.id === id), env.id);
    const e1 = await el(c1), e2 = await el(c2);
    verifier(e1 && e2 && e1.groupe === GROUPE && e2.groupe === GROUPE && e1.nature === 'question', 'chaque assistant le reçoit dans sa boîte, marqué « envoyé au groupe »');
    // Le premier le traite : rangé « traité par ADJ PREMIER… » chez l'autre.
    await c1.evaluate(id => { JUMELAGE_BOITE_MARQUER(id, 'traite'); return JUMELAGE_BOITE_ETATS(); }, env.id); await attendre(1200);
    await c2.evaluate(() => JUMELAGE_BOITE_ETATS()); await attendre(1500);
    const apres = await c2.evaluate(id => JSON.parse(localStorage.getItem('trigone_boite') || '[]').find(x => x.id === id), env.id);
    verifier(apres && apres.statut === 'traite' && /ADJ PREMIER/.test(apres.traitePar || ''), 'traité par le premier : rangé « traité par ' + (apres && apres.traitePar) + ' » chez l\'autre');
    // Compte-rendu au groupe : le suivi du missionnaire avance, quel que soit l'assistant qui le traite.
    const cr = await m.evaluate(g => JUMELAGE_ENVOYER_DIRECT(g, 'CR', 'CR.json', JSON.stringify({ test: 1 })), GROUPE);
    const t = await api(c2, 'suivi/traite', { envois: [cr.id], qui: 'SGC SECOND' });
    verifier(t.ok && t.n === 1, 'compte-rendu envoyé au groupe : traité par le 2e assistant, le suivi du missionnaire avance');
    // Hors du groupe : un compte sans le rôle ne reçoit rien, et un VALIDEUR 1 ne peut pas recevoir une demande « groupe Chorus ».
    const x = await appareil('X', { grade: 'SGT', nom: 'AUTRE' + L, prenom: 'Paul' }, null);
    await x.evaluate(() => JUMELAGE_RELEVER()); await attendre(2000);
    verifier(!(await x.evaluate(id => JSON.parse(localStorage.getItem('trigone_boite') || '[]').some(y => y.id === id), env.id)), 'un compte sans le rôle ne reçoit pas l\'envoi au groupe');
    const refus = await m.evaluate(g => JUMELAGE_ENVOYER_DIRECT(g, 'DEMANDE', 'D.json', '{}').then(() => 'ok', e => e.message), GROUPE);
    verifier(/ne va pas/.test(refus), 'une demande (pour le VALIDEUR 1) refusée vers le groupe des assistants');
    verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await b.close();
};
