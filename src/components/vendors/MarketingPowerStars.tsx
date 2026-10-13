import React from 'react';

export interface MarketingPowerStarsProps {
  /** 1-10 rating scale (null or undefined for unrated) */
  rating: number | null | undefined;
  /** Average rating across editions (optional) */
  avgRating?: number | null | undefined;
  /** Visual size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Show the numeric rating text e.g. "9/10" */
  showNumber?: boolean;
  /** Show cross-edition average badge if available */
  showAverage?: boolean;
  /** Optional click handler if clickable */
  onClick?: () => void;
  className?: string;
}

/**
 * 10-point Marketing Power rating represented as 5 stars with half-star precision.
 * Always renders the number next to it, e.g. ★★★★½ 9/10.
 */
export const MarketingPowerStars: React.FC<MarketingPowerStarsProps> = ({
  rating,
  avgRating,
  size = 'sm',
  showNumber = true,
  showAverage = false,
  onClick,
  className = '',
}) => {
  const isRated = rating !== null && rating !== undefined && rating >= 1 && rating <= 10;
  const numRating = isRated ? Number(rating) : 0;

  const sizeConfig = {
    xs: { starSize: 12, textClass: 'text-[10px]', gap: 'gap-0.5' },
    sm: { starSize: 14, textClass: 'text-[11px]', gap: 'gap-1' },
    md: { starSize: 18, textClass: 'text-xs', gap: 'gap-1.5' },
    lg: { starSize: 24, textClass: 'text-sm font-semibold', gap: 'gap-2' },
  }[size];

  // Render 5 stars. For star index i (1 to 5):
  // full star: numRating >= i * 2
  // half star: numRating === i * 2 - 1
  // empty star: numRating < i * 2 - 1
  const renderStar = (index: number) => {
    const starFullValue = index * 2;
    const starHalfValue = starFullValue - 1;

    const isFull = isRated && numRating >= starFullValue;
    const isHalf = isRated && numRating === starHalfValue;

    const starId = `half-star-grad-${Math.random().toString(36).substring(2, 7)}`;

    return (
      <svg
        key={index}
        width={sizeConfig.starSize}
        height={sizeConfig.starSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-100 hover:scale-110"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={starId} x1="0" x2="100%" y1="0" y2="0">
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        {isFull ? (
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="#f59e0b"
            stroke="#d97706"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : isHalf ? (
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={`url(#${starId})`}
            stroke="#d97706"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="#f1f5f9"
            stroke="#cbd5e1"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    );
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`inline-flex items-center ${sizeConfig.gap} select-none ${
        onClick ? 'cursor-pointer hover:opacity-90' : ''
      } ${className}`}
      title={
        isRated
          ? `Marketing Power: ${numRating}/10 (${numRating / 2} stars)${
              avgRating ? ` • Overall Avg: ${avgRating}/10` : ''
            }`
          : 'Unrated for this edition'
      }
    >
      {/* 5 Stars cluster */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(renderStar)}
      </div>

      {/* Numeric Indicator */}
      {showNumber && (
        <span
          className={`font-mono font-semibold ${sizeConfig.textClass} ${
            isRated ? 'text-amber-700 font-bold' : 'text-text-tertiary'
          }`}
        >
          {isRated ? `${numRating}/10` : '—'}
        </span>
      )}

      {/* Cross-edition average indicator */}
      {showAverage && avgRating !== null && avgRating !== undefined && (
        <span
          className="text-[10px] text-text-tertiary font-mono bg-slate-100 border border-border px-1.5 py-0.2 rounded"
          title={`Average across all editions: ${avgRating}/10`}
        >
          avg {avgRating}
        </span>
      )}
    </div>
  );
};
