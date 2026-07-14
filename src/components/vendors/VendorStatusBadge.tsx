import React from 'react';
import { Badge } from '../ui/Badge';

export type VendorStatus = 'new' | 'active' | 'loyal' | 'dormant';

export interface VendorStatusBadgeProps {
  status: VendorStatus;
  className?: string;
}

export const VendorStatusBadge: React.FC<VendorStatusBadgeProps> = ({
  status,
  className = ''
}) => {
  const getBadgeConfig = (status: VendorStatus) => {
    switch (status) {
      case 'new':
        return { variant: 'info' as const, text: 'New' };
      case 'active':
        return { variant: 'success' as const, text: 'Active' };
      case 'loyal':
        return { variant: 'warning' as const, text: 'Loyal' };
      case 'dormant':
        return { variant: 'neutral' as const, text: 'Dormant' };
      default:
        return { variant: 'neutral' as const, text: status };
    }
  };

  const config = getBadgeConfig(status);

  return (
    <Badge variant={config.variant} size="sm" className={`font-bold uppercase tracking-wider ${className}`}>
      {config.text}
    </Badge>
  );
};
