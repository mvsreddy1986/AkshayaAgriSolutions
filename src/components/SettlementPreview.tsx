"use client";
import { useMemo, useState } from "react";
import { calculateLotSettlement, validateLotForSettlement, paramQualityAccount } from "@/lib/settlement/engine";
import type { InwardLot, QualityRule, MaterialParam, Material } from "@/lib/types";

interface Props {
  lot: InwardLot;
  rule: QualityRule | undefined;
  allRules: QualityRule[];
  materialParams?: MaterialParam[];
  material?: Material;
  onClose: () => void;
  onApprove?: () => void;
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ── tiny primitives ──────────────────────────────────────────── */

function Divider() {
  return <div className="border-t border-[#e8f0e4] my-0.5" />;
}

function StatementRow({
  label, sub, value, minus, plus, bold, muted,
}: {
  label: string; sub?: string; value: string;
  minus?: boolean; plus?: boolean; bold?: boolean; muted?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between py-2.5 ${muted ? "opacity-50" : ""}`}>
      <div className="flex-1 min-w-0 pr-4">
        <p className={`text-sm leading-snug ${bold ? "font-bold text-[#172018]" : "text-[#2d3b2e]"}`}>{label}</p>
        {sub && <p className="text-[11px] text-[#7a9b7e] mt-0.5 leading-snug">{sub}</p>}
      </div>
      <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
        minus ? "text-red-600" : plus ? "text-emerald-600" : bold ? "text-[#172018]" : "text-[#4a6b4e]"
      }`}>
        {minus ? `− ${value}` : plus ? `+ ${value}` : value}
      </p>
    </div>
  );
}

