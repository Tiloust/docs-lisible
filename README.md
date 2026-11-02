# Docs Lisible

Rend un Google Doc **lisible** (titres en gros/gras/rouge ou noir, vraies puces, sources en petit, espacement) **sans supprimer un seul mot**. Pensé pour les textes écrits vite ou copiés-collés depuis une IA.

Deux versions, un seul moteur (`core/format-core.js`) :

- **A. Complément Google Docs** (`apps-script/`) : menu « Docs Lisible » dans le document.
- **B. Extension Chrome** (`extension/`) : bouton dans la barre du navigateur.

## Ce que ça fait

- `# Titre`, `I.`, `A.`, `Chapitre 2`, `INTRODUCTION`, `**Titre**` seul sur une ligne : devient Titre 1/2/3 (gras, grande taille, rouge ou noir au choix).
- `- item`, `* item`, `• item`, `1. item` : vraies listes Google Docs, avec imbrication.
- `Source : ...`, `[1] ...`, lignes d'URL : petit, gris, italique.
- `[web:1]`, `[2]` dans le texte : petit exposant gris.
- `**gras**`, `*italique*` : vrai gras / italique. Les symboles sont retirés (option).
- `Mot-clé : explication` dans une puce : le mot-clé passe en gras.
- Interligne 1,15 et espace entre paragraphes.

**Garantie** : seuls les symboles de mise en forme (`#`, `-`, `1.`, `**`, `*`) peuvent disparaître, jamais les mots. Un test automatique le vérifie (`npm test` ou `node --test core/test/`). Si tu ne veux même pas retirer les symboles, décoche « Retirer les symboles Markdown ».

Relancer l'outil deux fois ne casse rien (titres et listes déjà formatés sont laissés tels quels). En cas de souci : Ctrl+Z ou Fichier > Historique des versions.

## Performance

Le document est lu une fois, toute la mise en forme est calculée en mémoire, puis envoyée par lots de 400 requêtes via l'API Google Docs. Un doc de 50 pages prend quelques secondes. Le moteur échoue proprement si quelqu'un modifie le document pendant l'opération (contrôle de révision).

## Installation A : complément Google Docs

1. Ouvre un Google Doc > Extensions > Apps Script.
2. Copie les fichiers de `apps-script/` (`Code.gs`, `Core.gs`, `Sidebar.html`) et le contenu de `appsscript.json` (Paramètres du projet > cocher « Afficher le fichier manifeste appsscript.json »).
3. Enregistre, recharge le doc : un menu **Docs Lisible** apparaît. Autorise l'accès la première fois.

Ou avec [clasp](https://github.com/google/clasp) : `cd apps-script && clasp create --type docs && clasp push`.

> `Core.gs` et `extension/core.js` sont générés automatiquement depuis `core/format-core.js` par la CI (ou `node scripts/sync-core.js`).

Pour que « tout le monde » l'utilise sans copier le code, il faut publier le complément sur Google Workspace Marketplace (validation Google obligatoire car il demande le droit de modifier les documents).

## Installation B : extension Chrome

1. Google Cloud Console > nouveau projet > active **Google Docs API**.
2. Écran de consentement OAuth : type Externe, ajoute ton adresse comme utilisateur test.
3. Identifiants > Créer > ID client OAuth > type **Extension Chrome**, avec l'ID de ton extension (chrome://extensions, mode développeur, « Charger l'extension non empaquetée » sur le dossier `extension/`).
4. Remplace `VOTRE_CLIENT_ID` dans `extension/manifest.json`.
5. Ouvre un Google Doc, clique sur l'icône, **Rendre lisible**.

Pour la distribuer : Chrome Web Store (compte développeur) et vérification OAuth de Google.

## Limites connues

- Les listes numérotées séparées par des lignes vides recommencent à 1.
- Les paragraphes déjà en Titre ou déjà en liste ne sont pas retouchés.
- L'heuristique de détection des titres est volontairement prudente : une phrase normale n'est jamais transformée en titre. Dis-le dans une issue si un cas est raté.
- Ce code est testé sur des documents simulés ; fais un premier essai sur une copie de ton document.

## Licence

MIT
