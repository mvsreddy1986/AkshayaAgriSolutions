import { NextRequest, NextResponse } from "next/server";
import { updateStock } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.openingQty !== undefined || body.soldQty !== undefined) {
      const openingQty = Number(body.openingQty ?? 0);
      const soldQty = Number(body.soldQty ?? 0);
      body.availableQty = openingQty - soldQty;
    }
    return NextResponse.json(await updateStock(id, body));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
