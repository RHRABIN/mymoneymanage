-- Database rule tests. Run with `npm run test:db` against a LOCAL database only:
-- the runner wraps everything in a transaction and rolls it back.
-- Each check raises a NOTICE starting with PASS or FAIL.

-- Fixtures: three users created through auth.users so the signup triggers run
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
 ('aaaaaaaa-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.dev','{"full_name":"User A"}',now(),now()),
 ('bbbbbbbb-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@test.dev','{"full_name":"User B"}',now(),now()),
 ('cccccccc-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@test.dev','{"full_name":"Admin"}',now(),now()),
 ('dddddddd-0000-0000-0000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rafiul.hasan.rabin@gmail.com','{}',now(),now());
INSERT INTO public.user_roles (user_id, role) VALUES ('cccccccc-0000-0000-0000-00000000000c','super_admin');

CREATE OR REPLACE FUNCTION pg_temp.as_user(uid text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.check(name text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, name; END $$;

-- Expect a statement to fail
CREATE OR REPLACE FUNCTION pg_temp.expect_error(name text, uid text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM pg_temp.as_user(uid);
    EXECUTE stmt;
    PERFORM set_config('role', 'postgres', true);
    RAISE NOTICE 'FAIL % (statement succeeded)', name;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    RAISE NOTICE 'PASS % (%)', name, SQLERRM;
  END;
END $$;

-- Run a statement as a user and return the affected/selected row count
CREATE OR REPLACE FUNCTION pg_temp.count_as(uid text, stmt text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.as_user(uid);
  EXECUTE stmt INTO n;
  PERFORM set_config('role', 'postgres', true);
  RETURN n;
END $$;


-- Phase 1: allowed values
SELECT pg_temp.check('A can insert lending/bkash and borrow/bank',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a', $q$WITH i AS (INSERT INTO transactions (id,user_id,title,amount,type,payment_method)
     VALUES ('11111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','Lent to Rahim',500,'lending','bkash'),
            ('11111111-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-00000000000a','Loan',800,'borrow','bank') RETURNING 1)
     SELECT count(*) FROM i$q$) = 2);
SELECT pg_temp.expect_error('invalid type rejected', 'aaaaaaaa-0000-0000-0000-00000000000a',
  $q$INSERT INTO transactions (user_id,title,amount,type) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','x',1,'gift')$q$);
SELECT pg_temp.expect_error('invalid payment_method rejected', 'aaaaaaaa-0000-0000-0000-00000000000a',
  $q$INSERT INTO transactions (user_id,title,amount,type,payment_method) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','x',1,'expense','paypal')$q$);

-- Phase 2: ownership
SELECT pg_temp.check('A can add a sub-transaction to own transaction',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a', $q$WITH i AS (INSERT INTO sub_transactions (user_id,transaction_id,title,amount)
     VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-0000-0000-0000-000000000001','part',100) RETURNING 1) SELECT count(*) FROM i$q$) = 1);
SELECT pg_temp.expect_error('B cannot attach a sub-transaction to A''s transaction', 'bbbbbbbb-0000-0000-0000-00000000000b',
  $q$INSERT INTO sub_transactions (user_id,transaction_id,title,amount)
     VALUES ('bbbbbbbb-0000-0000-0000-00000000000b','11111111-0000-0000-0000-000000000001','sneaky',1)$q$);
SELECT pg_temp.check('B cannot see A''s transactions',
  pg_temp.count_as('bbbbbbbb-0000-0000-0000-00000000000b', 'SELECT count(*) FROM transactions') = 0);
SELECT pg_temp.check('B cannot see A''s sub-transactions',
  pg_temp.count_as('bbbbbbbb-0000-0000-0000-00000000000b', 'SELECT count(*) FROM sub_transactions') = 0);

-- Phase 2: profile protection
SELECT pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a', $q$WITH u AS (UPDATE profiles SET is_active=false, email='evil@x.dev', full_name='Renamed'
   WHERE user_id='aaaaaaaa-0000-0000-0000-00000000000a' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT pg_temp.check('user cannot change own is_active/email, can change name',
  (SELECT is_active AND email='a@test.dev' AND full_name='Renamed' FROM profiles WHERE user_id='aaaaaaaa-0000-0000-0000-00000000000a'));

-- Phase 2: deactivation enforced in the database
SELECT pg_temp.count_as('cccccccc-0000-0000-0000-00000000000c', $q$WITH u AS (UPDATE profiles SET is_active=false
   WHERE user_id='aaaaaaaa-0000-0000-0000-00000000000a' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT pg_temp.check('admin can deactivate a user',
  NOT (SELECT is_active FROM profiles WHERE user_id='aaaaaaaa-0000-0000-0000-00000000000a'));
SELECT pg_temp.check('deactivated A sees no transactions',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a', 'SELECT count(*) FROM transactions') = 0);
SELECT pg_temp.check('deactivated A sees no notes/sub-transactions',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a', 'SELECT (SELECT count(*) FROM sub_transactions) + (SELECT count(*) FROM notes)') = 0);
SELECT pg_temp.expect_error('deactivated A cannot insert', 'aaaaaaaa-0000-0000-0000-00000000000a',
  $q$INSERT INTO transactions (user_id,title,amount,type) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','x',1,'expense')$q$);
SELECT pg_temp.count_as('cccccccc-0000-0000-0000-00000000000c', $q$WITH u AS (UPDATE profiles SET is_active=true
   WHERE user_id='aaaaaaaa-0000-0000-0000-00000000000a' RETURNING 1) SELECT count(*) FROM u$q$);
SELECT pg_temp.check('reactivated A sees own transactions again',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a', 'SELECT count(*) FROM transactions') = 2);

-- Phase 2: email sync and admin auto-promotion
-- Supabase Auth changes emails on its own connection, with no user claims set
SELECT set_config('request.jwt.claims', '', true);
UPDATE auth.users SET email='a-new@test.dev' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a';
SELECT pg_temp.check('profile email follows auth email',
  (SELECT email FROM profiles WHERE user_id='aaaaaaaa-0000-0000-0000-00000000000a') = 'a-new@test.dev');
SELECT pg_temp.check('hardcoded email is no longer auto-promoted',
  NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id='dddddddd-0000-0000-0000-00000000000d' AND role='super_admin'));

-- Phase 3: schema cleanup
SELECT pg_temp.expect_error('negative sub-transaction amount rejected', 'aaaaaaaa-0000-0000-0000-00000000000a',
  $q$INSERT INTO sub_transactions (user_id,transaction_id,title,amount)
     VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-0000-0000-0000-000000000001','neg',-5)$q$);
SELECT pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a', $q$WITH i AS (INSERT INTO sub_transactions (id,user_id,transaction_id,title,amount)
   VALUES ('22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','11111111-0000-0000-0000-000000000001','round',1.239) RETURNING 1) SELECT count(*) FROM i$q$);
SELECT pg_temp.check('sub-transaction amount rounded to 2 decimals',
  (SELECT amount FROM sub_transactions WHERE id='22222222-0000-0000-0000-000000000001') = 1.24);
SELECT pg_temp.expect_error('untrimmed category rejected', 'aaaaaaaa-0000-0000-0000-00000000000a',
  $q$INSERT INTO transactions (user_id,title,amount,type,category) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','x',1,'expense',' food ')$q$);
SELECT pg_temp.expect_error('empty category rejected', 'aaaaaaaa-0000-0000-0000-00000000000a',
  $q$INSERT INTO transactions (user_id,title,amount,type,category) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','x',1,'expense','')$q$);

-- Re-run the casing merge from the migration on fresh data; updated_at must not change
INSERT INTO transactions (id,user_id,title,amount,type,category,updated_at) VALUES
 ('33333333-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-00000000000b','t1',1,'expense','Food','2020-01-01'),
 ('33333333-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-00000000000b','t2',1,'expense','Food','2020-01-01'),
 ('33333333-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-00000000000b','t3',1,'expense','food','2020-01-01');
ALTER TABLE public.transactions DISABLE TRIGGER transactions_updated_at;
WITH ranked AS (
  SELECT user_id, category, lower(category) AS k,
         row_number() OVER (PARTITION BY user_id, lower(category) ORDER BY count(*) DESC, category) AS rn
  FROM public.transactions WHERE category IS NOT NULL GROUP BY user_id, category
)
UPDATE public.transactions t SET category = r.category FROM ranked r
  WHERE r.rn = 1 AND t.user_id = r.user_id AND lower(t.category) = r.k AND t.category <> r.category;
ALTER TABLE public.transactions ENABLE TRIGGER transactions_updated_at;
SELECT pg_temp.check('casing variants merged to most-used spelling',
  (SELECT count(DISTINCT category) = 1 AND min(category) = 'Food' FROM transactions WHERE id::text LIKE '33333333%'));
SELECT pg_temp.check('merge left updated_at untouched',
  (SELECT bool_and(updated_at = '2020-01-01') FROM transactions WHERE id::text LIKE '33333333%'));

SELECT pg_temp.check('deleting a user cascades to notes and sub-transactions',
  (SELECT count(*) FROM pg_constraint WHERE conname IN ('notes_user_id_fkey','sub_transactions_user_id_fkey') AND confdeltype = 'c') = 2);
-- Phase 4 aggregates (security invoker: RLS applies)
INSERT INTO sub_transactions (user_id,transaction_id,title,amount)
  VALUES ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-0000-0000-0000-000000000002','part',150.5);
SELECT pg_temp.check('transactions_with_used sums sub-transactions',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a',
    $q$SELECT (used * 100)::bigint FROM transactions_with_used WHERE id='11111111-0000-0000-0000-000000000002'$q$) = 15050);
SELECT pg_temp.check('another user sees no rows in transactions_with_used',
  pg_temp.count_as('bbbbbbbb-0000-0000-0000-00000000000b',
    $q$SELECT count(*) FROM transactions_with_used WHERE user_id='aaaaaaaa-0000-0000-0000-00000000000a'$q$) = 0);
INSERT INTO transactions (user_id,title,amount,type,date) VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a','pay',1000,'income','2026-01-10'),
  ('aaaaaaaa-0000-0000-0000-00000000000a','rent',400,'expense','2026-01-20'),
  ('aaaaaaaa-0000-0000-0000-00000000000a','food',100,'expense','2026-02-05');
SELECT pg_temp.check('monthly_totals groups income/expense by month',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a',
    $q$SELECT count(*) FROM monthly_totals() WHERE (month='2026-01-01' AND income=1000 AND expense=400) OR (month='2026-02-01' AND income=0 AND expense=100)$q$) = 2);
SELECT pg_temp.check('balance_totals: opening balance before a date ignores lending/borrow',
  pg_temp.count_as('aaaaaaaa-0000-0000-0000-00000000000a',
    $q$SELECT opening::bigint FROM balance_totals('2026-02-01')$q$) = 600);
SELECT pg_temp.check('balance_totals is zero for a user with no data',
  pg_temp.count_as('cccccccc-0000-0000-0000-00000000000c', $q$SELECT tx_count FROM balance_totals('2026-01-01')$q$) = 0);
SELECT pg_temp.check('user_categories lists only the caller''s categories',
  pg_temp.count_as('bbbbbbbb-0000-0000-0000-00000000000b', $q$SELECT count(*) FROM user_categories()$q$) = 1);
