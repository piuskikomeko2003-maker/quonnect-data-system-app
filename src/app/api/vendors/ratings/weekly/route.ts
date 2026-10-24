import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { isIsoDate, mondayOf } from '@/lib/ratingWeeks';

export const dynamic = 'force-dynamic';

const MIN_RATING = 0;
const MAX_RATING = 10;

type WeeklyRatingEntry = {
  vendorId: string;
  rating: number | null;
  note: string | null;
};

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

type ErrorLike = { code?: string; message?: string };

function isMissingTable(error: unknown): boolean {
  const candidate = error as ErrorLike | null;
  return (
    candidate?.code === 'PGRST204' ||
    candidate?.code === 'PGRST205' ||
    candidate?.code === '42P01' ||
    Boolean(candidate?.message?.includes('does not exist'))
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

type WeeklyRow = { vendor_id: string; rating: number | null; note: string | null };

function normalizeWeekStart(value: unknown): string | null {
  if (typeof value !== 'string' || !isIsoDate(value)) return null;
  return mondayOf(value);
}

function parseRating(value: unknown): { ok: true; rating: number | null } | { ok: false } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, rating: null };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_RATING || parsed > MAX_RATING) {
    return { ok: false };
  }
  return { ok: true, rating: parsed };
}

/**
 * Keep the edition-level `vendor_ratings` row in sync with the latest weekly
 * score. This means the main Vendors table / export keeps showing the current
 * marketing-power score while weekly history lives in its own table.
 */
async function syncEditionRatings(
  supabase: SupabaseServiceClient,
  editionId: string,
  vendorIds: string[],
  ratedBy: string | null
) {
  if (vendorIds.length === 0) return;

  const { data: weeklyRows, error } = await supabase
    .from('vendor_weekly_ratings')
    .select('vendor_id, rating, note, week_start')
    .eq('edition_id', editionId)
    .in('vendor_id', vendorIds)
    .order('week_start', { ascending: false });

  if (error) {
    // Weekly table missing / not migrated: nothing to sync.
    if (isMissingTable(error)) return;
    throw error;
  }

  const latestByVendor = new Map<string, { rating: number; note: string | null }>();
  ((weeklyRows || []) as WeeklyRow[]).forEach((row) => {
    if (!latestByVendor.has(row.vendor_id) && row.rating !== null) {
      latestByVendor.set(row.vendor_id, { rating: Number(row.rating), note: row.note || null });
    }
  });

  const upserts = vendorIds
    .filter((vendorId) => latestByVendor.has(vendorId))
    .map((vendorId) => {
      const latest = latestByVendor.get(vendorId)!;
      return {
        vendor_id: vendorId,
        edition_id: editionId,
        rating: latest.rating,
        note: latest.note,
        rated_by: ratedBy,
        updated_at: new Date().toISOString(),
      };
    });

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from('vendor_ratings')
      .upsert(upserts, { onConflict: 'vendor_id,edition_id' });

    if (upsertError && !isMissingTable(upsertError)) throw upsertError;
  }

  const clearedVendorIds = vendorIds.filter((vendorId) => !latestByVendor.has(vendorId));
  if (clearedVendorIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('vendor_ratings')
      .delete()
      .eq('edition_id', editionId)
      .in('vendor_id', clearedVendorIds);

    if (deleteError && !isMissingTable(deleteError)) throw deleteError;
  }
}

