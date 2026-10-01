import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TransactionDialog } from "@/components/TransactionDialog";
import { TransactionDetailsSheet } from "@/components/TransactionDetailsSheet";
import { CalendarView } from "@/components/transactions/CalendarView";
import { DayList } from "@/components/transactions/DayList";
import { EmptyState } from "@/components/transactions/EmptyState";
import { MonthlyView } from "@/components/transactions/MonthlyView";
import { PeriodTotals } from "@/components/transactions/PeriodTotals";
import { SummaryView } from "@/components/transactions/SummaryView";
import {
  TransactionFilters,
  type StatusFilter,
  type TypeFilter,
} from "@/components/transactions/TransactionFilters";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { summarize, toISODate } from "@/lib/finance";
import { useInvalidate, useTransactionsInRange, type TransactionWithUsed } from "@/lib/queries";
import { deleteWithUndo, useHiddenIds } from "@/lib/undo-delete";
import { ListSkeleton } from "@/components/ListSkeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Ledger" },
      {
        name: "description",
        content: "Manage your income, expense, lending and borrowing transactions.",
      },
    ],
  }),
  component: TransactionsPage,
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
  const invalidate = useInvalidate();
  const [tab, setTab] = useState<TabKey>("daily");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithUsed | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // The visible period: the cursor's week on the weekly tab, its month otherwise
  const isWeekly = tab === "weekly";
  const periodStart = isWeekly ? startOfWeek(cursor) : startOfMonth(cursor);
  const periodEnd = isWeekly ? endOfWeek(cursor) : endOfMonth(cursor);
  const { data: rows = [], isPending } = useTransactionsInRange(
    toISODate(periodStart),
    toISODate(periodEnd),
  );

  const hiddenIds = useHiddenIds();
  const periodTxs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((t) => {
      if (hiddenIds.has(t.id)) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      );
    });
  }, [rows, hiddenIds, search, statusFilter, typeFilter]);

  const totals = useMemo(() => summarize(periodTxs), [periodTxs]);
  // Look the open transaction up in fresh data so the sheet reflects edits
  const detailsTx = rows.find((t) => t.id === detailsId) ?? null;

  // Sub-transactions go with it (ON DELETE CASCADE)
  const handleDelete = (t: TransactionWithUsed) => {
    if (detailsId === t.id) setDetailsId(null);
    deleteWithUndo({
      id: t.id,
      message: `"${t.title}" deleted`,
      run: () => supabase.from("transactions").delete().eq("id", t.id),
      onDeleted: invalidate.transactions,
    });
  };

  const goPrev = () => setCursor((d) => (isWeekly ? subWeeks(d, 1) : subMonths(d, 1)));
  const goNext = () => setCursor((d) => (isWeekly ? addWeeks(d, 1) : addMonths(d, 1)));
  const headerLabel = isWeekly
    ? `${format(periodStart, "MMM d")} – ${format(periodEnd, "MMM d, yyyy")}`
    : format(cursor, "MMM yyyy");

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Transactions
        </h1>
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

      <TransactionFilters
        search={search}
        onSearch={setSearch}
        status={statusFilter}
        onStatus={setStatusFilter}
        type={typeFilter}
        onType={setTypeFilter}
      />

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
                  "relative flex-1 px-2 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:py-3 sm:text-sm",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-emerald sm:inset-x-3" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <PeriodTotals totals={totals} />

      {/* Body */}
      {tab === "monthly" ? (
        <MonthlyView />
      ) : isPending ? (
        <ListSkeleton rows={4} />
      ) : tab === "calendar" ? (
        <CalendarView cursor={cursor} txs={periodTxs} />
      ) : tab === "summary" ? (
        <SummaryView txs={periodTxs} />
      ) : periodTxs.length === 0 ? (
        <EmptyState />
      ) : (
        <DayList
          txs={periodTxs}
          onOpen={(t) => setDetailsId(t.id)}
          onEdit={(t) => {
            setEditing(t);
            setOpen(true);
          }}
          onDelete={handleDelete}
        />
      )}

      {user && (
        <TransactionDialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
          userId={user.id}
          initial={editing}
        />
      )}

      {user && (
        <TransactionDetailsSheet
          tx={detailsTx}
          open={!!detailsTx}
          onOpenChange={(v) => !v && setDetailsId(null)}
          userId={user.id}
        />
      )}

      {/* Floating Add button */}
      <Button
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
        aria-label="Add transaction"
        className="fixed bottom-20 right-4 z-40 h-10 w-10 rounded-full bg-gradient-emerald p-0 text-primary-foreground shadow-elegant hover:opacity-95 sm:bottom-6 sm:right-6"
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}
