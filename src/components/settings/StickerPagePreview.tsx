'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Minus, Plus, Maximize2 } from 'lucide-react';
import {
  STICKER_FIELD_KEYS,
  STICKER_FONT_FAMILIES,
  STICKER_SAMPLE_DATA,
  type StickerDesign,
  type StickerFieldKey,
  type StickerSampleData,
} from '@/types/sticker';
import { fieldBox, fitText } from '@/lib/stickers/fitting';
import {
  computeStickerLayout,
  slotImageBox,
  type StickerLayoutSettings,
  type StickerSlotMm,
} from '@/lib/stickers/pageLayout';

const FONT_CSS: Record<string, string> = Object.fromEntries(
  STICKER_FONT_FAMILIES.map((f) => [f.key, f.css])
);

let measureCtx: CanvasRenderingContext2D | null = null;
function measureText(text: string, fontSize: number, family: string, bold: boolean): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.55;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.55;
  measureCtx.font = `${bold ? 700 : 400} ${fontSize}px ${FONT_CSS[family] || FONT_CSS.helvetica}`;
  return measureCtx.measureText(text).width;
}

const sampleValues = (sample: StickerSampleData): Record<StickerFieldKey, string> => ({
  business_name: sample.business_name,
  ticket_number: sample.ticket_number,
  table_label: sample.table_label,
});

interface StickerPagePreviewProps {
  settings: StickerLayoutSettings;
  design: StickerDesign;
  imageUrl: string | null;
  samples?: StickerSampleData[];
}

