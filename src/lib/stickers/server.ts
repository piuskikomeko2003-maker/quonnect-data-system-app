import type { createServiceClient } from '@/lib/supabase/service';
import {
  DEFAULT_STICKER_DESIGN,
  DEFAULT_STICKER_TEMPLATE,
  STICKER_FIELD_KEYS,
  normalizeDesign,
  normalizeTemplate,
  type StickerDesign,
  type StickerTemplate,
  type StickerTemplatePatch,
  type StickerVendor,
} from '@/types/sticker';
import {
  STICKER_IMAGE_MAX_BYTES,
  STICKER_IMAGE_MIME_TYPES,
} from '@/lib/stickers/image';
import { computeStickerLayout } from '@/lib/stickers/pageLayout';
import { layoutSettingsFromTemplate } from '@/lib/stickers/templateLayout';

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Private bucket that holds sticker design images. Super admins + PDF server only. */
export const STICKER_ASSETS_BUCKET = 'sticker-assets';

/**
 * Ensures the private `sticker-assets` bucket exists. The migration creates it,
 * but this makes the upload route self-healing (and gives a clear path when the
 * migration's bucket step was skipped or failed). Idempotent; safe to call often.
 */
export async function ensureStickerAssetsBucket(supabase: ServiceClient): Promise<void> {
  const { data, error } = await supabase.storage.getBucket(STICKER_ASSETS_BUCKET);
  if (!error && data) return;

  const { error: createError } = await supabase.storage.createBucket(STICKER_ASSETS_BUCKET, {
    public: false,
    fileSizeLimit: STICKER_IMAGE_MAX_BYTES,
    allowedMimeTypes: [...STICKER_IMAGE_MIME_TYPES],
  });
  if (createError && !/exist/i.test(createError.message || '')) {
    throw createError;
  }
}

/** Lists all sticker templates (presets). Seeds defaults if the table is empty. */
export async function listStickerTemplates(supabase: ServiceClient): Promise<StickerTemplate[]> {
  const { data, error } = await supabase
    .from('sticker_templates')
    .select('*')
    .order('preset_key', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) {
    return seedDefaultTemplates(supabase);
  }
  return data.map(normalizeTemplate);
}

