-- ============================================================
-- 008_restrict_barbers_columns.sql
-- Pentest finding : GRANT SELECT ON barbers TO anon exposait
-- email, user_id et created_at à tout porteur de l'anon key.
-- Fix : accès colonne par colonne — anon ne voit que id + name.
-- ============================================================

REVOKE SELECT ON barbers FROM anon;
GRANT SELECT (id, name) ON barbers TO anon;
