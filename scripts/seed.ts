import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

// All other imports come AFTER dotenv has populated process.env
import { createClient } from "@supabase/supabase-js";
import {
  MATERIALS, PARTIES, QUALITY_RULES, RATE_MASTERS, INWARD_LOTS,
  FARMER_PAYOUTS, INVOICES, VOUCHERS, LEDGER_SARVANI, STOCK_BATCHES,
  IMPORT_BATCHES,
} from "../src/lib/data/seed";

// ── Client ────────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Inline mappers (camelCase → snake_case, avoids importing db.ts) ──────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const mat = (m: any) => ({ id: m.id, name: m.name, hsn: m.hsn, uom: m.uom, gst_rate: m.gstRate, category: m.category, default_gross_sale_rate: m.defaultGrossSaleRate, pricing_model: m.pricingModel, params: m.params, status: m.status });
const party = (p: any) => ({ id: p.id, name: p.name, party_type: p.partyType, gstin: p.gstin, mobile: p.mobile, email: p.email, address: p.address, state: p.state, opening_balance: p.openingBalance, credit_limit: p.creditLimit, credit_days: p.creditDays, business_flows: p.businessFlows, tax_profile: p.taxProfile, bank_account: p.bankAccount, ifsc: p.ifsc, bank_name: p.bankName, is_farmer_reference: p.isFarmerReference, status: p.status });
const qr = (q: any) => ({ id: q.id, material_id: q.materialId, material_name: q.materialName, pricing_model: q.pricingModel, valid_from: q.validFrom, valid_to: q.validTo ?? null, global_cess_rate: q.globalCessRate, allowed_variance_pct: q.allowedVariancePct, description: q.description, status: q.status, param_rules: q.paramRules });
const rate = (r: any) => ({ id: r.id, material_id: r.materialId, material_name: r.materialName, party_id: r.partyId ?? null, party_name: r.partyName, rate_type: r.rateType, rate: r.rate, valid_from: r.validFrom, valid_to: r.validTo ?? null });
const lot = (l: any) => ({ id: l.id, document_ref: l.documentRef, business_model: l.businessModel, lot_date: l.lotDate, material_id: l.materialId, material_name: l.materialName, customer_id: l.customerId, customer_name: l.customerName, supplier_id: l.supplierId ?? null, supplier_name: l.supplierName ?? null, farmer_id: l.farmerId ?? null, farmer_name: l.farmerName ?? null, vehicle_no: l.vehicleNo, gross_weight: l.grossWeight, tare_weight: l.tareWeight, net_weight: l.netWeight, accepted_weight: l.acceptedWeight, quality_readings: l.qualityReadings, quality_rule_id: l.qualityRuleId ?? null, param_deductions: l.paramDeductions, cess_amount: l.cessAmount, net_payable_weight: l.netPayableWeight, gross_sale_rate: l.grossSaleRate, gross_sale_value: l.grossSaleValue, import_batch_id: l.importBatchId ?? null, invoice_id: l.invoiceId ?? null, status: l.status, override_reason: l.overrideReason ?? null });
const payout = (p: any) => ({ id: p.id, batch_ref: p.batchRef, farmer_id: p.farmerId, farmer_name: p.farmerName, inward_lot_id: p.inwardLotId ?? null, document_ref: p.documentRef, payout_date: p.payoutDate, material_name: p.materialName, quantity: p.quantity, rate: p.rate, gross_amount: p.grossAmount, deductions: p.deductions, net_amount: p.netAmount, payment_mode: p.paymentMode, payment_ref: p.paymentRef, payment_status: p.paymentStatus });
const inv = (i: any) => ({ id: i.id, invoice_no: i.invoiceNo, invoice_type: i.invoiceType, business_model: i.businessModel, invoice_date: i.invoiceDate, due_date: i.dueDate, party_id: i.partyId, party_name: i.partyName, material_id: i.materialId ?? null, material_name: i.materialName, quantity: i.quantity, uom: i.uom, gross_rate: i.grossRate, gross_value: i.grossValue, taxable_value: i.taxableValue, cgst_rate: i.cgstRate, sgst_rate: i.sgstRate, igst_rate: i.igstRate, cgst_amount: i.cgstAmount, sgst_amount: i.sgstAmount, igst_amount: i.igstAmount, total_tax: i.totalTax, total_value: i.totalValue, amount_paid: i.amountPaid, amount_due: i.amountDue, linked_lot_ids: i.linkedLotIds, status: i.status, cancelled_reason: i.cancelledReason ?? null });
const voucher = (v: any) => ({ id: v.id, voucher_no: v.voucherNo, voucher_type: v.voucherType, voucher_date: v.voucherDate, party_id: v.partyId, party_name: v.partyName, amount: v.amount, payment_mode: v.paymentMode, bank_ref: v.bankRef, narration: v.narration, status: v.status, allocated_to: v.allocatedTo });
const ledger = (e: any) => ({ id: e.id, entry_date: e.entryDate, account_code: e.accountCode, account_name: e.accountName, party_id: e.partyId ?? null, party_name: e.partyName ?? null, debit: e.debit, credit: e.credit, running_balance: e.runningBalance, narration: e.narration, source_type: e.sourceType, source_id: e.sourceId, source_ref: e.sourceRef });
const stock = (s: any) => ({ id: s.id, batch_ref: s.batchRef, material_id: s.materialId, material_name: s.materialName, purchase_date: s.purchaseDate, opening_qty: s.openingQty, sold_qty: s.soldQty, available_qty: s.availableQty, purchase_rate: s.purchaseRate, quality_status: s.qualityStatus, quality_notes: s.qualityNotes });
const importBatch = (b: any) => ({ id: b.id, batch_ref: b.batchRef, import_type: b.importType, business_model: b.businessModel, source_filename: b.sourceFilename, report_date: b.reportDate, party_name: b.partyName, total_rows: b.totalRows, mapped_rows: b.mappedRows, status: b.status });
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Upsert ────────────────────────────────────────────────────────────────────

async function up(table: string, rows: Record<string, unknown>[]) {
  const { error } = await admin.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ✓  ${table.padEnd(16)} ${rows.length} rows`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding Supabase (service role)…\n");
  // FK-safe insertion order
  await up("materials",      MATERIALS.map(mat));
  await up("parties",        PARTIES.map(party));
  await up("import_batches", IMPORT_BATCHES.map(importBatch));
  await up("quality_rules",  QUALITY_RULES.map(qr));
  await up("rate_masters",   RATE_MASTERS.map(rate));
  await up("invoices",       INVOICES.map(inv));       // before inward_lots (invoice_id FK)
  await up("inward_lots",    INWARD_LOTS.map(lot));
  await up("farmer_payouts", FARMER_PAYOUTS.map(payout));
  await up("vouchers",       VOUCHERS.map(voucher));
  await up("ledger_entries", LEDGER_SARVANI.map(ledger));
  await up("stock_batches",  STOCK_BATCHES.map(stock));
  console.log("\nSeed complete.");
}

seed().catch((err) => { console.error("\nSeed failed:", err.message); process.exit(1); });
