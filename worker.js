// TRIGONE — serveur Cloudflare : sert l'appli (fichiers statiques) et la boîte aux lettres /api/…
//
// Boîte aux lettres : chaque personne a un compte TRIGONE à son adresse mail professionnelle, vérifiée par un code
// envoyé par mail (Brevo). Chaque appareil du compte a sa propre clé de chiffrement : la clé privée ne quitte
// jamais l'appareil, le serveur ne garde que la clé publique. Les demandes sont chiffrées dans l'appli de
// l'expéditeur pour les appareils du destinataire : ce serveur ne voit que des données illisibles, et les
// supprime à la réception (au plus tard après 30 jours).
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
//   BREVO_CLE (secret)          clé API Brevo — ou BREVO_SMTP_UTILISATEUR (texte, « …@smtp-brevo.com ») + BREVO_SMTP_CLE (secret) : SMTP Brevo
//                               — ou MAILJET_CLE + MAILJET_SECRET (secrets) : clés API Mailjet
//   EXPEDITEUR_MAIL             adresse d'envoi validée dans Brevo
//   DOMAINES_AUTORISES          ex. « interieur.gouv.fr » (sous-domaines compris), séparés par des virgules
//   MODE_TEST = "1"             tests locaux uniquement : le code est renvoyé au lieu d'être envoyé par mail
//   ADMIN_MAILS                 adresse(s) de l'administrateur, séparées par des virgules : seule(s) à voir la page
//                               « Erreurs de l'appli » (Paramètres › Aide)

import { connect } from 'cloudflare:sockets';

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
async function baseBoite(env) {
    if (!TABLES_PRETES) {
        await env.TRIGONE_DB.batch([
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
            env.TRIGONE_DB.prepare('CREATE INDEX IF NOT EXISTS registre_maj ON registre (unite, maj)')
        ]);
        TABLES_PRETES = true;
    }
    return env.TRIGONE_DB;
}

