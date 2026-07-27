'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DynamicQuickEntryForm } from '@/components/forms/DynamicQuickEntryForm';
import { Users, Database, Footprints, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

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
      }
    }));
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchLink = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        if (!supabase) throw new Error('Client not initialized');

        const { data: linkData, error: linkErr } = await supabase
          .from('form_links')
          .select('token, form_slug, edition_id')
          .eq('token', token)
          .single();

        if (linkErr || !linkData) {
          throw new Error('Invalid or expired link. Please request a new collection link from your supervisor.');
        }

        if (!FORM_CONFIG[linkData.form_slug]) {
          throw new Error('Unknown form type for this link.');
        }

        setLinkData(linkData);

        const { data: editionData, error: edErr } = await supabase
          .from('market_days')
          .select('id, name')
          .eq('id', linkData.edition_id)
          .single();

        if (edErr || !editionData) {
          throw new Error('Edition not found for this link.');
        }

        setEdition(editionData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load link');
      } finally {
        setLoading(false);
      }
    };

    fetchLink();
  }, [token]);

  const handlePhoneLookup = useCallback(async (phone: string): Promise<Record<string, string> | null> => {
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
      return {
        contact_name: v.contact_name || '',
        business_name: v.business_name || '',
        phone: v.phone || phone,
        email: v.email || '',
        category: v.category || '',
      };
    } catch {
      return null;
    }
  }, []);

  const handlePaidSubmit = useCallback(async (answers: Record<string, string>) => {
    if (!edition) throw new Error('No edition');

    const supabase = createClient();
    if (!supabase) throw new Error('Client not initialized');

    const phone = answers.phone || answers.phone_number || '';
    const contactName = answers.contact_name || '';
    const businessName = answers.business_name || '';
    const category = answers.category || '';
    const stallNumber = answers.stall_number || '';
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
      const { error: regErr } = await supabase.from('vendor_registrations').insert({
        market_day_id: edition.id,
        vendor_id: vendorId,
        stall_number: stallNumber || null,
        amount_paid: amountPaid,
        payment_status: paymentStatus,
      });
      if (regErr) throw new Error('Failed to create registration: ' + regErr.message);
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
  }, [edition]);

  const handleCollectionSubmit = useCallback(async (answers: Record<string, string>) => {
    if (!edition) throw new Error('No edition');

    const supabase = createClient();
    if (!supabase) throw new Error('Client not initialized');

    const phone = answers.phone || answers.phone_number || '';
    const contactName = answers.contact_name || answers.full_name || answers.name || '';

    const { data: vendorData } = await supabase
      .from('vendors')
      .select('id')
      .eq('phone', phone)
      .limit(1);

    if (!vendorData || vendorData.length === 0) {
      throw new Error('Paid registration not found. Please register this vendor using the Paid Vendor form first.');
    }

    const vendorId = vendorData[0].id;

    const { data: formData } = await supabase
      .from('forms')
      .select('id')
      .eq('slug', 'vendor_data_collection')
      .single();

    if (!formData) throw new Error('Form not found');
    const formId = formData.id;

    const { data: resData, error: resError } = await supabase
      .from('survey_responses')
      .insert({
        form_id: formId,
        context_type: 'market_day',
        context_id: edition.id,
        vendor_id: vendorId,
        source: 'link',
        submitted_at: new Date().toISOString(),
      })
      .select();

    if (resError) throw new Error(resError.message);
    if (!resData || resData.length === 0) throw new Error('Failed to insert survey response — no row returned');
    const responseId = resData[0].id;

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
            response_id: responseId,
            question_id: q.id,
            answer: String(val),
          });
        }
      }
      if (answersToInsert.length > 0) {
        await supabase.from('survey_answers').insert(answersToInsert);
      }
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
  }, [edition]);

  const handleWalkinSubmit = useCallback(async (answers: Record<string, string>) => {
    if (!edition) throw new Error('No edition');

    const supabase = createClient();
    if (!supabase) throw new Error('Client not initialized');

    const fullName = answers.full_name || 'Anonymous Visitor';
    const phone = answers.phone || answers.phone_number || '';
    const email = answers.email || '';
    const businessType = answers.business_type || '';
    const age = answers.age ? parseInt(answers.age) : null;

    const { error: walkinErr } = await supabase.from('walkins').insert({
      market_day_id: edition.id,
      full_name: fullName,
      phone,
      email,
      business_type: businessType,
      age,
      recorded_at: new Date().toISOString(),
    });

    if (walkinErr) throw new Error('Failed to log walk-in: ' + walkinErr.message);

    setRunningCount(c => c + 1);
    setSuccessState({
      show: true,
      name: fullName,
      onAddAnother: () => {
        setRunningCount(c => c + 1);
        setSuccessState({ show: false, name: undefined, onAddAnother: () => {} });
      },
    });
  }, [edition]);

  const handleSubmit = useCallback(async (answers: Record<string, string>) => {
    if (!linkData) return;
    switch (linkData.form_slug) {
      case 'paid_vendor_registration':
        return handlePaidSubmit(answers);
      case 'vendor_data_collection':
        return handleCollectionSubmit(answers);
      case 'walkin_registration':
        return handleWalkinSubmit(answers);
      default:
        throw new Error('Unknown form');
    }
  }, [linkData, handlePaidSubmit, handleCollectionSubmit, handleWalkinSubmit]);

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
      <header className="border-b border-[#21262d] bg-[#161b22] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-muted/20 border border-green/30 rounded flex items-center justify-center">
            <span className="text-green text-xs font-bold">Q</span>
          </div>
          <div>
            <h1 className="text-xs font-bold text-[#c9d1d9] uppercase tracking-wider">Quonnect Data Collection</h1>
            <p className="text-[10px] text-[#8b949e]">{edition.name}</p>
          </div>
        </div>
        <span className="text-[10px] text-green bg-green-muted/10 px-2 py-1 rounded border border-green/20 font-semibold">
          {config.label}
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center p-6 pt-10">
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
          />
        </div>
      </main>

      <footer className="border-t border-[#21262d] bg-[#161b22] px-6 py-2 text-center">
        <p className="text-[10px] text-[#484f58]">
          Quonnect Data System &middot; Link-based collection form &middot; Session expires on tab close
        </p>
      </footer>
    </div>
  );
}
