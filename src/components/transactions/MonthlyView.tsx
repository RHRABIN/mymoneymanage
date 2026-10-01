import { format, parseISO } from "date-fns";
import { fmtMoney } from "@/lib/finance";
import { useMonthlyTotals } from "@/lib/queries";
import { EmptyState } from "./EmptyState";

// Income/expense per month across all time, summed in the database
export function MonthlyView() {
  const { data: rows, isPending } = useMonthlyTotals();
  if (isPending) return <p className="text-center text-sm text-muted-foreground">Loading…</p>;
  if (!rows?.length) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const inc = Number(r.income);
          const exp = Number(r.expense);
          return (
            <li key={r.month} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-display text-sm font-semibold">
                {format(parseISO(r.month), "MMM yyyy")}
              </span>
              <div className="flex gap-4 text-sm">
                <span className="text-income">+{fmtMoney(inc)}</span>
                <span className="text-expense">-{fmtMoney(exp)}</span>
                <span className="font-semibold">{fmtMoney(inc - exp)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
