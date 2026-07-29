import { createClient } from '@/lib/supabase/client';

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export interface ActiveEdition {
  id: string;
  name: string;
}

// ---- CSV Parsing ----

const parseCSVRow = (line: string, delimiter: string = ','): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseCSVToObjects = (
  text: string,
  delimiter: string = ','
): Record<string, string>[] => {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  const headers = parseCSVRow(lines[0], delimiter);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVRow(lines[i], delimiter);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] || '';
    });
    results.push(rowObj);
  }
  return results;
};

// ---- Universal Header Map ----

/**
 * ONE header map for ALL editions — no special cases per edition.
 * Maps raw CSV column headers (lowercased, trimmed) → canonical csv_column values
 * that match survey_questions.csv_column in the database.
 */
const HEADER_MAP: Record<string, string> = {

  // ── IDENTITY ──────────────────────────────────────────
  'full_name': 'full_name',
  'full name': 'full_name',
  'name of respondant': 'full_name',
  'name of respondent': 'full_name',
  'contact name': 'full_name',

  'business_name': 'business_name',
  'business name': 'business_name',
  'name of business': 'business_name',

  'phone_number': 'phone_number',
  'phone number': 'phone_number',
  'phone': 'phone_number',
  'contact': 'phone_number',

  'email': 'email',
  'email address': 'email',

  // ── DEMOGRAPHICS ──────────────────────────────────────
  // Gender — covers all common CSV header styles:
  // - KoboToolbox short field name: "gender"
  // - Google Forms text: "What is your gender?"
  // - KoboToolbox long label with underscores (after underscore→space): "what is your gender"
  // - Short variants: "sex", "g"
  'gender': 'gender',
  'gender?': 'gender',
  'sex': 'gender',
  'g': 'gender',
  'what is your gender': 'gender',
  'what is your gender?': 'gender',
  'gender of respondent': 'gender',
  'respondent gender': 'gender',
  'sex of respondent': 'gender',
  'please indicate your gender': 'gender',
  'your gender': 'gender',
  'male female other': 'gender',

  'age': 'age',

  // ── BUSINESS PROFILE ──────────────────────────────────
  'business_category': 'business_category',
  'business category': 'business_category',
  'business type': 'business_category',
  'type of business': 'business_category',
  'sector': 'business_category',

  'how_long_in_business': 'how_long_in_business',
  'how long in business': 'how_long_in_business',
  'how long have you been in this business': 'how_long_in_business',
  'how long have you been in business': 'how_long_in_business',
  'years in business': 'how_long_in_business',

  'primary_income_source': 'primary_source_of_income',
  'primary source of income?': 'primary_source_of_income',
  'primary source of income': 'primary_source_of_income',
  'is this business your primary source of income?': 'primary_source_of_income',
  'is this your main source of income': 'primary_source_of_income',
  'primary_source_of_income': 'primary_source_of_income',

  'products_source': 'products_primarily_from',
  'products primarily from?': 'products_primarily_from',
  'products primarily from': 'products_primarily_from',
  'where do your products primarily come from?': 'products_primarily_from',
  'products_primarily_from': 'products_primarily_from',

  'business_operates_as': 'business_operates_as',
  'business operates as?': 'business_operates_as',
  'business operates as': 'business_operates_as',
  'how does your business operate?': 'business_operates_as',
  'what is the primary operational model of your business?': 'business_operates_as',

  // Quonnect attendance history — broadest possible coverage
  // KoboToolbox exports use snake_case field names; Google Forms uses full labels.
  // cleanKey normalises underscores→spaces so all snake_case variants reach here
  // as their space-delimited equivalent.
  'first_time_attendee': 'first_time_at_quonnect',
  'first time at quonnect market day': 'first_time_at_quonnect',
  'first time at quonnect market day?': 'first_time_at_quonnect',
  'is this your first time at quonnect market day': 'first_time_at_quonnect',
  'is this your first time at quonnect market day?': 'first_time_at_quonnect',
  'ls this your first time participating in quonnect': 'first_time_at_quonnect',
  'is this your first time participating in quonnect': 'first_time_at_quonnect',
  'first time at quonnect': 'first_time_at_quonnect',
  'is this your first time': 'first_time_at_quonnect',
  'first quonnect': 'first_time_at_quonnect',
  'first_time_at_quonnect': 'first_time_at_quonnect',

  // times_attended — how many editions
  'times attended': 'times_attended',
  'times attended?': 'times_attended',
  'how many times have you attended quonnect': 'times_attended',
  'how many times have you attended quonnect?': 'times_attended',
  'how many times attended': 'times_attended',
  'how often do you showcase your business with us': 'times_attended',
  'how often do you showcase your business with us?': 'times_attended',
  'approximately how many times have you participated': 'times_attended',
  'number of times attended': 'times_attended',
  'times you have attended quonnect': 'times_attended',
  'times_attended': 'times_attended',
  'how many times have you attended': 'times_attended',
  'no of times attended': 'times_attended',
  'attendance count': 'times_attended',

  // attended_last_quonnect — critical for retention
  'attended last quonnect': 'attended_last_quonnect',
  'attended last quonnect?': 'attended_last_quonnect',
  'attended last edition': 'attended_last_quonnect',
  'did you attend the last quonnect market day': 'attended_last_quonnect',
  'did you attend the last quonnect market day?': 'attended_last_quonnect',
  'did you attend the previous quonnect': 'attended_last_quonnect',
  'did you attend the previous quonnect?': 'attended_last_quonnect',
  'did you attend the last edition': 'attended_last_quonnect',
  'did you attend the previous edition': 'attended_last_quonnect',
  'did you attend last quonnect': 'attended_last_quonnect',
  'did you participate in the last quonnect': 'attended_last_quonnect',
  'attended previous quonnect': 'attended_last_quonnect',
  'attended previous edition': 'attended_last_quonnect',
  'attended_last_quonnect': 'attended_last_quonnect',
  'previous quonnect attendance': 'attended_last_quonnect',
  'were you at the last quonnect': 'attended_last_quonnect',

  // regions_attended — critical for retention
  'regions attended': 'regions_attended',
  'regions attended?': 'regions_attended',
  'which regions have you attended': 'regions_attended',
  'which regions have you attended?': 'regions_attended',
  'which quonnect regions have you attended': 'regions_attended',
  'which quonnect regions have you attended?': 'regions_attended',
  'quonnect regions attended': 'regions_attended',
  'which region': 'regions_attended',
  'region attended': 'regions_attended',
  'regions_attended': 'regions_attended',
  'which regions': 'regions_attended',
  'regions you have attended': 'regions_attended',
  'which locations have you attended': 'regions_attended',

  // ── EMPLOYMENT ────────────────────────────────────────
  'has_paid_employees': 'paid_employees',
  'paid employees?': 'paid_employees',
  'paid employees': 'paid_employees',
  'do you have paid employees?': 'paid_employees',
  'do you have any employees': 'paid_employees',
  'paid_employees': 'paid_employees',

  'number_of_employees': 'number_of_employees',
  'number of employees': 'number_of_employees',
  'how many employees do you have?': 'number_of_employees',
  'how_many_employees_do_you_have': 'number_of_employees',
  'employee count': 'number_of_employees',

  'female_employees_share': 'female_employees',
  'female employees?': 'female_employees',
  'female employees': 'female_employees',
  'what proportion of your employees are female?': 'female_employees',
  'female_employees': 'female_employees',

  'youth_employees_share': 'youth_employees',
  'youth(18-35) employees?': 'youth_employees',
  'youth employees': 'youth_employees',
  'what proportion of your employees are youth (18-35)?': 'youth_employees',
  'youth_employees': 'youth_employees',

  'hired_new_employees_12mo': 'hired_new_employees',
  'hired new employees in past 12 months?': 'hired_new_employees',
  'hired new employees in past 12 months': 'hired_new_employees',
  'did you hire new employees in the past 12 months?': 'hired_new_employees',
  'hired_new_employees': 'hired_new_employees',

  'new_employees_12mo': 'new_employees_count',
  'how many new employees in the past 12 months?': 'new_employees_count',
  'how many new employees did you hire in the past 12 months?': 'new_employees_count',
  'new_employees_count': 'new_employees_count',

  // ── CASUAL HELPERS ────────────────────────────────────
  'hires_casual_helpers': 'hires_casual_helpers',
  'do you hire casual helpers just for market days (loading, setup, etc.)?': 'hires_casual_helpers',
  'do you hire casual helpers just for market days (loading etc.)?': 'hires_casual_helpers',
  'do you hire casual helpers just for market days (loading': 'hires_casual_helpers',
  'do you hire casual helpers just for market days?': 'hires_casual_helpers',
  'do you hire casual helpers': 'hires_casual_helpers',
  'casual helpers': 'hires_casual_helpers',

  'casual_helpers_count': 'casual_helpers_count',
  'number of casual helpers hired?': 'casual_helpers_count',
  'number of casual helpers hired': 'casual_helpers_count',
  'how many casual helpers do you hire per market day?': 'casual_helpers_count',
  'casual helpers count': 'casual_helpers_count',

  // ── BUSINESS GROWTH ───────────────────────────────────
  'business_growth_vs_before': 'business_growth',
  'compared to before quonnect,business growth?': 'business_growth',
  'compared to before quonnect, business growth?': 'business_growth',
  'thinking back over the last 6 months, how would you describe the growth of your business?': 'business_growth',
  'business_growth': 'business_growth',

  'quonnect_benefits_summary': 'quonnect_benefits',
  'how has quonnect benefited your business? (select all that apply)': 'quonnect_benefits',
  'how has quonnect benefited your business?': 'quonnect_benefits',
  'in what ways has quonnect market day impacted your business? (select all that apply)': 'quonnect_benefits',
  'quonnect_benefits': 'quonnect_benefits',

  // ── DIGITAL PRESENCE ──────────────────────────────────
  'has_active_social_media': 'active_social_media',
  'does your business have active social media?': 'active_social_media',
  'active social media': 'active_social_media',
  'active_social_media': 'active_social_media',

  'makes_online_sales': 'online_sales',
  'do you make online sales?': 'online_sales',
  'online sales': 'online_sales',
  'online_sales': 'online_sales',

  // ── FEEDBACK ──────────────────────────────────────────
  'how_heard_about_quonnect': 'how_did_you_know',
  'how did you know about quonnect?': 'how_did_you_know',
  'how did you hear about quonnect?': 'how_did_you_know',
  'how did you hear about quonnect': 'how_did_you_know',
  'how_did_you_know': 'how_did_you_know',

  // would_recommend — critical for feedback
  'would recommend': 'would_recommend',
  'would recommend quonnect': 'would_recommend',
  'would you recommend quonnect': 'would_recommend',
  'would you recommend quonnect?': 'would_recommend',
  'would you recommend quonnect to others': 'would_recommend',
  'would you recommend quonnect to others?': 'would_recommend',
  'recommend quonnect': 'would_recommend',
  'recommend to others': 'would_recommend',
  'would_recommend_quonnect': 'would_recommend',
  'would_recommend': 'would_recommend',
  'nps': 'would_recommend',

  'main_challenges_summary': 'main_challenges',
  'what are your main business challenges? (select all that apply)': 'main_challenges',
  'main business challenges': 'main_challenges',
  'what are the biggest challenges affecting your business growth? (select all that apply)': 'main_challenges',
  'main_challenges': 'main_challenges',
};

