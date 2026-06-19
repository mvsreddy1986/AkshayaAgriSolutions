import { NextRequest, NextResponse } from "next/server";
import { listRates, createRate } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listRates());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await createRate({
      materialId: body.materialId ?? "",
      materialName: body.materialName ?? "",
      partyId: body.partyId ?? null,
      partyName: body.partyName ?? "All",
      rateType: body.rateType ?? "GrossSale",
      rate: Number(body.rate ?? 0),
      validFrom: body.validFrom ?? new Date().toISOString().slice(0, 10),
      validTo: body.validTo ?? null,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
