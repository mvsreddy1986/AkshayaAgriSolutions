import type {
  Material, Party, QualityRule, RateMaster, InwardLot, FarmerPayout,
  Invoice, Voucher, LedgerEntry, StockBatch, ImportBatch, User, AuditLog, KPI
} from "../types";

// ─── MATERIALS ──────────────────────────────────────────────────────────────

export const MATERIALS: Material[] = [
  {
    id: "mat-001", name: "Maize", hsn: "1005", uom: "MT", gstRate: 0,
    category: "Grain", defaultGrossSaleRate: 22500, settlementMethod: "Quality deduction + cess",
    qualityParams: ["Moisture %", "Foreign matter %", "Broken grain %", "Aflatoxin ppm", "Test weight"],
    status: "Active",
  },
  {
    id: "mat-002", name: "Paddy Husk", hsn: "1213", uom: "MT", gstRate: 0,
    category: "Biomass", defaultGrossSaleRate: 2800, settlementMethod: "GCV and ash based rate slab",
    qualityParams: ["Moisture %", "Ash content %", "GCV Kcal/kg"], status: "Active",
  },
  {
    id: "mat-003", name: "Coal", hsn: "2701", uom: "MT", gstRate: 5,
    category: "Fuel", defaultGrossSaleRate: 12000, settlementMethod: "Weighted landed cost",
    qualityParams: ["GCV Kcal/kg", "Ash %", "Moisture %", "Sulphur %"], status: "Active",
  },
  {
    id: "mat-004", name: "Biomass", hsn: "4401", uom: "MT", gstRate: 5,
    category: "Biomass", defaultGrossSaleRate: 3500, settlementMethod: "Accepted weight",
    qualityParams: ["Moisture %", "Foreign matter %", "GCV Kcal/kg"], status: "Active",
  },
  {
    id: "mat-005", name: "DDGS", hsn: "2303", uom: "MT", gstRate: 0,
    category: "Byproduct", defaultGrossSaleRate: 18000, settlementMethod: "Retail margin",
    qualityParams: ["Moisture %", "Protein %", "Sand silica %", "Fat %"], status: "Active",
  },
  {
    id: "mat-006", name: "WDG", hsn: "2309", uom: "MT", gstRate: 0,
    category: "Byproduct", defaultGrossSaleRate: 9500, settlementMethod: "Daily dispatch rate",
    qualityParams: ["Moisture %", "Freshness days"], status: "Draft",
  },
  {
    id: "mat-007", name: "CO2", hsn: "2811", uom: "KG", gstRate: 18,
    category: "Chemical", defaultGrossSaleRate: 28, settlementMethod: "Bulk purchase ledger",
    qualityParams: ["Purity %", "Pressure bar"], status: "Active",
  },
  {
    id: "mat-008", name: "Corn Oil", hsn: "1515", uom: "L", gstRate: 12,
    category: "Byproduct", defaultGrossSaleRate: 85, settlementMethod: "Batch settlement",
    qualityParams: ["FFA %", "Moisture %", "Impurities %", "Color"], status: "Active",
  },
];

// ─── PARTIES ─────────────────────────────────────────────────────────────────

