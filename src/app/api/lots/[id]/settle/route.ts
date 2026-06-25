import { NextRequest, NextResponse } from "next/server";
import { getLot, listQualityRules, listMaterials, updateLot, createLedgerEntries, createPayout, getInvoice, updateInvoice } from "../../../../../lib/db";
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
        { error: `Lot must be Approved before posting settlement (complete quality readings first). Current status: ${lot.status}` },
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
    //
    // Two paths:
    //   A) Lot already has a Tax Invoice (status = "Invoiced"):
    //      Gross entry was posted when the invoice was saved (Dr 1201 / Cr 3100).
    //      Post ONLY the Credit Note delta for deductions:
    //        Dr 3100  Sales — Adjustment   deductionDelta
    //        Cr 1201  Sarvani Receivable   deductionDelta
    //      Also update the Invoice record: reduce amountDue by deductionDelta.
    //      Narration references invoice no + challan no for traceability.
    //
    //   B) No invoice yet (status = "Approved"):
    //      Post the original split entries (gross notional to 3100,
    //      net receivable to 1201, cess + quality deductions separately).
    //      This preserves backward compatibility for lots settled before invoicing.

    let invoiceNo = lot.documentRef; // fallback narration ref
    if (lot.invoiceId) {
      // Path A — Credit Note for deductions
      try {
        const linkedInvoice = await getInvoice(lot.invoiceId);
        invoiceNo = linkedInvoice.invoiceNo;
      } catch { /* keep fallback */ }

      const deductionDelta = r2(grossNotional - customerReceivable); // quality + cess deducted from AR
      const cnNarration = `Credit Note | ${invoiceNo} | Challan ${lot.documentRef} | Quality & cess adjustments`;

      if (deductionDelta > 0) {
        entries.push(mk(
          "3100", "Sales — Adjustment",
          deductionDelta, 0,
          cnNarration,
        ));
        entries.push(mk(
          "1201", "Sarvani Biofuels Receivable",
          0, deductionDelta,
          cnNarration,
          lot.customerId || null, lot.customerName || "Sarvani Bio Fuels",
        ));
      }

      // Update Invoice: reduce amountDue by deductionDelta
      if (lot.invoiceId && deductionDelta > 0) {
        try {
          const inv = await getInvoice(lot.invoiceId);
          const newDue = r2(Math.max(0, inv.amountDue - deductionDelta));
          const newStatus = newDue < 0.01 ? "Paid" : inv.status === "Paid" ? "Paid" : "Approved";
          await updateInvoice(lot.invoiceId, { amountDue: newDue, status: newStatus });
        } catch { /* non-fatal */ }
      }
    } else {
      // Path B — no invoice yet; post the classic split customer-side entries
      entries.push(mk(
        "1201", "Sarvani Biofuels Receivable",
        customerReceivable, 0,
        `${lot.documentRef} | ${lot.lotDate} · ${lot.netWeight.toFixed(3)} MT ${lot.materialName}`,
        lot.customerId || null, lot.customerName || "Sarvani Bio Fuels",
      ));

      if (calc.cessBalance > 0) {
        entries.push(mk(
          "5101", "Market Cess",
          r2(calc.cessBalance), 0,
          `Market cess balance (customer side) — ${lot.documentRef}`,
        ));
      }

      for (const c of calc.paramCalcs) {
        if (c.valueDeduction <= 0 || c.rejectTrigger || c.weightDeductionKg === 0) continue;
        const qa = paramQualityAccount(c.paramKey);
        entries.push(mk(
          qa.code, qa.name,
          r2(c.valueDeduction), 0,
          `${c.label} ${typeof c.reading === "number" ? c.reading + "%" : c.reading} — ${lot.documentRef}`,
        ));
      }

      entries.push(mk(
        "3100", "Sales — Commodity",
        0, grossNotional,
        `Commodity sale — ${lot.documentRef}`,
      ));
    }

    // ── SUPPLIER SIDE (Model A only) ───────────────────────────────────────────
    // Model B farmer payment is recorded separately via Finance > Payments flow.

    if (lot.businessModel === "A" && lot.supplierId) {
      const supRef = `${lot.documentRef}${invoiceNo !== lot.documentRef ? " | " + invoiceNo : ""}`;
      entries.push(mk(
        "5001", "Procurement — Commodity",
        grossNotional, 0,
        `Challan ${supRef} — ${lot.netWeight.toFixed(3)} MT ${lot.materialName} @ ₹${Math.round(calc.grossSaleRate).toLocaleString("en-IN")}/MT`,
        lot.supplierId, lot.supplierName || null,
      ));

      for (const c of calc.paramCalcs) {
        if (c.valueDeduction <= 0 || c.rejectTrigger || c.weightDeductionKg === 0) continue;
        const qa = paramQualityAccount(c.paramKey);
        entries.push(mk(
          qa.code, qa.name,
          0, r2(c.valueDeduction),
          `${c.label} deduction | Challan ${lot.documentRef}`,
        ));
      }

      if (calc.cessBalance > 0) {
        entries.push(mk(
          "5101", "Market Cess",
          0, r2(calc.cessBalance),
          `Market cess | Challan ${lot.documentRef}`,
        ));
      }

      entries.push(mk(
        "3200", "Akshaya Trading Margin",
        0, spMargin,
        `Margin ₹${lot.akshayaMarginPerMT}/MT × ${lot.netWeight.toFixed(3)} MT | Challan ${lot.documentRef}`,
      ));

      if (holdPenalty > 0) {
        entries.push(mk(
          "4199", "Quality Hold Penalty",
          0, holdPenalty,
          `Hold penalty | Challan ${lot.documentRef}`,
        ));
      }

      entries.push(mk(
        "2101", "Supplier Payable",
        0, supplierPayable,
        `Payable to ${lot.supplierName || "supplier"} | Challan ${lot.documentRef}`,
        lot.supplierId, lot.supplierName || null,
      ));
    }

    // 5 — Write all entries atomically and mark Settled.
    // Also write back the engine's authoritative grossSaleValue and netPayableWeight so
    // the lot queue column always reflects what was actually posted to the ledger.
    // Terminal status: "Invoiced" if this lot was already linked to a Tax Invoice
    // (Credit Note path above), otherwise "Settled" for post-settlement invoicing later.
    const finalStatus = lot.invoiceId ? "Invoiced" : "Settled";

    await createLedgerEntries(entries);
    const settled = await updateLot(id, {
      status: finalStatus,
      grossSaleValue:   calc.grossSaleValue,
      netPayableWeight: calc.netPayableWeight,
    });

    // 6 — Create payout record so the supplier/farmer obligation is trackable.
    //     Model A: payee is the supplier (supplierId/supplierName).
    //     Model B: payee is the farmer (farmerId/farmerName); net is gross − cess − hold penalty
    //              (no Akshaya margin on Model B direct farmer purchases).
    const payeeId   = lot.businessModel === "A" ? (lot.supplierId ?? "") : (lot.farmerId ?? "");
    const payeeName = lot.businessModel === "A" ? (lot.supplierName ?? "") : (lot.farmerName ?? "");
    const totalDeductions = r2(calc.cessBalance + spMargin + holdPenalty);

    if (payeeId) {
      await createPayout({
        batchRef:      `PAY-${lot.documentRef}`,
        farmerId:      payeeId,
        farmerName:    payeeName,
        inwardLotId:   lot.id,
        documentRef:   lot.documentRef,
        payoutDate:    today,
        materialName:  lot.materialName,
        quantity:      calc.netPayableWeight,        // MT
        rate:          calc.grossSaleRate,            // ₹/MT
        grossAmount:   calc.grossSaleValue,
        deductions:    totalDeductions,
        netAmount:     supplierPayable,
        paymentMode:   "NEFT",
        paymentRef:    "",
        paymentStatus: "Pending",
      });
    }

    return NextResponse.json({
      lot: settled,
      entriesPosted: entries.length,
      summary: {
        customerReceivable,
        supplierPayable: lot.businessModel === "A" ? supplierPayable : null,
        marginPosted:    lot.businessModel === "A" ? spMargin : null,
        grossNotional,
        payoutCreated:   !!payeeId,
        payoutRef:       payeeId ? `PAY-${lot.documentRef}` : null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
