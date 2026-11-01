-- Migration: 008_onboarding_and_financial_planning.sql
-- Description: Adds user onboarding state and declared financial planning fields to profiles.

BEGIN;

-- 1. Add onboarding and declared planning columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS declared_monthly_income NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (declared_monthly_income >= 0),
  ADD COLUMN IF NOT EXISTS declared_monthly_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (declared_monthly_expenses >= 0),
  ADD COLUMN IF NOT EXISTS target_expense_reduction_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (target_expense_reduction_percent >= 0 AND target_expense_reduction_percent <= 100),
  ADD COLUMN IF NOT EXISTS target_monthly_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (target_monthly_expenses >= 0),
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 0 CHECK (onboarding_step >= 0),
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'::jsonb;

-- 2. Create index for fast onboarding lookup
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed
  ON public.profiles (id, onboarding_completed);

-- 3. Mark all existing users as onboarding_completed = true so existing accounts are never blocked
UPDATE public.profiles
SET onboarding_completed = true
WHERE onboarding_completed = false;

COMMIT;
