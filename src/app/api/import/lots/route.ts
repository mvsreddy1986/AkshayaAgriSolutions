import { NextRequest, NextResponse } from "next/server";
import {
  createLot, updateLot, createLedgerEntries, createPayout,
  listParties, listMaterials,
} from "../../../../lib/db";
import { supabase } from "../../../../lib/supabase/client";
import type { LedgerEntry } from "../../../../lib/types";
import { r2, errMsg } from "../../../../lib/utils";

export const dynamic = "force-dynamic";

interface LotRow {
  [key: string]: string | undefined; // flexible — any column name accepted
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
        // ── Parse fields — accepts any common column name variant ─────────────
        const poNo     = (row.challan_no ?? row.po_number ?? row.lot_number ?? row["lot no"] ?? row["lot number"] ?? row["bill no"] ?? "").trim();
        const lotDate  = (row.unloading_date ?? row["unloading date"] ?? "").trim();
        const netWtKg  = parseFloat(row.net_wt_kg ?? row["net wt kg"] ?? "0") || 0;
        const grossWtKg= parseFloat(row.gross_wt_kg ?? row["gross wt kg"] ?? "0") || netWtKg;
        const tareWtKg = parseFloat(row.tare_wt_kg  ?? row["tare wt kg"]  ?? "0") || 0;
        const poRate   = parseFloat(row.po_rate_per_kg       ?? "0") || 0; // ₹/kg
        const supRate  = parseFloat(row.supplier_rate_per_kg ?? "0") || 0; // ₹/kg
        const cessPd   = parseFloat(row.cess_paid_rs   ?? "0") || 0;
        const cessBal  = parseFloat(row.balance_cess_rs ?? "0") || 0;
        const mcDed    = parseFloat(row.mc_deduction_rs ?? "0") || 0;
        const moistPct = parseFloat(row.moisture_pct    ?? "0") || 0;
        const invoiceNo= (row.invoice_no ?? row["invoice no"] ?? row.invoice_number ?? "").trim();
        const lotStatus= (row.status?.trim() || "Draft") as
          "Draft" | "Mapped" | "QualityHold" | "Approved" | "Settled" | "Invoiced";

        if (!poNo) { errors.push(`Row ${rowNum}: challan_no is required`); continue; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(lotDate)) {
          errors.push(`Row ${rowNum} (${poNo}): unloading_date must be YYYY-MM-DD`); continue;
        }
        if (netWtKg <= 0) { errors.push(`Row ${rowNum} (${poNo}): net_wt_kg must be > 0`); continue; }
        if (poRate  <= 0) { errors.push(`Row ${rowNum} (${poNo}): po_rate_per_kg must be > 0`); continue; }
        if (supRate <= 0) { errors.push(`Row ${rowNum} (${poNo}): supplier_rate_per_kg must be > 0`); continue; }

        if (!sarvani?.id) {
          errors.push(`Row ${rowNum} (${poNo}): Cannot find Sarvani Biofuels in Parties master. Add it under Master Data → Parties first.`);
          continue;
        }

        // ── Idempotency: skip if challan already exists ───────────────────────
        const { count: existing } = await supabase
          .from("inward_lots")
          .select("id", { count: "exact", head: true })
          .eq("document_ref", poNo);
        if ((existing ?? 0) > 0) {
          errors.push(`Row ${rowNum}: Challan "${poNo}" already exists — skipped`);
          continue;
        }

        // ── Resolve invoice link (if invoice_no provided) ─────────────────────
        let resolvedInvoiceId: string | null = null;
        if (invoiceNo) {
          const { data: inv } = await supabase
            .from("invoices")
            .select("id")
            .eq("invoice_no", invoiceNo)
            .single();
          if (inv?.id) resolvedInvoiceId = inv.id;
          else errors.push(`Row ${rowNum} (${poNo}): Invoice "${invoiceNo}" not found — lot created without invoice link`);
        }

        // ── Unit conversions (kg → MT, ₹/kg → ₹/MT) ─────────────────────────
        const netWtMT    = r2(netWtKg  / 1000);
        const grossWtMT  = r2(grossWtKg / 1000);
        const tareWtMT   = r2(tareWtKg  / 1000);
        const grossSaleRate = r2(poRate * 1000);           // ₹/MT
        const supplierRate  = r2(supRate * 1000);          // ₹/MT

        // ── Financial calculations ─────────────────────────────────────────────
        const grossSaleValue     = r2(netWtMT * grossSaleRate);
        const supplierGross      = r2(netWtKg * supRate);
        const supplierNetPayable = r2(supplierGross - cessBal - mcDed);
        const akshayaMargin      = r2(grossSaleValue - supplierNetPayable);
        // Use explicit margin from CSV if provided, otherwise derive from rate spread
        const explicitMarginPMT  = parseFloat(row.akshaya_margin_per_mt ?? row["margin per mt"] ?? "0") || 0;
        const akshayaMarginPerMT = explicitMarginPMT > 0
          ? explicitMarginPMT
          : (netWtMT > 0 ? r2(akshayaMargin / netWtMT) : 50);

        // ── Find matching parties and material ────────────────────────────────
        const supplier = partyByName.get(row.supplier?.toLowerCase().trim() ?? "");
        const material = matByName.get("maize") ?? defaultMat;

        if (!material?.id) {
          errors.push(`Row ${rowNum} (${poNo}): No active material found. Add at least one material under Master Data → Materials first.`);
          continue;
        }

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
          grossWeight:    grossWtMT,
          tareWeight:     tareWtMT,
          netWeight:      netWtMT,
          acceptedWeight: netWtMT,
          qualityReadings: { moisture_pct: moistPct },
          qualityRuleId:  null,
          paramDeductions: {},
          cessAmount:     r2(cessPd + cessBal), // total cess = paid + balance
          netPayableWeight: netWtMT,
          grossSaleRate,
          grossSaleValue,
          importBatchId:  null,
          invoiceId:      resolvedInvoiceId,
          // "Settled"/"Invoiced" in CSV → store as "Approved" so user can run settlement immediately.
          // "Draft" stays Draft so lot appears in procurement active queue.
          status: (["Settled", "Invoiced", "Approved"].includes(lotStatus) ? "Approved" : "Draft") as "Draft" | "Approved",
          overrideReason: `Historical import — MC ded ₹${mcDed}${invoiceNo ? ` | Inv ${invoiceNo}` : ""}`,
          akshayaMarginPerMT,
          holdPenalty:    0,
          holdPenaltyNote: null,
        });

        // ── Link lot to invoice (add to invoice's linked_lot_ids) ────────────
        if (resolvedInvoiceId) {
          const { data: inv } = await supabase
            .from("invoices")
            .select("linked_lot_ids")
            .eq("id", resolvedInvoiceId)
            .single();
          if (inv) {
            const existing = (inv.linked_lot_ids ?? []) as string[];
            if (!existing.includes(lot.id)) {
              await supabase
                .from("invoices")
                .update({ linked_lot_ids: [...existing, lot.id] })
                .eq("id", resolvedInvoiceId);
            }
          }
        }

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

          // Keep lot as Draft (not Settled) so it appears in the procurement
          // active queue. Settlement entries are already posted — the settle
          // route's idempotency guard (source_ref check) prevents double-posting.
          await updateLot(lot.id, { grossSaleValue, netPayableWeight: netWtMT });
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
