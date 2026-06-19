import { NextRequest, NextResponse } from "next/server";
import { updateRate, deleteRate } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const patch: Parameters<typeof updateRate>[1] = {
      materialId:   body.materialId   ?? undefined,
      materialName: body.materialName ?? undefined,
      partyId:      body.partyId      ?? null,
      partyName:    body.partyName    ?? "All",
      rateType:     body.rateType     ?? undefined,
      rate:         body.rate !== undefined ? Number(body.rate) : undefined,
      validFrom:    body.validFrom    ?? undefined,
      validTo:      body.validTo      ?? null,
    };
    return NextResponse.json(await updateRate(id, patch));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteRate(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
