import React from 'react';
import { DynamicQuickEntryForm, DynamicQuickEntryFormProps } from './DynamicQuickEntryForm';
import { ChevronUp, ChevronDown, Zap, Users, Footprints, Database } from 'lucide-react';

type QuickEntryTab = 'paid' | 'collection' | 'walkin';

interface TabFormConfig {
  slug: string;
  label: string;
  subtitle?: string;
  countLabel: string;
  icon: React.ReactNode;
  lookupEnabled: boolean;
}

const TAB_FORMS: Record<QuickEntryTab, TabFormConfig> = {
  paid: {
    slug: 'paid_vendor_registration',
    label: 'Paid Vendor Entry',
    subtitle: 'Register confirmed/paid vendors',
    countLabel: 'paid vendors added',
    icon: <Users className="w-4 h-4 text-green" />,
    lookupEnabled: true,
  },
  collection: {
    slug: 'vendor_data_collection',
    label: 'Field Data Collection',
    subtitle: 'Impact & Demographics Sheet',
    countLabel: 'profiles collected',
    icon: <Database className="w-4 h-4 text-green" />,
    lookupEnabled: true,
  },
  walkin: {
    slug: 'walkin_registration',
    label: 'Walk-in Guest Registry',
    subtitle: 'Optimized for speed entry',
    countLabel: 'walk-ins entered',
    icon: <Footprints className="w-4 h-4 text-green" />,
    lookupEnabled: false,
  },
};

export interface QuickEntryPanelProps {
  activeTab: QuickEntryTab;
  onTabChange: (tab: QuickEntryTab) => void;
  isOpen: boolean;
  onToggleCollapse: () => void;
  disabled?: boolean;
  activeEdition: { id: string; name: string } | null;
  onPaidSubmit: (answers: Record<string, string>) => Promise<void>;
  onCollectionSubmit: (answers: Record<string, string>) => Promise<void>;
  onWalkinSubmit: (answers: Record<string, string>) => Promise<void>;
  onPhoneLookup: (phone: string, formSlug: string) => Promise<Record<string, string> | null>;
  paidCount: number;
  collectionCount: number;
  walkinCount: number;
  paidSuccessState: { show: boolean; name?: string; onAddAnother: () => void };
  collectionSuccessState: { show: boolean; name?: string; onAddAnother: () => void };
  walkinSuccessState: { show: boolean; name?: string; onAddAnother: () => void };
}

export const QuickEntryPanel: React.FC<QuickEntryPanelProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onToggleCollapse,
  disabled = false,
  activeEdition,
  onPaidSubmit,
  onCollectionSubmit,
  onWalkinSubmit,
  onPhoneLookup,
  paidCount,
  collectionCount,
  walkinCount,
  paidSuccessState,
  collectionSuccessState,
  walkinSuccessState,
}) => {
  const currentConfig = TAB_FORMS[activeTab];

  const getFormProps = (tab: QuickEntryTab): DynamicQuickEntryFormProps => {
    switch (tab) {
      case 'paid':
        return {
          formSlug: 'paid_vendor_registration',
          activeEdition,
          onSubmit: onPaidSubmit,
          onPhoneLookup: (phone) => onPhoneLookup(phone, 'paid_vendor_registration'),
          successState: paidSuccessState,
          runningCount: paidCount,
          formIcon: TAB_FORMS.paid.icon,
          formLabel: TAB_FORMS.paid.label,
          formSubtitle: TAB_FORMS.paid.subtitle,
          countLabel: TAB_FORMS.paid.countLabel,
          lookupEnabled: true,
        };
      case 'collection':
        return {
          formSlug: 'vendor_data_collection',
          activeEdition,
          onSubmit: onCollectionSubmit,
          onPhoneLookup: (phone) => onPhoneLookup(phone, 'vendor_data_collection'),
          successState: collectionSuccessState,
          runningCount: collectionCount,
          formIcon: TAB_FORMS.collection.icon,
          formLabel: TAB_FORMS.collection.label,
          formSubtitle: TAB_FORMS.collection.subtitle,
          countLabel: TAB_FORMS.collection.countLabel,
          lookupEnabled: true,
        };
      case 'walkin':
        return {
          formSlug: 'walkin_registration',
          activeEdition,
          onSubmit: onWalkinSubmit,
          successState: walkinSuccessState,
          runningCount: walkinCount,
          formIcon: TAB_FORMS.walkin.icon,
          formLabel: TAB_FORMS.walkin.label,
          formSubtitle: TAB_FORMS.walkin.subtitle,
          countLabel: TAB_FORMS.walkin.countLabel,
          lookupEnabled: false,
        };
    }
  };

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden transition-all duration-300 select-none">
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

      <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[1200px] border-t-0' : 'max-h-0 pointer-events-none'}`}>
        <div className="flex border-b border-border p-1 bg-bg-elevated/10">
          {(['paid', 'collection', 'walkin'] as QuickEntryTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => !disabled && onTabChange(tab)}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === tab
                  ? 'bg-bg-surface text-green border border-border-light shadow-card font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={disabled}
            >
              {TAB_FORMS[tab].icon}
              <span>{tab === 'paid' ? 'Paid Vendor' : tab === 'collection' ? 'Field Collection' : 'Walk-in'}</span>
            </button>
          ))}
        </div>

        <div className="p-5 bg-bg-surface/30 relative min-h-[250px]">
          {disabled && (
            <div className="absolute inset-0 bg-bg-surface/80 backdrop-blur-[2px] z-50 flex items-center justify-center select-none p-6">
              <div className="bg-bg border border-border rounded-xl p-6 text-center max-w-[280px] shadow-lg animate-fade-in">
                <ChevronDown className="w-8 h-8 text-amber mx-auto mb-3 animate-pulse rotate-180" />
                <h4 className="text-sm font-bold text-text-primary mb-1.5">Quick Entry Locked</h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Select an active event edition from the header/sidebar to start quick entry.
                </p>
              </div>
            </div>
          )}
          <DynamicQuickEntryForm {...getFormProps(activeTab)} />
        </div>
      </div>
    </div>
  );
};
