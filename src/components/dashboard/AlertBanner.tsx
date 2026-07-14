import React from 'react';
import { AlertTriangle, CheckCircle2, Info, ChevronRight } from 'lucide-react';

export interface AlertBannerProps {
  type: 'warning' | 'success' | 'info';
  title: string;
  subtitle: string;
  onClick?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  title,
  subtitle,
  onClick
}) => {
  const containerClasses = {
    warning: 'bg-amber-muted border border-amber/20 hover:border-amber/40 hover:bg-amber-muted/15',
    success: 'bg-green-soft border border-green/20 hover:border-green/40 hover:bg-green-soft/15',
    info: 'bg-blue-muted border border-blue/20 hover:border-blue/40 hover:bg-blue-muted/15',
  };

  const textClasses = {
    warning: 'text-amber',
    success: 'text-green',
    info: 'text-blue',
  };

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green shrink-0" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4.5 p-3.5 px-4.5 rounded-lg text-[12.5px] cursor-pointer transition-all duration-150 ${containerClasses[type]} ${onClick ? 'hover:translate-x-0.5' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-center shrink-0">
        {getIcon()}
      </div>
      <div className="flex-1 text-left min-w-0">
        <strong className="block text-text-primary text-xs font-bold truncate mb-0.5">{title}</strong>
        <span className="block text-text-secondary text-[11px] font-semibold truncate">{subtitle}</span>
      </div>
      {onClick && (
        <ChevronRight className="w-4 h-4 text-text-secondary opacity-40 shrink-0" />
      )}
    </div>
  );
};
