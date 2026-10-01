#!/usr/bin/env node
// Run supabase/tests/database.sql against a LOCAL database (npx supabase start)
// inside a transaction that is always rolled back.
//
//   npm run test:db                      uses the local Supabase default URL
//   TEST_DATABASE_URL=postgresql://... npm run test:db

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const host = new URL(url).hostname;
// The tests create users and rows; never point them at a real project
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to run database tests against ${host}: local databases only.`);
  process.exit(1);
}

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "tests", "database.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
const results = [];
client.on("notice", (n) => {
  if (/^(PASS|FAIL)\b/.test(n.message)) results.push(n.message);
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
} catch (err) {
  results.push(`FAIL test file errored: ${err.message}`);
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}

for (const r of results) console.log(r.startsWith("PASS") ? `✓ ${r.slice(5)}` : `✗ ${r.slice(5)}`);
const failed = results.filter((r) => r.startsWith("FAIL")).length;
const passed = results.length - failed;
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed || !passed ? 1 : 0;
