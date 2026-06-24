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

### Notifications push — OneSignal Web Push

**Décision →** Push envoyé via OneSignal REST API, appelé depuis l'Edge Function `notify-booking` (même fonction que l'email). Fire-and-forget : une panne OneSignal n'affecte pas la réponse client.

**Architecture →**
- SDK client (`OneSignalSDK.page.js` via CDN) : souscription du navigateur du barbier, initialisé au mount de `AdminDashboard`.
- `src/lib/onesignal.js` :
  - `initOneSignal()` — initialise le SDK, demande la permission push (admin uniquement).
  - `notifyNewBooking(payload)` — wrapper fire-and-forget autour de `supabase.functions.invoke('notify-booking')`. Remplace l'appel inline dans BookingPage pour centraliser toute la logique notification.
- Edge Function : après l'envoi email Resend, appelle `https://api.onesignal.com/notifications` avec `included_segments: ['All']` pour notifier tous les abonnés (les barbiers avec le dashboard ouvert).

**Pourquoi `included_segments: ['All']` et non ciblage par `barber_id` →**
- OneSignal ne connaît pas les `barber_id` Supabase. Cibler un utilisateur spécifique nécessiterait de stocker l'`external_user_id` OneSignal lors de l'abonnement.
- Pour un barbershop solo (1-2 barbiers), notifier tous les abonnés est acceptable.
- **Solution future** : `OneSignal.login(barber_id)` à l'init + `external_id` dans le payload push pour cibler un barbier précis.

**Pourquoi `@onesignal/node-onesignal` est installé mais pas utilisé dans l'Edge Function →**
- L'Edge Function est Deno — ne consomme pas `node_modules/`.
- L'API REST OneSignal est appelée directement via `fetch` natif Deno.
- Le package npm est disponible pour un éventuel contexte Node.js futur.

**App ID** : `b578b9f9-247f-4c6a-8bd2-a5af632d4b60` (public, dans le frontend et l'Edge Function).

**Secret à configurer dans Supabase → Edge Functions → Secrets :**
- `ONESIGNAL_API_KEY` — REST API Key OneSignal (Dashboard → Settings → Keys & IDs).
- Si absent, le push est silencieusement ignoré (`console.warn`), l'email est toujours envoyé.

**Trade-offs →**
- ✅ Push instantané dès qu'un client réserve, même si le dashboard est fermé
- ✅ Panne OneSignal = invisible pour le client, email toujours envoyé
- ⚠️ `included_segments: ['All']` notifie tous les abonnés — acceptable à 1-2 barbiers
- ⚠️ Nécessite HTTPS en production (les push Web ne fonctionnent pas en HTTP)

---

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

---

### Bug réservation silencieuse — investigation et fix (2026-06-22/25)

**Symptôme** : Megdoud Zoheir (Android Chrome, 4G instable) a obtenu "Une erreur est survenue. Veuillez réessayer." en tentant de réserver depuis la rue. Aucune réservation créée en base.

**Investigation** :
- Logs Supabase Edge Functions : hors fenêtre 24h gratuite, non disponibles.
- Vérification en base : aucune résa existante sur le créneau visé → pas de conflit UNIQUE `23505`.
- Rate limit téléphone : résa précédente trop ancienne → pas de `RATE_LIMIT_EXCEEDED`.
- Cause réseau probable : requête fetch bloquée ou rejetée sur connexion 4G dégradée.

**Causes racines identifiées (audit `BookingPage.jsx`) :**
- Pas de `try/finally` → `setSubmitting(false)` jamais appelé si la promesse rejette ou freeze → bouton bloqué définitivement sans message.
- `selectedService.id` accédé sans null-check → `TypeError` silencieuse si état corrompu → même effet que le cas précédent.
- `clientPhone.trim()` seulement → espaces internes conservés → bypass du rate limit par reformatage du numéro (`"06 12..."` vs `"0612..."`).
- Aucun timeout sur `supabase.from('bookings').insert()` → réseau qui freeze = UX bloquée indéfiniment.

**Fixes appliqués dans `BookingPage.jsx` :**
1. `try/finally` autour du bloc insert → `setSubmitting(false)` garanti dans tous les cas.
2. Guard null en début de `handleSubmit` : `if (!selectedService || !selectedDate || !selectedTime)` → message clair + return immédiat.
3. Normalisation téléphone : `clientPhone.trim().replace(/\s+/g, '')` → `normalizedPhone` envoyé à Supabase et à `notifyNewBooking`.
4. Timeout 15 s : `Promise.race([insertPromise, timeoutPromise])` → message dédié "connexion trop lente".
5. `console.error(error)` dans le `else` catch-all et dans le `catch` JS → erreur brute visible en DevTools.

**Décision complémentaire — suppression du rate limit téléphone (migration 016) :**
Le trigger `trg_booking_rate_limit` (3 résa/24h par téléphone) est jugé trop restrictif pour le volume réel du salon et générateur de faux positifs (famille partageant un numéro, client qui annule et re-réserve). Supprimé via migration 016.

**Double-clic (non corrigé, défense en profondeur suffisante) :**
Le bouton est `disabled={submitting}` pendant l'envoi → protection primaire. En cas de race condition edge-case, la contrainte `UNIQUE (booking_date, booking_time)` en base empêche tout doublon réel (code `23505` géré dans le `if (error)`). Pas de fix supplémentaire nécessaire.

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

## Audit sécurité pré-production

Audit réalisé le 2026-06-09. 10 points vérifiés.

---

### ✅ Points conformes

**2. Exposition des clés API**
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont dans le bundle frontend — c'est intentionnel et sûr : la `anon key` est une clé publique dont les droits sont limités par RLS.
- `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` : jamais dans le frontend, uniquement dans les secrets Supabase Edge Functions.

**4. Variables d'environnement**
- `.env`, `.env.local`, `.env.*.local` sont dans `.gitignore`. ✅
- `.env.example` contient uniquement des valeurs placeholder.

**5. Injections SQL**
- Toutes les requêtes passent par `@supabase/supabase-js` (requêtes paramétrées via PostgREST). Zéro SQL brut dans le frontend.

**7. Auth**
- `signInWithPassword` → message d'erreur générique (ne révèle pas si l'email existe).
- `ProtectedRoute` : spinner pendant le chargement, jamais de flash du contenu protégé.
- `onAuthStateChange` : session invalidée en temps réel si le JWT expire.
- Brute-force : géré par le rate-limiting natif de Supabase Auth.

**8. CORS**
- `Access-Control-Allow-Origin: *` dans l'Edge Function = standard Supabase. La protection réelle est le JWT vérifié par Supabase avant d'exécuter la fonction.

**9. Données sensibles**
- `client_name` / `client_phone` : RLS interdit tout SELECT à `anon` sur `bookings`. Seul un admin authentifié peut lire les réservations.

**10. Dépendances**
- `npm audit` : 0 vulnérabilité (info/low/moderate/high/critical). ✅

---

### 🔴 Failles corrigées

**Faille 1 — RLS bookings : status arbitraire à l'insertion (CORRIGÉ)**

- **Risque** : Un utilisateur anonyme pouvait appeler l'API Supabase directement et insérer un booking avec `status = 'confirmed'`, bypassant le workflow de confirmation admin.
- **Fix** : Migration `006_security_fixes.sql` — remplace `WITH CHECK (true)` par `WITH CHECK (status = 'pending')` sur la policy `bookings_public_insert`.

**Faille 2 — XSS dans le template email (CORRIGÉ)**

- **Risque** : Les champs `client_name`, `client_phone`, `service_name` étaient interpolés directement dans le HTML de l'email sans échappement. Un input `<img src=x onerror=...>` se retrouvait dans le corps de l'email. Risque faible en pratique (les clients email strippent JS) mais exploitable pour injecter du HTML arbitraire.
- **Fix** : Fonction `escapeHtml()` ajoutée dans l'Edge Function, appliquée à toutes les valeurs utilisateur avant interpolation HTML.

