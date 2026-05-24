import { NextRequest, NextResponse } from "next/server";
import { listQualityRules, createQualityRule } from "../../../lib/db";

export async function GET() {
  try {
    return NextResponse.json(await listQualityRules());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await createQualityRule({
      materialId: body.materialId ?? "",
      materialName: body.materialName ?? "",
      validFrom: body.validFrom ?? new Date().toISOString().slice(0, 10),
      validTo: body.validTo ?? "",
      baseMoisture: Number(body.baseMoisture ?? 14),
      moistureDeductionMethod: body.moistureDeductionMethod ?? "linear",
      moistureRatePerPct: Number(body.moistureRatePerPct ?? 0),
      fmDeductionMethod: body.fmDeductionMethod ?? "actual",
      fmRatePerPct: Number(body.fmRatePerPct ?? 1),
      cessRate: Number(body.cessRate ?? 0),
      allowedVariancePct: Number(body.allowedVariancePct ?? 2),
      description: body.description ?? "",
      status: body.status ?? "Draft",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
