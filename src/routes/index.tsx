import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild className="bg-gradient-emerald text-primary-foreground hover:opacity-95">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-20">
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Personal finance, beautifully simple
            </span>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Master your money with <span className="text-gradient-emerald">clarity</span>.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Track income and expenses, watch your savings grow, and make confident decisions with
              a dashboard that respects your time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-gradient-emerald text-primary-foreground shadow-elegant hover:opacity-95"
              >
                <Link to="/auth">
                  Start free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">I have an account</Link>
              </Button>
            </div>
          </div>

          {/* Bento preview */}
          <div className="grid grid-cols-6 grid-rows-6 gap-3 md:h-[480px]">
            <div className="col-span-4 row-span-3 rounded-2xl border border-border bg-card p-5 shadow-elegant">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total balance
              </p>
              <p className="mt-2 font-display text-4xl font-semibold text-gradient-emerald">
                $12,480.50
              </p>
              <div className="mt-6 flex h-24 items-end gap-1.5">
                {[35, 55, 40, 70, 60, 85, 75, 95, 80, 100, 88, 110].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-emerald"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="col-span-2 row-span-3 rounded-2xl bg-gradient-gold p-5 text-gold-foreground shadow-gold">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Savings</p>
              <p className="mt-2 font-display text-3xl font-semibold">+18.4%</p>
              <p className="mt-1 text-xs opacity-80">vs last month</p>
              <div className="mt-6 h-px w-full bg-foreground/10" />
              <p className="mt-3 text-xs opacity-80">Goal progress</p>
              <div className="mt-2 h-2 rounded-full bg-foreground/10">
                <div className="h-2 w-3/4 rounded-full bg-foreground/60" />
              </div>
            </div>
            <div className="col-span-3 row-span-3 rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Income
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-income">$5,200</p>
            </div>
            <div className="col-span-3 row-span-3 rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Expense
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-expense">$2,840</p>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: BarChart3,
              title: "Real-time insights",
              desc: "Charts that update the moment you log a transaction.",
            },
            {
              icon: ShieldCheck,
              title: "Private by design",
              desc: "Your data is encrypted and only visible to you.",
            },
            {
              icon: Sparkles,
              title: "Made to enjoy",
              desc: "A finance app that actually feels good to open.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-emerald shadow-elegant">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
