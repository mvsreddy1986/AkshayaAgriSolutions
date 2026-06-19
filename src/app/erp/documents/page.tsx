"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "../../../lib/supabase/client";
import {
  Upload, Link2, FileCode2, Archive,
  RefreshCw, Download, Eye,
} from "lucide-react";

const TABS = ["Import Data", "Matching", "Templates", "Archive"] as const;
type Tab = (typeof TABS)[number];

const DOCS_TAB_ICONS = {
  "Import Data": Upload,
  "Matching": Link2,
  "Templates": FileCode2,
  "Archive": Archive,
} as const;

type ImportType = "parties" | "materials" | "inward_lots" | "invoices";
type UploadState = "idle" | "uploading" | "done" | "error";

interface ImportPanel {
  type: ImportType;
  title: string;
  desc: string;
  accept: string;
  badge: string;
  columns: string;
}

const PANELS: ImportPanel[] = [
  {
    type: "parties",
    title: "Parties (customers, suppliers, farmers)",
    desc: "Import your full party master — customers, suppliers, traders, and farmers in one sheet.",
    accept: ".xlsx,.xls,.csv",
    badge: "Master",
    columns: "Name, Party Type, GSTIN, Mobile, Email, Address, State, Credit Limit, Credit Days, Business Flows, Bank Account, IFSC, Bank Name",
  },
  {
    type: "materials",
    title: "Materials & quality setup",
    desc: "Import material master with HSN codes, GST rates, and quality parameter definitions.",
    accept: ".xlsx,.xls,.csv",
    badge: "Master",
    columns: "Name, HSN, UOM, GST Rate, Category, Default Gross Sale Rate, Settlement Method, Quality Params",
  },
  {
    type: "inward_lots",
    title: "Inward lots / weighment records",
    desc: "Import past or current delivery records — vehicle-wise weight, quality readings, and values.",
    accept: ".xlsx,.xls,.csv",
    badge: "Transaction",
    columns: "Document Ref, Business Model, Date, Material Name, Customer Name, Supplier Name, Vehicle No, Gross Weight, Tare Weight, Accepted Weight, Moisture %, FM %, Gross Sale Rate",
  },
  {
    type: "invoices",
    title: "Invoices & payments",
    desc: "Import existing sales or purchase invoices with GST breakdown and payment status.",
    accept: ".xlsx,.xls,.csv",
    badge: "Transaction",
    columns: "Invoice No, Type, Business Model, Date, Due Date, Party Name, Material Name, Quantity, UOM, Gross Rate, Total Value, Amount Paid, Status",
  },
];