// ---- Metadata Column Filter ----

const metadataPrefixes = ['_', '/'];
const metadataKeywords = [
  'uuid', 'submission_time', 'validation_status', 'submitted_by',
  'start', 'end', 'today', 'deviceid', 'simserial', 'phonenumber',
  'instanceid', 'formhub/uuid', 'meta/instanceid',
];

const shouldSkipColumn = (header: string): boolean => {
  const lower = header.toLowerCase().trim();
  for (const prefix of metadataPrefixes) {
    if (lower.startsWith(prefix)) return true;
  }
  for (const kw of metadataKeywords) {
    if (lower === kw || lower.includes(kw)) return true;
  }
  if (lower.includes('/')) return true;
  return false;
};

// ---- Normalization ----

/**
 * Normalises a raw CSV header key to a canonical lookup form.
 * Strategy applied in order:
 *  1. Strip surrounding quotes and smart-quotes
 *  2. Collapse multi-whitespace to single space
 *  3. Replace underscores with spaces (KoboToolbox exports field labels with _)
 *  4. Trim and lowercase
 *
 * KoboToolbox exports column headers as either:
 *   a) Short field name: "attended_last_quonnect"  → "attended last quonnect"  ✓ in HEADER_MAP
 *   b) Full label with _: "Did_you_attend_the_last_Quonnect_Market_Day_"  → "did you attend the last quonnect market day" ✓
 */
