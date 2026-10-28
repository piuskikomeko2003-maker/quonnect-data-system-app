import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin, requireApprovedUser } from '@/lib/auth/requireAdmin';

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * POST /api/vendors/tickets
 *
 * Body variants:
 *   { action: 'add-days', registrationId, dayIds: string[] }
 *   { action: 'check-in', ticketId, checkIn: boolean }
 *
 * Admins add paid days to an existing registration. Any approved user may
 * check a ticket in for any day of the edition at any time.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'check-in') {
      const auth = await requireApprovedUser();
      if (auth.response) return auth.response;

      if (!isUuid(body?.ticketId)) {
        return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
      }

      const supabase = createServiceClient();
      const { data, error } = await supabase.rpc('check_in_vendor_ticket', {
        p_ticket_id: body.ticketId,
        p_check_in: body?.checkIn !== false,
      });

      if (error) {
        const message = error.message || 'Failed to update ticket entry';
        const status = /permission/i.test(message) ? 403 : /valid on|not found/i.test(message) ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
      }

      const row = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ success: true, ticket: row });
    }

    if (action === 'add-days') {
      const auth = await requireAdmin();
      if (auth.response) return auth.response;

      if (!isUuid(body?.registrationId)) {
        return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
      }
      const dayIds: string[] = Array.isArray(body?.dayIds)
        ? Array.from(new Set(body.dayIds.filter(isUuid)))
        : [];
      if (dayIds.length === 0) {
        return NextResponse.json({ error: 'Choose at least one day' }, { status: 400 });
      }

      const supabase = createServiceClient();
      const { data, error } = await supabase.rpc('add_vendor_day_tickets', {
        p_registration_id: body.registrationId,
        p_day_ids: dayIds,
      });

      if (error) {
        const message = error.message || 'Failed to add day tickets';
        const status = /permission/i.test(message) ? 403 : /not found|required|valid/i.test(message) ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
      }

      const result = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update tickets' },
      { status: 500 }
    );
  }
}
