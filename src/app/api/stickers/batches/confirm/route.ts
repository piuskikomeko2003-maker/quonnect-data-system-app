import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import type { StickerBatchItem } from '@/types/sticker';

export const runtime = 'nodejs';

/**
 * Admin or super admin. Confirms a batch was printed.
 *
 * This is the only place `stickers_printed` moves. It runs after the sheet comes
 * out correctly, so a jam or bad print can be regenerated instead of wrongly
 * marking stickers as done. It is idempotent: confirming twice is a no-op.
 * Reprint batches are logged but never change the counts.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const batchId = body?.batch_id;
    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json({ error: 'batch_id is required.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: batch, error } = await supabase
      .from('sticker_print_batches')
      .select('id, kind, items, confirmed_at')
      .eq('id', batchId)
      .maybeSingle();
    if (error) throw error;
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    }
    if (batch.confirmed_at) {
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }

    let updated = 0;
    if (batch.kind === 'print') {
      const items = (batch.items || []) as StickerBatchItem[];
      for (const item of items) {
        const { data: reg } = await supabase
          .from('vendor_registrations')
          .select('id, tables, stickers_printed')
          .eq('id', item.registration_id)
          .maybeSingle();
        if (!reg) continue;

        const tables = Math.max(1, Number(reg.tables) || 1);
        const printed = Math.max(0, Number(reg.stickers_printed) || 0);
        const next = Math.min(tables, printed + (item.table_numbers?.length || 0));
        if (next !== printed) {
          const { error: updateError } = await supabase
            .from('vendor_registrations')
            // The DB trigger allows this because it runs as the service role.
            .update({ stickers_printed: next })
            .eq('id', item.registration_id);
          if (updateError) throw updateError;
          updated++;
        }
      }
    }

    // Guarded update: only the first confirm wins, so counts can't double-apply.
    const { data: confirmed, error: confirmError } = await supabase
      .from('sticker_print_batches')
      .update({ confirmed_at: new Date().toISOString(), confirmed_by: auth.user?.id ?? null })
      .eq('id', batchId)
      .is('confirmed_at', null)
      .select()
      .maybeSingle();
    if (confirmError) throw confirmError;

    return NextResponse.json({ success: true, updatedVendors: updated, batch: confirmed || batch });
  } catch (err: any) {
    console.error('Failed to confirm sticker batch:', err);
    return NextResponse.json({ error: err?.message || 'Failed to confirm batch' }, { status: 500 });
  }
}