export const PARTIES: Party[] = [
  {
    id: "pty-001", name: "Sarvani Biofuels Pvt Ltd", partyType: "Both",
    gstin: "37AAGCS8432B1ZK", mobile: "9848012345", email: "accounts@sarvanibio.in",
    address: "Industrial Area, Bhimavaram, West Godavari, AP 534202",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 10000000, creditDays: 21,
    businessFlows: ["A", "B", "C"], taxProfile: "Registered",
    bankAccount: "002305001234", ifsc: "ICIC0000023", bankName: "ICICI Bank",
    isFarmerReference: false, status: "Active",
  },
  {
    id: "pty-002", name: "Mallikarjuna Traders", partyType: "Supplier",
    gstin: "37AABCM1234A1Z5", mobile: "9440012345", email: "",
    address: "Main Road, Tanuku, West Godavari, AP 534211",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 0, creditDays: 7,
    businessFlows: ["A"], taxProfile: "Registered",
    bankAccount: "67890123456", ifsc: "SBIN0020301", bankName: "SBI",
    isFarmerReference: false, status: "Active",
  },
  {
    id: "pty-003", name: "Krishna Agro Suppliers", partyType: "Supplier",
    gstin: "37AABCK5678B1Z2", mobile: "9949876543", email: "",
    address: "NH-16, Eluru, West Godavari, AP 534004",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 0, creditDays: 7,
    businessFlows: ["A"], taxProfile: "Registered",
    bankAccount: "12312312312", ifsc: "ANDB0001234", bankName: "Andhra Bank",
    isFarmerReference: false, status: "Active",
  },
  {
    id: "pty-004", name: "Ravi Kumar", partyType: "Farmer",
    gstin: "", mobile: "9848055555", email: "",
    address: "Village Achanta, Mandal Achanta, West Godavari, AP",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 0, creditDays: 0,
    businessFlows: ["A", "B"], taxProfile: "Unregistered",
    bankAccount: "33412345678", ifsc: "UBIN0559843", bankName: "Union Bank",
    isFarmerReference: true, status: "Active",
  },
  {
    id: "pty-005", name: "Suresh Yadav", partyType: "Farmer",
    gstin: "", mobile: "9866011223", email: "",
    address: "Village Narsapuram, West Godavari, AP",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 0, creditDays: 0,
    businessFlows: ["A", "B"], taxProfile: "Unregistered",
    bankAccount: "44567890123", ifsc: "PUNB0345600", bankName: "Punjab National Bank",
    isFarmerReference: true, status: "Active",
  },
  {
    id: "pty-006", name: "Venkata Ramana Reddy", partyType: "Farmer",
    gstin: "", mobile: "9490312456", email: "",
    address: "Village Palakol, West Godavari, AP",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 0, creditDays: 0,
    businessFlows: ["B"], taxProfile: "Unregistered",
    bankAccount: "55678901234", ifsc: "CNRB0003456", bankName: "Canara Bank",
    isFarmerReference: true, status: "Active",
  },
  {
    id: "pty-007", name: "Sri Lakshmi Feeds", partyType: "Trader",
    gstin: "37AADCS9988C1ZP", mobile: "9848077890", email: "srilakshmi@feeds.in",
    address: "Feed Market, Bhimavaram, AP",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 500000, creditDays: 15,
    businessFlows: ["C"], taxProfile: "Registered",
    bankAccount: "66789012345", ifsc: "HDFC0001122", bankName: "HDFC Bank",
    isFarmerReference: false, status: "Active",
  },
  {
    id: "pty-008", name: "Balaji Agro Products", partyType: "Trader",
    gstin: "37AAACB4321D1ZQ", mobile: "9440099887", email: "",
    address: "Rajam Road, Srikakulam, AP",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 300000, creditDays: 10,
    businessFlows: ["C"], taxProfile: "Registered",
    bankAccount: "77890123456", ifsc: "KKBK0003344", bankName: "Kotak Bank",
    isFarmerReference: false, status: "Active",
  },
  {
    id: "pty-009", name: "Farmer Finance Pool (Model B Control)", partyType: "Both",
    gstin: "", mobile: "", email: "",
    address: "Internal control account — Akshaya Agri Solutions",
    state: "Andhra Pradesh", openingBalance: 0, creditLimit: 0, creditDays: 0,
    businessFlows: ["B"], taxProfile: "Unregistered",
    bankAccount: "", ifsc: "", bankName: "",
    isFarmerReference: false, status: "Active",
  },
];

// ─── QUALITY RULES ───────────────────────────────────────────────────────────

