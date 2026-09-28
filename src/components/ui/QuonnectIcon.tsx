import React from 'react';

export interface QuonnectIconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export const QuonnectIcon: React.FC<QuonnectIconProps> = ({
  size = 32,
  className = '',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      aria-label="Quonnect"
      role="img"
      {...props}
    >
      <defs>
        <linearGradient id="quonnectSkyIconGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#quonnectSkyIconGrad)" />
      <g fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="246" cy="246" r="108" strokeWidth="44" />
        <path d="M 307 307 L 372 372" strokeWidth="44" />
      </g>
    </svg>
  );
};
