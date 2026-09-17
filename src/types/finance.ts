export type FinanceCategoryType = 'expense' | 'income';

export interface FinanceCategory {
  id: string;
  name: string;
  type: FinanceCategoryType;
  description?: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FinanceExpense {
  id: string;
  market_day_id: string;
  category_id?: string | null;
  category_name: string;
  description: string;
  amount: number;
  date_incurred: string;
  receipt_url?: string | null;
  created_by?: string | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceIncome {
  id: string;
  market_day_id: string;
  source_category_id?: string | null;
  source_category_name: string;
  description: string;
  amount: number;
  date_received: string;
  created_by?: string | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EditionFinanceSummary {
  market_day_id: string;
  region_id?: string;
  edition_name: string;
  edition_title?: string;
  event_date: string;
  edition_status?: string;
  vendor_revenue: number;
  other_income: number;
  total_revenue: number;
  total_expenses: number;
  net_balance: number;
  spend_rate_pct: number | null;
}

export interface FinanceLedgerItem {
  id: string;
  item_type: 'expense' | 'income';
  category_name: string;
  category_id?: string | null;
  description: string;
  amount: number;
  date: string;
  receipt_url?: string | null;
  created_by_email?: string | null;
  created_at: string;
}

export interface CrossEditionTrendPoint {
  edition_id: string;
  edition_name: string;
  event_date: string;
  region_id?: string;
  region_name?: string;
  vendor_revenue: number;
  other_income: number;
  total_revenue: number;
  total_expenses: number;
  net_balance: number;
  spend_rate_pct: number | null;
}
