import type { FieldPosition } from '@/types/ticketTemplate';

/**
 * Single source of truth for ticket typography.
 *
 * The designer preview, the client-side pass card and the server PNG renderer
 * all import from here so a ticket looks the same everywhere. Never hard-code
 * a font family, size, weight or line-height in one of those three places.
 */

/** Family name registered with the server renderer (`public/fonts/tickets`). */
export const TICKET_FONT_FAMILY = 'Geist';

/** CSS stack used by browser-rendered previews/passes. Mirrors the server font. */
export const TICKET_FONT_FAMILY_CSS = 'Geist, ui-sans-serif, system-ui, sans-serif';

/** Every pass uses this line-height so wrapping is predictable. */
export const TICKET_LINE_HEIGHT = 1.25;

/** Weight used when a field does not specify one. */
export const TICKET_DEFAULT_FONT_SIZE = 18;

/**
 * Sizes are intentionally content-independent. Earlier versions shrank the
 * font for shorter/longer text, which made different vendors' tickets render
 * at different sizes. Long text now wraps inside `maxWidth` instead, so every
 * ticket uses the exact size chosen in the designer.
 */
export function resolveTicketFontSize(position?: Pick<FieldPosition, 'fontSize'> | null): number {
  const size = position?.fontSize;
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return TICKET_DEFAULT_FONT_SIZE;
  }
  return size;
}

/** Normalises every accepted weight form to a numeric CSS/Satori weight. */
export function resolveTicketFontWeight(
  weight?: FieldPosition['fontWeight'] | number | string | null
): number {
  switch (weight) {
    case 'medium':
    case '500':
    case 500:
      return 500;
    case 'semibold':
    case '600':
    case 600:
      return 600;
    case 'bold':
    case '700':
    case 700:
      return 700;
    default:
      return 400;
  }
}
