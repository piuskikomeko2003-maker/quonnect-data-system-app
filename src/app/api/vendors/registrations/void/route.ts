import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const runtime = 'nodejs';

interface AuditRow {
  id: string;
  registration_id: string;
  market_day_id: string | null;
  vendor_id: string | null;
  action: 'voided' | 'restored';
  reason: string | null;
  performed_by: string | null;
  ticket_numbers: Array<{
    ticket_number: number | null;
    ticket_code: string | null;
    edition_day_id: string | null;
  }> | null;
  created_at: string;
}

/**
 * Admin or super admin. Voids a paid registration instead of deleting it.
 *
 * The registration keeps its ticket numbers so counters and gap reports stay
 * explainable. Voided rows are excluded from paid/sticker lists because their
 * payment_status becomes 'voided'. The database trigger writes the audit row.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const registrationId = body?.registration_id;
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

    if (!registrationId || typeof registrationId !== 'string') {
      return NextResponse.json({ error: 'registration_id is required.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('void_vendor_registration', {
      p_registration_id: registrationId,
      p_reason: reason,
      p_performed_by: auth.user?.id ?? null,
    });

    if (error) {
      const message = error.message || '';
      if (
        error.code === 'PGRST202' ||
        /could not find the function|does not exist/i.test(message)
      ) {
        return NextResponse.json(
          {
            error:
              "Voiding is not installed yet. Run 'supabase/migrations/add_vendor_registration_voiding.sql' in the Supabase SQL editor, then retry.",
            migrationRequired: true,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, result: data });
  } catch (err: any) {
    console.error('Failed to void vendor registration:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to void vendor registration' },
      { status: 500 }
    );
  }
}

/**
 * Admin or super admin. Recent void/restore history, newest first. Used by the
 * audit panel so "missing" ticket numbers always have a visible explanation.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('market_day_id');
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam)
      ? Math.min(200, Math.max(1, Math.trunc(limitParam)))
      : 50;

    const supabase = createServiceClient();
    let query = supabase
      .from('vendor_registration_audit')
      .select(
        'id, registration_id, market_day_id, vendor_id, action, reason, performed_by, ticket_numbers, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (editionId) query = query.eq('market_day_id', editionId);

    const { data, error } = await query;
    if (error) {
      if (
        error.code === 'PGRST205' ||
        /could not find the table|does not exist/i.test(error.message || '')
      ) {
        return NextResponse.json({ audit: [], migrationRequired: true });
      }
      throw error;
    }

    const rows = (data || []) as AuditRow[];
    const vendorIds = [...new Set(rows.map((row) => row.vendor_id).filter(Boolean))] as string[];
    const vendorNames = new Map<string, string>();
    if (vendorIds.length > 0) {
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, business_name, contact_name')
        .in('id', vendorIds);
      for (const vendor of vendors || []) {
        vendorNames.set(
          vendor.id,
          vendor.business_name || vendor.contact_name || 'Unknown vendor'
        );
      }
    }

    return NextResponse.json({
      audit: rows.map((row) => ({
        ...row,
        vendor_name: row.vendor_id ? vendorNames.get(row.vendor_id) || null : null,
      })),
    });
  } catch (err: any) {
    console.error('Failed to load vendor registration audit:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load audit log' },
      { status: 500 }
    );
  }
}
