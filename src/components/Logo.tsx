import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group flex items-center gap-2 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-emerald shadow-elegant">
        <Wallet className="h-5 w-5 text-primary-foreground" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">
        Ledger<span className="text-gold">.</span>
      </span>
    </Link>
  );
}
