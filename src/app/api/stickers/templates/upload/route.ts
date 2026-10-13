import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSuperAdmin } from '@/lib/auth/requireAdmin';
import { STICKER_ASSETS_BUCKET, ensureStickerAssetsBucket, signStickerImageUrl } from '@/lib/stickers/server';
import {
  STICKER_IMAGE_MAX_BYTES,
  STICKER_IMAGE_MIME_TYPES,
  validateStickerImage,
} from '@/lib/stickers/image';

export const runtime = 'nodejs';

/** Reads pixel dimensions straight from the image bytes (no extra dependency). */
async function readDimensions(bytes: Uint8Array, mime: string): Promise<{ width: number; height: number }> {
  const pdf = await PDFDocument.create();
  if (mime === 'image/png') {
    const img = await pdf.embedPng(bytes);
    return { width: img.width, height: img.height };
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    const img = await pdf.embedJpg(bytes);
    return { width: img.width, height: img.height };
  }
  throw new Error('Unsupported image type');
}

/**
 * Super-admin only. Uploads a single-sticker design image into the PRIVATE
 * `sticker-assets` bucket and returns its path plus a short-lived signed URL for
 * the editor preview. The browser never touches the bucket directly.
 *
 * Multipart fields: file, template_id?, sticker_width_mm?, sticker_height_mm?
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const rawTemplateId = String(form.get('template_id') || 'new');
    const templateId = rawTemplateId.replace(/[^a-zA-Z0-9-]/g, '') || 'new';
    const stickerWidthMm = Number(form.get('sticker_width_mm') ?? 64);
    const stickerHeightMm = Number(form.get('sticker_height_mm') ?? 23);

    if (!file || typeof file !== 'object' || typeof (file as any).arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    const mime = String((file as any).type || '').toLowerCase();
    if (!STICKER_IMAGE_MIME_TYPES.includes(mime as any)) {
      return NextResponse.json({ error: 'Only PNG or JPG images are supported.' }, { status: 400 });
    }
    const size = Number((file as any).size) || 0;
    if (size <= 0) {
      return NextResponse.json({ error: 'The image file is empty.' }, { status: 400 });
    }
    if (size > STICKER_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: 'Image exceeds the 10MB limit.' }, { status: 400 });
    }

    const bytes = new Uint8Array(await (file as any).arrayBuffer());

    let dims: { width: number; height: number };
    try {
      dims = await readDimensions(bytes, mime);
    } catch {
      return NextResponse.json(
        { error: 'That file is not a readable PNG or JPG image.' },
        { status: 400 }
      );
    }

    const validation = validateStickerImage({
      mime,
      bytes: size,
      widthPx: dims.width,
      heightPx: dims.height,
      stickerWidthMm,
      stickerHeightMm,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 });
    }

    const safeName = (String((file as any).name || 'design'))
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .slice(0, 80);
    const path = `designs/${templateId}/${Date.now()}-${safeName}`;

    const supabase = createServiceClient();

    // Self-heal: create the private bucket if the migration step was missed.
    await ensureStickerAssetsBucket(supabase);

    const { error: uploadError } = await supabase.storage
      .from(STICKER_ASSETS_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: true, cacheControl: '3600' });
    if (uploadError) {
      if (/bucket/i.test(uploadError.message || '')) {
        return NextResponse.json(
          {
            error:
              'Storage bucket "sticker-assets" is unavailable. Run the bucket step in supabase/migrations/add_sticker_template_design.sql, or create a private bucket named "sticker-assets" in Supabase → Storage.',
          },
          { status: 500 }
        );
      }
      throw uploadError;
    }

    const url = await signStickerImageUrl(supabase, path);

    return NextResponse.json({
      success: true,
      path,
      widthPx: dims.width,
      heightPx: dims.height,
      url,
      warnings: validation.warnings,
      dpi: validation.dpi,
    });
  } catch (err: any) {
    console.error('Failed to upload sticker design:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to upload sticker design' },
      { status: 500 }
    );
  }
}