export const QUALITY_RULES: QualityRule[] = [
  {
    id: "qr-001", materialId: "mat-001", materialName: "Maize",
    validFrom: "2026-05-01", validTo: "2026-05-31",
    baseMoisture: 14, moistureDeductionMethod: "linear", moistureRatePerPct: 0.71,
    fmDeductionMethod: "actual", fmRatePerPct: 1.0, cessRate: 0.5, allowedVariancePct: 2,
    description: "May 2026: Moisture base 14%, FM actual deduction, cess 0.5% on net value",
    status: "Active",
  },
  {
    id: "qr-002", materialId: "mat-001", materialName: "Maize",
    validFrom: "2026-04-01", validTo: "2026-04-30",
    baseMoisture: 14.5, moistureDeductionMethod: "linear", moistureRatePerPct: 0.68,
    fmDeductionMethod: "actual", fmRatePerPct: 1.0, cessRate: 0.5, allowedVariancePct: 2,
    description: "April 2026: Slightly higher base moisture for post-harvest season",
    status: "Expired",
  },
  {
    id: "qr-003", materialId: "mat-005", materialName: "DDGS",
    validFrom: "2026-05-01", validTo: "2026-05-15",
    baseMoisture: 10, moistureDeductionMethod: "slab", moistureRatePerPct: 0.5,
    fmDeductionMethod: "none", fmRatePerPct: 0, cessRate: 0, allowedVariancePct: 1.5,
    description: "May 1–15 DDGS: moisture/protein linked to resale margin",
    status: "Active",
  },
  {
    id: "qr-004", materialId: "mat-002", materialName: "Paddy Husk",
    validFrom: "2026-05-10", validTo: "2026-05-31",
    baseMoisture: 12, moistureDeductionMethod: "linear", moistureRatePerPct: 0.45,
    fmDeductionMethod: "none", fmRatePerPct: 0, cessRate: 0.25, allowedVariancePct: 3,
    description: "Paddy Husk: GCV and ash based rate slab from 10-May",
    status: "Active",
  },
];

// ─── RATE MASTERS ────────────────────────────────────────────────────────────

export const RATE_MASTERS: RateMaster[] = [
  { id: "rm-001", materialId: "mat-001", materialName: "Maize", partyId: "pty-001", partyName: "Sarvani Biofuels", rateType: "GrossSale", rate: 22500, validFrom: "2026-05-01", validTo: null },
  { id: "rm-002", materialId: "mat-002", materialName: "Paddy Husk", partyId: "pty-001", partyName: "Sarvani Biofuels", rateType: "GrossSale", rate: 2800, validFrom: "2026-05-01", validTo: null },
  { id: "rm-003", materialId: "mat-004", materialName: "Biomass", partyId: "pty-001", partyName: "Sarvani Biofuels", rateType: "GrossSale", rate: 3500, validFrom: "2026-05-01", validTo: null },
  { id: "rm-004", materialId: "mat-005", materialName: "DDGS", partyId: null, partyName: "Default (all traders)", rateType: "Retail", rate: 18000, validFrom: "2026-05-01", validTo: null },
  { id: "rm-005", materialId: "mat-006", materialName: "WDG", partyId: null, partyName: "Default", rateType: "Retail", rate: 9500, validFrom: "2026-05-01", validTo: null },
  { id: "rm-006", materialId: "mat-005", materialName: "DDGS", partyId: "pty-001", partyName: "Sarvani Biofuels", rateType: "Purchase", rate: 15200, validFrom: "2026-05-01", validTo: null },
];

// ─── INWARD LOTS ─────────────────────────────────────────────────────────────

