-- sub_transactions.amount: same precision and sign rule as transactions.amount
ALTER TABLE public.sub_transactions
  ALTER COLUMN amount TYPE NUMERIC(14,2) USING round(amount, 2);
ALTER TABLE public.sub_transactions DROP CONSTRAINT IF EXISTS sub_transactions_amount_check;
ALTER TABLE public.sub_transactions
  ADD CONSTRAINT sub_transactions_amount_check CHECK (amount >= 0);

-- user_id foreign keys (remove rows left behind by already-deleted users first)
DELETE FROM public.sub_transactions s
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);
DELETE FROM public.notes n
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = n.user_id);

ALTER TABLE public.sub_transactions DROP CONSTRAINT IF EXISTS sub_transactions_user_id_fkey;
ALTER TABLE public.sub_transactions
  ADD CONSTRAINT sub_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
ALTER TABLE public.notes
  ADD CONSTRAINT notes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Indexes matching the app's queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_updated
  ON public.transactions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_created
  ON public.notes(user_id, created_at DESC);

-- Category cleanup below must not bump updated_at (the list is sorted by it)
ALTER TABLE public.transactions DISABLE TRIGGER transactions_updated_at;

-- Categories: trim and collapse whitespace, store blanks as NULL, keep it that way
UPDATE public.transactions
  SET category = NULLIF(regexp_replace(btrim(category), '\s+', ' ', 'g'), '')
  WHERE category IS NOT NULL;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_category_normalized_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_category_normalized_check
  CHECK (category IS NULL OR (category <> '' AND category = regexp_replace(btrim(category), '\s+', ' ', 'g')));

-- Unify casing variants ("food", "Food ") to the most-used spelling per user
WITH ranked AS (
  SELECT user_id, category, lower(category) AS k,
         row_number() OVER (PARTITION BY user_id, lower(category) ORDER BY count(*) DESC, category) AS rn
  FROM public.transactions
  WHERE category IS NOT NULL
  GROUP BY user_id, category
)
UPDATE public.transactions t
  SET category = r.category
  FROM ranked r
  WHERE r.rn = 1 AND t.user_id = r.user_id AND lower(t.category) = r.k AND t.category <> r.category;

ALTER TABLE public.transactions ENABLE TRIGGER transactions_updated_at;
