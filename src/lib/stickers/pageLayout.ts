// The single source of truth for sticker sheet layout maths.
//
// Everything that needs to know where a slot sits — the live page preview, the
// alignment-test PDF and the real batch PDF — calls `computeStickerLayout()`.
// There must be no second copy of this maths anywhere.
//
// Coordinates are millimetres with the origin at the TOP-LEFT of the page
// (x grows right, y grows down) — the way the settings UI and the preview think.
// The PDF renderer converts to points / a bottom-left origin only when drawing.
//
// This module is deliberately self-contained (no imports) so it can be imported
// by a plain Node script for verification as well as by the app.

export type PageOrientation = 'portrait' | 'landscape';
export type ImageFitMode = 'exact' | 'contain' | 'cover';

/** A4 in millimetres. A page size is always A4; orientation picks which way up. */
export const A4_PORTRAIT_MM = { width: 210, height: 297 } as const;
export const A4_LANDSCAPE_MM = { width: 297, height: 210 } as const;

/** Nothing may be printed closer than this to the paper edge. */
export const MIN_PRINTABLE_MARGIN_MM = 5;
/** Warn when the design image aspect differs from the slot by more than this. */
export const ASPECT_WARN_TOLERANCE = 0.03;
/** Default bleed around each slot, clipped so it never reaches a neighbour. */
export const DEFAULT_BLEED_MM = 1;
/** Length of the crop-mark ticks outside the grid, in mm. */
export const CROP_TICK_MM = 3;

export interface StickerLayoutSettings {
  orientation: PageOrientation;
  columns: number;
  rows: number;
  stickerWidthMm: number;
  stickerHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  autoCenter: boolean;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  innerPaddingMm: number;
  bleedMm: number;
  cutMarks: boolean;
  fitMode: ImageFitMode;
  /** Pixel dimensions of the uploaded design image, when there is one. */
  imageWidthPx?: number | null;
  imageHeightPx?: number | null;
}

export interface RectMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StickerSlotMm extends RectMm {
  /** 0-based flat index within a page (row-major). */
  index: number;
  row: number;
  col: number;
}

