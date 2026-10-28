'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchEditionDays, dayLabel, dayDateLabel, type EditionDay } from '@/lib/editionDays';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Sticker as StickerIcon,
  Save,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Grid3x3,
  Ruler,
  Type,
  Scissors,
  Upload,
  Image as ImageIcon,
  Trash2,
  Plus,
  Copy,
  Link2,
  Wand2,
  Layout,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import type { StickerTemplate, StickerTemplatePatch } from '@/types/sticker';
import { normalizeDesign } from '@/types/sticker';
import { computeStickerLayout, autoFitStickerSize } from '@/lib/stickers/pageLayout';
import { layoutSettingsFromTemplate } from '@/lib/stickers/templateLayout';
import { StickerDesigner } from './StickerDesigner';
import { StickerPagePreview } from './StickerPagePreview';

interface EditionOption {
  id: string;
  name: string;
  date?: string;
}

const toPatch = (t: StickerTemplate): StickerTemplatePatch => ({
  edition_id: t.edition_id ?? null,
  edition_day_id: t.edition_day_id ?? null,
  orientation: t.orientation,
  page_width_mm: Number(t.page_width_mm),
  page_height_mm: Number(t.page_height_mm),
  columns: Number(t.columns),
  rows: Number(t.rows),
  sticker_width_mm: Number(t.sticker_width_mm),
  sticker_height_mm: Number(t.sticker_height_mm),
  margin_top_mm: Number(t.margin_top_mm),
  margin_right_mm: Number(t.margin_right_mm),
  margin_bottom_mm: Number(t.margin_bottom_mm),
  margin_left_mm: Number(t.margin_left_mm),
  gap_x_mm: Number(t.gap_x_mm),
  gap_y_mm: Number(t.gap_y_mm),
  inner_padding_mm: Number(t.inner_padding_mm),
  bleed_mm: Number(t.bleed_mm),
  fit_mode: t.fit_mode,
  lock_aspect: t.lock_aspect !== false,
  cut_lines: Boolean(t.cut_lines),
  auto_center: t.auto_center !== false,
  business_font_size: Number(t.business_font_size),
  ticket_font_size: Number(t.ticket_font_size),
  table_font_size: Number(t.table_font_size),
  image_path: t.image_path ?? null,
  image_width_px: t.image_width_px ?? null,
  image_height_px: t.image_height_px ?? null,
  design: normalizeDesign(t.design),
});

