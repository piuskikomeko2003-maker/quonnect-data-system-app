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
  const baseStyle = 'bg-bg-surface border border-border rounded-lg p-5 transition-all duration-150 ease-in-out relative overflow-hidden';
  
  const hoverStyle = (hoverEffect || onClick) 
    ? 'hover:border-border-light hover:shadow-elevated hover:-translate-y-[1px] cursor-pointer' 
    : '';

  const activeStyle = isActive 
    ? 'border-green bg-green-soft shadow-[0_0_0_1px_#00e676]' 
    : '';

  const leftBorderStyles = {
    none: '',
    purple: 'border-l-3 border-l-purple',
    green: 'border-l-3 border-l-green',
    amber: 'border-l-3 border-l-amber',
    blue: 'border-l-3 border-l-blue',
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
