const GENDER_COLUMNS = ['gender', 'g'] as const;

export type Gender = 'Female' | 'Male' | 'Other' | 'Unknown';

export function resolveGender(answerMap: Record<string, string | undefined>): Gender {
  for (const col of GENDER_COLUMNS) {
    const val = answerMap[col];
    if (val === 'Female' || val === 'Male' || val === 'Other') return val;
  }
  return 'Unknown';
}

export function isGenderColumn(csvColumn: string | null | undefined): boolean {
  return csvColumn != null && GENDER_COLUMNS.includes(csvColumn as typeof GENDER_COLUMNS[number]);
}

export function isGenderValue(answer: string | null | undefined, target: Gender): boolean {
  return answer != null && normalizeGender(answer) === target;
}

function normalizeGender(val: string): Gender {
  const clean = val.trim();
  if (clean === 'Female' || clean === 'F') return 'Female';
  if (clean === 'Male' || clean === 'M') return 'Male';
  if (clean === 'Other' || clean === 'O') return 'Other';
  return 'Unknown';
}
