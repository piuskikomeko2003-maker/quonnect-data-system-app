import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Footprints,
  TrendingUp,
  BarChart3,
  Tag,
  Heart,
  ClipboardList,
  Zap,
  AlertTriangle,
  UploadCloud,
  Store,
  GitCompare,
  Settings,
  ChevronDown,
  Building2,
  LogOut,
  Menu
} from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface Market {
  id: string;
  name: string;
  type: 'flagship' | 'regional' | 'pilot';
  vendorsCount: number;
}

export interface AdminShellProps {
  currentMarket: Market;
  markets: Market[];
  onMarketChange: (marketId: string) => void;
  activeNav: string;
  onNavChange: (navId: string) => void;
  user: {
    name: string;
    role: string;
    avatarInitials: string;
  };
  onLogout?: () => void;
  children: React.ReactNode;
  
  // Badges support
  vendorAlertCount?: number;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  currentMarket,
  markets,
  onMarketChange,
  activeNav,
  onNavChange,
  user,
  onLogout,
  children,
  vendorAlertCount = 0
}) => {
  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const getMarketBadgeColor = (type: string) => {
    switch (type) {
      case 'flagship': return 'success';
      case 'regional': return 'info';
      case 'pilot': return 'warning';
      default: return 'neutral';
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
            <div className="text-[10px] text-text-tertiary tracking-wider font-semibold uppercase mt-0.5">Market Day System</div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="md:hidden text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Market switcher dropdown container */}
        <div className={`p-3 border-b border-border relative ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <button 
            onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
            className="flex items-center gap-2.5 w-full p-2.5 bg-bg-elevated border border-border-light rounded-md hover:border-green hover:bg-green-soft hover:text-text-primary cursor-pointer transition-all text-left"
          >
            <div className="w-7 h-7 rounded-full bg-green-muted flex items-center justify-center text-green shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[12px] font-bold text-text-primary truncate">{currentMarket.name}</span>
              <small className="block text-[10px] text-text-tertiary truncate">
                {currentMarket.type.charAt(0).toUpperCase() + currentMarket.type.slice(1)} · {currentMarket.vendorsCount} vendors
              </small>
            </div>
            <Badge variant={getMarketBadgeColor(currentMarket.type)} size="sm" className="shrink-0 uppercase">
              {currentMarket.type}
            </Badge>
            <ChevronDown className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
          </button>

          {/* Switcher Dropdown */}
          {isMarketDropdownOpen && (
            <div className="absolute left-3 right-3 mt-1.5 bg-bg-elevated border border-border-light rounded-md shadow-elevated z-150 py-1.5">
              {markets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onMarketChange(m.id);
                    setIsMarketDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-4 py-2 hover:bg-bg-hover text-left ${currentMarket.id === m.id ? 'bg-green-soft text-green font-semibold' : 'text-text-secondary'}`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs truncate">{m.name}</span>
                    <small className="block text-[10px] text-text-tertiary truncate">{m.vendorsCount} vendors</small>
                  </div>
                  <Badge variant={getMarketBadgeColor(m.type)} size="sm">
                    {m.type}
                  </Badge>
                </button>
              ))}
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
                          ? 'bg-green-muted text-green' 
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                      title={item.name}
                    >
                      <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                      <span className={`flex-1 text-left ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>{item.name}</span>
                      {item.badge && (isMobileMenuOpen || window.innerWidth >= 768) && (
                        <span className={`shrink-0 ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full select-none ${
                          item.badge.type === 'action' 
                            ? 'bg-red-muted text-red' 
                            : 'bg-blue-muted text-blue'
                        }`}>
                          {item.badge.value}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User chip footer */}
        <div className="p-3 border-t border-border mt-auto shrink-0 bg-bg-surface">
          <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-bg-hover group relative">
            <div className="w-8 h-8 rounded-full bg-purple-muted text-purple flex items-center justify-center font-bold text-xs select-none">
              {user.avatarInitials}
            </div>
            <div className={`flex-1 min-w-0 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
              <div className="text-xs font-semibold text-text-primary truncate">{user.name}</div>
              <div className="text-[10px] text-text-tertiary truncate">{user.role}</div>
            </div>
            {onLogout && (
              <button 
                onClick={onLogout} 
                className={`text-text-tertiary hover:text-red transition-colors cursor-pointer p-1 rounded hover:bg-bg-elevated ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content pane */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col bg-bg overflow-x-hidden pl-[60px] md:pl-0">
        <div className="max-w-[1280px] w-full mx-auto p-6 md:p-7 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};
