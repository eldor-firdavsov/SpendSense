import React from 'react';
import { BentoCard, ResponsiveSpan } from './BentoCard';

export interface ChartLegendItem {
  label: string;
  color: string;
}

export interface BentoChartCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  periodSelector?: React.ReactNode;
  legend?: ChartLegendItem[];
  children: React.ReactNode;
  span?: number | ResponsiveSpan;
  hasData?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function BentoChartCard({
  title,
  subtitle,
  icon,
  periodSelector,
  legend,
  children,
  span = 12,
  hasData = true,
  emptyState,
  className = '',
  headerAction,
}: BentoChartCardProps) {
  return (
    <BentoCard span={span} className={`flex flex-col justify-between ${className}`}>
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="p-2 rounded-xl bg-[#EAF0FF] text-[#4B75E8] shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#17211B] tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-[#68736C]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {legend && legend.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-[#68736C] mr-1">
              {legend.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {periodSelector}
          {headerAction}
        </div>
      </div>

      {/* Chart Canvas or Empty State */}
      <div className="flex-1 w-full min-h-[220px]">
        {hasData ? (
          children
        ) : (
          emptyState || (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#DCE4DE] rounded-xl bg-[#F7F9F7]">
              <p className="text-xs text-[#68736C]">
                Tanlangan davr uchun ma’lumotlar mavjud emas
              </p>
            </div>
          )
        )}
      </div>
    </BentoCard>
  );
}

export default BentoChartCard;
