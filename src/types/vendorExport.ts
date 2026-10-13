export interface ExportColumnDef {
  key: string;
  header: string;
  group: 'business' | 'contact' | 'payments' | 'rating' | 'edition' | 'registration';
  description?: string;
}

export const EXPORT_COLUMNS: ExportColumnDef[] = [
  // Business
  { key: 'business_name', header: 'business_name', group: 'business', description: 'Business / Stall Name' },
  { key: 'category', header: 'category', group: 'business', description: 'Business Classification' },
  { key: 'is_active', header: 'is_active', group: 'business', description: 'Active Status' },
  
  // Contact
  { key: 'contact_name', header: 'contact_name', group: 'contact', description: 'Contact Person' },
  { key: 'phone', header: 'phone', group: 'contact', description: 'Primary Phone Number' },
  { key: 'email', header: 'email', group: 'contact', description: 'Email Address' },

  // Payments
  { key: 'amount_paid_ugx', header: 'amount_paid_ugx', group: 'payments', description: 'Amount Paid (UGX plain number)' },
  { key: 'payment_status', header: 'payment_status', group: 'payments', description: 'Payment Status (paid/unpaid)' },
  { key: 'standard_fee_ugx', header: 'standard_fee_ugx', group: 'payments', description: 'Standard Edition Fee (UGX)' },
  { key: 'fee_source', header: 'fee_source', group: 'payments', description: 'Fee Source (standard/override)' },
  { key: 'tables', header: 'tables', group: 'payments', description: 'Number of Tables' },
  { key: 'ticket_number', header: 'ticket_number', group: 'payments', description: 'Numeric Ticket Number' },
  { key: 'stall_number', header: 'stall_number', group: 'payments', description: 'Stall / Space Number' },

  // Rating
  { key: 'rating', header: 'marketing_power_rating', group: 'rating', description: 'Rating (1-10)' },
  { key: 'rating_stars', header: 'rating_stars', group: 'rating', description: 'Rating in Stars (e.g. ★★★★½)' },
  { key: 'rating_note', header: 'rating_note', group: 'rating', description: 'Rating Notes / Reasoning' },
  { key: 'avg_rating', header: 'average_rating_across_editions', group: 'rating', description: 'Average Rating Across All Editions' },

  // Edition & Region
  { key: 'edition_name', header: 'edition', group: 'edition', description: 'Edition Name' },
  { key: 'region_name', header: 'region', group: 'edition', description: 'Region Name' },
  { key: 'event_date', header: 'event_date', group: 'edition', description: 'Edition Date' },

  // Registration & Data
  { key: 'registration_type', header: 'registration_type', group: 'registration', description: 'Survey / Paid / Both' },
  { key: 'attendance_count', header: 'total_attendances', group: 'registration', description: 'Calculated Attendances' },
  { key: 'check_in_time', header: 'check_in_time', group: 'registration', description: 'Gate Check-in Timestamp' },
  { key: 'created_at', header: 'created_at', group: 'registration', description: 'Registration Date' },
];
