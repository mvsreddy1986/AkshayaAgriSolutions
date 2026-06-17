import type { InwardLot, QualityRule, LedgerEntry } from "@/lib/types";

export interface SettlementCalc {
  lotId: string;
  documentRef: string;
  netWeight: number;
  moisturePct: number;
  fmPct: number;
  baseMoisture: number;
  // Weight-equivalent deductions
  moistureDeductionKg: number;
  fmDeductionKg: number;
  // Value deductions
  moistureDeductionAmt: number;
  fmDeductionAmt: number;
  cessAmount: number;
  totalDeductionAmt: number;
  // Settlement output
  netPayableWeight: number;
  grossSaleRate: number;
  grossSaleValue: number;
  netSettlementValue: number;
  // Breakdown strings for display
  moistureBreakdown: string;
  fmBreakdown: string;
  cessBreakdown: string;
}

export interface BatchSettlementSummary {
  batchRef: string;
  lotCount: number;
  totalNetWeight: number;
  totalNetPayableWeight: number;
  totalGrossSaleValue: number;
  totalDeductions: number;
  totalNetSettlement: number;
  calculations: SettlementCalc[];
}

/**
 * Calculates settlement for a single inward lot using the quality rule
 * that was active on the lot date. Uses the lot's already-stored quality
 * values (moisture%, FM%) to produce weight-equivalent and rupee deductions.
 *
 * IMPORTANT: Never mutates the lot. Returns a pure calculation result.
 * Historical lots always re-derive from their stored qualityRuleId snapshot.
 */
export function calculateLotSettlement(
  lot: InwardLot,
  rule: QualityRule
): SettlementCalc {
  const netWt = lot.netWeight; // MT
  const rate = lot.grossSaleRate; // ₹/MT

  // --- Moisture deduction ---
  let moistureDeductionKg = 0;
  let moistureDeductionAmt = 0;
  let moistureBreakdown = "None";

  const excessMoisture = Math.max(0, lot.moisturePct - rule.baseMoisture);

  if (rule.moistureDeductionMethod === "linear" && excessMoisture > 0) {
    // Linear: for every 1% above base, deduct moistureRatePerPct ₹/MT × netWeight
    moistureDeductionAmt = excessMoisture * rule.moistureRatePerPct * netWt;
    // Weight-equivalent: value deduction ÷ rate
    moistureDeductionKg = rate > 0 ? moistureDeductionAmt / rate : 0;
    moistureBreakdown = `(${lot.moisturePct}% - ${rule.baseMoisture}% base) × ₹${rule.moistureRatePerPct}/MT/% × ${netWt} MT = ₹${moistureDeductionAmt.toFixed(2)}`;
  } else if (rule.moistureDeductionMethod === "slab") {
    // Slab: percentage weight deduction at rate per slab tier
    const deductionPct = excessMoisture * (rule.moistureRatePerPct / 100);
    moistureDeductionKg = netWt * deductionPct * 1000; // kg
    moistureDeductionAmt = (moistureDeductionKg / 1000) * rate;
    moistureBreakdown = `Slab ${lot.moisturePct}%: ${(deductionPct * 100).toFixed(2)}% of ${netWt} MT = ${moistureDeductionKg.toFixed(1)} kg`;
  }

  // --- FM (Foreign Matter) deduction ---
  let fmDeductionKg = 0;
  let fmDeductionAmt = 0;
  let fmBreakdown = "None";

  if (rule.fmDeductionMethod === "actual" && lot.fmPct > 0) {
    // Actual: full FM% of netWeight is deducted
    fmDeductionKg = (lot.fmPct / 100) * netWt * 1000; // kg
    fmDeductionAmt = (fmDeductionKg / 1000) * rate;
    fmBreakdown = `${lot.fmPct}% FM × ${netWt} MT × ₹${rate}/MT = ₹${fmDeductionAmt.toFixed(2)}`;
  } else if (rule.fmDeductionMethod === "slab" && lot.fmPct > 0) {
    fmDeductionAmt = lot.fmPct * rule.fmRatePerPct * netWt;
    fmDeductionKg = rate > 0 ? (fmDeductionAmt / rate) * 1000 : 0;
    fmBreakdown = `${lot.fmPct}% FM × ₹${rule.fmRatePerPct}/MT/% × ${netWt} MT = ₹${fmDeductionAmt.toFixed(2)}`;
  }

  // --- Cess ---
  const grossValueBeforeCess = netWt * rate;
  const cessAmount = (rule.cessRate / 100) * grossValueBeforeCess;
  const cessBreakdown = rule.cessRate > 0
    ? `${rule.cessRate}% cess on ₹${grossValueBeforeCess.toFixed(2)} = ₹${cessAmount.toFixed(2)}`
    : "None";

  // --- Net payable weight (MT) ---
  const deductedMT = (moistureDeductionKg + fmDeductionKg) / 1000;
  const netPayableWeight = Math.max(0, netWt - deductedMT);

  // --- Values ---
  const grossSaleValue = netPayableWeight * rate;
  const totalDeductionAmt = moistureDeductionAmt + fmDeductionAmt + cessAmount;
  const netSettlementValue = grossSaleValue - cessAmount;

  return {
    lotId: lot.id,
    documentRef: lot.documentRef,
    netWeight: netWt,
    moisturePct: lot.moisturePct,
    fmPct: lot.fmPct,
    baseMoisture: rule.baseMoisture,
    moistureDeductionKg,
    fmDeductionKg,
    moistureDeductionAmt,
    fmDeductionAmt,
    cessAmount,
    totalDeductionAmt,
    netPayableWeight,
    grossSaleRate: rate,
    grossSaleValue,
    netSettlementValue,
    moistureBreakdown,
    fmBreakdown,
    cessBreakdown,
  };
}

