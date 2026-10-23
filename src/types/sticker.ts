// Shared types and constants for the sticker printing feature.
//
// A paid vendor registration carries two numbers that matter here:
//   - `tables`            how many tables were paid for (1..5). Source of truth
//                         for how many stickers the vendor needs.
//   - `stickers_printed`  how many stickers have been confirmed printed.
// Remaining = tables - stickers_printed.
//
// One sticker is one table: a vendor with 2 tables gets 2 stickers that share a
// business name and ticket number but say "Table 1" and "Table 2".

import type { ImageFitMode, PageOrientation } from '@/lib/stickers/pageLayout';

/** 1 millimetre in PDF points (1 pt = 1/72 inch). */
export const MM_TO_PT = 2.83465;

// ---------------------------------------------------------------------------
// Visual design (the placed fields on top of the sticker image)
//
// One sticker = one table. The design draws three fields inside each slot:
// the vendor's business name, its ticket number, and the table label.
//
// All positions/sizes below are PERCENTAGES of the sticker box, never pixels,
// so changing sticker_width_mm/height_mm or the sheet grid never breaks layout.
// Font size is a percentage of the sticker HEIGHT so it scales with the sticker.
// ---------------------------------------------------------------------------

export const STICKER_FIELD_KEYS = ['business_name', 'ticket_number', 'table_label'] as const;
export type StickerFieldKey = (typeof STICKER_FIELD_KEYS)[number];

export const STICKER_FIELD_LABELS: Record<StickerFieldKey, string> = {
  business_name: 'Business name',
  ticket_number: 'Ticket number',
  table_label: 'Table label',
};

/**
 * Font families available in BOTH the live preview and the PDF. These map to
 * pdf-lib's built-in standard fonts (no embedding / no bundled TTFs), which are
 * portable across every PDF viewer. The preview uses the matching CSS families.
 */
export type StickerFontFamily = 'helvetica' | 'times' | 'courier';

export const STICKER_FONT_FAMILIES: { key: StickerFontFamily; label: string; css: string }[] = [
  { key: 'helvetica', label: 'Helvetica / Sans', css: 'Helvetica, Arial, sans-serif' },
  { key: 'times', label: 'Times / Serif', css: '"Times New Roman", Times, serif' },
  { key: 'courier', label: 'Courier / Mono', css: '"Courier New", Courier, monospace' },
];

export type StickerHAlign = 'left' | 'center' | 'right';
export type StickerVAlign = 'top' | 'middle' | 'bottom';

export interface StickerFieldStyle {
  /** Whether this field is drawn at all. */
  enabled: boolean;
  /** Left edge, % of sticker width (0..100). */
  x: number;
  /** Top edge, % of sticker height (0..100). */
  y: number;
  /** Bounding-box width, % of sticker width (1..100). */
  width: number;
  /** Bounding-box height, % of sticker height (1..100). */
  height: number;
  fontFamily: StickerFontFamily;
  /** Font size, % of sticker height. */
  fontSizePct: number;
  bold: boolean;
  color: string;
  align: StickerHAlign;
  vAlign: StickerVAlign;
  /** Business name only: shrink until it fits the box (never overflow). */
  autoShrink: boolean;
  /** Business name only: allow wrapping onto at most two lines. */
  wrap2: boolean;
}

/** The three fields that make up a sticker design. */
export type StickerDesign = Record<StickerFieldKey, StickerFieldStyle>;

export const DEFAULT_STICKER_DESIGN: StickerDesign = {
  business_name: {
    enabled: true, x: 6, y: 8, width: 88, height: 40,
    fontFamily: 'helvetica', fontSizePct: 30, bold: true, color: '#111827',
    align: 'left', vAlign: 'top', autoShrink: true, wrap2: true,
  },
  ticket_number: {
    enabled: true, x: 6, y: 50, width: 88, height: 18,
    fontFamily: 'helvetica', fontSizePct: 14, bold: false, color: '#111827',
    align: 'left', vAlign: 'middle', autoShrink: false, wrap2: false,
  },
  table_label: {
    enabled: true, x: 6, y: 72, width: 88, height: 22,
    fontFamily: 'helvetica', fontSizePct: 17, bold: true, color: '#0d0d0f',
    align: 'center', vAlign: 'bottom', autoShrink: true, wrap2: false,
  },
};

