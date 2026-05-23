"use client";
import { useState, useMemo } from "react";
import {
  INWARD_LOTS as lots,
  INVOICES as invoices,
  QUALITY_RULES as qualityRules,
} from "@/lib/data/seed";

// ── Exception detection ────────────────────────────────────────────────────

function detectQualityHolds() {
  return lots
    .filter((l) => l.status === "QualityHold")
    .map((l) => ({
      id: l.id,
      ref: l.documentRef,
      material: l.materialName,
      date: l.lotDate,
      party: l.supplierName ?? l.farmerName ?? "—",
      moisture: l.moisturePct,
      fm: l.fmPct,
      netWt: l.netWeight,
      model: l.businessModel,
      reason: l.moisturePct > 16 ? `Moisture ${l.moisturePct}% exceeds 16% limit`
        : l.fmPct > 2 ? `FM ${l.fmPct}% exceeds 2% limit`
        : "Quality hold — awaiting review",
    }));
}

function detectUnmatchedLots() {
  return lots
    .filter((l) => l.status === "Approved" && !l.invoiceId)
    .map((l) => ({
      id: l.id,
      ref: l.documentRef,
      material: l.materialName,
      date: l.lotDate,
      party: l.customerName,
      netPayable: l.netPayableWeight,
      value: l.grossSaleValue,
      model: l.businessModel,
      ageInDays: Math.floor((Date.now() - new Date(l.lotDate).getTime()) / 86400000),
    }));
}

function detectOverdueInvoices() {
  const today = new Date("2026-05-22");
  return invoices
    .filter((inv) => inv.status !== "Paid" && inv.status !== "Cancelled" && new Date(inv.dueDate) < today)
    .map((inv) => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      party: inv.partyName,
      dueDate: inv.dueDate,
      amountDue: inv.amountDue,
      overdueDays: Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000),
      status: inv.status,
    }));
}

function detectDuplicateRefs() {
  const refCount = new Map<string, number>();
  for (const l of lots) {
    refCount.set(l.documentRef, (refCount.get(l.documentRef) ?? 0) + 1);
  }
  return Array.from(refCount.entries())
    .filter(([, count]) => count > 1)
    .map(([ref, count]) => ({
      ref,
      count,
      lots: lots.filter((l) => l.documentRef === ref).map((l) => l.id),
    }));
}

function detectExpiredRules() {
  const today = "2026-05-22";
  return qualityRules
    .filter((r) => r.validTo && r.validTo < today && r.status !== "Expired")
    .map((r) => ({
      id: r.id,
      material: r.materialName,
      validTo: r.validTo,
      status: r.status,
      affectedLots: lots.filter((l) => l.qualityRuleId === r.id && new Date(l.lotDate) > new Date(r.validTo)).length,
    }));
}

function detectUnsettledOldLots() {
  const cutoff = new Date("2026-04-22"); // older than 30 days
  return lots
    .filter((l) => l.status === "Mapped" && new Date(l.lotDate) < cutoff)
    .map((l) => ({
      id: l.id,
      ref: l.documentRef,
      material: l.materialName,
      date: l.lotDate,
      supplier: l.supplierName ?? l.farmerName ?? "—",
      ageDays: Math.floor((Date.now() - new Date(l.lotDate).getTime()) / 86400000),
      model: l.businessModel,
    }));
}

// ── Components ─────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info";

