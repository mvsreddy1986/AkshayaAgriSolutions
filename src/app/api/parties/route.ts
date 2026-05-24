import { NextRequest, NextResponse } from "next/server";
import { listParties, createParty } from "../../../lib/db";

export async function GET() {
  try {
    return NextResponse.json(await listParties());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await createParty({
      name: body.name ?? "",
      partyType: body.partyType ?? "Supplier",
      gstin: body.gstin ?? "",
      mobile: body.mobile ?? "",
      email: body.email ?? "",
      address: body.address ?? "",
      state: body.state ?? "Andhra Pradesh",
      openingBalance: Number(body.openingBalance ?? 0),
      creditLimit: Number(body.creditLimit ?? 0),
      creditDays: Number(body.creditDays ?? 0),
      businessFlows: Array.isArray(body.businessFlows)
        ? body.businessFlows
        : String(body.businessFlows ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
      taxProfile: body.taxProfile ?? "Registered",
      bankAccount: body.bankAccount ?? "",
      ifsc: body.ifsc ?? "",
      bankName: body.bankName ?? "",
      isFarmerReference: Boolean(body.isFarmerReference),
      status: body.status ?? "Active",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
