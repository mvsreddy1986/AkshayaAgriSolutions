import { NextRequest, NextResponse } from "next/server";
import { listLedger } from "../../../lib/db";

export async function GET(req: NextRequest) {
  try {
    const partyId = req.nextUrl.searchParams.get("partyId") ?? undefined;
    const accountCode = req.nextUrl.searchParams.get("accountCode") ?? undefined;
    return NextResponse.json(await listLedger(partyId, accountCode));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
