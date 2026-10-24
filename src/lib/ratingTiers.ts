/**
 * Marketing-power tier definitions shared by the ratings screen and the vendor
 * directory filter.
 *
 * Weekly scores are integers 0–10. Edition averages are decimals, so the tier
 * boundaries below are inclusive on the lower edge and exclusive on the next
 * tier's lower edge (e.g. 8.49 is Very Good, 8.5 is Top Tier).
 */

export type TierKey = 'top' | 'very-good' | 'good' | 'average' | 'below' | 'failed';

export interface RatingTier {
  key: TierKey;
  label: string;
  shortLabel: string;
  /** Inclusive lower bound. */
  min: number;
  /** Human-readable range shown in filters. */
  range: string;
  description: string;
  /** Tailwind classes (kept as complete strings so they are generated). */
  dot: string;
  text: string;
  soft: string;
  badge: string;
}

export const RATING_TIERS: RatingTier[] = [
  {
    key: 'top',
    label: 'Top Tier',
    shortLabel: 'Top Tier',
    min: 8.5,
    range: '8.5 – 10',
    description: 'Top-tier crowd pullers',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    soft: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    key: 'very-good',
    label: 'Very Good',
    shortLabel: 'Very Good',
    min: 7.5,
    range: '7.5 – 8.4',
    description: 'Very good reach and consistency',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    soft: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    key: 'good',
    label: 'Good',
    shortLabel: 'Good',
    min: 6.5,
    range: '6.5 – 7.4',
    description: 'Good performance',
    dot: 'bg-cyan-500',
    text: 'text-cyan-700',
    soft: 'bg-cyan-50 border-cyan-200',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  {
    key: 'average',
    label: 'Average',
    shortLabel: 'Average',
    min: 5,
    range: '5 – 6.4',
    description: 'Average performance',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    soft: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    key: 'below',
    label: 'Below Average',
    shortLabel: 'Below Avg',
    min: 1,
    range: '1 – 4.9',
    description: 'Below-average reach',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    soft: 'bg-orange-50 border-orange-200',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    key: 'failed',
    label: 'Failed',
    shortLabel: 'Failed',
    min: 0,
    range: '0',
    description: 'Scored zero — did not market',
    dot: 'bg-rose-600',
    text: 'text-rose-700',
    soft: 'bg-rose-50 border-rose-200',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

export const UNRATED_TIER_STYLE = {
  dot: 'bg-slate-200',
  text: 'text-text-tertiary',
  soft: 'bg-slate-50 border-slate-200',
  badge: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Tier for an edition average (null = unrated). */
export function tierForAverage(average: number | null | undefined): RatingTier | null {
  if (average === null || average === undefined || Number.isNaN(average)) return null;
  if (average === 0) return RATING_TIERS[RATING_TIERS.length - 1];

  // Special case: averages between 0 and 1 still count as below average.
  if (average > 0 && average < 1) {
    return RATING_TIERS.find((tier) => tier.key === 'below') || null;
  }

  return (
    RATING_TIERS.find((tier) => {
      if (tier.key === 'failed') return false;
      if (tier.key === 'top') return average >= tier.min;
      return average >= tier.min;
    }) || null
  );
}

export type RatingFilterKey = 'all' | 'unrated' | TierKey;

/** True when an edition average belongs to the selected filter. */
export function matchesRatingFilter(
  average: number | null | undefined,
  filter: RatingFilterKey
): boolean {
  if (filter === 'all') return true;
  if (filter === 'unrated') return average === null || average === undefined;
  if (average === null || average === undefined) return false;

  switch (filter) {
    case 'top':
      return average >= 8.5 && average <= 10;
    case 'very-good':
      return average >= 7.5 && average < 8.5;
    case 'good':
      return average >= 6.5 && average < 7.5;
    case 'average':
      return average >= 5 && average < 6.5;
    case 'below':
      return average > 0 && average < 5;
    case 'failed':
      return average === 0;
    default:
      return true;
  }
}
