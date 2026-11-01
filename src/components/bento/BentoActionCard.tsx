import React from 'react';
import Link from 'next/link';
import { BentoCard, BentoVariant, ResponsiveSpan } from './BentoCard';
import { ChevronRight } from 'lucide-react';

export interface BentoActionCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'green' | 'blue' | 'purple' | 'amber' | 'neutral';
  badge?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  span?: number | ResponsiveSpan;
  className?: string;
  variant?: BentoVariant;
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

export function BentoActionCard({
  title,
  description,
  icon,
  accent = 'green',
  badge,
  href,
  onClick,
  span,
  className = '',
  variant = 'default',
}: BentoActionCardProps) {
  const iconAccentMap = {
    green: 'bg-[#E5F4EA] text-[#176B45]',
    blue: 'bg-[#EAF0FF] text-[#4B75E8]',
    purple: 'bg-[#F0EBFF] text-[#8664D8]',
    amber: 'bg-[#FFF3D9] text-[#D99A32]',
    neutral: 'bg-[#F7F9F7] text-[#17211B]',
  };

  // Resolve span classes for grid placement
  let spanClass = '';
  if (typeof span === 'number') {
    spanClass = `col-span-12 ${mdSpanClasses[span] || ''} ${lgSpanClasses[span] || ''}`;
  } else if (span && typeof span === 'object') {
    spanClass = [
      span.default ? spanClasses[span.default] : 'col-span-12',
      span.sm ? `sm:${spanClasses[span.sm]}` : '',
      span.md ? mdSpanClasses[span.md] : '',
      span.lg ? lgSpanClasses[span.lg] : '',
      span.xl ? xlSpanClasses[span.xl] : '',
    ]
      .filter(Boolean)
      .join(' ');
  } else {
    spanClass = 'col-span-12';
  }

  const content = (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <div className={`p-2.5 rounded-xl shrink-0 ${iconAccentMap[accent]}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-[#17211B] truncate">
              {title}
            </h4>
            {badge && (
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-[#F1F4F2] border border-[#D5DED7] text-[#47544C] text-xs font-semibold shrink-0">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-[#5A675F] truncate mt-0.5 font-medium">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="h-9 w-9 rounded-xl bg-[#F7F9F7] border border-[#D5DED7] flex items-center justify-center text-[#47544C] group-hover:text-[#176B45] group-hover:bg-[#E5F4EA] transition-colors shrink-0">
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`block group ${spanClass}`}>
        <BentoCard
          variant={variant}
          padding={description ? 'default' : 'sm'}
          isInteractive
          className={`h-full ${className}`}
        >
          {content}
        </BentoCard>
      </Link>
    );
  }

  return (
    <div className={spanClass}>
      <BentoCard
        variant={variant}
        padding={description ? 'default' : 'sm'}
        isInteractive={Boolean(onClick)}
        onClick={onClick}
        className={`group h-full ${className}`}
      >
        {content}
      </BentoCard>
    </div>
  );
}

export default BentoActionCard;
