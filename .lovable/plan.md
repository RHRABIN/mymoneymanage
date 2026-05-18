## Overview

Expand the transactions feature to support payment methods, four transaction types (Income, Expense, Lending, Borrow), and a parent/child structure where each main transaction has a fixed budget and multiple sub-transactions that consume it.

## 1. Database changes (migration)

**`transactions` table — add columns:**
- `payment_method` text NOT NULL DEFAULT 'cash' — values: `cash`, `bkash`, `bank`
- Extend `type` to allow `income | expense | lending | borrow` (currently only income/expense are used)

**New `sub_transactions` table:**
- `id`, `user_id`, `transaction_id` (FK → transactions, ON DELETE CASCADE)
- `title` text NOT NULL
- `amount` numeric NOT NULL
- `date` date NOT NULL DEFAULT today
- `created_at`, `updated_at`
- RLS: users can CRUD only their own rows (matches existing transactions policies)

## 2. UI changes

**`TransactionDialog` (create/edit main transaction):**
- Add Payment Method dropdown (Cash / Bkash / Bank)
- Extend Type selector to 4 options with color chips:
  - Income = green, Expense = red, Lending = orange, Borrow = blue
- Rename amount label to "Total Budget / Amount"

**Transactions list (`/transactions`):**
- Each row becomes a clickable summary card showing: title, type chip (color-coded), total, used, remaining, payment method icon/label, date, status
- Remaining = total − sum(sub_transactions.amount)
- Click row → opens Transaction Details sheet/drawer

**New `TransactionDetailsSheet` component:**
- Header: title, type, payment method, date, total / used / remaining
- Sub-transactions list with add / edit / delete
- "Add sub-transaction" form: title, amount, date
- Live recompute of used + remaining

**Filters:**
- Extend existing Type filter pills to include Lending & Borrow

**Color tokens (`src/styles.css`):**
- Add `--lending` (orange) and `--borrow` (blue) semantic tokens alongside existing `--income` / `--expense`

## 3. Data layer

- New `src/lib/sub-transactions.ts` with typed helpers (list/create/update/delete by transaction_id)
- Update `src/lib/finance.ts` `TxType` union to include `lending | borrow`, add `PaymentMethod` type, add helper `remaining(total, subs)`

## 4. Out of scope (keeping change focused)

- Dashboard / Notes pages stay untouched
- Summary, Calendar, Monthly views continue using existing main-transaction totals (no aggregation over sub-transactions in this pass)

## Files touched

- migration (new)
- `src/lib/finance.ts`
- `src/lib/sub-transactions.ts` (new)
- `src/components/TransactionDialog.tsx`
- `src/components/TransactionDetailsSheet.tsx` (new)
- `src/routes/transactions.tsx`
- `src/styles.css`
