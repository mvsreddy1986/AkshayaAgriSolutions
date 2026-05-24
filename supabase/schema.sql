-- Akshaya Agri Solutions ERP — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- After running, disable Row Level Security on each table OR add permissive policies.
-- Quick way to allow all for demo: ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;

-- ─── MATERIALS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materials (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  hsn                    TEXT NOT NULL DEFAULT '',
  uom                    TEXT NOT NULL DEFAULT 'MT',
  gst_rate               NUMERIC NOT NULL DEFAULT 0,
  category               TEXT NOT NULL DEFAULT 'Grain',
  default_gross_sale_rate NUMERIC NOT NULL DEFAULT 0,
  settlement_method      TEXT NOT NULL DEFAULT '',
  quality_params         TEXT[] NOT NULL DEFAULT '{}',
  status                 TEXT NOT NULL DEFAULT 'Draft',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;

-- ─── PARTIES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parties (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  party_type           TEXT NOT NULL DEFAULT 'Supplier',
  gstin                TEXT NOT NULL DEFAULT '',
  mobile               TEXT NOT NULL DEFAULT '',
  email                TEXT NOT NULL DEFAULT '',
  address              TEXT NOT NULL DEFAULT '',
  state                TEXT NOT NULL DEFAULT 'Andhra Pradesh',
  opening_balance      NUMERIC NOT NULL DEFAULT 0,
  credit_limit         NUMERIC NOT NULL DEFAULT 0,
  credit_days          INTEGER NOT NULL DEFAULT 0,
  business_flows       TEXT[] NOT NULL DEFAULT '{}',
  tax_profile          TEXT NOT NULL DEFAULT 'Registered',
  bank_account         TEXT NOT NULL DEFAULT '',
  ifsc                 TEXT NOT NULL DEFAULT '',
  bank_name            TEXT NOT NULL DEFAULT '',
  is_farmer_reference  BOOLEAN NOT NULL DEFAULT FALSE,
  status               TEXT NOT NULL DEFAULT 'Active',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parties DISABLE ROW LEVEL SECURITY;

-- ─── QUALITY RULES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_rules (
  id                         TEXT PRIMARY KEY,
  material_id                TEXT NOT NULL,
  material_name              TEXT NOT NULL,
  valid_from                 DATE NOT NULL,
  valid_to                   DATE,
  base_moisture              NUMERIC NOT NULL DEFAULT 14,
  moisture_deduction_method  TEXT NOT NULL DEFAULT 'linear',
  moisture_rate_per_pct      NUMERIC NOT NULL DEFAULT 0,
  fm_deduction_method        TEXT NOT NULL DEFAULT 'actual',
  fm_rate_per_pct            NUMERIC NOT NULL DEFAULT 1,
  cess_rate                  NUMERIC NOT NULL DEFAULT 0,
  allowed_variance_pct       NUMERIC NOT NULL DEFAULT 2,
  description                TEXT NOT NULL DEFAULT '',
  status                     TEXT NOT NULL DEFAULT 'Draft',
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE quality_rules DISABLE ROW LEVEL SECURITY;

-- ─── RATE MASTERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_masters (
  id            TEXT PRIMARY KEY,
  material_id   TEXT NOT NULL,
  material_name TEXT NOT NULL,
  party_id      TEXT,
  party_name    TEXT NOT NULL DEFAULT 'All',
  rate_type     TEXT NOT NULL,
  rate          NUMERIC NOT NULL DEFAULT 0,
  valid_from    DATE NOT NULL,
  valid_to      DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rate_masters DISABLE ROW LEVEL SECURITY;

-- ─── INWARD LOTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inward_lots (
  id                TEXT PRIMARY KEY,
  document_ref      TEXT NOT NULL DEFAULT '',
  business_model    TEXT NOT NULL DEFAULT 'A',
  lot_date          DATE NOT NULL,
  material_id       TEXT NOT NULL DEFAULT '',
  material_name     TEXT NOT NULL DEFAULT '',
  customer_id       TEXT NOT NULL DEFAULT '',
  customer_name     TEXT NOT NULL DEFAULT '',
  supplier_id       TEXT,
  supplier_name     TEXT,
  farmer_id         TEXT,
  farmer_name       TEXT,
  vehicle_no        TEXT NOT NULL DEFAULT '',
  gross_weight      NUMERIC NOT NULL DEFAULT 0,
  tare_weight       NUMERIC NOT NULL DEFAULT 0,
  net_weight        NUMERIC NOT NULL DEFAULT 0,
  accepted_weight   NUMERIC NOT NULL DEFAULT 0,
  moisture_pct      NUMERIC NOT NULL DEFAULT 0,
  fm_pct            NUMERIC NOT NULL DEFAULT 0,
  quality_rule_id   TEXT,
  moisture_deduction NUMERIC NOT NULL DEFAULT 0,
  fm_deduction      NUMERIC NOT NULL DEFAULT 0,
  cess_amount       NUMERIC NOT NULL DEFAULT 0,
  net_payable_weight NUMERIC NOT NULL DEFAULT 0,
  gross_sale_rate   NUMERIC NOT NULL DEFAULT 0,
  gross_sale_value  NUMERIC NOT NULL DEFAULT 0,
  import_batch_id   TEXT,
  invoice_id        TEXT,
  status            TEXT NOT NULL DEFAULT 'Draft',
  override_reason   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inward_lots DISABLE ROW LEVEL SECURITY;

-- ─── FARMER PAYOUTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_payouts (
  id             TEXT PRIMARY KEY,
  batch_ref      TEXT NOT NULL DEFAULT '',
  farmer_id      TEXT NOT NULL DEFAULT '',
  farmer_name    TEXT NOT NULL DEFAULT '',
  inward_lot_id  TEXT,
  document_ref   TEXT NOT NULL DEFAULT '',
  payout_date    DATE NOT NULL,
  material_name  TEXT NOT NULL DEFAULT '',
  quantity       NUMERIC NOT NULL DEFAULT 0,
  rate           NUMERIC NOT NULL DEFAULT 0,
  gross_amount   NUMERIC NOT NULL DEFAULT 0,
  deductions     NUMERIC NOT NULL DEFAULT 0,
  net_amount     NUMERIC NOT NULL DEFAULT 0,
  payment_mode   TEXT NOT NULL DEFAULT 'NEFT',
  payment_ref    TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE farmer_payouts DISABLE ROW LEVEL SECURITY;

-- ─── INVOICES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               TEXT PRIMARY KEY,
  invoice_no       TEXT NOT NULL DEFAULT '',
  invoice_type     TEXT NOT NULL DEFAULT 'Sales',
  business_model   TEXT NOT NULL DEFAULT 'A',
  invoice_date     DATE NOT NULL,
  due_date         DATE NOT NULL,
  party_id         TEXT NOT NULL DEFAULT '',
  party_name       TEXT NOT NULL DEFAULT '',
  material_id      TEXT,
  material_name    TEXT NOT NULL DEFAULT '',
  quantity         NUMERIC NOT NULL DEFAULT 0,
  uom              TEXT NOT NULL DEFAULT 'MT',
  gross_rate       NUMERIC NOT NULL DEFAULT 0,
  gross_value      NUMERIC NOT NULL DEFAULT 0,
  taxable_value    NUMERIC NOT NULL DEFAULT 0,
  cgst_rate        NUMERIC NOT NULL DEFAULT 0,
  sgst_rate        NUMERIC NOT NULL DEFAULT 0,
  igst_rate        NUMERIC NOT NULL DEFAULT 0,
  cgst_amount      NUMERIC NOT NULL DEFAULT 0,
  sgst_amount      NUMERIC NOT NULL DEFAULT 0,
  igst_amount      NUMERIC NOT NULL DEFAULT 0,
  total_tax        NUMERIC NOT NULL DEFAULT 0,
  total_value      NUMERIC NOT NULL DEFAULT 0,
  amount_paid      NUMERIC NOT NULL DEFAULT 0,
  amount_due       NUMERIC NOT NULL DEFAULT 0,
  linked_lot_ids   TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'Draft',
  cancelled_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- ─── VOUCHERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id           TEXT PRIMARY KEY,
  voucher_no   TEXT NOT NULL DEFAULT '',
  voucher_type TEXT NOT NULL DEFAULT 'Receipt',
  voucher_date DATE NOT NULL,
  party_id     TEXT NOT NULL DEFAULT '',
  party_name   TEXT NOT NULL DEFAULT '',
  amount       NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'NEFT',
  bank_ref     TEXT NOT NULL DEFAULT '',
  narration    TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'Draft',
  allocated_to TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vouchers DISABLE ROW LEVEL SECURITY;

-- ─── LEDGER ENTRIES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              TEXT PRIMARY KEY,
  entry_date      DATE NOT NULL,
  account_code    TEXT NOT NULL DEFAULT '',
  account_name    TEXT NOT NULL DEFAULT '',
  party_id        TEXT,
  party_name      TEXT,
  debit           NUMERIC NOT NULL DEFAULT 0,
  credit          NUMERIC NOT NULL DEFAULT 0,
  running_balance NUMERIC NOT NULL DEFAULT 0,
  narration       TEXT NOT NULL DEFAULT '',
  source_type     TEXT NOT NULL DEFAULT 'Journal',
  source_id       TEXT NOT NULL DEFAULT '',
  source_ref      TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;

-- ─── STOCK BATCHES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_batches (
  id              TEXT PRIMARY KEY,
  batch_ref       TEXT NOT NULL DEFAULT '',
  material_id     TEXT NOT NULL DEFAULT '',
  material_name   TEXT NOT NULL DEFAULT '',
  purchase_date   DATE NOT NULL,
  opening_qty     NUMERIC NOT NULL DEFAULT 0,
  sold_qty        NUMERIC NOT NULL DEFAULT 0,
  available_qty   NUMERIC NOT NULL DEFAULT 0,
  purchase_rate   NUMERIC NOT NULL DEFAULT 0,
  quality_status  TEXT NOT NULL DEFAULT 'Pending',
  quality_notes   TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stock_batches DISABLE ROW LEVEL SECURITY;

-- ─── IMPORT BATCHES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_batches (
  id              TEXT PRIMARY KEY,
  batch_ref       TEXT NOT NULL DEFAULT '',
  import_type     TEXT NOT NULL DEFAULT 'Excel',
  business_model  TEXT NOT NULL DEFAULT 'A',
  source_filename TEXT NOT NULL DEFAULT '',
  report_date     DATE NOT NULL,
  party_name      TEXT NOT NULL DEFAULT '',
  total_rows      INTEGER NOT NULL DEFAULT 0,
  mapped_rows     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'Pending',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE import_batches DISABLE ROW LEVEL SECURITY;

-- ─── APP USERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'Clerk',
  modules    TEXT[] NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'Clerk',
  action      TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_ref  TEXT NOT NULL DEFAULT '',
  details     TEXT NOT NULL DEFAULT ''
);
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
