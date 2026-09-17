import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface AdminAuthResult {
  user?: any;
  profile?: any;
  response?: NextResponse;
}

export async function requireAdmin(): Promise<AdminAuthResult> {
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

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
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
