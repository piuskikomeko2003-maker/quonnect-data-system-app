import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const dynamic = 'force-dynamic';

import { EXPORT_COLUMNS, ExportColumnDef } from '@/types/vendorExport';

/**
 * Escapes a single cell value according to RFC 4180 with CSV injection guard.
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // CSV injection protection: prefix formula starters (=, +, -, @, \t, \r) with an apostrophe
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Quote if contains commas, quotes, or newlines
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function ratingToStars(rating: number | null | undefined): string {
  if (rating === null || rating === undefined || rating < 1) return '';
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 === 1;
  return '★'.repeat(fullStars) + (halfStar ? '½' : '');
}

/**
 * POST /api/vendors/export
 * Admin-only: customizable CSV export with column selection, filtering, and live preview.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      editionIds = [],
      regionId = null,
      columns = [],
      filters = {},
      sort = { field: 'business_name', direction: 'asc' },
      previewOnly = false,
    } = body ?? {};

    const supabase = createServiceClient();

    // 1. Fetch relevant market_days (editions) with graceful fallback if standard_fee does not exist
    let editionsData: any[] | null = null;
    let editionsQuery = supabase
      .from('market_days')
      .select('id, name, edition, event_date, region_id, standard_fee, regions(id, name)');

    if (regionId && regionId !== 'All') {
      editionsQuery = editionsQuery.eq('region_id', regionId);
    }

    if (Array.isArray(editionIds) && editionIds.length > 0 && !editionIds.includes('all')) {
      editionsQuery = editionsQuery.in('id', editionIds);
    }

    const { data: resData, error: edErr } = await editionsQuery;
    if (edErr) {
      // standard_fee or other column may not exist in this database schema; fallback to base columns
      console.warn('market_days query with standard_fee failed, retrying without standard_fee:', edErr.message);
      let fallbackQuery = supabase
        .from('market_days')
        .select('id, name, edition, event_date, region_id, regions(id, name)');

      if (regionId && regionId !== 'All') {
        fallbackQuery = fallbackQuery.eq('region_id', regionId);
      }

      if (Array.isArray(editionIds) && editionIds.length > 0 && !editionIds.includes('all')) {
        fallbackQuery = fallbackQuery.in('id', editionIds);
      }

      const { data: fallbackData, error: fallbackErr } = await fallbackQuery;
      if (fallbackErr) throw fallbackErr;
      editionsData = fallbackData;
    } else {
      editionsData = resData;
    }

    const editions = editionsData || [];
    if (editions.length === 0) {
      if (previewOnly) {
        return NextResponse.json({ totalCount: 0, previewRows: [], columns });
      }
      return new NextResponse('\uFEFF', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="quonnect-vendors-empty.csv"',
        },
      });
    }

    const targetEditionIds = editions.map((e: any) => e.id);
    const editionMap = new Map<string, any>(editions.map((e: any) => [e.id, e]));

    // 2. Fetch all vendor data for these editions in parallel with robust fallbacks
    const fetchRegistrations = async (): Promise<any[]> => {
      try {
        const res = await supabase
          .from('vendor_registrations')
          .select(`
            id,
            market_day_id,
            vendor_id,
            amount_paid,
            payment_status,
            stall_number,
            ticket_number,
            tables,
            check_in_time,
            created_at,
            vendors (
              id,
              business_name,
              contact_name,
              phone,
              email,
              category,
              is_active
            )
          `)
          .in('market_day_id', targetEditionIds);

        if (res.error) {
          console.warn('Rich vendor_registrations export query failed, retrying basic:', res.error.message);
          const basic = await supabase
            .from('vendor_registrations')
            .select(`
              id,
              market_day_id,
              vendor_id,
              amount_paid,
              payment_status,
              stall_number,
              ticket_number,
              created_at,
              vendors (
                id,
                business_name,
                contact_name,
                phone,
                email,
                category,
                is_active
              )
            `)
            .in('market_day_id', targetEditionIds);
          return basic.data || [];
        }
        return res.data || [];
      } catch (err) {
        console.warn('vendor_registrations export query error:', err);
        return [];
      }
    };

    const fetchSurveys = async (): Promise<any[]> => {
      try {
        const res = await supabase
          .from('survey_responses')
          .select(`
            id,
            context_id,
            vendor_id,
            vendors (
              id,
              business_name,
              contact_name,
              phone,
              email,
              category,
              is_active
            )
          `)
          .in('context_id', targetEditionIds);
        return res.data || [];
      } catch {
        return [];
      }
    };

    const fetchRatings = async (): Promise<any[]> => {
      try {
        const res = await supabase
          .from('vendor_ratings')
          .select('vendor_id, edition_id, rating, note')
          .in('edition_id', targetEditionIds);
        return res.data || [];
      } catch {
        return [];
      }
    };

    const fetchAllRatingsSummary = async (): Promise<any[]> => {
      try {
        const res = await supabase
          .from('vendor_ratings')
          .select('vendor_id, rating')
          .not('rating', 'is', null);
        return res.data || [];
      } catch {
        return [];
      }
    };

    const [
      registrationsData,
      surveysData,
      ratingsData,
      allRatingsSummaryData,
    ] = await Promise.all([
      fetchRegistrations(),
      fetchSurveys(),
      fetchRatings(),
      fetchAllRatingsSummary(),
    ]);

    // Compute overall cross-edition average per vendor
    const avgRatingMap = new Map<string, number>();
    if (allRatingsSummaryData && allRatingsSummaryData.length > 0) {
      const vendorSums = new Map<string, { sum: number; count: number }>();
      allRatingsSummaryData.forEach((r: any) => {
        if (r.rating !== null && r.rating !== undefined) {
          const cur = vendorSums.get(r.vendor_id) || { sum: 0, count: 0 };
          cur.sum += Number(r.rating);
          cur.count += 1;
          vendorSums.set(r.vendor_id, cur);
        }
      });
      vendorSums.forEach((val, vId) => {
        avgRatingMap.set(vId, Math.round((val.sum / val.count) * 10) / 10);
      });
    }

    // Map ratings by `${vendor_id}_${edition_id}`
    const ratingsMap = new Map<string, { rating: number | null; note: string | null }>();
    if (ratingsData && ratingsData.length > 0) {
      ratingsData.forEach((r: any) => {
        ratingsMap.set(`${r.vendor_id}_${r.edition_id}`, {
          rating: r.rating !== null ? Number(r.rating) : null,
          note: r.note || null,
        });
      });
    }

    // Build unique pairs of (vendor_id, edition_id)
    interface ExportRowItem {
      vendorId: string;
      editionId: string;
      vendor: any;
      registration: any | null;
      hasSurvey: boolean;
    }

    const pairMap = new Map<string, ExportRowItem>();

    // Add from vendor_registrations
    (registrationsData || []).forEach((reg: any) => {
      const v = reg.vendors;
      if (!v || !v.id) return;
      const key = `${v.id}_${reg.market_day_id}`;
      pairMap.set(key, {
        vendorId: v.id,
        editionId: reg.market_day_id,
        vendor: v,
        registration: reg,
        hasSurvey: false,
      });
    });

    // Add/merge from survey_responses
    (surveysData || []).forEach((sr: any) => {
      const v = sr.vendors;
      if (!v || !v.id) return;
      const key = `${v.id}_${sr.context_id}`;
      const existing = pairMap.get(key);
      if (existing) {
        existing.hasSurvey = true;
      } else {
        pairMap.set(key, {
          vendorId: v.id,
          editionId: sr.context_id,
          vendor: v,
          registration: null,
          hasSurvey: true,
        });
      }
    });

    // Transform pairs into raw row objects
    let rows = Array.from(pairMap.values()).map(({ vendorId, editionId, vendor, registration, hasSurvey }) => {
      const ed = editionMap.get(editionId);
      const ratingInfo = ratingsMap.get(`${vendorId}_${editionId}`) || { rating: null, note: null };
      const avg = avgRatingMap.get(vendorId) ?? (ratingInfo.rating !== null ? ratingInfo.rating : null);

      const hasPaidReg = !!registration;
      const registrationType =
        hasPaidReg && hasSurvey ? 'both' :
        hasPaidReg ? 'paid' :
        hasSurvey ? 'survey' : 'unknown';

      // Crucial: If vendor has no payment record for this edition, export blanks, NOT 0!
      const amountPaidVal = hasPaidReg && registration.amount_paid !== null && registration.amount_paid !== undefined
        ? Number(registration.amount_paid)
        : '';

      const paymentStatusVal = hasPaidReg ? (registration.payment_status || 'unpaid') : '';
      const standardFeeVal = ed?.standard_fee !== null && ed?.standard_fee !== undefined ? Number(ed.standard_fee) : '';
      const feeSourceVal = hasPaidReg ? (registration.fee_source || 'standard') : '';
      const tablesVal = hasPaidReg ? (registration.tables || 1) : '';
      const ticketVal = hasPaidReg ? (registration.ticket_number || '') : '';
      const stallVal = hasPaidReg ? (registration.stall_number || '') : '';
      const checkInVal = hasPaidReg && registration.check_in_time ? registration.check_in_time : '';
      const createdAtVal = registration?.created_at || vendor?.created_at || '';

      return {
        // Business
        business_name: vendor.business_name || '',
        category: vendor.category || '',
        is_active: vendor.is_active !== undefined ? (vendor.is_active ? 'true' : 'false') : '',

        // Contact
        contact_name: vendor.contact_name || '',
        phone: vendor.phone || '',
        email: vendor.email || '',

        // Payments
        amount_paid_ugx: amountPaidVal !== '' ? String(amountPaidVal) : '',
        payment_status: paymentStatusVal,
        standard_fee_ugx: standardFeeVal !== '' ? String(standardFeeVal) : '',
        fee_source: feeSourceVal,
        tables: tablesVal !== '' ? String(tablesVal) : '',
        ticket_number: ticketVal !== '' ? String(ticketVal) : '',
        stall_number: stallVal,

        // Rating
        rating: ratingInfo.rating !== null ? String(ratingInfo.rating) : '',
        rating_stars: ratingToStars(ratingInfo.rating),
        rating_note: ratingInfo.note || '',
        avg_rating: avg !== null ? String(avg) : '',

        // Edition & Region
        edition_name: ed?.edition || ed?.name || 'Untitled Edition',
        region_name: ed?.regions?.name || '',
        event_date: ed?.event_date || '',

        // Registration & Data
        registration_type: registrationType,
        attendance_count: '1',
        check_in_time: checkInVal,
        created_at: createdAtVal,

        // Raw numbers for filtering and sorting
        _rawRating: ratingInfo.rating,
        _rawAmountPaid: typeof amountPaidVal === 'number' ? amountPaidVal : -1,
      };
    });

    // 3. Apply Extra Filters
    const {
      paymentStatus,
      ratingStatus,
      minRating,
      registrationTypeFilter,
    } = filters;

    if (paymentStatus === 'paid') {
      rows = rows.filter((r) => r.payment_status === 'paid');
    } else if (paymentStatus === 'unpaid') {
      rows = rows.filter((r) => r.payment_status !== 'paid');
    }

    if (ratingStatus === 'rated') {
      rows = rows.filter((r) => r._rawRating !== null && r._rawRating !== undefined);
    } else if (ratingStatus === 'unrated') {
      rows = rows.filter((r) => r._rawRating === null || r._rawRating === undefined);
    } else if (ratingStatus === '1-3') {
      rows = rows.filter((r) => r._rawRating !== null && r._rawRating >= 1 && r._rawRating <= 3);
    } else if (ratingStatus === '4-6') {
      rows = rows.filter((r) => r._rawRating !== null && r._rawRating >= 4 && r._rawRating <= 6);
    } else if (ratingStatus === '7-8') {
      rows = rows.filter((r) => r._rawRating !== null && r._rawRating >= 7 && r._rawRating <= 8);
    } else if (ratingStatus === '9-10') {
      rows = rows.filter((r) => r._rawRating !== null && r._rawRating >= 9 && r._rawRating <= 10);
    }

    if (typeof minRating === 'number' && minRating > 0) {
      rows = rows.filter((r) => r._rawRating !== null && r._rawRating >= minRating);
    }

    if (registrationTypeFilter && registrationTypeFilter !== 'all') {
      rows = rows.filter((r) => r.registration_type === registrationTypeFilter);
    }

    // 4. Apply Sort
    const sortField = sort?.field || 'business_name';
    const isAsc = sort?.direction !== 'desc';

    rows.sort((a: any, b: any) => {
      let comparison = 0;
      if (sortField === 'rating') {
        const valA = a._rawRating ?? -1;
        const valB = b._rawRating ?? -1;
        comparison = valA - valB;
      } else if (sortField === 'amount_paid') {
        const valA = a._rawAmountPaid ?? -1;
        const valB = b._rawAmountPaid ?? -1;
        comparison = valA - valB;
      } else if (sortField === 'contact_name') {
        comparison = (a.contact_name || '').localeCompare(b.contact_name || '');
      } else {
        // default business_name
        comparison = (a.business_name || '').localeCompare(b.business_name || '');
      }
      return isAsc ? comparison : -comparison;
    });

    // 5. Column selection
    // If multiple editions exported and columns doesn't include edition_name, auto-include it
    const selectedKeys: string[] = Array.isArray(columns) && columns.length > 0
      ? [...columns]
      : EXPORT_COLUMNS.map((c) => c.key);

    if (editions.length > 1 && !selectedKeys.includes('edition_name')) {
      selectedKeys.unshift('edition_name');
    }

    // Filter to valid column definitions
    const activeColDefs = selectedKeys
      .map((k) => EXPORT_COLUMNS.find((col) => col.key === k))
      .filter(Boolean) as ExportColumnDef[];

    // If preview requested, return JSON
    if (previewOnly) {
      const previewRows = rows.slice(0, 5).map((row: any) => {
        const clean: Record<string, string> = {};
        activeColDefs.forEach((col) => {
          clean[col.key] = row[col.key] ?? '';
        });
        return clean;
      });

      return NextResponse.json({
        totalCount: rows.length,
        previewRows,
        columns: activeColDefs,
      });
    }

    // 6. Generate CSV output
    const headerLine = activeColDefs.map((c) => escapeCsvCell(c.header)).join(',');
    const dataLines = rows.map((row: any) => {
      return activeColDefs.map((col) => escapeCsvCell(row[col.key] ?? '')).join(',');
    });

    // Prepend UTF-8 BOM so Excel opens Ugandan characters and symbols cleanly
    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

    // Filename generation
    const dateStr = new Date().toISOString().split('T')[0];
    let filename = '';
    if (editions.length === 1) {
      const rawName = editions[0].edition || editions[0].name || 'edition';
      const safeSlug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      filename = `quonnect-vendors-${safeSlug}-${dateStr}.csv`;
    } else {
      filename = `quonnect-vendors-${editions.length}-editions-${dateStr}.csv`;
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to export CSV' },
      { status: 500 }
    );
  }
}