/**
 * Aggregates settlement calculations for a batch of lots (e.g., all lots
 * in a single import batch or a supplier's delivery for a period).
 */
export function calculateBatchSettlement(
  lots: InwardLot[],
  rules: QualityRule[],
  batchRef: string
): BatchSettlementSummary {
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  const calculations = lots
    .map((lot) => {
      const rule = lot.qualityRuleId ? ruleMap.get(lot.qualityRuleId) : undefined;
      if (!rule) return null;
      return calculateLotSettlement(lot, rule);
    })
    .filter((c): c is SettlementCalc => c !== null);

  const totalNetWeight = calculations.reduce((s, c) => s + c.netWeight, 0);
  const totalNetPayableWeight = calculations.reduce((s, c) => s + c.netPayableWeight, 0);
  const totalGrossSaleValue = calculations.reduce((s, c) => s + c.grossSaleValue, 0);
  const totalDeductions = calculations.reduce((s, c) => s + c.totalDeductionAmt, 0);
  const totalNetSettlement = calculations.reduce((s, c) => s + c.netSettlementValue, 0);

  return {
    batchRef,
    lotCount: calculations.length,
    totalNetWeight,
    totalNetPayableWeight,
    totalGrossSaleValue,
    totalDeductions,
    totalNetSettlement,
    calculations,
  };
}

/**
 * Validates whether a lot is eligible for settlement.
 * Returns an array of blocking issues (empty = eligible).
 */
export function validateLotForSettlement(lot: InwardLot, rules: QualityRule[]): string[] {
  const issues: string[] = [];

  if (lot.status === "Settled" || lot.status === "Invoiced") {
    issues.push(`Lot ${lot.documentRef} is already ${lot.status.toLowerCase()}`);
  }
  if (lot.status === "QualityHold") {
    issues.push(`Lot ${lot.documentRef} is on Quality Hold — resolve before settling`);
  }
  if (lot.status === "Draft") {
    issues.push(`Lot ${lot.documentRef} is in Draft — approve first`);
  }

  const rule = lot.qualityRuleId ? rules.find((r) => r.id === lot.qualityRuleId) : undefined;
  if (!rule) {
    issues.push(`No quality rule found for lot ${lot.documentRef} (rule ID: ${lot.qualityRuleId ?? "unset"})`);
  } else if (rule.status === "Draft") {
    issues.push(`Quality rule for lot ${lot.documentRef} is still in Draft status`);
  }

  if (lot.grossSaleRate <= 0) {
    issues.push(`Gross sale rate not set for lot ${lot.documentRef}`);
  }
  if (lot.netWeight <= 0) {
    issues.push(`Net weight is zero for lot ${lot.documentRef}`);
  }

  return issues;
}

/**
 * Generates double-entry ledger postings for a settled batch.
 * Used by the auto-ledger posting engine.
 *
 * Model A settlement posts:
 *   Dr Sarvani Receivable (1201)  — grossSaleValue + GST
 *   Cr Sales - Maize (3100)       — grossSaleValue
 *   Cr GST Payable (2200)         — tax portion
 */
export function generateSettlementPostings(
  summary: BatchSettlementSummary,
  partyId: string,
  partyName: string,
  invoiceRef: string,
  invoiceDate: string,
  gstRate: number // e.g., 0.05 for 5%
): LedgerEntry[] {
  const taxableValue = summary.totalNetSettlement;
  const gstAmount = taxableValue * gstRate;
  const totalInvoiceValue = taxableValue + gstAmount;
  const halfGst = gstAmount / 2;

  const entries: LedgerEntry[] = [
    {
      id: `LE-${invoiceRef}-DR`,
      entryDate: invoiceDate,
      accountCode: "1201",
      accountName: "Sarvani Biofuels Receivable",
      partyId,
      partyName,
      debit: totalInvoiceValue,
      credit: 0,
      runningBalance: 0, // caller must compute running balance
      narration: `Sales invoice ${invoiceRef} — ${summary.lotCount} lots, ${summary.totalNetPayableWeight.toFixed(3)} MT`,
      sourceType: "Invoice",
      sourceId: invoiceRef,
      sourceRef: invoiceRef,
    },
    {
      id: `LE-${invoiceRef}-CR-SALES`,
      entryDate: invoiceDate,
      accountCode: "3100",
      accountName: "Sales - Commodity",
      partyId: null,
      partyName: null,
      debit: 0,
      credit: taxableValue,
      runningBalance: 0,
      narration: `Sales invoice ${invoiceRef} — taxable value`,
      sourceType: "Invoice",
      sourceId: invoiceRef,
      sourceRef: invoiceRef,
    },
    {
      id: `LE-${invoiceRef}-CR-CGST`,
      entryDate: invoiceDate,
      accountCode: "2201",
      accountName: "CGST Payable",
      partyId: null,
      partyName: null,
      debit: 0,
      credit: halfGst,
      runningBalance: 0,
      narration: `CGST on invoice ${invoiceRef}`,
      sourceType: "Invoice",
      sourceId: invoiceRef,
      sourceRef: invoiceRef,
    },
    {
      id: `LE-${invoiceRef}-CR-SGST`,
      entryDate: invoiceDate,
      accountCode: "2202",
      accountName: "SGST Payable",
      partyId: null,
      partyName: null,
      debit: 0,
      credit: halfGst,
      runningBalance: 0,
      narration: `SGST on invoice ${invoiceRef}`,
      sourceType: "Invoice",
      sourceId: invoiceRef,
      sourceRef: invoiceRef,
    },
  ];

  return entries;
}
