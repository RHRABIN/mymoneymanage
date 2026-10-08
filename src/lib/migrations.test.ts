import { describe, expect, it } from "vitest";
import { planMigrations } from "./migrations";

const files = {
  "/supabase/migrations/20261008090000_saving_targets.sql": "create table b();",
  "/supabase/migrations/20260420155459_init.sql": "create table a();",
  "/supabase/migrations/README.md": "not a migration",
};

describe("planMigrations", () => {
  it("lists migration files oldest first and marks which are applied", () => {
    const plan = planMigrations(files, {
      hasHistory: true,
      hasSchema: true,
      applied: ["20260420155459"],
    });
    expect(plan.migrations).toEqual([
      { version: "20260420155459", name: "init", applied: true },
      { version: "20261008090000", name: "saving_targets", applied: false },
    ]);
  });

  it("returns the pending migrations with their SQL, oldest first", () => {
    const plan = planMigrations(files, { hasHistory: true, hasSchema: true, applied: [] });
    expect(plan.pending).toEqual([
      { version: "20260420155459", name: "init", sql: "create table a();" },
      { version: "20261008090000", name: "saving_targets", sql: "create table b();" },
    ]);
    expect(plan.blocked).toBeNull();
  });

  it("refuses to run when the app's tables exist but no history was recorded", () => {
    const plan = planMigrations(files, { hasHistory: false, hasSchema: true, applied: [] });
    expect(plan.blocked).toMatch(/--baseline/);
    expect(plan.pending).toEqual([]);
  });

  it("runs everything on an empty database", () => {
    const plan = planMigrations(files, { hasHistory: false, hasSchema: false, applied: [] });
    expect(plan.blocked).toBeNull();
    expect(plan.pending).toHaveLength(2);
  });
});
