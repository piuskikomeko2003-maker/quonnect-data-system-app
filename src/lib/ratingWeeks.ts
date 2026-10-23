/**
 * Weekly rating helpers.
 *
 * All dates are calendar dates in `YYYY-MM-DD` form and are handled in UTC so
 * that a date string never shifts by a day between server and client.
 */

export interface RatingWeek {
  /** Monday of the week, `YYYY-MM-DD`. Stable identity used for storage. */
  weekStart: string;
  /** Sunday of the week (or the event date for the event week). */
  weekEnd: string;
  /** Short human label, e.g. "19 – 25 Oct". */
  label: string;
  /** Extra label when applicable: "This week" / "Event week". */
  badge?: 'this-week' | 'event-week';
  isCurrent: boolean;
  isEventWeek: boolean;
  /** Calendar days from today until the event (negative when past). */
  daysUntilEvent: number;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_WEEKS = 12;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const date = parseDateOnly(value);
  return !Number.isNaN(date.getTime()) && formatDateOnly(date) === value;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayDateOnly(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = parseDateOnly(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

/** Monday of the week that contains `isoDate`. */
export function mondayOf(isoDate: string): string {
  const date = parseDateOnly(isoDate);
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - diff);
  return formatDateOnly(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseDateOnly(fromIso).getTime();
  const to = parseDateOnly(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
}

function formatRange(startIso: string, endIso: string): string {
  const start = parseDateOnly(startIso);
  const end = parseDateOnly(endIso);
  const startMonth = MONTHS_SHORT[start.getUTCMonth()];
  const endMonth = MONTHS_SHORT[end.getUTCMonth()];

  if (startIso === endIso) {
    return `${start.getUTCDate()} ${startMonth}`;
  }
  if (startMonth === endMonth) {
    return `${start.getUTCDate()} – ${end.getUTCDate()} ${endMonth}`;
  }
  return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth}`;
}

export function formatEventDate(eventDate: string): string {
  if (!isIsoDate(eventDate)) return eventDate;
  const date = parseDateOnly(eventDate);
  return `${DAYS_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Build the weekly rating windows leading up to an event.
 *
 * - Future/current event: every Monday from the current week through the event
 *   week (so the user rates weekly until event day).
 * - Past event: the last 4 weeks ending with the event week.
 * - Capped at 12 weeks to keep the selector usable.
 */
export function buildRatingWeeks(
  eventDate: string,
  todayIso: string = todayDateOnly(),
  maxWeeks: number = MAX_WEEKS
): RatingWeek[] {
  if (!isIsoDate(eventDate) || !isIsoDate(todayIso)) return [];

  const eventWeekStart = mondayOf(eventDate);
  const currentWeekStart = mondayOf(todayIso);
  const daysUntilEvent = daysBetween(todayIso, eventDate);

  let start: string;
  if (currentWeekStart <= eventWeekStart) {
    start = currentWeekStart;
  } else {
    // Event already happened: show the final stretch for context.
    start = addDays(eventWeekStart, -7 * 3);
  }

  const limit = Math.max(1, Math.min(maxWeeks, 52));
  const earliestAllowed = addDays(eventWeekStart, -7 * (limit - 1));
  if (start < earliestAllowed) start = earliestAllowed;

  const weeks: RatingWeek[] = [];
  let cursor = start;
  let guard = 0;

  while (cursor <= eventWeekStart && guard < 53) {
    const isEventWeek = cursor === eventWeekStart;
    const rawEnd = addDays(cursor, 6);
    const weekEnd = isEventWeek && eventDate < rawEnd ? eventDate : rawEnd;
    const isCurrent = cursor === currentWeekStart;

    weeks.push({
      weekStart: cursor,
      weekEnd,
      label: formatRange(cursor, weekEnd),
      badge: isEventWeek ? 'event-week' : isCurrent ? 'this-week' : undefined,
      isCurrent,
      isEventWeek,
      daysUntilEvent,
    });

    cursor = addDays(cursor, 7);
    guard += 1;
  }

  return weeks;
}

/** Pick the best default week: the current week, else the last week with data. */
export function defaultWeekStart(weeks: RatingWeek[], weeksWithData: string[] = []): string | null {
  if (weeks.length === 0) return null;
  const current = weeks.find((week) => week.isCurrent);
  if (current) return current.weekStart;

  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    if (weeksWithData.includes(weeks[i].weekStart)) return weeks[i].weekStart;
  }
  return weeks[weeks.length - 1].weekStart;
}

/** Previous week key (7 days earlier), used for trend/compare. */
export function previousWeekStart(weekStart: string): string {
  return addDays(weekStart, -7);
}