/** Returns the requested template, or the active one when no id is given. */
export async function getStickerTemplate(
  supabase: ServiceClient,
  templateId?: string | null
): Promise<StickerTemplate | null> {
  if (templateId) {
    const { data, error } = await supabase
      .from('sticker_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizeTemplate(data) : null;
  }

  const { data, error } = await supabase
    .from('sticker_templates')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (data) return normalizeTemplate(data);

  // Fall back to the first preset if none is flagged active.
  const all = await listStickerTemplates(supabase);
  return all[0] ?? null;
}

async function seedDefaultTemplates(supabase: ServiceClient): Promise<StickerTemplate[]> {
  const defaults = [
    { preset_key: 'precut_label', preset_name: 'Pre-cut label sheet', is_active: true, cut_lines: false },
    { preset_key: 'plain_paper', preset_name: 'Plain paper', is_active: false, cut_lines: true },
  ];
  const rows = defaults.map((preset, index) => ({
    ...DEFAULT_STICKER_TEMPLATE,
    ...preset,
    is_active: index === 0,
  }));
  const { data, error } = await supabase.from('sticker_templates').insert(rows).select();
  if (error) throw error;
  return (data || []).map(normalizeTemplate);
}

/** Loads the paid vendor registrations for an edition, shaped for sticker logic. */
export async function fetchStickerVendors(
  supabase: ServiceClient,
  marketDayId: string
): Promise<StickerVendor[]> {
  const baseSelect = `
      id,
      vendor_id,
      ticket_number,
      stall_number,
      tables,
      stickers_printed,
      vendors ( business_name, contact_name )
    `;

  // PostgREST caps a single response (often 1000 rows). Page through so a large
  // edition is never silently truncated, which would look like skipped stickers.
  const PAGE_SIZE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('vendor_registrations')
      .select(baseSelect)
      .eq('market_day_id', marketDayId)
      .eq('payment_status', 'paid')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return rows.map((row: any) => {
    const ticket = Number.isFinite(Number(row.ticket_number))
      ? Number(row.ticket_number)
      : Number(String(row.stall_number || '').match(/\d+/)?.[0] ?? NaN);
    return {
      registration_id: row.id,
      vendor_id: row.vendor_id,
      business_name: row.vendors?.business_name || row.vendors?.contact_name || 'Unknown vendor',
      ticket_number: Number.isFinite(ticket) ? ticket : null,
      tables: Math.max(1, Number(row.tables) || 1),
      stickers_printed: Math.max(0, Number(row.stickers_printed) || 0),
    };
  });
}

const NUMERIC_BOUNDS: Record<string, { min: number; max: number; integer?: boolean }> = {
  page_width_mm: { min: 50, max: 1000 },
  page_height_mm: { min: 50, max: 1000 },
  columns: { min: 1, max: 50, integer: true },
  rows: { min: 1, max: 50, integer: true },
  sticker_width_mm: { min: 10, max: 1000 },
  sticker_height_mm: { min: 5, max: 1000 },
  margin_top_mm: { min: 0, max: 200 },
  margin_right_mm: { min: 0, max: 200 },
  margin_bottom_mm: { min: 0, max: 200 },
  margin_left_mm: { min: 0, max: 200 },
  gap_x_mm: { min: 0, max: 100 },
  gap_y_mm: { min: 0, max: 100 },
  inner_padding_mm: { min: 0, max: 50 },
  bleed_mm: { min: 0, max: 20 },
  business_font_size: { min: 4, max: 72 },
  ticket_font_size: { min: 4, max: 72 },
  table_font_size: { min: 4, max: 96 },
};

const ORIENTATIONS = ['portrait', 'landscape'];
const FIT_MODES = ['exact', 'contain', 'cover'];

const DESIGN_NUMERIC_BOUNDS: Record<string, { min: number; max: number }> = {
  x: { min: 0, max: 100 },
  y: { min: 0, max: 100 },
  width: { min: 1, max: 100 },
  height: { min: 1, max: 100 },
  fontSizePct: { min: 1, max: 200 },
};
const H_ALIGNS = ['left', 'center', 'right'];
const V_ALIGNS = ['top', 'middle', 'bottom'];
const FONT_FAMILIES = ['helvetica', 'times', 'courier'];

/**
 * Validates the three-field design blob. Missing fields fall back to defaults;
 * out-of-range numbers are clamped rather than rejected so a slightly off value
 * never blocks a save. Returns a complete design when the input is usable.
 */
export function sanitizeDesign(input: any): { design?: StickerDesign; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { errors: ['design must be an object.'] };
  }

  const base = normalizeDesign(input);

  for (const key of STICKER_FIELD_KEYS) {
    const raw = (input as any)[key];
    if (raw == null) continue; // keep default
    if (typeof raw !== 'object') {
      errors.push(`design.${key} must be an object.`);
      continue;
    }
    const field = base[key];

    for (const [prop, bounds] of Object.entries(DESIGN_NUMERIC_BOUNDS)) {
      if (!(prop in raw)) continue;
      const value = Number(raw[prop]);
      if (!Number.isFinite(value)) {
        errors.push(`design.${key}.${prop} must be a number.`);
        continue;
      }
      (field as any)[prop] = Math.min(bounds.max, Math.max(bounds.min, value));
    }

    if ('enabled' in raw) field.enabled = Boolean(raw.enabled);
    if ('bold' in raw) field.bold = Boolean(raw.bold);
    if ('autoShrink' in raw) field.autoShrink = Boolean(raw.autoShrink);
    if ('wrap2' in raw) field.wrap2 = Boolean(raw.wrap2);
    if ('fontFamily' in raw) {
      if (FONT_FAMILIES.includes(raw.fontFamily)) field.fontFamily = raw.fontFamily;
      else errors.push(`design.${key}.fontFamily is not supported.`);
    }
    if ('align' in raw) {
      if (H_ALIGNS.includes(raw.align)) field.align = raw.align;
      else errors.push(`design.${key}.align must be left, center or right.`);
    }
    if ('vAlign' in raw) {
      if (V_ALIGNS.includes(raw.vAlign)) field.vAlign = raw.vAlign;
      else errors.push(`design.${key}.vAlign must be top, middle or bottom.`);
    }
    if ('color' in raw && typeof raw.color === 'string') {
      field.color = raw.color.slice(0, 32);
    }
  }

  return { design: base, errors };
}

