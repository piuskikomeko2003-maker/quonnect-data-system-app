import type { StickerTemplate, StickerTemplatePatch } from '@/types/sticker';
import { normalizeDesign } from '@/types/sticker';

/**
 * Settings that describe *how* a sticker is laid out, independent of its
 * artwork. Reusing these is safe when a new sticker uses the same design image
 * family but a different image file (e.g. the next edition's artwork).
 *
 * Deliberately excluded:
 *  - image_path / image_width_px / image_height_px (the new artwork)
 *  - edition_id / edition_day_id (scope belongs to the template being edited)
 *  - is_active / preset_name / preset_key (identity, not layout)
 */
export function reusableSettingsFromTemplate(
  source: StickerTemplate
): Partial<StickerTemplatePatch> {
  return {
    orientation: source.orientation,
    page_width_mm: Number(source.page_width_mm),
    page_height_mm: Number(source.page_height_mm),
    columns: Number(source.columns),
    rows: Number(source.rows),
    sticker_width_mm: Number(source.sticker_width_mm),
    sticker_height_mm: Number(source.sticker_height_mm),
    margin_top_mm: Number(source.margin_top_mm),
    margin_right_mm: Number(source.margin_right_mm),
    margin_bottom_mm: Number(source.margin_bottom_mm),
    margin_left_mm: Number(source.margin_left_mm),
    gap_x_mm: Number(source.gap_x_mm),
    gap_y_mm: Number(source.gap_y_mm),
    inner_padding_mm: Number(source.inner_padding_mm),
    bleed_mm: source.bleed_mm == null ? 0 : Number(source.bleed_mm),
    fit_mode: source.fit_mode,
    lock_aspect: source.lock_aspect !== false,
    cut_lines: Boolean(source.cut_lines),
    auto_center: source.auto_center !== false,
    business_font_size: Number(source.business_font_size),
    ticket_font_size: Number(source.ticket_font_size),
    table_font_size: Number(source.table_font_size),
    // Deep copy: field positions and typography are per-field objects. A shallow
    // copy would let edits in the new template mutate the source template.
    design: normalizeDesign(source.design),
  };
}

/**
 * Applies a previous template's layout and typography to the current draft,
 * while keeping the current draft's artwork image and edition/day scope.
 */
export function applyReusableSettings(
  current: StickerTemplatePatch,
  source: StickerTemplate
): StickerTemplatePatch {
  return {
    ...current,
    ...reusableSettingsFromTemplate(source),
    edition_id: current.edition_id,
    edition_day_id: current.edition_day_id,
    image_path: current.image_path,
    image_width_px: current.image_width_px,
    image_height_px: current.image_height_px,
  };
}
