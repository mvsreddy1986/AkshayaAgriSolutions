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
      pricingModel: body.pricingModel ?? "deduction",
      validFrom: body.validFrom ?? new Date().toISOString().slice(0, 10),
      validTo: body.validTo || null,
      globalCessRate: Number(body.globalCessRate ?? body.cessRate ?? 0),
      allowedVariancePct: Number(body.allowedVariancePct ?? 2),
      description: body.description ?? "",
      status: body.status ?? "Draft",
      paramRules: Array.isArray(body.paramRules) ? body.paramRules : [],
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
