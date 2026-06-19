import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local before anything else
config({ path: resolve(process.cwd(), ".env.local") });

import { Client } from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "\nERROR: DATABASE_URL not found.\n" +
      "Add it to .env.local:\n" +
      "  DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres\n" +
      "Find it in: Supabase Dashboard → Settings → Database → Connection string → URI\n"
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to database.\n");

  // Migrations tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows: applied } = await client.query<{ filename: string }>(
    "SELECT filename FROM _migrations ORDER BY filename"
  );
  const done = new Set(applied.map((r) => r.filename));

  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`  ✓  ${file}  (already applied)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    process.stdout.write(`  →  ${file}  ...`);
    await client.query(sql);
    await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
    console.log("  done");
    count++;
  }

  await client.end();
  console.log(`\n${count === 0 ? "Nothing to apply — schema is up to date." : `${count} migration(s) applied successfully.`}`);
}

migrate().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
