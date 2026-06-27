import { NextRequest, NextResponse } from "next/server";
import { listLedger } from "../../../lib/db";

export async function GET(req: NextRequest) {
  try {
    const partyId     = req.nextUrl.searchParams.get("partyId")     ?? undefined;
    const accountCode = req.nextUrl.searchParams.get("accountCode") ?? undefined;
    const dateFrom    = req.nextUrl.searchParams.get("dateFrom")    ?? undefined;
    const dateTo      = req.nextUrl.searchParams.get("dateTo")      ?? undefined;
    return NextResponse.json(await listLedger(partyId, accountCode, dateFrom, dateTo));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
