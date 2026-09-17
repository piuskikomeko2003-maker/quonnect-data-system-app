import React from 'react';

/**
 * SINGLE SOURCE OF TRUTH for the content width of form-centric admin pages
 * (Quick Entry Panel, and any future form/panel page).
 *
 * ── REGRESSION GUARD ─────────────────────────────────────────────────────────
 * DO NOT override width / max-width / horizontal margins per instance, per
 * region, per edition, per route, or based on record counts. Content may vary;
 * the layout must not. Route form pages through <PageContainer> and change the
 * width only by editing PAGE_CONTENT_MAX_WIDTH here.
 *
 * ── WHY `w-full` IS REQUIRED ─────────────────────────────────────────────────
 * The admin shell renders page sections as items of a `flex flex-col`
 * container. A flex item that sets `max-w-*` + `mx-auto` but no explicit width
 * has its auto margins disable flex `stretch`, so it falls back to
 * shrink-to-fit (intrinsic) sizing. Its rendered width then depends on the
 * widest descendant's max-content — so long edition/region names or
 * activity-feed rows silently change the panel width between editions.
 * Pairing the max-width with `w-full` makes the width deterministic:
 * min(100% of parent, max-width), regardless of content.
 */
export const PAGE_CONTENT_MAX_WIDTH = 'max-w-2xl';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Spacing / typography / animation utilities only.
   * NEVER pass width, max-width, or horizontal padding/margin overrides here.
   */
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  ...rest
}) => (
  <div
    className={`w-full ${PAGE_CONTENT_MAX_WIDTH} mx-auto ${className}`}
    {...rest}
  >
    {children}
  </div>
);
