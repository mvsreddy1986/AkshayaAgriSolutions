"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X, Edit3 } from "lucide-react";
import type { InwardLot, Material } from "../lib/types";

interface Props {
  lots: InwardLot[];
  materials: Material[];
  defaultInvoiceNo?: string;
  onClose: () => void;
}

// ── Company constants ──────────────────────────────────────────────────────────
const CO = {
  name: "Akshaya Agri Solutions",
  tagline: "Agri Commodities. Seamless Supply. Global Reach.",
  addr: "D. No 34-76, Srinagar Colony, Addanki,\nPrakasam Dt, Andhra Pradesh 523201",
  phone: "9029376519",
  email: "akshayaagrisolutions@gmail.com",
  gstin: "37DZWPS2859P1ZU",
  pan: "DZWPS2859P",
  accName: "Akshaya Agri Solutions",
  accNo: "758405002779",
  ifsc: "ICIC0007584",
  bank: "ICICI (Addanki)",
} as const;

const BILL_TO = {
  name: "Sarvani Biofuels Private Limited",
  addr: "6th floor, Unit No - S1, NSR Mayuri tech park,\nBeside Janasena Party Office, Mangalagiri,\nGuntur, Andhra Pradesh 522503",
  gstin: "37ABJCS8911M1ZN",
} as const;

const SHIP_TO = {
  name: "Sarvani Biofuels Private Limited",
  addr: "Sy No: 83, Thammavaram (V),\nKorisapadu(M), Prakasam (Dt),\nAndhra Pradesh - 523212",
  gstin: "37ABJCS8911M1ZN",
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getFYCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() + 1 >= 4 ? y : y - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function numberToWords(n: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function words(num: number): string {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "") + " ";
    if (num < 1_000) return ones[Math.floor(num / 100)] + " Hundred " + words(num % 100);
    if (num < 1_00_000) return words(Math.floor(num / 1_000)) + "Thousand " + words(num % 1_000);
    if (num < 1_00_00_000) return words(Math.floor(num / 1_00_000)) + "Lakh " + words(num % 1_00_000);
    return words(Math.floor(num / 1_00_00_000)) + "Crore " + words(num % 1_00_00_000);
  }

  const rupees = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - rupees) * 100);
  let result = "Rupees " + words(rupees).trim();
  if (paise > 0) result += " and " + words(paise).trim() + " Paise";
  return result + " Only";
}

const fmt2 = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt3 = (n: number) => n.toFixed(3);
const inrFmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Component ──────────────────────────────────────────────────────────────────

