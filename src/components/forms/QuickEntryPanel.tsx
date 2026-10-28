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
    icon: <Users className="w-4 h-4 text-accent" />,
    lookupEnabled: true,
  },
  collection: {
    slug: 'vendor_data_collection',
    label: 'Field Data Collection',
    subtitle: 'Impact & Demographics Sheet',
    countLabel: 'profiles collected',
    icon: <Database className="w-4 h-4 text-accent" />,
    lookupEnabled: true,
  },
  walkin: {
    slug: 'walkin_registration',
    label: 'Walk-in Guest Registry',
    subtitle: 'Optimized for speed entry',
    countLabel: 'walk-ins entered',
    icon: <Footprints className="w-4 h-4 text-accent" />,
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
  editionDays?: Array<{ id: string; day_number: number; event_date: string; label: string | null }>;
  selectedLinkDayIds?: string[];
  onToggleLinkDay?: (dayId: string) => void;
  linkBatchCount?: number;
  onLinkBatchCountChange?: (count: number) => void;
  paidCount: number;
  collectionCount: number;
  walkinCount: number;
  paidSuccessState: {
    show: boolean;
    name?: string;
    ticketData?: {
      ticketId?: string;
      dayId?: string;
      dayNumber?: number;
      dayLabel?: string;
      dayDate?: string;
      ticketNumber: number;
      ticketCode: string;
      editionName: string;
      vendorName: string;
      businessName?: string;
      phone: string;
      category?: string;
      amountPaid?: number;
      paymentStatus?: string;
      registeredAt: string;
      tickets?: any[];
    };
    onAddAnother: () => void;
  };
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
  editionDays = [],
  selectedLinkDayIds = [],
  onToggleLinkDay,
  linkBatchCount = 1,
  onLinkBatchCountChange,
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
          onSubmit: async (answers) => {
            await onPaidSubmit(answers);
            return { synced: true };
          },
          onPhoneLookup: async (phone) => {
            const result = await onPhoneLookup(phone, 'paid_vendor_registration');
            return result ? { data: result, autofilledFields: Object.keys(result) } : null;
          },
          successState: paidSuccessState,
          runningCount: paidCount,
          formIcon: TAB_FORMS.paid.icon,
          formLabel: TAB_FORMS.paid.label,
          formSubtitle: TAB_FORMS.paid.subtitle,
          countLabel: TAB_FORMS.paid.countLabel,
          lookupEnabled: true,
          allowAddAnother: true,
        };
      case 'collection':
        return {
          formSlug: 'vendor_data_collection',
          activeEdition,
          onSubmit: async (answers) => {
            await onCollectionSubmit(answers);
            return { synced: true };
          },
          onPhoneLookup: async (phone) => {
            const result = await onPhoneLookup(phone, 'vendor_data_collection');
            return result ? { data: result, autofilledFields: Object.keys(result) } : null;
          },
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
          onSubmit: async (answers) => {
            await onWalkinSubmit(answers);
            return { synced: true };
          },
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
    <div className="bg-white border border-border rounded-xl overflow-hidden transition-all duration-300 select-none shadow-sm">
      <div 
        onClick={onToggleCollapse}
        className="p-4 bg-slate-50 border-b border-border flex items-center justify-between cursor-pointer hover:bg-slate-100"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-500 animate-pulse" />
          <h3 className="text-xs font-semibold tracking-widest text-text-primary uppercase">Quick Entry Panel</h3>
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
            className="text-[10px] bg-white border border-border text-text-primary hover:bg-slate-50"
          >
            <Link className="w-3.5 h-3.5" />
            <span>Generate Link</span>
          </Button>
          <button className="text-text-tertiary hover:text-text-primary cursor-pointer p-1">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-300 overflow-hidden ${isOpen ? 'grid-rows-[1fr] border-t-0' : 'grid-rows-[0fr] pointer-events-none'}`}>
        <div className="min-h-0">
        <div className="flex border-b border-border p-1.5 bg-slate-50 gap-1">
          {(['paid', 'collection', 'walkin'] as QuickEntryTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => !disabled && onTabChange(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === tab
                  ? 'bg-white text-accent border border-border font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={disabled}
            >
              {TAB_FORMS[tab].icon}
              <span>{tab === 'paid' ? 'Paid Vendor' : tab === 'collection' ? 'Field Collection' : 'Walk-in'}</span>
            </button>
          ))}
        </div>

        {activeTab === 'paid' && editionDays.length > 1 && (
          <div className="border-b border-border bg-white px-4 py-3 space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Days this vendor paid for
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                Stored on the link and read by the server. The vendor cannot change it.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {editionDays.map((day) => {
                const selected = selectedLinkDayIds.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => onToggleLinkDay?.(day.id)}
                    className={`rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
                      selected
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border bg-white text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    {day.label?.trim() || `Day ${day.day_number}`}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold text-text-secondary">Links to generate</label>
              <input
                type="number"
                min={1}
                max={50}
                value={linkBatchCount}
                onChange={(e) => onLinkBatchCountChange?.(Number(e.target.value) || 1)}
                className="w-16 rounded-md border border-border bg-white px-2 py-1 text-[11px] font-mono outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        <div className="p-5 bg-transparent relative min-h-[250px] max-h-[70vh] overflow-y-auto">
          {disabled && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center select-none p-6">
              <div className="bg-white border border-border rounded-xl p-6 text-center max-w-[280px] shadow-modal animate-fade-in">
                <ChevronDown className="w-8 h-8 text-amber-500 mx-auto mb-3 animate-pulse rotate-180" />
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
    </div>
  );
};
