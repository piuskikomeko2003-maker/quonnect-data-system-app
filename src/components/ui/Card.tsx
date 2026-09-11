import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean;
  leftBorderColor?: 'purple' | 'green' | 'amber' | 'blue' | 'none';
  onClick?: () => void;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  isActive = false,
  leftBorderColor = 'none',
  onClick,
  hoverEffect = true,
  className = '',
  ...props
}) => {
  const baseStyle = 'bg-white border border-border rounded-xl p-5 transition-all duration-200 ease-out relative overflow-hidden';
  
  const hoverStyle = (hoverEffect || onClick) 
    ? 'hover:border-accent/40 hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer' 
    : '';

  const activeStyle = isActive 
    ? 'border-accent bg-accent-soft/40 shadow-[0_0_0_1px_#1d4ed8]' 
    : '';

  const leftBorderStyles = {
    none: '',
    purple: 'border-l-3 border-l-purple',
    green: 'border-l-3 border-l-green',
    amber: 'border-l-3 border-l-amber',
    blue: 'border-l-3 border-l-accent',
  };

  return (
    <div
      onClick={onClick}
      className={`${baseStyle} ${hoverStyle} ${activeStyle} ${leftBorderStyles[leftBorderColor]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
