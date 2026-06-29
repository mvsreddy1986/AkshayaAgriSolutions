import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "../../../../lib/supabase/admin";
import { errMsg } from "../../../../lib/utils";

export const TRANSACTIONAL: { table: string; label: string }[] = [
  { table: "ledger_entries",  label: "Ledger entries" },
  { table: "invoices",        label: "Invoices" },
  { table: "vouchers",        label: "Vouchers" },
  { table: "farmer_payouts",  label: "Farmer payouts" },
  { table: "stock_batches",   label: "Stock batches" },
  { table: "inward_lots",     label: "Inward lots" },
  { table: "import_batches",  label: "Import batches" },
];


/** GET — row counts for the preview */
export async function GET() {
  try {
    const counts: Record<string, number> = {};
    await Promise.all(
      TRANSACTIONAL.map(async ({ table, label }) => {
        const { count, error } = await adminSupabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (error) throw new Error(`${table}: ${error.message}`);
        counts[label] = count ?? 0;
      })
    );
    return NextResponse.json({ counts });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

/**
 * POST — delete rows.
 * Body (optional): { labels: string[] }  — subset of labels to erase.
 * Omit body or empty labels array → erase all transactional tables.
 */
export async function POST(req: NextRequest) {
  try {
    let targets = TRANSACTIONAL;
    try {
      const body = await req.json() as { labels?: string[] };
      if (Array.isArray(body.labels) && body.labels.length > 0) {
        targets = TRANSACTIONAL.filter((t) => body.labels!.includes(t.label));
      }
    } catch { /* no body / invalid JSON → erase all */ }

    const results: Record<string, number> = {};
    for (const { table, label } of targets) {
      const { error, count } = await adminSupabase
        .from(table)
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw new Error(`${table}: ${error.message}`);
      results[label] = count ?? 0;
    }
    return NextResponse.json({ deleted: results });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
