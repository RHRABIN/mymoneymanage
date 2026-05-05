import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Super Admin — Ledger" }] }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <AdminPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Row = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  roles: string[];
};

const PAGE_SIZE = 10;

function AdminPage() {
  const { isSuperAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      toast.error("Access denied. Super admin only.");
      navigate({ to: "/dashboard" });
    }
  }, [authLoading, isSuperAdmin, navigate]);

  const fetchPage = async (p: number) => {
    setLoading(true);
    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, is_active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const ids = (data ?? []).map((d) => d.user_id);
    let rolesMap = new Map<string, string[]>();
    if (ids.length) {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      (rolesData ?? []).forEach((r) => {
        const arr = rolesMap.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesMap.set(r.user_id, arr);
      });
    }
    setRows(
      (data ?? []).map((d) => ({
        user_id: d.user_id,
        full_name: d.full_name,
        email: d.email,
        is_active: d.is_active,
        created_at: d.created_at,
        roles: rolesMap.get(d.user_id) ?? [],
      })),
    );
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, page]);

  const toggleActive = async (row: Row) => {
    if (row.user_id === user?.id) {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    const next = !row.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: next })
      .eq("user_id", row.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "User activated" : "User deactivated");
    setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, is_active: next } : r)));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authLoading || !isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Super Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage registered users. Total: {total}
          </p>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.user_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.full_name || "—"}</p>
                  <p className="mt-0.5 break-all text-xs text-muted-foreground">{r.email}</p>
                </div>
                {r.roles.includes("super_admin") ? (
                  <Badge className="shrink-0">Super admin</Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">User</Badge>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Joined {new Date(r.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                  <Switch
                    checked={r.is_active}
                    disabled={r.user_id === user?.id}
                    onCheckedChange={() => toggleActive(r)}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                  <TableCell className="break-all">{r.email}</TableCell>
                  <TableCell>
                    {r.roles.includes("super_admin") ? (
                      <Badge>Super admin</Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                      <Switch
                        checked={r.is_active}
                        disabled={r.user_id === user?.id}
                        onCheckedChange={() => toggleActive(r)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={page === i + 1}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(i + 1);
                  }}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
