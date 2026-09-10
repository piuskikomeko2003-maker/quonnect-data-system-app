'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  X,
  ChevronLeft,
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Phone,
  Mail,
  Building2,
  User,
  Tag,
  BadgeCheck,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PaidVendorDetailsVendor {
  id: string;           // vendor_registrations row id
  vendor_id?: string;   // vendors table FK (may be null for CSV-only records)
  business_name?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  category?: string;
  amount_paid?: number;
  payment_status?: string;
  fee_source?: string;
  ticket_number?: string;
  stall_number?: string;
  [key: string]: any;
}

export interface PaidVendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  vendor: PaidVendorDetailsVendor | null;
  activeEdition: { id: string; name: string } | null;
  onSaved: () => void;
}

const PAYMENT_STATUSES = ['paid', 'pending', 'waived', 'partial'];
const CATEGORIES = [
  'Food', 'Fashion', 'Crafts', 'Beauty', 'Electronics',
  'Agriculture', 'Services', 'Health', 'Education', 'Other',
];

// ─── Component ────────────────────────────────────────────────────────────────

export const PaidVendorDetailsModal: React.FC<PaidVendorDetailsModalProps> = ({
  isOpen,
  onClose,
  onBack,
  vendor,
  activeEdition,
  onSaved,
}) => {
  const [form, setForm] = useState({
    business_name: '',
    contact_name: '',
    phone: '',
    email: '',
    category: '',
    amount_paid: '',
    payment_status: 'paid',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-fill form when vendor changes
  useEffect(() => {
    if (isOpen && vendor) {
      setForm({
        business_name: vendor.business_name || '',
        contact_name: vendor.contact_name || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        category: vendor.category || '',
        amount_paid: vendor.amount_paid != null ? String(vendor.amount_paid) : '',
        payment_status: vendor.payment_status || 'paid',
      });
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, vendor]);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!vendor) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Database client not available');

      const amountNum = parseInt(form.amount_paid.replace(/[^0-9]/g, ''), 10) || 0;

      // 1. Update vendor_registrations row
      const regPayload: Record<string, any> = {
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        category: form.category,
        amount_paid: amountNum,
        payment_status: form.payment_status,
        updated_at: new Date().toISOString(),
      };

      const { error: regErr } = await supabase
        .from('vendor_registrations')
        .update(regPayload)
        .eq('id', vendor.id);

      if (regErr) throw regErr;

      // 2. If there's a linked vendor record, sync profile fields
      if (vendor.vendor_id) {
        const { error: vendErr } = await supabase
          .from('vendors')
          .update({
            business_name: form.business_name.trim() || undefined,
            contact_name: form.contact_name.trim() || undefined,
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
            category: form.category || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vendor.vendor_id);

        if (vendErr) console.warn('Vendor profile sync failed (non-fatal):', vendErr.message);
      }

      setSuccess(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('PaidVendorDetailsModal save error:', err);
      setError(err?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleBack = () => {
    setError(null);
    setSuccess(false);
    onClose();
    if (onBack) onBack();
  };

  if (!isOpen || !vendor) return null;

  return (
    <div
      className="fixed inset-0 z-[1150] flex items-center sm:items-start justify-center p-3 sm:p-4 overflow-y-auto"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      <div className="relative bg-bg-surface border border-border rounded-xl shadow-modal z-10 w-full max-w-[560px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto animate-scale-up sm:mt-[4vh]">

        {/* Header */}
        <div className="sticky top-0 bg-bg-surface border-b border-border p-4 flex items-center justify-between z-10 rounded-t-xl">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer mr-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue" />
                  Paid Vendor Details
                </h2>
                {(vendor.ticket_number || vendor.stall_number) && (
                  <span className="font-mono text-[10px] font-bold text-green-400 bg-green-500/15 px-2 py-0.5 rounded border border-green-500/25">
                    {vendor.ticket_number || vendor.stall_number}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                {vendor.business_name || vendor.contact_name || 'Vendor'} — {activeEdition?.name || 'Current Edition'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-bg-elevated border border-border text-text-secondary hover:text-red hover:border-red flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Success flash */}
          {success && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Saved successfully!
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-muted border border-red/20 rounded-lg px-4 py-3 text-red text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Section: Contact & Business */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-1.5">
              <User className="w-3 h-3" /> Business Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Contact Name"
                icon={<User className="w-3 h-3" />}
                value={form.contact_name}
                onChange={v => set('contact_name', v)}
                placeholder="Full name"
              />
              <Field
                label="Business Name"
                icon={<Building2 className="w-3 h-3" />}
                value={form.business_name}
                onChange={v => set('business_name', v)}
                placeholder="Trading name"
              />
              <Field
                label="Phone"
                icon={<Phone className="w-3 h-3" />}
                value={form.phone}
                onChange={v => set('phone', v)}
                placeholder="+256 7xx xxx xxx"
                type="tel"
              />
              <Field
                label="Email"
                icon={<Mail className="w-3 h-3" />}
                value={form.email}
                onChange={v => set('email', v)}
                placeholder="vendor@email.com"
                type="email"
              />
            </div>

            {/* Category */}
            <div>
              <label className="flex items-center gap-1 text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                <Tag className="w-3 h-3" /> Business Category
              </label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full bg-bg-input border border-border-light focus:border-blue rounded-lg px-3 py-2 text-text-primary text-xs outline-none transition-colors"
              >
                <option value="">— Select category —</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Section: Payment */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-1.5">
              <CreditCard className="w-3 h-3" /> Payment Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Amount Paid */}
              <div>
                <label className="flex items-center gap-1 text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                  Amount Paid (UGX)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green pointer-events-none">UGX</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.amount_paid}
                    onChange={e => set('amount_paid', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full pl-11 pr-3 bg-bg-input border border-border-light focus:border-green rounded-lg py-2 text-text-primary text-xs font-mono outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <label className="flex items-center gap-1 text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                  <BadgeCheck className="w-3 h-3" /> Payment Status
                </label>
                <select
                  value={form.payment_status}
                  onChange={e => set('payment_status', e.target.value)}
                  className="w-full bg-bg-input border border-border-light focus:border-green rounded-lg px-3 py-2 text-text-primary text-xs outline-none transition-colors"
                >
                  {PAYMENT_STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <button
              onClick={handleClose}
              disabled={saving}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-elevated border border-border px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || success}
              className="flex items-center gap-2 text-xs font-bold text-black bg-green hover:bg-[#00ff7a] disabled:opacity-60 px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-component: Field ─────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ label, icon, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="flex items-center gap-1 text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
      {icon}{label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-bg-input border border-border-light focus:border-blue rounded-lg px-3 py-2 text-text-primary text-xs placeholder-text-muted outline-none transition-colors"
    />
  </div>
);