// ---------- Registre OMR partagé ----------
const UNITE_REGISTRE = 'principale';
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
    if (a.omr) r.omr = a.omr;
    return r;
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
        REPONSE: ['Réponse à votre question', 'Le missionnaire vous a répondu : ouvrez votre Boîte de réception.', 'boite']
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
    const lignes = (await db.prepare('SELECT * FROM suivi WHERE genre = ? AND detenteur = ? AND ref IN (' + refs.map(() => '?').join(',') + ')')
        .bind('mer', moi.mail, ...refs).all()).results || [];
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
        return notifierCompte(env, m, { titre: 'Rappel TRIGONE', texte: txt.charAt(0).toUpperCase() + txt.slice(1) + ' depuis plus de 24 h.', type: 'RELANCE',
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
    const mail = normaliser(decodeURIComponent(m[1]));
    const compte = await env.TRIGONE_KV.get('compte:' + mail, 'json');
    if (!compte) return null;
    const h = await empreinte(m[3]);
    const app = compte.appareils.find(a => a.id === m[2] && a.jeton === h);
    return app ? { mail, appareil: app, compte } : null;
}

// Envoi SMTP (Brevo : smtp-relay.brevo.com, port 465 chiffré) — quand la clé API n'est pas disponible.
async function envoyerSmtp(hote, port, utilisateur, motDePasse, de, a, sujet, texte) {
    const socket = connect({ hostname: hote, port: port }, { secureTransport: 'on', allowHalfOpen: false });
    const ecrivain = socket.writable.getWriter(), lecteur = socket.readable.getReader();
    const enc = new TextEncoder(), dec = new TextDecoder();
    let tampon = '';
    async function reponse() {
        // Réponse SMTP complète : dernière ligne « 250 texte » (sans tiret après le code).
        for (;;) {
            const lignes = tampon.split('\r\n');
            for (let i = 0; i < lignes.length - 1; i++) {
                if (/^\d{3} /.test(lignes[i])) { tampon = lignes.slice(i + 1).join('\r\n'); return lignes[i]; }
            }
            const { value, done } = await lecteur.read();
            if (done) throw new Error('SMTP : connexion fermée');
            tampon += dec.decode(value, { stream: true });
        }
    }
    async function commande(ligne, attendu) {
        if (ligne !== null) await ecrivain.write(enc.encode(ligne + '\r\n'));
        const r = await reponse();
        if (!r.startsWith(attendu)) throw new Error('SMTP : ' + r);
        return r;
    }
    const b64 = t => btoa(String.fromCharCode.apply(null, enc.encode(t)));
    try {
        await commande(null, '220');
        await commande('EHLO trigone', '250');
        await commande('AUTH LOGIN', '334');
        await commande(b64(utilisateur), '334');
        await commande(b64(motDePasse), '235');
        await commande('MAIL FROM:<' + de + '>', '250');
        await commande('RCPT TO:<' + a + '>', '250');
        await commande('DATA', '354');
        const message = [
            'From: TRIGONE <' + de + '>', 'To: <' + a + '>', 'Subject: =?UTF-8?B?' + b64(sujet) + '?=',
            'Date: ' + new Date().toUTCString(), 'Message-ID: <' + crypto.randomUUID() + '@trigone>',
            'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
            b64(texte).replace(/.{1,76}/g, '$&\r\n'), '.'
        ].join('\r\n');
        await commande(message, '250');
        await ecrivain.write(enc.encode('QUIT\r\n')).catch(() => {});
        return true;
    } finally { try { await socket.close(); } catch (e) {} }
}

// Envoi du code par mail : Brevo (BREVO_CLE) ou, à défaut, Mailjet (MAILJET_CLE + MAILJET_SECRET).
// Rend true, ou le motif de l'échec (affiché à l'utilisateur et écrit dans les journaux Cloudflare) : clé refusée,
// expéditeur non validé, compte Brevo suspendu ou quota atteint… Jamais la clé elle-même.
async function envoyerCode(env, mail, code) {
    const r = await envoyerCodeBrut(env, mail, code).catch(e => 'erreur : ' + (e && e.message || e));
    if (r !== true) console.log('Envoi du code impossible', mail.replace(/^(.{0,3})[^@]*@/, '$1…@'), r);
    return r;
}
async function motifRefus(service, r) {
    let t = ''; try { t = await r.text(); } catch (e) {}
    let m = t; try { const j = JSON.parse(t); m = j.message || j.code || (j.Messages && JSON.stringify(j.Messages[0].Errors)) || t; } catch (e) {}
    return service + ' ' + r.status + (m ? ' : ' + String(m).slice(0, 160) : '');
}
async function envoyerCodeBrut(env, mail, code) {
    if (env.MODE_TEST === '1') return true;
    if (!env.EXPEDITEUR_MAIL) return 'expéditeur non configuré (EXPEDITEUR_MAIL)';
    const sujet = 'Votre code TRIGONE : ' + code;
    const texte = 'Bonjour,\n\nVotre code pour activer votre compte TRIGONE : ' + code + '\n\nIl est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.\n\nTRIGONE';
    const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a">Bonjour,<br><br>Votre code pour activer votre compte TRIGONE :<br>' +
        '<div style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:18px 0">' + code + '</div>' +
        'Il est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.<br><br>TRIGONE</div>';
    if (env.BREVO_CLE) {
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': env.BREVO_CLE, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ sender: { email: env.EXPEDITEUR_MAIL, name: 'TRIGONE' }, to: [{ email: mail }], subject: sujet, textContent: texte, htmlContent: html })
        });
        return r.ok ? true : motifRefus('Brevo', r);
    }
    if (env.BREVO_SMTP_UTILISATEUR && env.BREVO_SMTP_CLE) {
        return envoyerSmtp('smtp-relay.brevo.com', 465, env.BREVO_SMTP_UTILISATEUR, env.BREVO_SMTP_CLE, env.EXPEDITEUR_MAIL, mail, sujet, texte).then(() => true, e => 'Brevo ' + (e && e.message || e));
    }
    if (env.MAILJET_CLE && env.MAILJET_SECRET) {
        const r = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: { Authorization: 'Basic ' + btoa(env.MAILJET_CLE + ':' + env.MAILJET_SECRET), 'Content-Type': 'application/json' },
            body: JSON.stringify({ Messages: [{ From: { Email: env.EXPEDITEUR_MAIL, Name: 'TRIGONE' }, To: [{ Email: mail }], Subject: sujet, TextPart: texte, HTMLPart: html }] })
        });
        return r.ok ? true : motifRefus('Mailjet', r);
    }
    return 'aucun service d\'envoi configuré (BREVO_CLE ou BREVO_SMTP_*)';
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

