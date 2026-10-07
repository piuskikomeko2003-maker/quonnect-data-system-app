import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

// A vendor books a whole number of tables under one ticket. 1 is the default.
const MIN_TABLES = 1;
const MAX_TABLES = 5;

/**
 * Admin-only update of the `tables` count on a paid vendor registration.
 *
 * This is the enforcement point: the client only *offers* the inline editor to
 * admins, but requireAdmin() rejects non-admins here regardless of the UI.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { registrationId, tables } = body ?? {};

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

    const supabase = createServiceClient();

    // NOTE: No table/slot capacity concept exists in this system yet. If one is
    // introduced later, load the registration's market_day_id and reject the
    // increase here when remaining capacity for that edition is insufficient.

    const { data, error } = await (supabase
      .from('vendor_registrations') as any)
      .update({
        tables: parsed,
        tables_updated_by: auth.user?.id ?? null,
        tables_updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select('id, tables, tables_updated_at')
      .single();

    if (error) {
      // Migration not applied yet — the column does not exist.
      if (error.code === 'PGRST204') {
        return NextResponse.json(
          { error: "Database column 'tables' is missing. Run 'add_vendor_tables.sql' in your Supabase SQL Editor.", tableMissing: true },
          { status: 400 }
        );
      }
      // CHECK constraint fired.
      if (error.code === '23514') {
        return NextResponse.json(
          { error: `Tables must be between ${MIN_TABLES} and ${MAX_TABLES}.` },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, registration: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update tables' },
      { status: 500 }
    );
  }
}
