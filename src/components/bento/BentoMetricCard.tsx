import React from 'react';
import { BentoCard, ResponsiveSpan } from './BentoCard';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface BentoMetricCardProps {
  title: string;
  value: React.ReactNode;
  currency?: string;
  subtext?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'green' | 'red' | 'blue' | 'purple' | 'amber' | 'neutral';
  delta?: {
    value: string | number;
    label?: string;
    trend?: 'up' | 'down' | 'neutral';
  };
  span?: number | ResponsiveSpan;
  className?: string;
  onClick?: () => void;
}

export function BentoMetricCard({
  title,
  value,
  currency,
  subtext,
  icon,
  accent = 'neutral',
  delta,
  span,
  className = '',
  onClick,
}: BentoMetricCardProps) {
  const accentIconStyles = {
    green: 'bg-[#ECFDF5] text-[#059669]',
    red: 'bg-[#FEF2F2] text-[#DC2626]',
    blue: 'bg-[#EFF6FF] text-[#2563EB]',
    purple: 'bg-[#F5F3FF] text-[#7C3AED]',
    amber: 'bg-[#FFFBEB] text-[#D97706]',
    neutral: 'bg-[#F5F6F8] text-[#18181B]',
  }[accent];

  const valueColorStyles = {
    green: 'text-[#059669]',
    red: 'text-[#DC2626]',
    blue: 'text-[#2563EB]',
    purple: 'text-[#7C3AED]',
    amber: 'text-[#D97706]',
    neutral: 'text-[#18181B]',
  }[accent];

  return (
    <BentoCard
      span={span}
      isInteractive={Boolean(onClick)}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-medium text-[#71717A] tracking-wide">
          {title}
        </span>
        {icon && (
          <div className={`p-1.5 rounded-full shrink-0 ${accentIconStyles}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className={`text-xl sm:text-2xl lg:text-3xl font-semibold font-mono tracking-tight tabular-nums break-words ${valueColorStyles}`}
        >
          {value}
        </span>
        {currency && (
          <span className="text-xs font-normal text-[#71717A]">
            {currency}
          </span>
        )}
      </div>

      {(subtext || delta) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-[#71717A] pt-2 border-t border-[#E5E7EB]">
          {subtext && <div className="truncate">{subtext}</div>}

          {delta && (
            <div
              className={`inline-flex items-center gap-1 font-medium tabular-nums shrink-0 ${
                delta.trend === 'up'
                  ? 'text-[#059669]'
                  : delta.trend === 'down'
                  ? 'text-[#DC2626]'
                  : 'text-[#71717A]'
              }`}
            >
              {delta.trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
              {delta.trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta.trend === 'neutral' && <Minus className="h-3 w-3" />}
              <span>{delta.value}</span>
              {delta.label && <span className="text-[10px] text-[#A1A1AA] font-normal">({delta.label})</span>}
            </div>
          )}
        </div>
      )}
    </BentoCard>
  );
}

export default BentoMetricCard;
