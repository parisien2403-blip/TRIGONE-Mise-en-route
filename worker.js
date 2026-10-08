// TRIGONE — serveur Cloudflare : sert l'appli (fichiers statiques) et la boîte aux lettres /api/…
//
// Boîte aux lettres : chaque personne a un compte TRIGONE à son adresse prenom.nom@trigone-app.com (sans adresse mail
// personnelle, validé par un responsable de l'unité). Chaque appareil du compte a sa propre clé de chiffrement : la clé
// privée ne quitte jamais l'appareil, le serveur ne garde que la clé publique. Les demandes sont chiffrées dans l'appli
// de l'expéditeur pour les appareils du destinataire : ce serveur ne voit que des données illisibles, et les supprime à
// la réception (au plus tard après 30 jours). Aucun mail n'est envoyé (plus de service d'envoi de mails).
//
// Stockage (Workers KV, liaison TRIGONE_KV) :
//   compte:<mail>              { appareils: [{ id, cle (JWK publique), jeton (empreinte), nom, cree }] }
//   code:<mail>                { empreinte, essais }                      — 15 min
//   limite:<mail>              nombre de codes demandés                   — 1 h
//   msg:<id>                   { iv, ct } contenu chiffré                 — 30 jours
//   sauvegarde:<mail>          sauvegarde automatique, chiffrée sur l'appareil avec une clé tirée du code de récupération
//                              de l'utilisateur (jamais transmis) : octets illisibles + { sel, iv, le, taille }
//   D1 (TRIGONE_DB), table boite : une ligne par envoi et par appareil destinataire (clé enveloppée, de, type, date)
//
// Réglages (Cloudflare › Workers › trigone-mise-en-route › Paramètres › Variables et secrets) :
//   DOMAINES_AUTORISES          ex. « interieur.gouv.fr » (sous-domaines compris), séparés par des virgules
//   MODE_TEST = "1"             tests locaux uniquement : connexion d'essai par adresse mail (code renvoyé)
//   ADMIN_MAILS                 adresse(s) de l'administrateur, séparées par des virgules : seule(s) à voir la page
//                               « Erreurs de l'appli » (Paramètres › Aide) ; administrateur de toutes les unités
//   CODE_ADMIN (secret)         code du rôle ADMINISTRATEUR (un par unité : celui qui le saisit devient administrateur
//                               de l'unité de son profil). Vérifié ici, jamais dans l'appli ni dans le dépôt.


const JOUR = 86400;
const ROLES = ['valideur1', 'valideur2', 'chorus'];
// Type d'envoi → rôle exigé du destinataire (REFUS : retour au demandeur, tout compte ; CR : compte-rendu de fin de
// mission du missionnaire, pour l'assistant Chorus DT).
// RENVOI : demande renvoyée par le VALIDEUR 2 au VALIDEUR 1 (à corriger, revalider ou refuser au demandeur).
// COLLECTIVE : compte-rendu de mission collective envoyé par le chef de mission à un participant (tout compte).
// QUESTION : question d'un valideur ou de l'assistant Chorus DT au missionnaire sur sa demande / son compte-rendu, sans
// la refuser ; REPONSE : sa réponse (tout compte, dans les deux sens).
const ROLE_REQUIS = { DEMANDE: 'valideur1', VALIDATION_1: 'valideur2', CHORUS: 'chorus', REFUS: '', CR: 'chorus', RENVOI: 'valideur1', COLLECTIVE: '', QUESTION: '', REPONSE: '' };
const MESSAGE_ROLE = {
    valideur1: 'n\'est pas enregistré comme VALIDEUR 1 dans TRIGONE : vérifiez l\'adresse du 1er valideur. (Un VALIDEUR 1 est enregistré dès qu\'il coche son rôle dans Réglages › Mes rôles, avec son code ; s\'il l\'a déjà coché, il lui suffit d\'ouvrir TRIGONE sur son appareil, puis de réessayer.)',
    valideur2: 'n\'est pas enregistré comme VALIDEUR 2 dans TRIGONE : vérifiez l\'adresse du 2e valideur. (Un VALIDEUR 2 est enregistré dès qu\'il coche son rôle dans Réglages › Mes rôles, avec son code ; s\'il l\'a déjà coché, il lui suffit d\'ouvrir TRIGONE sur son appareil, puis de réessayer.)',
    chorus: 'n\'est pas enregistré comme ASSIST CHORUS DT dans TRIGONE : vérifiez l\'adresse de l\'assistant Chorus DT. (Il est enregistré dès qu\'il coche son rôle dans Réglages › Mes rôles, avec son code ; s\'il l\'a déjà coché, il lui suffit d\'ouvrir TRIGONE sur son appareil, puis de réessayer.)'
};
const DUREE_MESSAGE = 30 * JOUR;
const TAILLE_MAX = 24 * 1024 * 1024;   // limite d'une valeur Workers KV : 25 Mo

// Index des boîtes aux lettres dans D1 (liaison TRIGONE_DB, base SQLite de Cloudflare) : cohérent et sans limite de
// « list » ; le contenu chiffré reste dans KV (msg:<id>), une ligne D1 par appareil destinataire.
let TABLES_PRETES = false;
// ---------- Lectures à jour ----------
// Le KV de Cloudflare peut renvoyer l'ancienne valeur jusqu'à une minute après une écriture faite depuis un autre point
// du réseau (rôle ajouté, photo publiée, carte, appareil lié, absence… pas encore vus des autres). Chaque écriture est donc
// doublée dans D1 (table kv_frais, lue telle qu'écrite à l'instant) et lue en premier ; le KV reste la référence pour ce
// qui n'a jamais été écrit depuis, pour les gros fichiers (sauvegardes) et les taux de change.
const KV_FRAIS_HORS = /^(sauvegarde:|taux:)/;
function kvFrais(env) {
    const kv = env.TRIGONE_KV, db = env.TRIGONE_DB;
    if (!kv || !db || kv.__frais) return kv;
    const ecrire = async (k, v, exp) => {
        await baseBoite(env);
        await db.prepare('INSERT INTO kv_frais (cle, valeur, expire) VALUES (?, ?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur, expire = excluded.expire').bind(k, v, exp).run();
    };
    return {
        __frais: true,
        get: async (k, type) => {
            const t = type && typeof type === 'object' ? type.type : type;
            if (KV_FRAIS_HORS.test(k) || (t && t !== 'text' && t !== 'json')) return kv.get(k, type);
            let r;
            try { await baseBoite(env); r = await db.prepare('SELECT valeur, expire FROM kv_frais WHERE cle = ?').bind(k).first(); } catch (e) { r = undefined; }
            if (!r) return kv.get(k, type);                                   // jamais écrit depuis : le KV
            if (r.valeur === null || (r.expire && r.expire < Date.now())) return null;   // effacé ou expiré
            if (t === 'json') { try { return JSON.parse(r.valeur); } catch (e) { return null; } }
            return r.valeur;
        },
        put: async (k, v, opts) => {
            await kv.put(k, v, opts);
            try {
                if (KV_FRAIS_HORS.test(k) || typeof v !== 'string' || v.length > 900000) await db.prepare('DELETE FROM kv_frais WHERE cle = ?').bind(k).run();
                else await ecrire(k, v, opts && opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : opts && opts.expiration ? opts.expiration * 1000 : null);
            } catch (e) {}
        },
        delete: async (k) => { await kv.delete(k); try { await ecrire(k, null, 1); } catch (e) {} },
        list: (o) => kv.list(o),
        getWithMetadata: (k, t) => kv.getWithMetadata(k, t)
    };
}
function avecKvFrais(env) {
    if (!env || !env.TRIGONE_KV || !env.TRIGONE_DB || env.TRIGONE_KV.__frais) return env;
    const e = Object.create(env); e.TRIGONE_KV = kvFrais(env); return e;
}
async function baseBoite(env) {
    if (!TABLES_PRETES) {
        await env.TRIGONE_DB.batch([
            // Copie à jour du KV (voir kvFrais) : ce qui vient d'être écrit se relit tout de suite, partout.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS kv_frais (cle TEXT PRIMARY KEY, valeur TEXT, expire INTEGER)'),
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS boite (id TEXT NOT NULL, dest TEXT NOT NULL, appareil TEXT NOT NULL, de TEXT, type TEXT, le INTEGER, enveloppe TEXT, PRIMARY KEY (id, appareil))'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS boite_dest ON boite (dest, appareil)'),
            // Abonnements aux notifications, un par appareil : table à part (écriture simple et cohérente, jamais
            // écrasée par une autre mise à jour du compte).
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS abonnement (mail TEXT NOT NULL, appareil TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, le INTEGER, PRIMARY KEY (mail, appareil))'),
            // Suivi des demandes et des comptes-rendus (voir « Suivi » plus bas) : une ligne par demande (ref = identifiant
            // de la demande) ou par compte-rendu (ref = identifiant de l'envoi). Rien du contenu, seulement l'étape.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS suivi (ref TEXT NOT NULL, demandeur TEXT NOT NULL, genre TEXT, etape TEXT, detenteur TEXT, envoi TEXT, le INTEGER, relance INTEGER, etapes TEXT, PRIMARY KEY (ref, demandeur))'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS suivi_detenteur ON suivi (detenteur, etape)'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS suivi_envoi ON suivi (envoi)'),
            // Intervenants d'une demande (valideurs, assistant Chorus DT) : ils en voient aussi la suite.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS suivi_acteur (ref TEXT NOT NULL, demandeur TEXT NOT NULL, mail TEXT NOT NULL, PRIMARY KEY (ref, demandeur, mail))'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS suivi_acteur_mail ON suivi_acteur (mail)'),
            // Appareils dont l'utilisateur a coupé les notifications (ex. téléphone, quand le PC suffit au bureau).
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS muet (mail TEXT NOT NULL, appareil TEXT NOT NULL, PRIMARY KEY (mail, appareil))'),
            // Rappels « départ en mission » : l'heure seule (le contenu de la demande reste chiffré, inconnu du serveur).
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS rappel (ref TEXT NOT NULL, mail TEXT NOT NULL, quand INTEGER NOT NULL, envoye INTEGER, PRIMARY KEY (ref, mail))'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS rappel_quand ON rappel (quand)'),
            // Erreurs techniques remontées par les applis, anonymes (ni nom, ni mail, ni donnée de mission) et
            // regroupées par signature ; appareils comptés par un identifiant au hasard. Effacées après 30 jours.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS erreur (sig TEXT PRIMARY KEY, app TEXT, ecran TEXT, msg TEXT, src TEXT, pile TEXT, v INTEGER, ua TEXT, n INTEGER, premier INTEGER, dernier INTEGER)'),
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS erreur_appareil (sig TEXT NOT NULL, appareil TEXT NOT NULL, PRIMARY KEY (sig, appareil))'),
            // Missions collectives : quels participants ont envoyé leur compte-rendu (référence de la mission, adresses,
            // date d'envoi ; rien du contenu). Visible du seul chef de mission ; effacé après 90 jours.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS equipe (ref TEXT NOT NULL, mail TEXT NOT NULL, chef TEXT NOT NULL, recu INTEGER, envoye INTEGER, relance INTEGER, PRIMARY KEY (ref, mail))'),
            // Assistants Chorus DT qui ont reçu un compte-rendu de la mission : ils voient aussi le suivi de l'équipe.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS equipe_lecteur (ref TEXT NOT NULL, mail TEXT NOT NULL, le INTEGER, PRIMARY KEY (ref, mail))'),
            // Registre OMR partagé par les assistants Chorus DT d'une unité : une ligne par demande (donnees = JSON),
            // supprime = 1 pour une ligne retirée (mission annulée), gardée pour que les autres appareils la retirent aussi.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS registre (unite TEXT NOT NULL, ref TEXT NOT NULL, omr TEXT, mref TEXT, donnees TEXT, maj INTEGER, supprime INTEGER DEFAULT 0, par TEXT, PRIMARY KEY (unite, ref))'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS registre_maj ON registre (unite, maj)'),
            // Missions ouvertes aux participants (« Me rattacher à une mission ») : code à 6 chiffres donné par le chef de
            // mission ; resume = ce que voit celui qui tape le code (objet, lieu, dates, transport) ; etat : ouverte,
            // envoyee (demande partie aux valideurs : liste figée), annulee. Effacées 60 jours après leur expiration.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS mission (code TEXT PRIMARY KEY, chef TEXT NOT NULL, unite TEXT, resume TEXT, etat TEXT, cree INTEGER, expire INTEGER, ref TEXT, motif TEXT, maj INTEGER)'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS mission_chef ON mission (chef)'),
            // Personnes rattachées : identité reprise de leur carte TRIGONE (ident = JSON) ; statut : membre, parti
            // (détaché lui-même), retire (retiré par le chef : il ne peut pas revenir avec ce code).
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS rattache (code TEXT NOT NULL, mail TEXT NOT NULL, chef TEXT NOT NULL, ident TEXT, statut TEXT, le INTEGER, PRIMARY KEY (code, mail))'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS rattache_mail ON rattache (mail)'),
            // État des envois de la boîte, commun aux appareils d'un même compte (traité sur le PC → traité sur le téléphone).
            // Rien du contenu : identifiant de l'envoi, statut, date.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS boite_etat (mail TEXT NOT NULL, id TEXT NOT NULL, statut TEXT, le INTEGER, maj INTEGER, PRIMARY KEY (mail, id))'),
            // Envois au groupe (tous les VALIDEUR 2 ou tous les assistants Chorus DT d'une unité) : qui les a reçus, qui les a traités.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS groupe_envoi (id TEXT PRIMARY KEY, groupe TEXT, membres TEXT, pris_par TEXT, pris_qui TEXT, pris_le INTEGER, maj INTEGER)'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS boite_etat_maj ON boite_etat (mail, maj)'),
            // Comptes qui ont un rôle (VALIDEUR 1 / 2, ASSIST CHORUS DT) : à qui remettre la clé des photos de carte partagées.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS porteur_role (mail TEXT PRIMARY KEY, roles TEXT, maj INTEGER)'),
            // Administrateurs d'unité (rôle ADMINISTRATEUR, code vérifié par le serveur).
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS admin_unite (mail TEXT PRIMARY KEY, unite TEXT NOT NULL, le INTEGER)'),
            // Demandes de réinitialisation ou de suppression d'un compte, adressées à l'assistant Chorus DT ou à
            // l'administrateur de l'unité. dest : adresses (JSON) qui peuvent décider.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS compte_demande (id TEXT PRIMARY KEY, mail TEXT NOT NULL, qui TEXT, type TEXT NOT NULL, motif TEXT, unite TEXT, dest TEXT, le INTEGER, statut TEXT, par TEXT, decideLe INTEGER)'),
            // Trace des comptes supprimés : jamais l'adresse (seulement son empreinte), qui, quand, pourquoi.
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS compte_journal (le INTEGER, unite TEXT, par TEXT, motif TEXT, empreinte TEXT, qui TEXT, brevo TEXT)'),
            // Comptes d'une unité (écran de l'administrateur) : identité, adresse TRIGONE, statut (attente, actif, bloque).
            env.TRIGONE_DB.prepare('CREATE TABLE IF NOT EXISTS compte_unite (mail TEXT PRIMARY KEY, unite TEXT, grade TEXT, nom TEXT, prenom TEXT, adresse TEXT, statut TEXT, le INTEGER, par TEXT, maj INTEGER)'),
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS compte_unite_u ON compte_unite (unite, statut)')
        ]);
        TABLES_PRETES = true;
    }
    return env.TRIGONE_DB;
}

