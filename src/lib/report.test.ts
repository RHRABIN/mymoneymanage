import { describe, expect, it } from "vitest";
import type { Transaction } from "./finance";
import { buildMonthReport } from "./report";

const tx = (
  type: Transaction["type"],
  amount: number,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  user_id: "u",
  title: "t",
  amount,
  date: "2026-10-05",
  type,
  status: "done",
  category: null,
  payment_method: "cash",
  created_at: "",
  updated_at: "",
  ...extra,
});

const base = {
  month: "2026-10-01",
  today: "2026-10-31",
  current: [] as Transaction[],
  previous: [] as Transaction[],
  targets: [],
  outstanding: [] as Transaction[],
};

describe("buildMonthReport", () => {
  it("totals the month and counts saved as income minus expense", () => {
    const r = buildMonthReport({
      ...base,
      current: [
        tx("income", 50000),
        tx("expense", 12000),
        tx("expense", 8000),
        tx("lending", 3000),
        tx("borrow", 2000),
      ],
    });
    expect(r.summary).toEqual({
      income: 50000,
      expense: 20000,
      lent: 3000,
      borrowed: 2000,
      saved: 30000,
      savingsRate: 0.6,
    });
  });

  describe("saving target", () => {
    const targets = [
      { month: "2026-10-01", amount: 15000 },
      { month: "2026-08-01", amount: 10000 },
    ];

    it("carries the latest earlier target forward", () => {
      const r = buildMonthReport({ ...base, month: "2026-09-01", today: "2026-10-08", targets });
      expect(r.target?.amount).toBe(10000);
    });

    it("uses a target set for the month itself", () => {
      const r = buildMonthReport({ ...base, targets });
      expect(r.target?.amount).toBe(15000);
    });

    it("is null before any target was set", () => {
      const r = buildMonthReport({ ...base, month: "2026-07-01", today: "2026-10-08", targets });
      expect(r.target).toBeNull();
    });

    const september = { ...base, month: "2026-09-01", today: "2026-10-08", targets };
    const sep = (type: Transaction["type"], amount: number) =>
      tx(type, amount, { date: "2026-09-10" });

    it("is achieved for a past month that saved at least the target", () => {
      const r = buildMonthReport({
        ...september,
        current: [sep("income", 30000), sep("expense", 20000)],
      });
      expect(r.target).toMatchObject({ status: "achieved", remaining: 0 });
    });

    it("is missed for a past month that saved less, with the shortfall", () => {
      const r = buildMonthReport({
        ...september,
        current: [sep("income", 30000), sep("expense", 22500)],
      });
      expect(r.target).toMatchObject({ status: "missed", remaining: 2500 });
    });

    // Oct 8 → 24 days left in October, counting today
    const october = { ...base, today: "2026-10-08", targets };

    it("is on track mid-month when saved is above target, with what can still be spent per day", () => {
      const r = buildMonthReport({
        ...october,
        current: [tx("income", 50000), tx("expense", 26000)],
      });
      expect(r.target).toEqual({
        amount: 15000,
        status: "on_track",
        remaining: 0,
        dailyAllowance: 375,
      });
    });

    it("is behind mid-month when saved is below target", () => {
      const r = buildMonthReport({
        ...october,
        current: [tx("income", 50000), tx("expense", 40000)],
      });
      expect(r.target).toEqual({
        amount: 15000,
        status: "behind",
        remaining: 5000,
        dailyAllowance: 0,
      });
    });
  });

  describe("comparison with the previous month", () => {
    const sep = (type: Transaction["type"], amount: number) =>
      tx(type, amount, { date: "2026-09-10" });
    const r = buildMonthReport({
      ...base,
      today: "2026-10-08",
      targets: [{ month: "2026-08-01", amount: 10000 }],
      previous: [sep("income", 40000), sep("expense", 25000)],
      current: [tx("income", 50000), tx("expense", 20000), tx("lending", 3000)],
    });

    it("shows the change in each figure, as an amount and a share of last month", () => {
      expect(r.comparison.income).toEqual({
        current: 50000,
        previous: 40000,
        change: 10000,
        pct: 0.25,
      });
      expect(r.comparison.expense).toEqual({
        current: 20000,
        previous: 25000,
        change: -5000,
        pct: -0.2,
      });
      expect(r.comparison.saved).toEqual({
        current: 30000,
        previous: 15000,
        change: 15000,
        pct: 1,
      });
    });

    it("has no percentage when last month was zero", () => {
      expect(r.comparison.lent).toEqual({ current: 3000, previous: 0, change: 3000, pct: null });
    });

    it("tells whether last month's target was hit", () => {
      expect(r.comparison.previousTarget).toMatchObject({ amount: 10000, status: "achieved" });
    });
  });
});

