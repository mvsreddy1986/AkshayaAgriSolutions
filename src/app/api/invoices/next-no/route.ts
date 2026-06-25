import { NextRequest, NextResponse } from "next/server";
import { getNextInvoiceNo } from "../../../../lib/db";

export async function GET(req: NextRequest) {
  try {
    const fy = req.nextUrl.searchParams.get("fy") ?? "";
    if (!fy) return NextResponse.json({ error: "fy query param required" }, { status: 400 });
    const invoiceNo = await getNextInvoiceNo(fy);
    return NextResponse.json({ invoiceNo });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
