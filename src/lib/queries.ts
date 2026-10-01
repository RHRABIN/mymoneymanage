import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TransactionWithUsed = Tables<"transactions_with_used">;

// Everything derived from transactions lives under "transactions", so one
// invalidation refreshes lists, totals and categories together.
export const queryKeys = {
  transactions: ["transactions"] as const,
  transactionsInRange: (start: string, end: string) => ["transactions", "range", start, end] as const,
  monthlyTotals: ["transactions", "monthly"] as const,
  balanceTotals: (start: string) => ["transactions", "balance", start] as const,
  categories: ["transactions", "categories"] as const,
  subTransactions: (txId: string) => ["sub_transactions", txId] as const,
  notes: (limit?: number) => ["notes", limit ?? "all"] as const,
};

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// Transactions dated within [start, end], most recently updated first
export function useTransactionsInRange(start: string, end: string) {
  return useQuery({
    queryKey: queryKeys.transactionsInRange(start, end),
    queryFn: () =>
      unwrap(
        supabase
          .from("transactions_with_used")
          .select("*")
          .gte("date", start)
          .lte("date", end)
          .order("updated_at", { ascending: false }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useMonthlyTotals(enabled = true) {
  return useQuery({
    queryKey: queryKeys.monthlyTotals,
    queryFn: () => unwrap(supabase.rpc("monthly_totals")),
    enabled,
  });
}

export function useBalanceTotals(start: string) {
  return useQuery({
    queryKey: queryKeys.balanceTotals(start),
    queryFn: async () => {
      const rows = await unwrap(supabase.rpc("balance_totals", { p_start: start }));
      const r = rows[0];
      return {
        total: Number(r?.total ?? 0),
        opening: Number(r?.opening ?? 0),
        count: Number(r?.tx_count ?? 0),
      };
    },
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => unwrap(supabase.rpc("user_categories")),
  });
}

export function useSubTransactions(txId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.subTransactions(txId ?? ""),
    queryFn: () =>
      unwrap(
        supabase
          .from("sub_transactions")
          .select("*")
          .eq("transaction_id", txId!)
          .order("date", { ascending: false }),
      ),
    enabled: !!txId,
  });
}

export function useNotes(limit?: number) {
  return useQuery({
    queryKey: queryKeys.notes(limit),
    queryFn: () => {
      const q = supabase.from("notes").select("*").order("created_at", { ascending: false });
      return unwrap(limit ? q.limit(limit) : q);
    },
  });
}

// Refresh cached data after a write
export function useInvalidate() {
  const qc = useQueryClient();
  return {
    transactions: () => qc.invalidateQueries({ queryKey: queryKeys.transactions }),
    subTransactions: (txId: string) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.subTransactions(txId) }),
        qc.invalidateQueries({ queryKey: queryKeys.transactions }),
      ]),
    notes: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  };
}
