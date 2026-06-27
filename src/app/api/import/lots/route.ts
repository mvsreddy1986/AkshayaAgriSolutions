import { NextRequest, NextResponse } from "next/server";
import {
  createLot, updateLot, createLedgerEntries, createPayout,
  listParties, listMaterials,
} from "../../../../lib/db";
import { supabase } from "../../../../lib/supabase/client";
import type { LedgerEntry } from "../../../../lib/types";

export const dynamic = "force-dynamic";

function r2(n: number) { return Math.round(n * 100) / 100; }
function errMsg(e: unknown) { return e instanceof Error ? e.message : String(e); }

interface LotRow {
  po_number: string;
  unloading_date: string;     // YYYY-MM-DD
  vehicle_no: string;
  supplier: string;           // supplier company name (matched to parties)
  net_wt_kg: string;          // kg — converted to MT for storage (÷1000)
  po_rate_per_kg: string;     // ₹/kg charged to Sarvani — stored as ₹/MT (×1000)
  supplier_rate_per_kg: string; // ₹/kg paid to supplier
  cess_paid_rs: string;       // ₹ cess already paid at gate (Dr 5101 / Cr 1100)
  balance_cess_rs: string;    // ₹ cess balance deducted from supplier (reduces 2101)
  moisture_pct: string;       // % moisture reading
  mc_deduction_rs: string;    // ₹ moisture content deduction from supplier
  status: string;             // Settled / Approved / Draft
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: LotRow[]  = body.rows ?? [];
    const batchRef        = body.batchRef ?? `IMP-${Date.now()}`;

    const [parties, materials] = await Promise.all([listParties(), listMaterials()]);
    const partyByName  = new Map(parties.map((p) => [p.name.toLowerCase().trim(), p]));
    const matByName    = new Map(materials.map((m) => [m.name.toLowerCase().trim(), m]));

    // Customer is always Sarvani Biofuels for Model A
    const sarvani = parties.find((p) =>
      p.name.toLowerCase().includes("sarvani") || p.partyType === "Customer"
    );

    // Default material — pick first active material if not specified
    const defaultMat = materials.find((m) => m.status === "Active") ?? materials[0];

