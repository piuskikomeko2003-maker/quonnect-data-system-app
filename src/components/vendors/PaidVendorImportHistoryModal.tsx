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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
              <History className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">CSV Import History</h2>
              <p className="text-[11px] text-gray-400">Paid vendor list imports — delete an import to remove its vendors.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {notice && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green-400 text-xs mb-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {notice}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-xs mb-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-green-400 mx-auto mb-3" />
              <p className="text-xs text-gray-400 font-medium">Loading import history...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center select-none">
              <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-300 font-semibold">No CSV imports yet.</p>
              <p className="text-xs text-gray-500 mt-1">Imports will appear here once you upload a paid vendor list.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div
                  key={log.id}
                  className="border border-white/5 bg-white/[0.02] rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{log.filename || 'Unnamed file'}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(log.imported_at).toLocaleString()}
                        {log.imported_by ? ` • by ${log.imported_by}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        <span className="text-green-400 font-semibold">{log.rows_inserted}</span> inserted
                        {log.rows_skipped > 0 && (
                          <> · <span className="text-amber-400 font-semibold">{log.rows_skipped}</span> skipped</>
                        )}
                      </p>
                    </div>
                  </div>

                  {confirmId === log.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-red-400 font-semibold">Delete?</span>
                      <button
                        onClick={() => handleDelete(log)}
                        disabled={deletingId === log.id}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {deletingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={deletingId === log.id}
                        className="text-[11px] font-bold text-gray-400 hover:text-white px-2 py-1.5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(log.id)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors shrink-0"
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
        <div className="px-6 py-4 border-t border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
