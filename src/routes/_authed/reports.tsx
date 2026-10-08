import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addMonths, endOfMonth, format, parseISO, subMonths } from "date-fns";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Lightbulb,
  PiggyBank,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtMoney, todayISO, toISODate } from "@/lib/finance";
import {
  useInvalidate,
  useMonthlyTotals,
  usePendingLoans,
  useSavingTargets,
  useTransactionsInRange,
} from "@/lib/queries";
import { buildMonthReport, targetFor, type Suggestion, type TargetStatus } from "@/lib/report";

export const Route = createFileRoute("/_authed/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Ledger" },
      { name: "description", content: "Monthly summary, saving target and where to save more." },
    ],
  }),
  component: Reports,
});

const monthStart = (d: Date) => format(d, "yyyy-MM-01");
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function Reports() {
  const { user } = useAuth();
  const today = todayISO();
  const thisMonth = monthStart(new Date());
  const [month, setMonth] = useState(thisMonth);
  const prevMonth = monthStart(subMonths(parseISO(month), 1));
  const monthEnd = toISODate(endOfMonth(parseISO(month)));

  // Last month and this month in one request, split by date below
  const { data: rows = [], isPending: loading } = useTransactionsInRange(prevMonth, monthEnd);
  const { data: targets = [] } = useSavingTargets();
  const { data: outstanding = [] } = usePendingLoans();
  const { data: monthly = [] } = useMonthlyTotals();

  const report = useMemo(
    () =>
      buildMonthReport({
        month,
        today,
        current: rows.filter((t) => t.date >= month),
        previous: rows.filter((t) => t.date < month),
        targets,
        outstanding,
      }),
    [month, today, rows, targets, outstanding],
  );
  const { summary, target, comparison, suggestions } = report;

  // Saved vs target for the six months up to the selected one
  const trend = useMemo(() => {
    const byMonth = new Map(monthly.map((m) => [m.month, m]));
    return Array.from({ length: 6 }, (_, i) => {
      const m = monthStart(subMonths(parseISO(month), 5 - i));
      const row = byMonth.get(m);
      return {
        month: format(parseISO(m), "MMM yy"),
        saved: row ? Number(row.income) - Number(row.expense) : 0,
        target: targetFor(m, targets),
      };
    });
  }, [monthly, targets, month]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How the month went and where to save more.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonth(prevMonth)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center font-display text-lg font-semibold">
            {format(parseISO(month), "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => setMonth(monthStart(addMonths(parseISO(month), 1)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Income" value={summary.income} tone="text-income" loading={loading} />
        <StatCard label="Expense" value={summary.expense} tone="text-expense" loading={loading} />
        <StatCard label="Lent" value={summary.lent} tone="text-lending" loading={loading} />
        <StatCard label="Borrowed" value={summary.borrowed} tone="text-borrow" loading={loading} />
        <div className="col-span-2 rounded-2xl bg-gradient-gold p-5 text-gold-foreground shadow-gold md:col-span-1">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Saved</span>
          <div className="mt-2 font-display text-2xl font-semibold">
            {loading ? <Skeleton className="h-8 w-32 bg-black/10" /> : fmtMoney(summary.saved)}
          </div>
          <p className="mt-1 text-xs opacity-80">
            {summary.income > 0 ? `${pct(summary.savingsRate)} of income` : "No income yet"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TargetCard
          key={month}
          month={month}
          userId={user?.id}
          saved={summary.saved}
          target={target}
        />
        <ComparisonCard comparison={comparison} prevMonth={prevMonth} />
      </div>

      {/* Suggestions */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <Lightbulb className="h-5 w-5 text-gold" /> Where to focus
        </p>
        {suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing stands out this month. Keep it up!
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {suggestions.map((s) => (
              <SuggestionItem key={s.kind} s={s} current={month === thisMonth} />
            ))}
          </ul>
        )}
      </div>

      {/* Trend */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <TrendingUp className="h-5 w-5" /> Saved vs target, last 6 months
        </p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
                formatter={(v: unknown) => fmtMoney(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="saved" name="Saved" fill="var(--income)" radius={[6, 6, 0, 0]} />
              <Line
                dataKey="target"
                name="Target"
                type="stepAfter"
                stroke="var(--gold)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className={`mt-2 font-display text-2xl font-semibold ${tone}`}>
        {loading ? <Skeleton className="h-8 w-28" /> : fmtMoney(value)}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<TargetStatus, { text: string; className: string }> = {
  achieved: { text: "Achieved", className: "bg-income/15 text-income" },
  on_track: { text: "On track", className: "bg-income/15 text-income" },
  behind: { text: "Behind", className: "bg-gold/20 text-gold-foreground" },
  missed: { text: "Missed", className: "bg-expense/15 text-expense" },
};

function StatusBadge({ status }: { status: TargetStatus }) {
  const s = STATUS_LABEL[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.text}
    </span>
  );
}

type Report = ReturnType<typeof buildMonthReport>;

function TargetCard({
  month,
  userId,
  saved,
  target,
}: {
  month: string;
  userId: string | undefined;
  saved: number;
  target: Report["target"];
}) {
  const invalidate = useInvalidate();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const current = target?.amount;
  useEffect(() => setAmount(current === undefined ? "" : String(current)), [current]);

  const save = async () => {
    const value = Number(amount);
    if (!userId || !Number.isFinite(value) || value < 0) {
      toast.error("Enter a target of 0 or more");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("saving_targets")
      .upsert({ user_id: userId, month, amount: value }, { onConflict: "user_id,month" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saving target updated");
    invalidate.savingTargets();
  };

  const progress =
    target && target.amount > 0 ? Math.min(1, Math.max(0, saved / target.amount)) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <Target className="h-5 w-5" /> Saving target
        </p>
        {target && <StatusBadge status={target.status} />}
      </div>

      {target ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            Saved <span className="font-semibold text-foreground">{fmtMoney(saved)}</span> of{" "}
            <span className="font-semibold text-foreground">{fmtMoney(target.amount)}</span>
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${target.remaining > 0 ? "bg-gold" : "bg-income"}`}
              style={{ width: pct(progress) }}
            />
          </div>
          <p className="mt-2 text-sm">
            {target.status === "on_track" &&
              `You can spend up to ${fmtMoney(target.dailyAllowance ?? 0)} a day for the rest of the month and still hit it.`}
            {target.status === "behind" &&
              `${fmtMoney(target.remaining)} more to save. Cut spending or add income to catch up.`}
            {target.status === "achieved" && "Target reached. Well done!"}
            {target.status === "missed" && `Missed by ${fmtMoney(target.remaining)}.`}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No target yet. Set one to track your saving each month.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Input
          type="number"
          min={0}
          inputMode="decimal"
          placeholder="Target amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button onClick={save} disabled={saving || amount === ""}>
          {target ? "Update" : "Set"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Applies from {format(parseISO(month), "MMMM")} onward until you change it.
      </p>
    </div>
  );
}

function ComparisonCard({
  comparison,
  prevMonth,
}: {
  comparison: Report["comparison"];
  prevMonth: string;
}) {
  // For expense, lending and borrowing, going down is the good direction
  const rows = [
    { label: "Income", c: comparison.income, upIsGood: true },
    { label: "Expense", c: comparison.expense, upIsGood: false },
    { label: "Saved", c: comparison.saved, upIsGood: true },
    { label: "Lent", c: comparison.lent, upIsGood: false },
    { label: "Borrowed", c: comparison.borrowed, upIsGood: false },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-lg font-semibold">vs {format(parseISO(prevMonth), "MMMM")}</p>
      <ul className="mt-3 divide-y divide-border">
        {rows.map(({ label, c, upIsGood }) => {
          const good = c.change === 0 ? null : c.change > 0 === upIsGood;
          const Icon = c.change >= 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <li key={label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{fmtMoney(c.previous)} →</span>
                <span className="font-semibold">{fmtMoney(c.current)}</span>
                <span
                  className={`flex w-24 items-center justify-end gap-0.5 text-xs font-semibold ${
                    good === null ? "text-muted-foreground" : good ? "text-income" : "text-expense"
                  }`}
                >
                  {c.change !== 0 && <Icon className="h-3.5 w-3.5" />}
                  {c.pct === null ? (c.change === 0 ? "—" : "new") : pct(Math.abs(c.pct))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        Last month's target:
        {comparison.previousTarget ? (
          <StatusBadge status={comparison.previousTarget.status} />
        ) : (
          <span>not set</span>
        )}
      </p>
    </div>
  );
}

function SuggestionItem({ s, current }: { s: Suggestion; current: boolean }) {
  const { icon: Icon, text } = describe(s, current);
  return (
    <li className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{text}</span>
    </li>
  );
}

function describe(s: Suggestion, current: boolean) {
  switch (s.kind) {
    case "overspending":
      return {
        icon: AlertTriangle,
        text: `You spent ${fmtMoney(s.amount)} more than you earned. Look for expenses you can drop first.`,
      };
    case "target_gap":
      return {
        icon: Target,
        text: current
          ? `Cut ${fmtMoney(s.amount)} from spending this month to reach your saving target.`
          : `You were ${fmtMoney(s.amount)} short of your saving target.`,
      };
    case "category_increase":
      return {
        icon: TrendingUp,
        text: `${s.category} went up by ${fmtMoney(s.amount)} compared with last month. That's the first place to cut back.`,
      };
    case "top_category":
      return {
        icon: PiggyBank,
        text: `${s.category} is ${pct(s.share)} of your spending. Even a small cut here saves the most.`,
      };
    case "low_savings_rate":
      return {
        icon: PiggyBank,
        text: `You saved ${pct(s.rate)} of your income. Aim for at least 20%.`,
      };
    case "repay_borrow":
      return {
        icon: HandCoins,
        text: `You still owe ${fmtMoney(s.amount)} across ${s.count} borrowing${s.count > 1 ? "s" : ""}. Plan repayments before new spending.`,
      };
    case "collect_lending":
      return {
        icon: HandCoins,
        text: `${fmtMoney(s.amount)} you lent (${s.count} pending) hasn't come back yet. Follow up to collect it.`,
      };
  }
}
