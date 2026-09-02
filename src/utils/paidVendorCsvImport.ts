/**
 * paidVendorCsvImport.ts
 * ----------------------
 * CSV Import utility for the Paid Vendor List.
 *
 * DESIGN NOTES:
 * - Completely separate from csvImport.ts (which handles survey/field-collection imports)
 * - Inserts into: vendors (upsert) + vendor_registrations (payment_status='paid')
 * - Does NOT touch: survey_responses, survey_answers, or any form data
 * - Minimum required column: a name column (contact_name / full_name / name / business_name)
 * - Fuzzy duplicate detection is done in JS (no pg_trgm needed)
 * - Vendors table columns: id, business_name, contact_name, phone, email, category,
 *   is_active, created_at, updated_at — NO source or is_complete columns exist.
 * - Name-only rows (no phone/email): inserted with empty phone/email, is_active=true.
 *   A vendor_registrations row with payment_status='paid' is always created for every row.
 * - Vendors with phone: upsert on phone (merges existing record); phone is stored
 *   without spaces for consistent conflict detection.
 */

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedVendorRow {
  /** Raw row index (1-based, for error messages) */
  rowIndex: number;
  /** Canonical extracted fields */
  contactName: string;
  businessName: string;
  phone: string;
  email: string;
  category: string;
  amountPaid: number;
  /** True if only name is present (no phone, no email) */
  isMinimal: boolean;
}

export type DuplicateStatus = 'new' | 'likely_duplicate' | 'exact_duplicate';

export interface RowPreview extends ParsedVendorRow {
  status: DuplicateStatus;
  /** Only set when status !== 'new' */
  matchedName?: string;
  /** 0–1 similarity score (1 = identical) */
  similarity?: number;
  /** User override: if true, import this row even if flagged as duplicate */
  importAnyway: boolean;
}

export interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: string[];
  batchId: string;
  importedAt: string;
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

const parseCSVRow = (line: string, delimiter: string): string[] => {
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

const detectDelimiter = (firstLine: string): string => {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
};

/**
 * Parse raw CSV text into an array of header-keyed row objects.
 */
export const parseCsvText = (text: string): Record<string, string>[] => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVRow(lines[0], delimiter).map(h =>
    h.replace(/^["\u201C\u201D\s]+|["\u201C\u201D\s]+$/g, '').trim()
  );
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
};

// ─── Column Detection ─────────────────────────────────────────────────────────

/**
 * Maps raw CSV headers (case-insensitive) to canonical vendor fields.
 * Only `name` (any form) is required — everything else is optional.
 */
const NAME_ALIASES = [
  'name', 'contact_name', 'contact name', 'full_name', 'full name',
  'vendor name', 'vendor_name', 'person name', 'person_name',
  'respondent name', 'respondent_name', 'owner name', 'owner_name',
];
const BUSINESS_ALIASES = [
  'business_name', 'business name', 'business', 'company', 'company name',
  'company_name', 'shop name', 'shop_name', 'stall name', 'stall_name',
  'trade name', 'trade_name', 'organisation', 'organization',
];
const PHONE_ALIASES = [
  'phone', 'phone_number', 'phone number', 'mobile', 'mobile number',
  'mobile_number', 'tel', 'telephone', 'contact', 'contact_number',
  'contact number', 'whatsapp',
];
const EMAIL_ALIASES = [
  'email', 'email_address', 'email address', 'e-mail', 'e_mail',
];
const CATEGORY_ALIASES = [
  'category', 'business_category', 'business category', 'sector',
  'business_type', 'business type', 'type', 'industry',
];
const AMOUNT_ALIASES = [
  'amount_paid', 'amount paid', 'amount', 'payment', 'payment_amount',
  'payment amount', 'paid_amount', 'paid amount', 'paid', 'fee',
  'registration_fee', 'registration fee', 'price', 'ugx', 'cost',
];

const findHeader = (
  rawHeaders: string[],
  aliases: string[]
): string | undefined => {
  const normalized = rawHeaders.map(h => h.toLowerCase().replace(/_/g, ' ').trim());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx !== -1) return rawHeaders[idx];
  }
  return undefined;
};

export interface ColumnMap {
  nameHeader?: string;
  businessHeader?: string;
  phoneHeader?: string;
  emailHeader?: string;
  categoryHeader?: string;
  amountHeader?: string;
}

export const parseAmount = (val: string | undefined | null): number => {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? 0 : num;
};

