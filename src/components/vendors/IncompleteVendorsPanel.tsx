'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncompleteVendor {
  id: string;
  contact_name: string;
  business_name: string;
  phone: string;
  email: string;
  category: string;
  created_at: string;
}

interface IncompleteVendorsPanelProps {
  /** Called when user wants to go back to the main paid vendors view */
  onBack?: () => void;
  /** Called when user clicks 'Fill In Details' on a vendor row */
  onFillDetails?: (vendor: IncompleteVendor) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const IncompleteVendorsPanel: React.FC<IncompleteVendorsPanelProps> = ({
  onBack,
  onFillDetails,
}) => {
  const [vendors, setVendors] = useState<IncompleteVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncomplete = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data, error: dbErr } = await supabase
        .from('vendors')
        .select('id, contact_name, business_name, phone, email, category, created_at')
        // "Incomplete" = vendor was imported with no phone (name-only CSV row).
        // The vendors table has no is_complete column; we use empty phone as the proxy.
        .or('phone.is.null,phone.eq.')
        .order('created_at', { ascending: false });

      if (dbErr) throw dbErr;
      setVendors(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load incomplete vendors');
      console.error('IncompleteVendorsPanel fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncomplete();
  }, [fetchIncomplete]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors mr-1 font-medium"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">Incomplete Vendors</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Vendors imported via CSV with name only — fill in missing details to complete their profiles.
            </p>
          </div>
        </div>
        {!loading && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
            {vendors.length} Pending
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading incomplete vendors...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && vendors.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 select-none">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-sm font-bold text-white">All vendor profiles are complete</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            No incomplete records found. CSV-imported vendors with missing details will appear here.
          </p>
        </div>
      )}

      {/* Vendor list */}
      {!loading && !error && vendors.length > 0 && (
        <div className="space-y-3">
          {vendors.map(vendor => {
            return (
              <button
                key={vendor.id}
                onClick={() => onFillDetails?.(vendor)}
                className="w-full text-left bg-[#0f1117] border border-white/5 hover:border-white/15 rounded-xl p-4 flex items-center gap-3 transition-all cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {vendor.contact_name || vendor.business_name || 'Unnamed Vendor'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <MissingBadge show={!vendor.phone} label="No phone" />
                    <MissingBadge show={!vendor.email} label="No email" />
                    <MissingBadge show={!vendor.category} label="No category" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 group-hover:text-amber-300 transition-colors shrink-0">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Fill In Details
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const MissingBadge: React.FC<{ show: boolean; label: string }> = ({ show, label }) => {
  if (!show) return null;
  return (
    <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
};

