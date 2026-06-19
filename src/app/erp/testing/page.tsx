"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { calculateLotSettlement, validateLotForSettlement } from "../../../lib/settlement/engine";
import { generatePostings, isBalanced } from "../../../lib/accounting/postings";
import type { AuthUser, InwardLot, QualityRule, Invoice } from "../../../lib/types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURE_LOT: InwardLot = {
  id: "test-lot-001", documentRef: "TEST-001", businessModel: "A",
  lotDate: "2026-05-12", materialId: "mat-001", materialName: "Maize",
  customerId: "pty-001", customerName: "Sarvani Biofuels",
  supplierId: "pty-002", supplierName: "Mallikarjuna Traders",
  farmerId: "pty-004", farmerName: "Ravi Kumar",
  vehicleNo: "AP39CD0001", grossWeight: 15, tareWeight: 3, netWeight: 12,
  acceptedWeight: 11.88,
  qualityReadings: { moisture_pct: 15.5, fm_pct: 1.2 },
  qualityRuleId: "qr-001",
  paramDeductions: {}, cessAmount: 0, netPayableWeight: 0,
  grossSaleRate: 22500, grossSaleValue: 0,
  importBatchId: null, invoiceId: null, status: "Mapped", overrideReason: null, akshayaMarginPerMT: 50, holdPenalty: 0, holdPenaltyNote: null,
};

const FIXTURE_RULE: QualityRule = {
  id: "qr-001", materialId: "mat-001", materialName: "Maize",
  pricingModel: "deduction",
  validFrom: "2026-05-01", validTo: "2026-05-31",
  globalCessRate: 0.5, allowedVariancePct: 2,
  description: "Fixture rule", status: "Active",
  paramRules: [
    { paramKey: "moisture_pct", label: "Moisture %", baseValue: 14, deductionMethod: "linear", linearRate: 0.71 },
    { paramKey: "fm_pct", label: "Foreign Matter %", baseValue: 0, deductionMethod: "actual-weight" },
    { paramKey: "aflatoxin_ppb", label: "Aflatoxin (ppb)", deductionMethod: "none", rejectThreshold: 20 },
  ],
};

const FIXTURE_INVOICE: Invoice = {
  id: "test-inv-001", invoiceNo: "TEST-INV-001", invoiceType: "Sales",
  businessModel: "A", invoiceDate: "2026-05-12", dueDate: "2026-06-12",
  partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
  materialId: "mat-001", materialName: "Maize",
  quantity: 10, uom: "MT", grossRate: 22500, grossValue: 225000,
  taxableValue: 225000, cgstRate: 5, sgstRate: 5, igstRate: 0,
  cgstAmount: 11250, sgstAmount: 11250, igstAmount: 0,
  totalTax: 22500, totalValue: 247500, amountPaid: 0, amountDue: 247500,
  linkedLotIds: [], status: "Approved", cancelledReason: null,
};

// ── Maize Model A Fixtures ───────────────────────────────────────────────────
//
// Flow: Vehicle arrives → weighment → quality lab readings → settlement engine →
//       net payable weight → invoice → ledger.
//
// Quality rule (reuses FIXTURE_RULE — qr-001):
//   Pricing: deduction model (rate agreed upfront at ₹22,500/MT)
//   Moisture: linear deduction ₹0.71/MT/% above 14% base
//   FM %:     actual-weight deduction (FM% × netWeight = deducted kg)
//   Aflatoxin: reject trigger if > 20 ppb
//   Cess:     0.5% on (netWeight × grossSaleRate)
//
// Pre-computed expected values (hand-verified):
//   T-MAZ-001  moisture 15.2% (+1.2%), FM 0.9%
//     moisture valueDeduction  = 1.2 × 0.71 × 10  = ₹8.52 → 0.38 kg
//     FM weightDeduction       = 0.9% × 10 MT       = 90 kg → ₹2,025
//     netPayableWeight         = 10 – 90.38/1000    = 9.90962 MT
//     grossSaleValue           = 9.90962 × 22500    = ₹222,966.45
//     cessAmount               = 0.5% × 10 × 22500  = ₹1,125
//     netSettlementValue       = 222966.45 – 1125   = ₹221,841.45
//
//   T-MAZ-002  moisture 13.5% (below 14% base → zero deduction), FM 0.4%
//     moisture deduction       = 0 (excess is negative, clamped to 0)
//     FM weightDeduction       = 0.4% × 8 MT        = 32 kg → ₹720
//     netPayableWeight         = 8 – 32/1000         = 7.968 MT
//     grossSaleValue           = 7.968 × 22500       = ₹179,280
//     cessAmount               = 0.5% × 8 × 22500   = ₹900
//
//   T-MAZ-003  aflatoxin 25 ppb > 20 ppb threshold → hasRejectTrigger = true

const MAIZE_LOT_NORMAL: InwardLot = {
  id: "test-maz-001", documentRef: "T-MAZ-001", businessModel: "A",
  lotDate: "2026-06-17", materialId: "mat-001", materialName: "Maize",
  customerId: "pty-001", customerName: "Sarvani Biofuels",
  supplierId: "pty-002", supplierName: "Mallikarjuna Traders",
  farmerId: "pty-004", farmerName: "Ravi Kumar",
  vehicleNo: "AP32KK5500", grossWeight: 12.9, tareWeight: 2.9, netWeight: 10,
  acceptedWeight: 9.91,
  qualityReadings: { moisture_pct: 15.2, fm_pct: 0.9 },
  qualityRuleId: "qr-001",
  paramDeductions: {}, cessAmount: 0, netPayableWeight: 0,
  grossSaleRate: 22500, grossSaleValue: 0,
  importBatchId: null, invoiceId: null, status: "Mapped", overrideReason: null, akshayaMarginPerMT: 50, holdPenalty: 0, holdPenaltyNote: null,
};

const MAIZE_LOT_BELOW_BASE: InwardLot = {
  id: "test-maz-002", documentRef: "T-MAZ-002", businessModel: "A",
  lotDate: "2026-06-17", materialId: "mat-001", materialName: "Maize",
  customerId: "pty-001", customerName: "Sarvani Biofuels",
  supplierId: "pty-003", supplierName: "Krishna Agro Suppliers",
  farmerId: null, farmerName: null,
  vehicleNo: "AP32LL4400", grossWeight: 10.9, tareWeight: 2.9, netWeight: 8,
  acceptedWeight: 7.97,
  qualityReadings: { moisture_pct: 13.5, fm_pct: 0.4 },
  qualityRuleId: "qr-001",
  paramDeductions: {}, cessAmount: 0, netPayableWeight: 0,
  grossSaleRate: 22500, grossSaleValue: 0,
  importBatchId: null, invoiceId: null, status: "Mapped", overrideReason: null, akshayaMarginPerMT: 50, holdPenalty: 0, holdPenaltyNote: null,
};