export const StickerTemplateSettings: React.FC = () => {
  const [templates, setTemplates] = useState<StickerTemplate[]>([]);
  /** 'global' or an edition id. */
  const [scope, setScope] = useState<string>('global');
  const [editions, setEditions] = useState<EditionOption[]>([]);
  const [editionDays, setEditionDays] = useState<EditionDay[]>([]);
  /** '' = edition fallback; otherwise an edition day id. */
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<StickerTemplatePatch | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [creatingEdition, setCreatingEdition] = useState(false);
  const [missingTable, setMissingTable] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditionScope = scope !== 'global';
  const isDayScope = isEditionScope && Boolean(selectedDayId);

  const globalTemplates = useMemo(() => templates.filter((t) => !t.edition_id), [templates]);
  const defaultTemplate = useMemo(
    () => globalTemplates.find((t) => t.is_active) || globalTemplates[0] || null,
    [globalTemplates]
  );
  const editionTemplate = useMemo(() => {
    if (!isEditionScope) return null;
    if (selectedDayId) {
      return templates.find((t) => t.edition_day_id === selectedDayId) || null;
    }
    return (
      templates.find((t) => t.edition_id === scope && !t.edition_day_id) || null
    );
  }, [templates, scope, isEditionScope, selectedDayId]);

  const selected = useMemo(() => {
    if (isEditionScope) return editionTemplate;
    return (
      templates.find((t) => t.id === selectedId && !t.edition_id) ||
      defaultTemplate ||
      globalTemplates[0] ||
      null
    );
  }, [isEditionScope, editionTemplate, templates, selectedId, defaultTemplate, globalTemplates]);

  const flash = (message: string, type: 'success' | 'error' | 'warning') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 6000);
  };

  const loadEditions = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from('market_days')
        .select('*')
        .order('event_date', { ascending: false });
      if (error) throw error;
      setEditions(
        (data || []).map((row: { id: string; name?: string | null; edition?: string | null; event_date?: string | null }) => ({
          id: row.id,
          name: row.edition || row.name || 'Untitled edition',
          date: row.event_date || undefined,
        }))
      );
    } catch (err) {
      console.error('Failed to load editions for sticker templates:', err);
    }
  }, []);

  const loadTemplates = useCallback(async (preferId?: string, preferScope: string = 'global', preferDayId?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/stickers/templates', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.tableMissing) setMissingTable(true);
        throw new Error(data?.error || 'Failed to load sticker templates');
      }
      const list: StickerTemplate[] = data.templates || [];
      setTemplates(list);
      setMissingTable(false);

      const globals = list.filter((t) => !t.edition_id);
      const fallback = globals.find((t) => t.is_active) || globals[0] || list[0] || null;
      const scoped =
        preferScope !== 'global'
          ? preferDayId
            ? list.find((t) => t.edition_day_id === preferDayId) || null
            : list.find((t) => t.edition_id === preferScope && !t.edition_day_id) || null
          : null;
      const preferred =
        preferId && list.some((t) => t.id === preferId && !t.edition_id)
          ? list.find((t) => t.id === preferId) || null
          : null;
      const next = preferScope === 'global' ? preferred || fallback : scoped;

      setSelectedId(next?.id || '');
      setDraft(next ? toPatch(next) : null);
      setImageUrl(next?.image_url ?? null);
    } catch (err: any) {
      flash(err?.message || 'Failed to load sticker templates', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadEditions();
  }, [loadTemplates, loadEditions]);

  useEffect(() => {
    setNameDraft(selected?.preset_name || '');
  }, [selected?.preset_name, selectedId]);

  const selectPreset = (id: string) => {
    setScope('global');
    setSelectedId(id);
    const t = templates.find((x) => x.id === id && !x.edition_id);
    setDraft(t ? toPatch(t) : null);
    setImageUrl(t?.image_url ?? null);
    setWarnings([]);
    setStatus(null);
  };

  const selectScope = (nextScope: string) => {
    setScope(nextScope);
    setSelectedDayId('');
    setEditionDays([]);
    setWarnings([]);
    setStatus(null);

    const next =
      nextScope === 'global'
        ? defaultTemplate
        : templates.find((t) => t.edition_id === nextScope && !t.edition_day_id) || null;

    setSelectedId(next?.id || '');
    setDraft(next ? toPatch(next) : null);
    setImageUrl(next?.image_url ?? null);

    if (nextScope !== 'global') {
      const supabase = createClient();
      if (supabase) {
        fetchEditionDays(supabase, nextScope).then((days) => {
          setEditionDays(days);
          if (days.length === 1) {
            // One-day editions behave exactly like before: edit the edition
            // fallback rather than forcing a day-specific duplicate.
            setSelectedDayId('');
          }
        });
      }
    }
  };

  const selectDay = (dayId: string) => {
    setSelectedDayId(dayId);
    setWarnings([]);
    setStatus(null);
    const next = dayId
      ? templates.find((t) => t.edition_day_id === dayId) || null
      : templates.find((t) => t.edition_id === scope && !t.edition_day_id) || null;
    setSelectedId(next?.id || '');
    setDraft(next ? toPatch(next) : null);
    setImageUrl(next?.image_url ?? null);
  };

  const setField = <K extends keyof StickerTemplatePatch>(key: K, value: StickerTemplatePatch[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  /** Live layout for the draft — the exact object the preview and PDF use. */
  const draftLayout = useMemo(
    () => (draft ? computeStickerLayout(layoutSettingsFromTemplate(draft)) : null),
    [draft]
  );

  const designAspect = useMemo(() => {
    const w = Number(draft?.image_width_px);
    const h = Number(draft?.image_height_px);
    return w > 0 && h > 0 ? w / h : null;
  }, [draft?.image_width_px, draft?.image_height_px]);

  const setOrientation = (orientation: 'portrait' | 'landscape') => {
    setDraft((prev) => {
      if (!prev) return prev;
      const dims = orientation === 'landscape' ? { w: 297, h: 210 } : { w: 210, h: 297 };
      return { ...prev, orientation, page_width_mm: dims.w, page_height_mm: dims.h };
    });
  };

  const setStickerWidth = (width: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, sticker_width_mm: width };
      if (prev.lock_aspect && designAspect) {
        next.sticker_height_mm = Math.round((width / designAspect) * 10) / 10;
      }
      return next;
    });
  };

  const setStickerHeight = (height: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, sticker_height_mm: height };
      if (prev.lock_aspect && designAspect) {
        next.sticker_width_mm = Math.round(height * designAspect * 10) / 10;
      }
      return next;
    });
  };

  const applyAutoFit = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const { widthMm, heightMm } = autoFitStickerSize(layoutSettingsFromTemplate(prev));
      return { ...prev, sticker_width_mm: widthMm, sticker_height_mm: heightMm };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setWarnings([]);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('template_id', selected?.id || 'new');
      form.append('sticker_width_mm', String(draft.sticker_width_mm));
      form.append('sticker_height_mm', String(draft.sticker_height_mm));

      const res = await fetch('/api/stickers/templates/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');

      setField('image_path', data.path);
      setField('image_width_px', data.widthPx);
      setField('image_height_px', data.heightPx);
      setImageUrl(data.url || null);
      if (Array.isArray(data.warnings) && data.warnings.length) {
        setWarnings(data.warnings);
        flash('Design uploaded with warnings.', 'warning');
      } else {
        flash(`Design uploaded (~${data.dpi} DPI).`, 'success');
      }
    } catch (err: any) {
      flash(err?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setField('image_path', null);
    setField('image_width_px', null);
    setField('image_height_px', null);
    setImageUrl(null);
    setWarnings([]);
  };

  const save = async () => {
    if (!selected || !draft) return;
    const geometryErrors = computeStickerLayout(layoutSettingsFromTemplate(draft)).errors;
    if (geometryErrors.length > 0) {
      setWarnings(geometryErrors);
      flash(geometryErrors[0], 'error');
      return;
    }
    setWarnings([]);
    setSaving(true);
    try {
      const res = await fetch('/api/stickers/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, changes: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save template');
      setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...draft } : t)));
      flash('Sticker template saved.', 'success');
    } catch (err: any) {
      flash(err?.message || 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const makeActive = async () => {
    if (!selected) return;
    setActivating(true);
    try {
      const res = await fetch('/api/stickers/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, changes: {}, makeActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to activate preset');
      setTemplates((prev) => prev.map((t) => ({ ...t, is_active: t.id === selected.id })));
      flash(`"${selected.preset_name}" is now the active preset.`, 'success');
    } catch (err: any) {
      flash(err?.message || 'Failed to activate preset', 'error');
    } finally {
      setActivating(false);
    }
  };

  const openAlignmentTest = () => {
    if (!selected) return;
    window.open(`/api/stickers/alignment-test?template_id=${selected.id}`, '_blank');
  };

  const customizeEdition = async () => {
    if (!isEditionScope) return;
    setCreatingEdition(true);
    try {
      const res = await fetch('/api/stickers/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edition_id: scope,
          edition_day_id: selectedDayId || null,
          duplicate_of: editionTemplate?.id || defaultTemplate?.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create edition design');
      await loadTemplates(data.template?.id, scope, selectedDayId || undefined);
      flash(
        selectedDayId
          ? 'Custom sticker design created for this day.'
          : 'Custom sticker design created for this edition.',
        'success'
      );
    } catch (err: any) {
      flash(err?.message || 'Failed to create edition design', 'error');
    } finally {
      setCreatingEdition(false);
    }
  };

  const createTemplate = async () => {
    const name = window.prompt('Name for the new template:', 'New template');
    if (name === null) return;
    try {
      const res = await fetch('/api/stickers/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create template');
      await loadTemplates(data.template?.id, 'global');
      flash('Template created.', 'success');
    } catch (err: any) {
      flash(err?.message || 'Failed to create template', 'error');
    }
  };

  const duplicateTemplate = async () => {
    if (!selected) return;
    try {
      const res = await fetch('/api/stickers/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicate_of: selected.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to duplicate template');
      await loadTemplates(data.template?.id, 'global');
      flash('Template duplicated.', 'success');
    } catch (err: any) {
      flash(err?.message || 'Failed to duplicate template', 'error');
    }
  };

  const deleteTemplate = async () => {
    if (!selected) return;
    const removingEdition = Boolean(selected.edition_id);
    if (
      !confirm(
        removingEdition
          ? selected.edition_day_id
            ? `Remove this day's custom sticker design? It will fall back to the edition then global default.`
            : `Remove this edition's custom sticker design? It will fall back to the global default.`
          : `Delete "${selected.preset_name}"? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/stickers/templates?id=${selected.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete template');
      if (removingEdition) {
        setTemplates((prev) => prev.filter((t) => t.id !== selected.id));
        setSelectedId('');
        setDraft(null);
        setImageUrl(null);
        flash('Edition custom design removed. This edition now uses the global default.', 'success');
      } else {
        await loadTemplates(undefined, 'global');
        flash('Template deleted.', 'success');
      }
    } catch (err: any) {
      flash(err?.message || 'Failed to delete template', 'error');
    }
  };

  const renameTemplate = async () => {
    if (!selected) return;
    const name = nameDraft.trim();
    if (!name || name === selected.preset_name) return;
    try {
      const res = await fetch('/api/stickers/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, changes: {}, preset_name: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to rename template');
      setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, preset_name: name } : t)));
      flash('Template renamed.', 'success');
    } catch (err: any) {
      flash(err?.message || 'Failed to rename template', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-tertiary gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs font-medium">Loading sticker templates…</span>
      </div>
    );
  }

  if (missingTable) {
    return (
      <div className="p-4 rounded-lg border border-amber/40 bg-amber-muted/20 text-xs text-text-secondary flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-text-primary">Sticker tables not found.</p>
          <p className="mt-1">
            Run <code className="font-mono text-[11px]">supabase/migrations/add_sticker_printing.sql</code> then{' '}
            <code className="font-mono text-[11px]">supabase/migrations/add_sticker_template_design.sql</code> in the
            Supabase SQL editor, then reload this page.
          </p>
        </div>
      </div>
    );
  }

  const editionLabel = editions.find((e) => e.id === scope)?.name || 'This edition';
  const activeDay = editionDays.find((d) => d.id === selectedDayId) || null;
  const scopeLabel = activeDay ? `${editionLabel} · ${dayLabel(activeDay)}` : editionLabel;
  const editionIdsWithTemplate = new Set(
    templates.filter((t) => t.edition_id && !t.edition_day_id).map((t) => t.edition_id as string)
  );
  const dayIdsWithTemplate = new Set(
    templates.filter((t) => t.edition_day_id).map((t) => t.edition_day_id as string)
  );

  const numField = (
    label: string,
    key: keyof StickerTemplatePatch,
    step = '0.1',
    helperText?: string
  ) => (
    <Input
      label={label}
      type="number"
      step={step}
      min={0}
      helperText={helperText}
      value={draft ? String(draft[key]) : ''}
      onChange={(e) => setField(key as any, Number(e.target.value) as any)}
    />
  );

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-accent rounded-full" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <StickerIcon className="w-5 h-5 text-accent" />
            Sticker Templates
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Give each edition its own sticker design, or fall back to the global default. Print at 100% / Actual size.
          </p>
        </div>
      </div>

      {status && (
        <div
          className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border ${
            status.type === 'success'
              ? 'border-green/40 bg-green-muted/20 text-green'
              : status.type === 'warning'
              ? 'border-amber/40 bg-amber-muted/20 text-amber'
              : 'border-red/40 bg-red-muted/20 text-red'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {status.message}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-3 rounded-md border border-amber/40 bg-amber-muted/20 text-xs text-amber space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Scope: global default or one edition */}
      <div className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-accent" />
          <label htmlFor="sticker-template-scope" className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Edition
          </label>
        </div>
        <select
          id="sticker-template-scope"
          value={scope}
          onChange={(e) => selectScope(e.target.value)}
          className="w-full sm:w-auto min-w-[260px] bg-bg-input border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
        >
          <option value="global">Global default — used by editions without a custom design</option>
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>
              {edition.name}
              {edition.date ? ` — ${edition.date}` : ''}
              {editionIdsWithTemplate.has(edition.id) ? ' (custom design)' : ''}
            </option>
          ))}
        </select>
        {isEditionScope && editionDays.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="sticker-template-day" className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              Day
            </label>
            <select
              id="sticker-template-day"
              value={selectedDayId}
              onChange={(e) => selectDay(e.target.value)}
              className="min-w-[200px] bg-bg-input border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
            >
              <option value="">Edition fallback</option>
              {editionDays.map((day) => (
                <option key={day.id} value={day.id}>
                  {dayLabel(day)} · {dayDateLabel(day)}
                  {dayIdsWithTemplate.has(day.id) ? ' (custom design)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-[11px] text-text-tertiary sm:ml-auto">
          {isEditionScope && editionTemplate
            ? isDayScope
              ? 'Editing the design used only by this day.'
              : 'Editing the fallback design used by this edition.'
            : isEditionScope
            ? isDayScope
              ? 'This day currently uses the edition/global fallback.'
              : 'This edition currently uses the global default.'
            : 'Editing the fallback design used by all editions.'}
        </p>
      </div>

      {/* Global preset tabs */}
      {!isEditionScope && (
        <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
          {globalTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => selectPreset(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
                selectedId === t.id
                  ? 'text-accent border-accent bg-accent-soft/40'
                  : 'text-text-muted border-transparent hover:text-text-primary hover:bg-slate-100'
              }`}
            >
              {t.preset_name}
              {t.is_active && <Badge variant="success" size="sm">Active</Badge>}
            </button>
          ))}
        </div>
      )}

      {isEditionScope && !editionTemplate && (
        <div className="bg-accent-soft/20 border border-accent/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-text-primary">
                {scopeLabel} has no custom sticker design yet
              </p>
              <p className="text-[11px] text-text-secondary mt-1">
                {defaultTemplate
                  ? `Currently using "${defaultTemplate.preset_name}". Create a copy for this edition, then change its image and fields without affecting other editions.`
                  : 'Create a custom design for this edition.'}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={customizeEdition}
            disabled={creatingEdition}
            className="sm:ml-auto shrink-0"
          >
            {creatingEdition ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isDayScope ? 'Customize for this day' : 'Customize for this edition'}
          </Button>
        </div>
      )}

      {draft && selected && (!isEditionScope || editionTemplate) && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {!isEditionScope && (
              <>
                <Button variant="secondary" size="sm" onClick={createTemplate}>
                  <Plus className="w-3.5 h-3.5" />
                  New template
                </Button>
                <Button variant="secondary" size="sm" onClick={duplicateTemplate}>
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </Button>
              </>
            )}
            {isEditionScope && (
              <Badge variant="info" size="sm">
                Custom design for {scopeLabel}
              </Badge>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Template name"
                className="bg-bg-input border border-border rounded-md px-3 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-accent"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={renameTemplate}
                disabled={!nameDraft.trim() || nameDraft.trim() === selected.preset_name}
              >
                Rename
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={deleteTemplate}
                className="text-rose-600 border-rose-200 hover:text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-text-tertiary font-medium">
              <Grid3x3 className="w-3.5 h-3.5" />
              {draft.columns} × {draft.rows} = {Number(draft.columns) * Number(draft.rows)} stickers / page
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={openAlignmentTest}>
                <Printer className="w-3.5 h-3.5" />
                Print alignment test
              </Button>
              {!isEditionScope && !selected.is_active && (
                <Button variant="secondary" size="sm" onClick={makeActive} disabled={activating}>
                  {activating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Set as active
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save template
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-5 min-w-0">
              {/* Design image */}
              <section className="space-y-3">
                <h2 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5" /> Sticker design image
                </h2>
                <div className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {draft.image_path ? 'Replace design image' : 'Upload design image'}
                  </Button>
                  {draft.image_path && (
                    <Button variant="secondary" size="sm" onClick={removeImage}>
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  )}
                  <div className="text-[11px] text-text-tertiary">
                    PNG or JPG, up to 10MB. One image = one sticker; it is tiled across the grid.
                    {draft.image_width_px && draft.image_height_px ? (
                      <span className="block font-mono text-text-secondary mt-0.5">
                        {draft.image_width_px} × {draft.image_height_px} px · ratio{' '}
                        {(draft.image_width_px / draft.image_height_px).toFixed(2)} vs sticker{' '}
                        {(Number(draft.sticker_width_mm) / Number(draft.sticker_height_mm)).toFixed(2)}
                      </span>
                    ) : (
                      <span className="block mt-0.5">No image yet — the sticker will print plain white.</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Visual designer */}
              <StickerDesigner
                design={normalizeDesign(draft.design)}
                onChange={(design) => setField('design', design)}
                stickerWidthMm={Number(draft.sticker_width_mm)}
                stickerHeightMm={Number(draft.sticker_height_mm)}
                imageUrl={imageUrl}
              />

              {/* Grid & size */}
              <section className="space-y-3">
                <h2 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <Grid3x3 className="w-3.5 h-3.5" /> Grid &amp; sticker size
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {numField('Columns', 'columns', '1')}
                  {numField('Rows', 'rows', '1')}
                  <Input
                    label="Sticker width (mm)"
                    type="number"
                    step="0.1"
                    min={1}
                    value={String(draft.sticker_width_mm)}
                    onChange={(e) => setStickerWidth(Number(e.target.value))}
                  />
                  <Input
                    label="Sticker height (mm)"
                    type="number"
                    step="0.1"
                    min={1}
                    value={String(draft.sticker_height_mm)}
                    onChange={(e) => setStickerHeight(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draft.lock_aspect}
                      onChange={(e) => setField('lock_aspect', e.target.checked)}
                      className="w-4 h-4 accent-accent"
                    />
                    <Link2 className="w-3.5 h-3.5" />
                    Lock aspect ratio
                    <span className="text-text-tertiary">(from the design image)</span>
                  </label>
                  <Button variant="secondary" size="sm" onClick={applyAutoFit} disabled={!draftLayout}>
                    <Wand2 className="w-3.5 h-3.5" />
                    Auto-fit
                  </Button>
                  <span className="text-[11px] text-text-tertiary">
                    {Number(draft.columns) * Number(draft.rows)} stickers / page
                  </span>
                </div>
              </section>

              {/* Page & image fit */}
              <section className="space-y-3">
                <h2 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <Layout className="w-3.5 h-3.5" /> Page &amp; image fit
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                    Orientation
                    <select
                      value={draft.orientation}
                      onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                      className="w-full bg-bg-input border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                    >
                      <option value="portrait">Portrait (210 × 297)</option>
                      <option value="landscape">Landscape (297 × 210)</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                    Image fit
                    <select
                      value={draft.fit_mode}
                      onChange={(e) => setField('fit_mode', e.target.value as StickerTemplatePatch['fit_mode'])}
                      className="w-full bg-bg-input border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                    >
                      <option value="exact">Exact fit (no crop)</option>
                      <option value="contain">Contain (letterbox)</option>
                      <option value="cover">Cover (crops)</option>
                    </select>
                  </label>
                  {numField('Bleed (mm)', 'bleed_mm', '0.5', 'Clipped so it never reaches a neighbour')}
                </div>
              </section>

              {/* Page geometry */}
              <section className="space-y-3">
                <h2 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5" /> Margins (mm)
                </h2>
                <label className="flex items-center gap-3 text-xs text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.auto_center}
                    onChange={(e) => setField('auto_center', e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  <span>
                    Auto-centre grid
                    <span className="text-text-tertiary">
                      {' '}
                      left/right = (page − columns×width − gaps) ÷ 2, ditto top/bottom.
                    </span>
                  </span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {numField('Horizontal gap', 'gap_x_mm')}
                  {numField('Vertical gap', 'gap_y_mm')}
                  {!draft.auto_center && numField('Margin top', 'margin_top_mm')}
                  {!draft.auto_center && numField('Margin right', 'margin_right_mm')}
                  {!draft.auto_center && numField('Margin bottom', 'margin_bottom_mm')}
                  {!draft.auto_center && numField('Margin left', 'margin_left_mm')}
                  {numField('Inner padding', 'inner_padding_mm', '0.1', 'Text safe area, separate from margins')}
                </div>
                {draft.auto_center && draftLayout && (
                  <p className="text-[11px] text-text-tertiary font-mono">
                    Centred margins: top {draftLayout.margins.top.toFixed(1)} · right{' '}
                    {draftLayout.margins.right.toFixed(1)} · bottom {draftLayout.margins.bottom.toFixed(1)} · left{' '}
                    {draftLayout.margins.left.toFixed(1)} mm
                  </p>
                )}
              </section>

              {/* Legacy font sizes (used only for the image-less fallback layout) */}
              <section className="space-y-3">
                <h2 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <Type className="w-3.5 h-3.5" /> Fallback font sizes (pt)
                </h2>
                <p className="text-[11px] text-text-tertiary">
                  Only used when a sticker has no design image and no custom design.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {numField('Business name', 'business_font_size', '0.5')}
                  {numField('Ticket number', 'ticket_font_size', '0.5')}
                  {numField('Table label', 'table_font_size', '0.5')}
                </div>
              </section>

              {/* Cut marks */}
              <section className="space-y-3">
                <h2 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5" /> Cut marks
                </h2>
                <label className="flex items-center gap-3 text-xs text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.cut_lines}
                    onChange={(e) => setField('cut_lines', e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  <span>
                    Draw light-grey crop marks at the grid edges and between rows/columns.
                    <span className="text-text-tertiary"> ON for plain paper, OFF for pre-cut label sheets.</span>
                  </span>
                </label>
              </section>
            </div>

            {/* Live page preview (sticky beside the form) */}
            <div className="xl:col-span-1 xl:sticky xl:top-4 space-y-4">
              <StickerPagePreview
                settings={layoutSettingsFromTemplate(draft)}
                design={normalizeDesign(draft.design)}
                imageUrl={imageUrl}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
