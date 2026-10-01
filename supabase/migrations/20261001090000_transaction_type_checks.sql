-- Allow all four transaction types (the original constraint only allowed income/expense)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (type IN ('income','expense','lending','borrow'));

-- Restrict payment_method to the values the app supports
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_method_check CHECK (payment_method IN ('cash','bkash','bank'));
