import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { formatTicketCode } from '@/utils/ticket';

interface TicketRow {
  ticket_number: number | string | null;
  ticket_code: string | null;
  registered_at: string | null;
}

interface TicketPayload {
  token: string;
  edition_id: string;
  edition_name?: string;
  contactName: string;
  businessName: string;
  phone: string;
  category: string;
  amountPaid: number;
  paymentStatus: string;
}

function buildTicketData(row: TicketRow, ctx: TicketPayload) {
  const num = Number(row.ticket_number) || 1;
  return {
    ticketNumber: num,
    ticketCode: row.ticket_code || formatTicketCode(num),
    editionName: ctx.edition_name || 'Event Edition',
    vendorName: ctx.contactName,
    businessName: ctx.businessName,
    phone: ctx.phone,
    category: ctx.category,
    amountPaid: ctx.amountPaid,
    paymentStatus: ctx.paymentStatus,
    registeredAt: row.registered_at || new Date().toISOString(),
  };
}

function isBusinessError(message: string): boolean {
  return (
    message.includes('already been used') ||
    message.includes('Invalid registration link') ||
    message.includes('Phone number is required') ||
    message.includes('Missing event edition')
  );
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    error.code === 'PGRST202' ||
    msg.includes('Could not find the function') ||
    msg.includes('does not exist')
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, edition_id, answers, submission_id } = body;

    if (!token || !edition_id || !answers) {
      return NextResponse.json(
        { error: 'Missing required parameters (token, edition_id, answers)' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    const phone = answers.phone || answers.phone_number || '';
    const contactName = answers.contact_name || answers.full_name || answers.name || '';
    const businessName = answers.business_name || '';
    const category = answers.category || answers.business_category || '';
    const email = answers.email || '';
    const parsedAmount = answers.amount_paid ? parseFloat(answers.amount_paid) : 0;
    const amountPaid = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const paymentStatus = answers.payment_status || 'paid';

    const ctx: TicketPayload = {
      token,
      edition_id,
      edition_name: body.edition_name,
      contactName,
      businessName,
      phone,
      category,
      amountPaid,
      paymentStatus,
    };

    // ─── OPTION A: Atomic PostgreSQL function (advisory lock + counter) ───
    // Handles unlimited concurrency across server instances and regions.
    const { data: rpcData, error: rpcError } = await serviceClient.rpc('register_paid_vendor', {
      p_token: token,
      p_edition_id: edition_id,
      p_phone: phone,
      p_contact_name: contactName,
      p_business_name: businessName,
      p_category: category,
      p_email: email,
      p_amount_paid: amountPaid,
      p_payment_status: paymentStatus,
    });

    if (!rpcError && rpcData) {
      const row: TicketRow | undefined = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (row && row.ticket_number != null) {
        return NextResponse.json({ success: true, ticketData: buildTicketData(row, ctx) });
      }
    }

    if (rpcError) {
      if (isBusinessError(rpcError.message || '')) {
        return NextResponse.json({ error: rpcError.message }, { status: 400 });
      }
      // Function not deployed yet → fall through to the legacy path below.
      // Any other DB error is transient from the client's perspective and must
      // NOT be silently retried against the non-atomic path.
      if (!isMissingRpc(rpcError)) {
        console.error('register_paid_vendor RPC failed:', rpcError);
        return NextResponse.json(
          { error: 'Ticket service temporarily unavailable. Please retry.' },
          { status: 503 }
        );
      }
    }

    // ─── OPTION B: Legacy fallback (only when the RPC is unavailable) ───
    // Safe for concurrency thanks to the unique index on
    // (market_day_id, ticket_number) and UNIQUE(market_day_id, vendor_id):
    // a duplicate allocation raises 23505 and is retried with a fresh count.
    const MAX_ATTEMPTS = 6;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data: link, error: linkErr } = await serviceClient
        .from('form_links')
        .select('token, expires_at')
        .eq('token', token)
        .single();

      if (linkErr || !link) {
        return NextResponse.json({ error: 'Invalid registration link.' }, { status: 400 });
      }

      const { data: upsertedVendor, error: vErr } = await serviceClient
        .from('vendors')
        .upsert(
          {
            business_name: businessName || contactName || 'Unknown Vendor',
            contact_name: contactName,
            phone,
            email,
            category,
            is_active: true,
          },
          { onConflict: 'phone' }
        )
        .select('id')
        .single();

      if (vErr || !upsertedVendor) {
        console.error('Legacy fallback vendor upsert failed:', vErr);
        return NextResponse.json({ error: 'Failed to save vendor details.' }, { status: 503 });
      }
      const vendorId = upsertedVendor.id;

      // Idempotency: return the existing ticket if this vendor already registered.
      const { data: existingReg } = await serviceClient
        .from('vendor_registrations')
        .select('ticket_number, stall_number, created_at')
        .eq('market_day_id', edition_id)
        .eq('vendor_id', vendorId)
        .limit(1);

      if (existingReg && existingReg.length > 0) {
        const existing = existingReg[0];
        return NextResponse.json({
          success: true,
          ticketData: buildTicketData(
            {
              ticket_number: existing.ticket_number,
              ticket_code: existing.stall_number,
              registered_at: existing.created_at,
            },
            ctx
          ),
        });
      }

      if (link.expires_at && new Date(link.expires_at) <= new Date()) {
        return NextResponse.json(
          { error: 'This registration link has already been used and is closed.' },
          { status: 400 }
        );
      }

      const { count: earlierCount } = await serviceClient
        .from('vendor_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('market_day_id', edition_id);

      const ticketNumber = (earlierCount || 0) + 1;
      const ticketCode = formatTicketCode(ticketNumber);

      const { error: insertErr } = await serviceClient.from('vendor_registrations').insert({
        market_day_id: edition_id,
        vendor_id: vendorId,
        amount_paid: amountPaid,
        payment_status: paymentStatus,
        stall_number: ticketCode,
        ticket_number: ticketNumber,
        notes: `Ticket #${ticketNumber}`,
        ...(submission_id ? { id: submission_id } : {}),
      });

      if (insertErr) {
        // 23505 = duplicate ticket or duplicate (edition, vendor) → retry/return.
        if (insertErr.code === '23505') {
          const { data: raced } = await serviceClient
            .from('vendor_registrations')
            .select('ticket_number, stall_number, created_at')
            .eq('market_day_id', edition_id)
            .eq('vendor_id', vendorId)
            .limit(1);
          if (raced && raced.length > 0) {
            return NextResponse.json({
              success: true,
              ticketData: buildTicketData(
                {
                  ticket_number: raced[0].ticket_number,
                  ticket_code: raced[0].stall_number,
                  registered_at: raced[0].created_at,
                },
                ctx
              ),
            });
          }
          continue;
        }
        console.error('Legacy fallback registration insert failed:', insertErr);
        return NextResponse.json({ error: 'Failed to issue ticket. Please retry.' }, { status: 503 });
      }

      const nowIso = new Date().toISOString();
      await serviceClient
        .from('form_links')
        .update({
          expires_at: nowIso,
          used_at: nowIso,
          ticket_number: ticketCode,
          used_by_vendor_id: vendorId,
        })
        .eq('token', token);

      return NextResponse.json({
        success: true,
        ticketData: buildTicketData(
          { ticket_number: ticketNumber, ticket_code: ticketCode, registered_at: nowIso },
          ctx
        ),
      });
    }

    return NextResponse.json(
      { error: 'Ticket service is busy. Please retry in a moment.' },
      { status: 503 }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to process paid registration';
    console.error('API paid-register error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