/**
 * The font size, as a % of the sticker HEIGHT, that fills `ratio` of a field box.
 * Because box height is also a % of the sticker height, this is simply
 * `ratio * height`. The editor uses it to suggest a size that fills ~75%.
 */
export function suggestedFontSizePct(boxHeightPct: number, ratio = 0.75): number {
  const value = Math.max(1, boxHeightPct) * ratio;
  return Math.round(value * 10) / 10;
}

export interface StickerSampleData {
  business_name: string;
  ticket_number: string;
  table_label: string;
}

/**
 * Sample values used by the live preview. The last names are deliberately long
 * so the business-name shrink/wrap behaviour can be tested before printing.
 */
export const STICKER_SAMPLE_DATA: StickerSampleData[] = [
  { business_name: 'Mama Joyce Fresh Produce', ticket_number: 'QM-0042', table_label: 'Table 2' },
  { business_name: 'Nakato Fashion House', ticket_number: 'QM-0008', table_label: 'Table 1' },
  { business_name: 'Sunrise Handcrafted Goods & Textiles Ltd', ticket_number: 'QM-0137', table_label: 'Table 3' },
  {
    business_name: 'Ggaba Road Fresh Fish, Poultry and Grocery Supplies Limited',
    ticket_number: 'QM-0512',
    table_label: 'Table 5',
  },
];

/** Coerces an untrusted design blob into a complete, sensible design. */
export function normalizeDesign(raw: any): StickerDesign {
  const base = DEFAULT_STICKER_DESIGN;
  if (!raw || typeof raw !== 'object') return { ...base };
  const out = {} as StickerDesign;
  for (const key of STICKER_FIELD_KEYS) {
    const src = raw[key];
    out[key] = src && typeof src === 'object' ? { ...base[key], ...src } : { ...base[key] };
  }
  return out;
}

