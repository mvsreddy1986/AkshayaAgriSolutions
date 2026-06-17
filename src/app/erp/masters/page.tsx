"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Material, Party, QualityRule, RateMaster,
  MaterialParam, ParameterRule, DeductionMethod, SettlementRole,
} from "../../../lib/types";

const TABS = ["Materials", "Parties", "Quality Rules", "Rates"] as const;
type Tab = (typeof TABS)[number];

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-[#f0fdf4] text-[#15803d]",
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Inactive: "bg-[#fef2f2] text-[#b91c1c]",
    Expired: "bg-[#fef9c3] text-[#a16207]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function Badge({ label, color = "default" }: { label: string; color?: "green" | "blue" | "amber" | "red" | "purple" | "default" }) {
  const cls = {
    green:   "bg-[#f0fdf4] text-[#15803d]",
    blue:    "bg-[#eff6ff] text-[#1d4ed8]",
    amber:   "bg-[#fffbeb] text-[#92400e]",
    red:     "bg-[#fef2f2] text-[#b91c1c]",
    purple:  "bg-[#fdf4ff] text-[#9333ea]",
    default: "bg-[#f3f6ef] text-[#60735d]",
  }[color];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}

function roleColor(role: SettlementRole): "green" | "blue" | "red" | "default" {
  return role === "deduction" ? "green" : role === "rate-slab" ? "blue" : role === "reject-trigger" ? "red" : "default";
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr>{headers.map((h) => <th key={h} className="px-5 py-3.5 whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center py-12 text-[#60735d] text-sm">Loading…</div>;
}

function FieldLabel({ children, span }: { children: React.ReactNode; span?: string }) {
  return <label className={`grid gap-1.5 text-sm font-bold ${span ?? ""}`}>{children}</label>;
}

const inputCls = "rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018] w-full";
const selectCls = inputCls;

// ── Slab row editor (shared) ──────────────────────────────────────────────────

interface SlabRow { from: string; to: string; rate: string; }

function SlabEditor({ slabs, onChange, rateLabel }: {
  slabs: SlabRow[];
  onChange: (s: SlabRow[]) => void;
  rateLabel: string;
}) {
  function set(i: number, field: keyof SlabRow, val: string) {
    const next = slabs.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    onChange(next);
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-bold text-[#60735d]">
        <span>From</span><span>To</span><span>{rateLabel}</span><span />
      </div>
      {slabs.map((s, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
          <input className="rounded border border-[#c8d4c0] px-2 py-1.5 text-sm outline-none focus:border-[#172018]" type="number" value={s.from} placeholder="0" onChange={e => set(i, "from", e.target.value)} />
          <input className="rounded border border-[#c8d4c0] px-2 py-1.5 text-sm outline-none focus:border-[#172018]" type="number" value={s.to} placeholder="999" onChange={e => set(i, "to", e.target.value)} />
          <input className="rounded border border-[#c8d4c0] px-2 py-1.5 text-sm outline-none focus:border-[#172018]" type="number" step="0.01" value={s.rate} placeholder="0" onChange={e => set(i, "rate", e.target.value)} />
          <button type="button" onClick={() => onChange(slabs.filter((_, idx) => idx !== i))} className="text-[#b91c1c] text-sm font-black">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...slabs, { from: "", to: "", rate: "" }])} className="text-xs font-black text-[#172018] hover:underline">+ Add row</button>
    </div>
  );
}

function toSlabs(rows: SlabRow[]) {
  return rows.filter(s => s.from !== "" && s.to !== "" && s.rate !== "")
    .map(s => ({ from: Number(s.from), to: Number(s.to), rate: Number(s.rate) }));
}

// ── MATERIALS TAB ─────────────────────────────────────────────────────────────

const EMPTY_PARAM: MaterialParam = {
  paramKey: "", label: "", type: "quantitative", uom: "%",
  settlementRole: "deduction", required: true, sortOrder: 0,
};

function MaterialsTab() {
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editRow, setEditRow] = useState<Material | null>(null);
  const [editParams, setEditParams] = useState<MaterialParam[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/materials").then(r => r.json())
      .then(data => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditRow(null);
    setEditParams([]);
    setShowForm(true);
  }

  function openEdit(m: Material) {
    setEditRow(m);
    setEditParams(m.params ?? []);
    setShowForm(true);
  }

  function addParam() {
    setEditParams(prev => [...prev, { ...EMPTY_PARAM, sortOrder: prev.length + 1 }]);
  }

  function updateParam(i: number, field: keyof MaterialParam, val: unknown) {
    setEditParams(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  function removeParam(i: number) {
    setEditParams(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, sortOrder: idx + 1 })));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      hsn: fd.get("hsn"),
      uom: fd.get("uom"),
      gstRate: Number(fd.get("gstRate") ?? 0),
      category: fd.get("category"),
      defaultGrossSaleRate: Number(fd.get("defaultGrossSaleRate") ?? 0),
      pricingModel: fd.get("pricingModel") ?? "deduction",
      params: editParams.map((p, i) => ({ ...p, sortOrder: i + 1 })),
      status: editRow?.status ?? "Draft",
    };
    const url = editRow ? `/api/materials/${editRow.id}` : "/api/materials";
    await fetch(url, { method: editRow ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setShowForm(false);
    setEditRow(null);
    setEditParams([]);
    load();
  }

  async function handleToggle(m: Material) {
    await fetch(`/api/materials/${m.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: m.status === "Active" ? "Inactive" : "Active" }),
    });
    load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Material master</h3>
        {!showForm && <button onClick={openNew} className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">+ Add material</button>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6 space-y-6">
          <p className="text-lg font-black">{editRow ? "Edit material" : "New material"}</p>

          {/* Basic fields */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FieldLabel><span>Material name *</span><input name="name" type="text" required defaultValue={editRow?.name ?? ""} placeholder="e.g. Maize" className={inputCls} /></FieldLabel>
            <FieldLabel><span>HSN code *</span><input name="hsn" type="text" required defaultValue={editRow?.hsn ?? ""} placeholder="e.g. 1005" className={inputCls} /></FieldLabel>
            <FieldLabel><span>GST rate (%)</span><input name="gstRate" type="number" defaultValue={editRow?.gstRate ?? 0} className={inputCls} /></FieldLabel>
            <FieldLabel><span>Default gross sale rate (₹/UOM)</span><input name="defaultGrossSaleRate" type="number" defaultValue={editRow?.defaultGrossSaleRate ?? 0} className={inputCls} /></FieldLabel>
            <FieldLabel>
              <span>Unit of measure</span>
              <select name="uom" defaultValue={editRow?.uom ?? "MT"} className={selectCls}>
                {["MT", "KG", "L", "Bag"].map(u => <option key={u}>{u}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel>
              <span>Category</span>
              <select name="category" defaultValue={editRow?.category ?? "Grain"} className={selectCls}>
                {["Grain", "Biomass", "Chemical", "Byproduct", "Fuel"].map(c => <option key={c}>{c}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel>
              <span>Pricing model</span>
              <select name="pricingModel" defaultValue={editRow?.pricingModel ?? "deduction"} className={selectCls}>
                <option value="deduction">Deduction — rate agreed upfront, quality deducts</option>
                <option value="rate-slab">Rate-slab — quality reading determines the rate</option>
              </select>
            </FieldLabel>
          </div>

          {/* Quality parameters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black">Quality parameters</p>
                <p className="text-xs text-[#60735d]">Define every measurable parameter for this material. These drive the quality rule form.</p>
              </div>
              <button type="button" onClick={addParam} className="rounded-md border border-[#172018] px-3 py-1.5 text-xs font-black hover:bg-[#172018] hover:text-white">+ Add param</button>
            </div>

            {editParams.length === 0 && (
              <p className="text-xs text-[#60735d] italic py-2">No parameters defined yet. Click "+ Add param" to add quality parameters for this material.</p>
            )}

            {editParams.length > 0 && (
              <div className="rounded-xl border border-[#d8decf] overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_90px_80px_130px_70px_36px] gap-0 bg-[#f3f6ef] text-xs font-black uppercase tracking-wide text-[#60735d] px-4 py-2.5">
                  <span>Param key</span><span>Label</span><span>Type</span><span>UOM</span><span>Settlement role</span><span>Required</span><span />
                </div>
                {editParams.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_90px_80px_130px_70px_36px] gap-2 items-center px-4 py-2.5 border-t border-[#edf0e8]">
                    <input
                      value={p.paramKey} placeholder="moisture_pct"
                      onChange={e => updateParam(i, "paramKey", e.target.value)}
                      className="rounded border border-[#c8d4c0] px-2 py-1.5 text-xs font-mono outline-none focus:border-[#172018]"
                    />
                    <input
                      value={p.label} placeholder="Moisture %"
                      onChange={e => updateParam(i, "label", e.target.value)}
                      className="rounded border border-[#c8d4c0] px-2 py-1.5 text-xs outline-none focus:border-[#172018]"
                    />
                    <select value={p.type} onChange={e => updateParam(i, "type", e.target.value)} className="rounded border border-[#c8d4c0] px-1.5 py-1.5 text-xs outline-none focus:border-[#172018]">
                      <option value="quantitative">Numeric</option>
                      <option value="qualitative">Category</option>
                    </select>
                    <input
                      value={p.uom} placeholder="%"
                      onChange={e => updateParam(i, "uom", e.target.value)}
                      className="rounded border border-[#c8d4c0] px-2 py-1.5 text-xs outline-none focus:border-[#172018]"
                    />
                    <select value={p.settlementRole} onChange={e => updateParam(i, "settlementRole", e.target.value as SettlementRole)} className="rounded border border-[#c8d4c0] px-1.5 py-1.5 text-xs outline-none focus:border-[#172018]">
                      <option value="deduction">Deduction</option>
                      <option value="rate-slab">Rate slab</option>
                      <option value="reject-trigger">Reject trigger</option>
                      <option value="info-only">Info only</option>
                    </select>
                    <div className="flex justify-center">
                      <input type="checkbox" checked={p.required} onChange={e => updateParam(i, "required", e.target.checked)} className="h-4 w-4" />
                    </div>
                    <button type="button" onClick={() => removeParam(i)} className="text-[#b91c1c] font-black text-sm hover:text-red-700">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? "Saving…" : editRow ? "Update" : "Save Draft"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditRow(null); setEditParams([]); }} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Spinner /> : (
        <Table headers={["Material", "HSN", "UOM", "GST %", "Default rate", "Pricing model", "Parameters", "Status", "Action"]}>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-5 py-3.5 font-black">{m.name}</td>
              <td className="px-5 py-3.5 text-[#536251]">{m.hsn}</td>
              <td className="px-5 py-3.5 text-[#536251]">{m.uom}</td>
              <td className="px-5 py-3.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.gstRate === 0 ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fff7ed] text-[#c2410c]"}`}>{m.gstRate}%</span>
              </td>
              <td className="px-5 py-3.5 font-bold">₹{m.defaultGrossSaleRate.toLocaleString("en-IN")}</td>
              <td className="px-5 py-3.5">
                <Badge label={m.pricingModel === "rate-slab" ? "Rate-slab" : "Deduction"} color={m.pricingModel === "rate-slab" ? "blue" : "green"} />
              </td>
              <td className="px-5 py-3.5">
                <div className="flex flex-wrap gap-1">
                  {(m.params ?? []).slice(0, 2).map(p => (
                    <Badge key={p.paramKey} label={p.label} color={roleColor(p.settlementRole)} />
                  ))}
                  {(m.params ?? []).length > 2 && <Badge label={`+${m.params.length - 2}`} />}
                </div>
              </td>
              <td className="px-5 py-3.5"><StatusBadge status={m.status} /></td>
              <td className="px-5 py-3.5">
                <div className="flex gap-2">
                  <button onClick={() => openEdit(m)} className="text-xs font-black text-[#172018] hover:underline">Edit</button>
                  <button onClick={() => handleToggle(m)} className="text-xs font-black text-[#60735d] hover:underline">Toggle</button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ── PARTIES TAB (unchanged) ───────────────────────────────────────────────────

function PartiesTab() {
  const [rows, setRows] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editRow, setEditRow] = useState<Party | null>(null);

  const typeColors: Record<string, string> = {
    Customer: "bg-[#eff6ff] text-[#1d4ed8]", Supplier: "bg-[#f0fdf4] text-[#15803d]",
    Farmer: "bg-[#fdf4ff] text-[#9333ea]", Trader: "bg-[#fff7ed] text-[#c2410c]",
    Both: "bg-[#172018] text-white",
  };

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/parties").then(r => r.json())
      .then(data => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"), partyType: fd.get("partyType"), gstin: fd.get("gstin"),
      mobile: fd.get("mobile"), email: fd.get("email"), address: fd.get("address"),
      state: "Andhra Pradesh", creditLimit: Number(fd.get("creditLimit") ?? 0),
      creditDays: Number(fd.get("creditDays") ?? 0),
      businessFlows: String(fd.get("businessFlows") ?? "").split(",").map(s => s.trim()).filter(Boolean),
      taxProfile: fd.get("taxProfile") ?? "Registered",
      bankAccount: fd.get("bankAccount"), ifsc: fd.get("ifsc"), bankName: fd.get("bankName"),
      isFarmerReference: fd.get("partyType") === "Farmer", status: "Active",
    };
    const url = editRow ? `/api/parties/${editRow.id}` : "/api/parties";
    await fetch(url, { method: editRow ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false); setShowForm(false); setEditRow(null); load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Party master</h3>
        {!showForm && <button onClick={() => { setEditRow(null); setShowForm(true); }} className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">+ Add party</button>}
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">{editRow ? "Edit party" : "New party"}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FieldLabel><span>Party name *</span><input name="name" type="text" required defaultValue={editRow?.name ?? ""} placeholder="Sarvani Biofuels Pvt Ltd" className={inputCls} /></FieldLabel>
            <FieldLabel><span>Party type</span><select name="partyType" defaultValue={editRow?.partyType ?? "Supplier"} className={selectCls}>{["Customer", "Supplier", "Farmer", "Trader", "Both"].map(t => <option key={t}>{t}</option>)}</select></FieldLabel>
            <FieldLabel><span>GSTIN</span><input name="gstin" type="text" defaultValue={editRow?.gstin ?? ""} placeholder="37AAGCS8432B1ZK" className={inputCls} /></FieldLabel>
            <FieldLabel><span>Mobile</span><input name="mobile" type="tel" defaultValue={editRow?.mobile ?? ""} placeholder="9848012345" className={inputCls} /></FieldLabel>
            <FieldLabel><span>Email</span><input name="email" type="email" defaultValue={editRow?.email ?? ""} placeholder="accounts@party.in" className={inputCls} /></FieldLabel>
            <FieldLabel><span>Tax profile</span><select name="taxProfile" defaultValue={editRow?.taxProfile ?? "Registered"} className={selectCls}>{["Registered", "Unregistered", "Composition"].map(t => <option key={t}>{t}</option>)}</select></FieldLabel>
            <FieldLabel><span>Credit limit (₹)</span><input name="creditLimit" type="number" defaultValue={editRow?.creditLimit ?? 0} className={inputCls} /></FieldLabel>
            <FieldLabel><span>Credit days</span><input name="creditDays" type="number" defaultValue={editRow?.creditDays ?? 0} className={inputCls} /></FieldLabel>
            <FieldLabel><span>Business models (A, B, C)</span><input name="businessFlows" type="text" defaultValue={editRow?.businessFlows.join(", ") ?? ""} placeholder="A, B, C" className={inputCls} /></FieldLabel>
            <FieldLabel><span>Bank account no</span><input name="bankAccount" type="text" defaultValue={editRow?.bankAccount ?? ""} className={inputCls} /></FieldLabel>
            <FieldLabel><span>IFSC code</span><input name="ifsc" type="text" defaultValue={editRow?.ifsc ?? ""} className={inputCls} /></FieldLabel>
            <FieldLabel><span>Bank name</span><input name="bankName" type="text" defaultValue={editRow?.bankName ?? ""} className={inputCls} /></FieldLabel>
            <FieldLabel span="sm:col-span-2 xl:col-span-3"><span>Address</span><textarea name="address" defaultValue={editRow?.address ?? ""} className={inputCls} rows={2} placeholder="Full address including district, state, PIN" /></FieldLabel>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save Party"}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditRow(null); }} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}
      {loading ? <Spinner /> : (
        <Table headers={["Party name", "Type", "GSTIN", "Mobile", "Credit limit", "Credit days", "Models", "Status", "Action"]}>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-5 py-3.5 font-black max-w-[180px]">{p.name}</td>
              <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${typeColors[p.partyType] ?? "bg-gray-100 text-gray-700"}`}>{p.partyType}</span></td>
              <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{p.gstin || "—"}</td>
              <td className="px-5 py-3.5 text-[#536251]">{p.mobile || "—"}</td>
              <td className="px-5 py-3.5 font-bold">{p.creditLimit > 0 ? `₹${(p.creditLimit / 100000).toFixed(1)}L` : "—"}</td>
              <td className="px-5 py-3.5 text-[#536251]">{p.creditDays > 0 ? `${p.creditDays}d` : "—"}</td>
              <td className="px-5 py-3.5"><div className="flex gap-1">{p.businessFlows.map(f => <span key={f} className="rounded-md bg-[#172018] px-1.5 py-0.5 text-[10px] font-black text-white">{f}</span>)}</div></td>
              <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
              <td className="px-5 py-3.5"><button onClick={() => { setEditRow(p); setShowForm(true); }} className="text-xs font-black text-[#172018] hover:underline">Edit</button></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ── QUALITY RULES TAB ─────────────────────────────────────────────────────────

interface ParamRuleState {
  paramKey: string;
  label: string;
  settlementRole: SettlementRole;
  enabled: boolean;
  deductionMethod: DeductionMethod;
  baseValue: string;
  linearRate: string;
  rejectThreshold: string;
  slabs: SlabRow[];
}

function buildParamRules(states: ParamRuleState[]): ParameterRule[] {
  return states.filter(s => s.enabled).map(s => {
    const rule: ParameterRule = { paramKey: s.paramKey, label: s.label };
    if (s.rejectThreshold) rule.rejectThreshold = Number(s.rejectThreshold);

    if (s.settlementRole === "rate-slab") {
      rule.rateSlabs = toSlabs(s.slabs);
      rule.deductionMethod = "none";
    } else if (s.settlementRole === "deduction") {
      rule.deductionMethod = s.deductionMethod;
      if (s.deductionMethod === "linear") {
        rule.baseValue = s.baseValue ? Number(s.baseValue) : 0;
        rule.linearRate = s.linearRate ? Number(s.linearRate) : 0;
      } else if (s.deductionMethod === "slab") {
        rule.baseValue = s.baseValue ? Number(s.baseValue) : 0;
        rule.deductionSlabs = toSlabs(s.slabs);
      } else if (s.deductionMethod === "actual-weight") {
        rule.baseValue = 0;
      }
    } else {
      rule.deductionMethod = "none";
    }

    return rule;
  });
}

function paramToRuleState(p: MaterialParam): ParamRuleState {
  return {
    paramKey: p.paramKey, label: p.label, settlementRole: p.settlementRole,
    enabled: p.settlementRole !== "info-only",
    deductionMethod: p.settlementRole === "deduction" ? "linear" : "none",
    baseValue: "", linearRate: "", rejectThreshold: "", slabs: [],
  };
}

function QualityRulesTab() {
  const [rows, setRows] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMat, setSelectedMat] = useState<Material | null>(null);
  const [paramStates, setParamStates] = useState<ParamRuleState[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/quality-rules").then(r => r.json()),
      fetch("/api/materials").then(r => r.json()),
    ]).then(([qrs, mats]) => {
      setRows(Array.isArray(qrs) ? qrs : []);
      setMaterials(Array.isArray(mats) ? mats : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleMaterialChange(id: string) {
    const mat = materials.find(m => m.id === id) ?? null;
    setSelectedMat(mat);
    setParamStates(mat ? mat.params.map(paramToRuleState) : []);
  }

  function updateParamState(i: number, field: keyof ParamRuleState, val: unknown) {
    setParamStates(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  function updateParamSlabs(i: number, slabs: SlabRow[]) {
    setParamStates(prev => prev.map((s, idx) => idx === i ? { ...s, slabs } : s));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedMat) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      materialId: selectedMat.id,
      materialName: selectedMat.name,
      pricingModel: fd.get("pricingModel") ?? selectedMat.pricingModel,
      validFrom: fd.get("validFrom"),
      validTo: fd.get("validTo") || null,
      globalCessRate: Number(fd.get("globalCessRate") ?? 0),
      allowedVariancePct: Number(fd.get("allowedVariancePct") ?? 2),
      description: fd.get("description"),
      status: "Draft",
      paramRules: buildParamRules(paramStates),
    };
    await fetch("/api/quality-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setShowForm(false);
    setSelectedMat(null);
    setParamStates([]);
    load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Quality rules (date-valid)</h3>
        {!showForm && <button onClick={() => setShowForm(true)} className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">+ New rule</button>}
      </div>

      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
        <strong>Important:</strong> Quality rules are versioned by effective date. Never edit a posted rule — create a new one. Old transactions always re-use the rule active on their transaction date.
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6 space-y-6">
          <p className="text-lg font-black">New quality rule</p>

          {/* Step 1: Material + global settings */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FieldLabel>
              <span>Material *</span>
              <select required className={selectCls} onChange={e => handleMaterialChange(e.target.value)} defaultValue="">
                <option value="" disabled>Select material…</option>
                {materials.filter(m => m.status === "Active").map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel>
              <span>Pricing model</span>
              <select name="pricingModel" className={selectCls} defaultValue={selectedMat?.pricingModel ?? "deduction"} key={selectedMat?.id}>
                <option value="deduction">Deduction — rate agreed, quality deducts</option>
                <option value="rate-slab">Rate-slab — quality reading sets the rate</option>
              </select>
            </FieldLabel>
            <FieldLabel><span>Valid from *</span><input name="validFrom" type="date" required className={inputCls} /></FieldLabel>
            <FieldLabel><span>Valid to (blank = ongoing)</span><input name="validTo" type="date" className={inputCls} /></FieldLabel>
            <FieldLabel><span>Cess rate (% on net wt × rate)</span><input name="globalCessRate" type="number" step="0.01" defaultValue={0} className={inputCls} placeholder="e.g. 0.5" /></FieldLabel>
            <FieldLabel><span>Allowed variance before hold (%)</span><input name="allowedVariancePct" type="number" step="0.1" defaultValue={2} className={inputCls} /></FieldLabel>
            <FieldLabel span="sm:col-span-2 xl:col-span-3"><span>Description / notes</span><textarea name="description" className={inputCls} rows={2} placeholder="Explain the rule context for audit reference" /></FieldLabel>
          </div>

          {/* Step 2: Per-param rule configuration */}
          {paramStates.length > 0 && (
            <div>
              <p className="text-sm font-black mb-1">Parameter rules</p>
              <p className="text-xs text-[#60735d] mb-4">Configure the settlement calculation for each quality parameter of {selectedMat?.name}.</p>
              <div className="space-y-3">
                {paramStates.map((ps, i) => (
                  <div key={ps.paramKey} className={`rounded-xl border px-5 py-4 space-y-4 ${ps.enabled ? "border-[#d8decf]" : "border-[#edf0e8] bg-[#fafcf8] opacity-60"}`}>
                    {/* Param header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={ps.enabled} onChange={e => updateParamState(i, "enabled", e.target.checked)} className="h-4 w-4" />
                        <span className="text-sm font-black">{ps.label}</span>
                        <code className="text-xs text-[#60735d] bg-[#f3f6ef] px-2 py-0.5 rounded">{ps.paramKey}</code>
                        <Badge label={ps.settlementRole} color={roleColor(ps.settlementRole)} />
                      </div>
                    </div>

                    {ps.enabled && (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {/* Reject threshold (available for all roles) */}
                        <FieldLabel>
                          <span>Reject threshold (auto-hold if exceeded)</span>
                          <input type="number" step="0.01" value={ps.rejectThreshold} onChange={e => updateParamState(i, "rejectThreshold", e.target.value)} placeholder="Leave blank if no threshold" className={inputCls} />
                        </FieldLabel>

                        {/* Deduction role config */}
                        {ps.settlementRole === "deduction" && (
                          <>
                            <FieldLabel>
                              <span>Deduction method</span>
                              <select value={ps.deductionMethod} onChange={e => updateParamState(i, "deductionMethod", e.target.value as DeductionMethod)} className={selectCls}>
                                <option value="linear">Linear (₹/MT per % excess above base)</option>
                                <option value="slab">Slab (tiered ₹/MT/% based on excess range)</option>
                                <option value="actual-weight">Actual weight (full % of netWeight deducted)</option>
                                <option value="none">None (info only)</option>
                              </select>
                            </FieldLabel>

                            {(ps.deductionMethod === "linear" || ps.deductionMethod === "slab") && (
                              <FieldLabel>
                                <span>Base value (tolerance — deduct only above this)</span>
                                <input type="number" step="0.1" value={ps.baseValue} onChange={e => updateParamState(i, "baseValue", e.target.value)} placeholder="e.g. 14 for base moisture 14%" className={inputCls} />
                              </FieldLabel>
                            )}

                            {ps.deductionMethod === "linear" && (
                              <FieldLabel>
                                <span>Linear rate (₹/MT per 1% excess)</span>
                                <input type="number" step="0.01" value={ps.linearRate} onChange={e => updateParamState(i, "linearRate", e.target.value)} placeholder="e.g. 0.71" className={inputCls} />
                              </FieldLabel>
                            )}

                            {ps.deductionMethod === "actual-weight" && (
                              <div className="flex items-center rounded-lg bg-[#f3f6ef] px-4 py-3 text-xs text-[#60735d]">
                                Full {ps.paramKey}% of net weight is deducted as foreign matter weight. No extra config needed.
                              </div>
                            )}

                            {ps.deductionMethod === "slab" && (
                              <div className="sm:col-span-2 xl:col-span-3">
                                <p className="text-xs font-bold mb-2">Deduction slabs (excess ranges → ₹/MT/% rate)</p>
                                <SlabEditor slabs={ps.slabs} onChange={slabs => updateParamSlabs(i, slabs)} rateLabel="₹/MT/% rate" />
                              </div>
                            )}
                          </>
                        )}

                        {/* Rate-slab role config */}
                        {ps.settlementRole === "rate-slab" && (
                          <div className="sm:col-span-2 xl:col-span-3">
                            <p className="text-xs font-bold mb-2">Rate slabs — reading value → ₹/MT price band</p>
                            <SlabEditor slabs={ps.slabs} onChange={slabs => updateParamSlabs(i, slabs)} rateLabel="₹/MT price" />
                          </div>
                        )}

                        {ps.settlementRole === "reject-trigger" && (
                          <div className="flex items-center rounded-lg bg-[#fef2f2] px-4 py-3 text-xs text-[#b91c1c]">
                            This parameter will automatically trigger a QualityHold when the reading exceeds the threshold above.
                          </div>
                        )}

                        {ps.settlementRole === "info-only" && (
                          <div className="flex items-center rounded-lg bg-[#f3f6ef] px-4 py-3 text-xs text-[#60735d]">
                            Info-only — recorded for audit, no financial effect.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!selectedMat && (
            <div className="rounded-xl border border-[#d8decf] bg-[#fafcf8] px-5 py-8 text-center text-sm text-[#60735d]">
              Select a material above to configure parameter rules.
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving || !selectedMat} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save for Approval"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setSelectedMat(null); setParamStates([]); }} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Spinner /> : (
        <Table headers={["Material", "Model", "Valid from", "Valid to", "Cess", "Param rules", "Status", "Action"]}>
          {rows.map((r) => (
            <>
              <tr key={r.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                <td className="px-5 py-3.5 font-black">{r.materialName}</td>
                <td className="px-5 py-3.5"><Badge label={r.pricingModel === "rate-slab" ? "Rate-slab" : "Deduction"} color={r.pricingModel === "rate-slab" ? "blue" : "green"} /></td>
                <td className="px-5 py-3.5 text-[#536251]">{r.validFrom}</td>
                <td className="px-5 py-3.5 text-[#536251]">{r.validTo ?? "Ongoing"}</td>
                <td className="px-5 py-3.5">{r.globalCessRate}%</td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {(r.paramRules ?? []).slice(0, 3).map(pr => (
                      <code key={pr.paramKey} className="text-[10px] bg-[#f3f6ef] text-[#536251] px-1.5 py-0.5 rounded">{pr.paramKey}</code>
                    ))}
                    {(r.paramRules ?? []).length > 3 && <span className="text-xs text-[#60735d]">+{r.paramRules.length - 3}</span>}
                  </div>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="text-xs font-black text-[#60735d] hover:underline">
                      {expandedId === r.id ? "Hide" : "Details"}
                    </button>
                    <button onClick={async () => {
                      const next = r.status === "Draft" ? "Active" : r.status === "Active" ? "Expired" : "Draft";
                      await fetch(`/api/quality-rules/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
                      load();
                    }} className="text-xs font-black text-[#172018] hover:underline">
                      {r.status === "Draft" ? "Approve" : r.status === "Active" ? "Expire" : "Reopen"}
                    </button>
                  </div>
                </td>
              </tr>
              {expandedId === r.id && (
                <tr key={`${r.id}-detail`} className="bg-[#f8faf5]">
                  <td colSpan={8} className="px-5 py-4">
                    <div className="space-y-2">
                      <p className="text-xs font-black text-[#60735d] uppercase tracking-wider">Parameter rules for {r.materialName}</p>
                      {(r.paramRules ?? []).map(pr => (
                        <div key={pr.paramKey} className="flex items-start gap-4 rounded-lg border border-[#d8decf] bg-white px-4 py-2.5">
                          <code className="text-xs font-mono text-[#172018] bg-[#f3f6ef] px-2 py-1 rounded min-w-[140px]">{pr.paramKey}</code>
                          <div className="text-xs text-[#536251] space-y-0.5">
                            {pr.deductionMethod && pr.deductionMethod !== "none" && <p>Method: <strong>{pr.deductionMethod}</strong></p>}
                            {pr.baseValue !== undefined && <p>Base: {pr.baseValue}</p>}
                            {pr.linearRate !== undefined && <p>Rate: ₹{pr.linearRate}/MT/unit</p>}
                            {pr.rejectThreshold !== undefined && <p className="text-[#b91c1c]">Reject if &gt; {pr.rejectThreshold}</p>}
                            {pr.rateSlabs && pr.rateSlabs.length > 0 && (
                              <p>Rate slabs: {pr.rateSlabs.map(s => `${s.from}–${s.to} → ₹${s.rate}`).join(" · ")}</p>
                            )}
                            {pr.deductionSlabs && pr.deductionSlabs.length > 0 && (
                              <p>Deduction slabs: {pr.deductionSlabs.map(s => `${s.from}–${s.to} → ₹${s.rate}/MT/%`).join(" · ")}</p>
                            )}
                            {(!pr.deductionMethod || pr.deductionMethod === "none") && !pr.rateSlabs && !pr.rejectThreshold && (
                              <p>Info only</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {(r.paramRules ?? []).length === 0 && <p className="text-xs text-[#60735d]">No param rules configured.</p>}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </Table>
      )}
    </div>
  );
}

// ── RATES TAB ─────────────────────────────────────────────────────────────────

function RatesTab() {
  const [rows, setRows] = useState<RateMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  const typeColors: Record<string, string> = {
    GrossSale: "bg-[#f0fdf4] text-[#15803d]",
    Purchase: "bg-[#eff6ff] text-[#1d4ed8]",
    Retail: "bg-[#fff7ed] text-[#c2410c]",
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/rates").then(r => r.json()),
      fetch("/api/materials").then(r => r.json()),
      fetch("/api/parties").then(r => r.json()),
    ]).then(([rates, mats, pts]) => {
      setRows(Array.isArray(rates) ? rates : []);
      setMaterials(Array.isArray(mats) ? mats : []);
      setParties(Array.isArray(pts) ? pts : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const materialId = String(fd.get("materialId") ?? "");
    const partyId = String(fd.get("partyId") ?? "") || null;
    const mat = materials.find(m => m.id === materialId);
    const party = parties.find(p => p.id === partyId);
    const body = {
      materialId, materialName: mat?.name ?? materialId,
      partyId, partyName: party?.name ?? null,
      rateType: fd.get("rateType") ?? "GrossSale",
      rate: Number(fd.get("rate") ?? 0),
      validFrom: fd.get("validFrom"), validTo: fd.get("validTo") || null,
    };
    await fetch("/api/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false); setShowForm(false); load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Rate masters</h3>
        {!showForm && <button onClick={() => setShowForm(true)} className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">+ Add rate</button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Gross sale rates", count: rows.filter(r => r.rateType === "GrossSale").length, tone: "text-[#15803d]" },
          { label: "Purchase rates", count: rows.filter(r => r.rateType === "Purchase").length, tone: "text-[#1d4ed8]" },
          { label: "Retail rates", count: rows.filter(r => r.rateType === "Retail").length, tone: "text-[#c2410c]" },
          { label: "Total rate records", count: rows.length, tone: "text-[#172018]" },
        ].map(({ label, count, tone }) => (
          <div key={label} className="rounded-xl border border-[#d8decf] bg-white p-5">
            <p className="text-sm text-[#60735d]">{label}</p>
            <p className={`mt-2 text-3xl font-black ${tone}`}>{count}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">New rate</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FieldLabel>
              <span>Material *</span>
              <select name="materialId" required className={selectCls}>
                <option value="">Select material…</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel>
              <span>Party (blank = default for all)</span>
              <select name="partyId" className={selectCls}>
                <option value="">All parties (default)</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel>
              <span>Rate type</span>
              <select name="rateType" className={selectCls}>
                <option value="GrossSale">Gross Sale</option>
                <option value="Purchase">Purchase</option>
                <option value="Retail">Retail</option>
              </select>
            </FieldLabel>
            <FieldLabel><span>Rate (₹/UOM) *</span><input name="rate" type="number" required placeholder="e.g. 22500" className={inputCls} /></FieldLabel>
            <FieldLabel><span>Valid from *</span><input name="validFrom" type="date" required className={inputCls} /></FieldLabel>
            <FieldLabel><span>Valid to (blank = ongoing)</span><input name="validTo" type="date" className={inputCls} /></FieldLabel>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save Rate"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Spinner /> : (
        <Table headers={["Material", "Party", "Rate type", "Rate (₹/UOM)", "Valid from", "Valid to", "Action"]}>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-5 py-3.5 font-black">{r.materialName}</td>
              <td className="px-5 py-3.5 text-[#536251]">{r.partyName ?? "All parties"}</td>
              <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${typeColors[r.rateType]}`}>{r.rateType}</span></td>
              <td className="px-5 py-3.5 font-black">₹{r.rate.toLocaleString("en-IN")}</td>
              <td className="px-5 py-3.5 text-[#536251]">{r.validFrom}</td>
              <td className="px-5 py-3.5 text-[#536251]">{r.validTo ?? "Ongoing"}</td>
              <td className="px-5 py-3.5">
                <button onClick={async () => {
                  const to = prompt("Set valid-to date (YYYY-MM-DD) or leave blank to clear:", r.validTo ?? "");
                  if (to === null) return;
                  await fetch(`/api/rates/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ validTo: to || null }) });
                  load();
                }} className="text-xs font-black text-[#172018] hover:underline">Edit</button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function MastersPage() {
  const [tab, setTab] = useState<Tab>("Materials");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Materials" && <MaterialsTab />}
      {tab === "Parties" && <PartiesTab />}
      {tab === "Quality Rules" && <QualityRulesTab />}
      {tab === "Rates" && <RatesTab />}
    </div>
  );
}
