import { NextRequest, NextResponse } from "next/server";
import { listPayouts, createPayout, updatePayout } from "../../../lib/db";
import type { PayoutStatus } from "../../../lib/types";
import { supabase } from "../../../lib/supabase/client";

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

    // Required field validation
    const farmerId    = String(body.farmerId    ?? "").trim();
    const inwardLotId = String(body.inwardLotId ?? "").trim();
    const grossAmount = Number(body.grossAmount ?? 0);
    if (!farmerId)       return NextResponse.json({ error: "farmerId is required" },        { status: 400 });
    if (!inwardLotId)    return NextResponse.json({ error: "inwardLotId is required" },     { status: 400 });
    if (grossAmount <= 0) return NextResponse.json({ error: "grossAmount must be > 0" },    { status: 400 });

    // Dedup guard: reject if a payout already exists for this lot
    const { count } = await supabase
      .from("farmer_payouts")
      .select("id", { count: "exact", head: true })
      .eq("inward_lot_id", inwardLotId);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `A payout record already exists for lot ${inwardLotId}. Cannot create duplicate.` },
        { status: 409 },
      );
    }

    const deductions = Number(body.deductions ?? 0);
    // Use explicitly passed netAmount if provided (settle route bundles cessReimb into 2101),
    // otherwise fall back to grossAmount − deductions.
    const netAmount = body.netAmount !== undefined ? Number(body.netAmount) : grossAmount - deductions;

    const saved = await createPayout({
      batchRef:      body.batchRef ?? `FP-${Date.now()}`,
      farmerId,
      farmerName:    String(body.farmerName ?? ""),
      inwardLotId,
      documentRef:   String(body.documentRef ?? ""),
      payoutDate:    String(body.payoutDate ?? new Date().toISOString().slice(0, 10)),
      materialName:  String(body.materialName ?? ""),
      quantity:      Number(body.quantity ?? 0),
      rate:          Number(body.rate ?? 0),
      grossAmount,
      deductions,
      netAmount,
      paymentMode:   String(body.paymentMode ?? "NEFT"),
      paymentRef:    String(body.paymentRef ?? ""),
      paymentStatus: (["Pending", "Approved", "Paid"].includes(body.paymentStatus) ? body.paymentStatus : "Pending") as PayoutStatus,
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