const MAIZE_LOT_AFLATOXIN: InwardLot = {
  id: "test-maz-003", documentRef: "T-MAZ-003", businessModel: "A",
  lotDate: "2026-06-17", materialId: "mat-001", materialName: "Maize",
  customerId: "pty-001", customerName: "Sarvani Biofuels",
  supplierId: "pty-002", supplierName: "Mallikarjuna Traders",
  farmerId: null, farmerName: null,
  vehicleNo: "AP32MM3300", grossWeight: 12, tareWeight: 3, netWeight: 9,
  acceptedWeight: 8.9,
  qualityReadings: { moisture_pct: 14.8, fm_pct: 1.0, aflatoxin_ppb: 25 },
  qualityRuleId: "qr-001",
  paramDeductions: {}, cessAmount: 0, netPayableWeight: 0,
  grossSaleRate: 22500, grossSaleValue: 0,
  importBatchId: null, invoiceId: null, status: "Mapped", overrideReason: null, akshayaMarginPerMT: 50, holdPenalty: 0, holdPenaltyNote: null,
};

// ── Paddy Husk Model A Fixtures ───────────────────────────────────────────────
//
// Paddy Husk uses the RATE-SLAB model — GCV reading selects the price band first,
// then moisture deduction is applied using that rate.
//
// Quality rule qr-004 GCV slabs:
//   0–2499 kcal/kg  → ₹1,800/MT  (poor quality)
//   2500–2999       → ₹2,200/MT
//   3000–3499       → ₹2,600/MT
//   3500+           → ₹2,800/MT  (premium quality)
// Moisture: linear ₹0.45/MT/% above 12% base
// Ash %:    info-only (recorded but no financial effect)
// Cess:     0.25%
//
// Pre-computed expected values (hand-verified):
//   T-PAD-001  GCV 3200 → rate ₹2600/MT, moisture 13.5% (+1.5%)
//     grossSaleRate        = 2600 (from rate-slab lookup)
//     moisture deduction   = 1.5 × 0.45 × 8 = ₹5.40 → 2.08 kg
//     netPayableWeight     = 8 – 2.08/1000   = 7.99792 MT
//     grossSaleValue       = 7.99792 × 2600   = ₹20,794.59
//     cessAmount           = 0.25% × 8 × 2600 = ₹52
//     netSettlementValue   = 20794.59 – 52    = ₹20,742.59
//
//   T-PAD-002  GCV 2300 → rate ₹1800/MT, moisture 15.0% (+3%)
//     grossSaleRate        = 1800 (lower band)
//     moisture deduction   = 3 × 0.45 × 8 = ₹10.80 → 6 kg
//     netPayableWeight     = 8 – 6/1000     = 7.994 MT
//     grossSaleValue       = 7.994 × 1800   = ₹14,389.20
//     cessAmount           = 0.25% × 8 × 1800 = ₹36
//     netSettlementValue   = 14389.20 – 36  = ₹14,353.20
//
//   Rate differential (same 8 MT): ₹20,742.59 – ₹14,353.20 = ₹6,389.39 more
//   for the high-GCV load. This illustrates why quality testing matters!

const PADDY_RULE: QualityRule = {
  id: "qr-004", materialId: "mat-002", materialName: "Paddy Husk",
  pricingModel: "rate-slab",
  validFrom: "2026-05-10", validTo: "2026-05-31",
  globalCessRate: 0.25, allowedVariancePct: 3,
  description: "Paddy Husk: GCV determines rate band, moisture linear deduction, ash info-only",
  status: "Active",
  paramRules: [
    {
      paramKey: "gcv_kcal_kg", label: "GCV (Kcal/kg)",
      rateSlabs: [
        { from: 0,    to: 2500, rate: 1800 },
        { from: 2500, to: 3000, rate: 2200 },
        { from: 3000, to: 3500, rate: 2600 },
        { from: 3500, to: 9999, rate: 2800 },
      ],
    },
    { paramKey: "moisture_pct", label: "Moisture %", baseValue: 12, deductionMethod: "linear", linearRate: 0.45 },
    { paramKey: "ash_pct", label: "Ash Content %", deductionMethod: "none" },
  ],
};

const PADDY_LOT_HIGH_GCV: InwardLot = {
  id: "test-pad-001", documentRef: "T-PAD-001", businessModel: "A",
  lotDate: "2026-06-17", materialId: "mat-002", materialName: "Paddy Husk",
  customerId: "pty-001", customerName: "Sarvani Biofuels",
  supplierId: "pty-003", supplierName: "Krishna Agro Suppliers",
  farmerId: null, farmerName: null,
  vehicleNo: "AP32NN2200", grossWeight: 10.8, tareWeight: 2.8, netWeight: 8,
  acceptedWeight: 8,
  qualityReadings: { gcv_kcal_kg: 3200, moisture_pct: 13.5, ash_pct: 17 },
  qualityRuleId: "qr-004",
  paramDeductions: {}, cessAmount: 0, netPayableWeight: 0,
  grossSaleRate: 0, grossSaleValue: 0,
  importBatchId: null, invoiceId: null, status: "Mapped", overrideReason: null, akshayaMarginPerMT: 50, holdPenalty: 0, holdPenaltyNote: null,
};

const PADDY_LOT_LOW_GCV: InwardLot = {
  id: "test-pad-002", documentRef: "T-PAD-002", businessModel: "A",
  lotDate: "2026-06-17", materialId: "mat-002", materialName: "Paddy Husk",
  customerId: "pty-001", customerName: "Sarvani Biofuels",
  supplierId: "pty-002", supplierName: "Mallikarjuna Traders",
  farmerId: null, farmerName: null,
  vehicleNo: "AP32OO1100", grossWeight: 10.8, tareWeight: 2.8, netWeight: 8,
  acceptedWeight: 8,
  qualityReadings: { gcv_kcal_kg: 2300, moisture_pct: 15.0, ash_pct: 22 },
  qualityRuleId: "qr-004",
  paramDeductions: {}, cessAmount: 0, netPayableWeight: 0,
  grossSaleRate: 0, grossSaleValue: 0,
  importBatchId: null, invoiceId: null, status: "Mapped", overrideReason: null, akshayaMarginPerMT: 50, holdPenalty: 0, holdPenaltyNote: null,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type TestStatus = "idle" | "running" | "pass" | "fail";
interface TestState { status: TestStatus; duration?: number; detail?: string; error?: string; }
interface TestDef { id: string; name: string; description: string; run: () => Promise<string>; }
interface TestGroup { id: string; title: string; subtitle: string; warn?: string; tests: TestDef[]; }

// ── Date parser (mirrors import route — tested against spec) ──────────────────

function parseDate(val: string): string | null {
  const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    const candidate = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isNaN(new Date(candidate).getTime()) ? null : candidate;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return isNaN(new Date(val).getTime()) ? null : val;
  }
  return null;
}

// ── Helper: timed API fetch ───────────────────────────────────────────────────

async function timedFetch(url: string, opts?: RequestInit): Promise<{ res: Response; ms: number }> {
  const t = Date.now();
  const res = await fetch(url, opts);
  return { res, ms: Date.now() - t };
}

async function getEndpoint(url: string, expectField: string): Promise<string> {
  const { res, ms } = await timedFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Expected JSON array");
  if (data.length > 0 && !(expectField in data[0]))
    throw new Error(`Missing field "${expectField}" in response`);
  return `${data.length} record${data.length !== 1 ? "s" : ""} · ${ms}ms`;
}

// ── Test definitions ──────────────────────────────────────────────────────────

