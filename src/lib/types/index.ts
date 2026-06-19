// ── Primitive enums ────────────────────────────────────────────────────────────

export type UOM = "MT" | "KG" | "L" | "Bag";
export type MaterialCategory = "Grain" | "Biomass" | "Chemical" | "Byproduct" | "Fuel";
export type MaterialStatus = "Active" | "Draft" | "Inactive";
export type PartyType = "Customer" | "Supplier" | "Farmer" | "Trader" | "Both";
export type TaxProfile = "Registered" | "Unregistered" | "Composition";
export type BusinessModel = "A" | "B" | "C";
export type LotStatus = "Draft" | "Mapped" | "QualityHold" | "Approved" | "Settled" | "Invoiced";
export type InvoiceType = "Sales" | "Purchase" | "DebitNote" | "CreditNote";
export type InvoiceStatus = "Draft" | "Approved" | "Sent" | "Partial" | "Paid" | "Cancelled";
export type VoucherType = "Receipt" | "Payment";
export type VoucherStatus = "Draft" | "Posted" | "Cleared" | "Bounced";
export type PayoutStatus = "Pending" | "Approved" | "Paid";
export type QualityRuleStatus = "Active" | "Expired" | "Draft";
export type UserRole = "Admin" | "Manager" | "Clerk";
export type Tone = "good" | "warn" | "risk";
export type Trend = "up" | "down" | "flat";

// ── Quality parameter architecture ────────────────────────────────────────────

/** Whether a parameter is a number or a category. */
export type ParamType = "quantitative" | "qualitative";

/**
 * Role this parameter plays in price calculation:
 * - deduction     → reduces payout from a pre-agreed rate
 * - rate-slab     → determines the gross sale rate via a lookup table
 * - reject-trigger → holds the lot if reading exceeds threshold
 * - info-only     → recorded for audit, no financial effect
 */
export type SettlementRole = "deduction" | "rate-slab" | "reject-trigger" | "info-only";

/** How the deduction value / weight is calculated. */
export type DeductionMethod = "linear" | "slab" | "actual-weight" | "value-pct" | "none";

/**
 * How a material's price is determined:
 * - deduction  → rate agreed upfront, quality deductions reduce the payout (Maize, DDGS, Biomass)
 * - rate-slab  → rate is computed from a quality reading like GCV or FFA % (Coal, Paddy Husk, Corn Oil)
 */
export type PricingModel = "deduction" | "rate-slab";

/** One band in a quantitative slab table. */
export interface QuantitativeSlab {
  from: number;
  to: number;
  /** ₹/MT for rate-slab role; ₹/MT/unit-excess for deduction slab. */
  rate: number;
}

/** One entry in a qualitative rate/reject table. */
export interface QualitativeSlab {
  value: string;
  /** Fraction of grossSaleRate kept — 1.0 = full, 0.95 = 5% penalty. */
  rateMultiplier: number;
  rejectTrigger: boolean;
}

/** Parameter schema attached to a Material — defines the form and expected inputs. */
export interface MaterialParam {
  paramKey: string;      // stable machine key e.g. "moisture_pct", "gcv_kcal_kg"
  label: string;         // display label e.g. "Moisture %"
  type: ParamType;
  uom: string;           // "%", "ppm", "kcal/kg", "grade", "bar", "days"
  settlementRole: SettlementRole;
  required: boolean;     // must be recorded before lot leaves Draft
  sortOrder: number;
}

/** Settlement rule for one parameter inside a QualityRule (stored as JSONB array). */
export interface ParameterRule {
  paramKey: string;
  label?: string;
  // Quantitative deduction
  baseValue?: number;
  deductionMethod?: DeductionMethod;
  linearRate?: number;                 // ₹/MT per unit above base (linear method)
  deductionSlabs?: QuantitativeSlab[]; // tiered ₹/MT/unit deduction slabs
  rateSlabs?: QuantitativeSlab[];      // rate-slab pricing lookup
  rejectThreshold?: number;            // auto-QualityHold if reading > this
  // Qualitative rate / reject
  qualitativeSlabs?: QualitativeSlab[];
}

// ── Core entities ─────────────────────────────────────────────────────────────

export interface Material {
  id: string;
  name: string;
  hsn: string;
  uom: UOM;
  gstRate: number;
  cessRate: number;            // % cess levied at mandi on every transaction (e.g. 1 = 1%)
  category: MaterialCategory;
  defaultGrossSaleRate: number;
  pricingModel: PricingModel;
  params: MaterialParam[];   // stored as JSONB; replaces qualityParams: string[]
  status: MaterialStatus;
}

