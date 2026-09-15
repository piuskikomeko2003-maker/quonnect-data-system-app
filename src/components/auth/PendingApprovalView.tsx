'use client';

import React, { useState } from 'react';
import { Clock, ShieldAlert, RefreshCw, LogOut, CheckCircle2, Shield } from 'lucide-react';

interface PendingApprovalViewProps {
  email?: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  email,
  onRefresh,
  onSignOut,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      await onRefresh();
      setRefreshNotice('Status checked. Still awaiting admin role assignment.');
    } catch {
      setRefreshNotice('Could not reach server. Please try again in a moment.');
    } finally {
      setRefreshing(false);
      setTimeout(() => {
        setRefreshNotice(null);
      }, 5000);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-white border border-border rounded-2xl p-8 shadow-elevated animate-fade-in text-center">
        {/* Header Branding */}
        <div className="mb-6">
          <div className="text-2xl font-black tracking-tight text-text-primary">
            QUON<span className="text-sky-500">NECT</span>
          </div>
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mt-1">
            Data System Access
          </p>
        </div>

        {/* Icon & Status */}
        <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-pulse" />
          <div className="relative w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600">
            <Clock className="w-7 h-7" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold mb-3">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>Pending Admin Approval</span>
        </div>

        <h2 className="text-lg font-bold text-text-primary">
          Account Under Review
        </h2>

        <p className="text-xs text-text-secondary mt-2 leading-relaxed max-w-sm mx-auto">
          Your account has been created successfully. An administrator must assign your role before you can access market data and platform features.
        </p>

        {/* Account Details Box */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-border text-left">
          <div className="flex items-center justify-between text-xs pb-2.5 border-b border-border/70">
            <span className="text-text-muted">Account Email</span>
            <span className="font-semibold text-text-primary truncate max-w-[200px]">
              {email || 'Authenticated User'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2.5">
            <span className="text-text-muted">Access Level</span>
            <span className="font-semibold text-amber-600 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Unassigned
            </span>
          </div>
        </div>

        {refreshNotice && (
          <div className="mt-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2 text-left animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-600" />
            <span>{refreshNotice}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full py-2.5 px-4 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Checking Approval Status...' : 'Check Status'}</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-2.5 px-4 rounded-lg border border-border bg-white text-text-secondary font-semibold text-sm hover:text-text-primary hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        <p className="text-[10px] text-text-muted mt-6">
          If you were invited for a specific role, please notify your team administrator to complete your activation.
        </p>
      </div>
    </div>
  );
};