function SeverityBadge({ s }: { s: Severity }) {
  const cfg = {
    critical: "bg-red-100 text-red-700 border border-red-200",
    warning: "bg-amber-100 text-amber-700 border border-amber-200",
    info: "bg-blue-100 text-blue-700 border border-blue-200",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg[s]}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function ExceptionCard({
  title, count, severity, description, children, defaultOpen = false,
}: {
  title: string; count: number; severity: Severity; description: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const borderColor = severity === "critical" ? "border-red-300" : severity === "warning" ? "border-amber-300" : "border-blue-300";
  const headerBg = severity === "critical" ? "bg-red-50" : severity === "warning" ? "bg-amber-50" : "bg-blue-50";

  if (count === 0) {
    return (
      <div className="border border-[#d1e0c8] rounded-xl bg-white p-4 flex items-center gap-3">
        <span className="text-green-500 text-xl">✓</span>
        <div>
          <p className="font-semibold text-[#172018] text-sm">{title}</p>
          <p className="text-xs text-[#5a7360]">No exceptions — all clear</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border ${borderColor} rounded-xl bg-white overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full ${headerBg} px-5 py-4 flex items-center justify-between text-left`}
      >
        <div className="flex items-center gap-3">
          <SeverityBadge s={severity} />
          <div>
            <p className="font-semibold text-[#172018] text-sm">{title}</p>
            <p className="text-xs text-[#5a7360] mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xl font-bold ${severity === "critical" ? "text-red-600" : severity === "warning" ? "text-amber-600" : "text-blue-600"}`}>
            {count}
          </span>
          <span className="text-[#5a7360] text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type TabId = "overview" | "quality" | "invoices" | "lots" | "rules";

export default function ExceptionCenterPage() {
  const [tab, setTab] = useState<TabId>("overview");

  const qualityHolds = useMemo(detectQualityHolds, []);
  const unmatchedLots = useMemo(detectUnmatchedLots, []);
  const overdueInvs = useMemo(detectOverdueInvoices, []);
  const dupRefs = useMemo(detectDuplicateRefs, []);
  const expiredRulesFound = useMemo(detectExpiredRules, []);
  const oldUnsettled = useMemo(detectUnsettledOldLots, []);

  const totalExceptions = qualityHolds.length + unmatchedLots.length + overdueInvs.length + dupRefs.length + expiredRulesFound.length + oldUnsettled.length;
  const criticalCount = qualityHolds.length + overdueInvs.length + dupRefs.length;
  const warningCount = unmatchedLots.length + expiredRulesFound.length + oldUnsettled.length;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "overview", label: "Overview", count: totalExceptions },
    { id: "quality", label: "Quality Issues", count: qualityHolds.length + expiredRulesFound.length },
    { id: "invoices", label: "Invoice Alerts", count: overdueInvs.length },
    { id: "lots", label: "Lot Issues", count: unmatchedLots.length + dupRefs.length + oldUnsettled.length },
    { id: "rules", label: "Rule Violations", count: expiredRulesFound.length },
  ];

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#172018]">Exception Center</h1>
          <p className="text-sm text-[#5a7360] mt-1">
            Automated detection of mismatches, quality holds, overdue items, and data integrity issues
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#5a7360]">As of 22 May 2026 — 09:14 IST</p>
          <button className="mt-1 text-xs text-[#172018] font-semibold underline">Refresh</button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-red-200 rounded-xl bg-red-50 p-4">
          <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          <p className="text-sm font-semibold text-red-700 mt-0.5">Critical</p>
          <p className="text-xs text-red-500 mt-1">Require immediate action</p>
        </div>
        <div className="border border-amber-200 rounded-xl bg-amber-50 p-4">
          <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
          <p className="text-sm font-semibold text-amber-700 mt-0.5">Warnings</p>
          <p className="text-xs text-amber-500 mt-1">Review within 24 hours</p>
        </div>
        <div className="border border-[#d1e0c8] rounded-xl bg-[#f7faf4] p-4">
          <p className="text-2xl font-bold text-[#172018]">{totalExceptions}</p>
          <p className="text-sm font-semibold text-[#172018] mt-0.5">Total Open</p>
          <p className="text-xs text-[#5a7360] mt-1">Across all categories</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#d1e0c8] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap flex items-center gap-2 border-b-2 transition-colors ${
              tab === t.id
                ? "border-[#172018] text-[#172018]"
                : "border-transparent text-[#5a7360] hover:text-[#172018]"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                t.id === "invoices" || (t.id === "quality" && qualityHolds.length > 0)
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-4">
          <p className="text-sm text-[#5a7360]">Click any category to expand — exceptions that block financial posting are shown first.</p>

          <ExceptionCard title="Quality Holds" count={qualityHolds.length} severity="critical"
            description="Lots flagged for out-of-spec moisture or FM — cannot be settled until resolved" defaultOpen>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#5a7360] border-b border-[#d1e0c8]">
                  <th className="pb-2 pr-4">Document Ref</th>
                  <th className="pb-2 pr-4">Material</th>
                  <th className="pb-2 pr-4">Moisture %</th>
                  <th className="pb-2 pr-4">FM %</th>
                  <th className="pb-2 pr-4">Party</th>
                  <th className="pb-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {qualityHolds.map((h) => (
                  <tr key={h.id} className="border-b border-[#f0f4ec] last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs text-[#172018]">{h.ref}</td>
                    <td className="py-2 pr-4 text-[#172018]">{h.material}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${h.moisture > 16 ? "text-red-600" : "text-[#172018]"}`}>{h.moisture}%</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${h.fm > 2 ? "text-red-600" : "text-[#172018]"}`}>{h.fm}%</span>
                    </td>
                    <td className="py-2 pr-4 text-[#5a7360]">{h.party}</td>
                    <td className="py-2 text-xs text-red-600">{h.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex gap-2">
              <button className="px-3 py-1.5 bg-[#172018] text-[#d8ff72] text-xs font-semibold rounded-lg">Override with Reason</button>
              <button className="px-3 py-1.5 border border-[#d1e0c8] text-[#172018] text-xs font-semibold rounded-lg">Release Hold</button>
              <button className="px-3 py-1.5 border border-[#d1e0c8] text-[#172018] text-xs font-semibold rounded-lg">Reject Lot</button>
            </div>
          </ExceptionCard>

          <ExceptionCard title="Overdue Invoices" count={overdueInvs.length} severity="critical"
            description="Invoices past due date with outstanding balance — affects cash flow">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#5a7360] border-b border-[#d1e0c8]">
                  <th className="pb-2 pr-4">Invoice No</th>
                  <th className="pb-2 pr-4">Party</th>
                  <th className="pb-2 pr-4">Due Date</th>
                  <th className="pb-2 pr-4">Overdue Days</th>
                  <th className="pb-2 pr-4">Amount Due</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvs.map((inv) => (
                  <tr key={inv.id} className="border-b border-[#f0f4ec] last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs font-semibold text-[#172018]">{inv.invoiceNo}</td>
                    <td className="py-2 pr-4 text-[#172018]">{inv.party}</td>
                    <td className="py-2 pr-4 text-[#5a7360]">{inv.dueDate}</td>
                    <td className="py-2 pr-4">
                      <span className="font-bold text-red-600">{inv.overdueDays} days</span>
                    </td>
                    <td className="py-2 pr-4 font-semibold text-[#172018]">₹{inv.amountDue.toLocaleString("en-IN")}</td>
                    <td className="py-2 text-xs text-amber-700 font-medium">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ExceptionCard>

          <ExceptionCard title="Duplicate Document References" count={dupRefs.length} severity="critical"
            description="Same document ref appearing on multiple lots — likely double-entry error">
            {dupRefs.length === 0 ? (
              <p className="text-sm text-[#5a7360]">No duplicates detected.</p>
            ) : (
              <div className="space-y-2">
                {dupRefs.map((d) => (
                  <div key={d.ref} className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <p className="font-mono text-sm font-semibold text-red-700">{d.ref}</p>
                    <p className="text-xs text-red-600 mt-1">Appears {d.count} times — Lot IDs: {d.lots.join(", ")}</p>
                  </div>
                ))}
              </div>
            )}
          </ExceptionCard>

          <ExceptionCard title="Approved Lots Without Invoice" count={unmatchedLots.length} severity="warning"
            description="Lots approved but not yet linked to a GST invoice — revenue recognition pending">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#5a7360] border-b border-[#d1e0c8]">
                  <th className="pb-2 pr-4">Ref</th>
                  <th className="pb-2 pr-4">Material</th>
                  <th className="pb-2 pr-4">Net Payable (MT)</th>
                  <th className="pb-2 pr-4">Sale Value</th>
                  <th className="pb-2 pr-4">Age (Days)</th>
                  <th className="pb-2">Model</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedLots.map((l) => (
                  <tr key={l.id} className="border-b border-[#f0f4ec] last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{l.ref}</td>
                    <td className="py-2 pr-4">{l.material}</td>
                    <td className="py-2 pr-4">{l.netPayable.toFixed(3)}</td>
                    <td className="py-2 pr-4 font-semibold">₹{l.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 pr-4">
                      <span className={l.ageInDays > 7 ? "text-amber-600 font-semibold" : "text-[#172018]"}>{l.ageInDays}d</span>
                    </td>
                    <td className="py-2">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[#eef3e8] text-[#172018]">Model {l.model}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <button className="px-3 py-1.5 bg-[#172018] text-[#d8ff72] text-xs font-semibold rounded-lg">Bulk Generate Invoice</button>
            </div>
          </ExceptionCard>

          <ExceptionCard title="Stale Unmapped Lots (&gt;30 days)" count={oldUnsettled.length} severity="warning"
            description="Lots in Mapped status older than 30 days — may indicate stalled workflows">
            {oldUnsettled.length === 0 ? (
              <p className="text-sm text-[#5a7360]">No stale lots.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#5a7360] border-b border-[#d1e0c8]">
                    <th className="pb-2 pr-4">Ref</th>
                    <th className="pb-2 pr-4">Material</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Supplier</th>
                    <th className="pb-2">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {oldUnsettled.map((l) => (
                    <tr key={l.id} className="border-b border-[#f0f4ec] last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{l.ref}</td>
                      <td className="py-2 pr-4">{l.material}</td>
                      <td className="py-2 pr-4 text-[#5a7360]">{l.date}</td>
                      <td className="py-2 pr-4">{l.supplier}</td>
                      <td className="py-2 text-amber-600 font-semibold">{l.ageDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ExceptionCard>

          <ExceptionCard title="Expired Quality Rules with Active Lots" count={expiredRulesFound.length} severity="warning"
            description="Quality rules past their validTo date — lots may be using stale rule versions">
            {expiredRulesFound.length === 0 ? (
              <p className="text-sm text-[#5a7360]">All quality rules are current.</p>
            ) : (
              <div className="space-y-2">
                {expiredRulesFound.map((r) => (
                  <div key={r.id} className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                    <p className="font-semibold text-sm text-amber-800">{r.material}</p>
                    <p className="text-xs text-amber-700 mt-0.5">Valid to: {r.validTo} — Status: {r.status}</p>
                    {r.affectedLots > 0 && (
                      <p className="text-xs text-red-600 mt-1 font-semibold">{r.affectedLots} lot(s) dated after rule expiry</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ExceptionCard>
        </div>
      )}

      {tab === "quality" && (
        <div className="space-y-6">
          <section>
            <h2 className="text-base font-semibold text-[#172018] mb-3">Quality Holds ({qualityHolds.length})</h2>
            {qualityHolds.length === 0 ? (
              <div className="border border-[#d1e0c8] rounded-xl p-6 text-center text-[#5a7360] text-sm">No quality holds.</div>
            ) : (
              <div className="space-y-3">
                {qualityHolds.map((h) => (
                  <div key={h.id} className="border border-red-200 rounded-xl bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-[#172018]">{h.ref} — <span className="text-[#5a7360] font-normal">{h.material}</span></p>
                        <p className="text-xs text-[#5a7360] mt-1">{h.date} · {h.party} · Model {h.model}</p>
                        <p className="text-sm text-red-600 mt-2 font-medium">{h.reason}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-[#5a7360] text-xs">Moisture / FM</p>
                        <p className="font-bold text-[#172018]">{h.moisture}% / {h.fm}%</p>
                        <p className="text-xs text-[#5a7360] mt-1">{h.netWt} MT net</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="px-3 py-1.5 bg-[#172018] text-[#d8ff72] text-xs font-semibold rounded-lg">Override</button>
                      <button className="px-3 py-1.5 border border-red-300 text-red-700 text-xs font-semibold rounded-lg">Reject</button>
                      <button className="px-3 py-1.5 border border-[#d1e0c8] text-[#172018] text-xs font-semibold rounded-lg">View Lot</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#172018] mb-3">Rule Validity Issues</h2>
            {expiredRulesFound.length === 0 ? (
              <div className="border border-[#d1e0c8] rounded-xl p-6 text-center text-[#5a7360] text-sm">All quality rules are within validity period.</div>
            ) : (
              <table className="w-full text-sm border border-[#d1e0c8] rounded-xl overflow-hidden">
                <thead className="bg-[#f7faf4]">
                  <tr className="text-left text-xs text-[#5a7360]">
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3">Valid To</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Affected Lots</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredRulesFound.map((r) => (
                    <tr key={r.id} className="border-t border-[#d1e0c8]">
                      <td className="px-4 py-3 font-semibold">{r.material}</td>
                      <td className="px-4 py-3 text-red-600">{r.validTo}</td>
                      <td className="px-4 py-3 text-[#5a7360]">{r.status}</td>
                      <td className="px-4 py-3">
                        <span className={r.affectedLots > 0 ? "text-red-600 font-semibold" : "text-[#5a7360]"}>{r.affectedLots}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs font-semibold text-[#172018] underline">Update Rule</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#172018]">Overdue Invoices ({overdueInvs.length})</h2>
            <button className="px-3 py-1.5 border border-[#d1e0c8] text-[#172018] text-xs font-semibold rounded-lg">Export to Excel</button>
          </div>
          {overdueInvs.length === 0 ? (
            <div className="border border-[#d1e0c8] rounded-xl p-10 text-center text-[#5a7360]">
              <p className="text-3xl mb-2">✓</p>
              <p className="font-semibold">All invoices are within due date</p>
            </div>
          ) : (
            <table className="w-full text-sm border border-[#d1e0c8] rounded-xl overflow-hidden">
              <thead className="bg-[#f7faf4]">
                <tr className="text-left text-xs text-[#5a7360]">
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Overdue</th>
                  <th className="px-4 py-3 text-right">Amount Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvs.map((inv) => (
                  <tr key={inv.id} className="border-t border-[#d1e0c8] hover:bg-[#f7faf4]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.invoiceNo}</td>
                    <td className="px-4 py-3">{inv.party}</td>
                    <td className="px-4 py-3 text-[#5a7360]">{inv.dueDate}</td>
                    <td className="px-4 py-3">
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{inv.overdueDays}d overdue</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#172018]">₹{inv.amountDue.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-xs text-amber-700 font-medium">{inv.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-xs font-semibold text-[#172018] underline">Follow Up</button>
                        <button className="text-xs font-semibold text-blue-600 underline">Post Receipt</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#172018] bg-[#eef3e8]">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-xs font-bold text-[#172018]">Total Overdue</td>
                  <td className="px-4 py-2 text-right font-bold text-red-600">
                    ₹{overdueInvs.reduce((s, i) => s + i.amountDue, 0).toLocaleString("en-IN")}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {tab === "lots" && (
        <div className="space-y-6">
          <section>
            <h2 className="text-base font-semibold text-[#172018] mb-3">Approved Lots Without Invoice ({unmatchedLots.length})</h2>
            {unmatchedLots.length === 0 ? (
              <div className="border border-[#d1e0c8] rounded-xl p-6 text-center text-sm text-[#5a7360]">All approved lots are linked to invoices.</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="border border-[#d1e0c8] rounded-xl bg-white p-3">
                    <p className="text-lg font-bold text-[#172018]">{unmatchedLots.length}</p>
                    <p className="text-xs text-[#5a7360]">Uninvoiced lots</p>
                  </div>
                  <div className="border border-[#d1e0c8] rounded-xl bg-white p-3">
                    <p className="text-lg font-bold text-[#172018]">
                      {unmatchedLots.reduce((s, l) => s + l.netPayable, 0).toFixed(2)} MT
                    </p>
                    <p className="text-xs text-[#5a7360]">Total net payable weight</p>
                  </div>
                  <div className="border border-[#d1e0c8] rounded-xl bg-white p-3">
                    <p className="text-lg font-bold text-[#172018]">
                      ₹{unmatchedLots.reduce((s, l) => s + l.value, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-[#5a7360]">Unbooked revenue</p>
                  </div>
                </div>
                <table className="w-full text-sm border border-[#d1e0c8] rounded-xl overflow-hidden">
                  <thead className="bg-[#f7faf4]">
                    <tr className="text-left text-xs text-[#5a7360]">
                      <th className="px-4 py-3">Document Ref</th>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">Lot Date</th>
                      <th className="px-4 py-3">Net Payable</th>
                      <th className="px-4 py-3 text-right">Sale Value</th>
                      <th className="px-4 py-3">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedLots.map((l) => (
                      <tr key={l.id} className="border-t border-[#d1e0c8] hover:bg-[#f7faf4]">
                        <td className="px-4 py-3 font-mono text-xs">{l.ref}</td>
                        <td className="px-4 py-3">{l.material}</td>
                        <td className="px-4 py-3 text-[#5a7360]">{l.date}</td>
                        <td className="px-4 py-3">{l.netPayable.toFixed(3)} MT</td>
                        <td className="px-4 py-3 text-right font-semibold">₹{l.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-3">
                          <span className={l.ageInDays > 7 ? "text-amber-600 font-semibold" : "text-[#5a7360]"}>{l.ageInDays}d</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#172018] mb-3">Duplicate Document References ({dupRefs.length})</h2>
            {dupRefs.length === 0 ? (
              <div className="border border-[#d1e0c8] rounded-xl p-6 text-center text-sm text-[#5a7360]">No duplicate document references found.</div>
            ) : (
              <div className="space-y-2">
                {dupRefs.map((d) => (
                  <div key={d.ref} className="border border-red-300 rounded-xl bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm font-bold text-red-800">{d.ref}</p>
                        <p className="text-xs text-red-600 mt-1">Found {d.count} times — IDs: {d.lots.join(", ")}</p>
                      </div>
                      <button className="px-3 py-1.5 bg-red-700 text-white text-xs font-semibold rounded-lg">Investigate</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          <div className="border border-[#d1e0c8] rounded-xl bg-[#f7faf4] p-4">
            <p className="text-sm font-semibold text-[#172018]">Quality Rule Integrity Policy</p>
            <p className="text-xs text-[#5a7360] mt-1">
              Once a quality rule is used in a posted transaction, it must never be edited or deleted.
              Only add a new rule with a future <code className="bg-white px-1 rounded text-[#172018]">validFrom</code> date.
              The system enforces this by locking rules with status <strong>Expired</strong> or any rule where lots reference it.
            </p>
          </div>
          {qualityRules.map((r) => {
            const referencingLots = lots.filter((l) => l.qualityRuleId === r.id).length;
            return (
              <div key={r.id} className={`border rounded-xl bg-white p-4 ${r.status === "Expired" ? "border-amber-200" : r.status === "Draft" ? "border-[#d1e0c8]" : "border-green-200"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-[#172018]">{r.materialName} — Rule {r.id}</p>
                    <p className="text-xs text-[#5a7360] mt-0.5">
                      Valid: {r.validFrom} → {r.validTo || "open-ended"} · Base moisture {r.baseMoisture}% · Cess {r.cessRate}%
                    </p>
                    <p className="text-xs text-[#5a7360] mt-0.5">
                      Moisture: {r.moistureDeductionMethod} @₹{r.moistureRatePerPct}/MT/% · FM: {r.fmDeductionMethod} @₹{r.fmRatePerPct}/MT/%
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.status === "Active" ? "bg-green-100 text-green-700"
                        : r.status === "Expired" ? "bg-amber-100 text-amber-700"
                        : "bg-[#eef3e8] text-[#5a7360]"
                    }`}>{r.status}</span>
                    <p className="text-xs text-[#5a7360] mt-1">{referencingLots} lot(s)</p>
                  </div>
                </div>
                {referencingLots > 0 && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">Locked — {referencingLots} posted transaction(s) reference this rule</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
