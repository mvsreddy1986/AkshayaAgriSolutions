# Akshaya Agri Solutions ERP — Database Schema

PostgreSQL (Supabase). All tables include `created_at`, `updated_at`, `created_by` (UUID ref → users).

---

## Core Tables

### materials
```sql
CREATE TABLE materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  hsn         TEXT,
  uom         TEXT NOT NULL,           -- MT, KG, L, Bag
  gst_rate    NUMERIC(5,2) DEFAULT 0,
  category    TEXT,                    -- Grain, Biomass, Chemical, Byproduct, Fuel
  default_gross_sale_rate NUMERIC(12,2),
  settlement_method TEXT,
  quality_params TEXT[],               -- ['moisture','fm','starch']
  status      TEXT DEFAULT 'Active',   -- Active, Draft, Inactive
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  created_by  UUID
);
```

### parties
```sql
CREATE TABLE parties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  party_type    TEXT NOT NULL,          -- Customer, Supplier, Farmer, Trader, Both
  gstin         TEXT,
  mobile        TEXT,
  email         TEXT,
  address       TEXT,
  state         TEXT DEFAULT 'Andhra Pradesh',
  opening_balance NUMERIC(14,2) DEFAULT 0,
  credit_limit  NUMERIC(14,2) DEFAULT 0,
  credit_days   INTEGER DEFAULT 0,
  business_flows TEXT[],                -- ['A','B','C']
  tax_profile   TEXT DEFAULT 'Registered', -- Registered, Unregistered, Composition
  bank_account  TEXT,
  ifsc          TEXT,
  bank_name     TEXT,
  is_farmer_reference BOOLEAN DEFAULT false,
  status        TEXT DEFAULT 'Active',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID
);
```

### quality_rules
```sql
CREATE TABLE quality_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id           UUID REFERENCES materials(id),
  valid_from            DATE NOT NULL,
  valid_to              DATE,
  base_moisture         NUMERIC(5,2),
  moisture_deduction_method TEXT DEFAULT 'linear', -- linear, slab, none
  moisture_rate_per_pct NUMERIC(8,4),  -- deduction amount per 1% above base
  fm_deduction_method   TEXT DEFAULT 'actual',   -- actual, slab, none
  fm_rate_per_pct       NUMERIC(8,4),
  cess_rate             NUMERIC(5,2) DEFAULT 0,
  shortage_rate         NUMERIC(5,2) DEFAULT 0,
  allowed_variance_pct  NUMERIC(5,2) DEFAULT 2,
  description           TEXT,
  status                TEXT DEFAULT 'Active',    -- Active, Expired, Draft
  approved_by           UUID,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  created_by            UUID
);
```

### rate_masters
```sql
CREATE TABLE rate_masters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   UUID REFERENCES materials(id),
  party_id      UUID REFERENCES parties(id),  -- NULL = default for all
  rate_type     TEXT NOT NULL,               -- GrossSale, Purchase, Retail
  rate          NUMERIC(12,2) NOT NULL,
  valid_from    DATE NOT NULL,
  valid_to      DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID
);
```

---

## Transaction Tables

### import_batches
```sql
CREATE TABLE import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref       TEXT UNIQUE NOT NULL,       -- IMPORT-DDMMYYYY-001
  import_type     TEXT NOT NULL,              -- PDF, Excel
  business_model  TEXT NOT NULL,              -- A, B
  source_filename TEXT,
  source_url      TEXT,                       -- Supabase Storage URL
  report_date     DATE,
  party_id        UUID REFERENCES parties(id), -- Usually Sarvani
  total_rows      INTEGER DEFAULT 0,
  mapped_rows     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'Pending',     -- Pending, Draft, Mapped, Posted
  parse_log       JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID
);
```

