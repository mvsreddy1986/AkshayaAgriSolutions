import { NextRequest, NextResponse } from "next/server";
import { listLots, createLot } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const model = req.nextUrl.searchParams.get("model") ?? undefined;
    return NextResponse.json(await listLots(model));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const today = new Date().toISOString().slice(0, 10);
    const saved = await createLot({
      documentRef: body.documentRef ?? "",
      businessModel: body.businessModel ?? "A",
      lotDate: body.lotDate ?? today,
      materialId: body.materialId ?? "",
      materialName: body.materialName ?? "",
      customerId: body.customerId ?? "",
      customerName: body.customerName ?? "",
      supplierId: body.supplierId ?? null,
      supplierName: body.supplierName ?? null,
      farmerId: body.farmerId ?? null,
      farmerName: body.farmerName ?? null,
      vehicleNo: body.vehicleNo ?? "",
      grossWeight: Number(body.grossWeight ?? 0),
      tareWeight: Number(body.tareWeight ?? 0),
      netWeight: Number(body.netWeight ?? 0),
      acceptedWeight: Number(body.acceptedWeight ?? 0),
      qualityReadings: (body.qualityReadings && typeof body.qualityReadings === "object") ? body.qualityReadings : {},
      qualityRuleId: body.qualityRuleId || null,
      paramDeductions: (body.paramDeductions && typeof body.paramDeductions === "object") ? body.paramDeductions : {},
      cessAmount: Number(body.cessAmount ?? 0),
      netPayableWeight: Number(body.netPayableWeight ?? 0),
      grossSaleRate: Number(body.grossSaleRate ?? 0),
      grossSaleValue: Number(body.grossSaleValue ?? 0),
      importBatchId: body.importBatchId ?? null,
      invoiceId: body.invoiceId ?? null,
      status: body.status ?? "Draft",
      overrideReason: body.overrideReason ?? null,
      akshayaMarginPerMT: Number(body.akshayaMarginPerMT ?? 50),
      holdPenalty: Number(body.holdPenalty ?? 0),
      holdPenaltyNote: body.holdPenaltyNote ?? null,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
