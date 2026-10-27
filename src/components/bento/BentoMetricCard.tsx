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
    green: 'bg-[#E5F4EA] text-[#218653]',
    red: 'bg-[#FCEAEA] text-[#C74747]',
    blue: 'bg-[#EAF0FF] text-[#4B75E8]',
    purple: 'bg-[#F0EBFF] text-[#8664D8]',
    amber: 'bg-[#FFF3D9] text-[#D99A32]',
    neutral: 'bg-[#F7F9F7] text-[#17211B]',
  }[accent];

  const valueColorStyles = {
    green: 'text-[#218653]',
    red: 'text-[#C74747]',
    blue: 'text-[#4B75E8]',
    purple: 'text-[#8664D8]',
    amber: 'text-[#D99A32]',
    neutral: 'text-[#17211B]',
  }[accent];

  return (
    <BentoCard
      span={span}
      isInteractive={Boolean(onClick)}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-[#68736C] uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className={`p-2 rounded-xl shrink-0 ${accentIconStyles}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums ${valueColorStyles}`}
        >
          {value}
        </span>
        {currency && (
          <span className="text-xs font-semibold text-[#68736C]">
            {currency}
          </span>
        )}
      </div>

      {(subtext || delta) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-[#68736C] pt-2 border-t border-[#DCE4DE]/60">
          {subtext && <div className="truncate">{subtext}</div>}

          {delta && (
            <div
              className={`inline-flex items-center gap-1 font-semibold tabular-nums shrink-0 ${
                delta.trend === 'up'
                  ? 'text-[#218653]'
                  : delta.trend === 'down'
                  ? 'text-[#C74747]'
                  : 'text-[#68736C]'
              }`}
            >
              {delta.trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
              {delta.trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta.trend === 'neutral' && <Minus className="h-3 w-3" />}
              <span>{delta.value}</span>
              {delta.label && <span className="text-[10px] text-[#87918A] font-normal">({delta.label})</span>}
            </div>
          )}
        </div>
      )}
    </BentoCard>
  );
}

export default BentoMetricCard;
