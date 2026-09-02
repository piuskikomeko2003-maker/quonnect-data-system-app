'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  DollarSign,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Zap,
  Sparkles
} from 'lucide-react';

export interface VendorFeeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: {
    id: string; // registration id
    vendor_id: string;
    business_name: string;
    contact_name?: string;
    amount_paid: number;
    fee_source?: 'standard' | 'override' | string;
    payment_status: string;
  } | null;
  activeEdition: {
    id: string;
    name: string;
    standard_fee?: number;
  } | null;
  onFeeUpdated: () => void;
}

export const VendorFeeEditModal: React.FC<VendorFeeEditModalProps> = ({
  isOpen,
  onClose,
  vendor,
  activeEdition,
  onFeeUpdated,
}) => {
  const [editionStandardFee, setEditionStandardFee] = useState<number>(0);
  const [amountInput, setAmountInput] = useState<string>('0');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFeeSource, setCurrentFeeSource] = useState<'standard' | 'override'>('standard');

  useEffect(() => {
    if (!isOpen || !vendor) return;

    setError(null);
    setCurrentFeeSource((vendor.fee_source as 'standard' | 'override') || 'standard');
    setAmountInput(Number(vendor.amount_paid || 0).toLocaleString('en-US'));

    // Fetch active edition standard fee from DB if not passed directly
    const loadStandardFee = async () => {
      if (activeEdition?.standard_fee !== undefined) {
        setEditionStandardFee(activeEdition.standard_fee);
        return;
      }
      if (!activeEdition?.id) return;

      try {
        const supabase = createClient();
        if (!supabase) return;

        const { data } = await supabase
          .from('market_days')
          .select('standard_fee')
          .eq('id', activeEdition.id)
          .single();

        if (data) {
          setEditionStandardFee(Number(data.standard_fee) || 0);
        }
      } catch (e) {
        console.error('Error fetching edition fee:', e);
      }
    };

    loadStandardFee();
  }, [isOpen, vendor, activeEdition]);

  const handleInputChange = (val: string) => {
    const cleanNum = val.replace(/[^0-9]/g, '');
    const num = cleanNum ? parseInt(cleanNum, 10) : 0;
    setAmountInput(cleanNum ? num.toLocaleString('en-US') : '');
    // If the input changed away from standard fee, preview as override
    if (num !== editionStandardFee) {
      setCurrentFeeSource('override');
    } else {
      setCurrentFeeSource('standard');
    }
  };

  const handleResetToStandard = () => {
    setAmountInput(editionStandardFee.toLocaleString('en-US'));
    setCurrentFeeSource('standard');
  };

  const handleSave = async () => {
    if (!vendor) return;
    const cleanNum = parseInt(amountInput.replace(/[^0-9]/g, ''), 10) || 0;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Database client not available');

      // Determine fee_source: if equal to standard fee and user clicked reset, standard; otherwise override
      const determinedSource = cleanNum === editionStandardFee && currentFeeSource === 'standard' 
        ? 'standard' 
        : 'override';

      const { error: updateErr } = await supabase
        .from('vendor_registrations')
        .update({
          amount_paid: cleanNum,
          fee_source: determinedSource,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendor.id);

      if (updateErr) {
        // Fallback without fee_source
        const { error: fallbackErr } = await supabase
          .from('vendor_registrations')
          .update({
            amount_paid: cleanNum,
            updated_at: new Date().toISOString()
          })
          .eq('id', vendor.id);

        if (fallbackErr) throw fallbackErr;
      }

      onFeeUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating vendor fee:', err);
      setError(err.message || 'Failed to update fee');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !vendor) return null;

  const numericCurrentInput = parseInt(amountInput.replace(/[^0-9]/g, ''), 10) || 0;
  const isOverridden = currentFeeSource === 'override' || numericCurrentInput !== editionStandardFee;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Vendor Fee"
      maxWidth="md"
    >
      <div className="space-y-5 text-left text-xs">
        {/* Vendor Header Info */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Business Name</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-gray-300">
              {vendor.payment_status}
            </span>
          </div>
          <p className="text-base font-bold text-white">{vendor.business_name || 'Unnamed Vendor'}</p>
          {vendor.contact_name && (
            <p className="text-gray-400 text-[11px]">Contact: {vendor.contact_name}</p>
          )}
        </div>

        {/* Status indicator */}
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
          isOverridden 
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
        }`}>
          {isOverridden ? (
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-[11px] leading-relaxed">
            {isOverridden ? (
              <>
                <strong className="text-amber-300 font-bold block">Custom Override Rate</strong>
                This amount is customized and will be protected from global edition standard fee changes.
              </>
            ) : (
              <>
                <strong className="text-emerald-300 font-bold block">Standard Edition Rate</strong>
                This vendor follows the edition's default fee (UGX {editionStandardFee.toLocaleString()}).
              </>
            )}
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
              Amount Paid (UGX)
            </label>
            {isOverridden && (
              <button
                type="button"
                onClick={handleResetToStandard}
                className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Standard (UGX {editionStandardFee.toLocaleString()})
              </button>
            )}
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-xs font-bold text-emerald-400 select-none">
              UGX
            </span>
            <input
              type="text"
              value={amountInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="0"
              className="w-full pl-14 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>
          <p className="text-[10px] text-gray-500">
            Edition Standard Rate: UGX {editionStandardFee.toLocaleString()}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-500/30 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 px-5"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save Amount
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
