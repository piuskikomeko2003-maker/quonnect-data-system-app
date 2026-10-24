import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const dynamic = 'force-dynamic';

const MIN_RATING = 0;
const MAX_RATING = 10;

/**
 * POST /api/vendors/ratings/bulk
 * Admin-only: Set marketing-power rating for multiple selected vendors at once.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { vendorIds, editionId, rating, note } = body ?? {};

    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return NextResponse.json({ error: 'vendorIds must be a non-empty array' }, { status: 400 });
    }
    if (!editionId || typeof editionId !== 'string') {
      return NextResponse.json({ error: 'editionId is required' }, { status: 400 });
    }

    let parsedRating: number | null = null;
    if (rating !== null && rating !== undefined && rating !== '') {
      parsedRating = Number(rating);
      if (!Number.isInteger(parsedRating) || parsedRating < MIN_RATING || parsedRating > MAX_RATING) {
        return NextResponse.json(
          { error: `Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}, or null to unrate.` },
          { status: 400 }
        );
      }
    }

    const supabase = createServiceClient();
    const sanitizedNote = typeof note === 'string' ? note.trim() : null;
    const nowIso = new Date().toISOString();

    if (parsedRating === null && !sanitizedNote) {
      // Clear rating records for all selected vendors
      const { error: delErr } = await supabase
        .from('vendor_ratings')
        .delete()
        .in('vendor_id', vendorIds)
        .eq('edition_id', editionId);

      if (delErr && delErr.code !== 'PGRST204') {
        throw delErr;
      }
    } else {
      const rows = vendorIds.map((vId: string) => ({
        vendor_id: vId,
        edition_id: editionId,
        rating: parsedRating,
        note: sanitizedNote,
        rated_by: auth.user?.id || null,
        updated_at: nowIso,
      }));

      const { error: upsertErr } = await supabase
        .from('vendor_ratings')
        .upsert(rows, { onConflict: 'vendor_id,edition_id' });

      if (upsertErr) {
        if (upsertErr.code === 'PGRST204' || upsertErr.message?.includes('does not exist')) {
          return NextResponse.json(
            { error: "Database table 'vendor_ratings' is missing. Please run 'add_vendor_ratings.sql' in your Supabase SQL Editor.", tableMissing: true },
            { status: 400 }
          );
        }
        if (upsertErr.code === '23514') {
          return NextResponse.json(
            {
              error:
                "This database still blocks a 0 rating. Run 'allow_zero_vendor_ratings.sql' in the Supabase SQL editor, then try again.",
              needsZeroMigration: true,
            },
            { status: 400 }
          );
        }
        throw upsertErr;
      }
    }

    return NextResponse.json({
      success: true,
      count: vendorIds.length,
      editionId,
      rating: parsedRating,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to bulk rate vendors' },
      { status: 500 }
    );
  }
}