export interface LineMm {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ImagePlacementMm {
  x: number;
  y: number;
  width: number;
  height: number;
  /** How far the image aspect differs from the slot aspect (0.05 = 5%). */
  aspectDelta: number;
  /** True when the fit mode actually crops the image. */
  cropped: boolean;
}

export interface StickerLayout {
  orientation: PageOrientation;
  pageWidthMm: number;
  pageHeightMm: number;
  margins: { top: number; right: number; bottom: number; left: number };
  usableArea: RectMm;
  gridWidthMm: number;
  gridHeightMm: number;
  slots: StickerSlotMm[];
  stickersPerPage: number;
  cropMarks: LineMm[];
  settings: StickerLayoutSettings;
  image: { widthPx: number; heightPx: number; aspect: number } | null;
  /** Bleed allowance on each side of a slot (already clamped to the gutters). */
  imageInset: { top: number; right: number; bottom: number; left: number };
  warnings: string[];
  errors: string[];
  fits: boolean;
}

const num = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** A4 page dimensions for an orientation. */
export function pageSizeFor(orientation: PageOrientation): { width: number; height: number } {
  return orientation === 'landscape' ? A4_LANDSCAPE_MM : A4_PORTRAIT_MM;
}

/** Fills in every missing setting with the shipped default. */
export function normalizeLayoutSettings(input: Partial<StickerLayoutSettings>): StickerLayoutSettings {
  return {
    orientation: input.orientation === 'portrait' ? 'portrait' : 'landscape',
    columns: Math.max(1, Math.floor(num(input.columns, 3))),
    rows: Math.max(1, Math.floor(num(input.rows, 3))),
    stickerWidthMm: Math.max(1, num(input.stickerWidthMm, 89)),
    stickerHeightMm: Math.max(1, num(input.stickerHeightMm, 59)),
    gapXMm: Math.max(0, num(input.gapXMm, 6)),
    gapYMm: Math.max(0, num(input.gapYMm, 6)),
    autoCenter: input.autoCenter !== false,
    marginTopMm: Math.max(0, num(input.marginTopMm, 10.5)),
    marginRightMm: Math.max(0, num(input.marginRightMm, 9)),
    marginBottomMm: Math.max(0, num(input.marginBottomMm, 10.5)),
    marginLeftMm: Math.max(0, num(input.marginLeftMm, 9)),
    innerPaddingMm: Math.max(0, num(input.innerPaddingMm, 2)),
    bleedMm: Math.max(0, num(input.bleedMm, DEFAULT_BLEED_MM)),
    cutMarks: input.cutMarks === true,
    fitMode: input.fitMode === 'contain' || input.fitMode === 'cover' ? input.fitMode : 'exact',
    imageWidthPx: num(input.imageWidthPx, 0) > 0 ? num(input.imageWidthPx, 0) : null,
    imageHeightPx: num(input.imageHeightPx, 0) > 0 ? num(input.imageHeightPx, 0) : null,
  };
}

/**
 * Computes the complete layout: page size, usable area, every slot, crop marks,
 * the image bleed allowance and any warnings/errors. Pure and deterministic.
 */
export function computeStickerLayout(raw: Partial<StickerLayoutSettings>): StickerLayout {
  const settings = normalizeLayoutSettings(raw);
  const { columns, rows, gapXMm, gapYMm } = settings;
  const { width: pageWidthMm, height: pageHeightMm } = pageSizeFor(settings.orientation);
  const warnings: string[] = [];
  const errors: string[] = [];
  const EPS = 0.01;

  if (!(settings.stickerWidthMm > 0)) errors.push('Sticker width must be greater than zero.');
  if (!(settings.stickerHeightMm > 0)) errors.push('Sticker height must be greater than zero.');

  const gridWidthMm = columns * settings.stickerWidthMm + Math.max(0, columns - 1) * gapXMm;
  const gridHeightMm = rows * settings.stickerHeightMm + Math.max(0, rows - 1) * gapYMm;

  // Auto-centred margins are derived from the page and the grid; manual margins
  // come straight from the settings. Drawing always uses the clamped values.
  const rawMargins = settings.autoCenter
    ? {
        left: (pageWidthMm - gridWidthMm) / 2,
        right: (pageWidthMm - gridWidthMm) / 2,
        top: (pageHeightMm - gridHeightMm) / 2,
        bottom: (pageHeightMm - gridHeightMm) / 2,
      }
    : {
        left: settings.marginLeftMm,
        right: settings.marginRightMm,
        top: settings.marginTopMm,
        bottom: settings.marginBottomMm,
      };
  const margins = {
    left: Math.max(0, rawMargins.left),
    right: Math.max(0, rawMargins.right),
    top: Math.max(0, rawMargins.top),
    bottom: Math.max(0, rawMargins.bottom),
  };

  // -------- validation (blocks saving) --------
  if (margins.left + gridWidthMm + margins.right > pageWidthMm + EPS) {
    errors.push(
      `The grid is ${gridWidthMm.toFixed(1)} mm wide but the page is only ` +
        `${pageWidthMm.toFixed(1)} mm. Reduce the columns, sticker width or horizontal gap.`
    );
  } else if (margins.left < MIN_PRINTABLE_MARGIN_MM - EPS || margins.right < MIN_PRINTABLE_MARGIN_MM - EPS) {
    errors.push(
      `The grid leaves a ${Math.min(margins.left, margins.right).toFixed(1)} mm side margin. ` +
        `Keep at least ${MIN_PRINTABLE_MARGIN_MM} mm on every side.`
    );
  }

  if (margins.top + gridHeightMm + margins.bottom > pageHeightMm + EPS) {
    errors.push(
      `The grid is ${gridHeightMm.toFixed(1)} mm tall but the page is only ` +
        `${pageHeightMm.toFixed(1)} mm. Reduce the rows, sticker height or vertical gap.`
    );
  } else if (margins.top < MIN_PRINTABLE_MARGIN_MM - EPS || margins.bottom < MIN_PRINTABLE_MARGIN_MM - EPS) {
    errors.push(
      `The grid leaves a ${Math.min(margins.top, margins.bottom).toFixed(1)} mm top/bottom margin. ` +
        `Keep at least ${MIN_PRINTABLE_MARGIN_MM} mm on every side.`
    );
  }

  // -------- slots --------
  const slots: StickerSlotMm[] = [];
  const stickersPerPage = columns * rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      slots.push({
        index: row * columns + col,
        row,
        col,
        x: margins.left + col * (settings.stickerWidthMm + gapXMm),
        y: margins.top + row * (settings.stickerHeightMm + gapYMm),
        width: settings.stickerWidthMm,
        height: settings.stickerHeightMm,
      });
    }
  }

  // -------- crop marks (only when cut marks are on) --------
  const cropMarks: LineMm[] = [];
  if (settings.cutMarks) {
    const tick = CROP_TICK_MM;
    const left = margins.left;
    const right = margins.left + gridWidthMm;
    const top = margins.top;
    const bottom = margins.top + gridHeightMm;

    const colEdges: number[] = [left];
    for (let c = 1; c < columns; c++) {
      colEdges.push(margins.left + c * (settings.stickerWidthMm + gapXMm) - gapXMm / 2);
    }
    colEdges.push(right);
    for (const x of colEdges) {
      cropMarks.push({ x1: x, y1: top, x2: x, y2: top - tick });
      cropMarks.push({ x1: x, y1: bottom, x2: x, y2: bottom + tick });
    }

    const rowEdges: number[] = [top];
    for (let r = 1; r < rows; r++) {
      rowEdges.push(margins.top + r * (settings.stickerHeightMm + gapYMm) - gapYMm / 2);
    }
    rowEdges.push(bottom);
    for (const y of rowEdges) {
      cropMarks.push({ x1: left, y1: y, x2: left - tick, y2: y });
      cropMarks.push({ x1: right, y1: y, x2: right + tick, y2: y });
    }
  }

  // -------- image aspect + bleed allowance --------
  const image =
    settings.imageWidthPx && settings.imageHeightPx
      ? {
          widthPx: settings.imageWidthPx,
          heightPx: settings.imageHeightPx,
          aspect: settings.imageWidthPx / settings.imageHeightPx,
        }
      : null;

  // Bleed is allowed up to half the gutter so it can never touch a neighbour.
  // At the outer edges (single row/column) it is capped by the page margin.
  const insetX =
    gapXMm > 0
      ? Math.min(settings.bleedMm, gapXMm / 2)
      : columns === 1
      ? Math.min(settings.bleedMm, margins.left, margins.right)
      : 0;
  const insetY =
    gapYMm > 0
      ? Math.min(settings.bleedMm, gapYMm / 2)
      : rows === 1
      ? Math.min(settings.bleedMm, margins.top, margins.bottom)
      : 0;
  const imageInset = { top: insetY, right: insetX, bottom: insetY, left: insetX };

  const slotAspect = settings.stickerWidthMm / settings.stickerHeightMm;
  if (image) {
    const delta = Math.abs(image.aspect - slotAspect) / slotAspect;
    if (settings.fitMode === 'cover') {
      if (delta > ASPECT_WARN_TOLERANCE) {
        warnings.push(
          `"Cover" crops the design: image aspect ${image.aspect.toFixed(2)} vs sticker ` +
            `${slotAspect.toFixed(2)} (${Math.round(delta * 100)}% off). Use "Exact fit" to keep the whole design.`
        );
      }
    } else if (delta > ASPECT_WARN_TOLERANCE) {
      warnings.push(
        `Image aspect ${image.aspect.toFixed(2)} differs from the sticker ${slotAspect.toFixed(2)} ` +
          `by ${Math.round(delta * 100)}%. "Exact fit" stretches it to fill the slot without cropping.`
      );
    }
  }

  const usableArea: RectMm = {
    x: margins.left,
    y: margins.top,
    width: Math.max(0, pageWidthMm - margins.left - margins.right),
    height: Math.max(0, pageHeightMm - margins.top - margins.bottom),
  };

  return {
    orientation: settings.orientation,
    pageWidthMm,
    pageHeightMm,
    margins,
    usableArea,
    gridWidthMm,
    gridHeightMm,
    slots,
    stickersPerPage,
    cropMarks,
    settings,
    image,
    imageInset,
    warnings,
    errors,
    fits: errors.length === 0,
  };
}

