'use client';

import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet, Scale } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { SpendRateIndicator } from './SpendRateIndicator';

interface FinanceSummaryCardsProps {
  totalRevenue: number;
  vendorRevenue: number;
  otherIncome: number;
  totalExpenses: number;
  expenseCount: number;
  netBalance: number;
  spendRatePct: number | null;
}

export const FinanceSummaryCards: React.FC<FinanceSummaryCardsProps> = ({
  totalRevenue,
  vendorRevenue,
  otherIncome,
  totalExpenses,
  expenseCount,
  netBalance,
  spendRatePct,
}) => {
  const isNetPositive = netBalance >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Revenue Card */}
      <div
        className="group relative overflow-hidden bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-elevated hover:border-blue/40 animate-card-entrance cursor-default"
        style={{ animationDelay: '0ms' }}
      >
        {/* Top hover accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors">
            Total Revenue
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-muted text-blue flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-blue group-hover:text-white shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1 text-2xl font-bold tracking-tight text-text-primary group-hover:text-blue transition-colors">
            <span className="text-xs font-semibold text-text-secondary">UGX</span>
            <AnimatedNumber value={totalRevenue} />
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
            <span>Vendor: <strong className="text-text-primary">UGX {vendorRevenue.toLocaleString()}</strong></span>
            <span>Other: <strong className="text-text-primary">UGX {otherIncome.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Total Expenses Card */}
      <div
        className="group relative overflow-hidden bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-elevated hover:border-red/40 animate-card-entrance cursor-default"
        style={{ animationDelay: '80ms' }}
      >
        {/* Top hover accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors">
            Total Expenses
          </span>
          <div className="w-8 h-8 rounded-lg bg-red-muted text-red flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-red group-hover:text-white shadow-xs">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1 text-2xl font-bold tracking-tight text-text-primary group-hover:text-red transition-colors">
            <span className="text-xs font-semibold text-text-secondary">UGX</span>
            <AnimatedNumber value={totalExpenses} />
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
            <span>Expense Entries</span>
            <span className="font-semibold text-text-primary">{expenseCount} recorded</span>
          </div>
        </div>
      </div>

      {/* 3. Net Balance Card */}
      <div
        className={`group relative overflow-hidden rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-elevated animate-card-entrance cursor-default ${
          isNetPositive
            ? 'bg-white border border-green/30 hover:border-green'
            : 'bg-red-50/20 border border-red/40 hover:border-red'
        }`}
        style={{ animationDelay: '160ms' }}
      >
        {/* Top hover accent line */}
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
            isNetPositive ? 'via-green' : 'via-red'
          } to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        />

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors">
            Net Balance (Profit / Loss)
          </span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 shadow-xs ${
              isNetPositive
                ? 'bg-green-muted text-green group-hover:bg-green group-hover:text-white'
                : 'bg-red-muted text-red group-hover:bg-red group-hover:text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div
            className={`flex items-baseline gap-1 text-2xl font-extrabold tracking-tight transition-transform duration-200 group-hover:scale-[1.02] origin-left ${
              isNetPositive ? 'text-green' : 'text-red'
            }`}
          >
            <span className="text-xs font-semibold">UGX</span>
            {isNetPositive ? (
              <AnimatedNumber value={netBalance} />
            ) : (
              <span>- <AnimatedNumber value={Math.abs(netBalance)} /></span>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-text-secondary">Operating Margin</span>
            <span
              className={`font-semibold flex items-center gap-0.5 transition-transform duration-200 group-hover:translate-x-0.5 ${
                isNetPositive ? 'text-green' : 'text-red'
              }`}
            >
              {isNetPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {totalRevenue > 0
                ? `${((netBalance / totalRevenue) * 100).toFixed(1)}%`
                : isNetPositive
                ? '0.0%'
                : '-100%'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Spend Rate Card */}
      <div
        className="group relative overflow-hidden bg-white border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-elevated hover:border-amber/40 animate-card-entrance cursor-default"
        style={{ animationDelay: '240ms' }}
      >
        {/* Top hover accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors">
            Spend Rate Meter
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-muted text-amber flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-amber group-hover:text-white shadow-xs">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="pt-2">
          <SpendRateIndicator
            spendRatePct={spendRatePct}
            totalExpenses={totalExpenses}
            totalRevenue={totalRevenue}
          />
        </div>
      </div>
    </div>
  );
};
