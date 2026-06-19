"use client";

import React from "react";
import { Printer, X } from "lucide-react";
import type { InwardLot } from "../lib/types";

interface Props {
  lots: InwardLot[];
  batchRef: string;
  reportDate: string | null;
  consignorName: string | null;
  onClose: () => void;
}

const fmt3 = (n: number) => n.toFixed(3);
const inr = (n: number) =>
  n === 0 ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function BatchInvoiceDialog({ lots, batchRef, reportDate, consignorName, onClose }: Props) {
  // Group lots by material for subtotals
  const groups = new Map<string, { name: string; lots: InwardLot[]; grossMT: number; netMT: number; value: number }>();
  for (const lot of lots) {
    const key = lot.materialId || lot.materialName;
    const cur = groups.get(key) ?? { name: lot.materialName, lots: [], grossMT: 0, netMT: 0, value: 0 };
    cur.lots.push(lot);
    cur.grossMT += lot.grossWeight;
    cur.netMT += lot.netWeight;
    cur.value += lot.grossSaleValue;
    groups.set(key, cur);
  }

  const totalGross = lots.reduce((s, l) => s + l.grossWeight, 0);
  const totalNet = lots.reduce((s, l) => s + l.netWeight, 0);
  const totalValue = lots.reduce((s, l) => s + l.grossSaleValue, 0);
  const displayDate = reportDate ?? new Date().toISOString().slice(0, 10);

  function handlePrint() {
    const rows = Array.from(groups.values())
      .map((g) => {
        const lotRows = g.lots
          .map(
            (l) => `
          <tr>
            <td class="mono">${l.documentRef}</td>
            <td>${l.lotDate}</td>
            <td class="mono">${l.vehicleNo ?? "—"}</td>
            <td>${l.materialName}</td>
            <td class="right">${fmt3(l.grossWeight)}</td>
            <td class="right">${fmt3(l.netWeight)}</td>
            <td class="right">${l.grossSaleRate > 0 ? l.grossSaleRate.toLocaleString("en-IN") : "—"}</td>
            <td class="right bold">${l.grossSaleValue > 0 ? inr(l.grossSaleValue) : "—"}</td>
          </tr>`,
          )
          .join("");
        const subtotal = `
          <tr class="subtotal">
            <td colspan="4" class="right">Subtotal — ${g.name}</td>
            <td class="right">${fmt3(g.grossMT)}</td>
            <td class="right">${fmt3(g.netMT)}</td>
            <td></td>
            <td class="right bold">${g.value > 0 ? inr(g.value) : "—"}</td>
          </tr>`;
        return lotRows + subtotal;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proforma Sales Invoice — ${batchRef}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #166534; padding-bottom: 12px; }
    .company { font-size: 20px; font-weight: 900; color: #166534; }
    .company-sub { font-size: 10px; color: #555; margin-top: 2px; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .doc-sub { font-size: 9px; color: #888; margin-top: 2px; }
    .doc-ref { font-size: 11px; font-weight: 600; margin-top: 6px; }
    .recipient { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
    .recipient-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
    .recipient-name { font-size: 13px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #f3f4f6; font-weight: 600; padding: 6px 8px; border: 1px solid #d1d5db; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border: 1px solid #e5e7eb; font-size: 10px; }
    .right { text-align: right; }
    .mono { font-family: 'Courier New', monospace; font-size: 9px; }
    .bold { font-weight: 700; }
    .subtotal td { background: #f9fafb; font-weight: 600; border-top: 1px solid #9ca3af; }
    tfoot td { background: #166534; color: #fff; font-weight: 700; padding: 7px 8px; }
    .footer { font-size: 9px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 4px; }
    .footer p { margin-top: 3px; }
    @media print { @page { size: A4 landscape; margin: 1cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">Akshaya Agri</div>
      <div class="company-sub">Commodity Trading</div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">Proforma Sales Invoice</div>
      <div class="doc-sub">Provisional — Final invoice issued after quality settlement</div>
      <div class="doc-ref">Invoice Ref: ${batchRef}</div>
      <div class="doc-ref">Date: ${displayDate}</div>
    </div>
  </div>
  <div class="recipient">
    <div class="recipient-label">To</div>
    <div class="recipient-name">${consignorName ?? "Sarvani Bio Fuels Pvt Ltd"}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Challan No</th>
        <th>Date</th>
        <th>Vehicle</th>
        <th>Product</th>
        <th class="right">Gross (MT)</th>
        <th class="right">Net (MT)</th>
        <th class="right">Rate (₹/MT)</th>
        <th class="right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="right">TOTAL — ${lots.length} loads</td>
        <td class="right">${fmt3(totalGross)}</td>
        <td class="right">${fmt3(totalNet)}</td>
        <td></td>
        <td class="right">${totalValue > 0 ? inr(totalValue) : "—"}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">
    <p>This is a provisional proforma invoice. Final amounts will be determined after quality assessment and settlement deductions.</p>
    <p>Total loads: ${lots.length} &nbsp;|&nbsp; Total gross: ${fmt3(totalGross)} MT &nbsp;|&nbsp; Total net: ${fmt3(totalNet)} MT</p>
  </div>
</body>
</html>`;

    const win = window.open("about:blank", "_blank");
    if (!win) {
      alert("Allow pop-ups to print the proforma invoice.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#172018]">Proforma Sales Invoice — {batchRef}</h2>
            <p className="mt-0.5 text-xs text-[#60735d]">Provisional amounts · Final invoice after quality assessment &amp; settlement</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="btn btn-primary flex items-center gap-1.5"
            >
              <Printer size={14} />Print / Save as PDF
            </button>
            <button onClick={onClose} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Close</button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="overflow-y-auto px-6 py-5">
          {/* Company + recipient */}
          <div className="mb-5 flex justify-between">
            <div>
              <p className="text-xl font-black text-[#166534]">Akshaya Agri</p>
              <p className="text-xs text-[#60735d]">Commodity Trading</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold uppercase tracking-wide">Proforma Sales Invoice</p>
              <p className="text-xs text-[#9aad9c]">Provisional — Final invoice after quality settlement</p>
              <p className="mt-1 text-sm font-semibold">Invoice Ref: {batchRef}</p>
              <p className="text-sm">Date: {displayDate}</p>
            </div>
          </div>
          <div className="mb-5 rounded-lg border border-[#d8decf] bg-[#f6faef] px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-[#9aad9c]">To</p>
            <p className="mt-0.5 text-base font-bold text-[#172018]">{consignorName ?? "Sarvani Bio Fuels Pvt Ltd"}</p>
          </div>

          {/* Lots table grouped by material */}
          <div className="overflow-x-auto rounded-xl border border-[#edf0e8]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f6faef] text-[#536251]">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Challan No</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Vehicle</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold">Product</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold">Gross (MT)</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold">Net (MT)</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold">Rate (₹/MT)</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(groups.values()).map((g) => (
                  <React.Fragment key={g.name}>
                    {g.lots.map((lot) => (
                      <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                        <td className="px-3 py-2 font-mono text-xs">{lot.documentRef}</td>
                        <td className="px-3 py-2 text-xs text-[#536251]">{lot.lotDate}</td>
                        <td className="px-3 py-2 font-mono text-xs text-[#536251]">{lot.vehicleNo ?? "—"}</td>
                        <td className="px-3 py-2">{lot.materialName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt3(lot.grossWeight)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt3(lot.netWeight)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#536251]">
                          {lot.grossSaleRate > 0 ? lot.grossSaleRate.toLocaleString("en-IN") : <span className="text-[#f59e0b]">Not set</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">
                          {lot.grossSaleValue > 0 ? inr(lot.grossSaleValue) : <span className="text-[#9aad9c]">—</span>}
                        </td>
                      </tr>
                    ))}
                    {/* Subtotal row per product */}
                    <tr className="border-t border-[#c8d4c0] bg-[#f0f7ea]">
                      <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-[#536251]">
                        Subtotal — {g.name}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{fmt3(g.grossMT)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{fmt3(g.netMT)}</td>
                      <td />
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">
                        {g.value > 0 ? inr(g.value) : "—"}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#166534] text-white">
                  <td colSpan={4} className="px-3 py-3 text-right text-sm font-bold">
                    TOTAL — {lots.length} loads
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">{fmt3(totalGross)}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">{fmt3(totalNet)}</td>
                  <td />
                  <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">
                    {totalValue > 0 ? inr(totalValue) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Disclaimer */}
          <p className="mt-4 text-xs text-[#9aad9c]">
            Provisional proforma invoice. Final invoice will be issued after quality assessment and settlement.
            Amounts marked — indicate rate not yet configured in Rate Master.
          </p>
        </div>
      </div>
    </div>
  );
}
