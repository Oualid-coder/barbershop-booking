-- ============================================================
-- 005_barbers.sql
-- Table barbers + colonne barber_id dans bookings
-- ============================================================

-- --------------------------------------------------------
-- 1. Table barbers
--    user_id lie le barbier à un compte Supabase Auth
-- --------------------------------------------------------
CREATE TABLE barbers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name       text        NOT NULL,
  email      text        NOT NULL,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT barbers_unique_user UNIQUE (user_id)
);

-- --------------------------------------------------------
-- 2. FK barber_id dans bookings (nullable : compat données existantes)
-- --------------------------------------------------------
ALTER TABLE bookings
  ADD COLUMN barber_id uuid REFERENCES barbers(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_barber ON bookings (barber_id);

-- --------------------------------------------------------
-- 3. RLS
-- --------------------------------------------------------
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

-- Lecture publique des barbiers actifs (le client doit connaître l'id)
CREATE POLICY "barbers_public_read"
  ON barbers FOR SELECT
  USING (active = true);

-- Admin : accès complet
CREATE POLICY "barbers_admin_all"
  ON barbers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------
-- 4. Grants
-- --------------------------------------------------------
GRANT SELECT ON barbers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON barbers TO authenticated;

-- --------------------------------------------------------
-- 5. Seed — barbier par défaut (mettre à jour user_id + email dans le dashboard)
-- --------------------------------------------------------
INSERT INTO barbers (name, email) VALUES ('Barbier', 'barbier@example.com');
