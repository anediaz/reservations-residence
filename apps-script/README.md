# Backend Apps Script — Prems V0

Source du script déployé en application web, sous le compte Google de la résidence.

## Mise en place

1. **Google Sheet** : créer un classeur avec un onglet `residents` (en-têtes : `resident_id`, `email`, `lot`, `role`, `status`, `created_at`). Ajouter une ligne avec `role = manager` et `status = active` pour chaque gestionnaire.
2. **Client OAuth Google** (console.cloud.google.com, sous le compte de la résidence) :
   - Créer un projet (ou réutiliser l'existant).
   - "Identifiants" → "Créer des identifiants" → "ID client OAuth" → type "Application Web".
   - Origines JavaScript autorisées : l'URL du site déployé (GitHub Pages).
   - Copier le Client ID généré.
3. **Apps Script** (script.google.com, lié au Sheet ci-dessus, Extensions → Apps Script) :
   - Copier `Code.gs` et `appsscript.json` dans l'éditeur.
   - Project Settings → Script Properties → ajouter `GOOGLE_CLIENT_ID` = le Client ID de l'étape 2.
   - Déployer → Nouveau déploiement → type "Application Web", exécuter en tant que "Moi", accès "Tout le monde".
   - Copier l'URL `/exec` obtenue.
4. **Frontend** : renseigner dans `.env.local` :
   - `VITE_SCRIPT_URL` = URL `/exec` de l'étape 3.
   - `VITE_GOOGLE_CLIENT_ID` = Client ID de l'étape 2.

## Contrat actuel

- `authenticate({ idToken })` → vérifie le jeton Google (signature, expiration, audience), vérifie que l'email correspond à un résident `role=manager` et `status=active` dans le Sheet, renvoie `{ email, name, role }`.

Les autres actions du contrat d'API (`listRequests`, `approveRequest`, etc., voir `Implémentation technique.md`) restent à écrire au même endroit, dans `ACTIONS`.
