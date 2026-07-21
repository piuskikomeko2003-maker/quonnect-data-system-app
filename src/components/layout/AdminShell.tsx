import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Footprints,
  ClipboardList,
  Zap,
  Settings,
  ChevronDown,
  Building2,
  Menu,
  Plus,
  MapPin,
  Calendar,
  X,
  PlusCircle,
  UploadCloud,
  Store,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { useRegion, Region, Edition } from '@/context/RegionContext';
import { createClient } from '@/lib/supabase/client';
import { Button } from '../ui/Button';

export interface AdminShellProps {
  activeNav: string;
  onNavChange: (navId: string) => void;
  user: {
    name: string;
    role: string;
    avatarInitials: string;
  };
  onLogout?: () => void;
  children: React.ReactNode;
  vendorAlertCount?: number;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  activeNav,
  onNavChange,
  user,
  onLogout,
  children,
  vendorAlertCount = 0
}) => {
  const { 
    activeRegion, 
    activeEdition, 
    regions, 
    editions, 
    switchRegion, 
    setActiveEdition,
    refreshRegions
  } = useRegion();

  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [isEditionDropdownOpen, setIsEditionDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRegionName, setNewRegionName] = useState('');
  const [newRegionSlug, setNewRegionSlug] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' }>>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const navigationSections = [
    {
      label: 'Operations',
      items: [
        { id: 'overview', name: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
        { 
          id: 'vendors', 
          name: 'Vendors', 
          icon: <Users className="w-5 h-5" />, 
          badge: vendorAlertCount > 0 ? { type: 'action', value: vendorAlertCount } : undefined 
        },
        { id: 'walkins', name: 'Walk-ins', icon: <Footprints className="w-5 h-5" /> },
        { id: 'quick-entry', name: 'Quick Entry', icon: <Zap className="w-5 h-5" /> },
        { id: 'import-export', name: 'Import/Export', icon: <UploadCloud className="w-5 h-5" /> },
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'formbuilder', name: 'Form Builder', icon: <ClipboardList className="w-5 h-5" /> },
        { id: 'markets', name: 'Create Market', icon: <Store className="w-5 h-5" /> },
        { id: 'settings', name: 'Settings', icon: <Settings className="w-5 h-5" /> },
      ]
    }
  ];

  const getNavIcon = (id: string) => {
    switch (id) {
      case 'overview': return <LayoutDashboard className="w-5 h-5" />;
      case 'vendors': return <Users className="w-5 h-5" />;
      case 'walkins': return <Footprints className="w-5 h-5" />;
      case 'quick-entry': return <Zap className="w-5 h-5" />;
      case 'import-export': return <UploadCloud className="w-5 h-5" />;
      case 'formbuilder': return <ClipboardList className="w-5 h-5" />;
      case 'markets': return <Store className="w-5 h-5" />;
      case 'settings': return <Settings className="w-5 h-5" />;
      default: return <Building2 className="w-5 h-5" />;
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleRegionNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewRegionName(val);
    setNewRegionSlug(slugify(val));
  };

  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionName.trim() || !newRegionSlug.trim()) return;

    setIsCreating(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not available");

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

      addToast(`Region "${data.name}" created!`, 'success');
      setNewRegionName('');
      setNewRegionSlug('');
      setIsCreateModalOpen(false);
      
      await refreshRegions();
      if (data) {
        switchRegion({
          id: data.id,
          name: data.name,
          slug: data.slug,
          is_active: data.is_active
        });
      }
    } catch (err: any) {
      console.error(err);
      addToast(`Failed to create region: ${err.message}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      {/* Sidebar: w-[268px] on desktop, w-[60px] on mobile (md breakpoint) */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen bg-bg-surface border-r border-border flex flex-col z-100 transition-all duration-200 ${isMobileMenuOpen ? 'w-[268px]' : 'w-[60px] md:w-[268px]'} md:translate-x-0`}>
        {/* Brand logo */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className={`logo font-black text-xl tracking-tight select-none ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            QUON<span className="text-green">NECT</span>
            <div className="text-[10px] text-text-tertiary tracking-wider font-semibold uppercase mt-0.5">Workspace Mode</div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="md:hidden text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* WORKSPACE SELECTION BLOCK (Region and Edition) */}
        <div className={`p-3 border-b border-border space-y-2 select-none ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          
          {/* Region Switcher Button */}
          <div className="relative">
            <button 
              onClick={() => {
                setIsRegionDropdownOpen(!isRegionDropdownOpen);
                setIsEditionDropdownOpen(false);
              }}
              className="flex items-center gap-2.5 w-full p-2.5 bg-bg-elevated border border-border hover:border-green hover:bg-green-soft/10 text-text-primary cursor-pointer transition-all text-left rounded-lg"
            >
              <div className="w-7 h-7 rounded-full bg-green-muted flex items-center justify-center text-green shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[11px] font-bold text-text-primary truncate">
                  {activeRegion ? activeRegion.name : 'Select Region'}
                </span>
                <small className="block text-[9px] text-text-tertiary truncate">
                  {activeRegion && activeEdition ? activeEdition.name : (activeRegion ? 'Switch region workspace' : 'Click to select region')}
                </small>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
            </button>

            {/* Region dropdown overlay */}
            {isRegionDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-bg-surface border border-border rounded-lg shadow-lg z-[999] py-1">
                <div className="max-h-[200px] overflow-y-auto divide-y divide-border/20">
                  {regions.map((r) => {
                    const count = (r as any).market_days?.[0]?.count ?? 0;
                    const isActive = activeRegion?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          switchRegion(r);
                          setIsRegionDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between w-full px-4 py-2 hover:bg-bg-hover text-left text-xs ${isActive ? 'bg-green-soft text-green font-bold' : 'text-text-secondary'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{r.name}</span>
                          <span className="block text-[9px] text-text-tertiary truncate mt-0.5">
                            {count} {count === 1 ? 'Market Day' : 'Market Days'}
                          </span>
                        </div>
                        {isActive && <Badge variant="success" size="sm">Active</Badge>}
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-border bg-bg-elevated/40">
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(true);
                      setIsRegionDropdownOpen(false);
                    }}
                    className="w-full py-1 text-center text-[10px] font-bold text-green hover:underline flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Create New Region</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Edition Switcher Button */}
          {activeRegion && (
            <div className="relative">
              <button 
                onClick={() => {
                  setIsEditionDropdownOpen(!isEditionDropdownOpen);
                  setIsRegionDropdownOpen(false);
                }}
                className="flex items-center gap-2.5 w-full p-2.5 bg-bg-elevated border border-border hover:border-green hover:bg-green-soft/10 text-text-primary cursor-pointer transition-all text-left rounded-lg"
              >
                <div className="w-7 h-7 rounded-full bg-green-muted flex items-center justify-center text-green shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[11px] font-bold text-text-primary truncate">
                    {activeEdition ? activeEdition.name : 'Select Event...'}
                  </span>
                  {activeEdition && (
                    <small className="block text-[9px] text-text-tertiary truncate">
                      {activeEdition.venue || 'No venue configured'}
                    </small>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
              </button>

              {/* Edition dropdown overlay */}
              {isEditionDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-bg-surface border border-border rounded-lg shadow-lg z-[999] py-1">
                  <div className="max-h-[200px] overflow-y-auto divide-y divide-border/20">
                    {editions.length === 0 ? (
                      <p className="text-[10px] text-text-tertiary text-center py-4">No events found in this region.</p>
                    ) : (
                      editions.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => {
                            setActiveEdition(e);
                            setIsEditionDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-4 py-2 hover:bg-bg-hover text-left text-xs ${activeEdition?.id === e.id ? 'bg-green-soft text-green font-bold' : 'text-text-secondary'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{e.name}</span>
                            <span className="block text-[9px] text-text-tertiary truncate mt-0.5">{e.venue}</span>
                          </div>
                          {activeEdition?.id === e.id && <Badge variant="success" size="sm">Selected</Badge>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Nav list */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigationSections.map((section, idx) => (
            <div key={idx} className="mb-4">
              <div className={`px-5 py-1 text-[9px] font-bold text-text-tertiary uppercase tracking-widest select-none ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
                {section.label}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavChange(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 py-2 px-4 mx-2 rounded-md font-medium text-xs border border-transparent transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-green text-black font-semibold' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      {getNavIcon(item.id)}
                      <span className={`flex-1 text-left ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
                        {item.name}
                      </span>
                      {item.badge && isMobileMenuOpen && (
                        <Badge variant="danger" size="sm">
                          {item.badge.value}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logged in User widget */}
        <div className={`p-4 border-t border-border flex items-center gap-3 bg-bg-elevated/20 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <div className="w-8 h-8 rounded-full bg-green text-black flex items-center justify-center font-bold text-xs shrink-0 select-none">
            {user.avatarInitials}
          </div>
          <div className="flex-1 min-w-0 select-none">
            <span className="block text-[11px] font-bold text-text-primary truncate">{user.name}</span>
            <small className="block text-[9px] text-text-tertiary truncate">{user.role}</small>
          </div>
          {onLogout && (
            <button 
              onClick={onLogout} 
              className="text-text-secondary hover:text-red cursor-pointer p-1 rounded hover:bg-bg-hover shrink-0"
              title="Sign Out"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* Header container */}
        <header className="p-4 border-b border-border bg-bg-surface flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="md:hidden text-text-secondary hover:text-text-primary cursor-pointer p-1"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
              <span>Quonnect Data Hub</span>
              {activeRegion && (
                <>
                  <span className="text-text-tertiary">/</span>
                  <Badge variant="info" size="sm">
                    {activeRegion.name} Region
                  </Badge>
                </>
              )}
              {activeRegion && (
                <>
                  <span className="text-text-tertiary">/</span>
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setIsEditionDropdownOpen(!isEditionDropdownOpen);
                        setIsRegionDropdownOpen(false);
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-text-primary bg-bg-elevated hover:bg-bg-hover border border-border rounded cursor-pointer transition-all"
                    >
                      <Calendar className="w-3.5 h-3.5 text-green" />
                      <span>{activeEdition ? activeEdition.name : 'Select Event...'}</span>
                      <ChevronDown className="w-3 h-3 text-text-tertiary shrink-0" />
                    </button>

                    {isEditionDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-56 bg-bg-surface border border-border rounded-lg shadow-lg z-[9999] py-1">
                        <div className="max-h-[200px] overflow-y-auto divide-y divide-border/20 text-left">
                          {editions.length === 0 ? (
                            <p className="text-[10px] text-text-tertiary text-center py-4">No events found in this region.</p>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setActiveEdition(null);
                                  setIsEditionDropdownOpen(false);
                                }}
                                className={`flex items-center justify-between w-full px-3 py-2 hover:bg-bg-hover text-left text-xs ${!activeEdition ? 'bg-green-soft text-green font-bold' : 'text-text-secondary'}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold">All Event Editions</span>
                                  <span className="block text-[9px] text-text-tertiary truncate mt-0.5">Show region-wide data</span>
                                </div>
                                {!activeEdition && <Badge variant="success" size="sm">Selected</Badge>}
                              </button>
                              {editions.map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => {
                                    setActiveEdition(e);
                                    setIsEditionDropdownOpen(false);
                                  }}
                                  className={`flex items-center justify-between w-full px-3 py-2 hover:bg-bg-hover text-left text-xs ${activeEdition?.id === e.id ? 'bg-green-soft text-green font-bold' : 'text-text-secondary'}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold">{e.name}</span>
                                    <span className="block text-[9px] text-text-tertiary truncate mt-0.5">{e.venue || 'No venue'}</span>
                                  </div>
                                  {activeEdition?.id === e.id && <Badge variant="success" size="sm">Selected</Badge>}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="text-[10px] font-bold text-text-tertiary tracking-wider uppercase font-mono select-none">
            System Online
          </div>
        </header>

        {/* Dynamic page contents wrapper */}
        <div className="p-6 max-w-7xl w-full mx-auto flex-1 flex flex-col overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Region Creation Modal Overlay */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] select-none text-left">
          <div className="bg-bg-surface border border-border rounded-lg max-w-md w-full p-5 shadow-modal animate-scale-up space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4.5 h-4.5 text-green" />
                <span>Create Operational Region</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRegion} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Region Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Jinja" 
                  value={newRegionName}
                  onChange={handleRegionNameChange}
                  className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">Region Slug</label>
                <input 
                  type="text" 
                  placeholder="e.g. jinja" 
                  value={newRegionSlug}
                  onChange={(e) => setNewRegionSlug(slugify(e.target.value))}
                  className="w-full bg-bg-input border border-border-light rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-green font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Region'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-lg shadow-lg text-xs font-semibold text-white pointer-events-auto border ${
              toast.type === 'success' 
                ? 'bg-green-soft border-green text-green' 
                : 'bg-red-soft border-red text-red'
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
    </div>
  );
};