export const INWARD_LOTS: InwardLot[] = [
  {
    id: "lot-001", documentRef: "DR-12MAY-001", businessModel: "A", lotDate: "2026-05-12",
    materialId: "mat-001", materialName: "Maize", customerId: "pty-001", customerName: "Sarvani Biofuels",
    supplierId: "pty-002", supplierName: "Mallikarjuna Traders", farmerId: "pty-004", farmerName: "Ravi Kumar",
    vehicleNo: "AP39CD1234", grossWeight: 15.82, tareWeight: 3.06, netWeight: 12.76, acceptedWeight: 12.64,
    moisturePct: 15.2, fmPct: 1.1, qualityRuleId: "qr-001",
    moistureDeduction: 0.15, fmDeduction: 0.14, cessAmount: 63.18, netPayableWeight: 12.35,
    grossSaleRate: 22500, grossSaleValue: 277875,
    importBatchId: "imp-001", invoiceId: null, status: "Mapped", overrideReason: null,
  },
  {
    id: "lot-002", documentRef: "DR-12MAY-002", businessModel: "A", lotDate: "2026-05-12",
    materialId: "mat-001", materialName: "Maize", customerId: "pty-001", customerName: "Sarvani Biofuels",
    supplierId: "pty-002", supplierName: "Mallikarjuna Traders", farmerId: "pty-005", farmerName: "Suresh Yadav",
    vehicleNo: "AP39EF5678", grossWeight: 14.40, tareWeight: 2.90, netWeight: 11.50, acceptedWeight: 11.38,
    moisturePct: 14.8, fmPct: 0.9, qualityRuleId: "qr-001",
    moistureDeduction: 0.09, fmDeduction: 0.10, cessAmount: 56.77, netPayableWeight: 11.19,
    grossSaleRate: 22500, grossSaleValue: 251775,
    importBatchId: "imp-001", invoiceId: null, status: "Mapped", overrideReason: null,
  },
  {
    id: "lot-003", documentRef: "DR-12MAY-003", businessModel: "A", lotDate: "2026-05-12",
    materialId: "mat-001", materialName: "Maize", customerId: "pty-001", customerName: "Sarvani Biofuels",
    supplierId: "pty-003", supplierName: "Krishna Agro Suppliers", farmerId: null, farmerName: null,
    vehicleNo: "AP39GH9012", grossWeight: 16.20, tareWeight: 3.20, netWeight: 13.00, acceptedWeight: 12.88,
    moisturePct: 16.5, fmPct: 1.8, qualityRuleId: "qr-001",
    moistureDeduction: 0.23, fmDeduction: 0.23, cessAmount: 62.70, netPayableWeight: 12.42,
    grossSaleRate: 22500, grossSaleValue: 279450,
    importBatchId: "imp-001", invoiceId: null, status: "QualityHold", overrideReason: null,
  },
  {
    id: "lot-004", documentRef: "DR-12MAY-004", businessModel: "A", lotDate: "2026-05-12",
    materialId: "mat-004", materialName: "Biomass", customerId: "pty-001", customerName: "Sarvani Biofuels",
    supplierId: "pty-002", supplierName: "Mallikarjuna Traders", farmerId: null, farmerName: null,
    vehicleNo: "AP38AB3333", grossWeight: 8.60, tareWeight: 1.80, netWeight: 6.80, acceptedWeight: 6.72,
    moisturePct: 12.0, fmPct: 2.0, qualityRuleId: null,
    moistureDeduction: 0, fmDeduction: 0, cessAmount: 0, netPayableWeight: 6.72,
    grossSaleRate: 3500, grossSaleValue: 23520,
    importBatchId: "imp-001", invoiceId: null, status: "Approved", overrideReason: null,
  },
  {
    id: "lot-005", documentRef: "FF-12MAY-014", businessModel: "B", lotDate: "2026-05-12",
    materialId: "mat-001", materialName: "Maize", customerId: "pty-001", customerName: "Sarvani Biofuels",
    supplierId: null, supplierName: null, farmerId: "pty-006", farmerName: "Venkata Ramana Reddy",
    vehicleNo: "AP29JK4567", grossWeight: 12.50, tareWeight: 2.50, netWeight: 10.00, acceptedWeight: 9.88,
    moisturePct: 14.2, fmPct: 0.7, qualityRuleId: "qr-001",
    moistureDeduction: 0.02, fmDeduction: 0.07, cessAmount: 49.32, netPayableWeight: 9.79,
    grossSaleRate: 22500, grossSaleValue: 220275,
    importBatchId: "imp-002", invoiceId: "inv-001", status: "Invoiced", overrideReason: null,
  },
  {
    id: "lot-006", documentRef: "DR-11MAY-001", businessModel: "A", lotDate: "2026-05-11",
    materialId: "mat-001", materialName: "Maize", customerId: "pty-001", customerName: "Sarvani Biofuels",
    supplierId: "pty-002", supplierName: "Mallikarjuna Traders", farmerId: "pty-004", farmerName: "Ravi Kumar",
    vehicleNo: "AP39PQ1111", grossWeight: 15.60, tareWeight: 3.00, netWeight: 12.60, acceptedWeight: 12.48,
    moisturePct: 14.5, fmPct: 0.8, qualityRuleId: "qr-001",
    moistureDeduction: 0.06, fmDeduction: 0.10, cessAmount: 62.10, netPayableWeight: 12.32,
    grossSaleRate: 22500, grossSaleValue: 277200,
    importBatchId: null, invoiceId: "inv-001", status: "Invoiced", overrideReason: null,
  },
];

