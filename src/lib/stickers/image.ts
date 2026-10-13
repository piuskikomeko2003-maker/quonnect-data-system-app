// Validation helpers for a single-sticker design image.
//
// A sticker design is ONE sticker, so the whole image maps onto one sticker box.
// We warn (never block) when the image aspect ratio differs from the sticker's,
// or when the effective print resolution is too low for a crisp label.

export const STICKER_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB, matches ticket-assets
export const STICKER_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'] as const;

/** Minimum acceptable effective print resolution (dots per inch). */
export const STICKER_MIN_DPI = 300;
/** Aspect-ratio tolerance before we warn (3%). */
export const STICKER_ASPECT_TOLERANCE = 0.03;

const MM_PER_INCH = 25.4;

export interface StickerImageInput {
  mime: string;
  bytes: number;
  widthPx: number;
  heightPx: number;
  stickerWidthMm: number;
  stickerHeightMm: number;
}

export interface StickerImageValidation {
  ok: boolean;
  /** Hard failures — the upload should be rejected. */
  errors: string[];
  /** Soft warnings — the upload proceeds but the admin is told. */
  warnings: string[];
  /** Effective print DPI (lower of the two axes), rounded. */
  dpi: number;
  /** How far the image aspect differs from the sticker aspect (0.05 = 5%). */
  aspectDelta: number;
}

/**
 * Validates a design image against the sticker's physical size. `ok` is false
 * only for hard failures (wrong type, too big, unreadable dimensions).
 */
export function validateStickerImage(input: StickerImageInput): StickerImageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const mime = String(input.mime || '').toLowerCase();
  if (!STICKER_IMAGE_MIME_TYPES.includes(mime as any)) {
    errors.push('Only PNG or JPG images are supported.');
  }

  if (!Number.isFinite(input.bytes) || input.bytes <= 0) {
    errors.push('The image file is empty.');
  } else if (input.bytes > STICKER_IMAGE_MAX_BYTES) {
    errors.push('Image exceeds the 10MB limit.');
  }

  const widthPx = Number(input.widthPx);
  const heightPx = Number(input.heightPx);
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    errors.push('Could not read the image dimensions.');
  }

  const stickerWidthMm = Math.max(1, Number(input.stickerWidthMm) || 64);
  const stickerHeightMm = Math.max(1, Number(input.stickerHeightMm) || 23);

  let dpi = 0;
  let aspectDelta = 0;

  if (widthPx > 0 && heightPx > 0) {
    const dpiWidth = widthPx / (stickerWidthMm / MM_PER_INCH);
    const dpiHeight = heightPx / (stickerHeightMm / MM_PER_INCH);
    dpi = Math.round(Math.min(dpiWidth, dpiHeight));

    const imageAspect = widthPx / heightPx;
    const stickerAspect = stickerWidthMm / stickerHeightMm;
    aspectDelta = Math.abs(imageAspect - stickerAspect) / stickerAspect;

    if (aspectDelta > STICKER_ASPECT_TOLERANCE) {
      warnings.push(
        `Image aspect ratio (${widthPx}×${heightPx}) does not match the sticker ` +
          `(${stickerWidthMm}×${stickerHeightMm} mm). It will be cropped to fit ` +
          `(not stretched). Upload an image with the same ratio for the best result.`
      );
    }
    if (dpi < STICKER_MIN_DPI) {
      warnings.push(
        `Resolution is low (~${dpi} DPI). For crisp printing use at least ` +
          `${STICKER_MIN_DPI} DPI (about ${Math.ceil((stickerWidthMm / MM_PER_INCH) * STICKER_MIN_DPI)}×` +
          `${Math.ceil((stickerHeightMm / MM_PER_INCH) * STICKER_MIN_DPI)} px).`
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings, dpi, aspectDelta };
}
