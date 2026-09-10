'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isTestEdition } from '@/lib/editions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Search,
  Sparkles,
  Info,
  Calendar,
  MapPin,
  Users
} from 'lucide-react';

interface EditionFeeItem {
  id: string;
  name: string;
  editionName: string;
  regionId: string;
  regionName: string;
  eventDate: string;
  standardFee: number;
  totalVendors: number;
  standardVendorsCount: number;
  overrideVendorsCount: number;
  status: string;
}

export const StandardFeeSettings: React.FC = () => {
  const [editions, setEditions] = useState<EditionFeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchEditionsData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) return;

      // 1. Fetch market days
      let marketDays: any[] = [];
      const mdWithFee = await supabase
        .from('market_days')
        .select(`
          id,
          name,
          edition,
          event_date,
          status,
          standard_fee,
          region_id,
          regions (
            id,
            name
          )
        `)
        .order('event_date', { ascending: false });

      if (mdWithFee.error) {
        // Fallback without standard_fee column
        const mdFallback = await supabase
          .from('market_days')
          .select(`
            id,
            name,
            edition,
            event_date,
            status,
            region_id,
            regions (
              id,
              name
            )
          `)
          .order('event_date', { ascending: false });

        if (mdFallback.error) throw mdFallback.error;
        marketDays = (mdFallback.data || []).filter((m: any) => !isTestEdition(m));
      } else {
        marketDays = (mdWithFee.data || []).filter((m: any) => !isTestEdition(m));
      }

      // 2. Fetch vendor registrations
      let regList: any[] = [];
      const vrWithSource = await supabase
        .from('vendor_registrations')
        .select('id, market_day_id, amount_paid, fee_source');

      if (vrWithSource.error) {
        // Fallback without fee_source column
        const vrFallback = await supabase
          .from('vendor_registrations')
          .select('id, market_day_id, amount_paid');

        if (!vrFallback.error && vrFallback.data) {
          regList = vrFallback.data;
        }
      } else {
        regList = vrWithSource.data || [];
      }

      processMarketDays(marketDays, regList);
    } catch (err: any) {
      console.error('Error loading edition fee settings:', err);
      addToast(err.message || 'Failed to load edition standard fees', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const processMarketDays = (marketDays: any[], registrations: any[]) => {
    // Map stats & infer standard fee from existing records if standard_fee column is not populated
    const regMap: Record<string, { total: number; standard: number; override: number; amounts: number[] }> = {};

    registrations.forEach((r) => {
      const mid = r.market_day_id;
      if (!mid) return;
      if (!regMap[mid]) {
        regMap[mid] = { total: 0, standard: 0, override: 0, amounts: [] };
      }
      regMap[mid].total += 1;
      const amt = Number(r.amount_paid) || 0;
      if (amt > 0) regMap[mid].amounts.push(amt);

      if (r.fee_source === 'override') {
        regMap[mid].override += 1;
      } else {
        regMap[mid].standard += 1;
      }
    });

    const items: EditionFeeItem[] = marketDays.map((m) => {
      const stats = regMap[m.id] || { total: 0, standard: 0, override: 0, amounts: [] };
      let currentFee = Number(m.standard_fee) || 0;
      
      // If standard_fee not set in DB column, infer from the most common amount
      if (currentFee === 0 && stats.amounts.length > 0) {
        const modeMap: Record<number, number> = {};
        stats.amounts.forEach(a => { modeMap[a] = (modeMap[a] || 0) + 1; });
        let maxCount = 0;
        let modeAmt = 0;
        Object.entries(modeMap).forEach(([amtStr, count]) => {
          if (count > maxCount) {
            maxCount = count;
            modeAmt = Number(amtStr);
          }
        });
        currentFee = modeAmt;
      }

      return {
        id: m.id,
        name: m.name || 'Untitled Market',
        editionName: m.edition || m.name || 'Untitled Edition',
        regionId: m.region_id,
        regionName: m.regions?.name || 'Uganda',
        eventDate: m.event_date || '',
        standardFee: currentFee,
        totalVendors: stats.total,
        standardVendorsCount: stats.standard,
        overrideVendorsCount: stats.override,
        status: m.status || 'active'
      };
    });

    setEditions(items);

    // Populate fee input values with comma-formatted strings
    const initialInputs: Record<string, string> = {};
    items.forEach((item) => {
      initialInputs[item.id] = item.standardFee ? item.standardFee.toLocaleString('en-US') : '0';
    });
    setFeeInputs(initialInputs);
  };

  useEffect(() => {
    fetchEditionsData();
  }, [fetchEditionsData]);

  const handleInputChange = (editionId: string, val: string) => {
    // Strip non-digits
    const cleanNum = val.replace(/[^0-9]/g, '');
    const num = cleanNum ? parseInt(cleanNum, 10) : 0;
    setFeeInputs((prev) => ({
      ...prev,
      [editionId]: cleanNum ? num.toLocaleString('en-US') : ''
    }));
  };

  const handleSaveAndSync = async (item: EditionFeeItem) => {
    const inputVal = feeInputs[item.id] || '0';
    const numericFee = parseInt(inputVal.replace(/[^0-9]/g, ''), 10) || 0;

    setSavingId(item.id);
    try {
      const supabase = createClient();
      if (!supabase) return;

      // 1. Try updating standard_fee on market_days
      try {
        await supabase
          .from('market_days')
          .update({ standard_fee: numericFee, updated_at: new Date().toISOString() })
          .eq('id', item.id);
      } catch (e) {
        console.warn('Standard fee update notice:', e);
      }

      // 2. Fetch vendor_registrations for this edition
      let vrList: any[] = [];
      let hasFeeSourceCol = true;

      const vrResWithSource = await supabase
        .from('vendor_registrations')
        .select('id, amount_paid, fee_source')
        .eq('market_day_id', item.id);

      if (vrResWithSource.error) {
        hasFeeSourceCol = false;
        const vrFallback = await supabase
          .from('vendor_registrations')
          .select('id, amount_paid')
          .eq('market_day_id', item.id);

        if (!vrFallback.error && vrFallback.data) {
          vrList = vrFallback.data;
        }
      } else {
        vrList = vrResWithSource.data || [];
      }

      let syncedCount = 0;
      let preservedCount = 0;

      if (hasFeeSourceCol) {
        const standardToUpdate = vrList.filter((v: any) => v.fee_source !== 'override');
        preservedCount = vrList.filter((v: any) => v.fee_source === 'override').length;
        syncedCount = standardToUpdate.length;

        if (standardToUpdate.length > 0) {
          const ids = standardToUpdate.map((v: any) => v.id);
          const { error: vrUpdateErr } = await supabase
            .from('vendor_registrations')
            .update({
              amount_paid: numericFee,
              fee_source: 'standard',
              updated_at: new Date().toISOString()
            })
            .in('id', ids);

          if (vrUpdateErr) {
            // Fallback to updating amount_paid directly
            await supabase
              .from('vendor_registrations')
              .update({ amount_paid: numericFee, updated_at: new Date().toISOString() })
              .in('id', ids);
          }
        }
      } else {
        // Direct batch update on all vendor registrations for this edition
        syncedCount = vrList.length;
        const { error: batchErr } = await supabase
          .from('vendor_registrations')
          .update({
            amount_paid: numericFee,
            updated_at: new Date().toISOString()
          })
          .eq('market_day_id', item.id);

        if (batchErr) throw batchErr;
      }

      addToast(
        `Updated ${item.editionName} standard fee to UGX ${numericFee.toLocaleString()}. Synced ${syncedCount} vendor${syncedCount === 1 ? '' : 's'}${preservedCount > 0 ? ` (${preservedCount} overrides preserved)` : ''}.`,
        'success'
      );

      // Refresh list
      await fetchEditionsData();
    } catch (err: any) {
      console.error('Error saving standard fee:', err);
      addToast(err.message || 'Failed to update standard fee', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const filteredEditions = editions.filter(
    (e) =>
      e.editionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.regionName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Standard Vendor Fees
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Configure default vendor booth & registration fees per market edition.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchEditionsData}
          disabled={loading}
          className="self-start sm:self-auto gap-2 border-white/10 hover:bg-white/5 text-gray-300"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Safety Info Alert Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-300 leading-relaxed">
          <strong className="text-emerald-200 font-semibold block mb-0.5">
            Safe Sync with Protected Overrides
          </strong>
          When you update an edition's Standard Fee, the system automatically updates all vendors on the default rate.
          Any vendor with a <span className="underline decoration-emerald-500/50 font-medium">custom rate or discount override</span> is strictly preserved and will never be overwritten.
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by edition name, market, or region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Editions List Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400">Loading edition standard fees...</p>
        </div>
      ) : filteredEditions.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/10 rounded-xl">
          <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-300">No market editions found</p>
          <p className="text-xs text-gray-500 mt-1">Create an edition in Markets & Editions to configure its standard fee.</p>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-gray-400">
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider">Market & Edition</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider">Region & Date</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider text-center">Registered Vendors</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider w-[240px]">Standard Fee (UGX)</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-wider text-right w-[140px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEditions.map((item) => {
                  const isSaving = savingId === item.id;
                  const currentInput = feeInputs[item.id] ?? '0';

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
                          <Users className="w-3 h-3 text-gray-400" />
                          <span className="font-bold text-white">{item.totalVendors}</span>
                          <span className="text-gray-500">total</span>
                        </div>
                        {item.overrideVendorsCount > 0 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                              ⚡ {item.overrideVendorsCount} override{item.overrideVendorsCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-[11px] font-bold text-emerald-400/90 select-none">
                            UGX
                          </span>
                          <input
                            type="text"
                            value={currentInput}
                            onChange={(e) => handleInputChange(item.id, e.target.value)}
                            placeholder="0"
                            className="w-full pl-12 pr-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm font-mono text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSaveAndSync(item)}
                          disabled={isSaving}
                          className="w-full justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium border-0 shadow-lg shadow-emerald-950/40"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Save & Sync
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
