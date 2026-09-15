'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { toPng } from 'html-to-image';
import {
  Check,
  Plus,
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink,
  WifiOff,
  CloudOff,
  Ticket,
  Copy,
  Printer,
  Download,
} from 'lucide-react';
import {
  TicketTemplate,
  RequiredTicketField,
  REQUIRED_TICKET_FIELDS,
} from '@/types/ticketTemplate';
import { formatTicketCode, normalizeTicketCode } from '@/utils/ticket';

function computeAdaptiveFontSize(
  text: string,
  baseSize: number,
  maxWidth?: number
): number {
  if (!maxWidth || !text || text.length === 0) return baseSize;
  const approxWidth = text.length * (baseSize * 0.58);
  if (approxWidth > maxWidth) {
    const ratio = maxWidth / approxWidth;
    const scaled = Math.floor(baseSize * ratio);
    return Math.max(11, Math.min(baseSize, scaled));
  }
  return baseSize;
}

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

interface QuestionLogic {
  id: string;
  source_question_id: string;
  operator: string;
  comparison_value: string;
  action: string;
  target_question_id: string;
}

interface SectionLogic {
  id: string;
  source_question_id: string;
  operator: string;
  comparison_value: string;
  action: string;
  target_section_id: string;
}

export interface FormDataCache {
  questions: FormQuestion[];
  sections: { id: string; name: string; sort_order: number }[];
  questionRules: QuestionLogic[];
  sectionRules: SectionLogic[];
  prefillDefaults?: Record<string, string>;
}

export interface DynamicQuickEntryFormProps {
  formSlug: string;
  activeEdition: { id: string; name: string } | null;
  onSubmit: (answers: Record<string, string>) => Promise<{ synced: boolean; message?: string; name?: string }>;
  onPhoneLookup?: (phone: string) => Promise<{ data: Record<string, string>; autofilledFields: string[] } | null>;
  successState: {
    show: boolean;
    name?: string;
    ticketData?: {
      ticketNumber: number;
      ticketCode: string;
      editionName: string;
      vendorName: string;
      businessName?: string;
      phone: string;
      category?: string;
      amountPaid?: number;
      paymentStatus?: string;
      registeredAt: string;
    };
    onAddAnother: () => void;
  };
  runningCount: number;
  formIcon: React.ReactNode;
  formLabel: string;
  formSubtitle?: string;
  countLabel: string;
  lookupEnabled?: boolean;
  cachedData?: FormDataCache;
  onFormDataCached?: (data: FormDataCache) => void;
  initialAnswers?: Record<string, string>;
  editMode?: boolean;
}

