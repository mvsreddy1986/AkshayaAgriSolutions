# Akshaya Agri Solutions ERP — Product Requirements Document

**Version:** 1.0  **Date:** May 2026  **Status:** Approved for Scaffold

---

## 1. Executive Summary

Akshaya Agri Solutions is a GST-registered agriculture commodity trading and settlement firm based in India. The business operates three distinct trading models — supplier aggregation (Model A), farmer financing (Model B), and buy-resell (Model C) — primarily involving Sarvani Biofuels Pvt Ltd as the anchor customer/supplier.

This ERP replaces manual Excel/PDF workflows with a unified web platform covering procurement, quality-based settlement, GST invoicing, ledger management, farmer payouts, and MIS reporting.

---

## 2. Business Context

**Company:** Akshaya Agri Solutions  
**GST Status:** Registered  
**Principal counterparty:** Sarvani Biofuels Pvt Ltd (customer in A/B, supplier in C)  
**Primary material:** Maize (corn) — ~80% of turnover  
**Secondary materials:** Paddy Husk, Coal, Biomass, DDGS, WDG, CO2, Corn Oil

**Pain points today:**
- Daily supply PDFs are processed manually and prone to keying errors
- Farmer payout tracking is in spreadsheets with no audit trail
- Invoice-to-receipt matching is manual
- Quality deductions are recalculated every time rates change
- No real-time visibility into receivables, payables, or finance exposure

---

## 3. User Roles & Permissions

| Capability | Admin | Manager | Clerk |
|---|---|---|---|
| Create/edit master data | ✓ | ✓ | Read-only |
| Upload PDF / Excel imports | ✓ | ✓ | ✓ |
| Create draft transactions | ✓ | ✓ | ✓ |
| Post/approve transactions | ✓ | ✓ | ✗ |
| Generate invoices (draft) | ✓ | ✓ | ✓ |
| Approve & release invoices | ✓ | ✓ | ✗ |
| Record payments/receipts | ✓ | ✓ | ✗ |
| View ledgers & reports | ✓ | ✓ | Limited |
| Manage users & roles | ✓ | ✗ | ✗ |
| Configure GST settings | ✓ | ✗ | ✗ |
| Edit quality rules | ✓ | Propose | ✗ |
| View audit logs | ✓ | ✓ | ✗ |
| Delete records | ✓ | ✗ | ✗ |
| Override quality deductions | ✓ | Require reason | ✗ |

---

## 4. Business Models

### Model A — Supplier Aggregation (Farmer Supply via Akshaya)

**Flow:**
1. Local suppliers (aggregators/agents) arrange trucks from nearby farmers to deliver maize to Sarvani's factory.
2. Sarvani generates a daily delivery report (PDF) listing vehicle number, material, gross/tare/accepted weight, moisture, and foreign matter.
3. Akshaya uploads the PDF. The system creates **draft inward lots**.
4. Clerk maps each lot to: supplier name, farmer name (beneficiary), quality parameters, and settlement rate.
5. Manager reviews and approves quality deductions. System calculates net payable weight.
6. Akshaya raises **bulk sales invoices** to Sarvani (material-wise, date-wise).
7. When Sarvani pays, receipt is recorded → customer ledger updated.
8. Akshaya pays suppliers. Supplier ledger updated.
9. For farmer audit: **farmer payout references** are generated (not main-ledger entries) showing which farmer received which amount.

**Accounting entries:**
- Invoice: Dr. Sarvani (Customer) / Cr. Sales + GST Payable
- Receipt: Dr. Bank / Cr. Sarvani (Customer)
- Supplier payment: Dr. Supplier Payable / Cr. Bank
- Farmer payout reference: Off-ledger audit record

### Model B — Farmer Financing (Akshaya Finances Farmers Directly)

**Flow:**
1. Farmers send maize directly to Sarvani.
2. Akshaya receives farmer data as an **Excel sheet** (farmer name, vehicle, weight, rate, bank details).
3. System creates inward lot records linked to Sarvani as customer.
4. Akshaya **pays farmers upfront** (finance exposure).
5. Akshaya raises bulk invoices to Sarvani.
6. When Sarvani pays, the financing exposure is recovered.

**Key accounting distinction from Model A:**
- A separate **Farmer Finance Control Account** (asset — advance) tracks all farmer payments.
- Sarvani remains the sole customer ledger.
- Farmers are **reference/beneficiary records**, not ledger accounts.
- Recovery from Sarvani reduces the Finance Control Account balance.

**Accounting entries:**
- Farmer payment: Dr. Farmer Finance Advance Control / Cr. Bank
- Invoice to Sarvani: Dr. Sarvani (Customer) / Cr. Sales + GST Payable
- Sarvani receipt: Dr. Bank / Cr. Sarvani (Customer)
- Recovery: Dr. Bank / Cr. Farmer Finance Advance Control (auto-matched)

### Model C — Buy from Factory, Sell to Traders

**Flow:**
1. Akshaya purchases DDGS, WDG, CO2, Corn Oil from Sarvani in bulk.
2. Stock is maintained batch-wise.
3. Akshaya sells to local traders in smaller lots with retail markup.
4. Trader invoices, receipts, and stock consumption are tracked.

**Accounting entries:**
- Purchase: Dr. Inventory (Batch) / Cr. Sarvani (Payable)
- Sale: Dr. Trader (Customer) / Cr. Sales + GST Payable + Dr. COGS / Cr. Inventory
- Trader receipt: Dr. Bank / Cr. Trader (Customer)
- Sarvani payment: Dr. Sarvani (Payable) / Cr. Bank

