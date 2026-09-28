'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole, UserProfile } from '@/lib/auth/permissions';
import { ROLE_LABELS, isApproved as checkApproved } from '@/lib/auth/permissions';

export function extractUserName(
  userMetadata?: Record<string, any>,
  profile?: any,
  email?: string
): string | undefined {
  if (userMetadata?.first_name && typeof userMetadata.first_name === 'string') {
    const fn = userMetadata.first_name.trim();
    if (fn) return fn;
  }
  if (userMetadata?.full_name && typeof userMetadata.full_name === 'string') {
    const fn = userMetadata.full_name.trim().split(/\s+/)[0];
    if (fn) return fn;
  }
  if (userMetadata?.name && typeof userMetadata.name === 'string') {
    const fn = userMetadata.name.trim().split(/\s+/)[0];
    if (fn) return fn;
  }
  if (profile?.first_name && typeof profile.first_name === 'string') {
    const fn = profile.first_name.trim();
    if (fn) return fn;
  }
  if (profile?.full_name && typeof profile.full_name === 'string') {
    const fn = profile.full_name.trim().split(/\s+/)[0];
    if (fn) return fn;
  }
  if (profile?.name && typeof profile.name === 'string') {
    const fn = profile.name.trim().split(/\s+/)[0];
    if (fn) return fn;
  }

  // Fall back to a cleaned-up version of their username
  const rawUsername =
    userMetadata?.username ||
    profile?.username ||
    (email ? email.split('@')[0] : '');

  if (rawUsername && typeof rawUsername === 'string') {
    const firstPart = rawUsername.split(/[._-]/)[0].replace(/[0-9]+$/, '').trim();
    const clean = firstPart || rawUsername.split(/[._-]/)[0].trim();
    if (clean) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }

  return undefined;
}

export const extractFirstName = extractUserName;

interface CurrentUser {
  userId: string;
  email: string | undefined;
  profile: UserProfile | null;
  userMetadata?: Record<string, any>;
  firstName?: string;
  name?: string;
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
    userMetadata: undefined,
    firstName: undefined,
    name: undefined,
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
      const userName = extractUserName(data.user_metadata, data.profile, data.email);
      setState({
        userId: data.id,
        email: data.email,
        profile: data.profile,
        userMetadata: data.user_metadata,
        firstName: userName,
        name: userName,
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
        userMetadata: undefined,
        firstName: undefined,
        name: undefined,
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