/** A bucket path is safe when it is relative and cannot escape the folder. */
function sanitizeImagePath(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > 512 || trimmed.startsWith('/') || trimmed.includes('..')) return null;
  return trimmed;
}

/** Validates + coerces an incoming template patch, ignoring unknown fields. */
export function sanitizeTemplatePatch(input: any): { patch: Partial<StickerTemplatePatch>; errors: string[] } {
  const patch: Partial<StickerTemplatePatch> = {};
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { patch, errors: ['Invalid template payload.'] };

  for (const [field, bounds] of Object.entries(NUMERIC_BOUNDS)) {
    if (!(field in input)) continue;
    const value = Number(input[field]);
    if (!Number.isFinite(value)) {
      errors.push(`${field} must be a number.`);
      continue;
    }
    if (bounds.integer && !Number.isInteger(value)) {
      errors.push(`${field} must be a whole number.`);
      continue;
    }
    if (value < bounds.min || value > bounds.max) {
      errors.push(`${field} must be between ${bounds.min} and ${bounds.max}.`);
      continue;
    }
    (patch as any)[field] = value;
  }

  if ('cut_lines' in input) patch.cut_lines = Boolean(input.cut_lines);
  if ('auto_center' in input) patch.auto_center = Boolean(input.auto_center);
  if ('lock_aspect' in input) patch.lock_aspect = Boolean(input.lock_aspect);

  if ('orientation' in input) {
    if (ORIENTATIONS.includes(input.orientation)) patch.orientation = input.orientation;
    else errors.push('orientation must be portrait or landscape.');
  }
  if ('fit_mode' in input) {
    if (FIT_MODES.includes(input.fit_mode)) patch.fit_mode = input.fit_mode;
    else errors.push('fit_mode must be exact, contain or cover.');
  }

  if ('image_path' in input) patch.image_path = sanitizeImagePath(input.image_path);
  if ('image_width_px' in input) {
    const value = Number(input.image_width_px);
    patch.image_width_px =
      Number.isFinite(value) && value > 0 && value <= 20000 ? Math.round(value) : null;
  }
  if ('image_height_px' in input) {
    const value = Number(input.image_height_px);
    patch.image_height_px =
      Number.isFinite(value) && value > 0 && value <= 20000 ? Math.round(value) : null;
  }

  if ('design' in input) {
    const { design, errors: designErrors } = sanitizeDesign(input.design);
    if (design) patch.design = design;
    errors.push(...designErrors);
  }

  return { patch, errors };
}

/**
 * Validates that a template's grid fits on its page. Accepts a partial patch
 * merged over the defaults so the settings route can check the *resulting*
 * layout before saving. Delegates to the shared layout engine, so the server
 * blocks exactly what the live preview flags in red.
 */
export function validateTemplateGeometry(input: Record<string, any>): string[] {
  const source = { ...DEFAULT_STICKER_TEMPLATE, ...input } as StickerTemplate;
  return computeStickerLayout(layoutSettingsFromTemplate(source)).errors;
}

