-- ============================================================
-- 013_rls_barber_isolation.sql
-- Renforce l'isolation des bookings par barbier au niveau RLS.
-- Avant : tout authenticated pouvait lire/modifier tous les bookings.
-- Après : chaque barbier ne voit que ses propres bookings.
--          L'owner (role = 'owner') conserve l'accès complet.
-- ============================================================

-- Fonction helper : vrai si l'utilisateur courant est owner
-- SECURITY DEFINER : s'exécute avec les droits du créateur,
-- pas de l'appelant → bypasse la RLS sur la table barbers.
-- STABLE : résultat stable dans une transaction, PostgreSQL peut
-- mettre le résultat en cache pour éviter plusieurs SELECT.
CREATE OR REPLACE FUNCTION is_owner()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM barbers
    WHERE user_id = auth.uid() AND role = 'owner'
  )
$$;

-- ── SELECT ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS bookings_admin_select ON bookings;
CREATE POLICY bookings_admin_select ON bookings
FOR SELECT TO authenticated
USING (
  is_owner() OR
  barber_id = (SELECT id FROM barbers WHERE user_id = auth.uid())
);

-- ── UPDATE ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS bookings_admin_update ON bookings;
CREATE POLICY bookings_admin_update ON bookings
FOR UPDATE TO authenticated
USING (
  is_owner() OR
  barber_id = (SELECT id FROM barbers WHERE user_id = auth.uid())
);

-- ── DELETE ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS bookings_admin_delete ON bookings;
CREATE POLICY bookings_admin_delete ON bookings
FOR DELETE TO authenticated
USING (
  is_owner() OR
  barber_id = (SELECT id FROM barbers WHERE user_id = auth.uid())
);
