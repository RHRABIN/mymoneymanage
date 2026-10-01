import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TxStatus, TxType } from "@/lib/finance";
import { cn } from "@/lib/utils";

export type StatusFilter = "all" | TxStatus;
export type TypeFilter = "all" | TxType;

const PILL_GROUP =
  "flex items-center gap-1 overflow-x-auto whitespace-nowrap rounded-full border border-border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const PILL = "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors";

const STATUS_ACTIVE: Record<StatusFilter, string> = {
  all: "bg-primary/15 text-foreground",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
const TYPE_ACTIVE: Record<TypeFilter, string> = {
  all: "bg-primary/15 text-foreground",
  income: "bg-income/15 text-income",
  expense: "bg-expense/15 text-expense",
  lending: "bg-lending/15 text-lending",
  borrow: "bg-borrow/15 text-borrow",
};

const label = (s: string) => (s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1));

export function TransactionFilters({
  search,
  onSearch,
  status,
  onStatus,
  type,
  onType,
}: {
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  type: TypeFilter;
  onType: (v: TypeFilter) => void;
}) {
  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by title, category or amount"
          className="h-10 rounded-2xl border-border bg-card pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status + Type filters (responsive, horizontally scrollable) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className={PILL_GROUP}>
          {(Object.keys(STATUS_ACTIVE) as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={cn(
                PILL,
                status === s ? STATUS_ACTIVE[s] : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label(s)}
            </button>
          ))}
        </div>
        <div className={cn(PILL_GROUP, "sm:flex-1")}>
          {(Object.keys(TYPE_ACTIVE) as TypeFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => onType(s)}
              className={cn(
                PILL,
                type === s ? TYPE_ACTIVE[s] : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label(s)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
