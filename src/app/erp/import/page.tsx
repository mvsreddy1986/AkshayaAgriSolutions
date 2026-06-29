"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload, Download, CheckCircle2, AlertCircle, Loader2, X,
  Search, Trash2, ShieldAlert, ChevronRight, FileSpreadsheet,
  Banknote, HelpCircle, RotateCcw,
} from "lucide-react";

// ── CSV utilities ─────────────────────────────────────────────────────────────

// Maps any column header variant the user might have to our canonical key
const HEADER_ALIASES: Record<string, string> = {
  "lot number": "challan_no", "lot no": "challan_no", "lot_no": "challan_no",
  "lot_number": "challan_no", "challan no": "challan_no", "challan number": "challan_no",
  "challan_number": "challan_no", "po number": "challan_no", "po no": "challan_no",
  "po_number": "challan_no", "bill no": "challan_no", "bill number": "challan_no",
  "s.no": "challan_no", "sno": "challan_no", "sr no": "challan_no", "sr.no": "challan_no",
  // invoice
  "invoice no": "invoice_no", "invoice number": "invoice_no", "invoice_number": "invoice_no",
  "inv no": "invoice_no", "inv_no": "invoice_no",
  // weights
  "gross wt kg": "gross_wt_kg", "gross weight kg": "gross_wt_kg", "gross wt": "gross_wt_kg",
  "tare wt kg": "tare_wt_kg", "tare weight kg": "tare_wt_kg", "tare wt": "tare_wt_kg",
  "net wt kg": "net_wt_kg", "net weight kg": "net_wt_kg", "net wt": "net_wt_kg",
  // margin
  "margin per mt": "akshaya_margin_per_mt", "margin/mt": "akshaya_margin_per_mt",
  "akshaya margin": "akshaya_margin_per_mt",
};

function normalizeHeader(h: string): string {
  const key = h.toLowerCase().trim();
  return HEADER_ALIASES[key] ?? key.replace(/\s+/g, "_");
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line: string): string[] => {
    const cols: string[] = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
      else if (line[i] === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += line[i]; }
    }
    cols.push(cur.trim()); return cols;
  };
  const rawHeaders = parseRow(lines[0]);
  const headers    = rawHeaders.map(normalizeHeader);
  const rows = lines.slice(1).filter((l) => l.trim()).map((line) => {
    const vals = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").trim()]));
  });
  return { headers, rows };
}

