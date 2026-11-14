'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastProvider';
import type { UserProfile } from '@/hooks/useAuth';
import {
  REGION_SECTIONS,
  type RegionSectionKey,
  type SectionAccessLevel,
  type SectionPermissions,
} from '@/lib/auth/permissions';
import { MapPin, Loader2, ShieldCheck, Eye, Pencil, X } from 'lucide-react';

interface RegionalAccessModalProps {
  user: UserProfile;
  onClose: () => void;
  onSaved: (updated: UserProfile) => void;
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

export const RegionalAccessModal: React.FC<RegionalAccessModalProps> = ({
  user,
  onClose,
  onSaved,
}) => {
  const { addToast } = useToast();
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regionId, setRegionId] = useState<string>(user.managed_region_id || '');
  const [permissions, setPermissions] = useState<SectionPermissions>(
    (user.section_permissions as SectionPermissions) || {}
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('regions')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          addToast(error.message, 'error');
        }
        setRegions((data as RegionOption[]) || []);
        setLoadingRegions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const grantedCount = useMemo(
    () => Object.values(permissions).filter((v) => v === 'view' || v === 'manage').length,
    [permissions]
  );

  const setLevel = (section: RegionSectionKey, value: '' | SectionAccessLevel) => {
    setPermissions((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[section];
      } else {
        next[section] = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: user.id,
          role: 'regional_manager',
          managed_region_id: regionId || null,
          section_permissions: permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save access');
      addToast('Regional manager access updated', 'success');
      onSaved(data.user);
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
        aria-label="Configure regional manager access"
        className="bg-white border border-border rounded-xl w-full max-w-2xl shadow-modal animate-scale-up max-h-[90dvh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-text-primary">Regional Manager Access</h3>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
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

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Region assignment */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              Assigned Region
            </label>
            {loadingRegions ? (
              <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading regions…
              </div>
            ) : (
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full bg-slate-50 border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent focus:bg-white cursor-pointer"
              >
                <option value="">No region assigned</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-text-muted">
              This manager will only see this region and cannot switch workspaces.
            </p>
          </div>

          {/* Section permissions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                Section Access
              </h4>
              <Badge variant={grantedCount > 0 ? 'info' : 'neutral'} size="sm">
                {grantedCount} granted
              </Badge>
            </div>

            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {REGION_SECTIONS.map((section) => {
                const level = permissions[section.id] || '';
                return (
                  <div
                    key={section.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-text-primary">{section.name}</span>
                      <p className="text-[11px] text-text-muted">{section.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {level === 'view' && (
                        <Eye className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                      )}
                      {level === 'manage' && (
                        <Pencil className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      )}
                      <select
                        value={level}
                        onChange={(e) =>
                          setLevel(section.id, e.target.value as '' | SectionAccessLevel)
                        }
                        className={`border rounded-lg px-2.5 py-1.5 text-[11px] font-medium outline-none cursor-pointer ${
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
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-text-muted">
              “View &amp; edit” permits changes in that section. Settings, form builder, markets
              and sticker design always remain admin-only.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-slate-50/60">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || loadingRegions}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </span>
            ) : (
              'Save Access'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