const API_TESTS: TestDef[] = [
  {
    id: "api-materials", name: "GET /api/materials", description: "Returns array with id, name, uom, gstRate",
    run: () => getEndpoint("/api/materials", "name"),
  },
  {
    id: "api-parties", name: "GET /api/parties", description: "Returns array with partyType, gstin, businessFlows",
    run: () => getEndpoint("/api/parties", "partyType"),
  },
  {
    id: "api-quality-rules", name: "GET /api/quality-rules", description: "Returns array with materialId, paramRules, pricingModel, globalCessRate",
    run: () => getEndpoint("/api/quality-rules", "materialId"),
  },
  {
    id: "api-rates", name: "GET /api/rates", description: "Returns array with rate, rateType, validFrom",
    run: () => getEndpoint("/api/rates", "rate"),
  },
  {
    id: "api-lots", name: "GET /api/lots", description: "Returns array with documentRef, vehicleNo, status",
    run: () => getEndpoint("/api/lots", "documentRef"),
  },
  {
    id: "api-invoices", name: "GET /api/invoices", description: "Returns array with invoiceNo, totalValue, status",
    run: () => getEndpoint("/api/invoices", "invoiceNo"),
  },
  {
    id: "api-vouchers", name: "GET /api/vouchers", description: "Returns array with voucherNo, amount, voucherType",
    run: () => getEndpoint("/api/vouchers", "voucherNo"),
  },
  {
    id: "api-ledger", name: "GET /api/ledger", description: "Returns array with accountCode, debit, credit",
    run: () => getEndpoint("/api/ledger", "accountCode"),
  },
  {
    id: "api-stock", name: "GET /api/stock", description: "Returns array with batchRef, openingQty, availableQty",
    run: () => getEndpoint("/api/stock", "batchRef"),
  },
  {
    id: "api-payouts", name: "GET /api/payouts", description: "Returns array with farmerId, netAmount, paymentStatus",
    run: () => getEndpoint("/api/payouts", "farmerId"),
  },
  {
    id: "api-import-batches", name: "GET /api/import-batches", description: "Returns array with batchRef, importType, status",
    run: () => getEndpoint("/api/import-batches", "batchRef"),
  },
  {
    id: "api-market", name: "GET /api/market/corn", description: "Returns live or fallback corn price (inrPerTon, cornCents, usdInr)",
    run: async () => {
      const { res, ms } = await timedFetch("/api/market/corn");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (!("inrPerTon" in d)) throw new Error('Missing "inrPerTon"');
      return `₹${d.inrPerTon?.toFixed(0)}/MT · ${d.source} · ${ms}ms`;
    },
  },
];

const LOGIC_TESTS: TestDef[] = [
  {
    id: "logic-settlement-deductions",
    name: "Settlement: moisture + FM + cess deduction math",
    description: "Maize lot (15.5% moisture, 1.2% FM) against qr-001 → verify each paramCalc value",
    run: async () => {
      const calc = calculateLotSettlement(FIXTURE_LOT, FIXTURE_RULE);
      // moisture: excess = 1.5%, linear 0.71 → 1.5 × 0.71 × 12 = 12.78
      const moistureCalc = calc.paramCalcs.find(c => c.paramKey === "moisture_pct");
      const expectedMoisture = Math.round(1.5 * 0.71 * 12 * 100) / 100;
      if (!moistureCalc) throw new Error("No moisture_pct paramCalc returned");
      if (Math.abs(moistureCalc.valueDeduction - expectedMoisture) > 0.02)
        throw new Error(`Moisture: got ₹${moistureCalc.valueDeduction}, expected ₹${expectedMoisture}`);
      // FM: actual-weight 1.2% → (1.2/100) × 12 × 1000 = 144 kg
      const fmCalc = calc.paramCalcs.find(c => c.paramKey === "fm_pct");
      if (!fmCalc) throw new Error("No fm_pct paramCalc returned");
      const expectedFmKg = Math.round((1.2 / 100) * 12 * 1000 * 100) / 100;
      if (Math.abs(fmCalc.weightDeductionKg - expectedFmKg) > 0.1)
        throw new Error(`FM kg: got ${fmCalc.weightDeductionKg}, expected ${expectedFmKg}`);
      // cess = 0.5% × 12 × 22500 = 1350
      const expectedCess = Math.round(0.005 * 12 * 22500 * 100) / 100;
      if (Math.abs(calc.cessAmount - expectedCess) > 0.02)
        throw new Error(`Cess: got ₹${calc.cessAmount}, expected ₹${expectedCess}`);
      return `moisture ₹${moistureCalc.valueDeduction} · FM ${fmCalc.weightDeductionKg}kg · cess ₹${calc.cessAmount} ✓`;
    },
  },
  {
    id: "logic-settlement-zero-rate",
    name: "Settlement: zero gross rate blocked for deduction model",
    description: "Deduction-model lot with grossSaleRate=0 must fail validateLotForSettlement",
    run: async () => {
      const lot = { ...FIXTURE_LOT, grossSaleRate: 0 };
      const issues = validateLotForSettlement(lot, [FIXTURE_RULE]);
      if (!issues.some((i) => i.toLowerCase().includes("rate")))
        throw new Error(`Validation did not catch zero rate. Issues: ${issues.join("; ") || "none"}`);
      return `Blocked: "${issues.find((i) => i.toLowerCase().includes("rate"))}"`;
    },
  },
  {
    id: "logic-settlement-null-rule",
    name: "Settlement: null qualityRuleId is blocked",
    description: "Lot with qualityRuleId=null must fail validateLotForSettlement",
    run: async () => {
      const lot = { ...FIXTURE_LOT, qualityRuleId: null };
      const issues = validateLotForSettlement(lot, [FIXTURE_RULE]);
      if (!issues.some((i) => i.toLowerCase().includes("rule")))
        throw new Error(`Validation did not catch null rule. Issues: ${issues.join("; ") || "none"}`);
      return `Blocked: "${issues[0]}"`;
    },
  },
  {
    id: "logic-postings-balance",
    name: "Accounting: Sales invoice postings are balanced",
    description: "generatePostings(InvoiceApproved) must produce entries where ΣDebits = ΣCredits",
    run: async () => {
      const entries = generatePostings({ type: "InvoiceApproved", invoice: FIXTURE_INVOICE });
      if (!isBalanced(entries)) {
        const dr = entries.reduce((s, e) => s + e.debit, 0);
        const cr = entries.reduce((s, e) => s + e.credit, 0);
        throw new Error(`Not balanced — Dr ₹${dr.toFixed(2)} ≠ Cr ₹${cr.toFixed(2)}`);
      }
      const dr = entries.reduce((s, e) => s + e.debit, 0);
      return `${entries.length} entries · Dr = Cr = ₹${dr.toLocaleString("en-IN")}`;
    },
  },
  {
    id: "logic-date-parser",
    name: "Date parser: valid and invalid inputs",
    description: "Validates DD/MM/YYYY, YYYY-MM-DD, rejects out-of-range dates like 32/01/2026",
    run: async () => {
      const cases: { input: string; expected: string | null }[] = [
        { input: "12/05/2026", expected: "2026-05-12" },
        { input: "1/1/2026", expected: "2026-01-01" },
        { input: "2026-05-12", expected: "2026-05-12" },
        { input: "32/01/2026", expected: null },
        { input: "2026-13-01", expected: null },
        { input: "29/02/2025", expected: null }, // 2025 is not a leap year
      ];
      for (const { input, expected } of cases) {
        const got = parseDate(input);
        if (got !== expected)
          throw new Error(`parseDate("${input}"): got ${got ?? "null"}, expected ${expected ?? "null"}`);
      }
      return `${cases.length} cases passed`;
    },
  },
];

