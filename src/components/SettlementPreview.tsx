"use client";
import { useMemo } from "react";
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

export default function SettlementPreview({ lot, rule, allRules, materialParams, material, onClose, onApprove }: Props) {
  const gstRate = (material?.gstRate ?? 0) / 100;
  const calc = useMemo(
    () => (rule ? calculateLotSettlement(lot, rule, material?.cessRate) : null),
    [lot, rule, material]
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

          {/* Reject triggers (active hold) */}
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

          {/* Extended deduction notice — hold accepted without fixed penalty */}
          {!calc?.hasRejectTrigger && lot.overrideReason && (lot.holdPenalty ?? 0) === 0 && (
            <div className="border border-amber-200 rounded-xl bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Accepted from Quality Hold — deductions extended</p>
              <p className="text-xs text-amber-700 mt-1">
                Lot was on hold ({lot.overrideReason}). No fixed penalty — quality deductions are calculated using the
                actual reading through the reject threshold.
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
                <Row label="Cess Rate" value={`${calc?.effectiveCessRate ?? rule.globalCessRate}%`} />
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
                  label="Gross Sale Amount"
                  value={fmt(Math.round(calc.netWeight * calc.grossSaleRate * 100) / 100)}
                  sub={`${fmtWt(calc.netWeight)} × ₹${calc.grossSaleRate.toLocaleString("en-IN")}/MT (full net weight)`}
                  highlight
                />
                {/* Quality weight deductions — explicitly reduce the gross */}
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
                {calc.cessPaid > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
                    <div>
                      <span className="font-semibold">Cess paid at gate (info only)</span>
                      <span className="ml-2 text-amber-600">Already settled at mandi — not in this settlement</span>
                    </div>
                    <span className="font-semibold">₹{calc.cessPaid.toFixed(2)}</span>
                  </div>
                )}
                <DeductionRow
                  label={`Market Cess (${calc.effectiveCessRate}%) — balance`}
                  weightKg={0}
                  amount={calc.cessBalance}
                  breakdown={`${calc.effectiveCessRate}% × ₹${calc.grossSaleValue.toFixed(2)} = ₹${calc.cessTotal.toFixed(2)} total · ₹${calc.cessPaid.toFixed(2)} gate paid · balance ₹${calc.cessBalance.toFixed(2)}`}
                  rejectTrigger={false}
                />
                {calc.holdPenalty > 0 && (
                  <DeductionRow
                    label="Quality Hold Penalty"
                    weightKg={0}
                    amount={calc.holdPenalty}
                    breakdown={lot.holdPenaltyNote ?? "Negotiated penalty for accepting out-of-spec lot"}
                    rejectTrigger={false}
                  />
                )}
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
                    {(() => {
                      // Gross notional = full net weight at sale rate (base quality, pre-deduction)
                      const grossNotional = Math.round(calc.netWeight * calc.grossSaleRate * 100) / 100;
                      const gstAmount = Math.round(calc.netSettlementValue * gstRate * 100) / 100;
                      const halfGst = Math.round(gstAmount / 2 * 100) / 100;

                      // Weight-based quality deductions only (value-only are informational)
                      const qualityRows = calc.paramCalcs
                        .filter(c => c.valueDeduction > 0 && !c.rejectTrigger && c.weightDeductionKg > 0)
                        .map(c => {
                          const acc = paramQualityAccount(c.paramKey);
                          return { acc: `${acc.code} ${acc.name}`, dr: c.valueDeduction, cr: 0 };
                        });

                      const rows: { acc: string; dr: number; cr: number; info?: boolean }[] = [
                        { acc: "1201 Sarvani Receivable", dr: Math.round((calc.netSettlementValue + gstAmount) * 100) / 100, cr: 0 },
                        ...(calc.cessBalance > 0 ? [{ acc: "5101 Market Cess — Balance", dr: calc.cessBalance, cr: 0 }] : []),
                        ...(calc.cessPaid > 0 ? [{ acc: "5101 Market Cess — Gate (paid, info)", dr: calc.cessPaid, cr: 0, info: true }] : []),
                        ...qualityRows,
                        ...(calc.holdPenalty > 0 ? [{ acc: "4199 Quality Loss — Hold Penalty", dr: calc.holdPenalty, cr: 0 }] : []),
                        { acc: "3100 Sales — Commodity", dr: 0, cr: grossNotional },
                        ...(halfGst > 0 ? [
                          { acc: "2201 CGST Payable", dr: 0, cr: halfGst },
                          { acc: "2202 SGST Payable", dr: 0, cr: halfGst },
                        ] : []),
                      ];
                      const total = Math.round((grossNotional + gstAmount) * 100) / 100;
                      return (
                        <>
                          {rows.map((row) => (
                            <tr key={row.acc} className={`border-t border-[#f0f4ec] ${row.info ? "opacity-50 italic" : ""}`}>
                              <td className="px-3 py-2">{row.acc}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${row.info ? "text-amber-700" : "text-[#172018]"}`}>
                                {row.dr > 0 ? fmt(row.dr) : "—"}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${row.info ? "text-amber-700" : "text-[#172018]"}`}>
                                {row.cr > 0 ? fmt(row.cr) : "—"}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-[#172018] bg-[#f7faf4] font-bold">
                            <td className="px-3 py-2 text-[#172018]">Total</td>
                            <td className="px-3 py-2 text-right text-[#172018]">{fmt(total)}</td>
                            <td className="px-3 py-2 text-right text-[#172018]">{fmt(total)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#5a7360] mt-1">
                {gstRate === 0
                  ? "GST exempt — agricultural commodity, intra-state Andhra Pradesh"
                  : `GST @ ${gstRate * 100}% — intra-state supply`}
              </p>
            </section>
          )}

          {/* Supplier-side ledger */}
          {calc && issues.length === 0 && !calc.hasRejectTrigger && lot.businessModel === "A" && (() => {
            const spMargin = Math.round(lot.akshayaMarginPerMT * lot.netWeight * 100) / 100;
            // Dr 5001 = gross notional (netWeight × rate, BEFORE quality deductions)
            // This mirrors the Cr 3100 on the customer side so supplier sees the full picture.
            const grossNotional = Math.round(calc.netWeight * calc.grossSaleRate * 100) / 100;
            // Supplier receives: grossSaleValue − cessBalance − margin − holdPenalty
            // cessPaid was already settled at the gate; only cessBalance flows through settlement
            const supplierPayable = Math.round((calc.grossSaleValue - calc.cessBalance - spMargin - calc.holdPenalty) * 100) / 100;

            // Build rows — info:true rows are greyed out / amber-badged; not posted to supplier's 2101 a/c
            const spRows: { acc: string; dr: number; cr: number; info?: boolean }[] = [
              { acc: "5001 Procurement — Commodity", dr: grossNotional, cr: 0 },
              { acc: "2101 Supplier Payable", dr: 0, cr: supplierPayable },
              // Quality deductions — shown for information only (not formally charged to supplier)
              ...calc.paramCalcs
                .filter(c => c.valueDeduction > 0 && !c.rejectTrigger)
                .map(c => {
                  const qa = paramQualityAccount(c.paramKey);
                  return {
                    acc: `${qa.code} ${qa.name}`,
                    dr: 0, cr: c.valueDeduction, info: true as const,
                  };
                }),
              // Cess balance — mirrors customer-side Dr 5101
              ...(calc.cessBalance > 0
                ? [{ acc: "5101 Market Cess — Balance", dr: 0, cr: calc.cessBalance }]
                : []),
              { acc: "3200 Akshaya Trading Margin", dr: 0, cr: spMargin },
              ...(calc.holdPenalty > 0
                ? [{ acc: "4199 Quality Hold Penalty", dr: 0, cr: calc.holdPenalty }]
                : []),
            ];
            // Proof: supplierPayable + qualityDeductions + cessBalance + margin + holdPenalty
            //      = (grossSaleValue − cessBalance − margin − holdPenalty) + qualityDeductions + cessBalance + margin + holdPenalty
            //      = grossSaleValue + qualityDeductions = grossNotional ✓

            return (
              <section>
                <p className="text-xs font-bold uppercase tracking-wider text-[#5a7360] mb-2">Supplier Payout (preview)</p>
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
                      {spRows.map((row) => (
                        <tr
                          key={row.acc}
                          className={`border-t border-[#f0f4ec] ${row.info ? "opacity-60" : ""}`}
                        >
                          <td className={`px-3 py-2 ${row.info ? "italic text-[#9aad9c]" : ""}`}>
                            {row.acc}
                            {row.info && (
                              <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700 not-italic">
                                info
                              </span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${row.info ? "text-[#9aad9c]" : "text-[#172018]"}`}>
                            {row.dr > 0 ? fmt(row.dr) : "—"}
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${row.info ? "text-[#9aad9c]" : "text-[#172018]"}`}>
                            {row.cr > 0 ? fmt(row.cr) : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[#172018] bg-[#f7faf4] font-bold">
                        <td className="px-3 py-2 text-[#172018]">Total</td>
                        <td className="px-3 py-2 text-right text-[#172018]">{fmt(grossNotional)}</td>
                        <td className="px-3 py-2 text-right text-[#172018]">{fmt(grossNotional)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-[#5a7360] mt-1.5">
                  <strong>Net to supplier (2101):</strong> {fmt(supplierPayable)}
                  {" · "}Akshaya margin ₹{lot.akshayaMarginPerMT}/MT × {lot.netWeight.toFixed(3)} MT = {fmt(spMargin)}
                  {calc.cessBalance > 0 && ` · Cess balance ${fmt(calc.cessBalance)} deducted`}
                  {calc.cessPaid > 0 && ` · Gate cess ${fmt(calc.cessPaid)} already settled at mandi`}
                  {calc.holdPenalty > 0 && ` · Hold penalty ${fmt(calc.holdPenalty)} deducted`}
                </p>
              </section>
            );
          })()}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {onApprove && lot.status === "Approved" && issues.length === 0 && calc && !calc.hasRejectTrigger && (
              <button
                onClick={onApprove}
                className="flex-1 bg-[#172018] text-[#d8ff72] text-sm font-black py-3 rounded-xl hover:bg-[#2a3b29] transition"
              >
                Confirm &amp; Post Settlement
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
