import React from 'react';
import { RefreshCw, Radio } from 'lucide-react';
import { Button } from '../ui/Button';

export interface LiveCounterProps {
  isActiveEdition: boolean;
  paidVendorsCount: number;
  dataCollectedCount: number;
  totalPaidVendorsCount: number;
  walkinsCount: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const LiveCounter: React.FC<LiveCounterProps> = ({
  isActiveEdition,
  paidVendorsCount,
  dataCollectedCount,
  totalPaidVendorsCount,
  walkinsCount,
  onRefresh,
  isRefreshing = false
}) => {
  if (!isActiveEdition) return null;

  const dataCollectionPct = totalPaidVendorsCount > 0 
    ? Math.round((dataCollectedCount / totalPaidVendorsCount) * 100) 
    : 0;

  return (
    <div className="bg-bg-surface border border-green/20 rounded-lg p-3.5 sm:p-4 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 sm:gap-4 select-none">
      {/* Top row on mobile / Left group on desktop */}
      <div className="flex items-center justify-between sm:justify-start gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green"></span>
          </span>
          <span className="text-xs font-bold text-green flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
            <span className="truncate">Live Registration Session</span>
          </span>
        </div>

        {/* Refresh button on mobile inside top row */}
        <div className="sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="shrink-0 text-text-secondary hover:text-green px-2 py-1 h-7 text-[11px]"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Metrics columns */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 sm:gap-6 md:gap-8 flex-1 sm:justify-end sm:pr-2">
        {/* Paid Vendors Registered */}
        <div className="text-left bg-bg-elevated/40 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none">
          <span className="block text-[9px] text-text-tertiary uppercase tracking-wider font-semibold">Paid Vendors</span>
          <span className="text-base font-bold text-text-primary mt-0.5 block">{paidVendorsCount}</span>
        </div>

        {/* Walk-ins Recorded */}
        <div className="text-left bg-bg-elevated/40 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none">
          <span className="block text-[9px] text-text-tertiary uppercase tracking-wider font-semibold">Walk-ins Recorded</span>
          <span className="text-base font-bold text-text-primary mt-0.5 block">{walkinsCount}</span>
        </div>

        {/* Field Data Collected progress */}
        <div className="col-span-2 sm:col-span-1 flex flex-col w-full sm:w-auto min-w-0 sm:min-w-[140px] sm:max-w-[200px] sm:flex-1 bg-bg-elevated/40 sm:bg-transparent p-2.5 sm:p-0 rounded-lg sm:rounded-none">
          <div className="flex justify-between items-center text-[9px] font-semibold text-text-tertiary uppercase tracking-wider mb-1 gap-1">
            <span className="truncate">Field Data</span>
            <span className="text-green font-bold shrink-0">{dataCollectedCount}/{totalPaidVendorsCount} ({dataCollectionPct}%)</span>
          </div>
          <div className="w-full h-1.5 bg-bg-input border border-border-light rounded-full overflow-hidden">
            <div 
              className="h-full bg-green rounded-full transition-all duration-300" 
              style={{ width: `${dataCollectionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Refresh Action on Desktop */}
      <div className="hidden sm:block shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="shrink-0 text-text-secondary hover:text-green"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>
    </div>
  );
};
