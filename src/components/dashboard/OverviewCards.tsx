import React from 'react';
import { Card } from '../ui/Card';
import { ArrowUpRight, ArrowDownRight, Users, Footprints, RotateCcw, Percent, Database } from 'lucide-react';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export interface AgeDistribution {
  '18-24': number;
  '25-29': number;
  '30-35': number;
  '36+': number;
}

export interface OverviewData {
  totalVendors: {
    value: number;
    change: number;
    changeText: string;
  };
  walkinCustomers: {
    value: number;
    changeText: string;
    isChangePositive?: boolean;
  };
  avgVendorAge: {
    value: number;
    distribution: AgeDistribution;
  };
  avgWalkinAge: {
    value: number;
    distribution: AgeDistribution;
  };
  returnRate: {
    value: number;
  };
  womenOwnedPct: {
    value: number;
    target: number;
  };
  dataCollected: {
    value: number;
    collected: number;
    total: number;
  };
}

export interface OverviewCardsProps {
  data?: OverviewData;
  activeFilter?: string | null;
  onCardClick?: (filterId: string) => void;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  data,
  activeFilter = null,
  onCardClick
}) => {
  if (!data) {
    // Show 7 skeleton cards when data is undefined
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5 mb-6">
        {Array.from({ length: 7 }).map((_, idx) => (
          <div key={idx} className="bg-white border border-border rounded-xl shadow-xs p-4.5 animate-pulse h-[140px] flex flex-col justify-between" />
        ))}
      </div>
    );
  }

  const handleCardClick = (id: string) => {
    if (onCardClick) {
      onCardClick(id);
    }
  };

  // Get data completion color classes
  const getDataCollectedColor = (pct: number) => {
    if (pct > 80) return 'text-emerald-600';
    if (pct >= 50) return 'text-amber';
    return 'text-red';
  };

  const getDataProgressColor = (pct: number) => {
    if (pct > 80) return 'bg-accent';
    if (pct >= 50) return 'bg-amber';
    return 'bg-red';
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-7 gap-3.5 mb-6">
      {/* 1. Total Vendors */}
      <Card
        isActive={activeFilter === 'totalVendors'}
        onClick={() => handleCardClick('totalVendors')}
        className="p-4.5 flex flex-col justify-between animate-card-entrance"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-text-secondary" /> Total Vendors
          </div>
          <div className="text-2xl font-bold tracking-tight text-text-primary">
            <AnimatedNumber value={data.totalVendors.value} />
          </div>
        </div>
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold mt-1.5 ${data.totalVendors.change >= 0 ? 'text-emerald-600' : 'text-red'}`}>
          {data.totalVendors.change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          <span>{data.totalVendors.changeText}</span>
        </div>
      </Card>

      {/* 2. Walk-in Customers */}
      <Card
        isActive={activeFilter === 'walkins'}
        onClick={() => handleCardClick('walkins')}
        className="p-4.5 flex flex-col justify-between animate-card-entrance"
        style={{ animationDelay: '60ms' }}
      >
        <div>
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Footprints className="w-3.5 h-3.5 text-text-secondary" /> Walk-in Guests
          </div>
          <div className="text-2xl font-bold tracking-tight text-text-primary">
            <AnimatedNumber value={data.walkinCustomers.value} />
          </div>
        </div>
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold mt-1.5 ${data.walkinCustomers.isChangePositive ? 'text-emerald-600' : 'text-text-tertiary'}`}>
          <span>{data.walkinCustomers.changeText}</span>
        </div>
      </Card>

      {/* 3. Average Vendor Age */}
      <Card
        isActive={activeFilter === 'avgVendorAge'}
        onClick={() => handleCardClick('avgVendorAge')}
        leftBorderColor="purple"
        className="p-4.5 flex flex-col animate-card-entrance"
        style={{ animationDelay: '120ms' }}
        hoverEffect={true}
      >
        <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
          Avg Vendor Age
        </div>
        <div className="text-2xl font-bold tracking-tight text-text-primary">
          <AnimatedNumber value={data.avgVendorAge.value} />
        </div>
        
        {/* Age breakdown bars */}
        <div className="mt-2.5 flex flex-col gap-1 w-full">
          {Object.entries(data.avgVendorAge.distribution).map(([range, pct]) => (
            <div key={range} className="flex items-center gap-2 text-[9px] font-medium leading-none">
              <span className="w-8 text-text-secondary text-right shrink-0">{range}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-text-primary text-left font-bold shrink-0">{pct}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. Average Walk-in Age */}
      <Card
        isActive={activeFilter === 'avgWalkinAge'}
        onClick={() => handleCardClick('avgWalkinAge')}
        leftBorderColor="purple"
        className="p-4.5 flex flex-col animate-card-entrance"
        style={{ animationDelay: '180ms' }}
        hoverEffect={true}
      >
        <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
          Avg Walk-in Age
        </div>
        <div className="text-2xl font-bold tracking-tight text-text-primary">
          <AnimatedNumber value={data.avgWalkinAge.value} />
        </div>
        
        {/* Age breakdown bars */}
        <div className="mt-2.5 flex flex-col gap-1 w-full">
          {Object.entries(data.avgWalkinAge.distribution).map(([range, pct]) => (
            <div key={range} className="flex items-center gap-2 text-[9px] font-medium leading-none">
              <span className="w-8 text-text-secondary text-right shrink-0">{range}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-text-primary text-left font-bold shrink-0">{pct}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 5. Return Rate */}
      <Card
        isActive={activeFilter === 'returnRate'}
        onClick={() => handleCardClick('returnRate')}
        className="p-4.5 flex flex-col justify-between animate-card-entrance"
        style={{ animationDelay: '240ms' }}
      >
        <div>
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <RotateCcw className="w-3.5 h-3.5 text-text-secondary" /> Return Rate
          </div>
          <div className="text-2xl font-bold tracking-tight text-accent">
            <AnimatedNumber value={data.returnRate.value} suffix="%" />
          </div>
        </div>
        <div className="text-[10px] text-text-tertiary mt-1.5">
          Loyalty index
        </div>
      </Card>

      {/* 6. Women-Owned */}
      <Card
        isActive={activeFilter === 'womenOwned'}
        onClick={() => handleCardClick('womenOwned')}
        className="p-4.5 flex flex-col justify-between animate-card-entrance"
        style={{ animationDelay: '300ms' }}
      >
        <div>
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Percent className="w-3.5 h-3.5 text-text-secondary" /> Women-Owned
          </div>
          <div className="text-2xl font-bold tracking-tight text-text-primary">
            <AnimatedNumber value={data.womenOwnedPct.value} suffix="%" />
          </div>
        </div>
        <div className="text-[10px] text-text-tertiary mt-1.5">
          Target: {data.womenOwnedPct.target}%
        </div>
      </Card>

      {/* 7. Data Collected */}
      <Card
        isActive={activeFilter === 'dataCollected'}
        onClick={() => handleCardClick('dataCollected')}
        className="p-4.5 flex flex-col justify-between animate-card-entrance"
        style={{ animationDelay: '360ms' }}
      >
        <div>
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Database className="w-3.5 h-3.5 text-text-secondary" /> Data Collected
          </div>
          <div className={`text-2xl font-bold tracking-tight ${getDataCollectedColor(data.dataCollected.value)}`}>
            <AnimatedNumber value={data.dataCollected.value} suffix="%" />
          </div>
        </div>
        <div className="w-full mt-2">
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${getDataProgressColor(data.dataCollected.value)}`}
              style={{ width: `${data.dataCollected.value}%` }}
            />
          </div>
          <div className="text-[9px] text-text-tertiary mt-1 font-medium">
            {data.dataCollected.collected} of {data.dataCollected.total} collected
          </div>
        </div>
      </Card>
    </div>
  );
};
