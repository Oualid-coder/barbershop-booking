# Barbershop Booking — Mémoire Projet

## Stack
- Frontend: React + Vite
- Backend: Supabase (PostgreSQL + Auth + RLS)
- Déploiement: Vercel
- Style: Tailwind CSS

## Agents
- Orchestrator : mémoire persistante, décisions archi
- Frontend Agent : React mobile-first, UX premium barbershop
- Backend Agent : Supabase schema, RLS policies
- QA Agent : tests, edge cases, validation
- CyberSec Agent : audit RLS, failles, sécurité API
- Mentor Agent : explique chaque choix technique en markdown

## Décisions techniques
_(à compléter au fil du projet)_

## Décisions techniques

### Notifications email — Edge Function Deno, pas npm resend côté frontend

**Décision →** Email envoyé via une Supabase Edge Function (Deno), appelée en fire-and-forget depuis le frontend avec `supabase.functions.invoke()`.

**Pourquoi →**
- La clé API Resend ne peut pas être dans le bundle frontend (exposée dans le navigateur).
- L'Edge Function tourne côté serveur (Deno runtime), la clé reste secrète dans les secrets Supabase.
- `supabase.functions.invoke()` gère automatiquement le header `Authorization: Bearer anon_key` et le CORS.

**Pourquoi fire-and-forget (pas d'await) →**
- Une panne de Resend ou du réseau ne doit jamais bloquer la confirmation client.
- La réservation est déjà en base — c'est la source de vérité. L'email est un complément.
- `setBooked(true)` est appelé avant l'invoke → UX instantanée.

**Pourquoi pas `.select('id')` après l'insert →**
- La RLS accorde `INSERT` mais pas `SELECT` au rôle `anon` sur `bookings` (données sensibles).
- Pas besoin de l'ID dans la notification — les données utiles (nom, tel, service, date, heure) sont déjà connues côté client.

**Pourquoi npm `resend` est installé mais pas utilisé dans l'Edge Function →**
- L'Edge Function est Deno — elle ne consomme pas le `node_modules/`.
- L'API REST Resend est appelée directement via `fetch` natif Deno, sans dépendance tierce.
- Le package npm resend est disponible si on veut l'utiliser depuis un contexte Node.js futur.

**Variables d'env à configurer dans Supabase Dashboard → Edge Functions → Secrets :**
- `RESEND_API_KEY` — clé API Resend (commence par `re_`)
- `RESEND_FROM_EMAIL` — expéditeur vérifié dans Resend (ou `onboarding@resend.dev` en test)
- `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` — auto-injectés par Supabase, pas à configurer manuellement

**Pourquoi service_role dans l'Edge Function (et pas anon) →**
- La table `barbers` est accessible en SELECT par `anon` uniquement pour les barbiers actifs.
- L'Edge Function a besoin de lire l'email d'un barbier par son `id` — sans condition sur `active`.
- La `service_role` key bypasse RLS côté serveur, ce qui est légitime ici : l'Edge Function est un contexte de confiance, pas exposé au client.

**Trade-offs →**
- ✅ Clé API jamais exposée côté client
- ✅ Panne email = invisible pour le client, booking toujours enregistré
- ⚠️ Si l'email échoue silencieusement, le barbier ne le saura pas — à surveiller via les logs Supabase Edge Functions

## Bugs rencontrés & solutions

### 401 Unauthorized sur toutes les requêtes Supabase REST

**Symptôme** : HTTP 401 sur `GET /rest/v1/services` avec l'anon key. Clé valide, RLS policies en place.

**Cause racine** : PostgreSQL distingue deux niveaux d'accès indépendants :
1. **GRANT** — permission de toucher la table (niveau rôle PostgreSQL)
2. **RLS policy** — permission sur quelles lignes (niveau ligne)

Quand les tables sont créées via SQL brut (migrations), Supabase **n'accorde pas automatiquement** les GRANT aux rôles `anon` et `authenticated`. Sans GRANT, PostgreSQL rejette la requête avant même d'évaluer les RLS policies → erreur `42501` que Supabase renvoie en HTTP 401.

**Fix** : `supabase/migrations/004_grants.sql` — à coller dans l'éditeur SQL Supabase :
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON services, business_hours, blocked_slots TO anon;
GRANT INSERT ON bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON services, bookings, business_hours, blocked_slots TO authenticated;
```

**Leçon** : toujours inclure les GRANT dans les migrations SQL manuelles. Le dashboard Supabase les applique automatiquement, pas le SQL Editor raw.

## Choix d'architecture & justifications

### Vue Calendrier — algorithme et choix UX

**Décision →** Grille 42 cellules (6 lignes × 7 colonnes), Mon→Dim, avec padding mois précédent/suivant.

**Algorithme `getCalendarDays(year, month)` :**
- `startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1` → convertit dimanche (0) en position 6, sinon décale de -1 pour avoir Lun=0
- Padding gauche : `new Date(year, month, -i)` pour i de `startDow-1` à 0 → dernier jour du mois précédent en ordre chronologique
- Padding droit : complétion jusqu'à 42 cellules

**Décision →** Sélection d'un jour → `DayPanel` inline sous la grille (pas de modal).

**Pourquoi →**
- Modal = superposition qui cache le calendrier → perte de contexte
- Panel inline permet de voir le mois ET le détail simultanément — utile pour vérifier les jours adjacents

**Décision →** `MoveModal` auto-sufisant — fetch ses propres `business_hours`.

**Pourquoi →** Évite de faire remonter `businessHours` jusqu'au parent (`TodayView`, `CalendarView`). Le coût d'un fetch supplémentaire est négligeable (7 lignes, données stables).

**Décision →** Slot disponible pour déplacement = exclut le booking déplacé lui-même (`.neq('id', booking.id)`).

**Pourquoi →** Sans cette exclusion, le créneau actuel du booking serait marqué "pris" → impossible de confirmer au même horaire si l'admin voulait juste changer la date.

**Alternative rejetée →** Bibliothèque calendrier externe (react-calendar, FullCalendar) — overkill pour 30 résa/mois, dépendance CSS incompatible avec Tailwind v4.

**Trade-offs →**
- ✅ Zéro dépendance supplémentaire, full Tailwind
- ✅ Optimistic UI sur toutes les actions (confirm/cancel/move)
- ⚠️ La vue calendrier charge tout le mois d'un coup — acceptable (<100 résa/mois)

### Dashboard admin — architecture et choix

**Décision →** Single-page dashboard avec tabs (Aujourd'hui / Semaine / Services / Horaires / QR Code), pas de routes séparées par section.

**Pourquoi →**
- L'admin est une seule personne sur un seul écran. Le context switching entre sections est minimal, les tabs suffisent.
- Évite la complexité de nested routes React Router pour un gain UX nul à cette échelle.
- Les données de chaque tab sont chargées à la demande (lazy) : pas de fetch inutile si l'admin n'ouvre que "Aujourd'hui".

**Décision →** Auth via `AuthContext` + `ProtectedRoute`, pas d'HOC ou de middleware.

**Pourquoi →**
- `session === undefined` = loading, `session === null` = non connecté, `session = {...}` = connecté. Trois états clairs sans bibliothèque tierce.
- `ProtectedRoute` wraps le composant et redirige sans rendre la page protégée — pattern React standard, lisible et testable.

**Décision →** QR Code print via `@media print` CSS + `window.print()`, pas d'ouverture de nouvelle fenêtre.

**Pourquoi →**
- Une fenêtre d'impression avec `@media print` qui cache tout sauf `#qr-print-area` est plus simple et fonctionne sans popup blocker.
- L'URL dans le QR vient de `VITE_APP_URL` (variable d'env) avec fallback sur `window.location.origin` pour le dev local.

