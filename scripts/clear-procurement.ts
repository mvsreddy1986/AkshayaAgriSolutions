import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const sb = createClient(url, key);

async function run() {
  console.log("Deleting inward_lots…");
  const { error: e1, count: c1 } = await sb.from("inward_lots").delete({ count: "exact" }).neq("id", "");
  if (e1) { console.error("inward_lots:", e1.message); process.exit(1); }
  console.log(`  ✓ ${c1 ?? "?"} rows deleted`);

  console.log("Deleting import_batches…");
  const { error: e2, count: c2 } = await sb.from("import_batches").delete({ count: "exact" }).neq("id", "");
  if (e2) { console.error("import_batches:", e2.message); process.exit(1); }
  console.log(`  ✓ ${c2 ?? "?"} rows deleted`);

  console.log("Done — procurement tables cleared.");
}

run();
