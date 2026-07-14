import React from 'react';
import { User, Phone, Mail, Check, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui';
import { Badge } from '../ui/Badge';

export interface OutreachFormValues {
  name: string;
  phone: string;
  email: string;
  gender: 'Female' | 'Male' | 'Other' | '';
  age: string;
}

export interface OutreachFormProps {
  values: OutreachFormValues;
  onChange: (updatedValues: Partial<OutreachFormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  runningCount: number;
}

export const OutreachForm: React.FC<OutreachFormProps> = ({
  values,
  onChange,
  onSubmit,
  runningCount
}) => {
  const genderOptions: Array<Exclude<OutreachFormValues['gender'], ''>> = ['Female', 'Male', 'Other'];

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-5 max-w-[560px] mx-auto text-left relative select-none">
      {/* Running counter header */}
      <div className="flex justify-between items-center border-b border-border pb-4 mb-5">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Outreach Summit Registry</h3>
          <span className="text-[10px] text-text-tertiary font-medium mt-0.5">Summit Attendance Registry</span>
        </div>
        <Badge variant="info" size="sm" className="font-extrabold select-none">
          {runningCount} attendees registered
        </Badge>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Full Name */}
        <Input
          label="Full Name"
          placeholder="e.g. Michael Okello"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          requiredAsterisk
          required
        />

        {/* Phone Number */}
        <Input
          label="Phone Number"
          type="tel"
          placeholder="07XX XXX XXX"
          value={values.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          requiredAsterisk
          required
        />

        {/* Email Address */}
        <Input
          label="Email Address"
          type="email"
          placeholder="e.g. attendee@example.com"
          value={values.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gender (Interactive Button Group) */}
          <div>
            <label className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block mb-2">
              Gender <span className="text-red">*</span>
            </label>
            <div className="flex gap-2">
              {genderOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange({ gender: opt })}
                  className={`flex-1 py-2 rounded-md font-semibold text-xs border transition-all cursor-pointer ${
                    values.gender === opt
                      ? 'bg-blue text-black border-blue font-bold'
                      : 'bg-bg-input text-text-secondary border-border-light hover:text-text-primary'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <Input
            label="Age"
            type="number"
            min="18"
            max="100"
            placeholder="e.g. 32"
            value={values.age}
            onChange={(e) => onChange({ age: e.target.value })}
            requiredAsterisk
            required
          />
        </div>

        {/* Submit button: blue theme */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="secondary"
            fullWidth
            size="lg"
            className="hover:border-blue hover:text-blue py-3 font-extrabold text-xs"
            disabled={!values.name || !values.phone || !values.gender || !values.age}
          >
            <span>Register for Summit</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