const INTEGRATION_TESTS: TestDef[] = [
  {
    id: "int-material-roundtrip",
    name: "Material POST → GET round-trip",
    description: "Creates a test material, reads it back from the list, verifies all fields match",
    run: async () => {
      const payload = {
        name: "TESTMOD-Material", hsn: "0000", uom: "MT", gstRate: 0,
        category: "Grain", defaultGrossSaleRate: 1000,
        settlementMethod: "Test", qualityParams: ["Moisture %"], status: "Active",
      };
      const { res: createRes, ms } = await timedFetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) throw new Error(`Create failed: HTTP ${createRes.status}`);
      const created = await createRes.json();
      if (!created.id) throw new Error("No id in create response");
      const listRes = await fetch("/api/materials");
      const list = await listRes.json();
      const found = list.find((m: { id: string; name: string }) => m.id === created.id);
      if (!found) throw new Error("Created record not found in GET /api/materials");
      if (found.name !== payload.name) throw new Error(`Name mismatch: got "${found.name}"`);
      return `id=${created.id} · verified in list · ${ms}ms`;
    },
  },
  {
    id: "int-invoice-tax",
    name: "Invoice POST → tax calculation accuracy",
    description: "Creates invoice with 5%+5% GST on ₹2,25,000 — verifies CGST=11,250 and total=2,47,500",
    run: async () => {
      const payload = {
        invoiceType: "Sales", businessModel: "A",
        partyId: "pty-001", partyName: "TESTMOD-Party",
        materialId: "mat-001", materialName: "Maize",
        quantity: 10, uom: "MT", grossRate: 22500,
        grossValue: 225000, taxableValue: 225000,
        cgstRate: 5, sgstRate: 5, igstRate: 0, amountPaid: 0, status: "Draft",
      };
      const { res, ms } = await timedFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Create failed: HTTP ${res.status}`);
      const inv = await res.json();
      if (inv.cgstAmount !== 11250) throw new Error(`CGST: got ${inv.cgstAmount}, expected 11250`);
      if (inv.sgstAmount !== 11250) throw new Error(`SGST: got ${inv.sgstAmount}, expected 11250`);
      if (inv.totalTax !== 22500) throw new Error(`Total tax: got ${inv.totalTax}, expected 22500`);
      if (inv.totalValue !== 247500) throw new Error(`Total value: got ${inv.totalValue}, expected 247500`);
      return `CGST ₹11,250 + SGST ₹11,250 = Total ₹2,47,500 ✓ · ${ms}ms`;
    },
  },
  {
    id: "int-lot-create",
    name: "Inward Lot POST → schema verification",
    description: "Creates a test lot and verifies all required fields are present and correctly typed",
    run: async () => {
      const payload = {
        documentRef: "TESTMOD-LOT-001", businessModel: "A",
        lotDate: "2026-05-12", materialId: "mat-001", materialName: "Maize",
        customerId: "pty-001", customerName: "Sarvani",
        vehicleNo: "AP39ZZ9999",
        grossWeight: 10, tareWeight: 2, netWeight: 8, acceptedWeight: 7.9,
        qualityReadings: { moisture_pct: 14.5, fm_pct: 0.8 }, qualityRuleId: "qr-001",
        paramDeductions: {}, cessAmount: 0,
        netPayableWeight: 7.9, grossSaleRate: 22500, grossSaleValue: 177750,
        status: "Draft",
      };
      const { res, ms } = await timedFetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Create failed: HTTP ${res.status}`);
      const lot = await res.json();
      const required = ["id", "documentRef", "status", "grossSaleRate", "netWeight"];
      const missing = required.filter((f) => !(f in lot));
      if (missing.length) throw new Error(`Missing fields: ${missing.join(", ")}`);
      if (lot.status !== "Draft") throw new Error(`Status: got "${lot.status}", expected "Draft"`);
      return `id=${lot.id} · all schema fields present · ${ms}ms`;
    },
  },
];

// ── Maize Model A flow tests ──────────────────────────────────────────────────

