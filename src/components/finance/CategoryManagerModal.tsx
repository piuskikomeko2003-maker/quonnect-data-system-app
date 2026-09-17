'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Tag, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FinanceCategory, FinanceCategoryType } from '@/types/finance';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: FinanceCategory[];
  onCategoryAdded: (cat: FinanceCategory) => void;
  onCategoryDeleted: (id: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onCategoryAdded,
  onCategoryDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<FinanceCategoryType>('expense');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === activeTab);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/finance/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          type: activeTab,
          description: newDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');

      onCategoryAdded(data.category);
      setNewName('');
      setNewDescription('');
    } catch (err: any) {
      setError(err.message || 'Error adding category');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: FinanceCategory) => {
    if (cat.is_default) return;
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    setDeletingId(cat.id);
    setError(null);

    try {
      const res = await fetch(`/api/finance/categories?id=${cat.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category');

      onCategoryDeleted(cat.id);
    } catch (err: any) {
      setError(err.message || 'Error deleting category');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-border rounded-2xl shadow-modal w-full max-w-lg overflow-hidden animate-card-entrance">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-text-primary">Manage Finance Categories</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher: Expense vs Income */}
        <div className="flex border-b border-border bg-bg-elevated/40 px-6 pt-3 gap-4 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('expense');
              setError(null);
            }}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeTab === 'expense'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Expense Categories ({categories.filter((c) => c.type === 'expense').length})
          </button>
          <button
            onClick={() => {
              setActiveTab('income');
              setError(null);
            }}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeTab === 'income'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Other Income Sources ({categories.filter((c) => c.type === 'income').length})
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-muted/50 border border-red/30 rounded-lg flex items-center gap-2 text-xs text-red font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="bg-bg-elevated/40 border border-border rounded-xl p-3.5 space-y-3">
            <span className="text-xs font-bold text-text-primary block">
              + Add New {activeTab === 'expense' ? 'Expense' : 'Income'} Category
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Category Name (e.g. Security)"
                className="h-9 px-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
                required
              />
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (Optional)"
                className="h-9 px-3 border border-border rounded-lg text-xs bg-white text-text-primary focus:outline-hidden focus:border-accent"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={saving || !newName.trim()}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                Save Category
              </Button>
            </div>
          </form>

          {/* Existing Categories List */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-2">
              Configured Categories
            </span>
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-white hover:bg-bg-elevated/30 transition-colors text-xs"
                >
                  <div>
                    <span className="font-semibold text-text-primary mr-2">{cat.name}</span>
                    {cat.is_default && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-elevated text-text-secondary">
                        Default
                      </span>
                    )}
                    {cat.description && (
                      <p className="text-[11px] text-text-secondary mt-0.5">{cat.description}</p>
                    )}
                  </div>
                  {!cat.is_default && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      disabled={deletingId === cat.id}
                      className="p-1 text-text-tertiary hover:text-red transition-colors"
                      title="Delete category"
                    >
                      {deletingId === cat.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
