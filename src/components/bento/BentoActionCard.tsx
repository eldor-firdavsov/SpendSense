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

  const content = (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className={`p-2.5 rounded-xl shrink-0 ${iconAccentMap[accent]}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-[#17211B] truncate">
              {title}
            </h4>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-[#68736C] truncate mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="h-8 w-8 rounded-xl bg-[#F7F9F7] border border-[#DCE4DE] flex items-center justify-center text-[#68736C] group-hover:text-[#176B45] group-hover:bg-[#E5F4EA] transition-colors shrink-0">
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group">
        <BentoCard
          variant={variant}
          span={span}
          isInteractive
          className={`${className}`}
        >
          {content}
        </BentoCard>
      </Link>
    );
  }

  return (
    <BentoCard
      variant={variant}
      span={span}
      isInteractive={Boolean(onClick)}
      onClick={onClick}
      className={`group ${className}`}
    >
      {content}
    </BentoCard>
  );
}

export default BentoActionCard;
