'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import {
  Footprints,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info,
  Calendar,
  MapPin,
  TrendingUp
} from 'lucide-react';

interface EditionEstimateItem {
  id: string;
  name: string;
  editionName: string;
  regionName: string;
  eventDate: string;
  month: string;
  estimatedTotal: number | null;
  loggedCount: number;
}

export const WalkinEstimateSettings: React.FC = () => {
  const { userId } = useAuth();
  const [items, setItems] = useState<EditionEstimateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchEstimates = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) return;

      const [mdRes, estRes, walkRes] = await Promise.all([
        supabase
          .from('market_days')
          .select(`
            id,
            name,
            edition,
            event_date,
            status,
            regions ( id, name )
          `)
          .order('event_date', { ascending: false }),
        supabase.from('walkin_estimates').select('market_day_id, month, estimated_total'),
        supabase.from('walkins').select('market_day_id'),
      ]);

      if (mdRes.error) throw mdRes.error;

      const estimateMap: Record<string, { estimatedTotal: number; month: string | null }> = {};
      (estRes.data || []).forEach((e: any) => {
        estimateMap[e.market_day_id] = { estimatedTotal: e.estimated_total, month: e.month ?? null };
      });

      const loggedMap: Record<string, number> = {};
      (walkRes.data || []).forEach((w: any) => {
        if (w.market_day_id) loggedMap[w.market_day_id] = (loggedMap[w.market_day_id] || 0) + 1;
      });

      const rows: EditionEstimateItem[] = (mdRes.data || []).map((m: any) => {
        const est = estimateMap[m.id];
        return {
          id: m.id,
          name: m.name || 'Untitled Market',
          editionName: m.edition || m.name || 'Untitled Edition',
          regionName: m.regions?.name || 'Uganda',
          eventDate: m.event_date || '',
          month: est?.month || '',
          estimatedTotal: est ? est.estimatedTotal : null,
          loggedCount: loggedMap[m.id] || 0,
        };
      });

      setItems(rows);

      const initialInputs: Record<string, string> = {};
      rows.forEach((r) => {
        initialInputs[r.id] = r.estimatedTotal !== null ? r.estimatedTotal.toLocaleString('en-US') : '';
      });
      setInputs(initialInputs);
    } catch (err: any) {
      console.error('Error loading walk-in estimates:', err);
      addToast(err.message || 'Failed to load walk-in estimates', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  const handleInputChange = (editionId: string, val: string) => {
    const cleanNum = val.replace(/[^0-9]/g, '');
    const num = cleanNum ? parseInt(cleanNum, 10) : 0;
    setInputs((prev) => ({
      ...prev,
      [editionId]: cleanNum ? num.toLocaleString('en-US') : ''
    }));
  };

  const handleSave = async (item: EditionEstimateItem) => {
    const raw = inputs[item.id] ?? '';
    const numericTotal = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;

    if (numericTotal <= 0) {
      addToast('Enter a valid estimated total greater than zero.', 'error');
      return;
    }

    setSavingId(item.id);
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data: existing } = await supabase
        .from('walkin_estimates')
        .select('id')
        .eq('market_day_id', item.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('walkin_estimates')
          .update({ estimated_total: numericTotal, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('walkin_estimates')
          .insert({
            market_day_id: item.id,
            estimated_total: numericTotal,
            created_by: userId || null,
          });
      }

      addToast(`Saved ${item.editionName} walk-in estimate: ${numericTotal.toLocaleString()}+`, 'success');
      await fetchEstimates();
    } catch (err: any) {
      console.error('Error saving walk-in estimate:', err);
      addToast(err.message || 'Failed to save walk-in estimate', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`p-4 rounded-xl border shadow-xl flex items-start gap-3 backdrop-blur-md text-xs font-medium animate-slide-up ${
                t.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                  : t.type === 'error'
                  ? 'bg-red-950/90 border-red-500/30 text-red-200'
                  : 'bg-blue-950/90 border-blue-500/30 text-blue-200'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-relaxed">{t.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Footprints className="w-5 h-5 text-emerald-400" />
            Walk-in Attendance Estimates
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Set the official estimated total attendance per edition. This drives the dashboard headline number.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchEstimates}
          disabled={loading}
          className="self-start sm:self-auto gap-2 border-white/10 hover:bg-white/5 text-gray-300"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3.5">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-300 leading-relaxed">
          <strong className="text-emerald-200 font-semibold block mb-0.5">
            Estimated total vs. logged profiles
          </strong>
          The estimate is the official reported attendance figure used for funding reports and the dashboard headline.
          Individually-logged walk-in profiles remain a separate, smaller dataset shown alongside it — never added on top of the estimate.
        </div>
      </div>

      {/* Editions List Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading walk-in estimates...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/10 rounded-xl">
          <TrendingUp className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-300">No market editions found</p>
          <p className="text-xs text-gray-500 mt-1">Create an edition in Markets & Editions to set its walk-in estimate.</p>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-gray-400">
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider">Market & Edition</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider">Region & Date</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider text-center">Profiles Logged</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider w-[220px]">Estimated Total</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider text-right w-[140px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => {
                  const isSaving = savingId === item.id;
                  const currentInput = inputs[item.id] ?? '';

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-white text-sm">{item.editionName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{item.name}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {item.regionName}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 text-[11px] mt-1">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          {item.eventDate ? new Date(item.eventDate).toLocaleDateString() : 'No date set'}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/5 rounded-lg text-gray-300 font-mono text-[11px]">
                          <Footprints className="w-3 h-3 text-gray-400" />
                          <span className="font-bold text-white">{item.loggedCount}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={currentInput}
                            onChange={(e) => handleInputChange(item.id, e.target.value)}
                            placeholder="e.g. 5000"
                            className="w-full pl-3 pr-10 py-2 bg-black/40 border border-white/10 rounded-lg text-sm font-mono text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                          />
                          <span className="absolute right-3 text-[11px] font-bold text-emerald-400/90 select-none">+</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSave(item)}
                          disabled={isSaving}
                          className="w-full justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium border-0 shadow-lg shadow-emerald-950/40"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Save
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
