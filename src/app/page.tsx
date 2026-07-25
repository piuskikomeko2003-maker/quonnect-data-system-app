'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLiveMetrics } from '@/hooks/useLiveMetrics';
import { useRegion } from '@/context/RegionContext';
import { AdminShell } from '@/components/layout/AdminShell';

export interface Market {
  id: string;
  name: string;
  type: 'flagship' | 'regional' | 'pilot';
  vendorsCount: number;
}
import { OverviewCards, OverviewData } from '@/components/dashboard/OverviewCards';
import { LiveCounter } from '@/components/dashboard/LiveCounter';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { FilterBar, FilterState } from '@/components/dashboard/FilterBar';
import { VendorTable, Vendor } from '@/components/vendors/VendorTable';
import { VendorDetailPanel } from '@/components/vendors/VendorDetailPanel';
import { QuickEntryPanel } from '@/components/forms/QuickEntryPanel';
import { FormBuilderShell } from '@/components/formbuilder/FormBuilderShell';
import { FormBuilderPanel } from '@/components/formbuilder/FormBuilderPanel';
import { FormCard } from '@/components/formbuilder/FormCard';
import { FormPreview } from '@/components/formbuilder/FormPreview';
import { MarketConfigurationPanel } from '@/components/dashboard/MarketConfigurationPanel';
import { Question, FormTemplate } from '@/components/formbuilder/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Users, 
  Footprints, 
  Database, 
  ClipboardList, 
  Zap, 
  AlertTriangle, 
  FileText, 
  Link as LinkIcon, 
  Check, 
  Plus, 
  TrendingUp, 
  BarChart3, 
  Tag, 
  Heart, 
  HelpCircle,
  Copy,
  Info,
  X,
  Filter,
  Map,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard
} from 'lucide-react';

// ==========================================
// 1. PROJECT BUSINESS CONSTANTS
// ==========================================

const BUSINESS_TYPES = ['Food', 'Fashion', 'Crafts', 'Beauty', 'Electronics', 'Agriculture'];


