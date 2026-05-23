-- ─── Akshaya Agri Solutions — Supabase Schema ───────────────────────────────
-- Run this entire file in Supabase > SQL Editor > New query > Run

create table if not exists materials (
  id text primary key,
  name text not null,
  hsn text not null,
  uom text not null,
  gst_rate numeric not null default 0,
  category text not null,
  default_gross_sale_rate numeric not null default 0,
  settlement_method text not null,
  quality_params text[] not null default '{}',
  status text not null default 'Draft',
  created_at timestamptz not null default now()
);

create table if not exists parties (
  id text primary key,
  name text not null,
  party_type text not null,
  gstin text,
  mobile text,
  email text,
  address text,
  state text,
  opening_balance numeric default 0,
  credit_limit numeric default 0,
  credit_days integer default 0,
  business_flows text[] default '{}',
  tax_profile text not null default 'Unregistered',
  bank_account text,
  ifsc text,
  bank_name text,
  is_farmer_reference boolean default false,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists quality_rules (
  id text primary key,
  material_id text references materials(id),
  material_name text not null,
  valid_from date not null,
  valid_to date,
  base_moisture numeric not null default 14,
  moisture_deduction_method text not null default 'linear',
  moisture_rate_per_pct numeric not null default 0,
  fm_deduction_method text not null default 'actual',
  fm_rate_per_pct numeric not null default 0,
  cess_rate numeric not null default 0,
  allowed_variance_pct numeric not null default 2,
  description text,
  status text not null default 'Draft',
  created_at timestamptz not null default now()
);

create table if not exists rate_masters (
  id text primary key,
  material_id text references materials(id),
  material_name text not null,
  party_id text references parties(id),
  party_name text not null,
  rate_type text not null,
  rate numeric not null,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now()
);

create table if not exists import_batches (
  id text primary key,
  batch_ref text not null,
  import_type text not null,
  business_model text not null,
  source_filename text not null,
  report_date date not null,
  party_name text not null,
  total_rows integer not null default 0,
  mapped_rows integer not null default 0,
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists inward_lots (
  id text primary key,
  document_ref text not null,
  business_model text not null,
  lot_date date not null,
  material_id text references materials(id),
  material_name text not null,
  customer_id text references parties(id),
  customer_name text not null,
  supplier_id text references parties(id),
  supplier_name text,
  farmer_id text references parties(id),
  farmer_name text,
  vehicle_no text not null,
  gross_weight numeric not null default 0,
  tare_weight numeric not null default 0,
  net_weight numeric not null default 0,
  accepted_weight numeric not null default 0,
  moisture_pct numeric not null default 0,
  fm_pct numeric not null default 0,
  quality_rule_id text references quality_rules(id),
  moisture_deduction numeric not null default 0,
  fm_deduction numeric not null default 0,
  cess_amount numeric not null default 0,
  net_payable_weight numeric not null default 0,
  gross_sale_rate numeric not null default 0,
  gross_sale_value numeric not null default 0,
  import_batch_id text references import_batches(id),
  invoice_id text,
  status text not null default 'Draft',
  override_reason text,
  created_at timestamptz not null default now()
);

create table if not exists farmer_payouts (
  id text primary key,
  batch_ref text not null,
  farmer_id text references parties(id),
  farmer_name text not null,
  inward_lot_id text references inward_lots(id),
  document_ref text not null,
  payout_date date not null,
  material_name text not null,
  quantity numeric not null,
  rate numeric not null,
  gross_amount numeric not null,
  deductions numeric not null default 0,
  net_amount numeric not null,
  payment_mode text,
  payment_ref text,
  payment_status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id text primary key,
  invoice_no text not null unique,
  invoice_type text not null,
  business_model text not null,
  invoice_date date not null,
  due_date date not null,
  party_id text references parties(id),
  party_name text not null,
  material_id text references materials(id),
  material_name text not null,
  quantity numeric not null,
  uom text not null,
  gross_rate numeric not null,
  gross_value numeric not null,
  taxable_value numeric not null,
  cgst_rate numeric not null default 0,
  sgst_rate numeric not null default 0,
  igst_rate numeric not null default 0,
  cgst_amount numeric not null default 0,
  sgst_amount numeric not null default 0,
  igst_amount numeric not null default 0,
  total_tax numeric not null default 0,
  total_value numeric not null,
  amount_paid numeric not null default 0,
  amount_due numeric not null,
  linked_lot_ids text[] default '{}',
  status text not null default 'Draft',
  cancelled_reason text,
  created_at timestamptz not null default now()
);

create table if not exists vouchers (
  id text primary key,
  voucher_no text not null unique,
  voucher_type text not null,
  voucher_date date not null,
  party_id text references parties(id),
  party_name text not null,
  amount numeric not null,
  payment_mode text,
  bank_ref text,
  narration text,
  status text not null default 'Draft',
  allocated_to text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id text primary key,
  entry_date date not null,
  account_code text not null,
  account_name text not null,
  party_id text references parties(id),
  party_name text,
  debit numeric not null default 0,
  credit numeric not null default 0,
  running_balance numeric not null default 0,
  narration text,
  source_type text not null,
  source_id text not null,
  source_ref text not null,
  created_at timestamptz not null default now()
);

create table if not exists stock_batches (
  id text primary key,
  batch_ref text not null,
  material_id text references materials(id),
  material_name text not null,
  purchase_date date not null,
  opening_qty numeric not null,
  sold_qty numeric not null default 0,
  available_qty numeric not null,
  purchase_rate numeric not null,
  quality_status text not null default 'Pending',
  quality_notes text,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (open for now — tighten when auth is live)
alter table materials enable row level security;
alter table parties enable row level security;
alter table quality_rules enable row level security;
alter table rate_masters enable row level security;
alter table import_batches enable row level security;
alter table inward_lots enable row level security;
alter table farmer_payouts enable row level security;
alter table invoices enable row level security;
alter table vouchers enable row level security;
alter table ledger_entries enable row level security;
alter table stock_batches enable row level security;

-- Allow anon read+write for all tables (replace with role-based policies later)
create policy "allow_all_materials"      on materials      for all using (true) with check (true);
create policy "allow_all_parties"        on parties        for all using (true) with check (true);
create policy "allow_all_quality_rules"  on quality_rules  for all using (true) with check (true);
create policy "allow_all_rate_masters"   on rate_masters   for all using (true) with check (true);
create policy "allow_all_import_batches" on import_batches for all using (true) with check (true);
create policy "allow_all_inward_lots"    on inward_lots    for all using (true) with check (true);
create policy "allow_all_farmer_payouts" on farmer_payouts for all using (true) with check (true);
create policy "allow_all_invoices"       on invoices       for all using (true) with check (true);
create policy "allow_all_vouchers"       on vouchers       for all using (true) with check (true);
create policy "allow_all_ledger_entries" on ledger_entries for all using (true) with check (true);
create policy "allow_all_stock_batches"  on stock_batches  for all using (true) with check (true);
