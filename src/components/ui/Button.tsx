import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'clear';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'secondary', size = 'md', fullWidth = false, children, ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center font-semibold rounded-md transition-all duration-150 ease-in-out cursor-pointer gap-2 outline-none select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
    
    const variants = {
      primary: 'bg-green text-black hover:bg-[#00ff7a] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(0,230,118,0.3)]',
      secondary: 'bg-bg-elevated text-text-primary border border-border-light hover:border-green hover:text-green',
      ghost: 'bg-transparent text-text-secondary border border-transparent hover:text-text-primary hover:bg-bg-hover',
      danger: 'bg-red-muted text-red border border-red-muted hover:bg-red hover:text-black',
      clear: 'bg-transparent border border-border text-text-tertiary rounded-full font-medium hover:border-red hover:text-red',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-[11px]',
      md: 'px-4 py-2 text-xs',
      lg: 'px-6 py-3 text-sm rounded-lg',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
