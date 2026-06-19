-- Migration 003: Add akshaya_margin_per_mt to inward_lots
-- Akshaya earns ₹50/MT (₹5/quintal) as service margin, editable per lot.

ALTER TABLE inward_lots
  ADD COLUMN IF NOT EXISTS akshaya_margin_per_mt NUMERIC NOT NULL DEFAULT 50;
