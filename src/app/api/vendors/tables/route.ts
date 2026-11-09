import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { MAX_TABLES, MIN_TABLES } from '@/lib/vendorTables';

/**
 * Admin-only update of the table count for a paid vendor.
 *
 * Tables are sold per day on multi-day editions. The body is therefore:
 *   { registrationId, tables, dayId? }
 *
 * `dayId` targets one `vendor_tickets` row (one paid day). When omitted, the
 * request targets the registration's only/first day (legacy single-day call).
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { registrationId, tables, dayId } = body ?? {};

    if (!registrationId || typeof registrationId !== 'string') {
      return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
    }

    const parsed = typeof tables === 'number' ? tables : Number(tables);
    if (!Number.isInteger(parsed)) {
      return NextResponse.json({ error: 'Tables must be a whole number.' }, { status: 400 });
    }
    if (parsed < MIN_TABLES || parsed > MAX_TABLES) {
      return NextResponse.json(
        { error: `Tables must be between ${MIN_TABLES} and ${MAX_TABLES}.` },
        { status: 400 }
      );
    }
    if (dayId != null && (typeof dayId !== 'string' || dayId.length === 0)) {
      return NextResponse.json({ error: 'dayId must be a valid day id' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find the day ticket to update. Without a dayId we fall back to the
    // registration's first owned day so single-day editions keep working.
    let ticketQuery = supabase
      .from('vendor_tickets')
      .select('id, edition_day_id, tables')
      .eq('registration_id', registrationId);
    if (dayId) ticketQuery = ticketQuery.eq('edition_day_id', dayId);

    const { data: tickets, error: ticketError } = await ticketQuery
      .order('created_at', { ascending: true })
      .limit(1);

    if (ticketError) {
      // Migration not applied yet — the table/column does not exist.
      if (ticketError.code === 'PGRST204' || ticketError.code === '42P01') {
        return NextResponse.json(
          {
            error:
              "Database column 'vendor_tickets.tables' is missing. Run 'add_vendor_day_tables.sql' in your Supabase SQL Editor.",
            tableMissing: true,
          },
          { status: 400 }
        );
      }
      throw ticketError;
    }

    const ticket = (tickets || [])[0];
    if (!ticket) {
      if (dayId) {
        return NextResponse.json(
          { error: 'This vendor has no ticket for that day. Add the day ticket first.' },
          { status: 404 }
        );
      }

      // Not-yet-registered vendors (for example CSV imports) have no day
      // tickets yet. Keep the legacy registration-level editor working so an
      // admin can record the table count before the vendor registers.
      const { data: registration, error: regError } = await supabase
        .from('vendor_registrations')
        .update({
          tables: parsed,
          tables_updated_by: auth.user?.id ?? null,
          tables_updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId)
        .select('id, tables, tables_updated_at')
        .maybeSingle();

      if (regError) {
        if (regError.code === '23514') {
          return NextResponse.json(
            { error: `Tables must be between ${MIN_TABLES} and ${MAX_TABLES}.` },
            { status: 400 }
          );
        }
        throw regError;
      }
      if (!registration) {
        return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, ticket: null, registration });
    }

    const { error: updateError } = await supabase
      .from('vendor_tickets')
      .update({ tables: parsed })
      .eq('id', ticket.id);

    if (updateError) {
      if (updateError.code === '23514') {
        return NextResponse.json(
          { error: `Tables must be between ${MIN_TABLES} and ${MAX_TABLES}.` },
          { status: 400 }
        );
      }
      if (updateError.code === 'PGRST204') {
        return NextResponse.json(
          {
            error:
              "Database column 'vendor_tickets.tables' is missing. Run 'add_vendor_day_tables.sql' in your Supabase SQL Editor.",
            tableMissing: true,
          },
          { status: 400 }
        );
      }
      throw updateError;
    }

    // The DB trigger mirrors the first owned day onto the registration. Read it
    // back so the client can stay in sync with that authoritative value.
    const { data: registration } = await supabase
      .from('vendor_registrations')
      .select('id, tables, tables_updated_at')
      .eq('id', registrationId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      ticket: { id: ticket.id, dayId: ticket.edition_day_id, tables: parsed },
      registration,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update tables' },
      { status: 500 }
    );
  }
}
