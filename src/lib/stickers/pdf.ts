import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import {
  MM_TO_PT,
  STICKER_FIELD_KEYS,
  type StickerDesign,
  type StickerFieldKey,
  type StickerFontFamily,
  type StickerNeed,
  type StickerTemplate,
} from '@/types/sticker';
import { fitText, fieldBox } from './fitting';
import {
  computeStickerLayout,
  slotImageBox,
  type StickerLayout,
  type StickerSlotMm,
} from './pageLayout';
import { layoutSettingsFromTemplate } from './templateLayout';

const mm = (value: number) => value * MM_TO_PT;

/**
 * Baseline offset within a text line, as a fraction of the font size. Chosen to
 * match the browser's Arial/Helvetica line-box baseline (~0.907) so the printed
 * text sits where the live preview shows it.
 */
const TEXT_BASELINE_RATIO = 0.9;

interface SlotBox {
  /** Left edge, points from page-left. */
  x: number;
  /** Top edge, points from page-top. */
  top: number;
  width: number;
  height: number;
}

/** Converts a slot (mm, top-left origin) into PDF points. */
function slotBoxPt(layout: StickerLayout, slot: StickerSlotMm): SlotBox {
  return {
    x: mm(slot.x),
    top: mm(slot.y),
    width: mm(slot.width),
    height: mm(slot.height),
  };
}

/** Draws text with its y given as distance from the page top (baseline inferred). */
function drawTopText(
  page: PDFPage,
  pageHeight: number,
  text: string,
  options: { x: number; top: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> }
) {
  page.drawText(text, {
    x: options.x,
    y: pageHeight - (options.top + options.size * TEXT_BASELINE_RATIO),
    size: options.size,
    font: options.font,
    color: options.color,
  });
}

/** Wraps text to fit maxWidth, breaking on spaces. A single long word is kept. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/**
 * Shrinks a business name until it fits the width in at most two lines, then
 * hard-truncates with an ellipsis as a last resort so it never overflows.
 */
function fitBusinessName(
  text: string,
  font: PDFFont,
  maxWidth: number,
  maxHeight: number,
  startSize: number
): { lines: string[]; size: number; lineHeight: number } {
  for (let size = startSize; size >= 5; size -= 0.5) {
    const lines = wrapText(text, font, size, maxWidth);
    const lineHeight = size * 1.12;
    if (lines.length <= 2 && lines.length * lineHeight <= maxHeight) {
      return { lines, size, lineHeight };
    }
  }

  const size = 5;
  const lineHeight = size * 1.12;
  const lines = wrapText(text, font, size, maxWidth).slice(0, 2);
  if (lines.length === 2) {
    let second = lines[1];
    while (second.length > 1 && font.widthOfTextAtSize(`${second}…`, size) > maxWidth) {
      second = second.slice(0, -1);
    }
    lines[1] = `${second}…`;
  }
  return { lines, lineHeight, size };
}

function ticketLabel(ticket: number | null): string {
  if (ticket == null) return 'Ticket —';
  return `Ticket ${String(ticket).padStart(3, '0')}`;
}

