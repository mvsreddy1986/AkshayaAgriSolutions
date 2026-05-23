import type { Invoice, Voucher, LedgerEntry, FarmerPayout, StockBatch } from "@/lib/types";

export type PostingEvent =
  | { type: "InvoiceApproved"; invoice: Invoice }
  | { type: "PaymentReceived"; voucher: Voucher; invoiceRef: string }
  | { type: "PaymentMade"; voucher: Voucher; invoiceRef: string }
  | { type: "FarmerAdvancePaid"; payout: FarmerPayout }
  | { type: "SarvaniRecovered"; voucherNo: string; amount: number; date: string; narration: string }
  | { type: "StockPurchased"; batch: StockBatch; supplierPartyId: string; supplierName: string; purchaseInvoiceRef: string }
  | { type: "StockSold"; batchRef: string; qty: number; rate: number; costRate: number; partyName: string; invoiceRef: string; date: string };

/**
 * Generates the canonical double-entry ledger postings for a business event.
 * Each event produces balanced Dr/Cr entries (sum of debits = sum of credits).
 *
 * Account codes used:
 *   1100 — Bank / Cash
 *   1201 — Sarvani Biofuels Receivable
 *   1300 — Inventory (Stock)
 *   1400 — Farmer Finance Advance Control
 *   2101 — Supplier Payable
 *   2102 — Sarvani Biofuels Payable (Model C purchase)
 *   2201 — CGST Payable
 *   2202 — SGST Payable
 *   3100 — Sales - Commodity
 *   3200 — Sales - Byproducts
 *   4100 — Cost of Goods Sold
 *   4200 — Purchase - Commodity
 *   5100 — Freight / Logistics
 */
