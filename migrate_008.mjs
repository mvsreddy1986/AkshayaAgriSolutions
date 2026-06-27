import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString: "postgresql://postgres.uswvjssjrnzifdrinzui:1s6N7LPbvgB45HHK@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

const sql = `ALTER TABLE inward_lots
  ADD COLUMN IF NOT EXISTS cess_payment_posted BOOLEAN NOT NULL DEFAULT FALSE;`;

await client.connect();
console.log("Connected.");
const res = await client.query(sql);
console.log("Done:", res.command);
await client.end();
