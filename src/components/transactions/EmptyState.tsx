export function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-lg font-semibold">No transactions</p>
      <p className="mt-1 text-sm text-muted-foreground">Add a new entry or change the period.</p>
    </div>
  );
}
