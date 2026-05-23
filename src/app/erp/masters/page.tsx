"use client";

import { useState } from "react";
import { MATERIALS, PARTIES, QUALITY_RULES, RATE_MASTERS } from "../../../lib/data/seed";
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

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-black">{title}</h3>
      {action && (
        <button className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
          + {action}
        </button>
      )}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function MaterialsTab() {
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState<Material[]>(MATERIALS);

  return (
    <div className="grid gap-5">
      <SectionHeader title="Material master" action="Add material" />

      {showForm && (
        <div className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">New material</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Material name", placeholder: "e.g. Maize", type: "text" },
              { label: "HSN code", placeholder: "e.g. 1005", type: "text" },
              { label: "Unit of measure", placeholder: "MT / KG / L / Bag", type: "text" },
              { label: "GST rate (%)", placeholder: "0 / 5 / 12 / 18", type: "number" },
              { label: "Default gross sale rate (₹/UOM)", placeholder: "e.g. 22500", type: "number" },
              { label: "Category", placeholder: "Grain / Biomass / Chemical…", type: "text" },
            ].map(({ label, placeholder, type }) => (
              <label key={label} className="grid gap-1.5 text-sm font-bold">
                {label}
                <input type={type} placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Quality parameters (comma-separated)
              <input type="text" placeholder="Moisture %, Foreign matter %, Starch %, Aflatoxin ppm" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Settlement method
              <input type="text" placeholder="Quality deduction + cess / Accepted weight / Retail margin…" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowForm(false)} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Save Draft</button>
            <button onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </div>
      )}

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="self-start rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
          + Add material
        </button>
      )}

      <Table headers={["Material", "HSN", "UOM", "GST %", "Default rate", "Settlement", "Quality params", "Status", "Action"]}>
        {rows.map((m) => (
          <tr key={m.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
            <td className="px-5 py-3.5 font-black">{m.name}</td>
            <td className="px-5 py-3.5 text-[#536251]">{m.hsn}</td>
            <td className="px-5 py-3.5 text-[#536251]">{m.uom}</td>
            <td className="px-5 py-3.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.gstRate === 0 ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
                {m.gstRate}%
              </span>
            </td>
            <td className="px-5 py-3.5 font-bold">₹{m.defaultGrossSaleRate.toLocaleString("en-IN")}</td>
            <td className="px-5 py-3.5 text-[#536251] max-w-[180px] truncate">{m.settlementMethod}</td>
            <td className="px-5 py-3.5 text-[#536251]">
              <div className="flex flex-wrap gap-1">
                {m.qualityParams.slice(0, 2).map((p) => (
                  <span key={p} className="rounded-full bg-[#f3f6ef] px-2 py-0.5 text-xs text-[#60735d]">{p}</span>
                ))}
                {m.qualityParams.length > 2 && (
                  <span className="rounded-full bg-[#f3f6ef] px-2 py-0.5 text-xs text-[#60735d]">+{m.qualityParams.length - 2}</span>
                )}
              </div>
            </td>
            <td className="px-5 py-3.5"><StatusBadge status={m.status} /></td>
            <td className="px-5 py-3.5">
              <div className="flex gap-2">
                <button className="text-xs font-black text-[#172018] hover:underline">Edit</button>
                <button onClick={() => setRows(rows.map((r) => r.id === m.id ? { ...r, status: r.status === "Active" ? "Inactive" : "Active" as Material["status"] } : r))} className="text-xs font-black text-[#60735d] hover:underline">Toggle</button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function PartiesTab() {
  const [showForm, setShowForm] = useState(false);
  const typeColors: Record<string, string> = {
    Customer: "bg-[#eff6ff] text-[#1d4ed8]",
    Supplier: "bg-[#f0fdf4] text-[#15803d]",
    Farmer: "bg-[#fdf4ff] text-[#9333ea]",
    Trader: "bg-[#fff7ed] text-[#c2410c]",
    Both: "bg-[#172018] text-white",
  };

  return (
    <div className="grid gap-5">
      <SectionHeader title="Party master" />

      {showForm && (
        <div className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">New party</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Party name", "Sarvani Biofuels Pvt Ltd", "text"],
              ["Party type", "Customer / Supplier / Farmer / Trader / Both", "text"],
              ["GSTIN", "37AAGCS8432B1ZK", "text"],
              ["Mobile", "9848012345", "tel"],
              ["Email", "accounts@party.in", "email"],
              ["Credit limit (₹)", "0", "number"],
              ["Credit days", "21", "number"],
              ["Bank account no", "", "text"],
              ["IFSC code", "", "text"],
            ].map(([label, placeholder, type]) => (
              <label key={label} className="grid gap-1.5 text-sm font-bold">
                {label}
                <input type={type as string} placeholder={placeholder as string} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Address
              <textarea className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Full address including district, state, PIN" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowForm(false)} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Save Party</button>
            <button onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </div>
      )}
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="self-start rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
          + Add party
        </button>
      )}

      <Table headers={["Party name", "Type", "GSTIN", "Mobile", "Credit limit", "Credit days", "Business models", "Status", "Action"]}>
        {PARTIES.map((p) => (
          <tr key={p.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
            <td className="px-5 py-3.5 font-black max-w-[180px]">{p.name}</td>
            <td className="px-5 py-3.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${typeColors[p.partyType] ?? "bg-gray-100 text-gray-700"}`}>
                {p.partyType}
              </span>
            </td>
            <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{p.gstin || "—"}</td>
            <td className="px-5 py-3.5 text-[#536251]">{p.mobile || "—"}</td>
            <td className="px-5 py-3.5 font-bold">{p.creditLimit > 0 ? `₹${(p.creditLimit / 100000).toFixed(1)}L` : "—"}</td>
            <td className="px-5 py-3.5 text-[#536251]">{p.creditDays > 0 ? `${p.creditDays}d` : "—"}</td>
            <td className="px-5 py-3.5">
              <div className="flex gap-1">
                {p.businessFlows.map((f) => (
                  <span key={f} className="rounded-md bg-[#172018] px-1.5 py-0.5 text-[10px] font-black text-white">{f}</span>
                ))}
              </div>
            </td>
            <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
            <td className="px-5 py-3.5">
              <button className="text-xs font-black text-[#172018] hover:underline">Edit</button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function QualityRulesTab() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="grid gap-5">
      <SectionHeader title="Quality rules (date-valid)" />
      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
        <strong>Important:</strong> Quality rules are versioned by effective date. Old transactions always use the rule active on their transaction date. Never edit a posted rule — create a new one.
      </div>

      {showForm && (
        <div className="rounded-xl border border-[#d8decf] bg-white p-6">
          <p className="mb-4 text-lg font-black">New quality rule</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Material", "Select material…", "text"],
              ["Valid from", "", "date"],
              ["Valid to (blank = ongoing)", "", "date"],
              ["Base moisture (%)", "14", "number"],
              ["Moisture deduction (₹/MT per 1% above base)", "0.71", "number"],
              ["FM deduction method", "actual / slab / none", "text"],
              ["FM rate (% of net weight per 1% FM)", "1.0", "number"],
              ["Cess rate (% of net value)", "0.5", "number"],
              ["Allowed variance before hold (%)", "2", "number"],
            ].map(([label, placeholder, type]) => (
              <label key={label} className="grid gap-1.5 text-sm font-bold">
                {label}
                <input type={type as string} placeholder={placeholder as string} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
              </label>
            ))}
            <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
              Description / notes
              <textarea className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Explain the rule context for audit reference" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowForm(false)} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Save for Approval</button>
            <button onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </div>
      )}
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="self-start rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
          + New rule
        </button>
      )}

      <Table headers={["Material", "Valid from", "Valid to", "Base moisture", "Moisture deduction", "FM deduction", "Cess", "Status", "Action"]}>
        {QUALITY_RULES.map((r) => (
          <tr key={r.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
            <td className="px-5 py-3.5 font-black">{r.materialName}</td>
            <td className="px-5 py-3.5 text-[#536251]">{r.validFrom}</td>
            <td className="px-5 py-3.5 text-[#536251]">{r.validTo}</td>
            <td className="px-5 py-3.5">{r.baseMoisture}%</td>
            <td className="px-5 py-3.5 text-[#536251]">₹{r.moistureRatePerPct}/MT per 1%</td>
            <td className="px-5 py-3.5 text-[#536251]">{r.fmDeductionMethod}</td>
            <td className="px-5 py-3.5">{r.cessRate}%</td>
            <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
            <td className="px-5 py-3.5">
              <button className="text-xs font-black text-[#172018] hover:underline">View</button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function RatesTab() {
  const typeColors: Record<string, string> = {
    GrossSale: "bg-[#f0fdf4] text-[#15803d]",
    Purchase: "bg-[#eff6ff] text-[#1d4ed8]",
    Retail: "bg-[#fff7ed] text-[#c2410c]",
  };

  return (
    <div className="grid gap-5">
      <SectionHeader title="Rate masters" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active gross sale rates", count: RATE_MASTERS.filter((r) => r.rateType === "GrossSale").length, tone: "text-[#15803d]" },
          { label: "Active purchase rates", count: RATE_MASTERS.filter((r) => r.rateType === "Purchase").length, tone: "text-[#1d4ed8]" },
          { label: "Active retail rates", count: RATE_MASTERS.filter((r) => r.rateType === "Retail").length, tone: "text-[#c2410c]" },
          { label: "Total rate records", count: RATE_MASTERS.length, tone: "text-[#172018]" },
        ].map(({ label, count, tone }) => (
          <div key={label} className="rounded-xl border border-[#d8decf] bg-white p-5">
            <p className="text-sm text-[#60735d]">{label}</p>
            <p className={`mt-2 text-3xl font-black ${tone}`}>{count}</p>
          </div>
        ))}
      </div>
      <button className="self-start rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29]">
        + Add rate
      </button>
      <Table headers={["Material", "Party", "Rate type", "Rate (₹/UOM)", "Valid from", "Valid to", "Action"]}>
        {RATE_MASTERS.map((r) => (
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
              <button className="text-xs font-black text-[#172018] hover:underline">Edit</button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export default function MastersPage() {
  const [tab, setTab] = useState<Tab>("Materials");

  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}
          >
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