const getVendorDetailData = (vendor: any) => {
  if (!vendor) return undefined;
  return {
    id: vendor.id,
    name: vendor.name,
    phone: vendor.phone,
    status: vendor.status,
    avatarInitials: vendor.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
    attendanceHistory: [
      {
        editionId: 'may-2026',
        editionName: 'Kampala May 2026',
        paid: true,
        dataCollected: vendor.attendanceCount > 0,
        sequenceNumber: vendor.attendanceCount
      },
      ...(vendor.attendanceCount > 1 ? [
        {
          editionId: 'april-2026',
          editionName: 'Kampala April 2026',
          paid: true,
          dataCollected: vendor.attendanceCount > 1,
          sequenceNumber: vendor.attendanceCount - 1
        }
      ] : [])
    ],
    editionAttributes: [
      {
        editionId: 'may-2026',
        editionName: 'Kampala May 2026',
        attributes: [
          { key: 'employee_count', label: 'Employee Count', value: vendor.employeeCount || '0', source: 'verified' as const },
          { key: 'new_hires_this_year', label: 'New Hires This Year', value: vendor.newHiresThisYear || '0', source: 'verified' as const },
          { key: 'business_type', label: 'Business Classification', value: vendor.businessType || 'N/A', source: 'verified' as const },
          { key: 'sells_own_products', label: 'Sells Own Products?', value: vendor.sellsOwnProducts || 'No', source: 'self-reported' as const },
          { key: 'export_ready', label: 'Export Ready?', value: vendor.exportReady || 'No', source: 'self-reported' as const },
          { key: 'impact_rating', label: 'Program Impact Rating', value: vendor.impactRating ? `${vendor.impactRating}/5` : 'N/A', source: 'self-reported' as const },
          { key: 'business_growth_narrative', label: 'Business Growth Narrative', value: vendor.businessGrowthNarrative || 'No story provided.', source: 'self-reported' as const }
        ]
      }
    ],
    dataGaps: !vendor.employeeCount || !vendor.businessType ? ['Employee Count', 'Business Classification'] : []
  };
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { activeRegion, activeEdition, regions: ctxRegions, switchRegion, loadingRegions, editions: ctxEditions, setActiveEdition } = useRegion();

  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const handleCreateRegionFromName = async (name: string) => {
    try {
      const supabase = createClient();
      if (!supabase) return;
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-');
      const { data, error: rErr } = await supabase
        .from('regions')
        .insert([{ name, slug, is_active: true }])
        .select()
        .single();
      if (rErr) throw rErr;
      alert(`Region "${name}" created successfully!`);
      if (data) {
        switchRegion({
          id: data.id,
          name: data.name,
          slug: data.slug,
          is_active: data.is_active
        });
      }
    } catch (e: any) {
      alert(`Error creating region: ${e.message}`);
    }
  };
  
  // Navigation States
  const [activeNav, setActiveNav] = useState('overview');
  
  // Market, Edition and Region State Arrays
  const [markets, setMarkets] = useState<Market[]>([]);
  const [editions, setEditions] = useState<any[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);
  
  const emptyMarket: Market = {
    id: '',
    name: 'No Region Selected',
    type: 'regional',
    vendorsCount: 0
  };
  
  const [currentMarket, setCurrentMarket] = useState<Market>(emptyMarket);
  
  // Live session mock polling states
  const {
    runningCount,
    runningWalkins,
    isRefreshing,
    setRunningCount,
    setRunningWalkins,
    refreshMetrics: handleRefreshLiveCounter,
    incrementVendorsCount,
    incrementWalkinsCount,
  } = useLiveMetrics({
    initialVendorsCount: 0,
    initialWalkinsCount: 0,
  });
  
  // Entities lists states
  const [vendors, setVendors] = useState<any[]>([]);
  const [walkins, setWalkins] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paid Vendors states
  const [paidVendors, setPaidVendors] = useState<any[]>([]);
  const [paidVendorCounts, setPaidVendorCounts] = useState({ paid: 0, unpaid: 0, revenue: 0 });
  const [loadingPaidVendors, setLoadingPaidVendors] = useState(false);

  // Overview live counts
  const [overviewCounts, setOverviewCounts] = useState({ paidVendors: 0, walkins: 0, surveyResponses: 0 });

  const fetchVendors = async () => {
    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase client not initialized.");
        setLoadingVendors(false);
        return;
      }

      if (!activeRegion?.id) {
        setVendors([]);
        setRunningCount(0);
        setLoadingVendors(false);
        return;
      }

      console.log("Fetching vendors for region:", activeRegion.id);

      let surveyQuery = supabase
        .from('survey_responses')
        .select(`
          vendor_id,
          survey_answers (
            answer,
            survey_questions (
              csv_column
            )
          ),
          market_days!inner (
            region_id
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (activeEdition) {
        surveyQuery = surveyQuery.eq('context_id', activeEdition.id);
      }

      const { data: surveyData, error: surveyError } = await surveyQuery;

      if (surveyError) {
        console.error("Survey fetch error:", surveyError.message);
        throw surveyError;
      }

      const surveyVendorIds = new Set<string>();
      const vendorAnswersMap = new globalThis.Map<string, Record<string, string>>();

      (surveyData || []).forEach((row: any) => {
        if (row.vendor_id) {
          surveyVendorIds.add(row.vendor_id);
          if (!vendorAnswersMap.has(row.vendor_id)) {
            vendorAnswersMap.set(row.vendor_id, {});
          }
          const answerMap = vendorAnswersMap.get(row.vendor_id)!;
          if (row.survey_answers && Array.isArray(row.survey_answers)) {
            row.survey_answers.forEach((a: any) => {
              const csvColumn = a.survey_questions?.csv_column;
              if (csvColumn && a.answer !== undefined && a.answer !== null) {
                answerMap[csvColumn] = a.answer;
              }
            });
          }
        }
      });

      let paidVendorIds = new Set<string>();
      const paidAmountMap = new globalThis.Map<string, string>();
      if (activeEdition?.id) {
        const { data: paidData } = await supabase
          .from('vendor_registrations')
          .select('vendor_id, amount_paid')
          .eq('market_day_id', activeEdition.id);
        (paidData || []).forEach((r: any) => {
          paidVendorIds.add(r.vendor_id);
          paidAmountMap.set(r.vendor_id, String(r.amount_paid || '0'));
        });
      }

      const allVendorIds = [...new globalThis.Set([...surveyVendorIds, ...paidVendorIds])];

      console.log("Paid vendor IDs:", [...paidVendorIds]);
      console.log("Survey vendor IDs:", surveyVendorIds.size);
      console.log("All vendor IDs:", allVendorIds.length);
      console.log("Active edition:", activeEdition?.id, activeEdition?.name);

      if (allVendorIds.length === 0) {
        setVendors([]);
        setRunningCount(0);
        setError(null);
        return;
      }

      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .in('id', allVendorIds);

      if (vendorError) {
        console.error("Vendor fetch error:", vendorError.message);
        throw vendorError;
      }

      const mappedVendors = (vendorData || []).map((v: any) => {
        const answerMap = vendorAnswersMap.get(v.id) || {};

        const registrationType: 'survey' | 'paid' | 'both' | 'unknown' =
          surveyVendorIds.has(v.id) && paidVendorIds.has(v.id) ? 'both' :
          paidVendorIds.has(v.id) ? 'paid' :
          surveyVendorIds.has(v.id) ? 'survey' : 'unknown';

        return {
          id: v.id,
          name: v.contact_name || answerMap['full_name'] || answerMap['contact_name'] || 'Unknown',
          phone: v.phone || answerMap['phone_number'] || answerMap['phone'] || '',
          businessName: v.business_name || answerMap['business_name'] || '',
          gender: answerMap['gender'] || 'Unknown',
          status: v.is_active ? ('active' as const) : ('new' as const),
          region: activeRegion.name,
          attendanceCount: Number(answerMap['times_attended']) || 1,
          lastSeen: activeEdition ? activeEdition.name : 'May 2026',
          age: answerMap['age'] ? parseInt(answerMap['age'], 10) : 0,
          employeeCount: answerMap['employee_count'] || answerMap['employees'] || '',
          newHiresThisYear: answerMap['new_hires_this_year'] || answerMap['new_hires'] || '',
          businessType: v.category || answerMap['business_category'] || answerMap['category'] || 'Fashion',
          sellsOwnProducts: answerMap['sells_own_products'] || 'No',
          exportReady: answerMap['export_ready'] || 'No',
          impactRating: answerMap['impact_rating'] ? Number(answerMap['impact_rating']) : 0,
          businessGrowthNarrative: answerMap['business_growth_narrative'] || answerMap['business_growth'] || '',
          dob: answerMap['date_of_birth'] || answerMap['dob'] || v.dob || '',
          amountPaid: paidAmountMap.get(v.id) || '0',
          email: v.email || answerMap['email'] || answerMap['email_address'] || '',
          registrationType
        };
      });

      setVendors(mappedVendors);
      setRunningCount(mappedVendors.length);
      setError(null);

      const rtCounts = {
        all: mappedVendors.length,
        survey: mappedVendors.filter((v: any) => v.registrationType === 'survey').length,
        paid: mappedVendors.filter((v: any) => v.registrationType === 'paid').length,
        both: mappedVendors.filter((v: any) => v.registrationType === 'both').length,
        unknown: mappedVendors.filter((v: any) => v.registrationType === 'unknown').length
      };
      console.log("Registration type counts:", rtCounts);
    } catch (err: any) {
      console.error("Supabase error fetching vendors:", err);
      setVendors([]);
      setError(err.message || String(err));
    } finally {
      setLoadingVendors(false);
    }
  };

  const fetchWalkins = async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      if (!activeRegion) {
        setWalkins([]);
        setRunningWalkins(0);
        return;
      }

      let query = supabase
        .from('walkins')
        .select(`
          *,
          market_days!inner (
            region_id
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (activeEdition) {
        query = query.eq('market_day_id', activeEdition.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedWalkins = (data || []).map((w: any) => {
        return {
          id: w.id,
          full_name: w.full_name || 'Anonymous Visitor',
          phone: w.phone || '',
          email: w.email || '',
          business_type: w.business_type || '',
          age: w.age || 0,
          date: w.recorded_at ? new Date(w.recorded_at).toISOString().slice(0, 16).replace('T', ' ') : '',
          region: activeRegion.name,
          editionId: w.market_day_id || ''
        };
      });

      setWalkins(mappedWalkins);
      setRunningWalkins(mappedWalkins.length);
    } catch (err: any) {
      console.error("Supabase error fetching walkins:", err);
      setWalkins([]);
    }
  };

  const fetchPaidVendors = async () => {
    try {
      const supabase = createClient();
      if (!supabase || !activeEdition?.id) {
        setPaidVendors([]);
        setPaidVendorCounts({ paid: 0, unpaid: 0, revenue: 0 });
        setLoadingPaidVendors(false);
        return;
      }

      setLoadingPaidVendors(true);

      const { data, error } = await supabase
        .from('vendor_registrations')
        .select(`
          id,
          payment_status,
          stall_number,
          amount_paid,
          created_at,
          vendors (
            id,
            business_name,
            contact_name,
            phone,
            category
          )
        `)
        .eq('market_day_id', activeEdition.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const registrations = (data || []).map((r: any) => ({
        id: r.id,
        payment_status: r.payment_status,
        stall_number: r.stall_number,
        amount_paid: r.amount_paid,
        created_at: r.created_at,
        business_name: r.vendors?.business_name || 'Unknown',
        contact_name: r.vendors?.contact_name || 'Unknown',
        phone: r.vendors?.phone || '',
        category: r.vendors?.category || '',
      }));

      const paid = registrations.filter(r => r.payment_status === 'paid').length;
      const unpaid = registrations.filter(r => r.payment_status !== 'paid').length;
      const revenue = registrations.reduce((sum: number, r: any) => sum + (Number(r.amount_paid) || 0), 0);

      setPaidVendors(registrations);
      setPaidVendorCounts({ paid, unpaid, revenue });
      setLoadingPaidVendors(false);
    } catch (err: any) {
      console.error("Error fetching paid vendors:", err);
      setPaidVendors([]);
      setPaidVendorCounts({ paid: 0, unpaid: 0, revenue: 0 });
      setLoadingPaidVendors(false);
    }
  };

  const fetchSurveyResponses = async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      if (!activeRegion) {
        setSurveyResponses([]);
        return;
      }

      let query = supabase
        .from('survey_responses')
        .select(`
          id,
          submitted_at,
          source,
          surveyed_by,
          import_batch,
          vendor_id,
          vendors (
            id,
            business_name,
            contact_name,
            phone,
            category
          ),
          market_days!inner (
            id,
            name,
            region_id,
            regions (
              id,
              name
            )
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (activeEdition) {
        query = query.eq('context_id', activeEdition.id);
      }

      const { data, error } = await query.order('submitted_at', { ascending: false });

      if (error) {
        console.error("Supabase error:", error.message, error.code, error.details);
        setSurveyResponses([]);
        return;
      }

      const resolvedData = data ?? [];
      setSurveyResponses(resolvedData);
      
      const activities = resolvedData.map((sr: any) => {
        const v = sr.vendors || {};
        const md = sr.market_days || {};
        return {
          id: sr.id,
          type: 'collection' as const,
          name: v.contact_name || 'Anonymous',
          phone: v.phone || undefined,
          detail: `Collected: ${v.business_name || 'General Info'} • ${md.name || 'Event'}`,
          timestamp: sr.submitted_at ? new Date(sr.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
        };
      });
      setRecentActivities(activities);
    } catch (err: any) {
      console.error("Supabase error fetching responses:", err?.message, err?.code, err?.details, JSON.stringify(err));
      setSurveyResponses([]);
    }
  };

  const fetchOverviewCounts = async () => {
    if (!activeEdition?.id) {
      setOverviewCounts({ paidVendors: 0, walkins: 0, surveyResponses: 0 });
      return;
    }
    try {
      const supabase = createClient();
      if (!supabase) return;

      const [paidRes, walkinRes, surveyRes] = await Promise.all([
        supabase.from('vendor_registrations').select('*', { count: 'exact', head: true })
          .eq('market_day_id', activeEdition.id)
          .eq('payment_status', 'paid'),
        supabase.from('walkins').select('*', { count: 'exact', head: true })
          .eq('market_day_id', activeEdition.id),
        supabase.from('survey_responses').select('*', { count: 'exact', head: true })
          .eq('context_id', activeEdition.id),
      ]);

      setOverviewCounts({
        paidVendors: paidRes.count ?? 0,
        walkins: walkinRes.count ?? 0,
        surveyResponses: surveyRes.count ?? 0,
      });
    } catch (err: any) {
      console.error("Error fetching overview counts:", err);
    }
  };

  const fetchRegions = async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from('regions')
        .select('id, name, slug');
      if (error) throw error;
      if (data && data.length > 0) {
        const names = data.map((r: any) => r.name);
        setRegions(names);
        
        const dbMarkets = data.map((r: any, idx: number) => ({
          id: r.slug || r.name.toLowerCase(),
          name: `${r.name} Regional Market`,
          type: (idx === 0 ? 'flagship' : idx === 1 ? 'regional' : 'pilot') as any,
          vendorsCount: 0
        }));
        setMarkets(dbMarkets);
        if (dbMarkets.length > 0) {
          setCurrentMarket(dbMarkets[0]);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch regions from Supabase:", err);
    }
  };

  const fetchMarketDays = async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from('market_days')
        .select('id, name, status');

      if (error) throw error;

      if (data) {
        const mappedEditions = data.map((md: any) => ({
          id: md.id,
          name: md.name
        }));
        setEditions(mappedEditions);
        if (mappedEditions.length > 0) {
          setQuickEntryEdition(mappedEditions[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch market days:", err);
    }
  };

  const fetchFormsAndQuestions = async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data: formsData, error: formsError } = await supabase
        .from('forms')
        .select('id, name, is_active, created_at');

      if (formsError) throw formsError;

      if (formsData) {
        const mappedTemplates = formsData.map((f: any) => ({
          id: f.id,
          name: f.name,
          status: f.is_active ? ('active' as const) : ('draft' as const),
          questionCount: 0,
          lastEdited: f.created_at ? new Date(f.created_at).toISOString().split('T')[0] : ''
        }));

        const { data: questionsData, error: questionsError } = await supabase
          .from('survey_questions')
          .select(`
            id,
            form_id,
            question_text,
            question_type,
            is_required,
            csv_column
          `);

        if (questionsError) throw questionsError;

        if (questionsData) {
          const templatesWithCount = mappedTemplates.map((t: any) => {
            const qCount = questionsData.filter((q: any) => q.form_id === t.id).length;
            return { ...t, questionCount: qCount };
          });
          setFormTemplates(templatesWithCount);

          const questionsMap: Record<string, Question[]> = {};
          for (const t of templatesWithCount) {
            const qs = questionsData
              .filter((q: any) => q.form_id === t.id)
              .map((q: any) => ({
                id: q.id,
                text: q.question_text,
                type: q.question_type === 'select' ? 'dropdown' : q.question_type,
                required: q.is_required,
                helpText: '',
                options: q.question_type === 'select' 
                  ? (q.csv_column === 'gender' ? ['Female', 'Male', 'Other'] : ['Food', 'Fashion', 'Crafts', 'Beauty', 'Electronics', 'Agriculture'])
                  : undefined
              }));
            questionsMap[t.id] = qs;
          }
          setFormQuestions(questionsMap);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch forms and questions:", err);
    }
  };

  useEffect(() => {
    let vendorsChannel: any;
    let regionsChannel: any;
    let walkinsChannel: any;
    let responsesChannel: any;
    let vendorRegistrationsChannel: any;

    if (mounted) {
      fetchVendors();
      fetchWalkins();
      fetchSurveyResponses();
      fetchPaidVendors();
      fetchOverviewCounts();
      fetchRegions();
      fetchMarketDays();
      fetchFormsAndQuestions();

      const supabase = createClient();
      if (supabase) {
        vendorsChannel = supabase
          .channel('public-vendors-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'vendors' },
            (payload) => {
              console.log('Realtime update: vendors table', payload);
              fetchVendors();
            }
          )
          .subscribe();

        regionsChannel = supabase
          .channel('public-regions-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'regions' },
            (payload) => {
              console.log('Realtime update: regions table', payload);
              fetchRegions();
            }
          )
          .subscribe();

        walkinsChannel = supabase
          .channel('public-walkins-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'walkins' },
            (payload) => {
              console.log('Realtime update: walkins table', payload);
              fetchWalkins();
            }
          )
          .subscribe();

        responsesChannel = supabase
          .channel('public-responses-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'survey_responses' },
            (payload) => {
              console.log('Realtime update: survey_responses table', payload);
              fetchSurveyResponses();
            }
          )
          .subscribe();

        vendorRegistrationsChannel = supabase
          .channel('public-vendor_registrations-realtime')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'vendor_registrations' },
            () => {
              fetchPaidVendors();
              fetchOverviewCounts();
            }
          )
          .subscribe();
      }
    }

    return () => {
      const supabase = createClient();
      if (supabase) {
        if (vendorsChannel) supabase.removeChannel(vendorsChannel);
        if (regionsChannel) supabase.removeChannel(regionsChannel);
        if (walkinsChannel) supabase.removeChannel(walkinsChannel);
        if (responsesChannel) supabase.removeChannel(responsesChannel);
        if (vendorRegistrationsChannel) supabase.removeChannel(vendorRegistrationsChannel);
      }
    };
  }, [mounted, activeRegion?.id, activeEdition?.id]);

  // Walk-ins filtering states
  const [walkinRegionFilter, setWalkinRegionFilter] = useState('All');
  const [walkinEditionFilter, setWalkinEditionFilter] = useState('All');
  const [walkinBusinessTypeFilter, setWalkinBusinessTypeFilter] = useState('All');
  const [walkinMinAgeFilter, setWalkinMinAgeFilter] = useState<number | ''>('');
  const [walkinMaxAgeFilter, setWalkinMaxAgeFilter] = useState<number | ''>('');

  // Quick Entry dropdown selections
  const [quickEntryRegion, setQuickEntryRegion] = useState('');
  const [quickEntryEdition, setQuickEntryEdition] = useState('');

  // Import/Export dropdown selections
  const [uploadRegion, setUploadRegion] = useState('');
  const [uploadEdition, setUploadEdition] = useState('');

  // Create Market section creation states
  const [newRegionName, setNewRegionName] = useState('');
  
  const [newMarketName, setNewMarketName] = useState('');
  const [newMarketCity, setNewMarketCity] = useState('');
  const [newMarketMaturity, setNewMarketMaturity] = useState<'flagship' | 'regional' | 'pilot'>('regional');
  const [newMarketVendors, setNewMarketVendors] = useState('');

  const [newEditionMarketId, setNewEditionMarketId] = useState('');
  const [newEditionDate, setNewEditionDate] = useState('');
  const [newEditionVenue, setNewEditionVenue] = useState('');
  const [newEditionMonth, setNewEditionMonth] = useState('6');
  const [newEditionYear, setNewEditionYear] = useState('2026');
  
  // Search & Filters state
  const [filters, setFilters] = useState<FilterState>({
    region: 'All',
    editionId: 'All',
    gender: 'All',
    statuses: [],
    minAge: '',
    maxAge: '',
    businessType: 'All',
    registrationType: 'All'
  });
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  
  // Overview filter bar state
  const [overviewScope, setOverviewScope] = useState<'all' | 'region' | 'edition'>('all');
  const [overviewRegionId, setOverviewRegionId] = useState<string | null>(null);
  const [overviewEditionId, setOverviewEditionId] = useState<string | null>(null);
  const [overviewGender, setOverviewGender] = useState<'all' | 'Female' | 'Male'>('all');
  const [overviewRegions, setOverviewRegions] = useState<{ id: string; name: string }[]>([]);
  const [overviewEditions, setOverviewEditions] = useState<{ id: string; name: string }[]>([]);

  // Fetch regions and editions for overview filter bar dropdowns
  useEffect(() => {
    if (activeNav === 'overview' && mounted) {
      const fetchOverviewFilters = async () => {
        const supabase = createClient();
        if (!supabase) return;

        const { data: regionsData } = await supabase
          .from('regions')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        setOverviewRegions(regionsData || []);

        if (overviewRegionId) {
          const { data: editionsData } = await supabase
            .from('market_days')
            .select('id, name')
            .eq('region_id', overviewRegionId)
            .order('name');
          setOverviewEditions(editionsData || []);
        } else {
          setOverviewEditions([]);
        }
      };
      fetchOverviewFilters();
    }
  }, [activeNav, overviewRegionId, mounted]);
  
  // Drawer Panel & Modal States
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState('');
  const [generatedLinkPass, setGeneratedLinkPass] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  
  // Merge Proposal Queue Mock State
  const [mergeProposals, setMergeProposals] = useState<any[]>([]);

  // Form Builder States
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [formQuestions, setFormQuestions] = useState<Record<string, Question[]>>({});
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [previewFormId, setPreviewFormId] = useState<string | null>(null);

  // Quick Entry Forms States
  const [quickEntryTab, setQuickEntryTab] = useState<'paid' | 'collection' | 'walkin'>('paid');
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(true);
  
  // Quick Entry Success States
  const [paidSuccessState, setPaidSuccessState] = useState<{ show: boolean; vendorName?: string; onAddAnother: () => void }>({
    show: false,
    vendorName: undefined,
    onAddAnother: () => {}
  });
  const [collectionSuccessState, setCollectionSuccessState] = useState<{ show: boolean; vendorName?: string; onAddAnother: () => void }>({
    show: false,
    vendorName: undefined,
    onAddAnother: () => {}
  });
  const [walkinSuccessState, setWalkinSuccessState] = useState<{ show: boolean; visitorName?: string; onAddAnother: () => void }>({
    show: false,
    visitorName: undefined,
    onAddAnother: () => {}
  });

  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    type: 'paid' | 'collection' | 'walkin';
    name: string;
    phone?: string;
    detail: string;
    timestamp: string;
  }>>([]);

  // Ensure DOM is fully mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for form builder navigation from Quick Entry forms
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetSlug = customEvent.detail?.formSlug;
      setActiveNav('formbuilder');
      if (targetSlug) {
        setTimeout(() => {
          const event = new CustomEvent('select-form-in-builder', { detail: { formSlug: targetSlug } });
          window.dispatchEvent(event);
        }, 200);
      }
    };
    window.addEventListener('navigate-to-form-builder', handler);
    return () => window.removeEventListener('navigate-to-form-builder', handler);
  }, []);

  // Calculate duplicate merge proposals dynamically from live vendors
  useEffect(() => {
    const proposals: any[] = [];
    const seenPhones: Record<string, any> = {};
    vendors.forEach((v) => {
      if (v.phone) {
        if (seenPhones[v.phone]) {
          proposals.push({
            id: `mp-${v.id}-${seenPhones[v.phone].id}`,
            sourceVendor: v,
            targetVendorId: seenPhones[v.phone].id,
            reason: 'phone_match',
            createdAt: new Date(v.created_at || Date.now()).toISOString().slice(0, 16).replace('T', ' ')
          });
        } else {
          seenPhones[v.phone] = v;
        }
      }
    });
    setMergeProposals(proposals);
  }, [vendors]);

  if (!mounted || loadingVendors) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center space-y-4 select-none">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-[#21262d]"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-[#2ea043] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
        </div>
        <div className="text-center">
          <h2 className="text-xs font-bold text-[#c9d1d9] uppercase tracking-wider">Synchronizing System Data</h2>
          <p className="text-[10px] text-[#8b949e] mt-1">Connecting to secure operations environment...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. DYNAMIC QUICK ENTRY HANDLERS
  // ==========================================

  const resetPaidForm = () => {
    setPaidSuccessState(prev => ({ ...prev, show: false }));
  };

  const resetCollectionForm = () => {
    setCollectionSuccessState(prev => ({ ...prev, show: false }));
  };

  const resetWalkinForm = () => {
    setWalkinSuccessState(prev => ({ ...prev, show: false }));
  };

  const handleDynamicPhoneLookup = async (phone: string, formSlug: string): Promise<Record<string, string> | null> => {
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
      const result: Record<string, string> = {
        contact_name: v.contact_name || '',
        business_name: v.business_name || '',
        phone: v.phone || phone,
        email: v.email || '',
        category: v.category || '',
      };

      if (formSlug === 'vendor_data_collection' && activeEdition) {
        const { data: responseData } = await supabase
          .from('survey_responses')
          .select(`
            id,
            survey_answers (
              answer,
              survey_questions ( csv_column )
            )
          `)
          .eq('vendor_id', v.id)
          .eq('context_id', activeEdition.id)
          .order('submitted_at', { ascending: false })
          .limit(1);

        const surveyAnswers = responseData?.[0]?.survey_answers || [];
        surveyAnswers.forEach((a: any) => {
          const col = a.survey_questions?.csv_column;
          if (col) result[col] = a.answer;
        });
      }

      return result;
    } catch (err) {
      console.error("Phone lookup error:", err);
      return null;
    }
  };

  const handleDynamicPaidSubmit = async (answers: Record<string, string>) => {
    if (!activeEdition) {
      addToast("Please select an active event edition first!", "error");
      throw new Error("No active edition");
    }

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");

      const phone = answers.phone || '';
      const contactName = answers.contact_name || '';
      const businessName = answers.business_name || '';
      const category = answers.category || '';
      const stallNumber = answers.stall_number || '';
      const amountPaid = answers.amount_paid ? parseFloat(answers.amount_paid) : 0;
      const paymentStatus = answers.payment_status || 'paid';

      const { data: existing, error: findError } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', phone)
        .limit(1);

      if (findError) throw findError;

      let vendorId;
      if (existing && existing.length > 0) {
        vendorId = existing[0].id;
        const { error: updateError } = await supabase
          .from('vendors')
          .update({
            business_name: businessName,
            contact_name: contactName,
            email: answers.email || '',
            category: category,
            is_active: true
          })
          .eq('id', vendorId);

        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('vendors')
          .insert({
            business_name: businessName,
            contact_name: contactName,
            phone: phone,
            email: answers.email || '',
            category: category,
            is_active: true
          })
          .select();

        if (insertError) throw insertError;
        if (!inserted || inserted.length === 0) throw new Error("Failed to insert vendor profile.");
        vendorId = inserted[0].id;
      }

      if (activeEdition && vendorId) {
        const { data: existingReg } = await supabase
          .from('vendor_registrations')
          .select('id')
          .eq('vendor_id', vendorId)
          .eq('market_day_id', activeEdition.id)
          .limit(1);

        if (!existingReg || existingReg.length === 0) {
          const { error: regError } = await supabase
            .from('vendor_registrations')
            .insert({
              market_day_id: activeEdition.id,
              vendor_id: vendorId,
              stall_number: stallNumber || null,
              amount_paid: amountPaid,
              payment_status: paymentStatus,
            });
          if (regError) throw regError;
        } else {
          const { error: regUpdateError } = await supabase
            .from('vendor_registrations')
            .update({
              stall_number: stallNumber || null,
              amount_paid: amountPaid,
              payment_status: paymentStatus,
            })
            .eq('id', existingReg[0].id);
          if (regUpdateError) throw regUpdateError;
        }
      }

      fetchPaidVendors();
      fetchVendors();
      fetchOverviewCounts();
      incrementVendorsCount();

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRecentActivities(prev => [{
        id: crypto.randomUUID(),
        type: 'paid',
        name: contactName,
        phone: phone,
        detail: businessName ? `${businessName} • UGX ${amountPaid.toLocaleString()}` : `UGX ${amountPaid.toLocaleString()}`,
        timestamp: timeString
      }, ...prev]);

      setPaidSuccessState({
        show: true,
        vendorName: contactName,
        onAddAnother: () => resetPaidForm()
      });

      addToast(`Paid vendor "${contactName}" registered successfully!`, "success");
    } catch (err: any) {
      console.error("Supabase error saving vendor:", err);
      addToast("Error saving vendor: " + (err.message || err), "error");
      throw err;
    }
  };

  const handleDynamicCollectionSubmit = async (answers: Record<string, string>) => {
    if (!activeEdition) {
      addToast("Please select an active event edition first!", "error");
      throw new Error("No active edition");
    }

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");

      const phone = answers.phone || '';
      const contactName = answers.contact_name || answers.name || '';

      const { data: vendorData, error: vError } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', phone)
        .limit(1);

      if (vError) throw vError;

      if (!vendorData || vendorData.length === 0) {
        addToast("Paid registration not found. Please register this vendor using the Paid Vendor form first.", "error");
        throw new Error("Vendor not found");
      }

      const vendorId = vendorData[0].id;

      const { data: formData, error: fError } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', 'vendor_data_collection')
        .limit(1)
        .single();

      if (fError) throw fError;
      const formId = formData.id;

      const { data: resData, error: resError } = await supabase
        .from('survey_responses')
        .insert({
          form_id: formId,
          context_type: 'market_day',
          context_id: activeEdition.id,
          vendor_id: vendorId,
          source: 'manual',
          submitted_at: new Date().toISOString()
        })
        .select();

      if (resError) throw resError;
      if (!resData || resData.length === 0) throw new Error("Failed to insert survey response.");

      const responseId = resData[0].id;

      const { data: questions, error: qError } = await supabase
        .from('survey_questions')
        .select('id, csv_column')
        .eq('form_id', formId);

      if (qError) throw qError;

      const answersToInsert = [];
      for (const [csvCol, val] of Object.entries(answers)) {
        if (val !== undefined && val !== null && val !== '') {
          const q = (questions || []).find((q: any) => q.csv_column === csvCol);
          if (q) {
            answersToInsert.push({
              response_id: responseId,
              question_id: q.id,
              answer: String(val)
            });
          }
        }
      }

      if (answersToInsert.length > 0) {
        const { error: ansError } = await supabase.from('survey_answers').insert(answersToInsert);
        if (ansError) throw ansError;
      }

      fetchSurveyResponses();
      fetchVendors();
      fetchOverviewCounts();

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRecentActivities(prev => [{
        id: crypto.randomUUID(),
        type: 'collection',
        name: contactName,
        phone: phone,
        detail: `Collected: ${answers.business_name || 'General Info'} • ${activeEdition?.name || 'Event'}`,
        timestamp: timeString
      }, ...prev]);

      setCollectionSuccessState({
        show: true,
        vendorName: contactName,
        onAddAnother: () => resetCollectionForm()
      });

      addToast(`Field collection sheet for "${contactName}" saved!`, "success");
    } catch (err: any) {
      if (err.message === "Vendor not found" || err.message === "No active edition") {
        throw err;
      }
      console.error("Supabase error submitting survey:", err);
      addToast("Error submitting survey: " + (err.message || err), "error");
      throw err;
    }
  };

  const handleDynamicWalkinSubmit = async (answers: Record<string, string>) => {
    if (!activeEdition) {
      addToast("Please select an active event edition first!", "error");
      throw new Error("No active edition");
    }

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");

      const fullName = answers.full_name || 'Anonymous Visitor';
      const phone = answers.phone || '';
      const email = answers.email || '';
      const businessType = answers.business_type || '';
      const age = answers.age ? parseInt(answers.age) : null;

      const { error } = await supabase
        .from('walkins')
        .insert({
          market_day_id: activeEdition.id,
          full_name: fullName,
          phone: phone,
          email: email,
          business_type: businessType,
          age: age,
          recorded_at: new Date().toISOString()
        });

      if (error) throw error;

      fetchWalkins();
      fetchOverviewCounts();
      incrementWalkinsCount();

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRecentActivities(prev => [{
        id: crypto.randomUUID(),
        type: 'walkin',
        name: fullName,
        phone: phone,
        detail: businessType || 'Walk-in Guest',
        timestamp: timeString
      }, ...prev]);

      setWalkinSuccessState({
        show: true,
        visitorName: fullName,
        onAddAnother: () => resetWalkinForm()
      });

      addToast("Walk-in guest logged successfully!", "success");
    } catch (err: any) {
      if (err.message === "No active edition") throw err;
      console.error("Supabase error inserting walk-in:", err);
      addToast("Error submitting walk-in: " + (err.message || err), "error");
      throw err;
    }
  };

  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionName.trim()) return;
    if (regions.includes(newRegionName.trim())) {
      alert('Region already exists!');
      return;
    }
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");
      
      const { error } = await supabase
        .from('regions')
        .insert({
          name: newRegionName.trim(),
          slug: newRegionName.trim().toLowerCase()
        });
        
      if (error) throw error;
      
      setNewRegionName('');
      alert('Region created successfully!');
    } catch (err: any) {
      console.error("Error creating region:", err);
      alert("Error creating region: " + (err.message || err));
    }
  };

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketName.trim()) return;
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");
      
      const { error } = await supabase
        .from('regions')
        .insert({
          name: newMarketName.trim(),
          slug: newMarketName.trim().toLowerCase().replace(/\s+/g, '-')
        });
        
      if (error) throw error;
      
      setNewMarketName('');
      setNewMarketCity('');
      setNewMarketVendors('');
      alert('Market created successfully!');
    } catch (err: any) {
      console.error("Error creating market:", err);
      alert("Error creating market: " + (err.message || err));
    }
  };

  const handleCreateEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEditionMarketId || !newEditionDate.trim() || !newEditionVenue.trim()) return;
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");
      
      const { data: regionData, error: regError } = await supabase
        .from('regions')
        .select('id, name')
        .eq('slug', newEditionMarketId)
        .limit(1);
        
      if (regError) throw regError;
      if (!regionData || regionData.length === 0) {
        throw new Error("Region not found for market " + newEditionMarketId);
      }
      
      const regionId = regionData[0].id;
      const regionName = regionData[0].name;
      const dateStr = `${newEditionYear}-${newEditionMonth.padStart(2, '0')}-01`;

      const { error: insertError } = await supabase
        .from('market_days')
        .insert({
          name: `${regionName} ${newEditionDate}`,
          region_id: regionId,
          event_date: dateStr,
          status: 'completed'
        });

      if (insertError) throw insertError;
      
      setNewEditionDate('');
      setNewEditionVenue('');
      alert('Upcoming Edition created successfully!');
    } catch (err: any) {
      console.error("Error creating edition:", err);
      alert("Error creating edition: " + (err.message || err));
    }
  };



  const handleApproveMerge = async (proposalId: string, source: any, targetId: string) => {
    try {
      const supabase = createClient();
      if (!supabase) return;
      
      // Update target vendor to active/loyal
      const { error: updateError } = await supabase
        .from('vendors')
        .update({ is_active: true })
        .eq('id', targetId);
        
      if (updateError) throw updateError;
      
      // Delete source duplicate vendor
      const { error: deleteError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', source.id);
        
      if (deleteError) throw deleteError;
      
      alert('Merge approved and duplicate record removed!');
    } catch (err: any) {
      console.error("Merge error:", err);
      alert("Error merging profiles: " + (err.message || err));
    }
  };

  const handleRejectMerge = (proposalId: string) => {
    setMergeProposals(prev => prev.filter(p => p.id !== proposalId));
  };

  // Link Generator
  const handleGenerateLink = (formId: string) => {
    const template = formTemplates.find(t => t.id === formId);
    if (template) {
      const token = Math.random().toString(36).substring(2, 10);
      setGeneratedLinkUrl(`https://quonnect.org/forms/${token}`);
      setGeneratedLinkPass('kampala2026market');
      setIsLinkModalOpen(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLinkUrl);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Form Builder saves
  const handleSaveQuestions = (questions: Question[]) => {
    if (!editingFormId) return;
    
    setIsSavingForm(true);
    setTimeout(() => {
      // Update questions
      setFormQuestions(prev => ({
        ...prev,
        [editingFormId]: questions
      }));
      
      // Update template questionCount
      setFormTemplates(prev => prev.map(t => {
        if (t.id === editingFormId) {
          return {
            ...t,
            questionCount: questions.length,
            lastEdited: new Date().toISOString().split('T')[0]
          };
        }
        return t;
      }));
      
      setIsSavingForm(false);
      setEditingFormId(null);
    }, 800);
  };

  // Convert currently selected vendor to rich format
  const activeVendorDetail = getVendorDetailData(vendors.find(v => v.id === selectedVendorId));

  // ==========================================
  // 3. STATS COMPUTATION FOR DASHBOARD
  // ==========================================

  // Filter vendors based on user controls
  const filteredVendors = vendors.filter(v => {
    // Search filter
    if (vendorSearch) {
      const term = vendorSearch.toLowerCase();
      const matchesSearch = 
        v.name.toLowerCase().includes(term) ||
        v.phone.includes(term) ||
        v.businessName.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Region filter
    if (filters.region !== 'All' && v.region !== filters.region) {
      return false;
    }

    // Gender filter
    if (filters.gender !== 'All' && v.gender?.toLowerCase() !== filters.gender.toLowerCase()) {
      return false;
    }

    // Business classification filter
    if (filters.businessType !== 'All' && v.businessType !== filters.businessType) {
      return false;
    }

    // Status filter (multi-select)
    if (filters.statuses.length > 0 && !filters.statuses.includes(v.status.charAt(0).toUpperCase() + v.status.slice(1))) {
      return false;
    }

    // Age filters
    if (filters.minAge !== '' && v.age < filters.minAge) return false;
    if (filters.maxAge !== '' && v.age > filters.maxAge) return false;

    // Registration type filter
    if (filters.registrationType && filters.registrationType !== 'All') {
      if (filters.registrationType === 'both') {
        if (v.registrationType !== 'both') return false;
      } else if (filters.registrationType === 'paid') {
        if (v.registrationType !== 'paid' && v.registrationType !== 'both') return false;
      } else if (filters.registrationType === 'survey') {
        if (v.registrationType !== 'survey' && v.registrationType !== 'both') return false;
      }
    }

    return true;
  });

  // Overview Stats Calculation
  const totalUniqueVendorsCount = vendors.length;
  const activeVendorsList = vendors.filter(v => v.status === 'active' || v.status === 'loyal');
  
  const femaleVendorsCount = vendors.filter(v => v.gender?.toLowerCase() === 'female').length;
  const womenOwnedPctVal = totalUniqueVendorsCount > 0 
    ? Math.round((femaleVendorsCount / totalUniqueVendorsCount) * 100)
    : 0;

  const dataCollectedListCount = vendors.filter(v => v.employeeCount && v.businessType).length;
  const dataCollectedPctVal = totalUniqueVendorsCount > 0
    ? Math.round((dataCollectedListCount / totalUniqueVendorsCount) * 100)
    : 0;

  // Ages average calculation
  const totalVendorAge = vendors.reduce((acc, v) => acc + v.age, 0);
  const avgVendorAgeVal = totalUniqueVendorsCount > 0 ? Math.round(totalVendorAge / totalUniqueVendorsCount) : 0;

  const totalWalkinAge = walkins.reduce((acc, w) => acc + w.age, 0);
  const avgWalkinAgeVal = walkins.length > 0 ? Math.round(totalWalkinAge / walkins.length) : 0;

  // Age distributions helpers
  const getAgeDistribution = (list: any[]) => {
    const total = list.length;
    if (total === 0) return { '18-24': 0, '25-29': 0, '30-35': 0, '36+': 0 };
    
    const d1 = list.filter(x => x.age >= 18 && x.age <= 24).length;
    const d2 = list.filter(x => x.age >= 25 && x.age <= 29).length;
    const d3 = list.filter(x => x.age >= 30 && x.age <= 35).length;
    const d4 = list.filter(x => x.age >= 36).length;

    return {
      '18-24': Math.round((d1 / total) * 100),
      '25-29': Math.round((d2 / total) * 100),
      '30-35': Math.round((d3 / total) * 100),
      '36+': Math.round((d4 / total) * 100)
    };
  };

  const overviewData: OverviewData = {
    totalVendors: {
      value: totalUniqueVendorsCount,
      change: 12,
      changeText: '+12% from last edition'
    },
    walkinCustomers: {
      value: runningWalkins,
      changeText: 'Healthy visitor traffic flow',
      isChangePositive: true
    },
    avgVendorAge: {
      value: avgVendorAgeVal,
      distribution: getAgeDistribution(vendors)
    },
    avgWalkinAge: {
      value: avgWalkinAgeVal,
      distribution: getAgeDistribution(walkins)
    },
    returnRate: {
      value: 84
    },
    womenOwnedPct: {
      value: womenOwnedPctVal,
      target: 80
    },
    dataCollected: {
      value: dataCollectedPctVal,
      collected: dataCollectedListCount,
      total: totalUniqueVendorsCount
    }
  };

  if (!activeRegion) {
    return (
      <div className="flex min-h-screen bg-bg items-center justify-center p-6 text-left select-none">
        <div className="max-w-md w-full bg-bg-surface border border-border rounded-xl p-6 shadow-modal space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-green-muted text-green flex items-center justify-center mx-auto">
              <Map className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider">Select Workspace Region</h2>
            <p className="text-xs text-text-secondary">Choose a region to scope your data session and operational activities.</p>
          </div>

          <div className="space-y-2.5">
            {ctxRegions.length === 0 ? (
              <div className="text-center py-6">
                {loadingRegions ? (
                  <div className="flex items-center gap-2 justify-center text-text-tertiary">
                    <Loader2 className="w-5 h-5 animate-spin text-green" />
                    <span>Loading operational regions...</span>
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">No active operational regions found. Please create one below.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {ctxRegions.map((reg) => (
                  <button
                    key={reg.id}
                    onClick={() => switchRegion(reg)}
                    className="flex items-center justify-between p-3.5 bg-bg-elevated border border-border hover:border-green hover:bg-green-soft/10 text-xs font-bold text-text-primary rounded-lg transition-all text-left cursor-pointer"
                  >
                    <span>{reg.name} Region</span>
                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border/40 pt-4 text-center">
            <button
              onClick={() => {
                const name = window.prompt("Enter new region name:");
                if (name && name.trim()) {
                  handleCreateRegionFromName(name.trim());
                }
              }}
              className="text-xs font-bold text-green hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Region</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/);
    return lines
      .map(line => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      })
      .filter(row => row.length > 0 && row.some(cell => cell !== ''));
  };

  const parseCSVToObjects = (text: string, delimiter: string = ','): Record<string, string>[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    const headers = parseCSVRow(lines[0], delimiter);
    const results: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseCSVRow(lines[i], delimiter);
      const rowObj: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowObj[header] = values[index] || '';
      });
      results.push(rowObj);
    }
    return results;
  };

  const parseCSVRow = (line: string, delimiter: string = ','): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const normalizePhone = (p: string): string => {
    if (!p) return '';
    let clean = p.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '256' + clean.slice(1);
    }
    return clean;
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCollectedData = async (file: File) => {
    if (!activeEdition || !activeRegion) {
      addToast("Please select an active workspace (region & edition) first!", "error");
      return;
    }

    if (isImporting) return;
    setIsImporting(true);

    try {
      const rawText = await file.text();

      // Standard format is comma-delimited from KoboCollect
      const rows = parseCSVToObjects(rawText, ',');
      console.log("Total CSV rows parsed:", rows.length);
      if (rows.length === 0) {
        addToast("CSV is empty", "error");
        setIsImporting(false);
        return;
      }

      const firstRow = rows[0];
      console.log("First row sample:", JSON.stringify(firstRow));
      console.log("CSV headers:", Object.keys(firstRow));

      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      // 1. Fetch form by slug vendor_data_collection
      const { data: formData, error: fError } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', 'vendor_data_collection')
        .limit(1)
        .single();

      if (fError) throw fError;
      if (!formData) throw new Error("Vendor Data Collection Survey form not found in database.");
      const formId = formData.id;

      // 2. Fetch all survey questions for this form only
      const { data: questions } = await supabase
        .from('survey_questions')
        .select('id, csv_column, question_text')
        .eq('form_id', formId);

      if (!questions || questions.length === 0) {
        throw new Error("No questions found for this form.");
      }

      // 3. Standard KoboCollect form field extractor
      const getField = (row: any, ...keys: string[]): string => {
        for (const key of keys) {
          const val = row[key];
          if (val && String(val).trim()) return String(val).trim();
        }
        return '';
      };

      // 4. Standard KoboCollect CSV header → survey_question csv_column mapping
      const headerToColumn: Record<string, string> = {
        'full_name': 'full_name',
        'business_name': 'business_name',
        'phone_number': 'phone_number',
        'email': 'email',
        'gender': 'gender',
        'age': 'age',
        'business_category': 'business_category',
        'how_long_in_business': 'how_long_in_business',
        'primary_income_source': 'primary_source_of_income',
        'products_source': 'products_primarily_from',
        'business_operates_as': 'business_operates_as',
        'first_time_attendee': 'first_time_at_quonnect',
        'times_attended': 'times_attended',
        'attended_last_quonnect': 'attended_last_quonnect',
        'regions_attended': 'regions_attended',
        'has_paid_employees': 'paid_employees',
        'number_of_employees': 'number_of_employees',
        'female_employees_share': 'female_employees',
        'youth_employees_share': 'youth_employees',
        'new_employees_12mo': 'hired_new_employees',
        'hired_new_employees_12mo': 'new_employees_count',
        'business_growth_vs_before': 'business_growth',
        'quonnect_benefits_summary': 'quonnect_benefits',
        'has_active_social_media': 'active_social_media',
        'makes_online_sales': 'online_sales',
        'how_heard_about_quonnect': 'how_did_you_know',
        'would_recommend_quonnect': 'would_recommend',
        'main_challenges_summary': 'main_challenges',
        'sales_impact': 'sales_impact',
        'revenue_impact': 'revenue_impact',
      };

      // Normalize for case-insensitive matching
      const normalizedHeaderMap: Record<string, string> = {};
      Object.entries(headerToColumn).forEach(([header, csvColumn]) => {
        normalizedHeaderMap[header.toLowerCase().trim()] = csvColumn;
      });

      // Build reverse lookup: csv_column → question
      const questionByCsvColumn: Record<string, any> = {};
      questions.forEach(q => {
        if (q.csv_column) questionByCsvColumn[q.csv_column] = q;
      });

      // Metadata columns to skip
      const metadataPrefixes = ['_', '/'];
      const metadataKeywords = ['uuid', 'submission_time', 'validation_status', 'submitted_by', 'start', 'end', 'today', 'deviceid', 'simserial', 'phonenumber', 'instanceid', 'formhub/uuid', 'meta/instanceid'];

      const shouldSkipColumn = (header: string): boolean => {
        const lower = header.toLowerCase().trim();
        for (const prefix of metadataPrefixes) {
          if (lower.startsWith(prefix)) return true;
        }
        for (const kw of metadataKeywords) {
          if (lower === kw || lower.includes(kw)) return true;
        }
        if (lower.includes('/')) return true;
        return false;
      };

      let count = 0;
      let totalAnswersCount = 0;

      for (const [index, rowObj] of rows.entries()) {
        try {
          const name = getField(rowObj, 'full_name', 'contact_name');
          const phone = getField(rowObj, 'phone_number', 'phone');
          const biz = getField(rowObj, 'business_name');
          const email = getField(rowObj, 'email');
          const cat = getField(rowObj, 'business_category', 'category') || 'Fashion';

          addToast(`Importing row ${index + 1} of ${rows.length}...`, "success");

          if (!phone || !name) {
            console.warn(`Row ${index + 1} skipped — missing name or phone. Name: "${name}", Phone: "${phone}"`);
            continue;
          }

          // Insert/update vendor via upsert
          const { data: vendorResult, error: vendorError } = await supabase
            .from('vendors')
            .upsert({
              contact_name: name,
              phone: phone,
              business_name: biz,
              email: email,
              category: cat,
              is_active: true
            }, {
              onConflict: 'phone',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (vendorError) {
            console.error("Failed at row:", index + 1, vendorError.message, vendorError.code, vendorError.details);
            break;
          }

          const vendorId = vendorResult?.id;

          if (vendorId) {
            // Check if survey response already exists for this vendor and edition
            const { data: existingResponse } = await supabase
              .from('survey_responses')
              .select('id')
              .eq('form_id', formId)
              .eq('context_id', activeEdition.id)
              .eq('vendor_id', vendorId)
              .limit(1);

            let responseId;
            if (existingResponse && existingResponse.length > 0) {
              responseId = existingResponse[0].id;
            } else {
              const { data: resData, error: resError } = await supabase
                .from('survey_responses')
                .insert({
                  form_id: formId,
                  context_type: 'market_day',
                  context_id: activeEdition.id,
                  vendor_id: vendorId,
                  source: 'csv_import',
                  import_batch: file.name,
                  submitted_at: new Date().toISOString()
                })
                .select()
                .single();

              if (resError) {
                console.error("Failed at row:", index + 1, resError.message, resError.code, resError.details);
                break;
              }
              if (resData) {
                responseId = resData.id;
              }
            }

            if (responseId) {
              // Insert answers using universal header map
              const answersToInsert: any[] = [];
              Object.keys(rowObj).forEach(header => {
                if (shouldSkipColumn(header)) return;
                const csvColumn = normalizedHeaderMap[header.toLowerCase().trim()];
                if (!csvColumn) return;
                const question = questionByCsvColumn[csvColumn];
                if (!question) return;
                const value = rowObj[header];
                if (value === undefined || value === null || value === '') return;
                answersToInsert.push({
                  response_id: responseId,
                  question_id: question.id,
                  answer: String(value).trim()
                });
              });

              console.log("Inserting answers for response:", responseId, "count:", answersToInsert.length);

              if (answersToInsert.length > 0) {
                for (let c = 0; c < answersToInsert.length; c += 50) {
                  const chunk = answersToInsert.slice(c, c + 50);
                  const { error: ansError } = await supabase
                    .from('survey_answers')
                    .upsert(chunk, {
                      onConflict: 'response_id,question_id',
                      ignoreDuplicates: true
                    });
                  if (ansError) {
                    console.error("Chunk error:", c, ansError.message);
                    console.error("Failed at row:", index + 1, ansError.message, ansError.code, ansError.details);
                    break;
                  }
                }
                totalAnswersCount = answersToInsert.length;
              }
            }
            count++;
          }
        } catch (err: any) {
          console.error("Row", index + 1, "failed:", err.message);
          continue;
        }
      }

      addToast(`${count} vendors imported with ${totalAnswersCount} answers each`, "success");
      fetchVendors();
      fetchSurveyResponses();
    } catch (err: any) {
      console.error(err);
      addToast("Import failed: " + err.message, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportWalkins = async (file: File) => {
    if (!activeEdition || !activeRegion) {
      addToast("Please select an active workspace (region & edition) first!", "error");
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCSVToObjects(text);
      if (rows.length === 0) {
        addToast("CSV is empty", "error");
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      const total = rows.length;
      const walkinRows = rows.map(row => ({
        market_day_id: activeEdition.id,
        full_name: row['Full Name'] || '',
        phone: String(row['Phone Number'] || ''),
        email: row['Email'] || '',
        business_type: row['Business Type'] || '',
        age: parseInt(row['Age']) || null,
        recorded_at: new Date().toISOString()
      }));

      let inserted = 0;
      for (let i = 0; i < walkinRows.length; i += 50) {
        const chunk = walkinRows.slice(i, i + 50);
        const { error } = await supabase
          .from('walkins')
          .insert(chunk);
        if (error) {
          console.error("Walkin chunk error:", i, error.message, error.code);
        } else {
          inserted += chunk.length;
        }
        addToast(`Importing walk-in ${Math.min(i + 50, total)} of ${total}...`, "success");
      }

      addToast(`${inserted} walk-ins imported successfully`, "success");
      fetchWalkins();
    } catch (err: any) {
      console.error(err);
      addToast("Import failed: " + err.message, "error");
    }
  };

  const handleExportVendors = async () => {
    if (!activeRegion) {
      addToast("Please select an active region first!", "error");
      return;
    }
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      const { data, error } = await supabase
        .from('survey_responses')
        .select(`
          vendor_id,
          vendors (
            id,
            business_name,
            contact_name,
            phone,
            email,
            category,
            is_active
          ),
          market_days!inner (
            region_id
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (error) throw error;

      const uniqueVendors: any[] = [];
      const seenIds = new Set();
      (data || []).forEach((row: any) => {
        const v = row.vendors;
        if (v && !seenIds.has(v.id)) {
          seenIds.add(v.id);
          uniqueVendors.push(v);
        }
      });

      let csvContent = "ID,Contact Name,Business Name,Phone,Email,Category,Is Active\n";
      uniqueVendors.forEach(v => {
        csvContent += `"${v.id}","${(v.contact_name || '').replace(/"/g, '""')}","${(v.business_name || '').replace(/"/g, '""')}","${v.phone || ''}","${v.email || ''}","${v.category || ''}","${v.is_active ? 'Yes' : 'No'}"\n`;
      });

      downloadCSV(csvContent, `vendors_export_${activeRegion.slug}.csv`);
      addToast("Vendors list exported successfully!", "success");
    } catch (err: any) {
      console.error(err);
      addToast("Export failed: " + err.message, "error");
    }
  };

  const handleExportWalkins = async () => {
    if (!activeRegion) {
      addToast("Please select an active region first!", "error");
      return;
    }
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      const { data, error } = await supabase
        .from('walkins')
        .select(`
          id,
          full_name,
          phone,
          email,
          business_type,
          age,
          recorded_at,
          market_days!inner (
            region_id
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (error) throw error;

      let csvContent = "ID,Full Name,Phone,Email,Business Type,Age,Recorded At\n";
      (data || []).forEach(w => {
        const name = (w.full_name || '').replace(/"/g, '""');
        const phone = (w.phone || '').replace(/"/g, '""');
        const email = (w.email || '').replace(/"/g, '""');
        const businessType = (w.business_type || '').replace(/"/g, '""');
        const age = w.age ?? '';

        csvContent += `"${w.id}","${name}","${phone}","${email}","${businessType}","${age}","${w.recorded_at || ''}"\n`;
      });

      downloadCSV(csvContent, `walkins_export_${activeRegion.slug}.csv`);
      addToast("Walk-in records exported successfully!", "success");
    } catch (err: any) {
      console.error(err);
      addToast("Export failed: " + err.message, "error");
    }
  };

  const handleExportResponses = async () => {
    if (!activeRegion) {
      addToast("Please select an active region first!", "error");
      return;
    }
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      const { data, error } = await supabase
        .from('survey_responses')
        .select(`
          id,
          submitted_at,
          source,
          surveyed_by,
          vendor_id,
          vendors (
            contact_name,
            business_name,
            phone
          ),
          market_days!inner (
            name,
            region_id
          ),
          forms (
            name
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (error) throw error;

      let csvContent = "Response ID,Event Edition,Form Name,Contact Name,Business Name,Phone,Source,Submitted At\n";
      (data || []).forEach(sr => {
        const v = (sr as any).vendors || {};
        const md = (sr as any).market_days || {};
        const form = (sr as any).forms || {};

        csvContent += `"${sr.id}","${(md.name || '').replace(/"/g, '""')}","${(form.name || '').replace(/"/g, '""')}","${(v.contact_name || '').replace(/"/g, '""')}","${(v.business_name || '').replace(/"/g, '""')}","${v.phone || ''}","${sr.source || ''}","${sr.submitted_at || ''}"\n`;
      });

      downloadCSV(csvContent, `survey_responses_export_${activeRegion.slug}.csv`);
      addToast("Survey responses exported successfully!", "success");
    } catch (err: any) {
      console.error(err);
      addToast("Export failed: " + err.message, "error");
    }
  };

  const handleClearEditionData = async () => {
    if (!activeEdition) {
      addToast("Please select an active edition first!", "error");
      return;
    }
    const confirmed = window.confirm("Are you sure you want to clear all survey responses and imported vendor data for the active edition? This action cannot be undone.");
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      // 1. Get all vendor IDs associated with survey responses for this edition
      const { data: responses, error: fetchErr } = await supabase
        .from('survey_responses')
        .select('id, vendor_id')
        .eq('context_id', activeEdition.id);

      if (fetchErr) throw fetchErr;

      const vendorIds = responses?.map(r => r.vendor_id).filter(Boolean) || [];
      const responseIds = responses?.map(r => r.id).filter(Boolean) || [];

      // 2. Delete survey responses & answers
      if (responseIds.length > 0) {
        await supabase
          .from('survey_answers')
          .delete()
          .in('response_id', responseIds);
      }

      const { error: respErr } = await supabase
        .from('survey_responses')
        .delete()
        .eq('context_id', activeEdition.id);

      if (respErr) throw respErr;

      // 3. Delete vendors that have no other responses or registrations
      if (vendorIds.length > 0) {
        const { data: otherRegs } = await supabase
          .from('vendor_registrations')
          .select('vendor_id')
          .in('vendor_id', vendorIds);
        
        const { data: otherResps } = await supabase
          .from('survey_responses')
          .select('vendor_id')
          .in('vendor_id', vendorIds);

        const keepVendorIds = new Set([
          ...(otherRegs?.map(r => r.vendor_id) || []),
          ...(otherResps?.map(r => r.vendor_id) || [])
        ]);

        const deleteVendorIds = vendorIds.filter(id => !keepVendorIds.has(id));
        if (deleteVendorIds.length > 0) {
          const { error: vendErr } = await supabase
            .from('vendors')
            .delete()
            .in('id', deleteVendorIds);
          if (vendErr) {
            console.error("Error deleting isolated vendors:", vendErr);
          }
        }
      }

      addToast("Successfully cleared all survey responses and imported vendors for this edition.", "success");
      fetchVendors();
      fetchSurveyResponses();
    } catch (err: any) {
      console.error(err);
      addToast("Failed to clear data: " + err.message, "error");
    }
  };

  return (
    <AdminShell
      activeNav={activeNav}
      onNavChange={(navId) => {
        setActiveNav(navId);
      }}
      user={{
        name: 'Devosh Kamp',
        role: 'System Administrator',
        avatarInitials: 'DK'
      }}
      vendorAlertCount={mergeProposals.length}
    >
      {/* ==========================================
          ROUTE RENDERING
          ========================================== */}
        <>
          {/* 1. OVERVIEW SCREEN */}
          {activeNav === 'overview' && (
            <div className="space-y-6 animate-fade-in text-left">
              {/* Top Banner Row */}
              <div className="flex justify-between items-center select-none">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-text-primary">Operational Overview</h1>
                  <p className="text-xs text-text-secondary mt-0.5">Real-time indicators and metrics for {currentMarket.name}.</p>
                </div>
              </div>

              {/* Live Status Counter Component */}
              <LiveCounter
                isActiveEdition={overviewScope === 'edition' && !!overviewEditionId}
                paidVendorsCount={runningCount}
                dataCollectedCount={dataCollectedListCount}
                totalPaidVendorsCount={totalUniqueVendorsCount}
                walkinsCount={runningWalkins}
                onRefresh={handleRefreshLiveCounter}
                isRefreshing={isRefreshing}
              />

              {/* Alert Banners */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {mergeProposals.length > 0 && (
                  <AlertBanner
                    type="warning"
                    title="Manual Verification Required"
                    subtitle={`Flagged duplicate warning: ${mergeProposals.length} vendor profiles share identifiers.`}
                  />
                )}
                <AlertBanner
                  type="success"
                  title="Completed Target Milestones"
                  subtitle="Data completeness checks for Kampala April 2026 passed auditing targets (91%)."
                />
              </div>

              {/* Live Overview Counts Card */}
              {activeEdition && (
                <div className="bg-bg-surface border border-green/20 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green"></span>
                    </span>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">{activeRegion?.name} {activeEdition.name}</h3>
                    <Badge variant="success" size="sm">LIVE</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-bg-elevated rounded-lg p-3 text-center">
                      <CreditCard className="w-5 h-5 text-green mx-auto mb-1.5" />
                      <span className="block text-2xl font-bold text-text-primary">{overviewCounts.paidVendors}</span>
                      <span className="block text-[10px] text-text-tertiary uppercase tracking-wider font-bold mt-0.5">Paid Vendors</span>
                    </div>
                    <div className="bg-bg-elevated rounded-lg p-3 text-center">
                      <Footprints className="w-5 h-5 text-green mx-auto mb-1.5" />
                      <span className="block text-2xl font-bold text-text-primary">{overviewCounts.walkins}</span>
                      <span className="block text-[10px] text-text-tertiary uppercase tracking-wider font-bold mt-0.5">Walk-ins</span>
                    </div>
                    <div className="bg-bg-elevated rounded-lg p-3 text-center">
                      <ClipboardList className="w-5 h-5 text-green mx-auto mb-1.5" />
                      <span className="block text-2xl font-bold text-text-primary">{overviewCounts.surveyResponses}</span>
                      <span className="block text-[10px] text-text-tertiary uppercase tracking-wider font-bold mt-0.5">Survey Data</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Overview Filter Bar */}
              <div className="bg-bg-surface border border-border rounded-lg p-4 flex flex-wrap items-center gap-3 select-none">
                {/* Scope dropdown */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Scope</span>
                </div>
                <select
                  value={overviewScope}
                  onChange={(e) => {
                    const v = e.target.value as 'all' | 'region' | 'edition';
                    setOverviewScope(v);
                    if (v === 'all') { setOverviewRegionId(null); setOverviewEditionId(null); }
                    if (v === 'region') setOverviewEditionId(null);
                  }}
                  className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3 py-2 cursor-pointer outline-none focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[140px]"
                >
                  <option value="all">All Regions</option>
                  <option value="region">By Region</option>
                  <option value="edition">By Edition</option>
                </select>

                {/* Region dropdown — visible when scope is region or edition */}
                {(overviewScope === 'region' || overviewScope === 'edition') && (
                  <select
                    value={overviewRegionId || ''}
                    onChange={(e) => {
                      setOverviewRegionId(e.target.value || null);
                      setOverviewEditionId(null);
                    }}
                    className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3 py-2 cursor-pointer outline-none focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[140px]"
                  >
                    <option value="">All Regions</option>
                    {overviewRegions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}

                {/* Edition dropdown — visible only when scope is edition with region selected */}
                {overviewScope === 'edition' && overviewRegionId && (
                  <select
                    value={overviewEditionId || ''}
                    onChange={(e) => setOverviewEditionId(e.target.value || null)}
                    className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3 py-2 cursor-pointer outline-none focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[160px]"
                  >
                    <option value="">All Editions</option>
                    {overviewEditions.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                )}

                {/* Gender filter — always visible */}
                <select
                  value={overviewGender}
                  onChange={(e) => setOverviewGender(e.target.value as 'all' | 'Female' | 'Male')}
                  className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3 py-2 cursor-pointer outline-none focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[130px]"
                >
                  <option value="all">All Genders</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>

                {/* Clear button */}
                {(overviewScope !== 'all' || overviewGender !== 'all') && (
                  <button
                    onClick={() => {
                      setOverviewScope('all');
                      setOverviewRegionId(null);
                      setOverviewEditionId(null);
                      setOverviewGender('all');
                    }}
                    className="text-[10px] font-bold text-text-tertiary hover:text-red transition-colors cursor-pointer ml-1"
                  >
                    <X className="w-3.5 h-3.5 inline mr-0.5" />
                    Clear filters
                  </button>
                )}
              </div>

              {/* Active filter badges */}
              {(overviewScope !== 'all' || overviewGender !== 'all') && (
                <div className="flex flex-wrap items-center gap-1.5 -mt-3">
                  {overviewScope !== 'all' && overviewRegionId && (
                    <span className="text-[10px] font-semibold bg-green-muted text-green px-2 py-0.5 rounded-full">
                      {overviewRegions.find(r => r.id === overviewRegionId)?.name || 'Region'}
                    </span>
                  )}
                  {overviewScope === 'edition' && overviewEditionId && (
                    <span className="text-[10px] font-semibold bg-green-muted text-green px-2 py-0.5 rounded-full">
                      {overviewEditions.find(e => e.id === overviewEditionId)?.name || 'Edition'}
                    </span>
                  )}
                  {overviewGender !== 'all' && (
                    <span className="text-[10px] font-semibold bg-purple-muted text-purple px-2 py-0.5 rounded-full">
                      {overviewGender}
                    </span>
                  )}
                </div>
              )}

              {/* Overview Metrics Cards */}
              <OverviewCards
                data={overviewData}
                activeFilter={overviewScope !== 'all' || overviewGender !== 'all' ? JSON.stringify({ scope: overviewScope, regionId: overviewRegionId, editionId: overviewEditionId, gender: overviewGender }) : null}
              />

              {/* Render dynamic charts / graphs mock (Phase 2 preview placeholder) */}
              <div className="w-full select-none">
                <div className="bg-bg-surface border border-border rounded-lg p-5">
                  <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-green" /> <span>Business Sector Breakdown</span>
                  </h4>
                  <div className="space-y-3 pt-2">
                    {/* Fashion */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-text-secondary">
                        <span>Fashion & Knitwear</span>
                        <span>42%</span>
                      </div>
                      <div className="w-full h-2 bg-bg-input rounded-full overflow-hidden">
                        <div className="h-full bg-green rounded-full" style={{ width: '42%' }} />
                      </div>
                    </div>
                    {/* Beauty */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-text-secondary">
                        <span>Cosmetics & Beauty</span>
                        <span>24%</span>
                      </div>
                      <div className="w-full h-2 bg-bg-input rounded-full overflow-hidden">
                        <div className="h-full bg-purple rounded-full" style={{ width: '24%' }} />
                      </div>
                    </div>
                    {/* Food */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-text-secondary">
                        <span>Catering & Food Processing</span>
                        <span>18%</span>
                      </div>
                      <div className="w-full h-2 bg-bg-input rounded-full overflow-hidden">
                        <div className="h-full bg-blue rounded-full" style={{ width: '18%' }} />
                      </div>
                    </div>
                    {/* Crafts */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-text-secondary">
                        <span>Carvings & Handcrafts</span>
                        <span>16%</span>
                      </div>
                      <div className="w-full h-2 bg-bg-input rounded-full overflow-hidden">
                        <div className="h-full bg-amber rounded-full" style={{ width: '16%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. VENDORS REGISTRY SCREEN */}
          {activeNav === 'vendors' && (
            <div className="space-y-5 animate-fade-in text-left">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-text-primary">Vendors Directory</h1>
                <p className="text-xs text-text-secondary mt-0.5">Detailed database list of registered vendors.</p>
              </div>

              {/* Shared filters row */}
              <FilterBar
                filters={filters}
                onFiltersChange={(updates) => setFilters(prev => ({ ...prev, ...updates }))}
                editions={editions}
                businessTypes={BUSINESS_TYPES}
                onClearFilters={() => setFilters({
                  region: 'All',
                  editionId: 'All',
                  gender: 'All',
                  statuses: [],
                  minAge: '',
                  maxAge: '',
                  businessType: 'All',
                  registrationType: 'All'
                })}
              />

              {error && (
                <div className="bg-red-soft border border-red/20 text-red rounded-lg p-5">
                  <div className="font-bold text-sm">Error Loading Vendors</div>
                  <div className="text-xs mt-1">{error}</div>
                </div>
              )}

              {loadingVendors && !error && (
                <div className="flex flex-col items-center justify-center p-12 bg-bg-surface border border-border rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green"></div>
                  <div className="text-xs text-text-secondary mt-3">Fetching live vendor directory...</div>
                </div>
              )}

              {!loadingVendors && !error && (
                <VendorTable
                  vendors={filteredVendors}
                  selectedVendorIds={selectedVendorIds}
                  onSelectVendor={(id, selected) => {
                    if (selected) {
                      setSelectedVendorIds([...selectedVendorIds, id]);
                    } else {
                      setSelectedVendorIds(selectedVendorIds.filter(x => x !== id));
                    }
                  }}
                  onSelectAll={(selected) => {
                    setSelectedVendorIds(selected ? filteredVendors.map(v => v.id) : []);
                  }}
                  onRowClick={(v) => {
                    setSelectedVendorId(v.id);
                    setIsDetailOpen(true);
                  }}
                  searchTerm={vendorSearch}
                  onSearchChange={setVendorSearch}
                />
              )}
            </div>
          )}

          {/* 3. WALK-INS LIST SCREEN */}
          {activeNav === 'walkins' && (() => {
            const filteredWalkins = walkins.filter(w => {
              const walkinRegionVal = (w as any).region || 'Kampala';
              if (walkinRegionFilter !== 'All' && walkinRegionVal !== walkinRegionFilter) return false;
              
              const walkinEditionVal = (w as any).editionId || 'may-2026';
              if (walkinEditionFilter !== 'All' && walkinEditionVal !== walkinEditionFilter) return false;

              if (walkinBusinessTypeFilter !== 'All' && (w as any).business_type !== walkinBusinessTypeFilter) return false;

              if (walkinMinAgeFilter !== '' && w.age < walkinMinAgeFilter) return false;
              if (walkinMaxAgeFilter !== '' && w.age > walkinMaxAgeFilter) return false;

              return true;
            });

            return (
              <div className="space-y-5 animate-fade-in text-left">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-text-primary">Walk-in Traffic Logs</h1>
                    <p className="text-xs text-text-secondary mt-0.5">Logs of customer walk-ins entered during market days.</p>
                  </div>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => {
                      setActiveNav('quick-entry');
                      setQuickEntryTab('walkin');
                    }}
                  >
                    <Plus className="w-4 h-4 text-black" />
                    <span>Register Walk-in Guest</span>
                  </Button>
                </div>

                {/* Walk-ins Filter Bar */}
                <div className="bg-bg-surface border border-border rounded-lg p-4 flex flex-wrap gap-4 items-end text-xs select-none">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Region</label>
                    <select 
                      value={walkinRegionFilter} 
                      onChange={(e) => setWalkinRegionFilter(e.target.value)}
                      className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3 py-2 cursor-pointer outline-none focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[120px]"
                    >
                      <option value="All">All Regions</option>
                      {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Edition</label>
                    <select 
                      value={walkinEditionFilter} 
                      onChange={(e) => setWalkinEditionFilter(e.target.value)}
                      className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3 py-2 cursor-pointer outline-none focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[140px]"
                    >
                      <option value="All">All Editions</option>
                      {editions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Age Range</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        placeholder="Min" 
                        value={walkinMinAgeFilter}
                        onChange={(e) => setWalkinMinAgeFilter(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-16 bg-bg-elevated border border-border-light rounded-md px-2.5 py-1.5 text-text-primary text-xs outline-none focus:border-green"
                      />
                      <span className="text-text-tertiary font-bold">—</span>
                      <input 
                        type="number" 
                        placeholder="Max" 
                        value={walkinMaxAgeFilter}
                        onChange={(e) => setWalkinMaxAgeFilter(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-16 bg-bg-elevated border border-border-light rounded-md px-2.5 py-1.5 text-text-primary text-xs outline-none focus:border-green"
                      />
                    </div>
                  </div>

                  {(walkinRegionFilter !== 'All' || walkinEditionFilter !== 'All' || walkinMinAgeFilter !== '' || walkinMaxAgeFilter !== '') && (
                    <button 
                      onClick={() => {
                        setWalkinRegionFilter('All');
                        setWalkinEditionFilter('All');
                        setWalkinBusinessTypeFilter('All');
                        setWalkinMinAgeFilter('');
                        setWalkinMaxAgeFilter('');
                      }}
                      className="text-text-secondary hover:text-red transition-colors font-semibold py-2 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear Filters</span>
                    </button>
                  )}
                </div>

                <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-bg-elevated border-b border-border">
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Full Name</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Phone</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Business Type</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-center">Age</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Recorded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-xs">
                      {filteredWalkins.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-text-tertiary font-medium">
                            No walk-in logs found. Try registering a new walk-in guest above.
                          </td>
                        </tr>
                      ) : (
                        filteredWalkins.map((w) => (
                          <tr key={w.id} className="hover:bg-green-soft/10">
                            <td className="p-3.5">
                              <span className="block font-bold text-text-primary">{w.full_name}</span>
                            </td>
                            <td className="p-3.5 text-text-secondary font-medium">{w.phone || '—'}</td>
                            <td className="p-3.5 text-text-secondary font-semibold">{w.business_type || '—'}</td>
                            <td className="p-3.5 text-center">
                              <Badge variant="neutral" size="sm" className="font-bold">{w.age}</Badge>
                            </td>
                            <td className="p-3.5 text-text-secondary font-medium">{w.date}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* 3.5 PAID VENDORS */}
          {activeNav === 'paid-vendors' && (
            <div className="space-y-5 animate-fade-in text-left">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-text-primary">Paid Vendors</h1>
                  <p className="text-xs text-text-secondary mt-0.5">Vendor registration and payment tracking per edition.</p>
                </div>
              </div>

              {!activeEdition ? (
                <div className="bg-bg-surface border border-border rounded-lg p-12 text-center">
                  <CreditCard className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-text-secondary font-semibold">Select an edition to view paid vendors</p>
                </div>
              ) : (
                <>
                  {/* Live Count Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-bg-surface border border-green/20 rounded-lg p-4 flex flex-col">
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Paid Vendors</span>
                      <span className="text-2xl font-bold text-green">{paidVendorCounts.paid}</span>
                      <span className="text-[10px] text-text-secondary mt-1">payment_status = paid</span>
                    </div>
                    <div className="bg-bg-surface border border-yellow/20 rounded-lg p-4 flex flex-col">
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Pending Vendors</span>
                      <span className="text-2xl font-bold text-yellow">{paidVendorCounts.unpaid}</span>
                      <span className="text-[10px] text-text-secondary mt-1">unpaid / partial / pending</span>
                    </div>
                    <div className="bg-bg-surface border border-purple/20 rounded-lg p-4 flex flex-col">
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Total Revenue</span>
                      <span className="text-2xl font-bold text-purple">UGX {paidVendorCounts.revenue.toLocaleString()}</span>
                      <span className="text-[10px] text-text-secondary mt-1">sum of amount_paid</span>
                    </div>
                  </div>

                  {/* Paid Vendors Table */}
                  <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
                    {loadingPaidVendors ? (
                      <div className="p-12 text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-green border-t-transparent rounded-full mx-auto mb-3" />
                        <p className="text-xs text-text-tertiary font-medium">Loading paid vendors...</p>
                      </div>
                    ) : paidVendors.length === 0 ? (
                      <div className="p-12 text-center">
                        <CreditCard className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
                        <p className="text-sm text-text-secondary font-semibold">No paid vendors yet for this edition.</p>
                        <p className="text-xs text-text-tertiary mt-1">Add them via Quick Entry.</p>
                      </div>
                    ) : (
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-bg-elevated border-b border-border">
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Business Name</th>
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Contact Name</th>
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Phone</th>
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Category</th>
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-center">Status</th>
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Stall #</th>
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-right">Amount Paid</th>
                            <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Registered</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-xs">
                          {paidVendors.map((pv) => (
                            <tr key={pv.id} className="hover:bg-green-soft/10">
                              <td className="p-3.5">
                                <span className="block font-bold text-text-primary">{pv.business_name}</span>
                              </td>
                              <td className="p-3.5 text-text-secondary font-medium">{pv.contact_name}</td>
                              <td className="p-3.5 text-text-secondary font-medium">{pv.phone || '—'}</td>
                              <td className="p-3.5 text-text-secondary font-semibold">{pv.category || '—'}</td>
                              <td className="p-3.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  pv.payment_status === 'paid' ? 'bg-green-muted text-green' :
                                  pv.payment_status === 'waived' ? 'bg-gray-100 text-text-tertiary' :
                                  'bg-yellow-muted text-yellow'
                                }`}>
                                  {pv.payment_status}
                                </span>
                              </td>
                              <td className="p-3.5 text-text-secondary font-medium">{pv.stall_number || '—'}</td>
                              <td className="p-3.5 text-right text-text-primary font-bold">UGX {Number(pv.amount_paid).toLocaleString()}</td>
                              <td className="p-3.5 text-text-secondary font-medium">
                                {pv.created_at ? new Date(pv.created_at).toLocaleString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 4. QUICK ENTRY PANEL */}
          {activeNav === 'quick-entry' && (
            <div className="space-y-5 animate-fade-in text-left max-w-2xl mx-auto">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-text-primary">Quick Entry Panel</h1>
                <p className="text-xs text-text-secondary mt-0.5">Admin-side data entry forms for fast registration workflows.</p>
              </div>

              {/* Active Workspace summary */}
              <div className="bg-bg-surface border border-border rounded-lg p-4 flex items-center justify-between select-none">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-soft/10 text-green flex items-center justify-center font-bold">
                    <Map className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider block">Active Workspace</label>
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5 mt-0.5">
                      {activeRegion ? activeRegion.name : 'No Region'} 
                      <span className="text-text-tertiary font-normal">/</span> 
                      <span className="text-green">{activeEdition ? activeEdition.name : 'No Edition'}</span>
                    </span>
                  </div>
                </div>
                <Badge variant={activeEdition ? "success" : "neutral"} size="sm" className="font-extrabold select-none uppercase">
                  {activeEdition ? "Ready" : "Select Edition"}
                </Badge>
              </div>

              <QuickEntryPanel
                disabled={!activeEdition}
                activeTab={quickEntryTab}
                onTabChange={setQuickEntryTab}
                isOpen={isQuickEntryOpen}
                onToggleCollapse={() => setIsQuickEntryOpen(!isQuickEntryOpen)}
                activeEdition={activeEdition}
                onPaidSubmit={handleDynamicPaidSubmit}
                onCollectionSubmit={handleDynamicCollectionSubmit}
                onWalkinSubmit={handleDynamicWalkinSubmit}
                onPhoneLookup={handleDynamicPhoneLookup}
                paidCount={runningCount}
                collectionCount={dataCollectedListCount}
                walkinCount={runningWalkins}
                paidSuccessState={{
                  show: paidSuccessState.show,
                  name: paidSuccessState.vendorName,
                  onAddAnother: () => resetPaidForm()
                }}
                collectionSuccessState={{
                  show: collectionSuccessState.show,
                  name: collectionSuccessState.vendorName,
                  onAddAnother: () => resetCollectionForm()
                }}
                walkinSuccessState={{
                  show: walkinSuccessState.show,
                  name: walkinSuccessState.visitorName,
                  onAddAnother: () => resetWalkinForm()
                }}
              />

              {/* Live Session Activity Feed */}
              <div className="bg-bg-surface border border-border rounded-lg overflow-hidden mt-6 animate-fade-in select-none">
                <div className="p-4 bg-bg-elevated/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green"></span>
                    </span>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Live Session Entries</h3>
                  </div>
                  {recentActivities.length > 0 && (
                    <button 
                      onClick={() => setRecentActivities([])}
                      className="text-[10px] font-bold text-red hover:underline cursor-pointer transition-all"
                    >
                      Clear Log
                    </button>
                  )}
                </div>
                
                <div className="p-4 max-h-[380px] overflow-y-auto space-y-2.5">
                  {recentActivities.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border rounded-md bg-bg-surface/10">
                      <p className="text-xs text-text-secondary">No entries recorded this session yet.</p>
                      <p className="text-[10px] text-text-tertiary mt-1">Newly submitted registrations will appear here in real-time.</p>
                    </div>
                  ) : (
                    recentActivities.map((activity) => {
                      const getIcon = () => {
                        switch (activity.type) {
                          case 'paid': return <Users className="w-4 h-4 text-green" />;
                          case 'collection': return <Database className="w-4 h-4 text-blue" />;
                          case 'walkin': return <Footprints className="w-4 h-4 text-purple" />;
                        }
                      };
                      const getBadgeColor = () => {
                        switch (activity.type) {
                          case 'paid': return 'bg-green-muted text-green border-green/20';
                          case 'collection': return 'bg-blue-muted text-blue border-blue/20';
                          case 'walkin': return 'bg-purple-muted text-purple border-purple/20';
                        }
                      };
                      const getLabel = () => {
                        switch (activity.type) {
                          case 'paid': return 'Paid Vendor';
                          case 'collection': return 'Collection';
                          case 'walkin': return 'Walk-in';
                        }
                      };

                      return (
                        <div 
                          key={activity.id} 
                          className="flex items-center justify-between p-3 rounded-lg border border-border-light bg-bg-elevated/40 hover:bg-bg-elevated/70 transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-bg-surface border border-border-light flex items-center justify-center">
                              {getIcon()}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-primary text-xs">{activity.name}</span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getBadgeColor()}`}>
                                  {getLabel()}
                                </span>
                              </div>
                              <div className="text-[10px] text-text-secondary flex items-center gap-1.5">
                                <span>{activity.detail}</span>
                                {activity.phone && (
                                  <>
                                    <span className="text-text-tertiary">•</span>
                                    <span>{activity.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-mono font-medium text-text-tertiary">{activity.timestamp}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}



          {/* IMPORT/EXPORT PANEL */}
          {activeNav === 'import-export' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-text-primary">Data Import & Export Pipeline</h1>
                  <p className="text-xs text-text-secondary mt-0.5">Upload external CSV records or extract compiled event data sheets.</p>
                </div>
              </div>

              {/* Active Workspace summary */}
              <div className="bg-bg-surface border border-border rounded-lg p-4 flex items-center justify-between select-none max-w-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-soft/10 text-green flex items-center justify-center font-bold">
                    <Map className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider block">Active Workspace</label>
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5 mt-0.5">
                      {activeRegion ? activeRegion.name : 'No Region'} 
                      <span className="text-text-tertiary font-normal">/</span> 
                      <span className="text-green">{activeEdition ? activeEdition.name : 'No Edition'}</span>
                    </span>
                  </div>
                </div>
                <Badge variant={activeEdition ? "success" : "neutral"} size="sm" className="font-extrabold select-none uppercase">
                  {activeEdition ? "Ready" : "Select Edition"}
                </Badge>
              </div>

              {/* Hidden file inputs */}
              <input 
                type="file" 
                ref={fileInputRef1} 
                className="hidden" 
                accept=".csv" 
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportCollectedData(f); }} 
              />
              <input 
                type="file" 
                ref={fileInputRef2} 
                className="hidden" 
                accept=".csv" 
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportWalkins(f); }} 
              />

              {/* Upload Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 select-none">
                {/* Card 1: Kobo data */}
                <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
                  {!activeEdition && (
                    <div className="absolute inset-0 bg-bg-surface/85 backdrop-blur-xs flex items-center justify-center p-4 text-center z-10">
                      <span className="text-xs text-text-secondary font-semibold">Select active edition to upload</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-blue-muted text-blue flex items-center justify-center">
                        <Database className="w-5 h-5 animate-pulse" />
                      </div>
                      <h3 className="font-bold text-sm text-text-primary">Upload Collected Data (Kobo / CSV)</h3>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Historical demographics survey or direct Kobo export sheets from past market activities.
                    </p>
                    <p className="text-[10px] text-text-tertiary italic leading-relaxed">
                      Note: CSV must be exported from the standard Quonnect KoboCollect form. Older form exports may have missing fields.
                    </p>
                    <div className="inline-block bg-bg-elevated border border-border-light rounded px-2.5 py-1 text-[10px] text-text-secondary font-mono">
                      name · phone · business_name · category · employees
                    </div>
                  </div>
                  <div className="pt-5">
                    <Button variant="primary" fullWidth onClick={() => fileInputRef1.current?.click()} disabled={isImporting}>
                      <span>{isImporting ? "Importing..." : "Upload CSV"}</span>
                    </Button>
                  </div>
                </div>

                {/* Card 2: Walk-in records */}
                <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
                  {!activeEdition && (
                    <div className="absolute inset-0 bg-bg-surface/85 backdrop-blur-xs flex items-center justify-center p-4 text-center z-10">
                      <span className="text-xs text-text-secondary font-semibold">Select active edition to upload</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-amber-muted text-amber flex items-center justify-center">
                        <Footprints className="w-5 h-5 animate-pulse" />
                      </div>
                      <h3 className="font-bold text-sm text-text-primary">Upload Walk-in Records</h3>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Visitor log sheets compiled manually or through gate-keeping forms outside the network range.
                    </p>
                    <div className="inline-block bg-bg-elevated border border-border-light rounded px-2.5 py-1 text-[10px] text-text-secondary font-mono">
                      Full Name · Phone Number · Email · Business Type · Age
                    </div>
                  </div>
                  <div className="pt-5">
                    <Button variant="primary" fullWidth onClick={() => fileInputRef2.current?.click()}>
                      <span>Upload CSV</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Clear Edition Data Section */}
              <div className="bg-bg-surface border border-red/20 rounded-xl p-5 select-none flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-left flex-1">
                  <h3 className="font-bold text-sm text-red">Clear responses for active edition</h3>
                  <p className="text-xs text-text-secondary leading-normal max-w-xl">
                    Delete existing survey responses and imported vendor records associated with <span className="font-bold text-text-primary">{activeEdition ? activeEdition.name : 'the selected edition'}</span>. This lets you re-import clean CSV files without duplicates.
                  </p>
                </div>
                <div className="shrink-0">
                  <Button variant="danger" onClick={handleClearEditionData} disabled={!activeEdition}>
                    <span>Clear & Reset Data</span>
                  </Button>
                </div>
              </div>

              {/* Export Sheets Panel */}
              <div className="bg-bg-surface border border-border rounded-xl p-5 select-none space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-text-primary">Export Active Region Data Sheets</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Download complete data spreadsheets filtered for active region: <span className="font-bold text-green">{activeRegion ? activeRegion.name : 'No active region'}</span>.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <Button variant="secondary" onClick={handleExportVendors} disabled={!activeRegion}>
                    <span>Export Vendors CSV</span>
                  </Button>
                  <Button variant="secondary" onClick={handleExportWalkins} disabled={!activeRegion}>
                    <span>Export Walk-ins CSV</span>
                  </Button>
                  <Button variant="secondary" onClick={handleExportResponses} disabled={!activeRegion}>
                    <span>Export Survey Responses CSV</span>
                  </Button>
                </div>
              </div>

              {/* Recent Uploads Table */}
              <div className="bg-bg-surface border border-border rounded-lg p-5 select-none">
                <div className="font-bold text-xs text-text-primary mb-3">Recent Uploads Log</div>
                <div className="text-xs text-text-secondary py-2">
                  No recent spreadsheet uploads logged for the selected edition/region.
                </div>
              </div>
            </div>
          )}

          {/* CREATE MARKET PANEL */}
          {activeNav === 'markets' && (
            <MarketConfigurationPanel />
          )}

          {/* 6. FORM TEMPLATE LIST / FORM BUILDER MANAGEMENT SCREEN */}
          {activeNav === 'formbuilder' && (
            <FormBuilderPanel />
          )}

          {/* 7. OTHER SYSTEM PLACES (PLACEHOLDERS) */}
          {!['overview', 'vendors', 'walkins', 'quick-entry', 'formbuilder', 'import-export', 'markets'].includes(activeNav) && (
            <div className="py-24 text-center border border-dashed border-border rounded-lg select-none text-left animate-fade-in">
              <ClipboardList className="w-12 h-12 text-green mx-auto mb-3 opacity-80" />
              <h3 className="text-sm font-bold text-text-primary">Module Under Implementation</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto mt-2">
                The <span className="text-green font-semibold">"{activeNav}"</span> screen has scaffolding definitions ready and is scheduled for implementation in the next milestone phase.
              </p>
              <div className="mt-5 flex justify-center gap-2.5">
                <Button variant="secondary" onClick={() => setActiveNav('overview')}>
                  Return to Dashboard
                </Button>
              </div>
            </div>
          )}
        </>

      {/* ==========================================
          MODALS & DRAWERS OVERLAYS
          ========================================== */}

      {/* Vendor Detail Drawer Panel */}
      <VendorDetailPanel
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedVendorId(null);
        }}
        vendor={activeVendorDetail}
        onEdit={(id) => {
          alert(`Editing profile details for vendor ID: ${id}`);
        }}
        onFlagMerge={(id) => {
          const vendorObj = vendors.find(v => v.id === id);
          if (vendorObj) {
            const newProposal = {
              id: 'mp_' + Math.random().toString(36).substring(7),
              sourceVendor: {
                id: vendorObj.id,
                name: vendorObj.name,
                phone: vendorObj.phone,
                businessName: vendorObj.businessName,
                gender: vendorObj.gender,
                status: vendorObj.status,
                region: vendorObj.region,
                attendanceCount: vendorObj.attendanceCount,
                lastSeen: vendorObj.lastSeen
              },
              targetVendorId: vendors.find(v => v.id !== id)?.id || id,
              reason: 'admin_manual',
              createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
            };
            setMergeProposals([newProposal, ...mergeProposals]);
            alert('Vendor flagged. Proposal added to Data Audit review queue.');
            setIsDetailOpen(false);
          }
        }}
      />

      {/* Generated link Modal Overlay */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9000] select-none text-left">
          <div className="bg-bg-surface border border-border rounded-lg max-w-md w-full p-5 shadow-modal animate-scale-up space-y-4.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-green-muted text-green rounded-full flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-green" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Collection Link Created</h3>
                <span className="text-[10px] text-text-tertiary font-semibold uppercase mt-0.5">Secure Form Distribution</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-text-secondary leading-normal">
                Share this secure URL with field data collectors. Session keys will automatically clear on tab close.
              </p>

              {/* URL Link Input copy box */}
              <div className="space-y-1">
                <span className="text-[10px] text-text-tertiary uppercase font-bold">Secure Form Address</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLinkUrl}
                    readOnly
                    className="flex-1 bg-bg-input border border-border-light rounded-md px-3 py-1.5 text-xs text-green outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-2 bg-bg-elevated border border-border-light rounded-md text-text-secondary hover:text-green cursor-pointer"
                  >
                    {copiedText ? <Check className="w-4 h-4 text-green" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password credentials */}
              <div className="bg-bg-input border border-border/40 rounded p-3 text-xs select-none">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary font-semibold">Event Password:</span>
                  <code className="text-green font-bold bg-green-soft px-2 py-0.5 rounded font-mono text-[11px]">{generatedLinkPass}</code>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/60">
              <Button variant="primary" size="sm" onClick={() => setIsLinkModalOpen(false)}>
                <span>Dismiss</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Form Simulator Modal */}
      {previewFormId && (
        <FormPreview
          isOpen={!!previewFormId}
          onClose={() => setPreviewFormId(null)}
          formName={formTemplates.find(t => t.id === previewFormId)?.name || ''}
          questions={formQuestions[previewFormId] || []}
        />
      )}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-lg shadow-lg text-xs font-semibold text-white animate-slide-up pointer-events-auto border ${
              toast.type === 'success' 
                ? 'bg-green-soft/90 border-green text-green' 
                : 'bg-red-soft/90 border-red text-red'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-text-secondary hover:text-text-primary p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
