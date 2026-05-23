"use client";

import { useState } from "react";
import { INWARD_LOTS, IMPORT_BATCHES, FARMER_PAYOUTS, QUALITY_RULES } from "../../../lib/data/seed";
import type { LotStatus, InwardLot } from "../../../lib/types";
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

function ModelATab() {
  const [file, setFile] = useState<File | null>(null);
  const [parseState, setParseState] = useState<"idle" | "parsing" | "done">("idle");
  const modelALots = INWARD_LOTS.filter((l) => l.businessModel === "A");
  const modelABatches = IMPORT_BATCHES.filter((b) => b.businessModel === "A");

  function simulateParse() {
    setParseState("parsing");
    setTimeout(() => setParseState("done"), 1800);
  }

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
                <input
                  type="file"
                  accept=".pdf"
                  id="pdf-upload"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <label
                  htmlFor="pdf-upload"
                  className="cursor-pointer rounded-md border border-[#c8d4c0] bg-[#f6faef] px-4 py-2.5 text-sm font-black hover:bg-[#eef3e8]"
                >
                  {file ? file.name : "Choose PDF file"}
                </label>
              </div>
              <button
                onClick={simulateParse}
                disabled={!file && parseState === "idle"}
                className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 hover:bg-[#2a3b29]"
              >
                {parseState === "parsing" ? "Parsing…" : parseState === "done" ? "Re-parse" : "Parse & Create Lots"}
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-[#d8decf] bg-[#f8faf5] p-4 text-sm sm:w-56">
            <p className="font-black text-[#172018]">Latest import</p>
            <p className="mt-1 text-[#60735d]">IMPORT-12052026-001</p>
            <p className="mt-1 text-[#60735d]">38 rows · 35 mapped</p>
            <StatusBadge status="Mapped" />
          </div>
        </div>
        {parseState === "done" && (
          <div className="mt-4 rounded-lg bg-[#f0fdf4] p-4 text-sm text-[#15803d]">
            ✓ 38 lots parsed from PDF. 35 auto-matched to existing suppliers. 3 lots need manual mapping.
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
              <tr>
                {["Batch ref", "File", "Report date", "Rows", "Mapped", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelABatches.map((b) => (
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
                  <td className="px-5 py-3.5">
                    <button className="text-xs font-black text-[#172018] hover:underline">View lots</button>
                  </td>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Document ref", "Date", "Material", "Vehicle", "Accepted (MT)", "Moisture%", "FM%", "Supplier", "Farmer", "Net payable (MT)", "Value", "Status", "Action"].map((h) => (
                  <th key={h} className="px-4 py-3.5 shrink-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelALots.map((lot) => (
                <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-4 py-3.5 font-black whitespace-nowrap">{lot.documentRef}</td>
                  <td className="px-4 py-3.5 text-[#536251] whitespace-nowrap">{lot.lotDate}</td>
                  <td className="px-4 py-3.5 text-[#536251]">{lot.materialName}</td>
                  <td className="px-4 py-3.5 font-mono text-xs">{lot.vehicleNo}</td>
                  <td className="px-4 py-3.5 font-bold">{lot.acceptedWeight.toFixed(2)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`font-bold ${lot.moisturePct > 15 ? "text-[#dc2626]" : "text-[#172018]"}`}>
                      {lot.moisturePct}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`font-bold ${lot.fmPct > 1.5 ? "text-[#dc2626]" : "text-[#172018]"}`}>
                      {lot.fmPct}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[#536251]">{lot.supplierName ?? <span className="text-[#dc2626] font-bold">Unmapped</span>}</td>
                  <td className="px-4 py-3.5 text-[#536251]">{lot.farmerName ?? "—"}</td>
                  <td className="px-4 py-3.5 font-bold">{lot.netPayableWeight.toFixed(2)}</td>
                  <td className="px-4 py-3.5 font-bold whitespace-nowrap">{inr(lot.grossSaleValue)}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={lot.status} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2">
                      <button className="text-xs font-black text-[#172018] hover:underline whitespace-nowrap">
                        {lot.status === "Draft" ? "Map" : "Edit"}
                      </button>
                      {lot.status === "QualityHold" && (
                        <button className="text-xs font-black text-[#d97706] hover:underline">Override</button>
                      )}
                    </div>
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

function ModelBTab() {
  const [file, setFile] = useState<File | null>(null);
  const [parseState, setParseState] = useState<"idle" | "parsing" | "done">("idle");
  const modelBLots = INWARD_LOTS.filter((l) => l.businessModel === "B");
  const modelBBatch = IMPORT_BATCHES.find((b) => b.businessModel === "B");

  return (
    <div className="grid gap-6">
      {/* Info card */}
      <div className="rounded-xl border border-[#c8d4f0] bg-[#eff6ff] p-5">
        <h3 className="font-black text-[#1d4ed8]">Model B: Farmer Finance Flow</h3>
        <p className="mt-2 text-sm leading-6 text-[#1e3a8a]">
          In Model B, Akshaya pays farmers directly before receiving payment from Sarvani. This creates a <strong>Finance Advance Control account</strong> exposure. Each Excel row becomes a farmer finance record and contributes to a bulk Sarvani invoice.
        </p>
      </div>

      {/* Upload panel */}
      <div className="rounded-xl border border-dashed border-[#aebba8] bg-white p-6">
        <h3 className="text-xl font-black">Import farmer supply Excel</h3>
        <p className="mt-2 text-sm leading-6 text-[#60735d]">
          Expected columns: Farmer name, vehicle no, material, accepted weight (MT), rate (₹/MT), bank account, IFSC, Sarvani reference. Farmers are auto-created as party references if not found.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div>
            <input type="file" accept=".xlsx,.xls,.csv" id="excel-upload" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <label htmlFor="excel-upload" className="cursor-pointer rounded-md border border-[#c8d4c0] bg-[#f6faef] px-4 py-2.5 text-sm font-black hover:bg-[#eef3e8]">
              {file ? file.name : "Choose Excel / CSV"}
            </label>
          </div>
          <button
            onClick={() => { setParseState("parsing"); setTimeout(() => setParseState("done"), 1500); }}
            disabled={!file && parseState === "idle"}
            className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {parseState === "parsing" ? "Importing…" : parseState === "done" ? "Re-import" : "Import & Create Records"}
          </button>
        </div>
        {parseState === "done" && (
          <div className="mt-4 rounded-lg bg-[#f0fdf4] p-4 text-sm text-[#15803d]">
            ✓ 14 farmer records imported. All rows matched to existing parties. Finance advance entries created. Ready to generate Sarvani bulk invoice.
          </div>
        )}
      </div>

      {/* Manual entry */}
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Manual farmer supply entry</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Farmer name", "Ravi Kumar", "text"],
            ["Vehicle no", "AP39CD1234", "text"],
            ["Material", "Maize", "text"],
            ["Accepted weight (MT)", "12.35", "number"],
            ["Gross sale rate (₹/MT)", "22500", "number"],
            ["Farmer payment rate (₹/MT)", "21800", "number"],
            ["Sarvani reference", "FF-12MAY-014", "text"],
            ["Bank account", "XXXX1234", "text"],
          ].map(([label, placeholder, type]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type={type as string} placeholder={placeholder as string} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Save Draft</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>

      {/* Model B lots */}
      {modelBLots.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h3 className="text-lg font-black">Model B inward lots</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>
                  {["Document ref", "Farmer", "Material", "Accepted (MT)", "Rate", "Value", "Finance payout", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelBLots.map((lot) => (
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

function WeighmentTab() {
  const [previewLot, setPreviewLot] = useState<InwardLot | null>(null);

  const selectedRule = previewLot
    ? QUALITY_RULES.find((r) => r.id === previewLot.qualityRuleId)
    : undefined;

  return (
    <div className="grid gap-6">
      {previewLot && (
        <SettlementPreview
          lot={previewLot}
          rule={selectedRule}
          allRules={QUALITY_RULES}
          onClose={() => setPreviewLot(null)}
          onApprove={() => setPreviewLot(null)}
        />
      )}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Weighment register — all models</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Model", "Document ref", "Date", "Vehicle", "Gross (MT)", "Tare (MT)", "Net (MT)", "Accepted (MT)", "Moisture%", "FM%", "Deductions (MT)", "Net payable (MT)", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3.5 shrink-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INWARD_LOTS.map((lot) => (
                <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-4 py-3.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-black ${lot.businessModel === "A" ? "bg-[#172018] text-white" : lot.businessModel === "B" ? "bg-[#405b3d] text-white" : "bg-[#d8ff72] text-[#172018]"}`}>
                      {lot.businessModel}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-black whitespace-nowrap">{lot.documentRef}</td>
                  <td className="px-4 py-3.5 text-[#536251]">{lot.lotDate}</td>
                  <td className="px-4 py-3.5 font-mono text-xs">{lot.vehicleNo}</td>
                  <td className="px-4 py-3.5">{lot.grossWeight.toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-[#536251]">{lot.tareWeight.toFixed(2)}</td>
                  <td className="px-4 py-3.5">{lot.netWeight.toFixed(2)}</td>
                  <td className="px-4 py-3.5 font-bold">{lot.acceptedWeight.toFixed(2)}</td>
                  <td className="px-4 py-3.5 font-bold">{lot.moisturePct}%</td>
                  <td className="px-4 py-3.5 font-bold">{lot.fmPct}%</td>
                  <td className="px-4 py-3.5 text-[#dc2626] font-bold">
                    {(lot.moistureDeduction + lot.fmDeduction).toFixed(3)}
                  </td>
                  <td className="px-4 py-3.5 font-black">{lot.netPayableWeight.toFixed(2)}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={lot.status} /></td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => setPreviewLot(lot)}
                      className="text-xs font-semibold text-[#172018] underline whitespace-nowrap hover:text-[#405b3d]"
                    >
                      Settlement
                    </button>
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

function SettlementsTab() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Lots ready for settlement</p>
          <p className="mt-2 text-3xl font-black">{INWARD_LOTS.filter((l) => l.status === "Approved").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Pending farmer payouts</p>
          <p className="mt-2 text-3xl font-black">{FARMER_PAYOUTS.filter((f) => f.paymentStatus === "Pending").length}</p>
          <p className="mt-1 text-sm text-[#d97706]">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
              FARMER_PAYOUTS.filter((f) => f.paymentStatus === "Pending").reduce((s, f) => s + f.netAmount, 0)
            )}
          </p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Paid payouts this batch</p>
          <p className="mt-2 text-3xl font-black">{FARMER_PAYOUTS.filter((f) => f.paymentStatus === "Paid").length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Farmer payout register — FP-090</h3>
          <div className="flex gap-2">
            <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
            <button className="rounded-md bg-[#172018] px-3.5 py-1.5 text-sm font-black text-white hover:bg-[#2a3b29]">Release batch</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Farmer", "Lot ref", "Material", "Qty (MT)", "Rate (₹/MT)", "Gross", "Deductions", "Net payout", "Mode", "Status", "Action"].map((h) => (
                  <th key={h} className="px-4 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FARMER_PAYOUTS.map((fp) => (
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
                    <button className="text-xs font-black text-[#172018] hover:underline">
                      {fp.paymentStatus === "Pending" ? "Approve" : "View"}
                    </button>
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

export default function ProcurementPage() {
  const [tab, setTab] = useState<Tab>("Model A");

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

      {tab === "Model A" && <ModelATab />}
      {tab === "Model B" && <ModelBTab />}
      {tab === "Weighment" && <WeighmentTab />}
      {tab === "Settlements" && <SettlementsTab />}
    </div>
  );
}