export const DynamicQuickEntryForm: React.FC<DynamicQuickEntryFormProps> = ({
  formSlug,
  activeEdition,
  onSubmit,
  onPhoneLookup,
  successState,
  runningCount,
  formIcon,
  formLabel,
  formSubtitle,
  countLabel,
  lookupEnabled = false,
  cachedData,
  onFormDataCached,
  initialAnswers,
  editMode = false,
}) => {
  const [questions, setQuestions] = useState<FormQuestion[]>(cachedData?.questions || []);
  const [sectionQuestions, setSectionQuestions] = useState<Record<string, FormQuestion[]>>({});
  const [sections, setSections] = useState<{ id: string; name: string; sort_order: number }[]>(cachedData?.sections || []);
  const [questionRules, setQuestionRules] = useState<QuestionLogic[]>(cachedData?.questionRules || []);
  const [sectionRules, setSectionRules] = useState<SectionLogic[]>(cachedData?.sectionRules || []);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [loading, setLoading] = useState(!cachedData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const ticketCardRef = useRef<HTMLDivElement>(null);
  const customTicketCardRef = useRef<HTMLDivElement>(null);
  const [ticketTemplate, setTicketTemplate] = useState<TicketTemplate | null>(null);
  const [templateScale, setTemplateScale] = useState<number>(1);

  // Fetch ticket template for current edition
  useEffect(() => {
    const editionId = activeEdition?.id;
    if (!editionId) return;

    fetch(`/api/tickets/templates?edition_id=${editionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.template && data.template.background_image_url) {
          setTicketTemplate(data.template);
        } else {
          setTicketTemplate(null);
        }
      })
      .catch((err) => {
        console.warn('Could not load custom ticket template, using default:', err);
        setTicketTemplate(null);
      });
  }, [activeEdition?.id]);

  // Update scaling ratio when container resizes
  useEffect(() => {
    const updateScale = () => {
      if (customTicketCardRef.current && ticketTemplate?.canvas_width) {
        const containerWidth = customTicketCardRef.current.clientWidth;
        if (containerWidth > 0) {
          setTemplateScale(containerWidth / ticketTemplate.canvas_width);
        }
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [ticketTemplate]);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'returning' | 'new'>('idle');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [autofilledFields, setAutofilledFields] = useState<Set<string>>(
    new Set(initialAnswers ? Object.keys(initialAnswers) : [])
  );
  const [prefillDefaults, setPrefillDefaults] = useState<Record<string, string>>(
    cachedData?.prefillDefaults || {}
  );
  const [defaultedFields, setDefaultedFields] = useState<Set<string>>(new Set());
  const [syncFeedback, setSyncFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [offlineSave, setOfflineSave] = useState<{ show: boolean; name?: string }>({ show: false });

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data: formData, error: fErr } = await supabase
        .from('forms')
        .select('id, prefill_defaults')
        .eq('slug', formSlug)
        .single();

      if (fErr || !formData) throw new Error(`Form not found: ${formSlug}`);

      const defaults = (formData.prefill_defaults || {}) as Record<string, string>;
      setPrefillDefaults(defaults);

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
          form_sections (
            name,
            sort_order
          )
        `)
        .eq('form_id', formData.id)
        .order('sort_order', { ascending: true });

      if (qErr) throw qErr;
      const qs = (qData || []) as unknown as FormQuestion[];
      setQuestions(qs);

      const secMap = new Map<string, { id: string; name: string; sort_order: number }>();
      qs.forEach(q => {
        if (q.section_id && q.form_sections && q.form_sections.length > 0) {
          const sec = q.form_sections[0];
          secMap.set(q.section_id, {
            id: q.section_id,
            name: sec.name,
            sort_order: sec.sort_order,
          });
        }
      });
      const secs = Array.from(secMap.values()).sort((a, b) => a.sort_order - b.sort_order);
      setSections(secs);

      const secQuestionsMap: Record<string, FormQuestion[]> = {};
      qs.forEach(q => {
        const secId = q.section_id || '__none__';
        if (!secQuestionsMap[secId]) secQuestionsMap[secId] = [];
        secQuestionsMap[secId].push(q);
      });
      setSectionQuestions(secQuestionsMap);

      let fetchedQL: QuestionLogic[] = [];
      let fetchedSL: SectionLogic[] = [];
      if (qs.length > 0) {
        const qIds = qs.map(q => q.id);
        const [{ data: qlData }, { data: slData }] = await Promise.all([
          supabase.from('question_logic').select('*').in('source_question_id', qIds),
          supabase.from('section_logic').select('*').in('source_question_id', qIds),
        ]);
        fetchedQL = qlData || [];
        fetchedSL = slData || [];
        setQuestionRules(fetchedQL);
        setSectionRules(fetchedSL);
      }

      if (onFormDataCached) {
        onFormDataCached({
          questions: qs,
          sections: secs,
          questionRules: fetchedQL,
          sectionRules: fetchedSL,
          prefillDefaults: defaults,
        });
      }
    } catch (err: unknown) {
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes('fetch') ||
            err.message.includes('network') ||
            err.message.includes('Failed to fetch')));
      if (isNetworkError && cachedData && questions.length > 0) {
        setLoadError(null);
      } else {
        console.error('Error loading form:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load form');
      }
    } finally {
      setLoading(false);
    }
  }, [formSlug, onFormDataCached, cachedData, questions.length]);

  useEffect(() => {
    if (cachedData && cachedData.questions.length > 0) {
      setQuestions(cachedData.questions);
      setSections(cachedData.sections);
      setQuestionRules(cachedData.questionRules);
      setSectionRules(cachedData.sectionRules);
      setPrefillDefaults(cachedData.prefillDefaults || {});
      setLoading(false);
      setLoadError(null);

      const secQuestionsMap: Record<string, FormQuestion[]> = {};
      cachedData.questions.forEach(q => {
        const secId = q.section_id || '__none__';
        if (!secQuestionsMap[secId]) secQuestionsMap[secId] = [];
        secQuestionsMap[secId].push(q);
      });
      setSectionQuestions(secQuestionsMap);
    }
  }, [cachedData]);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  const checkRuleCondition = useCallback((sourceQId: string, operator: string, compVal: string): boolean => {
    const sourceQuestion = questions.find(q => q.id === sourceQId);
    if (!sourceQuestion) return false;
    const answerVal = answers[sourceQuestion.csv_column] || '';
    const cleanAns = answerVal.toString().toLowerCase().trim();
    const cleanComp = compVal.toString().toLowerCase().trim();

    switch (operator) {
      case 'eq': return cleanAns === cleanComp;
      case 'neq': return cleanAns !== cleanComp;
      case 'gt': return Number(answerVal) > Number(compVal);
      case 'lt': return Number(answerVal) < Number(compVal);
      case 'gte': return Number(answerVal) >= Number(compVal);
      case 'lte': return Number(answerVal) <= Number(compVal);
      case 'contains': return cleanAns.includes(cleanComp);
      case 'is_answered': return answerVal !== '';
      case 'is_blank': return answerVal === '';
      default: return false;
    }
  }, [answers, questions]);

  const isSectionVisible = useCallback((sectionId: string): boolean => {
    const rules = sectionRules.filter(r => r.target_section_id === sectionId);
    if (rules.length === 0) return true;

    const hideRules = rules.filter(r => r.action === 'hide');
    if (hideRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value))) {
      return false;
    }

    const showRules = rules.filter(r => r.action === 'show');
    if (showRules.length > 0) {
      return showRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value));
    }

    return true;
  }, [sectionRules, checkRuleCondition]);

  const isQuestionVisible = useCallback((q: FormQuestion): boolean => {
    if (q.section_id && !isSectionVisible(q.section_id)) return false;

    const rules = questionRules.filter(r => r.target_question_id === q.id);
    if (rules.length === 0) return true;

    const hideRules = rules.filter(r => r.action === 'hide');
    if (hideRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value))) {
      return false;
    }

    const showRules = rules.filter(r => r.action === 'show');
    if (showRules.length > 0) {
      return showRules.some(r => checkRuleCondition(r.source_question_id, r.operator, r.comparison_value));
    }

    return true;
  }, [questionRules, isSectionVisible, checkRuleCondition]);

  // Apply admin-set defaults to any visible question whose answer is still
  // empty. Re-runs as answers change so conditionally-shown questions (e.g.
  // "How many employees?" when "paid employees" is set to Yes) get pre-filled
  // the moment they become visible. Fields with a value are left untouched.
  useEffect(() => {
    if (questions.length === 0) return;
    const keys = Object.keys(prefillDefaults);
    if (keys.length === 0) return;

    const qByColumn = new Map(questions.map(q => [q.csv_column, q]));
    const toApply: string[] = [];
    for (const csvColumn of keys) {
      const q = qByColumn.get(csvColumn);
      if (!q) continue;
      if (touchedFields.has(csvColumn)) continue;
      const current = answers[csvColumn];
      if (current !== undefined && current !== '') continue;
      if (isQuestionVisible(q)) toApply.push(csvColumn);
    }

    if (toApply.length === 0) return;

    setAnswers(prev => {
      const next = { ...prev };
      let changed = false;
      for (const csvColumn of toApply) {
        if (next[csvColumn] === undefined || next[csvColumn] === '') {
          next[csvColumn] = prefillDefaults[csvColumn];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setDefaultedFields(prev => {
      const next = new Set(prev);
      for (const csvColumn of toApply) next.add(csvColumn);
      return next;
    });
  }, [questions, prefillDefaults, answers, touchedFields, isQuestionVisible]);

  const handleAnswerChange = (csvColumn: string, value: string) => {
    setAnswers(prev => ({ ...prev, [csvColumn]: value }));
    setValidationErrors([]);
    setTouchedFields(prev => {
      const next = new Set(prev);
      next.add(csvColumn);
      return next;
    });
    setAutofilledFields(prev => {
      const next = new Set(prev);
      next.delete(csvColumn);
      return next;
    });
    setDefaultedFields(prev => {
      const next = new Set(prev);
      next.delete(csvColumn);
      return next;
    });

    if ((csvColumn === 'phone' || csvColumn === 'phone_number') && lookupEnabled && onPhoneLookup && !editMode) {
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 9) {
        setLookupStatus('searching');
        onPhoneLookup(digits).then(result => {
          if (result) {
            setLookupStatus('returning');
            setAnswers(prev => ({ ...prev, ...result.data }));
            setAutofilledFields(new Set(result.autofilledFields));
          } else {
            setLookupStatus('new');
          }
        }).catch(() => {
          setLookupStatus('new');
        });
      } else {
        setLookupStatus('idle');
      }
    }
  };

  const handleMultiSelectChange = (csvColumn: string, option: string, checked: boolean) => {
    const currentVal = answers[csvColumn] || '';
    const selected = currentVal ? currentVal.split('||') : [];
    let updated: string[];
    if (checked) {
      updated = [...selected, option];
    } else {
      updated = selected.filter(o => o !== option);
    }
    setAnswers(prev => ({ ...prev, [csvColumn]: updated.join('||') }));
    setValidationErrors([]);
    setDefaultedFields(prev => {
      const next = new Set(prev);
      next.delete(csvColumn);
      return next;
    });
  };

  const handleFieldBlur = (csvColumn: string) => {
    setTouchedFields(prev => {
      const next = new Set(prev);
      next.add(csvColumn);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEdition) return;

    const errors: string[] = [];
    questions.filter(q => isQuestionVisible(q)).forEach(q => {
      if (q.is_required && !answers[q.csv_column]) {
        errors.push(`${q.question_text} is required`);
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    setSyncFeedback(null);
    try {
      // Only submit answers for questions that are actually visible, so
      // hidden (skipped) questions don't submit their pre-filled defaults.
      const visibleAnswers: Record<string, string> = {};
      questions.filter(q => isQuestionVisible(q)).forEach(q => {
        const val = answers[q.csv_column];
        if (val !== undefined && val !== '') {
          visibleAnswers[q.csv_column] = val;
        }
      });
      const result = await onSubmit(visibleAnswers);
      if (!result.synced) {
        const name = result.name ||
          answers.contact_name || answers.full_name || answers.name || '';
        setAnswers({});
        setValidationErrors([]);
        setTouchedFields(new Set());
        setLookupStatus('idle');
        setSyncFeedback(null);
        setOfflineSave({ show: true, name: name || 'New Entry' });
      }
    } catch (err: unknown) {
      let errMsg = 'Submission error';
      if (err instanceof Error) {
        errMsg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errMsg = (err as any).message || errMsg;
      }

      const isNetworkError =
        err instanceof TypeError ||
        (typeof errMsg === 'string' &&
          (errMsg.includes('fetch') ||
            errMsg.includes('network') ||
            errMsg.includes('Failed to fetch')));
      if (isNetworkError) {
        const name = answers.contact_name || answers.full_name || answers.name || '';
        setAnswers({});
        setValidationErrors([]);
        setTouchedFields(new Set());
        setLookupStatus('idle');
        setSyncFeedback(null);
        setOfflineSave({ show: true, name: name || 'New Entry' });
      } else {
        setSyncFeedback({
          message: errMsg,
          type: 'error',
        });
        console.warn('Submit error:', errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAnswers({});
    setValidationErrors([]);
    setLookupStatus('idle');
    setSyncFeedback(null);
    setOfflineSave({ show: false });
    setTouchedFields(new Set());
    setAutofilledFields(new Set());
    setDefaultedFields(new Set());
    successState.onAddAnother();
  };

  const resetOfflineForm = () => {
    setAnswers({});
    setValidationErrors([]);
    setLookupStatus('idle');
    setSyncFeedback(null);
    setOfflineSave({ show: false });
    setTouchedFields(new Set());
    setAutofilledFields(new Set());
    setDefaultedFields(new Set());
    (window as unknown as { _offlineCountIncrement?: () => void })._offlineCountIncrement?.();
  };

  if (offlineSave.show) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[380px] select-none text-left">
        <div className="w-16 h-16 bg-amber/10 text-amber rounded-full flex items-center justify-center mb-5">
          <CloudOff className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Saved Offline</h3>
        <p className="text-xs text-text-secondary mb-2 max-w-[280px]">
          Recorded <span className="text-amber font-bold">{offlineSave.name || 'New Entry'}</span> locally.
        </p>
        <p className="text-[10px] text-amber bg-amber/10 border border-amber/20 rounded px-3 py-1.5 mb-6 max-w-[280px]">
          Pending sync — will upload automatically when back online
        </p>
        <Button variant="primary" onClick={resetOfflineForm} className="w-full">
          <Plus className="w-4 h-4 text-white" />
          <span>Add Another Entry</span>
        </Button>
      </div>
    );
  }

  if (successState.show) {
    if (formSlug === 'paid_vendor_registration' || successState.ticketData) {
      const ticket = successState.ticketData || {
        ticketNumber: runningCount || 1,
        ticketCode: formatTicketCode(runningCount || 1),
        editionName: activeEdition?.name || 'Event Edition',
        vendorName: successState.name || 'Confirmed Vendor',
        businessName: '',
        phone: '',
        category: '',
        amountPaid: undefined,
        paymentStatus: 'paid',
        registeredAt: new Date().toISOString(),
      };

      const ticketCode = normalizeTicketCode(ticket.ticketCode) || ticket.ticketCode;

      const fieldValues: Record<RequiredTicketField, string> = {
        vendor_name: ticket.vendorName || '',
        business_name: ticket.businessName || '',
        category: ticket.category || '',
        phone_number: ticket.phone || '',
                ticket_number: ticketCode,
        issued_at: new Date(ticket.registeredAt).toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      };

      const handleDownloadImage = async () => {
        setDownloadingImage(true);
        try {
          // If custom template is active, try downloading pristine server-rendered PNG
          if (ticketTemplate && (activeEdition?.id || ticket.editionName)) {
            try {
              const params = new URLSearchParams({
                edition_id: activeEdition?.id || '',
        ticket_number: ticketCode,
                vendor_name: ticket.vendorName || '',
                business_name: ticket.businessName || '',
                category: ticket.category || '',
                phone: ticket.phone || '',
                edition_name: ticket.editionName || '',
                issued_at: ticket.registeredAt || '',
              });
              const res = await fetch(`/api/tickets/render?${params.toString()}`);
              if (res.ok) {
                const blob = await res.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `Vendor-Pass-${ticketCode || 'Ticket'}.png`;
                link.href = blobUrl;
                link.click();
                window.URL.revokeObjectURL(blobUrl);
                return;
              }
            } catch (serverErr) {
              console.warn('Server render failed, falling back to client canvas:', serverErr);
            }
          }

          // Fallback to client-side toPng
          const target = ticketTemplate ? customTicketCardRef.current : ticketCardRef.current;
          if (!target) return;

          const dataUrl = await toPng(target, {
            quality: 1,
            pixelRatio: 2,
            backgroundColor: '#161b22',
          });
          const link = document.createElement('a');
          link.download = `Vendor-Pass-${ticketCode || 'Ticket'}.png`;
          link.href = dataUrl;
          link.click();
        } catch (err) {
          console.error('Failed to download ticket image:', err);
        } finally {
          setDownloadingImage(false);
        }
      };

      return (
        <div className="space-y-4 max-w-[560px] mx-auto animate-fade-in select-none">
          {/* Downloadable Ticket Card (Custom Template or Fallback Default) */}
          {ticketTemplate && ticketTemplate.background_image_url ? (
            <div
              ref={customTicketCardRef}
              className="relative rounded-xl overflow-hidden shadow-2xl border border-border/80 w-full select-none"
              style={{
                height: `${(ticketTemplate.canvas_height || 1080) * templateScale}px`,
              }}
            >
              {/* Background Art */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ticketTemplate.background_image_url}
                alt="Official Vendor Admission Pass"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />

              {/* Dynamic Vendor Fields */}
              {REQUIRED_TICKET_FIELDS.map((field) => {
                const pos = ticketTemplate.field_positions?.[field];
                if (!pos) return null;
                const text = fieldValues[field];
                if (!text) return null;

                const scaledX = pos.x * templateScale;
                const scaledY = pos.y * templateScale;
                const adaptiveSize = computeAdaptiveFontSize(text, pos.fontSize || 18, pos.maxWidth);
                const scaledFontSize = Math.max(8, adaptiveSize * templateScale);
                const scaledMaxWidth = pos.maxWidth ? pos.maxWidth * templateScale : undefined;

                return (
                  <div
                    key={field}
                    style={{
                      position: 'absolute',
                      left: `${scaledX}px`,
                      top: `${scaledY}px`,
                      fontSize: `${scaledFontSize}px`,
                      color: pos.color || '#000000',
                      fontWeight: (pos.fontWeight === 'bold' || pos.fontWeight === '700'
                        ? 700
                        : pos.fontWeight === 'semibold' || pos.fontWeight === '600'
                        ? 600
                        : 400) as any,
                      maxWidth: scaledMaxWidth ? `${scaledMaxWidth}px` : undefined,
                      lineHeight: 1.25,
                      wordBreak: 'break-word',
                      display: 'flex',
                      flexWrap: 'wrap',
                    }}
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              ref={ticketCardRef}
              className="bg-bg-surface border border-green/30 rounded-xl p-6 sm:p-8 text-left shadow-2xl relative overflow-hidden"
            >
              {/* Decorative Glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-green/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-green/5 rounded-full blur-3xl pointer-events-none" />

              {/* Ticket Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border-light relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-green/15 border border-green/30 flex items-center justify-center text-green">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-green uppercase tracking-widest block">Official Vendor Pass</span>
                    <h2 className="text-sm font-bold text-text-primary">{ticket.editionName}</h2>
                  </div>
                </div>
                <Badge variant="success" size="sm" className="font-mono text-xs uppercase font-extrabold tracking-wider">
                  {ticket.paymentStatus || 'Confirmed'}
                </Badge>
              </div>

              {/* Ticket Number Hero Box */}
              <div className="my-6 p-5 bg-slate-50 border border-border rounded-xl text-center relative z-10 shadow-sm">
                <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-semibold block mb-1">
                  Admission Ticket Number
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-accent tracking-wider my-1">
                  {ticketCode}
                </div>
                <p className="text-[11px] text-text-secondary">
                  Vendor #{ticket.ticketNumber} &middot; Registered for this edition
                </p>
              </div>

              {/* Ticket Details Grid */}
              <div className="space-y-2.5 bg-bg-input/60 border border-border/50 rounded-lg p-4 text-xs relative z-10">
                <div className="flex justify-between items-center py-1 border-b border-border/30">
                  <span className="text-text-tertiary">Vendor Name</span>
                  <span className="font-semibold text-text-primary">{ticket.vendorName}</span>
                </div>
                {ticket.businessName && (
                  <div className="flex justify-between items-center py-1 border-b border-border/30">
                    <span className="text-text-tertiary">Business</span>
                    <span className="font-semibold text-text-primary">{ticket.businessName}</span>
                  </div>
                )}
                {ticket.category && (
                  <div className="flex justify-between items-center py-1 border-b border-border/30">
                    <span className="text-text-tertiary">Category</span>
                    <span className="font-semibold text-text-primary">{ticket.category}</span>
                  </div>
                )}
                {ticket.phone && (
                  <div className="flex justify-between items-center py-1 border-b border-border/30">
                    <span className="text-text-tertiary">Phone Number</span>
                    <span className="font-mono font-medium text-text-secondary">{ticket.phone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-tertiary">Issued At</span>
                  <span className="font-mono text-[11px] text-text-secondary">
                    {new Date(ticket.registeredAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              {/* Barcode Graphic */}
              <div className="pt-5 mt-4 border-t border-border/40 flex flex-col items-center justify-center opacity-80 select-none relative z-10">
                <div className="h-8 flex items-end gap-1">
                  {[3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3, 3, 8, 3, 2, 7, 9, 5, 0, 2, 8, 8, 4, 1, 9, 7, 1, 6, 9, 3, 9, 9, 3, 7].map((h, i) => (
                    <span
                      key={i}
                      className="w-0.5 bg-green/60 inline-block"
                      style={{ height: `${12 + (h % 5) * 4}px` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[9px] tracking-widest text-text-tertiary mt-1">
                  {ticketCode} &bull; QUONNECT ADMISSION PASS
                </span>
              </div>
            </div>
          )}

          {/* Single-Use Warning & Actions (outside downloaded card) */}
          <div className="space-y-3">
            <div className="p-3 bg-amber/10 border border-amber/20 rounded-md text-[11px] text-amber flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Single-Use Link Closed:</strong> This registration link has now expired and cannot be reused. Download or screenshot this pass for event day check-in.
              </span>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                onClick={handleDownloadImage}
                disabled={downloadingImage}
                className="flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
              >
                {downloadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{downloadingImage ? 'Generating Image...' : 'Download Ticket (Image)'}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.print()}
                className="py-3 px-4 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(ticketCode);
                  setCopiedTicket(true);
                  setTimeout(() => setCopiedTicket(false), 2000);
                }}
                className="py-3 px-4 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                {copiedTicket ? <Check className="w-4 h-4 text-green" /> : <Copy className="w-4 h-4" />}
                <span>{copiedTicket ? 'Copied!' : 'Copy Code'}</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-bg-surface border border-border rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[380px] select-none text-left">
        <div className="w-16 h-16 bg-green-muted text-green rounded-full flex items-center justify-center mb-5 animate-pulse">
          <Check className="w-8 h-8 stroke-[3]" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Entry Saved Successfully!</h3>
        <p className="text-xs text-text-secondary mb-6 max-w-[280px]">
          Recorded <span className="text-green font-bold">{successState.name || 'New Entry'}</span> for this edition.
        </p>
        <Button variant="primary" onClick={resetForm} className="w-full">
          <Plus className="w-4 h-4 text-white" />
          <span>Add Another Entry</span>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg p-8 flex flex-col items-center justify-center min-h-[300px] select-none">
        <Loader2 className="w-8 h-8 animate-spin text-green mb-3" />
        <span className="text-xs text-text-secondary">Loading form questions...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[300px] select-none">
        <AlertCircle className="w-10 h-10 text-red mb-3" />
        <h3 className="text-sm font-bold text-text-primary mb-1">Form Load Error</h3>
        <p className="text-xs text-text-secondary mb-4">{loadError}</p>
        <Button variant="secondary" size="sm" onClick={fetchFormData}>
          Retry
        </Button>
      </div>
    );
  }

  const renderQuestionField = (q: FormQuestion) => {
    const value = answers[q.csv_column] || '';

    switch (q.question_type) {
      case 'boolean':
        return (
          <div className="flex gap-2">
            {['Yes', 'No'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => handleAnswerChange(q.csv_column, opt)}
                className={`flex-1 py-2 rounded-md font-semibold text-xs border transition-all cursor-pointer ${
                  value === opt
                    ? 'bg-accent text-white border-accent font-bold shadow-xs'
                    : 'bg-white text-text-secondary border-border hover:text-text-primary hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case 'select': {
        const options = q.options || [];
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(q.csv_column, e.target.value)}
            className="w-full bg-white border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans transition-colors outline-none"
            required={q.is_required}
          >
            <option value="">Select an option...</option>
            {[...new Set(options)].map((opt: string, index: number) => (
              <option key={`${opt}-${index}`} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }

      case 'multi_select': {
        const options = q.options || [];
        const selected = value ? value.split('||') : [];
        return (
          <div className="space-y-1.5">
            {[...new Set(options)].map((opt: string, index: number) => (
              <label key={`${opt}-${index}`} className="flex items-center gap-2 text-xs text-text-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={(e) => handleMultiSelectChange(q.csv_column, opt, e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );
      }

      case 'number':
        return (
          <input
            type="number"
            placeholder={`Enter ${q.question_text.toLowerCase()}`}
            value={value}
            onChange={(e) => handleAnswerChange(q.csv_column, e.target.value)}
            className="w-full bg-white border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
            required={q.is_required}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleAnswerChange(q.csv_column, e.target.value)}
            className="w-full bg-white border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
            required={q.is_required}
          />
        );

      case 'scale': {
        const rating = Number(value) || 0;
        return (
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const rv = i + 1;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswerChange(q.csv_column, String(rv))}
                  className="cursor-pointer focus:outline-none select-none transition-transform active:scale-90"
                >
                  <svg
                    className={`w-6 h-6 transition-colors ${rv <= rating ? 'text-amber fill-amber' : 'text-text-muted hover:text-amber/60'}`}
                    viewBox="0 0 24 24"
                    fill={rv <= rating ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              );
            })}
            {rating > 0 && <span className="text-xs font-bold text-amber ml-2">{rating}/5</span>}
          </div>
        );
      }

      case 'text':
      default:
        return (
          <input
            type={q.csv_column === 'phone' || q.csv_column === 'phone_number' ? 'tel' : q.csv_column === 'email' ? 'email' : 'text'}
            placeholder={`Enter ${q.question_text.toLowerCase()}`}
            value={value}
            onChange={(e) => handleAnswerChange(q.csv_column, e.target.value)}
            className={`w-full bg-white border border-border focus:border-accent focus:ring-1 focus:ring-accent rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none ${(q.csv_column === 'phone' || q.csv_column === 'phone_number') ? 'font-bold tracking-wider' : ''}`}
            required={q.is_required}
          />
        );
    }
  };

  return (
    <div className="bg-white border border-border rounded-xl shadow-xs p-5 max-w-[560px] mx-auto text-left relative select-none">
      <div className="flex justify-between items-center border-b border-border pb-4 mb-5">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
            {formIcon}
            {formLabel}
          </h3>
          {formSubtitle && (
            <span className="text-[10px] text-text-tertiary font-medium mt-0.5">{formSubtitle}</span>
          )}
        </div>
        <Badge variant="info" size="sm" className="font-extrabold text-[11px] select-none">
          {runningCount} {countLabel}
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {lookupEnabled && lookupStatus === 'searching' && (
          <div className="flex items-center gap-2 text-xs text-text-secondary animate-pulse p-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Looking up phone number...</span>
          </div>
        )}

        {lookupStatus === 'returning' && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md p-3.5 flex items-start gap-2.5 animate-fade-in select-none">
            <Sparkles className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">Returning Record Found</strong>
              <span className="text-text-secondary font-medium">Existing details loaded. Review and edit below.</span>
            </div>
          </div>
        )}

        {lookupStatus === 'new' && (
          <div className="bg-sky-50 border border-sky-200 text-sky-700 rounded-md p-3.5 flex items-start gap-2.5 animate-fade-in select-none">
            <AlertCircle className="w-4.5 h-4.5 text-accent shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">New Entry</strong>
              <span className="text-text-secondary font-medium">No record found with this phone number. Complete all details.</span>
            </div>
          </div>
        )}

        {syncFeedback && (
          <div
            className={`rounded-md p-3.5 flex items-start gap-2.5 animate-fade-in select-none ${
              syncFeedback.type === 'info'
                ? 'bg-amber/10 border border-amber/20 text-amber'
                : syncFeedback.type === 'error'
                  ? 'bg-red-soft/10 border border-red/20 text-red'
                  : 'bg-green-soft border border-green/20 text-green'
            }`}
          >
            {syncFeedback.type === 'info' ? (
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            ) : syncFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">
                {syncFeedback.type === 'info' ? 'Offline Mode' : syncFeedback.type === 'error' ? 'Error' : 'Synced'}
              </strong>
              <span className="text-text-secondary font-medium">{syncFeedback.message}</span>
            </div>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="bg-red-soft/10 border border-red/20 rounded-md p-3 animate-fade-in">
            {validationErrors.map((err, i) => (
              <p key={i} className="text-[11px] text-red flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{err}</span>
              </p>
            ))}
          </div>
        )}

        {sections.length === 0 ? (
          <div className="space-y-4">
            {questions
              .filter(q => isQuestionVisible(q))
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(q => (
                <QuestionField
                  key={q.id}
                  question={q}
                  renderField={renderQuestionField}
                  isTouched={touchedFields.has(q.csv_column)}
                  hasError={!answers[q.csv_column]}
                  isPrefilled={autofilledFields.has(q.csv_column)}
                  isDefault={defaultedFields.has(q.csv_column)}
                  onFieldBlur={() => handleFieldBlur(q.csv_column)}
                />
              ))}
          </div>
        ) : (
          sections.filter(s => isSectionVisible(s.id)).map(section => {
            const secQs = (sectionQuestions[section.id] || [])
              .filter(q => isQuestionVisible(q))
              .sort((a, b) => a.sort_order - b.sort_order);

            if (secQs.length === 0) return null;

            return (
              <div key={section.id} className="space-y-4">
                <h4 className="text-[10px] font-bold text-green uppercase tracking-wider border-b border-border pb-1">
                  {section.name}
                </h4>
                {secQs.map(q => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    renderField={renderQuestionField}
                    isTouched={touchedFields.has(q.csv_column)}
                    hasError={!answers[q.csv_column]}
                    isPrefilled={autofilledFields.has(q.csv_column)}
                    onFieldBlur={() => handleFieldBlur(q.csv_column)}
                  />
                ))}
              </div>
            );
          })
        )}

        {sections.length > 0 && sectionQuestions['__none__'] && sectionQuestions['__none__'].filter(q => isQuestionVisible(q)).length > 0 && (
          <div className="space-y-4">
            {sectionQuestions['__none__'].filter(q => isQuestionVisible(q)).sort((a, b) => a.sort_order - b.sort_order).map(q => (
              <QuestionField
                key={q.id}
                question={q}
                renderField={renderQuestionField}
                isTouched={touchedFields.has(q.csv_column)}
                hasError={!answers[q.csv_column]}
                isPrefilled={autofilledFields.has(q.csv_column)}
                onFieldBlur={() => handleFieldBlur(q.csv_column)}
              />
            ))}
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            disabled={submitting}
            className="py-3.5 text-xs tracking-wider font-extrabold"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                Saving...
              </span>
            ) : editMode ? (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-white" />
                Save Changes
              </span>
            ) : (
              <span>Save Entry</span>
            )}
          </Button>
        </div>
      </form>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-center">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            const event = new CustomEvent('navigate-to-form-builder', { detail: { formSlug } });
            window.dispatchEvent(event);
          }}
          className="text-[10px] text-text-tertiary hover:text-green flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Form questions are managed in Form Builder</span>
        </a>
      </div>
    </div>
  );
};

const QuestionField: React.FC<{
  question: FormQuestion;
  renderField: (q: FormQuestion) => React.ReactNode;
  isTouched?: boolean;
  hasError?: boolean;
  isPrefilled?: boolean;
  isDefault?: boolean;
  onFieldBlur?: () => void;
}> = ({ question, renderField, isTouched, hasError, isPrefilled, isDefault, onFieldBlur }) => {
  const showError = isTouched && hasError && question.is_required;
  return (
    <div onBlur={onFieldBlur}>
      <label className={`text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between mb-1.5 select-none ${showError ? 'text-red' : 'text-text-tertiary'}`}>
        <span className="flex items-center gap-1.5">
          {question.question_text}
          {isDefault && (
            <span className="text-[9px] font-medium text-blue bg-blue/10 px-1.5 py-0.5 rounded uppercase border border-blue/20">
              Default
            </span>
          )}
          {isPrefilled && (
            <span className="text-[9px] font-medium text-amber bg-amber/10 px-1.5 py-0.5 rounded uppercase border border-amber/20">
              Pre-filled
            </span>
          )}
        </span>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded uppercase ${showError ? 'text-red bg-red/10' : 'text-text-muted bg-bg-hover'}`}>
          {question.is_required ? 'Required' : 'Optional'}
        </span>
      </label>
      <div className={showError ? '[&_input]:border-red [&_select]:border-red [&_button]:border-red' : ''}>
        {renderField(question)}
      </div>
      {showError && (
        <p className="text-[10px] text-red mt-1">This field is required</p>
      )}
    </div>
  );
};
