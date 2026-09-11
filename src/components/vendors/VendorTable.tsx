import React from 'react';
import { Search, Info, Plus, Trash2 } from 'lucide-react';
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
  onDelete?: (vendor: Vendor) => void;
}

export const VendorTable: React.FC<VendorTableProps> = ({
  vendors,
  selectedVendorIds,
  onSelectVendor,
  onSelectAll,
  onRowClick,
  searchTerm,
  onSearchChange,
  onDelete
}) => {
  // Skeleton loader when data is undefined
  if (vendors === undefined) {
    return (
      <div className="w-full bg-white border border-border rounded-xl overflow-hidden select-none shadow-xs">
        {/* Search header skeleton */}
        <div className="p-4 border-b border-border flex items-center gap-4.5 bg-slate-50/50">
          <div className="w-72 h-8 bg-slate-100 border border-border-light rounded-md animate-pulse" />
        </div>
        {/* Table skeleton */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                <th className="p-3.5 w-[50px]"><div className="w-4 h-4 bg-slate-200 rounded animate-pulse m-auto" /></th>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={i} className="p-3.5"><div className="h-4 bg-slate-200 rounded animate-pulse w-20" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="p-3.5"><div className="w-4 h-4 bg-slate-100 rounded animate-pulse m-auto" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-slate-100 rounded animate-pulse w-32" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-slate-100 rounded animate-pulse w-28" /></td>
                  <td className="p-3.5"><div className="h-4 bg-slate-100 rounded animate-pulse w-14" /></td>
                  <td className="p-3.5"><div className="h-4 bg-slate-100 rounded-full animate-pulse w-16" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-slate-100 rounded animate-pulse w-18" /></td>
                  <td className="p-3.5"><div className="h-4 bg-slate-100 rounded animate-pulse w-10" /></td>
                  <td className="p-3.5"><div className="h-4.5 bg-slate-100 rounded animate-pulse w-24" /></td>
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
    <div className="w-full bg-white border border-border rounded-xl overflow-hidden select-none text-left shadow-xs">
      {/* Search Header Panel */}
      <div className="p-3.5 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="relative w-full max-w-sm flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            placeholder="Search vendors by name, phone, business..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white border border-border rounded-lg pl-10 pr-3.5 py-2 text-text-primary text-xs font-sans placeholder-text-tertiary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        {selectedVendorIds.length > 0 && (
          <span className="text-[11px] text-accent font-semibold shrink-0">
            {selectedVendorIds.length} vendor(s) selected
          </span>
        )}
      </div>

      {/* Main Table Container with safe horizontal scrolling */}
      <div className="w-full overflow-x-auto">
        {vendors.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12 px-6 flex flex-col items-center justify-center gap-3">
            <Info className="w-10 h-10 text-accent mb-1.5" />
            <p className="text-sm font-bold text-text-primary">No vendors found</p>
            <p className="text-xs text-text-secondary max-w-[280px]">
              Try adjusting your search criteria or register a new vendor.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-border">
                {/* Checkbox selector th */}
                <th className="p-3.5 w-[50px] text-center border-r border-border">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-white cursor-pointer"
                  />
                </th>
                <th className="p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest">Name & Phone</th>
                <th className="hidden sm:table-cell p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest">Business</th>
                <th className="hidden sm:table-cell p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest text-center">Gender</th>
                <th className="p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest text-center">Status</th>
                <th className="p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest text-center">Type</th>
                <th className="hidden sm:table-cell p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest">Region</th>
                <th className="hidden sm:table-cell p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest text-center">Attendances</th>
                <th className="hidden sm:table-cell p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest">Last Seen</th>
                {onDelete && <th className="p-3.5 text-[10px] font-semibold text-text-secondary uppercase tracking-widest text-center w-[60px]">Del</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {vendors.map((vendor) => {
                const isSelected = selectedVendorIds.includes(vendor.id);
                return (
                  <tr
                    key={vendor.id}
                    onClick={() => onRowClick(vendor)}
                    className={`hover:bg-slate-50/70 cursor-pointer transition-colors ${
                      isSelected ? 'bg-accent-soft/40' : ''
                    }`}
                  >
                    {/* Checkbox select cell */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="p-3.5 text-center border-r border-border"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelectVendor(vendor.id, e.target.checked)}
                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-white cursor-pointer"
                      />
                    </td>
                    
                    {/* Name & Phone */}
                    <td className="p-3.5">
                      <span className="block font-semibold text-text-primary">{vendor.name}</span>
                      <span className="block text-[10px] text-text-tertiary font-mono mt-0.5">{vendor.phone}</span>
                    </td>
                    
                    {/* Business Name */}
                    <td className="hidden sm:table-cell p-3.5 font-medium text-text-secondary truncate max-w-[150px]">
                      {vendor.businessName}
                    </td>
                    
                    {/* Gender badge */}
                    <td className="hidden sm:table-cell p-3.5 text-center font-medium text-text-secondary">
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
                          survey: { label: 'Field Data', color: 'bg-accent-soft text-accent border border-accent/20' },
                          paid: { label: 'Registered', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
                          both: { label: 'Registered + Surveyed', color: 'bg-purple-50 text-purple-700 border border-purple-200' },
                          unknown: { label: 'Unverified', color: 'bg-slate-100 text-slate-700 border border-slate-200' }
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
                    <td className="hidden sm:table-cell p-3.5 font-medium text-text-secondary">
                      {vendor.region}
                    </td>
                    
                    {/* Attendances Count */}
                    <td className="hidden sm:table-cell p-3.5 text-center">
                      <span className="inline-block bg-slate-100 border border-border text-text-primary text-[11px] font-mono font-bold px-2 py-0.5 rounded-md">
                        {vendor.attendanceCount}
                      </span>
                    </td>
                    
                    {/* Last Seen */}
                    <td className="hidden sm:table-cell p-3.5 text-text-tertiary font-medium">
                      {vendor.lastSeen}
                    </td>
                    {/* Delete action */}
                    {onDelete && (
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="p-3.5 text-center"
                      >
                        <button
                          onClick={() => onDelete(vendor)}
                          title="Delete vendor"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-text-tertiary hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
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
