import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const dynamic = 'force-dynamic';

const MIN_RATING = 1;
const MAX_RATING = 10;

/**
 * GET /api/vendors/ratings
 * Fetch ratings for an edition and calculate cross-edition averages.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('editionId');
    const vendorId = searchParams.get('vendorId');

    const supabase = createServiceClient();

    // 1. Fetch ratings for the requested edition (or specific vendor)
    let query = supabase.from('vendor_ratings').select('id, vendor_id, edition_id, rating, note, created_at, updated_at');
    if (editionId) {
      query = query.eq('edition_id', editionId);
    }
    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data: editionRatings, error: err } = await query;

    if (err) {
      // If table does not exist yet (pre-migration), degrade gracefully
      if (err.code === 'PGRST204' || err.message?.includes('does not exist')) {
        return NextResponse.json({ ratings: {}, unmigrated: true }, { status: 200 });
      }
      throw err;
    }

    // 2. Fetch cross-edition averages for all rated vendors
    let summaryMap = new Map<string, { avg: number; count: number }>();
    try {
      const { data: viewSummary } = await supabase
        .from('vendor_ratings_summary')
        .select('vendor_id, avg_rating, rated_editions_count');

      if (viewSummary && viewSummary.length > 0) {
        viewSummary.forEach((r: any) => {
          summaryMap.set(r.vendor_id, {
            avg: Number(r.avg_rating),
            count: Number(r.rated_editions_count || 1),
          });
        });
      } else {
        const { data: allRatings } = await supabase
          .from('vendor_ratings')
          .select('vendor_id, rating')
          .not('rating', 'is', null);

        if (allRatings && allRatings.length > 0) {
          const vendorTotals = new Map<string, { sum: number; count: number }>();
          allRatings.forEach((r: any) => {
            if (r.rating !== null && r.rating !== undefined) {
              const cur = vendorTotals.get(r.vendor_id) || { sum: 0, count: 0 };
              cur.sum += Number(r.rating);
              cur.count += 1;
              vendorTotals.set(r.vendor_id, cur);
            }
          });

          vendorTotals.forEach((val, vId) => {
            const avg = Math.round((val.sum / val.count) * 10) / 10;
            summaryMap.set(vId, { avg, count: val.count });
          });
        }
      }
    } catch {
      // Fallback if aggregation fails
    }

    const ratingsMap: Record<string, {
      rating: number | null;
      note: string | null;
      avgRating: number | null;
      ratedEditionsCount: number;
    }> = {};

    (editionRatings || []).forEach((row: any) => {
      const summary = summaryMap.get(row.vendor_id) || { avg: row.rating ? Number(row.rating) : 0, count: row.rating ? 1 : 0 };
      ratingsMap[row.vendor_id] = {
        rating: row.rating !== null ? Number(row.rating) : null,
        note: row.note || null,
        avgRating: summary.count > 0 ? summary.avg : null,
        ratedEditionsCount: summary.count,
      };
    });

    return NextResponse.json({ ratings: ratingsMap });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch vendor ratings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/ratings
 * Admin-only: Set or clear a vendor marketing-power rating for an edition.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { vendorId, editionId, rating, note } = body ?? {};

    if (!vendorId || typeof vendorId !== 'string') {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
    }
    if (!editionId || typeof editionId !== 'string') {
      return NextResponse.json({ error: 'editionId is required' }, { status: 400 });
    }

    // Validate rating
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

    if (parsedRating === null && !sanitizedNote) {
      // Clear rating record
      const { error: delErr } = await supabase
        .from('vendor_ratings')
        .delete()
        .eq('vendor_id', vendorId)
        .eq('edition_id', editionId);

      if (delErr && delErr.code !== 'PGRST204') {
        throw delErr;
      }
    } else {
      // Upsert rating record
      const { error: upsertErr } = await supabase
        .from('vendor_ratings')
        .upsert(
          {
            vendor_id: vendorId,
            edition_id: editionId,
            rating: parsedRating,
            note: sanitizedNote,
            rated_by: auth.user?.id || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'vendor_id,edition_id' }
        );

      if (upsertErr) {
        if (upsertErr.code === 'PGRST204' || upsertErr.message?.includes('does not exist')) {
          return NextResponse.json(
            { error: "Database table 'vendor_ratings' is missing. Please run 'add_vendor_ratings.sql' in your Supabase SQL Editor.", tableMissing: true },
            { status: 400 }
          );
        }
        throw upsertErr;
      }
    }

    // Calculate updated average across all rated editions for this vendor
    const { data: vendorAllRatings } = await supabase
      .from('vendor_ratings')
      .select('rating')
      .eq('vendor_id', vendorId)
      .not('rating', 'is', null);

    let avgRating: number | null = null;
    let ratedEditionsCount = 0;
    if (vendorAllRatings && vendorAllRatings.length > 0) {
      const sum = vendorAllRatings.reduce((acc: number, r: any) => acc + Number(r.rating), 0);
      ratedEditionsCount = vendorAllRatings.length;
      avgRating = Math.round((sum / ratedEditionsCount) * 10) / 10;
    }

    return NextResponse.json({
      success: true,
      vendorId,
      editionId,
      rating: parsedRating,
      note: sanitizedNote,
      avgRating,
      ratedEditionsCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to save vendor rating' },
      { status: 500 }
    );
  }
}
