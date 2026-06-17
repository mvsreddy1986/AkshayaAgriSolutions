import type { InwardLot, QualityRule, MaterialParam, LedgerEntry, ParameterRule } from "@/lib/types";

// ── Output types ──────────────────────────────────────────────────────────────

/** Per-parameter settlement calculation result. */
export interface ParamCalc {
  paramKey: string;
  label: string;
  reading: number | string;
  baseValue?: number;
  excess?: number;
  weightDeductionKg: number;
  valueDeduction: number;
  rejectTrigger: boolean;
  breakdown: string;
}

/** Full settlement result for one lot. */
export interface SettlementCalc {
  lotId: string;
  documentRef: string;
  netWeight: number;
  grossSaleRate: number;         // may be computed from rate-slab
  paramCalcs: ParamCalc[];       // one entry per parameter that has a reading
  totalWeightDeductionKg: number;
  totalValueDeduction: number;   // informational — actual payout uses weight reduction
  netPayableWeight: number;
  grossSaleValue: number;        // netPayableWeight × grossSaleRate
  cessAmount: number;            // globalCessRate% × netWeight × grossSaleRate
  netSettlementValue: number;    // grossSaleValue − cessAmount
  hasRejectTrigger: boolean;
  rejectedParams: string[];
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

// ── Core engine ───────────────────────────────────────────────────────────────

/**
 * Calculates settlement for a single lot.
 *
 * Flow for "deduction" materials (Maize, DDGS, Biomass):
 *   grossSaleRate is pre-agreed on the lot → deductions reduce weight/value.
 *
 * Flow for "rate-slab" materials (Coal, Paddy Husk, Corn Oil):
 *   grossSaleRate is computed first from the primary rate-slab parameter reading,
 *   then secondary deductions (moisture etc.) are applied using that rate.
 */
export function calculateLotSettlement(lot: InwardLot, rule: QualityRule): SettlementCalc {
  const netWt = lot.netWeight;

  // Step 1 — resolve grossSaleRate
  let grossSaleRate = lot.grossSaleRate;

  if (rule.pricingModel === "rate-slab") {
    for (const pr of rule.paramRules) {
      if (!pr.rateSlabs?.length) continue;
      const reading = lot.qualityReadings[pr.paramKey];
      if (typeof reading !== "number") continue;
      const slab =
        pr.rateSlabs.find((s) => reading >= s.from && reading < s.to) ??
        pr.rateSlabs[pr.rateSlabs.length - 1];
      if (slab) { grossSaleRate = slab.rate; break; }
    }
  }

  // Step 2 — per-parameter deductions
  const paramCalcs: ParamCalc[] = [];
  let totalWeightDeductionKg = 0;
  let hasRejectTrigger = false;
  const rejectedParams: string[] = [];

  for (const pr of rule.paramRules) {
    const reading = lot.qualityReadings[pr.paramKey];
    if (reading === undefined || reading === null) continue;

    const calc = calcParam(pr, reading, netWt, grossSaleRate);
    paramCalcs.push(calc);
    totalWeightDeductionKg += calc.weightDeductionKg;
    if (calc.rejectTrigger) {
      hasRejectTrigger = true;
      rejectedParams.push(pr.paramKey);
    }
  }

  // Step 3 — settlement totals
  const netPayableWeight = Math.max(0, netWt - totalWeightDeductionKg / 1000);
  const grossSaleValue = r2(netPayableWeight * grossSaleRate);
  const cessAmount = r2((rule.globalCessRate / 100) * netWt * grossSaleRate);
  const totalValueDeduction = r2(paramCalcs.reduce((s, c) => s + c.valueDeduction, 0));
  const netSettlementValue = r2(grossSaleValue - cessAmount);

  return {
    lotId: lot.id,
    documentRef: lot.documentRef,
    netWeight: netWt,
    grossSaleRate,
    paramCalcs,
    totalWeightDeductionKg,
    totalValueDeduction,
    netPayableWeight,
    grossSaleValue,
    cessAmount,
    netSettlementValue,
    hasRejectTrigger,
    rejectedParams,
  };
}

/**
 * Aggregates settlement for a batch of lots.
 * Lots without a matching quality rule are silently skipped.
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

  return {
    batchRef,
    lotCount: calculations.length,
    totalNetWeight: calculations.reduce((s, c) => s + c.netWeight, 0),
    totalNetPayableWeight: calculations.reduce((s, c) => s + c.netPayableWeight, 0),
    totalGrossSaleValue: calculations.reduce((s, c) => s + c.grossSaleValue, 0),
    totalDeductions: calculations.reduce((s, c) => s + c.cessAmount, 0),
    totalNetSettlement: calculations.reduce((s, c) => s + c.netSettlementValue, 0),
    calculations,
  };
}

/**
 * Validates whether a lot is eligible for settlement.
 * Returns blocking issues — empty array means eligible.
 *
 * Pass materialParams to also validate required readings are present.
 */
export function validateLotForSettlement(
  lot: InwardLot,
  rules: QualityRule[],
  materialParams?: MaterialParam[]
): string[] {
  const issues: string[] = [];

  if (lot.status === "Settled" || lot.status === "Invoiced")
    issues.push(`Lot ${lot.documentRef} is already ${lot.status.toLowerCase()}`);
  if (lot.status === "QualityHold")
    issues.push(`Lot ${lot.documentRef} is on Quality Hold — resolve before settling`);
  if (lot.status === "Draft")
    issues.push(`Lot ${lot.documentRef} is in Draft — approve first`);

  const rule = lot.qualityRuleId
    ? rules.find((r) => r.id === lot.qualityRuleId)
    : undefined;

  if (!rule) {
    issues.push(`No quality rule found for lot ${lot.documentRef} (rule ID: ${lot.qualityRuleId ?? "unset"})`);
  } else {
    if (rule.status === "Draft")
      issues.push(`Quality rule for lot ${lot.documentRef} is still in Draft status`);

    // For deduction model the rate must be pre-set; for rate-slab it is computed
    if (rule.pricingModel === "deduction" && lot.grossSaleRate <= 0)
      issues.push(`Gross sale rate not set for lot ${lot.documentRef}`);

    // Required readings check
    if (materialParams) {
      const missing = materialParams
        .filter((p) => p.required && !(p.paramKey in lot.qualityReadings))
        .map((p) => p.label);
      if (missing.length > 0)
        issues.push(`Missing required quality readings: ${missing.join(", ")}`);
    }
  }

  if (lot.netWeight <= 0)
    issues.push(`Net weight is zero for lot ${lot.documentRef}`);

  return issues;
}

/**
 * Generates double-entry ledger postings for a settled batch.
 * Running balances must be applied by the caller via applyRunningBalance().
 */
export function generateSettlementPostings(
  summary: BatchSettlementSummary,
  partyId: string,
  partyName: string,
  invoiceRef: string,
  invoiceDate: string,
  gstRate: number
): LedgerEntry[] {
  const taxableValue = summary.totalNetSettlement;
  const gstAmount = taxableValue * gstRate;
  const totalInvoiceValue = taxableValue + gstAmount;
  const halfGst = r2(gstAmount / 2);

  return [
    {
      id: `LE-${invoiceRef}-DR`,
      entryDate: invoiceDate,
      accountCode: "1201",
      accountName: "Sarvani Biofuels Receivable",
      partyId, partyName,
      debit: r2(totalInvoiceValue),
      credit: 0, runningBalance: 0,
      narration: `Sales invoice ${invoiceRef} — ${summary.lotCount} lots, ${summary.totalNetPayableWeight.toFixed(3)} MT`,
      sourceType: "Invoice", sourceId: invoiceRef, sourceRef: invoiceRef,
    },
    {
      id: `LE-${invoiceRef}-CR-SALES`,
      entryDate: invoiceDate,
      accountCode: "3100",
      accountName: "Sales - Commodity",
      partyId: null, partyName: null,
      debit: 0, credit: r2(taxableValue), runningBalance: 0,
      narration: `Sales invoice ${invoiceRef} — taxable value`,
      sourceType: "Invoice", sourceId: invoiceRef, sourceRef: invoiceRef,
    },
    {
      id: `LE-${invoiceRef}-CR-CGST`,
      entryDate: invoiceDate,
      accountCode: "2201",
      accountName: "CGST Payable",
      partyId: null, partyName: null,
      debit: 0, credit: halfGst, runningBalance: 0,
      narration: `CGST on invoice ${invoiceRef}`,
      sourceType: "Invoice", sourceId: invoiceRef, sourceRef: invoiceRef,
    },
    {
      id: `LE-${invoiceRef}-CR-SGST`,
      entryDate: invoiceDate,
      accountCode: "2202",
      accountName: "SGST Payable",
      partyId: null, partyName: null,
      debit: 0, credit: halfGst, runningBalance: 0,
      narration: `SGST on invoice ${invoiceRef}`,
      sourceType: "Invoice", sourceId: invoiceRef, sourceRef: invoiceRef,
    },
  ];
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Round to 2 decimal places. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function makeCalc(
  paramKey: string, label: string, reading: number | string,
  weightDeductionKg: number, valueDeduction: number,
  rejectTrigger: boolean, breakdown: string,
  extras?: { baseValue?: number; excess?: number }
): ParamCalc {
  return {
    paramKey, label, reading,
    weightDeductionKg: r2(weightDeductionKg),
    valueDeduction: r2(valueDeduction),
    rejectTrigger, breakdown,
    ...extras,
  };
}

function calcParam(
  pr: ParameterRule,
  reading: number | string,
  netWtMT: number,
  rate: number
): ParamCalc {
  const label = pr.label ?? pr.paramKey;

  // ── Qualitative parameter ──────────────────────────────────────────────────
  if (typeof reading === "string") {
    if (!pr.qualitativeSlabs?.length)
      return makeCalc(pr.paramKey, label, reading, 0, 0, false, "Qualitative — no slabs defined");

    const slab = pr.qualitativeSlabs.find((s) => s.value === reading);
    if (!slab)
      return makeCalc(pr.paramKey, label, reading, 0, 0, false, `"${reading}": no matching slab — info only`);
    if (slab.rejectTrigger)
      return makeCalc(pr.paramKey, label, reading, 0, 0, true, `"${reading}": reject trigger`);

    const penalty = r2((1 - slab.rateMultiplier) * netWtMT * rate);
    return makeCalc(pr.paramKey, label, reading, 0, penalty, false,
      `"${reading}" × ${slab.rateMultiplier} multiplier → ₹${penalty.toFixed(2)} penalty`);
  }

  // ── Quantitative parameter ─────────────────────────────────────────────────
  const num = Number(reading);

  // Reject threshold check
  if (pr.rejectThreshold !== undefined && num > pr.rejectThreshold) {
    return makeCalc(pr.paramKey, label, num, 0, 0, true,
      `${num} > reject threshold ${pr.rejectThreshold} → QualityHold`);
  }

  // Rate-slab or info-only: rate already computed in step 1, no additional deduction here
  if (!pr.deductionMethod || pr.deductionMethod === "none") {
    return makeCalc(pr.paramKey, label, num, 0, 0, false,
      pr.rateSlabs?.length ? `Rate driver: ${num} → ₹${rate}/MT` : "Info only");
  }

  const baseValue = pr.baseValue ?? 0;
  const excess = Math.max(0, num - baseValue);

  switch (pr.deductionMethod) {
    case "linear": {
      const valueDeduction = r2(excess * (pr.linearRate ?? 0) * netWtMT);
      const weightDeductionKg = rate > 0 ? r2((valueDeduction / rate) * 1000) : 0;
      return makeCalc(pr.paramKey, label, num, weightDeductionKg, valueDeduction, false,
        `(${num} − ${baseValue} base) × ₹${pr.linearRate}/MT/% × ${netWtMT} MT = ₹${valueDeduction.toFixed(2)}`,
        { baseValue, excess });
    }

    case "actual-weight": {
      const weightDeductionKg = r2((num / 100) * netWtMT * 1000);
      const valueDeduction = r2((weightDeductionKg / 1000) * rate);
      return makeCalc(pr.paramKey, label, num, weightDeductionKg, valueDeduction, false,
        `${num}% of ${netWtMT} MT = ${weightDeductionKg.toFixed(2)} kg deducted`,
        { baseValue: 0, excess: num });
    }

    case "slab": {
      const slabs = pr.deductionSlabs ?? [];
      const slab =
        slabs.find((s) => excess >= s.from && excess < s.to) ??
        slabs[slabs.length - 1];
      const slabRate = slab?.rate ?? 0;
      const valueDeduction = r2(excess * slabRate * netWtMT);
      const weightDeductionKg = rate > 0 ? r2((valueDeduction / rate) * 1000) : 0;
      return makeCalc(pr.paramKey, label, num, weightDeductionKg, valueDeduction, false,
        `Excess ${excess.toFixed(2)}% in slab ₹${slabRate}/MT/% × ${netWtMT} MT = ₹${valueDeduction.toFixed(2)}`,
        { baseValue, excess });
    }

    default:
      return makeCalc(pr.paramKey, label, num, 0, 0, false, "No deduction method configured");
  }
}
