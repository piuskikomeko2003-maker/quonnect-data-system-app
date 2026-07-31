'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { UserProfile, UserRole } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/hooks/useAuth';
import {
  UserPlus,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface UserManagementSettingsProps {
  currentUserRole: UserRole | null;
  currentUserId: string;
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  super_admin: <ShieldAlert className="w-3.5 h-3.5" />,
  admin: <ShieldCheck className="w-3.5 h-3.5" />,
  user: <Shield className="w-3.5 h-3.5" />,
};

const ROLE_BADGE_VARIANTS: Record<UserRole, 'danger' | 'warning' | 'info'> = {
  super_admin: 'danger',
  admin: 'warning',
  user: 'info',
};

export const UserManagementSettings: React.FC<UserManagementSettingsProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);
  const canManage = currentUserRole === 'super_admin' || currentUserRole === 'admin';

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
      setUsers(data.users);
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      addToast(`Invitation sent to ${inviteEmail.trim()}`, 'success');
      setInviteEmail('');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setInviting(false);
    }
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
      addToast(`Role updated successfully`, 'success');
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

  if (!canManage) {
    return (
      <div className="py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-white">Access Restricted</h3>
        <p className="text-xs text-gray-400 mt-1">
          Only Super Admins and Admins can manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-sm font-bold text-white">User Management</h3>
        <p className="text-xs text-gray-400 mt-1">
          Invite new users and manage existing access.
        </p>
      </div>

      <form onSubmit={handleInvite} className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address to invite..."
            required
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-green-500/50 transition-colors"
          />
        </div>
        <Button type="submit" variant="primary" size="md" disabled={inviting}>
          {inviting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserPlus className="w-3.5 h-3.5" />
          )}
          <span>Invite</span>
        </Button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-lg"
            >
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-400 shrink-0">
                {u.email.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-sm text-white truncate">
                  {u.email}
                  {u.user_id === currentUserId && (
                    <span className="ml-2 text-[10px] text-gray-500">(You)</span>
                  )}
                </span>
                <span className="block text-[10px] text-gray-500 mt-0.5">
                  Joined {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={u.role}
                  onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                    disabled={
                      u.user_id === currentUserId ||
                      (u.role === 'super_admin' && currentUserRole !== 'super_admin')
                    }
                  className="bg-white/[0.04] border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {currentUserRole === 'super_admin' && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>

                <Badge variant={ROLE_BADGE_VARIANTS[u.role]} size="sm">
                  <span className="flex items-center gap-1">
                    {ROLE_ICONS[u.role]}
                    {ROLE_LABELS[u.role]}
                  </span>
                </Badge>

                <button
                  onClick={() => handleRevoke(u.id, u.email)}
                  disabled={u.user_id === currentUserId || (u.role === 'super_admin' && currentUserRole !== 'super_admin')}
                  className="p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer rounded transition-colors"
                  title="Revoke access"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-xs text-gray-500">No users found.</p>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-white/5 pt-4">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          About Roles
        </h4>
        <div className="grid gap-2">
          <div className="flex items-start gap-2 text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-red-400">Super Admin</span>
              <span className="text-gray-500"> - Full system access, can manage all users and admins.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-amber-400">Admin</span>
              <span className="text-gray-500"> - Full operational access, can invite and manage users.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <Shield className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-blue-400">User</span>
              <span className="text-gray-500"> - Standard authenticated user for future use.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-lg shadow-lg text-xs font-semibold text-white animate-slide-up pointer-events-auto border ${
              toast.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-gray-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
