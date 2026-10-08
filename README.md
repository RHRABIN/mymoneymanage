# MyMoneyManage (Ledger)

Personal finance tracker: income, expenses, lending and borrowing, with budgets split into
sub-transactions, a dashboard, and notes. Installable as a PWA.

**Stack:** React 19, TanStack Start/Router, TanStack Query, Tailwind CSS 4, shadcn/ui, Supabase
(Postgres, Auth, Row Level Security).

## Getting started

Requires Node 22+.

```sh
npm install
cp .env.example .env   # fill in the values below
npm run dev            # http://localhost:8080
```

| Variable                                                    | Where to find it (Supabase dashboard)                       |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `SUPABASE_URL`, `VITE_SUPABASE_URL`                         | Project Settings → Data API                                 |
| `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys (publishable, never the secret) |
| `VITE_SUPABASE_PROJECT_ID`                                  | The project ref in the URL                                  |
| `DATABASE_URL`                                              | Connect → Session pooler (only needed for migrations)       |

`.env` is git-ignored. To develop against a local database instead, put the local URL and key in
`.env.development.local` (also ignored).

## Database

Schema, security rules and SQL functions live in `supabase/migrations/`.

```sh
npm run db:migrate -- --dry-run   # list migrations not yet applied to DATABASE_URL
npm run db:migrate                # apply them (each in its own transaction)
```

History is stored in `supabase_migrations.schema_migrations`, the same table the Supabase CLI
uses. For a database that already has the tables but no history, use
`--baseline <last applied version>`.

Super admins can also apply pending migrations from **Super Admin → Database migrations** in the
app. It only runs the SQL files bundled with the deployed build (never SQL typed into the page),
uses the same history table, and takes a lock so two runs can't overlap. It needs `DATABASE_URL`
set on the server.

Local database (Docker):

```sh
npx supabase start    # applies all migrations to a fresh local Postgres
npx supabase stop
```

### Notes on the data model

- Lending and borrowing are tracked separately and are **not** counted in income, expense or
  balance.
- A transaction's amount is a budget; sub-transactions record what was spent from it
  (`transactions_with_used.used`). Going over budget is allowed and shown as a warning.
- Deactivated users (`profiles.is_active = false`) lose access at the database level.
- There is no automatic admin. Grant it in the SQL Editor:

  ```sql
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'super_admin' FROM auth.users WHERE email = 'you@example.com';
  ```

## Tests

```sh
npm test          # unit tests (Vitest)
npm run test:db   # database rule tests; local database only (npx supabase start first)
npm run lint
npm run typecheck
```

`npm run test:db` runs `supabase/tests/database.sql` inside a transaction that is rolled back,
and refuses to connect to anything other than localhost. CI (`.github/workflows/ci.yml`) runs
all of the above on every pull request, including the database tests against a fresh Supabase.

## Hosted Supabase settings

These are set in the dashboard, not in code:

- **Authentication → Providers → Email:** minimum password length 8 (the app enforces 8 for new
  passwords; sign-in still accepts older, shorter ones).
- **Leaked password protection** (Authentication → Providers → Email), if your plan includes it.
- **Authentication → URL Configuration:** Site URL and redirect URLs (e.g. `http://localhost:8080/**`).
- **Authentication → Providers → Google:** client ID and secret, if Google sign-in is used.

## Deployment

The server build uses [Nitro](https://nitro.build). `npm run build` writes `.output/`, which runs
anywhere Node runs: `npm start` (reads `.env`).

### Vercel

1. Import the GitHub repo in Vercel (Add New → Project). The framework is detected from the build
   output; no extra settings are needed.
2. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Add `DATABASE_URL`
   only if you want the in-app migrations panel; it gives the server full database access, so
   leave it out if you'd rather run `npm run db:migrate` yourself.
3. In Supabase → Authentication → URL Configuration, set the Site URL to the Vercel domain and add
   `https://<your-domain>/**` (and `https://*-<your-vercel-team>.vercel.app/**` for preview
   deployments) to the redirect URLs.

On Vercel (`VERCEL=1`) the build writes `.vercel/output` instead, and the PWA service worker is
generated into its static folder. Preview deployments use the same Supabase project as production.
