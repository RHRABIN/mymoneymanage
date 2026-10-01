import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  X,
  User,
  Shield,
  StickyNote,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const NAV = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/transactions", label: "Transactions", icon: ListOrdered },
    { to: "/notes", label: "My Notes", icon: StickyNote },
    { to: "/account", label: "My Account", icon: User },
    ...(isSuperAdmin ? [{ to: "/admin", label: "Super Admin", icon: Shield }] : []),
  ] as const;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="p-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-xs text-sidebar-foreground/60">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="mt-2 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-border p-2"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {open && (
          <div className="border-b border-border bg-card px-4 py-3 md:hidden">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = loc.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-accent text-accent-foreground" : "text-foreground/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
