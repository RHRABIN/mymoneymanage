import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Plus, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NotesSlider } from "@/components/NotesSlider";
import { RequireAuth } from "@/components/RequireAuth";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, summarize, type Transaction } from "@/lib/finance";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ledger" },
      { name: "description", content: "Your personal finance dashboard with real-time insights." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <Dashboard />
      </AppShell>
    </RequireAuth>
  ),
});

const PIE_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
];

function Dashboard() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const sixMonthsAgo = subMonths(new Date(), 6).toISOString().slice(0, 10);
  const [start, setStart] = useState(sixMonthsAgo);
  const [end, setEnd] = useState(today);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: true });
    if (!error && data) setTxs(data as Transaction[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(
    () => txs.filter((t) => t.date >= start && t.date <= end),
    [txs, start, end],
  );
  const all = summarize(txs);
  const period = summarize(filtered);

  // Balance over time (cumulative)
  const balanceData = useMemo(() => {
    let bal = 0;
    return filtered.map((t) => {
      bal += t.type === "income" ? Number(t.amount) : -Number(t.amount);
      return { date: t.date, balance: Number(bal.toFixed(2)) };
    });
  }, [filtered]);

  // Monthly income vs expense
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    for (const t of filtered) {
      const key = format(startOfMonth(parseISO(t.date)), "yyyy-MM");
      const label = format(parseISO(t.date), "MMM yy");
      const cur = map.get(key) ?? { month: label, income: 0, expense: 0 };
      if (t.type === "income") cur.income += Number(t.amount);
      else cur.expense += Number(t.amount);
      map.set(key, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filtered]);

  // Expense by category
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filtered) {
      if (t.type !== "expense") continue;
      const k = t.category?.trim() || "Uncategorized";
      map.set(k, (map.get(k) ?? 0) + Number(t.amount));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">A snapshot of your financial health.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-gradient-emerald text-primary-foreground shadow-elegant hover:opacity-95">
          <Plus className="mr-2 h-4 w-4" /> Add transaction
        </Button>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:auto-rows-[minmax(140px,auto)]">
        {/* Balance — large */}
        <div className="md:col-span-3 md:row-span-2 rounded-2xl bg-gradient-emerald p-6 text-primary-foreground shadow-elegant">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-90">
            <Wallet className="h-4 w-4" /> Total balance
          </div>
          <p className="mt-3 font-display text-4xl font-semibold md:text-5xl">{fmtMoney(all.balance)}</p>
          <p className="mt-2 text-sm opacity-90">All-time across all transactions.</p>
          <div className="mt-6 h-32 md:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <Line type="monotone" dataKey="balance" stroke="oklch(0.97 0.02 95)" strokeWidth={2.5} dot={false} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
                  formatter={(v: unknown) => fmtMoney(Number(v))}
                />
                <XAxis dataKey="date" tick={{ fill: "oklch(0.97 0.02 95)", fontSize: 10 }} />
                <YAxis tick={{ fill: "oklch(0.97 0.02 95)", fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income */}
        <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Income</span>
            <ArrowUpRight className="h-4 w-4 text-income" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-income">{fmtMoney(period.income)}</p>
          <p className="mt-1 text-xs text-muted-foreground">In selected period</p>
        </div>

        {/* Expense */}
        <div className="md:col-span-1 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expense</span>
            <ArrowDownRight className="h-4 w-4 text-expense" />
          </div>
          <p className="mt-2 font-display text-2xl font-semibold text-expense">{fmtMoney(period.expense)}</p>
        </div>

        {/* Savings */}
        <div className="md:col-span-3 rounded-2xl bg-gradient-gold p-5 text-gold-foreground shadow-gold">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Net savings (period)</span>
          <p className="mt-2 font-display text-3xl font-semibold">{fmtMoney(period.balance)}</p>
          <p className="mt-1 text-xs opacity-80">
            {period.income > 0 ? `${((period.balance / period.income) * 100).toFixed(1)}% saving rate` : "Add income to see saving rate"}
          </p>
        </div>

        {/* Date filter */}
        <div className="md:col-span-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date range</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-xs">Start</Label>
              <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end" className="text-xs">End</Label>
              <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="md:col-span-4 rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-lg font-semibold">Monthly income vs expense</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                  formatter={(v: unknown) => fmtMoney(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" fill="var(--income)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="var(--expense)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart */}
        <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-lg font-semibold">Expense distribution</p>
          <div className="mt-4 h-72">
            {categoryData.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No expenses yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(v: unknown) => fmtMoney(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {loading && txs.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      )}
      {!loading && txs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-display text-lg font-semibold">No transactions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your first entry to see your insights light up.</p>
          <Button onClick={() => setOpen(true)} className="mt-4 bg-gradient-emerald text-primary-foreground hover:opacity-95">
            <Plus className="mr-2 h-4 w-4" /> Add transaction
          </Button>
        </div>
      )}

      {user && (
        <TransactionDialog
          open={open}
          onOpenChange={setOpen}
          userId={user.id}
          onSaved={load}
        />
      )}
    </div>
  );
}
