import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Ledger" },
      { name: "description", content: "Sign in or create your Ledger account." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
});
type Vals = z.infer<typeof schema>;

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setAuthError(null);
    setGoogleLoading(true);
    // Redirects to Google; requires the Google provider to be enabled in Supabase Auth
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      setGoogleLoading(false);
      const msg = error.message || "Google sign-in failed.";
      setAuthError(msg);
      toast.error(msg);
    }
  };

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const form = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (vals: Vals) => {
    setAuthError(null);
    setSubmitting(true);
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(vals.email, vals.password);
    setSubmitting(false);
    if (error) {
      const msg =
        mode === "signin" && /invalid|credentials|password/i.test(error)
          ? "Incorrect email or password."
          : error;
      setAuthError(msg);
      toast.error(msg);
      return;
    }
    if (mode === "signup") {
      toast.success("Account created. You're signed in!");
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <Logo />
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Your money,
            <br />
            <span className="text-gold">crystal clear.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sidebar-foreground/70">
            A calm, focused dashboard for tracking income, expenses, and savings — built for
            clarity.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© Ledger</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Logo />
          </div>
          <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to continue to your dashboard."
              : "Start tracking your finances in seconds."}
          </p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {authError}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-emerald text-primary-foreground shadow-elegant hover:opacity-95"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden
                  />
                  Signing in...
                </span>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
            {mode === "signin" && (
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={googleLoading || submitting}
            onClick={handleGoogle}
            className="w-full"
          >
            {googleLoading ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
                Connecting...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.5 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.5 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 43.5c5 0 9.6-1.9 13.1-5l-6.1-5c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.2 5.5l6.1 5c-.4.4 6.8-5 6.8-14.5 0-1.2-.1-2.3-.4-3.5z"
                  />
                </svg>
                Continue with Google
              </span>
            )}
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
