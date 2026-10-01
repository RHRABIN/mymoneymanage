import { Landmark, Smartphone, Wallet } from "lucide-react";
import { typeBadgeClass, type PaymentMethod, type TxStatus, type TxType } from "@/lib/finance";
import { cn } from "@/lib/utils";

const PILL = "inline-flex items-center rounded-full border font-semibold uppercase tracking-wide";

export function PaymentMethodIcon({ method, className = "h-3 w-3" }: { method: PaymentMethod; className?: string }) {
  if (method === "bkash") return <Smartphone className={className} />;
  if (method === "bank") return <Landmark className={className} />;
  return <Wallet className={className} />;
}

export function TypeBadge({ type, className }: { type: TxType; className?: string }) {
  return <span className={cn(PILL, typeBadgeClass(type), className)}>{type}</span>;
}

export function StatusBadge({ status, className }: { status: TxStatus; className?: string }) {
  return (
    <span
      className={cn(
        PILL,
        status === "done"
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      {status === "done" ? "Done" : "Pending"}
    </span>
  );
}

export function PaymentBadge({
  method,
  className,
  iconClassName,
}: {
  method: PaymentMethod;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/40 uppercase tracking-wide",
        className,
      )}
    >
      <PaymentMethodIcon method={method} className={iconClassName} /> {method}
    </span>
  );
}