/** A sticker template row (public.sticker_templates). */
export interface StickerTemplate {
  id: string;
  /** NULL for a global preset; set when this design belongs to one edition. */
  edition_id: string | null;
  preset_key: string;
  preset_name: string;
  is_active: boolean;
  /** A4 orientation: portrait 210x297, landscape 297x210. */
  orientation: PageOrientation;
  page_width_mm: number;
  page_height_mm: number;
  columns: number;
  rows: number;
  sticker_width_mm: number;
  sticker_height_mm: number;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  gap_x_mm: number;
  gap_y_mm: number;
  inner_padding_mm: number;
  /** Bleed around each slot (clipped so it never reaches a neighbour). */
  bleed_mm: number;
  /** How the design image is fitted into a slot. */
  fit_mode: ImageFitMode;
  /** Changing the sticker width/height keeps the design image's aspect ratio. */
  lock_aspect: boolean;
  cut_lines: boolean;
  /** Centre the grid on the page; when true the manual margins are ignored. */
  auto_center: boolean;
  business_font_size: number;
  ticket_font_size: number;
  table_font_size: number;
  /** Bucket-relative path inside the private `sticker-assets` bucket (or null). */
  image_path: string | null;
  image_width_px: number | null;
  image_height_px: number | null;
  design: StickerDesign;
  /** Server-enriched signed URL for `image_path` (not a DB column). */
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** The fields a super admin can edit on a template. */
export type StickerTemplatePatch = Omit<
  StickerTemplate,
  'id' | 'preset_key' | 'preset_name' | 'is_active' | 'created_at' | 'updated_at'
>;

export const DEFAULT_STICKER_TEMPLATE: StickerTemplatePatch = {
  edition_id: null,
  orientation: 'landscape',
  // Landscape A4 = 297 x 210 mm.
  page_width_mm: 297,
  page_height_mm: 210,
  columns: 3,
  rows: 3,
  sticker_width_mm: 89,
  sticker_height_mm: 59,
  // Auto-centred on landscape A4: left/right = (297 - 3*89 - 2*6)/2 = 9,
  // top/bottom = (210 - 3*59 - 2*6)/2 = 10.5.
  margin_left_mm: 9,
  margin_right_mm: 9,
  margin_top_mm: 10.5,
  margin_bottom_mm: 10.5,
  gap_x_mm: 6,
  gap_y_mm: 6,
  inner_padding_mm: 2,
  bleed_mm: 1,
  fit_mode: 'exact',
  lock_aspect: true,
  cut_lines: false,
  auto_center: true,
  business_font_size: 12,
  ticket_font_size: 10,
  table_font_size: 16,
  image_path: null,
  image_width_px: null,
  image_height_px: null,
  design: { ...DEFAULT_STICKER_DESIGN },
};

/** One sticker = one table of one vendor. */
export interface StickerNeed {
  registration_id: string;
  vendor_id: string;
  business_name: string;
  ticket_number: number | null;
  table_number: number;
}

/** A vendor's stickers within a batch, kept together (never split). */
export interface StickerBatchItem {
  registration_id: string;
  table_numbers: number[];
}

/** A paid vendor registration summarised for the sticker feature. */
export interface StickerVendor {
  registration_id: string;
  vendor_id: string;
  business_name: string;
  ticket_number: number | null;
  tables: number;
  stickers_printed: number;
}

export function remainingFor(vendor: Pick<StickerVendor, 'tables' | 'stickers_printed'>): number {
  const tables = Math.max(1, Number(vendor.tables) || 1);
  const printed = Math.max(0, Number(vendor.stickers_printed) || 0);
  return Math.max(0, tables - printed);
}

/** Coerces the numeric-as-string values PostgREST may return on `numeric` columns. */
export function normalizeTemplate(row: any): StickerTemplate {
  const pageWidth = Number(row.page_width_mm);
  const pageHeight = Number(row.page_height_mm);
  const orientation: PageOrientation =
    row.orientation === 'portrait' || row.orientation === 'landscape'
      ? row.orientation
      : pageWidth > pageHeight
      ? 'landscape'
      : 'portrait';
  return {
    ...row,
    edition_id: row.edition_id ?? null,
    orientation,
    page_width_mm: pageWidth,
    page_height_mm: pageHeight,
    columns: Number(row.columns),
    rows: Number(row.rows),
    sticker_width_mm: Number(row.sticker_width_mm),
    sticker_height_mm: Number(row.sticker_height_mm),
    margin_top_mm: Number(row.margin_top_mm),
    margin_right_mm:
      row.margin_right_mm == null ? Number(row.margin_left_mm) : Number(row.margin_right_mm),
    margin_bottom_mm:
      row.margin_bottom_mm == null ? Number(row.margin_top_mm) : Number(row.margin_bottom_mm),
    margin_left_mm: Number(row.margin_left_mm),
    gap_x_mm: Number(row.gap_x_mm),
    gap_y_mm: Number(row.gap_y_mm),
    inner_padding_mm: Number(row.inner_padding_mm),
    bleed_mm: row.bleed_mm == null ? 1 : Number(row.bleed_mm),
    fit_mode:
      row.fit_mode === 'contain' || row.fit_mode === 'cover' ? row.fit_mode : 'exact',
    lock_aspect: row.lock_aspect === undefined || row.lock_aspect === null ? true : Boolean(row.lock_aspect),
    business_font_size: Number(row.business_font_size),
    ticket_font_size: Number(row.ticket_font_size),
    table_font_size: Number(row.table_font_size),
    cut_lines: Boolean(row.cut_lines),
    auto_center: row.auto_center === undefined || row.auto_center === null ? true : Boolean(row.auto_center),
    is_active: Boolean(row.is_active),
    image_path: row.image_path ?? null,
    image_width_px: row.image_width_px == null ? null : Number(row.image_width_px),
    image_height_px: row.image_height_px == null ? null : Number(row.image_height_px),
    design: normalizeDesign(row.design),
  };
}
