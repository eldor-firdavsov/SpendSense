import React from 'react';
import { Skeleton, MetricCardSkeleton, ChartSkeleton, TransactionRowSkeleton } from '@/components/ui/Skeleton';

export default function DashboardSkeleton({
  timeGreeting = 'Xayrli kun',
  displayName = 'Foydalanuvchi',
  currentMonthLabel = 'Joriy hisobot davri',
}: {
  timeGreeting?: string;
  displayName?: string;
  currentMonthLabel?: string;
}) {
  return (
    <main className="flex-1 w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#D5DED7]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[#47544C]">{timeGreeting},</span>
            <span className="text-xs font-semibold text-[#17211B] bg-white px-2.5 py-0.5 rounded-md border border-[#D5DED7]">
              {displayName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#17211B] tracking-tight mt-1 flex items-center gap-2">
            <span>Moliyaviy holatingiz</span>
          </h1>
          <div className="flex items-center gap-2 text-sm text-[#47544C]">
            <Skeleton className="h-4 w-4 rounded-full" />
            <span>Joriy hisobot davri:</span>
            <span className="font-semibold text-[#17211B]">{currentMonthLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1 p-1 bg-white rounded-xl border border-[#D5DED7]">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* 2. Top Fintech Grid: 7 cols + 5 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Balance Card Skeleton (7 cols) */}
        <div className="lg:col-span-7 skeleton-card p-6 sm:p-7 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-6 w-14 rounded-xl" />
            </div>

            <div className="space-y-2 pt-2">
              <Skeleton className="h-12 w-64 sm:w-80" />
              <Skeleton className="h-5 w-40 rounded-full" />
            </div>
          </div>

          <div className="pt-4 border-t border-[#D5DED7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F9F7] -mx-6 -mb-6 p-4 rounded-b-2xl">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-6 w-32" />
          </div>
        </div>

        {/* 3 Summary Metric Cards (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      </div>

      {/* 3. Mid Fintech Grid: 6-Month Chart (8 cols) + Categories & AI (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8">
          <ChartSkeleton height="h-44" />
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="skeleton-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D5DED7]">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="space-y-3.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="skeleton-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* 4. Lower Fintech Grid: Recent Transactions (8 cols) + Budgets/Goals (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 skeleton-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D5DED7] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton variant="circle" className="h-8 w-8" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
          <div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="skeleton-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#D5DED7]">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>

          <div className="skeleton-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#D5DED7]">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
