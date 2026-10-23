import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSuperAdmin } from '@/lib/auth/requireAdmin';
import { STICKER_ASSETS_BUCKET, getStickerTemplate } from '@/lib/stickers/server';
import { renderStickerPdf, type StickerPdfImage } from '@/lib/stickers/pdf';
import type { StickerBatchItem, StickerNeed } from '@/types/sticker';

export const runtime = 'nodejs';

/**
 * Super-admin only. Renders the PDF for an existing batch. Reproducing from the
 * stored batch means the same sheet can be generated again (e.g. after a jam)
 * without touching any printed counts.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');
    if (!batchId) {
      return NextResponse.json({ error: 'batch_id is required.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: batch, error } = await supabase
      .from('sticker_print_batches')
      .select('id, kind, items, start_position, template_id, market_day_id')
      .eq('id', batchId)
      .maybeSingle();
    if (error) throw error;
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    }

    const batchRow = batch as { template_id?: string | null; market_day_id?: string | null };
    const template = await getStickerTemplate(
      supabase,
      batchRow.template_id || null,
      batchRow.market_day_id || null
    );
    if (!template) {
      return NextResponse.json({ error: 'No sticker template available.' }, { status: 400 });
    }

    // Pull the private design image so it can be tiled into every slot.
    let image: StickerPdfImage | null = null;
    if (template.image_path) {
      const { data: file, error: downloadError } = await supabase.storage
        .from(STICKER_ASSETS_BUCKET)
        .download(template.image_path);
      if (!downloadError && file) {
        const mime = (file.type || '').toLowerCase();
        image = {
          bytes: new Uint8Array(await file.arrayBuffer()),
          type: mime.includes('jpeg') || mime.includes('jpg') ? 'jpeg' : 'png',
        };
      }
    }

    const items = (batch.items || []) as StickerBatchItem[];
    const registrationIds = [...new Set(items.map((i) => i.registration_id).filter(Boolean))];

    const { data: regs, error: regError } = await supabase
      .from('vendor_registrations')
      .select('id, vendor_id, ticket_number, stall_number, vendors ( business_name, contact_name )')
      .in('id', registrationIds.length ? registrationIds : ['00000000-0000-0000-0000-000000000000']);
    if (regError) throw regError;

    const regMap = new Map<string, any>((regs || []).map((r: any) => [r.id, r]));

    const stickers: StickerNeed[] = [];
    for (const item of items) {
      const reg = regMap.get(item.registration_id);
      const ticket = Number.isFinite(Number(reg?.ticket_number))
        ? Number(reg?.ticket_number)
        : Number(String(reg?.stall_number || '').match(/\d+/)?.[0] ?? NaN);
      for (const tableNumber of item.table_numbers || []) {
        stickers.push({
          registration_id: item.registration_id,
          vendor_id: reg?.vendor_id || '',
          business_name: reg?.vendors?.business_name || reg?.vendors?.contact_name || 'Unknown vendor',
          ticket_number: Number.isFinite(ticket) ? ticket : null,
          table_number: tableNumber,
        });
      }
    }

    const bytes = await renderStickerPdf({
      template,
      stickers,
      startPosition: Math.max(1, Number(batch.start_position) || 1),
      image,
    });

    const filename = `stickers-${batch.kind}-${String(batch.id).slice(0, 8)}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Failed to render sticker batch PDF:', err);
    return NextResponse.json({ error: err?.message || 'Failed to render PDF' }, { status: 500 });
  }
}