/** Parses #rgb / #rrggbb into a pdf-lib colour, defaulting to near-black. */
function hexToRgb(hex: string | undefined): ReturnType<typeof rgb> {
  const fallback = rgb(0.07, 0.07, 0.08);
  if (!hex) return fallback;
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value.split('').map((c) => c + c).join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Maps the design's font family + weight onto pdf-lib's built-in fonts. */
function standardFontFor(family: StickerFontFamily, bold: boolean): StandardFonts {
  if (family === 'times') return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  if (family === 'courier') return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

export interface StickerPdfImage {
  bytes: Uint8Array;
  type: 'png' | 'jpeg';
}

export interface StickerPdfOptions {
  template: StickerTemplate;
  stickers: StickerNeed[];
  /** 1-based slot to start drawing at; earlier slots stay blank. */
  startPosition?: number;
  /** Single-sticker design image bytes (private bucket), if the template has one. */
  image?: StickerPdfImage | null;
}

/** The value each field shows for a sticker. */
function fieldValue(key: StickerFieldKey, sticker: StickerNeed): string {
  if (key === 'business_name') return sticker.business_name || 'Vendor';
  if (key === 'ticket_number') return ticketLabel(sticker.ticket_number);
  return `Table ${sticker.table_number}`;
}

/**
 * Draws the three designed fields inside one slot. The fitting algorithm and the
 * box geometry are shared with the live preview (`./fitting`) so the text lands
 * in exactly the same place in both. Positions are percentages of the sticker
 * box, so they stay correct regardless of orientation or sticker size.
 */
function drawDesignedFields(
  page: PDFPage,
  pageHeight: number,
  box: SlotBox,
  design: StickerDesign,
  sticker: StickerNeed,
  fonts: Map<StandardFonts, PDFFont>
) {
  for (const key of STICKER_FIELD_KEYS) {
    const style = design[key];
    if (!style || !style.enabled) continue;

    const value = fieldValue(key, sticker);
    if (!value) continue;

    const font = fonts.get(standardFontFor(style.fontFamily, style.bold))!;
    const fb = fieldBox(style, box.width, box.height);
    const boxLeft = box.x + fb.left;
    const boxTop = box.top + fb.top;
    const boxWidth = fb.width;
    const boxHeight = fb.height;
    const startSize = fb.startSize;
    const maxLines = key === 'business_name' ? (style.wrap2 ? 2 : 1) : 1;

    const measure = (text: string, size: number) => font.widthOfTextAtSize(text, size);
    const fitted = fitText(
      value,
      {
        maxWidth: boxWidth,
        maxHeight: boxHeight,
        startSize,
        maxLines,
        autoShrink: style.autoShrink,
        minSize: Math.max(4, startSize * 0.3),
      },
      measure
    );

    const totalHeight = fitted.lines.length * fitted.lineHeight;
    const blockTop =
      style.vAlign === 'top'
        ? 0
        : style.vAlign === 'middle'
        ? Math.max(0, (boxHeight - totalHeight) / 2)
        : Math.max(0, boxHeight - totalHeight);

    const color = hexToRgb(style.color);
    fitted.lines.forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, fitted.fontSize);
      const x =
        style.align === 'center'
          ? boxLeft + Math.max(0, (boxWidth - lineWidth) / 2)
          : style.align === 'right'
          ? boxLeft + Math.max(0, boxWidth - lineWidth)
          : boxLeft;
      drawTopText(page, pageHeight, line, {
        x,
        top: boxTop + blockTop + index * fitted.lineHeight,
        size: fitted.fontSize,
        font,
        color,
      });
    });
  }
}

/**
 * Draws the design image for one slot exactly as the preview does: the image is
 * placed into the rectangle `slotImageBox()` returns (honouring exact / contain /
 * cover and the bleed allowance) and clipped so it can never spill onto a
 * neighbouring sticker.
 */
function drawSlotImage(
  page: PDFPage,
  pageHeight: number,
  layout: StickerLayout,
  slot: StickerSlotMm,
  image: PDFImage
) {
  const placement = slotImageBox(layout, slot);
  const inset = layout.imageInset;
  const clipX = mm(slot.x - inset.left);
  const clipTop = mm(slot.y - inset.top);
  const clipW = mm(slot.width + inset.left + inset.right);
  const clipH = mm(slot.height + inset.top + inset.bottom);
  const clipBottom = pageHeight - clipTop - clipH;

  const x = mm(placement.x);
  const drawW = mm(placement.width);
  const drawH = mm(placement.height);
  const y = pageHeight - mm(placement.y) - drawH;

  page.pushOperators(
    pushGraphicsState(),
    rectangle(clipX, clipBottom, clipW, clipH),
    clip(),
    endPath()
  );
  page.drawImage(image, { x, y, width: drawW, height: drawH });
  page.pushOperators(popGraphicsState());
}

