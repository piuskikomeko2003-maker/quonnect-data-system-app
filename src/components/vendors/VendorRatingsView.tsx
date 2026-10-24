import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Star,
  Search,
  Download,
  Sparkles,
  Info,
  MessageSquare,
  FileSpreadsheet,
  CalendarDays,
  Copy,
  Loader2,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastProvider';
import { BulkRatingModal } from './BulkRatingModal';
import { Vendor } from './VendorTable';
import {
  RatingWeek,
  buildRatingWeeks,
  defaultWeekStart,
  formatEventDate,
  previousWeekStart,
  todayDateOnly,
} from '@/lib/ratingWeeks';
import {
  RATING_TIERS,
  RatingFilterKey,
  UNRATED_TIER_STYLE,
  matchesRatingFilter,
  tierForAverage,
} from '@/lib/ratingTiers';

export interface VendorRatingsViewProps {
  vendors: Vendor[];
  activeEdition: { id: string; name: string; date?: string } | null;
  activeRegion: { id: string; name: string } | null;
  editions: Array<{ id: string; name: string; date?: string }>;
  regions: Array<{ id: string; name: string }>;
  isAdmin: boolean;
  onRateVendor: (vendor: Vendor) => void;
  onBulkRate: (selectedIds: string[]) => void;
  onOpenExport: () => void;
  onRowClick?: (vendor: Vendor) => void;
  /** Keeps the vendor directory's edition-average badge in sync while rating. */
  onEditionAverageChange?: (vendorId: string, avg: number | null, weeks: number) => void;
}

type WeeklyEntry = { rating: number; note: string | null };
type WeeklyRatingsMap = Record<string, Record<string, WeeklyEntry>>;

const subscribeToNothing = () => () => {};
const getServerToday = () => '';

function scoreTier(score: number | null | undefined) {
  if (score === null || score === undefined) return UNRATED_TIER_STYLE;
  return tierForAverage(score) || UNRATED_TIER_STYLE;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-[10px] text-text-tertiary font-mono">—</span>;
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-slate-500">
        <Minus className="w-3 h-3" /> 0
      </span>
    );
  }
  const isUp = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold ${
        isUp ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? '+' : ''}
      {delta}
    </span>
  );
}

interface InlineScorePickerProps {
  current: number | null;
  disabled?: boolean;
  saving?: boolean;
  onSelect: (score: number) => void;
  onClear: () => void;
}

