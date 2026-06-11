-- ============================================================
-- 007_rename_barbers.sql
-- Identités réelles des barbiers : Zo et Ryade
-- ============================================================

-- Renomme le barbier seed générique en "Zo"
UPDATE barbers SET name = 'Zo' WHERE name = 'Barbier';

-- Ajoute Ryade (email à mettre à jour + user_id à lier)
INSERT INTO barbers (name, email)
VALUES ('Ryade', 'ryade@example.com')
ON CONFLICT DO NOTHING;
