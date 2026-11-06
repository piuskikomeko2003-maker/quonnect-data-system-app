import type { StickerBatchItem, StickerNeed, StickerVendor } from '@/types/sticker';
import { remainingFor } from '@/types/sticker';

/**
 * Reads a ticket number as a number.
 *
 * Ticket numbers are INTEGER columns, but legacy imports stored codes such as
 * "Ticket 084" or "TKT-084" in text fields. Comparing those as strings puts
 * "100" before "84", so every comparison in this module goes through here.
 */
export function ticketNumberValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  const match = String(value).match(/-?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export interface TicketRange {
  /** First ticket number to include (inclusive). */
  from: number;
  /** Last ticket number to include (inclusive). */
  to: number;
}

/**
 * Parses a ticket range from user input. Empty/invalid bounds return null (no
 * range). Reversed bounds are normalised so "200 to 100" still means 100..200.
 */
export function normalizeTicketRange(from: unknown, to: unknown): TicketRange | null {
  const parse = (value: unknown) =>
    value == null || String(value).trim() === '' ? NaN : Number(value);
  const a = parse(from);
  const b = parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const low = Math.max(1, Math.trunc(Math.min(a, b)));
  const high = Math.max(1, Math.trunc(Math.max(a, b)));
  return { from: low, to: high };
}

/**
 * Keeps only vendors whose ticket number is inside the range.
 *
 * This is applied BEFORE `buildStickerNeeds` expands a multi-table vendor, so a
 * 3-table ticket adds 3 stickers without changing which tickets are included.
 */
export function filterVendorsByTicketRange(
  vendors: StickerVendor[],
  range: TicketRange | null | undefined
): StickerVendor[] {
  if (!range) return [...vendors];
  return vendors.filter((vendor) => {
    const ticket = ticketNumberValue(vendor.ticket_number);
    return ticket != null && ticket >= range.from && ticket <= range.to;
  });
}

/** Orders vendors the way stickers are printed: by numeric ticket number, then name. */
export function sortVendorsByTicket(vendors: StickerVendor[]): StickerVendor[] {
  return [...vendors].sort((a, b) => {
    const at = ticketNumberValue(a.ticket_number);
    const bt = ticketNumberValue(b.ticket_number);
    if (at == null && bt == null) {
      return (a.business_name || '').localeCompare(b.business_name || '');
    }
    if (at == null) return 1;
    if (bt == null) return -1;
    if (at !== bt) return at - bt;
    return (a.business_name || '').localeCompare(b.business_name || '');
  });
}

/**
 * Expands vendor registrations into individual sticker needs.
 *
 * A vendor printed N times already only needs tables (N+1..tables), so increasing
 * a vendor from 2 to 3 tables after printing surfaces just "Table 3".
 *
 * `includePrinted` is used by explicit ticket ranges: if the operator asks for
 * tickets 1..100, the sheet must contain tickets 1..100 even when some of them
 * were already confirmed. Confirming again is safe because the printed counter
 * is capped at the vendor's table count.
 */
export function buildStickerNeeds(
  vendors: StickerVendor[],
  options: { includePrinted?: boolean } = {}
): StickerNeed[] {
  const needs: StickerNeed[] = [];
  const includePrinted = options.includePrinted === true;
  for (const vendor of sortVendorsByTicket(vendors)) {
    const tables = Math.max(1, Number(vendor.tables) || 1);
    const printed = Math.max(0, Math.min(tables, Number(vendor.stickers_printed) || 0));
    const firstTable = includePrinted ? 1 : printed + 1;
    for (let table = firstTable; table <= tables; table++) {
      needs.push({
        registration_id: vendor.registration_id,
        ticket_id: vendor.ticket_id ?? null,
        edition_day_id: vendor.edition_day_id ?? null,
        vendor_id: vendor.vendor_id,
        business_name: vendor.business_name,
        ticket_number: vendor.ticket_number,
        table_number: table,
      });
    }
  }
  return needs;
}

export interface BatchSelectionOptions {
  /** 'all' prints every remaining sticker; a number prints at least that many. */
  mode: 'all' | 'count';
  count?: number;
  /** 1-based page slot to begin at; slots before it are left blank. */
  startPosition?: number;
  /**
   * Explicit ticket-number range. When set it is the source of truth: only
   * tickets inside [from, to] are printed, and `count` is ignored.
   */
  ticketRange?: TicketRange | null;
}

export interface BatchSelection {
  /** Stickers to draw, flat and in order. */
  stickers: StickerNeed[];
  /** Same stickers grouped per vendor (stored on the batch row). */
  items: StickerBatchItem[];
  stickerCount: number;
  /** Distinct tickets represented by the selected stickers. */
  ticketCount: number;
  ticketRange: TicketRange | null;
  /** True when an exact range forced already-printed tables to be included. */
  includePrinted: boolean;
  /** Stickers in this batch that were already marked printed (reprints). */
  reprintStickerCount: number;
  startPosition: number;
  slotsPerPage: number;
  pages: number;
  totalSlots: number;
  leadingBlankSlots: number;
  emptySlots: number;
}

/**
 * Chooses the vendors for a batch. Vendors are taken whole: if a vendor has 3
 * stickers and taking them pushes the batch past `count`, all 3 are included so
 * a vendor is never split across two batches.
 */
export function selectBatch(
  vendors: StickerVendor[],
  slotsPerPage: number,
  options: BatchSelectionOptions
): BatchSelection {
  const perPage = Math.max(1, slotsPerPage);
  const startPosition = Math.max(1, Math.floor(options.startPosition || 1));
  const ticketRange = options.ticketRange ?? null;
  // An explicit range means "print exactly these tickets", including tables
  // that were already confirmed. That prevents a 1..100 request from silently
  // collapsing to only the unprinted remainder (e.g. 84..100).
  const includePrinted = !!ticketRange;
  // A ticket range defines the whole batch. Counting stickers as well would
  // silently truncate the requested range, so `count` only applies without one.
  const target = ticketRange
    ? Infinity
    : options.mode === 'all'
    ? Infinity
    : Math.max(1, Math.floor(options.count || 0));

  // Filter + sort by ticket number here, BEFORE any tables are expanded.
  const ordered = sortVendorsByTicket(filterVendorsByTicketRange(vendors, ticketRange));
  const chosen: StickerVendor[] = [];
  let selected = 0;

  for (const vendor of ordered) {
    if (selected >= target) break;
    const tables = Math.max(1, Number(vendor.tables) || 1);
    const stickersFromVendor = includePrinted ? tables : remainingFor(vendor);
    if (stickersFromVendor <= 0) continue;
    chosen.push(vendor);
    selected += stickersFromVendor;
  }

  const needs = buildStickerNeeds(chosen, { includePrinted });
  const reprintStickerCount = includePrinted
    ? chosen.reduce((total, vendor) => {
        const tables = Math.max(1, Number(vendor.tables) || 1);
        const printed = Math.max(0, Math.min(tables, Number(vendor.stickers_printed) || 0));
        return total + printed;
      }, 0)
    : 0;

  // Group by vendor, preserving order.
  const items: StickerBatchItem[] = [];
  for (const need of needs) {
    const last = items[items.length - 1];
    if (
      last &&
      last.registration_id === need.registration_id &&
      (last.ticket_id ?? null) === (need.ticket_id ?? null)
    ) {
      last.table_numbers.push(need.table_number);
    } else {
      items.push({
        registration_id: need.registration_id,
        ticket_id: need.ticket_id ?? null,
        edition_day_id: need.edition_day_id ?? null,
        table_numbers: [need.table_number],
      });
    }
  }

  const stickerCount = needs.length;
  const ticketCount = new Set(
    chosen.map((vendor) => vendor.ticket_id ?? vendor.registration_id)
  ).size;
  const leadingBlankSlots = startPosition - 1;
  const occupied = leadingBlankSlots + stickerCount;
  const pages = stickerCount > 0 ? Math.ceil(occupied / perPage) : 0;
  const totalSlots = pages * perPage;
  const emptySlots = totalSlots - stickerCount;

  return {
    stickers: needs,
    items,
    stickerCount,
    ticketCount,
    ticketRange,
    includePrinted,
    reprintStickerCount,
    startPosition,
    slotsPerPage: perPage,
    pages,
    totalSlots,
    leadingBlankSlots,
    emptySlots,
  };
}

export interface TicketRangeSummary {
  from: number;
  to: number;
  /** Distinct tickets found in the range (printed or not). */
  ticketCount: number;
  /** Total stickers that will print (every table of every found ticket). */
  stickerCount: number;
  /** Of those, how many are already marked printed and will be reprinted. */
  reprintStickerCount: number;
  /** Ticket numbers in the range with no vendor record at all. */
  missingTickets: number[];
}

/**
 * Summarises a ticket range before printing.
 *
 * `missingTickets` reports numbers in [from, to] that have no record in the
 * supplied vendor list, so the UI can warn instead of silently printing a gap.
 * Only the first `missingLimit` gaps are collected to keep huge ranges cheap.
 */
export function summarizeTicketRange(
  vendors: StickerVendor[],
  range: TicketRange,
  missingLimit = 100
): TicketRangeSummary {
  const present = new Set<number>();
  let stickerCount = 0;
  let reprintStickerCount = 0;

  for (const vendor of vendors) {
    const ticket = ticketNumberValue(vendor.ticket_number);
    if (ticket == null || ticket < range.from || ticket > range.to) continue;
    present.add(ticket);
    const tables = Math.max(1, Number(vendor.tables) || 1);
    const printed = Math.max(0, Math.min(tables, Number(vendor.stickers_printed) || 0));
    // An explicit range prints every table, not just the unprinted remainder.
    stickerCount += tables;
    reprintStickerCount += printed;
  }

  const missingTickets: number[] = [];
  for (let ticket = range.from; ticket <= range.to; ticket++) {
    if (!present.has(ticket)) {
      missingTickets.push(ticket);
      if (missingTickets.length >= missingLimit) break;
    }
  }

  return {
    from: range.from,
    to: range.to,
    ticketCount: present.size,
    stickerCount,
    reprintStickerCount,
    missingTickets,
  };
}

export interface StickerProgress {
  totalNeeded: number;
  printed: number;
  remaining: number;
  vendorCount: number;
  remainingVendorCount: number;
}

export function computeProgress(vendors: StickerVendor[]): StickerProgress {
  let totalNeeded = 0;
  let printed = 0;
  let remaining = 0;
  let remainingVendorCount = 0;
  for (const vendor of vendors) {
    const tables = Math.max(1, Number(vendor.tables) || 1);
    const done = Math.max(0, Math.min(tables, Number(vendor.stickers_printed) || 0));
    totalNeeded += tables;
    printed += done;
    const rem = tables - done;
    remaining += rem;
    if (rem > 0) remainingVendorCount++;
  }
  return {
    totalNeeded,
    printed,
    remaining,
    vendorCount: vendors.length,
    remainingVendorCount,
  };
}
