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
    <div className="w-full bg-bg-surface border border-border rounded-lg overflow-hidden select-none text-left">
      {/* Search Header Panel */}
      <div className="p-4 border-b border-border flex items-center gap-4 bg-bg-elevated/10">
        <div className="relative w-full max-w-sm flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            placeholder="Search vendors by name, phone, business..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-bg-input border border-border-light rounded-md pl-10 pr-3.5 py-2 text-text-primary text-xs font-sans placeholder-text-muted outline-none transition-colors focus:border-green"
          />
        </div>
        {selectedVendorIds.length > 0 && (
          <span className="text-[11px] text-text-secondary font-semibold">
            {selectedVendorIds.length} vendor(s) selected
          </span>
        )}
      </div>

      {/* Main Table Container */}
      <div className="w-full overflow-x-auto">
        {vendors.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12 px-6 flex flex-col items-center justify-center gap-3">
            <Info className="w-12 h-12 text-green mb-1.5" />
            <p className="text-sm font-bold text-text-primary">No vendors found</p>
            <p className="text-xs text-text-secondary max-w-[280px]">
              Try adjusting your search criteria or register a new vendor.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg-elevated border-b border-border">
                {/* Checkbox selector th */}
                <th className="p-3.5 w-[50px] text-center border-r border-border/40">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-border-light text-green focus:ring-green bg-bg-input cursor-pointer"
                  />
                </th>
                <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Name & Phone</th>
                <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Business</th>
                <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-center">Gender</th>
                <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-center">Status</th>
                <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Region</th>
                <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider text-center">Attendances</th>
                <th className="p-3.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {vendors.map((vendor) => {
                const isSelected = selectedVendorIds.includes(vendor.id);
                return (
                  <tr
                    key={vendor.id}
                    onClick={() => onRowClick(vendor)}
                    className={`hover:bg-green-soft cursor-pointer transition-colors ${
                      isSelected ? 'bg-green-soft/50' : ''
                    }`}
                  >
                    {/* Checkbox select cell */}
                    <td
                      onClick={(e) => e.stopPropagation()} // Stop row click trigger
                      className="p-3.5 text-center border-r border-border/40"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelectVendor(vendor.id, e.target.checked)}
                        className="w-4 h-4 rounded border-border-light text-green focus:ring-green bg-bg-input cursor-pointer"
                      />
                    </td>
                    
                    {/* Name & Phone */}
                    <td className="p-3.5">
                      <span className="block font-bold text-text-primary">{vendor.name}</span>
                      <span className="block text-[10px] text-text-secondary mt-0.5">{vendor.phone}</span>
                    </td>
                    
                    {/* Business Name */}
                    <td className="p-3.5 font-semibold text-text-secondary truncate max-w-[150px]">
                      {vendor.businessName}
                    </td>
                    
                    {/* Gender badge */}
                    <td className="p-3.5 text-center font-semibold text-text-secondary">
                      {vendor.gender}
                    </td>
                    
                    {/* Status Badge */}
                    <td className="p-3.5 text-center">
                      <VendorStatusBadge status={vendor.status} />
                    </td>
                    
                    {/* Region */}
                    <td className="p-3.5 font-semibold text-text-secondary">
                      {vendor.region}
                    </td>
                    
                    {/* Attendances Count */}
                    <td className="p-3.5 text-center">
                      <Badge variant="info" size="sm" className="font-bold">
                        {vendor.attendanceCount}
                      </Badge>
                    </td>
                    
                    {/* Last Seen */}
                    <td className="p-3.5 text-text-secondary font-medium">
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
