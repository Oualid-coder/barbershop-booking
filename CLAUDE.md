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

## TODO
- [x] Schéma SQL Supabase
- [x] Bootstrap React + Vite
- [x] Page client réservation (4 étapes + design VIP)
- [x] Dashboard admin (design VIP)
- [x] RLS policies
- [ ] Déploiement Vercel
- [x] Génération QR code
