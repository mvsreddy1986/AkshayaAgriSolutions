import { NextRequest, NextResponse } from "next/server";
import { createInvoice, listInvoices, getInvoice, updateInvoice, createLedgerEntries } from "../../../lib/db";
import type { LedgerEntry } from "../../../lib/types";

function r2(n: number) { return Math.round(n * 100) / 100; }

export async function GET() {
  try {
    const all = await listInvoices();
    return NextResponse.json(
      all.filter((i) => i.invoiceType === "CreditNote" || i.invoiceType === "DebitNote")
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const noteType: "CreditNote" | "DebitNote" = body.noteType === "DebitNote" ? "DebitNote" : "CreditNote";
    const partyRole: "Customer" | "Supplier" = body.partyRole === "Supplier" ? "Supplier" : "Customer";
    const amount = r2(Number(body.amount ?? 0));
    if (amount <= 0) return NextResponse.json({ error: "Amount must be positive." }, { status: 400 });

    const today = new Date().toISOString().slice(0, 10);
    const prefix = noteType === "CreditNote" ? "CN" : "DN";
    const noteNo = `${prefix}-${Date.now()}`;

    const note = await createInvoice({
      invoiceNo: noteNo,
      invoiceType: noteType,
      businessModel: body.businessModel ?? "A",
      invoiceDate: body.noteDate ?? today,
      dueDate: body.noteDate ?? today,
      partyId: body.partyId ?? "",
      partyName: body.partyName ?? "",
      materialId: body.materialId ?? null,
      materialName: body.materialName ?? "",
      quantity: 0,
      uom: "MT",
      grossRate: 0,
      grossValue: amount,
      taxableValue: amount,
      cgstRate: 0, sgstRate: 0, igstRate: 0,
      cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
      totalTax: 0,
      totalValue: amount,
      amountPaid: 0,
      amountDue: 0,
      linkedLotIds: Array.isArray(body.linkedLotIds) ? body.linkedLotIds : [],
      status: "Approved",
      cancelledReason: null,
    });

    const reason: string = body.reason ?? "";
    const linkedInvoiceNo: string = body.linkedInvoiceNo ?? "";
    const narration = [
      `${noteType === "CreditNote" ? "Credit Note" : "Debit Note"} | ${noteNo}`,
      linkedInvoiceNo ? `Ref: ${linkedInvoiceNo}` : "",
      reason,
    ].filter(Boolean).join(" | ");

    // ── Post ledger entries ──────────────────────────────────────────────────
    //
    // Customer Credit Note  (reduce what customer owes):
    //   Dr 3101 Sales Adj         amount
    //   Cr 1201 Customer AR       amount
    //
    // Customer Debit Note  (increase what customer owes):
    //   Dr 1201 Customer AR       amount
    //   Cr 3101 Sales Adj         amount
    //
    // Supplier Credit Note  (reduce what we owe supplier — Akshaya's gain):
    //   Dr 2101 Supplier Payable  amount
    //   Cr 5001 Procurement Adj   amount
    //
    // Supplier Debit Note  (increase what we owe supplier):
    //   Dr 5001 Procurement Adj   amount
    //   Cr 2101 Supplier Payable  amount
    //
    const mk = (
      accountCode: string, accountName: string,
      debit: number, credit: number,
      partyId: string | null = null, partyName: string | null = null,
    ): Omit<LedgerEntry, "id"> => ({
      entryDate: note.invoiceDate,
      accountCode, accountName,
      partyId, partyName,
      debit, credit, runningBalance: 0,
      narration,
      sourceType: "Invoice",
      sourceId: note.id,
      sourceRef: noteNo,
    });

    const pId = note.partyId || null;
    const pName = note.partyName || null;

    let entries: Omit<LedgerEntry, "id">[] = [];

    if (partyRole === "Customer") {
      if (noteType === "CreditNote") {
        entries = [
          mk("3101", "Sales — Adjustment", amount, 0),
          mk("1201", "Sarvani Biofuels Receivable", 0, amount, pId, pName),
        ];
      } else {
        entries = [
          mk("1201", "Sarvani Biofuels Receivable", amount, 0, pId, pName),
          mk("3101", "Sales — Adjustment", 0, amount),
        ];
      }
    } else {
      if (noteType === "CreditNote") {
        entries = [
          mk("2101", "Supplier Payable", amount, 0, pId, pName),
          mk("5001", "Procurement — Raw Material", 0, amount),
        ];
      } else {
        entries = [
          mk("5001", "Procurement — Raw Material", amount, 0),
          mk("2101", "Supplier Payable", 0, amount, pId, pName),
        ];
      }
    }

    await createLedgerEntries(entries);

    // ── Adjust linked invoice's amountDue ───────────────────────────────────
    if (body.linkedInvoiceId) {
      try {
        const parent = await getInvoice(body.linkedInvoiceId);
        if (partyRole === "Customer" && noteType === "CreditNote") {
          // CN reduces what customer owes
          const newDue = r2(Math.max(0, parent.amountDue - amount));
          const newStatus = newDue < 0.01 ? "Paid" : parent.amountPaid > 0 ? "Partial" : parent.status;
          await updateInvoice(body.linkedInvoiceId, { amountDue: newDue, status: newStatus });
        } else if (partyRole === "Customer" && noteType === "DebitNote") {
          // DN increases what customer owes
          const newDue = r2(parent.amountDue + amount);
          await updateInvoice(body.linkedInvoiceId, {
            amountDue: newDue,
            status: newDue > 0.01 && parent.status === "Paid" ? "Partial" : parent.status,
          });
        }
        // Supplier AP adjustments don't affect sales invoice balance
      } catch { /* non-fatal if parent invoice lookup fails */ }
    }

    return NextResponse.json({ note, entries }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
