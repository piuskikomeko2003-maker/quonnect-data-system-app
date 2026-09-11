'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export interface DuplicateConfirmModalProps {
  isOpen: boolean;
  vendorName: string;
  editionName: string;
  title?: string;
  detailMessage?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DuplicateConfirmModal: React.FC<DuplicateConfirmModalProps> = ({
  isOpen,
  vendorName,
  editionName,
  title = 'Duplicate Record Detected',
  detailMessage,
  confirmText = 'Replace with New Data',
  cancelText = 'Keep Existing & Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in select-none">
      <div
        className="fixed inset-0"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[480px] bg-white border border-border rounded-2xl shadow-modal p-6 z-10 animate-scale-up text-left">
        {/* Close icon */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 border border-border text-text-secondary hover:text-text-primary hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary tracking-tight">{title}</h3>
            <p className="text-[11px] text-text-secondary mt-0.5">
              An existing record was found matching this vendor in this edition.
            </p>
          </div>
        </div>

        {/* Vendor & Edition context card */}
        <div className="bg-bg-elevated border border-border rounded-xl p-3.5 mb-4 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-tertiary text-[11px]">Vendor Name:</span>
            <span className="font-semibold text-text-primary">{vendorName || 'Unnamed Vendor'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-tertiary text-[11px]">Event Edition:</span>
            <span className="font-medium text-amber-600 font-mono text-[11px]">{editionName}</span>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs text-text-secondary leading-relaxed mb-6">
          {detailMessage || (
            <>
              A survey response has already been submitted for{' '}
              <strong className="text-text-primary">{vendorName}</strong> in{' '}
              <strong className="text-amber-600">{editionName}</strong>.
              <br />
              <br />
              Would you like to <strong className="text-text-primary">replace the existing survey data</strong> with your new entry, or <strong className="text-text-secondary">cancel</strong> to keep the original record intact?
            </>
          )}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-white hover:bg-bg-elevated border border-border rounded-lg transition-colors cursor-pointer text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
