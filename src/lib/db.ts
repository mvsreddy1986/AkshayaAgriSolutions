import { supabase } from "./supabase/client";
import type {
  Material, Party, QualityRule, RateMaster, InwardLot,
  FarmerPayout, Invoice, Voucher, LedgerEntry, StockBatch,
} from "./types";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function num(v: unknown) { return Number(v ?? 0); }
function str(v: unknown) { return String(v ?? ""); }
function bool(v: unknown) { return Boolean(v); }
function arr(v: unknown): string[] { return Array.isArray(v) ? (v as string[]) : []; }
function nullable<T>(v: unknown, cast: (x: unknown) => T): T | null {
  return v == null ? null : cast(v);
}

// ─── MATERIALS ───────────────────────────────────────────────────────────────

function matFromDb(r: Record<string, unknown>): Material {
  return {
    id: str(r.id), name: str(r.name), hsn: str(r.hsn),
    uom: str(r.uom) as Material["uom"],
    gstRate: num(r.gst_rate),
    category: str(r.category) as Material["category"],
    defaultGrossSaleRate: num(r.default_gross_sale_rate),
    settlementMethod: str(r.settlement_method),
    qualityParams: arr(r.quality_params),
    status: str(r.status) as Material["status"],
  };
}

function matToDb(m: Partial<Material>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (m.id !== undefined) o.id = m.id;
  if (m.name !== undefined) o.name = m.name;
  if (m.hsn !== undefined) o.hsn = m.hsn;
  if (m.uom !== undefined) o.uom = m.uom;
  if (m.gstRate !== undefined) o.gst_rate = m.gstRate;
  if (m.category !== undefined) o.category = m.category;
  if (m.defaultGrossSaleRate !== undefined) o.default_gross_sale_rate = m.defaultGrossSaleRate;
  if (m.settlementMethod !== undefined) o.settlement_method = m.settlementMethod;
  if (m.qualityParams !== undefined) o.quality_params = m.qualityParams;
  if (m.status !== undefined) o.status = m.status;
  return o;
}

export async function listMaterials(): Promise<Material[]> {
  const { data, error } = await supabase.from("materials").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(matFromDb);
}

export async function createMaterial(m: Omit<Material, "id">): Promise<Material> {
  const row = matToDb({ ...m, id: `mat-${Date.now()}` });
  const { data, error } = await supabase.from("materials").insert(row).select().single();
  if (error) throw error;
  return matFromDb(data as Record<string, unknown>);
}

export async function updateMaterial(id: string, m: Partial<Material>): Promise<Material> {
  const { data, error } = await supabase.from("materials").update(matToDb(m)).eq("id", id).select().single();
  if (error) throw error;
  return matFromDb(data as Record<string, unknown>);
}

// ─── PARTIES ─────────────────────────────────────────────────────────────────

function partyFromDb(r: Record<string, unknown>): Party {
  return {
    id: str(r.id), name: str(r.name),
    partyType: str(r.party_type) as Party["partyType"],
    gstin: str(r.gstin), mobile: str(r.mobile), email: str(r.email),
    address: str(r.address), state: str(r.state),
    openingBalance: num(r.opening_balance),
    creditLimit: num(r.credit_limit), creditDays: num(r.credit_days),
    businessFlows: arr(r.business_flows) as Party["businessFlows"],
    taxProfile: str(r.tax_profile) as Party["taxProfile"],
    bankAccount: str(r.bank_account), ifsc: str(r.ifsc), bankName: str(r.bank_name),
    isFarmerReference: bool(r.is_farmer_reference),
    status: str(r.status) as Party["status"],
  };
}