**Alternative rejetée →** Page admin en `/admin` seule sans sous-routes — trop limité pour ajouter des sections futures.

**Trade-offs →**
- ✅ Zero dépendance UI supplémentaire (pas de date-picker, calendar lib, etc.)
- ✅ Optimistic updates sur les actions booking (confirm/cancel) → UX instantanée
- ⚠️ La vue semaine recharge toutes les réservations de la semaine à chaque montage du tab — acceptable (< 50 résa/semaine pour un barbershop solo)

### Table barbers — lien Auth ↔ barbier ↔ réservations

**Décision →** Table `barbers` avec `user_id uuid REFERENCES auth.users(id)` + `email text`.

**Pourquoi `user_id` dans `barbers` →**
- Supabase Auth gère les identités (login/password, JWT). La table `barbers` gère les métadonnées métier (nom, email de notification, actif/inactif).
- Séparer les deux permet de créer un barbier sans compte Auth (seed, test) ou de désactiver un barbier sans supprimer son compte.
- `UNIQUE(user_id)` : un compte Auth = au plus un barbier.

**Pourquoi `barber_id` dans `bookings` →**
- Permet de filtrer les réservations par barbier dans le dashboard.
- Obligatoire pour une future évolution multi-barbiers (coiffeurs, associés).
- FK nullable : compat avec les données existantes avant la migration 005.

**Flow d'identification admin →**
1. `session.user.id` → `barbers.user_id` → `barber.id` + `barber.name`
2. Si aucun barbier trouvé : écran "Compte non configuré" (pas de données affichées)
3. `TodayView` et `CalendarView` reçoivent `barberId` en prop et filtrent avec `.eq('barber_id', barberId)`

**Pourquoi l'erreur "non configuré" bloque tout le dashboard →**
- Afficher les réservations sans filtre `barber_id` exposerait les données de tous les barbiers.
- Forcer la résolution du barbier avant d'accéder aux données est la seule garantie d'isolation.

