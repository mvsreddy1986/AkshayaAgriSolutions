import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const sb = createClient(url, key);

// Parameter keys that should use "value-pct" deduction (excess% × sale rate)
const VALUE_PCT_PARAMS = new Set([
  "fm_pct", "foreign_matter", "foreign_matter_pct",
  "broken_grain", "broken_grain_pct", "bg_pct",
]);

async function run() {
  const { data: rules, error } = await sb
    .from("quality_rules")
    .select("id, material_name, param_rules")
    .ilike("material_name", "%maize%");

  if (error) { console.error("Fetch error:", error.message); process.exit(1); }
  if (!rules?.length) { console.log("No Maize quality rules found."); return; }

  for (const rule of rules) {
    const paramRules: Record<string, unknown>[] = rule.param_rules ?? [];
    let changed = false;

    const updated = paramRules.map((pr) => {
      const key = String(pr.paramKey ?? "").toLowerCase();
      if (VALUE_PCT_PARAMS.has(key) && pr.deductionMethod === "linear") {
        console.log(`  Rule ${rule.id} (${rule.material_name}): ${pr.paramKey} linear→value-pct (was linearRate: ${pr.linearRate})`);
        const { linearRate, ...rest } = pr as Record<string, unknown> & { linearRate?: unknown };
        void linearRate; // drop the fixed rate
        changed = true;
        return { ...rest, deductionMethod: "value-pct" };
      }
      return pr;
    });

    if (!changed) {
      console.log(`Rule ${rule.id} (${rule.material_name}): no FM/BG params with linear method — skipping`);
      continue;
    }

    const { error: upErr } = await sb
      .from("quality_rules")
      .update({ param_rules: updated })
      .eq("id", rule.id);

    if (upErr) {
      console.error(`  Failed to update rule ${rule.id}:`, upErr.message);
    } else {
      console.log(`  ✓ Rule ${rule.id} updated`);
    }
  }

  console.log("Done.");
}

run();
