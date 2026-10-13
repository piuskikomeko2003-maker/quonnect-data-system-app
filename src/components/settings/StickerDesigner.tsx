'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Move,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpToLine,
  ArrowDownToLine,
  Bold as BoldIcon,
  RotateCcw,
  Shuffle,
  Image as ImageIcon,
  Eye,
  Sliders,
} from 'lucide-react';
import {
  DEFAULT_STICKER_DESIGN,
  STICKER_FIELD_KEYS,
  STICKER_FIELD_LABELS,
  STICKER_FONT_FAMILIES,
  STICKER_SAMPLE_DATA,
  suggestedFontSizePct,
  type StickerDesign,
  type StickerFieldKey,
  type StickerFieldStyle,
  type StickerFontFamily,
  type StickerHAlign,
  type StickerVAlign,
} from '@/types/sticker';
import { fitText } from '@/lib/stickers/fitting';

const FONT_CSS: Record<StickerFontFamily, string> = {
  helvetica: 'Helvetica, Arial, sans-serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
};

let measureCtx: CanvasRenderingContext2D | null = null;
function measureText(text: string, fontSize: number, family: StickerFontFamily, bold: boolean): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.55;
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  if (!measureCtx) return text.length * fontSize * 0.55;
  measureCtx.font = `${bold ? 700 : 400} ${fontSize}px ${FONT_CSS[family]}`;
  return measureCtx.measureText(text).width;
}

interface StickerDesignerProps {
  design: StickerDesign;
  onChange: (design: StickerDesign) => void;
  stickerWidthMm: number;
  stickerHeightMm: number;
  /** Signed URL of the design image, or null for the white-sticker fallback. */
  imageUrl: string | null;
}

