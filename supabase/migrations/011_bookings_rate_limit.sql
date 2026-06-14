-- ============================================================
-- 011_bookings_rate_limit.sql
-- Trigger BEFORE INSERT sur bookings :
-- un même client_phone ne peut pas créer plus de 3 réservations
-- dans les dernières 24 heures.
-- ============================================================

CREATE OR REPLACE FUNCTION check_booking_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*)
    INTO recent_count
    FROM bookings
   WHERE client_phone = NEW.client_phone
     AND created_at  >= now() - interval '24 hours';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED'
      USING
        DETAIL  = 'Trop de réservations pour ce numéro dans les dernières 24h',
        HINT    = 'Réessayez demain ou contactez le salon directement',
        ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_rate_limit
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_rate_limit();
