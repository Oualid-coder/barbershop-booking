-- ============================================================
-- 009_fix_barbers_rls_column_grant.sql
--
-- Migration 008 accordait uniquement SELECT (id, name) à anon.
-- La policy RLS "barbers_public_read" contient USING (active = true).
-- PostgreSQL exige SELECT sur toute colonne référencée dans une
-- expression de policy — sans SELECT sur "active", l'évaluation
-- du USING échoue et la requête renvoie 0 lignes ou une erreur 42501.
--
-- Fix : ajouter "active" au grant colonne.
-- Le frontend ne sélectionne que "id, name" → active n'est jamais
-- renvoyé au client, mais la policy peut l'évaluer.
-- email, user_id et created_at restent hors du grant anon.
-- ============================================================

REVOKE SELECT ON barbers FROM anon;
GRANT SELECT (id, name, active) ON barbers TO anon;
