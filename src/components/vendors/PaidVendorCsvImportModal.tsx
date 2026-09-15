'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { createClient } from '@/lib/supabase/client';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Users,
  SkipForward,
  Download,
  Info,
} from 'lucide-react';
import {
  parseCsvText,
  detectColumns,
  extractVendorRows,
  fetchExistingVendors,
  buildPreview,
  importPaidVendors,
  logImportBatch,
  type RowPreview,
  type ColumnMap,
  type ImportSummary,
} from '@/utils/paidVendorCsvImport';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'importing' | 'done';

export interface PaidVendorCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEdition: { id: string; name: string } | null;
  importedBy: string | null;
  onImportComplete: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColor = {
  new: 'bg-green-500/10 text-green-400 border border-green-500/20',
  likely_duplicate: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  exact_duplicate: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const statusLabel = {
  new: '✓ New',
  likely_duplicate: '~ Near-match',
  exact_duplicate: '✕ Duplicate',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const PaidVendorCsvImportModal: React.FC<PaidVendorCsvImportModalProps> = ({
  isOpen,
  onClose,
  activeEdition,
  importedBy,
  onImportComplete,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [colMap, setColMap] = useState<ColumnMap>({});
  const [preview, setPreview] = useState<RowPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importLog, setImportLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('upload');
        setFile(null);
        setParseError(null);
        setColMap({});
        setPreview([]);
        setImportProgress({ current: 0, total: 0 });
        setImportLog([]);
        setSummary(null);
      }, 300);
    }
  }, [isOpen]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [importLog]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setParseError('Only .csv files are accepted.');
      return;
    }
    setFile(f);
    setParseError(null);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ── Step 1 → Step 2: Parse & Preview ──────────────────────────────────────

  const handleAnalyze = async () => {
    if (!file || !activeEdition) return;
    setLoadingPreview(true);
    setParseError(null);

    try {
      const text = await file.text();
      const rawRows = parseCsvText(text);

      if (rawRows.length === 0) {
        setParseError('The CSV file appears to be empty or has no data rows.');
        setLoadingPreview(false);
        return;
      }

      const headers = Object.keys(rawRows[0] || {});
      const detected = detectColumns(headers);
      setColMap(detected);

      if (!detected.nameHeader && !detected.businessHeader) {
        setParseError(
          'Could not find a name column. Please ensure your CSV has a column named "name", "contact_name", "full_name", or "business_name".'
        );
        setLoadingPreview(false);
        return;
      }

      const parsedRows = extractVendorRows(rawRows, detected);

      if (parsedRows.length === 0) {
        setParseError('No valid rows found. Each row must have at least a name or business name.');
        setLoadingPreview(false);
        return;
      }

      // Fetch existing vendors for dedup
      const supabase = createClient();
      const existingVendors = supabase ? await fetchExistingVendors(supabase) : [];
      const previewRows = buildPreview(parsedRows, existingVendors);

      setPreview(previewRows);
      setStep('preview');
    } catch (err: any) {
      setParseError(`Failed to parse CSV: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Toggle "Import Anyway" on a duplicate row ─────────────────────────────

  const toggleImportAnyway = (rowIndex: number) => {
    setPreview(prev =>
      prev.map(r =>
        r.rowIndex === rowIndex ? { ...r, importAnyway: !r.importAnyway } : r
      )
    );
  };

  // ── Step 2 → Step 3 → Step 4: Import ─────────────────────────────────────

  const handleConfirmImport = async () => {
    if (!activeEdition) return;
    const supabase = createClient();
    if (!supabase) return;

    setStep('importing');
    setImportLog([]);
    setImportProgress({ current: 0, total: preview.filter(r => r.status === 'new' || (r.status === 'likely_duplicate' && r.importAnyway)).length });

    const addLog = (msg: string) => setImportLog(prev => [...prev, msg]);

    addLog(`🚀 Starting import into "${activeEdition.name}"...`);

    try {
      const result = await importPaidVendors(
        preview,
        activeEdition,
        supabase,
        (current, total) => {
          setImportProgress({ current, total });
          addLog(`Processing row ${current} of ${total}...`);
        }
      );

      if (result.errors.length > 0) {
        result.errors.forEach(e => addLog(`⚠️ ${e}`));
      }

      addLog(`✅ Import complete: ${result.inserted} inserted, ${result.skipped} skipped.`);

      // Log the batch
      if (file) {
        await logImportBatch(result, activeEdition, importedBy, file.name, supabase);
        addLog(`📋 Import batch logged (ID: ${result.batchId.slice(0, 8)}...)`);
      }

      setSummary(result);
      setStep('done');
      onImportComplete();
    } catch (err: any) {
      addLog(`❌ Import failed: ${err?.message || 'Unknown error'}`);
      setSummary({
        inserted: 0,
        skipped: preview.length,
        errors: [err?.message || 'Unknown error'],
        batchId: '',
        importedAt: new Date().toISOString(),
      });
      setStep('done');
    }
  };

  // ── Counts ────────────────────────────────────────────────────────────────

  const newCount = preview.filter(r => r.status === 'new').length;
  const likelyDupCount = preview.filter(r => r.status === 'likely_duplicate').length;
  const exactDupCount = preview.filter(r => r.status === 'exact_duplicate').length;
  const willImportCount = preview.filter(r => r.status === 'new' || (r.status === 'likely_duplicate' && r.importAnyway)).length;
  const progressPct = importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0;

  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-white border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden outline-none"
        style={{ animation: 'fadeInScale 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 bg-accent-soft rounded-lg flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-text-primary truncate">CSV Import — Paid Vendors</h2>
              <p className="text-[10px] sm:text-[11px] text-text-secondary truncate">
                {activeEdition ? `Importing to: ${activeEdition.name}` : 'No edition selected'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-0 px-4 sm:px-6 pt-3.5 sm:pt-4 pb-2.5 sm:pb-3 shrink-0">
          {(['upload', 'preview', 'importing', 'done'] as Step[]).map((s, idx) => {
            const stepNum = idx + 1;
            const currentIdx = ['upload', 'preview', 'importing', 'done'].indexOf(step);
            const isActive = step === s;
            const isDone = currentIdx > idx;
            const labels = ['Upload', 'Review', 'Import', 'Done'];
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                    isDone ? 'bg-accent text-white' :
                    isActive ? 'bg-accent-soft border border-accent text-accent' :
                    'bg-slate-100 border border-border text-text-tertiary'
                  }`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase hidden sm:inline ${
                    isActive ? 'text-text-primary' : isDone ? 'text-accent' : 'text-text-tertiary'
                  }`}>{labels[idx]}</span>
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-px mx-1 sm:mx-2 ${isDone ? 'bg-accent/40' : 'bg-slate-100'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">

          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {!activeEdition && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-700 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  No edition selected. Please select an active market day edition before importing.
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-all ${
                  isDragging
                    ? 'border-accent bg-accent-soft/20'
                    : file
                    ? 'border-accent/40 bg-accent-soft/10'
                    : 'border-border hover:border-border-light hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleBrowse}
                />
                {file ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center">
                      <FileText className="w-6 h-6 text-accent" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">{file.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-text-secondary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-text-primary">Drop your CSV file here</p>
                      <p className="text-xs text-text-secondary mt-0.5">or click to browse — .csv only</p>
                    </div>
                  </>
                )}
              </div>

              {/* Column requirements info */}
              <div className="bg-slate-50/50 border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">CSV Format</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Your CSV can have any of these columns (only a <strong className="text-text-primary">name column</strong> is required):
                </p>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {[
                    { label: 'Name *', hint: 'name / contact_name / full_name' },
                    { label: 'Business Name', hint: 'business_name / business / company' },
                    { label: 'Phone', hint: 'phone / phone_number / mobile' },
                    { label: 'Email', hint: 'email / email_address' },
                    { label: 'Category', hint: 'category / business_type / sector' },
                    { label: 'Amount', hint: 'amount / amount_paid / payment / fee' },
                  ].map(col => (
                    <div key={col.label} className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-text-primary">{col.label}</span>
                      <span className="text-[10px] text-text-tertiary font-mono">{col.hint}</span>
                    </div>
                  ))}
                </div>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}

              <button
                disabled={!file || !activeEdition || loadingPreview}
                onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer"
              >
                {loadingPreview ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                ) : (
                  <>Analyze & Preview <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          )}

          {/* ── STEP 2: PREVIEW / DUPLICATE REVIEW ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Detected column summary */}
              <div className="flex flex-wrap gap-2">
                {colMap.nameHeader && <ColTag label="Name" value={colMap.nameHeader} color="green" />}
                {colMap.businessHeader && <ColTag label="Business" value={colMap.businessHeader} color="blue" />}
                {colMap.phoneHeader && <ColTag label="Phone" value={colMap.phoneHeader} color="purple" />}
                {colMap.emailHeader && <ColTag label="Email" value={colMap.emailHeader} color="gray" />}
                {colMap.categoryHeader && <ColTag label="Category" value={colMap.categoryHeader} color="gray" />}
                {colMap.amountHeader && <ColTag label="Amount" value={colMap.amountHeader} color="green" />}
              </div>

              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                <SummaryChip icon="✓" count={newCount} label="New" colorClass="text-emerald-700 bg-emerald-50 border-emerald-200" />
                {likelyDupCount > 0 && (
                  <SummaryChip icon="~" count={likelyDupCount} label="Near-match" colorClass="text-amber-700 bg-amber-50 border-amber-200" />
                )}
                {exactDupCount > 0 && (
                  <SummaryChip icon="✕" count={exactDupCount} label="Exact duplicate" colorClass="text-red-700 bg-red-50 border-red-200" />
                )}
              </div>

              {likelyDupCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{likelyDupCount} near-match{likelyDupCount !== 1 ? 'es' : ''}</strong> detected.
                    Review below — toggle &quot;Import Anyway&quot; to include them, or leave unchecked to skip.
                  </span>
                </div>
              )}

              {/* Rows table with horizontal scroll safety */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[340px]">
                  <table className="w-full border-collapse text-xs min-w-[500px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50/80 border-b border-border">
                        <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider text-left">Name</th>
                        <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider text-left hidden sm:table-cell">Phone</th>
                        <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider text-left hidden sm:table-cell">Business</th>
                        <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider text-center">Status</th>
                        <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider text-left">Matched With</th>
                        <th className="p-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider text-center">Import</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.map(row => (
                        <tr key={row.rowIndex} className={`transition-colors ${
                          row.status === 'exact_duplicate' && !row.importAnyway ? 'opacity-40' : ''
                        }`}>
                          <td className="p-3 font-semibold text-text-primary max-w-[140px] truncate">
                            {row.businessName || row.contactName}
                          </td>
                          <td className="p-3 text-text-tertiary font-mono text-[11px] hidden sm:table-cell">
                            {row.phone || <span className="text-text-tertiary italic">—</span>}
                          </td>
                          <td className="p-3 text-text-secondary hidden sm:table-cell max-w-[120px] truncate">
                            {row.businessName || <span className="text-text-tertiary italic">—</span>}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusColor[row.status]}`}>
                              {statusLabel[row.status]}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-text-secondary max-w-[140px] truncate">
                            {row.matchedName ? (
                              <span className="flex items-center gap-1">
                                <span className="text-amber-700 font-mono">{Math.round((row.similarity || 0) * 100)}%</span>
                                <span className="truncate">{row.matchedName}</span>
                              </span>
                            ) : <span className="text-text-tertiary">—</span>}
                          </td>
                          <td className="p-3 text-center">
                            {row.status === 'new' ? (
                              <span className="text-emerald-600 text-[11px] font-bold">✓</span>
                            ) : row.status === 'exact_duplicate' ? (
                              <span className="text-text-tertiary text-[11px]">—</span>
                            ) : (
                              <button
                                onClick={() => toggleImportAnyway(row.rowIndex)}
                                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                                  row.importAnyway
                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                    : 'bg-slate-100 border-border text-text-tertiary hover:text-text-primary'
                                }`}
                              >
                                {row.importAnyway ? 'Yes' : 'Skip'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={() => setStep('upload')}
                  className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <div className="text-xs text-text-secondary">
                  <strong className="text-text-primary">{willImportCount}</strong> vendor{willImportCount !== 1 ? 's' : ''} will be imported
                </div>
                <button
                  disabled={willImportCount === 0}
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Confirm Import <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: IMPORTING ── */}
          {step === 'importing' && (
            <div className="space-y-4 py-2">
              <div className="text-center mb-4">
                <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
                <p className="text-sm font-bold text-text-primary">
                  Importing {importProgress.current} of {importProgress.total} vendors...
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-center text-text-muted">{progressPct}%</p>

              {/* Live log */}
              <div
                ref={logRef}
                className="bg-slate-50 border border-border rounded-xl p-4 h-48 overflow-y-auto font-mono text-[11px] text-text-secondary space-y-1"
              >
                {importLog.map((line, i) => (
                  <div key={i} className={`${line.startsWith('✅') ? 'text-emerald-600' : line.startsWith('⚠️') ? 'text-amber-600' : line.startsWith('❌') ? 'text-red-600' : ''}`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 4: DONE ── */}
          {step === 'done' && summary && (
            <div className="space-y-4 py-2">
              {summary.errors.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary">Import Complete!</h3>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary">Import Finished with Warnings</h3>
                </div>
              )}

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  value={summary.inserted}
                  label="Imported"
                  color="green"
                />
                <StatCard
                  value={summary.skipped}
                  label="Skipped"
                  color="gray"
                />
                <StatCard
                  value={summary.errors.length}
                  label="Errors"
                  color={summary.errors.length > 0 ? 'amber' : 'gray'}
                />
              </div>

              {/* Batch info */}
              <div className="bg-slate-50 border border-border rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Imported to</span>
                  <span className="text-text-primary font-semibold">{activeEdition?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Timestamp</span>
                  <span className="text-text-primary font-mono">{new Date(summary.importedAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Batch ID</span>
                  <span className="text-text-primary font-mono text-[10px]">{summary.batchId.slice(0, 16)}...</span>
                </div>
              </div>

              {/* Errors list */}
              {summary.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2">Import Errors</p>
                  {summary.errors.map((e, i) => (
                    <p key={i} className="text-[11px] text-red-600 font-mono mb-1">{e}</p>
                  ))}
                </div>
              )}

              {/* Incomplete vendor note */}
              {preview.some(r => r.isMinimal && (r.status === 'new' || (r.status === 'likely_duplicate' && r.importAnyway))) && (
                <div className="flex items-start gap-2 bg-accent-soft border border-accent/20 rounded-xl px-4 py-3 text-accent text-xs">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Some vendors were imported with <strong>name only</strong> (no phone/email).
                    They&apos;re marked as <em>incomplete</em> — use the <strong>Incomplete Vendors</strong> tab to fill in their details.
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 border border-border text-text-primary text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onClose();
                    // Parent will handle navigation to incomplete vendors tab
                    window.dispatchEvent(new CustomEvent('open-incomplete-vendors'));
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4" /> View Incomplete Vendors
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const ColTag: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
    color === 'green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    color === 'blue' ? 'bg-accent-soft text-accent border-accent/20' :
    color === 'purple' ? 'bg-purple-50 text-purple-700 border-purple-200' :
    'bg-slate-50 text-text-secondary border-border'
  }`}>
    {label}: <span className="font-mono font-normal opacity-80">{value}</span>
  </span>
);

const SummaryChip: React.FC<{ icon: string; count: number; label: string; colorClass: string }> = ({ icon, count, label, colorClass }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${colorClass}`}>
    <span>{icon}</span>
    <span>{count} {label}{count !== 1 ? 's' : ''}</span>
  </span>
);

const StatCard: React.FC<{ value: number; label: string; color: 'green' | 'gray' | 'amber' }> = ({ value, label, color }) => (
  <div className={`rounded-xl border p-4 text-center ${
    color === 'green' ? 'bg-emerald-50 border-emerald-200' :
    color === 'amber' ? 'bg-amber-50 border-amber-200' :
    'bg-slate-50 border-border'
  }`}>
    <div className={`text-2xl font-bold ${
      color === 'green' ? 'text-emerald-700' :
      color === 'amber' ? 'text-amber-700' :
      'text-text-primary'
    }`}>{value}</div>
    <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">{label}</div>
  </div>
);
