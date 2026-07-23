import React from 'react';
import { User, Phone, Mail, Briefcase, Footprints, Sparkles, Check, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui';
import { Badge } from '../ui/Badge';

export interface WalkinFormValues {
  fullName: string;
  phone: string;
  email: string;
  businessType: string;
  age: string;
}

export interface WalkinFormProps {
  values: WalkinFormValues;
  onChange: (updatedValues: Partial<WalkinFormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  successState: {
    show: boolean;
    visitorName?: string;
    onAddAnother: () => void;
  };
  runningCount: number;
}

export const WalkinForm: React.FC<WalkinFormProps> = ({
  values,
  onChange,
  onSubmit,
  successState,
  runningCount
}) => {
  if (successState.show) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[380px] select-none text-left">
        <div className="w-16 h-16 bg-green-muted text-green rounded-full flex items-center justify-center mb-5 animate-pulse">
          <Check className="w-8 h-8 stroke-[3]" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Walk-in Logged Successfully!</h3>
        <p className="text-xs text-text-secondary mb-6 max-w-[280px]">
          Recorded walk-in guest <span className="text-green font-bold">{successState.visitorName || values.fullName || 'Anonymous Visitor'}</span>.
        </p>
        <Button variant="primary" onClick={successState.onAddAnother} className="w-full">
          <Plus className="w-4 h-4 text-black" />
          <span>Add Another Guest</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5 max-w-[560px] mx-auto text-left relative select-none">
      <div className="flex justify-between items-center border-b border-border pb-4 mb-5">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Footprints className="w-4 h-4 text-green" /> Walk-in Guest Registry
          </h3>
          <span className="text-[10px] text-text-tertiary font-medium mt-0.5">Optimized for speed entry</span>
        </div>
        <Badge variant="info" size="sm" className="font-extrabold text-[11px] select-none">
          {runningCount} walk-ins entered
        </Badge>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center justify-between mb-1.5">
            <span>Full Name</span>
            <span className="text-[9px] font-medium text-text-muted bg-bg-hover px-1.5 py-0.5 rounded uppercase">Optional</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Aisha Nakamya"
            value={values.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center justify-between mb-1.5">
              <span>Phone Number</span>
              <span className="text-[9px] font-medium text-text-muted bg-bg-hover px-1.5 py-0.5 rounded uppercase">Optional</span>
            </label>
            <input
              type="tel"
              placeholder="07XX XXX XXX"
              value={values.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center justify-between mb-1.5">
              <span>Email</span>
              <span className="text-[9px] font-medium text-text-muted bg-bg-hover px-1.5 py-0.5 rounded uppercase">Optional</span>
            </label>
            <input
              type="email"
              placeholder="email@example.com"
              value={values.email}
              onChange={(e) => onChange({ email: e.target.value })}
              className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center justify-between mb-1.5">
              <span>Business Type</span>
              <span className="text-[9px] font-medium text-text-muted bg-bg-hover px-1.5 py-0.5 rounded uppercase">Optional</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Retail, Food, Services"
              value={values.businessType}
              onChange={(e) => onChange({ businessType: e.target.value })}
              className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block mb-1.5">
              Age
            </label>
            <input
              type="number"
              min="16"
              max="80"
              placeholder="e.g. 25"
              value={values.age}
              onChange={(e) => onChange({ age: e.target.value })}
              className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary text-sm font-sans placeholder-text-muted transition-colors outline-none font-bold text-center"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            className="py-3.5 text-xs tracking-wider font-extrabold"
          >
            <span>Save Walk-in Attendance</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
