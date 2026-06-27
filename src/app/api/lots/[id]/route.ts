import { NextRequest, NextResponse } from "next/server";
import { updateLot, deleteLot, getLot } from "../../../../lib/db";

type Ctx = { params: Promise<{ id: string }> };

function errMsg(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return JSON.stringify(e);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json(await updateLot(id, body));
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const lot = await getLot(id);
    if (lot.status === "Settled" || lot.status === "Invoiced") {
      return NextResponse.json(
        { error: `Cannot delete lot ${lot.documentRef} — it has been ${lot.status.toLowerCase()} and has ledger postings. Reverse the settlement first.` },
        { status: 409 },
      );
    }
    await deleteLot(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
