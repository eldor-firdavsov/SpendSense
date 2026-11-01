import React from 'react';
import Link from 'next/link';
import { ChevronRight, RefreshCw } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  refreshId?: string;
  refreshTitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

/**
 * Standardized PageHeader component for SpendSense AI pages.
 * Integrates semantic h1 heading, accessibility fallback for automated tests,
 * optional breadcrumb trail, and responsive action triggers.
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  onRefresh,
  isRefreshing = false,
  refreshId,
  refreshTitle = 'Yangilash',
  breadcrumbs,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-5 sm:mb-6 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-[#71717A] mb-2">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#E5E7EB]" />}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-[#18181B] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'font-medium text-[#18181B]' : ''}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#18181B]">
                {title}
              </h1>
              {badge}
            </div>

            {/* Mobile Refresh Button - positioned next to title on the right end */}
            {onRefresh && (
              <button
                type="button"
                id={refreshId || 'page-header-refresh-btn'}
                onClick={onRefresh}
                disabled={isRefreshing}
                className="sm:hidden min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl bg-white border border-[#D5DED7] text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-all shadow-fintech-card shrink-0 cursor-pointer disabled:opacity-50"
                title={refreshTitle}
                aria-label={refreshTitle}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#176B45]' : ''}`} />
              </button>
            )}
          </div>

          {subtitle && (
            <p className="text-xs sm:text-sm text-[#52525B] max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right side controls on desktop & mobile secondary buttons */}
        {(actions || onRefresh) && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-0.5">
            {/* Desktop Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                id={refreshId ? `${refreshId}-desktop` : 'page-header-refresh-desktop-btn'}
                onClick={onRefresh}
                disabled={isRefreshing}
                className="hidden sm:inline-flex min-h-[40px] min-w-[40px] items-center justify-center p-2 rounded-xl bg-white border border-[#D5DED7] text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-all shadow-fintech-card shrink-0 cursor-pointer disabled:opacity-50"
                title={refreshTitle}
                aria-label={refreshTitle}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#176B45]' : ''}`} />
              </button>
            )}

            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
