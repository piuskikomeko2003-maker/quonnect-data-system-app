import type { SupabaseClient } from '@supabase/supabase-js';
import { formatTicketCode } from '@/utils/ticket';

export interface TicketData {
  ticketId?: string;
  dayId?: string;
  dayNumber?: number;
  dayLabel?: string;
  dayDate?: string;
  ticketNumber: number;
  ticketCode: string;
  editionName: string;
  vendorName: string;
  businessName?: string;
  phone: string;
  category?: string;
  amountPaid?: number;
  paymentStatus?: string;
  registeredAt: string;
  /** All day tickets issued by this registration (multi-day editions). */
  tickets?: TicketData[];
}

interface TicketJson {
  ticket_id?: string;
  day_id?: string;
  day_number?: number;
  day_label?: string;
  event_date?: string;
  ticket_number?: number | string;
  ticket_code?: string;
  fee?: number;
}

interface MultiRpcResult {
  registration_id?: string;
  registered_at?: string;
  primary_ticket_number?: number | string;
  primary_ticket_code?: string;
  tickets?: TicketJson[];
}

export interface PaidAnswers {
  [key: string]: string | undefined;
}

export interface PaidFields {
  phone: string;
  contactName: string;
  businessName: string;
  category: string;
  email: string;
  amountPaid: number;
  paymentStatus: string;
}

