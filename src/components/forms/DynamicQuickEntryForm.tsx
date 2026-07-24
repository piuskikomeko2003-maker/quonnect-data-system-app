'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Check,
  Plus,
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink
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

export interface DynamicQuickEntryFormProps {
  formSlug: string;
  activeEdition: { id: string; name: string } | null;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  onPhoneLookup?: (phone: string) => Promise<Record<string, string> | null>;
  successState: {
    show: boolean;
    name?: string;
    onAddAnother: () => void;
  };
  runningCount: number;
  formIcon: React.ReactNode;
  formLabel: string;
  formSubtitle?: string;
  countLabel: string;
  lookupEnabled?: boolean;
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
}) => {
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [sectionQuestions, setSectionQuestions] = useState<Record<string, FormQuestion[]>>({});
  const [sections, setSections] = useState<{ id: string; name: string; sort_order: number }[]>([]);
  const [questionRules, setQuestionRules] = useState<QuestionLogic[]>([]);
  const [sectionRules, setSectionRules] = useState<SectionLogic[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'returning' | 'new'>('idle');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data: formData, error: fErr } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', formSlug)
        .single();

      if (fErr || !formData) throw new Error(`Form not found: ${formSlug}`);

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
            sort_order: sec.sort_order
          });
        }
      });
      setSections(Array.from(secMap.values()).sort((a, b) => a.sort_order - b.sort_order));

      const secQuestionsMap: Record<string, FormQuestion[]> = {};
      qs.forEach(q => {
        const secId = q.section_id || '__none__';
        if (!secQuestionsMap[secId]) secQuestionsMap[secId] = [];
        secQuestionsMap[secId].push(q);
      });
      setSectionQuestions(secQuestionsMap);

      if (qs.length > 0) {
        const qIds = qs.map(q => q.id);
        const [{ data: qlData }, { data: slData }] = await Promise.all([
          supabase.from('question_logic').select('*').in('source_question_id', qIds),
          supabase.from('section_logic').select('*').in('source_question_id', qIds)
        ]);
        setQuestionRules(qlData || []);
        setSectionRules(slData || []);
      }
    } catch (err: unknown) {
      console.error('Error loading form:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [formSlug]);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  const checkRuleCondition = useCallback((sourceQId: string, operator: string, compVal: string): boolean => {
    const answerVal = answers[sourceQId] || '';
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
  }, [answers]);

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

  const handleAnswerChange = (csvColumn: string, value: string) => {
    setAnswers(prev => ({ ...prev, [csvColumn]: value }));
    setValidationErrors([]);

    if ((csvColumn === 'phone' || csvColumn === 'phone_number') && lookupEnabled && onPhoneLookup) {
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 9) {
        setLookupStatus('searching');
        onPhoneLookup(digits).then(result => {
          if (result) {
            setLookupStatus('returning');
            setAnswers(prev => ({ ...prev, ...result }));
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
    try {
      await onSubmit(answers);
    } catch (err: unknown) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAnswers({});
    setValidationErrors([]);
    setLookupStatus('idle');
    successState.onAddAnother();
  };

  if (successState.show) {
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
          <Plus className="w-4 h-4 text-black" />
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
                    ? 'bg-green text-black border-green font-bold'
                    : 'bg-bg-input text-text-secondary border-border-light hover:text-text-primary'
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
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans transition-colors outline-none"
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
                  className="w-3.5 h-3.5 rounded border-border-light accent-green cursor-pointer"
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
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
            required={q.is_required}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleAnswerChange(q.csv_column, e.target.value)}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
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
            className={`w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none ${(q.csv_column === 'phone' || q.csv_column === 'phone_number') ? 'font-bold tracking-wider' : ''}`}
            required={q.is_required}
          />
        );
    }
  };

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5 max-w-[560px] mx-auto text-left relative select-none">
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
          <div className="bg-green-soft border border-green/20 text-green rounded-md p-3.5 flex items-start gap-2.5 animate-fade-in select-none">
            <Sparkles className="w-4.5 h-4.5 text-green shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">Returning Record Found</strong>
              <span className="text-text-secondary font-medium">Existing details loaded. Review and edit below.</span>
            </div>
          </div>
        )}

        {lookupStatus === 'new' && (
          <div className="bg-blue-muted border border-blue/20 text-blue rounded-md p-3.5 flex items-start gap-2.5 animate-fade-in select-none">
            <AlertCircle className="w-4.5 h-4.5 text-blue shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">New Entry</strong>
              <span className="text-text-secondary font-medium">No record found with this phone number. Complete all details.</span>
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
            {questions.filter(q => isQuestionVisible(q)).map(q => (
              <QuestionField
                key={q.id}
                question={q}
                renderField={renderQuestionField}
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
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                Saving...
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
}> = ({ question, renderField }) => {
  return (
    <div>
      <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center justify-between mb-1.5 select-none">
        <span>{question.question_text}</span>
        <span className="text-[9px] font-medium text-text-muted bg-bg-hover px-1.5 py-0.5 rounded uppercase">
          {question.is_required ? 'Required' : 'Optional'}
        </span>
      </label>
      {renderField(question)}
    </div>
  );
};
