-- Migration 002: Generic quality parameter architecture
-- Replaces hardcoded moisture/FM columns with a flexible JSONB param system.
-- All statements are idempotent (IF EXISTS / IF NOT EXISTS).

ALTER TABLE materials
  DROP COLUMN IF EXISTS settlement_method,
  DROP COLUMN IF EXISTS quality_params,
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'deduction',
  ADD COLUMN IF NOT EXISTS params JSONB NOT NULL DEFAULT '[]';

ALTER TABLE quality_rules
  DROP COLUMN IF EXISTS base_moisture,
  DROP COLUMN IF EXISTS moisture_deduction_method,
  DROP COLUMN IF EXISTS moisture_rate_per_pct,
  DROP COLUMN IF EXISTS fm_deduction_method,
  DROP COLUMN IF EXISTS fm_rate_per_pct,
  DROP COLUMN IF EXISTS cess_rate,
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'deduction',
  ADD COLUMN IF NOT EXISTS global_cess_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS param_rules JSONB NOT NULL DEFAULT '[]';

ALTER TABLE inward_lots
  DROP COLUMN IF EXISTS moisture_pct,
  DROP COLUMN IF EXISTS fm_pct,
  DROP COLUMN IF EXISTS moisture_deduction,
  DROP COLUMN IF EXISTS fm_deduction,
  ADD COLUMN IF NOT EXISTS quality_readings JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS param_deductions JSONB NOT NULL DEFAULT '{}';
