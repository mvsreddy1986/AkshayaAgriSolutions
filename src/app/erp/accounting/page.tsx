"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Invoice, Voucher, LedgerEntry, Party } from "../../../lib/types";
import {
  FileText, Receipt, CreditCard, BookOpen, Scale,
  Plus, Check, X, Download, Eye, CheckCircle2, Send, RotateCcw,
  Search, ChevronDown, ChevronRight, RefreshCw,
} from "lucide-react";

const TABS = ["Invoices", "Receipts", "Payments", "Trial Balance", "Journal"] as const;
type Tab = (typeof TABS)[number];

const ACCT_TAB_ICONS = {
  "Invoices": FileText,
  "Receipts": Receipt,
  "Payments": CreditCard,
  "Trial Balance": Scale,
  "Journal": BookOpen,
} as const;

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

  const totalDue = invoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled").reduce((s, i) => s + i.amountDue, 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Total outstanding</p>
          <p className="mt-2 text-3xl font-bold">{inr(totalDue)}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Draft invoices</p>
          <p className="mt-2 text-3xl font-bold text-[#d97706]">{invoices.filter((i) => i.status === "Draft").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Approved (not yet paid)</p>
          <p className="mt-2 text-3xl font-bold text-[#1d4ed8]">{invoices.filter((i) => i.status === "Approved" || i.status === "Sent").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Settled this month</p>
          <p className="mt-2 text-3xl font-bold text-[#15803d]">{invoices.filter((i) => i.status === "Paid").length}</p>
        </div>
      </div>

      {/* Model A info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>
          <strong>Model A tax invoices</strong> are automatically recorded here when you click{" "}
          <strong>Save to Accounts</strong> inside the Tax Invoice dialog in Procurement.
          Use <em>Manual Invoice</em> only for one-off adjustments outside the standard procurement flow.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Invoice register</h3>
        <div className="flex gap-2">
          <button className="btn btn-ghost flex items-center gap-1.5"><Download size={14} />Export</button>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-ghost flex items-center gap-1.5 text-xs border border-[#d8decf]"><Plus size={14} />Manual Invoice</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
          <h3 className="mb-4 text-xl font-semibold">Generate GST invoice</h3>
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
            <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5">
              <Check size={14} />{saving ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost flex items-center gap-1.5"><X size={14} />Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Invoice no", "Model", "Date", "Due date", "Party", "Material", "Qty (MT)", "Value", "Paid", "Due", "Status", "Action"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-semibold whitespace-nowrap">{inv.invoiceNo}</td>
                    <td className="px-5 py-3.5"><ModelBadge model={inv.businessModel} /></td>
                    <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{inv.invoiceDate}</td>
                    <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{inv.dueDate}</td>
                    <td className="px-5 py-3.5 font-bold max-w-[160px] truncate">{inv.partyName}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{inv.materialName}</td>
                    <td className="px-5 py-3.5">{inv.quantity.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-bold whitespace-nowrap">{inr(inv.totalValue)}</td>
                    <td className="px-5 py-3.5 text-[#15803d] whitespace-nowrap">{inr(inv.amountPaid)}</td>
                    <td className="px-5 py-3.5 font-semibold whitespace-nowrap">{inr(inv.amountDue)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 whitespace-nowrap">
                        {inv.status === "Draft" && (
                          <button onClick={() => approveInvoice(inv.id)} className="text-xs font-semibold text-[#15803d] hover:underline inline-flex items-center gap-1"><CheckCircle2 size={12} />Approve</button>
                        )}
                        {(inv.status === "Approved" || inv.status === "Sent" || inv.status === "Partial") && (
                          <button
                            onClick={() => {
                              // Switch to Receipts tab with this invoice pre-selected
                              window.dispatchEvent(new CustomEvent("akshaya:receipt-for-invoice", { detail: { invoiceId: inv.id, partyId: inv.partyId, invoiceNo: inv.invoiceNo } }));
                            }}
                            className="text-xs font-semibold text-[#1d4ed8] hover:underline inline-flex items-center gap-1"
                          >
                            <Send size={12} />Record payment
                          </button>
                        )}
                        {inv.status === "Paid" && (
                          <span className="text-xs text-[#15803d] font-semibold inline-flex items-center gap-1"><Check size={12} />Paid in full</span>
                        )}
                      </div>
                    </td>
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

// ─── RECEIPTS ─────────────────────────────────────────────────────────────────

function ReceiptsTab({ preset, onPresetConsumed }: { preset: { partyId: string; invoiceId: string; invoiceNo?: string } | null; onPresetConsumed: () => void }) {
  const [vouchers, setVouchers]           = useState<Voucher[]>([]);
  const [allInvoices, setAllInvoices]     = useState<Invoice[]>([]);
  const [parties, setParties]             = useState<Party[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [selectedInvIds, setSelectedInvIds]   = useState<Set<string>>(new Set());
  const [narration, setNarration]         = useState("");
  const [narrationEdited, setNarrationEdited] = useState(false);

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

  // Apply preset from "Record payment" shortcut in Invoices tab
  useEffect(() => {
    if (!preset || allInvoices.length === 0) return;
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

  // Open invoices for the selected customer (not Paid / not Cancelled)
  const openInvoices = allInvoices.filter(
    (i) => i.partyId === selectedPartyId &&
      i.status !== "Paid" && i.status !== "Cancelled" && i.amountDue > 0
  ).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)); // oldest first

  const totalSelected = openInvoices
    .filter((i) => selectedInvIds.has(i.id))
    .reduce((s, i) => s + i.amountDue, 0);

  const diff = receiptAmount - totalSelected;
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
    setSelectedInvIds(new Set());
    setNarration("");
    setNarrationEdited(false);
    load();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-1 text-xl font-semibold">Post customer receipt</h3>
        <p className="mb-5 text-sm text-[#60735d]">Posts Dr. Bank / Cr. Customer Receivable and reduces outstanding invoice balances.</p>

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
            Amount received (₹) *
            <input
              name="amount" type="number" required placeholder="11529000"
              value={receiptAmount || ""}
              onChange={(e) => setReceiptAmount(Number(e.target.value) || 0)}
              className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]"
            />
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
                      ? `✓ Receipt exactly covers ${selectedInvIds.size} invoice${selectedInvIds.size !== 1 ? "s" : ""} (${inr(totalSelected)})`
                      : excess
                      ? `Receipt ${inr(receiptAmount)} — selected ${inr(totalSelected)} — ${inr(diff)} will remain unallocated`
                      : `Receipt ${inr(receiptAmount)} — selected ${inr(totalSelected)} — shortfall ${inr(Math.abs(diff))}`}
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
        </div>
      </form>

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h3 className="text-lg font-semibold">Receipt voucher register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Voucher no", "Date", "Party", "Amount", "Mode", "Bank ref", "Narration", "Allocated to", "Status"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-semibold">{v.voucherNo}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{v.voucherDate}</td>
                    <td className="px-5 py-3.5 font-bold">{v.partyName}</td>
                    <td className="px-5 py-3.5 font-semibold">{inr(v.amount)}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{v.paymentMode}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{v.bankRef}</td>
                    <td className="px-5 py-3.5 text-[#536251] max-w-[180px] truncate">{v.narration}</td>
                    <td className="px-5 py-3.5 text-xs text-[#536251]">
                      {v.allocatedTo.length > 0
                        ? <span className="font-medium text-[#15803d]">{v.allocatedTo.length} invoice{v.allocatedTo.length !== 1 ? "s" : ""}</span>
                        : <span className="text-[#9ca3af]">—</span>}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={v.status} /></td>
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

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/vouchers?type=Payment").then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
    ]).then(([vs, pts]) => {
      setVouchers(Array.isArray(vs) ? vs : []);
      setParties(Array.isArray(pts) ? pts : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const partyId = String(fd.get("partyId") ?? "");
    const party = parties.find((p) => p.id === partyId);
    const body = {
      voucherType: "Payment",
      partyId,
      partyName: party?.name ?? "",
      voucherDate: fd.get("voucherDate"),
      amount: Number(fd.get("amount") ?? 0),
      paymentMode: fd.get("paymentMode") ?? "NEFT",
      bankRef: fd.get("bankRef"),
      narration: fd.get("narration"),
      status: "Posted",
    };
    await fetch("/api/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    form.reset();
    load();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-semibold">Post supplier / farmer payment</h3>
        <p className="mb-5 text-sm text-[#60735d]">Accounting entry: Dr. Supplier/Farmer Payable / Cr. Bank.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Payee *
            <select name="partyId" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
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
            <input name="amount" type="number" required placeholder="825400" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Payment mode
            <select name="paymentMode" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]">
              {["NEFT", "RTGS", "IMPS", "Cheque", "Cash", "UPI"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            UTR / reference
            <input name="bankRef" type="text" placeholder="NEFT/20260511/0008876" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 xl:col-span-3">
            Narration
            <textarea name="narration" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#16a34a]" rows={2} placeholder="Supplier settlement — May 2026" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-1.5">
            <Check size={14} />{saving ? "Posting…" : "Post Payment"}
          </button>
          <button type="reset" className="btn btn-ghost flex items-center gap-1.5"><RotateCcw size={14} />Reset</button>
        </div>
      </form>

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h3 className="text-lg font-semibold">Payment voucher register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Voucher no", "Date", "Payee", "Amount", "Mode", "Bank ref", "Narration", "Status"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-semibold">{v.voucherNo}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{v.voucherDate}</td>
                    <td className="px-5 py-3.5 font-bold">{v.partyName}</td>
                    <td className="px-5 py-3.5 font-semibold">{inr(v.amount)}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{v.paymentMode}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{v.bankRef}</td>
                    <td className="px-5 py-3.5 text-[#536251] max-w-[220px] truncate">{v.narration}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={v.status} /></td>
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

  // Group entries by accountCode
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
      acc[e.accountCode].entries.push(e);
      return acc;
    }, {})
  ).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

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
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Total debits</p>
              <p className="mt-2 text-3xl font-bold text-[#1d4ed8]">{inr(accounts.reduce((s, a) => s + a.totalDebit, 0))}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Total credits</p>
              <p className="mt-2 text-3xl font-bold text-[#dc2626]">{inr(accounts.reduce((s, a) => s + a.totalCredit, 0))}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Accounts with activity</p>
              <p className="mt-2 text-3xl font-bold">{accounts.length}</p>
            </div>
          </div>

          {/* Main trial balance table */}
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                  <tr>
                    <th className="px-5 py-3.5 w-8"></th>
                    <th className="px-5 py-3.5">Account code</th>
                    <th className="px-5 py-3.5">Account name</th>
                    <th className="px-5 py-3.5 text-right">Debit (₹)</th>
                    <th className="px-5 py-3.5 text-right">Credit (₹)</th>
                    <th className="px-5 py-3.5 text-right">Net balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acct) => (
                    <React.Fragment key={acct.accountCode}>
                      <tr
                        onClick={() => setExpandedAccount(expandedAccount === acct.accountCode ? null : acct.accountCode)}
                        className="cursor-pointer border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                      >
                        <td className="px-5 py-3.5 text-[#60735d]">
                          {expandedAccount === acct.accountCode ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#172018]">{acct.accountCode}</td>
                        <td className="px-5 py-3.5 font-semibold">{acct.accountName}</td>
                        <td className="px-5 py-3.5 text-right text-[#1d4ed8]">{acct.totalDebit > 0 ? inr(acct.totalDebit) : "—"}</td>
                        <td className="px-5 py-3.5 text-right text-[#dc2626]">{acct.totalCredit > 0 ? inr(acct.totalCredit) : "—"}</td>
                        <td className="px-5 py-3.5 text-right font-bold">
                          {inr(Math.abs(acct.net))}
                          <span className={`ml-1 text-xs ${acct.net >= 0 ? "text-[#1d4ed8]" : "text-[#dc2626]"}`}>
                            {acct.net >= 0 ? "Dr" : "Cr"}
                          </span>
                        </td>
                      </tr>
                      {expandedAccount === acct.accountCode && (
                        <tr key={`${acct.accountCode}-detail`} className="border-t border-[#edf0e8] bg-[#f8faf6]">
                          <td colSpan={6} className="px-5 py-3">
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
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-[#c8d4c0] bg-[#f3f6ef] font-bold">
                    <td className="px-5 py-3.5"></td>
                    <td className="px-5 py-3.5" colSpan={2}>TOTAL</td>
                    <td className="px-5 py-3.5 text-right text-[#1d4ed8]">{inr(accounts.reduce((s, a) => s + a.totalDebit, 0))}</td>
                    <td className="px-5 py-3.5 text-right text-[#dc2626]">{inr(accounts.reduce((s, a) => s + a.totalCredit, 0))}</td>
                    <td className="px-5 py-3.5 text-right">
                      {isBalanced ? (
                        <span className="text-[#15803d]">Balanced</span>
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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-semibold">Journal</h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#60735d]" />
            <input
              type="text"
              placeholder="Search ref or narration…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-[#c8d4c0] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#16a34a]"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-[#c8d4c0] px-3 py-2 text-sm outline-none focus:border-[#16a34a]"
          />
          <span className="text-sm text-[#60735d]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-[#c8d4c0] px-3 py-2 text-sm outline-none focus:border-[#16a34a]"
          />
          <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
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
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const TabIcon = ACCT_TAB_ICONS[t];
          return (
            <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === t ? "bg-[var(--ink)] text-white shadow-sm" : "border border-[var(--border)] bg-[var(--card)] text-[var(--ink-2)] hover:bg-[var(--muted)]"}`}>
              <TabIcon size={14} />{t}
            </button>
          );
        })}
      </div>
      {tab === "Invoices" && <InvoicesTab />}
      {tab === "Receipts" && <ReceiptsTab preset={receiptPreset} onPresetConsumed={() => setReceiptPreset(null)} />}
      {tab === "Payments" && <PaymentsTab />}
      {tab === "Trial Balance" && <TrialBalanceTab />}
      {tab === "Journal" && <JournalTab />}
    </div>
  );
}