/** Light-grey crop marks from the shared layout (only when cut marks are on). */
function drawCropMarks(
  page: PDFPage,
  pageHeight: number,
  layout: StickerLayout,
  color: ReturnType<typeof rgb>
) {
  for (const m of layout.cropMarks) {
    page.drawLine({
      start: { x: mm(m.x1), y: pageHeight - mm(m.y1) },
      end: { x: mm(m.x2), y: pageHeight - mm(m.y2) },
      color,
      thickness: 0.5,
    });
  }
}

/** Renders the sticker sheet PDF. Pure aside from pdf-lib; safe to unit-test. */
export async function renderStickerPdf({
  template,
  stickers,
  startPosition = 1,
  image = null,
}: StickerPdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  // ONE layout for page size, slot positions, crop marks and the image boxes.
  const layout = computeStickerLayout(layoutSettingsFromTemplate(template));
  const slotsPerPage = Math.max(1, layout.stickersPerPage);
  const leadingBlank = Math.max(0, Math.floor(startPosition) - 1);
  const totalSlots = leadingBlank + stickers.length;
  const pageCount = totalSlots > 0 ? Math.ceil(totalSlots / slotsPerPage) : 0;

  const pageWidth = mm(layout.pageWidthMm);
  const pageHeight = mm(layout.pageHeightMm);
  const textColor = rgb(0.1, 0.1, 0.12);
  const tableColor = rgb(0.05, 0.05, 0.06);
  const cutColor = rgb(0.78, 0.78, 0.78);

  const pages: PDFPage[] = [];
  for (let i = 0; i < pageCount; i++) {
    pages.push(pdf.addPage([pageWidth, pageHeight]));
  }

  const design = (template.design && typeof template.design === 'object'
    ? template.design
    : null) as StickerDesign | null;

  // Embed the shared fonts once, then the image once.
  const fonts = new Map<StandardFonts, PDFFont>();
  let embeddedImage: PDFImage | null = null;
  if (design) {
    const needed = new Set<StandardFonts>();
    for (const key of STICKER_FIELD_KEYS) {
      const style = design[key];
      if (style?.enabled) needed.add(standardFontFor(style.fontFamily, style.bold));
    }
    if (needed.size === 0) needed.add(StandardFonts.Helvetica);
    for (const fontName of needed) {
      fonts.set(fontName, await pdf.embedFont(fontName));
    }
    if (image) {
      embeddedImage =
        image.type === 'png' ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes);
    }
  } else {
    fonts.set(StandardFonts.Helvetica, await pdf.embedFont(StandardFonts.Helvetica));
    fonts.set(StandardFonts.HelveticaBold, await pdf.embedFont(StandardFonts.HelveticaBold));
  }

  // Cut guides (plain paper only). Empty slots are never outlined in a real batch.
  if (layout.settings.cutMarks) {
    for (const page of pages) {
      drawCropMarks(page, pageHeight, layout, cutColor);
    }
  }

  const padding = mm(template.inner_padding_mm);

  stickers.forEach((sticker, i) => {
    const flatIndex = leadingBlank + i;
    const page = pages[Math.floor(flatIndex / slotsPerPage)];
    const slot = layout.slots[flatIndex % slotsPerPage];
    if (!page || !slot) return;
    const box = slotBoxPt(layout, slot);

    if (design) {
      // 1. Draw the design image into its (bleed-clipped) slot box.
      if (embeddedImage) {
        drawSlotImage(page, pageHeight, layout, slot, embeddedImage);
      }
      // 2. Draw the placed fields on top, positioned within the sticker box.
      drawDesignedFields(page, pageHeight, box, design, sticker, fonts);
      return;
    }

    // ─── Fallback: original text-only layout (no design present) ───
    const font = fonts.get(StandardFonts.Helvetica)!;
    const bold = fonts.get(StandardFonts.HelveticaBold)!;
    const usableWidth = box.width - padding * 2;
    const usableHeight = box.height - padding * 2;
    const tableSize = template.table_font_size;
    const ticketSize = template.ticket_font_size;
    const tableLineHeight = tableSize * 1.12;
    const ticketLineHeight = ticketSize * 1.15;
    const nameMaxHeight = Math.max(
      ticketLineHeight,
      usableHeight - tableLineHeight - ticketLineHeight - mm(1)
    );

    const name = fitBusinessName(
      sticker.business_name || 'Vendor',
      bold,
      usableWidth,
      nameMaxHeight,
      template.business_font_size
    );
    name.lines.forEach((line, lineIndex) => {
      drawTopText(page, pageHeight, line, {
        x: box.x + padding,
        top: box.top + padding + lineIndex * name.lineHeight,
        size: name.size,
        font: bold,
        color: textColor,
      });
    });

    const ticketTop = box.top + padding + name.lines.length * name.lineHeight + mm(0.6);
    drawTopText(page, pageHeight, ticketLabel(sticker.ticket_number), {
      x: box.x + padding,
      top: ticketTop,
      size: ticketSize,
      font,
      color: textColor,
    });

    const tableText = `Table ${sticker.table_number}`;
    const tableWidth = bold.widthOfTextAtSize(tableText, tableSize);
    const tableX = box.x + padding + Math.max(0, (usableWidth - tableWidth) / 2);
    const tableTop = box.top + box.height - padding - tableLineHeight;
    drawTopText(page, pageHeight, tableText, {
      x: tableX,
      top: tableTop,
      size: tableSize,
      font: bold,
      color: tableColor,
    });
  });

  return pdf.save();
}

