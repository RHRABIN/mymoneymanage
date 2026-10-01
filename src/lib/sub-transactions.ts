import type { Tables } from "@/integrations/supabase/types";

export type SubTransaction = Tables<"sub_transactions">;

export function sumSubs(subs: SubTransaction[]): number {
  return subs.reduce((s, x) => s + Number(x.amount), 0);
}
