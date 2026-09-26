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
//   boite:<mail>:<appareil>:<id>  { cle enveloppée } + métadonnées (de, type, le)   — 30 jours
//
// Réglages (Cloudflare › Workers › trigone-mise-en-route › Paramètres › Variables et secrets) :
//   BREVO_CLE (secret)          clé API Brevo — ou BREVO_SMTP_UTILISATEUR (texte, « …@smtp-brevo.com ») + BREVO_SMTP_CLE (secret) : SMTP Brevo
//                               — ou MAILJET_CLE + MAILJET_SECRET (secrets) : clés API Mailjet
//   EXPEDITEUR_MAIL             adresse d'envoi validée dans Brevo
//   DOMAINES_AUTORISES          ex. « interieur.gouv.fr » (sous-domaines compris), séparés par des virgules
//   MODE_TEST = "1"             tests locaux uniquement : le code est renvoyé au lieu d'être envoyé par mail

import { connect } from 'cloudflare:sockets';

const JOUR = 86400;
const DUREE_MESSAGE = 30 * JOUR;
const TAILLE_MAX = 24 * 1024 * 1024;   // limite d'une valeur Workers KV : 25 Mo

function json(corps, statut) {
    return new Response(JSON.stringify(corps), { status: statut || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function erreur(statut, message) { return json({ ok: false, erreur: message }, statut); }
function b64url(octets) { return btoa(String.fromCharCode.apply(null, octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function hasard(n) { return crypto.getRandomValues(new Uint8Array(n)); }
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
async function envoyerCode(env, mail, code) {
    if (env.MODE_TEST === '1') return true;
    if (!env.EXPEDITEUR_MAIL) return false;
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
        return r.ok;
    }
    if (env.BREVO_SMTP_UTILISATEUR && env.BREVO_SMTP_CLE) {
        return envoyerSmtp('smtp-relay.brevo.com', 465, env.BREVO_SMTP_UTILISATEUR, env.BREVO_SMTP_CLE, env.EXPEDITEUR_MAIL, mail, sujet, texte).catch(() => false);
    }
    if (env.MAILJET_CLE && env.MAILJET_SECRET) {
        const r = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: { Authorization: 'Basic ' + btoa(env.MAILJET_CLE + ':' + env.MAILJET_SECRET), 'Content-Type': 'application/json' },
            body: JSON.stringify({ Messages: [{ From: { Email: env.EXPEDITEUR_MAIL, Name: 'TRIGONE' }, To: [{ Email: mail }], Subject: sujet, TextPart: texte, HTMLPart: html }] })
        });
        return r.ok;
    }
    return false;
}

async function api(requete, env, url) {
    const kv = env.TRIGONE_KV;
    if (!kv) return erreur(503, 'Boîte aux lettres non configurée.');
    const chemin = url.pathname.replace(/^\/api\//, '');
    const methode = requete.method;

    if (chemin === 'etat') return json({ ok: true, version: 1 });

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
        if (!(await envoyerCode(env, mail, code))) return erreur(502, 'Le mail n\'a pas pu être envoyé. Réessayez plus tard.');
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

    const moi = await appareilConnecte(env, requete);
    if (!moi) return erreur(401, 'Compte TRIGONE non reconnu sur cet appareil.');

    // Clés publiques des appareils d'un destinataire (pour chiffrer un envoi).
    if (chemin === 'cles' && methode === 'GET') {
        const mail = normaliser(url.searchParams.get('mail'));
        const compte = await kv.get('compte:' + mail, 'json');
        if (!compte || !compte.appareils.length) return json({ ok: true, compte: false });
        return json({ ok: true, compte: true, mail, appareils: compte.appareils.map(a => ({ id: a.id, cle: a.cle })) });
    }

    // Dépôt d'un envoi chiffré : le contenu une fois, une enveloppe (clé du contenu chiffrée) par appareil destinataire.
    if (chemin === 'envoyer' && methode === 'POST') {
        const texte = await requete.text();
        if (texte.length > TAILLE_MAX) return erreur(413, 'Envoi trop volumineux (25 Mo au plus).');
        let corps; try { corps = JSON.parse(texte); } catch (e) { return erreur(400, 'Envoi illisible.'); }
        const dest = normaliser(corps.destinataire);
        const compte = await kv.get('compte:' + dest, 'json');
        if (!compte) return erreur(404, 'Ce destinataire n\'a pas de compte TRIGONE.');
        const ids = new Set(compte.appareils.map(a => a.id));
        const enveloppes = (corps.enveloppes || []).filter(e => ids.has(e.appareil));
        if (!enveloppes.length || !corps.donnees || !corps.donnees.ct) return erreur(400, 'Envoi incomplet.');
        const id = Date.now().toString(36) + b64url(hasard(6));
        const meta = { de: moi.mail, type: String(corps.type || '').slice(0, 30), le: Date.now() };
        await kv.put('msg:' + id, JSON.stringify(corps.donnees), { expirationTtl: DUREE_MESSAGE });
        await Promise.all(enveloppes.map(e => kv.put('boite:' + dest + ':' + e.appareil + ':' + id,
            JSON.stringify({ epk: e.epk, iv: e.iv, ct: e.ct }), { expirationTtl: DUREE_MESSAGE, metadata: meta })));
        return json({ ok: true, id });
    }

    // Relève : liste des envois en attente pour cet appareil.
    if (chemin === 'boite' && methode === 'GET') {
        const prefixe = 'boite:' + moi.mail + ':' + moi.appareil.id + ':';
        const liste = await kv.list({ prefix: prefixe });
        return json({ ok: true, envois: liste.keys.map(k => Object.assign({ id: k.name.slice(prefixe.length) }, k.metadata || {})) });
    }
    const m = /^boite\/([\w-]+)$/.exec(chemin);
    if (m) {
        const cle = 'boite:' + moi.mail + ':' + moi.appareil.id + ':' + m[1];
        if (methode === 'GET') {
            const env1 = await kv.getWithMetadata(cle, 'json');
            if (!env1.value) return erreur(404, 'Envoi introuvable ou expiré.');
            const donnees = await kv.get('msg:' + m[1], 'json');
            if (!donnees) return erreur(404, 'Envoi expiré.');
            return json(Object.assign({ ok: true, id: m[1], enveloppe: env1.value, donnees }, env1.metadata || {}));
        }
        if (methode === 'DELETE') { await kv.delete(cle); return json({ ok: true }); }
    }

    // Déconnexion de cet appareil (ou suppression du compte s'il n'en reste aucun).
    if (chemin === 'appareil' && methode === 'DELETE') {
        moi.compte.appareils = moi.compte.appareils.filter(a => a.id !== moi.appareil.id);
        if (moi.compte.appareils.length) await kv.put('compte:' + moi.mail, JSON.stringify(moi.compte));
        else await kv.delete('compte:' + moi.mail);
        return json({ ok: true });
    }
    return erreur(404, 'Inconnu.');
}

export default {
    async fetch(requete, env) {
        const url = new URL(requete.url);
        if (url.pathname.startsWith('/api/')) {
            try { return await api(requete, env, url); }
            catch (e) { return erreur(500, 'Erreur du serveur.'); }
        }
        return env.ASSETS.fetch(requete);
    }
};
