import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { fmtMoney, type Transaction } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function CalendarView({ cursor, txs }: { cursor: Date; txs: Transaction[] }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) });
  const map = new Map<string, { inc: number; exp: number }>();
  for (const t of txs) {
    const cur = map.get(t.date) ?? { inc: 0, exp: 0 };
    if (t.type === "income") cur.inc += Number(t.amount);
    else if (t.type === "expense") cur.exp += Number(t.amount);
    map.set(t.date, cur);
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const v = map.get(key);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[64px] border-b border-r border-border p-1.5 text-[10px]",
                !isSameMonth(d, cursor) && "bg-muted/20 text-muted-foreground/60",
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
