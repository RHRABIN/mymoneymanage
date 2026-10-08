import { differenceInCalendarDays, endOfMonth, format, parseISO, subMonths } from "date-fns";
import { summarize, type Transaction } from "./finance";

// A saving target for a month (YYYY-MM-01); it carries forward until another is set.
export type SavingTarget = { month: string; amount: number };

export type MonthReportInput = {
  month: string; // YYYY-MM-01
  today: string; // YYYY-MM-DD
  current: Transaction[]; // transactions dated in `month`
  previous: Transaction[]; // transactions dated in the month before
  targets: SavingTarget[];
  outstanding: Transaction[]; // pending lending/borrow from any month
};

// The target in force for a month: the latest one set on or before it
export function targetFor(month: string, targets: SavingTarget[]) {
  let found: SavingTarget | null = null;
  for (const t of targets) {
    if (t.month <= month && (!found || t.month > found.month)) found = t;
  }
  return found ? Number(found.amount) : null;
}

export type TargetStatus = "achieved" | "missed" | "on_track" | "behind";

function targetProgress(month: string, today: string, amount: number, saved: number) {
  const remaining = Math.max(0, amount - saved);
  if (today.slice(0, 7) !== month.slice(0, 7)) {
    const status: TargetStatus = saved >= amount ? "achieved" : "missed";
    return { amount, status, remaining, dailyAllowance: null };
  }
  // Still running: what can be spent per remaining day (today included) and stay on target
  const daysLeft = differenceInCalendarDays(endOfMonth(parseISO(month)), parseISO(today)) + 1;
  const status: TargetStatus = saved >= amount ? "on_track" : "behind";
  return { amount, status, remaining, dailyAllowance: Math.max(0, saved - amount) / daysLeft };
}

function monthSummary(txs: Transaction[]) {
  const { income, expense, lent, borrowed, balance: saved } = summarize(txs);
  return { income, expense, lent, borrowed, saved, savingsRate: income > 0 ? saved / income : 0 };
}

function progressFor(month: string, today: string, targets: SavingTarget[], saved: number) {
  const amount = targetFor(month, targets);
  return amount === null ? null : targetProgress(month, today, amount, saved);
}

const change = (current: number, previous: number) => ({
  current,
  previous,
  change: current - previous,
  pct: previous === 0 ? null : (current - previous) / previous,
});

export type Suggestion =
  | { kind: "overspending"; amount: number }
  | { kind: "target_gap"; amount: number }
  | { kind: "category_increase"; category: string; amount: number }
  | { kind: "top_category"; category: string; share: number }
  | { kind: "low_savings_rate"; rate: number }
  | { kind: "collect_lending" | "repay_borrow"; amount: number; count: number };

// A single category taking at least this share of spending is worth a look
const TOP_CATEGORY_SHARE = 0.4;
// Common rule of thumb: save at least a fifth of income
const MIN_SAVINGS_RATE = 0.2;

export const UNCATEGORIZED = "Uncategorized";

function expenseByCategory(txs: Transaction[]) {
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const c = t.category ?? UNCATEGORIZED;
    totals.set(c, (totals.get(c) ?? 0) + Number(t.amount));
  }
  return totals;
}

// Nothing to compare against when last month had no expenses at all
function biggestIncrease(current: Map<string, number>, previous: Map<string, number>) {
  if (previous.size === 0) return null;
  let best: { category: string; amount: number } | null = null;
  for (const [category, amount] of current) {
    const grew = amount - (previous.get(category) ?? 0);
    if (grew > 0 && (!best || grew > best.amount)) best = { category, amount: grew };
  }
  return best;
}

function topCategory(byCategory: Map<string, number>, totalExpense: number) {
  if (byCategory.size < 2) return null;
  const [category, amount] = [...byCategory].reduce((a, b) => (b[1] > a[1] ? b : a));
  const share = amount / totalExpense;
  return share >= TOP_CATEGORY_SHARE ? { category, share } : null;
}

function pending(txs: Transaction[], type: "lending" | "borrow") {
  const open = txs.filter((t) => t.type === type && t.status === "pending");
  return { amount: open.reduce((sum, t) => sum + Number(t.amount), 0), count: open.length };
}

// Most urgent first: losing money, missing the target, where it went, then reminders
const PRIORITY: Suggestion["kind"][] = [
  "overspending",
  "target_gap",
  "category_increase",
  "top_category",
  "low_savings_rate",
  "repay_borrow",
  "collect_lending",
];

type Summary = ReturnType<typeof monthSummary>;
type Progress = ReturnType<typeof progressFor>;

function suggestionsFor(input: MonthReportInput, summary: Summary, target: Progress) {
  const out: Suggestion[] = [];
  if (summary.expense > summary.income) {
    out.push({ kind: "overspending", amount: summary.expense - summary.income });
  } else if (summary.income > 0 && summary.savingsRate < MIN_SAVINGS_RATE) {
    out.push({ kind: "low_savings_rate", rate: summary.savingsRate });
  }
  if (target && target.remaining > 0) {
    out.push({ kind: "target_gap", amount: target.remaining });
  }
  const increase = biggestIncrease(
    expenseByCategory(input.current),
    expenseByCategory(input.previous),
  );
  if (increase) out.push({ kind: "category_increase", ...increase });
  const top = topCategory(expenseByCategory(input.current), summary.expense);
  if (top) out.push({ kind: "top_category", ...top });
  const lent = pending(input.outstanding, "lending");
  if (lent.count) out.push({ kind: "collect_lending", ...lent });
  const borrowed = pending(input.outstanding, "borrow");
  if (borrowed.count) out.push({ kind: "repay_borrow", ...borrowed });
  return out.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
}

export function buildMonthReport(input: MonthReportInput) {
  const { month, today, targets } = input;
  const summary = monthSummary(input.current);
  const prev = monthSummary(input.previous);
  const prevMonth = format(subMonths(parseISO(month), 1), "yyyy-MM-01");
  const target = progressFor(month, today, targets, summary.saved);
  return {
    summary,
    target,
    suggestions: suggestionsFor(input, summary, target),
    comparison: {
      income: change(summary.income, prev.income),
      expense: change(summary.expense, prev.expense),
      lent: change(summary.lent, prev.lent),
      borrowed: change(summary.borrowed, prev.borrowed),
      saved: change(summary.saved, prev.saved),
      previousTarget: progressFor(prevMonth, today, targets, prev.saved),
    },
  };
}
