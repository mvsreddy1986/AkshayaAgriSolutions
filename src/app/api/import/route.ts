import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabase/client";

type ImportType = "parties" | "materials" | "inward_lots" | "invoices";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function id(prefix: string, i: number) {
  return `${prefix}-${String(i).padStart(4, "0")}`;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    const candidate = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (isNaN(new Date(candidate).getTime())) return null;
    return candidate;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (isNaN(new Date(s).getTime())) return null;
    return s;
  }
  return null;
}

function normalise(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[slug(k)] = v;
    }
    return out;
  });
}

async function importParties(rows: Record<string, unknown>[]) {
  const records = rows.map((r, i) => ({
    id: id("pty", i + 1000),
    name: String(r["name"] ?? r["party_name"] ?? "").trim(),
    party_type: String(r["party_type"] ?? r["type"] ?? "Customer").trim(),
    gstin: String(r["gstin"] ?? r["gst"] ?? "").trim(),
    mobile: String(r["mobile"] ?? r["phone"] ?? "").trim(),
    email: String(r["email"] ?? "").trim(),
    address: String(r["address"] ?? "").trim(),
    state: String(r["state"] ?? "Andhra Pradesh").trim(),
    opening_balance: Number(r["opening_balance"] ?? r["opening"] ?? 0),
    credit_limit: Number(r["credit_limit"] ?? r["limit"] ?? 0),
    credit_days: Number(r["credit_days"] ?? 0),
    business_flows: String(r["business_flows"] ?? r["models"] ?? "A").split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean),
    tax_profile: String(r["tax_profile"] ?? (r["gstin"] ? "Registered" : "Unregistered")).trim(),
    bank_account: String(r["bank_account"] ?? r["account"] ?? "").trim(),
    ifsc: String(r["ifsc"] ?? "").trim(),
    bank_name: String(r["bank_name"] ?? r["bank"] ?? "").trim(),
    is_farmer_reference: String(r["party_type"] ?? "").toLowerCase().includes("farmer"),
    status: "Active",
  })).filter((p) => p.name);

  const { error } = await supabase.from("parties").upsert(records, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return records.length;
}

async function importMaterials(rows: Record<string, unknown>[]) {
  const records = rows.map((r, i) => ({
    id: id("mat", i + 1000),
    name: String(r["name"] ?? r["material"] ?? r["material_name"] ?? "").trim(),
    hsn: String(r["hsn"] ?? r["hsn_code"] ?? "").trim(),
    uom: String(r["uom"] ?? r["unit"] ?? "MT").trim(),
    gst_rate: Number(r["gst_rate"] ?? r["gst"] ?? 0),
    category: String(r["category"] ?? "Grain").trim(),
    default_gross_sale_rate: Number(r["default_gross_sale_rate"] ?? r["rate"] ?? r["default_rate"] ?? 0),
    settlement_method: String(r["settlement_method"] ?? r["settlement"] ?? "Accepted weight").trim(),
    quality_params: String(r["quality_params"] ?? r["quality"] ?? "Moisture %, Foreign matter %").split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean),
    status: String(r["status"] ?? "Active").trim(),
  })).filter((m) => m.name);

  const { error } = await supabase.from("materials").upsert(records, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return records.length;
}

