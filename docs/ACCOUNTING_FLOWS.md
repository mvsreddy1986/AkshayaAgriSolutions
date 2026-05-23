# Akshaya Agri Solutions ERP — Accounting Flows

Double-entry design for all three business models. Chart of accounts is abbreviated for clarity.

---

## Chart of Accounts (Key Accounts)

| Code | Name | Type |
|---|---|---|
| 1100 | Bank — HDFC Current | Asset |
| 1200 | Trade Receivables | Asset |
| 1201 | Sarvani Biofuels — Receivable | Asset (sub) |
| 1202 | Trader Receivables | Asset (sub) |
| 1300 | Inventory — Model C Stock | Asset |
| 1400 | Farmer Finance Advance Control | Asset (advance) |
| 2100 | Trade Payables | Liability |
| 2101 | Supplier Payables | Liability (sub) |
| 2102 | Sarvani — Payable (Model C) | Liability (sub) |
| 2200 | GST Payable — CGST | Liability |
| 2201 | GST Payable — SGST | Liability |
| 2202 | GST Payable — IGST | Liability |
| 3100 | Sales Revenue — Model A | Income |
| 3101 | Sales Revenue — Model B | Income |
| 3102 | Sales Revenue — Model C | Income |
| 4100 | Cost of Goods Sold — Model C | Expense |
| 4200 | Quality Deductions Expense | Expense |

---

## Model A — Supplier Aggregation Flow

### Step 1: Import & Map Inward Lot (no ledger entry yet — operational record only)

The inward lot is a **pre-accounting operational record**. No ledger entry until approved.

### Step 2: Approve Lot & Create Supplier Settlement

When a lot is approved, a **supplier payable** is created:

```
Dr. Sarvani Receivable (1201)     ₹ Net Sale Value (rate × net payable weight)
  Cr. Supplier Payable (2101)     ₹ Supplier settlement amount
  Cr. Quality Deductions          ₹ Deduction gap (if any — rounding)
```

*Note: In practice, the lot approval does NOT post to ledger. It contributes to the invoice calculation. The ledger entry happens at invoice generation.*

### Step 3: Generate Sales Invoice to Sarvani

```
Dr. Sarvani Biofuels (1201)       ₹ Invoice Total (incl. GST)
  Cr. Sales Revenue — Model A (3100)   ₹ Taxable Value
  Cr. GST Payable — CGST (2200)        ₹ CGST Amount
  Cr. GST Payable — SGST (2201)        ₹ SGST Amount
```

*Invoice groups lots by material and date. Each invoice line = one material.*

### Step 4: Receive Payment from Sarvani

```
Dr. Bank — HDFC (1100)            ₹ Payment Amount
  Cr. Sarvani Biofuels (1201)     ₹ Invoice(s) cleared
```

*System auto-allocates payment to oldest outstanding invoices (FIFO). Partial allocations recorded.*

### Step 5: Pay Supplier (Local Aggregator)

```
Dr. Supplier Payable (2101)       ₹ Supplier settlement amount
  Cr. Bank — HDFC (1100)          ₹ Payment made
```

### Step 6: Farmer Payout Reference (Audit Record, Not Main Ledger)

Farmer payouts are tracked in `farmer_payouts` table as references only.
If Akshaya pays farmers directly (rather than through the supplier):

```
Dr. Supplier Payable (2101)       ₹ Farmer payout amount
  Cr. Bank — HDFC (1100)          ₹ Direct farmer payment
```

A farmer payout record links: farmer → inward lot → amount → payment proof.

---

## Model B — Farmer Financing Flow

### Step 1: Import Farmer Excel & Create Finance Records

When farmer data is imported and finance payments are made to farmers:

```
Dr. Farmer Finance Advance Control (1400)   ₹ Total farmer payments
  Cr. Bank — HDFC (1100)                    ₹ Cash out to farmers
```

Each farmer payment creates a sub-record in `farmer_payouts` linked to account 1400.

### Step 2: Inward Lot Records

Same as Model A — draft lots are created from the Excel, mapped to Sarvani as customer.

