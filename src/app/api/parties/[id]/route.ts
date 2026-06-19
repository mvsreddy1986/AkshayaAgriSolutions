import { NextRequest, NextResponse } from "next/server";
import { updateParty, deleteParty } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };
function errMsg(e: unknown) { return e instanceof Error ? e.message : String(e); }

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json(await updateParty(id, body));
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteParty(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) { return NextResponse.json({ error: errMsg(e) }, { status: 500 }); }
}
