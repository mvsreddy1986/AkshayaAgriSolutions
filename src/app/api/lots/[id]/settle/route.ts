import { NextRequest, NextResponse } from "next/server";
import { getLot, listQualityRules, listMaterials, updateLot, createLedgerEntries } from "../../../../../lib/db";
import { calculateLotSettlement, paramQualityAccount } from "../../../../../lib/settlement/engine";
import type { LedgerEntry } from "../../../../../lib/types";

type Ctx = { params: Promise<{ id: string }> };

function r2(n: number) { return Math.round(n * 100) / 100; }
function errMsg(e: unknown) { return e instanceof Error ? e.message : JSON.stringify(e); }

/**
 * POST /api/lots/[id]/settle
 *
 * Posts BOTH customer-side and supplier-side (Model A) ledger entries and marks lot Settled.
 *
 * ── CUSTOMER SIDE ─────────────────────────────────────────────────────────────
 *   Dr 1201  Sarvani Receivable        grossSaleValue − cessBalance
 *   Dr 5101  Market Cess — Balance     cessBalance  (if > 0)
 *   Dr 41XX  Quality Loss per param    c.valueDeduction (weight-based, non-reject)
 *   Cr 3100  Sales — Commodity         grossNotional (netWeight × rate)
 *
 *   Proof: (grossSaleValue−cessBalance) + cessBalance + ∑quality = grossNotional  ✓
 *
 * ── SUPPLIER SIDE (Model A only) ──────────────────────────────────────────────
 *   Dr 5001  Procurement — Commodity   grossNotional
 *   Cr 4101… Quality Loss per param    c.valueDeduction (offsets customer Dr; nets to zero)
 *   Cr 5101  Market Cess               cessTotal (gate-paid + balance; offsets Dr cessBalance + future gate entry)
 *   Cr 3200  Akshaya Trading Margin    akshayaMarginPerMT × netWeight
 *   Cr 4199  Quality Hold Penalty      holdPenalty (if any)
 *   Cr 2101  Supplier Payable          grossSaleValue − cessTotal − margin − holdPenalty
 *
 *   Proof: grossNotional = qualityDeductions + cessTotal + margin + holdPenalty + supplierPayable  ✓
 *
 * ── P&L IMPACT ────────────────────────────────────────────────────────────────
 *   3100 Cr = 5001 Dr = grossNotional (commodity trading nets to zero)
 *   41XX Dr + 41XX Cr = 0 (quality deductions pass through to supplier)
 *   5101 Dr cessBalance + 5101 Cr cessTotal → net Cr cessPaid (clears when gate payment posted)
 *   Net income = Cr 3200 Akshaya Margin only  ✓
 *
 * Model B lots skip the supplier-side block — farmer payment is handled via the
 * Finance > Farmer Bills / Payments flow separately.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    // 1 — Fetch lot and validate
    const lot = await getLot(id);
    if (lot.status !== "Approved") {
      return NextResponse.json(
        { error: `Lot must be Approved before posting settlement. Current status: ${lot.status}` },
        { status: 400 },
      );
    }

    // 2 — Resolve quality rule and material
    const [rules, materials] = await Promise.all([listQualityRules(), listMaterials()]);
    const material = materials.find((m) => m.id === lot.materialId);
    const rule =
      rules.find((r) => r.id === lot.qualityRuleId) ??
      rules.find((r) => r.materialId === lot.materialId && r.status === "Active");

    if (!rule) {
      return NextResponse.json(
        { error: "No active quality rule found for this lot. Attach a quality rule and re-approve." },
        { status: 400 },
      );
    }

    // 3 — Run settlement engine
    const calc = calculateLotSettlement(lot, rule, material?.cessRate);
    if (calc.hasRejectTrigger) {
      return NextResponse.json(
        { error: "Lot has an unresolved quality reject trigger — override via Accept Lot before settling." },
        { status: 400 },
      );
    }

    // 4 — Shared values
    const grossNotional     = r2(lot.netWeight * calc.grossSaleRate);
    const customerReceivable = r2(calc.grossSaleValue - calc.cessBalance);
    const spMargin          = r2(lot.akshayaMarginPerMT * lot.netWeight);
    const holdPenalty       = r2(lot.holdPenalty ?? 0);
    const supplierPayable   = r2(calc.grossSaleValue - calc.cessBalance - spMargin - holdPenalty);
    const today             = new Date().toISOString().slice(0, 10);
    const ref               = `SETTLE-${lot.documentRef}`;

    const entries: Omit<LedgerEntry, "id">[] = [];

    const mk = (
      accountCode: string, accountName: string,
      debit: number, credit: number, narration: string,
      partyId: string | null = null, partyName: string | null = null,
    ): Omit<LedgerEntry, "id"> => ({
      entryDate: today, accountCode, accountName,
      partyId, partyName,
      debit, credit, runningBalance: 0,
      narration,
      sourceType: "Settlement", sourceId: lot.id, sourceRef: ref,
    });

    // ── CUSTOMER SIDE ──────────────────────────────────────────────────────────

    entries.push(mk(
      "1201", "Sarvani Biofuels Receivable",
      customerReceivable, 0,
      `Settlement ${lot.documentRef} — ${lot.lotDate} · ${lot.netWeight.toFixed(3)} MT ${lot.materialName}`,
      lot.customerId || null, lot.customerName || "Sarvani Bio Fuels",
    ));

    if (calc.cessBalance > 0) {
      entries.push(mk(
        "5101", "Market Cess",
        r2(calc.cessBalance), 0,
        `Market cess balance (customer side) — ${ref}`,
      ));
    }

    for (const c of calc.paramCalcs) {
      if (c.valueDeduction <= 0 || c.rejectTrigger || c.weightDeductionKg === 0) continue;
      const qa = paramQualityAccount(c.paramKey);
      entries.push(mk(
        qa.code, qa.name,
        r2(c.valueDeduction), 0,
        `${c.label} ${typeof c.reading === "number" ? c.reading + "%" : c.reading} (customer) — ${ref}`,
      ));
    }

    entries.push(mk(
      "3100", "Sales — Commodity",
      0, grossNotional,
      `Commodity sale — ${ref}`,
    ));

    // ── SUPPLIER SIDE (Model A only) ───────────────────────────────────────────
    // Model B farmer payment is recorded separately via Finance > Payments flow.

    if (lot.businessModel === "A" && lot.supplierId) {
      entries.push(mk(
        "5001", "Procurement — Commodity",
        grossNotional, 0,
        `Procurement ${lot.documentRef} — ${lot.netWeight.toFixed(3)} MT ${lot.materialName} @ ₹${Math.round(calc.grossSaleRate).toLocaleString("en-IN")}/MT`,
        lot.supplierId, lot.supplierName || null,
      ));

      // Cr quality loss per param (offsets customer Dr — passes quality cost to supplier)
      for (const c of calc.paramCalcs) {
        if (c.valueDeduction <= 0 || c.rejectTrigger || c.weightDeductionKg === 0) continue;
        const qa = paramQualityAccount(c.paramKey);
        entries.push(mk(
          qa.code, qa.name,
          0, r2(c.valueDeduction),
          `${c.label} (supplier side — offsets customer Dr) — ${ref}`,
        ));
      }

      // Cr 5101 cessBalance only — cessPaid was already settled at the gate outside this flow
      if (calc.cessBalance > 0) {
        entries.push(mk(
          "5101", "Market Cess",
          0, r2(calc.cessBalance),
          `Market cess balance (supplier side) — ${ref}`,
        ));
      }

      // Cr 3200 Akshaya Trading Margin
      entries.push(mk(
        "3200", "Akshaya Trading Margin",
        0, spMargin,
        `Margin ₹${lot.akshayaMarginPerMT}/MT × ${lot.netWeight.toFixed(3)} MT — ${ref}`,
      ));

      // Cr 4199 Quality Hold Penalty (if any)
      if (holdPenalty > 0) {
        entries.push(mk(
          "4199", "Quality Hold Penalty",
          0, holdPenalty,
          `Hold penalty — ${ref}`,
        ));
      }

      // Cr 2101 Supplier Payable
      entries.push(mk(
        "2101", "Supplier Payable",
        0, supplierPayable,
        `Payable to ${lot.supplierName || "supplier"} — ${ref}`,
        lot.supplierId, lot.supplierName || null,
      ));
    }

    // 5 — Write all entries atomically and mark Settled.
    // Also write back the engine's authoritative grossSaleValue and netPayableWeight so
    // the lot queue column always reflects what was actually posted to the ledger.
    await createLedgerEntries(entries);
    const settled = await updateLot(id, {
      status: "Settled",
      grossSaleValue:   calc.grossSaleValue,
      netPayableWeight: calc.netPayableWeight,
    });

    return NextResponse.json({
      lot: settled,
      entriesPosted: entries.length,
      summary: {
        customerReceivable,
        supplierPayable: lot.businessModel === "A" ? supplierPayable : null,
        marginPosted: lot.businessModel === "A" ? spMargin : null,
        grossNotional,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
