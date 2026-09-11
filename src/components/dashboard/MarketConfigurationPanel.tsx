'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isTestEdition } from '@/lib/editions';
import { useRegion } from '@/context/RegionContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  MapPin, 
  Store, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Layers,
  ArrowRight,
  Home,
  Map,
  Clock,
  Sparkles
} from 'lucide-react';

interface Edition {
  id: string;
  name: string;
  date: string;
  venue: string;
  is_active: boolean;
}

interface MarketDay {
  name: string;
  editions: Edition[];
}

interface Region {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  marketDays: MarketDay[];
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export const MarketConfigurationPanel: React.FC = () => {
  const { activeRegion, setActiveEdition, refreshRegions } = useRegion();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Stepper State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedMarketName, setSelectedMarketName] = useState<string | null>(null);

  // Stepper Step 1: Create Region
  const [newRegionName, setNewRegionName] = useState('');
  const [newRegionSlug, setNewRegionSlug] = useState('');
  const [isSavingRegion, setIsSavingRegion] = useState(false);

  // Stepper Step 2: Create Market Day
  const [newMarketName, setNewMarketName] = useState('');

  // Stepper Step 3: Create Edition
  const [newEditionName, setNewEditionName] = useState('');
  const [newEditionDate, setNewEditionDate] = useState('');
  const [newEditionVenue, setNewEditionVenue] = useState('');
  const [newEditionIsActive, setNewEditionIsActive] = useState(true);
  const [isSavingEdition, setIsSavingEdition] = useState(false);

  // Inline Edition Editing States
  const [editingEditionId, setEditingEditionId] = useState<string | null>(null);
  const [editEditionName, setEditEditionName] = useState('');
  const [editEditionDate, setEditEditionDate] = useState('');
  const [editEditionVenue, setEditEditionVenue] = useState('');
  const [editEditionIsActive, setEditEditionIsActive] = useState(true);
  const [isUpdatingEdition, setIsUpdatingEdition] = useState(false);

  // Accordion Expand States (for full view below stepper)
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

