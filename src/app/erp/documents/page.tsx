"use client";

import { useState } from "react";
import { IMPORT_BATCHES, INVOICES } from "../../../lib/data/seed";

const TABS = ["Upload", "Matching", "Templates", "Archive"] as const;
type Tab = (typeof TABS)[number];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-[#fef9c3] text-[#a16207]",
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Mapped: "bg-[#eff6ff] text-[#1d4ed8]",
    Posted: "bg-[#f5f3ff] text-[#6d28d9]",
    Linked: "bg-[#f0fdf4] text-[#15803d]",
    Approved: "bg-[#f0fdf4] text-[#15803d]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function UploadTab() {
  const [pdfState, setPdfState] = useState<"idle" | "uploading" | "done">("idle");
  const [excelState, setExcelState] = useState<"idle" | "uploading" | "done">("idle");
  const [docState, setDocState] = useState<"idle" | "uploading" | "done">("idle");

  function simulate(setter: React.Dispatch<React.SetStateAction<"idle" | "uploading" | "done">>) {
    setter("uploading");
    setTimeout(() => setter("done"), 1600);
  }

  const panels = [
    {
      title: "Upload delivery report PDF (Model A)",
      desc: "Daily report from Sarvani Biofuels. System parses vehicle-wise accepted weight, moisture %, FM%, and creates draft inward lots for each row.",
      accept: ".pdf",
      state: pdfState,
      onUpload: () => simulate(setPdfState),
      badge: "Model A",
      instructions: ["PDF must be the official Sarvani format", "Each page row = one vehicle/lot", "System auto-detects report date from header", "Duplicate vehicle numbers in same batch are flagged"],
    },
    {
      title: "Import farmer Excel sheet (Model B)",
      desc: "Farmer supply and payment data. Expected columns: Farmer Name, Vehicle No, Material, Weight (MT), Rate (₹/MT), Bank Account, IFSC, Sarvani Reference.",
      accept: ".xlsx,.xls,.csv",
      state: excelState,
      onUpload: () => simulate(setExcelState),
      badge: "Model B",
      instructions: ["Excel / CSV accepted", "First row must be headers", "New farmers auto-created as party references", "Duplicate Sarvani refs are blocked"],
    },
    {
      title: "Upload supporting document",
      desc: "Upload vendor bills, payment proof screenshots, e-way bills, acknowledgement letters, or any audit support document.",
      accept: ".pdf,.jpg,.jpeg,.png",
      state: docState,
      onUpload: () => simulate(setDocState),
      badge: "Audit",
      instructions: ["PDF, JPG, PNG accepted up to 10MB", "Link to invoice or voucher reference", "Stored securely with access log"],
    },
  ];

  const colors: Record<string, string> = {
    "Model A": "bg-[#172018] text-white",
    "Model B": "bg-[#405b3d] text-white",
    Audit: "bg-[#d8ff72] text-[#172018]",
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {panels.map((panel) => (
        <div key={panel.title} className="rounded-xl border border-dashed border-[#aebba8] bg-white p-6">
          <div className="mb-3">
            <span className={`rounded-md px-2.5 py-1 text-xs font-black ${colors[panel.badge]}`}>{panel.badge}</span>
          </div>
          <h3 className="text-lg font-black leading-snug">{panel.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#60735d]">{panel.desc}</p>
          <ul className="mt-3 space-y-1">
            {panel.instructions.map((i) => (
              <li key={i} className="flex gap-2 text-xs text-[#60735d]">
                <span className="mt-0.5 text-[#4a9e44]">✓</span>
                {i}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <input type="file" accept={panel.accept} id={`file-${panel.badge}`} className="hidden" />
            <label htmlFor={`file-${panel.badge}`} className="cursor-pointer rounded-md border border-[#c8d4c0] bg-[#f6faef] px-4 py-2.5 text-center text-sm font-black hover:bg-[#eef3e8]">
              {panel.state === "done" ? "File selected ✓" : "Choose file"}
            </label>
            <button
              onClick={panel.onUpload}
              className="rounded-md bg-[#172018] px-4 py-2.5 text-sm font-black text-white hover:bg-[#2a3b29] disabled:opacity-50"
            >
              {panel.state === "uploading" ? "Uploading…" : panel.state === "done" ? "Upload another" : "Upload & Process"}
            </button>
          </div>
          {panel.state === "done" && (
            <p className="mt-3 rounded-lg bg-[#f0fdf4] p-3 text-xs text-[#15803d]">
              ✓ Uploaded and queued for processing. Check Matching tab.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function MatchingTab() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Import batches today</p>
          <p className="mt-2 text-3xl font-black">{IMPORT_BATCHES.filter((b) => b.reportDate === "2026-05-12").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Document match rate</p>
          <p className="mt-2 text-3xl font-black text-[#15803d]">97.8%</p>
          <p className="mt-1 text-xs text-[#60735d]">35/38 lots matched today</p>
        </div>
        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
          <p className="text-sm text-[#60735d]">Unmapped / exceptions</p>
          <p className="mt-2 text-3xl font-black text-[#d97706]">3</p>
          <p className="mt-1 text-xs text-[#d97706]">Need manual mapping</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Import batch matching status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Batch ref", "Type", "Model", "File", "Report date", "Rows", "Mapped", "Match %", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {IMPORT_BATCHES.map((b) => {
                const pct = ((b.mappedRows / b.totalRows) * 100).toFixed(0);
                return (
                  <tr key={b.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-black">{b.batchRef}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-black ${b.importType === "PDF" ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#dcfce7] text-[#14532d]"}`}>
                        {b.importType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-black ${b.businessModel === "A" ? "bg-[#172018] text-white" : "bg-[#405b3d] text-white"}`}>
                        Model {b.businessModel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px] truncate text-[#536251]">{b.sourceFilename}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{b.reportDate}</td>
                    <td className="px-5 py-3.5">{b.totalRows}</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-bold ${b.mappedRows === b.totalRows ? "text-[#15803d]" : "text-[#d97706]"}`}>
                        {b.mappedRows}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-[#e5e7eb]">
                          <div className={`h-2 rounded-full ${Number(pct) === 100 ? "bg-[#15803d]" : "bg-[#d97706]"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3.5">
                      <button className="text-xs font-black text-[#172018] hover:underline">View lots</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const templates = [
    { name: "GST Sales Invoice", desc: "Standard GST invoice for Sarvani or trader customers. Auto-populates GSTIN, HSN, tax calculation, and invoice serial number.", lastUpdated: "01-May-2026" },
    { name: "Farmer Bill Reference", desc: "Audit document linking farmer identity, inward lot, payment amount, and bank reference. Not a GST invoice.", lastUpdated: "15-Apr-2026" },
    { name: "Ledger Statement", desc: "Party-wise outstanding statement with invoice-wise ageing. Shareable as PDF link with the counterparty.", lastUpdated: "01-May-2026" },
    { name: "Payment Advice", desc: "Outgoing payment confirmation with UTR reference and invoice allocation details.", lastUpdated: "10-Apr-2026" },
    { name: "Audit Pack", desc: "Bundles delivery report, invoice, farmer bill, and payment proof into a single PDF for any given lot or batch.", lastUpdated: "01-May-2026" },
    { name: "Quality Certificate", desc: "Material-wise quality test results with parameter values, limits, and pass/fail status.", lastUpdated: "20-Apr-2026" },
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((t) => (
        <div key={t.name} className="rounded-xl border border-[#d8decf] bg-white p-5">
          <h3 className="text-lg font-black">{t.name}</h3>
          <p className="mt-3 min-h-[4rem] text-sm leading-6 text-[#60735d]">{t.desc}</p>
          <p className="mt-3 text-xs text-[#8a9e87]">Last updated: {t.lastUpdated}</p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-md border border-[#9baa91] px-3.5 py-2 text-sm font-black hover:bg-[#f3f6ef]">Preview</button>
            <button className="rounded-md bg-[#172018] px-3.5 py-2 text-sm font-black text-white hover:bg-[#2a3b29]">Edit template</button>
          </div>
        </div>
      ))}
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
    { name: "AKSHAYA AGRI SOLUTIONS 11-5-26.pdf", type: "Delivery report", party: "Sarvani Biofuels", date: "11-May-2026", status: "Linked", ref: "IMPORT-11052026-001" },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Audit document archive</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Search documents…" className="w-56 rounded-md border border-[#c8d4c0] px-3.5 py-2 text-sm outline-none focus:border-[#172018]" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Document name", "Type", "Linked party", "Date", "Reference", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archive.map((doc) => (
                <tr key={doc.name} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black max-w-[220px] truncate">{doc.name}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{doc.type}</td>
                  <td className="px-5 py-3.5 font-bold">{doc.party}</td>
                  <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{doc.date}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#1d4ed8]">{doc.ref}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={doc.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button className="text-xs font-black text-[#172018] hover:underline">View</button>
                      <button className="text-xs font-black text-[#1d4ed8] hover:underline">Download</button>
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

export default function DocumentsPage() {
  const [tab, setTab] = useState<Tab>("Upload");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>{t}</button>
        ))}
      </div>
      {tab === "Upload" && <UploadTab />}
      {tab === "Matching" && <MatchingTab />}
      {tab === "Templates" && <TemplatesTab />}
      {tab === "Archive" && <ArchiveTab />}
    </div>
  );
}
