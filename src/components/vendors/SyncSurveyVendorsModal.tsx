'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

const DEFAULT_FEE = 92000;
const INSERT_CHUNK_SIZE = 200;

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err ?? '');

export interface SyncSurveyVendorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEdition: { id: string; name: string } | null;
  onSynced: () => void;
}

interface PreviewState {
  surveyVendorCount: number;
  alreadyPaidCount: number;
  toInsertIds: string[];
  toUpdateRegIds: string[];
  inferredFee: number;
}

const EMPTY_PREVIEW: PreviewState = {
  surveyVendorCount: 0,
  alreadyPaidCount: 0,
  toInsertIds: [],
  toUpdateRegIds: [],
  inferredFee: DEFAULT_FEE,
};

export const SyncSurveyVendorsModal: React.FC<SyncSurveyVendorsModalProps> = ({
  isOpen,
  onClose,
  activeEdition,
  onSynced,
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);
  const [feeInput, setFeeInput] = useState<string>(DEFAULT_FEE.toLocaleString('en-US'));

  const loadPreview = useCallback(async () => {
    if (!activeEdition?.id) {
      setPreview(EMPTY_PREVIEW);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Database client not available');

      const [srRes, regRes] = await Promise.all([
        supabase
          .from('survey_responses')
          .select('vendor_id')
          .eq('context_id', activeEdition.id),
        supabase
          .from('vendor_registrations')
          .select('id, vendor_id, payment_status, amount_paid')
          .eq('market_day_id', activeEdition.id),
      ]);

      if (srRes.error) throw srRes.error;
      if (regRes.error) throw regRes.error;

      const surveyVendorIds = Array.from(
        new Set((srRes.data || []).map(r => r.vendor_id).filter(Boolean))
      ) as string[];

      const regByVendor = new Map<string, { id: string; payment_status: string }>();
      (regRes.data || []).forEach(r => {
        if (r.vendor_id) {
          regByVendor.set(r.vendor_id, { id: r.id, payment_status: r.payment_status });
        }
      });

      const toInsertIds: string[] = [];
      const toUpdateRegIds: string[] = [];
      let alreadyPaidCount = 0;

      surveyVendorIds.forEach(vendorId => {
        const reg = regByVendor.get(vendorId);
        if (!reg) {
          toInsertIds.push(vendorId);
        } else if (reg.payment_status === 'paid') {
          alreadyPaidCount++;
        } else {
          toUpdateRegIds.push(reg.id);
        }
      });

      // Infer a sensible default fee: the most common amount already paid in
      // this edition, falling back to the platform default.
      const feeCounts = new Map<number, number>();
      (regRes.data || [])
        .filter(r => r.payment_status === 'paid' && Number(r.amount_paid) > 0)
        .forEach(r => {
          const amount = Number(r.amount_paid);
          feeCounts.set(amount, (feeCounts.get(amount) || 0) + 1);
        });
      let inferredFee = DEFAULT_FEE;
      let bestCount = 0;
      feeCounts.forEach((count, amount) => {
        if (count > bestCount) {
          bestCount = count;
          inferredFee = amount;
        }
      });

      setPreview({
        surveyVendorCount: surveyVendorIds.length,
        alreadyPaidCount,
        toInsertIds,
        toUpdateRegIds,
        inferredFee,
      });
      setFeeInput(inferredFee.toLocaleString('en-US'));
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to load sync preview');
    } finally {
      setLoading(false);
    }
  }, [activeEdition]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => loadPreview(), 0);
    return () => clearTimeout(timer);
  }, [isOpen, loadPreview]);

  const parsedFee = parseInt(feeInput.replace(/[^0-9]/g, ''), 10) || 0;
  const pendingNew = preview.toInsertIds.length;
  const pendingUpdate = preview.toUpdateRegIds.length;
  const totalToSync = pendingNew + pendingUpdate;
  const addedRevenue = totalToSync * parsedFee;

  const handleFeeChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setFeeInput(clean ? Number(clean).toLocaleString('en-US') : '');
  };

  const handleSync = async () => {
    if (!activeEdition?.id) return;
    if (totalToSync === 0) {
      addToast('No survey vendors to sync for this edition', 'info');
      onClose();
      return;
    }
    if (parsedFee <= 0) {
      setError('Enter a fee greater than zero.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Database client not available');

      let inserted = 0;
      let updated = 0;

      // 1. Create paid registrations for surveyed vendors that have none.
      const rows = preview.toInsertIds.map(vendorId => ({
        vendor_id: vendorId,
        market_day_id: activeEdition.id,
        payment_status: 'paid',
        amount_paid: parsedFee,
      }));

      for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
        const { error: insertErr } = await supabase
          .from('vendor_registrations')
          .insert(chunk);
        if (insertErr) throw insertErr;
        inserted += chunk.length;
      }

      // 2. Promote any existing non-paid registrations to paid.
      if (preview.toUpdateRegIds.length > 0) {
        const { error: updateErr } = await supabase
          .from('vendor_registrations')
          .update({ payment_status: 'paid', amount_paid: parsedFee })
          .in('id', preview.toUpdateRegIds);
        if (updateErr) throw updateErr;
        updated = preview.toUpdateRegIds.length;
      }

      const total = inserted + updated;
      addToast(
        `Synced ${total} survey vendor${total === 1 ? '' : 's'} to paid`,
        'success'
      );
      onSynced();
      onClose();
    } catch (err: unknown) {
      const message = getErrorMessage(err) || 'Sync failed';
      setError(message);
      addToast(`Sync failed: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sync Survey Vendors to Paid" maxWidth="md">
      {!activeEdition ? (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Select an edition first.
        </div>
      ) : loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-3" />
          <p className="text-xs text-text-secondary font-medium">Analyzing survey vendors...</p>
        </div>
      ) : (
        <div className="space-y-5 text-left text-xs">
          <div className="bg-slate-50 border border-border rounded-xl p-4 space-y-1">
            <span className="text-text-tertiary text-[11px] font-semibold uppercase tracking-wider">Edition</span>
            <p className="text-base font-bold text-text-primary">{activeEdition.name}</p>
            <p className="text-text-secondary text-[11px]">
              Vendors you surveyed are treated as paid vendors. This creates a paid registration
              for each one that does not already have one.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-text-tertiary mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Surveyed</span>
              </div>
              <p className="text-xl font-bold text-text-primary">{preview.surveyVendorCount}</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Already Paid</span>
              </div>
              <p className="text-xl font-bold text-text-primary">{preview.alreadyPaidCount}</p>
            </div>
            <div className="bg-white border border-accent/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-accent mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">To Sync</span>
              </div>
              <p className="text-xl font-bold text-accent">{totalToSync}</p>
            </div>
          </div>

          {totalToSync > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-emerald-900">
              <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-relaxed">
                {pendingNew} new paid registration{pendingNew === 1 ? '' : 's'}
                {pendingUpdate > 0 && ` + ${pendingUpdate} promoted from another status`}.
                At the fee below this adds <strong>UGX {addedRevenue.toLocaleString()}</strong> to recorded revenue.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Fee per vendor (UGX)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs font-bold text-accent select-none">UGX</span>
              <input
                type="text"
                value={feeInput}
                onChange={e => handleFeeChange(e.target.value)}
                placeholder="0"
                className="w-full pl-14 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm font-mono text-text-primary font-bold focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
            <p className="text-[10px] text-text-tertiary">
              Defaulted to the most common amount already paid in this edition
              (UGX {preview.inferredFee.toLocaleString()}). Change it if needed.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSync}
              disabled={saving || totalToSync === 0 || parsedFee <= 0}
              className="gap-1.5 px-5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync {totalToSync > 0 ? totalToSync : ''} Vendor{totalToSync === 1 ? '' : 's'}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
