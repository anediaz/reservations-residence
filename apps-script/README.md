# Backend Apps Script — Prems V0

Source du script déployé en application web, sous le compte Google de la résidence.

## Mise en place

1. **Google Sheet** : créer un classeur avec trois onglets.
   - `residents` (en-têtes : `resident_id`, `email`, `lot`, `role`, `status`, `created_at`). `role` ∈ `resident`, `admin`, `super_admin`. Ajouter une ligne avec `role = admin` (ou `super_admin`) et `status = active` pour chaque gestionnaire. Un compte `super_admin` ne peut jamais être révoqué, supprimé ni rétrogradé, par aucun gestionnaire (y compris lui-même).
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
- `listResidents({ idToken })` → liste des résidents et gestionnaires.
- `upsertResident({ idToken, resident })` → crée (si pas de `resident_id`) ou met à jour un résident. `resident.role` ∈ `resident`, `admin`, `super_admin`.
- `revokeResident({ idToken, residentId })` → passe le résident en `status = inactive` (jamais de suppression).
- `deleteResident({ idToken, residentId })` → supprime définitivement la ligne (à réserver aux comptes créés par erreur).

Chaque action mutante écrit dans `audit_log`. Les actions restantes du contrat (`blockDates`, `exportResidentData`, `getConfig`, etc., voir `Implémentation technique.md`) restent à écrire au même endroit, dans `ACTIONS`.
