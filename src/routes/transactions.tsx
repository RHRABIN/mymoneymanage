import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney, type Transaction } from "@/lib/finance";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Ledger" },
      { name: "description", content: "Manage your income and expense transactions." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <TransactionsPage />
      </AppShell>
    </RequireAuth>
  ),
});

function TransactionsPage() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    if (!error && data) setTxs(data as Transaction[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const filtered = txs.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (search && !`${t.title} ${t.category ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const k = format(parseISO(t.date), "MMMM yyyy");
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return [...map.entries()];
  }, [txs, filter, search]);

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("transactions").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Transaction deleted");
      load();
    }
    setToDelete(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">View, edit, and organize every entry.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-emerald text-primary-foreground shadow-elegant hover:opacity-95">
          <Plus className="mr-2 h-4 w-4" /> Add transaction
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <Input
          placeholder="Search title or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-display text-lg font-semibold">No transactions found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try changing filters, or add a new entry.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, items]) => {
            const inc = items.filter((i) => i.type === "income").reduce((s, t) => s + Number(t.amount), 0);
            const exp = items.filter((i) => i.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
            return (
              <section key={month} className="overflow-hidden rounded-2xl border border-border bg-card">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
                  <h2 className="font-display text-base font-semibold">{month}</h2>
                  <div className="flex gap-4 text-sm">
                    <span className="text-income">+{fmtMoney(inc)}</span>
                    <span className="text-expense">-{fmtMoney(exp)}</span>
                    <span className="font-semibold">{fmtMoney(inc - exp)}</span>
                  </div>
                </header>
                <ul className="divide-y divide-border">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3 sm:items-center sm:px-5">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          t.type === "income" ? "bg-income/10 text-income" : "bg-expense/10 text-expense"
                        }`}
                      >
                        {t.type === "income" ? "↑" : "↓"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium sm:truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(t.date), "MMM d, yyyy")}
                          {t.category ? ` · ${t.category}` : ""}
                        </p>
                        <span className={`mt-1 inline-block font-display text-base font-semibold sm:hidden ${t.type === "income" ? "text-income" : "text-expense"}`}>
                          {t.type === "income" ? "+" : "-"}{fmtMoney(Number(t.amount))}
                        </span>
                      </div>
                      <span className={`hidden shrink-0 font-display text-base font-semibold sm:inline ${t.type === "income" ? "text-income" : "text-expense"}`}>
                        {t.type === "income" ? "+" : "-"}{fmtMoney(Number(t.amount))}
                      </span>
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(t)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {user && (
        <TransactionDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          userId={user.id}
          initial={editing}
          onSaved={load}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && <>“{toDelete.title}” will be permanently removed.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
