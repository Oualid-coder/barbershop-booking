-- ============================================================
-- 015_confirmed_only.sql
-- Suppression du statut pending : toutes les réservations
-- sont désormais créées directement en 'confirmed'.
--
-- 1. RLS bookings_public_insert : autorise confirmed au lieu de pending
-- 2. Trigger rate limit : compte les confirmed (et non pending)
--    pour éviter le spam de réservations par téléphone
-- ============================================================

-- 1. Remplace la policy INSERT anon
DROP POLICY IF EXISTS bookings_public_insert ON bookings;

CREATE POLICY bookings_public_insert ON bookings
FOR INSERT TO anon
WITH CHECK (status = 'confirmed');

-- 2. Remplace la fonction de rate limiting (compte confirmed)
CREATE OR REPLACE FUNCTION check_booking_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM bookings
  WHERE client_phone = NEW.client_phone
    AND status = 'confirmed'
    AND created_at >= now() - interval '24 hours';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$;