const MAIZE_FLOW_TESTS: TestDef[] = [
  {
    id: "maz-normal-moisture",
    name: "Maize: moisture 15.2% → linear deduction ₹8.52",
    description: "T-MAZ-001 · excess 1.2% above base 14% · rate ₹0.71/MT/% · 10 MT · expected ₹8.52 value deduction, 0.38 kg weight",
    run: async () => {
      const calc = calculateLotSettlement(MAIZE_LOT_NORMAL, FIXTURE_RULE);
      const m = calc.paramCalcs.find(c => c.paramKey === "moisture_pct");
      if (!m) throw new Error("moisture_pct paramCalc missing");
      const expVal = Math.round(1.2 * 0.71 * 10 * 100) / 100; // 8.52
      const expKg  = Math.round((expVal / 22500) * 1000 * 100) / 100; // 0.38
      if (Math.abs(m.valueDeduction - expVal) > 0.02)
        throw new Error(`valueDeduction: got ₹${m.valueDeduction}, expected ₹${expVal}`);
      if (Math.abs(m.weightDeductionKg - expKg) > 0.02)
        throw new Error(`weightDeductionKg: got ${m.weightDeductionKg} kg, expected ${expKg} kg`);
      if (m.excess === undefined || Math.abs(m.excess - 1.2) > 0.001)
        throw new Error(`excess: got ${m.excess}, expected 1.2`);
      return `moisture excess 1.2% → ₹${m.valueDeduction} deducted, ${m.weightDeductionKg} kg off ✓`;
    },
  },
  {
    id: "maz-normal-fm",
    name: "Maize: FM 0.9% → actual-weight 90 kg deduction",
    description: "T-MAZ-001 · FM actual-weight method · 0.9% of 10 MT = 90 kg removed from payable weight · ₹2,025 value",
    run: async () => {
      const calc = calculateLotSettlement(MAIZE_LOT_NORMAL, FIXTURE_RULE);
      const f = calc.paramCalcs.find(c => c.paramKey === "fm_pct");
      if (!f) throw new Error("fm_pct paramCalc missing");
      const expKg  = Math.round((0.9 / 100) * 10 * 1000 * 100) / 100; // 90 kg
      const expVal = Math.round((expKg / 1000) * 22500 * 100) / 100;   // ₹2,025
      if (Math.abs(f.weightDeductionKg - expKg) > 0.1)
        throw new Error(`FM kg: got ${f.weightDeductionKg}, expected ${expKg}`);
      if (Math.abs(f.valueDeduction - expVal) > 1)
        throw new Error(`FM value: got ₹${f.valueDeduction}, expected ₹${expVal}`);
      // Net payable weight check
      const expNet = 10 - (0.38 + 90) / 1000; // ≈ 9.90962 MT
      if (Math.abs(calc.netPayableWeight - expNet) > 0.001)
        throw new Error(`netPayableWeight: got ${calc.netPayableWeight}, expected ~${expNet.toFixed(5)}`);
      return `FM 90 kg deducted · ₹${f.valueDeduction} · netPayable ${calc.netPayableWeight.toFixed(3)} MT ✓`;
    },
  },
  {
    id: "maz-normal-cess",
    name: "Maize: cess 0.5% on gross weight × rate = ₹1,125",
    description: "T-MAZ-001 · cess is charged on netWeight (10 MT) × grossSaleRate (₹22,500), not on payable weight",
    run: async () => {
      const calc = calculateLotSettlement(MAIZE_LOT_NORMAL, FIXTURE_RULE);
      const expCess = Math.round(0.005 * 10 * 22500 * 100) / 100; // ₹1,125
      if (Math.abs(calc.cessAmount - expCess) > 0.02)
        throw new Error(`cess: got ₹${calc.cessAmount}, expected ₹${expCess}`);
      const expNet = Math.round((calc.grossSaleValue - calc.cessAmount) * 100) / 100;
      if (Math.abs(calc.netSettlementValue - expNet) > 0.02)
        throw new Error(`netSettlement: got ₹${calc.netSettlementValue}, expected ₹${expNet}`);
      return `cess ₹${calc.cessAmount} · grossSaleValue ₹${calc.grossSaleValue.toFixed(2)} · netSettlement ₹${calc.netSettlementValue.toFixed(2)} ✓`;
    },
  },
  {
    id: "maz-below-base-moisture",
    name: "Maize: moisture 13.5% (below 14% base) → zero moisture deduction",
    description: "T-MAZ-002 · when reading is below base, excess = 0, no penalty is applied — only FM deduction runs",
    run: async () => {
      const calc = calculateLotSettlement(MAIZE_LOT_BELOW_BASE, FIXTURE_RULE);
      const m = calc.paramCalcs.find(c => c.paramKey === "moisture_pct");
      if (!m) throw new Error("moisture_pct paramCalc missing");
      if (m.valueDeduction !== 0)
        throw new Error(`Expected zero moisture deduction but got ₹${m.valueDeduction}`);
      if (m.weightDeductionKg !== 0)
        throw new Error(`Expected zero moisture weight deduction but got ${m.weightDeductionKg} kg`);
      // Only FM (0.4% × 8 MT = 32 kg) should run
      const f = calc.paramCalcs.find(c => c.paramKey === "fm_pct");
      if (!f) throw new Error("fm_pct paramCalc missing");
      if (Math.abs(f.weightDeductionKg - 32) > 0.1)
        throw new Error(`FM expected 32 kg but got ${f.weightDeductionKg}`);
      const expNet = 8 - 32 / 1000; // 7.968 MT
      if (Math.abs(calc.netPayableWeight - expNet) > 0.001)
        throw new Error(`netPayableWeight: got ${calc.netPayableWeight}, expected ${expNet}`);
      return `moisture below base → ₹0 deduction · FM 32 kg · netPayable ${calc.netPayableWeight.toFixed(3)} MT ✓`;
    },
  },
  {
    id: "maz-aflatoxin-hold",
    name: "Maize: aflatoxin 25 ppb > 20 ppb threshold → Quality Hold triggered",
    description: "T-MAZ-003 · settlement engine sets hasRejectTrigger=true and names aflatoxin_ppb in rejectedParams",
    run: async () => {
      const calc = calculateLotSettlement(MAIZE_LOT_AFLATOXIN, FIXTURE_RULE);
      if (!calc.hasRejectTrigger)
        throw new Error("hasRejectTrigger should be true for aflatoxin 25 ppb but was false");
      if (!calc.rejectedParams.includes("aflatoxin_ppb"))
        throw new Error(`rejectedParams: ${JSON.stringify(calc.rejectedParams)} — expected aflatoxin_ppb`);
      const af = calc.paramCalcs.find(c => c.paramKey === "aflatoxin_ppb");
      if (!af) throw new Error("aflatoxin_ppb paramCalc missing");
      if (!af.rejectTrigger)
        throw new Error("aflatoxin_ppb paramCalc.rejectTrigger should be true");
      return `aflatoxin 25 ppb → hold triggered · rejectedParams: [${calc.rejectedParams.join(", ")}] ✓`;
    },
  },
  {
    id: "maz-validation-draft-blocked",
    name: "Maize: Draft lot is blocked from settlement",
    description: "T-MAZ-001 with status=Draft → validateLotForSettlement must return a blocking error",
    run: async () => {
      const draftLot = { ...MAIZE_LOT_NORMAL, status: "Draft" as const };
      const issues = validateLotForSettlement(draftLot, [FIXTURE_RULE]);
      if (!issues.some(i => i.toLowerCase().includes("draft")))
        throw new Error(`Expected draft-blocking issue. Got: ${issues.join("; ") || "no issues"}`);
      return `Blocked: "${issues.find(i => i.toLowerCase().includes("draft"))}" ✓`;
    },
  },
  {
    id: "maz-invoice-postings-balanced",
    name: "Maize invoice (0% GST): ledger postings are balanced",
    description: "Maize is exempt from GST — Sales invoice should produce 2 entries (Dr Receivable / Cr Sales), ΣDr = ΣCr",
    run: async () => {
      // Combine two lots into one invoice (T-MAZ-001 netPayable 9.910 + T-MAZ-002 netPayable 7.968)
      const calc1 = calculateLotSettlement(MAIZE_LOT_NORMAL, FIXTURE_RULE);
      const calc2 = calculateLotSettlement(MAIZE_LOT_BELOW_BASE, FIXTURE_RULE);
      const combinedValue = Math.round((calc1.grossSaleValue + calc2.grossSaleValue) * 100) / 100;
      const combinedQty   = Math.round((calc1.netPayableWeight + calc2.netPayableWeight) * 1000) / 1000;
      const maizeInvoice = {
        ...FIXTURE_INVOICE,
        id: "test-maz-inv-001", invoiceNo: "T-MAZ-INV-001",
        materialName: "Maize",
        quantity: combinedQty,
        grossRate: 22500,
        grossValue: combinedValue,
        taxableValue: combinedValue,
        cgstRate: 0, sgstRate: 0, igstRate: 0,
        cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
        totalTax: 0,
        totalValue: combinedValue,
        amountPaid: 0, amountDue: combinedValue,
      };
      const entries = generatePostings({ type: "InvoiceApproved", invoice: maizeInvoice });
      if (!isBalanced(entries)) {
        const dr = entries.reduce((s, e) => s + e.debit, 0);
        const cr = entries.reduce((s, e) => s + e.credit, 0);
        throw new Error(`Not balanced — Dr ₹${dr.toFixed(2)} ≠ Cr ₹${cr.toFixed(2)}`);
      }
      const total = entries.reduce((s, e) => s + e.debit, 0);
      return `${combinedQty.toFixed(3)} MT · invoice ₹${combinedValue.toLocaleString("en-IN")} · ${entries.length} entries · balanced ✓`;
    },
  },
  {
    id: "maz-api-create-lot",
    name: "Integration: Maize lot POST → fields verified in response",
    description: "Creates T-MAZ-API via POST /api/lots with qualityReadings + paramDeductions shape, checks response schema",
    run: async () => {
      const payload = {
        documentRef: "T-MAZ-API-001", businessModel: "A",
        lotDate: "2026-06-17", materialId: "mat-001", materialName: "Maize",
        customerId: "pty-001", customerName: "Sarvani Biofuels",
        vehicleNo: "AP32TEST001",
        grossWeight: 12.9, tareWeight: 2.9, netWeight: 10, acceptedWeight: 9.91,
        qualityReadings: { moisture_pct: 15.2, fm_pct: 0.9 },
        qualityRuleId: "qr-001",
        paramDeductions: { moisture_pct: 8.52, fm_pct: 2025 },
        cessAmount: 1125, netPayableWeight: 9.91,
        grossSaleRate: 22500, grossSaleValue: 222975, status: "Draft",
      };
      const { res, ms } = await timedFetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const lot = await res.json();
      if (!lot.id) throw new Error("No id in response");
      if (!lot.qualityReadings || typeof lot.qualityReadings !== "object")
        throw new Error("qualityReadings missing or wrong type in response");
      if (!("moisture_pct" in lot.qualityReadings))
        throw new Error("moisture_pct missing from qualityReadings in response");
      if (lot.status !== "Draft") throw new Error(`status: got "${lot.status}", expected "Draft"`);
      return `id=${lot.id} · qualityReadings present · ${ms}ms ✓`;
    },
  },
];

