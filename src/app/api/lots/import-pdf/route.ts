import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
import { parseSarvaniText } from "../../../../lib/parsers/sarvani";
import { createLot, listParties, listMaterials, listRates, listQualityRules } from "../../../../lib/db";
import { supabase } from "../../../../lib/supabase/client";
import { adminSupabase } from "../../../../lib/supabase/admin";
import type { InwardLot } from "../../../../lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Normalise a product/material name for fuzzy matching: lowercase, collapse spaces. */
function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

export interface ProductGroup {
  product: string;
  count: number;
  grossMT: number;
  netMT: number;
  provisionalValue: number;
}

function r3(n: number) { return Math.round(n * 1000) / 1000; }

function addToGroup(
  map: Map<string, ProductGroup>,
  key: string,
  grossMT: number,
  netMT: number,
  rate: number,
) {
  const cur = map.get(key) ?? { product: key, count: 0, grossMT: 0, netMT: 0, provisionalValue: 0 };
  cur.count++;
  cur.grossMT = r3(cur.grossMT + grossMT);
  cur.netMT = r3(cur.netMT + netMT);
  cur.provisionalValue = Math.round(cur.provisionalValue + netMT * rate);
  map.set(key, cur);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    if (!file) return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await pdfParse(buffer);
    const { lots: parsed, reportDate, consignorName, errors } = parseSarvaniText(text);

    if (errors.length > 0 && parsed.length === 0) {
      return NextResponse.json({ error: errors[0] }, { status: 422 });
    }

    // Load reference data in parallel
    const [parties, materials, rates, qualityRules] = await Promise.all([
      listParties(),
      listMaterials(),
      listRates(),
      listQualityRules(),
    ]);

    // Fetch existing challan refs to skip true duplicates
    const { data: existingLots } = await supabase
      .from("inward_lots")
      .select("document_ref");
    const existingRefs = new Set((existingLots ?? []).map((r: Record<string, unknown>) => String(r.document_ref)));

    // Find Sarvani party (customer)
    const sarvani = parties.find((p) =>
      p.name.toLowerCase().includes("sarvani") && (p.partyType === "Customer" || p.partyType === "Both")
    ) ?? parties.find((p) => p.name.toLowerCase().includes("sarvani"));

    // Unique batch ref: date + ms suffix to prevent collision on re-import same date
    const dateStr = (reportDate ?? new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const batchId = `batch-${Date.now()}`;
    const batchRef = `SARV-${dateStr}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Upload PDF to Supabase Storage (best-effort — proceed even if storage fails)
    let sourcePdfUrl: string | null = null;
    try {
      // Ensure bucket exists (no-op if already exists)
      await adminSupabase.storage.createBucket("import-pdfs", { public: true });
    } catch { /* bucket may already exist */ }
    try {
      const pdfPath = `${batchId}/${file.name}`;
      const { error: upErr } = await adminSupabase.storage
        .from("import-pdfs")
        .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: false });
      if (!upErr) {
        sourcePdfUrl = adminSupabase.storage.from("import-pdfs").getPublicUrl(pdfPath).data.publicUrl;
      }
    } catch { /* storage not configured — continue without PDF link */ }

    // Insert import batch row (source_pdf_url column optional — migration may not be run yet)
    const batchRow: Record<string, unknown> = {
      id: batchId,
      batch_ref: batchRef,
      import_type: "PDF",
      business_model: "A",
      source_filename: file.name,
      report_date: reportDate ?? new Date().toISOString().slice(0, 10),
      party_name: consignorName ?? "Akshaya Agri",
      total_rows: parsed.length,
      mapped_rows: 0,
      status: "Pending",
      source_pdf_url: sourcePdfUrl,
    };
    const { error: batchErr } = await supabase.from("import_batches").insert(batchRow);
    if (batchErr?.message?.includes("source_pdf_url")) {
      // Column not yet added — retry without it
      delete batchRow.source_pdf_url;
      await supabase.from("import_batches").insert(batchRow);
    }

    // Per-product summary maps
    const parsedGroups = new Map<string, ProductGroup>();
    const importedGroups = new Map<string, ProductGroup>();
    const duplicateGroups = new Map<string, ProductGroup>();  // pre-existing challans
    const errorGroups = new Map<string, ProductGroup>();      // create failures

    // Create lots, skipping duplicates
    const created: InwardLot[] = [];
    const duplicates: string[] = [];      // challan already in DB
    const errorRows: { challan: string; reason: string }[] = [];  // create failures

    for (const p of parsed) {
      // Match material: normalise both sides so "PADDY HUSK" ↔ "PADDYHUSK" ↔ "Paddy Husk" all match
      const pNorm = norm(p.product);
      const material = materials.find((m) => {
        const mNorm = norm(m.name);
        return mNorm === pNorm || mNorm.startsWith(pNorm) || pNorm.startsWith(mNorm);
      });

      // Active GrossSale rate for material
      const rate = material
        ? rates.find((r) => r.materialId === material.id && r.rateType === "GrossSale" && !r.validTo) ??
          rates.find((r) => r.materialId === material.id && r.rateType === "GrossSale")
        : null;

      const grossSaleRate = rate?.rate ?? 0;
      const productKey = material?.name ?? p.product;

      // Always track parsed summary (using matched material name)
      addToGroup(parsedGroups, productKey, p.grossWeightMT, p.netWeightMT, grossSaleRate);

      // Skip if this challan already exists in DB
      if (existingRefs.has(p.challanNo)) {
        duplicates.push(p.challanNo);
        addToGroup(duplicateGroups, productKey, p.grossWeightMT, p.netWeightMT, grossSaleRate);
        continue;
      }

      // Best active quality rule for material
      const qualityRule = material
        ? qualityRules.find((r) => r.materialId === material.id && r.status === "Active") ??
          qualityRules.find((r) => r.materialId === material.id)
        : null;

      const netMT = p.netWeightMT;

      try {
        const lot = await createLot({
          documentRef: p.challanNo,
          businessModel: "A",
          lotDate: p.lotDate,
          materialId: material?.id ?? "",
          materialName: material?.name ?? p.product,
          customerId: sarvani?.id ?? "",
          customerName: sarvani?.name ?? "Sarvani Bio Fuels",
          supplierId: null,
          supplierName: null,
          farmerId: null,
          farmerName: null,
          vehicleNo: p.vehicleNo,
          grossWeight: p.grossWeightMT,
          tareWeight: p.tareWeightMT,
          netWeight: netMT,
          acceptedWeight: netMT,
          qualityReadings: {},
          qualityRuleId: qualityRule?.id ?? null,
          paramDeductions: {},
          cessAmount: 0,
          netPayableWeight: netMT,
          grossSaleRate,
          grossSaleValue: grossSaleRate * netMT,
          importBatchId: batchId,
          invoiceId: null,
          status: "Draft",
          overrideReason: null,
          akshayaMarginPerMT: 50,
          holdPenalty: 0,
          holdPenaltyNote: null,
        });
        created.push(lot);
        addToGroup(importedGroups, lot.materialName, lot.grossWeight, lot.netWeight, lot.grossSaleRate);
      } catch (e) {
        errorRows.push({ challan: p.challanNo, reason: String(e) });
        addToGroup(errorGroups, productKey, p.grossWeightMT, p.netWeightMT, grossSaleRate);
      }
    }

    const parsedSummary = {
      total: parsed.length,
      byProduct: Array.from(parsedGroups.values()),
    };
    const importedSummary = {
      total: created.length,
      byProduct: Array.from(importedGroups.values()),
    };
    const duplicateSummary = {
      total: duplicates.length,
      byProduct: Array.from(duplicateGroups.values()),
    };
    const errorSummary = {
      total: errorRows.length,
      byProduct: Array.from(errorGroups.values()),
      errors: errorRows,
    };

    return NextResponse.json({
      batchRef,
      batchId,
      reportDate,
      consignorName,
      sourcePdfUrl,
      created: created.length,
      skipped: duplicates.length,
      lots: created,
      parsedSummary,
      importedSummary,
      duplicateSummary,
      errorSummary,
      parseErrors: errors,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
