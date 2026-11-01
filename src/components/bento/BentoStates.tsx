import React from 'react';
import { BentoCard, ResponsiveSpan } from './BentoCard';
import { BentoGrid } from './BentoGrid';
import { AlertCircle, RefreshCw, FolderOpen } from 'lucide-react';

export interface BentoEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  span?: number | ResponsiveSpan;
  className?: string;
}

export function BentoEmptyState({
  icon,
  title,
  description,
  action,
  span = 12,
  className = '',
}: BentoEmptyStateProps) {
  return (
    <BentoCard
      span={span}
      className={`text-center py-12 px-6 flex flex-col items-center justify-center border-dashed border-[#D5DED7] bg-[#F7F9F7]/70 ${className}`}
    >
      <div className="h-12 w-12 rounded-2xl bg-white border border-[#D5DED7] flex items-center justify-center text-[#47544C] mb-3.5 shadow-fintech-card">
        {icon || <FolderOpen className="h-6 w-6 text-[#5A675F]" />}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-[#17211B] mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-[#47544C] max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </BentoCard>
  );
}

export interface BentoErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  span?: number | ResponsiveSpan;
  className?: string;
}

export function BentoErrorState({
  title = 'Xatolik yuz berdi',
  message,
  onRetry,
  span = 12,
  className = '',
}: BentoErrorStateProps) {
  return (
    <BentoCard
      variant="danger"
      span={span}
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[#FCEAEA] text-[#C03838] shrink-0 border border-[#C03838]/20">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm sm:text-base font-semibold text-[#C03838]">
            {title}
          </h4>
          <p className="text-sm sm:text-base text-[#47544C] mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#C03838]/30 bg-white text-xs sm:text-sm font-medium text-[#C03838] hover:bg-[#FCEAEA] transition-colors shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Qayta urinish</span>
        </button>
      )}
    </BentoCard>
  );
}

export interface BentoSkeletonProps {
  span?: number | ResponsiveSpan;
  height?: string;
  className?: string;
}

export function BentoSkeleton({
  span = 12,
  height = 'h-40',
  className = '',
}: BentoSkeletonProps) {
  return (
    <BentoCard span={span} className={`animate-pulse bg-[#F7F9F7] ${height} ${className}`}>
      <div className="space-y-3 h-full flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-[#DCE4DE]/60 rounded-md" />
          <div className="h-3 w-44 bg-[#DCE4DE]/40 rounded-md" />
        </div>
        <div className="h-8 w-36 bg-[#DCE4DE]/70 rounded-lg" />
        <div className="h-2 w-full bg-[#DCE4DE]/30 rounded-full" />
      </div>
    </BentoCard>
  );
}

export function BentoLoadingGrid() {
  return (
    <BentoGrid>
      <BentoSkeleton span={{ default: 12, md: 7, lg: 8 }} height="h-48" />
      <BentoSkeleton span={{ default: 12, md: 5, lg: 4 }} height="h-48" />
      <BentoSkeleton span={{ default: 12, md: 4 }} height="h-36" />
      <BentoSkeleton span={{ default: 12, md: 4 }} height="h-36" />
      <BentoSkeleton span={{ default: 12, md: 4 }} height="h-36" />
      <BentoSkeleton span={{ default: 12, md: 8 }} height="h-72" />
      <BentoSkeleton span={{ default: 12, md: 4 }} height="h-72" />
    </BentoGrid>
  );
}
