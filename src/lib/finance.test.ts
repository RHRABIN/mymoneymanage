import { describe, expect, it } from "vitest";
import { balanceDelta, normalizeCategory, summarize, toISODate, type Transaction } from "./finance";

const tx = (type: Transaction["type"], amount: number): Transaction => ({
  id: crypto.randomUUID(),
  user_id: "u",
  title: "t",
  amount,
  date: "2026-10-01",
  type,
  status: "pending",
  category: null,
  payment_method: "cash",
  created_at: "",
  updated_at: "",
});

describe("summarize", () => {
  it("keeps lending and borrowing out of income, expense and balance", () => {
    const s = summarize([
      tx("income", 1000),
      tx("expense", 300),
      tx("lending", 500),
      tx("borrow", 200),
    ]);
    expect(s).toEqual({ income: 1000, expense: 300, lent: 500, borrowed: 200, balance: 700 });
  });

  it("handles amounts that arrive as strings from Postgres numerics", () => {
    const s = summarize([tx("income", "12.50" as unknown as number), tx("expense", 2.5)]);
    expect(s.balance).toBe(10);
  });
});

describe("balanceDelta", () => {
  it("is positive for income, negative for expense, zero otherwise", () => {
    expect(balanceDelta(tx("income", 5))).toBe(5);
    expect(balanceDelta(tx("expense", 5))).toBe(-5);
    expect(balanceDelta(tx("lending", 5))).toBe(0);
    expect(balanceDelta(tx("borrow", 5))).toBe(0);
  });
});

describe("normalizeCategory", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeCategory("  Food   and  drink ")).toBe("Food and drink");
  });
  it("turns blank values into null", () => {
    expect(normalizeCategory("   ")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
  });
});

describe("toISODate", () => {
  it("uses the local calendar date, not UTC", () => {
    // 2 AM on Oct 1 in Dhaka is still Sep 30 in UTC
    const earlyMorning = new Date(2026, 9, 1, 2, 0);
    expect(earlyMorning.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(toISODate(earlyMorning)).toBe("2026-10-01");
  });
});
