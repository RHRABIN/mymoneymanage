import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, type Transaction } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Ledger" },
      { name: "description", content: "Manage your income and expense transactions." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <TransactionsPage />
      </AppShell>
    </RequireAuth>
  ),
});

type TabKey = "daily" | "calendar" | "weekly" | "monthly" | "summary";
const TABS: { key: TabKey; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "calendar", label: "Calendar" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "summary", label: "Summary" },
];

function TransactionsPage() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("daily");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    if (!error && data) setTxs(data as Transaction[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Filter to current month for daily/calendar views
  const monthTxs = useMemo(
    () => txs.filter((t) => isSameMonth(parseISO(t.date), cursor)),
    [txs, cursor],
  );

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of monthTxs) {
      if (t.type === "income") income += Number(t.amount);
      else expense += Number(t.amount);
    }
    return { income, expense, total: income - expense };
  }, [monthTxs]);

  // Group by day, descending
  const byDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of monthTxs) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [monthTxs]);

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("transactions").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else { toast.success("Transaction deleted"); load(); }
    setToDelete(null);
  };

  const goPrev = () => setCursor((d) => (tab === "weekly" ? subWeeks(d, 1) : subMonths(d, 1)));
  const goNext = () => setCursor((d) => (tab === "weekly" ? addWeeks(d, 1) : addMonths(d, 1)));
  const headerLabel = tab === "weekly"
    ? `${format(startOfWeek(cursor), "MMM d")} – ${format(endOfWeek(cursor), "MMM d, yyyy")}`
    : format(cursor, "MMM yyyy");

  return (
    <div className="space-y-4">
      {/* Title bar */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Transaction</h1>
      </header>

      {/* Period nav */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-2 py-2">
        <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Previous">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-display text-base font-semibold">{headerLabel}</span>
        <Button variant="ghost" size="icon" onClick={goNext} aria-label="Next">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="flex min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex-1 px-4 py-3 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-emerald" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="mt-1 font-display text-sm font-semibold text-income sm:text-base">
            {fmtMoney(totals.income)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="mt-1 font-display text-sm font-semibold text-expense sm:text-base">
            {fmtMoney(totals.expense)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 font-display text-sm font-semibold sm:text-base">
            {fmtMoney(totals.total)}
          </p>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : tab === "calendar" ? (
        <CalendarView cursor={cursor} txs={monthTxs} />
      ) : tab === "monthly" ? (
        <MonthlyView txs={txs} />
      ) : tab === "summary" ? (
        <SummaryView txs={monthTxs} />
      ) : byDay.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {byDay.map(([day, items]) => {
              const dayInc = items.filter((i) => i.type === "income").reduce((s, t) => s + Number(t.amount), 0);
              const dayExp = items.filter((i) => i.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
              const d = parseISO(day);
              return (
                <li key={day}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 bg-muted/30 px-3 py-2.5 sm:gap-3 sm:px-4">
                    <span className="font-display text-xl font-bold leading-none sm:text-2xl">{format(d, "d")}</span>
                    <div className="flex min-w-0 flex-col text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                      <span>{format(d, "yyyy/MM")}</span>
                      <span className="mt-0.5 inline-block w-fit rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                        {format(d, "EEE")}
                      </span>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px] sm:gap-3 sm:text-sm">
                      <span className="inline-flex items-center gap-0.5 text-income">
                        <ArrowUpRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        {fmtMoney(dayInc)}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-expense">
                        <ArrowDownRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        {fmtMoney(dayExp)}
                      </span>
                    </div>
                  </div>

                  {/* Day items */}
                  <ul className="divide-y divide-border/60">
                    {items.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 px-3 py-3 sm:items-center sm:gap-3 sm:px-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                            {t.category || (t.type === "income" ? "Income" : "Expense")}
                          </p>
                          <p className="break-all text-sm font-medium text-foreground sm:text-base">{t.title}</p>
                          <span
                            className={cn(
                              "mt-1 inline-flex items-center gap-0.5 font-display text-sm font-semibold sm:hidden",
                              t.type === "income" ? "text-income" : "text-expense",
                            )}
                          >
                            {t.type === "income" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {fmtMoney(Number(t.amount))}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "hidden shrink-0 font-display text-sm font-semibold sm:inline-flex sm:items-center sm:gap-0.5 sm:text-base",
                            t.type === "income" ? "text-income" : "text-expense",
                          )}
                        >
                          {t.type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {fmtMoney(Number(t.amount))}
                        </span>
                        <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setOpen(true); }} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setToDelete(t)} aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {user && (
        <TransactionDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          userId={user.id}
          initial={editing}
          onSaved={load}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && <>“{toDelete.title}” will be permanently removed.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Add button */}
      <Button
        onClick={() => { setEditing(null); setOpen(true); }}
        aria-label="Add transaction"
        className="fixed bottom-20 left-4 z-40 h-14 w-14 rounded-full bg-gradient-emerald p-0 text-primary-foreground shadow-elegant hover:opacity-95 sm:bottom-6 sm:left-6"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-lg font-semibold">No transactions</p>
      <p className="mt-1 text-sm text-muted-foreground">Add a new entry or change the period.</p>
    </div>
  );
}

function CalendarView({ cursor, txs }: { cursor: Date; txs: Transaction[] }) {
  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  const days = eachDayOfInterval({ start, end });
  const map = new Map<string, { inc: number; exp: number }>();
  for (const t of txs) {
    const k = t.date;
    const cur = map.get(k) ?? { inc: 0, exp: 0 };
    if (t.type === "income") cur.inc += Number(t.amount);
    else cur.exp += Number(t.amount);
    map.set(k, cur);
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const v = map.get(key);
          const inMonth = isSameMonth(d, cursor);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[64px] border-b border-r border-border p-1.5 text-[10px]",
                !inMonth && "bg-muted/20 text-muted-foreground/60",
              )}
            >
              <div className="font-display text-xs font-semibold">{format(d, "d")}</div>
              {v && (
                <div className="mt-0.5 space-y-0.5 leading-tight">
                  {v.inc > 0 && <div className="truncate text-income">+{fmtMoney(v.inc)}</div>}
                  {v.exp > 0 && <div className="truncate text-expense">-{fmtMoney(v.exp)}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyView({ txs }: { txs: Transaction[] }) {
  const map = new Map<string, { inc: number; exp: number }>();
  for (const t of txs) {
    const k = format(parseISO(t.date), "yyyy-MM");
    const cur = map.get(k) ?? { inc: 0, exp: 0 };
    if (t.type === "income") cur.inc += Number(t.amount);
    else cur.exp += Number(t.amount);
    map.set(k, cur);
  }
  const rows = [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-display text-sm font-semibold">{format(parseISO(k + "-01"), "MMM yyyy")}</span>
            <div className="flex gap-4 text-sm">
              <span className="text-income">+{fmtMoney(v.inc)}</span>
              <span className="text-expense">-{fmtMoney(v.exp)}</span>
              <span className="font-semibold">{fmtMoney(v.inc - v.exp)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryView({ txs }: { txs: Transaction[] }) {
  const cats = new Map<string, number>();
  let totalExp = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const k = t.category || "Uncategorized";
    cats.set(k, (cats.get(k) ?? 0) + Number(t.amount));
    totalExp += Number(t.amount);
  }
  const rows = [...cats.entries()].sort(([, a], [, b]) => b - a);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {rows.map(([k, v]) => {
          const pct = totalExp ? Math.round((v / totalExp) * 100) : 0;
          return (
            <li key={k} className="px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{k}</span>
                <span className="font-display font-semibold text-expense">-{fmtMoney(v)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-emerald" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{pct}% of expenses</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
