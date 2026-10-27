import React from 'react';

export type BentoVariant =
  | 'default'
  | 'subtle'
  | 'primary'
  | 'green'
  | 'blue'
  | 'purple'
  | 'amber'
  | 'danger'
  | 'interactive';

export interface ResponsiveSpan {
  default?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: BentoVariant;
  span?: number | ResponsiveSpan;
  rowSpan?: number;
  padding?: 'none' | 'sm' | 'default' | 'lg';
  className?: string;
  isInteractive?: boolean;
}

const spanClasses: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
};

const mdSpanClasses: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
};

const lgSpanClasses: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

const xlSpanClasses: Record<number, string> = {
  1: 'xl:col-span-1',
  2: 'xl:col-span-2',
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  11: 'xl:col-span-11',
  12: 'xl:col-span-12',
};

export function BentoCard({
  children,
  variant = 'default',
  span,
  rowSpan,
  padding = 'default',
  className = '',
  isInteractive = false,
  ...props
}: BentoCardProps) {
  // Resolve variant styles
  const variantStyles: Record<BentoVariant, string> = {
    default: 'bg-white border-[#DCE4DE] text-[#17211B]',
    subtle: 'bg-[#F7F9F7] border-[#DCE4DE] text-[#17211B]',
    primary: 'bg-white border-[#176B45]/30 text-[#17211B] shadow-sm',
    green: 'bg-[#E5F4EA] border-[#176B45]/20 text-[#17211B]',
    blue: 'bg-[#EAF0FF] border-[#4B75E8]/20 text-[#17211B]',
    purple: 'bg-[#F0EBFF] border-[#8664D8]/20 text-[#17211B]',
    amber: 'bg-[#FFF3D9] border-[#D99A32]/25 text-[#17211B]',
    danger: 'bg-[#FCEAEA] border-[#C74747]/25 text-[#17211B]',
    interactive:
      'bg-white border-[#DCE4DE] text-[#17211B] hover:border-[#176B45]/40 hover:shadow-fintech-hover transition-all duration-200 cursor-pointer',
  };

  // Resolve padding
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    default: 'p-4 sm:p-5 lg:p-6',
    lg: 'p-6 sm:p-8',
  }[padding];

  // Resolve span classes
  let spanClass = '';
  if (typeof span === 'number') {
    spanClass = `${mdSpanClasses[span] || ''} ${lgSpanClasses[span] || ''}`;
  } else if (span && typeof span === 'object') {
    spanClass = [
      span.default ? spanClasses[span.default] : '',
      span.md ? mdSpanClasses[span.md] : '',
      span.lg ? lgSpanClasses[span.lg] : '',
      span.xl ? xlSpanClasses[span.xl] : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const rowSpanClass = rowSpan ? `row-span-${rowSpan}` : '';
  const interactiveClass = isInteractive
    ? 'hover:border-[#176B45]/40 hover:shadow-fintech-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer'
    : '';

  return (
    <div
      className={`min-w-0 min-h-0 rounded-2xl border shadow-fintech-card transition-colors ${variantStyles[variant]} ${paddingStyles} ${spanClass} ${rowSpanClass} ${interactiveClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default BentoCard;
