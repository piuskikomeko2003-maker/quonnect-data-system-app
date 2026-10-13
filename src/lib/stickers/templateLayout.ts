// Maps a stored sticker template (snake_case DB shape) onto the layout engine's
// settings. Keeps the mapping in one place so the preview and the PDF agree.

import type { StickerTemplate } from '@/types/sticker';
import {
  computeStickerLayout,
  type StickerLayout,
  type StickerLayoutSettings,
} from './pageLayout';

type LayoutSource = Pick<
  StickerTemplate,
  | 'orientation'
  | 'columns'
  | 'rows'
  | 'sticker_width_mm'
  | 'sticker_height_mm'
  | 'gap_x_mm'
  | 'gap_y_mm'
  | 'margin_top_mm'
  | 'margin_right_mm'
  | 'margin_bottom_mm'
  | 'margin_left_mm'
  | 'inner_padding_mm'
  | 'bleed_mm'
  | 'cut_lines'
  | 'auto_center'
  | 'fit_mode'
  | 'image_width_px'
  | 'image_height_px'
>;

/** Layout settings for a template (or an in-progress draft of one). */
export function layoutSettingsFromTemplate(source: LayoutSource): StickerLayoutSettings {
  return {
    orientation: source.orientation,
    columns: source.columns,
    rows: source.rows,
    stickerWidthMm: source.sticker_width_mm,
    stickerHeightMm: source.sticker_height_mm,
    gapXMm: source.gap_x_mm,
    gapYMm: source.gap_y_mm,
    autoCenter: source.auto_center !== false,
    marginTopMm: source.margin_top_mm,
    marginRightMm: source.margin_right_mm,
    marginBottomMm: source.margin_bottom_mm,
    marginLeftMm: source.margin_left_mm,
    innerPaddingMm: source.inner_padding_mm,
    bleedMm: source.bleed_mm,
    cutMarks: source.cut_lines === true,
    fitMode: source.fit_mode,
    imageWidthPx: source.image_width_px,
    imageHeightPx: source.image_height_px,
  };
}

/** The full computed layout for a template or draft. */
export function computeLayoutForTemplate(source: LayoutSource): StickerLayout {
  return computeStickerLayout(layoutSettingsFromTemplate(source));
}
