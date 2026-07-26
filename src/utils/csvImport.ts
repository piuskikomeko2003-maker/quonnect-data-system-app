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
  // Standard format (June onwards)
  full_name: 'full_name',
  business_name: 'business_name',
  phone_number: 'phone_number',
  email: 'email',
  gender: 'gender',
  age: 'age',
  business_category: 'business_category',
  how_long_in_business: 'how_long_in_business',
  primary_income_source: 'primary_source_of_income',
  products_source: 'products_primarily_from',
  business_operates_as: 'business_operates_as',
  first_time_attendee: 'first_time_at_quonnect',
  times_attended: 'times_attended',
  attended_last_quonnect: 'attended_last_quonnect',
  regions_attended: 'regions_attended',
  has_paid_employees: 'paid_employees',
  number_of_employees: 'number_of_employees',
  female_employees_share: 'female_employees',
  youth_employees_share: 'youth_employees',
  new_employees_12mo: 'hired_new_employees',
  hired_new_employees_12mo: 'new_employees_count',
  business_growth_vs_before: 'business_growth',
  quonnect_benefits_summary: 'quonnect_benefits',
  has_active_social_media: 'active_social_media',
  makes_online_sales: 'online_sales',
  how_heard_about_quonnect: 'how_did_you_know',
  would_recommend_quonnect: 'would_recommend',
  main_challenges_summary: 'main_challenges',
  sales_impact: 'sales_impact',
  revenue_impact: 'revenue_impact',

  // May/legacy format fallbacks
  'full name': 'full_name',
  'business name': 'business_name',
  'phone number': 'phone_number',
  'business category': 'business_category',
  'how long in business': 'how_long_in_business',
  'primary source of income?': 'primary_source_of_income',
  'products primarily from?': 'products_primarily_from',
  'business operates as?': 'business_operates_as',
  'first time at quonnect market day?': 'first_time_at_quonnect',
  'times attended?': 'times_attended',
  'attended last quonnect?': 'attended_last_quonnect',
  'paid employees?': 'paid_employees',
  'female employees?': 'female_employees',
  'youth(18-35) employees?': 'youth_employees',
  'hired new employees in past 12 months?': 'hired_new_employees',
  'how many new employees in the past 12 months?': 'new_employees_count',
  'compared to before quonnect,business growth?': 'business_growth',
  'how did you know about quonnect?': 'how_did_you_know',
  'would you recommend quonnect?': 'would_recommend',

  // April legacy format
  'name of respondant': 'full_name',
  'name of business': 'business_name',
  'email address': 'email',
  'how long have you been in this business': 'how_long_in_business',
  'is this your main source of income': 'primary_source_of_income',
  'ls this your first time participating in quonnect': 'first_time_at_quonnect',
  'how did you hear about quonnect': 'how_did_you_know',
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
 * Takes a raw CSV row and returns a clean canonical object.
 * ONE function for ALL editions. No special cases.
 */
export const normalizeCSVRow = (row: Record<string, string>): Record<string, string> => {
  const clean: Record<string, string> = {};
  Object.entries(row).forEach(([key, val]) => {
    const cleanKey = key.replace(/^"|"$/g, '').trim().toLowerCase();
    clean[cleanKey] = String(val ?? '').trim();
  });

  const normalized: Record<string, string> = {};
  Object.entries(clean).forEach(([key, val]) => {
    const csvColumn = HEADER_MAP[key];
    if (csvColumn) normalized[csvColumn] = val;
  });

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

      // Upsert vendor
      const { data: vendorResult, error: vendorError } = await supabase
        .from('vendors')
        .upsert(
          {
            contact_name: normalized.full_name || '',
            business_name: normalized.business_name || '',
            phone: normalized.phone_number || '',
            email: normalized.email || '',
            category: normalized.business_category || '',
            is_active: true,
          },
          { onConflict: 'phone', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (vendorError) {
        results.failed++;
        results.errors.push(
          `Row ${i + 1}: vendor error — ${vendorError.message}`
        );
        continue;
      }

      // Insert survey_response
      const { data: response, error: responseError } = await supabase
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

      if (responseError) {
        results.failed++;
        results.errors.push(
          `Row ${i + 1}: response error — ${responseError.message}`
        );
        continue;
      }

      // Build answers — iterate raw row headers via HEADER_MAP
      const answers: { response_id: string; question_id: string; answer: string }[] = [];

      Object.keys(raw).forEach((header) => {
        if (shouldSkipColumn(header)) return;

        const lowerHeader = header.replace(/^"|"$/g, '').trim().toLowerCase();
        const csvColumn = HEADER_MAP[lowerHeader];
        if (!csvColumn) return;

        const questionId = questionMap[csvColumn];
        if (!questionId) return;

        const value = raw[header];
        if (value === undefined || value === null || value === '') return;

        answers.push({
          response_id: response.id,
          question_id: questionId,
          answer: String(value).trim(),
        });
      });

      // Insert answers in chunks of 50
      for (let j = 0; j < answers.length; j += 50) {
        const chunk = answers.slice(j, j + 50);
        const { error: answerError } = await supabase
          .from('survey_answers')
          .upsert(chunk, {
            onConflict: 'response_id,question_id',
            ignoreDuplicates: true,
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
