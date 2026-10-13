import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastProvider';
import { Sparkles, MessageSquare, X } from 'lucide-react';
import { MarketingPowerStars } from './MarketingPowerStars';

export interface BulkRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVendorIds: string[];
  activeEdition: {
    id: string;
    name: string;
  } | null;
  onBulkRatingComplete: (vendorIds: string[], rating: number | null, note: string | null) => void;
}

export const BulkRatingModal: React.FC<BulkRatingModalProps> = ({
  isOpen,
  onClose,
  selectedVendorIds,
  activeEdition,
  onBulkRatingComplete,
}) => {
  const { addToast } = useToast();
  const [selectedRating, setSelectedRating] = useState<number | null>(7);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || selectedVendorIds.length === 0 || !activeEdition) return null;

  const handleBulkSave = async () => {
    if (!activeEdition) return;

    // Optimistic update
    onBulkRatingComplete(selectedVendorIds, selectedRating, note || null);
    onClose();

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/vendors/ratings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorIds: selectedVendorIds,
          editionId: activeEdition.id,
          rating: selectedRating,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to bulk rate vendors');
      }

      addToast(
        selectedRating === null
          ? `Cleared ratings for ${selectedVendorIds.length} vendors`
          : `Updated rating to ${selectedRating}/10 for ${selectedVendorIds.length} vendors`,
        'success'
      );
    } catch (err: any) {
      addToast(`Error updating ratings: ${err.message}`, 'error');
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
            <h3 className="text-sm font-bold text-text-primary">Bulk Rate Vendors</h3>
            <p className="text-[11px] text-text-secondary">
              Setting rating for <span className="font-semibold text-text-primary">{selectedVendorIds.length} selected vendors</span> in {activeEdition.name}
            </p>
          </div>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-5 text-left select-none">
        {/* Selected vendor badge notice */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center justify-between">
          <span>This will apply to all <strong>{selectedVendorIds.length}</strong> checked vendors.</span>
          <span className="font-mono font-bold text-[11px] bg-amber-200/60 px-2 py-0.5 rounded text-amber-950">
            {selectedVendorIds.length} vendors
          </span>
        </div>

        {/* Current rating visual preview */}
        <div className="text-center py-2 bg-gradient-to-b from-amber-50/50 to-transparent rounded-xl border border-amber-100/60 p-4">
          <div className="text-3xl font-extrabold font-mono text-amber-700 tracking-tight">
            {selectedRating !== null ? `${selectedRating}/10` : 'Unrated'}
          </div>
          <div className="text-xs font-medium text-text-secondary mt-1">
            {selectedRating !== null ? `${selectedRating / 2} out of 5 stars` : 'Mark all selected as unrated'}
          </div>
          <div className="flex justify-center mt-2.5">
            <MarketingPowerStars rating={selectedRating} size="lg" showNumber={false} />
          </div>
        </div>

        {/* 1 to 10 Quick Select Segmented Buttons */}
        <div>
          <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-2">
            Assign Rating to All Selected
          </label>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = selectedRating === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelectedRating(num)}
                  className={`h-9 rounded-md font-mono text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105'
                      : 'bg-white hover:bg-slate-50 text-text-primary border-border'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clear Option */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSelectedRating(null)}
            className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear ratings (set as unrated)</span>
          </button>
        </div>

        {/* Optional Note Field */}
        <div>
          <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-text-secondary" />
            <span>Optional Note (applied to all selected)</span>
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Bulk scored after Edition market day evaluation..."
            className="w-full bg-white border border-border rounded-lg p-2.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            maxLength={300}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleBulkSave}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? 'Applying...' : `Apply to ${selectedVendorIds.length} Vendors`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