// ---------- Comptes : administrateurs d'unité, suppression complète ----------
function egal(a, b) { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; }
async function adminUnite(env, mail) { const r = await (await baseBoite(env)).prepare('SELECT unite FROM admin_unite WHERE mail = ?').bind(mail).first(); return r ? r.unite : ''; }
async function adminsDe(env, u) { return ((await (await baseBoite(env)).prepare('SELECT mail FROM admin_unite WHERE unite = ?').bind(u).all()).results || []).map(x => x.mail); }
// Suppression complète d'un compte : tout ce que le serveur garde à son nom (compte, appareils, adresse TRIGONE,
// carte, photo, sauvegarde, matricule, notifications, boîte, suivi). Restent :
// les lignes du registre des OMR (historique administratif des missions) et une trace sans l'adresse.
async function supprimerCompte(env, mail, par, motif, unite, qui) {
    const kv = env.TRIGONE_KV, db = await baseBoite(env), compte = await kv.get('compte:' + mail, 'json');
    const cles = ['compte:', 'nid-de:', 'carte-de:', 'adresse-de:', 'photo:', 'sauvegarde:', 'cle-donnees:', 'code:', 'unite-de:', 'fonctions:'].map(k => k + mail);
    const nid = (await kv.get('nid-de:' + mail)) || (compte && compte.nid) || '';
    if (nid && await kv.get('nid:' + nid) === mail) cles.push('nid:' + nid);
    const carte = await kv.get('carte-de:' + mail); if (carte) cles.push('carte:' + carte);
    // Nom pour le journal (grade, nom, prénom de sa carte), si la demande ne le donne pas.
    if (!qui && carte) { const ct = await kv.get('carte:' + carte, 'json'); if (ct) qui = [ct.grade, ct.nom, ct.prenom].filter(Boolean).join(' '); }
    const adr = await kv.get('adresse-de:' + mail); if (adr && await kv.get('adresse:' + adr) === mail) cles.push('adresse:' + adr);
    const msgs = ((await db.prepare('SELECT DISTINCT id FROM boite WHERE dest = ?').bind(mail).all()).results || []).map(x => 'msg:' + x.id);
    await Promise.all(cles.concat(msgs).map(k => kv.delete(k)));
    await db.batch(['DELETE FROM boite WHERE dest = ?', 'DELETE FROM abonnement WHERE mail = ?', 'DELETE FROM muet WHERE mail = ?', 'DELETE FROM rappel WHERE mail = ?',
        'DELETE FROM suivi WHERE demandeur = ?', 'DELETE FROM suivi_acteur WHERE mail = ?', 'DELETE FROM equipe WHERE mail = ?', 'DELETE FROM equipe_lecteur WHERE mail = ?', 'DELETE FROM rattache WHERE mail = ?', 'DELETE FROM mission WHERE chef = ?',
        'DELETE FROM boite_etat WHERE mail = ?', 'DELETE FROM porteur_role WHERE mail = ?', 'DELETE FROM admin_unite WHERE mail = ?', 'DELETE FROM compte_demande WHERE mail = ?', 'DELETE FROM compte_unite WHERE mail = ?'].map(q => db.prepare(q).bind(mail)));
    const brevo = 'sans objet';   // plus aucun mail envoyé : rien à effacer ailleurs
    const h = await empreinte('supprime:' + mail);
    await kv.put('efface:' + h, String(Date.now()), { expirationTtl: 180 * JOUR });   // ses appareils s'effacent à la prochaine ouverture
    await db.prepare('INSERT INTO compte_journal (le, unite, par, motif, empreinte, qui, brevo) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(Date.now(), unite || '', par, String(motif || '').slice(0, 300), h.slice(0, 16), String(qui || '').slice(0, 80), brevo).run();
    return { brevo };
}

// Adresse TRIGONE (prenom.nom@trigone-app.com) → clé du compte (l'adresse elle-même pour les comptes créés sans mail,
// l'ancienne adresse mail pour les comptes d'avant). Toute autre adresse est rendue telle quelle.
async function cleCompte(kv, mail) {
    mail = normaliser(mail);
    if (mail.endsWith('@' + DOMAINE_RECEPTION)) { const k = await kv.get('adresse:' + mail.split('@')[0]); if (k) return k; }
    if (!(await kv.get('compte:' + mail))) { const n = await cleMigree(kv, mail); if (n) return n; }
    return mail;
}
// ---------- Passage des anciens comptes (adresse mail personnelle) à leur adresse TRIGONE ----------
// Tout ce qui est rangé sous l'ancienne adresse passe sous prenom.nom@trigone-app.com, puis l'ancienne adresse est
// effacée. Seule une empreinte reste (« migre: »), pour que les envois encore adressés à l'ancienne adresse et les
// appareils pas encore prévenus retrouvent le compte : l'adresse elle-même n'est plus nulle part.
async function cleMigree(kv, mail) { return mail && !mail.endsWith('@' + DOMAINE_RECEPTION) ? await kv.get('migre:' + await empreinte('ancien:' + mail)) : null; }
async function migrerCompte(env, ancien, prenom, nom) {
    const kv = env.TRIGONE_KV, db = await baseBoite(env);
    const compte = await kv.get('compte:' + ancien, 'json');
    if (!compte) return null;
    const l = await ligneCompte(env, ancien) || {};
    const local = (await kv.get('adresse-de:' + ancien)) || await adresseDe(env, ancien, prenom || l.prenom, nom || l.nom);
    if (!local) return null;
    const neuf = local + '@' + DOMAINE_RECEPTION;
    if (await kv.get('compte:' + neuf)) return null;   // adresse déjà prise par un autre compte : on ne touche à rien
    compte.migreLe = Date.now(); delete compte.sansMail;
    if (estAdmin(env, ancien)) compte.superAdmin = true;   // administrateur de TRIGONE (ADMIN_MAILS) : il le reste sous sa nouvelle adresse
    await kv.put('compte:' + neuf, JSON.stringify(compte));
    await kv.put('adresse:' + local, neuf); await kv.put('adresse-de:' + neuf, local);
    for (const p of ['unite-de:', 'carte-de:', 'nid-de:', 'photo:', 'reinit:', 'idx-roles:', 'cle-donnees:']) {
        const v = await kv.get(p + ancien);
        if (v !== null) { await kv.put(p + neuf, v); await kv.delete(p + ancien); }
    }
    const sv = await kv.getWithMetadata('sauvegarde:' + ancien, 'arrayBuffer');
    if (sv && sv.value) { await kv.put('sauvegarde:' + neuf, sv.value, sv.metadata ? { metadata: sv.metadata } : {}); await kv.delete('sauvegarde:' + ancien); }
    const nid = await kv.get('nid-de:' + neuf); if (nid) await kv.put('nid:' + nid, neuf);
    const carteId = await kv.get('carte-de:' + neuf), carte = carteId ? await kv.get('carte:' + carteId, 'json') : null;
    if (carte) { carte.mail = neuf; await kv.put('carte:' + carteId, JSON.stringify(carte)); }
    const maj = [['boite', 'dest'], ['boite', 'de'], ['abonnement', 'mail'], ['suivi', 'demandeur'], ['suivi', 'detenteur'], ['suivi_acteur', 'mail'], ['suivi_acteur', 'demandeur'],
        ['muet', 'mail'], ['rappel', 'mail'], ['equipe', 'mail'], ['equipe', 'chef'], ['equipe_lecteur', 'mail'], ['rattache', 'mail'], ['rattache', 'chef'], ['mission', 'chef'], ['registre', 'par'], ['boite_etat', 'mail'], ['groupe_envoi', 'pris_par'],
        ['porteur_role', 'mail'], ['admin_unite', 'mail'], ['compte_demande', 'mail'], ['compte_demande', 'par'], ['compte_unite', 'mail'], ['compte_journal', 'par']];
    await db.batch(maj.map(x => db.prepare('UPDATE OR REPLACE ' + x[0] + ' SET ' + x[1] + ' = ? WHERE ' + x[1] + ' = ?').bind(neuf, ancien))
        .concat(db.prepare('UPDATE groupe_envoi SET membres = REPLACE(membres, ?, ?) WHERE membres LIKE ?').bind('"' + ancien + '"', '"' + neuf + '"', '%"' + ancien + '"%'),
            db.prepare('UPDATE compte_unite SET adresse = ? WHERE mail = ?').bind(neuf, neuf)));
    await kv.put('migre:' + await empreinte('ancien:' + ancien), neuf);
    for (const k of ['compte:', 'adresse-de:', 'limite:', 'code:']) await kv.delete(k + ancien);
    return neuf;
}
// ---------- Envoi au groupe ----------
// assist-dt.<unité>@trigone-app.com : tous les assistants Chorus DT de l'unité ; valideur2.<unité>@… : tous ses VALIDEUR 2.
// L'envoi est chiffré pour les appareils de chacun ; le premier qui le traite le range « traité » chez les autres.
const GROUPES = { 'assist-dt': 'chorus', 'valideur2': 'valideur2' };
function adresseGroupe(role, unite) {
    const p = Object.keys(GROUPES).find(k => GROUPES[k] === role);
    return p ? p + '.' + nomUnite(unite || UNITE_REGISTRE).toLowerCase().replace(/[^a-z0-9]/g, '') + '@' + DOMAINE_RECEPTION : '';
}
function lireGroupe(mail) {
    const m = /^([a-z0-9-]+)\.([a-z0-9]+)@trigone-app\.com$/.exec(normaliser(mail));
    if (!m || !GROUPES[m[1]]) return null;
    const U = m[2].toUpperCase();
    return { role: GROUPES[m[1]], unite: U === '4RIISC' ? UNITE_REGISTRE : U, adresse: m[0], libelle: (m[1] === 'assist-dt' ? 'assistants Chorus DT' : 'VALIDEUR 2') + ' du ' + U };
}
async function membresGroupe(env, g) {
    const db = await baseBoite(env), kv = env.TRIGONE_KV;
    const r = (await db.prepare('SELECT p.mail, p.roles, c.unite FROM porteur_role p LEFT JOIN compte_unite c ON c.mail = p.mail WHERE p.roles LIKE ? LIMIT 500').bind('%' + g.role + '%').all()).results || [];
    const l = [];
    for (const x of r) {
        if (!String(x.roles || '').split(',').includes(g.role)) continue;
        if ((x.unite || (await kv.get('unite-de:' + x.mail)) || UNITE_REGISTRE) !== g.unite) continue;
        const c = await kv.get('compte:' + x.mail, 'json');
        if (!c || c.attente || c.bloque || !(c.appareils || []).length) continue;   // rôle : celui de la base (x.roles), à jour
        l.push({ mail: x.mail, compte: c });
    }
    // Absents (remplaçant déclaré) : laissés de côté tant qu'il reste quelqu'un.
    const presents = l.filter(x => { const rp = x.compte.remplacant; return !(rp && rp.jusqu > Date.now() && (!rp.roles || rp.roles[g.role])); });
    return presents.length ? presents : l;
}
async function groupesDe(env, moi) {
    const u = (await env.TRIGONE_KV.get('unite-de:' + moi.mail)) || UNITE_REGISTRE;
    return Object.values(GROUPES).filter(r => (moi.compte.roles || {})[r]).map(r => adresseGroupe(r, u));
}
async function notifierDetenteur(env, mail, message, origine) {
    const g = lireGroupe(mail);
    if (!g) return notifierCompte(env, mail, message, origine);
    return Promise.all((await membresGroupe(env, g)).map(x => notifierCompte(env, x.mail, message, origine).catch(() => {})));
}
// Code de réactivation (nouveau téléphone, compte débloqué) : 8 caractères, comme un code de liaison, valable 48 h.
async function codeReactivation(kv, mail) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = crypto.getRandomValues(new Uint8Array(8));
    let code = ''; for (let i = 0; i < 8; i++) code += A.charAt(o[i] % 32);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('trigone-liaison:' + code)));
    await kv.put('liaison:' + b64url(h), JSON.stringify({ mail, paquet: null, reactivation: true }), { expirationTtl: 2 * JOUR });
    return code.slice(0, 4) + '-' + code.slice(4);
}
// Peut valider / gérer les comptes d'une unité : administrateur de TRIGONE, administrateur de l'unité, ou (validation
// seulement) assistant Chorus DT de l'unité.
async function gestionnaire(env, moi, unite, aussiChorus) {
    if (estAdmin(env, moi.mail)) return 'super';
    const au = await adminUnite(env, moi.mail); if (au && au === unite) return 'admin';
    if (aussiChorus && (moi.compte.roles || {}).chorus && (await env.TRIGONE_KV.get('unite-de:' + moi.mail)) === unite) return 'chorus';
    return '';
}
// « GRADE NOM Prénom » d'un compte (fiche de l'unité, sinon sa carte TRIGONE) ; vide si inconnu.
async function quiDe(env, mail) {
    try {
        const l = await ligneCompte(env, mail);
        if (l && (l.nom || l.prenom)) return [l.grade, (l.nom || '').toUpperCase(), l.prenom].filter(Boolean).join(' ');
        const id = await env.TRIGONE_KV.get('carte-de:' + mail), c = id ? await env.TRIGONE_KV.get('carte:' + id, 'json') : null;
        if (c && (c.nom || c.prenom)) return [c.grade, (c.nom || '').toUpperCase(), c.prenom].filter(Boolean).join(' ');
    } catch (e) {}
    return '';
}
async function ligneCompte(env, mail) { return await (await baseBoite(env)).prepare('SELECT * FROM compte_unite WHERE mail = ?').bind(mail).first(); }
async function majLigneCompte(env, mail, champs) {
    const db = await baseBoite(env), l = await ligneCompte(env, mail) || {};
    const v = Object.assign({ unite: '', grade: '', nom: '', prenom: '', adresse: '', statut: 'actif', le: Date.now(), par: '' }, l, champs);
    await db.prepare('INSERT INTO compte_unite (mail, unite, grade, nom, prenom, adresse, statut, le, par, maj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (mail) DO UPDATE SET ' +
        'unite = excluded.unite, grade = excluded.grade, nom = excluded.nom, prenom = excluded.prenom, adresse = excluded.adresse, statut = excluded.statut, par = excluded.par, maj = excluded.maj')
        .bind(mail, v.unite, v.grade, v.nom, v.prenom, v.adresse, v.statut, v.le, v.par, Date.now()).run();
}
async function journal(env, unite, par, motif, mail, qui) {
    await (await baseBoite(env)).prepare('INSERT INTO compte_journal (le, unite, par, motif, empreinte, qui, brevo) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(Date.now(), unite || '', par, String(motif || '').slice(0, 300), (await empreinte('supprime:' + mail)).slice(0, 16), String(qui || '').slice(0, 80), '').run();
}
const LIBRE_EN_ATTENTE = new Set(['etat', 'compte/etat', 'compte/role', 'compte/demandes', 'compte/demande', 'compte/appareils', 'unite', 'push', 'push/muet', 'push/test', 'boite', 'boite/etats',
    'adresse', 'appareil', 'carte', 'carte/revoquer', 'sauvegarde', 'sauvegarde/info', 'admin', 'suivi', 'annuaire', 'compte/motdepasse', 'donnees/cle']);

// ---------- Registre OMR partagé ----------
const UNITE_REGISTRE = 'principale';
// Un registre et une numérotation OMR par régiment : l'unité du profil arrive dans l'en-tête X-Trigone-Unite (forme
// normalisée, ex. « 4RIISC », « 1RIISC », « 3RPIMA »). Le registre d'origine (« principale ») reste celui du 4°RIISC,
// et des comptes qui n'ont pas encore transmis leur unité.
function uniteRegistre(requete) {
    const n = String(requete.headers.get('X-Trigone-Unite') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
    return !n || n === '4RIISC' ? UNITE_REGISTRE : n;
}
function nomUnite(u) { return u === UNITE_REGISTRE ? '4RIISC' : u; }   // affichage : le registre d'origine est celui du 4°RIISC
function cleOmr(u, cle) { return u === UNITE_REGISTRE ? cle : cle + ':' + u; }
// Comptes-rendus d'une ligne : réunis sans doublon (un par envoi).
function registreUnirCrs(a, b) {
    const vus = {}, r = [];
    (a || []).concat(b || []).forEach(c => { const k = c && (c.envoiId || JSON.stringify(c)); if (!c || vus[k]) return; vus[k] = 1; r.push(c); });
    return r;
}
// Deux versions d'une même ligne : les champs renseignés de la nouvelle l'emportent ; comptes-rendus, relances et
// auteurs des relances sont additionnés (deux assistants peuvent agir en même temps).
function registreFusion(a, b) {
    const r = Object.assign({}, a);
    Object.keys(b).forEach(k => { if (b[k] !== '' && b[k] != null) r[k] = b[k]; });
    r.crs = registreUnirCrs(a.crs, b.crs);
    r.relances = Array.from(new Set((a.relances || []).concat(b.relances || []))).sort((x, y) => x - y);
    r.relancesQui = Object.assign({}, a.relancesQui || {}, b.relancesQui || {});
    // Observations des assistants : réunies note par note (identifiant), la version la plus récente de chacune l'emporte.
    if (a.observations || b.observations) {
        const obs = {}, t = o => (o && (o.modifLe || o.le)) || 0;
        (a.observations || []).concat(b.observations || []).forEach(o => { if (o && o.id && (!obs[o.id] || t(o) >= t(obs[o.id]))) obs[o.id] = o; });
        r.observations = Object.keys(obs).map(k => obs[k]).sort((x, y) => (x.le || 0) - (y.le || 0)).slice(-200);
    }
    // Heures réelles de la mission (départ, sur site, départ du site, retour) : envoyées par le missionnaire lui-même ;
    // la version du serveur l'emporte sur la copie d'un assistant.
    if (a.jalons || b.jalons) r.jalons = Object.assign({}, b.jalons || {}, a.jalons || {});
    if (a.omr) r.omr = a.omr;
    return r;
}
// Index des comptes qui ont un rôle (photos de carte : à qui en remettre la clé). Tenu à jour quand les rôles changent,
// et vérifié une fois par jour au relevé de la boîte (comptes qui avaient déjà leur rôle).
// Rôles à jour d'un compte : la base D1 (porteur_role) est lue telle qu'écrite à l'instant, alors que le KV peut garder
// l'ancienne valeur jusqu'à une minute après un changement (un rôle ajouté ne serait pas encore vu par l'envoi).
// Sans ligne en base (compte sans rôle indexé), on garde les rôles du compte.
async function rolesActuels(env, mail, compte) {
    try {
        const r = await (await baseBoite(env)).prepare('SELECT roles FROM porteur_role WHERE mail = ?').bind(mail).first();
        if (r) { const o = {}; String(r.roles || '').split(',').filter(x => ROLES.indexOf(x) >= 0).forEach(x => { o[x] = true; }); return o; }
    } catch (e) {}
    return (compte && compte.roles) || {};
}
async function indexerRoles(env, mail, roles) {
    const db = await baseBoite(env), rs = ROLES.filter(r => (roles || {})[r]);
    if (rs.length) await db.prepare('INSERT INTO porteur_role (mail, roles, maj) VALUES (?, ?, ?) ON CONFLICT (mail) DO UPDATE SET roles = excluded.roles, maj = excluded.maj').bind(mail, rs.join(','), Date.now()).run();
    else await db.prepare('DELETE FROM porteur_role WHERE mail = ?').bind(mail).run();
    await env.TRIGONE_KV.put('idx-roles:' + mail, rs.join(','), { expirationTtl: 86400 });
}
async function registreEcrireLigne(db, u, ligne, le, par) {
    await db.prepare('INSERT INTO registre (unite, ref, omr, mref, donnees, maj, supprime, par) VALUES (?, ?, ?, ?, ?, ?, 0, ?) ' +
        'ON CONFLICT (unite, ref) DO UPDATE SET omr = excluded.omr, mref = excluded.mref, donnees = excluded.donnees, maj = excluded.maj, par = excluded.par WHERE registre.supprime = 0')
        .bind(u, ligne.ref, ligne.omr || '', ligne.mref || '', JSON.stringify(ligne), le, par).run();
}
async function registreSupprimerLigne(db, u, ref, le, par) {
    await db.prepare('UPDATE registre SET supprime = 1, maj = ?, par = ? WHERE unite = ? AND ref = ?').bind(le, par, u, ref).run();
}
async function registreFusionner(db, u, x, le, par) {
    const avant = await db.prepare('SELECT * FROM registre WHERE unite = ? AND ref = ?').bind(u, x.ref).first();
    if (avant && avant.supprime) return;   // retirée par un assistant : elle ne revient pas
    let ligne = avant ? registreFusion(JSON.parse(avant.donnees || '{}'), x) : x;
    // Compte-rendu arrivé seul chez un assistant et demande chez un autre : réunis sur la ligne de la demande
    // (même n° OMR, ou même demande d'origine).
    if (ligne.omr || ligne.mref) {
        const autres = (await db.prepare('SELECT * FROM registre WHERE unite = ? AND supprime = 0 AND ref <> ? AND ((omr <> \'\' AND omr = ?) OR ref = ? OR (mref <> \'\' AND mref = ?))')
            .bind(u, ligne.ref, ligne.omr || '', ligne.mref || '', ligne.ref).all()).results || [];
        for (const a of autres) {
            const d = JSON.parse(a.donnees || '{}');
            if (ligne.sansDemande && !d.sansDemande) {
                d.crs = registreUnirCrs(d.crs, ligne.crs);
                await registreEcrireLigne(db, u, d, le, par);
                await db.prepare("INSERT INTO registre (unite, ref, omr, mref, donnees, maj, supprime, par) VALUES (?, ?, '', '', '{}', ?, 1, ?) " +
                    'ON CONFLICT (unite, ref) DO UPDATE SET supprime = 1, maj = excluded.maj, par = excluded.par').bind(u, ligne.ref, le, par).run();
                return;
            }
            if (!ligne.sansDemande && d.sansDemande) { ligne.crs = registreUnirCrs(ligne.crs, d.crs); await registreSupprimerLigne(db, u, a.ref, le, par); }
        }
    }
    await registreEcrireLigne(db, u, ligne, le, par);
}

// Remise à zéro des comptes TRIGONE (fin des essais, demandée par l'administrateur) : au premier appel après la
// publication, une seule fois (garantie par D1), les comptes, codes, limites et envois en attente sont effacés.
// Chacun réactive ensuite son compte. Pour une nouvelle remise à zéro, changer cette valeur.
const REMISE_A_ZERO = '2026-09-27';
let REMISE_FAITE = false;
async function remiseAZero(env) {
    if (REMISE_FAITE) return;
    const db = await tableReglage(env);
    const r = await db.prepare('INSERT INTO reglage (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur WHERE reglage.valeur <> excluded.valeur')
        .bind('remise', REMISE_A_ZERO).run();
    REMISE_FAITE = true;
    if (!r.meta || !r.meta.changes) return;   // déjà faite (par cette requête ou une autre)
    await db.prepare('DELETE FROM boite').run();
    await (await baseBoite(env)).prepare('DELETE FROM abonnement').run();
    for (const prefixe of ['compte:', 'code:', 'limite:', 'msg:', 'liaison:']) {
        let curseur;
        do {
            const l = await env.TRIGONE_KV.list({ prefix: prefixe, cursor: curseur });
            await Promise.all(l.keys.map(k => env.TRIGONE_KV.delete(k.name)));
            curseur = l.list_complete ? null : l.cursor;
        } while (curseur);
    }
}

// ---------- Notifications (Web Push) : à chaque envoi, les appareils du destinataire sont prévenus ----------
// Clés VAPID créées par le serveur à la première utilisation et gardées dans D1 (table reglage) ; la notification
// (type d'envoi et expéditeur, rien du contenu) est chiffrée pour l'appareil (RFC 8291, aes128gcm).
function depuisB64url(t) {
    const s = atob(String(t).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(t).length + 3) % 4));
    const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o;
}
function concat(...parts) {
    const o = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0;
    for (const p of parts) { o.set(p, i); i += p.length; } return o;
}
async function tableReglage(env) {
    const db = await baseBoite(env);
    await db.prepare('CREATE TABLE IF NOT EXISTS reglage (cle TEXT PRIMARY KEY, valeur TEXT)').run();
    return db;
}
async function clesVapid(env) {
    const db = await tableReglage(env);
    let l = await db.prepare('SELECT valeur FROM reglage WHERE cle = ?').bind('vapid').first();
    if (!l) {
        const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        const prive = await crypto.subtle.exportKey('jwk', k.privateKey);
        const pub = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', k.publicKey)));
        await db.prepare('INSERT INTO reglage (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO NOTHING').bind('vapid', JSON.stringify({ prive, pub })).run();
        l = await db.prepare('SELECT valeur FROM reglage WHERE cle = ?').bind('vapid').first();
    }
    return JSON.parse(l.valeur);
}
async function hkdf(sel, ikm, info, longueur) {
    const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sel, info }, k, longueur * 8));
}
async function envoyerPush(env, abonnement, message, origine) {
    const vapid = await clesVapid(env);
    const texte = new TextEncoder();
    // Jeton VAPID (JWT ES256) pour le service de notification de l'appareil (Google, Apple, Mozilla…).
    const tete = b64url(texte.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const corpsJwt = b64url(texte.encode(JSON.stringify({ aud: new URL(abonnement.endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: origine })));
    const cleSig = await crypto.subtle.importKey('jwk', vapid.prive, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cleSig, texte.encode(tete + '.' + corpsJwt)));
    // Chiffrement du message pour l'appareil (clé p256dh + secret auth de l'abonnement).
    const uaPub = depuisB64url(abonnement.keys.p256dh), auth = depuisB64url(abonnement.keys.auth);
    const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
    const uaCle = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const partage = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaCle }, eph.privateKey, 256));
    const ikm = await hkdf(auth, partage, concat(texte.encode('WebPush: info\0'), uaPub, asPub), 32);
    const sel = hasard(16);
    const cek = await hkdf(sel, ikm, texte.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(sel, ikm, texte.encode('Content-Encoding: nonce\0'), 12);
    const cle = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cle, concat(texte.encode(JSON.stringify(message)), new Uint8Array([2]))));
    const corps = concat(sel, new Uint8Array([0, 0, 16, 0, 65]), asPub, chiffre);
    return fetch(abonnement.endpoint, { method: 'POST', body: corps, headers: {
        Authorization: 'vapid t=' + tete + '.' + corpsJwt + '.' + b64url(sig) + ', k=' + vapid.pub,
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' } });
}
// Texte de la notification selon le type d'envoi et le nombre de demandes qu'il contient (n, donné par l'expéditeur).
function textePush(type, n) {
    const p = n > 1, x = p ? n + ' ' : '';
    const t = {
        DEMANDE: [p ? n + ' demandes à signer' : 'Demande à signer', (p ? x + 'nouvelles demandes' : 'Nouvelle demande') + ' de mise en route à valider (VALIDEUR 1).', 'boite'],
        VALIDATION_1: [p ? n + ' demandes à signer' : 'Demande à signer', (p ? x + 'demandes validées' : 'Demande validée') + ' par le VALIDEUR 1, à valider (VALIDEUR 2).', 'boite'],
        RENVOI: [p ? n + ' demandes renvoyées' : 'Demande renvoyée', 'Le VALIDEUR 2 vous renvoie ' + (p ? x + 'demandes' : 'une demande') + ' : à corriger, revalider ou refuser.', 'boite'],
        REFUS: [p ? n + ' demandes refusées' : 'Demande refusée', (p ? x + 'de vos demandes vous sont renvoyées' : 'Une de vos demandes vous est renvoyée') + ' avec un motif : corrigez puis renvoyez.', 'boite'],
        CHORUS: [p ? n + ' demandes validées' : 'Demande validée', (p ? x + 'demandes validées' : 'Demande validée') + ' par les deux valideurs, à contrôler (ASSIST CHORUS DT).', 'chorus'],
        CR: ['Compte-rendu de mission', 'Un compte-rendu de fin de mission vous est parvenu.', 'chorus'],
        COLLECTIVE: ['Mission collective', 'Votre compte-rendu de mission collective est prêt : joignez vos justificatifs, puis envoyez-le à l\'assistant Chorus DT.', 'boite'],
        QUESTION: ['Question sur votre demande', 'On vous pose une question avant de valider : répondez dans TRIGONE (Boîte de réception) pour que votre dossier avance.', 'boite'],
        REPONSE: ['Réponse à votre question', 'Le missionnaire vous a répondu : ouvrez votre Boîte de réception.', 'boite'],
        JUSTIF: [p ? n + ' justificatifs reçus' : 'Justificatif reçu', (p ? x + 'pièces jointes' : 'Une pièce jointe') + ' (facture, billet) reçue' + (p ? 's' : '') + ' par mail, rangée' + (p ? 's' : '') + ' dans Boîte de réception › Justificatifs.', 'boite']
    }[type];
    return t || ['TRIGONE', 'Nouvel envoi dans votre boîte TRIGONE.', 'boite'];
}
// Abonnements d'un compte (table abonnement ; repli : ancien abonnement rangé dans le compte).
// Sans « avecMuets », les appareils aux notifications coupées sont écartés.
async function abonnements(env, mail, compte, avecMuets) {
    const db = await baseBoite(env);
    const r = await db.prepare('SELECT appareil, endpoint, p256dh, auth FROM abonnement WHERE mail = ?').bind(mail).all();
    const liste = (r.results || []).map(x => ({ appareil: x.appareil, push: { endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } } }));
    ((compte && compte.appareils) || []).forEach(a => { if (a.push && a.push.endpoint && !liste.some(x => x.appareil === a.id)) liste.push({ appareil: a.id, push: a.push }); });
    if (avecMuets) return liste;
    const muets = ((await db.prepare('SELECT appareil FROM muet WHERE mail = ?').bind(mail).all()).results || []).map(x => x.appareil);
    return liste.filter(x => muets.indexOf(x.appareil) < 0);
}
// Prévient chaque appareil destinataire abonné ; un abonnement expiré (404 / 410) est retiré.
async function notifier(env, dest, compte, idsAppareils, type, de, origine, nombre) {
    const t = textePush(type, nombre || 1);
    const liste = (await abonnements(env, dest, compte)).filter(x => idsAppareils.indexOf(x.appareil) >= 0);
    const db = await baseBoite(env);
    await Promise.all(liste.map(async x => {
        try {
            const r = await envoyerPush(env, x.push, { titre: t[0], texte: t[1] + (de ? ' — de ' + de : ''), type, nombre: nombre || 1, url: '/?espace=' + t[2] }, origine);
            if (r.status === 404 || r.status === 410) await db.prepare('DELETE FROM abonnement WHERE mail = ? AND appareil = ?').bind(dest, x.appareil).run();
        } catch (e) {}
    }));
}

// ---------- Suivi : où en est chaque demande (et chaque compte-rendu), pour le demandeur ----------
// Étapes d'une demande : val1 (chez le VALIDEUR 1) → val2 → chorus (chez l'assistant Chorus DT) → traite ; ou refus.
// Compte-rendu : chorus (déposé) → recu (récupéré par l'assistant Chorus DT) → traite.
// Chaque envoi fait avancer les demandes qu'il contient (identifiants donnés par l'expéditeur, « refs ») ; seul le
// détenteur actuel d'une demande peut la faire avancer. Le demandeur est prévenu à chaque étape, et le détenteur est
// relancé toutes les 24 h (jours ouvrés) tant qu'il ne l'a pas fait avancer.
const DUREE_SUIVI = 180 * JOUR;
const RELANCE = 24 * 3600 * 1000;
function nettoyerRefs(refs) {
    return Array.isArray(refs) ? refs.map(r => String(r || '').slice(0, 64)).filter(r => /^[\w.-]+$/.test(r)).slice(0, 90) : [];   // D1 : 100 paramètres au plus par requête
}
// Texte de la notification au demandeur (n demandes ; qui : grade nom prénom de l'auteur de l'étape, s'il l'a donné).
function texteSuivi(etape, genre, n, qui) {
    const p = n > 1, par = qui ? ' (' + qui + ')' : '';
    if (genre === 'cr') return {
        recu: ['Compte-rendu récupéré', 'Votre compte-rendu de mission a été récupéré par l\'assistant Chorus DT.'],
        traite: ['Compte-rendu traité', 'Votre compte-rendu de mission a été traité par l\'assistant Chorus DT' + par + '.']
    }[etape];
    const x = p ? n + ' de vos demandes ont' : 'Votre demande a';
    return {
        val2: [p ? n + ' demandes validées' : 'Demande validée', x + ' été validée' + (p ? 's' : '') + ' par le VALIDEUR 1' + par + ' ; en attente du VALIDEUR 2.'],
        chorus: [p ? n + ' demandes validées' : 'Demande validée', x + ' été validée' + (p ? 's' : '') + ' par le VALIDEUR 2' + par + ' et transmise' + (p ? 's' : '') + ' à l\'assistant Chorus DT.'],
        renvoi: [p ? n + ' demandes renvoyées' : 'Demande renvoyée', x + ' été renvoyée' + (p ? 's' : '') + ' au VALIDEUR 1 par le VALIDEUR 2' + par + ', pour correction.'],
        traite: [p ? n + ' demandes traitées' : 'Demande traitée', x + ' été traitée' + (p ? 's' : '') + ' par l\'assistant Chorus DT' + par + ' : votre ordre de mission est créé dans Chorus DT.']
    }[etape];
}
// Prévient tous les appareils abonnés d'un compte.
async function notifierCompte(env, mail, message, origine) {
    const liste = await abonnements(env, mail, await env.TRIGONE_KV.get('compte:' + mail, 'json'));
    const db = await baseBoite(env);
    await Promise.all(liste.map(async x => {
        try {
            const r = await envoyerPush(env, x.push, message, origine);
            if (r.status === 404 || r.status === 410) await db.prepare('DELETE FROM abonnement WHERE mail = ? AND appareil = ?').bind(mail, x.appareil).run();
        } catch (e) {}
    }));
}
// Fait avancer des lignes de suivi (déjà lues) à une étape ; prévient chaque demandeur (une notification par demandeur).
async function avancerSuivi(env, lignes, etape, nouvelle, origine, cleNotif) {
    if (!lignes.length) return;
    const db = await baseBoite(env), le = Date.now();
    await db.batch(lignes.map(l => {
        const etapes = JSON.parse(l.etapes || '[]'); etapes.push(nouvelle.trace);
        return db.prepare('UPDATE suivi SET etape = ?, detenteur = ?, envoi = COALESCE(?, envoi), le = ?, relance = NULL, etapes = ? WHERE ref = ? AND demandeur = ?')
            .bind(etape, nouvelle.detenteur || l.detenteur, nouvelle.envoi || null, le, JSON.stringify(etapes.slice(-30)), l.ref, l.demandeur);
    }));
    // L'auteur de l'étape devient intervenant : il verra la suite de la demande.
    if (nouvelle.auteur && lignes[0].genre === 'mer') await db.batch(lignes.filter(l => l.demandeur !== nouvelle.auteur).map(l =>
        db.prepare('INSERT OR IGNORE INTO suivi_acteur (ref, demandeur, mail) VALUES (?, ?, ?)').bind(l.ref, l.demandeur, nouvelle.auteur)));
    // Refus ou renvoi plus loin dans le circuit : les valideurs qui l'avaient déjà validée sont prévenus.
    if (lignes[0].genre === 'mer' && (nouvelle.trace.e === 'refus' || nouvelle.trace.e === 'renvoi')) {
        const acteurs = {};
        for (const l of lignes) {
            const r = (await db.prepare('SELECT mail FROM suivi_acteur WHERE ref = ? AND demandeur = ?').bind(l.ref, l.demandeur).all()).results || [];
            r.forEach(a => { if (a.mail !== nouvelle.auteur && a.mail !== l.demandeur && a.mail !== nouvelle.detenteur) acteurs[a.mail] = (acteurs[a.mail] || 0) + 1; });
        }
        const qui = nouvelle.trace.qui ? ' (' + nouvelle.trace.qui + ')' : '';
        await Promise.all(Object.keys(acteurs).map(m => {
            const n = acteurs[m], p = n > 1;
            return notifierCompte(env, m, { titre: p ? n + ' demandes refusées' : 'Demande refusée',
                texte: (p ? n + ' demandes que vous aviez validées ont été ' : 'Une demande que vous aviez validée a été ') + (nouvelle.trace.e === 'renvoi' ? 'renvoyée' + (p ? 's' : '') + ' au VALIDEUR 1' : 'refusée' + (p ? 's' : '') + ' au demandeur') + qui + '.',
                type: 'SUIVI', url: '/?espace=boite' }, origine).catch(() => {});
        }));
    }
    const parDemandeur = {};
    lignes.forEach(l => { if (l.demandeur !== nouvelle.auteur) (parDemandeur[l.demandeur] = parDemandeur[l.demandeur] || { genre: l.genre, n: 0 }).n++; });
    if (!cleNotif) return;
    await Promise.all(Object.keys(parDemandeur).map(m => {
        const d = parDemandeur[m], t = texteSuivi(cleNotif, d.genre, d.n, nouvelle.trace.qui);
        if (!t) return null;
        return notifierCompte(env, m, { titre: t[0], texte: t[1], type: 'SUIVI', url: d.genre === 'cr' ? '/cr/' : '/?espace=suivi' }, origine).catch(() => {});
    }));
}
// Un envoi vient d'être déposé : les demandes (ou le compte-rendu) qu'il contient avancent.
async function suiviEnvoi(env, moi, type, dest, id, refs, qui, origine) {
    const db = await baseBoite(env), le = Date.now();
    const trace = e => ({ e, le, qui: qui || '', par: moi.mail });
    if (type === 'CR') {
        await db.prepare('INSERT OR REPLACE INTO suivi (ref, demandeur, genre, etape, detenteur, envoi, le, relance, etapes) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)')
            .bind(id, moi.mail, 'cr', 'chorus', dest, id, le, JSON.stringify([trace('envoyee')])).run();
        return;
    }
    if (!refs.length) return;
    if (type === 'DEMANDE') {
        // Nouvelle demande, ou demande renvoyée après correction : le suivi repart du début.
        await db.batch(refs.map(r => db.prepare('INSERT OR REPLACE INTO suivi (ref, demandeur, genre, etape, detenteur, envoi, le, relance, etapes) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)')
            .bind(r, moi.mail, 'mer', 'val1', dest, id, le, JSON.stringify([trace('envoyee')]))));
        return;
    }
    // [nouvelle étape, étape franchie (trace), notification au demandeur (le refus lui arrive déjà comme envoi)]
    const cible = { VALIDATION_1: ['val2', 'val1', 'val2'], CHORUS: ['chorus', 'val2', 'chorus'], RENVOI: ['val1', 'renvoi', 'renvoi'], REFUS: ['refus', 'refus', null] }[type];
    if (!cible) return;
    const dets = [moi.mail].concat(await groupesDe(env, moi));
    const lignes = (await db.prepare('SELECT * FROM suivi WHERE genre = ? AND detenteur IN (' + dets.map(() => '?').join(',') + ') AND ref IN (' + refs.map(() => '?').join(',') + ')')
        .bind('mer', ...dets, ...refs).all()).results || [];
    await avancerSuivi(env, lignes, cible[0], { detenteur: dest, envoi: id, auteur: moi.mail, trace: trace(cible[1]) }, origine, cible[2]);
}
// Relances : toutes les heures (déclencheur planifié), les demandes et comptes-rendus qui attendent le même détenteur
// depuis plus de 24 h (et pas relancés depuis 24 h) lui valent une notification, du lundi au vendredi, de 8 h à 19 h (Paris).
function heureParis(ms) {
    const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date(ms));
    return { jour: (f.find(x => x.type === 'weekday') || {}).value || '', heure: +((f.find(x => x.type === 'hour') || {}).value || 0) };
}
async function relancer(env, origine, maintenant, forcer) {
    const h = heureParis(maintenant);
    if (!forcer && (/^(sam|dim)/.test(h.jour) || h.heure < 8 || h.heure >= 19)) return 0;
    const db = await baseBoite(env);
    await db.prepare('DELETE FROM suivi WHERE le < ?').bind(maintenant - DUREE_SUIVI * 1000).run();
    await db.prepare('DELETE FROM suivi_acteur WHERE NOT EXISTS (SELECT 1 FROM suivi s WHERE s.ref = suivi_acteur.ref AND s.demandeur = suivi_acteur.demandeur)').run();
    const r = await db.prepare('SELECT ref, demandeur, genre, etape, detenteur FROM suivi WHERE etape IN (\'val1\', \'val2\', \'chorus\', \'recu\') AND le <= ? AND (relance IS NULL OR relance <= ?)')
        .bind(maintenant - RELANCE, maintenant - RELANCE).all();
    const lignes = r.results || [];
    // Demandes refusées que le demandeur n'a pas encore corrigées : rappel après 48 h, puis toutes les 48 h (14 jours au plus).
    const refus = (await db.prepare('SELECT ref, demandeur FROM suivi WHERE etape = \'refus\' AND genre = \'mer\' AND le <= ? AND le > ? AND (relance IS NULL OR relance <= ?)')
        .bind(maintenant - 2 * RELANCE, maintenant - 14 * JOUR * 1000, maintenant - 2 * RELANCE).all()).results || [];
    const parDemandeur = {};
    refus.forEach(l => { parDemandeur[l.demandeur] = (parDemandeur[l.demandeur] || 0) + 1; });
    await Promise.all(Object.keys(parDemandeur).map(m => { const n = parDemandeur[m];
        return notifierCompte(env, m, { titre: 'Rappel TRIGONE', texte: (n > 1 ? n + ' demandes refusées attendent' : '1 demande refusée attend') + ' votre correction depuis plus de 48 h (Documents).', type: 'RELANCE', url: '/?espace=documents' }, origine).catch(() => {}); }));
    if (refus.length) await db.batch(refus.map(l => db.prepare('UPDATE suivi SET relance = ? WHERE ref = ? AND demandeur = ?').bind(maintenant, l.ref, l.demandeur)));
    const parDetenteur = {};
    lignes.forEach(l => { const d = parDetenteur[l.detenteur] = parDetenteur[l.detenteur] || { signer: 0, chorus: 0, cr: 0 };
        if (l.genre === 'cr') d.cr++; else if (l.etape === 'chorus') d.chorus++; else d.signer++; });
    await Promise.all(Object.keys(parDetenteur).map(m => {
        const d = parDetenteur[m];
        const txt = [d.signer ? (d.signer > 1 ? d.signer + ' demandes attendent' : '1 demande attend') + ' votre signature' : '',
            d.chorus ? (d.chorus > 1 ? d.chorus + ' demandes validées attendent' : '1 demande validée attend') + ' votre traitement' : '',
            d.cr ? (d.cr > 1 ? d.cr + ' comptes-rendus attendent' : '1 compte-rendu attend') + ' votre traitement' : ''].filter(Boolean).join(', ');
        return notifierDetenteur(env, m, { titre: 'Rappel TRIGONE', texte: txt.charAt(0).toUpperCase() + txt.slice(1) + ' depuis plus de 24 h.', type: 'RELANCE',
            url: d.signer ? '/?espace=boite' : '/?espace=chorus' }, origine).catch(() => {});
    }));
    if (lignes.length) await db.batch(lignes.map(l => db.prepare('UPDATE suivi SET relance = ? WHERE ref = ? AND demandeur = ?').bind(maintenant, l.ref, l.demandeur)));
    return lignes.length + refus.length;
}
// Rappels « départ en mission » arrivés à échéance (déclencheur toutes les 5 minutes) : une notification au demandeur,
// sauf si la demande a été refusée ou abandonnée entre-temps. Rappels de plus de 12 h manqués : abandonnés.
async function envoyerRappels(env, origine, maintenant) {
    const db = await baseBoite(env);
    await db.prepare('DELETE FROM rappel WHERE quand < ?').bind(maintenant - 7 * JOUR * 1000).run();
    const l = (await db.prepare('SELECT r.ref, r.mail, s.etape FROM rappel r LEFT JOIN suivi s ON s.ref = r.ref AND s.demandeur = r.mail WHERE r.envoye IS NULL AND r.quand <= ? AND r.quand > ? LIMIT 200')
        .bind(maintenant, maintenant - 12 * 3600 * 1000).all()).results || [];
    if (!l.length) return 0;
    await db.batch(l.map(x => db.prepare('UPDATE rappel SET envoye = ? WHERE ref = ? AND mail = ?').bind(maintenant, x.ref, x.mail)));
    const aEnvoyer = l.filter(x => x.etape !== 'refus' && x.etape !== 'abandon');
    await Promise.all(aEnvoyer.map(x => notifierCompte(env, x.mail, { titre: 'Départ en mission aujourd\'hui', type: 'RAPPEL',
        texte: 'Touchez pour démarrer votre compte-rendu : la mission est déjà remplie depuis votre mise en route.',
        url: '/cr/?depart=' + encodeURIComponent(x.ref) }, origine).catch(() => {})));
    return aEnvoyer.length;
}
// Missions collectives : le chef envoie le compte-rendu prérempli (COLLECTIVE) → le participant entre dans l'équipe ;
// le participant envoie son compte-rendu (CR) avec la même référence → noté envoyé, et le chef est prévenu.
async function suiviEquipe(env, moi, type, dest, ref, qui, origine) {
    if (!ref) return;
    const db = await baseBoite(env), le = Date.now();
    if (type === 'COLLECTIVE') {
        await db.prepare('INSERT INTO equipe (ref, mail, chef, recu, envoye, relance) VALUES (?, ?, ?, ?, NULL, NULL) ON CONFLICT (ref, mail) DO UPDATE SET recu = excluded.recu WHERE equipe.chef = excluded.chef')
            .bind(ref, dest, moi.mail, le).run();
        return;
    }
    if (type !== 'CR') return;
    // Compte-rendu du chef ou d'un participant : l'assistant Chorus DT destinataire peut suivre l'équipe.
    const duChef = await db.prepare('SELECT 1 AS x FROM equipe WHERE ref = ? AND chef = ? LIMIT 1').bind(ref, moi.mail).first();
    const l = await db.prepare('SELECT chef FROM equipe WHERE ref = ? AND mail = ?').bind(ref, moi.mail).first();
    if (duChef || l) await db.prepare('INSERT OR IGNORE INTO equipe_lecteur (ref, mail, le) VALUES (?, ?, ?)').bind(ref, dest, le).run();
    if (!l) return;
    await db.prepare('UPDATE equipe SET envoye = ? WHERE ref = ? AND mail = ?').bind(le, ref, moi.mail).run();
    const reste = (await db.prepare('SELECT COUNT(*) AS n FROM equipe WHERE ref = ? AND envoye IS NULL').bind(ref).first() || {}).n || 0;
    await notifierCompte(env, l.chef, { titre: 'Mission collective', type: 'SUIVI', url: '/cr/?espace=equipe&ref=' + encodeURIComponent(ref),
        texte: (qui || moi.mail) + ' a envoyé son compte-rendu. ' + (reste ? reste + ' participant' + (reste > 1 ? 's' : '') + ' ne l\'' + (reste > 1 ? 'ont' : 'a') + ' pas encore fait.' : 'Toute l\'équipe a envoyé le sien ✅') }, origine);
}
// Erreurs : purge (30 jours, 1 000 signatures au plus).
async function purgerErreurs(env, maintenant) {
    const db = await baseBoite(env);
    await db.prepare('DELETE FROM erreur WHERE dernier < ?').bind(maintenant - 30 * JOUR * 1000).run();
    await db.prepare('DELETE FROM erreur WHERE sig NOT IN (SELECT sig FROM erreur ORDER BY dernier DESC LIMIT 1000)').run();
    await db.prepare('DELETE FROM erreur_appareil WHERE sig NOT IN (SELECT sig FROM erreur)').run();
    // Copie à jour du KV : valeurs expirées ou effacées depuis plus d'une heure (le KV, lui, est à jour depuis longtemps).
    await db.prepare('DELETE FROM kv_frais WHERE expire IS NOT NULL AND expire < ?').bind(maintenant - 3600 * 1000).run();
}
function estAdmin(env, mail) {
    if (env.MODE_TEST === '1' && /^admin\./.test(mail)) return true;   // tests locaux uniquement
    return String(env.ADMIN_MAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean).indexOf(String(mail).toLowerCase()) >= 0;
}
async function origineConnue(env, origine) {
    const db = await tableReglage(env);
    if (origine) { await db.prepare('INSERT INTO reglage (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur WHERE reglage.valeur <> excluded.valeur').bind('origine', origine).run(); return origine; }
    const l = await db.prepare('SELECT valeur FROM reglage WHERE cle = ?').bind('origine').first();
    return l ? l.valeur : 'https://trigone-mise-en-route.parisien2403.workers.dev';
}

