import { format } from "date-fns";

import type { Tables } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions">; // date is YYYY-MM-DD
export type TxType = Transaction["type"];
export type TxStatus = Transaction["status"];
export type PaymentMethod = Transaction["payment_method"];

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
    case "income":
      return "text-income";
    case "expense":
      return "text-expense";
    case "lending":
      return "text-lending";
    case "borrow":
      return "text-borrow";
  }
};

export const typeBadgeClass = (t: TxType) => {
  switch (t) {
    case "income":
      return "bg-income/15 text-income border-income/40";
    case "expense":
      return "bg-expense/15 text-expense border-expense/40";
    case "lending":
      return "bg-lending/15 text-lending border-lending/40";
    case "borrow":
      return "bg-borrow/15 text-borrow border-borrow/40";
  }
};

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(n);

// Trim and collapse whitespace; blank becomes null (matches the DB check constraint)
export const normalizeCategory = (c: string | null | undefined) => {
  const v = (c ?? "").trim().replace(/\s+/g, " ");
  return v || null;
};

// Lending/borrow are tracked separately and never count toward income, expense or balance.
export function summarize(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  let lent = 0;
  let borrowed = 0;
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.type === "income") income += amt;
    else if (t.type === "expense") expense += amt;
    else if (t.type === "lending") lent += amt;
    else if (t.type === "borrow") borrowed += amt;
  }
  return { income, expense, lent, borrowed, balance: income - expense };
}

// Signed effect of a transaction on the balance (0 for lending/borrow).
export const balanceDelta = (t: Transaction) =>
  t.type === "income" ? Number(t.amount) : t.type === "expense" ? -Number(t.amount) : 0;

// Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date).
export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");
export const todayISO = () => toISODate(new Date());