/** Creates a short-lived signed URL for a private design image (super admins only). */
export async function signStickerImageUrl(
  supabase: ServiceClient,
  path: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(STICKER_ASSETS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function slugifyPresetKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || 'template';
}

async function uniquePresetKey(supabase: ServiceClient, base: string): Promise<string> {
  const { data, error } = await supabase.from('sticker_templates').select('preset_key');
  if (error) throw error;
  const taken = new Set((data || []).map((r: any) => r.preset_key));
  let key = base;
  let n = 2;
  while (taken.has(key)) {
    key = `${base}_${n++}`;
  }
  return key;
}

/**
 * Creates a new template. When `duplicateOf` is given, the source template's
 * grid, design and image are copied; otherwise a fresh default template is made.
 */
export async function createStickerTemplate(
  supabase: ServiceClient,
  options: { name?: string; duplicateOf?: string }
): Promise<StickerTemplate> {
  const all = await listStickerTemplates(supabase);
  const source = options.duplicateOf ? all.find((t) => t.id === options.duplicateOf) || null : null;

  const requestedName = String(options.name || '').trim().slice(0, 80);
  const presetName = requestedName || (source ? `${source.preset_name} (copy)` : 'New template');
  const presetKey = await uniquePresetKey(supabase, slugifyPresetKey(presetName));

  const base = source ?? null;
  const grid = base
    ? {
        orientation: base.orientation,
        page_width_mm: base.page_width_mm,
        page_height_mm: base.page_height_mm,
        columns: base.columns,
        rows: base.rows,
        sticker_width_mm: base.sticker_width_mm,
        sticker_height_mm: base.sticker_height_mm,
        margin_top_mm: base.margin_top_mm,
        margin_right_mm: base.margin_right_mm,
        margin_bottom_mm: base.margin_bottom_mm,
        margin_left_mm: base.margin_left_mm,
        gap_x_mm: base.gap_x_mm,
        gap_y_mm: base.gap_y_mm,
        inner_padding_mm: base.inner_padding_mm,
        bleed_mm: base.bleed_mm,
        fit_mode: base.fit_mode,
        lock_aspect: base.lock_aspect,
        cut_lines: base.cut_lines,
        auto_center: base.auto_center,
        business_font_size: base.business_font_size,
        ticket_font_size: base.ticket_font_size,
        table_font_size: base.table_font_size,
        image_path: base.image_path,
        image_width_px: base.image_width_px,
        image_height_px: base.image_height_px,
      }
    : { ...DEFAULT_STICKER_TEMPLATE };

  const { data, error } = await supabase
    .from('sticker_templates')
    .insert({
      ...grid,
      preset_key: presetKey,
      preset_name: presetName,
      is_active: false,
      design: base ? normalizeDesign(base.design) : { ...DEFAULT_STICKER_DESIGN },
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeTemplate(data);
}

/**
 * Deletes a template. Refuses to delete the last one. If the active template is
 * deleted, another is promoted so the print screen always has an active preset.
 * The storage image is only removed when no other template still references it.
 */
export async function deleteStickerTemplate(
  supabase: ServiceClient,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const all = await listStickerTemplates(supabase);
  const target = all.find((t) => t.id === id);
  if (!target) return { ok: false, error: 'Template not found.' };
  if (all.length <= 1) return { ok: false, error: 'At least one template must remain.' };

  const { error } = await supabase.from('sticker_templates').delete().eq('id', id);
  if (error) throw error;

  if (target.is_active) {
    const next = all.find((t) => t.id !== id);
    if (next) {
      await supabase.from('sticker_templates').update({ is_active: true }).eq('id', next.id);
    }
  }

  if (target.image_path) {
    const stillUsed = all.some((t) => t.id !== id && t.image_path === target.image_path);
    if (!stillUsed) {
      try {
        await supabase.storage.from(STICKER_ASSETS_BUCKET).remove([target.image_path]);
      } catch {
        // ignore cleanup failures
      }
    }
  }

  return { ok: true };
}
