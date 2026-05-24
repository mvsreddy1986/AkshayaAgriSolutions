import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase/client";

export async function GET(req: NextRequest) {
  try {
    const model = req.nextUrl.searchParams.get("model");
    let q = supabase.from("import_batches").select("*").order("report_date", { ascending: false });
    if (model) q = q.eq("business_model", model);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json(
      (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id, batchRef: r.batch_ref, importType: r.import_type, businessModel: r.business_model,
        sourceFilename: r.source_filename, reportDate: r.report_date, partyName: r.party_name,
        totalRows: r.total_rows, mappedRows: r.mapped_rows, status: r.status,
      }))
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
