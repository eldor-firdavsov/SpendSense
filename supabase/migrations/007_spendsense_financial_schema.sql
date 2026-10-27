-- Migration: 007_spendsense_financial_schema.sql
-- Description: Core financial schema for SpendSense AI
-- Entities: categories, import_jobs, transactions, budgets, financial_goals, insights, ai_conversations, ai_messages
-- Includes: Constraints, Indexes, Triggers, RLS Policies, and System Categories Seed.

BEGIN;

-- 1. Helper trigger function: Prevent immutable owner changes
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Changing the owner (user_id) of an existing record is strictly prohibited';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TABLE: public.categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT,
  icon TEXT,
  color TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_categories_owner CHECK (
    (is_system = true AND user_id IS NULL) OR
    (is_system = false AND user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_system_unique
  ON public.categories (LOWER(TRIM(name)), type)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_unique
  ON public.categories (user_id, LOWER(TRIM(name)), type)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories (type);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. TABLE: public.import_jobs
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INT NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  imported_rows INT NOT NULL DEFAULT 0 CHECK (imported_rows >= 0),
  failed_rows INT NOT NULL DEFAULT 0 CHECK (failed_rows >= 0),
  skipped_rows INT NOT NULL DEFAULT 0 CHECK (skipped_rows >= 0),
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON public.import_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs (user_id, status);

DROP TRIGGER IF EXISTS trg_import_jobs_prevent_user_id_change ON public.import_jobs;
CREATE TRIGGER trg_import_jobs_prevent_user_id_change
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. TABLE: public.transactions
-- Note: Financial amounts stored as positive NUMERIC(12, 2). Direction is governed by type ('income' | 'expense').
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3 AND currency = UPPER(currency)),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  transaction_date DATE NOT NULL,
  merchant TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'excel', 'recurring')),
  import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_import_job_id ON public.transactions (import_job_id);

DROP TRIGGER IF EXISTS trg_transactions_prevent_user_id_change ON public.transactions;
CREATE TRIGGER trg_transactions_prevent_user_id_change
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cross-reference ownership integrity for transactions
CREATE OR REPLACE FUNCTION public.check_transaction_cross_references()
RETURNS TRIGGER AS $$
DECLARE
  cat_user_id UUID;
  cat_is_system BOOLEAN;
  job_user_id UUID;
BEGIN
  -- Validate category ownership
  IF NEW.category_id IS NOT NULL THEN
    SELECT user_id, is_system INTO cat_user_id, cat_is_system
    FROM public.categories
    WHERE id = NEW.category_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Category % not found', NEW.category_id;
    END IF;

    IF NOT cat_is_system AND (cat_user_id IS NULL OR cat_user_id <> NEW.user_id) THEN
      RAISE EXCEPTION 'Category does not belong to user %', NEW.user_id;
    END IF;
  END IF;

  -- Validate import job ownership
  IF NEW.import_job_id IS NOT NULL THEN
    SELECT user_id INTO job_user_id
    FROM public.import_jobs
    WHERE id = NEW.import_job_id;

    IF NOT FOUND OR job_user_id <> NEW.user_id THEN
      RAISE EXCEPTION 'Import job does not belong to user %', NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_transaction_cross_refs ON public.transactions;
CREATE TRIGGER trg_check_transaction_cross_refs
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_transaction_cross_references();

