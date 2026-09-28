'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';

export interface GreetingCardProps {
  /** Optional name override. If omitted, resolved automatically via useAuth() */
  name?: string;
  /** Backwards-compatibility alias for name */
  firstName?: string;
  /** Active market name, e.g. "Kampala" or "Kampala Regional Market" */
  marketName?: string;
  /** Optional custom subtitle override if needed */
  subtitle?: React.ReactNode;
  /** Additional custom classNames */
  className?: string;
}

export const GreetingCard: React.FC<GreetingCardProps> = ({
  name: propName,
  firstName: propFirstName,
  marketName = 'Regional Market',
  subtitle: propSubtitle,
  className = '',
}) => {
  const { name: authName, firstName: authFirstName } = useAuth();
  const effectiveName = propName ?? propFirstName ?? authName ?? authFirstName;

  const [mounted, setMounted] = useState(false);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setMounted(true);
    const now = new Date();

    // Format local date: e.g. "Tuesday 29 September"
    try {
      const formatted = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now).replace(',', '');
      setDateStr(formatted);
    } catch {
      setDateStr(now.toLocaleDateString());
    }
  }, []);

  // Format market name nicely without duplicating "Regional Market"
  const formattedMarketName = marketName.endsWith('Regional Market')
    ? marketName
    : `${marketName} Regional Market`;

  // Welcome heading: "Welcome, {name}" or "Welcome"
  const welcomeHeading = effectiveName ? `Welcome, ${effectiveName}` : 'Welcome';

  return (
    <div
      className={`relative w-full min-h-[190px] md:h-[220px] lg:h-[230px] rounded-2xl overflow-hidden shadow-xs border border-white/10 dark:border-white/5 bg-[#00898c] select-none animate-fade-in ${className}`}
      role="region"
      aria-label="Welcome banner"
    >
      {/* Background Image: QUONNECT Sign Celebration */}
      <Image
        src="/quonnect-celebration.png"
        alt=""
        role="presentation"
        aria-hidden="true"
        fill
        priority
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1280px"
        className="object-cover object-right sm:object-[85%_center] pointer-events-none select-none transition-opacity duration-300"
      />

      {/* Dark-to-transparent gradient overlay: left-to-right for crisp text contrast */}
      <div
        className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-transparent sm:from-slate-950/90 sm:via-slate-950/60 sm:to-transparent"
        aria-hidden="true"
      />

      {/* Subtle glassmorphism touch behind the text area */}
      <div
        className="absolute inset-y-0 left-0 w-full sm:w-3/4 md:w-3/5 z-10 backdrop-blur-[2px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Foreground Content */}
      <div className="relative z-20 h-full flex flex-col justify-center p-6 sm:p-7 md:p-8 text-left">
        <div className="max-w-2xl space-y-2">
          {/* Subtle Date Pill / Line */}
          {mounted && dateStr && (
            <div>
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium text-white/85 bg-white/10 backdrop-blur-xs border border-white/15 w-fit select-none">
                {dateStr}
              </span>
            </div>
          )}

          {/* Welcome Heading */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-xs">
            {welcomeHeading}
          </h1>

          {/* Operational Overview Section Inside Card */}
          <div className="pt-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-xs">
              Operational Overview
            </h2>

            {propSubtitle !== undefined ? (
              <div className="text-base sm:text-lg text-white/80 font-normal mt-0.5">
                {propSubtitle}
              </div>
            ) : (
              <p className="text-base sm:text-lg text-white/80 font-normal mt-0.5 leading-snug">
                Real-time indicators and metrics for {formattedMarketName}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
