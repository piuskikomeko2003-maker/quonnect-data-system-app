'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileCode,
  Tag,
  Wallet,
  Building2,
} from 'lucide-react';
import { useRegion } from '@/context/RegionContext';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { FinanceSummaryCards } from './FinanceSummaryCards';
import { FinanceCharts } from './FinanceCharts';
import { FinanceLedgerTable } from './FinanceLedgerTable';
import { ExpenseModal } from './ExpenseModal';
import { IncomeModal } from './IncomeModal';
import { CategoryManagerModal } from './CategoryManagerModal';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { FinanceTrendsView } from './FinanceTrendsView';
import {
  FinanceExpense,
  FinanceIncome,
  FinanceCategory,
  EditionFinanceSummary,
} from '@/types/finance';

export const FinanceDashboard: React.FC = () => {
  const { activeRegion, activeEdition, editions, setActiveEdition } = useRegion();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'balance' | 'trends'>('balance');

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  // Financial Data
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [incomes, setIncomes] = useState<FinanceIncome[]>([]);
  const [vendorRevenue, setVendorRevenue] = useState(0);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<FinanceExpense | null>(null);

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<FinanceIncome | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/categories');
      const data = await res.json();
      if (data.tableMissing) setTableMissing(true);
      setCategories(data.categories || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  // Fetch Edition Financial Data (expenses, incomes, summary)
  const fetchEditionData = useCallback(async (editionId: string) => {
    if (!editionId) {
      setExpenses([]);
      setIncomes([]);
      setVendorRevenue(0);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const [expRes, incRes, sumRes] = await Promise.all([
        fetch(`/api/finance/expenses?edition_id=${editionId}`),
        fetch(`/api/finance/incomes?edition_id=${editionId}`),
        fetch(`/api/finance/summary?edition_id=${editionId}`),
      ]);

      const [expData, incData, sumData] = await Promise.all([
        expRes.json(),
        incRes.json(),
        sumRes.json(),
      ]);

      if (expData.tableMissing || incData.tableMissing) {
        setTableMissing(true);
      }

      setExpenses(expData.expenses || []);
      setIncomes(incData.incomes || []);
      setVendorRevenue(sumData?.summary?.vendor_revenue || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load edition financial data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load & when activeEdition changes
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (activeEdition?.id) {
      setLoading(true);
      fetchEditionData(activeEdition.id);
    } else {
      setLoading(false);
    }
  }, [activeEdition?.id, fetchEditionData]);

  // Handle Manual Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchCategories(),
      activeEdition?.id ? fetchEditionData(activeEdition.id) : Promise.resolve(),
    ]);
    addToast('Finance data refreshed', 'success');
  };

  // Live Auto-Calculated Totals
  const totals = useMemo(() => {
    const otherIncomesTotal = incomes.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const totalRev = vendorRevenue + otherIncomesTotal;
    const totalExp = expenses.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const netBal = totalRev - totalExp;
    const spendRate = totalRev > 0 ? Number(((totalExp / totalRev) * 100).toFixed(2)) : null;

    return {
      vendorRevenue,
      otherIncome: otherIncomesTotal,
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netBalance: netBal,
      spendRatePct: spendRate,
    };
  }, [vendorRevenue, incomes, expenses]);

  // Live Expense Breakdown by Category
  const expenseBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category_name || 'Uncategorized';
      catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
    });

    return Object.entries(catMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage:
          totals.totalExpenses > 0
            ? Number(((amount / totals.totalExpenses) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totals.totalExpenses]);

  // Live Income Breakdown by Source
  const incomeBreakdown = useMemo(() => {
    const sourceMap: Record<string, number> = {};
    incomes.forEach((i) => {
      const src = i.source_category_name || 'Other';
      sourceMap[src] = (sourceMap[src] || 0) + (Number(i.amount) || 0);
    });

    const vendorShare =
      totals.totalRevenue > 0
        ? Number(((totals.vendorRevenue / totals.totalRevenue) * 100).toFixed(1))
        : 0;

    return [
      {
        source: 'Vendor Slot Sales',
        amount: totals.vendorRevenue,
        percentage: vendorShare,
      },
      ...Object.entries(sourceMap).map(([source, amount]) => ({
        source,
        amount,
        percentage:
          totals.totalRevenue > 0
            ? Number(((amount / totals.totalRevenue) * 100).toFixed(1))
            : 0,
      })),
    ];
  }, [incomes, totals.vendorRevenue, totals.totalRevenue]);

  // Expense CRUD Handlers (Instant live update)
  const handleExpenseSaved = (saved: FinanceExpense) => {
    setExpenses((prev) => {
      const existingIdx = prev.findIndex((e) => e.id === saved.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    addToast('Expense recorded successfully', 'success');
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await fetch(`/api/finance/expenses?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete expense');

    setExpenses((prev) => prev.filter((e) => e.id !== id));
    addToast('Expense entry deleted', 'info');
  };

  // Income CRUD Handlers (Instant live update)
  const handleIncomeSaved = (saved: FinanceIncome) => {
    setIncomes((prev) => {
      const existingIdx = prev.findIndex((i) => i.id === saved.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    addToast('Other income recorded successfully', 'success');
  };

  const handleDeleteIncome = async (id: string) => {
    const res = await fetch(`/api/finance/incomes?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete income');

    setIncomes((prev) => prev.filter((i) => i.id !== id));
    addToast('Income entry deleted', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
              Finance & Balance Sheet
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-soft text-accent uppercase tracking-wider">
              Real-Time
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Track operational expenses, non-vendor revenues, live net balance, and multi-edition trends
          </p>
        </div>

        {/* View Switcher: Edition Balance Sheet vs Cross-Edition Trends */}
        <div className="flex items-center gap-3">
          <div className="flex border border-border rounded-xl p-1 bg-white shadow-xs">
            <button
              onClick={() => setActiveTab('balance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'balance'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Edition Balance</span>
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'trends'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Finance Trends</span>
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-border rounded-xl bg-white text-text-secondary hover:text-accent hover:border-accent shadow-xs transition-colors"
            title="Refresh All"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Migration Reminder Banner (If tableMissing) */}
      {tableMissing && (
        <div className="p-4 bg-amber-50 border border-amber/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Database Setup Notice: Finance Tables Missing</p>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                The database tables for the Finance Module have not yet been executed in your Supabase project.
                Run the migration file{' '}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-semibold text-amber-900">
                  supabase/migrations/add_finance_module.sql
                </code>{' '}
                in your Supabase SQL Editor to enable persistent ledger storage and PostgreSQL views.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <a
              href="https://supabase.com/dashboard/project/phaafkuwtgpawuqnenkp/sql/new"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <span>Open Supabase SQL Editor ↗</span>
            </a>
          </div>
        </div>
      )}

      {/* Main Content Areas */}
      {activeTab === 'trends' ? (
        /* Cross-Edition Trends Section */
        <FinanceTrendsView />
      ) : (
        /* Per-Edition Balance Sheet Section */
        <div className="space-y-6 animate-card-entrance">
          {/* Edition Selection Bar */}
          <div className="bg-white border border-border rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-secondary">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block">
                  Active Market Edition
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <select
                    value={activeEdition?.id || ''}
                    onChange={(e) => {
                      const found = editions.find((ed) => ed.id === e.target.value);
                      if (found) setActiveEdition(found);
                    }}
                    className="h-8 pl-2 pr-8 border border-border rounded-lg text-xs font-bold text-text-primary bg-white focus:outline-hidden focus:border-accent"
                  >
                    {editions.map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name} {ed.date ? `(${ed.date})` : ''}
                      </option>
                    ))}
                  </select>
                  {activeRegion && (
                    <span className="text-xs text-text-tertiary">
                      Region: <strong>{activeRegion.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCategoryModalOpen(true)}
              >
                <Tag className="w-3.5 h-3.5 mr-1 text-text-secondary" />
                Categories
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIncomeToEdit(null);
                  setIsIncomeModalOpen(true);
                }}
              >
                + Other Income
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setExpenseToEdit(null);
                  setIsExpenseModalOpen(true);
                }}
              >
                + Add Expense
              </Button>
            </div>
          </div>

          {!activeEdition ? (
            <div className="bg-white border border-border rounded-xl p-12 text-center text-text-muted">
              <Calendar className="w-10 h-10 mx-auto mb-3 stroke-1" />
              <p className="text-sm font-semibold text-text-primary">No Edition Selected</p>
              <p className="text-xs text-text-secondary mt-1">
                Please select an edition above or switch regions to view its financial balance sheet.
              </p>
            </div>
          ) : (
            <>
              {/* Summary KPI Cards */}
              <FinanceSummaryCards
                totalRevenue={totals.totalRevenue}
                vendorRevenue={totals.vendorRevenue}
                otherIncome={totals.otherIncome}
                totalExpenses={totals.totalExpenses}
                expenseCount={expenses.length}
                netBalance={totals.netBalance}
                spendRatePct={totals.spendRatePct}
              />

              {/* Expense & Income Breakdown Visualizations */}
              <FinanceCharts
                expenseBreakdown={expenseBreakdown}
                incomeBreakdown={incomeBreakdown}
                totalExpenses={totals.totalExpenses}
                totalRevenue={totals.totalRevenue}
              />

              {/* Running Ledger Table */}
              <FinanceLedgerTable
                expenses={expenses}
                incomes={incomes}
                categories={categories}
                onAddExpense={() => {
                  setExpenseToEdit(null);
                  setIsExpenseModalOpen(true);
                }}
                onAddIncome={() => {
                  setIncomeToEdit(null);
                  setIsIncomeModalOpen(true);
                }}
                onEditExpense={(exp) => {
                  setExpenseToEdit(exp);
                  setIsExpenseModalOpen(true);
                }}
                onEditIncome={(inc) => {
                  setIncomeToEdit(inc);
                  setIsIncomeModalOpen(true);
                }}
                onDeleteExpense={handleDeleteExpense}
                onDeleteIncome={handleDeleteIncome}
                onPreviewReceipt={(url) => setPreviewReceiptUrl(url)}
              />
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {activeEdition && (
        <>
          <ExpenseModal
            isOpen={isExpenseModalOpen}
            onClose={() => {
              setIsExpenseModalOpen(false);
              setExpenseToEdit(null);
            }}
            onSaved={handleExpenseSaved}
            editionId={activeEdition.id}
            editionName={activeEdition.name}
            categories={categories}
            onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
            expenseToEdit={expenseToEdit}
          />

          <IncomeModal
            isOpen={isIncomeModalOpen}
            onClose={() => {
              setIsIncomeModalOpen(false);
              setIncomeToEdit(null);
            }}
            onSaved={handleIncomeSaved}
            editionId={activeEdition.id}
            editionName={activeEdition.name}
            categories={categories}
            onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
            incomeToEdit={incomeToEdit}
          />
        </>
      )}

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onCategoryAdded={(newCat) => {
          setCategories((prev) => [...prev, newCat]);
          addToast(`Category "${newCat.name}" added`, 'success');
        }}
        onCategoryDeleted={(delId) => {
          setCategories((prev) => prev.filter((c) => c.id !== delId));
          addToast('Category removed', 'info');
        }}
      />

      <ReceiptPreviewModal
        isOpen={!!previewReceiptUrl}
        onClose={() => setPreviewReceiptUrl(null)}
        receiptUrl={previewReceiptUrl}
      />
    </div>
  );
};
