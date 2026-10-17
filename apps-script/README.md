# Backend Apps Script — Prems V0

Source du script déployé en application web, sous le compte Google de la résidence.

## Mise en place

1. **Google Sheet** : créer un classeur avec trois onglets.
   - `residents` (en-têtes : `resident_id`, `email`, `lot`, `role`, `status`, `created_at`). `role` ∈ `resident`, `admin`, `super_admin`. Ajouter une ligne avec `role = admin` (ou `super_admin`) et `status = active` pour chaque gestionnaire. Un compte `super_admin` ne peut jamais être révoqué, supprimé ni rétrogradé, par aucun gestionnaire (y compris lui-même).
   - `reservations` (en-têtes : `reservation_id`, `reference`, `resource_id`, `resident_id`, `requester_email`, `requester_lot`, `requester_contact`, `start_at`, `end_at`, `units`, `status`, `amount_units`, `amount_cleaning`, `amount_total`, `hold_expires_at`, `paid_at`, `refund_status`, `cleaning_status`, `calendar_event_id`). `status` ∈ `requested`, `pending_payment`, `confirmed`, `completed`, `refused`, `expired`, `cancelled`, `blocked` (date bloquée par le gestionnaire, pas une réservation résident).
   - `audit_log` (en-têtes : `at`, `actor`, `action`, `target`, `detail`).
   - `resources` (en-têtes : `resource_id`, `name`, `booking_unit`, `check_in_time`, `check_out_time`, `price_per_unit`, `cleaning_fee`, `max_units`, `buffer_minutes`, `lock_id`, `calendar_id`). Une ligne par ressource réservable (chambre(s), outils en V2). `calendar_id` est l'identifiant de l'agenda Google utilisé pour les réservations (pas l'URL de partage — voir le paramètre `cid` décodé en base64 de cette URL).
2. **Client OAuth Google** (console.cloud.google.com, sous le compte de la résidence) :
   - Créer un projet (ou réutiliser l'existant).
   - "Identifiants" → "Créer des identifiants" → "ID client OAuth" → type "Application Web".
   - Origines JavaScript autorisées : l'URL du site déployé (GitHub Pages).
   - Copier le Client ID généré.
3. **Apps Script** (script.google.com, lié au Sheet ci-dessus, Extensions → Apps Script) :
   - Copier `Code.gs` et `appsscript.json` dans l'éditeur.
   - Project Settings → Script Properties → ajouter `GOOGLE_CLIENT_ID` = le Client ID de l'étape 2.
   - Ajouter aussi `APP_URL` = URL racine déployée du frontend, sous-chemin inclus (ex. `https://xxx.github.io/reservations-residence`). Utilisée pour le lien "Voir la réservation dans Prems" dans les mails gestionnaire ; absente = pas de lien, pas bloquant.
   - Déployer → Nouveau déploiement → type "Application Web", exécuter en tant que "Moi", accès "Tout le monde".
   - Copier l'URL `/exec` obtenue.
4. **Frontend** : renseigner dans `.env.local` :
   - `VITE_SCRIPT_URL` = URL `/exec` de l'étape 3.
   - `VITE_GOOGLE_CLIENT_ID` = Client ID de l'étape 2.

## Contrat actuel

Toutes les actions ci-dessous (sauf `authenticate`) exigent un `idToken` Google valide dans le payload, revérifié à chaque appel (pas de session côté serveur).

- `authenticate({ idToken })` → vérifie le jeton Google, vérifie le rôle manager actif, renvoie `{ email, name, role }`.
- `listRequests({ idToken })` → demandes `requested`, avec conflits de dates et adresses inconnues signalés.
- `approveRequest({ idToken, reservationId })` → passe en `pending_payment`, bloque le créneau 48h, crée un événement sur l'agenda Google de la ressource (`calendar_id`), titre/couleur selon statut.
- `refuseRequest({ idToken, reservationId, reason })` → passe en `refused`.
- `confirmPayment({ idToken, reservationId })` → passe en `confirmed`, horodate `paid_at`, met à jour l'événement agenda existant (titre/couleur "Confirmée"). Génération du code de porte à câbler plus tard (API serrure).
- `adminCancel({ idToken, reservationId, reason })` → passe en `cancelled`, supprime l'événement agenda créé (le cas échéant).

À chaque changement de statut d'une réservation (approuvée, refusée, virement constaté, annulée), un mail (HTML, badge couleur par statut, dates sans heure, lien vers l'événement agenda si disponible) est envoyé au demandeur (`requester_email`) et aux comptes éditeurs/propriétaires de l'agenda Google de la ressource (ACL). Pas d'agenda configuré ou erreur agenda/mail = action métier quand même effectuée (non bloquant).
- `listReservations({ idToken, filters? })` → liste complète, filtrable par `status`.
- `blockDates({ idToken, resourceId, startAt, endAt, reason })` → bloque des dates sur une ressource (travaux, AG, ménage exceptionnel). Créé comme réservation `status = blocked` ; pris en compte dans la détection de conflit. Pour lever le blocage, utiliser `adminCancel`.
- `listResidents({ idToken })` → liste des résidents et gestionnaires.
- `upsertResident({ idToken, resident })` → crée (si pas de `resident_id`) ou met à jour un résident. `resident.role` ∈ `resident`, `admin`, `super_admin`.
- `revokeResident({ idToken, residentId })` → passe le résident en `status = inactive` (jamais de suppression).
- `deleteResident({ idToken, residentId })` → supprime définitivement la ligne (à réserver aux comptes créés par erreur).
- `listResources({ idToken })` → liste des ressources réservables et leur configuration.
- `upsertResource({ idToken, resource })` → crée (si `resource_id` nouveau) ou met à jour une ressource (`resource_id`, `name`, `calendar_id`, `price_per_unit`, `cleaning_fee`, `check_in_time`, `check_out_time`, `max_units`).
- `deleteResource({ idToken, resourceId })` → supprime une ressource, refusé si des réservations la référencent.

Chaque action mutante écrit dans `audit_log`. Les actions restantes du contrat (`blockDates`, `exportResidentData`, etc., voir `Implémentation technique.md`) restent à écrire au même endroit, dans `ACTIONS`.