describe("suggestions", () => {
  const kinds = (input: Parameters<typeof buildMonthReport>[0]) =>
    buildMonthReport(input).suggestions.map((s) => s.kind);

  it("warns when spending more than earning, by how much", () => {
    const r = buildMonthReport({ ...base, current: [tx("income", 20000), tx("expense", 23000)] });
    expect(r.suggestions).toContainEqual({ kind: "overspending", amount: 3000 });
  });

  it("says how much to cut when behind the saving target", () => {
    const r = buildMonthReport({
      ...base,
      today: "2026-10-08",
      targets: [{ month: "2026-10-01", amount: 15000 }],
      current: [tx("income", 50000), tx("expense", 40000)],
    });
    expect(r.suggestions).toContainEqual({ kind: "target_gap", amount: 5000 });
  });

  it("points at the expense category that grew the most since last month", () => {
    const spend = (category: string, amount: number, date = "2026-10-05") =>
      tx("expense", amount, { category, date });
    const r = buildMonthReport({
      ...base,
      previous: [spend("Food", 5000, "2026-09-05"), spend("Transport", 2000, "2026-09-05")],
      current: [tx("income", 100000), spend("Food", 6000), spend("Transport", 5000)],
    });
    expect(r.suggestions).toContainEqual({
      kind: "category_increase",
      category: "Transport",
      amount: 3000,
    });
    expect(r.suggestions.filter((s) => s.kind === "category_increase")).toHaveLength(1);
  });

  it("points at a category that takes a large share of spending", () => {
    const r = buildMonthReport({
      ...base,
      current: [
        tx("income", 100000),
        tx("expense", 15000, { category: "Rent" }),
        tx("expense", 5000, { category: "Food" }),
      ],
    });
    expect(r.suggestions).toContainEqual({ kind: "top_category", category: "Rent", share: 0.75 });
  });

  it("does not flag a top category when spending is spread out", () => {
    const r = buildMonthReport({
      ...base,
      current: [
        tx("income", 100000),
        tx("expense", 3500, { category: "Rent" }),
        tx("expense", 3500, { category: "Food" }),
        tx("expense", 3000, { category: "Transport" }),
      ],
    });
    expect(r.suggestions.map((s) => s.kind)).not.toContain("top_category");
  });

  it("flags a savings rate under 20% of income", () => {
    const r = buildMonthReport({ ...base, current: [tx("income", 50000), tx("expense", 45000)] });
    expect(r.suggestions).toContainEqual({ kind: "low_savings_rate", rate: 0.1 });
  });

  it("leaves the savings rate to the overspending warning when nothing was saved", () => {
    expect(kinds({ ...base, current: [tx("income", 20000), tx("expense", 23000)] })).toEqual([
      "overspending",
    ]);
  });

  it("reminds about pending money to collect and repay, from any month", () => {
    const r = buildMonthReport({
      ...base,
      current: [tx("income", 50000), tx("expense", 10000)],
      outstanding: [
        tx("lending", 3000, { status: "pending", date: "2026-06-01" }),
        tx("lending", 2000, { status: "pending" }),
        tx("lending", 9999, { status: "done" }),
        tx("borrow", 4000, { status: "pending", date: "2026-08-15" }),
      ],
    });
    expect(r.suggestions).toContainEqual({ kind: "collect_lending", amount: 5000, count: 2 });
    expect(r.suggestions).toContainEqual({ kind: "repay_borrow", amount: 4000, count: 1 });
  });

  it("ranks the target first, then where the money went, then reminders", () => {
    expect(
      kinds({
        ...base,
        today: "2026-10-08",
        targets: [{ month: "2026-10-01", amount: 15000 }],
        previous: [tx("expense", 5000, { category: "Food", date: "2026-09-05" })],
        current: [
          tx("income", 50000),
          tx("expense", 30000, { category: "Rent" }),
          tx("expense", 12000, { category: "Food" }),
        ],
        outstanding: [
          tx("lending", 1000, { status: "pending" }),
          tx("borrow", 1000, { status: "pending" }),
        ],
      }),
    ).toEqual([
      "target_gap",
      "category_increase",
      "top_category",
      "low_savings_rate",
      "repay_borrow",
      "collect_lending",
    ]);
  });

  it("has nothing to say about a healthy month", () => {
    expect(kinds({ ...base, current: [tx("income", 50000), tx("expense", 10000)] })).toEqual([]);
  });
});