/**
 * The exact rectangle (mm) the design image is drawn into for one slot, honouring
 * the fit mode. Never reaches further than the clamped bleed allowance, so it can
 * never overlap a neighbouring sticker.
 */
export function slotImageBox(layout: StickerLayout, slot: StickerSlotMm): ImagePlacementMm {
  const { top, right, bottom, left } = layout.imageInset;
  const box: RectMm = {
    x: slot.x - left,
    y: slot.y - top,
    width: slot.width + left + right,
    height: slot.height + top + bottom,
  };
  const image = layout.image;
  const slotAspect = slot.width / slot.height;

  if (!image) {
    return { ...box, aspectDelta: 0, cropped: false };
  }

  const delta = Math.abs(image.aspect - slotAspect) / slotAspect;
  const fit = layout.settings.fitMode;

  let width: number;
  let height: number;
  if (fit === 'exact') {
    width = box.width;
    height = box.height;
  } else {
    const scale =
      fit === 'cover'
        ? Math.max(box.width / image.widthPx, box.height / image.heightPx)
        : Math.min(box.width / image.widthPx, box.height / image.heightPx);
    width = image.widthPx * scale;
    height = image.heightPx * scale;
  }

  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
    aspectDelta: delta,
    cropped: fit === 'cover' && delta > ASPECT_WARN_TOLERANCE,
  };
}

