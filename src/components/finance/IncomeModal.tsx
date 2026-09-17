'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FinanceIncome, FinanceCategory } from '@/types/finance';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (income: FinanceIncome) => void;
  editionId: string;
  editionName: string;
  categories: FinanceCategory[];
  onOpenCategoryManager?: () => void;
  incomeToEdit?: FinanceIncome | null;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editionId,
  editionName,
  categories,
  onOpenCategoryManager,
  incomeToEdit,
}) => {
  const [sourceCategoryId, setSourceCategoryId] = useState('');
  const [sourceCategoryName, setSourceCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (incomeToEdit) {
      setSourceCategoryId(incomeToEdit.source_category_id || '');
      setSourceCategoryName(incomeToEdit.source_category_name || '');
      setDescription(incomeToEdit.description || '');
      setAmountInput(incomeToEdit.amount ? Number(incomeToEdit.amount).toLocaleString() : '');
      setDateReceived(incomeToEdit.date_received || new Date().toISOString().split('T')[0]);
    } else {
      const defaultCat = categories.find((c) => c.type === 'income');
      setSourceCategoryId(defaultCat?.id || '');
      setSourceCategoryName(defaultCat?.name || 'Sponsorships');
      setDescription('');
      setAmountInput('');
      setDateReceived(new Date().toISOString().split('T')[0]);
    }
    setError(null);
  }, [incomeToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (!rawVal) {
      setAmountInput('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmountInput(num.toLocaleString());
  };

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const cat = categories.find((c) => c.id === selectedId);
    setSourceCategoryId(selectedId);
    if (cat) {
      setSourceCategoryName(cat.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(amountInput.replace(/[^0-9]/g, ''), 10);

    if (!cleanAmount || cleanAmount <= 0) {
      setError('Please enter a valid income amount');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description or sponsor note');
      return;
    }
    if (!sourceCategoryName) {
      setError('Please select an income source category');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        id: incomeToEdit?.id,
        market_day_id: editionId,
        source_category_id: sourceCategoryId || null,
        source_category_name: sourceCategoryName,
        description: description.trim(),
        amount: cleanAmount,
        date_received: dateReceived,
      };

      const res = await fetch('/api/finance/incomes', {
        method: incomeToEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save income');

      onSaved(data.income);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving income');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-border rounded-2xl shadow-modal w-full max-w-lg overflow-hidden animate-card-entrance">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-text-primary">
              {incomeToEdit ? 'Edit Other Income Entry' : 'Add Other Income'}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Edition: <span className="font-semibold text-accent">{editionName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-muted/50 border border-red/30 rounded-lg flex items-center gap-2 text-xs text-red font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Income Source / Category Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-primary">
                Income Source / Stream <span className="text-red">*</span>
              </label>
              {onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="text-[11px] font-medium text-accent hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Manage Categories
                </button>
              )}
            </div>
            <select
              value={sourceCategoryId}
              onChange={handleCategorySelect}
              className="w-full h-10 px-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
              required
            >
              {categories
                .filter((c) => c.type === 'income')
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Amount (UGX) */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Amount (UGX) <span className="text-red">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-secondary">
                UGX
              </span>
              <input
                type="text"
                value={amountInput}
                onChange={handleAmountChange}
                placeholder="e.g. 1,500,000"
                className="w-full h-10 pl-12 pr-3 border border-border rounded-lg text-sm font-semibold text-text-primary bg-white focus:outline-hidden focus:border-accent"
                required
              />
            </div>
          </div>

          {/* Date Received */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Date Received <span className="text-red">*</span>
            </label>
            <input
              type="date"
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
              required
            />
          </div>

          {/* Description / Memo */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Description / Notes <span className="text-red">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Main stage banner branding package from telecom partner"
              rows={3}
              className="w-full p-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent resize-none"
              required
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : incomeToEdit ? (
                'Save Changes'
              ) : (
                'Add Income'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
