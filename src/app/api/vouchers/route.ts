import { NextRequest, NextResponse } from "next/server";
import { listVouchers, createVoucher, createLedgerEntries, getInvoice, updateInvoice, updateVoucher } from "../../../lib/db";
import type { Invoice, LedgerEntry } from "../../../lib/types";

export const dynamic = "force-dynamic";

function r2(n: number) { return Math.round(n * 100) / 100; }

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type") ?? undefined;
    return NextResponse.json(await listVouchers(type));
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const today = new Date().toISOString().slice(0, 10);

    // TDS deducted by customer (Receipt only). This is cash NOT received but
    // deposited to govt on Akshaya's behalf — it's a tax asset (TDS Receivable).
    const tdsAmount = r2(Number(body.tdsAmount ?? 0));

    const saved = await createVoucher({
      voucherNo:   body.voucherNo ?? `VCH-${Date.now()}`,
      voucherType: body.voucherType ?? "Receipt",
      voucherDate: body.voucherDate ?? today,
      partyId:     body.partyId || null,
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
    // Receipt (no TDS):
    //   Dr 1100  Bank / Cash               amount
    //   Cr 1201  Customer Receivable        amount
    //
    // Receipt (with TDS deducted by customer):
    //   Dr 1100  Bank / Cash               amount          ← cash actually received
    //   Dr 1190  TDS Receivable            tdsAmount       ← tax credit claimable at ITR
    //   Cr 1201  Customer Receivable        amount+tds     ← full invoice amount cleared
    //
    // Payment (money paid to supplier):
    //   Dr 2101  Supplier Payable           amount
    //   Cr 1100  Bank / Cash               amount
    //
    const amount    = saved.amount;
    const grossReceipt = r2(amount + tdsAmount); // total AR cleared
    const ref       = `VCH-${saved.voucherNo}`;
    const narration = [saved.partyName, saved.bankRef, saved.narration].filter(Boolean).join(" — ");
    const tdsNarration = `${narration}${tdsAmount > 0 ? ` | TDS u/s 194Q ₹${tdsAmount.toLocaleString("en-IN")}` : ""}`;
    const date      = saved.voucherDate;

    // Gate cess reimbursement portion (separate 2101 credit from settlement; needs own clearing entry)
    const cessReimb    = r2(Math.max(0, Number(body.cessReimb ?? 0)));
    const settlementAmt = r2(amount - cessReimb);

    const mk = (
      accountCode: string, accountName: string,
      debit: number, credit: number,
      partyId: string | null = null, partyName: string | null = null,
      overrideNarration?: string,
    ): Omit<LedgerEntry, "id"> => ({
      entryDate: date, accountCode, accountName,
      partyId, partyName,
      debit, credit, runningBalance: 0,
      narration: overrideNarration ?? tdsNarration,
      sourceType: "Voucher", sourceId: saved.id, sourceRef: ref,
    });

    const entries: Omit<LedgerEntry, "id">[] = [];

    if (saved.voucherType === "Receipt") {
      entries.push(mk("1100", "Bank / Cash", amount, 0));
      if (tdsAmount > 0) {
        entries.push(mk("1190", "TDS Receivable", tdsAmount, 0));
      }
      entries.push(
        mk("1201", "Sarvani Biofuels Receivable", 0, grossReceipt, saved.partyId || null, saved.partyName || null),
      );
    } else if (saved.voucherType === "Payment") {
      const partyId   = saved.partyId   || null;
      const partyName = saved.partyName || null;
      if (cessReimb > 0 && settlementAmt > 0.005) {
        // Two entries mirror the two Cr 2101 credits posted at settlement
        const reimb_nar = `${tdsNarration} | Gate cess reimb.`;
        entries.push(
          mk("2101", "Supplier Payable",              settlementAmt, 0, partyId, partyName),
          mk("1100", "Bank / Cash",                   0, settlementAmt),
          mk("2101", "Supplier Payable — Cess Reimb.", cessReimb,     0, partyId, partyName, reimb_nar),
          mk("1100", "Bank / Cash",                   0, cessReimb,   null, null,            reimb_nar),
        );
      } else {
        entries.push(
          mk("2101", "Supplier Payable", amount, 0, partyId, partyName),
          mk("1100", "Bank / Cash", 0, amount),
        );
      }
    } else if (saved.voucherType === "Expense") {
      // Business expense paid from bank or petty cash
      // Dr [expense account] / Cr [payment source]
      const expCode  = String(body.expenseAccountCode  ?? "5208");
      const expName  = String(body.expenseAccountName  ?? "Miscellaneous Expense");
      const srcCode  = String(body.paidFromCode        ?? "1100");
      const srcName  = String(body.paidFromName        ?? "Bank / Cash");
      entries.push(
        mk(expCode, expName, amount, 0),
        mk(srcCode, srcName, 0, amount),
      );
    } else if (saved.voucherType === "Drawing") {
      // Owner personal withdrawal
      // Dr 3900 Owner Drawings / Cr [payment source]
      const srcCode  = String(body.paidFromCode ?? "1100");
      const srcName  = String(body.paidFromName ?? "Bank / Cash");
      entries.push(
        mk("3900", "Owner Drawings", amount, 0),
        mk(srcCode, srcName, 0, amount),
      );
    }

    if (entries.length > 0) await createLedgerEntries(entries);

    // ── Invoice allocation (Receipt vouchers only) ────────────────────────────
    // Use grossReceipt (cash + TDS) so invoices are fully closed even when
    // Sarvani deducts TDS before transferring funds.
    const allocatedTo: string[] = Array.isArray(body.allocatedTo) ? body.allocatedTo : [];
    if (saved.voucherType === "Receipt" && allocatedTo.length > 0) {
      let remaining = grossReceipt; // allocate full gross (cash + TDS)
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

      if (invoiceNos.length > 0) {
        const invRef = invoiceNos.join(", ");
        const enrichedNarration = saved.narration
          ? `${saved.narration} | ${invRef}${tdsAmount > 0 ? ` | TDS ₹${tdsAmount.toLocaleString("en-IN")}` : ""}`
          : `Receipt against ${invRef}${tdsAmount > 0 ? ` | TDS ₹${tdsAmount.toLocaleString("en-IN")}` : ""}`;
        await updateVoucher(saved.id, { narration: enrichedNarration });
      }

      const finalStatus = remaining < 0.01 ? "Cleared" : "Posted";
      await updateVoucher(saved.id, { allocatedTo, status: finalStatus });
      return NextResponse.json({ ...saved, allocatedTo, status: finalStatus }, { status: 201 });
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
