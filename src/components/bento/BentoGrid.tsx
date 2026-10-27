import React from 'react';

export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 12 | 6 | 4 | 3 | 2;
  gap?: 'sm' | 'default' | 'lg';
  className?: string;
}

/**
 * 12-Column Responsive CSS Grid container for Bento dashboard and module compositions.
 */
export function BentoGrid({
  children,
  cols = 12,
  gap = 'default',
  className = '',
  ...props
}: BentoGridProps) {
  const gapClasses = {
    sm: 'gap-3 sm:gap-3.5',
    default: 'gap-3.5 sm:gap-4 lg:gap-5',
    lg: 'gap-4 sm:gap-6 lg:gap-7',
  }[gap];

  const colClasses = {
    12: 'grid-cols-1 md:grid-cols-12',
    6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-6',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    2: 'grid-cols-1 md:grid-cols-2',
  }[cols];

  return (
    <div
      className={`grid ${colClasses} ${gapClasses} items-stretch w-full ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default BentoGrid;
