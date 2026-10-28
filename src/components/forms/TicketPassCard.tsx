'use client';

import React from 'react';
import { Loader2, Ticket } from 'lucide-react';
import { Badge } from '../ui/Badge';
import {
  REQUIRED_TICKET_FIELDS,
  RequiredTicketField,
  TicketTemplate,
} from '@/types/ticketTemplate';
import { normalizeTicketCode } from '@/utils/ticket';

/**
 * The vendor ticket data needed to paint a pass. Intentionally structural so
 * single-day, multi-day and admin registration payloads can all use it.
 */
export interface TicketPassData {
  ticketId?: string;
  dayId?: string;
  dayNumber?: number;
  dayLabel?: string;
  dayDate?: string;
  ticketNumber: number;
  ticketCode: string;
  editionName: string;
  vendorName: string;
  businessName?: string;
  phone?: string;
  category?: string;
  amountPaid?: number;
  paymentStatus?: string;
  registeredAt: string;
}

function computeAdaptiveFontSize(
  text: string,
  baseSize: number,
  maxWidth?: number
): number {
  if (!maxWidth || !text || text.length === 0) return baseSize;
  const approxWidth = text.length * (baseSize * 0.58);
  if (approxWidth > maxWidth) {
    const ratio = maxWidth / approxWidth;
    const scaled = Math.floor(baseSize * ratio);
    return Math.max(11, Math.min(baseSize, scaled));
  }
  return baseSize;
}

