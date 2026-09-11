'use client';

import React, { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DynamicQuickEntryForm, FormDataCache } from '@/components/forms/DynamicQuickEntryForm';
import { DuplicateConfirmModal } from '@/components/ui/DuplicateConfirmModal';
import {
  X,
  Loader2,
  Database,
  AlertCircle,
  Info,
  ChevronLeft,
} from 'lucide-react';



const PREFILL_FIELDS = new Set([
  'full_name',
  'business_name',
  'phone_number',
  'email',
  'gender',
  'age',
  'business_category',
  'how_long_in_business',
  'primary_source_of_income',
  'products_primarily_from',
  'business_operates_as',
  'paid_employees',
  'number_of_employees',
  'female_employees',
  'youth_employees',
  'active_social_media',
  'online_sales',
  'how_did_you_know',
  'business_growth',
  'quonnect_benefits',
]);

const EVENT_SPECIFIC_FIELDS = new Set([
  'first_time_at_quonnect',
  'times_attended',
  'attended_last_quonnect',
  'regions_attended',
  'hired_new_employees',
  'new_employees_count',
  'hires_casual_helpers',
  'casual_helpers_count',
  'would_recommend',
  'main_challenges',
]);

interface PaidVendor {
  id: string;
  vendor_id: string;
  payment_status: string;
  amount_paid: number;
  created_at: string;
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  category: string;
}

export interface PaidVendorCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  vendor: PaidVendor | null;
  activeEdition: { id: string; name: string } | null;
  onSaved: (vendorName: string) => void;
}