**Faille 3 — barber_id non validé avant interpolation URL (CORRIGÉ)**

- **Risque** : Le `barber_id` issu du payload était interpolé directement dans l'URL REST (`?id=eq.${barber_id}`) sans validation de format. Un `barber_id` contenant des caractères spéciaux (`%0a`, `&select=*`, etc.) pouvait manipuler la query string PostgREST.
- **Fix** : Validation UUID stricte via regex `UUID_RE` avant tout usage du `barber_id`. Retour 400 si format invalide.

**Bonus — leak d'information dans les erreurs (CORRIGÉ)**

- Les réponses d'erreur 400 renvoyaient `received: Object.keys(payload)` (liste des champs du payload) et la réponse 404 renvoyait le `barber_id`. Ces informations aident un attaquant à sonder l'API.
- **Fix** : Messages d'erreur génériques sans détail interne.

---

### ⚠️ Risques acceptés (documentés)

**Spam email via Edge Function**
- L'Edge Function accepte tout Bearer JWT valide, y compris l'`anon key` publique. Un attaquant connaissant l'URL de la fonction et l'anon key peut déclencher des envois d'emails.
- **Mitigation** : Le payload doit contenir un `barber_id` UUID valide existant en base. Le volume d'un barbershop solo (< 50 résa/mois) rend ce vecteur peu attractif.
- **Solution future** : Ajouter un secret partagé en header custom, ou vérifier que le booking existe en base avant d'envoyer l'email.

**`resend` npm package installé mais inutilisé**
- Le package `resend` est dans `dependencies` mais l'Edge Function utilise `fetch` natif. Dépendance superflue = surface d'attaque supply chain inutile.
- **Solution future** : `npm uninstall resend` si aucun usage Node.js n'est prévu.

**`admin = tout utilisateur authentifié`**
- RLS : toute session Auth valide a les droits admin complets sur toutes les tables. Acceptable pour un barbershop solo.
- **Solution future** : Roles PostgreSQL (`barbier`, `owner`) si plusieurs coiffeurs avec droits différenciés.

## Système de design — VIP Cut's

### Palette (Tailwind v4 @theme tokens)

| Token | Valeur | Usage |
|---|---|---|
| `ivory` | `#F7F2E8` | Background principal |
| `ivory-dark` | `#EDE8DC` | Background secondaire, hover |
| `ivory-border` | `#D4CBBA` | Bordures, placeholders |
| `vip-black` | `#0D0D0D` | Header, texte principal, boutons primaires |
| `gold` | `#C9A84C` | Accent, prix, step active, horaires |
| `gold-light` | `#E2C97E` | Variantes or clair |
| `bordeaux` | `#6B1E2A` | Erreurs, hover bouton primaire, annulation |
| `warm-gray` | `#7A6E5E` | Texte secondaire, labels |

### Typographie

- `font-playfair` : Playfair Display — headings, nom du salon, prix, noms clients, heures
- `font-dm` : DM Sans — body, labels, boutons, texte courant

Chargées via Google Fonts dans `index.html`.

### BookingPage — tunnel client

- **4 étapes** : Barbier (1) → Service (2) → Créneau (3) → Confirmation (4)
- Fond ivory, cards blanches avec `border-ivory-border`
- Bouton primaire : `bg-vip-black text-ivory hover:bg-bordeaux`
- Barbier cards : avatar circulaire initial `font-playfair`, `border-gold` sélectionné
- StepIndicator : actif = `bg-vip-black ring-gold`, fait = `bg-gold`, inactif = `border-ivory-border`
- Grain texture : `body::after` SVG feTurbulence, `opacity: 0.028`

### AdminDashboard / LoginPage — espace pro

- Header : `bg-vip-black` avec "VIP Cut's" en `font-playfair` + nom du barbier en or
- Tabs : `bg-ivory text-vip-black` actif, `text-warm-gray hover:bg-white/5` inactif
- Cards bookings : `bg-white border-ivory-border`, heure en `text-gold font-playfair`
- STATUS_BADGE : pending=`ivory-dark/warm-gray`, confirmed=`gold/10+gold`, cancelled=`bordeaux/10+bordeaux`
- Toggle : `bg-gold` ON / `bg-ivory-border` OFF
- Inputs horaires : `bg-white border-ivory-border focus:border-gold`
- Calendrier : cellules `bg-ivory`, `bg-gold/10` aujourd'hui, `bg-vip-black` sélectionné, dots `bg-gold`
- MoveModal : `bg-white border-ivory-border`, même palette que le tunnel client

### Favicon

SVG rasoir droit (`public/favicon.svg`) : manche noir+or, pivot or, lame noire, dos or.

## Audit sécurité final — pré-livraison

Audit réalisé le 2026-06-11. 9 points vérifiés.

---

### 1. ✅ OneSignal App ID exposé côté client — acceptable

`b578b9f9-247f-4c6a-8bd2-a5af632d4b60` est dans `src/lib/onesignal.js`, donc dans le bundle frontend.

**Pourquoi c'est safe →** L'App ID OneSignal est une clé publique par conception — équivalent de la `anon key` Supabase. Il identifie l'app, pas un utilisateur ni un droit d'écriture. La clé secrète est le **REST API Key** (`ONESIGNAL_API_KEY`), stocké uniquement dans les secrets Supabase Edge Functions, jamais côté client.

**Correction appliquée →** `allowLocalhostAsSecureOrigin` désormais conditionnel à `import.meta.env.DEV` — ne s'active pas en production.

---

### 2. ✅ Routes /admin/* — toutes protégées

Vérification dans `src/App.jsx` :

| Route | Protection |
|---|---|
| `/admin` | `Navigate` redirect vers `/admin/dashboard` |
| `/admin/login` | Public (intentionnel — page de connexion) |
| `/admin/dashboard` | `ProtectedRoute` wrapping `AdminDashboard` |

`ProtectedRoute` : spinner pendant `loading`, redirect vers `/admin/login` si `session === null`. Aucune route admin non protégée.

**Correction appliquée →** Spinner de `ProtectedRoute` migré vers la palette VIP (ivory/gold). Aucun impact sécurité, mais évite un flash de l'ancienne palette noire avant la redirection.

---

### 3. ✅ manifest.json — aucune donnée sensible

Contenu : `name`, `short_name`, `start_url`, `display`, `background_color`, `theme_color`, `icons` (référence vers `favicon.svg`). Zéro clé, credential ou donnée métier. Fichier public par nature (chargé par le navigateur sans auth).

---

### 4. ✅ Variables d'env Vercel côté client — toutes safe

| Variable | Type | Pourquoi safe |
|---|---|---|
| `VITE_SUPABASE_URL` | Public | Endpoint PostgREST public, protégé par RLS |
| `VITE_SUPABASE_ANON_KEY` | Public | Clé publique Supabase, droits limités par RLS |
| `VITE_APP_URL` | Public | URL de l'app, sans valeur secrète |