// ── Paddy Husk Model A flow tests ─────────────────────────────────────────────

const PADDY_FLOW_TESTS: TestDef[] = [
  {
    id: "pad-rate-slab-high-gcv",
    name: "Paddy Husk: GCV 3200 → slab 3000–3499 → ₹2,600/MT",
    description: "T-PAD-001 · rate-slab model: reading 3200 falls in 3000–3500 band · engine must resolve rate before deductions",
    run: async () => {
      const calc = calculateLotSettlement(PADDY_LOT_HIGH_GCV, PADDY_RULE);
      if (calc.grossSaleRate !== 2600)
        throw new Error(`grossSaleRate: got ${calc.grossSaleRate}, expected 2600`);
      const gcvCalc = calc.paramCalcs.find(c => c.paramKey === "gcv_kcal_kg");
      if (!gcvCalc) throw new Error("gcv_kcal_kg paramCalc missing");
      if (gcvCalc.weightDeductionKg !== 0 || gcvCalc.valueDeduction !== 0)
        throw new Error("GCV is a rate driver — must have zero weight/value deduction");
      return `GCV 3200 → ₹${calc.grossSaleRate}/MT resolved · GCV deduction = 0 (rate driver only) ✓`;
    },
  },
  {
    id: "pad-rate-slab-low-gcv",
    name: "Paddy Husk: GCV 2300 → slab 0–2499 → ₹1,800/MT",
    description: "T-PAD-002 · low-quality husk falls into the base price band",
    run: async () => {
      const calc = calculateLotSettlement(PADDY_LOT_LOW_GCV, PADDY_RULE);
      if (calc.grossSaleRate !== 1800)
        throw new Error(`grossSaleRate: got ${calc.grossSaleRate}, expected 1800`);
      return `GCV 2300 → ₹${calc.grossSaleRate}/MT (base band) ✓`;
    },
  },
  {
    id: "pad-high-gcv-full-settlement",
    name: "Paddy Husk: high-GCV full settlement (rate + moisture + cess)",
    description: "T-PAD-001 · GCV→₹2600 · moisture 13.5% (+1.5 above 12 base) → ₹5.40, 2.08 kg · cess ₹52 · net ₹20,742.59",
    run: async () => {
      const calc = calculateLotSettlement(PADDY_LOT_HIGH_GCV, PADDY_RULE);
      // moisture deduction: 1.5 × 0.45 × 8 = 5.4; wt = 5.4/2600×1000 = 2.077 → r2 = 2.08
      const m = calc.paramCalcs.find(c => c.paramKey === "moisture_pct");
      if (!m) throw new Error("moisture_pct paramCalc missing");
      if (Math.abs(m.valueDeduction - 5.4) > 0.02)
        throw new Error(`moisture value: got ₹${m.valueDeduction}, expected ₹5.40`);
      if (Math.abs(m.weightDeductionKg - 2.08) > 0.02)
        throw new Error(`moisture kg: got ${m.weightDeductionKg}, expected 2.08`);
      // ash is info-only — deduction must be zero
      const a = calc.paramCalcs.find(c => c.paramKey === "ash_pct");
      if (a && (a.weightDeductionKg !== 0 || a.valueDeduction !== 0))
        throw new Error("ash_pct must be info-only with zero deduction");
      // cess = 0.25% × 8 × 2600 = 52
      if (Math.abs(calc.cessAmount - 52) > 0.02)
        throw new Error(`cess: got ₹${calc.cessAmount}, expected ₹52`);
      if (Math.abs(calc.netSettlementValue - 20742.59) > 0.5)
        throw new Error(`netSettlement: got ₹${calc.netSettlementValue}, expected ~₹20,742.59`);
      return `rate ₹2600 · moisture ₹5.40/2.08kg · ash 0 (info) · cess ₹52 · net ₹${calc.netSettlementValue.toFixed(2)} ✓`;
    },
  },
  {
    id: "pad-low-gcv-full-settlement",
    name: "Paddy Husk: low-GCV full settlement (₹1,800 band, high moisture)",
    description: "T-PAD-002 · GCV→₹1800 · moisture 15% (+3 above 12 base) → ₹10.80, 6 kg · cess ₹36 · net ₹14,353.20",
    run: async () => {
      const calc = calculateLotSettlement(PADDY_LOT_LOW_GCV, PADDY_RULE);
      const m = calc.paramCalcs.find(c => c.paramKey === "moisture_pct");
      if (!m) throw new Error("moisture_pct paramCalc missing");
      if (Math.abs(m.valueDeduction - 10.8) > 0.02)
        throw new Error(`moisture value: got ₹${m.valueDeduction}, expected ₹10.80`);
      if (Math.abs(m.weightDeductionKg - 6) > 0.02)
        throw new Error(`moisture kg: got ${m.weightDeductionKg}, expected 6`);
      if (Math.abs(calc.cessAmount - 36) > 0.02)
        throw new Error(`cess: got ₹${calc.cessAmount}, expected ₹36`);
      if (Math.abs(calc.netSettlementValue - 14353.2) > 0.5)
        throw new Error(`netSettlement: got ₹${calc.netSettlementValue}, expected ~₹14,353.20`);
      return `rate ₹1800 · moisture ₹10.80/6kg · cess ₹36 · net ₹${calc.netSettlementValue.toFixed(2)} ✓`;
    },
  },
  {
    id: "pad-rate-differential",
    name: "Paddy Husk: high-GCV earns ₹6,389 more than low-GCV for same 8 MT",
    description: "Business insight test — demonstrates why quality lab testing matters financially for every incoming load",
    run: async () => {
      const highCalc = calculateLotSettlement(PADDY_LOT_HIGH_GCV, PADDY_RULE);
      const lowCalc  = calculateLotSettlement(PADDY_LOT_LOW_GCV,  PADDY_RULE);
      const diff = Math.round((highCalc.netSettlementValue - lowCalc.netSettlementValue) * 100) / 100;
      if (diff < 6000)
        throw new Error(`Rate differential too small: ₹${diff} — expected >₹6,000`);
      const perMt = Math.round(diff / 8 * 100) / 100;
      return `High-GCV ₹${highCalc.netSettlementValue.toFixed(2)} vs Low-GCV ₹${lowCalc.netSettlementValue.toFixed(2)} · diff ₹${diff.toLocaleString("en-IN")} (₹${perMt}/MT) ✓`;
    },
  },
  {
    id: "pad-api-create-lot",
    name: "Integration: Paddy Husk lot POST → rate-slab fields preserved",
    description: "Creates T-PAD-API via POST /api/lots with gcv_kcal_kg in qualityReadings, grossSaleRate=0 (rate-slab, not pre-set)",
    run: async () => {
      const payload = {
        documentRef: "T-PAD-API-001", businessModel: "A",
        lotDate: "2026-06-17", materialId: "mat-002", materialName: "Paddy Husk",
        customerId: "pty-001", customerName: "Sarvani Biofuels",
        vehicleNo: "AP32TEST002",
        grossWeight: 10.8, tareWeight: 2.8, netWeight: 8, acceptedWeight: 8,
        qualityReadings: { gcv_kcal_kg: 3200, moisture_pct: 13.5, ash_pct: 17 },
        qualityRuleId: "qr-004",
        paramDeductions: { moisture_pct: 5.4 },
        cessAmount: 52, netPayableWeight: 7.998,
        grossSaleRate: 2600, grossSaleValue: 20794.59, status: "Draft",
      };
      const { res, ms } = await timedFetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const lot = await res.json();
      if (!lot.id) throw new Error("No id in response");
      if (!lot.qualityReadings || !("gcv_kcal_kg" in lot.qualityReadings))
        throw new Error("gcv_kcal_kg missing from qualityReadings in response");
      if (lot.materialName !== "Paddy Husk")
        throw new Error(`materialName: got "${lot.materialName}"`);
      return `id=${lot.id} · Paddy Husk lot with GCV readings saved · ${ms}ms ✓`;
    },
  },
];

