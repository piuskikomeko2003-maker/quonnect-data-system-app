'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRegion } from '@/context/RegionContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Sticker as StickerIcon,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  FileDown,
  History,
  Store,
} from 'lucide-react';
import type { StickerTemplate, StickerVendor } from '@/types/sticker';
import type { StickerProgress } from '@/lib/stickers/layout';
import { computeProgress, selectBatch } from '@/lib/stickers/layout';
import { fetchEditionDays, dayLabel, dayDateLabel, type EditionDay } from '@/lib/editionDays';
import { createClient } from '@/lib/supabase/client';

interface BatchRow {
  id: string;
  kind: 'print' | 'reprint';
  sticker_count: number;
  created_at: string;
  confirmed_at: string | null;
}

const formatTicket = (ticket: number | null) =>
  ticket == null ? '—' : String(ticket).padStart(3, '0');

const StickersView: React.FC<{ canPrint: boolean }> = ({ canPrint }) => {
  const { activeEdition } = useRegion();
  const marketDayId = activeEdition?.id || '';

  const [editionDays, setEditionDays] = useState<EditionDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [vendors, setVendors] = useState<StickerVendor[]>([]);
  const [progress, setProgress] = useState<StickerProgress | null>(null);
  const [templates, setTemplates] = useState<StickerTemplate[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'count' | 'all'>('count');
  const [count, setCount] = useState('30');
  const [startPosition, setStartPosition] = useState('1');

  const [generating, setGenerating] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<BatchRow | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Reprint
  const [search, setSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [reprinting, setReprinting] = useState(false);

  // Edition design wins; the globally active preset is the fallback.
  const activeTemplate = useMemo(() => {
    if (templates.length === 0) return null;
    const dayTemplate = selectedDayId
      ? templates.find((t) => t.edition_day_id === selectedDayId)
      : null;
    const editionTemplate = marketDayId
      ? templates.find((t) => t.edition_id === marketDayId && !t.edition_day_id)
      : null;
    return (
      dayTemplate ||
      editionTemplate ||
      templates.find((t) => !t.edition_id && t.is_active) ||
      templates.find((t) => !t.edition_id) ||
      templates[0]
    );
  }, [templates, marketDayId, selectedDayId]);
  const slotsPerPage = activeTemplate ? Math.max(1, activeTemplate.columns * activeTemplate.rows) : 30;

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    if (!supabase || !marketDayId) {
      setEditionDays([]);
      setSelectedDayId('');
      return;
    }
    fetchEditionDays(supabase, marketDayId).then((days) => {
      if (cancelled) return;
      setEditionDays(days);
      setSelectedDayId((prev) => {
        // One-day editions keep the legacy edition-wide flow (and its batch
        // history). Only multi-day editions opt into per-day printing.
        if (days.length <= 1) return '';
        if (prev && days.some((d) => d.id === prev)) return prev;
        return days[0].id;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [marketDayId]);

  const load = useCallback(async () => {
    if (!marketDayId) {
      setVendors([]);
      setProgress(null);
      setBatches([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dayQuery = selectedDayId ? `&edition_day_id=${selectedDayId}` : '';
      const [vendorsRes, templatesRes, batchesRes] = await Promise.all([
        fetch(`/api/stickers/vendors?market_day_id=${marketDayId}${dayQuery}`, { cache: 'no-store' }),
        fetch(
          `/api/stickers/templates${marketDayId ? `?edition_id=${marketDayId}${dayQuery}` : ''}`,
          { cache: 'no-store' }
        ),
        fetch(`/api/stickers/batches?market_day_id=${marketDayId}${dayQuery}`, { cache: 'no-store' }),
      ]);

      const vendorsData = await vendorsRes.json().catch(() => ({}));
      if (!vendorsRes.ok) throw new Error(vendorsData?.error || 'Failed to load vendors');
      setVendors(vendorsData.vendors || []);
      setProgress(vendorsData.progress || computeProgress(vendorsData.vendors || []));

      const templatesData = await templatesRes.json().catch(() => ({}));
      if (templatesRes.ok) setTemplates(templatesData.templates || []);

      const batchesData = await batchesRes.json().catch(() => ({}));
      if (batchesRes.ok) setBatches(batchesData.batches || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sticker data');
    } finally {
      setLoading(false);
    }
  }, [marketDayId, selectedDayId]);

  useEffect(() => {
    load();
  }, [load]);

  const preview = useMemo(() => {
    const parsedCount = Number(count);
    return selectBatch(vendors, slotsPerPage, {
      mode: mode === 'all' ? 'all' : 'count',
      count: Number.isFinite(parsedCount) ? parsedCount : 0,
      startPosition: Number(startPosition) || 1,
    });
  }, [vendors, slotsPerPage, mode, count, startPosition]);

  const generate = async () => {
    if (!marketDayId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/stickers/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_day_id: marketDayId,
          edition_day_id: selectedDayId || null,
          mode: mode === 'all' ? 'all' : 'count',
          count: mode === 'count' ? Number(count) : undefined,
          start_position: Number(startPosition) || 1,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to generate batch');
      setPendingBatch(data.batch);
      setBatches((prev) => [data.batch, ...prev]);
      window.open(`/api/stickers/batches/pdf?batch_id=${data.batch.id}`, '_blank');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate batch');
    } finally {
      setGenerating(false);
    }
  };

  const confirmBatch = async (batchId: string) => {
    setConfirmingId(batchId);
    setError(null);
    try {
      const res = await fetch('/api/stickers/batches/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to confirm batch');
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, confirmed_at: new Date().toISOString() } : b))
      );
      setPendingBatch((prev) => (prev && prev.id === batchId ? null : prev));
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm batch');
    } finally {
      setConfirmingId(null);
    }
  };

  const openBatchPdf = (batchId: string) => {
    window.open(`/api/stickers/batches/pdf?batch_id=${batchId}`, '_blank');
  };

  const searchMatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return vendors
      .filter((v) =>
        `${v.business_name} ${formatTicket(v.ticket_number)}`.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [search, vendors]);

  const reprintVendor = useMemo(
    () => vendors.find((v) => v.registration_id === selectedVendorId) || null,
    [vendors, selectedVendorId]
  );

  const selectReprintVendor = (vendor: StickerVendor) => {
    setSelectedVendorId(vendor.registration_id);
    setSelectedTables([]);
    setSearch('');
  };

  const toggleTable = (table: number) => {
    setSelectedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table].sort((a, b) => a - b)
    );
  };

  const generateReprint = async () => {
    if (!reprintVendor || selectedTables.length === 0) return;
    setReprinting(true);
    setError(null);
    try {
      const res = await fetch('/api/stickers/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'reprint',
          registration_id: reprintVendor.registration_id,
          ticket_id: reprintVendor.ticket_id || null,
          edition_day_id: reprintVendor.edition_day_id || selectedDayId || null,
          table_numbers: selectedTables,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to generate reprint');
      setBatches((prev) => [data.batch, ...prev]);
      window.open(`/api/stickers/batches/pdf?batch_id=${data.batch.id}`, '_blank');
      setSelectedTables([]);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate reprint');
    } finally {
      setReprinting(false);
    }
  };

  if (!canPrint) {
    return (
      <div className="py-20 text-center border border-dashed border-border rounded-lg animate-fade-in">
        <AlertCircle className="w-10 h-10 text-red mx-auto mb-3" />
        <h3 className="text-sm font-bold text-text-primary">Admin access required</h3>
        <p className="text-xs text-text-secondary mt-2">You do not have permission to print stickers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-left animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-accent rounded-full" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
              <StickerIcon className="w-5 h-5 text-accent" />
              Sticker Printing
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Print at 100% / Actual size, not “Fit to page”.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {!activeEdition?.id && (
        <div className="p-3 rounded-md border border-amber/40 bg-amber-muted/20 text-xs text-text-secondary flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber" />
          Select an event edition in the sidebar to print stickers.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md border border-red/40 bg-red-muted/20 text-xs text-red flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total needed', value: progress.totalNeeded },
            { label: 'Printed', value: progress.printed },
            { label: 'Remaining', value: progress.remaining },
          ].map((chip) => (
            <div key={chip.label} className="bg-white border border-border rounded-xl p-4">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{chip.label}</p>
              <p className="text-2xl font-black text-text-primary mt-1">{chip.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Generate batch */}
        <section className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Printer className="w-4 h-4 text-accent" /> Generate a print batch
          </h2>

          {editionDays.length > 1 && (
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Market day
              <select
                value={selectedDayId}
                onChange={(e) => {
                  setSelectedDayId(e.target.value);
                  setSelectedVendorId('');
                  setSelectedTables([]);
                }}
                className="bg-bg-input border border-border rounded-md px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent"
              >
                {editionDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    {dayLabel(day)} · {dayDateLabel(day)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('count')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md border cursor-pointer ${
                mode === 'count' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary'
              }`}
            >
              Fixed count
            </button>
            <button
              onClick={() => setMode('all')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md border cursor-pointer ${
                mode === 'all' ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary'
              }`}
            >
              All remaining
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Stickers in this PDF"
              type="number"
              min={1}
              value={mode === 'all' ? '' : count}
              disabled={mode === 'all'}
              onChange={(e) => setCount(e.target.value)}
              helperText={mode === 'all' ? 'All unprinted stickers' : undefined}
            />
            <Input
              label="Start at position"
              type="number"
              min={1}
              value={startPosition}
              onChange={(e) => setStartPosition(e.target.value)}
              helperText="Slots before this stay blank"
            />
          </div>

          <div className="rounded-lg bg-bg-elevated border border-border p-3 text-xs text-text-secondary space-y-1">
            <p className="font-semibold text-text-primary">
              {preview.stickerCount} stickers · {preview.pages} page{preview.pages === 1 ? '' : 's'} ·{' '}
              {preview.emptySlots} empty slots
            </p>
            <p className="text-text-tertiary">
              {preview.items.length} vendor{preview.items.length === 1 ? '' : 's'} · {slotsPerPage} slots/page
            </p>
            {activeTemplate && (
              <p className="text-text-tertiary">
                Design: <span className="font-semibold text-text-secondary">{activeTemplate.preset_name}</span>{' '}
                {activeTemplate.edition_day_id === selectedDayId && selectedDayId
                  ? '(this day)'
                  : activeTemplate.edition_id === marketDayId
                  ? '(this edition)'
                  : '(global default)'}
              </p>
            )}
          </div>

          <Button
            variant="primary"
            onClick={generate}
            disabled={generating || preview.stickerCount === 0 || !marketDayId}
            fullWidth
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Generate PDF
          </Button>

          {pendingBatch && (
            <div className="rounded-lg border border-accent/40 bg-accent-soft/30 p-3 space-y-2">
              <p className="text-[11px] text-text-secondary">
                Batch generated (not yet marked printed). After printing, confirm it:
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openBatchPdf(pendingBatch.id)}>
                  <FileDown className="w-3.5 h-3.5" /> Reopen PDF
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => confirmBatch(pendingBatch.id)}
                  disabled={confirmingId === pendingBatch.id}
                >
                  {confirmingId === pendingBatch.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Confirm printed
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Reprint */}
        <section className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Store className="w-4 h-4 text-accent" /> Reprint a single sticker
          </h2>
          <p className="text-[11px] text-text-tertiary">
            Reprinting never changes printed counts.
          </p>

          <Input
            label="Find vendor"
            placeholder="Business name or ticket number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {searchMatches.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
              {searchMatches.map((v) => (
                <button
                  key={v.registration_id}
                  onClick={() => selectReprintVendor(v)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold text-text-primary truncate">{v.business_name}</span>
                  <span className="text-text-tertiary font-mono">#{formatTicket(v.ticket_number)}</span>
                </button>
              ))}
            </div>
          )}

          {reprintVendor && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-primary">
                {reprintVendor.business_name}{' '}
                <span className="text-text-tertiary font-mono">#{formatTicket(reprintVendor.ticket_number)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.max(1, reprintVendor.tables) }, (_, i) => i + 1).map((table) => (
                  <button
                    key={table}
                    onClick={() => toggleTable(table)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-md border cursor-pointer ${
                      selectedTables.includes(table)
                        ? 'bg-accent text-white border-accent'
                        : 'border-border text-text-secondary'
                    }`}
                  >
                    Table {table}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                onClick={generateReprint}
                disabled={reprinting || selectedTables.length === 0}
                fullWidth
              >
                {reprinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Generate reprint PDF
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Recent batches */}
      <section className="bg-white border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-accent" /> Recent batches
        </h2>
        {batches.length === 0 ? (
          <p className="text-xs text-text-tertiary">No batches generated yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {batches.map((b) => (
              <div key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-text-primary">
                    <Badge variant={b.kind === 'reprint' ? 'warning' : 'info'} size="sm">
                      {b.kind}
                    </Badge>
                    <span className="font-semibold">{b.sticker_count} stickers</span>
                    {b.confirmed_at ? (
                      <Badge variant="success" size="sm">Confirmed</Badge>
                    ) : (
                      <Badge variant="danger" size="sm">Awaiting confirmation</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    {new Date(b.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => openBatchPdf(b.id)}>
                    <FileDown className="w-3.5 h-3.5" /> PDF
                  </Button>
                  {!b.confirmed_at && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => confirmBatch(b.id)}
                      disabled={confirmingId === b.id}
                    >
                      {confirmingId === b.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Confirm
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default StickersView;