### inward_lots
```sql
CREATE TABLE inward_lots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_ref        TEXT UNIQUE NOT NULL,   -- DR-12MAY-001
  business_model      TEXT NOT NULL,          -- A, B, C
  lot_date            DATE NOT NULL,
  material_id         UUID REFERENCES materials(id),
  customer_id         UUID REFERENCES parties(id),  -- Sarvani
  supplier_id         UUID REFERENCES parties(id),  -- Model A: local supplier
  farmer_id           UUID REFERENCES parties(id),  -- Model A: actual farmer
  vehicle_no          TEXT,
  driver_name         TEXT,
  gross_weight        NUMERIC(10,3),
  tare_weight         NUMERIC(10,3),
  net_weight          NUMERIC(10,3),
  accepted_weight     NUMERIC(10,3),
  moisture_pct        NUMERIC(5,2),
  fm_pct              NUMERIC(5,2),
  starch_pct          NUMERIC(5,2),
  quality_rule_id     UUID REFERENCES quality_rules(id),
  moisture_deduction  NUMERIC(10,3),
  fm_deduction        NUMERIC(10,3),
  cess_amount         NUMERIC(12,2),
  net_payable_weight  NUMERIC(10,3),
  gross_sale_rate     NUMERIC(12,2),
  gross_sale_value    NUMERIC(14,2),
  import_batch_id     UUID REFERENCES import_batches(id),
  invoice_id          UUID REFERENCES invoices(id),  -- set when invoiced
  settlement_id       UUID,
  status              TEXT DEFAULT 'Draft',
    -- Draft, Mapped, QualityHold, Approved, Settled, Invoiced
  override_reason     TEXT,
  override_by         UUID,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  created_by          UUID
);
```

### farmer_payouts
```sql
CREATE TABLE farmer_payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref       TEXT NOT NULL,              -- FP-090
  farmer_id       UUID REFERENCES parties(id),
  inward_lot_id   UUID REFERENCES inward_lots(id),
  payout_date     DATE,
  material_id     UUID REFERENCES materials(id),
  quantity        NUMERIC(10,3),
  rate            NUMERIC(12,2),
  gross_amount    NUMERIC(14,2),
  deductions      NUMERIC(14,2) DEFAULT 0,
  net_amount      NUMERIC(14,2),
  payment_mode    TEXT,
  payment_ref     TEXT,
  payment_status  TEXT DEFAULT 'Pending',   -- Pending, Approved, Paid
  approved_by     UUID,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID
);
```

### invoices
```sql
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no      TEXT UNIQUE NOT NULL,       -- AAS-2627-0122
  invoice_type    TEXT NOT NULL,              -- Sales, Purchase, DebitNote, CreditNote
  business_model  TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  due_date        DATE,
  party_id        UUID REFERENCES parties(id),   -- customer or supplier
  material_id     UUID REFERENCES materials(id),
  quantity        NUMERIC(12,3),
  uom             TEXT,
  gross_rate      NUMERIC(12,2),
  gross_value     NUMERIC(16,2),
  taxable_value   NUMERIC(16,2),
  cgst_rate       NUMERIC(5,2) DEFAULT 0,
  sgst_rate       NUMERIC(5,2) DEFAULT 0,
  igst_rate       NUMERIC(5,2) DEFAULT 0,
  cgst_amount     NUMERIC(14,2) DEFAULT 0,
  sgst_amount     NUMERIC(14,2) DEFAULT 0,
  igst_amount     NUMERIC(14,2) DEFAULT 0,
  total_tax       NUMERIC(14,2) DEFAULT 0,
  total_value     NUMERIC(16,2),
  amount_paid     NUMERIC(16,2) DEFAULT 0,
  amount_due      NUMERIC(16,2),
  original_invoice_id UUID REFERENCES invoices(id),  -- for CN/DN
  status          TEXT DEFAULT 'Draft',
    -- Draft, Approved, Sent, Partial, Paid, Cancelled
  cancelled_reason TEXT,
  cancelled_by    UUID,
  cancelled_at    TIMESTAMPTZ,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ
);
```

