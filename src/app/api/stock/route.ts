import { NextRequest, NextResponse } from "next/server";
import { listStock, createStock } from "../../../lib/db";

export async function GET() {
  try {
    return NextResponse.json(await listStock());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const openingQty = Number(body.openingQty ?? 0);
    const soldQty = Number(body.soldQty ?? 0);
    const saved = await createStock({
      batchRef: body.batchRef ?? `BATCH-${Date.now()}`,
      materialId: body.materialId ?? "",
      materialName: body.materialName ?? "",
      purchaseDate: body.purchaseDate ?? new Date().toISOString().slice(0, 10),
      openingQty,
      soldQty,
      availableQty: openingQty - soldQty,
      purchaseRate: Number(body.purchaseRate ?? 0),
      qualityStatus: body.qualityStatus ?? "Pending",
      qualityNotes: body.qualityNotes ?? "",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
