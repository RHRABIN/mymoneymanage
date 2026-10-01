import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";

// Parent of every signed-in page. The session lives in localStorage, so the
// check runs in the browser only: in-app navigation redirects before the page
// loads, and on a full page load RequireAuth shows a spinner until it knows.
export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: () => (
    // RequireAuth still handles sign-out/deactivation while a page is open
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  ),
});