async function api(requete, env, url, ctx) {
    const kv = env.TRIGONE_KV;
    if (!kv || !env.TRIGONE_DB) return erreur(503, 'Boîte aux lettres non configurée.');
    await remiseAZero(env);
    const chemin = url.pathname.replace(/^\/api\//, '');
    const methode = requete.method;

    if (chemin === 'etat') return json({ ok: true, version: 1 });
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
        if (garde) return json({ ok: true, km: garde.km });
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
            return json({ ok: true, km: res.km });
        } catch (e) {
            // Détail (services joints ou non) lisible en ouvrant l'adresse /api/distance?de=…&a=… dans un navigateur.
            return json({ ok: false, erreur: 'Calcul de distance indisponible pour le moment.', etape: String(e.message || e), detail: traces }, 502);
        }
    }
    // Clé publique VAPID : l'appareil s'abonne aux notifications avec elle.
    if (chemin === 'push/cle' && methode === 'GET') return json({ ok: true, cle: (await clesVapid(env)).pub });

    // 1. Inscription : code à 6 chiffres envoyé à l'adresse professionnelle.
    if (chemin === 'inscription/code' && methode === 'POST') {
        const { mail: brut } = await requete.json().catch(() => ({}));
        const mail = normaliser(brut);
        if (!mailValide(mail)) return erreur(400, 'Adresse mail invalide.');
        if (!domaineAutorise(env, mail)) return erreur(403, 'Seules les adresses professionnelles sont acceptées (' + env.DOMAINES_AUTORISES + ').');
        const n = +(await kv.get('limite:' + mail)) || 0;
        if (n >= 5) return erreur(429, 'Trop de codes demandés. Réessayez dans une heure.');
        await kv.put('limite:' + mail, String(n + 1), { expirationTtl: 3600 });
        const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
        await kv.put('code:' + mail, JSON.stringify({ empreinte: await empreinte(mail + ':' + code), essais: 0 }), { expirationTtl: 900 });
        const envoi = await envoyerCode(env, mail, code);
        if (envoi !== true) return erreur(502, 'Le mail n\'a pas pu être envoyé (' + envoi + ').');
        return json(env.MODE_TEST === '1' ? { ok: true, codeTest: code } : { ok: true });
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
        const jeton = b64url(hasard(32));
        const app = { id: b64url(hasard(9)), cle: { kty: 'EC', crv: 'P-256', x: cle.x, y: cle.y }, jeton: await empreinte(jeton),
            nom: String(corps.nom || 'Appareil').slice(0, 60), cree: Date.now() };
        compte.appareils = compte.appareils.concat(app).slice(-10);
        await kv.put('compte:' + l.mail, JSON.stringify(compte));
        return json({ ok: true, mail: l.mail, appareil: app.id, jeton, paquet: l.paquet });
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
        if (!c || !(await kv.get('compte:' + c.mail))) return json({ ok: true, valide: false });
        const pub = { grade: c.grade || '', nom: c.nom || '', prenom: c.prenom || '', unite: c.unite || '', cie: c.cie || '', depuis: c.depuis || 0 };
        return json({ ok: true, valide: true, carte: lecteur ? Object.assign(pub, { mail: c.mail, nid: c.nid || '', moi: c.mail === lecteur.mail }) : pub });
    }

    const moi = await appareilConnecte(env, requete);
    if (!moi) return erreur(401, 'Compte TRIGONE non reconnu sur cet appareil.');
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
        const db = await tableReglage(env);
        await db.prepare("INSERT INTO reglage (cle, valeur) VALUES ('omr-prochain', '1') ON CONFLICT (cle) DO NOTHING").run();
        const r = await db.prepare("UPDATE reglage SET valeur = CAST(CAST(valeur AS INTEGER) + 1 AS TEXT) WHERE cle = 'omr-prochain' RETURNING valeur").first();
        const n = parseInt(r && r.valeur, 10) - 1;
        const p = await db.prepare("SELECT valeur FROM reglage WHERE cle = 'omr-prefixe'").first();
        return json({ ok: true, numero: ((p && p.valeur) || '') + String(n).padStart(4, '0'), le: new Date().toISOString() });
    }
    if (chemin === 'omr/serie' && (methode === 'GET' || methode === 'POST')) {
        if (!(moi.compte.roles || {}).chorus) return erreur(403, 'Réservé à l\'assistant Chorus DT.');
        const db = await tableReglage(env);
        if (methode === 'POST') {
            const c = await requete.json().catch(() => ({}));
            const prefixe = String(c.prefixe || '').replace(/[^0-9A-Za-z\-\/]/g, '').slice(0, 12), prochain = parseInt(c.prochain, 10);
            if (!(prochain >= 1 && prochain < 1000000)) return erreur(400, 'Premier numéro invalide.');
            await db.batch([
                db.prepare("INSERT INTO reglage (cle, valeur) VALUES ('omr-prefixe', ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur").bind(prefixe),
                db.prepare("INSERT INTO reglage (cle, valeur) VALUES ('omr-prochain', ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur").bind(String(prochain))
            ]);
        }
        const p = await db.prepare("SELECT valeur FROM reglage WHERE cle = 'omr-prefixe'").first();
        const n = await db.prepare("SELECT valeur FROM reglage WHERE cle = 'omr-prochain'").first();
        return json({ ok: true, prefixe: (p && p.valeur) || '', prochain: parseInt(n && n.valeur, 10) || 1 });
    }
    // Registre OMR partagé : tous les assistants Chorus DT de l'unité voient la même liste, quel que soit celui qui a
    // reçu la demande ou le compte-rendu. Envoi des lignes nouvelles ou modifiées et des suppressions, réponse : tout ce
    // qui a changé depuis « depuis » (maj). Aujourd'hui une seule unité ; chaque régiment aura la sienne.
    if (chemin === 'registre' && methode === 'POST') {
        if (!(moi.compte.roles || {}).chorus) return erreur(403, 'Réservé à l\'assistant Chorus DT.');
        const c = await requete.json().catch(() => ({}));
        const db = await baseBoite(env), u = UNITE_REGISTRE, le = Date.now();
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
    // Page « Erreurs de l'appli » : réservée à l'administrateur (ADMIN_MAILS).
    if (chemin === 'admin' && methode === 'GET') return json({ ok: true, admin: estAdmin(env, moi.mail) });
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
        frais.roles = frais.roles || {};
        ajouter.forEach(r => { frais.roles[r] = true; });
        retirer.forEach(r => { delete frais.roles[r]; });
        await kv.put('compte:' + moi.mail, JSON.stringify(frais));
        return json({ ok: true, roles: frais.roles });
    }
    if (chemin === 'role' && methode === 'POST') {
        const { role, actif } = await requete.json().catch(() => ({}));
        if (ROLES.indexOf(role) < 0) return erreur(400, 'Rôle inconnu.');
        moi.compte.roles = moi.compte.roles || {};
        if (actif) moi.compte.roles[role] = true; else delete moi.compte.roles[role];
        await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
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
        const mail = normaliser(url.searchParams.get('mail'));
        const compte = await kv.get('compte:' + mail, 'json');
        if (!compte || !compte.appareils.length) return json({ ok: true, compte: false });
        // Absence déclarée (valideur, assistant Chorus DT) : l'appli de l'expéditeur envoie à son remplaçant.
        const rp = compte.remplacant && compte.remplacant.jusqu > Date.now() ? compte.remplacant : null;
        return json({ ok: true, compte: true, mail, roles: compte.roles || {}, remplacant: rp, appareils: compte.appareils.map(a => ({ id: a.id, cle: a.cle })) });
    }

    // Dépôt d'un envoi chiffré : le contenu une fois, une enveloppe (clé du contenu chiffrée) par appareil destinataire.
    if (chemin === 'envoyer' && methode === 'POST') {
        const texte = await requete.text();
        if (texte.length > TAILLE_MAX) return erreur(413, 'Envoi trop volumineux (25 Mo au plus).');
        let corps; try { corps = JSON.parse(texte); } catch (e) { return erreur(400, 'Envoi illisible.'); }
        const dest = normaliser(corps.destinataire);
        const compte = await kv.get('compte:' + dest, 'json');
        if (!compte) return erreur(404, 'Ce destinataire n\'a pas de compte TRIGONE.');
        // Chaque boîte ne reçoit que ce qui lui revient.
        const type = String(corps.type || '');
        if (!(type in ROLE_REQUIS)) return erreur(400, 'Type d\'envoi inconnu.');
        const requis = ROLE_REQUIS[type];
        if (requis && !(compte.roles || {})[requis]) return erreur(403, dest + ' ' + MESSAGE_ROLE[requis]);
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
    if (chemin === 'boite' && methode === 'GET') {
        const db = await baseBoite(env);
        const r = await db.prepare('SELECT id, de, type, le FROM boite WHERE dest = ? AND appareil = ? AND le > ? ORDER BY le')
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
            const cr = (await db.prepare('SELECT * FROM suivi WHERE envoi = ? AND genre = ? AND etape = ? AND detenteur = ?').bind(m[1], 'cr', 'chorus', moi.mail).all()).results || [];
            if (cr.length) {
                const p = avancerSuivi(env, cr, 'recu', { auteur: moi.mail, trace: { e: 'recu', le: Date.now(), qui: '', par: moi.mail } }, url.origin, 'recu').catch(() => {});
                if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
            }
            return json({ ok: true });
        }
    }

    // Absence : remplaçant (compte TRIGONE existant) jusqu'à une date (90 jours au plus) ; mail vide = fin de l'absence.
    if (chemin === 'remplacant' && methode === 'POST') {
        const corps = await requete.json().catch(() => ({}));
        const rmail = normaliser(corps.mail);
        if (!rmail) { delete moi.compte.remplacant; await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte)); return json({ ok: true, remplacant: null }); }
        if (!mailValide(rmail) || rmail === moi.mail) return erreur(400, 'Adresse du remplaçant invalide.');
        const jusqu = +corps.jusqu || 0;
        if (jusqu <= Date.now() || jusqu > Date.now() + 90 * JOUR * 1000) return erreur(400, 'Date de fin d\'absence invalide (dans les 90 jours).');
        const cr = await kv.get('compte:' + rmail, 'json');
        if (!cr || !cr.appareils.length) return erreur(404, rmail + ' n\'a pas encore de compte TRIGONE : demandez-lui de l\'activer.');
        const manque = Object.keys(moi.compte.roles || {}).filter(r => !(cr.roles || {})[r]);
        moi.compte.remplacant = { mail: rmail, jusqu };
        await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
        return json({ ok: true, remplacant: moi.compte.remplacant, rolesManquants: manque });
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
        const lignes = [];
        if (refs.length) lignes.push(...((await db.prepare('SELECT * FROM suivi WHERE genre = ? AND detenteur = ? AND etape = ? AND ref IN (' + refs.map(() => '?').join(',') + ')')
            .bind('mer', moi.mail, 'chorus', ...refs).all()).results || []));
        if (envois.length) lignes.push(...((await db.prepare('SELECT * FROM suivi WHERE genre = ? AND detenteur = ? AND etape IN (\'chorus\', \'recu\') AND envoi IN (' + envois.map(() => '?').join(',') + ')')
            .bind('cr', moi.mail, ...envois).all()).results || []));
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

