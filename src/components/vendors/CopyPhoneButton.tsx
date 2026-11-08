'use client';

import React, { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyPhoneButtonProps {
  phone: string;
  className?: string;
  /** Hide the label and show only the icon. */
  iconOnly?: boolean;
}

/**
 * Copies a vendor phone number to the clipboard. Uses the async Clipboard API
 * when available and falls back to a temporary textarea for older/insecure
 * browsers (Safari on plain http, older iOS).
 */
export const CopyPhoneButton: React.FC<CopyPhoneButtonProps> = ({
  phone,
  className = '',
  iconOnly = true,
}) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyFallback = (value: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleCopy = async (event: React.MouseEvent) => {
    // Never let a copy click open the vendor drawer / select the table row.
    event.preventDefault();
    event.stopPropagation();

    const value = (phone || '').trim();
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        copyFallback(value);
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      try {
        copyFallback(value);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard is unavailable — leave the button in its normal state.
      }
    }
  };

  if (!phone) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Phone number copied' : `Copy ${phone}`}
      aria-label={copied ? 'Phone number copied' : 'Copy phone number'}
      className={`inline-flex items-center gap-1 rounded border border-transparent px-1 py-0.5 transition-colors cursor-pointer ${
        copied
          ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
          : 'text-text-tertiary hover:text-accent hover:bg-accent-soft/60'
      } ${className}`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {!iconOnly && (
        <span className="text-[10px] font-semibold">
          {copied ? 'Copied' : 'Copy'}
        </span>
      )}
    </button>
  );
};
