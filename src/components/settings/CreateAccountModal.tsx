'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastProvider';
import type { UserProfile, UserRole } from '@/hooks/useAuth';
import {
  REGION_SECTIONS,
  type RegionSectionKey,
  type SectionAccessLevel,
  type SectionPermissions,
} from '@/lib/auth/permissions';
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Loader2,
  UserPlus,
  SlidersHorizontal,
  ShieldCheck,
  Briefcase,
  Shield,
} from 'lucide-react';

interface CreateAccountModalProps {
  currentUserRole: UserRole | null;
  onClose: () => void;
  onCreated: (user: UserProfile) => void;
}

interface RegionOption {
  id: string;
  name: string;
}

const LEVEL_OPTIONS: Array<{ value: '' | SectionAccessLevel; label: string }> = [
  { value: '', label: 'No access' },
  { value: 'view', label: 'View only' },
  { value: 'manage', label: 'View & edit' },
];

const makePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 14; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
};

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  currentUserRole,
  onClose,
  onCreated,
}) => {
  const { addToast } = useToast();
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('regional_manager');
  const [regionId, setRegionId] = useState('');
  const [permissions, setPermissions] = useState<SectionPermissions>({ overview: 'view' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('regions')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) addToast(error.message, 'error');
        setRegions((data as RegionOption[]) || []);
        setLoadingRegions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const isRegional = role === 'regional_manager';
  const grantedCount = useMemo(
    () => Object.values(permissions).filter((v) => v === 'view' || v === 'manage').length,
    [permissions]
  );

  const setLevel = (section: RegionSectionKey, value: '' | SectionAccessLevel) => {
    setPermissions((prev) => {
      const next = { ...prev };
      if (!value) delete next[section];
      else next[section] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      addToast('Enter the email address for the new account', 'error');
      return;
    }
    if (password.length < 8) {
      addToast('Password must be at least 8 characters', 'error');
      return;
    }
    if (isRegional && !regionId) {
      addToast('Select the region this manager will manage', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
          managed_region_id: isRegional ? regionId : null,
          section_permissions: isRegional ? permissions : {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      addToast(
        `Account created for ${email.trim()}. They can sign in now with the password you set.`,
        'success'
      );
      onCreated(data.user);
      onClose();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] text-left">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create team account"
        className="bg-white border border-border rounded-xl w-full max-w-2xl shadow-modal animate-scale-up max-h-[92dvh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <UserPlus className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Create Team Account</h3>
              <p className="text-xs text-text-muted">
                Set the login email and password directly — no signup link or approval needed.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 rounded cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@quonnect.com"
                  autoComplete="off"
                  required
                  className="w-full bg-slate-50 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full bg-slate-50 border border-border rounded-lg pl-3 pr-20 py-2 text-xs text-text-primary outline-none focus:border-accent focus:bg-white"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="p-1 text-text-tertiary hover:text-text-primary rounded"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPassword(makePassword());
                        setShowPassword(true);
                      }}
                      className="text-[10px] font-bold text-accent hover:underline px-1.5"
                      title="Generate a strong password"
                    >
                      Generate
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-text-muted">
                  Share this email and password with the person. They can sign in at the normal app link.
                </p>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: 'regional_manager' as const, label: 'Regional Manager', desc: 'One region, chosen below', icon: <Briefcase className="w-4 h-4" /> },
                  { value: 'user' as const, label: 'User', desc: 'Standard staff access', icon: <Shield className="w-4 h-4" /> },
                  { value: 'admin' as const, label: 'Admin', desc: 'Full operational access', icon: <ShieldCheck className="w-4 h-4" /> },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      role === option.value
                        ? 'border-accent bg-accent-soft/50 shadow-xs'
                        : 'border-border bg-white hover:border-accent/40'
                    }`}
                  >
                    <span className={role === option.value ? 'text-accent' : 'text-text-tertiary'}>
                      {option.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-text-primary">{option.label}</span>
                      <span className="block text-[10px] text-text-muted mt-0.5">{option.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              {currentUserRole === 'super_admin' && (
                <button
                  type="button"
                  onClick={() => setRole('super_admin')}
                  className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                    role === 'super_admin'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-border bg-white text-text-secondary hover:border-red-300 hover:text-red-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Super Admin
                </button>
              )}
            </div>

            {/* Region + sections (regional manager only) */}
            {isRegional && (
              <div className="space-y-4 p-4 rounded-xl border border-accent/20 bg-accent-soft/20">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Assigned Region
                  </label>
                  {loadingRegions ? (
                    <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading regions…
                    </div>
                  ) : (
                    <select
                      value={regionId}
                      onChange={(e) => setRegionId(e.target.value)}
                      required={isRegional}
                      className="w-full bg-white border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
                    >
                      <option value="">Select the region they will manage…</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-text-muted">
                    On first login they go straight into this region. They cannot switch regions.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5" /> What can they access?
                    </label>
                    <Badge variant={grantedCount > 0 ? 'info' : 'neutral'} size="sm">
                      {grantedCount} granted
                    </Badge>
                  </div>
                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-white">
                    {REGION_SECTIONS.map((section) => {
                      const level = permissions[section.id] || '';
                      return (
                        <div
                          key={section.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5"
                        >
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-text-primary">{section.name}</span>
                            <p className="text-[10px] text-text-muted">{section.description}</p>
                          </div>
                          <select
                            value={level}
                            onChange={(e) =>
                              setLevel(section.id, e.target.value as '' | SectionAccessLevel)
                            }
                            className={`shrink-0 border rounded-lg px-2 py-1.5 text-[10px] font-medium outline-none cursor-pointer ${
                              level === 'manage'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : level === 'view'
                                  ? 'bg-sky-50 border-sky-200 text-sky-800'
                                  : 'bg-slate-50 border-border text-text-secondary'
                            }`}
                          >
                            {LEVEL_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-text-muted">
                    These can be changed later from the user’s Access button.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-slate-50/60">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