// ─── FARMER PAYOUTS ──────────────────────────────────────────────────────────

export const FARMER_PAYOUTS: FarmerPayout[] = [
  {
    id: "fp-001", batchRef: "FP-090", farmerId: "pty-004", farmerName: "Ravi Kumar",
    inwardLotId: "lot-001", documentRef: "DR-12MAY-001", payoutDate: "2026-05-13",
    materialName: "Maize", quantity: 12.35, rate: 21800, grossAmount: 269230, deductions: 1346, netAmount: 267884,
    paymentMode: "NEFT", paymentRef: "", paymentStatus: "Pending",
  },
  {
    id: "fp-002", batchRef: "FP-090", farmerId: "pty-005", farmerName: "Suresh Yadav",
    inwardLotId: "lot-002", documentRef: "DR-12MAY-002", payoutDate: "2026-05-13",
    materialName: "Maize", quantity: 11.19, rate: 21800, grossAmount: 243942, deductions: 1220, netAmount: 242722,
    paymentMode: "NEFT", paymentRef: "", paymentStatus: "Pending",
  },
  {
    id: "fp-003", batchRef: "FP-089", farmerId: "pty-006", farmerName: "Venkata Ramana Reddy",
    inwardLotId: "lot-005", documentRef: "FF-12MAY-014", payoutDate: "2026-05-12",
    materialName: "Maize", quantity: 9.79, rate: 22200, grossAmount: 217338, deductions: 1087, netAmount: 216251,
    paymentMode: "NEFT", paymentRef: "NEFT/20260512/0034521", paymentStatus: "Paid",
  },
];

// ─── INVOICES ────────────────────────────────────────────────────────────────

export const INVOICES: Invoice[] = [
  {
    id: "inv-001", invoiceNo: "AAS-2627-0122", invoiceType: "Sales", businessModel: "A",
    invoiceDate: "2026-05-12", dueDate: "2026-06-02",
    partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
    materialId: "mat-001", materialName: "Maize",
    quantity: 486.72, uom: "MT", grossRate: 22500, grossValue: 10951200,
    taxableValue: 10951200, cgstRate: 0, sgstRate: 0, igstRate: 0,
    cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0,
    totalValue: 10951200, amountPaid: 0, amountDue: 10951200,
    linkedLotIds: ["lot-005", "lot-006"], status: "Approved", cancelledReason: null,
  },
  {
    id: "inv-002", invoiceNo: "AAS-2627-0123", invoiceType: "Sales", businessModel: "B",
    invoiceDate: "2026-05-12", dueDate: "2026-06-02",
    partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
    materialId: "mat-001", materialName: "Maize",
    quantity: 122.18, uom: "MT", grossRate: 22500, grossValue: 2749050,
    taxableValue: 2749050, cgstRate: 0, sgstRate: 0, igstRate: 0,
    cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0,
    totalValue: 2749050, amountPaid: 0, amountDue: 2749050,
    linkedLotIds: ["lot-005"], status: "Draft", cancelledReason: null,
  },
  {
    id: "inv-003", invoiceNo: "AAS-2627-0124", invoiceType: "Sales", businessModel: "C",
    invoiceDate: "2026-05-12", dueDate: "2026-05-27",
    partyId: "pty-007", partyName: "Sri Lakshmi Feeds",
    materialId: "mat-005", materialName: "DDGS",
    quantity: 18.50, uom: "MT", grossRate: 18000, grossValue: 333000,
    taxableValue: 333000, cgstRate: 0, sgstRate: 0, igstRate: 0,
    cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0,
    totalValue: 333000, amountPaid: 20700, amountDue: 312300,
    linkedLotIds: [], status: "Partial", cancelledReason: null,
  },
  {
    id: "inv-004", invoiceNo: "AAS-2627-0118", invoiceType: "Sales", businessModel: "A",
    invoiceDate: "2026-05-01", dueDate: "2026-05-22",
    partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
    materialId: "mat-001", materialName: "Maize",
    quantity: 512.40, uom: "MT", grossRate: 22500, grossValue: 11529000,
    taxableValue: 11529000, cgstRate: 0, sgstRate: 0, igstRate: 0,
    cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0,
    totalValue: 11529000, amountPaid: 11529000, amountDue: 0,
    linkedLotIds: [], status: "Paid", cancelledReason: null,
  },
];

