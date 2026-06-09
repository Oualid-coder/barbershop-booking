-- ============================================================
-- 001_initial_schema.sql
-- Schéma initial Barbershop Booking
-- ============================================================

-- --------------------------------------------------------
-- 1. services
--    Catalogue des prestations proposées par le barbershop
-- --------------------------------------------------------
CREATE TABLE services (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  description      text,
  duration_minutes int         NOT NULL CHECK (duration_minutes > 0),
  price            numeric(8,2) NOT NULL CHECK (price >= 0),
  active           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 2. bookings
--    Réservations clients liées à un service
--    Contrainte d'unicité (date, heure) = pas de double réservation
-- --------------------------------------------------------
CREATE TABLE bookings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   uuid        NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  client_name  text        NOT NULL,
  client_phone text        NOT NULL,
  booking_date date        NOT NULL,
  booking_time time        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_no_double_reservation UNIQUE (booking_date, booking_time)
);

-- Index pour les requêtes par date (dashboard admin)
CREATE INDEX idx_bookings_date ON bookings (booking_date);
-- Index pour filtrer par statut
CREATE INDEX idx_bookings_status ON bookings (status);

-- --------------------------------------------------------
-- 3. business_hours
--    Horaires d'ouverture par jour de la semaine
--    0 = dimanche ... 6 = samedi (convention ISO JS)
-- --------------------------------------------------------
CREATE TABLE business_hours (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  int     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    time    NOT NULL,
  close_time   time    NOT NULL,
  is_closed    boolean NOT NULL DEFAULT false,

  CONSTRAINT business_hours_unique_day UNIQUE (day_of_week),
  CONSTRAINT business_hours_valid_range CHECK (close_time > open_time)
);

-- --------------------------------------------------------
-- 4. blocked_slots
--    Créneaux manuellement bloqués par l'admin
--    (congés, pause, maintenance...)
-- --------------------------------------------------------
CREATE TABLE blocked_slots (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date        NOT NULL,
  blocked_time time        NOT NULL,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blocked_slots_unique UNIQUE (blocked_date, blocked_time)
);

-- Index pour les requêtes de disponibilité (filtrage par date)
CREATE INDEX idx_blocked_slots_date ON blocked_slots (blocked_date);
