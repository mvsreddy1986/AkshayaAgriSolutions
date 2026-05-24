import { NextRequest, NextResponse } from "next/server";
import { updateVoucher } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json(await updateVoucher(id, body));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