/** A live, scaled drawing of the sheet — recomputed on every keystroke. */
export const StickerPagePreview: React.FC<StickerPagePreviewProps> = ({
  settings,
  design,
  imageUrl,
  samples = STICKER_SAMPLE_DATA,
}) => {
  const layout = useMemo(() => computeStickerLayout(settings), [settings]);
  const [zoom, setZoom] = useState(1);
  const [showText, setShowText] = useState(true);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(440);

  useEffect(() => {
    const update = () => setBaseWidth(Math.max(260, containerRef.current?.clientWidth || 440));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const scale = (baseWidth * zoom) / layout.pageWidthMm;
  const pageWpx = layout.pageWidthMm * scale;
  const pageHpx = layout.pageHeightMm * scale;
  const px = (mm: number) => mm * scale;

  const requestedCount = previewCount ?? layout.stickersPerPage;
  const visibleCount = Math.max(1, Math.min(requestedCount || layout.stickersPerPage, layout.stickersPerPage));

  return (
    <div className="space-y-3">
      <div className="bg-bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Live page preview
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
              className="p-1.5 rounded-md border border-border text-text-secondary hover:text-accent cursor-pointer"
              title="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-text-tertiary w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))}
              className="p-1.5 rounded-md border border-border text-text-secondary hover:text-accent cursor-pointer"
              title="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-md border border-border text-text-secondary hover:text-accent cursor-pointer"
              title="Reset zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-semibold text-text-primary">
            {layout.stickersPerPage} sticker{layout.stickersPerPage === 1 ? '' : 's'} per page
          </span>
          <span
            className={`font-semibold px-2 py-0.5 rounded-full border ${
              layout.fits
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-red-700 bg-red-50 border-red-200'
            }`}
          >
            Fits on page: {layout.fits ? 'yes' : 'no'}
          </span>
          <span className="text-text-tertiary">
            {layout.orientation} · {layout.pageWidthMm} × {layout.pageHeightMm} mm
          </span>
        </div>

        {layout.errors.length > 0 && (
          <div className="p-2 rounded-md border border-red-300 bg-red-50 text-[11px] text-red-700 space-y-0.5">
            {layout.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}
        {layout.warnings.length > 0 && (
          <div className="p-2 rounded-md border border-amber-300 bg-amber-50 text-[11px] text-amber-800 space-y-0.5">
            {layout.warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

        {/* Page canvas */}
        <div
          ref={containerRef}
          className="rounded-lg bg-slate-200/70 border border-border p-3 overflow-auto"
          style={{ maxHeight: '70vh' }}
        >
          <div className="flex justify-center min-w-max">
            <div
              className="relative bg-white shadow"
              style={{ width: `${pageWpx}px`, height: `${pageHpx}px` }}
              data-testid="sticker-page-preview"
            >
              {/* Slots */}
              {layout.slots.map((slot) => {
                const filled = slot.index < visibleCount;
                const overflows =
                  slot.x < -0.01 ||
                  slot.y < -0.01 ||
                  slot.x + slot.width > layout.pageWidthMm + 0.01 ||
                  slot.y + slot.height > layout.pageHeightMm + 0.01;
                return (
                  <div
                    key={slot.index}
                    data-slot-index={slot.index}
                    className="absolute overflow-hidden"
                    style={{
                      left: `${px(slot.x)}px`,
                      top: `${px(slot.y)}px`,
                      width: `${px(slot.width)}px`,
                      height: `${px(slot.height)}px`,
                      outline: overflows
                        ? '2px solid #dc2626'
                        : filled
                        ? '1px solid rgba(0,0,0,0.12)'
                        : '1px dashed rgba(0,0,0,0.14)',
                      opacity: filled ? 1 : 0.35,
                    }}
                  >
                    {imageUrl && (
                      <SlotImage
                        layout={layout}
                        slot={slot}
                        imageUrl={imageUrl}
                        scale={scale}
                      />
                    )}
                    {showText &&
                      <SlotFields design={design} slot={slot} sample={samples[slot.index % samples.length]} scale={scale} />
                    }
                  </div>
                );
              })}

              {/* Crop marks + dimension lines (SVG in mm space) */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={pageWpx}
                height={pageHpx}
                viewBox={`0 0 ${layout.pageWidthMm} ${layout.pageHeightMm}`}
                preserveAspectRatio="none"
              >
                {layout.cropMarks.map((m, i) => (
                  <line
                    key={i}
                    x1={m.x1}
                    y1={m.y1}
                    x2={m.x2}
                    y2={m.y2}
                    stroke="#9ca3af"
                    strokeWidth={0.25}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {/* Page boundary */}
                <rect
                  x={0.2}
                  y={0.2}
                  width={layout.pageWidthMm - 0.4}
                  height={layout.pageHeightMm - 0.4}
                  fill="none"
                  stroke="#111827"
                  strokeWidth={0.4}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Grid boundary, red when it overflows the page */}
                <rect
                  x={layout.margins.left}
                  y={layout.margins.top}
                  width={layout.gridWidthMm}
                  height={layout.gridHeightMm}
                  fill="none"
                  stroke={layout.fits ? '#1d4ed8' : '#dc2626'}
                  strokeDasharray="2 1.5"
                  strokeWidth={0.4}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Dimension labels (HTML for crisp text at every zoom) */}
              <DimLabel x={px(layout.pageWidthMm / 2)} y={px(1)} text={`${layout.pageWidthMm} mm`} anchor="middle" />
              <DimLabel
                x={px(layout.pageWidthMm / 2)}
                y={pageHpx - 12}
                text={`${layout.pageHeightMm} mm (${layout.orientation})`}
                anchor="middle"
              />
              <DimLabel x={px(layout.margins.left / 2)} y={px(layout.margins.top + 3)} text={`${layout.margins.left.toFixed(1)}`} anchor="middle" />
              <DimLabel x={pageWpx - px(layout.margins.right / 2)} y={px(layout.margins.top + 3)} text={`${layout.margins.right.toFixed(1)}`} anchor="middle" />
              <DimLabel x={px(layout.pageWidthMm / 2)} y={Math.max(10, px(layout.margins.top) - 10)} text={`top ${layout.margins.top.toFixed(1)} mm`} anchor="middle" />
              <DimLabel x={px(layout.pageWidthMm / 2)} y={pageHpx - px(layout.margins.bottom) + 9} text={`bottom ${layout.margins.bottom.toFixed(1)} mm`} anchor="middle" />
              <DimLabel
                x={px(layout.margins.left + layout.settings.stickerWidthMm / 2)}
                y={px(layout.margins.top - 10) < 10 ? px(layout.margins.top + layout.settings.stickerHeightMm + 10) : px(layout.margins.top - 10)}
                text={`${layout.settings.stickerWidthMm} × ${layout.settings.stickerHeightMm} mm`}
                anchor="middle"
              />
            </div>
          </div>
        </div>

        {/* Preview controls */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="flex items-center gap-2 text-[11px] text-text-secondary">
            <input
              type="number"
              min={1}
              max={layout.stickersPerPage}
              value={visibleCount}
              onChange={(e) => setPreviewCount(Number(e.target.value))}
              className="w-16 bg-bg-input border border-border rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-accent"
            />
            stickers (preview only)
          </label>
          <label className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showText}
              onChange={(e) => setShowText(e.target.checked)}
              className="w-3.5 h-3.5 accent-accent"
            />
            {showText ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Sample text
          </label>
        </div>
      </div>
    </div>
  );
};

/** The design image for one slot, clipped to the bleed box, honouring fit mode. */
const SlotImage: React.FC<{
  layout: ReturnType<typeof computeStickerLayout>;
  slot: StickerSlotMm;
  imageUrl: string;
  scale: number;
}> = ({ layout, slot, imageUrl, scale }) => {
  const placement = slotImageBox(layout, slot);
  const inset = layout.imageInset;
  const clip = {
    x: slot.x - inset.left,
    y: slot.y - inset.top,
    width: slot.width + inset.left + inset.right,
    height: slot.height + inset.top + inset.bottom,
  };
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${clip.x * scale}px`,
        top: `${clip.y * scale}px`,
        width: `${clip.width * scale}px`,
        height: `${clip.height * scale}px`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        style={{
          position: 'absolute',
          left: `${(placement.x - clip.x) * scale}px`,
          top: `${(placement.y - clip.y) * scale}px`,
          width: `${placement.width * scale}px`,
          height: `${placement.height * scale}px`,
        }}
      />
    </div>
  );
};

/** The three placed text fields for one slot, using the shared fitting logic. */
const SlotFields: React.FC<{
  design: StickerDesign;
  slot: StickerSlotMm;
  sample: StickerSampleData;
  scale: number;
}> = ({ design, slot, sample, scale }) => {
  const values = sampleValues(sample);
  return (
    <>
      {STICKER_FIELD_KEYS.map((key) => {
        const style = design[key];
        if (!style || !style.enabled) return null;
        const value = values[key];
        if (!value) return null;

        const fb = fieldBox(style, slot.width, slot.height);
        const maxLines = key === 'business_name' ? (style.wrap2 ? 2 : 1) : 1;
        const measured = (text: string, size: number) =>
          measureText(text, size, style.fontFamily, style.bold);
        const fitted = fitText(
          value,
          {
            maxWidth: fb.width,
            maxHeight: fb.height,
            startSize: fb.startSize,
            maxLines,
            autoShrink: style.autoShrink,
            minSize: Math.max(4, fb.startSize * 0.3),
          },
          measured
        );

        const justify =
          style.vAlign === 'top' ? 'flex-start' : style.vAlign === 'middle' ? 'center' : 'flex-end';
        const alignItems =
          style.align === 'left' ? 'flex-start' : style.align === 'center' ? 'center' : 'flex-end';

        return (
          <div
            key={key}
            style={{
              position: 'absolute',
              left: `${fb.left * scale}px`,
              top: `${fb.top * scale}px`,
              width: `${fb.width * scale}px`,
              height: `${fb.height * scale}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: justify,
              alignItems,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            {fitted.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  width: '100%',
                  fontSize: `${fitted.fontSize * scale}px`,
                  lineHeight: `${fitted.lineHeight * scale}px`,
                  fontWeight: style.bold ? 700 : 400,
                  fontFamily: FONT_CSS[style.fontFamily] || FONT_CSS.helvetica,
                  color: style.color || '#000000',
                  textAlign: style.align,
                  whiteSpace: 'pre',
                }}
              >
                {line}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
};

const DimLabel: React.FC<{ x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' }> = ({
  x,
  y,
  text,
  anchor,
}) => (
  <span
    className="absolute text-[9px] font-mono text-accent bg-white/85 px-0.5 rounded pointer-events-none whitespace-nowrap"
    style={{
      left: `${x}px`,
      top: `${y}px`,
      transform:
        anchor === 'middle' ? 'translate(-50%, -50%)' : anchor === 'end' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
    }}
  >
    {text}
  </span>
);
