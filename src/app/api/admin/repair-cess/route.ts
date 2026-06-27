import { NextRequest, NextResponse } from "next/server";
import { getLot, listQualityRules, listMaterials } from "../../../../lib/db";
import { calculateLotSettlement, paramQualityAccount } from "../../../../lib/settlement/engine";
import { supabase } from "../../../../lib/supabase/client";

function r2(n: number) { return Math.round(n * 100) / 100; }

/**
 * GET /api/admin/repair-cess?ref=2627000472
 *
 * Full settlement audit + repair for a single lot.
 *
 * Fixes three classes of Path A legacy bugs:
 *
 *  1. Orphan CESS gate-payment entries when lot.cessAmount = 0.
 *     (Deletes Dr 5101 / Cr 1100 CESS-{ref} rows)
 *
 *  2. Wrong Dr 3100 quality credit note — Path A used to Dr Sales instead
 *     of the individual quality accounts, leaving 41XX with an unmatched Cr.
 *     (Deletes the Dr 3100 SETTLE-{ref} row)
 *
 *  3. Missing Dr 41XX quality entries on customer side.
 *     (Inserts Dr per quality account matching the settlement engine calc)
 *
 * Safe to call multiple times — each fix is idempotent.
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Pass ?ref=<documentRef>" }, { status: 400 });
  }

  try {
    // 1 — Load lot
    const { data: lotRows, error: lotErr } = await supabase
      .from("inward_lots")
      .select("id")
      .eq("document_ref", ref)
      .limit(1);
    if (lotErr || !lotRows?.length) {
      return NextResponse.json({ error: `Lot not found: ${ref}` }, { status: 404 });
    }
    const lot = await getLot(lotRows[0].id);

    // 2 — Engine
    const [rules, materials] = await Promise.all([listQualityRules(), listMaterials()]);
    const material = materials.find((m) => m.id === lot.materialId);
    const rule =
      rules.find((r) => r.id === lot.qualityRuleId) ??
      rules.find((r) => r.materialId === lot.materialId && r.status === "Active");
    if (!rule) {
      return NextResponse.json({ error: "No quality rule — cannot compute expected values" }, { status: 400 });
    }
    const calc = calculateLotSettlement(lot, rule, material?.cessRate);

    const settleRef = `SETTLE-${ref}`;
    const cessRef   = `CESS-${ref}`;
    const today = new Date().toISOString().slice(0, 10);

    // 3 — Fetch all existing ledger entries for this lot's refs
    const { data: allEntries } = await supabase
      .from("ledger_entries")
      .select("id, account_code, narration, debit, credit, source_ref")
      .in("source_ref", [settleRef, cessRef]);
    const rows = allEntries ?? [];

    const actions: string[] = [];

    // ── FIX 1: Orphan CESS gate-payment entries ─────────────────────────────
    // If lot.cessAmount = 0, no cess was paid at the gate.
    // Any CESS-{ref} ledger entries are erroneous and must be deleted.
    if (lot.cessAmount <= 0) {
      const cessIds = rows
        .filter((r) => r.source_ref === cessRef)
        .map((r) => r.id);
      if (cessIds.length > 0) {
        const { error: delErr } = await supabase
          .from("ledger_entries")
          .delete()
          .in("id", cessIds);
        if (delErr) throw new Error(`FIX1 delete failed: ${delErr.message}`);
        actions.push(`FIX1: Deleted ${cessIds.length} orphan CESS gate-payment entr${cessIds.length === 1 ? "y" : "ies"} (lot.cessAmount = 0)`);
      } else {
        actions.push("FIX1: No orphan CESS entries — OK");
      }
    } else {
      actions.push(`FIX1: lot.cessAmount = ${lot.cessAmount} (gate payment expected) — skip`);
    }

    // ── FIX 2: Remove wrong Dr 3100 quality credit note ─────────────────────
    // Old Path A posted Dr 3100 for quality. New design posts Dr 41XX per param.
    // Detect by: source_ref = SETTLE-{ref} AND account_code = "3100" AND debit > 0
    const bad3100 = rows.filter(
      (r) => r.source_ref === settleRef && r.account_code === "3100" && (r.debit ?? 0) > 0,
    );
    if (bad3100.length > 0) {
      const { error: delErr } = await supabase
        .from("ledger_entries")
        .delete()
        .in("id", bad3100.map((r) => r.id));
      if (delErr) throw new Error(`FIX2 delete failed: ${delErr.message}`);
      const total = r2(bad3100.reduce((s, r) => s + (r.debit ?? 0), 0));
      actions.push(`FIX2: Deleted Dr 3100 quality credit note (₹${total}) from SETTLE-${ref}`);
    } else {
      actions.push("FIX2: No wrong Dr 3100 quality entry — OK");
    }

    // ── FIX 3: Insert missing Dr 41XX quality entries ────────────────────────
    // Check which quality accounts already have a Dr entry in SETTLE-{ref}.
    // Only insert what's missing.
    const existing41XX = new Set(
      rows
        .filter((r) => r.source_ref === settleRef && r.account_code?.startsWith("41") && (r.debit ?? 0) > 0)
        .map((r) => r.account_code),
    );

    const insertRows: {
      id: string; entry_date: string; account_code: string; account_name: string;
      party_id: null; party_name: null; debit: number; credit: number;
      running_balance: number; narration: string; source_type: string;
      source_id: string; source_ref: string;
    }[] = [];
    let rowIdx = 0;

    for (const c of calc.paramCalcs) {
      if (c.valueDeduction <= 0 || c.rejectTrigger || c.weightDeductionKg === 0) continue;
      const qa = paramQualityAccount(c.paramKey);
      if (existing41XX.has(qa.code)) continue;
      insertRows.push({
        id: `le-repair-${Date.now()}-${rowIdx++}`,
        entry_date: today,
        account_code: qa.code,
        account_name: qa.name,
        party_id: null,
        party_name: null,
        debit: r2(c.valueDeduction),
        credit: 0,
        running_balance: 0,
        narration: `${c.label} ${typeof c.reading === "number" ? c.reading + "%" : c.reading} — Challan ${ref}`,
        source_type: "Settlement",
        source_id: lot.id,
        source_ref: settleRef,
      });
    }

    if (insertRows.length > 0) {
      const { error: insErr } = await supabase.from("ledger_entries").insert(insertRows);
      if (insErr) throw new Error(`FIX3 insert failed: ${insErr.message}`);
      const total = r2(insertRows.reduce((s, r) => s + r.debit, 0));
      actions.push(`FIX3: Inserted ${insertRows.length} Dr 41XX quality entr${insertRows.length === 1 ? "y" : "ies"} (total ₹${total}) into SETTLE-${ref}`);
    } else {
      actions.push("FIX3: Dr 41XX quality entries already present — OK");
    }

    // ── Final 5101 audit ─────────────────────────────────────────────────────
    const { data: final5101 } = await supabase
      .from("ledger_entries")
      .select("debit, credit, source_ref")
      .eq("account_code", "5101")
      .in("source_ref", [settleRef, cessRef]);
    const f = final5101 ?? [];
    const dr5101 = r2(f.reduce((s, r) => s + (r.debit ?? 0), 0));
    const cr5101 = r2(f.reduce((s, r) => s + (r.credit ?? 0), 0));
    const net5101 = r2(dr5101 - cr5101);

    return NextResponse.json({
      lot: { id: lot.id, documentRef: lot.documentRef, cessAmount: lot.cessAmount, status: lot.status },
      engine: { cessTotal: r2(calc.cessTotal), cessPaid: r2(calc.cessPaid ?? 0), cessBalance: r2(calc.cessBalance) },
      actions,
      final5101: { dr: dr5101, cr: cr5101, net: net5101, balanced: Math.abs(net5101) < 0.01 },
      status: "DONE",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