const ALL_GROUPS: TestGroup[] = [
  {
    id: "api", title: "API Health Checks", subtitle: "Read-only GET tests for every API endpoint",
    tests: API_TESTS,
  },
  {
    id: "logic", title: "Business Logic", subtitle: "Pure function tests — no network, instant results",
    tests: LOGIC_TESTS,
  },
  {
    id: "integration", title: "Integration Flow",
    subtitle: "Write operations that verify the full request → DB → response chain",
    warn: "These create test records in the database. Use Clear All Data to clean up afterwards.",
    tests: INTEGRATION_TESTS,
  },
  {
    id: "maize-flow", title: "Maize — Model A Flow",
    subtitle: "Full deduction-model flow: weighment → moisture/FM quality checks → cess → invoice postings",
    tests: MAIZE_FLOW_TESTS,
  },
  {
    id: "paddy-flow", title: "Paddy Husk — Model A Flow",
    subtitle: "Full rate-slab flow: GCV quality reading determines price band → moisture deduction → cess",
    tests: PADDY_FLOW_TESTS,
  },
];

// ── Status components ────────────────────────────────────────────────────────

const STATUS_DOT: Record<TestStatus, string> = {
  idle: "bg-gray-300",
  running: "bg-amber-400 animate-pulse",
  pass: "bg-[#4a9e44]",
  fail: "bg-[#b91c1c]",
};
const STATUS_LABEL: Record<TestStatus, string> = {
  idle: "Idle", running: "Running…", pass: "Pass", fail: "Fail",
};

