const ref = "uswvjssjrnzifdrinzui";
const svcKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd3Zqc3Nqcm56aWZkcmluenVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ3NzM1OCwiZXhwIjoyMDk1MDUzMzU4fQ.8tvaWMLrJwv1RwGXYCZuKzE7fXHbWWEEXhK7tPcQ30M";

const statements = [
  "ALTER TABLE materials ADD COLUMN IF NOT EXISTS cess_rate NUMERIC NOT NULL DEFAULT 1",
  "ALTER TABLE inward_lots ADD COLUMN IF NOT EXISTS akshaya_margin_per_mt NUMERIC NOT NULL DEFAULT 50",
  "UPDATE materials SET cess_rate = 1 WHERE name ILIKE '%maize%' OR name ILIKE '%paddy%' OR name ILIKE '%ddgs%' OR name ILIKE '%wdg%'",
  "UPDATE materials SET cess_rate = 0 WHERE name IN ('Coal', 'CO2', 'Corn Oil', 'Biomass')",
];

for (const sql of statements) {
  console.log("Running:", sql.slice(0, 60) + "...");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${svcKey}` },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (res.ok) {
    console.log("  OK:", JSON.stringify(body));
  } else {
    console.error("  FAILED:", JSON.stringify(body));
  }
}
