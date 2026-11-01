export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CategoryType = 'income' | 'expense';
export type TransactionType = 'income' | 'expense';
export type TransactionSource = 'manual' | 'csv' | 'excel' | 'recurring';
export type BudgetPeriodType = 'monthly' | 'weekly' | 'custom';
export type GoalTrackingStrategy = 'manual' | 'category_linked' | 'account_linked';
export type GoalStatus = 'in_progress' | 'completed' | 'cancelled';
export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type InsightType =
  | 'spending_spike'
  | 'budget_alert'
  | 'savings_opportunity'
  | 'anomaly'
  | 'recurring_charge'
  | 'general';
export type InsightStatus = 'new' | 'viewed' | 'dismissed' | 'resolved';
export type InsightConfidence = 'low' | 'medium' | 'high';
export type AIMessageRole = 'user' | 'assistant' | 'system';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  declared_monthly_income?: number;
  declared_monthly_expenses?: number;
  target_expense_reduction_percent?: number;
  target_monthly_expenses?: number;
  onboarding_completed?: boolean;
  onboarding_step?: number;
  onboarding_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImportJob {
  id: string;
  user_id: string;
  filename: string;
  status: ImportJobStatus;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  skipped_rows: number;
  error_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  description: string;
  /** Positive numeric magnitude, e.g. "124.50". Direction governed by `type`. */
  amount: number | string;
  currency: string;
  type: TransactionType;
  transaction_date: string; // ISO date YYYY-MM-DD
  merchant: string | null;
  notes: string | null;
  source: TransactionSource;
  import_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithCategory extends Transaction {
  categories?: Pick<Category, 'id' | 'name' | 'type' | 'icon' | 'color'> | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number | string;
  currency: string;
  period_type: BudgetPeriodType;
  start_date: string; // ISO date YYYY-MM-DD
  end_date: string; // ISO date YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string;
  /** Actual recorded contributions allocated toward the goal */
  current_amount: number | string;
  currency: string;
  target_date: string | null;
  tracking_strategy: GoalTrackingStrategy;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface Insight {
  id: string;
  user_id: string;
  type: InsightType;
  title: string;
  explanation: string;
  status: InsightStatus;
  confidence: InsightConfidence;
  evidence_metadata: Record<string, Json>;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: AIMessageRole;
  content: string;
  evidence_references: Record<string, Json>;
  created_at: string;
}
