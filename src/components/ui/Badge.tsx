import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-semibold rounded-full select-none text-[10px] uppercase tracking-wide';
  
  const variants = {
    success: 'bg-green-muted text-green',
    warning: 'bg-amber-muted text-amber',
    danger: 'bg-red-muted text-red',
    info: 'bg-blue-muted text-blue',
    neutral: 'bg-bg-hover text-text-secondary',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[9px]',
    md: 'px-2.5 py-1 text-[10px]',
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
};
