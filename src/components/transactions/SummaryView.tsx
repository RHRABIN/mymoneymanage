import { fmtMoney, type Transaction } from "@/lib/finance";
import { EmptyState } from "./EmptyState";

// Expenses by category for the period
export function SummaryView({ txs }: { txs: Transaction[] }) {
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
