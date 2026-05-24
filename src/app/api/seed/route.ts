import { NextResponse } from "next/server";
import {
  upsertMaterials, upsertParties, upsertQualityRules, upsertRates,
  upsertLots, upsertPayouts, upsertInvoices, upsertVouchers, upsertStock,
} from "../../../lib/db";
import { supabase } from "../../../lib/supabase/client";
import {
  MATERIALS, PARTIES, QUALITY_RULES, RATE_MASTERS,
  INWARD_LOTS, FARMER_PAYOUTS, INVOICES, VOUCHERS, STOCK_BATCHES,
  LEDGER_SARVANI, IMPORT_BATCHES, USERS,
} from "../../../lib/data/seed";

export async function POST() {
  const results: Record<string, string> = {};

  try {
    // Seed in dependency order: masters first, then transactions
    const r1 = await upsertMaterials(MATERIALS);
    results.materials = r1.error ? `ERROR: ${r1.error.message}` : `${MATERIALS.length} upserted`;

    const r2 = await upsertParties(PARTIES);
    results.parties = r2.error ? `ERROR: ${r2.error.message}` : `${PARTIES.length} upserted`;

    const r3 = await upsertQualityRules(QUALITY_RULES);
    results.quality_rules = r3.error ? `ERROR: ${r3.error.message}` : `${QUALITY_RULES.length} upserted`;

    const r4 = await upsertRates(RATE_MASTERS);
    results.rate_masters = r4.error ? `ERROR: ${r4.error.message}` : `${RATE_MASTERS.length} upserted`;

    const r5 = await upsertLots(INWARD_LOTS);
    results.inward_lots = r5.error ? `ERROR: ${r5.error.message}` : `${INWARD_LOTS.length} upserted`;

    const r6 = await upsertPayouts(FARMER_PAYOUTS);
    results.farmer_payouts = r6.error ? `ERROR: ${r6.error.message}` : `${FARMER_PAYOUTS.length} upserted`;

    const r7 = await upsertInvoices(INVOICES);
    results.invoices = r7.error ? `ERROR: ${r7.error.message}` : `${INVOICES.length} upserted`;

    const r8 = await upsertVouchers(VOUCHERS);
    results.vouchers = r8.error ? `ERROR: ${r8.error.message}` : `${VOUCHERS.length} upserted`;

    const r9 = await upsertStock(STOCK_BATCHES);
    results.stock_batches = r9.error ? `ERROR: ${r9.error.message}` : `${STOCK_BATCHES.length} upserted`;

    // Ledger entries
    const ledgerRows = LEDGER_SARVANI.map((e) => ({
      id: e.id, entry_date: e.entryDate, account_code: e.accountCode, account_name: e.accountName,
      party_id: e.partyId ?? null, party_name: e.partyName ?? null,
      debit: e.debit, credit: e.credit, running_balance: e.runningBalance,
      narration: e.narration, source_type: e.sourceType, source_id: e.sourceId, source_ref: e.sourceRef,
    }));
    const r10 = await supabase.from("ledger_entries").upsert(ledgerRows, { onConflict: "id" });
    results.ledger_entries = r10.error ? `ERROR: ${r10.error.message}` : `${ledgerRows.length} upserted`;

    // Import batches
    const impRows = IMPORT_BATCHES.map((b) => ({
      id: b.id, batch_ref: b.batchRef, import_type: b.importType, business_model: b.businessModel,
      source_filename: b.sourceFilename, report_date: b.reportDate, party_name: b.partyName,
      total_rows: b.totalRows, mapped_rows: b.mappedRows, status: b.status,
    }));
    const r11 = await supabase.from("import_batches").upsert(impRows, { onConflict: "id" });
    results.import_batches = r11.error ? `ERROR: ${r11.error.message}` : `${impRows.length} upserted`;

    // App users
    const userRows = USERS.map((u) => ({
      id: u.id, name: u.name, email: u.email, role: u.role, modules: u.modules, status: u.status,
    }));
    const r12 = await supabase.from("app_users").upsert(userRows, { onConflict: "id" });
    results.app_users = r12.error ? `ERROR: ${r12.error.message}` : `${userRows.length} upserted`;

    const hasError = Object.values(results).some((v) => v.startsWith("ERROR"));
    return NextResponse.json({ success: !hasError, results }, { status: hasError ? 207 : 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
