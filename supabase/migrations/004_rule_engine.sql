-- ============================================================
-- 004_rule_engine.sql
-- Adds a place to store the per-option score breakdown (JSON).
-- Run in Dashboard -> SQL Editor. Safe to run twice.
-- ============================================================

alter table public.alternatives
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb;

-- Make the API pick up the new column straight away.
notify pgrst, 'reload schema';