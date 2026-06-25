import { NextRequest, NextResponse } from "next/server";
import { createLedgerEntries } from "../../../../lib/db";
import type { LedgerEntry } from "../../../../lib/types";

function errMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/**
 * POST /api/ledger/invoice-entry
 *
 * Posts the gross AR double-entry for a Tax Invoice:
 *   Dr 1201  Sarvani Biofuels Receivable   grossAmount
 *   Cr 3100  Sales — Commodity             grossAmount
 *
 * Settlement will later post a Credit Note (Dr 3100 Adj / Cr 1201) for the
 * deduction delta, so the net 1201 balance = what Sarvani actually owes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      invoiceId,
      invoiceNo,
      grossAmount,
      partyId,
      partyName,
      entryDate,
      narration,
    } = body as {
      invoiceId: string;
      invoiceNo: string;
      grossAmount: number;
      partyId: string;
      partyName: string;
      entryDate: string;
      narration: string;
    };

    if (!invoiceId || !grossAmount || grossAmount <= 0) {
      return NextResponse.json({ error: "invoiceId and positive grossAmount are required" }, { status: 400 });
    }

    const mk = (
      accountCode: string, accountName: string,
      debit: number, credit: number,
      pId: string | null = null, pName: string | null = null,
    ): Omit<LedgerEntry, "id"> => ({
      entryDate,
      accountCode, accountName,
      partyId: pId, partyName: pName,
      debit, credit, runningBalance: 0,
      narration,
      sourceType: "Invoice",
      sourceId: invoiceId,
      sourceRef: invoiceNo,
    });

    const entries: Omit<LedgerEntry, "id">[] = [
      mk("1201", "Sarvani Biofuels Receivable", grossAmount, 0, partyId || null, partyName || null),
      mk("3100", "Sales — Commodity", 0, grossAmount),
    ];

    await createLedgerEntries(entries);
    return NextResponse.json({ ok: true, entriesPosted: entries.length });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
