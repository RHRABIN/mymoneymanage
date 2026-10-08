import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { applyMigrations, getMigrationStatus } from "@/lib/admin-migrations";

const statusKey = ["admin", "migrations"] as const;

export function MigrationsPanel() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: statusKey,
    queryFn: () => getMigrationStatus(),
    retry: false,
  });

  const apply = async () => {
    setConfirming(false);
    setApplying(true);
    try {
      const result = await applyMigrations();
      if (result.failed) {
        toast.error(`${result.failed.migration} failed: ${result.failed.error}`, {
          duration: 15000,
        });
      } else {
        toast.success(`Applied ${result.applied.length} migration(s)`);
      }
      // Schema changes can affect any cached data
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  // Newest first: pending ones are what the admin is here for
  const migrations = [...(data?.migrations ?? [])].reverse();

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Database className="h-5 w-5" /> Database migrations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Schema changes shipped with this version of the app.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching || applying}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirming(true)}
            disabled={!data?.pendingCount || !!data.blocked || applying}
          >
            {applying ? "Applying…" : `Apply ${data?.pendingCount ?? 0} pending`}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}
      {data?.blocked && (
        <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {data.blocked}
        </p>
      )}

      {isPending ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <ul className="mt-4 max-h-80 divide-y divide-border overflow-y-auto">
          {migrations.map((m) => (
            <li key={m.version} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {m.applied ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-income" />
                ) : (
                  <CircleDashed className="h-4 w-4 shrink-0 text-gold" />
                )}
                <span className="truncate font-mono text-xs">
                  {m.version}_{m.name}
                </span>
              </span>
              <Badge variant={m.applied ? "secondary" : "default"}>
                {m.applied ? "Applied" : "Pending"}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {data?.pendingCount} migration(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This changes the live database schema. Each migration runs in its own transaction and
              the run stops at the first failure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
