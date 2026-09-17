'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SpendRateIndicatorProps {
  spendRatePct: number | null;
  totalExpenses: number;
  totalRevenue: number;
}

export const SpendRateIndicator: React.FC<SpendRateIndicatorProps> = ({
  spendRatePct,
  totalExpenses,
  totalRevenue,
}) => {
  // Edge Case: 0 revenue but expenses exist
  if (totalRevenue === 0 && totalExpenses > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-red">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Deficit (Zero Revenue)</span>
          </div>
          <span className="font-bold text-red">&gt; 100% (No Sales)</span>
        </div>
        <div className="w-full bg-red-muted h-2 rounded-full overflow-hidden">
          <div className="bg-red h-full rounded-full w-full animate-pulse" />
        </div>
        <p className="text-[11px] text-text-secondary leading-tight">
          Expenses are active while no vendor sales or other incomes are recorded.
        </p>
      </div>
    );
  }

  // Edge Case: No expenses and no revenue
  if (totalRevenue === 0 && totalExpenses === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-text-secondary">Spend Rate</span>
          <span className="font-semibold text-text-muted">0.0%</span>
        </div>
        <div className="w-full bg-border-light h-2 rounded-full overflow-hidden">
          <div className="bg-text-tertiary h-full rounded-full w-0" />
        </div>
        <p className="text-[11px] text-text-secondary leading-tight">
          No financial entries recorded yet for this edition.
        </p>
      </div>
    );
  }

  const rate = spendRatePct ?? 0;
  let statusColor = 'text-green';
  let barColor = 'bg-green';
  let bgMuted = 'bg-green-muted';
  let statusText = 'Healthy';
  let Icon = CheckCircle2;
  let description = 'Spend is well within revenue limits (< 70%).';

  if (rate >= 100) {
    statusColor = 'text-red';
    barColor = 'bg-red';
    bgMuted = 'bg-red-muted';
    statusText = 'Deficit / Over Budget';
    Icon = AlertCircle;
    description = 'Total expenses exceed total incoming revenue.';
  } else if (rate >= 70) {
    statusColor = 'text-amber';
    barColor = 'bg-amber';
    bgMuted = 'bg-amber-muted';
    statusText = 'Caution (High Spend)';
    Icon = AlertTriangle;
    description = 'Spend is consuming a significant share of revenue (70-99%).';
  } else if (rate <= 40) {
    statusColor = 'text-emerald-600';
    barColor = 'bg-emerald-600';
    bgMuted = 'bg-emerald-50';
    statusText = 'Optimal Profitability';
    Icon = ShieldCheck;
    description = 'Strong cash margin with low operational expenditure.';
  }

  const clampedWidth = Math.min(Math.max(rate, 0), 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className={`flex items-center gap-1.5 font-semibold ${statusColor}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{statusText}</span>
        </div>
        <span className={`font-bold text-sm ${statusColor}`}>{rate.toFixed(1)}%</span>
      </div>
      <div className={`w-full ${bgMuted} h-2 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>
      <p className="text-[11px] text-text-secondary leading-tight">{description}</p>
    </div>
  );
};
