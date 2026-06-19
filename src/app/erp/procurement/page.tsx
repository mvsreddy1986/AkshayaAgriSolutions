"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { LotStatus, InwardLot, FarmerPayout, QualityRule, Material, Party, RateMaster } from "../../../lib/types";
import SettlementPreview from "../../../components/SettlementPreview";
import { calculateLotSettlement } from "../../../lib/settlement/engine";
import BatchInvoiceDialog from "../../../components/BatchInvoiceDialog";
import {
  FileInput, Sprout, Scale, HandCoins,
  Plus, Upload, Bug, Trash2, FileText, Printer, Download,
  Pencil, CheckCircle2, ShieldCheck, FlaskConical, Link2,
  Eye, FileSearch, X, Check, ArrowRight, RefreshCw as Refresh,
  Search, SlidersHorizontal,
} from "lucide-react";

const TABS = ["Model A", "Model B", "Weighment", "Settlements"] as const;
type Tab = (typeof TABS)[number];

const PROC_TAB_ICONS = {
  "Model A": FileInput,
  "Model B": Sprout,
  "Weighment": Scale,
  "Settlements": HandCoins,
} as const;

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const IC =
  "w-full rounded-lg border border-[#c8d4c0] bg-white px-3.5 py-2.5 text-sm text-[#172018] outline-none placeholder:text-[#9aad9c] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/20 transition";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Mapped: "bg-[#eff6ff] text-[#1d4ed8]",
    Approved: "bg-[#f0fdf4] text-[#15803d]",
    Invoiced: "bg-[#f5f3ff] text-[#6d28d9]",
    Settled: "bg-[#ecfdf5] text-[#065f46]",
    QualityHold: "bg-[#fef3c7] text-[#92400e]",
    Pending: "bg-[#fef9c3] text-[#a16207]",
    Paid: "bg-[#f0fdf4] text-[#15803d]",
    Posted: "bg-[#f5f3ff] text-[#6d28d9]",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

// ─── DIALOGS ─────────────────────────────────────────────────────────────────

