'use client';

import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export function Skeleton({ className = '', variant = 'rect', ...props }: SkeletonProps) {
  const variantClass = variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded-md' : 'rounded-xl';

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer ${variantClass} ${className}`}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 1,
  className = '',
  lastLineWidth = '70%',
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="h-4 skeleton-shimmer rounded-md"
          style={{ width: idx === lines - 1 && lines > 1 ? lastLineWidth : '100%' }}
        />
      ))}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="skeleton-card p-5 sm:p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton variant="circle" className="h-8 w-8" />
      </div>
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3.5 w-48" />
    </div>
  );
}

export function ChartSkeleton({ height = 'h-52' }: { height?: string }) {
  return (
    <div className="skeleton-card p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#D5DED7]">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className={`flex items-end justify-between gap-3 pt-6 pb-2 ${height}`}>
        {[40, 65, 30, 85, 55, 75].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <div className="w-full flex items-end justify-center gap-1.5 h-full">
              <Skeleton className="w-1/2 max-w-[24px] rounded-t-md" style={{ height: `${h}%` }} />
              <Skeleton className="w-1/2 max-w-[24px] rounded-t-md opacity-60" style={{ height: `${Math.max(15, h - 20)}%` }} />
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionRowSkeleton() {
  return (
    <div className="px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between border-b border-[#D5DED7] last:border-b-0 gap-2.5 sm:gap-4">
      <div className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3.5">
        <Skeleton className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28 sm:w-56" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-16 rounded-md" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-3 shrink-0">
        <Skeleton className="h-4 sm:h-5 w-20 sm:w-24" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-6 w-6 rounded-lg" />
          <Skeleton className="h-6 w-6 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function BudgetCardSkeleton() {
  return (
    <div className="skeleton-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton variant="circle" className="h-9 w-9 shrink-0" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[#D5DED7]">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function GoalCardSkeleton() {
  return (
    <div className="skeleton-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton variant="circle" className="h-9 w-9 shrink-0" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24 font-mono" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[#D5DED7]">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function MessageBubbleSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex items-start gap-3 my-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Skeleton variant="circle" className="h-8 w-8 shrink-0 mt-1" />
      <div
        className={`p-4 rounded-2xl space-y-2 max-w-[80%] sm:max-w-[70%] ${
          isUser ? 'bg-[#DDF3E5] rounded-tr-none' : 'bg-white border border-[#D5DED7] rounded-tl-none shadow-2xs'
        }`}
      >
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        {!isUser && <Skeleton className="h-4 w-36" />}
      </div>
    </div>
  );
}