export default function TaxInvoiceDialog({ lots, materials, defaultInvoiceNo, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const fyCode = getFYCode();
  const [invoiceNo, setInvoiceNo] = useState(defaultInvoiceNo ?? `AAS-${fyCode}-`);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [paymentDays, setPaymentDays] = useState("7");
  const [placeOfSupply, setPlaceOfSupply] = useState("Andhra Pradesh(37)");
  const [editOpen, setEditOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(
    lots.length > 0 && lots[0].invoiceId ? lots[0].invoiceId : null,
  );
  const [saveError, setSaveError] = useState("");
  useEffect(() => { setMounted(true); }, []);

  // Auto-fill invoice number from server unless caller provided one
  useEffect(() => {
    if (defaultInvoiceNo) return;
    fetch(`/api/invoices/next-no?fy=${fyCode}`)
      .then((r) => r.json())
      .then((d) => { if (d.invoiceNo) setInvoiceNo(d.invoiceNo); })
      .catch(() => {});
  // fyCode and defaultInvoiceNo are stable for the lifetime of this dialog
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dueDate = useMemo(
    () => addDays(invoiceDate, parseInt(paymentDays) || 7),
    [invoiceDate, paymentDays],
  );

  const sorted = useMemo(
    () => [...lots].sort((a, b) => a.lotDate.localeCompare(b.lotDate)),
    [lots],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { material: string; hsn: string; gstRate: number; lots: InwardLot[] }>();
    for (const lot of sorted) {
      const mat = materials.find((m) => m.id === lot.materialId);
      const entry = map.get(lot.materialId) ?? {
        material: lot.materialName,
        hsn: mat?.hsn ?? "",
        gstRate: mat?.gstRate ?? 0,
        lots: [],
      };
      entry.lots.push(lot);
      map.set(lot.materialId, entry);
    }
    return Array.from(map.values());
  }, [sorted, materials]);

  function lotAmt(l: InwardLot): number {
    return l.netWeight * l.grossSaleRate; // customer invoice: gross notional (quality deductions are supplier-side)
  }
  function lotQty(l: InwardLot): number {
    return l.netWeight; // customer invoice: gross qty delivered, not post-deduction payable weight
  }

  const totalQty = sorted.reduce((s, l) => s + lotQty(l), 0);
  const subtotal = sorted.reduce((s, l) => s + lotAmt(l), 0);
  // Agri commodities (Maize, biomass) are 0% GST in India
  const gstAmount = sorted.reduce((s, l) => {
    const mat = materials.find((m) => m.id === l.materialId);
    const rate = mat?.gstRate ?? 0;
    return s + (lotAmt(l) * rate) / 100;
  }, 0);
  const netPayable = subtotal + gstAmount;
  const showMultiMat = groups.length > 1;

  // ── Save to Accounts ───────────────────────────────────────────────────────
  async function handleSaveToAccounts() {
    // Guard: all lots must not already be invoiced
    const alreadyInvoiced = lots.filter((l) => l.invoiceId);
    if (alreadyInvoiced.length > 0) {
      setSaveError(`${alreadyInvoiced.length} lot(s) already recorded in accounts. Cannot re-invoice.`);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const primaryLot = sorted.reduce((a, b) => lotQty(a) >= lotQty(b) ? a : b);
      const allSameRate = sorted.every((l) => l.grossSaleRate === primaryLot.grossSaleRate);
      const grossAmt = r2(subtotal);
      const taxAmt   = r2(gstAmount);
      const totalAmt = r2(netPayable);
      const challans = lots.map((l) => l.documentRef).join(", ");

      // ── 1. Create Invoice record (amountDue = gross; settlement will reduce via CN)
      const invBody = {
        invoiceNo,
        invoiceType: "Sales",
        businessModel: "A",
        invoiceDate,
        dueDate,
        partyId: lots[0].customerId,
        partyName: lots[0].customerName,
        materialId: primaryLot.materialId,
        materialName: showMultiMat ? groups.map((g) => g.material).join(", ") : primaryLot.materialName,
        quantity: Math.round(totalQty * 1000) / 1000,
        uom: "MT",
        grossRate: allSameRate ? primaryLot.grossSaleRate : 0,
        grossValue: grossAmt,
        taxableValue: grossAmt,
        cgstRate: 0, sgstRate: 0, igstRate: 0,
        cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
        totalTax: taxAmt,
        totalValue: totalAmt,
        amountPaid: 0,
        amountDue: totalAmt,
        linkedLotIds: lots.map((l) => l.id),
        status: "Approved",
        cancelledReason: null,
      };

      const invRes = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invBody),
      });
      if (!invRes.ok) {
        const err = await invRes.json();
        setSaveError(err.error ?? "Failed to save invoice");
        return;
      }
      const savedInv = await invRes.json();
      setSavedInvoiceId(savedInv.id);

      // ── 2. Post ledger entries: Dr 1201 Sarvani AR (gross) / Cr 3100 Sales (gross)
      const narration = `${invoiceNo} | Challans: ${challans} | ${lots[0].customerName}`;
      const ledgerRes = await fetch("/api/ledger/invoice-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: savedInv.id,
          invoiceNo,
          grossAmount: grossAmt,
          partyId: lots[0].customerId,
          partyName: lots[0].customerName,
          entryDate: invoiceDate,
          narration,
        }),
      });
      if (!ledgerRes.ok) {
        // Non-fatal: invoice record is saved; log the ledger failure
        console.error("[TaxInvoice] ledger entry failed:", await ledgerRes.text());
      }

      // ── 3. Link each lot → invoiceId. Do NOT change status here.
      // Status stays "Mapped" or "Approved" so quality readings and settlement
      // can still proceed. Settlement will set status to "Invoiced" once done.
      // Exception: lots already "Settled" (invoice generated after settlement)
      // get promoted to "Invoiced" immediately.
      await Promise.all(
        lots.map((l) => {
          const patch: Record<string, string> = { invoiceId: savedInv.id };
          if (l.status === "Settled") patch.status = "Invoiced";
          return fetch(`/api/lots/${l.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
        }),
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Print ──────────────────────────────────────────────────────────────────
  function handlePrint() {
    let sno = 1;

    const rowsHtml = sorted
      .map((lot) => {
        const mat = materials.find((m) => m.id === lot.materialId);
        const qty = lotQty(lot);
        const amt = lotAmt(lot);
        const hsn = mat?.hsn ?? "";
        const gst = mat?.gstRate ?? 0;
        return `<tr>
          <td class="center">${sno++}</td>
          <td><span class="mono">${lot.documentRef}</span><br><span class="sub">${lot.vehicleNo ?? ""}</span></td>
          <td class="center">${lot.lotDate}</td>
          <td>${lot.materialName}</td>
          <td class="center">${hsn}</td>
          <td class="right">${fmt3(qty)}</td>
          <td class="right">${lot.grossSaleRate > 0 ? "₹" + lot.grossSaleRate.toLocaleString("en-IN") : "—"}</td>
          <td class="center">${gst > 0 ? gst + "%" : "Exempt"}</td>
          <td class="right bold">${amt > 0 ? "₹" + fmt2(amt) : "—"}</td>
        </tr>`;
      })
      .join("");

    const subtotalsHtml = showMultiMat
      ? groups
          .map((g) => {
            const subAmt = g.lots.reduce((s, l) => s + lotAmt(l), 0);
            const subQty = g.lots.reduce((s, l) => s + lotQty(l), 0);
            return `<tr class="subtot">
              <td colspan="5" class="right">Subtotal — ${g.material}</td>
              <td class="right">${fmt3(subQty)} MT</td>
              <td colspan="2"></td>
              <td class="right bold">₹${fmt2(subAmt)}</td>
            </tr>`;
          })
          .join("")
      : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Tax Invoice — ${invoiceNo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:16px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1e3a8a;padding-bottom:12px;margin-bottom:10px}
.co-name{font-size:19px;font-weight:900;color:#1e3a8a}
.co-tag{font-size:8.5px;color:#6b7280;font-style:italic;margin-top:1px}
.co-addr{font-size:9px;color:#374151;margin-top:5px;line-height:1.6;white-space:pre-line}
.co-gst{font-size:9px;color:#374151;margin-top:3px}
.inv-title{font-size:22px;font-weight:900;color:#1e3a8a;text-align:right}
.inv-sub{font-size:9px;color:#6b7280;text-align:right;margin-top:1px}
.meta{display:grid;grid-template-columns:auto auto;gap:1px 14px;margin-top:8px;text-align:left}
.ml{font-size:9px;color:#6b7280;white-space:nowrap}
.mv{font-size:9.5px;font-weight:700;color:#111;text-align:right}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.pbox{border:1px solid #d1d5db;border-radius:4px;overflow:hidden}
.phdr{background:#1e3a8a;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px}
.pbody{padding:7px 8px}
.pname{font-size:11.5px;font-weight:700}
.paddr{font-size:9px;color:#374151;margin-top:2px;line-height:1.55;white-space:pre-line}
.pgst{font-size:9px;font-weight:700;color:#374151;margin-top:3px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#1e3a8a;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:6px 6px;border:1px solid #1e3a8a}
td{padding:5px 6px;border:1px solid #d1d5db;font-size:10px;vertical-align:middle}
.center{text-align:center}.right{text-align:right}.bold{font-weight:700}
.mono{font-family:'Courier New',monospace;font-size:9px}
.sub{font-size:8.5px;color:#6b7280}
tr:nth-child(even) td{background:#f9fafb}
.subtot td{background:#eff6ff!important;font-weight:600;border-top:1.5px solid #93c5fd}
tfoot td{border-top:2px solid #1e3a8a;background:#f8faf5;font-weight:700}
.sumwrap{display:flex;justify-content:flex-end}
.sumtbl{width:310px;border:1px solid #d1d5db;border-radius:4px;overflow:hidden;margin-bottom:8px}
.sumtbl td{border:none;border-bottom:1px solid #e5e7eb;padding:4px 10px;font-size:10px}
.sumtbl tr:last-child td{border-bottom:none}
.sl{color:#6b7280}.sv{text-align:right;font-weight:600}
.tot-row td{background:#1e3a8a;color:#fff;font-weight:700;font-size:11px}
.words{border:1px solid #d1d5db;border-radius:4px;padding:6px 10px;margin:0 0 8px}
.wl{font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.bkbox{border:1px solid #d1d5db;border-radius:4px;overflow:hidden}
.bkhdr{background:#1e3a8a;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px}
.bkbdy{padding:7px 8px;font-size:10px;line-height:1.75}
.bkl{color:#6b7280;font-size:9px}
.signbox{border:1px solid #d1d5db;border-radius:4px;padding:8px;text-align:right;display:flex;flex-direction:column;justify-content:space-between}
.sf{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#374151}
.sco{font-size:12px;font-weight:900;color:#1e3a8a;margin-top:2px}
.sarea{height:44px;border-bottom:1px solid #d1d5db;margin:8px 0}
.sauth{font-size:9px;color:#6b7280}
.thanks{text-align:center;border-top:2px solid #1e3a8a;margin-top:10px;padding-top:7px}
.tby{font-size:12px;font-weight:900;font-style:italic;color:#1e3a8a}
.tct{font-size:9px;color:#6b7280;margin-top:2px}
@media print{@page{size:A4;margin:1cm}body{padding:0}}
</style></head><body>
<!-- Header -->
<div class="hdr">
  <div>
    <div class="co-name">Akshaya Agri Solutions</div>
    <div class="co-tag">${CO.tagline}</div>
    <div class="co-addr">${CO.addr}\nPhone: ${CO.phone} &nbsp;|&nbsp; ${CO.email}</div>
    <div class="co-gst">GSTIN: ${CO.gstin} &nbsp;|&nbsp; PAN: ${CO.pan}</div>
  </div>
  <div>
    <div class="inv-title">Tax Invoice</div>
    <div class="inv-sub">Original for recipient</div>
    <div class="meta">
      <span class="ml">Date</span><span class="mv">${invoiceDate}</span>
      <span class="ml">Invoice #</span><span class="mv">${invoiceNo}</span>
      <span class="ml">Payment Terms</span><span class="mv">${paymentDays} Days</span>
      <span class="ml">Due Date</span><span class="mv">${dueDate}</span>
      <span class="ml">Place of Supply</span><span class="mv">${placeOfSupply}</span>
      <span class="ml">Challans</span><span class="mv">${sorted.length}</span>
    </div>
  </div>
</div>
<!-- Addresses -->
<div class="parties">
  <div class="pbox">
    <div class="phdr">Bill to Party Address</div>
    <div class="pbody">
      <div class="pname">${BILL_TO.name}</div>
      <div class="paddr">${BILL_TO.addr}</div>
      <div class="pgst">GSTIN: ${BILL_TO.gstin}</div>
    </div>
  </div>
  <div class="pbox">
    <div class="phdr">Ship to Party Address</div>
    <div class="pbody">
      <div class="pname">${SHIP_TO.name}</div>
      <div class="paddr">${SHIP_TO.addr}</div>
      <div class="pgst">GSTIN: ${SHIP_TO.gstin}</div>
    </div>
  </div>
</div>
<!-- Line items -->
<table>
  <thead><tr>
    <th class="center" style="width:28px">No.</th>
    <th>Challan No.</th>
    <th class="center" style="width:78px">Date</th>
    <th>Item &amp; Description</th>
    <th class="center" style="width:72px">HSN</th>
    <th class="right" style="width:75px">Qty (MT)</th>
    <th class="right" style="width:90px">Rate/MT</th>
    <th class="center" style="width:52px">GST</th>
    <th class="right" style="width:100px">Amount (₹)</th>
  </tr></thead>
  <tbody>${rowsHtml}${subtotalsHtml}</tbody>
  <tfoot><tr>
    <td colspan="5" class="right">Total — ${sorted.length} challan${sorted.length !== 1 ? "s" : ""}</td>
    <td class="right">${fmt3(totalQty)} MT</td>
    <td colspan="2"></td>
    <td class="right">₹${fmt2(subtotal)}</td>
  </tr></tfoot>
</table>
<!-- Summary -->
<div class="sumwrap">
  <table class="sumtbl">
    <tr><td class="sl">Subtotal</td><td class="sv">₹${fmt2(subtotal)}</td></tr>
    <tr><td class="sl">Discount</td><td class="sv">—</td></tr>
    <tr><td class="sl">GST${gstAmount > 0 ? "" : " (Exempt)"}</td><td class="sv">${gstAmount > 0 ? "₹" + fmt2(gstAmount) : "—"}</td></tr>
    <tr><td class="sl">Roundoff</td><td class="sv">—</td></tr>
    <tr class="tot-row"><td>Net Payable</td><td class="sv">₹${fmt2(netPayable)}</td></tr>
  </table>
</div>
<!-- Amount in words -->
<div class="words">
  <div class="wl">Amount payable in words :</div>
  <div>${numberToWords(netPayable)}</div>
</div>
<!-- Footer -->
<div class="fgrid">
  <div class="bkbox">
    <div class="bkhdr">Bank Details</div>
    <div class="bkbdy">
      <span class="bkl">Account Name</span> : ${CO.accName}<br>
      <span class="bkl">Account No</span> : ${CO.accNo}<br>
      <span class="bkl">IFSC Code</span> : ${CO.ifsc}<br>
      <span class="bkl">Bank (Branch)</span> : ${CO.bank}
    </div>
  </div>
  <div class="signbox">
    <div>
      <div class="sf">For</div>
      <div class="sco">Akshaya Agri Solutions</div>
    </div>
    <div class="sarea"></div>
    <div class="sauth">Authorised Signatory</div>
  </div>
</div>
<div class="thanks">
  <div class="tby">Thank You For Your Business!</div>
  <div class="tct">If you have any questions about this invoice, please contact us on ${CO.phone} or ${CO.email}</div>
</div>
</body></html>`;

    const win = window.open("about:blank", "_blank");
    if (!win) { alert("Please allow pop-ups to print the invoice."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl max-h-[95vh] overflow-hidden">

        {/* Dialog header — sticky, never scrolls away */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#edf0e8] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#172018]">
              Tax Invoice — <span className="font-mono text-[#1e3a8a]">{invoiceNo || "Draft"}</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#60735d]">
              {lots.length} lot{lots.length !== 1 ? "s" : ""} ·{" "}
              Customer: {lots[0]?.customerName ?? BILL_TO.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen((v) => !v)}
              className={`btn ${editOpen ? "btn-primary" : "btn-ghost"} flex items-center gap-1.5 text-xs`}
            >
              <Edit3 size={13} />
              {editOpen ? "Done" : "Edit Details"}
            </button>

            {/* Save to Accounts */}
            {savedInvoiceId ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#15803d]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Saved in Accounts
              </span>
            ) : (
              <button
                onClick={handleSaveToAccounts}
                disabled={saving || !invoiceNo}
                className="btn btn-ghost flex items-center gap-1.5 text-xs border border-[#c8d4c0]"
              >
                {saving ? (
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                )}
                {saving ? "Saving…" : "Save to Accounts"}
              </button>
            )}

            <button
              onClick={handlePrint}
              className="btn btn-primary flex items-center gap-1.5"
            >
              <Printer size={14} />
              Print / PDF
            </button>
            <button onClick={onClose} className="btn btn-ghost flex items-center gap-1.5">
              <X size={14} />Close
            </button>
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="shrink-0 bg-red-50 px-6 py-2 text-xs text-red-700">{saveError}</div>
        )}

        {/* Edit panel */}
        {editOpen && (
          <div className="shrink-0 border-b border-[#edf0e8] bg-[#f6faef] px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  { label: "Invoice Number", value: invoiceNo, set: setInvoiceNo, type: "text" },
                  { label: "Invoice Date", value: invoiceDate, set: setInvoiceDate, type: "date" },
                  { label: "Payment Terms (days)", value: paymentDays, set: setPaymentDays, type: "number" },
                  { label: "Place of Supply", value: placeOfSupply, set: setPlaceOfSupply, type: "text" },
                ] as const
              ).map(({ label, value, set, type }) => (
                <div key={label} className="grid gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[#60735d]">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => (set as (v: string) => void)(e.target.value)}
                    className="rounded-lg border border-[#c8d4c0] px-3 py-1.5 text-sm focus:border-[#16a34a] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoice preview — vertical scroll only; overflow-x-hidden prevents accidental horizontal drift */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">

          {/* ── Company header ── */}
          <div className="mb-5 flex items-start justify-between border-b-2 border-[#1e3a8a] pb-4">
            <div>
              <p className="text-xl font-black text-[#1e3a8a]">Akshaya Agri Solutions</p>
              <p className="text-[10px] italic text-[#6b7280]">{CO.tagline}</p>
              <p className="mt-2 text-[11px] leading-5 text-[#374151]" style={{ whiteSpace: "pre-line" }}>
                {CO.addr}{"\n"}Phone: {CO.phone} | {CO.email}
              </p>
              <p className="mt-1 text-[11px] text-[#374151]">
                GSTIN: {CO.gstin} | PAN: {CO.pan}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-[#1e3a8a]">Tax Invoice</p>
              <p className="text-[10px] text-[#6b7280]">Original for recipient</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {(
                  [
                    ["Date", invoiceDate],
                    ["Invoice #", invoiceNo || "—"],
                    ["Payment Terms", `${paymentDays} Days`],
                    ["Due Date", dueDate],
                    ["Place of Supply", placeOfSupply],
                    ["Challans", String(lots.length)],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <span className="text-[10px] text-[#6b7280]">{k}</span>
                    <span className="text-right text-xs font-semibold text-[#172018]">{v}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* ── Party addresses ── */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {(
              [
                { title: "Bill to Party Address", ...BILL_TO },
                { title: "Ship to Party Address", ...SHIP_TO },
              ]
            ).map(({ title, name, addr, gstin }) => (
              <div key={title} className="overflow-hidden rounded-md border border-[#d1d5db]">
                <div className="bg-[#1e3a8a] px-3 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white">{title}</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-sm font-bold text-[#172018]">{name}</p>
                  <p className="mt-1 text-[10px] leading-5 text-[#374151]" style={{ whiteSpace: "pre-line" }}>{addr}</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#374151]">GSTIN: {gstin}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Line items table ── */}
          <div className="mb-4 overflow-x-auto rounded-md border border-[#d1d5db]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1e3a8a] text-white">
                  {[
                    { label: "No.", cls: "text-center w-8" },
                    { label: "Challan No.", cls: "" },
                    { label: "Date", cls: "text-center w-24" },
                    { label: "Item & Description", cls: "" },
                    { label: "HSN", cls: "text-center w-20" },
                    { label: "Qty (MT)", cls: "text-right w-20" },
                    { label: "Rate/MT", cls: "text-right w-24" },
                    { label: "GST", cls: "text-center w-14" },
                    { label: "Amount (₹)", cls: "text-right w-28" },
                  ].map(({ label, cls }) => (
                    <th key={label} className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider ${cls}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((lot, idx) => {
                  const mat = materials.find((m) => m.id === lot.materialId);
                  const qty = lotQty(lot);
                  const amt = lotAmt(lot);
                  return (
                    <tr
                      key={lot.id}
                      className={`border-t border-[#e5e7eb] ${idx % 2 === 1 ? "bg-[#f9fafb]" : ""}`}
                    >
                      <td className="px-3 py-2 text-center text-xs text-[#6b7280]">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-mono text-xs font-semibold text-[#172018]">{lot.documentRef}</p>
                        <p className="mt-0.5 text-[10px] text-[#8fa88c]">{lot.vehicleNo}</p>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-[#536251]">{lot.lotDate}</td>
                      <td className="px-3 py-2 text-xs font-medium text-[#172018]">{lot.materialName}</td>
                      <td className="px-3 py-2 text-center text-xs text-[#536251]">{mat?.hsn ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums">{fmt3(qty)}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {lot.grossSaleRate > 0
                          ? "₹" + lot.grossSaleRate.toLocaleString("en-IN")
                          : <span className="text-[#c5d0bf]">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-[#536251]">
                        {(mat?.gstRate ?? 0) > 0 ? `${mat?.gstRate}%` : "Exempt"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-[#172018]">
                        {amt > 0 ? inrFmt(amt) : <span className="text-[#c5d0bf]">—</span>}
                      </td>
                    </tr>
                  );
                })}

                {/* Material subtotals when multiple materials */}
                {showMultiMat &&
                  groups.map((g) => {
                    const subAmt = g.lots.reduce((s, l) => s + lotAmt(l), 0);
                    const subQty = g.lots.reduce((s, l) => s + lotQty(l), 0);
                    return (
                      <tr key={g.material} className="border-t border-[#93c5fd] bg-[#eff6ff]">
                        <td colSpan={5} className="px-3 py-1.5 text-right text-xs font-semibold text-[#1e3a8a]">
                          Subtotal — {g.material}
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs font-semibold">{fmt3(subQty)} MT</td>
                        <td colSpan={2} />
                        <td className="px-3 py-1.5 text-right text-xs font-bold">{inrFmt(subAmt)}</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#1e3a8a] bg-[#f8faf5]">
                  <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold text-[#172018]">
                    Total — {sorted.length} challan{sorted.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                    {fmt3(totalQty)} MT
                  </td>
                  <td colSpan={2} />
                  <td className="px-3 py-2.5 text-right text-sm font-bold text-[#1e3a8a]">
                    {inrFmt(subtotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Summary ── */}
          <div className="mb-4 flex justify-end">
            <div className="w-72 overflow-hidden rounded-md border border-[#d1d5db]">
              {(
                [
                  ["Subtotal", inrFmt(subtotal)],
                  ["Discount", "—"],
                  ["GST" + (gstAmount === 0 ? " (Exempt)" : ""), gstAmount > 0 ? inrFmt(gstAmount) : "—"],
                  ["Roundoff", "—"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-[#e5e7eb] px-4 py-1.5 text-xs">
                  <span className="text-[#6b7280]">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              <div className="flex justify-between bg-[#1e3a8a] px-4 py-2.5 text-sm font-bold text-white">
                <span>Net Payable</span>
                <span>{inrFmt(netPayable)}</span>
              </div>
            </div>
          </div>

          {/* ── Amount in words ── */}
          <div className="mb-5 rounded-md border border-[#d1d5db] px-4 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Amount payable in words :
            </p>
            <p className="mt-0.5 text-xs font-medium text-[#172018]">{numberToWords(netPayable)}</p>
          </div>

          {/* ── Footer ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-[#d1d5db]">
              <div className="bg-[#1e3a8a] px-3 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Bank Details</p>
              </div>
              <div className="space-y-0.5 px-3 py-2.5 text-xs leading-6">
                <p><span className="text-[#6b7280]">Account Name</span> : {CO.accName}</p>
                <p><span className="text-[#6b7280]">Account No</span> : {CO.accNo}</p>
                <p><span className="text-[#6b7280]">IFSC Code</span> : {CO.ifsc}</p>
                <p><span className="text-[#6b7280]">Bank (Branch)</span> : {CO.bank}</p>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-md border border-[#d1d5db] px-4 py-3 text-right">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#374151]">For</p>
                <p className="text-base font-black text-[#1e3a8a]">Akshaya Agri Solutions</p>
              </div>
              <div className="my-4 h-10 border-b border-[#d1d5db]" />
              <p className="text-[10px] text-[#6b7280]">Authorised Signatory</p>
            </div>
          </div>

          <div className="mt-5 border-t-2 border-[#1e3a8a] pt-4 text-center">
            <p className="text-sm font-black italic text-[#1e3a8a]">
              Thank You For Your Business!
            </p>
            <p className="mt-1 text-[10px] text-[#6b7280]">
              If you have any questions about this invoice, please contact us on {CO.phone} or {CO.email}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