Les secrets réels (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_API_KEY`) ne sont **jamais préfixés `VITE_`** — Vite les exclut automatiquement du bundle.

**Correction appliquée →** `.env.example` nettoyé : suppression de `BARBER_EMAIL` (vestige de l'ancienne approche env-var, remplacé par fetch DB depuis la migration 005). Les secrets Edge Function sont maintenant documentés en commentaire pour ne pas être copiés dans `.env`.

---

### 5. ✅ Edge Function — ONESIGNAL_API_KEY en secret Supabase

Dans `supabase/functions/notify-booking/index.ts` :
```typescript
const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')
```
Jamais hardcodé. Si absent, le push est ignoré silencieusement avec `console.warn` — l'email est toujours envoyé. Zéro exposition dans le bundle frontend.

---

### 6. ✅ Workflow GitHub keep-alive — secret GitHub, pas dans le code

Dans `.github/workflows/keep-alive.yml` :
```yaml
-H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}"
```
La clé est référencée via `secrets.SUPABASE_ANON_KEY` (GitHub Actions Secrets), jamais en clair dans le fichier. L'URL Supabase (`mdynhezcfkhysrwxduqe.supabase.co`) est dans le code — c'est l'endpoint public PostgREST, équivalent à `VITE_SUPABASE_URL`. Acceptable.

---

### 7. ✅ RLS policies — cohérentes après migrations 005 et 006

| Table | anon | authenticated |
|---|---|---|
| `services` | SELECT | SELECT + INSERT + UPDATE + DELETE |
| `bookings` | INSERT WHERE `status='pending'` (006 ✅) | SELECT + UPDATE + DELETE |
| `business_hours` | SELECT | SELECT + INSERT + UPDATE + DELETE |
| `blocked_slots` | SELECT | SELECT + INSERT + UPDATE + DELETE |
| `barbers` | SELECT WHERE `active=true` | ALL |

Points vérifiés :
- `bookings_public_insert` : `WITH CHECK (status = 'pending')` — empêche l'injection de statut arbitraire ✅
- `barbers_public_read` : `USING (active = true)` — un barbier inactif est invisible publiquement ✅
- `bookings_admin_select` : lecture réservée aux sessions Auth — données clients (nom, tél) inaccessibles en anon ✅

**Risque accepté documenté →** `services_admin_update` et `barbers_admin_all` permettent à tout utilisateur authentifié de modifier n'importe quel service/barbier (pas d'isolation par `barber_id`). Acceptable pour un barbershop solo/duo — à affiner avec des rôles PostgreSQL si multi-établissements.

---

### 8. ✅ XSS — nouveaux composants safe

**`InlineNumber`** (`AdminDashboard.jsx`) :
- `type="number"` : le navigateur refuse tout caractère non numérique nativement
- `parseInt` / `parseFloat` au commit : convertit en nombre pur avant tout usage
- React rend `{value}` et `{suffix}` comme **text nodes**, jamais via `innerHTML` — échappement automatique
- Aucun `dangerouslySetInnerHTML`, aucun `eval()` dans l'ensemble du codebase

**Barber cards** (`BookingPage.jsx`) :
- `{barber.name.charAt(0)}` et `{barber.name}` : rendu React pur, XSS impossible
- Données viennent de Supabase (admin-controlled), pas d'input utilisateur direct

---

### 9. ✅ .gitignore — fichiers sensibles exclus

Vérification des entrées critiques :

| Fichier/Dossier | Exclus |
|---|---|
| `.env` | ✅ |
| `.env.local` | ✅ |
| `.env.*.local` | ✅ |
| `.claude/` | ✅ |
| `CLAUDE.md` | ✅ |
| `node_modules` | ✅ |
| `dist` | ✅ |

---

### Résumé exécutif

**9/9 points conformes.** Trois corrections appliquées lors de cet audit :
1. `allowLocalhostAsSecureOrigin` conditionnel à `import.meta.env.DEV`
2. `.env.example` nettoyé (suppression `BARBER_EMAIL` stale)
3. `ProtectedRoute` spinner migré vers palette VIP

**Risques résiduels acceptés (inchangés depuis l'audit du 2026-06-09) :**
- Spam push via Edge Function (mitigé par UUID valide requis)
- `admin = tout utilisateur authentifié` (acceptable solo/duo)
- `@onesignal/node-onesignal` et `resend` npm installés mais inutilisés (surface supply chain inutile)

---

### AdminDashboard — optimisation performances chargement initial

**Décision →** Extraction des 4 vues tab en fichiers séparés + `React.lazy()` + `Suspense`, `TodayView` reste inline (onglet par défaut, doit s'afficher sans délai async).

**Fichiers créés →**
- `src/components/admin/shared.jsx` — module partagé : `BookingCard`, `MoveModal`, `DayPanel`, `BookingSkeleton`, `CalendarSkeleton`, `Toggle`, `InlineNumber`, `Spinner`, `Empty`, constantes `STATUS_BADGE`, `DAY_NAMES`, helpers `getToday`, `localDateLabel`
- `src/pages/admin/CalendarView.jsx` — lazy-loaded
- `src/pages/admin/ServicesView.jsx` — lazy-loaded
- `src/pages/admin/HoursView.jsx` — lazy-loaded
- `src/pages/admin/QRView.jsx` — lazy-loaded

**Pourquoi `TodayView` reste inline et non lazy →**
- Onglet actif au mount — lazy-load ajouterait un délai perceptible à la première ouverture du dashboard.
- Les 4 autres tabs sont chargés uniquement si l'admin les ouvre : ~0 KB JS initial pour CalendarView, ServicesView, HoursView, QRView.

**Skeleton loaders (animate-pulse) plutôt que spinners →**
- `BookingSkeleton` : simule la forme d'une card booking (heure + nom + badge) → moins de layout shift à l'apparition des vraies données.
- `CalendarSkeleton` : simule la grille 7×6 → le layout ne "saute" pas quand les données arrivent.
- Règle : spinner pour les actions (save en cours), skeleton pour les chargements de données.

**`useCallback` systématique sur tous les handlers →**
- Évite de recréer les fonctions à chaque render et de propager des re-renders inutiles vers `BookingCard`, `MoveModal`, `DayPanel`.
- `handleStatusChange` et `handleMoved` dépendent uniquement de `load` / `fetchMonth` — eux-mêmes `useCallback`.

**Merge de `useEffect` dans AdminDashboard →**
- `initOneSignal()` (once) + fetch `barbers` (session-dépendant) fusionnés en un seul `useEffect([session])`.
- Guard `useRef(false)` : garantit qu'`initOneSignal()` ne tourne qu'une seule fois même si `session` change.
- Évite deux effets distincts avec un ordre d'exécution ambigu.

**Trade-offs →**
- ✅ JS initial allégé : CalendarView + qrcode.react chargés uniquement si l'admin ouvre l'onglet
- ✅ Skeleton = meilleure perception de vitesse vs spinner
- ✅ Handlers stables = moins de re-renders enfants
- ⚠️ Premier accès à un tab lazy déclenche un micro-délai réseau — mitigé par le `Suspense` fallback

### Onglet Compte — changement de mot de passe

**Décision →** `AccountView` lazy-loadé, reçoit `email` en prop depuis `AdminDashboard` (via `session?.user?.email`).

**Flow de validation →**
1. Validation côté client : min 8 caractères + correspondance des deux nouveaux mots de passe.
2. Re-authentification : `supabase.auth.signInWithPassword({ email, password: oldPassword })` — vérifie l'ancien mot de passe avant toute modification. Si échec → erreur inline "Mot de passe actuel incorrect", sans appel à `updateUser`.
3. Mise à jour : `supabase.auth.updateUser({ password: newPassword })` — appelé uniquement si la re-auth réussit.

**Pourquoi re-authentifier avant `updateUser` →**
- `updateUser` ne demande pas de confirmation de l'ancien mot de passe. Sans cette étape, n'importe qui laissant son navigateur ouvert pourrait changer le mot de passe.
- `signInWithPassword` avec les credentials courants est le pattern recommandé Supabase pour cette vérification.

**UX →**
- Messages d'erreur inline (badge bordeaux) sans rechargement de page.
- Message de succès inline (badge gold), formulaire vidé après succès.
- Bouton désactivé + spinner pendant l'opération.
- `autoComplete="current-password"` / `"new-password"` pour les gestionnaires de mots de passe.

**Trade-offs →**
- ✅ Re-auth empêche les changements de mot de passe depuis une session laissée ouverte
- ✅ Lazy-loadé — 0 KB JS supplémentaire si l'onglet n'est jamais ouvert
- ⚠️ La re-auth via `signInWithPassword` crée une nouvelle session Supabase — comportement attendu, pas de side effect visible

### Google Fonts — optimisation chargement

**Décision →** `rel="preload"` ajouté avant le `rel="stylesheet"` + `&display=swap` déjà présent dans l'URL.

**Ce qui était déjà en place →**
- `<link rel="preconnect">` pour `fonts.googleapis.com` et `fonts.gstatic.com` ✅
- `&display=swap` dans l'URL Google Fonts → `font-display: swap` sur toutes les fonts ✅

**Ajout →** `<link rel="preload" as="style" href="...">` avant le `<link rel="stylesheet">` — signale au navigateur de télécharger la CSS avec haute priorité dès le parsing du `<head>`, avant même que le render-blocking stylesheet ne soit évalué.

**Pourquoi `font-display: swap` →**
- Affiche le texte en font système dès que possible, remplace par Playfair/DM Sans quand chargées.
- Évite le FOIT (Flash Of Invisible Text) — le texte reste lisible pendant le chargement.
- Tradeoff : FOUT (Flash Of Unstyled Text) visible si fonts lentes — acceptable pour les fonts Google (généralement < 100 ms sur CDN).

**Trade-offs →**
- ✅ Fonts chargées plus tôt (preload hint au navigateur)
- ✅ Texte toujours visible pendant le chargement (swap)
- ⚠️ Deux `<link>` vers la même URL (preload + stylesheet) — redondance intentionnelle, comportement navigateur attendu

## Rate limiting

### 1. Email — Edge Function `notify-booking` (max 20/heure par barbier)

**Table** : `email_logs (id uuid PK, barber_id uuid, created_at timestamptz)` — migration 010.

**Flow** :
1. Après résolution du barbier, avant l'envoi Resend : COUNT des lignes `email_logs` où `barber_id = X` et `created_at >= now() - 1h` via `Prefer: count=exact` → header `Content-Range: */{N}`.
2. Si `N >= 20` → HTTP 429, log warning, retour immédiat sans envoi email ni push.
3. Si ok → envoi email → INSERT dans `email_logs` (fire-and-forget, n'affecte pas la réponse client).

**Pourquoi `email_logs` séparée et non un comptage sur `bookings` →**
- `bookings` peut être vidée (RGPD, cleanup), ce qui fausserait le comptage de rate limit.
- `email_logs` a un cycle de vie indépendant — conçu pour le comptage, pas pour les données métier.
- L'INSERT dans `email_logs` est fire-and-forget : une panne de l'insert ne bloque pas la confirmation client.

**Pourquoi `service_role` pour `email_logs` →**
- Table sans GRANT `anon` ni `authenticated` — RLS activé, aucune policy publique.
- Seul `service_role` (contexte Edge Function) peut y accéder. Inaccessible depuis le frontend ou l'API publique.

**Seuil choisi : 20/heure** — Un barbershop solo reçoit rarement plus de 10 réservations/heure. 20 laisse une marge raisonnable tout en bloquant les boucles d'abus (spam d'emails via l'anon key).

---

### 2. Réservations — Trigger PostgreSQL (max 3/24h par numéro de téléphone)

**Migration 011** : fonction `check_booking_rate_limit()` + trigger `trg_booking_rate_limit` BEFORE INSERT sur `bookings`.

**Logique** :
```sql
SELECT COUNT(*) FROM bookings
 WHERE client_phone = NEW.client_phone
   AND created_at >= now() - interval '24 hours';