### Step 3: Generate Sales Invoice to Sarvani

```
Dr. Sarvani Biofuels (1201)               ₹ Invoice Total (incl. GST)
  Cr. Sales Revenue — Model B (3101)       ₹ Taxable Value
  Cr. GST Payable — CGST (2200)           ₹ CGST Amount
  Cr. GST Payable — SGST (2201)           ₹ SGST Amount
```

### Step 4: Receive Payment from Sarvani

```
Dr. Bank — HDFC (1100)                    ₹ Payment Amount
  Cr. Sarvani Biofuels (1201)             ₹ Invoice(s) cleared
```

### Step 5: Recovery — Settle Finance Advance

When Sarvani pays, the advance is considered recovered:

```
Dr. Sarvani Biofuels (1201)               ₹ Recovery amount
  Cr. Farmer Finance Advance Control (1400) ₹ Reduce exposure
```

*In practice: payment from Sarvani (Step 4) directly reduces the bank balance. The Finance Control account (1400) is reduced separately via a journal entry to reflect recovery. The system should auto-suggest this journal when a receipt is posted.*

### Model B Key Reports

- **Exposure Report:** Balance on account 1400 = Total paid to farmers - Total recovered from Sarvani
- **Farmer Reference Report:** Each farmer, how much paid, which lots, recovery status
- **Reconciliation:** Sarvani receivable vs. Finance Control balance

---

## Model C — Buy from Sarvani, Sell to Traders

### Step 1: Purchase from Sarvani

When Akshaya receives a purchase invoice from Sarvani:

```
Dr. Inventory — [Material] (1300)         ₹ Purchase Value (excl. GST)
Dr. GST Input Credit                      ₹ GST Paid on Purchase
  Cr. Sarvani — Payable (2102)            ₹ Invoice Total
```

Stock batch is created: batch ref, quantity, purchase rate.

### Step 2: Trader Sale Invoice

When a trader sale is made:

```
Dr. Trader Receivable (1202)              ₹ Sale Invoice Total (incl. GST)
  Cr. Sales Revenue — Model C (3102)      ₹ Taxable Sale Value
  Cr. GST Payable — CGST (2200)          ₹ CGST on sale
  Cr. GST Payable — SGST (2201)          ₹ SGST on sale

Dr. Cost of Goods Sold (4100)             ₹ Purchase Cost of quantity sold
  Cr. Inventory — [Material] (1300)       ₹ Stock consumed
```

Margin = Sale Value - COGS - any direct freight/handling

### Step 3: Receive Payment from Trader

```
Dr. Bank — HDFC (1100)                    ₹ Payment
  Cr. Trader Receivable (1202)            ₹ Invoice cleared
```

### Step 4: Pay Sarvani for Purchase

```
Dr. Sarvani — Payable (2102)              ₹ Purchase invoice amount
  Cr. Bank — HDFC (1100)                  ₹ Payment made
```

---

## GST Considerations

### Intra-state (within Andhra Pradesh): CGST + SGST
- CGST = 50% of applicable GST rate
- SGST = 50% of applicable GST rate

### Inter-state: IGST
- IGST = Full GST rate

### Exempt/Zero-rated materials
- Maize (raw grain): 0% GST
- Paddy Husk: 0% GST
- DDGS, WDG: 0% GST  
- Coal: 5% GST
- Biomass: 5% GST
- CO2: 18% GST
- Corn Oil: 12% GST

*Invoice must still be issued for GST-exempt materials; just with 0% tax.*

---

## Exception Handling

| Scenario | Resolution |
|---|---|
| Lot weight mismatch vs PDF | Flag as exception; require clerk correction before approval |
| Quality deduction > allowed variance | Escalate to manager for override approval |
| Invoice amount < lot sum | Block invoice generation; show gap report |
| Payment less than full invoice | Partial payment entry; invoice remains "Partial" status |
| Duplicate lot reference from PDF | System detects duplicate document_ref; blocks creation |
| Cancellation of posted invoice | Create credit note; reverse ledger entries via journal |
| Rate change mid-month | New rate_master entry with valid_from date; old lots unaffected |
