import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastProvider';
import {
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Sparkles,
  SlidersHorizontal,
  Table as TableIcon,
  RefreshCw,
  Eye,
  Building,
  User,
  CreditCard,
  Star,
  MapPin,
  Calendar,
} from 'lucide-react';
import { EXPORT_COLUMNS, ExportColumnDef } from '@/types/vendorExport';

export interface VendorExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  editions: Array<{ id: string; name: string; region_id?: string }>;
  regions: Array<{ id: string; name: string }>;
  activeEdition: { id: string; name: string } | null;
  activeRegion: { id: string; name: string } | null;
}

const PRESET_TEMPLATES: Record<string, { label: string; description: string; columns: string[] }> = {
  names_only: {
    label: 'Business names only',
    description: 'Clean list of business names',
    columns: ['business_name'],
  },
  names_contact: {
    label: 'Business names + contact',
    description: 'Business name, contact person, phone, email',
    columns: ['business_name', 'contact_name', 'phone', 'email'],
  },
  payments: {
    label: 'Business + payments',
    description: 'Amounts paid, status, standard fee, fee source',
    columns: [
      'business_name',
      'contact_name',
      'amount_paid_ugx',
      'payment_status',
      'standard_fee_ugx',
      'fee_source',
    ],
  },
  ratings: {
    label: 'Business + ratings',
    description: 'Marketing power rating (0-10), stars, notes, and averages',
    columns: [
      'business_name',
      'contact_name',
      'rating',
      'rating_stars',
      'rating_note',
      'avg_rating',
    ],
  },
  full: {
    label: 'Full export',
    description: 'Complete dataset across all categories',
    columns: EXPORT_COLUMNS.map((c) => c.key),
  },
};

const COLUMN_GROUPS = [
  { key: 'business', label: 'Business Information', icon: Building },
  { key: 'contact', label: 'Contact Details', icon: User },
  { key: 'payments', label: 'Payments & Tickets', icon: CreditCard },
  { key: 'rating', label: 'Marketing Power Ratings', icon: Star },
  { key: 'edition', label: 'Edition & Region', icon: MapPin },
  { key: 'registration', label: 'Registration & Activity', icon: Calendar },
] as const;

const STORAGE_KEY = 'quonnect_vendor_export_prefs';

