import { fmtMoney, type summarize } from "@/lib/finance";

export function PeriodTotals({ totals }: { totals: ReturnType<typeof summarize> }) {
  const cells = [
    { label: "Income", value: totals.income, cls: "text-income" },
    { label: "Expenses", value: totals.expense, cls: "text-expense" },
    { label: "Total", value: totals.balance, cls: "" },
  ];
  return (
    <>
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card px-2 py-3 text-center sm:px-3 sm:py-4">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0">
            <p className="text-[10px] text-muted-foreground sm:text-xs">{c.label}</p>
            <p className={`mt-1 truncate font-display text-xs font-semibold sm:text-base ${c.cls}`}>
              {fmtMoney(c.value)}
            </p>
          </div>
        ))}
      </div>
      {(totals.lent > 0 || totals.borrowed > 0) && (
        <p className="-mt-2 text-center text-[11px] text-muted-foreground sm:text-xs">
          Not in totals: lent <span className="text-lending">{fmtMoney(totals.lent)}</span> ·
          borrowed <span className="text-borrow">{fmtMoney(totals.borrowed)}</span>
        </p>
      )}
    </>
  );
}
