import { NextRequest, NextResponse } from "next/server";
import { listInvoices, createInvoice } from "../../../lib/db";

export async function GET() {
  try {
    return NextResponse.json(await listInvoices());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const today = new Date().toISOString().slice(0, 10);
    const grossValue = Number(body.grossValue ?? 0);
    const taxableValue = Number(body.taxableValue ?? grossValue);
    const cgstRate = Number(body.cgstRate ?? 0);
    const sgstRate = Number(body.sgstRate ?? 0);
    const igstRate = Number(body.igstRate ?? 0);
    const cgstAmount = Math.round(taxableValue * cgstRate) / 100;
    const sgstAmount = Math.round(taxableValue * sgstRate) / 100;
    const igstAmount = Math.round(taxableValue * igstRate) / 100;
    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const totalValue = taxableValue + totalTax;

    const saved = await createInvoice({
      invoiceNo: body.invoiceNo ?? `AAS-${Date.now()}`,
      invoiceType: body.invoiceType ?? "Sales",
      businessModel: body.businessModel ?? "A",
      invoiceDate: body.invoiceDate ?? today,
      dueDate: body.dueDate ?? today,
      partyId: body.partyId ?? "",
      partyName: body.partyName ?? "",
      materialId: body.materialId ?? null,
      materialName: body.materialName ?? "",
      quantity: Number(body.quantity ?? 0),
      uom: body.uom ?? "MT",
      grossRate: Number(body.grossRate ?? 0),
      grossValue,
      taxableValue,
      cgstRate, sgstRate, igstRate,
      cgstAmount, sgstAmount, igstAmount,
      totalTax, totalValue,
      amountPaid: Number(body.amountPaid ?? 0),
      amountDue: totalValue - Number(body.amountPaid ?? 0),
      linkedLotIds: Array.isArray(body.linkedLotIds) ? body.linkedLotIds : [],
      status: body.status ?? "Draft",
      cancelledReason: body.cancelledReason ?? null,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
