"use client";

import { useState, useEffect, useCallback } from "react";
import type { LotStatus, InwardLot, FarmerPayout, QualityRule } from "../../../lib/types";
import SettlementPreview from "../../../components/SettlementPreview";

const TABS = ["Model A", "Model B", "Weighment", "Settlements"] as const;
type Tab = (typeof TABS)[number];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

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
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

async function updateLotStatus(id: string, status: LotStatus) {
  await fetch(`/api/lots/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// ─── MODEL A ─────────────────────────────────────────────────────────────────

function ModelATab() {
  const [file, setFile] = useState<File | null>(null);
  const [parseState, setParseState] = useState<"idle" | "parsing" | "done">("idle");
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [batches, setBatches] = useState<{ id: string; batchRef: string; sourceFilename: string; reportDate: string; totalRows: number; mappedRows: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/lots?model=A").then((r) => r.json()),
      fetch("/api/import-batches?model=A").then((r) => r.json()),
    ]).then(([ls, bs]) => {
      setLots(Array.isArray(ls) ? ls : []);
      setBatches(Array.isArray(bs) ? bs : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(lot: InwardLot, next: LotStatus) {
    await updateLotStatus(lot.id, next);
    load();
  }

  const latestBatch = batches[0];

  return (
    <div className="grid gap-6">
      {/* Import panel */}
      <div className="rounded-xl border border-dashed border-[#aebba8] bg-white p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex-1">
            <h3 className="text-xl font-black">Upload Sarvani daily delivery report (PDF)</h3>
            <p className="mt-2 text-sm leading-6 text-[#60735d]">
              System parses vehicle number, material, gross weight, tare weight, accepted weight, moisture %, and FM % from the PDF. Each row becomes a draft inward lot for review.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div>
                <input type="file" accept=".pdf" id="pdf-upload" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
                <label htmlFor="pdf-upload" className="cursor-pointer rounded-md border border-[#c8d4c0] bg-[#f6faef] px-4 py-2.5 text-sm font-black hover:bg-[#eef3e8]">
                  {file ? file.name : "Choose PDF file"}
                </label>
              </div>
              <button
                onClick={() => { setParseState("parsing"); setTimeout(() => setParseState("done"), 1800); }}
                disabled={!file && parseState === "idle"}
                className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 hover:bg-[#2a3b29]"
              >
                {parseState === "parsing" ? "Parsing…" : parseState === "done" ? "Re-parse" : "Parse & Create Lots"}
              </button>
            </div>
          </div>
          {latestBatch && (
            <div className="rounded-lg border border-[#d8decf] bg-[#f8faf5] p-4 text-sm sm:w-56">
              <p className="font-black text-[#172018]">Latest import</p>
              <p className="mt-1 text-[#60735d]">{latestBatch.batchRef}</p>
              <p className="mt-1 text-[#60735d]">{latestBatch.totalRows} rows · {latestBatch.mappedRows} mapped</p>
              <StatusBadge status={latestBatch.status} />
            </div>
          )}
        </div>
        {parseState === "done" && (
          <div className="mt-4 rounded-lg bg-[#f0fdf4] p-4 text-sm text-[#15803d]">
            ✓ Lots parsed from PDF. Auto-matched to existing suppliers. Unmapped lots need manual mapping below.
          </div>
        )}
      </div>

      {/* Import batch history */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Import batch history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>{["Batch ref", "File", "Report date", "Rows", "Mapped", "Status", "Action"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black">{b.batchRef}</td>
                  <td className="px-5 py-3.5 text-[#536251] max-w-[200px] truncate">{b.sourceFilename}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{b.reportDate}</td>
                  <td className="px-5 py-3.5">{b.totalRows}</td>
                  <td className="px-5 py-3.5">
                    <span className={b.mappedRows === b.totalRows ? "text-[#15803d] font-bold" : "text-[#d97706] font-bold"}>
                      {b.mappedRows}/{b.totalRows}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-3.5"><button className="text-xs font-black text-[#172018] hover:underline">View lots</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inward lot queue */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Model A inward lot queue</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-[#60735d]">Loading lots…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Document ref", "Date", "Material", "Vehicle", "Accepted (MT)", "Moisture%", "FM%", "Supplier", "Farmer", "Net payable (MT)", "Value", "Status", "Action"].map((h) => <th key={h} className="px-4 py-3.5 shrink-0">{h}</th>)}</tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-4 py-3.5 font-black whitespace-nowrap">{lot.documentRef}</td>
                    <td className="px-4 py-3.5 text-[#536251] whitespace-nowrap">{lot.lotDate}</td>
                    <td className="px-4 py-3.5 text-[#536251]">{lot.materialName}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{lot.vehicleNo}</td>
                    <td className="px-4 py-3.5 font-bold">{lot.acceptedWeight.toFixed(2)}</td>
                    <td className="px-4 py-3.5">
                      {(() => { const v = Number(lot.qualityReadings["moisture_pct"] ?? 0); return <span className={`font-bold ${v > 15 ? "text-[#dc2626]" : "text-[#172018]"}`}>{v}%</span>; })()}
                    </td>
                    <td className="px-4 py-3.5">
                      {(() => { const v = Number(lot.qualityReadings["fm_pct"] ?? 0); return <span className={`font-bold ${v > 1.5 ? "text-[#dc2626]" : "text-[#172018]"}`}>{v}%</span>; })()}
                    </td>
                    <td className="px-4 py-3.5 text-[#536251]">{lot.supplierName ?? <span className="text-[#dc2626] font-bold">Unmapped</span>}</td>
                    <td className="px-4 py-3.5 text-[#536251]">{lot.farmerName ?? "—"}</td>
                    <td className="px-4 py-3.5 font-bold">{lot.netPayableWeight.toFixed(2)}</td>
                    <td className="px-4 py-3.5 font-bold whitespace-nowrap">{inr(lot.grossSaleValue)}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={lot.status} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2">
                        {lot.status === "Mapped" && (
                          <button onClick={() => handleStatusChange(lot, "Approved")} className="text-xs font-black text-[#15803d] hover:underline whitespace-nowrap">Approve</button>
                        )}
                        {lot.status === "Draft" && (
                          <button onClick={() => handleStatusChange(lot, "Mapped")} className="text-xs font-black text-[#172018] hover:underline">Map</button>
                        )}
                        {lot.status === "QualityHold" && (
                          <button onClick={() => handleStatusChange(lot, "Approved")} className="text-xs font-black text-[#d97706] hover:underline">Override</button>
                        )}
                        {!["Draft", "Mapped", "QualityHold"].includes(lot.status) && (
                          <button className="text-xs font-black text-[#172018] hover:underline">View</button>
                        )}
                      </div>
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

// ─── MODEL B ─────────────────────────────────────────────────────────────────

function ModelBTab() {
  const [file, setFile] = useState<File | null>(null);
  const [parseState, setParseState] = useState<"idle" | "parsing" | "done">("idle");
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/lots?model=B").then((r) => r.json())
      .then((data) => setLots(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#c8d4f0] bg-[#eff6ff] p-5">
        <h3 className="font-black text-[#1d4ed8]">Model B: Farmer Finance Flow</h3>
        <p className="mt-2 text-sm leading-6 text-[#1e3a8a]">
          In Model B, Akshaya pays farmers directly before receiving payment from Sarvani. This creates a <strong>Finance Advance Control account</strong> exposure. Each Excel row becomes a farmer finance record and contributes to a bulk Sarvani invoice.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-[#aebba8] bg-white p-6">
        <h3 className="text-xl font-black">Import farmer supply Excel</h3>
        <p className="mt-2 text-sm leading-6 text-[#60735d]">
          Expected columns: Farmer name, vehicle no, material, accepted weight (MT), rate (₹/MT), bank account, IFSC, Sarvani reference.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div>
            <input type="file" accept=".xlsx,.xls,.csv" id="excel-upload" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <label htmlFor="excel-upload" className="cursor-pointer rounded-md border border-[#c8d4c0] bg-[#f6faef] px-4 py-2.5 text-sm font-black hover:bg-[#eef3e8]">
              {file ? file.name : "Choose Excel / CSV"}
            </label>
          </div>
          <button
            onClick={() => { setParseState("parsing"); setTimeout(() => { setParseState("done"); load(); }, 1500); }}
            disabled={!file && parseState === "idle"}
            className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {parseState === "parsing" ? "Importing…" : parseState === "done" ? "Re-import" : "Import & Create Records"}
          </button>
        </div>
        {parseState === "done" && (
          <div className="mt-4 rounded-lg bg-[#f0fdf4] p-4 text-sm text-[#15803d]">
            ✓ Farmer records imported. Finance advance entries created. Ready to generate Sarvani bulk invoice.
          </div>
        )}
      </div>

      {!loading && lots.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h3 className="text-lg font-black">Model B inward lots</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Document ref", "Farmer", "Material", "Accepted (MT)", "Rate", "Value", "Finance payout", "Status"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-black">{lot.documentRef}</td>
                    <td className="px-5 py-3.5 font-bold">{lot.farmerName}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{lot.materialName}</td>
                    <td className="px-5 py-3.5 font-bold">{lot.acceptedWeight.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-[#536251]">₹{lot.grossSaleRate.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 font-bold">{inr(lot.grossSaleValue)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold text-[#1d4ed8]">{inr(lot.grossSaleValue * 0.97)}</span>
                      <span className="ml-1 text-xs text-[#60735d]">advance</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={lot.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WEIGHMENT ────────────────────────────────────────────────────────────────

function WeighmentTab() {
  const [previewLot, setPreviewLot] = useState<InwardLot | null>(null);
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [qualityRules, setQualityRules] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/lots").then((r) => r.json()),
      fetch("/api/quality-rules").then((r) => r.json()),
    ]).then(([ls, qrs]) => {
      setLots(Array.isArray(ls) ? ls : []);
      setQualityRules(Array.isArray(qrs) ? qrs : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedRule = previewLot ? qualityRules.find((r) => r.id === previewLot.qualityRuleId) : undefined;

  return (
    <div className="grid gap-6">
      {previewLot && (
        <SettlementPreview
          lot={previewLot}
          rule={selectedRule}
          allRules={qualityRules}
          onClose={() => setPreviewLot(null)}
          onApprove={() => { setPreviewLot(null); load(); }}
        />
      )}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Weighment register — all models</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-[#60735d]">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Model", "Document ref", "Date", "Vehicle", "Gross (MT)", "Tare (MT)", "Net (MT)", "Accepted (MT)", "Moisture%", "FM%", "Deductions (MT)", "Net payable (MT)", "Status", ""].map((h) => <th key={h} className="px-4 py-3.5 shrink-0">{h}</th>)}</tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-4 py-3.5">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-black ${lot.businessModel === "A" ? "bg-[#172018] text-white" : lot.businessModel === "B" ? "bg-[#405b3d] text-white" : "bg-[#d8ff72] text-[#172018]"}`}>{lot.businessModel}</span>
                    </td>
                    <td className="px-4 py-3.5 font-black whitespace-nowrap">{lot.documentRef}</td>
                    <td className="px-4 py-3.5 text-[#536251]">{lot.lotDate}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{lot.vehicleNo}</td>
                    <td className="px-4 py-3.5">{lot.grossWeight.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-[#536251]">{lot.tareWeight.toFixed(2)}</td>
                    <td className="px-4 py-3.5">{lot.netWeight.toFixed(2)}</td>
                    <td className="px-4 py-3.5 font-bold">{lot.acceptedWeight.toFixed(2)}</td>
                    <td className="px-4 py-3.5 font-bold">{Number(lot.qualityReadings["moisture_pct"] ?? 0)}%</td>
                    <td className="px-4 py-3.5 font-bold">{Number(lot.qualityReadings["fm_pct"] ?? 0)}%</td>
                    <td className="px-4 py-3.5 text-[#dc2626] font-bold">{(lot.netWeight - lot.netPayableWeight).toFixed(3)}</td>
                    <td className="px-4 py-3.5 font-black">{lot.netPayableWeight.toFixed(2)}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={lot.status} /></td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setPreviewLot(lot)} className="text-xs font-semibold text-[#172018] underline whitespace-nowrap hover:text-[#405b3d]">Settlement</button>
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

// ─── SETTLEMENTS ─────────────────────────────────────────────────────────────

function SettlementsTab() {
  const [payouts, setPayouts] = useState<FarmerPayout[]>([]);
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/payouts").then((r) => r.json()),
      fetch("/api/lots").then((r) => r.json()),
    ]).then(([ps, ls]) => {
      setPayouts(Array.isArray(ps) ? ps : []);
      setLots(Array.isArray(ls) ? ls : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approvePayout(id: string) {
    await fetch("/api/payouts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, paymentStatus: "Approved" }),
    });
    load();
  }

  const approvedLots = lots.filter((l) => l.status === "Approved").length;
  const pendingPayouts = payouts.filter((f) => f.paymentStatus === "Pending");
  const paidPayouts = payouts.filter((f) => f.paymentStatus === "Paid");

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Lots ready for settlement</p>
          <p className="mt-2 text-3xl font-black">{approvedLots}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Pending farmer payouts</p>
          <p className="mt-2 text-3xl font-black">{pendingPayouts.length}</p>
          <p className="mt-1 text-sm text-[#d97706]">{inr(pendingPayouts.reduce((s, f) => s + f.netAmount, 0))}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Paid payouts</p>
          <p className="mt-2 text-3xl font-black">{paidPayouts.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Farmer payout register</h3>
          <div className="flex gap-2">
            <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
            <button className="rounded-md bg-[#172018] px-3.5 py-1.5 text-sm font-black text-white hover:bg-[#2a3b29]">Release batch</button>
          </div>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-[#60735d]">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Farmer", "Lot ref", "Material", "Qty (MT)", "Rate (₹/MT)", "Gross", "Deductions", "Net payout", "Mode", "Status", "Action"].map((h) => <th key={h} className="px-4 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {payouts.map((fp) => (
                  <tr key={fp.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-4 py-3.5 font-black">{fp.farmerName}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#536251]">{fp.documentRef}</td>
                    <td className="px-4 py-3.5 text-[#536251]">{fp.materialName}</td>
                    <td className="px-4 py-3.5 font-bold">{fp.quantity.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-[#536251]">₹{fp.rate.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3.5">{inr(fp.grossAmount)}</td>
                    <td className="px-4 py-3.5 text-[#dc2626]">({inr(fp.deductions)})</td>
                    <td className="px-4 py-3.5 font-black">{inr(fp.netAmount)}</td>
                    <td className="px-4 py-3.5 text-[#536251]">{fp.paymentMode || "—"}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={fp.paymentStatus} /></td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => fp.paymentStatus === "Pending" ? approvePayout(fp.id) : undefined}
                        className="text-xs font-black text-[#172018] hover:underline">
                        {fp.paymentStatus === "Pending" ? "Approve" : "View"}
                      </button>
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
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>
            {t}
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
