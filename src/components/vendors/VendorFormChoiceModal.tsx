'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  X,
  CreditCard,
  ClipboardList,
  CheckCircle2,
  Clock,
  CircleDashed,
  ChevronRight,
  Loader2,
  Building2,
  Phone,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChoiceVendor {
  id: string;
  vendor_id?: string;
  payment_status?: string;
  amount_paid?: number;
  business_name?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  category?: string;
  created_at?: string;
  // allow extra props from different shapes
  [key: string]: any;
}

type CompletionStatus = 'not_started' | 'in_progress' | 'complete';

interface StatusInfo {
  paidDetails: CompletionStatus;
  fieldData: CompletionStatus;
  loading: boolean;
}

export interface VendorFormChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: ChoiceVendor | null;
  activeEdition: { id: string; name: string } | null;
  onChoosePaidDetails: (vendor: ChoiceVendor) => void;
  onChooseFieldData: (vendor: ChoiceVendor) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getPaidDetailsStatus(vendor: ChoiceVendor): CompletionStatus {
  const name = (vendor.contact_name || '').trim();
  const biz = (vendor.business_name || '').trim();
  const phone = (vendor.phone || '').trim();

  if (name && biz && phone) return 'complete';
  if (name || biz || phone) return 'in_progress';
  return 'not_started';
}

async function getFieldDataStatus(
  vendorId: string | undefined,
  editionId: string
): Promise<CompletionStatus> {
  if (!vendorId) return 'not_started';

  const supabase = createClient();
  if (!supabase) return 'not_started';

  const { data } = await supabase
    .from('survey_responses')
    .select('id, submitted_at')
    .eq('vendor_id', vendorId)
    .eq('context_id', editionId)
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return 'not_started';

  // Check how many answers exist for the response
  const responseId = data[0].id;
  const { count } = await supabase
    .from('survey_answers')
    .select('id', { count: 'exact', head: true })
    .eq('response_id', responseId);

  if (!count || count === 0) return 'in_progress';
  if (count >= 5) return 'complete';
  return 'in_progress';
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: CompletionStatus; loading?: boolean }> = ({
  status,
  loading,
}) => {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-text-muted border border-border">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Checking…
      </span>
    );
  }

  const config = {
    not_started: {
      icon: <CircleDashed className="w-2.5 h-2.5" />,
      label: 'Not started',
      className: 'bg-slate-100 text-text-muted border-border',
    },
    in_progress: {
      icon: <Clock className="w-2.5 h-2.5" />,
      label: 'In progress',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    complete: {
      icon: <CheckCircle2 className="w-2.5 h-2.5" />,
      label: 'Complete',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  };

  const { icon, label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${className}`}
    >
      {icon}
      {label}
    </span>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const VendorFormChoiceModal: React.FC<VendorFormChoiceModalProps> = ({
  isOpen,
  onClose,
  vendor,
  activeEdition,
  onChoosePaidDetails,
  onChooseFieldData,
}) => {
  const [status, setStatus] = useState<StatusInfo>({
    paidDetails: 'not_started',
    fieldData: 'not_started',
    loading: true,
  });

  // Resolve statuses whenever modal opens or vendor changes
  const resolveStatuses = useCallback(async () => {
    if (!vendor || !activeEdition) return;

    setStatus((prev) => ({ ...prev, loading: true }));

    const paidDetails = getPaidDetailsStatus(vendor);
    const fieldData = await getFieldDataStatus(vendor.vendor_id, activeEdition.id);

    setStatus({ paidDetails, fieldData, loading: false });
  }, [vendor, activeEdition]);

  useEffect(() => {
    if (isOpen && vendor && activeEdition) {
      resolveStatuses();
    } else {
      setStatus({ paidDetails: 'not_started', fieldData: 'not_started', loading: true });
    }
  }, [isOpen, vendor, activeEdition, resolveStatuses]);

  if (!isOpen || !vendor) return null;

  const displayName = vendor.business_name || vendor.contact_name || 'Unnamed Vendor';
  const subName = vendor.business_name && vendor.contact_name
    ? vendor.contact_name
    : vendor.phone || null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center sm:items-start justify-center p-3 sm:p-4 overflow-y-auto"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white border border-border rounded-2xl shadow-xl z-10 w-full max-w-[480px] animate-scale-up sm:mt-[6vh]">

        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-border flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="w-4 h-4 text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-0.5">
                Fill In Details
              </p>
              <h2 className="text-sm font-bold text-text-primary truncate">{displayName}</h2>
              {subName && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-text-tertiary" />
                  <span className="text-[11px] text-text-tertiary font-mono">{subName}</span>
                </div>
              )}
              {activeEdition && (
                <p className="text-[10px] text-text-tertiary mt-0.5">
                  {activeEdition.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 border border-border text-text-muted hover:text-text-primary hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-3"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body — two choice cards */}
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-text-tertiary px-0.5 mb-1">
            Choose which form to open for this vendor:
          </p>

          {/* Card 1 — Paid Vendor Details */}
          <button
            onClick={() => onChoosePaidDetails(vendor)}
            className="w-full bg-white border border-border hover:border-accent hover:bg-accent-soft/30 rounded-xl p-4 text-left transition-all duration-150 cursor-pointer group focus:outline-none focus:border-accent"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-xs font-bold text-text-primary">Paid Vendor Details</h3>
                  <StatusBadge status={status.paidDetails} loading={status.loading} />
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Update payment status, amount paid, contact info, and business details.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-accent transition-colors shrink-0 ml-1" />
            </div>
          </button>

          {/* Card 2 — Field Data Collection */}
          <button
            onClick={() => onChooseFieldData(vendor)}
            className="w-full bg-white border border-border hover:border-accent hover:bg-accent-soft/30 rounded-xl p-4 text-left transition-all duration-150 cursor-pointer group focus:outline-none focus:border-accent"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-xs font-bold text-text-primary">Field Data Collection</h3>
                  <StatusBadge status={status.fieldData} loading={status.loading} />
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Enter or edit the vendor&apos;s survey responses for this edition.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-accent transition-colors shrink-0 ml-1" />
            </div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-5 pb-4 pt-1">
          <p className="text-[9px] text-text-muted text-center">
            Both forms are pre-filled with existing data for this vendor.
          </p>
        </div>
      </div>
    </div>
  );
};
