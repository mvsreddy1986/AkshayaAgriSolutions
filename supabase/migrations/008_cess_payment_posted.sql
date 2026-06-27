-- Migration 008: Add cess_payment_posted flag to inward_lots
-- Records whether the Dr 5101 / Cr 1100 gate cess bank entry has been posted.
-- Defaults to false so existing settled lots surface in the pending gate cess queue.

ALTER TABLE inward_lots
  ADD COLUMN IF NOT EXISTS cess_payment_posted BOOLEAN NOT NULL DEFAULT FALSE;
