import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    let { data: profile } = await serviceClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Self-heal: if the signup trigger ever failed to create a profile,
    // create one in Pending Approval so the account is visible to admins.
    if (!profile) {
      const { data: created } = await (serviceClient
        .from('user_profiles') as any)
        .insert({ user_id: user.id, email: user.email ?? '', role: 'unassigned' })
        .select()
        .single();
      profile = created ?? null;
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      profile: profile || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
