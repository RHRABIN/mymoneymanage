export type SubTransaction = {
  id: string;
  user_id: string;
  transaction_id: string;
  title: string;
  amount: number;
  date: string;
  created_at: string;
  updated_at: string;
};

export function sumSubs(subs: SubTransaction[]): number {
  return subs.reduce((s, x) => s + Number(x.amount), 0);
}
