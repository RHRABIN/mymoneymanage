import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2, Wallet, Smartphone, Landmark, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fmtMoney, todayISO, typeBadgeClass, type Transaction } from "@/lib/finance";
import { sumSubs, type SubTransaction } from "@/lib/sub-transactions";
import { cn } from "@/lib/utils";

const methodIcon = (m: string) => {
  if (m === "bkash") return <Smartphone className="h-3.5 w-3.5" />;
  if (m === "bank") return <Landmark className="h-3.5 w-3.5" />;
  return <Wallet className="h-3.5 w-3.5" />;
};

export function TransactionDetailsSheet({
  tx,
  open,
  onOpenChange,
  userId,
  onChanged,
}: {
  tx: Transaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onChanged: () => void;
}) {
  const [subs, setSubs] = useState<SubTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SubTransaction | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle(""); setAmount(""); setDate(todayISO());
  };

  const load = async (txId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sub_transactions")
      .select("*")
      .eq("transaction_id", txId)
      .order("date", { ascending: false });
    if (!error && data) setSubs(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open && tx) {
      load(tx.id);
      resetForm();
    }
  }, [open, tx]);

  if (!tx) return null;

  const used = sumSubs(subs);
  const remaining = Number(tx.amount) - used;

  const startEdit = (s: SubTransaction) => {
    setEditingId(s.id);
    setTitle(s.title);
    setAmount(String(s.amount));
    setDate(s.date);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!title.trim() || !amt || amt <= 0) {
      toast.error("Enter title and amount");
      return;
    }
    setSaving(true);
    const fields = { title: title.trim(), amount: amt, date };
    const { error } = editingId
      ? await supabase.from("sub_transactions").update(fields).eq("id", editingId)
      : await supabase.from("sub_transactions").insert({ ...fields, user_id: userId, transaction_id: tx.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }

    // Overspending is allowed, but call it out
    const previous = editingId ? Number(subs.find((s) => s.id === editingId)?.amount ?? 0) : 0;
    const newUsed = used - previous + amt;
    if (newUsed > Number(tx.amount)) {
      toast.warning(`Over budget by ${fmtMoney(newUsed - Number(tx.amount))}`);
    } else {
      toast.success(editingId ? "Sub-transaction updated" : "Sub-transaction added");
    }
    resetForm();
    load(tx.id);
    onChanged();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("sub_transactions").delete().eq("id", toDelete.id);
    setToDelete(null);
    if (error) { toast.error(error.message); return; }
    if (editingId === toDelete.id) resetForm();
    toast.success("Removed");
    load(tx.id);
    onChanged();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl sm:max-w-lg sm:mx-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-left text-xl">{tx.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide", typeBadgeClass(tx.type))}>
            {tx.type}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5">
            {methodIcon(tx.payment_method)} {tx.payment_method}
          </span>
          <span className="text-muted-foreground">{format(parseISO(tx.date), "MMM d, yyyy")}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="mt-1 font-display text-sm font-semibold">{fmtMoney(Number(tx.amount))}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Used</p>
            <p className="mt-1 font-display text-sm font-semibold text-expense">{fmtMoney(used)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Remaining</p>
            <p className={cn("mt-1 font-display text-sm font-semibold", remaining < 0 ? "text-destructive" : "text-income")}>
              {fmtMoney(remaining)}
            </p>
          </div>
        </div>
        {remaining < 0 && (
          <p className="mt-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Over budget by {fmtMoney(-remaining)}
          </p>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">
              {editingId ? "Edit sub-transaction" : "Add sub-transaction"}
            </p>
            {editingId && (
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={resetForm} aria-label="Cancel edit">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Food purchase today" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-gradient-emerald text-primary-foreground hover:opacity-95">
            {editingId ? (
              saving ? "Saving..." : "Save changes"
            ) : (
              <><Plus className="mr-1 h-4 w-4" /> {saving ? "Adding..." : "Add"}</>
            )}
          </Button>
        </form>

        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Sub-transactions ({subs.length})</p>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : subs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card py-6 text-center text-sm text-muted-foreground">
              No sub-transactions yet
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">{format(parseISO(s.date), "MMM d, yyyy")}</p>
                  </div>
                  <span className="font-display text-sm font-semibold text-expense">
                    -{fmtMoney(Number(s.amount))}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(s)} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setToDelete(s)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this sub-transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                {toDelete && <>“{toDelete.title}” ({fmtMoney(Number(toDelete.amount))}) will be permanently removed.</>}
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
      </SheetContent>
    </Sheet>
  );
}