const cleanKey = (key: string): string => key
  .replace(/^["'\u201C\u201D\s]+|["'\u201C\u201D\s]+$/g, '') // strip surrounding quotes/spaces
  .replace(/[\n\r]/g, ' ')                                   // newlines → space
  .replace(/_/g, ' ')                                        // underscores → space (KoboToolbox)
  .replace(/\s+/g, ' ')                                      // collapse multi-space
  .trim()
  .toLowerCase();

const normalizeAnswer = (csvColumn: string, value: string): string => {
  const v = value.trim();

  if (csvColumn === 'gender') {
    // Normalize to canonical 'Female' / 'Male' / 'Other'.
    // Handles: f, F, female, FEMALE, woman, Woman, m, M, male, MALE, man, Man, o, other
    // Also handles values already stored from Quick Entry (passed through without normalisation)
    const lower = v.toLowerCase();
    if (['female', 'f', 'woman', 'w', 'fem'].includes(lower)) return 'Female';
    if (['male', 'm', 'man'].includes(lower)) return 'Male';
    if (['other', 'o', 'non-binary', 'nonbinary', 'prefer not to say', 'pnts'].includes(lower)) return 'Other';
    return v; // leave untouched if not recognized — resolveGender handles case-insensitive lookup
  }

  if (
    csvColumn === 'attended_last_quonnect' ||
    csvColumn === 'first_time_at_quonnect' ||
    csvColumn === 'paid_employees' ||
    csvColumn === 'active_social_media' ||
    csvColumn === 'online_sales' ||
    csvColumn === 'hired_new_employees' ||
    csvColumn === 'hires_casual_helpers'
  ) {
    const lower = v.toLowerCase();
    if (['yes', 'true', '1', 'y', 'yeah', 'yep', 'definitely'].includes(lower)) return 'Yes';
    if (['no', 'false', '0', 'n', 'nope', 'never'].includes(lower)) return 'No';
    return v;
  }

  return v;
};

const SKIPPED_HEADERS = new Set([
  'start', 'end', '_id', '_uuid', 'submission_time',
  'submitted_by', '__version__', 'root_uuid', '_index',
  'meta/rootuuid', '_status', '_notes', '_tags',
  'validation_status', '_submission_time',
  '_submitted_by', 'kobo_id', 'kobo_uuid',
  'row_index', 'form_version', 'submission_status',
]);

/**
 * Takes a raw CSV row and returns a clean canonical object.
 * ONE function for ALL editions. No special cases.
 */
export const normalizeCSVRow = (row: Record<string, string>): Record<string, string> => {
  const clean: Record<string, string> = {};
  Object.entries(row).forEach(([key, val]) => {
    clean[cleanKey(key)] = String(val ?? '').trim();
  });

  const normalized: Record<string, string> = {};
  Object.entries(clean).forEach(([key, val]) => {
    const csvColumn = HEADER_MAP[key];
    if (csvColumn) normalized[csvColumn] = val;
  });

  const unmapped = Object.keys(clean).filter((key) =>
    !HEADER_MAP[key] &&
    !SKIPPED_HEADERS.has(key) &&
    !key.includes('/')
  );

  if (unmapped.length > 0) {
    console.warn('Unmapped CSV headers (add to headerMap if needed):', unmapped);
  }

  return normalized;
};

// ---- Main Import Function ----

/**
 * ONE import function for ALL editions.
 * Receives (file, activeEdition, supabase, onProgress?)
 * Always produces the same output regardless of which edition.
 */
export const importCSV = async (
  file: File,
  activeEdition: ActiveEdition,
  supabase: ReturnType<typeof createClient>,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> => {
  if (!activeEdition?.id) {
    throw new Error('No active edition selected');
  }

  const text = await file.text();
  const delimiter = text.split('\n')[0].includes(';') ? ';' : ',';

  const rows = parseCSVToObjects(text, delimiter);

  if (rows.length === 0) {
    throw new Error('CSV is empty or unreadable');
  }

  console.log(`Importing ${rows.length} rows to ${activeEdition.name}`);
  console.log('CSV headers detected:', Object.keys(rows[0] || {}));

  // Fetch form
  const { data: formData, error: fError } = await supabase
    .from('forms')
    .select('id')
    .eq('slug', 'vendor_data_collection')
    .single();

  if (fError) throw new Error(`Form lookup failed: ${fError.message}`);
  if (!formData) throw new Error('Vendor Data Collection Survey form not found');

  const formId = formData.id;

  // Fetch questions
  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, csv_column')
    .eq('form_id', formId);

  if (!questions || questions.length === 0) {
    throw new Error('No questions found for this form');
  }

  interface QRow { id: string; csv_column: string | null }
  const questionMap: Record<string, string> = {};
  questions.forEach((q: QRow) => {
    if (q.csv_column) questionMap[q.csv_column] = q.id;
  });

  const results: ImportResult = { success: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as Record<string, string>;
    onProgress?.(i + 1, rows.length);

    try {
      const normalized = normalizeCSVRow(raw);

      if (!normalized.full_name && !normalized.business_name) {
        console.warn(`Row ${i + 1}: skipping — no name or business`);
        continue;
      }

      // ── H1 FIX: Guard empty phone ──────────────────────────────────────────
      // If phone is blank, use INSERT (no conflict key available).
      // If phone is present, use UPSERT on phone to merge existing vendor records.
      // Rationale: upsert on phone='' causes the second blank-phone vendor to
      // silently overwrite the first one's name/business/email — data corruption.
      const vendorPayload = {
        contact_name: normalized.full_name || '',
        business_name: normalized.business_name || '',
        phone: normalized.phone_number?.trim() || '',
        email: normalized.email || '',
        category: normalized.business_category || '',
        is_active: true,
      };

      let vendorResult: { id: string } | null = null;
      let vendorError: any = null;

      if (!normalized.phone_number?.trim()) {
        // No phone — plain INSERT, each row is a distinct vendor record
        const { data, error } = await supabase
          .from('vendors')
          .insert(vendorPayload)
          .select('id')
          .single();
        vendorResult = data;
        vendorError = error;
      } else {
        // Phone present — UPSERT to merge/update existing vendor by phone
        const { data, error } = await supabase
          .from('vendors')
          .upsert(vendorPayload, { onConflict: 'phone', ignoreDuplicates: false })
          .select('id')
          .single();
        vendorResult = data;
        vendorError = error;
      }

      if (vendorError || !vendorResult) {
        results.failed++;
        results.errors.push(
          `Row ${i + 1}: vendor error — ${vendorError?.message || 'no data returned'}`
        );
        continue;
      }

      // ── H2 FIX: Deduplicate survey_responses without requiring a DB constraint ──
      // Strategy: check if a response already exists for this vendor + edition.
      // If yes → reuse the existing response row (answers will upsert on top).
      // If no  → insert a fresh response row.
      // This prevents re-importing the same CSV from inflating chart metrics 2×,
      // and works WITHOUT requiring a UNIQUE constraint on (vendor_id, context_id).
      let responseId: string | null = null;

      const { data: existingResponse } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('vendor_id', vendorResult.id)
        .eq('context_id', activeEdition.id)
        .maybeSingle();

      if (existingResponse?.id) {
        // Response already exists — reuse it (idempotent re-import)
        responseId = existingResponse.id;
      } else {
        // No existing response — insert a new one
        const { data: newResponse, error: responseError } = await supabase
          .from('survey_responses')
          .insert({
            form_id: formId,
            context_type: 'market_day',
            context_id: activeEdition.id,
            vendor_id: vendorResult.id,
            source: 'csv_import',
            import_batch: file.name,
          })
          .select('id')
          .single();

        if (responseError || !newResponse) {
          results.failed++;
          results.errors.push(
            `Row ${i + 1}: response error — ${responseError?.message || 'no response returned'}`
          );
          continue;
        }
        responseId = newResponse.id;
      }

      if (!responseId) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: could not obtain a response ID`);
        continue;
      }


      // Build answers — iterate raw row headers via HEADER_MAP
      const answers: { response_id: string; question_id: string; answer: string }[] = [];

      // Diagnostic: log the full header mapping for the first row only
      if (i === 0) {
        console.log('=== IMPORT DIAGNOSTIC (Row 1) ===');
        console.log('Raw headers:', Object.keys(raw));
        console.log('questionMap csv_columns:', Object.keys(questionMap));
        Object.keys(raw).forEach((header) => {
          const cleaned = cleanKey(header);
          const csvCol = HEADER_MAP[cleaned];
          const qId = csvCol ? questionMap[csvCol] : undefined;
          const val = raw[header];
          const skipped = shouldSkipColumn(header);
          if (!skipped && csvCol) {
            console.log(`  ✅ "${header}" → cleanKey="${cleaned}" → csv="${csvCol}" → qId=${qId ? 'YES' : 'MISSING'} → val="${String(val).substring(0, 30)}"`);
          } else if (!skipped && !csvCol) {
            console.log(`  ❌ "${header}" → cleanKey="${cleaned}" → NO MATCH in HEADER_MAP`);
          }
        });
      }

      Object.keys(raw).forEach((header) => {
        if (shouldSkipColumn(header)) return;

        const csvColumn = HEADER_MAP[cleanKey(header)];
        if (!csvColumn) return;

        const questionId = questionMap[csvColumn];
        if (!questionId) return;

        const value = raw[header];
        if (value === undefined || value === null || value === '') return;

        answers.push({
          response_id: responseId,
          question_id: questionId,
          answer: normalizeAnswer(csvColumn, String(value)),
        });
      });

      // Insert answers in chunks of 50
      for (let j = 0; j < answers.length; j += 50) {
        const chunk = answers.slice(j, j + 50);
        const { error: answerError } = await supabase
          .from('survey_answers')
          .upsert(chunk, {
            onConflict: 'response_id,question_id',
            ignoreDuplicates: false, // Update existing answers on re-import (e.g., corrected gender values)
          });

        if (answerError) {
          console.error(`Row ${i + 1} answers chunk error:`, answerError.message);
        }
      }

      results.success++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.failed++;
      results.errors.push(`Row ${i + 1}: ${message}`);
      console.error(`Row ${i + 1} failed:`, message);
    }
  }

  console.log('Import complete:', results);
  return results;
};
