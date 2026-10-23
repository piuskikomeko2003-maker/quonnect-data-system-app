'use client';

// The ONE renderer for a sticker's artwork (background image + placed fields).
//
// Both the single-sticker "Live preview" editor and the "Live page preview"
// grid render through this component, so a sticker always looks identical in
// both places. It only needs the box size in pixels; every position and size is
// a percentage of that box, and the font size is derived from the box height.
//
// `interactive` is only supplied by the editor: the page preview passes nothing
// and gets a compact, non-interactive copy of exactly the same markup.

import React, { useMemo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import {
  STICKER_FIELD_KEYS,
  STICKER_FIELD_LABELS,
  STICKER_FONT_FAMILIES,
  type StickerDesign,
  type StickerFieldKey,
  type StickerSampleData,
} from '@/types/sticker';
import { fitText } from '@/lib/stickers/fitting';

export const STICKER_FONT_CSS: Record<string, string> = Object.fromEntries(
  STICKER_FONT_FAMILIES.map((f) => [f.key, f.css])
);

let measureCtx: CanvasRenderingContext2D | null = null;
function measureText(text: string, fontSize: number, family: string, bold: boolean): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.55;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.55;
  measureCtx.font = `${bold ? 700 : 400} ${fontSize}px ${STICKER_FONT_CSS[family] || STICKER_FONT_CSS.helvetica}`;
  return measureCtx.measureText(text).width;
}

export const sampleValues = (sample: StickerSampleData): Record<StickerFieldKey, string> => ({
  business_name: sample.business_name,
  ticket_number: sample.ticket_number,
  table_label: sample.table_label,
});

export interface StickerImageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export interface StickerArtworkInteraction {
  activeField: StickerFieldKey;
  onFieldPointerDown: (e: React.PointerEvent, key: StickerFieldKey) => void;
  onFieldKeyDown: (e: React.KeyboardEvent, key: StickerFieldKey) => void;
  onResizePointerDown: (e: React.PointerEvent, key: StickerFieldKey, handle: ResizeHandle) => void;
}

interface StickerArtworkProps {
  design: StickerDesign;
  sample: StickerSampleData;
  /** Rendered width/height of the sticker box in the same pixel space. */
  widthPx: number;
  heightPx: number;
  imageUrl: string | null;
  /** Image rectangle relative to the box; defaults to filling the box. */
  imageBox?: StickerImageBox;
  /** Hide the placed text without hiding the image. */
  showText?: boolean;
  /** Shown when there is no image; omitted in the page grid. */
  emptyImageHint?: React.ReactNode;
  interactive?: StickerArtworkInteraction;
}

export const StickerArtwork: React.FC<StickerArtworkProps> = ({
  design,
  sample,
  widthPx,
  heightPx,
  imageUrl,
  imageBox,
  showText = true,
  emptyImageHint,
  interactive,
}) => {
  const values = useMemo(() => sampleValues(sample), [sample]);

  const fields = useMemo(() => {
    return STICKER_FIELD_KEYS.map((key) => {
      const style = design[key];
      if (!style?.enabled) return null;

      const boxW = (style.width / 100) * widthPx;
      const boxH = (style.height / 100) * heightPx;
      const startSize = (style.fontSizePct / 100) * heightPx;
      const maxLines = key === 'business_name' ? (style.wrap2 ? 2 : 1) : 1;

      const fitted = fitText(
        values[key],
        {
          maxWidth: boxW,
          maxHeight: boxH,
          startSize,
          maxLines,
          autoShrink: style.autoShrink,
          minSize: Math.max(4, startSize * 0.3),
        },
        (text, size) => measureText(text, size, style.fontFamily, style.bold)
      );

      const justify =
        style.vAlign === 'top' ? 'flex-start' : style.vAlign === 'middle' ? 'center' : 'flex-end';
      const alignItems =
        style.align === 'left' ? 'flex-start' : style.align === 'center' ? 'center' : 'flex-end';

      return { key, style, fitted, justify, alignItems };
    });
  }, [design, values, widthPx, heightPx]);

  const box = imageBox ?? { left: 0, top: 0, width: widthPx, height: heightPx };

  return (
    <div className="absolute inset-0" style={{ overflow: 'hidden' }}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{
            position: 'absolute',
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            pointerEvents: 'none',
          }}
        />
      ) : emptyImageHint ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-[11px] gap-1.5">
          <ImageIcon className="w-4 h-4" />
          {emptyImageHint}
        </div>
      ) : null}

      {showText &&
        fields.map((field) => {
          if (!field) return null;
          const { key, style, fitted, justify, alignItems } = field;
          const isCurrent = interactive?.activeField === key;

          return (
            <div
              key={key}
              onPointerDown={interactive ? (e) => interactive.onFieldPointerDown(e, key) : undefined}
              onKeyDown={interactive ? (e) => interactive.onFieldKeyDown(e, key) : undefined}
              tabIndex={interactive ? 0 : undefined}
              className={interactive ? 'absolute cursor-move outline-none' : 'absolute'}
              style={{
                left: `${style.x}%`,
                top: `${style.y}%`,
                width: `${style.width}%`,
                height: `${style.height}%`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: justify,
                alignItems,
                overflow: 'hidden',
                pointerEvents: interactive ? undefined : 'none',
                outline: interactive
                  ? isCurrent
                    ? '2px dashed #1d4ed8'
                    : '1px solid rgba(0,0,0,0.08)'
                  : undefined,
                backgroundColor:
                  interactive && isCurrent ? 'rgba(29,78,216,0.10)' : 'transparent',
                zIndex: interactive && isCurrent ? 20 : 10,
              }}
            >
              {fitted.lines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    fontSize: `${fitted.fontSize}px`,
                    lineHeight: `${fitted.lineHeight}px`,
                    fontWeight: style.bold ? 700 : 400,
                    fontFamily: STICKER_FONT_CSS[style.fontFamily] || STICKER_FONT_CSS.helvetica,
                    color: style.color || '#000000',
                    textAlign: style.align,
                    whiteSpace: 'pre',
                    pointerEvents: 'none',
                  }}
                >
                  {line}
                </div>
              ))}

              {interactive && isCurrent && (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                    <span
                      key={handle}
                      onPointerDown={(e) => interactive.onResizePointerDown(e, key, handle)}
                      style={{
                        position: 'absolute',
                        width: 10,
                        height: 10,
                        background: '#1d4ed8',
                        border: '1px solid #fff',
                        borderRadius: 2,
                        cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                        left: handle === 'nw' || handle === 'sw' ? -5 : undefined,
                        right: handle === 'ne' || handle === 'se' ? -5 : undefined,
                        top: handle === 'nw' || handle === 'ne' ? -5 : undefined,
                        bottom: handle === 'sw' || handle === 'se' ? -5 : undefined,
                      }}
                    />
                  ))}
                  <span
                    style={{
                      position: 'absolute',
                      top: -16,
                      left: 0,
                      fontSize: 9,
                      background: '#1d4ed8',
                      color: '#fff',
                      padding: '1px 4px',
                      borderRadius: 2,
                      whiteSpace: 'nowrap',
                      fontWeight: 'bold',
                      pointerEvents: 'none',
                    }}
                  >
                    {STICKER_FIELD_LABELS[key]}
                  </span>
                </>
              )}
            </div>
          );
        })}
    </div>
  );
};
