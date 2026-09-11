'use client';

import React, { useState } from 'react';
import { UserManagementSettings } from './UserManagementSettings';
import { StandardFeeSettings } from './StandardFeeSettings';
import { WalkinEstimateSettings } from './WalkinEstimateSettings';
import { TicketTemplateSettings } from './TicketTemplateSettings';
import type { UserRole } from '@/hooks/useAuth';
import { Users, DollarSign, Footprints, Settings as SettingsIcon, Ticket } from 'lucide-react';

interface SettingsViewProps {
  currentUserRole: UserRole | null;
  currentUserId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'standard-fees' | 'ticket-templates' | 'walkin-estimates' | 'users'>('standard-fees');

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-6xl mx-auto">
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-accent rounded-full" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-accent" />
            System Settings
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage global configuration, edition pricing, ticket templates, and user permissions.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('standard-fees')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
            activeTab === 'standard-fees'
              ? 'text-accent border-accent bg-accent-soft/40'
              : 'text-text-muted border-transparent hover:text-text-primary hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Standard Vendor Fees
        </button>

        <button
          onClick={() => setActiveTab('ticket-templates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
            activeTab === 'ticket-templates'
              ? 'text-accent border-accent bg-accent-soft/40'
              : 'text-text-muted border-transparent hover:text-text-primary hover:bg-slate-100'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Ticket Templates
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'text-accent border-accent bg-accent-soft/40'
              : 'text-text-muted border-transparent hover:text-text-primary hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          User Management
        </button>

        <button
          onClick={() => setActiveTab('walkin-estimates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
            activeTab === 'walkin-estimates'
              ? 'text-accent border-accent bg-accent-soft/40'
              : 'text-text-muted border-transparent hover:text-text-primary hover:bg-slate-100'
          }`}
        >
          <Footprints className="w-4 h-4" />
          Walk-in Estimates
        </button>
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'standard-fees' && <StandardFeeSettings />}
        {activeTab === 'ticket-templates' && <TicketTemplateSettings />}
        {activeTab === 'walkin-estimates' && <WalkinEstimateSettings />}
        {activeTab === 'users' && (
          <UserManagementSettings
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
};
