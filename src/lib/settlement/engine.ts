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
  effectiveCessRate: number;     // rate used (from material master or quality rule)
  cessTotal: number;             // effectiveCessRate% × grossSaleValue
  cessPaid: number;              // amount already paid at mandi gate (from lot readings)
  cessBalance: number;           // cessTotal − cessPaid (flows through this settlement)
  cessAmount: number;            // = cessBalance (backward-compat alias)
  holdPenalty: number;           // ₹ additional deduction for accepting out-of-spec lot
  netSettlementValue: number;    // grossSaleValue − cessBalance − holdPenalty
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
export function calculateLotSettlement(lot: InwardLot, rule: QualityRule, materialCessRate?: number): SettlementCalc {
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

  // When a held lot is accepted without a fixed penalty, extend normal deduction
  // through the reject threshold instead of showing zero (HOLD TRIGGER).
  const extendThroughReject =
    lot.status !== "QualityHold" &&
    !!lot.overrideReason &&
    (lot.holdPenalty ?? 0) === 0;

  for (const pr of rule.paramRules) {
    const reading = lot.qualityReadings[pr.paramKey];
    if (reading === undefined || reading === null) continue;

    const calc = calcParam(pr, reading, netWt, grossSaleRate, extendThroughReject);
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
  // Cess rate: prefer material master rate, fall back to quality rule rate
  const effectiveCessRate = materialCessRate !== undefined ? materialCessRate : rule.globalCessRate;
  // Total cess = rate% × gross notional (actual weighbridge weight × rate, before quality deductions)
  const cessTotal = r2((effectiveCessRate / 100) * netWt * grossSaleRate);
  // Paid at mandi gate by supplier — Akshaya reimburses this separately via gate-payment entry
  const cessPaid = r2(Math.min(lot.cessAmount > 0 ? lot.cessAmount : 0, cessTotal));
  // Balance = remaining cess not yet paid at gate (deducted from Sarvani's settlement payment)
  const cessBalance = r2(cessTotal - cessPaid);
  const cessAmount = cessBalance; // backward-compat alias
  const holdPenalty = r2(lot.holdPenalty ?? 0);
  const totalValueDeduction = r2(paramCalcs.reduce((s, c) => s + c.valueDeduction, 0));
  // netSettlementValue = grossSaleValue − cessBalance − holdPenalty (before Akshaya margin)
  // Display: grossSaleValue − cessTotal + cessPaid reimbursement = grossSaleValue − cessBalance
  // This is the effective base for a single supplier payment (margin deducted from here)
  const netSettlementValue = r2(grossSaleValue - cessBalance - holdPenalty);

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
    effectiveCessRate,
    cessTotal,
    cessPaid,
    cessBalance,
    cessAmount,
    holdPenalty,
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
    totalDeductions: calculations.reduce((s, c) => s + c.totalValueDeduction + c.cessAmount, 0),
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

  // Invoice must exist before settlement so Sarvani ledger entries are tied to a tax invoice
  if (!lot.invoiceId)
    issues.push(`Tax Invoice to Sarvani must be generated before posting settlement for lot ${lot.documentRef}`);

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

// ── Quality loss account mapping ──────────────────────────────────────────────

const QUALITY_ACCOUNTS: Record<string, { code: string; name: string }> = {
  moisture_pct:       { code: "4101", name: "Quality Loss — Moisture" },
  moisture:           { code: "4101", name: "Quality Loss — Moisture" },
  fm_pct:             { code: "4102", name: "Quality Loss — FM" },
  foreign_matter:     { code: "4102", name: "Quality Loss — FM" },
  foreign_matter_pct: { code: "4102", name: "Quality Loss — FM" },
  bg_pct:             { code: "4103", name: "Quality Loss — Broken Grain" },
  broken_grain:       { code: "4103", name: "Quality Loss — Broken Grain" },
  broken_grain_pct:   { code: "4103", name: "Quality Loss — Broken Grain" },
  gcv:                { code: "4110", name: "Quality Loss — GCV" },
  ash_pct:            { code: "4111", name: "Quality Loss — Ash" },
  protein_pct:        { code: "4112", name: "Quality Loss — Protein" },
};

export function paramQualityAccount(paramKey: string): { code: string; name: string } {
  return QUALITY_ACCOUNTS[paramKey.toLowerCase()] ?? {
    code: "4199",
    name: `Quality Loss — ${paramKey}`,
  };
}

/**
 * Generates double-entry ledger postings for a settled batch.
 *
 * Structure (Option B):
 *   Dr. 1201  Customer Receivable       net settlement (+ GST if applicable)
 *   Dr. 5101  Market Cess               total cess across lots
 *   Dr. 41XX  Quality Loss — <param>    per parameter, weight-based deductions only
 *   Cr. 3100  Sales — Commodity         gross notional (Σ netWeight × rate per lot)
 *   Cr. 2201/2202  GST Payable          when gstRate > 0
 *
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
  // Gross notional = full net weight × rate (base quality, before any deductions)
  const grossNotional = r2(
    summary.calculations.reduce((s, c) => s + c.netWeight * c.grossSaleRate, 0)
  );
  const totalCess = r2(summary.calculations.reduce((s, c) => s + c.cessAmount, 0));
  const totalHoldPenalty = r2(summary.calculations.reduce((s, c) => s + c.holdPenalty, 0));
  const gstAmount = r2(summary.totalNetSettlement * gstRate);
  const halfGst = r2(gstAmount / 2);

  // Aggregate weight-based quality deductions by param key across all lots
  const paramDeductions = new Map<string, { code: string; name: string; amount: number }>();
  for (const calc of summary.calculations) {
    for (const pc of calc.paramCalcs) {
      if (pc.valueDeduction <= 0 || pc.rejectTrigger || pc.weightDeductionKg === 0) continue;
      const acc = paramQualityAccount(pc.paramKey);
      const prev = paramDeductions.get(pc.paramKey);
      if (prev) {
        prev.amount = r2(prev.amount + pc.valueDeduction);
      } else {
        paramDeductions.set(pc.paramKey, { ...acc, amount: pc.valueDeduction });
      }
    }
  }

  const mk = (
    suffix: string, accountCode: string, accountName: string,
    debit: number, credit: number, narration: string,
    pId: string | null = null, pName: string | null = null
  ): LedgerEntry => ({
    id: `LE-${invoiceRef}-${suffix}`,
    entryDate: invoiceDate,
    accountCode, accountName,
    partyId: pId, partyName: pName,
    debit, credit, runningBalance: 0,
    narration,
    sourceType: "Invoice", sourceId: invoiceRef, sourceRef: invoiceRef,
  });

  const entries: LedgerEntry[] = [];

  // Dr. Customer Receivable
  entries.push(mk(
    "DR", "1201", "Sarvani Biofuels Receivable",
    r2(summary.totalNetSettlement + gstAmount), 0,
    `Sales invoice ${invoiceRef} — ${summary.lotCount} lots, ${summary.totalNetPayableWeight.toFixed(3)} MT`,
    partyId, partyName
  ));

  // Dr. Market Cess
  if (totalCess > 0) {
    entries.push(mk(
      "DR-CESS", "5101", "Market Cess",
      totalCess, 0,
      `Market cess — invoice ${invoiceRef}`
    ));
  }

  // Dr. Quality Loss per parameter
  let qlIdx = 0;
  for (const [paramKey, { code, name, amount }] of paramDeductions) {
    void paramKey;
    entries.push(mk(
      `DR-QL-${qlIdx++}`, code, name,
      amount, 0,
      `${name} — invoice ${invoiceRef}`
    ));
  }

  // Dr. Quality Hold Penalty
  if (totalHoldPenalty > 0) {
    entries.push(mk(
      "DR-HOLD", "4199", "Quality Loss — Hold Penalty",
      totalHoldPenalty, 0,
      `Hold penalty accepted — invoice ${invoiceRef}`
    ));
  }

  // Cr. Sales — Commodity (gross notional, ex-GST)
  entries.push(mk(
    "CR-SALES", "3100", "Sales - Commodity",
    0, grossNotional,
    `Sales invoice ${invoiceRef} — gross notional`
  ));

  // Cr. GST Payable (only when applicable)
  if (halfGst > 0) {
    entries.push(mk("CR-CGST", "2201", "CGST Payable", 0, halfGst, `CGST on invoice ${invoiceRef}`));
    entries.push(mk("CR-SGST", "2202", "SGST Payable", 0, halfGst, `SGST on invoice ${invoiceRef}`));
  }

  return entries;
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
  rate: number,
  extendThroughReject = false
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
  let wasHoldExtended = false;
  if (pr.rejectThreshold !== undefined && num > pr.rejectThreshold) {
    if (!extendThroughReject) {
      return makeCalc(pr.paramKey, label, num, 0, 0, true,
        `${num} > reject threshold ${pr.rejectThreshold} → QualityHold`);
    }
    // Lot accepted without fixed penalty — extend normal deduction through threshold
    wasHoldExtended = true;
  }

  // Rate-slab or info-only: rate already computed in step 1, no additional deduction here
  if (!pr.deductionMethod || pr.deductionMethod === "none") {
    return makeCalc(pr.paramKey, label, num, 0, 0, false,
      pr.rateSlabs?.length ? `Rate driver: ${num} → ₹${rate}/MT` : "Info only");
  }

  const baseValue = pr.baseValue ?? 0;
  const excess = Math.max(0, num - baseValue);
  const extPrefix = wasHoldExtended
    ? `Extended past reject (${pr.rejectThreshold}) — accepted without penalty · `
    : "";

  switch (pr.deductionMethod) {
    case "linear": {
      const valueDeduction = r2(excess * (pr.linearRate ?? 0) * netWtMT);
      const weightDeductionKg = rate > 0 ? r2((valueDeduction / rate) * 1000) : 0;
      return makeCalc(pr.paramKey, label, num, weightDeductionKg, valueDeduction, false,
        `${extPrefix}(${num} − ${baseValue} base) × ₹${pr.linearRate}/MT/% × ${netWtMT} MT = ₹${valueDeduction.toFixed(2)}`,
        { baseValue, excess });
    }

    case "value-pct": {
      const weightDeductionKg = r2((excess / 100) * netWtMT * 1000);
      const valueDeduction = r2((weightDeductionKg / 1000) * rate);
      return makeCalc(pr.paramKey, label, num, weightDeductionKg, valueDeduction, false,
        `${extPrefix}(${num} − ${baseValue} base) × ₹${rate}/MT × ${netWtMT} MT / 100 = ₹${valueDeduction.toFixed(2)}`,
        { baseValue, excess });
    }

    case "actual-weight": {
      const weightDeductionKg = r2((num / 100) * netWtMT * 1000);
      const valueDeduction = r2((weightDeductionKg / 1000) * rate);
      return makeCalc(pr.paramKey, label, num, weightDeductionKg, valueDeduction, false,
        `${extPrefix}${num}% of ${netWtMT} MT = ${weightDeductionKg.toFixed(2)} kg deducted`,
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
        `${extPrefix}Excess ${excess.toFixed(2)}% in slab ₹${slabRate}/MT/% × ${netWtMT} MT = ₹${valueDeduction.toFixed(2)}`,
        { baseValue, excess });
    }

    default:
      return makeCalc(pr.paramKey, label, num, 0, 0, false, "No deduction method configured");
  }
}