IF count >= 3 → RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED'
```

**Pourquoi un trigger et non une vérification frontend →**
- Le frontend est contournable (appel direct à l'API REST Supabase avec l'anon key).
- Un trigger BEFORE INSERT s'exécute dans PostgreSQL, inside la transaction — impossible à bypasser via l'API.
- `RAISE EXCEPTION` annule l'INSERT atomiquement, aucune donnée partielle.

**Propagation au frontend →**
- Supabase renvoie le message d'exception PostgreSQL dans `error.message`.
- `BookingPage.jsx` détecte `error.message?.includes('RATE_LIMIT_EXCEEDED')` et affiche : *"Vous avez atteint la limite de réservations (3 par 24h). Contactez le salon directement."*
- Les autres erreurs restent sur le message générique.

**Seuil choisi : 3/24h par téléphone** — protège contre les boucles de réservation automatisées. Un client légitime n'a pas besoin de plus de 3 créneaux en 24h pour plusieurs membres d'une famille — dans ce cas, il peut appeler le salon.

**Trade-offs →**
- ✅ Rate limiting au niveau base de données, impossible à bypasser côté client
- ✅ `email_logs` isolée du cycle de vie des données métier
- ⚠️ Le trigger parcourt `bookings` par `client_phone` — index utile si la table grossit (actuellement < 1000 lignes, négligeable)
- ⚠️ Un numéro partagé (téléphone de famille) peut être bloqué après 3 réservations distinctes — rare mais possible

## Nettoyage automatique des réservations

**Workflow** : `.github/workflows/cleanup-old-bookings.yml`

**Déclenchement** : cron `0 2 1 * *` (1er de chaque mois, 02:00 UTC) + `workflow_dispatch`.

**Requête** :
```
DELETE /rest/v1/bookings?created_at=lt.<DATE_12_MOIS>
apikey: SUPABASE_ANON_KEY
Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY
Prefer: count=exact
```

**Pourquoi `service_role` comme Bearer et non `anon` →**
- La RLS n'accorde pas `DELETE` au rôle `anon` — seul `authenticated` peut supprimer.
- Le workflow s'exécute hors contexte utilisateur : impossible d'avoir un JWT de session Auth.
- `service_role` bypasse RLS côté serveur — usage légitime dans un contexte de confiance (runner GitHub isolé, secret chiffré).
- Le `apikey` reste l'anon key (convention Supabase : identifie le projet).

**Comptage des suppressions →**
PostgREST retourne HTTP 204 + header `Content-Range: */{N}` quand `Prefer: count=exact` est présent. Le script extrait `N` avec `grep -oE '[0-9]+$'` et le logge. Si `N = 0`, aucun log d'erreur — c'est un cas normal en début de vie de l'app.

**Date de coupure →**
`date -u -d '12 months ago' +%Y-%m-%dT%H:%M:%SZ` — syntaxe GNU date (runner ubuntu-latest). Retourne une date ISO 8601 UTC exacte.

**Secret à configurer** : `SUPABASE_SERVICE_ROLE_KEY` dans GitHub → Settings → Secrets and variables → Actions. Documenté dans `.env.example` (commenté, jamais commité).

**Cohérence RGPD →** La durée de conservation de 12 mois documentée dans `/privacy` est ainsi appliquée automatiquement en base — pas seulement déclarative.

**Trade-offs →**
- ✅ Suppression automatique conforme à la politique de confidentialité
- ✅ `service_role` ne sort jamais du runner GitHub (secret chiffré au repos)
- ⚠️ La suppression est définitive — pas de soft-delete ni corbeille
- ⚠️ Si le workflow échoue silencieusement un mois, les données restent 1 mois de plus — surveiller les logs GitHub Actions

## Pages légales RGPD

### Pages créées

| Route | Fichier | Accès |
|---|---|---|
| `/privacy` | `src/pages/PrivacyPage.jsx` | Public, sans ProtectedRoute |
| `/legal` | `src/pages/LegalPage.jsx` | Public, sans ProtectedRoute |

### Contenu — Politique de confidentialité (`/privacy`)

- Responsable : VIP Cut's, 86 rue Joseph de Maistre, 75018 Paris
- Données collectées : nom, téléphone, date/heure de réservation, service — rien d'autre
- Finalité : gestion des réservations uniquement, aucune revente ni marketing
- Base légale : exécution d'un contrat (RGPD art. 6(1)(b))
- Conservation : 12 mois maximum
- Droits RGPD : accès, rectification, effacement, limitation, opposition — contact par courrier
- Recours CNIL mentionné
- Hébergeurs documentés : Vercel Inc. (USA, CCT UE) + Supabase Inc. (serveurs Irlande, UE)
- Cookies : aucun tiers, aucun tracking — seul cookie technique de session Auth (exempté)

### Contenu — Mentions légales (`/legal`)

- Éditeur : VIP Cut's, 86 rue Joseph de Maistre, 75018 Paris
- Directeur de la publication : gérant de l'établissement
- Hébergement Vercel + Supabase (coordonnées complètes)
- Propriété intellectuelle : tous éléments réservés
- Limitation de responsabilité
- Renvoi vers `/privacy` pour les données personnelles
- Droit applicable : droit français, tribunaux français compétents

### Footer BookingPage mis à jour

Le footer passe de 2 éléments (copyright + lien admin) à 4 :
```
© 2026 VIP Cut's          Confidentialité · Mentions légales · Espace professionnel
```
Flex wrappable pour mobile (`flex-wrap justify-end`) — les liens restent lisibles sur petits écrans.

### Pourquoi `<a href>` et non `<Link>` dans le footer de BookingPage

BookingPage utilise déjà `<a href>` pour `/admin/login` (navigation cross-context volontaire). Pour la cohérence dans le même composant et parce que les pages légales sont des pages "de sortie" rarement visitées depuis le tunnel de réservation, `<a>` suffit. Les pages légales elles-mêmes utilisent `<Link>` car elles importent `react-router-dom` pour leur navigation interne.

### Design

- Fond `bg-ivory`, typographie `font-dm` / `font-playfair` identique au reste du site
- Header minimaliste : logo VIP Cut's (lien `/`) + lien "← Retour"
- Sections avec `<h2>` Playfair, corps DM Sans warm-gray
- Infos hébergeurs dans des cards `bg-white border-ivory-border` (cohérent avec les cards booking)
- Footer propre avec liens croisés entre les deux pages légales

## Pentest simulé

Audit réalisé le 2026-06-12. Tests exécutés avec `curl` contre le projet Supabase de production (`mdynhezcfkhysrwxduqe`).

---

### 1. Injection via formulaire de réservation

#### 1a — XSS payload dans `client_name`
```
POST /rest/v1/bookings  { "client_name": "<script>alert(1)</script>", "status": "pending" }
```
**Résultat** : HTTP 201 — le payload est **stocké tel quel** en base.

**Analyse** :
- ✅ Aucune exécution côté base (PostgREST → requêtes paramétrées, pas d'interpolation SQL)
- ✅ React escape automatiquement les valeurs dans le DOM (`{booking.client_name}` → text node, jamais `innerHTML`)
- ✅ Template email : `escapeHtml()` transforme `<script>` en `&lt;script&gt;` avant interpolation HTML
- **Verdict** : stockage accepté, mais le payload est inoffensif à tous les niveaux de rendu

#### 1b — SQL injection dans `client_name`
```
POST /rest/v1/bookings  { "client_name": "' OR 1=1; --", "status": "pending" }
```
**Résultat** : HTTP 201 — stocké comme chaîne de texte brute.

**Analyse** :
- ✅ PostgREST encode les valeurs comme paramètres PostgreSQL (`$1`, `$2`…) — aucune interprétation SQL possible
- ✅ La table `bookings` existe toujours après l'injection (`DROP TABLE` impossible dans ce vecteur)
- **Verdict** : SQLi impossible via l'API REST Supabase

#### 1c — Injection dans `client_phone`
```
POST /rest/v1/bookings  { "client_phone": "+33'; DROP TABLE bookings;", "status": "pending" }
```
**Résultat** : HTTP 201 — même analyse que 1b.

**Note** : Les 3 bookings de test (2026-07-01, 10:00/11:00/12:00) ont été créés avec `status='pending'`. Ils sont visibles uniquement par un admin authentifié. **À supprimer manuellement** depuis le dashboard Supabase → Table `bookings`.

---

### 2. Bypass RLS

#### 2a — Lecture des bookings (anon SELECT)
```
GET /rest/v1/bookings?select=*  (anon key, sans session Auth)
```
**Résultat** : HTTP 401 — `"permission denied for table bookings"` (PostgreSQL code 42501)

**Analyse** : ✅ GRANT SELECT sur `bookings` n'est pas accordé au rôle `anon` (migration 004). Le refus arrive avant même l'évaluation des RLS policies.

#### 2b — INSERT avec `status='confirmed'`
```
POST /rest/v1/bookings  { ..., "status": "confirmed" }
```
**Résultat** : HTTP 401 — `"new row violates row-level security policy"`

**Analyse** : ✅ Migration 006 — `WITH CHECK (status = 'pending')` sur `bookings_public_insert`. Un client ne peut pas s'auto-confirmer.

#### 2c — UPDATE services sans auth
```
PATCH /rest/v1/services?id=eq.<uuid>  { "price": 0 }  (anon key)
```
**Résultat** : HTTP 401 — `"permission denied for table services"`

#### 2d — DELETE services sans auth
```
DELETE /rest/v1/services?id=eq.<uuid>  (anon key)
```
**Résultat** : HTTP 401 — `"permission denied for table services"`

**Analyse 2c/2d** : ✅ GRANT UPDATE/DELETE sur `services` réservé à `authenticated` (migration 004).

---

### 3. Edge Function `notify-booking`

#### 3a — `barber_id` non-UUID (path traversal tenté)
```
{ "barber_id": "../../etc/passwd" }
```
**Résultat** : HTTP 400 — `{"error":"Invalid barber_id format"}`

#### 3b — Payload incomplet (champs manquants)
```
{ "client_name": "Test", "barber_id": "<uuid>" }  (sans phone, service, date, time)
```
**Résultat** : HTTP 400 — `{"error":"Missing required fields"}`

#### 3c — Sans header `apikey`
```
POST /functions/v1/notify-booking  (aucun header Authorization)
```
**Résultat** : HTTP 401 — `{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}`

#### 3d — UUID valide mais barbier inexistant
```
{ "barber_id": "00000000-0000-0000-0000-000000000000" }
```
**Résultat** : HTTP 404 — `{"error":"Barber not found"}` (message générique, sans exposer l'UUID reçu)

#### 3e — JSON malformé
```
POST body: "not-json-at-all"
```
**Résultat** : HTTP 400 — `{"error":"Invalid JSON body"}`

#### 3f — Query string injection dans `barber_id`
```
{ "barber_id": "49e6cc82-...valid...&select=email,password" }
```
**Résultat** : HTTP 400 — `{"error":"Invalid barber_id format"}` — la regex UUID rejette le `&` avant toute interpolation URL.

#### 3g — Newline injection (header injection tenté)
```
{ "barber_id": "49e6cc82-...valid...%0aX-Injected: evil" }
```
**Résultat** : HTTP 400 — `{"error":"Invalid barber_id format"}` — le `%0a` contenu dans la chaîne JSON échoue à la validation UUID.

**Bilan Edge Function** : ✅ 7/7 vecteurs bloqués.

---

### 4. Auth

#### 4a — Lecture des bookings sans JWT
```
GET /rest/v1/bookings?select=*  (anon key, pas de header Authorization)
```
**Résultat** : HTTP 401 — `"permission denied for table bookings"` — même résultat qu'en 2a, double protection GRANT + RLS.

#### 4b — JWT forgé (signature invalide)
```
Authorization: Bearer eyJ...<header>.<payload>.FAKESIGNATURE
```
**Résultat** : HTTP 401 — `{"code":"PGRST301","message":"JWT cryptographic operation failed"}` — Supabase vérifie la signature HMAC-SHA256 avec le `JWT_SECRET` côté serveur.

#### 4c — `updateUser` sans token de session
```
PUT /auth/v1/user  { "password": "newpassword123" }  (sans Authorization)
```
**Résultat** : HTTP 401 — `"This endpoint requires a valid Bearer token"`

#### 4d — `updateUser` avec l'anon key (pas de session utilisateur)
```
PUT /auth/v1/user  Authorization: Bearer <anon_key>
```
**Résultat** : HTTP 403 — `"invalid claim: missing sub claim"` — l'anon JWT n'a pas de `sub` (user ID), donc le changement de mot de passe est impossible sans session Auth réelle.

**Note sur `/admin/dashboard`** : route protégée côté React (`ProtectedRoute`). Sans session valide, React redirige vers `/admin/login` avant tout rendu. Testé à l'API layer — les données sous-jacentes sont indépendamment protégées par RLS (voir 2a/4a).

---

### 🔴 Faille détectée : exposition `email` + `user_id` sur `barbers`

**Vecteur** :
```
GET /rest/v1/barbers?active=eq.true&select=*  (anon key)
```
**Résultat** : HTTP 200 — retourne `id`, `name`, `email`, `user_id`, `created_at`, `active` pour tous les barbiers actifs.

**Risques** :
- `email` (zkrmg16@gmail.com) : PII du barbier, utilisable pour phishing/spam
- `user_id` (UUID Auth) : reconnaissable, utile pour la reconnaissance Auth
- `created_at` : minor info disclosure

**Root cause** : migration 005 fait `GRANT SELECT ON barbers TO anon` — grants toutes les colonnes. La RLS policy `USING (active = true)` filtre les lignes mais pas les colonnes.

**Fix** : Migration `008_restrict_barbers_columns.sql` — créée et à appliquer :
```sql
REVOKE SELECT ON barbers FROM anon;
GRANT SELECT (id, name) ON barbers TO anon;
```
Le frontend ne sélectionne que `id` et `name` (`select('id, name')` dans BookingPage et AdminDashboard) — aucun impact fonctionnel.

**À appliquer** dans Supabase → SQL Editor :
```sql
REVOKE SELECT ON barbers FROM anon;
GRANT SELECT (id, name) ON barbers TO anon;
```

---

### Résumé exécutif

| Vecteur | Tests | ✅ Bloqués | 🔴 Failles |
|---|---|---|---|
| Injections (XSS, SQLi) | 3 | 3 (inoffensif) | 0 |
| Bypass RLS | 4 | 4 | 0 |
| Edge Function | 7 | 7 | 0 |
| Auth | 4 | 4 | 0 |
| Colonnes exposées | 1 | 0 | **1** |

**1 faille réelle** : colonnes `email` + `user_id` lisibles via anon key sur `barbers`.
**Fix** : migration `008_restrict_barbers_columns.sql` (à exécuter dans le dashboard Supabase).
**Action complémentaire** : supprimer les 3 bookings de test (2026-07-01) depuis le dashboard Supabase.

---

## Tests

### Configuration

- **Framework** : Vitest v3 + jsdom (environment navigateur simulé)
- **Setup** : `@testing-library/jest-dom` chargé dans `src/__tests__/setup.js`
- **Config** : section `test` dans `vite.config.js` (pas de fichier `vitest.config` séparé)
- **Commande** : `npm run test` → `vitest run` (mode CI, pas de watch)

### Fichiers de tests

| Fichier | Sujets | Tests |
|---|---|---|
| `src/__tests__/bookingUtils.test.js` | `generateTimeSlots`, `getDayOfWeek`, `formatDate` | 16 |
| `src/__tests__/validation.test.js` | `validateClientName`, `validateClientPhone` | 18 |
| `src/__tests__/onesignal.test.js` | `getNotificationPermission` | 4 |

**Total : 38 tests, 3 suites — 100% passants**

### Module créé : `src/lib/validation.js`

Extrait de la logique de validation inline pour la rendre testable :
- `validateClientName(name)` : vérifie non-vide, longueur ≥ 2, regex `/^[a-zA-ZÀ-ÿ\s'-]+$/` (lettres + accents + tiret + apostrophe). Retourne `null` si valide, message d'erreur sinon.
- `validateClientPhone(phone)` : supprime les espaces, vérifie regex `/^(?:\+33|0033|0)[1-9]\d{8}$/` — accepte formats `06XXXXXXXX`, `+33XXXXXXXXX`, `0033XXXXXXXXX`. Retourne `null` si valide.

### Cas limites couverts

**generateTimeSlots** :
- Créneau dont la fin coïncide exactement avec la fermeture (`t + duration <= close`) → inclus ✓
- Créneau qui dépasserait la fermeture → exclu ✓
- Plage trop courte pour un seul créneau → tableau vide ✓
- Padding à deux chiffres (`08:05` pas `8:5`) ✓

**Validation téléphone** :
- `00612345678` (double zéro) → refusé — `[1-9]` après l'indicatif exclut le `0` ✓
- Numéros avec espaces → nettoyés avant validation ✓

**getNotificationPermission** :
- `window.Notification` undefined (navigateur sans support push) → `'default'` via opérateur `?.` ✓
- Mock `supabase` avec `vi.mock` pour éviter les imports de modules réels dans le test

### Pourquoi pas de tests de composants React

Les composants React du projet sont fortement couplés à Supabase (appels async au mount, RLS, sessions Auth). Mocker fidèlement la couche Supabase pour tester le comportement UI apporterait une couverture faible pour un coût de maintenance élevé. Les tests unitaires sur les fonctions pures (`bookingUtils`, `validation`, `onesignal`) couvrent les invariants les plus critiques sans fragiliser la suite sur les évolutions Supabase.

---

## Rôle owner — multi-barbiers

### Migration 012 — colonne `role` sur `barbers`

```sql
ALTER TABLE barbers ADD COLUMN role TEXT NOT NULL DEFAULT 'barber' CHECK (role IN ('owner', 'barber'));
UPDATE barbers SET role = 'owner' WHERE name = 'Zo';
```

**Pourquoi colonne et non table séparée →**
- Un barbier a exactement un rôle → scalaire sur la même ligne, pas de JOIN.
- CHECK constraint garantit que seules deux valeurs sont possibles en base.
- Le DEFAULT `'barber'` évite un NOT NULL sans valeur lors des INSERT existants.

**Pourquoi pas de RLS séparée par rôle →**
- L'accès multi-barbier dans le dashboard est garanti par la logique applicative (filtre `barberId` conditionnel) et non par RLS.
- RLS s'assure que seul un admin authentifié peut lire les bookings — le filtre par barbier est une couche UI au-dessus.
- **Risque accepté** : un barbier non-owner pourrait appeler l'API directement sans filtre `barber_id` et lire tous les bookings. Acceptable pour un salon solo/duo. Solution future : RLS `bookings_admin_select` avec condition `barber_id = auth.uid()` ou table de rôles avec join.

---

### AdminDashboard — comportement conditionnel owner

**Fetch barber** : `select('id, name, role')` — `role` récupéré une seule fois au mount.

**Tabs conditionnels** :
- `isOwner = barber.role === 'owner'`
- `isOwner` → `OWNER_TABS` (incluant "Équipe" entre Services et Horaires)
- sinon → `BASE_TABS` (sans "Équipe")

**TodayView / CalendarView en mode owner →**
- Reçoivent `isOwner` en prop.
- Si `isOwner` : requête sans `.eq('barber_id', barberId)` → retourne tous les bookings de tous les barbiers.
- Join `barbers(name)` dans le SELECT → chaque booking contient `b.barbers.name`.
- `BookingCard` reçoit `barberName={isOwner ? b.barbers?.name : undefined}` → affiche "✂ {nom}" sous la ligne service.

**Pourquoi montrer le nom du barbier seulement en mode owner →**
- Un barbier non-owner voit uniquement ses propres bookings → le nom du barbier est toujours lui-même, redondant.
- L'owner voit tous les barbiers → le nom est essentiel pour dispatcher les rendez-vous.

---

### Onglet Équipe — TeamView

**Fichier** : `src/pages/admin/TeamView.jsx` (lazy-loaded, owner uniquement).

**Features** :
- Liste tous les barbiers (`id, name, email, active, role`) — les non-owner ont un Toggle actif/inactif.
- Badge "Propriétaire" sur la row owner (pas de Toggle pour ne pas se désactiver soi-même).
- Formulaire "Ajouter un barbier" : prénom + email + mot de passe temporaire → `supabase.functions.invoke('create-barber', {...})`.
- Message de succès dismissible après création.
- Bouton afficher/masquer mot de passe temporaire.
- Note : le nouveau barbier peut changer son mot de passe depuis l'onglet Compte.

**Pourquoi l'Edge Function pour créer un barbier →**
- Créer un utilisateur Auth nécessite l'API admin Supabase (`POST /auth/v1/admin/users`) avec la `service_role` key.
- La `service_role` key ne peut pas être dans le frontend → Edge Function.
- L'Edge Function vérifie d'abord que l'appelant est bien un owner avant d'agir.

---

### Edge Function `create-barber`

**Fichier** : `supabase/functions/create-barber/index.ts`.

**Flow** :
1. Extrait le JWT de l'header `Authorization: Bearer <jwt>`.
2. Appelle `GET /auth/v1/user` avec ce JWT → vérifie que l'utilisateur existe et récupère son `id`.
3. Lit `barbers?user_id=eq.{callerId}&select=role` avec service_role → vérifie `role === 'owner'`. Sinon HTTP 403.
4. Valide les champs : `name`, `email` (regex), `password` (≥ 6 chars).
5. `POST /auth/v1/admin/users` avec `email_confirm: true` → crée le compte Auth.
6. `POST /rest/v1/barbers` → insère la ligne barbier (service_role, bypass RLS).
7. En cas d'échec de l'insert barber : DELETE du compte Auth pour éviter les comptes orphelins.

**Sécurité** :
- Double vérification : JWT valide + rôle owner en base.
- Email regex côté Edge Function (pas seulement côté client).
- Mot de passe ≥ 6 chars (minimum Supabase Auth).
- Cleanup atomique : si l'insert barber échoue, le compte Auth créé est supprimé.

**Trade-offs →**
- ✅ `service_role` jamais côté client
- ✅ Rollback : pas de compte Auth orphelin sans barbier associé
- ⚠️ Si le DELETE de cleanup échoue après l'échec de l'insert barber → compte Auth orphelin sans barbier (rare, loggé)
- ⚠️ Le mot de passe est transmis en clair dans le body JSON — acceptable car HTTPS en production

---

### ServicesView — gestion complète (owner)

**Ajouts owner-only** :
- `InlineText` pour le nom du service (édition click-to-edit, même pattern que `InlineNumber`).
- `InlineText` pour la description (placeholder "Ajouter une description…" si vide).
- Bouton "Supprimer ce service" → confirmation inline (pas de modal) → DELETE + filtre optimistic.
- Formulaire "+ Ajouter un service" en bas : nom*, description, durée, prix → INSERT avec `active: true` + tri par prix.

**Pourquoi confirmation inline et non modal →**
- Un modal pour une action rare (supprimer un service) est overkill.
- La confirmation inline (deux boutons dans la card) est plus légère et garde le contexte visible.
- Le `confirmDelete === s.id` state garantit qu'une seule carte est en état de confirmation à la fois.

**InlineText** (`src/components/admin/shared.jsx`) :
- Pattern identique à `InlineNumber` : affichage statique → click → input autoFocus → blur/Enter commit → Escape annule.
- `value || placeholder` en mode display : si la valeur est vide, affiche le placeholder en italique.
- `onCommit` appelé uniquement si `draft.trim()` non vide et différent de la valeur actuelle.

---

## RLS — isolation des bookings par barbier (migration 013)

### Contexte

Avant la migration 013, la policy `bookings_admin_select` permettait à **tout utilisateur authentifié** de lire tous les bookings de tous les barbiers. Un barbier non-owner pouvait donc appeler l'API REST directement et voir les réservations de ses collègues (données clients : nom, téléphone).

### Fonction `is_owner()`

```sql
CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM barbers WHERE user_id = auth.uid() AND role = 'owner'
  )
$$;
```

**Pourquoi `SECURITY DEFINER` →**
- La function s'exécute avec les droits du créateur (superuser), pas de l'appelant.
- Sans ça, évaluer `SELECT FROM barbers` à l'intérieur d'une policy `bookings_admin_select` déclencherait récursivement la policy `barbers_admin_all`, pouvant causer une boucle ou une erreur.
- C'est le pattern PostgreSQL standard pour les helpers de policy.

**Pourquoi `STABLE` →**
- PostgreSQL peut mettre le résultat en cache pour la durée d'une transaction.
- `is_owner()` est appelé pour chaque ligne évaluée par la policy — sans `STABLE`, ce serait un SELECT barbers par ligne booking.

### Nouvelles policies (SELECT / UPDATE / DELETE)

```sql
USING (
  is_owner() OR
  barber_id = (SELECT id FROM barbers WHERE user_id = auth.uid())
)
```

- **Owner** : `is_owner()` → true → accès à tous les bookings (vue globale dashboard).
- **Barbier** : `barber_id = <son propre id>` → accès uniquement à ses propres bookings.
- Les deux conditions sont court-circuitées : si `is_owner()` est vrai, le sous-SELECT n'est pas exécuté.

### Ce qui ne change pas

- `bookings_public_insert` (anon, INSERT) : inchangée — les clients peuvent toujours réserver.
- Tables `services`, `business_hours`, `blocked_slots`, `barbers`, `email_logs` : aucune policy modifiée.

### Impact sur le dashboard

- **TodayView / CalendarView en mode owner** : la requête sans filtre `barber_id` retourne tous les bookings — la RLS le permet car `is_owner()` est vrai.
- **TodayView / CalendarView en mode barbier** : la requête avec `.eq('barber_id', barberId)` retourne uniquement ses bookings — la RLS le permet car `barber_id = son id`.
- Si un barbier non-owner appelle l'API sans filtre : la RLS filtre automatiquement — il ne voit que ses bookings.

### Trade-offs

- ✅ Isolation réelle au niveau base de données, même via appel API direct
- ✅ `SECURITY DEFINER` + `STABLE` = overhead minimal (cache par transaction)
- ⚠️ Le sous-SELECT `(SELECT id FROM barbers WHERE user_id = auth.uid())` est évalué pour chaque ligne non-owner — index `barbers(user_id)` utile si la table grossit (actuellement < 10 barbiers, négligeable)
- ⚠️ Si un barbier n'a pas de `barber_id` correspondant (compte Auth sans barbier), la condition est `NULL = ...` → false → aucun booking visible (comportement sûr par défaut)

---

## Calendrier owner v2

### Contexte

Le `CalendarView` s'adapte automatiquement au rôle : les barbiers non-owner gardent l'ancien comportement (DayPanel + filtre par leur `barberId`). L'owner (Zo) obtient une vue enrichie : sélecteur de barbier, dots colorés, agenda horaire, formulaire de création.

---

### 1. Sélecteur de barbiers (chips)

**Position** : barre horizontale scrollable au-dessus du calendrier, visible uniquement si `isOwner=true`.

**Couleurs** : palette fixe `BARBER_COLORS = ['#C9A84C', '#6B1E2A', '#2A6B4A', '#1E3A6B', '#6B5E1E']` — attribuée par index à chaque barbier trié par nom. Identique dans les chips, les dots, et les blocs agenda.

**Comportement** :
- `selectedBarberId` state → filtre `fetchMonth` sur ce barbier uniquement.
- Cliquer une chip ferme le DayPanel ouvert (`setSelectedDate(null)`) puis re-fetch le mois.
- Le premier barbier de la liste est sélectionné au mount.

**Séquence de mount (owner)** :
1. `useEffect([isOwner])` → `GET /barbers?active=true&order=name` → `setBarbers(withColors)` → `setSelectedBarberId(first.id)`
2. `setSelectedBarberId` change la ref `fetchMonth` (via `useCallback`) → `useEffect([fetchMonth])` se re-déclenche → fetch réel du mois.
3. Pendant l'étape 1, `fetchMonth` retourne early si `isOwner && !selectedBarberId` → loading reste true → skeleton affiché.

**Pourquoi retourner early plutôt que fetch sans filtre →**
Évite un fetch inutile "tous les bookings" pendant la fraction de seconde avant que `selectedBarberId` soit défini.

---

### 2. Dots colorés

Le dot sur chaque jour du calendrier prend la couleur du barbier sélectionné pour l'owner, et reste `#C9A84C` (gold) pour les non-owners.

```js
const dotColor = useMemo(
  () => isOwner
    ? (barbers.find(b => b.id === selectedBarberId)?.color ?? '#C9A84C')
    : '#C9A84C',
  [isOwner, barbers, selectedBarberId],
)
```

Quand la cellule est sélectionnée (`isSelected`), le dot passe en `#ffffff` pour contraster sur le fond `bg-vip-black`.

---

### 3. AgendaPanel (vue grille horaire owner)

**Composant** : `AgendaPanel` défini dans `CalendarView.jsx` (non exporté, local au module).

**Grille** : `AGENDA_SLOTS` — 20 slots de 30 min de 09:00 à 18:30, générés au chargement du module (constante, pas recalculée). Un marker "19:00" est rendu en bas (non-interactif).

**Mise en page** :
- Colonne gauche (`w-14`) : label heure, affiché seulement sur les slots `:00` pour réduire le bruit.
- Colonne droite : bloc booking coloré ou slot vide.
- Hauteur fixe `minHeight: 48px` par slot — scrollable via `maxHeight: 22rem` sur le conteneur.

**Booking block** :
```jsx
style={{
  backgroundColor: `${color}18`,  // opacity ~10%
  borderLeft: `3px solid ${color}`,
}}
```
Affiche : nom client (Playfair), service + durée. Si annulé : opacity 40% + label "Annulé".

**Pourquoi une seule résa par slot →**
La contrainte `UNIQUE(booking_date, booking_time)` en base garantit au maximum 1 booking par créneau horaire. L'AgendaPanel en profite : `bookingBySlot` est un objet `{slot → booking}`, pas un tableau.

---

### 4. CreateBookingForm + Migration 014

**Composant** : `CreateBookingForm` — inline sous le header de l'AgendaPanel, affiché au clic du bouton "+ Créer".

**Fields** : barbier (select, pré-sélectionné sur le barbier actif), heure (select 30-min), service (fetch lazy au mount du form), nom client, téléphone.

**Insert** :
```js
await supabase.from('bookings').insert({
  barber_id, service_id, booking_date, booking_time,
  client_name, client_phone,
  status: 'confirmed',  // admin-created → directement confirmé
})
```

**Pourquoi migration 014 nécessaire →**
- `bookings_public_insert` (migration 006) : `FOR INSERT TO anon WITH CHECK (status='pending')` — ne couvre pas `authenticated`.
- Sans policy INSERT pour `authenticated`, PostgreSQL refuse l'insert même avec le GRANT (RLS activé = deny implicite sans policy permissive).
- Migration 014 : `CREATE POLICY bookings_owner_insert FOR INSERT TO authenticated WITH CHECK (is_owner() AND status IN ('pending','confirmed'))`. Uniquement les owners peuvent insérer ; status limité à pending/confirmed.

**Après succès** : `onCreated()` → `fetchMonth(year, month)` → dots et agenda se mettent à jour.

---

### 5. TeamView — toggle owner

Retiré `{barber.role !== 'owner' && ...}` autour du Toggle dans `BarberRow`. L'owner peut désormais se désactiver/réactiver. Quand `active=false`, son profil n'est plus visible aux clients (RLS `barbers_public_read : USING (active = true)`).

---

### Contraintes techniques respectées

- `useCallback` : `fetchMonth`, `prevMonth`, `nextMonth`, `handleStatusChange`, `handleMoved`.
- `useMemo` : `calendarDays`, `dotColor`, `bookingBySlot`, `active` (dans AgendaPanel), `selectedBarber`.
- Zéro librairie supplémentaire.
- `BookingCard` n'est plus importé dans CalendarView (DayPanel le consomme en interne).
- Import `bookingUtils` retiré (MoveModal gère ses propres slots en interne depuis shared.jsx).
- Non-owner : `DayPanel` + `MoveModal` inchangés.

---

## TODO
- [x] Schéma SQL Supabase
- [x] Bootstrap React + Vite
- [x] Page client réservation (4 étapes + design VIP)
- [x] Dashboard admin (design VIP)
- [x] RLS policies
- [ ] Déploiement Vercel
- [x] Génération QR code

## Suppression du statut pending (migration 015)

**Décision →** Toutes les réservations sont créées directement en `status = 'confirmed'`. Le statut `pending` est abandonné.

**Changements appliqués :**
- `BookingPage.jsx` : INSERT avec `status: 'confirmed'`
- `BookingCard` (shared.jsx) : bouton "Confirmer" supprimé
- `AgendaPanel` (CalendarView.jsx) : bouton "Confirmer" supprimé
- Migration `015_confirmed_only.sql` :
  - `bookings_public_insert` : `WITH CHECK (status = 'confirmed')`
  - `check_booking_rate_limit()` : compte `status = 'confirmed'` au lieu de `'pending'`

**Pourquoi →** Un barbier ne doit pas avoir à confirmer manuellement chaque réservation client. La confirmation est implicite dès la création.

**Risque →** Le statut `pending` reste valide en base (pas de migration ALTER TABLE) — les éventuelles anciennes résa restent lisibles. Seuls les nouveaux inserts sont bloqués à `confirmed` par RLS.

---

## Onglet Historique (owner uniquement)

**Fichier →** `src/pages/admin/HistoryView.jsx` (lazy-loaded, owner uniquement via OWNER_TABS).

**Features :**
- Fetch toutes les résa avec `services(name, duration_minutes)` et `barbers(name)`, triées par date DESC puis heure DESC
- Filtres combinables : statut (Toutes / Confirmées / Annulées) + barbier (chips colorées, palette BARBER_COLORS)
- Recherche client JS côté client (nom ou téléphone) — pas de requête supplémentaire
- Pagination "Voir plus" par tranches de 20 — pas de chargement paginé côté serveur (volume faible)
- Chip barbier colorée par index (même palette que CalendarView)

**Pourquoi pagination client et non serveur →**
Un barbershop génère < 1000 résa/an. Charger tout d'un coup + filtrer JS est plus simple et aussi rapide que la pagination PostgreSQL pour ce volume.

**Position dans OWNER_TABS →** Entre 'qr' et 'compte' — vue consultation, pas de gestion active.

---

## Rate limiting téléphone — retiré (migration 016)

**Décision →** Suppression du trigger `trg_booking_rate_limit` et de la fonction `check_booking_rate_limit()`.

**Pourquoi retiré →**
- Faux positifs : les numéros ne sont pas normalisés côté client (espaces, formats variés) — deux réservations du même numéro avec formatage différent passaient, une même famille avec un seul téléphone était bloquée après 3 créneaux.
- Volume salon : < 50 résa/mois — le vecteur de spam est peu attractif et le préjudice limité.
- La RLS `bookings_public_insert` (status = 'confirmed') et la contrainte `UNIQUE(booking_date, booking_time)` restent les vraies protections contre les doublons et les insertions malveillantes.