export const detectColumns = (rawHeaders: string[]): ColumnMap => ({
  nameHeader: findHeader(rawHeaders, NAME_ALIASES),
  businessHeader: findHeader(rawHeaders, BUSINESS_ALIASES),
  phoneHeader: findHeader(rawHeaders, PHONE_ALIASES),
  emailHeader: findHeader(rawHeaders, EMAIL_ALIASES),
  categoryHeader: findHeader(rawHeaders, CATEGORY_ALIASES),
  amountHeader: findHeader(rawHeaders, AMOUNT_ALIASES),
});

// ─── Row Extraction ───────────────────────────────────────────────────────────

/**
 * Extract canonical vendor fields from raw CSV rows using the detected column map.
 * Skips rows with no usable name.
 */
export const extractVendorRows = (
  rawRows: Record<string, string>[],
  colMap: ColumnMap
): ParsedVendorRow[] => {
  const results: ParsedVendorRow[] = [];
  const hasBothNames = Boolean(
    colMap.nameHeader &&
    colMap.businessHeader &&
    colMap.nameHeader.toLowerCase().trim() !== colMap.businessHeader.toLowerCase().trim()
  );

  rawRows.forEach((row, idx) => {
    let businessName = '';
    let contactName = '';

    if (hasBothNames) {
      businessName = (colMap.businessHeader ? row[colMap.businessHeader] : '') || '';
      contactName = (colMap.nameHeader ? row[colMap.nameHeader] : '') || '';
    } else {
      // Single name header provided -> map to businessName, leave contactName blank
      businessName = (colMap.businessHeader ? row[colMap.businessHeader] : colMap.nameHeader ? row[colMap.nameHeader] : '') || '';
      contactName = '';
    }

    const phone = (colMap.phoneHeader ? row[colMap.phoneHeader] : '') || '';
    const email = (colMap.emailHeader ? row[colMap.emailHeader] : '') || '';
    const category = (colMap.categoryHeader ? row[colMap.categoryHeader] : '') || '';
    const amountPaid = parseAmount(colMap.amountHeader ? row[colMap.amountHeader] : '');

    // Must have at least a name or business name
    if (!contactName.trim() && !businessName.trim()) {
      console.warn(`Row ${idx + 2}: skipped — no name or business name found`);
      return;
    }

    const isMinimal = !phone.trim() && !email.trim();

    results.push({
      rowIndex: idx + 2, // 1-based, +1 for header row
      contactName: contactName.trim(),
      businessName: businessName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      category: category.trim(),
      amountPaid,
      isMinimal,
    });
  });

  return results;
};

// ─── Fuzzy Duplicate Detection ────────────────────────────────────────────────

/**
 * Normalize a vendor name for fuzzy comparison.
 * Strips punctuation, lowercases, collapses whitespace.
 */
