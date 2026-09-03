import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';

export async function GET() {
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
    .maybeSingle() as { data: { role: string } | null; error: any };

  if (!actorProfile || (actorProfile.role !== 'super_admin' && actorProfile.role !== 'admin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { data: users, error } = await serviceClient
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
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
    .maybeSingle() as { data: { role: string } | null; error: any };

  if (!actorProfile) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { profileId, role } = body;

  if (!profileId || !role) {
    return NextResponse.json({ error: 'profileId and role are required' }, { status: 400 });
  }

  if (!['super_admin', 'admin', 'user'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  if (actorProfile.role !== 'super_admin' && role === 'super_admin') {
    return NextResponse.json({ error: 'Only Super Admins can assign Super Admin role' }, { status: 403 });
  }

  const { data: targetProfile } = await serviceClient
    .from('user_profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle() as { data: { role: string } | null; error: any };

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (targetProfile.role === 'super_admin' && actorProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Cannot change role of a Super Admin' }, { status: 403 });
  }

  const { data: updated, error } = await (serviceClient
    .from('user_profiles') as any)
    .update({ role })
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: updated });
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  const { data: actorProfile } = await serviceClient
    .from('user_profiles')
    .select('role, user_id')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { role: string; user_id: string } | null; error: any };

  if (!actorProfile) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  const { data: targetProfile } = await serviceClient
    .from('user_profiles')
    .select('role, user_id')
    .eq('id', profileId)
    .maybeSingle() as { data: { role: string; user_id: string } | null; error: any };

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (targetProfile.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  if (targetProfile.role === 'super_admin' && actorProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Cannot revoke a Super Admin' }, { status: 403 });
  }

  if (actorProfile.role !== 'super_admin' && actorProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { error: deleteError } = await (serviceClient
    .from('user_profiles') as any)
    .delete()
    .eq('id', profileId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
