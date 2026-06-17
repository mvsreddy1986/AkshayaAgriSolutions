import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase/client";

const TABLES = [
  "materials",
  "parties",
  "quality_rules",
  "rate_masters",
  "inward_lots",
  "import_batches",
  "farmer_payouts",
  "invoices",
  "vouchers",
  "ledger_entries",
  "stock_batches",
] as const;

export async function GET() {
  try {
    const results = await Promise.all(
      TABLES.map(async (table) => {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        return [table, error ? -1 : (count ?? 0)] as const;
      })
    );
    return NextResponse.json(Object.fromEntries(results));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
