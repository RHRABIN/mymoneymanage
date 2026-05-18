export type TxType = "income" | "expense" | "lending" | "borrow";
export type TxStatus = "pending" | "done";
export type PaymentMethod = "cash" | "bkash" | "bank";

export type Transaction = {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: TxType;
  status: TxStatus;
  category: string | null;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "Bkash" },
  { value: "bank", label: "Bank" },
];

export const TX_TYPES: { value: TxType; label: string; color: string }[] = [
  { value: "income", label: "Income", color: "income" },
  { value: "expense", label: "Expense", color: "expense" },
  { value: "lending", label: "Lending", color: "lending" },
  { value: "borrow", label: "Borrow", color: "borrow" },
];

export const typeColorClass = (t: TxType) => {
  switch (t) {
    case "income": return "text-income";
    case "expense": return "text-expense";
    case "lending": return "text-lending";
    case "borrow": return "text-borrow";
  }
};

export const typeBadgeClass = (t: TxType) => {
  switch (t) {
    case "income": return "bg-income/15 text-income border-income/40";
    case "expense": return "bg-expense/15 text-expense border-expense/40";
    case "lending": return "bg-lending/15 text-lending border-lending/40";
    case "borrow": return "bg-borrow/15 text-borrow border-borrow/40";
  }
};

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n);

export function summarize(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += Number(t.amount);
    else if (t.type === "expense") expense += Number(t.amount);
  }
  return { income, expense, balance: income - expense };
}

export function inRange(t: Transaction, start?: string, end?: string) {
  if (start && t.date < start) return false;
  if (end && t.date > end) return false;
  return true;
}