const badgeColors: Record<string, string> = {
  Master: "bg-[#172018] text-white",
  Transaction: "bg-[#405b3d] text-white",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-[#fef9c3] text-[#a16207]",
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Mapped: "bg-[#eff6ff] text-[#1d4ed8]",
    Posted: "bg-[#f5f3ff] text-[#6d28d9]",
    Linked: "bg-[#f0fdf4] text-[#15803d]",
    Approved: "bg-[#f0fdf4] text-[#15803d]",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function ImportCard({ panel }: { panel: ImportPanel }) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError("");
    setPreview(null);

    if (!f) return;
    const XLSX = await import("xlsx");
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    setPreview(rows.slice(0, 3));
  }

  async function handleUpload() {
    if (!file) return;
    setState("uploading");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", panel.type);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Upload failed");
      setResult({ count: data.count });
      setState("done");
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  function reset() {
    setFile(null);
    setState("idle");
    setResult(null);
    setError("");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-[#d8decf] bg-white p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${badgeColors[panel.badge]}`}>{panel.badge}</span>
      </div>
      <h3 className="text-lg font-semibold leading-snug">{panel.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#60735d]">{panel.desc}</p>

      <div className="mt-3 rounded-lg bg-[#f3f6ef] p-3">
        <p className="text-xs font-semibold text-[#405b3d]">Expected columns</p>
        <p className="mt-1 text-xs text-[#60735d]">{panel.columns}</p>
      </div>

      {preview && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#d8decf]">
          <p className="border-b border-[#edf0e8] px-3 py-2 text-xs font-semibold text-[#60735d]">
            Preview — first {preview.length} rows
          </p>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f3f6ef]">
              <tr>
                {Object.keys(preview[0]).slice(0, 6).map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold text-[#405b3d] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-t border-[#edf0e8]">
                  {Object.values(row).slice(0, 6).map((v, j) => (
                    <td key={j} className="px-3 py-2 text-[#536251] whitespace-nowrap">{String(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={panel.accept}
          id={`file-${panel.type}`}
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor={`file-${panel.type}`}
          className="cursor-pointer rounded-md border border-[#c8d4c0] bg-[#f6faef] px-4 py-2.5 text-center text-sm font-semibold hover:bg-[#eef3e8]"
        >
          {file ? `📄 ${file.name}` : "Choose Excel / CSV file"}
        </label>

        {file && state !== "done" && (
          <button
            onClick={handleUpload}
            disabled={state === "uploading"}
            className="btn btn-primary flex items-center gap-1.5"
          >
            <Upload size={14} />{state === "uploading" ? "Importing to Supabase…" : `Import ${panel.title.split(" ")[0]}`}
          </button>
        )}
      </div>

      {state === "done" && result && (
        <div className="mt-3 rounded-lg bg-[#f0fdf4] p-4">
          <p className="text-sm font-semibold text-[#15803d]">
            ✓ {result.count} records imported to Supabase
          </p>
          <button onClick={reset} className="mt-2 text-xs font-semibold text-[#15803d] hover:underline inline-flex items-center gap-1">
            <RefreshCw size={12} />Import another file
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="mt-3 rounded-lg bg-[#fef2f2] p-4">
          <p className="text-sm font-semibold text-[#b91c1c]">Import failed</p>
          <p className="mt-1 text-xs text-[#b91c1c]">{error}</p>
          <button onClick={reset} className="mt-2 text-xs font-semibold text-[#b91c1c] hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function ImportTab() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {PANELS.map((p) => (
        <ImportCard key={p.type} panel={p} />
      ))}
    </div>
  );
}

type TableCounts = { parties: number; materials: number; inward_lots: number; invoices: number };

function MatchingTab() {
  const [counts, setCounts] = useState<TableCounts | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const [{ count: p }, { count: m }, { count: l }, { count: i }] = await Promise.all([
      supabase.from("parties").select("*", { count: "exact", head: true }),
      supabase.from("materials").select("*", { count: "exact", head: true }),
      supabase.from("inward_lots").select("*", { count: "exact", head: true }),
      supabase.from("invoices").select("*", { count: "exact", head: true }),
    ]);
    setCounts({ parties: p ?? 0, materials: m ?? 0, inward_lots: l ?? 0, invoices: i ?? 0 });
    setLoading(false);
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Live Supabase record counts</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn btn-primary flex items-center gap-1.5"
        >
          <RefreshCw size={14} />{loading ? "Checking…" : "Refresh counts"}
        </button>
      </div>

      {counts ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Parties", count: counts.parties, color: "text-[#1d4ed8]" },
            { label: "Materials", count: counts.materials, color: "text-[#15803d]" },
            { label: "Inward lots", count: counts.inward_lots, color: "text-[#9333ea]" },
            { label: "Invoices", count: counts.invoices, color: "text-[#172018]" },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">{label} in Supabase</p>
              <p className={`mt-2 text-4xl font-semibold ${color}`}>{count}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#aebba8] bg-white p-8 text-center">
          <p className="text-sm text-[#60735d]">Click "Refresh counts" to check what's in your Supabase database.</p>
        </div>
      )}

      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5 text-sm text-[#92400e]">
        <strong>Before importing:</strong> Run the schema SQL in Supabase first.
        Go to your Supabase project → <strong>SQL Editor</strong> → paste the contents of{" "}
        <code className="font-mono bg-[#fef3c7] px-1 rounded">src/lib/supabase/schema.sql</code> → Run.
      </div>
    </div>
  );
}

type TemplateCard = {
  name: string;
  badge: string;
  desc: string;
  columns: string;
  rows: string;
  onDownload: () => Promise<void>;
};

function TemplatesTab() {
  const [role, setRole] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_auth");
      if (stored) setRole(JSON.parse(stored).role);
    } catch {}
  }, []);

  async function handleDownload(name: string, fn: () => Promise<void>) {
    setDownloading(name);
    await fn();
    setTimeout(() => setDownloading(null), 800);
  }

  const TEMPLATES: TemplateCard[] = [
    {
      name: "Parties",
      badge: "Master",
      desc: "All party types in one sheet — customers, suppliers, farmers, and traders. Includes Sarvani, local suppliers, farmers, and trader contacts as sample rows.",
      columns: "Name, Party Type, GSTIN, Mobile, Email, Address, State, Credit Limit, Credit Days, Business Flows, Tax Profile, Bank Account, IFSC, Bank Name",
      rows: "8 sample rows pre-filled",
      onDownload: async () => {
        const { downloadPartiesTemplate } = await import("../../../lib/templates/excel");
        downloadPartiesTemplate();
      },
    },
    {
      name: "Materials",
      badge: "Master",
      desc: "Full material master with HSN codes, GST rates, quality parameters and settlement methods. All 8 Akshaya materials pre-populated.",
      columns: "Name, HSN, UOM, GST Rate, Category, Default Rate, Settlement Method, Quality Params, Status",
      rows: "8 sample rows (Maize, DDGS, WDG, Coal, Biomass, CO2, Corn Oil, Paddy Husk)",
      onDownload: async () => {
        const { downloadMaterialsTemplate } = await import("../../../lib/templates/excel");
        downloadMaterialsTemplate();
      },
    },
    {
      name: "Inward Lots",
      badge: "Transaction",
      desc: "Daily weighment register for all models. Covers Model A (Sarvani delivery), Model B (farmer finance), and Model C (byproduct purchase) with realistic vehicle weights, moisture%, and FM%.",
      columns: "Doc Ref, Model, Date, Material, Customer, Supplier, Farmer, Vehicle No, Gross/Tare/Net/Accepted Weight, Moisture%, FM%, Rate, Value, Status",
      rows: "5 sample lots across Models A, B, C",
      onDownload: async () => {
        const { downloadInwardLotsTemplate } = await import("../../../lib/templates/excel");
        downloadInwardLotsTemplate();
      },
    },
    {
      name: "Invoices",
      badge: "Transaction",
      desc: "Sales and purchase invoice register with full GST breakdown. Covers Sarvani bulk invoice, trader sales, and Sarvani purchase invoices for byproducts.",
      columns: "Invoice No, Type, Model, Date, Due Date, Party, Material, Qty, UOM, Rate, Gross Value, Taxable, CGST/SGST/IGST, Total, Paid, Due, Status",
      rows: "5 sample invoices (3 sales + 1 purchase + 1 paid)",
      onDownload: async () => {
        const { downloadInvoicesTemplate } = await import("../../../lib/templates/excel");
        downloadInvoicesTemplate();
      },
    },
  ];

  const isAdmin = role === "Admin";

  return (
    <div className="grid gap-6">
      {/* Access notice */}
      {!isAdmin && (
        <div className="flex items-start gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
          <span className="mt-0.5 text-lg">🔒</span>
          <div>
            <p className="font-semibold text-[#92400e]">Admin access required</p>
            <p className="mt-1 text-sm text-[#92400e]">
              Template downloads are restricted to Admin login. Log out and sign in as{" "}
              <strong>admin@akshayaagri.in</strong> to download.
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex items-start gap-3 rounded-xl border border-[#d8ecce] bg-[#f0fdf4] p-4">
          <span className="mt-0.5 text-lg">✓</span>
          <p className="text-sm text-[#15803d]">
            <strong>Admin workspace.</strong> All templates include sample rows pre-filled with Akshaya Agri Solutions data.
            Row 1 = column headers · Row 2 = field notes · Row 3+ = sample data you can replace.
          </p>
        </div>
      )}

      {/* Template cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        {TEMPLATES.map((t) => (
          <div key={t.name} className={`rounded-xl border bg-white p-6 transition ${isAdmin ? "border-[#d8decf]" : "border-[#e5e7eb] opacity-60"}`}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${t.badge === "Master" ? "bg-[#172018] text-white" : "bg-[#405b3d] text-white"}`}>
                {t.badge}
              </span>
              <span className="text-xs font-medium text-[#60735d]">Excel (.xlsx)</span>
            </div>
            <h3 className="text-lg font-semibold">{t.name} template</h3>
            <p className="mt-2 text-sm leading-6 text-[#60735d]">{t.desc}</p>

            <div className="mt-4 grid gap-2 rounded-lg bg-[#f3f6ef] p-3 text-xs">
              <div>
                <span className="font-semibold text-[#405b3d]">Columns: </span>
                <span className="text-[#60735d]">{t.columns}</span>
              </div>
              <div>
                <span className="font-semibold text-[#405b3d]">Sample data: </span>
                <span className="text-[#60735d]">{t.rows}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => isAdmin && handleDownload(t.name, t.onDownload)}
                disabled={!isAdmin || downloading === t.name}
                className="btn btn-primary flex items-center gap-1.5"
              >
                <Download size={14} />{downloading === t.name ? "Preparing…" : "Download template"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Usage guide */}
      {isAdmin && (
        <div className="rounded-xl border border-[#d8decf] bg-white p-6">
          <h3 className="font-semibold">How to use these templates</h3>
          <ol className="mt-4 grid gap-3 text-sm text-[#536251]">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#172018] text-xs font-semibold text-white">1</span>Download the template for the data you want to import.</li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#172018] text-xs font-semibold text-white">2</span>Row 1 is the header (do not change). Row 2 explains each column. Delete Row 2 before importing.</li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#172018] text-xs font-semibold text-white">3</span>Replace or add rows with your real business data. Keep column order exactly as is.</li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#172018] text-xs font-semibold text-white">4</span>Go to the <strong>Import Data</strong> tab, choose the matching import type, upload your file, and click Import.</li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#172018] text-xs font-semibold text-white">5</span>Check the <strong>Matching</strong> tab to confirm record counts in Supabase.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function ArchiveTab() {
  const archive = [
    { name: "AKSHAYA AGRI SOLUTIONS 12-5-26.pdf", type: "Delivery report", party: "Sarvani Biofuels", date: "12-May-2026", status: "Linked", ref: "IMPORT-12052026-001" },
    { name: "AAS-2627-0122.pdf", type: "Sales invoice", party: "Sarvani Biofuels", date: "12-May-2026", status: "Approved", ref: "AAS-2627-0122" },
    { name: "FP-090 Farmer Sheet.xlsx", type: "Farmer Excel", party: "Finance pool", date: "13-May-2026", status: "Linked", ref: "IMPORT-12052026-002" },
    { name: "SARB-2627-0044.pdf", type: "Purchase invoice", party: "Sarvani Biofuels", date: "05-May-2026", status: "Linked", ref: "DDGS-MAY-01" },
    { name: "RTGS-receipt-10May.png", type: "Payment proof", party: "Sarvani Biofuels", date: "10-May-2026", status: "Linked", ref: "RV-2627-0088" },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Audit document archive</h3>
        <input type="text" placeholder="Search documents…" className="w-56 rounded-md border border-[#c8d4c0] px-3.5 py-2 text-sm outline-none focus:border-[#16a34a]" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
              <tr>
                {["Document name", "Type", "Linked party", "Date", "Reference", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archive.map((doc) => (
                <tr key={doc.name} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-semibold max-w-55 truncate">{doc.name}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{doc.type}</td>
                  <td className="px-5 py-3.5 font-bold">{doc.party}</td>
                  <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{doc.date}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#1d4ed8]">{doc.ref}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={doc.status} /></td>
                  <td className="px-5 py-3.5">
                    <button className="text-xs font-semibold text-[#172018] hover:underline inline-flex items-center gap-1"><Eye size={12} />View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [tab, setTab] = useState<Tab>("Import Data");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const TabIcon = DOCS_TAB_ICONS[t];
          return (
            <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === t ? "bg-[var(--ink)] text-white shadow-sm" : "border border-[var(--border)] bg-[var(--card)] text-[var(--ink-2)] hover:bg-[var(--muted)]"}`}>
              <TabIcon size={14} />{t}
            </button>
          );
        })}
      </div>
      {tab === "Import Data" && <ImportTab />}
      {tab === "Matching" && <MatchingTab />}
      {tab === "Templates" && <TemplatesTab />}
      {tab === "Archive" && <ArchiveTab />}
    </div>
  );
}
