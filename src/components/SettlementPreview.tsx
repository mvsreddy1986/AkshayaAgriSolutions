"use client";
import { useMemo } from "react";
import { calculateLotSettlement, validateLotForSettlement } from "@/lib/settlement/engine";
import type { InwardLot, QualityRule } from "@/lib/types";

interface Props {
  lot: InwardLot;
  rule: QualityRule | undefined;
  allRules: QualityRule[];
  onClose: () => void;
  onApprove?: () => void;
}

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`flex items-start justify-between py-2.5 border-b border-[#f0f4ec] last:border-0 ${highlight ? "bg-[#f7fdf0] -mx-4 px-4 rounded" : ""}`}>
      <div>
        <p className="text-sm text-[#172018]">{label}</p>
        {sub && <p className="text-xs text-[#5a7360] mt-0.5">{sub}</p>}
      </div>
      <p className={`text-sm font-semibold text-right ml-4 ${highlight ? "text-[#172018]" : "text-[#5a7360]"}`}>{value}</p>
    </div>
  );
}

function DeductionRow({ label, amount, breakdown, isZero }: { label: string; amount: number; breakdown: string; isZero: boolean }) {
  return (
    <div className="py-2.5 border-b border-[#f0f4ec] last:border-0">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#172018]">{label}</p>
        <p className={`text-sm font-semibold ${isZero ? "text-[#5a7360]" : "text-red-600"}`}>
          {isZero ? "Nil" : `− ₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
        </p>
      </div>
      {!isZero && <p className="text-xs text-[#5a7360] mt-0.5">{breakdown}</p>}
    </div>
  );
}

export default function SettlementPreview({ lot, rule, allRules, onClose, onApprove }: Props) {
  const calc = useMemo(() => rule ? calculateLotSettlement(lot, rule) : null, [lot, rule]);
  const issues = useMemo(() => validateLotForSettlement(lot, allRules), [lot, allRules]);

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
  const fmtWt = (n: number) => `${n.toFixed(3)} MT`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#172018] text-white rounded-t-2xl px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#d8ff72]">Settlement Preview</p>
            <h2 className="text-lg font-black mt-0.5">{lot.documentRef}</h2>
            <p className="text-xs text-white/60 mt-0.5">{lot.materialName} · Model {lot.businessModel} · {lot.lotDate}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none mt-1">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Blocking issues */}
          {issues.length > 0 && (
            <div className="border border-red-200 rounded-xl bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700 mb-2">Cannot settle — resolve these first:</p>
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="text-xs text-red-600 flex gap-2">
                    <span>•</span><span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!rule && (
            <div className="border border-amber-200 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              No quality rule found for this lot (rule ID: {lot.qualityRuleId}). Cannot compute settlement.
            </div>
          )}

          {/* Weights section */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">Weights</p>
            <div className="border border-[#d1e0c8] rounded-xl px-4 py-1">
              <Row label="Gross Weight" value={fmtWt(lot.grossWeight)} />
              <Row label="Tare Weight" value={`− ${fmtWt(lot.tareWeight)}`} />
              <Row label="Net Weight" value={fmtWt(lot.netWeight)} highlight />
              {calc && calc.moistureDeductionKg > 0 && (
                <Row label="Moisture Deduction (weight equiv.)" value={`− ${(calc.moistureDeductionKg / 1000).toFixed(4)} MT`} sub={calc.moistureBreakdown} />
              )}
              {calc && calc.fmDeductionKg > 0 && (
                <Row label="FM Deduction (weight equiv.)" value={`− ${(calc.fmDeductionKg / 1000).toFixed(4)} MT`} sub={calc.fmBreakdown} />
              )}
              {calc && <Row label="Net Payable Weight" value={fmtWt(calc.netPayableWeight)} highlight />}
            </div>
          </section>

          {/* Quality section */}
          {rule && (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">Quality (Rule {rule.id})</p>
              <div className="border border-[#d1e0c8] rounded-xl px-4 py-1">
                <Row
                  label="Moisture"
                  value={`${lot.moisturePct}%`}
                  sub={`Base: ${rule.baseMoisture}% · Excess: ${Math.max(0, lot.moisturePct - rule.baseMoisture).toFixed(1)}%`}
                  highlight={lot.moisturePct > rule.baseMoisture}
                />
                <Row
                  label="Foreign Matter"
                  value={`${lot.fmPct}%`}
                  sub={`Method: ${rule.fmDeductionMethod}`}
                  highlight={lot.fmPct > 0}
                />
                <Row label="Cess Rate" value={`${rule.cessRate}%`} />
                <Row label="Rule Valid" value={`${rule.validFrom} → ${rule.validTo || "open"}`} />
              </div>
            </section>
          )}

          {/* Value section */}
          {calc && (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">Settlement Value</p>
              <div className="border border-[#d1e0c8] rounded-xl px-4 py-1">
                <Row label="Gross Sale Rate" value={`₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT`} />
                <Row label="Gross Sale Value" value={fmt(calc.grossSaleValue)} sub={`${fmtWt(calc.netPayableWeight)} × ₹${calc.grossSaleRate}/MT`} />
                <DeductionRow label="Moisture Deduction" amount={calc.moistureDeductionAmt} breakdown={calc.moistureBreakdown} isZero={calc.moistureDeductionAmt === 0} />
                <DeductionRow label="FM Deduction" amount={calc.fmDeductionAmt} breakdown={calc.fmBreakdown} isZero={calc.fmDeductionAmt === 0} />
                <DeductionRow label="Cess" amount={calc.cessAmount} breakdown={calc.cessBreakdown} isZero={calc.cessAmount === 0} />
                <div className="flex items-center justify-between py-3 mt-1 border-t-2 border-[#172018]">
                  <p className="text-base font-black text-[#172018]">Net Settlement Value</p>
                  <p className="text-base font-black text-[#172018]">{fmt(calc.netSettlementValue)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Ledger postings preview */}
          {calc && issues.length === 0 && (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">Ledger Postings (preview)</p>
              <div className="border border-[#d1e0c8] rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[#f7faf4]">
                    <tr className="text-[#5a7360] text-left">
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2 text-right">Dr</th>
                      <th className="px-3 py-2 text-right">Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[#f0f4ec]">
                      <td className="px-3 py-2">1201 Sarvani Biofuels Receivable</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#172018]">
                        {fmt(calc.netSettlementValue * 1.05)}
                      </td>
                      <td className="px-3 py-2 text-right text-[#5a7360]">—</td>
                    </tr>
                    <tr className="border-t border-[#f0f4ec]">
                      <td className="px-3 py-2">3100 Sales — Commodity</td>
                      <td className="px-3 py-2 text-right text-[#5a7360]">—</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#172018]">
                        {fmt(calc.netSettlementValue)}
                      </td>
                    </tr>
                    <tr className="border-t border-[#f0f4ec]">
                      <td className="px-3 py-2">2201 CGST Payable</td>
                      <td className="px-3 py-2 text-right text-[#5a7360]">—</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#172018]">
                        {fmt(calc.netSettlementValue * 0.025)}
                      </td>
                    </tr>
                    <tr className="border-t border-[#f0f4ec]">
                      <td className="px-3 py-2">2202 SGST Payable</td>
                      <td className="px-3 py-2 text-right text-[#5a7360]">—</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#172018]">
                        {fmt(calc.netSettlementValue * 0.025)}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-[#172018] bg-[#f7faf4] font-bold">
                      <td className="px-3 py-2 text-[#172018]">Total</td>
                      <td className="px-3 py-2 text-right text-[#172018]">{fmt(calc.netSettlementValue * 1.05)}</td>
                      <td className="px-3 py-2 text-right text-[#172018]">{fmt(calc.netSettlementValue * 1.05)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#5a7360] mt-1">GST @ 5% (CGST 2.5% + SGST 2.5%) — intra-state supply to Andhra Pradesh</p>
            </section>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {onApprove && issues.length === 0 && calc && (
              <button
                onClick={onApprove}
                className="flex-1 bg-[#172018] text-[#d8ff72] text-sm font-black py-3 rounded-xl hover:bg-[#2a3b29] transition"
              >
                Approve & Post Settlement
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 border border-[#d1e0c8] text-[#172018] text-sm font-black py-3 rounded-xl hover:bg-[#f7faf4] transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
