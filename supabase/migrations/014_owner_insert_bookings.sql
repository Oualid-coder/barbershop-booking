-- ============================================================
-- 014_owner_insert_bookings.sql
-- Permet au propriétaire d'insérer des réservations directement
-- depuis le dashboard (sans passer par le tunnel client).
--
-- Contexte : bookings_public_insert autorise seulement anon avec
-- status='pending'. Aucune policy INSERT n'existe pour authenticated.
-- Sans cette migration, l'owner ne peut pas créer de resa admin.
--
-- Dépendance : is_owner() définie en migration 013.
-- ============================================================

CREATE POLICY bookings_owner_insert ON bookings
FOR INSERT TO authenticated
WITH CHECK (
  is_owner()
  AND status IN ('pending', 'confirmed')
);