const InlineScorePicker: React.FC<InlineScorePickerProps> = ({
  current,
  disabled,
  saving,
  onSelect,
  onClear,
}) => {
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex items-center gap-0.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const isSelected = current === num;
          return (
            <button
              key={num}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(num)}
              title={num === 0 ? 'Rate 0/10 (failed — did not market)' : `Rate ${num}/10`}
              className={`w-[21px] h-[24px] rounded text-[10px] font-mono font-bold border transition-all ${
                isSelected
                  ? num === 0
                    ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                    : 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : num === 0
                    ? 'bg-white text-rose-500 border-rose-200 hover:bg-rose-50 hover:border-rose-300'
                    : 'bg-white text-text-secondary border-border hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {num}
            </button>
          );
        })}
      </div>
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />}
      {!saving && current !== null && !disabled && (
        <button
          type="button"
          onClick={onClear}
          title="Clear this week's score"
          className="text-text-tertiary hover:text-rose-600 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

interface WeekTrendProps {
  weeks: RatingWeek[];
  entries: Record<string, WeeklyEntry> | undefined;
}

const WeekTrend: React.FC<WeekTrendProps> = ({ weeks, entries }) => {
  const visible = weeks.slice(-8);
  if (!entries) {
    return <span className="text-[10px] text-text-tertiary font-mono">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {visible.map((week) => {
        const entry = entries[week.weekStart];
        return (
          <span
            key={week.weekStart}
            title={`${week.label}: ${entry ? `${entry.rating}/10` : 'unrated'}`}
            className={`w-2 h-2 rounded-full ${
              entry ? scoreTier(entry.rating).dot : 'bg-slate-200'
            } ${week.isCurrent ? 'ring-2 ring-offset-1 ring-amber-300' : ''}`}
          />
        );
      })}
    </div>
  );
};

export const VendorRatingsView: React.FC<VendorRatingsViewProps> = ({
  vendors,
  activeEdition,
  activeRegion,
  editions,
  isAdmin,
  onOpenExport,
  onRowClick,
  onEditionAverageChange,
}) => {
  const { addToast } = useToast();

  // Deterministic server snapshot (empty) prevents SSR/client date mismatches.
  const today = useSyncExternalStore(subscribeToNothing, todayDateOnly, getServerToday);
  const [weeklyRatings, setWeeklyRatings] = useState<WeeklyRatingsMap>({});
  const [weeksWithData, setWeeksWithData] = useState<string[]>([]);
  const [requestedWeekStart, setRequestedWeekStart] = useState<string | null>(null);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [unmigrated, setUnmigrated] = useState(false);
  const [needsZeroMigration, setNeedsZeroMigration] = useState(false);
  const [savingVendors, setSavingVendors] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<RatingFilterKey>('all');
  const [sortBy, setSortBy] = useState<
    'name' | 'name_desc' | 'week_desc' | 'week_asc' | 'avg_desc' | 'change_desc'
  >('name');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const editionId = activeEdition?.id;

  const eventDate = useMemo(() => {
    if (activeEdition?.date) return activeEdition.date;
    return editions.find((edition) => edition.id === activeEdition?.id)?.date || '';
  }, [activeEdition?.id, activeEdition?.date, editions]);

  const weeks = useMemo<RatingWeek[]>(() => {
    if (!today || !eventDate) return [];
    return buildRatingWeeks(eventDate, today);
  }, [today, eventDate]);

  const loadWeeklyRatings = useCallback(async () => {
    if (!editionId) {
      setWeeklyRatings({});
      setWeeksWithData([]);
      return;
    }

    setLoadingRatings(true);
    try {
      const res = await fetch(
        `/api/vendors/ratings/weekly?editionId=${encodeURIComponent(editionId)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load weekly ratings');
      setWeeklyRatings(data.ratings || {});
      setWeeksWithData(data.weeksWithData || []);
      setUnmigrated(Boolean(data.unmigrated));
    } catch (err: unknown) {
      addToast(
        `Could not load weekly ratings: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    } finally {
      setLoadingRatings(false);
    }
  }, [editionId, addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWeeklyRatings();
  }, [loadWeeklyRatings]);

  // Derive the active week instead of syncing it with a second state update.
  const activeWeekStart = useMemo(() => {
    if (weeks.length === 0) return null;
    if (requestedWeekStart && weeks.some((week) => week.weekStart === requestedWeekStart)) {
      return requestedWeekStart;
    }
    return defaultWeekStart(weeks, weeksWithData);
  }, [weeks, weeksWithData, requestedWeekStart]);

  const selectedWeek = weeks.find((week) => week.weekStart === activeWeekStart) || null;
  const previousWeekKey = activeWeekStart ? previousWeekStart(activeWeekStart) : null;

  const getEntry = useCallback(
    (vendorId: string, weekStart: string | null = activeWeekStart): WeeklyEntry | null => {
      if (!weekStart) return null;
      return weeklyRatings[vendorId]?.[weekStart] || null;
    },
    [weeklyRatings, activeWeekStart]
  );

  const setLocalRating = useCallback(
    (vendorId: string, weekStart: string, rating: number | null, note: string | null) => {
      setWeeklyRatings((prev) => {
        const vendorWeeks = { ...(prev[vendorId] || {}) };
        if (rating === null) {
          delete vendorWeeks[weekStart];
        } else {
          vendorWeeks[weekStart] = { rating, note };
        }
        return { ...prev, [vendorId]: vendorWeeks };
      });
    },
    []
  );

  const markSaving = (vendorId: string, saving: boolean) => {
    setSavingVendors((prev) =>
      saving ? Array.from(new Set([...prev, vendorId])) : prev.filter((id) => id !== vendorId)
    );
  };

  const publishEditionAverage = useCallback(
    (vendorId: string, entries: Record<string, WeeklyEntry> | undefined) => {
      if (!onEditionAverageChange) return;
      const scores = Object.values(entries || {}).map((entry) => entry.rating);
      const avg = scores.length
        ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
        : null;
      onEditionAverageChange(vendorId, avg, scores.length);
    },
    [onEditionAverageChange]
  );

  const saveRating = async (vendorId: string, rating: number | null) => {
    if (!isAdmin || !activeEdition?.id || !activeWeekStart) return;

    const previousEntry = getEntry(vendorId);
    const note = previousEntry?.note ?? null;

    const nextEntries = { ...(weeklyRatings[vendorId] || {}) };
    if (rating === null) {
      delete nextEntries[activeWeekStart];
    } else {
      nextEntries[activeWeekStart] = { rating, note };
    }

    setLocalRating(vendorId, activeWeekStart, rating, note);
    publishEditionAverage(vendorId, nextEntries);
    markSaving(vendorId, true);

    try {
      const res = await fetch('/api/vendors/ratings/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          editionId: activeEdition.id,
          weekStart: activeWeekStart,
          rating,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.tableMissing) setUnmigrated(true);
        if (data?.needsZeroMigration) setNeedsZeroMigration(true);
        throw new Error(data?.error || 'Failed to save rating');
      }
      setUnmigrated(false);
      if (rating === 0) setNeedsZeroMigration(false);
      if (!weeksWithData.includes(activeWeekStart)) {
        setWeeksWithData((prev) => [...prev, activeWeekStart]);
      }
    } catch (err: unknown) {
      // Roll back only if the user has not already moved on.
      const current = getEntry(vendorId);
      if ((current?.rating ?? null) === rating) {
        setLocalRating(vendorId, activeWeekStart, previousEntry?.rating ?? null, previousEntry?.note ?? null);
        publishEditionAverage(vendorId, weeklyRatings[vendorId]);
      }
      addToast(`Could not save rating: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      markSaving(vendorId, false);
    }
  };

  const saveNote = async (vendorId: string) => {
    const entry = getEntry(vendorId);
    if (!entry || !activeEdition?.id || !activeWeekStart) return;

    const trimmed = noteDraft.trim().slice(0, 300);
    setLocalRating(vendorId, activeWeekStart, entry.rating, trimmed || null);
    setEditingNoteId(null);
    markSaving(vendorId, true);

    try {
      const res = await fetch('/api/vendors/ratings/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          editionId: activeEdition.id,
          weekStart: activeWeekStart,
          rating: entry.rating,
          note: trimmed || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save note');
      setUnmigrated(false);
    } catch (err: unknown) {
      addToast(`Could not save note: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      markSaving(vendorId, false);
    }
  };

  const copyLastWeek = async () => {
    if (!isAdmin || !activeEdition?.id || !activeWeekStart || !previousWeekKey) return;

    const entries = vendors
      .filter((vendor) => {
        const previous = getEntry(vendor.id, previousWeekKey);
        return previous && !getEntry(vendor.id);
      })
      .map((vendor) => ({ vendorId: vendor.id, ...getEntry(vendor.id, previousWeekKey)! }));

    if (entries.length === 0) {
      addToast('Nothing to copy — last week has no scores, or this week is already filled.', 'info');
      return;
    }

    entries.forEach((entry) => {
      setLocalRating(entry.vendorId, activeWeekStart, entry.rating, entry.note);
    });

    try {
      const res = await fetch('/api/vendors/ratings/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editionId: activeEdition.id,
          weekStart: activeWeekStart,
          entries,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to copy last week');
      setUnmigrated(false);
      addToast(`Copied last week's scores for ${entries.length} vendors.`, 'success');
    } catch (err: unknown) {
      addToast(`Could not copy last week: ${err instanceof Error ? err.message : String(err)}`, 'error');
      loadWeeklyRatings();
    }
  };

  // ---- Derived metrics -----------------------------------------------------
  const totalVendors = vendors.length;

  const countRatedForWeek = useCallback(
    (weekStart: string | null) => {
      if (!weekStart) return 0;
      return vendors.filter((vendor) => Boolean(weeklyRatings[vendor.id]?.[weekStart])).length;
    },
    [vendors, weeklyRatings]
  );

  const ratedThisWeek = countRatedForWeek(activeWeekStart);
  const prevRated = countRatedForWeek(previousWeekKey);

  const averageForWeek = useCallback(
    (weekStart: string | null) => {
      if (!weekStart) return null;
      const scores = vendors
        .map((vendor) => weeklyRatings[vendor.id]?.[weekStart]?.rating)
        .filter((score): score is number => typeof score === 'number');
      if (scores.length === 0) return null;
      return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
    },
    [vendors, weeklyRatings]
  );

  const avgThisWeek = averageForWeek(activeWeekStart);
  const avgLastWeek = averageForWeek(previousWeekKey);
  const avgDelta =
    avgThisWeek !== null && avgLastWeek !== null
      ? Math.round((avgThisWeek - avgLastWeek) * 10) / 10
      : null;

  const editionOverallAverage = useMemo(() => {
    const scores: number[] = [];
    Object.values(weeklyRatings).forEach((entryMap) => {
      Object.values(entryMap).forEach((entry) => scores.push(entry.rating));
    });
    if (scores.length === 0) return null;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  }, [weeklyRatings]);

  const weekIndex = selectedWeek ? weeks.findIndex((week) => week.weekStart === selectedWeek.weekStart) + 1 : 0;
  const progressPct = totalVendors > 0 ? Math.round((ratedThisWeek / totalVendors) * 100) : 0;
  const daysLeft = selectedWeek?.daysUntilEvent ?? null;

  const getVendorDelta = useCallback(
    (vendorId: string) => {
      const current = getEntry(vendorId);
      const previous = previousWeekKey ? getEntry(vendorId, previousWeekKey) : null;
      if (!current || !previous) return null;
      return current.rating - previous.rating;
    },
    [getEntry, previousWeekKey]
  );

  /**
   * Automatic edition average for one vendor: the mean of every weekly score
   * recorded for this vendor within the selected edition.
   */
  const getEditionAverage = useCallback(
    (vendorId: string): { avg: number | null; weeks: number } => {
      const entries = weeklyRatings[vendorId];
      if (!entries) return { avg: null, weeks: 0 };
      const scores = Object.values(entries).map((entry) => entry.rating);
      if (scores.length === 0) return { avg: null, weeks: 0 };
      const avg = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
      return { avg, weeks: scores.length };
    },
    [weeklyRatings]
  );

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: vendors.length,
      unrated: 0,
      ...Object.fromEntries(RATING_TIERS.map((tier) => [tier.key, 0])),
    };

    vendors.forEach((vendor) => {
      const average = getEditionAverage(vendor.id).avg;
      if (average === null) {
        counts.unrated += 1;
        return;
      }
      const tier = tierForAverage(average);
      if (tier) counts[tier.key] += 1;
    });

    return counts;
  }, [vendors, getEditionAverage]);

  const filteredVendors = useMemo(() => {
    return vendors
      .filter((vendor) => {
        if (searchTerm) {
          const query = searchTerm.toLowerCase();
          const matches =
            (vendor.businessName && vendor.businessName.toLowerCase().includes(query)) ||
            (vendor.name && vendor.name.toLowerCase().includes(query)) ||
            (vendor.phone && vendor.phone.includes(query)) ||
            (getEntry(vendor.id)?.note || '').toLowerCase().includes(query);
          if (!matches) return false;
        }

        const editionAverage = getEditionAverage(vendor.id).avg;

        // Tier filters use the automatic edition average, so a vendor is
        // classified by all their weekly scores for this edition.
        return matchesRatingFilter(editionAverage, filter);
      })
      .sort((a, b) => {
        if (sortBy === 'week_desc' || sortBy === 'week_asc') {
          const aScore = getEntry(a.id)?.rating ?? -1;
          const bScore = getEntry(b.id)?.rating ?? -1;
          return sortBy === 'week_desc' ? bScore - aScore : aScore - bScore;
        }
        if (sortBy === 'avg_desc') {
          const aAvg = getEditionAverage(a.id).avg ?? -1;
          const bAvg = getEditionAverage(b.id).avg ?? -1;
          return bAvg - aAvg;
        }
        if (sortBy === 'change_desc') {
          const aDelta = getVendorDelta(a.id) ?? -99;
          const bDelta = getVendorDelta(b.id) ?? -99;
          return bDelta - aDelta;
        }
        const comparison = (a.businessName || a.name || '').localeCompare(b.businessName || b.name || '');
        return sortBy === 'name_desc' ? -comparison : comparison;
      });
  }, [vendors, searchTerm, filter, sortBy, getEntry, getVendorDelta, getEditionAverage]);

  const isAllSelected =
    filteredVendors.length > 0 && filteredVendors.every((vendor) => selectedVendorIds.includes(vendor.id));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedVendorIds(checked ? filteredVendors.map((vendor) => vendor.id) : []);
  };

  const toggleSelect = (vendorId: string, checked: boolean) => {
    setSelectedVendorIds((prev) =>
      checked ? Array.from(new Set([...prev, vendorId])) : prev.filter((id) => id !== vendorId)
    );
  };

  // ---- Render --------------------------------------------------------------
  const noEdition = !activeEdition?.id;
  const noEventDate = Boolean(activeEdition) && !eventDate;

  return (
    <div className="space-y-6 animate-fade-in text-left select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-text-primary">
                Weekly Marketing Power Ratings
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Rate vendors once a week until event day — one tap, auto-saved.
                {activeRegion ? (
                  <>
                    {' '}Region: <strong className="text-text-primary">{activeRegion.name}</strong>.
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {selectedVendorIds.length > 0 && isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsBulkOpen(true)}
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
            <span>CSV Export</span>
          </Button>
        </div>
      </div>

      {(noEdition || noEventDate) && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 flex items-start gap-3 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Select an edition with an event date</div>
            <div className="mt-0.5 text-blue-800">
              Weekly ratings follow the event date. Pick a market edition (for example
              &ldquo;Kampala November 2026&rdquo;) from the edition switcher to see its weekly rating windows.
            </div>
          </div>
        </div>
      )}

      {unmigrated && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex items-start gap-3 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Weekly ratings table not set up yet</div>
            <div className="mt-0.5">
              Run <code className="font-mono bg-amber-100 px-1 rounded">supabase/migrations/add_vendor_weekly_ratings.sql</code>{' '}
              in the Supabase SQL editor. Existing per-edition ratings are untouched.
            </div>
          </div>
        </div>
      )}

      {needsZeroMigration && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-4 flex items-start gap-3 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">One more database step is needed to use 0 (Failed)</div>
            <div className="mt-0.5">
              Run <code className="font-mono bg-rose-100 px-1 rounded">supabase/migrations/allow_zero_vendor_ratings.sql</code>{' '}
              in the Supabase SQL editor. Until then, the database only accepts scores 1–10.
            </div>
          </div>
        </div>
      )}

      {/* Rating window / week selector */}
      {weeks.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                Rating window
              </div>
              <div className="text-lg font-bold text-text-primary mt-0.5">
                {activeEdition?.name}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary mt-1">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                  Event: <strong className="text-text-primary">{formatEventDate(eventDate)}</strong>
                </span>
                <span className="text-text-tertiary">•</span>
                <span>
                  {daysLeft !== null && daysLeft > 0 && (
                    <span className="font-semibold text-amber-700">{daysLeft} days left</span>
                  )}
                  {daysLeft === 0 && <span className="font-semibold text-emerald-700">Event is today</span>}
                  {daysLeft !== null && daysLeft < 0 && (
                    <span className="font-semibold text-slate-500">Event passed {Math.abs(daysLeft)} days ago</span>
                  )}
                </span>
                {weekIndex > 0 && (
                  <>
                    <span className="text-text-tertiary">•</span>
                    <span>
                      Week <strong className="text-text-primary">{weekIndex}</strong> of {weeks.length}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 min-w-0">
              <div className="bg-slate-50 border border-border rounded-lg px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                  Rated this week
                </div>
                <div className="text-lg font-extrabold font-mono text-text-primary leading-tight">
                  {ratedThisWeek}
                  <span className="text-xs font-medium text-text-tertiary">/{totalVendors}</span>
                </div>
              </div>
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700">
                  Week avg
                </div>
                <div className="text-lg font-extrabold font-mono text-amber-700 leading-tight">
                  {avgThisWeek !== null ? `${avgThisWeek}` : '—'}
                  {avgThisWeek !== null && <span className="text-xs font-medium text-amber-600">/10</span>}
                </div>
              </div>
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-blue-700">
                  Edition avg
                </div>
                <div className="text-lg font-extrabold font-mono text-blue-700 leading-tight">
                  {editionOverallAverage !== null ? `${editionOverallAverage}` : '—'}
                  {editionOverallAverage !== null && <span className="text-xs font-medium text-blue-600">/10</span>}
                </div>
              </div>
              <div className="bg-white border border-border rounded-lg px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
                  vs last week
                </div>
                <div className="text-lg font-extrabold font-mono leading-tight flex items-center">
                  {avgDelta === null ? (
                    <span className="text-text-tertiary">—</span>
                  ) : (
                    <span className={avgDelta > 0 ? 'text-emerald-600' : avgDelta < 0 ? 'text-rose-600' : 'text-slate-500'}>
                      {avgDelta > 0 ? '+' : ''}
                      {avgDelta}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Week pills */}
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {weeks.map((week, index) => {
              const isSelected = week.weekStart === activeWeekStart;
              const rated = countRatedForWeek(week.weekStart);
              const weekPct = totalVendors > 0 ? Math.round((rated / totalVendors) * 100) : 0;
              return (
                <button
                  key={week.weekStart}
                  type="button"
                  onClick={() => setRequestedWeekStart(week.weekStart)}
                  className={`min-w-[148px] shrink-0 rounded-lg border px-3 py-2 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50 shadow-sm ring-1 ring-amber-300'
                      : 'border-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isSelected ? 'text-amber-700' : 'text-text-tertiary'
                    }`}>
                      Week {index + 1}
                    </span>
                    {week.badge === 'this-week' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900">
                        THIS WEEK
                      </span>
                    )}
                    {week.badge === 'event-week' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        EVENT
                      </span>
                    )}
                  </div>
                  <div className={`text-[11px] font-semibold mt-0.5 ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {week.label}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${weekPct === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${weekPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-text-tertiary">
                      {rated}/{totalVendors}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Overall progress + copy action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="flex items-center gap-2 text-[11px] text-text-secondary">
              <ClipboardCheck className={`w-4 h-4 ${progressPct === 100 ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span>
                <strong className="text-text-primary">{progressPct}%</strong> of vendors rated for{' '}
                <strong className="text-text-primary">{selectedWeek?.label || 'this week'}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={copyLastWeek}
              disabled={!isAdmin || prevRated === 0}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-colors ${
                !isAdmin || prevRated === 0
                  ? 'border-border text-text-tertiary bg-slate-50 cursor-not-allowed'
                  : 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer'
              }`}
              title={
                prevRated === 0
                  ? 'No scores from last week to copy yet'
                  : 'Copy last week’s scores into vendors not yet rated this week'
              }
            >
              <Copy className="w-3.5 h-3.5" />
              Copy last week
              {prevRated > 0 && <span className="font-mono">({prevRated})</span>}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 space-y-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search by business, contact, phone or note..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-slate-50 border border-border rounded-lg pl-10 pr-3.5 py-2 text-text-primary text-xs outline-none focus:bg-white focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-text-secondary">Sort by:</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              className="bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:border-accent outline-none cursor-pointer"
            >
              <option value="name">Business name (A–Z) · stable</option>
              <option value="name_desc">Business name (Z–A)</option>
              <option value="avg_desc">Highest edition average</option>
              <option value="week_desc">Highest this week</option>
              <option value="week_asc">Lowest / unrated first</option>
              <option value="change_desc">Biggest improvement</option>
            </select>
            <span className="hidden lg:inline text-[10px] text-text-tertiary whitespace-nowrap">
              Rows stay in place while you rate
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-border/60 pt-3 text-xs">
          <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mr-1">
            Filter by edition avg:
          </span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-text-primary text-white font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-text-secondary'
            }`}
          >
            All ({tierCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unrated')}
            className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap border ${
              filter === 'unrated'
                ? 'bg-text-primary text-white border-text-primary font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
            }`}
          >
            Unrated ({tierCounts.unrated})
          </button>
          {RATING_TIERS.map((tier) => (
            <button
              key={tier.key}
              type="button"
              onClick={() => setFilter(tier.key)}
              title={`${tier.range} · ${tier.description}`}
              className={`px-3 py-1 rounded-full font-semibold transition-colors cursor-pointer whitespace-nowrap border ${
                filter === tier.key
                  ? 'bg-text-primary text-white border-text-primary font-bold'
                  : `${tier.badge} hover:opacity-80`
              }`}
            >
              {tier.shortLabel} ({tierCounts[tier.key]})
            </button>
          ))}
        </div>
      </div>

      {/* Rating table */}
      <div className="w-full bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="w-full overflow-x-auto">
          {loadingRatings && vendors.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs text-text-secondary">Loading weekly ratings...</p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-16 px-6 flex flex-col items-center justify-center gap-2">
              <Info className="w-8 h-8 text-text-tertiary" />
              {vendors.length === 0 ? (
                <>
                  <p className="text-sm font-bold text-text-primary">
                    No vendors registered for {activeEdition?.name || 'this edition'}
                  </p>
                  <p className="text-xs text-text-secondary max-w-md">
                    Weekly ratings only show vendors with a paid registration or survey response for the selected
                    event. Check the <strong className="text-text-primary">region</strong> and{' '}
                    <strong className="text-text-primary">event</strong> selected in the top bar
                    {activeRegion ? <> (currently <strong className="text-text-primary">{activeRegion.name}</strong>)</> : null}
                    . For the November Kampala market day, choose <strong className="text-text-primary">Kampala → Kampala November 2026</strong>.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-text-primary">No vendors match this filter</p>
                  <p className="text-xs text-text-secondary">
                    Try a different filter or clear your search.
                  </p>
                </>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse min-w-[1120px] text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-border text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="p-3.5 w-[46px] text-center border-r border-border">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                      className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-white cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5 text-left">Business &amp; vendor</th>
                  <th className="p-3.5 text-left">
                    This week&apos;s score
                    <div className="text-[9px] font-medium normal-case text-text-tertiary mt-0.5">
                      {selectedWeek?.label || 'Select a week'} · tap 0–10
                    </div>
                  </th>
                  <th className="p-3.5 text-left">Last week</th>
                  <th className="p-3.5 text-left">
                    Edition avg
                    <div className="text-[9px] font-medium normal-case text-text-tertiary mt-0.5">
                      all weekly scores
                    </div>
                  </th>
                  <th className="p-3.5 text-left">Trend</th>
                  <th className="p-3.5 text-left">Note</th>
                  <th className="p-3.5 text-center w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVendors.map((vendor) => {
                  const entry = getEntry(vendor.id);
                  const previous = previousWeekKey ? getEntry(vendor.id, previousWeekKey) : null;
                  const delta = getVendorDelta(vendor.id);
                  const isSelected = selectedVendorIds.includes(vendor.id);
                  const saving = savingVendors.includes(vendor.id);
                  const vendorWeeks = weeklyRatings[vendor.id];
                  const weeksRated = vendorWeeks ? Object.keys(vendorWeeks).length : 0;
                  const editionAvg = getEditionAverage(vendor.id);
                  const editionTier = tierForAverage(editionAvg.avg);
                  const isEditingNote = editingNoteId === vendor.id;

                  return (
                    <tr
                      key={vendor.id}
                      className={`transition-colors ${isSelected ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'}`}
                    >
                      <td className="p-3.5 text-center border-r border-border align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => toggleSelect(vendor.id, event.target.checked)}
                          className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-white cursor-pointer"
                        />
                      </td>

                      <td className="p-3.5 align-top">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${entry ? scoreTier(entry.rating).dot : 'bg-slate-200'}`} />
                          <div>
                            <span className="block font-bold text-text-primary">
                              {vendor.businessName || vendor.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-secondary">
                              {vendor.businessName && vendor.name && <span>{vendor.name} •</span>}
                              <span className="font-mono text-text-tertiary">{vendor.phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 align-top">
                        <InlineScorePicker
                          current={entry?.rating ?? null}
                          disabled={!isAdmin || !activeWeekStart || saving}
                          saving={saving}
                          onSelect={(score) => saveRating(vendor.id, score)}
                          onClear={() => saveRating(vendor.id, null)}
                        />
                      </td>

                      <td className="p-3.5 align-top">
                        <div className="flex items-center gap-2">
                          {previous ? (
                            <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border ${scoreTier(previous.rating).soft} ${scoreTier(previous.rating).text}`}>
                              {previous.rating}/10
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-tertiary font-mono">—</span>
                          )}
                          <DeltaBadge delta={delta} />
                        </div>
                      </td>

                      <td className="p-3.5 align-top">
                        {editionAvg.avg !== null ? (
                          <div className="flex flex-col gap-1">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border ${scoreTier(editionAvg.avg).soft} ${scoreTier(editionAvg.avg).text}`}>
                                {editionAvg.avg}/10
                              </span>
                              <span className="text-[10px] text-text-tertiary font-mono whitespace-nowrap">
                                {editionAvg.weeks} wk{editionAvg.weeks === 1 ? '' : 's'}
                              </span>
                            </div>
                            {editionTier && (
                              <span className={`inline-flex w-fit items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${editionTier.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${editionTier.dot}`} />
                                {editionTier.shortLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-tertiary font-mono">—</span>
                        )}
                      </td>

                      <td className="p-3.5 align-top">
                        <div className="flex items-center gap-2">
                          <WeekTrend weeks={weeks} entries={vendorWeeks} />
                          <span className="text-[10px] text-text-tertiary font-mono whitespace-nowrap">
                            {weeksRated > 0 ? `${weeksRated} wk${weeksRated === 1 ? '' : 's'}` : ''}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 align-top max-w-[220px]">
                        {isEditingNote ? (
                          <div className="space-y-1.5">
                            <textarea
                              autoFocus
                              rows={2}
                              value={noteDraft}
                              onChange={(event) => setNoteDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                  event.preventDefault();
                                  saveNote(vendor.id);
                                }
                                if (event.key === 'Escape') setEditingNoteId(null);
                              }}
                              placeholder="Why this score?"
                              maxLength={300}
                              className="w-full bg-white border border-amber-300 rounded-md p-1.5 text-[11px] text-text-primary focus:border-accent outline-none"
                            />
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingNoteId(null)}
                                className="px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveNote(vendor.id)}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                            </div>
                          </div>
                        ) : entry?.note ? (
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => {
                              setEditingNoteId(vendor.id);
                              setNoteDraft(entry.note || '');
                            }}
                            className="flex items-start gap-1.5 text-left text-[11px] text-text-secondary bg-slate-50 border border-border-light rounded-md p-1.5 hover:border-amber-300 hover:bg-amber-50/40 transition-colors cursor-pointer w-full"
                            title="Click to edit note"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 italic font-medium text-text-primary">
                              &ldquo;{entry.note}&rdquo;
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!isAdmin || !entry}
                            onClick={() => {
                              setEditingNoteId(vendor.id);
                              setNoteDraft('');
                            }}
                            className={`text-[11px] italic ${
                              entry ? 'text-text-tertiary hover:text-accent cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                            }`}
                            title={entry ? 'Add a note' : 'Rate this vendor first'}
                          >
                            + add note
                          </button>
                        )}
                      </td>

                      <td className="p-3.5 align-top text-center">
                        <button
                          type="button"
                          onClick={() => onRowClick?.(vendor)}
                          className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-text-secondary border border-border rounded-md transition-colors cursor-pointer"
                        >
                          View
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Legend / export callout */}
      <div className="bg-gradient-to-r from-blue-50/80 via-white to-amber-50/60 border border-border rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Weekly scores roll up automatically</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              The latest weekly score also updates the vendor&apos;s current edition rating, so Vendors, exports and
              the detail panel stay in sync. Export includes the latest score and notes.
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

      {/* Bulk rating for the selected week */}
      <BulkRatingModal
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        selectedVendorIds={selectedVendorIds}
        activeEdition={activeEdition}
        weekStart={activeWeekStart || undefined}
        weekLabel={selectedWeek?.label}
        onBulkRatingComplete={(vendorIds, rating, note) => {
          if (!activeWeekStart) return;
          vendorIds.forEach((vendorId) => {
            setLocalRating(vendorId, activeWeekStart, rating, note);
            const nextEntries = { ...(weeklyRatings[vendorId] || {}) };
            if (rating === null) {
              delete nextEntries[activeWeekStart];
            } else {
              nextEntries[activeWeekStart] = { rating, note };
            }
            publishEditionAverage(vendorId, nextEntries);
          });
          setSelectedVendorIds([]);
        }}
      />
    </div>
  );
};