export const PaidVendorCollectionModal: React.FC<PaidVendorCollectionModalProps> = ({
  isOpen,
  onClose,
  onBack,
  vendor,
  activeEdition,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillAnswers, setPrefillAnswers] = useState<Record<string, string>>({});
  const [prefillSource, setPrefillSource] = useState<Record<string, 'registration' | 'last_visit' | 'both'>>({});
  const [existingResponseId, setExistingResponseId] = useState<string | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    isOpen: boolean;
    vendorName: string;
    editionName: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [formDataCache, setFormDataCache] = useState<FormDataCache | undefined>(undefined);
  const [ready, setReady] = useState(false);

  const buildPrefillData = useCallback(async () => {
    if (!vendor || !activeEdition) return;

    setLoading(true);
    setError(null);
    setReady(false);
    setExistingResponseId(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const prefill: Record<string, string> = {};
      const sources: Record<string, 'registration' | 'last_visit' | 'both'> = {};

      const paidFields: Record<string, string> = {
        full_name: vendor.contact_name || '',
        business_name: vendor.business_name || '',
        phone_number: vendor.phone || '',
        email: vendor.email || '',
        business_category: vendor.category || '',
      };

      for (const [key, val] of Object.entries(paidFields)) {
        if (val && val.trim()) {
          prefill[key] = val;
          sources[key] = 'registration';
        }
      }

      const priorFields: Record<string, string> = {};
      const priorSources: Record<string, 'last_visit'> = {};

      if (vendor.vendor_id) {
        // First, check if this vendor already has a survey response for the current edition
        const { data: currentResponses } = await supabase
          .from('survey_responses')
          .select(`
            id,
            submitted_at,
            survey_answers (
              answer,
              survey_questions ( csv_column )
            )
          `)
          .eq('vendor_id', vendor.vendor_id)
          .eq('context_id', activeEdition.id)
          .limit(1);

        if (currentResponses && currentResponses.length > 0) {
          const curr = currentResponses[0];
          setExistingResponseId(curr.id);
          if (curr.survey_answers) {
            for (const a of curr.survey_answers) {
              const q = (a as any).survey_questions;
              const csvCol = q?.csv_column;
              if (csvCol && a.answer) {
                prefill[csvCol] = a.answer;
                sources[csvCol] = 'registration';
              }
            }
          }
        } else {
          // If not in current edition, check most recent response from past editions
          const { data: priorResponses } = await supabase
            .from('survey_responses')
            .select(`
              id,
              submitted_at,
              survey_answers (
                answer,
                survey_questions ( csv_column )
              )
            `)
            .eq('vendor_id', vendor.vendor_id)
            .neq('context_id', activeEdition.id)
            .order('submitted_at', { ascending: false })
            .limit(1);

          const prior = priorResponses?.[0];
          if (prior?.survey_answers) {
            for (const a of prior.survey_answers) {
              const q = (a as any).survey_questions;
              const csvCol = q?.csv_column;
              if (csvCol && a.answer && PREFILL_FIELDS.has(csvCol)) {
                priorFields[csvCol] = a.answer;
                priorSources[csvCol] = 'last_visit';
              }
            }
          }
        }
      }

      for (const [key, val] of Object.entries(priorFields)) {
        if (val && val.trim()) {
          prefill[key] = val;
          sources[key] = 'last_visit';
        }
      }

      for (const [key] of Object.entries(paidFields)) {
        if (priorFields[key] && paidFields[key] && priorFields[key] !== paidFields[key]) {
          sources[key] = 'both';
        }
      }

      setPrefillAnswers(prefill);
      setPrefillSource(sources);

      const { data: formData } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', 'vendor_data_collection')
        .single();

      if (!formData) throw new Error('Collection form not found');
      const formId = formData.id;

      const { data: qData } = await supabase
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

      if (!qData) throw new Error('No questions found');

      const qs = qData as any[];
      const sections: { id: string; name: string; sort_order: number }[] = [];
      const secMap = new Map<string, { id: string; name: string; sort_order: number }>();
      qs.forEach((q: any) => {
        if (q.section_id && q.form_sections && q.form_sections.length > 0) {
          const sec = q.form_sections[0];
          secMap.set(q.section_id, {
            id: q.section_id,
            name: sec.name,
            sort_order: sec.sort_order,
          });
        }
      });
      sections.push(...Array.from(secMap.values()).sort((a, b) => a.sort_order - b.sort_order));

      const qIds = qs.map((q: any) => q.id);
      const [{ data: qlData }, { data: slData }] = await Promise.all([
        supabase.from('question_logic').select('*').in('source_question_id', qIds),
        supabase.from('section_logic').select('*').in('source_question_id', qIds),
      ]);

      setFormDataCache({
        questions: qs,
        sections,
        questionRules: qlData || [],
        sectionRules: slData || [],
      });

      setReady(true);
    } catch (err: unknown) {
      let msg = 'Failed to load pre-fill data';
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        msg = (err as any).message || msg;
      }
      console.error('PaidVendorCollectionModal prefill error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [vendor, activeEdition]);

  const handleSubmit = async (answers: Record<string, string>): Promise<{ synced: boolean; message?: string; name?: string }> => {
    if (!activeEdition || !vendor) {
      throw new Error('Missing edition or vendor context');
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

    const { data: questions, error: qErr } = await supabase
      .from('survey_questions')
      .select('id, csv_column, question_text, question_type, is_required, options, sort_order, section_id')
      .eq('form_id', formId);

    if (qErr) throw qErr;

    const questionSnapshot = (questions || []).map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: q.is_required,
      csv_column: q.csv_column,
      options: q.options,
      sort_order: q.sort_order,
      section_id: q.section_id,
    }));

    let vendorId = vendor.vendor_id;
    if (!vendorId) {
      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', vendor.phone)
        .limit(1);
      if (existingVendor && existingVendor.length > 0) {
        vendorId = existingVendor[0].id;
        const { error: updErr } = await supabase
          .from('vendors')
          .update({
            business_name: answers.business_name || vendor.business_name,
            contact_name: answers.full_name || vendor.contact_name,
            email: answers.email || vendor.email,
            category: answers.business_category || vendor.category,
            is_active: true,
          })
          .eq('id', vendorId);
        if (updErr) throw updErr;
      } else {
        const { data: newVendor } = await supabase
          .from('vendors')
          .insert({
            business_name: answers.business_name || vendor.business_name,
            contact_name: answers.full_name || answers.contact_name || vendor.contact_name,
            phone: answers.phone_number || vendor.phone,
            email: answers.email || vendor.email,
            category: answers.business_category || vendor.category,
            is_active: true,
          })
          .select('id')
          .single();
        if (!newVendor) throw new Error('Failed to create vendor');
        vendorId = newVendor.id;
      }
    }

    let responseId: string = existingResponseId || '';

    if (!responseId) {
      const { data: existingResp } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('context_id', activeEdition.id)
        .maybeSingle();

      if (existingResp?.id) {
        responseId = existingResp.id;
      }
    }

    if (responseId) {
      // Vendor already has a response for this edition — ask user to confirm replacement or cancel
      const shouldReplace = await new Promise<boolean>((resolve) => {
        setDuplicatePrompt({
          isOpen: true,
          vendorName: vendor.business_name || vendor.contact_name || answers.business_name || 'This Vendor',
          editionName: activeEdition.name,
          onConfirm: () => {
            setDuplicatePrompt(null);
            resolve(true);
          },
          onCancel: () => {
            setDuplicatePrompt(null);
            resolve(false);
          },
        });
      });

      if (!shouldReplace) {
        return {
          synced: false,
          message: 'Update cancelled. Existing survey data was kept unchanged.',
          name: vendor.contact_name || vendor.business_name,
        };
      }

      // User confirmed replacement — update existing record
      const updatePayload: Record<string, any> = {
        submitted_at: new Date().toISOString(),
      };
      if (questionSnapshot.length > 0) {
        updatePayload.form_schema_snapshot = questionSnapshot;
      }

      try {
        await supabase.from('survey_responses').update(updatePayload).eq('id', responseId);
      } catch {
        await supabase.from('survey_responses').update({ submitted_at: new Date().toISOString() }).eq('id', responseId);
      }
    } else {
      // First response for this edition — insert
      const snapshotPayload: Record<string, any> = {
        form_id: formId,
        context_type: 'market_day',
        context_id: activeEdition.id,
        vendor_id: vendorId,
        source: 'manual',
        submitted_at: new Date().toISOString(),
      };
      if (questionSnapshot.length > 0) {
        snapshotPayload.form_schema_snapshot = questionSnapshot;
      }

      const { data: resData, error: resError } = await supabase
        .from('survey_responses')
        .insert(snapshotPayload)
        .select()
        .single();

      if (resError && (resError.code === '23505' || resError.message?.includes('unique'))) {
        // Handled race condition: row was created concurrently
        const { data: existingRow } = await supabase
          .from('survey_responses')
          .select('id')
          .eq('vendor_id', vendorId)
          .eq('context_id', activeEdition.id)
          .maybeSingle();
        if (existingRow?.id) {
          responseId = existingRow.id;
        } else {
          throw resError;
        }
      } else if (resError) {
        const isColumnMissing =
          resError?.code === '42703' ||
          (typeof resError?.message === 'string' &&
            resError.message.includes('form_schema_snapshot'));
        if (isColumnMissing) {
          delete snapshotPayload.form_schema_snapshot;
          const { data: fbData, error: fallbackErr } = await supabase
            .from('survey_responses')
            .insert(snapshotPayload)
            .select()
            .single();
          if (fallbackErr) throw fallbackErr;
          if (!fbData) throw new Error('Failed to create survey response');
          responseId = fbData.id;
        } else {
          throw resError;
        }
      } else if (resData?.id) {
        responseId = resData.id;
      }
    }

    if (!responseId) throw new Error('Failed to resolve survey response ID');

    const answersToInsert = [];
    for (const [csvCol, val] of Object.entries(answers)) {
      if (val !== undefined && val !== null && val !== '') {
        const q = (questions || []).find((q: any) => q.csv_column === csvCol);
        if (q) {
          answersToInsert.push({
            response_id: responseId,
            question_id: q.id,
            answer: String(val),
          });
        }
      }
    }

    if (answersToInsert.length > 0) {
      // Clean previous answers for this response to prevent duplicate key or stale values
      await supabase.from('survey_answers').delete().eq('response_id', responseId);
      const { error: ansErr } = await supabase.from('survey_answers').insert(answersToInsert);
      if (ansErr) {
        console.warn('survey_answers insert warning:', ansErr.message);
      }
    }

    const contactName = answers.full_name || answers.contact_name || vendor.contact_name;
    const { error: walkErr } = await supabase.from('walkins').insert({
      id: responseId,
      market_day_id: activeEdition.id,
      full_name: contactName,
      phone: answers.phone_number || vendor.phone,
      email: answers.email || vendor.email,
      business_type: answers.business_category || vendor.category,
      age: answers.age ? parseInt(answers.age) : null,
      recorded_at: new Date().toISOString(),
    });
    if (walkErr) {
      console.error('Auto-walkin insert failed:', walkErr);
    }

    onSaved(contactName || 'Vendor');
    return { synced: true, name: contactName };
  };

  const handleClose = () => {
    onClose();
  };

  const handleBack = () => {
    onClose();
    if (onBack) onBack();
  };

  // Auto-load prefill data whenever the modal opens with a new vendor
  const vendorKey = vendor ? `${vendor.id ?? vendor.vendor_id ?? ''}-${activeEdition?.id ?? ''}` : null;
  React.useEffect(() => {
    if (isOpen && vendor && activeEdition) {
      setReady(false);
      setError(null);
      setPrefillAnswers({});
      setPrefillSource({});
      setFormDataCache(undefined);
      buildPrefillData();
    }
    // Only re-run when the modal opens or vendor/edition changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vendorKey]);

  if (!isOpen || !vendor) return null;

  return (
    <div
      className="fixed inset-0 z-[1150] flex items-center sm:items-start justify-center p-3 sm:p-4 select-none overflow-y-auto"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
        onClick={handleClose}
      />

      <div className="relative bg-white border border-border rounded-2xl shadow-xl z-10 w-full max-w-[600px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto animate-scale-up sm:mt-[4vh]">
        {/* Header */}
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
              <h2 className="text-sm font-bold text-text-primary">Field Data Collection</h2>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                {vendor.business_name || vendor.contact_name} — {activeEdition?.name || 'Current Edition'}
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
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-xs font-medium">Loading form data…</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-text-secondary">{error}</p>
              </div>
              <button
                onClick={buildPrefillData}
                className="w-full text-xs font-bold text-text-secondary hover:text-text-primary bg-slate-100 hover:bg-slate-200 border border-border rounded-lg py-2 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Form */}
          {ready && formDataCache && !loading && (
            <div className="text-left">
              {Object.keys(prefillSource).length > 0 && (
                <div className="bg-slate-50 border border-border rounded-lg p-3 mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-accent" />
                    <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-wider">Pre-filled Fields</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(prefillSource).map(([field, source]) => (
                      <span
                        key={field}
                        className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${
                          source === 'registration'
                            ? 'bg-accent-soft text-accent border-accent/20'
                            : source === 'last_visit'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title={`${field}: ${
                          source === 'registration' ? 'from registration' :
                          source === 'last_visit' ? 'from last visit' :
                          'from both (registration + last visit)'
                        }`}
                      >
                        {field}
                        {source === 'registration' && ' (reg)'}
                        {source === 'last_visit' && ' (last)'}
                        {source === 'both' && ' (both)'}
                      </span>
                    ))}
                  </div>
                  <p className="text-[9px] text-text-tertiary mt-2 leading-relaxed">
                    <strong>reg</strong> = from paid registration &nbsp;|&nbsp;
                    <strong>last</strong> = from last visit &nbsp;|&nbsp;
                    <strong>both</strong> = in both sources (last visit value used)
                  </p>
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
                formIcon={<Database className="w-4 h-4 text-accent" />}
                formLabel="Field Data Collection"
                formSubtitle={`Collecting data for ${vendor.business_name || vendor.contact_name}`}
                countLabel="collecting"
                lookupEnabled={false}
                cachedData={formDataCache}
                initialAnswers={prefillAnswers}
                editMode={false}
              />
            </div>
          )}
        </div>
      </div>

      {duplicatePrompt && (
        <DuplicateConfirmModal
          isOpen={duplicatePrompt.isOpen}
          vendorName={duplicatePrompt.vendorName}
          editionName={duplicatePrompt.editionName}
          onConfirm={duplicatePrompt.onConfirm}
          onCancel={duplicatePrompt.onCancel}
        />
      )}
    </div>
  );
};