export function generatePostings(event: PostingEvent): LedgerEntry[] {
  const now = new Date().toISOString().slice(0, 10);

  switch (event.type) {
    case "InvoiceApproved": {
      const inv = event.invoice;
      const half = inv.totalTax / 2;
      const isInter = inv.igstRate > 0;
      const entries: LedgerEntry[] = [];

      if (inv.invoiceType === "Sales") {
        // Dr Receivable / Cr Sales + GST Payable
        entries.push(debit(`LE-${inv.id}-1`, inv.invoiceDate, "1201", "Sarvani Biofuels Receivable", inv.partyId, inv.partyName, inv.totalValue, `Sales invoice ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
        entries.push(credit(`LE-${inv.id}-2`, inv.invoiceDate, "3100", "Sales - Commodity", null, null, inv.taxableValue, `Sales ${inv.invoiceNo} — ${inv.quantity} ${inv.uom} ${inv.materialName}`, "Invoice", inv.id, inv.invoiceNo));
        if (isInter) {
          entries.push(credit(`LE-${inv.id}-3`, inv.invoiceDate, "2203", "IGST Payable", null, null, inv.totalTax, `IGST on ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
        } else {
          entries.push(credit(`LE-${inv.id}-3`, inv.invoiceDate, "2201", "CGST Payable", null, null, half, `CGST on ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
          entries.push(credit(`LE-${inv.id}-4`, inv.invoiceDate, "2202", "SGST Payable", null, null, half, `SGST on ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
        }
      } else if (inv.invoiceType === "Purchase") {
        // Dr Inventory + GST Input / Cr Sarvani Payable
        entries.push(debit(`LE-${inv.id}-1`, inv.invoiceDate, "1300", "Inventory - Stock", null, null, inv.taxableValue, `Purchase ${inv.invoiceNo} — ${inv.materialName}`, "Invoice", inv.id, inv.invoiceNo));
        if (isInter) {
          entries.push(debit(`LE-${inv.id}-2`, inv.invoiceDate, "1501", "IGST Input Credit", null, null, inv.totalTax, `IGST input on ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
        } else {
          entries.push(debit(`LE-${inv.id}-2`, inv.invoiceDate, "1501", "CGST Input Credit", null, null, half, `CGST input on ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
          entries.push(debit(`LE-${inv.id}-3`, inv.invoiceDate, "1502", "SGST Input Credit", null, null, half, `SGST input on ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
        }
        entries.push(credit(`LE-${inv.id}-4`, inv.invoiceDate, "2102", "Sarvani Biofuels Payable", inv.partyId, inv.partyName, inv.totalValue, `Purchase payable ${inv.invoiceNo}`, "Invoice", inv.id, inv.invoiceNo));
      }

      return entries;
    }

    case "PaymentReceived": {
      const v = event.voucher;
      // Dr Bank / Cr Receivable
      return [
        debit(`LE-${v.id}-1`, v.voucherDate, "1100", "Bank - Current Account", null, null, v.amount, `Receipt ${v.voucherNo} — ${v.narration}`, "Voucher", v.id, v.voucherNo),
        credit(`LE-${v.id}-2`, v.voucherDate, "1201", "Sarvani Biofuels Receivable", v.partyId, v.partyName, v.amount, `Receipt against ${event.invoiceRef}`, "Voucher", v.id, v.voucherNo),
      ];
    }

    case "PaymentMade": {
      const v = event.voucher;
      // Dr Payable / Cr Bank
      return [
        debit(`LE-${v.id}-1`, v.voucherDate, "2102", "Sarvani Biofuels Payable", v.partyId, v.partyName, v.amount, `Payment ${v.voucherNo} — ${v.narration}`, "Voucher", v.id, v.voucherNo),
        credit(`LE-${v.id}-2`, v.voucherDate, "1100", "Bank - Current Account", null, null, v.amount, `Payment against ${event.invoiceRef}`, "Voucher", v.id, v.voucherNo),
      ];
    }

    case "FarmerAdvancePaid": {
      const p = event.payout;
      // Model B: Dr Farmer Finance Advance Control / Cr Bank
      return [
        debit(`LE-${p.id}-1`, p.payoutDate, "1400", "Farmer Finance Advance Control", p.farmerId, p.farmerName, p.netAmount, `Farmer advance ${p.batchRef} — ${p.farmerName}`, "Settlement", p.id, p.batchRef),
        credit(`LE-${p.id}-2`, p.payoutDate, "1100", "Bank - Current Account", null, null, p.netAmount, `Farmer payout batch ${p.batchRef}`, "Settlement", p.id, p.batchRef),
      ];
    }

    case "SarvaniRecovered": {
      const e = event;
      // Model B recovery: Dr Bank / Cr Farmer Finance Advance Control
      return [
        debit(`LE-REC-${e.voucherNo}-1`, e.date, "1100", "Bank - Current Account", null, null, e.amount, e.narration, "Voucher", e.voucherNo, e.voucherNo),
        credit(`LE-REC-${e.voucherNo}-2`, e.date, "1400", "Farmer Finance Advance Control", null, null, e.amount, `Recovery via ${e.voucherNo}`, "Voucher", e.voucherNo, e.voucherNo),
      ];
    }

    case "StockPurchased": {
      const b = event.batch;
      const totalCost = b.openingQty * b.purchaseRate;
      // Model C: Dr Inventory / Cr Sarvani Payable
      return [
        debit(`LE-STK-${b.id}-1`, b.purchaseDate, "1300", `Inventory - ${b.materialName}`, null, null, totalCost, `Stock purchase batch ${b.batchRef}`, "Invoice", event.purchaseInvoiceRef, event.purchaseInvoiceRef),
        credit(`LE-STK-${b.id}-2`, b.purchaseDate, "2102", "Sarvani Biofuels Payable", event.supplierPartyId, event.supplierName, totalCost, `Payable for batch ${b.batchRef}`, "Invoice", event.purchaseInvoiceRef, event.purchaseInvoiceRef),
      ];
    }

    case "StockSold": {
      const e = event;
      const saleValue = e.qty * e.rate;
      const cogs = e.qty * e.costRate;
      const margin = saleValue - cogs;
      // Dr Trader Receivable / Cr Sales + COGS recognition
      return [
        debit(`LE-SALE-${e.invoiceRef}-1`, e.date, "1202", "Trader Receivable", null, e.partyName, saleValue, `Trader sale ${e.invoiceRef} — ${e.qty} MT @${e.rate}`, "Invoice", e.invoiceRef, e.invoiceRef),
        credit(`LE-SALE-${e.invoiceRef}-2`, e.date, "3200", "Sales - Byproducts/Resale", null, null, saleValue, `Sale ${e.invoiceRef}`, "Invoice", e.invoiceRef, e.invoiceRef),
        debit(`LE-SALE-${e.invoiceRef}-3`, e.date, "4100", "Cost of Goods Sold", null, null, cogs, `COGS for ${e.invoiceRef} (margin ₹${margin.toFixed(0)})`, "Invoice", e.invoiceRef, e.invoiceRef),
        credit(`LE-SALE-${e.invoiceRef}-4`, e.date, "1300", `Inventory - Stock`, null, null, cogs, `Stock relief for ${e.invoiceRef}`, "Invoice", e.invoiceRef, e.invoiceRef),
      ];
    }

    default:
      return [];
  }
}

/**
 * Applies running balances to a time-ordered array of ledger entries
 * for a single account. Call after fetching all entries for an account.
 */
export function applyRunningBalance(entries: LedgerEntry[], openingBalance = 0): LedgerEntry[] {
  let balance = openingBalance;
  return entries.map((e) => {
    balance = balance + e.debit - e.credit;
    return { ...e, runningBalance: balance };
  });
}

/**
 * Checks that a set of postings is balanced (sum debits = sum credits).
 * Use in tests and the posting preview UI.
 */
export function isBalanced(entries: LedgerEntry[]): boolean {
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  return Math.abs(totalDebit - totalCredit) < 0.01;
}

// ── helpers ────────────────────────────────────────────────────────────────
function debit(
  id: string, date: string, code: string, name: string,
  partyId: string | null, partyName: string | null,
  amount: number, narration: string,
  sourceType: LedgerEntry["sourceType"], sourceId: string, sourceRef: string
): LedgerEntry {
  return { id, entryDate: date, accountCode: code, accountName: name, partyId, partyName, debit: amount, credit: 0, runningBalance: 0, narration, sourceType, sourceId, sourceRef };
}

function credit(
  id: string, date: string, code: string, name: string,
  partyId: string | null, partyName: string | null,
  amount: number, narration: string,
  sourceType: LedgerEntry["sourceType"], sourceId: string, sourceRef: string
): LedgerEntry {
  return { id, entryDate: date, accountCode: code, accountName: name, partyId, partyName, debit: 0, credit: amount, runningBalance: 0, narration, sourceType, sourceId, sourceRef };
}
