import { NextRequest, NextResponse } from "next/server";
import { listVouchers, createVoucher, createLedgerEntries } from "../../../lib/db";
import type { LedgerEntry } from "../../../lib/types";

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

    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
