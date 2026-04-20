export type TxType = "income" | "expense";

export type Transaction = {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: TxType;
  category: string | null;
  created_at: string;
  updated_at: string;
};

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export function summarize(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += Number(t.amount);
    else expense += Number(t.amount);
  }
  return { income, expense, balance: income - expense };
}

export function inRange(t: Transaction, start?: string, end?: string) {
  if (start && t.date < start) return false;
  if (end && t.date > end) return false;
  return true;
}
