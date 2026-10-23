import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastProvider';
import { Sparkles, X, MessageSquare } from 'lucide-react';
import { MarketingPowerStars } from './MarketingPowerStars';
import { isIsoDate, mondayOf, todayDateOnly } from '@/lib/ratingWeeks';

export interface VendorRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: {
    id: string;
    businessName: string;
    contactName?: string;
    rating?: number | null;
    ratingNote?: string | null;
    avgRating?: number | null;
  } | null;
  activeEdition: {
    id: string;
    name: string;
    date?: string;
  } | null;
  onRatingSaved: (vendorId: string, rating: number | null, note: string | null, avgRating?: number | null) => void;
}

export const VendorRatingModal: React.FC<VendorRatingModalProps> = ({
  isOpen,
  onClose,
  vendor,
  activeEdition,
  onRatingSaved,
}) => {
  const { addToast } = useToast();
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vendor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRating(vendor.rating !== undefined && vendor.rating !== null ? Number(vendor.rating) : null);
      setNote(vendor.ratingNote || '');
    }
  }, [vendor, isOpen]);

  if (!isOpen || !vendor || !activeEdition) return null;

  const displayRating = hoverRating !== null ? hoverRating : selectedRating;

  // Ratings taken from the vendor directory for an upcoming edition also count
  // as this week's weekly check-in, keeping all rating surfaces in sync.
  const today = todayDateOnly();
  const weeklyWeekStart =
    activeEdition?.date && isIsoDate(activeEdition.date) && activeEdition.date >= today
      ? mondayOf(today)
      : null;

  const handleSave = async () => {
    if (!vendor || !activeEdition) return;

    const previousRating = vendor.rating ?? null;
    const previousNote = vendor.ratingNote ?? null;

    // Optimistic update
    onRatingSaved(vendor.id, selectedRating, note || null, vendor.avgRating);
    onClose();

    setIsSubmitting(true);
    try {
      const res = await fetch(
        weeklyWeekStart ? '/api/vendors/ratings/weekly' : '/api/vendors/ratings',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorId: vendor.id,
            editionId: activeEdition.id,
            rating: selectedRating,
            note: note.trim() || null,
            ...(weeklyWeekStart ? { weekStart: weeklyWeekStart } : {}),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update rating');
      }

      // Reconcile with server result
      onRatingSaved(vendor.id, data.rating, data.note, data.avgRating);
      addToast(
        selectedRating === null
          ? `Cleared rating for ${vendor.businessName || 'vendor'}`
          : `Rated ${vendor.businessName || 'vendor'} ${selectedRating}/10 (${selectedRating / 2} stars)`,
        'success'
      );
    } catch (err: unknown) {
      // Rollback on failure
      onRatingSaved(vendor.id, previousRating, previousNote, vendor.avgRating);
      addToast(`Error saving rating: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Rate Marketing Power</h3>
            <p className="text-[11px] text-text-secondary">
              For <span className="font-semibold text-text-primary">{activeEdition.name}</span>
              {weeklyWeekStart ? ' · this week’s check-in' : ''}
            </p>
          </div>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-5 text-left select-none">
        {/* Vendor info header banner */}
        <div className="bg-slate-50 border border-border rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-text-primary">{vendor.businessName || 'Unnamed Business'}</div>
            {vendor.contactName && (
              <div className="text-[11px] text-text-secondary mt-0.5">{vendor.contactName}</div>
            )}
          </div>
          {vendor.avgRating !== null && vendor.avgRating !== undefined && (
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-bold block">Cross-Edition Avg</span>
              <span className="text-xs font-mono font-bold text-amber-700">{vendor.avgRating}/10</span>
            </div>
          )}
        </div>

        {/* Current rating visual preview */}
        <div className="text-center py-2 bg-gradient-to-b from-amber-50/50 to-transparent rounded-xl border border-amber-100/60 p-4">
          <div className="text-3xl font-extrabold font-mono text-amber-700 tracking-tight">
            {displayRating !== null ? `${displayRating}/10` : 'Unrated'}
          </div>
          <div className="text-xs font-medium text-text-secondary mt-1">
            {displayRating !== null ? `${displayRating / 2} out of 5 stars` : 'Click below to assign a rating'}
          </div>
          <div className="flex justify-center mt-2.5">
            <MarketingPowerStars rating={displayRating} size="lg" showNumber={false} />
          </div>
        </div>

        {/* 1 to 10 Quick Select Segmented Buttons */}
        <div>
          <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-2">
            10-Point Marketing Power Score
          </label>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = selectedRating === num;
              const isHovered = hoverRating === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelectedRating(num)}
                  onMouseEnter={() => setHoverRating(num)}
                  onMouseLeave={() => setHoverRating(null)}
                  className={`h-9 rounded-md font-mono text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105'
                      : isHovered
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-white hover:bg-slate-50 text-text-primary border-border'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-text-tertiary font-semibold px-0.5 mt-1.5">
            <span>1 (Minimal reach)</span>
            <span>5 (Average)</span>
            <span>10 (Massive crowd puller)</span>
          </div>
        </div>

        {/* Clear Rating Button */}
        {selectedRating !== null && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedRating(null)}
              className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear rating (mark as unrated)</span>
            </button>
          </div>
        )}

        {/* Optional Note Field */}
        <div>
          <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-text-secondary" />
            <span>Optional Reason / Notes</span>
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Huge Instagram following (50k+), brought large crowd, active promotions..."
            className="w-full bg-white border border-border rounded-lg p-2.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            maxLength={300}
          />
          <div className="text-[10px] text-text-tertiary text-right mt-0.5">
            {note.length}/300 characters
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? 'Saving...' : 'Save Rating'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
