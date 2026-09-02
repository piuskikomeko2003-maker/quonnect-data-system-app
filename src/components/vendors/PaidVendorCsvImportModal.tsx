'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ animation: 'fadeInScale 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">CSV Import — Paid Vendor List</h2>
              <p className="text-[11px] text-gray-400">
                {activeEdition ? `Importing to: ${activeEdition.name}` : 'No edition selected'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-3 shrink-0">
          {(['upload', 'preview', 'importing', 'done'] as Step[]).map((s, idx) => {
            const stepNum = idx + 1;
            const currentIdx = ['upload', 'preview', 'importing', 'done'].indexOf(step);
            const isActive = step === s;
            const isDone = currentIdx > idx;
            const labels = ['Upload', 'Review', 'Import', 'Done'];
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                    isDone ? 'bg-green-500 text-white' :
                    isActive ? 'bg-green-500/20 border border-green-500 text-green-400' :
                    'bg-white/5 border border-white/10 text-gray-500'
                  }`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase ${
                    isActive ? 'text-white' : isDone ? 'text-green-400' : 'text-gray-500'
                  }`}>{labels[idx]}</span>
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-px mx-2 ${isDone ? 'bg-green-500/40' : 'bg-white/5'}`} />
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
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-amber-400 text-xs font-medium">
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
                    ? 'border-green-500 bg-green-500/5'
                    : file
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
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
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">Drop your CSV file here</p>
                      <p className="text-xs text-gray-400 mt-0.5">or click to browse — .csv only</p>
                    </div>
                  </>
                )}
              </div>

              {/* Column requirements info */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">CSV Format</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Your CSV can have any of these columns (only a <strong className="text-white">name column</strong> is required):
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
                      <span className="text-[10px] font-bold text-white">{col.label}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{col.hint}</span>
                    </div>
                  ))}
                </div>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}

              <button
                disabled={!file || !activeEdition || loadingPreview}
                onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold px-4 py-3 rounded-xl transition-colors"
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
                <SummaryChip icon="✓" count={newCount} label="New" colorClass="text-green-400 bg-green-500/10 border-green-500/20" />
                {likelyDupCount > 0 && (
                  <SummaryChip icon="~" count={likelyDupCount} label="Near-match" colorClass="text-amber-400 bg-amber-500/10 border-amber-500/20" />
                )}
                {exactDupCount > 0 && (
                  <SummaryChip icon="✕" count={exactDupCount} label="Exact duplicate" colorClass="text-red-400 bg-red-500/10 border-red-500/20" />
                )}
              </div>

              {likelyDupCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-amber-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{likelyDupCount} near-match{likelyDupCount !== 1 ? 'es' : ''}</strong> detected.
                    Review below — toggle &quot;Import Anyway&quot; to include them, or leave unchecked to skip.
                  </span>
                </div>
              )}

              {/* Rows table */}
              <div className="border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-y-auto max-h-[340px]">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#0d1117] border-b border-white/5">
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left">Name</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left hidden sm:table-cell">Phone</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left hidden sm:table-cell">Business</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left">Matched With</th>
                        <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Import</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {preview.map(row => (
                        <tr key={row.rowIndex} className={`transition-colors ${
                          row.status === 'exact_duplicate' && !row.importAnyway ? 'opacity-40' : ''
                        }`}>
                          <td className="p-3 font-semibold text-white max-w-[140px] truncate">
                            {row.businessName || row.contactName}
                          </td>
                          <td className="p-3 text-gray-400 font-mono text-[11px] hidden sm:table-cell">
                            {row.phone || <span className="text-gray-600 italic">—</span>}
                          </td>
                          <td className="p-3 text-gray-300 hidden sm:table-cell max-w-[120px] truncate">
                            {row.businessName || <span className="text-gray-600 italic">—</span>}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusColor[row.status]}`}>
                              {statusLabel[row.status]}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-gray-400 max-w-[140px] truncate">
                            {row.matchedName ? (
                              <span className="flex items-center gap-1">
                                <span className="text-amber-400 font-mono">{Math.round((row.similarity || 0) * 100)}%</span>
                                <span className="truncate">{row.matchedName}</span>
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="p-3 text-center">
                            {row.status === 'new' ? (
                              <span className="text-green-400 text-[11px] font-bold">✓</span>
                            ) : row.status === 'exact_duplicate' ? (
                              <span className="text-gray-600 text-[11px]">—</span>
                            ) : (
                              <button
                                onClick={() => toggleImportAnyway(row.rowIndex)}
                                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors ${
                                  row.importAnyway
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                    : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
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
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors font-medium"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <div className="text-xs text-gray-400">
                  <strong className="text-white">{willImportCount}</strong> vendor{willImportCount !== 1 ? 's' : ''} will be imported
                </div>
                <button
                  disabled={willImportCount === 0}
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
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
                <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">
                  Importing {importProgress.current} of {importProgress.total} vendors...
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-center text-gray-400">{progressPct}%</p>

              {/* Live log */}
              <div
                ref={logRef}
                className="bg-black/30 border border-white/5 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[11px] text-gray-400 space-y-1"
              >
                {importLog.map((line, i) => (
                  <div key={i} className={`${line.startsWith('✅') ? 'text-green-400' : line.startsWith('⚠️') ? 'text-amber-400' : line.startsWith('❌') ? 'text-red-400' : ''}`}>
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
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Import Complete!</h3>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Import Finished with Warnings</h3>
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
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Imported to</span>
                  <span className="text-white font-semibold">{activeEdition?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Timestamp</span>
                  <span className="text-white font-mono">{new Date(summary.importedAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Batch ID</span>
                  <span className="text-white font-mono text-[10px]">{summary.batchId.slice(0, 16)}...</span>
                </div>
              </div>

              {/* Errors list */}
              {summary.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Import Errors</p>
                  {summary.errors.map((e, i) => (
                    <p key={i} className="text-[11px] text-red-300 font-mono mb-1">{e}</p>
                  ))}
                </div>
              )}

              {/* Incomplete vendor note */}
              {preview.some(r => r.isMinimal && (r.status === 'new' || (r.status === 'likely_duplicate' && r.importAnyway))) && (
                <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-blue-400 text-xs">
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
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onClose();
                    // Parent will handle navigation to incomplete vendors tab
                    window.dispatchEvent(new CustomEvent('open-incomplete-vendors'));
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
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
    color === 'green' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
    color === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
    color === 'purple' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
    'bg-white/5 text-gray-400 border-white/10'
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
    color === 'green' ? 'bg-green-500/10 border-green-500/20' :
    color === 'amber' ? 'bg-amber-500/10 border-amber-500/20' :
    'bg-white/5 border-white/5'
  }`}>
    <div className={`text-2xl font-bold ${
      color === 'green' ? 'text-green-400' :
      color === 'amber' ? 'text-amber-400' :
      'text-white'
    }`}>{value}</div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">{label}</div>
  </div>
);
