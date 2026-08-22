'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Save,
  ChevronLeft,
  ClipboardList,
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export const IncompleteVendorsPanel: React.FC<IncompleteVendorsPanelProps> = ({
  onBack,
}) => {
  const [vendors, setVendors] = useState<IncompleteVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Partial<IncompleteVendor>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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

  // ── Open edit form for a vendor ───────────────────────────────────────────

  const handleEdit = (vendor: IncompleteVendor) => {
    setEditingId(vendor.id);
    setSaveError(null);
    setFormValues({
      contact_name: vendor.contact_name || '',
      business_name: vendor.business_name || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      category: vendor.category || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormValues({});
    setSaveError(null);
  };

  // ── Save updated vendor profile ───────────────────────────────────────────

  const handleSave = async (vendorId: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const contactName = (formValues.contact_name || '').trim();
      const phone = (formValues.phone || '').trim();

      // Determine if the vendor is now complete
      // Required: contact_name + phone (or at minimum contact_name if phone-less vendors are acceptable)
      const isNowComplete = !!contactName && !!phone;

      const updatePayload: Record<string, any> = {
        contact_name: contactName,
        business_name: (formValues.business_name || '').trim(),
        phone: phone,
        email: (formValues.email || '').trim(),
        category: (formValues.category || '').trim(),
        updated_at: new Date().toISOString(),
      };

      if (isNowComplete) {
        // Profile is now complete — nothing extra to write, vendors table has no
        // is_complete or source columns. The phone being filled in is the signal.
      }

      const { error: updateErr } = await supabase
        .from('vendors')
        .update(updatePayload)
        .eq('id', vendorId);

      if (updateErr) throw updateErr;

      // If marked complete, remove from the list and add to "saved" flash set
      if (isNowComplete) {
        setSavedIds(prev => new Set([...prev, vendorId]));
        setTimeout(() => {
          setVendors(prev => prev.filter(v => v.id !== vendorId));
          setSavedIds(prev => {
            const next = new Set(prev);
            next.delete(vendorId);
            return next;
          });
        }, 1200);
      } else {
        // Update in-place (still incomplete — phone or name still missing)
        setVendors(prev =>
          prev.map(v =>
            v.id === vendorId
              ? {
                  ...v,
                  contact_name: updatePayload.contact_name,
                  business_name: updatePayload.business_name,
                  phone: updatePayload.phone,
                  email: updatePayload.email,
                  category: updatePayload.category,
                }
              : v
          )
        );
      }

      setEditingId(null);
      setFormValues({});
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save vendor');
      console.error('IncompleteVendorsPanel save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const CATEGORIES = [
    'Food', 'Fashion', 'Crafts', 'Beauty', 'Electronics',
    'Agriculture', 'Services', 'Health', 'Education', 'Other',
  ];

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
            const isEditing = editingId === vendor.id;
            const isSaved = savedIds.has(vendor.id);

            if (isSaved) {
              return (
                <div
                  key={vendor.id}
                  className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3 transition-all"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <span className="text-sm font-bold text-green-400">
                    {vendor.contact_name || vendor.business_name} — Profile completed ✓
                  </span>
                </div>
              );
            }

            return (
              <div
                key={vendor.id}
                className="bg-[#0f1117] border border-white/5 rounded-xl overflow-hidden transition-all"
              >
                {/* Vendor row header */}
                <div
                  className={`flex items-center justify-between px-4 py-3 ${!isEditing ? 'cursor-pointer hover:bg-white/[0.02]' : 'bg-white/[0.02]'} transition-colors`}
                  onClick={() => !isEditing && handleEdit(vendor)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {vendor.contact_name || vendor.business_name || 'Unnamed Vendor'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <MissingBadge show={!vendor.phone} label="No phone" />
                        <MissingBadge show={!vendor.email} label="No email" />
                        <MissingBadge show={!vendor.category} label="No category" />
                      </div>
                    </div>
                  </div>
                  {!isEditing && (
                    <span className="text-[10px] text-green-400 font-bold shrink-0 ml-4 hover:underline">
                      Fill In Details →
                    </span>
                  )}
                  {isEditing && (
                    <button
                      onClick={e => { e.stopPropagation(); handleCancelEdit(); }}
                      className="text-gray-400 hover:text-white p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Edit form (inline expand) */}
                {isEditing && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        label="Contact Name *"
                        value={formValues.contact_name || ''}
                        onChange={v => setFormValues(prev => ({ ...prev, contact_name: v }))}
                        placeholder="Full name of vendor owner"
                        required
                      />
                      <FormField
                        label="Phone *"
                        value={formValues.phone || ''}
                        onChange={v => setFormValues(prev => ({ ...prev, phone: v }))}
                        placeholder="+256 7xx xxx xxx"
                        type="tel"
                        required
                      />
                      <FormField
                        label="Business Name"
                        value={formValues.business_name || ''}
                        onChange={v => setFormValues(prev => ({ ...prev, business_name: v }))}
                        placeholder="Trading name (if different)"
                      />
                      <FormField
                        label="Email"
                        value={formValues.email || ''}
                        onChange={v => setFormValues(prev => ({ ...prev, email: v }))}
                        placeholder="vendor@email.com"
                        type="email"
                      />
                      {/* Category dropdown */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                          Business Category
                        </label>
                        <select
                          value={formValues.category || ''}
                          onChange={e => setFormValues(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-green-500 transition-colors"
                        >
                          <option value="">— Select category —</option>
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Completion hint */}
                    {formValues.contact_name && formValues.phone ? (
                      <div className="flex items-center gap-2 text-[11px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Name and phone filled — this profile will be marked <strong>complete</strong> on save.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Fill in <strong className="text-white">Contact Name</strong> and <strong className="text-white">Phone</strong> to complete this profile.
                      </div>
                    )}

                    {saveError && (
                      <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {saveError}
                      </div>
                    )}

                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="text-xs font-bold text-gray-400 hover:text-white bg-white/5 border border-white/10 px-4 py-2 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(vendor.id)}
                        disabled={saving}
                        className="flex items-center gap-2 text-xs font-bold text-black bg-green-500 hover:bg-green-400 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
                      >
                        {saving ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                        ) : (
                          <><Save className="w-3.5 h-3.5" /> Save Profile</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

const FormField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required }) => (
  <div>
    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-500 outline-none focus:border-green-500 transition-colors"
    />
  </div>
);
