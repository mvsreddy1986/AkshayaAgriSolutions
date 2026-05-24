import { NextRequest, NextResponse } from "next/server";
import { listVouchers, createVoucher } from "../../../lib/db";

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type") ?? undefined;
    return NextResponse.json(await listVouchers(type));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const today = new Date().toISOString().slice(0, 10);
    const saved = await createVoucher({
      voucherNo: body.voucherNo ?? `VCH-${Date.now()}`,
      voucherType: body.voucherType ?? "Receipt",
      voucherDate: body.voucherDate ?? today,
      partyId: body.partyId ?? "",
      partyName: body.partyName ?? "",
      amount: Number(body.amount ?? 0),
      paymentMode: body.paymentMode ?? "NEFT",
      bankRef: body.bankRef ?? "",
      narration: body.narration ?? "",
      status: body.status ?? "Draft",
      allocatedTo: Array.isArray(body.allocatedTo) ? body.allocatedTo : [],
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