-- 5. TABLE: public.budgets
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3 AND currency = UPPER(currency)),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'weekly', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_budget_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON public.budgets (category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_dates ON public.budgets (user_id, start_date, end_date);

DROP TRIGGER IF EXISTS trg_budgets_prevent_user_id_change ON public.budgets;
CREATE TRIGGER trg_budgets_prevent_user_id_change
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cross-reference category ownership for budgets
CREATE OR REPLACE FUNCTION public.check_budget_category_ownership()
RETURNS TRIGGER AS $$
DECLARE
  cat_user_id UUID;
  cat_is_system BOOLEAN;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT user_id, is_system INTO cat_user_id, cat_is_system
    FROM public.categories
    WHERE id = NEW.category_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Category % not found', NEW.category_id;
    END IF;

    IF NOT cat_is_system AND (cat_user_id IS NULL OR cat_user_id <> NEW.user_id) THEN
      RAISE EXCEPTION 'Category does not belong to user %', NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_budget_category ON public.budgets;
CREATE TRIGGER trg_check_budget_category
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.check_budget_category_ownership();

-- 6. TABLE: public.financial_goals
-- Architecture Note:
-- current_amount tracks verified, actual contributions allocated toward this goal.
-- Projected savings estimates generated by analytics remain runtime predictions and are not conflated with recorded contributions.
CREATE TABLE IF NOT EXISTS public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3 AND currency = UPPER(currency)),
  target_date DATE,
  tracking_strategy TEXT NOT NULL DEFAULT 'manual' CHECK (tracking_strategy IN ('manual', 'category_linked', 'account_linked')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON public.financial_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_financial_goals_status ON public.financial_goals (user_id, status);

DROP TRIGGER IF EXISTS trg_financial_goals_prevent_user_id_change ON public.financial_goals;
CREATE TRIGGER trg_financial_goals_prevent_user_id_change
  BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_financial_goals_updated_at ON public.financial_goals;
CREATE TRIGGER trg_financial_goals_updated_at
  BEFORE UPDATE ON public.financial_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. TABLE: public.insights
-- Architecture Note:
-- AI-generated insights are stored strictly as untrusted data rows.
-- Insight contents cannot elevate privileges or alter authorization boundaries.
CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('spending_spike', 'budget_alert', 'savings_opportunity', 'anomaly', 'recurring_charge', 'general')),
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'dismissed', 'resolved')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  evidence_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_insight_period CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_insights_user_id ON public.insights (user_id);
CREATE INDEX IF NOT EXISTS idx_insights_status ON public.insights (user_id, status);
CREATE INDEX IF NOT EXISTS idx_insights_period ON public.insights (user_id, period_start, period_end);

DROP TRIGGER IF EXISTS trg_insights_prevent_user_id_change ON public.insights;
CREATE TRIGGER trg_insights_prevent_user_id_change
  BEFORE UPDATE ON public.insights
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_insights_updated_at ON public.insights;
CREATE TRIGGER trg_insights_updated_at
  BEFORE UPDATE ON public.insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. TABLE: public.ai_conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Financial Advisory Session',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations (user_id);

DROP TRIGGER IF EXISTS trg_ai_conversations_prevent_user_id_change ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_prevent_user_id_change
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. TABLE: public.ai_messages
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  evidence_references JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON public.ai_messages (user_id);

-- Conversation ownership integrity for AI messages
CREATE OR REPLACE FUNCTION public.check_ai_message_conversation_ownership()
RETURNS TRIGGER AS $$
DECLARE
  conv_user_id UUID;
BEGIN
  SELECT user_id INTO conv_user_id
  FROM public.ai_conversations
  WHERE id = NEW.conversation_id;
  
  IF NOT FOUND OR conv_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'AI conversation does not belong to user %', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_ai_message_conv ON public.ai_messages;
