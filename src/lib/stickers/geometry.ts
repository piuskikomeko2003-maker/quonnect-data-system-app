// Sheet-grid geometry. This is now a thin adapter over the single layout engine
// (`./pageLayout`), so the print screen, the settings validator, the live preview
// and the PDF renderer all agree on where the grid sits. No maths lives here.

import { computeStickerLayout, type PageOrientation } from './pageLayout';

export interface GridGeometry {
  page_width_mm: number;
  page_height_mm: number;
  columns: number;
  rows: number;
  sticker_width_mm: number;
  sticker_height_mm: number;
  gap_x_mm: number;
  gap_y_mm: number;
  margin_left_mm: number;
  margin_top_mm: number;
  /** When true (or omitted) the grid is centred and margins are ignored. */
  auto_center?: boolean;
  margin_right_mm?: number;
  margin_bottom_mm?: number;
  orientation?: PageOrientation;
}

/** Legacy rows have no orientation column; infer it from the stored page size. */
function orientationOf(g: GridGeometry): PageOrientation {
  if (g.orientation === 'portrait' || g.orientation === 'landscape') return g.orientation;
  return Number(g.page_width_mm) > Number(g.page_height_mm) ? 'landscape' : 'portrait';
}

function toLayoutSettings(g: GridGeometry) {
  return {
    orientation: orientationOf(g),
    columns: g.columns,
    rows: g.rows,
    stickerWidthMm: g.sticker_width_mm,
    stickerHeightMm: g.sticker_height_mm,
    gapXMm: g.gap_x_mm,
    gapYMm: g.gap_y_mm,
    autoCenter: g.auto_center !== false,
    marginLeftMm: g.margin_left_mm,
    marginTopMm: g.margin_top_mm,
    marginRightMm: g.margin_right_mm ?? 0,
    marginBottomMm: g.margin_bottom_mm ?? 0,
  };
}

/** Total width/height of the sticker grid itself (no margins), in mm. */
export function gridSizeMm(g: GridGeometry): { width: number; height: number } {
  const layout = computeStickerLayout(toLayoutSettings(g));
  return { width: layout.gridWidthMm, height: layout.gridHeightMm };
}

/** Margins that centre the grid on the page: (page - grid) / 2. */
export function centeredMarginsMm(g: GridGeometry): { left: number; top: number } {
  const { width, height } = gridSizeMm(g);
  return {
    left: (Number(g.page_width_mm) - width) / 2,
    top: (Number(g.page_height_mm) - height) / 2,
  };
}

/**
 * The margins actually used when drawing. Auto-centred grids ignore the stored
 * manual margins; manual grids use them (clamped at 0 so nothing draws off-page).
 */
export function effectiveMarginsMm(g: GridGeometry): { left: number; top: number } {
  const layout = computeStickerLayout(toLayoutSettings(g));
  return { left: layout.margins.left, top: layout.margins.top };
}

/**
 * Returns human-readable errors when the grid does not fit on the page. Used by
 * the save route so an impossible layout is never persisted, and by the settings
 * screen for instant feedback. Delegates to the shared layout engine.
 */
export function validateGridFits(g: GridGeometry): string[] {
  return computeStickerLayout(toLayoutSettings(g)).errors;
}
