import { NextRequest, NextResponse } from "next/server";
import { listVouchers, createVoucher, createLedgerEntries, getInvoice, updateInvoice, updateVoucher } from "../../../lib/db";
import type { Invoice, LedgerEntry } from "../../../lib/types";

function r2(n: number) { return Math.round(n * 100) / 100; }

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type") ?? undefined;
    return NextResponse.json(await listVouchers(type));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const today = new Date().toISOString().slice(0, 10);

    const saved = await createVoucher({
      voucherNo:   body.voucherNo ?? `VCH-${Date.now()}`,
      voucherType: body.voucherType ?? "Receipt",
      voucherDate: body.voucherDate ?? today,
      partyId:     body.partyId ?? "",
      partyName:   body.partyName ?? "",
      amount:      Number(body.amount ?? 0),
      paymentMode: body.paymentMode ?? "NEFT",
      bankRef:     body.bankRef ?? "",
      narration:   body.narration ?? "",
      status:      body.status ?? "Draft",
      allocatedTo: Array.isArray(body.allocatedTo) ? body.allocatedTo : [],
    });

    // ── Post double-entry ledger entries ──────────────────────────────────────
    //
    // Receipt  (money received from customer):
    //   Dr 1100  Bank / Cash               amount
    //   Cr 1201  Customer Receivable        amount   [tagged to customer party]
    //
    // Payment  (money paid to supplier):
    //   Dr 2101  Supplier Payable           amount   [tagged to supplier party]
    //   Cr 1100  Bank / Cash               amount
    //
    const amount    = saved.amount;
    const ref       = `VCH-${saved.voucherNo}`;
    const narration = [saved.partyName, saved.bankRef, saved.narration].filter(Boolean).join(" — ");
    const date      = saved.voucherDate;

    const mk = (
      accountCode: string, accountName: string,
      debit: number, credit: number,
      partyId: string | null = null, partyName: string | null = null,
    ): Omit<LedgerEntry, "id"> => ({
      entryDate: date, accountCode, accountName,
      partyId, partyName,
      debit, credit, runningBalance: 0,
      narration,
      sourceType: "Voucher", sourceId: saved.id, sourceRef: ref,
    });

    const entries: Omit<LedgerEntry, "id">[] = [];

    if (saved.voucherType === "Receipt") {
      entries.push(
        mk("1100", "Bank / Cash", amount, 0),
        mk("1201", "Sarvani Biofuels Receivable", 0, amount, saved.partyId || null, saved.partyName || null),
      );
    } else if (saved.voucherType === "Payment") {
      entries.push(
        mk("2101", "Supplier Payable", amount, 0, saved.partyId || null, saved.partyName || null),
        mk("1100", "Bank / Cash", 0, amount),
      );
    }

    if (entries.length > 0) await createLedgerEntries(entries);

    // ── Invoice allocation (Receipt vouchers only) ────────────────────────────
    // Walk the supplied invoice list in order, apply receipt amount to each
    // invoice up to its outstanding balance. Update invoice amountPaid/Due/status,
    // then mark the voucher Cleared (fully consumed) or keep it Posted (excess).
    const allocatedTo: string[] = Array.isArray(body.allocatedTo) ? body.allocatedTo : [];
    if (saved.voucherType === "Receipt" && allocatedTo.length > 0) {
      let remaining = saved.amount;
      const invoiceNos: string[] = [];
      for (const invoiceId of allocatedTo) {
        if (remaining < 0.01) break;
        try {
          const inv: Invoice = await getInvoice(invoiceId);
          invoiceNos.push(inv.invoiceNo);
          const toApply = Math.min(remaining, Math.max(0, inv.amountDue));
          if (toApply < 0.01) continue;
          const newPaid = r2(inv.amountPaid + toApply);
          const newDue  = r2(Math.max(0, inv.amountDue - toApply));
          const newStatus: Invoice["status"] = newDue < 0.01 ? "Paid" : "Partial";
          await updateInvoice(invoiceId, { amountPaid: newPaid, amountDue: newDue, status: newStatus });
          remaining = r2(remaining - toApply);
        } catch { /* skip if invoice not found */ }
      }

      // Enrich ledger narration with invoice numbers for easy identification
      if (invoiceNos.length > 0) {
        const invRef = invoiceNos.join(", ");
        const enrichedNarration = saved.narration
          ? `${saved.narration} | ${invRef}`
          : `Receipt against ${invRef}`;
        await updateVoucher(saved.id, { narration: enrichedNarration });
      }

      const finalStatus = remaining < 0.01 ? "Cleared" : "Posted";
      await updateVoucher(saved.id, { allocatedTo, status: finalStatus });
      return NextResponse.json({ ...saved, allocatedTo, status: finalStatus }, { status: 201 });
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
