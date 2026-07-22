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
import { WalkinFormValues } from '@/components/forms/WalkinForm';
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
  Store,
  Calendar,
  Map,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle
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
  const { activeRegion, activeEdition, regions: ctxRegions, switchRegion, loadingRegions, editions: ctxEditions, setActiveEdition } = useRegion();

  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' }>>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const fileInputRef3 = useRef<HTMLInputElement>(null);

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

  const fetchVendors = async () => {
    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase client not initialized.");
        setLoadingVendors(false);
        return;
      }

      if (!activeRegion) {
        setVendors([]);
        setRunningCount(0);
        setLoadingVendors(false);
        return;
      }

      let query = supabase
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
            is_active,
            created_at
          ),
          market_days!inner (
            id,
            region_id
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (activeEdition) {
        query = query.eq('context_id', activeEdition.id);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const uniqueVendors: any[] = [];
      const seenIds = new Set();
      (data || []).forEach((row: any) => {
        const v = row.vendors;
        if (v && !seenIds.has(v.id)) {
          seenIds.add(v.id);
          uniqueVendors.push(v);
        }
      });

      const mappedVendors = uniqueVendors.map((v: any) => {
        return {
          id: v.id,
          name: v.contact_name || 'Anonymous',
          phone: v.phone || '',
          businessName: v.business_name || '',
          gender: 'Female',
          status: v.is_active ? ('active' as const) : ('new' as const),
          region: activeRegion.name,
          attendanceCount: 1,
          lastSeen: activeEdition ? activeEdition.name : 'May 2026',
          age: 28,
          employeeCount: '',
          newHiresThisYear: '',
          businessType: v.category || 'Fashion',
          sellsOwnProducts: 'Yes',
          exportReady: 'No',
          impactRating: 4,
          businessGrowthNarrative: '',
          dob: '',
          amountPaid: '0',
          email: v.email || ''
        };
      });

      setVendors(mappedVendors);
      setRunningCount(mappedVendors.length);
      setError(null);
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
        let parsedNotes: any = {};
        try {
          if (w.notes) parsedNotes = JSON.parse(w.notes);
        } catch (e) {}

        return {
          id: w.id,
          name: parsedNotes.name || w.recorded_by || 'Anonymous Visitor',
          phone: parsedNotes.phone || '',
          gender: parsedNotes.gender || 'Female',
          age: parsedNotes.age || 25,
          howHeard: parsedNotes.how_heard || 'Passing By',
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

    if (mounted) {
      fetchVendors();
      fetchWalkins();
      fetchSurveyResponses();
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
      }
    }

    return () => {
      const supabase = createClient();
      if (supabase) {
        if (vendorsChannel) supabase.removeChannel(vendorsChannel);
        if (regionsChannel) supabase.removeChannel(regionsChannel);
        if (walkinsChannel) supabase.removeChannel(walkinsChannel);
        if (responsesChannel) supabase.removeChannel(responsesChannel);
      }
    };
  }, [mounted, activeRegion?.id, activeEdition?.id]);

  // Walk-ins filtering states
  const [walkinRegionFilter, setWalkinRegionFilter] = useState('All');
  const [walkinEditionFilter, setWalkinEditionFilter] = useState('All');
  const [walkinGenderFilter, setWalkinGenderFilter] = useState('All');
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
  
  // Form Values States
  const [paidFormValues, setPaidFormValues] = useState({
    phone: '',
    name: '',
    businessName: '',
    email: '',
    gender: '',
    dob: '',
    amountPaid: '50000'
  });
  const [paidLookupStatus, setPaidLookupStatus] = useState<'idle' | 'searching' | 'returning' | 'new'>('idle');
  const [paidSuccessState, setPaidSuccessState] = useState<{ show: boolean; vendorName?: string; onAddAnother: () => void }>({
    show: false,
    onAddAnother: () => resetPaidForm()
  });

  const [collectionFormValues, setCollectionFormValues] = useState({
    phone: '',
    name: '',
    businessName: '',
    email: '',
    gender: '',
    dob: '',
    employeeCount: '',
    newHiresThisYear: '',
    businessType: '',
    sellsOwnProducts: '' as 'Yes' | 'No' | '',
    exportReady: '' as 'Yes' | 'No' | '',
    impactRating: 0,
    businessGrowthNarrative: '',
    previousEditionsCount: ''
  });
  const [collectionLookupStatus, setCollectionLookupStatus] = useState<'idle' | 'searching' | 'returning' | 'new'>('idle');
  const [isCollectionPaidVendor, setIsCollectionPaidVendor] = useState<boolean | null>(null);
  const [collectionSuccessState, setCollectionSuccessState] = useState<{ show: boolean; vendorName?: string; onAddAnother: () => void }>({
    show: false,
    onAddAnother: () => resetCollectionForm()
  });

  const [walkinFormValues, setWalkinFormValues] = useState<WalkinFormValues>({
    name: '',
    phone: '',
    gender: '',
    age: '',
    howHeard: '',
    firstVisit: '',
    approximateVisitCount: ''
  });
  const [walkinSuccessState, setWalkinSuccessState] = useState<{ show: boolean; visitorName?: string; onAddAnother: () => void }>({
    show: false,
    onAddAnother: () => resetWalkinForm()
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
  // 2. HELPER FUNCTIONS & ACTIONS
  // ==========================================

  const resetPaidForm = () => {
    setPaidFormValues({
      phone: '',
      name: '',
      businessName: '',
      email: '',
      gender: '',
      dob: '',
      amountPaid: '50000'
    });
    setPaidLookupStatus('idle');
    setPaidSuccessState(prev => ({ ...prev, show: false }));
  };

  const resetCollectionForm = () => {
    setCollectionFormValues({
      phone: '',
      name: '',
      businessName: '',
      email: '',
      gender: '',
      dob: '',
      employeeCount: '',
      newHiresThisYear: '',
      businessType: '',
      sellsOwnProducts: '',
      exportReady: '',
      impactRating: 0,
      businessGrowthNarrative: '',
      previousEditionsCount: ''
    });
    setCollectionLookupStatus('idle');
    setIsCollectionPaidVendor(null);
    setCollectionSuccessState(prev => ({ ...prev, show: false }));
  };

  const resetWalkinForm = () => {
    setWalkinFormValues({
      name: '',
      phone: '',
      gender: '',
      age: '',
      howHeard: '',
      firstVisit: '',
      approximateVisitCount: ''
    });
    setWalkinSuccessState(prev => ({ ...prev, show: false }));
  };

  // Live lookup on phone keyup
  const handlePaidPhoneLookup = async (phone: string) => {
    setPaidLookupStatus('searching');
    try {
      const supabase = createClient();
      if (!supabase) return;
      
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('phone', phone)
        .limit(1);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        const v = data[0];
        setPaidLookupStatus('returning');
        setPaidFormValues(prev => ({
          ...prev,
          name: v.contact_name || '',
          businessName: v.business_name || '',
          gender: 'Female',
          email: v.email || '',
          dob: ''
        }));
      } else {
        setPaidLookupStatus('new');
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setPaidLookupStatus('new');
    }
  };

  const handleCollectionPhoneLookup = async (phone: string) => {
    setCollectionLookupStatus('searching');
    try {
      const supabase = createClient();
      if (!supabase) return;
      
      const { data: vendorData, error: vError } = await supabase
        .from('vendors')
        .select('*')
        .eq('phone', phone)
        .limit(1);
        
      if (vError) throw vError;
      
      if (vendorData && vendorData.length > 0) {
        const v = vendorData[0];
        setCollectionLookupStatus('returning');
        setIsCollectionPaidVendor(true);
        
        const { data: responseData } = await supabase
          .from('survey_responses')
          .select(`
            id,
            survey_answers (
              answer_value,
              survey_questions ( csv_column )
            )
          `)
          .eq('vendor_id', v.id)
          .order('submitted_at', { ascending: false })
          .limit(1);
          
        const answers = responseData?.[0]?.survey_answers || [];
        const getAnswer = (col: string) => {
          return answers.find((a: any) => a.survey_questions?.csv_column === col)?.answer_value || '';
        };

        setCollectionFormValues(prev => ({
          ...prev,
          name: v.contact_name || '',
          businessName: v.business_name || '',
          gender: 'Female',
          email: v.email || '',
          dob: '',
          employeeCount: getAnswer('employee_count'),
          newHiresThisYear: getAnswer('new_hires_this_year'),
          businessType: v.category || getAnswer('business_type') || '',
          sellsOwnProducts: (getAnswer('sells_own_products') || '') as any,
          exportReady: (getAnswer('export_ready') || '') as any,
          impactRating: Number(getAnswer('impact_rating')) || 0,
          businessGrowthNarrative: getAnswer('business_growth_narrative') || '',
          previousEditionsCount: '1'
        }));
      } else {
        setCollectionLookupStatus('new');
        setIsCollectionPaidVendor(false);
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setCollectionLookupStatus('new');
    }
  };

  // Form Submissions
  const handlePaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidFormValues.phone || !paidFormValues.name) return;
    if (!activeEdition) {
      addToast("Please select an active event edition first!", "error");
      return;
    }

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");

      // Check if vendor already exists
      const { data: existing, error: findError } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', paidFormValues.phone)
        .limit(1);

      if (findError) throw findError;

      let vendorId;
      if (existing && existing.length > 0) {
        vendorId = existing[0].id;
        const { error: updateError } = await supabase
          .from('vendors')
          .update({
            business_name: paidFormValues.businessName,
            contact_name: paidFormValues.name,
            email: paidFormValues.email,
            category: 'Fashion',
            is_active: true
          })
          .eq('id', vendorId);

        if (updateError) throw updateError;
        console.log("Updated existing vendor:", vendorId);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('vendors')
          .insert({
            business_name: paidFormValues.businessName,
            contact_name: paidFormValues.name,
            phone: paidFormValues.phone,
            email: paidFormValues.email,
            category: 'Fashion',
            is_active: true
          })
          .select();

        if (insertError) throw insertError;
        if (!inserted || inserted.length === 0) throw new Error("Failed to insert vendor profile.");
        vendorId = inserted[0].id;
        console.log("Inserted new vendor:", vendorId);
      }

      // Link vendor to activeEdition by creating a survey response under "Vendor Registration Form"
      if (activeEdition && vendorId) {
        const { data: formData, error: fError } = await supabase
          .from('forms')
          .select('id')
          .eq('slug', 'vendor_registration')
          .limit(1);

        if (fError) throw fError;
        if (formData && formData.length > 0) {
          const formId = formData[0].id;
          
          // Check if there is already a survey response for this vendor in this active edition
          const { data: existingResponse } = await supabase
            .from('survey_responses')
            .select('id')
            .eq('vendor_id', vendorId)
            .eq('form_id', formId)
            .eq('context_id', activeEdition.id)
            .limit(1);

          if (!existingResponse || existingResponse.length === 0) {
            const { error: resError } = await supabase
              .from('survey_responses')
              .insert({
                form_id: formId,
                context_type: 'market_day',
                context_id: activeEdition.id,
                vendor_id: vendorId,
                source: 'manual',
                submitted_at: new Date().toISOString()
              });
            if (resError) throw resError;
          }
        }
      }

      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRecentActivities(prev => [{
        id: Math.random().toString(36).substring(7),
        type: 'paid',
        name: paidFormValues.name,
        phone: paidFormValues.phone,
        detail: paidFormValues.businessName ? `${paidFormValues.businessName} • UGX ${Number(paidFormValues.amountPaid).toLocaleString()}` : `UGX ${Number(paidFormValues.amountPaid).toLocaleString()}`,
        timestamp: timeString
      }, ...prev]);

      setPaidSuccessState({
        show: true,
        vendorName: paidFormValues.name,
        onAddAnother: () => resetPaidForm()
      });

      addToast(`Paid vendor "${paidFormValues.name}" registered successfully!`, "success");
    } catch (err: any) {
      console.error("Supabase error saving vendor:", err);
      addToast("Error saving vendor: " + (err.message || err), "error");
    }
  };

  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionFormValues.phone || !collectionFormValues.name) return;
    if (!activeEdition) {
      addToast("Please select an active event edition first!", "error");
      return;
    }

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");

      const { data: vendorData, error: vError } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', collectionFormValues.phone)
        .limit(1);

      if (vError) throw vError;

      if (!vendorData || vendorData.length === 0) {
        addToast('Paid registration not found. Please register this vendor using the Paid Vendor form first.', 'error');
        return;
      }

      const vendorId = vendorData[0].id;

      const { data: formData, error: fError } = await supabase
        .from('forms')
        .select('id')
        .eq('name', 'Vendor Data Collection Survey')
        .limit(1);

      if (fError) throw fError;
      if (!formData || formData.length === 0) {
        throw new Error("Survey Form definition not found in database.");
      }

      const formId = formData[0].id;

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
      if (!resData || resData.length === 0) {
        throw new Error("Failed to insert survey response.");
      }

      const responseId = resData[0].id;

      const { data: questions, error: qError } = await supabase
        .from('survey_questions')
        .select('id, csv_column');

      if (qError) throw qError;

      const answersToInsert = [];
      const fieldMappings = {
        name: collectionFormValues.name,
        phone: collectionFormValues.phone,
        business_name: collectionFormValues.businessName,
        gender: collectionFormValues.gender,
        age: collectionFormValues.dob ? String(2026 - new Date(collectionFormValues.dob).getFullYear()) : '',
        employee_count: collectionFormValues.employeeCount,
        new_hires_this_year: collectionFormValues.newHiresThisYear,
        business_type: collectionFormValues.businessType,
        sells_own_products: collectionFormValues.sellsOwnProducts,
        export_ready: collectionFormValues.exportReady,
        impact_rating: String(collectionFormValues.impactRating),
        business_growth_narrative: collectionFormValues.businessGrowthNarrative
      };

      for (const key of Object.keys(fieldMappings)) {
        const val = fieldMappings[key as keyof typeof fieldMappings];
        if (val !== undefined && val !== null && val !== '') {
          const qId = questions?.find((q: any) => q.csv_column === key)?.id;
          if (qId) {
            answersToInsert.push({
              response_id: responseId,
              question_id: qId,
              answer_value: String(val)
            });
          }
        }
      }

      if (answersToInsert.length > 0) {
        const { error: ansError } = await supabase.from('survey_answers').insert(answersToInsert);
        if (ansError) throw ansError;
      }

      console.log("Survey response submitted successfully.");

      setCollectionSuccessState({
        show: true,
        vendorName: collectionFormValues.name,
        onAddAnother: () => resetCollectionForm()
      });

      addToast(`Field collection sheet for "${collectionFormValues.name}" saved!`, "success");
    } catch (err: any) {
      console.error("Supabase error submitting survey:", err);
      addToast("Error submitting survey: " + (err.message || err), "error");
    }
  };

  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEdition) {
      addToast("Please select an active event edition first!", "error");
      return;
    }

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not initialized.");

      const { data, error } = await supabase
        .from('walkins')
        .insert({
          market_day_id: activeEdition.id,
          count: 1,
          recorded_by: walkinFormValues.name || 'Anonymous Visitor',
          notes: JSON.stringify({
            name: walkinFormValues.name || 'Anonymous Visitor',
            phone: walkinFormValues.phone || '',
            gender: walkinFormValues.gender || 'Female',
            age: walkinFormValues.age ? parseInt(walkinFormValues.age) : 25,
            how_heard: walkinFormValues.howHeard || 'Passing By',
            first_visit: walkinFormValues.firstVisit === 'Yes'
          })
        })
        .select();

      if (error) throw error;

      console.log("Walk-in inserted successfully:", data);

      setWalkinSuccessState({
        show: true,
        visitorName: walkinFormValues.name || 'Anonymous Visitor',
        onAddAnother: () => resetWalkinForm()
      });
      // Trigger local fetch
      fetchWalkins();

      addToast(`Walk-in guest logged successfully!`, "success");
    } catch (err: any) {
      console.error("Supabase error inserting walk-in:", err);
      addToast("Error submitting walk-in: " + (err.message || err), "error");
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
    if (filters.gender !== 'All' && v.gender !== filters.gender) {
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

    // Registration type filters (Paid / Collection status)
    if (filters.registrationType === 'Paid') {
      const amt = Number(v.amountPaid) || 0;
      if (amt <= 0) return false;
    } else if (filters.registrationType === 'Collected') {
      if (!v.employeeCount && !v.businessGrowthNarrative) return false;
    }

    return true;
  });

  // Overview Stats Calculation
  const totalUniqueVendorsCount = vendors.length;
  const activeVendorsList = vendors.filter(v => v.status === 'active' || v.status === 'loyal');
  
  const femaleVendorsCount = vendors.filter(v => v.gender === 'Female').length;
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
      value: runningWalkins * 14, // Scale up mock representation
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

  const parseCSVToObjects = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    const headers = parseCSVRow(lines[0]);
    const results: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseCSVRow(lines[i]);
      const rowObj: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowObj[header] = values[index] || '';
      });
      results.push(rowObj);
    }
    return results;
  };

  const parseCSVRow = (line: string): string[] => {
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

  const handleImportConfirmedVendors = async (file: File) => {
    if (!activeEdition || !activeRegion) {
      addToast("Please select an active workspace (region & edition) first!", "error");
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        addToast("CSV is empty", "error");
        return;
      }

      // Check header
      let startIdx = 0;
      const firstRow = rows[0].map(c => c.toLowerCase());
      if (firstRow.includes('name') || firstRow.includes('phone')) {
        startIdx = 1;
      }

      const nameCol = firstRow.indexOf('name') !== -1 ? firstRow.indexOf('name') : 0;
      const phoneCol = firstRow.indexOf('phone') !== -1 ? firstRow.indexOf('phone') : 1;

      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      // Lookup form for Vendor Registration Form
      const { data: formData, error: fError } = await supabase
        .from('forms')
        .select('id')
        .eq('slug', 'vendor_registration')
        .limit(1);

      if (fError) throw fError;
      if (!formData || formData.length === 0) throw new Error("Vendor Registration Form not found in database.");
      const formId = formData[0].id;

      let count = 0;
      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        const name = row[nameCol];
        const phone = row[phoneCol];
        if (!phone || !name) continue;

        // Check if vendor exists
        const { data: existing } = await supabase
          .from('vendors')
          .select('id')
          .eq('phone', phone)
          .limit(1);

        let vendorId;
        if (existing && existing.length > 0) {
          vendorId = existing[0].id;
          await supabase
            .from('vendors')
            .update({ contact_name: name, is_active: true })
            .eq('id', vendorId);
        } else {
          const { data: inserted } = await supabase
            .from('vendors')
            .insert({ contact_name: name, phone, is_active: true })
            .select();
          if (inserted && inserted.length > 0) {
             vendorId = inserted[0].id;
          }
        }

        if (vendorId) {
          // Insert survey response if not exists
          const { data: existingRes } = await supabase
            .from('survey_responses')
            .select('id')
            .eq('vendor_id', vendorId)
            .eq('form_id', formId)
            .eq('context_id', activeEdition.id)
            .limit(1);

          if (!existingRes || existingRes.length === 0) {
            await supabase
              .from('survey_responses')
              .insert({
                form_id: formId,
                context_type: 'market_day',
                context_id: activeEdition.id,
                vendor_id: vendorId,
                source: 'csv_import',
                submitted_at: new Date().toISOString()
              });
          }
          count++;
        }
      }

      addToast(`Imported ${count} vendors successfully!`, "success");
      fetchVendors();
    } catch (err: any) {
      console.error(err);
      addToast("Import failed: " + err.message, "error");
    }
  };

  const handleImportCollectedData = async (file: File) => {
    if (!activeEdition || !activeRegion) {
      addToast("Please select an active workspace (region & edition) first!", "error");
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCSVToObjects(text);
      console.log("Total CSV rows parsed:", rows.length);
      if (rows.length === 0) {
        addToast("CSV is empty", "error");
        return;
      }
      console.log("All CSV headers:", Object.keys(rows[0]));

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

      // 3. Load column map from profile
      const { data: profile, error: pErr } = await supabase
        .from('csv_import_profiles')
        .select('column_map')
        .eq('form_id', formId)
        .limit(1)
        .single();

      if (pErr) throw pErr;
      const columnMap = profile?.column_map || {};

      // Build headerToColumn lookup map
      const headerToColumn: Record<string, string> = {};

      // Method 1: from column_map
      Object.entries(columnMap).forEach(([header, path]) => {
        if (typeof path === 'string') {
          const csvColumn = path.replace('answer.', '');
          headerToColumn[header.toLowerCase().trim()] = csvColumn;
        }
      });

      // Method 2: direct csv_column match as fallback
      questions.forEach(q => {
        if (q.csv_column) {
          headerToColumn[q.csv_column.toLowerCase().trim()] = q.csv_column;
        }
      });

      // Method 3: direct question_text match as fallback
      questions.forEach(q => {
        if (q.question_text && q.csv_column) {
          headerToColumn[q.question_text.toLowerCase().trim()] = q.csv_column;
        }
      });

      // Manual fallback mappings
      const manualMappings: Record<string, string> = {
        'primary source of income': 'primary_source_of_income',
        'is this business your primary source of income?': 'primary_source_of_income',
        'new employees count': 'new_employees_count',
        'how many new employees in the past 12 months?': 'new_employees_count',
        'how long in business': 'how_long_in_business',
        'first time at quonnect': 'first_time_at_quonnect',
        'how did you know about quonnect?': 'how_did_you_know',
        'how did you know': 'how_did_you_know',
        'products primarily from': 'products_primarily_from',
      };

      Object.entries(manualMappings).forEach(([header, csvColumn]) => {
        headerToColumn[header.toLowerCase().trim()] = csvColumn;
      });

      // Flexible header lookup
      const getColumnKey = (header: string): string | undefined => {
        const cleanHeader = header.toLowerCase().trim();
        // Try exact lowercase trimmed match
        if (headerToColumn[cleanHeader]) {
          return headerToColumn[cleanHeader];
        }
        // Fallback: check if normalized clean versions match
        const normHeader = cleanHeader.replace(/[^a-z0-9]/g, '');
        for (const [key, value] of Object.entries(headerToColumn)) {
          const normKey = key.replace(/[^a-z0-9]/g, '');
          if (normHeader === normKey || normHeader.includes(normKey) || normKey.includes(normHeader)) {
            return value;
          }
        }
        return undefined;
      };

      // Find target headers for name and phone and business name to create/update vendors
      const firstRow = rows[0];
      const phoneHeader = Object.keys(firstRow).find(h => {
        const csvCol = getColumnKey(h);
        return csvCol === 'phone_number' || csvCol === 'phone' || h.toLowerCase().includes('phone');
      }) || 'Phone number';

      const nameHeader = Object.keys(firstRow).find(h => {
        const csvCol = getColumnKey(h);
        return csvCol === 'full_name' || csvCol === 'name' || h.toLowerCase().includes('name') || h.toLowerCase().includes('contact');
      }) || 'Full name';

      const bizHeader = Object.keys(firstRow).find(h => {
        const csvCol = getColumnKey(h);
        return csvCol === 'business_name' || h.toLowerCase().includes('business');
      }) || 'Business name';

      const catHeader = Object.keys(firstRow).find(h => {
        const csvCol = getColumnKey(h);
        return csvCol === 'business_category' || csvCol === 'category' || h.toLowerCase().includes('category');
      }) || 'Business category';

      let count = 0;
      let totalAnswersCount = 0;

      for (const [index, rowObj] of rows.entries()) {
        try {
          const name = rowObj[nameHeader];
          const phone = rowObj[phoneHeader];
          const biz = rowObj[bizHeader] || '';
          const cat = rowObj[catHeader] || 'Fashion';

          addToast(`Importing row ${index + 1} of ${rows.length}...`, "success");

          if (!phone || !name) {
            console.warn(`Row ${index + 1} skipped due to missing name or phone. Name: ${name}, Phone: ${phone}`);
            continue;
          }

          const vendorData = { contact_name: name, phone, business_name: biz, category: cat, is_active: true };
          console.log("Inserting vendor:", index + 1, "of", rows.length, vendorData);

          // Insert/update vendor
          const { data: existing } = await supabase
            .from('vendors')
            .select('id')
            .eq('phone', phone)
            .limit(1);

          let vendorId;
          if (existing && existing.length > 0) {
            vendorId = existing[0].id;
            const { error: vUpdateErr } = await supabase
              .from('vendors')
              .update({ contact_name: name, business_name: biz, category: cat, is_active: true })
              .eq('id', vendorId);
            if (vUpdateErr) {
              console.error("Failed at row:", index + 1, vUpdateErr.message, vUpdateErr.code, vUpdateErr.details);
              break;
            }
          } else {
            const { data: inserted, error: vInsertErr } = await supabase
              .from('vendors')
              .insert({ contact_name: name, phone, business_name: biz, category: cat, is_active: true })
              .select();
            if (vInsertErr) {
              console.error("Failed at row:", index + 1, vInsertErr.message, vInsertErr.code, vInsertErr.details);
              break;
            }
            if (inserted && inserted.length > 0) {
              vendorId = inserted[0].id;
            }
          }

          if (vendorId) {
            // Insert survey response
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
              const responseId = resData.id;

              // Insert answers
              const answersToInsert: any[] = [];
              Object.entries(rowObj).forEach(([header, value]) => {
                const csvColumn = getColumnKey(header);
                if (!csvColumn) return;
                const question = questions.find(q => q.csv_column === csvColumn);
                if (!question) return;
                answersToInsert.push({
                  response_id: responseId,
                  question_id: question.id,
                  answer: String(value ?? '')
                });
              });

              console.log("Inserting answers for response:", responseId, "count:", answersToInsert.length);

              if (answersToInsert.length > 0) {
                // Chunk answer inserts into chunks of 50
                for (let c = 0; c < answersToInsert.length; c += 50) {
                  const chunk = answersToInsert.slice(c, c + 50);
                  const { error: ansError } = await supabase
                    .from('survey_answers')
                    .insert(chunk);
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
    }
  };

  const handleImportWalkins = async (file: File) => {
    if (!activeEdition || !activeRegion) {
      addToast("Please select an active workspace (region & edition) first!", "error");
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        addToast("CSV is empty", "error");
        return;
      }

      let startIdx = 0;
      const firstRow = rows[0].map(c => c.toLowerCase());
      if (firstRow.includes('name') || firstRow.includes('phone') || firstRow.includes('gender')) {
        startIdx = 1;
      }

      const nameCol = firstRow.indexOf('name') !== -1 ? firstRow.indexOf('name') : 0;
      const phoneCol = firstRow.indexOf('phone') !== -1 ? firstRow.indexOf('phone') : 1;
      const genderCol = firstRow.indexOf('gender') !== -1 ? firstRow.indexOf('gender') : 2;
      const ageCol = firstRow.indexOf('age') !== -1 ? firstRow.indexOf('age') : 3;
      const heardCol = firstRow.indexOf('how_heard') !== -1 ? firstRow.indexOf('how_heard') : (firstRow.indexOf('how heard') !== -1 ? firstRow.indexOf('how heard') : 4);

      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not initialized");

      const walkinsToInsert = [];
      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        const name = row[nameCol] || 'Anonymous Visitor';
        const phone = row[phoneCol] || '';
        const gender = row[genderCol] || 'Female';
        const age = parseInt(row[ageCol]) || 25;
        const howHeard = row[heardCol] || 'Passing By';

        walkinsToInsert.push({
          market_day_id: activeEdition.id,
          count: 1,
          recorded_by: name,
          notes: JSON.stringify({
            name,
            phone,
            gender,
            age,
            how_heard: howHeard,
            first_visit: true
          })
        });
      }

      if (walkinsToInsert.length > 0) {
        const { error } = await supabase.from('walkins').insert(walkinsToInsert);
        if (error) throw error;
      }

      addToast(`Imported ${walkinsToInsert.length} walk-in guest records!`, "success");
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
          recorded_by,
          notes,
          recorded_at,
          market_days!inner (
            region_id
          )
        `)
        .eq('market_days.region_id', activeRegion.id);

      if (error) throw error;

      let csvContent = "ID,Name,Phone,Gender,Age,How Heard,First Visit,Recorded At\n";
      (data || []).forEach(w => {
        let parsedNotes: any = {};
        try {
          if (w.notes) parsedNotes = JSON.parse(w.notes);
        } catch (e) {}

        const name = parsedNotes.name || w.recorded_by || 'Anonymous';
        const phone = parsedNotes.phone || '';
        const gender = parsedNotes.gender || 'Female';
        const age = parsedNotes.age || 25;
        const howHeard = parsedNotes.how_heard || 'Passing By';
        const firstVisit = parsedNotes.first_visit !== false ? 'Yes' : 'No';

        csvContent += `"${w.id}","${name.replace(/"/g, '""')}","${phone}","${gender}","${age}","${howHeard.replace(/"/g, '""')}","${firstVisit}","${w.recorded_at || ''}"\n`;
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
                isActiveEdition={currentMarket.id === 'kampala'}
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

              {/* Interactive Shared Filter Bar */}
              <FilterBar
                filters={filters}
                onFiltersChange={(updates) => setFilters(prev => ({ ...prev, ...updates }))}
                editions={editions}
                businessTypes={BUSINESS_TYPES}
                onClearFilters={() => setFilters({
                  region: 'All',
                  editionId: 'may-2026',
                  gender: 'All',
                  statuses: [],
                  minAge: '',
                  maxAge: '',
                  businessType: 'All'
                })}
              />

              {/* Overview Metrics Cards */}
              <OverviewCards
                data={overviewData}
                activeFilter={null}
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

              {!loadingVendors && !error && filteredVendors.length === 0 && (
                <div className="bg-bg-surface border border-border rounded-xl p-12 text-center flex flex-col items-center justify-center select-none">
                  <Store className="w-12 h-12 text-text-tertiary mb-4 stroke-[1.5] mx-auto" />
                  <h3 className="text-sm font-bold text-text-primary mb-1">No vendors found</h3>
                  <p className="text-xs text-text-secondary max-w-[280px] mx-auto">
                    Register a new vendor using the Paid Vendor Registration form to see them here.
                  </p>
                </div>
              )}

              {/* Vendors List Table */}
              {!loadingVendors && !error && filteredVendors.length > 0 && (
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

              if (walkinGenderFilter !== 'All' && w.gender !== walkinGenderFilter) return false;

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
                    <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Gender</label>
                    <select 
                      value={walkinGenderFilter} 
                      onChange={(e) => setWalkinGenderFilter(e.target.value)}
                      className="bg-bg-elevated border border-border-light text-text-primary text-xs rounded-md px-3 py-2 cursor-pointer outline-none focus:border-green appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 min-w-[120px]"
                    >
                      <option value="All">All Genders</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
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

                  {(walkinRegionFilter !== 'All' || walkinEditionFilter !== 'All' || walkinGenderFilter !== 'All' || walkinMinAgeFilter !== '' || walkinMaxAgeFilter !== '') && (
                    <button 
                      onClick={() => {
                        setWalkinRegionFilter('All');
                        setWalkinEditionFilter('All');
                        setWalkinGenderFilter('All');
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
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Name & Phone</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-center">Gender</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-center">Age</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">How Heard</th>
                        <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Time Recorded</th>
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
                              <span className="block font-bold text-text-primary">{w.name}</span>
                              {w.phone && <span className="block text-[10px] text-text-secondary mt-0.5">{w.phone}</span>}
                            </td>
                            <td className="p-3.5 text-center font-semibold text-text-secondary">{w.gender}</td>
                            <td className="p-3.5 text-center">
                              <Badge variant="neutral" size="sm" className="font-bold">{w.age}</Badge>
                            </td>
                            <td className="p-3.5 text-text-secondary font-semibold">{w.howHeard}</td>
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
                paidVendorFormProps={{
                  values: paidFormValues,
                  onChange: (updates) => setPaidFormValues(prev => ({ ...prev, ...updates })),
                  onSubmit: handlePaidSubmit,
                  lookupStatus: paidLookupStatus,
                  onPhoneLookup: handlePaidPhoneLookup,
                  successState: paidSuccessState,
                  runningCount: runningCount
                }}
                fieldCollectionFormProps={{
                  values: collectionFormValues,
                  onChange: (updates) => setCollectionFormValues(prev => ({ ...prev, ...updates })),
                  onSubmit: handleCollectionSubmit,
                  lookupStatus: collectionLookupStatus,
                  onPhoneLookup: handleCollectionPhoneLookup,
                  isPaidVendor: isCollectionPaidVendor,
                  successState: collectionSuccessState,
                  runningCount: dataCollectedListCount
                }}
                walkinFormProps={{
                  values: walkinFormValues,
                  onChange: (updates) => setWalkinFormValues(prev => ({ ...prev, ...updates })),
                  onSubmit: handleWalkinSubmit,
                  successState: walkinSuccessState,
                  runningCount: runningWalkins
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
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportConfirmedVendors(f); }} 
              />
              <input 
                type="file" 
                ref={fileInputRef2} 
                className="hidden" 
                accept=".csv" 
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportCollectedData(f); }} 
              />
              <input 
                type="file" 
                ref={fileInputRef3} 
                className="hidden" 
                accept=".csv" 
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportWalkins(f); }} 
              />

              {/* Upload Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 select-none">
                {/* Card 1: Confirmed list */}
                <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
                  {!activeEdition && (
                    <div className="absolute inset-0 bg-bg-surface/85 backdrop-blur-xs flex items-center justify-center p-4 text-center z-10">
                      <span className="text-xs text-text-secondary font-semibold">Select active edition to upload</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-green-muted text-green flex items-center justify-center">
                        <Users className="w-5 h-5 animate-pulse" />
                      </div>
                      <h3 className="font-bold text-sm text-text-primary">Upload Confirmed Vendors List</h3>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      CSV spreadsheet with vendor names and phone numbers who have completed payments for this edition.
                    </p>
                    <div className="inline-block bg-bg-elevated border border-border-light rounded px-2.5 py-1 text-[10px] text-text-secondary font-mono">
                      name · phone
                    </div>
                  </div>
                  <div className="pt-5">
                    <Button variant="primary" fullWidth onClick={() => fileInputRef1.current?.click()}>
                      <span>Upload CSV</span>
                    </Button>
                  </div>
                </div>

                {/* Card 2: Kobo data */}
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
                    <div className="inline-block bg-bg-elevated border border-border-light rounded px-2.5 py-1 text-[10px] text-text-secondary font-mono">
                      name · phone · business_name · category · employees
                    </div>
                  </div>
                  <div className="pt-5">
                    <Button variant="primary" fullWidth onClick={() => fileInputRef2.current?.click()}>
                      <span>Upload CSV</span>
                    </Button>
                  </div>
                </div>

                {/* Card 3: Walk-in records */}
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
                      name · phone · gender · age · how_heard
                    </div>
                  </div>
                  <div className="pt-5">
                    <Button variant="primary" fullWidth onClick={() => fileInputRef3.current?.click()}>
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
