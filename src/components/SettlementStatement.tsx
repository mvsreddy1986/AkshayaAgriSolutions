"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import type { InwardLot, Material, Party } from "../lib/types";

interface Props {
  lot: InwardLot;
  material: Material | undefined;
  party: Party | undefined;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function numberToWords(n: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function words(num: number): string {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "") + " ";
    if (num < 1_000) return ones[Math.floor(num / 100)] + " Hundred " + words(num % 100);
    if (num < 1_00_000) return words(Math.floor(num / 1_000)) + "Thousand " + words(num % 1_000);
    if (num < 1_00_00_000) return words(Math.floor(num / 1_00_000)) + "Lakh " + words(num % 1_00_000);
    return words(Math.floor(num / 1_00_00_000)) + "Crore " + words(num % 1_00_00_000);
  }
  const r = Math.floor(Math.abs(n));
  const p = Math.round((Math.abs(n) - r) * 100);
  let out = "Rupees " + words(r).trim();
  if (p > 0) out += " and " + words(p).trim() + " Paise";
  return out + " Only";
}

const fmt2 = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt3 = (n: number) => n.toFixed(3);
const inrFmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CO = {
  name: "Akshaya Agri Solutions",
  addr: "D. No 34-76, Srinagar Colony, Addanki,\nPrakasam Dt, Andhra Pradesh 523201",
  phone: "9029376519",
  email: "akshayaagrisolutions@gmail.com",
  gstin: "37DZWPS2859P1ZU",
  pan: "DZWPS2859P",
  accName: "Akshaya Agri Solutions",
  accNo: "758405002779",
  ifsc: "ICIC0007584",
  bank: "ICICI (Addanki)",
} as const;

