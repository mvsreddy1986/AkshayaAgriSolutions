import { NextRequest, NextResponse } from "next/server";
import { getStock, updateStock } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.openingQty !== undefined || body.soldQty !== undefined) {
      const current = await getStock(id);
      const openingQty = body.openingQty !== undefined ? Number(body.openingQty) : current.openingQty;
      const soldQty = body.soldQty !== undefined ? Number(body.soldQty) : current.soldQty;
      body.availableQty = openingQty - soldQty;
    }
    return NextResponse.json(await updateStock(id, body));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
