-- ============================================================
-- 010_rate_limiting.sql
-- Table de journalisation des emails pour le rate limiting
-- de l'Edge Function notify-booking.
-- Accessible uniquement par service_role (contexte serveur).
-- ============================================================

CREATE TABLE email_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id  uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes de comptage par barbier sur fenêtre temporelle
CREATE INDEX idx_email_logs_barber_time ON email_logs (barber_id, created_at DESC);

-- RLS : activé, mais aucune policy publique — seul service_role (bypass RLS) peut lire/écrire
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Aucun GRANT à anon ou authenticated — table réservée à l'Edge Function via service_role
GRANT SELECT, INSERT ON email_logs TO service_role;
