import { normalizeTicketCode } from '@/utils/ticket';

/**
 * Client-side ticket download helpers.
 *
 * Two problems this solves:
 *   1. Rendered passes are slow because every click hits `/api/tickets/render`
 *      (serverless cold start + Satori render + remote background fetch). We
 *      prefetch the render once and reuse the blob, so downloads are instant.
 *   2. Browsers block a burst of automatic downloads (Chrome asks once, then
 *      drops the rest). Multi-day registrations therefore get a single
 *      "Download all passes" PDF built from the already-rendered images.
 */

export interface TicketDownloadData {
  ticketId?: string;
  dayId?: string;
  dayNumber?: number;
  dayLabel?: string;
  dayDate?: string;
  ticketNumber: number;
  ticketCode: string;
  editionName: string;
  vendorName: string;
  businessName?: string;
  phone?: string;
  category?: string;
  amountPaid?: number;
  paymentStatus?: string;
  registeredAt: string;
}

const CACHE_LIMIT = 24;
const blobCache = new Map<string, Promise<Blob>>();

export function clearTicketBlobCache(): void {
  blobCache.clear();
}

function rememberBlob(key: string, value: Promise<Blob>): Promise<Blob> {
  if (blobCache.size >= CACHE_LIMIT) {
    const oldest = blobCache.keys().next().value;
    if (oldest) blobCache.delete(oldest);
  }
  blobCache.set(key, value);
  return value;
}

/** Stable cache key: a ticket never changes its rendered pass after issue. */
export function ticketCacheKey(ticket: TicketDownloadData, editionId: string): string {
  if (ticket.ticketId) return `ticket:${ticket.ticketId}`;
  return [
    'fallback',
    editionId,
    ticket.dayId || ticket.dayNumber || '',
    normalizeTicketCode(ticket.ticketCode) || ticket.ticketCode || ticket.ticketNumber,
    ticket.vendorName || '',
  ].join(':');
}

/** Builds the render URL exactly as the ticketing API expects it. */
export function ticketRenderUrl(ticket: TicketDownloadData, editionId: string): string {
  const code = normalizeTicketCode(ticket.ticketCode) || ticket.ticketCode;
  const params = new URLSearchParams({
    edition_id: editionId || '',
    ticket_number: code || '',
    vendor_name: ticket.vendorName || '',
    business_name: ticket.businessName || '',
    category: ticket.category || '',
    phone: ticket.phone || '',
    edition_name: ticket.editionName || '',
    issued_at: ticket.registeredAt || '',
    day_label: ticket.dayLabel || '',
    event_date: ticket.dayDate || '',
  });
  if (ticket.ticketId) params.set('ticket_id', ticket.ticketId);
  if (ticket.dayId) params.set('edition_day_id', ticket.dayId);
  return `/api/tickets/render?${params.toString()}`;
}

