import React from 'react';
import { Card } from '../ui/Card';
import { Phone, MapPin } from 'lucide-react';
import { VendorStatus } from './VendorStatusBadge';

export interface VendorCardProps {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  gender: string;
  category: string;
  registrationType?: 'survey' | 'paid' | 'both' | 'unknown';
  lastSeen: string;
  onClick?: () => void;
  className?: string;
}

const REGISTRATION_BADGES: Record<string, { label: string; color: string }> = {
  survey: { label: 'Field Data', color: 'bg-blue-500' },
  paid: { label: 'Registered', color: 'bg-green-500' },
  both: { label: 'Registered + Surveyed', color: 'bg-purple-500' },
  unknown: { label: 'Unverified', color: 'bg-gray-400' },
};

export const VendorCard: React.FC<VendorCardProps> = ({
  id,
  name,
  businessName,
  phone,
  gender,
  category,
  registrationType,
  lastSeen,
  onClick,
  className = ''
}) => {
  const regBadge = REGISTRATION_BADGES[registrationType || 'unknown'];

  return (
    <Card 
      onClick={onClick} 
      className={`p-4 flex flex-col justify-between gap-3 text-left ${className}`}
    >
      <div>
        <div className="flex justify-between items-start gap-2 mb-2">
          <div>
            <h4 className="text-xs font-bold text-text-primary truncate max-w-[160px]" title={name}>
              {name}
            </h4>
            <p className="text-[10px] text-text-secondary truncate mt-0.5 max-w-[160px]" title={businessName}>
              {businessName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold text-text-secondary whitespace-nowrap">
              {gender}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] text-text-tertiary truncate max-w-[130px]" title={category}>
            {category}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between border-t border-border-light pt-2.5 mt-1">
        <a 
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-green font-medium transition-colors"
        >
          <Phone className="w-3 h-3 text-text-tertiary" />
          <span>{phone}</span>
        </a>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`${regBadge.color} text-white text-[9px] px-1.5 py-0 rounded-full font-semibold whitespace-nowrap`}>
            {regBadge.label}
          </span>
          <span className="text-[9px] text-text-tertiary whitespace-nowrap flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5" />
            {lastSeen}
          </span>
        </div>
      </div>
    </Card>
  );
};
