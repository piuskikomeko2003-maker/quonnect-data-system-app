import React from 'react';
import { DynamicQuickEntryForm, DynamicQuickEntryFormProps } from './DynamicQuickEntryForm';
import { ChevronUp, ChevronDown, Zap, Users, Footprints, Database, Link } from 'lucide-react';
import { Button } from '../ui/Button';

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
  onGenerateLink: () => void;
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
  onGenerateLink,
  paidCount,
  collectionCount,
  walkinCount,
  paidSuccessState,
  collectionSuccessState,
  walkinSuccessState,
}) => {
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
    <div className="bg-[#0f1117] border border-white/5 rounded-xl overflow-hidden transition-all duration-300 select-none">
      <div 
        onClick={onToggleCollapse}
        className="p-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.04]"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-green-400 animate-pulse" />
          <h3 className="text-xs font-semibold tracking-widest text-gray-300 uppercase">Quick Entry Panel</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onGenerateLink();
            }}
            disabled={disabled}
            className="text-[10px] bg-white/5 border border-white/10 text-white hover:bg-white/10"
          >
            <Link className="w-3.5 h-3.5" />
            <span>Generate Link</span>
          </Button>
          <button className="text-gray-400 hover:text-white cursor-pointer p-1">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[1200px] border-t-0' : 'max-h-0 pointer-events-none'}`}>
        <div className="flex border-b border-white/5 p-1.5 bg-white/[0.02] gap-1">
          {(['paid', 'collection', 'walkin'] as QuickEntryTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => !disabled && onTabChange(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === tab
                  ? 'bg-white/10 text-green-400 border border-white/10 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={disabled}
            >
              {TAB_FORMS[tab].icon}
              <span>{tab === 'paid' ? 'Paid Vendor' : tab === 'collection' ? 'Field Collection' : 'Walk-in'}</span>
            </button>
          ))}
        </div>

        <div className="p-5 bg-transparent relative min-h-[250px] max-h-[70vh] overflow-y-auto">
          {disabled && (
            <div className="absolute inset-0 bg-[#0f1117]/85 backdrop-blur-[2px] z-50 flex items-center justify-center select-none p-6">
              <div className="bg-[#161922] border border-white/10 rounded-xl p-6 text-center max-w-[280px] shadow-2xl animate-fade-in">
                <ChevronDown className="w-8 h-8 text-amber-400 mx-auto mb-3 animate-pulse rotate-180" />
                <h4 className="text-sm font-bold text-white mb-1.5">Quick Entry Locked</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
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
