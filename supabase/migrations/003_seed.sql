-- ============================================================
-- 003_seed.sql
-- Données initiales — Barbershop Booking
-- ============================================================

-- --------------------------------------------------------
-- Services par défaut
-- --------------------------------------------------------
INSERT INTO services (name, description, duration_minutes, price, active) VALUES
  ('Coupe homme',   'Coupe classique avec finitions au rasoir',         30, 25.00, true),
  ('Coupe + Barbe', 'Coupe complète et taille de barbe avec rasage',    45, 35.00, true),
  ('Barbe',         'Taille et mise en forme de la barbe avec rasage',  20, 15.00, true);

-- --------------------------------------------------------
-- Horaires d'ouverture
-- 0 = dimanche (fermé), 1 = lundi ... 6 = samedi
-- --------------------------------------------------------
INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (0, '09:00', '19:00', true),   -- Dimanche : fermé
  (1, '09:00', '19:00', false),  -- Lundi
  (2, '09:00', '19:00', false),  -- Mardi
  (3, '09:00', '19:00', false),  -- Mercredi
  (4, '09:00', '19:00', false),  -- Jeudi
  (5, '09:00', '19:00', false),  -- Vendredi
  (6, '09:00', '19:00', false);  -- Samedi
