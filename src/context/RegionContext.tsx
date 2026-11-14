'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isTestEdition } from '@/lib/editions';
import { useAuth } from '@/hooks/useAuth';
import {
  canAccessSection as checkSectionAccess,
  canManageSection as checkSectionManage,
  type RegionSectionKey,
  type SectionPermissions,
  type UserRole,
} from '@/lib/auth/permissions';

export interface Region {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  market_days?: { count: number }[];
}

export interface Edition {
  id: string;
  name: string;
  date: string;
  venue: string;
  is_active: boolean;
}

interface RegionContextType {
  activeRegion: Region | null;
  activeEdition: Edition | null;
  regions: Region[];
  editions: Edition[];
  loadingRegions: boolean;
  /** True when the workspace is pinned to a single region. */
  isRegionLocked: boolean;
  /** Region a Regional Manager is assigned to, if any. */
  managedRegionId: string | null;
  /** Role of the signed-in user (null while loading). */
  role: UserRole | null;
  /** Per-section permissions for a Regional Manager. */
  sectionPermissions: SectionPermissions;
  /** True when the user may act inside a section (view or manage). */
  canAccessSection: (section: RegionSectionKey) => boolean;
  /** True when the user may mutate data inside a section. */
  canManageSection: (section: RegionSectionKey) => boolean;
  setActiveEdition: (edition: Edition | null) => void;
  switchRegion: (region: Region) => void;
  refreshRegions: () => Promise<void>;
}

const RegionContext = createContext<RegionContextType | null>(null);

export const RegionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, profile } = useAuth();
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [activeEdition, setActiveEdition] = useState<Edition | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);

  const isManager = role === 'regional_manager';
  const managedRegionId = isManager ? profile?.managed_region_id ?? null : null;
  const sectionPermissions = (profile?.section_permissions ?? {}) as SectionPermissions;
  const isRegionLocked = isManager;

  const fetchRegionsAndEditions = useCallback(async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data: rData, error: rErr } = await supabase
        .from('regions')
        .select('*, market_days(count)')
        .order('name');

      if (rErr) throw rErr;

      // A Regional Manager only ever sees the single region assigned to them.
      const visibleRegions = managedRegionId
        ? (rData || []).filter((r: any) => r.id === managedRegionId)
        : (rData || []);
      setRegions(visibleRegions);

      // Resolve the region whose editions we should load. For a locked manager
      // this is always their assigned region, even if localStorage still holds
      // a different last-used workspace.
      const regionForEditions = isManager
        ? (managedRegionId
            ? visibleRegions.find((r: any) => r.id === managedRegionId) ?? null
            : null)
        : activeRegion;

      if (isManager) {
        if (!regionForEditions) {
          // Manager has no region assigned — never keep a stale workspace.
          if (activeRegion) setActiveRegion(null);
          localStorage.removeItem('activeRegion');
        } else if (activeRegion?.id !== regionForEditions.id) {
          setActiveRegion(regionForEditions as Region);
          localStorage.setItem('activeRegion', JSON.stringify(regionForEditions));
        }
      }

      // If active region is selected, fetch its editions
      if (regionForEditions) {
        const { data: eData, error: eErr } = await supabase
          .from('market_days')
          .select('id, name, event_date, edition, status, notes')
          .eq('region_id', regionForEditions.id)
          .order('event_date', { ascending: false });

        if (eErr) throw eErr;

        const mappedEditions: Edition[] = (eData || [])
          .filter((row: any) => !isTestEdition(row))
          .map((row: any) => ({
            id: row.id,
            name: row.edition || row.name || 'Untitled Edition',
            date: row.event_date || '',
            venue: row.notes || '',
            is_active: row.status === 'active'
          }));
        setEditions(mappedEditions);

        // Keep activeEdition synced or set default
        const savedEdition = localStorage.getItem('activeEdition');
        if (savedEdition) {
          try {
            const parsedEdition = JSON.parse(savedEdition);
            const found = mappedEditions.find(e => e.id === parsedEdition.id);
            if (found) {
              setActiveEdition(found);
            } else {
              const fallback = mappedEditions.find(e => e.is_active) || mappedEditions[0] || null;
              setActiveEdition(fallback);
              if (fallback) {
                localStorage.setItem('activeEdition', JSON.stringify(fallback));
              } else {
                localStorage.removeItem('activeEdition');
              }
            }
          } catch (e) {
            const fallback = mappedEditions.find(e => e.is_active) || mappedEditions[0] || null;
            setActiveEdition(fallback);
          }
        } else if (mappedEditions.length > 0) {
          const activeOrFirst = mappedEditions.find(e => e.is_active) || mappedEditions[0];
          setActiveEdition(activeOrFirst);
          localStorage.setItem('activeEdition', JSON.stringify(activeOrFirst));
        } else {
          setActiveEdition(null);
        }
      } else {
        setEditions([]);
        setActiveEdition(null);
      }
    } catch (err) {
      console.error("Error fetching regions context:", err);
    } finally {
      setLoadingRegions(false);
    }
  }, [activeRegion?.id, managedRegionId, isManager]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedRegion = localStorage.getItem('activeRegion');
    if (savedRegion) {
      try {
        const parsedRegion = JSON.parse(savedRegion);
        setActiveRegion(parsedRegion);
      } catch (e) {
        console.error(e);
      }
    }
    setLoadingRegions(false);
  }, []);

  // Fetch data when active region changes (or when a manager's lock resolves)
  useEffect(() => {
    fetchRegionsAndEditions();
  }, [fetchRegionsAndEditions]);

  const switchRegion = (region: Region) => {
    // Regional Managers cannot leave their assigned region.
    if (isManager && region.id !== managedRegionId) return;
    setActiveRegion(region);
    setActiveEdition(null);
    localStorage.setItem('activeRegion', JSON.stringify(region));
    localStorage.removeItem('activeEdition');
  };

  const canAccessSection = (section: RegionSectionKey) =>
    checkSectionAccess(role, sectionPermissions, section);
  const canManageSection = (section: RegionSectionKey) =>
    checkSectionManage(role, sectionPermissions, section);

  const handleSetActiveEdition = (edition: Edition | null) => {
    setActiveEdition(edition);
    if (edition) {
      localStorage.setItem('activeEdition', JSON.stringify(edition));
    } else {
      localStorage.removeItem('activeEdition');
    }
  };

  return (
    <RegionContext.Provider value={{
      activeRegion,
      activeEdition,
      regions,
      editions,
      loadingRegions,
      isRegionLocked,
      managedRegionId,
      role,
      sectionPermissions,
      canAccessSection,
      canManageSection,
      setActiveEdition: handleSetActiveEdition,
      switchRegion,
      refreshRegions: fetchRegionsAndEditions
    }}>
      {children}
    </RegionContext.Provider>
  );
};

export const useRegion = () => {
  const context = useContext(RegionContext);
  if (!context) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
};
