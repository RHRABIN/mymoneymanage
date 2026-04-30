ALTER TABLE public.transactions ADD COLUMN status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','done'));