import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { fetchStickerVendors } from '@/lib/stickers/server';
import { computeProgress, sortVendorsByTicket } from '@/lib/stickers/layout';

export const runtime = 'nodejs';

/**
 * Admin or super admin. Returns the paid vendors for an edition plus overall
 * sticker progress (needed / printed / remaining), used by the print screen.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const marketDayId = searchParams.get('market_day_id');
    const editionDayId = searchParams.get('edition_day_id');
    if (!marketDayId) {
      return NextResponse.json({ error: 'market_day_id is required.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const vendors = await fetchStickerVendors(supabase, marketDayId, editionDayId || null);

    return NextResponse.json({
      progress: computeProgress(vendors),
      vendors: sortVendorsByTicket(vendors),
    });
  } catch (err: any) {
    console.error('Failed to load sticker vendors:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load sticker vendors' }, { status: 500 });
  }
}
