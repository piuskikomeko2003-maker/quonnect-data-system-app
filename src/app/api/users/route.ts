import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';
import { REGION_SECTION_IDS } from '@/lib/auth/permissions';

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

  // Fetch auth users to get exact last_sign_in_at timestamps
  const { data: authData } = await serviceClient.auth.admin.listUsers();
  const authMap = new Map((authData?.users || []).map(u => [u.id, u]));

  const enrichedUsers = (users || []).map((u: any) => {
    const authRecord = authMap.get(u.user_id);
    return {
      ...u,
      last_sign_in_at: authRecord?.last_sign_in_at || null,
      auth_created_at: authRecord?.created_at || u.created_at,
    };
  });

  return NextResponse.json({ users: enrichedUsers });
}

/**
 * POST /api/users
 * Directly creates a staff account from User Management (email + password +
 * role + optional region/section access). The account is email-confirmed and
 * can sign in immediately — no signup link or approval step required.
 */
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
      .maybeSingle() as { data: { role: string } | null; error: any };

    if (!actorProfile || (actorProfile.role !== 'super_admin' && actorProfile.role !== 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = body.role as string | undefined;
    const managedRegionId = body.managed_region_id as string | null | undefined;
    const rawPermissions = body.section_permissions;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }
    if (!role || !['super_admin', 'admin', 'regional_manager', 'user', 'unassigned'].includes(role)) {
      return NextResponse.json({ error: 'A valid role is required' }, { status: 400 });
    }
    if (role === 'super_admin' && actorProfile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only Super Admins can create Super Admin accounts' },
        { status: 403 }
      );
    }

    let regionId: string | null = null;
    if (role === 'regional_manager') {
      if (!managedRegionId) {
        return NextResponse.json(
          { error: 'Select a region for the Regional Manager' },
          { status: 400 }
        );
      }
      const { data: region } = await serviceClient
        .from('regions')
        .select('id')
        .eq('id', managedRegionId)
        .maybeSingle();
      if (!region) {
        return NextResponse.json({ error: 'Selected region does not exist' }, { status: 400 });
      }
      regionId = managedRegionId;
    }

    const permissions: Record<string, 'view' | 'manage'> = {};
    if (role === 'regional_manager' && rawPermissions && typeof rawPermissions === 'object') {
      for (const [key, value] of Object.entries(rawPermissions)) {
        if (!REGION_SECTION_IDS.includes(key as any)) continue;
        if (value !== 'view' && value !== 'manage') continue;
        permissions[key] = value;
      }
    }

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { created_by_admin: true },
    });

    if (createError) {
      const message = createError.message || 'Failed to create account';
      const status = /already|exists|registered/i.test(message) ? 409 : 400;
      return NextResponse.json(
        {
          error:
            status === 409
              ? `An account already exists for ${email}. Use the role/access controls instead.`
              : message,
        },
        { status }
      );
    }

    const newUser = created.user;
    if (!newUser) {
      return NextResponse.json(
        { error: 'Supabase created no user record. Please try again.' },
        { status: 500 }
      );
    }

    // The signup trigger normally creates an `unassigned` profile. Upsert the
    // final role/region/permissions so the account works on first login.
    const { data: existingProfile } = await serviceClient
      .from('user_profiles')
      .select('id')
      .eq('user_id', newUser.id)
      .maybeSingle() as { data: { id: string } | null; error: any };

    const profilePayload = {
      user_id: newUser.id,
      email,
      role,
      managed_region_id: regionId,
      section_permissions: permissions,
      updated_at: new Date().toISOString(),
    };

    const profileMutation = existingProfile
      ? serviceClient.from('user_profiles').update(profilePayload).eq('id', existingProfile.id)
      : serviceClient.from('user_profiles').insert(profilePayload);

    const { data: profile, error: profileError } = await (profileMutation as any)
      .select()
      .single();

    if (profileError) {
      // Roll back the auth account so an admin can retry cleanly rather than
      // leaving an account that can log in with no usable profile.
      await serviceClient.auth.admin.deleteUser(newUser.id).catch(() => undefined);
      const missingColumns =
        profileError.code === 'PGRST204' ||
        /schema cache|managed_region_id|section_permissions/i.test(profileError.message || '');
      return NextResponse.json(
        {
          error: missingColumns
            ? 'Database is missing the Regional Manager columns. Run supabase/migrations/add_regional_manager_access.sql (and the role migration before it), then try again.'
            : `Account profile could not be saved: ${profileError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: { ...profile, last_sign_in_at: null, auth_created_at: newUser.created_at },
      credentials: { email },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create account' },
      { status: 500 }
    );
  }
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

  if (actorProfile.role !== 'super_admin' && actorProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { profileId } = body;
  const role = body.role as string | undefined;
  const hasRegionUpdate = Object.prototype.hasOwnProperty.call(body, 'managed_region_id');
  const hasPermissionUpdate = Object.prototype.hasOwnProperty.call(body, 'section_permissions');

  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  if (role && !['super_admin', 'admin', 'regional_manager', 'user', 'unassigned'].includes(role)) {
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

  const nextRole = role || targetProfile.role;
  const updates: Record<string, any> = {};

  if (role) updates.role = role;

  if (nextRole === 'regional_manager') {
    if (hasRegionUpdate) {
      const regionId = body.managed_region_id;
      if (regionId === null || regionId === '') {
        updates.managed_region_id = null;
      } else {
        const { data: region } = await serviceClient
          .from('regions')
          .select('id')
          .eq('id', regionId)
          .maybeSingle();
        if (!region) {
          return NextResponse.json({ error: 'Selected region does not exist' }, { status: 400 });
        }
        updates.managed_region_id = regionId;
      }
    }

    if (hasPermissionUpdate) {
      const raw = body.section_permissions;
      if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
        return NextResponse.json({ error: 'section_permissions must be an object' }, { status: 400 });
      }
      const sanitized: Record<string, 'view' | 'manage'> = {};
      for (const [key, value] of Object.entries(raw || {})) {
        if (!REGION_SECTION_IDS.includes(key as any)) continue;
        if (value !== 'view' && value !== 'manage') continue;
        sanitized[key] = value;
      }
      updates.section_permissions = sanitized;
    }
  } else if (role) {
    // Leaving the regional manager role revokes region + section access.
    updates.managed_region_id = null;
    updates.section_permissions = {};
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await (serviceClient
    .from('user_profiles') as any)
    .update(updates)
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
