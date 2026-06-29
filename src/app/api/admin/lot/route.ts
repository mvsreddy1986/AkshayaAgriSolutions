import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase/client";
import { deleteLot, updateLot } from "../../../../lib/db";
import { errMsg } from "../../../../lib/utils";

export const dynamic = "force-dynamic";

// GET /api/admin/lot          → list of all lots (for browsing)
// GET /api/admin/lot?id=xxx   → full details for one lot (ledger entries, payouts, invoices)
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")?.trim();

    // Single lot full detail
    if (id) {
      const { data: lot, error: lotErr } = await supabase
        .from("inward_lots")
        .select("*")
        .eq("id", id)
        .single();
      if (lotErr || !lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

      const settleRef = `SETTLE-${lot.document_ref}`;
      const [{ data: ledgerById }, { data: ledgerByRef }, { data: payoutsById }, { data: payoutsByRef }, { data: invoices }] = await Promise.all([
        supabase.from("ledger_entries").select("*").eq("source_id", lot.id).order("entry_date"),
        supabase.from("ledger_entries").select("*").eq("source_ref", settleRef).order("entry_date"),
        supabase.from("farmer_payouts").select("*").eq("inward_lot_id", lot.id),
        supabase.from("farmer_payouts").select("*").eq("document_ref", lot.document_ref),
        supabase.from("invoices").select("id, invoice_no, status, amount_due").contains("linked_lot_ids", [lot.id]),
      ]);

      // Deduplicate ledger rows by id
      const ledgerMap = new Map<string, unknown>();
      for (const e of [...(ledgerById ?? []), ...(ledgerByRef ?? [])]) {
        ledgerMap.set((e as { id: string }).id, e);
      }
      const ledger = [...ledgerMap.values()];

      // Deduplicate payouts by id
      const payoutMap = new Map<string, unknown>();
      for (const p of [...(payoutsById ?? []), ...(payoutsByRef ?? [])]) {
        payoutMap.set((p as { id: string }).id, p);
      }
      const payouts = [...payoutMap.values()];

      return NextResponse.json({ lot, ledger: ledger ?? [], payouts: payouts ?? [], invoices: invoices ?? [] });
    }

    // List all lots
    const { data: lots, error } = await supabase
      .from("inward_lots")
      .select("id, document_ref, status, lot_date, supplier_name, vehicle_no, net_weight, gross_sale_value, business_model")
      .eq("business_model", "A")
      .order("lot_date", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ lots: lots ?? [] });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

// DELETE /api/admin/lot?ref=PO-2025-001&mode=full|settlement
//   full       — deletes lot + all ledger entries + payouts (for re-import)
//   settlement — deletes only ledger entries + payouts, resets lot to Draft (for re-settling)
export async function DELETE(req: NextRequest) {
  try {
    const ref  = req.nextUrl.searchParams.get("ref")?.trim();
    const mode = (req.nextUrl.searchParams.get("mode") ?? "settlement") as "full" | "settlement";

    if (!ref) return NextResponse.json({ error: "ref is required" }, { status: 400 });

    const { data: lot } = await supabase
      .from("inward_lots")
      .select("id, document_ref, status")
      .eq("document_ref", ref)
      .single();

    if (!lot) return NextResponse.json({ error: `No lot found with PO number "${ref}"` }, { status: 404 });

    if (mode === "full") {
      // Full delete: lot + ledger entries + payouts + invoice unlinking (uses existing db function)
      await deleteLot(lot.id);

      // Sweep by source_ref in case some entries had a mismatched source_id
      const settleRefFull = `SETTLE-${ref}`;
      await supabase.from("ledger_entries").delete().eq("source_ref", settleRefFull);
      await supabase.from("farmer_payouts").delete().eq("document_ref", ref);

      return NextResponse.json({
        deleted: "full",
        ref,
        message: `Lot ${ref} and all associated data deleted. You can now re-import this PO.`,
      });
    }

    // Settlement-only delete: remove ledger entries and payouts, reset lot to Draft.
    // Delete by BOTH source_id (lot UUID) and source_ref (SETTLE-{ref}) to catch entries
    // from different import sessions where source_id may differ.
    const settleRef = `SETTLE-${ref}`;

    const { error: le1Err } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("source_id", lot.id);
    if (le1Err) throw le1Err;

    const { error: le2Err } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("source_ref", settleRef);
    if (le2Err) throw le2Err;

    const { error: payErr } = await supabase
      .from("farmer_payouts")
      .delete()
      .eq("inward_lot_id", lot.id);
    if (payErr) throw payErr;

    // Also clear by document_ref in case inward_lot_id wasn't set
    const { error: pay2Err } = await supabase
      .from("farmer_payouts")
      .delete()
      .eq("document_ref", ref);
    if (pay2Err) throw pay2Err;

    await updateLot(lot.id, { status: "Draft" });

    return NextResponse.json({
      deleted: "settlement",
      ref,
      message: `Settlement entries for ${ref} cleared. Lot reset to Draft — you can now re-settle.`,
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
