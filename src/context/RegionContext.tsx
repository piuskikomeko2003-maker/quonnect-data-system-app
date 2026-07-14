'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Region {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
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
  setActiveEdition: (edition: Edition | null) => void;
  switchRegion: (region: Region) => void;
  refreshRegions: () => Promise<void>;
}

const RegionContext = createContext<RegionContextType | null>(null);

export const RegionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [activeEdition, setActiveEdition] = useState<Edition | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);

  const fetchRegionsAndEditions = async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data: rData, error: rErr } = await supabase
        .from('regions')
        .select('*')
        .order('name');

      if (rErr) throw rErr;
      setRegions(rData || []);

      // If active region is selected, fetch its editions
      if (activeRegion) {
        const { data: eData, error: eErr } = await supabase
          .from('market_days')
          .select('id, name, event_date, edition, status, notes')
          .eq('region_id', activeRegion.id)
          .order('event_date', { ascending: false });

        if (eErr) throw eErr;

        const mappedEditions: Edition[] = (eData || []).map((row: any) => ({
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
              setActiveEdition(mappedEditions[0] || null);
            }
          } catch (e) {
            setActiveEdition(mappedEditions[0] || null);
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
  };

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

  // Fetch data when active region changes
  useEffect(() => {
    fetchRegionsAndEditions();
  }, [activeRegion?.id]);

  const switchRegion = (region: Region) => {
    setActiveRegion(region);
    setActiveEdition(null);
    localStorage.setItem('activeRegion', JSON.stringify(region));
    localStorage.removeItem('activeEdition');
  };

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
