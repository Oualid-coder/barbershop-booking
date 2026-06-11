-- ============================================================
-- 006_security_fixes.sql
-- Correctifs sécurité pré-production
-- ============================================================

-- --------------------------------------------------------
-- Fix 1 : bookings_public_insert — forcer status = 'pending'
--
-- Sans ce fix, un utilisateur anonyme peut appeler l'API
-- Supabase directement et insérer un booking avec
-- status = 'confirmed' ou 'cancelled', bypassant le workflow
-- de confirmation admin.
-- --------------------------------------------------------
DROP POLICY "bookings_public_insert" ON bookings;

CREATE POLICY "bookings_public_insert"
  ON bookings FOR INSERT
  WITH CHECK (status = 'pending');
