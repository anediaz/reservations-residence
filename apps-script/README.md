# Backend Apps Script — Prems V0

Source du script déployé en application web, sous le compte Google de la résidence.

## Mise en place

1. **Google Sheet** : créer un classeur avec trois onglets.
   - `residents` (en-têtes : `resident_id`, `email`, `lot`, `role`, `status`, `created_at`). Ajouter une ligne avec `role = manager` et `status = active` pour chaque gestionnaire.
   - `reservations` (en-têtes : `reservation_id`, `reference`, `resource_id`, `resident_id`, `requester_email`, `requester_lot`, `requester_contact`, `start_at`, `end_at`, `units`, `status`, `amount_units`, `amount_cleaning`, `amount_total`, `hold_expires_at`, `paid_at`, `refund_status`, `cleaning_status`, `calendar_event_id`). `status` ∈ `requested`, `pending_payment`, `confirmed`, `completed`, `refused`, `expired`, `cancelled`.
   - `audit_log` (en-têtes : `at`, `actor`, `action`, `target`, `detail`).
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

Toutes les actions ci-dessous (sauf `authenticate`) exigent un `idToken` Google valide dans le payload, revérifié à chaque appel (pas de session côté serveur).

- `authenticate({ idToken })` → vérifie le jeton Google, vérifie le rôle manager actif, renvoie `{ email, name, role }`.
- `listRequests({ idToken })` → demandes `requested`, avec conflits de dates et adresses inconnues signalés.
- `approveRequest({ idToken, reservationId })` → passe en `pending_payment`, bloque le créneau 48h.
- `refuseRequest({ idToken, reservationId, reason })` → passe en `refused`.
- `confirmPayment({ idToken, reservationId })` → passe en `confirmed`, horodate `paid_at`. Génération du code de porte à câbler plus tard (API serrure).
- `adminCancel({ idToken, reservationId, reason })` → passe en `cancelled`.
- `listReservations({ idToken, filters? })` → liste complète, filtrable par `status`.

Chaque action mutante écrit dans `audit_log`. Les actions restantes du contrat (`blockDates`, `listResidents`, `exportResidentData`, `getConfig`, etc., voir `Implémentation technique.md`) restent à écrire au même endroit, dans `ACTIONS`.
