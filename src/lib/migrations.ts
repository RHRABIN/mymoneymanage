// Decides what the admin migrations panel shows and may run. Same rules as
// scripts/migrate.mjs: files named <14-digit version>_<name>.sql, applied
// versions recorded in supabase_migrations.schema_migrations.

const FILE_RE = /(\d{14})_(.+)\.sql$/;

export type MigrationHistory = {
  hasHistory: boolean; // the schema_migrations table exists
  hasSchema: boolean; // the app's tables exist
  applied: string[];
};

export function planMigrations(files: Record<string, string>, history: MigrationHistory) {
  const applied = new Set(history.applied);
  const all = Object.entries(files)
    .map(([path, sql]) => {
      const m = FILE_RE.exec(path);
      return m && { version: m[1], name: m[2], sql };
    })
    .filter((m) => m !== null)
    .sort((a, b) => a.version.localeCompare(b.version));
  // Tables but no history: old migrations would re-run and fail
  const blocked =
    !history.hasHistory && history.hasSchema
      ? "This database has app tables but no migration history. Run `npm run db:migrate -- --baseline <version>` once from a terminal first."
      : null;
  return {
    migrations: all.map(({ version, name }) => ({ version, name, applied: applied.has(version) })),
    pending: blocked ? [] : all.filter((m) => !applied.has(m.version)),
    blocked,
  };
}
