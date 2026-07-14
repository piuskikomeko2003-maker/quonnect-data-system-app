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
    <div className="bg-bg-surface border border-green/20 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Live status with blinking dot */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green"></span>
        </span>
        <span className="text-xs font-bold text-green flex items-center gap-1">
          <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Registration Session
        </span>
      </div>

      {/* Metrics columns */}
      <div className="flex flex-wrap items-center gap-6 md:gap-8 flex-1 justify-center md:justify-end pr-4">
        {/* Paid Vendors Registered */}
        <div className="text-center md:text-left">
          <span className="block text-[9px] text-text-tertiary uppercase tracking-wider font-semibold">Paid Vendors</span>
          <span className="text-base font-bold text-text-primary mt-0.5 block">{paidVendorsCount}</span>
        </div>

        {/* Walk-ins Recorded */}
        <div className="text-center md:text-left">
          <span className="block text-[9px] text-text-tertiary uppercase tracking-wider font-semibold">Walk-ins Recorded</span>
          <span className="text-base font-bold text-text-primary mt-0.5 block">{walkinsCount}</span>
        </div>

        {/* Field Data Collected progress */}
        <div className="flex flex-col min-w-[160px] max-w-[200px] flex-1">
          <div className="flex justify-between text-[9px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
            <span>Field Data Collected</span>
            <span className="text-green font-bold">{dataCollectedCount}/{totalPaidVendorsCount} ({dataCollectionPct}%)</span>
          </div>
          <div className="w-full h-1.5 bg-bg-input border border-border-light rounded-full overflow-hidden">
            <div 
              className="h-full bg-green rounded-full transition-all duration-300" 
              style={{ width: `${dataCollectionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Polling Refresh Action */}
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
  );
};