interface TicketRow {
  ticket_number: number | string | null;
  ticket_code: string | null;
  registered_at: string | null;
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

function isBusinessError(message: string): boolean {
  return (
    message.includes('already been used') ||
    message.includes('Invalid registration link') ||
    message.includes('Phone number is required') ||
    message.includes('Missing event edition')
  );
}

export function extractPaidFields(answers: PaidAnswers): PaidFields {
  const parsedAmount = answers.amount_paid ? parseFloat(answers.amount_paid) : 0;
  return {
    phone: answers.phone || answers.phone_number || '',
    contactName: answers.contact_name || answers.full_name || answers.name || '',
    businessName: answers.business_name || '',
    category: answers.category || answers.business_category || '',
    email: answers.email || '',
    amountPaid: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    paymentStatus: answers.payment_status || 'paid',
  };
}

export function buildTicketData(
  row: TicketRow,
  fields: PaidFields,
  editionName: string
): TicketData {
  const num = Number(row.ticket_number) || 1;
  return {
    ticketNumber: num,
    ticketCode: row.ticket_code || formatTicketCode(num),
    editionName: editionName || 'Event Edition',
    vendorName: fields.contactName,
    businessName: fields.businessName,
    phone: fields.phone,
    category: fields.category,
    amountPaid: fields.amountPaid,
    paymentStatus: fields.paymentStatus,
    registeredAt: row.registered_at || new Date().toISOString(),
  };
}

function buildTicketFromJson(
  ticket: TicketJson,
  fields: PaidFields,
  editionName: string,
  registeredAt: string
): TicketData {
  const num = Number(ticket.ticket_number) || 1;
  return {
    ticketId: ticket.ticket_id,
    dayId: ticket.day_id,
    dayNumber: ticket.day_number,
    dayLabel: ticket.day_label,
    dayDate: ticket.event_date,
    ticketNumber: num,
    ticketCode: ticket.ticket_code || formatTicketCode(num),
    editionName: editionName || 'Event Edition',
    vendorName: fields.contactName,
    businessName: fields.businessName,
    phone: fields.phone,
    category: fields.category,
    amountPaid: fields.amountPaid,
    paymentStatus: fields.paymentStatus,
    registeredAt,
  };
}

/** Parse the JSONB result of the multi-day RPC into the app's ticket model. */
export function buildMultiTicketData(
  result: MultiRpcResult,
  fields: PaidFields,
  editionName: string
): TicketData {
  const registeredAt = result.registered_at || new Date().toISOString();
  const tickets = (result.tickets || []).map((t) =>
    buildTicketFromJson(t, fields, editionName, registeredAt)
  );

  if (tickets.length === 0) {
    return buildTicketData(
      {
        ticket_number: result.primary_ticket_number ?? 1,
        ticket_code: result.primary_ticket_code ?? null,
        registered_at: registeredAt,
      },
      fields,
      editionName
    );
  }

  const primary = tickets[0];
  return { ...primary, tickets };
}

/**
 * Atomically register a paid vendor and issue exactly one ticket, even under
 * heavy concurrency. Uses the `register_paid_vendor` Postgres function
 * (per-edition advisory lock + monotonic ticket counter). Falls back to a
 * retry-safe batch path only if the function is not deployed.
 *
 * Idempotent: calling this again for a vendor who already registered for the
 * edition returns their original ticket instead of creating a duplicate.
 */
export async function registerPaidVendorAtomic(
  supabase: SupabaseClient,
  params: {
    token: string;
    editionId: string;
    editionName: string;
    answers: PaidAnswers;
  }
): Promise<TicketData> {
  const { token, editionId, editionName, answers } = params;
  const fields = extractPaidFields(answers);

  // New multi-day allocator. Falls back to the legacy RPC below when the
  // migration has not been applied yet.
  const { data: multiData, error: multiError } = await supabase.rpc('register_paid_vendor_multi', {
    p_token: token,
    p_edition_id: editionId,
    p_phone: fields.phone,
    p_contact_name: fields.contactName,
    p_business_name: fields.businessName,
    p_category: fields.category,
    p_email: fields.email,
    p_amount_paid: fields.amountPaid,
    p_payment_status: fields.paymentStatus,
  });

  if (!multiError && multiData) {
    const result = (Array.isArray(multiData) ? multiData[0] : multiData) as MultiRpcResult;
    if (result && Array.isArray(result.tickets) && result.tickets.length > 0) {
      return buildMultiTicketData(result, fields, editionName);
    }
  }

  if (multiError) {
    if (isBusinessError(multiError.message || '')) {
      throw new Error(multiError.message);
    }
    if (!isMissingRpc(multiError)) {
      throw new Error(multiError.message || 'Ticket service temporarily unavailable.');
    }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('register_paid_vendor', {
    p_token: token,
    p_edition_id: editionId,
    p_phone: fields.phone,
    p_contact_name: fields.contactName,
    p_business_name: fields.businessName,
    p_category: fields.category,
    p_email: fields.email,
    p_amount_paid: fields.amountPaid,
    p_payment_status: fields.paymentStatus,
  });

  if (!rpcError && rpcData) {
    const row: TicketRow | undefined = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row && row.ticket_number != null) {
      return buildTicketData(row, fields, editionName);
    }
  }

  if (rpcError) {
    if (isBusinessError(rpcError.message || '')) {
      throw new Error(rpcError.message);
    }
    if (!isMissingRpc(rpcError)) {
      throw new Error(rpcError.message || 'Ticket service temporarily unavailable.');
    }
  }

  return legacyRegisterPaidVendor(supabase, { token, editionId, editionName, fields });
}

/**
 * Legacy two-step registration. Only reachable when the atomic function is
 * unavailable. Uniqueness is still guaranteed by the DB indexes on
 * (market_day_id, ticket_number) and (market_day_id, vendor_id); duplicate
 * allocations are detected (23505) and retried.
 */
async function legacyRegisterPaidVendor(
  supabase: SupabaseClient,
  params: {
    token: string;
    editionId: string;
    editionName: string;
    fields: PaidFields;
  }
): Promise<TicketData> {
  const { token, editionId, editionName, fields } = params;

  const { data: link, error: linkErr } = await supabase
    .from('form_links')
    .select('token, expires_at')
    .eq('token', token)
    .single();

  if (linkErr || !link) throw new Error('Invalid registration link.');

  const { data: vendor, error: vErr } = await supabase
    .from('vendors')
    .upsert(
      {
        business_name: fields.businessName || fields.contactName || 'Unknown Vendor',
        contact_name: fields.contactName,
        phone: fields.phone,
        email: fields.email,
        category: fields.category,
        is_active: true,
      },
      { onConflict: 'phone' }
    )
    .select('id')
    .single();

  if (vErr || !vendor) {
    throw new Error('Failed to save vendor details: ' + (vErr?.message || 'unknown'));
  }
  const vendorId = vendor.id;

  const { data: existingReg } = await supabase
    .from('vendor_registrations')
    .select('ticket_number, stall_number, created_at')
    .eq('market_day_id', editionId)
    .eq('vendor_id', vendorId)
    .limit(1);

  if (existingReg && existingReg.length > 0) {
    return buildTicketData(
      {
        ticket_number: existingReg[0].ticket_number,
        ticket_code: existingReg[0].stall_number,
        registered_at: existingReg[0].created_at,
      },
      fields,
      editionName
    );
  }

  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    throw new Error('This registration link has already been used and is closed.');
  }

  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { count: earlierCount } = await supabase
      .from('vendor_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('market_day_id', editionId);

    const ticketNumber = (earlierCount || 0) + 1;
    const ticketCode = formatTicketCode(ticketNumber);

    const { error: insertErr } = await supabase.from('vendor_registrations').insert({
      market_day_id: editionId,
      vendor_id: vendorId,
      amount_paid: fields.amountPaid,
      payment_status: fields.paymentStatus,
      stall_number: ticketCode,
      ticket_number: ticketNumber,
      notes: `Ticket #${ticketNumber}`,
    });

    if (!insertErr) {
      const nowIso = new Date().toISOString();
      await supabase
        .from('form_links')
        .update({
          expires_at: nowIso,
          used_at: nowIso,
          ticket_number: ticketCode,
          used_by_vendor_id: vendorId,
        })
        .eq('token', token);

      return buildTicketData(
        { ticket_number: ticketNumber, ticket_code: ticketCode, registered_at: nowIso },
        fields,
        editionName
      );
    }

    if (insertErr.code === '23505') {
      const { data: raced } = await supabase
        .from('vendor_registrations')
        .select('ticket_number, stall_number, created_at')
        .eq('market_day_id', editionId)
        .eq('vendor_id', vendorId)
        .limit(1);
      if (raced && raced.length > 0) {
        return buildTicketData(
          {
            ticket_number: raced[0].ticket_number,
            ticket_code: raced[0].stall_number,
            registered_at: raced[0].created_at,
          },
          fields,
          editionName
        );
      }
      continue;
    }

    throw new Error('Failed to issue ticket: ' + insertErr.message);
  }

  throw new Error('Ticket service is busy. Please retry in a moment.');
}

