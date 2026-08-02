import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    const { data: actorProfile } = await serviceClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!actorProfile || (actorProfile.role !== 'super_admin' && actorProfile.role !== 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocal = process.env.NODE_ENV === 'development';
    const origin = isLocal
      ? request.nextUrl.origin
      : `https://${forwardedHost || request.nextUrl.host}`;
    const redirectTo = `${origin}/auth/callback`;

    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { invited: true },
    });

    if (inviteError) {
      return NextResponse.json(
        { error: `Failed to invite ${email}: ${inviteError.message}` },
        { status: 500 },
      );
    }

    if (!inviteData?.user) {
      return NextResponse.json(
        { error: `Invite for ${email} returned no user record — Supabase may have silently failed. Check Auth → Email settings.` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Unexpected error inviting user: ${message}` },
      { status: 500 },
    );
  }
}
