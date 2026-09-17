'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  User,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FinanceExpense, FinanceIncome, FinanceLedgerItem, FinanceCategory } from '@/types/finance';

interface FinanceLedgerTableProps {
  expenses: FinanceExpense[];
  incomes: FinanceIncome[];
  categories: FinanceCategory[];
  onAddExpense: () => void;
  onAddIncome: () => void;
  onEditExpense: (expense: FinanceExpense) => void;
  onEditIncome: (income: FinanceIncome) => void;
  onDeleteExpense: (id: string) => Promise<void>;
  onDeleteIncome: (id: string) => Promise<void>;
  onPreviewReceipt: (url: string) => void;
}

export const FinanceLedgerTable: React.FC<FinanceLedgerTableProps> = ({
  expenses,
  incomes,
  categories,
  onAddExpense,
  onAddIncome,
  onEditExpense,
  onEditIncome,
  onDeleteExpense,
  onDeleteIncome,
  onPreviewReceipt,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'expenses' | 'incomes'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Combine into unified ledger items
  const ledgerItems: FinanceLedgerItem[] = useMemo(() => {
    const expItems: FinanceLedgerItem[] = expenses.map((e) => ({
      id: e.id,
      item_type: 'expense',
      category_name: e.category_name,
      category_id: e.category_id,
      description: e.description,
      amount: e.amount,
      date: e.date_incurred,
      receipt_url: e.receipt_url,
      created_by_email: e.created_by_email,
      created_at: e.created_at,
    }));

    const incItems: FinanceLedgerItem[] = incomes.map((i) => ({
      id: i.id,
      item_type: 'income',
      category_name: i.source_category_name,
      category_id: i.source_category_id,
      description: i.description,
      amount: i.amount,
      date: i.date_received,
      receipt_url: null,
      created_by_email: i.created_by_email,
      created_at: i.created_at,
    }));

    return [...expItems, ...incItems];
  }, [expenses, incomes]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return ledgerItems
      .filter((item) => {
        // Tab filter
        if (activeTab === 'expenses' && item.item_type !== 'expense') return false;
        if (activeTab === 'incomes' && item.item_type !== 'income') return false;

        // Category filter
        if (categoryFilter !== 'all' && item.category_name !== categoryFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchCat = item.category_name.toLowerCase().includes(q);
          const matchEmail = (item.created_by_email || '').toLowerCase().includes(q);
          if (!matchDesc && !matchCat && !matchEmail) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortField === 'date') {
          const d1 = new Date(a.date).getTime();
          const d2 = new Date(b.date).getTime();
          return sortAsc ? d1 - d2 : d2 - d1;
        } else {
          return sortAsc ? a.amount - b.amount : b.amount - a.amount;
        }
      });
  }, [ledgerItems, activeTab, categoryFilter, searchQuery, sortField, sortAsc]);

  const handleDelete = async (item: FinanceLedgerItem) => {
    if (!confirm(`Are you sure you want to delete this ${item.item_type}: "${item.description}"?`)) return;
    setDeletingId(item.id);
    try {
      if (item.item_type === 'expense') {
        await onDeleteExpense(item.id);
      } else {
        await onDeleteIncome(item.id);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (item: FinanceLedgerItem) => {
    if (item.item_type === 'expense') {
      const found = expenses.find((e) => e.id === item.id);
      if (found) onEditExpense(found);
    } else {
      const found = incomes.find((i) => i.id === item.id);
      if (found) onEditIncome(found);
    }
  };

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    ledgerItems.forEach((i) => set.add(i.category_name));
    return Array.from(set).sort();
  }, [ledgerItems]);

  return (
    <div className="bg-white border border-border rounded-xl shadow-xs overflow-hidden">
      {/* Header & Controls */}
      <div className="p-5 border-b border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Edition Financial Ledger</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Live tracking of all operating expenses and non-vendor revenue streams
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onAddIncome}>
              <ArrowUpRight className="w-3.5 h-3.5 text-green mr-1" />
              + Add Other Income
            </Button>
            <Button variant="primary" size="sm" onClick={onAddExpense}>
              <ArrowDownRight className="w-3.5 h-3.5 text-red mr-1" />
              + Add Expense
            </Button>
          </div>
        </div>

        {/* Filters and Tab Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Sub-tabs: All / Expenses / Other Incomes */}
          <div className="flex border border-border rounded-lg p-0.5 bg-bg-elevated w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-text-primary shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All Entries ({ledgerItems.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'expenses'
                  ? 'bg-white text-red shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('incomes')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'incomes'
                  ? 'bg-white text-green shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Other Incomes ({incomes.length})
            </button>
          </div>

          {/* Search, Category Filter, and Sort */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memo, category, user..."
                className="w-full h-8 pl-8 pr-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-2.5 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Sort Toggle */}
            <button
              onClick={() => {
                if (sortField === 'date') {
                  setSortAsc(!sortAsc);
                } else {
                  setSortField('date');
                  setSortAsc(false);
                }
              }}
              className={`h-8 px-2.5 border border-border rounded-lg text-xs flex items-center gap-1 transition-colors ${
                sortField === 'date' ? 'bg-bg-elevated font-semibold text-text-primary' : 'bg-white text-text-secondary'
              }`}
              title="Sort by Date"
            >
              <Calendar className="w-3 h-3" />
              <span>Date</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                if (sortField === 'amount') {
                  setSortAsc(!sortAsc);
                } else {
                  setSortField('amount');
                  setSortAsc(false);
                }
              }}
              className={`h-8 px-2.5 border border-border rounded-lg text-xs flex items-center gap-1 transition-colors ${
                sortField === 'amount' ? 'bg-bg-elevated font-semibold text-text-primary' : 'bg-white text-text-secondary'
              }`}
              title="Sort by Amount"
            >
              <span>UGX</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-elevated/40 text-text-secondary font-medium select-none">
              <th className="py-2.5 px-4 font-semibold">Type</th>
              <th className="py-2.5 px-4 font-semibold">Date</th>
              <th className="py-2.5 px-4 font-semibold">Category / Stream</th>
              <th className="py-2.5 px-4 font-semibold">Description / Note</th>
              <th className="py-2.5 px-4 font-semibold">Recorded By</th>
              <th className="py-2.5 px-4 font-semibold text-center">Proof / Receipt</th>
              <th className="py-2.5 px-4 font-semibold text-right">Amount (UGX)</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-text-muted">
                  No finance records matching your search or filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isExpense = item.item_type === 'expense';
                return (
                  <tr
                    key={`${item.item_type}-${item.id}`}
                    className="hover:bg-bg-elevated/40 transition-colors"
                  >
                    {/* Type Badge */}
                    <td className="py-3 px-4">
                      {isExpense ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-muted text-red">
                          <ArrowDownRight className="w-3 h-3" />
                          Expense
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-muted text-green">
                          <ArrowUpRight className="w-3 h-3" />
                          Income
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-text-secondary font-medium">
                      {item.date}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-text-primary">{item.category_name}</span>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-text-primary line-clamp-2">{item.description}</p>
                    </td>

                    {/* Recorded By */}
                    <td className="py-3 px-4 whitespace-nowrap text-text-secondary">
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <User className="w-3 h-3 text-text-muted" />
                        {item.created_by_email?.split('@')[0] || 'Admin'}
                      </span>
                    </td>

                    {/* Proof / Receipt */}
                    <td className="py-3 px-4 text-center">
                      {item.receipt_url ? (
                        <button
                          type="button"
                          onClick={() => onPreviewReceipt(item.receipt_url!)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-bg-elevated text-accent hover:bg-accent hover:text-white transition-colors text-[11px] font-medium"
                          title="View receipt image"
                        >
                          <FileText className="w-3 h-3" />
                          Receipt
                        </button>
                      ) : (
                        <span className="text-text-tertiary text-[11px]">—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`font-bold text-xs ${
                          isExpense ? 'text-red' : 'text-green'
                        }`}
                      >
                        {isExpense ? '- ' : '+ '}
                        UGX {item.amount.toLocaleString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="p-1 rounded text-text-secondary hover:text-accent hover:bg-bg-elevated transition-colors"
                          title="Edit entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="p-1 rounded text-text-secondary hover:text-red hover:bg-red-muted/40 transition-colors"
                          title="Delete entry"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary Bar */}
      <div className="p-4 border-t border-border bg-bg-elevated/20 flex flex-wrap items-center justify-between gap-4 text-xs text-text-secondary">
        <div>
          Showing <strong className="text-text-primary">{filteredItems.length}</strong> of{' '}
          {ledgerItems.length} total entries
        </div>
        <div className="flex items-center gap-6">
          <div>
            Filtered Expenses: <strong className="text-red">UGX {
              filteredItems
                .filter((i) => i.item_type === 'expense')
                .reduce((s, i) => s + i.amount, 0)
                .toLocaleString()
            }</strong>
          </div>
          <div>
            Filtered Incomes: <strong className="text-green">UGX {
              filteredItems
                .filter((i) => i.item_type === 'income')
                .reduce((s, i) => s + i.amount, 0)
                .toLocaleString()
            }</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
