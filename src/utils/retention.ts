const FIRST_TIMER_COLUMNS = ['first_time_at_quonnect'] as const;
const ATTENDANCE_COLUMNS = ['times_attended'] as const;
const ATTENDED_LAST_COLUMNS = ['attended_last_quonnect'] as const;
const REGIONS_ATTENDED_COLUMNS = ['regions_attended'] as const;

function normalizeYesNo(val: string): boolean | null {
  const clean = val.trim().toLowerCase();
  if (clean === 'yes' || clean === 'y' || clean === 'true' || clean === '1') return true;
  if (clean === 'no' || clean === 'n' || clean === 'false' || clean === '0') return false;
  return null;
}

function pickValue(columns: readonly string[], answerMap: Record<string, string | undefined>): string | undefined {
  for (const col of columns) {
    const val = answerMap[col];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return undefined;
}

export function isFirstTimer(answerMap: Record<string, string | undefined>): boolean | null {
  const val = pickValue(FIRST_TIMER_COLUMNS, answerMap);
  if (val === undefined) return null;
  return normalizeYesNo(val);
}

export function isReturning(answerMap: Record<string, string | undefined>): boolean | null {
  const ft = isFirstTimer(answerMap);
  if (ft === true) return false;
  if (ft === false) return true;

  const attendedLast = pickValue(ATTENDED_LAST_COLUMNS, answerMap);
  if (attendedLast !== undefined && normalizeYesNo(attendedLast) === true) return true;

  const raw = pickValue(ATTENDANCE_COLUMNS, answerMap);
  if (raw !== undefined) {
    const num = parseInt(raw);
    if (!isNaN(num) && num >= 2) return true;
  }

  return null;
}

export function getAttendanceCount(answerMap: Record<string, string | undefined>): number {
  const raw = pickValue(ATTENDANCE_COLUMNS, answerMap);
  if (raw !== undefined) {
    const num = parseInt(raw);
    if (!isNaN(num) && num >= 1) return num;
  }

  const attendedLast = pickValue(ATTENDED_LAST_COLUMNS, answerMap);
  if (attendedLast !== undefined && normalizeYesNo(attendedLast) === true) return 2;

  return 1;
}

export function attendedLastEdition(answerMap: Record<string, string | undefined>): boolean | null {
  const val = pickValue(ATTENDED_LAST_COLUMNS, answerMap);
  if (val === undefined) return null;
  return normalizeYesNo(val);
}

export function attendedRegion(regionName: string, answerMap: Record<string, string | undefined>): boolean {
  const val = pickValue(REGIONS_ATTENDED_COLUMNS, answerMap);
  return val !== undefined && val.toLowerCase().includes(regionName.toLowerCase());
}

export function isFirstTimerColumn(csvColumn: string | null | undefined): boolean {
  return csvColumn != null && FIRST_TIMER_COLUMNS.includes(csvColumn as typeof FIRST_TIMER_COLUMNS[number]);
}

export function isAttendanceColumn(csvColumn: string | null | undefined): boolean {
  return csvColumn != null && ATTENDANCE_COLUMNS.includes(csvColumn as typeof ATTENDANCE_COLUMNS[number]);
}

export function isAttendedLastColumn(csvColumn: string | null | undefined): boolean {
  return csvColumn != null && ATTENDED_LAST_COLUMNS.includes(csvColumn as typeof ATTENDED_LAST_COLUMNS[number]);
}

export function isRegionsAttendedColumn(csvColumn: string | null | undefined): boolean {
  return csvColumn != null && REGIONS_ATTENDED_COLUMNS.includes(csvColumn as typeof REGIONS_ATTENDED_COLUMNS[number]);
}
