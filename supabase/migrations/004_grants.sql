-- ============================================================
-- 004_grants.sql
-- Privileges PostgreSQL pour les rôles Supabase
-- ============================================================
-- RLS ne suffit pas : il faut aussi des GRANT au niveau table.
-- Sans GRANT, PostgreSQL refuse l'accès avant même d'évaluer
-- les RLS policies → erreur 42501 "permission denied for table"
-- renvoyée par Supabase en HTTP 401.
-- ============================================================

-- Accès au schéma public
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── anon (clients non authentifiés) ─────────────────────────
-- Lecture des données publiques
GRANT SELECT ON services       TO anon;
GRANT SELECT ON business_hours TO anon;
GRANT SELECT ON blocked_slots  TO anon;

-- Création de réservations sans compte
GRANT INSERT ON bookings TO anon;

-- ── authenticated (admin connecté) ──────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON services       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bookings       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON business_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON blocked_slots  TO authenticated;
