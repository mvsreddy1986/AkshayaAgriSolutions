import { NextRequest, NextResponse } from "next/server";
import { getInvoice, updateInvoice, listLots, updateLot, createLedgerEntries } from "../../../../../lib/db";
import type { LedgerEntry } from "../../../../../lib/types";
import { r2 } from "../../../../../lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const reason: string = body.reason ?? "Cancelled by user";

    const inv = await getInvoice(id);

    if (inv.status === "Cancelled") {
      return NextResponse.json({ error: "Invoice is already cancelled." }, { status: 400 });
    }
    if (inv.status === "Paid") {
      return NextResponse.json({ error: "Cannot cancel a fully paid invoice. Issue a credit note instead." }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const ref = `VOID-${inv.invoiceNo}`;
    const narration = `Cancellation | ${inv.invoiceNo} | ${reason}`;

    // ── Post reversal ledger entries ─────────────────────────────────────────
    // Original Sales invoice:  Dr 1201 Customer AR / Cr 3100 Sales
    // Reversal:                Dr 3100 Sales / Cr 1201 Customer AR
    //
    // Original Purchase invoice: Dr 5001 Procurement / Cr 2101 Supplier Payable
    // Reversal:                  Dr 2101 Supplier Payable / Cr 5001 Procurement
    const amount = r2(inv.totalValue);
    if (amount > 0) {
      const mk = (
        accountCode: string, accountName: string,
        debit: number, credit: number,
        partyId: string | null = null, partyName: string | null = null,
      ): Omit<LedgerEntry, "id"> => ({
        entryDate: today,
        accountCode, accountName,
        partyId, partyName,
        debit, credit, runningBalance: 0,
        narration,
        sourceType: "Journal",
        sourceId: id,
        sourceRef: ref,
      });

      const entries: Omit<LedgerEntry, "id">[] = [];

      if (inv.invoiceType === "Sales") {
        entries.push(
          mk("3100", "Sales — Commodity", amount, 0),
          mk("1201", "Sarvani Biofuels Receivable", 0, amount, inv.partyId, inv.partyName),
        );
      } else if (inv.invoiceType === "Purchase") {
        entries.push(
          mk("2101", "Supplier Payable", amount, 0, inv.partyId, inv.partyName),
          mk("5001", "Procurement — Raw Material", 0, amount),
        );
      }
      // CreditNote / DebitNote — no reversal needed; they self-cancel by adjusting the parent

      if (entries.length > 0) await createLedgerEntries(entries);
    }

    // ── Mark invoice cancelled ───────────────────────────────────────────────
    const cancelled = await updateInvoice(id, {
      status: "Cancelled",
      cancelledReason: reason,
      amountDue: 0,
    });

    // ── Unlink lots that were invoiced but not yet settled ───────────────────
    if (inv.linkedLotIds && inv.linkedLotIds.length > 0) {
      const lots = await listLots();
      const linked = lots.filter(
        (l) => inv.linkedLotIds.includes(l.id) && l.status !== "Settled" && l.status !== "Invoiced"
      );
      await Promise.all(linked.map((l) => updateLot(l.id, { invoiceId: undefined })));
    }

    return NextResponse.json(cancelled);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
