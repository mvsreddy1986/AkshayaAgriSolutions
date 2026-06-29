import { NextRequest, NextResponse } from "next/server";
import { updateQualityRule, deleteQualityRule } from "../../../../lib/db";

import { errMsg } from "../../../../lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json(await updateQualityRule(id, body));
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteQualityRule(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) { return NextResponse.json({ error: errMsg(e) }, { status: 500 }); }
}
