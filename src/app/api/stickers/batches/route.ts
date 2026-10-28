import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { fetchStickerVendors, getStickerTemplate } from '@/lib/stickers/server';
import { selectBatch } from '@/lib/stickers/layout';

export const runtime = 'nodejs';

const DEFAULT_SLOTS_PER_PAGE = 30;

/** Admin or super admin. Lists recent batches so a fresh one can be confirmed. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const marketDayId = searchParams.get('market_day_id');
    const editionDayId = searchParams.get('edition_day_id');

    const supabase = createServiceClient();
    let query = supabase
      .from('sticker_print_batches')
      .select('id, market_day_id, edition_day_id, kind, sticker_count, start_position, items, created_at, confirmed_at, confirmed_by')
      .order('created_at', { ascending: false })
      .limit(20);
    if (marketDayId) query = query.eq('market_day_id', marketDayId);
    if (editionDayId) query = query.eq('edition_day_id', editionDayId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ batches: data || [] });
  } catch (err: any) {
    console.error('Failed to list sticker batches:', err);
    return NextResponse.json({ error: err?.message || 'Failed to list batches' }, { status: 500 });
  }
}

/**
 * Admin or super admin. Creates a batch and returns its id.
 *
 * Two modes:
 *  - Print:   { market_day_id, mode: 'all' | 'count', count?, start_position? }
 *  - Reprint: { kind: 'reprint', registration_id, table_numbers: number[] }
 *
 * Creating a batch does NOT mark anything printed. The counts only move once the
 * batch is confirmed (see /api/stickers/batches/confirm).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createServiceClient();

    if (body?.kind === 'reprint') {
      return createReprintBatch(supabase, auth.user?.id ?? null, body);
    }

    const { market_day_id, edition_day_id, mode, count, start_position } = body ?? {};
    if (!market_day_id || typeof market_day_id !== 'string') {
      return NextResponse.json({ error: 'market_day_id is required.' }, { status: 400 });
    }

    const vendors = await fetchStickerVendors(supabase, market_day_id, edition_day_id || null);
    const template = await getStickerTemplate(
      supabase,
      null,
      market_day_id,
      edition_day_id || null
    );
    const slotsPerPage = template ? Math.max(1, template.columns * template.rows) : DEFAULT_SLOTS_PER_PAGE;

    const isAll = mode === 'all';
    const requestedCount = Number(count);
    if (!isAll && (!Number.isInteger(requestedCount) || requestedCount < 1)) {
      return NextResponse.json({ error: 'count must be a whole number of at least 1.' }, { status: 400 });
    }
    const startPosition = Number.isInteger(Number(start_position)) && Number(start_position) >= 1
      ? Number(start_position)
      : 1;

    const selection = selectBatch(vendors, slotsPerPage, {
      mode: isAll ? 'all' : 'count',
      count: isAll ? undefined : requestedCount,
      startPosition,
    });

    if (selection.stickerCount === 0) {
      return NextResponse.json({ error: 'No unprinted stickers remain for this edition.' }, { status: 400 });
    }

    const { data: batch, error } = await supabase
      .from('sticker_print_batches')
      .insert({
        market_day_id,
        edition_day_id: edition_day_id || null,
        kind: 'print',
        sticker_count: selection.stickerCount,
        start_position: selection.startPosition,
        template_id: template?.id ?? null,
        items: selection.items,
        created_by: auth.user?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      batch,
      selection: {
        stickerCount: selection.stickerCount,
        pages: selection.pages,
        emptySlots: selection.emptySlots,
        slotsPerPage: selection.slotsPerPage,
        startPosition: selection.startPosition,
        items: selection.items,
      },
    });
  } catch (err: any) {
    console.error('Failed to create sticker batch:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create batch' }, { status: 500 });
  }
}

async function createReprintBatch(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string | null,
  body: any
) {
  const registrationId = body?.registration_id;
  const editionDayId = body?.edition_day_id || null;
  const ticketId = body?.ticket_id || null;
  const tableNumbers = Array.isArray(body?.table_numbers) ? body.table_numbers : [];

  if (!registrationId || typeof registrationId !== 'string') {
    return NextResponse.json({ error: 'registration_id is required.' }, { status: 400 });
  }

  const { data: reg, error: regError } = await supabase
    .from('vendor_registrations')
    .select('id, market_day_id, tables')
    .eq('id', registrationId)
    .maybeSingle();
  if (regError) throw regError;
  if (!reg) {
    return NextResponse.json({ error: 'Vendor registration not found.' }, { status: 404 });
  }

  let resolvedDayId: string | null = editionDayId;
  if (ticketId) {
    const { data: ticket } = await supabase
      .from('vendor_tickets')
      .select('id, edition_day_id, registration_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket || ticket.registration_id !== registrationId) {
      return NextResponse.json({ error: 'Ticket not found for this registration.' }, { status: 404 });
    }
    resolvedDayId = ticket.edition_day_id;
  }

  const tables = Math.max(1, Number(reg.tables) || 1);
  const cleaned: number[] = tableNumbers
    .map((n: any) => Number(n))
    .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= tables);
  const valid = [...new Set(cleaned)].sort((a: number, b: number) => a - b);

  if (valid.length === 0) {
    return NextResponse.json(
      { error: `Select at least one table between 1 and ${tables}.` },
      { status: 400 }
    );
  }

  const template = await getStickerTemplate(
    supabase,
    null,
    reg.market_day_id,
    resolvedDayId
  );

  const { data: batch, error } = await supabase
    .from('sticker_print_batches')
    .insert({
      market_day_id: reg.market_day_id,
      edition_day_id: resolvedDayId,
      kind: 'reprint',
      sticker_count: valid.length,
      start_position: 1,
      template_id: template?.id ?? null,
      items: [{
        registration_id: registrationId,
        ticket_id: ticketId,
        edition_day_id: resolvedDayId,
        table_numbers: valid,
      }],
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({ success: true, batch });
}
