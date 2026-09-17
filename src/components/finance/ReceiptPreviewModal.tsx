'use client';

import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string | null;
  title?: string;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  receiptUrl,
  title = 'Proof of Payment / Receipt',
}) => {
  if (!isOpen || !receiptUrl) return null;

  const isPdf = receiptUrl.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border border-border rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-card-entrance">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-text-primary">{title}</h3>
          <div className="flex items-center gap-2">
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-bg-elevated transition-colors"
              title="Open in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center bg-bg-elevated/40">
          {isPdf ? (
            <iframe
              src={receiptUrl}
              className="w-full h-[60vh] border border-border rounded-lg"
              title="PDF Receipt"
            />
          ) : (
            <img
              src={receiptUrl}
              alt="Receipt Preview"
              className="max-h-[65vh] max-w-full rounded-lg object-contain shadow-xs border border-border bg-white"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-between items-center bg-white">
          <a
            href={receiptUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-accent hover:underline flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Original File
          </a>
          <Button variant="secondary" onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