function SubtotalBar({ label, sub, value, accent }: { label: string; sub?: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${accent ? "bg-[#172018]" : "bg-[#f0f6ed]"}`}>
      <div>
        <p className={`text-sm font-bold ${accent ? "text-[#d8ff72]" : "text-[#172018]"}`}>{label}</p>
        {sub && <p className={`text-[11px] mt-0.5 ${accent ? "text-white/50" : "text-[#7a9b7e]"}`}>{sub}</p>}
      </div>
      <p className={`text-base font-black tabular-nums ${accent ? "text-[#d8ff72]" : "text-[#172018]"}`}>{value}</p>
    </div>
  );
}

/* ── main component ───────────────────────────────────────────── */

export default function SettlementPreview({ lot, rule, allRules, materialParams, material, onClose, onApprove }: Props) {
  const [confirming, setConfirming] = useState(false);
  const gstRate = (material?.gstRate ?? 0) / 100;

  const calc = useMemo(
    () => (rule ? calculateLotSettlement(lot, rule, material?.cessRate) : null),
    [lot, rule, material],
  );
  const issues = useMemo(
    () => validateLotForSettlement(lot, allRules, materialParams),
    [lot, allRules, materialParams],
  );

  const weightDeds   = calc?.paramCalcs.filter(c => c.weightDeductionKg > 0 && !c.rejectTrigger) ?? [];
  const valueDeds    = calc?.paramCalcs.filter(c => c.weightDeductionKg === 0 && c.valueDeduction > 0 && !c.rejectTrigger) ?? [];
  const holdTriggers = calc?.paramCalcs.filter(c => c.rejectTrigger) ?? [];
  const infoParams   = calc?.paramCalcs.filter(c => c.weightDeductionKg === 0 && c.valueDeduction === 0 && !c.rejectTrigger) ?? [];

  const grossNotional      = calc ? r2(calc.netWeight * calc.grossSaleRate) : 0;
  const spMargin           = calc ? r2(lot.akshayaMarginPerMT * lot.netWeight) : 0;
  // settlementPayable = grossSaleValue − cessTotal − margin (posted to 2101 in settlement)
  // cessPaid is added back to 2101 via Dr 5101 / Cr 2101 at settlement → single payment to supplier
  const settlementPayable  = calc ? r2(calc.grossSaleValue - calc.cessTotal - spMargin - (lot.holdPenalty ?? 0)) : 0;
  const totalSupplierPayable = calc ? r2(settlementPayable + calc.cessPaid) : 0;

  const canPost = !!onApprove && lot.status === "Approved" && issues.length === 0 && !!calc && !calc.hasRejectTrigger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* ── Sticky header ── */}
        <div className="bg-[#172018] text-white rounded-t-2xl px-5 py-4 flex items-start justify-between shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#d8ff72] mb-0.5">Settlement Preview</p>
            <p className="text-xl font-black tracking-tight">{lot.documentRef}</p>
            <p className="text-xs text-white/50 mt-1">
              {lot.materialName}
              {lot.lotDate && ` · ${lot.lotDate}`}
              {lot.supplierName && ` · ${lot.supplierName}`}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none ml-4 shrink-0">×</button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Alerts */}
          {issues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-bold text-red-700 mb-2">Cannot settle — resolve first:</p>
              <ul className="space-y-1">{issues.map((s, i) => (
                <li key={i} className="text-xs text-red-600 flex gap-2"><span>•</span><span>{s}</span></li>
              ))}</ul>
            </div>
          )}
          {!rule && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              No quality rule assigned — cannot compute settlement.
            </div>
          )}
          {calc?.hasRejectTrigger && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-bold text-red-700">Quality hold: {calc.rejectedParams.join(", ")}</p>
              <p className="text-xs text-red-500 mt-0.5">Override this lot to proceed with settlement.</p>
            </div>
          )}
          {!calc?.hasRejectTrigger && lot.overrideReason && (lot.holdPenalty ?? 0) === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold">Accepted from Quality Hold</p>
              <p className="text-xs text-amber-600 mt-0.5">{lot.overrideReason}</p>
            </div>
          )}

          {/* ── 3 KPI chips ── */}
          {calc && (
            <div className="grid grid-cols-3 gap-2">
              {([
                ["Net Weight",   `${lot.netWeight.toFixed(3)} MT`],
                ["Sale Rate",    `₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT`],
                ["Gross Amount", inr(grossNotional)],
              ] as [string, string][]).map(([lbl, val]) => (
                <div key={lbl} className="bg-[#f7faf4] border border-[#dcebd7] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#7a9b7e] font-semibold uppercase tracking-wider">{lbl}</p>
                  <p className="text-sm font-black text-[#172018] mt-1">{val}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Quality readings ── */}
          {rule && Object.keys(lot.qualityReadings).length > 0 && (
            <div className="border border-[#dcebd7] rounded-xl overflow-hidden">
              <div className="bg-[#f7faf4] px-4 py-2 border-b border-[#dcebd7]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#7a9b7e]">Quality Readings · Rule {rule.id}</p>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-[#7a9b7e] border-b border-[#f0f6ed]">
                  <th className="px-4 py-2 text-left font-semibold">Parameter</th>
                  <th className="px-4 py-2 text-right font-semibold">Reading</th>
                  <th className="px-4 py-2 text-right font-semibold">Base</th>
                  <th className="px-4 py-2 text-right font-semibold">Excess</th>
                </tr></thead>
                <tbody>
                  {rule.paramRules.map(pr => {
                    const reading = lot.qualityReadings[pr.paramKey];
                    if (reading === undefined) return null;
                    const excess = typeof reading === "number" && pr.baseValue !== undefined
                      ? Math.max(0, reading - pr.baseValue) : undefined;
                    const over = excess !== undefined && excess > 0;
                    return (
                      <tr key={pr.paramKey} className={`border-t border-[#f0f6ed] ${over ? "bg-orange-50" : ""}`}>
                        <td className="px-4 py-2 font-medium text-[#2d3b2e]">{pr.label ?? pr.paramKey}</td>
                        <td className={`px-4 py-2 text-right font-bold ${over ? "text-orange-700" : "text-[#172018]"}`}>
                          {reading}{typeof reading === "number" ? "%" : ""}
                        </td>
                        <td className="px-4 py-2 text-right text-[#7a9b7e]">
                          {pr.baseValue !== undefined ? `${pr.baseValue}%` : "—"}
                        </td>
                        <td className={`px-4 py-2 text-right font-bold ${over ? "text-red-600" : "text-[#b0c4b4]"}`}>
                          {over ? `+${excess!.toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {rule.pricingModel === "rate-slab" && calc && (
                    <tr className="border-t border-[#dcebd7] bg-[#f7faf4]">
                      <td className="px-4 py-2 font-semibold text-[#172018]" colSpan={3}>Rate from quality slab</td>
                      <td className="px-4 py-2 text-right font-black text-[#172018]">₹{calc.grossSaleRate.toLocaleString("en-IN")}/MT</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {infoParams.length > 0 && (
                <p className="px-4 py-2 text-[11px] text-[#7a9b7e] border-t border-[#f0f6ed]">
                  Info: {infoParams.map(c => `${c.label} = ${c.reading}`).join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* ── Unified Settlement Statement ── */}
          {calc && (
            <div className="border border-[#dcebd7] rounded-xl overflow-hidden">

              {/* Card header */}
              <div className="bg-[#f7faf4] px-4 py-2.5 border-b border-[#dcebd7] flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#7a9b7e]">Settlement Statement</p>
                <p className="text-[11px] text-[#7a9b7e]">
                  {lot.netWeight.toFixed(3)} MT → {calc.netPayableWeight.toFixed(3)} MT payable
                </p>
              </div>

              <div className="px-4">

                {/* STEP 1 — Sale Value */}
                <StatementRow
                  label="Gross Sale Amount"
                  sub={`${lot.netWeight.toFixed(3)} MT × ₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT (full net weight)`}
                  value={inr(grossNotional)}
                  bold
                />

                {/* Weight-based quality deductions */}
                {weightDeds.map(c => (
                  <StatementRow
                    key={c.paramKey}
                    label={`Quality — ${c.label}`}
                    sub={c.breakdown}
                    value={inr(c.valueDeduction)}
                    minus
                  />
                ))}
                {/* Value-only deductions */}
                {valueDeds.map(c => (
                  <StatementRow
                    key={c.paramKey}
                    label={`Quality — ${c.label}`}
                    sub={c.breakdown}
                    value={inr(c.valueDeduction)}
                    minus
                  />
                ))}
                {/* Reject triggers */}
                {holdTriggers.map(c => (
                  <div key={c.paramKey} className="flex items-center justify-between py-2.5">
                    <p className="text-sm text-[#2d3b2e]">{c.label}</p>
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">HOLD TRIGGER</span>
                  </div>
                ))}
              </div>

              {/* Subtotal 1 — Net Quality Amount */}
              <SubtotalBar
                label="Net Quality Amount"
                sub={`${calc.netPayableWeight.toFixed(3)} MT × ₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT`}
                value={inr(calc.grossSaleValue)}
              />

              {/* STEP 2 — Cess */}
              {calc.cessTotal > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-[#2d3b2e]">Market Cess ({calc.effectiveCessRate}%)</p>
                      <p className="text-xs text-[#7a9b7e]">{calc.effectiveCessRate}% of gross notional</p>
                    </div>
                    {/* 3-col cess breakdown */}
                    <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-[#dcebd7] text-center text-xs mb-2">
                      <div className="py-3 px-2 bg-white border-r border-[#dcebd7]">
                        <p className="text-[10px] text-[#7a9b7e] font-semibold uppercase tracking-wide mb-1">Full Cess</p>
                        <p className="font-black text-[#172018] text-sm">{inr(calc.cessTotal)}</p>
                      </div>
                      <div className={`py-3 px-2 border-r border-[#dcebd7] ${calc.cessPaid > 0 ? "bg-sky-50" : "bg-white"}`}>
                        <p className="text-[10px] text-[#7a9b7e] font-semibold uppercase tracking-wide mb-1">Paid at Gate</p>
                        <p className={`font-black text-sm ${calc.cessPaid > 0 ? "text-sky-700" : "text-[#b0c4b4]"}`}>
                          {calc.cessPaid > 0 ? inr(calc.cessPaid) : "—"}
                        </p>
                        {calc.cessPaid > 0 && <p className="text-[10px] text-sky-500 mt-0.5">gate entry pending</p>}
                      </div>
                      <div className="py-3 px-2 bg-red-50">
                        <p className="text-[10px] text-[#7a9b7e] font-semibold uppercase tracking-wide mb-1">Balance</p>
                        <p className="font-black text-red-600 text-sm">{inr(calc.cessBalance)}</p>
                        <p className="text-[10px] text-red-400 mt-0.5">from Sarvani</p>
                      </div>
                    </div>
                    {/* Full cess deduction line */}
                    <div className="flex items-center justify-between py-1.5">
                      <p className="text-xs text-[#7a9b7e]">Full market cess deducted</p>
                      <p className="text-sm font-semibold text-red-600">− {inr(calc.cessTotal)}</p>
                    </div>
                    {/* Gate reimbursement line — immediately offsets the cessPaid portion */}
                    {calc.cessPaid > 0 && (
                      <div className="flex items-center justify-between py-1.5 border-t border-dashed border-sky-200">
                        <p className="text-xs text-sky-700">Gate cess reimbursement (bundled in 2101)</p>
                        <p className="text-sm font-semibold text-sky-700">+ {inr(calc.cessPaid)}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Hold Penalty */}
              {(lot.holdPenalty ?? 0) > 0 && (
                <div className="px-4">
                  <StatementRow
                    label="Quality Hold Penalty"
                    sub={lot.holdPenaltyNote ?? "Negotiated penalty"}
                    value={inr(lot.holdPenalty ?? 0)}
                    minus
                  />
                </div>
              )}

              {/* Subtotal 2 — Net Settlement Value */}
              <SubtotalBar
                label="Net Settlement Value"
                sub="After quality deductions and cess"
                value={inr(calc.netSettlementValue)}
              />

              {/* STEP 3 — Akshaya Margin */}
              {lot.businessModel === "A" && (
                <div className="px-4">
                  <StatementRow
                    label="Akshaya Margin"
                    sub={`₹${lot.akshayaMarginPerMT}/MT × ${lot.netWeight.toFixed(3)} MT`}
                    value={inr(spMargin)}
                    minus
                  />
                </div>
              )}

              {/* Final — Supplier Payable */}
              {lot.businessModel === "A" && (
                <SubtotalBar
                  label="Total Supplier Payable (Acc. 2101)"
                  sub={calc.cessPaid > 0 ? `Net settlement value − margin · incl. ${inr(calc.cessPaid)} gate reimb.` : "Net settlement value − Akshaya margin"}
                  value={inr(totalSupplierPayable)}
                  accent
                />
              )}
            </div>
          )}

          {/* ── Ledger Postings ── */}
          {calc && issues.length === 0 && !calc.hasRejectTrigger && (() => {
            // Customer-side rows
            const cessBalance = r2(calc.cessBalance);
            const gstAmt      = r2(calc.netSettlementValue * gstRate);
            const halfGst     = r2(gstAmt / 2);
            const ar          = r2(calc.grossSaleValue - cessBalance + gstAmt);
            const custRows: { label: string; dr: number; cr: number }[] = [
              { label: "1201 Sarvani Receivable", dr: ar, cr: 0 },
              ...(cessBalance > 0 ? [{ label: "5101 Market Cess", dr: cessBalance, cr: 0 }] : []),
              ...calc.paramCalcs.filter(c => c.valueDeduction > 0 && !c.rejectTrigger && c.weightDeductionKg > 0).map(c => {
                const qa = paramQualityAccount(c.paramKey);
                return { label: `${qa.code} ${qa.name}`, dr: r2(c.valueDeduction), cr: 0 };
              }),
              ...(calc.holdPenalty > 0 ? [{ label: "4199 Hold Penalty", dr: calc.holdPenalty, cr: 0 }] : []),
              { label: "3100 Sales — Commodity", dr: 0, cr: grossNotional },
              ...(halfGst > 0 ? [
                { label: "2201 CGST Payable", dr: 0, cr: halfGst },
                { label: "2202 SGST Payable", dr: 0, cr: halfGst },
              ] : []),
            ];
            const custTotal = r2(grossNotional + gstAmt);

            // Supplier-side rows:
            //   Cr 5101 cessTotal (full cess) + Dr 5101 cessPaid (gate reimb.) → net Cr cessBalance
            //   Cr 2101 = settlementPayable + cessPaid = totalSupplierPayable (single payment)
            const cessTotal  = r2(calc.cessTotal);
            const cessPaid   = r2(calc.cessPaid);
            const cessBalance2 = r2(calc.cessBalance);
            const spRows: { label: string; dr: number; cr: number; muted?: boolean; sub?: string }[] = lot.businessModel === "A" ? [
              { label: "5001 Procurement — Commodity", dr: grossNotional, cr: 0 },
              { label: "2101 Supplier Payable", dr: 0, cr: totalSupplierPayable,
                sub: cessPaid > 0 ? `Incl. ₹${cessPaid.toLocaleString("en-IN")} gate reimb.` : undefined },
              ...(cessTotal > 0 ? [{ label: "5101 Market Cess", dr: 0, cr: cessBalance2,
                sub: cessPaid > 0 ? `Cr ${inr(cessTotal)} − Dr ${inr(cessPaid)} gate reimb.` : undefined }] : []),
              { label: "3200 Akshaya Trading Margin", dr: 0, cr: spMargin },
              ...(calc.holdPenalty > 0 ? [{ label: "4199 Hold Penalty", dr: 0, cr: calc.holdPenalty }] : []),
              ...calc.paramCalcs.filter(c => c.valueDeduction > 0 && !c.rejectTrigger).map(c => {
                const qa = paramQualityAccount(c.paramKey);
                return { label: `${qa.code} ${qa.name}`, dr: 0, cr: r2(c.valueDeduction), muted: true };
              }),
            ] : [];

            return (
              <div className="border border-[#dcebd7] rounded-xl overflow-hidden">
                <div className="bg-[#f7faf4] px-4 py-2.5 border-b border-[#dcebd7]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7a9b7e]">Ledger Postings (preview)</p>
                </div>

                {/* Customer side */}
                <div className="px-4 py-2">
                  <p className="text-[10px] font-bold text-[#7a9b7e] uppercase tracking-wide mt-1 mb-1.5">
                    Customer side — Sarvani → Akshaya
                  </p>
                </div>
                <table className="w-full text-xs">
                  <thead className="border-t border-b border-[#f0f6ed]">
                    <tr className="text-[#7a9b7e]">
                      <th className="px-4 py-1.5 text-left font-semibold">Account</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Debit</th>
                      <th className="px-4 py-1.5 text-right font-semibold">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custRows.map((row, i) => (
                      <tr key={i} className="border-t border-[#f5faf3]">
                        <td className="px-4 py-2 text-[#2d3b2e] font-medium">{row.label}</td>
                        <td className="px-4 py-2 text-right font-semibold text-[#172018] tabular-nums">
                          {row.dr > 0 ? inr(row.dr) : <span className="text-[#c5d9c7]">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-[#172018] tabular-nums">
                          {row.cr > 0 ? inr(row.cr) : <span className="text-[#c5d9c7]">—</span>}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#172018] bg-[#f7faf4]">
                      <td className="px-4 py-2 text-xs font-black text-[#172018]">Total</td>
                      <td className="px-4 py-2 text-right text-xs font-black text-[#172018] tabular-nums">{inr(custTotal)}</td>
                      <td className="px-4 py-2 text-right text-xs font-black text-[#172018] tabular-nums">{inr(custTotal)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Supplier side */}
                {lot.businessModel === "A" && spRows.length > 0 && (
                  <>
                    <div className="border-t-4 border-[#f0f6ed]" />
                    <div className="px-4 py-2">
                      <p className="text-[10px] font-bold text-[#7a9b7e] uppercase tracking-wide mt-1 mb-1.5">
                        Supplier side — Akshaya → Supplier
                      </p>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="border-t border-b border-[#f0f6ed]">
                        <tr className="text-[#7a9b7e]">
                          <th className="px-4 py-1.5 text-left font-semibold">Account</th>
                          <th className="px-4 py-1.5 text-right font-semibold">Debit</th>
                          <th className="px-4 py-1.5 text-right font-semibold">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spRows.map((row, i) => (
                          <tr key={i} className={`border-t border-[#f5faf3] ${row.muted ? "opacity-45" : ""}`}>
                            <td className="px-4 py-2 text-[#2d3b2e] font-medium">
                              {row.label}
                              {row.muted && (
                                <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">
                                  info
                                </span>
                              )}
                              {row.sub && <p className="text-[10px] text-[#7a9b7e] mt-0.5 font-normal">{row.sub}</p>}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-[#172018] tabular-nums">
                              {row.dr > 0 ? inr(row.dr) : <span className="text-[#c5d9c7]">—</span>}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-[#172018] tabular-nums">
                              {row.cr > 0 ? inr(row.cr) : <span className="text-[#c5d9c7]">—</span>}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-[#172018] bg-[#f7faf4]">
                          <td className="px-4 py-2 text-xs font-black text-[#172018]">Total</td>
                          <td className="px-4 py-2 text-right text-xs font-black text-[#172018] tabular-nums">{inr(grossNotional)}</td>
                          <td className="px-4 py-2 text-right text-xs font-black text-[#172018] tabular-nums">{inr(grossNotional)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                <div className="px-4 py-2.5 border-t border-[#f0f6ed] bg-[#fafcf9]">
                  <p className="text-[11px] text-[#7a9b7e]">
                    {gstRate === 0
                      ? "GST exempt · Agricultural commodity · Intra-state Andhra Pradesh"
                      : `GST @ ${gstRate * 100}% applied`}
                    {" · "}Grayed rows are pass-through quality entries for audit.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* ── Actions ── */}
          <div className="flex gap-3 pb-1">
            {canPost && (
              <button
                disabled={confirming}
                onClick={async () => {
                  if (confirming) return;
                  setConfirming(true);
                  try { await onApprove!(); } finally { setConfirming(false); }
                }}
                className="flex-1 bg-[#172018] text-[#d8ff72] text-sm font-black py-3.5 rounded-xl hover:bg-[#263b25] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming ? "Posting…" : "Confirm & Post Settlement"}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 border-2 border-[#dcebd7] text-[#172018] text-sm font-bold py-3.5 rounded-xl hover:bg-[#f7faf4] active:scale-[0.98] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
