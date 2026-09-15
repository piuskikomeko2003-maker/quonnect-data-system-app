import React, { useEffect, useRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixText?: string;
  requiredAsterisk?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, prefixText, requiredAsterisk = false, className = '', type = 'text', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1 select-none">
            {label}
            {requiredAsterisk && <span className="text-red">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixText && (
            <span className="absolute left-3.5 bg-accent-soft text-accent font-semibold text-xs px-2 py-0.5 rounded-full select-none pointer-events-none">
              {prefixText}
            </span>
          )}
          <input
            ref={ref}
            type={type}
            className={`w-full bg-bg-input border ${error ? 'border-red focus:border-red focus:ring-1 focus:ring-red' : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'} rounded-md px-3.5 py-2 text-text-primary text-xs font-sans placeholder-text-muted transition-colors outline-none disabled:opacity-50 ${prefixText ? 'pl-14' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-[11px] text-red flex items-center gap-1 font-medium">{error}</span>}
        {helperText && !error && <span className="text-[10px] text-text-tertiary">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  autoResize?: boolean;
  requiredAsterisk?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, autoResize = true, requiredAsterisk = false, className = '', ...props }, ref) => {
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    // Combine external ref and local ref
    const setRefs = (node: HTMLTextAreaElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      }
    };

    const adjustHeight = () => {
      const textarea = localRef.current;
      if (textarea && autoResize) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    };

    useEffect(() => {
      adjustHeight();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      if (props.onChange) {
        props.onChange(e);
      }
    };

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1 select-none">
            {label}
            {requiredAsterisk && <span className="text-red">*</span>}
          </label>
        )}
        <textarea
          ref={setRefs}
          className={`w-full bg-bg-input border ${error ? 'border-red focus:border-red focus:ring-1 focus:ring-red' : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'} rounded-md px-3.5 py-2 text-text-primary text-xs font-sans placeholder-text-muted transition-colors outline-none resize-none min-h-[60px] disabled:opacity-50 ${className}`}
          {...props}
          onChange={handleChange}
        />
        {error && <span className="text-[11px] text-red flex items-center gap-1 font-medium">{error}</span>}
        {helperText && !error && <span className="text-[10px] text-text-tertiary">{helperText}</span>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
