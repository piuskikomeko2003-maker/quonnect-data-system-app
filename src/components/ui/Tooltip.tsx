import React, { useState } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowStyles = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-white border-t-border',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-white border-b-border',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-white border-l-border',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-white border-r-border',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`absolute z-[2000] ${positionStyles[position]} pointer-events-none`}>
          <div className="bg-white border border-border text-text-primary text-[10px] font-semibold py-1 px-2 rounded-md shadow-elevated whitespace-nowrap">
            {content}
            <div className={`absolute border-4 border-transparent ${arrowStyles[position]}`} />
          </div>
        </div>
      )}
    </div>
  );
};
