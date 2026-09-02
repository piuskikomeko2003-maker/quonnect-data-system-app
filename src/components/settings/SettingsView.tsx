'use client';

import React, { useState } from 'react';
import { UserManagementSettings } from './UserManagementSettings';
import { StandardFeeSettings } from './StandardFeeSettings';
import type { UserRole } from '@/hooks/useAuth';
import { Users, DollarSign, Settings as SettingsIcon } from 'lucide-react';

interface SettingsViewProps {
  currentUserRole: UserRole | null;
  currentUserId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'standard-fees' | 'users'>('standard-fees');

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-6xl mx-auto">
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            System Settings
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage global configuration, edition pricing, and user permissions.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-px">
        <button
          onClick={() => setActiveTab('standard-fees')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px ${
            activeTab === 'standard-fees'
              ? 'text-emerald-400 border-emerald-500 bg-emerald-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.02]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Standard Vendor Fees
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px ${
            activeTab === 'users'
              ? 'text-emerald-400 border-emerald-500 bg-emerald-500/10'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.02]'
          }`}
        >
          <Users className="w-4 h-4" />
          User Management
        </button>
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'standard-fees' && <StandardFeeSettings />}
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
