"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Invoice, Voucher, LedgerEntry, Party, FarmerPayout, InwardLot } from "../../../lib/types";
import {
  FileText, Receipt, CreditCard, BookOpen, Scale,
  Plus, Check, X, Download, CheckCircle2, Send, RotateCcw,
  Search, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, MinusCircle, PlusCircle, Ban,
  TrendingUp, Clock, Banknote, Building2, Filter, ArrowUpRight,
  Wallet, ListFilter,
} from "lucide-react";

const TABS = ["Invoices", "Receipts", "Payments", "Expenses", "Trial Balance", "Journal", "Adjustments"] as const;
type Tab = (typeof TABS)[number];

const ACCT_TAB_ICONS = {
  "Invoices":      FileText,
  "Receipts":      Receipt,
  "Payments":      CreditCard,
  "Expenses":      Banknote,
  "Trial Balance": Scale,
  "Journal":       BookOpen,
  "Adjustments":   MinusCircle,
} as const;

// ── Expense categories (account codes 5201–5208) ──────────────────────────────
const EXPENSE_CATEGORIES = [
  { code: "5201", name: "Transport & Travel" },
  { code: "5202", name: "Printing & Stationery" },
  { code: "5203", name: "Office Supplies" },
  { code: "5204", name: "Staff Refreshments" },
  { code: "5205", name: "Repairs & Maintenance" },
  { code: "5206", name: "Utilities (Phone / Internet)" },
  { code: "5207", name: "Professional Fees" },
  { code: "5208", name: "Miscellaneous Expense" },
] as const;

