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
import { useCategories, useInvalidate } from "@/lib/queries";
import {
  normalizeCategory,
  PAYMENT_METHODS,
  TX_TYPES,
  todayISO,
  type PaymentMethod,
  type Transaction,
  type TxType,
} from "@/lib/finance";

const schema = z.object({
  title: z.string().trim().min(1, "Required").max(80),
  amount: z.coerce.number().positive("Must be > 0").max(1_000_000_000),
  date: z.string().min(1, "Required"),
  type: z.enum(["income", "expense", "lending", "borrow"]),
  status: z.enum(["pending", "done"]),
  payment_method: z.enum(["cash", "bkash", "bank"]),
  category: z.string().trim().max(40).optional().or(z.literal("")),
});

type FormVals = z.infer<typeof schema>;

export function TransactionDialog({
  open,
  onOpenChange,
  userId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  initial?: Transaction | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { data: categories = [] } = useCategories();
  const invalidate = useInvalidate();
  const isEdit = !!initial;

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    values: {
      title: initial?.title ?? "",
      amount: initial ? Number(initial.amount) : ("" as unknown as number),
      date: initial?.date ?? todayISO(),
      type: initial?.type ?? "expense",
      status: initial?.status ?? "pending",
      payment_method: initial?.payment_method ?? "cash",
      category: initial?.category ?? "",
    },
  });

  const onSubmit = async (vals: FormVals) => {
    setSubmitting(true);
    // Reuse the existing spelling when a category matches case-insensitively
    let category = normalizeCategory(vals.category);
    if (category) {
      const lower = category.toLowerCase();
      category = categories.find((c) => c.toLowerCase() === lower) ?? category;
    }
    const payload = {
      title: vals.title,
      amount: vals.amount,
      date: vals.date,
      type: vals.type,
      status: vals.status,
      payment_method: vals.payment_method,
      category,
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
    invalidate.transactions();
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
            <Input id="title" placeholder="e.g. Monthly Food Budget" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Total Budget</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...form.register("amount")}
              />
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
                onValueChange={(v) => form.setValue("type", v as TxType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TX_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paid By</Label>
              <Select
                value={form.watch("payment_method")}
                onValueChange={(v) => form.setValue("payment_method", v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="Optional"
                list="category-options"
                autoComplete="off"
                {...form.register("category")}
              />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as "pending" | "done")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-emerald text-primary-foreground hover:opacity-95"
            >
              {submitting ? "Saving..." : isEdit ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