export const VendorExportModal: React.FC<VendorExportModalProps> = ({
  isOpen,
  onClose,
  editions,
  regions,
  activeEdition,
  activeRegion,
}) => {
  const { addToast } = useToast();

  // 1. Edition & Region filter states
  const [editionMode, setEditionMode] = useState<'current' | 'multiple' | 'all'>('current');
  const [selectedEditionIds, setSelectedEditionIds] = useState<string[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('All');

  // 2. Column selection
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    PRESET_TEMPLATES.payments.columns
  );
  const [activePreset, setActivePreset] = useState<string>('payments');

  // 3. Extra filters
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | 'rated' | 'unrated' | '1-3' | '4-6' | '7-8' | '9-10'>('all');
  const [minRating, setMinRating] = useState<number>(0);

  // 4. Sort
  const [sortField, setSortField] = useState<'business_name' | 'rating' | 'amount_paid' | 'contact_name'>('business_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 5. Preview state
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedColumns && Array.isArray(parsed.selectedColumns)) {
          setSelectedColumns(parsed.selectedColumns);
          setActivePreset(parsed.activePreset || '');
        }
        if (parsed.paymentFilter) setPaymentFilter(parsed.paymentFilter);
        if (parsed.ratingFilter) setRatingFilter(parsed.ratingFilter);
        if (parsed.sortField) setSortField(parsed.sortField);
        if (parsed.sortDirection) setSortDirection(parsed.sortDirection);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initialize selected edition with activeEdition
  useEffect(() => {
    if (activeEdition?.id && selectedEditionIds.length === 0) {
      setSelectedEditionIds([activeEdition.id]);
    }
    if (activeRegion?.id && selectedRegionId === 'All') {
      setSelectedRegionId(activeRegion.id);
    }
  }, [activeEdition, activeRegion]);

  // Compute final edition IDs based on mode
  const effectiveEditionIds = useMemo(() => {
    if (editionMode === 'current') {
      return activeEdition?.id ? [activeEdition.id] : [];
    }
    if (editionMode === 'all') {
      return ['all'];
    }
    return selectedEditionIds;
  }, [editionMode, activeEdition, selectedEditionIds]);

  // Save preferences
  const savePrefs = useCallback((cols: string[], presetKey: string) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedColumns: cols,
          activePreset: presetKey,
          paymentFilter,
          ratingFilter,
          sortField,
          sortDirection,
        })
      );
    } catch {
      // ignore
    }
  }, [paymentFilter, ratingFilter, sortField, sortDirection]);

  // Preset click handler
  const handleSelectPreset = (presetKey: string) => {
    const preset = PRESET_TEMPLATES[presetKey];
    if (preset) {
      setSelectedColumns(preset.columns);
      setActivePreset(presetKey);
      savePrefs(preset.columns, presetKey);
    }
  };

  // Toggle individual column
  const handleToggleColumn = (colKey: string) => {
    let next: string[];
    if (selectedColumns.includes(colKey)) {
      if (selectedColumns.length === 1) {
        addToast('At least one column must be selected.', 'info');
        return;
      }
      next = selectedColumns.filter((k) => k !== colKey);
    } else {
      next = [...selectedColumns, colKey];
    }
    setSelectedColumns(next);
    setActivePreset(''); // User modified preset
    savePrefs(next, '');
  };

  // Toggle group of columns
  const handleToggleGroup = (groupKey: string) => {
    const groupCols = EXPORT_COLUMNS.filter((c) => c.group === groupKey).map((c) => c.key);
    const allSelected = groupCols.every((k) => selectedColumns.includes(k));
    let next: string[];
    if (allSelected) {
      next = selectedColumns.filter((k) => !groupCols.includes(k));
      if (next.length === 0) {
        addToast('At least one column must be selected.', 'info');
        return;
      }
    } else {
      next = Array.from(new Set([...selectedColumns, ...groupCols]));
    }
    setSelectedColumns(next);
    setActivePreset('');
    savePrefs(next, '');
  };

  // Fetch live preview and count
  const fetchPreview = useCallback(async () => {
    if (!isOpen) return;
    setLoadingPreview(true);
    try {
      const res = await fetch('/api/vendors/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editionIds: effectiveEditionIds,
          regionId: selectedRegionId,
          columns: selectedColumns,
          filters: {
            paymentStatus: paymentFilter,
            ratingStatus: ratingFilter,
            minRating,
          },
          sort: {
            field: sortField,
            direction: sortDirection,
          },
          previewOnly: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load preview');
      }

      setPreviewRows(data.previewRows || []);
      setTotalCount(data.totalCount ?? 0);
    } catch (err: any) {
      addToast(`Preview error: ${err.message}`, 'error');
    } finally {
      setLoadingPreview(false);
    }
  }, [
    isOpen,
    effectiveEditionIds,
    selectedRegionId,
    selectedColumns,
    paymentFilter,
    ratingFilter,
    minRating,
    sortField,
    sortDirection,
    addToast,
  ]);

  // Debounced auto-preview when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPreview]);

  // Execute CSV download
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/vendors/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editionIds: effectiveEditionIds,
          regionId: selectedRegionId,
          columns: selectedColumns,
          filters: {
            paymentStatus: paymentFilter,
            ratingStatus: ratingFilter,
            minRating,
          },
          sort: {
            field: sortField,
            direction: sortDirection,
          },
          previewOnly: false,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      // Extract filename from header or fallback
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : 'quonnect-vendors.csv';

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast(`Exported ${totalCount !== null ? totalCount : ''} vendors successfully!`, 'success');
      onClose();
    } catch (err: any) {
      addToast(`Export failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Customizable Vendor CSV Export</h3>
              <p className="text-xs text-text-secondary">
                Select editions, preset templates, or customize every column.
              </p>
            </div>
          </div>
          {totalCount !== null && (
            <div className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-mono font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{totalCount} vendors will be exported</span>
            </div>
          )}
        </div>
      }
      maxWidth="3xl"
    >
      <div className="space-y-6 text-left select-none text-xs">
        {/* Live count banner for mobile */}
        {totalCount !== null && (
          <div className="sm:hidden bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center text-xs font-bold text-emerald-800">
            {totalCount} vendors will be exported
          </div>
        )}

        {/* 1. EDITIONS & REGION SECTION */}
        <div className="bg-slate-50 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span>1. Edition & Region Scope</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Edition Mode */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">Edition Selection</label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editionMode"
                    checked={editionMode === 'current'}
                    onChange={() => setEditionMode('current')}
                    className="text-accent focus:ring-accent"
                  />
                  <span>Current: <strong>{activeEdition?.name || 'Selected'}</strong></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editionMode"
                    checked={editionMode === 'multiple'}
                    onChange={() => setEditionMode('multiple')}
                    className="text-accent focus:ring-accent"
                  />
                  <span>Pick multiple editions</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editionMode"
                    checked={editionMode === 'all'}
                    onChange={() => setEditionMode('all')}
                    className="text-accent focus:ring-accent"
                  />
                  <span>All editions (system-wide)</span>
                </label>
              </div>
            </div>

            {/* Region Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">Region Scope</label>
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
              >
                <option value="All">All Regions</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* If multiple editions chosen, checklist */}
            {editionMode === 'multiple' && (
              <div className="md:col-span-3 bg-white border border-border rounded-lg p-3 max-h-36 overflow-y-auto space-y-1">
                <div className="text-[10px] text-text-tertiary uppercase font-bold mb-1">Choose Editions:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {editions.map((ed) => {
                    const isChecked = selectedEditionIds.includes(ed.id);
                    return (
                      <label key={ed.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEditionIds([...selectedEditionIds, ed.id]);
                            } else {
                              setSelectedEditionIds(selectedEditionIds.filter((id) => id !== ed.id));
                            }
                          }}
                          className="rounded text-accent focus:ring-accent"
                        />
                        <span className="truncate">{ed.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. PRESET TEMPLATES (ONE CLICK) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>2. Preset Templates (One Click)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(PRESET_TEMPLATES).map(([key, preset]) => {
              const isActive = activePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-blue-50/80 border-accent text-accent font-bold shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-border text-text-primary'
                  }`}
                >
                  <span className="text-xs font-semibold block">{preset.label}</span>
                  <span className="text-[10px] text-text-tertiary line-clamp-1 mt-1">
                    {preset.columns.length} columns
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. CUSTOM COLUMNS CHECKLIST */}
        <div className="bg-white border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-accent" />
              <span>3. Column Checklist ({selectedColumns.length} selected)</span>
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  const all = EXPORT_COLUMNS.map((c) => c.key);
                  setSelectedColumns(all);
                  setActivePreset('full');
                  savePrefs(all, 'full');
                }}
                className="text-accent hover:underline font-semibold"
              >
                Select all
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedColumns(['business_name']);
                  setActivePreset('names_only');
                  savePrefs(['business_name'], 'names_only');
                }}
                className="text-text-secondary hover:underline"
              >
                Reset to names
              </button>
            </div>
          </div>

          {/* Grouped column checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COLUMN_GROUPS.map((group) => {
              const groupCols = EXPORT_COLUMNS.filter((c) => c.group === group.key);
              const groupSelectedCount = groupCols.filter((c) => selectedColumns.includes(c.key)).length;
              const allGroupSelected = groupSelectedCount === groupCols.length;

              return (
                <div key={group.key} className="bg-slate-50/70 border border-border-light rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleGroup(group.key)}
                      className="flex items-center gap-1.5 text-xs font-bold text-text-primary hover:text-accent cursor-pointer"
                    >
                      <group.icon className="w-3.5 h-3.5 text-text-secondary" />
                      <span>{group.label}</span>
                    </button>
                    <span className="text-[10px] font-mono text-text-tertiary">
                      {groupSelectedCount}/{groupCols.length}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    {groupCols.map((col) => {
                      const isChecked = selectedColumns.includes(col.key);
                      return (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 cursor-pointer hover:text-accent group"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleColumn(col.key)}
                            className="rounded text-accent focus:ring-accent"
                          />
                          <span className="text-[11px] font-medium text-text-secondary group-hover:text-text-primary">
                            {col.description || col.header}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. EXTRA FILTERS & SORT */}
        <div className="bg-slate-50 border border-border rounded-xl p-4 space-y-3">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
            <span>4. Extra Filters & Sort Order</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Payment Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">Payment Status</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
              >
                <option value="all">All Vendors</option>
                <option value="paid">Paid only</option>
                <option value="unpaid">Unpaid only</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">Marketing Power Rating</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value as any)}
                className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
              >
                <option value="all">All Ratings</option>
                <option value="rated">Rated only</option>
                <option value="unrated">Unrated only</option>
                <option value="9-10">9–10 (Top pullers)</option>
                <option value="7-8">7–8 (High reach)</option>
                <option value="4-6">4–6 (Medium)</option>
                <option value="1-3">1–3 (Low)</option>
              </select>
            </div>

            {/* Minimum Rating */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">Minimum Rating</label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
              >
                <option value={0}>No minimum</option>
                <option value={5}>Min 5/10 (2.5★)</option>
                <option value={7}>Min 7/10 (3.5★)</option>
                <option value={8}>Min 8/10 (4.0★)</option>
                <option value={9}>Min 9/10 (4.5★)</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1">Sort Order</label>
              <div className="flex gap-1.5">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  className="flex-1 bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
                >
                  <option value="business_name">Business Name</option>
                  <option value="rating">Rating</option>
                  <option value="amount_paid">Amount Paid</option>
                  <option value="contact_name">Contact Name</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-2.5 bg-white border border-border rounded-lg font-mono font-bold text-xs hover:bg-slate-100"
                  title="Toggle Ascending/Descending"
                >
                  {sortDirection.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. PREVIEW TABLE (FIRST ~5 ROWS) */}
        <div className="bg-white border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-accent" />
              <span>5. Live Preview (First 5 Rows)</span>
            </span>
            <button
              type="button"
              onClick={fetchPreview}
              className="text-[11px] text-accent font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingPreview ? 'animate-spin' : ''}`} />
              <span>Refresh preview</span>
            </button>
          </div>

          <div className="w-full overflow-x-auto border border-border rounded-lg max-h-48">
            {loadingPreview ? (
              <div className="p-8 text-center text-text-tertiary">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent mx-auto mb-2" />
                <span>Computing preview dataset...</span>
              </div>
            ) : previewRows.length === 0 ? (
              <div className="p-8 text-center text-text-tertiary">
                No vendor rows match current criteria.
              </div>
            ) : (
              <table className="w-full border-collapse text-left min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    {selectedColumns.map((colKey) => {
                      const def = EXPORT_COLUMNS.find((c) => c.key === colKey);
                      return (
                        <th
                          key={colKey}
                          className="p-2 text-[10px] font-bold text-text-tertiary uppercase tracking-wider whitespace-nowrap"
                        >
                          {def?.header || colKey}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-[11px] font-mono">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {selectedColumns.map((colKey) => (
                        <td key={colKey} className="p-2 whitespace-nowrap text-text-primary">
                          {row[colKey] !== undefined && row[colKey] !== '' ? row[colKey] : <span className="text-slate-300 italic">empty</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="text-xs text-text-secondary">
            {totalCount !== null ? (
              <span>Ready to export <strong>{totalCount}</strong> vendor records</span>
            ) : (
              <span>Ready to export</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isExporting} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              disabled={isExporting || totalCount === 0}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="w-4 h-4 mr-1.5" />
              <span>{isExporting ? 'Generating CSV...' : `Download CSV (${totalCount ?? 0})`}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
