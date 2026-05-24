import { NextRequest, NextResponse } from "next/server";
import { listPayouts, createPayout, updatePayout } from "../../../lib/db";

export async function GET() {
  try {
    return NextResponse.json(await listPayouts());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const grossAmount = Number(body.grossAmount ?? 0);
    const deductions = Number(body.deductions ?? 0);
    const saved = await createPayout({
      batchRef: body.batchRef ?? `FP-${Date.now()}`,
      farmerId: body.farmerId ?? "",
      farmerName: body.farmerName ?? "",
      inwardLotId: body.inwardLotId ?? "",
      documentRef: body.documentRef ?? "",
      payoutDate: body.payoutDate ?? new Date().toISOString().slice(0, 10),
      materialName: body.materialName ?? "",
      quantity: Number(body.quantity ?? 0),
      rate: Number(body.rate ?? 0),
      grossAmount,
      deductions,
      netAmount: grossAmount - deductions,
      paymentMode: body.paymentMode ?? "NEFT",
      paymentRef: body.paymentRef ?? "",
      paymentStatus: body.paymentStatus ?? "Pending",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    return NextResponse.json(await updatePayout(id, rest));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
