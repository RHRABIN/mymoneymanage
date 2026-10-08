// Server only: reads and applies the migrations bundled into the build.
// Only SQL files from supabase/migrations can ever run; nothing comes from the request.
import pg from "pg";
import { planMigrations, type MigrationHistory } from "@/lib/migrations";

const FILES = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Arbitrary constant so two admins can't apply migrations at the same time
const LOCK_KEY = 74_201_008;

async function withDb<T>(fn: (client: pg.Client) => Promise<T>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set on the server.");
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  // Supabase serves TLS with its own CA, which Node does not trust by default
  const client = new pg.Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function readHistory(client: pg.Client): Promise<MigrationHistory> {
  const { rows } = await client.query(
    "SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS has_history, " +
      "to_regclass('public.transactions') IS NOT NULL AS has_schema",
  );
  const { has_history, has_schema } = rows[0];
  const applied = has_history
    ? (await client.query("SELECT version FROM supabase_migrations.schema_migrations")).rows.map(
        (r) => r.version as string,
      )
    : [];
  return { hasHistory: has_history, hasSchema: has_schema, applied };
}

export async function migrationStatus() {
  return withDb(async (client) => {
    const { migrations, pending, blocked } = planMigrations(FILES, await readHistory(client));
    return { migrations, pendingCount: pending.length, blocked };
  });
}

// Applies pending migrations in order, each in its own transaction; stops at the first failure
export async function applyPendingMigrations() {
  return withDb(async (client) => {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    try {
      // Read the history again under the lock in case another run just finished
      const { pending, blocked } = planMigrations(FILES, await readHistory(client));
      if (blocked) throw new Error(blocked);

      await client.query("CREATE SCHEMA IF NOT EXISTS supabase_migrations");
      await client.query(
        "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations " +
          "(version text PRIMARY KEY, statements text[], name text)",
      );

      const applied: string[] = [];
      for (const m of pending) {
        try {
          await client.query("BEGIN");
          await client.query(m.sql);
          await client.query(
            "INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2, $3)",
            [m.version, [m.sql], m.name],
          );
          await client.query("COMMIT");
          applied.push(`${m.version}_${m.name}`);
        } catch (err) {
          await client.query("ROLLBACK");
          return {
            applied,
            failed: { migration: `${m.version}_${m.name}`, error: (err as Error).message },
          };
        }
      }
      return { applied, failed: null };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  });
}
