import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase/client";

// Dependency-ordered: children deleted before parents to satisfy FK constraints
const DELETION_ORDER = [
  "ledger_entries",
  "farmer_payouts",
  "vouchers",
  "inward_lots",
  "invoices",
  "stock_batches",
  "import_batches",
  "rate_masters",
  "quality_rules",
  "parties",
  "materials",
] as const;

async function clearTable(table: string): Promise<string | null> {
  // LIKE '%' matches every non-null string ID — effectively DELETE all rows
  const { error } = await supabase.from(table).delete().like("id", "%");
  return error?.message ?? null;
}

export async function DELETE() {
  const errors: string[] = [];

  for (const table of DELETION_ORDER) {
    const err = await clearTable(table);
    if (err) errors.push(`${table}: ${err}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 500 });
  }

  return NextResponse.json({ success: true, cleared: DELETION_ORDER });
}