    const created: string[] = [];
    const errors:  string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i];
      const rowNum = i + 2; // header is row 1

      try {
        // ── Parse and validate ────────────────────────────────────────────────
        const poNo    = row.po_number?.trim();
        const lotDate = row.unloading_date?.trim();
        const netWtKg = parseFloat(row.net_wt_kg)          || 0;
        const poRate  = parseFloat(row.po_rate_per_kg)      || 0; // ₹/kg
        const supRate = parseFloat(row.supplier_rate_per_kg)|| 0; // ₹/kg
        const cessPd  = parseFloat(row.cess_paid_rs)        || 0; // ₹
        const cessBal = parseFloat(row.balance_cess_rs)     || 0; // ₹
        const mcDed   = parseFloat(row.mc_deduction_rs)     || 0; // ₹
        const moistPct= parseFloat(row.moisture_pct)        || 0;
        const lotStatus = (row.status?.trim() || "Settled") as
          "Draft" | "Mapped" | "QualityHold" | "Approved" | "Settled" | "Invoiced";

        if (!poNo) { errors.push(`Row ${rowNum}: po_number is required`); continue; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(lotDate)) {
          errors.push(`Row ${rowNum} (${poNo}): unloading_date must be YYYY-MM-DD`); continue;
        }
        if (netWtKg <= 0) { errors.push(`Row ${rowNum} (${poNo}): net_wt_kg must be > 0`); continue; }
        if (poRate  <= 0) { errors.push(`Row ${rowNum} (${poNo}): po_rate_per_kg must be > 0`); continue; }
        if (supRate <= 0) { errors.push(`Row ${rowNum} (${poNo}): supplier_rate_per_kg must be > 0`); continue; }

        // ── Idempotency: skip if PO number already exists ─────────────────────
        const { count: existing } = await supabase
          .from("inward_lots")
          .select("id", { count: "exact", head: true })
          .eq("document_ref", poNo);
        if ((existing ?? 0) > 0) {
          errors.push(`Row ${rowNum}: PO "${poNo}" already exists — skipped`);
          continue;
        }

        // ── Unit conversions (user inputs kg / ₹per-kg; ERP stores MT / ₹per-MT) ──
        const netWtMT       = r2(netWtKg / 1000);          // MT
        const grossSaleRate = r2(poRate  * 1000);           // ₹/MT
        const supplierRate  = r2(supRate * 1000);           // ₹/MT (for reference)

        // ── Financial calculations ─────────────────────────────────────────────
        // grossSaleValue = what Sarvani owes Akshaya
        const grossSaleValue = r2(netWtMT * grossSaleRate);
        // supplierGross (D) = netWtKg × supRate = what supplier earns before deductions
        const supplierGross  = r2(netWtKg * supRate);
        // supplierNetPayable (G = D − E − F) = what Akshaya actually pays
        const supplierNetPayable = r2(supplierGross - cessBal - mcDed);
        // akshaya margin = revenue − supplier net payable (includes rate spread + deductions kept)
        const akshayaMargin = r2(grossSaleValue - supplierNetPayable);
        // For akshayaMarginPerMT field (₹/MT) — derived from total margin / MT
        const akshayaMarginPerMT = netWtMT > 0 ? r2(akshayaMargin / netWtMT) : 50;

        // ── Find matching parties ─────────────────────────────────────────────
        const supplier  = partyByName.get(row.supplier?.toLowerCase().trim() ?? "");
        const material  = matByName.get("maize") ?? defaultMat; // default to first active material

        // ── Create lot ────────────────────────────────────────────────────────
        const lot = await createLot({
          documentRef:    poNo,
          businessModel:  "A",
          lotDate,
          materialId:     material?.id ?? "",
          materialName:   material?.name ?? "Maize",
          customerId:     sarvani?.id ?? "",
          customerName:   sarvani?.name ?? "Sarvani Biofuels",
          supplierId:     supplier?.id ?? null,
          supplierName:   row.supplier?.trim() || null,
          farmerId:       null,
          farmerName:     null,
          vehicleNo:      row.vehicle_no?.trim() ?? "",
          grossWeight:    netWtMT,   // gross = net for historical (tare from PDF, not available)
          tareWeight:     0,
          netWeight:      netWtMT,
          acceptedWeight: netWtMT,
          qualityReadings: { moisture_pct: moistPct },
          qualityRuleId:  null,
          paramDeductions: {},
          cessAmount:     r2(cessPd + cessBal), // total cess = paid + balance
          netPayableWeight: netWtMT,
          grossSaleRate,
          grossSaleValue,
          importBatchId:  batchRef,
          invoiceId:      null,
          status:         "Draft",   // always start Draft; update after ledger entries
          overrideReason: `Historical import — gross/tare from PDF; MC ded ₹${mcDed}`,
          akshayaMarginPerMT,
          holdPenalty:    0,
          holdPenaltyNote: null,
        });

        // ── Post ledger entries for settled/invoiced lots ─────────────────────
        //
        // Customer side:
        //   Dr 1201 Sarvani Receivable    = grossSaleValue  (what Sarvani owes)
        //   Cr 3100 Sales — Commodity     = grossSaleValue
        //
        // Supplier side (Model A — pass-through trading):
        //   Dr 5001 Procurement           = grossSaleValue  (procurement basis = revenue)
        //   Cr 2101 Supplier Payable       = supplierNetPayable (G = D − E − F)
        //   Cr 3200 Akshaya Trading Margin = grossSaleValue − supplierNetPayable
        //
        // Gate cess (already paid cash):
        //   Dr 5101 Market Cess  = cessPaid
        //   Cr 1100 Bank / Cash  = cessPaid
        //
        // Double-entry balance check:
        //   Dr: 1201(R) + 5001(R) + 5101(C) = 2R + C
        //   Cr: 3100(R) + 2101(G) + 3200(R−G) + 1100(C) = R + G + R − G + C = 2R + C ✓

        if (lotStatus === "Settled" || lotStatus === "Invoiced" || lotStatus === "Approved") {
          const narr = `Hist. import | ${poNo} | ${lotDate} · ${netWtMT.toFixed(3)} MT @ ₹${Math.round(grossSaleRate).toLocaleString("en-IN")}/MT`;
          const ref  = `SETTLE-${poNo}`;

          const mk = (
            accountCode: string, accountName: string,
            debit: number, credit: number,
            partyId: string | null = null, partyName: string | null = null,
          ): Omit<LedgerEntry, "id"> => ({
            entryDate: lotDate, accountCode, accountName,
            partyId, partyName, debit, credit, runningBalance: 0,
            narration: narr,
            sourceType: "Settlement", sourceId: lot.id, sourceRef: ref,
          });

          const entries: Omit<LedgerEntry, "id">[] = [
            // Customer side
            mk("1201", "Sarvani Biofuels Receivable", grossSaleValue, 0, sarvani?.id ?? null, sarvani?.name ?? "Sarvani Biofuels"),
            mk("3100", "Sales — Commodity",            0, grossSaleValue),
            // Supplier side
            mk("5001", "Procurement — Commodity",      grossSaleValue, 0, supplier?.id ?? null, row.supplier?.trim() ?? null),
            mk("2101", "Supplier Payable",             0, supplierNetPayable, supplier?.id ?? null, row.supplier?.trim() ?? null),
            mk("3200", "Akshaya Trading Margin",       0, akshayaMargin),
          ];

          // Gate cess paid in cash — separate bank outflow entry
          if (cessPd > 0) {
            entries.push(mk("5101", "Market Cess",  cessPd, 0));
            entries.push(mk("1100", "Bank / Cash",  0, cessPd));
          }

          await createLedgerEntries(entries);

          // Create payable obligation record for supplier
          if (supplier?.id && supplierNetPayable > 0) {
            await createPayout({
              batchRef:      `PAY-${poNo}`,
              farmerId:      supplier.id,
              farmerName:    row.supplier?.trim() ?? "",
              inwardLotId:   lot.id,
              documentRef:   poNo,
              payoutDate:    lotDate,
              materialName:  material?.name ?? "Maize",
              quantity:      netWtMT,
              rate:          supplierRate,
              grossAmount:   supplierGross,
              deductions:    r2(supplierGross - supplierNetPayable),
              netAmount:     supplierNetPayable,
              paymentMode:   "NEFT",
              paymentRef:    "",
              paymentStatus: "Pending",
            });
          }

          await updateLot(lot.id, { status: "Settled", grossSaleValue, netPayableWeight: netWtMT });
        }

        created.push(poNo);
      } catch (e) {
        errors.push(`Row ${rowNum} (${row.po_number ?? "?"}): ${errMsg(e)}`);
      }
    }

    return NextResponse.json({ created: created.length, createdRefs: created, errors });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
