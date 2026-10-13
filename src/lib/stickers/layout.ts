import type { StickerBatchItem, StickerNeed, StickerVendor } from '@/types/sticker';
import { remainingFor } from '@/types/sticker';

/** Orders vendors the way stickers are printed: by ticket number, then name. */
export function sortVendorsByTicket(vendors: StickerVendor[]): StickerVendor[] {
  return [...vendors].sort((a, b) => {
    const at = a.ticket_number;
    const bt = b.ticket_number;
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
 */
export function buildStickerNeeds(vendors: StickerVendor[]): StickerNeed[] {
  const needs: StickerNeed[] = [];
  for (const vendor of sortVendorsByTicket(vendors)) {
    const tables = Math.max(1, Number(vendor.tables) || 1);
    const printed = Math.max(0, Math.min(tables, Number(vendor.stickers_printed) || 0));
    for (let table = printed + 1; table <= tables; table++) {
      needs.push({
        registration_id: vendor.registration_id,
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
}

export interface BatchSelection {
  /** Stickers to draw, flat and in order. */
  stickers: StickerNeed[];
  /** Same stickers grouped per vendor (stored on the batch row). */
  items: StickerBatchItem[];
  stickerCount: number;
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
  const target = options.mode === 'all' ? Infinity : Math.max(1, Math.floor(options.count || 0));

  const ordered = sortVendorsByTicket(vendors);
  const chosen: StickerVendor[] = [];
  let selected = 0;

  for (const vendor of ordered) {
    if (selected >= target) break;
    const remaining = remainingFor(vendor);
    if (remaining <= 0) continue;
    chosen.push(vendor);
    selected += remaining;
  }

  const needs = buildStickerNeeds(chosen);

  // Group by vendor, preserving order.
  const items: StickerBatchItem[] = [];
  for (const need of needs) {
    const last = items[items.length - 1];
    if (last && last.registration_id === need.registration_id) {
      last.table_numbers.push(need.table_number);
    } else {
      items.push({ registration_id: need.registration_id, table_numbers: [need.table_number] });
    }
  }

  const stickerCount = needs.length;
  const leadingBlankSlots = startPosition - 1;
  const occupied = leadingBlankSlots + stickerCount;
  const pages = stickerCount > 0 ? Math.ceil(occupied / perPage) : 0;
  const totalSlots = pages * perPage;
  const emptySlots = totalSlots - stickerCount;

  return {
    stickers: needs,
    items,
    stickerCount,
    startPosition,
    slotsPerPage: perPage,
    pages,
    totalSlots,
    leadingBlankSlots,
    emptySlots,
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
