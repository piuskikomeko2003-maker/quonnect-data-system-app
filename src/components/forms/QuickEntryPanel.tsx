import React from 'react';
import { DynamicQuickEntryForm, DynamicQuickEntryFormProps } from './DynamicQuickEntryForm';
import {
  ChevronUp,
  ChevronDown,
  Zap,
  Users,
  Footprints,
  Database,
  Link,
  Check,
  CalendarDays,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { dayDateLabel, dayLabel } from '@/lib/editionDays';

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

  const selectedDays = editionDays.filter((day) => selectedLinkDayIds.includes(day.id));
  const selectedSummary = selectedDays.map(dayLabel).join(' + ');

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
          <div className="border-b border-border bg-white px-4 py-4 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Days this vendor paid for
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                Tap the day cards to include them. Stored on the link and read by the server — the vendor cannot change it.
              </p>
            </div>

            {/* Large, unmistakable day cards: one tap = one paid day on the link. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {editionDays.map((day) => {
                const selected = selectedLinkDayIds.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => onToggleLinkDay?.(day.id)}
                    aria-pressed={selected}
                    className={`group relative flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-accent bg-accent-soft shadow-sm ring-2 ring-accent/15'
                        : 'border-border bg-white hover:border-accent/50 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                        selected
                          ? 'border-accent bg-accent text-white'
                          : 'border-border bg-white text-transparent group-hover:border-accent/50'
                      }`}
                      aria-hidden="true"
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold leading-tight text-text-primary">
                        {dayLabel(day)}
                      </span>
                      <span className="mt-1 block text-[11px] font-medium text-text-secondary">
                        {dayDateLabel(day) || 'Date not set'}
                      </span>
                      <span
                        className={`mt-2 inline-block text-[10px] font-bold uppercase tracking-wider ${
                          selected ? 'text-accent' : 'text-text-tertiary'
                        }`}
                      >
                        {selected ? 'Included on this link' : 'Tap to include'}
                      </span>
                    </span>

                    <CalendarDays
                      className={`h-4 w-4 shrink-0 ${selected ? 'text-accent' : 'text-text-tertiary'}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>

            {/* Plain-language confirmation of exactly what this link will issue. */}
            <div
              className={`rounded-lg border px-3 py-2.5 text-[11px] font-semibold ${
                selectedDays.length === 0
                  ? 'border-amber/30 bg-amber/10 text-amber'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
              aria-live="polite"
            >
              {selectedDays.length === 0
                ? 'No days selected — choose at least one day before generating a link.'
                : selectedDays.length === 1
                ? `This link is for ${selectedSummary} only — 1 ticket will be issued.`
                : `This link covers ${selectedSummary} — ${selectedDays.length} tickets will be issued.`}
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
