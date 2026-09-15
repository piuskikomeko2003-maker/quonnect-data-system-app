/**
 * Ticket codes are sequential, zero-padded numbers per event edition
 * (e.g. 001, 002, 003). The legacy format included a "TKT-" prefix.
 */

export function formatTicketCode(ticketNumber: number | string): string {
  const raw = typeof ticketNumber === 'number' ? ticketNumber : parseInt(String(ticketNumber).replace(/\D/g, ''), 10);
  const safe = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return String(safe).padStart(3, '0');
}

/**
 * Strips a legacy "TKT-" prefix from a stored ticket code, leaving any
 * non-ticket values (e.g. real stall names like "A5") untouched.
 */
export function normalizeTicketCode(code?: string | null): string {
  if (!code) return '';
  const trimmed = String(code).trim();
  const legacy = trimmed.match(/^TKT-?(\d+)$/i);
  if (legacy) return formatTicketCode(legacy[1]);
  return trimmed;
}
