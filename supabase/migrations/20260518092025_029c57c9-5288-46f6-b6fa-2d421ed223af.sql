-- Add payment method to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';

-- Create sub_transactions table
CREATE TABLE IF NOT EXISTS public.sub_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_transactions_transaction_id
  ON public.sub_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sub_transactions_user_id
  ON public.sub_transactions(user_id);

ALTER TABLE public.sub_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sub_transactions"
  ON public.sub_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sub_transactions"
  ON public.sub_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sub_transactions"
  ON public.sub_transactions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own sub_transactions"
  ON public.sub_transactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_sub_transactions_updated_at
  BEFORE UPDATE ON public.sub_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();