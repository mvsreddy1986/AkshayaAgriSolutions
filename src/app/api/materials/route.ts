import { NextRequest, NextResponse } from "next/server";
import { listMaterials, createMaterial } from "../../../lib/db";

export async function GET() {
  try {
    return NextResponse.json(await listMaterials());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await createMaterial({
      name: body.name ?? "",
      hsn: body.hsn ?? "",
      uom: body.uom ?? "MT",
      gstRate: Number(body.gstRate ?? 0),
      cessRate: Number(body.cessRate ?? 1),
      category: body.category ?? "Grain",
      defaultGrossSaleRate: Number(body.defaultGrossSaleRate ?? 0),
      pricingModel: body.pricingModel ?? "deduction",
      params: Array.isArray(body.params) ? body.params : [],
      status: body.status ?? "Draft",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
