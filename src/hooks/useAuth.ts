'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole, UserProfile } from '@/lib/auth/permissions';
import { ROLE_LABELS, isApproved as checkApproved } from '@/lib/auth/permissions';

interface CurrentUser {
  userId: string;
  email: string | undefined;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isPending: boolean;
  isApproved: boolean;
}

export function useAuth(): CurrentUser & {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
} {
  const [state, setState] = useState<CurrentUser>({
    userId: '',
    email: undefined,
    profile: null,
    role: null,
    loading: true,
    isPending: false,
    isApproved: false,
  });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/profile', { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const currentRole = data.profile?.role ?? null;
      setState({
        userId: data.id,
        email: data.email,
        profile: data.profile,
        role: currentRole,
        loading: false,
        isPending: Boolean(data.id && (!currentRole || currentRole === 'unassigned')),
        isApproved: Boolean(data.id && checkApproved(currentRole)),
      });
    } catch {
      setState({
        userId: '',
        email: undefined,
        profile: null,
        role: null,
        loading: false,
        isPending: false,
        isApproved: false,
      });
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return {
    ...state,
    signOut,
    refreshProfile: fetchProfile,
  };
}

export { ROLE_LABELS };
export type { UserProfile, UserRole };

