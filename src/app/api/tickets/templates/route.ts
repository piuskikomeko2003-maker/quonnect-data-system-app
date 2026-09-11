import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { validateTicketFieldPositions, TicketTemplate } from '@/types/ticketTemplate';

async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { role: string } | null; error: unknown };

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  return null;
}

// GET /api/tickets/templates?edition_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('edition_id');

    const supabase = createServiceClient();

    if (editionId) {
      // 1. Try to find edition-specific template
      const { data: editionTemplate, error: edErr } = await supabase
        .from('ticket_templates')
        .select('*')
        .eq('edition_id', editionId)
        .maybeSingle();

      if (editionTemplate) {
        return NextResponse.json({ template: editionTemplate, tableExists: true });
      }

      if (edErr) {
        if (edErr.code === 'PGRST205' || edErr.message?.includes('schema cache')) {
          return NextResponse.json({ template: null, tableExists: false });
        }
        if (edErr.code !== 'PGRST116') {
          console.warn('Error fetching edition template:', edErr);
        }
      }
    }

    // 2. Fallback to default template if none set for this edition
    const { data: defaultTemplate, error: defErr } = await supabase
      .from('ticket_templates')
      .select('*')
      .eq('is_default', true)
      .maybeSingle();

    if (defErr) {
      if (defErr.code === 'PGRST205' || defErr.message?.includes('schema cache')) {
        return NextResponse.json({ template: null, tableExists: false });
      }
      if (defErr.code !== 'PGRST116') {
        console.warn('Error fetching default template:', defErr);
      }
    }

    return NextResponse.json({ template: defaultTemplate || null, tableExists: true });
  } catch (err: any) {
    if (err?.code === 'PGRST205' || err?.message?.includes('schema cache')) {
      return NextResponse.json({ template: null, tableExists: false });
    }
    console.error('Failed to get ticket template:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to retrieve ticket template' },
      { status: 500 }
    );
  }
}

// POST /api/tickets/templates
export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      edition_id,
      background_image_url,
      canvas_width,
      canvas_height,
      field_positions,
      is_default,
    } = body;

    if (!background_image_url) {
      return NextResponse.json(
        { error: 'Background image URL is required.' },
        { status: 400 }
      );
    }

    const width = Number(canvas_width) || 1920;
    const height = Number(canvas_height) || 1080;

    // Strict validation: every required field must be defined
    const validation = validateTicketFieldPositions(field_positions);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `Template is misconfigured: ${validation.errors.join('; ')}`,
          missing: validation.missing,
        },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const payload: Partial<TicketTemplate> = {
      edition_id: edition_id || null,
      is_default: !!is_default,
      background_image_url,
      canvas_width: width,
      canvas_height: height,
      field_positions,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (edition_id) {
      const { data, error } = await supabase
        .from('ticket_templates')
        .upsert(payload, { onConflict: 'edition_id' })
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('ticket_templates')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, template: result });
  } catch (err: any) {
    if (err?.code === 'PGRST205' || err?.message?.includes('schema cache')) {
      return NextResponse.json(
        {
          error:
            "Database table 'ticket_templates' does not exist yet. Please run 'quonnect-data-system-app/supabase/migrations/add_ticket_templates.sql' in your Supabase SQL Editor.",
          tableMissing: true,
        },
        { status: 400 }
      );
    }
    console.error('Failed to save ticket template:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save ticket template' },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/templates?edition_id=...
export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('edition_id');
    const templateId = searchParams.get('id');

    if (!editionId && !templateId) {
      return NextResponse.json(
        { error: 'edition_id or id is required to delete a template' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    let query = supabase.from('ticket_templates').delete();

    if (editionId) {
      query = query.eq('edition_id', editionId);
    } else if (templateId) {
      query = query.eq('id', templateId);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Template removed successfully' });
  } catch (err: any) {
    console.error('Failed to delete ticket template:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to delete ticket template' },
      { status: 500 }
    );
  }
}