function formatIssuedAt(value: string): string {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Custom background + positioned vendor fields. This is the exact card used by
 * single-day registrations, reused for every pass in a multi-day purchase.
 */
export function DesignedTicketCard({
  ticket,
  template,
  backgroundLoaded,
  cardRef,
}: {
  ticket: TicketPassData;
  template: TicketTemplate;
  backgroundLoaded: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const canvasWidth = template.canvas_width || 1920;
  const canvasHeight = template.canvas_height || 1080;
  const ticketCode = normalizeTicketCode(ticket.ticketCode) || ticket.ticketCode;

  const fieldValues: Record<RequiredTicketField, string> = {
    vendor_name: ticket.vendorName || '',
    business_name: ticket.businessName || '',
    category: ticket.category || '',
    phone_number: ticket.phone || '',
    ticket_number: ticketCode,
    issued_at: formatIssuedAt(ticket.registeredAt),
  };

  return (
    <div
      ref={cardRef}
      className="relative rounded-xl overflow-hidden shadow-2xl border border-border/80 w-full select-none"
      style={{
        containerType: 'inline-size',
        aspectRatio: `${canvasWidth} / ${canvasHeight}`,
      }}
    >
      {/* Background Art */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={template.background_image_url}
        alt="Official Vendor Admission Pass"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Dynamic Vendor Fields (positioned in % and sized in container units — no JS scaling) */}
      {backgroundLoaded &&
        REQUIRED_TICKET_FIELDS.map((field) => {
          const pos = template.field_positions?.[field];
          if (!pos) return null;
          const text = fieldValues[field];
          if (!text) return null;

          const adaptiveSize = computeAdaptiveFontSize(text, pos.fontSize || 18, pos.maxWidth);

          return (
            <div
              key={field}
              style={{
                position: 'absolute',
                left: `${(pos.x / canvasWidth) * 100}%`,
                top: `${(pos.y / canvasHeight) * 100}%`,
                fontSize: `max(8px, ${(adaptiveSize / canvasWidth) * 100}cqw)`,
                color: pos.color || '#000000',
                fontWeight: (pos.fontWeight === 'bold' || pos.fontWeight === '700'
                  ? 700
                  : pos.fontWeight === 'semibold' || pos.fontWeight === '600'
                  ? 600
                  : 400) as React.CSSProperties['fontWeight'],
                maxWidth: pos.maxWidth ? `${(pos.maxWidth / canvasWidth) * 100}%` : undefined,
                lineHeight: 1.25,
                wordBreak: 'break-word',
                display: 'flex',
                flexWrap: 'wrap',
              }}
            >
              {text}
            </div>
          );
        })}

      {/* Placeholder until the background art has decoded — reserves the correct height, no layout shift */}
      {!backgroundLoaded && (
        <div className="absolute inset-0 bg-bg-surface flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-green" />
          <span className="text-[11px] text-text-secondary">Generating your ticket…</span>
        </div>
      )}
    </div>
  );
}

/**
 * Dark fallback pass shown only when no custom template exists. Kept in sync
 * with the single-day layout so multi-day registrations look identical.
 */
export function DefaultTicketCard({
  ticket,
  cardRef,
}: {
  ticket: TicketPassData;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const ticketCode = normalizeTicketCode(ticket.ticketCode) || ticket.ticketCode;

  return (
    <div
      ref={cardRef}
      className="bg-bg-surface border border-green/30 rounded-xl p-6 sm:p-8 text-left shadow-2xl relative overflow-hidden"
    >
      {/* Decorative Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-green/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-green/5 rounded-full blur-3xl pointer-events-none" />

      {/* Ticket Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border-light relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-green/15 border border-green/30 flex items-center justify-center text-green">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-green uppercase tracking-widest block">
              Official Vendor Pass{ticket.dayLabel ? ` · ${ticket.dayLabel}` : ''}
            </span>
            <h2 className="text-sm font-bold text-text-primary">{ticket.editionName}</h2>
            {ticket.dayDate && (
              <p className="text-[10px] text-text-tertiary">{ticket.dayDate}</p>
            )}
          </div>
        </div>
        <Badge variant="success" size="sm" className="font-mono text-xs uppercase font-extrabold tracking-wider">
          {ticket.paymentStatus || 'Confirmed'}
        </Badge>
      </div>

      {/* Ticket Number Hero Box */}
      <div className="my-6 p-5 bg-slate-50 border border-border rounded-xl text-center relative z-10 shadow-sm">
        <span className="text-[10px] text-text-tertiary uppercase tracking-widest font-semibold block mb-1">
          Admission Ticket Number
        </span>
        <div className="text-3xl sm:text-4xl font-extrabold font-mono text-accent tracking-wider my-1">
          {ticketCode}
        </div>
        <p className="text-[11px] text-text-secondary">
          Vendor #{ticket.ticketNumber} &middot; Registered for this edition
        </p>
      </div>

      {/* Ticket Details Grid */}
      <div className="space-y-2.5 bg-bg-input/60 border border-border/50 rounded-lg p-4 text-xs relative z-10">
        <div className="flex justify-between items-center py-1 border-b border-border/30">
          <span className="text-text-tertiary">Vendor Name</span>
          <span className="font-semibold text-text-primary">{ticket.vendorName}</span>
        </div>
        {ticket.businessName && (
          <div className="flex justify-between items-center py-1 border-b border-border/30">
            <span className="text-text-tertiary">Business</span>
            <span className="font-semibold text-text-primary">{ticket.businessName}</span>
          </div>
        )}
        {ticket.category && (
          <div className="flex justify-between items-center py-1 border-b border-border/30">
            <span className="text-text-tertiary">Category</span>
            <span className="font-semibold text-text-primary">{ticket.category}</span>
          </div>
        )}
        {ticket.phone && (
          <div className="flex justify-between items-center py-1 border-b border-border/30">
            <span className="text-text-tertiary">Phone Number</span>
            <span className="font-mono font-medium text-text-secondary">{ticket.phone}</span>
          </div>
        )}
        <div className="flex justify-between items-center py-1">
          <span className="text-text-tertiary">Issued At</span>
          <span className="font-mono text-[11px] text-text-secondary">
            {formatIssuedAt(ticket.registeredAt)}
          </span>
        </div>
      </div>

      {/* Barcode Graphic */}
      <div className="pt-5 mt-4 border-t border-border/40 flex flex-col items-center justify-center opacity-80 select-none relative z-10">
        <div className="h-8 flex items-end gap-1">
          {[3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3, 3, 8, 3, 2, 7, 9, 5, 0, 2, 8, 8, 4, 1, 9, 7, 1, 6, 9, 3, 9, 9, 3, 7].map((h, i) => (
            <span
              key={i}
              className="w-0.5 bg-green/60 inline-block"
              style={{ height: `${12 + (h % 5) * 4}px` }}
            />
          ))}
        </div>
        <span className="font-mono text-[9px] tracking-widest text-text-tertiary mt-1">
          {ticketCode} &bull; QUONNECT ADMISSION PASS
        </span>
      </div>
    </div>
  );
}
