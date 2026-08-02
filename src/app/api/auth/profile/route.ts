import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    try {
      const serviceClient = createServiceClient();
      const { data: fallbackProfile, error: fallbackError } = await serviceClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fallbackError || !fallbackProfile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: user.id,
        email: user.email,
        profile: fallbackProfile,
      });
    } catch {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    profile,
  });
}
