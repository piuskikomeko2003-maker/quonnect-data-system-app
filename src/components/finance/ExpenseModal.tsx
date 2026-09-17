'use client';

import React, { useState, useEffect } from 'react';
import { X, UploadCloud, Loader2, AlertCircle, FileText, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FinanceExpense, FinanceCategory } from '@/types/finance';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (expense: FinanceExpense) => void;
  editionId: string;
  editionName: string;
  categories: FinanceCategory[];
  onOpenCategoryManager?: () => void;
  expenseToEdit?: FinanceExpense | null;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editionId,
  editionName,
  categories,
  onOpenCategoryManager,
  expenseToEdit,
}) => {
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [dateIncurred, setDateIncurred] = useState(new Date().toISOString().split('T')[0]);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setCategoryId(expenseToEdit.category_id || '');
      setCategoryName(expenseToEdit.category_name || '');
      setDescription(expenseToEdit.description || '');
      setAmountInput(expenseToEdit.amount ? Number(expenseToEdit.amount).toLocaleString() : '');
      setDateIncurred(expenseToEdit.date_incurred || new Date().toISOString().split('T')[0]);
      setReceiptUrl(expenseToEdit.receipt_url || null);
    } else {
      const defaultCat = categories.find((c) => c.type === 'expense');
      setCategoryId(defaultCat?.id || '');
      setCategoryName(defaultCat?.name || 'Employees & Wages');
      setDescription('');
      setAmountInput('');
      setDateIncurred(new Date().toISOString().split('T')[0]);
      setReceiptUrl(null);
    }
    setError(null);
  }, [expenseToEdit, categories, isOpen]);

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
    setCategoryId(selectedId);
    if (cat) {
      setCategoryName(cat.name);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit');
      return;
    }

    setUploadingReceipt(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('edition_id', editionId);

      const res = await fetch('/api/finance/receipts', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload receipt');

      setReceiptUrl(data.url);
    } catch (err: any) {
      setError(err.message || 'Error uploading receipt');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(amountInput.replace(/[^0-9]/g, ''), 10);

    if (!cleanAmount || cleanAmount <= 0) {
      setError('Please enter a valid expense amount');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a brief description or note for this expense');
      return;
    }
    if (!categoryName) {
      setError('Please select an expense category');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        id: expenseToEdit?.id,
        market_day_id: editionId,
        category_id: categoryId || null,
        category_name: categoryName,
        description: description.trim(),
        amount: cleanAmount,
        date_incurred: dateIncurred,
        receipt_url: receiptUrl,
      };

      const res = await fetch('/api/finance/expenses', {
        method: expenseToEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save expense');

      onSaved(data.expense);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving expense');
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
              {expenseToEdit ? 'Edit Expense Entry' : 'Add New Expense'}
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

          {/* Category Dropdown with Extendable Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-primary">
                Expense Category <span className="text-red">*</span>
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
              value={categoryId}
              onChange={handleCategorySelect}
              className="w-full h-10 px-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
              required
            >
              {categories
                .filter((c) => c.type === 'expense')
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
                placeholder="e.g. 250,000"
                className="w-full h-10 pl-12 pr-3 border border-border rounded-lg text-sm font-semibold text-text-primary bg-white focus:outline-hidden focus:border-accent"
                required
              />
            </div>
          </div>

          {/* Date Incurred */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Date Incurred <span className="text-red">*</span>
            </label>
            <input
              type="date"
              value={dateIncurred}
              onChange={(e) => setDateIncurred(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
              required
            />
          </div>

          {/* Description / Note */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Description / Memo <span className="text-red">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Venue cleaning and waste disposal team (5 workers)"
              rows={3}
              className="w-full p-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent resize-none"
              required
            />
          </div>

          {/* Optional Receipt Upload */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Receipt / Proof of Payment <span className="text-text-muted font-normal">(Optional)</span>
            </label>
            <div className="border border-dashed border-border rounded-lg p-3 bg-bg-elevated/30 flex items-center justify-between">
              {receiptUrl ? (
                <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
                  <FileText className="w-4 h-4 text-green" />
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline truncate max-w-[200px]"
                  >
                    View Uploaded Receipt
                  </a>
                  <button
                    type="button"
                    onClick={() => setReceiptUrl(null)}
                    className="text-red hover:underline text-[11px] ml-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
                    {uploadingReceipt ? (
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    ) : (
                      <UploadCloud className="w-4 h-4 text-accent" />
                    )}
                    <span>{uploadingReceipt ? 'Uploading...' : 'Upload Image / PDF'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      disabled={uploadingReceipt}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-text-tertiary">Max 5MB (PNG, JPG, PDF)</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || uploadingReceipt}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : expenseToEdit ? (
                'Save Changes'
              ) : (
                'Add Expense'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
