import { NextRequest, NextResponse } from "next/server";
import { updateQualityRule } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json(await updateQualityRule(id, body));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
