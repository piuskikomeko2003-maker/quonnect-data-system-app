import type { SupabaseClient } from '@supabase/supabase-js';

type VendorRow = Record<string, unknown> & { id: string };

/**
 * Ugandan phone numbers arrive in several shapes from registration links, CSV
 * imports and collectors typing on the day:
 *   0746057672 / 746057672 / +256746057672 / 256 746 057 672
 * All of these identify the same vendor.
 */
export function phoneVariants(raw: string): string[] {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return [];

  const variants = new Set<string>([digits]);

  let local = digits;
  if (local.startsWith('256')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  local = local.slice(-9);

  if (local.length === 9) {
    variants.add(local);
    variants.add('0' + local);
    variants.add('256' + local);
    variants.add('+256' + local);
  }

  return Array.from(variants);
}

/** Canonical display format (0XXXXXXXXX) when the number looks Ugandan. */
export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';

  let local = digits;
  if (local.startsWith('256')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  local = local.slice(-9);

  return local.length === 9 ? '0' + local : digits;
}

function valueOf(vendor: VendorRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = vendor[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * Finds the vendor behind a phone number, tolerating format differences.
 *
 * When an edition is supplied, vendors who are actually registered for that
 * edition win over an older duplicate profile with the same number. This is
 * what lets a Mbarara paid vendor be autofilled for their survey instead of
 * being mistaken for a brand-new vendor.
 */
export async function findVendorByPhone(
  supabase: SupabaseClient,
  phone: string,
  editionId?: string | null
): Promise<VendorRow | null> {
  const variants = phoneVariants(phone);
  if (variants.length === 0) return null;

  let matches: VendorRow[] = [];

  const { data: exact } = await supabase
    .from('vendors')
    .select('*')
    .in('phone', variants)
    .limit(10);
  if (exact && exact.length > 0) matches = exact as VendorRow[];

  // Some legacy imports stored numbers with spacing/punctuation. Fall back to
  // a substring match on the 9-digit subscriber number.
  if (matches.length === 0) {
    const local = variants.find((v) => v.length === 9);
    if (local) {
      const { data: loose } = await supabase
        .from('vendors')
        .select('*')
        .ilike('phone', `%${local}%`)
        .limit(10);
      if (loose && loose.length > 0) matches = loose as VendorRow[];
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1 || !editionId) return matches[0];

  // Prefer the profile that paid for (or is registered in) this edition.
  const { data: registrations } = await supabase
    .from('vendor_registrations')
    .select('vendor_id, payment_status')
    .eq('market_day_id', editionId)
    .in('vendor_id', matches.map((v) => v.id));

  const registered = new Set(
    (registrations || []).map((r: { vendor_id: string }) => r.vendor_id)
  );
  const paid = new Set(
    (registrations || [])
      .filter((r: { payment_status: string }) => r.payment_status === 'paid')
      .map((r: { vendor_id: string }) => r.vendor_id)
  );

  return matches.find((v) => paid.has(v.id)) || matches.find((v) => registered.has(v.id)) || matches[0];
}

interface SurveyAnswerRow {
  answer: string | null;
  survey_questions: { csv_column: string | null } | null;
}

interface SurveyResponseRow {
  id: string;
  context_id: string | null;
  submitted_at: string | null;
  survey_answers: SurveyAnswerRow[] | null;
}

/**
 * Loads the vendor's saved survey answers. The current edition's response wins;
 * otherwise the most recent response from a previous edition is reused.
 */
export async function fetchVendorSurveyAnswers(
  supabase: SupabaseClient,
  vendorId: string,
  editionId?: string | null
): Promise<{ answers: Record<string, string>; source: 'current' | 'previous' | null }> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select(`
      id,
      context_id,
      submitted_at,
      survey_answers (
        answer,
        survey_questions ( csv_column )
      )
    `)
    .eq('vendor_id', vendorId)
    .order('submitted_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    return { answers: {}, source: null };
  }

  const responses = data as unknown as SurveyResponseRow[];
  const current = editionId
    ? responses.find((r) => r.context_id === editionId)
    : undefined;
  const chosen = current || responses[0];
  if (!chosen) return { answers: {}, source: null };

  const answers: Record<string, string> = {};
  for (const row of chosen.survey_answers || []) {
    const csvColumn = row.survey_questions?.csv_column;
    if (csvColumn && row.answer) answers[csvColumn] = row.answer;
  }

  return { answers, source: current ? 'current' : 'previous' };
}

export interface VendorPrefillResult {
  data: Record<string, string>;
  autofilledFields: string[];
  vendorId: string | null;
  hasPastSurveyData: boolean;
  surveySource: 'current' | 'previous' | null;
}

const EMPTY_PREFILL: VendorPrefillResult = {
  data: {},
  autofilledFields: [],
  vendorId: null,
  hasPastSurveyData: false,
  surveySource: null,
};

/**
 * Builds the full survey prefill for a phone number:
 *   1. saved survey answers (current edition, else most recent past edition)
 *   2. paid registration / vendor profile details to fill any gaps
 *
 * Returns null-ish data when the phone is unknown, which the form treats as a
 * new vendor.
 */
export async function buildVendorPrefill(
  supabase: SupabaseClient,
  phone: string,
  editionId?: string | null
): Promise<VendorPrefillResult> {
  const vendor = await findVendorByPhone(supabase, phone, editionId);
  if (!vendor) return EMPTY_PREFILL;

  const { answers, source } = await fetchVendorSurveyAnswers(supabase, vendor.id, editionId);

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value) data[key] = value;
  }

  const storedPhone = valueOf(vendor, 'phone');
  const displayPhone = normalizePhone(storedPhone) || normalizePhone(phone);
  const registrationFields: Record<string, string> = {
    contact_name: valueOf(vendor, 'contact_name'),
    full_name: valueOf(vendor, 'contact_name'),
    business_name: valueOf(vendor, 'business_name'),
    phone: displayPhone || storedPhone || phone,
    phone_number: displayPhone || storedPhone || phone,
    email: valueOf(vendor, 'email'),
    category: valueOf(vendor, 'category'),
    business_category: valueOf(vendor, 'category'),
  };

  for (const [key, value] of Object.entries(registrationFields)) {
    if (value && !data[key]) data[key] = value;
  }

  // Identity details on the current edition's paid registration are newer than
  // an old survey, so they win over historical answers. Other historical
  // answers (demographics, employees, etc.) are kept as-is.
  const identityFields = new Set([
    'contact_name',
    'full_name',
    'business_name',
    'phone',
    'phone_number',
    'email',
    'category',
    'business_category',
  ]);
  for (const key of identityFields) {
    const value = registrationFields[key];
    if (value) data[key] = value;
  }

  // A paid vendor only counts as "returning" when we actually have a previous
  // survey. With no history they are treated as a new vendor, so the form's
  // new-vendor defaults apply (first time = Yes, standard defaults). A vendor
  // with only older surveys is returning for this edition.
  if (source === null) {
    data.first_time_at_quonnect = 'Yes';
  } else if (source === 'previous') {
    data.first_time_at_quonnect = 'No';
  }

  return {
    data,
    autofilledFields: Object.keys(data),
    vendorId: vendor.id,
    hasPastSurveyData: source !== null,
    surveySource: source,
  };
}
