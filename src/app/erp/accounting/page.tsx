"use client";

import { useState, useEffect, useCallback } from "react";
import type { Invoice, Voucher, LedgerEntry, Party } from "../../../lib/types";

const TABS = ["Invoices", "Receipts", "Payments", "Ledgers"] as const;
type Tab = (typeof TABS)[number];

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
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function ModelBadge({ model }: { model: string }) {
  const map: Record<string, string> = {
    A: "bg-[#172018] text-white",
    B: "bg-[#405b3d] text-white",
    C: "bg-[#d8ff72] text-[#172018]",
  };
  return <span className={`rounded-md px-2 py-0.5 text-xs font-black ${map[model] ?? "bg-gray-100"}`}>Model {model}</span>;
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
          <p className="mt-2 text-3xl font-black">{inr(totalDue)}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Draft invoices</p>
          <p className="mt-2 text-3xl font-black text-[#d97706]">{invoices.filter((i) => i.status === "Draft").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Approved (not yet paid)</p>
          <p className="mt-2 text-3xl font-black text-[#1d4ed8]">{invoices.filter((i) => i.status === "Approved" || i.status === "Sent").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Settled this month</p>
          <p className="mt-2 text-3xl font-black text-[#15803d]">{invoices.filter((i) => i.status === "Paid").length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Invoice register</h3>
        <div className="flex gap-2">
          <button className="rounded-md border border-[#9baa91] px-3.5 py-2 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
          <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#172018] px-4 py-2 text-sm font-black text-white hover:bg-[#2a3b29]">+ Generate Invoice</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
          <h3 className="mb-4 text-xl font-black">Generate GST invoice</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-bold">
              Customer *
              <select name="partyId" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="">Select party…</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Business model
              <select name="businessModel" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="A">Model A</option><option value="B">Model B</option><option value="C">Model C</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Material *
              <input name="materialName" type="text" required placeholder="Maize" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Invoice date *
              <input name="invoiceDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Due date *
              <input name="dueDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              UOM
              <select name="uom" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
                <option value="MT">MT</option><option value="KG">KG</option><option value="L">L</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Quantity *
              <input name="quantity" type="number" step="0.01" required placeholder="486.72" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Gross sale rate (₹) *
              <input name="grossRate" type="number" required placeholder="22500" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Invoice no", "Model", "Date", "Due date", "Party", "Material", "Qty (MT)", "Value", "Paid", "Due", "Status", "Action"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-black whitespace-nowrap">{inv.invoiceNo}</td>
                    <td className="px-5 py-3.5"><ModelBadge model={inv.businessModel} /></td>
                    <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{inv.invoiceDate}</td>
                    <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{inv.dueDate}</td>
                    <td className="px-5 py-3.5 font-bold max-w-[160px] truncate">{inv.partyName}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{inv.materialName}</td>
                    <td className="px-5 py-3.5">{inv.quantity.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-bold whitespace-nowrap">{inr(inv.totalValue)}</td>
                    <td className="px-5 py-3.5 text-[#15803d] whitespace-nowrap">{inr(inv.amountPaid)}</td>
                    <td className="px-5 py-3.5 font-black whitespace-nowrap">{inr(inv.amountDue)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 whitespace-nowrap">
                        <button className="text-xs font-black text-[#172018] hover:underline">View</button>
                        {inv.status === "Draft" && (
                          <button onClick={() => approveInvoice(inv.id)} className="text-xs font-black text-[#15803d] hover:underline">Approve</button>
                        )}
                        <button className="text-xs font-black text-[#1d4ed8] hover:underline">PDF</button>
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

function ReceiptsTab() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/vouchers?type=Receipt").then((r) => r.json()),
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
    const fd = new FormData(e.currentTarget);
    const partyId = String(fd.get("partyId") ?? "");
    const party = parties.find((p) => p.id === partyId);
    const body = {
      voucherType: "Receipt",
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
    e.currentTarget.reset();
    load();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Post customer receipt</h3>
        <p className="mb-5 text-sm text-[#60735d]">Recording a receipt posts: Dr. Bank / Cr. Customer Receivable.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-bold">
            Customer *
            <select name="partyId" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
              <option value="">Select party…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Receipt date *
            <input name="voucherDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Amount received (₹) *
            <input name="amount" type="number" required placeholder="11529000" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Payment mode
            <select name="paymentMode" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
              {["RTGS", "NEFT", "IMPS", "Cheque", "Cash", "UPI"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            UTR / reference no
            <input name="bankRef" type="text" placeholder="RTGS/20260510/0012345" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Narration
            <textarea name="narration" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Receipt against invoice — May 2026 batch" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
            {saving ? "Posting…" : "Post Receipt"}
          </button>
          <button type="reset" className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </form>

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h3 className="text-lg font-black">Receipt voucher register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Voucher no", "Date", "Party", "Amount", "Mode", "Bank ref", "Narration", "Status"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-black">{v.voucherNo}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{v.voucherDate}</td>
                    <td className="px-5 py-3.5 font-bold">{v.partyName}</td>
                    <td className="px-5 py-3.5 font-black">{inr(v.amount)}</td>
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
    const fd = new FormData(e.currentTarget);
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
    e.currentTarget.reset();
    load();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Post supplier / farmer payment</h3>
        <p className="mb-5 text-sm text-[#60735d]">Accounting entry: Dr. Supplier/Farmer Payable / Cr. Bank.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-bold">
            Payee *
            <select name="partyId" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
              <option value="">Select party…</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Payment date *
            <input name="voucherDate" type="date" required className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Amount (₹) *
            <input name="amount" type="number" required placeholder="825400" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Payment mode
            <select name="paymentMode" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
              {["NEFT", "RTGS", "IMPS", "Cheque", "Cash", "UPI"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            UTR / reference
            <input name="bankRef" type="text" placeholder="NEFT/20260511/0008876" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Narration
            <textarea name="narration" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Supplier settlement — May 2026" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={saving} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
            {saving ? "Posting…" : "Post Payment"}
          </button>
          <button type="reset" className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </form>

      {loading ? <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p> : (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h3 className="text-lg font-black">Payment voucher register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Voucher no", "Date", "Payee", "Amount", "Mode", "Bank ref", "Narration", "Status"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-black">{v.voucherNo}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{v.voucherDate}</td>
                    <td className="px-5 py-3.5 font-bold">{v.partyName}</td>
                    <td className="px-5 py-3.5 font-black">{inr(v.amount)}</td>
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

// ─── LEDGERS ──────────────────────────────────────────────────────────────────

function LedgersTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("pty-001");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/ledger?partyId=${selectedPartyId}`).then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
    ]).then(([les, pts]) => {
      setEntries(Array.isArray(les) ? les : []);
      setParties(Array.isArray(pts) ? pts : []);
    }).finally(() => setLoading(false));
  }, [selectedPartyId]);

  useEffect(() => { load(); }, [load]);

  const closingBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;
  const selectedParty = parties.find((p) => p.id === selectedPartyId);

  return (
    <div className="grid gap-6">
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Party ledger summary</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Share statements</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>{["Party", "Type", "Action"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id} className={`cursor-pointer border-t border-[#edf0e8] hover:bg-[#fafcf8] ${selectedPartyId === p.id ? "bg-[#f0fdf4]" : ""}`}
                  onClick={() => setSelectedPartyId(p.id)}>
                  <td className="px-5 py-3.5 font-black">{p.name}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{p.partyType}</td>
                  <td className="px-5 py-3.5">
                    <button className="text-xs font-black text-[#172018] hover:underline">View ledger</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <div>
            <h3 className="text-lg font-black">{selectedParty?.name ?? "Select a party"} — Ledger</h3>
            {entries.length > 0 && (
              <p className="mt-0.5 text-sm text-[#60735d]">Closing balance: {inr(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}</p>
            )}
          </div>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Share statement</button>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-[#60735d]">Loading…</p> : entries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#60735d]">No ledger entries for this party.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>{["Date", "Narration", "Source", "Debit", "Credit", "Balance"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{entry.entryDate}</td>
                    <td className="px-5 py-3.5 max-w-[280px] truncate text-[#172018]">{entry.narration}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#1d4ed8]">{entry.sourceRef}</td>
                    <td className="px-5 py-3.5 font-bold text-[#1d4ed8]">{entry.debit > 0 ? inr(entry.debit) : "—"}</td>
                    <td className="px-5 py-3.5 font-bold text-[#dc2626]">{entry.credit > 0 ? inr(entry.credit) : "—"}</td>
                    <td className="px-5 py-3.5 font-black">{inr(Math.abs(entry.runningBalance))} {entry.runningBalance >= 0 ? "Dr" : "Cr"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>("Invoices");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>{t}</button>
        ))}
      </div>
      {tab === "Invoices" && <InvoicesTab />}
      {tab === "Receipts" && <ReceiptsTab />}
      {tab === "Payments" && <PaymentsTab />}
      {tab === "Ledgers" && <LedgersTab />}
    </div>
  );
}