export default {
    async fetch(requete, env, ctx) {
        const url = new URL(requete.url);
        // Publication récente : contrôlée au plus toutes les 5 minutes, sans retarder la réponse.
        if (Date.now() - dernierControleMaj > 5 * 60 * 1000 && ctx && ctx.waitUntil) ctx.waitUntil(notifierMiseAJour(env, url.origin).catch(() => {}));
        if (url.pathname.startsWith('/api/')) {
            try { return await api(requete, env, url, ctx); }
            catch (e) { return erreur(500, 'Erreur du serveur.'); }
        }
        return env.ASSETS.fetch(requete);
    },
    // Déclencheur planifié (wrangler.jsonc › triggers.crons, toutes les 5 minutes) : publication, relances (à l'heure).
    async scheduled(evenement, env, ctx) {
        if (!env.TRIGONE_DB) return;
        // Déclencheur toutes les 5 minutes : nouvelle publication (notification sans attendre) ; relances à l'heure pile.
        if (new Date(evenement.scheduledTime || Date.now()).getUTCMinutes() < 5) {
            ctx.waitUntil(origineConnue(env).then(o => relancer(env, o, Date.now(), false)).catch(() => {}));
            ctx.waitUntil(purgerErreurs(env, Date.now()).catch(() => {}));
        }
        ctx.waitUntil(notifierMiseAJour(env).catch(() => {}));
        ctx.waitUntil(origineConnue(env).then(o => envoyerRappels(env, o, Date.now())).catch(() => {}));
    }
};
