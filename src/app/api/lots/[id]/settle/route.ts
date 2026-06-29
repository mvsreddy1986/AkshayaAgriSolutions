import { NextRequest, NextResponse } from "next/server";
import { getLot, listQualityRules, listMaterials, listRates, updateLot, createLedgerEntries, createPayout, getInvoice, updateInvoice } from "../../../../../lib/db";
import { supabase } from "../../../../../lib/supabase/client";
import { calculateLotSettlement, paramQualityAccount } from "../../../../../lib/settlement/engine";
import type { LedgerEntry } from "../../../../../lib/types";
import { r2, errMsg } from "../../../../../lib/utils";

type Ctx = { params: Promise<{ id: string }> };

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
 *   Cr 5101  Market Cess               cessTotal (full; offsets Dr cessBalance + Dr cessPaid gate entry)
 *   Cr 3200  Akshaya Trading Margin    akshayaMarginPerMT × netWeight
 *   Cr 4199  Quality Hold Penalty      holdPenalty (if any)
 *   Cr 2101  Supplier Payable          grossSaleValue − cessTotal − margin − holdPenalty
 *
 *   Proof: grossNotional = qualityDeductions + cessTotal + margin + holdPenalty + supplierPayable  ✓
 *
 * ── GATE BANK ENTRY (posted separately via /cess-payment) ─────────────────────
 *   Dr 5101  Market Cess              cessPaid   ← clears Cr cessPaid residual in 5101
 *   Cr 1100  Bank / Cash              cessPaid   ← records actual gate cash outflow
 *
 * ── P&L IMPACT ────────────────────────────────────────────────────────────────
 *   3100 Cr = 5001 Dr = grossNotional (commodity trading nets to zero)
 *   41XX Dr + 41XX Cr = 0 (quality deductions pass through to supplier)
 *   5101: Dr cessBalance (settlement) + Dr cessPaid (gate entry) = Cr cessTotal → 0 ✓
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
    // Historical bulk-imported lots are exempt from the invoice pre-requisite — their real invoices
    // pre-date the ERP. The invoice is auto-resolved later in this route from overrideReason.
    const isHistoricalImport = lot.overrideReason?.startsWith("Historical import");
    if (!lot.invoiceId && !isHistoricalImport) {
      return NextResponse.json(
        { error: `Tax Invoice to Sarvani must be generated before posting settlement for lot ${lot.documentRef}. Generate the invoice first from the Invoicing tab.` },
        { status: 400 },
      );
    }

    // 1b — Idempotency guard: if ledger entries already exist for this lot's
    //      settlement ref, a duplicate request raced through. Return 409 so the
    //      UI can surface the error rather than silently double-posting.
    const ref = `SETTLE-${lot.documentRef}`;
    const { count: existingCount } = await supabase
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("source_ref", ref);
    if ((existingCount ?? 0) > 0) {
      return NextResponse.json(
        { error: `Settlement already posted for lot ${lot.documentRef}. Refresh to see the updated status.` },
        { status: 409 },
      );
    }

    // 2 — Resolve quality rule and material; fetch rates only for historical imports (performance)
    const [rules, materials, allRates] = await Promise.all([
      listQualityRules(),
      listMaterials(),
      isHistoricalImport ? listRates() : Promise.resolve([]),
    ]);
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
    //
    // Cess flow (Model A) — full audit trail via 5101:
    //   supplierPayable = grossSaleValue − cessTotal − margin − holdPenalty
    //     Supplier bears FULL cess; cessPaid portion is reimbursed via a separate gate bank entry (Dr 5101 / Cr 1100).
    //   customerReceivable = grossSaleValue − cessBalance  (Sarvani deducts only the cess balance at settlement)
    //   5101 netting: Dr cessBalance (customer) + Dr cessPaid (gate entry) = Cr cessTotal (supplier) → 0 ✓
    const grossNotional      = r2(lot.netWeight * calc.grossSaleRate);
    const customerReceivable = r2(calc.grossSaleValue - calc.cessBalance);
    const holdPenalty        = r2(lot.holdPenalty ?? 0);

    // Historical lots: derive margin from Rate Master purchase rate spread.
    // Normal lots: use akshayaMarginPerMT stored during quality approval.
    let spMargin: number;
    if (isHistoricalImport) {
      // Find purchase rate: supplier-specific first, then material-wide default
      const purchaseRates = allRates.filter(
        (r) => r.materialId === lot.materialId && r.rateType === "Purchase" &&
               r.validFrom <= (lot.lotDate ?? "") &&
               (r.validTo === null || r.validTo >= (lot.lotDate ?? "")),
      );
      const purchaseRate =
        purchaseRates.find((r) => r.partyId === lot.supplierId) ??
        purchaseRates.find((r) => r.partyId === null);

      if (!purchaseRate) {
        return NextResponse.json(
          {
            error: `No purchase rate found for ${lot.materialName} on ${lot.lotDate}. ` +
                   `Go to Master Data → Rates → add a "Purchase" rate for ${lot.materialName} ` +
                   `(supplier-specific or material-wide) valid from before ${lot.lotDate}.`,
          },
          { status: 400 },
        );
      }
      // Margin = sale value − (net weight × purchase rate). Supplier pays full cess.
      spMargin = r2(calc.grossSaleValue - lot.netWeight * purchaseRate.rate);
    } else {
      // Normal procurement flow: margin was set during quality approval
      spMargin = r2(lot.akshayaMarginPerMT * lot.netWeight);
    }

    const supplierPayable = r2(calc.grossSaleValue - calc.cessTotal - spMargin - holdPenalty);
    // Use the lot's own date so historical imports land in the correct fiscal year.
    const entryDate         = lot.lotDate ?? new Date().toISOString().slice(0, 10);
    // ref already declared above in the idempotency guard — reuse it here.

    const entries: Omit<LedgerEntry, "id">[] = [];

    const mk = (
      accountCode: string, accountName: string,
      debit: number, credit: number, narration: string,
      partyId: string | null = null, partyName: string | null = null,
    ): Omit<LedgerEntry, "id"> => ({
      entryDate, accountCode, accountName,
      partyId, partyName,
      debit, credit, runningBalance: 0,
      narration,
      sourceType: "Settlement", sourceId: lot.id, sourceRef: ref,
    });

    // ── CUSTOMER SIDE ──────────────────────────────────────────────────────────
    //
    // Two paths:
    //   A) Lot already has a Tax Invoice (status = "Invoiced"):
    //      Gross entry was posted when invoice was saved (Dr 1201 grossNotional / Cr 3100 grossNotional).
    //      Post credit note to bring 1201 down to customerReceivable:
    //        Dr 41XX  Quality Loss per param    valueDeduction   (mirrors supplier Cr 41XX → nets 0)
    //        Dr 5101  Market Cess               cessBalance      (mirrors Path B customer-side Dr 5101)
    //        Cr 1201  Sarvani Receivable        qualityDelta + cessBalance
    //      Supplier side always posts Cr 5101 cessTotal — so 5101 nets to 0 after gate payment.
    //      Also update the Invoice record: reduce amountDue by deductionDelta.
    //
    //   B) No invoice yet (status = "Approved"):
    //      Post the original split entries (gross notional to 3100,
    //      net receivable to 1201, cess + quality deductions separately).
    //      This preserves backward compatibility for lots settled before invoicing.

    // For historical lots without a linked invoiceId, try to resolve it from overrideReason.
    // overrideReason format: "Historical import — MC ded ₹X | Inv INV-XXXX"
    let resolvedInvoiceId = lot.invoiceId ?? null;
    if (isHistoricalImport && !resolvedInvoiceId && lot.overrideReason) {
      const invMatch = lot.overrideReason.match(/\| Inv (.+)$/);
      if (invMatch) {
        const { data: foundInv } = await supabase
          .from("invoices")
          .select("id, linked_lot_ids")
          .eq("invoice_no", invMatch[1].trim())
          .single();
        if (foundInv?.id) {
          resolvedInvoiceId = foundInv.id;
          // Back-fill lot.invoiceId so it's in sync going forward
          await supabase.from("inward_lots").update({ invoice_id: resolvedInvoiceId }).eq("id", lot.id);
          // Back-fill invoice's linked_lot_ids
          const existing = (foundInv.linked_lot_ids ?? []) as string[];
          if (!existing.includes(lot.id)) {
            await supabase.from("invoices")
              .update({ linked_lot_ids: [...existing, lot.id] })
              .eq("id", resolvedInvoiceId);
          }
        }
      }
    }

    let invoiceNo = lot.documentRef; // fallback narration ref
    if (resolvedInvoiceId) {
      // Path A — Credit Note for deductions
      try {
        const linkedInvoice = await getInvoice(resolvedInvoiceId);
        invoiceNo = linkedInvoice.invoiceNo;
      } catch { /* keep fallback */ }

      const qualityDelta   = r2(grossNotional - calc.grossSaleValue);  // quality weight deductions
      const cessBalanceAmt = r2(calc.cessBalance);
      const deductionDelta = r2(qualityDelta + cessBalanceAmt);         // total credit note amount
      const cnNarration    = `Credit Note | ${invoiceNo} | Challan ${lot.documentRef} | Quality & cess adjustments`;

      if (deductionDelta > 0) {
        for (const c of calc.paramCalcs) {
          if (c.valueDeduction <= 0 || c.rejectTrigger || c.weightDeductionKg === 0) continue;
          const qa = paramQualityAccount(c.paramKey);
          entries.push(mk(
            qa.code, qa.name,
            r2(c.valueDeduction), 0,
            `${c.label} ${typeof c.reading === "number" ? c.reading + "%" : c.reading} — Challan ${lot.documentRef}`,
          ));
        }
        if (cessBalanceAmt > 0) {
          entries.push(mk(
            "5101", "Market Cess",
            cessBalanceAmt, 0,
            `Market cess balance (customer side) — Challan ${lot.documentRef}`,
          ));
        }
        entries.push(mk(
          "1201", "Sarvani Biofuels Receivable",
          0, deductionDelta,
          cnNarration,
          lot.customerId || null, lot.customerName || "Sarvani Bio Fuels",
        ));
      }

      if (deductionDelta > 0) {
        try {
          const inv = await getInvoice(resolvedInvoiceId);
          const newDue = r2(Math.max(0, inv.amountDue - deductionDelta));
          const newStatus = newDue < 0.01 ? "Paid" : inv.status === "Paid" ? "Paid" : "Approved";
          await updateInvoice(resolvedInvoiceId, { amountDue: newDue, status: newStatus });
        } catch { /* non-fatal */ }
      }
    } else {
      // Path B — no invoice; post customer-side entries
      // customerReceivable = grossSaleValue − cessBalance (Sarvani deducts only the remaining cess balance;
      // cessPaid was already settled at gate and is reimbursed to Akshaya in this settlement implicitly)
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

      // Cr 5101 cessTotal — full market cess credited to 5101 on supplier side.
      // Then: Dr 5101 cessPaid / Cr 2101 cessPaid — clears gate-paid portion from 5101 and bundles it into
      // the supplier payable so the 2101 balance reflects the total single payment due to supplier.
      // 5101 net: Dr cessBalance (customer) + Dr cessPaid (this entry) = Cr cessTotal → 0 ✓
      // 2101 total: settlementPayable + cessPaid = grossSaleValue − cessBalance − margin (single bank transfer)
      if (calc.cessTotal > 0) {
        entries.push(mk(
          "5101", "Market Cess",
          0, r2(calc.cessTotal),
          `Market cess (full) | Challan ${lot.documentRef}`,
        ));
      }
      if (calc.cessPaid > 0) {
        const reimb = `Gate cess reimbursement | Challan ${lot.documentRef}`;
        entries.push(mk("5101", "Market Cess",          r2(calc.cessPaid), 0,               reimb, lot.supplierId || null, lot.supplierName || null));
        entries.push(mk("2101", "Supplier Payable",     0,                 r2(calc.cessPaid), reimb, lot.supplierId || null, lot.supplierName || null));
      }

      const marginPerMT = lot.netWeight > 0 ? r2(spMargin / lot.netWeight) : 0;
      entries.push(mk(
        "3200", "Akshaya Trading Margin",
        0, spMargin,
        `Margin ₹${marginPerMT.toLocaleString("en-IN")}/MT × ${lot.netWeight.toFixed(3)} MT | Challan ${lot.documentRef}`,
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
    const finalStatus = resolvedInvoiceId ? "Invoiced" : "Settled";

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
    // Total payable to supplier = settlement portion + gate cess reimbursement (both credited to 2101)
    const totalSupplierPayable = r2(supplierPayable + calc.cessPaid);
    const totalDeductions      = r2(calc.cessBalance + spMargin + holdPenalty); // deductions net of cessPaid already reimbursed

    if (payeeId) {
      // Skip if a payout record already exists for this lot (race condition safety net).
      const { count: payoutExists } = await supabase
        .from("farmer_payouts")
        .select("id", { count: "exact", head: true })
        .eq("inward_lot_id", lot.id);
      if ((payoutExists ?? 0) === 0) {
        await createPayout({
          batchRef:      `PAY-${lot.documentRef}`,
          farmerId:      payeeId,
          farmerName:    payeeName,
          inwardLotId:   lot.id,
          documentRef:   lot.documentRef,
          payoutDate:    entryDate,
          materialName:  lot.materialName,
          quantity:      calc.netPayableWeight,
          rate:          calc.grossSaleRate,
          grossAmount:   calc.grossSaleValue,
          deductions:    totalDeductions,
          netAmount:     totalSupplierPayable,
          paymentMode:   "NEFT",
          paymentRef:    "",
          paymentStatus: "Pending",
        });
      }
    }

    return NextResponse.json({
      lot: settled,
      entriesPosted: entries.length,
      summary: {
        customerReceivable,
        supplierPayable: lot.businessModel === "A" ? totalSupplierPayable : null,
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