CREATE TRIGGER trg_check_ai_message_conv
  BEFORE INSERT OR UPDATE ON public.ai_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_ai_message_conversation_ownership();

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Categories RLS
DROP POLICY IF EXISTS "categories_read_policy" ON public.categories;
CREATE POLICY "categories_read_policy" ON public.categories
  FOR SELECT USING (is_system = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
CREATE POLICY "categories_insert_policy" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
CREATE POLICY "categories_update_policy" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;
CREATE POLICY "categories_delete_policy" ON public.categories
  FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Import Jobs RLS
DROP POLICY IF EXISTS "import_jobs_read_policy" ON public.import_jobs;
CREATE POLICY "import_jobs_read_policy" ON public.import_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_jobs_insert_policy" ON public.import_jobs;
CREATE POLICY "import_jobs_insert_policy" ON public.import_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_jobs_update_policy" ON public.import_jobs;
CREATE POLICY "import_jobs_update_policy" ON public.import_jobs
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "import_jobs_delete_policy" ON public.import_jobs;
CREATE POLICY "import_jobs_delete_policy" ON public.import_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions RLS
DROP POLICY IF EXISTS "transactions_read_policy" ON public.transactions;
CREATE POLICY "transactions_read_policy" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
CREATE POLICY "transactions_insert_policy" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;
CREATE POLICY "transactions_update_policy" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;
CREATE POLICY "transactions_delete_policy" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Budgets RLS
DROP POLICY IF EXISTS "budgets_read_policy" ON public.budgets;
CREATE POLICY "budgets_read_policy" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_insert_policy" ON public.budgets;
CREATE POLICY "budgets_insert_policy" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_update_policy" ON public.budgets;
CREATE POLICY "budgets_update_policy" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_delete_policy" ON public.budgets;
CREATE POLICY "budgets_delete_policy" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Financial Goals RLS
DROP POLICY IF EXISTS "financial_goals_read_policy" ON public.financial_goals;
CREATE POLICY "financial_goals_read_policy" ON public.financial_goals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "financial_goals_insert_policy" ON public.financial_goals;
CREATE POLICY "financial_goals_insert_policy" ON public.financial_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "financial_goals_update_policy" ON public.financial_goals;
CREATE POLICY "financial_goals_update_policy" ON public.financial_goals
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "financial_goals_delete_policy" ON public.financial_goals;
CREATE POLICY "financial_goals_delete_policy" ON public.financial_goals
  FOR DELETE USING (auth.uid() = user_id);

-- Insights RLS
DROP POLICY IF EXISTS "insights_read_policy" ON public.insights;
CREATE POLICY "insights_read_policy" ON public.insights
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insights_insert_policy" ON public.insights;
CREATE POLICY "insights_insert_policy" ON public.insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "insights_update_policy" ON public.insights;
CREATE POLICY "insights_update_policy" ON public.insights
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "insights_delete_policy" ON public.insights;
CREATE POLICY "insights_delete_policy" ON public.insights
  FOR DELETE USING (auth.uid() = user_id);

-- AI Conversations RLS
DROP POLICY IF EXISTS "ai_conversations_read_policy" ON public.ai_conversations;
CREATE POLICY "ai_conversations_read_policy" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_insert_policy" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert_policy" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_update_policy" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update_policy" ON public.ai_conversations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_delete_policy" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete_policy" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- AI Messages RLS
DROP POLICY IF EXISTS "ai_messages_read_policy" ON public.ai_messages;
CREATE POLICY "ai_messages_read_policy" ON public.ai_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_insert_policy" ON public.ai_messages;
CREATE POLICY "ai_messages_insert_policy" ON public.ai_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_update_policy" ON public.ai_messages;
CREATE POLICY "ai_messages_update_policy" ON public.ai_messages
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_delete_policy" ON public.ai_messages;
CREATE POLICY "ai_messages_delete_policy" ON public.ai_messages
  FOR DELETE USING (auth.uid() = user_id);

-- 11. SEED DEFAULT SYSTEM CATEGORIES
INSERT INTO public.categories (name, type, description, icon, is_system, user_id)
VALUES
  -- Expenses
  ('Housing / Rent', 'expense', 'Rent, mortgage, and property expenses', 'home', true, NULL),
  ('Utilities', 'expense', 'Electricity, water, gas, internet, phone', 'zap', true, NULL),
  ('Groceries', 'expense', 'Supermarket, food staples, household supplies', 'shopping-cart', true, NULL),
  ('Dining Out', 'expense', 'Restaurants, cafes, delivery, takeout', 'utensils', true, NULL),
  ('Transportation', 'expense', 'Transit, fuel, rideshare, parking, vehicle maintenance', 'car', true, NULL),
  ('Healthcare', 'expense', 'Doctor visits, prescriptions, health insurance', 'heart-pulse', true, NULL),
  ('Entertainment', 'expense', 'Movies, games, subscriptions, streaming, events', 'film', true, NULL),
  ('Shopping', 'expense', 'Clothing, electronics, personal goods', 'shopping-bag', true, NULL),
  ('Education', 'expense', 'Courses, books, tuition, training', 'graduation-cap', true, NULL),
  ('Personal Care', 'expense', 'Gym, haircuts, grooming, wellness', 'smile', true, NULL),
  ('Miscellaneous', 'expense', 'Uncategorized or general expenses', 'more-horizontal', true, NULL),
  -- Income
  ('Salary', 'income', 'Primary employment wages and salary', 'briefcase', true, NULL),
  ('Freelance / Consulting', 'income', 'Side projects, client work, contract income', 'laptop', true, NULL),
  ('Investments', 'income', 'Dividends, capital gains, interest returns', 'trending-up', true, NULL),
  ('Gifts & Grants', 'income', 'Monetary gifts, grants, cash rewards', 'gift', true, NULL),
  ('Other Income', 'income', 'Miscellaneous or irregular earnings', 'dollar-sign', true, NULL)
ON CONFLICT (LOWER(TRIM(name)), type) WHERE user_id IS NULL
DO NOTHING;

-- Record migration in schema_migrations
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('007')
ON CONFLICT (version) DO NOTHING;

COMMIT;