const PAYMENT_SOURCES = [
  { code: "1100", name: "Bank / Cash" },
  { code: "1101", name: "Petty Cash Fund" },
] as const;

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Approved: "bg-[#f0fdf4] text-[#15803d]",
    Sent: "bg-[#eff6ff] text-[#1d4ed8]",
    Partial: "bg-[#fff7ed] text-[#c2410c]",
    Paid: "bg-[#ecfdf5] text-[#065f46]",
    Cancelled: "bg-[#fef2f2] text-[#b91c1c]",
    Posted: "bg-[#f5f3ff] text-[#6d28d9]",
    Cleared: "bg-[#ecfdf5] text-[#065f46]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function ModelBadge({ model }: { model: string }) {
  const map: Record<string, string> = {
    A: "bg-[#172018] text-white",
    B: "bg-[#405b3d] text-white",
    C: "bg-[#d8ff72] text-[#172018]",
  };
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${map[model] ?? "bg-gray-100"}`}>Model {model}</span>;
}

// ─── INVOICES ─────────────────────────────────────────────────────────────────

function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"All" | "Draft" | "Approved" | "Sent" | "Partial" | "Paid" | "Cancelled">("All");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
    ]).then(([invs, pts]) => {
      setInvoices(Array.isArray(invs) ? invs : []);
      setParties(Array.isArray(pts) ? pts : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const partyId = String(fd.get("partyId") ?? "");
    const party = parties.find((p) => p.id === partyId);
    const qty = Number(fd.get("quantity") ?? 0);
    const rate = Number(fd.get("grossRate") ?? 0);
    const grossValue = qty * rate;
    const body = {
      partyId,
      partyName: party?.name ?? "",
      businessModel: fd.get("businessModel") ?? "A",
      invoiceType: "Sales",
      invoiceDate: fd.get("invoiceDate"),
      dueDate: fd.get("dueDate"),
      materialName: fd.get("materialName"),
      quantity: qty,
      uom: fd.get("uom") ?? "MT",
      grossRate: rate,
      grossValue,
      taxableValue: grossValue,
      cgstRate: 0, sgstRate: 0, igstRate: 0,
      status: "Draft",
    };
    await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function approveInvoice(id: string) {
    await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Approved" }),
    });
    load();
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    await fetch(`/api/invoices/${cancelTarget.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason || "Cancelled by user" }),
    });
    setCancelling(false);
    setCancelTarget(null);
    setCancelReason("");
    load();
  }

  const totalDue = invoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled").reduce((s, i) => s + i.amountDue, 0);

  const filteredInvoices = useMemo(() => {
    let list = invoiceStatusFilter === "All" ? invoices : invoices.filter((i) => i.status === invoiceStatusFilter);
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.trim().toLowerCase();
      list = list.filter((i) =>
        i.invoiceNo.toLowerCase().includes(q) ||
        i.partyName.toLowerCase().includes(q) ||
        i.materialName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, invoiceStatusFilter, invoiceSearch]);

  const draftCount    = invoices.filter((i) => i.status === "Draft").length;
  const approvedCount = invoices.filter((i) => i.status === "Approved" || i.status === "Sent").length;
  const paidCount     = invoices.filter((i) => i.status === "Paid").length;

  return (
    <div className="grid gap-5">
      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d8decf] bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#dc2626]" />
              <div>
                <h3 className="font-semibold text-[#172018]">Cancel Invoice {cancelTarget.invoiceNo}?</h3>
                <p className="mt-1 text-sm text-[#536251]">
                  This will post reversal ledger entries (Dr Sales / Cr AR) and mark the invoice Cancelled.
                  {cancelTarget.status === "Partial" && " Partially received payments are not reversed — issue a refund voucher separately."}
                </p>
              </div>
            </div>
            <label className="grid gap-1.5 text-sm font-medium mb-5">
              Cancellation reason
              <input type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Data entry error, duplicate invoice…"
                className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#dc2626]" />
            </label>
            <div className="flex gap-3">
              <button onClick={confirmCancel} disabled={cancelling}
                className="flex items-center gap-1.5 rounded-lg bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50">
                <Ban size={14} />{cancelling ? "Cancelling…" : "Cancel Invoice"}
              </button>
              <button onClick={() => setCancelTarget(null)}
                className="flex items-center gap-1.5 rounded-lg border border-[#d8decf] bg-white px-4 py-2 text-sm font-semibold text-[#536251] hover:bg-[#f3f6ef]">
                <X size={14} />Keep Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Outstanding AR</p>
            <Wallet size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#172018]">{inr(totalDue)}</p>
          <p className="mt-1 text-xs text-[#8fa888]">{invoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled").length} unpaid invoice(s)</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #9ca3af" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Draft</p>
            <FileText size={16} className="text-gray-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#d97706]">{draftCount}</p>
          <p className="mt-1 text-xs text-[#8fa888]">{draftCount > 0 ? "Awaiting approval" : "No pending drafts"}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Approved / Sent</p>
            <Send size={16} className="text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{approvedCount}</p>
          <p className="mt-1 text-xs text-[#8fa888]">Pending payment receipt</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #16a34a" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Fully Paid</p>
            <CheckCircle2 size={16} className="text-green-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#15803d]">{paidCount}</p>
          <p className="mt-1 text-xs text-[#8fa888]">Invoices settled</p>
        </div>
      </div>

      {/* Model A info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>
          <strong>Model A tax invoices</strong> are auto-recorded when you click <strong>Save to Accounts</strong> in the Tax Invoice dialog in Procurement.
          Use <em>Manual Invoice</em> only for one-off adjustments.
        </span>
      </div>

      {/* Manual invoice form */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#172018]">Invoice register</h3>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-[#d8decf] bg-white px-3 py-1.5 text-xs font-semibold text-[#536251] hover:bg-[#f3f6ef]"><Download size={13} />Export</button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg bg-[#172018] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2d4a2a]"><Plus size={13} />Manual Invoice</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-5">
          <h3 className="mb-1 text-base font-semibold">Generate GST invoice</h3>
          <p className="mb-4 text-xs text-[#60735d]">Creates a manual sales invoice and posts Dr 1201 AR / Cr 3100 Sales entries.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Customer *
              <select name="partyId" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
                <option value="">Select party…</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Business model
              <select name="businessModel" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
                <option value="A">Model A</option><option value="B">Model B</option><option value="C">Model C</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Material *
              <input name="materialName" type="text" required placeholder="Maize" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Invoice date *
              <input name="invoiceDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Due date *
              <input name="dueDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              UOM
              <select name="uom" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
                <option value="MT">MT</option><option value="KG">KG</option><option value="L">L</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Quantity *
              <input name="quantity" type="number" step="0.01" required placeholder="486.72" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Gross sale rate (₹) *
              <input name="grossRate" type="number" required placeholder="22500" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5"><Check size={14} />{saving ? "Saving…" : "Save Draft"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Cancel</button>
          </div>
        </form>
      )}

      {/* Invoice register */}
      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          {/* Register toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[#edf0e8] bg-[#fafcf8] px-4 py-2.5">
            <div className="flex gap-1">
              {(["All", "Draft", "Approved", "Paid", "Cancelled"] as const).map((s) => (
                <button key={s} onClick={() => setInvoiceStatusFilter(s as typeof invoiceStatusFilter)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${invoiceStatusFilter === s ? "bg-[#172018] text-white" : "text-[#536251] hover:bg-[#e4ebe0]"}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="relative min-w-48 flex-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
              <input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search invoice no, party, material…"
                className="w-full rounded-lg border border-[#c8d4c0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#16a34a]" />
            </div>
            <span className="text-xs text-[#8fa888]">{filteredInvoices.length} record{filteredInvoices.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                <tr>
                  <th className="px-4 py-3">Invoice no</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Date / Due</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3 text-right">Qty MT</th>
                  <th className="px-4 py-3 text-right">Invoice value</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-[#8fa888]">No invoices match your filter</td></tr>
                ) : filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#172018] whitespace-nowrap">{inv.invoiceNo}</td>
                    <td className="px-4 py-3"><ModelBadge model={inv.businessModel} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-[#172018]">{inv.invoiceDate}</p>
                      <p className="text-xs text-[#8fa888]">Due {inv.dueDate}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[140px]">
                      <p className="truncate font-semibold text-[#172018]">{inv.partyName}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#536251]">{inv.materialName}</td>
                    <td className="px-4 py-3 text-right text-xs">{inv.quantity.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{inr(inv.totalValue)}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#15803d] whitespace-nowrap">{inv.amountPaid > 0 ? inr(inv.amountPaid) : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{inv.amountDue > 0 ? inr(inv.amountDue) : <span className="text-[#15803d]">Nil</span>}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {inv.status === "Draft" && (
                          <button onClick={() => approveInvoice(inv.id)}
                            className="flex items-center gap-1 rounded-md bg-[#15803d] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#166534]">
                            <CheckCircle2 size={11} />Approve
                          </button>
                        )}
                        {(inv.status === "Approved" || inv.status === "Sent" || inv.status === "Partial") && (
                          <button onClick={() => window.dispatchEvent(new CustomEvent("akshaya:receipt-for-invoice", { detail: { invoiceId: inv.id, partyId: inv.partyId, invoiceNo: inv.invoiceNo } }))}
                            className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">
                            <Send size={11} />Record Receipt
                          </button>
                        )}
                        {inv.status === "Paid" && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-[#15803d]"><Check size={11} />Paid</span>
                        )}
                        {inv.status !== "Cancelled" && inv.invoiceType === "Sales" && (
                          <button onClick={() => { setCancelTarget(inv); setCancelReason(""); }}
                            title="Cancel invoice"
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2]">
                            <Ban size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredInvoices.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#edf0e8] bg-[#f3f6ef] px-4 py-2.5 text-xs text-[#536251]">
              <span>{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}</span>
              <span className="font-semibold">Total outstanding: {inr(filteredInvoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled").reduce((s, i) => s + i.amountDue, 0))}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RECEIPTS ─────────────────────────────────────────────────────────────────

const TDS_THRESHOLD = 2_000_000; // ₹20 lakhs

function ReceiptsTab({ preset, onPresetConsumed }: { preset: { partyId: string; invoiceId: string; invoiceNo?: string } | null; onPresetConsumed: () => void }) {
  const [vouchers, setVouchers]           = useState<Voucher[]>([]);
  const [allInvoices, setAllInvoices]     = useState<Invoice[]>([]);
  const [parties, setParties]             = useState<Party[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [tdsAmount, setTdsAmount]         = useState(0);
  const [selectedInvIds, setSelectedInvIds]   = useState<Set<string>>(new Set());
  const [narration, setNarration]         = useState("");
  const [narrationEdited, setNarrationEdited] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [showReceiptForm, setShowReceiptForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/vouchers?type=Receipt").then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
    ]).then(([vs, pts, invs]) => {
      setVouchers(Array.isArray(vs) ? vs : []);
      setParties(Array.isArray(pts) ? pts : []);
      setAllInvoices(Array.isArray(invs) ? invs : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply preset from "Record payment" shortcut in Invoices tab — auto-open form
  useEffect(() => {
    if (!preset || allInvoices.length === 0) return;
    setShowReceiptForm(true);
    setSelectedPartyId(preset.partyId);
    setSelectedInvIds(new Set([preset.invoiceId]));
    const inv = allInvoices.find((i) => i.id === preset.invoiceId);
    if (inv) {
      setReceiptAmount(inv.amountDue);
      setNarration(`Receipt against Invoice ${inv.invoiceNo}`);
      setNarrationEdited(false);
    }
    onPresetConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, allInvoices]);

  // Auto-update narration when invoice selection changes (unless user has manually edited it)
  useEffect(() => {
    if (narrationEdited) return;
    const selectedInvs = allInvoices.filter(
      (i) => i.partyId === selectedPartyId && selectedInvIds.has(i.id)
    );
    if (selectedInvs.length === 0) { setNarration(""); return; }
    const nos = selectedInvs.map((i) => i.invoiceNo).join(", ");
    setNarration(selectedInvs.length === 1
      ? `Receipt against Invoice ${nos}`
      : `Receipt against Invoices: ${nos}`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvIds, allInvoices, selectedPartyId]);

  // FY turnover: Indian FY = April → March
  const fyStart = (() => {
    const n = new Date();
    return n.getMonth() >= 3
      ? `${n.getFullYear()}-04-01`
      : `${n.getFullYear() - 1}-04-01`;
  })();
  const fyTurnover = allInvoices
    .filter((i) => i.partyId === selectedPartyId &&
      i.invoiceType === "Sales" &&
      i.status !== "Cancelled" &&
      i.invoiceDate >= fyStart)
    .reduce((s, i) => s + i.totalValue, 0);
  const fyPct = Math.min(100, Math.round((fyTurnover / TDS_THRESHOLD) * 100));
  const tdsApplicable = fyTurnover >= TDS_THRESHOLD;

  // Open invoices for the selected customer (not Paid / not Cancelled)
  const openInvoices = allInvoices.filter(
    (i) => i.partyId === selectedPartyId &&
      i.status !== "Paid" && i.status !== "Cancelled" && i.amountDue > 0
  ).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)); // oldest first

  const totalSelected = openInvoices
    .filter((i) => selectedInvIds.has(i.id))
    .reduce((s, i) => s + i.amountDue, 0);

  // Match uses gross (cash + TDS) — TDS clears AR just like cash does
  const grossReceipt = Math.round((receiptAmount + tdsAmount) * 100) / 100;
  const diff = grossReceipt - totalSelected;
  const fullyMatched = Math.abs(diff) < 0.01 && selectedInvIds.size > 0;
  const excess = diff > 0.01;
  const shortfall = diff < -0.01;

  function toggleInvoice(id: string) {
    setSelectedInvIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedInvIds(new Set(openInvoices.map((i) => i.id)));
  }

  function clearSelection() {
    setSelectedInvIds(new Set());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const partyId = String(fd.get("partyId") ?? "");
    const party = parties.find((p) => p.id === partyId);
    const body = {
      voucherType: "Receipt",
      partyId,
      partyName: party?.name ?? "",
      voucherDate: fd.get("voucherDate"),
      amount: receiptAmount,
      tdsAmount: tdsAmount || 0,
      paymentMode: fd.get("paymentMode") ?? "NEFT",
      bankRef: fd.get("bankRef"),
      narration: fd.get("narration"),
      status: "Posted",
      allocatedTo: [...selectedInvIds],
    };
    await fetch("/api/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    form.reset();
    setSelectedPartyId("");
    setReceiptAmount(0);
    setTdsAmount(0);
    setSelectedInvIds(new Set());
    setNarration("");
    setNarrationEdited(false);
    load();
  }

  return (
    <div className="grid gap-5">
      {/* ── Post receipt — collapsible ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        {/* Header row — always visible */}
        <button
          type="button"
          onClick={() => setShowReceiptForm((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-[#fafcf8] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors ${showReceiptForm ? "bg-[#536251] rotate-45" : "bg-[#16a34a]"}`} style={{ transition: "transform 0.2s, background-color 0.2s" }}>
              <Plus size={15} />
            </span>
            <div>
              <p className="font-semibold text-sm text-[#172018]">Post customer receipt</p>
              <p className="text-xs text-[#60735d]">Dr. 1100 Bank / Cr. 1201 Customer AR · reduces outstanding invoice balance</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-[#60735d] transition-transform duration-200 ${showReceiptForm ? "rotate-180" : ""}`} />
        </button>

        {showReceiptForm && (
        <form onSubmit={handleSubmit} className="border-t border-[#edf0e8] p-5">
        <div className="mb-4 text-xs text-[#60735d]">Fill in the fields below, select the invoices this receipt covers, then click <strong>Post Receipt</strong>.</div>

        {/* ── Core receipt fields ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Customer *
            <select
              name="partyId" required
              value={selectedPartyId}
              onChange={(e) => { setSelectedPartyId(e.target.value); setSelectedInvIds(new Set()); setNarration(""); setNarrationEdited(false); }}
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            >
              <option value="">Select party…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Receipt date *
            <input name="voucherDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Cash received (₹) *
            <input
              name="amount" type="number" required placeholder="11529000"
              value={receiptAmount || ""}
              onChange={(e) => setReceiptAmount(Number(e.target.value) || 0)}
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            TDS deducted (₹)
            <input
              name="tdsAmount" type="number" min="0" step="0.01" placeholder="0"
              value={tdsAmount || ""}
              onChange={(e) => setTdsAmount(Number(e.target.value) || 0)}
              className={`rounded-lg border px-3.5 py-2.5 font-normal outline-none ${tdsAmount > 0 ? "border-[#f59e0b] bg-[#fffbeb] focus:border-[#f59e0b]" : "border-[#c8d4c0] focus:border-[#16a34a]"}`}
            />
            {tdsAmount > 0 && (
              <span className="text-xs text-[#92400e]">Posts Dr 1190 TDS Receivable · Total AR cleared: {inr(receiptAmount + tdsAmount)}</span>
            )}
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Payment mode
            <select name="paymentMode" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
              {["RTGS", "NEFT", "IMPS", "Cheque", "Cash", "UPI"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            UTR / reference no
            <input name="bankRef" type="text" placeholder="RTGS/20260510/0012345" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Narration
            <input
              name="narration"
              type="text"
              value={narration}
              onChange={(e) => { setNarration(e.target.value); setNarrationEdited(true); }}
              placeholder="Receipt against invoice — May 2026 batch"
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            />
          </label>
        </div>

        {/* ── FY Turnover / TDS threshold meter ── */}
        {selectedPartyId && (
          <div className={`mt-4 rounded-lg border px-4 py-3 ${tdsApplicable ? "border-[#f59e0b] bg-[#fffbeb]" : "border-[#d8decf] bg-[#f3f6ef]"}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#172018]">
                FY {fyStart.slice(0, 4)}-{String(Number(fyStart.slice(0, 4)) + 1).slice(2)} turnover with this party
              </span>
              <span className={`text-xs font-semibold ${tdsApplicable ? "text-[#92400e]" : "text-[#536251]"}`}>
                {inr(fyTurnover)} / {inr(TDS_THRESHOLD)} · {fyPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#e5e7eb] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${tdsApplicable ? "bg-[#f59e0b]" : "bg-[#16a34a]"}`}
                style={{ width: `${fyPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[#536251]">
              {tdsApplicable
                ? `TDS threshold crossed — Sarvani should deduct TDS (u/s 194Q) on receipts. Enter the amount they deducted in the TDS field above.`
                : `Below ₹20L threshold — TDS not yet applicable for this FY. ${inr(TDS_THRESHOLD - fyTurnover)} remaining before TDS applies.`}
            </p>
          </div>
        )}

        {/* ── Invoice allocation panel ── */}
        {selectedPartyId && (
          <div className="mt-5 rounded-lg border border-[#d8decf] bg-[#fafcf8]">
            <div className="flex items-center justify-between border-b border-[#edf0e8] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#172018]">Allocate to open invoices</p>
                <p className="text-xs text-[#60735d]">
                  {openInvoices.length === 0
                    ? "No outstanding invoices for this customer"
                    : `${openInvoices.length} outstanding invoice${openInvoices.length !== 1 ? "s" : ""} · tick those this receipt covers`}
                </p>
              </div>
              {openInvoices.length > 0 && (
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="text-xs font-semibold text-[#15803d] hover:underline">Select all</button>
                  <button type="button" onClick={clearSelection} className="text-xs font-semibold text-[#536251] hover:underline">Clear</button>
                </div>
              )}
            </div>

            {openInvoices.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#edf0e8] bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-wider text-[#60735d]">
                        <th className="px-4 py-2.5 w-8"></th>
                        <th className="px-4 py-2.5">Invoice no</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Due date</th>
                        <th className="px-4 py-2.5 text-right">Invoice value</th>
                        <th className="px-4 py-2.5 text-right">Already paid</th>
                        <th className="px-4 py-2.5 text-right font-bold text-[#172018]">Amount due</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInvoices.map((inv) => {
                        const checked = selectedInvIds.has(inv.id);
                        return (
                          <tr
                            key={inv.id}
                            onClick={() => toggleInvoice(inv.id)}
                            className={`cursor-pointer border-t border-[#edf0e8] transition-colors ${checked ? "bg-[#f0fdf4]" : "hover:bg-[#f6faef]"}`}
                          >
                            <td className="px-4 py-2.5 text-center">
                              <input type="checkbox" readOnly checked={checked} className="h-4 w-4 accent-[#15803d]" />
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-[#172018]">{inv.invoiceNo}</td>
                            <td className="px-4 py-2.5 text-[#536251]">{inv.invoiceDate}</td>
                            <td className="px-4 py-2.5 text-[#536251]">{inv.dueDate}</td>
                            <td className="px-4 py-2.5 text-right">{inr(inv.totalValue)}</td>
                            <td className="px-4 py-2.5 text-right text-[#15803d]">{inr(inv.amountPaid)}</td>
                            <td className="px-4 py-2.5 text-right font-bold">{inr(inv.amountDue)}</td>
                            <td className="px-4 py-2.5 text-center"><StatusBadge status={inv.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Allocation summary bar */}
                <div className={`flex items-center justify-between px-4 py-3 text-sm font-medium ${fullyMatched ? "bg-[#f0fdf4] text-[#15803d]" : excess ? "bg-[#fff7ed] text-[#c2410c]" : shortfall ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#f3f6ef] text-[#536251]"}`}>
                  <span>
                    {selectedInvIds.size === 0
                      ? "No invoices selected — receipt will be posted without allocation"
                      : fullyMatched
                      ? `✓ Gross receipt (cash${tdsAmount > 0 ? " + TDS" : ""}) exactly covers ${selectedInvIds.size} invoice${selectedInvIds.size !== 1 ? "s" : ""} (${inr(totalSelected)})`
                      : excess
                      ? `Gross ${inr(grossReceipt)} — selected ${inr(totalSelected)} — ${inr(diff)} unallocated`
                      : `Gross ${inr(grossReceipt)} — selected ${inr(totalSelected)} — shortfall ${inr(Math.abs(diff))}`}
                  </span>
                  {selectedInvIds.size > 0 && (
                    <span className="font-bold">{inr(totalSelected)} selected</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5">
            <Check size={14} />{saving ? "Posting…" : "Post Receipt"}
          </button>
          <button type="reset" onClick={() => { setSelectedPartyId(""); setReceiptAmount(0); setSelectedInvIds(new Set()); }} className="btn btn-ghost flex items-center gap-1.5"><RotateCcw size={14} />Reset</button>
          <button type="button" onClick={() => setShowReceiptForm(false)} className="ml-auto flex items-center gap-1 text-xs text-[#8fa888] hover:text-[#536251]"><X size={12} />Collapse</button>
        </div>
        </form>
        )}
      </div>{/* end collapsible receipt card */}

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (() => {
        const filteredVouchers = receiptSearch.trim()
          ? vouchers.filter((v) => {
              const q = receiptSearch.toLowerCase();
              return v.voucherNo.toLowerCase().includes(q) || v.partyName.toLowerCase().includes(q) || (v.bankRef ?? "").toLowerCase().includes(q);
            })
          : vouchers;
        const totalPosted = vouchers.reduce((s, v) => s + v.amount, 0);
        return (
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0e8] px-4 py-3">
              <div>
                <h3 className="text-base font-semibold">Receipt voucher register</h3>
                <p className="text-xs text-[#60735d]">{vouchers.length} receipt{vouchers.length !== 1 ? "s" : ""} posted · Total {inr(totalPosted)}</p>
              </div>
              <div className="relative min-w-48">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
                <input value={receiptSearch} onChange={(e) => setReceiptSearch(e.target.value)}
                  placeholder="Search voucher, party, UTR…"
                  className="w-full rounded-lg border border-[#c8d4c0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#16a34a]" />
              </div>
            </div>
            {filteredVouchers.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#8fa888]">{vouchers.length === 0 ? "No receipts posted yet." : "No vouchers match your search."}</p>
            ) : (
              <div className="divide-y divide-[#edf0e8]">
                {filteredVouchers.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-[#fafcf8]">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs font-bold text-[#172018]">{v.voucherNo}</span>
                        <span className="font-semibold text-sm text-[#172018]">{v.partyName}</span>
                        <span className="text-xs text-[#8fa888]">{v.voucherDate}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-[#8fa888]">
                        <span>{v.paymentMode}</span>
                        {v.bankRef && <span className="font-mono">{v.bankRef}</span>}
                        {v.narration && <span className="max-w-[260px] truncate">{v.narration}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right text-xs shrink-0">
                      {v.allocatedTo.length > 0 && (
                        <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 text-xs font-semibold text-[#15803d]">
                          {v.allocatedTo.length} inv.
                        </span>
                      )}
                      <span className="text-base font-bold text-[#172018]">{inr(v.amount)}</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {filteredVouchers.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#edf0e8] bg-[#f3f6ef] px-4 py-2.5 text-xs text-[#536251]">
                <span>{filteredVouchers.length} receipt{filteredVouchers.length !== 1 ? "s" : ""}</span>
                <span className="font-semibold">Total: {inr(filteredVouchers.reduce((s, v) => s + v.amount, 0))}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [vouchers, setVouchers]           = useState<Voucher[]>([]);
  const [allPayouts, setAllPayouts]       = useState<FarmerPayout[]>([]);
  const [allLots, setAllLots]             = useState<InwardLot[]>([]);
  const [parties, setParties]             = useState<Party[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<Set<string>>(new Set());
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [narration, setNarration]         = useState("");
  const [narrationEdited, setNarrationEdited] = useState(false);
  const [bankRef, setBankRef]             = useState("");
  const [paySearch, setPaySearch]         = useState("");
  const [showPayForm, setShowPayForm]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/vouchers?type=Payment").then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
      fetch("/api/payouts").then((r) => r.json()),
      fetch("/api/lots").then((r) => r.json()),
    ]).then(([vs, pts, pys, ls]) => {
      setVouchers(Array.isArray(vs) ? vs : []);
      setParties(Array.isArray(pts) ? pts : []);
      setAllPayouts(Array.isArray(pys) ? pys : []);
      setAllLots(Array.isArray(ls) ? ls : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pending payouts for selected party (Pending or Approved, not yet Paid)
  const pendingPayouts = allPayouts.filter(
    (p) => p.farmerId === selectedPartyId && p.paymentStatus !== "Paid"
  ).sort((a, b) => a.payoutDate.localeCompare(b.payoutDate));

  const totalSelected = pendingPayouts
    .filter((p) => selectedPayoutIds.has(p.id))
    .reduce((s, p) => s + p.netAmount, 0);

  const diff = paymentAmount - totalSelected;
  const fullyMatched = Math.abs(diff) < 0.01 && selectedPayoutIds.size > 0;
  const excess = diff > 0.01;
  const shortfall = diff < -0.01;

  function togglePayout(id: string) {
    setSelectedPayoutIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllPayouts() {
    setSelectedPayoutIds(new Set(pendingPayouts.map((p) => p.id)));
  }

  // Auto-fill amount and narration when payout selection changes
  useEffect(() => {
    const sel = pendingPayouts.filter((p) => selectedPayoutIds.has(p.id));
    if (sel.length > 0) {
      setPaymentAmount(Math.round(sel.reduce((s, p) => s + p.netAmount, 0) * 100) / 100);
    }
    if (!narrationEdited) {
      if (sel.length === 0) { setNarration(""); return; }
      const challans = sel.map((p) => p.documentRef).join(", ");
      setNarration(sel.length === 1
        ? `Payment to ${sel[0].farmerName} | Challan ${challans}`
        : `Payment to ${sel[0].farmerName} | Challans: ${challans}`
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPayoutIds, allPayouts]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const partyId = String(fd.get("partyId") ?? "");
    const party = parties.find((p) => p.id === partyId);
    const mode = String(fd.get("paymentMode") ?? "NEFT");
    const ref = String(fd.get("bankRef") ?? "");

    // Sum gate cess reimbursement across selected payouts so the voucher API can
    // post two separate Dr 2101 / Cr 1100 entries (settlement + cess reimb) mirroring settlement.
    const rnd2 = (n: number) => Math.round(n * 100) / 100;
    const cessReimb = rnd2(
      [...selectedPayoutIds]
        .map((pid) => allPayouts.find((p) => p.id === pid))
        .filter(Boolean)
        .reduce((sum, p) => {
          const lot = p?.inwardLotId ? allLots.find((l) => l.id === p.inwardLotId) : null;
          return sum + (lot?.cessAmount ?? 0);
        }, 0),
    );

    // Post payment voucher (Dr 2101 Supplier Payable / Cr 1100 Bank — split when cessReimb > 0)
    await fetch("/api/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voucherType: "Payment",
        partyId,
        partyName: party?.name ?? "",
        voucherDate: fd.get("voucherDate"),
        amount: paymentAmount,
        cessReimb,
        paymentMode: mode,
        bankRef: ref,
        narration: fd.get("narration"),
        status: "Posted",
        allocatedTo: [...selectedPayoutIds],
      }),
    });

    // Mark selected payouts as Paid with payment reference
    if (selectedPayoutIds.size > 0) {
      await Promise.all(
        [...selectedPayoutIds].map((pid) =>
          fetch("/api/payouts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: pid, paymentStatus: "Paid", paymentRef: ref, paymentMode: mode }),
          })
        )
      );
    }

    setSaving(false);
    form.reset();
    setSelectedPartyId("");
    setPaymentAmount(0);
    setSelectedPayoutIds(new Set());
    setNarration("");
    setNarrationEdited(false);
    setBankRef("");
    load();
  }

  // Payments KPI data (computed regardless of tab loading state so tiles are always visible)
  const pendingPayCount  = allPayouts.filter((p) => p.paymentStatus === "Pending").length;
  const approvedPayCount = allPayouts.filter((p) => p.paymentStatus === "Approved").length;
  const paidPayCount     = allPayouts.filter((p) => p.paymentStatus === "Paid").length;
  const pendingPayAmt    = allPayouts.filter((p) => p.paymentStatus !== "Paid").reduce((s, p) => s + p.netAmount, 0);

  return (
    <div className="grid gap-5">
      {/* KPI tiles — shown before the form so context is visible immediately */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Pending review</p>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#d97706]">{loading ? "—" : pendingPayCount}</p>
          <p className="mt-1 text-xs text-[#8fa888]">Awaiting approval in Settlements</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Ready for payment</p>
            <Banknote size={16} className="text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{loading ? "—" : approvedPayCount}</p>
          <p className="mt-1 text-xs text-[#8fa888]">Approved payouts</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #dc2626" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Total payable</p>
            <Wallet size={16} className="text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#dc2626]">{loading ? "—" : inr(pendingPayAmt)}</p>
          <p className="mt-1 text-xs text-[#8fa888]">Across all unpaid lots</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #16a34a" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Paid payouts</p>
            <CheckCircle2 size={16} className="text-green-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#15803d]">{loading ? "—" : paidPayCount}</p>
          <p className="mt-1 text-xs text-[#8fa888]">Fully disbursed</p>
        </div>
      </div>

      {/* ── Post payment — collapsible ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <button
          type="button"
          onClick={() => setShowPayForm((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-[#fafcf8] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors ${showPayForm ? "bg-[#536251]" : "bg-[#16a34a]"}`}>
              <Plus size={15} style={{ transform: showPayForm ? "rotate(45deg)" : "none", transition: "transform 0.2s" }} />
            </span>
            <div>
              <p className="font-semibold text-sm text-[#172018]">Post supplier / farmer payment</p>
              <p className="text-xs text-[#60735d]">Dr. 2101 Supplier Payable / Cr. 1100 Bank · marks selected lots as Paid</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-[#60735d] transition-transform duration-200 ${showPayForm ? "rotate-180" : ""}`} />
        </button>

        {showPayForm && (
        <form onSubmit={handleSubmit} className="border-t border-[#edf0e8] p-5">
        <p className="mb-4 text-xs text-[#60735d]">Select the payee, choose the lots this payment covers, then click <strong>Post Payment</strong>.</p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Payee *
            <select
              name="partyId"
              required
              value={selectedPartyId}
              onChange={(e) => { setSelectedPartyId(e.target.value); setSelectedPayoutIds(new Set()); setNarration(""); setNarrationEdited(false); setPaymentAmount(0); }}
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            >
              <option value="">Select party…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Payment date *
            <input name="voucherDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Amount (₹) *
            <input
              name="amount" type="number" required placeholder="825400"
              value={paymentAmount || ""}
              onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Payment mode
            <select name="paymentMode" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
              {["NEFT", "RTGS", "IMPS", "Cheque", "Cash", "UPI"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            UTR / reference
            <input
              name="bankRef" type="text" placeholder="NEFT/20260511/0008876"
              value={bankRef}
              onChange={(e) => setBankRef(e.target.value)}
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Narration
            <input
              name="narration" type="text"
              value={narration}
              onChange={(e) => { setNarration(e.target.value); setNarrationEdited(true); }}
              placeholder="Payment to supplier — Challans: DR-001, DR-002"
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            />
          </label>
        </div>

        {/* ── Pending lot allocation panel ─── */}
        {selectedPartyId && (
          <div className="mt-5 rounded-lg border border-[#d8decf] bg-[#fafcf8]">
            <div className="flex items-center justify-between border-b border-[#edf0e8] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#172018]">Allocate to settled lots</p>
                <p className="text-xs text-[#60735d]">
                  {pendingPayouts.length === 0
                    ? "No pending payouts for this party — all lots are paid or none are settled yet"
                    : `${pendingPayouts.length} pending lot${pendingPayouts.length !== 1 ? "s" : ""} · tick those this payment covers`}
                </p>
              </div>
              {pendingPayouts.length > 0 && (
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllPayouts} className="text-xs font-semibold text-[#15803d] hover:underline">Select all</button>
                  <button type="button" onClick={() => setSelectedPayoutIds(new Set())} className="text-xs font-semibold text-[#536251] hover:underline">Clear</button>
                </div>
              )}
            </div>

            {pendingPayouts.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#edf0e8] bg-[#f3f6ef] text-[10px] font-semibold uppercase tracking-wider text-[#60735d]">
                        <th className="px-4 py-2.5 w-8"></th>
                        <th className="px-4 py-2.5">Challan / lot</th>
                        <th className="px-4 py-2.5">Material</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5 text-right">Gross qty (MT)</th>
                        <th className="px-4 py-2.5 text-right">Rate (₹/MT)</th>
                        <th className="px-4 py-2.5 text-right">Gross amount</th>
                        <th className="px-4 py-2.5 text-right">Deductions</th>
                        <th className="px-4 py-2.5 text-right font-bold text-[#172018]">Net payable</th>
                        <th className="px-4 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPayouts.map((p) => {
                        const checked = selectedPayoutIds.has(p.id);
                        return (
                          <tr
                            key={p.id}
                            onClick={() => togglePayout(p.id)}
                            className={`cursor-pointer border-t border-[#edf0e8] transition-colors ${checked ? "bg-[#f0fdf4]" : "hover:bg-[#f6faef]"}`}
                          >
                            <td className="px-4 py-2.5 text-center">
                              <input type="checkbox" readOnly checked={checked} className="h-4 w-4 accent-[#15803d]" />
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-[#172018] font-mono">{p.documentRef}</td>
                            <td className="px-4 py-2.5 text-[#536251]">{p.materialName}</td>
                            <td className="px-4 py-2.5 text-[#536251] whitespace-nowrap">{p.payoutDate}</td>
                            <td className="px-4 py-2.5 text-right">{p.quantity.toFixed(3)}</td>
                            <td className="px-4 py-2.5 text-right">{inr(p.rate)}</td>
                            <td className="px-4 py-2.5 text-right">{inr(p.grossAmount)}</td>
                            <td className="px-4 py-2.5 text-right text-[#dc2626]">{p.deductions > 0 ? `−${inr(p.deductions)}` : "—"}</td>
                            <td className="px-4 py-2.5 text-right font-bold">{inr(p.netAmount)}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.paymentStatus === "Approved" ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
                                {p.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Subtotal row */}
                    {pendingPayouts.length > 1 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#c8d4c0] bg-[#f3f6ef] text-xs font-bold">
                          <td colSpan={6} className="px-4 py-2.5 text-[#536251]">All pending lots total</td>
                          <td className="px-4 py-2.5 text-right">{inr(pendingPayouts.reduce((s, p) => s + p.grossAmount, 0))}</td>
                          <td className="px-4 py-2.5 text-right text-[#dc2626]">−{inr(pendingPayouts.reduce((s, p) => s + p.deductions, 0))}</td>
                          <td className="px-4 py-2.5 text-right">{inr(pendingPayouts.reduce((s, p) => s + p.netAmount, 0))}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Allocation summary bar */}
                <div className={`flex items-center justify-between px-4 py-3 text-sm font-medium ${fullyMatched ? "bg-[#f0fdf4] text-[#15803d]" : excess ? "bg-[#fff7ed] text-[#c2410c]" : shortfall ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#f3f6ef] text-[#536251]"}`}>
                  <span>
                    {selectedPayoutIds.size === 0
                      ? "No lots selected — payment will be posted without lot allocation"
                      : fullyMatched
                      ? `✓ Payment exactly covers ${selectedPayoutIds.size} lot${selectedPayoutIds.size !== 1 ? "s" : ""} (${inr(totalSelected)})`
                      : excess
                      ? `Payment ${inr(paymentAmount)} — selected ${inr(totalSelected)} — ${inr(diff)} excess (advance)`
                      : `Payment ${inr(paymentAmount)} — selected ${inr(totalSelected)} — shortfall ${inr(Math.abs(diff))}`}
                  </span>
                  {selectedPayoutIds.size > 0 && (
                    <span className="font-bold">{inr(totalSelected)} selected</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5">
            <Check size={14} />{saving ? "Posting…" : "Post Payment"}
          </button>
          <button type="reset" onClick={() => { setSelectedPartyId(""); setPaymentAmount(0); setSelectedPayoutIds(new Set()); setNarration(""); setNarrationEdited(false); setBankRef(""); }} className="btn btn-ghost flex items-center gap-1.5"><RotateCcw size={14} />Reset</button>
          <button type="button" onClick={() => setShowPayForm(false)} className="ml-auto flex items-center gap-1 text-xs text-[#8fa888] hover:text-[#536251]"><X size={12} />Collapse</button>
        </div>
        </form>
        )}
      </div>{/* end collapsible payment card */}

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (() => {
        const filteredPayVouchers = paySearch.trim()
          ? vouchers.filter((v) => {
              const q = paySearch.toLowerCase();
              return v.voucherNo.toLowerCase().includes(q) || v.partyName.toLowerCase().includes(q) || (v.bankRef ?? "").toLowerCase().includes(q);
            })
          : vouchers;
        return (
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0e8] px-4 py-3">
              <div>
                <h3 className="text-base font-semibold">Payment voucher register</h3>
                <p className="text-xs text-[#60735d]">{vouchers.length} payment{vouchers.length !== 1 ? "s" : ""} posted</p>
              </div>
              <div className="relative min-w-48">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
                <input value={paySearch} onChange={(e) => setPaySearch(e.target.value)}
                  placeholder="Search voucher, payee, UTR…"
                  className="w-full rounded-lg border border-[#c8d4c0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#16a34a]" />
              </div>
            </div>
            {filteredPayVouchers.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#8fa888]">{vouchers.length === 0 ? "No payments posted yet." : "No vouchers match your search."}</p>
            ) : (
              <div className="divide-y divide-[#edf0e8]">
                {filteredPayVouchers.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-[#fafcf8]">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs font-bold text-[#172018]">{v.voucherNo}</span>
                        <span className="font-semibold text-sm text-[#172018]">{v.partyName}</span>
                        <span className="text-xs text-[#8fa888]">{v.voucherDate}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-[#8fa888]">
                        <span>{v.paymentMode}</span>
                        {v.bankRef && <span className="font-mono">{v.bankRef}</span>}
                        {v.narration && <span className="max-w-[300px] truncate">{v.narration}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {v.allocatedTo && v.allocatedTo.length > 0 && (
                        <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 text-xs font-semibold text-[#15803d]">
                          {v.allocatedTo.length} lot{v.allocatedTo.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-base font-bold text-[#172018]">{inr(v.amount)}</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {filteredPayVouchers.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#edf0e8] bg-[#f3f6ef] px-4 py-2.5 text-xs text-[#536251]">
                <span>{filteredPayVouchers.length} voucher{filteredPayVouchers.length !== 1 ? "s" : ""}</span>
                <span className="font-semibold">Total paid: {inr(filteredPayVouchers.reduce((s, v) => s + v.amount, 0))}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── EXPENSES & DRAWINGS ──────────────────────────────────────────────────────

function ExpensesTab() {
  const [vouchers, setVouchers]     = useState<Voucher[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [txnType, setTxnType]       = useState<"Expense" | "Drawing">("Expense");
  const [expenseCode, setExpenseCode] = useState("5201");
  const [amount, setAmount]         = useState(0);
  const [search, setSearch]         = useState("");
  const [saveOk, setSaveOk]         = useState("");
  const [saveErr, setSaveErr]       = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/vouchers?type=Expense").then((r) => r.json()),
      fetch("/api/vouchers?type=Drawing").then((r) => r.json()),
    ]).then(([exps, draws]) => {
      const all = [
        ...(Array.isArray(exps) ? exps : []),
        ...(Array.isArray(draws) ? draws : []),
      ].sort((a, b) => b.voucherDate.localeCompare(a.voucherDate));
      setVouchers(all);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveOk(""); setSaveErr("");
    const fd = new FormData(e.currentTarget);
    const amt = Number(fd.get("amount") ?? 0);
    if (amt <= 0) { setSaveErr("Enter a valid amount greater than zero."); return; }
    setSaving(true);

    const cat = EXPENSE_CATEGORIES.find((c) => c.code === expenseCode) ?? EXPENSE_CATEGORIES[7];
    const srcCode = String(fd.get("paidFromCode") ?? "1100");
    const srcName = PAYMENT_SOURCES.find((s) => s.code === srcCode)?.name ?? "Bank / Cash";
    const desc    = String(fd.get("description") ?? "").trim();
    const ref     = String(fd.get("bankRef") ?? "").trim();
    const narration = [desc, ref].filter(Boolean).join(" — ") ||
      (txnType === "Drawing" ? "Owner Drawing" : cat.name);

    const body: Record<string, unknown> = {
      voucherType:  txnType,
      voucherDate:  fd.get("voucherDate"),
      amount:       amt,
      paymentMode:  fd.get("paymentMode"),
      bankRef:      ref,
      narration,
      status:       "Posted",
      paidFromCode: srcCode,
      paidFromName: srcName,
    };
    if (txnType === "Expense") {
      body.expenseAccountCode = cat.code;
      body.expenseAccountName = cat.name;
    }

    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaving(false);
      if (!res.ok) {
        let msg = "Failed to post.";
        try {
          const err = await res.json();
          msg = typeof err.error === "string" ? err.error : JSON.stringify(err.error ?? err);
        } catch { /* response wasn't JSON */ }
        setSaveErr(msg);
        return;
      }
      setSaveOk(`${txnType} of ${inr(amt)} posted successfully. Ledger updated.`);
      (e.target as HTMLFormElement).reset();
      setAmount(0);
      load();
    } catch (ex) {
      setSaving(false);
      setSaveErr(ex instanceof Error ? ex.message : String(ex));
    }
  }

  const expVouchers   = useMemo(() => vouchers.filter((v) => v.voucherType === "Expense"), [vouchers]);
  const drawVouchers  = useMemo(() => vouchers.filter((v) => v.voucherType === "Drawing"), [vouchers]);

  const thisMonth     = new Date().toISOString().slice(0, 7);
  const fyStart       = (() => { const n = new Date(); return n.getMonth() >= 3 ? `${n.getFullYear()}-04` : `${n.getFullYear() - 1}-04`; })();
  const monthExpTotal = expVouchers.filter((v) => v.voucherDate.startsWith(thisMonth)).reduce((s, v) => s + v.amount, 0);
  const fyDrawTotal   = drawVouchers.filter((v) => v.voucherDate.slice(0, 7) >= fyStart).reduce((s, v) => s + v.amount, 0);

  const filtered = useMemo(() => {
    if (!search.trim()) return vouchers;
    const q = search.toLowerCase();
    return vouchers.filter((v) =>
      v.voucherNo.toLowerCase().includes(q) ||
      v.narration.toLowerCase().includes(q) ||
      (v.bankRef ?? "").toLowerCase().includes(q)
    );
  }, [vouchers, search]);

  // Category breakdown for the current month
  const categoryBreakdown = useMemo(() =>
    EXPENSE_CATEGORIES.map((cat) => ({
      ...cat,
      total: expVouchers
        .filter((v) => v.voucherDate.startsWith(thisMonth) && v.narration.includes(cat.name))
        .reduce((s, v) => s + v.amount, 0),
    })).filter((c) => c.total > 0),
  [expVouchers, thisMonth]);

  const selectedCatName = EXPENSE_CATEGORIES.find((c) => c.code === expenseCode)?.name ?? "Expense";

  return (
    <div className="grid gap-5">
      {/* ── KPI tiles ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Expenses this month</p>
            <Receipt size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#172018]">{inr(monthExpTotal)}</p>
          <p className="mt-1 text-xs text-[#8fa888]">
            {expVouchers.filter((v) => v.voucherDate.startsWith(thisMonth)).length} entr{expVouchers.filter((v) => v.voucherDate.startsWith(thisMonth)).length === 1 ? "y" : "ies"}
            {categoryBreakdown.length > 0 && ` · ${categoryBreakdown.length} categor${categoryBreakdown.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Drawings this FY</p>
            <Wallet size={16} className="text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#172018]">{inr(fyDrawTotal)}</p>
          <p className="mt-1 text-xs text-[#8fa888]">{drawVouchers.length} withdrawal{drawVouchers.length !== 1 ? "s" : ""} · Dr 3900</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #6b7280" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">All time total</p>
            <BookOpen size={16} className="text-gray-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#172018]">{inr(vouchers.reduce((s, v) => s + v.amount, 0))}</p>
          <p className="mt-1 text-xs text-[#8fa888]">{expVouchers.length} expense{expVouchers.length !== 1 ? "s" : ""} · {drawVouchers.length} drawing{drawVouchers.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* ── Collapsible entry form ─────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <button type="button" onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-[#fafcf8] transition-colors">
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${showForm ? "bg-[#536251]" : "bg-[#16a34a]"}`}>
              <Plus size={15} style={{ transform: showForm ? "rotate(45deg)" : "none", transition: "transform 0.2s" }} />
            </span>
            <div>
              <p className="font-semibold text-sm text-[#172018]">Record expense or owner drawing</p>
              <p className="text-xs text-[#60735d]">
                Expense: Dr 52xx / Cr Bank &nbsp;·&nbsp; Drawing: Dr 3900 Owner Drawings / Cr Bank
              </p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-[#60735d] transition-transform duration-200 ${showForm ? "rotate-180" : ""}`} />
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="border-t border-[#edf0e8] p-5">
            {saveErr && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
                <X size={14} />{saveErr}
              </div>
            )}
            {saveOk && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#15803d]">
                <Check size={14} />{saveOk}
              </div>
            )}

            {/* Transaction type toggle */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex overflow-hidden rounded-lg border border-[#d8decf]">
                {(["Expense", "Drawing"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setTxnType(t); setSaveOk(""); setSaveErr(""); }}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors ${txnType === t
                      ? t === "Expense" ? "bg-[#172018] text-white" : "bg-[#7c3aed] text-white"
                      : "bg-white text-[#536251] hover:bg-[#f3f6ef]"}`}>
                    {t === "Expense" ? <Receipt size={13} /> : <Wallet size={13} />}{t}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#60735d]">
                {txnType === "Expense"
                  ? "Business cost paid from company funds — deductible expense"
                  : "Owner personal withdrawal — reduces capital; not a business expense"}
              </p>
            </div>

            {/* Live ledger preview */}
            <div className="mb-4 rounded-lg bg-[#f3f6ef] px-4 py-2.5 text-xs text-[#536251]">
              <span className="font-mono">
                {txnType === "Expense"
                  ? `Dr ${expenseCode} ${selectedCatName}${amount > 0 ? `  ${inr(amount)}` : ""}  ·  Cr 1100 Bank / Cash`
                  : `Dr 3900 Owner Drawings${amount > 0 ? `  ${inr(amount)}` : ""}  ·  Cr 1100 Bank / Cash`}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Date *
                <input name="voucherDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)}
                  className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Amount (₹) *
                <input name="amount" type="number" required min="1" step="0.01" placeholder="500"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
              </label>

              {txnType === "Expense" && (
                <label className="grid gap-1.5 text-sm font-medium">
                  Category *
                  <select value={expenseCode} onChange={(e) => setExpenseCode(e.target.value)}
                    className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="grid gap-1.5 text-sm font-medium">
                Paid from
                <select name="paidFromCode"
                  className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
                  {PAYMENT_SOURCES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Payment mode
                <select name="paymentMode"
                  className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
                  {["Cash", "UPI", "NEFT", "Cheque", "RTGS"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Bill / reference no
                <input name="bankRef" type="text" placeholder="BILL-001, ATM-xxxx, UPI-ref…"
                  className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
              </label>

              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 xl:col-span-3">
                Description *
                <input name="description" type="text" required
                  placeholder={txnType === "Expense"
                    ? "e.g. Auto fare to market, 2 reams A4 paper, electrician charges…"
                    : "e.g. Personal medical expenses, home rent, family function…"}
                  className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" disabled={saving}
                className={`flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${txnType === "Expense" ? "bg-[#172018] hover:bg-[#2d4a2a]" : "bg-[#7c3aed] hover:bg-[#6d28d9]"}`}>
                <Check size={14} />{saving ? "Posting…" : `Post ${txnType}`}
              </button>
              <button type="reset" onClick={() => { setAmount(0); setSaveOk(""); setSaveErr(""); }}
                className="flex items-center gap-1.5 rounded-lg border border-[#d8decf] bg-white px-4 py-2.5 text-sm font-semibold text-[#536251] hover:bg-[#f3f6ef]">
                <RotateCcw size={14} />Reset
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="ml-auto flex items-center gap-1 text-xs text-[#8fa888] hover:text-[#536251]">
                <X size={12} />Collapse
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Register ──────────────────────────────────────────────────── */}
      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0e8] px-4 py-3">
            <div>
              <h3 className="text-base font-semibold">Expense & Drawings register</h3>
              <p className="text-xs text-[#60735d]">
                {expVouchers.length} expense{expVouchers.length !== 1 ? "s" : ""} (Dr 52xx) · {drawVouchers.length} drawing{drawVouchers.length !== 1 ? "s" : ""} (Dr 3900)
              </p>
            </div>
            <div className="relative min-w-48">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, reference…"
                className="w-full rounded-lg border border-[#c8d4c0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#16a34a]" />
            </div>
          </div>

          {/* Category breakdown strip — expenses only, this month */}
          {categoryBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-[#edf0e8] bg-amber-50/60 px-4 py-2.5">
              <span className="text-xs font-semibold text-amber-700">This month by category:</span>
              {categoryBreakdown.map((c) => (
                <span key={c.code} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  {c.name}: {inr(c.total)}
                </span>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Banknote size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
              <p className="font-semibold text-[#172018]">{vouchers.length === 0 ? "No entries yet" : "No records match your search"}</p>
              <p className="mt-1 text-sm text-[#60735d]">Click the &quot;+&quot; button above to record an expense or drawing.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0e8]">
              {filtered.map((v) => {
                const isDrawing = v.voucherType === "Drawing";
                return (
                  <div key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-[#fafcf8]">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDrawing ? "bg-purple-100 text-purple-600" : "bg-amber-100 text-amber-600"}`}>
                      {isDrawing ? <Wallet size={14} /> : <Receipt size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs font-bold text-[#172018]">{v.voucherNo}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isDrawing ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                          {isDrawing ? "Drawing" : "Expense"}
                        </span>
                        <span className="text-xs text-[#8fa888]">{v.voucherDate}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-[#172018] font-medium max-w-[400px] truncate">{v.narration || "—"}</p>
                      {(v.paymentMode || v.bankRef) && (
                        <p className="text-xs text-[#9aad9c]">{v.paymentMode}{v.bankRef ? ` · ${v.bankRef}` : ""}</p>
                      )}
                    </div>
                    <span className={`text-base font-bold ${isDrawing ? "text-purple-700" : "text-amber-700"}`}>{inr(v.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#edf0e8] bg-[#f3f6ef] px-4 py-2.5 text-xs text-[#536251]">
              <span>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
              <div className="flex gap-4">
                <span>Expenses: <span className="font-semibold text-amber-700">{inr(filtered.filter((v) => v.voucherType === "Expense").reduce((s, v) => s + v.amount, 0))}</span></span>
                <span>Drawings: <span className="font-semibold text-purple-700">{inr(filtered.filter((v) => v.voucherType === "Drawing").reduce((s, v) => s + v.amount, 0))}</span></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TRIAL BALANCE ────────────────────────────────────────────────────────────

interface AccountSummary {
  accountCode: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  net: number; // positive = Dr balance, negative = Cr balance
  entries: LedgerEntry[];
}

function TrialBalanceTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group entries by accountCode. Spread each entry so we can write runningBalance without
  // mutating the original state objects.
  const accounts: AccountSummary[] = Object.values(
    entries.reduce<Record<string, AccountSummary>>((acc, e) => {
      if (!acc[e.accountCode]) {
        acc[e.accountCode] = {
          accountCode: e.accountCode,
          accountName: e.accountName,
          totalDebit: 0,
          totalCredit: 0,
          net: 0,
          entries: [],
        };
      }
      acc[e.accountCode].totalDebit += e.debit;
      acc[e.accountCode].totalCredit += e.credit;
      acc[e.accountCode].net += e.debit - e.credit;
      acc[e.accountCode].entries.push({ ...e });
      return acc;
    }, {})
  ).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  // Sort each account's entries chronologically and compute running balance per entry.
  // DB stores runningBalance as 0; it must be derived here from the sorted sequence.
  accounts.forEach((acct) => {
    acct.entries.sort(
      (a, b) => a.entryDate.localeCompare(b.entryDate) || (a.id ?? "").localeCompare(b.id ?? ""),
    );
    let bal = 0;
    for (const e of acct.entries) {
      bal = Math.round((bal + e.debit - e.credit) * 100) / 100;
      e.runningBalance = bal;
    }
  });

  const totalDr = accounts.filter((a) => a.net > 0).reduce((s, a) => s + a.net, 0);
  const totalCr = accounts.filter((a) => a.net < 0).reduce((s, a) => s + Math.abs(a.net), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 1;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Trial Balance</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">Aggregated from all posted ledger entries</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isBalanced ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fef2f2] text-[#b91c1c]"}`}>
              {isBalanced ? "Balanced" : "Out of balance"}
            </span>
          )}
          <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading ledger entries…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-[#d8decf] bg-white p-10 text-center">
          <Scale size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
          <p className="font-semibold text-[#172018]">No ledger entries yet</p>
          <p className="mt-1 text-sm text-[#60735d]">Post settlements or invoices to see the trial balance here.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #3b82f6" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Total debits</p>
                <ArrowUpRight size={16} className="text-blue-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#1d4ed8]">{inr(accounts.reduce((s, a) => s + a.totalDebit, 0))}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #dc2626" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Total credits</p>
                <TrendingUp size={16} className="text-red-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#dc2626]">{inr(accounts.reduce((s, a) => s + a.totalCredit, 0))}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-4" style={{ borderLeft: "4px solid #16a34a" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#60735d]">Accounts active</p>
                <Building2 size={16} className="text-green-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#172018]">{accounts.length}</p>
              <p className="mt-1 text-xs text-[#8fa888]">{isBalanced ? "Books are balanced" : "Books out of balance"}</p>
            </div>
          </div>

          {/* Main trial balance table */}
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="flex items-center justify-between border-b border-[#edf0e8] px-4 py-2.5 bg-[#fafcf8]">
              <p className="text-xs text-[#60735d]">Click any account row to expand its transaction history</p>
              <div className="flex items-center gap-3 text-xs text-[#8fa888]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block"></span>Assets/Expenses (Dr nat.)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block"></span>Liabilities/Income (Cr nat.)</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                  <tr>
                    <th className="px-4 py-3 w-8"></th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Account name</th>
                    <th className="px-4 py-3 text-right">Debit (₹)</th>
                    <th className="px-4 py-3 text-right">Credit (₹)</th>
                    <th className="px-4 py-3 text-right">Net balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acct) => {
                    // Color-code by account type based on code prefix
                    const code = Number(acct.accountCode);
                    const isAsset   = code >= 1000 && code < 2000;
                    const isLiab    = code >= 2000 && code < 3000;
                    const isIncome  = code >= 3000 && code < 4000;
                    const isExpense = code >= 5000;
                    const acctColor = isAsset ? "text-blue-700" : isLiab ? "text-red-700" : isIncome ? "text-green-700" : isExpense ? "text-orange-700" : "text-[#172018]";
                    return (
                    <React.Fragment key={acct.accountCode}>
                      <tr
                        onClick={() => setExpandedAccount(expandedAccount === acct.accountCode ? null : acct.accountCode)}
                        className="cursor-pointer border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                      >
                        <td className="px-4 py-3 text-[#60735d]">
                          {expandedAccount === acct.accountCode ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs font-bold ${acctColor}`}>{acct.accountCode}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#172018]">{acct.accountName}</td>
                        <td className="px-4 py-3 text-right text-[#1d4ed8]">{acct.totalDebit > 0 ? inr(acct.totalDebit) : <span className="text-[#c8d4c0]">—</span>}</td>
                        <td className="px-4 py-3 text-right text-[#dc2626]">{acct.totalCredit > 0 ? inr(acct.totalCredit) : <span className="text-[#c8d4c0]">—</span>}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          {inr(Math.abs(acct.net))}
                          <span className={`ml-1 text-xs font-semibold ${acct.net >= 0 ? "text-[#1d4ed8]" : "text-[#dc2626]"}`}>
                            {acct.net >= 0 ? "Dr" : "Cr"}
                          </span>
                        </td>
                      </tr>
                      {expandedAccount === acct.accountCode && (
                        <tr key={`${acct.accountCode}-detail`} className="border-t border-[#edf0e8] bg-[#f8faf6]">
                          <td colSpan={6} className="px-4 py-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[#60735d]">
                                  <th className="pb-1.5 text-left font-semibold">Date</th>
                                  <th className="pb-1.5 text-left font-semibold">Narration</th>
                                  <th className="pb-1.5 text-left font-semibold">Source ref</th>
                                  <th className="pb-1.5 text-right font-semibold">Debit</th>
                                  <th className="pb-1.5 text-right font-semibold">Credit</th>
                                  <th className="pb-1.5 text-right font-semibold">Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {acct.entries.map((e) => (
                                  <tr key={e.id} className="border-t border-[#edf0e8]">
                                    <td className="py-1.5 text-[#536251]">{e.entryDate}</td>
                                    <td className="py-1.5 max-w-[260px] truncate text-[#172018]">{e.narration}</td>
                                    <td className="py-1.5 font-mono text-[#1d4ed8]">{e.sourceRef}</td>
                                    <td className="py-1.5 text-right text-[#1d4ed8]">{e.debit > 0 ? inr(e.debit) : "—"}</td>
                                    <td className="py-1.5 text-right text-[#dc2626]">{e.credit > 0 ? inr(e.credit) : "—"}</td>
                                    <td className="py-1.5 text-right font-semibold">
                                      {inr(Math.abs(e.runningBalance))}
                                      <span className={`ml-1 ${e.runningBalance >= 0 ? "text-[#1d4ed8]" : "text-[#dc2626]"}`}>
                                        {e.runningBalance >= 0 ? "Dr" : "Cr"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 border-[#c8d4c0] bg-[#f3f6ef] font-bold">
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                    <td className="px-4 py-3 text-right text-[#1d4ed8]">{inr(accounts.reduce((s, a) => s + a.totalDebit, 0))}</td>
                    <td className="px-4 py-3 text-right text-[#dc2626]">{inr(accounts.reduce((s, a) => s + a.totalCredit, 0))}</td>
                    <td className="px-4 py-3 text-right">
                      {isBalanced ? (
                        <span className="text-[#15803d]">Balanced ✓</span>
                      ) : (
                        <span className="text-[#dc2626]">{inr(Math.abs(totalDr - totalCr))} diff</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── JOURNAL ──────────────────────────────────────────────────────────────────

interface JournalGroup {
  sourceRef: string;
  date: string;
  narration: string;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
}

function JournalTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by sourceRef
  const groups: JournalGroup[] = Object.values(
    entries.reduce<Record<string, JournalGroup>>((acc, e) => {
      const key = e.sourceRef || e.sourceId;
      if (!acc[key]) {
        acc[key] = {
          sourceRef: key,
          date: e.entryDate,
          narration: e.narration,
          entries: [],
          totalDebit: 0,
          totalCredit: 0,
        };
      }
      acc[key].entries.push(e);
      acc[key].totalDebit += e.debit;
      acc[key].totalCredit += e.credit;
      return acc;
    }, {})
  ).sort((a, b) => b.date.localeCompare(a.date));

  const filtered = groups.filter((g) => {
    if (dateFrom && g.date < dateFrom) return false;
    if (dateTo && g.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return g.sourceRef.toLowerCase().includes(q) || g.narration.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#d8decf] bg-white px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-[#172018]">Journal</h3>
          {!loading && <p className="text-xs text-[#60735d]">{filtered.length} transaction group{filtered.length !== 1 ? "s" : ""} · {entries.length} line{entries.length !== 1 ? "s" : ""}</p>}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
            <input type="text" placeholder="Search ref or narration…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-[#c8d4c0] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#16a34a] min-w-48" />
          </div>
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-[#c8d4c0] px-2.5 py-1.5 text-xs outline-none focus:border-[#16a34a]" />
            <span className="text-xs text-[#60735d]">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-[#c8d4c0] px-2.5 py-1.5 text-xs outline-none focus:border-[#16a34a]" />
          </div>
          {(search || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1 rounded-lg border border-[#d8decf] px-2.5 py-1.5 text-xs text-[#536251] hover:bg-[#f3f6ef]">
              <X size={11} />Clear
            </button>
          )}
          <button onClick={load} className="flex items-center gap-1 rounded-lg border border-[#d8decf] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#536251] hover:bg-[#f3f6ef]"><RefreshCw size={12} />Refresh</button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading journal entries…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#d8decf] bg-white p-10 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
          <p className="font-semibold text-[#172018]">{entries.length === 0 ? "No journal entries yet" : "No entries match your filter"}</p>
          <p className="mt-1 text-sm text-[#60735d]">
            {entries.length === 0
              ? "Post settlements or invoices to see journal entries here."
              : "Try adjusting the date range or search term."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((group) => (
            <div key={group.sourceRef} className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[#fafcf8]"
                onClick={() => setExpandedRef(expandedRef === group.sourceRef ? null : group.sourceRef)}
              >
                <div className="flex items-center gap-4">
                  {expandedRef === group.sourceRef ? <ChevronDown size={16} className="text-[#60735d]" /> : <ChevronRight size={16} className="text-[#60735d]" />}
                  <div>
                    <p className="font-semibold text-[#172018]">{group.sourceRef}</p>
                    <p className="mt-0.5 text-xs text-[#60735d]">{group.date} · {group.entries.length} line{group.entries.length !== 1 ? "s" : ""} · {group.narration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-[#1d4ed8]">Dr {inr(group.totalDebit)}</span>
                  <span className="text-[#dc2626]">Cr {inr(group.totalCredit)}</span>
                  {Math.abs(group.totalDebit - group.totalCredit) < 1 ? (
                    <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 text-xs font-semibold text-[#15803d]">Balanced</span>
                  ) : (
                    <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-xs font-semibold text-[#b91c1c]">Unbalanced</span>
                  )}
                </div>
              </button>
              {expandedRef === group.sourceRef && (
                <div className="border-t border-[#edf0e8] overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Account</th>
                        <th className="px-5 py-3">Narration</th>
                        <th className="px-5 py-3 text-right">Debit</th>
                        <th className="px-5 py-3 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((e) => (
                        <tr key={e.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                          <td className="px-5 py-2.5 text-[#536251] whitespace-nowrap">{e.entryDate}</td>
                          <td className="px-5 py-2.5">
                            <span className="font-mono text-xs text-[#172018]">{e.accountCode}</span>
                            <span className="ml-2 text-[#536251]">{e.accountName}</span>
                          </td>
                          <td className="px-5 py-2.5 max-w-[280px] truncate text-[#536251]">{e.narration}</td>
                          <td className="px-5 py-2.5 text-right font-semibold text-[#1d4ed8]">{e.debit > 0 ? inr(e.debit) : "—"}</td>
                          <td className="px-5 py-2.5 text-right font-semibold text-[#dc2626]">{e.credit > 0 ? inr(e.credit) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADJUSTMENTS (Credit Notes / Debit Notes) ────────────────────────────────

interface AdjNote {
  id: string;
  invoiceNo: string;
  invoiceType: "CreditNote" | "DebitNote";
  invoiceDate: string;
  partyName: string;
  totalValue: number;
  status: string;
  materialName: string;
}

function AdjustmentsTab() {
  const [notes, setNotes] = useState<AdjNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState("");

  // Form state
  const [noteType, setNoteType] = useState<"CreditNote" | "DebitNote">("CreditNote");
  const [partyRole, setPartyRole] = useState<"Customer" | "Supplier">("Customer");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [linkedInvoiceId, setLinkedInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/adjustment-notes").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
    ]).then(([ns, invs, pts]) => {
      setNotes(Array.isArray(ns) ? ns : []);
      setInvoices(Array.isArray(invs) ? invs : []);
      setParties(Array.isArray(pts) ? pts : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const linkableInvoices = invoices.filter(
    (i) => i.partyId === selectedPartyId &&
      i.invoiceType === "Sales" &&
      i.status !== "Cancelled"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(""); setSaveOk("");
    const party = parties.find((p) => p.id === selectedPartyId);
    const linkedInv = invoices.find((i) => i.id === linkedInvoiceId);
    if (!party) { setSaveError("Select a party."); return; }
    if (!Number(amount) || Number(amount) <= 0) { setSaveError("Enter a valid amount."); return; }

    setSaving(true);
    const res = await fetch("/api/adjustment-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteType,
        partyRole,
        partyId: party.id,
        partyName: party.name,
        amount: Number(amount),
        noteDate,
        linkedInvoiceId: linkedInvoiceId || undefined,
        linkedInvoiceNo: linkedInv?.invoiceNo ?? "",
        reason,
        businessModel: "A",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      setSaveError(err.error ?? "Failed to save.");
      return;
    }
    setSaveOk(`${noteType === "CreditNote" ? "Credit Note" : "Debit Note"} posted successfully.`);
    setSelectedPartyId(""); setAmount(""); setLinkedInvoiceId(""); setReason("");
    load();
  }

  const noteTypeLabel = (t: string) => t === "CreditNote" ? "Credit Note" : "Debit Note";

  return (
    <div className="grid gap-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          <strong>Adjustment notes are permanent.</strong> They post new ledger entries — they do not modify or delete prior entries.
          Use a <strong>Credit Note</strong> to reduce an amount owed, and a <strong>Debit Note</strong> to increase it.
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-1 text-xl font-semibold">Create Credit / Debit Note</h3>
        <p className="mb-5 text-sm text-[#60735d]">Posts corrective ledger entries against a customer or supplier account.</p>

        {saveError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            <X size={14} />{saveError}
          </div>
        )}
        {saveOk && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#15803d]">
            <Check size={14} />{saveOk}
          </div>
        )}

        {/* Note type + party role */}
        <div className="mb-5 flex flex-wrap gap-3">
          <div className="flex overflow-hidden rounded-lg border border-[#d8decf]">
            {(["CreditNote", "DebitNote"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNoteType(t)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors ${noteType === t ? (t === "CreditNote" ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fef2f2] text-[#dc2626]") : "bg-white text-[#536251] hover:bg-[#f3f6ef]"}`}
              >
                {t === "CreditNote" ? <MinusCircle size={14} /> : <PlusCircle size={14} />}
                {noteTypeLabel(t)}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-[#d8decf]">
            {(["Customer", "Supplier"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setPartyRole(r); setSelectedPartyId(""); setLinkedInvoiceId(""); }}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${partyRole === r ? "bg-[#172018] text-white" : "bg-white text-[#536251] hover:bg-[#f3f6ef]"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Explanation chip */}
        <div className="mb-5 rounded-lg bg-[#f3f6ef] px-4 py-2.5 text-xs text-[#536251]">
          {noteType === "CreditNote" && partyRole === "Customer" && "Dr 3101 Sales Adj — Cr 1201 Customer AR (reduces what customer owes Akshaya)"}
          {noteType === "DebitNote"  && partyRole === "Customer" && "Dr 1201 Customer AR — Cr 3101 Sales Adj (increases what customer owes Akshaya)"}
          {noteType === "CreditNote" && partyRole === "Supplier" && "Dr 2101 Supplier Payable — Cr 5001 Procurement Adj (reduces what Akshaya owes supplier)"}
          {noteType === "DebitNote"  && partyRole === "Supplier" && "Dr 5001 Procurement Adj — Cr 2101 Supplier Payable (increases what Akshaya owes supplier)"}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            {partyRole} *
            <select
              value={selectedPartyId}
              onChange={(e) => { setSelectedPartyId(e.target.value); setLinkedInvoiceId(""); }}
              required
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            >
              <option value="">Select {partyRole.toLowerCase()}…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Note date *
            <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} required
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Amount (₹) *
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" step="0.01" placeholder="50000"
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
          {partyRole === "Customer" && (
            <label className="grid gap-1.5 text-sm font-medium">
              Link to invoice (optional)
              <select
                value={linkedInvoiceId}
                onChange={(e) => setLinkedInvoiceId(e.target.value)}
                className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
              >
                <option value="">None — standalone note</option>
                {linkableInvoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.invoiceNo} — {inr(i.amountDue)} due</option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            Reason / narration *
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} required
              placeholder="e.g. Weight re-measurement correction, quality dispute settlement…"
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={saving}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${noteType === "CreditNote" ? "bg-[#15803d] hover:bg-[#166534]" : "bg-[#dc2626] hover:bg-[#b91c1c]"}`}
          >
            {noteType === "CreditNote" ? <MinusCircle size={14} /> : <PlusCircle size={14} />}
            {saving ? "Posting…" : `Post ${noteTypeLabel(noteType)}`}
          </button>
          <button type="reset" onClick={() => { setSelectedPartyId(""); setAmount(""); setLinkedInvoiceId(""); setReason(""); setSaveError(""); setSaveOk(""); }}
            className="flex items-center gap-1.5 rounded-lg border border-[#d8decf] bg-white px-4 py-2.5 text-sm font-semibold text-[#536251] hover:bg-[#f3f6ef]">
            <RotateCcw size={14} />Reset
          </button>
        </div>
      </form>

      {/* Register */}
      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold">Adjustment note register</h3>
              <p className="mt-0.5 text-xs text-[#60735d]">{notes.length} note{notes.length !== 1 ? "s" : ""} posted</p>
            </div>
            <button onClick={load} className="btn btn-ghost flex items-center gap-1.5 text-xs"><RefreshCw size={13} />Refresh</button>
          </div>
          {notes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <MinusCircle size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
              <p className="font-semibold text-[#172018]">No adjustment notes yet</p>
              <p className="mt-1 text-sm text-[#60735d]">Create a credit note or debit note using the form above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                  <tr>{["Note no", "Type", "Date", "Party", "Amount", "Status"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr key={n.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                      <td className="px-5 py-3.5 font-semibold font-mono text-xs">{n.invoiceNo}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${n.invoiceType === "CreditNote" ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fef2f2] text-[#dc2626]"}`}>
                          {n.invoiceType === "CreditNote" ? <MinusCircle size={10} /> : <PlusCircle size={10} />}
                          {noteTypeLabel(n.invoiceType)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#536251]">{n.invoiceDate}</td>
                      <td className="px-5 py-3.5 font-bold">{n.partyName}</td>
                      <td className="px-5 py-3.5 font-bold">{inr(n.totalValue)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={n.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>("Invoices");
  const [receiptPreset, setReceiptPreset] = useState<{ partyId: string; invoiceId: string; invoiceNo?: string } | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const { partyId, invoiceId, invoiceNo } = (e as CustomEvent).detail as { partyId: string; invoiceId: string; invoiceNo?: string };
      setReceiptPreset({ partyId, invoiceId, invoiceNo });
      setTab("Receipts");
    }
    window.addEventListener("akshaya:receipt-for-invoice", handler);
    return () => window.removeEventListener("akshaya:receipt-for-invoice", handler);
  }, []);

  return (
    <div className="grid gap-5">
      {/* Tab navigation */}
      <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-[#d8decf] bg-white p-1.5">
        {TABS.map((t) => {
          const TabIcon = ACCT_TAB_ICONS[t];
          const isActive = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all
                ${isActive
                  ? "bg-[#172018] text-white shadow-sm"
                  : "text-[#536251] hover:bg-[#f3f6ef] hover:text-[#172018]"
                }`}
            >
              <TabIcon size={14} />{t}
            </button>
          );
        })}
      </div>
      {tab === "Invoices"      && <InvoicesTab />}
      {tab === "Receipts"      && <ReceiptsTab preset={receiptPreset} onPresetConsumed={() => setReceiptPreset(null)} />}
      {tab === "Payments"      && <PaymentsTab />}
      {tab === "Expenses"      && <ExpensesTab />}
      {tab === "Trial Balance" && <TrialBalanceTab />}
      {tab === "Journal" && <JournalTab />}
      {tab === "Adjustments" && <AdjustmentsTab />}
    </div>
  );
}
