import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { createServiceClient } from '@/lib/supabase/service';
import {
  REQUIRED_TICKET_FIELDS,
  SAMPLE_TICKET_DATA,
  TicketVendorData,
  FieldPositionsMap,
  RequiredTicketField,
} from '@/types/ticketTemplate';
import { normalizeTicketCode } from '@/utils/ticket';

export const runtime = 'nodejs';

/**
 * A pass is immutable once issued, so browser caching makes repeat views and
 * downloads near-instant. Kept `private` because the image carries vendor
 * contact details; the client prefetch is what removes the cold-render wait.
 */
const TICKET_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
};

/**
 * Auto-shrinks font size if text exceeds specified maxWidth to avoid overflow,
 * clamping to at least 11px.
 */
function computeAdaptiveFontSize(
  text: string,
  baseSize: number,
  maxWidth?: number
): number {
  if (!maxWidth || !text || text.length === 0) return baseSize;
  const approxWidth = text.length * (baseSize * 0.58);
  if (approxWidth > maxWidth) {
    const ratio = maxWidth / approxWidth;
    const scaled = Math.floor(baseSize * ratio);
    return Math.max(11, Math.min(baseSize, scaled));
  }
  return baseSize;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('edition_id');
    const editionDayIdParam = searchParams.get('edition_day_id');
    const isPreview = searchParams.get('preview') === 'true';
    const token = searchParams.get('token');

    let ticketData: TicketVendorData = { ...SAMPLE_TICKET_DATA };

    const supabase = createServiceClient();

    // 1. Resolve live vendor data if token or custom parameters are passed
    if (token) {
      // Lookup form link
      const { data: link } = await supabase
        .from('form_links')
        .select('*, market_days(id, name)')
        .eq('token', token)
        .maybeSingle();

      if (link) {
        // If link has used_by_vendor_id, fetch real registration row
        if (link.used_by_vendor_id) {
          const { data: reg } = await supabase
            .from('vendor_registrations')
            .select('*, vendors(*)')
            .eq('vendor_id', link.used_by_vendor_id)
            .eq('market_day_id', link.edition_id)
            .maybeSingle();

          if (reg && reg.vendors) {
            const v = reg.vendors as any;
            ticketData = {
              ticketNumber: reg.stall_number?.match(/\d+/)?.[0] || '1',
              ticketCode: normalizeTicketCode(reg.ticket_number || reg.stall_number || link.ticket_number) || '001',
              editionName: (link.market_days as any)?.name || 'Event Edition',
              vendorName: v.contact_name || v.business_name || 'Vendor',
              businessName: v.business_name || '',
              category: v.category || '',
              phone: v.phone || '',
              amountPaid: reg.amount_paid,
              paymentStatus: reg.payment_status || 'paid',
              registeredAt: reg.created_at || link.used_at || new Date().toISOString(),
            };
          }
        }
      }
    }

    // 1b. Resolve a specific per-day ticket.
    const ticketId = searchParams.get('ticket_id');
    let resolvedDayLabel: string | null = null;
    let resolvedDayTemplateId: string | null = null;
    let resolvedEditionDayId: string | null = null;
    if (ticketId) {
      const { data: ticket } = await supabase
        .from('vendor_tickets')
        .select('*, edition_days(id, day_number, label, event_date, ticket_template_id), vendor_registrations(*, vendors(*)), market_days(id, name)')
        .eq('id', ticketId)
        .maybeSingle();

      if (ticket) {
        const day = ticket.edition_days as any;
        const reg = ticket.vendor_registrations as any;
        const vendor = reg?.vendors as any;
        resolvedDayLabel = day?.label || (day?.day_number ? `Day ${day.day_number}` : null);
        resolvedDayTemplateId = day?.ticket_template_id || null;
        resolvedEditionDayId = day?.id || null;

        ticketData = {
          ticketNumber: String(ticket.ticket_number || '1'),
          ticketCode: normalizeTicketCode(ticket.ticket_code) || '001',
          editionName: [
            (ticket.market_days as any)?.name || 'Event Edition',
            resolvedDayLabel,
          ].filter(Boolean).join(' — '),
          vendorName: vendor?.contact_name || vendor?.business_name || 'Vendor',
          businessName: vendor?.business_name || '',
          category: vendor?.category || '',
          phone: vendor?.phone || '',
          amountPaid: ticket.fee ?? reg?.amount_paid,
          paymentStatus: reg?.payment_status || 'paid',
          registeredAt: ticket.created_at || reg?.created_at || new Date().toISOString(),
        };
      }
    }

    // Designer preview: resolve the selected day even without a real ticket.
    if (!ticketId && editionDayIdParam) {
      const { data: day } = await supabase
        .from('edition_days')
        .select('id, edition_id, day_number, label, event_date, ticket_template_id, market_days(name)')
        .eq('id', editionDayIdParam)
        .maybeSingle();

      if (day) {
        resolvedEditionDayId = day.id;
        resolvedDayLabel = day.label || `Day ${day.day_number}`;
        resolvedDayTemplateId = day.ticket_template_id || null;
        if (isPreview) {
          const dayEditionName = (day.market_days as any)?.name || ticketData.editionName;
          ticketData.editionName = [dayEditionName, resolvedDayLabel]
            .filter(Boolean)
            .join(' — ');
        }
      }
    }

    const dayLabelOverride = searchParams.get('day_label');
    if (dayLabelOverride && ticketData.editionName) {
      resolvedDayLabel = resolvedDayLabel || dayLabelOverride;
      if (!ticketData.editionName.includes(dayLabelOverride)) {
        ticketData.editionName = `${ticketData.editionName} — ${dayLabelOverride}`;
      }
    }

    // Override with any explicit query parameters if provided
    if (searchParams.get('vendor_name')) {
      ticketData.vendorName = searchParams.get('vendor_name')!;
    }
    if (searchParams.get('business_name')) {
      ticketData.businessName = searchParams.get('business_name')!;
    }
    if (searchParams.get('ticket_number')) {
      ticketData.ticketCode = normalizeTicketCode(searchParams.get('ticket_number')) || searchParams.get('ticket_number')!;
    }
    if (searchParams.get('category')) {
      ticketData.category = searchParams.get('category')!;
    }
    if (searchParams.get('phone')) {
      ticketData.phone = searchParams.get('phone')!;
    }
    if (searchParams.get('edition_name')) {
      ticketData.editionName = searchParams.get('edition_name')!;
    }
    if (searchParams.get('issued_at')) {
      ticketData.registeredAt = searchParams.get('issued_at')!;
    }

    // 2. Fetch template for edition (or fallback to default template).
    // Every candidate is queried in parallel, then resolved by priority:
    // day id → day fallback → edition → default. This keeps the render to a
    // single DB round trip instead of up to four sequential ones.
    let template: Record<string, any> | null = null;
    try {
      const lookups: Array<PromiseLike<{ priority: number; template: any } | null>> = [];

      if (resolvedDayTemplateId) {
        lookups.push(
          supabase
            .from('ticket_templates')
            .select('*')
            .eq('id', resolvedDayTemplateId)
            .maybeSingle()
            .then(({ data, error }) => (!error && data ? { priority: 0, template: data } : null))
        );
      }

      // Settings saves day templates with edition_day_id. They may not have
      // been linked from edition_days.ticket_template_id, so look them up too.
      if (resolvedEditionDayId) {
        lookups.push(
          supabase
            .from('ticket_templates')
            .select('*')
            .eq('edition_day_id', resolvedEditionDayId)
            .maybeSingle()
            .then(({ data }) => (data ? { priority: 1, template: data } : null))
        );
      }

      if (editionId) {
        lookups.push(
          supabase
            .from('ticket_templates')
            .select('*')
            .eq('edition_id', editionId)
            .is('edition_day_id', null)
            .maybeSingle()
            .then(({ data, error }) => (!error && data ? { priority: 2, template: data } : null))
        );
      }

      lookups.push(
        supabase
          .from('ticket_templates')
          .select('*')
          .eq('is_default', true)
          .maybeSingle()
          .then(({ data, error }) => (!error && data ? { priority: 3, template: data } : null))
      );

      const results = (await Promise.all(lookups)).filter(Boolean) as Array<{
        priority: number;
        template: any;
      }>;
      results.sort((a, b) => a.priority - b.priority);
      template = results[0]?.template ?? null;
    } catch {
      // Table doesn't exist yet, proceed with default pass design
    }

    // ─── SAFEGUARD: Check field_positions completeness if template exists ───
    if (template) {
      const positions = template.field_positions as FieldPositionsMap;
      if (!positions || typeof positions !== 'object') {
        return NextResponse.json(
          { error: 'Template misconfigured: field_positions object is missing or empty.' },
          { status: 400 }
        );
      }

      for (const field of REQUIRED_TICKET_FIELDS) {
        const pos = positions[field];
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
          return NextResponse.json(
            {
              error: `Template misconfigured: required field coordinate "${field}" is missing. Every template must define positions for: ${REQUIRED_TICKET_FIELDS.join(', ')}`,
            },
            { status: 400 }
          );
        }
      }

      const canvasWidth = template.canvas_width || 1920;
      const canvasHeight = template.canvas_height || 1080;

      const formattedDate = new Date(ticketData.registeredAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const fieldValues: Record<RequiredTicketField, string> = {
        vendor_name: ticketData.vendorName || (isPreview ? 'Vendor Name Here' : ''),
        business_name: ticketData.businessName || (isPreview ? 'Business Name Here' : ''),
        category: ticketData.category || (isPreview ? 'Category Here' : ''),
        phone_number: ticketData.phone || (isPreview ? '+256 700 000 000' : ''),
        ticket_number: ticketData.ticketCode || (isPreview ? '000' : '001'),
        issued_at: formattedDate,
      };

      // Render custom template using ImageResponse
      return new ImageResponse(
        (
          <div
            style={{
              position: 'relative',
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              display: 'flex',
              backgroundColor: '#111827',
              overflow: 'hidden',
            }}
          >
            {/* Background Art */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={template.background_image_url}
              alt="Ticket Background"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                objectFit: 'cover',
              }}
            />

            {/* Day badge: multi-day tickets must always be clearly labelled,
                even when the custom background was designed for one day. */}
            {resolvedDayLabel && (
              <div
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  display: 'flex',
                  backgroundColor: 'rgba(13, 17, 23, 0.82)',
                  color: '#4ade80',
                  border: '1px solid rgba(74, 222, 128, 0.55)',
                  borderRadius: '9999px',
                  padding: '7px 16px',
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                }}
              >
                {resolvedDayLabel}
              </div>
            )}

            {/* Dynamic Field Overlays */}
            {REQUIRED_TICKET_FIELDS.map((field) => {
              const pos = positions[field];
              const text = fieldValues[field];
              if (!text) return null;

              const effectiveFontSize = computeAdaptiveFontSize(
                text,
                pos.fontSize || 18,
                pos.maxWidth
              );

              return (
                <div
                  key={field}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    fontSize: `${effectiveFontSize}px`,
                    color: pos.color || '#000000',
                    fontWeight: (pos.fontWeight === 'bold' || pos.fontWeight === '700' ? 700 : pos.fontWeight === 'semibold' || pos.fontWeight === '600' ? 600 : 400) as any,
                    maxWidth: pos.maxWidth ? `${pos.maxWidth}px` : undefined,
                    lineHeight: 1.25,
                    display: 'flex',
                    flexWrap: 'wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {text}
                </div>
              );
            })}
          </div>
        ),
        {
          width: canvasWidth,
          height: canvasHeight,
          headers: TICKET_CACHE_HEADERS,
        }
      );
    }

    // ─── FALLBACK: Render clean default dark-themed pass if no template exists ───
    const formattedDate = new Date(ticketData.registeredAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return new ImageResponse(
      (
        <div
          style={{
            position: 'relative',
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#0d1117',
            color: '#ffffff',
            padding: '48px 60px',
            fontFamily: 'sans-serif',
            border: '2px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              paddingBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#22c55e',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                }}
              >
                Official Vendor Admission Pass
              </span>
              <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                {ticketData.editionName || 'Event Edition'}
              </span>
            </div>
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                padding: '6px 16px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Confirmed Paid
            </div>
          </div>

          {/* Center Hero Ticket Code */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '24px',
              margin: '16px 0',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                letterSpacing: '2px',
                color: '#9ca3af',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Admission Ticket Number
            </span>
            <span
              style={{
                fontSize: '54px',
                fontWeight: 900,
                color: '#38bdf8',
                letterSpacing: '4px',
                margin: '4px 0',
              }}
            >
              {ticketData.ticketCode}
            </span>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              Vendor #{ticketData.ticketNumber} &bull; Registered for this edition
            </span>
          </div>

          {/* Vendor Details Grid */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px 24px',
              fontSize: '15px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Vendor Name</span>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>{ticketData.vendorName}</span>
            </div>
            {ticketData.businessName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Business</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{ticketData.businessName}</span>
              </div>
            ) : null}
            {ticketData.category ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Category</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{ticketData.category}</span>
              </div>
            ) : null}
            {ticketData.phone ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Phone</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{ticketData.phone}</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>Issued At</span>
              <span style={{ color: '#d1d5db', fontSize: '13px' }}>{formattedDate}</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: TICKET_CACHE_HEADERS,
      }
    );
  } catch (err: any) {
    console.error('Error rendering ticket image:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to render ticket image' },
      { status: 500 }
    );
  }
}
