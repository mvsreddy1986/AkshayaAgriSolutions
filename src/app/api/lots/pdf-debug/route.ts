import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await pdfParse(buffer);

    // Return raw lines so we can see exact structure
    const lines = text.split(/\r?\n/).map((l, i) => `${String(i).padStart(3, "0")}: ${l}`);
    return NextResponse.json({ raw: text, lines });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