export function sanitizeFilenamePart(value: string | undefined, fallback: string): string {
  const cleaned = (value || '')
    .trim()
    .replace(/[^\w\-. ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || fallback;
}

function dayNumberForFilename(ticket: TicketDownloadData, index: number): number {
  if (typeof ticket.dayNumber === 'number' && Number.isFinite(ticket.dayNumber)) {
    return ticket.dayNumber;
  }
  const fromLabel = String(ticket.dayLabel || '').match(/\d+/);
  if (fromLabel) return Number(fromLabel[0]);
  return index + 1;
}

/** Stable, human-readable download name, e.g. `quonnect-ticket-day2-008.png`. */
export function ticketPngFilename(ticket: TicketDownloadData, index = 0): string {
  const day = dayNumberForFilename(ticket, index);
  const code =
    normalizeTicketCode(ticket.ticketCode) ||
    ticket.ticketCode ||
    String(ticket.ticketNumber || index + 1);
  return `quonnect-ticket-day${day}-${sanitizeFilenamePart(code, String(index + 1))}.png`;
}

/** Human filename stem for a pass, e.g. `Vendor-Pass-Day-2-014`. */
export function ticketFileStem(ticket: TicketDownloadData, index = 0): string {
  const day =
    ticket.dayLabel ||
    (ticket.dayNumber ? `Day ${ticket.dayNumber}` : `Ticket ${index + 1}`);
  const code =
    normalizeTicketCode(ticket.ticketCode) || ticket.ticketCode || String(ticket.ticketNumber || index + 1);
  return `Vendor-Pass-${sanitizeFilenamePart(day, `Ticket-${index + 1}`)}-${sanitizeFilenamePart(
    code,
    String(index + 1)
  )}`;
}

/**
 * Fetches (and memoises) the rendered PNG for a pass. Concurrent callers share
 * one request, which makes prefetch + click a single network round trip.
 */
export function getTicketBlob(
  ticket: TicketDownloadData,
  editionId: string,
  options: { force?: boolean; fetcher?: typeof fetch } = {}
): Promise<Blob> {
  const key = ticketCacheKey(ticket, editionId);
  const cached = blobCache.get(key);
  if (cached && !options.force) return cached;

  const fetcher = options.fetcher || fetch;
  const request = fetcher(ticketRenderUrl(ticket, editionId))
    .then((res) => {
      if (!res.ok) throw new Error(`Ticket render failed (${res.status})`);
      return res.blob();
    })
    .catch((err) => {
      // Never cache a failure: the next click should be able to retry.
      blobCache.delete(key);
      throw err;
    });

  return rememberBlob(key, request);
}

/** Warms the cache for all passes without blocking the UI. */
export function prefetchTicketBlobs(tickets: TicketDownloadData[], editionId: string): void {
  if (!editionId) return;
  for (const ticket of tickets) {
    getTicketBlob(ticket, editionId).catch(() => {
      /* Prefetch is best-effort; the click path retries. */
    });
  }
}

/**
 * Triggers a download without the immediate-revoke race that makes Safari and
 * some Chrome versions abort a download before it starts.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download, then release the blob.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadTicketImage(
  ticket: TicketDownloadData,
  editionId: string,
  index = 0,
  filename?: string
): Promise<void> {
  const blob = await getTicketBlob(ticket, editionId);
  saveBlob(blob, filename || `${ticketFileStem(ticket, index)}.png`);
}

/**
 * Prints only the clicked pass. The rendered PNG is placed in a hidden iframe,
 * which avoids popup blockers and guarantees the print matches the download.
 */
export async function printTicketImage(
  ticket: TicketDownloadData,
  editionId: string
): Promise<void> {
  const blob = await getTicketBlob(ticket, editionId);
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';

    const cleanup = () => {
      iframe.remove();
      URL.revokeObjectURL(url);
    };

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        win?.focus();
        win?.print();
        resolve();
        // Leave the frame alive while the print dialog is open.
        setTimeout(cleanup, 60_000);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    iframe.onerror = () => {
      cleanup();
      reject(new Error('Could not prepare this ticket for printing'));
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = `<!doctype html><html><head><title>Quonnect ticket</title><style>
      @page { margin: 8mm; }
      html, body { margin: 0; padding: 0; }
      img { display: block; width: 100%; height: auto; }
    </style></head><body><img src="${url}" alt="Quonnect vendor ticket" /></body></html>`;
  });
}

/**
 * Combines every pass into one PDF (one page per ticket). One user-triggered
 * download means no browser multi-download prompt and no dropped second pass.
 */
export async function buildTicketsPdf(
  tickets: TicketDownloadData[],
  editionId: string
): Promise<Uint8Array> {
  if (tickets.length === 0) throw new Error('No tickets to download');

  const blobs = await Promise.all(
    tickets.map((ticket) => getTicketBlob(ticket, editionId))
  );
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();

  const vendor = tickets[0]?.vendorName;
  if (vendor) pdf.setTitle(`Vendor passes — ${vendor}`);
  pdf.setProducer('Quonnect');
  pdf.setCreator('Quonnect Data System');

  for (const blob of blobs) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = await pdf.embedPng(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  return pdf.save();
}

export async function downloadTicketsPdf(
  tickets: TicketDownloadData[],
  editionId: string
): Promise<void> {
  const bytes = await buildTicketsPdf(tickets, editionId);
  const vendor = sanitizeFilenamePart(tickets[0]?.vendorName, 'Vendor');
  const days = tickets.length;
  saveBlob(
    new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    `Vendor-Passes-${vendor}-${days}-${days === 1 ? 'day' : 'days'}.pdf`
  );
}