/**
 * One-page alignment test: every slot outlined and numbered, plus crop marks, so
 * the printed sheet can be checked against a real label sheet before printing
 * real stickers. Uses the SAME layout function as the preview and batch PDF.
 */
export async function renderAlignmentTestPdf(template: StickerTemplate): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const layout = computeStickerLayout(layoutSettingsFromTemplate(template));
  const pageWidth = mm(layout.pageWidthMm);
  const pageHeight = mm(layout.pageHeightMm);
  const page = pdf.addPage([pageWidth, pageHeight]);

  const outline = rgb(0.35, 0.35, 0.4);
  const labelColor = rgb(0.15, 0.15, 0.2);
  const markerColor = rgb(0.85, 0.1, 0.1);
  const cutColor = rgb(0.78, 0.78, 0.78);

  if (layout.settings.cutMarks) drawCropMarks(page, pageHeight, layout, cutColor);

  // Page-edge marker at the top-left margin corner for quick alignment checks.
  page.drawLine({
    start: { x: mm(layout.margins.left), y: pageHeight - mm(layout.margins.top) },
    end: { x: mm(layout.margins.left) + 18, y: pageHeight - mm(layout.margins.top) + 18 },
    color: markerColor,
    thickness: 0.75,
  });
  page.drawLine({
    start: { x: mm(layout.margins.left), y: pageHeight - mm(layout.margins.top) + 18 },
    end: { x: mm(layout.margins.left) + 18, y: pageHeight - mm(layout.margins.top) },
    color: markerColor,
    thickness: 0.75,
  });

  layout.slots.forEach((slot, index) => {
    const box = slotBoxPt(layout, slot);
    page.drawRectangle({
      x: box.x,
      y: pageHeight - box.top - box.height,
      width: box.width,
      height: box.height,
      borderColor: outline,
      borderWidth: 0.75,
    });

    const label = String(index + 1);
    const size = 12;
    const width = bold.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: box.x + (box.width - width) / 2,
      y: pageHeight - box.top - box.height / 2 - size / 2,
      size,
      font: bold,
      color: labelColor,
    });
  });

  return pdf.save();
}
