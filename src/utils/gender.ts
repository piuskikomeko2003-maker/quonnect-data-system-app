const GENDER_COLUMNS = ['gender', 'g', 'sex'] as const;

export type Gender = 'Female' | 'Male' | 'Other' | 'Unknown';

/**
 * Resolves gender from an answerMap keyed by csv_column.
 * Case-insensitive: handles values stored as 'Male', 'MALE', 'male', 'M', 'm', 'man', etc.
 * This is intentionally lenient because Quick Entry and CSV import may store
 * values that bypass normalizeAnswer (e.g., values entered directly via the form UI).
 */
export function resolveGender(answerMap: Record<string, string | undefined>): Gender {
  for (const col of GENDER_COLUMNS) {
    const val = answerMap[col];
    if (val != null && val !== '') {
      const normalized = normalizeGender(val);
      if (normalized !== 'Unknown') return normalized;
    }
  }
  return 'Unknown';
}

export function isGenderColumn(csvColumn: string | null | undefined): boolean {
  return csvColumn != null && GENDER_COLUMNS.includes(csvColumn as typeof GENDER_COLUMNS[number]);
}

export function isGenderValue(answer: string | null | undefined, target: Gender): boolean {
  return answer != null && normalizeGender(answer) === target;
}

/**
 * Normalises any stored gender string to the canonical type.
 * Handles all casing, abbreviations, and common alternatives used across
 * KoboToolbox, Google Forms, and manual Quick Entry inputs.
 */
export function normalizeGender(val: string): Gender {
  const clean = val.trim().toLowerCase();
  if (['female', 'f', 'woman', 'w', 'fem', 'girl'].includes(clean)) return 'Female';
  if (['male', 'm', 'man', 'boy'].includes(clean)) return 'Male';
  if (['other', 'o', 'non-binary', 'nonbinary', 'prefer not to say', 'pnts'].includes(clean)) return 'Other';
  return 'Unknown';
}