function partyToDb(p: Partial<Party>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (p.id !== undefined) o.id = p.id;
  if (p.name !== undefined) o.name = p.name;
  if (p.partyType !== undefined) o.party_type = p.partyType;
  if (p.gstin !== undefined) o.gstin = p.gstin;
  if (p.mobile !== undefined) o.mobile = p.mobile;
  if (p.email !== undefined) o.email = p.email;
  if (p.address !== undefined) o.address = p.address;
  if (p.state !== undefined) o.state = p.state;
  if (p.openingBalance !== undefined) o.opening_balance = p.openingBalance;
  if (p.creditLimit !== undefined) o.credit_limit = p.creditLimit;
  if (p.creditDays !== undefined) o.credit_days = p.creditDays;
  if (p.businessFlows !== undefined) o.business_flows = p.businessFlows;
  if (p.taxProfile !== undefined) o.tax_profile = p.taxProfile;
  if (p.bankAccount !== undefined) o.bank_account = p.bankAccount;
  if (p.ifsc !== undefined) o.ifsc = p.ifsc;
  if (p.bankName !== undefined) o.bank_name = p.bankName;
  if (p.isFarmerReference !== undefined) o.is_farmer_reference = p.isFarmerReference;
  if (p.status !== undefined) o.status = p.status;
  return o;
}

export async function listParties(): Promise<Party[]> {
  const { data, error } = await supabase.from("parties").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(partyFromDb);
}

export async function createParty(p: Omit<Party, "id">): Promise<Party> {
  const row = partyToDb({ ...p, id: `pty-${Date.now()}` });
  const { data, error } = await supabase.from("parties").insert(row).select().single();
  if (error) throw error;
  return partyFromDb(data as Record<string, unknown>);
}

export async function updateParty(id: string, p: Partial<Party>): Promise<Party> {
  const { data, error } = await supabase.from("parties").update(partyToDb(p)).eq("id", id).select().single();
  if (error) throw error;
  return partyFromDb(data as Record<string, unknown>);
}

// ─── QUALITY RULES ───────────────────────────────────────────────────────────

function qrFromDb(r: Record<string, unknown>): QualityRule {
  return {
    id: str(r.id), materialId: str(r.material_id), materialName: str(r.material_name),
    validFrom: str(r.valid_from), validTo: nullable(r.valid_to, str),
    baseMoisture: num(r.base_moisture),
    moistureDeductionMethod: str(r.moisture_deduction_method) as QualityRule["moistureDeductionMethod"],
    moistureRatePerPct: num(r.moisture_rate_per_pct),
    fmDeductionMethod: str(r.fm_deduction_method) as QualityRule["fmDeductionMethod"],
    fmRatePerPct: num(r.fm_rate_per_pct),
    cessRate: num(r.cess_rate), allowedVariancePct: num(r.allowed_variance_pct),
    description: str(r.description), status: str(r.status) as QualityRule["status"],
  };
}

function qrToDb(q: Partial<QualityRule>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (q.id !== undefined) o.id = q.id;
  if (q.materialId !== undefined) o.material_id = q.materialId;
  if (q.materialName !== undefined) o.material_name = q.materialName;
  if (q.validFrom !== undefined) o.valid_from = q.validFrom;
  if (q.validTo !== undefined) o.valid_to = q.validTo || null;
  if (q.baseMoisture !== undefined) o.base_moisture = q.baseMoisture;
  if (q.moistureDeductionMethod !== undefined) o.moisture_deduction_method = q.moistureDeductionMethod;
  if (q.moistureRatePerPct !== undefined) o.moisture_rate_per_pct = q.moistureRatePerPct;
  if (q.fmDeductionMethod !== undefined) o.fm_deduction_method = q.fmDeductionMethod;
  if (q.fmRatePerPct !== undefined) o.fm_rate_per_pct = q.fmRatePerPct;
  if (q.cessRate !== undefined) o.cess_rate = q.cessRate;
  if (q.allowedVariancePct !== undefined) o.allowed_variance_pct = q.allowedVariancePct;
  if (q.description !== undefined) o.description = q.description;
  if (q.status !== undefined) o.status = q.status;
  return o;
}

