import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE() {
  try {
    const { error: e1, count: c1 } = await supabase
      .from("inward_lots")
      .delete({ count: "exact" })
      .neq("id", "");
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const { error: e2, count: c2 } = await supabase
      .from("import_batches")
      .delete({ count: "exact" })
      .neq("id", "");
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    return NextResponse.json({ lots: c1 ?? 0, batches: c2 ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