**Configuration après migration →**
Dans le dashboard Supabase → Table `barbers` : mettre à jour le `user_id` (copier l'UUID depuis Auth → Users) et l'`email` du barbier principal.

**Trade-offs →**
- ✅ Isolation des données par barbier dès le départ
- ✅ Dashboard affiche le nom du barbier (pas juste l'email du compte Auth)
- ⚠️ Un admin doit manuellement associer `user_id` après migration — pas d'auto-provisioning

### Schéma SQL — 4 tables, pas plus

**Décision →** Schéma minimal : `services`, `bookings`, `business_hours`, `blocked_slots`.

**Pourquoi →**
- `services` : découple les prestations des réservations — changer un prix ou désactiver un service n'affecte pas l'historique des bookings.
- `bookings` : entité centrale. La contrainte `UNIQUE(booking_date, booking_time)` est la seule garantie fiable contre les doubles réservations (les vérifications côté client ne suffisent pas sous charge concurrente).
- `business_hours` : externalisé dans sa propre table pour permettre à l'admin de modifier les horaires sans toucher au code. Un seul enregistrement par `day_of_week` (contrainte UNIQUE).
- `blocked_slots` : séparé de `business_hours` car les deux ont des cycles de vie différents — les horaires sont stables, les blocages sont ponctuels et éphémères.

**Alternative rejetée →** Table `time_slots` pré-générée (créer tous les créneaux disponibles à l'avance).

**Trade-offs →**
- ✅ Schéma léger, pas de données à régénérer quand les horaires changent
- ✅ La disponibilité d'un créneau se calcule en temps réel : `booking_date+time` absent de `bookings` ET absent de `blocked_slots` ET dans la plage `business_hours`
- ⚠️ Requête de disponibilité légèrement plus complexe côté frontend (3 tables à croiser) — acceptable à cette échelle

### RLS — pourquoi pas juste une vérification côté frontend

**Décision →** Row Level Security activé sur toutes les tables, vérification côté base de données.

**Pourquoi →**
Le frontend (React) s'exécute dans le navigateur du client : son code est visible, modifiable et contournable. Si la seule protection est une condition `if (isAdmin)` en JavaScript, n'importe qui peut :
- Ouvrir DevTools et appeler directement l'API Supabase avec l'`anon key` (publique dans le bundle)
- Lire toutes les réservations (données personnelles clients : nom, téléphone)
- Supprimer ou modifier des bookings

Avec RLS, même en appelant Supabase directement avec l'`anon key`, la base refuse les opérations non autorisées — la règle est évaluée **dans PostgreSQL**, pas dans le code client. C'est la seule ligne de défense qui ne peut pas être contournée côté navigateur.

**Alternative rejetée →** Auth uniquement côté frontend + API routes Next.js/Edge comme proxy.

**Trade-offs →**
- ✅ Sécurité garantie au niveau base de données, indépendante du client
- ✅ Pas besoin de serveur intermédiaire (coût, latence)
- ✅ `anon key` peut rester dans le bundle sans risque (ses droits sont limités par RLS)
- ⚠️ Les policies doivent être auditées à chaque évolution du schéma
- ⚠️ "Admin = tout utilisateur authentifié" : acceptable pour un barbershop solo, à affiner avec des rôles si plusieurs coiffeurs

### Sélection barbier — étape 0 du tunnel de réservation

**Décision →** Étape 1 (Barbier) ajoutée avant le choix du service. StepIndicator : Barbier → Service → Créneau → Confirmation (4 étapes, 1-based).

**Pourquoi étape manuelle et non auto-sélection →**
- Auto-sélection du premier barbier actif était invisible pour le client et ne passait pas le bon `barber_id` à l'Edge Function → bug 404 en production.
- Choix explicite = client sait à qui il réserve, `selectedBarber.id` toujours défini avant l'insert.

**Flow des étapes (1-based pour correspondre à StepIndicator `num = i + 1`) →**
- Étape 1 : Sélection barbier → `handleSelectBarber` → setStep(2), stocke `selectedBarber`
- Étape 2 : Sélection service → `handleSelectService` → setStep(3)
- Étape 3 : Date + Créneau → `handleProceedToConfirmation` → setStep(4)
- Étape 4 : Formulaire → `handleSubmit` → `booked = true`

**Données pré-chargées au mount (Promise.all) →** `services`, `business_hours`, `barbers` — zéro latence à chaque étape.

**handleReset →** repasse à step 1, réinitialise `selectedBarber` et toute la sélection.

### Reload après UPDATE de statut — TodayView et CalendarView

**Décision →** Après un UPDATE de statut (confirmer/annuler), `load()` ou `fetchMonth()` est appelé systématiquement (succès ou erreur), remplaçant le comportement précédent qui ne rechargait qu'en cas d'erreur.

**Pourquoi →**
- Avec le filtre `.eq('barber_id', barberId)`, la liste optimistic peut devenir incohérente si un booking change de barbier entre-temps.
- Recharger depuis Supabase garantit que l'état local reflète exactement la base, au coût d'un seul fetch supplémentaire par action.

**Trade-offs →**
- ✅ Données toujours fraîches après chaque action
- ⚠️ Un flash de rechargement peut être perceptible — acceptable à cette échelle (<100 résa/mois)

## TODO
- [x] Schéma SQL Supabase
- [x] Bootstrap React + Vite
- [ ] Page client réservation
- [x] Dashboard admin
- [x] RLS policies
- [ ] Déploiement Vercel
- [ ] Génération QR code
