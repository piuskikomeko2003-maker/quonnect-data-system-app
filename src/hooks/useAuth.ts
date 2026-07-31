'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/auth/permissions';
import { ROLE_LABELS } from '@/lib/auth/permissions';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

interface CurrentUser {
  userId: string;
  email: string | undefined;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
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
  });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/profile');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setState({
        userId: data.id,
        email: data.email,
        profile: data.profile,
        role: data.profile?.role ?? null,
        loading: false,
      });
    } catch {
      setState({
        userId: '',
        email: undefined,
        profile: null,
        role: null,
        loading: false,
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
