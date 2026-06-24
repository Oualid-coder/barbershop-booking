-- ============================================================
-- 016_remove_rate_limit.sql
-- Supprime le rate limiting par téléphone sur les réservations.
--
-- Raison : trop de faux positifs (numéros non normalisés, familles
-- partageant le même téléphone) et volume du salon trop faible
-- pour justifier cette protection.
-- ============================================================

DROP TRIGGER IF EXISTS trg_booking_rate_limit ON bookings;

DROP FUNCTION IF EXISTS check_booking_rate_limit();
