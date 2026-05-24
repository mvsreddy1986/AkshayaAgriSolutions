"use client";

import { useState, useEffect, useCallback } from "react";
import type { Material, Party, QualityRule, RateMaster } from "../../../lib/types";

const TABS = ["Materials", "Parties", "Quality Rules", "Rates"] as const;
type Tab = (typeof TABS)[number];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-[#f0fdf4] text-[#15803d]",
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Inactive: "bg-[#fef2f2] text-[#b91c1c]",
    Expired: "bg-[#fef9c3] text-[#a16207]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr>{headers.map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
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

// ─── MATERIALS TAB ────────────────────────────────────────────────────────────

function MaterialsTab() {
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editRow, setEditRow] = useState<Material | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/materials")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      hsn: fd.get("hsn"),
      uom: fd.get("uom"),
      gstRate: fd.get("gstRate"),
      category: fd.get("category"),
      defaultGrossSaleRate: fd.get("defaultGrossSaleRate"),
      settlementMethod: fd.get("settlementMethod"),
      qualityParams: String(fd.get("qualityParams") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      status: editRow?.status ?? "Draft",
    };
    const url = editRow ? `/api/materials/${editRow.id}` : "/api/materials";
    const method = editRow ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setShowForm(false);
    setEditRow(null);
    load();
  }

  async function handleToggle(m: Material) {
    await fetch(`/api/materials/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: m.status === "Active" ? "Inactive" : "Active" }),
    });
    load();
  }

  function openEdit(m: Material) {
    setEditRow(m);
    setShowForm(true);
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Material master</h3>
        {!showForm && (
          <button onClick={() => { setEditRow(null); setShowForm(true); }}
            className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
            + Add material
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">{editRow ? "Edit material" : "New material"}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Material name", name: "name", placeholder: "e.g. Maize", type: "text", required: true, defaultValue: editRow?.name },
              { label: "HSN code", name: "hsn", placeholder: "e.g. 1005", type: "text", required: true, defaultValue: editRow?.hsn },
              { label: "GST rate (%)", name: "gstRate", placeholder: "0 / 5 / 12 / 18", type: "number", required: true, defaultValue: editRow?.gstRate },
              { label: "Default gross sale rate (₹/UOM)", name: "defaultGrossSaleRate", placeholder: "e.g. 22500", type: "number", required: true, defaultValue: editRow?.defaultGrossSaleRate },
            ].map(({ label, name, placeholder, type, required, defaultValue }) => (
              <label key={name} className="grid gap-1.5 text-sm font-bold">
                {label}
                <input name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue ?? ""} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-bold">
              Unit of measure
              <select name="uom" defaultValue={editRow?.uom ?? "MT"} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                {["MT", "KG", "L", "Bag"].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Category
              <select name="category" defaultValue={editRow?.category ?? "Grain"} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                {["Grain", "Biomass", "Chemical", "Byproduct", "Fuel"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Quality parameters (comma-separated)
              <input name="qualityParams" type="text" defaultValue={editRow?.qualityParams.join(", ") ?? ""} placeholder="Moisture %, Foreign matter %, Starch %, Aflatoxin ppm" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Settlement method
              <input name="settlementMethod" type="text" defaultValue={editRow?.settlementMethod ?? ""} placeholder="Quality deduction + cess / Accepted weight / Retail margin…" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? "Saving…" : editRow ? "Update" : "Save Draft"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditRow(null); }} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Spinner /> : (
        <Table headers={["Material", "HSN", "UOM", "GST %", "Default rate", "Settlement", "Quality params", "Status", "Action"]}>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-5 py-3.5 font-black">{m.name}</td>
              <td className="px-5 py-3.5 text-[#536251]">{m.hsn}</td>
              <td className="px-5 py-3.5 text-[#536251]">{m.uom}</td>
              <td className="px-5 py-3.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.gstRate === 0 ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fff7ed] text-[#c2410c]"}`}>{m.gstRate}%</span>
              </td>
              <td className="px-5 py-3.5 font-bold">₹{m.defaultGrossSaleRate.toLocaleString("en-IN")}</td>
              <td className="px-5 py-3.5 text-[#536251] max-w-[180px] truncate">{m.settlementMethod}</td>
              <td className="px-5 py-3.5 text-[#536251]">
                <div className="flex flex-wrap gap-1">
                  {m.qualityParams.slice(0, 2).map((p) => <span key={p} className="rounded-full bg-[#f3f6ef] px-2 py-0.5 text-xs text-[#60735d]">{p}</span>)}
                  {m.qualityParams.length > 2 && <span className="rounded-full bg-[#f3f6ef] px-2 py-0.5 text-xs text-[#60735d]">+{m.qualityParams.length - 2}</span>}
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

// ─── PARTIES TAB ─────────────────────────────────────────────────────────────

function PartiesTab() {
  const [rows, setRows] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editRow, setEditRow] = useState<Party | null>(null);

  const typeColors: Record<string, string> = {
    Customer: "bg-[#eff6ff] text-[#1d4ed8]",
    Supplier: "bg-[#f0fdf4] text-[#15803d]",
    Farmer: "bg-[#fdf4ff] text-[#9333ea]",
    Trader: "bg-[#fff7ed] text-[#c2410c]",
    Both: "bg-[#172018] text-white",
  };

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/parties")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      partyType: fd.get("partyType"),
      gstin: fd.get("gstin"),
      mobile: fd.get("mobile"),
      email: fd.get("email"),
      address: fd.get("address"),
      state: "Andhra Pradesh",
      creditLimit: Number(fd.get("creditLimit") ?? 0),
      creditDays: Number(fd.get("creditDays") ?? 0),
      businessFlows: String(fd.get("businessFlows") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      taxProfile: fd.get("taxProfile") ?? "Registered",
      bankAccount: fd.get("bankAccount"),
      ifsc: fd.get("ifsc"),
      bankName: fd.get("bankName"),
      isFarmerReference: fd.get("partyType") === "Farmer",
      status: "Active",
    };
    const url = editRow ? `/api/parties/${editRow.id}` : "/api/parties";
    const method = editRow ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setShowForm(false);
    setEditRow(null);
    load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Party master</h3>
        {!showForm && (
          <button onClick={() => { setEditRow(null); setShowForm(true); }}
            className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
            + Add party
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">{editRow ? "Edit party" : "New party"}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-bold">
              Party name *
              <input name="name" type="text" required defaultValue={editRow?.name ?? ""} placeholder="Sarvani Biofuels Pvt Ltd" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Party type
              <select name="partyType" defaultValue={editRow?.partyType ?? "Supplier"} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                {["Customer", "Supplier", "Farmer", "Trader", "Both"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              GSTIN
              <input name="gstin" type="text" defaultValue={editRow?.gstin ?? ""} placeholder="37AAGCS8432B1ZK" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Mobile
              <input name="mobile" type="tel" defaultValue={editRow?.mobile ?? ""} placeholder="9848012345" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Email
              <input name="email" type="email" defaultValue={editRow?.email ?? ""} placeholder="accounts@party.in" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Tax profile
              <select name="taxProfile" defaultValue={editRow?.taxProfile ?? "Registered"} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                {["Registered", "Unregistered", "Composition"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Credit limit (₹)
              <input name="creditLimit" type="number" defaultValue={editRow?.creditLimit ?? 0} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Credit days
              <input name="creditDays" type="number" defaultValue={editRow?.creditDays ?? 0} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Business models (A, B, C comma-separated)
              <input name="businessFlows" type="text" defaultValue={editRow?.businessFlows.join(", ") ?? ""} placeholder="A, B, C" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Bank account no
              <input name="bankAccount" type="text" defaultValue={editRow?.bankAccount ?? ""} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              IFSC code
              <input name="ifsc" type="text" defaultValue={editRow?.ifsc ?? ""} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Bank name
              <input name="bankName" type="text" defaultValue={editRow?.bankName ?? ""} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Address
              <textarea name="address" defaultValue={editRow?.address ?? ""} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Full address including district, state, PIN" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save Party"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditRow(null); }} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Spinner /> : (
        <Table headers={["Party name", "Type", "GSTIN", "Mobile", "Credit limit", "Credit days", "Business models", "Status", "Action"]}>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-5 py-3.5 font-black max-w-[180px]">{p.name}</td>
              <td className="px-5 py-3.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${typeColors[p.partyType] ?? "bg-gray-100 text-gray-700"}`}>{p.partyType}</span>
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{p.gstin || "—"}</td>
              <td className="px-5 py-3.5 text-[#536251]">{p.mobile || "—"}</td>
              <td className="px-5 py-3.5 font-bold">{p.creditLimit > 0 ? `₹${(p.creditLimit / 100000).toFixed(1)}L` : "—"}</td>
              <td className="px-5 py-3.5 text-[#536251]">{p.creditDays > 0 ? `${p.creditDays}d` : "—"}</td>
              <td className="px-5 py-3.5">
                <div className="flex gap-1">
                  {p.businessFlows.map((f) => <span key={f} className="rounded-md bg-[#172018] px-1.5 py-0.5 text-[10px] font-black text-white">{f}</span>)}
                </div>
              </td>
              <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
              <td className="px-5 py-3.5">
                <button onClick={() => { setEditRow(p); setShowForm(true); }} className="text-xs font-black text-[#172018] hover:underline">Edit</button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ─── QUALITY RULES TAB ────────────────────────────────────────────────────────

function QualityRulesTab() {
  const [rows, setRows] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/quality-rules").then((r) => r.json()),
      fetch("/api/materials").then((r) => r.json()),
    ]).then(([qrs, mats]) => {
      setRows(Array.isArray(qrs) ? qrs : []);
      setMaterials(Array.isArray(mats) ? mats : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const materialId = String(fd.get("materialId") ?? "");
    const mat = materials.find((m) => m.id === materialId);
    const body = {
      materialId,
      materialName: mat?.name ?? materialId,
      validFrom: fd.get("validFrom"),
      validTo: fd.get("validTo") || null,
      baseMoisture: Number(fd.get("baseMoisture") ?? 14),
      moistureDeductionMethod: fd.get("moistureDeductionMethod") ?? "linear",
      moistureRatePerPct: Number(fd.get("moistureRatePerPct") ?? 0),
      fmDeductionMethod: fd.get("fmDeductionMethod") ?? "actual",
      fmRatePerPct: Number(fd.get("fmRatePerPct") ?? 1),
      cessRate: Number(fd.get("cessRate") ?? 0),
      allowedVariancePct: Number(fd.get("allowedVariancePct") ?? 2),
      description: fd.get("description"),
      status: "Draft",
    };
    await fetch("/api/quality-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setShowForm(false);
    load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Quality rules (date-valid)</h3>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">+ New rule</button>
        )}
      </div>
      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
        <strong>Important:</strong> Quality rules are versioned by effective date. Old transactions always use the rule active on their transaction date. Never edit a posted rule — create a new one.
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">New quality rule</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-bold">
              Material *
              <select name="materialId" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="">Select material…</option>
                {materials.filter((m) => m.status === "Active").map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            {[
              { label: "Valid from *", name: "validFrom", type: "date", required: true },
              { label: "Valid to (blank = ongoing)", name: "validTo", type: "date", required: false },
              { label: "Base moisture (%)", name: "baseMoisture", type: "number", required: false, placeholder: "14" },
              { label: "Moisture rate (₹/MT per 1%)", name: "moistureRatePerPct", type: "number", required: false, placeholder: "0.71" },
              { label: "FM rate (% of net wt per 1% FM)", name: "fmRatePerPct", type: "number", required: false, placeholder: "1.0" },
              { label: "Cess rate (% of net value)", name: "cessRate", type: "number", required: false, placeholder: "0.5" },
              { label: "Allowed variance before hold (%)", name: "allowedVariancePct", type: "number", required: false, placeholder: "2" },
            ].map(({ label, name, type, required, placeholder }) => (
              <label key={name} className="grid gap-1.5 text-sm font-bold">
                {label}
                <input name={name} type={type} required={required} placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-bold">
              Moisture deduction method
              <select name="moistureDeductionMethod" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="linear">Linear</option>
                <option value="slab">Slab</option>
                <option value="none">None</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              FM deduction method
              <select name="fmDeductionMethod" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="actual">Actual</option>
                <option value="slab">Slab</option>
                <option value="none">None</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Description / notes
              <textarea name="description" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Explain the rule context for audit reference" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save for Approval"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Spinner /> : (
        <Table headers={["Material", "Valid from", "Valid to", "Base moisture", "Moisture deduction", "FM deduction", "Cess", "Status", "Action"]}>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-5 py-3.5 font-black">{r.materialName}</td>
              <td className="px-5 py-3.5 text-[#536251]">{r.validFrom}</td>
              <td className="px-5 py-3.5 text-[#536251]">{r.validTo || "Ongoing"}</td>
              <td className="px-5 py-3.5">{r.baseMoisture}%</td>
              <td className="px-5 py-3.5 text-[#536251]">₹{r.moistureRatePerPct}/MT per 1%</td>
              <td className="px-5 py-3.5 text-[#536251]">{r.fmDeductionMethod}</td>
              <td className="px-5 py-3.5">{r.cessRate}%</td>
              <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
              <td className="px-5 py-3.5">
                <button onClick={async () => {
                  const next = r.status === "Draft" ? "Active" : r.status === "Active" ? "Expired" : "Draft";
                  await fetch(`/api/quality-rules/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
                  load();
                }} className="text-xs font-black text-[#172018] hover:underline">
                  {r.status === "Draft" ? "Approve" : r.status === "Active" ? "Expire" : "View"}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ─── RATES TAB ────────────────────────────────────────────────────────────────

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
      fetch("/api/rates").then((r) => r.json()),
      fetch("/api/materials").then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
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
    const mat = materials.find((m) => m.id === materialId);
    const party = parties.find((p) => p.id === partyId);
    const body = {
      materialId,
      materialName: mat?.name ?? materialId,
      partyId,
      partyName: party?.name ?? "All",
      rateType: fd.get("rateType") ?? "GrossSale",
      rate: Number(fd.get("rate") ?? 0),
      validFrom: fd.get("validFrom"),
      validTo: fd.get("validTo") || null,
    };
    await fetch("/api/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setShowForm(false);
    load();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Rate masters</h3>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">+ Add rate</button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active gross sale rates", count: rows.filter((r) => r.rateType === "GrossSale").length, tone: "text-[#15803d]" },
          { label: "Active purchase rates", count: rows.filter((r) => r.rateType === "Purchase").length, tone: "text-[#1d4ed8]" },
          { label: "Active retail rates", count: rows.filter((r) => r.rateType === "Retail").length, tone: "text-[#c2410c]" },
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
            <label className="grid gap-1.5 text-sm font-bold">
              Material *
              <select name="materialId" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="">Select material…</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Party (blank = default for all)
              <select name="partyId" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="">All parties (default)</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Rate type
              <select name="rateType" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="GrossSale">Gross Sale</option>
                <option value="Purchase">Purchase</option>
                <option value="Retail">Retail</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Rate (₹/UOM) *
              <input name="rate" type="number" required placeholder="e.g. 22500" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Valid from *
              <input name="validFrom" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Valid to (blank = ongoing)
              <input name="validTo" type="date" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save Rate"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <Spinner /> : (
        <Table headers={["Material", "Party", "Rate type", "Rate (₹/UOM)", "Valid from", "Valid to", "Action"]}>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-5 py-3.5 font-black">{r.materialName}</td>
              <td className="px-5 py-3.5 text-[#536251]">{r.partyName}</td>
              <td className="px-5 py-3.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${typeColors[r.rateType]}`}>{r.rateType}</span>
              </td>
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

// ─── PAGE ─────────────────────────────────────────────────────────────────────

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
