"use client";
import { useMemo } from "react";
import { calculateLotSettlement, validateLotForSettlement } from "@/lib/settlement/engine";
import type { InwardLot, QualityRule, MaterialParam } from "@/lib/types";

interface Props {
  lot: InwardLot;
  rule: QualityRule | undefined;
  allRules: QualityRule[];
  materialParams?: MaterialParam[];
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

function DeductionRow({ label, weightKg, amount, breakdown, rejectTrigger }: {
  label: string; weightKg: number; amount: number; breakdown: string; rejectTrigger: boolean;
}) {
  if (rejectTrigger) {
    return (
      <div className="py-2.5 border-b border-[#f0f4ec] last:border-0">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#172018]">{label}</p>
          <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">HOLD TRIGGER</span>
        </div>
        <p className="text-xs text-red-600 mt-0.5">{breakdown}</p>
      </div>
    );
  }
  const hasDeduction = amount > 0 || weightKg > 0;
  return (
    <div className="py-2.5 border-b border-[#f0f4ec] last:border-0">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#172018]">{label}</p>
        <p className={`text-sm font-semibold ${hasDeduction ? "text-red-600" : "text-[#5a7360]"}`}>
          {hasDeduction
            ? `− ₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
            : "Nil"}
        </p>
      </div>
      {hasDeduction && (
        <p className="text-xs text-[#5a7360] mt-0.5">
          {breakdown}
          {weightKg > 0 && ` · ${weightKg.toFixed(2)} kg weight equiv.`}
        </p>
      )}
      {!hasDeduction && <p className="text-xs text-[#5a7360] mt-0.5">{breakdown}</p>}
    </div>
  );
}

export default function SettlementPreview({ lot, rule, allRules, materialParams, onClose, onApprove }: Props) {
  const calc = useMemo(
    () => (rule ? calculateLotSettlement(lot, rule) : null),
    [lot, rule]
  );
  const issues = useMemo(
    () => validateLotForSettlement(lot, allRules, materialParams),
    [lot, allRules, materialParams]
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
  const fmtWt = (n: number) => `${n.toFixed(3)} MT`;

  // Separate paramCalcs by role for display
  const weightDeductionCalcs = calc?.paramCalcs.filter(
    (c) => c.weightDeductionKg > 0 || c.rejectTrigger
  ) ?? [];
  const valueOnlyCalcs = calc?.paramCalcs.filter(
    (c) => c.weightDeductionKg === 0 && c.valueDeduction > 0 && !c.rejectTrigger
  ) ?? [];
  const infoCalcs = calc?.paramCalcs.filter(
    (c) => c.weightDeductionKg === 0 && c.valueDeduction === 0 && !c.rejectTrigger
  ) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#172018] text-white rounded-t-2xl px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#d8ff72]">Settlement Preview</p>
            <h2 className="text-lg font-black mt-0.5">{lot.documentRef}</h2>
            <p className="text-xs text-white/60 mt-0.5">
              {lot.materialName} · Model {lot.businessModel} · {lot.lotDate}
              {rule && ` · ${rule.pricingModel === "rate-slab" ? "Rate-slab pricing" : "Deduction pricing"}`}
            </p>
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
              No quality rule assigned to this lot. Cannot compute settlement.
            </div>
          )}

          {/* Reject triggers */}
          {calc?.hasRejectTrigger && (
            <div className="border border-red-200 rounded-xl bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                Quality hold triggered by: {calc.rejectedParams.join(", ")}
              </p>
              <p className="text-xs text-red-600 mt-1">
                This lot should move to QualityHold status. Review and override to proceed.
              </p>
            </div>
          )}

          {/* Quality readings */}
          {rule && Object.keys(lot.qualityReadings).length > 0 && (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">
                Quality Readings (Rule {rule.id})
              </p>
              <div className="border border-[#d1e0c8] rounded-xl px-4 py-1">
                {rule.paramRules.map((pr) => {
                  const reading = lot.qualityReadings[pr.paramKey];
                  if (reading === undefined) return null;
                  const label = pr.label ?? pr.paramKey;
                  const baseVal = pr.baseValue !== undefined ? `Base: ${pr.baseValue}` : "";
                  const excess = typeof reading === "number" && pr.baseValue !== undefined
                    ? Math.max(0, reading - pr.baseValue)
                    : undefined;
                  const excessStr = excess !== undefined && excess > 0 ? ` · Excess: ${excess.toFixed(2)}` : "";
                  return (
                    <Row
                      key={pr.paramKey}
                      label={label}
                      value={`${reading}${typeof reading === "number" && pr.rateSlabs?.length ? "" : ""}`}
                      sub={[baseVal, excessStr].filter(Boolean).join("") || undefined}
                      highlight={typeof reading === "number" && pr.baseValue !== undefined && reading > pr.baseValue}
                    />
                  );
                })}
                {rule.pricingModel === "rate-slab" && calc && (
                  <Row label="Computed Rate" value={`₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT`} highlight />
                )}
                <Row label="Cess Rate" value={`${rule.globalCessRate}%`} />
                <Row label="Rule Valid" value={`${rule.validFrom} → ${rule.validTo ?? "open"}`} />
              </div>
            </section>
          )}

          {/* Weights */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">Weights</p>
            <div className="border border-[#d1e0c8] rounded-xl px-4 py-1">
              <Row label="Gross Weight" value={fmtWt(lot.grossWeight)} />
              <Row label="Tare Weight" value={`− ${fmtWt(lot.tareWeight)}`} />
              <Row label="Net Weight" value={fmtWt(lot.netWeight)} highlight />
              {weightDeductionCalcs.map((c) => (
                <Row
                  key={c.paramKey}
                  label={`${c.label} deduction`}
                  value={c.rejectTrigger ? "HOLD" : `− ${(c.weightDeductionKg / 1000).toFixed(4)} MT`}
                  sub={c.breakdown}
                />
              ))}
              {calc && (
                <Row label="Net Payable Weight" value={fmtWt(calc.netPayableWeight)} highlight />
              )}
            </div>
          </section>

          {/* Settlement value */}
          {calc && (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">Settlement Value</p>
              <div className="border border-[#d1e0c8] rounded-xl px-4 py-1">
                <Row
                  label="Gross Sale Rate"
                  value={`₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT`}
                  sub={rule?.pricingModel === "rate-slab" ? "Computed from quality reading" : "Pre-agreed rate"}
                />
                <Row
                  label="Gross Sale Value"
                  value={fmt(calc.grossSaleValue)}
                  sub={`${fmtWt(calc.netPayableWeight)} × ₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT`}
                  highlight
                />
                {/* Weight-based deductions (already reflected in grossSaleValue) */}
                {weightDeductionCalcs.filter(c => !c.rejectTrigger).map((c) => (
                  <DeductionRow
                    key={c.paramKey}
                    label={`${c.label} (weight deduction)`}
                    weightKg={c.weightDeductionKg}
                    amount={c.valueDeduction}
                    breakdown={c.breakdown}
                    rejectTrigger={false}
                  />
                ))}
                {/* Value-only deductions */}
                {valueOnlyCalcs.map((c) => (
                  <DeductionRow
                    key={c.paramKey}
                    label={c.label}
                    weightKg={0}
                    amount={c.valueDeduction}
                    breakdown={c.breakdown}
                    rejectTrigger={false}
                  />
                ))}
                {/* Reject triggers */}
                {calc.paramCalcs.filter(c => c.rejectTrigger).map((c) => (
                  <DeductionRow
                    key={c.paramKey}
                    label={c.label}
                    weightKg={0}
                    amount={0}
                    breakdown={c.breakdown}
                    rejectTrigger
                  />
                ))}
                {/* Info-only params */}
                {infoCalcs.length > 0 && (
                  <div className="py-2 border-b border-[#f0f4ec]">
                    <p className="text-xs text-[#5a7360]">
                      Info only: {infoCalcs.map(c => `${c.label} = ${c.reading}`).join(" · ")}
                    </p>
                  </div>
                )}
                <DeductionRow
                  label={`Cess (${rule?.globalCessRate}% on net wt × rate)`}
                  weightKg={0}
                  amount={calc.cessAmount}
                  breakdown={`${rule?.globalCessRate}% × ${fmtWt(calc.netWeight)} × ₹${calc.grossSaleRate}/MT = ₹${calc.cessAmount.toFixed(2)}`}
                  rejectTrigger={false}
                />
                <div className="flex items-center justify-between py-3 mt-1 border-t-2 border-[#172018]">
                  <p className="text-base font-black text-[#172018]">Net Settlement Value</p>
                  <p className="text-base font-black text-[#172018]">{fmt(calc.netSettlementValue)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Ledger postings preview */}
          {calc && issues.length === 0 && !calc.hasRejectTrigger && (
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
                    {[
                      { acc: "1201 Sarvani Receivable", dr: calc.netSettlementValue * 1.05, cr: 0 },
                      { acc: "3100 Sales — Commodity", dr: 0, cr: calc.netSettlementValue },
                      { acc: "2201 CGST Payable", dr: 0, cr: calc.netSettlementValue * 0.025 },
                      { acc: "2202 SGST Payable", dr: 0, cr: calc.netSettlementValue * 0.025 },
                    ].map((row) => (
                      <tr key={row.acc} className="border-t border-[#f0f4ec]">
                        <td className="px-3 py-2">{row.acc}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#172018]">
                          {row.dr > 0 ? fmt(row.dr) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-[#172018]">
                          {row.cr > 0 ? fmt(row.cr) : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#172018] bg-[#f7faf4] font-bold">
                      <td className="px-3 py-2 text-[#172018]">Total</td>
                      <td className="px-3 py-2 text-right text-[#172018]">{fmt(calc.netSettlementValue * 1.05)}</td>
                      <td className="px-3 py-2 text-right text-[#172018]">{fmt(calc.netSettlementValue * 1.05)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#5a7360] mt-1">GST @ 5% — intra-state supply to Andhra Pradesh</p>
            </section>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {onApprove && issues.length === 0 && calc && !calc.hasRejectTrigger && (
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
