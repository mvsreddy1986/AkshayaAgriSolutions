"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Upload, Download, CheckCircle2, AlertCircle, Loader2,
  FileSpreadsheet, Banknote, X, ChevronDown, ChevronRight,
  RotateCcw, Info,
} from "lucide-react";

// ── CSV utilities ─────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = !inQ; }
      } else if (line[i] === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += line[i]; }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(lines[0]);
  const rows    = lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = parseRow(line);
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").trim()]));
    });
  return { headers, rows };
}

function downloadCSV(filename: string, headerRow: string, sampleRow: string) {
  const csv  = `${headerRow}\n${sampleRow}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ── Validation ────────────────────────────────────────────────────────────────

interface RowError { row: number; message: string }

function validateLotRows(rows: Record<string, string>[]): RowError[] {
  const errs: RowError[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const n = i + 2;
    if (!r.po_number?.trim())       errs.push({ row: n, message: "po_number is required" });
    else if (seen.has(r.po_number)) errs.push({ row: n, message: `po_number "${r.po_number}" is duplicate in this file` });
    else                            seen.add(r.po_number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.unloading_date ?? ""))
      errs.push({ row: n, message: "unloading_date must be YYYY-MM-DD (e.g. 2025-04-01)" });
    if (!(parseFloat(r.net_wt_kg) > 0))          errs.push({ row: n, message: "net_wt_kg must be a positive number" });
    if (!(parseFloat(r.po_rate_per_kg) > 0))      errs.push({ row: n, message: "po_rate_per_kg must be > 0" });
    if (!(parseFloat(r.supplier_rate_per_kg) > 0)) errs.push({ row: n, message: "supplier_rate_per_kg must be > 0" });
  });
  return errs;
}

function validatePaymentRows(rows: Record<string, string>[]): RowError[] {
  const errs: RowError[] = [];
  rows.forEach((r, i) => {
    const n = i + 2;
    if (!r.supplier?.trim()) errs.push({ row: n, message: "supplier is required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? ""))
      errs.push({ row: n, message: "date must be YYYY-MM-DD" });
    if (!(parseFloat(r.amount) > 0)) errs.push({ row: n, message: "amount must be > 0" });
  });
  return errs;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const LOT_HEADER  = "po_number,unloading_date,vehicle_no,supplier,net_wt_kg,po_rate_per_kg,supplier_rate_per_kg,cess_paid_rs,balance_cess_rs,moisture_pct,mc_deduction_rs,status";
const LOT_SAMPLE  = "PO-2025-001,2025-04-01,AP39AB1234,Ravi Traders,9500,22.50,22.00,950,1000,15.5,2000,Settled";

const PAY_HEADER  = "po_number,date,supplier,receiver_name,transaction_type,amount,bank_ref,narration";
const PAY_SAMPLE  = "PO-2025-001,2025-04-05,Ravi Traders,Ravi Kumar,NEFT,200000,UTR123456789,Payment for April lot";

// ── Import state machine per card ─────────────────────────────────────────────

type CardState = "idle" | "preview" | "importing" | "done";

interface ImportResult {
  created: number;
  errors:  string[];
}

interface CardData {
  state:   CardState;
  rows:    Record<string, string>[];
  headers: string[];
  valErrs: RowError[];
  result:  ImportResult | null;
  apiErr:  string | null;
}

const EMPTY_CARD: CardData = {
  state: "idle", rows: [], headers: [], valErrs: [], result: null, apiErr: null,
};

// ── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ headers, rows, valErrs }: { headers: string[]; rows: Record<string, string>[]; valErrs: RowError[] }) {
  const [show, setShow] = useState(false);
  const errRows = new Set(valErrs.map((e) => e.row));
  const preview = rows.slice(0, 10);
  return (
    <div className="mt-3">
      <button onClick={() => setShow((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#60735d] hover:text-[#172018] transition-colors">
        {show ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {show ? "Hide" : "Show"} preview ({rows.length} rows)
      </button>
      {show && (
        <div className="mt-2 overflow-auto rounded-lg border border-[#d8decf]" style={{ maxHeight: 260 }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#d8decf] bg-[#f3f6ef]">
                <th className="px-2 py-1.5 text-left text-[#536251] font-semibold">#</th>
                {headers.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left text-[#536251] font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => {
                const rowNum = i + 2;
                const hasErr = errRows.has(rowNum);
                return (
                  <tr key={i} className={`border-b border-[#eef3e8] ${hasErr ? "bg-[#fef2f2]" : "hover:bg-[#fafcf8]"}`}>
                    <td className={`px-2 py-1 font-mono ${hasErr ? "text-[#dc2626] font-bold" : "text-[#9aad9c]"}`}>{rowNum}</td>
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1 text-[#172018] whitespace-nowrap max-w-32 overflow-hidden text-ellipsis">{row[h] ?? ""}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 10 && (
            <div className="border-t border-[#eef3e8] bg-[#f8fbf5] px-3 py-2 text-xs text-[#9aad9c]">
              + {rows.length - 10} more rows (not shown)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main import card ──────────────────────────────────────────────────────────

interface ImportCardProps {
  title:      string;
  subtitle:   string;
  icon:       React.ReactNode;
  color:      string;           // tailwind text color
  borderColor:string;           // border-left color hex
  bgChip:     string;           // badge bg
  headerLine: string;
  sampleLine: string;
  templateFilename: string;
  validate:   (rows: Record<string, string>[]) => RowError[];
  apiEndpoint:string;
  apiBody:    (rows: Record<string, string>[], batchRef: string) => object;
  columnGuide: { col: string; desc: string }[];
}

function ImportCard(props: ImportCardProps) {
  const {
    title, subtitle, icon, color, borderColor, bgChip,
    headerLine, sampleLine, templateFilename,
    validate, apiEndpoint, apiBody, columnGuide,
  } = props;

  const [card, setCard]       = useState<CardData>(EMPTY_CARD);
  const [showGuide, setShowGuide] = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);

  const reset = () => { setCard(EMPTY_CARD); if (fileRef.current) fileRef.current.value = ""; };

  const onFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target?.result as string);
      const valErrs = validate(rows);
      setCard({ state: "preview", rows, headers, valErrs, result: null, apiErr: null });
    };
    reader.readAsText(file);
  }, [validate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const doImport = async () => {
    if (card.valErrs.length > 0) return;
    const batchRef = `IMP-${Date.now()}`;
    setCard((c) => ({ ...c, state: "importing", apiErr: null }));
    try {
      const res  = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody(card.rows, batchRef)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setCard((c) => ({ ...c, state: "done", result: { created: data.created, errors: data.errors ?? [] } }));
    } catch (e) {
      setCard((c) => ({
        ...c, state: "preview",
        apiErr: e instanceof Error ? e.message : String(e),
      }));
    }
  };

  const isReady   = card.state === "preview" && card.rows.length > 0 && card.valErrs.length === 0;
  const hasErrors = card.valErrs.length > 0;

  return (
    <div className="flex flex-col rounded-2xl border border-[#d8decf] bg-white overflow-hidden shadow-sm" style={{ borderLeft: `4px solid ${borderColor}` }}>
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#eef3e8]">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgChip}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#172018]">{title}</h3>
          <p className="text-xs text-[#60735d] mt-0.5">{subtitle}</p>
        </div>
        {card.state !== "idle" && (
          <button onClick={reset} className="text-[#9aad9c] hover:text-[#536251] transition-colors">
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 p-5 grid gap-4">
        {/* Step 1 — Template */}
        <div className="flex items-center gap-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${bgChip} ${color}`}>1</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#172018]">Download template</p>
            <p className="text-xs text-[#9aad9c]">Fill your data using the exact column names below</p>
          </div>
          <button
            onClick={() => downloadCSV(templateFilename, headerLine, sampleLine)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#c8d4c0] bg-white px-3 py-1.5 text-xs font-semibold text-[#536251] hover:bg-[#f3f6ef] transition-colors"
          >
            <Download size={12} /> Template
          </button>
        </div>

        {/* Column guide */}
        <button
          onClick={() => setShowGuide((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-[#60735d] hover:text-[#172018] transition-colors ml-9"
        >
          <Info size={11} />
          {showGuide ? "Hide" : "Show"} column guide
        </button>
        {showGuide && (
          <div className="ml-9 rounded-lg border border-[#eef3e8] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#f3f6ef]">
                  <th className="px-3 py-1.5 text-left text-[#536251] font-semibold">Column</th>
                  <th className="px-3 py-1.5 text-left text-[#536251] font-semibold">What to enter</th>
                </tr>
              </thead>
              <tbody>
                {columnGuide.map((g) => (
                  <tr key={g.col} className="border-t border-[#eef3e8]">
                    <td className="px-3 py-1.5 font-mono text-[#172018]">{g.col}</td>
                    <td className="px-3 py-1.5 text-[#536251]">{g.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Step 2 — Upload */}
        <div className="flex items-center gap-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${bgChip} ${color}`}>2</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#172018]">Upload your CSV</p>
            <p className="text-xs text-[#9aad9c]">Save your Excel as CSV first, then upload here</p>
          </div>
        </div>

        {card.state === "idle" && (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="ml-9 cursor-pointer rounded-xl border-2 border-dashed border-[#c8d4c0] bg-[#fafcf8] p-6 text-center transition-colors hover:border-[#16a34a] hover:bg-[#f0f7ed]"
          >
            <Upload size={20} className="mx-auto mb-2 text-[#9aad9c]" />
            <p className="text-sm font-semibold text-[#536251]">Drop CSV here or click to browse</p>
            <p className="mt-1 text-xs text-[#9aad9c]">.csv files only</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </div>
        )}

        {/* Step 3 — Preview & validate */}
        {(card.state === "preview" || card.state === "importing") && (
          <>
            <div className="ml-9 rounded-xl border border-[#d8decf] bg-[#fafcf8] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#172018]">{card.rows.length} rows loaded</p>
                  {hasErrors
                    ? <p className="text-xs text-[#dc2626] mt-0.5">{card.valErrs.length} validation error{card.valErrs.length !== 1 ? "s" : ""} — fix and re-upload</p>
                    : <p className="text-xs text-[#16a34a] mt-0.5">All rows valid — ready to import</p>
                  }
                </div>
                {hasErrors
                  ? <AlertCircle size={18} className="shrink-0 text-[#dc2626]" />
                  : <CheckCircle2 size={18} className="shrink-0 text-[#16a34a]" />
                }
              </div>

              {hasErrors && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-[#fef2f2] p-2.5 text-xs text-[#b91c1c] space-y-0.5">
                  {card.valErrs.map((e, i) => (
                    <p key={i}><span className="font-mono">Row {e.row}:</span> {e.message}</p>
                  ))}
                </div>
              )}

              <PreviewTable headers={card.headers} rows={card.rows} valErrs={card.valErrs} />
            </div>

            {card.apiErr && (
              <p className="ml-9 rounded-lg bg-[#fef2f2] px-3 py-2 text-xs text-[#dc2626]">{card.apiErr}</p>
            )}

            <div className="ml-9 flex items-center gap-2">
              <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-[#d8decf] px-3 py-2 text-xs font-semibold text-[#536251] hover:bg-[#f3f6ef] transition-colors">
                <X size={12} /> Clear
              </button>
              <button
                onClick={doImport}
                disabled={!isReady || card.state === "importing"}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all ${isReady && card.state !== "importing" ? "bg-[#16a34a] hover:bg-[#15803d]" : "bg-[#9aad9c] cursor-not-allowed"}`}
              >
                {card.state === "importing"
                  ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
                  : <>Import {card.rows.length} rows</>
                }
              </button>
            </div>
          </>
        )}

        {/* Done */}
        {card.state === "done" && card.result && (
          <div className="ml-9 space-y-3">
            <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-[#16a34a]" />
                <p className="font-bold text-[#15803d]">Import complete</p>
              </div>
              <p className="text-sm text-[#15803d]">
                <span className="font-black text-xl">{card.result.created}</span> records created successfully
              </p>
            </div>
            {card.result.errors.length > 0 && (
              <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3">
                <p className="text-xs font-semibold text-[#dc2626] mb-1">{card.result.errors.length} rows had errors:</p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {card.result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-[#b91c1c]">{e}</p>
                  ))}
                </div>
              </div>
            )}
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-[#60735d] hover:text-[#172018] transition-colors">
              <RotateCcw size={12} /> Import another file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary tiles (computed from rows before import) ──────────────────────────

function LotSummaryTiles({ rows }: { rows: Record<string, string>[] }) {
  if (!rows.length) return null;
  const totalRevenue  = rows.reduce((s, r) => s + (parseFloat(r.net_wt_kg) || 0) * (parseFloat(r.po_rate_per_kg) || 0), 0);
  const totalNetPay   = rows.reduce((s, r) => {
    const D = (parseFloat(r.net_wt_kg) || 0) * (parseFloat(r.supplier_rate_per_kg) || 0);
    const G = D - (parseFloat(r.balance_cess_rs) || 0) - (parseFloat(r.mc_deduction_rs) || 0);
    return s + G;
  }, 0);
  const totalMargin   = totalRevenue - totalNetPay;
  const totalWtMT     = rows.reduce((s, r) => s + (parseFloat(r.net_wt_kg) || 0) / 1000, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {[
        { label: "Sarvani Revenue", value: inr(totalRevenue), color: "#16a34a" },
        { label: "Supplier Payable", value: inr(totalNetPay), color: "#2563eb" },
        { label: "Akshaya Margin", value: inr(totalMargin), color: "#d97706" },
        { label: "Total Volume", value: `${totalWtMT.toFixed(2)} MT`, color: "#7c3aed" },
      ].map((t) => (
        <div key={t.label} className="rounded-xl border border-[#d8decf] bg-white p-3.5" style={{ borderLeft: `3px solid ${t.color}` }}>
          <p className="text-xs text-[#60735d]">{t.label}</p>
          <p className="mt-1 text-base font-black text-[#172018]">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

function PaySummaryTiles({ rows }: { rows: Record<string, string>[] }) {
  if (!rows.length) return null;
  const total    = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const bySupplier = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.supplier] = (acc[r.supplier] || 0) + (parseFloat(r.amount) || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
      <div className="rounded-xl border border-[#d8decf] bg-white p-3.5" style={{ borderLeft: "3px solid #2563eb" }}>
        <p className="text-xs text-[#60735d]">Total payments</p>
        <p className="mt-1 text-base font-black text-[#172018]">{inr(total)}</p>
        <p className="text-xs text-[#9aad9c] mt-0.5">{rows.length} transactions</p>
      </div>
      <div className="rounded-xl border border-[#d8decf] bg-white p-3.5" style={{ borderLeft: "3px solid #7c3aed" }}>
        <p className="text-xs text-[#60735d] mb-1.5">Top suppliers</p>
        {bySupplier.map(([name, amt]) => (
          <div key={name} className="flex items-center justify-between text-xs">
            <span className="text-[#536251] truncate max-w-28">{name}</span>
            <span className="font-semibold text-[#172018]">{inr(amt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [lotRows, setLotRows]   = useState<Record<string, string>[]>([]);
  const [payRows, setPayRows]   = useState<Record<string, string>[]>([]);

  return (
    <div className="grid gap-6">

      {/* Hero */}
      <div className="rounded-2xl border border-[#d8decf] bg-gradient-to-br from-[#f0f7ed] to-[#e8f5e2] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#172018]">Bulk Data Import</h1>
            <p className="mt-1 text-sm text-[#536251]">
              Bring your historical Model A business into the ERP — lots, settlements, and supplier payments.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#bbf7d0] bg-white px-3 py-1.5 text-xs font-bold text-[#15803d]">
              Model A · Sarvani Biofuels
            </span>
            <span className="rounded-full border border-[#fef9c3] bg-white px-3 py-1.5 text-xs font-bold text-[#a16207]">
              Step 1: Lots → Step 2: Payments
            </span>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { step: "1", title: "Download template", body: "Get the CSV template. Copy your data from Excel — minimal reformatting needed." },
            { step: "2", title: "Upload & preview", body: "Upload the CSV. We validate every row and show errors before anything is written." },
            { step: "3", title: "Import & settle", body: "Lots are created, settlement entries posted to ledger, and supplier payables recorded." },
          ].map((s) => (
            <div key={s.step} className="flex gap-3 rounded-xl bg-white/60 p-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#172018] text-xs font-black text-white">{s.step}</span>
              <div>
                <p className="text-xs font-bold text-[#172018]">{s.title}</p>
                <p className="mt-0.5 text-xs text-[#60735d]">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Important notes */}
      <div className="rounded-xl border border-[#fef3c7] bg-[#fffbeb] px-4 py-3 text-xs text-[#92400e] flex items-start gap-2">
        <Info size={14} className="shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Before importing:</span> Ensure your suppliers exist in Master Data → Parties.
          If a supplier name in the CSV doesn't match exactly, the lot is still created but the party link will be blank.
          Rates in your Excel are in <strong>₹/kg</strong> — the ERP converts to ₹/MT automatically.
          Weights in your Excel are in <strong>kg</strong> — stored as MT in the ERP.
          Import lots first, then payments.
        </div>
      </div>

      {/* ── Lots card ── */}
      <section>
        <h2 className="mb-3 text-base font-bold text-[#172018] flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-[#16a34a]" />
          Step 1 — Lot register (Red file)
        </h2>
        <LotSummaryTiles rows={lotRows} />
        <ImportCard
          title="Inward Lots — Model A"
          subtitle="One row per PO / challan · Weights in kg · Rates in ₹/kg"
          icon={<FileSpreadsheet size={18} className="text-[#16a34a]" />}
          color="text-[#16a34a]"
          borderColor="#16a34a"
          bgChip="bg-[#dcfce7]"
          headerLine={LOT_HEADER}
          sampleLine={LOT_SAMPLE}
          templateFilename="akshaya_lots_template.csv"
          validate={(rows) => { setLotRows(rows); return validateLotRows(rows); }}
          apiEndpoint="/api/import/lots"
          apiBody={(rows, batchRef) => ({ rows, batchRef })}
          columnGuide={[
            { col: "po_number",            desc: "Your PO number — must be unique (e.g. PO-2025-001)" },
            { col: "unloading_date",       desc: "Date in YYYY-MM-DD format (e.g. 2025-04-01)" },
            { col: "vehicle_no",           desc: "Vehicle registration number" },
            { col: "supplier",             desc: "Supplier name — must match exactly with Parties master" },
            { col: "net_wt_kg",            desc: "Net weight in kilograms (e.g. 9500 for 9.5 MT)" },
            { col: "po_rate_per_kg",       desc: "PO Rate — what Sarvani pays you per kg (e.g. 22.50)" },
            { col: "supplier_rate_per_kg", desc: "Rate per kg (B) — what you pay supplier (e.g. 22.00)" },
            { col: "cess_paid_rs",         desc: "Cess already paid at gate in ₹ (column C)" },
            { col: "balance_cess_rs",      desc: "Balance cess deducted from supplier ₹ (column E)" },
            { col: "moisture_pct",         desc: "Moisture % reading (e.g. 15.5)" },
            { col: "mc_deduction_rs",      desc: "Moisture content deduction from supplier in ₹ (column F)" },
            { col: "status",               desc: "Settled (for historical settled lots) or Approved or Draft" },
          ]}
        />
      </section>

      {/* ── Payments card ── */}
      <section>
        <h2 className="mb-3 text-base font-bold text-[#172018] flex items-center gap-2">
          <Banknote size={16} className="text-[#2563eb]" />
          Step 2 — Supplier payments (Yellow file)
        </h2>
        <PaySummaryTiles rows={payRows} />
        <ImportCard
          title="Supplier Payments"
          subtitle="One row per bank transfer · Amount in ₹"
          icon={<Banknote size={18} className="text-[#2563eb]" />}
          color="text-[#2563eb]"
          borderColor="#2563eb"
          bgChip="bg-[#dbeafe]"
          headerLine={PAY_HEADER}
          sampleLine={PAY_SAMPLE}
          templateFilename="akshaya_payments_template.csv"
          validate={(rows) => { setPayRows(rows); return validatePaymentRows(rows); }}
          apiEndpoint="/api/import/vouchers"
          apiBody={(rows, batchRef) => ({
            rows: rows.map((r) => ({
              date:         r.date,
              party_name:   r.supplier,
              amount:       r.amount,
              payment_mode: r.transaction_type || "NEFT",
              bank_ref:     r.bank_ref || "",
              narration:    [r.receiver_name, r.narration].filter(Boolean).join(" · "),
            })),
            voucherType: "Payment",
            batchRef,
          })}
          columnGuide={[
            { col: "po_number",        desc: "PO number this payment relates to (for reference)" },
            { col: "date",             desc: "Payment date YYYY-MM-DD (e.g. 2025-04-05)" },
            { col: "supplier",         desc: "Supplier company name" },
            { col: "receiver_name",    desc: "Individual receiver name (as in your Yellow file)" },
            { col: "transaction_type", desc: "NEFT / RTGS / IMPS / UPI" },
            { col: "amount",           desc: "Amount paid in ₹ (e.g. 200000)" },
            { col: "bank_ref",         desc: "UTR / reference number from bank" },
            { col: "narration",        desc: "Your note — kept for audit trail" },
          ]}
        />
      </section>

      {/* What happens next */}
      <div className="rounded-2xl border border-[#d8decf] bg-white p-5">
        <h3 className="font-bold text-[#172018] mb-3">What happens after import</h3>
        <div className="grid gap-2 sm:grid-cols-2 text-xs text-[#536251]">
          {[
            "Lots appear in the Procurement tab with status Settled",
            "Ledger entries posted: Dr 1201 AR / Cr 3100 Revenue + Dr 5001 / Cr 2101 Supplier AP",
            "Akshaya's margin (rate spread + deductions) posted to Cr 3200",
            "Supplier payout obligations created — visible in Finance Flow",
            "Payment vouchers posted: Dr 2101 Supplier AP / Cr 1100 Bank",
            "All data visible in Reports, Finance Flow, and Accounting tabs immediately",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-[#16a34a]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
