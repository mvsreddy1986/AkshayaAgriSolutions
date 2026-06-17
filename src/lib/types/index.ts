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

export interface Material {
  id: string;
  name: string;
  hsn: string;
  uom: UOM;
  gstRate: number;
  category: MaterialCategory;
  defaultGrossSaleRate: number;
  settlementMethod: string;
  qualityParams: string[];
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
  validFrom: string;
  validTo: string | null;
  baseMoisture: number;
  moistureDeductionMethod: "linear" | "slab" | "none";
  moistureRatePerPct: number;
  fmDeductionMethod: "actual" | "slab" | "none";
  fmRatePerPct: number;
  cessRate: number;
  allowedVariancePct: number;
  description: string;
  status: QualityRuleStatus;
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
  moisturePct: number;
  fmPct: number;
  qualityRuleId: string | null;
  moistureDeduction: number;
  fmDeduction: number;
  cessAmount: number;
  netPayableWeight: number;
  grossSaleRate: number;
  grossSaleValue: number;
  importBatchId: string | null;
  invoiceId: string | null;
  status: LotStatus;
  overrideReason: string | null;
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
