'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { UserProfile, UserRole } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/hooks/useAuth';
import {
  UserCheck,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Users,
  Link2,
  Mail,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface UserManagementSettingsProps {
  currentUserRole: UserRole | null;
  currentUserId: string;
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  super_admin: <ShieldAlert className="w-3.5 h-3.5" />,
  admin: <ShieldCheck className="w-3.5 h-3.5" />,
  user: <Shield className="w-3.5 h-3.5" />,
  unassigned: <Clock className="w-3.5 h-3.5" />,
};

const ROLE_BADGE_VARIANTS: Record<UserRole, 'danger' | 'warning' | 'info' | 'neutral'> = {
  super_admin: 'danger',
  admin: 'warning',
  user: 'info',
  unassigned: 'neutral',
};

export const UserManagementSettings: React.FC<UserManagementSettingsProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);
  const canManage = currentUserRole === 'super_admin' || currentUserRole === 'admin';

  // Link Generator State
  const [recipientEmail, setRecipientEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Compute the dynamic signup URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cleanEmail = recipientEmail.trim();
  const generatedSignupUrl = cleanEmail
    ? `${origin}/signup?email=${encodeURIComponent(cleanEmail)}`
    : `${origin}/signup`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedSignupUrl);
      setCopiedLink(true);
      addToast('Signup link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      addToast(`Could not copy link automatically: ${generatedSignupUrl}`, 'error');
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Invitation to Quonnect Data System');
    const body = encodeURIComponent(
      `Hello,\n\nYou have been invited to join the Quonnect Data System.\n\nPlease use the link below to create your account and set your password:\n${generatedSignupUrl}\n\nOnce submitted, an administrator will assign your access role.\n\nBest regards,\nQuonnect Team`
    );
    window.location.href = `mailto:${cleanEmail}?subject=${subject}&body=${body}`;
  };

  const handleChangeRole = async (profileId: string, newRole: UserRole) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, role: newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to change role');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === profileId ? { ...u, role: newRole } : u))
      );
      addToast(`Role updated to ${ROLE_LABELS[newRole] || newRole}`, 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleRevoke = async (profileId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${email}?`)) return;

    try {
      const res = await fetch(`/api/users?profileId=${profileId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke access');
      }

      setUsers((prev) => prev.filter((u) => u.id !== profileId));
      addToast(`Access revoked for ${email}`, 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return 'Never logged in';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (!canManage) {
    return (
      <div className="py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-text-primary">Access Restricted</h3>
        <p className="text-xs text-text-muted mt-1">
          Only Super Admins and Admins can manage users.
        </p>
      </div>
    );
  }

  const totalUsers = users.length;
  const pendingUsers = users.filter((u) => u.role === 'unassigned').length;
  const activeUsers = totalUsers - pendingUsers;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Stats */}
      <div>
        <h3 className="text-sm font-bold text-text-primary">User Management & Access Control</h3>
        <p className="text-xs text-text-muted mt-1">
          Generate invite signup links, review new user registrations, and approve access roles.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">Total Registered</span>
            <Users className="w-4 h-4 text-text-tertiary" />
          </div>
          <div className="text-2xl font-bold text-text-primary mt-2">{totalUsers}</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium">Active / Approved</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{activeUsers}</div>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 font-medium">Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{pendingUsers}</div>
        </div>
      </div>

      {/* =========================================================================
          SIGNUP LINK GENERATOR
          ========================================================================= */}
      <div className="p-5 bg-white border border-border rounded-xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center text-accent">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-text-primary">Signup Link Generator</h4>
              <p className="text-[11px] text-text-muted">
                Create a customized signup link to send to new team members or colleagues.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-sky-50 border border-sky-200 text-sky-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Admin-Approval Protected</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
          {/* Recipient Email Input */}
          <div className="md:col-span-5">
            <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
              Recipient Email (Optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="colleague@quonnect.com (auto-fills on page)"
                className="w-full bg-slate-50 border border-border rounded-lg pl-9 pr-8 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent focus:bg-white transition-colors"
              />
              {recipientEmail && (
                <button
                  type="button"
                  onClick={() => setRecipientEmail('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
                  title="Clear email"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Generated URL Box */}
          <div className="md:col-span-7">
            <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
              Generated Invitation URL
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  readOnly
                  value={generatedSignupUrl}
                  className="w-full bg-slate-100 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-secondary select-all outline-none"
                />
              </div>

              {/* Copy Button */}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </Button>

              {/* Email Button */}
              {cleanEmail && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleEmailShare}
                  className="flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Open in your default email app"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send Mail</span>
                </Button>
              )}

              {/* Test / Open Tab Button */}
              <a
                href={generatedSignupUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg border border-border bg-white text-text-secondary hover:text-text-primary hover:bg-slate-50 transition-colors inline-flex items-center justify-center shrink-0 cursor-pointer"
                title="Open link in a new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-border rounded-lg text-[11px] text-text-secondary flex items-start gap-2">
          <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <span>
            <strong>How this works:</strong> When the recipient opens this link, they will set their own password and click Create Account. Upon signup, their profile is automatically marked <span className="font-semibold text-amber-700">Pending Approval</span>. They cannot see or access any data until you select a role for them below.
          </span>
        </div>
      </div>

      {/* Users List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            All Registered Accounts ({users.length})
          </h4>
          <span className="text-[11px] text-text-muted">
            Ordered by newest registration
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 bg-white border border-border rounded-xl">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.user_id === currentUserId;
              const isSuper = u.role === 'super_admin';
              const isPending = u.role === 'unassigned';
              const canEdit = !isSelf && (!isSuper || currentUserRole === 'super_admin');

              return (
                <div
                  key={u.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border rounded-xl shadow-2xs transition-colors ${
                    isPending ? 'border-amber-300 bg-amber-50/20' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isPending
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-accent-soft text-accent'
                      }`}
                    >
                      {u.email ? u.email.charAt(0).toUpperCase() : '?'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary truncate">
                          {u.email}
                        </span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-text-secondary border border-border">
                            You
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            Pending Approval
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-text-muted mt-1 flex-wrap">
                        <span>
                          <span className="text-text-tertiary">Signed up:</span>{' '}
                          {new Date(u.created_at).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="text-text-tertiary">Last login:</span>{' '}
                          <span className={u.last_sign_in_at ? 'text-text-primary font-medium' : 'text-text-muted'}>
                            {formatTimestamp(u.last_sign_in_at)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Role Selector */}
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                      disabled={!canEdit}
                      className="bg-slate-50 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
                    >
                      <option value="unassigned">Pending Approval</option>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      {currentUserRole === 'super_admin' && (
                        <option value="super_admin">Super Admin</option>
                      )}
                    </select>

                    <Badge variant={ROLE_BADGE_VARIANTS[u.role] || 'neutral'} size="sm">
                      <span className="flex items-center gap-1">
                        {ROLE_ICONS[u.role]}
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </Badge>

                    <button
                      onClick={() => handleRevoke(u.id, u.email)}
                      disabled={!canEdit}
                      className="p-1.5 text-text-muted hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer rounded transition-colors"
                      title={isSelf ? 'Cannot delete your own account' : 'Revoke user access'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {users.length === 0 && (
              <div className="py-12 text-center bg-white border border-dashed border-border rounded-xl">
                <p className="text-xs text-text-muted">No users found.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role Descriptions Guide */}
      <div className="border-t border-border pt-4">
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
          Role Descriptions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-border">
            <Clock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-amber-700">Pending Approval</span>
              <span className="text-text-secondary"> — Default for new signups. Cannot view or access any platform data until an admin assigns a role.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-border">
            <Shield className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-accent">User</span>
              <span className="text-text-secondary"> — Standard operational access to view events, attendance, and market data.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-border">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-amber-700">Admin</span>
              <span className="text-text-secondary"> — Can manage and assign roles to pending signups, edit configuration, and run operations.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-border">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-red-700">Super Admin</span>
              <span className="text-text-secondary"> — Full system ownership, can assign or modify other Admin and Super Admin roles.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-lg shadow-lg text-xs font-semibold animate-slide-up pointer-events-auto border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-text-muted hover:text-text-primary p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