  // Inline Editing for Regions in Overview
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editRegionName, setEditRegionName] = useState('');
  const [editRegionSlug, setEditRegionSlug] = useState('');
  const [isUpdatingRegion, setIsUpdatingRegion] = useState(false);

  // Inline Editing for Market Days in Overview
  const [editingMarketKey, setEditingMarketKey] = useState<string | null>(null); // format: `${regionId}_${marketName}`
  const [editMarketNameVal, setEditMarketNameVal] = useState('');
  const [isUpdatingMarketName, setIsUpdatingMarketName] = useState(false);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
      .replace(/\s+/g, '-')       // collapse whitespace and replace by -
      .replace(/-+/g, '-');       // collapse dashes
  };

  const handleRegionNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewRegionName(name);
    setNewRegionSlug(slugify(name));
  };

  const fetchRegionsData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) return;

      let query = supabase
        .from('regions')
        .select(`
          id,
          name,
          slug,
          is_active,
          market_days (
            id,
            region_id,
            name,
            slug,
            event_date,
            edition,
            status,
            notes,
            created_at
          )
        `);

      if (activeRegion) {
        query = query.eq('id', activeRegion.id);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;

      // Group market_days rows by unique names to construct nested structure
      const formatted: Region[] = (data || []).map((reg: any) => {
        const rawMarketDays = (reg.market_days || []).filter((m: any) => !isTestEdition(m));
        
        // Find unique market names
        const uniqueNames = Array.from(new Set(rawMarketDays.map((m: any) => m.name))) as string[];
        
        const marketDays: MarketDay[] = uniqueNames.map((name) => {
          const matchingRows = rawMarketDays.filter((m: any) => m.name === name);
          
          const editions: Edition[] = matchingRows
            .map((row: any) => ({
              id: row.id,
              name: row.edition || 'Untitled Edition',
              date: row.event_date || '',
              venue: row.notes || '',
              is_active: row.status === 'upcoming' || row.status === 'ongoing' || row.status === 'active'
            }))
            .sort((a: Edition, b: Edition) => new Date(a.date).getTime() - new Date(b.date).getTime());

          return { name, editions };
        });

        return {
          id: reg.id,
          name: reg.name,
          slug: reg.slug,
          is_active: reg.is_active,
          marketDays
        };
      });

      setRegions(formatted);

      // Keep selections synced if data refreshes
      if (selectedRegion) {
        const updatedReg = formatted.find(r => r.id === selectedRegion.id);
        if (updatedReg) setSelectedRegion(updatedReg);
      }
    } catch (err: any) {
      console.error("Error fetching regions:", err);
      addToast(err.message || "Failed to load region/market data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegionsData();
  }, [activeRegion?.id]);

  useEffect(() => {
    if (activeRegion) {
      const matchingReg = regions.find(r => r.id === activeRegion.id);
      if (matchingReg) {
        setSelectedRegion(matchingReg);
      } else {
        setSelectedRegion({
          id: activeRegion.id,
          name: activeRegion.name,
          slug: activeRegion.slug,
          is_active: true,
          marketDays: []
        });
      }
      if (currentStep === 1) {
        setCurrentStep(2);
      }
    } else {
      setSelectedRegion(null);
      setCurrentStep(1);
    }
  }, [activeRegion, regions]);

  // Mutate Region
  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionName.trim() || !newRegionSlug.trim()) {
      addToast("Region name and slug are required.", "error");
      return;
    }

    const exists = regions.some(r => r.slug === newRegionSlug.trim());
    if (exists) {
      addToast("A region with this slug already exists.", "error");
      return;
    }

    setIsSavingRegion(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { data, error } = await supabase
        .from('regions')
        .insert([{
          name: newRegionName.trim(),
          slug: newRegionSlug.trim(),
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      addToast("Region created successfully!", "success");
      setNewRegionName('');
      setNewRegionSlug('');
      
      await fetchRegionsData();
      
      // Auto select and advance
      if (data) {
        const newRegObj = {
          id: data.id,
          name: data.name,
          slug: data.slug,
          is_active: data.is_active,
          marketDays: []
        };
        setSelectedRegion(newRegObj);
        setCurrentStep(2);
      }
    } catch (err: any) {
      console.error("Error creating region:", err);
      addToast(err.message || "Failed to create region.", "error");
    } finally {
      setIsSavingRegion(true); // reset
      setIsSavingRegion(false);
    }
  };

  const handleUpdateRegion = async (id: string) => {
    if (!editRegionName.trim() || !editRegionSlug.trim()) {
      addToast("Region name and slug cannot be empty.", "error");
      return;
    }

    setIsUpdatingRegion(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('regions')
        .update({
          name: editRegionName.trim(),
          slug: editRegionSlug.trim()
        })
        .eq('id', id);

      if (error) throw error;

      addToast("Region updated successfully!", "success");
      setEditingRegionId(null);
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error updating region:", err);
      addToast(err.message || "Failed to update region.", "error");
    } finally {
      setIsUpdatingRegion(false);
    }
  };

  const handleDeleteRegion = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete region "${name}"? This deletes all associated market days and editions, and attendance logs. This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('regions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      addToast(`Region "${name}" deleted.`, "success");
      if (selectedRegion?.id === id) {
        setSelectedRegion(null);
        setSelectedMarketName(null);
        setCurrentStep(1);
      }
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error deleting region:", err);
      addToast(err.message || "Failed to delete region.", "error");
    }
  };

  // Mutate Market Day
  const handleCreateMarketDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketName.trim()) {
      addToast("Market Day name is required.", "error");
      return;
    }
    
    setSelectedMarketName(newMarketName.trim());
    setNewMarketName('');
    setCurrentStep(3);
    addToast(`Market Day "${newMarketName.trim()}" selected. Provide edition details next.`, "success");
  };

  const handleUpdateMarketName = async (regionId: string, oldName: string) => {
    if (!editMarketNameVal.trim()) {
      addToast("Market Day name cannot be empty.", "error");
      return;
    }

    setIsUpdatingMarketName(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('market_days')
        .update({ name: editMarketNameVal.trim() })
        .eq('region_id', regionId)
        .eq('name', oldName);

      if (error) throw error;

      addToast("Market Day name updated.", "success");
      setEditingMarketKey(null);
      if (selectedMarketName === oldName && selectedRegion?.id === regionId) {
        setSelectedMarketName(editMarketNameVal.trim());
      }
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error updating market day name:", err);
      addToast(err.message || "Failed to update name.", "error");
    } finally {
      setIsUpdatingMarketName(false);
    }
  };

  const handleDeleteMarketDay = async (regionId: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the market day "${name}"? This will delete all its event editions in the database.`);
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('market_days')
        .delete()
        .eq('region_id', regionId)
        .eq('name', name);

      if (error) throw error;

      addToast(`Market Day "${name}" deleted.`, "success");
      if (selectedMarketName === name && selectedRegion?.id === regionId) {
        setSelectedMarketName(null);
        setCurrentStep(2);
      }
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error deleting market day:", err);
      addToast(err.message || "Failed to delete market day.", "error");
    }
  };

  // Mutate Edition
  const handleCreateEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegion || !selectedMarketName) return;
    if (!newEditionName.trim() || !newEditionDate.trim() || !newEditionVenue.trim()) {
      addToast("Edition name, date, and venue are required.", "error");
      return;
    }

    setIsSavingEdition(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const slug = slugify(`${selectedMarketName}-${newEditionName}-${Date.now()}`);

      const { data, error } = await supabase
        .from('market_days')
        .insert([{
          region_id: selectedRegion.id,
          name: selectedMarketName,
          slug,
          event_date: newEditionDate,
          edition: newEditionName.trim(),
          notes: newEditionVenue.trim(),
          status: newEditionIsActive ? 'upcoming' : 'completed'
        }])
        .select()
        .single();

      if (error) {
        console.error("Supabase edition insert error:", error.message, error.code, error.details);
        throw error;
      }

      // F3 FIX: Auto-select the new edition in the global context so the header,
      // import panel, quick entry, and all data fetches immediately use it.
      // Previously the user had to manually switch editions after creation.
      setActiveEdition({
        id: data.id,
        name: data.edition || data.name || newEditionName.trim(),
        date: data.event_date || newEditionDate,
        venue: data.notes || newEditionVenue.trim(),
        is_active: data.status === 'upcoming' || data.status === 'active',
      });

      addToast(`Edition "${newEditionName}" created and activated!`, "success");
      setNewEditionName('');
      setNewEditionDate('');
      setNewEditionVenue('');
      setNewEditionIsActive(true);
      await refreshRegions();
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error creating edition:", err?.message, err?.code, err?.details, JSON.stringify(err));
      addToast(err.message || "Failed to create edition.", "error");
    } finally {
      setIsSavingEdition(false);
    }
  };

  const handleUpdateEdition = async (id: string) => {
    if (!editEditionName.trim() || !editEditionDate.trim() || !editEditionVenue.trim()) {
      addToast("Name, date, and venue cannot be empty.", "error");
      return;
    }

    setIsUpdatingEdition(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('market_days')
        .update({
          edition: editEditionName.trim(),
          event_date: editEditionDate,
          notes: editEditionVenue.trim(),
          status: editEditionIsActive ? 'upcoming' : 'completed'
        })
        .eq('id', id);

      if (error) throw error;

      addToast("Edition updated successfully!", "success");
      setEditingEditionId(null);
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error updating edition:", err);
      addToast(err.message || "Failed to update edition.", "error");
    } finally {
      setIsUpdatingEdition(false);
    }
  };

  const handleDeleteEdition = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete edition "${name}"?`);
    if (!confirmed) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from('market_days')
        .delete()
        .eq('id', id);

      if (error) throw error;

      addToast("Edition deleted.", "success");
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error deleting edition:", err);
      addToast(err.message || "Failed to delete edition.", "error");
    }
  };

  const handleToggleEditionStatus = async (id: string, currentStatus: boolean) => {
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      const newStatus = !currentStatus ? 'upcoming' : 'completed';

      const { error } = await supabase
        .from('market_days')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      addToast("Edition status updated.", "success");
      fetchRegionsData();
    } catch (err: any) {
      console.error("Error updating status:", err);
      addToast(err.message || "Failed to update status.", "error");
    }
  };

  // Accordion Toggles
  const toggleRegionAccordion = (id: string) => {
    setExpandedRegions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEditRegion = (reg: Region) => {
    setEditingRegionId(reg.id);
    setEditRegionName(reg.name);
    setEditRegionSlug(reg.slug);
  };

  const handleStartEditMarketName = (regionId: string, marketName: string) => {
    setEditingMarketKey(`${regionId}_${marketName}`);
    setEditMarketNameVal(marketName);
  };

  const handleStartEditEdition = (ed: Edition) => {
    setEditingEditionId(ed.id);
    setEditEditionName(ed.name);
    setEditEditionDate(ed.date);
    setEditEditionVenue(ed.venue);
    setEditEditionIsActive(ed.is_active);
  };

  // Stepper UI helper
  const getStepClass = (step: number) => {
    if (currentStep === step) return 'border-accent text-accent bg-accent-soft font-bold';
    if (currentStep > step) return 'border-accent bg-accent text-white font-bold';
    return 'border-border text-text-tertiary bg-white';
  };

  return (
    <div className="space-y-6 animate-fade-in text-left select-none relative">
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-lg shadow-lg text-xs font-semibold animate-slide-up pointer-events-auto border ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                : 'bg-red-50 border-red-300 text-red-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
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

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-5 bg-accent rounded-full" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Market Day & Event Configurations</h1>
          <p className="text-xs text-text-secondary mt-0.5">Configure geographical regions, market day locations, and monthly events.</p>
        </div>
      </div>

      {/* STEPPER HEADER */}
      <div className="bg-white border border-border rounded-xl p-4.5 shadow-sm">
        <div className="max-w-xl mx-auto flex items-start justify-between relative select-none">
          {/* Connector Line */}
          <div className="absolute top-[16px] left-0 right-0 h-0.5 bg-border z-0" />
          <div 
            className="absolute top-[16px] left-0 h-0.5 bg-accent transition-all duration-300 z-0" 
            style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}
          />

          {/* Step 1 */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 cursor-not-allowed opacity-80" title="Region is selected in the top header">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs transition-all bg-accent-soft border-accent text-accent`}>
              <Check className="w-4 h-4 text-accent font-black" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-accent flex items-center gap-1">
              Region ({activeRegion?.name || 'Active'})
            </span>
          </div>

          {/* Step 2 */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => selectedRegion ? setCurrentStep(2) : null}>
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs transition-all ${getStepClass(2)}`}>
              {currentStep > 2 ? <Check className="w-4 h-4 text-white font-black" /> : 2}
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${currentStep >= 2 ? 'text-accent' : 'text-text-tertiary'}`}>Market Day</span>
          </div>

          {/* Step 3 */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => selectedRegion && selectedMarketName ? setCurrentStep(3) : null}>
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs transition-all ${getStepClass(3)}`}>
              3
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${currentStep >= 3 ? 'text-accent' : 'text-text-tertiary'}`}>Edition</span>
          </div>
        </div>
      </div>

      {/* STEP PANEL CONTENT */}
      <div className="bg-white border border-border rounded-xl overflow-hidden min-h-[280px] flex flex-col shadow-sm">
        
        {/* Step 1: Regions */}
        {currentStep === 1 && (
          <div className="p-5 flex-1 flex flex-col md:flex-row gap-6 animate-fade-in">
            {/* Create Region Form */}
            <form onSubmit={handleCreateRegion} className="w-full md:w-[320px] space-y-4 shrink-0 border-b md:border-b-0 md:border-r border-border pb-5 md:pb-0 md:pr-6 flex flex-col justify-between">
              <div className="space-y-3.5">
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-widest flex items-center gap-2">
                  <Map className="w-4 h-4 text-accent" />
                  <span>Create Region</span>
                </h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest block">Region Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Kampala" 
                    value={newRegionName}
                    onChange={handleRegionNameChange}
                    className="w-full bg-bg-input border border-border-light rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest block">Region Slug</label>
                  <input 
                    type="text" 
                    value={newRegionSlug}
                    onChange={(e) => setNewRegionSlug(slugify(e.target.value))}
                    className="w-full bg-bg-input border border-border-light rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent font-mono"
                    required
                  />
                </div>
              </div>
              <Button type="submit" variant="primary" fullWidth disabled={isSavingRegion} className="mt-4 font-semibold">
                <span>{isSavingRegion ? 'Creating...' : 'Create Region'}</span>
              </Button>
            </form>

            {/* Selectable Regions Grid */}
            <div className="flex-1 space-y-3">
              <h4 className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">Select Existing Region</h4>
              {loading ? (
                <div className="flex items-center gap-2 text-text-tertiary py-10 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  <span className="text-xs">Loading regions...</span>
                </div>
              ) : regions.length === 0 ? (
                <p className="text-xs text-text-tertiary py-10 text-center">No regions found. Create the first region to begin.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {regions.map((reg) => {
                    const isSelected = selectedRegion?.id === reg.id;
                    return (
                      <div
                        key={reg.id}
                        onClick={() => {
                          setSelectedRegion(reg);
                          setSelectedMarketName(null);
                          setCurrentStep(2);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-accent-soft border-accent'
                            : 'bg-white border-border hover:border-accent/40 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className={`block font-bold text-xs truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>{reg.name}</span>
                          <span className="block text-[10px] text-text-tertiary font-mono truncate mt-0.5">/{reg.slug}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-text-tertiary select-none">
                          <span>{reg.marketDays.length} Markets</span>
                          <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Market Days */}
        {currentStep === 2 && selectedRegion && (
          <div className="p-5 flex-1 flex flex-col md:flex-row gap-6 animate-fade-in">
            {/* Create Market Day form */}
            <form onSubmit={handleCreateMarketDay} className="w-full md:w-[320px] space-y-4 shrink-0 border-b md:border-b-0 md:border-r border-border/60 pb-5 md:pb-0 md:pr-6 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center gap-1.5 select-none text-[10px] text-green font-bold uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Selected: {selectedRegion.name}</span>
                </div>
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Store className="w-4.5 h-4.5 text-green" />
                  <span>Add Market Day</span>
                </h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Market Day Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Kampala Main Market" 
                    value={newMarketName}
                    onChange={(e) => setNewMarketName(e.target.value)}
                    className="w-full bg-white border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Button type="submit" variant="primary" fullWidth>
                  <span>Select & Advance</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-full text-center text-xs text-text-secondary hover:text-text-primary flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Regions</span>
                </button>
              </div>
            </form>

            {/* Selectable Market Days */}
            <div className="flex-1 space-y-3">
              <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Select Existing Market in {selectedRegion.name}</h4>
              {selectedRegion.marketDays.length === 0 ? (
                <p className="text-xs text-text-tertiary py-10 text-center">No market days configured in this region yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {selectedRegion.marketDays.map((m) => {
                    const isSelected = selectedMarketName === m.name;
                    return (
                      <div
                        key={m.name}
                        onClick={() => {
                          setSelectedMarketName(m.name);
                          setCurrentStep(3);
                        }}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-accent-soft border-accent'
                            : 'bg-white border-border hover:border-accent/40 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className={`block font-bold text-xs truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>{m.name}</span>
                          <span className="block text-[9px] text-text-tertiary font-mono truncate mt-0.5">{m.editions.length} Editions</span>
                        </div>
                        <div className="flex justify-end text-text-tertiary hover:text-text-primary pt-1">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Editions */}
        {currentStep === 3 && selectedRegion && selectedMarketName && (
          <div className="p-5 flex-1 flex flex-col md:flex-row gap-6 animate-fade-in">
            {/* Create Edition Form */}
            <form onSubmit={handleCreateEdition} className="w-full md:w-[320px] space-y-3.5 shrink-0 border-b md:border-b-0 md:border-r border-border/60 pb-5 md:pb-0 md:pr-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="space-y-0.5 select-none text-[9px] text-accent font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1"><Map className="w-3 h-3 text-accent" /> Region: {selectedRegion.name}</div>
                  <div className="flex items-center gap-1 mt-0.5"><Store className="w-3 h-3 text-accent" /> Market: {selectedMarketName}</div>
                </div>
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-accent" />
                  <span>Add Event Edition</span>
                </h3>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Edition Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. May 2026" 
                    value={newEditionName}
                    onChange={(e) => setNewEditionName(e.target.value)}
                    className="w-full bg-white border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Event Date</label>
                  <input 
                    type="date" 
                    value={newEditionDate}
                    onChange={(e) => setNewEditionDate(e.target.value)}
                    className="w-full bg-white border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent cursor-pointer"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Venue/Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Motiv Bugolobi" 
                    value={newEditionVenue}
                    onChange={(e) => setNewEditionVenue(e.target.value)}
                    className="w-full bg-white border border-border rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                    required
                  />
                </div>
                <div className="flex items-center gap-2 py-0.5 select-none">
                  <input 
                    type="checkbox" 
                    id="newEditionIsActive"
                    checked={newEditionIsActive}
                    onChange={(e) => setNewEditionIsActive(e.target.checked)}
                    className="w-4 h-4 text-accent border-border rounded focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="newEditionIsActive" className="text-[10px] font-bold text-text-secondary uppercase tracking-wider cursor-pointer select-none">Active Event</label>
                </div>
              </div>
              <div className="space-y-3">
                <Button type="submit" variant="primary" fullWidth disabled={isSavingEdition}>
                  <span>{isSavingEdition ? 'Saving...' : 'Create Edition'}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full text-center text-xs text-text-secondary hover:text-text-primary flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Market Days</span>
                </button>
              </div>
            </form>

            {/* List of existing editions for selected Market Day */}
            <div className="flex-1 space-y-3">
              <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Editions for {selectedMarketName}</h4>
              <div className="divide-y divide-border/40 border border-border/60 rounded-xl bg-white max-h-[320px] overflow-y-auto pr-1">
                {(() => {
                  const activeMarket = selectedRegion.marketDays.find(m => m.name === selectedMarketName);
                  const editionsList = activeMarket?.editions || [];
                  
                  if (editionsList.length === 0) {
                    return <p className="text-xs text-text-tertiary text-center py-10">No editions found. Add the first edition above.</p>;
                  }

                  return editionsList.map((ed) => {
                    const isEditing = editingEditionId === ed.id;
                    return (
                      <div key={ed.id} className="p-3.5 flex items-center justify-between gap-4">
                        {isEditing ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input 
                              type="text"
                              value={editEditionName}
                              onChange={(e) => setEditEditionName(e.target.value)}
                              className="bg-white border border-border rounded px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent"
                              placeholder="Name"
                            />
                            <input 
                              type="date"
                              value={editEditionDate}
                              onChange={(e) => setEditEditionDate(e.target.value)}
                              className="bg-white border border-border rounded px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent"
                            />
                            <input 
                              type="text"
                              value={editEditionVenue}
                              onChange={(e) => setEditEditionVenue(e.target.value)}
                              className="bg-white border border-border rounded px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent animate-none"
                              placeholder="Venue"
                            />
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 select-none">
                              <span className="font-bold text-xs text-text-primary leading-normal">{ed.name}</span>
                              <Badge variant={ed.is_active ? 'success' : 'neutral'} size="sm" className="uppercase font-bold text-[8px] px-1 py-0 select-none">
                                {ed.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-text-tertiary mt-1 select-none">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-accent" /> {new Date(ed.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                              <span>•</span>
                              <span className="truncate flex items-center gap-1"><MapPin className="w-3 h-3 text-accent" /> {ed.venue}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleUpdateEdition(ed.id)}
                                disabled={isUpdatingEdition}
                                className="p-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                title="Save Edition"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingEditionId(null)}
                                className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleToggleEditionStatus(ed.id, ed.is_active)}
                                className={`p-1 rounded border cursor-pointer select-none text-[9px] font-bold uppercase transition-all px-2 ${
                                  ed.is_active 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                                    : 'bg-bg-elevated border-border-light text-text-secondary hover:text-text-primary'
                                }`}
                                title="Toggle Status"
                              >
                                {ed.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleStartEditEdition(ed)}
                                className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                                title="Edit Edition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEdition(ed.id, ed.name)}
                                className="p-1 rounded border border-border-light bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red cursor-pointer"
                                title="Delete Edition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FULL ACCORDION OVERVIEW SECTION */}
      <div className="space-y-4 select-none">
        <h2 className="text-sm font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-accent" />
          <span>Active Operations Directory</span>
        </h2>

        {loading && regions.length === 0 ? (
          <div className="text-center py-20 bg-white border border-border rounded-xl shadow-xs">
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
            <span className="text-xs text-text-tertiary">Loading operations tree...</span>
          </div>
        ) : regions.length === 0 ? (
          <div className="text-center py-20 bg-white border border-border rounded-xl shadow-xs">
            <Map className="w-12 h-12 text-text-tertiary mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-text-secondary">No regions configured yet</p>
            <p className="text-[10px] text-text-tertiary mt-1">Configure your first region in the stepper above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {regions.map((reg) => {
              const isExpanded = !!expandedRegions[reg.id];
              const isEditingReg = editingRegionId === reg.id;
              
              return (
                <div key={reg.id} className="bg-white border border-border rounded-xl shadow-xs overflow-hidden transition-all duration-200">
                  
                  {/* Region Summary Card Row */}
                  <div 
                    onClick={() => toggleRegionAccordion(reg.id)}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-all select-none"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-3" onClick={e => isEditingReg ? e.stopPropagation() : null}>
                      <div className="w-9 h-9 rounded-full bg-sky-50 text-accent flex items-center justify-center shrink-0">
                        <Map className="w-4.5 h-4.5 text-accent" />
                      </div>
                      {isEditingReg ? (
                        <div className="flex-1 flex gap-2 max-w-md">
                          <input 
                            type="text"
                            value={editRegionName}
                            onChange={(e) => {
                              setEditRegionName(e.target.value);
                              setEditRegionSlug(slugify(e.target.value));
                            }}
                            className="bg-white border border-border rounded px-2.5 py-1 text-xs font-bold text-text-primary outline-none focus:border-accent"
                            placeholder="Region Name"
                            required
                          />
                          <input 
                            type="text"
                            value={editRegionSlug}
                            onChange={(e) => setEditRegionSlug(slugify(e.target.value))}
                            className="bg-white border border-border rounded px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent font-mono"
                            placeholder="Slug"
                            required
                          />
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-text-primary truncate">{reg.name} Region</span>
                            <Badge variant="success" size="sm" className="font-mono text-[8px] lowercase font-normal px-1.5 py-0 select-none">
                              /{reg.slug}
                            </Badge>
                          </div>
                          <span className="block text-[10px] text-text-tertiary font-medium mt-0.5">
                            {reg.marketDays.length} active Market Day configurations
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 select-none shrink-0" onClick={e => e.stopPropagation()}>
                      {isEditingReg ? (
                        <>
                          <button
                            onClick={() => handleUpdateRegion(reg.id)}
                            disabled={isUpdatingRegion}
                            className="p-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                            title="Save Region"
                          >
                            <Check className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => setEditingRegionId(null)}
                            className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-4.5 h-4.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEditRegion(reg)}
                            className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                            title="Edit Region"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRegion(reg.id, reg.name)}
                            className="p-1 rounded border border-border-light bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red cursor-pointer"
                            title="Delete Region"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => toggleRegionAccordion(reg.id)}
                            className={`p-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-bg-elevated transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Collapsible content (list of markets and their editions) */}
                  {isExpanded && (
                    <div className="border-t border-border bg-slate-50/50 p-4 space-y-4 animate-fade-in text-xs">
                      {reg.marketDays.length === 0 ? (
                        <div className="text-center py-6 text-[10px] text-text-tertiary">
                          No markets registered in this region. Add a market day above.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {reg.marketDays.map((market) => {
                            const marketKey = `${reg.id}_${market.name}`;
                            const isEditingMarket = editingMarketKey === marketKey;
                            
                            return (
                              <div key={market.name} className="bg-white border border-border rounded-xl shadow-xs p-4.5 space-y-4 flex flex-col justify-between">
                                <div className="space-y-3.5">
                                  {/* Market name edit bar */}
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                      <Store className="w-4.5 h-4.5 text-accent shrink-0" />
                                      {isEditingMarket ? (
                                        <input
                                          type="text"
                                          value={editMarketNameVal}
                                          onChange={(e) => setEditMarketNameVal(e.target.value)}
                                          className="flex-1 bg-white border border-border rounded px-2.5 py-0.5 text-xs font-bold text-text-primary outline-none focus:border-accent"
                                          required
                                        />
                                      ) : (
                                        <h4 className="font-bold text-xs text-text-primary truncate uppercase tracking-wider">{market.name}</h4>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {isEditingMarket ? (
                                        <>
                                          <button
                                            onClick={() => handleUpdateMarketName(reg.id, market.name)}
                                            disabled={isUpdatingMarketName}
                                            className="p-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                            title="Save Name"
                                          >
                                            <Check className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => setEditingMarketKey(null)}
                                            className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                                            title="Cancel"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => handleStartEditMarketName(reg.id, market.name)}
                                            className="p-1 rounded border border-border-light bg-bg-elevated text-text-secondary hover:text-text-primary cursor-pointer"
                                            title="Rename Market"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteMarketDay(reg.id, market.name)}
                                            className="p-1 rounded border border-border-light bg-bg-elevated hover:bg-red-soft/20 text-text-secondary hover:text-red cursor-pointer"
                                            title="Delete Market"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Editions table list inside market card */}
                                  <div className="space-y-2">
                                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider block">Editions / Events ({market.editions.length})</span>
                                    <div className="divide-y divide-border/40 border border-border rounded-lg overflow-hidden bg-slate-50/40 max-h-[140px] overflow-y-auto pr-0.5">
                                      {market.editions.length === 0 ? (
                                        <p className="text-[10px] text-text-tertiary text-center py-5">No editions registered yet.</p>
                                      ) : (
                                        market.editions.map((ed) => (
                                          <div key={ed.id} className="p-2.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-all select-none">
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-[11px] text-text-primary">{ed.name}</span>
                                                <Badge variant={ed.is_active ? 'success' : 'neutral'} size="sm" className="uppercase text-[7px] font-bold px-1 select-none">
                                                  {ed.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                              </div>
                                              <div className="text-[9px] text-text-tertiary truncate mt-0.5">
                                                {new Date(ed.date).toLocaleDateString(undefined, { dateStyle: 'medium' })} • {ed.venue}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                onClick={() => handleToggleEditionStatus(ed.id, ed.is_active)}
                                                className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded border cursor-pointer ${
                                                  ed.is_active 
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                                                    : 'bg-slate-100 border-border text-text-secondary hover:text-text-primary'
                                                }`}
                                              >
                                                Toggle
                                              </button>
                                              <button
                                                onClick={() => handleDeleteEdition(ed.id, ed.name)}
                                                className="p-1 rounded bg-bg hover:bg-red-soft/20 text-text-secondary hover:text-red cursor-pointer shrink-0"
                                                title="Delete Edition"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
