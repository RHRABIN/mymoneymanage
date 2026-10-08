-- Monthly saving targets. A target carries forward to later months until a
-- newer one is set, so most users will only have a few rows.
CREATE TABLE public.saving_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL CHECK (month = date_trunc('month', month)::date),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.saving_targets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER saving_targets_updated_at
  BEFORE UPDATE ON public.saving_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users view own saving_targets" ON public.saving_targets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users insert own saving_targets" ON public.saving_targets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users update own saving_targets" ON public.saving_targets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users delete own saving_targets" ON public.saving_targets
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));

REVOKE ALL ON public.saving_targets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saving_targets TO authenticated;