function json(corps, statut) {
    return new Response(JSON.stringify(corps), { status: statut || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function erreur(statut, message) { return json({ ok: false, erreur: message }, statut); }
function b64url(octets) { return btoa(String.fromCharCode.apply(null, octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function hasard(n) { return crypto.getRandomValues(new Uint8Array(n)); }
// Matricule (NID) : jamais gardé en clair ; empreinte salée (sel tiré au hasard une fois, propre à ce serveur).
async function empreinteNid(env, nid) {
    const db = await tableReglage(env);
    let l = await db.prepare('SELECT valeur FROM reglage WHERE cle = ?').bind('sel-nid').first();
    if (!l) {
        await db.prepare('INSERT INTO reglage (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO NOTHING').bind('sel-nid', b64url(hasard(24))).run();
        l = await db.prepare('SELECT valeur FROM reglage WHERE cle = ?').bind('sel-nid').first();
    }
    return empreinte(l.valeur + ':' + nid);
}
function chiffresNid(v) { const c = String(v || '').replace(/\D/g, ''); return c.length === 10 ? c : ''; }
// Code de connexion (adresse TRIGONE + code, 8 caractères au moins) : empreinte lente et salée, jamais le code lui-même.
async function empreinteMdp(code, sel) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('TRIGONE-MDP:' + code), 'PBKDF2', false, ['deriveBits']);
    return b64url(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: 100000 }, k, 256)));
}
async function empreinte(texte) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
    return b64url(new Uint8Array(h));
}
function normaliser(mail) { return String(mail || '').trim().toLowerCase(); }
function mailValide(mail) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail); }
function domaineAutorise(env, mail) {
    const liste = String(env.DOMAINES_AUTORISES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!liste.length) return true;
    const dom = mail.split('@')[1] || '';
    return liste.some(d => dom === d || dom.endsWith('.' + d));
}

// Authentification d'un appareil : « Authorization: TRIGONE <mail> <appareil> <jeton> ».
async function appareilConnecte(env, requete) {
    const m = /^TRIGONE (\S+) (\S+) (\S+)$/.exec(requete.headers.get('Authorization') || '');
    if (!m) return null;
    let mail = normaliser(decodeURIComponent(m[1]));
    let compte = await env.TRIGONE_KV.get('compte:' + mail, 'json');
    // Compte passé à son adresse TRIGONE : l'appareil qui envoie encore l'ancienne adresse est reconnu (et prévenu par compte/etat).
    if (!compte) { const n = await cleMigree(env.TRIGONE_KV, mail); if (n) { mail = n; compte = await env.TRIGONE_KV.get('compte:' + mail, 'json'); } }
    if (!compte) return null;
    const h = await empreinte(m[3]);
    const app = compte.appareils.find(a => a.id === m[2] && a.jeton === h);
    return app ? { mail, appareil: app, compte } : null;
}


// « NOGENT-LE-ROTROU (28400) » → { nom: 'NOGENT-LE-ROTROU', cp: '28400' } (le code postal départage les homonymes).
function nettoyerVille(v) {
    v = String(v || '').slice(0, 100).trim();
    const cp = (/\((\d{5})\)\s*$/.exec(v) || /\b(\d{5})\b/.exec(v) || [])[1] || '';
    const nom = v.replace(/\(\s*\d{4,6}\s*\)\s*$/, '').replace(/\b\d{5}\b/, '').replace(/\s+/g, ' ').trim().toUpperCase();
    return { nom, cp };
}
// Appels aux services publics de cartographie : identifiés (User-Agent) et limités à 10 s chacun.
async function lireJson(adresse) {
    const r = await fetch(adresse, { headers: { 'User-Agent': 'TRIGONE/1.0 (indemnites kilometriques)', 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(new URL(adresse).hostname + ' ' + r.status);
    return r.json();
}
// Commune → coordonnées : Géoplateforme de l'IGN (successeur de la Base adresse nationale), puis l'ancienne adresse.
async function situerVille(v, traces) {
    const q = 'q=' + encodeURIComponent(v.nom) + '&type=municipality&limit=1' + (v.cp ? '&postcode=' + v.cp : '');
    for (const adresse of ['https://data.geopf.fr/geocodage/search?index=address&' + q, 'https://api-adresse.data.gouv.fr/search/?' + q]) {
        try {
            const d = await lireJson(adresse);
            const f = d && d.features && d.features[0];
            if (!f || !f.geometry) return null;
            const p = f.properties || {};
            return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], nom: String(p.city || p.name || v.nom).toUpperCase() + (p.postcode ? ' (' + p.postcode + ')' : '') };
        } catch (e) { traces.push(String(e.message || e)); }
    }
    throw new Error('géocodage');
}
// Distance routière en km : itinéraire de la Géoplateforme de l'IGN, puis OSRM (OpenStreetMap) en secours.
async function distanceRoute(p1, p2, traces) {
    try {
        const d = await lireJson('https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&profile=car&optimization=fastest&distanceUnit=kilometer&getSteps=false&start=' + p1.lon + ',' + p1.lat + '&end=' + p2.lon + ',' + p2.lat);
        const km = parseFloat(d && d.distance);
        if (km >= 0) return km;
        traces.push('IGN illisible');
    } catch (e) { traces.push(String(e.message || e)); }
    try {
        const d = await lireJson('https://router.project-osrm.org/route/v1/driving/' + p1.lon + ',' + p1.lat + ';' + p2.lon + ',' + p2.lat + '?overview=false');
        const m = d && d.routes && d.routes[0] && d.routes[0].distance;
        if (m >= 0) return m / 1000;
        traces.push('OSRM illisible');
    } catch (e) { traces.push(String(e.message || e)); }
    throw new Error('itinéraire');
}

// ----- Aide de la mascotte : consigne donnée à l'IA -----
function texteSimple(h) { return String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim(); }
// Règles de calcul appliquées par TRIGONE Compte-rendu (les mêmes que la page « Références réglementaires » de l'appli).
const REGLES_FRAIS = [
    'Repas en France : forfait de 20 € par repas non pris au restaurant administratif et non fourni. Midi : compte si parti au plus tard à 11 h le jour du départ et rentré à 14 h ou après le jour du retour ; soir : parti au plus tard à 18 h, rentré à 21 h ou après. Les jours entre le départ et le retour sont toujours éligibles. Il faut être hors de ses résidences (administrative et familiale) sur toute la tranche.',
    'Hébergement en France (petit-déjeuner compris), seulement si la nuit est à la charge de la personne (hôtel) : 90 € (communes ordinaires), 120 € (grandes villes de 200 000 habitants et plus, communes du Grand Paris), 140 € (Paris). Logé gratuitement : rien.',
    'Étranger : un forfait journalier par pays, en devise, converti avec les taux de la BCE ; 65 % pour la nuit, 17,5 % par repas. Les repas pris pendant le trajet en France restent à 20 €. Logé ou nourri gratuitement : la part correspondante est déduite.',
    'Petit-déjeuner : pas indemnisé à part, il est compris dans la nuitée. Nuit imprévue (train annulé, grève, retard sur ordre) : indemnisée si elle est justifiée (facture d\'hôtel et attestation de retard ou d\'annulation).',
    'Indemnités kilométriques (véhicule personnel) : 0,32 €/km (5 CV et moins), 0,41 €/km (6 et 7 CV), 0,45 €/km (8 CV et plus), barème de la fonction publique.',
    'Véhicule personnel : seulement sur autorisation (au 4e RIISC, c\'est le chef de corps qui l\'autorise), avec une assurance qui couvre les trajets professionnels. Autorisé : péage et parking remboursés sur justificatif.',
    'Véhicule de service : pas d\'indemnités kilométriques ; carburant et péage avec les moyens de l\'unité. Taxi : seulement en l\'absence de transport en commun ou en cas d\'urgence, si c\'est autorisé, sur justificatif.',
    'Avance : possible jusqu\'à 75 % des frais prévus, à demander avant le départ (case « Demande d\'avance » de la demande de mise en route).',
    'Consignes du 4e RIISC : le compte-rendu se rend dans les 30 jours après la date de fin de mission ; les billets de train et d\'avion passent par l\'organisme de réservation Amplitude (ABT).',
    'Références : pour les militaires, décret n° 2009-545 du 14 mai 2009 modifié et son instruction d\'application n° 230600/DRH-MD/SPGRH/FM2 (indemnités forfaitaires, dépense réelle et justifiée) ; régime des civils sur lequel ils sont alignés : décret n° 2006-781 du 3 juillet 2006 ; taux : arrêtés du 3 juillet 2006 (indemnités de mission ; indemnités kilométriques, modifiées par les arrêtés du 26 février 2019 et du 14 mars 2022). Tu peux citer ces textes, sans inventer de numéro d\'article. Pour tout cas non couvert ici (restaurant administratif accessible mais repas pris ailleurs, hôtel plus cher que le forfait, outre-mer, classe de train ou avion, mission annulée, justificatif perdu, stage, délai de remboursement), dis que l\'assistant Chorus DT de l\'unité fait foi et ne donne pas de chiffre.'
].join('\n');
function consigneAide(base, fiches, ecran, appli, mission, libre, extraits, outils) {
    return [
        'Tu es la mascotte de TRIGONE, l\'application du 4e RIISC pour les demandes d\'ordre de mise en route (avant une mission) et les comptes-rendus de mission (horodatages, frais et justificatifs, au retour). Tu es un assistant conversationnel complet, chaleureux et vif d\'esprit : un camarade bienveillant qui connaît l\'appli par cœur.',
        'TA FAÇON DE PARLER :',
        '- Réponds en français, naturellement, comme dans une vraie conversation : des phrases simples et vivantes, pas un mode d\'emploi. Adapte la longueur : une phrase pour un « merci », quelques phrases ou des étapes courtes pour une vraie question.',
        '- Vouvoie par défaut ; si la personne te tutoie et reste détendue, tu peux la tutoyer aussi.',
        '- Si la personne plaisante ou parle sur un ton léger, joue le jeu avec un humour bienveillant (un trait d\'esprit, une touche militaire), sans jamais te moquer d\'elle. Si elle est stressée ou agacée, sois rassurant et efficace.',
        '- Comprends toutes les façons d\'écrire : langage familier, SMS, fautes de frappe, argot et sigles militaires. Varie tes tournures.',
        '- Une question courte (« et Paris ? », « et en 7 CV ? ») est la SUITE de la précédente : appuie-toi sur la conversation ci-dessous.',
        'CE QUE TU PEUX FAIRE : répondre à n\'importe quelle question avec tes connaissances générales — discuter, conseiller, expliquer, aider à rédiger (motif d\'une demande, message à son chef, commentaire), parler de la ville de destination, de voyage, de la vie de tous les jours, ou simplement bavarder. Tu n\'es pas obligé de ramener chaque échange à TRIGONE.',
        'LES SEULES LIMITES :',
        '- Montants, taux, barèmes, droits, délais et règles de remboursement : uniquement les règles et les données fournies ci-dessous. Ne les invente jamais et ne les « arrondis » pas de mémoire ; si ce n\'est pas couvert, dis que l\'assistant Chorus DT de l\'unité fait foi.',
        '- Boutons et écrans de TRIGONE : uniquement d\'après la description des écrans et les fiches ci-dessous (en **gras**). N\'invente aucun bouton. Si tu ne sais pas, propose « Paramètres › Aide › Signaler un problème ».',
        '- Reste toujours respectueux. Pas de propos haineux, discriminatoires, obscènes ou dangereux ; reste neutre sur la politique et les sujets qui divisent ; ne donne pas d\'information militaire sensible ou classifiée.',
        '- Ne demande jamais d\'information personnelle (nom, matricule, code, mot de passe) et n\'en répète aucune.',
        '- Si une fiche ci-dessous t\'a servi, termine ta réponse par [FICHE:identifiant] (une seule) ; sinon, ne mets rien.',
        'VOCABULAIRE DES MILITAIRES : « chef », « juteux », « cds », « N+1 », « adjudant », « capitaine » = le plus souvent le VALIDEUR 1 ; « chef de corps », « colon », « pacha », « N+2 » = VALIDEUR 2 ; « assist », « Chorus », « la DT » = l\'assistant Chorus DT ; « OM », « OMR », « DOMR », « ordre de mission » = la demande de mise en route ; « CR » = compte-rendu ; « VL perso », « caisse » = véhicule personnel ; « IK », « bornes » = indemnités kilométriques ; « code FD », « Fd@ligne » = code d\'engagement ; « NDS », « DAF » = la note de service ou la décision à joindre ; « mdp » = code de connexion ; « perm » = absence.',
        'RÈGLES DE CALCUL DES FRAIS (seules règles que tu peux citer) :\n' + REGLES_FRAIS,
        libre ? 'Si la personne demande où cliquer dans TRIGONE, invite-la à préciser l\'écran ou l\'action : tu n\'as pas la description des écrans sous les yeux pour cette question, n\'invente aucun bouton.' : '',
        mission ? 'MISSION EN COURS DE LA PERSONNE (pour répondre selon SA situation) : ' + mission : '',
        'APPLI OUVERTE : ' + appli + '.',
        ecran && !libre ? 'ÉCRAN OUVERT PAR L\'UTILISATEUR : ' + ecran.nom + ' — ' + ecran.d : '',
        // Seulement les écrans utiles (écran ouvert, écrans des fiches) : la consigne reste courte, l'IA consomme moins du quota gratuit.
        libre ? '' : 'LES ÉCRANS DE TRIGONE UTILES ICI (où cliquer) :\n' + base.ecrans.filter(e => (ecran && e.id === ecran.id) || fiches.some(f => (f.e || []).includes(e.id))).map(e => '* ' + e.nom + ' : ' + e.d).join('\n'),
        libre ? '' : fiches.length ? 'FICHES UTILES :\n' + fiches.map(f => '[' + f.id + '] ' + f.t + ' :\n' + texteSimple(f.r)).join('\n\n') : 'Aucune fiche ne correspond directement à la question.',
        // Passages trouvés par le sens de la question dans toute la notice et toutes les fiches.
        (extraits || []).length ? 'PASSAGES DE LA NOTICE ET DES FICHES LES PLUS PROCHES DE LA QUESTION (sers-t\'en s\'ils répondent ; boutons en **gras** d\'après eux seulement) :\n' +
            extraits.map(x => (x.fiche ? '[' + x.fiche + '] ' : '') + x.titre + ' :\n' + x.texte).join('\n\n') : '',
        outils ? 'OUTILS DE CALCUL : pour tout montant (nuits, repas, mission complète), indemnités kilométriques, code FD, ou l\'état des demandes, comptes-rendus ou validations de la personne, APPELLE l\'outil qui convient au lieu de répondre de mémoire : TRIGONE fait le calcul exact sur son appareil et tu reçois le résultat. Sans besoin de calcul, réponds directement.' : ''
    ].filter(Boolean).join('\n');
}

// ---------- IA de la mascotte : outils, recherche par le sens, consommation ----------
// Texte d'une réponse de Workers AI (deux formats selon les modèles).
function sortieIa(r) { return String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '').trim(); }
// Outils que l'IA peut demander : ils s'exécutent sur l'appareil de la personne (aide/aide.js), avec les moteurs exacts de
// TRIGONE (barèmes, IK, codier FD, suivi) et ses propres données ; le serveur ne fait que transmettre.
const OUTILS_AIDE = [
    { name: 'calculer_mission', description: 'Calcule le remboursement estimé d\'une mission ou d\'un stage (nuits, repas, transport, indemnités kilométriques) avec les barèmes officiels de TRIGONE.',
        parameters: { type: 'object', properties: { destination: { type: 'string', description: 'Ville (France) ou pays de la mission' }, depart: { type: 'string', description: 'Ville de départ, si elle est donnée' },
            jours: { type: 'integer', description: 'Nombre de jours de mission' }, nuits: { type: 'integer', description: 'Nombre de nuits, si seules les nuits sont demandées' },
            repas: { type: 'integer', description: 'Nombre de repas, si seuls les repas sont demandés' }, transport: { type: 'string', description: 'train, avion, vrc (véhicule personnel), service ou commun' },
            cv: { type: 'integer', description: 'Puissance fiscale du véhicule personnel (CV)' } }, required: ['destination'] } },
    { name: 'bareme_lieu', description: 'Taux de remboursement de la nuitée et du repas pour une ville de France ou un pays étranger.',
        parameters: { type: 'object', properties: { lieu: { type: 'string', description: 'Ville ou pays' } }, required: ['lieu'] } },
    { name: 'indemnites_kilometriques', description: 'Indemnités kilométriques (véhicule personnel) entre deux villes, distance comprise.',
        parameters: { type: 'object', properties: { depart: { type: 'string' }, arrivee: { type: 'string' }, cv: { type: 'integer', description: 'Puissance fiscale (CV)' } }, required: ['depart', 'arrivee'] } },
    { name: 'codes_fd', description: 'Codes FD (codes d\'imputation FD@LIGNE) de l\'unité pour un type de dépense ou de mission.',
        parameters: { type: 'object', properties: { recherche: { type: 'string', description: 'Ex. : déplacement, formation, stage, mission opérationnelle' }, unite: { type: 'string', description: 'Unité, si elle est précisée' } }, required: [] } },
    { name: 'mes_demandes', description: 'Où en sont les demandes de mise en route de la personne (valideurs, assistant Chorus DT).', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'mon_compte_rendu', description: 'Où en sont les comptes-rendus de mission de la personne.', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'a_valider', description: 'Ce que la personne a à valider ou à traiter (valideurs et assistant Chorus DT).', parameters: { type: 'object', properties: {}, required: [] } }
];
const NOMS_OUTILS = OUTILS_AIDE.map(o => o.name);
const OUTILS_INDICES = /\d|combien|€|euro|rembours|toucher|tarif|bar[eè]me|taux|nuit|repas|ik\b|kilom|code|fd|imputation|o[uù] en est|demande|compte.rendu|\bcr\b|valider|signer/i;
// Appels d'outils dans une réponse : format OpenAI (choices[0].message.tool_calls), format Workers AI (tool_calls), ou
// à défaut un appel écrit en JSON dans le texte.
function appelsOutils(r) {
    let l = (r && (r.tool_calls || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.tool_calls))) || [];
    if (!l.length) { const t = sortieIa(r); if (/^[\[{][\s\S]*"name"\s*:/.test(t)) { try { const j = JSON.parse(t); l = Array.isArray(j) ? j : [j]; } catch (e) {} } }
    return l.map(c => { const f = (c && c.function) || c || {}; let a = f.arguments || f.parameters || {}; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = {}; } }
        return { nom: String(f.name || ''), args: a && typeof a === 'object' ? a : {} }; }).filter(c => NOMS_OUTILS.includes(c.nom)).slice(0, 3);
}
// Consommation du jour (jetons envoyés / reçus par modèle), pour ajuster les plafonds au quota gratuit.
async function noterConso(kv, jour, modele, usage) {
    const cleU = 'aide-ia-conso:' + jour, u = (await kv.get(cleU, 'json')) || {}, x = u[modele] || { q: 0, entree: 0, sortie: 0 };
    x.q++; if (usage) { x.entree += +usage.prompt_tokens || 0; x.sortie += +usage.completion_tokens || 0; } u[modele] = x;
    await kv.put(cleU, JSON.stringify(u), { expirationTtl: 2592000 });
}
// Recherche par le sens : chaque fiche et chaque page de la notice devient un vecteur (modèle multilingue bge-m3 de
// Workers AI), calculé une fois par version de la base et gardé dans le KV en binaire (lecture sans analyse JSON) ;
// la question est comparée à tous (produit scalaire de vecteurs normés).
const MODELE_SENS = '@cf/baai/bge-m3', SENS_SEUIL = 0.42, SENS_SUJET = 0.58;
let NOTICE_AIDE = null;
function normer(v) { let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i]; n = Math.sqrt(n) || 1; const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / n; return o; }
async function extraitsAide(env, ia, url, base, question, exclus) {
    if (!NOTICE_AIDE) { const r = await env.ASSETS.fetch(new Request(new URL('/aide/notice.json', url).toString())); NOTICE_AIDE = r.ok ? await r.json() : { pages: [] }; }
    const morceaux = base.fiches.map(f => ({ fiche: f.id, titre: f.t, texte: texteSimple(f.r) }))
        .concat((NOTICE_AIDE.pages || []).map(p => ({ fiche: '', titre: 'Notice › ' + p.t, texte: p.x })));
    if (!morceaux.length) return [];
    const cle = 'aide-sens:' + (await empreinte(morceaux.map(m => m.titre + '|' + m.texte.length).join('#'))).slice(0, 24);
    let buf = await env.TRIGONE_KV.get(cle, 'arrayBuffer'), dim = 0, tout = null;
    if (buf) { tout = new Float32Array(buf); dim = tout.length / morceaux.length; }
    if (!tout || dim !== Math.round(dim)) {
        const vecs = [];
        for (let i = 0; i < morceaux.length; i += 40) {
            const r = await ia.run(MODELE_SENS, { text: morceaux.slice(i, i + 40).map(m => (m.titre + ' : ' + m.texte).slice(0, 1200)) });
            (r && r.data || []).forEach(v => vecs.push(normer(v)));
        }
        if (vecs.length !== morceaux.length) return [];
        dim = vecs[0].length; tout = new Float32Array(dim * vecs.length); vecs.forEach((v, i) => tout.set(v, i * dim));
        await env.TRIGONE_KV.put(cle, tout.buffer, { expirationTtl: 30 * 86400 });
    }
    const rq = await ia.run(MODELE_SENS, { text: [question] }), q = normer((rq && rq.data && rq.data[0]) || []);
    if (q.length !== dim) return [];
    const notes = morceaux.map((m, i) => { let s = 0; const o = i * dim; for (let k = 0; k < dim; k++) s += q[k] * tout[o + k]; return { m, s }; })
        .filter(x => x.s >= SENS_SEUIL && !(x.m.fiche && (exclus || []).includes(x.m.fiche))).sort((a, b) => b.s - a.s).slice(0, 3);
    return notes.map(x => ({ fiche: x.m.fiche, titre: x.m.titre, texte: x.m.texte.slice(0, 700), score: Math.round(x.s * 100) / 100 }));
}
// Tests locaux (MODE_TEST et AIDE_IA_SIMULEE) : réponse fabriquée, sans appeler Workers AI.
function vecteurSimule(t) {
    const v = new Array(256).fill(0);
    String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(m => m.length > 3).forEach(m => { let h = 7; for (const c of m.slice(0, 6)) h = (h * 31 + c.charCodeAt(0)) % 256; v[h] += 1; });
    return v;
}
const iaSimulee = { run: async (modele, o) => {
    if (modele === MODELE_SENS) return { data: o.text.map(vecteurSimule) };
    const sys = o.messages[0].content, q = o.messages[o.messages.length - 1].content;
    // Outils : « combien … à <Ville> » demande le calcul de la mission ; le 2e temps reprend les résultats.
    const m = /combien[^?]* (?:a|à) ([A-Z][a-zé-]+)/.exec(q);
    if (o.tools && m) return { tool_calls: [{ name: 'calculer_mission', arguments: { destination: m[1], nuits: +((/(\d+) nuits?/.exec(q) || [])[1] || 0) || undefined } }] };
    if (/^RÉSULTATS EXACTS/.test(q)) return { response: 'Réponse simulée avec les calculs : ' + q.split('\n')[1] };
    const id = (/\[([a-z0-9-]+)\] /.exec(sys.split('FICHES UTILES :')[1] || '') || [])[1];
    return { response: 'Réponse simulée à « ' + q + ' » : touchez **Documents**.' + (id ? ' [FICHE:' + id + ']' : '') };
} };

