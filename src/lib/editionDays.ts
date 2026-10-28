import type { SupabaseClient } from '@supabase/supabase-js';

export interface EditionDay {
  id: string;
  edition_id: string;
  day_number: number;
  event_date: string;
  fee: number;
  label: string | null;
  ticket_template_id?: string | null;
}

export function dayLabel(day: Pick<EditionDay, 'day_number' | 'label'>): string {
  return day.label?.trim() || `Day ${day.day_number}`;
}

export function dayDateLabel(day: Pick<EditionDay, 'event_date'>): string {
  if (!day.event_date) return '';
  // event_date is a Postgres date (YYYY-MM-DD); parse as local date to avoid
  // the UTC-midnight day shift.
  const [y, m, d] = day.event_date.split('-').map(Number);
  if (!y || !m || !d) return day.event_date;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Your pass: Day 2" / "Your passes: Day 1 + Day 2" */
export function passSummary(days: Pick<EditionDay, 'day_number' | 'label'>[]): string {
  if (!days || days.length === 0) return '';
  const sorted = [...days].sort((a, b) => a.day_number - b.day_number);
  const labels = sorted.map(dayLabel).join(' + ');
  return sorted.length === 1 ? `Your pass: ${labels}` : `Your passes: ${labels}`;
}

/** Today in the market's timezone, as YYYY-MM-DD. */
export function todayInKampala(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isTicketDayToday(day?: Pick<EditionDay, 'event_date'> | null): boolean {
  if (!day?.event_date) return false;
  return day.event_date === todayInKampala();
}

export function sortDays<T extends { day_number: number }>(days: T[]): T[] {
  return [...days].sort((a, b) => a.day_number - b.day_number);
}

/**
 * Fetch an edition's days. Returns [] when the migration has not been applied
 * yet, so the rest of the app keeps working with the legacy single-ticket flow.
 */
export async function fetchEditionDays(
  supabase: SupabaseClient,
  editionId: string | null | undefined
): Promise<EditionDay[]> {
  if (!editionId) return [];
  try {
    const { data, error } = await supabase
      .from('edition_days')
      .select('id, edition_id, day_number, event_date, fee, label, ticket_template_id')
      .eq('edition_id', editionId)
      .order('day_number');

    if (error) return [];
    return sortDays((data || []) as EditionDay[]);
  } catch {
    return [];
  }
}
