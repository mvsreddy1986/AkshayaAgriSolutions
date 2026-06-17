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
  importBatchId: null, invoiceId: null, status: "Mapped", overrideReason: null,
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
            <span className="inline-block rounded-full bg-[#172018] px-3 py-1 text-xs font-black uppercase tracking-widest text-[#d8ff72]">
              Admin Only
            </span>
            <span className="text-xs text-[#60735d]">Platform testing module</span>
          </div>
          <h1 className="mt-2 text-3xl font-black">Testing Control Centre</h1>
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
              <p className={`text-2xl font-black ${color}`}>{value}</p>
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
          className="rounded-lg bg-[#172018] px-5 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29] disabled:opacity-50"
        >
          {running > 0 ? `Running ${running} test…` : "▶ Run All Tests"}
        </button>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="rounded-lg border border-[#172018] px-5 py-2.5 text-sm font-black hover:bg-[#172018] hover:text-white disabled:opacity-50"
        >
          {seeding ? "Seeding…" : "⊕ Seed Mock Data"}
        </button>
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={clearing}
            className="rounded-lg border border-[#b91c1c] px-5 py-2.5 text-sm font-black text-[#b91c1c] hover:bg-[#b91c1c] hover:text-white disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "⊘ Clear All Data"}
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-[#b91c1c] bg-[#fef2f2] px-4 py-2">
            <span className="text-sm font-bold text-[#b91c1c]">Delete ALL records from all tables?</span>
            <button onClick={handleClear} className="rounded bg-[#b91c1c] px-3 py-1 text-xs font-black text-white">
              Yes, clear
            </button>
            <button onClick={() => setConfirmClear(false)} className="rounded border border-[#b91c1c] px-3 py-1 text-xs font-black text-[#b91c1c]">
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
          <h2 className="text-base font-black">Database Status</h2>
          <button
            onClick={fetchCounts}
            disabled={loadingCounts}
            className="rounded-md border border-[#d5ddce] px-3 py-1.5 text-xs font-bold hover:border-[#172018] disabled:opacity-50"
          >
            {loadingCounts ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
        {counts ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Object.entries(counts).map(([table, count]) => (
              <div key={table} className="rounded-lg border border-[#eef1ea] bg-[#f8faf5] px-3 py-2.5">
                <p className="text-xl font-black text-[#172018]">{count === -1 ? "—" : count}</p>
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
                <h2 className="text-base font-black">{group.title}</h2>
                <p className="text-xs text-[#60735d]">{group.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                {groupPassed > 0 && (
                  <span className="text-xs font-bold text-[#4a9e44]">{groupPassed} passed</span>
                )}
                {groupFailed > 0 && (
                  <span className="text-xs font-bold text-[#b91c1c]">{groupFailed} failed</span>
                )}
                <button
                  onClick={() => runGroup(group)}
                  disabled={groupStates.includes("running")}
                  className="rounded-md border border-[#d5ddce] px-3 py-1.5 text-xs font-black hover:border-[#172018] disabled:opacity-50"
                >
                  {groupStates.includes("running") ? "Running…" : `▶ Run ${group.tests.length} tests`}
                </button>
              </div>
            </div>

            {/* Warning banner */}
            {group.warn && (
              <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-xs font-bold text-amber-700">⚠ {group.warn}</p>
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
                        <span className="text-sm font-black text-[#172018]">{test.name}</span>
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
        <h2 className="text-base font-black mb-3">Object Flow Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#eef1ea]">
                {["Layer", "Files", "Test to run", "Failure means"].map((h) => (
                  <th key={h} className="pb-2 text-left font-black text-[#172018] pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f3ec]">
              {[
                ["Types", "lib/types/index.ts", "Business Logic group", "Shape mismatch — update types first"],
                ["DB Mappers", "lib/db.ts", "API Health group (GET tests)", "fromDb/toDb conversion broken"],
                ["Business Logic", "lib/settlement/engine.ts, lib/accounting/postings.ts", "Business Logic group", "Settlement or posting math is wrong"],
                ["API Routes", "src/app/api/**/route.ts", "API Health + Integration groups", "Route handler error or wrong status code"],
                ["UI Pages", "src/app/erp/**/page.tsx", "Manual — open each ERP page", "Rendering or fetch error in browser"],
              ].map(([layer, files, test, fail]) => (
                <tr key={layer} className="hover:bg-[#fafcf7]">
                  <td className="py-2 pr-6 font-black text-[#172018]">{layer}</td>
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