export const normalizeVendorName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[''`´]/g, '')         // apostrophes → remove (John's → johns)
    .replace(/[^a-z0-9\s]/g, ' ')   // other punctuation → space
    .replace(/\s+/g, ' ')           // collapse spaces
    .trim();

/**
 * Levenshtein distance (edit distance) between two strings.
 * Returns the minimum number of single-character edits.
 */
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * Similarity score between 0 and 1.
 * 1.0 = identical, 0.0 = completely different.
 */
const similarity = (a: string, b: string): number => {
  const na = normalizeVendorName(a);
  const nb = normalizeVendorName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
};

/** Similarity threshold above which we flag as a likely duplicate. */
const DUPLICATE_THRESHOLD = 0.8;
/** Threshold above which we flag as an exact duplicate. */
const EXACT_THRESHOLD = 0.95;

export interface ExistingVendor {
  id: string;
  contactName: string;
  businessName: string;
  phone: string;
}

/**
 * For each parsed row, find the best-matching existing vendor by name.
 * Returns preview rows with duplicate status and match info.
 */
export const buildPreview = (
  rows: ParsedVendorRow[],
  existingVendors: ExistingVendor[]
): RowPreview[] => {
  return rows.map(row => {
    const importName = row.businessName || row.contactName;

    // First check for phone match (exact duplicate regardless of name)
    if (row.phone) {
      const phoneMatch = existingVendors.find(
        ev => ev.phone && ev.phone.replace(/\s/g, '') === row.phone.replace(/\s/g, '')
      );
      if (phoneMatch) {
        return {
          ...row,
          status: 'exact_duplicate' as DuplicateStatus,
          matchedName: phoneMatch.businessName || phoneMatch.contactName,
          similarity: 1.0,
          importAnyway: false,
        };
      }
    }

    // Then fuzzy name match
    let bestScore = 0;
    let bestMatch: ExistingVendor | undefined;

    for (const ev of existingVendors) {
      const evName = ev.businessName || ev.contactName;
      if (!evName) continue;
      const score = similarity(importName, evName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ev;
      }
      // Also check contact name against business name and vice versa
      if (row.contactName) {
        const contactScore = similarity(row.contactName, evName);
        if (contactScore > bestScore) {
          bestScore = contactScore;
          bestMatch = ev;
        }
      }
    }

    if (bestScore >= EXACT_THRESHOLD) {
      return {
        ...row,
        status: 'exact_duplicate' as DuplicateStatus,
        matchedName: bestMatch?.businessName || bestMatch?.contactName,
        similarity: bestScore,
        importAnyway: false,
      };
    }

    if (bestScore >= DUPLICATE_THRESHOLD) {
      return {
        ...row,
        status: 'likely_duplicate' as DuplicateStatus,
        matchedName: bestMatch?.businessName || bestMatch?.contactName,
        similarity: bestScore,
        importAnyway: false,
      };
    }

    return {
      ...row,
      status: 'new' as DuplicateStatus,
      importAnyway: false,
    };
  });
};

// ─── Fetch Existing Vendors ───────────────────────────────────────────────────

/**
 * Loads all existing vendor names/phones from the DB for duplicate checking.
 * Only fetches the fields needed for comparison (not full profiles).
 */
export const fetchExistingVendors = async (
  supabase: ReturnType<typeof createClient>
): Promise<ExistingVendor[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('vendors')
    .select('id, contact_name, business_name, phone')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch existing vendors for dedup:', error.message);
    return [];
  }

  return (data || []).map((v: any) => ({
    id: v.id,
    contactName: v.contact_name || '',
    businessName: v.business_name || '',
    phone: v.phone || '',
  }));
};

// ─── Main Import Function ─────────────────────────────────────────────────────

/**
 * Import confirmed vendor rows into the database.
 *
 * For each row:
 * 1. Upsert `vendors` on phone (if phone present) or plain insert (no phone).
 *    Only columns that exist on the table are written: contact_name, business_name,
 *    phone, email, category, is_active.
 * 2. Insert `vendor_registrations` with payment_status='paid' for the edition.
 *    Skipped if a registration for this vendor+edition already exists.
 * 3. Rows flagged as exact_duplicate and importAnyway=false are skipped entirely.
 */
export const importPaidVendors = async (
  rows: RowPreview[],
  edition: { id: string; name: string },
  supabase: ReturnType<typeof createClient>,
  onProgress?: (current: number, total: number) => void
): Promise<ImportSummary> => {
  if (!supabase) throw new Error('Supabase client not initialized');

  const batchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const summary: ImportSummary = { inserted: 0, skipped: 0, errors: [], batchId, importedAt };

  // Only import: new rows + likely_duplicate with importAnyway=true
  const rowsToImport = rows.filter(
    r => r.status === 'new' || (r.status === 'likely_duplicate' && r.importAnyway)
  );
  const rowsToSkip = rows.filter(
    r => r.status === 'exact_duplicate' || (r.status === 'likely_duplicate' && !r.importAnyway)
  );

  summary.skipped = rowsToSkip.length;

  for (let i = 0; i < rowsToImport.length; i++) {
    const row = rowsToImport[i];
    onProgress?.(i + 1, rowsToImport.length);

    try {
      // ── Step 1: Upsert or Insert vendor ──────────────────────────────────
      // Normalise phone: strip spaces so DB upsert conflict on `phone` is reliable.
      const normalisedPhone = row.phone.replace(/\s/g, '');
      const vendorPayload: Record<string, any> = {
        business_name: row.businessName || row.contactName || '',
        contact_name: row.contactName || '',
        phone: normalisedPhone || null,
        email: row.email || '',
        category: row.category || '',
        is_active: true,
        import_batch: batchId,
        // NOTE: vendors table has no `source` or `is_complete` columns.
      };

      let vendorId: string | null = null;
      let vendorError: any = null;

      if (normalisedPhone) {
        // Phone present → upsert on phone (merges with existing record)
        const { data, error } = await supabase
          .from('vendors')
          .upsert(vendorPayload, { onConflict: 'phone', ignoreDuplicates: false })
          .select('id')
          .single();
        vendorId = data?.id ?? null;
        vendorError = error;
      } else {
        // No phone → plain insert (each name-only row becomes its own record)
        const { data, error } = await supabase
          .from('vendors')
          .insert(vendorPayload)
          .select('id')
          .single();
        vendorId = data?.id ?? null;
        vendorError = error;
      }

      if (vendorError || !vendorId) {
        summary.errors.push(
          `Row ${row.rowIndex} (${row.businessName || row.contactName}): vendor save failed — ${vendorError?.message || 'no ID returned'}`
        );
        summary.skipped++;
        continue;
      }

      // ── Step 2: Insert vendor_registration with payment_status='paid' ─────
      // Check if this vendor already has a registration for this edition
      const { data: existingReg } = await supabase
        .from('vendor_registrations')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('market_day_id', edition.id)
        .maybeSingle();

      if (!existingReg) {
        const standardFee = Number((edition as any)?.standard_fee) || 92000;
        const finalAmount = row.amountPaid > 0 ? row.amountPaid : standardFee;
        const feeSource = row.amountPaid > 0 && row.amountPaid !== standardFee ? 'override' : 'standard';

        const { error: regError } = await supabase
          .from('vendor_registrations')
          .insert({
            vendor_id: vendorId,
            market_day_id: edition.id,
            payment_status: 'paid',
            amount_paid: finalAmount,
            fee_source: feeSource,
            import_batch: batchId,
          });

        if (regError) {
          // If fee_source column doesn't exist, fallback without it
          await supabase
            .from('vendor_registrations')
            .insert({
              vendor_id: vendorId,
              market_day_id: edition.id,
              payment_status: 'paid',
              amount_paid: finalAmount,
              import_batch: batchId,
            });
        }
      }
      // If existingReg exists, vendor is already registered for this edition — skip duplicate reg

      summary.inserted++;
    } catch (err: any) {
      summary.errors.push(`Row ${row.rowIndex}: unexpected error — ${err?.message || String(err)}`);
      summary.skipped++;
    }
  }

  return summary;
};

// ─── Import Log ───────────────────────────────────────────────────────────────

/**
 * Write an audit record to csv_import_log (if it exists in the schema).
 * Non-fatal — import proceeds even if logging fails.
 */
export const logImportBatch = async (
  summary: ImportSummary,
  edition: { id: string; name: string },
  importedBy: string | null,
  fileName: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('csv_import_log').insert({
      import_batch: summary.batchId,
      filename: fileName,
      context_type: 'market_day',
      context_id: edition.id,
      imported_by: importedBy,
      rows_processed: summary.inserted + summary.skipped,
      rows_inserted: summary.inserted,
      rows_skipped: summary.skipped,
      rows_errored: summary.errors.length,
      error_details: summary.errors,
      imported_at: summary.importedAt,
    });
  } catch (err: any) {
    // Log table may not exist — non-fatal
    console.warn('Could not write to csv_import_log:', err?.message);
  }
};

// ─── Batch Deletion ───────────────────────────────────────────────────────────

export interface DeleteBatchResult {
  deletedRegistrations: number;
  deletedVendors: number;
}

/**
 * Delete everything a paid-vendor CSV import batch created.
 *
 * 1. Deletes `vendor_registrations` rows tagged with this batch id.
 * 2. Deletes `vendors` rows tagged with this batch id that are no longer
 *    referenced by any registration or survey response (orphaned name-only
 *    vendors). Vendors still referenced elsewhere are left untouched.
 */
export const deleteImportBatch = async (
  batchId: string,
  supabase: ReturnType<typeof createClient>
): Promise<DeleteBatchResult> => {
  if (!supabase) throw new Error('Supabase client not initialized');

  // Collect vendor ids tagged with this batch so we can clean up orphans after.
  const { data: taggedVendors, error: taggedErr } = await supabase
    .from('vendors')
    .select('id')
    .eq('import_batch', batchId);
  if (taggedErr) throw taggedErr;
  const vendorIds: string[] = (taggedVendors || []).map((v: any) => v.id);

  // Delete the registrations for this batch.
  const { error: regErr, count: deletedRegistrations } = await supabase
    .from('vendor_registrations')
    .delete({ count: 'exact' })
    .eq('import_batch', batchId);
  if (regErr) throw regErr;

  // Delete orphaned vendors (no remaining registration or survey response).
  let deletedVendors = 0;
  if (vendorIds.length > 0) {
    const stillReferenced = new Set<string>();

    const { data: remainingRegs } = await supabase
      .from('vendor_registrations')
      .select('vendor_id')
      .in('vendor_id', vendorIds);
    (remainingRegs || []).forEach((r: any) => r.vendor_id && stillReferenced.add(r.vendor_id));

    const { data: remainingSr } = await supabase
      .from('survey_responses')
      .select('vendor_id')
      .in('vendor_id', vendorIds);
    (remainingSr || []).forEach((r: any) => r.vendor_id && stillReferenced.add(r.vendor_id));

    const orphans = vendorIds.filter(id => !stillReferenced.has(id));
    if (orphans.length > 0) {
      const { error: vendorErr, count } = await supabase
        .from('vendors')
        .delete({ count: 'exact' })
        .in('id', orphans);
      if (vendorErr) throw vendorErr;
      deletedVendors = count ?? 0;
    }
  }

  return { deletedRegistrations: deletedRegistrations ?? 0, deletedVendors };
};
