import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  requiredAsterisk?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, requiredAsterisk = false, className = '', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1 select-none">
            {label}
            {requiredAsterisk && <span className="text-red">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full bg-bg-input border ${error ? 'border-red focus:border-red focus:ring-1 focus:ring-red' : 'border-border focus:border-accent focus:ring-1 focus:ring-accent'} rounded-md px-3.5 py-2 text-text-primary text-xs font-sans placeholder-text-muted transition-colors outline-none cursor-pointer disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%238b949e%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-8 ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-white text-text-primary">
              {option.label}
            </option>
          ))}
        </select>
        {error && <span className="text-[11px] text-red flex items-center gap-1 font-medium">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