---

## 5. Module Breakdown

### 5.1 Command Center (Dashboard)
Real-time KPI cards, pending tasks, approval queue, today's supply summary, live market reference rate.

### 5.2 Master Data
- **Material master:** Name, HSN, UOM, GST rate, default rate, quality params, status
- **Party master:** Customers, suppliers, farmers, traders with GSTIN, bank details, credit limits
- **Quality rule master:** Material-specific, date-valid deduction rules (versioned)
- **Rate master:** Customer/material/date-wise gross sale rates and purchase rates

### 5.3 Procurement (Models A & B)
- PDF import (Model A daily report)
- Excel import (Model B farmer sheet)
- Inward lot register
- Supplier/farmer mapping
- Settlement calculation (quality deductions)
- Settlement approval workflow

### 5.4 Finance Flow (Model B specific)
- Farmer finance exposure account
- Farmer bill references
- Recovery tracking
- Exposure reconciliation against Sarvani receivables

### 5.5 Sales & Inventory (Model C)
- Sarvani purchase entry
- Batch stock register
- Trader sales invoices
- Dispatch register
- Margin tracking per batch

### 5.6 Accounting
- GST invoice generation (sales and purchase)
- Bulk invoice creation from approved lots
- Receipt vouchers (customer payments in)
- Payment vouchers (supplier/farmer payments out)
- Debit notes / credit notes
- Party ledger with drill-down
- Day book / bank book

### 5.7 Document Hub
- PDF/Excel upload and parse
- Document-to-lot matching status
- Invoice/payment proof archive
- Template management (invoice, ledger statement, farmer bill)

### 5.8 Reports & KPIs
Daily supply MIS, customer ageing, supplier ageing, quality deduction summary, material margin, GST registers, finance exposure, audit pack generator.

### 5.9 Administration
User management, approval matrix, GST/company setup, audit log.

---

## 6. Quality Management Design

Quality rules are **versioned with date validity** so historical transactions are never recalculated with new rules.

Each `QualityRule` record has:
- `materialId` — which material it applies to
- `validFrom` / `validTo` — effective window
- `baseMoisture` — benchmark moisture percentage
- `moistureDeductionMethod` — linear / slab / none
- `fmDeductionMethod` — actual / slab / none
- `cessRate` — percentage of net value
- `allowedVariancePercent` — threshold before manager approval required

When an inward lot is created:
1. System looks up the active QualityRule for `(materialId, lotDate)`.
2. Applies deduction formulas to calculate: `moistureDeduction`, `fmDeduction`, `cessAmount`.
3. Derived: `netPayableWeight = grossWeight - moistureDeduction - fmDeduction`.
4. Flags the lot if variance exceeds allowed threshold.

Rule changes take effect only for new lots dated after `validFrom`. Old lots retain their original rule reference.

---

## 7. Invoice Numbering

Format: `AAS-YYZZ-NNNN`
- `AAS` — company prefix
- `YY` — last two digits of financial year start (e.g., 26 for FY 2026-27)
- `ZZ` — last two digits of financial year end (e.g., 27)
- `NNNN` — sequential number reset every financial year

Examples: `AAS-2627-0001`, `AAS-2627-0122`

---

## 8. Compliance & Audit Requirements

- All transaction edits are logged with old value, new value, user, timestamp.
- Invoices once approved cannot be deleted — only cancelled with a credit note.
- Quality rule overrides require a manager/admin reason and are logged.
- Farmer payout references must be linked to inward lots for audit.
- GST invoice fields: GSTIN (both parties), HSN, quantity, rate, CGST/SGST/IGST, total.
- Document attachments (PDF/Excel source files) linked to every import batch.

---

## 9. Integration Points (Phase 3)

| Integration | Purpose | Technology |
|---|---|---|
| PDF parser | Extract daily delivery report | PDF.co API or pdfplumber |
| Excel parser | Parse farmer data sheets | SheetJS (xlsx) |
| Invoice PDF render | Generate printable GST invoices | react-pdf or Puppeteer |
| WhatsApp/Email | Share ledger statements | Twilio / SendGrid |
| Market rates | Live corn price reference | Yahoo Finance API (existing) |
| Bank reconciliation | Match UTR to receipts | Manual / bank CSV upload |

---

## 10. Non-Functional Requirements

- **Performance:** Dashboard KPIs load under 2 seconds; tables paginate at 50 rows.
- **Availability:** 99.5% uptime (Vercel + Supabase SLA).
- **Security:** HTTPS everywhere; RLS on all Supabase tables; no PII in URL params.
- **Backup:** Daily automated Supabase backups; 30-day retention.
- **Mobile:** Fully usable on tablet; primary optimization for 1280px+ desktop.
- **Browser support:** Chrome, Edge, Firefox (latest 2 versions).

---

## 11. Phase Plan

| Phase | Scope | Target |
|---|---|---|
| Phase 1 | PRD, schema, accounting design, full UI scaffold with realistic mock data | Complete |
| Phase 2 | Supabase integration, real auth, CRUD APIs, import pipelines | 4 weeks |
| Phase 3 | Settlement engine, PDF/Excel parsers, invoice PDF, ledger export | 6 weeks |
| Phase 4 | Audit log, exception center, WhatsApp share, advanced analytics | 4 weeks |