export async function listQualityRules(): Promise<QualityRule[]> {
  const { data, error } = await supabase.from("quality_rules").select("*").order("valid_from", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(qrFromDb);
}

export async function createQualityRule(q: Omit<QualityRule, "id">): Promise<QualityRule> {
  const row = qrToDb({ ...q, id: `qr-${Date.now()}` });
  const { data, error } = await supabase.from("quality_rules").insert(row).select().single();
  if (error) throw error;
  return qrFromDb(data as Record<string, unknown>);
}

export async function updateQualityRule(id: string, q: Partial<QualityRule>): Promise<QualityRule> {
  const { data, error } = await supabase.from("quality_rules").update(qrToDb(q)).eq("id", id).select().single();
  if (error) throw error;
  return qrFromDb(data as Record<string, unknown>);
}

// ─── RATE MASTERS ────────────────────────────────────────────────────────────

function rateFromDb(r: Record<string, unknown>): RateMaster {
  return {
    id: str(r.id), materialId: str(r.material_id), materialName: str(r.material_name),
    partyId: nullable(r.party_id, str), partyName: nullable(r.party_name, str),
    rateType: str(r.rate_type) as RateMaster["rateType"],
    rate: num(r.rate), validFrom: str(r.valid_from),
    validTo: nullable(r.valid_to, str),
  };
}

function rateToDb(r: Partial<RateMaster>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (r.id !== undefined) o.id = r.id;
  if (r.materialId !== undefined) o.material_id = r.materialId;
  if (r.materialName !== undefined) o.material_name = r.materialName;
  if (r.partyId !== undefined) o.party_id = r.partyId ?? null;
  if (r.partyName !== undefined) o.party_name = r.partyName;
  if (r.rateType !== undefined) o.rate_type = r.rateType;
  if (r.rate !== undefined) o.rate = r.rate;
  if (r.validFrom !== undefined) o.valid_from = r.validFrom;
  if (r.validTo !== undefined) o.valid_to = r.validTo ?? null;
  return o;
}

export async function listRates(): Promise<RateMaster[]> {
  const { data, error } = await supabase.from("rate_masters").select("*").order("material_name");
  if (error) throw error;
  return (data ?? []).map(rateFromDb);
}

export async function createRate(r: Omit<RateMaster, "id">): Promise<RateMaster> {
  const row = rateToDb({ ...r, id: `rm-${Date.now()}` });
  const { data, error } = await supabase.from("rate_masters").insert(row).select().single();
  if (error) throw error;
  return rateFromDb(data as Record<string, unknown>);
}

export async function updateRate(id: string, r: Partial<RateMaster>): Promise<RateMaster> {
  const { data, error } = await supabase.from("rate_masters").update(rateToDb(r)).eq("id", id).select().single();
  if (error) throw error;
  return rateFromDb(data as Record<string, unknown>);
}

// ─── INWARD LOTS ─────────────────────────────────────────────────────────────

function lotFromDb(r: Record<string, unknown>): InwardLot {
  return {
    id: str(r.id), documentRef: str(r.document_ref),
    businessModel: str(r.business_model) as InwardLot["businessModel"],
    lotDate: str(r.lot_date), materialId: str(r.material_id), materialName: str(r.material_name),
    customerId: str(r.customer_id), customerName: str(r.customer_name),
    supplierId: nullable(r.supplier_id, str), supplierName: nullable(r.supplier_name, str),
    farmerId: nullable(r.farmer_id, str), farmerName: nullable(r.farmer_name, str),
    vehicleNo: str(r.vehicle_no),
    grossWeight: num(r.gross_weight), tareWeight: num(r.tare_weight),
    netWeight: num(r.net_weight), acceptedWeight: num(r.accepted_weight),
    moisturePct: num(r.moisture_pct), fmPct: num(r.fm_pct),
    qualityRuleId: nullable(r.quality_rule_id, str),
    moistureDeduction: num(r.moisture_deduction), fmDeduction: num(r.fm_deduction),
    cessAmount: num(r.cess_amount), netPayableWeight: num(r.net_payable_weight),
    grossSaleRate: num(r.gross_sale_rate), grossSaleValue: num(r.gross_sale_value),
    importBatchId: nullable(r.import_batch_id, str),
    invoiceId: nullable(r.invoice_id, str),
    status: str(r.status) as InwardLot["status"],
    overrideReason: nullable(r.override_reason, str),
  };
}

function lotToDb(l: Partial<InwardLot>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (l.id !== undefined) o.id = l.id;
  if (l.documentRef !== undefined) o.document_ref = l.documentRef;
  if (l.businessModel !== undefined) o.business_model = l.businessModel;
  if (l.lotDate !== undefined) o.lot_date = l.lotDate;
  if (l.materialId !== undefined) o.material_id = l.materialId;
  if (l.materialName !== undefined) o.material_name = l.materialName;
  if (l.customerId !== undefined) o.customer_id = l.customerId;
  if (l.customerName !== undefined) o.customer_name = l.customerName;
  if (l.supplierId !== undefined) o.supplier_id = l.supplierId ?? null;
  if (l.supplierName !== undefined) o.supplier_name = l.supplierName ?? null;
  if (l.farmerId !== undefined) o.farmer_id = l.farmerId ?? null;
  if (l.farmerName !== undefined) o.farmer_name = l.farmerName ?? null;
  if (l.vehicleNo !== undefined) o.vehicle_no = l.vehicleNo;
  if (l.grossWeight !== undefined) o.gross_weight = l.grossWeight;
  if (l.tareWeight !== undefined) o.tare_weight = l.tareWeight;
  if (l.netWeight !== undefined) o.net_weight = l.netWeight;
  if (l.acceptedWeight !== undefined) o.accepted_weight = l.acceptedWeight;
  if (l.moisturePct !== undefined) o.moisture_pct = l.moisturePct;
  if (l.fmPct !== undefined) o.fm_pct = l.fmPct;
  if (l.qualityRuleId !== undefined) o.quality_rule_id = l.qualityRuleId || null;
  if (l.moistureDeduction !== undefined) o.moisture_deduction = l.moistureDeduction;
  if (l.fmDeduction !== undefined) o.fm_deduction = l.fmDeduction;
  if (l.cessAmount !== undefined) o.cess_amount = l.cessAmount;
  if (l.netPayableWeight !== undefined) o.net_payable_weight = l.netPayableWeight;
  if (l.grossSaleRate !== undefined) o.gross_sale_rate = l.grossSaleRate;
  if (l.grossSaleValue !== undefined) o.gross_sale_value = l.grossSaleValue;
  if (l.importBatchId !== undefined) o.import_batch_id = l.importBatchId ?? null;
  if (l.invoiceId !== undefined) o.invoice_id = l.invoiceId ?? null;
  if (l.status !== undefined) o.status = l.status;
  if (l.overrideReason !== undefined) o.override_reason = l.overrideReason ?? null;
  return o;
}

export async function listLots(model?: string): Promise<InwardLot[]> {
  let q = supabase.from("inward_lots").select("*").order("lot_date", { ascending: false });
  if (model) q = q.eq("business_model", model);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(lotFromDb);
}

export async function createLot(l: Omit<InwardLot, "id">): Promise<InwardLot> {
  const row = lotToDb({ ...l, id: `lot-${Date.now()}` });
  const { data, error } = await supabase.from("inward_lots").insert(row).select().single();
  if (error) throw error;
  return lotFromDb(data as Record<string, unknown>);
}

export async function updateLot(id: string, l: Partial<InwardLot>): Promise<InwardLot> {
  const { data, error } = await supabase.from("inward_lots").update(lotToDb(l)).eq("id", id).select().single();
  if (error) throw error;
  return lotFromDb(data as Record<string, unknown>);
}

// ─── FARMER PAYOUTS ──────────────────────────────────────────────────────────

function payoutFromDb(r: Record<string, unknown>): FarmerPayout {
  return {
    id: str(r.id), batchRef: str(r.batch_ref),
    farmerId: str(r.farmer_id), farmerName: str(r.farmer_name),
    inwardLotId: nullable(r.inward_lot_id, str), documentRef: str(r.document_ref),
    payoutDate: str(r.payout_date), materialName: str(r.material_name),
    quantity: num(r.quantity), rate: num(r.rate),
    grossAmount: num(r.gross_amount), deductions: num(r.deductions),
    netAmount: num(r.net_amount), paymentMode: str(r.payment_mode),
    paymentRef: str(r.payment_ref),
    paymentStatus: str(r.payment_status) as FarmerPayout["paymentStatus"],
  };
}

function payoutToDb(p: Partial<FarmerPayout>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (p.id !== undefined) o.id = p.id;
  if (p.batchRef !== undefined) o.batch_ref = p.batchRef;
  if (p.farmerId !== undefined) o.farmer_id = p.farmerId;
  if (p.farmerName !== undefined) o.farmer_name = p.farmerName;
  if (p.inwardLotId !== undefined) o.inward_lot_id = p.inwardLotId || null;
  if (p.documentRef !== undefined) o.document_ref = p.documentRef;
  if (p.payoutDate !== undefined) o.payout_date = p.payoutDate;
  if (p.materialName !== undefined) o.material_name = p.materialName;
  if (p.quantity !== undefined) o.quantity = p.quantity;
  if (p.rate !== undefined) o.rate = p.rate;
  if (p.grossAmount !== undefined) o.gross_amount = p.grossAmount;
  if (p.deductions !== undefined) o.deductions = p.deductions;
  if (p.netAmount !== undefined) o.net_amount = p.netAmount;
  if (p.paymentMode !== undefined) o.payment_mode = p.paymentMode;
  if (p.paymentRef !== undefined) o.payment_ref = p.paymentRef;
  if (p.paymentStatus !== undefined) o.payment_status = p.paymentStatus;
  return o;
}

export async function listPayouts(): Promise<FarmerPayout[]> {
  const { data, error } = await supabase.from("farmer_payouts").select("*").order("payout_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(payoutFromDb);
}

export async function createPayout(p: Omit<FarmerPayout, "id">): Promise<FarmerPayout> {
  const row = payoutToDb({ ...p, id: `fp-${Date.now()}` });
  const { data, error } = await supabase.from("farmer_payouts").insert(row).select().single();
  if (error) throw error;
  return payoutFromDb(data as Record<string, unknown>);
}

export async function updatePayout(id: string, p: Partial<FarmerPayout>): Promise<FarmerPayout> {
  const { data, error } = await supabase.from("farmer_payouts").update(payoutToDb(p)).eq("id", id).select().single();
  if (error) throw error;
  return payoutFromDb(data as Record<string, unknown>);
}

// ─── INVOICES ────────────────────────────────────────────────────────────────

function invFromDb(r: Record<string, unknown>): Invoice {
  return {
    id: str(r.id), invoiceNo: str(r.invoice_no),
    invoiceType: str(r.invoice_type) as Invoice["invoiceType"],
    businessModel: str(r.business_model) as Invoice["businessModel"],
    invoiceDate: str(r.invoice_date), dueDate: str(r.due_date),
    partyId: str(r.party_id), partyName: str(r.party_name),
    materialId: str(r.material_id), materialName: str(r.material_name),
    quantity: num(r.quantity), uom: str(r.uom) as Invoice["uom"],
    grossRate: num(r.gross_rate), grossValue: num(r.gross_value),
    taxableValue: num(r.taxable_value),
    cgstRate: num(r.cgst_rate), sgstRate: num(r.sgst_rate), igstRate: num(r.igst_rate),
    cgstAmount: num(r.cgst_amount), sgstAmount: num(r.sgst_amount), igstAmount: num(r.igst_amount),
    totalTax: num(r.total_tax), totalValue: num(r.total_value),
    amountPaid: num(r.amount_paid), amountDue: num(r.amount_due),
    linkedLotIds: arr(r.linked_lot_ids),
    status: str(r.status) as Invoice["status"],
    cancelledReason: nullable(r.cancelled_reason, str),
  };
}

function invToDb(inv: Partial<Invoice>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (inv.id !== undefined) o.id = inv.id;
  if (inv.invoiceNo !== undefined) o.invoice_no = inv.invoiceNo;
  if (inv.invoiceType !== undefined) o.invoice_type = inv.invoiceType;
  if (inv.businessModel !== undefined) o.business_model = inv.businessModel;
  if (inv.invoiceDate !== undefined) o.invoice_date = inv.invoiceDate;
  if (inv.dueDate !== undefined) o.due_date = inv.dueDate;
  if (inv.partyId !== undefined) o.party_id = inv.partyId;
  if (inv.partyName !== undefined) o.party_name = inv.partyName;
  if (inv.materialId !== undefined) o.material_id = inv.materialId || null;
  if (inv.materialName !== undefined) o.material_name = inv.materialName;
  if (inv.quantity !== undefined) o.quantity = inv.quantity;
  if (inv.uom !== undefined) o.uom = inv.uom;
  if (inv.grossRate !== undefined) o.gross_rate = inv.grossRate;
  if (inv.grossValue !== undefined) o.gross_value = inv.grossValue;
  if (inv.taxableValue !== undefined) o.taxable_value = inv.taxableValue;
  if (inv.cgstRate !== undefined) o.cgst_rate = inv.cgstRate;
  if (inv.sgstRate !== undefined) o.sgst_rate = inv.sgstRate;
  if (inv.igstRate !== undefined) o.igst_rate = inv.igstRate;
  if (inv.cgstAmount !== undefined) o.cgst_amount = inv.cgstAmount;
  if (inv.sgstAmount !== undefined) o.sgst_amount = inv.sgstAmount;
  if (inv.igstAmount !== undefined) o.igst_amount = inv.igstAmount;
  if (inv.totalTax !== undefined) o.total_tax = inv.totalTax;
  if (inv.totalValue !== undefined) o.total_value = inv.totalValue;
  if (inv.amountPaid !== undefined) o.amount_paid = inv.amountPaid;
  if (inv.amountDue !== undefined) o.amount_due = inv.amountDue;
  if (inv.linkedLotIds !== undefined) o.linked_lot_ids = inv.linkedLotIds;
  if (inv.status !== undefined) o.status = inv.status;
  if (inv.cancelledReason !== undefined) o.cancelled_reason = inv.cancelledReason ?? null;
  return o;
}

export async function listInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from("invoices").select("*").order("invoice_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(invFromDb);
}

export async function createInvoice(inv: Omit<Invoice, "id">): Promise<Invoice> {
  const row = invToDb({ ...inv, id: `inv-${Date.now()}` });
  const { data, error } = await supabase.from("invoices").insert(row).select().single();
  if (error) throw error;
  return invFromDb(data as Record<string, unknown>);
}

export async function updateInvoice(id: string, inv: Partial<Invoice>): Promise<Invoice> {
  const { data, error } = await supabase.from("invoices").update(invToDb(inv)).eq("id", id).select().single();
  if (error) throw error;
  return invFromDb(data as Record<string, unknown>);
}

// ─── VOUCHERS ────────────────────────────────────────────────────────────────

function voucherFromDb(r: Record<string, unknown>): Voucher {
  return {
    id: str(r.id), voucherNo: str(r.voucher_no),
    voucherType: str(r.voucher_type) as Voucher["voucherType"],
    voucherDate: str(r.voucher_date),
    partyId: str(r.party_id), partyName: str(r.party_name),
    amount: num(r.amount), paymentMode: str(r.payment_mode),
    bankRef: str(r.bank_ref), narration: str(r.narration),
    status: str(r.status) as Voucher["status"],
    allocatedTo: arr(r.allocated_to),
  };
}

function voucherToDb(v: Partial<Voucher>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (v.id !== undefined) o.id = v.id;
  if (v.voucherNo !== undefined) o.voucher_no = v.voucherNo;
  if (v.voucherType !== undefined) o.voucher_type = v.voucherType;
  if (v.voucherDate !== undefined) o.voucher_date = v.voucherDate;
  if (v.partyId !== undefined) o.party_id = v.partyId;
  if (v.partyName !== undefined) o.party_name = v.partyName;
  if (v.amount !== undefined) o.amount = v.amount;
  if (v.paymentMode !== undefined) o.payment_mode = v.paymentMode;
  if (v.bankRef !== undefined) o.bank_ref = v.bankRef;
  if (v.narration !== undefined) o.narration = v.narration;
  if (v.status !== undefined) o.status = v.status;
  if (v.allocatedTo !== undefined) o.allocated_to = v.allocatedTo;
  return o;
}

export async function listVouchers(type?: string): Promise<Voucher[]> {
  let q = supabase.from("vouchers").select("*").order("voucher_date", { ascending: false });
  if (type) q = q.eq("voucher_type", type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(voucherFromDb);
}

export async function createVoucher(v: Omit<Voucher, "id">): Promise<Voucher> {
  const row = voucherToDb({ ...v, id: `vchr-${Date.now()}` });
  const { data, error } = await supabase.from("vouchers").insert(row).select().single();
  if (error) throw error;
  return voucherFromDb(data as Record<string, unknown>);
}

export async function updateVoucher(id: string, v: Partial<Voucher>): Promise<Voucher> {
  const { data, error } = await supabase.from("vouchers").update(voucherToDb(v)).eq("id", id).select().single();
  if (error) throw error;
  return voucherFromDb(data as Record<string, unknown>);
}

// ─── LEDGER ENTRIES ──────────────────────────────────────────────────────────

function ledgerFromDb(r: Record<string, unknown>): LedgerEntry {
  return {
    id: str(r.id), entryDate: str(r.entry_date),
    accountCode: str(r.account_code), accountName: str(r.account_name),
    partyId: nullable(r.party_id, str), partyName: nullable(r.party_name, str),
    debit: num(r.debit), credit: num(r.credit), runningBalance: num(r.running_balance),
    narration: str(r.narration),
    sourceType: str(r.source_type) as LedgerEntry["sourceType"],
    sourceId: str(r.source_id), sourceRef: str(r.source_ref),
  };
}

export async function listLedger(partyId?: string, accountCode?: string): Promise<LedgerEntry[]> {
  let q = supabase.from("ledger_entries").select("*").order("entry_date", { ascending: false });
  if (partyId) q = q.eq("party_id", partyId);
  if (accountCode) q = q.eq("account_code", accountCode);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(ledgerFromDb);
}

export async function createLedgerEntries(entries: Omit<LedgerEntry, "id">[]): Promise<LedgerEntry[]> {
  const rows = entries.map((e, i) => ({
    id: `le-${Date.now()}-${i}`,
    entry_date: e.entryDate, account_code: e.accountCode, account_name: e.accountName,
    party_id: e.partyId ?? null, party_name: e.partyName ?? null,
    debit: e.debit, credit: e.credit, running_balance: e.runningBalance,
    narration: e.narration, source_type: e.sourceType, source_id: e.sourceId, source_ref: e.sourceRef,
  }));
  const { data, error } = await supabase.from("ledger_entries").insert(rows).select();
  if (error) throw error;
  return (data ?? []).map(ledgerFromDb);
}

// ─── STOCK BATCHES ───────────────────────────────────────────────────────────

function stockFromDb(r: Record<string, unknown>): StockBatch {
  return {
    id: str(r.id), batchRef: str(r.batch_ref),
    materialId: str(r.material_id), materialName: str(r.material_name),
    purchaseDate: str(r.purchase_date),
    openingQty: num(r.opening_qty), soldQty: num(r.sold_qty), availableQty: num(r.available_qty),
    purchaseRate: num(r.purchase_rate),
    qualityStatus: str(r.quality_status) as StockBatch["qualityStatus"],
    qualityNotes: str(r.quality_notes),
  };
}

function stockToDb(s: Partial<StockBatch>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (s.id !== undefined) o.id = s.id;
  if (s.batchRef !== undefined) o.batch_ref = s.batchRef;
  if (s.materialId !== undefined) o.material_id = s.materialId;
  if (s.materialName !== undefined) o.material_name = s.materialName;
  if (s.purchaseDate !== undefined) o.purchase_date = s.purchaseDate;
  if (s.openingQty !== undefined) o.opening_qty = s.openingQty;
  if (s.soldQty !== undefined) o.sold_qty = s.soldQty;
  if (s.availableQty !== undefined) o.available_qty = s.availableQty;
  if (s.purchaseRate !== undefined) o.purchase_rate = s.purchaseRate;
  if (s.qualityStatus !== undefined) o.quality_status = s.qualityStatus;
  if (s.qualityNotes !== undefined) o.quality_notes = s.qualityNotes;
  return o;
}

export async function listStock(): Promise<StockBatch[]> {
  const { data, error } = await supabase.from("stock_batches").select("*").order("purchase_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(stockFromDb);
}

export async function getStock(id: string): Promise<StockBatch> {
  const { data, error } = await supabase.from("stock_batches").select("*").eq("id", id).single();
  if (error) throw error;
  return stockFromDb(data as Record<string, unknown>);
}

export async function createStock(s: Omit<StockBatch, "id">): Promise<StockBatch> {
  const row = stockToDb({ ...s, id: `stk-${Date.now()}` });
  const { data, error } = await supabase.from("stock_batches").insert(row).select().single();
  if (error) throw error;
  return stockFromDb(data as Record<string, unknown>);
}

export async function updateStock(id: string, s: Partial<StockBatch>): Promise<StockBatch> {
  const { data, error } = await supabase.from("stock_batches").update(stockToDb(s)).eq("id", id).select().single();
  if (error) throw error;
  return stockFromDb(data as Record<string, unknown>);
}

// ─── BULK UPSERT (for seeding) ────────────────────────────────────────────────

export async function upsertMaterials(items: Material[]) {
  return supabase.from("materials").upsert(items.map(matToDb), { onConflict: "id" });
}
export async function upsertParties(items: Party[]) {
  return supabase.from("parties").upsert(items.map(partyToDb), { onConflict: "id" });
}
export async function upsertQualityRules(items: QualityRule[]) {
  return supabase.from("quality_rules").upsert(items.map(qrToDb), { onConflict: "id" });
}
export async function upsertRates(items: RateMaster[]) {
  return supabase.from("rate_masters").upsert(items.map(rateToDb), { onConflict: "id" });
}
export async function upsertLots(items: InwardLot[]) {
  return supabase.from("inward_lots").upsert(items.map(lotToDb), { onConflict: "id" });
}
export async function upsertPayouts(items: FarmerPayout[]) {
  return supabase.from("farmer_payouts").upsert(items.map(payoutToDb), { onConflict: "id" });
}
export async function upsertInvoices(items: Invoice[]) {
  return supabase.from("invoices").upsert(items.map(invToDb), { onConflict: "id" });
}
export async function upsertVouchers(items: Voucher[]) {
  return supabase.from("vouchers").upsert(items.map(voucherToDb), { onConflict: "id" });
}
export async function upsertStock(items: StockBatch[]) {
  return supabase.from("stock_batches").upsert(items.map(stockToDb), { onConflict: "id" });
}
