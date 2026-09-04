import React, { useEffect } from 'react';
import { Phone, User, Building, Mail, Sparkles, Check, Plus, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select, Badge } from '../ui';

export interface PaidVendorFormValues {
  phone: string;
  name: string;
  businessName: string;
  email: string;
  gender: string;
  dob: string;
  amountPaid: string;
}

export interface PaidVendorFormProps {
  values: PaidVendorFormValues;
  onChange: (updatedValues: Partial<PaidVendorFormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  lookupStatus: 'idle' | 'searching' | 'returning' | 'new';
  onPhoneLookup: (phone: string) => void;
  successState: {
    show: boolean;
    vendorName?: string;
    onAddAnother: () => void;
  };
  runningCount: number;
}

export const PaidVendorForm: React.FC<PaidVendorFormProps> = ({
  values,
  onChange,
  onSubmit,
  lookupStatus,
  onPhoneLookup,
  successState,
  runningCount
}) => {
  // Trigger lookup callback when phone input reaches 10 digits
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const phoneDigits = rawVal.replace(/\D/g, '');
    onChange({ phone: rawVal });
    if (phoneDigits.length >= 9) {
      onPhoneLookup(phoneDigits);
    }
  };

  if (successState.show) {
    return (
      <div className="bg-bg-surface border border-border rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[380px] select-none text-left">
        <div className="w-16 h-16 bg-green-muted text-green rounded-full flex items-center justify-center mb-5 animate-pulse">
          <Check className="w-8 h-8 stroke-[3]" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Registration Successful!</h3>
        <p className="text-xs text-text-secondary mb-6 max-w-[280px]">
          Registered <span className="text-green font-bold">{successState.vendorName || values.name}</span> as a paid vendor.
        </p>
        <Button variant="primary" onClick={successState.onAddAnother} className="w-full">
          <Plus className="w-4 h-4 text-white" />
          <span>Add Another Vendor</span>
        </Button>
      </div>
    );
  }

  const genderOptions = [
    { value: '', label: 'Select Gender' },
    { value: 'Female', label: 'Female' },
    { value: 'Male', label: 'Male' },
    { value: 'Other', label: 'Other' }
  ];

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5 max-w-[560px] mx-auto text-left relative select-none">
      {/* Running counter header */}
      <div className="flex justify-between items-center border-b border-border pb-4 mb-5">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Paid Vendor Entry</h3>
          <span className="text-[10px] text-text-tertiary font-medium mt-0.5">June Edition 2026</span>
        </div>
        <Badge variant="info" size="sm" className="font-extrabold select-none">
          {runningCount} paid vendors added
        </Badge>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Phone Lookup Field (Primary Identifier) */}
        <div>
          <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1 mb-1.5 select-none">
            <Phone className="w-3.5 h-3.5" />
            <span>Primary Identifier (Phone)</span>
            <span className="text-red">*</span>
          </label>
          <input
            type="tel"
            placeholder="07XX XXX XXX"
            value={values.phone}
            onChange={handlePhoneChange}
            className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary font-bold text-sm tracking-wider placeholder-text-muted transition-colors outline-none"
            required
          />
        </div>

        {/* Lookup status banner */}
        {lookupStatus === 'returning' && (
          <div className="bg-green-soft border border-green/20 text-green rounded-md p-3.5 flex items-start gap-2.5 animate-fade-in select-none">
            <Sparkles className="w-4.5 h-4.5 text-green shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">Returning Vendor Identified</strong>
              <span className="text-text-secondary font-medium">Existing profile details loaded. Review and make edits below.</span>
            </div>
          </div>
        )}

        {lookupStatus === 'new' && (
          <div className="bg-blue-muted border border-blue/20 text-blue rounded-md p-3.5 flex items-start gap-2.5 animate-fade-in select-none">
            <AlertCircle className="w-4.5 h-4.5 text-blue shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">New Vendor Profile</strong>
              <span className="text-text-secondary font-medium">No record found with this phone number. Complete details to create profile.</span>
            </div>
          </div>
        )}

        {/* Collapsible/Animatable profile fields - show when phone is entered */}
        <div className={`space-y-4 transition-all duration-300 ${values.phone ? 'opacity-100 max-h-[1000px]' : 'opacity-40 pointer-events-none'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor Full Name */}
            <Input
              label="Vendor Full Name"
              placeholder="e.g. Grace Achieng"
              value={values.name}
              onChange={(e) => onChange({ name: e.target.value })}
              requiredAsterisk
              required
            />
            {/* Business Name */}
            <Input
              label="Business Name"
              placeholder="e.g. Achieng Fashion"
              value={values.businessName}
              onChange={(e) => onChange({ businessName: e.target.value })}
              requiredAsterisk
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. grace@example.com"
              value={values.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
            {/* Gender */}
            <Select
              label="Gender"
              options={genderOptions}
              value={values.gender}
              onChange={(e) => onChange({ gender: e.target.value })}
              requiredAsterisk
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date of Birth */}
            <Input
              label="Date of Birth"
              type="date"
              value={values.dob}
              onChange={(e) => onChange({ dob: e.target.value })}
            />
            {/* Amount Paid */}
            <Input
              label="Amount Paid (UGX)"
              type="number"
              prefixText="UGX"
              placeholder="e.g. 50000"
              value={values.amountPaid}
              onChange={(e) => onChange({ amountPaid: e.target.value })}
              requiredAsterisk
              required
            />
          </div>
        </div>

        {/* Submit button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            disabled={!values.phone || !values.name || !values.businessName || !values.amountPaid}
          >
            <span>Register Paid Vendor</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
