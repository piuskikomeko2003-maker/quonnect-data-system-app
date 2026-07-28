import React from 'react';
import { Search, Info, Plus } from 'lucide-react';
import { VendorStatusBadge, VendorStatus } from './VendorStatusBadge';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  businessName: string;
  gender: string;
  status: VendorStatus;
  region: string;
  attendanceCount: number;
  lastSeen: string;
  registrationType?: 'survey' | 'paid' | 'both' | 'unknown';
}

export interface VendorTableProps {
  vendors?: Vendor[];
  selectedVendorIds: string[];
  onSelectVendor: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onRowClick: (vendor: Vendor) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export const VendorTable: React.FC<VendorTableProps> = ({
  vendors,
  selectedVendorIds,
  onSelectVendor,
  onSelectAll,
  onRowClick,
  searchTerm,
  onSearchChange
}) => {
  // Skeleton loader when data is undefined
  if (vendors === undefined) {
    return (
      <div className="w-full bg-bg-surface border border-border rounded-lg overflow-hidden select-none">
        {/* Search header skeleton */}
        <div className="p-4 border-b border-border flex items-center gap-4.5 bg-bg-elevated/20">
          <div className="w-72 h-8 bg-bg-input border border-border-light rounded-md animate-pulse" />
        </div>
        {/* Table skeleton */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg-elevated border-b border-border">
                <th className="p-3.5 w-[50px]"><div className="w-4 h-4 bg-bg-input rounded animate-pulse m-auto" /></th>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} className="p-3.5"><div className="h-4 bg-bg-input rounded animate-pulse w-20" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="p-3.5"><div className="w-4 h-4 bg-bg-input rounded animate-pulse m-auto" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-bg-input rounded animate-pulse w-32" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-bg-input rounded animate-pulse w-28" /></td>
                  <td className="p-3.5"><div className="h-4 bg-bg-input rounded animate-pulse w-14" /></td>
                  <td className="p-3.5"><div className="h-4 bg-bg-input rounded-full animate-pulse w-16" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-bg-input rounded animate-pulse w-18" /></td>
                  <td className="p-3.5"><div className="h-4 bg-bg-input rounded animate-pulse w-10" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-bg-input rounded animate-pulse w-24" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Check if all displayed vendors are selected
  const isAllSelected = vendors.length > 0 && vendors.every((v) => selectedVendorIds.includes(v.id));

  return (
    <div className="w-full bg-[#0f1117] border border-white/5 rounded-xl overflow-hidden select-none text-left">
      {/* Search Header Panel */}
      <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-white/[0.02]">
        <div className="relative w-full max-w-sm flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search vendors by name, phone, business..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3.5 py-2 text-white text-xs font-sans placeholder-gray-500 outline-none transition-colors focus:border-green-500"
          />
        </div>
        {selectedVendorIds.length > 0 && (
          <span className="text-[11px] text-green-400 font-semibold">
            {selectedVendorIds.length} vendor(s) selected
          </span>
        )}
      </div>

      {/* Main Table Container */}
      <div className="w-full overflow-x-auto">
        {vendors.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12 px-6 flex flex-col items-center justify-center gap-3">
            <Info className="w-10 h-10 text-green-400 mb-1.5" />
            <p className="text-sm font-bold text-white">No vendors found</p>
            <p className="text-xs text-gray-400 max-w-[280px]">
              Try adjusting your search criteria or register a new vendor.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                {/* Checkbox selector th */}
                <th className="p-3.5 w-[50px] text-center border-r border-white/5">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 text-green-500 focus:ring-green-500 bg-white/5 cursor-pointer"
                  />
                </th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Name & Phone</th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Business</th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-center">Gender</th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-center">Status</th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-center">Type</th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Region</th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-center">Attendances</th>
                <th className="p-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {vendors.map((vendor) => {
                const isSelected = selectedVendorIds.includes(vendor.id);
                return (
                  <tr
                    key={vendor.id}
                    onClick={() => onRowClick(vendor)}
                    className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${
                      isSelected ? 'bg-green-500/10' : ''
                    }`}
                  >
                    {/* Checkbox select cell */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="p-3.5 text-center border-r border-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelectVendor(vendor.id, e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 text-green-500 focus:ring-green-500 bg-white/5 cursor-pointer"
                      />
                    </td>
                    
                    {/* Name & Phone */}
                    <td className="p-3.5">
                      <span className="block font-semibold text-white">{vendor.name}</span>
                      <span className="block text-[10px] text-gray-400 font-mono mt-0.5">{vendor.phone}</span>
                    </td>
                    
                    {/* Business Name */}
                    <td className="p-3.5 font-medium text-gray-300 truncate max-w-[150px]">
                      {vendor.businessName}
                    </td>
                    
                    {/* Gender badge */}
                    <td className="p-3.5 text-center font-medium text-gray-300">
                      {vendor.gender}
                    </td>
                    
                    {/* Status Badge */}
                    <td className="p-3.5 text-center">
                      <VendorStatusBadge status={vendor.status} />
                    </td>
                    
                    {/* Registration Type Badge */}
                    <td className="p-3.5 text-center">
                      {(() => {
                        const badges: Record<string, { label: string; color: string }> = {
                          survey: { label: 'Field Data', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
                          paid: { label: 'Registered', color: 'bg-green-500/10 text-green-400 border border-green-500/20' },
                          both: { label: 'Registered + Surveyed', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
                          unknown: { label: 'Unverified', color: 'bg-gray-500/10 text-gray-400 border border-white/10' }
                        };
                        const badge = badges[vendor.registrationType || 'unknown'];
                        return (
                          <span className={`${badge.color} text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider whitespace-nowrap`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    
                    {/* Region */}
                    <td className="p-3.5 font-medium text-gray-300">
                      {vendor.region}
                    </td>
                    
                    {/* Attendances Count */}
                    <td className="p-3.5 text-center">
                      <span className="inline-block bg-white/5 border border-white/10 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-md">
                        {vendor.attendanceCount}
                      </span>
                    </td>
                    
                    {/* Last Seen */}
                    <td className="p-3.5 text-gray-400 font-medium">
                      {vendor.lastSeen}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