/**
 * The largest sticker size that fits the page for the given columns/rows/gaps
 * and margins, keeping the design image's aspect ratio. Powers the "Auto-fit"
 * button.
 */
export function autoFitStickerSize(
  raw: Partial<StickerLayoutSettings>
): { widthMm: number; heightMm: number } {
  const settings = normalizeLayoutSettings(raw);
  const { width: pageWidthMm, height: pageHeightMm } = pageSizeFor(settings.orientation);

  const marginX = settings.autoCenter
    ? MIN_PRINTABLE_MARGIN_MM * 2
    : settings.marginLeftMm + settings.marginRightMm;
  const marginY = settings.autoCenter
    ? MIN_PRINTABLE_MARGIN_MM * 2
    : settings.marginTopMm + settings.marginBottomMm;

  const availW = Math.max(
    1,
    pageWidthMm - marginX - Math.max(0, settings.columns - 1) * settings.gapXMm
  );
  const availH = Math.max(
    1,
    pageHeightMm - marginY - Math.max(0, settings.rows - 1) * settings.gapYMm
  );

  const aspect =
    settings.imageWidthPx && settings.imageHeightPx
      ? settings.imageWidthPx / settings.imageHeightPx
      : settings.stickerWidthMm > 0 && settings.stickerHeightMm > 0
      ? settings.stickerWidthMm / settings.stickerHeightMm
      : 89 / 59;

  let width = availW / settings.columns;
  let height = width / aspect;
  const maxHeight = availH / settings.rows;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }

  return {
    widthMm: Math.floor(clamp(width, 1, pageWidthMm) * 10) / 10,
    heightMm: Math.floor(clamp(height, 1, pageHeightMm) * 10) / 10,
  };
}
