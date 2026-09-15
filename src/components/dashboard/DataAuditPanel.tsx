'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastProvider';
import { createClient } from '@/lib/supabase/client';
import {
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  RefreshCw,
  Loader2,
  Check,
} from 'lucide-react';

interface DuplicateGroup {
  vendor_name: string;
  vendor_phone: string;
  business_name: string;
  vendor_id: string;
  edition: string;
  edition_id: string;
  response_count: number;
  responses: {
    id: string;
    submitted_at: string;
    answer_count: number;
    answers: Record<string, string>;
  }[];
}

interface OrphanedVendor {
  id: string;
  contact_name: string;
  business_name: string;
  phone: string;
  category: string;
  created_at: string;
}

interface DataAuditPanelProps {
  onRefresh?: () => void;
}

export const DataAuditPanel: React.FC<DataAuditPanelProps> = ({ onRefresh }) => {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [orphaned, setOrphaned] = useState<OrphanedVendor[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const { addToast } = useToast();

  const isDeleted = (id: string) => deletedIds.has(id);

  const fetchAuditData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      // 1. Find duplicate survey_responses (same vendor, same edition)
      const { data: dupData, error: dupErr } = await supabase
        .from('survey_responses')
        .select(`
          id,
          submitted_at,
          vendor_id,
          context_id,
          vendors!inner(contact_name, business_name, phone),
          market_days!inner(id, name)
        `)
        .order('submitted_at', { ascending: false });

      if (dupErr) throw dupErr;

      // Group by vendor_id + context_id, find groups with >1
      const groupMap = new Map<string, unknown[]>();
      (dupData || []).forEach((r) => {
        const row = r as unknown as Record<string, unknown>;
        const key = `${row.vendor_id}_${row.context_id}`;
        const arr = groupMap.get(key) || [];
        arr.push(row);
        groupMap.set(key, arr);
      });

      const dupGroups: DuplicateGroup[] = [];
      for (const [, group] of groupMap) {
        if (group.length < 2) continue;
        const first = group[0] as unknown as Record<string, unknown>;
        const vArr = first.vendors as unknown as Record<string, unknown>[] | undefined;
        const mdArr = first.market_days as unknown as Record<string, unknown>[] | undefined;
        const v = vArr?.[0];
        const md = mdArr?.[0];

        // Fetch answer counts and snippet answers for each response
        const responsesWithAnswers = await Promise.all(
          group.map(async (row) => {
            const r = row as unknown as Record<string, unknown>;
            const { count } = await supabase
              .from('survey_answers')
              .select('*', { count: 'exact', head: true })
              .eq('response_id', r.id);

            const { data: ansData } = await supabase
              .from('survey_answers')
              .select('question_id, answer')
              .eq('response_id', r.id)
              .limit(30);

            const answers: Record<string, string> = {};
            (ansData || []).forEach((a: Record<string, unknown>) => {
              answers[String(a.question_id)] = String(a.answer || '');
            });

            return {
              id: String(r.id),
              submitted_at: String(r.submitted_at || ''),
              answer_count: count || 0,
              answers,
            };
          })
        );

        dupGroups.push({
          vendor_name: String(v?.contact_name || ''),
          vendor_phone: String(v?.phone || ''),
          business_name: String(v?.business_name || ''),
          vendor_id: String(first.vendor_id as string),
          edition: String(md?.name || ''),
          edition_id: String(first.context_id as string),
          response_count: group.length,
          responses: responsesWithAnswers,
        });
      }

      setDuplicates(dupGroups);

      // 2. Find orphaned vendors (no survey_responses, no vendor_registrations)
      const { data: orphanedData, error: orphanedErr } = await supabase
        .rpc('get_orphaned_vendors')
        .select();

      // Fallback if RPC doesn't exist — use a client-side join approach
      if (orphanedErr || !orphanedData) {
        const { data: allVendors } = await supabase
          .from('vendors')
          .select('id, contact_name, business_name, phone, category, created_at')
          .order('created_at', { ascending: false });

        const { data: responses } = await supabase
          .from('survey_responses')
          .select('vendor_id');

        const { data: regs } = await supabase
          .from('vendor_registrations')
          .select('vendor_id');

        const linkedIds = new Set<string>();
        (responses || []).forEach((r) => linkedIds.add(String((r as unknown as Record<string, unknown>).vendor_id)));
        (regs || []).forEach((r) => linkedIds.add(String((r as unknown as Record<string, unknown>).vendor_id)));

        const orphans = (allVendors || [])
          .filter((v) => !linkedIds.has(String((v as unknown as Record<string, unknown>).id)))
          .slice(0, 30)
          .map((v) => v as unknown as OrphanedVendor);

        setOrphaned(orphans);
      } else {
        setOrphaned(orphanedData as unknown as OrphanedVendor[]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Audit fetch error:', message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAuditData();
  }, [fetchAuditData]);

  const handleDeleteResponse = async (responseId: string) => {
    if (!supabase) return;
    if (!window.confirm('Delete this response and all its answers? This cannot be undone.')) return;

    setActionLoading(responseId);
    try {
      // Delete answers first (FK cascade might handle this, but explicit is safer)
      await supabase.from('survey_answers').delete().eq('response_id', responseId);
      await supabase.from('survey_responses').delete().eq('id', responseId);

      // Remove from local state
      setDeletedIds(prev => new Set([...prev, responseId]));
      addToast('Response deleted', 'success');
      onRefresh?.();

      // Re-scan after 1s
      setTimeout(() => fetchAuditData(), 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Delete failed: ${message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!supabase) return;
    if (!window.confirm('Delete this vendor permanently? This cannot be undone.')) return;

    setActionLoading(vendorId);
    try {
      await supabase.from('vendors').delete().eq('id', vendorId);
      setOrphaned(prev => prev.filter(v => v.id !== vendorId));
      addToast('Vendor deleted', 'success');
      onRefresh?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Delete failed: ${message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const findDifferingAnswers = (responses: DuplicateGroup['responses']) => {
    const allKeys = new Set<string>();
    responses.forEach(r => Object.keys(r.answers).forEach(k => allKeys.add(k)));

    const diffs: { key: string; values: string[] }[] = [];
    allKeys.forEach(key => {
      const vals = responses.map(r => r.answers[key] || '(empty)');
      if (new Set(vals).size > 1) {
        diffs.push({ key, values: vals });
      }
    });
    return diffs;
  };

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-xl shadow-xs p-12 text-center select-none">
        <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-secondary">Scanning database for duplicates...</p>
      </div>
    );
  }

  const totalIssues = duplicates.length + orphaned.length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-muted text-amber flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-text-primary">Data Audit</h3>
            <p className="text-[10px] text-text-tertiary">
              {totalIssues === 0
                ? 'No issues found'
                : `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} detected`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAuditData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Rescan</span>
        </Button>
      </div>

      {totalIssues === 0 && (
        <div className="bg-white border border-border rounded-xl shadow-xs p-8 text-center select-none">
          <Check className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-text-primary">All data looks clean</p>
          <p className="text-[10px] text-text-tertiary mt-1">
            No duplicate responses or orphaned vendors found.
          </p>
        </div>
      )}

      {/* === DUPLICATE RESPONSES === */}
      {duplicates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-amber" />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Duplicate Responses ({duplicates.length})
            </h4>
            <span className="text-[10px] text-text-tertiary">
              Same vendor imported multiple times into the same edition
            </span>
          </div>

          {duplicates.map((group, idx) => (
            <Card key={idx} className="select-none">
              {/* Summary row */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedGroup(expandedGroup === idx ? null : idx)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {expandedGroup === idx ? (
                    <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-text-primary truncate">
                        {group.vendor_name}
                      </span>
                      <Badge variant="neutral" size="sm">{group.vendor_phone}</Badge>
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      {group.business_name} &middot; {group.edition} &middot;{' '}
                      {group.response_count} duplicate responses
                    </p>
                  </div>
                </div>
                <Badge variant="warning" size="sm" className="shrink-0">
                  {group.response_count}x
                </Badge>
              </div>

              {/* Expanded detail */}
              {expandedGroup === idx && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  {/* Differing answers */}
                  {findDifferingAnswers(group.responses).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-text-tertiary uppercase mb-2">
                        Differing Answers Between Responses
                      </p>
                      <div className="space-y-2">
                        {findDifferingAnswers(group.responses).map((diff, di) => (
                          <div
                            key={di}
                            className="bg-slate-50 border border-border rounded-lg p-3"
                          >
                            <p className="text-[10px] font-mono text-text-tertiary mb-1.5 truncate">
                              question_id: {diff.key}
                            </p>
                            <div className="flex gap-2">
                              {diff.values.map((val, vi) => (
                                <span
                                  key={vi}
                                  className="text-[10px] bg-white border border-border rounded px-2 py-1 font-mono text-text-primary truncate max-w-[200px]"
                                  title={val}
                                >
                                  R{vi + 1}: {val}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response list */}
                  <div>
                    <p className="text-[10px] font-bold text-text-tertiary uppercase mb-2">
                      All Responses
                    </p>
                    <div className="space-y-2">
                      {group.responses.map((resp, ri) => (
                        <div
                          key={resp.id}
                          className={`flex items-center justify-between bg-slate-50 border rounded-lg p-3 transition-opacity ${
                            isDeleted(resp.id)
                              ? 'opacity-30 border-border'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-[10px] font-mono text-text-tertiary shrink-0">
                              #{ri + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] text-text-secondary truncate">
                                ID: {resp.id}
                              </p>
                              <p className="text-[10px] text-text-tertiary">
                                {resp.answer_count} answers &middot;{' '}
                                {new Date(resp.submitted_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {isDeleted(resp.id) ? (
                            <span className="text-[10px] text-text-tertiary italic">
                              Deleted
                            </span>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteResponse(resp.id);
                              }}
                              disabled={actionLoading === resp.id}
                            >
                              {actionLoading === resp.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              <span>Delete</span>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* === ORPHANED VENDORS === */}
      {orphaned.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-amber" />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Orphaned Vendors ({orphaned.length})
            </h4>
            <span className="text-[10px] text-text-tertiary">
              Vendors with no survey responses or registrations
            </span>
          </div>

          <div className="bg-white border border-border rounded-xl shadow-xs overflow-hidden select-none">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="p-3 text-[10px] font-bold text-text-tertiary uppercase">Name</th>
                  <th className="p-3 text-[10px] font-bold text-text-tertiary uppercase">Business</th>
                  <th className="p-3 text-[10px] font-bold text-text-tertiary uppercase">Phone</th>
                  <th className="p-3 text-[10px] font-bold text-text-tertiary uppercase">Category</th>
                  <th className="p-3 text-[10px] font-bold text-text-tertiary uppercase">Created</th>
                  <th className="p-3 text-[10px] font-bold text-text-tertiary uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {orphaned.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-medium text-text-primary">{v.contact_name || '—'}</td>
                    <td className="p-3 text-text-secondary">{v.business_name || '—'}</td>
                    <td className="p-3 text-text-secondary font-mono">{v.phone || '—'}</td>
                    <td className="p-3 text-text-secondary">{v.category || '—'}</td>
                    <td className="p-3 text-text-tertiary text-[10px]">
                      {v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="clear"
                        size="sm"
                        onClick={() => handleDeleteVendor(v.id)}
                        disabled={actionLoading === v.id}
                      >
                        {actionLoading === v.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
