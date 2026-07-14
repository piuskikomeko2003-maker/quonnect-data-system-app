import React from 'react';
import { Phone, User, Building, ShieldAlert, ShieldCheck, Star, Sparkles, Check, Plus, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui';
import { Badge } from '../ui/Badge';

export interface FieldCollectionValues {
  phone: string;
  name: string;
  businessName: string;
  email: string;
  gender: string;
  dob: string;
  employeeCount: string;
  newHiresThisYear: string;
  businessType: string;
  sellsOwnProducts: 'Yes' | 'No' | '';
  exportReady: 'Yes' | 'No' | '';
  impactRating: number;
  businessGrowthNarrative: string;
  previousEditionsCount: string;
}

export interface FieldCollectionFormProps {
  values: FieldCollectionValues;
  onChange: (updatedValues: Partial<FieldCollectionValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  lookupStatus: 'idle' | 'searching' | 'returning' | 'new';
  onPhoneLookup: (phone: string) => void;
  isPaidVendor: boolean | null;
  successState: {
    show: boolean;
    vendorName?: string;
    onAddAnother: () => void;
  };
  runningCount: number;
}

export const FieldCollectionForm: React.FC<FieldCollectionFormProps> = ({
  values,
  onChange,
  onSubmit,
  lookupStatus,
  onPhoneLookup,
  isPaidVendor,
  successState,
  runningCount
}) => {
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
      <div className="bg-bg-surface border border-border rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[480px] select-none text-left">
        <div className="w-16 h-16 bg-green-muted text-green rounded-full flex items-center justify-center mb-5 animate-pulse">
          <Check className="w-8 h-8 stroke-[3]" />
        </div>
        <h3 className="text-base font-bold text-text-primary mb-1">Data Collection Complete!</h3>
        <p className="text-xs text-text-secondary mb-6 max-w-[280px]">
          Saved collector profile sheet for <span className="text-green font-bold">{successState.vendorName || values.name}</span>.
        </p>
        <Button variant="primary" onClick={successState.onAddAnother} className="w-full">
          <Plus className="w-4 h-4 text-black" />
          <span>Collect Next Profile</span>
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
    <div className="bg-bg-surface border border-border rounded-lg p-5 max-w-[560px] mx-auto text-left select-none">
      {/* Running counter header */}
      <div className="flex justify-between items-center border-b border-border pb-4 mb-5">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Field Data Collection</h3>
          <span className="text-[10px] text-text-tertiary font-medium mt-0.5">Impact & Demographics Sheet</span>
        </div>
        <Badge variant="success" size="sm" className="font-extrabold select-none">
          {runningCount} profiles collected
        </Badge>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Phone Lookup Field */}
        <div>
          <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1 mb-1.5 select-none">
            <Phone className="w-3.5 h-3.5" />
            <span>Primary Phone Lookup</span>
            <span className="text-red">*</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="tel"
              placeholder="07XX XXX XXX"
              value={values.phone}
              onChange={handlePhoneChange}
              className="w-full bg-bg-input border border-border-light focus:border-green focus:ring-1 focus:ring-green rounded-md px-3.5 py-2.5 text-text-primary font-bold text-sm tracking-wider placeholder-text-muted transition-colors outline-none"
              required
            />
          </div>
        </div>

        {/* Paid status notification banner */}
        {isPaidVendor === true && (
          <div className="bg-green-soft border border-green/20 text-green rounded-md p-3.5 flex items-center gap-2.5 animate-fade-in select-none">
            <ShieldCheck className="w-5 h-5 text-green shrink-0 animate-bounce" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">Paid Registration Confirmed</strong>
              <span className="text-text-secondary font-medium">Vendor has completed fee payments for this edition.</span>
            </div>
          </div>
        )}

        {isPaidVendor === false && (
          <div className="bg-amber-muted border border-amber/20 text-amber rounded-md p-3.5 flex items-center gap-2.5 animate-fade-in select-none">
            <ShieldAlert className="w-5 h-5 text-amber shrink-0 animate-pulse" />
            <div className="text-[11px] leading-tight text-left">
              <strong className="block font-bold">Payment Missing Warning</strong>
              <span className="text-text-secondary font-medium">This vendor has not paid this edition fee. Flag with supervisor.</span>
            </div>
          </div>
        )}

        {/* Form fields - show when phone is entered */}
        <div className={`space-y-6 transition-all duration-300 ${values.phone ? 'opacity-100 max-h-[2000px]' : 'opacity-40 pointer-events-none'}`}>
          
          {/* Section 1: Personal Profile */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-green uppercase tracking-wider border-b border-border pb-1 mb-2">
              1. Personal Profile
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="e.g. Grace Achieng"
                value={values.name}
                onChange={(e) => onChange({ name: e.target.value })}
                requiredAsterisk
                required
              />
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
              <Select
                label="Gender"
                options={genderOptions}
                value={values.gender}
                onChange={(e) => onChange({ gender: e.target.value })}
                requiredAsterisk
                required
              />
              <Input
                label="Date of Birth"
                type="date"
                value={values.dob}
                onChange={(e) => onChange({ dob: e.target.value })}
              />
            </div>
          </div>

          {/* Section 2: Impact Assessment */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-green uppercase tracking-wider border-b border-border pb-1 mb-2">
              2. Business Impact
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Employee Count"
                type="number"
                placeholder="e.g. 3"
                value={values.employeeCount}
                onChange={(e) => onChange({ employeeCount: e.target.value })}
              />
              <Input
                label="New Hires This Year"
                type="number"
                placeholder="e.g. 1"
                value={values.newHiresThisYear}
                onChange={(e) => onChange({ newHiresThisYear: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Business Classification"
                placeholder="e.g. Fashion and Design"
                value={values.businessType}
                onChange={(e) => onChange({ businessType: e.target.value })}
              />
              <Input
                label="Previous Editions Attended"
                type="number"
                placeholder="e.g. 2"
                helperText="How many times before today?"
                value={values.previousEditionsCount}
                onChange={(e) => onChange({ previousEditionsCount: e.target.value })}
              />
            </div>

            {/* Yes/No Toggle Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block mb-2">
                  Sells Own Products?
                </label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange({ sellsOwnProducts: opt as 'Yes' | 'No' })}
                      className={`flex-1 py-2 rounded-md font-semibold text-xs border transition-all cursor-pointer ${
                        values.sellsOwnProducts === opt
                          ? 'bg-green text-black border-green font-bold'
                          : 'bg-bg-input text-text-secondary border-border-light hover:text-text-primary'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block mb-2">
                  Export Ready?
                </label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange({ exportReady: opt as 'Yes' | 'No' })}
                      className={`flex-1 py-2 rounded-md font-semibold text-xs border transition-all cursor-pointer ${
                        values.exportReady === opt
                          ? 'bg-green text-black border-green font-bold'
                          : 'bg-bg-input text-text-secondary border-border-light hover:text-text-primary'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Star Rating Section */}
            <div className="pt-2">
              <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1 mb-2">
                <span>Program Impact Rating</span>
                <span title="1 star = poor, 5 stars = excellent">
                  <HelpCircle className="w-3.5 h-3.5 text-text-muted" />
                </span>
              </label>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const ratingValue = i + 1;
                  const isActive = ratingValue <= values.impactRating;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChange({ impactRating: ratingValue })}
                      className="cursor-pointer focus:outline-none select-none transition-transform active:scale-90"
                    >
                      <Star 
                        className={`w-6.5 h-6.5 transition-colors ${
                          isActive ? 'text-amber fill-amber' : 'text-text-muted hover:text-amber/60'
                        }`}
                      />
                    </button>
                  );
                })}
                {values.impactRating > 0 && (
                  <span className="text-xs font-bold text-amber ml-2">{values.impactRating}/5 Stars</span>
                )}
              </div>
            </div>

            {/* Growth narrative */}
            <Textarea
              label="Business Growth Narrative"
              placeholder="Tell us about your sales growth, achievements, or challenges this edition..."
              value={values.businessGrowthNarrative}
              onChange={(e) => onChange({ businessGrowthNarrative: e.target.value })}
              autoResize
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
            disabled={!values.phone || !values.name || !values.businessName}
          >
            <span>Register Profile Details</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