function downloadCSV(filename: string, headerRow: string, sampleRow: string) {
  const blob = new Blob([`${headerRow}\n${sampleRow}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ── Validation ────────────────────────────────────────────────────────────────

interface RowError { row: number; message: string }

function validateLotRows(rows: Record<string, string>[]): RowError[] {
  const errs: RowError[] = []; const seen = new Set<string>();
  rows.forEach((r, i) => {
    const n = i + 2;
    // Accept challan_no (new) or po_number (legacy) as the identifier
    const challan = (r.challan_no ?? r.po_number ?? "").trim();
    if (!challan) errs.push({ row: n, message: "challan_no is required" });
    else if (seen.has(challan)) errs.push({ row: n, message: `Duplicate challan_no "${challan}"` });
    else seen.add(challan);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.unloading_date ?? "")) errs.push({ row: n, message: "unloading_date must be YYYY-MM-DD" });
    if (!(parseFloat(r.net_wt_kg) > 0)) errs.push({ row: n, message: "net_wt_kg must be > 0" });
    if (!(parseFloat(r.po_rate_per_kg) > 0)) errs.push({ row: n, message: "po_rate_per_kg must be > 0" });
    if (!(parseFloat(r.supplier_rate_per_kg) > 0)) errs.push({ row: n, message: "supplier_rate_per_kg must be > 0" });
  });
  return errs;
}

function validatePaymentRows(rows: Record<string, string>[]): RowError[] {
  const errs: RowError[] = [];
  rows.forEach((r, i) => {
    const n = i + 2;
    if (!r.supplier?.trim()) errs.push({ row: n, message: "supplier required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "")) errs.push({ row: n, message: "date must be YYYY-MM-DD" });
    if (!(parseFloat(r.amount) > 0)) errs.push({ row: n, message: "amount must be > 0" });
  });
  return errs;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const LOT_HEADER = "challan_no,unloading_date,vehicle_no,supplier,gross_wt_kg,tare_wt_kg,net_wt_kg,po_rate_per_kg,supplier_rate_per_kg,cess_paid_rs,balance_cess_rs,moisture_pct,mc_deduction_rs,akshaya_margin_per_mt,invoice_no,status";
const LOT_SAMPLE = "2627000482,2025-04-01,AP39AB1234,Ravi Traders,10200,700,9500,22.50,22.00,950,1000,15.5,2000,,AAS-2526-0045,Settled";
const PAY_HEADER = "po_number,date,supplier,receiver_name,transaction_type,amount,bank_ref,narration";
const PAY_SAMPLE = "PO-2025-001,2025-04-05,Ravi Traders,Ravi Kumar,NEFT,200000,UTR123456789,Payment for April lot";

const LOT_GUIDE = [
  { col: "challan_no",           desc: "Challan / lot / bill number — must be unique" },
  { col: "unloading_date",       desc: "Date YYYY-MM-DD (e.g. 2025-11-17)" },
  { col: "vehicle_no",           desc: "Vehicle registration (e.g. AP39UG7334)" },
  { col: "supplier",             desc: "Supplier name — match Parties master exactly" },
  { col: "gross_wt_kg",          desc: "Gross weight in kg · optional (blank = same as net)" },
  { col: "tare_wt_kg",           desc: "Tare weight in kg · optional (blank = 0)" },
  { col: "net_wt_kg",            desc: "Net weight in kg — required" },
  { col: "po_rate_per_kg",       desc: "Sarvani pays you ₹/kg (PO rate)" },
  { col: "supplier_rate_per_kg", desc: "You pay supplier ₹/kg" },
  { col: "cess_paid_rs",         desc: "Cess paid at gate ₹ · optional (blank = 0)" },
  { col: "balance_cess_rs",      desc: "Cess deducted from supplier ₹ · optional" },
  { col: "moisture_pct",         desc: "Moisture % reading · optional" },
  { col: "mc_deduction_rs",      desc: "Moisture deduction from supplier ₹ · optional" },
  { col: "akshaya_margin_per_mt",desc: "Your margin ₹/MT · optional (blank = auto from rate diff)" },
  { col: "invoice_no",           desc: "Sarvani invoice number to link (e.g. AAS-2526-0045) · optional" },
  { col: "status",               desc: "Settled / Approved / Draft" },
];

const PAY_GUIDE = [
  { col: "po_number", desc: "Reference PO (optional)" },
  { col: "date", desc: "Payment date YYYY-MM-DD" },
  { col: "supplier", desc: "Supplier company name" },
  { col: "receiver_name", desc: "Individual receiver name" },
  { col: "transaction_type", desc: "NEFT / RTGS / IMPS / UPI" },
  { col: "amount", desc: "Amount in ₹" },
  { col: "bank_ref", desc: "UTR / bank reference" },
  { col: "narration", desc: "Your note (audit trail)" },
];

// ── Import state ──────────────────────────────────────────────────────────────

type ImportState = "idle" | "preview" | "importing" | "done";

interface ImportResult { created: number; errors: string[] }

interface CardState {
  state: ImportState;
  rows: Record<string, string>[];
  headers: string[];
  valErrs: RowError[];
  result: ImportResult | null;
  apiErr: string | null;
}

const EMPTY: CardState = { state: "idle", rows: [], headers: [], valErrs: [], result: null, apiErr: null };

// ── Import Panel (compact, pro) ───────────────────────────────────────────────

interface ImportPanelProps {
  label: string;
  headerLine: string;
  sampleLine: string;
  templateFilename: string;
  guide: { col: string; desc: string }[];
  validate: (rows: Record<string, string>[]) => RowError[];
  apiEndpoint: string;
  apiBody: (rows: Record<string, string>[], batchRef: string) => object;
  accent: string;
}

function ImportPanel({ label, headerLine, sampleLine, templateFilename, guide, validate, apiEndpoint, apiBody, accent }: ImportPanelProps) {
  const [s, setS]       = useState<CardState>(EMPTY);
  const [guide_, setGd] = useState(false);
  const fileRef         = useRef<HTMLInputElement>(null);

  const reset = () => { setS(EMPTY); if (fileRef.current) fileRef.current.value = ""; };

  const onFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target?.result as string);
      setS({ state: "preview", rows, headers, valErrs: validate(rows), result: null, apiErr: null });
    };
    reader.readAsText(file);
  }, [validate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f);
  }, [onFile]);

  const doImport = async () => {
    const batchRef = `IMP-${Date.now()}`;
    setS((c) => ({ ...c, state: "importing", apiErr: null }));
    try {
      const res  = await fetch(apiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apiBody(s.rows, batchRef)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setS((c) => ({ ...c, state: "done", result: { created: data.created, errors: data.errors ?? [] } }));
    } catch (e) { setS((c) => ({ ...c, state: "preview", apiErr: e instanceof Error ? e.message : String(e) })); }
  };

  const errRows = new Set(s.valErrs.map((e) => e.row));
  const ready   = s.state === "preview" && s.rows.length > 0 && s.valErrs.length === 0;

  return (
    <div className="flex flex-col h-full gap-3">

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => downloadCSV(templateFilename, headerLine, sampleLine)}
          className="flex items-center gap-1.5 rounded-lg border border-[#d8decf] bg-white px-3 py-1.5 text-xs font-semibold text-[#536251] hover:bg-[#f3f6ef] transition-colors"
        >
          <Download size={11} /> Template
        </button>
        <button
          onClick={() => setGd((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${guide_ ? "border-[#16a34a] bg-[#f0fdf4] text-[#15803d]" : "border-[#d8decf] bg-white text-[#536251] hover:bg-[#f3f6ef]"}`}
        >
          <HelpCircle size={11} /> Columns
        </button>
        {s.state !== "idle" && (
          <button onClick={reset} className="ml-auto flex items-center gap-1 text-xs text-[#9aad9c] hover:text-[#536251] transition-colors">
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>

      {/* Column guide — inline, compact */}
      {guide_ && (
        <div className="rounded-lg border border-[#e2e8d9] bg-[#f8fbf5] overflow-auto" style={{ maxHeight: 160 }}>
          <table className="w-full text-[11px]">
            <tbody>
              {guide.map((g) => (
                <tr key={g.col} className="border-b border-[#eef3e8] last:border-0">
                  <td className="px-2.5 py-1 font-mono text-[#172018] font-semibold w-44 whitespace-nowrap">{g.col}</td>
                  <td className="px-2.5 py-1 text-[#60735d]">{g.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drop zone */}
      {s.state === "idle" && (
        <div
          onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#c8d4c0] bg-[#fafcf8] transition-colors hover:border-[#16a34a] hover:bg-[#f0f7ed] min-h-25"
        >
          <Upload size={18} className="mb-1.5 text-[#9aad9c]" />
          <p className="text-xs font-semibold text-[#536251]">Drop CSV or click to browse</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </div>
      )}

      {/* Preview state */}
      {(s.state === "preview" || s.state === "importing") && (
        <div className="flex flex-col flex-1 gap-2 min-h-0">
          {/* Status bar */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${s.valErrs.length > 0 ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#f0fdf4] text-[#15803d]"}`}>
            {s.valErrs.length > 0
              ? <><AlertCircle size={13} /> {s.rows.length} rows · {s.valErrs.length} error{s.valErrs.length !== 1 ? "s" : ""}</>
              : <><CheckCircle2 size={13} /> {s.rows.length} rows · ready to import</>
            }
          </div>

          {/* Validation errors */}
          {s.valErrs.length > 0 && (
            <div className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[11px] text-[#b91c1c] space-y-0.5 overflow-auto" style={{ maxHeight: 80 }}>
              {s.valErrs.map((e, i) => <p key={i}><span className="font-mono">Row {e.row}:</span> {e.message}</p>)}
            </div>
          )}

          {/* Preview table */}
          <div className="flex-1 overflow-auto rounded-lg border border-[#e2e8d9] min-h-0" style={{ maxHeight: 240 }}>
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#f3f6ef] border-b border-[#d8decf]">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[#536251] font-semibold w-8">#</th>
                  {s.headers.map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left text-[#536251] font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((row, i) => {
                  const rn = i + 2; const isErr = errRows.has(rn);
                  return (
                    <tr key={i} className={`border-b border-[#f0f4eb] ${isErr ? "bg-[#fef2f2]" : "hover:bg-[#fafcf8]"}`}>
                      <td className={`px-2 py-1 font-mono ${isErr ? "text-[#dc2626] font-bold" : "text-[#9aad9c]"}`}>{rn}</td>
                      {s.headers.map((h) => (
                        <td key={h} className="px-2 py-1 text-[#172018] whitespace-nowrap max-w-28 overflow-hidden text-ellipsis">{row[h] ?? ""}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {s.apiErr && <p className="rounded-lg bg-[#fef2f2] px-3 py-1.5 text-xs text-[#dc2626]">{s.apiErr}</p>}

          <button
            onClick={doImport}
            disabled={!ready || s.state === "importing"}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition-all ${ready && s.state !== "importing" ? "hover:opacity-90" : "opacity-40 cursor-not-allowed"}`}
            style={{ background: ready && s.state !== "importing" ? accent : "#9ca3af" }}
          >
            {s.state === "importing" ? <><Loader2 size={13} className="animate-spin" /> Importing…</> : <>Import {s.rows.length} rows</>}
          </button>
        </div>
      )}

      {/* Done */}
      {s.state === "done" && s.result && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-center">
            <CheckCircle2 size={22} className="mx-auto mb-1.5 text-[#16a34a]" />
            <p className="font-black text-2xl text-[#15803d]">{s.result.created}</p>
            <p className="text-xs text-[#16a34a]">records created</p>
          </div>
          {s.result.errors.length > 0 && (
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-xs text-[#b91c1c] overflow-auto" style={{ maxHeight: 120 }}>
              <p className="font-semibold mb-1">{s.result.errors.length} skipped:</p>
              {s.result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2.5 text-xs text-[#1e40af]">
            <p className="font-semibold mb-1">Find your data:</p>
            <p>• Procurement → Model A (status: Draft)</p>
            <p>• Accounting → Journal / Trial Balance (set FY to All time)</p>
            <p>• Finance Flow → supplier payables</p>
          </div>
          <button onClick={reset} className="flex items-center justify-center gap-1.5 rounded-lg border border-[#d8decf] py-2 text-xs font-semibold text-[#536251] hover:bg-[#f3f6ef] transition-colors">
            <RotateCcw size={11} /> Import another file
          </button>
        </div>
      )}
    </div>
  );
}

// ── Admin Cleanup ─────────────────────────────────────────────────────────────

interface LotRow { id: string; document_ref: string; status: string; lot_date: string; supplier_name: string | null; vehicle_no: string | null; net_weight: number; gross_sale_value: number; }
interface LedgerE { id: string; entry_date: string; account_code: string; account_name: string; debit: number; credit: number; narration: string; }
interface PayoutE { id: string; payout_date: string; farmer_name: string; net_amount: number; payment_status: string; }
interface InvE    { id: string; invoice_no: string; status: string; amount_due: number; }
interface Detail  { lot: Record<string, unknown>; ledger: LedgerE[]; payouts: PayoutE[]; invoices: InvE[]; }

type DelMode = "settlement" | "full";

const ST: Record<string, string> = {
  Draft: "bg-[#fef9c3] text-[#a16207]", Approved: "bg-[#dbeafe] text-[#1d4ed8]",
  Settled: "bg-[#dcfce7] text-[#15803d]", Invoiced: "bg-[#ede9fe] text-[#6d28d9]",
  QualityHold: "bg-[#fee2e2] text-[#dc2626]",
};

function AdminCleanup({ isAdmin }: { isAdmin: boolean }) {
  const [lots, setLots]           = useState<LotRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [detail, setDetail]       = useState<Detail | null>(null);
  const [detLoading, setDetLoad]  = useState(false);
  const [mode, setMode]           = useState<DelMode>("settlement");
  const [confirm, setConfirm]     = useState("");
  const [deleting, setDeleting]   = useState(false);
  const [toast, setToast]         = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const loadLots = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/lot").then((r) => r.json()).then((d) => setLots(d.lots ?? [])).catch(() => setLots([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (isAdmin) loadLots(); }, [isAdmin, loadLots]);

  if (!isAdmin) return null;

  const filtered = lots.filter((l) => {
    const q = search.toLowerCase();
    return !q || l.document_ref.toLowerCase().includes(q) || (l.supplier_name ?? "").toLowerCase().includes(q) || (l.vehicle_no ?? "").toLowerCase().includes(q) || l.lot_date.includes(q);
  });

  const toggleRow = async (lot: LotRow) => {
    if (expanded === lot.id) { setExpanded(null); setDetail(null); setConfirm(""); setError(null); return; }
    setExpanded(lot.id); setDetail(null); setDetLoad(true); setConfirm(""); setError(null); setMode("settlement");
    try {
      const res = await fetch(`/api/admin/lot?id=${lot.id}`);
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDetail(d);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setDetLoad(false); }
  };

  const doDelete = async (lot: LotRow) => {
    if (confirm !== lot.document_ref) return;
    setDeleting(true); setError(null);
    try {
      const res  = await fetch(`/api/admin/lot?ref=${encodeURIComponent(lot.document_ref)}&mode=${mode}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setToast(data.message); setExpanded(null); setDetail(null); setConfirm("");
      loadLots();
      setTimeout(() => setToast(null), 5000);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setDeleting(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      {toast && (
        <div className="flex items-center gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-xs text-[#15803d]">
          <CheckCircle2 size={13} /> {toast}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO, supplier, vehicle, date…"
          className="w-full rounded-lg border border-[#e5e7eb] bg-white pl-8 pr-3 py-2 text-xs outline-none focus:border-[#f87171] focus:ring-2 focus:ring-red-50 transition-all"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-xs text-[#9ca3af]"><Loader2 size={13} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-xl border border-[#e5e7eb] overflow-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#f9fafb] border-b border-[#e5e7eb] z-10">
              <tr>
                {["#","PO Number","Date","Supplier","Vehicle","MT","Value","Status",""].map((h) => (
                  <th key={h} className="px-2.5 py-2 text-left text-[#6b7280] font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-[#9ca3af]">No lots found{search ? ` for "${search}"` : ""}</td></tr>
              )}
              {filtered.map((lot, i) => (
                <React.Fragment key={lot.id}>
                  <tr className={`border-b border-[#f3f4f6] transition-colors ${expanded === lot.id ? "bg-[#fef2f2]" : "hover:bg-[#fafafa]"}`}>
                    <td className="px-2.5 py-2 text-[#9ca3af] font-mono">{i + 1}</td>
                    <td className="px-2.5 py-2 font-mono font-semibold text-[#172018]">{lot.document_ref}</td>
                    <td className="px-2.5 py-2 text-[#374151] whitespace-nowrap">{lot.lot_date}</td>
                    <td className="px-2.5 py-2 text-[#374151] max-w-32 truncate">{lot.supplier_name ?? "—"}</td>
                    <td className="px-2.5 py-2 text-[#374151]">{lot.vehicle_no ?? "—"}</td>
                    <td className="px-2.5 py-2 text-right text-[#374151]">{lot.net_weight?.toFixed(2)}</td>
                    <td className="px-2.5 py-2 text-right text-[#374151]">{INR(lot.gross_sale_value ?? 0)}</td>
                    <td className="px-2.5 py-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${ST[lot.status] ?? "bg-[#f3f4f6] text-[#374151]"}`}>{lot.status}</span>
                    </td>
                    <td className="px-2.5 py-2">
                      <button onClick={() => toggleRow(lot)}
                        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${expanded === lot.id ? "bg-[#fecaca] text-[#dc2626]" : "border border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2]"}`}>
                        {expanded === lot.id ? <><X size={10} /> Close</> : <><Trash2 size={10} /> Review</>}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === lot.id && (
                    <tr className="bg-[#fffbfb]">
                      <td colSpan={9} className="px-4 py-4 border-b border-[#fecaca]">
                        {detLoading && <div className="flex items-center gap-2 text-xs text-[#9ca3af]"><Loader2 size={13} className="animate-spin" /> Loading details…</div>}
                        {error && <p className="text-xs text-[#dc2626]">{error}</p>}

                        {detail && !detLoading && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left: ledger + payouts */}
                            <div className="space-y-3">
                              {/* Summary chips */}
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { label: "Ledger entries", val: `${detail.ledger.length}` },
                                  { label: "Payouts", val: `${detail.payouts.length}` },
                                  { label: "Invoices", val: `${detail.invoices.length}` },
                                  { label: "Net weight", val: `${lot.net_weight?.toFixed(3)} MT` },
                                  { label: "Sale value", val: INR(lot.gross_sale_value) },
                                ].map((c) => (
                                  <div key={c.label} className="rounded-lg border border-[#fecaca] bg-white px-2.5 py-1.5">
                                    <p className="text-[10px] text-[#9ca3af]">{c.label}</p>
                                    <p className="text-xs font-bold text-[#172018]">{c.val}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Ledger mini-table */}
                              {detail.ledger.length > 0 && (
                                <div className="rounded-lg border border-[#e5e7eb] overflow-auto" style={{ maxHeight: 160 }}>
                                  <table className="w-full text-[11px]">
                                    <thead className="sticky top-0 bg-[#f9fafb] border-b border-[#e5e7eb]">
                                      <tr>{["Date","Acct","Narration","Dr","Cr"].map(h => <th key={h} className="px-2 py-1 text-left text-[#6b7280] font-semibold whitespace-nowrap">{h}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                      {detail.ledger.map((e) => (
                                        <tr key={e.id} className="border-b border-[#f3f4f6]">
                                          <td className="px-2 py-1 whitespace-nowrap text-[#374151]">{e.entry_date}</td>
                                          <td className="px-2 py-1 font-mono text-[#172018]">{e.account_code}</td>
                                          <td className="px-2 py-1 text-[#6b7280] max-w-40 truncate">{e.narration}</td>
                                          <td className="px-2 py-1 text-right text-[#16a34a] font-semibold whitespace-nowrap">{e.debit > 0 ? INR(e.debit) : ""}</td>
                                          <td className="px-2 py-1 text-right text-[#dc2626] font-semibold whitespace-nowrap">{e.credit > 0 ? INR(e.credit) : ""}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {detail.invoices.length > 0 && (
                                <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-1.5 text-[11px] text-[#92400e]">
                                  Linked invoices: {detail.invoices.map(i => `${i.invoice_no} (${i.status})`).join(", ")} — will be unlinked on delete
                                </p>
                              )}
                            </div>

                            {/* Right: delete controls */}
                            <div className="space-y-3">
                              <p className="text-xs font-bold text-[#7f1d1d]">Delete options</p>

                              {/* Mode */}
                              <div className="grid grid-cols-2 gap-2">
                                {(["settlement", "full"] as DelMode[]).map((m) => (
                                  <button key={m} onClick={() => { setMode(m); setConfirm(""); }}
                                    className={`rounded-lg border-2 p-2.5 text-left transition-all ${mode === m ? "border-[#dc2626] bg-[#fef2f2]" : "border-[#e5e7eb] hover:border-[#fca5a5]"}`}>
                                    <p className={`text-[11px] font-bold ${mode === m ? "text-[#dc2626]" : "text-[#374151]"}`}>
                                      {m === "settlement" ? "Clear settlement" : "Delete entire lot"}
                                    </p>
                                    <p className="text-[10px] text-[#9ca3af] mt-0.5">
                                      {m === "settlement" ? "Keeps lot as Draft. Re-settle." : "Full delete. Re-import."}
                                    </p>
                                  </button>
                                ))}
                              </div>

                              {/* Confirm */}
                              <div className="rounded-lg border border-[#fecaca] bg-white p-3 space-y-2">
                                <p className="text-[11px] text-[#374151]">
                                  Type <span className="font-mono font-bold text-[#dc2626]">{lot.document_ref}</span> to confirm:
                                </p>
                                <input value={confirm} onChange={(e) => setConfirm(e.target.value)}
                                  placeholder={lot.document_ref}
                                  className="w-full rounded-lg border border-[#fca5a5] bg-white px-2.5 py-2 text-xs font-mono outline-none focus:border-[#dc2626] focus:ring-2 focus:ring-red-100"
                                />
                                <button onClick={() => doDelete(lot)}
                                  disabled={confirm !== lot.document_ref || deleting}
                                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  style={{ background: confirm === lot.document_ref ? "#dc2626" : "#9ca3af" }}>
                                  {deleting ? <><Loader2 size={12} className="animate-spin" /> Deleting…</> : <><Trash2 size={12} /> {mode === "full" ? "Delete lot" : "Clear settlement"}</>}
                                </button>
                              </div>

                              {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="sticky bottom-0 border-t border-[#e5e7eb] bg-[#f9fafb] px-3 py-1.5 text-[11px] text-[#9ca3af]">
              {filtered.length} lot{filtered.length !== 1 ? "s" : ""}{search ? ` · filtered` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "lots" | "payments" | "cleanup";

export default function ImportPage() {
  const [tab, setTab]       = useState<Tab>("lots");
  const [isAdmin, setAdmin] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem("erp_auth"); if (s) setAdmin(JSON.parse(s)?.role === "Admin"); } catch { /* */ }
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "lots",     label: "Lots",     icon: <FileSpreadsheet size={13} /> },
    { id: "payments", label: "Payments", icon: <Banknote size={13} /> },
    { id: "cleanup",  label: "Cleanup",  icon: <ShieldAlert size={13} />, adminOnly: true },
  ];

  return (
    <div className="flex flex-col gap-0" style={{ height: "calc(100vh - 88px)" }}>

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-black text-[#172018]">Bulk Import</h1>
          <p className="text-xs text-[#60735d]">Model A · Sarvani Biofuels · kg input → MT stored</p>
        </div>
        {isAdmin && (
          <span className="rounded-full border border-[#fca5a5] bg-[#fef2f2] px-2.5 py-1 text-[11px] font-bold text-[#dc2626]">Admin mode</span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-[#e2e8d9] mb-4">
        {tabs.filter((t) => !t.adminOnly || isAdmin).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
              tab === t.id
                ? t.id === "cleanup" ? "border-[#dc2626] text-[#dc2626]" : "border-[#16a34a] text-[#172018]"
                : "border-transparent text-[#60735d] hover:text-[#172018]"
            }`}>
            {t.icon} {t.label}
            {t.id === "cleanup" && <span className="ml-1 rounded-full bg-[#fecaca] px-1.5 py-0.5 text-[9px] font-bold text-[#dc2626]">ADMIN</span>}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "lots" && (
          <ImportPanel
            label="Lots"
            headerLine={LOT_HEADER}
            sampleLine={LOT_SAMPLE}
            templateFilename="akshaya_lots_template.csv"
            guide={LOT_GUIDE}
            validate={validateLotRows}
            apiEndpoint="/api/import/lots"
            apiBody={(rows, batchRef) => ({ rows, batchRef })}
            accent="#16a34a"
          />
        )}
        {tab === "payments" && (
          <ImportPanel
            label="Payments"
            headerLine={PAY_HEADER}
            sampleLine={PAY_SAMPLE}
            templateFilename="akshaya_payments_template.csv"
            guide={PAY_GUIDE}
            validate={validatePaymentRows}
            apiEndpoint="/api/import/vouchers"
            apiBody={(rows, batchRef) => ({
              rows: rows.map((r) => ({
                date: r.date, party_name: r.supplier, amount: r.amount,
                payment_mode: r.transaction_type || "NEFT",
                bank_ref: r.bank_ref || "",
                narration: [r.receiver_name, r.narration].filter(Boolean).join(" · "),
              })),
              voucherType: "Payment", batchRef,
            })}
            accent="#2563eb"
          />
        )}
        {tab === "cleanup" && isAdmin && <AdminCleanup isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