// ─── VOUCHERS ────────────────────────────────────────────────────────────────

export const VOUCHERS: Voucher[] = [
  {
    id: "vch-001", voucherNo: "RV-2627-0088", voucherType: "Receipt", voucherDate: "2026-05-10",
    partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
    amount: 11529000, paymentMode: "RTGS", bankRef: "RTGS/20260510/0012345",
    narration: "Receipt against AAS-2627-0118 — Maize supply May batch 1",
    status: "Posted", allocatedTo: ["inv-004"],
  },
  {
    id: "vch-002", voucherNo: "PV-2627-0045", voucherType: "Payment", voucherDate: "2026-05-11",
    partyId: "pty-002", partyName: "Mallikarjuna Traders",
    amount: 825400, paymentMode: "NEFT", bankRef: "NEFT/20260511/0008876",
    narration: "Supplier settlement — Maize lots 1–8 May 2026",
    status: "Posted", allocatedTo: [],
  },
  {
    id: "vch-003", voucherNo: "PV-2627-0046", voucherType: "Payment", voucherDate: "2026-05-12",
    partyId: "pty-006", partyName: "Venkata Ramana Reddy",
    amount: 216251, paymentMode: "NEFT", bankRef: "NEFT/20260512/0034521",
    narration: "Model B farmer finance — lot FF-12MAY-014",
    status: "Posted", allocatedTo: [],
  },
];

// ─── LEDGER ENTRIES ──────────────────────────────────────────────────────────

export const LEDGER_SARVANI: LedgerEntry[] = [
  {
    id: "le-001", entryDate: "2026-05-01", accountCode: "1201", accountName: "Sarvani Biofuels — Receivable",
    partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
    debit: 11529000, credit: 0, runningBalance: 11529000,
    narration: "Invoice AAS-2627-0118 — Maize 512.40 MT @ ₹22,500", sourceType: "Invoice", sourceId: "inv-004", sourceRef: "AAS-2627-0118",
  },
  {
    id: "le-002", entryDate: "2026-05-10", accountCode: "1201", accountName: "Sarvani Biofuels — Receivable",
    partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
    debit: 0, credit: 11529000, runningBalance: 0,
    narration: "Receipt RV-2627-0088 — RTGS payment against AAS-2627-0118", sourceType: "Voucher", sourceId: "vch-001", sourceRef: "RV-2627-0088",
  },
  {
    id: "le-003", entryDate: "2026-05-12", accountCode: "1201", accountName: "Sarvani Biofuels — Receivable",
    partyId: "pty-001", partyName: "Sarvani Biofuels Pvt Ltd",
    debit: 10951200, credit: 0, runningBalance: 10951200,
    narration: "Invoice AAS-2627-0122 — Maize 486.72 MT @ ₹22,500", sourceType: "Invoice", sourceId: "inv-001", sourceRef: "AAS-2627-0122",
  },
];

