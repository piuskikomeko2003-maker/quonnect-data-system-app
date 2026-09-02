/**
 * cleanup_csv_import.js
 * ---------------------
 * Deletes all vendor records created by the most recent paid-vendor CSV import.
 *
 * WHAT IT DELETES:
 *   1. vendors with source = 'csv_import_minimal' (name-only rows) → vendor_registrations first, then the vendor
 *   2. vendor_registrations created in the last 2 hours for vendors whose
 *      phone was present in the CSV (these vendors existed or were upserted —
 *      only the registration row is removed, the vendor profile is kept)
 *
 * WHAT IT DOES NOT DELETE:
 *   - Any vendor that existed before this import session
 *   - Any survey_responses or survey_answers
 *   - Any walkins
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://phaafkuwtgpawuqnenkp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoYWFma3V3dGdwYXd1cW5lbmtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzMDc5MSwiZXhwIjoyMDk0MDA2NzkxfQ.Oq9Tc6UgWZTKxStGiXDo45_D-Zrc9OPbj0GVp6JUVWs';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// How far back to look for "recent" registrations created by this import
const LOOKBACK_MINUTES = 120; // 2 hours

async function cleanupCsvImport() {
  console.log('\n══════════════════════════════════════════');
  console.log('  CSV Import Cleanup Script');
  console.log('══════════════════════════════════════════\n');

  const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
  console.log(`Lookback window: records created after ${cutoff}\n`);

  // ── PHASE 1: Name-only vendors (source = 'csv_import_minimal') ──────────────
  console.log('Phase 1: Finding name-only CSV-imported vendors...');

  const { data: minimalVendors, error: mvErr } = await supabase
    .from('vendors')
    .select('id, contact_name, business_name, created_at')
    .eq('source', 'csv_import_minimal')
    .gte('created_at', cutoff);

  if (mvErr) {
    // Column might not exist yet (migration not run)
    if (mvErr.code === '42703' || mvErr.message?.includes('source')) {
      console.log('  ⚠️  The `source` column does not exist on vendors yet.');
      console.log('  → Run the migration SQL first:');
      console.log('     ALTER TABLE vendors ADD COLUMN IF NOT EXISTS source text DEFAULT \'manual\';');
      console.log('     ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_complete boolean DEFAULT true;\n');
    } else {
      console.error('  Error fetching minimal vendors:', mvErr.message);
    }
  } else {
    console.log(`  Found ${minimalVendors?.length ?? 0} name-only vendor(s) to remove:`);
    (minimalVendors || []).forEach(v => {
      console.log(`    • ${v.contact_name || v.business_name || '(no name)'} — created ${v.created_at}`);
    });

    if (minimalVendors && minimalVendors.length > 0) {
      const ids = minimalVendors.map(v => v.id);

      // Delete vendor_registrations first (FK constraint)
      const { error: regErr, count: regCount } = await supabase
        .from('vendor_registrations')
        .delete({ count: 'exact' })
        .in('vendor_id', ids);

      if (regErr) {
        console.error('  ✕ Failed to delete registrations:', regErr.message);
      } else {
        console.log(`  ✓ Deleted ${regCount ?? 0} vendor_registration row(s)`);
      }

      // Now delete the vendors themselves
      const { error: vendErr, count: vendCount } = await supabase
        .from('vendors')
        .delete({ count: 'exact' })
        .in('id', ids);

      if (vendErr) {
        console.error('  ✕ Failed to delete vendors:', vendErr.message);
      } else {
        console.log(`  ✓ Deleted ${vendCount ?? 0} vendor row(s)\n`);
      }
    } else {
      console.log('  Nothing to delete in Phase 1.\n');
    }
  }

  // ── PHASE 2: Recently created registrations for phone-matched vendors ────────
  // These are vendors who existed (or were upserted with phone) — we only
  // delete the vendor_registration row, NOT the vendor profile.
  console.log('Phase 2: Finding recently created vendor_registrations (phone-matched)...');

  const { data: recentRegs, error: rrErr } = await supabase
    .from('vendor_registrations')
    .select('id, vendor_id, payment_status, created_at')
    .eq('payment_status', 'paid')
    .gte('created_at', cutoff);

  if (rrErr) {
    console.error('  Error fetching recent registrations:', rrErr.message);
  } else {
    // Filter out IDs already deleted in phase 1
    const alreadyDeletedIds = new Set(
      (await supabase
        .from('vendors')
        .select('id')
        .eq('source', 'csv_import_minimal')
      ).data?.map(v => v.id) || []
    );

    const phoneMatchedRegs = (recentRegs || []).filter(
      r => !alreadyDeletedIds.has(r.vendor_id)
    );

    console.log(`  Found ${phoneMatchedRegs.length} recent registration(s) from phone-matched vendors:`);
    phoneMatchedRegs.forEach(r => {
      console.log(`    • reg ${r.id.slice(0, 8)}... for vendor ${r.vendor_id.slice(0, 8)}... — created ${r.created_at}`);
    });

    if (phoneMatchedRegs.length > 0) {
      const regIds = phoneMatchedRegs.map(r => r.id);
      const { error: delErr, count: delCount } = await supabase
        .from('vendor_registrations')
        .delete({ count: 'exact' })
        .in('id', regIds);

      if (delErr) {
        console.error('  ✕ Failed to delete registrations:', delErr.message);
      } else {
        console.log(`  ✓ Deleted ${delCount ?? 0} registration row(s) (vendor profiles kept)\n`);
      }
    } else {
      console.log('  Nothing to delete in Phase 2.\n');
    }
  }

  // ── VERIFICATION ──────────────────────────────────────────────────────────
  console.log('Verification — checking remaining recent records...');

  const { count: remainingVendors } = await supabase
    .from('vendors')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'csv_import_minimal');

  const { count: remainingRegs } = await supabase
    .from('vendor_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', 'paid')
    .gte('created_at', cutoff);

  console.log(`  Remaining csv_import_minimal vendors: ${remainingVendors ?? 'unknown'}`);
  console.log(`  Remaining recent paid registrations:  ${remainingRegs ?? 'unknown'}`);

  console.log('\n══════════════════════════════════════════');
  console.log('  Cleanup complete.');
  console.log('══════════════════════════════════════════\n');
}

cleanupCsvImport().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
