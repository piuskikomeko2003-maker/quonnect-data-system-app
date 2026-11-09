/**
 * Helpers for the per-day table counts introduced for multi-day editions.
 *
 * `vendor_tickets.tables` is the source of truth: one number per paid day.
 * `vendor_registrations.tables` is kept as a legacy mirror of the first owned
 * day so single-day editions and older screens keep working.
 */

export const MIN_TABLES = 1;
export const MAX_TABLES = 5;

/** Coerces any value into a valid 1..5 whole-table count. */
export function normalizeTables(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_TABLES;
  const whole = Math.trunc(parsed);
  return Math.min(MAX_TABLES, Math.max(MIN_TABLES, whole));
}

export interface DayTicketLike {
  edition_day_id?: string | null;
  tables?: number | null;
}

/** Tables recorded on a vendor's ticket for one day, or null when no ticket. */
export function tablesForDay(
  tickets: DayTicketLike[] | null | undefined,
  dayId: string
): number | null {
  const ticket = (tickets || []).find((t) => t.edition_day_id === dayId);
  return ticket ? normalizeTables(ticket.tables) : null;
}

/**
 * Total tables across every paid day. Used where a single number is still
 * needed (exports/reports). Falls back to the legacy registration count when
 * the registration has no day tickets.
 */
export function totalDayTables(
  registrationTables: unknown,
  tickets: DayTicketLike[] | null | undefined
): number {
  if (!tickets || tickets.length === 0) return normalizeTables(registrationTables);
  return tickets.reduce((sum, ticket) => sum + normalizeTables(ticket.tables), 0);
}