// ─── STOCK BATCHES (Model C) ──────────────────────────────────────────────────

export const STOCK_BATCHES: StockBatch[] = [
  {
    id: "sb-001", batchRef: "DDGS-MAY-01", materialId: "mat-005", materialName: "DDGS",
    purchaseDate: "2026-05-05", openingQty: 52.0, soldQty: 18.5, availableQty: 33.5,
    purchaseRate: 15200, qualityStatus: "Approved",
    qualityNotes: "Moisture 9.8%, Protein 26.4%, Sand silica 0.3% — within spec",
  },
  {
    id: "sb-002", batchRef: "CO-MAY-03", materialId: "mat-008", materialName: "Corn Oil",
    purchaseDate: "2026-05-08", openingQty: 12000, soldQty: 4200, availableQty: 7800,
    purchaseRate: 68, qualityStatus: "Approved",
    qualityNotes: "FFA 3.1%, moisture 0.2% — Grade B refined",
  },
  {
    id: "sb-003", batchRef: "WDG-MAY-02", materialId: "mat-006", materialName: "WDG",
    purchaseDate: "2026-05-07", openingQty: 28.0, soldQty: 11.0, availableQty: 17.0,
    purchaseRate: 7800, qualityStatus: "Approved",
    qualityNotes: "Freshness 12 days — dispatch within 18 days",
  },
];

// ─── IMPORT BATCHES ──────────────────────────────────────────────────────────

export const IMPORT_BATCHES: ImportBatch[] = [
  {
    id: "imp-001", batchRef: "IMPORT-12052026-001", importType: "PDF", businessModel: "A",
    sourceFilename: "AKSHAYA AGRI SOLUTIONS 12-5-26.pdf", reportDate: "2026-05-12",
    partyName: "Sarvani Biofuels Pvt Ltd", totalRows: 38, mappedRows: 35, status: "Mapped",
  },
  {
    id: "imp-002", batchRef: "IMPORT-12052026-002", importType: "Excel", businessModel: "B",
    sourceFilename: "FP-090 Farmer Sheet 12-May-2026.xlsx", reportDate: "2026-05-12",
    partyName: "Sarvani Biofuels Pvt Ltd", totalRows: 14, mappedRows: 14, status: "Posted",
  },
  {
    id: "imp-003", batchRef: "IMPORT-11052026-001", importType: "PDF", businessModel: "A",
    sourceFilename: "AKSHAYA AGRI SOLUTIONS 11-5-26.pdf", reportDate: "2026-05-11",
    partyName: "Sarvani Biofuels Pvt Ltd", totalRows: 31, mappedRows: 31, status: "Posted",
  },
];

// ─── USERS ───────────────────────────────────────────────────────────────────

export const USERS: User[] = [
  {
    id: "usr-001", name: "Admin", email: "admin@akshayaagri.in", role: "Admin",
    modules: ["*"], status: "Active",
  },
  {
    id: "usr-002", name: "Manager", email: "manager@akshayaagri.in", role: "Manager",
    modules: ["command", "masters", "procurement", "finance", "sales", "accounting", "documents", "reports"],
    status: "Active",
  },
  {
    id: "usr-003", name: "Clerk", email: "clerk@akshayaagri.in", role: "Clerk",
    modules: ["command", "procurement", "documents", "reports"],
    status: "Active",
  },
];

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

