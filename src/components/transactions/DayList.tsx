import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMoney, typeColorClass } from "@/lib/finance";
import type { TransactionWithUsed } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { PaymentBadge, StatusBadge, TypeBadge } from "./badges";

const ROW_PILL = "px-1.5 py-0 text-[9px] sm:text-[10px]";

// Transactions grouped by day, newest day first
export function DayList({
  txs,
  onOpen,
  onEdit,
  onDelete,
}: {
  txs: TransactionWithUsed[];
  onOpen: (t: TransactionWithUsed) => void;
  onEdit: (t: TransactionWithUsed) => void;
  onDelete: (t: TransactionWithUsed) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, TransactionWithUsed[]>();
    for (const t of txs) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [txs]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {byDay.map(([day, items]) => {
          const dayInc = items
            .filter((i) => i.type === "income")
            .reduce((s, t) => s + Number(t.amount), 0);
          const dayExp = items
            .filter((i) => i.type === "expense")
            .reduce((s, t) => s + Number(t.amount), 0);
          const d = parseISO(day);
          return (
            <li key={day}>
              {/* Day header */}
              <div className="flex items-center gap-2 bg-muted/30 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
                <span className="font-display text-lg font-bold leading-none sm:text-2xl">
                  {format(d, "d")}
                </span>
                <div className="flex min-w-0 flex-col text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                  <span>{format(d, "yyyy/MM")}</span>
                  <span className="mt-0.5 inline-block w-fit rounded-md bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide sm:text-[10px]">
                    {format(d, "EEE")}
                  </span>
                </div>
                <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5 text-[10px] leading-tight sm:flex-row sm:items-center sm:gap-3 sm:text-sm">
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
                  <TransactionRow
                    key={t.id}
                    t={t}
                    onOpen={onOpen}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TransactionRow({
  t,
  onOpen,
  onEdit,
  onDelete,
}: {
  t: TransactionWithUsed;
  onOpen: (t: TransactionWithUsed) => void;
  onEdit: (t: TransactionWithUsed) => void;
  onDelete: (t: TransactionWithUsed) => void;
}) {
  const used = Number(t.used);
  const remaining = Number(t.amount) - used;
  // Arrow shows money direction: in for income/borrow, out for expense/lending
  const isInflow = t.type === "income" || t.type === "borrow";
  return (
    <li
      onClick={() => onOpen(t)}
      className="flex cursor-pointer items-start gap-2 px-3 py-3 transition-colors hover:bg-muted/30 sm:items-center sm:gap-3 sm:px-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={t.type} className={ROW_PILL} />
          <StatusBadge status={t.status} className={ROW_PILL} />
          <PaymentBadge method={t.payment_method} className={ROW_PILL} iconClassName="h-3 w-3" />
        </div>
        <p className="mt-1 break-all text-sm font-medium text-foreground sm:text-base">{t.title}</p>
        {used > 0 && (
          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
            Used <span className="text-expense">{fmtMoney(used)}</span> · Remaining{" "}
            <span className={remaining < 0 ? "text-destructive" : "text-income"}>
              {fmtMoney(remaining)}
            </span>
          </p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 font-display text-sm font-semibold sm:inline-flex sm:items-center sm:gap-0.5 sm:text-base",
          typeColorClass(t.type),
        )}
      >
        {isInflow ? (
          <ArrowUpRight className="hidden h-4 w-4 sm:inline" />
        ) : (
          <ArrowDownRight className="hidden h-4 w-4 sm:inline" />
        )}
        {fmtMoney(Number(t.amount))}
      </span>
      <div
        className="flex shrink-0 flex-col gap-0.5 sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onEdit(t)}
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onDelete(t)}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