interface DragState {
  key: StickerFieldKey;
  mode: 'move' | 'resize';
  handle?: 'nw' | 'ne' | 'sw' | 'se';
  startX: number;
  startY: number;
  orig: StickerFieldStyle;
  canvasW: number;
  canvasH: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const MIN_SIZE_PCT = 5;

export const StickerDesigner: React.FC<StickerDesignerProps> = ({
  design,
  onChange,
  stickerWidthMm,
  stickerHeightMm,
  imageUrl,
}) => {
  const aspect = stickerWidthMm > 0 && stickerHeightMm > 0 ? stickerWidthMm / stickerHeightMm : 64 / 23;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [canvasW, setCanvasW] = useState(420);
  const [canvasH, setCanvasH] = useState(420 / aspect);
  const [activeField, setActiveField] = useState<StickerFieldKey>('business_name');
  const [sampleIndex, setSampleIndex] = useState(0);

  // Keep the on-screen canvas at the real sticker aspect ratio, fitting width.
  useEffect(() => {
    const update = () => {
      const width = containerRef.current?.clientWidth || 420;
      const height = width / aspect;
      setCanvasW(width);
      setCanvasH(height);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [aspect]);

  const sample = STICKER_SAMPLE_DATA[sampleIndex % STICKER_SAMPLE_DATA.length];
  const sampleValues: Record<StickerFieldKey, string> = {
    business_name: sample.business_name,
    ticket_number: sample.ticket_number,
    table_label: sample.table_label,
  };

  const updateField = useCallback(
    (key: StickerFieldKey, patch: Partial<StickerFieldStyle>) => {
      onChange({ ...design, [key]: { ...design[key], ...patch } });
    },
    [design, onChange]
  );

  const resetField = (key: StickerFieldKey) => {
    onChange({ ...design, [key]: { ...DEFAULT_STICKER_DESIGN[key] } });
  };

  const beginDrag = (
    e: React.PointerEvent,
    key: StickerFieldKey,
    mode: 'move' | 'resize',
    handle?: DragState['handle']
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      key,
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...design[key] },
      canvasW,
      canvasH,
    };
    setActiveField(key);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dxPct = ((e.clientX - drag.startX) / drag.canvasW) * 100;
    const dyPct = ((e.clientY - drag.startY) / drag.canvasH) * 100;
    const o = drag.orig;

    if (drag.mode === 'move') {
      const x = clamp(o.x + dxPct, 0, 100 - o.width);
      const y = clamp(o.y + dyPct, 0, 100 - o.height);
      updateField(drag.key, { x, y });
      return;
    }

    let { x, y, width, height } = o;
    if (drag.handle === 'se') {
      width = clamp(o.width + dxPct, MIN_SIZE_PCT, 100 - o.x);
      height = clamp(o.height + dyPct, MIN_SIZE_PCT, 100 - o.y);
    } else if (drag.handle === 'nw') {
      const maxW = o.x + o.width;
      width = clamp(o.width - dxPct, MIN_SIZE_PCT, maxW);
      height = clamp(o.height - dyPct, MIN_SIZE_PCT, o.y + o.height);
      x = maxW - width;
      y = o.y + o.height - height;
    } else if (drag.handle === 'ne') {
      width = clamp(o.width + dxPct, MIN_SIZE_PCT, 100 - o.x);
      const maxH = o.y + o.height;
      height = clamp(o.height - dyPct, MIN_SIZE_PCT, maxH);
      y = maxH - height;
    } else if (drag.handle === 'sw') {
      const maxW = o.x + o.width;
      width = clamp(o.width - dxPct, MIN_SIZE_PCT, maxW);
      x = maxW - width;
      height = clamp(o.height + dyPct, MIN_SIZE_PCT, 100 - o.y);
    }
    updateField(drag.key, { x, y, width, height });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: StickerFieldKey) => {
    const style = design[key];
    const step = e.shiftKey ? 2 : 0.5;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else return;
    e.preventDefault();
    updateField(key, {
      x: clamp(style.x + dx, 0, 100 - style.width),
      y: clamp(style.y + dy, 0, 100 - style.height),
    });
  };

  const renderedFields = useMemo(() => {
    return STICKER_FIELD_KEYS.map((key) => {
      const style = design[key];
      const boxW = (style.width / 100) * canvasW;
      const boxH = (style.height / 100) * canvasH;
      const startSize = (style.fontSizePct / 100) * canvasH;
      const maxLines = key === 'business_name' ? (style.wrap2 ? 2 : 1) : 1;
      const measured = (text: string, size: number) =>
        measureText(text, size, style.fontFamily, style.bold);

      const fitted = fitText(
        sampleValues[key],
        {
          maxWidth: boxW,
          maxHeight: boxH,
          startSize,
          maxLines,
          autoShrink: style.autoShrink,
          minSize: Math.max(4, startSize * 0.3),
        },
        measured
      );

      const justify =
        style.vAlign === 'top' ? 'flex-start' : style.vAlign === 'middle' ? 'center' : 'flex-end';
      const alignItems =
        style.align === 'left' ? 'flex-start' : style.align === 'center' ? 'center' : 'flex-end';

      return { key, style, fitted, justify, alignItems };
    });
  }, [design, canvasW, canvasH, sampleValues]);

  const num = (
    label: string,
    value: number,
    onChangeValue: (v: number) => void,
    opts: { min?: number; max?: number; step?: number } = {}
  ) => (
    <label className="flex flex-col gap-1 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={opts.min}
        max={opts.max}
        step={opts.step ?? 1}
        onChange={(e) => onChangeValue(Number(e.target.value))}
        className="w-full bg-bg-input border border-border rounded-md px-2 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-accent"
      />
    </label>
  );

  const toggleChip = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon?: React.ReactNode
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-all ${
        active ? 'bg-accent text-white border-accent' : 'bg-bg-input/60 text-text-secondary border-border/70 hover:text-text-primary'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const active = design[activeField];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Controls */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-bg-surface border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Fields & typography
              </h3>
            </div>
            <span className="text-[10px] text-text-tertiary">Drag on the preview to place</span>
          </div>

          {/* Field pills */}
          <div className="grid grid-cols-3 gap-1.5">
            {STICKER_FIELD_KEYS.map((key) => {
              const isCurrent = activeField === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveField(key)}
                  className={`px-2 py-2 rounded-lg text-[11px] font-semibold text-left transition-all border cursor-pointer flex flex-col ${
                    isCurrent
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'bg-bg-input/60 text-text-secondary border-border/70 hover:text-text-primary'
                  }`}
                >
                  <span className="truncate">{STICKER_FIELD_LABELS[key]}</span>
                  <span className={`text-[9px] mt-0.5 ${isCurrent ? 'text-white/80' : 'text-text-tertiary'}`}>
                    {design[key].enabled ? 'shown' : 'hidden'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active field editor */}
          <div className="bg-slate-50/70 border border-border/70 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-accent">
                Editing: {STICKER_FIELD_LABELS[activeField]}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => resetField(activeField)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-text-tertiary hover:text-text-primary cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                {toggleChip(active.enabled ? 'On' : 'Off', active.enabled, () =>
                  updateField(activeField, { enabled: !active.enabled })
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                  Font size (% of height)
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={Number.isFinite(active.fontSizePct) ? active.fontSizePct : 0}
                    min={1}
                    max={200}
                    step={0.5}
                    onChange={(e) => updateField(activeField, { fontSizePct: clamp(Number(e.target.value), 1, 200) })}
                    className="w-full bg-bg-input border border-border rounded-md px-2 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    title="Set the size to fill about 75% of this field's box height"
                    onClick={() => updateField(activeField, { fontSizePct: suggestedFontSizePct(active.height) })}
                    className="shrink-0 px-2 py-1.5 rounded-md border border-accent/40 bg-accent-soft/30 text-accent text-[10px] font-bold cursor-pointer hover:bg-accent-soft"
                  >
                    Fit 75%
                  </button>
                </div>
              </div>
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                Font family
                <select
                  value={active.fontFamily}
                  onChange={(e) => updateField(activeField, { fontFamily: e.target.value as StickerFontFamily })}
                  className="w-full bg-bg-input border border-border rounded-md px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                >
                  {STICKER_FONT_FAMILIES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {num('Box width (%)', active.width, (v) => updateField(activeField, { width: clamp(v, MIN_SIZE_PCT, 100) }), { min: MIN_SIZE_PCT, max: 100 })}
              {num('Box height (%)', active.height, (v) => updateField(activeField, { height: clamp(v, MIN_SIZE_PCT, 100) }), { min: MIN_SIZE_PCT, max: 100 })}
            </div>

            {/* Horizontal align */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Horizontal align</span>
              <div className="flex gap-1.5">
                {toggleChip('Left', active.align === 'left', () => updateField(activeField, { align: 'left' }), <AlignLeft className="w-3.5 h-3.5" />)}
                {toggleChip('Center', active.align === 'center', () => updateField(activeField, { align: 'center' }), <AlignCenter className="w-3.5 h-3.5" />)}
                {toggleChip('Right', active.align === 'right', () => updateField(activeField, { align: 'right' }), <AlignRight className="w-3.5 h-3.5" />)}
              </div>
            </div>

            {/* Vertical align */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Vertical align</span>
              <div className="flex gap-1.5">
                {toggleChip('Top', active.vAlign === 'top', () => updateField(activeField, { vAlign: 'top' }), <ArrowUpToLine className="w-3.5 h-3.5" />)}
                {toggleChip('Middle', active.vAlign === 'middle', () => updateField(activeField, { vAlign: 'middle' }), <Move className="w-3.5 h-3.5" />)}
                {toggleChip('Bottom', active.vAlign === 'bottom', () => updateField(activeField, { vAlign: 'bottom' }), <ArrowDownToLine className="w-3.5 h-3.5" />)}
              </div>
            </div>

            {/* Style row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={active.color || '#000000'}
                    onChange={(e) => updateField(activeField, { color: e.target.value })}
                    className="w-8 h-8 rounded border border-border cursor-pointer p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={active.color || '#000000'}
                    onChange={(e) => updateField(activeField, { color: e.target.value })}
                    className="w-full bg-bg-input border border-border rounded-md px-2 py-1 text-xs font-mono uppercase text-text-primary"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Weight</span>
                <div className="flex items-center gap-1.5">
                  {toggleChip('Bold', active.bold, () => updateField(activeField, { bold: !active.bold }), <BoldIcon className="w-3.5 h-3.5" />)}
                </div>
              </div>
            </div>

            {/* Business-name specific */}
            {activeField === 'business_name' && (
              <div className="pt-2 border-t border-border/60 space-y-2">
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                  Long-name handling
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {toggleChip('Auto shrink to fit', active.autoShrink, () =>
                    updateField(activeField, { autoShrink: !active.autoShrink })
                  )}
                  {toggleChip('Wrap to 2 lines', active.wrap2, () =>
                    updateField(activeField, { wrap2: !active.wrap2 })
                  )}
                </div>
                <p className="text-[10px] text-text-tertiary">
                  With shrink on, the name steps down in size until it fits the box, so it never overflows.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {num('X position (%)', active.x, (v) => updateField(activeField, { x: clamp(v, 0, 100 - active.width) }), { min: 0, max: 100, step: 0.5 })}
              {num('Y position (%)', active.y, (v) => updateField(activeField, { y: clamp(v, 0, 100 - active.height) }), { min: 0, max: 100, step: 0.5 })}
            </div>
          </div>
        </div>
      </div>

      {/* Preview canvas */}
      <div className="lg:col-span-7 space-y-3">
        <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Live preview
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSampleIndex((i) => (i + 1) % STICKER_SAMPLE_DATA.length)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-soft/40 hover:bg-accent-soft text-accent text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Cycle sample ({sampleIndex + 1}/{STICKER_SAMPLE_DATA.length})
            </button>
          </div>

          <p className="text-[11px] text-text-secondary">
            Sticker size {stickerWidthMm} × {stickerHeightMm} mm. Fields are stored as percentages, so they
            rescale with any sticker size or grid change.
          </p>

          <div className="w-full bg-slate-900 rounded-xl overflow-hidden border border-border shadow-inner flex items-center justify-center p-4">
            <div
              ref={containerRef}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
              className="relative select-none touch-none"
              style={{ width: '100%', maxWidth: '100%' }}
            >
              <div
                className="relative bg-white overflow-hidden"
                style={{
                  width: `${canvasW}px`,
                  height: `${canvasH}px`,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                }}
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Sticker design"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-[11px] gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    No image — plain white sticker
                  </div>
                )}

                {/* Overlaid fields */}
                {renderedFields.map(({ key, style, fitted, justify, alignItems }) => {
                  if (!style.enabled) return null;
                  const isCurrent = activeField === key;
                  return (
                    <div
                      key={key}
                      onPointerDown={(e) => beginDrag(e, key, 'move')}
                      onKeyDown={(e) => handleKeyDown(e, key)}
                      tabIndex={0}
                      className="absolute cursor-move outline-none"
                      style={{
                        left: `${style.x}%`,
                        top: `${style.y}%`,
                        width: `${style.width}%`,
                        height: `${style.height}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: justify,
                        alignItems,
                        outline: isCurrent ? '2px dashed #1d4ed8' : '1px solid rgba(0,0,0,0.08)',
                        backgroundColor: isCurrent ? 'rgba(29,78,216,0.10)' : 'transparent',
                        zIndex: isCurrent ? 20 : 10,
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
                            fontFamily: FONT_CSS[style.fontFamily],
                            color: style.color || '#000000',
                            textAlign: style.align,
                            whiteSpace: 'pre',
                            pointerEvents: 'none',
                          }}
                        >
                          {line}
                        </div>
                      ))}

                      {isCurrent && (
                        <>
                          {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                            <span
                              key={handle}
                              onPointerDown={(e) => beginDrag(e, key, 'resize', handle)}
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
            </div>
          </div>

          <div className="bg-accent-soft/20 border border-accent/20 rounded-xl p-3 flex items-start gap-2 text-[11px] text-text-secondary">
            <Type className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p>
              Drag a field to move it, drag a corner handle to resize its box, or use the arrow keys.
              The preview uses real text metrics so long names shrink exactly as they will in the PDF.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