/**
 * GET /api/vendors/ratings/weekly?editionId=...
 * Returns every weekly score for an edition, grouped by vendor then week.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('editionId');

    if (!editionId) {
      return NextResponse.json({ error: 'editionId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('vendor_weekly_ratings')
      .select('vendor_id, week_start, rating, note, updated_at')
      .eq('edition_id', editionId)
      .order('week_start', { ascending: true });

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ ratings: {}, unmigrated: true }, { status: 200 });
      }
      throw error;
    }

    const ratings: Record<string, Record<string, { rating: number; note: string | null; updatedAt: string | null }>> = {};
    const weekStarts = new Set<string>();

    type WeeklyRowWithMeta = WeeklyRow & { week_start: string; updated_at: string | null };
    ((data || []) as WeeklyRowWithMeta[]).forEach((row) => {
      const weekStart = String(row.week_start).slice(0, 10);
      weekStarts.add(weekStart);
      if (!ratings[row.vendor_id]) ratings[row.vendor_id] = {};
      ratings[row.vendor_id][weekStart] = {
        rating: Number(row.rating),
        note: row.note || null,
        updatedAt: row.updated_at || null,
      };
    });

    return NextResponse.json({ ratings, weeksWithData: Array.from(weekStarts) });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: errorMessage(err, 'Failed to fetch weekly vendor ratings') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/ratings/weekly
 * Admin-only. Accepts:
 *   - single:  { vendorId, editionId, weekStart, rating, note }
 *   - bulk:    { vendorIds: string[], editionId, weekStart, rating, note }
 *   - entries: { entries: [{ vendorId, rating, note }], editionId, weekStart }
 * A null rating clears that vendor's score for the week.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const editionId = body?.editionId;
    const weekStart = normalizeWeekStart(body?.weekStart);

    if (!editionId || typeof editionId !== 'string') {
      return NextResponse.json({ error: 'editionId is required' }, { status: 400 });
    }
    if (!weekStart) {
      return NextResponse.json(
        { error: 'weekStart is required and must be a valid YYYY-MM-DD date' },
        { status: 400 }
      );
    }

    const entries: WeeklyRatingEntry[] = [];

    if (Array.isArray(body?.entries) && body.entries.length > 0) {
      for (const entry of body.entries) {
        const vendorId = entry?.vendorId;
        if (!vendorId || typeof vendorId !== 'string') {
          return NextResponse.json({ error: 'Each entry needs a vendorId' }, { status: 400 });
        }
        const parsed = parseRating(entry?.rating);
        if (!parsed.ok) {
          return NextResponse.json(
            { error: `Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}, or null to clear.` },
            { status: 400 }
          );
        }
        entries.push({
          vendorId,
          rating: parsed.rating,
          note: typeof entry?.note === 'string' ? entry.note.trim().slice(0, 300) : null,
        });
      }
    } else if (Array.isArray(body?.vendorIds) && body.vendorIds.length > 0) {
      const parsed = parseRating(body?.rating);
      if (!parsed.ok) {
        return NextResponse.json(
          { error: `Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}, or null to clear.` },
          { status: 400 }
        );
      }
      const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : null;
      body.vendorIds.forEach((vendorId: unknown) => {
        if (typeof vendorId === 'string' && vendorId) {
          entries.push({ vendorId, rating: parsed.rating, note });
        }
      });
    } else if (typeof body?.vendorId === 'string' && body.vendorId) {
      const parsed = parseRating(body?.rating);
      if (!parsed.ok) {
        return NextResponse.json(
          { error: `Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}, or null to clear.` },
          { status: 400 }
        );
      }
      entries.push({
        vendorId: body.vendorId,
        rating: parsed.rating,
        note: typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : null,
      });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No vendors to rate. Provide vendorId, vendorIds or entries.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();
    const ratedBy = auth.user?.id || null;

    const toClear = entries.filter((entry) => entry.rating === null).map((entry) => entry.vendorId);
    const toSave = entries.filter(
      (entry): entry is WeeklyRatingEntry & { rating: number } => entry.rating !== null
    );

    if (toClear.length > 0) {
      const { error: deleteError } = await supabase
        .from('vendor_weekly_ratings')
        .delete()
        .eq('edition_id', editionId)
        .eq('week_start', weekStart)
        .in('vendor_id', toClear);

      if (deleteError) {
        if (isMissingTable(deleteError)) {
          return NextResponse.json(
            {
              error: "Table 'vendor_weekly_ratings' is missing. Run 'add_vendor_weekly_ratings.sql' in Supabase.",
              tableMissing: true,
            },
            { status: 400 }
          );
        }
        throw deleteError;
      }
    }

    if (toSave.length > 0) {
      const rows = toSave.map((entry) => ({
        vendor_id: entry.vendorId,
        edition_id: editionId,
        week_start: weekStart,
        rating: entry.rating,
        note: entry.note,
        rated_by: ratedBy,
        updated_at: nowIso,
      }));

      const { error: upsertError } = await supabase
        .from('vendor_weekly_ratings')
        .upsert(rows, { onConflict: 'vendor_id,edition_id,week_start' });

      if (upsertError) {
        if (isMissingTable(upsertError)) {
          return NextResponse.json(
            {
              error: "Table 'vendor_weekly_ratings' is missing. Run 'add_vendor_weekly_ratings.sql' in Supabase.",
              tableMissing: true,
            },
            { status: 400 }
          );
        }
        if ((upsertError as ErrorLike).code === '23514') {
          return NextResponse.json(
            {
              error:
                "This database still blocks a 0 rating. Run 'allow_zero_vendor_ratings.sql' in the Supabase SQL editor, then try again.",
              needsZeroMigration: true,
            },
            { status: 400 }
          );
        }
        throw upsertError;
      }
    }

    const affectedVendorIds = Array.from(new Set(entries.map((entry) => entry.vendorId)));

    // The weekly row is the source of truth. Mirroring the latest score into the
    // legacy per-edition table is a convenience, so never fail the save if it
    // cannot be updated.
    let syncWarning: string | null = null;
    try {
      await syncEditionRatings(supabase, editionId, affectedVendorIds, ratedBy);
    } catch (syncErr: unknown) {
      syncWarning = errorMessage(syncErr, 'Could not update the current edition rating');
      console.error('[vendor-weekly-ratings] edition sync failed:', syncErr);
    }

    const singleEntry = entries.length === 1 ? entries[0] : null;

    return NextResponse.json({
      success: true,
      editionId,
      weekStart,
      updated: entries.length,
      syncWarning,
      // Top-level fields mirror the single-entry payload so existing optimistic
      // consumers (e.g. the vendor rating modal) can reconcile cleanly.
      rating: singleEntry ? singleEntry.rating : undefined,
      note: singleEntry ? singleEntry.note : undefined,
      ratings: entries.reduce<Record<string, { rating: number | null; note: string | null }>>(
        (acc, entry) => {
          acc[entry.vendorId] = { rating: entry.rating, note: entry.note };
          return acc;
        },
        {}
      ),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: errorMessage(err, 'Failed to save weekly vendor ratings') },
      { status: 500 }
    );
  }
}
