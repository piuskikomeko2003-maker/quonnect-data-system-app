/**
 * Helper utilities for working with market editions.
 */

/**
 * Detects whether an edition or market day record is a test, staging, or load-test entry.
 * Checks for:
 * 1. An explicit `is_test` flag (if present).
 * 2. Words matching "test", "staging", or "load test" in the edition name or slug.
 * 
 * Real editions like "Kampala May 2026", "Jinja April 2026", "Hoima Market Day"
 * are preserved.
 */
export function isTestEdition(edition?: {
  name?: string | null;
  edition?: string | null;
  slug?: string | null;
  is_test?: boolean | null;
} | null): boolean {
  if (!edition) return false;
  if (edition.is_test) return true;

  const testPattern = /(staging|load\s*test|\btest\b)/i;
  const name = edition.name || '';
  const edName = edition.edition || '';
  const slug = edition.slug || '';

  return testPattern.test(name) || testPattern.test(edName) || testPattern.test(slug);
}
