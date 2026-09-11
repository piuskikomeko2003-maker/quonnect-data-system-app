import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`bg-slate-200/70 dark:bg-slate-800/50 animate-pulse rounded-md ${className}`}
      {...props}
    />
  );
};