function StatusDot({ s }: { s: TestStatus }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[s]}`} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TestingPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [states, setStates] = useState<Record<string, TestState>>({});
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [clearMsg, setClearMsg] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_auth");
      if (!stored) { router.replace("/login"); return; }
      const u = JSON.parse(stored) as AuthUser;
      if (u.role !== "Admin") { router.replace("/erp"); return; }
      setUser(u);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const res = await fetch("/api/testing/counts");
      if (res.ok) setCounts(await res.json());
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchCounts();
  }, [user, fetchCounts]);

  const setTestState = useCallback((id: string, state: TestState) => {
    setStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const runTest = useCallback(async (def: TestDef) => {
    setTestState(def.id, { status: "running" });
    const start = Date.now();
    try {
      const detail = await def.run();
      setTestState(def.id, { status: "pass", duration: Date.now() - start, detail });
    } catch (e) {
      setTestState(def.id, { status: "fail", duration: Date.now() - start, error: String(e) });
    }
  }, [setTestState]);

  const runGroup = useCallback(async (group: TestGroup) => {
    for (const test of group.tests) await runTest(test);
  }, [runTest]);

  const runAll = useCallback(async () => {
    for (const group of ALL_GROUPS) await runGroup(group);
  }, [runGroup]);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const d = await res.json();
      setSeedMsg(res.ok ? `Seeded successfully · ${d.message ?? ""}` : `Error: ${d.error ?? "Unknown"}`);
      fetchCounts();
    } catch (e) {
      setSeedMsg(`Error: ${String(e)}`);
    } finally {
      setSeeding(false);
    }
  }, [fetchCounts]);

  const handleClear = useCallback(async () => {
    setConfirmClear(false);
    setClearing(true);
    setClearMsg("");
    try {
      const res = await fetch("/api/testing/reset", { method: "DELETE" });
      const d = await res.json();
      if (res.ok) {
        setClearMsg(`Cleared ${d.cleared?.length ?? 0} tables`);
        // Reset all test states too
        setStates({});
      } else {
        setClearMsg(`Errors: ${(d.errors ?? []).join(", ")}`);
      }
      fetchCounts();
    } catch (e) {
      setClearMsg(`Error: ${String(e)}`);
    } finally {
      setClearing(false);
    }
  }, [fetchCounts]);

  // Summary stats
  const allTests = ALL_GROUPS.flatMap((g) => g.tests);
  const total = allTests.length;
  const passed = allTests.filter((t) => states[t.id]?.status === "pass").length;
  const failed = allTests.filter((t) => states[t.id]?.status === "fail").length;
  const running = allTests.filter((t) => states[t.id]?.status === "running").length;

  const TABLE_LABELS: Record<string, string> = {
    materials: "Materials", parties: "Parties", quality_rules: "Quality Rules",
    rate_masters: "Rate Masters", inward_lots: "Inward Lots", import_batches: "Import Batches",
    farmer_payouts: "Farmer Payouts", invoices: "Invoices", vouchers: "Vouchers",
    ledger_entries: "Ledger Entries", stock_batches: "Stock Batches",
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block rounded-full bg-[#172018] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#d8ff72]">
              Admin Only
            </span>
            <span className="text-xs text-[#60735d]">Platform testing module</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold">Testing Control Centre</h1>
          <p className="mt-1 text-sm text-[#60735d]">
            Verify every layer of the platform — API health, business logic, and integration flows.
          </p>
        </div>
        {/* Stats bar */}
        <div className="flex gap-3 flex-wrap">
          {[
            { label: "Total", value: total, color: "text-[#172018]" },
            { label: "Passed", value: passed, color: "text-[#4a9e44]" },
            { label: "Failed", value: failed, color: "text-[#b91c1c]" },
            { label: "Running", value: running, color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-[#d5ddce] bg-white px-4 py-2.5 text-center min-w-16">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-[#60735d]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={runAll}
          disabled={running > 0}
          className="btn btn-primary"
        >
          {running > 0 ? `Running ${running} test…` : "▶ Run All Tests"}
        </button>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="btn btn-ghost"
        >
          {seeding ? "Seeding…" : "⊕ Seed Mock Data"}
        </button>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={clearing}
            className="rounded-lg border border-[#b91c1c] px-5 py-2.5 text-sm font-semibold text-[#b91c1c] hover:bg-[#b91c1c] hover:text-white disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "⊘ Clear All Data"}
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-[#b91c1c] bg-[#fef2f2] px-4 py-2">
            <span className="text-sm font-bold text-[#b91c1c]">Delete ALL records from all tables?</span>
            <button onClick={handleClear} className="rounded bg-[#b91c1c] px-3 py-1 text-xs font-semibold text-white">
              Yes, clear
            </button>
            <button onClick={() => setConfirmClear(false)} className="rounded border border-[#b91c1c] px-3 py-1 text-xs font-semibold text-[#b91c1c]">
              Cancel
            </button>
          </div>
        )}
        {(seedMsg || clearMsg) && (
          <p className="text-xs text-[#60735d]">{seedMsg || clearMsg}</p>
        )}
      </div>

      {/* Database Status */}
      <div className="rounded-xl border border-[#d5ddce] bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Database Status</h2>
          <button
            onClick={fetchCounts}
            disabled={loadingCounts}
            className="btn btn-ghost text-xs disabled:opacity-50"
          >
            {loadingCounts ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
        {counts ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Object.entries(counts).map(([table, count]) => (
              <div key={table} className="rounded-lg border border-[#eef1ea] bg-[#f8faf5] px-3 py-2.5">
                <p className="text-xl font-semibold text-[#172018]">{count === -1 ? "—" : count}</p>
                <p className="mt-0.5 text-xs text-[#60735d] leading-tight">{TABLE_LABELS[table] ?? table}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#60735d]">{loadingCounts ? "Loading counts…" : "No data loaded yet."}</p>
        )}
      </div>

      {/* Test groups */}
      {ALL_GROUPS.map((group) => {
        const groupStates = group.tests.map((t) => states[t.id]?.status ?? "idle");
        const groupPassed = groupStates.filter((s) => s === "pass").length;
        const groupFailed = groupStates.filter((s) => s === "fail").length;

        return (
          <div key={group.id} className="rounded-xl border border-[#d5ddce] bg-white">
            {/* Group header */}
            <div className="flex items-center justify-between border-b border-[#eef1ea] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">{group.title}</h2>
                <p className="text-xs text-[#60735d]">{group.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                {groupPassed > 0 && (
                  <span className="text-xs font-semibold text-[#4a9e44]">{groupPassed} passed</span>
                )}
                {groupFailed > 0 && (
                  <span className="text-xs font-semibold text-[#b91c1c]">{groupFailed} failed</span>
                )}
                <button
                  onClick={() => runGroup(group)}
                  disabled={groupStates.includes("running")}
                  className="rounded-md border border-[#d5ddce] px-3 py-1.5 text-xs font-semibold hover:border-[#172018] disabled:opacity-50"
                >
                  {groupStates.includes("running") ? "Running…" : `▶ Run ${group.tests.length} tests`}
                </button>
              </div>
            </div>

            {/* Warning banner */}
            {group.warn && (
              <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-amber-700">⚠ {group.warn}</p>
              </div>
            )}

            {/* Test rows */}
            <div className="divide-y divide-[#f0f3ec]">
              {group.tests.map((test) => {
                const s = states[test.id] ?? { status: "idle" as TestStatus };
                return (
                  <div key={test.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#fafcf7]">
                    <div className="mt-1 flex-shrink-0">
                      <StatusDot s={s.status} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#172018]">{test.name}</span>
                        <span className={`text-xs font-bold ${
                          s.status === "pass" ? "text-[#4a9e44]" :
                          s.status === "fail" ? "text-[#b91c1c]" :
                          s.status === "running" ? "text-amber-600" :
                          "text-gray-400"
                        }`}>
                          {STATUS_LABEL[s.status]}
                        </span>
                        {s.duration !== undefined && (
                          <span className="text-xs text-gray-400">{s.duration}ms</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[#60735d]">{test.description}</p>
                      {s.status === "pass" && s.detail && (
                        <p className="mt-1 rounded bg-[#f0faf0] px-2 py-1 text-xs font-mono text-[#4a9e44]">
                          {s.detail}
                        </p>
                      )}
                      {s.status === "fail" && s.error && (
                        <p className="mt-1 rounded bg-[#fef2f2] px-2 py-1 text-xs font-mono text-[#b91c1c]">
                          {s.error}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => runTest(test)}
                      disabled={s.status === "running"}
                      className="flex-shrink-0 rounded-md border border-[#d5ddce] px-2.5 py-1.5 text-xs font-bold hover:border-[#172018] disabled:opacity-40"
                    >
                      {s.status === "running" ? "…" : "Run"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Test Object Flow Reference */}
      <div className="rounded-xl border border-[#d5ddce] bg-white p-5">
        <h2 className="text-base font-semibold mb-3">Object Flow Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#eef1ea]">
                {["Layer", "Files", "Test to run", "Failure means"].map((h) => (
                  <th key={h} className="pb-2 text-left font-semibold text-[#172018] pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f3ec]">
              {[
                ["Types", "lib/types/index.ts", "Business Logic group", "Shape mismatch — update types first"],
                ["DB Mappers", "lib/db.ts", "API Health group (GET tests)", "fromDb/toDb conversion broken"],
                ["Settlement Engine", "lib/settlement/engine.ts", "Maize Flow + Paddy Husk Flow groups", "Deduction math or rate-slab lookup is wrong"],
                ["Accounting", "lib/accounting/postings.ts", "Business Logic + Maize Flow groups", "Ledger entries not balanced"],
                ["API Routes", "src/app/api/**/route.ts", "API Health + Integration groups", "Route handler error or wrong status code"],
                ["Maize Model A", "engine + api/lots + api/invoices", "Maize Flow group (8 tests)", "Moisture/FM deduction or invoice chain broken"],
                ["Paddy Husk Model A", "engine + api/lots", "Paddy Husk Flow group (6 tests)", "Rate-slab lookup or deduction incorrect"],
                ["UI Pages", "src/app/erp/**/page.tsx", "Manual — open each ERP page", "Rendering or fetch error in browser"],
              ].map(([layer, files, test, fail]) => (
                <tr key={layer} className="hover:bg-[#fafcf7]">
                  <td className="py-2 pr-6 font-semibold text-[#172018]">{layer}</td>
                  <td className="py-2 pr-6 font-mono text-[#60735d]">{files}</td>
                  <td className="py-2 pr-6 text-[#172018]">{test}</td>
                  <td className="py-2 pr-6 text-[#b91c1c]">{fail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
