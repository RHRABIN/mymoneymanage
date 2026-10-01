-- True unless the user's profile is explicitly deactivated
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _user_id AND is_active = false
  )
$$;

-- transactions: own rows only, and only while active
DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users delete own transactions" ON public.transactions;

CREATE POLICY "Users view own transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users insert own transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users update own transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users delete own transactions" ON public.transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));

-- sub_transactions: same, plus the parent transaction must belong to the user
DROP POLICY IF EXISTS "Users view own sub_transactions" ON public.sub_transactions;
DROP POLICY IF EXISTS "Users insert own sub_transactions" ON public.sub_transactions;
DROP POLICY IF EXISTS "Users update own sub_transactions" ON public.sub_transactions;
DROP POLICY IF EXISTS "Users delete own sub_transactions" ON public.sub_transactions;

CREATE POLICY "Users view own sub_transactions" ON public.sub_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users insert own sub_transactions" ON public.sub_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_user(auth.uid())
    AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Users update own sub_transactions" ON public.sub_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()))
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_user(auth.uid())
    AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Users delete own sub_transactions" ON public.sub_transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));

-- notes
DROP POLICY IF EXISTS "Users view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Users update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users delete own notes" ON public.notes;

CREATE POLICY "Users view own notes" ON public.notes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users insert own notes" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users update own notes" ON public.notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_active_user(auth.uid()));
CREATE POLICY "Users delete own notes" ON public.notes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_active_user(auth.uid()));

-- profiles: non-admins may not change is_active, email or user_id on their own row
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    NEW.is_active := OLD.is_active;
    NEW.email := OLD.email;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_fields ON public.profiles;
CREATE TRIGGER profiles_protect_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- Keep profiles.email in sync with the confirmed auth email
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();

-- Stop auto-promoting a hardcoded email to super_admin. Existing role grants are kept;
-- grant future admins manually:
--   INSERT INTO public.user_roles (user_id, role) VALUES ('<user uuid>', 'super_admin');
DROP TRIGGER IF EXISTS on_auth_user_created_promote_admin ON auth.users;
DROP FUNCTION IF EXISTS public.auto_promote_super_admin();
