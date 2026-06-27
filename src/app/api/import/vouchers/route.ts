import { NextRequest, NextResponse } from "next/server";
import { createVoucher, createLedgerEntries, listParties } from "../../../../lib/db";
import type { LedgerEntry } from "../../../../lib/types";

export const dynamic = "force-dynamic";

function r2(n: number) { return Math.round(n * 100) / 100; }
function errMsg(e: unknown) { return e instanceof Error ? e.message : String(e); }

interface VoucherRow {
  date: string;
  party_name: string;
  amount: string;
  payment_mode: string;
  bank_ref: string;
  narration: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: VoucherRow[]  = body.rows ?? [];
    const voucherType: "Receipt" | "Payment" = body.voucherType ?? "Payment";
    const batchRef = body.batchRef ?? `IMPORT-${Date.now()}`;

    const parties     = await listParties();
    const partyByName = new Map(parties.map((p) => [p.name.toLowerCase(), p]));

    const created: string[] = [];
    const errors:  string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i];
      const rowNum = i + 2;

      try {
        const amount = r2(parseFloat(row.amount) || 0);
        if (amount <= 0) { errors.push(`Row ${rowNum}: amount must be > 0`); continue; }

        const party     = partyByName.get(row.party_name?.toLowerCase() ?? "");
        const partyId   = party?.id ?? null;
        const partyName = row.party_name;

        const saved = await createVoucher({
          voucherNo:   `${voucherType === "Receipt" ? "RCT" : "PMT"}-IMP-${batchRef}-${i + 1}`,
          voucherType,
          voucherDate: row.date,
          partyId,
          partyName,
          amount,
          paymentMode: row.payment_mode || "NEFT",
          bankRef:     row.bank_ref || "",
          narration:   row.narration || `Historical ${voucherType.toLowerCase()} import`,
          status:      "Posted",
          allocatedTo: [],
        });

        // Double-entry ledger entries
        //   Receipt:  Dr 1100 Bank / Cash → Cr 1201 Customer AR
        //   Payment:  Dr 2101 Supplier AP → Cr 1100 Bank / Cash
        const narr = [partyName, row.bank_ref, row.narration].filter(Boolean).join(" — ");
        const ref  = `VCH-${saved.voucherNo}`;

        const mk = (
          accountCode: string, accountName: string,
          debit: number, credit: number,
          pid: string | null = null, pname: string | null = null,
        ): Omit<LedgerEntry, "id"> => ({
          entryDate: row.date, accountCode, accountName,
          partyId: pid, partyName: pname,
          debit, credit, runningBalance: 0,
          narration: narr,
          sourceType: "Voucher", sourceId: saved.id, sourceRef: ref,
        });

        const entries: Omit<LedgerEntry, "id">[] = voucherType === "Receipt"
          ? [
              mk("1100", "Bank / Cash",                   amount, 0),
              mk("1201", "Sarvani Biofuels Receivable",    0, amount, partyId, partyName),
            ]
          : [
              mk("2101", "Supplier Payable",               amount, 0, partyId, partyName),
              mk("1100", "Bank / Cash",                    0, amount),
            ];

        await createLedgerEntries(entries);
        created.push(saved.voucherNo);
      } catch (e) {
        errors.push(`Row ${rowNum} (${row.party_name || "?"}): ${errMsg(e)}`);
      }
    }

    return NextResponse.json({ created: created.length, createdRefs: created, errors });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
