import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface AdminAuthResult {
  user?: any;
  profile?: any;
  response?: NextResponse;
}

/**
 * Resolves the authenticated user + their profile. Returns a NextResponse on
 * any failure (401 not authenticated / 500 unexpected) so callers can early-return.
 */
async function loadAuthProfile(): Promise<AdminAuthResult> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
      };
    }

    const serviceClient = createServiceClient();
    const { data: profile } = await (serviceClient
      .from('user_profiles')
      .select('id, user_id, email, role')
      .eq('user_id', user.id)
      .maybeSingle() as any);

    if (!profile) {
      return {
        response: NextResponse.json(
          { error: 'Insufficient permissions. Admin role required.' },
          { status: 403 }
        ),
      };
    }

    return { user, profile };
  } catch (err: any) {
    return {
      response: NextResponse.json(
        { error: err?.message || 'Authentication error' },
        { status: 500 }
      ),
    };
  }
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const result = await loadAuthProfile();
  if (result.response) return result;

  if (result.profile?.role !== 'admin' && result.profile?.role !== 'super_admin') {
    return {
      response: NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      ),
    };
  }

  return result;
}

/**
 * Super-admin-only gate. Every page, API route and server action in the sticker
 * printing feature must call this before doing any work, so that regular admins
 * are rejected on the server even if they reach the endpoint directly.
 */
export async function requireSuperAdmin(): Promise<AdminAuthResult> {
  const result = await loadAuthProfile();
  if (result.response) return result;

  if (result.profile?.role !== 'super_admin') {
    return {
      response: NextResponse.json(
        { error: 'Insufficient permissions. Super admin role required.' },
        { status: 403 }
      ),
    };
  }

  return result;
}
