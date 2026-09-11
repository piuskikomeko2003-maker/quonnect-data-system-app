export const REQUIRED_TICKET_FIELDS = [
  'vendor_name',
  'business_name',
  'category',
  'phone_number',
  'ticket_number',
  'issued_at',
] as const;

export type RequiredTicketField = (typeof REQUIRED_TICKET_FIELDS)[number];

export const TICKET_FIELD_LABELS: Record<RequiredTicketField, string> = {
  vendor_name: 'Vendor Name',
  business_name: 'Business Name',
  category: 'Category',
  phone_number: 'Phone Number',
  ticket_number: 'Ticket Number',
  issued_at: 'Issued Date & Time',
};

export interface FieldPosition {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | '500' | '600' | '700';
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
}

export type FieldPositionsMap = Record<RequiredTicketField, FieldPosition>;

export interface TicketTemplate {
  id?: string;
  edition_id: string | null;
  is_default?: boolean;
  background_image_url: string;
  canvas_width: number;
  canvas_height: number;
  field_positions: FieldPositionsMap;
  created_at?: string;
  updated_at?: string;
}

export interface TicketVendorData {
  ticketNumber: number | string;
  ticketCode: string;
  editionName?: string;
  vendorName: string;
  businessName?: string;
  category?: string;
  phone?: string;
  amountPaid?: number;
  paymentStatus?: string;
  registeredAt: string;
}

export const SAMPLE_TICKET_DATA: TicketVendorData = {
  ticketNumber: 42,
  ticketCode: 'TKT-042',
  editionName: 'Kampala Flagship Market Day',
  vendorName: 'Jane Doe',
  businessName: 'Sunrise Handcrafted Goods',
  category: 'Crafts & Apparel',
  phone: '+256 701 234 567',
  amountPaid: 50000,
  paymentStatus: 'paid',
  registeredAt: new Date().toISOString(),
};

export const DEFAULT_FIELD_POSITIONS: FieldPositionsMap = {
  vendor_name: { x: 180, y: 420, fontSize: 24, color: '#111827', fontWeight: 'bold', maxWidth: 450, align: 'left' },
  business_name: { x: 180, y: 470, fontSize: 20, color: '#374151', fontWeight: 'semibold', maxWidth: 450, align: 'left' },
  category: { x: 180, y: 520, fontSize: 16, color: '#4B5563', fontWeight: 'normal', maxWidth: 350, align: 'left' },
  phone_number: { x: 180, y: 560, fontSize: 16, color: '#4B5563', fontWeight: 'normal', maxWidth: 300, align: 'left' },
  ticket_number: { x: 1250, y: 300, fontSize: 32, color: '#0C447C', fontWeight: 'bold', maxWidth: 350, align: 'left' },
  issued_at: { x: 180, y: 640, fontSize: 14, color: '#6B7280', fontWeight: 'normal', maxWidth: 350, align: 'left' },
};

/**
 * Validates that all 6 required fields are defined in field_positions.
 * Throws or returns an informative list of missing fields.
 */
export function validateTicketFieldPositions(positions: unknown): {
  valid: boolean;
  missing: RequiredTicketField[];
  errors: string[];
} {
  if (!positions || typeof positions !== 'object') {
    return {
      valid: false,
      missing: [...REQUIRED_TICKET_FIELDS],
      errors: ['field_positions must be a valid JSON object.'],
    };
  }

  const map = positions as Record<string, unknown>;
  const missing: RequiredTicketField[] = [];
  const errors: string[] = [];

  for (const field of REQUIRED_TICKET_FIELDS) {
    const val = map[field];
    if (!val || typeof val !== 'object') {
      missing.push(field);
      errors.push(`Missing required field definition: "${field}"`);
      continue;
    }

    const pos = val as Record<string, unknown>;
    if (typeof pos.x !== 'number' || isNaN(pos.x)) {
      errors.push(`Field "${field}" is missing a valid numeric "x" coordinate.`);
    }
    if (typeof pos.y !== 'number' || isNaN(pos.y)) {
      errors.push(`Field "${field}" is missing a valid numeric "y" coordinate.`);
    }
  }

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}