export default function SettlementStatement({ lot, material, party, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [stmtDate, setStmtDate] = useState(today);
  const [editOpen, setEditOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const grossNotional = lot.netWeight * lot.grossSaleRate;
  const qualityDedTotal = Object.values(lot.paramDeductions ?? {}).reduce((s, v) => s + Number(v), 0);
  const cessTotal = Math.round(
    ((material?.cessRate ?? 0) / 100) * lot.netWeight * lot.grossSaleRate * 100,
  ) / 100;
  const cessBalance = Math.max(0, cessTotal - lot.cessAmount);
  const grossSaleValue = lot.grossSaleValue > 0 ? lot.grossSaleValue : grossNotional - qualityDedTotal;
  const margin = lot.akshayaMarginPerMT * lot.netWeight;
  const holdPenalty = lot.holdPenalty ?? 0;
  const netPayable = grossSaleValue - cessBalance - margin - holdPenalty;

  const partyName = lot.businessModel === "B"
    ? (lot.farmerName ?? lot.supplierName ?? "Supplier")
    : (lot.supplierName ?? "Supplier");

  const PARAM_LABELS: Record<string, string> = {
    moisture_pct: "Moisture", fm_pct: "Foreign Matter", broken_grain_pct: "Broken Grain",
    gcv: "GCV", ash_pct: "Ash %", protein_pct: "Protein %", sulphur_pct: "Sulphur %",
    sand_silica_pct: "Sand/Silica", aflatoxin_ppb: "Aflatoxin",
  };

  function handlePrint() {
    const deductionRows = [
      ...Object.entries(lot.paramDeductions ?? {})
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => `<tr>
          <td class="pl">${PARAM_LABELS[k] ?? k} deduction</td>
          <td class="right neg">− ₹${fmt2(Number(v))}</td>
        </tr>`),
      cessBalance > 0 ? `<tr>
          <td class="pl">
            Market cess balance (${material?.cessRate ?? 0}%)
            <div style="font-size:9px;color:#4b7a52;margin-top:2px;">
              ${material?.cessRate ?? 0}% × ${fmt3(lot.netWeight)} MT × ₹${lot.grossSaleRate.toLocaleString("en-IN")}/MT = <strong>₹${fmt2(cessTotal)}</strong>${lot.cessAmount > 0 ? ` &nbsp;·&nbsp; Gate paid: <strong style="color:#15803d">−₹${fmt2(lot.cessAmount)}</strong> &nbsp;·&nbsp; Balance = <strong style="color:#dc2626">₹${fmt2(cessBalance)}</strong>` : ""}
            </div>
          </td>
          <td class="right neg">− ₹${fmt2(cessBalance)}</td>
        </tr>` : "",
      `<tr>
          <td class="pl">Akshaya service margin (₹${lot.akshayaMarginPerMT}/MT × ${fmt3(lot.netWeight)} MT)</td>
          <td class="right neg">− ₹${fmt2(margin)}</td>
        </tr>`,
      holdPenalty > 0 ? `<tr>
          <td class="pl">Quality hold acceptance penalty${lot.holdPenaltyNote ? " — " + lot.holdPenaltyNote : ""}</td>
          <td class="right neg">− ₹${fmt2(holdPenalty)}</td>
        </tr>` : "",
    ].filter(Boolean).join("");

    const readingRows = Object.entries(lot.qualityReadings ?? {})
      .filter(([, v]) => v !== "" && v !== null)
      .map(([k, v]) => `<tr>
        <td>${PARAM_LABELS[k] ?? k}</td>
        <td class="right">${v}${k.endsWith("_pct") ? "%" : ""}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Settlement Statement — ${lot.documentRef}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:16px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #15803d;padding-bottom:12px;margin-bottom:12px}
.co-name{font-size:18px;font-weight:900;color:#15803d}
.co-addr{font-size:9px;color:#374151;margin-top:5px;line-height:1.6;white-space:pre-line}
.doc-title{font-size:20px;font-weight:900;color:#15803d;text-align:right}
.doc-sub{font-size:9px;color:#6b7280;text-align:right;margin-top:1px}
.meta{display:grid;grid-template-columns:auto auto;gap:2px 14px;margin-top:8px;text-align:left}
.ml{font-size:9px;color:#6b7280}.mv{font-size:9.5px;font-weight:700;color:#111;text-align:right}
.section{margin-bottom:10px}
.sec-hdr{background:#15803d;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px;border-radius:3px 3px 0 0}
.sec-body{border:1px solid #d1d5db;border-top:none;border-radius:0 0 3px 3px;padding:8px}
table{width:100%;border-collapse:collapse}
th{font-size:9.5px;font-weight:700;color:#374151;padding:4px 8px;border-bottom:1.5px solid #d1d5db;text-align:left}
td{font-size:10px;padding:4px 8px;border-bottom:1px solid #f3f4f6}
.right{text-align:right}.bold{font-weight:700}.neg{color:#dc2626}
.pos{color:#15803d}.pl{padding-left:20px;color:#536251}
.total-row td{border-top:2px solid #15803d;font-weight:700;font-size:11px;padding-top:6px}
.net-row td{background:#15803d;color:#fff;font-weight:900;font-size:12px;padding:6px 8px}
.words{border:1px solid #d1d5db;border-radius:4px;padding:6px 10px;margin:8px 0;font-size:10px}
.wl{font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.bkhdr{background:#15803d;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px}
.bkbdy{padding:7px 8px;font-size:10px;line-height:1.75;border:1px solid #d1d5db;border-top:none}
.bkl{color:#6b7280;font-size:9px}
.signbox{border:1px solid #d1d5db;border-radius:4px;padding:8px;text-align:right}
.sf{font-size:9px;font-weight:700;text-transform:uppercase;color:#374151}
.sco{font-size:12px;font-weight:900;color:#15803d;margin-top:1px}
.sarea{height:40px;border-bottom:1px solid #d1d5db;margin:8px 0}
.thanks{text-align:center;border-top:2px solid #15803d;margin-top:10px;padding-top:7px}
.tby{font-size:11px;font-weight:700;color:#15803d}
.tct{font-size:9px;color:#6b7280;margin-top:2px}
.status-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;text-transform:uppercase}
.status-settled{background:#dcfce7;color:#15803d}.status-approved{background:#dbeafe;color:#1d4ed8}
.status-hold{background:#fef3c7;color:#d97706}.status-other{background:#f3f4f6;color:#374151}
@media print{@page{size:A4;margin:1cm}body{padding:0}}
</style></head><body>
<!-- Header -->
<div class="hdr">
  <div>
    <div class="co-name">Akshaya Agri Solutions</div>
    <div class="co-addr">${CO.addr}\nPhone: ${CO.phone} | ${CO.email}</div>
    <div class="co-addr">GSTIN: ${CO.gstin} | PAN: ${CO.pan}</div>
  </div>
  <div>
    <div class="doc-title">Settlement Statement</div>
    <div class="doc-sub">Supplier copy</div>
    <div class="meta">
      <span class="ml">Statement Date</span><span class="mv">${stmtDate}</span>
      <span class="ml">Challan No.</span><span class="mv">${lot.documentRef}</span>
      <span class="ml">Lot Date</span><span class="mv">${lot.lotDate}</span>
      <span class="ml">Vehicle</span><span class="mv">${lot.vehicleNo ?? "—"}</span>
      <span class="ml">Status</span><span class="mv">${lot.status}</span>
    </div>
  </div>
</div>

<!-- Supplier / Material -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
  <div class="section">
    <div class="sec-hdr">Supplier / Farmer</div>
    <div class="sec-body">
      <strong style="font-size:12px">${partyName}</strong><br>
      ${party?.address ? `<span style="font-size:9px;color:#374151;white-space:pre-line">${party.address}</span><br>` : ""}
      ${party?.gstin ? `<span style="font-size:9px;color:#6b7280">GSTIN: ${party.gstin}</span><br>` : ""}
      ${lot.businessModel === "B" && lot.supplierName ? `<span style="font-size:9px;color:#6b7280">Via trader: ${lot.supplierName}</span><br>` : ""}
    </div>
  </div>
  <div class="section">
    <div class="sec-hdr">Material &amp; Weighment</div>
    <div class="sec-body" style="font-size:10px;line-height:1.8">
      Material: <strong>${lot.materialName}</strong><br>
      Gross weight: ${fmt3(lot.grossWeight)} MT<br>
      Tare weight: ${fmt3(lot.tareWeight)} MT<br>
      Net weight: <strong>${fmt3(lot.netWeight)} MT</strong><br>
      ${lot.netPayableWeight !== lot.netWeight ? `Net payable weight (after quality): <strong>${fmt3(lot.netPayableWeight)} MT</strong><br>` : ""}
      Agreed rate: <strong>₹${lot.grossSaleRate.toLocaleString("en-IN")}/MT</strong>
    </div>
  </div>
</div>

<!-- Quality Readings -->
${readingRows ? `<div class="section">
  <div class="sec-hdr">Quality Readings</div>
  <div class="sec-body">
    <table><thead><tr><th>Parameter</th><th class="right">Reading</th></tr></thead>
    <tbody>${readingRows}</tbody></table>
  </div>
</div>` : ""}

<!-- Financial Settlement -->
<div class="section">
  <div class="sec-hdr">Financial Settlement</div>
  <div class="sec-body">
    <table>
      <tr>
        <td><strong>Gross Notional</strong> (${fmt3(lot.netWeight)} MT × ₹${lot.grossSaleRate.toLocaleString("en-IN")}/MT)</td>
        <td class="right bold pos">₹${fmt2(grossNotional)}</td>
      </tr>
      ${deductionRows}
      <tr class="total-row">
        <td><strong>Net Payable to Supplier</strong></td>
        <td class="right bold pos">₹${fmt2(netPayable)}</td>
      </tr>
    </table>
  </div>
</div>

<div class="words">
  <div class="wl">Net payable in words :</div>
  <div>${numberToWords(Math.max(0, netPayable))}</div>
</div>

<!-- Footer -->
<div class="fgrid">
  <div>
    <div class="bkhdr">Payment Details</div>
    <div class="bkbdy">
      ${party?.bankAccount ? `
      <span class="bkl">Account Name</span> : ${partyName}<br>
      <span class="bkl">Account No</span> : ${party.bankAccount}<br>
      ${party.ifsc ? `<span class="bkl">IFSC Code</span> : ${party.ifsc}<br>` : ""}
      ${party.bankName ? `<span class="bkl">Bank</span> : ${party.bankName}` : ""}
      ` : `<span style="color:#6b7280;font-size:9.5px">Payment will be credited to your registered bank account on record.</span>`}
    </div>
  </div>
  <div class="signbox">
    <div class="sf">For</div>
    <div class="sco">Akshaya Agri Solutions</div>
    <div class="sarea"></div>
    <div style="font-size:9px;color:#6b7280">Authorised Signatory</div>
  </div>
</div>

<div class="thanks">
  <div class="tby">Settlement confirmation from Akshaya Agri Solutions</div>
  <div class="tct">For queries contact us on ${CO.phone} or ${CO.email}</div>
</div>
</body></html>`;

    const win = window.open("about:blank", "_blank");
    if (!win) { alert("Please allow pop-ups to print."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    Settled: "bg-green-50 text-[#15803d]",
    Invoiced: "bg-emerald-50 text-[#065f46]",
    Approved: "bg-blue-50 text-[#1d4ed8]",
    QualityHold: "bg-amber-50 text-amber-700",
    Mapped: "bg-violet-50 text-violet-700",
    Draft: "bg-[#f3f6ef] text-[#536251]",
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl max-h-[95vh] overflow-hidden">

        {/* Dialog header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#edf0e8] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#172018]">Settlement Statement</h2>
            <p className="mt-0.5 text-xs text-[#60735d]">
              {lot.documentRef} · {partyName} ·{" "}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[lot.status] ?? "bg-gray-100 text-gray-600"}`}>
                {lot.status}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen((v) => !v)}
              className={`btn ${editOpen ? "btn-primary" : "btn-ghost"} text-xs`}
            >
              {editOpen ? "Done" : "Edit Date"}
            </button>
            <button onClick={handlePrint} className="btn btn-primary flex items-center gap-1.5">
              <Printer size={14} />Print / PDF
            </button>
            <button onClick={onClose} className="btn btn-ghost flex items-center gap-1.5">
              <X size={14} />Close
            </button>
          </div>
        </div>

        {editOpen && (
          <div className="shrink-0 border-b border-[#edf0e8] bg-[#f6faef] px-6 py-3">
            <div className="grid gap-1 w-48">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[#60735d]">Statement Date</label>
              <input type="date" value={stmtDate} onChange={(e) => setStmtDate(e.target.value)}
                className="rounded-lg border border-[#c8d4c0] px-3 py-1.5 text-sm focus:border-[#16a34a] focus:outline-none" />
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">

          {/* Header */}
          <div className="mb-5 flex items-start justify-between border-b-2 border-[#15803d] pb-4">
            <div>
              <p className="text-xl font-black text-[#15803d]">Akshaya Agri Solutions</p>
              <p className="mt-2 text-[11px] leading-5 text-[#374151]" style={{ whiteSpace: "pre-line" }}>
                {CO.addr}{"\n"}Phone: {CO.phone} | {CO.email}
              </p>
              <p className="mt-1 text-[11px] text-[#374151]">GSTIN: {CO.gstin} | PAN: {CO.pan}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-[#15803d]">Settlement Statement</p>
              <p className="text-[10px] text-[#6b7280]">Supplier copy</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {(
                  [
                    ["Statement Date", stmtDate],
                    ["Challan No.", lot.documentRef],
                    ["Lot Date", lot.lotDate],
                    ["Vehicle", lot.vehicleNo ?? "—"],
                    ["Status", lot.status],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <span className="text-[10px] text-[#6b7280]">{k}</span>
                    <span className={`text-right text-xs font-semibold ${k === "Status" ? (statusColor[v] ?? "") : "text-[#172018]"}`}>{v}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Supplier + weighment */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-[#d1d5db]">
              <div className="bg-[#15803d] px-3 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Supplier / Farmer</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-sm font-bold text-[#172018]">{partyName}</p>
                {party?.address && (
                  <p className="mt-1 text-[10px] leading-5 text-[#374151]" style={{ whiteSpace: "pre-line" }}>
                    {party.address}
                  </p>
                )}
                {party?.gstin && (
                  <p className="mt-0.5 text-[10px] text-[#6b7280]">GSTIN: {party.gstin}</p>
                )}
                {lot.businessModel === "B" && lot.supplierName && (
                  <p className="mt-0.5 text-[10px] text-[#6b7280]">Via trader: {lot.supplierName}</p>
                )}
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-[#d1d5db]">
              <div className="bg-[#15803d] px-3 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Material & Weighment</p>
              </div>
              <div className="space-y-0.5 px-3 py-2.5 text-xs leading-5">
                <p>Material: <strong>{lot.materialName}</strong></p>
                <p>Gross: {fmt3(lot.grossWeight)} MT &nbsp;|&nbsp; Tare: {fmt3(lot.tareWeight)} MT</p>
                <p>Net weight: <strong>{fmt3(lot.netWeight)} MT</strong></p>
                {lot.netPayableWeight > 0 && lot.netPayableWeight !== lot.netWeight && (
                  <p>Net payable: <strong>{fmt3(lot.netPayableWeight)} MT</strong></p>
                )}
                <p>Rate: <strong>₹{lot.grossSaleRate.toLocaleString("en-IN")}/MT</strong></p>
              </div>
            </div>
          </div>

          {/* Quality readings */}
          {Object.keys(lot.qualityReadings ?? {}).length > 0 && (
            <div className="mb-4 overflow-hidden rounded-md border border-[#d1d5db]">
              <div className="bg-[#15803d] px-3 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Quality Readings</p>
              </div>
              <div className="divide-y divide-[#e5e7eb]">
                {Object.entries(lot.qualityReadings).filter(([, v]) => v !== "" && v !== null).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="text-[#536251]">{(
                      { moisture_pct: "Moisture", fm_pct: "Foreign Matter", broken_grain_pct: "Broken Grain",
                        gcv: "GCV", ash_pct: "Ash %", protein_pct: "Protein %" } as Record<string, string>
                    )[k] ?? k}</span>
                    <span className="font-semibold">{v}{k.endsWith("_pct") ? "%" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial calculation */}
          <div className="mb-4 overflow-hidden rounded-md border border-[#d1d5db]">
            <div className="bg-[#15803d] px-3 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white">Financial Settlement</p>
            </div>
            <div className="divide-y divide-[#e5e7eb]">
              {/* Gross */}
              <div className="flex items-center justify-between bg-[#f0fdf4] px-4 py-2 text-xs">
                <span className="font-medium">Gross Notional ({fmt3(lot.netWeight)} MT × ₹{lot.grossSaleRate.toLocaleString("en-IN")}/MT)</span>
                <span className="font-bold text-[#15803d]">{inrFmt(grossNotional)}</span>
              </div>
              {/* Quality deductions */}
              {Object.entries(lot.paramDeductions ?? {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-1.5 pl-8 text-xs text-[#536251]">
                  <span>{(
                    { moisture_pct: "Moisture", fm_pct: "Foreign Matter", broken_grain_pct: "Broken Grain" } as Record<string, string>
                  )[k] ?? k} deduction</span>
                  <span className="font-medium text-[#dc2626]">− {inrFmt(Number(v))}</span>
                </div>
              ))}
              {/* Cess balance — full calculation inline */}
              {cessBalance > 0 && (
                <div className="flex items-start justify-between px-4 py-2 pl-8 text-xs text-[#536251]">
                  <div className="flex-1 min-w-0 pr-4">
                    <span>Market cess balance ({material?.cessRate ?? 0}%)</span>
                    <p className="text-[10px] text-[#7aaa80] mt-0.5 leading-relaxed">
                      {material?.cessRate ?? 0}% × {fmt3(lot.netWeight)} MT × ₹{lot.grossSaleRate.toLocaleString("en-IN")}/MT
                      {" = "}<strong className="text-[#374151]">{inrFmt(cessTotal)}</strong>
                      {lot.cessAmount > 0 && (
                        <> &nbsp;·&nbsp; Gate paid <strong className="text-[#15803d]">− {inrFmt(lot.cessAmount)}</strong> &nbsp;·&nbsp; Balance = <strong className="text-[#dc2626]">{inrFmt(cessBalance)}</strong></>
                      )}
                    </p>
                  </div>
                  <span className="font-medium text-[#dc2626] whitespace-nowrap">− {inrFmt(cessBalance)}</span>
                </div>
              )}
              {/* Akshaya margin */}
              <div className="flex items-center justify-between px-4 py-1.5 pl-8 text-xs text-[#536251]">
                <span>Akshaya service margin (₹{lot.akshayaMarginPerMT}/MT × {fmt3(lot.netWeight)} MT)</span>
                <span className="font-medium text-[#dc2626]">− {inrFmt(margin)}</span>
              </div>
              {/* Hold penalty */}
              {holdPenalty > 0 && (
                <div className="flex items-center justify-between px-4 py-1.5 pl-8 text-xs text-[#536251]">
                  <span>Quality hold penalty{lot.holdPenaltyNote ? ` — ${lot.holdPenaltyNote}` : ""}</span>
                  <span className="font-medium text-[#dc2626]">− {inrFmt(holdPenalty)}</span>
                </div>
              )}
              {/* Net payable */}
              <div className="flex items-center justify-between border-t-2 border-[#15803d] bg-[#15803d] px-4 py-2.5 text-sm font-bold text-white">
                <span>Net Payable to Supplier</span>
                <span>{inrFmt(Math.max(0, netPayable))}</span>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div className="mb-5 rounded-md border border-[#d1d5db] px-4 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#6b7280]">Net payable in words :</p>
            <p className="mt-0.5 text-xs font-medium text-[#172018]">{numberToWords(Math.max(0, netPayable))}</p>
          </div>

          {/* Footer */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-[#d1d5db]">
              <div className="bg-[#15803d] px-3 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Payment Details</p>
              </div>
              {party?.bankAccount ? (
                <div className="space-y-0.5 px-3 py-2.5 text-xs leading-6">
                  <p><span className="text-[#6b7280]">Account Name</span> : {partyName}</p>
                  <p><span className="text-[#6b7280]">Account No</span> : {party.bankAccount}</p>
                  {party.ifsc && <p><span className="text-[#6b7280]">IFSC Code</span> : {party.ifsc}</p>}
                  {party.bankName && <p><span className="text-[#6b7280]">Bank</span> : {party.bankName}</p>}
                </div>
              ) : (
                <div className="px-3 py-3 text-[11px] text-[#6b7280]">
                  Payment will be credited to your registered bank account on record.
                </div>
              )}
            </div>
            <div className="flex flex-col justify-between rounded-md border border-[#d1d5db] px-4 py-3 text-right">
              <div>
                <p className="text-[9px] font-bold uppercase text-[#374151]">For</p>
                <p className="text-base font-black text-[#15803d]">Akshaya Agri Solutions</p>
              </div>
              <div className="my-4 h-10 border-b border-[#d1d5db]" />
              <p className="text-[10px] text-[#6b7280]">Authorised Signatory</p>
            </div>
          </div>

          <div className="mt-5 border-t-2 border-[#15803d] pt-4 text-center">
            <p className="text-sm font-bold text-[#15803d]">Settlement confirmation from Akshaya Agri Solutions</p>
            <p className="mt-1 text-[10px] text-[#6b7280]">
              For queries contact us on {CO.phone} or {CO.email}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
