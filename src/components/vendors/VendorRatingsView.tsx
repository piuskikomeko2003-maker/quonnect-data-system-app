import React, { useState, useMemo } from 'react';
import {
  Star,
  Search,
  Download,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  FileSpreadsheet,
  SlidersHorizontal,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { MarketingPowerStars } from './MarketingPowerStars';
import { Vendor } from './VendorTable';

export interface VendorRatingsViewProps {
  vendors: Vendor[];
  activeEdition: { id: string; name: string } | null;
  activeRegion: { id: string; name: string } | null;
  editions: Array<{ id: string; name: string }>;
  regions: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  onRateVendor: (vendor: Vendor) => void;
  onBulkRate: (selectedIds: string[]) => void;
  onOpenExport: () => void;
  onRowClick?: (vendor: Vendor) => void;
}

export const VendorRatingsView: React.FC<VendorRatingsViewProps> = ({
  vendors,
  activeEdition,
  activeRegion,
  editions,
  regions,
  isAdmin,
  onRateVendor,
  onBulkRate,
  onOpenExport,
  onRowClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<
    'all' | 'unrated' | 'rated' | '9-10' | '7-8' | '4-6' | '1-3'
  >('all');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'rating_desc' | 'rating_asc' | 'name' | 'avg_desc'>('rating_desc');

  // Compute metrics
  const totalVendors = vendors.length;
  const ratedVendors = vendors.filter((v) => v.rating !== null && v.rating !== undefined);
  const unratedCount = totalVendors - ratedVendors.length;
  const ratedCount = ratedVendors.length;

  const avgMarketingScore = useMemo(() => {
    if (ratedCount === 0) return 0;
    const sum = ratedVendors.reduce((acc, v) => acc + Number(v.rating), 0);
    return Math.round((sum / ratedCount) * 10) / 10;
  }, [ratedVendors, ratedCount]);

  const topTierCount = vendors.filter((v) => (v.rating || 0) >= 9).length;
  const highTierCount = vendors.filter((v) => (v.rating || 0) >= 7 && (v.rating || 0) <= 8).length;
  const midTierCount = vendors.filter((v) => (v.rating || 0) >= 4 && (v.rating || 0) <= 6).length;
  const lowTierCount = vendors.filter((v) => (v.rating || 0) >= 1 && (v.rating || 0) <= 3).length;

  // Filtered list
  const filteredVendors = useMemo(() => {
    return vendors
      .filter((v) => {
        // Search
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const match =
            (v.businessName && v.businessName.toLowerCase().includes(q)) ||
            (v.name && v.name.toLowerCase().includes(q)) ||
            (v.phone && v.phone.includes(q)) ||
            (v.ratingNote && v.ratingNote.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Tier filter
        const r = v.rating !== null && v.rating !== undefined ? Number(v.rating) : null;
        if (filterTier === 'unrated') return r === null;
        if (filterTier === 'rated') return r !== null;
        if (filterTier === '9-10') return r !== null && r >= 9 && r <= 10;
        if (filterTier === '7-8') return r !== null && r >= 7 && r <= 8;
        if (filterTier === '4-6') return r !== null && r >= 4 && r <= 6;
        if (filterTier === '1-3') return r !== null && r >= 1 && r <= 3;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating_desc') {
          const valA = a.rating ?? -1;
          const valB = b.rating ?? -1;
          return valB - valA;
        }
        if (sortBy === 'rating_asc') {
          const valA = a.rating ?? 99;
          const valB = b.rating ?? 99;
          return valA - valB;
        }
        if (sortBy === 'avg_desc') {
          const valA = a.avgRating ?? -1;
          const valB = b.avgRating ?? -1;
          return valB - valA;
        }
        return (a.businessName || a.name || '').localeCompare(b.businessName || b.name || '');
      });
  }, [vendors, searchTerm, filterTier, sortBy]);

  const isAllSelected =
    filteredVendors.length > 0 &&
    filteredVendors.every((v) => selectedVendorIds.includes(v.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVendorIds(filteredVendors.map((v) => v.id));
    } else {
      setSelectedVendorIds([]);
    }
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedVendorIds([...selectedVendorIds, id]);
    } else {
      setSelectedVendorIds(selectedVendorIds.filter((x) => x !== id));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-left select-none">
      {/* 1. Header with direct Export & Bulk Rate actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-text-primary">
                Marketing Power Ratings & CSV Export
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Rate vendor crowd-pulling power (1–10 stars) for{' '}
                <strong className="text-text-primary">
                  {activeEdition ? activeEdition.name : 'All Editions'}
                </strong>
                , view historical cross-edition averages, and build custom CSV exports.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {selectedVendorIds.length > 0 && isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onBulkRate(selectedVendorIds)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              <span>Rate Selected ({selectedVendorIds.length})</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenExport}
            className="text-xs border-accent/30 text-accent hover:bg-accent-soft/30 font-semibold shadow-xs"
          >
            <Download className="w-4 h-4 mr-1.5 text-accent" />
            <span>Customizable CSV Export</span>
          </Button>
        </div>
      </div>

      {/* 2. Overview Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Average Score */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              Average Power Score
            </span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-700">
              {avgMarketingScore > 0 ? `${avgMarketingScore}/10` : '—'}
            </span>
            {avgMarketingScore > 0 && (
              <span className="text-xs text-text-secondary">
                ({(avgMarketingScore / 2).toFixed(1)}★)
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-text-secondary flex items-center gap-1">
            <MarketingPowerStars rating={avgMarketingScore > 0 ? Math.round(avgMarketingScore) : null} size="xs" showNumber={false} />
            <span className="text-[10px] text-text-tertiary font-medium">across {ratedCount} rated</span>
          </div>
        </div>

        {/* Card 2: Top Tier Vendors (9-10) */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              Top Pullers (9–10★)
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Crowd pullers
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700">
              {topTierCount}
            </span>
            <span className="text-xs text-text-secondary">
              ({totalVendors > 0 ? Math.round((topTierCount / totalVendors) * 100) : 0}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-text-tertiary">
            High organic follower base & crowd appeal
          </div>
        </div>

        {/* Card 3: High Reach (7-8) */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              High Reach (7–8★)
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Consistent
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-700">
              {highTierCount}
            </span>
            <span className="text-xs text-text-secondary">
              ({totalVendors > 0 ? Math.round((highTierCount / totalVendors) * 100) : 0}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-text-tertiary">
            Strong repeat attendance & good sales
          </div>
        </div>

        {/* Card 4: Unrated Vendors */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              Unrated Vendors
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              unratedCount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700'
            }`}>
              {unratedCount > 0 ? 'Needs score' : 'All rated'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-text-primary">
              {unratedCount}
            </span>
            <span className="text-xs text-text-secondary">
              / {totalVendors} total
            </span>
          </div>
          <div className="mt-1 text-[11px] text-text-tertiary">
            {unratedCount > 0 ? 'Click any row below to rate' : '100% of vendors rated for this edition'}
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search vendors by business name, phone, or rating note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-border rounded-lg pl-10 pr-3.5 py-2 text-text-primary text-xs outline-none focus:bg-white focus:border-accent transition-colors"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-text-secondary">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-accent outline-none cursor-pointer"
            >
              <option value="rating_desc">Highest Rating First</option>
              <option value="rating_asc">Lowest / Unrated First</option>
              <option value="avg_desc">Historical Average</option>
              <option value="name">Business Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Tier filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-border/60 pt-3 text-xs">
          <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mr-1">
            Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilterTier('all')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filterTier === 'all'
                ? 'bg-text-primary text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-text-secondary'
            }`}
          >
            All Vendors ({totalVendors})
          </button>
          <button
            type="button"
            onClick={() => setFilterTier('unrated')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filterTier === 'unrated'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60'
            }`}
          >
            Unrated ({unratedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTier('9-10')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filterTier === '9-10'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-text-secondary'
            }`}
          >
            Top 9–10★ ({topTierCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTier('7-8')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filterTier === '7-8'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-text-secondary'
            }`}
          >
            High 7–8★ ({highTierCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTier('4-6')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filterTier === '4-6'
                ? 'bg-slate-800 text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-text-secondary'
            }`}
          >
            Medium 4–6★ ({midTierCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTier('1-3')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filterTier === '1-3'
                ? 'bg-slate-800 text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-text-secondary'
            }`}
          >
            Low 1–3★ ({lowTierCount})
          </button>
        </div>
      </div>

      {/* 4. Interactive Rating Table */}
      <div className="w-full bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="w-full overflow-x-auto">
          {filteredVendors.length === 0 ? (
            <div className="text-center py-16 px-6 flex flex-col items-center justify-center gap-2">
              <Info className="w-8 h-8 text-text-tertiary" />
              <p className="text-sm font-bold text-text-primary">No vendors found</p>
              <p className="text-xs text-text-secondary">
                Try selecting a different rating filter or clear search terms.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse min-w-[840px] text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-border text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="p-3.5 w-[50px] text-center border-r border-border">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-white cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5 text-left">Business & Vendor</th>
                  <th className="p-3.5 text-left">Marketing Power (This Edition)</th>
                  <th className="p-3.5 text-left">Historical Avg</th>
                  <th className="p-3.5 text-left">Rating Reason / Notes</th>
                  <th className="p-3.5 text-center">Category</th>
                  <th className="p-3.5 text-center w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVendors.map((vendor) => {
                  const isSelected = selectedVendorIds.includes(vendor.id);
                  const isRated = vendor.rating !== null && vendor.rating !== undefined;

                  return (
                    <tr
                      key={vendor.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center border-r border-border">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelect(vendor.id, e.target.checked)}
                          className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-white cursor-pointer"
                        />
                      </td>

                      {/* Business & Vendor */}
                      <td className="p-3.5">
                        <span className="block font-bold text-text-primary">
                          {vendor.businessName || vendor.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-secondary">
                          {vendor.businessName && vendor.name && (
                            <span>{vendor.name} • </span>
                          )}
                          <span className="font-mono text-text-tertiary">{vendor.phone}</span>
                        </div>
                      </td>

                      {/* Marketing Power Rating Cell - Click to Rate */}
                      <td className="p-3.5">
                        <div
                          onClick={() => {
                            if (isAdmin) onRateVendor(vendor);
                          }}
                          className={`inline-flex items-center gap-2 p-1.5 rounded-lg border transition-all ${
                            isRated
                              ? 'bg-amber-50/60 border-amber-200/80 hover:bg-amber-100/60'
                              : 'bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100'
                          } ${isAdmin ? 'cursor-pointer' : ''}`}
                          title={isAdmin ? 'Click to change rating' : 'Vendor rating'}
                        >
                          <MarketingPowerStars
                            rating={vendor.rating}
                            size="sm"
                            showNumber={true}
                          />
                          {isAdmin && (
                            <span className="text-[10px] text-amber-700 font-semibold px-1 rounded bg-amber-200/50">
                              {isRated ? 'Edit' : '+ Rate'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Historical Cross-Edition Average */}
                      <td className="p-3.5">
                        {vendor.avgRating !== null && vendor.avgRating !== undefined ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              {vendor.avgRating}/10
                            </span>
                            {vendor.ratedEditionsCount ? (
                              <span className="text-[10px] text-text-tertiary">
                                ({vendor.ratedEditionsCount} {vendor.ratedEditionsCount === 1 ? 'ed' : 'eds'})
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-text-tertiary font-mono text-[11px]">
                            {isRated ? `${vendor.rating}/10` : '—'}
                          </span>
                        )}
                      </td>

                      {/* Notes / Reason */}
                      <td className="p-3.5 max-w-[240px]">
                        {vendor.ratingNote ? (
                          <div
                            onClick={() => {
                              if (isAdmin) onRateVendor(vendor);
                            }}
                            className="flex items-start gap-1.5 text-[11px] text-text-secondary bg-slate-50 border border-border-light rounded-md p-1.5 cursor-pointer hover:border-amber-300 hover:bg-amber-50/40 transition-colors"
                            title="Click to edit notes"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 italic font-medium text-text-primary">
                              "{vendor.ratingNote}"
                            </span>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              if (isAdmin) onRateVendor(vendor);
                            }}
                            className="text-text-tertiary italic text-[11px] hover:text-accent cursor-pointer"
                          >
                            + add reason
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3.5 text-center">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {(vendor as any).businessType || 'General'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onRateVendor(vendor)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md transition-colors cursor-pointer"
                            >
                              Rate
                            </button>
                          )}
                          {onRowClick && (
                            <button
                              type="button"
                              onClick={() => onRowClick(vendor)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-text-secondary border border-border rounded-md transition-colors cursor-pointer"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 5. Custom Export Callout Bar */}
      <div className="bg-gradient-to-r from-blue-50/80 via-white to-amber-50/60 border border-border rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">
              Export Filtered Ratings & Payment Records
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Choose between one-click templates (e.g. Business + Ratings, Payments only) or tick/untick individual fields with live preview.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenExport}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0 shadow-xs"
        >
          <Download className="w-4 h-4 mr-1.5" />
          <span>Open Export Panel</span>
        </Button>
      </div>
    </div>
  );
};