export interface Party {
  id: string;
  name: string;
  partyType: PartyType;
  gstin: string;
  mobile: string;
  email: string;
  address: string;
  state: string;
  openingBalance: number;
  creditLimit: number;
  creditDays: number;
  businessFlows: BusinessModel[];
  taxProfile: TaxProfile;
  bankAccount: string;
  ifsc: string;
  bankName: string;
  isFarmerReference: boolean;
  status: "Active" | "Inactive";
}

export interface QualityRule {
  id: string;
  materialId: string;
  materialName: string;
  pricingModel: PricingModel;
  validFrom: string;
  validTo: string | null;
  globalCessRate: number;      // % applied on net weight × rate (market cess)
  allowedVariancePct: number;
  description: string;
  status: QualityRuleStatus;
  paramRules: ParameterRule[]; // stored as JSONB
}

export interface RateMaster {
  id: string;
  materialId: string;
  materialName: string;
  partyId: string | null;
  partyName: string | null;
  rateType: "GrossSale" | "Purchase" | "Retail";
  rate: number;
  validFrom: string;
  validTo: string | null;
}

export interface InwardLot {
  id: string;
  documentRef: string;
  businessModel: BusinessModel;
  lotDate: string;
  materialId: string;
  materialName: string;
  customerId: string;
  customerName: string;
  supplierId: string | null;
  supplierName: string | null;
  farmerId: string | null;
  farmerName: string | null;
  vehicleNo: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  acceptedWeight: number;
  /** Dynamic readings keyed by paramKey — e.g. { moisture_pct: 15.2, fm_pct: 1.1 } */
  qualityReadings: Record<string, number | string>;
  qualityRuleId: string | null;
  /** Monetary deduction (₹) per paramKey — computed by settlement engine. */
  paramDeductions: Record<string, number>;
  cessAmount: number;
  netPayableWeight: number;
  grossSaleRate: number;
  grossSaleValue: number;
  importBatchId: string | null;
  invoiceId: string | null;
  status: LotStatus;
  overrideReason: string | null;
  akshayaMarginPerMT: number;  // ₹/MT Akshaya earns as service margin (default 50 = ₹5/qtl)
  holdPenalty: number;          // ₹ additional deduction agreed when accepting a held lot (0 = none)
  holdPenaltyNote: string | null; // audit note explaining why the penalty was applied
}

export interface FarmerPayout {
  id: string;
  batchRef: string;
  farmerId: string;
  farmerName: string;
  inwardLotId: string | null;
  documentRef: string;
  payoutDate: string;
  materialName: string;
  quantity: number;
  rate: number;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  paymentMode: string;
  paymentRef: string;
  paymentStatus: PayoutStatus;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceType: InvoiceType;
  businessModel: BusinessModel;
  invoiceDate: string;
  dueDate: string;
  partyId: string;
  partyName: string;
  materialId: string;
  materialName: string;
  quantity: number;
  uom: UOM;
  grossRate: number;
  grossValue: number;
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalValue: number;
  amountPaid: number;
  amountDue: number;
  linkedLotIds: string[];
  status: InvoiceStatus;
  cancelledReason: string | null;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  voucherType: VoucherType;
  voucherDate: string;
  partyId: string;
  partyName: string;
  amount: number;
  paymentMode: string;
  bankRef: string;
  narration: string;
  status: VoucherStatus;
  allocatedTo: string[];
}

export interface LedgerEntry {
  id: string;
  entryDate: string;
  accountCode: string;
  accountName: string;
  partyId: string | null;
  partyName: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  narration: string;
  sourceType: "Invoice" | "Voucher" | "Journal" | "Settlement";
  sourceId: string;
  sourceRef: string;
}

export interface StockBatch {
  id: string;
  batchRef: string;
  materialId: string;
  materialName: string;
  purchaseDate: string;
  openingQty: number;
  soldQty: number;
  availableQty: number;
  purchaseRate: number;
  qualityStatus: "Pending" | "Approved" | "Rejected";
  qualityNotes: string;
}

export interface ImportBatch {
  id: string;
  batchRef: string;
  importType: "PDF" | "Excel";
  businessModel: BusinessModel;
  sourceFilename: string;
  reportDate: string;
  partyName: string;
  totalRows: number;
  mappedRows: number;
  status: "Pending" | "Draft" | "Mapped" | "Posted";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  modules: string[];
  status: "Active" | "Inactive";
}

export interface AuditLog {
  id: string;
  loggedAt: string;
  userName: string;
  role: UserRole;
  action: string;
  entityType: string;
  entityRef: string;
  details: string;
}

export interface KPI {
  label: string;
  value: string;
  note: string;
  trend: Trend;
  tone: Tone;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