async function importInwardLots(rows: Record<string, unknown>[]) {
  const records = rows.map((r, i) => ({
    id: id("lot", i + 1000),
    document_ref: String(r["document_ref"] ?? r["doc_ref"] ?? r["reference"] ?? r["doc"] ?? `DR-IMP-${i + 1}`).trim(),
    business_model: String(r["business_model"] ?? r["model"] ?? "A").trim(),
    lot_date: parseDate(r["lot_date"] ?? r["date"] ?? r["report_date"]) ?? new Date().toISOString().slice(0, 10),
    material_name: String(r["material_name"] ?? r["material"] ?? "Maize").trim(),
    customer_name: String(r["customer_name"] ?? r["customer"] ?? "Sarvani Biofuels Pvt Ltd").trim(),
    supplier_name: String(r["supplier_name"] ?? r["supplier"] ?? "").trim() || null,
    farmer_name: String(r["farmer_name"] ?? r["farmer"] ?? "").trim() || null,
    vehicle_no: String(r["vehicle_no"] ?? r["vehicle"] ?? r["veh_no"] ?? "").trim(),
    gross_weight: Number(r["gross_weight"] ?? r["gross"] ?? 0),
    tare_weight: Number(r["tare_weight"] ?? r["tare"] ?? 0),
    net_weight: Number(r["net_weight"] ?? r["net"] ?? 0),
    accepted_weight: Number(r["accepted_weight"] ?? r["accepted"] ?? r["net_weight"] ?? r["net"] ?? 0),
    moisture_pct: Number(r["moisture_pct"] ?? r["moisture"] ?? 0),
    fm_pct: Number(r["fm_pct"] ?? r["fm"] ?? r["foreign_matter"] ?? 0),
    moisture_deduction: Number(r["moisture_deduction"] ?? 0),
    fm_deduction: Number(r["fm_deduction"] ?? 0),
    cess_amount: Number(r["cess_amount"] ?? r["cess"] ?? 0),
    net_payable_weight: Number(r["net_payable_weight"] ?? r["net_payable"] ?? r["accepted_weight"] ?? r["accepted"] ?? 0),
    gross_sale_rate: Number(r["gross_sale_rate"] ?? r["rate"] ?? 0),
    gross_sale_value: Number(r["gross_sale_value"] ?? r["value"] ?? 0),
    status: String(r["status"] ?? "Draft").trim(),
    override_reason: null,
  })).filter((l) => l.vehicle_no || l.document_ref);

  const { error } = await supabase.from("inward_lots").upsert(records, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return records.length;
}

async function importInvoices(rows: Record<string, unknown>[]) {
  const records = rows.map((r, i) => ({
    id: id("inv", i + 1000),
    invoice_no: String(r["invoice_no"] ?? r["invoice"] ?? r["no"] ?? `AAS-IMP-${i + 1}`).trim(),
    invoice_type: String(r["invoice_type"] ?? r["type"] ?? "Sales").trim(),
    business_model: String(r["business_model"] ?? r["model"] ?? "A").trim(),
    invoice_date: parseDate(r["invoice_date"] ?? r["date"]) ?? new Date().toISOString().slice(0, 10),
    due_date: parseDate(r["due_date"] ?? r["due"]) ?? new Date().toISOString().slice(0, 10),
    party_name: String(r["party_name"] ?? r["party"] ?? r["customer"] ?? "").trim(),
    material_name: String(r["material_name"] ?? r["material"] ?? "Maize").trim(),
    quantity: Number(r["quantity"] ?? r["qty"] ?? 0),
    uom: String(r["uom"] ?? r["unit"] ?? "MT").trim(),
    gross_rate: Number(r["gross_rate"] ?? r["rate"] ?? 0),
    gross_value: Number(r["gross_value"] ?? r["value"] ?? 0),
    taxable_value: Number(r["taxable_value"] ?? r["taxable"] ?? r["gross_value"] ?? r["value"] ?? 0),
    cgst_rate: Number(r["cgst_rate"] ?? r["cgst"] ?? 0),
    sgst_rate: Number(r["sgst_rate"] ?? r["sgst"] ?? 0),
    igst_rate: Number(r["igst_rate"] ?? r["igst"] ?? 0),
    cgst_amount: Number(r["cgst_amount"] ?? 0),
    sgst_amount: Number(r["sgst_amount"] ?? 0),
    igst_amount: Number(r["igst_amount"] ?? 0),
    total_tax: Number(r["total_tax"] ?? r["tax"] ?? 0),
    total_value: Number(r["total_value"] ?? r["total"] ?? r["gross_value"] ?? r["value"] ?? 0),
    amount_paid: Number(r["amount_paid"] ?? r["paid"] ?? 0),
    amount_due: Number(r["amount_due"] ?? r["due_amount"] ?? r["total_value"] ?? r["total"] ?? 0),
    linked_lot_ids: [],
    status: String(r["status"] ?? "Draft").trim(),
    cancelled_reason: null,
  })).filter((inv) => inv.party_name);

  const { error } = await supabase.from("invoices").upsert(records, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return records.length;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const importType = formData.get("type") as ImportType | null;

    if (!file || !importType) {
      return NextResponse.json({ error: "Missing file or type" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (raw.length === 0) {
      return NextResponse.json({ error: "No rows found in file" }, { status: 400 });
    }

    const rows = normalise(raw);
    let count = 0;

    if (importType === "parties")     count = await importParties(rows);
    else if (importType === "materials")  count = await importMaterials(rows);
    else if (importType === "inward_lots") count = await importInwardLots(rows);
    else if (importType === "invoices")   count = await importInvoices(rows);
    else return NextResponse.json({ error: "Unknown import type" }, { status: 400 });

    return NextResponse.json({ success: true, count, type: importType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
