'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  db,
  saveSubmission,
  getPendingSubmissions,
  getSubmissionCounts,
  markSynced,
  cacheSchema,
  getCachedSchema,
} from '@/lib/db';
import type { Submission, CachedSchema } from '@/lib/db';
import { DynamicQuickEntryForm, type FormDataCache } from '@/components/forms/DynamicQuickEntryForm';
import { Users, Database, Footprints, Loader2, AlertCircle, WifiOff, CloudOff, RefreshCw, Clock } from 'lucide-react';

const AUTOFILL_FIELDS = new Set([
  'full_name',
  'business_name',
  'phone_number',
  'phone',
  'email',
  'gender',
  'age',
  'business_category',
  'how_long_in_business',
  'primary_source_of_income',
  'products_primarily_from',
  'business_operates_as',
  'active_social_media',
  'online_sales',
]);

// Change to 'latest_closed_edition' to look back only at completed editions
type AutofillLookback = 'latest_any_edition' | 'latest_closed_edition';
const AUTOFILL_LOOKBACK: AutofillLookback = 'latest_any_edition';

interface LinkData {
  token: string;
  form_slug: string;
  edition_id: string;
}

interface EditionData {
  id: string;
  name: string;
}

const FORM_CONFIG: Record<string, {
  label: string;
  subtitle: string;
  countLabel: string;
  icon: React.ReactNode;
  lookupEnabled: boolean;
}> = {
  paid_vendor_registration: {
    label: 'Paid Vendor Registration',
    subtitle: 'Register confirmed/paid vendors',
    countLabel: 'vendors registered',
    icon: <Users className="w-4 h-4 text-green" />,
    lookupEnabled: true,
  },
  vendor_data_collection: {
    label: 'Field Data Collection',
    subtitle: 'Impact & Demographics Sheet',
    countLabel: 'profiles collected',
    icon: <Database className="w-4 h-4 text-green" />,
    lookupEnabled: true,
  },
  walkin_registration: {
    label: 'Walk-in Guest Registry',
    subtitle: 'Optimized for speed entry',
    countLabel: 'walk-ins entered',
    icon: <Footprints className="w-4 h-4 text-green" />,
    lookupEnabled: false,
  },
};

