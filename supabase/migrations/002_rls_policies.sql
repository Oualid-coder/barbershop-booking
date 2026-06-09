-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security — Barbershop Booking
-- ============================================================
-- Principe : toute table a RLS activé. Sans policy explicite,
-- Supabase refuse tout accès par défaut (deny-by-default).
-- "Admin" = utilisateur Supabase Auth authentifié.
-- Les clients réservent sans compte (accès anonyme contrôlé).
-- ============================================================

-- --------------------------------------------------------
-- SERVICES
-- Lecture publique | Écriture admin uniquement
-- --------------------------------------------------------
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_public_read"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "services_admin_insert"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "services_admin_update"
  ON services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "services_admin_delete"
  ON services FOR DELETE
  TO authenticated
  USING (true);

-- --------------------------------------------------------
-- BOOKINGS
-- Insertion publique (client sans compte) | Lecture/modif admin
-- --------------------------------------------------------
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Un client anonyme peut créer une réservation
CREATE POLICY "bookings_public_insert"
  ON bookings FOR INSERT
  WITH CHECK (true);

-- Seul un admin authentifié peut lire toutes les réservations
CREATE POLICY "bookings_admin_select"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

-- Seul un admin peut modifier le statut (confirmer, annuler)
CREATE POLICY "bookings_admin_update"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seul un admin peut supprimer une réservation
CREATE POLICY "bookings_admin_delete"
  ON bookings FOR DELETE
  TO authenticated
  USING (true);

-- --------------------------------------------------------
-- BUSINESS_HOURS
-- Lecture publique | Écriture admin uniquement
-- --------------------------------------------------------
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_hours_public_read"
  ON business_hours FOR SELECT
  USING (true);

CREATE POLICY "business_hours_admin_insert"
  ON business_hours FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "business_hours_admin_update"
  ON business_hours FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "business_hours_admin_delete"
  ON business_hours FOR DELETE
  TO authenticated
  USING (true);

-- --------------------------------------------------------
-- BLOCKED_SLOTS
-- Lecture publique | Écriture admin uniquement
-- --------------------------------------------------------
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_slots_public_read"
  ON blocked_slots FOR SELECT
  USING (true);

CREATE POLICY "blocked_slots_admin_insert"
  ON blocked_slots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "blocked_slots_admin_update"
  ON blocked_slots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "blocked_slots_admin_delete"
  ON blocked_slots FOR DELETE
  TO authenticated
  USING (true);
