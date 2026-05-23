"use client";

import { useState } from "react";
import { INVOICES, VOUCHERS, LEDGER_SARVANI, PARTIES } from "../../../lib/data/seed";

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

function InvoicesTab() {
  const [showForm, setShowForm] = useState(false);
  const totalDue = INVOICES.filter((i) => i.status !== "Paid" && i.status !== "Cancelled").reduce((s, i) => s + i.amountDue, 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Total outstanding</p>
          <p className="mt-2 text-3xl font-black">{inr(totalDue)}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Draft invoices</p>
          <p className="mt-2 text-3xl font-black text-[#d97706]">{INVOICES.filter((i) => i.status === "Draft").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Approved (not yet paid)</p>
          <p className="mt-2 text-3xl font-black text-[#1d4ed8]">{INVOICES.filter((i) => i.status === "Approved" || i.status === "Sent").length}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Settled this month</p>
          <p className="mt-2 text-3xl font-black text-[#15803d]">{INVOICES.filter((i) => i.status === "Paid").length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">Invoice register</h3>
        <div className="flex gap-2">
          <button className="rounded-md border border-[#9baa91] px-3.5 py-2 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
          <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#172018] px-4 py-2 text-sm font-black text-white hover:bg-[#2a3b29]">
            + Generate Invoice
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[#d8decf] bg-white p-6">
          <h3 className="mb-4 text-xl font-black">Generate GST invoice</h3>
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Customer", "Sarvani Biofuels Pvt Ltd"],
                ["Business model", "A / B / C"],
                ["Material", "Maize"],
                ["Invoice date", "2026-05-12"],
                ["Quantity (MT)", "486.72"],
                ["Gross sale rate (₹/MT)", "22,500"],
              ].map(([label, placeholder]) => (
                <label key={label} className="grid gap-1.5 text-sm font-bold">
                  {label}
                  <input type="text" placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
                </label>
              ))}
              <label className="grid gap-1.5 text-sm font-bold sm:col-span-2">
                Link inward lots (comma-separated refs)
                <input type="text" placeholder="DR-12MAY-001, DR-12MAY-002, DR-12MAY-004…" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
              </label>
            </div>
            {/* Preview */}
            <div className="rounded-xl border border-[#d8decf] bg-[#f8faf5] p-5">
              <p className="mb-3 text-sm font-black">Invoice preview</p>
              {[
                ["Invoice no", "AAS-2627-0125 (next)"],
                ["Party", "Sarvani Biofuels Pvt Ltd"],
                ["Material", "Maize · 486.72 MT"],
                ["Gross value", "₹1,09,51,200"],
                ["GST (0%)", "₹0"],
                ["Total value", "₹1,09,51,200"],
                ["Ledger entry", "Dr. Sarvani · Cr. Sales + GST"],
                ["Linked lots", "4 lots from PDF batch"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-[#e8ede3] py-2 last:border-0 text-sm">
                  <span className="text-[#60735d]">{k}</span>
                  <span className="font-bold text-right text-xs">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowForm(false)} className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Save Draft</button>
            <button onClick={() => setShowForm(false)} className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Invoice no", "Model", "Date", "Due date", "Party", "Material", "Qty (MT)", "Value", "Paid", "Due", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((inv) => (
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
                      {inv.status === "Draft" && <button className="text-xs font-black text-[#15803d] hover:underline">Approve</button>}
                      <button className="text-xs font-black text-[#1d4ed8] hover:underline">PDF</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReceiptsTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Post customer receipt</h3>
        <p className="mb-5 text-sm text-[#60735d]">
          Recording a receipt posts: Dr. Bank / Cr. Customer Receivable. For Model B, also prompts recovery journal against Finance Advance Control account.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Customer", "Sarvani Biofuels Pvt Ltd"],
            ["Receipt date", "2026-05-10"],
            ["Amount received (₹)", "1,15,29,000"],
            ["Bank account (received into)", "HDFC Current — XXXX4321"],
            ["UTR / reference no", "RTGS/20260510/0012345"],
            ["Payment mode", "RTGS / NEFT / Cheque"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type="text" placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Against invoice(s)
            <input type="text" placeholder="AAS-2627-0118 — auto-allocates to oldest outstanding invoices" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Narration
            <textarea className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Receipt against Sarvani invoice — May 2026 Batch 1" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Post Receipt</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>

      {/* Receipt vouchers */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Receipt voucher register</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Voucher no", "Date", "Party", "Amount", "Mode", "Bank ref", "Narration", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VOUCHERS.filter((v) => v.voucherType === "Receipt").map((v) => (
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
    </div>
  );
}

function PaymentsTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Post supplier / farmer payment</h3>
        <p className="mb-5 text-sm text-[#60735d]">
          Accounting entry: Dr. Supplier/Farmer Payable / Cr. Bank. For Model B farmer payments, Dr. Finance Advance Control / Cr. Bank.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Payee", "Mallikarjuna Traders / Ravi Kumar"],
            ["Payment date", "2026-05-11"],
            ["Amount (₹)", "8,25,400"],
            ["Bank account (paying from)", "HDFC Current — XXXX4321"],
            ["Payment mode", "NEFT / RTGS / UPI"],
            ["UTR / reference", "NEFT/20260511/0008876"],
            ["Against bill / reference", "Supplier settlement May batch 1–8"],
            ["Approver", "Manager"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type="text" placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Post Payment</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Payment voucher register</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Voucher no", "Date", "Payee", "Amount", "Mode", "Bank ref", "Narration", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VOUCHERS.filter((v) => v.voucherType === "Payment").map((v) => (
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
    </div>
  );
}

function LedgersTab() {
  const [selectedParty, setSelectedParty] = useState<string>("pty-001");
  const partyLedger = LEDGER_SARVANI;
  const closingBalance = partyLedger.length > 0 ? partyLedger[partyLedger.length - 1].runningBalance : 0;

  const ledgerParties = [
    { id: "pty-001", name: "Sarvani Biofuels Pvt Ltd", balance: 10951200, type: "Customer", ageing: "21 days" },
    { id: "pty-002", name: "Mallikarjuna Traders", balance: -825400, type: "Supplier", ageing: "Due this week" },
    { id: "pty-007", name: "Sri Lakshmi Feeds", balance: 312300, type: "Trader", ageing: "5 days" },
    { id: "pty-009", name: "Farmer Finance Pool (Model B)", balance: -490829, type: "Control A/c", ageing: "Exposure" },
  ];

  return (
    <div className="grid gap-6">
      {/* Party ledger summary */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Party ledger summary</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Share statements</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Party", "Type", "Balance", "Ageing", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgerParties.map((p) => (
                <tr key={p.id} className={`cursor-pointer border-t border-[#edf0e8] hover:bg-[#fafcf8] ${selectedParty === p.id ? "bg-[#f0fdf4]" : ""}`}
                  onClick={() => setSelectedParty(p.id)}>
                  <td className="px-5 py-3.5 font-black">{p.name}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{p.type}</td>
                  <td className={`px-5 py-3.5 font-black ${p.balance > 0 ? "text-[#1d4ed8]" : "text-[#dc2626]"}`}>
                    {p.balance > 0 ? `${inr(p.balance)} Dr` : `${inr(Math.abs(p.balance))} Cr`}
                  </td>
                  <td className="px-5 py-3.5 text-[#536251]">{p.ageing}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button className="text-xs font-black text-[#172018] hover:underline">View</button>
                      <button className="text-xs font-black text-[#1d4ed8] hover:underline">Share</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger drill-down */}
      {selectedParty === "pty-001" && (
        <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
            <div>
              <h3 className="text-lg font-black">Sarvani Biofuels Pvt Ltd — Ledger</h3>
              <p className="mt-0.5 text-sm text-[#60735d]">Account 1201 · Closing balance: {inr(closingBalance)} Dr</p>
            </div>
            <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">
              Share statement
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
                <tr>
                  {["Date", "Narration", "Source", "Debit", "Credit", "Balance"].map((h) => (
                    <th key={h} className="px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partyLedger.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 text-[#536251] whitespace-nowrap">{entry.entryDate}</td>
                    <td className="px-5 py-3.5 max-w-[280px] truncate text-[#172018]">{entry.narration}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#1d4ed8]">{entry.sourceRef}</td>
                    <td className="px-5 py-3.5 font-bold text-[#1d4ed8]">
                      {entry.debit > 0 ? inr(entry.debit) : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#dc2626]">
                      {entry.credit > 0 ? inr(entry.credit) : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-black">
                      {inr(Math.abs(entry.runningBalance))} {entry.runningBalance >= 0 ? "Dr" : "Cr"}
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