### invoice_lots (junction)
```sql
CREATE TABLE invoice_lots (
  invoice_id    UUID REFERENCES invoices(id),
  lot_id        UUID REFERENCES inward_lots(id),
  PRIMARY KEY (invoice_id, lot_id)
);
```

### vouchers (payments and receipts)
```sql
CREATE TABLE vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no      TEXT UNIQUE NOT NULL,   -- RV-2627-0045, PV-2627-0078
  voucher_type    TEXT NOT NULL,          -- Receipt, Payment
  voucher_date    DATE NOT NULL,
  party_id        UUID REFERENCES parties(id),
  amount          NUMERIC(16,2) NOT NULL,
  payment_mode    TEXT,                   -- NEFT, RTGS, IMPS, Cheque, Cash, UPI
  bank_ref        TEXT,
  bank_account    TEXT,
  narration       TEXT,
  status          TEXT DEFAULT 'Draft',   -- Draft, Posted, Cleared, Bounced
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID,
  approved_by     UUID
);
```

### voucher_allocations (which invoices a payment covers)
```sql
CREATE TABLE voucher_allocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id    UUID REFERENCES vouchers(id),
  invoice_id    UUID REFERENCES invoices(id),
  amount        NUMERIC(16,2) NOT NULL
);
```

### ledger_entries
```sql
CREATE TABLE ledger_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date    DATE NOT NULL,
  account_code  TEXT NOT NULL,
  account_name  TEXT NOT NULL,
  party_id      UUID REFERENCES parties(id),
  debit         NUMERIC(16,2) DEFAULT 0,
  credit        NUMERIC(16,2) DEFAULT 0,
  running_balance NUMERIC(16,2),
  narration     TEXT,
  source_type   TEXT,    -- Invoice, Voucher, Journal, Settlement
  source_id     UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID
);
```

### stock_batches (Model C)
```sql
CREATE TABLE stock_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref       TEXT UNIQUE NOT NULL,   -- DDGS-MAY-01
  material_id     UUID REFERENCES materials(id),
  purchase_invoice_id UUID REFERENCES invoices(id),
  purchase_date   DATE,
  opening_qty     NUMERIC(12,3),
  sold_qty        NUMERIC(12,3) DEFAULT 0,
  available_qty   NUMERIC(12,3),
  purchase_rate   NUMERIC(12,2),
  quality_status  TEXT DEFAULT 'Pending', -- Pending, Approved, Rejected
  quality_notes   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## Auth & Admin Tables

### users
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY,          -- Supabase Auth UID
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL,             -- Admin, Manager, Clerk
  modules     TEXT[],
  status      TEXT DEFAULT 'Active',
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_at     TIMESTAMPTZ DEFAULT now(),
  user_id       UUID REFERENCES users(id),
  user_name     TEXT,
  action        TEXT NOT NULL,           -- CREATE, UPDATE, DELETE, APPROVE, CANCEL
  entity_type   TEXT NOT NULL,
  entity_id     UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT
);
```

---

## Key Indexes

```sql
CREATE INDEX ON inward_lots(lot_date);
CREATE INDEX ON inward_lots(customer_id);
CREATE INDEX ON inward_lots(supplier_id);
CREATE INDEX ON inward_lots(status);
CREATE INDEX ON invoices(party_id);
CREATE INDEX ON invoices(invoice_date);
CREATE INDEX ON invoices(status);
CREATE INDEX ON ledger_entries(party_id, entry_date);
CREATE INDEX ON audit_logs(entity_type, entity_id);
CREATE INDEX ON quality_rules(material_id, valid_from, valid_to);
```

---

## Row-Level Security (Supabase)

```sql
-- Only authenticated users access any table
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read" ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write" ON materials FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Manager'));

-- Ledger entries: read for all authenticated, insert via server functions only
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read" ON ledger_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "service role insert" ON ledger_entries FOR INSERT TO service_role USING (true);
```