export default function CollectPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [edition, setEdition] = useState<EditionData | null>(null);
  const [runningCount, setRunningCount] = useState(0);
  const [syncCounts, setSyncCounts] = useState({ pending: 0, synced: 0 });
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cachedFormData, setCachedFormData] = useState<Partial<CachedSchema> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const linkDataRef = useRef<LinkData | null>(null);
  const editionRef = useRef<EditionData | null>(null);

  const [successState, setSuccessState] = useState<{
    show: boolean;
    name?: string;
    onAddAnother: () => void;
  }>({ show: false, name: undefined, onAddAnother: () => {} });

  useEffect(() => {
    setSuccessState(prev => ({
      ...prev,
      onAddAnother: () => {
        setRunningCount(c => c + 1);
        setSuccessState({ show: false, name: undefined, onAddAnother: () => {} });
      },
    }));
  }, []);

  const syncPendingSubmissions = useCallback(async (showFeedback = false) => {
    if (!token) return;
    const supabase = createClient();
    if (!supabase) return;

    const pending = await getPendingSubmissions(token);
    if (pending.length === 0) {
      setPendingSubmissions([]);
      return;
    }

    setPendingSubmissions(pending);

    const currentLinkData = linkDataRef.current;
    const currentEdition = editionRef.current;
    if (!currentLinkData || !currentEdition) return;

    if (showFeedback) setSyncing(true);

    let synced = false;
    for (const sub of pending) {
      try {
        await replaySubmission(supabase, sub, currentEdition, currentLinkData);
        await markSynced(sub.id);
        synced = true;
      } catch (err) {
        console.error('Sync retry failed for submission:', sub.id, err);
      }
    }

    if (synced) {
      const counts = await getSubmissionCounts(token);
      setSyncCounts(counts);
      setRunningCount(c => c);
      const remaining = await getPendingSubmissions(token);
      setPendingSubmissions(remaining);
    }

    if (showFeedback) setSyncing(false);
  }, [token]);

  useEffect(() => {
    linkDataRef.current = linkData;
    editionRef.current = edition;
  }, [linkData, edition]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingSubmissions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingSubmissions]);

  useEffect(() => {
    const jitter = Math.floor(Math.random() * 10000) + 25000;
    syncIntervalRef.current = setInterval(() => {
      syncPendingSubmissions();
    }, jitter);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [syncPendingSubmissions]);

  const retrySingleSubmission = useCallback(async (submission: Submission) => {
    if (!token) return;
    const supabase = createClient();
    if (!supabase) return;

    const currentLinkData = linkDataRef.current;
    const currentEdition = editionRef.current;
    if (!currentLinkData || !currentEdition) return;

    setSyncing(true);
    try {
      await replaySubmission(supabase, submission, currentEdition, currentLinkData);
      await markSynced(submission.id);
      const counts = await getSubmissionCounts(token);
      setSyncCounts(counts);
      setRunningCount(c => c);
      const remaining = await getPendingSubmissions(token);
      setPendingSubmissions(remaining);
    } catch (err) {
      console.error('Retry single failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [token]);

  const manualSyncAll = useCallback(async () => {
    await syncPendingSubmissions(true);
  }, [syncPendingSubmissions]);

  useEffect(() => {
    if (!token) return;
    getSubmissionCounts(token).then(setSyncCounts);
    getPendingSubmissions(token).then(setPendingSubmissions);
  }, [token, runningCount]);

  useEffect(() => {
    if (!token) return;

    const fetchLink = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        if (!supabase) throw new Error('Client not initialized');

        const { data: linkResult, error: linkErr } = await supabase
          .from('form_links')
          .select('token, form_slug, edition_id')
          .eq('token', token)
          .single();

        if (linkErr || !linkResult) {
          throw new Error('Invalid or expired link. Please request a new collection link from your supervisor.');
        }

        if (!FORM_CONFIG[linkResult.form_slug]) {
          throw new Error('Unknown form type for this link.');
        }

        setLinkData(linkResult);

        const { data: editionData, error: edErr } = await supabase
          .from('market_days')
          .select('id, name')
          .eq('id', linkResult.edition_id)
          .single();

        if (edErr || !editionData) {
          throw new Error('Edition not found for this link.');
        }

        setEdition(editionData);
        setUsingCachedData(false);

        cacheSchema({
          token,
          edition_id: linkResult.edition_id,
          form_slug: linkResult.form_slug,
          link_data: linkResult,
          edition: editionData,
          questions: [],
          sections: [],
          question_logic: [],
          section_logic: [],
        });
      } catch (err: unknown) {
        const isNetworkError =
          err instanceof TypeError ||
          (err instanceof Error &&
            (err.message.includes('fetch') ||
              err.message.includes('network') ||
              err.message.includes('Failed to fetch') ||
              err.message.includes('Load failed') ||
              err.message.includes('NetworkError')));

        if (isNetworkError) {
          const cached = await getCachedSchema(token);
          if (cached) {
            setLinkData(cached.link_data as LinkData);
            setEdition(cached.edition as EditionData);
            setUsingCachedData(true);
            setCachedFormData(cached);
            setLoading(false);
            return;
          }
          setError('No connection — no cached version of this form available. Please connect to the internet to load this form for the first time.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load link');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLink();
  }, [token]);

  const handleFormDataCached = useCallback(
    (data: { questions: unknown[]; sections: unknown[]; questionRules: unknown[]; sectionRules: unknown[] }) => {
      if (!linkData) return;
      cacheSchema({
        token,
        edition_id: linkData.edition_id,
        form_slug: linkData.form_slug,
        link_data: linkData,
        edition,
        questions: data.questions,
        sections: data.sections,
        question_logic: data.questionRules,
        section_logic: data.sectionRules,
      });
    },
    [token, linkData, edition]
  );

  const handlePhoneLookup = useCallback(async (phone: string): Promise<{ data: Record<string, string>; autofilledFields: string[] } | null> => {
    try {
      const supabase = createClient();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('phone', phone)
        .limit(1);

      if (error || !data || data.length === 0) return null;

      const v = data[0];
      const autofilledFields: string[] = ['contact_name', 'business_name', 'phone', 'email', 'category'];

      const vendorData: Record<string, string> = {
        contact_name: v.contact_name || '',
        business_name: v.business_name || '',
        phone: v.phone || phone,
        email: v.email || '',
        category: v.category || '',
      };

      // Fetch previous survey answers for autofill
      const prevAnswers = await fetchPreviousAnswers(supabase, v.id);
      if (prevAnswers) {
        for (const [csvColumn, value] of Object.entries(prevAnswers)) {
          if (AUTOFILL_FIELDS.has(csvColumn) && value) {
            vendorData[csvColumn] = value;
            if (!autofilledFields.includes(csvColumn)) {
              autofilledFields.push(csvColumn);
            }
          }
        }
      }

      return { data: vendorData, autofilledFields };
    } catch {
      return null;
    }
  }, []);

  async function fetchPreviousAnswers(
    supabase: ReturnType<typeof createClient>,
    vendorId: string
  ): Promise<Record<string, string> | null> {
    try {
      let query = supabase
        .from('survey_responses')
        .select('id, submitted_at, context_id, market_days!inner(status)')
        .eq('vendor_id', vendorId)
        .order('submitted_at', { ascending: false });

      if (AUTOFILL_LOOKBACK === 'latest_closed_edition') {
        query = query.eq('market_days.status', 'completed');
      }

      const { data: responses, error: rErr } = await query.limit(1);

      if (rErr || !responses || responses.length === 0) return null;

      const latestResponse = responses[0];

      const { data: answers, error: aErr } = await supabase
        .from('survey_answers')
        .select('answer, question_id, survey_questions!inner(csv_column)')
        .eq('response_id', latestResponse.id);

      if (aErr || !answers) return null;

      const result: Record<string, string> = {};
      for (const row of answers as unknown as { answer: string; survey_questions: { csv_column: string } }[]) {
        const csvColumn = row.survey_questions?.csv_column;
        if (csvColumn && AUTOFILL_FIELDS.has(csvColumn) && row.answer) {
          result[csvColumn] = row.answer;
        }
      }
      return result;
    } catch {
      return null;
    }
  }

  const handlePaidSubmit = useCallback(
    async (answers: Record<string, string>, submissionId?: string): Promise<{ synced: boolean; message?: string; name?: string }> => {
      if (!edition) throw new Error('No edition');

      const supabase = createClient();
      if (!supabase) throw new Error('Client not initialized');

      const phone = answers.phone || answers.phone_number || '';
      const contactName = answers.contact_name || '';
      const businessName = answers.business_name || '';
      const category = answers.category || '';
      const amountPaid = answers.amount_paid ? parseFloat(answers.amount_paid) : 0;
      const paymentStatus = answers.payment_status || 'paid';

      const { data: existing } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', phone)
        .limit(1);

      let vendorId: string;
      if (existing && existing.length > 0) {
        vendorId = existing[0].id;
        await supabase
          .from('vendors')
          .update({
            business_name: businessName,
            contact_name: contactName,
            email: answers.email || '',
            category,
            is_active: true,
          })
          .eq('id', vendorId);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('vendors')
          .insert({
            business_name: businessName,
            contact_name: contactName,
            phone,
            email: answers.email || '',
            category,
            is_active: true,
          })
          .select();
        if (insErr) throw new Error('Failed to create vendor: ' + insErr.message);
        if (!inserted || inserted.length === 0) throw new Error('Failed to create vendor — no row returned');
        vendorId = inserted[0].id;
      }

      const { data: existingReg } = await supabase
        .from('vendor_registrations')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('market_day_id', edition.id)
        .limit(1);

      if (!existingReg || existingReg.length === 0) {
        const payload: Record<string, unknown> = {
          market_day_id: edition.id,
          vendor_id: vendorId,
          amount_paid: amountPaid,
          payment_status: paymentStatus,
        };
        if (submissionId) payload.id = submissionId;
        const { error: regErr } = await supabase.from('vendor_registrations').insert(payload);
        if (regErr && regErr.code === '23505') {
          // duplicate key — already synced on a prior attempt
        } else if (regErr) {
          throw regErr;
        }
        return { synced: true, name: businessName || contactName };
      }

      setRunningCount(c => c + 1);
      setSuccessState({
        show: true,
        name: contactName,
        onAddAnother: () => {
          setRunningCount(c => c + 1);
          setSuccessState({ show: false, name: undefined, onAddAnother: () => {} });
        },
      });

      return { synced: true };
    },
    [edition]
  );

  const handleCollectionSubmit = useCallback(
    async (answers: Record<string, string>, submissionId?: string): Promise<{ synced: boolean; message?: string; name?: string }> => {
      if (!edition) throw new Error('No edition');

      const responseId = submissionId || crypto.randomUUID();

      const supabase = createClient();
      if (!supabase) throw new Error('Client not initialized');

      const phone = answers.phone || answers.phone_number || '';
      const contactName = answers.contact_name || answers.full_name || answers.name || '';

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', phone)
        .limit(1);

      let vendorId: string;
      if (vendorData && vendorData.length > 0) {
        vendorId = vendorData[0].id;
      } else {
        const businessName = answers.business_name || '';
        const { data: newVendor, error: vErr } = await supabase
          .from('vendors')
          .insert({
            business_name: businessName || contactName || 'Unknown Vendor',
            contact_name: contactName,
            phone,
            email: answers.email || '',
            category: answers.business_category || '',
            is_active: true,
          })
          .select();
        if (vErr || !newVendor || newVendor.length === 0) {
          throw new Error('Failed to create vendor: ' + (vErr?.message || 'unknown'));
        }
        vendorId = newVendor[0].id;
      }

      const { data: formData } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', 'vendor_data_collection')
        .single();

      if (!formData) throw new Error('Form not found');
      const formId = formData.id;

      const { data: questions } = await supabase
        .from('survey_questions')
        .select('id, csv_column, question_text, question_type, is_required, options, sort_order, section_id')
        .eq('form_id', formId);

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

      try {
        const snapshotPayload: Record<string, any> = {
          id: responseId,
          form_id: formId,
          context_type: 'market_day',
          context_id: edition.id,
          vendor_id: vendorId,
          source: 'link',
          submitted_at: new Date().toISOString(),
        };
        if (questionSnapshot.length > 0) {
          snapshotPayload.form_schema_snapshot = questionSnapshot;
        }

        const { error: resError } = await supabase.from('survey_responses').insert(snapshotPayload);
        if (resError && resError.code === '23505') {
          // duplicate key — already exists
        } else if (resError) {
          throw resError;
        }
      } catch (snapshotErr: any) {
        const isColumnMissing =
          snapshotErr?.code === '42703' ||
          (typeof snapshotErr?.message === 'string' &&
            snapshotErr.message.includes('form_schema_snapshot'));
        if (isColumnMissing) {
          const { error: fallbackErr } = await supabase.from('survey_responses').insert({
            id: responseId,
            form_id: formId,
            context_type: 'market_day',
            context_id: edition.id,
            vendor_id: vendorId,
            source: 'link',
            submitted_at: new Date().toISOString(),
          });
          if (fallbackErr && fallbackErr.code === '23505') {
            // duplicate — already exists
          } else if (fallbackErr) {
            throw fallbackErr;
          }
        } else {
          throw snapshotErr;
        }
      }

      if (questions && questions.length > 0) {
        const answersToInsert: { response_id: string; question_id: string; answer: string }[] = [];
        for (const q of questions) {
          const val = answers[q.csv_column];
          if (val !== undefined && val !== null && val !== '') {
            answersToInsert.push({
              response_id: responseId,
              question_id: q.id,
              answer: String(val),
            });
          }
        }
        if (answersToInsert.length > 0) {
          const { error: ansErr } = await supabase.from('survey_answers').insert(answersToInsert);
          if (ansErr && ansErr.code === '23505') {
            // duplicate — already synced
          } else if (ansErr) {
            throw new Error(ansErr.message);
          }
        }
      }

      // Auto-create walk-in record — surveyed vendor counts as present
      const walkinPayload: Record<string, unknown> = {
        id: responseId,
        market_day_id: edition.id,
        full_name: contactName,
        phone,
        email: answers.email || '',
        business_type: answers.business_category || '',
        age: answers.age ? parseInt(answers.age) : null,
        recorded_at: new Date().toISOString(),
      };
      const { error: walkErr } = await supabase.from('walkins').insert(walkinPayload);
      if (walkErr && walkErr.code !== '23505') {
        console.error('Auto-walkin insert failed:', walkErr);
      }

      setRunningCount(c => c + 1);
      setSuccessState({
        show: true,
        name: contactName,
        onAddAnother: () => {
          setRunningCount(c => c + 1);
          setSuccessState({ show: false, name: undefined, onAddAnother: () => {} });
        },
      });

      return { synced: true };
    },
    [edition]
  );

  const handleWalkinSubmit = useCallback(
    async (answers: Record<string, string>, submissionId?: string): Promise<{ synced: boolean; message?: string; name?: string }> => {
      if (!edition) throw new Error('No edition');

      const walkinId = submissionId || crypto.randomUUID();

      const supabase = createClient();
      if (!supabase) throw new Error('Client not initialized');

      const fullName = answers.full_name || 'Anonymous Visitor';
      const phone = answers.phone || answers.phone_number || '';
      const email = answers.email || '';
      const businessType = answers.business_type || '';
      const age = answers.age ? parseInt(answers.age) : null;

      const { error: walkinErr } = await supabase.from('walkins').insert({
        id: walkinId,
        market_day_id: edition.id,
        full_name: fullName,
        phone,
        email,
        business_type: businessType,
        age,
        recorded_at: new Date().toISOString(),
      });

      if (walkinErr && walkinErr.code === '23505') {
        // duplicate key — already synced
      } else if (walkinErr) {
        throw new Error('Failed to log walk-in: ' + walkinErr.message);
      }

      setRunningCount(c => c + 1);
      setSuccessState({
        show: true,
        name: fullName,
        onAddAnother: () => {
          setRunningCount(c => c + 1);
          setSuccessState({ show: false, name: undefined, onAddAnother: () => {} });
        },
      });

      return { synced: true };
    },
    [edition]
  );

  const handleSubmit = useCallback(
    async (answers: Record<string, string>): Promise<{ synced: boolean; message?: string; name?: string }> => {
      if (!linkData || !edition) return { synced: false, message: 'Form not ready' };

      const submissionId = crypto.randomUUID();

      const submission: Submission = {
        id: submissionId,
        token,
        form_slug: linkData.form_slug,
        edition_id: edition.id,
        data: answers,
        status: 'pending',
        created_at: new Date(),
      };

      await saveSubmission(submission);
      setSyncCounts(await getSubmissionCounts(token));

      try {
        let result: { synced: boolean; message?: string; name?: string };
        switch (linkData.form_slug) {
          case 'paid_vendor_registration':
            result = await handlePaidSubmit(answers, submissionId);
            break;
          case 'vendor_data_collection':
            result = await handleCollectionSubmit(answers, submissionId);
            break;
          case 'walkin_registration':
            result = await handleWalkinSubmit(answers, submissionId);
            break;
          default:
            throw new Error('Unknown form');
        }

        await markSynced(submissionId);
        setSyncCounts(await getSubmissionCounts(token));
        setPendingSubmissions(await getPendingSubmissions(token));
        return result;
      } catch (err: unknown) {
        setSyncCounts(await getSubmissionCounts(token));
        setPendingSubmissions(await getPendingSubmissions(token));
        const isNetworkError =
          err instanceof TypeError ||
          (err instanceof Error &&
            (err.message.includes('fetch') ||
              err.message.includes('network') ||
              err.message.includes('Failed to fetch')));
        if (isNetworkError) {
          const name =
            answers.contact_name || answers.full_name || answers.name || '';
          return { synced: false, message: 'Saved locally — will sync when back online', name };
        }
        throw err;
      }
    },
    [linkData, edition, token, handlePaidSubmit, handleCollectionSubmit, handleWalkinSubmit]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-green" />
        <p className="text-xs text-[#8b949e]">Loading collection form...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center space-y-4 p-6">
        <AlertCircle className="w-10 h-10 text-red" />
        <h2 className="text-sm font-bold text-[#c9d1d9]">Link Error</h2>
        <p className="text-xs text-[#8b949e] text-center max-w-md">{error}</p>
      </div>
    );
  }

  if (!linkData || !edition) return null;

  const config = FORM_CONFIG[linkData.form_slug];

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      <header className="border-b border-[#21262d] bg-[#161b22] px-4 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-muted/20 border border-green/30 rounded flex items-center justify-center">
            <span className="text-green text-xs font-bold">Q</span>
          </div>
          <div>
            <h1 className="text-xs font-bold text-[#c9d1d9] uppercase tracking-wider">Quonnect Data Collection</h1>
            <p className="text-[10px] text-[#8b949e]">{edition.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-green bg-green-muted/10 px-2 py-1 rounded border border-green/20 font-semibold">
            {syncCounts.pending + syncCounts.synced} collected
          </span>
          {syncCounts.pending > 0 && (
            <button
              onClick={manualSyncAll}
              disabled={syncing || isOnline === false && navigator.onLine === false}
              className="text-[10px] text-amber bg-amber/10 px-2 py-1 rounded border border-amber/20 font-semibold flex items-center gap-1 cursor-pointer hover:bg-amber/20 transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CloudOff className="w-3 h-3" />
              )}
              {syncCounts.pending} pending
            </button>
          )}
          {syncCounts.synced > 0 && (
            <span className="hidden sm:inline text-[10px] text-[#8b949e] bg-[#21262d] px-2 py-1 rounded border border-[#30363d] font-semibold">
              {syncCounts.synced} synced
            </span>
          )}
          {syncCounts.pending > 0 && !syncing && (
            <button
              onClick={manualSyncAll}
              className="text-[10px] text-green bg-green-muted/10 px-2 py-1 rounded border border-green/20 font-semibold flex items-center gap-1 cursor-pointer hover:bg-green/10 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Sync Now
            </button>
          )}
          {!isOnline && (
            <span className="text-[10px] text-red bg-red/10 px-2 py-1 rounded border border-red/20 font-semibold flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Offline
            </span>
          )}
        </div>
      </header>

      {usingCachedData && (
        <div className="bg-amber/10 border-b border-amber/20 px-4 sm:px-6 py-2 text-center">
          <p className="text-[10px] text-amber font-medium flex items-center justify-center gap-1.5">
            <WifiOff className="w-3 h-3" />
            Using cached form — data will sync when back online
          </p>
        </div>
      )}

      {pendingSubmissions.length > 0 && (
        <div className="bg-[#161b22] border-b border-[#21262d] px-4 sm:px-6 py-3">
          <div className="max-w-[560px] mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold text-amber uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Pending Sync ({pendingSubmissions.length})
              </h3>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {pendingSubmissions.map(sub => {
                const name = sub.data.contact_name || sub.data.full_name || sub.data.name || sub.data.business_name || 'Unknown';
                const phone = sub.data.phone || sub.data.phone_number || '';
                const time = new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between bg-[#0d1117] border border-[#21262d] rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 bg-amber/10 border border-amber/20 rounded-full flex items-center justify-center shrink-0">
                        <CloudOff className="w-3 h-3 text-amber" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#c9d1d9] truncate">{name}</p>
                        <p className="text-[10px] text-[#8b949e]">{phone || 'No phone'} &middot; {time}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => retrySingleSubmission(sub)}
                      disabled={syncing}
                      className="text-[10px] text-green bg-green-muted/10 px-2 py-1 rounded border border-green/20 font-semibold cursor-pointer hover:bg-green/10 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1"
                    >
                      {syncing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Retry
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex items-start justify-center p-3 sm:p-6 pt-10">
        <div className="w-full max-w-[560px]">
          <DynamicQuickEntryForm
            formSlug={linkData.form_slug}
            activeEdition={edition}
            onSubmit={handleSubmit}
            onPhoneLookup={config.lookupEnabled ? handlePhoneLookup : undefined}
            successState={successState}
            runningCount={runningCount}
            formIcon={config.icon}
            formLabel={config.label}
            formSubtitle={config.subtitle}
            countLabel={config.countLabel}
            lookupEnabled={config.lookupEnabled}
            cachedData={
              usingCachedData && cachedFormData
                ? ({
                    questions: (cachedFormData.questions || []) as FormDataCache['questions'],
                    sections: (cachedFormData.sections || []) as FormDataCache['sections'],
                    questionRules: (cachedFormData.question_logic || []) as FormDataCache['questionRules'],
                    sectionRules: (cachedFormData.section_logic || []) as FormDataCache['sectionRules'],
                  } as FormDataCache)
                : undefined
            }
            onFormDataCached={handleFormDataCached}
          />
        </div>
      </main>

      <footer className="border-t border-[#21262d] bg-[#161b22] px-6 py-2 text-center">
        <p className="text-[10px] text-[#484f58]">
          Quonnect Data System &middot; Link-based collection form
          {syncCounts.pending > 0 && (
            <>
              {' '}
              &middot;{' '}
              <span className="text-amber">{syncCounts.pending} pending sync{syncCounts.pending !== 1 ? 's' : ''}</span>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}

async function replaySubmission(
  supabase: ReturnType<typeof createClient>,
  submission: Submission,
  edition: EditionData,
  _linkData: LinkData
): Promise<void> {
  const answers = submission.data;

  switch (submission.form_slug) {
    case 'paid_vendor_registration': {
      const phone = answers.phone || answers.phone_number || '';
      const contactName = answers.contact_name || '';
      const businessName = answers.business_name || '';
      const category = answers.category || '';
      const amountPaid = answers.amount_paid ? parseFloat(answers.amount_paid) : 0;
      const paymentStatus = answers.payment_status || 'paid';

      const { data: existing } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', phone)
        .limit(1);

      let vendorId: string;
      if (existing && existing.length > 0) {
        vendorId = existing[0].id;
        await supabase
          .from('vendors')
          .update({
            business_name: businessName,
            contact_name: contactName,
            email: answers.email || '',
            category,
            is_active: true,
          })
          .eq('id', vendorId);
      } else {
        const { data: inserted } = await supabase
          .from('vendors')
          .insert({
            business_name: businessName,
            contact_name: contactName,
            phone,
            email: answers.email || '',
            category,
            is_active: true,
          })
          .select();
        if (!inserted || inserted.length === 0) throw new Error('Replay: failed to create vendor');
        vendorId = inserted[0].id;
      }

      const { data: existingReg } = await supabase
        .from('vendor_registrations')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('market_day_id', edition.id)
        .limit(1);

      if (!existingReg || existingReg.length === 0) {
        const payload: Record<string, unknown> = {
          market_day_id: edition.id,
          vendor_id: vendorId,
          amount_paid: amountPaid,
          payment_status: paymentStatus,
        };
        const { error: regErr } = await supabase.from('vendor_registrations').insert(payload);
        if (regErr && regErr.code !== '23505') throw new Error('Replay: ' + regErr.message);
      }
      break;
    }

    case 'vendor_data_collection': {
      const phone = answers.phone || answers.phone_number || '';
      const contactName = answers.contact_name || answers.full_name || answers.name || '';

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', phone)
        .limit(1);

      let vendorId: string;
      if (vendorData && vendorData.length > 0) {
        vendorId = vendorData[0].id;
      } else {
        const businessName = answers.business_name || '';
        const { data: newVendor } = await supabase
          .from('vendors')
          .insert({
            business_name: businessName || contactName || 'Unknown Vendor',
            contact_name: contactName,
            phone,
            email: answers.email || '',
            category: answers.business_category || '',
            is_active: true,
          })
          .select();
        if (!newVendor || newVendor.length === 0) throw new Error('Replay: failed to create vendor');
        vendorId = newVendor[0].id;
      }

      const { data: formData } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', 'vendor_data_collection')
        .single();

      if (!formData) throw new Error('Replay: form not found');
      const formId = formData.id;

      const { error: resError } = await supabase.from('survey_responses').insert({
        id: submission.id,
        form_id: formId,
        context_type: 'market_day',
        context_id: edition.id,
        vendor_id: vendorId,
        source: 'link',
        submitted_at: new Date().toISOString(),
      });

      if (resError && resError.code !== '23505') {
        throw new Error('Replay: ' + resError.message);
      }

      const { data: questions } = await supabase
        .from('survey_questions')
        .select('id, csv_column')
        .eq('form_id', formId);

      if (questions && questions.length > 0) {
        const answersToInsert: { response_id: string; question_id: string; answer: string }[] = [];
        for (const q of questions) {
          const val = answers[q.csv_column];
          if (val !== undefined && val !== null && val !== '') {
            answersToInsert.push({
              response_id: submission.id,
              question_id: q.id,
              answer: String(val),
            });
          }
        }
        if (answersToInsert.length > 0) {
          const { error: ansErr } = await supabase.from('survey_answers').insert(answersToInsert);
          if (ansErr && ansErr.code !== '23505') throw new Error('Replay: ' + ansErr.message);
        }
      }

      // Auto-create walk-in on replay too
      const { error: replWalkErr } = await supabase.from('walkins').insert({
        id: submission.id,
        market_day_id: edition.id,
        full_name: contactName,
        phone,
        email: answers.email || '',
        business_type: answers.business_category || '',
        age: answers.age ? parseInt(answers.age) : null,
        recorded_at: new Date().toISOString(),
      });
      if (replWalkErr && replWalkErr.code !== '23505') {
        console.error('Replay auto-walkin insert failed:', replWalkErr);
      }
      break;
    }

    case 'walkin_registration': {
      const fullName = answers.full_name || 'Anonymous Visitor';
      const phone = answers.phone || answers.phone_number || '';
      const email = answers.email || '';
      const businessType = answers.business_type || '';
      const age = answers.age ? parseInt(answers.age) : null;

      const { error: walkinErr } = await supabase.from('walkins').insert({
        id: submission.id,
        market_day_id: edition.id,
        full_name: fullName,
        phone,
        email,
        business_type: businessType,
        age,
        recorded_at: new Date().toISOString(),
      });

      if (walkinErr && walkinErr.code !== '23505') {
        throw new Error('Replay: ' + walkinErr.message);
      }
      break;
    }
  }
}