async function api(requete, env, url, ctx) {
    const kv = env.TRIGONE_KV;
    if (!kv || !env.TRIGONE_DB) return erreur(503, 'Boîte aux lettres non configurée.');
    await remiseAZero(env);
    const chemin = url.pathname.replace(/^\/api\//, '');
    const methode = requete.method;

    if (chemin === 'etat') return json({ ok: true, version: 1, connexionMail: env.MODE_TEST === '1' });   // connexion par mail : tests locaux seulement
    // Taux de change pour les missions à l'étranger (Compte-rendu) : euros pour 1 unité de chaque devise du barème,
    // d'après les taux de référence quotidiens de la Banque centrale européenne (gardés 6 h) ; devises à parité fixe
    // (franc CFA, escudo, franc de Djibouti, dinar jordanien) calculées. Public : aucune donnée personnelle.
    if (chemin === 'taux' && methode === 'GET') {
        const garde = await kv.get('taux:bce', 'json');
        if (garde && Date.now() - garde.le < 6 * 3600 * 1000) return json({ ok: true, date: garde.date, taux: garde.taux, source: 'BCE' });
        try {
            const r = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', { cf: { cacheTtl: 3600 } });
            if (!r.ok) throw new Error('BCE ' + r.status);
            const xml = await r.text();
            const date = (/time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml) || [])[1] || '';
            const bce = {};
            for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) bce[m[1]] = parseFloat(m[2]);
            if (!bce.USD || !date) throw new Error('BCE illisible');
            const eur = code => bce[code] ? Math.round(1e6 / bce[code]) / 1e6 : null;
            const noms = { 'DOLLAR US': 'USD', 'DOLLAR AMERICAIN': 'USD', 'DOLLAR DES BERMUDES': 'USD', 'LIVRE STERLING': 'GBP', 'FRANC SUISSE': 'CHF',
                'DOLLAR CANADIEN': 'CAD', 'DOLLAR AUSTRALIEN': 'AUD', 'DOLLAR NEO-ZELANDAIS': 'NZD', 'YEN': 'JPY', 'YUAN CHINOIS': 'CNY',
                'DOLLAR DE HONG KONG': 'HKD', 'DOLLAR SINGAPOURIEN': 'SGD', 'DOLLAR DE BRUNEI': 'SGD', 'COURONNE DANOISE': 'DKK',
                'COURONNE NORVEGIENNE': 'NOK', 'COURONNE SUEDOISE': 'SEK', 'COURONNE ISLANDAISE': 'ISK', 'PESO MEXICAIN': 'MXN',
                'PESO PHILIPPIN': 'PHP', 'RINGGIT': 'MYR', 'BAHT': 'THB' };
            const taux = { 'EURO': 1, 'FRANC CFA': Math.round(1e8 / 655.957) / 1e8, 'ESCUDO': Math.round(1e8 / 110.265) / 1e8 };
            Object.keys(noms).forEach(n => { const v = eur(noms[n]); if (v) taux[n] = v; });
            taux['FRANC DJIBOUTI'] = Math.round(1e8 * taux['DOLLAR US'] / 177.721) / 1e8;
            taux['DINAR JORDANIEN'] = Math.round(1e6 * taux['DOLLAR US'] / 0.709) / 1e6;
            await kv.put('taux:bce', JSON.stringify({ le: Date.now(), date, taux }), { expirationTtl: 7 * 86400 });
            return json({ ok: true, date, taux, source: 'BCE' });
        } catch (e) {
            if (garde) return json({ ok: true, date: garde.date, taux: garde.taux, source: 'BCE' });
            return erreur(502, 'Taux de change indisponibles pour le moment.');
        }
    }
    // Distance routière entre deux communes françaises (indemnités kilométriques du Compte-rendu) : communes situées
    // puis itinéraire calculé par la Géoplateforme de l'IGN (secours : Base adresse nationale, OSRM). Gardé 180 jours.
    // Public : seuls deux noms de villes transitent, rien n'est rattaché à une personne.
    if (chemin === 'distance' && methode === 'GET') {
        const de = nettoyerVille(url.searchParams.get('de')), a = nettoyerVille(url.searchParams.get('a'));
        if (!de.nom || !a.nom) return erreur(400, 'Villes de départ et d\'arrivée attendues.');
        if (de.nom === a.nom && de.cp === a.cp) return json({ ok: true, km: 0 });
        const cle = 'distance:' + [de.nom + '|' + de.cp, a.nom + '|' + a.cp].sort().join('>');
        const garde = await kv.get(cle, 'json');
        if (garde) return json({ ok: true, km: garde.km, de: garde.de || '', a: garde.a || '' });
        const ip = requete.headers.get('CF-Connecting-IP') || 'local';
        const n = +(await kv.get('limite-distance:' + ip)) || 0;
        if (n >= 120) return erreur(429, 'Trop de calculs de distance. Réessayez dans une heure.');
        await kv.put('limite-distance:' + ip, String(n + 1), { expirationTtl: 3600 });
        const traces = [];
        try {
            const [p1, p2] = await Promise.all([situerVille(de, traces), situerVille(a, traces)]);
            if (!p1 || !p2) return erreur(404, 'Ville introuvable : ' + (!p1 ? de.nom : a.nom) + '.');
            const res = { km: Math.round(await distanceRoute(p1, p2, traces)), de: p1.nom, a: p2.nom };
            await kv.put(cle, JSON.stringify(res), { expirationTtl: 180 * 86400 });
            return json({ ok: true, km: res.km, de: res.de, a: res.a });
        } catch (e) {
            // Détail (services joints ou non) lisible en ouvrant l'adresse /api/distance?de=…&a=… dans un navigateur.
            return json({ ok: false, erreur: 'Calcul de distance indisponible pour le moment.', etape: String(e.message || e), detail: traces }, 502);
        }
    }
    // Clé publique VAPID : l'appareil s'abonne aux notifications avec elle.
    if (chemin === 'push/cle' && methode === 'GET') return json({ ok: true, cle: (await clesVapid(env)).pub });

    // 1. Inscription : code à 6 chiffres envoyé à l'adresse professionnelle.
    // Connexion par code reçu par mail : retirée (plus aucun mail n'est envoyé) ; gardée pour les tests locaux seulement.
    if (chemin === 'inscription/code' && methode === 'POST') {
        if (env.MODE_TEST !== '1') return erreur(410, 'La connexion par adresse mail n\'existe plus. Nouvel appareil : sur votre ancien appareil, Paramètres › Compte › « Ajouter un appareil », puis « J\'ai déjà TRIGONE sur un autre appareil ». Ancien appareil perdu : demandez un code de réactivation à l\'administrateur de votre unité.');
        const { mail: brut } = await requete.json().catch(() => ({}));
        const mail = normaliser(brut);
        if (!mailValide(mail)) return erreur(400, 'Adresse mail invalide.');
        if (!domaineAutorise(env, mail)) return erreur(403, 'Seules les adresses professionnelles sont acceptées (' + env.DOMAINES_AUTORISES + ').');
        const n = +(await kv.get('limite:' + mail)) || 0;
        if (n >= 5) return erreur(429, 'Trop de codes demandés. Réessayez dans une heure.');
        await kv.put('limite:' + mail, String(n + 1), { expirationTtl: 3600 });
        const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
        await kv.put('code:' + mail, JSON.stringify({ empreinte: await empreinte(mail + ':' + code), essais: 0 }), { expirationTtl: 900 });
        return json({ ok: true, codeTest: code });
    }

    // 2. Code saisi : l'appareil est enregistré avec sa clé publique ; il reçoit son jeton d'accès.
    if (chemin === 'inscription/valider' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const mail = normaliser(corps.mail);
        const enreg = await kv.get('code:' + mail, 'json');
        if (!enreg) return erreur(400, 'Code expiré. Demandez-en un nouveau.');
        if (enreg.essais >= 5) return erreur(429, 'Trop d\'essais. Demandez un nouveau code.');
        if ((await empreinte(mail + ':' + String(corps.code || '').trim())) !== enreg.empreinte) {
            enreg.essais++;
            await kv.put('code:' + mail, JSON.stringify(enreg), { expirationTtl: 900 });
            return erreur(400, 'Code incorrect.');
        }
        const cle = corps.cle;
        if (!cle || cle.kty !== 'EC' || cle.crv !== 'P-256' || !cle.x || !cle.y || cle.d) return erreur(400, 'Clé d\'appareil invalide.');
        await kv.delete('code:' + mail);
        const compte = (await kv.get('compte:' + mail, 'json')) || { appareils: [] };
        const jeton = b64url(hasard(32));
        const app = { id: b64url(hasard(9)), cle: { kty: 'EC', crv: 'P-256', x: cle.x, y: cle.y }, jeton: await empreinte(jeton),
            nom: String(corps.nom || 'Appareil').slice(0, 60), cree: Date.now() };
        compte.appareils = compte.appareils.concat(app).slice(-10);   // 10 appareils au plus par compte
        await kv.put('compte:' + mail, JSON.stringify(compte));
        return json({ ok: true, mail, appareil: app.id, jeton });
    }

    // Inscription sans adresse mail : identité seule. Le compte reçoit son adresse prenom.nom@trigone-app.com (qui lui sert
    // d'identifiant) et reste « en attente » jusqu'à sa validation par l'administrateur ou l'assistant Chorus DT de l'unité.
    if (chemin === 'inscription/directe' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const ip = requete.headers.get('CF-Connecting-IP') || 'local', n = +(await kv.get('limite-inscr:' + ip)) || 0;
        if (n >= 20) return erreur(429, 'Trop d\'inscriptions depuis ce réseau : réessayez dans une heure.');
        await kv.put('limite-inscr:' + ip, String(n + 1), { expirationTtl: 3600 });
        const t = (v, n) => String(v || '').trim().slice(0, n);
        const grade = t(corps.grade, 30).toUpperCase(), nom = t(corps.nom, 60).toUpperCase(), prenom = t(corps.prenom, 60), u = uniteRegistre(requete);
        if (!nom || !prenom) return erreur(400, 'Indiquez votre nom et votre prénom.');
        const mdp = String(corps.mdp || '');
        if (mdp && (mdp.length < 8 || mdp.length > 200)) return erreur(400, 'Le code de connexion contient 8 caractères au moins.');
        if (u === UNITE_REGISTRE && !requete.headers.get('X-Trigone-Unite')) return erreur(400, 'Indiquez votre unité.');
        const cle = corps.cle;
        if (!cle || cle.kty !== 'EC' || cle.crv !== 'P-256' || !cle.x || !cle.y || cle.d) return erreur(400, 'Clé d\'appareil invalide.');
        const base = [slugAdresse(prenom), slugAdresse(nom)].filter(Boolean).join('.');
        // Compte déjà existant à ce nom : on propose de se connecter plutôt que de créer un doublon (prenom.nom2),
        // sauf si la personne confirme être un homonyme.
        if (!corps.homonyme && base && !ADRESSES_RESERVEES.includes(base) && (await kv.get('adresse:' + base) || await kv.get('compte:' + base + '@' + DOMAINE_RECEPTION)))
            return json({ ok: false, existe: true, adresse: base + '@' + DOMAINE_RECEPTION, erreur: 'Un compte TRIGONE existe déjà à ce nom.' }, 409);
        let local = '';
        for (let i = 1; i < 200 && !local; i++) {
            const l = base + (i > 1 ? i : '');
            if (ADRESSES_RESERVEES.includes(l) || lireGroupe(l + '@' + DOMAINE_RECEPTION) || await kv.get('adresse:' + l) || await kv.get('compte:' + l + '@' + DOMAINE_RECEPTION)) continue;
            local = l;
        }
        if (!local) return erreur(409, 'Adresse TRIGONE indisponible pour ce nom.');
        const mail = local + '@' + DOMAINE_RECEPTION, jeton = b64url(hasard(32));
        const app = { id: b64url(hasard(9)), cle: { kty: 'EC', crv: 'P-256', x: cle.x, y: cle.y }, jeton: await empreinte(jeton), nom: t(corps.appareil, 60) || 'Appareil', cree: Date.now() };
        const selMdp = hasard(16), cpt = { appareils: [app], attente: true, cree: Date.now(), sansMail: true };
        if (mdp) cpt.mdp = { sel: b64url(selMdp), h: await empreinteMdp(mdp, selMdp), le: Date.now() };
        await kv.put('compte:' + mail, JSON.stringify(cpt));
        await kv.put('adresse:' + local, mail); await kv.put('adresse-de:' + mail, local); await kv.put('unite-de:' + mail, u);
        await majLigneCompte(env, mail, { unite: u, grade, nom, prenom, adresse: mail, statut: 'attente', le: Date.now() });
        // Prévenus : administrateurs de l'unité, assistants Chorus DT de l'unité.
        const db = await baseBoite(env), qui = [grade, nom, prenom].filter(Boolean).join(' ');
        const chorus = ((await db.prepare("SELECT mail FROM porteur_role WHERE roles LIKE '%chorus%'").all()).results || []).map(x => x.mail);
        const dest = new Set(await adminsDe(env, u));
        for (const m of chorus.slice(0, 200)) if ((await kv.get('unite-de:' + m)) === u) dest.add(m);
        await Promise.all([...dest].map(m => notifierCompte(env, m, { titre: 'Nouvelle inscription', texte: qui + ' demande à rejoindre TRIGONE : à valider.', type: 'COMPTE', url: '/?espace=comptes' }, url.origin).catch(() => {})));
        return json({ ok: true, mail, appareil: app.id, jeton, adresse: mail, attente: true, prevenus: dest.size });
    }

    // Liaison d'un nouvel appareil (code affiché sur un appareil déjà configuré) : l'appareil est ajouté au compte, sans
    // code par mail, et reçoit le paquet chiffré (réglages, rôles, données) — le code, qui le déchiffre, ne vient jamais ici.
    if (chemin === 'liaison/utiliser' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const ip = requete.headers.get('CF-Connecting-IP') || 'local';
        const n = +(await kv.get('limite-liaison:' + ip)) || 0;
        if (n >= 60) return erreur(429, 'Trop d\'essais. Réessayez dans un quart d\'heure.');   // par adresse réseau (tout un site peut partager la même)
        await kv.put('limite-liaison:' + ip, String(n + 1), { expirationTtl: 900 });
        const id = String(corps.id || '');
        if (!/^[\w-]{20,64}$/.test(id)) return erreur(400, 'Code de liaison invalide.');
        const l = await kv.get('liaison:' + id, 'json');
        if (!l) return erreur(404, 'Code inconnu ou expiré : affichez-en un nouveau sur l\'autre appareil.');
        const cle = corps.cle;
        if (!cle || cle.kty !== 'EC' || cle.crv !== 'P-256' || !cle.x || !cle.y || cle.d) return erreur(400, 'Clé d\'appareil invalide.');
        await kv.delete('liaison:' + id);
        const compte = await kv.get('compte:' + l.mail, 'json');
        if (!compte) return erreur(404, 'Le compte TRIGONE de l\'autre appareil n\'existe plus.');
        if (compte.bloque) return erreur(403, 'Ce compte TRIGONE est bloqué : demandez à l\'administrateur de le débloquer.');
        const jeton = b64url(hasard(32));
        const app = { id: b64url(hasard(9)), cle: { kty: 'EC', crv: 'P-256', x: cle.x, y: cle.y }, jeton: await empreinte(jeton),
            nom: String(corps.nom || 'Appareil').slice(0, 60), cree: Date.now() };
        compte.appareils = compte.appareils.concat(app).slice(-10);
        delete compte.mdpEchecs;   // connexion par code coupée après trop d'erreurs : rétablie par un QR ou un code de réactivation
        if (l.reactivation) compte.mdpLibre = true;   // code oublié : le nouveau code se choisit sans l'ancien
        await kv.put('compte:' + l.mail, JSON.stringify(compte));
        return json({ ok: true, mail: l.mail, appareil: app.id, jeton, paquet: l.paquet, reactivation: !!l.reactivation });
    }

    // Connexion avec l'adresse TRIGONE et le code de connexion (choisi à l'inscription, 8 caractères au moins), depuis
    // n'importe quel appareil. Contre les essais au hasard : 5 erreurs → 15 minutes d'attente ; 10 erreurs sans réussite →
    // connexion par code coupée (rétablie par un QR / code de liaison ou un code de réactivation de l'administrateur).
    // Les données reviennent ensuite toutes seules (sauvegarde du compte, voir donnees/cle).
    if (chemin === 'connexion/motdepasse' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const ip = requete.headers.get('CF-Connecting-IP') || 'local';
        const n = +(await kv.get('limite-cnx:' + ip)) || 0;
        if (n >= 30) return erreur(429, 'Trop d\'essais. Réessayez dans un quart d\'heure.');
        await kv.put('limite-cnx:' + ip, String(n + 1), { expirationTtl: 900 });
        let saisie = normaliser(corps.mail);
        if (saisie && saisie.indexOf('@') < 0) saisie += '@' + DOMAINE_RECEPTION;
        const code = String(corps.mdp || '');
        if (!mailValide(saisie) || code.length < 8 || code.length > 200) return erreur(400, 'Indiquez votre adresse TRIGONE et votre code de connexion (8 caractères au moins).');
        const cle = corps.cle;
        if (!cle || cle.kty !== 'EC' || cle.crv !== 'P-256' || !cle.x || !cle.y || cle.d) return erreur(400, 'Clé d\'appareil invalide.');
        const mail = await cleCompte(kv, saisie), compte = await kv.get('compte:' + mail, 'json');
        const refus = 'Adresse ou code de connexion incorrect.';
        if (!compte || !compte.mdp) return erreur(403, refus);
        if (compte.bloque) return erreur(403, 'Ce compte TRIGONE est bloqué : demandez à l\'administrateur de le débloquer.');
        const e = compte.mdpEchecs || { n: 0, total: 0, jusqua: 0 };
        if (e.total >= 10) return erreur(403, 'Trop d\'erreurs : la connexion par code est coupée pour ce compte. Demandez un code de réactivation à l\'administrateur de votre unité (ou utilisez le QR de connexion d\'un autre appareil).');
        if (e.jusqua > Date.now()) return erreur(429, 'Trop d\'erreurs : réessayez dans ' + Math.ceil((e.jusqua - Date.now()) / 60000) + ' minute(s).');
        if (await empreinteMdp(code, depuisB64url(compte.mdp.sel)) !== compte.mdp.h) {
            e.n = (e.n || 0) + 1; e.total = (e.total || 0) + 1;
            if (e.n >= 5) { e.n = 0; e.jusqua = Date.now() + 15 * 60000; }
            compte.mdpEchecs = e; await kv.put('compte:' + mail, JSON.stringify(compte));
            if (e.total === 5 || e.total === 10) await notifierCompte(env, mail, { titre: 'TRIGONE : essais de connexion', texte: e.total + ' codes faux ont été saisis pour vous connecter à votre compte' + (e.total >= 10 ? ' : la connexion par code est coupée.' : '.') + ' Si ce n\'est pas vous, changez votre code de connexion.', type: 'COMPTE', url: '/' }, url.origin).catch(() => {});
            return erreur(403, refus + (e.total >= 10 ? '' : ' (' + (10 - e.total) + ' essai(s) restant(s))'));
        }
        delete compte.mdpEchecs;
        const jeton = b64url(hasard(32));
        const app = { id: b64url(hasard(9)), cle: { kty: 'EC', crv: 'P-256', x: cle.x, y: cle.y }, jeton: await empreinte(jeton),
            nom: String(corps.nom || 'Appareil').slice(0, 60), cree: Date.now() };
        compte.appareils = compte.appareils.concat(app).slice(-10);
        await kv.put('compte:' + mail, JSON.stringify(compte));
        await notifierCompte(env, mail, { titre: 'TRIGONE : nouvelle connexion', texte: 'Votre compte vient d\'être ouvert sur un nouvel appareil (' + app.nom + '). Si ce n\'est pas vous : Paramètres › Compte › Mes appareils, retirez-le et changez votre code de connexion.', type: 'COMPTE', url: '/' }, url.origin).catch(() => {});
        return json({ ok: true, mail, appareil: app.id, jeton });
    }

    // Erreur technique remontée par une appli (sans compte : elle peut survenir avant la connexion). Anonyme :
    // version, écran, message et emplacement dans le code, type d'appareil. Limitée par adresse réseau.
    if (chemin === 'erreur' && methode === 'POST') {
        const ip = requete.headers.get('CF-Connecting-IP') || 'local';
        const n = +(await kv.get('limite-erreur:' + ip)) || 0;
        if (n >= 60) return json({ ok: true });
        await kv.put('limite-erreur:' + ip, String(n + 1), { expirationTtl: 3600 });
        const c = await requete.json().catch(() => ({}));
        const t = (v, l) => String(v || '').slice(0, l);
        const x = { app: t(c.app, 8), ecran: t(c.ecran, 80), msg: t(c.msg, 300), src: t(c.src, 160), pile: t(c.pile, 600), v: Math.round(+c.v || 0), ua: t(c.ua, 60), appareil: t(c.appareil, 24) };
        if (!x.msg || !/^(mer|cr|choix)$/.test(x.app)) return json({ ok: true });
        const sig = (await empreinte(x.app + '|' + x.msg + '|' + x.src)).slice(0, 32), le = Date.now(), db = await baseBoite(env);
        await db.batch([
            db.prepare('INSERT INTO erreur (sig, app, ecran, msg, src, pile, v, ua, n, premier, dernier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?) ' +
                'ON CONFLICT (sig) DO UPDATE SET n = n + 1, dernier = excluded.dernier, v = MAX(v, excluded.v), ecran = excluded.ecran, ua = excluded.ua, pile = excluded.pile')
                .bind(sig, x.app, x.ecran, x.msg, x.src, x.pile, x.v, x.ua, le, le),
            db.prepare('INSERT OR IGNORE INTO erreur_appareil (sig, appareil) VALUES (?, ?)').bind(sig, x.appareil || 'inconnu')
        ]);
        return json({ ok: true });
    }

    // Carte TRIGONE : le QR code du verso porte un identifiant au hasard (rien de lisible). Lu par l'appli d'un compte
    // connecté (ajout à une mission collective, mail d'un valideur, remplaçant, pointage) : identité complète avec mail
    // et NID ; lu par n'importe quel téléphone (page de vérification) : seulement grade, nom, prénom et unité.
    if (chemin === 'carte' && methode === 'GET') {
        const id = String(new URL(requete.url).searchParams.get('id') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
        const lecteur = await appareilConnecte(env, requete);
        const quota = 'quota-carte:' + (lecteur ? lecteur.mail : (requete.headers.get('CF-Connecting-IP') || 'ip')) + ':' + new Date().toISOString().slice(0, 13);
        const n = +(await kv.get(quota)) || 0;
        if (n >= (lecteur ? 200 : 60)) return erreur(429, 'Trop de cartes lues en peu de temps : réessayez plus tard.');
        await kv.put(quota, String(n + 1), { expirationTtl: 2 * 3600 });
        const c = id ? await kv.get('carte:' + id, 'json') : null;
        const cc = c ? await kv.get('compte:' + c.mail, 'json') : null;
        if (!c || !cc) return json({ ok: true, valide: false });
        const pub = { grade: c.grade || '', nom: c.nom || '', prenom: c.prenom || '', unite: c.unite || '', cie: c.cie || '', depuis: c.depuis || 0 };
        return json({ ok: true, valide: true, carte: lecteur ? Object.assign(pub, { mail: c.mail, nid: c.nid || '', moi: c.mail === lecteur.mail, attente: !!cc.attente, bloque: !!cc.bloque }) : pub });
    }

    const moi = await appareilConnecte(env, requete);
    if (!moi) {
        // Compte supprimé par l'assistant Chorus DT ou l'administrateur : l'appareil s'efface.
        const m = /^TRIGONE (\S+) /.exec(requete.headers.get('Authorization') || '');
        const mEfface = m ? ((await cleMigree(kv, normaliser(decodeURIComponent(m[1])))) || normaliser(decodeURIComponent(m[1]))) : '';
        if (m && await kv.get('efface:' + await empreinte('supprime:' + mEfface))) return json({ ok: false, supprime: true, erreur: 'Ce compte TRIGONE a été supprimé.' }, 410);
        // Appareil retiré du compte (téléphone perdu bloqué par l'administrateur, ou retiré par son titulaire) : il s'efface.
        const mr = /^TRIGONE (\S+) (\S+) /.exec(requete.headers.get('Authorization') || '');
        if (mr) { const cr = await kv.get('compte:' + normaliser(decodeURIComponent(mr[1])), 'json'); if (cr && (cr.revoques || []).indexOf(mr[2]) >= 0) return json({ ok: false, supprime: true, revoque: true, erreur: 'Cet appareil a été retiré du compte TRIGONE.' }, 410); }
        return erreur(401, 'Compte TRIGONE non reconnu sur cet appareil.');
    }
    // Administrateur de TRIGONE passé à son adresse TRIGONE (son ancienne adresse figurait dans ADMIN_MAILS).
    if (moi.compte.superAdmin && !estAdmin(env, moi.mail)) { const e2 = Object.create(env); e2.ADMIN_MAILS = (env.ADMIN_MAILS || '') + ',' + moi.mail; env = e2; }
    // Adresse inscrite par le propriétaire dans ADMIN_MAILS (Cloudflare) : compte validé d'office, sans attendre l'unité
    // (choix du propriétaire de TRIGONE : lui seul contrôle cette liste).
    if (moi.compte.attente && estAdmin(env, moi.mail)) {
        delete moi.compte.attente; moi.compte.validePar = 'ADMIN_MAILS'; moi.compte.valideLe = Date.now();
        await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
        await majLigneCompte(env, moi.mail, { statut: 'actif', par: 'ADMIN_MAILS' }).catch(() => {});
    }
    if (moi.compte.attente && !LIBRE_EN_ATTENTE.has(chemin)) return erreur(403, 'Votre compte TRIGONE attend sa validation par l\'administrateur ou l\'assistant Chorus DT de votre unité.');
    // Carte perdue ou volée : l'ancien identifiant est effacé (son QR code devient « non reconnu »), un nouveau est tiré.
    if (chemin === 'carte/revoquer' && methode === 'POST') {
        const ancien = await kv.get('carte-de:' + moi.mail);
        const avant = ancien ? await kv.get('carte:' + ancien, 'json') : null;
        if (ancien) { await kv.delete('carte:' + ancien); await kv.delete('carte-de:' + moi.mail); }
        const corps = await requete.json().catch(() => ({}));
        const t = (v, n) => String(v || '').replace(/[<>]/g, '').trim().slice(0, n);
        const id = b64url(crypto.getRandomValues(new Uint8Array(12)));
        const depuis = (avant && avant.depuis) || Date.now();
        await kv.put('carte-de:' + moi.mail, id);
        await kv.put('carte:' + id, JSON.stringify({ mail: moi.mail, grade: t(corps.grade, 30), nom: t(corps.nom, 60), prenom: t(corps.prenom, 60),
            unite: t(corps.unite, 40), cie: t(corps.cie, 40), nid: t(corps.nid, 20), depuis: depuis }));
        return json({ ok: true, id: id, depuis: depuis });
    }
    // Carte TRIGONE du compte : créée à la première ouverture, mise à jour avec Mon profil (même identifiant).
    if (chemin === 'carte' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const t = (v, n) => String(v || '').replace(/[<>]/g, '').trim().slice(0, n);
        let id = await kv.get('carte-de:' + moi.mail);
        const avant = id ? await kv.get('carte:' + id, 'json') : null;
        if (!id) { id = b64url(crypto.getRandomValues(new Uint8Array(12))); await kv.put('carte-de:' + moi.mail, id); }
        const depuis = (avant && avant.depuis) || Math.min.apply(null, moi.compte.appareils.map(a => a.cree || Date.now()).concat([Date.now()]));
        await kv.put('carte:' + id, JSON.stringify({ mail: moi.mail, grade: t(corps.grade, 30), nom: t(corps.nom, 60), prenom: t(corps.prenom, 60),
            unite: t(corps.unite, 40), cie: t(corps.cie, 40), nid: t(corps.nid, 20), depuis: depuis }));
        return json({ ok: true, id: id, depuis: depuis });
    }
    // Sauvegarde automatique : un seul exemplaire par compte, remplacé à chaque envoi. Chiffrée dans l'appareil
    // (AES-GCM, clé tirée du code de récupération par PBKDF2) : ce serveur ne peut pas la lire.
    if (chemin === 'sauvegarde' && methode === 'POST') {
        const n = +(await kv.get('limite-sauv:' + moi.mail)) || 0;
        if (n >= 20) return erreur(429, 'Trop de sauvegardes en peu de temps : réessayez dans une heure.');
        await kv.put('limite-sauv:' + moi.mail, String(n + 1), { expirationTtl: 3600 });
        const c = await requete.json().catch(() => ({}));
        if (!/^[\w+/=]{16,64}$/.test(String(c.sel || '')) || !/^[\w+/=]{12,32}$/.test(String(c.iv || '')) || typeof c.ct !== 'string') return erreur(400, 'Sauvegarde invalide.');
        let octets;
        try { octets = Uint8Array.from(atob(c.ct), ch => ch.charCodeAt(0)); } catch (e) { return erreur(400, 'Sauvegarde invalide.'); }
        if (octets.length > TAILLE_MAX) return erreur(413, 'Sauvegarde trop volumineuse (24 Mo au plus) : retirez des pièces jointes anciennes.');
        const meta = { sel: c.sel, iv: c.iv, le: Date.now(), taille: octets.length, appareil: String(c.appareil || '').slice(0, 60) };
        await kv.put('sauvegarde:' + moi.mail, octets, { metadata: meta });
        return json({ ok: true, le: meta.le, taille: meta.taille });
    }
    if (chemin === 'sauvegarde/info' && methode === 'GET') {
        const r = await kv.getWithMetadata('sauvegarde:' + moi.mail, 'stream');
        if (r.value) r.value.cancel().catch(() => {});
        const m = r.metadata;
        return json({ ok: true, existe: !!m, le: m ? m.le : 0, taille: m ? m.taille : 0, appareil: m ? m.appareil : '' });
    }
    if (chemin === 'sauvegarde' && methode === 'GET') {
        const r = await kv.getWithMetadata('sauvegarde:' + moi.mail, 'arrayBuffer');
        if (!r.value || !r.metadata) return erreur(404, 'Aucune sauvegarde dans votre compte TRIGONE.');
        const o = new Uint8Array(r.value); let t = '';
        for (let i = 0; i < o.length; i += 0x8000) t += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
        return json({ ok: true, sel: r.metadata.sel, iv: r.metadata.iv, le: r.metadata.le, ct: btoa(t) });
    }
    if (chemin === 'sauvegarde' && methode === 'DELETE') {
        await kv.delete('sauvegarde:' + moi.mail);
        return json({ ok: true });
    }
    // Suivi de l'équipe (chef de mission collective) : qui a envoyé son compte-rendu ; relance des retardataires.
    if (chemin === 'equipe' && methode === 'GET') {
        const ref = nettoyerRefs([url.searchParams.get('ref')])[0];
        if (!ref) return erreur(400, 'Référence manquante.');
        const db = await baseBoite(env);
        await db.prepare('DELETE FROM equipe WHERE recu < ?').bind(Date.now() - 90 * JOUR * 1000).run();
        await db.prepare('DELETE FROM equipe_lecteur WHERE le < ?').bind(Date.now() - 90 * JOUR * 1000).run();
        // Le chef de mission, ou un assistant Chorus DT qui a reçu un compte-rendu de cette mission.
        const lecteur = await db.prepare('SELECT 1 AS x FROM equipe_lecteur WHERE ref = ? AND mail = ?').bind(ref, moi.mail).first();
        const r = (await db.prepare('SELECT mail, recu, envoye, relance FROM equipe WHERE ref = ? AND (chef = ? OR ?)').bind(ref, moi.mail, lecteur ? 1 : 0).all()).results || [];
        return json({ ok: true, equipe: r });
    }
    if (chemin === 'equipe/relance' && methode === 'POST') {
        const c = await requete.json().catch(() => ({}));
        const ref = nettoyerRefs([c.ref])[0], libelle = String(c.libelle || '').slice(0, 80), maintenant = Date.now();
        if (!ref) return erreur(400, 'Référence manquante.');
        const db = await baseBoite(env);
        const r = (await db.prepare('SELECT mail FROM equipe WHERE ref = ? AND chef = ? AND envoye IS NULL AND (relance IS NULL OR relance < ?)').bind(ref, moi.mail, maintenant - 12 * 3600 * 1000).all()).results || [];
        await Promise.all(r.map(x => notifierCompte(env, x.mail, { titre: 'Rappel de votre chef de mission', type: 'RELANCE', url: '/?espace=boite',
            texte: 'Votre compte-rendu' + (libelle ? ' « ' + libelle + ' »' : ' de mission collective') + ' n\'est pas encore envoyé : ouvrez-le (Boîte de réception), joignez vos justificatifs et envoyez-le.' }, url.origin).catch(() => {})));
        if (r.length) await db.batch(r.map(x => db.prepare('UPDATE equipe SET relance = ? WHERE ref = ? AND mail = ?').bind(maintenant, ref, x.mail)));
        return json({ ok: true, n: r.length });
    }
    // Matricule (NID) du compte, déclaré par l'appli depuis le profil : il permet au chef de mission collective de
    // retrouver le compte TRIGONE de ses participants. Un matricule appartient au premier compte qui le déclare
    // (tant que ce compte existe) ; vide : le lien est retiré.
    if (chemin === 'nid' && methode === 'POST') {
        const c = await requete.json().catch(() => ({}));
        const nid = chiffresNid(c.nid);
        if (c.nid && !nid) return erreur(400, 'Le matricule doit comporter 10 chiffres.');
        const h = nid ? await empreinteNid(env, nid) : '';
        if (h) {
            const tenant = await kv.get('nid:' + h);
            if (tenant && tenant !== moi.mail && await kv.get('compte:' + tenant)) return erreur(409, 'Ce matricule est déjà associé à un autre compte TRIGONE.');
        }
        // Empreinte du matricule de ce compte, dans sa propre clé : le compte lui-même n'est pas réécrit (une réécriture
        // pouvait effacer des rôles déclarés au même moment).
        const avant = (await kv.get('nid-de:' + moi.mail)) || moi.compte.nid || '';
        if (avant && avant !== h && await kv.get('nid:' + avant) === moi.mail) await kv.delete('nid:' + avant);
        if (h) { await kv.put('nid:' + h, moi.mail); await kv.put('nid-de:' + moi.mail, h); } else await kv.delete('nid-de:' + moi.mail);
        return json({ ok: true });
    }
    // Comptes TRIGONE des participants d'une mission collective, retrouvés par leur matricule (50 au plus par appel,
    // 300 par jour et par compte).
    if (chemin === 'nids' && methode === 'POST') {
        const c = await requete.json().catch(() => ({}));
        const nids = Array.from(new Set((Array.isArray(c.nids) ? c.nids : []).map(chiffresNid).filter(Boolean))).slice(0, 50);
        const cleQuota = 'quota-nid:' + moi.mail + ':' + new Date().toISOString().slice(0, 10);
        const deja = parseInt(await kv.get(cleQuota), 10) || 0;
        if (deja + nids.length > 300) return erreur(429, 'Trop de recherches aujourd\'hui : saisissez les adresses.');
        if (nids.length) await kv.put(cleQuota, String(deja + nids.length), { expirationTtl: 2 * JOUR });
        const trouves = {};
        await Promise.all(nids.map(async nid => {
            const mail = await kv.get('nid:' + await empreinteNid(env, nid));
            if (mail && await kv.get('compte:' + mail)) trouves[nid] = mail;
        }));
        return json({ ok: true, comptes: trouves });
    }
    // Numéro OMR (ordre de mise en route) : une série commune à tout TRIGONE, tirée par l'appli du missionnaire à l'envoi
    // de sa demande (ou, à défaut, par l'assistant Chorus DT à son arrivée). Incrément atomique (D1). L'assistant
    // Chorus DT peut repartir sur une nouvelle série (préfixe libre, ex. « 2027- », et premier numéro).
    if (chemin === 'omr' && methode === 'POST') {
        const db = await tableReglage(env), u = uniteRegistre(requete), kp = cleOmr(u, 'omr-prochain');
        await db.prepare("INSERT INTO reglage (cle, valeur) VALUES (?, '1') ON CONFLICT (cle) DO NOTHING").bind(kp).run();
        const r = await db.prepare("UPDATE reglage SET valeur = CAST(CAST(valeur AS INTEGER) + 1 AS TEXT) WHERE cle = ? RETURNING valeur").bind(kp).first();
        const n = parseInt(r && r.valeur, 10) - 1;
        const p = await db.prepare("SELECT valeur FROM reglage WHERE cle = ?").bind(cleOmr(u, 'omr-prefixe')).first();
        return json({ ok: true, numero: ((p && p.valeur) || '') + String(n).padStart(4, '0'), le: new Date().toISOString() });
    }
    if (chemin === 'omr/serie' && (methode === 'GET' || methode === 'POST')) {
        if (!(moi.compte.roles || {}).chorus) return erreur(403, 'Réservé à l\'assistant Chorus DT.');
        const db = await tableReglage(env), u = uniteRegistre(requete);
        if (methode === 'POST') {
            const c = await requete.json().catch(() => ({}));
            const prefixe = String(c.prefixe || '').replace(/[^0-9A-Za-z\-\/]/g, '').slice(0, 12), prochain = parseInt(c.prochain, 10);
            if (!(prochain >= 1 && prochain < 1000000)) return erreur(400, 'Premier numéro invalide.');
            await db.batch([
                db.prepare("INSERT INTO reglage (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur").bind(cleOmr(u, 'omr-prefixe'), prefixe),
                db.prepare("INSERT INTO reglage (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur").bind(cleOmr(u, 'omr-prochain'), String(prochain))
            ]);
        }
        const p = await db.prepare("SELECT valeur FROM reglage WHERE cle = ?").bind(cleOmr(u, 'omr-prefixe')).first();
        const n = await db.prepare("SELECT valeur FROM reglage WHERE cle = ?").bind(cleOmr(u, 'omr-prochain')).first();
        return json({ ok: true, prefixe: (p && p.valeur) || '', prochain: parseInt(n && n.valeur, 10) || 1 });
    }
    // Registre OMR partagé : tous les assistants Chorus DT de l'unité voient la même liste, quel que soit celui qui a
    // reçu la demande ou le compte-rendu. Envoi des lignes nouvelles ou modifiées et des suppressions, réponse : tout ce
    // qui a changé depuis « depuis » (maj). Un registre par régiment (unité du profil, voir uniteRegistre).
    if (chemin === 'registre' && methode === 'POST') {
        if (!(moi.compte.roles || {}).chorus) return erreur(403, 'Réservé à l\'assistant Chorus DT.');
        const c = await requete.json().catch(() => ({}));
        const db = await baseBoite(env), u = uniteRegistre(requete), le = Date.now();
        const refOk = r => typeof r === 'string' && r.length > 0 && r.length <= 120;
        const supprimer = (Array.isArray(c.supprimer) ? c.supprimer : []).filter(refOk).slice(0, 200);
        const lignes = (Array.isArray(c.lignes) ? c.lignes : []).filter(x => x && typeof x === 'object' && refOk(x.ref) && JSON.stringify(x).length <= 20000).slice(0, 200);
        for (const ref of supprimer) await db.prepare("INSERT INTO registre (unite, ref, omr, mref, donnees, maj, supprime, par) VALUES (?, ?, '', '', '{}', ?, 1, ?) " +
            'ON CONFLICT (unite, ref) DO UPDATE SET supprime = 1, maj = excluded.maj, par = excluded.par').bind(u, ref, le, moi.mail).run();
        for (const x of lignes) await registreFusionner(db, u, x, le, moi.mail);
        const depuis = +c.depuis || 0;
        const r = (await db.prepare('SELECT ref, donnees, maj, supprime, par FROM registre WHERE unite = ? AND maj >= ? ORDER BY maj LIMIT 2000').bind(u, depuis).all()).results || [];
        return json({ ok: true, lignes: r.map(x => ({ ref: x.ref, supprime: !!x.supprime, par: x.par, maj: x.maj, ligne: x.supprime ? null : JSON.parse(x.donnees || '{}') })),
            dernier: r.reduce((m, x) => Math.max(m, x.maj), depuis) });
    }
    // Heures réelles de sa mission, envoyées par le missionnaire depuis Compte-rendu (appuis Départ, Arrivée sur site,
    // Départ du site, Retour) : { omr, mref, jalons: { depart, surSite, departSite, retour } }. Seuls le demandeur et
    // les personnes de la demande (matricule rattaché à leur compte) peuvent les donner.
    if (chemin === 'registre/jalons' && methode === 'POST') {
        const c = await requete.json().catch(() => ({}));
        const omr = String(c.omr || '').slice(0, 30), mref = String(c.mref || '').slice(0, 64);
        if (!omr && !mref) return erreur(400, 'Mission inconnue.');
        const db = await baseBoite(env), u = uniteRegistre(requete);
        const ligne = await db.prepare("SELECT * FROM registre WHERE unite = ? AND supprime = 0 AND ((? <> '' AND omr = ?) OR (? <> '' AND (ref = ? OR mref = ?))) ORDER BY maj DESC LIMIT 1")
            .bind(u, omr, omr, mref, mref, mref).first();
        if (!ligne) return json({ ok: false, attente: true });   // demande pas encore au registre : l'appli réessaiera
        const d = JSON.parse(ligne.donnees || '{}');
        let autorise = d.mailDemandeur === moi.mail;
        for (const p of (d.personnes || [])) {
            if (autorise) break;
            const nid = chiffresNid(p.nid);
            if (nid && await kv.get('nid:' + await empreinteNid(env, nid)) === moi.mail) autorise = true;
        }
        if (!autorise) return erreur(403, 'Cette mission n\'est pas la vôtre.');
        const j = {};
        ['depart', 'surSite', 'departSite', 'retour'].forEach(k => { const v = String((c.jalons || {})[k] || '').slice(0, 30); if (/^[\d\/: ,.-]+$/.test(v)) j[k] = v; });
        d.jalons = Object.assign({}, d.jalons || {}, j);
        const le = Date.now();
        await registreEcrireLigne(db, u, d, le, moi.mail);
        return json({ ok: true });
    }
    // Remise à zéro du registre (assistant Chorus DT) : toutes les lignes marquées supprimées (les autres assistants les
    // retirent à leur prochaine relève), et la numérotation OMR repart à 0001 sans préfixe.
    if (chemin === 'registre/vider' && methode === 'POST') {
        if (!(moi.compte.roles || {}).chorus) return erreur(403, 'Réservé à l\'assistant Chorus DT.');
        const db = await baseBoite(env), u = uniteRegistre(requete), le = Date.now();
        const r = await db.prepare("UPDATE registre SET supprime = 1, donnees = '{}', maj = ?, par = ? WHERE unite = ? AND supprime = 0").bind(le, moi.mail, u).run();
        const reg = await tableReglage(env);
        await reg.batch([
            reg.prepare("INSERT INTO reglage (cle, valeur) VALUES (?, '') ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur").bind(cleOmr(u, 'omr-prefixe')),
            reg.prepare("INSERT INTO reglage (cle, valeur) VALUES (?, '1') ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur").bind(cleOmr(u, 'omr-prochain'))
        ]);
        return json({ ok: true, effacees: (r.meta && r.meta.changes) || 0, dernier: le });
    }
    // Page « Erreurs de l'appli » : réservée à l'administrateur (ADMIN_MAILS).
    if (chemin === 'admin' && methode === 'GET') return json({ ok: true, admin: estAdmin(env, moi.mail) });
    // ----- Comptes : unité, rôle ADMINISTRATEUR, demandes de réinitialisation / suppression -----
    if (chemin === 'unite' && methode === 'POST') {
        const u = uniteRegistre(requete), c = await requete.json().catch(() => ({})), t = (v, n) => String(v || '').trim().slice(0, n);
        await kv.put('unite-de:' + moi.mail, u);
        const l = await ligneCompte(env, moi.mail), adr = await kv.get('adresse-de:' + moi.mail);
        await majLigneCompte(env, moi.mail, { unite: u, grade: t(c.grade, 30).toUpperCase() || (l && l.grade) || '', nom: t(c.nom, 60).toUpperCase() || (l && l.nom) || '', prenom: t(c.prenom, 60) || (l && l.prenom) || '',
            adresse: adr ? adr + '@' + DOMAINE_RECEPTION : (l && l.adresse) || '', statut: moi.compte.attente ? 'attente' : moi.compte.bloque ? 'bloque' : 'actif' });
        return json({ ok: true });
    }
    if (chemin === 'role/admin' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), db = await baseBoite(env);
        if (!c.actif) { await db.prepare('DELETE FROM admin_unite WHERE mail = ?').bind(moi.mail).run(); return json({ ok: true, admin: '' }); }
        if (!env.CODE_ADMIN) return erreur(503, 'Le code ADMINISTRATEUR n\'est pas encore configuré sur le serveur.');
        const lim = 'limite-admin:' + moi.mail, n = +(await kv.get(lim)) || 0;
        if (n >= 5) return erreur(429, 'Trop d\'essais : réessayez dans une heure.');
        if (!egal(String(c.code || '').trim().toUpperCase(), String(env.CODE_ADMIN).trim().toUpperCase())) { await kv.put(lim, String(n + 1), { expirationTtl: 3600 }); return erreur(403, 'Code ADMINISTRATEUR incorrect.'); }
        const u = uniteRegistre(requete);
        await db.prepare('INSERT INTO admin_unite (mail, unite, le) VALUES (?, ?, ?) ON CONFLICT (mail) DO UPDATE SET unite = excluded.unite, le = excluded.le').bind(moi.mail, u, Date.now()).run();
        await kv.put('unite-de:' + moi.mail, u);
        return json({ ok: true, admin: nomUnite(u) });
    }
    if (chemin === 'compte/role' && methode === 'GET') {
        const au = await adminUnite(env, moi.mail);
        return json({ ok: true, admin: au ? nomUnite(au) : '', superAdmin: estAdmin(env, moi.mail) });
    }
    // Demande du titulaire du compte (missionnaire, valideur, assistant) : { type: 'reinit' | 'suppression', motif, qui, chorus }.
    // Missionnaire et valideurs : à leur assistant Chorus DT (celui de leur profil), et aux administrateurs de l'unité ;
    // assistant Chorus DT : aux administrateurs ; administrateur : aux administrateurs de TRIGONE (ADMIN_MAILS).
    if (chemin === 'compte/demande' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), db = await baseBoite(env), u = uniteRegistre(requete);
        if (c.type !== 'reinit' && c.type !== 'suppression') return erreur(400, 'Demande inconnue.');
        await kv.put('unite-de:' + moi.mail, u);
        const monAdmin = await adminUnite(env, moi.mail), roles = moi.compte.roles || {};
        let dest = [];
        if (monAdmin) dest = String(env.ADMIN_MAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        else {
            dest = (await adminsDe(env, u)).filter(m => m !== moi.mail);
            const ch = await cleCompte(kv, c.chorus);
            if (!roles.chorus && ch && ch !== moi.mail) { const cc = await kv.get('compte:' + ch, 'json'); if (cc && (cc.roles || {}).chorus) dest.push(ch); }
        }
        dest = Array.from(new Set(dest));
        if (!dest.length) return erreur(409, roles.chorus || monAdmin ? 'Aucun administrateur TRIGONE pour votre unité : demandez à l\'un de vos responsables de prendre le rôle ADMINISTRATEUR.'
            : 'Aucun assistant Chorus DT ni administrateur trouvé : vérifiez le mail de l\'assistant Chorus DT dans Mon profil.');
        const id = 'dc' + b64url(crypto.getRandomValues(new Uint8Array(9)));
        await db.prepare("DELETE FROM compte_demande WHERE mail = ? AND statut = 'attente'").bind(moi.mail).run();
        await db.prepare("INSERT INTO compte_demande (id, mail, qui, type, motif, unite, dest, le, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'attente')")
            .bind(id, moi.mail, String(c.qui || '').slice(0, 80), c.type, String(c.motif || '').slice(0, 300), u, JSON.stringify(dest), Date.now()).run();
        const t = c.type === 'reinit' ? 'réinitialiser TRIGONE sur ses appareils' : 'supprimer son compte TRIGONE';
        await Promise.all(dest.map(m => notifierCompte(env, m, { titre: 'Demande sur un compte', texte: (c.qui || moi.mail) + ' demande à ' + t + '.', type: 'COMPTE', url: '/?espace=comptes' }, url.origin).catch(() => {})));
        return json({ ok: true, id, dest: dest.length });
    }
    if (chemin === 'compte/demandes' && methode === 'GET') {
        const db = await baseBoite(env), monAdmin = await adminUnite(env, moi.mail), sup = estAdmin(env, moi.mail);
        const r = ((await db.prepare("SELECT * FROM compte_demande WHERE statut = 'attente' OR (mail = ? ) ORDER BY le DESC LIMIT 200").bind(moi.mail).all()).results || []);
        const pourMoi = r.filter(x => x.mail !== moi.mail && x.statut === 'attente' && (sup || (monAdmin && x.unite === monAdmin) || JSON.parse(x.dest || '[]').indexOf(moi.mail) >= 0));
        const mienne = r.filter(x => x.mail === moi.mail)[0] || null;
        const journal = monAdmin || sup ? ((await db.prepare('SELECT le, unite, par, motif, qui, brevo FROM compte_journal WHERE unite = ? OR ? ORDER BY le DESC LIMIT 30').bind(monAdmin || '-', sup ? 1 : 0).all()).results || []) : [];
        return json({ ok: true, demandes: pourMoi.map(x => ({ id: x.id, mail: x.mail, qui: x.qui, type: x.type, motif: x.motif, le: x.le })),
            mienne: mienne && { type: mienne.type, statut: mienne.statut, le: mienne.le, decideLe: mienne.decideLe }, admin: monAdmin ? nomUnite(monAdmin) : '', superAdmin: sup, journal });
    }
    if (chemin === 'compte/decision' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), db = await baseBoite(env);
        const d = await db.prepare("SELECT * FROM compte_demande WHERE id = ? AND statut = 'attente'").bind(String(c.id || '')).first();
        if (!d) return erreur(404, 'Demande introuvable ou déjà traitée.');
        const monAdmin = await adminUnite(env, moi.mail);
        if (!(estAdmin(env, moi.mail) || (monAdmin && d.unite === monAdmin) || JSON.parse(d.dest || '[]').indexOf(moi.mail) >= 0)) return erreur(403, 'Cette demande ne vous est pas adressée.');
        const qui = String(c.qui || moi.mail).slice(0, 80);
        if (!c.accepte) {
            await db.prepare("UPDATE compte_demande SET statut = 'refusee', par = ?, decideLe = ? WHERE id = ?").bind(moi.mail, Date.now(), d.id).run();
            await notifierCompte(env, d.mail, { titre: 'Demande refusée', texte: qui + ' a refusé votre demande (' + (d.type === 'reinit' ? 'réinitialisation' : 'suppression du compte') + ').', type: 'COMPTE', url: '/' }, url.origin).catch(() => {});
            return json({ ok: true, statut: 'refusee' });
        }
        if (d.type === 'reinit') {
            const cd = await kv.get('compte:' + d.mail, 'json');
            await kv.put('reinit:' + d.mail, JSON.stringify((cd && cd.appareils || []).map(a => a.id)), { expirationTtl: 30 * JOUR });
            await db.prepare("UPDATE compte_demande SET statut = 'acceptee', par = ?, decideLe = ? WHERE id = ?").bind(moi.mail, Date.now(), d.id).run();
            await notifierCompte(env, d.mail, { titre: 'Réinitialisation acceptée', texte: 'Ouvrez TRIGONE : il repartira comme au premier jour sur chacun de vos appareils.', type: 'COMPTE', url: '/' }, url.origin).catch(() => {});
            return json({ ok: true, statut: 'acceptee' });
        }
        const r = await supprimerCompte(env, d.mail, moi.mail, 'À sa demande' + (d.motif ? ' : ' + d.motif : ''), d.unite, d.qui);
        return json({ ok: true, statut: 'supprime', brevo: r.brevo });
    }
    // Suppression directe (départ de l'institution…) : administrateur de l'unité du compte, ou de TRIGONE.
    if (chemin === 'compte/supprimer' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), cible = await cleCompte(kv, c.mail), monAdmin = await adminUnite(env, moi.mail), sup = estAdmin(env, moi.mail);
        if (!monAdmin && !sup) return erreur(403, 'Réservé à l\'administrateur de l\'unité.');
        if (!mailValide(cible) || cible === moi.mail) return erreur(400, 'Adresse invalide.');
        if (!String(c.motif || '').trim()) return erreur(400, 'Indiquez le motif.');
        if (!(await kv.get('compte:' + cible))) return erreur(404, 'Aucun compte TRIGONE à cette adresse.');
        const uc = (await kv.get('unite-de:' + cible)) || '';
        // Compte d'une autre unité : refusé ; unité jamais transmise (ancienne version) : comptes d'origine (4°RIISC).
        if (!sup && (uc ? uc !== monAdmin : monAdmin !== UNITE_REGISTRE)) return erreur(403, 'Ce compte n\'appartient pas à votre unité.');
        if (!sup && await adminUnite(env, cible)) return erreur(403, 'Le compte d\'un administrateur se supprime par l\'administrateur de TRIGONE.');
        const r = await supprimerCompte(env, cible, moi.mail, String(c.motif).slice(0, 300), uc || monAdmin, '');
        return json({ ok: true, brevo: r.brevo });
    }
    // ----- Comptes de l'unité : validation des inscriptions, blocage, code de réactivation, mes appareils -----
    // Annuaire de l'unité : les comptes validés qui ont ce rôle (VALIDEUR 1, VALIDEUR 2, assistant Chorus DT), pour choisir
    // ses destinataires dans une liste (première connexion, Mon profil). Grade, nom, prénom et adresse seulement.
    // Passage à l'adresse TRIGONE (demandé par l'appli à l'ouverture, une fois) ; tests locaux : sur demande seulement.
    if (chemin === 'compte/migrer' && methode === 'POST') {
        const c = await requete.json().catch(() => ({}));
        if (moi.mail.endsWith('@' + DOMAINE_RECEPTION)) return json({ ok: true, mail: moi.mail, deja: true });
        if (env.MODE_TEST === '1' && !c.forcer) return json({ ok: false, test: true });
        const neuf = await migrerCompte(env, moi.mail, String(c.prenom || '').slice(0, 60), String(c.nom || '').slice(0, 60));
        if (!neuf) return erreur(409, 'Passage à l\'adresse TRIGONE impossible pour l\'instant (adresse indisponible).');
        return json({ ok: true, mail: neuf, ancien: true });
    }
    if (chemin === 'annuaire' && methode === 'GET') {
        const role = url.searchParams.get('role') || '';
        if (!ROLES.includes(role)) return erreur(400, 'Rôle inconnu.');
        const u = (await kv.get('unite-de:' + moi.mail)) || uniteRegistre(requete), db = await baseBoite(env);
        const r = (await db.prepare('SELECT p.mail, p.roles, c.grade, c.nom, c.prenom, c.adresse, c.unite, c.statut FROM porteur_role p LEFT JOIN compte_unite c ON c.mail = p.mail WHERE p.roles LIKE ? LIMIT 500')
            .bind('%' + role + '%').all()).results || [];
        const l = [];
        for (const x of r) {
            if (x.mail === moi.mail || !String(x.roles || '').split(',').includes(role) || x.statut === 'attente' || x.statut === 'bloque') continue;
            if ((x.unite || (await kv.get('unite-de:' + x.mail)) || '') !== u) continue;
            const f = role === 'chorus' ? null : await kv.get('fonctions:' + x.mail, 'json');
            l.push({ mail: x.mail, grade: x.grade || '', nom: x.nom || '', prenom: x.prenom || '', fonction: (f && f[role]) || '' });
        }
        l.sort((a, b) => (a.nom || a.mail).localeCompare(b.nom || b.mail, 'fr'));
        return json({ ok: true, role, unite: nomUnite(u), personnes: l.slice(0, 100), groupe: role === 'valideur1' ? '' : adresseGroupe(role, u) });
    }
    if (chemin === 'compte/unite' && methode === 'GET') {
        const u = await adminUnite(env, moi.mail), sup = estAdmin(env, moi.mail), mu = (await kv.get('unite-de:' + moi.mail)) || UNITE_REGISTRE;
        const role = await gestionnaire(env, moi, u || mu, true);
        if (!role) return erreur(403, 'Réservé à l\'administrateur ou à l\'assistant Chorus DT de l\'unité.');
        const db = await baseBoite(env), unite = u || mu;
        const r = ((role === 'super' ? await db.prepare('SELECT * FROM compte_unite ORDER BY unite, nom, prenom LIMIT 2000').all()
            : await db.prepare('SELECT * FROM compte_unite WHERE unite = ? ORDER BY nom, prenom LIMIT 2000').bind(unite).all()).results || []);
        const vue = role === 'chorus' ? r.filter(x => x.statut === 'attente') : r;
        return json({ ok: true, role, unite: nomUnite(unite), comptes: vue.map(x => ({ mail: x.mail, adresse: x.adresse || '', grade: x.grade, nom: x.nom, prenom: x.prenom, unite: nomUnite(x.unite), statut: x.statut, le: x.le, moi: x.mail === moi.mail })) });
    }
    if (chemin === 'compte/valider' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), cible = await cleCompte(kv, c.mail), l = await ligneCompte(env, cible), compte = await kv.get('compte:' + cible, 'json');
        if (!l || !compte || !compte.attente) return erreur(404, 'Inscription introuvable ou déjà traitée.');
        if (!(await gestionnaire(env, moi, l.unite, true))) return erreur(403, 'Cette inscription n\'est pas de votre unité.');
        const qui = [l.grade, l.nom, l.prenom].filter(Boolean).join(' ');
        if (c.accepte === false) {
            await supprimerCompte(env, cible, moi.mail, 'Inscription refusée' + (c.motif ? ' : ' + String(c.motif).slice(0, 200) : ''), l.unite, qui);
            return json({ ok: true, statut: 'refusee' });
        }
        delete compte.attente; compte.validePar = moi.mail; compte.valideLe = Date.now();
        await kv.put('compte:' + cible, JSON.stringify(compte));
        await majLigneCompte(env, cible, { statut: 'actif', par: moi.mail });
        await notifierCompte(env, cible, { titre: 'Compte TRIGONE validé', texte: 'Bienvenue ' + qui + ' : vous pouvez envoyer et recevoir dans TRIGONE.', type: 'COMPTE', url: '/' }, url.origin).catch(() => {});
        return json({ ok: true, statut: 'actif', qui });
    }
    // Validation en personne : un responsable (rôle valideur, assistant Chorus DT, administrateur) scanne la carte TRIGONE.
    if (chemin === 'compte/valider-carte' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), carte = await kv.get('carte:' + String(c.carte || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), 'json');
        if (!carte) return erreur(404, 'Carte inconnue.');
        const l = await ligneCompte(env, carte.mail), compte = await kv.get('compte:' + carte.mail, 'json');
        if (!l || !compte || !compte.attente) return erreur(404, 'Ce compte n\'attend pas de validation.');
        const roles = moi.compte.roles || {}, mu = await kv.get('unite-de:' + moi.mail);
        const ok = await gestionnaire(env, moi, l.unite, true) || ((roles.valideur1 || roles.valideur2) && mu === l.unite);
        if (!ok || moi.compte.attente) return erreur(403, 'Seul un responsable de son unité (valideur, assistant Chorus DT, administrateur) peut valider.');
        delete compte.attente; compte.validePar = moi.mail; compte.valideLe = Date.now();
        await kv.put('compte:' + carte.mail, JSON.stringify(compte));
        await majLigneCompte(env, carte.mail, { statut: 'actif', par: moi.mail });
        const qui = [l.grade, l.nom, l.prenom].filter(Boolean).join(' ');
        await notifierCompte(env, carte.mail, { titre: 'Compte TRIGONE validé', texte: 'Bienvenue ' + qui + ' : vous pouvez envoyer et recevoir dans TRIGONE.', type: 'COMPTE', url: '/' }, url.origin).catch(() => {});
        return json({ ok: true, qui });
    }
    // Téléphone perdu : l'administrateur bloque le compte (tous ses appareils retirés et effacés à leur prochaine ouverture).
    if (chemin === 'compte/bloquer' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), cible = await cleCompte(kv, c.mail), l = await ligneCompte(env, cible), compte = await kv.get('compte:' + cible, 'json');
        if (!compte) return erreur(404, 'Compte introuvable.');
        const uc = (l && l.unite) || (await kv.get('unite-de:' + cible)) || UNITE_REGISTRE, role = await gestionnaire(env, moi, uc, false);
        if (!role) return erreur(403, 'Réservé à l\'administrateur de l\'unité.');
        if (cible === moi.mail) return erreur(400, 'Vous ne pouvez pas bloquer votre propre compte.');
        compte.revoques = (compte.revoques || []).concat(compte.appareils.map(a => a.id)).slice(-50); compte.appareils = [];
        compte.bloque = { le: Date.now(), par: moi.mail, motif: String(c.motif || '').slice(0, 200) };
        await kv.put('compte:' + cible, JSON.stringify(compte));
        await (await baseBoite(env)).prepare('DELETE FROM abonnement WHERE mail = ?').bind(cible).run();
        await majLigneCompte(env, cible, Object.assign({ statut: 'bloque', par: moi.mail }, l ? {} : { unite: uc }));
        await journal(env, uc, moi.mail, 'Blocage' + (c.motif ? ' : ' + c.motif : ''), cible, l ? [l.grade, l.nom, l.prenom].filter(Boolean).join(' ') : '');
        return json({ ok: true });
    }
    // Débloquer (nouveau téléphone) ou simple nouveau code : code de réactivation à remettre à la personne (48 h).
    if ((chemin === 'compte/debloquer' || chemin === 'compte/reactivation') && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), cible = await cleCompte(kv, c.mail), l = await ligneCompte(env, cible), compte = await kv.get('compte:' + cible, 'json');
        if (!compte) return erreur(404, 'Compte introuvable.');
        const uc = (l && l.unite) || (await kv.get('unite-de:' + cible)) || UNITE_REGISTRE;
        if (!(await gestionnaire(env, moi, uc, false))) return erreur(403, 'Réservé à l\'administrateur de l\'unité.');
        if (compte.bloque) { delete compte.bloque; await kv.put('compte:' + cible, JSON.stringify(compte)); await majLigneCompte(env, cible, { statut: compte.attente ? 'attente' : 'actif', par: moi.mail }); }
        const code = await codeReactivation(kv, cible);
        await journal(env, uc, moi.mail, chemin === 'compte/debloquer' ? 'Déblocage, code de réactivation remis' : 'Code de réactivation remis', cible, l ? [l.grade, l.nom, l.prenom].filter(Boolean).join(' ') : '');
        return json({ ok: true, code, expire: Date.now() + 2 * JOUR * 1000 });
    }
    // Code de connexion : choisi (ou changé) par la personne sur un appareil déjà connecté. Empreinte lente et salée.
    if (chemin === 'compte/motdepasse' && methode === 'POST') {
        const c = await requete.json().catch(() => ({})), code = String(c.mdp || '');
        if (code.length < 8 || code.length > 200) return erreur(400, 'Le code de connexion contient 8 caractères au moins.');
        // Changer un code existant : le code actuel d'abord (un téléphone laissé ouvert ne suffit pas). Pas demandé pour
        // un premier code, ni juste après un code de réactivation (code oublié).
        if (moi.compte.mdp && !moi.compte.mdpLibre) {
            const lim = 'limite-mdp:' + moi.mail, n = +(await kv.get(lim)) || 0;
            if (n >= 5) return erreur(429, 'Trop d\'essais : réessayez dans une heure.');
            if (await empreinteMdp(String(c.ancien || ''), depuisB64url(moi.compte.mdp.sel)) !== moi.compte.mdp.h) {
                await kv.put(lim, String(n + 1), { expirationTtl: 3600 });
                return erreur(403, 'Code de connexion actuel incorrect.');
            }
        }
        delete moi.compte.mdpLibre;
        const sel = hasard(16);
        moi.compte.mdp = { sel: b64url(sel), h: await empreinteMdp(code, sel), le: Date.now() };
        delete moi.compte.mdpEchecs; delete moi.compte.codeCnx; delete moi.compte.codeEchecs;
        await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
        return json({ ok: true });
    }
    // Clé des données du compte (sauvegarde automatique) : tirée au hasard une fois, gardée par le serveur, remise à
    // tout appareil connecté au compte. Comme sur n'importe quel site : un code de connexion oublié ne fait rien perdre
    // (code de réactivation → nouvel appareil → les données reviennent avec cette clé).
    if (chemin === 'donnees/cle' && methode === 'GET') {
        let k = await kv.get('cle-donnees:' + moi.mail);
        if (!k) { k = b64url(hasard(32)); await kv.put('cle-donnees:' + moi.mail, k); }
        return json({ ok: true, cle: k });
    }
    // Mes appareils : liste, et retrait d'un appareil (perdu) qui s'effacera à sa prochaine ouverture.
    if (chemin === 'compte/appareils' && (methode === 'GET' || methode === 'DELETE')) {
        if (methode === 'DELETE') {
            const id = String(url.searchParams.get('id') || '');
            if (!moi.compte.appareils.some(a => a.id === id)) return erreur(404, 'Appareil inconnu.');
            moi.compte.appareils = moi.compte.appareils.filter(a => a.id !== id); moi.compte.revoques = (moi.compte.revoques || []).concat(id).slice(-50);
            await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
            await (await baseBoite(env)).prepare('DELETE FROM abonnement WHERE mail = ? AND appareil = ?').bind(moi.mail, id).run();
        }
        return json({ ok: true, appareils: moi.compte.appareils.map(a => ({ id: a.id, nom: a.nom || 'Appareil', cree: a.cree || 0, moi: a.id === moi.appareil.id })) });
    }
    // Réinitialisation acceptée : chaque appareil du compte s'efface à son ouverture, puis se retire du compte.
    // ----- Aide de la mascotte : l'IA (Workers AI) répond à partir de la base de l'aide (aide/base.json) -----
    // Comptes connectés seulement ; limites par compte et pour tout TRIGONE, par jour, pour rester dans le quota gratuit
    // de Workers AI. La question n'est pas conservée.
    if (chemin === 'aide/ia' && methode === 'POST') {
        const ia = env.MODE_TEST === '1' && env.AIDE_IA_SIMULEE === '1' ? iaSimulee : env.AI;
        if (!ia) return erreur(503, 'L\'IA n\'est pas disponible.');
        const d = await requete.json().catch(() => ({}));
        const question = String(d.question || '').replace(/\s+/g, ' ').trim().slice(0, 400);
        if (question.length < 2 && !d.suite) return erreur(400, 'Question vide.');
        // Propos insultants : refusés ici aussi (la mascotte coupe déjà la conversation dans l'appli).
        const qn = ' ' + question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
        if (/ (connard|connasse|conard|salope|salaud|pute|petasse|encule|enculer|enfoire|batard|ntm|nique|fdp|ta gueule|tg|fils de pute|de merde|pd|pede) /.test(qn) ||
            / (t es|tu es|espece de|sale|gros|grosse) (con|conne|nul|debile|abruti|idiot|cretin|imbecile|bete|stupide|inutile|bouffon|tocard) /.test(qn)) return erreur(400, 'Propos insultants : question refusée.');
        const jour = new Date().toISOString().slice(0, 10);
        // Compte Workers Free : au-delà du quota gratuit, Cloudflare refuse (rien n'est facturé) et l'IA revient le lendemain.
        const maxCompte = +env.AIDE_IA_MAX_COMPTE || 40, maxJour = +env.AIDE_IA_MAX_JOUR || 400;
        const cleC = 'aide-ia:' + jour + ':' + moi.mail, cleJ = 'aide-ia-jour:' + jour;
        const nC = +(await kv.get(cleC)) || 0, nJ = +(await kv.get(cleJ)) || 0;
        if (!d.suite && nC >= maxCompte) return erreur(429, 'Vous avez posé ' + maxCompte + ' questions à l\'IA aujourd\'hui : elle revient demain.');
        if (!d.suite && nJ >= maxJour) return erreur(429, 'L\'IA a atteint sa limite du jour pour TRIGONE : elle revient demain.');
        const rb = await env.ASSETS.fetch(new Request(new URL('/aide/base.json', url).toString()));
        if (!rb.ok) return erreur(503, 'Base de l\'aide introuvable.');
        const base = await rb.json();
        const fiches = (Array.isArray(d.fiches) ? d.fiches : []).slice(0, 3).map(id => base.fiches.find(f => f.id === id)).filter(Boolean);
        const ecran = base.ecrans.find(e => e.id === d.ecran) || null;
        const historique = (Array.isArray(d.historique) ? d.historique : []).slice(-6)
            .map(h => ({ role: h && h.de === 'ia' ? 'assistant' : 'user', content: String((h && h.texte) || '').slice(0, 800) })).filter(h => h.content);
        const mission = String(d.mission || '').slice(0, 600), appli = d.app === 'cr' ? 'Compte-rendu' : 'Mise en route';
        const principal = env.AIDE_MODELE || '@cf/mistralai/mistral-small-3.1-24b-instruct', leger = env.AIDE_MODELE_LEGER || '@cf/meta/llama-3.1-8b-instruct-fast';
        const finir = (texte, modele, libre, messages, extra) => {
            let fiche = '';
            texte = String(texte || '').replace(/\[FICHE:\s*([a-z0-9-]+)\s*\]/gi, (m, id) => { if (!fiche && base.fiches.some(f => f.id === id)) fiche = id; return ''; }).trim().slice(0, 2500);
            const rep = Object.assign({ ok: true, reponse: texte, fiche, restant: Math.max(0, maxCompte - nC - 1) }, extra || {});
            if (env.MODE_TEST === '1') rep.essai = Object.assign({ modele, libre, fiches: fiches.map(f => f.id), ecran: ecran ? ecran.id : '', messages }, extra && extra.essai || {});
            return rep;
        };
        const erreurIa = e => {
            console.log('aide/ia : ' + (e && e.message || e));
            // Quota gratuit de Workers AI épuisé (compte Workers Free : rien n'est facturé, l'IA revient le lendemain).
            if (/allocation|quota|4006|neurons/i.test(String(e && e.message || e))) return erreur(429, 'L\'IA a atteint sa limite du jour pour TRIGONE : elle revient demain.');
            return erreur(503, 'L\'IA n\'a pas pu répondre pour le moment.');
        };
        // 2e temps des outils : l'appareil a fait les calculs demandés (barèmes, IK, codes FD, état des demandes) avec les moteurs
        // exacts de TRIGONE ; l'IA rédige sa réponse avec ces résultats. Compté avec la question d'origine (pas de nouvelle question).
        if (d.suite) {
            const cleS = 'aide-suite:' + String(d.suite).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), s = await kv.get(cleS, 'json');
            if (!s || s.mail !== moi.mail) return erreur(410, 'Réponse expirée : reposez la question.');
            await kv.delete(cleS);
            const res = (Array.isArray(d.resultats) ? d.resultats : []).slice(0, 3).map(r => '• ' + String(r && r.nom || '').slice(0, 40) + ' : ' + String(r && r.texte || '').replace(/\s+/g, ' ').slice(0, 1500)).join('\n');
            const messages = s.messages.concat([{ role: 'user', content: 'RÉSULTATS EXACTS DES CALCULS DE TRIGONE (reprends ces chiffres tels quels, n\'en invente aucun autre ; s\'il manque une information, dis-le) :\n' +
                (res || '(aucun résultat)') + '\n\nRéponds maintenant à ma question, simplement : « ' + s.question + ' »' }]);
            let texte = '';
            try { const r = await ia.run(principal, { messages, max_tokens: 600, temperature: 0.4 }); texte = sortieIa(r); } catch (e) { return erreurIa(e); }
            if (!texte) return erreur(503, 'L\'IA n\'a pas pu répondre pour le moment.');
            await noterConso(kv, jour, principal, null);
            return json(finir(texte, principal, false, messages, { outils: true }));
        }
        // Recherche par le sens : les passages de la notice et des fiches les plus proches de la question (même tournée
        // autrement que dans la base). Un passage très proche suffit à en faire une question sur TRIGONE.
        let extraits = [];
        try { extraits = await extraitsAide(env, ia, url, base, question, fiches.map(f => f.id)); } catch (e) { console.log('aide/sens : ' + (e && e.message || e)); }
        const libre = d.sujet === 'libre' && !(extraits[0] && extraits[0].score >= SENS_SUJET);
        // Outils : seulement si l'appareil sait les faire (d.outils) et que la question peut en avoir besoin (chiffres, argent, codes, dossiers).
        const avecOutils = !!d.outils && (!libre || OUTILS_INDICES.test(question));
        // Mémoire des réponses : une question générale déjà posée (sans conversation, sans mission, sans chiffre ni adresse)
        // reçoit la même réponse, sans consommer le quota ni compter dans les questions du jour.
        const general = !historique.length && !mission && !/[\d@]/.test(question);
        const cleCache = general ? 'aide-cache:' + (await empreinte([String(d.version || ''), appli, ecran ? ecran.id : '', fiches.map(f => f.id).join(','), qn.trim()].join('|'))).slice(0, 32) : '';
        if (cleCache) { const c = await kv.get(cleCache, 'json'); if (c && c.texte) return json(finir(c.texte, c.modele, c.libre, [], { cache: true, restant: Math.max(0, maxCompte - nC) })); }
        await kv.put(cleC, String(nC + 1), { expirationTtl: 172800 });
        await kv.put(cleJ, String(nJ + 1), { expirationTtl: 172800 });
        const messages = [{ role: 'system', content: consigneAide(base, fiches, ecran, appli, mission, libre, extraits, avecOutils) }].concat(historique, [{ role: 'user', content: question }]);
        let modele = libre && !avecOutils ? leger : principal, texte = '', usage = null, appels = [];
        const lancer = async (m, outils) => {
            const r = await ia.run(m, Object.assign({ messages, max_tokens: libre ? 400 : 600, temperature: outils ? 0.3 : 0.7 }, outils ? { tools: outils } : {}));
            usage = r && r.usage || null;
            appels = outils ? appelsOutils(r) : [];
            return sortieIa(r);
        };
        try {
            if (avecOutils) {
                // Deux écritures des outils selon les modèles de Workers AI ; sans outil possible, réponse ordinaire.
                try { texte = await lancer(modele, OUTILS_AIDE.map(o => ({ type: 'function', function: o }))); }
                catch (e0) { if (/allocation|quota|4006|neurons/i.test(String(e0 && e0.message || e0))) throw e0;
                    try { texte = await lancer(modele, OUTILS_AIDE); } catch (e1) { if (/allocation|quota|4006|neurons/i.test(String(e1 && e1.message || e1))) throw e1; texte = await lancer(modele, null); } }
            } else {
                try { texte = await lancer(modele, null); }
                catch (e1) { if (modele === principal || /allocation|quota|4006|neurons/i.test(String(e1 && e1.message || e1))) throw e1; modele = principal; texte = await lancer(modele, null); }   // modèle léger indisponible : le principal
            }
            await noterConso(kv, jour, modele, usage);
        } catch (e) { return erreurIa(e); }
        // L'IA demande des calculs : l'appareil les fait, puis renvoie les résultats (d.suite) pour la réponse finale.
        if (appels.length) {
            const jeton = b64url(crypto.getRandomValues(new Uint8Array(18)));
            await kv.put('aide-suite:' + jeton, JSON.stringify({ mail: moi.mail, question, messages: messages.concat([{ role: 'assistant', content: 'Je lance les calculs de TRIGONE : ' + appels.map(a => a.nom).join(', ') + '.' }]) }), { expirationTtl: 300 });
            return json({ ok: true, outils: appels, suite: jeton, essai: env.MODE_TEST === '1' ? { modele, libre, extraits: extraits.map(x => x.titre) } : undefined });
        }
        if (!texte) return erreur(503, 'L\'IA n\'a pas pu répondre pour le moment.');
        const rep = finir(texte, modele, libre, messages, env.MODE_TEST === '1' ? { essai: { extraits: extraits.map(x => x.titre) } } : null);
        if (cleCache) await kv.put(cleCache, JSON.stringify({ texte, modele, libre }), { expirationTtl: 7 * 86400 }).catch(() => {});
        return json(rep);
    }
    if (chemin === 'compte/etat' && methode === 'GET') {
        const l = await kv.get('reinit:' + moi.mail, 'json');
        return json({ ok: true, compte: moi.mail, reinit: Array.isArray(l) && l.indexOf(moi.appareil.id) >= 0, attente: !!moi.compte.attente, sansMail: !!moi.compte.sansMail,
            mdp: !!moi.compte.mdp, mdpCoupe: ((moi.compte.mdpEchecs || {}).total || 0) >= 10 });
    }
    if (chemin === 'erreurs' && methode === 'GET') {
        if (!estAdmin(env, moi.mail)) return erreur(403, 'Réservé à l\'administrateur de TRIGONE.');
        const db = await baseBoite(env);
        await purgerErreurs(env, Date.now());
        const r = (await db.prepare('SELECT e.*, (SELECT COUNT(*) FROM erreur_appareil a WHERE a.sig = e.sig) AS appareils FROM erreur e ORDER BY dernier DESC LIMIT 200').all()).results || [];
        return json({ ok: true, erreurs: r });
    }
    if (chemin === 'erreurs/corrige' && methode === 'POST') {
        if (!estAdmin(env, moi.mail)) return erreur(403, 'Réservé à l\'administrateur de TRIGONE.');
        const sig = String((await requete.json().catch(() => ({}))).sig || '');
        const db = await baseBoite(env);
        if (sig === '*') await db.batch([db.prepare('DELETE FROM erreur'), db.prepare('DELETE FROM erreur_appareil')]);
        else if (/^[\w-]{8,64}$/.test(sig)) await db.batch([db.prepare('DELETE FROM erreur WHERE sig = ?').bind(sig), db.prepare('DELETE FROM erreur_appareil WHERE sig = ?').bind(sig)]);
        return json({ ok: true });
    }

    // Liaison : un appareil configuré dépose son paquet chiffré (15 minutes, une seule utilisation), rangé sous
    // l'empreinte du code (id) : le serveur ne connaît ni le code ni le contenu.
    if (chemin === 'liaison' && methode === 'POST') {
        const texte = await requete.text();
        if (texte.length > 22 * 1024 * 1024) return erreur(413, 'Données trop volumineuses (20 Mo au plus).');
        let corps; try { corps = JSON.parse(texte); } catch (e) { return erreur(400, 'Envoi illisible.'); }
        const id = String(corps.id || '');
        if (!/^[\w-]{20,64}$/.test(id) || !corps.paquet || !corps.paquet.ct) return erreur(400, 'Liaison incomplète.');
        await kv.put('liaison:' + id, JSON.stringify({ mail: moi.mail, paquet: corps.paquet }), { expirationTtl: 900 });
        return json({ ok: true, expire: Date.now() + 900 * 1000 });
    }

    // Rôles du compte (déclarés par l'appli après le code valideur ou le code Assistant Chorus DT) : ils décident de ce
    // que chaque boîte peut recevoir. 1er valideur : les demandes des missionnaires ; 2e valideur : les envois des
    // 1ers valideurs ; assistant Chorus DT : les envois des 2es valideurs. Un refus revient à tout compte (le demandeur).
    // Tous les rôles de l'appareil en une seule écriture (plusieurs rôles cochés d'un coup : des déclarations séparées
    // et simultanées s'écrasaient, un seul rôle restait). ajouter / retirer : listes de rôles.
    if (chemin === 'roles' && methode === 'POST') {
        const c = await requete.json().catch(() => ({}));
        const ajouter = (Array.isArray(c.ajouter) ? c.ajouter : []).filter(r => ROLES.indexOf(r) >= 0);
        const retirer = (Array.isArray(c.retirer) ? c.retirer : []).filter(r => ROLES.indexOf(r) >= 0);
        const frais = (await kv.get('compte:' + moi.mail, 'json')) || moi.compte;
        frais.roles = Object.assign({}, await rolesActuels(env, moi.mail, frais));
        ajouter.forEach(r => { frais.roles[r] = true; });
        retirer.forEach(r => { delete frais.roles[r]; });
        await kv.put('compte:' + moi.mail, JSON.stringify(frais));
        await indexerRoles(env, moi.mail, frais.roles);
        // Fonction de signature de chaque rôle de valideur (« CHEF DE SECTION », « CHEF DE CORPS ») : montrée dans
        // l'annuaire de l'unité (l'aide de la mascotte dit « votre VALIDEUR 1 : ADJ DUPONT, chef de section »).
        if (c.fonctions && typeof c.fonctions === 'object') {
            const f = {};
            ['valideur1', 'valideur2'].forEach(r => { const v = String(c.fonctions[r] || '').replace(/\s+/g, ' ').trim().slice(0, 60); if (v && frais.roles[r]) f[r] = v; });
            if (Object.keys(f).length) await kv.put('fonctions:' + moi.mail, JSON.stringify(f)); else await kv.delete('fonctions:' + moi.mail);
        }
        return json({ ok: true, roles: frais.roles });
    }
    if (chemin === 'role' && methode === 'POST') {
        const { role, actif } = await requete.json().catch(() => ({}));
        if (ROLES.indexOf(role) < 0) return erreur(400, 'Rôle inconnu.');
        moi.compte.roles = Object.assign({}, await rolesActuels(env, moi.mail, moi.compte));
        if (actif) moi.compte.roles[role] = true; else delete moi.compte.roles[role];
        await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
        await indexerRoles(env, moi.mail, moi.compte.roles);
        return json({ ok: true, roles: moi.compte.roles });
    }

    // Abonnement de cet appareil aux notifications (POST : enregistrer, DELETE : retirer).
    if (chemin === 'push' && (methode === 'POST' || methode === 'DELETE')) {
        const db = await baseBoite(env);
        if (methode === 'DELETE') {
            await db.prepare('DELETE FROM abonnement WHERE mail = ? AND appareil = ?').bind(moi.mail, moi.appareil.id).run();
            return json({ ok: true });
        }
        const { abonnement } = await requete.json().catch(() => ({}));
        if (!abonnement || !/^https:\/\//.test(abonnement.endpoint || '') || !abonnement.keys || !abonnement.keys.p256dh || !abonnement.keys.auth) return erreur(400, 'Abonnement invalide.');
        await db.prepare('INSERT INTO abonnement (mail, appareil, endpoint, p256dh, auth, le) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (mail, appareil) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, le = excluded.le')
            .bind(moi.mail, moi.appareil.id, String(abonnement.endpoint).slice(0, 1000), String(abonnement.keys.p256dh).slice(0, 200), String(abonnement.keys.auth).slice(0, 100), Date.now()).run();
        return json({ ok: true });
    }
    // Notifications coupées / rétablies sur cet appareil (les autres appareils du compte continuent de les recevoir).
    if (chemin === 'push/muet' && methode === 'POST') {
        const { muet } = await requete.json().catch(() => ({}));
        const db = await baseBoite(env);
        if (muet) await db.prepare('INSERT OR IGNORE INTO muet (mail, appareil) VALUES (?, ?)').bind(moi.mail, moi.appareil.id).run();
        else await db.prepare('DELETE FROM muet WHERE mail = ? AND appareil = ?').bind(moi.mail, moi.appareil.id).run();
        return json({ ok: true, muet: !!muet });
    }
    // Test : une notification vers chacun de mes appareils, avec la réponse du service de notification (diagnostic).
    if (chemin === 'push/test' && methode === 'POST') {
        const liste = await abonnements(env, moi.mail, moi.compte, true);
        const muets = ((await (await baseBoite(env)).prepare('SELECT appareil FROM muet WHERE mail = ?').bind(moi.mail).all()).results || []).map(x => x.appareil);
        const resultats = await Promise.all(moi.compte.appareils.map(async a => {
            const x = liste.find(y => y.appareil === a.id);
            if (!x) return { appareil: a.id, nom: a.nom, ceci: a.id === moi.appareil.id, statut: 0, detail: 'pas abonné aux notifications' };
            if (muets.indexOf(a.id) >= 0) return { appareil: a.id, nom: a.nom, ceci: a.id === moi.appareil.id, statut: 0, detail: 'notifications coupées sur cet appareil' };
            try {
                const r = await envoyerPush(env, x.push, { titre: 'Test TRIGONE', texte: 'Les notifications fonctionnent sur cet appareil (' + a.nom + ').', type: 'TEST', url: '/?espace=boite' }, url.origin);
                const detail = r.ok ? 'envoyée' : (await r.text().catch(() => '')).slice(0, 200);
                return { appareil: a.id, nom: a.nom, ceci: a.id === moi.appareil.id, statut: r.status, service: new URL(x.push.endpoint).host, detail };
            } catch (e) { return { appareil: a.id, nom: a.nom, ceci: a.id === moi.appareil.id, statut: -1, detail: String(e && e.message || e).slice(0, 200) }; }
        }));
        return json({ ok: true, resultats });
    }

    // Clés publiques des appareils d'un destinataire (pour chiffrer un envoi).
    if (chemin === 'cles' && methode === 'GET') {
        const grp = lireGroupe(url.searchParams.get('mail'));
        if (grp) {
            const mb = await membresGroupe(env, grp), app = [];
            mb.forEach(x => x.compte.appareils.forEach(a => app.push({ id: a.id, cle: a.cle })));
            return json({ ok: true, compte: mb.length > 0, groupe: grp.libelle, membres: mb.length, mail: grp.adresse, roles: { [grp.role]: true }, remplacant: null, appareils: app });
        }
        const mail = await cleCompte(kv, url.searchParams.get('mail'));
        const compte = await kv.get('compte:' + mail, 'json');
        if (!compte || !compte.appareils.length || compte.attente || compte.bloque) return json({ ok: true, compte: false, attente: !!(compte && compte.attente), bloque: !!(compte && compte.bloque) });
        // Absence déclarée (valideur, assistant Chorus DT) : l'appli de l'expéditeur envoie à son remplaçant.
        const rp = compte.remplacant && compte.remplacant.jusqu > Date.now() ? compte.remplacant : null;
        // Absent : nom des remplaçants (et du titulaire), affiché chez l'expéditeur à la place de l'adresse habituelle.
        if (rp) {
            const noms = {}; for (const m of new Set([rp.mail].concat(Object.values(rp.roles || {})))) noms[m] = await quiDe(env, m);
            Object.assign(rp, { noms, qui: await quiDe(env, mail) });
        }
        return json({ ok: true, compte: true, mail, roles: await rolesActuels(env, mail, compte), remplacant: rp, appareils: compte.appareils.map(a => ({ id: a.id, cle: a.cle })) });
    }

    // Dépôt d'un envoi chiffré : le contenu une fois, une enveloppe (clé du contenu chiffrée) par appareil destinataire.
    if (chemin === 'envoyer' && methode === 'POST') {
        const texte = await requete.text();
        if (texte.length > TAILLE_MAX) return erreur(413, 'Envoi trop volumineux (25 Mo au plus).');
        let corps; try { corps = JSON.parse(texte); } catch (e) { return erreur(400, 'Envoi illisible.'); }
        const grp = lireGroupe(corps.destinataire);
        if (grp) {
            const type = String(corps.type || '');
            if (!(type in ROLE_REQUIS)) return erreur(400, 'Type d\'envoi inconnu.');
            if (ROLE_REQUIS[type] && ROLE_REQUIS[type] !== grp.role) return erreur(403, 'Cet envoi ne va pas aux ' + grp.libelle + '.');
            if (!corps.donnees || !corps.donnees.ct) return erreur(400, 'Envoi incomplet.');
            const membres = await membresGroupe(env, grp);
            if (!membres.length) return erreur(404, 'Aucun des ' + grp.libelle + ' n\'a encore de compte TRIGONE actif.');
            const id = Date.now().toString(36) + b64url(hasard(6)), le = Date.now(), db = await baseBoite(env), lignes = [], recus = [];
            for (const x of membres) {
                const ids = new Set(x.compte.appareils.map(a => a.id)), env2 = (corps.enveloppes || []).filter(e => ids.has(e.appareil));
                if (!env2.length) continue;
                recus.push({ x, apps: env2.map(e => e.appareil) });
                env2.forEach(e => lignes.push(db.prepare('INSERT INTO boite (id, dest, appareil, de, type, le, enveloppe) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .bind(id, x.mail, e.appareil, moi.mail, type, le, JSON.stringify({ epk: e.epk, iv: e.iv, ct: e.ct }))));
            }
            if (!recus.length) return erreur(400, 'Envoi incomplet : relancez l\'envoi.');
            await kv.put('msg:' + id, JSON.stringify(corps.donnees), { expirationTtl: DUREE_MESSAGE });
            await db.batch(lignes.concat(db.prepare('INSERT INTO groupe_envoi (id, groupe, membres, maj) VALUES (?, ?, ?, ?)').bind(id, grp.adresse, JSON.stringify(recus.map(r => r.x.mail)), le)));
            const nombre = Math.min(500, Math.max(1, parseInt(corps.nombre, 10) || 1));
            const prevenir = Promise.all(recus.map(r => notifier(env, r.x.mail, r.x.compte, r.apps, type, moi.mail, url.origin, nombre).catch(() => {})).concat([
                suiviEnvoi(env, moi, type, grp.adresse, id, nettoyerRefs(corps.refs), String(corps.qui || '').slice(0, 80), url.origin).catch(() => {}),
                suiviEquipe(env, moi, type, grp.adresse, nettoyerRefs([corps.equipe])[0], String(corps.qui || '').slice(0, 80), url.origin).catch(() => {})]));
            if (ctx && ctx.waitUntil) ctx.waitUntil(prevenir); else await prevenir;
            return json({ ok: true, id, groupe: grp.libelle, membres: recus.length });
        }
        const dest = await cleCompte(kv, corps.destinataire);
        const compte = await kv.get('compte:' + dest, 'json');
        if (!compte) return erreur(404, 'Ce destinataire n\'a pas de compte TRIGONE.');
        if (compte.attente) return erreur(403, 'Le compte TRIGONE de ce destinataire n\'est pas encore validé.');
        if (compte.bloque) return erreur(403, 'Le compte TRIGONE de ce destinataire est bloqué pour l\'instant (téléphone perdu).');
        // Chaque boîte ne reçoit que ce qui lui revient.
        const type = String(corps.type || '');
        if (!(type in ROLE_REQUIS)) return erreur(400, 'Type d\'envoi inconnu.');
        const requis = ROLE_REQUIS[type];
        if (requis && !(compte.roles || {})[requis] && !(await rolesActuels(env, dest, compte))[requis]) return erreur(403, dest + ' ' + MESSAGE_ROLE[requis]);
        const ids = new Set(compte.appareils.map(a => a.id));
        const enveloppes = (corps.enveloppes || []).filter(e => ids.has(e.appareil));
        if (!enveloppes.length || !corps.donnees || !corps.donnees.ct) return erreur(400, 'Envoi incomplet.');
        const id = Date.now().toString(36) + b64url(hasard(6));
        const le = Date.now();
        await kv.put('msg:' + id, JSON.stringify(corps.donnees), { expirationTtl: DUREE_MESSAGE });
        const db = await baseBoite(env);
        await db.batch(enveloppes.map(e => db.prepare('INSERT INTO boite (id, dest, appareil, de, type, le, enveloppe) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(id, dest, e.appareil, moi.mail, type, le, JSON.stringify({ epk: e.epk, iv: e.iv, ct: e.ct })))
            .concat(db.prepare('DELETE FROM boite WHERE le < ?').bind(le - DUREE_MESSAGE * 1000)));
        const nombre = Math.min(500, Math.max(1, parseInt(corps.nombre, 10) || 1));   // nombre de demandes (l'expéditeur le donne ; le contenu reste chiffré)
        const prevenir = Promise.all([
            notifier(env, dest, compte, enveloppes.map(e => e.appareil), type, moi.mail, url.origin, nombre).catch(() => {}),
            suiviEnvoi(env, moi, type, dest, id, nettoyerRefs(corps.refs), String(corps.qui || '').slice(0, 80), url.origin).catch(() => {}),
            suiviEquipe(env, moi, type, dest, nettoyerRefs([corps.equipe])[0], String(corps.qui || '').slice(0, 80), url.origin).catch(() => {}),
            origineConnue(env, url.origin).catch(() => {})
        ]);
        if (ctx && ctx.waitUntil) ctx.waitUntil(prevenir); else await prevenir;
        return json({ ok: true, id });
    }

    // Relève : liste des envois en attente pour cet appareil.
    // Mon adresse de réception des justificatifs (prénom.nom@trigone-app.com), créée ou suivie avec Mon profil.
    if (chemin === 'adresse' && (methode === 'GET' || methode === 'POST')) {
        const c = methode === 'POST' ? await requete.json().catch(() => ({})) : {};
        const local = methode === 'POST' ? await adresseDe(env, moi.mail, c.prenom, c.nom) : await kv.get('adresse-de:' + moi.mail);
        return json({ ok: true, adresse: local ? local + '@' + DOMAINE_RECEPTION : '' });
    }
    // ---------- Photo de carte partagée, chiffrée de bout en bout ----------
    // Appareils à qui remettre la clé de ma photo : ceux des comptes VALIDEUR 1 / 2 et ASSIST CHORUS DT, et des chefs des
    // missions collectives où je suis participant. Seulement des clés publiques (aucun mail).
    if (chemin === 'photo/destinataires' && methode === 'GET') {
        const db = await baseBoite(env);
        const mails = new Set(((await db.prepare('SELECT mail FROM porteur_role').all()).results || []).map(x => x.mail));
        ((await db.prepare('SELECT DISTINCT chef FROM equipe WHERE mail = ?').bind(moi.mail).all()).results || []).forEach(x => mails.add(x.chef));
        ((await db.prepare("SELECT DISTINCT chef FROM rattache WHERE mail = ? AND statut = 'membre'").bind(moi.mail).all()).results || []).forEach(x => mails.add(x.chef));
        // Mes autres appareils aussi (assistant ou valideur sur le PC, photo prise sur le téléphone).
        mails.add(moi.mail);
        const appareils = [];
        for (const m of [...mails].slice(0, 300)) {
            const c = await kv.get('compte:' + m, 'json');
            (c && c.appareils || []).forEach(a => { if (a.cle) appareils.push({ id: a.id, cle: a.cle }); });
        }
        return json({ ok: true, appareils });
    }
    // Ma photo chiffrée : { donnees: { iv, ct }, enveloppes: [{ appareil, epk, iv, ct }] } ; DELETE : je ne la partage plus.
    if (chemin === 'photo' && (methode === 'POST' || methode === 'DELETE')) {
        if (methode === 'DELETE') { await kv.delete('photo:' + moi.mail); return json({ ok: true }); }
        const c = await requete.json().catch(() => ({}));
        const d = c.donnees || {}, env2 = Array.isArray(c.enveloppes) ? c.enveloppes.slice(0, 600) : [];
        if (typeof d.ct !== 'string' || typeof d.iv !== 'string' || d.ct.length > 400000) return erreur(400, 'Photo trop lourde ou illisible.');
        const enveloppes = {};
        env2.forEach(e => { if (e && /^[\w-]{1,64}$/.test(String(e.appareil || '')) && typeof e.ct === 'string' && e.ct.length < 400) enveloppes[e.appareil] = { epk: e.epk, iv: e.iv, ct: e.ct }; });
        await kv.put('photo:' + moi.mail, JSON.stringify({ donnees: { iv: d.iv, ct: d.ct }, enveloppes, maj: Date.now() }));
        return json({ ok: true, n: Object.keys(enveloppes).length });
    }
    // Cartes des personnes d'une mission : { personnes: [{ nid, mail }] } (30 au plus). Pour chacune : carte vérifiée
    // (grade, nom, unité, depuis) et photo chiffrée pour CET appareil s'il en a la clé. Réservé aux VALIDEUR 1 / 2,
    // ASSIST CHORUS DT, au chef de la mission collective et à la personne elle-même.
    if (chemin === 'participants' && methode === 'POST') {
        const c = await requete.json().catch(() => ({}));
        const roles = moi.compte.roles || {}, aRole = ROLES.some(r => roles[r]);
        const db = await baseBoite(env);
        const quota = 'quota-part:' + moi.mail + ':' + new Date().toISOString().slice(0, 13), n = +(await kv.get(quota)) || 0;
        if (n >= 400) return erreur(429, 'Trop de cartes consultées en peu de temps : réessayez plus tard.');
        const liste = (Array.isArray(c.personnes) ? c.personnes : []).slice(0, 30);
        await kv.put(quota, String(n + liste.length), { expirationTtl: 2 * 3600 });
        const resultat = [];
        for (const p of liste) {
            const nid = chiffresNid(p && p.nid);
            let mail = nid ? await kv.get('nid:' + await empreinteNid(env, nid)) : null;
            if (!mail && p && p.mail) mail = await cleCompte(kv, p.mail);
            const r = { nid: (p && p.nid) || '', compte: false, carte: null, photo: null, moi: !!mail && mail === moi.mail };
            if (mail && await kv.get('compte:' + mail)) {
                const chef = !aRole && mail !== moi.mail ? (await db.prepare('SELECT 1 FROM equipe WHERE chef = ? AND mail = ? LIMIT 1').bind(moi.mail, mail).first()
                    || await db.prepare("SELECT 1 FROM rattache WHERE chef = ? AND mail = ? AND statut = 'membre' LIMIT 1").bind(moi.mail, mail).first()) : null;
                r.compte = true;
                const id = await kv.get('carte-de:' + mail), ca = id ? await kv.get('carte:' + id, 'json') : null;
                if (aRole || chef || mail === moi.mail) {
                    if (ca) r.carte = { grade: ca.grade || '', nom: ca.nom || '', prenom: ca.prenom || '', unite: ca.unite || '', cie: ca.cie || '', nid: ca.nid || '', depuis: ca.depuis || 0 };
                    const ph = await kv.get('photo:' + mail, 'json');
                    if (ph) r.photo = ph.enveloppes && ph.enveloppes[moi.appareil.id] ? { donnees: ph.donnees, enveloppe: ph.enveloppes[moi.appareil.id] } : { partagee: true };
                } else if (ca) r.carte = { depuis: ca.depuis || 0 };   // chef d'une demande pas encore partie : « vérifiée », rien de plus
                // (il connaît déjà matricule et identité par sa demande ; ni les données du serveur ni la photo)
            }
            resultat.push(r);
        }
        return json({ ok: true, personnes: resultat });
    }
    // ----- « Me rattacher à une mission » : le chef de mission ouvre sa demande collective avec un code à 6 chiffres,
    // chaque participant de son unité s'y rattache lui-même ; son identité (carte TRIGONE) arrive dans la liste du chef.
    if (chemin.startsWith('mission/')) {
        const db = await baseBoite(env), maintenant = Date.now();
        const corps = methode === 'POST' ? await requete.json().catch(() => ({})) : {};
        const code = String(corps.code || url.searchParams.get('code') || '').replace(/\D/g, '').slice(0, 6);
        const monUnite = (await kv.get('unite-de:' + moi.mail)) || UNITE_REGISTRE;
        const lire = async c => { const m = c ? await db.prepare('SELECT * FROM mission WHERE code = ?').bind(c).first() : null; if (m) m.resume = JSON.parse(m.resume || '{}'); return m; };
        const expiree = m => m.etat === 'ouverte' && m.expire && m.expire < maintenant;
        const libelle = m => (m.resume && (m.resume.objet || m.resume.lieu)) ? ' « ' + String(m.resume.objet || m.resume.lieu).slice(0, 60) + ' »' : '';
        const membres = async c => ((await db.prepare("SELECT mail, ident, le FROM rattache WHERE code = ? AND statut = 'membre' ORDER BY le").bind(c).all()).results || [])
            .map(x => ({ mail: x.mail, ident: JSON.parse(x.ident || '{}'), le: x.le }));
        const prevenir = (mails, titre, texte) => Promise.all(mails.map(m => notifierCompte(env, m, { titre, texte, type: 'SUIVI', url: '/' }, url.origin).catch(() => {})));
        const resumeDe = r => { r = r || {}; const t = (v, n) => String(v || '').slice(0, n);
            return { objet: t(r.objet, 120), type: t(r.type, 20), lieu: t(r.lieu, 80), pays: t(r.pays, 40), dep: t(r.dep, 30), ret: t(r.ret, 30), moyen: t(r.moyen, 40) }; };
        // Le chef ouvre (ou met à jour, ou rouvre après l'envoi) sa mission ; un code nouveau si besoin.
        if (chemin === 'mission/ouvrir' && methode === 'POST') {
            // Expiration : le départ de la mission (une heure au moins) ; sans date de départ encore saisie, 30 jours.
            const exp = +corps.expire > 0 ? Math.min(Math.max(+corps.expire, maintenant + 3600 * 1000), maintenant + 120 * JOUR * 1000) : maintenant + 30 * JOUR * 1000;
            const ref = nettoyerRefs([corps.ref])[0] || '';
            let m = await lire(code);
            if (m && m.chef === moi.mail && m.etat !== 'annulee') {
                // Mise à jour du résumé ; une mission déjà envoyée ne se rouvre que sur demande (« Rouvrir la mission »).
                const rouvrir = !!corps.rouvrir || m.etat === 'ouverte';
                await db.prepare("UPDATE mission SET resume = ?, expire = ?, ref = COALESCE(NULLIF(?, ''), ref), etat = ?, maj = ? WHERE code = ?")
                    .bind(JSON.stringify(resumeDe(corps.resume)), exp, ref, rouvrir ? 'ouverte' : m.etat, maintenant, code).run();
                return json({ ok: true, code, expire: exp, etat: rouvrir ? 'ouverte' : m.etat, rouverte: rouvrir && m.etat !== 'ouverte' });
            }
            await db.prepare('DELETE FROM mission WHERE expire < ?').bind(maintenant - 60 * JOUR * 1000).run();
            const n = (await db.prepare("SELECT COUNT(*) AS n FROM mission WHERE chef = ? AND etat = 'ouverte' AND expire > ?").bind(moi.mail, maintenant).first() || {}).n || 0;
            if (n >= 20) return erreur(429, 'Vous avez déjà 20 missions ouvertes : envoyez ou annulez-en une d\'abord.');
            let neuf = '';
            for (let i = 0; i < 12 && !neuf; i++) {
                const c = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
                if (!(await db.prepare('SELECT 1 FROM mission WHERE code = ?').bind(c).first())) neuf = c;
            }
            if (!neuf) return erreur(503, 'Aucun code disponible pour l\'instant : réessayez.');
            await db.prepare("INSERT INTO mission (code, chef, unite, resume, etat, cree, expire, ref, motif, maj) VALUES (?, ?, ?, ?, 'ouverte', ?, ?, ?, '', ?)")
                .bind(neuf, moi.mail, monUnite, JSON.stringify(resumeDe(corps.resume)), maintenant, exp, ref, maintenant).run();
            return json({ ok: true, code: neuf, expire: exp });
        }
        // Une mission vue par celui qui tape son code (avant de se rattacher) : 30 essais par heure contre les codes au hasard.
        if ((chemin === 'mission/voir' && methode === 'GET') || (chemin === 'mission/rejoindre' && methode === 'POST')) {
            const lim = 'limite-mission:' + moi.mail, nl = +(await kv.get(lim)) || 0;
            if (nl >= 30) return erreur(429, 'Trop de codes essayés : réessayez dans une heure.');
            const m = await lire(code);
            if (!m || expiree(m)) { await kv.put(lim, String(nl + 1), { expirationTtl: 3600 }); return erreur(404, 'Code inconnu ou expiré : vérifiez les 6 chiffres auprès de votre chef de mission.'); }
            if (m.unite !== monUnite) return erreur(403, 'Cette mission est celle d\'une autre unité.');
            const lui = await db.prepare('SELECT statut FROM rattache WHERE code = ? AND mail = ?').bind(code, moi.mail).first();
            const n = (await db.prepare("SELECT COUNT(*) AS n FROM rattache WHERE code = ? AND statut = 'membre'").bind(code).first() || {}).n || 0;
            const vue = { code, resume: m.resume, chef: await quiDe(env, m.chef), etat: m.etat, n: n + 1, statut: lui ? lui.statut : '', estChef: m.chef === moi.mail };
            if (chemin === 'mission/voir') return json(Object.assign({ ok: true }, vue));
            if (m.chef === moi.mail) return erreur(400, 'Vous êtes le chef de cette mission : vous y êtes déjà.');
            if (m.etat === 'annulee') return erreur(410, 'Cette mission a été annulée.');
            if (m.etat !== 'ouverte') return erreur(409, 'La demande est déjà partie aux valideurs : demandez à votre chef de mission de la rouvrir.');
            if (lui && lui.statut === 'retire') return erreur(403, 'Le chef de mission vous a retiré de cette mission : voyez avec lui.');
            if (lui && lui.statut === 'membre') return json({ ok: true, deja: true, n: vue.n });
            const id = await kv.get('carte-de:' + moi.mail), ca = id ? await kv.get('carte:' + id, 'json') : null;
            if (!ca || !(ca.nom || ca.prenom)) return erreur(400, 'Votre carte TRIGONE n\'est pas encore prête : ouvrez « Ma carte » une fois (profil complet), puis réessayez.');
            if (!chiffresNid(ca.nid)) return erreur(400, 'Votre matricule (NID) manque : renseignez-le dans Mon profil, puis réessayez.');
            const ident = { grade: ca.grade || '', nom: (ca.nom || '').toUpperCase(), prenom: ca.prenom || '', unite: ca.unite || '', cie: ca.cie || '', nid: ca.nid || '' };
            await db.prepare("INSERT INTO rattache (code, mail, chef, ident, statut, le) VALUES (?, ?, ?, ?, 'membre', ?) ON CONFLICT (code, mail) DO UPDATE SET ident = excluded.ident, statut = 'membre', le = excluded.le")
                .bind(code, moi.mail, m.chef, JSON.stringify(ident), maintenant).run();
            await prevenir([m.chef], 'Nouveau participant', [ident.grade, ident.nom, ident.prenom].filter(Boolean).join(' ') + ' s\'est rattaché à votre mission' + libelle(m) + ' (' + (n + 2) + ' pax).');
            return json({ ok: true, n: n + 2 });
        }
        // Les missions où je suis rattaché (60 derniers jours) : état, chef, résumé.
        if (chemin === 'mission/miennes' && methode === 'GET') {
            const r = (await db.prepare("SELECT r.code, r.statut, r.le, m.etat, m.resume, m.chef, m.motif, m.expire FROM rattache r JOIN mission m ON m.code = r.code WHERE r.mail = ? AND r.statut IN ('membre', 'retire') AND r.le > ? ORDER BY r.le DESC LIMIT 30")
                .bind(moi.mail, maintenant - 60 * JOUR * 1000).all()).results || [];
            const sortie = [];
            for (const x of r) sortie.push({ code: x.code, statut: x.statut, le: x.le, etat: expiree(x) ? 'expiree' : x.etat, motif: x.motif || '', resume: JSON.parse(x.resume || '{}'), chef: await quiDe(env, x.chef) });
            return json({ ok: true, missions: sortie });
        }
        if (chemin === 'mission/quitter' && methode === 'POST') {
            const m = await lire(code);
            if (!m) return erreur(404, 'Mission inconnue.');
            if (m.etat === 'envoyee') return erreur(409, 'La demande est déjà partie aux valideurs : voyez avec votre chef de mission.');
            const r = await db.prepare("UPDATE rattache SET statut = 'parti', le = ? WHERE code = ? AND mail = ? AND statut = 'membre'").bind(maintenant, code, moi.mail).run();
            if (r.meta && r.meta.changes && m.etat === 'ouverte') await prevenir([m.chef], 'Participant détaché', (await quiDe(env, moi.mail) || moi.mail) + ' s\'est détaché de votre mission' + libelle(m) + '.');
            return json({ ok: true });
        }
        // Tout le reste : le chef de la mission seulement.
        const m = await lire(code);
        if (!m && chemin !== 'mission/annuler') return erreur(404, 'Mission inconnue.');
        if (m && m.chef !== moi.mail) return erreur(403, 'Réservé au chef de cette mission.');
        if (chemin === 'mission/liste' && methode === 'GET') return json({ ok: true, code, etat: expiree(m) ? 'expiree' : m.etat, expire: m.expire, membres: await membres(code) });
        if (chemin === 'mission/retirer' && methode === 'POST') {
            if (m.etat === 'envoyee') return erreur(409, 'La demande est partie : rouvrez la mission pour retirer quelqu\'un (elle repartira aux valideurs).');
            const cible = await cleCompte(kv, String(corps.mail || ''));
            const r = await db.prepare("UPDATE rattache SET statut = 'retire', le = ? WHERE code = ? AND mail = ? AND statut = 'membre'").bind(maintenant, code, cible).run();
            if (r.meta && r.meta.changes) await prevenir([cible], 'Retiré d\'une mission', 'Le chef de mission ' + (await quiDe(env, moi.mail)) + ' vous a retiré de la mission' + libelle(m) + '.');
            return json({ ok: true, membres: await membres(code) });
        }
        // Demande envoyée aux valideurs : la liste est figée, le code ne marche plus.
        if (chemin === 'mission/fermer' && methode === 'POST') {
            if (m.etat === 'annulee') return json({ ok: true, etat: 'annulee' });
            await db.prepare("UPDATE mission SET etat = 'envoyee', ref = COALESCE(NULLIF(?, ''), ref), maj = ? WHERE code = ?").bind(nettoyerRefs([corps.ref])[0] || '', maintenant, code).run();
            const l = await membres(code);
            await prevenir(l.map(x => x.mail), 'Demande envoyée', 'La demande de la mission' + libelle(m) + ' est partie aux valideurs (' + (l.length + 1) + ' pax).');
            return json({ ok: true, etat: 'envoyee', n: l.length + 1 });
        }
        // Mission annulée par le chef (ou par le demandeur d'une demande déjà envoyée, avec ou sans code) :
        // rattachés, participants (retrouvés par leur matricule), valideurs et assistants Chorus DT prévenus ; la ligne du
        // registre des OMR est marquée « annulée » (pas effacée) ; plus de rappel de départ ; plus de compte-rendu attendu.
        if (chemin === 'mission/annuler' && methode === 'POST') {
            const motif = String(corps.motif || '').trim().slice(0, 200), ref = nettoyerRefs([corps.ref])[0] || (m && m.ref) || '', omr = String(corps.omr || '').slice(0, 30);
            const objet = String(corps.objet || (m && (m.resume.objet || m.resume.lieu)) || '').slice(0, 80), qui = await quiDe(env, moi.mail);
            const texte = 'La mission' + (objet ? ' « ' + objet + ' »' : '') + (omr ? ' (OMR N°' + omr + ')' : '') + ' est annulée' + (qui ? ' par ' + qui : '') + (motif ? ' : ' + motif : '') + '. Aucun compte-rendu ne sera à faire.';
            const prev = new Set();
            let trouve = !!m;   // une mission à moi, ou une demande à moi dans le suivi : sinon rien n'est fait (ni personne prévenu)
            if (m) {
                await db.prepare("UPDATE mission SET etat = 'annulee', motif = ?, maj = ? WHERE code = ?").bind(motif, maintenant, m.code).run();
                (await membres(m.code)).forEach(x => prev.add(x.mail));
            }
            if (ref) {
                const lignes = (await db.prepare("SELECT * FROM suivi WHERE ref = ? AND demandeur = ? AND genre = 'mer' AND etape NOT IN ('annulee')").bind(ref, moi.mail).all()).results || [];
                if (lignes.length) {
                    trouve = true;
                    await avancerSuivi(env, lignes, 'annulee', { trace: { e: 'annulee', le: maintenant, qui, par: moi.mail } }, url.origin, null);
                    ((await db.prepare('SELECT mail FROM suivi_acteur WHERE ref = ? AND demandeur = ?').bind(ref, moi.mail).all()).results || []).forEach(x => prev.add(x.mail));
                    for (const l of lignes) if (l.detenteur && await kv.get('compte:' + l.detenteur)) prev.add(l.detenteur);
                }
                await db.prepare('DELETE FROM rappel WHERE ref = ? AND mail = ?').bind(ref, moi.mail).run();
                const u = uniteRegistre(requete);
                const ligne = await db.prepare("SELECT * FROM registre WHERE unite = ? AND supprime = 0 AND ((? <> '' AND omr = ?) OR ref = ? OR mref = ?) ORDER BY maj DESC LIMIT 1").bind(u, omr, omr, ref, ref).first();
                if (ligne) {
                    const d = JSON.parse(ligne.donnees || '{}');
                    if (d.mailDemandeur === moi.mail && !(d.tampon && d.tampon.s === 'annule')) {
                        // Même tampon « ANNULÉ » que celui de l'assistant Chorus DT : ligne fermée, plus de CR attendu ni de relance.
                        d.tampon = { s: 'annule', le: maintenant, par: (qui || moi.mail) + ' (demandeur)', motif, unite: nomUnite(u) };
                        await registreEcrireLigne(db, u, d, maintenant, moi.mail);
                    }
                }
            }
            if (!trouve) return erreur(404, 'Demande inconnue : elle n\'a peut-être pas encore été reçue par le serveur (envoi en attente de réseau).');
            for (const nid of (Array.isArray(corps.nids) ? corps.nids : []).slice(0, 60)) {
                const c = chiffresNid(nid), mail = c ? await kv.get('nid:' + await empreinteNid(env, c)) : null;
                if (mail) prev.add(mail);
            }
            prev.delete(moi.mail);
            await prevenir([...prev], 'Mission annulée', texte);
            return json({ ok: true, prevenus: prev.size });
        }
        return erreur(404, 'Action inconnue.');
    }
    // États des envois (traité, rouvert, supprimé) partagés entre mes appareils : { etats: [{ id, statut, le }], depuis }.
    // Le plus récent (le) l'emporte ; réponse : états changés depuis « depuis » (horloge du serveur).
    if (chemin === 'boite/etats' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const db = await baseBoite(env), maint = Date.now();
        const etats = (Array.isArray(corps.etats) ? corps.etats : []).slice(0, 200)
            .filter(e => e && /^[\w.-]{1,64}$/.test(String(e.id || '')) && ['traite', 'ouvert', 'supprime'].includes(e.statut));
        for (const e of etats) {
            const le = Math.min(+e.le || maint, maint);
            await db.prepare('INSERT INTO boite_etat (mail, id, statut, le, maj) VALUES (?, ?, ?, ?, ?) ON CONFLICT (mail, id) DO UPDATE SET statut = excluded.statut, le = excluded.le, maj = excluded.maj WHERE excluded.le >= boite_etat.le')
                .bind(moi.mail, String(e.id), e.statut, le, maint).run();
        }
        // Envoi au groupe traité par moi le premier : « traité par … » chez les autres membres, rangé dans leur boîte.
        for (const e of etats.filter(x => x.statut === 'traite')) {
            const g = await db.prepare('SELECT * FROM groupe_envoi WHERE id = ?').bind(String(e.id)).first();
            if (!g || g.pris_par) continue;
            const membres = JSON.parse(g.membres || '[]');
            if (!membres.includes(moi.mail)) continue;
            const l = await ligneCompte(env, moi.mail), qui = l ? [l.grade, l.nom, l.prenom].filter(Boolean).join(' ') : '';
            await db.batch([db.prepare('UPDATE groupe_envoi SET pris_par = ?, pris_qui = ?, pris_le = ?, maj = ? WHERE id = ? AND pris_par IS NULL').bind(moi.mail, qui || moi.mail, maint, maint, g.id)]
                .concat(membres.filter(m => m !== moi.mail).map(m => db.prepare('INSERT INTO boite_etat (mail, id, statut, le, maj) VALUES (?, ?, ?, ?, ?) ON CONFLICT (mail, id) DO UPDATE SET statut = excluded.statut, le = excluded.le, maj = excluded.maj WHERE boite_etat.statut <> \'supprime\'')
                    .bind(m, g.id, 'traite', maint, maint))));
        }
        if (Math.random() < 0.02) { await db.prepare('DELETE FROM boite_etat WHERE maj < ?').bind(maint - 120 * 86400000).run(); await db.prepare('DELETE FROM groupe_envoi WHERE maj < ?').bind(maint - 120 * 86400000).run(); }
        const depuis = Math.max(0, +corps.depuis || 0);
        const r = (await db.prepare('SELECT id, statut, le FROM boite_etat WHERE mail = ? AND maj > ? ORDER BY maj LIMIT 1000').bind(moi.mail, depuis).all()).results || [];
        const g = (await db.prepare('SELECT id, pris_par, pris_qui FROM groupe_envoi WHERE maj > ? AND pris_par IS NOT NULL AND membres LIKE ? LIMIT 500').bind(depuis, '%"' + moi.mail + '"%').all()).results || [];
        return json({ ok: true, etats: r, maintenant: maint, groupes: g.map(x => ({ id: x.id, par: x.pris_par, qui: x.pris_qui, moi: x.pris_par === moi.mail })) });
    }
    if (chemin === 'boite' && methode === 'GET') {
        const db = await baseBoite(env);
        const sigRoles = ROLES.filter(r => (moi.compte.roles || {})[r]).join(',');
        if ((await kv.get('idx-roles:' + moi.mail)) !== sigRoles) await indexerRoles(env, moi.mail, moi.compte.roles);
        const r = await db.prepare('SELECT b.id, b.de, b.type, b.le, g.groupe FROM boite b LEFT JOIN groupe_envoi g ON g.id = b.id WHERE b.dest = ? AND b.appareil = ? AND b.le > ? ORDER BY b.le')
            .bind(moi.mail, moi.appareil.id, Date.now() - DUREE_MESSAGE * 1000).all();
        return json({ ok: true, envois: r.results || [] });
    }
    const m = /^boite\/([\w-]+)$/.exec(chemin);
    if (m) {
        const db = await baseBoite(env);
        if (methode === 'GET') {
            const ligne = await db.prepare('SELECT id, de, type, le, enveloppe FROM boite WHERE id = ? AND dest = ? AND appareil = ?').bind(m[1], moi.mail, moi.appareil.id).first();
            if (!ligne) return erreur(404, 'Envoi introuvable ou expiré.');
            const donnees = await kv.get('msg:' + m[1], 'json');
            if (!donnees) return erreur(404, 'Envoi expiré.');
            return json({ ok: true, id: ligne.id, de: ligne.de, type: ligne.type, le: ligne.le, enveloppe: JSON.parse(ligne.enveloppe), donnees });
        }
        if (methode === 'DELETE') {
            await db.prepare('DELETE FROM boite WHERE id = ? AND dest = ? AND appareil = ?').bind(m[1], moi.mail, moi.appareil.id).run();
            // Compte-rendu relevé par l'assistant Chorus DT : le missionnaire est prévenu qu'il a été récupéré.
            const dets = [moi.mail].concat(await groupesDe(env, moi));
            const cr = (await db.prepare('SELECT * FROM suivi WHERE envoi = ? AND genre = ? AND etape = ? AND detenteur IN (' + dets.map(() => '?').join(',') + ')').bind(m[1], 'cr', 'chorus', ...dets).all()).results || [];
            if (cr.length) {
                const p = avancerSuivi(env, cr, 'recu', { auteur: moi.mail, trace: { e: 'recu', le: Date.now(), qui: '', par: moi.mail } }, url.origin, 'recu').catch(() => {});
                if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
            }
            return json({ ok: true });
        }
    }

    // Absence : un remplaçant par rôle (compte TRIGONE existant qui a ce rôle), jusqu'à une date (90 jours au plus).
    // corps.roles = { valideur1, valideur2, chorus } (un rôle laissé vide reste chez moi) ; corps.mail seul = même
    // remplaçant pour tous mes rôles (anciennes versions) ; rien = fin de l'absence.
    if (chemin === 'remplacant' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const NOMS = { valideur1: 'VALIDEUR 1', valideur2: 'VALIDEUR 2', chorus: 'ASSIST CHORUS DT' };
        const mesRoles = Object.keys(NOMS).filter(r => (moi.compte.roles || {})[r]);
        const demande = corps.roles && typeof corps.roles === 'object' ? corps.roles : corps.mail ? Object.fromEntries(mesRoles.map(r => [r, corps.mail])) : {};
        const roles = {};
        for (const r of mesRoles) {
            if (!String(demande[r] || '').trim()) continue;
            const m = await cleCompte(kv, demande[r]);
            if (!m || !mailValide(m) || m === moi.mail) return erreur(400, 'Adresse du remplaçant ' + NOMS[r] + ' invalide.');
            const cr = await kv.get('compte:' + m, 'json');
            if (!cr || !cr.appareils.length) return erreur(404, m + ' n\'a pas encore de compte TRIGONE : demandez-lui de l\'activer.');
            if (!(cr.roles || {})[r] && !(await rolesActuels(env, m, cr))[r] && !corps.mail) return erreur(400, m + ' n\'a pas le rôle ' + NOMS[r] + ' : choisissez quelqu\'un qui l\'a, ou laissez ce rôle vide.');
            roles[r] = m;
        }
        if (!Object.keys(roles).length) { delete moi.compte.remplacant; await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte)); return json({ ok: true, remplacant: null }); }
        const jusqu = +corps.jusqu || 0;
        if (jusqu <= Date.now() || jusqu > Date.now() + 90 * JOUR * 1000) return erreur(400, 'Date de fin d\'absence invalide (dans les 90 jours).');
        moi.compte.remplacant = { mail: roles[mesRoles.find(r => roles[r])], jusqu, roles };
        await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
        return json({ ok: true, remplacant: moi.compte.remplacant, rolesManquants: [] });
    }
    // Demandes abandonnées par leur demandeur (retirées de Documents après un refus) : plus de relance.
    if (chemin === 'suivi/abandon' && methode === 'POST') {
        const refs = nettoyerRefs((await requete.json().catch(() => ({}))).refs);
        if (refs.length) await (await baseBoite(env)).prepare('UPDATE suivi SET etape = \'abandon\', relance = NULL WHERE genre = \'mer\' AND etape = \'refus\' AND demandeur = ? AND ref IN (' + refs.map(() => '?').join(',') + ')')
            .bind(moi.mail, ...refs).run();
        return json({ ok: true });
    }
    // Suivi : où en sont mes demandes et mes comptes-rendus (seulement les miens).
    if (chemin === 'suivi' && methode === 'GET') {
        // Mes demandes et comptes-rendus, et les demandes où je suis intervenu (valideur, assistant Chorus DT).
        const r = await (await baseBoite(env)).prepare('SELECT ref, genre, etape, envoi, le, etapes, 1 AS moi FROM suivi WHERE demandeur = ? ' +
            'UNION ALL SELECT s.ref, s.genre, s.etape, s.envoi, s.le, s.etapes, 0 AS moi FROM suivi s JOIN suivi_acteur a ON a.ref = s.ref AND a.demandeur = s.demandeur WHERE a.mail = ? ' +
            'ORDER BY le DESC LIMIT 500').bind(moi.mail, moi.mail).all();
        return json({ ok: true, suivi: (r.results || []).map(x => ({ ref: x.ref, genre: x.genre, etape: x.etape, envoi: x.envoi, le: x.le, intervenant: !x.moi,
            etapes: JSON.parse(x.etapes || '[]').map(t => ({ e: t.e, le: t.le, qui: t.qui })) })) });
    }
    // L'assistant Chorus DT a traité des demandes (refs) ou des comptes-rendus (envois) qu'il détient.
    if (chemin === 'suivi/traite' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const refs = nettoyerRefs(corps.refs), envois = nettoyerRefs(corps.envois);
        const db = await baseBoite(env);
        const lignes = [], dets = [moi.mail].concat(await groupesDe(env, moi)), qd = dets.map(() => '?').join(',');
        if (refs.length) lignes.push(...((await db.prepare('SELECT * FROM suivi WHERE genre = ? AND detenteur IN (' + qd + ') AND etape = ? AND ref IN (' + refs.map(() => '?').join(',') + ')')
            .bind('mer', ...dets, 'chorus', ...refs).all()).results || []));
        if (envois.length) lignes.push(...((await db.prepare('SELECT * FROM suivi WHERE genre = ? AND detenteur IN (' + qd + ') AND etape IN (\'chorus\', \'recu\') AND envoi IN (' + envois.map(() => '?').join(',') + ')')
            .bind('cr', ...dets, ...envois).all()).results || []));
        const qui = String(corps.qui || '').slice(0, 80);
        await avancerSuivi(env, lignes, 'traite', { auteur: moi.mail, trace: { e: 'traite', le: Date.now(), qui, par: moi.mail } }, url.origin, 'traite');
        return json({ ok: true, n: lignes.length });
    }
    // Rappels « départ en mission » des demandes que je viens d'envoyer : { rappels: [{ ref, quand }] } (quand : ms).
    // Une demande renvoyée après correction remplace son rappel ; quand = 0 le retire.
    if (chemin === 'rappel' && methode === 'POST') {
        const liste = ((await requete.json().catch(() => ({}))).rappels || []).slice(0, 50);
        const db = await baseBoite(env), maintenant = Date.now();
        const ok = liste.map(x => ({ ref: nettoyerRefs([x && x.ref])[0], quand: Math.round(+(x && x.quand) || 0) }))
            .filter(x => x.ref && (x.quand === 0 || (x.quand > maintenant - 3600 * 1000 && x.quand < maintenant + 400 * JOUR * 1000)));
        if (ok.length) await db.batch(ok.map(x => x.quand ? db.prepare('INSERT OR REPLACE INTO rappel (ref, mail, quand, envoye) VALUES (?, ?, ?, NULL)').bind(x.ref, moi.mail, x.quand)
            : db.prepare('DELETE FROM rappel WHERE ref = ? AND mail = ?').bind(x.ref, moi.mail)));
        return json({ ok: true, n: ok.length });
    }
    // Tests locaux : envoyer les rappels « départ » comme si « decalage » ms s'étaient écoulées.
    if (chemin === 'test/rappels' && methode === 'POST' && env.MODE_TEST === '1') {
        const corps = await requete.json().catch(() => ({}));
        return json({ ok: true, n: await envoyerRappels(env, url.origin, Date.now() + (+corps.decalage || 0)) });
    }
    // Tests locaux : lancer les relances maintenant, comme si « decalage » ms s'étaient écoulées.
    if (chemin === 'test/relance' && methode === 'POST' && env.MODE_TEST === '1') {
        const corps = await requete.json().catch(() => ({}));
        return json({ ok: true, n: await relancer(env, url.origin, Date.now() + (+corps.decalage || 0), true) });
    }

    // Déconnexion de cet appareil (ou suppression du compte s'il n'en reste aucun).
    if (chemin === 'appareil' && methode === 'DELETE') {
        await (await baseBoite(env)).prepare('DELETE FROM abonnement WHERE mail = ? AND appareil = ?').bind(moi.mail, moi.appareil.id).run();
        await (await baseBoite(env)).prepare('DELETE FROM muet WHERE mail = ? AND appareil = ?').bind(moi.mail, moi.appareil.id).run();
        moi.compte.appareils = moi.compte.appareils.filter(a => a.id !== moi.appareil.id);
        if (moi.compte.appareils.length) await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
        else {
            await kv.delete('compte:' + moi.mail);
            const monNid = (await kv.get('nid-de:' + moi.mail)) || moi.compte.nid || '';
            if (monNid && await kv.get('nid:' + monNid) === moi.mail) await kv.delete('nid:' + monNid);
            await kv.delete('nid-de:' + moi.mail);
            const maCarte = await kv.get('carte-de:' + moi.mail);
            if (maCarte) { await kv.delete('carte:' + maCarte); await kv.delete('carte-de:' + moi.mail); }
        }
        return json({ ok: true });
    }
    return erreur(404, 'Inconnu.');
}

// ---------- Mise à jour publiée : notification à tous les appareils abonnés ----------
// build.json (publié avec l'appli) : « build » (numéro de publication), « notifier » (true : cette version mérite une
// notification) et « message » (nouveautés en une ligne). Chaque numéro n'est traité qu'une fois (reglage « maj »,
// mis à jour de façon atomique : deux exécutions simultanées n'envoient pas deux fois). Appareils aux notifications
// coupées : rien.
let dernierControleMaj = 0;
async function notifierMiseAJour(env, origine) {
    if (!env.TRIGONE_DB || !env.ASSETS) return;
    dernierControleMaj = Date.now();
    const r = await env.ASSETS.fetch(new Request(new URL('/build.json', origine || 'https://trigone.invalid').href));
    if (!r.ok) return;
    const b = await r.json(), n = parseInt(b.build, 10);
    if (!n) return;
    const db = await tableReglage(env);
    const maj = await db.prepare("INSERT INTO reglage (cle, valeur) VALUES ('maj', ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur WHERE CAST(reglage.valeur AS INTEGER) < CAST(excluded.valeur AS INTEGER)")
        .bind(String(n)).run();
    if (!(maj.meta && maj.meta.changes) || b.notifier !== true) return;
    const o = origine || await origineConnue(env);
    const l = ((await db.prepare('SELECT a.mail, a.appareil, a.endpoint, a.p256dh, a.auth FROM abonnement a WHERE NOT EXISTS (SELECT 1 FROM muet m WHERE m.mail = a.mail AND m.appareil = a.appareil)').all()).results) || [];
    const texte = String(b.message || 'Nouvelle version : ouvrez TRIGONE pour la mettre à jour.').slice(0, 200);
    for (let i = 0; i < l.length; i += 20) {
        await Promise.all(l.slice(i, i + 20).map(async x => {
            try {
                const rep = await envoyerPush(env, { endpoint: x.endpoint, keys: { p256dh: x.p256dh, auth: x.auth } },
                    { titre: 'TRIGONE — nouvelle version', texte, type: 'MAJ', nombre: 1, url: '/' }, o);
                if (rep.status === 404 || rep.status === 410) await db.prepare('DELETE FROM abonnement WHERE mail = ? AND appareil = ?').bind(x.mail, x.appareil).run();
            } catch (e) {}
        }));
    }
}

// ---------- Justificatifs reçus par mail (factures d'hôtel, billets SNCF…) ----------
// Chaque missionnaire a une adresse prénom.nom@trigone-app.com (Cloudflare Email Routing : « Tout intercepter » →
// ce Worker). Seules les pièces jointes PDF et images sont gardées ; elles sont aussitôt chiffrées pour les appareils
// du missionnaire (même enveloppe que les envois entre comptes TRIGONE) et déposées dans sa boîte (type JUSTIF).
// Transféré par le missionnaire lui-même ou venant d'un expéditeur connu : « Justificatifs » ; sinon « À vérifier ».
const DOMAINE_RECEPTION = 'trigone-app.com';
const ADRESSES_RESERVEES = ['noreply', 'no-reply', 'admin', 'administrateur', 'postmaster', 'abuse', 'contact', 'support', 'trigone', 'webmaster', 'dmarc', 'securite'];
const EXPEDITEURS_CONNUS = ['sncf-connect.com', 'sncf.com', 'sncf.fr', 'oui.sncf', 'ouigo.com', 'voyages-sncf.com', 'airfrance.fr', 'airfrance.com', 'hop.fr', 'trainline.fr', 'trainline.com', 'booking.com', 'accor.com', 'all.accor.com', 'bestwestern.fr', 'ibis.com', 'b-and-b-hotels.com'];
const TAILLE_MAX_MAIL = 12 * 1024 * 1024, TAILLE_MAX_PJ = 6 * 1024 * 1024, NB_MAX_PJ = 10;
function slugAdresse(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
async function adresseDe(env, mail, prenom, nom) {
    const kv = env.TRIGONE_KV, base = [slugAdresse(prenom), slugAdresse(nom)].filter(Boolean).join('.');
    const actuelle = await kv.get('adresse-de:' + mail);
    if (!base) return actuelle;
    if (actuelle && new RegExp('^' + base.replace(/[.]/g, '\\.') + '\\d*$').test(actuelle)) return actuelle;
    for (let i = 1; i < 200; i++) {
        const local = base + (i > 1 ? i : '');
        if (ADRESSES_RESERVEES.includes(local) || lireGroupe(local + '@' + DOMAINE_RECEPTION)) continue;
        const tenant = await kv.get('adresse:' + local);
        if (tenant && tenant !== mail && await kv.get('compte:' + tenant)) continue;
        if (actuelle && actuelle !== local && await kv.get('adresse:' + actuelle) === mail) await kv.delete('adresse:' + actuelle);
        await kv.put('adresse:' + local, mail); await kv.put('adresse-de:' + mail, local);
        return local;
    }
    return actuelle;
}
// MIME : en-têtes, parties (multipart, message transféré en pièce jointe), base64 / quoted-printable.
function binaire(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; }
function octetsDe(bin) { const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i) & 255; return o; }
function utf8(bin) { try { return new TextDecoder().decode(octetsDe(bin)); } catch (e) { return bin; } }
function decoderMot(t) {
    return String(t || '').replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (m, cs, enc, txt) => {
        try {
            const bin = /b/i.test(enc) ? atob(txt.replace(/\s/g, '')) : txt.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16)));
            return /utf-?8/i.test(cs) ? utf8(bin) : bin;
        } catch (e) { return txt; }
    }).replace(/\?=\s+=\?/g, '');
}
function entetes(bloc) {
    const h = {};
    bloc.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => { const i = l.indexOf(':'); if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(); if (!(k in h)) h[k] = l.slice(i + 1).trim(); } });
    return h;
}
function parametre(v, nom) {
    const etoile = new RegExp(nom + '\\*(?:0\\*?)?=(?:[^\']*\'[^\']*\')?"?([^";]+)', 'i').exec(v || '');
    if (etoile) { try { return decodeURIComponent(etoile[1]); } catch (e) { return etoile[1]; } }
    const m = new RegExp(nom + '\\s*=\\s*"([^"]*)"|' + nom + '\\s*=\\s*([^;\\s]+)', 'i').exec(v || '');
    return m ? decoderMot(m[1] !== undefined ? m[1] : m[2]) : '';
}
function partiesMail(bin, sortie, profondeur) {
    if (profondeur > 6 || sortie.length >= NB_MAX_PJ) return;
    const sep = bin.search(/\r?\n\r?\n/); if (sep < 0) return;
    const h = entetes(bin.slice(0, sep)), corps = bin.slice(sep).replace(/^\r?\n\r?\n/, '');
    const ct = h['content-type'] || 'text/plain', type = ct.split(';')[0].trim().toLowerCase();
    if (/^multipart\//.test(type)) {
        const b = parametre(ct, 'boundary'); if (!b) return;
        corps.split('--' + b).slice(1).forEach(p => { if (!/^--/.test(p)) partiesMail(p.replace(/^\r?\n/, ''), sortie, profondeur + 1); });
        return;
    }
    if (type === 'message/rfc822') { partiesMail(corps, sortie, profondeur + 1); return; }
    const nom = parametre(h['content-disposition'], 'filename') || parametre(ct, 'name');
    const ext = (/\.([a-z0-9]{2,5})$/i.exec(nom) || [])[1] || '';
    const estPdf = type === 'application/pdf' || /^pdf$/i.test(ext), estImage = /^image\/(jpeg|png|gif|webp|heic|heif)$/.test(type) || /^(jpe?g|png|gif|webp|heic)$/i.test(ext);
    if (!estPdf && !estImage) return;
    const enc = String(h['content-transfer-encoding'] || '').toLowerCase();
    let donnees;
    try {
        donnees = enc === 'base64' ? atob(corps.replace(/[^A-Za-z0-9+/=]/g, ''))
            : enc === 'quoted-printable' ? corps.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (x, k) => String.fromCharCode(parseInt(k, 16))) : corps;
    } catch (e) { return; }
    if (!donnees.length || donnees.length > TAILLE_MAX_PJ) return;
    sortie.push({ nom: nom || (estPdf ? 'justificatif.pdf' : 'photo.jpg'), type: estPdf ? 'application/pdf' : (/^image\//.test(type) ? type : 'image/' + (ext.toLowerCase() === 'jpg' ? 'jpeg' : ext.toLowerCase())), b64: btoa(donnees) });
}
function adresseMail(v) { const m = /<([^>]+)>/.exec(v || '') || /([^\s<>"]+@[^\s<>"]+)/.exec(v || ''); return m ? normaliser(m[1]) : ''; }
// Chiffrement pour les appareils d'un compte : même enveloppe que l'appli (AES-GCM, clé remise à chaque appareil par ECDH P-256 + HKDF).
function b64(buf) { return btoa(binaire(new Uint8Array(buf))); }
async function chiffrerPourAppareils(appareils, texte) {
    const iv = hasard(12), k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(texte)), brute = await crypto.subtle.exportKey('raw', k);
    const enveloppes = [];
    for (const a of appareils) {
        try {
            const pub = await crypto.subtle.importKey('jwk', a.cle, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
            const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, eph.privateKey, 256);
            const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
            const ke = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('TRIGONE boite v1') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
            const iv2 = hasard(12), cle = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv2 }, ke, brute), j = await crypto.subtle.exportKey('jwk', eph.publicKey);
            enveloppes.push({ appareil: a.id, epk: { kty: 'EC', crv: 'P-256', x: j.x, y: j.y }, iv: b64(iv2), ct: b64(cle) });
        } catch (e) {}
    }
    return { enveloppes, donnees: { iv: b64(iv), ct: b64(ct) } };
}
// Réception d'un mail (Email Routing). Renvoie le motif du refus, ou '' si déposé.
async function recevoirMail(message, env, ctx) {
    const kv = env.TRIGONE_KV;
    const a = normaliser(message.to), local = a.split('@')[0], domaine = a.split('@')[1] || '';
    if (domaine !== DOMAINE_RECEPTION) return 'Adresse inconnue.';
    const dest = await kv.get('adresse:' + local), compte = dest ? await kv.get('compte:' + dest, 'json') : null;
    if (!compte || !(compte.appareils || []).length) return compte && compte.bloque ? 'Ce compte TRIGONE est bloqué pour l\'instant : renvoyez le justificatif plus tard.' : 'Adresse TRIGONE inconnue.';
    if (compte.attente) return 'Ce compte TRIGONE n\'est pas encore validé : renvoyez le justificatif une fois le compte validé.';
    if ((message.rawSize || 0) > TAILLE_MAX_MAIL) return 'Mail trop volumineux pour TRIGONE (12 Mo au plus).';
    const bin = binaire(new Uint8Array(await new Response(message.raw).arrayBuffer()));
    const h = entetes(bin.slice(0, Math.max(0, bin.search(/\r?\n\r?\n/))));
    const pj = []; partiesMail(bin, pj, 0);
    if (!pj.length) return 'Aucune pièce jointe PDF ou photo : TRIGONE ne garde que les justificatifs (factures, billets).';
    const deEntete = adresseMail(h.from), deEnveloppe = normaliser(message.from), domaineDe = deEntete.split('@')[1] || '';
    const memeDomaine = domaineDe && (deEnveloppe.split('@')[1] || '').endsWith(domaineDe.split('.').slice(-2).join('.'));
    const connu = (deEntete === dest && memeDomaine) || (memeDomaine && EXPEDITEURS_CONNUS.some(d => domaineDe === d || domaineDe.endsWith('.' + d)));
    const contenu = JSON.stringify({ app: 'TRIGONE-JUSTIF', version: 1, de: deEntete || deEnveloppe, nomDe: decoderMot((h.from || '').replace(/<[^>]*>/, '').replace(/"/g, '').trim()).slice(0, 80),
        sujet: decoderMot(h.subject || '').slice(0, 200), recuLe: new Date().toISOString(), verifie: !!connu, transfere: deEntete === dest, fichiers: pj });
    const c = await chiffrerPourAppareils(compte.appareils.filter(x => x.cle), JSON.stringify({ nom: 'justificatifs.json', contenu }));
    if (!c.enveloppes.length) return 'Adresse TRIGONE indisponible.';
    const id = Date.now().toString(36) + b64url(hasard(6)), le = Date.now(), db = await baseBoite(env);
    await kv.put('msg:' + id, JSON.stringify(c.donnees), { expirationTtl: DUREE_MESSAGE });
    await db.batch(c.enveloppes.map(e => db.prepare('INSERT INTO boite (id, dest, appareil, de, type, le, enveloppe) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, dest, e.appareil, deEntete || deEnveloppe, 'JUSTIF', le, JSON.stringify({ epk: e.epk, iv: e.iv, ct: e.ct }))));
    const p = origineConnue(env).then(o => notifier(env, dest, compte, c.enveloppes.map(e => e.appareil), 'JUSTIF', domaineDe || deEnveloppe, o, pj.length)).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
    return '';
}

export default {
    async email(message, env, ctx) {
        env = avecKvFrais(env);
        let motif = '';
        try { motif = await recevoirMail(message, env, ctx); } catch (e) { motif = 'TRIGONE n\'a pas pu lire ce mail.'; }
        if (motif) message.setReject(motif);
    },
    async fetch(requete, env, ctx) {
        env = avecKvFrais(env);
        const url = new URL(requete.url);
        // Publication récente : contrôlée au plus toutes les 5 minutes, sans retarder la réponse.
        if (Date.now() - dernierControleMaj > 5 * 60 * 1000 && ctx && ctx.waitUntil) ctx.waitUntil(notifierMiseAJour(env, url.origin).catch(() => {}));
        if (url.pathname.startsWith('/api/')) {
            try { return await api(requete, env, url, ctx); }
            catch (e) { if (env.MODE_TEST) console.log('ERREUR500', e && e.stack); return erreur(500, 'Erreur du serveur.'); }
        }
        return env.ASSETS.fetch(requete);
    },
    // Déclencheur planifié (wrangler.jsonc › triggers.crons, toutes les 5 minutes) : publication, relances (à l'heure).
    async scheduled(evenement, env, ctx) {
        if (!env.TRIGONE_DB) return;
        env = avecKvFrais(env);
        // Déclencheur toutes les 5 minutes : nouvelle publication (notification sans attendre) ; relances à l'heure pile.
        if (new Date(evenement.scheduledTime || Date.now()).getUTCMinutes() < 5) {
            ctx.waitUntil(origineConnue(env).then(o => relancer(env, o, Date.now(), false)).catch(() => {}));
            ctx.waitUntil(purgerErreurs(env, Date.now()).catch(() => {}));
        }
        ctx.waitUntil(notifierMiseAJour(env).catch(() => {}));
        ctx.waitUntil(origineConnue(env).then(o => envoyerRappels(env, o, Date.now())).catch(() => {}));
    }
};
