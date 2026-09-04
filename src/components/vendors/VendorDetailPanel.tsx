import React from 'react';
import { X, Check, Edit2, Merge, Download, AlertTriangle, Phone } from 'lucide-react';
import { VendorStatusBadge, VendorStatus } from './VendorStatusBadge';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface AttendanceHistory {
  editionId: string;
  editionName: string;
  paid: boolean;
  dataCollected: boolean;
  sequenceNumber?: number;
}

export interface AttributeSource {
  key: string;
  label: string;
  value: string;
  source: 'self-reported' | 'verified' | 'auto-filled';
}

export interface EditionAttributes {
  editionId: string;
  editionName: string;
  attributes: AttributeSource[];
}

export interface VendorDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  vendor?: {
    id: string;
    name: string;
    phone: string;
    status: VendorStatus;
    avatarInitials: string;
    attendanceHistory: AttendanceHistory[];
    editionAttributes: EditionAttributes[];
    dataGaps?: string[];
  };
  onEdit?: (vendorId: string) => void;
  onFlagMerge?: (vendorId: string) => void;
  onExport?: (vendorId: string) => void;
}

export const VendorDetailPanel: React.FC<VendorDetailPanelProps> = ({
  isOpen,
  onClose,
  vendor,
  onEdit,
  onFlagMerge,
  onExport
}) => {
  if (!isOpen || !vendor) return null;

  const getSourceBadgeColor = (source: AttributeSource['source']) => {
    switch (source) {
      case 'verified':
        return 'success';
      case 'auto-filled':
        return 'info';
      case 'self-reported':
      default:
        return 'neutral';
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end select-none">
      {/* Drawer Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      />
      
      {/* Slide-out Panel container */}
      <div className="relative w-full max-w-[480px] h-full bg-bg-surface border-l border-border shadow-modal z-10 flex flex-col animate-slide-in-right overflow-hidden">
        {/* Panel Header */}
        <div 
          className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-bg-elevated"
          style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-muted text-green font-bold text-base sm:text-lg flex items-center justify-center shrink-0">
              {vendor.avatarInitials}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-text-primary truncate">{vendor.name}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <a 
                  href={`tel:${vendor.phone}`}
                  className="text-[11px] text-text-secondary hover:text-green flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3 h-3 text-text-tertiary" />
                  <span>{vendor.phone}</span>
                </a>
                <span className="text-text-tertiary text-xs">•</span>
                <VendorStatusBadge status={vendor.status} />
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-surface border border-border text-text-secondary hover:text-red hover:border-red flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 sm:space-y-6">
          {/* Data gaps notification */}
          {vendor.dataGaps && vendor.dataGaps.length > 0 && (
            <div className="bg-amber-muted border border-amber/20 rounded-md p-3.5 flex items-start gap-3">
              <AlertTriangle className="w-4.5 h-4.5 text-amber shrink-0 mt-0.5" />
              <div className="text-[11px] text-left">
                <strong className="block text-text-primary font-bold mb-0.5">Incomplete Data Profile</strong>
                <span className="text-text-secondary font-medium block">
                  Missing information: <span className="text-amber font-semibold">{vendor.dataGaps.join(', ')}</span>. Update this vendor during data collection.
                </span>
              </div>
            </div>
          )}

          {/* Attendance History Section */}
          <div>
            <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2.5">Attendance History</h4>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[320px]">
                <thead>
                  <tr className="bg-bg-elevated border-b border-border">
                    <th className="py-2.5 px-3.5 text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Edition</th>
                    <th className="py-2.5 px-3.5 text-[9px] font-bold text-text-tertiary uppercase tracking-wider text-center">Paid</th>
                    <th className="py-2.5 px-3.5 text-[9px] font-bold text-text-tertiary uppercase tracking-wider text-center">Data</th>
                    <th className="py-2.5 px-3.5 text-[9px] font-bold text-text-tertiary uppercase tracking-wider text-right">Seq #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-[11px]">
                  {vendor.attendanceHistory.map((hist) => (
                    <tr key={hist.editionId} className="hover:bg-green-soft/5">
                      <td className="py-2 px-3.5 font-semibold text-text-primary">{hist.editionName}</td>
                      <td className="py-2 px-3.5 text-center">
                        {hist.paid ? (
                          <span className="inline-flex text-green bg-green-soft p-0.5 rounded-full"><Check className="w-3.5 h-3.5 stroke-[3]" /></span>
                        ) : (
                          <span className="text-text-tertiary font-bold">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3.5 text-center">
                        {hist.dataCollected ? (
                          <span className="inline-flex text-green bg-green-soft p-0.5 rounded-full"><Check className="w-3.5 h-3.5 stroke-[3]" /></span>
                        ) : (
                          <span className="inline-flex text-red bg-red-muted/20 p-0.5 rounded-full"><X className="w-3.5 h-3.5 text-red stroke-[3]" /></span>
                        )}
                      </td>
                      <td className="py-2 px-3.5 text-right font-mono text-text-secondary">{hist.sequenceNumber || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Profile Attributes grouped by Edition */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Historical Attributes</h4>
            {vendor.editionAttributes.map((edAttr) => (
              <div key={edAttr.editionId} className="bg-bg-elevated/40 border border-border/50 rounded-lg p-3.5 sm:p-4 text-left">
                <h5 className="text-[10px] font-bold text-green uppercase tracking-wide mb-3 border-b border-border/40 pb-1.5 flex items-center justify-between">
                  <span>{edAttr.editionName}</span>
                  <span className="text-[8px] text-text-tertiary font-medium">Record source</span>
                </h5>
                <div className="space-y-2.5">
                  {edAttr.attributes.map((attr) => (
                    <div key={attr.key} className="flex items-start justify-between gap-4 py-0.5">
                      <div>
                        <span className="block text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">{attr.label}</span>
                        <span className="text-xs font-bold text-text-primary mt-0.5 block">{attr.value}</span>
                      </div>
                      <Badge variant={getSourceBadgeColor(attr.source)} size="sm" className="shrink-0 text-[8px] lowercase py-0 px-2 mt-1 select-none">
                        {attr.source}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel Footer Actions with safe-area bottom */}
        <div 
          className="p-4 border-t border-border shrink-0 bg-bg-elevated flex items-center gap-2"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {onEdit && (
            <Button 
              variant="primary" 
              onClick={() => onEdit(vendor.id)}
              className="flex-1"
            >
              <Edit2 className="w-4 h-4 text-white shrink-0" />
              <span>Edit Profile</span>
            </Button>
          )}
          {onFlagMerge && (
            <Button 
              variant="secondary" 
              onClick={() => onFlagMerge(vendor.id)}
              className="px-3"
              title="Flag for Merge"
            >
              <Merge className="w-4 h-4 shrink-0" />
            </Button>
          )}
          {onExport && (
            <Button 
              variant="secondary" 
              onClick={() => onExport(vendor.id)}
              className="px-3"
              title="Export Vendor Details"
            >
              <Download className="w-4 h-4 shrink-0" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
