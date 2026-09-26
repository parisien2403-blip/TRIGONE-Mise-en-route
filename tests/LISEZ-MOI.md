# Tests automatiques de TRIGONE

Ils rejouent TRIGONE dans un vrai navigateur (Chromium, via Playwright) et vérifient que rien n'est cassé
avant une publication.

| Test | Ce qui est vérifié |
|---|---|
| `parcours` | Demande avec NDS / DAF → Documents → envoi → 1er valideur (dont « Effacer ») → 2e valideur → assistant Chorus DT (fichier conforme, fichier falsifié refusé, PDF final) |
| `code-acces` | Code demandé à l'ouverture sur PC et téléphone, dans les deux applis ; ancien code de Compte-rendu accepté |
| `sauvegarde` | Sauvegarde complète puis restauration sur un appareil vierge (pièces jointes et code compris) |
| `hors-ligne` | Sans réseau : ouverture des deux applis, police, et tout le parcours ci-dessus |

## Lancer

```
cd tests
npm install            # une seule fois (Playwright)
npx playwright install chromium   # une seule fois
TRIGONE_CODE_VAL1=… TRIGONE_CODE_VAL2=… npm test
```

- Un seul test : `node lancer.js sauvegarde` (ou `parcours`, `code-acces`, `hors-ligne`).
- Les **codes d'accès valideurs** ne sont jamais écrits dans le projet : ils se donnent au moment du lancement
  (`TRIGONE_CODE_VAL1`, `TRIGONE_CODE_VAL2`). Sans eux, la partie valideurs est sautée.
- `CHROMIUM_PATH` permet d'utiliser un autre Chromium.
- Fichiers produits (téléchargements, sauvegardes) : dossier `tests/sortie/` (non publié).

Résultat : une ligne ✔ / ✘ par vérification, puis « ✔ Tout est bon » ou le nombre d'échecs.

## Boîte aux lettres (test `boite`)

Il faut le serveur de TRIGONE en local, en mode test (le code d'inscription est renvoyé au lieu d'être envoyé par mail) :

```
npx wrangler dev --port 8787 --var MODE_TEST:1      # à la racine du projet
TRIGONE_URL_BOITE=http://localhost:8787/ TRIGONE_CODE_VAL1=… TRIGONE_CODE_VAL2=… node lancer.js boite
```
