import React from 'react';

export interface BentoSectionProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

/**
 * Semantic section grouping for Bento dashboards and pages.
 */
export function BentoSection({
  title,
  subtitle,
  icon,
  action,
  children,
  className = '',
  headerClassName = '',
}: BentoSectionProps) {
  return (
    <section className={`space-y-3.5 sm:space-y-4 ${className}`}>
      {(title || action) && (
        <div className={`flex items-center justify-between gap-3 ${headerClassName}`}>
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="h-7 w-7 rounded-lg bg-[#E5F4EA] text-[#176B45] flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#17211B] tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-[#68736C]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      {children}
    </section>
  );
}

export default BentoSection;
