// Shared text-fitting used by BOTH the browser preview and the PDF renderer so
// the business name lands identically in each. The caller supplies a `measure`
// function (canvas metrics in the browser, pdf-lib font metrics on the server)
// so the algorithm itself stays identical across both.

export type Measure = (text: string, fontSize: number) => number;

export const FITTING_LINE_HEIGHT = 1.12;

/**
 * The same geometry used by the editor preview and the PDF renderer: a field's
 * absolute box and starting font size, derived only from percentages and the
 * containing sticker/slot box. Sharing this is what keeps the printed text in
 * exactly the same place as the live preview.
 */
export interface FieldBox {
  left: number;
  top: number;
  width: number;
  height: number;
  startSize: number;
}

export function fieldBox(
  style: { x: number; y: number; width: number; height: number; fontSizePct: number },
  boxWidth: number,
  boxHeight: number
): FieldBox {
  return {
    left: (style.x / 100) * boxWidth,
    top: (style.y / 100) * boxHeight,
    width: Math.max(1, (style.width / 100) * boxWidth),
    height: Math.max(1, (style.height / 100) * boxHeight),
    startSize: (style.fontSizePct / 100) * boxHeight,
  };
}

/** Breaks text on spaces to fit maxWidth. A single over-long word is kept whole. */
export function wrapLines(
  text: string,
  fontSize: number,
  maxWidth: number,
  measure: Measure
): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/** Trims a line to fit maxWidth, ending with an ellipsis if it cannot. */
export function ellipsize(
  text: string,
  fontSize: number,
  maxWidth: number,
  measure: Measure
): string {
  if (measure(text, fontSize) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && measure(`${trimmed}…`, fontSize) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

export interface FittingOptions {
  maxWidth: number;
  maxHeight: number;
  startSize: number;
  /** 1 for a single line, 2 for wrap-to-two-lines. */
  maxLines: number;
  /** Shrink the font until it fits (business name). */
  autoShrink: boolean;
  minSize?: number;
}

export interface FittingResult {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  truncated: boolean;
}

/**
 * Fits text into a box. With `autoShrink`, the font steps down (0.5pt) until the
 * text fits within maxLines and maxHeight. Without it, the font is fixed and any
 * overflow is ellipsized. The last line is ellipsized as a last resort so text
 * never overflows the box.
 */
export function fitText(
  text: string,
  options: FittingOptions,
  measure: Measure
): FittingResult {
  const minSize = options.minSize ?? 5;
  const maxLines = Math.max(1, options.maxLines);
  const safeText = String(text ?? '');

  if (options.autoShrink) {
    for (let size = options.startSize; size >= minSize; size -= 0.5) {
      const wrapped = wrapLines(safeText, size, options.maxWidth, measure);
      const lineHeight = size * FITTING_LINE_HEIGHT;
      if (wrapped.length <= maxLines && wrapped.length * lineHeight <= options.maxHeight) {
        return { lines: wrapped, fontSize: size, lineHeight, truncated: false };
      }
    }

    const size = minSize;
    const wrapped = wrapLines(safeText, size, options.maxWidth, measure);
    const lines = wrapped.slice(0, maxLines);
    const truncated = wrapped.length > maxLines;
    if (truncated && lines.length) {
      lines[lines.length - 1] = ellipsize(lines[lines.length - 1], size, options.maxWidth, measure);
    }
    return { lines, fontSize: size, lineHeight: size * FITTING_LINE_HEIGHT, truncated };
  }

  const size = options.startSize;
  const wrapped = wrapLines(safeText, size, options.maxWidth, measure);
  const lines = wrapped.slice(0, maxLines);
  const truncated = wrapped.length > maxLines;
  const ellipsized = lines.map((line) => ellipsize(line, size, options.maxWidth, measure));
  return { lines: ellipsized, fontSize: size, lineHeight: size * FITTING_LINE_HEIGHT, truncated };
}
