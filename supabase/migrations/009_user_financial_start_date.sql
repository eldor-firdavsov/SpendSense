-- Migration: 009_user_financial_start_date.sql
-- Description: Adds user-specific financial_start_date to public.profiles and backfills existing users

BEGIN;

-- 1. Add financial_start_date column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS financial_start_date DATE;

-- 2. Create index for efficient queries on financial_start_date
CREATE INDEX IF NOT EXISTS idx_profiles_financial_start_date
  ON public.profiles (id, financial_start_date);

-- 3. Backfill financial_start_date for existing users who already have transactions
UPDATE public.profiles p
SET financial_start_date = sub.min_date
FROM (
  SELECT user_id, MIN(transaction_date) as min_date
  FROM public.transactions
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id
  AND p.financial_start_date IS NULL;

COMMIT;
