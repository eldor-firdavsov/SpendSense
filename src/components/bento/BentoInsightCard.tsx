import React from 'react';
import Link from 'next/link';
import { BentoCard, ResponsiveSpan } from './BentoCard';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface BentoInsightCardProps {
  title: React.ReactNode;
  message: React.ReactNode;
  eyebrow?: string;
  evidence?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'purple' | 'green' | 'amber' | 'blue';
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  span?: number | ResponsiveSpan;
  className?: string;
  badge?: React.ReactNode;
}

export function BentoInsightCard({
  title,
  message,
  eyebrow = 'AI Tavsiyasi',
  evidence,
  icon,
  accent = 'purple',
  action,
  span,
  className = '',
  badge,
}: BentoInsightCardProps) {
  const variantMap = {
    purple: 'purple' as const,
    green: 'green' as const,
    amber: 'amber' as const,
    blue: 'blue' as const,
  };

  const iconAccentMap = {
    purple: 'bg-[#8664D8] text-white',
    green: 'bg-[#218653] text-white',
    amber: 'bg-[#D99A32] text-white',
    blue: 'bg-[#4B75E8] text-white',
  };

  const actionButtonMap = {
    purple: 'bg-[#8664D8] text-white hover:bg-[#7252c4]',
    green: 'bg-[#218653] text-white hover:bg-[#1b7045]',
    amber: 'bg-[#D99A32] text-white hover:bg-[#bf8425]',
    blue: 'bg-[#4B75E8] text-white hover:bg-[#3862d6]',
  };

  return (
    <BentoCard
      variant={variantMap[accent]}
      span={span}
      className={`relative flex flex-col justify-between overflow-hidden ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg shrink-0 ${iconAccentMap[accent]}`}>
              {icon || <Sparkles className="h-4 w-4" />}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#68736C]">
              {eyebrow}
            </span>
          </div>
          {badge}
        </div>

        <h3 className="text-sm sm:text-base font-bold text-[#17211B] tracking-tight mb-1.5">
          {title}
        </h3>

        <div className="text-xs text-[#68736C] leading-relaxed">
          {message}
        </div>

        {evidence && (
          <div className="mt-3 p-2.5 rounded-xl bg-white/70 border border-[#DCE4DE] text-[11px] text-[#68736C]">
            {evidence}
          </div>
        )}
      </div>

      {action && (
        <div className="mt-4 pt-3 border-t border-[#DCE4DE]/60 flex items-center justify-between">
          {action.href ? (
            <Link
              href={action.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${actionButtonMap[accent]}`}
            >
              <span>{action.label}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${actionButtonMap[accent]}`}
            >
              <span>{action.label}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </BentoCard>
  );
}

export default BentoInsightCard;