function LotEntryForm({
  materials, parties, qualityRules, rates, onSaved, onClose,
}: {
  materials: Material[];
  parties: Party[];
  qualityRules: QualityRule[];
  rates: RateMaster[];
  onSaved: (lot: InwardLot) => void;
  onClose: () => void;
}) {
  const [matId, setMatId] = useState("");
  const [gross, setGross] = useState("");
  const [tare, setTare] = useState("");
  const [autoRate, setAutoRate] = useState("");
  const [autoRuleId, setAutoRuleId] = useState("");
  const [marginRate, setMarginRate] = useState("50");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedMat = materials.find((m) => m.id === matId);
  const activeRule = qualityRules.find((r) => r.id === autoRuleId);
  const netWt = (Number(gross) || 0) - (Number(tare) || 0);
  const customers = parties.filter((p) => p.partyType === "Customer" || p.partyType === "Both");
  const suppliers = parties.filter((p) => ["Supplier", "Trader", "Both"].includes(p.partyType));
  const farmers = parties.filter((p) => p.partyType === "Farmer");

  useEffect(() => {
    const rule = qualityRules.find((r) => r.materialId === matId && r.status === "Active");
    setAutoRuleId(rule?.id ?? "");
    const rate = rates.find((r) => r.materialId === matId && r.rateType === "GrossSale" && !r.validTo);
    setAutoRate(rate ? String(rate.rate) : "");
  }, [matId, qualityRules, rates]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    const grossWt = Number(fd.get("grossWeight") ?? 0);
    const tareWt = Number(fd.get("tareWeight") ?? 0);
    const netWeight = grossWt - tareWt;
    const rate = Number(fd.get("grossSaleRate") ?? 0);
    const supplierId = String(fd.get("supplierId") ?? "").trim() || null;
    const farmerId = String(fd.get("farmerId") ?? "").trim() || null;
    const customerId = String(fd.get("customerId") ?? "").trim();

    const supplier = suppliers.find((p) => p.id === supplierId);
    const farmer = farmers.find((p) => p.id === farmerId);
    const customer = customers.find((p) => p.id === customerId);

    const docRef = String(fd.get("documentRef") ?? "").trim() || `LOT-${Date.now()}`;
    // Lot is created without quality readings — readings are entered after mapping
    const status: LotStatus = supplierId ? "Mapped" : "Draft";

    const res = await fetch("/api/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentRef: docRef, businessModel: "A",
        lotDate: fd.get("lotDate") ?? new Date().toISOString().slice(0, 10),
        materialId: matId, materialName: selectedMat?.name ?? matId,
        customerId, customerName: customer?.name ?? customerId,
        supplierId, supplierName: supplier?.name ?? null,
        farmerId, farmerName: farmer?.name ?? null,
        vehicleNo: fd.get("vehicleNo") ?? "",
        grossWeight: grossWt, tareWeight: tareWt, netWeight,
        acceptedWeight: netWeight,
        qualityReadings: {}, qualityRuleId: autoRuleId || null,
        paramDeductions: {}, cessAmount: 0,
        netPayableWeight: netWeight, grossSaleRate: rate, grossSaleValue: netWeight * rate,
        importBatchId: null, invoiceId: null, status, overrideReason: null,
        akshayaMarginPerMT: Number(fd.get("akshayaMarginPerMT") ?? 50),
        holdPenalty: 0, holdPenaltyNote: null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      setError(String(err.error ?? "Failed to create lot"));
      return;
    }
    onSaved(await res.json());
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Document ref</label>
        <input name="documentRef" className={IC} placeholder="Auto-generated if blank" />
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Lot date *</label>
        <input name="lotDate" type="date" required className={IC} defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Vehicle no *</label>
        <input name="vehicleNo" required className={IC} placeholder="e.g. AP39CX4432" />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Material *</label>
        <select name="materialId" required value={matId} onChange={(e) => setMatId(e.target.value)} className={IC}>
          <option value="">Select material…</option>
          {materials.filter((m) => m.status === "Active").map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Customer *</label>
        <select name="customerId" required className={IC} defaultValue={customers[0]?.id ?? ""}>
          <option value="">Select customer…</option>
          {customers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">
          Rate ₹/MT *
          {autoRate && <span className="ml-1 font-normal text-[#9aad9c]">(auto-filled)</span>}
        </label>
        <input
          name="grossSaleRate" type="number" step="0.01" min="0" required
          value={autoRate} onChange={(e) => setAutoRate(e.target.value)}
          className={IC} placeholder="₹/MT"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Gross weight (MT) *</label>
        <input name="grossWeight" type="number" step="0.001" min="0" required value={gross} onChange={(e) => setGross(e.target.value)} className={IC} placeholder="0.000" />
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Tare weight (MT) *</label>
        <input name="tareWeight" type="number" step="0.001" min="0" required value={tare} onChange={(e) => setTare(e.target.value)} className={IC} placeholder="0.000" />
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Net weight (MT)</label>
        <div className={`${IC} bg-[#f3f6ef] font-bold`}>{netWt > 0 ? netWt.toFixed(3) : "—"}</div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Supplier</label>
        <select name="supplierId" className={IC}>
          <option value="">None — lot stays Draft</option>
          {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Farmer (optional)</label>
        <select name="farmerId" className={IC}>
          <option value="">None</option>
          {farmers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">
          Akshaya margin (₹/MT)
          <span className="ml-1 font-normal normal-case text-[#9aad9c]">₹5/qtl = ₹50/MT</span>
        </label>
        <input name="akshayaMarginPerMT" type="number" step="1" min="0" value={marginRate} onChange={(e) => setMarginRate(e.target.value)} className={IC} />
      </div>

      {activeRule && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-lg bg-[#f3f6ef] px-4 py-2.5 text-xs text-[#60735d]">
          Quality rule: <strong>{activeRule.materialName}</strong> — readings will be entered after mapping to a supplier.
        </div>
      )}

      {error && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
          <Check size={14} />{saving ? "Creating…" : "Create inward lot"}
        </button>
        <button type="button" onClick={onClose} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Cancel</button>
      </div>
    </form>
  );
}

function MappingDialog({
  lot, parties, onSaved, onClose,
}: {
  lot: InwardLot;
  parties: Party[];
  onSaved: (lot: InwardLot) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const suppliers = parties.filter((p) => ["Supplier", "Trader", "Both"].includes(p.partyType));
  const farmers = parties.filter((p) => p.partyType === "Farmer");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const supplierId = String(fd.get("supplierId") ?? "").trim() || null;
    const farmerId = String(fd.get("farmerId") ?? "").trim() || null;
    const supplier = suppliers.find((p) => p.id === supplierId);
    const farmer = farmers.find((p) => p.id === farmerId);

    const res = await fetch(`/api/lots/${lot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId, supplierName: supplier?.name ?? null,
        farmerId, farmerName: farmer?.name ?? null,
        status: "Mapped",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      setError(String(err.error ?? "Failed to map lot"));
      return;
    }
    onSaved(await res.json());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">Map lot to supplier</h3>
        <p className="mt-1 mb-5 text-sm text-[#60735d]">{lot.documentRef} · {lot.materialName}</p>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Supplier *</label>
            <select name="supplierId" required className={IC} defaultValue={lot.supplierId ?? ""}>
              <option value="">Select supplier…</option>
              {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Farmer (optional)</label>
            <select name="farmerId" className={IC} defaultValue={lot.farmerId ?? ""}>
              <option value="">None</option>
              {farmers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn btn-primary flex flex-1 items-center justify-center gap-1.5 disabled:opacity-50">
              <Check size={14} />{saving ? "Saving…" : "Map & confirm"}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QualityEditDialog({
  lot, qualityRules, onSaved, onClose,
}: {
  lot: InwardLot;
  qualityRules: QualityRule[];
  onSaved: (lot: InwardLot) => void;
  onClose: () => void;
}) {
  const rule =
    qualityRules.find((r) => r.id === lot.qualityRuleId) ??
    qualityRules.find((r) => r.materialId === lot.materialId && r.status === "Active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rule) return;
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    const qualityReadings: Record<string, number | string> = { ...lot.qualityReadings };
    for (const pr of rule.paramRules) {
      const val = fd.get(`qr_${pr.paramKey}`);
      if (val !== null && String(val).trim() !== "") qualityReadings[pr.paramKey] = Number(val);
    }

    // Model A: cess is entered as actual amount from Sarvani; margin rate is editable
    const isModelA = lot.businessModel === "A";
    const manualCess = isModelA ? Number(fd.get("cessAmount") ?? lot.cessAmount) : null;
    const manualMargin = isModelA ? Number(fd.get("akshayaMarginPerMT") ?? lot.akshayaMarginPerMT) : null;

    let patch: Record<string, unknown> = { qualityReadings, qualityRuleId: rule.id };
    if (isModelA && manualMargin !== null) patch.akshayaMarginPerMT = manualMargin;

    if (lot.netWeight > 0) {
      const tempLot: InwardLot = { ...lot, qualityReadings };
      const calc = calculateLotSettlement(tempLot, rule);
      patch = {
        ...patch,
        netPayableWeight: calc.netPayableWeight,
        grossSaleValue: calc.grossSaleValue,
        // For Model A: use manually entered cess; for others: use engine calculation
        cessAmount: isModelA && manualCess !== null ? manualCess : calc.cessAmount,
        paramDeductions: Object.fromEntries(calc.paramCalcs.map((c) => [c.paramKey, c.valueDeduction])),
        // If readings now clear the hold, revert to Mapped so the lot can be approved
        status: calc.hasRejectTrigger
          ? "QualityHold"
          : lot.status === "QualityHold"
            ? "Mapped"
            : lot.status,
      };
    }

    const res = await fetch(`/api/lots/${lot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      setError(String(err.error ?? "Failed to update readings"));
      return;
    }
    onSaved(await res.json());
  }

  if (lot.status === "Draft") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <p className="text-sm font-semibold text-red-700 mb-2">Map supplier first</p>
          <p className="text-sm text-[#536251]">{lot.documentRef} must be mapped to a supplier before quality readings can be entered.</p>
          <button onClick={onClose} className="btn btn-ghost mt-4">Close</button>
        </div>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <p className="text-sm text-amber-700">No active quality rule found for {lot.materialName}.</p>
          <button onClick={onClose} className="btn btn-ghost mt-4">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">Edit quality readings</h3>
        <p className="mt-1 mb-5 text-sm text-[#60735d]">
          {lot.documentRef} · {lot.materialName} · {rule.id}
        </p>
        <form onSubmit={handleSubmit} className="grid gap-3">
          {rule.paramRules.map((pr) => (
            <div key={pr.paramKey} className="grid gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">
                {pr.label ?? pr.paramKey}
                {pr.baseValue !== undefined && (
                  <span className="ml-1 font-normal normal-case text-[#9aad9c]">base {pr.baseValue}</span>
                )}
                {pr.rejectThreshold !== undefined && (
                  <span className="ml-1 font-normal normal-case text-[#dc2626]">reject &gt;{pr.rejectThreshold}</span>
                )}
              </label>
              <input
                name={`qr_${pr.paramKey}`}
                type="number" step="0.01"
                defaultValue={lot.qualityReadings[pr.paramKey] ?? ""}
                className={IC}
                placeholder="Enter value"
              />
            </div>
          ))}

          {/* Model A: manual cess entry + editable margin */}
          {lot.businessModel === "A" && (
            <div className="mt-2 grid gap-3 border-t border-[#edf0e8] pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#536251]">Model A settlement adjustments</p>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">
                  Cess paid (₹) <span className="font-normal normal-case text-[#9aad9c]">actual amount deducted by Sarvani</span>
                </label>
                <input name="cessAmount" type="number" step="0.01" min="0" defaultValue={lot.cessAmount} className={IC} placeholder="0.00" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">
                  Akshaya margin (₹/MT) <span className="font-normal normal-case text-[#9aad9c]">₹5/qtl = ₹50/MT</span>
                </label>
                <input name="akshayaMarginPerMT" type="number" step="1" min="0" defaultValue={lot.akshayaMarginPerMT} className={IC} />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn btn-primary flex flex-1 items-center justify-center gap-1.5 disabled:opacity-50">
              <Check size={14} />{saving ? "Saving…" : "Save & recalculate"}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OverrideDialog({
  lot, qualityRule, onSaved, onClose,
}: {
  lot: InwardLot;
  qualityRule: QualityRule | undefined;
  onSaved: (lot: InwardLot) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [penalty, setPenalty] = useState("");
  const [penaltyNote, setPenaltyNote] = useState("");
  const [saving, setSaving] = useState(false);

  const penaltyAmt = parseFloat(penalty) || 0;

  async function handleConfirm() {
    if (!reason.trim()) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      status: "Approved",
      overrideReason: reason.trim(),
      holdPenalty: penaltyAmt,
      holdPenaltyNote: penaltyAmt > 0 ? (penaltyNote.trim() || null) : null,
    };

    // When accepting without a penalty the engine extends normal deductions through
    // the reject threshold (extendThroughReject=true). Recalculate and persist the
    // updated grossSaleValue / netPayableWeight so the lot queue shows the right value.
    if (qualityRule && penaltyAmt === 0) {
      const postOverrideLot: InwardLot = {
        ...lot,
        status: "Approved",
        overrideReason: reason.trim(),
        holdPenalty: 0,
      };
      const calc = calculateLotSettlement(postOverrideLot, qualityRule);
      body.grossSaleValue    = calc.grossSaleValue;
      body.netPayableWeight  = calc.netPayableWeight;
      body.paramDeductions   = Object.fromEntries(
        calc.paramCalcs.map((c) => [c.paramKey, c.valueDeduction])
      );
    }

    const res = await fetch(`/api/lots/${lot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) return;
    onSaved(await res.json());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xl text-amber-500">&#9888;</span>
          <h3 className="text-lg font-semibold">Accept held lot</h3>
        </div>
        <p className="mb-1 text-sm text-[#536251]">
          <strong>{lot.documentRef}</strong> is on Quality Hold. Record why it&apos;s being accepted and any agreed penalty.
        </p>
        <p className="mb-4 text-xs text-[#9aad9c]">Hold triggered by: {lot.overrideReason ?? "quality parameter exceeded threshold"}</p>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Acceptance reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Customer accepted with penalty, lab retest within tolerance."
              className={IC + " resize-none"}
            />
          </div>

          <div className="rounded-xl border border-[#f3d89a] bg-[#fffbeb] p-4 grid gap-3">
            <p className="text-xs font-semibold text-[#92400e] uppercase tracking-wide">Additional Penalty (optional)</p>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Penalty amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={penalty}
                onChange={(e) => setPenalty(e.target.value)}
                placeholder="0.00 — leave blank if no penalty"
                className={IC}
              />
            </div>
            {penaltyAmt > 0 && (
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Penalty note</label>
                <input
                  type="text"
                  value={penaltyNote}
                  onChange={(e) => setPenaltyNote(e.target.value)}
                  placeholder="e.g. FM 3.2% accepted, ₹2000 deducted by Sarvani"
                  className={IC}
                />
              </div>
            )}
            {penaltyAmt > 0 && (
              <p className="text-xs text-[#92400e]">
                ₹{penaltyAmt.toLocaleString("en-IN")} will be deducted from both customer settlement and supplier payout.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleConfirm}
              disabled={!reason.trim() || saving}
              className="btn btn-primary flex flex-1 items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <ShieldCheck size={14} />{saving ? "Saving…" : penaltyAmt > 0 ? `Accept with ₹${penaltyAmt.toLocaleString("en-IN")} penalty` : "Accept (no penalty)"}
            </button>
            <button onClick={onClose} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MODEL A ─────────────────────────────────────────────────────────────────

interface ProductGroup { product: string; count: number; grossMT: number; netMT: number; provisionalValue: number }
interface UploadResult {
  batchRef: string;
  batchId: string;
  reportDate: string | null;
  consignorName: string | null;
  sourcePdfUrl: string | null;
  created: number;
  skipped: number;
  lots: InwardLot[];
  parsedSummary: { total: number; byProduct: ProductGroup[] };
  importedSummary: { total: number; byProduct: ProductGroup[] };
  duplicateSummary: { total: number; byProduct: ProductGroup[] };
  errorSummary: { total: number; byProduct: ProductGroup[]; errors: { challan: string; reason: string }[] };
}

function UploadVerificationPanel({ result, onViewInvoice }: { result: UploadResult; onViewInvoice: () => void }) {
  const { parsedSummary, importedSummary, duplicateSummary, errorSummary } = result;
  const allClean = result.created === parsedSummary.total && duplicateSummary.total === 0 && errorSummary.total === 0;
  const hasErrors = errorSummary.total > 0;

  return (
    <div className="mt-4 rounded-xl border border-[#c8d4c0] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border-b border-[#edf0e8] bg-[#f6faef] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${allClean ? "bg-[#dcfce7] text-[#15803d]" : hasErrors ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {allClean ? "✓" : hasErrors ? "!" : "~"}
          </span>
          <div>
            <p className="text-sm font-bold text-[#172018]">{result.batchRef}</p>
            <p className="text-xs text-[#60735d]">
              {result.created} new lot{result.created !== 1 ? "s" : ""} created
              {duplicateSummary.total > 0 && ` · ${duplicateSummary.total} already in system`}
              {errorSummary.total > 0 && ` · ${errorSummary.total} failed`}
            </p>
          </div>
        </div>
        <button
          onClick={onViewInvoice}
          disabled={result.lots.length === 0}
          className="btn btn-primary flex items-center gap-1.5 text-xs disabled:opacity-40"
          title={result.lots.length === 0 ? "No new lots imported — nothing to invoice" : ""}
        >
          <FileText size={14} />Generate Invoice
        </button>
      </div>

      {/* All-duplicates notice */}
      {result.created === 0 && duplicateSummary.total === parsedSummary.total && (
        <div className="border-b border-[#edf0e8] bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <strong>All {parsedSummary.total} loads from this PDF are already in the system</strong> — they were imported in a previous session.
          No new lots were created. Use <em>Erase all data</em> if you need to re-import, or scroll down to view the existing lots.
        </div>
      )}

      {/* Verification table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[#9aad9c]">
              <th className="px-5 py-2.5 text-left">Product</th>
              <th className="px-4 py-2.5 text-right">PDF Loads</th>
              <th className="px-4 py-2.5 text-right">PDF Net (MT)</th>
              <th className="px-4 py-2.5 text-right">New Imported</th>
              <th className="px-4 py-2.5 text-right">Pre-existing</th>
              <th className="px-4 py-2.5 text-right">Errors</th>
              <th className="px-4 py-2.5 text-center">Verification</th>
            </tr>
          </thead>
          <tbody>
            {parsedSummary.byProduct.map((parsed) => {
              const imp = importedSummary.byProduct.find((i) => i.product === parsed.product);
              const dup = duplicateSummary.byProduct.find((d) => d.product === parsed.product);
              const err = errorSummary.byProduct.find((e) => e.product === parsed.product);

              const importedCount = imp?.count ?? 0;
              const dupCount = dup?.count ?? 0;
              const errCount = err?.count ?? 0;
              const totalAccounted = importedCount + dupCount + errCount;
              const importedNet = imp?.netMT ?? 0;

              const fullyNew = importedCount === parsed.count && dupCount === 0 && errCount === 0;
              const allAccounted = totalAccounted === parsed.count;

              return (
                <tr key={parsed.product} className="border-t border-[#edf0e8]">
                  <td className="px-5 py-3 font-medium">{parsed.product}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#536251]">{parsed.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#536251]">{parsed.netMT.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#172018]">{importedCount} ({importedNet.toFixed(3)} MT)</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {dupCount > 0 ? <span className="text-amber-700">{dupCount}</span> : <span className="text-[#9aad9c]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {errCount > 0 ? <span className="font-semibold text-red-700">{errCount}</span> : <span className="text-[#9aad9c]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {fullyNew ? (
                      <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-semibold text-[#15803d]">✓ All new</span>
                    ) : errCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">⚠ {errCount} failed</span>
                    ) : allAccounted && dupCount > 0 && importedCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{dupCount} pre-existing</span>
                    ) : allAccounted && dupCount === parsed.count ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">All pre-existing</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">⚠ Check data</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#c8d4c0] bg-[#f6faef] font-semibold">
              <td className="px-5 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{parsedSummary.total}</td>
              <td className="px-4 py-3 text-right tabular-nums">{parsedSummary.byProduct.reduce((s, p) => s + p.netMT, 0).toFixed(3)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{result.created} ({importedSummary.byProduct.reduce((s, p) => s + p.netMT, 0).toFixed(3)} MT)</td>
              <td className="px-4 py-3 text-right tabular-nums">{duplicateSummary.total > 0 ? <span className="text-amber-700">{duplicateSummary.total}</span> : "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums">{errorSummary.total > 0 ? <span className="text-red-700">{errorSummary.total}</span> : "—"}</td>
              <td className="px-4 py-3 text-center">
                {allClean ? (
                  <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-semibold text-[#15803d]">✓ All verified</span>
                ) : hasErrors ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">⚠ {errorSummary.total} error{errorSummary.total !== 1 ? "s" : ""}</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{duplicateSummary.total} pre-existing</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Error details */}
      {hasErrors && (
        <div className="border-t border-red-200 bg-red-50 px-5 py-3">
          <p className="text-xs font-semibold text-red-800 mb-1">Import errors — these loads were NOT saved:</p>
          {errorSummary.errors.map(({ challan, reason }) => (
            <p key={challan} className="text-xs text-red-700">{challan}: {reason}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelATab() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  // Revoke previous object URL and create a new one whenever pdfFile changes
  useEffect(() => {
    if (!pdfFile) { setPdfPreviewUrl(null); return; }
    const url = URL.createObjectURL(pdfFile);
    setPdfPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfFile]);

  const [lots, setLots] = useState<InwardLot[]>([]);
  const [batches, setBatches] = useState<{ id: string; batchRef: string; sourceFilename: string; reportDate: string; totalRows: number; mappedRows: number; status: string; sourcePdfUrl: string | null }[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [qualityRules, setQualityRules] = useState<QualityRule[]>([]);
  const [rates, setRates] = useState<RateMaster[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterBatchId, setFilterBatchId] = useState<string | null>(null);

  const [showLotForm, setShowLotForm] = useState(false);
  const [mappingLot, setMappingLot] = useState<InwardLot | null>(null);
  const [editQualityLot, setEditQualityLot] = useState<InwardLot | null>(null);
  const [overrideLot, setOverrideLot] = useState<InwardLot | null>(null);
  const [previewLot, setPreviewLot] = useState<InwardLot | null>(null);

  const lotQueueRef = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState("");
  const [searchStatus, setSearchStatus] = useState<string>("");
  const [searchMaterialId, setSearchMaterialId] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/lots?model=A", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/import-batches?model=A", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/materials", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/parties", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/quality-rules", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/rates", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([ls, bs, mats, pts, qrs, rts]) => {
      setLots(Array.isArray(ls) ? ls : []);
      setBatches(Array.isArray(bs) ? bs : []);
      setMaterials(Array.isArray(mats) ? mats : []);
      setParties(Array.isArray(pts) ? pts : []);
      setQualityRules(Array.isArray(qrs) ? qrs : []);
      setRates(Array.isArray(rts) ? rts : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll to the lot queue when a batch filter is activated
  useEffect(() => {
    if (filterBatchId && lotQueueRef.current) {
      setTimeout(() => lotQueueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [filterBatchId]);

  function patchLot(updated: InwardLot) {
    setLots((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  async function handlePdfUpload() {
    if (!pdfFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("pdf", pdfFile);
      const res = await fetch("/api/lots/import-pdf", { method: "POST", body: fd });
      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setUploadError(`Server error (${res.status}) — check server logs`);
        return;
      }
      if (!res.ok) {
        setUploadError((data.error as string) ?? `Import failed (${res.status})`);
        return;
      }
      setUploadResult({
        batchRef: data.batchRef as string,
        batchId: data.batchId as string,
        reportDate: (data.reportDate as string | null) ?? null,
        consignorName: (data.consignorName as string | null) ?? null,
        sourcePdfUrl: (data.sourcePdfUrl as string | null) ?? null,
        created: data.created as number,
        skipped: data.skipped as number,
        lots: (data.lots as InwardLot[]) ?? [],
        parsedSummary: (data.parsedSummary as UploadResult["parsedSummary"]) ?? { total: 0, byProduct: [] },
        importedSummary: (data.importedSummary as UploadResult["importedSummary"]) ?? { total: 0, byProduct: [] },
        duplicateSummary: (data.duplicateSummary as UploadResult["duplicateSummary"]) ?? { total: 0, byProduct: [] },
        errorSummary: (data.errorSummary as UploadResult["errorSummary"]) ?? { total: 0, byProduct: [], errors: [] },
      });
      if (data.skipDetails && (data.skipDetails as string[]).length > 0) {
        console.warn("Skipped lots:", data.skipDetails);
      }
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Network error");
    } finally {
      setUploading(false);
    }
  }

  async function handleApprove(lot: InwardLot) {
    const hasReadings = Object.keys(lot.qualityReadings).length > 0;
    if (!hasReadings) {
      const proceed = window.confirm(
        `${lot.documentRef} has no quality readings recorded.\n\nApproving will use full net weight with no quality deductions.\n\nProceed anyway?`
      );
      if (!proceed) return;
    }

    const rule =
      qualityRules.find((r) => r.id === lot.qualityRuleId) ??
      qualityRules.find((r) => r.materialId === lot.materialId && r.status === "Active");

    const patch: Record<string, unknown> = { status: "Approved" };

    if (rule && lot.netWeight > 0) {
      const calc = calculateLotSettlement(lot, rule);
      Object.assign(patch, {
        netPayableWeight: calc.netPayableWeight,
        grossSaleValue: calc.grossSaleValue,
        // Keep manually entered cessAmount for Model A; use engine value for others
        cessAmount: lot.businessModel === "A" ? lot.cessAmount : calc.cessAmount,
        paramDeductions: Object.fromEntries(calc.paramCalcs.map((c) => [c.paramKey, c.valueDeduction])),
      });
      if (calc.hasRejectTrigger) patch.status = "QualityHold";
    }

    const res = await fetch(`/api/lots/${lot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    patchLot(await res.json());
  }

  const latestBatch = batches[0];
  const previewRule = previewLot
    ? qualityRules.find((r) => r.id === previewLot.qualityRuleId) ??
      qualityRules.find((r) => r.materialId === previewLot.materialId && r.status === "Active")
    : undefined;

  // Compute cessTotal for a lot: material.cessRate (preferred) or rule.globalCessRate
  // grossSaleRate may have been overridden by rate-slab, so use the stored lot rate.
  function lotCessTotal(lot: InwardLot): number {
    const mat = materials.find((m) => m.id === lot.materialId);
    const rule =
      qualityRules.find((r) => r.id === lot.qualityRuleId) ??
      qualityRules.find((r) => r.materialId === lot.materialId && r.status === "Active");
    if (!rule && !mat) return lot.cessAmount; // no rule yet — use stored gate-paid as best estimate
    const cessRate = mat?.cessRate !== undefined ? mat.cessRate : (rule?.globalCessRate ?? 0);
    return Math.round((cessRate / 100) * lot.netWeight * lot.grossSaleRate * 100) / 100;
  }

  // Batch summary stats
  const totalLots = lots.length;
  const totalNetMT = lots.reduce((s, l) => s + l.netWeight, 0);
  const totalNetPayable = lots.reduce((s, l) => s + l.netPayableWeight, 0);
  const totalCustomerInvoice = lots.reduce((s, l) => s + l.grossSaleRate * l.netWeight, 0);
  const totalSupplierPayout = lots.reduce((s, l) => {
    const cessBalance = Math.max(0, lotCessTotal(l) - l.cessAmount);
    return s + l.grossSaleValue - cessBalance - l.akshayaMarginPerMT * l.netWeight - (l.holdPenalty ?? 0);
  }, 0);

  // Status breakdown for tiles
  const draftCount    = lots.filter(l => l.status === "Draft").length;
  const mappedCount   = lots.filter(l => l.status === "Mapped").length;
  const approvedCount = lots.filter(l => l.status === "Approved").length;
  const settledCount  = lots.filter(l => l.status === "Settled" || l.status === "Invoiced").length;
  const holdCount     = lots.filter(l => l.status === "QualityHold").length;

  // Quality deduction summary
  const totalQualityDeductMT = lots.reduce((s, l) => s + Math.max(0, l.netWeight - l.netPayableWeight), 0);

  // Margin earned and avg rate
  const totalMarginEarned = lots.reduce((s, l) => s + l.akshayaMarginPerMT * l.netWeight, 0);
  const avgRatePerMT = totalNetMT > 0 ? totalCustomerInvoice / totalNetMT : 0;

  // Filtered lot queue (batch filter + search params)
  const filteredLots = useMemo(() => {
    let result = filterBatchId ? lots.filter(l => l.importBatchId === filterBatchId) : lots;
    if (searchText.trim()) {
      const s = searchText.trim().toLowerCase();
      result = result.filter(l =>
        l.documentRef.toLowerCase().includes(s) ||
        (l.vehicleNo ?? "").toLowerCase().includes(s) ||
        (l.supplierName ?? "").toLowerCase().includes(s) ||
        l.materialName.toLowerCase().includes(s),
      );
    }
    if (searchStatus) result = result.filter(l => l.status === searchStatus);
    if (searchMaterialId) result = result.filter(l => l.materialId === searchMaterialId);
    return result;
  }, [lots, filterBatchId, searchText, searchStatus, searchMaterialId]);

  return (
    <div className="grid gap-6">
      {/* Dialogs */}
      {mappingLot && (
        <MappingDialog
          lot={mappingLot} parties={parties}
          onSaved={(saved) => { patchLot(saved); setMappingLot(null); }}
          onClose={() => setMappingLot(null)}
        />
      )}
      {editQualityLot && (
        <QualityEditDialog
          lot={editQualityLot} qualityRules={qualityRules}
          onSaved={(saved) => { patchLot(saved); setEditQualityLot(null); }}
          onClose={() => setEditQualityLot(null)}
        />
      )}
      {overrideLot && (
        <OverrideDialog
          lot={overrideLot}
          qualityRule={qualityRules.find((r) => r.id === overrideLot.qualityRuleId)}
          onSaved={(saved) => { patchLot(saved); setOverrideLot(null); }}
          onClose={() => setOverrideLot(null)}
        />
      )}
      {previewLot && (
        <SettlementPreview
          lot={previewLot}
          rule={previewRule}
          allRules={qualityRules}
          material={materials.find((m) => m.id === previewLot.materialId)}
          onClose={() => setPreviewLot(null)}
          onApprove={previewLot.status === "Approved" ? async () => {
            try {
              const res = await fetch(`/api/lots/${previewLot.id}/settle`, { method: "POST" });
              const d = await res.json();
              if (!res.ok) { alert("Settlement failed: " + (d.error ?? "Unknown error")); return; }
              setPreviewLot(null);
              load();
            } catch {
              alert("Network error posting settlement. Please try again.");
            }
          } : undefined}
        />
      )}

      {/* PDF Import panel */}
      <div className="rounded-xl border border-dashed border-[#aebba8] bg-white p-6">
        <h3 className="text-xl font-semibold">Upload Sarvani weighbridge PDF</h3>
        <p className="mt-1 text-sm leading-6 text-[#60735d]">
          System extracts challan no, truck, date, gross/tare/net weights from the PDF and creates Draft lots automatically. Each lot costs ₹50/MT Akshaya margin by default.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div>
            <input
              type="file" accept=".pdf" id="pdf-upload"
              onChange={(e) => { setPdfFile(e.target.files?.[0] ?? null); setUploadResult(null); setUploadError(null); }}
              className="hidden"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer rounded-md border border-[#c8d4c0] bg-[#f6faef] px-4 py-2.5 text-sm font-semibold hover:bg-[#eef3e8]">
              {pdfFile ? pdfFile.name : "Choose PDF…"}
            </label>
          </div>
          <button
            onClick={handlePdfUpload}
            disabled={!pdfFile || uploading}
            className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Upload size={14} />{uploading ? "Importing…" : "Parse & import lots"}
          </button>
          <button
            onClick={async () => {
              if (!pdfFile) return;
              const fd = new FormData(); fd.append("pdf", pdfFile);
              const res = await fetch("/api/lots/pdf-debug", { method: "POST", body: fd });
              const d = await res.json();
              console.log("=== PDF RAW TEXT ===\n", d.raw);
              console.log("=== PDF LINES ===\n", d.lines?.join("\n"));
              alert("PDF text dumped to browser console (F12 → Console)");
            }}
            disabled={!pdfFile}
            className="btn btn-ghost flex items-center gap-1.5 text-xs disabled:opacity-50"
          >
            <Bug size={14} />Debug PDF
          </button>
          <button
            onClick={async () => {
              if (!window.confirm("Delete ALL lots and import batches? This cannot be undone.")) return;
              const res = await fetch("/api/procurement/clear", { method: "DELETE" });
              const d = await res.json();
              if (!res.ok) { alert("Error: " + d.error); return; }
              setUploadResult(null); setUploadError(null); setPdfFile(null);
              load();
            }}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 hover:underline"
          >
            <Trash2 size={12} />Erase all data
          </button>
        </div>

        {/* PDF preview — shown as soon as a file is selected, persists after import */}
        {pdfPreviewUrl && (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#c8d4c0]">
            <div className="flex items-center justify-between bg-[#f6faef] px-4 py-2 text-xs text-[#536251]">
              <span className="font-semibold">{pdfFile?.name}</span>
              <button
                onClick={() => { setPdfFile(null); }}
                className="text-[#dc2626] hover:underline"
              >
                Clear
              </button>
            </div>
            <iframe
              src={pdfPreviewUrl}
              className="w-full"
              style={{ height: 520 }}
              title="PDF preview"
            />
          </div>
        )}

        {uploadResult && <UploadVerificationPanel result={uploadResult} onViewInvoice={() => setShowInvoice(true)} />}
        {uploadError && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{uploadError}</div>
        )}

        {showInvoice && uploadResult && (
          <BatchInvoiceDialog
            lots={uploadResult.lots}
            batchRef={uploadResult.batchRef}
            reportDate={uploadResult.reportDate}
            consignorName={uploadResult.consignorName}
            onClose={() => setShowInvoice(false)}
          />
        )}
      </div>

      {/* Batch summary KPIs */}
      {!loading && totalLots > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total lots",
              value: String(totalLots),
              sub: [
                draftCount > 0    && `${draftCount} draft`,
                mappedCount > 0   && `${mappedCount} mapped`,
                holdCount > 0     && `${holdCount} hold`,
                approvedCount > 0 && `${approvedCount} approved`,
                settledCount > 0  && `${settledCount} settled`,
              ].filter(Boolean).join(" · ") || "—",
              accent: holdCount > 0,
            },
            {
              label: "Net weight",
              value: `${totalNetMT.toFixed(2)} MT`,
              sub: totalQualityDeductMT > 0.001
                ? `${totalNetPayable.toFixed(2)} MT payable · ${totalQualityDeductMT.toFixed(3)} MT quality deducted`
                : `${totalNetPayable.toFixed(2)} MT payable · no quality deductions`,
              accent: false,
            },
            {
              label: "Customer invoice",
              value: inr(totalCustomerInvoice),
              sub: `₹${avgRatePerMT > 0 ? Math.round(avgRatePerMT).toLocaleString("en-IN") : "—"}/MT avg · GST exempt`,
              accent: false,
            },
            {
              label: "Supplier payout",
              value: inr(totalSupplierPayout),
              sub: `Margin earned ${inr(totalMarginEarned)} · ₹${totalNetMT > 0 ? Math.round(totalMarginEarned / totalNetMT).toLocaleString("en-IN") : "—"}/MT avg`,
              accent: false,
            },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} className={`rounded-xl border bg-white p-4 ${accent ? "border-amber-300 bg-amber-50" : "border-[#d8decf]"}`}>
              <p className="text-xs text-[#60735d]">{label}</p>
              <p className="mt-1.5 text-xl font-bold text-[#172018]">{value}</p>
              {sub && <p className="mt-0.5 text-xs text-[#9aad9c]">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Import batch history */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-semibold">Import batch history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
              <tr>{["Batch ref", "File", "Report date", "Rows", "Mapped", "Status", "Actions"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-semibold">{b.batchRef}</td>
                  <td className="px-5 py-3.5 max-w-50 truncate text-[#536251]">{b.sourceFilename}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{b.reportDate}</td>
                  <td className="px-5 py-3.5">{b.totalRows}</td>
                  <td className="px-5 py-3.5">
                    <span className={b.mappedRows === b.totalRows ? "font-bold text-[#15803d]" : "font-bold text-[#d97706]"}>
                      {b.mappedRows}/{b.totalRows}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setFilterBatchId((prev) => prev === b.id ? null : b.id)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${filterBatchId === b.id ? "text-[#dc2626]" : "text-[#1d4ed8]"}`}
                      >
                        {filterBatchId === b.id ? <><X size={12} />Clear filter</> : <><Eye size={12} />View lots</>}
                      </button>
                      {b.sourcePdfUrl && (
                        <a href={b.sourcePdfUrl} target="_blank" rel="noopener noreferrer" title="Open source PDF"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#c8d4c0] bg-white text-[#536251] hover:bg-[#f0f4ec] hover:text-[#172018]">
                          <FileText size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inward lot queue */}
      <div ref={lotQueueRef} className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Model A inward lot queue</h3>
            {filterBatchId && (
              <p className="mt-0.5 text-xs text-amber-700 font-semibold">
                Showing {filteredLots.length} lot{filteredLots.length !== 1 ? "s" : ""} from batch <strong>{batches.find((b) => b.id === filterBatchId)?.batchRef ?? filterBatchId}</strong>
                {" "}·{" "}
                <button onClick={() => setFilterBatchId(null)} className="text-[#dc2626] hover:underline">show all</button>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLotForm((v) => !v)}
              className={showLotForm ? "btn btn-ghost flex items-center gap-1.5" : "btn btn-primary flex items-center gap-1.5"}
            >
              {showLotForm ? <><X size={14} />Cancel entry</> : <><Plus size={14} />Manual entry</>}
            </button>
            <button className="btn btn-ghost flex items-center gap-1.5"><Download size={14} />Export</button>
          </div>
        </div>

        {/* Multi-parameter search bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#edf0e8] bg-[#fafcf8] px-5 py-3">
          <SlidersHorizontal size={13} className="shrink-0 text-[#9aad9c]" />
          <div className="relative min-w-48 flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search challan, vehicle, supplier, material…"
              className="w-full rounded-lg border border-[#c8d4c0] bg-white py-1.5 pl-7 pr-7 text-xs text-[#172018] placeholder:text-[#b8c8b4] focus:border-[#16a34a] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
            />
            {searchText && (
              <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9aad9c] hover:text-[#172018]">
                <X size={11} />
              </button>
            )}
          </div>
          <select
            value={searchMaterialId}
            onChange={(e) => setSearchMaterialId(e.target.value)}
            className="rounded-lg border border-[#c8d4c0] bg-white px-2.5 py-1.5 text-xs text-[#172018] focus:border-[#16a34a] focus:outline-none"
          >
            <option value="">All materials</option>
            {[...new Set(lots.map(l => l.materialId))].map(mid => {
              const name = lots.find(l => l.materialId === mid)?.materialName ?? mid;
              return <option key={mid} value={mid}>{name}</option>;
            })}
          </select>
          <select
            value={searchStatus}
            onChange={(e) => setSearchStatus(e.target.value)}
            className="rounded-lg border border-[#c8d4c0] bg-white px-2.5 py-1.5 text-xs text-[#172018] focus:border-[#16a34a] focus:outline-none"
          >
            <option value="">All statuses</option>
            {(["Draft", "Mapped", "QualityHold", "Approved", "Settled", "Invoiced"] as const).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(searchText || searchStatus || searchMaterialId) && (
            <button
              onClick={() => { setSearchText(""); setSearchStatus(""); setSearchMaterialId(""); }}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              <X size={11} />Clear
            </button>
          )}
          {(searchText || searchStatus || searchMaterialId || filterBatchId) && filteredLots.length !== lots.length && (
            <span className="ml-auto text-xs text-[#9aad9c]">{filteredLots.length} of {lots.length} lots</span>
          )}
        </div>

        {showLotForm && (
          <div className="border-b border-[#edf0e8] p-5">
            <LotEntryForm
              materials={materials}
              parties={parties}
              qualityRules={qualityRules}
              rates={rates}
              onSaved={(saved) => { setLots((prev) => [saved, ...prev]); setShowLotForm(false); }}
              onClose={() => setShowLotForm(false)}
            />
          </div>
        )}

        {/* Settlement flow guide */}
        <div className="flex items-center gap-0 text-xs overflow-x-auto pb-1">
          {[
            { label: "Draft", sub: "Lot created", color: "bg-[#f3f6ef] text-[#60735d]" },
            { label: "Mapped", sub: "Supplier assigned", color: "bg-[#eff6ff] text-[#1d4ed8]" },
            { label: "Readings", sub: "Quality entered", color: "bg-[#fdf4ff] text-[#7e22ce]" },
            { label: "Approved", sub: "Ready to settle", color: "bg-[#f0fdf4] text-[#15803d]" },
            { label: "Settled", sub: "Invoice posted", color: "bg-[#ecfdf5] text-[#065f46]" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center shrink-0">
              {i > 0 && <div className="w-5 h-px bg-[#d1e0c8] mx-1" />}
              <div className={`rounded-lg px-3 py-1.5 ${step.color}`}>
                <p className="font-semibold leading-none">{step.label}</p>
                <p className="text-[10px] opacity-70 mt-0.5 whitespace-nowrap">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-[#60735d]">Loading lots…</p>
        ) : (
          <div className="overflow-x-auto">
            {filteredLots.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[#9aad9c] text-center">
                {searchText || searchStatus || searchMaterialId ? "No lots match your search filters." : "No lots yet."}
              </p>
            ) : (
            <table className="w-full text-left">
              <thead className="bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  <th className="px-3 py-2">Lot / Date</th>
                  <th className="px-3 py-2">Material / Vehicle</th>
                  <th className="px-3 py-2 text-right">Net (MT)</th>
                  <th className="px-3 py-2 text-center">Quality</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Deductions</th>
                  <th className="px-3 py-2 text-right">Receivable</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                  <th className="px-3 py-2 text-right">Sup. Payable</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLots.map((lot) => (
                  <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    {/* Lot / Date */}
                    <td className="px-3 py-2">
                      <p className="text-xs font-semibold text-[#172018]">{lot.documentRef}</p>
                      <p className="text-[10px] text-[#8fa88c] mt-0.5">{lot.lotDate}</p>
                    </td>
                    {/* Material / Vehicle */}
                    <td className="px-3 py-2">
                      <p className="text-xs font-medium text-[#172018]">{lot.materialName}</p>
                      <p className="text-[10px] font-mono text-[#8fa88c] mt-0.5">{lot.vehicleNo}</p>
                    </td>
                    {/* Net weight */}
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-bold text-[#172018]">{lot.netWeight.toFixed(3)}</span>
                    </td>
                    {/* Quality readings — dynamic, all params */}
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const SHORT: Record<string, string> = {
                          moisture_pct: "M", fm_pct: "FM", bg_pct: "BG",
                          gcv: "GCV", ash_pct: "Ash", protein_pct: "Prot",
                        };
                        const entries = Object.entries(lot.qualityReadings).filter(([, v]) => v !== "" && v !== null);
                        if (entries.length === 0) return <span className="text-[10px] text-[#c5d0bf]">No readings</span>;
                        return (
                          <div className="flex flex-col gap-0.5">
                            {entries.map(([k, v]) => {
                              const label = SHORT[k] ?? k;
                              const num = typeof v === "number" ? v : Number(v);
                              const isHigh = (k === "moisture_pct" && num > 15) || (k === "fm_pct" && num > 1.5);
                              return (
                                <span key={k} className={`text-[10px] font-bold ${isHigh ? "text-[#dc2626]" : "text-[#172018]"}`}>
                                  {label} {num}%
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    {/* Rate */}
                    <td className="px-3 py-2 text-right">
                      <p className="text-xs font-bold text-[#172018]">{inr(lot.grossSaleRate)}</p>
                      <p className="text-[10px] text-[#8fa88c]">/MT</p>
                    </td>
                    {/* Supplier */}
                    <td className="px-3 py-2">
                      {lot.supplierName
                        ? <span className="text-xs font-semibold text-[#172018]">{lot.supplierName}</span>
                        : <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-[#dc2626]">⚠ Unmapped</span>}
                    </td>
                    {/* Gross = netWeight × rate (before quality deductions) */}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {lot.grossSaleRate > 0
                        ? <span className="text-xs font-bold text-[#15803d]">{inr(lot.grossSaleRate * lot.netWeight)}</span>
                        : <span className="text-xs text-[#c5d0bf]">—</span>}
                    </td>
                    {/* Deductions = quality paramDeductions + cessBalance — inline sub-rows */}
                    <td className="px-3 py-2 text-right">
                      {(() => {
                        const deductions = lot.paramDeductions ?? {};
                        const cessBalance = Math.max(0, lotCessTotal(lot) - lot.cessAmount);
                        const PARAM_LABELS: Record<string, string> = {
                          moisture_pct: "Moisture", fm_pct: "FM", bg_pct: "Broken Grain",
                          gcv: "GCV", ash_pct: "Ash", protein_pct: "Protein",
                        };
                        const qualityTotal = Object.values(deductions).reduce((s: number, v) => s + Number(v), 0);
                        const total = qualityTotal + cessBalance;
                        if (total === 0) return <span className="text-xs text-[#c5d0bf]">—</span>;
                        return (
                          <div>
                            <span className="text-xs font-semibold text-[#dc2626]">−{inr(total)}</span>
                            {Object.entries(deductions).map(([k, v]) => Number(v) > 0 && (
                              <p key={k} className="text-[10px] text-[#9aad9c] mt-0.5">
                                {PARAM_LABELS[k] ?? k}: −{inr(Number(v))}
                              </p>
                            ))}
                            {cessBalance > 0 && (
                              <p className="text-[10px] text-[#9aad9c] mt-0.5">Cess: −{inr(cessBalance)}</p>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    {/* Receivable = Gross − Deductions = grossSaleValue − cessBalance */}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {(() => {
                        const cessBalance = Math.max(0, lotCessTotal(lot) - lot.cessAmount);
                        const receivable = lot.grossSaleValue - cessBalance;
                        return receivable > 0
                          ? <span className="text-xs font-bold text-[#172018]">{inr(receivable)}</span>
                          : <span className="text-xs text-[#c5d0bf]">—</span>;
                      })()}
                    </td>
                    {/* Margin */}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <span className="text-xs text-[#536251]">{inr(lot.akshayaMarginPerMT * lot.netWeight)}</span>
                      <p className="text-[10px] text-[#c5d0bf]">₹{lot.akshayaMarginPerMT}/MT</p>
                    </td>
                    {/* Sup. Payable = Receivable − cess balance − margin − hold penalty */}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {(() => {
                        const cessBalance = Math.max(0, lotCessTotal(lot) - lot.cessAmount);
                        const margin = lot.akshayaMarginPerMT * lot.netWeight;
                        const payout = lot.grossSaleValue - cessBalance - margin - (lot.holdPenalty ?? 0);
                        return lot.grossSaleValue > 0
                          ? <span className="text-xs font-bold text-[#1d4ed8]">{inr(payout)}</span>
                          : <span className="text-xs text-[#c5d0bf]">—</span>;
                      })()}
                    </td>
                    {/* Status */}
                    <td className="px-3 py-2">
                      <StatusBadge status={lot.status} />
                    </td>
                    {/* Actions — icon buttons, sequential */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {/* Draft → Map Supplier */}
                        {lot.status === "Draft" && (
                          <button title="Map Supplier" onClick={() => setMappingLot(lot)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700">
                            <Link2 size={13} />
                          </button>
                        )}
                        {/* Mapped (no readings) → Enter Readings */}
                        {lot.status === "Mapped" && Object.keys(lot.qualityReadings).length === 0 && (
                          <button title="Enter Quality Readings" onClick={() => setEditQualityLot(lot)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-white shadow-sm hover:bg-violet-700">
                            <FlaskConical size={13} />
                          </button>
                        )}
                        {/* Mapped (has readings) → Edit + Approve */}
                        {lot.status === "Mapped" && Object.keys(lot.qualityReadings).length > 0 && (
                          <>
                            <button title="Edit Readings" onClick={() => setEditQualityLot(lot)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#c8d4c0] bg-white text-[#536251] hover:bg-[#f0f4ec]">
                              <Pencil size={12} />
                            </button>
                            <button title="Approve Lot" onClick={() => handleApprove(lot)}
                              className="flex h-7 w-7 items-center justify-center rounded-md bg-green-600 text-white shadow-sm hover:bg-green-700">
                              <CheckCircle2 size={13} />
                            </button>
                          </>
                        )}
                        {/* QualityHold → Re-read + Accept */}
                        {lot.status === "QualityHold" && (
                          <>
                            <button title="Edit Readings" onClick={() => setEditQualityLot(lot)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#c8d4c0] bg-white text-[#536251] hover:bg-[#f0f4ec]">
                              <Pencil size={12} />
                            </button>
                            <button title="Accept Lot (override hold)" onClick={() => setOverrideLot(lot)}
                              className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-white shadow-sm hover:bg-amber-600">
                              <ShieldCheck size={13} />
                            </button>
                          </>
                        )}
                        {/* Approved → Settlement */}
                        {lot.status === "Approved" && (
                          <button title="Open Settlement" onClick={() => setPreviewLot(lot)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#172018] text-[#d8ff72] shadow-sm hover:bg-[#2a3b29]">
                            <FileText size={13} />
                          </button>
                        )}
                        {/* Complete */}
                        {(lot.status === "Settled" || lot.status === "Invoiced") && (
                          <CheckCircle2 size={16} className="text-[#15803d]" />
                        )}
                        {/* Preview — available for any lot that has been mapped */}
                        {lot.status !== "Draft" && (
                          <button title="Preview Settlement" onClick={() => setPreviewLot(lot)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#c8d4c0] bg-white text-[#9aad9c] hover:text-[#172018] hover:bg-[#f0f4ec]">
                            <Eye size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODEL B ─────────────────────────────────────────────────────────────────

function ModelBTab() {
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/lots?model=B", { cache: "no-store" }).then((r) => r.json())
      .then((d) => setLots(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return lots;
    const q = search.toLowerCase();
    return lots.filter((l) =>
      l.documentRef.toLowerCase().includes(q) ||
      (l.farmerName ?? "").toLowerCase().includes(q) ||
      l.materialName.toLowerCase().includes(q) ||
      (l.vehicleNo ?? "").toLowerCase().includes(q)
    );
  }, [lots, search]);

  const totalMT     = lots.reduce((s, l) => s + l.netWeight, 0);
  const totalValue  = lots.reduce((s, l) => s + l.grossSaleValue, 0);
  const settled     = lots.filter((l) => l.status === "Settled" || l.status === "Invoiced").length;
  const pending     = lots.length - settled;
  const farmerCount = new Set(lots.map((l) => l.farmerName).filter(Boolean)).size;

  const fmt3 = (n: number) => n.toFixed(3);

  return (
    <div className="grid gap-6">
      {/* Info banner */}
      <div className="rounded-xl border border-[#c8d4f0] bg-[#eff6ff] p-5">
        <h3 className="font-semibold text-[#1d4ed8]">Model B — Farmer Finance Flow</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#1e3a8a]">
          Akshaya pays farmers directly before receiving payment from Sarvani. Finance advance exposure is tracked per lot.
          Create farmer supply lots via <strong>Finance Flow → Farmer Bills</strong>.
        </p>
      </div>

      {/* KPI tiles */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total lots",    value: String(lots.length),        sub: `${farmerCount} farmer${farmerCount !== 1 ? "s" : ""}` },
            { label: "Total net MT",  value: `${totalMT.toFixed(2)} MT`, sub: "aggregate weight" },
            { label: "Total value",   value: inr(totalValue),            sub: "provisional gross" },
            { label: "Settlement",    value: `${settled} settled`,       sub: `${pending} pending`,  accent: pending > 0 },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} className={`rounded-xl border bg-white p-4 ${accent ? "border-amber-300 bg-amber-50" : "border-[#d8decf]"}`}>
              <p className="text-xs text-[#60735d]">{label}</p>
              <p className="mt-1.5 text-xl font-bold text-[#172018]">{value}</p>
              {sub && <p className="mt-0.5 text-xs text-[#9aad9c]">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Lot table */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#edf0e8] px-5 py-4">
          <h3 className="mr-auto text-lg font-semibold">Farmer supply lots</h3>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Farmer, lot, vehicle…"
              className="rounded-lg border border-[#c8d4c0] py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            />
          </div>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-[#60735d]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#9aad9c]">
            {lots.length === 0
              ? "No Model B lots yet. Create lots via Finance Flow → Farmer Bills."
              : "No lots match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {["Lot / Date", "Farmer", "Material", "Vehicle", "Net (MT)", "Rate", "Gross Value", "Quality Ded.", "Net Payable", "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot) => {
                  const qualDed = Object.values(lot.paramDeductions ?? {}).reduce((s: number, v) => s + Number(v), 0);
                  const netPayable = lot.grossSaleValue - qualDed;
                  return (
                    <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-[#172018]">{lot.documentRef}</p>
                        <p className="text-[10px] text-[#9aad9c]">{lot.lotDate}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#172018]">{lot.farmerName ?? "—"}</td>
                      <td className="px-4 py-3 text-[#536251]">{lot.materialName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#536251]">{lot.vehicleNo ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt3(lot.netWeight)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xs font-bold">₹{lot.grossSaleRate.toLocaleString("en-IN")}</p>
                        <p className="text-[10px] text-[#9aad9c]">/MT</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {lot.grossSaleValue > 0
                          ? <span className="text-xs font-bold text-[#15803d]">{inr(lot.grossSaleValue)}</span>
                          : <span className="text-xs text-[#c5d0bf]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {qualDed > 0
                          ? <span className="text-xs font-semibold text-[#dc2626]">−{inr(qualDed)}</span>
                          : <span className="text-xs text-[#c5d0bf]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {netPayable > 0
                          ? <span className="text-xs font-bold text-[#172018]">{inr(netPayable)}</span>
                          : <span className="text-xs text-[#c5d0bf]">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={lot.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#172018] bg-[#f8faf5] text-sm font-semibold">
                  <td colSpan={4} className="px-4 py-3">Total ({filtered.length} lots)</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt3(filtered.reduce((s, l) => s + l.netWeight, 0))}</td>
                  <td />
                  <td className="px-4 py-3 text-right">{inr(filtered.reduce((s, l) => s + l.grossSaleValue, 0))}</td>
                  <td className="px-4 py-3 text-right text-[#dc2626]">
                    {(() => {
                      const t = filtered.reduce((s, l) => s + Object.values(l.paramDeductions ?? {}).reduce((a, v) => a + Number(v), 0), 0);
                      return t > 0 ? `−${inr(t)}` : "—";
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inr(filtered.reduce((s, l) => {
                      const ded = Object.values(l.paramDeductions ?? {}).reduce((a, v) => a + Number(v), 0);
                      return s + l.grossSaleValue - ded;
                    }, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WEIGHMENT ────────────────────────────────────────────────────────────────

const PARAM_SHORT: Record<string, string> = {
  moisture_pct: "M", fm_pct: "FM", broken_grain_pct: "BG",
  gcv: "GCV", ash_pct: "Ash", protein_pct: "Prot",
  sulphur_pct: "Sul", sand_silica_pct: "SS", aflatoxin_ppb: "Afla",
};

function WeighmentTab() {
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/lots", { cache: "no-store" }).then((r) => r.json())
      .then((d) => setLots(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let r = lots;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((l) =>
        l.documentRef.toLowerCase().includes(q) ||
        (l.vehicleNo ?? "").toLowerCase().includes(q) ||
        l.materialName.toLowerCase().includes(q) ||
        (l.supplierName ?? "").toLowerCase().includes(q) ||
        (l.farmerName ?? "").toLowerCase().includes(q)
      );
    }
    if (filterModel) r = r.filter((l) => l.businessModel === filterModel);
    if (filterStatus) r = r.filter((l) => l.status === filterStatus);
    if (filterMaterial) r = r.filter((l) => l.materialId === filterMaterial);
    return r;
  }, [lots, search, filterModel, filterStatus, filterMaterial]);

  const totalGross    = lots.reduce((s, l) => s + l.grossWeight, 0);
  const totalNet      = lots.reduce((s, l) => s + l.netWeight, 0);
  const totalPayable  = lots.reduce((s, l) => s + l.netPayableWeight, 0);
  const totalDeducted = totalNet - totalPayable;
  const avgDeductPct  = totalNet > 0 ? (totalDeducted / totalNet) * 100 : 0;
  const materialIds   = [...new Set(lots.map((l) => l.materialId))];

  return (
    <div className="grid gap-6">
      {/* KPI tiles */}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total lots",       value: String(lots.length),           sub: `${materialIds.length} material${materialIds.length !== 1 ? "s" : ""}` },
            { label: "Total gross",      value: `${totalGross.toFixed(2)} MT`, sub: "all models" },
            { label: "Net payable",      value: `${totalPayable.toFixed(2)} MT`, sub: `of ${totalNet.toFixed(2)} MT net` },
            { label: "Quality deducted", value: `${totalDeducted.toFixed(3)} MT`, sub: `${avgDeductPct.toFixed(2)}% avg`, accent: avgDeductPct > 2 },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} className={`rounded-xl border bg-white p-4 ${accent ? "border-amber-300 bg-amber-50" : "border-[#d8decf]"}`}>
              <p className="text-xs text-[#60735d]">{label}</p>
              <p className="mt-1.5 text-xl font-bold text-[#172018]">{value}</p>
              {sub && <p className="mt-0.5 text-xs text-[#9aad9c]">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Register */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#edf0e8] px-5 py-4">
          <h3 className="mr-auto text-lg font-semibold">Weighment register</h3>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lot, vehicle, supplier…"
              className="rounded-lg border border-[#c8d4c0] py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#16a34a]"
            />
          </div>
          <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)}
            className="rounded-lg border border-[#c8d4c0] bg-white px-2.5 py-1.5 text-xs focus:outline-none">
            <option value="">All models</option>
            <option value="A">Model A</option>
            <option value="B">Model B</option>
          </select>
          <select value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value)}
            className="rounded-lg border border-[#c8d4c0] bg-white px-2.5 py-1.5 text-xs focus:outline-none">
            <option value="">All materials</option>
            {materialIds.map((mid) => {
              const name = lots.find((l) => l.materialId === mid)?.materialName ?? mid;
              return <option key={mid} value={mid}>{name}</option>;
            })}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-[#c8d4c0] bg-white px-2.5 py-1.5 text-xs focus:outline-none">
            <option value="">All statuses</option>
            {(["Draft","Mapped","QualityHold","Approved","Settled","Invoiced"] as const).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(search || filterModel || filterStatus || filterMaterial) && (
            <button onClick={() => { setSearch(""); setFilterModel(""); setFilterStatus(""); setFilterMaterial(""); }}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
              <X size={11} />Clear
            </button>
          )}
          <button className="btn btn-ghost flex items-center gap-1.5 text-xs"><Download size={13} />Export</button>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-[#60735d]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#9aad9c]">No lots match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {["Model","Lot / Date","Vehicle","Material","Party","Gross MT","Tare MT","Net MT","Quality Readings","Ded. MT","Net Payable","Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot) => {
                  const deductedMT = Math.max(0, lot.netWeight - lot.netPayableWeight);
                  const readings = Object.entries(lot.qualityReadings).filter(([, v]) => v !== "" && v !== null);
                  const party = lot.supplierName ?? lot.farmerName ?? "—";
                  return (
                    <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${lot.businessModel === "A" ? "bg-[#172018] text-white" : "bg-[#405b3d] text-white"}`}>
                          {lot.businessModel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold">{lot.documentRef}</p>
                        <p className="text-[10px] text-[#9aad9c]">{lot.lotDate}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#536251]">{lot.vehicleNo ?? "—"}</td>
                      <td className="px-4 py-3 text-[#172018]">{lot.materialName}</td>
                      <td className="px-4 py-3 text-xs text-[#536251]">{party}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{lot.grossWeight.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#9aad9c]">{lot.tareWeight.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{lot.netWeight.toFixed(3)}</td>
                      <td className="px-4 py-3">
                        {readings.length === 0 ? (
                          <span className="text-[10px] text-[#c5d0bf]">No readings</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {readings.map(([k, v]) => {
                              const num = Number(v);
                              const isHigh = (k === "moisture_pct" && num > 15) || (k === "fm_pct" && num > 1.5) || (k === "broken_grain_pct" && num > 5);
                              return (
                                <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isHigh ? "bg-red-100 text-red-700" : "bg-[#f3f6ef] text-[#536251]"}`}>
                                  {PARAM_SHORT[k] ?? k} {num}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deductedMT > 0.001
                          ? <span className="text-xs font-semibold text-[#dc2626]">−{deductedMT.toFixed(3)}</span>
                          : <span className="text-xs text-[#c5d0bf]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{lot.netPayableWeight.toFixed(3)}</td>
                      <td className="px-4 py-3"><StatusBadge status={lot.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#172018] bg-[#f8faf5] text-sm font-semibold">
                  <td colSpan={5} className="px-4 py-3">Total ({filtered.length} lots)</td>
                  <td className="px-4 py-3 text-right tabular-nums">{filtered.reduce((s, l) => s + l.grossWeight, 0).toFixed(3)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#9aad9c]">{filtered.reduce((s, l) => s + l.tareWeight, 0).toFixed(3)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{filtered.reduce((s, l) => s + l.netWeight, 0).toFixed(3)}</td>
                  <td />
                  <td className="px-4 py-3 text-right text-[#dc2626] tabular-nums">
                    {(() => { const t = filtered.reduce((s, l) => s + Math.max(0, l.netWeight - l.netPayableWeight), 0); return t > 0.001 ? `−${t.toFixed(3)}` : "—"; })()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{filtered.reduce((s, l) => s + l.netPayableWeight, 0).toFixed(3)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SETTLEMENTS ─────────────────────────────────────────────────────────────

function SettlementsTab() {
  const [payouts, setPayouts] = useState<FarmerPayout[]>([]);
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/payouts", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/lots", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([ps, ls]) => {
      setPayouts(Array.isArray(ps) ? ps : []);
      setLots(Array.isArray(ls) ? ls : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function postSettle(lotId: string) {
    setSettling(lotId);
    setSettleError((prev) => { const n = { ...prev }; delete n[lotId]; return n; });
    const res = await fetch(`/api/lots/${lotId}/settle`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setSettling(null);
    if (!res.ok) {
      setSettleError((prev) => ({ ...prev, [lotId]: d.error ?? "Settlement failed" }));
      return;
    }
    load();
  }

  async function approvePayout(id: string) {
    await fetch("/api/payouts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, paymentStatus: "Approved" }),
    });
    load();
  }

  const pendingLots    = lots.filter((l) => l.status === "Approved");
  const settledLots    = lots.filter((l) => l.status === "Settled" || l.status === "Invoiced");
  const pendingPayouts = payouts.filter((f) => f.paymentStatus === "Pending");
  const paidPayouts    = payouts.filter((f) => f.paymentStatus === "Paid");

  const pendingValue  = pendingLots.reduce((s, l) => s + l.grossSaleValue - l.akshayaMarginPerMT * l.netWeight, 0);
  const settledValue  = settledLots.reduce((s, l) => s + l.grossSaleValue, 0);
  const pendingPayout = pendingPayouts.reduce((s, f) => s + f.netAmount, 0);

  return (
    <div className="grid gap-6">
      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Pending settlement",  value: String(pendingLots.length),   sub: pendingLots.length > 0 ? `~${inr(pendingValue)} payable` : "All clear",      accent: pendingLots.length > 0 },
          { label: "Settled lots",        value: String(settledLots.length),   sub: settledLots.length > 0 ? `${inr(settledValue)} gross` : "None yet" },
          { label: "Farmer payouts due",  value: String(pendingPayouts.length), sub: pendingPayouts.length > 0 ? inr(pendingPayout) : "Nothing pending", accent: pendingPayouts.length > 0 },
          { label: "Payouts released",    value: String(paidPayouts.length),   sub: "total paid" },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className={`rounded-xl border bg-white p-4 ${accent ? "border-amber-300 bg-amber-50" : "border-[#d8decf]"}`}>
            <p className="text-xs text-[#60735d]">{label}</p>
            <p className="mt-1.5 text-xl font-bold text-[#172018]">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-[#9aad9c]">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Pending settlement — actionable */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Approved — awaiting settlement</h3>
            <p className="mt-0.5 text-xs text-[#9aad9c]">Post settlement to record Dr/Cr entries in the ledger</p>
          </div>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-[#60735d]">Loading…</p>
        ) : pendingLots.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#9aad9c]">No approved lots pending settlement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {["Lot / Date", "Model", "Material", "Supplier", "Net (MT)", "Gross Value", "Margin", "Sup. Payable", "Action"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingLots.map((lot) => {
                  const margin    = lot.akshayaMarginPerMT * lot.netWeight;
                  const payable   = lot.grossSaleValue - margin - (lot.holdPenalty ?? 0);
                  const isLoading = settling === lot.id;
                  const err       = settleError[lot.id];
                  return (
                    <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold">{lot.documentRef}</p>
                        <p className="text-[10px] text-[#9aad9c]">{lot.lotDate}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${lot.businessModel === "A" ? "bg-[#172018] text-white" : "bg-[#405b3d] text-white"}`}>
                          {lot.businessModel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#536251]">{lot.materialName}</td>
                      <td className="px-4 py-3 text-xs">{lot.supplierName ?? lot.farmerName ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{lot.netWeight.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#15803d]">{inr(lot.grossSaleValue)}</td>
                      <td className="px-4 py-3 text-right text-[#536251]">{inr(margin)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#1d4ed8]">{inr(payable)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => postSettle(lot.id)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 rounded-md bg-[#172018] px-3 py-1.5 text-xs font-semibold text-[#d8ff72] hover:bg-[#2a3b29] disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />{isLoading ? "Posting…" : "Post Settlement"}
                          </button>
                          {err && <p className="text-[10px] text-red-600">{err}</p>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settled lots — recent history */}
      {settledLots.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h3 className="text-lg font-semibold">Settled lots</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {["Lot / Date", "Material", "Supplier", "Net (MT)", "Gross", "Margin", "Net Payout", "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settledLots.map((lot) => {
                  const margin  = lot.akshayaMarginPerMT * lot.netWeight;
                  const payout  = lot.grossSaleValue - margin - (lot.holdPenalty ?? 0);
                  return (
                    <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold">{lot.documentRef}</p>
                        <p className="text-[10px] text-[#9aad9c]">{lot.lotDate}</p>
                      </td>
                      <td className="px-4 py-3 text-[#536251]">{lot.materialName}</td>
                      <td className="px-4 py-3 text-xs">{lot.supplierName ?? lot.farmerName ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{lot.netWeight.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#15803d]">{inr(lot.grossSaleValue)}</td>
                      <td className="px-4 py-3 text-right text-[#536251]">{inr(margin)}</td>
                      <td className="px-4 py-3 text-right font-bold">{inr(payout)}</td>
                      <td className="px-4 py-3"><StatusBadge status={lot.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Farmer payout register */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Farmer payout register</h3>
            <p className="mt-0.5 text-xs text-[#9aad9c]">Model B farmer payments</p>
          </div>
          <button className="btn btn-ghost flex items-center gap-1.5 text-xs"><Download size={13} />Export</button>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-[#60735d]">Loading…</p>
        ) : payouts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#9aad9c]">No farmer payouts recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {["Farmer","Lot ref","Material","Qty (MT)","Rate","Gross","Deductions","Net payout","Mode","Status","Action"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((fp) => (
                  <tr key={fp.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-4 py-3 font-semibold">{fp.farmerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#536251]">{fp.documentRef}</td>
                    <td className="px-4 py-3 text-[#536251]">{fp.materialName}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">{fp.quantity.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right text-[#536251]">₹{fp.rate.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right">{inr(fp.grossAmount)}</td>
                    <td className="px-4 py-3 text-right text-[#dc2626]">{fp.deductions > 0 ? `−${inr(fp.deductions)}` : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{inr(fp.netAmount)}</td>
                    <td className="px-4 py-3 text-[#536251]">{fp.paymentMode || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={fp.paymentStatus} /></td>
                    <td className="px-4 py-3">
                      {fp.paymentStatus === "Pending" ? (
                        <button title="Approve payout" onClick={() => approvePayout(fp.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700">
                          <CheckCircle2 size={13} />
                        </button>
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f0fdf4]">
                          <CheckCircle2 size={13} className="text-[#15803d]" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProcurementPage() {
  const [tab, setTab] = useState<Tab>("Model A");

  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${tab === t ? "bg-foreground text-white shadow-sm" : "border border-(--border) bg-(--card) text-(--ink-2) hover:bg-(--muted)"}`}>
            {(() => { const I = PROC_TAB_ICONS[t]; return <I size={14} />; })()} {t}
          </button>
        ))}
      </div>
      {tab === "Model A" && <ModelATab />}
      {tab === "Model B" && <ModelBTab />}
      {tab === "Weighment" && <WeighmentTab />}
      {tab === "Settlements" && <SettlementsTab />}
    </div>
  );
}
