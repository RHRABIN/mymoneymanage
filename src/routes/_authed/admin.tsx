import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { pageWindow } from "@/lib/pagination";
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
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const Route = createFileRoute("/_authed/admin")({
  head: () => ({ meta: [{ title: "Super Admin — Ledger" }] }),
  component: AdminPage,
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

async function fetchUsers(page: number, search: string) {
  const from = (page - 1) * PAGE_SIZE;
  let q = supabase
    .from("profiles")
    .select("user_id, full_name, email, is_active, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  // Strip characters that have meaning in PostgREST filter syntax
  const term = search.replace(/[%*,()\\]/g, " ").trim();
  if (term) q = q.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((d) => d.user_id);
  const rolesMap = new Map<string, string[]>();
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
  const rows: Row[] = (data ?? []).map((d) => ({ ...d, roles: rolesMap.get(d.user_id) ?? [] }));
  return { rows, total: count ?? 0 };
}

function AdminPage() {
  const { isSuperAdmin, loading: authLoading, rolesLoading, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Search after typing pauses, starting again from the first page
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!authLoading && !rolesLoading && !isSuperAdmin) {
      toast.error("Access denied. Super admin only.");
      navigate({ to: "/dashboard" });
    }
  }, [authLoading, rolesLoading, isSuperAdmin, navigate]);

  const usersKey = ["admin", "users", page, search] as const;
  const { data, isPending: loading } = useQuery({
    queryKey: usersKey,
    queryFn: () => fetchUsers(page, search),
    enabled: isSuperAdmin,
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

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
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authLoading || rolesLoading || !isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Super Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage registered users. {search ? "Matches" : "Total"}: {total}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users by name or email"
            className="pl-9"
          />
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
                  <Badge variant="secondary" className="shrink-0">
                    User
                  </Badge>
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
            {pageWindow(page, totalPages).map((p, i) =>
              p === "gap" ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={page === p}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(p);
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
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
