'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deleteImportBatch } from '@/utils/paidVendorCsvImport';
import {
  X,
  History,
  Trash2,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportLogRow {
  id: string;
  import_batch: string;
  filename: string | null;
  imported_by: string | null;
  imported_at: string;
  rows_processed: number;
  rows_inserted: number;
  rows_skipped: number;
}

export interface PaidVendorImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful delete so the parent can refresh the paid vendor list. */
  onChanged: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PaidVendorImportHistoryModal: React.FC<PaidVendorImportHistoryModalProps> = ({
  isOpen,
  onClose,
  onChanged,
}) => {
  const [logs, setLogs] = useState<ImportLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data, error: dbErr } = await supabase
        .from('csv_import_log')
        .select(
          'id, import_batch, filename, imported_by, imported_at, rows_processed, rows_inserted, rows_skipped'
        )
        .eq('context_type', 'market_day')
        .order('imported_at', { ascending: false });

      if (dbErr) throw dbErr;
      setLogs((data || []) as ImportLogRow[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load import history');
      console.error('Import history fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setConfirmId(null);
      setNotice(null);
    }
  }, [isOpen, fetchHistory]);

  const handleDelete = async (log: ImportLogRow) => {
    setDeletingId(log.id);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const result = await deleteImportBatch(log.import_batch, supabase);

      // Remove the history log entry itself.
      await supabase.from('csv_import_log').delete().eq('id', log.id);

      setNotice(
        `Deleted ${result.deletedRegistrations} paid vendor record${result.deletedRegistrations !== 1 ? 's' : ''}` +
          (result.deletedVendors > 0
            ? ` and ${result.deletedVendors} vendor profile${result.deletedVendors !== 1 ? 's' : ''}`
            : '') +
          '.'
      );
      await fetchHistory();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete import');
      console.error('Delete import batch error:', err);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="relative bg-white border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-soft rounded-lg flex items-center justify-center">
              <History className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">CSV Import History</h2>
              <p className="text-[11px] text-text-secondary">Paid vendor list imports — delete an import to remove its vendors.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {notice && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-xs mb-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {notice}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-xs mb-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
              <p className="text-xs text-text-secondary font-medium">Loading import history...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center select-none">
              <History className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-primary font-semibold">No CSV imports yet.</p>
              <p className="text-xs text-text-secondary mt-1">Imports will appear here once you upload a paid vendor list.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div
                  key={log.id}
                  className="border border-border bg-white rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{log.filename || 'Unnamed file'}</p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">
                        {new Date(log.imported_at).toLocaleString()}
                        {log.imported_by ? ` • by ${log.imported_by}` : ''}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        <span className="text-emerald-600 font-semibold">{log.rows_inserted}</span> inserted
                        {log.rows_skipped > 0 && (
                          <> · <span className="text-amber-600 font-semibold">{log.rows_skipped}</span> skipped</>
                        )}
                      </p>
                    </div>
                  </div>

                  {confirmId === log.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-red-700 font-semibold">Delete?</span>
                      <button
                        onClick={() => handleDelete(log)}
                        disabled={deletingId === log.id}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {deletingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={deletingId === log.id}
                        className="text-[11px] font-bold text-text-secondary hover:text-text-primary px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(log.id)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 border border-border text-text-primary text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
