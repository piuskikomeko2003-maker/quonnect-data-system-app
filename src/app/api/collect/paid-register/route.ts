import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// Keyed in-process mutex to serialize ticket number allocation per event edition,
// guaranteeing that concurrent requests on the same server instance never collide.
class KeyedMutex {
  private queues = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const current = this.queues.get(key) || Promise.resolve();
    let resolveNext: () => void;
    const next = new Promise<void>((res) => {
      resolveNext = res;
    });
    this.queues.set(key, next);

    try {
      await current;
      return await fn();
    } finally {
      resolveNext!();
      if (this.queues.get(key) === next) {
        this.queues.delete(key);
      }
    }
  }
}

const editionMutex = new KeyedMutex();

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
    const amountPaid = answers.amount_paid ? parseFloat(answers.amount_paid) : 0;
    const paymentStatus = answers.payment_status || 'paid';

    // ─── OPTION A: Try atomic PostgreSQL RPC with advisory locking ───
    try {
      const { data: rpcData, error: rpcError } = await serviceClient.rpc(
        'register_paid_vendor',
        {
          p_token: token,
          p_edition_id: edition_id,
          p_phone: phone,
          p_contact_name: contactName,
          p_business_name: businessName,
          p_category: category,
          p_email: email,
          p_amount_paid: amountPaid,
          p_payment_status: paymentStatus,
        }
      );

      if (!rpcError && rpcData) {
        return NextResponse.json({
          success: true,
          ticketData: {
            ticketNumber: rpcData.ticket_number,
            ticketCode: rpcData.ticket_code,
            editionName: body.edition_name || 'Event Edition',
            vendorName: contactName,
            businessName,
            phone,
            category,
            amountPaid,
            paymentStatus,
            registeredAt: rpcData.registered_at || new Date().toISOString(),
          },
        });
      }

      // If error is business logic error (e.g. link expired), return immediately
      if (rpcError && rpcError.message && (
        rpcError.message.includes('already been used') ||
        rpcError.message.includes('Invalid registration link')
      )) {
        return NextResponse.json({ error: rpcError.message }, { status: 400 });
      }
    } catch {
      // RPC not yet deployed in Supabase — proceed to robust fallback below
    }

    // ─── OPTION B: Server-Side Mutex Serialization per Edition ───────
    // Serializes concurrent requests for the edition so each vendor receives
    // a strictly sequential ticket number with zero collisions.
    const result = await editionMutex.run(edition_id, async () => {
      // 1. Verify single-use link
      const { data: link, error: linkErr } = await serviceClient
        .from('form_links')
        .select('token, expires_at')
        .eq('token', token)
        .single();

      if (linkErr || !link) {
        throw new Error('Invalid registration link.');
      }

      if (link.expires_at && new Date(link.expires_at) <= new Date()) {
        throw new Error('This registration link has already been used and is closed.');
      }

      // 2. Count existing registrations under the mutex lock
      const { count: earlierCount, error: countErr } = await serviceClient
        .from('vendor_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('market_day_id', edition_id);

      if (countErr) {
        throw new Error('Failed to determine ticket sequence: ' + countErr.message);
      }

      const ticketNumber = (earlierCount || 0) + 1;
      const ticketCode = `TKT-${String(ticketNumber).padStart(3, '0')}`;

      // 3. Upsert vendor record atomically
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
        throw new Error('Failed to save vendor details: ' + (vErr?.message || 'unknown'));
      }
      const vendorId = upsertedVendor.id;

      // 4. Check if vendor already has registration for this edition
      const { data: existingReg } = await serviceClient
        .from('vendor_registrations')
        .select('id, stall_number')
        .eq('vendor_id', vendorId)
        .eq('market_day_id', edition_id)
        .limit(1);

      let finalTicketNumber = ticketNumber;
      let finalTicketCode = ticketCode;

      if (existingReg && existingReg.length > 0) {
        if (existingReg[0].stall_number) {
          finalTicketCode = existingReg[0].stall_number;
          const matchNum = existingReg[0].stall_number.match(/\d+/);
          if (matchNum) finalTicketNumber = parseInt(matchNum[0], 10);
        }
      } else {
        const regPayload: Record<string, unknown> = {
          market_day_id: edition_id,
          vendor_id: vendorId,
          amount_paid: amountPaid,
          payment_status: paymentStatus,
          stall_number: ticketCode,
          notes: `Ticket #${ticketNumber} (${ticketCode})`,
        };
        if (submission_id) regPayload.id = submission_id;

        try {
          const { error: regErr } = await serviceClient
            .from('vendor_registrations')
            .insert({ ...regPayload, ticket_number: ticketCode });
          if (regErr && (regErr.code === '42703' || regErr.message?.includes('ticket_number'))) {
            await serviceClient.from('vendor_registrations').insert(regPayload);
          } else if (regErr && regErr.code !== '23505') {
            throw regErr;
          }
        } catch {
          await serviceClient.from('vendor_registrations').insert(regPayload);
        }
      }

      // 5. Mark the single-use link as used / closed immediately
      const nowIso = new Date().toISOString();
      await serviceClient
        .from('form_links')
        .update({
          expires_at: nowIso,
        })
        .eq('token', token);

      return {
        ticketNumber: finalTicketNumber,
        ticketCode: finalTicketCode,
        editionName: body.edition_name || 'Event Edition',
        vendorName: contactName,
        businessName,
        phone,
        category,
        amountPaid,
        paymentStatus,
        registeredAt: nowIso,
      };
    });

    return NextResponse.json({
      success: true,
      ticketData: result,
    });
  } catch (error: any) {
    console.error('API paid-register error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process paid registration' },
      { status: 400 }
    );
  }
}
