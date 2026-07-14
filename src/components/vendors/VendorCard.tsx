import React from 'react';
import { Card } from '../ui/Card';
import { Phone, Calendar } from 'lucide-react';
import { VendorStatusBadge, VendorStatus } from './VendorStatusBadge';
import { Badge } from '../ui/Badge';

export interface VendorCardProps {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  attendanceCount: number;
  status: VendorStatus;
  onClick?: () => void;
  className?: string;
}

export const VendorCard: React.FC<VendorCardProps> = ({
  id,
  name,
  businessName,
  phone,
  attendanceCount,
  status,
  onClick,
  className = ''
}) => {
  return (
    <Card 
      onClick={onClick} 
      className={`p-4 flex flex-col justify-between gap-3 text-left ${className}`}
    >
      <div>
        <div className="flex justify-between items-start gap-2">
          <div>
            <h4 className="text-xs font-bold text-text-primary truncate max-w-[130px]" title={name}>
              {name}
            </h4>
            <p className="text-[10px] text-text-secondary truncate mt-0.5" title={businessName}>
              {businessName}
            </p>
          </div>
          <VendorStatusBadge status={status} />
        </div>
      </div>
      
      <div className="flex items-center justify-between border-t border-border-light pt-2.5 mt-1">
        <a 
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()} // Prevent card click trigger
          className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-green font-medium transition-colors"
        >
          <Phone className="w-3 h-3 text-text-tertiary" />
          <span>{phone}</span>
        </a>
        <Badge variant="info" size="sm" className="flex items-center gap-1 text-[9px] lowercase py-0 px-2 select-none shrink-0">
          <Calendar className="w-2.5 h-2.5 uppercase" />
          <span>{attendanceCount} attendances</span>
        </Badge>
      </div>
    </Card>
  );
};
