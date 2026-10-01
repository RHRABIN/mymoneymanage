-- Server-side aggregates so the app no longer downloads every row to add them up.
-- All objects run as the calling user (security invoker), so RLS still applies.

-- Transactions plus the total of their sub-transactions
CREATE OR REPLACE VIEW public.transactions_with_used
WITH (security_invoker = true) AS
SELECT t.*, COALESCE(s.used, 0)::NUMERIC(14,2) AS used
FROM public.transactions t
LEFT JOIN LATERAL (
  SELECT sum(amount) AS used FROM public.sub_transactions st WHERE st.transaction_id = t.id
) s ON true;

GRANT SELECT ON public.transactions_with_used TO authenticated;
REVOKE ALL ON public.transactions_with_used FROM anon;

-- Income/expense per month, newest first (lending/borrow excluded)
CREATE OR REPLACE FUNCTION public.monthly_totals()
RETURNS TABLE (month date, income NUMERIC, expense NUMERIC)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT date_trunc('month', date)::date,
         COALESCE(sum(amount) FILTER (WHERE type = 'income'), 0),
         COALESCE(sum(amount) FILTER (WHERE type = 'expense'), 0)
  FROM public.transactions
  WHERE user_id = auth.uid()
  GROUP BY 1
  ORDER BY 1 DESC
$$;

-- All-time balance, balance carried into p_start, and transaction count
CREATE OR REPLACE FUNCTION public.balance_totals(p_start date)
RETURNS TABLE (total NUMERIC, opening NUMERIC, tx_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH d AS (
    SELECT date,
           CASE type WHEN 'income' THEN amount WHEN 'expense' THEN -amount ELSE 0 END AS delta
    FROM public.transactions
    WHERE user_id = auth.uid()
  )
  SELECT COALESCE(sum(delta), 0),
         COALESCE(sum(delta) FILTER (WHERE date < p_start), 0),
         count(*)
  FROM d
$$;

-- Distinct categories the user has used, for autocomplete
CREATE OR REPLACE FUNCTION public.user_categories()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT category
  FROM public.transactions
  WHERE user_id = auth.uid() AND category IS NOT NULL
  ORDER BY 1
$$;

REVOKE EXECUTE ON FUNCTION public.monthly_totals() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.balance_totals(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_categories() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monthly_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.balance_totals(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_categories() TO authenticated;
