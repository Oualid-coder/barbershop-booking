-- ============================================================
-- 012_add_owner_role.sql
-- Ajoute un rôle propriétaire/barbier sur la table barbers.
-- Zo est défini comme owner (premier barbier actif).
-- ============================================================

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'barber'
    CHECK (role IN ('owner', 'barber'));

-- Mettre Zo en owner (à ajuster si le nom diffère en base)
UPDATE barbers SET role = 'owner' WHERE name = 'Zo';
