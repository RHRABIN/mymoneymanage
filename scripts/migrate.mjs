#!/usr/bin/env node
// Apply pending SQL migrations from supabase/migrations to a Postgres database.
//
//   DATABASE_URL=postgresql://... npm run db:migrate            apply pending migrations
//   DATABASE_URL=postgresql://... npm run db:migrate -- --dry-run   list pending, change nothing
//   npm run db:migrate -- --url postgresql://...                 URL as an argument instead
//   npm run db:migrate -- --baseline 20260518092025              mark versions <= X as applied without running them
//
// History is kept in supabase_migrations.schema_migrations, the same table the
// Supabase CLI uses, so both tools agree on what has been applied.
// Each migration runs in its own transaction; the run stops at the first failure.

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pg from "pg";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);
const FILE_RE = /^(\d{14})_(.+)\.sql$/;

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    baseline: { type: "string" },
  },
});

const url = args.url ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Missing database URL: set DATABASE_URL or pass --url.");
  process.exit(1);
}
if (args.baseline && !/^\d{14}$/.test(args.baseline)) {
  console.error("--baseline expects a 14-digit migration version, e.g. 20260518092025");
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
// Supabase serves TLS with its own CA, which Node does not trust by default
const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const migrations = readdirSync(MIGRATIONS_DIR)
  .map((file) => {
    const m = FILE_RE.exec(file);
    return m && { version: m[1], name: m[2], file };
  })
  .filter(Boolean)
  .sort((a, b) => a.version.localeCompare(b.version));

async function main() {
  await client.connect();
  console.log(`Connected to ${host}`);

  const { rows: existing } = await client.query(
    "SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS has_history, " +
      "to_regclass('public.transactions') IS NOT NULL AS has_schema",
  );
  const { has_history, has_schema } = existing[0];

  let applied = new Set();
  if (has_history) {
    const { rows } = await client.query(
      "SELECT version FROM supabase_migrations.schema_migrations",
    );
    applied = new Set(rows.map((r) => r.version));
  }

  // A database that already has tables but no history would re-run old migrations and fail
  if (!has_history && has_schema && !args.baseline) {
    console.error(
      "This database already has app tables but no migration history.\n" +
        "Re-run with --baseline <last version already in the database> (likely 20260518092025).",
    );
    process.exit(1);
  }

  const toBaseline = args.baseline
    ? migrations.filter((m) => m.version <= args.baseline && !applied.has(m.version))
    : [];
  const pending = migrations.filter(
    (m) => !applied.has(m.version) && !(args.baseline && m.version <= args.baseline),
  );

  for (const m of toBaseline) console.log(`  baseline  ${m.file}`);
  for (const m of pending) console.log(`  pending   ${m.file}`);
  if (!toBaseline.length && !pending.length) {
    console.log("Database is up to date.");
    return;
  }
  if (args["dry-run"]) {
    console.log("Dry run: nothing applied.");
    return;
  }

  await client.query("CREATE SCHEMA IF NOT EXISTS supabase_migrations");
  await client.query(
    "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations " +
      "(version text PRIMARY KEY, statements text[], name text)",
  );

  for (const m of toBaseline) {
    await client.query(
      "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [m.version, m.name],
    );
    console.log(`✓ marked ${m.file} as applied`);
  }

  for (const m of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, m.file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2, $3)",
        [m.version, [sql], m.name],
      );
      await client.query("COMMIT");
      console.log(`✓ applied ${m.file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ ${m.file} failed and was rolled back: ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log("All migrations applied.");
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
