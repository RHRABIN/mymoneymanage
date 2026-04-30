import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Transaction } from "@/lib/finance";

const schema = z.object({
  title: z.string().trim().min(1, "Required").max(80),
  amount: z.coerce.number().positive("Must be > 0").max(1_000_000_000),
  date: z.string().min(1, "Required"),
  type: z.enum(["income", "expense"]),
  status: z.enum(["pending", "done"]),
  category: z.string().trim().max(40).optional().or(z.literal("")),
});

type FormVals = z.infer<typeof schema>;

export function TransactionDialog({
  open,
  onOpenChange,
  userId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  initial?: Transaction | null;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initial;

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    values: {
      title: initial?.title ?? "",
      amount: initial ? Number(initial.amount) : ("" as unknown as number),
      date: initial?.date ?? new Date().toISOString().slice(0, 10),
      type: initial?.type ?? "expense",
      category: initial?.category ?? "",
    },
  });

  const onSubmit = async (vals: FormVals) => {
    setSubmitting(true);
    const payload = {
      title: vals.title,
      amount: vals.amount,
      date: vals.date,
      type: vals.type,
      category: vals.category?.trim() ? vals.category.trim() : null,
      user_id: userId,
    };
    const res = isEdit
      ? await supabase.from("transactions").update(payload).eq("id", initial!.id)
      : await supabase.from("transactions").insert(payload);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(isEdit ? "Transaction updated" : "Transaction added");
    onSaved();
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Salary, Groceries" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" placeholder="0.00" {...form.register("amount")} />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...form.register("date")} />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) => form.setValue("type", v as "income" | "expense")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" placeholder="Optional" {...form.register("category")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-gradient-emerald text-primary-foreground hover:opacity-95">
              {submitting ? "Saving..." : isEdit ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
