import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md'
}) => {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-[400px]',
    md: 'max-w-[560px]',
    lg: 'max-w-[720px]',
    xl: 'max-w-[960px]',
    '2xl': 'max-w-[1140px]',
    '3xl': 'max-w-[1280px]',
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 animate-fade-in backdrop-blur-xs">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true"
      />
      <div className={`relative w-full ${maxWidthClasses[maxWidth]} bg-bg-surface border border-border rounded-xl md:rounded-xl shadow-modal max-h-[85vh] overflow-y-auto p-6 md:p-7 z-10 text-left transition-all duration-200`}>
        {title && (
          <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
            {typeof title === 'string' ? (
              <h3 className="text-base font-bold text-text-primary">{title}</h3>
            ) : (
              title
            )}
          </div>
        )}
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-bg-elevated border border-border text-text-secondary hover:text-red hover:border-red flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <div className="text-text-primary text-xs">
          {children}
        </div>
      </div>
    </div>
  );
};
