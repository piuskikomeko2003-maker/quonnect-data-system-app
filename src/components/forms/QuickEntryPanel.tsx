import React from 'react';
import { PaidVendorForm, PaidVendorFormProps } from './PaidVendorForm';
import { FieldCollectionForm, FieldCollectionFormProps } from './FieldCollectionForm';
import { WalkinForm, WalkinFormProps } from './WalkinForm';
import { ChevronUp, ChevronDown, Zap, Users, Footprints, Database } from 'lucide-react';
import { Button } from '../ui/Button';

export interface QuickEntryPanelProps {
  activeTab: 'paid' | 'collection' | 'walkin';
  onTabChange: (tab: 'paid' | 'collection' | 'walkin') => void;
  isOpen: boolean;
  onToggleCollapse: () => void;
  
  // Forms props
  paidVendorFormProps: PaidVendorFormProps;
  fieldCollectionFormProps: FieldCollectionFormProps;
  walkinFormProps: WalkinFormProps;
}

export const QuickEntryPanel: React.FC<QuickEntryPanelProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onToggleCollapse,
  paidVendorFormProps,
  fieldCollectionFormProps,
  walkinFormProps
}) => {
  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden transition-all duration-300 select-none">
      {/* Header panel with Collapse switch */}
      <div 
        onClick={onToggleCollapse}
        className="p-4 bg-bg-elevated/40 border-b border-border flex items-center justify-between cursor-pointer hover:bg-bg-elevated/60"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4.5 h-4.5 text-green animate-pulse" />
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Quick Entry Panel</h3>
        </div>
        <button className="text-text-secondary hover:text-text-primary cursor-pointer">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable Content Container */}
      <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[1200px] border-t-0' : 'max-h-0 pointer-events-none'}`}>
        {/* Navigation Tabs */}
        <div className="flex border-b border-border p-1 bg-bg-elevated/10">
          <button
            onClick={() => onTabChange('paid')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'paid'
                ? 'bg-bg-surface text-green border border-border-light shadow-card font-bold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Paid Vendor</span>
          </button>
          <button
            onClick={() => onTabChange('collection')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'collection'
                ? 'bg-bg-surface text-green border border-border-light shadow-card font-bold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Field Collection</span>
          </button>
          <button
            onClick={() => onTabChange('walkin')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'walkin'
                ? 'bg-bg-surface text-green border border-border-light shadow-card font-bold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Walk-in</span>
          </button>
        </div>

        {/* Selected Form Content wrapper */}
        <div className="p-5 bg-bg-surface/30">
          {activeTab === 'paid' && <PaidVendorForm {...paidVendorFormProps} />}
          {activeTab === 'collection' && <FieldCollectionForm {...fieldCollectionFormProps} />}
          {activeTab === 'walkin' && <WalkinForm {...walkinFormProps} />}
        </div>
      </div>
    </div>
  );
};