export const AUDIT_LOGS: AuditLog[] = [
  { id: "al-001", loggedAt: "2026-05-12T10:32:00+05:30", userName: "Clerk", role: "Clerk", action: "CREATE", entityType: "ImportBatch", entityRef: "IMPORT-12052026-001", details: "Uploaded delivery report PDF — 38 lots parsed" },
  { id: "al-002", loggedAt: "2026-05-12T11:08:00+05:30", userName: "Manager", role: "Manager", action: "APPROVE", entityType: "QualityRule", entityRef: "qr-001 Maize May 2026", details: "Approved quality rule effective 01-May-2026" },
  { id: "al-003", loggedAt: "2026-05-12T11:45:00+05:30", userName: "Clerk", role: "Clerk", action: "MAP", entityType: "InwardLot", entityRef: "DR-12MAY-001", details: "Mapped supplier: Mallikarjuna Traders, farmer: Ravi Kumar" },
  { id: "al-004", loggedAt: "2026-05-12T12:14:00+05:30", userName: "Admin", role: "Admin", action: "APPROVE", entityType: "Invoice", entityRef: "AAS-2627-0122", details: "Released invoice — Maize 486.72 MT, ₹1,09,51,200" },
  { id: "al-005", loggedAt: "2026-05-12T13:20:00+05:30", userName: "Manager", role: "Manager", action: "CREATE", entityType: "Voucher", entityRef: "PV-2627-0046", details: "Model B farmer payment — Venkata Ramana Reddy ₹2,16,251" },
  { id: "al-006", loggedAt: "2026-05-12T14:00:00+05:30", userName: "Clerk", role: "Clerk", action: "HOLD", entityType: "InwardLot", entityRef: "DR-12MAY-003", details: "Quality hold — FM 1.8% exceeds 2% variance threshold" },
];

// ─── KPIs ────────────────────────────────────────────────────────────────────

export const KPIS: KPI[] = [
  { label: "Today supply", value: "486.72 MT", note: "38 vehicles · Maize + Biomass", trend: "up", tone: "good" },
  { label: "Draft invoices", value: "₹ 42.8 L", note: "3 pending approval", trend: "flat", tone: "warn" },
  { label: "Receivables (Sarvani)", value: "₹ 1,09.51 L", note: "AAS-2627-0122 due 2 Jun", trend: "up", tone: "good" },
  { label: "Payables (Suppliers)", value: "₹ 8.25 L", note: "14 payouts queued", trend: "flat", tone: "warn" },
  { label: "Model B exposure", value: "₹ 14.78 L", note: "Farmer finance outstanding", trend: "up", tone: "risk" },
  { label: "Document match", value: "97.8%", note: "35 / 38 lots mapped today", trend: "up", tone: "good" },
];

// ─── APPROVAL QUEUE ──────────────────────────────────────────────────────────

export const APPROVAL_QUEUE = [
  { ref: "AAS-2627-0122", type: "Invoice", requiredRole: "Admin", value: "₹ 1,09,51,200", description: "Maize 486.72 MT gross sale invoice to Sarvani — Model A" },
  { ref: "qr-001 May 2026", type: "Quality Rule", requiredRole: "Admin", value: "FM + moisture rules", description: "Maize quality rule effective 01-May-2026, cess 0.5%" },
  { ref: "FP-090", type: "Farmer Payout Batch", requiredRole: "Manager", value: "₹ 9,70,806", description: "14 farmer beneficiaries — Model A/B payout batch" },
  { ref: "Sri Lakshmi Feeds", type: "Credit Limit", requiredRole: "Admin", value: "₹ 5,00,000", description: "Credit limit enhancement for retail resale customer" },
];

// ─── TASKS ───────────────────────────────────────────────────────────────────

export const TASKS = [
  { title: "Map 3 unmapped Model A lots", detail: "DR-12MAY-003 to DR-12MAY-005 from today's PDF need supplier and farmer references.", priority: "high" },
  { title: "Approve invoice AAS-2627-0122", detail: "₹1,09,51,200 Sarvani invoice is draft — approve and send.", priority: "high" },
  { title: "Release FP-090 farmer payouts", detail: "14 beneficiaries, ₹9,70,806 queued. Sarvani receipt confirmed.", priority: "medium" },
  { title: "Share Sri Lakshmi Feeds statement", detail: "Trader requested ledger statement for reconciliation — share AAS-2627-0124.", priority: "low" },
  { title: "Review quality hold on DR-12MAY-003", detail: "FM 1.8% flagged — manager approval required to proceed.", priority: "high" },
];
