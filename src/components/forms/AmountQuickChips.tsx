'use client';

import React from 'react';

export const DEFAULT_AMOUNT_PRESETS = [120000, 240000];

/**
 * Returns true when a form question represents a monetary amount, so quick-select
 * chips are shown. Matches on the csv column or the question text.
 */
export function isAmountQuestion(csvColumn: string, questionText: string): boolean {
  return /amount|paid|fee|price|cost/i.test(`${csvColumn} ${questionText}`);
}

export interface AmountQuickChipsProps {
  /** Raw value currently held by the field (e.g. "120000"). */
  value: string;
  /** Called with the raw numeric string (no separators) when a chip is picked. */
  onSelect: (rawValue: string) => void;
  amounts?: number[];
  className?: string;
}

/**
 * Clickable amount shortcuts. Selecting one autofills the amount field, but the
 * field stays fully editable so vendors can still type a custom figure.
 */
export const AmountQuickChips: React.FC<AmountQuickChipsProps> = ({
  value,
  onSelect,
  amounts = DEFAULT_AMOUNT_PRESETS,
  className = '',
}) => {
  const numericValue = Number(value);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {amounts.map((amount) => {
        const active = numericValue === amount;
        return (
          <button
            key={amount}
            type="button"
            onClick={() => onSelect(String(amount))}
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              active
                ? 'bg-accent text-white border-accent font-bold shadow-xs'
                : 'bg-white text-text-secondary border-border hover:text-text-primary hover:bg-slate-50'
            }`}
          >
            {amount.toLocaleString('en-US')}
          </button>
        );
      })}
    </div>
  );
};
