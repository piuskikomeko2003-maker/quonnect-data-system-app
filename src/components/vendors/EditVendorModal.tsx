'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { createClient } from '@/lib/supabase/client';
import { DynamicQuickEntryForm, FormDataCache } from '@/components/forms/DynamicQuickEntryForm';
import { Button } from '@/components/ui/Button';
import {
  X,
  Loader2,
  FileText,
  RefreshCw,
  AlertCircle,
  Check,
  ChevronLeft,
} from 'lucide-react';

interface FormQuestion {
  id: string;
  question_text: string;
  question_type: string;
  is_required: boolean;
  csv_column: string;
  options: string[] | null;
  sort_order: number;
  section_id: string;
  form_sections?: { name: string; sort_order: number }[] | null;
}

interface SectionData {
  id: string;
  name: string;
  sort_order: number;
}

interface SnapshotQuestion {
  id: string;
  question_text: string;
  question_type: string;
  is_required: boolean;
  csv_column: string;
  options: string[] | null;
  sort_order: number;
  section_id: string;
}

type ViewMode = 'choice' | 'form';

export interface EditVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  vendorId: string;
  vendorName: string;
  activeEdition: { id: string; name: string } | null;
  onSaved: () => void;
}

export const EditVendorModal: React.FC<EditVendorModalProps> = ({
  isOpen,
  onClose,
  onBack,
  vendorId,
  vendorName,
  activeEdition,
  onSaved,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('choice');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [responseId, setResponseId] = useState<string | null>(null);
  const [existingAnswers, setExistingAnswers] = useState<Record<string, string>>({});
  const [snapshotQuestions, setSnapshotQuestions] = useState<SnapshotQuestion[] | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<FormQuestion[]>([]);
  const [currentSections, setCurrentSections] = useState<SectionData[]>([]);

  const [editModeEditor, setEditModeEditor] = useState<boolean>(false);
  const [formDataCache, setFormDataCache] = useState<FormDataCache | undefined>(undefined);
  const [orphanedAnswers, setOrphanedAnswers] = useState<Record<string, string>>({});

  const fetchContext = useCallback(async () => {
    if (!vendorId || !activeEdition) return;

    setLoading(true);
    setError(null);
    setSnapshotQuestions(null);
    setExistingAnswers({});
    setCurrentQuestions([]);
    setCurrentSections([]);
    setOrphanedAnswers({});
    setFormDataCache(undefined);
    setEditModeEditor(false);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data: formData, error: fErr } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', 'vendor_data_collection')
        .single();

      if (fErr || !formData) throw new Error('Collection form not found');
      const formId = formData.id;

      const { data: respData, error: rErr } = await supabase
        .from('survey_responses')
        .select(`
          id,
          survey_answers (
            id,
            question_id,
            answer,
            survey_questions ( id, question_text, question_type, is_required, csv_column, options, sort_order, section_id )
          )
        `)
        .eq('vendor_id', vendorId)
        .eq('context_id', activeEdition.id)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (rErr) throw rErr;

      const resp = respData?.[0];
      if (!resp) {
        setError('No survey response found for this vendor in the current edition.');
        return;
      }

      setResponseId(resp.id);

      try {
        const { data: snapshotData } = await supabase
          .from('survey_responses')
          .select('form_schema_snapshot')
          .eq('id', resp.id)
          .maybeSingle();
        if (snapshotData?.form_schema_snapshot && Array.isArray(snapshotData.form_schema_snapshot)) {
          setSnapshotQuestions(snapshotData.form_schema_snapshot as SnapshotQuestion[]);
        }
      } catch {
        // Column may not exist yet (migration not applied) — gracefully skip
      }

      const answerMap: Record<string, string> = {};
      const answerSet = resp.survey_answers || [];
      for (const a of answerSet) {
        const q = (a as any).survey_questions;
        const csvCol = q?.csv_column;
        if (csvCol) {
          answerMap[csvCol] = (a as any).answer;
        }
      }
      setExistingAnswers(answerMap);

      const { data: qData, error: qErr } = await supabase
        .from('survey_questions')
        .select(`
          id,
          question_text,
          question_type,
          is_required,
          csv_column,
          options,
          sort_order,
          section_id,
          form_sections ( name, sort_order )
        `)
        .eq('form_id', formId)
        .order('sort_order', { ascending: true });

      if (qErr) throw qErr;

      const qs = (qData || []) as unknown as FormQuestion[];
      setCurrentQuestions(qs);

      const secMap = new Map<string, SectionData>();
      qs.forEach((q) => {
        if (q.section_id && q.form_sections && q.form_sections.length > 0) {
          const sec = q.form_sections[0];
          secMap.set(q.section_id, {
            id: q.section_id,
            name: sec.name,
            sort_order: sec.sort_order,
          });
        }
      });
      setCurrentSections(Array.from(secMap.values()).sort((a, b) => a.sort_order - b.sort_order));
    } catch (err: unknown) {
      let msg = 'Failed to load vendor data';
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        const e = err as any;
        msg = e.message || JSON.stringify(err);
        if (e.details) msg += ` — ${e.details}`;
        if (e.hint) msg += ` (${e.hint})`;
        if (e.code) msg += ` [${e.code}]`;
      }
      console.error('EditVendorModal fetch error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [vendorId, activeEdition]);

  useEffect(() => {
    if (isOpen) {
      setViewMode('choice');
      setError(null);
      setResponseId(null);
      setExistingAnswers({});
      setSnapshotQuestions(null);
      setCurrentQuestions([]);
      setCurrentSections([]);
      setOrphanedAnswers({});
      setFormDataCache(undefined);
      fetchContext();
    }
  }, [isOpen, fetchContext]);

  const handleUseOriginal = () => {
    const useSnapshot = snapshotQuestions && snapshotQuestions.length > 0;
    let formQuestions: FormQuestion[];

    if (useSnapshot) {
      formQuestions = snapshotQuestions.map((sq) => ({
        id: sq.id,
        question_text: sq.question_text,
        question_type: sq.question_type,
        is_required: sq.is_required,
        csv_column: sq.csv_column,
        options: sq.options,
        sort_order: sq.sort_order,
        section_id: sq.section_id || '',
      }));
    } else {
      const answerQIds = new Set<string>();
      if (currentQuestions.length > 0) {
        for (const [csvCol] of Object.entries(existingAnswers)) {
          const q = currentQuestions.find((cq) => cq.csv_column === csvCol);
          if (q) answerQIds.add(q.id);
        }
      }
      formQuestions = currentQuestions.filter((q) => answerQIds.has(q.id));
    }

    const secMap = new Map<string, SectionData>();
    formQuestions.forEach((q) => {
      if (q.section_id && q.form_sections && q.form_sections.length > 0) {
        const sec = q.form_sections[0];
        secMap.set(q.section_id, {
          id: q.section_id,
          name: sec.name,
          sort_order: sec.sort_order,
        });
      }
    });

    const cache: FormDataCache = {
      questions: formQuestions,
      sections: Array.from(secMap.values()).sort((a, b) => a.sort_order - b.sort_order),
      questionRules: [],
      sectionRules: [],
    };
    setFormDataCache(cache);
    setEditModeEditor(true);
    setOrphanedAnswers({});
    setViewMode('form');
  };

  const handleUseCurrent = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const currentQIds = new Set(currentQuestions.map((q) => q.id));

      const currentQMap = new Map<string, FormQuestion>();
      currentQuestions.forEach((q) => { currentQMap.set(q.id, q); });

      const resMap: Record<string, string> = {};
      const orphaned: Record<string, string> = {};

      for (const [csvCol, answer] of Object.entries(existingAnswers)) {
        const matched = currentQuestions.find((q) => q.csv_column === csvCol);
        if (matched) {
          resMap[csvCol] = answer;
        } else {
          orphaned[csvCol] = answer;
        }
      }

      setOrphanedAnswers(orphaned);

      const { data: qlData } = await supabase
        .from('question_logic')
        .select('*')
        .in('source_question_id', [...currentQIds]);

      const { data: slData } = await supabase
        .from('section_logic')
        .select('*')
        .in('source_question_id', [...currentQIds]);

      const cache: FormDataCache = {
        questions: currentQuestions,
        sections: currentSections,
        questionRules: qlData || [],
        sectionRules: slData || [],
      };
      setFormDataCache(cache);
      setExistingAnswers(resMap);
      setEditModeEditor(true);
      setViewMode('form');
    } catch (err: unknown) {
      let msg = 'Failed to load current form';
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        const e = err as any;
        msg = e.message || JSON.stringify(err);
        if (e.details) msg += ` — ${e.details}`;
        if (e.code) msg += ` [${e.code}]`;
      }
      console.error('EditVendorModal use current error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (answers: Record<string, string>): Promise<{ synced: boolean; message?: string; name?: string }> => {
    if (!activeEdition || !responseId) {
      throw new Error('Missing edition or response context');
    }

    const supabase = createClient();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data: formData, error: fErr } = await supabase
      .from('forms')
      .select('id')
      .eq('slug', 'vendor_data_collection')
      .single();

    if (fErr || !formData) throw new Error('Collection form not found');
    const formId = formData.id;

    const questionSnapshot = formDataCache?.questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: q.is_required,
      csv_column: q.csv_column,
      options: q.options,
      sort_order: q.sort_order,
      section_id: q.section_id,
    })) || [];

    try {
      const snapshotPayload: Record<string, any> = {
        submitted_at: new Date().toISOString(),
      };
      if (questionSnapshot.length > 0) {
        snapshotPayload.form_schema_snapshot = questionSnapshot;
      }
      const { error } = await supabase
        .from('survey_responses')
        .update(snapshotPayload)
        .eq('id', responseId);
      if (error) throw error;
    } catch (snapshotErr: any) {
      const isColumnMissing =
        snapshotErr?.code === '42703' ||
        (typeof snapshotErr?.message === 'string' &&
          snapshotErr.message.includes('form_schema_snapshot'));
      if (isColumnMissing) {
        const { error: fallbackErr } = await supabase
          .from('survey_responses')
          .update({ submitted_at: new Date().toISOString() })
          .eq('id', responseId);
        if (fallbackErr) throw fallbackErr;
      } else {
        throw snapshotErr;
      }
    }

    const { data: questions, error: qErr } = await supabase
      .from('survey_questions')
      .select('id, csv_column')
      .eq('form_id', formId);

    if (qErr) throw qErr;

    const answersToUpsert = [];
    for (const [csvCol, val] of Object.entries(answers)) {
      if (val !== undefined && val !== null && val !== '') {
        const q = (questions || []).find((q: any) => q.csv_column === csvCol);
        if (q) {
          answersToUpsert.push({
            response_id: responseId,
            question_id: q.id,
            answer: String(val),
          });
        }
      }
    }

    if (answersToUpsert.length > 0) {
      const { error: ansErr } = await supabase
        .from('survey_answers')
        .upsert(answersToUpsert, { onConflict: 'response_id,question_id' });

      if (ansErr) throw ansErr;
    }

    onSaved();
    return { synced: true, name: vendorName };
  };

  const handleClose = () => {
    setViewMode('choice');
    setError(null);
    setFormDataCache(undefined);
    setOrphanedAnswers({});
    setEditModeEditor(false);
    onClose();
  };

  const handleBack = () => {
    setViewMode('choice');
    setError(null);
    setFormDataCache(undefined);
    setOrphanedAnswers({});
    setEditModeEditor(false);
    onClose();
    if (onBack) onBack();
  };

  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1100] flex items-center sm:items-start justify-center p-3 sm:p-4 select-none"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
        onClick={handleClose}
      />

      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-white border border-border rounded-2xl shadow-xl z-10 w-full max-w-[600px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto animate-scale-up sm:mt-[4vh] outline-none"
      >
        <div className="sticky top-0 bg-white border-b border-border p-4 flex items-center justify-between z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer mr-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                {viewMode === 'choice' ? 'Edit Vendor Submission' : 'Editing Submission'}
              </h2>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                {vendorName} — {activeEdition?.name || 'Current Edition'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 border border-border text-text-muted hover:text-text-primary hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          {loading && viewMode === 'choice' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <span className="text-xs text-text-secondary">Loading vendor data...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-left">
                <strong className="block text-xs text-red-700 font-bold">Error</strong>
                <p className="text-[11px] text-text-secondary mt-0.5">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={fetchContext}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && viewMode === 'choice' && (
            <div className="space-y-4 text-left">
              <div className="bg-slate-50 border border-border rounded-lg p-4">
                <p className="text-xs text-text-primary leading-relaxed">
                  This vendor&apos;s original submission may have used a different version of the form
                  than what&apos;s currently active. Choose how you&apos;d like to edit:
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={handleUseOriginal}
                  className="bg-white border border-border hover:border-accent hover:bg-accent-soft/20 rounded-lg p-4 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-accent-soft text-accent rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-text-primary">
                        Edit using Original Form
                      </h3>
                      <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">
                        Open the form exactly as it was when this vendor first submitted.
                        Only the questions they originally saw will appear.
                        {snapshotQuestions && snapshotQuestions.length > 0
                          ? ` Snapshot available: ${snapshotQuestions.length} questions.`
                          : existingAnswers && Object.keys(existingAnswers).length > 0
                            ? ` Reconstructed from ${Object.keys(existingAnswers).length} previously answered fields.`
                            : ''}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleUseCurrent}
                  className="bg-white border border-border hover:border-accent hover:bg-accent-soft/20 rounded-lg p-4 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-accent-soft text-accent rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-text-primary">
                        Edit using Current Form
                      </h3>
                      <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">
                        Use the latest version of the form. Existing answers pre-fill matching
                        fields. Any new questions added since their original submission will
                        appear blank.
                        {currentQuestions.length > 0
                          ? ` Current form has ${currentQuestions.length} questions.`
                          : ''}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-[10px] text-text-tertiary text-center">
                Whichever option you choose, changes will update the existing submission — a new
                submission will NOT be created.
              </p>
            </div>
          )}

          {loading && viewMode === 'form' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <span className="text-xs text-text-secondary">Preparing form...</span>
            </div>
          )}

          {!loading && viewMode === 'form' && formDataCache && (
            <div className="text-left">
              {Object.keys(orphanedAnswers).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
                  <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">
                    Previous Answers No Longer in the Form
                  </h4>
                  <p className="text-[10px] text-text-secondary mb-3">
                    These fields have been removed from the current form. They will still be saved
                    but won&apos;t be editable here.
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(orphanedAnswers).map(([field, val]) => (
                      <div
                        key={field}
                        className="flex items-center justify-between gap-3 bg-white border border-border rounded px-3 py-1.5"
                      >
                        <span className="text-[10px] text-text-tertiary font-mono">{field}</span>
                        <span className="text-[10px] font-semibold text-text-primary truncate max-w-[200px]">
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DynamicQuickEntryForm
                formSlug="vendor_data_collection"
                activeEdition={activeEdition}
                onSubmit={handleSubmit}
                successState={{
                  show: false,
                  onAddAnother: () => {},
                }}
                runningCount={0}
                formIcon={<FileText className="w-4 h-4 text-accent" />}
                formLabel="Edit Submission"
                formSubtitle={`Editing answers for ${vendorName}`}
                countLabel="editing"
                lookupEnabled={false}
                cachedData={formDataCache}
                initialAnswers={existingAnswers}
                editMode={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
