import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSuperAdmin } from '@/lib/auth/requireAdmin';
import {
  createStickerTemplate,
  deleteOrphanedStickerImage,
  deleteStickerTemplate,
  listStickerTemplates,
  sanitizeTemplatePatch,
  signStickerImageUrl,
  validateTemplateGeometry,
} from '@/lib/stickers/server';

export const runtime = 'nodejs';

/**
 * Super-admin only. Lists the sticker templates so the settings page can edit
 * them. Each template carries a short-lived signed `image_url` for its private
 * design image (the bucket itself is never public). The server role check is the
 * real protection — hiding the UI alone is not relied upon.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('edition_id');

    const supabase = createServiceClient();
    const templates = await listStickerTemplates(supabase);
    const withUrls = await Promise.all(
      templates.map(async (t) => ({
        ...t,
        image_url: await signStickerImageUrl(supabase, t.image_path),
      }))
    );

    // Edition-specific design first, otherwise the globally active preset.
    const defaultTemplate =
      withUrls.find((t) => !t.edition_id && t.is_active) ||
      withUrls.find((t) => !t.edition_id) ||
      null;
    const resolved = (editionId && withUrls.find((t) => t.edition_id === editionId)) || defaultTemplate;

    return NextResponse.json({ templates: withUrls, template: resolved });
  } catch (err: any) {
    if (err?.code === 'PGRST205' || err?.message?.includes('schema cache')) {
      return NextResponse.json(
        {
          error:
            "Database table 'sticker_templates' does not exist yet. Run 'supabase/migrations/add_sticker_printing.sql'.",
          tableMissing: true,
        },
        { status: 400 }
      );
    }
    console.error('Failed to list sticker templates:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load sticker templates' }, { status: 500 });
  }
}

/**
 * Super-admin only. Updates one preset's settings and optionally makes it the
 * active preset used by the print screen.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { id, changes, makeActive, preset_name } = body ?? {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Template id is required.' }, { status: 400 });
    }

    const { patch, errors } = sanitizeTemplatePatch(changes);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
    }

    const supabase = createServiceClient();
    const updatePayload: Record<string, any> = { ...patch };

    // Optional rename (kept out of the numeric patch validator on purpose).
    if (typeof preset_name === 'string') {
      const name = preset_name.trim().slice(0, 80);
      if (name) updatePayload.preset_name = name;
    }

    // Remember the previous image so a replaced design does not leak its file,
    // and load the current geometry so the merged layout can be validated.
    const { data: existing } = await supabase
      .from('sticker_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const previousImage = (existing as any)?.image_path as string | null | undefined;
    const isEditionTemplate = Boolean((existing as any)?.edition_id);

    if (makeActive && isEditionTemplate) {
      return NextResponse.json(
        { error: 'An edition-specific design cannot be the global active preset.' },
        { status: 400 }
      );
    }

    // Never persist a grid that does not fit its page. Only enforced when the
    // geometry is actually being changed (or the preset is being activated) so a
    // rename of an existing template is never blocked.
    const GEOMETRY_KEYS = [
      'orientation',
      'page_width_mm',
      'page_height_mm',
      'columns',
      'rows',
      'sticker_width_mm',
      'sticker_height_mm',
      'margin_top_mm',
      'margin_right_mm',
      'margin_bottom_mm',
      'margin_left_mm',
      'gap_x_mm',
      'gap_y_mm',
      'bleed_mm',
      'fit_mode',
      'auto_center',
    ];
    const touchesGeometry = Object.keys(patch).some((key) => GEOMETRY_KEYS.includes(key));
    if (touchesGeometry || makeActive) {
      const geometryErrors = validateTemplateGeometry({ ...(existing || {}), ...patch } as any);
      if (geometryErrors.length > 0) {
        return NextResponse.json({ error: geometryErrors.join(' ') }, { status: 400 });
      }
    }

    // Switching the active preset: clear the current one first so the
    // single-active unique index is never momentarily violated.
    if (makeActive) {
      const { error: clearError } = await supabase
        .from('sticker_templates')
        .update({ is_active: false })
        .eq('is_active', true);
      if (clearError) throw clearError;
      updatePayload.is_active = true;
    }

    const { data, error } = await supabase
      .from('sticker_templates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Best-effort cleanup of the replaced image (never fails the save). Shared
    // images (e.g. an edition copied from the global default) are kept.
    if ('image_path' in patch && previousImage && previousImage !== patch.image_path) {
      await deleteOrphanedStickerImage(supabase, previousImage);
    }

    return NextResponse.json({ success: true, template: data });
  } catch (err: any) {
    const message = err?.message || '';
    if (
      err?.code === 'PGRST204' ||
      /schema cache/i.test(message) ||
      /could not find the .* column/i.test(message) ||
      /column .* does not exist/i.test(message)
    ) {
      return NextResponse.json(
        {
          error:
            "The sticker_templates layout columns (orientation, margins, bleed, fit_mode, design, image, auto_center) are missing from the database. Run supabase/migrations/add_sticker_layout_landscape.sql in the Supabase SQL editor (Supabase → SQL Editor), then reload this page.",
          migrationRequired: true,
        },
        { status: 400 }
      );
    }
    console.error('Failed to save sticker template:', err);
    return NextResponse.json({ error: err?.message || 'Failed to save sticker template' }, { status: 500 });
  }
}

/**
 * Super-admin only. Creates a new template.
 * Body: { name?: string, duplicate_of?: string }
 * With `duplicate_of`, the source template's grid, design and image are copied.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { name, duplicate_of, edition_id } = body ?? {};

    const supabase = createServiceClient();
    const template = await createStickerTemplate(supabase, {
      name: typeof name === 'string' ? name : undefined,
      duplicateOf: typeof duplicate_of === 'string' ? duplicate_of : undefined,
      editionId: typeof edition_id === 'string' && edition_id ? edition_id : undefined,
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    const duplicateEdition = /already has its own sticker design/i.test(err?.message || '');
    if (!duplicateEdition) console.error('Failed to create sticker template:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to create sticker template' },
      { status: duplicateEdition ? 409 : 500 }
    );
  }
}

/** Super-admin only. Deletes a template (never the last one). */
export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Template id is required.' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const result = await deleteStickerTemplate(supabase, id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to delete template' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete sticker template:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete sticker template' }, { status: 500 });
  }
}
